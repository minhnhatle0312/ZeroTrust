# Hướng dẫn chạy và lấy minh chứng tuần 1 — IAM-ZEROTRUST

Ngày đối chiếu: **21/10/2026**. Phạm vi theo [tuan1.md](tuan1.md): Docker/PostgreSQL/Keycloak, đăng nhập web, JWT, phân quyền và bước đầu Audit Log. Hướng dẫn dùng **Windows PowerShell**, chạy tại `D:\IAM-ZeroTrust`. Nếu lưu dự án nơi khác, thay đường dẫn tương ứng.

**Kết quả chạy trên máy này:** ngày 21/10/2026 lúc 21:06:39–21:06:50 (UTC+7), script kiểm thử đạt **51/51 kiểm tra**, gồm 16 tổ hợp phân quyền và đăng nhập/đăng xuất bốn user; có **10 ảnh trình duyệt thật**. Hai kiểm thử Audit Log và build frontend cũng thành công. Xem [verification.json](evidence/week1/verification.json) để đối chiếu số liệu; JSON lưu thời gian theo UTC.

## 1. Đã làm được gì?

| Thành phần | Đã có trước khi rà soát | Hoàn thiện trong lần này | Tác dụng |
|---|---|---|---|
| Docker Compose | Khai báo PostgreSQL 17, Keycloak 26.8.0, network, volume, healthcheck | Xác nhận container thực tế, kiểm tra PostgreSQL nhận kết nối, lưu đầu ra lệnh | Chứng minh môi trường thực sự chạy |
| Keycloak | Trên database đã có realm, client, role và 4 user demo | Thêm cấu hình và script dựng lại trên máy mới, bật lưu events | Có thể tái triển khai; xem lịch sử đăng nhập |
| Employee API | Kiểm tra Bearer JWT, RS256, issuer, audience và role | Bổ sung Audit Log JSONL, đọc log qua API có phân quyền, từ chối nếu không ghi được log | Theo dõi yêu cầu được phép/bị từ chối |
| React/Vite | Đăng nhập Keycloak, hiển thị user/role, nút gọi API | Cố định cổng 5173, kiểm thử đăng nhập và đăng xuất bằng trình duyệt | Trình diễn toàn bộ luồng xác thực và phân quyền |
| Kiểm thử/minh chứng | Chưa lưu kết quả chạy thực tế | Thêm `tests/browser_evidence.py`, kiểm thử audit và thư mục `evidence/week1` | Tái hiện kết quả thay vì chỉ mô tả cấu hình |

**Lưu ý về phạm vi:** đây là nền tảng IAM áp dụng xác thực rõ ràng và phân quyền tối thiểu theo vai trò. Chưa phải hệ thống Zero Trust hoàn chỉnh. Các thư mục `ldap`, `web-b`, `python-detector`, `audit-service` chưa có dịch vụ triển khai; tuần 1 không bao gồm LDAP, SSO nhiều ứng dụng, phát hiện bất thường hay SIEM. Audit hiện nằm trong backend, chưa là dịch vụ độc lập.

## 2. Kiến trúc và địa chỉ cần nhớ

```text
Trình duyệt → React/Vite: http://localhost:5173
    ├─ đăng nhập → Keycloak: http://localhost:8080
    │                  └─ JDBC → PostgreSQL:5432 (mạng Docker nội bộ)
    └─ Bearer token → Employee API: http://localhost:3001
                         ├─ lấy khóa công khai JWKS từ Keycloak
                         ├─ kiểm tra chữ ký, issuer, audience, hạn token và role
                         └─ ghi backend/data/audit.jsonl
```

| Đối tượng | Giá trị |
|---|---|
| Keycloak Admin Console | `http://localhost:8080/admin/` |
| Realm ứng dụng | `company-iam` |
| Client trình duyệt | `employee-portal` |
| Audience mà API chấp nhận | `employee-api` |
| Issuer token | `http://localhost:8080/realms/company-iam` |
| API kiểm tra sẵn sàng | `http://localhost:3001/health` |
| File log API | `backend/data/audit.jsonl` |

