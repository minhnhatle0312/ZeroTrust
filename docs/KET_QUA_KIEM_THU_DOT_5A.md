# Kết quả triển khai và kiểm thử Đợt 5A — Web B

Ngày thực hiện: 09/11/2026. Phạm vi: nâng cấp giao diện Web B và **xem hồ sơ sự cố**, sử dụng hợp đồng Đợt 4. Không triển khai Đợt 5B hoặc triển khai lên lab.

## 1. Chức năng đã hoàn thành

- Thống nhất Web B với Web A: nền slate, màu teal, sidebar tối, typography, thẻ số liệu, bảng, bộ lọc, khoảng cách, trạng thái focus và bố cục responsive. CSS mới giới hạn trong `.app-security`.
- Giữ các menu theo quyền hiện tại; bổ sung focus nội dung khi chuyển trang, tiếp tục hỗ trợ Ctrl+K, menu mobile, Escape và khôi phục focus khi đóng dialog.
- Dashboard mở được hồ sơ từ cảnh báo gần đây và bảng sự cố. Hai kho SQLite / PostgreSQL hiển thị riêng, không cộng số hồ sơ như số sự cố duy nhất.
- Danh sách sự cố: chọn kho, trạng thái, mức độ, nguồn sự kiện, mốc thời gian, khoảng ngày; lọc thêm bộ phát hiện đối với PostgreSQL. Phân trang theo API, chọn 10/20/50 dòng, làm mới, xóa bộ lọc, CSV các dòng đang hiển thị.
- SQLite tìm kiếm trên máy chủ. PostgreSQL tìm nội dung **trong trang hiện tại**, có ghi rõ phạm vi vì API Đợt 4 không hỗ trợ `q` cho danh sách incident PostgreSQL.
- Hồ sơ có sáu phần: tổng quan; nguồn và bằng chứng; diễn biến và lịch sử; nhận định nguyên nhân; đề xuất; hành động thực tế và kết quả kiểm chứng.
- Hiển thị đúng dữ liệu thiếu: thời điểm/tài khoản chưa ghi nhận, bằng chứng không khả dụng, lịch sử cũ không có bản chụp thay đổi, trạng thái xử lý cũ chưa được xác minh. Không tạo nguyên nhân hoặc thời gian thay thế.
- Phân biệt giả thuyết, nhận định có bằng chứng, kết luận do người điều tra ghi; đề xuất hệ thống / người điều tra chưa thực hiện; nhật ký thực thi; kết quả kiểm chứng; xác nhận khắc phục từ Backend.
- Timeline có liên kết bằng chứng, lịch sử mở rộng xem before/after và tải thêm bằng con trỏ. Nếu phiên bản sự cố thay đổi khi tải lịch sử, tải lại hồ sơ thay vì ghép các phiên bản khác nhau.
- Audit và Detection tra cứu hồ sơ bằng `event_id` gốc trùng khớp, sau đó mở trang sự cố. Giữ công cụ xem log, đặc trưng/gán nhãn, lịch sử lượt chạy, cấu hình và xuất CSV cũ.
- Loading, rỗng, lỗi API, 403, 404, lỗi phiên và mất kết nối có trạng thái rõ ràng. Hết phiên/mất kết nối vẫn do AuthGate Đợt 2 kiểm soát.
- Đường dẫn sâu: `/b/#/incident/sqlite/:id`, `/b/#/incident/audit/:id`. Có thể tải lại trang và quay về đúng kho danh sách.

Trang sự cố **không có biểu mẫu gửi đề xuất, thực hiện khắc phục, cập nhật trạng thái hoặc đóng sự cố**. Các công cụ quản trị tài khoản, nhãn Detection và quản trị Audit có sẵn vẫn giữ nguyên quyền; không tự chạy chúng.

## 2. Các lỗi và điểm không tương thích đã xử lý

