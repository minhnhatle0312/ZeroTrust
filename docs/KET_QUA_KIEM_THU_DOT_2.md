# Kết quả Đợt 2 — Đăng nhập Web A/B và rà soát Zero Trust

Ngày hoàn tất: **09/11/2026 (UTC+7)**. Phạm vi được phép: mã đăng nhập, xử lý phiên/kết nối, rà soát cấu hình và kiểm thử an toàn. **Chưa triển khai các thay đổi lên lab; dừng trước Đợt 3.**

## Chức năng đăng nhập đã hoàn thiện

Hai Web dùng chung AuthGate/AuthScreen, với nhận diện Workspace xanh lá và Security xanh lam. Có bố cục desktop/mobile, trạng thái có thông báo cho trình đọc màn hình, focus bàn phím và hỗ trợ reduced motion.

| Trạng thái | Hành vi |
|---|---|
| Chưa đăng nhập | Trang bắt đầu và nút đăng nhập qua Keycloak |
| Kiểm tra phiên | Kiểm tra discovery, sau đó `check-sso`; chưa mở nội dung được bảo vệ |
| Đang xác thực | Thông báo chuyển đến Keycloak, ngăn bấm lặp |
| Đã xác thực | Chỉ mở ứng dụng sau khi backend trả hồ sơ và vai trò hợp lệ |
| Hết/thu hồi phiên | Đóng nội dung được bảo vệ; cho đăng nhập lại |
| Mất kết nối | Màn hình kết nối với retry/reload; không báo truy cập thành công |
| Không đủ quyền/tài khoản khóa | Màn hình từ chối; có lựa chọn đăng xuất/đổi tài khoản và về Web A |
| Cần hoàn tất MFA/required actions | Nút tiếp tục xác thực tại Keycloak; không tạo form mật khẩu/OTP tại React |
| Lỗi render | Fallback tải lại trang, không in exception thô |
| Đăng xuất | Yêu cầu logout Keycloak; nếu lỗi phải ghi nhận chưa xác nhận kết thúc SSO |

