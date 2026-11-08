# Tiến độ đồ án IAM-ZeroTrust

Cập nhật: **08/11/2026**. Đã triển khai lab và kiểm thử tuần 5–10: 130 backend, 8 tiện ích/API client, 7 Python; SSO/UI/nghiệp vụ và các bộ tích hợp mới đã có minh chứng. Có video thao tác, backup đa kho và phục hồi Audit cô lập. Xem [kết quả kiểm thử 08/11/2026](docs/KET_QUA_KIEM_THU_2026_11_08.md). Các số liệu mốc cũ bên dưới giữ như lịch sử; không thay kết quả mới.

Bổ sung giao diện: đã thiết kế lại trang chọn ứng dụng, tổng quan admin và điều hướng chức năng cho Web A/B; thêm tìm kiếm không dấu, bộ lọc, sắp xếp, phân trang, CSV và hộp thoại quản trị thống nhất. **42/42 kiểm tra UI**, **18 ảnh minh chứng UI**. Xem [hướng dẫn giao diện](docs/NANG_CAP_GIAO_DIEN.md) và [kết quả](evidence/ui-upgrade/results.json).

Bổ sung chức năng/API: có **19 API mới** cho nhân viên, phiên, thông báo, audit và sự kiện Keycloak; **97/97 test backend**, **8/8 test tiện ích/API client**, **23/23 kiểm tra chức năng mới trên Chrome** và **8 ảnh minh chứng**. Đã kiểm tra đăng nhập thật bằng role mới, thông báo và cảnh báo từ đăng nhập sai. Xem [chức năng và API](docs/CHUC_NANG_VA_API.md) và [kiểm thử thực tế](evidence/api-upgrade/browser-results.json).

**Quy ước:** `[x]` hoàn thành trong phạm vi ghi chú; `[ ]` chưa hoàn thành. **Một phần** nghĩa là đã triển khai một số nội dung nhưng chưa đủ để đánh dấu hoàn tất. Giữ mốc tuần của kế hoạch ban đầu; một số việc đã làm sớm trong tuần 2.

## Giai đoạn 1 – Hạ tầng IAM (Tuần 1–2)

- [x] Cài và kiểm tra Docker Desktop, WSL2, Node.js, VS Code.
- [x] Tạo cấu trúc dự án IAM-ZeroTrust.
- [x] Chạy PostgreSQL và Keycloak bằng Docker Compose — có volume lưu dữ liệu và healthcheck PostgreSQL.
- [x] Tạo Realm `company-iam`.
- [x] Tạo 4 Role: admin, manager, employee, auditor.
- [x] Tạo 4 tài khoản kiểm thử và gán Role — tuần 2 đã mở rộng thành **6 tài khoản**, có 2 nhân viên và 2 quản lý để kiểm tra khác nhóm.
- [x] Kiểm tra đăng nhập, lưu dữ liệu và khởi động lại container — đã ghi nhận ở tuần 1.

## Giai đoạn 2 – Web A và RBAC (Tuần 3)

- [x] Tạo OIDC Client `employee-portal` và cấu hình PKCE S256.
- [x] Cấu hình Audience `employee-api` và Roles Mapper — audience mapper và client scope roles của Keycloak.
- [x] Xây dựng Web A bằng React — giao diện Nhịp Workspace, hỗ trợ máy tính và điện thoại.
- [x] Tạo backend Express, API và middleware xác minh JWT — chữ ký RS256, issuer, audience, thời hạn và danh tính nhân viên.
- [x] Tích hợp đăng nhập, đăng xuất Keycloak.
- [x] Xây dựng các API Profile, Manager, Admin, Auditor — bổ sung API chấm công, đơn điều chỉnh, nhóm và bảo mật.
- [x] Kiểm thử phản hồi HTTP 200, 401, 403 theo Role — có kết quả backend và trình duyệt.

## Giai đoạn 3 – Web B và SSO (Tuần 4)

