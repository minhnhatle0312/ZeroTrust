# Tuần 5 — MFA, phiên đăng nhập và củng cố hệ thống

Cập nhật **04/11/2026 (UTC+7)**.

**Trạng thái: đã bổ sung mã nguồn và cấu hình; chưa kiểm thử theo yêu cầu.** Trong lượt triển khai này không chạy test, build, browser automation, Docker hoặc script đổi authentication flow. Không sử dụng số liệu 97/97 của mốc trước để kết luận mã tuần 5 đạt. Chưa ghi nhận đăng ký thiết bị OTP hoặc nghiệm thu hai máy.

Yêu cầu gốc: [tuan5.md](../tuan5.md). Danh mục nghiệm thu để làm sau: [TUAN_5_NGHIEM_THU.md](TUAN_5_NGHIEM_THU.md).

## 1. Những phần đã bổ sung

| Phần | Nội dung mã nguồn | Tình trạng vận hành |
|---|---|---|
| TOTP | Script sao lưu, clone Browser Flow, nhánh OTP bắt buộc theo tài khoản, client override A/B | Chưa chạy script/đăng ký thiết bị |
| Chính sách OTP | 6 số, HmacSHA1, 30 giây, cửa sổ 1, không tái sử dụng mã | Chờ áp dụng tại Keycloak |
| Tài khoản demo MFA | `mfa-employee`, `mfa-auditor`, tách sáu tài khoản cũ | Chỉ tạo khi chạy setup |
| Required actions | Backend đọc trạng thái user/credential; chặn API khi còn action hoặc thiếu OTP bắt buộc | Mã đã nối server, chờ chạy |
| Khôi phục MFA | Admin đã có MFA, auth_time trong 2 phút, lý do và tham chiếu xác minh; thu hồi rồi bắt đăng ký lại | Chưa thực hành/kiểm thử |
| Refresh token | Chuẩn bị rotation/max reuse 0 và timeout phiên; dùng chung hàng đợi refresh trong frontend | Chưa áp dụng/kiểm thử lifecycle |
| Hết phiên | API client ngừng gửi tiếp khi biết phiên kết thúc; Frame hiển thị bước đăng nhập lại | Chưa kiểm thử trình duyệt |
| Đối chiếu PARTIAL | Lịch sử, dữ liệu local/remote, version chống thay đổi, retry có xác nhận, chặn quyết định cũ | Chưa mô phỏng lỗi/kiểm thử |
| Collector | Cursor lưu SQLite, phân trang tăng dần, cửa sổ thời gian cố định, overlap, backoff và gap | Chưa chạy lấy bù |
| Audit | Thêm client/IP/role và mã liên hệ phiên đã băm | Migration tự áp dụng khi backend chạy |
| Web A | KPI tháng, xu hướng muộn, lịch công, tiến trình đơn, tổng quan manager/auditor, bảo mật hồ sơ | Chưa build/preview |
| Web B | Analytics toàn lịch sử, số phiên quan sát được, ma trận quyền/CSV, lọc nâng cao, đối chiếu | Chưa build/preview |
| Gateway | Lọc forwarding/hop headers, host chuẩn, từ chối traversal, HSTS/headers và timeout | Chưa khởi động lại |
| Readiness | `/ready`, chi tiết bảo vệ `/api/security/health` | Chưa gọi endpoint mới |
| Production-like | Compose độc lập dùng `start`, DB/volume/port riêng và quản lý loopback | Chưa khởi chạy/kiểm chứng |
| Backup/rollback | SQLite backup API, PostgreSQL custom dump, snapshot cấu hình, manifest; khôi phục flow/policy | Chưa tạo/khôi phục bản sao thật |

Các thay đổi SQLite là migration bổ sung cột/bảng/index, không có lệnh xóa hoặc thay thế toàn bộ DB. Retention mặc định tắt; chỉ xóa dữ liệu hết hạn khi người vận hành đặt `AUDIT_RETENTION_DAYS` dương.

## 2. Cấu trúc phần mới

