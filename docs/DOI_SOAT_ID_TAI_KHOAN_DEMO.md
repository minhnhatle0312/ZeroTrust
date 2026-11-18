# Đối soát ID năm tài khoản local

## Phạm vi và trạng thái

Ngày 11/11/2026: đã tạo `scripts/reconcile_staff_ids.py`, chạy dry-run trên Keycloak/SQLite thật và kiểm thử apply **chỉ trên fixture cô lập**. **Chưa apply thật, chưa tạo backup dữ liệu thật cho đợt đồng bộ này.** Chờ người dùng xác nhận. Không chạy các script fix-admin cũ; `admin01` đã đúng và phải giữ nguyên.

Script chỉ chấp nhận employee01/employee02 (employee), manager01/manager02 (manager), auditor01 (auditor). `admin01` là đối chứng bắt buộc khớp; nếu không khớp thì dừng toàn bộ. Username phải duy nhất kể cả khác hoa/thường, đúng chính tả trong cả ba nguồn; role local/seed và effective application role Keycloak phải khớp. Hồ sơ phải local, active; chặn federationLink, thuộc tính LDAP, provider/directory không local, ID đích đã có chủ và ID cũ vẫn tồn tại trong Keycloak. Không suy danh tính từ email/tên hiển thị và không nhập LDAP.

Admin API chỉ GET user/role mappings; POST chỉ dùng để lấy/refresh token, tái sử dụng class Api đã sửa 401. Không gọi endpoint ghi Keycloak, credential, role, MFA, JWT hoặc LDAP. Không gọi profile thật để làm test, vì API này ghi audit. Không xuất token, mật khẩu, cookie hoặc raw response.

## Kết quả dry-run thật

Plan có ánh xạ đầy đủ, số đếm theo cột, danh sách toàn bộ FK và dấu vân tay database/seed: `.local/staff-id-plans/review-v2-20261111.json`. ID là định danh, không phải credential.

| Username | ID SQLite/seed cũ | ID Keycloak mới |
|---|---|---|
| employee01 | ce8e25cd-5b4f-414a-bd65-3e844d45bcbe | ae994298-31c2-4c6d-8f0d-b8501eb4ae3d |
| employee02 | 57117b82-a02e-42df-8705-11306bbb0202 | 1f853e1c-acb2-4f1c-ba9d-0b88af6d440a |
| manager01 | 3242fc36-8a3d-4ed2-ab8e-d4f4d425a57b | 29fb3942-613b-4969-a0af-ef8c13ad8d70 |
| manager02 | 0c9bfc83-8cb2-4fa1-817b-585709abca98 | f8a4e2a0-fc2a-4926-a2c1-9441863adda9 |
| auditor01 | 46f964e9-cd43-4369-b2b7-69c6f402f94d | 26845b22-43b3-4281-94fd-01fb1c04b23e |

| Bảng/cột sẽ chuyển ID | Số hàng hiện có bị ảnh hưởng |
|---|---:|
| staff.id | 5 |
| attendance.user_id | 10 (employee01: 3; employee02: 7) |
| corrections.user_id | 10 (employee01: 2; employee02: 8) |
| corrections.reviewer_id | 2 (manager01); nằm trong 10 đơn trên |
| notifications.user_id | 16 (employee02: 11; manager02: 5) |
| notification_reads.user_id | 0 |
| access_requests.user_id/reviewer_id | 0 |
| lifecycle_workflows.target_id/creator_id/reviewer_id | 0 |
| directory_maintenance.user_id | 0; nếu có hồ sơ local thuộc maintenance thì dừng |

Tổng 41 hàng nghiệp vụ riêng biệt sẽ đổi liên kết ID; thêm 5 hàng vào `staff_id_reconciliations`, sửa đúng 5 giá trị ID trong `staff.json`. Không cộng số liên kết reviewer như hai đơn bổ sung. Script kiểm tra 11 FK đang có, tất cả cột trong mọi bảng và cả chuỗi chứa ID (JSON/đường dẫn). Schema/constraint/tham chiếu chưa được phân loại hoặc trigger trên bảng sẽ ghi đều làm script dừng; không tự UPDATE theo tên cột phỏng đoán.

