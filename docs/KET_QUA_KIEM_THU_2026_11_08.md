# Kết quả rà soát và kiểm thử tuần 5–10

Cập nhật: **08/11/2026, UTC+7**. Đã triển khai và kiểm thử trên lab thật tại `https://10.0.130.254:8443`. Đây là kết quả của mã hiện tại, thay cho trạng thái “chưa kiểm thử” trong các note triển khai trước đó.

## Những lỗi đã sửa khi chạy thực tế

1. OpenLDAP không khởi động do thiếu thư mục socket `/run/slapd`; đã bổ sung và xác nhận LDAPS/federation hoạt động.
2. Setup LDAP gặp component Keycloak không có trường `name`; đã xử lý trường tùy chọn.
3. Flow MFA đặt điều kiện OTP trước bước nhận diện user; đã giữ priority và đưa username/password lên trước. Setup nhận diện đúng nhánh OTP, kể cả khi chạy lại.
4. Keycloak có thể xóa tên/email khi nhận PUT user thiếu trường; adapter giờ giữ hồ sơ hiện có khi đổi trạng thái, role và MFA.
5. Đường tạo nhân viên cũ chưa bắt buộc MFA; đã bổ sung cờ quản lý và CONFIGURE_TOTP cùng mật khẩu tạm thời.
6. Audit Service chỉ nối mạng Docker internal nên host không truy cập được cổng publish; đã tách bridge API, vẫn chỉ bind `127.0.0.1:8090`, PostgreSQL không mở cổng host.
7. Gateway trả lỗi dịch vụ dạng text cho API; đã trả JSON 503 với mã lỗi và request ID để frontend hiển thị đúng.
8. Bảng Audit/Detection trên điện thoại bị xuống dòng từng ký tự; đã giữ độ rộng cột và cuộn ngang trong bảng.
9. Cập nhật kiểm thử giao diện theo màn hình đối chiếu mới, phân biệt `employee02` với `ldap-employee02`, chờ cửa sổ collector thay vì đọc log ngay trước khi được thu thập.

## Kết quả đã chạy

| Phạm vi | Kết quả | Minh chứng trong workspace |
| --- | --- | --- |
| Backend: bảo mật, audit, nghiệp vụ, MFA recovery, governance, outbox | **130/130 PASS** | `npm test` trong backend; `backend/week5-10.test.js` |
| Tiện ích frontend/API client | **8/8 PASS** | `tests/frontend.test.mjs`, `tests/api-client.test.mjs` |
| Python baseline/metrics | **7/7 PASS** | `tests/test_detection.py` |
| HTTPS, SSO hai chiều, logout, RBAC, đường dẫn riêng tư | **29/29 PASS** | `evidence/week3/browser-results.json` |
| Giao diện và nghiệp vụ desktop/mobile | **42/42 PASS** | `evidence/ui-upgrade/results.json` |
| Tạo user, MFA, đổi mật khẩu, thông báo, log, revoke phiên | **24/24 PASS** | `evidence/api-upgrade/browser-results.json` |
| API mới, full sync LDAP, LDAP employee/auditor + MFA/SSO | **20/20 PASS** | `evidence/release/live-results.json` |
| JCL local và grant phê duyệt/thu hồi khi Change | **24/24 PASS** | `evidence/release/governance-results.json` |
| JCL LDAP qua operator receipt và đối chiếu nguồn | **23/23 PASS** | `evidence/release/governance-ldap-results.json` |
| PostgreSQL, chống trùng, chuẩn hóa, correlation, Detection | **100/100 PASS** | `evidence/release/audit-results.json` |
| LDAP outage, đăng nhập phục hồi, refresh rotation | **9/9 PASS** | `evidence/release/session-directory-results.json` |
| Probe HTTP 401/403, request ID, no-store | **5/5 PASS** | `evidence/release/security-probes.json` |
| Các trang mới desktop/mobile, lỗi JavaScript | **19/19 PASS** | `evidence/release/release-ui-results.json` |
| Build Web A, Web B; biên dịch Python; kiểm tra whitespace | Đạt | Vite build, compileall, git diff --check |

Các bộ trình duyệt cũ tuần 2 được thay bằng bộ tuần 3/UI/operations và các ca release trên cùng hệ thống; không chạy lại script seed/reset dữ liệu chỉ để tái hiện mốc cũ. Test mock chứng minh nhánh lỗi có kiểm soát; test live chứng minh tích hợp trong lab. Hai loại bằng chứng không thay thế nhau.

## Thí nghiệm Detection

