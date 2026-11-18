# Khởi động và nghiệm thu sau migration — 12/11/2026

## Cập nhật mới — Backend đã chạy, 12/11 lúc 20:25

Người dùng đã đồng ý tắt job LDAP **định kỳ** bằng runtime. Đã bổ sung `DIRECTORY_SYNC_ENABLED` vào server qua `backend/directory-schedule.js`; default=true, explicit=false không tạo timer. Ba test mới PASS (mặc định/giá trị sai, không tạo timer hoặc truy cập directory khi tắt, callback khi bật và provider chưa cấu hình). Không thay `.env`, provider, JWT/RBAC/MFA hoặc cơ chế refresh theo request/thao tác sync thủ công.

Preflight startup PASS: không actions pending, không directory job pending/running; schema incident v1 và audit projection v2 đã có, không cần audit backfill; metadata/trigger đã có; retention tắt. **Backend PID30876 chạy lúc20:21:52**, runtime false, log `Periodic LDAP sync: disabled (runtime)`. Các collector/audit delivery thông thường vẫn chạy; không chạy script migration/setup/reset.

Live API: `/health` 200 OK, `/ready` 200 ready; `/api/profile` không token →401 MISSING_TOKEN, token sai →401 INVALID_TOKEN; `/api/security` không token →401; origin không được phép →403 ORIGIN_DENIED. Đây là kiểm tra live health và chặn truy cập không hợp lệ; **chưa đủ nghiệm thu RBAC với token người dùng thật**.

Một lần thử HTTP Authorization Code + PKCE cho employee01 không hoàn tất; đã dừng không retry mật khẩu. Sự kiện Keycloak được collector ghi lúc13:24:01Z xác định **LOGIN_ERROR cookie_not_found**. Không kết luận sai mật khẩu từ lỗi này; các LOGIN_ERROR invalid_user_credentials ngày11/11 là lịch sử, không phải kết quả lượt mới. Cần đăng nhập qua trình duyệt/Web ngoài sandbox, không sửa password/account để chữa cookie của client kiểm thử. Không có access token hoặc phiên người dùng mới đã xác nhận từ lượt thử này.

Hậu kiểm20:25:33 PASS: `.env` và seed nguyên byte; staff, ledger, attendance, corrections, directory jobs/maintenance, actions, lifecycle và access records không đổi; mọi hàng events/identity_events/alert_history cũ còn nguyên. Audit outbox **3423→3428**, giữ mọi seq/payload cũ; pending **406** vì audit service8090 vẫn thiếu. Có4API events và1identity event mới; cơ chế giám sát tạo3alerts/evidence/notifications liên quan. Đây là ghi audit phát sinh từ kiểm tra được phép, không mất lịch sử. Integrity/FK PASS. Không sync/sửa LDAP, không xóa outbox, không dừng Codex.

Bằng chứng `.runtime/backend-acceptance/20261112T132126Z/`: startup-preflight.json, process.json, backend.log, backend-error.log, live-api-oidc.json, login-diagnosis.json, startup-postcheck.json. Trạng thái Backend/chờ quyết định ở các mục dưới là **lịch sử đã được giải quyết**. Web A/B vẫn cần operator chạy `npm.cmd run dev` ngoài sandbox theo lệnh cuối tài liệu; Chrome/Vite spawn EPERM chưa giải quyết trong sandbox. Docker health và audit service cần kiểm tra từ PowerShell ngoài sandbox. Cấu hình MFA/LDAP và giới hạn nghiệm thu TOTP/SSO vẫn như báo cáo.

**Trạng thái: BLOCKED, chưa nghiệm thu hoàn toàn.** Hai migration đã SUCCESS và không chạy lại. Lượt này được phép khởi động ứng dụng, nhưng phải giữ LDAP/MFA và dữ liệu nghiệp vụ; các giới hạn quyền của sandbox và job LDAP mặc định chưa cho phép hoàn tất.

Bằng chứng: `.runtime/application-acceptance/20261112T130848Z/`, gồm `identity-readonly.json`, `oidc-entry.json`, `result.json`, log khởi động Web và log thử kiểm thử cô lập. `.runtime/phase6-tests/environment.json` là kết quả kiểm tra môi trường mới, có giới hạn về origin được giải thích bên dưới.

