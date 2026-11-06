# Chức năng và API quản trị bổ sung

Cập nhật 01/11/2026. Các chức năng dưới đây dùng dữ liệu SQLite và Keycloak đang chạy; không dùng danh sách cảnh báo giả trên giao diện. Trang mở hệ thống trong cấu hình LAN hiện tại: `https://10.0.103.227:8443/`.

## Những thay đổi chính

- **Chuông thông báo:** có số chưa đọc, danh sách nội dung/thời điểm, mở chức năng liên quan, đọc từng mục và đánh dấu tất cả. Trạng thái đọc lưu riêng cho từng người; nhân viên không được xem cảnh báo dành cho admin/auditor.
- **Thêm nhân viên:** tạo tài khoản Keycloak và hồ sơ ứng dụng; nhập tên đăng nhập, email, họ tên, nhóm, vai trò và mật khẩu tạm thời. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.
- **Hồ sơ & phiên:** xem nhân viên, sửa họ tên, nhóm và vai trò; đổi quyền được đồng bộ sang Keycloak và kết thúc phiên cũ. Tài khoản admin được bảo vệ; giao diện không cấp thêm quyền admin.
- **Đặt lại mật khẩu:** cấp mật khẩu tạm thời và buộc đổi khi đăng nhập, có lý do và audit. Mật khẩu không xuất hiện trong API phản hồi, audit, CSV hay minh chứng.
- **Quản lý phiên:** xem IP, thời điểm bắt đầu, hoạt động cuối và ứng dụng; kết thúc đúng phiên được chọn. Mỗi người có trang **Hồ sơ & phiên của tôi** để quản lý phiên của mình.
- **Tra cứu toàn bộ lịch sử đã lưu:** tìm không dấu, lọc khoảng ngày theo giờ Việt Nam, lọc kết quả/mức độ/trạng thái, sắp xếp tại máy chủ và phân trang. Không còn giới hạn tìm kiếm trong 100 sự kiện vừa tải.
- **Chi tiết log:** mở mã đối chiếu, HTTP status, tài khoản, yêu cầu, lý do và các bước xử lý cùng request ID.
- **Đăng nhập & xác thực:** lưu các sự kiện Keycloak được chọn, có ứng dụng, IP và nguyên nhân lỗi. Tự đồng bộ mỗi 30 giây; admin có nút đồng bộ ngay và thông báo kết quả/số bản ghi mới.
- **Cảnh báo đăng nhập thất bại:** sự kiện `LOGIN_ERROR` tạo cảnh báo, gộp các lần gần nhau và gửi thông báo đến người có quyền bảo mật. Mở cảnh báo để đối chiếu hoạt động truy cập và đăng nhập của tài khoản.
- **Thống kê:** tổng yêu cầu, lượt bị chặn, cảnh báo đang mở, biểu đồ 14 ngày có hoạt động gần nhất và thời điểm đồng bộ thành công.
- **Tự cập nhật Web B:** có công tắc 20 giây; dừng cập nhật nền khi tab bị ẩn hoặc đang mở hộp thoại để không làm gián đoạn biểu mẫu. Chuông thông báo kiểm tra mỗi 20 giây và khi trở lại cửa sổ.
- **Rút đơn:** người gửi được rút đơn đang chờ; sau đó quản lý không thể duyệt đơn này. Tạo đơn mới gửi thông báo cho người duyệt đúng phạm vi; kết quả duyệt gửi về người nộp.

## Dùng các nút mới

