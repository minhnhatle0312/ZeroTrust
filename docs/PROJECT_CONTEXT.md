# Ngữ cảnh tiếp quản dự án ZeroTrust

Cập nhật: **12/11/2026**, workspace `D:\ZeroTrust`, múi giờ Asia/Saigon. Luôn giao tiếp và báo cáo bằng **tiếng Việt**. Đây là điểm bắt đầu cho phiên mới; đối chiếu lại mã nguồn/Git/môi trường trước khi hành động, không coi tài liệu là trạng thái live vĩnh viễn.

**Công việc mới nhất — 12/11:** đã sửa luồng khởi tạo máy mới và thêm kiểm tra liên kết ID trước startup Backend; xem mục 12 và `docs/KHOI_TAO_MAY_MOI.md`. Chỉ sửa source/tài liệu và test cô lập, không gọi IAM thật, không ghi SQLite/seed thật, không apply hoặc restart. Bản sửa không chữa năm ID lệch hiện tại: startup mới sẽ chủ động dừng nếu chúng vẫn lệch. Việc đồng bộ ở mục 11 vẫn chờ xác nhận riêng.

**Lượt tiếp theo — 12/11, 13:11–13:15 giờ Việt Nam:** đã bắt đầu giai đoạn 1 theo yêu cầu nghiệm thu mới, nhưng Keycloak/Backend/Web A/Web B không truy cập được, Docker báo thiếu pipe Engine. SQLite và backup cũ toàn vẹn; 25 test đối soát đạt. Dry-run thật exit 1 do không kết nối token endpoint, **chưa tạo plan mới, chưa xác minh lại ID Keycloak**. Chưa apply/dừng/start dịch vụ. Xem mục 13 và `docs/KET_QUA_GIAI_DOAN_1_DANG_NHAP.md` trước khi tiếp tục; không dùng kết quả live 11/11 như bằng chứng hiện tại.

**Mới nhất — 12/11, 13:25–13:27:** người dùng đã bật Docker/IAM. Đối chiếu live và dry-run **PASS**, admin01 khớp, đúng năm tài khoản còn lệch ID. Plan mới `.local/staff-id-plans/phase1-20261112T062520Z.json`, không dùng plan cũ; 41 hàng nghiệp vụ dự kiến đổi liên kết. 25 test backup/rollback chạy lại đạt; dữ liệu/admin/seed/backup/index giữ nguyên. **Chưa apply, chưa start Backend/Web, dừng chờ xác nhận.** Cổng ứng dụng đóng nhưng CIM bị PermissionDenied nên chưa kiểm kê đủ writer. Xem mục 14 và phần đầu báo cáo giai đoạn 1.

**Chuẩn bị giai đoạn 2 — 12/11, kiểm tra 13:36–13:41: BLOCKED.** Plan trên vẫn nguyên hash; dựng lại từ Keycloak/SQLite hiện tại khớp chính xác; integrity và 25 test rollback PASS. Probe ghi/fsync/rename bằng file tổng hợp tại thư mục backup PASS, còn khoảng 55 GiB. Tuy nhiên chỉ biết PID 71808 là `D:\node\node.exe`; CIM process/service và ScheduledTask bị PermissionDenied, chưa xác nhận mọi writer đã dừng. Không apply hoặc dừng PID. Đã chuẩn bị lệnh PowerShell cho người vận hành có quyền và quy trình apply/hậu kiểm tại `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md`; xem mục 15. Người dùng chưa xác nhận apply.

**Cập nhật mới nhất — 12/11, 14:00–14:01:** người dùng đã xác minh Administrator: PID 71808 chạy `@openai/codex/bin/codex.js`, executable `D:\node\node.exe`, parent 67088. **Đó là Codex CLI; không dừng, không còn coi PID này là blocker.** Plan tiếp tục khớp hoàn toàn Keycloak/SQLite hiện tại. Vẫn **BLOCKED** vì sandbox không truy vấn được CIM process/service và Task Scheduler; chưa đủ bằng chứng mọi worker/task/handle đã ngừng ghi. Xem mục 16 và phần cập nhật đầu tài liệu chuẩn bị giai đoạn 2.

**Trạng thái client OIDC — lượt 2, sau người dùng apply 06:17 UTC:** client `security-dashboard` và mapper đã đúng. Đã sửa lỗi so sánh payload với effective config của Keycloak. `--check` thật tại lượt 2 **exit 0, `configurationMatches:true`, `differences:[]`**, không cần apply lại cho trạng thái đó. Agent không chạy apply thật. Xem mục 9 để tránh tiếp tục theo chẩn đoán thiếu mapper của lượt trước.

**Chẩn đoán live gần nhất — 11/11/2026, khoảng 22:04 giờ Việt Nam:** người dùng báo admin01 đã sửa được, employee01 qua Keycloak nhưng Web A từ chối. Đối chiếu chỉ đọc xác nhận ID Keycloak của **auditor01, employee01, employee02, manager01, manager02** không khớp `staff.id` trong SQLite và seed `backend/data/staff.json`; ID cũ trả 404. Admin01 khớp. Vai trò đúng, các hồ sơ không khóa/hold. Đây là mất liên kết danh tính với hồ sơ nghiệp vụ; tại lượt chẩn đoán đó chưa sửa code/database/tài khoản. Các lượt sửa source sau nằm ở mục 11–12, chưa apply dữ liệu thật.

## 1. Đọc trước khi làm

- [Báo cáo nghiệm thu Đợt 6](BAO_CAO_NGHIEM_THU_ZERO_TRUST.md): bằng chứng và giới hạn nghiệm thu.
- [Sửa client Web B](SUA_CLIENT_SECURITY_DASHBOARD.md): trạng thái mới nhất, nguyên nhân 401, lệnh vận hành và kiểm thử đăng nhập.
- [Kết quả Đợt 5B](KET_QUA_KIEM_THU_DOT_5B.md), [API Đợt 4](API_SU_CO_DOT_4.md), [quy trình sự cố](API_VA_QUY_TRINH_SU_CO.md).
- [Khởi động](HUONG_DAN_KHOI_DONG.md), [kiểm thử](HUONG_DAN_KIEM_THU.md), [giới hạn](LOI_VA_GIOI_HAN.md), [kiến trúc](KIEN_TRUC_VA_LUONG_HE_THONG.md), [README](../README.md).

Tài liệu tuần cũ và kết quả 08/11 là lịch sử; báo cáo 09/11 ghi Docker chưa hoạt động **tại thời điểm đó**. Ngày 11/11 đã xác nhận Docker/Keycloak hoạt động, không sửa lại bằng chứng lịch sử thành kết quả mới.

## 2. Kiến trúc đối chiếu với source

| Thành phần | Vị trí và vai trò |
|---|---|
| Web A | `web-a/`, React/Vite, cổng 5173, client OIDC `employee-portal`, audience `employee-api` |
| Web B | `web-b/`, React/Vite, cổng 5174, client `security-dashboard`, audience `security-api`; đọc bảo mật cho admin/auditor |
| Xác thực UI chung | `shared/auth.jsx`, `auth-controller.mjs`, `api.mjs`, `sso.js`: Code Flow + PKCE S256, token trong bộ nhớ, probe `/api/profile`, giám sát phiên |
| Backend | `backend/`, Express cổng 3001; JWT RS256, issuer/audience/azp/sid, RBAC/team/owner, trạng thái tài khoản/phiên/hold |
| Nghiệp vụ và audit cục bộ | **SQLite**, không phải toàn bộ dữ liệu đều ở PostgreSQL; `backend/store.js`, outbox/history/evidence/retention |
| IAM | `docker-compose.yml`: Keycloak **26.8.0**, `iam-keycloak`, cổng loopback 8080; PostgreSQL **17**, `iam-postgres`, volume hiện có; realm `company-iam` |
| Audit trung tâm | `audit/`, Python service + PostgreSQL riêng (overlay `audit/compose.week8.yml`), thường cổng 8090; Detection baseline, sự cố/bằng chứng/history |
| Mở rộng | `directory/`: LDAP/LDAPS federation READ_ONLY; `network/`: HTTPS gateway; `deploy/`: profile production-like; không mặc định đã chạy/nghiệm thu |
| Công cụ và test | `scripts/`, `tests/`, test Backend; runner cô lập dùng `.runtime/`, không fallback sang DB lab |

Backend kiểm chứng audience riêng theo `azp` trong `backend/auth.js`. Web B admin được điều tra; auditor đọc, không ghi điều tra (quyền gán nhãn Detection từ trước là ngoại lệ riêng). Client `security-api` không cần được tạo: đây là custom audience. Hai kho SQLite và PostgreSQL dùng DTO `detail.schemaVersion=1`, không có transaction phân tán.

## 3. Tiến độ các đợt

| Đợt | Kết quả đã có trong mã nguồn/tài liệu |
|---|---|
| 1 | Rà soát/chuẩn hóa dự án, cô lập kiểm thử, bỏ tracking runtime/secret/dependencies |
| 2 | Giao diện đăng nhập tập trung, AuthGate/controller, xử lý unavailable/denied/expired, PKCE |
| 3 | Web A: workspace, chấm công/bảng công/CSV, đơn điều chỉnh, nhóm/phê duyệt |
| 4 | API sự cố SQLite/PostgreSQL, evidence chính xác, history/version, điều kiện xác minh/đóng |
| 5A | Web B dashboard/Audit/Detection, chi tiết sự cố, nguồn/timeline/evidence/history |
| 5B | Form điều tra/nhận định/đề xuất/actionRefs/verification, conflict và giữ draft, kiểm chứng kết quả đóng |
| 6 | Hồi quy tổng thể cô lập, sửa retention bảo toàn evidence tham chiếu, tài liệu nghiệm thu/vận hành |
| Sau Đợt 6 — 11/11 | Sửa token expiry rồi sửa xác minh effective config mapper; người dùng đã apply, agent chỉ đọc; check cấu hình thật đạt |

Chức năng đã triển khai: SSO/MFA/RBAC theo policy, API JWT/kiểm tra phiên; quản lý nhân viên/chấm công/đơn điều chỉnh; audit/cảnh báo/Detection; điều tra, đề xuất, liên kết hành động, timeline và xác minh sự cố; các module LDAP/governance. Mức hoàn thành source không đồng nghĩa đã nghiệm thu tích hợp thật.

Sự cố dùng `open/reviewing/resolved/false_positive`. Đề xuất không tự thực thi. Hành động phải tham chiếu bản ghi có thật; actor/time do Backend xác định. Đóng cần bằng chứng kiểm tra độc lập và điều kiện Backend; chỉ `resolution.verified=true` mới biểu thị đã xác minh. Gặp 409 hoặc mất phản hồi sau ghi phải đọc lại version/history, không tự retry mutation. Retention giữ evidence được metadata/history tham chiếu.

## 4. Trạng thái kiểm thử

**Lịch sử Đợt 6 (09/11), chưa chạy lại toàn bộ trong phiên 11/11:** 286 test cô lập, 236 kiểm tra browser mocked, build Web A/Web B đạt; 15 suite thành công. Không tính PostgreSQL/MFA/SSO/HTTPS thật là đã đạt. Báo cáo chi tiết và giới hạn nằm trong tài liệu nghiệm thu.

**Lượt 1 ngày 11/11 — sửa refresh, trước lần người dùng apply 06:17 UTC:**

- `python -B -m unittest discover -s tests -p test_security_dashboard_repair.py -v`: **42/42 đạt** (24 cũ + 18 bổ sung).
- `python -B -m unittest discover -s tests -p test_oidc_review.py -v`: **7/7 đạt**, offline.
- `python -B scripts/repair_security_dashboard.py --plan`: đạt, không gọi Keycloak.
- `--check` thật đọc được client, báo chưa khớp cấu hình; không ghi cấu hình.
- Tái hiện giữ access token quá hạn: 401 sau **64,7 giây**, refresh rồi GET thành công.
- Bản sửa đọc cấu hình thật **3 lượt / 113,28 giây / 3 refresh**, không lỗi và các snapshot giống nhau; mọi ghi cấu hình bị probe chặn.
- Chưa chạy `--apply`, browser login/MFA/SSO/HTTPS hoặc kiểm thử PostgreSQL Audit thật trong phiên này. Không build lại UI vì không sửa source UI.

Artifacts đã lọc, ignored: `.runtime/security-client-tests/repair-summary.json`, `repair-unit.log`, `oidc-unit.log`, `plan.log`, `expiry-diagnostic.json`, `refresh-diagnostic.json`, `takeover-baseline.json`. Không lưu token/secret/raw response. Không cộng số test mới vào kết quả lịch sử để tuyên bố tổng suite mới đã chạy.

## 5. Môi trường thật và lỗi đang xử lý

- Docker kiểm tra chỉ đọc: `iam-keycloak` image 26.8.0 đang chạy; `iam-postgres` image 17 healthy. Sandbox có thể không truy cập Docker pipe; lỗi permission không đồng nghĩa Engine dừng.
- Keycloak tại `http://localhost:8080`. Admin `.env` hiện xác thực thành công với realm `master`, `admin-cli`; lỗi HTTP 400 `invalid_user_credentials` trước đây đã hết.
- Người vận hành đã chạy bản cũ `--apply`, tạo được client rồi dừng GET scope mapper với HTTP 401. Backup người vận hành báo: `.local/keycloak-client-backups/security-dashboard-20261111T052852Z-e16e770a.json`; giữ nguyên, không tự restore.
- Chẩn đoán mới xác nhận admin access token `expires_in=60`. Bản cũ lấy token đúng một lần; một lượt collect khoảng 22,8 giây, chuỗi nhiều lượt trong apply vượt hạn. Đã tái hiện cơ chế này chỉ bằng GET, không tái chạy mutation lỗi.
- Trước sửa refresh, client chỉ thiếu `audience_mapper`. Sau sửa source lượt 1 nhưng chưa apply, check báo ba mục URL và mapper. **Sau đó người dùng đã apply** với backup `security-dashboard-20261111T061708Z-200e5d82.json`; URLs và mapper đều đã đúng. Thông báo hậu kiểm thất bại do hai key effective mặc định Keycloak trả thêm, đã xử lý trong lượt 2. Check mới đạt; chi tiết mục 9.
- Backend `SECURITY_FRONTEND_ORIGIN` hiện là localhost. Vì thế dùng **`http://localhost:5174/`** cho login end-to-end. Bổ sung redirect/origin phía Keycloak không tự mở CORS Backend cho `127.0.0.1`; chưa sửa CORS hoặc env.
- Chưa xác minh đầy đủ runtime Backend, hai Web, Audit/LDAP/HTTPS hoặc danh tính test. Hai container IAM không đại diện toàn stack.

## 6. Thay đổi mới trong phiên 11/11

