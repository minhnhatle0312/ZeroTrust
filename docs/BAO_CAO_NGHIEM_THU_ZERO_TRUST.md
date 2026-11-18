# Báo cáo nghiệm thu ZeroTrust — Đợt 6

Ngày: **09/11/2026**. Repository: `D:\ZeroTrust`. Phạm vi: rà soát yêu cầu/kết quả Đợt 1–5B, kiểm tra môi trường chỉ đọc, hồi quy cô lập, sửa lỗi có bằng chứng và hoàn thiện tài liệu. Không triển khai lab/production.

## 1. Kết luận

**CHƯA ĐẠT nghiệm thu tổng thể có tích hợp/lab thật.** Source và các ca kiểm thử cô lập đã đạt trong phạm vi nêu dưới đây, nhưng các tiêu chí bắt buộc MFA/TOTP thật, SSO/phiên trên Keycloak hiện tại, PostgreSQL thật và HTTPS từ máy khách thứ hai chưa được xác minh lại. Docker Engine và lab chưa khả dụng; không được suy từ mock hoặc minh chứng lịch sử thành nghiệm thu vận hành mới.

Đây không phải kết luận các chức năng đó bị lỗi: trạng thái là **chưa chạy/bị chặn môi trường**. Không nâng mốc lịch sử 4/6 hoặc tuyên bố sẵn sàng production. Có thể bàn giao source, test và tài liệu để tiếp tục nghiệm thu trong môi trường được phép.

## 2. Tổng quan và căn cứ đối chiếu

Web A/React phục vụ chấm công, đơn điều chỉnh, nhóm và quyền; Web B/React phục vụ giám sát/điều tra. Express kiểm tra JWT/client/role/team/owner, tài khoản/phiên và giữ dữ liệu SQLite. Keycloak/PostgreSQL danh tính cung cấp OIDC/PKCE/SSO/MFA theo cấu hình. Audit Python/PostgreSQL riêng nhận outbox, lưu event/incident và Python Detection. LDAP/LDAPS, gateway HTTPS và profile production-like có trong source.

Đã đối chiếu các báo cáo Đợt 1, 2, 3, 4, 5A, 5B; `API_SU_CO_DOT_4.md`, kiểm kê tương tác; kiến trúc và danh mục chức năng; `tuanconlai.md`, `tuan5.md`, tài liệu triển khai chi tiết, báo cáo tuần/Word và bàn giao. Phân biệt thiết kế, minh chứng 08/11, kết quả từng đợt và lượt kiểm thử Đợt 6. Báo cáo/snapshot cũ giữ nguyên.

