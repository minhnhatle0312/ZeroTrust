# Kết quả triển khai và kiểm thử Đợt 5B

Ngày thực hiện: 09/11/2026. Phạm vi: Web B ghi hồ sơ điều tra, bổ sung đề xuất, liên kết hành động đã ghi nhận, xác minh và yêu cầu cập nhật trạng thái theo API Đợt 4. Không triển khai lab hoặc Đợt 6.

## 1. Chức năng hoàn thành

| Chức năng | Hành vi đã triển khai |
|---|---|
| Nhận định nguyên nhân | Nội dung, mức `hypothesis/supported/confirmed/refuted`, bằng chứng nguồn đã có hoặc mã bổ sung cần Backend xác minh. Mức ngoài giả thuyết yêu cầu citation. |
| Đề xuất | Bổ sung đề xuất có căn cứ bằng `recommendation`; luôn phân biệt chưa thực hiện. API hiện tại append đề xuất, không sửa/xóa đề xuất cũ; hướng dẫn ghi rõ nội dung thay thế khi cập nhật ý kiến. |
| Hành động xử lý | Liên kết bản ghi có thật bằng `actionRefs`. SQLite có bộ chọn nhật ký, chỉ hiển thị đúng target user ID trong trang đang đọc; PostgreSQL nhận mã sự kiện thực thi Audit. Người thực hiện, thời gian và kết quả/phản hồi lấy từ bản ghi nguồn sau khi Backend xác nhận. |
| Xác minh | Nhập phương pháp, `passed/failed/inconclusive`, `ALLOW/DENY` mong đợi và tham chiếu bằng chứng. Có tùy chọn yêu cầu đóng cùng lần xác minh; không tạo sự kiện kiểm tra mới. |
| Đóng/cập nhật trạng thái | Chỉ gửi `open/reviewing/resolved/false_positive`. Thiếu bằng chứng gốc hoặc thiếu kiểm chứng đạt có thông báo chặn đóng. Điều kiện cuối cùng vẫn do Backend kiểm tra; chỉ hiển thị khắc phục đã xác minh từ `detail.resolution.verified`. |
| Người thực hiện/lịch sử | Không có ô tự khai actor/time/request ID. Backend xác định các trường này và lưu history; sau phản hồi thành công, đọc lại hồ sơ/timeline/lịch sử. |
| Quyền | Nút điều tra chỉ dành cho admin theo profile; auditor tiếp tục xem. Backend tiếp tục chặn auditor/employee/manager ghi cả hai kho; không đổi JWT, Keycloak hoặc RBAC. |
| UX | Dialog đồng bộ Đợt 5A, validation độ dài/citation/giới hạn body, focus thông báo lỗi và phần xác nhận, loading, nút khóa khi gửi, xác nhận trước mỗi lần ghi, cảnh báo bỏ bản nháp, desktop/mobile. |

**Giới hạn nghiệp vụ được tuân thủ:** API không hỗ trợ tạo nhật ký thực thi tùy ý từ văn bản tự khai. Form hành động liên kết kết quả đã tồn tại; không có ô tạo kết quả/thời gian giả hoặc nút tự chạy biện pháp khắc phục. `Đang xử lý` và `chờ xác minh` là diễn tiến trong hồ sơ đang `reviewing`, không được tạo thành enum API mới.

## 2. Xử lý lỗi, phiên bản và tính toàn vẹn

