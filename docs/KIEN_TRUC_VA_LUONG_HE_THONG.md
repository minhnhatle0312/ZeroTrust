# Kiến trúc và luồng hệ thống Nhịp IAM

Tài liệu thiết kế theo mã nguồn tuần 5–10, cập nhật 07/11/2026. Sơ đồ là minh họa thiết kế, **không phải bằng chứng đã chạy**.

## Thành phần và ranh giới tin cậy

```mermaid
flowchart LR
  subgraph Client[Máy người dùng LAN hoặc VPN]
    A[Web A · React]
    B[Web B · React]
  end
  subgraph Host[Máy chủ lab · HTTPS gateway]
    G[Gateway · TLS · kiểm tra Host]
    API[Express API · JWT/RBAC/scope/session]
    SQ[(SQLite · nghiệp vụ/hold/audit outbox)]
    OP[Operator CLI · thao tác LDAP đã phê duyệt]
  end
  subgraph Identity[Mạng IAM Docker]
    KC[Keycloak · OIDC/PKCE/MFA]
    KD[(PostgreSQL Keycloak)]
    LD[OpenLDAP · LDAPS]
  end
  subgraph Monitor[Mạng Audit Docker riêng]
    AU[Audit Service · token máy chủ]
    AD[(PostgreSQL Audit)]
    PY[Python baseline worker]
  end
  A -->|HTTPS| G
  B -->|HTTPS| G
  G --> API
  G --> KC
  API --> SQ
  API -->|Kiểm tra phiên và trạng thái| KC
  KC --> KD
  KC -->|READ_ONLY federation| LD
  OP -->|Yêu cầu JCL đã duyệt| LD
  SQ -->|Outbox / ACK sau commit| AU
  API -->|Collector Events/Admin Events| KC
  AU --> AD
  PY --> AD
```

- Trình duyệt không giữ client secret, credential LDAP hay token Audit Service. UI chỉ hỗ trợ thao tác; API kiểm tra quyền lại.
- Máy thứ hai tin CA lab và truy cập gateway HTTPS chung. SSO chỉ chia sẻ phiên trong cùng hồ sơ trình duyệt; hai máy đăng nhập riêng, không chuyển cookie giữa máy.
- API chỉ tin loopback proxy, đọc `azp` để phân biệt Web A/B và giới hạn resource. JWT hợp lệ chưa đủ: còn role/scope, tài khoản active, required actions, phiên Keycloak, cutoff và hold vòng đời.
- Keycloak truy cập DB của chính nó; Audit Service dùng DB riêng. Collector gọi REST chính thức, không truy vấn bảng nội bộ Keycloak.
- LDAP là nguồn danh tính cho user LDAP. Ghi Join/Change/Leave qua CLI operator theo workflow; Keycloak federation vẫn READ_ONLY.
- Local hold giúp fail-closed khi nhiều hệ thống cập nhật chưa đồng bộ. Không có transaction phân tán giữa SQLite/LDAP/Keycloak.

## OIDC, MFA và truy cập API

```mermaid
sequenceDiagram
  actor U as Người dùng
  participant W as Web A/B
  participant K as Keycloak
  participant L as LDAP
  participant P as Backend
  U->>W: Mở ứng dụng
  W->>K: Authorization Code + PKCE S256
  K->>L: Xác thực user LDAP qua LDAPS nếu thuộc federation
  K->>U: TOTP / required actions theo chính sách
  U->>K: Hoàn tất xác thực
  K-->>W: Authorization code
  W->>K: Đổi code + verifier
  K-->>W: Token theo client/audience
  W->>P: Bearer access token
  P->>P: JWT, role/scope, hold, cutoff
  P->>K: Xác nhận account/session
  P->>P: Đọc lại trạng thái và ghi audit transaction
  P-->>W: ALLOW hoặc DENY + request ID
```

## SSO và logout

```mermaid
sequenceDiagram
  participant A as Web A
  participant K as Keycloak
  participant B as Web B
  participant P as Backend
  A->>K: Đã có phiên SSO trong hồ sơ trình duyệt
  A->>B: Chuyển ứng dụng
  B->>K: Authorize cho client Web B
  K-->>B: Phiên SSO hợp lệ; vẫn áp dụng required actions
  B->>P: Gọi API Web B
  P-->>B: Chỉ admin/auditor đúng scope
  A->>K: Logout hoặc revoke phiên
  B->>P: Yêu cầu kế tiếp với token cũ
  P->>K: Kiểm tra sid (cache có giới hạn)
  P-->>B: SESSION_REVOKED / yêu cầu đăng nhập lại
```

## Join, Change, Leave