**Luôn mở frontend bằng `http://localhost:5173`.** Vite có thể in `127.0.0.1`, nhưng redirect URI và CORS trong bài thực hành dùng `localhost`. Hai tên này khác origin. Trong Compose chỉ PostgreSQL và Keycloak chạy bằng container; backend và frontend chạy bằng Node.js trên Windows.

## 3. Chuẩn bị phần mềm

Cài Docker Desktop (Linux containers/WSL2), Node.js 22, Python 3.11 hoặc mới hơn và Chrome hoặc Edge nếu chạy script chụp ảnh. Mở Docker Desktop và đợi Engine hoạt động.

```powershell
Set-Location D:\IAM-ZeroTrust
docker version
docker compose version
node --version
npm.cmd --version
python --version
```

`docker version` phải có cả Client và Server. Nếu báo lỗi kết nối pipe, mở Docker Desktop, đợi Engine rồi thử lại. Nếu báo không tìm thấy lệnh Docker sau khi cài, đóng/mở lại terminal. Dùng `npm.cmd` để tránh PowerShell chặn thực thi `npm.ps1`.

## 4. Tạo cấu hình môi trường

```powershell
Set-Location D:\IAM-ZeroTrust
python scripts/init_env.py
```

Script tạo các giá trị còn thiếu trong `.env`, tự sinh mật khẩu ngẫu nhiên và tạo `backend/.env`, `web-a/.env.local` từ file mẫu. **Giá trị đã tồn tại được giữ nguyên.** Nếu một biến đã có nhưng để trống, script báo lỗi để bạn điền lại.

Mở `.env` bằng trình soạn thảo để lấy mật khẩu khi đăng nhập:

| Tài khoản | Nơi đăng nhập | Biến lưu mật khẩu |
|---|---|---|
| Giá trị `KEYCLOAK_ADMIN` (mặc định `admin`) | Admin Console, realm `master` | `KEYCLOAK_ADMIN_PASSWORD` |
| `admin01` | Portal, realm `company-iam` | `TEST_ADMIN01_PASSWORD` |
| `manager01` | Portal, realm `company-iam` | `TEST_MANAGER01_PASSWORD` |
| `employee01` | Portal, realm `company-iam` | `TEST_EMPLOYEE01_PASSWORD` |
| `auditor01` | Portal, realm `company-iam` | `TEST_AUDITOR01_PASSWORD` |

`admin` quản trị Keycloak; `admin01` có role admin của ứng dụng. Không dùng lẫn hai tài khoản. Không chụp ảnh `.env` hoặc access token để đưa vào báo cáo.

## 5. Khởi chạy Docker, PostgreSQL và Keycloak

```powershell
Set-Location D:\IAM-ZeroTrust
docker compose config --quiet
docker compose up -d
docker compose ps
docker compose logs --tail 30 keycloak
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Kết quả mong đợi:

- `iam-postgres`: trạng thái `Up ... (healthy)`.
- `iam-keycloak`: trạng thái `Up ...`, cổng `127.0.0.1:8080->8080/tcp`.
- `pg_isready`: `accepting connections`.
- Log Keycloak có dòng khởi động xong và `Listening on: http://0.0.0.0:8080`.

Keycloak hiện **không khai báo Docker healthcheck**; trạng thái `Up` chỉ chứng minh tiến trình đang chạy. Kiểm tra thêm discovery endpoint để biết realm có phản hồi hay chưa:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/realms/master/.well-known/openid-configuration |
    Select-Object issuer,authorization_endpoint,token_endpoint
