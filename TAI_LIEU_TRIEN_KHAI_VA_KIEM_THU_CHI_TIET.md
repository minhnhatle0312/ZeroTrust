# IAM-ZeroTrust — Tài liệu triển khai, vận hành và tái hiện lỗi

Ngày tổng hợp: **04/11/2026, giờ Việt Nam (UTC+7)**.

Tài liệu này tổng hợp những phần đã triển khai trong mã nguồn hiện tại, cách chạy từ đầu, cách sử dụng từng chức năng, cách chủ động tạo tình huống lỗi để kiểm tra cơ chế chặn và cách tìm nguyên nhân. Nội dung bao gồm nền tảng các tuần trước, **tuần 4 — Web B và SSO**, cùng các phần giao diện/API đã bổ sung.

Các bước gây lỗi dưới đây dùng hệ thống lab và tài khoản demo của dự án. Một phản hồi từ chối đúng kỳ vọng, ví dụ employee gọi API admin nhận 403, là **kiểm thử thành công**. Chỉ coi là lỗi bảo mật nếu yêu cầu đó được phép hoặc làm thay đổi dữ liệu trái quyền.

> Cập nhật mã tuần 5 sau mốc tổng hợp tài liệu này: xem [triển khai tuần 5](docs/TUAN_5_TRIEN_KHAI.md). Các mô tả/số test bên dưới phản ánh mốc trước thay đổi tuần 5; mã mới chưa kiểm thử theo yêu cầu.

## 1. Tổng quan và phạm vi

### 1.1. Hệ thống đã làm được gì?

| Nhóm | Đã triển khai | Kết quả sử dụng |
|---|---|---|
| Hạ tầng | Keycloak và PostgreSQL chạy bằng Docker Compose, volume và healthcheck | Lưu danh tính, realm, client, role và cấu hình IAM |
| Danh tính | Realm `company-iam`, 4 role, 6 tài khoản demo, 2 nhóm nghiệp vụ | Kiểm tra quyền theo người dùng và theo nhóm |
| Web A | React/Vite, giao diện Nhịp Workspace | Chấm công, bảng công, tạo/rút đơn, quản lý nhóm, quản trị theo quyền |
| Web B | React/Vite độc lập, giao diện Nhịp Security | Tổng quan an ninh, cảnh báo, nhật ký, xác thực, quản lý tài khoản |
| OIDC | Hai public client, Authorization Code + PKCE S256, audience riêng | Mỗi ứng dụng tự nhận token từ Keycloak |
| API | Node.js/Express, JWT RS256/JWKS, kiểm tra claim, hồ sơ, role và phiên | Chặn token sai, truy cập trái quyền, khác nhóm hoặc khác ứng dụng |
| SSO | Chuyển A → B và B → A trong cùng hồ sơ trình duyệt | Không nhập lại mật khẩu khi phiên Keycloak còn hiệu lực |
| Đăng xuất | Mốc thu hồi cục bộ và kiểm tra phiên Keycloak thật | API chặn token của phiên đã kết thúc dù JWT còn hạn |
| Truy cập mạng | HTTPS gateway cho `/a/`, `/b/`, API và endpoint xác thực | Hai máy trong LAN/VPN có thể truy cập cùng hệ thống |
| Lưu trữ ứng dụng | SQLite, transaction, khóa ngoại, unique index, WAL | Lưu bảng công, đơn, hồ sơ, audit, cảnh báo, thao tác và thông báo |
| Quản trị | Tạo nhân viên, đổi hồ sơ/nhóm/role, mật khẩu tạm thời | Đồng bộ sang Keycloak, yêu cầu đăng nhập lại sau thay đổi |
| Kiểm soát truy cập | Khóa/mở tài khoản, thu hồi toàn bộ phiên, kết thúc từng phiên | Admin xử lý; người dùng quản lý phiên của chính mình |
| MFA | Admin yêu cầu `CONFIGURE_TOTP` và thu hồi phiên cũ | Đã có bước yêu cầu cấu hình, chưa hoàn tất kiểm thử OTP toàn hệ thống |
| Audit | Ghi ALLOW/DENY, mã HTTP, người dùng, đường dẫn, request ID | Điều tra và đối chiếu các bước của cùng yêu cầu |
| Sự kiện Keycloak | Collector chạy mỗi 30 giây, có đồng bộ thủ công | Nhập các loại sự kiện được chọn và tạo cảnh báo đăng nhập thất bại |
| Thông báo | Phạm vi cá nhân/bảo mật, số chưa đọc, trạng thái đọc riêng | Nhận kết quả duyệt đơn, cập nhật tài khoản và cảnh báo |
| Giao diện | Tìm không dấu, lọc, sắp xếp, phân trang, CSV, Ctrl+K, menu mobile | Dùng được trên máy tính và điện thoại |
| Kiểm thử | Backend, tiện ích frontend/API client và trình duyệt thật | Có biên bản, ảnh và các kịch bản tái hiện |

### 1.2. Những phần chưa được coi là hoàn tất

- Chưa có LDAP/Active Directory federation; nhóm hiện được lưu ở ứng dụng.
- Chưa có module Python Detection và đánh giá Precision/Recall/F1.
- Chưa có dịch vụ audit PostgreSQL tập trung; PostgreSQL hiện phục vụ Keycloak, audit ứng dụng nằm ở SQLite.
- Chưa thu thập đầy đủ mọi Admin Event do thay đổi trực tiếp trên Keycloak Console.
- Chưa hoàn tất đăng ký thiết bị TOTP, kiểm thử OTP đúng/sai/thiếu/hết hạn cho toàn hệ thống.
- Chưa kiểm thử đầy đủ mọi nhánh vòng đời refresh token.
- Chưa triển khai Web B trên máy chủ ứng dụng thứ hai độc lập.
- Máy khách thứ hai đã có xác nhận truy cập HTTPS đến mức xuất hiện cảnh báo chứng chỉ; bước tin cậy CA và đăng nhập thực tế trên máy đó chưa được xác nhận trong biên bản hiện có.
- Keycloak đang chạy `start-dev` sau reverse proxy HTTPS; đây là cấu hình lab nội bộ.

### 1.3. Quy ước tuần và tên script

Trong kế hoạch, **Giai đoạn 2 là tuần 3 — Web A/RBAC**, **Giai đoạn 3 là tuần 4 — Web B/SSO**. Tên `setup_week3.py`, `run_week3.py`, `tests/week3_sso.py` và thư mục `evidence/week3` là tên kỹ thuật lịch sử của phần triển khai giai đoạn 3. Khi viết báo cáo tuần 4 vẫn dùng các script này.

Không đổi tên script để chạy theo số tuần. File báo cáo tương ứng là [BaoCaoTuan4_LeMinhNhat_NguyenMinhTuan.docx](word/BaoCaoTuan4_LeMinhNhat_NguyenMinhTuan.docx).

## 2. Kiến trúc, luồng xử lý và vị trí mã nguồn

### 2.1. Kiến trúc khi chạy localhost

```text
Trình duyệt
  ├─ Web A: http://localhost:5173
  ├─ Web B: http://localhost:5174
  ├─ Đăng nhập → Keycloak: http://localhost:8080
  └─ Bearer token → Backend: http://localhost:3001
                         ├─ SQLite: dữ liệu ứng dụng và audit
                         └─ Keycloak Admin API/JWKS: loopback 8080

Docker Compose
  ├─ iam-keycloak: cấp danh tính, token, quản lý phiên
  └─ iam-postgres: lưu dữ liệu Keycloak trên volume postgres_data
```

### 2.2. Kiến trúc khi chạy LAN/VPN

```text
Máy chủ và máy khách
  └─ https://IP_MAY_CHU:8443
        └─ network/gateway.js
             ├─ /               → trang chọn ứng dụng
             ├─ /a/             → web-a/dist
             ├─ /b/             → web-b/dist
             ├─ /api/*, /health → backend loopback 3001
             └─ /realms/*,
                /resources/*    → Keycloak loopback 8080
```

Máy khách chỉ cần trình duyệt, CA của lab và đường mạng đến cổng gateway. Dữ liệu vẫn nằm trên máy chủ. Đăng nhập trên máy chủ không tự đăng nhập máy khách; cookie SSO thuộc từng hồ sơ trình duyệt.

### 2.3. Bản đồ mã nguồn

| Tệp/thư mục | Chức năng thực tế |
|---|---|
| `docker-compose.yml` | PostgreSQL 17, Keycloak 26.8.0, network, volume, healthcheck |
| `keycloak/lab-config.json` | Realm, role, client Web A và sáu hồ sơ demo |
| `scripts/init_env.py` | Bổ sung cấu hình/mật khẩu còn thiếu, không in mật khẩu |
| `scripts/setup_keycloak.py` | Khởi tạo/đối chiếu realm, role, user, client và sự kiện |
| `scripts/setup_week2.py` | Chính sách mật khẩu, brute-force, service account, seed hồ sơ |
| `scripts/setup_week3.py` | Hai client, PKCE, scope và audience tương ứng |
| `scripts/configure_network.py` | Chuyển localhost/LAN, sinh chứng chỉ, cập nhật URL |
| `scripts/run_week3.py` | Khởi động Docker, chờ Keycloak, setup rồi chạy API và hai Web/gateway |
| `backend/server.js` | Nạp env, mở SQLite, seed hồ sơ còn thiếu, tạo verifier và collector |
| `backend/auth.js` | JWT/client/audience và cache kiểm tra phiên Keycloak |
| `backend/app.js` | Middleware xác thực, nghiệp vụ công/đơn, RBAC, xử lý lỗi |
| `backend/operations.js` | Quản trị hồ sơ, phiên, thông báo, truy vấn log và đồng bộ |
| `backend/keycloak-admin.js` | Client credentials và các thao tác Admin API |
| `backend/identity-events.js` | Collector sự kiện xác thực được chọn |
| `backend/store.js` | Schema SQLite, transaction, audit, cảnh báo và thông báo |
| `backend/audit.js` | Thành phần JSONL cũ; luồng nghiệp vụ hiện tại ghi SQLite qua `store.js` |
| `web-a/src/` | Nhịp Workspace và tổng quan admin |
| `web-b/src/` | Nhịp Security và kiểm soát quyền vào Web B |
| `shared/sso.js` | Theo dõi phiên 15 giây/focus, làm mới token và phát hiện logout |
| `shared/api.mjs` | Gọi API, giữ mã lỗi/request ID, chỉ tự thử lại GET ở nhánh cho phép |
| `shared/ui.*`, `shared/admin.*`, `shared/operations.*` | Component dùng chung cho hai Web |
| `shared/data.mjs` | Tìm tiếng Việt, thời gian và xuất CSV |
| `network/gateway.js` | TLS, proxy, host chuẩn, phục vụ bản build, giới hạn đường dẫn |
| `network/public/` | Trang chọn ứng dụng trước đăng nhập |
| `tests/`, `backend/*.test.js` | Các bộ kiểm thử tự động |
| `evidence/` | Kết quả, ảnh và biên bản cục bộ |

Các thư mục `ldap`, `audit-service`, `python-detector` chưa có triển khai tương ứng để đưa vào luồng chạy hiện tại.

## 3. Chuẩn bị môi trường và tài khoản

### 3.1. Công cụ

- Windows/PowerShell, Docker Desktop có Engine hoạt động.
- Node.js **22.19 trở lên** để chạy backend dùng `node:sqlite`.
- Python **3.11 trở lên** để chạy script cấu hình và kiểm thử.
- Chrome để chạy bộ kiểm thử trình duyệt hiện tại.
- OpenSSL nếu dùng HTTPS LAN; Git for Windows thường có tại `C:\Program Files\Git\usr\bin\openssl.exe`.

Kiểm tra trong terminal:

```powershell
cd D:\IAM-ZeroTrust
node --version
npm.cmd --version
python --version
docker --version
docker compose version
docker info
```

`docker info` phải kết nối được Engine. Nếu báo lỗi daemon, mở Docker Desktop và đợi sẵn sàng trước khi chạy tiếp.

### 3.2. Cài dependencies và tạo cấu hình

```powershell
cd D:\IAM-ZeroTrust
python scripts/init_env.py
Push-Location backend
npm.cmd ci
Pop-Location
Push-Location web-a
npm.cmd ci
Pop-Location
Push-Location web-b
npm.cmd ci
Pop-Location
```

Nếu một bước `npm.cmd ci` lỗi thì sửa bước đó trước. Dùng `npm.cmd` trong PowerShell để tránh vấn đề execution policy của `npm.ps1`.

`init_env.py` chỉ thêm khóa còn thiếu. Nếu `.env` đã có dòng mật khẩu rỗng thì script yêu cầu điền, không tự ghi đè giá trị đó. Khi tài khoản đã tồn tại trong Keycloak, các script setup giữ mật khẩu hiện có; sửa mật khẩu trong `.env` không tự đổi mật khẩu người dùng ở Keycloak.

### 3.3. Những file cấu hình cần hiểu

| Tệp | Nội dung |
|---|---|
| `.env` | Mật khẩu DB, admin Keycloak, demo và `KEYCLOAK_PUBLIC_URL` |
| `backend/.env` | Issuer công khai, issuer nội bộ, audience, origin, SQLite, service credential |
| `web-a/.env.local` | URL Keycloak/API, client Web A và link Web B |
| `web-b/.env.local` | URL Keycloak/API, client Web B và link Web A |
| `network/.local/config.json` | URL chuẩn, cổng và địa chỉ bind của gateway |
| `network/.local/ca.crt` | CA công khai để máy khách tin cậy lab |
| `network/.local/server.crt`, `server.key`, `ca.key` | Chứng chỉ máy chủ và các khóa riêng của lab |

Chỉ chia sẻ `ca.crt` khi cấu hình máy khách. Không đưa `.env`, token, khóa riêng, mật khẩu hoặc QR/secret OTP vào ảnh và biên bản.

### 3.4. Tài khoản demo và quyền