- `scripts/repair_security_dashboard.py`: quản lý expiry bằng monotonic và refresh grant; giữ rotation/non-rotation; retry GET 401 một lần; dừng khi refresh/403/5xx/network lỗi; không replay POST/PUT hoặc tự login lại bằng password. Thời hạn token/policy Keycloak không đổi.
- Chỉ PUT client nếu trường quản lý khác; bổ sung phần thiếu của client đã có, cập nhật mapper cùng ID, rerun no-op. Phát hiện duplicate client/mapper; audience đã có dưới tên khác hoặc shared scope thì dừng đối chiếu, không tự thêm trùng. Kiểm tra scope bổ sung chỉ được cấp quyền đọc.
- URL chính xác Web B: `http://localhost:5174/` và `http://127.0.0.1:5174/`; Web Origins không dấu `/` cuối; post-logout attribute dùng `##`. Root/base vẫn localhost; không wildcard, không đổi issuer, employee-portal, users, roles hoặc MFA.
- Giữ backup trước mọi ghi, preflight/so sánh sau backup, thông báo partial changes và yêu cầu check khi lỗi. Không transaction toàn chuỗi; tránh chỉnh đồng thời bằng Console/script khác.
- `tests/test_security_dashboard_repair.py`: 18 ca bổ sung bao phủ token lifecycle, lỗi không retry, apply chậm, partial/rerun, mất phản hồi sau commit, chống trùng, hai callback và quyền đọc scope.
- `docs/SUA_CLIENT_SECURITY_DASHBOARD.md`: phân biệt lịch sử HTTP 400 với kết quả mới, chẩn đoán 401, hướng dẫn apply/login thật.
- Tạo `docs/PROJECT_CONTEXT.md` và `AGENTS.md` gốc (trước phiên không tìm thấy AGENTS trong cây source được truy cập) để bàn giao và giữ ngôn ngữ tiếng Việt.

## 7. Bảo toàn workspace và ràng buộc

Git khi tiếp quản có **6.360 staged deletions** và **34 tracked modifications**, cùng nhiều file mới chưa tracked. Phần lớn staged deletions là bỏ tracking runtime/dependencies từ các đợt trước; không khôi phục hoặc coi là yêu cầu xóa file thật. Một số thư mục fixture tạm cũ không đọc được; không thay ACL/xóa chúng để làm kiểm kê đạt.

Baseline hash 212 tệp source/tài liệu và Git index lưu trong artifact riêng. Phạm vi sửa tệp đã có trong phiên chỉ gồm script sửa client, test của nó và tài liệu sửa client; hai file bàn giao là mới. Không sửa index, không ghi đè thay đổi cũ, không commit/push/deploy.

Theo yêu cầu người dùng đang có hiệu lực: không tự chạy `--apply` thật; không setup tuần 2/3; không reset/xóa database/Docker volumes; không đổi employee-portal/users/roles/MFA; không xuất password/token/secret; giữ cơ chế bảo mật. Không tự chạy Backend/lab runner/migration, các test tài khoản có tác động hoặc script setup/restore để làm test đạt. Người dùng sẽ chủ động chạy apply theo hướng dẫn.

## 8. Công việc tiếp theo

1. Người vận hành chạy lại `--check` bằng source mới để đối chiếu kết quả đã đạt: `configurationMatches:true`, `differences:[]`. **Không cần apply lại cho lỗi mapper đã chẩn đoán ở mục 9.** Giữ cả hai backup; nếu có chênh lệch mới thì kiểm tra nguyên nhân trước, không xóa client/reset realm.
2. Kiểm tra login Web B trên localhost bằng tài khoản test `company-iam` đã có quyền và hồ sơ Backend phù hợp, MFA theo policy. Admin realm `master` của script không thay tài khoản nghiệp vụ Web B.
3. Kiểm thử SSO A↔B, logout phiên test, API profile và RBAC admin/auditor/employee/manager. Lưu status/mã lỗi đã lọc, không HAR/cookie/token. Chi tiết trong tài liệu sửa client.
4. Nếu cần sử dụng `127.0.0.1` cho toàn luồng, thiết kế cấu hình origin Backend rõ ràng trong công việc riêng; không dùng wildcard hoặc âm thầm nới CORS.
5. Hoàn thiện tích hợp PostgreSQL Audit trong fixture riêng, workflow sự cố với nguồn/action/probe thật, MFA/SSO/vòng đời phiên và HTTPS/máy thứ hai. Chỉ khởi động/thay đổi môi trường trong phạm vi được người dùng cho phép.
6. Cập nhật tài liệu này sau mỗi lượt đáng kể; ghi rõ thực tế đã chạy, chưa chạy và các lệnh người dùng đã thực hiện. Chưa được kết luận nghiệm thu toàn hệ thống từ lần sửa công cụ này.

## 9. Lượt 2 ngày 11/11 — xác minh audience mapper sau apply của người dùng

**Đầu vào:** người dùng đã chạy script sửa refresh; backup `.local/keycloak-client-backups/security-dashboard-20261111T061708Z-200e5d82.json`, apply dừng ở `Post-write verification failed`, check cũ chỉ báo `audience_mapper`.

**Bằng chứng chỉ đọc trước khi sửa:** đúng một mapper trực tiếp `security-api-audience`, loại `oidc-audience-mapper`, protocol OIDC, consent false. Config audience `security-api`, access token `true`, ID token `false` đều khớp. Không có duplicate explicit audience trong 6 default + 5 optional scopes. Dedicated scope trên Console chính là mapper gắn trực tiếp vào client; không có realm scope riêng `security-dashboard-dedicated` và không cần tạo. Không thay mapping hoặc scope để xử lý lỗi.

**Nguyên nhân chính xác:** GET mapper của Keycloak 26.8.0 trả effective config với `introspection.token.claim="true"`, `userinfo.token.claim="false"` bổ sung theo hai token flags. Script so sánh cả dictionary với payload ba key nên báo sai và hậu kiểm không đạt dù mapper đã được tạo. Đã đối chiếu source `ProtocolMappersResource.getMappers()` và `AbstractOIDCProtocolMapper.getEffectiveModel()` đúng phiên bản; link nguồn và bảng so sánh trong [tài liệu sửa client](SUA_CLIENT_SECURITY_DASHBOARD.md).

**Bản sửa:** `audience_mapper_issues()` chuẩn hóa đúng hai mặc định có bằng chứng rồi kiểm tra đầy đủ config/metadata. Dùng chung ở check, quyết định có cần ghi và hậu kiểm. Không bỏ qua audience sai, thiếu flags, sai kiểu/null, explicit introspection/userinfo khác, `included.client.audience` hoặc config thêm ngoài dự kiến. Check khi lỗi bổ sung `audienceMapperDifferences` chỉ chứa tên trường cố định. Payload mapper, allowlist/chống trùng, backup và toàn bộ class `Api` gồm refresh/retry giữ nguyên.

**Kiểm thử mới:** fixture `EffectiveMapperApi` mô phỏng GET effective config; thêm 8 test, đã chứng minh source cũ thất bại rồi source mới đạt. Tổng lượt này **50/50 test script**, **7/7 OIDC offline**, plan đạt. Hậu kiểm vẫn bị chặn trong ca server giữ mapper sai sau write; ca đúng no-op và không thêm mapper trùng. Không chạy lại browser/build/toàn bộ suite Đợt 6.

**Kết quả live sau sửa:** chạy `python -B scripts/repair_security_dashboard.py --check`, exit code **0**, stdout `{"mode":"CHECK_ONLY","clientExists":true,"configurationMatches":true,"differences":[]}`, stderr rỗng. Chỉ xác thực/refresh và GET cấu hình; không apply thật. Đây là xác minh cấu hình, chưa chứng minh token người dùng/login/MFA/SSO/HTTPS đã đạt.

**File sửa lượt 2:** `scripts/repair_security_dashboard.py`, `tests/test_security_dashboard_repair.py`, `docs/SUA_CLIENT_SECURITY_DASHBOARD.md`, `docs/PROJECT_CONTEXT.md`. Không sửa AGENTS, class Api, client khác, users/roles/MFA/database. Hash Git index và hai backup thật giữ nguyên. Không commit/push/deploy.

**Artifacts riêng, không ghi đè lượt 1:** `.runtime/security-client-tests/mapper-verification/` chứa baseline, live-before đã lọc, tests-before, logs sau sửa, summary, live-check-after và preservation. Không lưu credential/token hoặc raw response. Việc tiếp theo là check lại và kiểm thử đăng nhập trên localhost; không tự chạy apply hoặc tạo thêm dedicated scope.

## 10. Chẩn đoán quyền đăng nhập năm tài khoản còn lại — chỉ đọc, 11/11/2026

**Yêu cầu hiện hành:** người dùng xác nhận admin01 đã sửa thành công, employee01 đăng nhập Keycloak được nhưng Web A báo không có quyền. Kiểm tra các tài khoản còn lại và **báo cáo nguyên nhân trước khi sửa code hoặc database**. Không coi yêu cầu chẩn đoán là quyền sửa mapping, password, roles hoặc MFA.

### Kết quả đối chiếu thật

| Tài khoản | Vai trò Keycloak và hồ sơ | ID SQLite khớp Keycloak | ID seed staff.json khớp Keycloak | ID SQLite cũ còn trong Keycloak |
|---|---|---|---|---|
| admin01 | admin | Có | Có | Không áp dụng: ID khớp |
| auditor01 | auditor | Không | Không | Không, GET trả 404 |
| employee01 | employee | Không | Không | Không, GET trả 404 |
| employee02 | employee | Không | Không | Không, GET trả 404 |
| manager01 | manager | Không | Không | Không, GET trả 404 |
| manager02 | manager | Không | Không | Không, GET trả 404 |

Mỗi username có đúng một tài khoản trong Keycloak, đều enabled, nguồn local, có password credential và không có required actions đang chờ. Các hồ sơ SQLite đều `disabled=0`, `governance_state=active`. Đã đối chiếu effective realm roles, chúng khớp role hồ sơ. Không xác minh mật khẩu thực bằng thử đăng nhập, không in credential hoặc raw response. Mã revocation cũ của employee02 tồn tại nhưng không phải bằng chứng chặn phiên đăng nhập mới; lỗi ID cần được xử lý trước.

Không có hàng `staff` nào với ID Keycloak hiện tại của năm tài khoản bị lệch. Theo `backend/app.js`, Backend tìm hồ sơ bằng `p.sub` → `staff.id`; không tìm theo username. Nếu chưa có hồ sơ, nhánh lỗi `403 UNREGISTERED` xảy ra trước đối chiếu role. `shared/auth-controller.mjs` trình bày lỗi này dưới màn hình từ chối quyền chung, vì vậy câu chữ UI không đủ để kết luận thiếu role.

**Đối chứng employee01:** Keycloak LOGIN thành công cho `employee-portal` lúc `2026-11-11T14:37:02.021Z` (21:37:02 giờ Việt Nam). Audit SQLite ghi `/api/profile`, client `employee-portal`, `403 UNREGISTERED` lúc `2026-11-11T14:37:02.447Z`, khoảng 0,426 giây sau. Audit ghi username `anonymous` vì chưa gắn được hồ sơ, nên đây là đối chứng theo thời điểm và cấu hình, không phải log mang trực tiếp username employee01. Cùng với ID không khớp, bằng chứng xác định được mất liên kết hồ sơ; chưa có bằng chứng xác định thao tác vận hành nào trước đó đã làm các ID thay đổi.

Đối với bốn tài khoản còn lại, lỗi liên kết ID được xác minh qua Admin API và DB thật; **chưa chạy đăng nhập browser end-to-end từng tài khoản**, không tuyên bố chúng đã vượt MFA hoặc toàn bộ kiểm tra phiên. Employee/manager vốn không được vào Web B; đó là chính sách đúng, khác với lỗi Web A.

### Phạm vi kiểm tra và dữ liệu cần giữ

- Đọc cấu hình đường dẫn Backend, seed, SQLite bằng `mode=ro` và `PRAGMA query_only=ON`. Không import `backend/store.js`, không khởi động/restart Backend, không migration. Database được cấu hình là `backend/data/attendance.sqlite`.
- Admin API chỉ GET lookup chính xác username, role mappings, metadata credentials, ID cũ và LOGIN event của employee01. POST chỉ tại token endpoint để lấy/refresh admin token, không endpoint ghi cấu hình. Không gọi `/api/profile` bằng token test vì handler có ghi audit và có thể refresh LDAP.
- Public GET `/health` Backend và trang Web A/Web B đều HTTP 200 khi kiểm tra. Chưa xác minh environment của process đang chạy có override khác file `.env`; kết luận DB dựa trên đường dẫn cấu hình và audit khớp lần lỗi được báo.
- Có dữ liệu đang gắn ID cũ: employee01 có 3 hàng chấm công và 2 đơn điều chỉnh; employee02 có 7 hàng chấm công, 8 đơn và 17 bản ghi hành động nhắm tới ID cũ. Auditor01/manager01 cũng có audit; manager01 có 2 đơn với vai trò reviewer. Đây là số đếm một số bảng liên quan, chưa phải inventory tham chiếu toàn bộ hệ thống.
- `backend/server.js` nạp seed bằng `INSERT ... ON CONFLICT(id) DO NOTHING`, không tự đối soát ID theo username. Chỉ restart hoặc chỉ sửa seed không phải phương án sửa liên kết dữ liệu an toàn.
- Không sửa code, database, seed, env, users/roles/MFA; không setup/reset/apply, commit/push/deploy. Chỉ cập nhật tài liệu bàn giao và artifact chẩn đoán đã lọc.

Artifact: `.runtime/account-diagnostics/read-only-20261111T150415Z.json`, chứa trạng thái/boolean so khớp và số đếm, không password/token/secret hoặc ID thực. Audit còn có lỗi `IDENTITY_UNAVAILABLE` của admin01 trước đó; không coi đó là nguyên nhân của `UNREGISTERED` hiện tại hoặc phủ nhận việc người dùng đã sửa admin01.

**Bước tiếp theo nếu được yêu cầu sửa:** lập phương án đối soát danh tính cũ–mới cho năm tài khoản, xác minh chúng thật sự là cùng chủ thể được phép liên kết, kiểm kê toàn bộ tham chiếu nghiệp vụ/audit, backup và bảo toàn lịch sử. Không bỏ kiểm tra JWT/sub, không tự fallback sang username và không gán thêm role để vượt lỗi. Chưa thực hiện phương án sửa nào trong lượt chẩn đoán này.

## 11. Chuẩn bị đồng bộ ID năm tài khoản — chưa apply thật

**Chỉ thị mới:** người dùng đã cho phép tạo script, dry-run thật và kiểm thử cô lập để sửa employee01, employee02, manager01, manager02, auditor01. `admin01` tuyệt đối không thay đổi. **Chưa được chạy apply thật cho đến khi người dùng xác nhận.** Chỉ thị này thay phạm vi chẩn đoán ở mục 10; không mở quyền sửa password/role/MFA/JWT/LDAP/Keycloak, reset/setup, commit/push/deploy.

Đã tạo `scripts/reconcile_staff_ids.py`, mặc định dry-run. Đọc SQLite `mode=ro`/query_only và Keycloak GET; tái sử dụng transport refresh token của repair client, không sửa class Api. Xác minh duy nhất username, role, local source ở Keycloak/SQLite/seed; bảo vệ admin, chặn LDAP, ID trùng, ID cũ còn tồn tại, trạng thái không active. Quét mọi bảng/cột kể cả ID nhúng JSON/URL và mọi FK; chặn tham chiếu chưa phân loại, trigger trên bảng định ghi, workflow/action chưa kết thúc và directory sync đang chạy.

**Dry-run thật:** `.local/staff-id-plans/review-v2-20261111.json` chứa 5 ánh xạ đầy đủ, số đếm, 11 FK, đường dẫn DB/seed, hash schema/toàn bộ hàng và seed. Integrity/FK đạt. Dự kiến đổi 5 hàng staff, 10 attendance, 10 corrections (bao gồm 2 liên kết reviewer của manager01), 16 notifications: tổng 41 hàng nghiệp vụ riêng biệt. notification_reads, access_requests, lifecycle_workflows, directory_maintenance không có liên kết cần chuyển ở lần đọc này. Seed vẫn giữ ID cũ vì chưa apply.

