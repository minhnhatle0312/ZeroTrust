# Kết quả triển khai và kiểm thử Đợt 4 — Backend sự cố bảo mật

Ngày: 09/11/2026, UTC+7. Phạm vi: backend/API và mô hình điều tra, chuẩn bị Web B Đợt 5. **Chưa triển khai lên lab, chưa áp dụng migration vào database đang sử dụng.**

## 1. Kết quả nghiệm thu

- **293 kiểm thử cô lập đạt**, gồm **177 backend**, **28 PostgreSQL thật trong container tmpfs**, frontend/auth, Detection, đóng gói và rào chắn môi trường.
- **103 kiểm tra browser hồi quy đạt**: 25 xác thực/SSO giả lập hai chiều và 78 tương tác Web A với backend thật, SQLite trong bộ nhớ, IdP giả.
- **Build Web A/Web B đạt**, output riêng `.runtime/phase4-tests/build`; không ghi đè dist đang sử dụng.
- **28/28 file** giao diện, xác thực và tài liệu/snapshot kết quả Đợt 1–3 được đối chiếu SHA-256 giữ nguyên.
- Không có ca trượt trong lượt nghiệm thu cuối. Không có thao tác khắc phục tự động trên tài khoản hoặc dữ liệu thật.

Chi tiết hợp đồng, body mẫu, quyền, lỗi và hướng dẫn chạy lại: [API_SU_CO_DOT_4.md](API_SU_CO_DOT_4.md).

## 2. Khảo sát và quyết định mở rộng

Đã đọc kết quả/kiểm kê Đợt 1–3, tài liệu triển khai chi tiết, `tuanconlai.md`, mô tả chức năng/API và yêu cầu Audit/Detection. Đối chiếu Express, SQLite store/collector/outbox, dịch vụ Audit Python, PostgreSQL schema, Detection rules/worker và component đang dùng API.

| Đã có | Khoảng thiếu đã xử lý |
|---|---|
| SQLite alerts/list/context; thao tác tài khoản có kết quả synced/partial | Thêm liên kết bằng chứng chính xác, version, metadata điều tra và lịch sử before/after; context tài khoản không còn bị coi là bằng chứng gốc. |
| PostgreSQL incidents có version và lịch sử trạng thái | Mở rộng bộ lọc, chi tiết, timeline, assessment/proposal/action reference/verification; trả 404 khi không có bản ghi. |
| Detection lưu rule/features/run | Chi tiết đọc kết quả thật, sinh đề xuất có citation theo rule thực sự có; không đoán rule từ summary khi result đã mất. |
| JWT, RBAC, phiên, account checks và audit | Tái sử dụng middleware; admin/auditor đọc, admin ghi; actor/request ID do server xác định; bảo vệ liên kết đối tượng khác danh tính. |
| Outbox bền vững và retention chủ động | Giữ payload cũ, nâng trigger nguyên tử để ghi target đã biết cho sự kiện mới; retention bảo vệ cả bằng chứng liên kết của sự cố đang mở. |

Không tạo kho sự cố hoặc endpoint danh sách thứ ba. Giữ hai nguồn dữ liệu và các envelope cũ, thêm `detail.schemaVersion=1` để Web B dùng chung cách trình bày.

## 3. Mô hình dữ liệu

### SQLite

- `alerts`: giữ cột/bản ghi cũ; thêm `version`, `detected_at`, `last_observed_at`, `investigation_json`.
- `alert_evidence`: khóa `(alert_id,source,event_id)`; source chỉ `events` hoặc `identity_events`. `store.event` và collector gắn đúng ID vừa ghi. Không ghép legacy bằng đoán username/thời gian/IP.
- `alert_history`: unique `(alert_id,version)`, actor ID/username, request ID, thời gian, trạng thái, ghi chú và snapshot thay đổi trước/sau. Ghi chú legacy được giữ trong snapshot khi có chỉnh sửa mới.
- `incident_migrations`: marker migration additive. Không backfill timestamp phát hiện hoặc lịch sử chưa từng được ghi.
- `actions`: tiếp tục là nguồn kết quả thực thi đã có; API sự cố chỉ tham chiếu, không thực thi lại.

### PostgreSQL

