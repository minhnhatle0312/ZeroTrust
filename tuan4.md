# Tuần 4 — Web B và SSO

Giai đoạn 3 của [kế hoạch](tiendo.md). Cập nhật ngày **01/11/2026**.

**Kết quả đã xác nhận:** 73/73 test backend đạt, 29/29 kiểm tra trình duyệt đạt, build cả hai Web thành công. Lượt kiểm thử HTTPS LAN hoàn tất lúc **13:05:37 ngày 01/11/2026 (UTC+7)**, lưu 11 ảnh và [JSON kết quả](evidence/week3/browser-results.json). Người dùng đã xác nhận máy thứ hai nhận được phản hồi HTTPS với cảnh báo chứng chỉ; bước tin cậy CA và đăng nhập thực tế trên thiết bị đó chưa được xác nhận.

## Phần triển khai

- Web B độc lập tại `web-b`, React/Vite, giao diện Nhịp Security; có tổng quan, cảnh báo, nhật ký và quản lý tài khoản theo vai trò.
- OIDC client `security-dashboard`, public client, Authorization Code + PKCE S256; audience riêng `security-api`. Web A tiếp tục dùng `employee-portal` / `employee-api`.
- Backend xác minh chữ ký, issuer, thời hạn, client phát hành (`azp`), audience đúng với client, hồ sơ nhân viên và vai trò. Token Web B không được dùng cho nghiệp vụ chấm công.
- Admin và auditor được sử dụng Web B; employee/manager bị từ chối tại UI và API. Auditor chỉ xem; các thao tác ghi vẫn yêu cầu admin và lý do.
- Link chuyển ứng dụng ở cả hai Web; SSO hai chiều trong cùng trình duyệt bằng phiên Keycloak chung, mỗi client giữ token riêng trong bộ nhớ.
- Theo dõi single logout: backend đối chiếu `sid` với phiên Keycloak thật, cache tối đa 5 giây; frontend kiểm tra mỗi 15 giây và khi focus. Không xem việc xóa token một tab là đã thu hồi mọi JWT.
- HTTPS gateway phục vụ hai ứng dụng tại `/a/`, `/b/`, chuyển tiếp API và các endpoint xác thực Keycloak qua một địa chỉ LAN/VPN. Backend/JWKS/Admin API kết nối Keycloak qua loopback; issuer vẫn phải khớp địa chỉ HTTPS công khai của lab.

## Chạy trên một máy

Cài dependencies của backend, Web A, Web B bằng `npm.cmd ci`, tạo `.env` bằng `python scripts/init_env.py`, mở Docker Desktop, sau đó:

```powershell
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Web A: `http://localhost:5173/`. Web B: `http://localhost:5174/`. Runner chuẩn bị Keycloak và hai client, khởi động ba tiến trình ứng dụng. Chỉ chạy một runner; dừng các terminal backend/frontend cũ trước để tránh trùng cổng.

## Chạy trên hai máy

Làm theo [hướng dẫn LAN/VPN và chứng chỉ](docs/KET_NOI_HAI_MAY.md). Với IP Wi-Fi hiện tại của máy chủ:

```powershell
python scripts/configure_network.py --host 10.0.103.227
python scripts/run_week3.py --network
```

Máy thứ hai mở `https://10.0.103.227:8443/`. Phải tin cậy CA riêng của lab và truy cập được cổng TCP 8443. SSO không chia sẻ cookie giữa hai máy; người dùng đăng nhập riêng trên từng trình duyệt.

## Kiểm thử

```powershell
cd backend
npm.cmd test
cd ..
python -m pip install --no-user --target .tools -r tests/requirements.txt
python tests/week3_sso.py
```

Bộ backend gồm 54 test trước đó và 19 test mới về client/audience, Web B, CORS, trạng thái phiên, lỗi Keycloak và cache. Bộ trình duyệt chạy trên hệ thống thật đang hoạt động, lưu kết quả vào `evidence/week3/browser-results.json` và ảnh PNG. Chỉ coi lượt chạy thành công khi `success: true` và mọi check đều đạt.

Các lượt kiểm thử localhost tuần 1–2 vẫn là bằng chứng lịch sử, không được dùng thay kết quả SSO tuần 4. Script trình duyệt tuần 2 chỉ phù hợp chế độ localhost; không chạy khi hệ thống đang cấu hình URL LAN. Trong lượt HTTPS tự động, trình duyệt kiểm thử bỏ qua tin cậy chứng chỉ lab; script đồng thời kiểm tra chuỗi chứng chỉ và SAN bằng CA đã tạo. Người dùng thật phải cài đúng CA, không tắt xác minh TLS.

## Giới hạn

Keycloak vẫn dùng `start-dev` phía sau reverse proxy HTTPS; đây là lab nội bộ. API phụ thuộc kết nối Keycloak để xác nhận phiên. Tab nền bị trình duyệt đình chỉ có thể nhận thông báo logout chậm; API vẫn kiểm tra khi có yêu cầu tiếp theo. Hệ thống chưa triển khai Web B ở máy chủ thứ hai độc lập, LDAP, SSO liên trình duyệt, MFA OTP đầy đủ hoặc dịch vụ audit PostgreSQL tách biệt.

Các thao tác điều tra, khóa/mở, thu hồi và yêu cầu MFA tiếp tục theo quy tắc của [tuần 2](tuan2.md); đóng cảnh báo chỉ lưu kết luận. Thêm Web B không tự hoàn tất các giai đoạn LDAP, JCL, Python Detection hoặc MFA.