- `backend/week5.js`: trạng thái MFA, recovery, analytics, ma trận, workspace, đối chiếu.
- `backend/auth.js`: cache metadata bảo mật tài khoản, invalidation sau quản trị.
- `backend/keycloak-admin.js`: đọc metadata MFA, recovery, phiên và truy vấn sự kiện phân trang.
- `backend/identity-events.js`: collector có checkpoint và retry.
- `backend/store.js`: migration bảo mật, audit mở rộng, collector và lịch sử retry.
- `backend/app.js`, `backend/operations.js`: tích hợp policy, endpoint, bộ lọc và xử lý đồng bộ.
- `shared/session.mjs`: hợp nhất refresh cùng một Keycloak instance và thông báo hết phiên.
- `shared/api.mjs`, `shared/sso.js`, `shared/ui.jsx`: phản hồi hết phiên và giữ quy tắc không tự phát lại POST/PATCH.
- `shared/week5.jsx`, `shared/week5.css`: component mới dùng chung.
- `shared/operations.jsx`, `web-a/src/App.jsx`, `web-b/src/App.jsx`: nối chức năng vào các trang hiện có.
- `network/security.js`, `network/gateway.js`: xử lý gateway và HTTP headers.
- `scripts/backup_week5.py`, `setup_week5.py`, `restore_week5.py`, `run_week5.py`: công cụ vận hành.
- `deploy/docker-compose.production-like.yml`: hạ tầng riêng để nghiệm thu production-like sau.

## 3. Chuẩn bị chạy mã tuần 5

Các lệnh dưới là hướng dẫn vận hành khi muốn áp dụng, **chưa được thực thi trong lượt triển khai này**.

Vẫn cần Node 22.19+, Python 3.11+, Docker Desktop và dependencies hiện có. Không thêm gói npm/pip mới cho mã tuần 5.

### 3.1. Chạy bằng localhost

```powershell
cd D:\IAM-ZeroTrust
python scripts/configure_network.py --local
python scripts/run_week5.py
```

Mở Web A `http://localhost:5173/`, Web B `http://localhost:5174/`. Runner tuần 5 tái sử dụng cơ chế khởi động tuần 4, không chạy test và không tự áp dụng MFA. Backend chạy migration bổ sung khi mở SQLite.

### 3.2. Chạy bằng HTTPS LAN

Thay `10.0.103.227` bằng IP hiện tại, dừng runner cũ trước:

```powershell
python scripts/configure_network.py --host 10.0.103.227
python scripts/run_week5.py --network
```

Runner LAN **có build** A/B theo `/a/`, `/b/` để phục vụ gateway. Việc chưa build trong lượt làm này không có nghĩa runner được đổi thành phục vụ source trực tiếp. Nếu chưa muốn build/chạy ứng dụng thì giữ mã nguồn và thực hiện các bước này sau.

Máy khách tin cậy đúng `network/.local/ca.crt`, dùng địa chỉ HTTPS đã cấu hình. Chưa xác nhận lại máy khách thứ hai. Chi tiết mạng và CA tại [KET_NOI_HAI_MAY.md](KET_NOI_HAI_MAY.md).

## 4. Áp dụng MFA khi sẵn sàng

### 4.1. Trình tự vận hành

1. Dừng runner/backend để ngừng thao tác ghi ứng dụng; Docker có thể tiếp tục chạy.
2. Đảm bảo nền tảng tuần 4 đã có realm/client/service account và SQLite.
3. Chạy `setup_week5.py`. Script bắt buộc tạo backup PostgreSQL/SQLite/cấu hình trước khi thay đổi.
4. Chạy lại ứng dụng. Đăng ký thiết bị OTP bằng giao diện Keycloak ở bước riêng.
5. Chỉ đánh dấu nghiệm thu sau các ca trong tài liệu nghiệm thu.

```powershell
cd D:\IAM-ZeroTrust
python scripts/setup_week5.py
```

Mặc định tạo/chọn `mfa-employee` (employee) và `mfa-auditor` (auditor). Mật khẩu ngẫu nhiên nằm trong `.env` dưới `TEST_MFA_EMPLOYEE_PASSWORD` và `TEST_MFA_AUDITOR_PASSWORD`; script không in mật khẩu. User đã tồn tại giữ mật khẩu cũ.

