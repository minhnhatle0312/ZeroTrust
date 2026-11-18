# Tuần 2 — Nhịp Workspace: chấm công và kiểm soát truy cập

Cập nhật: **31/10/2026**. Tiếp tục dự án IAM-ZEROTRUST tuần 1 trên cùng máy và Docker Compose.

**Kết quả xác nhận:** 54/54 test backend đạt; 27/27 kiểm tra trình duyệt đạt, hoàn tất lúc **09:09:20 ngày 31/10/2026 (UTC+7)**; frontend build thành công. Đã lưu 8 ảnh thật trong `evidence/week2`. Số liệu chi tiết nằm trong các tệp kết quả bên dưới.

## 1. Chức năng đã triển khai

| Phần | Cách hoạt động |
|---|---|
| Tổng quan | Đồng hồ giờ Việt Nam, ca 08:00–17:00, trạng thái hôm nay, thống kê tháng, biểu đồ 7 ngày |
| Chấm công | Check-in/check-out theo thời gian máy chủ và danh tính đã xác thực; không nhận user/giờ do trình duyệt tự gán |
| Bảng công cá nhân | Lọc theo tháng, xem giờ vào/ra, thời lượng và số phút đi muộn |
| Đơn điều chỉnh | Gửi đơn cho 31 ngày gần nhất, xem trạng thái và phản hồi; không tự sửa trực tiếp bảng công |
| Quản lý nhóm | Chỉ xem thành viên và duyệt đơn trong nhóm; không tự duyệt đơn của mình |
| Quản trị | Xem toàn bộ nhóm; thu hồi phiên, khóa/mở tài khoản, yêu cầu thiết lập OTP; phải ghi lý do |
| Trung tâm bảo mật | Cảnh báo vượt quyền, truy cập dữ liệu người khác, token bị thu hồi, chèn trường dữ liệu, giới hạn tần suất; điều tra và ghi kết luận |
| Audit | Nhật ký SQLite cùng giao dịch với dữ liệu nghiệp vụ; lỗi ghi log làm rollback thay đổi |
| Keycloak | Client điều khiển riêng phía server, chống dò mật khẩu, token 5 phút, chính sách mật khẩu và sự kiện đăng nhập |
| Giao diện | Bố cục xanh đậm/xanh nhạt, tương thích điện thoại, thông báo lỗi/đang tải/trống, hộp thoại xác nhận thao tác |

Thời lượng hiển thị là **giờ ra trừ giờ vào**, chưa trừ nghỉ trưa và chưa tính lương. Ca hiện tại là ca trong ngày, chưa hỗ trợ ca đêm. Các tên hiển thị được dùng cho tài khoản demo, không phải dữ liệu nhân sự thật.

## 2. Tài khoản và ranh giới quyền

| User | Nhóm | Quyền |
|---|---|---|
| employee01 — Hoàng Nam | Sản phẩm | Chấm công và gửi đơn của mình |
| manager01 — Minh Anh | Sản phẩm | Chấm công cá nhân, xem/duyệt nhóm Sản phẩm |
| employee02 — Ngọc Linh | Vận hành | Chấm công và gửi đơn của mình |
| manager02 — Quang Huy | Vận hành | Chấm công cá nhân, xem/duyệt nhóm Vận hành |
| auditor01 — Thu Hà | Kiểm soát | Xem cảnh báo, audit và sự kiện Keycloak; không sửa cảnh báo hay khóa user |
| admin01 | Điều hành | Quản lý toàn bộ, xử lý cảnh báo và tài khoản không phải admin |

Tất cả tài khoản có hồ sơ công cá nhân. Admin cũng không được tự duyệt đơn của mình. Tài khoản có role admin được bảo vệ khỏi thao tác khóa/thu hồi/MFA từ trang ứng dụng; quản lý nhóm này trực tiếp qua Keycloak Admin Console.