- Mỗi cập nhật có `version` đang được đối chiếu và `note`; chỉ gửi trường thuộc loại cập nhật người dùng chọn, không gửi lại toàn bộ metadata.
- Trước khi ghi, hiển thị loại cập nhật, version, nội dung, bằng chứng, mã hành động và trạng thái yêu cầu để xác nhận.
- API lỗi không đóng form hoặc xóa bản nháp. 403 khóa ghi tiếp; 400/404 cho sửa nội dung/citation. Backend trả lý do thực tế trong phạm vi thông tin API cung cấp.
- 409 khóa gửi tiếp, giữ bản nháp. Người dùng đọc phiên bản mới, xem trạng thái/người xử lý/nhận định/lịch sử gần nhất và phải xác nhận đã đối chiếu trước khi chuẩn bị gửi lại. Không tự cộng version hoặc tự retry mutation.
- Lỗi 5xx/mạng hoặc phản hồi không xác nhận version được xem là chưa chắc chắn về kết quả. Yêu cầu đọc lại hồ sơ và lịch sử trước quyết định tiếp theo; không biến lỗi thành thông báo thành công.
- Nếu mutation được Backend xác nhận nhưng lần đọc lại lỗi, chỉ thông báo phần ghi đã được xác nhận; trạng thái khắc phục không suy ra từ nút bấm hoặc HTTP thành công. Cần đọc lại detail để biết `resolution.verified`.
- Cảnh báo khi API có thể xóa verification hiện hành do cập nhật hồ sơ đang mở/điều tra; lịch sử cũ vẫn do Backend lưu. Đề xuất cũ không bị ghi đè.
- Bản nháp chỉ ở bộ nhớ component, không ghi token, nội dung form hoặc credential vào storage/log. Mất kết nối vẫn dùng cơ chế giữ ứng dụng của AuthGate Đợt 2; phiên bị chấm dứt vẫn tuân theo chính sách xác thực hiện tại.

## 3. API tích hợp

Không thêm endpoint hoặc thay đổi Backend.

| API | Cách dùng |
|---|---|
| `PATCH /api/security/alerts/:id` | Gửi `version`, `note` và assessment/recommendation/actionRefs/verification; dùng `status` khi yêu cầu đổi trạng thái SQLite. |
| `POST /api/security/central/incidents/:id` | Hợp đồng tương ứng cho PostgreSQL, dùng `state`; actor/request ID do gateway xác định. |
| `GET /api/security/alerts/:id?historyLimit=25` | Đọc lại kết quả, đối chiếu version và lịch sử SQLite. |
| `GET /api/security/central/incidents/:id?historyLimit=25` | Đọc lại hồ sơ PostgreSQL, history, kết quả và handler. |
| `GET /api/security/actions?page=…&limit=50` | Chọn hành động đã ghi; lọc đúng `target_id` ở giao diện, Backend tiếp tục kiểm tra phạm vi khi liên kết. |

Các API danh sách, bằng chứng, timeline và phân trang lịch sử của Đợt 5A giữ nguyên. Không gọi API khóa tài khoản, thu hồi phiên, reset mật khẩu hoặc thực thi khắc phục từ luồng mới.

## 4. File sửa/bổ sung