Giữ nguyên mọi hàng audit/history, gồm 519 events theo actor cũ, 66 identity_events, 27 alerts, 17 actions và 636 outbox payload liên quan. Không đổi JSON snapshot, evidence/actionRefs hoặc lịch sử sự kiện. Apply sẽ thêm 5 hàng `staff_id_reconciliations` để truy vết cũ–mới. `backend/historical-identity.js` cùng các chỉnh sửa nhỏ tại app/operations/governance chỉ dùng ledger cho truy vấn hiển thị/báo cáo, giữ ID gốc trong lịch sử trả về. **Middleware vẫn tra sub trực tiếp trong staff; ID cũ không có quyền đăng nhập, không có fallback username.** Ledger không được dùng làm đích ghi Keycloak hoặc để biến bằng chứng ID cũ thành bằng chứng ID mới.

**An toàn apply đã lập trình và kiểm thử bằng fixture:** yêu cầu Backend/mọi writer dừng, có `--backend-stopped`, kiểm tra cổng cấu hình và plan không lỗi thời; `BEGIN IMMEDIATE`, bật FK và defer đến cuối transaction. Backup SQLite bằng backup API có WAL, kiểm tra hash/integrity/FK; backup seed byte nguyên bản. Thư mục thật dự kiến `.local/staff-id-backups/<UTC>-<random>/` gồm `attendance.sqlite`, `staff.json`, `plan.json`; **chưa có backup thật của đợt này vì dry-run không tạo backup**. Sau cập nhật so sánh mọi hàng theo đúng phép đổi ID cho phép, giữ nguyên tất cả dữ liệu khác/admin/history; thay seed atomic, commit. Lỗi trước commit rollback và phục hồi seed. Marker bền cùng `--recover --backend-stopped` xử lý gián đoạn trước/sau commit mà không restore database; dừng nếu phát hiện dữ liệu ngoài hai trạng thái đã biết. Không xóa backup cũ.

**Kiểm thử:** 25 test mới tại `tests/test_staff_id_reconciliation.py` đạt, có fixture schema thật, kiểm tra backup/rollback/recovery/idempotence và các điều kiện chặn. Test Backend con `tests/staff-id-backend.cjs` dùng JWT RS256 xác minh thật và HTTP Express fixture: trước sync admin01 đạt, 5 tài khoản UNREGISTERED; sau sync cả 6 đạt đúng ID/role, account/session checks vẫn chạy, old/unknown sub/wrong role/audience/ended session và employee Web B vẫn bị từ chối. Quan hệ chấm công/đơn/quyền và truy vấn lịch sử giữ được. Keycloak/session là giả lập; **chưa phải login/MFA/SSO browser thật**. 169 test hồi quy Backend, 50 repair client, 7 OIDC đạt. Artifact Backend: `.runtime/staff-id-tests/regression-b031123308e2434fab4ee92b32c682f8/backend.log`. Các fixture được tạo dưới `.runtime/staff-id-tests/`, không dùng dữ liệu thật.

**Việc tiếp theo:** chờ xác nhận apply. Sau khi được phép, dừng Backend/mọi SQLite writer và tạo plan mới rồi apply theo `docs/DOI_SOAT_ID_TAI_KHOAN_DEMO.md`. DB đã thay đổi sau dry-run khi hệ thống còn chạy, do đó không bỏ qua kiểm tra stale plan để dùng bản khảo sát. Sau apply, dry-run phải Changes: 0; khởi động Backend theo hướng dẫn sẵn có và kiểm thử login sáu tài khoản/Web A/Web B, MFA/SSO thực tế. Không chạy lại các script fix-admin cũ. Bản thân agent chưa thay DB/seed thật, chưa khởi động lại Backend, chưa apply/commit/push/deploy.

## 12. Sửa quy trình khởi tạo máy mới — 12/11/2026

**Phạm vi được phép:** phân tích/sửa source, test cô lập và hướng dẫn triển khai để ngăn UNREGISTERED do ID không khớp. Không apply, không sửa SQLite/seed/Keycloak/LDAP thật, không đổi dữ liệu nghiệp vụ, không xóa volumes. Việc thay đổi dữ liệu thật phải xin xác nhận riêng; bật tự phê duyệt công cụ không thay ranh giới này.

**Nguyên nhân ở source:** setup tuần 2 từng ghi đè seed mà không kiểm tra DB hoặc nguồn ID cũ; Backend nạp seed bằng INSERT/ON CONFLICT(id) mà không đối chiếu Keycloak. `run_week3.py` tự gọi setup mỗi lần chạy; setup tuần 2 import `init_env` có tác động ghi `.env` ngay khi import. Máy mới mang seed/SQLite từ máy khác hoặc dùng realm được tạo lại dễ có cùng username nhưng UUID khác. Chưa xác định được thao tác lịch sử cụ thể nào gây năm ID lệch trên môi trường hiện tại.

**Các thay đổi:**

- `scripts/bootstrap_profiles.py`: guard provisioning khi đã có SQLite/sidecar/marker khôi phục; đọc đường dẫn từ Backend config và từ chối override không được hỗ trợ. Xác minh username duy nhất, ID Keycloak, local source/enabled/effective role, chặn LDAP/service user/trùng ID. Giữ seed có sẵn nếu khớp nguyên trạng, không ghi đè khác biệt. Xác minh cả sáu rồi xuất seed nguyên vẹn bằng file tạm + hard link không clobber. Không sinh UUID nhân viên ở local.
- `setup_keycloak.py`, `setup_week2.py`, `setup_week3.py`: dùng các guard trước provisioning và export đã xác minh; dùng transport refresh token có sẵn của repair (class Api không thay đổi). Không sửa mật khẩu user đã tồn tại. Chặn user có role xung đột/federation trước ghi cấu hình. Setup tuần 2 không import initializer ghi env nữa.
- `init_env.py`: có `main()` và main guard, import không ghi; tạo thiếu cả Web B và public URL, bảo toàn giá trị/file hiện có. `run_week3.py` bỏ gọi setup, chờ realm company-iam và chạy bootstrap check trước mở ứng dụng.
- `backend/bootstrap.js`: đọc seed/SQLite chỉ đọc, kiểm tra integrity/FK, kiểm tra seed đầy đủ và ID/username khớp staff, xác minh qua service Admin API. Cài mới kiểm tra role/enabled, nạp cả sáu trong transaction. DB đã có dữ liệu không tự nạp lại seed, bảo toàn mọi role/team/MFA/disabled/revocation. Danh tính local active được kiểm tra ID; hồ sơ disabled/hold/retired không bị ép khôi phục, LDAP giữ quy trình hiện có. Thay đổi local trong lúc kiểm tra làm dừng.
- `backend/keycloak-admin.js`: thêm lookup bootstrap chỉ GET user/effective role, trả trường đã lọc. `backend/server.js`: preflight trước mở DB ghi/migration, xử lý pending và collector; thêm `--check-bootstrap` không mở listener/ghi DB; `.env` mặc định neo ở Backend dù chạy từ root. Import server không tự start. Không thay middleware JWT/sub/RBAC hoặc thêm fallback.

**Kiểm thử đã chạy:** 13 test Python provisioning mới, trong đó seed do setup giả lập xuất đi qua 20 test Backend bootstrap. Fixture kiểm tra production startup check-only qua HTTP IAM giả lập; cả sáu tài khoản dùng JWT RS256 ký/xác minh thật đều đúng ID/role, old/unknown ID vẫn UNREGISTERED, sai role và employee Web B vẫn bị chặn. Bao phủ seed/DB cũ, trùng/thiếu/LDAP, role sai, lỗi account thứ sáu, rollback toàn bộ batch khi INSERT lỗi giữa chừng, race seed, hai startup, orphan data, pending recovery, không ghi khi mismatch và không tự reseed/khôi phục security state.

Hồi quy cuối: **203 test Backend đạt** (tất cả file `backend/*.test.js`, bao gồm 20 test mới); **100 test Python đạt** (bootstrap 13, reconciliation 25, repair client 50, OIDC 7, phase4 safety 5); đã chạy lại nhóm bootstrap sau bổ sung test rollback. Các subprocess Node trong Python là fixture bổ sung, không cộng thành số test live. Log Backend cuối: `.runtime/bootstrap-tests/final-d051cfc00d404cd1b5cd535aaa321b5e/backend.log`. Không chạy browser Docker/SSO/MFA thật và không chạy `node backend/server.js --check-bootstrap` trên môi trường thật trong lượt này.

**Tài liệu:** thêm `docs/KHOI_TAO_MAY_MOI.md`; nối từ README, CHAY_NHANH và HUONG_DAN_KHOI_DONG. Máy mới: init config → Docker IAM → setup tuần 3 trước lần đầu Backend → bootstrap check → runner tuần 3. Stack LDAP/Audit/HTTPS đầy đủ theo hướng dẫn riêng, không được coi đã provision bởi luồng core này.

**Hệ quả vận hành/việc tiếp theo:** Keycloak cần sẵn sàng khi start Backend. Nếu năm ID của môi trường hiện tại chưa đối soát, preflight sẽ chặn restart trước migration/collector; không restart để thử hoặc chạy lại setup. Chờ xác nhận riêng cho quy trình đối soát mục 11 hoặc triển khai thật trên môi trường mới đã xác định rõ. Giữ nguyên tiến trình/dữ liệu đang vận hành, backup và Git index hiện có; chưa commit/push/deploy.

## 13. Giai đoạn 1 trước đồng bộ/kiểm thử live — 12/11/2026

**Yêu cầu đang có hiệu lực:** giai đoạn 1 kiểm tra Keycloak/SQLite/sáu tài khoản, writer, plan dry-run, backup/rollback/integrity rồi báo cáo. Giai đoạn 2 (dừng Backend, backup, apply, start và test Backend) **chỉ sau xác nhận riêng**. Giai đoạn 3 là login/RBAC Web A/B, MFA tuần 5, LDAP tuần 6. Không reset/xóa DB/volumes/IAM, không bỏ JWT/RBAC/MFA.

**Kết quả mới:** đọc lại các tài liệu bắt buộc và source; Git vẫn có 6.360 staged deletions, 41 tracked modifications ở đầu lượt, giữ nguyên index. SQLite `mode=ro`/query_only: integrity/FK PASS, 25 staff; cả sáu demo local/active/role đúng/duy nhất, ID seed khớp SQLite. Năm ID local vẫn bằng old_id trong plan lịch sử 11/11, nhưng **chưa xác minh lại Keycloak nên không được kết luận live vẫn lệch hoặc admin01 vẫn khớp IAM**. Không có ledger hoặc recovery marker. Inventory cục bộ theo ID lịch sử kiểm tra 11 FK, dự kiến 41 hàng nghiệp vụ như mục 11, không có blocker mới.

**Chặn môi trường:** public GET Keycloak 8080, Backend 3001 health, Web A 5173, Web B 5174 đều không kết nối được. Docker CLI báo không tìm thấy pipe dockerDesktopLinuxEngine. Đã hỏi người dùng bật Docker/IAM hiện có và báo khi Keycloak sẵn sàng, chưa tự start container/Backend. CIM/Get-NetTCPConnection không truy vấn được; netstat không thấy listener các cổng dự án, Restart Manager trả mã 29; có node PID 71808 chưa xác định. Không thể coi mọi writer đã dừng chỉ từ việc cổng 3001 đóng.

**Dry-run:** đã thực hiện `python -B scripts/reconcile_staff_ids.py --plan .local/staff-id-plans/phase1-20261112T061107Z.json`; exit 1 ở kết nối token endpoint, file plan không được tạo. Không dùng plan cũ thay thế. Chưa có yêu cầu/đồng ý apply mới.

**Backup/tests:** hai backup client cũ và backup-data-admin01 giữ nguyên hash; backup SQLite integrity/FK PASS, seed backup khớp DB backup cả sáu tài khoản. Đây là backup lịch sử, không thay thế backup mới trước apply. 25/25 test reconciliation chạy lại đạt, gồm backup/rollback/recovery và Backend nhận diện sáu tài khoản trên fixture. Không dùng dữ liệu thật làm fixture, chưa chạy login/MFA/LDAP thật. Không có lý do sửa source ứng dụng mới trong lượt này.

**Bảo toàn cuối lượt:** hash nội dung logic SQLite, hàng admin01, seed, backup và Git index đều không đổi. Chưa dừng/start/apply/reset, commit/push/deploy. Chỉ thêm tài liệu kết quả và artifacts đã lọc ở `.runtime/login-phase1/20261112T061107Z/`. Báo cáo: `docs/KET_QUA_GIAI_DOAN_1_DANG_NHAP.md`.

**Tiếp tục:** khi Keycloak sẵn sàng, hoàn tất đối chiếu live và tạo plan mới trong giai đoạn 1, làm rõ writer rồi báo cáo trước khi xin/chờ xác nhận giai đoạn 2. Giữ Backend chưa restart nếu ID vẫn lệch vì bootstrap mới sẽ chặn. Không đánh dấu giai đoạn 1 hoặc nghiệm thu toàn hệ thống đã PASS khi phụ thuộc chưa sẵn sàng.

## 14. Giai đoạn 1 tiếp tục sau khi Docker hoạt động — dry-run PASS

**Chỉ thị hiện tại:** tự đối chiếu sáu tài khoản, tạo plan mới, kiểm tra bản ghi/writer/backup/rollback; không dùng plan cũ, không apply/ghi dữ liệu thật/reset container, không khởi động Backend/Web A/B. Dry-run PASS thì dừng chờ xác nhận.

**Live 12/11/2026 13:25–13:27 giờ Việt Nam:** discovery Keycloak HTTP 200, issuer đúng. `reconcile_staff_ids.py --plan .local/staff-id-plans/phase1-20261112T062520Z.json` exit 0. Script xác minh sáu username duy nhất, local/enabled/active, role đúng cả local/seed/effective Keycloak. Admin01 khớp `659f01ed-ead4-4392-bb76-070644feea9f`, không trong mapping. Employee01, employee02, manager01, manager02, auditor01 vẫn lệch; ID cũ GET 404, ID mới không trùng hồ sơ. Plan này lấy trực tiếp dữ liệu hiện tại, không dùng plan ngày 11/11 hoặc lượt thất bại làm đầu vào.

**Plan:** `D:\ZeroTrust\.local\staff-id-plans\phase1-20261112T062520Z.json`, SHA-256 `e7cea8a0a2b187aab66efdb51b54b781bb0cc8a49512d3d4afa352f27d84fce4`. Dự kiến 41 hàng: staff 5, attendance 10, corrections 10 (bao gồm 2 reviewer references), notifications 16; thêm 5 ledger, sửa 5 ID seed. Các bảng quyền/lifecycle/maintenance/notification_reads không có hàng cần chuyển của năm ID. Quét 11 FK, integrity/FK PASS, lịch sử/audit giữ nguyên.

**Kiểm thử/backup:** 25/25 test reconciliation chạy lại PASS, bao gồm backup/rollback/recovery, bảo toàn admin/history, nhận diện sáu tài khoản với JWT thật trên fixture. Backup SQLite cũ integrity/FK đạt, JSON backup client đọc được; mọi hash backup giữ nguyên. Chưa tạo backup thật mới cho apply; phải tạo ngay trước ghi sau khi được phép.