Giữ nguyên các hàng gắn ID cũ: 519 `events` theo actor, 66 `identity_events`, 27 `alerts`, 17 `actions` theo target và 636 `audit_outbox` payload. Một hàng có thể chứa ID ở nhiều cột nên không cộng các số đếm cột thành số sự kiện. Giữ nguyên cả `action_attempts`, `alert_evidence`, `alert_history`, `lifecycle_history`, `access_reviews`, `access_review_items`, `directory_sync_jobs` và JSON snapshot. Những bảng này không bị viết lại dù có tham chiếu ID cũ.

## Bảo toàn lịch sử và bảo mật

`staff_id_reconciliations` lưu ID cũ/mới, username, role, thời điểm, batch và lý do. Các truy vấn hiển thị hồ sơ quản trị, hành động bảo mật, báo cáo audit cá nhân, người tạo/người thực hiện trong lịch sử và lần LOGIN gần nhất đọc bảng này để nối với hồ sơ hiện hành. Bản ghi trả về vẫn mang ID lịch sử gốc. Module `backend/historical-identity.js` chỉ dùng cho truy vấn đọc/báo cáo.

Middleware vẫn tra `JWT.sub = staff.id`; không có fallback username hay alias xác thực. Không dùng bảng đối soát để chọn đích ghi Keycloak hoặc bỏ `UNREGISTERED`. Bằng chứng sự cố, actionRefs và điều kiện xác minh vẫn dùng định danh gốc. Sự cố của principal cũ không tự biến thành sự cố của principal mới; không tự retry hành động cũ hoặc liên kết một hành động của ID mới vào bằng chứng ID cũ.

Apply chặn security action chưa kết thúc, lifecycle workflow đang xử lý và directory sync đang chạy. Các thuộc tính role, disabled, revoked_before, MFA, team, trạng thái quyền và dữ liệu nghiệp vụ giữ nguyên. Trong transaction, script so sánh toàn bộ hàng trước/sau theo phép biến đổi ID được cho phép; tất cả bảng lịch sử phải giống nguyên trạng. Không xóa hoặc tạo lại hồ sơ để né ràng buộc.

## Quy trình apply — chỉ sau xác nhận của người dùng

1. Dừng Backend và mọi tiến trình ghi SQLite, collector hoặc công cụ quản trị đang dùng file này. Giữ Keycloak hoạt động. Không dừng bằng reset database, không chạy setup. Script kiểm tra cổng Backend cấu hình và cần xác nhận `--backend-stopped`; không tự kill process. Nếu process có environment override khác file `.env`, phải xác minh đúng đường dẫn/port trước.
2. Tại `D:\ZeroTrust`, tạo **plan mới sau khi đã dừng các writer** và kiểm tra số đếm. Ví dụ tên file chưa tồn tại:

```powershell
python -B scripts/reconcile_staff_ids.py --plan .local/staff-id-plans/ready-20261111.json
```

3. Sau khi người dùng đã xác nhận apply và plan mới vẫn phù hợp, lệnh chính xác:

```powershell
python -B scripts/reconcile_staff_ids.py --apply --backend-stopped --plan .local/staff-id-plans/ready-20261111.json
```

Script đối chiếu lại Keycloak, schema, mọi hàng database, seed và đường dẫn với plan; thay đổi nào cũng làm dừng trước ghi. Trong lần kiểm tra hiện tại, hash DB đã thay đổi sau dry-run khi hệ thống vẫn đang chạy; plan khảo sát không thay thế plan mới lúc bảo trì. Không sửa hash/plan bằng tay để vượt kiểm tra. Nếu file plan đã tồn tại, dùng tên mới; script không ghi đè.

Backup thật được tạo **trước UPDATE đầu tiên**, trong thư mục mới duy nhất:

```text
D:\ZeroTrust\.local\staff-id-backups\<UTC>-<random>\attendance.sqlite
D:\ZeroTrust\.local\staff-id-backups\<UTC>-<random>\staff.json
D:\ZeroTrust\.local\staff-id-backups\<UTC>-<random>\plan.json
```