| Yêu cầu ban đầu / nhóm | Source hoàn thành | Xác minh Đợt 6 | Còn thiếu cho nghiệm thu thật |
|---|---|---|---|
| UI A/B hiện đại, responsive, bàn phím | Đợt 2/3/5A/5B | Build + browser Chrome synthetic, 320/390/768/1440px theo suite | Thiết bị/thực tế, screen reader đầy đủ và trình duyệt khác |
| Login tập trung, Code + PKCE S256 | AuthGate/adapter chung, không form mật khẩu/OTP riêng | Unit/controller/adapter với IdP giả, preflight/outage/denied | Clients/redirect/origin/issuer effective trên Keycloak hiện tại |
| SSO, logout, refresh, hết/thu hồi/khóa phiên | Backend account/session/cutoff, monitor và UI trạng thái | Backend và browser fixture | Luồng thật hai Web, refresh policy/revocation/disable thực trên danh tính test tách biệt |
| JWT, RBAC, IDOR | Crypto verifier và client/role/team/owner checks | Backend với khóa test, negative cases và quyền admin/auditor/employee/manager | Review effective realm/service-account và môi trường live |
| MFA/TOTP | Flow/required actions/account controls có source | Trạng thái bắt buộc/từ chối và policy logic giả lập | OTP đúng/sai/hết hạn/bypass, SSO sau MFA và phạm vi mọi user/flow |
| Web A nghiệp vụ | Chấm công/bảng công/đơn/nhóm/phê duyệt/nhân viên | Backend + 78 kiểm tra browser memory; filter/CSV/confirm/draft | Keycloak/LDAP/backend lab thực và form ngoài phạm vi browser đã chạy |
| Web B Dashboard/Audit/Detection | Các trang, API/read controls, metrics theo nhãn | 93 kiểm tra browser đọc; Audit trung tâm là fixture | SQL/worker/collector/metrics trên dữ liệu test thật độc lập |
| Hồ sơ sự cố, nguồn, timeline, nguyên nhân | DTO Đợt 4 + UI 5A | Exact refs, missing/legacy, cursor/version/history | PostgreSQL thật và nguồn bị mất/khối lượng lớn |
| Đề xuất, hành động thực, kiểm chứng/đóng | Form 5B theo API; không tự thực thi | 40 kiểm tra workflow; SQLite thật memory, central giả lập | Workflow end-to-end với Audit/PostgreSQL/IdP thật trên stack tách biệt |
| Kiểm kê nút/form/menu và lỗi | Snapshot 5B: 29 mục menu, 46 nhóm, 475 vị trí JSX/helper | AST khớp; browser kiểm các tương tác trong suite | Không coi 475 vị trí source là 475 ca UI hoặc 100% tương tác live |
| LDAP/JCL/Access Governance | Module, READ_ONLY federation, operator workflow/hold | Backend tuần 5–10 hồi quy và smoke menu | Không chạy lại LDAP/AD thật, JCL live hoặc thay quyền thật |
| Bảo toàn dữ liệu/secret/test an toàn | Guard, packager, audit/history/version; retention sửa | Unit/packaging/isolation/snapshot, đối chiếu source | Backup/restore vận hành, secret sharing review, CVE/load/penetration tests |

## 3. Môi trường và probe chỉ đọc

Căn cứ `.runtime/phase6-tests/environment.json`, được sinh bởi `python -B scripts/inspect_phase6.py`:

| Hạng mục | Kết quả thực tế |
|---|---|
| Docker CLI | Có, 29.9.1; không suy ra daemon hoạt động |
| Docker Compose | Có, 5.6.0 |
| Docker Engine | Không khả dụng, thiếu pipe `dockerDesktopLinuxEngine`; service dừng, không thấy Desktop trong kiểm tra process |
| Compose cơ bản | Parse hợp lệ; keycloak/postgres; Keycloak bind loopback 8080, PostgreSQL không publish host port |
| Compose stack cấu hình đầy đủ | Parse hợp lệ; keycloak, postgres, ldap, audit-db, audit-service. Parse không phải runtime health |
| Cấu hình công khai | Backend `.env` và hai `.env.local` frontend thống nhất development localhost 8080/3001/5173/5174, Audit 8090; root public URL đang localhost |
| Cache HTTPS | Cấu hình gateway/CA tồn tại nhưng không có bằng chứng gateway đang chạy hoặc CA được máy khách tin. Không tự thay mode |
| Cổng TCP loopback đã đo | 3001, 5173, 5174, 5432, 5433, 8080, 8090, 8443 không lắng nghe. PostgreSQL vốn có thể không publish port; cổng host đóng không thay kiểm container |
| HTTP GET public | Backend health, Web A/B, Keycloak discovery local và gateway health/ready/discovery đều chưa truy cập được; không xác minh identity/TLS/service readiness |
| PostgreSQL/Keycloak lab | Chưa kết nối/xác minh runtime; không lấy credential để ép test hoặc tự khởi động stack |

Không reset database/volumes/realm, không bật Docker Desktop, không chạy lab runner. Hướng dẫn khởi động có trong [tài liệu vận hành](HUONG_DAN_KHOI_DONG.md); việc mở Desktop hoặc chạy Backend có thể kích hoạt container, migration/collector và tác động dữ liệu nên cần cửa sổ vận hành được phép.

## 4. Kết quả kiểm thử hiện hành

Lệnh tổng hợp: `python -B scripts/test_phase6.py`. Runner allowlist, environment lọc, Node preloader và Chrome chỉ kết nối fixture loopback; SQLite memory/thư mục tạm riêng; không nạp `.env` lab. Build hai Web vào `.runtime/phase6-tests/build`, không ghi `dist` đang dùng.