| Tài khoản | Role | Nhóm | Web A | Web B |
|---|---|---|---|---|
| `admin01` | admin | Điều hành | Quản trị, nhóm và chấm công cá nhân | Đọc và quản trị |
| `manager01` | manager | Sản phẩm | Cá nhân và nhóm Sản phẩm | Bị từ chối |
| `employee01` | employee | Sản phẩm | Cá nhân | Bị từ chối |
| `auditor01` | auditor | Kiểm soát | Cá nhân và đọc bảo mật | Chỉ đọc bảo mật |
| `manager02` | manager | Vận hành | Cá nhân và nhóm Vận hành | Bị từ chối |
| `employee02` | employee | Vận hành | Cá nhân | Bị từ chối |

Mật khẩu demo nằm trong khóa `TEST_<USERNAME_VIẾT_HOA>_PASSWORD`, ví dụ `TEST_EMPLOYEE01_PASSWORD`. Admin Console dùng `KEYCLOAK_ADMIN` và `KEYCLOAK_ADMIN_PASSWORD`; đây là tài khoản khác với `admin01` của realm ứng dụng.

## 4. Chạy đầy đủ trên một máy

### 4.1. Cách chạy khuyến nghị bằng runner

Đóng runner/backend/Vite cũ bằng Ctrl+C trước khi đổi chế độ hoặc mở lượt mới.

```powershell
cd D:\IAM-ZeroTrust
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Runner thực hiện lần lượt:

1. Kiểm tra chế độ có khớp URL trong `.env` và đã có dependencies.
2. Chạy `docker compose up -d`.
3. Chờ endpoint discovery của realm master qua loopback 8080.
4. Chạy `setup_week3.py`, trong đó gọi setup nền tảng và tuần 2.
5. Chuẩn bị realm, user, client, audience, service credential và seed hồ sơ.
6. Chạy backend loopback 3001, Vite Web A 5173 và Web B 5174.
7. Giữ các tiến trình hoạt động trong terminal.

Giữ terminal mở. Các địa chỉ:

| Địa chỉ | Mục đích |
|---|---|
| `http://localhost:5173/` | Web A |
| `http://localhost:5174/` | Web B |
| `http://localhost:3001/health` | Kiểm tra backend |
| `http://localhost:8080/admin/` | Keycloak Admin Console |

Mở ứng dụng bằng đúng `localhost`, không tự đổi sang `127.0.0.1` nếu chưa thay cấu hình origin/redirect tương ứng.

### 4.2. Kiểm tra đã chạy đúng

Mở terminal thứ hai:

```powershell
cd D:\IAM-ZeroTrust
docker compose ps
curl.exe -i http://localhost:3001/health
curl.exe -i http://localhost:3001/api/profile
```

Kỳ vọng:

- `iam-postgres` healthy; Keycloak đang chạy.
- `/health`: HTTP 200, JSON có `status: "OK"`, `service: "Workspace API"`, `version: 3`.
- `/api/profile` không gửi token: HTTP 401, `code: "MISSING_TOKEN"`.
- Web A đưa đến trang đăng nhập Keycloak; đăng nhập `employee01` thấy chức năng cá nhân.
- Web B đăng nhập `admin01` thấy Trung tâm an ninh.

### 4.3. Chạy thủ công để quan sát từng tiến trình

Chỉ dùng cách này khi không có runner đang giữ cùng cổng.

Terminal chuẩn bị:

```powershell
cd D:\IAM-ZeroTrust
python scripts/configure_network.py --local
docker compose up -d
docker compose ps
```

Chờ Keycloak mở được tại `http://localhost:8080`, sau đó:

```powershell
python scripts/setup_week3.py
```

Terminal backend:

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd start
```

Terminal Web A:

```powershell
cd D:\IAM-ZeroTrust\web-a
npm.cmd run dev
```

Terminal Web B:

```powershell
cd D:\IAM-ZeroTrust\web-b
npm.cmd run dev
```

### 4.4. Dừng và chạy lại

Ctrl+C tại runner hoặc từng terminal chạy thủ công. Container vẫn chạy nếu chỉ dừng runner.

```powershell
cd D:\IAM-ZeroTrust
docker compose stop
```

Lần sau mở Docker Desktop rồi chạy lại runner. Không dùng `docker compose down -v` cho việc dừng thông thường vì tùy chọn `-v` xóa volume dữ liệu.

## 5. Triển khai hai máy qua HTTPS LAN/VPN

### 5.1. Cấu hình máy chủ

Lấy IPv4 bằng `ipconfig`; chọn adapter mạng mà máy khách truy cập được. Ví dụ dưới dùng `10.0.103.227`, là IP của biên bản cũ; **thay bằng IP hiện tại** nếu máy đổi mạng.

```powershell
cd D:\IAM-ZeroTrust
ipconfig
python scripts/configure_network.py --host 10.0.103.227
python scripts/run_week3.py --network
```

`configure_network.py` tạo CA nếu chưa có, sinh chứng chỉ máy chủ với SAN đúng IP/DNS và cập nhật URL ở các file môi trường. CA được tạo với thời hạn 365 ngày, chứng chỉ máy chủ 90 ngày theo script hiện tại. Mỗi lần cấu hình LAN, chứng chỉ máy chủ được sinh lại cho host được chọn.

Runner LAN build Web A với base `/a/`, Web B với base `/b/`, rồi chạy API và gateway. Các cổng Vite 5173/5174 không phải điểm truy cập trong chế độ này.

### 5.2. Cấu hình máy khách

1. Kết nối cùng LAN hoặc VPN riêng có route tới máy chủ.
2. Nhận file `network/.local/ca.crt` và đối chiếu đúng CA với máy chủ.
3. Cài CA vào **Current User → Trusted Root Certification Authorities**.
4. Đóng/mở lại trình duyệt nếu cần.
5. Mở `https://10.0.103.227:8443/` rồi chọn ứng dụng.

Các lệnh trên máy khách, tại thư mục chứa `ca.crt`:

```powershell
certutil -hashfile .\ca.crt SHA256
certutil -user -addstore Root .\ca.crt
Test-NetConnection 10.0.103.227 -Port 8443
```

`TcpTestSucceeded: True` chỉ xác nhận đường TCP; chưa chứng minh TLS được tin cậy hoặc đăng nhập thành công.

### 5.3. Firewall nếu mạng riêng đang chặn

Trên máy chủ, PowerShell quyền quản trị, với mạng Private và máy khách cùng subnet:

```powershell
New-NetFirewallRule -DisplayName 'Nhip IAM HTTPS LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -Profile Private -RemoteAddress LocalSubnet
```

Với VPN, thay phạm vi địa chỉ bằng IP/subnet VPN thực tế và dùng profile phù hợp. Không cần mở PostgreSQL, 3001 hoặc 8080 ra máy khách. Tránh tạo trùng quy tắc khi quy tắc đã tồn tại.

### 5.4. Kiểm chứng HTTPS từ máy khách

Tại thư mục có `ca.crt`:

```powershell
curl.exe --cacert .\ca.crt -i https://10.0.103.227:8443/health
```

Kỳ vọng HTTP 200 và không lỗi kiểm tra chứng chỉ. Sau đó đăng nhập thực tế, chuyển A ↔ B bằng cùng trình duyệt và kiểm tra quyền. Chụp kết quả của máy khách riêng để bổ sung phần chưa được xác nhận.

Gateway chỉ chấp nhận host đã cấu hình. Mở bằng IP khác, hostname khác hoặc đổi cổng tùy ý có thể gây lỗi chứng chỉ, redirect hoặc HTTP 421.

### 5.5. Đổi IP, đổi chế độ và cập nhật giao diện

Dừng runner, cấu hình lại host rồi chạy lại:

```powershell
python scripts/configure_network.py --host IP_MOI
python scripts/run_week3.py --network
```

`IP_MOI` là chỗ giữ chỗ, phải thay bằng địa chỉ thật. Nếu giữ CA cũ, máy khách đã tin cậy CA đó thường không cần cài lại CA; vẫn phải truy cập đúng SAN mới.

Quay về localhost:

```powershell
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Ở LAN, sửa React xong phải build lại:

```powershell
Push-Location web-a
npm.cmd run build -- --base=/a/
Pop-Location
Push-Location web-b
npm.cmd run build -- --base=/b/
Pop-Location
```

Gateway đọc file build trên ổ đĩa. Dùng Ctrl+F5 khi trình duyệt giữ asset cũ. Nếu sửa backend, env hoặc `network/gateway.js`, khởi động lại tiến trình liên quan.

## 6. Chi tiết triển khai xác thực, phân quyền và phiên

### 6.1. Hai OIDC client

| Thuộc tính | Web A | Web B |
|---|---|---|
| Client ID | `employee-portal` | `security-dashboard` |
| Audience | `employee-api` | `security-api` |
| Loại | Public client | Public client |
| Flow | Authorization Code | Authorization Code |
| PKCE | S256 | S256 |
| Client secret trong React | Không có | Không có |
| Direct Access Grants/Implicit Flow | Tắt | Tắt |
| Localhost | `http://localhost:5173/` | `http://localhost:5174/` |
| LAN | `https://HOST:8443/a/` | `https://HOST:8443/b/` |

Redirect URI được giới hạn trong URL/path ứng dụng; cấu hình hiện tại có URL gốc ứng dụng và mẫu `app_url + '*'`. Web origin là origin chính xác theo chế độ. Các scope mặc định gồm `basic`, `web-origins`, `acr`, `profile`, `roles`, `email`.

`basic` quan trọng với Keycloak hiện tại để có `sub`; script đối chiếu cả danh sách scope đã gán thực tế. Audience mapper đưa custom audience vào access token. Role đọc từ `realm_access.roles`.

### 6.2. Luồng đăng nhập

1. Web gọi `keycloak.init` với `login-required`, `pkceMethod: 'S256'`.
2. Trình duyệt chuyển tới Keycloak; ứng dụng không tự kiểm tra mật khẩu.
3. Keycloak xác thực và trả authorization code về redirect URI đã đăng ký.
4. `keycloak-js` đổi code kèm verifier PKCE lấy token.
5. Web giữ token trong bộ nhớ và gửi `Authorization: Bearer ...` khi gọi API.
6. Backend tự xác minh token và quyền trước khi truy cập dữ liệu.

Tải lại trang có thể khởi tạo lại OIDC qua phiên Keycloak còn hiệu lực. Hai ứng dụng không truyền token cho nhau qua URL hoặc localStorage.

### 6.3. Thứ tự kiểm tra tại API

Sau middleware request ID, header, origin và JSON, các đường `/api` được kiểm tra theo thứ tự:

1. Header Bearer đúng dạng; thiếu/sai dạng → `401 MISSING_TOKEN`.
2. Xác minh RS256, JWKS, issuer, audience và claim bắt buộc `sub`, `iat`, `exp`, `azp`, `sid` → sai thì `401 INVALID_TOKEN`.
3. `azp` phải thuộc client đã khai báo và audience khớp client đó; `sid` là chuỗi không rỗng.
4. Tìm `staff.id` đúng `sub`; chưa có → `403 UNREGISTERED`.
5. Hồ sơ bị khóa → `403 ACCOUNT_DISABLED`.
6. `iat` phải lớn hơn `revoked_before`; token cũ → `401 SESSION_REVOKED`.
7. Role trong token phải khớp role hồ sơ; không khớp → `403 INSUFFICIENT_ROLE`.
8. Nếu token Web B: chỉ admin/auditor; role khác → `403 DASHBOARD_ACCESS_DENIED`. Đường nghiệp vụ ngoài phạm vi Web B → `403 CLIENT_SCOPE_DENIED`.
9. Kiểm tra phiên `sub + sid` với Keycloak; kết thúc → `401 SSO_SESSION_ENDED`, không xác nhận được → `503 IDENTITY_UNAVAILABLE`.
10. Giới hạn tần suất theo user; vượt ngưỡng → `429 RATE_LIMIT`.
11. Kiểm tra role endpoint, chủ sở hữu, nhóm, trạng thái nghiệp vụ và dữ liệu đầu vào.

Thứ tự này giải thích vì sao cùng một yêu cầu có thể nhận mã khác khi tài khoản đã khóa, token hết hạn hoặc Keycloak không hoạt động. Phải đáp ứng các điều kiện trước đó khi kiểm tra một nhánh cụ thể.

### 6.4. Ma trận API minh họa bằng token Web A

| Role | `/api/profile` | `/api/manager` | `/api/admin` | `/api/audit` |
|---|---:|---:|---:|---:|
| employee | 200 | 403 | 403 | 403 |
| manager | 200 | 200 | 403 | 403 |
| admin | 200 | 200 | 200 | 200 |
| auditor | 200 | 403 | 403 | 200 |

Ma trận này không bỏ qua kiểm tra hồ sơ/phiên và không áp nguyên xi cho token Web B: Web B có danh sách đường dẫn cho phép riêng, ví dụ token Web B không gọi `/api/attendance` hoặc `/api/admin` minh họa dù là admin.

### 6.5. SSO, logout và thu hồi

- SSO dùng cookie phiên Keycloak trong cùng hồ sơ trình duyệt. `azp`/`aud` riêng, `sid` cùng phiên.
- Backend cache kiểm tra phiên tối đa **5 giây** theo `sub + sid`; kết quả lỗi không được giữ như phiên hợp lệ.
- Frontend kiểm tra mỗi **15 giây**, khi focus và khi đổi visibility; bỏ qua kiểm tra ở tab ẩn.
- Trước request, client gọi `updateToken(30)` để làm mới nếu gần hết hạn.
- Thu hồi toàn tài khoản ghi `revoked_before` và gọi logout Keycloak. Token có `iat <= revoked_before` bị chặn tại local.
- Kết thúc một phiên chỉ xóa `sid` được chọn; các phiên khác không bị thu hồi theo thao tác này.
- Khi vừa đăng nhập đúng giây thu hồi, API client chỉ tự làm mới và thử lại GET một lần sau khoảng 1,1 giây. POST/PATCH không tự gửi lại.