SQLite backup dùng online backup API từ snapshot đã khóa writer, bao gồm dữ liệu WAL đã commit; không copy riêng file `.sqlite` đang hoạt động. Kiểm tra hash, integrity và FK của bản sao trước khi tiếp tục. Seed được sao lưu byte nguyên bản. Backup chứa dữ liệu nghiệp vụ: giữ trong máy, không đưa vào Git/báo cáo công khai. Các backup Keycloak trước đây không bị đụng tới.

Apply dùng `BEGIN IMMEDIATE`, `foreign_keys=ON`, defer kiểm tra FK tới cuối transaction; không tắt FK. Sau UPDATE kiểm tra lại integrity/FK, toàn bộ dữ liệu và ledger, thay seed bằng atomic rename rồi commit. Lỗi trước commit rollback SQLite và phục hồi seed nguyên bản; backup không bị xóa.

SQLite và JSON không có một transaction filesystem chung. Marker `backend/data/staff.json.reconcile-pending.json` ghi bền trước thay seed giúp xử lý mất điện/kill process. Nếu lỗi để lại marker, **giữ Backend dừng**, không xóa marker hoặc backup bằng tay. Lệnh phục hồi chỉ dùng sau khi kiểm tra trạng thái gián đoạn:

```powershell
python -B scripts/reconcile_staff_ids.py --recover --backend-stopped
```

Recovery không restore/ghi lại database: SQLite tự xử lý transaction bị gián đoạn; script chỉ đưa seed về trạng thái tương ứng với hash DB trước hoặc sau commit. Nếu DB/seed đã thay đổi ngoài hai trạng thái này, script dừng để điều tra thủ công. Không tự restore toàn bộ DB đang vận hành vì có thể mất dữ liệu phát sinh sau backup. Sau khi commit thành công, chạy apply lại với plan mới không có chênh lệch sẽ không ghi gì.

4. Trước khi khởi động lại Backend, chạy lại dry-run: phải `Changes: 0`, admin01 vẫn khớp và không có lỗi integrity/FK. Sau đó vận hành Backend theo hướng dẫn khởi động hiện có để nạp các truy vấn lịch sử mới. Không cần thay cấu hình Web/Keycloak.
5. Đăng nhập mới từng tài khoản qua Keycloak; kiểm tra `/api/profile` HTTP 200, đúng username/role. Employee/manager kiểm tra Web A, bảng công, đơn và thông báo; admin/auditor kiểm tra Web B và lịch sử. Employee/manager vẫn phải bị từ chối Web B. Kiểm tra MFA/SSO/logout riêng; không coi fixture là bằng chứng browser thật đã đạt.

## Kiểm thử

```powershell
python -B -m unittest discover -s tests -p test_staff_id_reconciliation.py -v
```

25 test mới: dry-run không ghi; bảng/FK đầy đủ; backup khớp nguyên bản; admin và toàn bộ lịch sử giữ nguyên; idempotence; local/LDAP/role/duplicate/collision; ID cũ còn tồn tại; FK hỏng; schema/tham chiếu mới; trigger; action/workflow chưa xong; plan lỗi thời; Backend còn chạy; lỗi file/verify; rollback sau thay seed; recovery trước/sau commit và từ chối dữ liệu phát sinh ngoài marker.

Test Backend con dùng schema thật, SQLite fixture, JWT RS256 ký/xác minh thật, HTTP Express trên cổng loopback tạm; Keycloak/session được giả lập. Đối chứng trước apply: admin01 200, năm tài khoản 403 UNREGISTERED. Sau apply fixture: cả sáu 200, đúng ID/role, vẫn gọi kiểm tra account/session. ID cũ/ID lạ không được đăng nhập; role/audience sai, session kết thúc, employee vào Web B đều bị từ chối. Các liên kết nghiệp vụ và truy vấn lịch sử cũ vẫn đọc được.

Hồi quy liên quan: 169 test Backend (audit/security/SSO/operations/governance/incidents/retention), 50 test repair client và 7 test OIDC đạt. Không thay cơ chế refresh token. Artifacts synthetic nằm dưới `.runtime/staff-id-tests/`; không dùng bản sao database thật làm fixture. Trên sandbox Windows, test tạo thư mục UUID kế thừa ACL và dùng `--test-isolation=none` với preloader cô lập để tránh lỗi quyền spawn/thư mục tạm; không nới quyền truy cập dữ liệu thật.