- [x] Tạo Web B – Security Dashboard độc lập trong `web-b`: tổng quan, cảnh báo, nhật ký và quản lý tài khoản theo quyền; có giao diện điện thoại.
- [x] Tạo OIDC Client `security-dashboard`, public client, Authorization Code + PKCE S256, audience riêng `security-api`; cấu hình scope `basic` để token có `sub`.
- [x] Tích hợp đăng nhập Keycloak vào Web B; token riêng cho từng client, giữ trong bộ nhớ; có liên kết Web A ↔ Web B.
- [x] Kiểm thử SSO hai chiều Web A ↔ Web B trong cùng trình duyệt: không nhập lại mật khẩu khi phiên Keycloak còn hiệu lực.
- [x] Kiểm soát quyền riêng tại UI và API: admin/auditor được vào Web B; employee/manager bị từ chối; auditor không được quản lý tài khoản; token Web B không dùng cho chấm công.
- [x] Kiểm thử logout ở cả hai chiều: tab còn lại về trang đăng nhập; token cũ bị API từ chối dù chưa hết hạn. Backend kiểm tra `sid` với Keycloak, cache tối đa 5 giây; tab hoạt động kiểm tra mỗi 15 giây và khi focus.

Giới hạn: SSO áp dụng trong cùng hồ sơ trình duyệt. Hai máy dùng chung hệ thống IAM nhưng đăng nhập độc lập; tab nền bị đình chỉ có thể cập nhật giao diện muộn. Khi Keycloak không liên lạc được, API trả 503 thay vì bỏ qua xác nhận phiên. Chi tiết ở [tuan4.md](tuan4.md).

## Giai đoạn 4 – MFA và tăng cường bảo mật (Tuần 5)

**Bổ sung mã nguồn ngày 04/11/2026; chưa kiểm thử/build hoặc áp dụng cấu hình trên lab theo yêu cầu.** Xem [triển khai tuần 5](docs/TUAN_5_TRIEN_KHAI.md) và [nghiệm thu để làm sau](docs/TUAN_5_NGHIEM_THU.md). Các số pass ở phần trước là kết quả của mốc trước tuần 5.

- [x] Chuẩn bị script backup PostgreSQL/SQLite/config, clone flow TOTP theo tài khoản, client overrides và rollback cấu hình.
- [x] Bổ sung API trạng thái MFA/required action, recovery có xác thực lại, hàng đợi refresh và giao diện hết phiên.
- [x] Bổ sung đối chiếu local/Keycloak, kiểm soát version và retry partial mới nhất; không phát lại mật khẩu.
- [x] Bổ sung collector checkpoint/backfill/backoff/gap và audit có client/IP/role.
- [x] Bổ sung lịch công/KPI/tiến trình đơn, bảo mật hồ sơ, Analytics/ma trận quyền và bộ lọc nâng cao trên Web A/B.
- [x] Chuẩn bị gateway headers/path hardening, readiness và Compose production-like độc lập.

Các dấu [x] ngay trên chỉ xác nhận có mã nguồn/cấu hình, không phải đã kiểm thử hoặc áp dụng thành công. Những điều kiện nghiệm thu bên dưới vẫn để chưa hoàn tất.

- [ ] Cấu hình Required Actions và TOTP MFA — **Một phần:** admin yêu cầu `CONFIGURE_TOTP` theo tài khoản, đã kiểm tra ghi nhận tại Keycloak; chưa hoàn thành đăng ký thiết bị OTP và chưa bắt buộc MFA toàn hệ thống.
- [ ] Kiểm thử đăng nhập với mật khẩu và OTP.
- [ ] Kiểm tra OTP sai, thiếu hoặc hết hạn.
- [ ] Kiểm soát phiên, token expiration và refresh token — **Một phần:** token 300 giây, frontend gọi `updateToken(30)`, có logout/thu hồi và chặn token cũ; còn kiểm thử đầy đủ vòng đời refresh token và lỗi làm mới.
- [x] Kiểm thử truy cập trực tiếp API trái quyền — vượt quyền admin, xem công người khác, duyệt khác nhóm và tự duyệt đều có kịch bản kiểm tra.
- [ ] Kiểm tra Redirect URI, CORS và cấu hình HTTPS — **Một phần:** đã giới hạn URI/CORS theo địa chỉ cấu hình và có HTTPS LAN/VPN với CA riêng; chưa triển khai production, Keycloak còn chạy `start-dev`.

## Giai đoạn 5 – LDAP / Active Directory (Tuần 6)