- `audit_incidents`: thêm `investigation JSONB`; giữ nguyên ID, rule, event_id, state, version và thời gian cũ.
- `incident_history`: thêm version/request_id/change nullable; lịch sử legacy giữ giá trị thực và các trường chưa biết là null.
- `incident_evidence`: giữ event_ref kể cả khi bản ghi nguồn không còn; FK event_id chuyển null khi nguồn bị dọn theo quy trình cũ. Phân biệt `direct` và `investigation`.
- `incident_migrations` và unique index history/version hỗ trợ replay an toàn.
- Burst mới liên kết các sự kiện thực sự đã được truy vấn để tính ngưỡng. Khi cùng sự cố nhận thêm bằng chứng mới, version tăng; nếu trước đó đã đóng thì chuyển reviewing và có lịch sử `system:detector`. Replay cùng bằng chứng không tạo lịch sử giả.

### Cấu trúc chi tiết cho Web B

`detail` chứa định danh/nguồn, loại/mức độ/trạng thái/version; thời gian xảy ra/phát hiện/cập nhật; chủ thể; IP/ứng dụng/tài nguyên/request ID; evidence và giới hạn nguồn; timeline/history; assessment; đề xuất; hành động được liên kết; verification và handler.

Các nhóm được tách rõ:

| Nhóm | Nguồn và mức tin cậy |
|---|---|
| Dữ liệu ghi nhận | Sự kiện Audit/SQLite, rule/features Detection, bản ghi actions. Thiếu nguồn trả null/missing, không tạo thông tin thay thế. |
| Nhận định nguyên nhân | Người điều tra ghi, có mức hypothesis/supported/confirmed/refuted và citation. Hệ thống không tự kết luận bị tấn công từ một tín hiệu. |
| Đề xuất | Catalog theo rule hoặc đề xuất admin; ghi `executed:false`, có căn cứ và version catalog. |
| Kết quả thực hiện | Đọc bản ghi actions hoặc sự kiện thực thi thật; không lấy nội dung đề xuất làm kết quả. Target chưa được nguồn ghi thì thể hiện chưa ghi nhận. |
| Kết quả kiểm tra | Hồ sơ `analyst_verification`, đối chiếu với sự kiện độc lập có thật sau sự cố/hành động và đúng kết quả mong đợi. Không tuyên bố đây là chứng nhận tự động toàn bộ nguyên nhân gốc. |

`resolution.verified` không suy ra chỉ từ state resolved. Bản ghi legacy resolved thiếu kiểm chứng vẫn giữ state lịch sử nhưng verified=false. Source/context không đầy đủ được nêu rõ; không dựng lại lịch sử cũ.

## 4. API mới và nâng cấp

| API | Kết quả |
|---|---|
| `GET /api/security/alerts/:id` — mới | Trả alert và detail chuẩn hóa, bằng chứng, timeline, metadata và lịch sử có con trỏ. |
| `GET /api/security/alert-list` | Thêm lọc source/timeField; giữ lọc trạng thái, severity, tìm kiếm, sort và phân trang. |
| `GET /api/security/alerts/:id/context` | Giữ chức năng cũ; context theo actor ID, thêm detail và đánh dấu context không phải bằng chứng gốc. |
| `PATCH /api/security/alerts/:id` | Version/CAS, assessment, recommendation, actionRefs, verification, audit và history nguyên tử. |
| `GET /api/security/central/incidents` | Lọc state/severity/source/detector/thời gian; limit/offset; source chỉ theo bằng chứng phát hiện trực tiếp. |
| `GET /api/security/central/incidents/:id` | Thêm detail, kết quả Detection thật và lịch sử có con trỏ; 404 cho sự cố không tồn tại. |
| `POST /api/security/central/incidents/:id` | Mở rộng điều tra có version, kiểm tra liên kết, điều kiện đóng, operation/history cùng transaction PostgreSQL. |
| Health của Audit hiện có | Thêm capability schema điều tra. Node từ chối ghi qua Audit cũ, không fallback về hành vi đóng chỉ bằng ghi chú. |

Các API sự kiện hiện có tiếp tục mở được bản ghi nguồn. Không bổ sung API tự khóa/mở tài khoản, đổi role, thu hồi phiên hoặc chạy khắc phục tự động.

