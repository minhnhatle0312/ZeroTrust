# Sử dụng Web A và Web B

Chỉ thao tác trên dữ liệu bạn được phép xử lý. Không dùng tài khoản/dữ liệu thật để thử các ca khóa, revoke, đổi quyền hoặc tạo lỗi. Quyền cụ thể: [ma trận chức năng](CHUC_NANG_VA_API.md).

## Đăng nhập và điều hướng

1. Mở đúng origin đã được vận hành: localhost development hoặc `/a/`, `/b/` qua HTTPS gateway. Bấm **Đăng nhập qua Keycloak**; nhập mật khẩu/OTP tại Keycloak.
2. Chờ Backend xác nhận profile/role. Không đủ quyền, cần hoàn tất MFA, hết phiên hoặc mất kết nối có màn hình riêng. Retry chỉ sau khi dịch vụ đã được kiểm tra; không chuyển sang cơ chế đăng nhập khác.
3. Sidebar hoặc menu điện thoại chọn chức năng; **Ctrl+K** tìm nhanh. Có skip-link, focus, Escape để đóng dialog. Chọn ứng dụng dùng phiên SSO cùng hồ sơ trình duyệt, không sao chép token.
4. Đăng xuất qua nút ứng dụng. Nếu logout lỗi, trạng thái chưa xác nhận kết thúc SSO phải được xử lý trước khi coi phiên đã đóng.

## Web A — công việc hằng ngày

- **Tổng quan / Chấm công:** xem trạng thái và chấm vào/ra; kết thúc ca có bước xác nhận. Thời gian chính thức do Backend quyết định.
- **Bảng công:** chọn tháng, tìm/lọc, sắp xếp, phân trang và xuất CSV theo phạm vi được ghi trên trang. Trên mobile cuộn vùng bảng, không kéo toàn trang.
- **Đơn điều chỉnh:** chọn ngày/giờ hợp lệ, lý do; gửi sau validation. Lỗi API giữ nội dung để sửa; chỉ rút đơn pending của chính mình sau xác nhận.
- **Quản lý nhóm:** manager/admin xem phạm vi được cấp, tìm nhân viên và duyệt/từ chối đơn. Không tự duyệt hoặc chuyển user ID để xem dữ liệu ngoài phạm vi.
- **Quyền truy cập / Duyệt quyền:** yêu cầu/phê duyệt theo đối tượng, thời hạn và lý do; đây là thao tác ghi dữ liệu.
- **Hồ sơ & phiên:** kiểm tra trạng thái MFA, phiên và thiết bị đã ghi; đăng ký TOTP ở Keycloak. Kết thúc phiên hiện tại yêu cầu đăng nhập lại.
- Admin có công cụ nhân viên/bảo mật; quản trị tài khoản thực hiện theo quy trình được phép, không phải một bước thử giao diện.

## Web B — quan sát và điều tra

**Dashboard:** thẻ tổng quan và cảnh báo gần đây mở đúng hồ sơ. SQLite và PostgreSQL là hai kho; không cộng thành số sự cố duy nhất vì một hoạt động có thể được cả hai ghi nhận.

**Cảnh báo / Audit:** chọn kho, lọc trạng thái/mức độ/nguồn/mốc thời gian, tìm kiếm và phân trang. SQLite tìm máy chủ; incident PostgreSQL tìm trong trang. CSV incident chỉ xuất dòng đang hiển thị. Audit PostgreSQL chuẩn bị CSV riêng có giới hạn. Khi nguồn lỗi, không có dữ liệu giả thay thế.

**Detection:** Normal không chứng minh an toàn; Anomaly là tín hiệu điều tra. Xem rule/features và log gốc; nhãn/metrics phải có căn cứ độc lập. Auditor được gán nhãn theo chính sách cũ, nhưng không được ghi incident. Không bấm chạy batch/cấu hình/collector trên lab để thử.

**Hồ sơ sự cố:** sáu phần tổng quan, nguồn/bằng chứng, timeline/history, nguyên nhân, đề xuất và kết quả. Mã ref mở bằng chứng; lịch sử tải thêm bằng con trỏ. Thông tin thiếu hiển thị “chưa ghi nhận”; không suy ra nguyên nhân từ cùng IP hoặc tên.

**Admin — Cập nhật điều tra:**

1. Chọn loại cập nhật; ghi chú 10–500 ký tự. Nội dung/phương pháp 10–1000 ký tự; không nhập credential.
2. Ghi nhận nhận định với mức giả thuyết hoặc mức có citation. Bổ sung đề xuất mới thay vì ghi đè đề xuất cũ.
3. Liên kết `action:<id>` SQLite hoặc `audit:<event_id>` PostgreSQL đã có thật. Kết quả/người/thời gian lấy từ nguồn, không tự khai thành công.
4. Kiểm chứng bằng probe đã ghi thật sau sự kiện/hành động, lựa chọn kết quả và ALLOW/DENY mong đợi phù hợp nội dung kiểm tra. Backend có thể từ chối mã ngoài phạm vi, timestamp không phù hợp hoặc hành động partial.
5. Kiểm tra bản tóm tắt rồi **Xác nhận lưu hồ sơ**. Đóng chỉ gửi yêu cầu; chờ đọc lại `resolution.verified`. Trạng thái cũ resolved không tự được coi là đã xác minh.
6. Nếu 409: giữ draft, đọc version/history mới, đối chiếu, xác nhận đã đối chiếu rồi mới gửi lại có chủ ý. Nếu 5xx/mất phản hồi: có thể đã commit; đọc lại trước quyết định tiếp theo, không gửi lặp.

Auditor đọc hồ sơ nhưng không có editor. API không có trạng thái processing/awaiting-verification riêng; diễn tiến đó vẫn thuộc reviewing với ghi chú/verification. Chi tiết: [quy trình sự cố](API_VA_QUY_TRINH_SU_CO.md).

## Trạng thái và lỗi

Loading/rỗng/lỗi quyền khác nhau. Bản nháp giữ trong bộ nhớ khi API lỗi, không lưu bền qua đóng tab/phiên kết thúc. Bỏ draft có xác nhận. Không coi toast của lần lưu trước là kết quả thao tác mới; trạng thái hiện hành phải đọc lại từ Backend. Giới hạn còn lại: [danh sách lỗi](LOI_VA_GIOI_HAN.md).
