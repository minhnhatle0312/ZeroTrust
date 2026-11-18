# Minh chứng báo cáo tuần 3

Kiểm chứng ngày **01/11/2026 (UTC+7)** trên dự án tại localhost.

| Tệp | Nội dung và nguồn |
|---|---|
| `01-pkce.png` | Ảnh cấu hình PKCE từ báo cáo gốc; đối chiếu lại thuộc tính client bằng Keycloak Admin API. |
| `02-audience.png` | Ảnh audience mapper từ báo cáo gốc; xác nhận mapper đưa `employee-api` vào Access Token. |
| `04-realm-roles.png` | Ảnh realm role từ báo cáo gốc; xác nhận lại bốn role ứng dụng trong Keycloak. |
| `03-web-a.png` | Ảnh chụp Web A sau khi `employee01` đăng nhập qua Keycloak thật trong lượt kiểm chứng này. |
| `05-http-rbac.png` | Biên bản từ HTTP response thật: 16 yêu cầu có token và một yêu cầu thiếu token. Ảnh là bản trình bày kết quả tự động, không phải ảnh DevTools hoặc cửa sổ dòng lệnh. |
| `06-backend-tests.png` | Bản trình bày phần tổng kết từ log chạy `npm.cmd test`. |
| `verification.json` | Cấu hình được đối chiếu, kết quả từng kiểm tra, phản hồi API và thời điểm thực hiện. |
| `backend-tests.tap` | Log bộ kiểm thử backend: 54 test đạt, 0 test thất bại. |

Lượt kiểm chứng có **40 kiểm tra đều đạt**, gồm kiểm tra cấu hình, kết quả bộ backend, thiếu token, issuer/audience, ma trận RBAC và đăng xuất. Con số 40 không thay thế số bài kiểm thử backend 54/54.

Ma trận kiểm tra:

| Tài khoản | `/api/profile` | `/api/manager` | `/api/admin` | `/api/audit` |
|---|---:|---:|---:|---:|
| `employee01` | 200 | 403 | 403 | 403 |
| `manager01` | 200 | 200 | 403 | 403 |
| `admin01` | 200 | 200 | 200 | 200 |
| `auditor01` | 200 | 403 | 403 | 200 |

Yêu cầu không có token tới `/api/profile` nhận HTTP 401 / `MISSING_TOKEN`. Các ô bị từ chối theo vai trò nhận HTTP 403 / `INSUFFICIENT_ROLE`.

Bộ backend dùng khóa JWT kiểm thử riêng, SQLite riêng và mô phỏng các thao tác Keycloak. Ma trận HTTP dùng đăng nhập Authorization Code + PKCE S256 với Keycloak thật. Chỉ gọi các API GET phục vụ đối chiếu; backend vẫn ghi audit/cảnh báo cho những yêu cầu này theo thiết kế. Kết quả chỉ xác nhận lượt chạy và các kịch bản đã thực hiện.

Không lưu mật khẩu, header Authorization hoặc toàn bộ token. Phản hồi audit thành công trong JSON chỉ giữ trạng thái, số sự kiện và request ID; không sao chép nội dung toàn bộ nhật ký.
