# Hợp đồng API sự cố — chuẩn bị tích hợp Web B Đợt 5

Tài liệu mô tả mã nguồn Đợt 4, chưa triển khai lab. Không có endpoint tự thực hiện khắc phục. Các ví dụ dùng tham chiếu minh họa, không phải dữ liệu vận hành.

## 1. Phạm vi và quyền

Giữ hai kho nguồn: SQLite chứa cảnh báo backend/collector; PostgreSQL chứa sự cố Audit và Python Detection. Dùng chung cấu trúc `detail.schemaVersion=1`, không tạo kho sự cố thứ ba hoặc API danh sách trùng lặp.

Mọi endpoint công khai dưới đây đi qua middleware JWT, trạng thái tài khoản/phiên và RBAC hiện có. Admin/auditor được đọc toàn bộ dữ liệu bảo mật theo chính sách cũ; chỉ admin ghi điều tra. Employee/manager không được truy cập bằng cách đoán ID. Ngoại lệ auditor được gán nhãn Detection từ trước vẫn giữ nguyên, không mở rộng sang cập nhật sự cố.

## 2. Endpoint

| Endpoint | Quyền | Hành vi Đợt 4 |
|---|---|---|
| `GET /api/security/alert-list` | admin/auditor | Giữ `items,total,page,limit,pages`; mở rộng lọc nguồn và trường thời gian. Mỗi bản ghi có `version`. |
| `GET /api/security/alerts/:id` | admin/auditor | Mới: `{alert,detail}`; bằng chứng, diễn biến, nhận định, đề xuất, hành động liên kết, kết quả xác minh và lịch sử. |
| `GET /api/security/alerts/:id/context` | admin/auditor | Giữ `alert,events,logins`; thêm `detail` và `contextIsEvidence:false`. Context chỉ theo đúng actor ID; thiếu actor trả context rỗng. |
| `PATCH /api/security/alerts/:id` | admin | Mở rộng API cũ: điều tra có version, ghi nhận đề xuất, liên kết hành động thật, kết quả kiểm tra và trạng thái. |
| `GET /api/security/central/incidents` | admin/auditor | Giữ `rows,total`; bổ sung lọc, phân trang và `complete`. Bao gồm sự cố Audit và `PYTHON_BASELINE`. |
| `GET /api/security/central/incidents/:id` | admin/auditor | Giữ `incident,history`; thêm `detail` cùng schema với SQLite. |
| `POST /api/security/central/incidents/:id` | admin | Mở rộng cập nhật có version; lịch sử và audit PostgreSQL cùng transaction. |
| `GET /api/security/central/health` | admin/auditor | Dịch vụ riêng trả capability `incidentSchemaVersion:1` trong thông tin remote. Node từ chối ghi sự cố nếu Audit chưa có capability này. |

Các API sự kiện đã có (`/api/security/events/:id`, `/api/security/central/events/:id`) tiếp tục dùng để mở bản ghi nguồn. Timeline, bằng chứng và lịch sử nằm trong chi tiết sự cố; không cần thêm endpoint sao chép cùng dữ liệu.

### Bộ lọc

- SQLite: `status=open|reviewing|resolved|false_positive`, `severity=high|medium`, `source=web-a|web-b|api|keycloak|keycloak-admin`, `from/to=YYYY-MM-DD`, `timeField=updated|occurred|detected`, `q`, `page`, `limit`, sort/direction theo allowlist hiện có. Nguồn không được suy ra từ username; chỉ xét liên kết sự kiện chính xác. SQLite chưa lưu sự kiện Keycloak Admin làm bằng chứng trực tiếp nên lọc nguồn này thường rỗng.
- PostgreSQL: `state=open|reviewing|resolved|false_positive|all` (mặc định `open`), `severity=low|medium|high|critical`, `source` theo danh sách trên, `detector=audit|detection`, `from/to` ISO có timezone, `timeField=detected|occurred|updated`, `limit=1..200`, `offset=0..1000000`. Nguồn lọc theo bằng chứng phát hiện trực tiếp, không theo sự kiện kiểm tra thêm sau này.
- Chi tiết cả hai nguồn: `historyLimit=1..100`, `historyBefore=<nextCursor>`. Con trỏ opaque đối với UI; SQLite dùng version, PostgreSQL dùng ID lịch sử. Không chuyển con trỏ từ kho này sang kho khác.
- Khoảng thời gian PostgreSQL có đủ from/to tối đa 366 ngày. Chưa truyền bộ lọc thời gian không tự loại các sự cố cũ. Các trường thiếu thời gian phát hiện không khớp bộ lọc detected, không được bịa timestamp thay thế.

