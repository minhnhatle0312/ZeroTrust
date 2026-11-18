# Đối soát chỉ đọc MFA và hồ sơ ngoài sáu demo — 12/11/2026

**Kết luận:** có **hai** hồ sơ local active chặn bootstrap: `mfa-employee` và `mfa-auditor`. SQLite giữ ID cũ của tài khoản MFA tạo ngày 07/11; Keycloak hiện có tài khoản cùng username nhưng ID mới, được tạo ngày 11/11. Sáu demo đã migration vẫn khớp; không chạy lại migration đó và không rollback.

Đối chiếu 25 hồ sơ staff với Keycloak từ 18:43:55 đến 18:46:05, không có lỗi truy vấn tài khoản. Chỉ GET user/role, ngoài trao đổi token quản trị phục vụ đọc; không sửa IAM. SQLite mode=ro/query_only, không mở Backend. Chỉ ghi tài liệu và artifact đã lọc; không ghi password/token/OTP secret, raw response hoặc raw audit payload.

## 1. Hai hồ sơ MFA

| Hồ sơ | UUID SQLite | UUID Keycloak hiện tại | Role hai phía |
|---|---|---|---|
| mfa-employee | `431df574-7925-469e-92f1-1377853a78b2` | `fa4c264c-794b-4440-bbb1-b4f505e39622` | employee |
| mfa-auditor | `7c795907-4fc0-440f-885e-fe61c25a1ca1` | `a0baf693-07f0-418e-ba1f-177892305e87` | auditor |

Đã kiểm tra cho cả hai:

- Username khớp chính xác, duy nhất ở SQLite và kết quả lookup Keycloak; role ứng dụng hiệu lực khớp. Local `disabled=0`, `governance_state=active`, `identity_source=local`, không directory provider; remote enabled=true, không federation/service account/LDAP attribute.
- Local `mfa_required=1`, remote `nhip.mfa.required=[true]`. Remote trả `requiredActions=[CONFIGURE_TOTP]`, `totp=false`. Đây là trạng thái API; chưa nghiệm thu đăng ký OTP hoặc đăng nhập thật, không đọc credential/QR/OTP secret.
- Local `revoked_before=1794105314`, `security_updated_at=2026-11-08T02:35:14.339287+00:00`. Các giá trị này phải giữ nguyên nếu đổi ID; không kéo lùi revocation hoặc tắt MFA.
- Local có tên “Tài khoản MFA employee/auditor”, team “Kiểm thử MFA”. **Không có cả hai trong staff.json**; seed chỉ gồm sáu demo đúng ID sau migration.
- GET theo hai ID cũ trả 404. Hai ID remote mới chưa được hồ sơ staff nào khác sử dụng; chưa có ledger cho hai MFA. Không có xung đột target ID tại thời điểm kiểm tra.

## 2. Nguồn gốc và nguyên nhân

`scripts/setup_week5.py:19` khai báo riêng hai demo này; đoạn 160–190 tạo user khi chưa có, gán role, yêu cầu MFA. Đoạn 196–211 đăng ký trực tiếp vào SQLite, không thêm vào staff.json. `docs/TUAN_5_TRIEN_KHAI.md:99` mô tả mục đích demo MFA, tách khỏi sáu tài khoản ban đầu. Đây là tài khoản phục vụ cấu hình/nghiệm thu MFA, không phải hồ sơ nhân viên phát sinh từ luồng nghiệp vụ thông thường; cũng không phải fixture test cô lập tự được nạp bởi Backend.

Bằng chứng lịch sử đã đọc và lọc:

| Thời điểm Việt Nam | Bằng chứng |
|---|---|
| 07/11 09:07:56 | Audit outbox ghi CREATE USER cho hai ID cũ, sau đó role mapping/UPDATE/ACTION. Backup `week5-20261107T020753060327Z/applied-week5.json` ghi setup hai MFA hoàn tất; snapshot trước setup chưa có hai user. |
| 08/11 09:35:14 | Backup `week5-20261108T023512637918Z/keycloak-config.json` chứa ID cũ khớp SQLite; localSecurity và applied-week5 xác nhận hai tài khoản được cấu hình MFA. Audit có UPDATE/ACTION cùng thời điểm. |
| 11/11 19:43:56–57 | createdTimestamp của user hiện tại và audit CREATE USER xác nhận hai ID mới được tạo. ID cũ hiện trả 404; SQLite vẫn giữ ID cũ và trạng thái security cập nhật ngày 08/11. |

**Nguyên nhân trực tiếp được xác minh:** đối tượng user ở Keycloak đã có ID mới nhưng hồ sơ local vẫn mang ID cũ. Lỗi không do migration năm demo: hash DB/seed hiện tại bằng trạng thái hậu kiểm migration, hai hồ sơ ngoài scope được giữ nguyên.