| Phát hiện | Cách xử lý |
|---|---|
| Web B mở các hộp thoại kết luận cũ, chưa trình bày hồ sơ Đợt 4 | Chuyển điểm mở cảnh báo và tab incident Audit sang `IncidentList` / `IncidentDetail` chỉ đọc; không gọi API ghi incident |
| Tải lại URL hồ sơ làm mất đường dẫn qua bước khởi tạo OIDC | Lưu và tiêu thụ một lần đường dẫn incident đã kiểm tra định dạng; chỉ lưu mã hồ sơ, không lưu fragment callback/token. Không đổi luồng xác thực |
| Nút trở về từ hồ sơ PostgreSQL có thể về tổng quan Audit | Trở về danh sách sự cố với kho PostgreSQL được chọn |
| Bộ lọc Audit/Detection có thể giữ dữ liệu của truy vấn trước trong khi tải | Hook đọc xóa dữ liệu cũ khi bắt đầu yêu cầu; bỏ qua phản hồi sau khi component hoặc truy vấn thay đổi |
| Một số bộ lọc thiếu tên truy cập ngắn, rõ ràng | Bổ sung `aria-label`, focus rõ và vùng bảng cuộn được bằng bàn phím |
| Detection có thể lỗi render nếu danh sách luật chưa có | Hiển thị danh sách rỗng, không suy đoán luật |
| Trạng thái `resolved` dễ bị hiểu là khắc phục đã xác minh | Tách trạng thái hồ sơ với `detail.resolution.verified`; dữ liệu cũ vẫn cảnh báo chưa xác minh |

Không phát hiện lỗi tương thích cần sửa Backend API hoặc phân quyền trong phạm vi này.

## 3. API đã tích hợp

Tất cả API dùng API client và JWT hiện tại; không thêm endpoint.

| API đọc | Mục đích |
|---|---|
| `GET /api/security/alert-list` | Danh sách/lọc/tìm kiếm/phân trang cảnh báo SQLite |
| `GET /api/security/alerts/:id?historyLimit=25[&historyBefore=…]` | Hồ sơ SQLite, bằng chứng, timeline, nhận định, đề xuất, hành động, kiểm chứng và lịch sử |
| `GET /api/security/central/incidents` | Danh sách PostgreSQL; trạng thái, mức độ, nguồn, bộ phát hiện, thời gian, offset/limit; tra cứu liên kết theo event_id trả về |
| `GET /api/security/central/incidents/:id?historyLimit=25[&historyBefore=…]` | Hồ sơ PostgreSQL và lịch sử theo hợp đồng Đợt 4 |
| `GET /api/security/central/events`, `/events/:id`, `/summary`, `/health` | Giữ tra cứu Audit, log gốc, sự kiện liên quan, tổng quan và trạng thái |
| `GET /api/security/central/detection/status`, `/results`, `/evaluations` | Giữ Detection, lọc phân loại, đặc trưng, lượt phân tích và đánh giá độc lập |

Các API profile, dashboard, nhật ký cục bộ, thông báo và các phân hệ cũ tiếp tục được sử dụng như trước. Không thêm lệnh PATCH/POST xử lý sự cố.

## 4. File sửa và bổ sung