**Writer và giới hạn:** netstat/socket không thấy listener 3001/5173/5174; thấy 8080. CIM PermissionDenied, node PID 71808 chưa xác định vai trò; chưa chứng minh đầy đủ mọi SQLite writer đã dừng. Docker API cũng PermissionDenied từ sandbox, trạng thái container Running/Healthy theo người dùng; HTTP/Admin API Keycloak được kiểm tra độc lập. Không thử nâng quyền/bỏ chặn hoặc kill process. Trước apply cần làm rõ writer và giữ stale-plan/integrity checks, không suy an toàn chỉ vì cổng đóng.

**Bảo toàn:** nội dung logic DB, admin01, staff.json, backup và Git index giữ nguyên đầu/cuối lượt; DB vẫn khớp hash plan tại 13:27, không có marker recovery. Không sửa source ứng dụng, không gọi endpoint ghi IAM ngoài token authentication, không apply, không start Backend/Web, không commit/push/deploy. Artifacts `.runtime/login-phase1/20261112T062520Z/`; báo cáo mới nhất ở đầu `docs/KET_QUA_GIAI_DOAN_1_DANG_NHAP.md`.

**Bước tiếp theo:** chờ người dùng xác nhận giai đoạn 2. Sau xác nhận vẫn phải kiểm tra/dừng writer an toàn, kiểm tra lại plan không lỗi thời, backup mới rồi mới đồng bộ và hậu kiểm. Chưa nghiệm thu login/RBAC/MFA/LDAP thật; LDAP container chạy không thay kết quả kiểm thử tuần 6.

## 15. Chuẩn bị giai đoạn 2 — chưa đủ điều kiện READY FOR APPLY

**Phạm vi mới:** người dùng yêu cầu xác định PID 71808 và mọi nguồn ghi SQLite/seed, kiểm tra plan/backup/restore, chuẩn bị lệnh apply; chỉ đọc và test an toàn. Không apply/ghi SQLite thật/dừng tiến trình chưa rõ/thay Keycloak hoặc LDAP. Nếu còn điều kiện chưa đạt phải báo BLOCKED.

**Kết luận BLOCKED:** Get-Process đọc được PID 71808, executable `D:\node\node.exe`, nhưng Get-CimInstance process bị PermissionDenied, chưa có entrypoint/parent để xác định chính xác vai trò. Get-ScheduledTask và CIM service cũng không đủ quyền. Không thấy listener Backend/Web không chứng minh không có worker/task nền; chưa xác nhận tất cả writer dừng. Không tự nâng quyền hoặc kết luận an toàn. Đã chuẩn bị các lệnh truy vấn PowerShell Administrator, chỉ xuất metadata/entrypoint được lọc, không raw command line/arguments; hướng dẫn Resource Monitor kiểm tra handle SQLite/WAL/SHM/seed và Docker mounts nếu cần. Không stop/disable process/task/service/container.

**PASS đã có:** plan `phase1-20261112T062520Z.json` giữ SHA-256 công bố; hash DB/seed/path khớp. Gọi GET Keycloak lại và dựng plan trong bộ nhớ lúc 13:37: toàn bộ plan bằng đúng file đã chỉ định; admin01 khớp, năm mapping đúng. Không tạo/ghi đè plan mới. Cuối 13:41 DB/seed/admin01/index/plan vẫn nguyên; integrity/FK PASS, không marker recovery.

**Backup:** kiểm tra ghi/fsync/atomic rename/đọc lại bằng file tổng hợp trong thư mục probe riêng dưới `.local/staff-id-backups`, rồi dọn đúng file/thư mục probe vừa tạo. Không dùng dữ liệu thật làm fixture, không tạo backup nghiệp vụ mới hoặc restore dữ liệu thật. Còn 58.991.493.120 byte trống tại thời điểm probe, ước lượng DB+WAL+seed 7.582.172 byte. 25/25 test reconciliation chạy lại PASS (backup/rollback/recovery/sáu account qua Backend fixture). Backup thật mới vẫn phải tạo trước UPDATE sau khi đã được phép.

**Tài liệu/lệnh:** `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md` chứa lệnh kiểm tra quyền phù hợp, lệnh apply chính xác `python -B scripts/reconcile_staff_ids.py --apply --backend-stopped --plan .local/staff-id-plans/phase1-20261112T062520Z.json` **chưa chạy**, hậu kiểm Changes:0/integrity/admin/history/seed, bootstrap check, test Backend cô lập rồi startup/health khi được xác nhận. `--backend-stopped` là lời xác nhận của operator, không là bằng chứng tự phát hiện mọi writer. Không chạy nếu chưa gỡ blocker hoặc chưa có xác nhận riêng. Không thay ExecutionPolicy; lệnh trong tài liệu được kiểm tra cú pháp, không thực thi apply/start.

Artifacts: `.runtime/apply-readiness/20261112T063628Z/` gồm baseline/local-readiness/live-readiness/rollback-tests/final-status. Không có secret/raw response. Không đổi source ứng dụng, database/seed thật, IAM/LDAP; không commit/push/deploy.

## 16. PID 71808 đã xác định là Codex — vẫn cần kiểm kê writer khác

Người dùng cung cấp kết quả PowerShell Administrator: PID 71808 = D:\node\node.exe, CommandLine có @openai/codex/bin/codex.js, ParentProcessId 67088. Chấp nhận đây là bằng chứng người vận hành, không còn hỏi lại danh tính hoặc đề xuất dừng PID này. Agent đọc được parent là cmd.exe; không in raw command line chứa tham số.

Kiểm tra 14:00–14:01: Get-Process theo bộ lọc node/python/sqlite/dbeaver/sqlitestudio/pm2/nssm không thấy ứng viên khác ngoài Codex; netstat/socket không thấy listener 3001/5173/5174, có 8080. Get-Service Name/DisplayName theo tên liên quan trả 0 ứng viên. **Không suy mọi writer đã dừng:** Get-CimInstance process/service và Get-ScheduledTask vẫn PermissionDenied; chưa kiểm kê đủ executable/config của service, task/wrapper và handle file. PowerShell Administrator do người dùng mở không nâng quyền sandbox. Trạng thái tiếp tục BLOCKED vì các mục này, không phải vì PID Codex.

Đã đọc lại Keycloak bằng GET và SQLite mode=ro, dựng plan trong bộ nhớ: vẫn bằng chính xác `.local/staff-id-plans/phase1-20261112T062520Z.json`. Plan hash, DB hash, seed/path khớp, admin01 live khớp và năm ID vẫn lệch như plan. Integrity/FK PASS, không marker; nội dung DB/seed/admin01/index không đổi đầu/cuối lượt. Không ghi đè plan, không apply/start/stop/kill hoặc đổi quyền/cấu hình IAM/LDAP. Không chạy lại 25 test đã đạt vì không sửa source/test trong lượt này.

Artifacts `.runtime/apply-readiness/20261112T070031Z/readiness.json`. Đã cập nhật `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md`: loại PID Codex khỏi danh sách ứng viên, yêu cầu bổ sung kết quả process/service/task và Resource Monitor handles từ phiên Administrator, chỉ metadata đã lọc. Cần các bằng chứng này trước READY FOR APPLY; người dùng vẫn phải xác nhận riêng trước apply thật.

## 17. Công cụ kiểm kê writer — 12/11/2026, 17:52, vẫn BLOCKED

Tiếp tục chỉ đọc/kiểm thử an toàn để chuẩn bị giai đoạn 2. Get-Process hiện thấy Node PID **70024**, executable `D:\node\node.exe`; CIM không đọc được entrypoint. Không suy PID mới là Codex từ xác minh PID 71808 trước đó, không dừng bất kỳ process nào. CIM process/service và Get-ScheduledTask vẫn PermissionDenied; Restart Manager start mã 29; Docker query không thực hiện được trong sandbox. Cổng 3001/5173/5174 không kết nối được, nhưng chưa chứng minh mọi writer đã dừng.

Thêm `scripts/inspect_sqlite_writers.py` để người dùng chạy bằng `python -B scripts/inspect_sqlite_writers.py` trong PowerShell Administrator tại root. Công cụ không tự nâng quyền, không thay policy, không gọi apply hoặc mở DB; chỉ ghi artifact `.runtime/writer-inventory/<UTC>-<random>.json`. Kiểm kê ứng viên process/service/task (gồm shell/wrapper), Restart Manager query-only cho DB/WAL/SHM/seed, mount của container đang chạy và cổng ứng dụng. Bỏ raw arguments/command lines/stderr; lỗi từng truy vấn được giữ, không coi là không có writer. Không dùng PID Codex cố định để loại trừ. Khi đủ truy vấn vẫn `REVIEW_REQUIRED`, cần người vận hành/agent rà soát cấu hình và khả năng tự chạy lại; không tự báo READY.

**Kiểm thử mới:** 8/8 PASS ở `tests/test_writer_inventory.py`, fixture/mock không dùng dữ liệu thật, có thực thi đoạn PowerShell với cmdlet giả để kiểm tra parse/lọc secret và Codex/worker. Không chạy lại nhóm reconciliation 25 test hoặc Backend vì không đổi source liên quan; kết quả trước đó vẫn là lịch sử.

Chạy công cụ thật trong sandbox: `.runtime/writer-inventory/20261112T105202Z-4832052b.json`, `BLOCKED_INVENTORY`. Đối chiếu local mode=ro/query_only: plan hiện tại `phase1-20261112T062520Z.json` nguyên hash, SQLite/seed vẫn khớp plan, integrity/FK PASS, không recovery marker; artifact `.runtime/writer-inventory/local-plan-20261112T1052Z.json`. Không gọi lại Keycloak lượt này; lần live gần nhất vẫn 14:01. Không đổi SQLite/seed/Keycloak/LDAP, không backup nghiệp vụ mới, không apply, không start/stop Backend/Web/container, không commit/push/deploy.

**Tiếp theo:** người dùng chạy công cụ trong cửa sổ Administrator rồi gửi đường dẫn Report. Nếu Restart Manager vẫn lỗi, bổ sung Resource Monitor Associated Handles như hướng dẫn mới đầu `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md`. Phải xử lý mọi truy vấn thiếu, phân loại worker/service/task/wrapper/mount liên quan và bảo đảm không tự chạy lại trong cửa sổ bảo trì; kiểm tra lại live plan trước READY. Chờ xác nhận riêng mới đồng bộ 5 tài khoản; admin01 giữ nguyên. Sau đó mới hậu kiểm, startup/health và nghiệm thu thật Web A/B/MFA/LDAP theo phạm vi được phép.

## 18. Đã đọc inventory Administrator — 12/11/2026, 17:54–17:57

Người dùng cung cấp `.runtime/writer-inventory/20261112T105459Z-6fd77b95.json`, trạng thái REVIEW_REQUIRED. Đã đọc toàn bộ: administrator=true, tất cả query OK, 304 process quét/19 ứng viên, 323 service/1 ứng viên, 299 task/8 ứng viên, 3 container. Restart Manager đăng ký đủ DB/WAL/SHM/seed và trả 0 process, mọi code 0. Không có Docker mount ghi vào Backend/DB/seed: một bind directory/.local read-only, còn lại LDAP/PostgreSQL volumes. Cổng 3001/5173/5174 đóng. **Không còn lấy lỗi PermissionDenied của inventory sandbox cũ làm blocker cho các mục đã được Administrator đọc thành công.**

PID **70024 đã xác định Codex CLI** bằng entrypoint @openai/codex/bin/codex.js, parent 4320 cmd, tiếp theo 10668 PowerShell. Không phải Backend, không dừng chuỗi Codex. Codex có thể thực thi công cụ ghi theo chỉ thị, không đồng nghĩa không bao giờ ghi được; phiên hiện tại chỉ đọc. Python launcher 5856 bắt đầu cùng thời điểm inventory, có thể là launcher của công cụ nhưng thiếu PID con để chứng minh; Get-Process sau báo cáo không còn PID này. PID 0 là nhiễu sentinel của bộ lọc, không là writer. Task NVIDIA/Defender/Workplace Join phù hợp phần mềm/hệ thống qua executable paths, không thấy dấu hiệu ZeroTrust; 2 task Workplace Join Disabled.

**Kết luận vẫn BLOCKED vì thiếu phân loại, không phải query failure của JSON:** cmd 58556 (parent Chrome), PowerShell 61524 chưa rõ chức năng; task Hotpatch/Monitoring Enabled/Ready chạy cmd.exe nhưng ẩn Arguments nên chưa rõ lệnh thật; chưa biết distro WSL đang chạy ngoài Docker. WSLService và các process Docker/WSL không đủ để loại trừ Linux worker. Agent thử `wsl.exe --list --running` chỉ đọc nhưng sandbox E_ACCESSDENIED. Hướng dẫn người dùng xem command line cục bộ trong Task Manager và action Hotpatch trong Task Scheduler, chỉ gửi tên executable/script/mục đích không secret; xác nhận 18380 là console inventory; cung cấp danh sách WSL đang chạy. Không yêu cầu dừng/disable hoặc chạy lại Resource Monitor khi query file users đã thành công.

Chi tiết đủ các nhóm và ba bước bổ sung ở đầu `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md`. Chưa chạy apply/stop/start, không sửa DB/seed/Keycloak/LDAP hoặc code; chỉ cập nhật tài liệu, không chạy lại test. Chưa tái kiểm tra live plan trong lượt này; local bằng chứng 17:52 và live Keycloak 14:01 là lịch sử cần kiểm tra lại trước READY. Apply vẫn cần xác nhận riêng.

## 19. Xác nhận bổ sung đã được chấp nhận; live plan kiểm tra lại PASS — 18:07 ngày 12/11

Người dùng xác minh Administrator: WSL chỉ docker-desktop; cmd 58556 là McAfee WebAdvisor BrowserHost; PS 61524/18380 là console thông thường không chạy script ZeroTrust; Hotpatch/Monitoring gọi hpatchmonTask.cmd, script chỉ kiểm tra Hotpatch/VBS/hpatchmon, không truy cập dữ liệu dự án. Đối chiếu phù hợp inventory 17:54; **gỡ các điểm thiếu này, không yêu cầu người dùng kiểm tra lại chúng**. Codex 70024 vẫn giữ nguyên danh tính/StartTime, không dừng.

Đã đọc lại Keycloak bằng transport read-only và SQLite mode=ro/query_only, dựng plan trong bộ nhớ lúc **18:07:03**: toàn bộ plan bằng file phase1-20261112T062520Z.json, SHA/path đúng, admin01 live khớp, đúng 5 account còn lệch, không collision/LDAP/role lỗi. Integrity/FK PASS (11 FK), không pending marker; 41 hàng nghiệp vụ dự kiến (5 staff/10 attendance/10 corrections/16 notifications), 5 ledger mới và 5 ID seed khi apply. Đầu/cuối không thay nội dung SQLite/seed/plan/index. Artifact `.runtime/apply-readiness/20261112T110618Z/readiness.json`.

Backup probe tổng hợp riêng dưới `.local/staff-id-backups` PASS ghi/fsync/atomic rename/đọc, đã dọn đúng probe; free 59.192.614.912 bytes so với nguồn 7.582.172 bytes. Không backup nghiệp vụ mới/restore/ghi DB thật. Không đổi code và không chạy lại test rollback đã đạt 25/25.

