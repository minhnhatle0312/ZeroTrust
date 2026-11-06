# Giao diện Nhịp Workspace và Nhịp Security

Cập nhật ngày 01/11/2026. Giao diện đã được nâng cấp trên hệ thống đang chạy trong LAN/VPN, dùng API và phiên Keycloak hiện có.

Đã có API tìm kiếm trên toàn bộ audit/cảnh báo đã lưu, đồng bộ sự kiện Keycloak, chuông thông báo, quản lý nhân viên/role/nhóm/mật khẩu và từng phiên. Cách dùng nút mới ở [chức năng và API](CHUC_NANG_VA_API.md).

## Mở hệ thống

Trong cấu hình LAN hiện tại:

- Trang chọn ứng dụng: `https://10.0.103.227:8443/`.
- Workspace: `https://10.0.103.227:8443/a/`.
- Security: `https://10.0.103.227:8443/b/`.

Địa chỉ phụ thuộc IP máy chủ đã cấu hình. Khi đổi mạng, làm theo [hướng dẫn kết nối hai máy](KET_NOI_HAI_MAY.md). Máy thứ hai sử dụng cùng địa chỉ; tin cậy CA theo hướng dẫn trước khi nhập mật khẩu. Đăng nhập bằng tài khoản demo được cấp; mật khẩu nằm trong `.env` trên máy chủ.

Nếu trình duyệt vẫn hiển thị bản cũ, nhấn **Ctrl+F5**.

## Chọn chức năng

Trang đầu có hai thẻ ứng dụng và sáu liên kết đến chức năng cụ thể. Có thể lọc theo công việc hoặc tìm kiếm bằng tiếng Việt có dấu/không dấu. Các liên kết trước đăng nhập dẫn đến bước xác thực; quyền vẫn được kiểm tra tại ứng dụng và API.

Trong mỗi ứng dụng:

1. Dùng thanh điều hướng hoặc **Tất cả chức năng** để xem các công cụ theo quyền.
2. Nhấn **Ctrl+K** (hoặc **⌘K**) để tìm nhanh chức năng.
3. Bấm biểu tượng **Chọn ứng dụng** trên thanh trên cùng để chuyển Workspace ↔ Security bằng phiên SSO hiện tại.
4. Bấm **Làm mới dữ liệu** để lấy kết quả mới; thanh tiến trình xuất hiện khi đang tải.

Đường dẫn giữ trang đang xem qua hash, ví dụ `/b/#/accounts` hoặc `/a/#/team`. Có thể tải lại và dùng nút quay lại của trình duyệt. Chức năng ngoài quyền được chuyển về tổng quan; API tiếp tục kiểm tra quyền độc lập.

Trên điện thoại, mở **Mở menu** để điều hướng. Bảng dài cuộn ngang trong khung bảng; trang không bị tràn ngang. Hộp thoại hỗ trợ phím Escape, điều hướng bàn phím và trả focus khi đóng; thao tác đang lưu được giữ lại để chờ kết quả.

## Không gian quản trị

`admin01` vào Workspace thấy **Không gian quản trị**, gồm số nhân viên, đơn chờ duyệt, cảnh báo đang mở và tài khoản đang khóa. Các thẻ dẫn đến công việc tương ứng. Danh sách đơn trên tổng quan cho phép mở ngay hộp thoại duyệt; đơn của chính người quản trị được loại khỏi số đơn chờ mình duyệt.

Chức năng **Chấm công** giữ công việc cá nhân của admin tách khỏi trang điều hành. Nhân viên/quản lý vẫn có màn hình chấm công, lịch sử và đơn điều chỉnh theo quyền.

Security có tổng quan giám sát, thẻ truy cập nhanh, thời điểm lấy dữ liệu gần nhất và trạng thái kết nối Keycloak. Auditor được xem, đối chiếu cảnh báo/nhật ký; các thao tác ghi kết luận và xử lý tài khoản dành cho admin.

## Các luồng đã hoàn thiện trên giao diện

| Công việc | Thao tác |
|---|---|
| Tìm tài khoản | Tìm tên/tài khoản/nhóm không cần dấu; lọc vai trò và trạng thái khóa |
| Xử lý tài khoản | Chọn thu hồi phiên, khóa, mở hoặc yêu cầu MFA; xem tác động, ghi lý do và lưu |
| Theo dõi đồng bộ | Xem lịch sử; phân biệt thành công/chưa đồng bộ; mở thao tác thử đồng bộ lại khi cần |
| Điều tra cảnh báo | Lọc trạng thái/mức độ, mở ngữ cảnh, ghi chú và lưu kết luận; mở tài khoản liên quan |
| Tra cứu truy cập | Tìm tài khoản/đường dẫn/lý do/mã đối chiếu, lọc ALLOW/DENY, sắp xếp và xuất CSV |
| Bảng công | Tìm kiếm, sắp xếp, phân trang và xuất CSV theo tháng đã chọn |
| Đơn điều chỉnh | Kiểm tra thứ tự giờ vào/ra, giới hạn ngày, lý do; lọc đơn và xem kết quả phê duyệt |
| Duyệt đơn | Xem người gửi, nhóm, ngày và nội dung; ghi căn cứ duyệt/từ chối rồi cập nhật qua API |

Các biểu mẫu giữ nội dung khi API lỗi để người dùng có thể thử lại. Trạng thái `PARTIAL` được hiển thị là cần kiểm tra đồng bộ; không báo hoàn tất đồng bộ khi mới xử lý được một phần. Mở tài khoản vẫn cần Keycloak xác nhận theo quy tắc backend.

