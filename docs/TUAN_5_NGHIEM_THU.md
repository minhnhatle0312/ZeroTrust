# Tuần 5 — Danh mục nghiệm thu để thực hiện sau

**Chưa chạy bất kỳ ca tuần 5 nào trong lượt triển khai mã ngày 04/11/2026.**

Mỗi ca bên dưới có Expected; Actual, thời gian, HTTP, request ID, ảnh/log và kết luận phải điền sau khi thực hiện. Không sao chép số pass của tuần 4 sang đây.

## Chuẩn bị

1. Chốt backup trước thay đổi, giữ dump/SQLite/config trong thư mục riêng.
2. Khởi động đúng chế độ localhost hoặc HTTPS; dùng hai user MFA riêng.
3. Đăng ký thiết bị thật qua Keycloak. Không ghi QR/secret vào biên bản.
4. Chạy ca ghi dữ liệu tuần tự, ghi trạng thái trước/sau và hoàn nguyên demo cần thiết.
5. Máy khách thứ hai phải là thiết bị/trình duyệt thật, tin cậy CA và truy cập đúng SAN.

## MFA và lifecycle

| ID | Tình huống | Expected | Actual |
|---|---|---|---|
| MFA-01 | User được chọn chưa đăng ký OTP | Bắt hoàn thành đăng ký, chưa vào tài nguyên | Chưa chạy |
| MFA-02 | Password và OTP đúng | Đăng nhập A thành công, API 200 | Chưa chạy |
| MFA-03 | OTP sai | Không cấp phiên app mới, có lỗi xác thực | Chưa chạy |
| MFA-04 | OTP cũ quá cửa sổ chấp nhận | Từ chối; chọn mã cũ hơn look-ahead window | Chưa chạy |
| MFA-05 | Bỏ qua Required Action | API từ chối/không có token ứng dụng hợp lệ | Chưa chạy |
| MFA-06 | Thu hồi sau đăng nhập MFA, giữ token cũ còn hạn | API từ chối token snapshot | Chưa chạy |
| MFA-07 | SSO A→B và B→A sau OTP trong cùng profile | Không yêu cầu OTP lại ngoài chính sách; client/audience riêng | Chưa chạy |
| MFA-08 | Recovery có admin MFA, auth_time mới và căn cứ | Thu hồi, gỡ OTP cũ, yêu cầu đăng ký lại, audit/action | Chưa chạy |
| MFA-09 | Tái sử dụng OTP ở lần xác thực mới | Từ chối theo reusable=false | Chưa chạy |
| MFA-10 | Admin chưa có MFA/auth_time quá cũ | 403 MFA_REQUIRED_FOR_RECOVERY / 401 REAUTH_REQUIRED | Chưa chạy |
| MFA-11 | User tự sửa enforcement attribute | Không có quyền thay thuộc tính điều khiển | Chưa chạy |
| MFA-12 | User đã có OTP không thuộc nhóm chọn | Vẫn yêu cầu OTP, không rơi về password-only | Chưa chạy |
| TOKEN-01 | Access hết hạn, refresh còn hiệu lực | Làm mới, GET tiếp tục đúng quyền | Chưa chạy |
| TOKEN-02 | Refresh hết idle/max | Hiển thị đăng nhập lại, không lặp request vô hạn | Chưa chạy |
| TOKEN-03 | Dùng refresh trước rotation/reuse | Theo policy max reuse 0; không phát lại mutation | Chưa chạy |
| TOKEN-04 | Logout A→B/B→A, giữ snapshot | Token cũ bị chặn khi sid kết thúc | Chưa chạy |
| TOKEN-05 | Khóa/mở/revoke khi JWT còn hạn | Disabled/revoked đúng; mở cần token mới | Chưa chạy |
| TOKEN-06 | Monitor và nhiều GET cùng cần refresh | Một hàng đợi trong cùng Keycloak instance | Chưa chạy |
| TOKEN-07 | Refresh lỗi lúc POST/PATCH | Không tự gửi lại thao tác ghi | Chưa chạy |
| TOKEN-08 | Keycloak outage với cache đã hết | Không ALLOW nếu không xác minh được | Chưa chạy |
| TOKEN-09 | Đo cache session và poll UI | Đối chiếu TTL 5 giây, poll 15 giây/focus; ghi thực tế | Chưa chạy |

## API, đồng bộ và collector

