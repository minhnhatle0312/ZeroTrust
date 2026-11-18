# Kịch bản kiểm thử bảo mật và nghiệp vụ — Tuần 2

Phạm vi: **chỉ hệ thống lab IAM-ZEROTRUST và các tài khoản demo của dự án**. Dùng hướng dẫn [tuan2.md](../tuan2.md) để chạy dịch vụ. Kịch bản dưới đây tương ứng `backend/security.test.js` và `tests/week2_browser.py`.

## 1. Các nhóm kiểm thử

| Nhóm / mã | Cách thử | Kết quả mong đợi |
|---|---|---|
| AUTH-01/02 | Không có token / token rác | 401, không trả dữ liệu |
| AUTH-03 | Sửa một ký tự chữ ký JWT | 401 |
| AUTH expired | JWT hết hạn, ký bằng khóa kiểm thử hợp lệ | 401 |
| AUTH audience/issuer | Token ký đúng nhưng sai audience hoặc issuer | 401 |
| AUTH nbf/exp | Token chưa tới thời điểm dùng hoặc thiếu exp | 401 |
| AUTH-09 | JWT `alg:none` | 401 |
| AUTH-10 | JWT hợp lệ nhưng sub chưa có hồ sơ | 403 |
| AUTH-11 | JWT chứa admin nhưng hồ sơ local là employee | 403 |
| RBAC-01 | Employee gọi `/api/team`, `/api/admin/users`, `/api/security` | 403, cảnh báo vượt quyền |
| RBAC-02 | Auditor đọc security rồi thử khóa user | Đọc 200; khóa 403 |
| RBAC-03 | Manager gọi API quản trị tài khoản | 403 |
| IDOR-01 | Employee đổi query `userId` thành người khác | 403, không lộ bảng công |
| IDOR-02 | Manager01 gọi API nhóm | Chỉ Sản phẩm, không có Vận hành |
| IDOR-03 | Manager01 gửi PATCH duyệt đơn employee02 | 403, đơn giữ pending |
| IDOR-04/05 | Employee hoặc manager tự duyệt đơn | 403 |
| ATT-01 | Chấm công ra khi chưa vào | 409 |
| ATT-02 | Chấm công vào hợp lệ | 201, user và thời gian từ máy chủ |
| ATT-03 | Hai check-in đồng thời | Một 201, một 409; chỉ một bản ghi |
| ATT-04 | Check-out hai lần | Lần đầu 200, lần sau 409 |
| ATT-05 | Gửi thêm userId/checkIn/status/role ở check-in | 400 FIELD_NOT_ALLOWED; không tạo bản ghi |
| REQ-01/02 | Quản lý đúng nhóm duyệt/từ chối | Duyệt cập nhật bảng công; từ chối giữ nguyên |
| REQ-03 | Gửi lại quyết định cho đơn đã duyệt | 409 |
| REQ-04 | Hai đơn pending cùng người/cùng ngày | 409 |
| REQ-05 | Ngày tương lai, ngày không tồn tại, quá 31 ngày, giờ ngược, lý do ngắn | 400 |
| REQ-06 | Gửi status=approved hoặc reviewer_id vào đơn mới | 400; không được tự gán trạng thái |
| INJ-01 | Lý do chứa chuỗi SQL và thẻ HTML | Lưu dưới dạng văn bản; SQL không chạy; HTML không tạo phần tử thực thi |
| INPUT-01/02 | JSON lỗi hoặc body vượt 16 KiB | 400 / 413 |
| INPUT-03 | Month sai định dạng, audit limit quá lớn | 400 |
| CSRF-01 | Request có Origin khác, dù token hợp lệ | 403; dữ liệu không thay đổi |
| RATE-01 | Vượt số request/user/phút | 429 + Retry-After; mặc định 120, test hạ xuống 2 |
| AUDIT-01 | Mô phỏng lỗi ghi audit giữa giao dịch check-in | 503; rollback bản ghi công |
| AUDIT-02 | Truy cập sai role | Có audit + cảnh báo; không chứa token/password/body |
| ALERT-01/02 | Auditor/admin thay đổi kết luận điều tra | Auditor 403; admin 200 và có lý do |
| SESSION-01 | Thu hồi rồi dùng token cũ còn hạn | 401 SESSION_REVOKED |
| SESSION-02 | Khóa tài khoản rồi gọi API | 403 ACCOUNT_DISABLED |
| SESSION-03 | Keycloak lỗi lúc khóa | 202 PARTIAL, khóa local vẫn có hiệu lực |
| SESSION-04 | Keycloak lỗi lúc mở khóa | 202, local vẫn khóa |
| SESSION-05 | Mở khóa thành công | Cần token mới; token cũ vẫn bị từ chối |
| SESSION-06 | Admin tự khóa hoặc nhắm tài khoản admin | 403; thao tác này dùng Keycloak Console |
| MFA-01 | Admin yêu cầu MFA | Thu hồi token cũ; gửi yêu cầu CONFIGURE_TOTP |
| RACE-01 | Duyệt và từ chối cùng đơn đồng thời | Chỉ một quyết định thành công |
| RACE-02 | Mở tài khoản trong lúc khóa chưa xong | 409 ACTION_PENDING |
| WEEK-01 | Chọn tháng khác trên bảng công | Biểu đồ 7 ngày vẫn lấy đúng dữ liệu gần nhất |
| PERSIST-01 | Đóng và mở lại SQLite | Công, trạng thái khóa và mốc thu hồi còn nguyên |
| TIME-01 | Ngày chuyển theo UTC+7 và check-in trước/sau 08:00 | Đúng ngày Việt Nam và số phút muộn |
| Browser | Đăng nhập, tạo/duyệt đơn, XSS hiển thị, thu hồi, khóa/mở, MFA, mobile, check-out | Chạy với Keycloak thật; lưu ảnh và JSON kết quả |

