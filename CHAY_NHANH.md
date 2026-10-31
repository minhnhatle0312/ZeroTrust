# Cách chạy nhanh IAM-ZEROTRUST

**Tuần 2:** giao diện hiện là **Nhịp Workspace — chấm công**. Làm theo các bước dưới; phần tài khoản/quyền chi tiết xem [tuan2.md](tuan2.md).

Máy cần có **Docker Desktop, Node.js và Python**. Mở dự án `D:\IAM-ZeroTrust` bằng VS Code, chọn **Terminal → New Terminal** để nhập lệnh PowerShell.

## 1. Chạy Docker và Keycloak — Terminal 1

Mở **Docker Desktop**, đợi Engine hoạt động. Chạy:

```powershell
cd D:\IAM-ZeroTrust
python scripts/init_env.py
docker compose up -d
docker compose ps
```

Thấy `iam-postgres` có chữ **healthy**, `iam-keycloak` có chữ **Up** là container đã chạy.

Mở **http://localhost:8080/admin/**. Khi trang đăng nhập hiện ra, chạy tiếp:

```powershell
python scripts/setup_week2.py
```

Lệnh này chuẩn bị realm, quyền, hai nhóm nhân viên và kết nối quản trị Keycloak. **Chạy một lần khi chuyển từ tuần 1 sang tuần 2.** Những lần sau có thể bỏ qua hai lệnh Python. Dùng Node.js 22.19 trở lên.

## 2. Chạy backend — Terminal 2

Mở thêm một terminal và chạy:

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd ci
npm.cmd start
```

Thấy `Employee API: http://localhost:3001` là được. **Giữ terminal này mở.** Lần sau có thể bỏ qua `npm.cmd ci` nếu chưa đổi thư viện.

## 3. Chạy giao diện — Terminal 3

Mở thêm một terminal và chạy:

```powershell
cd D:\IAM-ZeroTrust\web-a
npm.cmd ci
npm.cmd run dev
```

**Giữ terminal này mở.** Lần sau có thể bỏ qua `npm.cmd ci` nếu chưa đổi thư viện.

Mở trình duyệt tại **http://localhost:5173** để sử dụng ứng dụng. Dùng đúng địa chỉ này để đăng nhập.

## 4. Đăng nhập và thử quyền

Mở file `.env` ở thư mục gốc. Lấy mật khẩu là **phần sau dấu `=`** của dòng tương ứng:

| Tên đăng nhập | Dòng mật khẩu trong `.env` | Có thể truy cập |
|---|---|---|
| `employee01` | `TEST_EMPLOYEE01_PASSWORD` | Chấm công, bảng công và đơn của mình |
| `manager01` | `TEST_MANAGER01_PASSWORD` | Chấm công cá nhân, xem và duyệt nhóm Sản phẩm |
| `admin01` | `TEST_ADMIN01_PASSWORD` | Tất cả tài nguyên |
| `auditor01` | `TEST_AUDITOR01_PASSWORD` | Chấm công cá nhân, xem cảnh báo và nhật ký |

Tuần 2 có thêm `employee02` / `TEST_EMPLOYEE02_PASSWORD` và `manager02` / `TEST_MANAGER02_PASSWORD` cho nhóm **Vận hành**. `employee01` và `manager01` thuộc nhóm **Sản phẩm**.

Thử nhanh: đăng nhập `employee01` → **Chấm công vào** → **Tạo đơn điều chỉnh** cho hôm qua. Đăng nhập `manager01` → **Quản lý nhóm** → duyệt đơn. Vào lại `employee01` để xem bảng công đã cập nhật.

Admin dùng **Trung tâm bảo mật** để xem cảnh báo và **Tài khoản & truy cập** để thu hồi phiên, khóa/mở tài khoản hoặc yêu cầu MFA. Auditor chỉ xem, không có quyền xử lý.

Nhấn **Đăng xuất** trước khi thử tài khoản khác.

Muốn xem trang quản trị **Keycloak**: mở **http://localhost:8080/admin/**, dùng tên ở dòng `KEYCLOAK_ADMIN` và mật khẩu ở dòng `KEYCLOAK_ADMIN_PASSWORD`. Sau khi vào, chọn realm **company-iam** để xem Users, Realm roles và Events.

## 5. Lấy minh chứng đơn giản

Dùng **Win + Shift + S** để chụp:

- **Docker Desktop → Containers**: mở rộng nhóm dự án, thấy hai container đang chạy.
- **Keycloak → company-iam → Realm roles / Users / Events**: thấy quyền, tài khoản và lịch sử đăng nhập.
- **Trang ứng dụng**: chụp dashboard chấm công, đơn được quản lý duyệt và trung tâm bảo mật của admin/auditor.

Ảnh và kết quả mới ở [evidence/week2](evidence/week2); minh chứng tuần 1 vẫn giữ ở `evidence/week1`. Không đưa ảnh mật khẩu trong `.env` vào báo cáo.

## 6. Dừng ứng dụng

Nhấn **Ctrl+C** tại terminal backend và giao diện. Tại Terminal 1 chạy:

```powershell
cd D:\IAM-ZeroTrust
docker compose stop
```

**Lần sau:** mở Docker Desktop → `docker compose up -d` → chạy backend → chạy giao diện → mở `http://localhost:5173`.

Nếu báo cổng 3001 hoặc 5173 đang được dùng, kiểm tra terminal đã chạy ứng dụng trước đó; không cần mở thêm một bản nữa.