| ID | Tình huống | Expected | Actual |
|---|---|---|---|
| API-01 | Employee/Admin, Auditor/ghi, Manager/khác nhóm | Giữ ma trận RBAC/team/owner | Chưa chạy |
| API-02 | Token Web B gọi workspace cá nhân | 403 CLIENT_SCOPE_DENIED | Chưa chạy |
| API-03 | Mass assignment, IDOR/BOLA và lọc SQL | Từ chối, không thay dữ liệu trái quyền | Chưa chạy |
| SYNC-01 | Role/hồ sơ remote thành công, local commit lỗi | Không báo thành công giả; giữ partial/đối chiếu | Chưa chạy |
| SYNC-02 | Retry partial đúng bản mới nhất | Đối chiếu, audit, state đúng | Chưa chạy |
| SYNC-03 | Thay remote/local giữa xem và retry | 409 RECONCILIATION_CHANGED | Chưa chạy |
| SYNC-04 | Có action mới hơn hoặc pending khác | Không phát lại quyết định cũ/đua thao tác | Chưa chạy |
| SYNC-05 | Retry password/recovery từ journal | Yêu cầu thao tác/xác minh mới; không lưu secret | Chưa chạy |
| LOG-01 | Hơn 200 sự kiện giữa hai lượt | Phân trang/lấy tiếp, không chỉ lấy batch mới nhất | Chưa chạy |
| LOG-02 | Dừng sau một trang, restart | Cursor/trang nhất quán, không skip trang lỗi | Chưa chạy |
| LOG-03 | Đọc overlap và đồng bộ lại | Không thêm duplicate/cảnh báo trùng | Chưa chạy |
| LOG-04 | Outage, backoff, vượt thời gian lưu nguồn | Retry đúng và ghi gap chưa xác minh | Chưa chạy |
| LOG-05 | Audit/collector phản hồi chứa dữ liệu xác thực | Chỉ trường allowlist, không token/OTP secret/password | Chưa chạy |
| LOG-06 | Retention=0, sau đó bật trên DB bản sao | Mặc định không xóa; opt-in chỉ xóa đúng hạn | Chưa chạy |

## Giao diện, HTTPS và vận hành

| ID | Tình huống | Expected | Actual |
|---|---|---|---|
| UI-01 | Calendar, KPI và tiến trình đơn | Khớp SQLite, ngày chưa có dữ liệu không tự thành vắng | Chưa chạy |
| UI-02 | Analytics và session count | Khớp nguồn, loại trùng A/B, lỗi hiển thị chưa xác nhận | Chưa chạy |
| UI-03 | Ma trận quyền/CSV | Role/scope đúng, CSV không công thức/secret | Chưa chạy |
| UI-04 | User/client/IP/role/time filters | Server lọc đúng, CSV theo phạm vi hiển thị | Chưa chạy |
| UI-05 | 320/390/768/desktop, bàn phím, focus, nhãn | Không tràn trang, không kẹt dialog, nhìn rõ lỗi/loading | Chưa chạy |
| TLS-01 | CA và hostname/IP SAN đúng | TLS hợp lệ, đăng nhập/SSO/API trên máy khách thứ hai | Chưa chạy |
| TLS-02 | Host/forwarding giả, traversal, admin/master | Không vượt host, không rò private/admin, header không bị giả | Chưa chạy |
| TLS-03 | CSP/HSTS/nosniff/referrer trên lỗi/static/proxy | Header đúng, không phá OIDC/assets | Chưa chạy |
| OPS-01 | /health và /ready lúc phụ thuộc lỗi | Liveness/readiness phân biệt, public không tiết lộ chi tiết | Chưa chạy |
| OPS-02 | Profile production-like riêng | start, hostname/proxy/health đúng, không đụng volume/port lab | Chưa chạy |
| OPS-03 | Backup trước setup và rollback chính sách | Manifest đúng, flow cũ phục hồi, không kéo lùi revocation | Chưa chạy |
| OPS-04 | Restore DB trên hệ thống bản sao | Tính nhất quán PostgreSQL/SQLite, UUID và audit đối chiếu được | Chưa chạy |

## Regression sẽ chạy sau khi được yêu cầu

```powershell
cd D:\IAM-ZeroTrust\backend
npm.cmd test
cd ..
node --test tests/frontend.test.mjs tests/api-client.test.mjs
```

Sau đó build hai Web đúng base, chạy SSO/UI/operations theo chế độ và bổ sung automation MFA/token. Các fixture/selector cũ cần được rà soát theo thay đổi tuần 5, đặc biệt collector phân trang, API client refresh và màn hình mới; không tự coi chúng đã tương thích vì chưa chạy.

Mẫu ghi một ca:

```text
Case ID:
Thời điểm UTC+7:
URL/chế độ, phiên bản source/runtime:
User/role/client:
Điều kiện và dữ liệu trước:
Input:
Expected:
Actual HTTP/code/requestId:
Audit/Keycloak event đối chiếu:
Dữ liệu sau khi từ chối hoặc thành công:
Ảnh/JSON đã loại bí mật:
Khôi phục demo:
Kết luận: đạt / không đạt / chưa xác nhận
```