Các token bất thường trong test backend được tạo bằng khóa test riêng, không dùng private key Keycloak thật. Test XSS dùng payload minh họa trong dữ liệu demo để xác nhận React hiển thị văn bản, không tấn công người khác.

## 2. Trình diễn vượt cấp phân quyền trực tiếp

Đăng nhập **employee01** ở `http://localhost:5173`, mở DevTools → Console. Đoạn dưới chỉ dùng trong Vite dev của dự án, lấy token từ phiên hiện tại và **không in token**:

```javascript
const { default: auth } = await import('/src/keycloak.js');
const response = await fetch('http://localhost:3001/api/admin/users', {
  headers: { Authorization: `Bearer ${auth.token}` }
});
console.log(response.status, await response.json());
```

Kết quả mong đợi: **403 / INSUFFICIENT_ROLE**. Sau đó đăng nhập **admin01 → Trung tâm bảo mật**, tìm cảnh báo “Vượt quyền chức năng”. Tại đây xem user, số lần, thời điểm và nhật ký liên quan.

Muốn thử chèn dữ liệu vào check-in, dùng cùng phiên employee:

```javascript
const result = await fetch('http://localhost:3001/api/attendance/check-in', {
  method: 'POST',
  headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'nguoi-khac', role: 'admin', checkIn: '2026-01-01T01:00:00Z' })
});
console.log(result.status, await result.json());
```

Kết quả **400 / FIELD_NOT_ALLOWED**, không sửa được danh tính, role hoặc thời gian. Chụp phần kết quả, không chụp/ghi token trong Network request headers.

## 3. Trình diễn thu hồi token còn hạn

1. Mở cửa sổ riêng tư thứ nhất, đăng nhập `employee02`.
2. Mở cửa sổ thứ hai, đăng nhập `admin01`.
3. Admin → Tài khoản & truy cập → Ngọc Linh/employee02 → Quản lý truy cập → Thu hồi phiên → ghi lý do → Xác nhận.
4. Ở cửa sổ employee02 bấm Làm mới dữ liệu. API từ chối phiên cũ; người dùng phải đăng nhập lại.
5. Xem nhật ký `REMEDIATION_REQUESTED`, `REMEDIATION_SYNCED` và `SESSION_REVOKED` khi có request token cũ.

