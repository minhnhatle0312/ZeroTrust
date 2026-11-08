# Nội dung slide bảo vệ — bản thảo source, 07/11/2026

## Nhịp IAM — Quản lý danh tính và giám sát truy cập
- Lê Minh Nhật · Nguyễn Minh Tuấn
- Web A: Nhịp Workspace · Web B: Nhịp Security
- Keycloak · MFA · LDAP · JCL · Audit · Python Detection
- Bản thảo kỹ thuật: mã tuần 5–10 chưa được nghiệm thu

## Bài toán và phạm vi
- Tập trung danh tính, quyền, phiên và dấu vết truy cập của hai ứng dụng
- Nhân viên, quản lý, quản trị viên và kiểm toán viên có phạm vi khác nhau
- Lab HTTPS trên máy chủ và máy khách cùng LAN/VPN riêng
- Mô hình theo định hướng Zero Trust; chưa phải nền tảng doanh nghiệp đầy đủ

## Kiến trúc và ranh giới tin cậy
- Trình duyệt → HTTPS gateway → React / Express / Keycloak
- Keycloak → PostgreSQL danh tính; federation → OpenLDAP LDAPS
- Express → SQLite nghiệp vụ/hold/outbox → Audit Service → PostgreSQL riêng
- Python worker phân tích audit; trình duyệt không giữ service secret

## Xác thực và MFA
- OIDC Authorization Code + PKCE S256; kiểm tra chữ ký, issuer, audience và client
- MFA và required actions do chính sách quản trị điều khiển
- Token hợp lệ vẫn cần account/role/scope/session và trạng thái local hợp lệ
- Recovery MFA có xác thực lại gần thời điểm thao tác và lịch sử xử lý

## SSO và phân quyền
- SSO theo hồ sơ trình duyệt; hai máy có phiên đăng nhập độc lập
- Web B chỉ dành cho admin/auditor, token không dùng cho chấm công Web A
- Kiểm tra vai trò, nhóm và chủ sở hữu ở API, không dựa vào việc ẩn nút
- Logout/revoke phải được xác nhận hai chiều; cache có giới hạn cần đo

## LDAP là nguồn danh tính
- OpenLDAP LDAPS; Keycloak federation READ_ONLY
- Nhóm nguồn ánh xạ vai trò; trạng thái/nhóm mâu thuẫn phải fail-closed
- Web B có danh bạ, ánh xạ và lịch sử đồng bộ
- Không sửa user LDAP trực tiếp để vượt chính sách nguồn

## Join — Change — Leave
- Yêu cầu → phê duyệt → hold/cutoff → thực hiện → đối chiếu
- LDAP được ghi bằng CLI operator theo workflow đã duyệt
- Lỗi giữa bước giữ partial và hold; execute không đồng nghĩa thành công
- Grant có thời hạn, đúng scope; không tự duyệt và không nâng role nền

## Audit tập trung
- PostgreSQL Audit tách khỏi DB nội bộ Keycloak
- Outbox SQLite cùng transaction; ACK sau commit, replay cùng event ID
- Collector user/admin events: checkpoint, trang, retry, backfill và gap
- Không lưu token, OTP, mật khẩu, request body hay admin representation

## Security Monitoring trên Web B
- ALLOW/DENY theo ngày, top lỗi login và đối chiếu nguồn
- Lọc thời gian/user/action, phân trang, CSV, request/session correlation
- Incident có trạng thái, note, actor và version chống ghi đè
- Health thể hiện backlog/lỗi; retention có preview và xác nhận riêng

## Python Detection có giải thích
- Login failures, DENY liên tiếp, employee thử admin, token đã thu hồi
- IP mới, ngoài giờ, request spike là tín hiệu cần điều tra
- Features theo event-time; batch 200, checkpoint/kết quả cùng transaction
- Normal không đảm bảo an toàn; Anomaly không tự khóa tài khoản

## Dữ liệu và phương pháp đánh giá
- Nhãn từ kịch bản xác nhận độc lập, không lấy nhãn của luật để tự đánh giá
- Tách train/evaluation theo scenario; kiểm tra trùng và rò rỉ dữ liệu
- Snapshot dataset, SHA-256, config version và TP/FP/TN/FN
- Precision/Recall/F1/FPR, latency và processing time được phân biệt

## Kết quả thực nghiệm lab 08/11/2026
- Backend 130/130; tiện ích frontend 8/8; Python 7/7
- SSO 29/29; UI 42/42; nghiệp vụ 24/24; màn hình mới 19/19
- JCL local 24/24 và LDAP 23/23; Audit/Detection 100/100
- 27 mẫu mô phỏng: TP7/TN20/FP0/FN0; không suy rộng ra dữ liệu doanh nghiệp

## Bàn giao và khôi phục
- Runner/Compose, source ZIP có manifest, tài liệu vận hành và sơ đồ
- Backup Keycloak, LDAP, SQLite, Audit và cấu hình private
- Restore Audit vào project mới cô lập; không ghi đè database đang chạy
- Snapshot phối hợp cần dừng writer; ZIP source không thay backup dữ liệu

## Kịch bản demo sau nghiệm thu
- LDAP login + MFA → SSO với role hợp lệ → API trái quyền trả 403
- Change role/group → revoke phiên hoặc Leave → kiểm tra token cũ
- Audit PostgreSQL → Python Detection → giải thích FP/FN và metrics
- Có ảnh/video thao tác thật tại evidence/release; không ghi mật khẩu/QR/secret OTP

## Giới hạn và hướng phát triển
- Lab một backend; chưa chứng minh HA, hiệu năng hoặc không mất log end-to-end
- Late events, cache, backlog và chất lượng nhãn ảnh hưởng kết quả
- Chưa triển khai ML khi thiếu dataset độc lập; không thêm công nghệ sát bảo vệ
- Còn xác nhận máy vật lý thứ hai, phục hồi phối hợp mọi kho và diễn tập bảo vệ