```

Sau lần khởi động đầu, chờ Keycloak sẵn sàng rồi chạy bước 6. Named volume giữ database khi dừng/khởi động lại container. Không đổi mật khẩu PostgreSQL trong `.env` rồi kỳ vọng database cũ tự đổi mật khẩu theo.

**Minh chứng Docker:** mở Docker Desktop → Containers → nhóm `iam-zerotrust`; mở rộng để thấy `iam-postgres` và `iam-keycloak`, trạng thái và cổng. Dùng `Win + Shift + S` chụp cửa sổ này. Chụp thêm terminal chạy `docker compose ps` và `pg_isready`. Có thể xem Volumes để thấy volume có hậu tố `postgres_data`; network có hậu tố `iam-network`. Tên tiền tố phụ thuộc tên thư mục/project Compose.

## 6. Hoàn thiện cấu hình Keycloak

```powershell
Set-Location D:\IAM-ZeroTrust
python scripts/setup_keycloak.py
python scripts/inspect_keycloak.py
```

Script `setup_keycloak.py` đọc [keycloak/lab-config.json](keycloak/lab-config.json) và gọi Keycloak Admin API để:

1. Tạo realm `company-iam` nếu chưa có.
2. Tạo các realm role `admin`, `manager`, `employee`, `auditor` nếu thiếu.
3. Tạo/cập nhật client public `employee-portal`, bật Standard Flow và bắt buộc PKCE S256; tắt Implicit Flow và Direct Access Grants.
4. Cấu hình redirect/logout URI và web origin cho `http://localhost:5173`.
5. Tạo/cập nhật audience mapper thêm `employee-api` vào access token.
6. Tạo 4 user demo nếu chưa có và gán role tương ứng. Mật khẩu của user đã tồn tại được giữ nguyên; nếu có role ứng dụng xung đột, script dừng để bạn kiểm tra.
7. Bật User Events và Admin Events, đặt thời gian lưu User Events 7 ngày. Không lưu chi tiết biểu diễn tài nguyên của Admin Events.

**Vì sao cần audience mapper?** Backend chỉ nhận token có `aud` chứa `employee-api`; đăng nhập thành công mà thiếu claim này vẫn sẽ bị API từ chối `401`. `employee-api` ở đây là custom audience, không bắt buộc tạo thêm một client cùng tên.

Script có thể chạy lại để đối chiếu cấu hình lab mà không xóa realm hoặc database. Không cần import bằng tay. Đây là cấu hình dành cho bài thực hành localhost; client đang có sẽ được cập nhật các trường nêu trên.

**Xem và chụp cấu hình trong Admin Console:**

1. Mở `http://localhost:8080/admin/`, đăng nhập bằng `KEYCLOAK_ADMIN` và mật khẩu trong `.env`.
2. Chuyển realm từ `master` sang **company-iam**.
3. **Realm roles**: chụp bốn role ứng dụng.
4. **Clients → employee-portal → Settings**: kiểm tra Client authentication tắt, Standard flow bật; chụp phần redirect URI và Web origins. PKCE S256 nằm trong phần cài đặt nâng cao tương ứng phiên bản UI.
5. **Clients → employee-portal → Client scopes → employee-portal-dedicated**: xem mapper `employee-api-audience`, chụp giá trị custom audience `employee-api`.
6. **Users**: tìm từng user; vào **Role mapping** để xem role. Nếu danh sách trống ban đầu, dùng tìm kiếm/“View all users”.
7. Sau khi chạy bước 8, mở **Events → User events** để chụp `LOGIN`, `CODE_TO_TOKEN`, `LOGOUT`. Đăng nhập mới sau khi bật events mới có bản ghi.

Nếu database cũ chứa mật khẩu demo khác `.env`, vào **Users → user tương ứng → Credentials → Reset password**, đặt giá trị trùng biến `TEST_..._PASSWORD` và tắt Temporary. Không cần đổi mật khẩu nếu đăng nhập đã hoạt động.

## 7. Khởi chạy backend và frontend

Mở **terminal thứ nhất**, giữ terminal này chạy:

```powershell
Set-Location D:\IAM-ZeroTrust\backend
npm.cmd ci
npm.cmd start
```

Kết quả: `Employee API: http://localhost:3001`. Mặc định backend tự tạo `backend/data/audit.jsonl`.

Mở **terminal thứ hai**, giữ terminal này chạy:

```powershell
Set-Location D:\IAM-ZeroTrust\web-a
npm.cmd ci
npm.cmd run dev
```