Đăng xuất không được chứng minh chỉ bằng việc một tab xóa token. Cần gọi API bằng bản token cũ còn hạn để xác nhận bị từ chối. Tab nền bị trình duyệt đình chỉ có thể cập nhật giao diện muộn; API vẫn kiểm tra phiên khi có request tiếp theo, có tính đến cửa sổ cache.

### 6.6. Service account và chính sách Keycloak

Client `attendance-control` là confidential client dùng **client credentials** ở backend. Setup cấp các quyền realm-management `manage-users`, `view-users`, `view-realm`, `view-events` và ghi secret vào `backend/.env`.

Backend dùng credential này để đọc phiên, quản lý user/role, logout và đọc sự kiện. Quyền giới hạn trong realm ứng dụng nhưng vẫn là quyền quản trị user rộng; bảo vệ secret và không nhúng vào frontend.

Chính sách được setup:

- Access token 300 giây.
- Mật khẩu tối thiểu 12 ký tự, có số, chữ hoa và chữ thường.
- Tắt tự đăng ký.
- Bật chống brute-force, `failureFactor = 5`, tăng thời gian chờ 60 giây, tối đa 900 giây, không permanent lockout.
- Bật User Events và Admin Events; cấu hình thời gian giữ User Events 604800 giây, tương đương 7 ngày.

## 7. Chi tiết dữ liệu và tính nhất quán

### 7.1. PostgreSQL và SQLite lưu gì?

| Nơi lưu | Nội dung |
|---|---|
| PostgreSQL trong Docker | Danh tính, credential, realm/client/role và dữ liệu Keycloak |
| `backend/data/attendance.sqlite` mặc định | Hồ sơ ứng dụng, công, đơn, audit, cảnh báo, thao tác, thông báo và sự kiện được collector nhập |
| `backend/data/staff.json` | Seed liên kết UUID user Keycloak với hồ sơ demo |
| `backend/data/audit.jsonl` nếu có | Minh chứng/luồng JSONL cũ; không thay cho audit SQLite hiện tại |

Không có mật khẩu người dùng trong bảng hồ sơ SQLite. Mật khẩu do Keycloak quản lý; mật khẩu tạm thời chỉ đi qua thao tác tạo/reset cần thiết.

### 7.2. Các bảng SQLite

| Bảng | Trường/nguyên tắc chính |
|---|---|
| `staff` | `id` trùng `sub` Keycloak; username duy nhất; name, email, team, role, disabled, revoked_before |
| `attendance` | user_id, day, check_in, check_out, late_minutes; unique `(user_id, day)` |
| `corrections` | Ngày/giờ đề nghị, reason, status, người duyệt, ghi chú; unique pending theo user/ngày |
| `events` | request_id, time, actor_id, username, method, path, HTTP status, decision, reason, target |
| `alerts` | Loại, user, mức độ, số lần, trạng thái, ghi chú và người điều tra |
| `actions` | Người thao tác, mục tiêu, loại, lý do, thời gian, trạng thái và thông báo đồng bộ |
| `identity_events` | Sự kiện xác thực chọn lọc, client_id, IP và lỗi |
| `notifications` | Người nhận/phạm vi security, tiêu đề, nội dung, chức năng và thời điểm |
| `notification_reads` | Khóa ghép notification_id/user_id; trạng thái đọc riêng từng người |

SQLite bật WAL, foreign keys và busy timeout 5 giây. Hàm `fold` phục vụ tìm tiếng Việt không dấu. Khi khởi động, schema được tạo nếu thiếu và bổ sung cột email cho dữ liệu cũ.

### 7.3. Transaction và đồng thời

- Thao tác nghiệp vụ và audit tương ứng dùng `BEGIN IMMEDIATE` → commit/rollback.
- Ghi audit thất bại giữa check-in thì bản ghi công cũng rollback; API trả 503.
- Hai check-in cùng user/ngày: chỉ một thành công, không có hai dòng công.
- Hai quyết định cùng đơn: chỉ một thành công, quyết định sau nhận xung đột.
- Mỗi user mục tiêu chỉ có một action `pending`; thao tác chồng nhận `409 ACTION_PENDING`.
- Sau backend restart, action còn `pending` được chuyển `partial` để không báo đã xác nhận ở Keycloak.
- Seed hồ sơ dùng `ON CONFLICT(id) DO NOTHING`; không ghi đè hồ sơ/nhóm/role đã chỉnh trên Web khi restart.

Transaction SQLite không tạo giao dịch phân tán với Keycloak. Một số nhánh có bước bù như vô hiệu hóa user vừa tạo hoặc tạm khóa khi đổi hồ sơ lỗi; vẫn phải đối chiếu trạng thái hai bên khi có lỗi đồng bộ.

## 8. Cách sử dụng và kiểm chứng từng chức năng

### 8.1. Chấm công và bảng công

Đăng nhập Web A bằng employee, vào Chấm công → Chấm công vào → Làm mới dữ liệu → Chấm công ra. Giờ lấy từ máy chủ; ngày theo UTC+7. Lịch công hiển thị 08:00–17:00; phút muộn tính phần vượt 08:00. Client chỉ gửi `{}`, không được tự đặt user/role/timestamp.

Bảng công lọc theo tháng, có tìm/lọc/sắp xếp/phân trang/CSV trên dữ liệu đã tải. Biểu đồ tuần gần nhất được truy vấn riêng, không bị đổi thành tháng cũ khi chọn một tháng khác.

### 8.2. Đơn điều chỉnh và duyệt đúng nhóm

1. `employee01` tạo đơn cho hôm qua, ví dụ 08:00–17:00, lý do đủ dài.
2. `manager01` mở Quản lý nhóm, xem và duyệt với ghi chú.
3. Employee kiểm tra đơn approved và công đã được cập nhật.
4. Tạo một đơn khác rồi từ chối: không cập nhật công theo giờ đề nghị.
5. Người nộp có thể rút đơn đang pending; sau khi rút, quản lý không thể duyệt lại.

Giới hạn: ngày trong 31 ngày gần nhất, không tương lai, phải tồn tại; giờ ra sau giờ vào trong cùng ngày và không ở tương lai; lý do 10–500 ký tự. Ghi chú duyệt 5–300 ký tự. Mọi role, kể cả admin, không được tự duyệt đơn của mình.

### 8.3. Tạo nhân viên và mật khẩu tạm thời

Admin → Tài khoản → Thêm nhân viên. Nhập username, email, họ tên đầy đủ, nhóm, role và mật khẩu tạm thời. Chỉ cấp employee, manager hoặc auditor qua ứng dụng.

Backend tạo user tại Keycloak, gán role, rồi lưu hồ sơ cùng UUID. Người dùng đăng nhập phải đổi mật khẩu do `UPDATE_PASSWORD`. Username dài 3–50, bắt đầu bằng chữ/số và chỉ chứa chữ/số/dấu chấm/gạch dưới/gạch ngang; mật khẩu 12–128 ký tự gồm hoa/thường/số.

Nếu Keycloak đã tạo user nhưng lưu local lỗi, backend cố vô hiệu hóa user đó. Cần đối chiếu cả Keycloak và app trước khi thử tạo lại; không mặc định mọi bước đã rollback từ xa.

### 8.4. Đổi hồ sơ, nhóm và role

Admin → Hồ sơ & phiên → Hồ sơ & vai trò → sửa và ghi lý do 10–300 ký tự. Backend tạm chặn trong khi đồng bộ, đổi role/hồ sơ Keycloak và kết thúc phiên cũ; chỉ commit hồ sơ mới khi xác nhận thành công.

Nếu lỗi: giữ role cũ trong ứng dụng, tài khoản tạm khóa, action partial. Khi Keycloak phục hồi: lưu lại hồ sơ mong muốn, xác nhận synced, sau đó mở tài khoản nếu còn khóa; user đăng nhập lại. Đổi nhóm ở đây là nhóm ứng dụng, không phải LDAP group.

Không sửa trực tiếp role demo chỉ ở Keycloak rồi coi app đã đồng bộ: role token khác hồ sơ sẽ bị chặn và setup cũng phát hiện role demo xung đột.

### 8.5. Khóa/mở, thu hồi và MFA

Admin → Quản lý truy cập → chọn `disable`, `enable`, `revoke` hoặc `require-mfa` → ghi lý do → xác nhận.

| Thao tác | Local | Keycloak | Cần quan sát |
|---|---|---|---|
| Khóa | disabled và mốc thu hồi | Vô hiệu hóa, logout | User không gọi API/đăng nhập mới được |
| Mở | Chỉ mở sau xác nhận remote | Bật enabled | Đăng nhập mới; token trước thu hồi vẫn bị chặn |
| Thu hồi | Cập nhật mốc thu hồi | Logout toàn user | Bản token cũ bị từ chối |
| Yêu cầu MFA | Thu hồi token cũ | Thêm CONFIGURE_TOTP, logout | Required action được gán; chưa đồng nghĩa OTP đã kiểm thử đủ |

Khóa/mở/thu hồi/MFA dùng kết quả HTTP 200 khi đồng bộ, HTTP 202 `PARTIAL` khi remote không xác nhận được. Khi mở lỗi, tài khoản local vẫn khóa. Tài khoản admin/tự quản trị được bảo vệ bằng `PROTECTED_ADMIN`; xử lý admin qua Keycloak Console với kiểm tra phù hợp.

### 8.6. Quản lý từng phiên

Người dùng → Hồ sơ & phiên của tôi: xem IP, thời điểm, ứng dụng và phiên hiện tại. Chọn Kết thúc phiên, ghi lý do. Backend kiểm tra phiên thực sự thuộc user trước khi xóa ở Keycloak.

Admin có thể xem/kết thúc phiên tài khoản thường ở Hồ sơ & phiên. Sau tối đa cửa sổ cache 5 giây, request bằng token phiên đó phải bị từ chối. Đây là thao tác khác với thu hồi mọi phiên của tài khoản.

### 8.7. Thông báo

Chuông hiển thị số chưa đọc; mở để đọc từng mục hoặc tất cả. Đơn mới gửi đến người duyệt đúng phạm vi; kết quả trả về người nộp. Cảnh báo bảo mật dành cho admin/auditor. Việc admin đọc cảnh báo không đánh dấu đã đọc thay auditor.

API lấy 100 thông báo mới nhất trong phạm vi và tính số chưa đọc. Trạng thái đọc lưu ở DB, còn sau reload. Chuông kiểm tra cập nhật khoảng 20 giây và khi focus.

### 8.8. Điều tra cảnh báo và tra cứu log

1. Admin/auditor vào Cảnh báo; lọc mức độ và trạng thái.
2. Mở ngữ cảnh gồm tối đa 20 truy cập và 20 đăng nhập gần nhất của tài khoản.
3. Đối chiếu thời gian, đường dẫn, mã lỗi và request ID.
4. Admin ghi Đang điều tra/Đã xử lý/Đã xác minh hợp lệ kèm căn cứ.
5. Nếu cần ngăn truy cập, thực hiện khóa/thu hồi riêng rồi kiểm chứng lại.

Đóng cảnh báo chỉ lưu kết luận; không tự khóa user, thay role hoặc thu hồi token. Auditor chỉ đọc, không ghi kết luận hay đồng bộ thủ công.

Nhật ký/cảnh báo/sự kiện xác thực có truy vấn toàn bộ lịch sử SQLite đã lưu, tìm không dấu, lọc ngày UTC+7, sắp xếp tại server và phân trang. CSV xuất tối đa 200 kết quả đầu theo bộ lọc; không có nghĩa toàn bộ lịch sử chỉ có 200 dòng.

### 8.9. Collector và cách xuất hiện cảnh báo đăng nhập sai

Collector chạy lúc backend khởi động và mỗi 30 giây; admin có nút Đồng bộ Keycloak. Mỗi lượt lấy tối đa 200 sự kiện mới nhất, chống trùng theo ID hoặc fingerprint.

Các loại được collector nhận: `LOGIN`, `LOGIN_ERROR`, `LOGOUT`, `LOGOUT_ERROR`, `UPDATE_PASSWORD`, `UPDATE_TOTP`, `REMOVE_TOTP`, `RESET_PASSWORD`, `RESET_PASSWORD_ERROR`. Một loại chỉ xuất hiện nếu Keycloak có ghi sự kiện đó; việc nằm trong allowlist collector không tự bật ghi mọi loại tại Keycloak.

Mỗi `LOGIN_ERROR` được nhập có thể tạo/gộp cảnh báo. Brute-force ngưỡng 5 là cơ chế Keycloak riêng, không phải ngưỡng mới tạo cảnh báo app. Alert cùng actor/username/loại đang open/reviewing, trong cửa sổ 10 phút, được gộp tăng count. Notification bảo mật tạo khi có alert mới.

Chưa có lấy bù toàn bộ khi mất kết nối lâu hoặc nhiều hơn 200 sự kiện giữa hai lượt. Không mô tả collector hiện tại như SIEM hoặc module Python Detection.

### 8.10. Tiện ích giao diện và CSV

Trang chọn ứng dụng có hai ứng dụng và sáu link chức năng; đăng nhập xong quyền vẫn được kiểm tra. Trong Web có Ctrl+K, tìm không dấu, link hash như `/b/#/accounts`, menu mobile và hộp thoại giữ nội dung khi lưu lỗi.

CSV có BOM UTF-8, xử lý dấu phẩy/dấu nháy/xuống dòng và trung hòa chuỗi có thể trở thành công thức bảng tính. Chỉ xuất trường được khai báo. Auto refresh Web B khoảng 20 giây có công tắc, tạm dừng khi tab ẩn hoặc mở hộp thoại.

## 9. Chuẩn bị để tái hiện lỗi và đọc kết quả

### 9.1. Cách tổ chức phiên thử

