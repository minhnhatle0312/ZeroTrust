# Kết nối hai máy trong LAN hoặc VPN riêng

Máy 1 chạy Keycloak, PostgreSQL, backend, Web A và Web B. Máy 2 chỉ cần trình duyệt và kết nối tới máy 1. Cả hai máy dùng chung dữ liệu và chính sách quyền; mỗi trình duyệt có phiên đăng nhập riêng.

SSO cho phép chuyển Web A ↔ Web B trong **cùng trình duyệt và cùng hồ sơ trình duyệt** mà không nhập lại mật khẩu khi phiên Keycloak còn hiệu lực. Đăng nhập trên máy 1 không tự đăng nhập trình duyệt ở máy 2.

## 1. Chuẩn bị trên máy chủ

Yêu cầu: Docker Desktop đang chạy, Node.js 22.19+, Python 3.11+, OpenSSL. Git for Windows đã kèm OpenSSL tại `C:\Program Files\Git\usr\bin\openssl.exe`.

Trong thư mục dự án, cài thư viện nếu chưa có:

```powershell
cd D:\IAM-ZeroTrust
python scripts/init_env.py
cd backend
npm.cmd ci
cd ..\web-a
npm.cmd ci
cd ..\web-b
npm.cmd ci
cd ..
```

Dùng `ipconfig` để lấy IPv4 của adapter Wi-Fi/Ethernet đang có Default Gateway. Không chọn adapter WSL, VMware hoặc địa chỉ `127.0.0.1`.

Với IP Wi-Fi hiện tại của máy dự án:

```powershell
python scripts/configure_network.py --host 10.0.130.254
python -c "import sys;sys.path.insert(0,'scripts');from setup_week3 import configure;configure()"
python scripts/run_week10.py --network
```

Lệnh cấu hình tạo chứng chỉ và khóa trong `network/.local`, đồng thời cập nhật các tệp `.env` cục bộ. Mật khẩu, dữ liệu PostgreSQL và SQLite được giữ lại. Lệnh chạy đồng bộ cấu hình hai OIDC client, build Web A/B và giữ API/HTTPS gateway hoạt động; giữ terminal mở. Ctrl+C dừng các tiến trình ứng dụng của lượt chạy, container Docker vẫn chạy.

Các địa chỉ dùng trên cả hai máy:

| Địa chỉ | Chức năng |
|---|---|
| `https://10.0.130.254:8443/` | Trang chọn ứng dụng |
| `https://10.0.130.254:8443/a/` | Web A — Nhịp Workspace |
| `https://10.0.130.254:8443/b/` | Web B — Nhịp Security |

IP có thể đổi khi chuyển mạng hoặc nhận lại DHCP. Khi đó dừng runner, chạy lại `configure_network.py --host IP_MOI` và khởi động lại. Với VPN riêng, dùng địa chỉ VPN của máy chủ; hai thiết bị phải truy cập được địa chỉ đó. Có thể dùng tên DNS nội bộ đã được cả hai máy phân giải đúng.

## 2. Tin cậy chứng chỉ lab trên mỗi máy

Chỉ chuyển **`network/.local/ca.crt`** từ máy chủ sang máy khách, ví dụ qua USB hoặc thư mục chia sẻ nội bộ. Đối chiếu SHA-256 qua kênh tin cậy trước khi cài:

```powershell
certutil -hashfile .\ca.crt SHA256
```

Trên Windows của từng máy, mở `ca.crt` → **Install Certificate** → **Current User** → **Place all certificates in the following store** → **Trusted Root Certification Authorities**. Đóng và mở lại trình duyệt nếu cần. Có thể dùng lệnh tương đương trong PowerShell:

```powershell
certutil -user -addstore Root .\ca.crt
```

Đây là CA riêng của lab. Chỉ cài khi đã xác nhận đúng CA của máy chủ; không chuyển hoặc công khai `ca.key`, `server.key`, `.env` hay thư mục dữ liệu. Có thể gỡ CA khi kết thúc lab bằng `certmgr.msc` trong kho Current User → Trusted Root Certification Authorities.

HTTPS cần thiết cho Web Crypto/PKCE khi truy cập bằng địa chỉ LAN. Không chuyển sang HTTP qua IP LAN hoặc tắt kiểm tra chữ ký JWT để xử lý lỗi chứng chỉ.

## 3. Cho phép kết nối tới cổng HTTPS

Máy khách chỉ cần kết nối TCP **8443** tới máy chủ. API 3001 và Keycloak 8080 vẫn bind loopback; PostgreSQL không công khai ra máy khách.