## 5. Kiểm soát bảo mật và toàn vẹn

- JWT/chữ ký/issuer/audience, kiểm tra tài khoản/phiên và RBAC hiện có giữ nguyên. Test mới dùng JWT ký bằng key sinh trong bộ nhớ, có ca thiếu token/sai audience/hết hạn và quyền employee/manager/auditor/admin.
- Admin/auditor được đọc theo phạm vi bảo mật hiện hữu; auditor không được ghi điều tra. Client không được tự chọn actor/request ID hoặc kết quả hành động.
- Liên kết bằng chứng/hành động sai user/target bị từ chối. Không tự gán danh tính theo IP dùng chung hoặc username ẩn danh.
- Validation giới hạn trường, ref, số lượng, độ dài, version và mẫu credential rõ ràng; truy vấn tham số hóa; không trả lỗi DB thô.
- SQLite dùng transaction và cập nhật `WHERE version`; PostgreSQL khóa hàng, kiểm tra version và cập nhật có điều kiện. History/audit lỗi thì rollback phần thay đổi cùng kho.
- Không chấp nhận resolved chỉ bằng ghi chú, hành động partial hoặc một sự kiện “đã thực thi”. Kiểm tra phải độc lập, sau sự kiện/hành động, không ở tương lai; xử lý timezone bằng thời điểm thực.
- Node ghi audit yêu cầu trước khi gọi cập nhật PostgreSQL; nếu SQLite audit này lỗi thì không gửi mutation upstream.
- Migration additive/replay; trigger outbox thay trong transaction, payload đang chờ không viết lại. **Không chạy migration trên database thật trong đợt này.**

Thay đổi tương thích có chủ đích: test cũ cho phép admin đóng cảnh báo chỉ bằng note được cập nhật để yêu cầu điều tra và kiểm chứng đúng yêu cầu Đợt 4. Giao diện cũ tiếp tục đọc/ghi reviewing; các nút đóng resolved/false_positive cần form bằng chứng mới ở Đợt 5, không có đường bỏ qua kiểm tra.

## 6. Kết quả kiểm thử

Lệnh nghiệm thu: `python -B scripts/test_phase4.py`.

| Bộ kiểm thử | Kết quả cuối |
|---|---:|
| Backend audit/security/SSO/operations/week5–10/phase2 + incidents | **177/177 đạt** |
| API/migration/concurrency PostgreSQL thật, schema giả riêng từng test | **28/28 đạt** |
| Frontend utilities/API/auth/session/validation Web A | **46/46 đạt** |
| Detection Python offline | **7/7 đạt** |
| Đóng gói, gồm dependency incident-policy và module mới | **12/12 đạt** |
| OIDC review offline | **7/7 đạt** |
| Rào chắn database/network của test Node | **7/7 đạt** |
| Kiểm kê tương tác JSX | **4/4 đạt** |
| Rào chắn fixture: ID, nhãn, tmpfs, loopback, từ chối volume/lab | **5/5 đạt** |
| Kiểm tra snapshot kiểm kê Đợt 3 khớp nguồn | Đạt |
| Build Web A / Web B | Đạt / Đạt |
| Browser xác thực hồi quy | **25/25 đạt** |
| Browser nghiệp vụ Web A hồi quy | **78/78 đạt** |

### Các trường hợp đã xác minh

- Danh sách, lọc nguồn/mức độ/trạng thái/thời gian, phân trang, tham số không hợp lệ; từ chối bộ lọc lặp để không âm thầm mở rộng kết quả.
- Chi tiết sự cố, bằng chứng đúng ID, timeline, thiếu dữ liệu, sự cố không tồn tại và nguồn bị mất; không đoán rule Detection từ summary.
- Nhận định có mức xác minh, đề xuất có citation, hành động đúng target, kết quả synced/partial và phân biệt kiểm tra độc lập.
- Từ chối closure chưa kiểm chứng, bằng chứng sai thời gian/timezone/kết quả, log thực thi dùng thay test hoặc liên kết khác danh tính.
- History/actor/request ID; con trỏ đọc lịch sử cũ; replay không trùng; hai cập nhật cùng version chỉ một cập nhật commit.
- SQLite lỗi ghi history/audit hoặc đọc evidence; PostgreSQL lỗi ghi thực tế qua trigger và lỗi kết nối qua HTTP: không báo thành công, rollback đúng kho, không lộ lỗi thô.
- Migration SQLite/PostgreSQL chạy lặp với dữ liệu legacy giả; giữ nguyên giá trị cũ. Transaction migration lỗi không để lại DDL dang dở. Outbox giữ payload cũ và ghi đúng target cho sự kiện mới.
- Detection chạy classify/extract với PostgreSQL thật; burst liên kết đủ các sự kiện đã tính ngưỡng; retention chỉ **dry run** trên dữ liệu giả.
- Không có lời gọi thực thi identity remediation từ API điều tra trong các ca kiểm thử.