Chuẩn bị ba hồ sơ/cửa sổ độc lập cho employee, manager và admin. Hai tab A/B dùng để thử SSO phải thuộc **cùng hồ sơ**, còn admin xử lý user nên ở hồ sơ khác. Nhiều cửa sổ riêng tư của cùng trình duyệt có thể chia sẻ phiên riêng tư; dùng hai profile hoặc hai trình duyệt nếu cần chắc chắn tách người dùng.

Chọn tài khoản demo, ghi lại trạng thái trước khi thử khóa/đổi role/MFA. Những test ghi dữ liệu sẽ để lại công, đơn và log; không dùng ngày cố định đã quá 31 ngày. Khi cần ID, dùng UUID trả từ API hoặc giao diện quản trị; `employee02` là username, không phải `staff.id`.

### 9.2. Công cụ gọi API từ phiên đã đăng nhập

Các ví dụ bên dưới sử dụng hàm `iamProbe`. Đoạn này chỉ tạo công cụ tạm trong DevTools của tab ứng dụng, không sửa mã nguồn và không in token.

1. Đăng nhập đúng tài khoản, đúng Web cho kịch bản.
2. F12 → Console, chạy đoạn sau.
3. Bấm **Làm mới dữ liệu** trong ứng dụng hoặc chờ lần gọi API kế tiếp.
4. Khi thấy “iamProbe đã sẵn sàng”, chạy các ví dụ ở mục 10.

```javascript
(() => {
  if (window.iamStopProbe) window.iamStopProbe();
  const originalFetch = window.fetch;
  const apiOrigin = ['5173', '5174'].includes(location.port)
    ? 'http://localhost:3001'
    : location.origin;

  window.iamStopProbe = () => {
    window.fetch = originalFetch;
    delete window.iamProbe;
    delete window.iamStopProbe;
  };

  window.fetch = function (input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const authorization = headers.get('Authorization');

    if (url.origin === apiOrigin && url.pathname.startsWith('/api/') && authorization) {
      window.fetch = originalFetch;
      window.iamProbe = async (path, options = {}) => {
        if (!path.startsWith('/api/')) throw new Error('Chỉ dùng đường /api/ của lab.');
        const {method = 'GET', body, rawBody, headers: extraHeaders = {}} = options;
        const hasBody = body !== undefined || rawBody !== undefined;
        const response = await originalFetch.call(window, apiOrigin + path, {
          method,
          headers: {
            Authorization: authorization,
            ...(hasBody ? {'Content-Type': 'application/json'} : {}),
            ...extraHeaders,
          },
          body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
          cache: 'no-store',
        });
        const text = await response.text();
        let payload;
        try { payload = JSON.parse(text); } catch { payload = text; }
        const result = {
          http: response.status,
          requestId: response.headers.get('X-Request-Id'),
          retryAfter: response.headers.get('Retry-After'),
          payload,
        };
        console.log(result);
        return result;
      };
      console.log('iamProbe đã sẵn sàng; chỉ giữ token trong bộ nhớ tab.');
    }
    return originalFetch.call(this, input, init);
  };
  console.log('Bấm Làm mới dữ liệu để chuẩn bị iamProbe.');
})();
```

Kiểm tra đầu tiên:

```javascript
await iamProbe('/api/profile');
```

Kỳ vọng 200 khi phiên hợp lệ. `iamProbe` dùng **bản token chụp tại lúc chuẩn bị**, không tự refresh. Đây là điều cần thiết để thử token cũ sau thu hồi. Khi token hết hạn 300 giây hoặc cần tài khoản mới, đăng nhập/chuẩn bị lại helper. Chạy từng ví dụ, không dán tất cả kịch bản một lúc.

Dọn helper sau khi thử hoặc chỉ reload tab:

```javascript
if (window.iamStopProbe) window.iamStopProbe();
```

Mã helper được kiểm tra cú pháp khi soạn tài liệu; các ví dụ gọi API thủ công này là hướng dẫn tái hiện, không được tính là một lượt kiểm thử trình duyệt mới.

### 9.3. Đọc phản hồi và tìm log

Phản hồi lỗi thường có dạng:

```json
{
  "status": "DENY",
  "code": "INSUFFICIENT_ROLE",
  "message": "Bạn không có quyền thực hiện thao tác này.",
  "requestId": "UUID-cua-yeu-cau"
}
```

Ghi lại thời điểm, role/Web, method/path, HTTP, code và requestId. Admin/auditor mở **Nhật ký truy cập**, tìm mã đối chiếu; mở Chi tiết để thấy các bước cùng request ID. Action quản trị có thể có nhiều sự kiện 202 rồi 200/202/503 cho cùng yêu cầu.

Trong tab Network, xem Response và Status; không chụp header Authorization. Lỗi TLS/kết nối có thể xảy ra trước khi đến backend, khi đó không có request ID trong SQLite. HTTP 503 dạng text có thể đến từ gateway; 503 JSON có `code` thường do backend.

## 10. Các kịch bản chủ động tạo lỗi và kiểm chứng cơ chế bắt lỗi

### 10.1. AUTH-01 — Không có token

**Cách làm:** chạy ở terminal, localhost:

```powershell
curl.exe -i http://localhost:3001/api/profile
```

**Kỳ vọng:** 401 `MISSING_TOKEN`, không trả hồ sơ. Admin có thể tìm audit theo request ID. `MISSING_TOKEN` được ghi log nhưng không có mapping tạo cảnh báo riêng trong `store.js`.

**Khôi phục:** đăng nhập bằng Web rồi gọi lại bằng token phiên hợp lệ.

### 10.2. AUTH-02 — Token rác hoặc sai chữ ký

Token rác, không cần đăng nhập:

```powershell
curl.exe -i -H "Authorization: Bearer invalid-token" http://localhost:3001/api/profile
```

**Kỳ vọng:** 401 `INVALID_TOKEN`; có thể tạo/gộp cảnh báo Token không hợp lệ. Vì chưa xác thực được danh tính, sự kiện có thể mang `anonymous`, không được quy kết chắc chắn cho employee nào.

Sai chữ ký, hết hạn, sai issuer/audience, chưa đến `nbf`, thiếu `exp`, JWT không ký dùng bộ backend ở mục 11. Các test ký bằng khóa kiểm thử riêng; không cần lấy khóa riêng Keycloak hoặc thay cấu hình xác minh của lab.

### 10.3. RBAC-01 — Nhân viên gọi API quản trị

**Chuẩn bị:** employee01, Web A, helper trả `/api/profile` 200.

```javascript
await iamProbe('/api/admin/users');
await iamProbe('/api/team');
await iamProbe('/api/security');
```

**Kỳ vọng:** cả ba 403 `INSUFFICIENT_ROLE`; không có dữ liệu quản trị. Admin → Cảnh báo thấy loại Vượt quyền chức năng, có thể gộp tăng số lần. Đây là cách chứng minh ẩn nút frontend không phải lớp bảo vệ duy nhất.

**Khôi phục:** không có thay đổi quyền; admin ghi kết luận đây là kiểm thử nếu cần đóng cảnh báo.

### 10.4. RBAC-02 — Auditor đọc được nhưng không ghi được

**Chuẩn bị:** auditor01 ở Web B hoặc Web A.

```javascript
await iamProbe('/api/security');
await iamProbe('/api/security/sync', {method: 'POST', body: {}});
await iamProbe('/api/admin/users');
```

**Kỳ vọng:** đọc security 200; đồng bộ thủ công và danh sách quản trị user 403 `INSUFFICIENT_ROLE`. Với ID cảnh báo thật, PATCH điều tra cũng phải 403; UI không cho auditor lưu kết luận.

### 10.5. APP-01 — Employee/manager vào Web B

**Cách làm:** đăng nhập employee01 ở Web A rồi mở Web B cùng hồ sơ. UI hiển thị Bạn chưa có quyền truy cập; vẫn có thể quay về Web A.

**API:** token thật có `azp=security-dashboard` với employee/manager bị chặn `403 DASHBOARD_ACCESS_DENIED`. Vì Web B dừng trước luồng tải API thông thường cho role này, helper có thể chưa bắt được request; dùng `tests/week3_sso.py` hoặc `backend/sso.test.js` để chứng minh nhánh API.

Không dùng token Web A gọi endpoint security rồi kết luận đã kiểm tra nhánh client Web B; đó là một nhánh RBAC khác.

### 10.6. APP-02 — Token Web B gọi chấm công

**Chuẩn bị:** admin01 ở Web B, helper đã sẵn sàng.

```javascript
await iamProbe('/api/attendance');
await iamProbe('/api/attendance/check-in', {method: 'POST', body: {}});
```

**Kỳ vọng:** 403 `CLIENT_SCOPE_DENIED`, không tạo bản ghi công. Admin chỉ chấm công bằng Web A và token Web A. Các code `CLIENT_SCOPE_DENIED`, `DASHBOARD_ACCESS_DENIED` hiện được audit nhưng chưa có mapping cảnh báo riêng trong `store.js`.

### 10.7. IDOR-01 — Đổi userId để xem công người khác

**Chuẩn bị:** admin lấy UUID employee02 từ danh sách tài khoản. Chuyển sang profile employee01/Web A.

```javascript
await iamProbe('/api/attendance?userId=UUID_EMPLOYEE02');
```

Thay `UUID_EMPLOYEE02` bằng ID thật.

**Kỳ vọng:** 403 `NOT_OWNER`, không lộ bảng công. Có cảnh báo Truy cập dữ liệu người khác. Endpoint `/api/attendance` dành cho bản thân; admin xem người khác qua chức năng quản lý thích hợp.

### 10.8. IDOR-02 — Quản lý duyệt khác nhóm hoặc tự duyệt

**Khác nhóm:** employee02 tạo đơn hôm qua và ghi lại ID. manager01/Web A thử:

```javascript
await iamProbe('/api/corrections/ID_DON_EMPLOYEE02', {
  method: 'PATCH',
  body: {decision: 'approved', note: 'Kiểm thử duyệt sai nhóm trong lab.'},
});
```

**Kỳ vọng:** 403 `CROSS_TEAM`, đơn vẫn pending, công chưa cập nhật; có cảnh báo Truy cập khác nhóm.

**Tự duyệt:** manager01 tự tạo đơn, rồi PATCH ID đơn của mình với body tương tự.

**Kỳ vọng:** 403 `SELF_APPROVAL`, đơn giữ pending; có cảnh báo Tự duyệt đơn của mình. Employee tự duyệt thường bị chặn role trước đó bằng `INSUFFICIENT_ROLE`.

**Khôi phục:** chủ đơn có thể rút đơn test hoặc nhờ quản lý đúng nhóm xử lý theo nội dung đã xác minh.

### 10.9. INPUT-01 — Chèn trường user, thời gian hoặc role

**Chuẩn bị:** employee/Web A.

```javascript
await iamProbe('/api/attendance/check-in', {
  method: 'POST',
  body: {userId: 'nguoi-khac', role: 'admin', checkIn: '2026-01-01T01:00:00Z'},
});
```

**Kỳ vọng:** 400 `FIELD_NOT_ALLOWED`; không có bản ghi mới. Cảnh báo Chèn trường ngoài cho phép. Backend không tin user/time do trình duyệt gửi.

Đơn mới có thêm `status: 'approved'` hoặc `reviewer_id` cũng bị từ chối trước khi lưu.

### 10.10. ATT-01 — Chấm công sai thứ tự và trùng

Thực hiện bằng tài khoản chưa chấm công hôm nay, Web A:

```javascript
await iamProbe('/api/attendance/check-out', {method: 'POST', body: {}});
```

**Kỳ vọng:** 409 `NO_CHECK_IN`. Sau đó:

```javascript
await iamProbe('/api/attendance/check-in', {method: 'POST', body: {}});
await iamProbe('/api/attendance/check-in', {method: 'POST', body: {}});
await iamProbe('/api/attendance/check-out', {method: 'POST', body: {}});
await iamProbe('/api/attendance/check-out', {method: 'POST', body: {}});
```

**Kỳ vọng theo thứ tự:** 201; 409 `ALREADY_CHECKED_IN`; 200; 409 `ALREADY_CHECKED_OUT`. Nếu user đã có công trước đó thì kết quả đầu sẽ khác; dùng test backend khi cần trạng thái ban đầu chắc chắn sạch.

Không xóa bảng công thật chỉ để lặp demo. Bộ `ATT-03` kiểm tra hai request đồng thời với DB riêng, kết quả một 201/một 409 và đúng một dòng công.

### 10.11. REQ-01 — Ngày/giờ/lý do không hợp lệ

Tính hôm qua theo giờ Việt Nam trong Console:

```javascript
const probeYesterday = new Date(Date.now() + 7 * 3600000 - 86400000)
  .toISOString().slice(0, 10);
```

Giờ ra trước giờ vào:

```javascript
await iamProbe('/api/corrections', {
  method: 'POST',
  body: {day: probeYesterday, checkIn: '17:00', checkOut: '08:00', reason: 'Kiểm thử giờ đề nghị không hợp lệ.'},
});
```

**Kỳ vọng:** 400 `INVALID_TIME`. Thay ngày bằng `2099-12-31`, `2026-02-30` hoặc ngày quá 31 ngày → `INVALID_DATE`; dùng reason `x` với ngày/giờ hợp lệ → `INVALID_REASON`. Đề nghị giờ kết thúc còn ở tương lai trong hôm nay → `FUTURE_TIME`.

**Kiểm tra trùng đơn:** gửi hai lần cùng user/ngày có body hợp lệ. Lần đầu 201 nếu chưa có pending; lần sau 409 `DUPLICATE_REQUEST`. Không kỳ vọng cùng kết quả nếu dữ liệu demo đã tồn tại pending.

### 10.12. REQ-02 — Duyệt lại hoặc duyệt đơn đã rút

Tạo đơn hợp lệ → người có quyền duyệt một lần → gửi lại cùng quyết định. Kỳ vọng 409 `ALREADY_REVIEWED`, không cập nhật công lần hai.

Chủ đơn rút khi còn pending:

