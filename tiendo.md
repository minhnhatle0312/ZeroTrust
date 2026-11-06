# Tiến độ đồ án IAM-ZeroTrust

Cập nhật: **01/11/2026**. Đã triển khai giai đoạn 3 và mở rộng chức năng quản trị: Web B độc lập, SSO hai chiều, single logout, HTTPS LAN/VPN, nhân viên/role/phiên/thông báo và tra cứu log tại máy chủ. Web A/B build thành công. Minh chứng giai đoạn 3 ban đầu giữ riêng tại `evidence/week3` (73 backend, 29 SSO, 11 ảnh).

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

- [ ] Chọn OpenLDAP hoặc Windows Active Directory.
- [ ] Cài dựng LDAP Server hoặc Domain Controller.
- [ ] Tạo OU, Group, User mẫu.
- [ ] Kết nối LDAP Federation trong Keycloak.
- [ ] Cấu hình đồng bộ thuộc tính và nhóm người dùng.
- [ ] Kiểm thử đăng nhập bằng tài khoản LDAP/AD.
- [ ] Kiểm tra quyền và trạng thái khi dữ liệu LDAP thay đổi.

Ghi chú: nhóm Sản phẩm/Vận hành hiện nằm trong hồ sơ nhân viên phía ứng dụng; chưa đồng bộ nhóm LDAP/AD.

## Giai đoạn 6 – Vòng đời tài khoản JCL (Tuần 7)

- [x] Join: tạo nhân viên từ Web A/B và Keycloak, nhập hồ sơ/email/nhóm/role, mật khẩu tạm thời và buộc đổi ở lần đăng nhập đầu.
- [x] Change: sửa hồ sơ/nhóm ứng dụng và role Keycloak, kết thúc phiên cũ; đã kiểm tra đăng nhập bằng role mới. Nhóm chưa đồng bộ LDAP/AD; ứng dụng không cấp role admin.
- [x] Leave: vô hiệu hóa tài khoản và chặn đăng nhập mới — khóa tại ứng dụng và đồng bộ vô hiệu hóa sang Keycloak.
- [x] Kiểm tra token/phiên đã phát hành trước khi thu hồi — có kiểm tra token Keycloak thật; API từ chối token cũ.
- [x] Lưu bằng chứng trước/sau thay đổi tài khoản — kết quả khóa/mở/thu hồi, audit và ảnh giao diện quản trị.
- [x] Xây dựng luồng Join/Change/Leave trên Web và API admin: tạo nhân viên, đổi hồ sơ/nhóm/role, khóa/mở, thu hồi phiên và yêu cầu MFA; có lý do, audit, bảo vệ admin và xử lý lỗi đồng bộ.

## Giai đoạn 7 – Audit Logging (Tuần 8)

- [x] Bật Keycloak User Events và Admin Events.
- [ ] Thiết kế bảng lưu trữ Audit Log trong PostgreSQL — **Một phần:** audit ứng dụng hiện lưu trong SQLite; PostgreSQL đang lưu dữ liệu Keycloak.
- [ ] Xây dựng cơ chế thu thập sự kiện Keycloak — **Một phần:** đã thu thập/lưu SQLite và chống trùng mỗi 30 giây, tối đa 200 sự kiện/lượt; có đăng nhập, đăng xuất, lỗi và thay đổi mật khẩu/MFA được chọn. Chưa có dịch vụ tập trung, lấy bù đầy đủ và PostgreSQL audit.
- [x] Ghi log ALLOW/DENY cho yêu cầu từ Web A/B qua API chung; audit vẫn ở SQLite, chưa có trường client_id riêng và chưa tách dịch vụ audit.
- [ ] Ghi nhận thay đổi Role và trạng thái tài khoản — **Một phần:** đã audit tạo nhân viên, đổi hồ sơ/role, mật khẩu, khóa/mở/thu hồi/MFA qua ứng dụng; chưa thu thập đầy đủ Admin Events của những thay đổi trực tiếp ở Keycloak.
- [x] Giao diện tra cứu, lọc và thống kê audit trong SQLite: tìm toàn bộ lịch sử đã lưu, lọc ngày/kết quả/cảnh báo, sắp xếp và phân trang tại máy chủ, CSV tối đa 200 kết quả theo bộ lọc và thống kê hoạt động.
- [x] Kiểm thử khả năng truy vết người dùng, thời gian và hành động — có danh tính, thời điểm, hành động, request ID; kiểm thử rollback khi ghi audit thất bại.