“PostgreSQL thật” ở đây chỉ engine PostgreSQL 17 trong container thử nghiệm, không phải database lab. Browser dùng OIDC giả; không khẳng định đã kiểm thử Keycloak/MFA/SSO thật.

## 7. File thay đổi/bổ sung

| File | Nội dung |
|---|---|
| `backend/incidents.js` — mới | Migration SQLite, mô hình chi tiết, validation, evidence scope, version/history và API local. |
| `backend/store.js` | Gọi migration; ghi liên kết nguồn trực tiếp, detected time và tăng version khi thêm sự kiện. |
| `backend/app.js` | Đăng ký handler điều tra mới thay handler cập nhật note/status đơn giản. |
| `backend/identity-events.js` | Gắn ID sự kiện Keycloak đã ghi vào cảnh báo. |
| `backend/operations.js` | Mở rộng filter; context actor ID và detail. |
| `backend/central-audit.js` | Proxy DTO/filter/version/capability; audit trước mutation; nâng projection target/outbox trigger nguyên tử. |
| `audit/incidents.py` — mới | Chi tiết/lọc/evidence/history, điều tra PostgreSQL và luật đóng có kiểm chứng. |
| `audit/schema.sql` | Cột/bảng/index/marker additive cho điều tra và bằng chứng. |
| `audit/service.py` | Dùng module incidents; liên kết các event tính ngưỡng, target allowlist, capability và retention bảo vệ evidence mở. |
| `audit/incident-policy.json` — mới | Catalog đề xuất theo rule, chỉ tham vấn, không thực thi. |
| `audit/Dockerfile` | Đưa catalog vào image khi build trong tương lai; chưa build/deploy image lab. |
| `scripts/package_week10.py` | Allowlist đúng catalog JSON cần để chạy module; giữ chặn runtime/private. |
| `scripts/prepare_phase4_fixture.py` — mới | Tạo/dừng đúng PostgreSQL test tmpfs; không dùng compose/volumes, không fallback lab. |
| `scripts/test_phase4.py` — mới | Runner cô lập, xác minh fixture và lưu kết quả riêng. |
| `backend/incidents.test.js` — mới | 33 test backend bổ sung về sự cố/SQLite/proxy/outbox. |
| `backend/security.test.js` | Sửa kỳ vọng đóng cảnh báo không kiểm chứng; vẫn kiểm tra admin được ghi điều tra. |
| `tests/test_incidents.py` — mới | 28 test PostgreSQL thật, API, migration, thiếu nguồn và đồng thời. |
| `tests/test_phase4_safety.py` — mới | 5 test từ chối fixture có nguy cơ trỏ lab/volume. |
| `tests/phase4.vite.mjs` — mới | Build fixture riêng, không đọc .env lab. |
| `tests/test_packaging.py` | Kiểm tra archive có đầy đủ catalog/module runtime mới. |
| `tests/auth-browser.cjs` | Chọn output Đợt 4; giữ các kịch bản xác thực cũ. |
| `tests/workspace-browser.cjs` | Chọn output Đợt 4; giữ các kịch bản Web A cũ. |
| `tests/fixtures/workspace-server.cjs` | Phục vụ build Đợt 4 khi runner chọn, không ghi đè kết quả Đợt 3. |
| `docs/API_SU_CO_DOT_4.md` — mới | Hợp đồng tích hợp và hướng dẫn chạy lại. |
| `docs/KET_QUA_KIEM_THU_DOT_4.md` — mới | Báo cáo này. |

