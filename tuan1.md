# Báo cáo tiến độ tuần 1 — IAM-ZEROTRUST

Cập nhật ngày **21/10/2026** sau khi chạy và kiểm chứng hệ thống trên máy hiện tại.

## 1. Mục tiêu tuần 1

Xây dựng nền tảng quản lý danh tính và kiểm soát truy cập IAM: Keycloak xác thực người dùng; PostgreSQL lưu dữ liệu Keycloak; backend kiểm tra JWT và quyền; giao diện React minh họa hoạt động. Bổ sung bước đầu ghi nhận Audit Log.

## 2. Đối chiếu và hoàn thành công việc

| Công việc trong bản trước | Kết quả sau rà soát | Minh chứng |
|---|---|---|
| Chưa xác nhận container chạy thành công | **Đã xác nhận:** PostgreSQL healthy, Keycloak running, PostgreSQL accepting connections | [Docker ps](evidence/week1/docker-ps.txt), [PostgreSQL](evidence/week1/postgres-ready.txt) |
| Cấu hình realm, client, role phù hợp | **Đã xác nhận và có script dựng lại:** company-iam, employee-portal, PKCE S256, audience employee-api và 4 role | [Cấu hình](keycloak/lab-config.json), [script](scripts/setup_keycloak.py), [ảnh role](evidence/week1/keycloak-roles.png) |
| Kiểm thử đăng nhập và phân quyền | **Đã kiểm thử:** đăng nhập/đăng xuất 4 user, 16 tổ hợp quyền, token thiếu/sai/bị sửa | [Kết quả kiểm thử](evidence/week1/verification.json) |
| Bắt đầu ghi Audit Log | **Đã triển khai:** file JSONL và API đọc log dành cho auditor/admin; bật Keycloak events | [Log mẫu](evidence/week1/audit-sample.json), [Keycloak events](evidence/week1/keycloak-events.png) |
| Bổ sung minh chứng thực tế | **Đã lưu:** 10 ảnh chụp trình duyệt, đầu ra lệnh Docker/PostgreSQL và JSON kết quả | [Thư mục minh chứng](evidence/week1) |

### 2.1. Môi trường Docker

- `docker-compose.yml` chạy PostgreSQL 17 và Keycloak 26.8.0 trên network bridge `iam-network`.
- Named volume `postgres_data` lưu database ngoài vòng đời container.
- PostgreSQL có healthcheck; Keycloak chờ database healthy và công bố cổng trên `127.0.0.1:8080`.
- Tác dụng: triển khai thống nhất, giữ dữ liệu và tránh khởi động Keycloak khi database chưa sẵn sàng.
- Kiểm tra thực tế: hai container đang chạy, PostgreSQL healthy. Keycloak không có Docker healthcheck riêng; khả năng hoạt động được kiểm chứng thêm bằng đăng nhập và Admin API.

### 2.2. Keycloak

- Realm `company-iam`, client public `employee-portal`, Standard Flow/Authorization Code với PKCE S256.
- Custom audience `employee-api` khớp cấu hình kiểm tra JWT của backend.
- Bốn user demo: admin01/admin, manager01/manager, employee01/employee, auditor01/auditor.
- `scripts/init_env.py` chuẩn bị cấu hình và mật khẩu khi thiếu; `scripts/setup_keycloak.py` tạo/cập nhật cấu hình lab qua Admin API, giữ mật khẩu user đã tồn tại.
- Đã bật User Events và Admin Events; có sự kiện LOGIN, CODE_TO_TOKEN, LOGOUT thực tế.
- Tác dụng: xác thực tập trung và tái triển khai được cấu hình phục vụ bài thực hành.

### 2.3. Backend API và Audit Log

- Express xác minh JWT bằng JWKS/RS256, issuer, audience và thời hạn; role được kiểm tra tại backend.
- API hồ sơ yêu cầu token hợp lệ; manager cho manager/admin; admin chỉ cho admin; audit cho auditor/admin.
- Thiếu/sai token trả 401; thiếu role trả 403. Đã kiểm thử token bị sửa chữ ký bị từ chối.
- `backend/audit.js` ghi timestamp, requestId, username, role, method, path, HTTP status, quyết định và lý do vào `backend/data/audit.jsonl`.
- `/api/audit` trả các bản ghi thật, giới hạn 1–100 bản ghi, mặc định 20. Không ghi password hay Bearer token. Nếu ghi log thất bại, request trả 503 DENY.
- Tác dụng: kiểm soát quyền tại nơi phục vụ tài nguyên và có dữ liệu truy vết thao tác cho phép/từ chối.

### 2.4. Giao diện Web và minh chứng

- React/Vite và keycloak-js hiển thị user/role, gửi token tới API, hiển thị ALLOW/DENY và dữ liệu audit thật.
- Cố định cổng Vite 5173 và báo lỗi nếu cổng bận để tránh lệch redirect URI/CORS.
- Dùng trình duyệt thực để kiểm thử đăng nhập, đăng xuất và các nút gọi API; có ảnh Keycloak Console và Portal.
- Tác dụng: trình diễn đầy đủ luồng đăng nhập → xác thực token → kiểm tra quyền → ghi/đọc log.

## 3. Kết quả kiểm chứng

Lượt kiểm thử ngày **21/10/2026, 21:06:39–21:06:50 (UTC+7)**: **51/51 kiểm tra đạt**, `success: true`; **16/16 tổ hợp user/tài nguyên** đúng ma trận quyền. Hai kiểm thử riêng cho audit đạt; frontend `npm.cmd run build` thành công.

| User | Profile | Manager | Admin | Audit |
|---|---|---|---|---|
| employee01 | 200 | 403 | 403 | 403 |
| manager01 | 200 | 200 | 403 | 403 |
| auditor01 | 200 | 403 | 403 | 200 |
| admin01 | 200 | 200 | 200 | 200 |

Các số liệu trên là kết quả trên máy hiện tại, không tự động chứng minh mọi môi trường triển khai khác. Kết quả chạy lại được ghi vào `evidence/week1/verification.json`.

## 4. Cách chạy và lấy minh chứng

Xem [HƯỚNG DẪN CHẠY VÀ MINH CHỨNG TUẦN 1](HUONG_DAN_CHAY_VA_MINH_CHUNG_TUAN_1.md). File gồm chuẩn bị phần mềm, tạo môi trường, chạy Docker, cấu hình Keycloak, chạy backend/frontend, đăng nhập từng user, kiểm tra HTTP 200/401/403, xem audit, chụp màn hình và dừng/chạy lại.

## 5. Giới hạn và hướng phát triển tiếp

Các việc còn thiếu được liệt kê trong bản tuần 1 trước đã được hoàn thiện trong phạm vi nền tảng IAM và Audit Log ban đầu. Hệ thống hiện vẫn là lab localhost: Keycloak dùng start-dev/HTTP; Audit Log là file cục bộ, chưa xoay vòng hoặc chống sửa/xóa. Chưa triển khai LDAP, SSO nhiều ứng dụng, MFA bắt buộc, phát hiện bất thường hoặc phân đoạn mạng theo chính sách. Đây là hướng phát triển tiếp, không được tính là kết quả đã hoàn thành của tuần 1.