Có thể chọn tài khoản khác đã có:

```powershell
python scripts/setup_week5.py --users employee02 auditor01
```

Chọn tài khoản demo cũ sẽ thay đổi yêu cầu đăng nhập của tài khoản đó và có thể ảnh hưởng script browser cũ chưa hỗ trợ OTP. Mặc định dùng hai tài khoản riêng để hạn chế tác động này.

### 4.2. Cách enforcement được chuẩn bị

- Flow gốc của realm được giữ nguyên; Keycloak/master administration không chuyển flow.
- Clone thành `nhip-week5-browser`.
- Bổ sung nhánh conditional theo `nhip.mfa.required=true` với OTP Form required.
- Nhánh OTP đã có thêm điều kiện ngược cho user chưa được chọn; user đã có OTP tiếp tục dùng OTP, tránh hai nhánh cùng đòi cùng mã.
- Attribute điều khiển được khai báo trong User Profile với quyền sửa/view admin; không để người dùng tự bỏ yêu cầu OTP.
- User được chọn có Required Action `CONFIGURE_TOTP` nếu chưa có thiết bị; thu hồi phiên đã có.
- Chỉ hai client `employee-portal`, `security-dashboard` được gắn flow override sau khi dựng nhánh.
- Ghi `mfa_required`, `revoked_before`, thời điểm cập nhật vào hồ sơ local.
- Backend đọc trạng thái remote, chặn token còn thiếu OTP bắt buộc hoặc còn required action. Cache metadata tối đa 5 giây, không coi lỗi remote là hợp lệ.

Không coi việc tạo flow/required action là đã đăng ký thiết bị thật. Người dùng cần quét QR trong Keycloak và nhập OTP; không lưu QR/secret vào Git, ảnh báo cáo hoặc log.

### 4.3. Token và quyền service account

Setup chuẩn bị access token 300 giây; refresh rotation bật, max reuse 0; idle phiên 30 phút, max 8 giờ. Hợp nhất refresh trong API client và monitor để tránh hai luồng trong cùng tab tranh đổi refresh token.

Service account được đối chiếu các quyền trực tiếp `manage-users`, `view-users`, `view-realm`, `view-events`, `view-clients`. Quyền trực tiếp khác được gỡ khỏi mapping realm-management; script dừng trước khi bind client flow nếu phát hiện một số quyền quản trị nguy hiểm còn kế thừa.

`manage-users` vẫn là quyền quản trị user khá rộng trong realm. Đây là thu hẹp so với quyền quản trị toàn realm, chưa phải cấp quyền chi tiết từng tài khoản bằng fine-grained admin permissions.

## 5. Khôi phục thiết bị MFA trên Web

Admin → Tài khoản → Hồ sơ & phiên → Bảo mật & quyền → Xử lý mất thiết bị MFA.

- Admin phải có thiết bị OTP đã đăng ký và `auth_time` còn trong 120 giây; nếu cần bấm Xác thực lại.
- Nhập lý do 10–300 ký tự và mã tham chiếu xác minh 10–200 ký tự. Chỉ nhập mã yêu cầu/biên bản, không nhập bằng chứng bí mật.
- Backend ghi mốc thu hồi và yêu cầu MFA local trước; remote yêu cầu đăng ký lại, logout, rồi gỡ các OTP credential cũ.
- Kết quả đồng bộ hoặc partial được ghi audit/action; không có đường tự bỏ OTP bằng một username.
- Tài khoản quản trị/đích là chính admin không xử lý qua luồng này; dùng quản trị Keycloak với quy trình riêng.

Đây là luồng một admin có xác thực lại và tham chiếu xác minh. Phê duyệt hai người/passkey/step-up theo ACR chưa triển khai.

## 6. Đối chiếu PARTIAL và tác động lỗi hai hệ thống

Web B → Lịch sử xử lý → lọc Chưa đồng bộ → Đối chiếu Keycloak.

Hộp thoại hiển thị hồ sơ/role/trạng thái local và remote, nội dung hồ sơ cần đồng bộ, thời điểm quan sát và căn cứ xử lý lại.