## Kết quả hiện tại

| Thành phần | URL | Kết quả |
|---|---|---|
| Keycloak | http://localhost:8080 | PASS discovery, Admin GET và trang đăng nhập Authorization Code/PKCE của hai client |
| iam-postgres | Trong Docker network | Chưa đọc được container health hiện tại vì Docker Engine bị giới hạn quyền; không suy health từ Keycloak HTTP |
| zerotrust-ldap-1 | LDAPS trong Docker network | Chưa đọc được container health hiện tại; đã đọc cấu hình federation và đối chiếu hồ sơ qua Keycloak |
| Audit service | http://127.0.0.1:8090 | Không có TCP listener/HTTP; chưa kiểm tra được Audit PostgreSQL |
| Backend | http://localhost:3001 | Chưa khởi động: chờ quyết định về tạm dừng job LDAP định kỳ khi nghiệm thu |
| Web A | http://localhost:5173 | Thử khởi động Vite thất bại: esbuild `spawn EPERM` trong sandbox |
| Web B | http://localhost:5174 | Thử khởi động Vite thất bại: esbuild `spawn EPERM` trong sandbox |

Đã khởi chạy tiến trình Web A 59652 và Web B 65316 bằng chính lệnh Node/Vite trong runner dự án, cửa sổ ẩn, log riêng; cả hai đã kết thúc vì lỗi tạo subprocess esbuild. Không có listener 5173/5174 sau thử. Chrome headless cũng bị `spawn EPERM`. Không sửa dependency/config để né giới hạn quyền, không dừng Codex hoặc Docker.

`run_week10.py` gọi Compose up và Backend với job LDAP định kỳ, có thể tạo/cập nhật container và đồng bộ hồ sơ. Không chạy runner này để vượt chặn, không tạo lại stack. Đã hỏi người dùng có đồng ý tạm tắt job LDAP bằng tùy chọn runtime khi nghiệm thu, không sửa `.env`/LDAP và giữ JWT/RBAC/MFA; **chưa nhận câu trả lời, chưa thêm tùy chọn hoặc khởi động Backend**. Không coi yêu cầu khởi động chung là quyền tự sửa bốn LDAP chưa đồng bộ.

## OIDC, JWT, SSO và MFA

Live discovery đúng issuer `http://localhost:8080/realms/company-iam`; hỗ trợ Authorization Code, PKCE S256, RS256 và có khóa RSA ký trong JWKS. Backend source dùng `jwtVerify` chỉ cho RS256, kiểm tra issuer/audience/sub/iat/exp/azp/sid; ràng buộc client với audience riêng. Đây là xác minh cấu hình/source, **chưa phải nghiệm thu token thật qua API**.

Hai client public/enabled/standardFlowEnabled, PKCE S256; mapper access token có `employee-api` cho employee-portal và `security-api` cho security-dashboard. Redirect/origin localhost và 127.0.0.1 có trong cấu hình; Web B dùng callback gốc `/` đúng config hiện tại. HTTP yêu cầu auth code + PKCE S256 cho cả hai client trả 200 và form đăng nhập trên Keycloak. Không gửi mật khẩu, không nhận authorization code/token hoặc hoàn tất SSO.

Helper inspect_phase6 gọi discovery qua 127.0.0.1 và so issuer với origin truy vấn nên báo issuerMatches=false; kiểm tra trực tiếp với issuer canonical localhost trả đúng. Không đổi issuer hoặc bỏ kiểm tra TLS/JWT để xử lý cảnh báo này. Topology hiện tại là HTTP localhost; cấu hình gateway HTTPS tồn tại trên đĩa không chứng minh gateway đang chạy.

Tám local active vẫn khớp UUID/role/enabled. `mfa-employee` và `mfa-auditor`: local mfa_required=1, remote attribute=true, totp=false, requiredActions=[CONFIGURE_TOTP]. **Cấu hình yêu cầu MFA PASS; đăng ký và thử OTP chưa thực hiện.** Việc đăng ký TOTP là thay đổi credential thật, phải do người vận hành chủ động thực hiện ở Keycloak khi đến bước được phép. Không chụp QR/secret, không gửi OTP hoặc mật khẩu vào báo cáo.