| File | Nội dung |
|---|---|
| `web-b/src/IncidentEditor.jsx` — mới | Dialog ghi hồ sơ, xác nhận, bộ chọn bằng chứng/hành động, giữ draft, xử lý 403/409/5xx và đối chiếu phiên bản. |
| `web-b/src/incident-editor.mjs` — mới | Tạo body theo đúng kho/loại cập nhật; validation, citation, version, trạng thái và giới hạn UTF-8. |
| `web-b/src/IncidentWorkspace.jsx` | Mở editor theo quyền, phản hồi lưu và đọc lại detail; giữ phần đọc Đợt 5A. |
| `web-b/src/App.jsx` | Truyền quyền admin vào hồ sơ sự cố. |
| `web-b/src/security.css` | Form, fieldset, evidence picker, bước xác nhận/đối chiếu và responsive. |
| `scripts/inventory_ui.cjs` | Snapshot `--phase5b`, nhóm biểu mẫu điều tra, giữ snapshot cũ. |
| `tests/inventory.test.cjs` | Chọn snapshot 5B khi runner yêu cầu. |
| `tests/incident-editor.test.mjs` — mới | 7 test hợp đồng mutation, bằng chứng, giới hạn, trạng thái, đóng và không tạo actor/kết quả thực thi giả. |
| `tests/incident-browser.cjs` — mới | Workflow ghi SQLite thật trong bộ nhớ; quyền, validation, đóng đạt/trượt, xung đột, phản hồi mất sau commit, auditor và central giả lập. |
| `tests/fixtures/incident-write-data.cjs` — mới | Seed dữ liệu synthetic trong bộ nhớ và mô phỏng mutation Audit; chỉ được dùng bởi test. |
| `tests/fixtures/workspace-server.cjs` | Opt-in fixture 5B, đường dẫn build riêng, helper request kiểm thử giới hạn trong API incident loopback. |
| `tests/auth-browser.cjs`, `tests/workspace-browser.cjs` | Chọn output Đợt 5B, giữ mặc định cũ. |
| `tests/security-browser.cjs` | Chạy lại bộ Đợt 5A vào output 5B; chờ dữ liệu phân trang hoàn tất trước khi assert. |
| `tests/phase5b.vite.mjs` — mới | Build vào `.runtime/phase5b-tests`, dùng endpoint fixture và envDir rỗng. |
| `scripts/test_phase5b.py` — mới | Runner allowlist offline/build/browser; tùy chọn PostgreSQL riêng yêu cầu fixture đã xác minh. |
| `scripts/prepare_phase5b_fixture.py` — mới | Tái dùng helper tmpfs đã có, metadata riêng 5B, không đụng metadata/container Đợt 4. Chưa chạy tạo container trong đợt này. |
| `tests/test_incidents.py` | Cho phép đọc metadata fixture 5B khi runner đặt rõ phase; giữ mặc định Đợt 4 và các ràng buộc kết nối test. |
| `docs/KIEM_KE_TUONG_TAC_DOT_5B.md`, `docs/interaction-inventory-phase5b.json` — mới | Snapshot bổ sung: 29 mục menu, 46 nhóm, 475 vị trí JSX/helper; form cũ trong source không đồng nghĩa được gọi trong workflow mới. |
| `docs/KET_QUA_KIEM_THU_DOT_5B.md` — mới | Báo cáo này. |

Không sửa mã Backend/Audit, migration, cấu hình Keycloak, JWT, RBAC, shared authentication hoặc Web A. Báo cáo/snapshot cũ giữ nguyên.

## 5. Kiểm thử

Lệnh đã chạy: `python -B scripts/test_phase5b.py`.

Môi trường: Express thật, SQLite `:memory:`, OIDC giả lập, dịch vụ Audit trung tâm giả lập trên loopback. Browser Chrome dùng bản build thật và chặn yêu cầu ra origin khác. Không nạp `.env` lab, không chạy `backend/server.js`, không lưu HAR/trace/token/request body. Build vào `.runtime/phase5b-tests/build`, không ghi hai thư mục `dist` đang có.

| Bộ kiểm thử | Kết quả |
|---|---|
| Backend Audit/security/SSO/operations/week5–10/Đợt 2/incident Đợt 4 | 177/177 đạt — gồm JWT, RBAC, IDOR, API, version/history và điều kiện đóng. |
| Frontend/auth/session/Workspace/Đợt 5A/editor mới | 61/61 đạt. |
| Python Detection offline | 7/7 đạt. |
| Đóng gói/chặn dữ liệu nhạy cảm | 12/12 đạt. |
| Review OIDC offline | 7/7 đạt. |
| Guard cô lập Node | 7/7 đạt. |
| Kiểm kê coverage + snapshot | 4/4 đạt; snapshot 5B khớp. |
| Guard PostgreSQL fixture | 5/5 đạt, bằng fixture kiểm thử guard; không kết nối PostgreSQL thật. |
| Build Web A / Web B | Đạt / đạt. |
| Browser auth/SSO hồi quy | 25 kiểm tra đạt, IdP/Backend giả lập. |
| Browser Web A hồi quy | 78 kiểm tra đạt, Express/SQLite trong bộ nhớ và IdP giả lập. |
| Browser Web B Đợt 5A hồi quy | 93 kiểm tra đạt. |
| Browser workflow Đợt 5B | 40/40 kiểm tra đạt; kết quả chi tiết tại `.runtime/phase5b-tests/incident-browser-results.json`. |
| PostgreSQL incident/migration thật (28 test Đợt 4) | **Chưa chạy lại**: Docker Engine không khả dụng; không khởi động Docker/lab hoặc fallback database đang dùng. |