1. Đăng nhập `admin01`, vào **Tài khoản** của Web B hoặc **Tài khoản & truy cập** của Web A.
2. **Thêm nhân viên** để tạo danh tính. Mật khẩu cần 12–128 ký tự, gồm chữ hoa, chữ thường và số. Họ tên cần cả họ và tên; email hợp lệ để tránh bị yêu cầu bổ sung hồ sơ Keycloak khi đăng nhập.
3. **Hồ sơ & phiên** trên dòng nhân viên mở các mục **Hồ sơ & vai trò**, **Phiên đăng nhập**, **Hoạt động gần đây**, **Đặt lại mật khẩu**. Những thao tác thay đổi cần lý do.
4. **Quản lý truy cập** vẫn là luồng thu hồi phiên toàn tài khoản, khóa/mở và yêu cầu MFA. Khác với **Kết thúc phiên**, thu hồi toàn tài khoản áp dụng đến tất cả các phiên.
5. Trong **Đăng nhập & xác thực**, bấm **Đồng bộ Keycloak** để lấy ngay sự kiện mới; kết quả xuất hiện trên trang. Tìm tài khoản để xem lần đăng nhập, IP và lỗi.
6. Trong **Cảnh báo**, bấm **Điều tra** → **Hoạt động liên quan đến tài khoản** để đối chiếu trước khi ghi kết luận. Auditor thấy **Xem chi tiết** và chỉ có quyền đọc.
7. Trong **Nhật ký truy cập**, chọn ngày và bộ lọc, bấm tiêu đề cột để sắp xếp; bấm **Chi tiết** để truy vết. **Xuất CSV** lấy tối đa 200 kết quả đầu theo cách lọc/sắp xếp hiện tại; phân trang vẫn tra cứu được toàn bộ lịch sử đã lưu.
8. Bấm chuông **Thông báo** để xem cập nhật. Trên Web A, mở **Đơn điều chỉnh** → **Rút đơn** → **Xác nhận rút đơn** khi muốn hủy đề nghị đang chờ.

## 19 API bổ sung

Tất cả yêu cầu cần Bearer token hợp lệ, hồ sơ đang hoạt động, vai trò khớp và phiên Keycloak còn hiệu lực. Thao tác ghi được lưu audit. Web B chỉ cho admin/auditor; token Web B tiếp tục bị chặn khi gọi nghiệp vụ chấm công.

| Phương thức và đường dẫn | Quyền | Nội dung |
|---|---|---|
| `GET /api/security/events` | Admin, auditor | Tìm và phân trang toàn bộ audit đã lưu |
| `GET /api/security/events/:id` | Admin, auditor | Chi tiết và các bước cùng request ID |
| `GET /api/security/login-events` | Admin, auditor | Sự kiện xác thực Keycloak đã lưu |
| `GET /api/security/alert-list` | Admin, auditor | Tìm, lọc, sắp xếp và phân trang cảnh báo |
| `GET /api/security/alerts/:id/context` | Admin, auditor | 20 truy cập và 20 đăng nhập gần nhất của tài khoản |
| `GET /api/security/summary` | Admin, auditor | Tổng hợp audit, tài khoản, cảnh báo và đồng bộ |
| `POST /api/security/sync` | Admin | Đồng bộ ngay sự kiện Keycloak; body `{}` |
| `POST /api/admin/users` | Admin | Tạo nhân viên và danh tính Keycloak |
| `GET /api/admin/users/:id` | Admin | Hồ sơ và hoạt động gần đây |
| `PATCH /api/admin/users/:id` | Admin | Cập nhật họ tên, nhóm, vai trò và email nếu cung cấp |
| `POST /api/admin/users/:id/reset-password` | Admin | Mật khẩu tạm thời; bắt buộc đổi sau đăng nhập |
| `GET /api/admin/users/:id/sessions` | Admin | Danh sách phiên của tài khoản |
| `POST /api/admin/users/:id/sessions/revoke` | Admin | Kết thúc một phiên thuộc tài khoản |
| `GET /api/me/sessions` | Người đã đăng nhập | Phiên của chính mình |
| `POST /api/me/sessions/revoke` | Người đã đăng nhập | Kết thúc phiên của chính mình |
| `GET /api/notifications` | Người đã đăng nhập | 100 thông báo mới nhất trong phạm vi và tổng chưa đọc |
| `PATCH /api/notifications/:id/read` | Người đã đăng nhập | Đánh dấu thông báo được quyền đọc; body `{}` |
| `POST /api/notifications/read-all` | Người đã đăng nhập | Đánh dấu tất cả trong phạm vi; body `{}` |
| `POST /api/corrections/:id/cancel` | Chủ đơn, Web A | Rút đơn đang chờ; body `{}` |

Các API danh sách hỗ trợ `q`, `from`, `to`, `page`, `limit` (1–200), `sort`, `direction` (`asc`/`desc`). Cột sắp xếp nằm trong danh sách cho phép của từng API. Audit có `decision=ALLOW|DENY`; đăng nhập có `type`; cảnh báo có `status` và `severity`. Phản hồi gồm `items`, `total`, `page`, `limit`, `pages`.

Tạo nhân viên nhận `username`, `name`, `email`, `team`, `role`, `password`. Cập nhật nhận `name`, `team`, `role`, `note`, tùy chọn `email`; đặt mật khẩu nhận `password`, `note`. Kết thúc phiên nhận `sessionId`, `note`. Lý do thao tác từ 10–300 ký tự. Ba vai trò có thể cấp trên ứng dụng: `employee`, `manager`, `auditor`.