**Còn BLOCKED về độ mới của inventory:** Get-Process hiện có PS **51912** bắt đầu **18:03:58**, chưa có trong báo cáo cũ và chưa xác định chức năng; PS 18380 đã kết thúc. Không coi PS chạy truy vấn của agent là ứng viên cần hỏi. Không Node Backend/Python worker; cổng 3001/5173/5174 đóng. Refresh inventory sandbox `.runtime/writer-inventory/20261112T110547Z-65431b25.json` vẫn thiếu quyền CIM/task/Docker và RM start 29, nên không tự xác nhận handles hiện tại. Báo cáo Administrator trước đó vẫn hợp lệ cho thời điểm 17:54, không bị phủ nhận bởi lỗi quyền sandbox.

Đã hỏi người dùng xác nhận chức năng PS 51912 và chạy lại `python -B scripts/inspect_sqlite_writers.py` trong Administrator, gửi đường dẫn Report. Cần đọc báo cáo mới rồi xét READY theo các process đã được phân loại, không lặp vô hạn yêu cầu xác minh PID không đổi. Chưa có xác nhận apply; không stop/start Codex/Docker/Backend/Web, không thay SQLite/seed/Keycloak/LDAP. Quy trình apply/backup/hậu kiểm vẫn ở docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md và chỉ thực thi sau xác nhận riêng.

## 20. READY FOR APPLY — 12/11/2026, 18:14; chưa có quyền apply

**Trạng thái hiện hành: READY FOR APPLY, chờ người dùng xác nhận riêng.** Thay kết luận BLOCKED của mục 19; không coi các blocker lịch sử đã giải quyết là còn hiệu lực.

Đã đọc và so sánh toàn bộ báo cáo Administrator mới `.runtime/writer-inventory/20261112T111027Z-46b3b817.json` (checkedAt 18:10:20). Tất cả query OK, Restart Manager Start/Register/List 0, đủ attendance.sqlite/WAL/SHM/staff.json, **0 process sử dụng file**. 308 process quét/19 ứng viên; services 323/1, tasks 299/8, 3 container. Metadata các PID chung, services/tasks/mounts giữ nguyên so báo cáo 17:54; cổng 3001/5173/5174 đóng. Các mục McAfee, WSL chỉ docker-desktop, Hotpatch đã được người dùng xác minh và không cần hỏi lại.

Người dùng xác minh PS 51912 là console thông thường, command line chỉ powershell.exe không script ZeroTrust. Python Manager launcher 34980 có parent 51912, xuất hiện cùng thời điểm inventory; kiểm tra Get-Process sau đó không còn, không có Python worker; Node duy nhất 70024 là Codex. Không thêm blocker chỉ vì launcher tạm trong inventory. Không dừng Codex/Docker.

Đối chiếu live Keycloak/plan/backup lúc 18:07 ở `.runtime/apply-readiness/20261112T110618Z/readiness.json`: admin01 khớp, đúng 5 mapping, toàn plan khớp, backup probe PASS. Hậu kiểm local lúc 18:14: plan nguyên SHA-256, SQLite/seed hash khớp, integrity/FK PASS, không recovery marker; free backup 59.192.582.144 byte. Không gọi lại Keycloak hoặc chạy lại test vì không đổi code; bằng chứng test reconciliation rollback/recovery 25/25 vẫn là lịch sử. Artifact tổng hợp mới `.runtime/apply-readiness/20261112T111411Z/inventory-review.json`; không sửa báo cáo gốc/trạng thái lịch sử.

Đã cập nhật đầu `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md` với READY, nguồn/thời điểm bằng chứng và lệnh apply chính xác **chưa chạy**. Sau xác nhận: giữ writer dừng, script revalidate/backup mới trước UPDATE, đồng bộ đúng 5 tài khoản (41 hàng nghiệp vụ, 5 ledger, 5 ID seed), admin/history bảo toàn; hậu kiểm Changes:0/integrity/6 accounts/bootstrap, toàn bộ test Backend cô lập, startup/health rồi nghiệm thu Web A/B/MFA/LDAP theo phạm vi cho phép. Nếu môi trường thay đổi mới kiểm tra lại phần thay đổi; không bỏ guard stale plan hoặc coi READY là quyền tự apply.

Phiên này chỉ đọc SQLite/seed và cập nhật tài liệu/artifact. **Chưa apply, chưa backup nghiệp vụ mới, chưa stop/start, chưa sửa dữ liệu thật/IAM/LDAP; chờ xác nhận riêng.**

## 21. Đã được phép migration, nhưng preflight bắt buộc mới BLOCKED — 12/11, 18:25

**Người dùng đã cấp quyền rõ ràng đồng bộ 5 tài khoản thật theo plan**, kèm backup/hậu kiểm; không xin lại cùng quyền. Điều kiện mới: kiểm tra ngay trước migration, nếu sandbox không kiểm tra được bắt buộc thì dừng BLOCKED, không dùng inventory/READY cũ làm thay thế. Backup phải có manifest đường dẫn/dung lượng/SHA-256 từng file, được xác minh trước mutation. Quyền không mở rộng sang IAM/LDAP, dữ liệu ngoài plan hay thao tác phá hủy.

Đã đọc đủ tài liệu/source/plan/inventory/readiness yêu cầu. Preflight **mới lúc 18:24:59 PASS về dữ liệu**: Keycloak xác minh admin01 khớp và đúng 5 account lệch; toàn live plan bằng phase1-20261112T062520Z.json; SHA/path/env guard đạt; SQLite/seed hash khớp, integrity/FK PASS 11 FK, không pending marker hoặc blocker nghiệp vụ. Dự kiến vẫn 41 hàng (staff5/attendance10/corrections10/notifications16). Đã ghi số hàng mọi bảng, DB/seed/plan không đổi đầu/cuối. Free backup 59.192.569.856 byte, chưa chạy lại probe ghi vì dừng trước bước backup. Artifact `.runtime/apply-readiness/authorized-20261112T112417Z/preflight.json`.

**BLOCKED 1:** inventory hiện tại 18:25:17 `.runtime/writer-inventory/20261112T112522Z-f6e5f012.json`: CIM process/service/task PermissionDenied, RM start29 không có kết quả handles, Docker query thất bại. Cổng Backend/Web đóng nhưng không chứng minh writer dừng. Theo yêu cầu mới không thay bằng bằng chứng 18:10. Hướng dẫn người dùng chạy `python -B scripts/inspect_sqlite_writers.py` trong PowerShell Administrator và gửi Report mới, giữ cửa sổ bảo trì.

**BLOCKED 2:** khi đọc source đã phát hiện cơ chế backup tự động hiện có chưa tạo manifest file path/size/SHA-256 theo yêu cầu mới. Backup API nhất quán gồm committed WAL, integrity/FK/content verification trước UPDATE và seed readback đã có; plan databaseHash là logical hash, không thay file hash manifest. Cần bổ sung vào chuỗi backup hiện có và test failure/corruption/gate trước mutation, không tự tạo cơ chế backup khác. Chưa sửa source do chỉ thị dừng khi điều kiện bắt buộc thiếu; ghi rõ việc này để phiên sau xử lý trước apply.

Trạng thái **Preflight BLOCKED; Backup NOT RUN; Migration NOT EXECUTED; 0 account/0 hàng thay đổi; integrity/FK PASS trước migration; DB/history/audit giữ nguyên; Backend tests/bootstrap/health/API NOT RUN; Web A/B/MFA/LDAP chưa nghiệm thu**. Chưa tạo backup nghiệp vụ/manifest mới; không có backup path/hash để báo. Không cần rollback hiện tại. Nếu lỗi sau migration tương lai: không restart/reapply/rollback tự động; giữ backup/marker, xác minh trạng thái trước phục hồi.

Đã cập nhật đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md. READY 18:14 vẫn được giữ làm lịch sử, không là trạng thái hiện hành. Không apply/ghi SQLite/seed/IAM/LDAP, không stop/start Codex/Docker/Backend, không commit/push/deploy. Lần tiếp theo tiếp tục trong quyền đã cấp nhưng chỉ apply khi đủ mọi điều kiện mới.

## 22. MIGRATION SUCCESS; bootstrap BLOCKED ngoài phạm vi — 12/11/2026, 18:37

**TRẠNG THÁI HIỆN HÀNH:** đã đồng bộ thành công năm tài khoản theo quyền người dùng, hậu kiểm PASS. Không còn chờ phép migration này; **không chạy lại apply/plan cũ**. Backend chưa khởi động vì bootstrap phát hiện hồ sơ `mfa-employee` ngoài phạm vi 5 account còn lệch ID. Các kết luận READY/BLOCKED trước đó là lịch sử.

Inventory Administrator mới `.runtime/writer-inventory/20261112T112755Z-16ea9e36.json` lúc 18:27:47: queries OK, RM đủ DB/WAL/SHM/seed, 0 file users. Metadata process chung/services/tasks/Docker mounts giữ nguyên so bản 18:10, các chức năng đã được operator xác minh. Python launcher tạm 58696 parent51912 đã kết thúc; Get-Process ngay trước preflight chỉ còn console đã xác định và Codex70024, không Node Backend/Python worker. Dùng bằng chứng Administrator mới người dùng yêu cầu rà soát, không giả vờ sandbox đã đọc được handles. Preflight live **18:32:53 PASS**: toàn plan khớp, admin01 đúng/5 mapping, DB/seed/hash/FK/integrity/no marker đạt; backup probe PASS, free59.173.855.232 byte. Artifact `.runtime/migration-runs/20261112T113210Z/preflight.json`.

**Source mới:** thêm hash byte/manifest exclusive+fsync và verify manifest trước CREATE ledger/UPDATE đầu tiên trong `scripts/reconcile_staff_ids.py`, giữ nguyên SQLite backup API nhất quán (gồm committed WAL), logical state check, transaction, token refresh, recovery, JWT/RBAC. Manifest liệt kê absolute path/sizeBytes/sha256 cho attendance.sqlite, staff.json, plan.json; verifier dùng fixed paths, đọc lại hash/kích thước/tập file và kiểm tra plan/seed/SQLite semantic state/integrity/FK. CLI in manifest path/hash. **33/33 test reconciliation PASS**, 8 test mới chặn trước mọi SQL nghiệp vụ khi manifest thiếu/hỏng/lỗi ghi/path/size/hash sai/file backup bị sửa, kiểm tra snapshot dù hash tự khớp và committed WAL; 25 test cũ gồm rollback/recovery/sáu account Backend JWT vẫn đạt.

**Đã chạy apply đúng một lần, exit0, lúc 18:33:56** với phase1-20261112T062520Z.json. Backup thật `.local/staff-id-backups/20261112T113356Z-be31a903/`, trước mutation được verify, gồm attendance.sqlite/staff.json/plan.json/manifest.json. Manifest SHA256 `f4336b9eeb7b9dea1e356f3a0f4e7bb937eca04a1d06ba7d1f28ddb9343e1774`; SQLite backup SHA256 `8278409b4a1ac585286e81f50d99d1d6b21971bce9e339682ed68a4638cc52ce`. Mọi hash/size/path trong manifest và đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md. Không ghi đè/xóa backup cũ.

**Hậu kiểm độc lập 18:35:09 PASS** (`postcheck.json`): so từng hàng mọi bảng với backup, đúng 41 hàng nghiệp vụ (staff5/attendance10/corrections10/notifications16), thêm đúng5 ledger old/new/username/role/batch; mọi bảng cũ giữ số hàng, 25 staff không trùng/thiếu. Seed chỉ5ID đổi, admin01 giữ nguyên toàn hồ sơ, toàn bộ history/audit nguyên trạng. Integrity/FK PASS, no marker; gọi lại Keycloak xác minh cả6 demo đúng ID/role/local, remainingChanges=0. Không thay Keycloak/LDAP/users/password/role/MFA. Hash DB hậu kiểm `aae7bd48664a928d74f8a7ad17e1a7c9f945e0fc1e84bcb8bb39e08c02d2a109`, seed `da2c4df6dae31e48663cca7d1a80de8bdfda0dd8fff204730d9ee576e9933ffa`; kiểm tra cuối18:37 sau tests/bootstrap vẫn nguyên, Git index nguyên.

**Backend isolated tests 203/203 PASS**, 9 file, preloader+environment lọc và fixture riêng, log `.runtime/migration-runs/20261112T113210Z/backend-tests.log`. Không coi fixture là nghiệm thu live.

**Bootstrap thật BLOCKED:** `node backend/server.js --check-bootstrap` exit1 `BOOTSTRAP_KEYCLOAK_ID_MISMATCH`. Chẩn đoán chỉ đọc bằng service client Backend xác định mismatch đầu tiên `mfa-employee`: username khớp, remote tồn tại/local, UUID khác. Có8local active, kiểm tra4 đến lỗi đầu tiên; chưa kết luận mọi hồ sơ ngoài demo đã được rà soát. Hồ sơ mfa-employee bằng nguyên bản backup trước migration; lỗi ngoài phạm vi được duyệt, không phát sinh từ thay đổi5account. Không sửa tài khoản này, không khởi động Backend, không reapply/rollback/bypass. Health/liveAPI/Web A/B/MFA/LDAP **NOT RUN**. Artifacts `bootstrap.json`, `bootstrap-diagnosis.json`, tổng hợp `result.json` trong cùng migration-run folder.

**Tiếp theo:** cần rà soát/phê duyệt riêng sửa hồ sơ ngoài demo (bắt đầu mfa-employee), không mở rộng plan5account. Sau khi bootstrap đạt mới startup/health/API live và nghiệm thu6login/Web A/B/MFA/LDAP với người vận hành, không lộ password/token/OTP. Không cần rollback migration đã PASS; giữ backup/manifest, nếu cần phục hồi phải kiểm tra writer/trạng thái/giao dịch mới và duyệt kế hoạch riêng. Hiện không có marker nên không dùng recover để chữa bootstrap.

Đã cập nhật docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md bằng kết quả thực tế. Không reset/xóa DB/volumes/LDAP, không dừng Codex/Docker, không start Backend/Web, không commit/push/deploy. Dữ liệu thật chỉ thay trong plan đã được phép.

## 23. Đối soát chỉ đọc ngoài sáu demo — 12/11, 18:43–18:46; chưa được phép sửa thêm

Người dùng yêu cầu **chỉ đọc** mfa-employee, tìm các mismatch khác, nguồn tạo/quan hệ/audit và đề xuất; không migration lại5account/rollback/startBackend hoặc sửa UUID/IAM/LDAP. Đã hoàn tất lookup toàn bộ **25 hồ sơ staff** bằng GET Keycloak + SQLite mode=ro/query_only, không lỗi lookup. Phạm vi này không phải quét toàn bộ realm không có local profile.

**Kết quả:** 6 demo có ID/role khớp; **2 MFA local active lệch UUID** (mfa-employee và mfa-auditor); **4 LDAP local active lệch UUID**, remote đều disabled và không có application role; **13 hồ sơ disabled ở local không còn tìm thấy username/ID cũ ở remote** (12 local QA/UIops và 1 LDAP QA). Không có kết quả username trùng. Bootstrap xét 8 local active nên bị chặn bởi 2 MFA; LDAP/disabled không nằm trong filter. Không bỏ guard hoặc fallback theo username.