```javascript
await iamProbe('/api/corrections/ID_DON_CUA_MINH/cancel', {method: 'POST', body: {}});
```

Sau đó quản lý đúng nhóm duyệt phải 409 `ALREADY_REVIEWED`. User khác cố rút đơn không thuộc mình → 404 `NOT_FOUND`, đơn không đổi.

### 10.13. INPUT-02 — JSON hỏng, body quá lớn, query sai

Đăng nhập Web A, dùng helper:

```javascript
await iamProbe('/api/corrections', {method: 'POST', rawBody: '{broken'});
await iamProbe('/api/corrections', {method: 'POST', body: {reason: 'a'.repeat(20000)}});
await iamProbe('/api/attendance?month=2026-99');
```

**Kỳ vọng:** 400 `INVALID_JSON`; 413 `BODY_TOO_LARGE`; 400 `INVALID_DATE`.

Với admin/auditor:

```javascript
await iamProbe('/api/security/events?limit=201');
await iamProbe('/api/security/events?page=0');
await iamProbe('/api/security/events?sort=khong_co_cot_nay&direction=desc');
await iamProbe('/api/security/events?decision=OTHER');
```

**Kỳ vọng:** 400 `INVALID_PAGE`, `INVALID_SORT` hoặc `INVALID_FILTER` tương ứng. `/api/audit` cũ có giới hạn 1–100 riêng; `/api/security/events` là 1–200.

### 10.14. INJ-01 — Chuỗi SQL và HTML được giữ như dữ liệu

Ở đơn test của Web A, nhập lý do minh họa:

```text
Kiểm thử hiển thị: <b>MINH_CHUNG</b> ' OR '1'='1
```

**Kỳ vọng:** UI hiển thị nguyên văn chuỗi, không tạo phần tử `<b>` từ nội dung; các bảng và dữ liệu khác còn nguyên. Query backend dùng tham số; tên cột sort chỉ được chọn từ allowlist.

Ở admin/auditor:

```javascript
await iamProbe('/api/security/events?q=' + encodeURIComponent("' OR 1=1 --"));
await iamProbe('/api/security/events?sort=' + encodeURIComponent('time; DROP TABLE staff'));
```

Từ khóa được xử lý như văn bản (số kết quả tùy dữ liệu thật), không được biến thành điều kiện SQL; tên cột sai bị 400 `INVALID_SORT`. Bộ backend kiểm tra cả payload HTML có handler và xác nhận dữ liệu còn nguyên; bộ UI kiểm tra cách trình bày ở trình duyệt.

### 10.15. ORIGIN-01 — Origin không được phép

JavaScript trình duyệt không cho tự đặt tùy ý header `Origin`. Dùng terminal để kiểm tra nhánh middleware tại localhost:

```powershell
curl.exe -i -H "Origin: http://localhost:5174.evil.test" http://localhost:3001/api/profile
```

**Kỳ vọng:** 403 `ORIGIN_DENIED`. Middleware origin chạy trước token, nên ví dụ này không cần token. Test tự động `CORS: lookalike origin denied` và `CSRF-01` kiểm tra thêm trường hợp có token hợp lệ.

Origin đúng Web B localhost được cho phép là `http://localhost:5174`, không phải hostname nhìn gần giống. CORS là một lớp kiểm soát nguồn trình duyệt; API vẫn bắt buộc xác thực/phân quyền cho request không có Origin.

### 10.16. RATE-01 — Vượt tần suất

Mặc định API giới hạn 120 yêu cầu/user trong cửa sổ 60 giây tại tiến trình backend. Hai Web dùng cùng user có thể cùng tiêu thụ hạn mức. Vượt ngưỡng → 429 `RATE_LIMIT`, có header `Retry-After: 60`.

Để tái hiện ổn định, chạy test `RATE-01` dùng ngưỡng 2 và DB riêng theo mục 11. Không cần gửi 121 request vào lab đang phục vụ thao tác khác. Trên thực tế, dừng thao tác/polling và chờ qua cửa sổ hạn mức rồi thử lại.

Header Retry-After không được expose trong cấu hình CORS localhost hiện tại, nên helper có thể thấy `null` dù Network response có header đó. Ở cùng origin HTTPS LAN có thể đọc được. Không sửa rate limit trong code chỉ để trình diễn.

### 10.17. SESSION-01 — Thu hồi token còn hạn

1. Employee02/Web A chuẩn bị helper và xác nhận `/api/profile` 200.
2. Admin ở profile khác → employee02 → Thu hồi phiên, ghi lý do kiểm thử.
3. Trong tab employee02, gọi ngay helper vẫn giữ bản token trước thu hồi:

```javascript
await iamProbe('/api/profile');
```

**Kỳ vọng:** 401 `SESSION_REVOKED` khi token còn hạn, có audit/cảnh báo Sử dụng phiên đã thu hồi. Nếu đợi đến token hết hạn, có thể nhận `INVALID_TOKEN`; khi đó chưa chứng minh riêng cơ chế mốc thu hồi.

**Khôi phục:** đăng nhập mới. Nếu đúng giây thu hồi, đợi qua một giây và để API client làm mới yêu cầu đọc theo cơ chế đã triển khai.

### 10.18. SESSION-02 — Khóa và mở tài khoản

1. Employee02 giữ helper token cũ.
2. Admin khóa employee02 và xác nhận kết quả đồng bộ.
3. Employee gọi `/api/profile` bằng helper → 403 `ACCOUNT_DISABLED` khi JWT vẫn hợp lệ.
4. Thử đăng nhập mới → Keycloak không cho tài khoản bị disabled.
5. Admin mở lại, xác nhận synced; employee đăng nhập mới để dùng tiếp.

Token trước khi khóa không tự có hiệu lực sau khi mở. Kiểm tra `revoked_before` vẫn được áp dụng. Không dùng admin01 làm mục tiêu khóa: tài khoản quản trị được bảo vệ.

### 10.19. SSO-01 — Đăng xuất một Web, Web còn lại mất phiên

1. Cùng profile admin01, đăng nhập Web A rồi mở Web B.
2. Chuẩn bị helper trong từng tab khi phiên còn hoạt động.
3. Đăng xuất tại B; quay lại A và focus để kích hoạt kiểm tra.
4. Giao diện A phải về trạng thái hết phiên/đăng nhập.
5. Nếu helper chưa bị mất do điều hướng, gọi lại bằng token snapshot sau hơn 5 giây; nếu tab điều hướng đã mất helper, dùng `tests/week3_sso.py` để giữ token ngoài vòng đời trang.

**Kỳ vọng API:** 401 `SSO_SESSION_ENDED` với token còn hạn khi logout Keycloak làm phiên biến mất; kịch bản có mốc thu hồi có thể trả `SESSION_REVOKED`. Kiểm tra cả chiều A logout → B.

API có cache tối đa 5 giây và UI poll khoảng 15 giây, không kỳ vọng mọi tab đồng thời đổi giao diện ngay đúng lúc bấm logout. Tab nền bị đình chỉ có thể cập nhật muộn hơn.

### 10.20. OPS-01 — User mới sai dữ liệu, trùng hoặc cấp admin

Admin dùng Thêm nhân viên, thử từng trường hợp:

| Dữ liệu gây lỗi | Kết quả dự kiến |
|---|---|
| Username trùng `employee01`, kể cả khác hoa/thường trong local | 409 DUPLICATE_USER |
| Password ngắn hoặc thiếu hoa/thường/số | 400 INVALID_USER khi tạo, INVALID_PASSWORD khi reset |
| Email không hợp lệ, họ tên chỉ một từ | 400 INVALID_EMAIL hoặc INVALID_USER tùy bước kiểm tra |
| Role admin trong body tạo/sửa hồ sơ | 400 INVALID_USER |
| Thêm `disabled: false` trong PATCH hồ sơ | 400 FIELD_NOT_ALLOWED |
| Sửa/reset tài khoản admin hoặc chính admin qua endpoint được bảo vệ | 403 PROTECTED_ADMIN |
| Lý do cập nhật dưới 10 ký tự | 400 theo loại thao tác |

UI có thể chặn trước khi gửi; muốn xác nhận phía server dùng test `OPS` hoặc helper với body phù hợp. Không coi việc nút Lưu bị disable là đã chứng minh backend chặn.

### 10.21. OPS-02 — Xóa phiên không thuộc mình

Employee gọi `/api/me/sessions`, ghi lại phiên của mình. Thử sessionId không tồn tại/không thuộc mình:

```javascript
await iamProbe('/api/me/sessions/revoke', {
  method: 'POST',
  body: {sessionId: 'khong-phai-phien-cua-toi', note: 'Kiểm thử giới hạn chủ sở hữu phiên.'},
});
```

**Kỳ vọng:** 404 `NOT_FOUND`, không xóa phiên khác. Sau đó kết thúc một phiên thật thuộc mình → 200; token phiên đó bị API từ chối sau thời gian cache. Nếu xóa phiên hiện tại thì cần đăng nhập lại.

### 10.22. NOTIFY-01 — Thông báo người khác và trạng thái đọc

Employee01 và employee02 đăng nhập hai profile khác nhau. Employee01 lấy ID thông báo riêng từ `/api/notifications`; employee02 thử đánh dấu ID đó đã đọc:

```javascript
await iamProbe('/api/notifications/ID_THONG_BAO_NGUOI_KHAC/read', {method: 'PATCH', body: {}});
```

**Kỳ vọng:** 404 `NOT_FOUND`. Thông báo security không xuất hiện với employee. Admin đọc thông báo security không làm giảm unread của auditor; trạng thái đọc được lưu theo từng user.

### 10.23. LOGIN-01 — Đăng nhập sai tạo log và cảnh báo thật

1. Dùng tài khoản demo thường, không dùng tài khoản admin điều khiển buổi demo.
2. Mở trang đăng nhập Keycloak, nhập sai mật khẩu **một lần**.
3. Admin ở profile khác → Đăng nhập & xác thực → Đồng bộ Keycloak, hoặc chờ khoảng 30 giây.
4. Lọc `LOGIN_ERROR` theo username/thời gian.
5. Mở Cảnh báo, đối chiếu loại Đăng nhập Keycloak thất bại và ngữ cảnh.

**Kỳ vọng:** sự kiện có client/IP/error; đồng bộ lại không tạo thêm bản sao cùng ID. Các lần thất bại gần nhau có thể được gộp vào một alert tăng count.

Muốn thử brute-force ngưỡng 5, dùng user test riêng và quan sát trạng thái/thời gian chờ Keycloak; không kỳ vọng đúng mọi trường hợp chỉ một con số cố định do các bộ đếm đã có trước. Khôi phục bằng chờ thời gian khóa tạm hoặc quản trị trạng thái brute-force trong Keycloak. Mở enabled của user không đồng nghĩa chắc chắn đã xóa bộ đếm brute-force.

### 10.24. MFA-01 — Yêu cầu cấu hình OTP

Admin chọn user demo riêng → Yêu cầu MFA → ghi lý do → xác nhận. Kiểm tra Required Actions có `CONFIGURE_TOTP`, phiên cũ bị thu hồi. User đăng nhập lại sẽ cần hoàn thành cấu hình nếu action đã gán và flow tương ứng hoạt động.

Mã nguồn/biên bản xác nhận thao tác yêu cầu này; không ghi kết luận rằng OTP đúng/sai/hết hạn đã được kiểm thử đầy đủ. Nếu thực hành đăng ký OTP, không chụp QR/secret. Muốn trả user demo về trạng thái cũ cần quản trị đúng credential OTP và required action ở Keycloak.

### 10.25. OUTAGE-01 — Keycloak ngừng hoạt động

**Chuẩn bị:** giữ một token snapshot còn hạn và ghi nhận `/api/profile` 200; dùng terminal khác khi runner đang chạy.

```powershell
cd D:\IAM-ZeroTrust
docker compose stop keycloak
```

Đợi cache phiên quá 5 giây rồi gọi `/api/profile` bằng helper. Request có thể cần đợi timeout Admin API khoảng 8 giây. Nếu JWKS đã có trong cache và JWT còn hạn, kỳ vọng `503 IDENTITY_UNAVAILABLE` khi không xác nhận được phiên. Nếu verifier cần tải JWKS mà Keycloak không hoạt động, có thể nhận `401 INVALID_TOKEN` ở bước trước. Dùng test SSO để kiểm tra nhánh session outage chính xác.

Gateway vẫn có thể trả trang Web tĩnh và `/health` backend 200, nhưng đăng nhập mới không hoạt động. `/health` hiện không kiểm tra đầy đủ Keycloak/DB nên 200 không có nghĩa mọi phụ thuộc khỏe.

**Khôi phục:**

```powershell
docker compose up -d keycloak
docker compose logs --tail 80 keycloak
```

Chờ Keycloak sẵn sàng, đăng nhập/làm mới lại. Không sửa middleware để bỏ kiểm tra phiên nhằm làm API trở lại 200.

### 10.26. OUTAGE-02 — Đồng bộ thao tác thất bại một phần

Các nhánh đã có test:

- Khóa user khi remote remediate lỗi: local vẫn khóa, response 202 PARTIAL.
- Mở user khi remote lỗi: response 202, local tiếp tục khóa.
- Đổi hồ sơ khi remote lỗi: response 503, giữ role cũ, tạm khóa user và action partial.
- Tạo user remote thành công rồi local ghi lỗi: thử vô hiệu hóa user remote.

Để tái hiện chính xác, dùng test mock `SESSION-03`, `SESSION-04` và `OPS: failed profile sync...`. **Tắt toàn bộ Keycloak rồi bấm Khóa không đảm bảo đi tới nhánh PARTIAL**, vì kiểm tra phiên admin có thể chặn yêu cầu trước khi thao tác được thực thi.

Khôi phục thực tế: sửa kết nối/credential/quyền service account, xem lịch sử action, đối chiếu user ở Keycloak, thực hiện lại thao tác cần thiết. Với hồ sơ lỗi, lưu lại hồ sơ rồi mở tài khoản sau khi xác nhận đồng bộ. Không chỉ đổi nhãn partial thành synced trong DB.

