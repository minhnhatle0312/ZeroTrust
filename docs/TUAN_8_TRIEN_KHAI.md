# Tuần 8 — Centralized Audit & Security Monitoring

## Note kiểm thử bổ sung — 08/11/2026

Audit PostgreSQL nhận sự kiện thật và fixture; batch replay chống trùng, correlation/phân trang, allowlist loại trường nhạy cảm; backup/restore Audit đã chạy.

Chi tiết: [kết quả thực tế](KET_QUA_KIEM_THU_2026_11_08.md). Các đoạn “chưa kiểm thử” bên dưới là ghi chép tại thời điểm triển khai source trước đây.


Ngày ghi note: 06/11/2026. **Đã bổ sung mã nguồn, chưa cài dependency mới, build, khởi chạy, áp dụng migration hoặc kiểm thử.** Ghi note tuần 8 trước khi chuyển sang tuần 9 theo yêu cầu. Không đánh dấu mốc nghiệm thu.

## Nội dung đã làm

- Kho `audit-db` PostgreSQL 17 riêng; không đọc/ghi DB nội bộ Keycloak. Audit API Python/psycopg chỉ mở cổng loopback 8090, xác thực bằng token máy chủ. Token không được đưa vào frontend.
- Migration SQLite bổ sung outbox, trạng thái gửi và UUID nguồn ổn định. Trigger cùng transaction ghi sự kiện API/Keycloak vào outbox; lần khởi động đầu lấy bù dữ liệu SQLite còn tồn tại. Dữ liệu cũ đã xóa trước tuần 8 không khôi phục tự động.
- Collector độc lập cho Keycloak Events/Admin Events; lưu trang/checkpoint, cửa sổ thời gian cố định, overlap, retry tăng dần. PostgreSQL có khóa duy nhất `event_id`, chỉ xác nhận gửi sau commit; mất phản hồi sẽ gửi lại cùng ID.
- Chuẩn hóa thời điểm, nguồn, actor/client, session hash, request ID, hành động, resource, decision, HTTP status, IP. API Web A/Web B phân biệt bằng `azp`. Session được băm theo cùng quy tắc để liên kết; dữ liệu cũ thiếu session không được suy diễn.
- Allowlist trường; không nhập representation của Admin Events, request body, mật khẩu, token, OTP hay header. Keycloak admin actor là service account khi backend thực thi; đối chiếu sự kiện ứng dụng để xác định người yêu cầu, không giả định hai actor giống nhau.
- Web B: tổng quan ALLOW/DENY, top login failures, nguồn sự kiện; bộ lọc thời gian/nguồn/kết quả/user; phân trang; CSV tối đa 5.000 dòng/lượt có thông báo thiếu; chi tiết và tối đa 100 bản ghi cùng request/session.
- Luật cảnh báo login failures, DENY burst, truy cập vượt quyền và phiên thu hồi. Incident có trạng thái, version chống ghi đè, lịch sử nhận xét; admin xử lý, auditor chỉ đọc. Không tự khóa tài khoản theo cảnh báo.
- Retention mặc định 0; cấu hình không tự xóa. Admin xem trước và nhập xác nhận riêng khi dọn; giữ sự kiện của incident chưa đóng. Outbox SQLite hiện được giữ nguyên, cần theo dõi dung lượng.
- Health riêng cho PostgreSQL, hàng đợi, hai collector, gap cần đối chiếu; trang LDAP hiện có hiển thị chi tiết sức khỏe federation.

## API bổ sung

Tiền tố `/api/security/central`, qua xác thực/role hiện có:

| Method/path | Quyền | Nội dung |
| --- | --- | --- |
| GET `/health` | admin, auditor | Kết nối, backlog, retry/checkpoint, gap |
| GET `/events`, `/events/:id` | admin, auditor | Lọc, phân trang, chi tiết, correlation |
| GET `/summary` | admin, auditor | Ngày, nguồn, login failures |
| GET `/incidents`, `/incidents/:id` | admin, auditor | Danh sách, lịch sử |
| GET `/operations` | admin, auditor | 100 thao tác Audit Service gần nhất |
| POST `/incidents/:id` | admin | Kết luận + version + note |
| POST `/settings` | admin | Retention/ngưỡng luật |
| POST `/retention` | admin | Preview; apply cần chuỗi xác nhận |
| POST `/retry` | admin | Gửi lại hàng đợi |
| POST `/backfill` | admin | Đặt lại checkpoint trong retention nguồn; source/from/note |

