# Giai đoạn 1 — kiểm tra trước đồng bộ ID và nghiệm thu đăng nhập

## Kết quả mới nhất — Docker/IAM đã hoạt động, 13:25–13:27 ngày 12/11/2026

**Dry-run mới: PASS, exit 0. Chưa apply, chưa sửa SQLite/seed, chưa khởi động Backend hoặc Web A/B. Dừng chờ xác nhận của người dùng.** Kết quả này thay thế trạng thái thiếu kết nối ở lượt kiểm tra bên dưới; giữ lượt cũ làm lịch sử.

Plan mới hoàn toàn, tạo từ GET Keycloak thật và snapshot SQLite trong lượt này, **không dùng plan cũ làm đầu vào**:

```text
D:\ZeroTrust\.local\staff-id-plans\phase1-20261112T062520Z.json
```

SHA-256: `e7cea8a0a2b187aab66efdb51b54b781bb0cc8a49512d3d4afa352f27d84fce4`.

| Tài khoản | Role đối chiếu | ID SQLite ↔ Keycloak |
|---|---|---|
| admin01 | admin | **PASS — khớp**, giữ nguyên |
| employee01 | employee | **FAIL — còn lệch**, có trong plan mới |
| employee02 | employee | **FAIL — còn lệch**, có trong plan mới |
| manager01 | manager | **FAIL — còn lệch**, có trong plan mới |
| manager02 | manager | **FAIL — còn lệch**, có trong plan mới |
| auditor01 | auditor | **FAIL — còn lệch**, có trong plan mới |

Cả sáu lookup username đều duy nhất, đúng role local/seed/effective role Keycloak, enabled/local/active. Năm ID đích chưa thuộc hồ sơ khác; năm ID cũ không còn trong Keycloak. Admin01 khớp ID `659f01ed-ead4-4392-bb76-070644feea9f`. Script `resolve()` kiểm tra trực tiếp các điều kiện này trước khi trả plan; đây không phải suy luận từ kết quả ngày 11/11. Ánh xạ cũ → mới của năm tài khoản nằm trong plan; đối chiếu đủ sáu ID trong artifact `summary.json`.

| Kiểm tra bổ sung | Kết quả mới |
|---|---|
| Discovery Keycloak | **PASS**, HTTP 200, issuer đúng `http://localhost:8080/realms/company-iam` |
| Toàn vẹn SQLite/FK | **PASS**, cả trước và sau dry-run; quét 11 FK |
| Kiểm kê tham chiếu/điều kiện chặn | **PASS**, không thấy collision, FK chưa phân loại hoặc action/workflow liên quan đang xử lý khiến script phải dừng |
| Backup/rollback/recovery | **PASS 25/25 test chạy lại trên fixture**; backup lịch sử đọc được, integrity/FK đạt, hash giữ nguyên |
| Cổng Backend/Web | 3001, 5173, 5174 đều không có listener; agent không khởi động chúng |
| Kiểm kê đầy đủ writer | **CHƯA XÁC MINH ĐỦ**: CIM trả PermissionDenied; node PID 71808 vẫn chưa xác định vai trò. Cổng đóng và DB không đổi trong khoảng quan sát không chứng minh tuyệt đối không có writer nền. |
| Bảo toàn dữ liệu | **PASS**: nội dung logic SQLite, hàng admin01, seed, các file backup và Git index không đổi; không có marker recovery |
| Plan còn khớp snapshot cuối lượt | **PASS** tại 13:27; phải kiểm tra lại ngay trước apply, không bỏ stale-plan guard |

Docker API từ sandbox bị từ chối quyền, nên trạng thái `iam-keycloak Running`, `iam-postgres Healthy`, `zerotrust-ldap-1 Running` là thông tin người dùng xác nhận; Keycloak HTTP/Admin API đã được agent kiểm tra độc lập. Chưa gọi LDAP hoặc kiểm thử MFA/login browser.

**Số hàng dự kiến:** 5 staff + 10 attendance + 10 corrections + 16 notifications = **41 hàng nghiệp vụ riêng biệt**. Hai liên kết reviewer của manager01 nằm trong 10 corrections này, không cộng thành hai hàng mới. Thêm 5 hàng ledger và sửa đúng 5 ID trong seed. notification_reads, access_requests, lifecycle_workflows, directory_maintenance không có hàng cần chuyển của năm ID này. Audit/events/identity_events/alerts/actions/evidence/outbox và JSON lịch sử giữ nguyên.