MFA employee local `431df574-7925-469e-92f1-1377853a78b2` → remote `fa4c264c-794b-4440-bbb1-b4f505e39622`; MFA auditor local `7c795907-4fc0-440f-885e-fe61c25a1ca1` → remote `a0baf693-07f0-418e-ba1f-177892305e87`. Cả hai có username/role đúng, local active, remote enabled, nguồn local, ID cũ trả 404, target không trùng hồ sơ khác. Local mfa_required=1, remote attribute=true, còn yêu cầu CONFIGURE_TOTP/totp=false theo API. Không đọc credential. Hai user không có trong staff.json; seed vẫn đúng sáu demo.

**Nguồn gốc có bằng chứng:** setup_week5.py khai báo hai demo, tạo user và ghi trực tiếp SQLite (team “Kiểm thử MFA”), không ghi seed. applied-week5 và audit xác nhận ID cũ CREATE ngày 07/11 lúc 09:07:56 Việt Nam, cấu hình lại ngày 08/11 lúc 09:35:14; snapshot 08/11 có ID cũ khớp SQLite. Audit outbox và createdTimestamp remote xác nhận ID mới CREATE ngày 11/11 lúc 19:43:56–57. Chưa biết thao tác xóa/recreate cụ thể, người thực hiện hoặc lần setup 11/11 đã đến SQLite hay dừng trước đó; bốn backup 11/11 PermissionError. Code setup dùng INSERT OR IGNORE theo ID mới trong khi username UNIQUE, rồi UPDATE theo ID mới: có thể giữ mismatch mà không báo lỗi khi username đã có ID cũ. Không chạy setup để sửa.

**Dữ liệu hai MFA:** mỗi user có 1 staff; không thấy attendance/corrections/notifications/notification_reads/access_requests/lifecycle/directory_maintenance/events/identity_events/actions/alerts/ledger hoặc lịch sử khác khi quét mọi cột theo ID cũ/ID mới/username. Mỗi user có 10 audit_outbox (6 ID cũ, 4 ID mới): tổng 20, gồm 12 delivered và 8 pending theo local. Không sửa payload/lịch sử/delivery. Toàn DB có 12 FK, 6 FK trực tiếp đến staff. Đề xuất nếu được duyệt: migration riêng hai MFA local, dự kiến đổi 2 staff và thêm 2 ledger, không đổi staff.json, giữ nguyên 20 audit; bảo toàn MFA/revocation và mọi dữ liệu khác, dùng backup manifest/gates/rollback/hậu kiểm đã được thử nghiệm. Script năm demo cố định sáu seed; không chạy lại hoặc chỉ nới allowlist một cách đơn giản. Chưa tạo migration mới, chưa sửa code.

LDAP lệch gồm ldap-employee01, ldap-employee02, ldap-manager01, ldap-auditor01: cần kế hoạch đối soát provider/identifier LDAP/group/role/status riêng, không ghép theo username hay rekey chung với MFA. Không tự restore hoặc enable 13 hồ sơ disabled/missing. Migration hai MFA nếu được duyệt có thể giải quyết chặn bootstrap local, chưa đồng nghĩa LDAP/MFA/SSO thật đã đạt.

Tài liệu chi tiết mới `docs/DOI_SOAT_TAI_KHOAN_MFA_CHI_DOC.md`; artifacts `.runtime/account-diagnostics/mfa-readonly-20261112T114355Z/{report.json,mfa-audit-timeline.json,summary.json}`. Integrity/FK PASS, DB/seed bằng hash hậu kiểm migration năm tài khoản đã thành công, Git index nguyên trạng. PostgreSQL Audit/LDAP server chưa được đọc trực tiếp. Không sửa dữ liệu thật/source, không chạy test/Backend/apply/recover/reset. **Chờ người dùng duyệt phạm vi hai MFA hoặc phương án khác trước khi sửa.**

## 24. Chuẩn bị migration riêng hai MFA PASS; CHƯA apply — 12/11, 19:13

Người dùng đã chọn xử lý riêng hai MFA, cho phép **plan, mã nguồn và diễn tập trên bản sao**, yêu cầu chờ xác nhận riêng trước thay đổi dữ liệu thật. Quyền migration năm demo không mở rộng sang MFA; migration năm demo vẫn SUCCESS, không chạy lại hoặc rollback. Không chạy setup_week5, không đổi LDAP/13 hồ sơ disabled/Keycloak/MFA, không start Backend.

Mã mới `scripts/reconcile_mfa_ids.py`: dry-run mặc định, allowlist đúng mfa-employee và mfa-auditor; tái sử dụng transport chỉ đọc/token refresh và cơ chế SQLite backup API/manifest SHA-256 đã kiểm thử của script cũ. Không sửa script migration năm demo. Xác minh cả sáu demo đã khớp, năm ledger cũ nguyên trạng; hai MFA duy nhất/local/active/enabled/đúng role, old ID remote không còn/target không trùng, mfa_required/remote attribute/CONFIGURE_TOTP hoặc enrollment hợp lệ. Plan cố định remote guards, hash toàn DB/seed, audit và ledger. Nếu có thêm quan hệ nghiệp vụ ngoài hai staff hoặc chỉ một MFA được chuyển thì dừng, không tự nới phạm vi.

**Plan thật chỉ đọc:** `.local/mfa-staff-id-plans/mfa-20261112T120146Z.json`, SHA-256 `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd`. Mapping giữ đúng mục 23. Dự kiến **2 UPDATE staff.id + 2 INSERT staff_id_reconciliations**, 0 seed write/0 audit write; năm ledger cũ và mọi bảng khác nguyên trạng. Giữ đủ 20 audit_outbox (12 delivered, 8 pending), không đổi payload/trạng thái/lịch sử. Quét cả ID cũ và mới, kiểm tra 12 FK. Sáu demo/LDAP/disabled và dữ liệu nghiệp vụ khác được so nguyên từng hàng trong hậu kiểm.

**Kiểm thử PASS:** 24 bài riêng biệt trong `tests/test_mfa_id_reconciliation.py` (23/23 lượt đầu + bài marker dang dở bổ sung chạy riêng 1/1). Fixture `mfa-staff-id-fixture.cjs`; JWT/Backend `mfa-id-backend.cjs` xác minh tám local active được nhận diện sau migration, ID cũ vẫn UNREGISTERED và các chặn MFA/required action/role/session không bị bỏ qua. `scripts/rehearse_mfa_ids.py` chỉ ghi bản sao mới trong `.runtime/mfa-rehearsals`; **8/8 tình huống PASS**, gồm backup/manifest/hậu kiểm/stale plan thất bại, process crash thực trước/sau commit và từ chối recovery nếu có ghi mới. Báo cáo `.runtime/mfa-rehearsals/20261112T120551Z-40200e7b/rehearsal-report.json`. Bootstrap bản sao qua `mfa-bootstrap-copy.cjs`: trước mismatch đúng dự kiến; sau PASS tám local active với IAM giả lập. Đây không phải nghiệm thu OTP/SSO/LDAP thật.

**Kiểm tra live cuối 19:13:20 PASS về dữ liệu:** `.runtime/mfa-preparation/20261112T121320Z/readiness.json`. Toàn plan bằng Keycloak/SQLite hiện tại, seed/DB hash vẫn bằng hậu kiểm năm demo; integrity/FK PASS, không marker; Git index không đổi. Backup demo cũ được verify lại, manifest vẫn `f4336b9eeb7b9dea1e356f3a0f4e7bb937eca04a1d06ba7d1f28ddb9343e1774`. Probe ghi/fsync/rename/đọc/dọn file tổng hợp ở backup root MFA PASS, free 59.090.182.144 byte. Không tạo backup migration MFA thật, không sửa SQLite/seed/IAM/LDAP thật.

**Chưa READY FOR APPLY:** inventory mới `.runtime/writer-inventory/20261112T120934Z-88a36ba8.json` checkedAt 19:09:30 là BLOCKED_INVENTORY: CIM process/service/task PermissionDenied, Restart Manager startCode29 không đọc được handles, Docker query thất bại. Cổng 3001/5173/5174 đóng không chứng minh hết writer. Cần inventory Administrator mới bằng `python -B scripts/inspect_sqlite_writers.py` ngay trước apply tương lai và đối chiếu toàn plan lại; không lấy report lịch sử năm demo làm thay thế. Người dùng chưa cấp quyền apply MFA.

Backup tương lai riêng `.local/mfa-staff-id-backups/<UTC>-mfa-<uuid>/`: SQLite snapshot nhất quán, seed, plan, manifest absolute path/sizeBytes/SHA-256 được đọc lại xác minh trước UPDATE dưới BEGIN IMMEDIATE. Seed không ghi. Trước commit lỗi rollback transaction; sau crash recovery MFA chỉ xác minh trạng thái trước/sau và xóa marker nếu đủ điều kiện, không tự restore dữ liệu. Shared startup marker `staff.json.reconcile-pending.json` có kind riêng; không chạy recover của script năm demo cho marker MFA. Nếu marker hỏng hoặc có ghi tiếp, giữ blocker và lập phương án phục hồi riêng, không reapply/rollback tự động.

Chi tiết, lệnh apply **chưa chạy**, rủi ro và điều kiện xác nhận tại `docs/KE_HOACH_DONG_BO_ID_MFA.md`; đầu `docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md` đã cập nhật. Bước tiếp theo: người dùng xem plan, cung cấp inventory Administrator mới và xác nhận riêng; chỉ khi đủ preflight/backup mới apply hai MFA rồi hậu kiểm, bootstrap, nghiệm thu Web A/B/MFA. LDAP còn bốn hồ sơ lệch cần xử lý riêng, không mở rộng migration này. Giữ nguyên mọi backup, không commit/push/deploy.

## 25. Kiểm kê MFA mới chưa đủ quyền — 12/11, 19:19; BLOCKED, chưa apply

Đã đọc toàn bộ report mới nhất người dùng cung cấp `.runtime/writer-inventory/20261112T121836Z-f0c4ef74.json`, checkedAt **19:18:28**. Tuy người dùng cho biết chạy Administrator, report thực tế ghi **administrator=false** (script kiểm tra IsUserAnAdmin trong tiến trình Python). Không suy nguyên nhân hoặc tự kết luận có quyền từ tên cửa sổ. `queryComplete=true`/REVIEW_REQUIRED chỉ nghĩa các truy vấn không lỗi, không chứng minh đủ quyền/phạm vi.

**Các bằng chứng đạt:** Restart Manager Start/Register/List đều 0; đủ attendance.sqlite/WAL/SHM/staff.json, 0 process dùng file tại thời điểm report. Ba container/mounts giống report elevated 18:27: không mount dữ liệu Backend; bind directory/.local chỉ đọc, volumes LDAP/Postgres riêng. Service ứng viên WSLService và tám task ứng viên giữ nguyên, Hotpatch đã được operator kiểm tra. Cổng 3001/5173/5174 đóng. PID70024 cùng parent/start như Codex đã xác minh; không coi là Backend, không dừng. PythonManager launcher15188 mới tại thời điểm inventory, parent61524, đã kết thúc khi Get-Process kiểm tra tiếp; không còn worker này.

**Điểm chặn thực sự:** chỉ liệt kê 226 Scheduled Task so với 299 trong report elevated 18:27 (report cũ administrator=true); executable/entrypoint của Codex70024 và metadata một số process bị null trong report mới. Dù candidate services/tasks/mounts giống, chưa chứng minh phần task không nhìn thấy và process thiếu metadata an toàn. Không báo READY hoặc lấy inventory cũ thay kiểm kê mới. Cần xác minh quyền của chính PowerShell và Python rồi chạy lại inventory bằng quyền Administrator, xem hướng dẫn đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md.

**Kiểm tra local chỉ đọc 19:19:47 PASS:** plan SHA không đổi, logical SQLite/seed hash khớp plan, integrity/FK PASS, không marker; backup/manifest migration năm demo xác minh lại đạt. Do inventory chưa PASS, **chưa gọi lại Keycloak/chưa chạy probe backup mới**; kết quả live IAM và probe 19:13 là lịch sử, không gắn nhãn mới. Báo cáo `.runtime/mfa-readiness/20261112T121947Z/inventory-review.json`. Không chạy test lại vì không đổi source; kết quả 24 bài và 8 diễn tập giữ là bằng chứng lượt trước.

Không apply/recover/rollback, không thay SQLite/seed/IAM/LDAP, không khởi động/dừng tiến trình, không reset. Sau report đủ quyền: kiểm kê, revalidate live plan/IAM/dữ liệu/backup; chỉ khi đủ mới READY FOR APPLY rồi chờ xác nhận cuối của người dùng.

## 26. READY FOR APPLY cho hai MFA — 12/11, 19:33; chờ xác nhận cuối

**Trạng thái hiện hành: READY FOR APPLY; CHƯA APPLY MFA.** Người dùng chỉ yêu cầu kiểm tra lại, chạy test và chờ xác nhận trước migration thật. Blocker thiếu quyền ở mục 25 đã giải quyết, không tiếp tục coi là còn hiệu lực. Migration năm demo vẫn SUCCESS, không chạy lại/rollback; Backend chưa khởi động.

Đã đọc toàn bộ inventory mới `.runtime/writer-inventory/20261112T122906Z-14aac35f.json` checkedAt **19:29:00**: administrator=true/queryComplete=true, process317/service323/task299 đều OK. Restart Manager Start/Register/List=0, đủ attendance.sqlite/WAL/SHM/staff.json, **0 process dùng file**. Các service/task ứng viên và ba container/mounts giữ nguyên so report elevated trước: bind directory/.local read-only, volumes LDAP/Postgres riêng, không mount dữ liệu Backend. Các process chung cùng PID/parent/start/entrypoint/flags; Node70024 được nhận diện trực tiếp Codex. Hai process mới: PS48700 là console Administrator của đợt kiểm kê (parent của launcher), PythonManager42012 đã kết thúc khi kiểm tra tiếp. Get-Process cuối sau test chỉ còn Codex và các console đã phân loại, không Python worker/Node Backend. PS3824 xuất hiện trong lúc đọc song song là shell kiểm tra tạm của agent, đã kết thúc. Không stop Codex/Docker/console, không lấy query thất bại trong sandbox làm bằng chứng handles; dùng report Administrator mới người dùng cung cấp.

**Preflight live 19:31:57 PASS:** toàn plan MFA hiện tại bằng plan đã duyệt xem, SHA `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd`; đúng hai mapping ở mục 23, sáu demo và năm ledger vẫn đúng. MFA local active/remote enabled/local/role khớp, mfa_required=1/attribute=true, totp=false/CONFIGURE_TOTP không đổi, old remote IDs không tồn tại/target không trùng. Quét toàn schema/quan hệ cả ID cũ và mới, integrity/FK PASS 12 FK; 20 outbox nguyên trạng (12 delivered/8 pending), không marker. Dự kiến vẫn 2 staff UPDATE + 2 ledger INSERT, seed/audit 0 write. Đối chiếu DB/seed/plan/index/source cuối **19:32:18** nguyên trạng; cổng Backend/Web đóng cả IPv4/IPv6.

**Backup và test PASS:** backup demo `.local/staff-id-backups/20261112T113356Z-be31a903/` được verify lại đầy đủ manifest/hash/SQLite, manifest SHA không đổi. Probe file tổng hợp dưới `.local/mfa-staff-id-backups` ghi/fsync/rename/đọc/dọn PASS; còn 59.090.096.128 byte. Chưa tạo backup MFA thật; apply được duyệt phải tạo snapshot mới nhất quán và verify manifest trước UPDATE đầu tiên. Đã chạy mới **24/24 test MFA PASS trong 13,734 giây** trên fixture cô lập, gồm rollback/manifest/recovery và JWT/MFA guards. Tám diễn tập bản sao trước đó được đọc kiểm tra PASS, không chạy lại. Không gọi apply/recover trên dữ liệu vận hành; không đổi source vì các kiểm tra đạt.