- Mỗi bản đối chiếu có hash version. Nếu trạng thái đã đổi giữa lúc xem và lúc xác nhận, API từ chối, yêu cầu đối chiếu lại.
- Chỉ action partial, vẫn là quyết định local mới nhất và không có pending khác mới được retry.
- Hỗ trợ retry có xác nhận cho khóa, mở, thu hồi, yêu cầu MFA và cập nhật hồ sơ có desired data.
- Hồ sơ đồng bộ lại xong vẫn giữ khóa để admin kiểm tra rồi mở bằng thao tác riêng.
- Không lưu/phát lại password; reset-password và recovery MFA cần luồng mới với thông tin/xác minh mới.
- Khi remote thành công mà transaction local thất bại, action cố giữ trạng thái partial/remote confirmed. Nếu DB mất khả năng ghi hoàn toàn, phải phục hồi DB và đối chiếu remote, không thể bảo đảm ghi được journal mới.
- Các action pending khi restart được chuyển partial, giữ lý do cần kiểm tra.

Việc tạo user remote rồi local thất bại vẫn dùng biện pháp bù vô hiệu hóa user; chưa có giao dịch phân tán đảm bảo rollback tuyệt đối giữa Keycloak và SQLite.

## 7. Collector, audit, retention và readiness

### Collector

- Lấy sự kiện theo `dateFrom/dateTo`, chiều tăng dần, first/max; 200 sự kiện/trang, tối đa 10 trang/lượt.
- Cửa sổ truy vấn tối đa 6 giờ có upper bound cố định, trễ 2 giây so với thời điểm bắt đầu.
- Cursor page/checkpoint lưu trong `collector_state` cùng transaction nhập trang; restart lấy tiếp.
- Cửa sổ mới overlap 60 giây, chống trùng theo ID/fingerprint; không tăng cảnh báo lại vì đọc trùng.
- Retry có backoff, tối đa 5 phút; nút đồng bộ thủ công có thể yêu cầu lấy ngay.
- Khi checkpoint vượt quá khoảng lưu nguồn được cấu hình, ghi `collector_gaps`, không thông báo rằng lịch sử đã đầy đủ.
- Cần đặt `KEYCLOAK_EVENTS_RETENTION_DAYS` khớp thời gian nguồn. Mặc định 7 ngày.
- Nhập thêm `REFRESH_TOKEN`, `REFRESH_TOKEN_ERROR`, các sự kiện execute action và MFA được chọn; chỉ lấy các trường an toàn đã khai báo.

Pagination/overlap không thay thế nguồn log bất biến. Xóa sự kiện ở Keycloak, clock lệch hoặc sự kiện đến muộn quá cửa sổ có thể cần đối chiếu nguồn/backup; các khoảng trống chưa được tự coi là đã phục hồi.

### Audit và bộ lọc

`events` có thêm `client_id`, `ip_address`, `role`, `session_ref` băm. Không lưu access/refresh token hoặc raw sid. UI lọc chính xác user/client/IP/role trên nhật ký, user/client/IP/type trên xác thực; cảnh báo lọc user/severity/trạng thái, dữ liệu thiếu client/IP cần tra log liên quan.

`AUDIT_RETENTION_DAYS=0` mặc định không xóa lịch sử. Khi đặt số dương 1–3650, tác vụ định kỳ hàng ngày dọn events/identity_events/notifications cũ; không chạy VACUUM hoặc xóa dữ liệu ngay khi khởi động. Chọn retention sau khi chốt nhu cầu giữ minh chứng.

### Readiness

- `/health`: liveness backend, phiên bản source 5.
- `/ready`: public chỉ trả ready/unavailable, kiểm tra SQLite và Keycloak/service authentication.
- `/api/security/health`: chi tiết có quyền admin/auditor, trạng thái collector và thông số cache/poll.

Khi Keycloak mất kết nối, middleware tài khoản/phiên có thể từ chối API bảo vệ trước khi vào endpoint chi tiết; `/ready` vẫn có thể dùng để quan sát trạng thái không tiết lộ chi tiết nội bộ.

## 8. Giao diện Web A/B

