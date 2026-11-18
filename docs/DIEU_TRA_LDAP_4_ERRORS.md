# Điều tra LDAP: 0 hồ sơ, 4 errors — 18/11/2026

## Kết luận

**Đã xác định nguyên nhân:** bốn username LDAP đã tồn tại trong SQLite dưới UUID và provider cũ. Keycloak hiện trả UUID khác cho cùng username. `directory.js:apply()` kiểm tra username trùng với ID khác và ném `DIRECTORY_CONFLICT` **trước INSERT, UPDATE hoặc thu hồi phiên**. Catch từng user trong `perform()` trước đây chỉ tăng `errors`, nên cả bốn lỗi bị che nguyên nhân.

Web B báo **0 hồ sơ** vì API đếm/lọc `staff` theo `identity_source='ldap' AND directory_provider_id=<provider hiện tại>`. Cả bốn hồ sơ cũ thuộc provider khác, không phải bốn hàng bị mất hoặc SQL INSERT âm thầm thành công.

- Provider Backend/Keycloak hiện tại: `mx-hhFo8RfSgcLu5PVZZug`.
- Provider lưu trong bốn hồ sơ cũ: `a0BjJX1uTFm2QLpz3xdIxg`.

| Username | UUID SQLite | UUID Keycloak hiện tại |
|---|---|---|
| ldap-employee01 | f82397e1-144d-488b-86f8-20545b00e475 | fede83da-ee3f-4325-853f-78f8aac50b3a |
| ldap-employee02 | bc4edf70-29be-4fc8-9404-dd94ed773b51 | d55f7afb-2a93-4440-bf7a-1afaac35edb9 |
| ldap-manager01 | eb9dbea3-b8e8-4950-a8fe-6e44ebbae33a | 30d30621-95c7-4d2d-bc76-e30aa2c3bbcb |
| ldap-auditor01 | b35519ec-797c-4716-b8b5-344605cf92b9 | bcfec0b5-a485-4f92-a7e8-4427b9706693 |

## Bằng chứng chỉ đọc

Tại 17:24:23 ngày 18/11, chạy các phương thức **GET thực tế của `backend/keycloak-admin.js`**, dùng service account `attendance-control` theo `backend/.env`. Transport chặn mọi ghi Admin API; chỉ POST token OAuth để lấy service token, không gọi syncDirectory/logout hoặc ghi LDAP. SQLite mở readOnly/query_only, không khởi tạo store/app/directory trên DB thật.

Token service và toàn bộ GET provider, users, từng user, groups, direct realm roles, group composite roles đều **HTTP 200**. Service token có các quyền đọc cần thiết (`view-realm`, `view-users`, `query-users`, `query-groups`...) và `manage-users`; không có bằng chứng cần cấp thêm quyền. Không thay realm/client/role/mapper.

Provider enabled, READ_ONLY, NO_CACHE. Danh sách scan đầy đủ gồm 4 user; cả bốn enabled và federationLink đúng provider hiện tại. Mỗi user thuộc đúng một nhóm `/directory/employees`, `/directory/managers` hoặc `/directory/auditors`, có đúng application role kế thừa; không có application role trực tiếp. Team/name hợp lệ, `nhip.directory.status=active`, `nhip.mfa.required=true`. Không đọc credential hoặc thử đăng nhập LDAP.

Các job gần nhất lưu `remote.updated=4`, `remote.failed=0`, `complete=true`, nhưng `imported=0`, `updated=0`, `error_count=4`, state=partial. Điều này phù hợp: Keycloak sync thành công, còn bước liên kết hồ sơ local bị guard chặn.

SQLite integrity/FK PASS; `staff.id` và `staff.username` có UNIQUE indexes. Có 6 FK trực tiếp tới staff; ngoài FK còn history tham chiếu ID cũ. Đếm theo ID cũ: employee01 có 56 events, 5 alerts, 7 notifications, 16 identity_events, 78 outbox chứa ID; auditor01 có 14 events, 1 alert, 1 notification, 3 identity_events, 17 outbox; employee02/manager01 mỗi người có 1 notification. Các số đếm outbox có thể chồng nguồn khác, không cộng thành số event duy nhất. Hồ sơ LDAP QA disabled thứ năm thuộc provider cũ được giữ nguyên.

Artifacts: `.runtime/ldap-diagnostics/20261118T102423Z/service-readonly.json` và `local-relations.json`. Đây là bằng chứng đọc live hiện tại; không suy nguyên nhân từ trạng thái disabled/role rỗng ngày 12/11 vì các trạng thái đó đã được người vận hành sửa.