Authorization Code flow được chỉ định bằng `flow: standard`, PKCE `S256`; không bật implicit flow hoặc direct grant trong frontend. `check-sso` dùng redirect không tương tác; nếu có phiên SSO hợp lệ, hai Web không cần thêm lần nhập mật khẩu trong fixture. Nếu chưa có phiên, ứng dụng trở về trang bắt đầu. Không thêm cơ chế đăng nhập riêng hoặc client secret vào SPA. Đối chiếu [tài liệu JavaScript adapter của Keycloak](https://www.keycloak.org/securing-apps/javascript-adapter).

Trước init/login/logout có GET discovery không mang credential, timeout và từ chối redirect bất ngờ. Kiểm tra issuer đúng URL cấu hình, có code/S256/RS256 và endpoint cùng origin. HTTP chỉ được chấp nhận cho loopback development; URL chứa credential/query/fragment bị từ chối. Đây là kiểm tra cấu hình/kết nối, không thay thế việc backend xác minh chữ ký JWT.

Đường dẫn chức năng được nhớ bằng section đã kiểm tra cú pháp trong sessionStorage. Không lưu token hoặc OAuth callback ở khóa này. Token của ứng dụng vẫn do keycloak-js giữ trong bộ nhớ; callback state/PKCE nội bộ của adapter tiếp tục do adapter quản lý.

Khi backend gián đoạn giữa phiên, giao diện ứng dụng được ẩn và vô hiệu hóa; modal native đang mở được tạm đóng để không chặn nút retry. Khi kết nối được xác nhận lại, modal và nội dung chưa lưu được phục hồi. Sự kiện availability không được khôi phục một phiên đã bị thu hồi. Không tự gửi lại POST/PATCH.

## Vấn đề đã xác minh và sửa

| Mã | Vấn đề/bằng chứng | Xử lý | Kết quả |
|---|---|---|---|
| AUTH-01 | Web B không có timeout init tương đương Web A; luồng trạng thái bị lặp ở hai main.jsx | Controller dùng chung, giới hạn init/probe và hành động xác thực | Unit timeout/error và build đạt |
| AUTH-02 | monitorSession cũ bỏ qua lỗi mạng/503 khi keycloak.authenticated còn true | Phát trạng thái unavailable/available; gate ẩn nội dung khi chưa xác nhận | Browser tái hiện outage và phục hồi form đạt |
| AUTH-03 | 403 do thay role tại `/api/profile` không nằm trong danh sách terminal cũ | Monitor từ chối mọi 401/403 trên profile; phân loại thiếu quyền riêng. Không coi mọi 403 của endpoint nghiệp vụ là mất phiên | Unit stale-role denial và test quyền đạt |
| AUTH-04 | Chuyển thẳng tới IdP đang lỗi đưa người dùng sang trang lỗi ngoài SPA; tái hiện với fixture IdP unavailable | Discovery preflight trước redirect, lỗi được giữ trên trang kết nối | Browser IdP outage đạt sau sửa |
| AUTH-05 | main.jsx cũ đưa exception khởi tạo/render thô vào console; exception bên ngoài có thể chứa thông tin không phù hợp | Bỏ log exception thô; state chỉ có thông báo cố định; tắt adapter logging | Source review, unit không lộ chi tiết, browser không có pageerror |
| AUTH-06 | Logout gọi trực tiếp từ trang, lỗi chưa được phản ánh thống nhất | Đưa logout về controller; chặn UI ngay, retry logout khi thất bại thay vì mở lại phiên cũ | Unit và browser logout đạt |

Không ghi nhận các vấn đề trên là bằng chứng đã bị khai thác trên lab. Không sửa JWT verifier/RBAC nghiệp vụ hoặc chính sách realm khi không có bằng chứng lỗi cần thay đổi.

## Rà soát Keycloak và kiến trúc Zero Trust

| Phạm vi | Kết quả từ source/kiểm thử cô lập | Trạng thái live |
|---|---|---|
| OIDC clients | setup_week3.py cấu hình `employee-portal` và `security-dashboard` là public client, code flow, PKCE S256; tắt implicit/direct grant/service account ở SPA | Chưa đọc cấu hình client trên Keycloak thật |
| Redirect/Web Origins | Origin cụ thể; redirect giới hạn trong root từng app. Còn wildcard theo đường dẫn app; cần đánh giá trước khi thu hẹp vì có deep link/callback | Không tự đổi redirect/origin hiện tại |
| Issuer/audience | Backend dùng issuer cấu hình, ràng buộc azp → audience riêng từng app | Chưa xác nhận issuer/mapper đang chạy |
| JWT/chữ ký | jose xác minh RS256, thời hạn và các claim bắt buộc; negative tests thiếu claim/sai key/issuer/audience/algorithm/expired/future nbf đạt | Không thử token thật |
| RBAC/IDOR | Role trên token phải khớp hồ sơ server; giới hạn nhóm/chủ sở hữu; Web B chỉ admin/auditor; token Web B không dùng chấm công | Unit/mock đạt, chưa tái kiểm tra tài khoản thật |
| MFA/TOTP | Có flow override, cờ MFA admin-managed, required actions và kiểm tra account security. Setup tuần 5 có phạm vi user được chọn; user mới được yêu cầu đổi mật khẩu/OTP | Chưa kiểm OTP đúng/sai/hết hạn hoặc chống bypass trên Keycloak thật; không kết luận MFA bắt buộc cho toàn bộ user hiện hữu |
| SSO/logout/refresh | Controller/adapter fixture kiểm tra SSO A→B/B→A, logout, refresh bị từ chối, hết/thu hồi phiên. Các test backend kiểm session kết thúc và source outage | Không coi fixture là bằng chứng SSO/refresh rotation/revocation live |
| Quản lý phiên | Cache backend/account 5 giây; frontend poll 15 giây khi được admission và trang visible. Không cache lỗi thành trạng thái healthy | Đây là thông số code, chưa đo SLA; tab ẩn và lỗi mạng có thể làm chậm UI |
| Keycloak/Backend outage | Admission ban đầu phải xác nhận backend; khi không xác nhận được thì từ chối. Các test source outage, cache TTL, disable và monitor lỗi đạt | Public GET discovery/health/ready chưa truy cập được |
| HTTPS/proxy | Gateway yêu cầu HTTPS canonical, TLS tối thiểu 1.2; thay vì tin header client, gateway ghi lại forwarding metadata. Backend tin proxy loopback. Test giả mạo header/path traversal đạt | Chưa xác nhận certificate trust và máy khách thứ hai |
| Service account | Source tuần 5 giới hạn các role manage-users/view-users/view-realm/view-events/view-clients và kiểm tra role quản trị quá mức | Chưa kiểm effective roles live. manage-users vẫn là quyền quản lý rộng trong realm; cần đánh giá fine-grained delegation trước thay đổi |
| Development/production | Compose lab dùng start-dev và loopback; profile production-like riêng dùng start, hostname strict, trusted proxy được cấu hình, health/metrics và volume riêng | Không chạy/apply profile production-like; chưa chứng nhận production |

Keycloak Admin API không được đưa ra gateway công khai trong routing hiện tại. Tuy nhiên, mô hình vẫn dựa vào host/proxy tin cậy; chưa có bằng chứng xác thực dịch vụ bằng mTLS hoặc kiểm tra tư thế thiết bị. Đối chiếu [hướng dẫn reverse proxy](https://www.keycloak.org/server/reverseproxy) và [hướng dẫn production](https://www.keycloak.org/server/configuration-production). Các tài liệu này được dùng để rà soát, không phải bằng chứng cấu hình live đã đạt.

Không tự áp dụng thu hẹp wildcard, đổi service role, mở rộng MFA sang mọi user, đổi TTL, đổi authentication flow hoặc trusted proxy. Những thay đổi đó cần đánh giá ảnh hưởng chức năng/phiên trên môi trường riêng.

## File đã chỉnh sửa hoặc thêm trong Đợt 2

| Nhóm | File |
|---|---|
| Giao diện/controller chung — mới | `shared/auth.jsx`, `shared/auth.css`, `shared/auth-controller.mjs` |
| Điểm vào hai Web và config public | `web-a/src/main.jsx`, `web-b/src/main.jsx`, `web-a/src/keycloak.js`, `web-b/src/keycloak.js` |
| Nối logout về gate | `web-a/src/App.jsx`, `web-b/src/App.jsx` |
| Kết nối và giám sát phiên | `shared/api.mjs`, `shared/sso.js` |
| Rà soát cấu hình và runner — mới | `scripts/review_oidc.py`, `scripts/test_phase2.py` |
| Kiểm thử/build fixture — mới | `backend/phase2.test.js`, `tests/auth-controller.test.mjs`, `tests/session-monitor.test.mjs`, `tests/test_oidc_review.py`, `tests/auth-browser.cjs`, `tests/phase2.vite.mjs` |
| Kiểm kê tiếp nối | `scripts/inventory_ui.cjs`, `tests/inventory.test.cjs`, `docs/interaction-inventory-phase2.json`, `docs/KIEM_KE_TUONG_TAC_DOT_2.md` |
| Bộ đóng gói | `scripts/package_week10.py`: thêm đúng tên JSON kiểm kê Đợt 2 vào allowlist; các điều kiện loại bí mật/runtime giữ nguyên |
| Tài liệu | Báo cáo này, liên kết trạng thái trong `README.md` và `tuanconlai.md` |

Không chỉnh `.env`, database, Compose đang dùng, cấu hình realm live, mật khẩu hoặc khóa. Bốn tài liệu/JSON Đợt 1 được đối chiếu byte/hash với gói source Đợt 1 và giữ nguyên. Kiểm kê mới được lưu thành file riêng; test kiểm kê theo bản tiếp nối hiện tại.

## Kết quả kiểm thử

| Bộ kiểm thử | Kết quả cuối |
|---|---:|
| Backend: các suite cũ và JWT/session/proxy bổ sung | **144/144 PASS** |
| Frontend utility/API/controller/discovery/monitor | **39/39 PASS** |
| Python Detection offline | **7/7 PASS** |
| Đóng gói fixture | **12/12 PASS** |
| Review OIDC thuần dữ liệu giả | **7/7 PASS** |
| Guard môi trường/database/network | **7/7 PASS** |
| Bao phủ kiểm kê hiện tại | **4/4 PASS** |
| Kiểm kê khớp source | PASS |
| Build Web A và Web B bằng Vite, source thật | **2/2 PASS** |
| Chrome với adapter keycloak-js thật, OIDC/API giả loopback | **25/25 PASS** |

Tổng **220 test cô lập + 25 kiểm tra browser fixture**, không fail/skip trong lượt hoàn tất. Browser kiểm tra desktop, Web A ở 320/390/768 px, Web B mobile, chuyển app bằng SSO giả, logout, bảo vệ nội dung, các trạng thái từ chối, timeout/lỗi dịch vụ và khôi phục modal chưa lưu. Không có pageerror trong lượt browser cuối; route guard chặn mọi request ngoài server fixture.

Fixture OIDC kiểm tra code challenge/verifier S256 và nonce từ adapter thật. Token/phiên của fixture chỉ là dữ liệu mô phỏng trong bộ nhớ, không phải token do Keycloak thật cấp. Chữ ký JWT được kiểm tra riêng trong backend suite bằng khóa test sinh trong bộ nhớ. Không lấy token hoặc credential từ lab làm fixture, không lưu chúng trong kết quả.

Lượt browser ban đầu gặp định dạng refresh token giả không phù hợp adapter, đã sửa fixture. Sau đó tái hiện lỗi sản phẩm khi redirect tới IdP lỗi, đã thêm discovery preflight và chạy lại đạt. Các lượt chẩn đoán không được ghi thành PASS; kết quả bảng là lượt hoàn tất.

Build xuất vào `.runtime/phase2-tests/build/web-a` và `web-b`, dùng config public fixture và envDir rỗng riêng; không đọc `.env.local` của lab hoặc ghi đè `web-a/dist`, `web-b/dist`. **Các bundle này dành cho kiểm thử, không dùng để triển khai lab.** Log/build/ảnh và JSON kết quả nằm dưới `.runtime/phase2-tests/`, được Git bỏ qua. Không sửa kết quả runtime của Đợt 1.

## Chạy lại an toàn

Với dependencies đã có:

```powershell
node scripts/inventory_ui.cjs
python -B scripts/test_phase2.py
node tests/auth-browser.cjs
```

Runner chỉ liệt kê các suite cô lập. Browser dùng playwright-core hiện có trong `.tools` và Chrome headless; không cài hoặc nâng cấp dependency. Không chạy các suite live cũ. Những lệnh này không start/stop Docker hoặc gọi setup/restore.

Review công khai chỉ đọc, không đăng nhập:

```powershell
python -B scripts/review_oidc.py --probe-public
```

Script dùng URL công khai/CA hiện có, không đọc password/token để đăng nhập. Discovery, health và ready đều chưa truy cập được trong lượt khảo sát, được ghi `reachable: false`, `tlsVerified: false`; không suy ra certificate sai chỉ từ lỗi kết nối. Vì vậy chưa xác nhận client config, effective roles hoặc trạng thái MFA live.

## Đánh giá Zero Trust và phần chưa xác minh

**Đáp ứng một phần ở tầng ứng dụng:** xác minh JWT và client/audience, phân quyền phía server, giới hạn dữ liệu, kiểm tra trạng thái tài khoản/phiên, từ chối khi chưa xác nhận, quản lý trạng thái lỗi rõ ràng và không chuyển token giữa hai Web. UI xác thực không được coi là ranh giới phân quyền; backend vẫn quyết định truy cập.

**Chưa đủ để kết luận hệ thống production hoặc Zero Trust đầy đủ.** Cần môi trường Keycloak/LDAP riêng để xác minh OTP đúng/sai/hết hạn, tình huống SSO bypass/step-up, refresh rotation, logout/revoke/disable thực tế và độ trễ thu hồi. Cần xác nhận CA/máy khách thứ hai, effective service roles, trusted proxy thực tế và cấu hình production trước triển khai. Không tự đổi các chính sách để làm test đạt.

Discovery preflight tạo thêm điều kiện khả dụng: reverse proxy phải phục vụ discovery đúng issuer và cho phép CORS phù hợp ở chế độ localhost. Nếu endpoint này bị chặn, ứng dụng sẽ từ chối chuyển tới Keycloak dù endpoint login còn hoạt động; cần xác minh khi chuẩn bị triển khai. Sau timeout/failed init, UI yêu cầu tải lại để tạo instance adapter mới.

Không dùng dữ liệu/tài khoản thật cho kiểm thử có tác động. Không xóa/reset PostgreSQL, SQLite, realm hoặc Docker volumes; không đổi password/key; không sửa lịch sử Git, commit hoặc push. Git vẫn còn 0 file ignored nhưng tracked tại kiểm tra cuối; staged removals của Đợt 1 được giữ nguyên.

**Đợt 2 hoàn tất trong phạm vi source, build và kiểm thử cô lập. Dừng, chờ chủ dự án cho phép Đợt 3.**