Mở **terminal thứ ba** để kiểm tra và chạy lệnh lấy minh chứng:

```powershell
Set-Location D:\IAM-ZeroTrust
Invoke-RestMethod http://127.0.0.1:3001/health
```

Kết quả mong đợi: `status: OK`, `service: Employee API`. Sau đó mở **http://localhost:5173**. Ứng dụng tự chuyển sang trang đăng nhập Keycloak.

## 8. Thực hành đăng nhập và chứng minh phân quyền

Đăng nhập lần lượt từng user ở bảng dưới. Sau mỗi tài khoản, nhấn **Đăng xuất** rồi đăng nhập tài khoản kế tiếp (hoặc dùng cửa sổ riêng tư mới). Trên Portal, nhấn từng thẻ tài nguyên và xem ô “Kết quả từ Employee API”.

| User/role | Hồ sơ cá nhân `/api/profile` | Quản lý `/api/manager` | Quản trị `/api/admin` | Nhật ký `/api/audit` |
|---|---|---|---|---|
| `employee01` / employee | 200 ALLOW | 403 DENY | 403 DENY | 403 DENY |
| `manager01` / manager | 200 ALLOW | 200 ALLOW | 403 DENY | 403 DENY |
| `auditor01` / auditor | 200 ALLOW | 403 DENY | 403 DENY | 200 ALLOW |
| `admin01` / admin | 200 ALLOW | 200 ALLOW | 200 ALLOW | 200 ALLOW |

**200**: token hợp lệ và đủ quyền. **401**: thiếu token hoặc token không hợp lệ/hết hạn. **403**: token hợp lệ nhưng thiếu role. Hồ sơ cá nhân chỉ yêu cầu xác thực, không yêu cầu một role cụ thể.

Chụp tối thiểu các trường hợp:

1. Trang đăng nhập Keycloak trước khi nhập mật khẩu.
2. `employee01` → Hồ sơ cá nhân → **200 ALLOW** (thấy username, role và kết quả).
3. `employee01` → Quản trị hệ thống → **403 DENY**.
4. `manager01` → Tài nguyên quản lý → **200 ALLOW**.
5. `admin01` → Quản trị hệ thống → **200 ALLOW**.
6. `auditor01` → Nhật ký kiểm toán → **200**, thấy các bản ghi truy cập thật.

Minh chứng không có token và token lỗi có thể chạy bằng `curl.exe` (lệnh này không tự lấy token từ phiên trình duyệt):

```powershell
curl.exe --noproxy "*" -i http://127.0.0.1:3001/api/profile
curl.exe --noproxy "*" -i -H "Authorization: Bearer invalid-token" http://127.0.0.1:3001/api/admin
```

Cả hai phải trả **HTTP 401** và `status: DENY`. Chụp terminal có cả lệnh và mã HTTP. Phân quyền được thực thi ở backend nên việc gọi trực tiếp API không bỏ qua được bước kiểm tra quyền.

## 9. Chứng minh Audit Log đang hoạt động

Sau khi thao tác bước 8:

```powershell
Set-Location D:\IAM-ZeroTrust
Get-Content .\backend\data\audit.jsonl -Tail 10
```

Mỗi dòng là một JSON với `timestamp`, `requestId`, `username`, `roles`, `method`, `path`, `httpStatus`, `decision`, `reason`. Tìm các bản ghi `ALLOW`/200, `DENY`/401 và `DENY`/403. `requestId` xuất hiện trong response và header `X-Request-Id` để đối chiếu cùng một yêu cầu.