| Nhóm | Loại bằng chứng | Kết quả |
|---|---|---|
| Backend Audit/security/SSO/operations/week5–10/auth/incident/retention | Unit/tích hợp Express + SQLite cô lập; JWT ký bằng khóa test | **183/183 đạt** |
| Frontend/auth/session/Workspace/read/edit incident | Unit/contract | **61/61 đạt** |
| Python Detection offline | Rule/features/metrics trên dữ liệu test | **7/7 đạt** |
| Đóng gói | Archive fixture, chặn secret/runtime/traversal/link; giữ module runtime mới | **12/12 đạt** |
| Review OIDC offline | Source representation/metadata fixture | **7/7 đạt**, không phải client live |
| Guard cô lập Node | Chặn DB/network/dotenv ngoài phạm vi | **7/7 đạt** |
| Inventory coverage/snapshot | Kiểm kê JSX snapshot 5B không đổi UI | **4/4 đạt**, snapshot check đạt |
| Guard PostgreSQL fixture | Kiểm tra metadata/container qua mock guard | **5/5 đạt**, không phải PostgreSQL thật |
| Web A/Web B | Build fixture | **Đạt / đạt** |
| Browser auth/SSO | Adapter thật, IdP/API giả | **25 đạt** |
| Browser Web A | Build + Express/SQLite memory, IdP giả | **78 đạt** |
| Browser Web B đọc | Build + Express/SQLite memory, Audit/OIDC giả | **93 đạt** |
| Browser workflow 5B | Ghi/đóng/refusal/409/503/permission; central giả | **40 đạt** |
| PostgreSQL thật 28 ca Đợt 4 | Chưa chạy lại vì Engine không khả dụng | **NOT RUN / BLOCKED**, không cộng PASS |
| Login/SSO/MFA/phiên/HTTPS lab thật | Không có môi trường/tài khoản test tách biệt đang chạy | **NOT RUN / BLOCKED** |

Lượt chạy cuối hoàn tất với exit code 0: **286 test cô lập và 236 kiểm tra browser**, hai build đạt; cả **15 suite** đều thành công. Trạng thái từng suite ở `.runtime/phase6-tests/summary.json`, số ca trong log và JSON browser tương ứng; không cộng số test lịch sử vào lượt này. Ca không chạy không được tính là đạt.

Browser xác minh menu, nút xem hồ sơ, tìm/lọc/phân trang/CSV, form và xác nhận, empty/loading/error, scope/denial, nguồn thiếu, timeline/evidence/history, đề xuất chưa thực thi, actionRefs/verification, đóng đạt/bị từ chối và bảo vệ draft khi conflict/lost reply. Test script lịch sử có tác động tài khoản/LDAP/retention thật không được đưa vào runner này.

## 5. Lỗi tái hiện và sửa

### DATA-06-01 — P1: retention SQLite làm mất bằng chứng được trích dẫn

Code cũ trong callback retention xóa event/login theo thời gian mà không xét incident. Tái hiện bằng chính truy vấn đó trên SQLite `:memory:`: evidence trước=1, sau=0, missing=1. Không có dữ liệu thật bị thử xóa. Artifact: `.runtime/phase6-tests/retention-before.json` và script tái hiện lịch sử tại cùng thư mục.

Sửa `backend/retention.js`, nối callback `backend/server.js`: giữ event/login có direct link hoặc được current metadata/history tham chiếu, mọi trạng thái hồ sơ. Không đổi thời hạn/toggle retention, JWT/RBAC hay schema. Các delete đủ điều kiện vẫn trong transaction; metadata không đọc được khiến rollback toàn bộ. Không tự khôi phục bằng chứng đã mất hoặc bịa dữ liệu cũ.

6 test mới xác minh: dọn uncited/recent đúng; giữ direct evidence open/reviewing/resolved/false_positive; giữ assessment/proposal/verification; giữ history; malformed metadata rollback; invalid cutoff không ghi. Đã đạt sau sửa, sau đó chạy hồi quy. Chưa chạy pruning hoặc triển khai sửa lên lab. Giữ evidence lâu hơn có thể tăng dung lượng/chi phí truy vấn, cần chính sách archive và đo tải trước production.