## 3. Mô hình chi tiết chung

| Nhóm | Trường / ý nghĩa |
|---|---|
| Định danh | `schemaVersion`, `origin=sqlite|postgresql`, `incidentRef`, `id`, `type`, `rule`, `severity`, `state`, `version`. `id` nguyên bản dùng trong URL, không đưa `incidentRef` có prefix vào URL. |
| Thời gian | `occurredAt`, `detectedAt`, `lastObservedAt`, `updatedAt`; thiếu nguồn trả null. SQLite cũ không có detectedAt chính xác; không sao chép createdAt thành detectedAt. PostgreSQL burst dùng thời gian sớm nhất của bằng chứng phát hiện còn đọc được. |
| Chủ thể | `subject.userId/username`; không tự gán danh tính cho actor ẩn danh hoặc những người chỉ trùng IP. |
| Thông tin ghi nhận | `facts.ips/applications/resources/requestIds`, `evidence.items/missing/complete/provenance`. Đây là dữ liệu nguồn, không phải nhận định nguyên nhân. |
| Nguyên nhân | `assessment` null nếu chưa có; khi có gồm `kind:analyst_assessment`, `text`, `confidence`, `evidenceRefs`, `actor`, `time`. `confirmed` là mức người điều tra khai báo có căn cứ, không phải hệ thống tự chứng minh quan hệ nhân quả. |
| Đề xuất | `recommendations.generated` theo luật thực có/citation/catalog version; `recorded` do admin ghi. `kind=system_proposal|analyst_proposal`, `executed:false`. |
| Thực hiện | `actions` là các bản ghi hành động SQLite hoặc sự kiện thực thi Audit được liên kết. Có trạng thái thực tế hoặc `missing:true`; không chuyển đề xuất thành kết quả. |
| Xác minh | `verification` có `kind:analyst_verification`, result/method/expectedDecision, bằng chứng và người/thời điểm nhập. `resolution.verified` kiểm tra lại tính sẵn có, thời gian và kết quả của bằng chứng. |
| Diễn biến | `timeline.items` tách `source_event`, `detection`, `investigation`; thời gian từ nguồn tương ứng. `history.items/nextCursor/complete` lưu before/after, actor, request ID và version. `handler` luôn là người/nguồn cập nhật gần nhất dù đang đọc trang lịch sử cũ. |
| Giới hạn | `limitations`; `resolution.legacy`; `legacyNote` ở SQLite nếu chỉ còn ghi chú cũ. Không dựng thêm lịch sử cho giai đoạn chưa được ghi nhận. |

Trường bổ sung theo nguồn có thể khác nhau: SQLite có count; PostgreSQL có `detector` và `detection` (rule/features/run/version thật nếu còn). Giữ các envelope cũ để không phá chức năng đọc hiện tại.

`evidence` tối đa 500 bản ghi mỗi chi tiết; vượt mức có `complete:false`. Lịch sử có thể tải tiếp bằng con trỏ. Timeline ở chi tiết sử dụng trang lịch sử đang yêu cầu, không tự ngụ ý đã lấy toàn bộ lịch sử. Context theo tài khoản, IP mới hay truy cập ngoài giờ không tự trở thành bằng chứng nguyên nhân.