Backend đối chiếu **sub trong JWT** với hồ sơ nhân viên phía server. Nhóm không lấy từ dữ liệu trình duyệt gửi lên. Vai trò phải đồng thời khớp JWT và hồ sơ đã cấp. Thay đổi cơ cấu demo bằng `keycloak/lab-config.json` và script cấu hình, không sửa dữ liệu bằng DevTools.

## 3. Chạy lần đầu cho tuần 2

Yêu cầu: Docker Desktop đang chạy, **Node.js 22.19+** (cần `node:sqlite`), Python 3.11+. Cấu hình hiện được kiểm chứng trên Node 22.19. SQLite có thể hiện ExperimentalWarning ở phiên bản này.

Terminal 1:

```powershell
cd D:\IAM-ZeroTrust
python scripts/init_env.py
docker compose up -d
docker compose ps
```

Đợi mở được `http://localhost:8080/admin/`, sau đó:

```powershell
python scripts/setup_week2.py
```

Script giữ dữ liệu Keycloak hiện có, bổ sung hai tài khoản/nhóm, hardening realm và service account. Secret điều khiển được ghi vào `backend/.env`, không đưa vào frontend hoặc ảnh minh chứng. Hồ sơ demo ghi vào `backend/data/staff.json`; backend đọc khi khởi động.