**Mã nguồn bổ sung ngày 06/11/2026; chưa nghiệm thu.** Xem [triển khai tuần 6](docs/TUAN_6_TRIEN_KHAI.md) và [các ca để chạy sau](docs/TUAN_6_NGHIEM_THU.md). Không dùng dấu đã có code để kết luận đã kết nối/đăng nhập LDAP thành công.

- [x] Chọn OpenLDAP Docker, LDAPS và nguồn danh tính READ_ONLY.
- [x] Chuẩn bị Dockerfile/ACL, bootstrap OU/user/group, CA và bind account riêng; chưa chạy.
- [x] Viết setup federation, attribute/group mapper, đối chiếu source → Keycloak → app; chưa áp dụng.
- [x] Viết 5 API Directory, job/scheduler, maintenance hold và xử lý lỗi/xung đột.
- [x] Bổ sung Directory Users, Federation Sync và Group Mapping trên Web B; chưa build.
- [x] Chuẩn bị backup/rollback/runner và hướng dẫn thay đổi nhóm/trạng thái tại nguồn.

- [ ] Cài dựng LDAP Server hoặc Domain Controller.
- [ ] Tạo OU, Group, User mẫu.
- [ ] Kết nối LDAP Federation trong Keycloak.
- [ ] Cấu hình đồng bộ thuộc tính và nhóm người dùng.
- [ ] Kiểm thử đăng nhập bằng tài khoản LDAP/AD.
- [ ] Kiểm tra quyền và trạng thái khi dữ liệu LDAP thay đổi.

Ghi chú: đã có mã ánh xạ ou/LDAP group sang hồ sơ ứng dụng và role Keycloak; trạng thái lab chưa được áp dụng/kiểm chứng. Không triển khai Windows AD DS trong đợt này.

## Giai đoạn 6 – Vòng đời tài khoản JCL (Tuần 7)

**Phần mở rộng tuần 7 ngày 06/11/2026 chỉ hoàn thành mã nguồn, chưa nghiệm thu.** Xem [triển khai tuần 7](docs/TUAN_7_TRIEN_KHAI.md) và [các ca chưa chạy](docs/TUAN_7_NGHIEM_THU.md).

- [x] Bổ sung quy trình JCL: đề nghị, phê duyệt, snapshot/version, thực hiện, đối chiếu và timeline.
- [x] Join local có marker retry, mật khẩu tạm và MFA; Join LDAP qua source CLI, enrollment riêng và onboarding hold.
- [x] Change/Leave giữ chặn khi lỗi, thu hồi grant/phiên và bảo vệ trạng thái processing/left trước các nút quản trị cũ.
- [x] Bổ sung yêu cầu quyền có thời hạn, duyệt theo nhóm, kiểm tra grant tại API và ba tài nguyên thực tế.
- [x] Bổ sung snapshot review, khuyến nghị auditor, ma trận grant và thông báo nội bộ.
- [x] Bổ sung giao diện Web A/B, công cụ operator, setup/runner và tài liệu tuần 7.
- [ ] Áp dụng schema/cấu hình và build giao diện tuần 7.
- [ ] Nghiệm thu Join → MFA → Change → cấp/thu hồi quyền → Leave với LDAP và local.
- [ ] Nghiệm thu lỗi giữa chừng, restart/resume, phân quyền và lưu minh chứng mới.

Các mục lịch sử dưới đây ghi nhận CRUD/JCL cơ bản đã có trước tuần 7; không xác nhận phần mở rộng LDAP/phê duyệt mới đã chạy:

- [x] Join: tạo nhân viên từ Web A/B và Keycloak, nhập hồ sơ/email/nhóm/role, mật khẩu tạm thời và buộc đổi ở lần đăng nhập đầu.
- [x] Change: sửa hồ sơ/nhóm ứng dụng và role Keycloak, kết thúc phiên cũ; đã kiểm tra đăng nhập bằng role mới. Nhóm chưa đồng bộ LDAP/AD; ứng dụng không cấp role admin.
- [x] Leave: vô hiệu hóa tài khoản và chặn đăng nhập mới — khóa tại ứng dụng và đồng bộ vô hiệu hóa sang Keycloak.
- [x] Kiểm tra token/phiên đã phát hành trước khi thu hồi — có kiểm tra token Keycloak thật; API từ chối token cũ.
- [x] Lưu bằng chứng trước/sau thay đổi tài khoản — kết quả khóa/mở/thu hồi, audit và ảnh giao diện quản trị.
- [x] Xây dựng luồng Join/Change/Leave trên Web và API admin: tạo nhân viên, đổi hồ sơ/nhóm/role, khóa/mở, thu hồi phiên và yêu cầu MFA; có lý do, audit, bảo vệ admin và xử lý lỗi đồng bộ.