Script browser giữ bản token cũ trong bộ nhớ phiên kiểm thử để thử chính xác token còn hạn; không ghi token ra file. Việc Keycloak logout đơn thuần không được dùng làm bằng chứng token JWT cũ đã mất hiệu lực; API có thêm mốc thu hồi riêng.

## 4. Thực hành điều tra và sửa tại admin

1. Xem sự kiện bị chặn, xác định đúng tài khoản và ngữ cảnh. `anonymous` không đủ để quy kết cho một user cụ thể.
2. Đánh dấu “Đang điều tra”, ghi căn cứ.
3. Nếu cần ngăn truy cập: thu hồi phiên hoặc khóa user. Nếu cần tăng bảo vệ tài khoản: yêu cầu MFA.
4. Quan sát kết quả đồng bộ. Trạng thái PARTIAL cần xử lý lại khi Keycloak sẵn sàng, không xem là đã hoàn tất phía Keycloak.
5. Kiểm thử lại: token cũ bị chặn; user khóa không gọi API được; user được mở phải đăng nhập mới.
6. Ghi kết luận, chuyển “Đã xử lý” hoặc “Đã xác minh hợp lệ”. Việc đóng cảnh báo không thay đổi quyền user.

Muốn hoàn tất MFA thủ công: admin chọn Yêu cầu MFA cho user demo → user đăng nhập lại → dùng ứng dụng OTP quét QR do Keycloak cung cấp → nhập mã và hoàn tất. Không chụp QR/secret OTP vào báo cáo. Muốn trở về trạng thái demo không OTP, quản trị trực tiếp Credentials/Required actions của user trong Keycloak sau khi kiểm thử.

## 5. Những khoảng trống đã xử lý khi phát triển tuần 2

| Khoảng trống / nguy cơ | Cách sửa | Bằng chứng |
|---|---|---|
| JWT chỉ kiểm tra chữ ký có thể còn dùng sau thao tác logout/khóa bên ngoài | Mốc thu hồi và trạng thái khóa local; phối hợp logout/disable Keycloak | SESSION-01..05 và browser dùng token thật |
| Mở rộng RBAC đơn thuần chưa đủ ngăn truy cập khác nhóm | Ràng buộc sub → staff → team; scope ở backend | IDOR-01..05 |
| Thêm chức năng ghi dữ liệu có thể commit trước khi middleware ghi log thất bại | Công/đơn và audit cùng transaction SQLite | AUDIT-01 |
| Request thay đổi giờ hoặc tự gán trạng thái | Allowlist trường, timestamp server, workflow duyệt | ATT-05, REQ-06 |
| Hai admin gửi thao tác khóa/mở đồng thời | Khóa logic theo user trong bảng actions, không cho hai pending | RACE-02 |
| Có thể báo thành công dù Keycloak thất bại | Trạng thái pending/partial/synced và giữ chặn local | SESSION-03/04 |

Đây là các biện pháp và kiểm chứng trong phạm vi app, không phải danh sách CVE được phát hiện bằng scanner. Backend tuần 1 chưa có nghiệp vụ ghi công; nguy cơ transaction được xử lý khi thêm nghiệp vụ tuần 2, không khẳng định đã có sự cố mất audit trước đó.

## 6. Đọc và tái chạy kết quả

- Chạy `npm.cmd test` trong `backend`: test độc lập, không cần Docker, không ghi vào DB chạy thật.
- Chạy `python tests/week2_browser.py` từ thư mục gốc: cần Docker, backend và Vite đang chạy; dùng tài khoản demo thật.
- Đọc `evidence/week2/backend-tests.tap`, `evidence/week2/browser-results.json` và các PNG.
- Ảnh chụp và số lượng pass chỉ chứng minh đúng lượt chạy đó. Các lần test sau có thể phát sinh thêm log/đơn demo.
- Quét gói: `npm.cmd audit --omit=dev` trong backend và `npm.cmd audit` trong web-a. Kết quả advisory thay đổi theo thời gian; 0 advisory không đồng nghĩa ứng dụng không có lỗ hổng logic.