Web A bổ sung lịch công theo ngày, KPI tháng gồm đơn đã duyệt/đang chờ, xu hướng phút muộn, tiến trình đơn có thời điểm/người xử lý và thẻ riêng manager/auditor. Ngày không có công được ghi “Chưa ghi nhận”, không tự suy thành nghỉ/vắng.

Hồ sơ cá nhân có trạng thái OTP, ngày đăng ký/quan sát, các required action, quyền theo chính sách và link cấu hình trực tiếp tại Keycloak. Phiên chỉ hiển thị dữ liệu Keycloak cung cấp; không đoán tên thiết bị từ một IP.

Web B có Analytics toàn bộ lịch sử local, login success/failure, ALLOW/DENY, cảnh báo, tài khoản khóa và phiên A/B đã loại trùng theo sid trong bộ nhớ. Đếm phiên đọc từ Keycloak có cache 30 giây; lỗi hiển thị “Chưa xác nhận”, không thay bằng KPI 0.

Ma trận quyền dành cho admin/auditor, phân trang user và xuất CSV an toàn của trang đang tải. Nội dung thể hiện policy, còn quyền thực tế phụ thuộc token/client/phiên/MFA và trạng thái tài khoản.

Component mới sử dụng màu, bảng, dialog và responsive của Nhịp. Chưa kiểm tra trực quan desktop/tablet/mobile hoặc nghiệm thu accessibility.

## 9. Gateway và production-like

Gateway thay toàn bộ header `Forwarded`, `X-Forwarded-*`, `X-Real-IP` do client gửi bằng thông tin canonical/socket của proxy. Loại hop-by-hop headers và các tên được Connection khai báo.

Chỉ proxy realm ứng dụng và resources cần thiết; không công khai `/admin` hoặc realm master. Từ chối dot-segment, backslash, ký tự điều khiển và đường encode bất thường; kiểm tra realpath của static file. Có HSTS 1 ngày trên HTTPS, CSP, Permissions-Policy, nosniff, Referrer-Policy và timeout.

Profile độc lập nằm ở `deploy/docker-compose.production-like.yml`:

- Project `nhip-week5-production-like`, volume riêng.
- Keycloak `start`, PostgreSQL riêng.
- Keycloak HTTP nội bộ `127.0.0.1:8180`; management health `127.0.0.1:9100`.
- Bắt buộc URL HTTPS chuẩn và IP/CIDR proxy thực tế; không mặc định tin mọi địa chỉ.
- Không thay compose lab đang có.

Chuẩn bị env riêng khi muốn triển khai profile sau:

```powershell
New-Item -ItemType Directory -Force deploy/.local
Copy-Item deploy/production-like.env.example deploy/.local/production-like.env
```

Điền credential riêng, `WEEK5_PUBLIC_URL` và `WEEK5_TRUSTED_PROXIES`, rồi:

```powershell
docker compose --env-file deploy/.local/production-like.env -f deploy/docker-compose.production-like.yml up -d
```

Đây là profile **hạ tầng độc lập**, chưa có runner seed/frontend/API hoàn chỉnh cho profile mới. Không chạy setup mặc định vào profile với suy nghĩ đã đổi port: helpers lab hiện trỏ loopback 8080. Khi tích hợp riêng cần env/backend/seed/tệp build/gateway config riêng và kiểm thử trước khi tiếp nhận dữ liệu lab. Gateway đã có `IAM_GATEWAY_CONFIG` và backend có `IAM_BACKEND_ENV`, `STAFF_FILE` để hỗ trợ cấu hình riêng.

## 10. Backup và rollback

Backup chứa cấu hình/mật khẩu và dữ liệu danh tính, phải giữ riêng. `.gitignore` bổ sung `backups/`, `deploy/.local/`, `.runtime/`. Quyền file 0600/0700 được đặt khi tạo; trên Windows cần bảo vệ thư mục bằng ACL phù hợp khi chuyển sang máy dùng chung.

Tạo backup độc lập:

```powershell
python scripts/backup_week5.py
```

