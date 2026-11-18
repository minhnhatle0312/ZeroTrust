# Bổ sung client Web B trên Keycloak localhost

**Cập nhật 11/11/2026, sau lần người dùng apply lúc 06:17 UTC:** client và audience mapper đã được tạo/cập nhật đúng. Lỗi `Post-write verification failed` là lỗi logic so sánh config thô với config hiệu lực Keycloak trả về, đã sửa. `--check` thật hiện trả **exit 0, `configurationMatches:true`, `differences:[]`** mà không ghi lại cấu hình. **Không cần chạy lại `--apply` cho trạng thái đã kiểm tra.** Agent không chạy apply thật; cơ chế refresh token giữ nguyên. Các mục HTTP 400/401 bên dưới là lịch sử. Ngữ cảnh bàn giao: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Kết quả kiểm tra mã nguồn

- `web-b/src/keycloak.js` mặc định dùng URL `http://localhost:8080`, realm `company-iam`, client `security-dashboard`. Các giá trị công khai trong `web-b/.env.local` hiện cũng khớp cấu hình này.
- `shared/auth-controller.mjs` dùng Authorization Code Flow (`flow: standard`), PKCE S256; mật khẩu/OTP vẫn nhập tại Keycloak.
- Backend ánh xạ `security-dashboard` → audience `security-api`; Web B tiếp tục yêu cầu quyền hiện có `admin`/`auditor`.
- `scripts/setup_week3.py` cấu hình cả `employee-portal` và `security-dashboard`. Chạy trực tiếp file này còn gọi `setup_week2.main()`, có thể sửa realm, service account và cấu hình khác. **Không dùng script đó cho lần sửa riêng này.**

Lần chuẩn bị script ban đầu chỉ đọc source/cấu hình công khai, chạy `--plan` ngoại tuyến và test giả lập. Lượt chẩn đoán bổ sung đã kiểm tra live theo phạm vi chỉ đọc, kết quả ở cuối tài liệu. Không sửa Web B, Backend, `setup_week3.py`, credential hay các kết quả Đợt 1–6.

## Script và phạm vi thay đổi

Script mới: `scripts/repair_security_dashboard.py`, chỉ dùng Python standard library, không import/chạy bất kỳ script setup nào.

| Thiết lập của riêng `security-dashboard` | Giá trị dự kiến |
|---|---|
| Realm / giao thức | `company-iam` / `openid-connect` |
| Enabled / public / bearer-only | `true` / `true` / `false` |
| Standard Flow / Direct Access Grants / Implicit | `true` / `false` / `false` |
| Service Accounts | `false` |
| Root URL / Base URL | `http://localhost:5174/` |
| Redirect URIs | `http://localhost:5174/`, `http://127.0.0.1:5174/` |
| Web Origins | `http://localhost:5174`, `http://127.0.0.1:5174` |
| PKCE | `pkce.code.challenge.method = S256` |
| Post-logout redirect | Hai URL callback trên, phân cách bằng `##` trong attribute |
| Default scopes cần có | `basic`, `web-origins`, `acr`, `profile`, `roles`, `email` |
| Audience mapper riêng | `security-api-audience`, loại `oidc-audience-mapper`, custom audience `security-api` |
| Claim audience | Access token: bật; ID token: tắt |

Redirect chỉ chấp nhận URL chính xác trong bảng, **không thêm wildcard**. Scopes cần thiết được gắn vào client này bằng API assignments, không chỉ gửi trường `defaultClientScopes` trong representation. Nếu một scope cần thiết đang là optional, việc gắn default sẽ chuyển assignment của scope đó trên chính client Web B. Không gỡ các scopes khác.

Khi tạo mới, `fullScopeAllowed=true` theo `setup_week3.py`; không tạo/gán role cho user. Khi sửa client đã tồn tại, giữ `fullScopeAllowed`, scope mappings, các attributes không liên quan và các mappers tên khác. Không sửa global client scopes hoặc mapper dùng chung. Mapper `security-api-audience` được bổ sung/sửa trên client này; không tạo client `security-api` vì đây là giá trị audience tùy chỉnh.