Bằng chứng `.runtime/mfa-readiness/20261112T123109Z/{readiness.json,preflight.json,mfa-tests.log}`; readiness ghi nguồn/thời điểm inventory/live IAM/local checks, hash mã nguồn/test và trạng thái READY FOR APPLY. Đã cập nhật đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md và docs/KE_HOACH_DONG_BO_ID_MFA.md. Không sửa SQLite/staff.json/LDAP/audit/MFA/Keycloak, không reset/start Backend, không commit/push/deploy.

**Tiếp theo:** chờ xác nhận cuối rõ ràng cho đúng hai MFA; giữ writer dừng, revalidate plan/dữ liệu/IAM trước apply, kiểm tra phần môi trường đã thay đổi nếu có. Dùng script MFA với plan hiện có, backup mới verify trước ghi, rồi hậu kiểm độc lập tất cả dữ liệu/ledger/audit/sáu demo/tám local active; không mở rộng LDAP/disabled hoặc tự bỏ bootstrap guard. READY không phải quyền tự migration và không chứng minh môi trường sẽ mãi không có writer.

## 27. Đã được phép migration MFA; preflight writer BLOCKED — 12/11, 19:50

**Người dùng cấp quyền rõ ràng apply đúng mfa-employee và mfa-auditor theo plan mfa-20261112T120146Z.json**, backup/manifest verify trước UPDATE và hậu kiểm độc lập tám active. Sau thành công chỉ bootstrap không server; chưa start Backend/Web. Quyền này còn hiệu lực, không yêu cầu xác nhận lại chỉ vì cần inventory mới. Không mở rộng LDAP/audit/MFA/năm demo, không setup_week5/reset/stop Codex/Docker.

Lượt mới bắt đầu 19:50:21; inventory elevated 19:29 đã cách khoảng 21 phút. Get-Process hiện chỉ có Codex70024 và các console đã phân loại, không Python/Node Backend, nhưng không chứng minh service/task/mounts/handles liên tục trong khoảng trống. Đã thử kiểm kê chỉ đọc mới `.runtime/writer-inventory/20261112T125035Z-db22ba51.json` checkedAt19:50:30: administrator=false, CIM process/service/task PermissionDenied, RM start29 không đọc được file users, Docker query failed; cổng3001/5173/5174 đóng. Theo yêu cầu người dùng phải dừng khi không xác minh đủ writer; không lấy report cũ hoặc mảng processes rỗng của query lỗi làm bằng chứng không writer.

**BLOCKED, migration NOT EXECUTED, 0 hàng thay đổi, backup MFA NOT CREATED, bootstrap NOT RUN.** Hash plan và source/test vẫn đúng bản24/24 đã kiểm thử. Chưa gọi lại Keycloak/SQLite sau gate inventory thất bại; không gắn kết quả live trước thành kết quả hiện tại. Báo cáo lượt này dưới `.runtime/mfa-migration-runs/` (result.json), cập nhật đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md. Không sửa dữ liệu thật hoặc source, không chạy test lại do code không đổi.

Yêu cầu tiếp theo duy nhất: báo cáo mới từ `python -B scripts/inspect_sqlite_writers.py` trong PowerShell Administrator/Python administrator=True và giữ writer dừng. Khi nhận report mới, xử lý nhanh trong quyền đã cấp: inventory, live plan/IAM/DB/marker/integrity/FK, backup/manifest, apply một lần, hậu kiểm độc lập so backup và bootstrap không start server. Không xin lại phép apply nếu mọi điều kiện đạt; nếu writer hoặc dữ liệu thay đổi bất thường thì dừng báo rõ.

## 28. MIGRATION HAI MFA SUCCESS; hậu kiểm và bootstrap PASS — 12/11, 20:02

**Trạng thái hiện hành: migration hai MFA đã SUCCESS, không còn chờ quyền/apply. Không chạy lại migration hai MFA hoặc năm demo, không rollback.** Người dùng cung cấp inventory mới và yêu cầu tiếp tục trong quyền đã cấp; đã hoàn tất đúng phạm vi hai local MFA, backup/hậu kiểm và bootstrap check-only. **Chưa khởi động Backend/Web A/Web B.**

Inventory Administrator `.runtime/writer-inventory/20261112T125703Z-e3a4967a.json` checkedAt19:56:56: administrator=true/queryComplete=true, 310 process/323 service/299 task, RM0/0/0 đủ DB/WAL/SHM/staff.json, 0 file user. Mọi metadata ứng viên chung/service/task/Docker mounts giữ nguyên so report elevated đã duyệt; launcher49252 parentPS48700 đã kết thúc. Get-Process ngay trước apply chỉ Codex70024 và console đã xác định, không writer mới. Preflight19:58:57 PASS liveIAM/plan/schema/integrity/FK/seed/ledger/audit/no marker/backup probe/free space, mã/test hash bằng bản24/24. Dùng report Admin mới và kiểm tra tiếp theo, không giả vờ sandbox đọc được handles.

**Apply thật đúng một lần** bằng `python -B scripts/reconcile_mfa_ids.py --apply --backend-stopped --plan .local/mfa-staff-id-plans/mfa-20261112T120146Z.json` (xem apply-intent.json và preflight.json). CLI exit 0 lúc 20:00:20. Backup được tạo và xác minh trước UPDATE trong transaction, sau đó cập nhật đúng 2 staff.id và thêm đúng 2 ledger; marker được xóa sau commit. Không dùng script năm demo để apply/recover, không chạy setup_week5, không ghi Keycloak/LDAP, không reset hoặc dừng Codex/Docker.

Backup thật `.local/mfa-staff-id-backups/20261112T130017Z-mfa-5101bc0d/`: attendance.sqlite 3.489.792 byte, SHA-256 `59d0145f27bbfcc7195c4fef47fe60b3fd507a1480c3c92548badb76ad3896ec`; staff.json 996 byte, SHA-256 `da2c4df6dae31e48663cca7d1a80de8bdfda0dd8fff204730d9ee576e9933ffa`; plan.json 4.735 byte, SHA-256 `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd`. Manifest gồm đường dẫn tuyệt đối/kích thước/SHA được đọc lại, kiểm tra cả tính toàn vẹn và trạng thái SQLite backup; manifest SHA-256 **`3b13a1590092dc379c306f8c6683f00fa82075d51412095dcf1e4f056570d3e1`**. Backup demo trước giữ nguyên, không ghi đè hoặc xóa.

**Hậu kiểm độc lập 20:01:38 PASS**: đọc backup và DB hiện tại mode=ro; so từng bảng với phép đổi đúng hai staff ID, mọi schema/bảng khác nguyên trạng; năm ledger cũ nguyên từng trường, hai ledger mới đúng username/role/old/new/batch/reason. Staff 25→25, ledger 5→7, không trùng hoặc thiếu hồ sơ; seed nguyên byte và đúng sáu demo. Toàn history/audit và đúng 20 outbox liên quan giữ nguyên (12 delivered/8 pending); admin01/sáu demo/LDAP/13 hồ sơ disabled không đổi. Integrity/FK PASS, không marker. GET Keycloak thật xác nhận cả 8 local active khớp UUID/role, MFA guards không đổi, remainingMfaChanges=0. DB logical hash mới `610a2706635213248304cad9bb31a821cc2d31705533210f78ceeb64564f41a0`, Git index và source hashes nguyên trạng.

**Bootstrap thật PASS 20:02:07:** `node backend/server.js --check-bootstrap`, dùng Backend service credential và Keycloak thật, exit 0; nhánh checkOnly return trước openVerifiedStore/listen/worker. Đã kiểm tra sau chạy DB/seed hash nguyên trạng, integrity/FK PASS, cổng 3001/5173/5174 đóng IPv4/IPv6. Không mở server/worker. Test 24/24 lượt 19:32 và 8 diễn tập bản sao là bằng chứng đã có, mã kiểm thử không đổi; không chạy lại tests sau migration vì chỉ cần bootstrap theo yêu cầu.

Bằng chứng đầy đủ `.runtime/mfa-migration-runs/20261112T125808Z/`: preflight.json, apply-intent.json, apply-result.json/apply.log, postcheck-local.json, postcheck.json, bootstrap.json/bootstrap.log, result.json (SUCCESS). Đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md và docs/KE_HOACH_DONG_BO_ID_MFA.md đã cập nhật kết quả, backup/hash và đánh dấu các blocker/lệnh apply phía dưới là lịch sử.

**Tiếp theo:** chờ chỉ thị khởi động Backend/Web và nghiệm thu health/API/SSO/login/MFA/LDAP. Tám local active đã qua đối soát và bootstrap, chưa đồng nghĩa OTP/SSO/LDAP thật đạt. Bốn LDAP mismatch và 13 hồ sơ disabled ngoài phạm vi giữ nguyên, cần kế hoạch riêng khi được yêu cầu. Không cần rollback; phục hồi tương lai phải đánh giá writer/dữ liệu mới/backup và có phương án được duyệt, không tự reapply/recover/restore khi không có marker. Không commit/push/deploy hoặc hiển thị secret.

## 29. Được phép khởi động/nghiệm thu; đang BLOCKED bởi sandbox và quyết định job LDAP — 12/11, 20:13

Người dùng đã yêu cầu khởi động Backend/Web và nghiệm thu health/JWT/SSO/MFA/LDAP/audit/nghiệp vụ; không chạy lại migration/setup/reset, không sửa LDAP/MFA hay mất dữ liệu. Đã đọc hướng dẫn hiện tại, source server/runner/store/auth/directory và env chỉ xuất trường công khai. Topology HTTP localhost, issuer canonical localhost:8080; cổng3001/5173/5174/8090 ban đầu đóng, Keycloak8080 trả HTTP tốt. Docker CLI/Compose có sẵn nhưng Engine query bị giới hạn quyền; **chưa xác minh được health container PostgreSQL/OpenLDAP hiện tại**. Audit service8090 không truy cập được, không tự tạo lại stack.

Phát hiện Backend mặc định tự queue LDAP sync mỗi300giây, có thể thay đổi hồ sơ local/đánh dấu missing/thu hồi phiên. Bốn LDAP chưa đồng bộ ngoài phạm vi, nên đã hỏi bằng request_user_input_async: có đồng ý khởi động nghiệm thu với job LDAP định kỳ tạm tắt runtime, không sửa .env/LDAP/JWT/RBAC/MFA? **Chưa có câu trả lời; Backend chưa start và chưa bổ sung flag vào source.** Đừng tự coi câu hỏi là đã được duyệt hoặc source đã có flag. Đây là quyết định thao tác, không phải xin quyền chạy migration đã xong.

Đã thử khởi động Web riêng bằng lệnh Vite của dự án (Start-Process hidden, logs riêng), PID59652/65316 đều thoát vì esbuild spawn EPERM. Chrome/Playwright cũng spawn EPERM. Node test runner ba file security/sso/week5-10 qua isolation preloader bị chặn spawn child trước test case; **kiểm thử mới BLOCKED, không PASS**. Không né sandbox hoặc sửa dependency/config để vượt chặn. Không dừng Codex/Docker. Có lệnh để operator chạy Web ngoài sandbox trong tài liệu mới.

Live GET và public OIDC PASS cấu hình: issuer đúng, RS256/JWKS RSA, code+PKCE S256; client public/enabled/standard flow, audience employee-api/security-api đúng; callback/origin localhost và127.0.0.1 có. Auth entry của cả hai client trả200/form login, **không gửi password hoặc hoàn tất login/SSO**. Inspect_phase6 dùng URL127.0.0.1 rồi kỳ vọng issuer127 nên cảnh báo false; kiểm tra canonicallocalhost khớp, không cần đổi issuer.

Tám local active vẫn ID/role/enabled đúng. Hai MFA bắt buộc nhưng totp=false/CONFIGURE_TOTP, cần operator đăng ký/nhập OTP ở bước được phép, không tự sửa credential/MFA. Provider LDAP enabled/READ_ONLY/NO_CACHE/LDAPS, nhưng bốn ldap-employee01/02, ldap-manager01, ldap-auditor01 vẫn lệch UUID, remote disabled và roles=[]; không sửa hoặc sync. Không suy LDAP kết nối tốt chỉ từ config.

Đọc DB integrity/FK PASS, 25staff/7ledger/10attendance/15corrections/2802events/254identity_events/3423audit_outbox, 401pending; không actions/directoryjobs/lifecycle pending/running. DB hash cuối bằng hậu kiểm MFA `610a2706635213248304cad9bb31a821cc2d31705533210f78ceeb64564f41a0`, **không có mutation nghiệp vụ trong lượt này**. Health/API live/authenticated/session/UI business chưa chạy; không đánh dấu nghiệm thu. Không sửa source/migration/LDAP/MFA/seed, không commit/push/deploy.

Báo cáo mới `docs/NGHIEM_THU_UNG_DUNG_SAU_MIGRATION.md`; artifacts `.runtime/application-acceptance/20261112T130848Z/{identity-readonly.json,oidc-entry.json,result.json,web-*.log,isolated-auth-tests.log}`. `.runtime/phase6-tests/environment.json` mới ghi metadata public; không chứa secret. Bước tiếp: nhận quyết định job LDAP, nhận docker ps/inspect metadata từ operator ngoài sandbox, chạy Web bằng npm run dev ngoài sandbox do EPERM; sau đó thực hiện nghiệm thu thực tế. Không yêu cầu lại quyền migration, không reset/setup để chữa lỗi môi trường.

## 30. Backend chạy với job LDAP định kỳ tắt; health/API âm tính PASS — 12/11, 20:25

Người dùng đã cho phép tạm tắt job LDAP bằng runtime, không sửa .env/dữ liệuLDAP, yêu cầu kiểm tra ghi startup rồi chạy Backend/API. **Quyết định đang chờ ở mục29 đã giải quyết, không hỏi lại.**

Đã thêm `backend/directory-schedule.js`, `backend/directory-schedule.test.js`, chỉnh có giới hạn `backend/server.js` giữ thay đổi có sẵn. Biến `DIRECTORY_SYNC_ENABLED` default/true bật, false không tạo timer, giá trị khác fail trước mở DB; giữ directory config và mọi auth checks. Ba test chạy trực tiếp `node backend/directory-schedule.test.js` PASS, `node --check backend/server.js` PASS. Chỉ job định kỳ tắt; manual sync và refresh LDAP theo request vẫn hoạt động như trước, không gọi chúng khi nghiệm thu local.

Startup preflight chỉ đọc PASS: không pending actions/directory jobs, incident migration v1/audit projection v2/trigger/metadata đã có, backfill0, retention disabled. Không chạy script migration hoặc setup. Khởi động Backend bằng Start-Process hidden từ backend, `DIRECTORY_SYNC_ENABLED=false` chỉ truyền cho child; khôi phục biến shell sau launch, không sửa .env. **PID30876**, start20:21:52, cổng3001; log xác minh `Periodic LDAP sync: disabled (runtime)`. Không stop Codex/Docker. Collector/audit delivery vẫn hoạt động theo server hiện có.