## Giai đoạn 7 – Audit Logging (Tuần 8)

- [x] Bật Keycloak User Events và Admin Events.
- [x] **Source:** schema/service PostgreSQL audit riêng, Compose overlay và SQLite outbox; chưa khởi chạy/áp dụng/kiểm thử. Xem [note tuần 8](docs/TUAN_8_TRIEN_KHAI.md).
- [x] **Source:** collector user/admin events có checkpoint, phân trang, retry, overlap, backfill và gap; chưa nghiệm thu độ đầy đủ.
- [x] Ghi log ALLOW/DENY cho API Web A/B ở mốc cũ; source mới bổ sung client_id, IP, role, session hash và chuyển qua Audit Service, chưa kiểm thử phần mới.
- [x] **Source:** thu Admin Events, chuẩn hóa actor/hành động/resource; không nhập representation. Chưa đối chiếu role change thật tại PostgreSQL.
- [x] Giao diện tra cứu, lọc và thống kê audit trong SQLite: tìm toàn bộ lịch sử đã lưu, lọc ngày/kết quả/cảnh báo, sắp xếp và phân trang tại máy chủ, CSV tối đa 200 kết quả theo bộ lọc và thống kê hoạt động.
- [x] Kiểm thử khả năng truy vết người dùng, thời gian và hành động — có danh tính, thời điểm, hành động, request ID; kiểm thử rollback khi ghi audit thất bại.

## Giai đoạn 8 – Python Detection (Tuần 8–9)

- [ ] Xây dựng bộ dữ liệu Audit Log bình thường và bất thường — **Một phần:** có log demo và yêu cầu bị chặn; chưa có bộ dữ liệu gán nhãn phục vụ đánh giá.
- [x] **Source:** luật login failures, DENY liên tiếp, token thu hồi và request spike; chưa chạy.
- [x] **Source:** employee thử admin, IP mới, ngoài giờ; chỉ tạo tín hiệu điều tra, không tự khóa.
- [x] **Source:** module Python Normal/Anomaly, features và worker checkpoint, auto mặc định tắt.
- [x] **Source:** giao diện Web B Detection, incident, nhãn độc lập và lịch sử job. Xem [note tuần 9](docs/TUAN_9_TRIEN_KHAI.md).
- [ ] Chạy đánh giá Precision/Recall/F1/FPR, confusion matrix và latency trên dataset thật — công cụ/snapshot đã có, chưa có số đo.

## Giai đoạn 9 – Kiểm thử bảo mật (Tuần 9)

**Các dấu [x] bên dưới chỉ ghi nhận lịch sử trước tuần 5.** Đã soạn thêm nguồn test Python/API và [checklist tuần 9](docs/TUAN_9_NGHIEM_THU.md); toàn bộ kiểm thử mã tuần 5–10 hiện chưa chạy.

- [x] Kiểm thử SSO và logout giữa hai website — luồng A→B, B→A, phát hiện logout và chặn token phiên cũ; kết quả trong `evidence/week3/browser-results.json`.
- [x] Kiểm thử RBAC và Least Privilege — 4 role, quyền theo nhóm, giới hạn auditor và cấm tự duyệt đơn.
- [x] Kiểm thử token sai chữ ký, hết hạn, sai audience — thêm sai issuer, chưa hiệu lực, thiếu expiration và token không ký.
- [ ] Kiểm thử MFA, LDAP và Join/Change/Leave — **Một phần:** đã kiểm tra yêu cầu thiết lập MFA, khóa/mở và thu hồi phiên; còn OTP thực tế, LDAP và đầy đủ luồng Change.
- [x] Kiểm thử chống truy cập trái phép qua API — truy cập chéo người dùng/nhóm, giả mạo trường dữ liệu và kiểm tra quyền tại backend.
- [x] Lưu HTTP Status, screenshot, log và bảng test case — giữ kết quả tuần 2 (54 backend, 27 browser, 8 ảnh); giai đoạn 3 có **73/73 backend**, **29/29 browser**, **11 ảnh** tại `evidence/week3`.
- [x] Đánh giá giới hạn Zero Trust và rủi ro còn tồn tại — tài liệu tuần 2 đã ghi giới hạn localhost, HTTPS, MFA thực tế và các phần chưa triển khai.