## Xử lý lỗi và dữ liệu

- Lỗi kết nối/Keycloak hiển thị trong trang hoặc hộp thoại; biểu mẫu giữ nội dung để thử lại. Các thao tác ghi không tự gửi lại để tránh tạo yêu cầu trùng.
- Token dùng thời gian theo giây; nếu lần đăng nhập mới trùng giây thu hồi phiên, yêu cầu đọc làm mới token một lần sau ranh giới đó. Token cũ vẫn bị backend kiểm tra như trước. Phiên thật sự kết thúc có nút đăng nhập lại và cơ chế phát hiện logout liên thông.
- Thay đổi hồ sơ chưa đồng bộ được Keycloak giữ quyền cũ trong ứng dụng và tạm khóa tài khoản để kiểm tra. Lưu lại hồ sơ khi Keycloak hoạt động, sau đó mở tài khoản bằng luồng đã xác nhận. Không tự báo cập nhật thành công khi chưa xác nhận.
- Các thay đổi hồ sơ trên Web được giữ khi backend khởi động lại; tệp seed chỉ thêm nhân viên chưa tồn tại. Sao lưu trước nâng cấp lưu cục bộ tại `evidence/api-upgrade/before-upgrade.sqlite`.
- Collector lưu SQLite, xử lý tối đa 200 sự kiện Keycloak mới nhất mỗi lượt và chống ghi trùng theo ID hoặc fingerprint; chưa có cơ chế lấy bù toàn bộ sự kiện khi ngắt lâu hoặc lưu lượng vượt quá batch. Loại sự kiện ngoài danh sách chọn không được lưu. Không phải hệ thống SIEM tập trung.
- Nhóm nhân viên hiện ở ứng dụng, role ở Keycloak; chưa phải LDAP/AD federation. Chưa có xóa nhân viên trên Web; dùng khóa để giữ lịch sử và tham chiếu dữ liệu. Yêu cầu MFA chưa đồng nghĩa đã hoàn thành kiểm thử đăng ký/nhập OTP cho toàn bộ tài khoản.

## Kiểm thử và minh chứng

- [97 kiểm thử backend](../evidence/api-upgrade/backend-tests.tap): kiểm tra quyền, nhập liệu, cạnh tranh thao tác, đổi role, mật khẩu, phiên, phạm vi thông báo, SQL, truy vấn lịch sử, thu thập/gộp sự kiện và rút đơn.
- [23/23 kiểm thử chức năng mới trên Chrome](../evidence/api-upgrade/browser-results.json): tạo người dùng mới, đổi nhóm/role, đổi mật khẩu bắt buộc, đăng nhập bằng quyền mới, rút đơn, thông báo, đăng nhập sai thật, cảnh báo/log và kết thúc phiên thật.
- 8/8 kiểm thử tìm kiếm, CSV và API client, gồm trường hợp phiên cùng giây thu hồi và không tự gửi lại thao tác ghi.
- [Kiểm thử giao diện và thao tác cũ](../evidence/ui-upgrade/results.json).
- [Minh chứng thông báo](../evidence/api-upgrade/04-notification-center.png).
- [Sự kiện đăng nhập](../evidence/api-upgrade/05-keycloak-login-events.png).
- [Ngữ cảnh cảnh báo](../evidence/api-upgrade/06-alert-context.png).
- [Chi tiết audit](../evidence/api-upgrade/07-event-detail.png).

Bộ kiểm thử mới chỉ thay đổi tài khoản demo có tiền tố `uiops-` do chính lượt chạy tạo; cuối lượt khóa tài khoản để giữ lịch sử đối chiếu. Không lưu mật khẩu/token trong kết quả. Minh chứng và cơ sở dữ liệu được Git bỏ qua.

```powershell
cd backend
npm.cmd test
cd ..
node --test tests/frontend.test.mjs tests/api-client.test.mjs
python -u tests/operations_ui.py
python -u tests/frontend_ui.py
```

Chạy kiểm thử trình duyệt tuần tự trên lab đang hoạt động để tránh chồng thao tác hoặc vượt giới hạn tần suất của cùng tài khoản. Hướng dẫn chạy/HTTPS: [kết nối hai máy](KET_NOI_HAI_MAY.md); hướng dẫn giao diện: [nâng cấp giao diện](NANG_CAP_GIAO_DIEN.md).