- API xác thực/ra quyết định → ghi log → trả response. Nếu file không ghi được, response trả `503 DENY`.
- `/api/audit` chỉ cho auditor hoặc admin. Mặc định trả 20 bản ghi gần nhất; `?limit=1..100` điều chỉnh số lượng, giá trị sai trả 400 với người đủ quyền.
- Bản ghi đọc log của chính yêu cầu hiện tại được ghi sau khi chọn danh sách, nên thấy ở lần đọc kế tiếp.
- API đọc tối đa phần đuôi 256 KiB của file; nếu log tăng rất lớn, có thể trả ít hơn số bản ghi yêu cầu.
- Log không chứa password, Authorization header hay token. Username/path/trạng thái là dữ liệu minh chứng.
- Log là file cục bộ append; chưa có xoay vòng, chống sửa/xóa, chuyển log tập trung hoặc bảo đảm chống mất dữ liệu khi hệ điều hành gặp sự cố.
- Không ghi `/health`, file frontend, các yêu cầu bị middleware CORS/parser xử lý trước middleware audit. Keycloak tự lưu sự kiện đăng nhập trong database riêng; đây là hai nguồn log khác nhau.

**Chứng minh lưu qua khởi động lại backend:** xem vài dòng cuối, dừng terminal backend bằng `Ctrl+C`, chạy lại `npm.cmd start`, đọc lại file. Dữ liệu cũ vẫn còn. Không xóa file `data/audit.jsonl` giữa hai bước.

## 10. Chạy kiểm thử và lấy ảnh tự động

Giữ Docker, backend, frontend đang chạy. Script dùng Chrome sẵn trên máy; nó mở một phiên trình duyệt riêng cho từng user, không dùng phiên đăng nhập cá nhân.

```powershell
Set-Location D:\IAM-ZeroTrust
python -m pip install --no-user --target .tools -r tests/requirements.txt
python tests/browser_evidence.py
```

Nếu máy chỉ có Edge:

```powershell
$env:TEST_BROWSER_CHANNEL = 'msedge'
python tests/browser_evidence.py
```

Script kiểm tra Docker/PostgreSQL; `/health`; 401 khi thiếu/sai token; đăng nhập, đăng xuất và 16 tổ hợp user/tài nguyên; chữ ký token bị sửa; audience/issuer; quyền xem audit; đồng thời chụp màn hình Portal và Keycloak Console. Không lưu access token hoặc mật khẩu vào minh chứng.

Đọc kết quả cuối cùng:

```powershell
$result = Get-Content .\evidence\week1\verification.json -Raw | ConvertFrom-Json
$result | Select-Object success,startedAt,finishedAt,errorType
$result.checks | Format-Table name,actual,expected,passed -AutoSize
```

Chỉ coi lượt chạy thành công khi `success: true`, tiến trình thoát mã 0 và các checks đều `passed: true`. Nếu dừng giữa chừng, file kết quả ghi `success: false`; ảnh cũ còn trong thư mục không chứng minh lượt chạy mới thành công.

Kiểm thử riêng cơ chế audit và build giao diện:

```powershell
Set-Location D:\IAM-ZeroTrust\backend
node --test audit.test.js
Set-Location D:\IAM-ZeroTrust\web-a
npm.cmd run build
```

Test audit kiểm tra giữ dữ liệu qua các instance, không ghi credential, giới hạn số bản ghi và từ chối khi file log không ghi được. Build tạo `web-a/dist`. Bài thực hành đăng nhập vẫn dùng `npm.cmd run dev` trên 5173; không chuyển sang preview 4173 khi chưa cấu hình redirect/CORS cho cổng mới.

## 11. Danh mục minh chứng để đưa vào báo cáo

File kết quả và ảnh được lưu ở [evidence/week1](evidence/week1). Thư mục này được bỏ qua bởi Git để không vô tình commit dữ liệu phiên thực hành; vẫn có trên máy để chèn vào báo cáo.