Đã định nghĩa nhãn **trước khi suy luận** cho 20 mẫu Normal và 7 mẫu Anomaly tương ứng bảy luật. Dữ liệu nền của từng kịch bản được nạp vào PostgreSQL; worker thực sự tính đặc trưng, lưu kết quả và snapshot đánh giá.

- TP = 7; TN = 20; FP = 0; FN = 0.
- Precision/Recall/F1 = 1,0; FPR = 0 trên **27 mẫu mô phỏng này**.
- Dataset: `evidence/release/synthetic-dataset.jsonl`.
- Snapshot: `evidence/release/detection-evaluation.json`.
- Không suy rộng thành độ chính xác trên doanh nghiệp thực. Nhãn do kịch bản kiểm thử quy định, chưa phải đánh giá độc lập trên dữ liệu vận hành.
- Timestamp mô phỏng nằm trong quá khứ để thử cửa sổ lịch sử. Latency trong snapshot có cả khoảng lấy bù này, **không phải tốc độ xử lý trực tuyến**. Thời gian xử lý batch được lưu riêng trong `detection_runs.processing_ms`.

## Backup và phục hồi

Đã tạo backup riêng tư `backups/week5-20261108T024621561919Z` có manifest scope `week10`: Keycloak PostgreSQL, LDAP LDIF, SQLite, Audit PostgreSQL và cấu hình private. Tên thư mục kế thừa script tuần 5, không phản ánh phạm vi bản sao.

Đã phục hồi Audit vào project **`iam-recovery-20261108-release`**, không publish cổng và không đổi endpoint hệ thống đang dùng. Truy vấn trên bản phục hồi xác nhận **2.754 audit events, 2.693 detection results, 1 evaluation** tại thời điểm backup. Đây là phục hồi Audit; chưa diễn tập chuyển toàn bộ Keycloak/LDAP/SQLite sang môi trường khác. Backup là các snapshot nhất quán từng kho, không ghi nhận dừng đồng thời mọi writer.

## Ảnh, video và cách chạy lại

Ảnh desktop/mobile và video thao tác quản trị nằm trong `evidence/release/`; video `release-demo.webm` bắt đầu sau đăng nhập, không ghi mật khẩu, QR hoặc secret OTP. Video này giới thiệu màn hình, không thay biên bản JCL/MFA/API. Các minh chứng kiểm thử được giữ riêng, không đưa credential/runtime vào Git.

Báo cáo Word 10 trang và PowerPoint 15 slide đã mở bằng Microsoft Office, xuất PDF và rà bố cục. File gốc/PDF nằm tại `docs/ban_giao/`; vẫn giữ hậu tố DRAFT vì còn nghiệm thu liên máy và vận hành. Đã sửa số thứ tự trên slide bị xuống dòng và bổ sung lặp tiêu đề bảng Word qua trang.

Sau kiểm thử đã bật Detection tự động trên lab (batch tối đa 200 sự kiện mỗi 30 giây; cấu hình mặc định cho cài đặt mới vẫn tắt). Hai workflow QA lỗi trong quá trình chẩn đoán đã được đối chiếu bằng bản sửa rồi Leave; tài khoản thử được khóa và lịch sử được giữ trong `evidence/release/qa-reconciliation.json`.

Các lệnh live: `python tests/release_live.py`, `python tests/governance_live.py`, `python tests/governance_live.py --ldap`, `python tests/audit_live.py`, `python tests/session_directory_live.py`, `python tests/release_ui.py`. Chạy lần lượt, không chạy đồng thời nhiều suite cùng admin vì giới hạn 120 yêu cầu/phút. Suite JCL tạo tài khoản QA riêng và kết thúc bằng Leave; suite Audit bổ sung sự kiện mô phỏng có prefix `qa-`.

## Phần cần xác nhận ngoài phạm vi máy hiện tại

- Máy khách thứ hai: trước đây đã nhận phản hồi có cảnh báo chứng chỉ, nhưng chưa có bằng chứng mới về tin CA và đăng nhập từ **thiết bị vật lý thứ hai** ở IP hiện tại. Kiểm thử nhiều browser context trên máy chủ không thay thế mục này.
- Nghiệm thu vận hành đầy đủ: diễn tập phục hồi phối hợp mọi kho, dữ liệu đánh giá đại diện/người đánh giá độc lập và diễn tập bảo vệ trực tiếp.
- AD DS, HA, Passkey, ML là mở rộng tùy chọn trong roadmap, không ghi là đã triển khai.

Mốc chính thức: **4/6** (tuần 6–9 có bằng chứng chức năng chính). Tuần 5 còn xác nhận máy khách thứ hai; tuần 10 còn nghiệm thu vận hành/diễn tập cuối. Không tự đánh dấu 6/6 từ kết quả trên một máy.