**Lỗ hổng trong quy trình setup có thể duy trì lỗi:** `staff.username` có UNIQUE (`backend/store.js:11`); `setup_week5.py:207` dùng `INSERT OR IGNORE` với ID hiện tại, sau đó UPDATE theo ID hiện tại. Nếu cùng username đã có với ID cũ, INSERT bị bỏ qua và UPDATE không trúng hàng. Script không đối soát hoặc dừng rõ ràng khi ID lệch. Chạy lại setup không phải cách sửa an toàn và còn thay flow/policy/MFA.

Không kết luận chính xác ai đã xóa/tạo lại user hoặc lần setup 11/11 có chạy đến bước SQLite hay dừng trước đó: chưa có bằng chứng đầy đủ về thao tác xóa, và bốn backup `week5-20261111T123836354435Z`, `...123956529287Z`, `...124351977825Z`, `...124422051337Z` bị PermissionError. Audit chứng minh các lần CREATE, không tự chứng minh toàn bộ chuỗi reset/restore/setup. Không hạ quyền hoặc đọc raw credential trong backup để vượt giới hạn này.

## 3. Dữ liệu liên quan hai MFA

Đã quét tất cả bảng/cột SQLite theo **ID cũ, ID mới và username**, gồm các chuỗi JSON/path, không chỉ khóa ngoại khai báo. Sau migration trước có 12 FK tổng cộng, 6 FK trực tiếp đến staff.id: attendance.user_id, corrections.user_id, notification_reads.user_id, access_requests.user_id, directory_maintenance.user_id, staff_id_reconciliations.new_id. Các liên kết không có FK như reviewer/actor/target và JSON cũng được quét.

| Bảng/nhóm | mfa-employee | mfa-auditor |
|---|---:|---:|
| staff | 1 | 1 |
| attendance / corrections | 0 / 0 | 0 / 0 |
| notifications / notification_reads | 0 / 0 | 0 / 0 |
| access_requests / lifecycle_workflows / directory_maintenance | 0 | 0 |
| events / identity_events / actions / alerts và các bảng lịch sử còn lại | 0 | 0 |
| staff_id_reconciliations | 0 | 0 |
| audit_outbox | **10** | **10** |

Mỗi tài khoản có 6 outbox payload chứa ID cũ và 4 chứa ID mới. Tổng **20 bản ghi**, gồm **12 đã có delivered_at**, **8 chưa có delivered_at**. Không sửa payload/ID lịch sử, không xóa hay gửi lại các bản ghi đã giao. Không truy vấn PostgreSQL Audit trong lượt này; delivered_at chỉ là trạng thái local, không phải bằng chứng đã kiểm tra lại bản sao trung tâm. Ledger bổ sung nên ghi nhận quan hệ cũ–mới để giải thích lịch sử, không biến ID cũ thành alias xác thực.

Nếu migration bổ sung được duyệt và dữ liệu vẫn như lúc khảo sát: dự kiến **đổi 2 hàng staff, thêm 2 hàng ledger**; **không đổi staff.json** hoặc 20 outbox payload. Đây là đánh giá phạm vi, chưa phải plan apply; phải quét lại nếu dữ liệu thay đổi.

## 4. Những hồ sơ khác ngoài sáu demo

Đối chiếu toàn bộ **25 staff hiện có**, không phải danh sách mọi user trong realm:

| Nhóm | Số lượng | Kết quả | Bootstrap hiện tại |
|---|---:|---|---|
| Sáu demo đã đồng bộ | 6 | ID/username/role khớp | Đạt |
| Hai MFA local active | 2 | ID lệch; username/role/status phù hợp | **Chặn** |
| LDAP active ở local | 4 | ID lệch; remote disabled, không có role ứng dụng | Không nằm trong filter local |
| Hồ sơ local disabled | 12 | Không tìm thấy username và ID cũ ở Keycloak | Không nằm trong filter active |
| Hồ sơ LDAP disabled/left | 1 | Không tìm thấy username và ID cũ ở Keycloak | Không nằm trong filter local |

Bốn LDAP lệch: `ldap-employee01`, `ldap-employee02`, `ldap-manager01`, `ldap-auditor01`. Cả bốn có federation/LDAP attribute ở remote; local lại active với role tương ứng và `mfa_required=1`. **Không ghép danh tính LDAP bằng username và không đưa vào migration local MFA.** Cần khảo sát riêng provider, LDAP identifier bất biến, group/role mapping, disable/hold state và các quan hệ nghiệp vụ trước khi quyết định sửa federation/config hay dữ liệu local. Việc hai MFA được sửa không đồng nghĩa LDAP đã nghiệm thu.

13 hồ sơ missing đều disabled local: 4 `qa-jcl-*`, 8 `uiops-*`, 1 `ldap-qa-jcl-*` (tên đầy đủ trong artifact). Không gọi chúng là “UUID lệch” vì không có đối tượng remote tương ứng để so; không tự khôi phục hoặc bật lại hồ sơ đã nghỉ/vô hiệu hóa. Không có lookup ambiguous hoặc lỗi truy vấn trong 25 hồ sơ.

## 5. Vì sao một hồ sơ chặn cả Backend