Terminal 2:

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd ci
npm.cmd start
```

Terminal 3:

```powershell
cd D:\IAM-ZeroTrust\web-a
npm.cmd ci
npm.cmd run dev
```

Mở **http://localhost:5173**. Mật khẩu lấy trong `.env` ở gốc dự án: `TEST_EMPLOYEE01_PASSWORD`, `TEST_MANAGER01_PASSWORD`, `TEST_EMPLOYEE02_PASSWORD`, `TEST_MANAGER02_PASSWORD`, `TEST_AUDITOR01_PASSWORD`, `TEST_ADMIN01_PASSWORD`.

Lần sau chỉ cần mở Docker Desktop, `docker compose up -d`, chạy backend và frontend. Sau khi chạy lại script cấu hình phải khởi động lại backend để nạp hồ sơ/credential mới. Không chạy đồng thời nhiều backend trên cùng file SQLite.

## 4. Trình diễn luồng nghiệp vụ

1. Đăng nhập **employee01** → Chấm công vào → xem Bảng công của tôi.
2. Tạo đơn điều chỉnh cho hôm qua, giờ 08:00–17:00, ghi lý do ít nhất 10 ký tự.
3. Đăng xuất → **manager01** → Quản lý nhóm → Duyệt đơn, ghi nhận xét ít nhất 5 ký tự.
4. Vào lại **employee01** → đơn đã duyệt và bảng công được cập nhật.
5. Đăng nhập **manager02** → chỉ thấy nhóm Vận hành; không thấy hồ sơ nhóm Sản phẩm.
6. Nhấn Chấm công ra ở tài khoản đã vào ca. Lặp lại thao tác sẽ bị từ chối để tránh trùng công.

Khi có đơn do quản lý gửi, quản lý khác nhóm không được duyệt; admin có thể duyệt nếu đơn không phải của chính admin.

## 5. Cảnh báo và biện pháp xử lý tại admin

**Trung tâm bảo mật** hiển thị các yêu cầu bị chặn và lịch sử thực hiện. Một cảnh báo không tự chứng minh có lỗ hổng bị khai thác: có thể là thao tác nhầm hoặc kịch bản kiểm thử. Admin điều tra rồi chọn Đang điều tra / Đã xử lý / Đã xác minh hợp lệ, kèm ghi chú.

**Tài khoản & truy cập → Quản lý truy cập** có bốn biện pháp:

| Biện pháp | Tác dụng tại ứng dụng | Tác dụng tại Keycloak |
|---|---|---|
| Thu hồi phiên | Lưu mốc thu hồi; token cũ bị từ chối ngay | Kết thúc các phiên của user |
| Khóa tài khoản | Chặn mọi API của user | Vô hiệu hóa user và kết thúc phiên |
| Mở tài khoản | Chỉ mở khi Keycloak xác nhận; token cũ vẫn không được dùng lại | Kích hoạt user; cần đăng nhập mới |
| Yêu cầu MFA | Thu hồi token cũ | Thêm `CONFIGURE_TOTP`; người dùng phải thiết lập ứng dụng OTP khi đăng nhập tiếp |

Mỗi thao tác cần lý do ít nhất 10 ký tự và có audit. Nếu Keycloak lỗi, giao diện báo **chưa đồng bộ** (HTTP 202); khóa/thu hồi cục bộ vẫn giữ. Chọn lại thao tác để đồng bộ khi Keycloak hoạt động. Nếu backend khởi động lại giữa thao tác, trạng thái pending chuyển sang partial để có thể kiểm tra và thử lại. Mỗi user chỉ có một thao tác đang xử lý, tránh khóa và mở đồng thời.

Đóng cảnh báo chỉ là lưu kết luận điều tra; không tự sửa code hoặc tự mở tài khoản. Lỗi mã nguồn phải sửa trong dự án và chạy lại regression test. Trang admin xử lý tài khoản/phiên/điều tra, không có chức năng tự vá mọi lỗ hổng.

## 6. Bổ sung Keycloak và lưu trữ

- Realm `company-iam`, public client `employee-portal` tiếp tục dùng Authorization Code + PKCE S256.
- Access token: 300 giây; chống brute-force: 5 lần thất bại, thời gian chờ tăng theo cấu hình realm; không bật khóa vĩnh viễn.
- Password policy: tối thiểu 12 ký tự, có chữ hoa/chữ thường/chữ số; áp dụng khi đặt/đổi mật khẩu, không tự thay mật khẩu demo đang có.
- Service client `attendance-control`: confidential, chỉ bật service account; được gán `manage-users`, `view-users`, `view-realm`, `view-events` trong realm ứng dụng. Đây vẫn là credential có quyền quản trị user; giữ trong backend, không có quyền master realm.
- MFA là **yêu cầu theo tài khoản** khi admin chọn, chưa phải chính sách bắt buộc MFA cho mọi tài khoản. Kiểm thử tự động xác nhận `CONFIGURE_TOTP` được ghi thật, rồi hoàn nguyên để tài khoản demo tiếp tục dùng được; chưa tự đăng ký thiết bị OTP.
- PostgreSQL trong Docker tiếp tục lưu Keycloak. Dữ liệu chấm công, đơn, cảnh báo, thao tác xử lý và audit tuần 2 nằm trong `backend/data/attendance.sqlite` (WAL, transaction, tham số SQL).
- File audit JSONL tuần 1 được giữ làm tài liệu lịch sử; API audit tuần 2 đọc SQLite. Bộ chụp giao diện tuần 1 không phù hợp giao diện mới; dùng `tests/week2_browser.py`.

## 7. Kiểm thử và minh chứng

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd test
```

Bộ backend có **54 test** (gồm 2 test audit tuần 1 và 52 test tuần 2). Dùng JWT RS256 ký thật với khóa kiểm thử và database riêng trong bộ nhớ; thao tác Keycloak trong bộ này được mô phỏng để kiểm tra cả lỗi dịch vụ.

Giữ ba dịch vụ đang chạy, dùng Chrome sẵn có:

```powershell
cd D:\IAM-ZeroTrust
python -m pip install --no-user --target .tools -r tests/requirements.txt
python tests/week2_browser.py
```