| File | Thay đổi |
|---|---|
| `web-b/src/App.jsx` | Điều hướng incident, tích hợp danh sách/hồ sơ và liên kết từ Dashboard/Audit/Detection; giữ menu và công cụ cũ |
| `web-b/src/main.jsx` | Gọi helper lưu đường dẫn incident hợp lệ trước khi AuthGate hiện tại khởi tạo |
| `web-b/src/IncidentWorkspace.jsx` **mới** | Danh sách, bộ lọc, hồ sơ sáu phần, timeline, bằng chứng, lịch sử, tra cứu liên kết sự kiện và trạng thái đọc |
| `web-b/src/security-data.mjs` **mới** | Mapping dữ liệu, định dạng thời gian UTC+7, truy vấn đúng hợp đồng hai kho, route, bảo vệ return route, liên kết event_id |
| `web-b/src/security.css` **mới** | Giao diện Web B, desktop/tablet/mobile, focus và reduced motion |
| `shared/central-audit.jsx` | Callback hồ sơ chỉ đọc cho Web B; liên kết từ event dialog; vùng bảng, retry và tránh giữ dữ liệu cũ |
| `shared/detection.jsx` | Liên kết incident từ kết quả/log gốc; nhãn bộ lọc; xử lý rules bị thiếu |
| `scripts/inventory_ui.cjs` | Thêm snapshot `--phase5a`; ghi rõ các helper kết luận cũ không còn được Web B gọi |
| `tests/inventory.test.cjs` | Chọn snapshot 5A khi kiểm thử 5A |
| `tests/security-view.test.mjs` **mới** | Hợp đồng truy vấn, thời gian, route/return route, bằng chứng, timeline, giới hạn tra cứu và lỗi |
| `tests/security-browser.cjs` **mới** | Browser Web B admin/auditor; tương tác đọc, lỗi, mobile và hồi quy |
| `tests/phase5a.vite.mjs` **mới** | Build fixture vào `.runtime/phase5a-tests`, không nạp `.env` lab |
| `scripts/test_phase5a.py` **mới** | Runner allowlist kiểm thử/build/browser cô lập, giữ các output đợt trước |
| `tests/fixtures/security-data.cjs` **mới** | Dữ liệu synthetic và dịch vụ Audit giả lập, chỉ dùng trong test |
| `tests/fixtures/workspace-backend.cjs` | Tùy chọn opt-in trỏ gateway Audit tới fixture loopback |
| `tests/fixtures/workspace-server.cjs` | Phục vụ build 5A, fixture Audit opt-in và seed SQLite trong bộ nhớ |
| `tests/auth-browser.cjs`, `tests/workspace-browser.cjs` | Chọn output 5A khi chạy hồi quy; giữ mặc định các đợt cũ |
| `docs/KIEM_KE_TUONG_TAC_DOT_5A.md`, `docs/interaction-inventory-phase5a.json` **mới** | Snapshot bổ sung: 29 mục menu, 45 nhóm, 20 form trong mã nguồn, 437 vị trí JSX/helper; không đồng nghĩa mọi form đang được gọi ở Web B |
| `docs/KET_QUA_KIEM_THU_DOT_5A.md` **mới** | Báo cáo này |

Không sửa mã Backend, Audit/Python, Web A, cấu hình Keycloak, JWT, RBAC hoặc shared authentication. `main.jsx` Web B chỉ thêm bảo toàn điều hướng; cấu hình, adapter và cơ chế đăng nhập giữ nguyên.

## 5. Môi trường và kết quả kiểm thử

Lệnh tổng hợp: `python -B scripts/test_phase5a.py`.

- Biến môi trường kiểm thử được dựng từ allowlist; không nạp `.env` lab hoặc `backend/server.js`.
- Backend thật dùng SQLite `:memory:`. Keycloak/OIDC và dịch vụ Audit trung tâm là fixture synthetic trên server loopback được cấp cổng tạm.
- Trình duyệt Chrome chạy bản build thật, chặn mọi yêu cầu tới origin khác. Không lưu HAR, trace, browser storage, request body hoặc token.
- Build cả hai Web bằng cấu hình fixture vào `.runtime/phase5a-tests/build`; không ghi `web-a/dist` hoặc `web-b/dist` đang có thể được phục vụ.