Version cũng tăng khi liên kết thêm sự kiện phát hiện, nên không suy ra số lần người dùng chỉnh sửa chỉ từ hiệu số version. Lịch sử điều tra và timeline sự kiện được đọc riêng theo nguồn gốc của chúng.

## 4. Body cập nhật

SQLite dùng `status`, PostgreSQL dùng `state`. Các trường còn lại thống nhất:

```json
{
  "version": 1,
  "note": "Đối chiếu căn cứ trước khi đưa ra nhận định.",
  "assessment": {
    "text": "Nhận định của người điều tra, cần đối chiếu nguồn.",
    "confidence": "supported",
    "evidenceRefs": ["events:123"]
  },
  "recommendation": {
    "text": "Đề nghị đối chiếu cấu hình client với quyền được cấp.",
    "evidenceRefs": ["events:123"]
  }
}
```

`note` 10–500 ký tự; `text/method` 10–1000; mỗi danh sách tham chiếu tối đa 100; tối đa 100 đề xuất và 100 liên kết hành động trong metadata. Vẫn áp dụng giới hạn JSON 16 KB ở Express. Reject trường ngoài allowlist, actor/time/requestId/version giả hoặc nội dung có mẫu credential rõ ràng. Bộ lọc mẫu không bảo đảm phát hiện mọi bí mật trong văn bản tự do; UI cần tiếp tục hướng dẫn không nhập mật khẩu/token/OTP.

- `confidence=hypothesis|supported|confirmed|refuted`. Mọi mức ngoài hypothesis cần ít nhất một bằng chứng hợp lệ.
- `recommendation` thêm một đề xuất có citation, không chạy hành động. Lịch sử lưu cả trạng thái metadata trước và sau thay đổi.
- `actionRefs` chỉ thêm liên kết đã tồn tại: SQLite `action:<actions.id>` thuộc đúng target của sự cố; PostgreSQL `audit:<event_id>` thuộc các loại thực thi được cho phép và cùng danh tính hoặc có `details.target_user_id` đúng danh tính bị tác động.
- `evidenceRefs`: SQLite `events:<id>` hoặc `identity_events:<id>`; PostgreSQL `audit:<event_id>`. Bằng chứng bổ sung phải thuộc cùng user ID đã biết, hoặc là sự kiện thực thi có target chính xác. Không tự ghép theo username ẩn danh hoặc IP dùng chung.
- Client không được gửi `actor`, `requestId`, `time`, `executed` hoặc kết quả hành động tự tạo. Node xác định actor/request ID từ request đã xác thực; API chỉ tham chiếu kết quả nguồn.

### Điều kiện xác nhận khắc phục

Gửi status/state `resolved` cùng `verification`:

```json
{
  "version": 2,
  "status": "resolved",
  "note": "Đã đối chiếu kết quả kiểm tra sau sự kiện.",
  "verification": {
    "result": "passed",
    "method": "Kiểm tra lại yêu cầu cùng danh tính và đối chiếu nhật ký.",
    "expectedDecision": "ALLOW",
    "evidenceRefs": ["events:456"]
  }
}
```

Đổi `status` thành `state` và refs thành `audit:...` khi gọi PostgreSQL. Không có endpoint tạo sự kiện kiểm tra giả; refs phải trỏ vào dữ liệu nguồn đang có.

- `result=passed|failed|inconclusive`, expectedDecision ALLOW hoặc DENY theo nội dung kiểm tra của người điều tra.
- Chỉ passed có bằng chứng độc lập sau lần xảy ra cuối cùng mới đóng được; không dùng timestamp tương lai, sự kiện thực thi hoặc log ghi điều tra thay kết quả kiểm tra.
- Khi đã liên kết hành động, SQLite yêu cầu synced + remote confirmed và kiểm tra diễn ra sau hành động. PostgreSQL không chấp nhận thực thi partial hoặc kiểm tra trước sự kiện thực thi.
- Bằng chứng gốc thiếu/vượt giới hạn hoặc mất bản ghi cần kiểm tra: chưa xác nhận verified. SQLite legacy không có liên kết gốc không được bịa liên kết để đóng.
- False positive cần assessment có mức xác minh và citation; không chỉ một ghi chú. Reopen/review làm kết quả xác minh cũ cần được đánh giá lại. PostgreSQL tự chuyển về reviewing khi cùng sự cố nhận thêm bằng chứng phát hiện mới sau khi đã đóng, có lịch sử system:detector.