Nếu chỉ có Edge, đặt `$env:TEST_BROWSER_CHANNEL = 'msedge'` trước khi chạy. Script dùng các tài khoản demo thật, tạo đơn ghi rõ “Minh chứng tuần 2”, thực hiện duyệt công, kiểm tra truy cập sai quyền, khóa/mở user, thu hồi token và yêu cầu MFA trong Keycloak. Dữ liệu công/đơn demo được giữ để trình diễn; trạng thái khóa/MFA do script thay đổi được hoàn nguyên. Script không được thiết kế để chạy song song nhiều bản.

Kết quả và ảnh ở [evidence/week2](evidence/week2):

- [backend-tests.tap](evidence/week2/backend-tests.tap): kết quả backend.
- [browser-results.json](evidence/week2/browser-results.json): từng kiểm tra trình duyệt và thời điểm; chỉ coi thành công khi `success: true`.
- [Dashboard](evidence/week2/01-employee-dashboard.png), [đơn điều chỉnh](evidence/week2/02-correction-request.png), [quản lý nhóm](evidence/week2/03-manager-team.png).
- [Trung tâm bảo mật](evidence/week2/04-security-center.png), [khóa tài khoản](evidence/week2/05-account-containment.png), [giao diện điện thoại](evidence/week2/06-mobile-attendance.png), [kết quả điều tra](evidence/week2/07-security-investigation.png).
- [Chấm công ra hoàn tất](evidence/week2/08-completed-day.png) và [kết quả npm audit](evidence/week2/dependency-audit.json).

Danh mục kịch bản và cách giải thích kết quả: [KIEM_THU_BAO_MAT_TUAN_2.md](docs/KIEM_THU_BAO_MAT_TUAN_2.md).

## 8. Giới hạn cần ghi đúng trong báo cáo

Đây là lab localhost, Keycloak dùng HTTP/start-dev. Chưa có HTTPS production, reverse proxy, sao lưu tự động, log bất biến, giới hạn tài nguyên nhiều node hoặc kiểm tra tư thế thiết bị. SQLite và rate limiter hiện dành cho một tiến trình API; chưa triển khai dịch vụ audit tách biệt. Log/cảnh báo không tự xoay vòng. UI chỉ đọc tối đa 100 cảnh báo/100 sự kiện gần nhất; số cảnh báo mở đếm toàn database.

Thu hồi ngay áp dụng cho thao tác đi qua API ứng dụng. Nếu sửa user/role trực tiếp trong Keycloak, token đã phát có thể còn hiệu lực tối đa TTL và hồ sơ nhóm/role cục bộ cần đồng bộ lại. Không coi đăng xuất trình duyệt đơn thuần là cơ chế chống mọi token bị đánh cắp.

Kiểm thử backend mô phỏng Keycloak mất kết nối và lỗi audit; kiểm thử trình duyệt dùng Keycloak thật cho các luồng thành công. Chưa pentest hạ tầng/container, chưa bảo đảm không còn lỗ hổng ngoài các trường hợp kiểm tra. `npm audit` tại thời điểm rà soát báo 0 advisory cho dependency hiện cài của backend và frontend; kết quả này không thay thế kiểm thử ứng dụng.

## 9. Tệp chính và tài liệu tham khảo

| Tệp | Vai trò |
|---|---|
| `backend/app.js` | API, xác thực, phân quyền, chấm công, điều chỉnh và khắc phục |
| `backend/store.js` | SQLite schema, transaction và cảnh báo |
| `backend/keycloak-admin.js` | Tương tác service account với Keycloak |
| `scripts/setup_week2.py` | Cấu hình realm, user, service client và hồ sơ nhân viên |
| `web-a/src/App.jsx`, `App.css` | Các màn hình và giao diện đáp ứng |
| `backend/security.test.js` | Regression test nghiệp vụ và bảo mật |
| `tests/week2_browser.py` | Kiểm thử trình duyệt với Keycloak thật |

Đối chiếu kỹ thuật: [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html), [Keycloak JavaScript Adapter](https://www.keycloak.org/securing-apps/javascript-adapter), [Node.js SQLite](https://nodejs.org/api/sqlite.html).