**Backup thật cho đợt đồng bộ chưa tạo**; chỉ tạo sau xác nhận, trước mọi UPDATE, tại `.local/staff-id-backups/<UTC>-<random>/`. Backup cũ không thay thế bước này. Trước apply phải làm rõ/dừng mọi writer được xác định, kiểm tra lại plan và tạo backup; không chỉ dựa vào việc cổng 3001 đóng.

Artifacts mới: `.runtime/login-phase1/20261112T062520Z/` (`baseline.json`, `dry-run.log`, `dry-run-result.json`, `environment-backups.json`, `reconciliation-tests.log`, `summary.json`). Chỉ chứa thông tin đã lọc, hash, số đếm và định danh; không có password/token/secret/cookie/raw response. Không sửa source ứng dụng, không commit/push/deploy hoặc thay/reset container.

## Lượt trước — IAM chưa sẵn sàng (lịch sử)

Lượt kiểm tra: **12/11/2026, 13:11–13:15 giờ Việt Nam** (06:11–06:15 UTC). Phạm vi: đọc môi trường thật, dry-run và test fixture; chưa dừng/khởi động dịch vụ, chưa apply, chưa sửa dữ liệu thật. Kết quả dưới đây thay cho việc suy trạng thái hiện tại từ các lần kiểm tra 11/11.

**Kết luận: chưa đủ điều kiện chuyển sang giai đoạn 2.** Keycloak không truy cập được nên chưa thể xác minh lại sáu ID và chưa có plan mới hợp lệ. Không dùng plan lịch sử để apply.

## Kết quả PASS/FAIL

| Kiểm tra | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| SQLite hiện tại | **PASS** | `mode=ro`, `query_only=1`; `integrity_check=ok`, `foreign_key_check` không có vi phạm; journal WAL. |
| Sáu hồ sơ local và seed | **PASS** | Mỗi username duy nhất, role mong đợi đúng, local, disabled=0, governance active, ID SQLite khớp staff.json. |
| Xác minh lại ID Keycloak của 6 tài khoản | **CHƯA XÁC MINH** | Discovery/token endpoint localhost:8080 không truy cập được. Không suy rằng admin01 vẫn khớp IAM hoặc năm tài khoản vẫn lệch chỉ từ bằng chứng cũ. |
| So sánh SQLite với ID cũ trong plan 11/11 | **PASS — đối chiếu lịch sử** | Năm ID local vẫn đúng bằng `old_id` trong plan cũ; chưa có bảng reconciliation. Không phải đối chiếu live Keycloak. |
| Keycloak/Backend/Web A/Web B truy cập từ công cụ | **FAIL kết nối** | Không truy cập được 8080, 3001 `/health`, 5173, 5174. Chưa phải kiểm thử đăng nhập hay RBAC. |
| Docker Engine | **FAIL truy cập** | Docker CLI báo không tìm thấy pipe `dockerDesktopLinuxEngine`; chưa đọc được trạng thái container hiện tại. Không tự mở Docker hoặc recreate container. |
| Kiểm tra writer SQLite | **CHƯA XÁC MINH ĐỦ** | netstat không thấy listener các cổng 3001/5173/5174/8080/8090/8443; CIM/Get-NetTCPConnection không truy vấn được, Restart Manager trả mã 29. Có node PID 71808 nhưng chưa xác định vai trò; không coi đó là Backend hoặc tự dừng. |
| Dry-run thật bằng script hiện tại | **FAIL do phụ thuộc** | Exit 1 ở token endpoint Keycloak; không tạo file plan. Không có thay đổi dữ liệu. |
| Backup cũ | **PASS cấu trúc** | SQLite backup kiểm tra integrity/FK đạt; seed backup khớp ID trong DB backup của cả sáu tài khoản. JSON backup client đọc được. Không kết luận backup cũ thay thế được backup ngay trước apply. |
| Backup/rollback/recovery và nhận diện sau sync trên fixture | **PASS 25/25 test** | Có kiểm tra lỗi ghi file, rollback sau thay seed, interruption trước/sau commit, stale plan, bảo toàn admin/history và sáu profile qua Backend. Đây là dữ liệu tổng hợp, không phải login live. |
| Bảo toàn dữ liệu trong giai đoạn 1 | **PASS** | Hash nội dung logic SQLite, admin01, seed, các backup và Git index giữ nguyên giữa đầu/cuối lượt kiểm tra. Không có marker recovery. |