### DOC-06-01 — P2: trạng thái và hướng dẫn vận hành lỗi thời

README dừng ở Đợt 2, chạy nhanh tuần cũ đưa init/setup và test có tác động vào lối dùng lab đã có dữ liệu. Đã cập nhật tài liệu hiện hành, tách probe/test/vận hành, sửa mô tả auditor, liên kết workflow/API và ghi rõ giới hạn. Tài liệu lịch sử có banner dẫn tới hướng dẫn mới; không sửa báo cáo kết quả Đợt 1–5B.

## 6. Rủi ro và mức độ đáp ứng Zero Trust

| Nguyên tắc/phạm vi | Bằng chứng hiện có | Khoảng trống |
|---|---|---|
| Xác minh truy cập | JWT RS256, issuer/audience/azp, account/session/cutoff, fail-closed, unit negative | Effective realm/client/MFA và độ trễ revocation live chưa đo lại |
| Quyền tối thiểu | Role/client/team/owner, cấm tự duyệt, admin/auditor phân biệt ở Backend | Service account manage-users có phạm vi rộng, chưa đọc effective roles live |
| Không mặc định tin UI | Backend authority, không có password/OTP form riêng, PKCE | Device posture/risk-adaptive policy/workload identity/mTLS chưa có bằng chứng nghiệm thu |
| Truy vết/toàn vẹn | Audit/outbox, request ID, exact evidence, immutable history, CAS, retention protection | Không transaction phân tán; lịch sử/source legacy có thể thiếu; quy mô evidence có giới hạn |
| Phân tách môi trường | Test riêng, token/DB synthetic, production-like profile riêng | Profile hiện chưa triển khai/kiểm chứng, lab mặc định start-dev không phải production |
| Giám sát có căn cứ | Detection baseline, nhãn độc lập, metrics không bịa; đề xuất tách kết quả | Chưa đo lại precision/recall/F1/latency trên nguồn test tích hợp thật trong lượt 6 |

Hệ thống áp dụng một phần các cơ chế Zero Trust theo source/kiểm thử cô lập; **không chứng nhận “Zero Trust đầy đủ” hoặc gắn phần trăm từ số test PASS**. Chưa có bằng chứng mới về service-to-service trust, HA/DR, CA máy khách thứ hai, quản trị secret sau chia sẻ và vulnerability scan dependencies. Bỏ tracking hiện tại không xóa bản trong Git history; không suy rằng đã lộ ra ngoài và không tự xoay credential.

Các rủi ro còn lại được quản lý tại [danh sách lỗi/giới hạn](LOI_VA_GIOI_HAN.md): ambiguous commit/idempotency, lỗi upstream chung, legacy/missing evidence, limit 500/2.000, tìm PostgreSQL trong trang, action picker phân trang nguồn, dung lượng retention, draft không lưu qua kết thúc phiên, và phạm vi QA chưa phủ.

## 7. File bàn giao và bảo toàn kết quả trước

| Nhóm | File mới/chỉnh sửa trong Đợt 6 |
|---|---|
| Sửa retention Backend | `backend/server.js`, mới `backend/retention.js`, `backend/retention.test.js` |
| Runner/probe/fixture riêng | Mới `scripts/test_phase6.py`, `scripts/inspect_phase6.py`, `scripts/prepare_phase6_fixture.py`, `tests/phase6.vite.mjs` |
| Chọn output test Đợt 6, giữ hành vi đợt cũ | `tests/auth-browser.cjs`, `tests/workspace-browser.cjs`, `tests/security-browser.cjs`, `tests/incident-browser.cjs`, `tests/fixtures/workspace-server.cjs`, `tests/test_incidents.py` |
| Kiểm tra module mới có trong gói source | `tests/test_packaging.py` |
| Tài liệu hiện hành cập nhật | `README.md`, `CHAY_NHANH.md`, `docs/CHUC_NANG_VA_API.md` |
| Hướng dẫn/báo cáo mới | `docs/HUONG_DAN_KHOI_DONG.md`, `docs/HUONG_DAN_KIEM_THU.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/API_VA_QUY_TRINH_SU_CO.md`, `docs/LOI_VA_GIOI_HAN.md`, `docs/BAO_CAO_NGHIEM_THU_ZERO_TRUST.md` |
| Bổ sung trạng thái/liên kết vào tài liệu cũ | `tuanconlai.md`, `TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md`, `docs/NANG_CAP_GIAO_DIEN.md`, `docs/BAN_GIAO_VA_VAN_HANH.md`, `docs/KIEN_TRUC_VA_LUONG_HE_THONG.md` |