Nếu phát hiện audience `security-api` đã có dưới tên khác hoặc trong scope được gắn/sắp gắn, script dừng để đối chiếu, không tự tạo thêm hoặc sửa mapper ngoài phạm vi. Kiểm tra cả default và optional scopes. Các scope bổ sung chỉ được đọc, không mở rộng quyền gắn/sửa scope. Thứ tự URL không làm phát sinh cập nhật thừa. Cách mã hóa nhiều URL logout đối chiếu với [wrapper](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/protocol/oidc/AbstractClientConfigWrapper.java) và [delimiter của Keycloak 26.8.0](https://github.com/keycloak/keycloak/blob/26.8.0/server-spi-private/src/main/java/org/keycloak/models/Constants.java).

Preflight yêu cầu đủ sáu scopes OpenID Connect; kiểm tra mapper access-token cho `sub`, `auth_time`, `realm_access.roles`, `preferred_username`. Theo [source Keycloak 26.8.0](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/protocol/oidc/OIDCLoginProtocolFactory.java), scope `basic` cung cấp `sub` và `auth_time`. Nếu thiếu scope/claim mapper, client lookup không rõ ràng, mapper có cấu hình lạ, hoặc client có service account/giao thức khác, script dừng để đánh giá tác động; không tự sửa cấu hình chung.

Script giới hạn mọi API cấu hình vào lookup client đích, GET scopes và ghi client/assignment/mapper của `security-dashboard`; không có endpoint sửa user, role, MFA, realm hay xóa client. Các endpoint assignments/mapper theo [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/).

## Sao lưu trước khi ghi

`--apply` thực hiện theo thứ tự:

1. Kiểm tra cấu hình local vẫn đúng localhost; đọc credential quản trị hiện có từ `.env` vào bộ nhớ.
2. Xác thực Admin API và đọc client/scopes/mappers; preflight đầy đủ. Chưa ghi cấu hình.
3. Nếu cần thay đổi, tạo file mới duy nhất, flush/fsync và đọc lại kiểm chứng JSON trong `.local/keycloak-client-backups/security-dashboard-<UTC>-<random>.json`.
4. Đọc lại trạng thái trước khi ghi. Nếu khác bản đã sao lưu, dừng, không ghi đè.
5. Tạo/sửa riêng client đích, bổ sung assignment và audience mapper, sau đó GET lại để kiểm chứng cấu hình.

Backup lưu **trạng thái các trường thuộc phạm vi sửa**, hai attributes PKCE/logout, default/optional assignments và audience mapper trước sửa. Nếu client chưa có, ghi `clientExisted=false` để chứng minh trạng thái trước tạo. Không phải export toàn realm/database; không lưu admin password/token, client secret hay các attributes/mappers không liên quan. Không sửa định nghĩa scope nên chỉ lưu ID/tên assignment, không sao chép cấu hình global scope.

Thư mục `.local/` đã bị Git và packager loại trừ. Bảo quản file theo quyền truy cập của máy; file JSON không được mã hóa. Nếu không thể ghi/kiểm chứng backup, script dừng trước mọi thay đổi cấu hình. Nếu client đã đúng hoàn toàn, không ghi và không tạo backup thừa.

API gồm nhiều request, không có transaction/CAS xuyên suốt trên Keycloak. Kiểm tra lại sau backup chỉ phát hiện thay đổi trước khi bắt đầu ghi; tránh sửa client đồng thời bằng Admin Console/script khác. Lỗi mạng hoặc lỗi giữa chừng có thể để lại cấu hình một phần; script không báo thành công hay tự rollback/xóa client. Giữ backup, chạy `--check` và đối chiếu có kiểm soát; không import/reset toàn realm để khôi phục riêng client này.

## Lệnh PowerShell cho người vận hành

Xem kế hoạch, không gọi Keycloak (đây cũng là chế độ mặc định):

```powershell
Set-Location D:\ZeroTrust
python -B scripts/repair_security_dashboard.py --plan
```

Kiểm tra cấu hình live, không ghi cấu hình:

```powershell
python -B scripts/repair_security_dashboard.py --check
```

`--check`/`--apply` sử dụng `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` đã có trong `.env`; không truyền credential trên dòng lệnh. Admin authentication vẫn có thể tạo session/event quản trị thông thường, dù `--check` không sửa cấu hình. Script không đăng nhập tài khoản nghiệp vụ, không khóa hoặc thu hồi phiên người dùng. Không in raw response/error body; chặn HTTP redirect và không dùng proxy môi trường để chuyển credential tới nơi khác.

**Lệnh có thay đổi thật, chỉ do người vận hành chạy khi quyết định áp dụng:**

```powershell
python -B scripts/repair_security_dashboard.py --apply
if ($LASTEXITCODE -ne 0) { throw 'Chua xac nhan sua client thanh cong; giu backup va kiem tra lai.' }
python -B scripts/repair_security_dashboard.py --check
```

Không chạy lại setup tuần 2/3, không cần reset/restart realm hoặc database. Sau khi `--apply` và `--check` đạt, mở lại `http://localhost:5174/` và dùng luồng Keycloak bình thường. Nếu cần thử login/MFA/SSO, dùng tài khoản test được phép; thành công của script chỉ xác minh cấu hình qua Admin API, chưa chứng minh luồng browser/JWT/MFA/SSO đã đạt.

Mã thoát: `0` = plan hoàn tất hoặc cấu hình đã đúng/đã được kiểm chứng; `2` = `--check` thấy thiếu client hoặc khác cấu hình; `1` = lỗi/preflight từ chối. Không sửa production URL/credential chỉ để qua preflight; script này cố định localhost và từ chối mode HTTPS/network.

## Kiểm thử lịch sử khi chuẩn bị

```powershell
python -B -m unittest discover -s tests -p test_security_dashboard_repair.py -v
python -B -m unittest discover -s tests -p test_oidc_review.py -v
python -B scripts/repair_security_dashboard.py --plan
```

**24/24 test giả lập đạt**, gồm 16 ca tạo/sửa đúng client, backup trước write, backup lỗi thì không ghi, bản sao không chứa trường nhạy cảm không liên quan, giữ settings/mappers khác, rerun no-op, scope optional→default, scope/claim thiếu, xung đột trước ghi, chặn endpoint ngoài phạm vi, không lộ exception và không theo HTTP redirect; thêm 8 ca hồi quy chẩn đoán HTTP an toàn. Unit test chặn toàn bộ network và chỉ tạo snapshot synthetic dưới `.runtime/security-client-tests/`.

**7/7 test rà soát OIDC offline hiện có đạt**; đây là hồi quy logic kiểm tra cấu hình, không phải kết quả kiểm tra client live.

`--plan` ngoại tuyến đã đạt trên cấu hình local. Trong lượt chẩn đoán bổ sung, đã chạy một lần `--check` trên Keycloak thật nhưng không lấy được admin token; không chạy `--apply`, không ghi cấu hình hay sao lưu live. Chưa xác nhận hết lỗi “Client not found” bằng trình duyệt.

## Chẩn đoán HTTP 400 lịch sử — đã được xử lý trước lượt 11/11

Thông báo sau khi bổ sung chẩn đoán:

```text
STOP: Keycloak POST /realms/master/protocol/openid-connect/token: HTTP 400; error=invalid_grant; reason=invalid_user_credentials; response omitted.
```

**Nguyên nhân được xác minh:** Keycloak từ chối bộ thông tin quản trị lấy từ `.env` khi dùng `admin-cli`, `grant_type=password` trong realm `master`. Lỗi xảy ra trong constructor `Api`, trước `collect()`, nên chưa gọi Admin API lấy scopes, realm/client hay bất kỳ request ghi cấu hình nào. Cả `--check` và `--apply` dùng bước lấy token này nên đều có thể dừng cùng HTTP 400. `--plan` không gọi Keycloak nên vẫn thành công.

Thông báo này không phân biệt chắc chắn sai username, sai password hay tài khoản thuộc realm khác; không có bằng chứng để tự thay credential, reset tài khoản hoặc đổi realm xác thực. Không thử lặp lại password grant sau khi xác định lỗi để tránh tăng bộ đếm đăng nhập thất bại.

| Kiểm tra live trong lượt chẩn đoán | Kết quả |
|---|---|
| `GET /realms/master/.well-known/openid-configuration` | Truy cập được; issuer và token endpoint khớp `http://localhost:8080/realms/master`; discovery có password grant |
| `GET /realms/company-iam/.well-known/openid-configuration` | Truy cập được; issuer/token endpoint đúng realm ứng dụng |
| Phương thức lấy admin token của script riêng | `POST`, form URL-encoded, `admin-cli`, password grant trong `master` |
| Đối chiếu `common.admin_token()` | Cùng realm/client/grant và tên biến credential; helper cũ dùng host loopback `127.0.0.1:8080`, script riêng dùng public URL `localhost:8080` |
| Public authorization probe `security-dashboard` | GET với PKCE S256 và `prompt=none`, không password/token/cookie: HTTP 400, khớp lỗi cố định “Client not found”; xác nhận client chưa có |
| Probe đối chứng `employee-portal` | HTTP 302 về origin/path Web A với `error=login_required`; client được nhận diện, không đăng nhập người dùng |
| Client scopes/mappers/RBAC effective qua Admin API | **Chưa xác minh live**, vì không lấy được admin token |
| So sánh credential với cấu hình container | Không thực hiện được vì lệnh đọc Docker Compose không khả dụng trong phiên công cụ; không suy ra Docker/Keycloak đang dừng |

Public probe chỉ phân loại HTTP/chuỗi lỗi cố định và đích redirect, không ghi raw HTML, Location, cookie hoặc response body. Kết quả đã lọc ở `.runtime/security-client-tests/public-diagnostic.json`. GET authorization có thể ghi access/event/auth-session kỹ thuật của Keycloak; không đăng nhập tài khoản, sửa cấu hình hay thay dữ liệu nghiệp vụ. Không coi public probe là thay thế cho kiểm tra toàn bộ client/scopes bằng Admin API.

**Lỗi mã nguồn đã sửa:** `scripts/repair_security_dashboard.py` trước đây chỉ báo HTTP status và bỏ hết vị trí/mã lỗi. Nay dùng chẩn đoán dùng chung từ `scripts/common.py`: method, endpoint tương đối, status, OAuth error và reason chuẩn hóa. Loại bỏ query/fragment, che segment định danh; chỉ nhận các mã/description khớp danh sách cố định, không in phản hồi tùy ý. Body lỗi bị giới hạn 8 KiB; HTML/JSON lỗi/quá lớn hoặc nội dung lạ trả `unclassified`. `common.request()` cũng dùng cùng bộ lọc. Không đổi URL, realm hay phương thức xác thực chỉ để test đạt.

**Cách kiểm tra lại:** người vận hành đối chiếu `KEYCLOAK_ADMIN` và `KEYCLOAK_ADMIN_PASSWORD` trong `.env` với thông tin đăng nhập quản trị đang hợp lệ của realm `master` bằng quy trình quản trị được phép. Không gửi thông tin đó vào chat/log, không reset password/MFA hay bật Direct Access Grants để bỏ qua policy. Nếu tài khoản quản trị thực tế dùng realm/flow khác, dừng và xác nhận phương thức phù hợp trước khi thay code/cấu hình. Bootstrap env của container, ngay cả nếu đọc được, cũng không chứng minh password đang lưu trong database sau khi realm đã khởi tạo.

Sau khi xác nhận thông tin hợp lệ, chỉ chạy:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/repair_security_dashboard.py --check
```

Nếu vẫn có `invalid_user_credentials`, dừng và xem xét với quản trị viên; không lặp lệnh nhiều lần. Nếu trả mã `2` với `client_missing`, bước admin authentication và preflight đã qua nhưng script chưa thay đổi gì. Mã `0` mới xác nhận cấu hình client khớp; mã `1` là lỗi với endpoint/status/mã an toàn để chẩn đoán. Trong lượt sửa này không chạy `--apply`, không thay users/roles/MFA/database/volumes, không commit/push/deploy.

## Sửa HTTP 401 giữa chừng — 11/11/2026

### Bằng chứng và nguyên nhân

- Docker xác nhận `iam-keycloak` dùng image 26.8.0 đang chạy; `iam-postgres` dùng PostgreSQL 17 đang chạy và healthy. Lệnh Docker ban đầu bị sandbox chặn pipe, sau đó kiểm tra chỉ đọc có quyền phù hợp thành công; lỗi quyền sandbox không phải Docker dừng.
- Lấy admin token thành công, `expires_in=60`, có refresh token. Không xuất giá trị token, password hay secret.
- Script cũ chỉ lưu access token, không dùng `expires_in`/refresh token. Một `collect()` cũ mất khoảng 22,8 giây; `apply()` có nhiều lượt đọc preflight/kiểm tra sau backup/sau tạo client/xác minh cuối nên có thể dùng token quá 60 giây.
- Đối chứng chỉ đọc, cố ý giữ hành vi token cũ: HTTP 401 sau 64,7 giây; refresh rồi GET lại thành công. Artifact đã lọc: `.runtime/security-client-tests/expiry-diagnostic.json`. Không chạy lại thao tác ghi của lần lỗi trước; đây là tái hiện cơ chế lỗi bằng GET trên cùng Admin API.
- Trước sửa source, `--check` xác nhận client tồn tại và chỉ khác `audience_mapper`. Sau bổ sung yêu cầu hỗ trợ cả hai địa chỉ Web B, kết quả mới là `redirectUris`, `webOrigins`, `post.logout.redirect.uris`, `audience_mapper`. Ba chênh lệch URL mới là do cấu hình mong muốn được mở rộng, không phải cấu hình thật bị sửa trong lượt chẩn đoán.

### Hành vi bản sửa

1. Tính hạn bằng đồng hồ monotonic từ trước request lấy token, trừ biên an toàn `min(30 giây, expires_in / 2)`; chủ động refresh trước request Admin API khi cần. Token response thiếu/sai thời hạn hoặc quá chậm sẽ dừng.
2. Dùng refresh grant của `admin-cli` trong `master`, giữ refresh token mới khi có rotation, giữ token trước nếu response hợp lệ không trả token thay thế. Không lưu token xuống disk; token endpoint không nhận Authorization header cũ. Cơ chế rotation tham khảo [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/index.html#_oidc-auth-flows).
3. GET nhận 401 được refresh và thử lại **tối đa một lần**. 401 lặp lại, 403, lỗi refresh, lỗi mạng và 5xx đều dừng; không tự đăng nhập password nhiều lần hoặc đổi policy/quyền.
4. POST/PUT lỗi không được tự gửi lại, kể cả 401. Nếu lần ghi đã bắt đầu, giữ backup và chạy `--check` trước khi quyết định chạy lại. Không rollback/xóa client.
5. Nếu client đã đúng các trường quản lý thì bỏ qua PUT client; chỉ gắn scope/mapper thiếu. Mapper đúng tên nhưng sai giá trị được cập nhật theo ID cũ. Nếu đã đúng hoàn toàn thì không ghi và không tạo backup thừa.
6. Cache mapper của mỗi scope trong **một lượt** `collect()`, không dùng cache qua lượt xác minh mới. Allowlist, backup trước ghi, kiểm tra thay đổi sau backup, PKCE S256, public client, tắt implicit/direct grants/service accounts giữ nguyên.

### Kết quả kiểm thử lượt này

| Kiểm tra | Kết quả |
|---|---|
| `test_security_dashboard_repair.py` | **42/42 đạt**, gồm 24 ca cũ và 18 ca bổ sung |
| `test_oidc_review.py` | **7/7 đạt**, offline |
| `--plan` | Đạt; không gọi Keycloak |
| `--check` thật | Đọc thành công; cấu hình chưa khớp bốn mục nêu trên; không ghi cấu hình |
| Tái hiện token cũ hết hạn | HTTP 401 sau 64,7 giây; refresh → GET thành công |
| Hồi quy refresh trên Keycloak thật, chỉ GET cấu hình | 3 lượt đọc / 113,28 giây / 3 refresh; không lỗi, cấu hình giữa các lượt giống nhau |
| `--apply` thật / đăng nhập browser / MFA / SSO | **Chưa chạy** trong lượt này |

Hồi quy mới kiểm tra refresh chủ động và rotation, 401 trước hạn, 401 liên tiếp, refresh thất bại, token metadata lỗi, mạng/403/5xx không retry, POST/PUT không replay, apply chậm qua nhiều hạn token bằng server giả trong bộ nhớ, client dở dang, mapper trùng tên/audience, scope chỉ đọc, callback/logout hai địa chỉ, mất phản hồi sau tạo mapper và chạy lại không trùng. Unit tests chặn network. Log và tổng hợp tại `.runtime/security-client-tests/{repair-unit.log,oidc-unit.log,plan.log,repair-summary.json}`; không cộng vào số 286 test lịch sử Đợt 6.

Kết quả ba lượt đọc thật trong `.runtime/security-client-tests/refresh-diagnostic.json`. Probe chặn mọi phương thức cấu hình ngoài GET; POST chỉ dùng tại token endpoint để xác thực/refresh. Những request này có thể tạo session/event quản trị thông thường, không thay client/users/roles/MFA hoặc dữ liệu nghiệp vụ.

### Quy trình khi cấu hình còn thiếu và kiểm thử đăng nhập thật

Đọc trạng thái mới nhất ở đầu tài liệu. Hiện chỉ cần chạy `--check`; quy trình apply dưới đây dành cho trường hợp `--check` thực sự báo cấu hình cần sửa. Tránh chỉnh cùng client bằng Admin Console trong lúc script hoạt động:

```powershell
python -B scripts/repair_security_dashboard.py --plan
python -B scripts/repair_security_dashboard.py --check
# Chỉ tiếp tục apply nếu check trả mã 2 và đã đối chiếu các chênh lệch.
# Lệnh sau ghi thật, do người vận hành chủ động chạy; trạng thái hiện tại không cần:
python -B scripts/repair_security_dashboard.py --apply
if ($LASTEXITCODE -ne 0) { throw 'Apply chua duoc xac nhan. Giu backup, chay --check va doi chieu loi.' }
python -B scripts/repair_security_dashboard.py --check
if ($LASTEXITCODE -ne 0) { throw 'Cau hinh chua khop; chua bat dau nghiem thu dang nhap.' }
```

Kỳ vọng cuối: `clientExists:true`, `configurationMatches:true`, `differences:[]`. Backup trước lần tạo client cũ và backup mới đều được giữ; không cần xóa client, reset DB, restart Keycloak hoặc chạy setup tuần 2/3.

1. Dùng `http://localhost:5174/` để kiểm thử toàn bộ Web B. `shared/auth.jsx` tạo callback/logout từ origin hiện tại và base path `/`, vì vậy cả hai URL loopback đều có trong kế hoạch client. **Backend hiện chỉ cho phép origin Web B `http://localhost:5174`**; mở Web B bằng `127.0.0.1` có thể qua OIDC sau apply nhưng API bị `ORIGIN_DENIED`. Script này không sửa CORS Backend. URL Keycloak/issuer vẫn là `http://localhost:8080`, không đổi theo hostname Web B.
2. Kiểm tra Backend `/health`, `/ready` và hai Web đang chạy. Nếu cần khởi động, theo [hướng dẫn vận hành](HUONG_DAN_KHOI_DONG.md). Khởi động Backend có thể migrate/collector/pending reconciliation nên không coi đó là probe chỉ đọc; phiên agent này không khởi động Backend hoặc runner lab.
3. Đăng nhập bằng tài khoản test **đã có** thuộc `company-iam`, có quyền `admin` hoặc `auditor` và hồ sơ Backend phù hợp. Tài khoản quản trị realm `master` dùng cho script không tự có quyền nghiệp vụ Web B. Mật khẩu/OTP chỉ nhập trên Keycloak. Không tạo user/gán role/tắt MFA để vượt lỗi.
4. Xác nhận chuyển đến Keycloak, trở về Web B không có “Client not found”/“Invalid redirect URI”; `/api/profile` trả thành công và dashboard hiển thị. Chỉ ghi HTTP status/mã lỗi đã lọc, không sao chép Authorization header, callback code, token, cookie hoặc HAR vào báo cáo.
5. Kiểm thử MFA bằng danh tính test đã có MFA: phiên đăng nhập mới phải tuân theo policy hiện hành; xác minh mã đúng vào được. Ca sai/hết hạn/bypass chỉ dùng tài khoản test được phép trong kế hoạch tích hợp, không sửa MFA hay làm khóa tài khoản đang dùng. Không suy MFA đạt từ màn hình dashboard hoặc phiên SSO đã có.
6. Trong cùng hồ sơ trình duyệt, kiểm tra A `http://localhost:5173/` → B và B → A dùng phiên SSO hiện có; quyền mỗi ứng dụng vẫn được kiểm tra. Kiểm tra logout trên phiên test của chính người thử rồi xem ứng dụng còn lại yêu cầu đăng nhập lại. Không gọi API khóa/thu hồi phiên của người khác.
7. Admin/auditor được đọc Web B; auditor không được ghi điều tra; employee/manager bị từ chối Web B theo quyền hiện có. Chưa cần thực thi thao tác quản trị hoặc đóng sự cố trên dữ liệu thật để xác minh sửa client.
8. Nếu gặp 401 Backend sau login: lấy **mã lỗi an toàn** để phân biệt JWT/audience/issuer/phiên; 403 cần phân biệt `ORIGIN_DENIED` với quyền/hồ sơ. Không dán token vào chat hoặc website decoder. Nếu thiếu danh tính test/hồ sơ/service account hợp lệ, ghi nhận điều kiện còn thiếu để xử lý riêng.

HTTPS/máy khách thứ hai, PostgreSQL Audit và workflow tích hợp vẫn là các hạng mục nghiệm thu riêng; hai container IAM đang chạy không chứng minh Audit stack đã sẵn sàng.

## Sửa xác minh audience mapper — sau lần apply 06:17 UTC, 11/11/2026

Người dùng chạy bản đã sửa refresh, có backup `.local/keycloak-client-backups/security-dashboard-20261111T061708Z-200e5d82.json`, rồi gặp `Post-write verification failed`. Check cũ chỉ còn `audience_mapper`. Agent tiếp tục bằng GET Admin API và token authentication/refresh, không gọi endpoint ghi cấu hình hoặc apply thật.

### Trạng thái thật trước khi sửa logic

Đã xác nhận **đúng một mapper trực tiếp**, tên `security-api-audience`, protocol `openid-connect`, loại `oidc-audience-mapper`, `consentRequired=false`. Không có mapper explicit audience `security-api` khác trong 6 default scopes và 5 optional scopes đã đọc; các cấu hình redirect/origin/logout đều khớp.

| Trường config | Payload script gửi | GET mapper thực tế |
|---|---|---|
| `included.custom.audience` | `security-api` | `security-api` |
| `access.token.claim` | `true` | `true` |
| `id.token.claim` | `false` | `false` |
| `introspection.token.claim` | Không gửi | `true` |
| `userinfo.token.claim` | Không gửi | `false` |
| `included.client.audience` / `lightweight.claim` | Không gửi | Không có |

Các giá trị `true`/`false` trong config là chuỗi JSON. Không có key config lạ. Artifact được lọc theo allowlist: `.runtime/security-client-tests/mapper-verification/live-before.json`; không chứa token, credential hoặc ID mapper thực.

**Dedicated scope:** `security-dashboard-dedicated` trên Admin Console biểu diễn mapper/role scope mappings gắn trực tiếp với client. Nó không phải một realm client-scope riêng trong REST/storage. Vì vậy GET `/admin/realms/company-iam/clients/<id>/protocol-mappers/models` đã kiểm tra đúng mapper của dedicated scope; không cần tìm/tạo bản thứ hai trong `/client-scopes`. Realm hiện không có scope riêng tên đó. Đối chiếu [Keycloak Server Administration Guide — Dedicated client scope](https://www.keycloak.org/docs/latest/server_admin/index.html#_client_scopes).

### Nguyên nhân chính xác

`ProtocolMappersResource.getMappers()` trả **effective model**; `AbstractOIDCProtocolMapper.getEffectiveModel()` thêm UserInfo theo `id.token.claim` và introspection theo `access.token.claim` nếu không cấu hình riêng. Hai key thêm trong phản hồi hiện tại đúng với hành vi này. Nguồn phiên bản 26.8.0: [ProtocolMappersResource](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/services/resources/admin/ProtocolMappersResource.java), [AbstractOIDCProtocolMapper](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/protocol/oidc/mappers/AbstractOIDCProtocolMapper.java).

Script cũ so sánh nguyên dictionary `mapper['config']` với payload ba key trong cả `issues()` và `apply()`. Dictionary năm key do Keycloak trả về luôn khác payload ba key, dù các giá trị hiệu lực đúng. Vì thế POST/PUT đã thành công vẫn bị báo hậu kiểm thất bại; chạy apply tiếp có thể PUT cùng mapper vô ích. **Không phải mapper chưa tạo, bị trùng hoặc nằm sai dedicated scope.**

### Thay đổi và kiểm thử

- Thêm `audience_mapper_issues()` dùng chung cho check, quyết định ghi và hậu kiểm. Chuẩn hóa **chỉ hai key mặc định có bằng chứng**: UserInfo false, introspection true. Giữ nguyên payload ghi; không thay đổi hành vi hiệu lực trên Keycloak.
- Vẫn yêu cầu audience, access-token flag, ID-token flag và metadata khớp. Giá trị khác/null/sai kiểu, thiếu trường bắt buộc hoặc config thêm ngoài hai mặc định vẫn không đạt; không so sánh subset rồi bỏ qua các trường còn lại. Kiểm tra trùng và allowlist vẫn giữ.
- Check lỗi mapper thêm `audienceMapperDifferences` chứa tên trường cố định, không xuất giá trị lạ từ server. Hậu kiểm sau ghi vẫn gọi GET và vẫn dừng nếu cấu hình còn sai.
- Mã class `Api`, gồm token expiry/refresh/retry, không thay đổi (đối chiếu AST/hash). Backup thực và Git index không đổi hash; không xóa hoặc tạo backup thật mới.
- Bổ sung fixture mô phỏng GET effective model và **8 test mới**: check/no-op, tạo mới rồi hậu kiểm, sửa đúng ID, không PUT mapper khi chỉ sửa client, các cấu hình sai/thiếu/ngoài dự kiến, lỗi thật sau ghi vẫn bị chặn, chẩn đoán không lộ giá trị. Test mới tái hiện lỗi trên source trước sửa; source sau sửa đạt **50/50 test script**, **7/7 OIDC offline**, `--plan` đạt. Không chạy lại toàn bộ Đợt 6/browser/build.

`--check` thật sau sửa (exit code 0, stderr rỗng):

```json
{"mode":"CHECK_ONLY","clientExists":true,"configurationMatches":true,"differences":[]}
```

Kết quả này xác nhận **cấu hình qua Admin API**, chưa phải nghiệm thu login/MFA/SSO/JWT phát hành thật. Agent không chạy apply để có kết quả trên. Bằng chứng nằm trong `.runtime/security-client-tests/mapper-verification/`: `tests-before.log`, `repair-unit.log`, `oidc-unit.log`, `plan.log`, `summary.json`, `live-check-after.json`, `baseline.json`, `preservation.json`.

Người vận hành chỉ cần chạy `python -B scripts/repair_security_dashboard.py --check`, rồi kiểm thử đăng nhập Web B trên `http://localhost:5174/` theo hướng dẫn phía trên. Giữ cả hai backup; không cần tạo thêm dedicated scope, xóa mapper, reset realm hoặc chạy lại setup.