Artifact, dependency psycopg phục vụ test, baseline/hash và log được lưu riêng trong `.runtime/phase4-tests`, không đưa vào source archive. Không sao chép database/token/password thật vào fixture hoặc báo cáo.

## 8. Giới hạn còn tồn tại

1. Chưa kiểm chứng đường truyền/proxy/HTTPS, Keycloak, LDAP hoặc PostgreSQL vận hành thật. Cần kiểm thử tích hợp khi có môi trường được phép; không suy từ test cô lập thành nghiệm thu production.
2. Không có transaction phân tán SQLite/PostgreSQL. Nếu PostgreSQL đã commit mà SQLite ghi audit phản hồi bị lỗi, client có thể nhận 503 dù thay đổi từ xa đã ghi. Đọc lại version/history trước thao tác tiếp theo; không tự retry mutation. Audit/history PostgreSQL vẫn nguyên tử trong kho của nó.
3. Legacy SQLite thiếu exact links không tự backfill theo phỏng đoán. Thời điểm phát hiện/actor/nguồn bị mất hiển thị thiếu dữ liệu; không dùng timestamp hoặc lịch sử giả.
4. Chi tiết evidence giới hạn 500, đánh dấu complete=false khi vượt mức; không xác nhận khắc phục với proof thiếu/chưa đủ. History có con trỏ tải tiếp. Dữ liệu rất lớn cần mở rộng phân trang evidence trước khi sử dụng như hồ sơ điều tra đầy đủ.
5. Kết quả xác minh là hồ sơ người điều tra với kiểm tra điều kiện dữ liệu, chưa phải trình kiểm tra tự động cho từng loại nguyên nhân gốc. Truy cập ALLOW/DENY và một sự kiện thực thi không tự chứng minh mọi biện pháp đã hiệu quả.
6. Audit cũ không ghi target/action identity đầy đủ; không suy diễn sự kiện của admin thành hành động trên tài khoản khác. Marker thực thi chưa phải mô hình retry/correlation hoàn chỉnh cho mọi workflow; kết quả partial còn phải đối chiếu qua chức năng quản trị hiện có.
7. UI hiện tại chưa có form assessment/citation/verification đầy đủ. Các thao tác đóng chỉ bằng ghi chú sẽ bị từ chối đúng quy tắc mới; Đợt 5 cần dùng hợp đồng API mới.
8. Không có cuộc điều tra, phán đoán nguyên nhân hoặc kết quả xử lý thực tế nào của lab được tạo trong đợt này; toàn bộ dữ liệu kiểm thử được đánh dấu giả lập.

## 9. Sẵn sàng cho Web B Đợt 5

- Danh sách theo nguồn với bộ lọc, version và ID ổn định.
- Trang chi tiết chung cho SQLite/Audit/Detection: facts, evidence/missing state, timeline, history có con trỏ, handler và kết quả Detection.
- Biểu mẫu nhận định có mức xác minh/citation, đề xuất tham vấn, liên kết kết quả thực thi, verification và cập nhật trạng thái.
- Hiển thị riêng dữ liệu nguồn / nhận định / đề xuất / kết quả; chỉ đánh dấu đã kiểm chứng khi `resolution.verified=true`.
- Xử lý 401/403/404/409/503, tải lại sau conflict; tránh tự retry cập nhật khi chưa đối chiếu version và lịch sử.
- Chuyển tới chức năng quản trị hiện có nếu người dùng được phép và chủ động quyết định thực thi; API điều tra không tự chạy các hành động này.

## 10. Bảo toàn và điểm dừng

Không reset/xóa PostgreSQL, SQLite đang dùng hoặc Docker volumes; không sửa credential, realm hay xác thực; không triển khai lab; không commit/push hoặc sửa lịch sử Git. Kết quả và nguồn giao diện/xác thực Đợt 1–3 được giữ nguyên. Các staged removal của Đợt 1 không thay đổi.

PostgreSQL test dùng tmpfs riêng, metadata có nhãn synthetic và cổng loopback. Sau nghiệm thu, chỉ dừng container test đã kiểm tra đúng ID/nhãn/mount; không remove container hoặc volumes của hệ thống. Kết quả/log được giữ tại `.runtime/phase4-tests`.

**Đợt 4 hoàn tất. Dừng, chờ người dùng cho phép Đợt 5.**