Script dùng SQLite Backup API, custom dump PostgreSQL và manifest SHA-256. Hai DB được chụp riêng, không phải distributed snapshot; dừng ghi ứng dụng trước nếu cần một mốc đối chiếu chung. `manifest.complete` chỉ ghi khi các bước backup xong.

Nếu setup cần khôi phục chính sách, dừng backend/runner, giữ Docker hoạt động và truyền đúng thư mục backup đã in:

```powershell
python scripts/restore_week5.py backups/week5-TEN_BAN_SAO_THUC_TE
```

Thay chỗ giữ chỗ bằng thư mục thật. Script kiểm tra manifest, khôi phục client bindings/policy OTP–session và enforcement flag; giữ credential đã đăng ký, không kéo lùi mốc thu hồi. Demo mới được tạo sẽ bị vô hiệu hóa, không xóa lịch sử. Flow copy được giữ để đối chiếu.

Rollback cấu hình không phải phục hồi toàn bộ PostgreSQL/SQLite. Không restore DB vào lab đang chạy. Khôi phục database đầy đủ và disaster recovery vẫn cần diễn tập riêng trên bản sao độc lập; chưa đánh dấu hoàn tất.

## 11. API mới

| Method | Endpoint | Quyền |
|---|---|---|
| GET | `/ready` | Public, chỉ status |
| GET | `/api/me/security` | Bản thân |
| GET | `/api/me/workspace?month=YYYY-MM` | Bản thân, Web A |
| GET | `/api/admin/users/:id/security` | Admin |
| POST | `/api/admin/users/:id/mfa/recovery` | Admin có MFA và auth_time mới |
| GET | `/api/security/health` | Admin/auditor |
| GET | `/api/security/analytics` | Admin/auditor |
| GET | `/api/security/access-matrix` | Admin/auditor |
| GET | `/api/security/actions` | Admin/auditor |
| GET | `/api/admin/users/:id/reconciliation` | Admin, target không được bảo vệ |
| POST | `/api/admin/users/:id/actions/:actionId/retry` | Admin, partial mới nhất, version khớp |

Mã mới cần lưu ý: `MFA_SETUP_REQUIRED`, `REQUIRED_ACTION_PENDING`, `REAUTH_REQUIRED`, `MFA_REQUIRED_FOR_RECOVERY`, `STALE_ACTION`, `RECONCILIATION_CHANGED`, `MANUAL_RECONCILIATION_REQUIRED`. Đây là mã đã khai báo trong source, chưa có biên bản gọi API mới.

## 12. Những phần giữ lại cho giai đoạn sau

- Toàn bộ chạy regression/build/browser/MFA thật và HTTPS hai máy theo yêu cầu hoãn kiểm thử.
- Xác minh hiệu lực OTP hết hạn/tái sử dụng, refresh hết hạn/thu hồi và đo thời gian thực tế.
- Kiểm tra thực tế CSP/HSTS, proxy và profile production-like; hoàn thiện tích hợp profile độc lập.
- Passkey, step-up theo ACR, phê duyệt hai người, dark mode/tùy biến bố cục và sơ đồ tương quan P2.
- Diễn tập disaster recovery, video demo và ảnh báo cáo thực tế.
- LDAP tuần 6, PostgreSQL audit/Python Detection tuần 8–9.

Không đánh dấu 69/69 hoặc nghiệm thu tuần 5 khi các phần xác minh này chưa thực hiện.

## 13. Nguồn kỹ thuật đối chiếu

- [Keycloak 26.8 Admin REST API](https://www.keycloak.org/docs-api/26.8.0/rest-api/index.html): các endpoint flow, user, phiên và sự kiện.
- [Quản trị Keycloak 26.8](https://www.keycloak.org/docs/26.8.0/server_admin/): chính sách OTP và authentication flow.
- [Keycloak reverse proxy](https://www.keycloak.org/server/reverseproxy): forwarding headers, trusted proxy và giới hạn management port.
- [Keycloak production configuration](https://www.keycloak.org/server/configuration-production): `start`, hostname và readiness.
- [Provider condition user attribute, tag 26.8.0](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/authentication/authenticators/conditional/ConditionalUserAttributeValueFactory.java): tên provider/config của điều kiện thuộc tính.