Lượt tổng hợp cuối: **280 test cô lập, 236 kiểm tra browser đạt, build hai Web đạt**; không có suite trượt trong 15 mục của `summary.json`. `git diff --check` trên các file chỉnh sửa đạt. Không tính 28 test PostgreSQL chưa chạy vào số test đạt.

Các ca workflow mới xác minh:

- Backend thực tế từ chối auditor, employee và manager ghi cả hai kho; auditor đọc nhưng không có editor.
- Nhận định có citation lưu actor/time từ Backend; history append và timeline đọc lại sau lưu.
- Bổ sung rồi sửa ý kiến bằng đề xuất mới, giữ đề xuất trước, không đánh dấu đã thực hiện.
- Chọn/liên kết hành động đúng target; hiển thị kết quả đã ghi; từ chối action hoặc evidence khác danh tính.
- Thiếu citation bị chặn ở form; bằng chứng không đúng quyết định bị Backend từ chối và draft được giữ.
- Đóng SQLite thành công với probe độc lập sau hành động synced/confirmed; chỉ hiển thị verified sau đọc lại.
- Reopen giữ history và làm verification hiện hành cần đánh giá lại; đóng chỉ bằng trạng thái thiếu kiểm chứng bị chặn.
- Backend từ chối đóng khi đã liên kết hành động còn partial; UI không hiển thị thành công và khóa gửi tiếp theo 409.
- Xung đột với cập nhật của người điều tra khác: giữ draft, đọc version/history mới, yêu cầu xác nhận đã đối chiếu rồi mới gửi lại có chủ ý.
- Mô phỏng mất phản hồi 503 **sau khi mutation thật đã commit trong SQLite memory**: version chỉ tăng một lần, draft giữ nguyên, không tự gửi lại.
- Mô phỏng 403 khi đang mở form: giữ nội dung để xem, chặn ghi tiếp; không chuyển lỗi thành thành công.
- Kiểm tra dialog mobile 390px; các thao tác desktop chạy ở 1440px. Hồi quy 5A tiếp tục kiểm tra viewport 320/390/768/1440px và bàn phím.
- Kiểm tra central POST qua gateway Express, lưu/read-back và đóng với dịch vụ Audit **giả lập**. Đây không phải bằng chứng validation SQL/row lock/transaction PostgreSQL thật.
- Không gọi endpoint khắc phục tài khoản hoặc thu hồi phiên; không có lỗi JavaScript ứng dụng hoặc yêu cầu tới dịch vụ thật trong ca browser.

Kết quả/log/ảnh synthetic lưu tại `.runtime/phase5b-tests/`: `summary.json`, `browser-results.json`, `workspace-browser-results.json`, `security-browser-results.json`, `incident-browser-results.json`, `incident-editor-mobile.png`. Không ghi đè output Đợt 1–5A.

## 6. Lỗi còn tồn tại và giới hạn chưa xác minh