## Thay đổi mã tối thiểu

- `backend/directory.js`: thêm `directoryReason=USERNAME_COLLISION` vào exception tại guard đã tồn tại, giữ nguyên code/status/hành vi chặn; thêm log vào **đúng catch quanh `apply(u.id,true)` trong vòng `listed.users`**.
- Không sửa catch thứ hai dành cho lỗi revoke hồ sơ missing; không gán nhầm lỗi revoke thành lỗi import.
- Log chỉ có event cố định `DIRECTORY_USER_SYNC_FAILED`, jobId do server sinh, userRef là 16 ký tự SHA-256 của ID, code trong allowlist, reason allowlist, status số 400–599. Không ghi username, UUID gốc, tên/email/team, exception message/stack, response body, token, password hoặc secret.
- Nếu log sink lỗi, job vẫn tiếp tục và giữ số errors; không làm lỗi thành PASS. Không thay thuật toán sync, ràng buộc UNIQUE/FK hoặc tự ghép theo username.
- Thêm `backend/directory-errors.test.js` dùng dữ liệu tổng hợp/in-memory; không dùng DB đang vận hành làm fixture.
- `backend/keycloak-admin.js` và `backend/directory-schedule.js` được rà soát, **không sửa**.

Backup trước sửa: `.local/source-backups/ldap-sync-20261118T102516Z/`, có manifest SHA-256 cho directory.js và PROJECT_CONTEXT.md. directory.js trước sửa: `2496d924a617935b9d6a7c800e95a4f44fc8e8a9461f4f98bcdafc7953a0c021`. File người vận hành `backend/directory.js.before-error-log` vẫn giữ nguyên và có cùng hash.

## Kiểm thử

Syntax check directory.js/keycloak-admin.js/directory-schedule.js/test mới và `git diff --check`: PASS.

**115/115 test PASS** qua isolation preloader, DB in-memory/fixture và IAM giả lập:

| File | PASS |
|---|---:|
| directory-errors.test.js | 8 |
| directory-schedule.test.js | 3 |
| week5-10.test.js | 33 |
| sso.test.js | 19 |
| security.test.js | 52 |

Tái hiện đúng bốn UUID/provider cũ → 0 profile theo provider hiện tại + 4 lỗi; mọi hồ sơ cũ/history/outbox giữ nguyên. Fixture không có xung đột nhập đủ 4 user với MFA bắt buộc. Kiểm thử cả tiếp tục sau một lỗi, HTTP read denial, lỗi DB/rollback, log không lộ exception, log sink lỗi, nhánh revoke riêng và các endpoint đọc group/direct roles của adapter thật với HTTP giả lập. Kết quả/log tại `.runtime/ldap-diagnostics/20261118T102423Z/tests.json` và các file `.test.js.log` cùng thư mục.

## Phạm vi chưa thực hiện và bước tiếp theo

**Chưa restart dịch vụ, chưa sync thủ công, chưa thay đổi dữ liệu thật/UUID/provider/LDAP/Keycloak hoặc audit.** Log mới ở source chưa được nạp vào tiến trình Backend đang chạy. Các job định kỳ có sẵn có thể tiếp tục ghi theo cấu hình người vận hành; agent không tự bật/tắt hay kích hoạt chúng.

Không thể sửa xung đột danh tính bằng cách chỉ cấp thêm quyền, bỏ UNIQUE, bỏ guard, đổi riêng provider, hoặc hiển thị hồ sơ provider cũ như đã đồng bộ. Hai ID khác nhau không mặc nhiên là cùng danh tính chỉ vì trùng username. Trong ràng buộc hiện tại **không đổi UUID**, nguyên nhân dữ liệu chưa được sửa; trạng thái sync thật vẫn cần xử lý riêng.

Muốn xử lý tiếp cần phương án đối soát danh tính LDAP gốc (entryUUID, provider lịch sử và bằng chứng liên quan), quan hệ nghiệp vụ/lịch sử và phạm vi thay đổi được phê duyệt riêng. Không áp dụng migration local demo/MFA cho LDAP. Restart để nạp log và mọi sync hoặc thao tác sửa dữ liệu thật đều cần người vận hành cho phép trước. Không cần chạy setup_week3/5/6 hoặc reset bất kỳ kho dữ liệu nào.
