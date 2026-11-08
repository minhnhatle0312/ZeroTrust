# Tuần 9 — Danh sách kiểm thử để thực hiện sau

**Toàn bộ: CHƯA CHẠY.** Ngày soạn 07/11/2026. Đây là kế hoạch và tiêu chí, không phải biên bản PASS.

Chuẩn bị tài khoản lab riêng cho mỗi role, hai nhóm, tài khoản LDAP có MFA, backup phối hợp các kho; không dùng tài khoản thật. Mỗi ca lưu request ID, thời gian UTC+7/UTC, trạng thái trước/sau và người xác nhận; che credential khi chụp/quay.

| ID | Nhóm | Kịch bản | Kết quả cần xác nhận |
| --- | --- | --- | --- |
| A01 | Authentication | Thiếu JWT, JWT rác | 401, không đọc dữ liệu; audit có request ID |
| A02 | Authentication | Sai issuer/audience/client/chữ ký, hết hạn | Từ chối; không fallback tin payload |
| A03 | MFA | TOTP đúng/sai, replay, lệch cửa sổ | Đúng chính sách; không ghi OTP/secret vào log |
| A04 | MFA | Required action chưa hoàn tất | API nghiệp vụ bị chặn |
| A05 | MFA | Recovery quá 2 phút / auditor / tự sửa cờ | Từ chối đúng quyền và điều kiện |
| Z01 | RBAC | Employee gọi admin/audit; auditor gọi admin | 403, dữ liệu không thay đổi |
| Z02 | Scope | Manager đọc/sửa nhóm khác; user đọc người khác | 403 theo scope, không lộ PII |
| Z03 | Client | Token Web B gọi chấm công Web A | Bị chặn client scope |
| Z04 | Governance | Tự duyệt grant, grant hết hạn/thu hồi | Không cấp quyền sai |
| S01 | SSO | Web A→B, B→A cùng hồ sơ trình duyệt | SSO giữ role, MFA đúng flow |
| S02 | SSO | Logout/revoke session hai chiều | Token cũ bị từ chối trong giới hạn cache đã công bố |
| L01 | LDAP | Đổi group/team, bỏ/multiple business group | Quyền đúng hoặc fail-closed |
| L02 | LDAP | Khóa nguồn, lỗi LDAPS, chứng chỉ sai | Không cho phép dựa trên cache cũ ngoài chính sách |
| L03 | LDAP | Sửa hồ sơ read-only qua API | Bị từ chối, nguồn không bị đổi |
| J01 | JCL | Join local/LDAP, MFA lần đầu | Từng bước có lịch sử; không ACTIVE sớm |
| J02 | JCL | Change có phiên/grant đang hoạt động | Thu hồi phiên/grant và đổi quyền đúng |
| J03 | JCL | Leave / lỗi giữa LDAP và Keycloak | Giữ hold; không mở quyền khi partial |
| J04 | JCL | Restart giữa source_write, retry, duplicate | Không nhân user; không ghi nguồn đồng thời |
| I01 | Input | JSON hỏng, body quá lớn, trường lạ | 400/413; không mass assignment |
| I02 | Input | SQL/XSS/CSV formula trong trường text | Không thực thi; export chống công thức |
| H01 | Headers | CORS, CSP, no-store, nosniff, request ID | Header đúng, origin sai bị chặn |
| H02 | Network | CA chưa trust, host/proxy giả, HTTP LAN | Không tắt TLS; proxy chỉ được tin theo cấu hình |
| R01 | Rate | Request burst và login throttling | 429/chính sách Keycloak, không bypass |
| U01 | Audit | LOGIN, ALLOW, DENY, Role change | Có PostgreSQL; đối chiếu source/time/actor |
| U02 | Audit | Replay, crash trước/sau ACK, >2.000 events | Không mất hàng đợi; không trùng event ID |
| U03 | Audit | Keycloak mất kết nối lâu, retention gap | Retry/checkpoint/gap rõ, không báo đủ dữ liệu giả |
| U04 | Audit | Retention + incident mở + detector pending | Không xóa bằng thao tác vô tình; đối chiếu ảnh hưởng |
| U05 | Audit | User/representation chứa secret | Không có token/password/OTP trong kho/output |
| D01 | Detection | Bảy luật và ranh giới ngưỡng | Features/rules/prediction đúng kịch bản |
| D02 | Detection | Login thường, VPN mới, ngoài giờ hợp lệ | Ghi FP và lý do, không tự khóa |
| D03 | Detection | Hai người cùng IP, thiếu actor, đến muộn | Ghi rõ giới hạn, không suy diễn danh tính |
| D04 | Detection | Rollback job, restart, 201+ events | Checkpoint đúng, queued/failed/backlog minh bạch |
| D05 | Dataset | Duplicate ID, cùng scenario khác split | Từ chối leakage; nhãn có bằng chứng độc lập |
| D06 | Metrics | TP/FP/TN/FN, thiếu lớp, mẫu số 0 | Công thức đúng; undefined không thành 100% |
| D07 | Metrics | Sửa nhãn sau snapshot, config mới | Kết quả cũ giữ nguyên, hash/snapshot truy được |
| F01 | Reliability | Ngắt Keycloak/PostgreSQL/LDAP riêng lẻ | Giữ trạng thái an toàn và có lỗi cụ thể |
| F02 | Recovery | Restore trên môi trường cô lập | So sánh kho, quyền, hold, cursor; không reuse token cũ |
| F03 | Regression | Suites backend/UI/SSO lịch sử | Chạy lại trên source hiện tại, không dùng pass cũ |
| F04 | Lab scan | ZAP passive trước, active trong lab riêng | Phân loại finding, lưu cấu hình/phạm vi |

Tiêu chí nghiệm thu đề xuất: không có ca bắt buộc cho phép truy cập trái quyền; không còn lỗi nghiêm trọng đã biết; tất cả ca P0 có bằng chứng. Không đặt mục tiêu Precision/Recall giả định khi chưa có tập đánh giá đại diện. Mốc 0/6 vẫn giữ nguyên đến khi thực hiện.