## Phạm vi dữ liệu

- Bảng tài khoản/bảng công lọc dữ liệu đã tải; CSV lấy các dòng phù hợp. Chọn 10, 20 hoặc 50 dòng mỗi trang.
- Nhật ký/cảnh báo/sự kiện đăng nhập tìm và phân trang trên toàn bộ lịch sử đã lưu tại máy chủ; CSV xuất tối đa 200 kết quả đầu theo bộ lọc/cách sắp xếp. Tổng quan vẫn dùng tối đa 100 sự kiện/cảnh báo mới nhất; lịch sử xử lý hiển thị 30 thao tác gần nhất.
- CSV có BOM UTF-8, giữ dấu tiếng Việt, escape dấu phẩy/dấu nháy/xuống dòng và vô hiệu hóa nội dung có thể trở thành công thức bảng tính. Chỉ xuất các trường được khai báo.
- Đã có tạo nhân viên, đổi role/nhóm ứng dụng và mật khẩu tạm thời. Yêu cầu MFA gửi required action cho Keycloak; kiểm thử OTP thực tế, LDAP và Python Detection vẫn theo tiến độ riêng.

## Cấu trúc để chỉnh sửa giao diện

| Tệp/thư mục | Nội dung |
|---|---|
| `shared/ui.jsx`, `shared/ui.css` | Khung trang, menu, tìm chức năng, hộp thoại, bảng, phân trang và các thẻ |
| `shared/admin.jsx`, `shared/admin.css` | Tài khoản, cảnh báo, nhật ký, lịch sử xử lý và biểu mẫu quản trị |
| `shared/data.mjs` | Chuẩn hóa tìm kiếm tiếng Việt, định dạng thời gian và xuất CSV |
| `shared/operations.jsx`, `shared/operations.css` | Thông báo, hồ sơ, từng phiên, tra cứu toàn bộ log và thống kê |
| `shared/api.mjs` | Gọi API, lỗi có thể phục hồi và làm mới token cho yêu cầu đọc |
| `web-a/src/AdminHome.jsx` | Trang tổng quan riêng cho admin của Workspace |
| `web-a/src/App.jsx`, `web-a/src/App.css` | Luồng chấm công, nhóm, đơn điều chỉnh và menu Workspace |
| `web-b/src/App.jsx`, `web-b/src/style.css` | Luồng giám sát, tổng quan và menu Security |
| `network/public/` | Trang chọn ứng dụng, tìm chức năng và bộ lọc trước đăng nhập |

Màu chính, nền, đường viền và bán kính dùng biến CSS trong `shared/ui.css`. Font hệ thống Segoe UI hỗ trợ tiếng Việt, không tải font từ dịch vụ ngoài. Hai ứng dụng dùng chung component quản trị để giữ hành vi và hình thức nhất quán.

Khi sửa frontend ở chế độ HTTPS LAN, build lại hai ứng dụng:

```powershell
Push-Location web-a
npm.cmd run build -- --base=/a/
Pop-Location
Push-Location web-b
npm.cmd run build -- --base=/b/
Pop-Location
```

Gateway phục vụ các tệp build và trang chọn ứng dụng từ ổ đĩa. Nếu thay mã `network/gateway.js`, cần khởi động lại tiến trình gateway.

## Kiểm thử và minh chứng

Đã build thành công Web A/B; **42/42 kiểm tra giao diện** trên Chrome, **4/4 kiểm thử tìm kiếm/CSV**, **73/73 kiểm thử backend** và **29/29 kiểm tra SSO/phân quyền/HTTPS**. Kết quả kiểm tra SSO sau nâng cấp lưu riêng trong `evidence/ui-upgrade/sso/`.

Kiểm tra giao diện bao gồm tìm kiếm không dấu, bộ lọc, tải CSV, phân trang, liên kết trực tiếp qua SSO, tạo/duyệt đơn, lưu kết luận cảnh báo, lỗi lưu có thể thử lại, khóa/mở tài khoản và quyền chỉ đọc auditor. Đã kiểm tra độ rộng 320, 390 và 768 px; không có lỗi JavaScript trong lượt chạy thành công.

```powershell
node --test tests/frontend.test.mjs
python -u tests/frontend_ui.py
$env:TEST_EVIDENCE_DIR = "$PWD/evidence/ui-upgrade/sso"
python -u tests/week3_sso.py
```

Bộ kiểm tra trình duyệt cần lab đang chạy và dependencies trong `tests/requirements.txt`. Kiểm tra UI dùng tài khoản demo, tạo đơn có lý do bắt đầu bằng **Kiểm thử nâng cấp giao diện**, ghi kết luận sự kiện mô phỏng và khóa/mở lại `employee02`; trạng thái tài khoản được hoàn nguyên. Chạy trên dữ liệu lab.

- [Kết quả 42 kiểm tra UI](../evidence/ui-upgrade/results.json).
- [Ảnh tổng quan admin](../evidence/ui-upgrade/03-admin-workspace.png).
- [Ảnh chọn chức năng](../evidence/ui-upgrade/04-workspace-functions.png).
- [Ảnh Security trên điện thoại](../evidence/ui-upgrade/10-security-mobile.png).
- [Kết quả kiểm tra SSO](../evidence/ui-upgrade/sso/browser-results.json).

Minh chứng được lưu cục bộ và Git bỏ qua theo cấu hình hiện tại.