Nếu Windows Firewall đang chặn, trên **máy chủ**, mở PowerShell bằng quyền quản trị và tạo quy tắc giới hạn mạng Private và LocalSubnet:

```powershell
New-NetFirewallRule -DisplayName 'Nhip IAM HTTPS LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -Profile Private -RemoteAddress LocalSubnet
```

Chỉ áp dụng khi mạng LAN đã được thiết lập là mạng riêng tin cậy. Với VPN, giới hạn `-RemoteAddress` theo subnet/IP VPN thực tế của hai máy và chọn profile thích hợp với adapter VPN. Không cần mở PostgreSQL, API 3001, Keycloak 8080 hoặc chuyển tiếp cổng trên router.

Máy khách có thể kiểm tra đường truyền:

```powershell
Test-NetConnection 10.0.130.254 -Port 8443
```

Nếu không kết nối được: kiểm tra cùng LAN/VPN, đúng IP, runner còn hoạt động, firewall, VPN route và chế độ client isolation trên Wi-Fi. Một số mạng trường/công cộng chặn kết nối trực tiếp giữa thiết bị; khi đó dùng LAN riêng hoặc VPN được phép.

## 4. Đăng nhập và trình diễn SSO

Mật khẩu demo được lưu trên máy chủ trong `.env`; không đưa tệp này lên Git hoặc gửi toàn bộ tệp cho máy khách. Cấp tài khoản demo và mật khẩu tương ứng cho người thử theo nhu cầu.

| Tài khoản | Web A | Web B |
|---|---|---|
| `employee01`, `employee02` | Chấm công cá nhân | Bị từ chối |
| `manager01`, `manager02` | Cá nhân và quản lý nhóm | Bị từ chối |
| `auditor01` | Cá nhân và xem bảo mật | Xem cảnh báo, nhật ký; không xử lý tài khoản |
| `admin01` | Quản trị | Điều tra và xử lý tài khoản theo quyền |

1. Mở `/a/`, đăng nhập `admin01` hoặc `auditor01`.
2. Bấm **Chọn ứng dụng** ở thanh trên cùng, chọn **Nhịp Security**, hoặc mở `/b/` trong tab khác của cùng trình duyệt. Keycloak cấp token riêng cho Web B từ phiên SSO đang có.
3. Trong **Chọn ứng dụng**, chọn **Nhịp Workspace** để quay lại Web A. Trang đầu `/` cũng có các thẻ ứng dụng và chức năng; hướng dẫn chi tiết ở [giao diện nâng cấp](NANG_CAP_GIAO_DIEN.md).
4. Đăng xuất một Web. Tab còn lại đang hoạt động sẽ phát hiện phiên kết thúc qua kiểm tra định kỳ hoặc khi trở lại tab; dữ liệu được thay bằng màn hình yêu cầu đăng nhập lại. Với chế độ `login-required` hiện tại, keycloak-js chuyển tab này về trang đăng nhập Keycloak.
5. Kiểm tra với `employee01`: Web A vẫn hoạt động, Web B hiển thị từ chối và backend cũng trả HTTP 403 cho token Web B của tài khoản này.

Backend kiểm tra trạng thái phiên Keycloak với cache tối đa 5 giây. Tab hiển thị kiểm tra lại mỗi 15 giây và khi focus/visibility thay đổi; tab bị trình duyệt tạm dừng có thể cập nhật muộn hơn. Token cũ không tự có hiệu lực trở lại sau khi đăng nhập tạo phiên mới. Nếu Keycloak không liên lạc được, API trả 503 cho đến khi xác minh được phiên.

## 5. Trở về chế độ localhost

Dừng runner mạng trước, rồi:

```powershell
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Web A trở về `http://localhost:5173`, Web B ở `http://localhost:5174`; Keycloak ở `http://localhost:8080`. Các URI của client và issuer được đồng bộ lại. Không dùng lẫn URL localhost với URL LAN trong cùng lượt cấu hình.

## Phạm vi

Cổng HTTPS là reverse proxy trong lab, chưa phải bộ triển khai production. Chưa có chứng chỉ CA công cộng, HA, sao lưu tự động hay log bất biến. Không đưa cổng này ra Internet. Việc truy cập từ máy vật lý thứ hai cần được kiểm tra tại mạng thực tế của nhóm; kiểm thử trình duyệt trên máy chủ không thay thế kiểm tra đó.

Đối chiếu kỹ thuật: [Keycloak hostname](https://www.keycloak.org/server/hostname), [reverse proxy và header](https://www.keycloak.org/server/reverseproxy), [JavaScript adapter và giới hạn phát hiện logout](https://www.keycloak.org/securing-apps/javascript-adapter).