## Giai đoạn 8 – Python Detection (Tuần 8–9)

- [ ] Xây dựng bộ dữ liệu Audit Log bình thường và bất thường — **Một phần:** có log demo và yêu cầu bị chặn; chưa có bộ dữ liệu gán nhãn phục vụ đánh giá.
- [ ] Thiết kế quy tắc phát hiện đăng nhập thất bại nhiều lần — **Một phần:** Keycloak đã bật chống brute-force với ngưỡng 5 lần thất bại; chưa có quy tắc trong module Python.
- [ ] Phát hiện truy cập sai Role hoặc ngoài giờ — **Một phần:** Node.js đã tạo cảnh báo sai quyền; chưa phát hiện bất thường ngoài giờ. Tính phút đi muộn là chức năng chấm công riêng.
- [ ] Xây dựng module Python Normal/Anomaly.
- [ ] Kết nối kết quả phát hiện với Security Dashboard — **Một phần:** cảnh báo Node.js đã hiển thị trong Web A/B; chưa tích hợp module Python.
- [ ] Đánh giá Precision, Recall, F1-score và False Positive Rate trên dữ liệu gán nhãn.

## Giai đoạn 9 – Kiểm thử bảo mật (Tuần 9)

- [x] Kiểm thử SSO và logout giữa hai website — luồng A→B, B→A, phát hiện logout và chặn token phiên cũ; kết quả trong `evidence/week3/browser-results.json`.
- [x] Kiểm thử RBAC và Least Privilege — 4 role, quyền theo nhóm, giới hạn auditor và cấm tự duyệt đơn.
- [x] Kiểm thử token sai chữ ký, hết hạn, sai audience — thêm sai issuer, chưa hiệu lực, thiếu expiration và token không ký.
- [ ] Kiểm thử MFA, LDAP và Join/Change/Leave — **Một phần:** đã kiểm tra yêu cầu thiết lập MFA, khóa/mở và thu hồi phiên; còn OTP thực tế, LDAP và đầy đủ luồng Change.
- [x] Kiểm thử chống truy cập trái phép qua API — truy cập chéo người dùng/nhóm, giả mạo trường dữ liệu và kiểm tra quyền tại backend.
- [x] Lưu HTTP Status, screenshot, log và bảng test case — giữ kết quả tuần 2 (54 backend, 27 browser, 8 ảnh); giai đoạn 3 có **73/73 backend**, **29/29 browser**, **11 ảnh** tại `evidence/week3`.
- [x] Đánh giá giới hạn Zero Trust và rủi ro còn tồn tại — tài liệu tuần 2 đã ghi giới hạn localhost, HTTPS, MFA thực tế và các phần chưa triển khai.

## Giai đoạn 10 – Hoàn thiện đồ án (Tuần 10)

- [ ] Hoàn thiện cấu trúc source code và README — **Một phần:** đã có `README.md` tổng quan lab Web A/B, script và hướng dẫn LAN/VPN; các module của giai đoạn sau vẫn chưa hoàn thiện.
- [ ] Hoàn thiện Docker Compose và cấu hình triển khai — **Một phần:** PostgreSQL/Keycloak chạy Docker; backend/frontend còn chạy Node.js trên máy, chưa đóng gói toàn hệ thống và cấu hình production.
- [ ] Vẽ System Architecture, OIDC Flow, SSO Flow và ERD — **Một phần:** có minh họa Docker trong báo cáo tuần 1; chưa đủ bộ sơ đồ theo kế hoạch.
- [ ] Viết báo cáo đồ án, kết quả thực nghiệm — **Một phần:** có Word tuần 1/tuần 3, tài liệu tuần 2/tuần 4 và kết quả kiểm thử; chưa có báo cáo đồ án cuối kỳ hoàn chỉnh.
- [ ] Tổng hợp ma trận User–Role–Resource và minh chứng — **Một phần:** đã mô tả quyền 6 tài khoản/4 role và giới hạn Web A/B; còn tổng hợp toàn hệ thống sau các giai đoạn tiếp theo.
- [ ] Chuẩn bị slide PowerPoint và video demo.
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