### 10.27. AUDIT-01 — Ghi log lỗi phải rollback nghiệp vụ

Chạy test `AUDIT-01` theo mục 11: test thay hàm ghi audit bằng lỗi mô phỏng `disk full`, gọi check-in và kiểm tra HTTP 503 cùng số bản ghi công bằng 0.

Đây là cách tạo lỗi có kiểm soát, không làm đầy ổ đĩa hoặc đổi quyền thư mục dữ liệu đang chạy. Backend xử lý lỗi ghi audit bằng `503 AUDIT_UNAVAILABLE` khi cả bước ghi lỗi cũng không thực hiện được.

Nếu xảy ra thật: kiểm tra dung lượng, quyền ghi, file DB/WAL và log terminal; khôi phục khả năng ghi rồi thử lại nghiệp vụ. Không báo check-in thành công khi không có bản ghi/audit xác nhận.

### 10.28. NET-01 — Đường dẫn riêng tư và sai host

Máy có `ca.crt`, thay IP nếu cần:

```powershell
curl.exe --cacert .\ca.crt -i https://10.0.103.227:8443/.env
curl.exe --cacert .\ca.crt -i https://10.0.103.227:8443/network/.local/server.key
curl.exe --cacert .\ca.crt -i https://10.0.103.227:8443/admin/
curl.exe --path-as-is --cacert .\ca.crt -i https://10.0.103.227:8443/a/%2e%2e/%2e%2e/.env
```

**Kỳ vọng:** đường bị chặn/không phục vụ (403/404 tùy đường và bước chuẩn hóa), không trả nội dung bí mật. Các trường hợp này đã nằm trong 29 kiểm tra SSO/HTTPS của biên bản LAN.

Gateway không công khai Keycloak Admin Console qua `/admin/`; quản trị trên máy chủ qua loopback. Host không khớp URL chuẩn bị 421 khi TLS đã thiết lập được.

## 11. Chạy bộ kiểm thử tự động