1. Chưa kiểm thử trực tiếp Keycloak/MFA/SSO/logout và dịch vụ Audit/PostgreSQL/collector/proxy/HTTPS lab thật trong đợt này. Không suy nghiệm thu production từ fixture.
2. PostgreSQL Engine không sẵn sàng nên chưa chạy lại 28 test PostgreSQL thật; kết quả Đợt 4 vẫn là bằng chứng lịch sử, không được tính lại là PASS Đợt 5B. Runner có `--postgres-only` và helper metadata riêng để chạy khi có môi trường cô lập phù hợp.
3. API chỉ append đề xuất và liên kết bản ghi hành động đã tồn tại; không hỗ trợ sửa/xóa đề xuất cũ, nhập nhật ký thực thi bên ngoài hoặc tự tạo probe kiểm tra. Các khả năng đó chưa được thêm vào Backend.
4. SQLite và PostgreSQL không có transaction phân tán. Khi lỗi sau commit, chỉ đọc version/history mới có thể giúp đối chiếu; không có retry/idempotency tự động cho mutation.
5. Gateway Audit hiện chuẩn hóa một số lỗi 400 thành thông báo chung. Form nêu các điều kiện cần kiểm tra nhưng không tự khẳng định nguyên nhân cụ thể khi API không trả chi tiết. Backend vẫn có toàn quyền từ chối.
6. Evidence chi tiết tối đa 500, tra cứu liên kết incident từ event gốc tối đa 2.000 và tìm PostgreSQL trong trang là giới hạn Đợt 4/5A, chưa thay đổi. Bộ chọn hành động SQLite lọc đúng target trong từng trang 50 bản ghi nguồn; có thể cần duyệt nhiều trang hoặc nhập mã đã có.
7. Draft được giữ khi lỗi mạng/API trong phiên component còn tồn tại; không lưu bền qua đóng tab, điều hướng bỏ trang hoặc phiên bị chấm dứt. Có cảnh báo trước khi bỏ bản nháp, không lưu nội dung điều tra vào browser storage.
8. Chưa audit screen reader đầy đủ, Safari/Firefox hoặc thiết bị vật lý. Không kiểm thử tác động thật của quản trị tài khoản, retention, backfill hoặc batch Detection.

Không có lỗi chức năng chưa xử lý trong các ca SQLite/UI đã đạt nêu trên; các giới hạn tích hợp được giữ tách riêng.

## 7. Bảo toàn và phần việc Đợt 6

Không xóa/reset PostgreSQL, SQLite hoặc Docker volumes; không đổi credential, chính sách, realm hay JWT/RBAC; không commit, push hoặc triển khai lab. Các bản ghi hành động/probe trong browser mới là seed synthetic trong SQLite memory, không phải dữ liệu vận hành. Không có biện pháp khắc phục nào được tự động thực hiện.

Đối chiếu baseline SHA-256 177 tệp công khai: 0 tệp được bảo vệ trong Backend/Audit/Web A/shared authentication/cấu hình Keycloak phía Web B/báo cáo và snapshot cũ bị thay đổi. Git vẫn có 6.360 staged removal từ Đợt 1; không chỉnh index hoặc xóa file đang dùng. Số file riêng tư/runtime còn bị Git theo dõi theo ignore hiện tại: 0. Dấu kiểm bảo toàn và phân loại kiểm thử lưu tại `.runtime/phase5b-tests/preservation.json`; nội dung fixture synthetic không xuất hiện trong bundle Web B.

Đợt 6 cần được cho phép riêng trước khi làm:

1. Chạy lại PostgreSQL thật trong fixture tmpfs được kiểm tra ID/nhãn/cổng; kiểm thử UI với dịch vụ Audit thật trong môi trường cô lập.
2. Kiểm thử tích hợp Keycloak, MFA/SSO, vòng đời phiên và proxy/HTTPS theo môi trường được cấp phép; không dùng tài khoản thật cho thử nghiệm gây tác động.
3. Đánh giá idempotency/kết quả không chắc chắn giữa hai kho, lỗi Audit cần thông báo chi tiết an toàn hơn và quy trình đối chiếu sau lỗi commit.
4. Đánh giá phân trang evidence, liên kết ngược sự kiện và lọc hành động theo target ở server khi dữ liệu lớn.
5. Accessibility, trình duyệt/thiết bị bổ sung và nghiệm thu vận hành theo tiêu chí được thống nhất sau.

Đợt 5B kết thúc; dừng chờ cho phép Đợt 6.