```mermaid
sequenceDiagram
  actor Admin
  participant API
  participant SQ as SQLite
  participant OP as Operator LDAP
  participant KC as Keycloak
  Admin->>API: Tạo và duyệt workflow có version/note
  API->>SQ: Snapshot trước/sau + lịch sử
  Admin->>API: Execute
  API->>SQ: Hold + cutoff + revoke grant (transaction)
  alt Danh tính LDAP
    API-->>Admin: source_wait / partial
    Admin->>OP: Chạy CLI theo workflow đã duyệt
    OP->>SQ: Claim source_write
    OP->>OP: Ghi LDAP, lưu receipt
    Admin->>API: Execute để đối chiếu tiếp
    API->>KC: Full sync + đọc trạng thái mới
  else Danh tính local
    API->>KC: Tạo/cập nhật danh tính theo request marker
  end
  API->>KC: Revoke phiên, enable/disable theo workflow
  API->>KC: Đối chiếu trạng thái/role/phiên
  alt Đối chiếu thành công
    API->>SQ: synced + active hoặc left
  else Có lỗi hoặc không chắc chắn
    API->>SQ: partial/failed, giữ hold
  end
```

## Audit và phát hiện

```mermaid
sequenceDiagram
  participant API
  participant SQ as SQLite outbox
  participant AU as Audit Service
  participant PG as Audit PostgreSQL
  participant PY as Python worker
  participant B as Web B
  API->>SQ: Event + outbox cùng transaction
  API->>AU: Batch với event_id ổn định
  AU->>PG: INSERT ON CONFLICT + rule incidents
  PG-->>AU: Commit
  AU-->>API: ACK accepted
  API->>SQ: Đánh dấu đã gửi
  Note over API,PG: Mất ACK thì gửi lại cùng ID; không tự bỏ dữ liệu lỗi
  PY->>PG: Đọc batch sau checkpoint + features event-time
  PY->>PG: Kết quả/incident/checkpoint cùng transaction
  B->>API: Tra cứu hoặc review có role
  API->>AU: Truy vấn nội bộ bằng token máy chủ
  AU-->>B: Qua API: log/Normal/Anomaly/history
```

## ERD các bảng chính

Hai sơ đồ thuộc hai kho độc lập; user_id ở Audit là tham chiếu logic tới subject Keycloak, không phải foreign key xuyên database.

```mermaid
erDiagram
  STAFF ||--o{ ATTENDANCE : owns
  STAFF ||--o{ CORRECTIONS : requests
  STAFF ||--o{ ACCESS_REQUESTS : requests
  ACCESS_REVIEWS ||--o{ ACCESS_REVIEW_ITEMS : contains
  LIFECYCLE_WORKFLOWS ||--o{ LIFECYCLE_HISTORY : records
  STAFF {
    text id PK
    text username UK
    text role
    text team
    text identity_source
    text governance_state
    integer revoked_before
  }
  LIFECYCLE_WORKFLOWS {
    text id PK
    text target_id
    text kind
    text approval
    text state
    integer version
  }
  ACCESS_REQUESTS {
    text id PK
    text user_id FK
    text resource
    text state
    text expires_at
  }
  AUDIT_OUTBOX {
    integer seq PK
    text source
    text event_key
    text payload
    text delivered_at
  }
```

```mermaid
erDiagram
  AUDIT_EVENTS ||--o{ AUDIT_INCIDENTS : triggers
  AUDIT_INCIDENTS ||--o{ INCIDENT_HISTORY : reviewed
  AUDIT_EVENTS ||--o| DETECTION_RESULTS : classified
  DETECTION_RUNS ||--o{ DETECTION_RESULTS : produces
  AUDIT_EVENTS ||--o| DETECTION_LABELS : reviewed
  AUDIT_EVENTS {
    text event_id PK
    bigint seq UK
    timestamptz timestamp
    text source
    text user_id
    text request_id
    text session_id
    text decision
  }
  DETECTION_RESULTS {
    text event_id PK,FK
    text run_id FK
    text prediction
    jsonb features
    integer version
  }
  DETECTION_EVALUATIONS {
    text id PK
    text dataset_hash
    jsonb dataset
    jsonb metrics
    integer sample_count
  }
```

## Quyết định và giới hạn thiết kế

Chọn SQLite cho nghiệp vụ đang có, PostgreSQL riêng cho audit để chuyển đổi từng phần. Outbox tránh phụ thuộc tức thời vào availability của Audit Service nhưng cần dung lượng đĩa và backup. Retention, replay, late events, cache và restore phải được đo kiểm; chưa có số liệu đảm bảo không mất log, hiệu năng hoặc HA. Đây là mô hình IAM theo hướng Zero Trust, chưa phải triển khai đầy đủ kiến trúc Zero Trust doanh nghiệp.