| File/minh chứng | Chứng minh điều gì? |
|---|---|
| `docker-ps.txt` | Hai container và cổng thật tại thời điểm chạy |
| `docker-images.txt` | Image mà dịch vụ đang sử dụng |
| `postgres-ready.txt` | PostgreSQL chấp nhận kết nối |
| Ảnh Docker Desktop tự chụp ở bước 5 | Giao diện Containers/Volumes thực tế |
| `01-keycloak-login.png` | Trang đăng nhập Keycloak của ứng dụng |
| `employee01-profile.png` | Xác thực thành công, đọc hồ sơ |
| `employee01-admin.png` | Nhân viên bị chặn tài nguyên admin |
| `manager01-manager.png` | Manager được phép truy cập tài nguyên quản lý |
| `admin01-admin.png` | Admin được phép truy cập quản trị |
| `auditor01-audit.png` và `audit-sample.json` | Auditor đọc được log thật |
| `keycloak-realm.png`, `keycloak-roles.png`, `keycloak-clients.png` | Cấu hình realm/role/client trên Console |
| `keycloak-events.png`, `keycloak-events.json` | Sự kiện đăng nhập trong Keycloak |
| `unauthenticated.json` | Kết quả thiếu token/token lỗi |
| `verification.json` | Danh sách kiểm tra, kết quả và thời điểm chạy |

Ảnh PNG từ script là ảnh chụp trình duyệt đang chạy; các file Docker TXT là đầu ra lệnh thật. Ghi thời điểm chụp và tài khoản thử nghiệm trong chú thích ảnh. Không dùng các hình minh họa Compose trong báo cáo Word trước đây để thay bằng chứng container đang hoạt động.

## 12. Dừng và chạy lại

Dừng Node/Vite: `Ctrl+C` trong hai terminal tương ứng. Dừng hạ tầng mà giữ nguyên volume:

```powershell
Set-Location D:\IAM-ZeroTrust
docker compose stop
```

Lần sau: `docker compose up -d`, đợi Keycloak sẵn sàng rồi chạy `npm.cmd start` ở backend và `npm.cmd run dev` ở web-a. Không cần `npm ci` mỗi lần nếu dependency chưa thay đổi. Không chạy `docker compose down -v` khi cần giữ user, role và events: tùy chọn `-v` xóa volume dữ liệu.

## 13. Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Docker Engine/pipe không truy cập được | Mở Docker Desktop, kiểm tra Linux containers và quyền của terminal |
| Keycloak chưa phản hồi | Xem `docker compose ps`, log Keycloak và health PostgreSQL; đợi quá trình khởi động |
| `setup_keycloak.py` báo 401 ở realm master | Đối chiếu admin/password hiện có; bootstrap chỉ tạo admin lúc khởi tạo, đổi `.env` không đổi mật khẩu admin trong DB cũ |
| `Invalid parameter: redirect_uri` | Dùng `http://localhost:5173`, chạy lại script cấu hình và xem client |
| Đăng nhập được nhưng API trả 401 | Kiểm tra issuer, custom audience, JWKS, giờ máy; đăng xuất/đăng nhập lại để lấy token mới sau thay đổi mapper |
| API trả 403 | Xem Role mapping của đúng user trong `company-iam`; so với ma trận, 403 có thể là kết quả mong đợi |
| Không gọi được API/CORS | Chạy backend 3001; dùng origin localhost:5173 khớp `FRONTEND_ORIGIN` |
| Cổng 3001/5173 bị chiếm | Kiểm tra terminal đang chạy; dùng lại hoặc dừng đúng tiến trình dự án; không đổi cổng tùy ý |
| Script chụp ảnh không tìm thấy browser | Cài Chrome hoặc đặt `TEST_BROWSER_CHANNEL=msedge`; cài dependency trong `.tools` |
| `/api/audit` báo 503 | Kiểm tra đường dẫn/quyền ghi `backend/data`, xem terminal backend; không coi là ALLOW |
| Events chưa có dữ liệu | Chạy setup, đăng nhập mới, refresh User events và chọn đúng realm |

## 14. Tài liệu kỹ thuật dùng để đối chiếu

- Script cấu hình dùng [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html).
- Luồng trình duyệt dùng [Keycloak JavaScript Adapter](https://www.keycloak.org/securing-apps/javascript-adapter), Authorization Code và PKCE S256.
- Cách chạy dịch vụ tham khảo [Keycloak Containers](https://www.keycloak.org/server/containers).

Các đường dẫn, script và kết quả trong dự án là nguồn chính để tái hiện bài thực hành.