Đây là hồ sơ xác minh do người điều tra ghi với đối chiếu tự động các điều kiện dữ liệu. Hệ thống không chứng nhận máy móc rằng mọi nguyên nhân gốc đã được sửa.

## 5. Tương thích và lỗi

- Client SQLite cũ `{status:reviewing,note}` vẫn ghi được lịch sử theo kiểu append; chỉ chuyển open → reviewing hoặc giữ nguyên reviewing. Các cập nhật có cấu trúc phải có version. Client cũ không thể đóng chưa xác minh.
- Client PostgreSQL cũ vẫn đọc và ghi reviewing bằng version/note; đóng resolved/false_positive cần body mới. Web B Đợt 5 cần bổ sung form bằng chứng/verification. Không sửa UI trong Đợt 4 để bỏ qua kiểm tra mới.
- Không đổi các bản ghi cũ đã resolved thành “đã kiểm chứng”; UI phải xem `resolution.verified` và legacy, không suy diễn từ state cũ.
- 400: nội dung/trạng thái/bằng chứng không hợp lệ; 401: xác thực; 403: quyền; 404: không có sự cố/bằng chứng trong phạm vi; 409: version thay đổi hoặc hành động chưa xác nhận; 503: kho lưu trữ, audit bắt buộc hoặc upstream chưa sẵn sàng. Không trả chi tiết lỗi DB/credential.
- Node ghi audit yêu cầu trước khi gửi cập nhật PostgreSQL, PostgreSQL ghi thay đổi + history + operation trong cùng transaction. Không có transaction phân tán giữa hai database: nếu PostgreSQL đã commit nhưng SQLite ghi audit phản hồi lỗi, client có thể nhận 503. Khi đó đọc lại chi tiết/version trước quyết định tiếp theo, không tự retry mutation.
- Dữ liệu outbox đã có không bị viết lại để thêm target. Những sự kiện mới ghi target đã biết; dữ liệu cũ thiếu target không được suy diễn thành hành động trên một tài khoản khác.

## 6. Migration và kiểm thử an toàn

SQLite thêm các cột metadata, bảng evidence/history và marker qua transaction, gọi từ `openStore`. Nâng trigger outbox trong transaction riêng, không sửa payload đã xếp hàng. PostgreSQL thêm cột/bảng/index bằng `IF NOT EXISTS`, giữ nguyên hàng và lịch sử cũ, không backfill actor/thời gian/version suy đoán.

Chưa áp dụng migration lên database đang sử dụng. Khi được phép triển khai sau này, cần backup theo quy trình đang có và nâng Audit schema/service trước Node; capability guard ngăn Node ghi qua dịch vụ Audit cũ.

Chạy lại trên môi trường giả lập:

```text
python -m pip install --only-binary=:all: --target .runtime/phase4-tests/python-libs "psycopg[binary]==3.3.8"
python -B scripts/prepare_phase4_fixture.py --create
python -B scripts/test_phase4.py
python -B scripts/prepare_phase4_fixture.py --stop
```

Yêu cầu image `postgres:17` đã có; helper không pull image, không dùng compose và không gắn volume. Runner xác minh container ID/nhãn/tmpfs/cổng loopback trước khi cho kết nối, không fallback tới lab. Dừng fixture chỉ làm mất dữ liệu giả trong tmpfs của chính fixture đó; giữ nguyên database/volumes hiện có và log kiểm thử trong `.runtime/phase4-tests`.