| Bộ kiểm thử | Kết quả |
|---|---|
| Backend: Audit, security, SSO, operations, week5–10, Đợt 2, incident Đợt 4 | **177/177 đạt** — gồm JWT, RBAC, IDOR và API incident cô lập |
| Frontend/auth/session/Workspace + contract Web B mới | **54/54 đạt** |
| Detection Python offline | **7/7 đạt** |
| Đóng gói/chặn dữ liệu nhạy cảm | **12/12 đạt** |
| Rà soát cấu hình OIDC offline | **7/7 đạt** |
| Guard cô lập Node | **7/7 đạt** |
| Kiểm kê JSX và kiểm tra snapshot 5A | **4/4 đạt**, snapshot khớp |
| Build Web A | **Đạt** |
| Build Web B | **Đạt** |
| Browser đăng nhập/SSO hồi quy | **25 kiểm tra đạt**, OIDC/Backend giả lập |
| Browser Web A hồi quy | **78 kiểm tra đạt**, Backend thật/SQLite trong bộ nhớ, IdP giả lập |
| Browser Web B | **93/93 kiểm tra đạt** — Express/SQLite thật trong bộ nhớ, OIDC và Audit trung tâm giả lập |

Tổng cộng **268 test cô lập và 196 kiểm tra browser đạt**, hai Web build đạt. `git diff --check` trên các file chỉnh sửa đạt. Nhật ký và kết quả: `.runtime/phase5a-tests/summary.json`, `browser-results.json`, `workspace-browser-results.json`, `security-browser-results.json` và `preservation.json` trong cùng thư mục.

Phân biệt bằng chứng: 177 test Backend xác minh logic Backend trong môi trường cô lập; 78 ca Web A và các ca SQLite Web B gọi Express/SQLite thật trong bộ nhớ. Các ca Audit/Detection PostgreSQL trên browser xác minh UI và gateway Express với **dịch vụ Audit giả lập**, không phải PostgreSQL/collector/Keycloak lab thật.

## 6. Phạm vi tương tác đã kiểm tra

| Nhóm | Phạm vi xác minh trong fixture |
|---|---|
| Điều hướng | Menu admin, ẩn menu admin đối với auditor, Ctrl+K, menu mobile, mở hồ sơ từ Dashboard/Audit/Detection, deep link/tải lại, trở về đúng kho |
| Danh sách | Hai kho, tìm kiếm đúng phạm vi, trạng thái/mức độ/nguồn/bộ phát hiện, ngày UTC+7 và khoảng đảo ngược, phân trang và page size, CSV theo dòng đang hiển thị, trạng thái rỗng |
| Hồ sơ | Sáu phần, dữ liệu thiếu/legacy, giả thuyết, đề xuất chưa thực hiện, nhật ký hành động, kiểm chứng chưa đủ kết luận |
| Bằng chứng/lịch sử | Mở bằng chứng chính xác, Escape/focus restore, nhảy tới phần bằng bàn phím, before/after, 31 bản ghi lịch sử với cursor, phát hiện phiên bản đổi khi tải thêm |
| Audit/Detection cũ | Tra cứu/phân trang Audit, chuẩn bị CSV, xem log và đặc trưng, lọc Anomaly, lịch sử lượt phân tích, trạng thái chưa có đánh giá độc lập; mở dialog nhãn nhưng không gửi thay đổi |
| Lỗi/quyền | 404; 403 chi tiết giả lập; hết phiên giả lập qua AuthGate; mất dịch vụ Audit giả lập và phục hồi; admin/auditor đọc API thật qua Backend |
| Responsive | Desktop 1440px; tablet 768px; mobile 390px và 320px, không tràn ngang toàn trang trong các ca đã đo; bảng có vùng cuộn riêng |
| Tính chỉ đọc của luồng mới | Không phát sinh lệnh ghi incident, khắc phục tài khoản hoặc thu hồi phiên từ các tương tác browser Đợt 5A |

Ảnh và JSON kiểm thử chỉ chứa dữ liệu synthetic, nằm trong `.runtime/phase5a-tests/`. Kiểm kê AST ghi vị trí control và chính sách/API; trường `NOT_RUN` lịch sử không được diễn giải thành kết quả browser hiện tại.

## 7. Giới hạn và các vấn đề chưa xác minh