Lượt chạy mới `security.test.js`, `sso.test.js`, `week5-10.test.js` với isolation preloader bị Node test runner chặn tạo child process (`spawn EPERM`) trước khi test case chạy. Không coi ba file không chạy được là lỗi hồi quy ba chức năng, không ghi PASS. Kết quả 24/24 migration MFA và bootstrap thật PASS ở lượt trước vẫn là bằng chứng lịch sử.

## LDAP, audit, session và nghiệp vụ

Provider `nhip-openldap`: enabled, READ_ONLY, NO_CACHE, importEnabled=true, syncRegistrations=false, LDAPS `ldaps://ldap:636`, uid/entryUUID. Cấu hình đúng không thay kiểm thử kết nối LDAPS hoặc đăng nhập LDAP thật.

Bốn hồ sơ local LDAP active còn lệch UUID: **ldap-employee01, ldap-employee02, ldap-manager01, ldap-auditor01**. Remote đều disabled, không có application role. Không sửa, không ghép lại theo username, không bật tài khoản hoặc chạy sync. Backend mặc định chạy job mỗi 300 giây, có thể cập nhật local, đánh dấu missing và thu hồi phiên; vì vậy cần quyết định riêng về chế độ nghiệm thu trước khi khởi động.

SQLite chỉ đọc: integrity/FK PASS, 25 staff, 7 identity ledger, 10 attendance, 15 corrections, 2.802 events, 254 identity_events, 3.423 audit_outbox; **401 outbox pending**. Không có actions/directory jobs/lifecycle pending hoặc running cần recovery khi kiểm tra. DB logical hash cuối vẫn `610a2706635213248304cad9bb31a821cc2d31705533210f78ceeb64564f41a0`, bằng hậu kiểm MFA: không sửa hoặc mất dữ liệu nghiệp vụ/audit trong lượt này.

Chưa nghiệm thu API health/ready/auth/RBAC, session/logout thật hoặc UI xem chấm công/đơn điều chỉnh/audit vì ứng dụng chưa chạy. Không tạo chấm công/đơn điều chỉnh/sự cố giả trên dữ liệu thật. Audit pending phải giữ nguyên; không đánh dấu delivered hoặc sửa payload để tạo PASS khi dịch vụ 8090 chưa hoạt động.

## Tiếp tục từ PowerShell ngoài sandbox

Chỉ kiểm tra Docker, không tạo lại container:

```powershell
Set-Location D:\ZeroTrust
docker ps -a --format '{{.Names}}|{{.Status}}|{{.Ports}}'
docker inspect --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' iam-keycloak iam-postgres zerotrust-ldap-1
```

Gửi kết quả metadata này, không gửi Docker inspect đầy đủ hoặc Compose config chứa secret. Cần xác định audit-service/audit-db có tồn tại và trạng thái gì trước khi đề xuất thao tác; chưa tự tạo hoặc reset.

Để chạy Web bằng lệnh đã có, dùng hai PowerShell thường ngoài sandbox:

```powershell
Set-Location D:\ZeroTrust\web-a
npm.cmd run dev
```

```powershell
Set-Location D:\ZeroTrust\web-b
npm.cmd run dev
```

Chưa hướng dẫn chạy Backend mặc định khi quyết định job LDAP còn chờ. Nếu đồng ý tạm dừng job, cần bổ sung/kiểm thử tùy chọn rõ ràng trước; không giả vờ source hiện có đã hỗ trợ cờ này. Sau Backend/Web chạy: kiểm tra health/ready, token RS256/issuer/audience, API GET theo role, SSO A→B, logout/session; MFA do operator nhập OTP; LDAP chỉ quan sát. Khi dịch vụ audit có thật và được phép chạy, xác minh health và delivery, giữ dữ liệu pending nếu lỗi. Không chạy setup/migration để hoàn tất nghiệm thu.