`backend/bootstrap.js:57` chọn **mọi local active chưa disabled** khi DB đã có dữ liệu, không chỉ seed sáu demo. Hiện có 8 ứng viên; hai MFA đều lệch. Vòng kiểm tra ném lỗi ngay ở đối tượng đầu tiên sai ID/username/federation. `mfa-employee` đứng trước `mfa-auditor` theo thứ tự ID nên thông báo ban đầu chỉ nêu lỗi đầu tiên.

`backend/server.js` đợi preflight trước openVerifiedStore/migration/collector/listen; exception chặn toàn bộ startup. Đây là cơ chế dừng khi danh tính chưa xác minh, không phải hỏng integrity/FK. Nếu chỉ sửa mfa-employee, mfa-auditor vẫn chặn lần sau. Middleware API vẫn dùng JWT sub để tìm staff.id (`backend/app.js:45`); bỏ bootstrap hoặc fallback username không sửa được quan hệ danh tính một cách an toàn.

## 6. Phương án đề xuất — chưa thực hiện

**Ưu tiên migration bổ sung có phạm vi riêng cho đúng hai MFA local**, sau khi người vận hành phê duyệt liên kết hai thế hệ account demo này. Không chỉ sửa cấu hình/seed:

1. Lập plan riêng mfa-employee/mfa-auditor: xác minh exact username/role/source/enabled, old ID không còn, target ID chưa chiếm, MFA/revocation không bị giảm, không có ledger chain/conflict hoặc tham chiếu chưa phân loại. Không mở rộng hoặc chạy lại plan năm demo đã hoàn thành.
2. Tái kiểm kê writer và dữ liệu, backup SQLite nhất quán + seed/plan/manifest đã kiểm thử, transaction và điều kiện rollback. Tái sử dụng thành phần backup/manifest/verification phù hợp, không chạy lại setup. Script năm demo hiện có cố ý hard-code sáu seed; không thể chỉ truyền hai tên MFA để dùng nguyên trạng.
3. Chỉ đổi 2 staff.id và các liên kết nghiệp vụ nếu phát sinh trong plan mới; giữ nguyên role, MFA, revoked_before, security timestamps, trạng thái, tên/team và mọi cột khác. Thêm 2 ledger. Giữ nguyên 20 outbox và mọi lịch sử; không đụng Keycloak/password/OTP/LDAP hoặc seed sáu demo.
4. Kiểm thử riêng backup/rollback/không ghi khi mismatch, 8 local active được Backend nhận diện đúng, old sub bị từ chối và MFA vẫn bắt buộc. Hậu kiểm từng hàng rồi bootstrap check-only; chỉ start Backend khi đạt và được phép. OTP hiện còn required action cần người vận hành hoàn tất qua Keycloak khi nghiệm thu, không reset/bỏ MFA.
5. Sửa ngăn tái phát trong setup MFA theo thay đổi source riêng: khi existing username/ID không khớp phải dừng trước mọi cấu hình IAM; không im lặng INSERT OR IGNORE. Chưa sửa source ở lượt chỉ đọc này.

Nếu muốn bỏ hẳn demo MFA, phương án khác là retire/disable local theo quy trình có duyệt, giữ lịch sử; phương án đó làm thay đổi phạm vi nghiệm thu MFA nên không ưu tiên. Không xóa/recreate tài khoản, không đổi ID Keycloak, không nới bootstrap chỉ kiểm tra sáu seed. Thêm hai MFA vào staff.json còn vi phạm schema bootstrap yêu cầu seed đúng sáu demo và vẫn không sửa staff.id hiện có.

**Rủi ro chính:** username tái sử dụng có thể chỉ chủ thể khác (cần phê duyệt mapping dù đây là demo có dấu vết rõ); hạ cờ MFA/revocation sẽ làm yếu bảo mật; sửa audit đã giao làm lệch bằng chứng; writer đồng thời có thể thay phạm vi plan; LDAP đang lệch cả ID/role/status nên không đủ điều kiện rekey hàng loạt.

## 7. Bằng chứng và giới hạn

Artifacts tại `.runtime/account-diagnostics/mfa-readonly-20261112T114355Z/`:

- `report.json`: đối chiếu 25 hồ sơ, FK/tham chiếu, backup metadata đã lọc, hash preservation.
- `mfa-audit-timeline.json`: 20 sự kiện với action/time/resource type/delivery flag, không raw payload.
- `summary.json`: số lượng, collisions, integrity và kết luận bảo toàn.

SQLite integrity/FK PASS; DB/seed vẫn đúng hash hậu kiểm migration thành công; Git index giữ nguyên. Không sửa source hoặc dữ liệu thật, không chạy test có tác dụng ghi môi trường thật, không start Backend, không migration/rollback/reset. Không đọc password/OTP credential. Bốn backup lịch sử 11/11 chưa đọc được; PostgreSQL Audit và LDAP server chưa được kiểm tra trực tiếp. **Chờ phê duyệt phương án sửa riêng trước khi có bất kỳ mutation nào.**