Tổng cộng **28 file source/test/tài liệu** trong phạm vi bàn giao; artifact ignored riêng ở `.runtime/phase6-tests/`. Đối chiếu hash baseline không ghi nhận thay đổi báo cáo Đợt 1–5B, kiểm kê/snapshot cũ, source Web A/Web B/shared, Keycloak, Audit và cấu hình triển khai/network được theo dõi trong baseline. Kết quả đối chiếu ở `preservation.json`; không dùng hash này để tuyên bố đã kiểm tra nội dung database thật.

Không chạy Backend/lab runner, pruning trên dữ liệu thật, tạo fixture Docker, reset/xóa database/volume/realm, thay credential, sửa lịch sử Git, commit, push hoặc triển khai. 6.360 mục xóa khỏi Git index đã có từ Đợt 1 giữ nguyên; kiểm tra tracked-ignored vẫn bằng 0. File riêng tư/runtime trên máy không bị xóa trong Đợt 6. Kiểm tra liên kết tương đối của bộ tài liệu hiện hành không có đích thiếu; `git diff --check` cho các file tracked đã sửa đạt.

## 8. Bàn giao và điều kiện trước triển khai thực tế

1. Người vận hành khôi phục Engine/stack đúng cấu hình trong cửa sổ được phép; xác minh backup/restore và không nhầm volumes/danh tính/Audit.
2. Tạo môi trường tích hợp tách biệt có dữ liệu giả; chạy 28 ca PostgreSQL, migration dữ liệu cũ, row lock/concurrency/rollback và luồng Web B với Audit thật.
3. Kiểm chứng OIDC clients/discovery/redirect/origin/issuer/audience và quyền service account thực, không đổi production policy chỉ để test đạt.
4. Chạy OTP đúng/sai/hết hạn/bypass, SSO A↔B, refresh/logout/revoke/disable và fail-closed bằng danh tính test riêng; đo độ trễ theo chính sách cache.
5. Chạy Web A/B và HTTPS từ máy khách thứ hai với CA/SAN hợp lệ; không bỏ qua TLS để nghiệm thu.
6. Đối chiếu incident source/action/probe thật, xác minh closing/false-positive/reopen, outage và recovery; rà dữ liệu legacy trước khi kết luận.
7. Review secret-sharing scope, dependency/SBOM/CVE, service account, network segmentation, dung lượng/hiệu năng retention/evidence và quy trình archive. Những thay đổi policy/credential hoặc data thực cần phê duyệt riêng.
8. Chỉ sau nghiệm thu trên môi trường được cấp phép mới quyết định triển khai; không có commit/push/deploy production tự động trong Đợt 6.

Tài liệu hiện hành: [khởi động](HUONG_DAN_KHOI_DONG.md), [kiểm thử](HUONG_DAN_KIEM_THU.md), [sử dụng](HUONG_DAN_SU_DUNG.md), [chức năng/quyền/API](CHUC_NANG_VA_API.md), [quy trình sự cố](API_VA_QUY_TRINH_SU_CO.md), [kiến trúc](KIEN_TRUC_VA_LUONG_HE_THONG.md). Báo cáo/snapshot 1–5B giữ nguyên và là bằng chứng lịch sử riêng.

Đợt 6 kết thúc ở phạm vi được phép; dừng, không tự khởi động hoặc thay đổi dữ liệu lab để hoàn tất các ca bị chặn.