- Chưa đăng nhập, SSO, MFA/TOTP, logout hoặc thu hồi phiên trên Keycloak thật trong Đợt 5A. Browser OIDC là giả lập; kết quả này không thay thế kiểm thử tích hợp IdP thật.
- Chưa kiểm thử Web B với PostgreSQL/Audit service/collector lab thật hoặc proxy/HTTPS production. Không chạy lại migration trên database thật. Mã Backend/Audit Đợt 4 giữ nguyên.
- Tra cứu incident từ sự kiện chỉ đối chiếu `event_id` **gốc** trả về trong danh sách, tối đa 2.000 hồ sơ; UI báo rõ khi chưa đầy đủ. Không suy đoán liên kết từ IP, username, hash hoặc coi chưa tìm thấy là không có quan hệ. Sự kiện bằng chứng bổ sung có thể chưa dẫn ngược tự động tới mọi hồ sơ liên quan.
- Tìm PostgreSQL chỉ trong trang; CSV danh sách sự cố chỉ xuất dòng đang hiển thị. Đây là phạm vi được hiển thị rõ, không phải tìm kiếm/xuất toàn bộ database.
- Bằng chứng hoặc thời điểm chưa được dữ liệu cũ ghi nhận tiếp tục hiển thị thiếu; giao diện không thể tự bổ sung sự thật lịch sử.
- Hồ sơ là bản chụp lúc tải; dùng “Tải lại chi tiết” để lấy phiên bản mới. Tự cập nhật 20 giây vẫn áp dụng tổng quan/danh sách hiện có. Trở về danh sách chọn đúng kho nhưng bộ lọc/phân trang có thể trở về mặc định khi component được mở lại.
- Kiểm tra các menu ngoài phạm vi sự cố là smoke điều hướng/render; không chứng minh tích hợp LDAP, quy trình vòng đời, quản trị tài khoản hoặc mọi biểu mẫu cũ hoạt động với dịch vụ thật. Không gửi thao tác tài khoản, retention, backfill, cấu hình hoặc batch Detection trong browser 5A.
- Chưa thực hiện audit accessibility đầy đủ bằng screen reader hay kiểm thử Safari/Firefox/thiết bị vật lý; đã kiểm tra bàn phím và kích thước viewport trên Chrome.

## 8. Bảo toàn và phần việc Đợt 5B

Giữ nguyên database/runtime hiện có, PostgreSQL, SQLite và Docker volumes. Không khởi chạy lab, reset realm, đổi credential, sửa lịch sử Git, commit hoặc push. Các báo cáo/snapshot Đợt 1–4 giữ nguyên. Không thêm mock vào ứng dụng thực tế; fixture mới chỉ được import từ test.

Đối chiếu SHA-256 với baseline nguồn/tài liệu công khai đầu Đợt 5A: **0 file được bảo vệ bị thay đổi** trong Backend, Audit/Python, Web A, các báo cáo cũ và shared authentication/Keycloak đã chọn. Git vẫn có 6.360 staged deletion từ thao tác bỏ theo dõi Đợt 1; không thêm thao tác xóa file hay chỉnh index. `git ls-files -ci --exclude-standard` trả về 0 mục. Nội dung DTO synthetic của fixture không xuất hiện trong bundle ứng dụng Web B.

Đợt 5B còn lại, **chưa triển khai**:

1. Biểu mẫu ghi nhận điều tra/nhận định và đề xuất có tham chiếu bằng chứng.
2. Ghi nhận/liên kết hành động thực tế, kết quả và phương pháp kiểm chứng theo API Đợt 4.
3. Cập nhật trạng thái/đóng sự cố với version, kiểm tra bằng chứng, xác nhận và xử lý xung đột.
4. Đánh giá tác động và quyền trước mọi hành động liên quan tài khoản/phiên; không biến đề xuất thành hành động tự động.
5. Kiểm thử ghi trong môi trường cô lập; kiểm thử tích hợp dịch vụ thật chỉ theo phạm vi được cho phép riêng.

Kết thúc Đợt 5A; dừng chờ cho phép Đợt 5B.