`/backfill` không xóa bản ghi PostgreSQL và không vượt thời gian lưu của nguồn. Nếu collector đang chạy thì trả conflict; operator thử lại sau. Mặc định mỗi lượt tối đa 10 trang × 200 sự kiện.

## Khi được phép triển khai

1. Sao lưu cấu hình và dữ liệu hiện có theo tuần 6, bao gồm WAL SQLite đúng cách. Chưa chạy các lệnh dưới đây trong phiên lập trình này.
2. `python scripts/prepare_week8.py` tạo credential trong thư mục bị gitignore, giữ bản cấu hình backend trước cập nhật. Giới hạn ACL của thư mục `.local` cho tài khoản vận hành; không gửi file này lên Git.
3. Chạy overlay cùng Compose gốc:

```powershell
docker compose --env-file .env --env-file audit/.local/compose.env -f docker-compose.yml -f directory/compose.week6.yml -f audit/compose.week8.yml up -d --build
```

Bỏ overlay directory nếu chưa cấu hình tuần 6. Audit schema được tạo bổ sung khi service khởi động. Không đổi mật khẩu DB đã khởi tạo chỉ bằng sửa `.env`.

4. Keycloak cần bật user/admin events, `adminEventsDetailsEnabled=false`, và service account có quyền đọc events theo cấu hình hiện tại. Không tự cấp realm-admin để giải quyết lỗi quyền.
5. Khởi động backend/Web A/Web B bằng runner tuần 7 hoặc runner bàn giao tuần 10 sau khi cấu hình. Vào Web B → **Audit PostgreSQL**.

## Giới hạn cần lưu trong báo cáo

- Chưa có số liệu chứng minh không mất/trùng log. API Keycloak phân trang theo offset; sự kiện trễ hơn overlap hoặc biến động nguồn vẫn cần đối chiếu. Không bảo đảm exactly-once end-to-end.
- Hash dự phòng Admin Events không có ID có thể gộp hai thao tác hoàn toàn giống nhau cùng millisecond; cần lưu ý khi đối chiếu nguồn.
- HTTP nội bộ chỉ chấp nhận loopback; nếu tách máy cần HTTPS cho đường backend → Audit Service. PostgreSQL không publish cổng host.
- Audit nằm trên PostgreSQL riêng nhưng tài khoản DB hiện là chủ DB lab, chưa tách vai trò migration/runtime. Python HTTP server là cấu hình lab, không tuyên bố chịu tải Internet.
- Audit đọc có giới hạn ngày/số dòng. Outbox giữ lại cả bản ghi đã gửi; không tự xóa để tránh làm mất khả năng replay sau restore.
- Rule burst dùng dữ liệu đã tới kho tại thời điểm nhập, có thể bỏ sót cửa sổ khi dữ liệu tới sai thứ tự; tuần 9 bổ sung phân tích theo event-time.
- Số đo/ảnh minh chứng tuần 8: **chưa có**, không dùng số liệu lịch sử tuần trước làm kết quả mới.

## Checklist chờ kiểm thử

Tất cả **Chưa chạy**: login/ALLOW/DENY/role change xuất hiện PostgreSQL; replay idempotent; crash trước/sau ACK; hơn 200/2.000 events; backfill; mất PostgreSQL/Keycloak; role auditor/employee; version conflict; CSV formula escaping; session correlation; giữ incident đang mở khi retention; secret filtering; restore và replay.

Tham chiếu kỹ thuật: [Psycopg transactions](https://www.psycopg.org/psycopg3/docs/basic/usage.html), [PostgreSQL INSERT/ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html), [Keycloak 26.8 Admin REST API](https://www.keycloak.org/docs-api/26.8.0/rest-api/index.html).