Sáu hồ sơ đều có `mfa_required=0` trong SQLite. Đây chỉ là thuộc tính local của sáu tài khoản, **không chứng minh MFA tuần 5 đã bật/tắt hoặc nghiệm thu**. Chưa đọc lại policy/credential MFA Keycloak và chưa kiểm thử LDAP tuần 6. Backend config có Directory/Audit được cấu hình, không đồng nghĩa dịch vụ thực tế đang hoạt động.

## Inventory cục bộ hiện tại

Database cấu hình: `D:\ZeroTrust\backend\data\attendance.sqlite`; seed: `D:\ZeroTrust\backend\data\staff.json`. Không thấy override đường dẫn trong môi trường của công cụ; chưa đọc được environment của các tiến trình khác.

Snapshot có 25 hồ sơ, 10 hàng attendance, 15 corrections, 41 actions, 62 alerts, 2.802 events, 254 identity_events, 3.423 audit_outbox; các bảng quyền/lifecycle/directory cũng đã được kiểm kê.

Dùng **ID cũ lịch sử**, inventory script kiểm tra 11 FK và các cột/JSON tham chiếu, không thấy blocker của các ID này. Dự kiến vẫn có 41 hàng nghiệp vụ liên quan: 5 staff, 10 attendance, 10 corrections (có 2 liên kết reviewer manager01 trong các đơn này), 16 notifications. notification_reads/access_requests/lifecycle_workflows/directory_maintenance không có liên kết cần chuyển của năm ID này. **Các số này chưa phải plan được duyệt**, vì ID mới chưa được xác minh lại với Keycloak.

## Backup và rollback

Đã kiểm tra chỉ đọc và giữ nguyên:

- `backup-data-admin01/attendance.sqlite`, `staff.json`, `audit.jsonl`.
- `.local/keycloak-client-backups/security-dashboard-20261111T052852Z-e16e770a.json`.
- `.local/keycloak-client-backups/security-dashboard-20261111T061708Z-200e5d82.json`.

Chưa tạo backup đồng bộ mới; bước đó thuộc giai đoạn 2 sau xác nhận. Script sẽ tạo `.local/staff-id-backups/<UTC>-<random>/` trước UPDATE, dùng SQLite backup API, kiểm tra snapshot/hash/FK và sao lưu seed nguyên bản. Khi lỗi trước commit, rollback database và khôi phục seed; marker/recover xử lý gián đoạn giữa hai tài nguyên. Test được chạy trên fixture riêng, không dùng DB thật hoặc backup thật làm fixture.

## Plan và artifacts

Đã thử đúng lệnh dry-run, không có `--apply`:

```powershell
python -B scripts/reconcile_staff_ids.py --plan .local/staff-id-plans/phase1-20261112T061107Z.json
```

Lỗi đã lọc: `Keycloak POST /realms/master/protocol/openid-connect/token: connection/response failed; details omitted.` **File plan trên chưa tồn tại**; không tự dựng plan bằng ID cũ để đánh dấu đạt.

Artifacts: `.runtime/login-phase1/20261112T061107Z/` gồm baseline, sqlite-before, local-inventory (ghi rõ dữ liệu lịch sử, không phải apply plan), process-review/file-users, backup-review, dry-run log/result, reconciliation-tests.log và preservation.json. Không lưu password/token/cookie/raw response. Baseline chứa hash, metadata, số đếm; không chứa bản sao hàng nghiệp vụ.

## Bước tiếp theo

1. Người vận hành mở Docker Desktop và xác nhận đúng các container IAM hiện có hoạt động, giữ volumes; báo khi Keycloak localhost:8080 truy cập được. Chưa khởi động Backend hoặc chạy setup/reset.
2. Tiếp tục giai đoạn 1: xác minh live cả sáu username/role/local source/ID, tạo plan mới, kiểm tra writer và báo kết quả. Nếu trạng thái thay đổi so với 11/11 thì điều tra trước; không mặc định ánh xạ cũ vẫn đúng.
3. Chỉ khi người dùng xác nhận giai đoạn 2 mới dừng writer an toàn, backup mới, apply plan vừa kiểm tra, kiểm tra toàn vẹn và cả sáu ID, khởi động Backend và chạy test Backend.
4. Sau đó mới nghiệm thu đăng nhập/phân quyền Web A/B, MFA tuần 5, LDAP tuần 6. Không chạy test live cũ có thể provision/reset tài khoản để lấy kết quả PASS.

Chưa sửa source ứng dụng trong lượt giai đoạn 1 vì chưa có bằng chứng lỗi mới cần sửa. Không commit/push/deploy, không restore/reset SQLite/Keycloak/LDAP hoặc Docker volumes.