Live health200OK và ready200ready; profile thiếu token401MISSING_TOKEN, token sai401INVALID_TOKEN, security thiếu token401, origin trái phép403ORIGIN_DENIED. Chưa có token user thật nên RBAC có xác thực/SSO chưa nghiệm thu. Thử HTTP code+PKCE đúng một lần cho employee01 bằng credential đọc nội bộ từ.env, không in/lưu password/token; flow không hoàn tất, không retry. Collector xác nhận sự kiện LOGIN_ERROR **cookie_not_found** lúc13:24:01Z, không phải chứng minh password sai. Các error invalid_user_credentials ngày11/11 đọc được là lịch sử. Cần browser/Web ngoài sandbox, không reset password/account.

Hậu kiểm20:25:33: staff/7ledger/chấm công/đơn/directory jobs/maintenance/actions/lifecycle/access nguyên từng hàng; lịch sử events/identity_events/alert_history cũ bảo toàn; audit outbox cũ giữseq/payload, tổng3423→3428, pending406. Thêm4API audit events và1identity event, giám sát tạo3alerts/evidence/notifications từ probe; không xóa dữ liệu. .env cả4file và seed hash không đổi, integrity/FK PASS. Job LDAP lịch sử không thêm hoặc sửa. Không sửaLDAP/MFA, không reapply migration hoặc xóaoutbox.

Artifacts `.runtime/backend-acceptance/20261112T132126Z/`: startup-preflight.json, process.json, backend.log/backend-error.log, live-api-oidc.json, login-diagnosis.json, startup-postcheck.json. Cập nhật docs/HUONG_DAN_KHOI_DONG.md hướng dẫn biến runtime, docs/NGHIEM_THU_UNG_DUNG_SAU_MIGRATION.md có trạng thái mới ở đầu. Không commit/push/deploy.

**Tiếp theo:** giữ Backend chạy runtimefalse, operator chạy Web A/B bằng npm.cmd run dev ngoài sandbox vì esbuild/Chrome spawnEPERM, gửi Docker ps/health để kiểm tra audit8090 và PostgreSQL/OpenLDAP; nghiệm thu browserlogin/SSO/RBAC có token thật và TOTP do operator. Không tự bật lại periodic LDAP hoặc sửa bốnLDAP lệch. Health ready chỉ kiểm tra SQLite/Keycloak, không bao gồm audit-service. Không coi Backend chạy/negativeAPI PASS là toàn bộ hệ thống đạt.

## 31. LDAP 0 hồ sơ / 4 errors: xác định xung đột UUID/provider, thêm log an toàn — 18/11/2026

Người dùng báo LDAPS bind/sync thành công, 4 user enabled/đúng nhóm nhưng Web B federation vẫn 0 hồ sơ/4 errors. Cho phép điều tra, backup/sửa source tối thiểu và test; **không đổi UUID, không ghi dữ liệu thật, không sync thủ công hoặc restart khi chưa xin phép**. Không dùng quyền startup/migration của các lượt trước để vượt ràng buộc mới. Không setup_week3/5/6/reset/commit/push.

**Nguyên nhân live được xác minh lúc 17:24:23:** service account attendance-control GET đầy đủ provider/users/user/groups/direct roles/group composite roles đều HTTP200, scan 4 user complete. Provider hiện tại `mx-hhFo8RfSgcLu5PVZZug` enabled/READ_ONLY/NO_CACHE; 4 user enabled, đúng nhóm kế thừa role, direct business roles rỗng, team/name hợp lệ, MFA=true, sourceStatus=active. Không còn vấn đề disabled/role rỗng của ngày12/11. Service quyền đọc đủ, không bằng chứng cần sửa mapper/role/realm.

SQLite vẫn có bốn username dưới ID cũ và provider `a0BjJX1uTFm2QLpz3xdIxg`; mapping old→new giữ như báo cáo LDAP trước. apply() ném DIRECTORY_CONFLICT khi username trùng ID khác **trước mutation**, catch từng user chỉ errors++ nên che nguyên nhân. API/Web B lọc theo provider mới nên tổng0, không phải mất hồ sơ. Các job gần nhất remote.updated4/failed0/complete=true nhưng local.imported0/updated0/errors4/partial. Không sửa guard hoặc tự ghép LDAP theo username.

Đã sao lưu directory.js và PROJECT_CONTEXT.md vào `.local/source-backups/ldap-sync-20261118T102516Z/` cùng manifest hash; giữ nguyên backup người dùng `backend/directory.js.before-error-log` (cùng SHA trước sửa `2496d924a617935b9d6a7c800e95a4f44fc8e8a9461f4f98bcdafc7953a0c021`). Source chỉ đổi `backend/directory.js`: reason allowlist USERNAME_COLLISION tại guard cũ, log vào catch quanh apply(u.id,true) của listed.users. Giữ catch revoke riêng; log event/jobId/userRef SHA-256 rút gọn/code/reason/status, không message/stack/response/username/profile/token/secret. Log sink lỗi không abort batch. Không sửa keycloak-admin.js/directory-schedule.js hoặc bất kỳ UUID/provider thật.

Thêm `backend/directory-errors.test.js` với8 test in-memory/synthetic; tái hiện chính xác4collision→0profile/4errors và bảo toàn history/outbox; case không collision import4 PASS; có test tiếp tục batch, DB/remote read errors, redaction, logger lỗi, revoke catch và adapter GET. Syntax/diff checks PASS. **115/115 test PASS** (8 mới +3 schedule +33 week5-10 +19 SSO +52 security) qua isolation preloader, không dùng DB thật làm fixture. Bằng chứng `.runtime/ldap-diagnostics/20261118T102423Z/{service-readonly.json,local-relations.json,tests.json,*.test.js.log}`.

DB readOnly/query_only integrity/FK PASS, UNIQUE username/id,6FK trực tiếp tới staff. ID cũ employee01 còn56events/5alerts/7notifications/16identity_events/78outbox payload refs; auditor01 còn14events/1alert/1notification/3identity_events/17outbox refs; employee02/manager01 mỗi người1notification. Giữ cả hồ sơ LDAP QA disabled thứ năm. Không được xóa/tạo lại/đổiUUID để thử; lịch sử cần được bảo toàn khi có phương án xử lý được duyệt.

Tài liệu `docs/DIEU_TRA_LDAP_4_ERRORS.md` có mapping/provider, nguyên nhân, backup và kết quả. **Hoàn tất chẩn đoán/log/test; sync thật chưa sửa xung đột dữ liệu.** Không restart hoặc sync thật; log source mới chưa nạp vào process đang chạy. Lượt điều tra chỉ OAuth lấy service token và GET Admin API, không POST user-storage sync/logout; SQLite chỉ đọc. Các job định kỳ đã tồn tại có thể tiếp tục do cấu hình vận hành, không do agent kích hoạt.

Tiếp theo cần đối soát danh tính LDAP gốc/entryUUID/provider lịch sử và phương án dữ liệu riêng trong phạm vi được duyệt; không áp dụng migration local demo/MFA cho LDAP. Cấp thêm quyền, chỉ đổi provider hoặc bỏ guard/UNIQUE không giải quyết an toàn. Ràng buộc hiện tại không cho đổi UUID; phải xin phép trước mọi restart/sync/thao tác dữ liệu thật, không suy quyền từ việc có log mới.

## 32. Thiết kế liên kết LDAP giữ cả hai UUID; fixture PASS, chờ duyệt — 18/11/2026

Yêu cầu mới chỉ cho **phân tích/thiết kế/kiểm thử dữ liệu giả**; không ghi/đọc lại DB vận hành, gọi IAM thật, migration, restart, sync hoặc commit/push trong lượt này. Không dùng quyền migration demo/MFA trước đây. Đã đọc source Backend/auth/directory/governance/incidents/audit và CLI bảo trì/backup/restore; bảo toàn mọi thay đổi/index có sẵn.

Đề xuất **bảng staff_identity_bindings riêng**: (issuer,subject) → staff_id, provider/source_instance/entryUUID, active/retired và khoảng thời gian, batch/evidence. Thêm identity_link_batches. Giữ nguyên UUID local/Keycloak, staff.json, 7 ledger cũ, audit và mọi FK. Kế hoạch dự kiến nếu đủ bằng chứng: 4 active +4 retired +1 batch =9 INSERT mới, 0 UPDATE/DELETE bảng cũ. Giữ staff.directory_provider_id như legacy; mọi filter/guard/snapshot cho hồ sơ bound phải dùng provider từ binding. Không thể chỉ thêm bảng rồi dùng Backend cũ.

Đã kiểm kê6FK trực tiếp tới staff và các tham chiếu không FK/JSON ở events, identity_events, alerts, actions, notifications, workflow/access/history/outbox; PostgreSQL audit giữ dữ liệu nguồn. Tách req.staff.id local khỏi req.principal subject remote ở auth/MFA/session/directory/admin/governance/CLI. Subject retired không đăng nhập; không fallback username hoặc historical ledger. Điều tra xuyên subject cần provenance/interval, không nới điều kiện evidence/action để đạt giả; projection audit đầy đủ là hạng mục riêng trước nghiệm thu xuyên nguồn.

Tài liệu đầy đủ: `docs/THIET_KE_LIEN_KET_DANH_TINH_LDAP.md` (bảng quan hệ, so sánh rekey, schema/ràng buộc, từng file/API phải đổi, migration/backup/rollback/gates). Thiếu bằng chứng LDAP entryUUID lịch sử/current hoặc interval phải BLOCKED; username/role khớp không chứng minh cùng người. Chưa tạo plan thật hoặc runner production. Chưa sửa mã Backend trong lượt thiết kế này.

Thêm `tests/ldap-link-fixture.cjs`, `tests/fixtures/ldap_identity_design.py`, `tests/test_ldap_identity_design.py`. Dựng schema thật trên dữ liệu giả 4LDAP+8local+13disabled,7ledger,20outbox và đủ quan hệ nghiệp vụ. Prototype không CLI/network, chỉ nhận workspace giả tự tạo. **25/25 thiết kế +112/112 hồi quy =137/137 PASS**: LDAP8, incidents33, SSO19, security52; Node isolation preloader, không .env thật. Có rollback transaction, WAL backup, manifest tamper/corrupt, restore giả, stale plan/seed, lock writer, duplicate/entry/proof/retired/wrong issuer. Không phải nghiệm thu tích hợp resolver mới với JWT/API/MFA hay PostgreSQL thật.

Bằng chứng `.runtime/ldap-design-review/20261118T103913Z/` (result/log/synthetic-plan/schema-inventory), fixture/backup giả `.runtime/ldap-identity-design/`. Backup PROJECT_CONTEXT trước sửa: `.local/source-backups/ldap-design-20261118T103943Z-9d09b76b/manifest.json`. Giữ nguyên backup/migration trước. Syntax/diff kiểm tra riêng, không restart/sync hoặc rollback thật.

**Điểm dừng: chờ phê duyệt phương án, chưa READY FOR APPLY.** Bước tiếp theo sau duyệt: xác minh bằng chứng nguồn, triển khai resolver/callsite đầy đủ và integration tests; xây runner migration/crash-recovery riêng rồi plan thật/preflight/backup với phê duyệt riêng. Không tự chuyển từ prototype tests sang apply.

## 33. Đã triển khai source identity bindings, 343 test PASS; chưa apply — 18/11/2026

Người dùng chấp thuận thiết kế và cho sửa source/test, **chưa cho phép migration thật, thay Keycloak/LDAP, restart Backend hoặc sync thật**. Lượt này chỉ source + dữ liệu giả; không mở attendance.sqlite vận hành, không gọi IAM thật, không setup, commit/push. Không chạy lại migration demo/MFA; những test có tên reconcile chỉ chạy trên fixture.

Backup trước sửa: `.local/source-backups/identity-bindings-20261118T105244Z-37a1fb8e/manifest.json`, gồm 37 file source/test/doc; đường dẫn, kích thước và SHA-256 đọc lại PASS. Giữ nguyên thay đổi chưa commit/index và backup trước. Báo cáo đầy đủ cùng danh sách 29 file: `docs/TRIEN_KHAI_IDENTITY_BINDINGS.md`.

Mới `backend/identity-bindings.js`: schema hai bảng với FK/unique/check, resolver `(issuer,subject)` → staff local, provider hiện tại, khoảng thời gian lịch sử và facade local → remote. **installSchema không được gọi tự động từ store/bootstrap/server; không có API/CLI ghi binding và chưa xây migrator production**. Bằng chứng batch/plan/manifest/reference phải tồn tại và hợp lệ; không fallback username/ledger. Kiểm tra source entryUuid/provider trước thao tác; đọc `attributes.LDAP_ID` qua adapter, thiếu/mismatch thì từ chối. Metadata này giả định được migrator tin cậy ghi sau phê duyệt; không tự chứng minh danh tính bằng hash/username.

App phân tách req.staff.id và req.principal; issuer public riêng transport internal, kiểm tra lại binding/containment sau await; JWT/RBAC/MFA/session/owner/team giữ nguyên. Account/session cache theo issuer; facade cho admin/MFA/session/governance dùng UUID remote. Directory apply/refresh/queue/missing/filter và maintenance dùng đúng namespace; giữ UUID và cột provider legacy. **Không auto-provision LDAP thiếu binding**, kể cả user mới; API trả currentProvider/identityLink/unlinked. LDAP sourceStatus và Keycloak enabled tách biệt để không bỏ bảo mật hoặc khóa vòng thao tác enable. Bootstrap kiểm tra đọc/signature/marker mới chống migration dang dở; không bootstrap DB thật.

Collector giữ user_id nguồn/audit payload, chỉ tra tên/ngữ cảnh theo interval. Governance snapshot/currentProvider/last_login/retry version hiểu binding. Bốn CLI directory_user/process_governance/restore_week5/restore_week6 có guard chặn trước credential/write nếu phát hiện schema binding; chưa hỗ trợ bảo trì nguồn qua CLI. Audit/incident xuyên subject vẫn giữ guard raw ID; PostgreSQL projection chưa triển khai, không tuyên bố khắc phục sự cố dựa trên alias.

**343/343 PASS** tại `.runtime/identity-binding-implementation/20261118T110854Z/`: Backend 257 (unit bindings 15, integration 24, bootstrap 23, directory-errors 9, schedule 3, audit 2, incidents 33, operations 24, phase2 14, retention 6, security 52, sso 19, week5-10 33); Python 86 (guard 4, design 25, demo reconcile 33, MFA reconcile 24). Isolation preloader, không .env thật; HTTP và JWT RS256 thật với IAM giả. Tám local, bốn LDAP, 13 disabled; owner scope/admin/MFA/session/governance/hold/outage; sync giả bảo toàn sáu loại FK, bảy ledger, history/outbox có sẵn. Syntax/diff PASS. Không browser/TOTP/Keycloak/PostgreSQL thật. Test fixture auto-import cũ đã đổi thành binding tường minh; custom verifier truyền issuer rõ ràng, không nới cơ chế auth.

**Chưa READY FOR APPLY/triển khai vận hành.** Còn xác minh entryUUID/interval thật, runner với plan bốn tài khoản, backup manifest/marker/crash recovery và rehearsal, writer preflight mới cùng quyền riêng trước apply/restart/sync. CLI bảo trì và audit xuyên subject còn giới hạn nêu trong báo cáo. Không dùng source mới trên vận hành để tự tạo binding, không dùng quyền phiên cũ và không chạy prototype/migration demo/MFA để xử lý LDAP.