### 11.1. Backend — không cần hệ thống lab đang chạy

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd test
```

Lệnh chạy `audit.test.js`, `security.test.js`, `sso.test.js`, `operations.test.js`. Test tạo DB/khóa riêng hoặc dùng mock; không lấy private key Keycloak và không ghi vào SQLite lab đang phục vụ người dùng.

**Đã chạy lại ngày 04/11/2026: 97 test, 97 pass, 0 fail.** Cảnh báo `node:sqlite` experimental hoặc dòng thông báo audit lỗi được tạo có chủ đích trong test không tự là test fail; đọc tổng kết TAP và exit code.

### 11.2. Chạy từng nhóm để quan sát lỗi cụ thể

Trong thư mục `backend`:

```powershell
node --test --test-name-pattern='AUTH' security.test.js
node --test --test-name-pattern='RBAC|IDOR' security.test.js
node --test --test-name-pattern='ATT-|REQ-|RACE-' security.test.js
node --test --test-name-pattern='AUDIT-01|SESSION-03|SESSION-04' security.test.js
node --test sso.test.js
node --test --test-name-pattern='OPS: failed profile sync' operations.test.js
node --test --test-name-pattern='OPS:.*notification|OPS:.*session' operations.test.js
```

Các option đứng trước tên file. Những test không khớp có thể được báo skipped; không coi toàn bộ số test trong file đã được chạy. `operations.test.js` dùng identity mock và một verifier fixture giản lược để tập trung workflow; độ đúng JWT thực tế được kiểm tra ở `sso.test.js` và security tests, không suy từ riêng bộ OPS.

### 11.3. Tiện ích frontend và API client

Tại thư mục gốc:

```powershell
cd D:\IAM-ZeroTrust
node --test tests/frontend.test.mjs tests/api-client.test.mjs
```

**Đã chạy lại ngày 04/11/2026: 8 test, 8 pass, 0 fail.** Bao gồm tìm không dấu, escape/trung hòa CSV, chỉ xuất trường công khai, retry GET tại ranh giới thu hồi, không tự retry mutation và giữ code/request ID.

### 11.4. Cài công cụ kiểm thử trình duyệt

```powershell
cd D:\IAM-ZeroTrust
python -m pip install --no-user --target .tools -r tests/requirements.txt
```

Các script tự thêm `.tools` vào đường import. Bộ kiểm thử mặc định dùng Chrome đã cài, không cần tải Chromium riêng cho cấu hình hiện tại. `week3_sso.py` có `TEST_BROWSER_CHANNEL`; các bộ UI hiện dùng Chrome trực tiếp.

### 11.5. Kiểm thử trình duyệt với hệ thống thật

Giữ runner đang chạy, tài khoản demo đúng mật khẩu/trạng thái, chạy **tuần tự**:

```powershell
cd D:\IAM-ZeroTrust
$env:TEST_EVIDENCE_DIR = Join-Path $PWD ('evidence/sso-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
python -u tests/week3_sso.py
Remove-Item Env:\TEST_EVIDENCE_DIR
python -u tests/frontend_ui.py
python -u tests/operations_ui.py
```

`TEST_EVIDENCE_DIR` chỉ điều khiển thư mục của script SSO. UI vẫn ghi vào `evidence/ui-upgrade`, operations vào `evidence/api-upgrade`; sao lưu minh chứng cũ trước nếu muốn giữ từng lượt. Sau lệnh Python lỗi, kiểm tra nguyên nhân trước khi chạy script kế tiếp.

| Bộ | Kiểm tra chính | Tác động dữ liệu |
|---|---|---|
| `week3_sso.py` | SSO hai chiều, client/audience, quyền, logout, mobile, HTTPS khi LAN | Đăng nhập/đăng xuất và tạo audit/cảnh báo thử quyền |
| `frontend_ui.py` | Điều hướng, tìm/lọc/CSV, tạo/duyệt đơn, điều tra, khóa/mở và mobile | Tạo đơn/log có nhãn, khóa/mở employee02; có bước hoàn nguyên trạng thái |
| `operations_ui.py` | Tạo user, đổi role/nhóm, mật khẩu, thông báo, đăng nhập sai và phiên thật | Tạo tài khoản `uiops-...`, cuối lượt thành công khóa tài khoản để giữ lịch sử |

Nếu script dừng giữa chừng, kiểm tra báo cáo và trạng thái demo trước lần chạy sau; không mặc định cleanup đã hoàn tất. Đặc biệt user có required action OTP, bị brute-force hoặc đổi mật khẩu ngoài `.env` có thể làm script không đăng nhập được.

Trong HTTPS LAN, test browser cho phép chứng chỉ lab bằng `ignore_https_errors`; script SSO đồng thời kiểm tra CA/SAN riêng bằng Python TLS. Không suy từ việc browser tự động đi qua được rằng mọi máy người dùng đã tin cậy CA.

### 11.6. Kiểm thử cũ và phạm vi sử dụng

`tests/week2_browser.py` và `tests/browser_evidence.py` gắn nhiều giả định localhost/giao diện cũ. Không dùng chúng thay bộ SSO hiện tại hoặc chạy khi hệ thống đang đặt issuer LAN. Khi cần xem kết quả tuần cũ, đọc minh chứng đã lưu; muốn chạy lại cần kiểm tra tương thích kịch bản và giao diện trước.

### 11.7. Build kiểm tra

Localhost:

```powershell
Push-Location web-a
npm.cmd run build
Pop-Location
Push-Location web-b
npm.cmd run build
Pop-Location
```

LAN phải dùng `--base=/a/` và `--base=/b/` như mục 5.5. Build mặc định có thể thay asset path trong `dist`; sau đó phải build đúng base trước khi tiếp tục phục vụ LAN. Các build thành công trong biên bản 01/11 là dữ liệu lịch sử, không phải lần build mới khi soạn tài liệu này.

## 12. Bảng mã lỗi và cách xử lý

| HTTP/code | Ý nghĩa trong mã hiện tại | Cách xử lý/đối chiếu |
|---|---|---|
| 400 INVALID_JSON | Body không parse được JSON | Kiểm tra request payload và Content-Type |
| 400 INVALID_BODY | Body không phải object phù hợp | Gửi object JSON, không gửi array/string |
| 400 FIELD_NOT_ALLOWED | Có trường ngoài allowlist | Chỉ gửi các trường API nhận; xem nguy cơ mass assignment |
| 400 INVALID_DATE/TIME/REASON | Dữ liệu ngày/giờ/lý do sai | Kiểm tra UTC+7, 31 ngày, giờ và độ dài |
| 400 INVALID_REVIEW/ACTION | Quyết định/thao tác/ghi chú không hợp lệ | Dùng enum và độ dài theo endpoint |
| 400 INVALID_USER/EMAIL/PASSWORD | Hồ sơ hoặc mật khẩu sai | Kiểm tra họ tên, email, role, policy |
| 400 INVALID_SESSION | Thiếu sessionId hoặc lý do | Chọn phiên thật và nhập lý do |
| 400 INVALID_LIMIT/PAGE/SORT/FILTER/QUERY | Truy vấn danh sách sai | Đúng giới hạn và cột cho phép |
| 401 MISSING_TOKEN | Thiếu Bearer đúng dạng | Đăng nhập/gửi token phiên hiện tại |
| 401 INVALID_TOKEN | JWT sai hoặc verifier không xác minh được | Kiểm tra exp, issuer, audience, client, claim và JWKS |
| 401 SESSION_REVOKED | iat không vượt mốc thu hồi | Đăng nhập mới; xem ranh giới cùng giây |
| 401 SSO_SESSION_ENDED | sid không còn phiên tại Keycloak | Đăng nhập mới, kiểm tra logout phiên khác |
| 403 UNREGISTERED | sub chưa có hồ sơ | Tạo user qua app hoặc đối chiếu seed UUID |
| 403 ACCOUNT_DISABLED | Hồ sơ local khóa | Admin kiểm tra lý do và đồng bộ trước khi mở |
| 403 INSUFFICIENT_ROLE | Sai role endpoint hoặc không khớp hồ sơ | Đối chiếu role token và role local |
| 403 DASHBOARD_ACCESS_DENIED | Role không được vào Web B | Dùng Web A theo quyền hoặc tài khoản có quyền bảo mật |
| 403 CLIENT_SCOPE_DENIED | Token Web B gọi ngoài phạm vi | Dùng Web A cho nghiệp vụ công |
| 403 NOT_OWNER/CROSS_TEAM/SELF_APPROVAL | Sai chủ sở hữu/khác nhóm/tự duyệt | Dùng đúng luồng và người xử lý |
| 403 ORIGIN_DENIED | Origin không trong cấu hình | Dùng URL chuẩn, đối chiếu env/CORS |
| 403 PROTECTED_ADMIN | Nhắm tài khoản quản trị được bảo vệ | Kiểm tra và quản trị admin qua Console |
| 404 NOT_FOUND | Không tồn tại hoặc ngoài phạm vi nhìn thấy | Đối chiếu UUID/quyền sở hữu, không chỉ username |
| 409 ALREADY_CHECKED_IN/OUT | Chấm công lặp | Đọc trạng thái công; không gửi lặp |
| 409 NO_CHECK_IN | Chấm ra trước vào | Thực hiện đúng thứ tự |
| 409 CLOCK_ERROR | Giờ ra máy chủ trước giờ vào | Kiểm tra đồng hồ máy chủ |
| 409 DUPLICATE_REQUEST | Đã có đơn pending cùng ngày | Xem/rút đơn đang chờ nếu phù hợp |
| 409 ALREADY_REVIEWED | Đơn không còn pending | Xem trạng thái mới nhất |
| 409 DUPLICATE_USER | Username đã tồn tại | Tra cả local và Keycloak trước khi tạo lại |
| 409 ACTION_PENDING | Có thao tác cùng user đang xử lý | Đợi kết quả, xem lịch sử action |
| 413 BODY_TOO_LARGE | Body vượt 16 KiB | Giảm dữ liệu; không thay giới hạn chỉ để bỏ lỗi |
| 429 RATE_LIMIT | Vượt 120 request/user/phút mặc định | Chờ cửa sổ reset, giảm polling/thao tác lặp |
| 503 IDENTITY_UNAVAILABLE | Không xác nhận được thao tác/phiên/sự kiện Keycloak | Kiểm tra loopback, service secret, quyền và Keycloak |
| 503 AUDIT_UNAVAILABLE | Không ghi được nhật ký | Kiểm tra dung lượng/quyền/SQLite, xác minh rollback |
| 503 SERVICE_UNAVAILABLE | Nhánh lỗi chung chưa được phân loại | Đọc request ID, terminal và trạng thái DB/phụ thuộc |
| 202 PARTIAL | Chặn local/thao tác đã làm một phần, remote chưa xác nhận | Xem action, xử lý đồng bộ; không gọi là hoàn tất |
| 421 từ gateway | Host không khớp URL chuẩn | Mở đúng IP/DNS/cổng đã configure |

Không phải mọi lỗi đều sinh alert. `store.event` ghi audit và chỉ tạo alert cho mapping đang khai báo: `INSUFFICIENT_ROLE`, `CROSS_TEAM`, `NOT_OWNER`, `INVALID_TOKEN`, `SESSION_REVOKED`, `ACCOUNT_DISABLED`, `FIELD_NOT_ALLOWED`, `RATE_LIMIT`, `ORIGIN_DENIED`, `SELF_APPROVAL`. `LOGIN_ERROR` tạo alert từ collector. Các lỗi khác vẫn cần tra audit/phụ thuộc tương ứng.

## 13. API đang có và cấu trúc dữ liệu gửi

### 13.1. API nền tảng và nghiệp vụ

Mọi đường `/api` cần token, hồ sơ/role hợp lệ và phiên còn hiệu lực. Bảng quyền dưới đây tiếp tục chịu giới hạn client Web B đã mô tả ở mục 6.

| Method | Đường dẫn | Quyền/phạm vi | Dữ liệu chính |
|---|---|---|---|
| GET | `/health` | Công khai | Liveness backend, không audit qua middleware `/api` |
| GET | `/api/profile` | Người đã đăng nhập hợp lệ | Hồ sơ bản thân, role và lịch làm việc |
| GET | `/api/attendance` | Bản thân, token Web A | Query `month=YYYY-MM`; không dùng để xem người khác |
| POST | `/api/attendance/check-in` | Bản thân, Web A | Body `{}`; giờ và user do server xác định |
| POST | `/api/attendance/check-out` | Bản thân, Web A | Body `{}` |
| GET | `/api/corrections` | Bản thân, Web A | Tối đa 100 đơn gần nhất của mình |
| POST | `/api/corrections` | Bản thân, Web A | day, checkIn, checkOut, reason |
| GET | `/api/team` | manager/admin, Web A | Query month; manager chỉ nhóm mình |
| PATCH | `/api/corrections/:id` | manager/admin đúng phạm vi, Web A | decision, note; không tự duyệt |
| GET | `/api/security` | admin/auditor | 100 sự kiện/cảnh báo mới nhất và 30 action gần nhất |
| PATCH | `/api/security/alerts/:id` | admin | status, note điều tra |
| GET | `/api/admin/users` | admin | Danh sách hồ sơ công khai đã chọn trường |
| POST | `/api/admin/users/:id/actions` | admin, bảo vệ target admin | action, note |
| GET | `/api/security/keycloak` | admin/auditor | Chính sách và tối đa 30 sự kiện đọc trực tiếp |
| GET | `/api/manager` | manager/admin, Web A | Tài nguyên RBAC minh họa |
| GET | `/api/admin` | admin, Web A | Tài nguyên RBAC minh họa |
| GET | `/api/audit` | admin/auditor | Query limit 1–100, mặc định 20 |

### 13.2. Mười chín API mở rộng

| Method | Đường dẫn | Quyền/phạm vi | Dữ liệu chính |
|---|---|---|---|
| GET | `/api/security/events` | admin/auditor | Tìm, lọc, sort, phân trang audit |
| GET | `/api/security/events/:id` | admin/auditor | Event và related cùng request ID |
| GET | `/api/security/login-events` | admin/auditor | Sự kiện Keycloak đã lưu |
| GET | `/api/security/alert-list` | admin/auditor | Cảnh báo theo bộ lọc |
| GET | `/api/security/alerts/:id/context` | admin/auditor | Alert, 20 access và 20 login gần nhất cùng username |
| GET | `/api/security/summary` | admin/auditor | Số request, deny, user, alert và trạng thái collector |
| POST | `/api/security/sync` | admin | Body `{}`; đồng bộ ngay |
| POST | `/api/admin/users` | admin | username, name, email, team, role, password |
| GET | `/api/admin/users/:id` | admin | Hồ sơ, 20 event và 20 action gần nhất của target |
| PATCH | `/api/admin/users/:id` | admin, target được phép | name, team, role, note; email tùy chọn |
| POST | `/api/admin/users/:id/reset-password` | admin, target được phép | password, note |
| GET | `/api/admin/users/:id/sessions` | admin | Danh sách phiên target |
| POST | `/api/admin/users/:id/sessions/revoke` | admin, target được phép | sessionId, note |
| GET | `/api/me/sessions` | Bản thân | Danh sách phiên và cờ current |
| POST | `/api/me/sessions/revoke` | Bản thân | sessionId, note |
| GET | `/api/notifications` | Trong phạm vi người nhận | 100 item mới nhất và unread |
| PATCH | `/api/notifications/:id/read` | Người được đọc thông báo | Body `{}` |
| POST | `/api/notifications/read-all` | Trong phạm vi người nhận | Body `{}` |
| POST | `/api/corrections/:id/cancel` | Chủ đơn pending, Web A | Body `{}` |

Như vậy có **35 route `/api` được đăng ký và 1 route `/health`**, chưa tính OPTIONS do middleware xử lý và nhánh fallback 404.

### 13.3. Body và giới hạn chính

Đơn điều chỉnh, thay ngày bằng ngày hợp lệ khi thực hành:

```json
{
  "day": "2026-11-03",
  "checkIn": "08:00",
  "checkOut": "17:00",
  "reason": "Quên thao tác chấm công khi bắt đầu làm việc."
}
```

Duyệt/từ chối:

```json
{
  "decision": "approved",
  "note": "Đã đối chiếu thời gian và xác nhận trong nhóm."
}
```

`decision`: `approved` hoặc `rejected`; note 5–300 ký tự.

Hành động tài khoản:

```json
{
  "action": "revoke",
  "note": "Thu hồi phiên demo sau khi kiểm tra cảnh báo."
}
```

`action`: `revoke`, `disable`, `enable`, `require-mfa`; note 10–300 ký tự.

Điều tra:

```json
{
  "status": "reviewing",
  "note": "Đang đối chiếu sự kiện với tài khoản và thời điểm kiểm thử."
}
```

`status` khi cập nhật: `reviewing`, `resolved`, `false_positive`; note 10–500 ký tự. Trạng thái `open` do hệ thống tạo ban đầu, không nằm trong enum PATCH điều tra.

Tạo user nhận đủ sáu trường đã liệt kê. Không đưa mật khẩu minh họa cố định vào biên bản; nhập mật khẩu tạm thời riêng khi thực hành. Tất cả body bị kiểm tra allowlist, gửi dư trường có thể bị từ chối.

### 13.4. Truy vấn danh sách tại server

Ví dụ cho admin/auditor:

```text
/api/security/events?q=employee&decision=DENY&page=1&limit=20&sort=time&direction=desc
/api/security/login-events?type=LOGIN_ERROR&page=1&limit=20
/api/security/alert-list?status=open&severity=high&page=1&limit=20
```

| Tham số | Quy tắc |
|---|---|
| q | Tối đa 120 ký tự, chuẩn hóa tiếng Việt/đ/Đ và chữ thường |
| from, to | `YYYY-MM-DD`, ngày tồn tại, from không sau to |
| page | Số nguyên 1–100000 |
| limit | Số nguyên 1–200, mặc định 20 |
| direction | asc/desc khi dùng sort |
| sort events | time, username, path, status |
| sort alerts | kind, username, severity, count, updated_at, status |
| sort identity_events | time, username, type, client_id, ip_address, error |
| decision | ALLOW/DENY cho audit |
| severity | high/medium cho cảnh báo |
| status | open/reviewing/resolved/false_positive cho lọc cảnh báo |

Phản hồi có `items`, `total`, `page`, `limit`, `pages`. Ngày lọc đổi từ ranh giới UTC+7 sang khoảng UTC để so sánh timestamp. Summary có chuỗi tối đa 14 ngày có hoạt động gần nhất trong phạm vi truy vấn, không tự tạo đủ 14 ngày rỗng.

## 14. Chẩn đoán lỗi chạy và triển khai

### 14.1. Không nhận lệnh hoặc thiếu thư viện

| Hiện tượng | Kiểm tra | Cách xử lý |
|---|---|---|
| Không nhận node/python/docker | Các lệnh version ở mục 3 | Kiểm tra cài đặt/PATH, mở terminal mới |
| npm.ps1 bị execution policy chặn | Lệnh đang gọi npm hay npm.cmd | Dùng `npm.cmd` |
| Không có `node:sqlite` | `node --version` | Dùng Node đáp ứng yêu cầu 22.19+ của dự án |
| Cannot find module | Đúng cwd, thư mục node_modules | `npm.cmd ci` tại đúng backend/Web |
| No module named playwright | `.tools` có cài đúng chưa | Chạy lệnh pip ở mục 11.4 |
| Không mở được Chrome khi test | Chrome thực tế đã cài | Cài/kiểm tra Chrome; script UI hiện dùng channel chrome |
| OpenSSL không có | PATH hoặc đường Git for Windows | Cài công cụ, rồi chạy lại configure_network |

Nếu npm/pip lỗi DNS/proxy, kiểm tra kết nối và cấu hình proxy. Không đổi khóa package hoặc bỏ kiểm tra JWT để xử lý lỗi tải dependencies.

### 14.2. Docker/Keycloak không sẵn sàng

```powershell
cd D:\IAM-ZeroTrust
docker compose ps
docker compose logs --tail 100 postgres
docker compose logs --tail 100 keycloak
curl.exe -i http://127.0.0.1:8080/realms/master/.well-known/openid-configuration
```

PostgreSQL phải healthy trước khi Keycloak sẵn sàng. Runner chờ khoảng 120 lượt kiểm tra, mỗi lượt có timeout, nên không suy rằng vừa khởi động container là đăng nhập được ngay.

Nếu đổi mật khẩu DB trong `.env` sau khi volume đã có dữ liệu, giá trị khởi tạo PostgreSQL không tự cập nhật mật khẩu trong DB cũ. Đối chiếu credential đã dùng hoặc thực hiện thay đổi DB có kiểm soát; không xóa volume để “sửa nhanh” khi cần giữ danh tính.

Bootstrap admin Keycloak cũng không phải cơ chế tự reset mật khẩu admin tồn tại mỗi lần đổi env. Các script setup chủ động giữ mật khẩu demo đã có.

### 14.3. Cổng bị chiếm hoặc chạy trùng runner

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3001,5173,5174,8080,8443 } |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Đối chiếu PID với Task Manager/`Get-Process -Id SO_PID`. `SO_PID` phải thay bằng số thật. Dừng đúng terminal cũ bằng Ctrl+C rồi chạy lại một runner. Không dừng toàn bộ tiến trình Node của máy vì có thể có ứng dụng khác.

Vite dùng strictPort nên không tự chuyển sang cổng khác. Gateway luôn proxy API tới 3001 theo mã hiện tại; thay `PORT` backend tùy ý không đồng nghĩa gateway tự chuyển theo.

### 14.4. Sai chế độ localhost và LAN

Runner báo “modes must match” khi `--network` không khớp URL public. Dừng tiến trình cũ rồi chọn lại một bộ:

```powershell
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Hoặc configure host thật và chạy `--network`. Không chạy `setup_week2.py` riêng để vận hành bản hai Web rồi quên bước setup tuần 3, vì cấu hình nền Web A có thể được đặt lại trước khi `setup_week3.py` hoàn thiện theo chế độ mới.

### 14.5. Invalid redirect_uri, vòng lặp đăng nhập, thiếu sub hoặc 401 sau login

Đối chiếu lần lượt:

1. Địa chỉ đang mở có đúng host/cổng/path đã configure không?
2. `KEYCLOAK_PUBLIC_URL` và issuer frontend/backend có thống nhất không?
3. Client ID đúng `employee-portal`/`security-dashboard` chưa?
4. Redirect URI/Web Origin có đúng `/a/`, `/b/` hoặc cổng localhost không?
5. Có gán scope `basic` và roles thực tế trên client chưa?
6. Audience mapper đúng employee-api/security-api chưa?
7. Đã restart backend và build/restart frontend sau đổi env chưa?
8. User có hồ sơ `sub` đúng UUID và role khớp chưa?

Chạy lại runner/setup tuần 3 sau khi xác nhận env đúng; setup dùng Admin API để đối chiếu client/scope/mapper. Không coi việc decode JWT đọc được payload là token đã được xác minh.

Issuer công khai trong token LAN phải là HTTPS công khai. `KEYCLOAK_INTERNAL_ISSUER` dùng loopback chỉ để backend truy cập JWKS/Admin API, không thay tiêu chuẩn issuer công khai phải khớp.

### 14.6. Trang trắng, asset 404 hoặc còn giao diện cũ

- Mở DevTools Console và Network, xem file JS/CSS lỗi đầu tiên.
- Với LAN, kiểm tra đã build `--base=/a/`/`--base=/b/` chưa.
- Mở đúng `/a/` hoặc `/b/`, không truy cập asset bằng base localhost cũ.
- Build lại rồi Ctrl+F5. Nếu sửa component shared, cả Web A/B đều có thể cần build lại.
- Error boundary hiển thị thông báo tải lại khi React render lỗi; cần đọc lỗi Console để tìm nguyên nhân.

### 14.7. Chứng chỉ không tin cậy hoặc SAN không khớp

Kiểm tra ngày/giờ máy, CA đang cài, host truy cập và chứng chỉ máy chủ còn hạn. Nếu IP đổi, configure lại cho IP mới. Cài CA không sửa được việc mở sai hostname/SAN.

Để xác minh bằng OpenSSL khi lệnh có trong PATH:

```powershell
openssl x509 -in network/.local/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

HTTP qua IP LAN không tạo secure context cần cho PKCE như localhost. Cách xử lý là cấu hình HTTPS/CA đúng, không tắt PKCE hoặc kiểm tra token.

### 14.8. Máy khách không vào được nhưng máy chủ vào được

1. `Test-NetConnection IP -Port 8443` trên máy khách.
2. Nếu TCP fail: đúng IP, cùng LAN/VPN, runner/gateway còn chạy, firewall, route và Wi-Fi client isolation.
3. Nếu TCP pass nhưng TLS fail: CA/SAN/thời hạn/đồng hồ.
4. Nếu TLS đúng nhưng 421: sai host chuẩn.
5. Nếu trang tĩnh đúng nhưng API 503: backend/upstream hoặc xác nhận phiên.
6. Nếu login chuyển localhost trên máy khách: URL public/client vẫn cấu hình sai.

`localhost` trên máy khách trỏ về chính máy khách. Máy khách không cần cài Node/Docker, không cần truy cập trực tiếp backend 3001 hoặc Keycloak 8080.

### 14.9. 503 Keycloak, thiếu service credential hoặc không có sự kiện

Kiểm tra Keycloak loopback, `attendance-control`, secret ở backend, quyền service account và terminal collector. Chạy lại setup tuần 3 rồi restart backend nếu cần đồng bộ credential. Không in secret ra terminal/chụp ảnh để đối chiếu.

Nếu đăng nhập sai nhưng chưa thấy alert: kiểm tra Keycloak có `LOGIN_ERROR`, collector đã sync, có lỗi lần sync gần nhất không, bộ lọc username/ngày đúng chưa và alert có đang gộp vào bản cũ không. Events cũ có thể hết thời gian lưu ở Keycloak; collector chưa có backfill đầy đủ.

### 14.10. Test báo spawn EPERM

Khi soạn tài liệu, môi trường chạy công cụ giới hạn quyền tạo tiến trình con nên `node --test` từng báo `spawn EPERM`; chạy cùng lệnh với quyền thực thi phù hợp đã đạt 97/97 và 8/8. Đây là lỗi khởi chạy test, không phải bằng chứng assertion nghiệp vụ thất bại.

Trên máy thực hành, kiểm tra policy/sandbox/antivirus đang chặn tạo tiến trình. Không sửa production code hoặc đổi kỳ vọng test chỉ để che lỗi môi trường.

## 15. Minh chứng hiện có, số liệu và cách lưu lượt mới

### 15.1. Các mốc kết quả

| Phạm vi | Kết quả | Thời điểm/nguồn |
|---|---|---|
| Web A/RBAC trong báo cáo tuần 3 | 16 ô ma trận đúng HTTP; thiếu token 401; backend 54/54 | [Minh chứng tuần 3](word/minh_chung/tuan3/README.md), 01/11/2026 |
| Web B/SSO giai đoạn 3, tương ứng tuần 4 | Backend 73/73, browser HTTPS 29/29, 11 ảnh, build A/B đạt | [Browser](evidence/week3/browser-results.json), [summary](evidence/week3/validation-summary.json), 01/11/2026 |
| Nâng cấp giao diện | 42/42 UI, 18 ảnh, 4/4 tiện ích lúc đó | [UI results](evidence/ui-upgrade/results.json), 01/11/2026 |
| Mở rộng API/nghiệp vụ | Backend 97/97; browser 23/23, 8 ảnh | [TAP](evidence/api-upgrade/backend-tests.tap), [browser](evidence/api-upgrade/browser-results.json), 01/11/2026 |
| Kiểm tra lại khi soạn tài liệu | Backend 97/97, 0 fail | Chạy lại `npm.cmd test`, 04/11/2026 |
| Kiểm tra lại khi soạn tài liệu | Tiện ích/API client 8/8, 0 fail | Chạy lại hai file test Node, 04/11/2026 |

Số 54, 73, 97 là các bộ backend ở những mốc phát triển khác nhau, không cộng thành tổng test duy nhất. Bộ 8 tiện ích/API client hiện gồm 4 tiện ích và 4 API client. Các biên bản trình duyệt nêu trên là lịch sử 01/11; khi soạn tài liệu này chưa chạy lại đăng nhập trình duyệt hoặc build hệ thống.

### 15.2. Ảnh nên dùng theo nội dung

| Nội dung trình bày | Minh chứng |
|---|---|
| Web A trong lượt SSO | `evidence/week3/01-web-a-admin.png` |
| Web B admin, cảnh báo, audit, tài khoản | `evidence/week3/02-web-b-admin.png` đến `05-web-b-accounts.png` |
| Logout hai chiều | `evidence/week3/06-logout-b-ends-a.png`, `09-logout-a-ends-b.png` |
| Auditor/mobile/từ chối quyền | Các ảnh `07`, `08`, `10` trong `evidence/week3` |
| Launcher, điều hướng, responsive mới | `evidence/ui-upgrade/` |
| Tạo user, đổi role/nhóm, phiên | `evidence/api-upgrade/01-created-employee.png` đến `03-personal-sessions.png` |
| Thông báo, login error, ngữ cảnh, request ID | `evidence/api-upgrade/04-notification-center.png` đến `07-event-detail.png` |
| Bản dùng trong DOCX tuần 4 | [Danh mục minh chứng tuần 4](word/minh_chung/tuan4/README.md) |

Ảnh đăng nhập lại sau logout cần đi kèm kết quả API token cũ trong JSON; một ảnh trang đăng nhập riêng lẻ chưa chứng minh JWT bị thu hồi.

### 15.3. Mẫu biên bản cho một tình huống lỗi

```text
Mã tình huống:
Ngày giờ UTC+7:
Chế độ: localhost / HTTPS LAN
Tài khoản, role, Web:
Điều kiện trước khi thử:
Method và path:
Dữ liệu thử đã loại mật khẩu/token:
Kết quả mong đợi: HTTP, code, trạng thái dữ liệu
Kết quả thực tế: HTTP, code, request ID
Audit/cảnh báo tìm được:
Trạng thái dữ liệu sau thử:
Ảnh/JSON đính kèm:
Cách khôi phục và kết quả khôi phục:
Đánh giá: đạt / không đạt / chưa xác nhận
```

Một test từ chối đạt cần có cả HTTP/code đúng **và dữ liệu không thay đổi trái phép**. Với audit rollback cần chứng minh không có bản ghi nghiệp vụ; với partial cần ghi đúng trạng thái local/remote; với SSO cần đúng cùng profile và token riêng từng client.

### 15.4. Lưu log kiểm thử lượt mới

Ví dụ lưu bộ backend vào thư mục mới bằng PowerShell:

```powershell
cd D:\IAM-ZeroTrust
$testOutputDir = Join-Path $PWD ('evidence/manual-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $testOutputDir | Out-Null
Push-Location backend
npm.cmd test 2>&1 | Tee-Object -FilePath (Join-Path $testOutputDir 'backend-tests.tap')
$backendTestExit = $LASTEXITCODE
Pop-Location
Write-Output "Backend exit code: $backendTestExit"
node --test tests/frontend.test.mjs tests/api-client.test.mjs 2>&1 |
  Tee-Object -FilePath (Join-Path $testOutputDir 'frontend-api-tests.tap')
$clientTestExit = $LASTEXITCODE
Write-Output "Client tests exit code: $clientTestExit"
```

Lưu thêm ngày giờ, phiên bản runtime, cấu hình chế độ và ảnh đã loại bí mật. Không ghi toàn bộ env hoặc copy request Authorization. `evidence/` đang được Git bỏ qua; nếu chuyển máy cần chủ động mang theo minh chứng phù hợp.

## 16. Sao lưu, khôi phục và chuẩn bị demo

### 16.1. Dữ liệu cần giữ

- PostgreSQL/volume: toàn bộ danh tính, realm/client/role và dữ liệu Keycloak.
- SQLite ứng dụng: bảng công, hồ sơ, audit, action, thông báo.
- Cấu hình local và khóa TLS: lưu ở nơi riêng được kiểm soát, không trộn vào tài liệu nộp.
- `staff.json` seed và minh chứng nếu cần tái tạo/đối chiếu.

Không sao chép riêng file `.sqlite` khi dữ liệu mới còn nằm trong WAL. Ví dụ dưới dừng backend trước rồi dùng API backup của SQLite qua Python để tạo bản sao nhất quán, kể cả khi file WAL vẫn còn. Không ghi đè DB đang được backend sử dụng.

Ví dụ sau khi Ctrl+C runner/backend, tạo bản sao mới:

```powershell
cd D:\IAM-ZeroTrust
$backupDir = Join-Path $PWD ('evidence/backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupDir | Out-Null
python -c "import sqlite3,sys; src=sqlite3.connect('file:backend/data/attendance.sqlite?mode=ro',uri=True); dst=sqlite3.connect(sys.argv[1]); src.backup(dst); dst.close(); src.close()" (Join-Path $backupDir 'attendance.sqlite')
if (Test-Path -LiteralPath backend/data/staff.json) {
  Copy-Item -LiteralPath backend/data/staff.json -Destination $backupDir
}
```

Đây chỉ là backup ứng dụng, chưa gồm PostgreSQL. Muốn giữ toàn bộ lab cần có bản sao PostgreSQL phù hợp bằng công cụ DB/backup volume và kiểm tra khả năng khôi phục riêng. Không khôi phục SQLite từ lab khác rồi mặc định UUID vẫn khớp Keycloak hiện tại.

### 16.2. Khi thử nghiệm làm đổi trạng thái user

Trước buổi demo kiểm tra employee01/02 có enabled, role đúng, hồ sơ không khóa, không required action ngoài dự kiến và mật khẩu khớp dữ liệu được cấp. Các script setup giữ mật khẩu hiện có, không tự xóa OTP hoặc brute-force state.

Nếu thử đổi role demo, phục hồi qua luồng quản trị app để cả local và Keycloak khớp; không chỉ sửa một bên. Nếu user `uiops-...` đã được test operations tạo và khóa, giữ lịch sử theo thiết kế; không sử dụng password ngẫu nhiên của lượt đó làm tài khoản demo cố định.

### 16.3. Kịch bản trình bày khoảng 15–20 phút

1. **Hạ tầng:** Docker Compose có PostgreSQL healthy và Keycloak chạy; giới thiệu PostgreSQL/SQLite lưu gì.
2. **Web A:** employee01 chấm công và tạo đơn hôm qua; manager01 đúng nhóm duyệt; xem kết quả/notification.
3. **Phân quyền:** employee01 gọi trực tiếp API admin nhận 403; admin tra audit và cảnh báo theo request ID.
4. **SSO:** profile admin01 mở A rồi B không nhập lại mật khẩu; giải thích client/audience riêng.
5. **Least privilege:** auditor đọc được nhưng không quản trị; token Web B gọi chấm công bị 403.
6. **Thu hồi:** employee02 giữ token snapshot, admin thu hồi, API token cũ nhận 401.
7. **Đăng nhập sai:** một lần sai mật khẩu demo, đồng bộ Keycloak, mở log và ngữ cảnh cảnh báo.
8. **Kiểm thử:** trình bày tổng kết 97 backend + 8 tiện ích/API client và biên bản browser tương ứng.
9. **Giới hạn:** MFA OTP/LDAP/Python Detection/audit tập trung và máy khách thứ hai chưa được xác nhận đầy đủ.

Không dừng Keycloak giữa buổi demo chính nếu chưa dành thời gian phục hồi. Dùng bộ test mock để trình bày nhánh partial, audit lỗi và race condition; khi muốn demo outage thật, làm cuối và khôi phục như mục 10.25.

## 17. Những điểm kỹ thuật có thể giải thích khi bảo vệ

**Vì sao dùng Keycloak?** Tập trung xác thực/danh tính/phiên, các Web là OIDC client; ứng dụng không tự xây nơi kiểm tra mật khẩu.

**SSO hoạt động thế nào?** Hai client dùng cùng realm và cookie phiên Keycloak trong cùng profile. Chuyển Web vẫn có OIDC flow nhưng không phải nhập lại mật khẩu khi phiên còn hiệu lực.

**Vì sao mỗi client có audience riêng?** API đối chiếu token dành cho ứng dụng nào; kết hợp azp và danh sách đường cho phép để token Security không dùng chấm công.

**Vì sao cần PKCE khi public client không giữ secret?** Code phải được đổi bằng verifier tương ứng với challenge S256. React không có nơi giữ client secret một cách bí mật.

**Vì sao ẩn nút chưa đủ?** Người dùng có thể gọi HTTP trực tiếp; JWT, role, nhóm, chủ sở hữu và workflow phải được kiểm tra ở backend.

**RBAC khác ràng buộc nhóm/chủ sở hữu ra sao?** Role trả lời có chức năng nào; team/owner tiếp tục giới hạn bản ghi cụ thể. Manager không được duyệt nhóm khác hoặc tự duyệt.

**Vì sao JWT đúng chữ ký vẫn bị 401 sau logout?** Chữ ký/thời hạn không tự nói phiên còn tồn tại. Backend có mốc thu hồi local và kiểm tra sid thực tế tại Keycloak.

**Vì sao có 202 PARTIAL?** DB local và Keycloak không cùng một transaction phân tán. API cần phản ánh mức thực thi đã xác nhận, giữ chặn local phù hợp và cho phép xử lý lại remote.

**Vì sao audit phải cùng transaction công/đơn?** Tránh ghi nghiệp vụ thành công trong khi mất nhật ký đối chiếu. Test mô phỏng lỗi audit xác nhận rollback công.

**Vì sao có HTTPS nội bộ?** TLS bảo vệ truy cập mạng và đáp ứng secure context cho Web Crypto/PKCE qua IP LAN. CA riêng phải được máy khách tin cậy và SAN phải khớp địa chỉ truy cập.

**Đã đạt Zero Trust đầy đủ chưa?** Đã áp dụng xác minh token/phiên, quyền tối thiểu theo role/client/team/owner và audit trong phạm vi lab. Chưa thể từ đó kết luận một kiến trúc Zero Trust vận hành đầy đủ; các khoảng trống được nêu ở mục 1.2.

## 18. Tài liệu đối chiếu trong dự án

- [Tiến độ và các giai đoạn](tiendo.md).
- [Tuần 4 — Web B và SSO](tuan4.md).
- [Chấm công và quản trị giai đoạn trước](tuan2.md).
- [Cách chạy nhanh](CHAY_NHANH.md).
- [Kết nối hai máy, HTTPS và CA](docs/KET_NOI_HAI_MAY.md).
- [Giao diện và cách thao tác](docs/NANG_CAP_GIAO_DIEN.md).
- [Chức năng và 19 API bổ sung](docs/CHUC_NANG_VA_API.md).
- [Kịch bản bảo mật nghiệp vụ trước đó](docs/KIEM_THU_BAO_MAT_TUAN_2.md).
- [Báo cáo Word tuần 4](word/BaoCaoTuan4_LeMinhNhat_NguyenMinhTuan.docx).

Tài liệu được đối chiếu mã nguồn và minh chứng có trong workspace tại ngày tổng hợp. Những bước tái hiện là hướng dẫn để thực hành lại; khi có lượt chạy mới cần ghi kết quả thực tế theo mẫu biên bản, đặc biệt nếu đổi URL, trạng thái demo, runtime hoặc mã nguồn.