## Giai đoạn 10 – Hoàn thiện đồ án (Tuần 10)

- [x] **Source/tài liệu:** cập nhật README, note từng tuần, runner và hướng dẫn bàn giao; chưa xác nhận runtime.
- [x] **Source:** Compose IAM/LDAP/Audit, runner local/LAN và recovery project; backend/frontend tiếp tục chạy Node trên host theo kiến trúc lab.
- [x] **Tài liệu:** kiến trúc/trust boundary, OIDC/MFA, SSO, JCL, Audit và ERD tại [sơ đồ](docs/KIEN_TRUC_VA_LUONG_HE_THONG.md).
- [x] **Bản thảo:** báo cáo tổng hợp Markdown/Word; phần thực nghiệm ghi chờ. Chưa phải báo cáo nghiệm thu đạt.
- [x] **Source/tài liệu:** ma trận role/resource và grant, review quyền; minh chứng mới còn chờ chạy.
- [x] **Bản thảo:** PowerPoint 15 slide và kịch bản demo/video; xem [note tuần 10](docs/TUAN_10_TRIEN_KHAI.md).
- [ ] Quay video demo, đo số liệu, diễn tập restore và hoàn tất hồ sơ bằng chứng thật.
- [ ] Chạy demo tổng thể và luyện câu hỏi phản biện — **Một phần:** đã chạy demo tuần 2 bằng trình duyệt; chưa demo toàn bộ phạm vi đồ án và luyện phản biện.

## Bổ sung đã hoàn thành trong tuần 2

- [x] Chấm công ca **08:00–17:00, giờ Việt Nam**; check-in/check-out bằng thời gian máy chủ, ngăn ghi công trùng.
- [x] Bảng công theo tháng, thống kê giờ làm/phút đi muộn và biểu đồ 7 ngày.
- [x] Gửi đơn điều chỉnh công; quản lý chỉ xem/duyệt nhóm mình; admin xem toàn bộ; không tự duyệt đơn.
- [x] Trung tâm bảo mật cho admin/auditor; admin điều tra, cập nhật trạng thái và ghi kết luận cảnh báo.
- [x] Xử lý tài khoản bằng thu hồi phiên, khóa/mở, yêu cầu MFA; bắt buộc ghi lý do và lưu audit.
- [x] Xử lý Keycloak lỗi/đồng bộ chưa hoàn tất; khóa/thu hồi cục bộ vẫn có hiệu lực, mở tài khoản cần Keycloak xác nhận.
- [x] Kiểm tra đầu vào, giới hạn tần suất/kích thước request, SQL có tham số, kiểm tra nội dung XSS được hiển thị dưới dạng văn bản.
- [x] Kiểm thử thao tác đồng thời, duyệt lại đơn, lưu dữ liệu qua khởi động lại và ranh giới ngày UTC+7.

Ghi chú: admin xử lý cảnh báo và tài khoản/phiên. Đóng cảnh báo không tự vá lỗ hổng mã nguồn; lỗi mã nguồn cần bản sửa và kiểm thử lại.

## Tài liệu và minh chứng đối chiếu

- [Web B, SSO và single logout — tuần 4](tuan4.md).
- [Kết nối hai máy qua HTTPS LAN/VPN](docs/KET_NOI_HAI_MAY.md).
- [Kết quả 29 kiểm tra SSO thực tế](evidence/week3/browser-results.json).
- [Ảnh Web B, giao diện điện thoại và logout](evidence/week3/).
- [Nội dung tuần 2](tuan2.md).
- [Cách chạy nhanh](CHAY_NHANH.md).
- [Kịch bản kiểm thử bảo mật tuần 2](docs/KIEM_THU_BAO_MAT_TUAN_2.md).
- [Kết quả 54 test backend đã lưu](evidence/week2/backend-tests.tap).
- [Kết quả kiểm tra trình duyệt đã lưu](evidence/week2/browser-results.json).
- [Thư mục ảnh minh chứng tuần 2](evidence/week2/).
