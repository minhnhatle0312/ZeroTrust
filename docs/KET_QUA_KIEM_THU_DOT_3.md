# Kết quả triển khai và kiểm thử Đợt 3 — Web A

Ngày thực hiện: 09/11/2026, UTC+7. Phạm vi: nâng cấp giao diện và trải nghiệm Web A; sửa tương tác có bằng chứng từ mã nguồn và kiểm thử cô lập. Chưa triển khai lên lab.

## 1. Kết quả

- **227 kiểm thử cô lập đạt**, không có ca trượt trong lượt nghiệm thu cuối.
- **78 kiểm tra trình duyệt Web A đạt** với Chrome headless, bản build thật, API nghiệp vụ thật và SQLite `:memory:`; dịch vụ danh tính được giả lập.
- **25 kiểm tra hồi quy xác thực Đợt 2 đạt**, gồm Code/PKCE, SSO giả lập hai chiều, logout, hết phiên, từ chối quyền và mất kết nối.
- **Build Web A và Web B đạt**, không có cảnh báo build. Web B được build và kiểm tra xác thực để phát hiện ảnh hưởng từ component dùng chung.
- Snapshot tài liệu/kiểm kê Đợt 1 và Đợt 2, các file xác thực và App Web B được đối chiếu SHA-256: **16/16 file giữ nguyên**. Backend nghiệp vụ, API và logic phân quyền không chỉnh sửa.

Các số trên là ca kiểm thử/kịch bản, không phải số nút runtime được chứng nhận. Danh mục tĩnh sau chỉnh sửa có 29 mục trang/menu, 44 nhóm chức năng và 408 vị trí JSX/helper cho cả hai Web; cột `NOT_RUN` của Đợt 1 được giữ làm lịch sử.

## 2. Thay đổi UI/UX

### Khung giao diện và Dashboard

- Áp dụng bộ màu xanh teal, slate, nền sáng; thống nhất chữ, độ tương phản, đường viền, bo góc và khoảng cách bằng stylesheet chỉ áp dụng trong `.app-workspace`.
- Sidebar phân nhóm rõ, mục đang chọn dễ nhận biết; chuẩn hóa header, ô tìm chức năng, nút thao tác và thẻ tổng quan.
- Làm mới giao diện tổng quan quản trị, thẻ KPI, khu vực việc cần duyệt, bảng công gần đây và thẻ chấm công cá nhân.
- Giữ nguyên trang bắt đầu đăng nhập và toàn bộ cơ chế Keycloak của Đợt 2.

### Bảng công, đơn và quản lý nhóm

- Bảng công có tìm theo ngày hiển thị/tên/nhóm/trạng thái, bộ lọc đi muộn/đã kết thúc/đang ghi nhận, xóa bộ lọc, số kết quả và tên CSV có tháng.
- Xuất CSV gồm toàn bộ kết quả lọc đã tải, kể cả ngoài trang hiện tại; không xuất khi không có kết quả.
- Đơn cá nhân có tìm kiếm, lọc trạng thái, tiến trình xử lý, số kết quả, phân trang 10/20/50 đơn và empty state theo ngữ cảnh. Nêu rõ API trả tối đa 100 đơn gần nhất.
- Quản lý nhóm có KPI, danh sách thành viên thu gọn/mở rộng, tìm đơn cần duyệt, ghi chú và xác nhận bằng hành động duyệt/từ chối trong modal.
- Đơn của người quản lý được theo dõi ở mục cá nhân, không tính vào hàng chờ có thể tự duyệt. Phân quyền vẫn do API hiện có quyết định.

### Biểu mẫu, phản hồi và thao tác quan trọng

- Chấm công ra cần xác nhận tác động trước khi gửi API; hủy xác nhận giữ ca đang mở.
- Tạo đơn kiểm tra ngày, thứ tự giờ, thời gian tương lai trong ngày và lý do; có hướng dẫn, bộ đếm ký tự, trạng thái đang xử lý, phản hồi lỗi và giữ nội dung khi gửi thất bại.
- Gửi đơn thành công xóa lý do cũ để tránh tái sử dụng nhầm ở lần sau.
- Biểu mẫu nhân viên khớp giới hạn tên đăng nhập/email/nhóm của API, kiểm tra họ tên và yêu cầu mật khẩu tạm thời hiện có. Không thay chính sách mật khẩu hoặc cơ chế cấp danh tính.
- Web A yêu cầu xác nhận tác động trước khi lưu hồ sơ nhân viên; thay trường, vai trò hoặc lý do sẽ hủy xác nhận trước đó.
- Khi tải lại, thông báo rõ đang cập nhật và tạm ngăn tương tác với dữ liệu cũ; khi lỗi có nút tải lại. Thông báo thành công có thể đóng chủ động.

### Mobile và bàn phím

- Kiểm tra các bố cục cá nhân ở chiều rộng 320/390/768 px; quản lý nhóm, danh sách nhân viên và modal nhân viên ở 320 px; desktop ở 1440 px.
- Menu mobile đóng sau điều hướng; Ctrl+K, Escape, quay lại bằng trình duyệt và focus vào nội dung chính hoạt động.
- Vùng bảng cuộn có tên truy cập và nhận focus để cuộn bằng bàn phím; mobile có hướng dẫn cuộn ngang xem cột/thao tác.
- Bộ lọc nhân viên trên mobile xuống dòng để đọc đủ nhãn; modal nằm trong viewport, nút có kích thước phù hợp, giảm chuyển động theo thiết lập hệ điều hành.

## 3. Lỗi đã xác minh và khắc phục

| Vấn đề trước chỉnh sửa | Cách xử lý và bằng chứng |
|---|---|
| `DataTable` chỉ về trang đầu khi số kết quả thay đổi; đổi bộ lọc nhưng cùng số dòng có thể giữ trang cũ | Thêm `resetKey` cho bảng công và tài khoản. Browser xác nhận tìm kiếm giữ nguyên 25 kết quả vẫn trở về trang 1. |
| Danh sách đơn đã có dữ liệu nhưng lọc không ra vẫn báo “Chưa có đơn điều chỉnh” | Phân biệt không có dữ liệu và không có kết quả; có xóa bộ lọc. Browser xác nhận tìm/lọc trạng thái. |
| Tìm bảng công chỉ xét ngày ISO, chưa xét chuỗi ngày hiển thị | Thêm chuỗi ngày tiếng Việt vào nguồn tìm kiếm; vẫn giữ tìm ISO và tìm không dấu hiện có. |
| Form điều chỉnh chỉ kiểm tra thứ tự giờ ở client; có thể đề nghị giờ chưa xảy ra hôm nay | Kiểm tra cùng điều kiện ngày/giờ của API, kiểm tra lại lúc submit; unit test và browser xác nhận trường hợp giờ tương lai. API tiếp tục kiểm tra bằng giờ máy chủ. |
| Lý do của đơn vừa gửi còn trong form lần mở tiếp theo | Xóa sau khi API xác nhận thành công; browser xác nhận. Giữ nguyên khi có lỗi. |
| Bộ đếm đơn cần duyệt ở trang nhóm gồm cả đơn không được tự duyệt | Tách danh sách có thể xem xét và liên kết về đơn cá nhân; browser xác nhận không có nút tự duyệt. |
| Giới hạn tên đăng nhập/email trong form khác backend; form nhận tên một từ hoặc mật khẩu thiếu thành phần rồi mới báo lỗi từ API | Đồng bộ validation UI với quy tắc backend đang có; browser xác nhận tên một từ/thiếu mật khẩu không gửi được, dữ liệu hợp lệ tạo/cập nhật được trên fixture. |
| Dữ liệu cũ vẫn thao tác được trong lúc tải lại/lỗi tải | Tạm đặt vùng dữ liệu `inert`, giữ refresh/retry ở ngoài; browser xác nhận tải, lỗi và phục hồi. |

Thiếu xác nhận chấm công ra, thiếu phân trang thẻ đơn và thiếu hướng dẫn cuộn ngang là cải tiến UX; không coi là lỗ hổng mới hoặc thay đổi chính sách bảo mật.

## 4. Kết quả kiểm thử

Lệnh nghiệm thu: `python -B scripts/test_phase3.py`.

| Bộ kiểm thử | Kết quả |
|---|---:|
| Backend audit, security/JWT/RBAC/IDOR, SSO, operations, week5–10, phase2 | 144/144 đạt |
| Frontend utils/API/auth/session và validation Web A | 46/46 đạt |
| Python Detection offline | 7/7 đạt |
| Đóng gói và loại trừ dữ liệu nhạy cảm | 12/12 đạt |
| Rà soát OIDC offline | 7/7 đạt |
| Rào chắn cô lập database/network | 7/7 đạt |
| Độ phủ kiểm kê tương tác | 4/4 đạt |
| Kiểm tra snapshot kiểm kê Đợt 3 khớp nguồn | Đạt |
| Build Web A / Web B, cấu hình fixture và output riêng | Đạt / Đạt |
| Browser xác thực hồi quy Đợt 2 | 25/25 đạt |
| Browser Web A, backend thật + SQLite trong bộ nhớ | 78/78 đạt |

### Các tương tác đã chạy trong browser

| Nhóm | Đã xác minh với dữ liệu giả |
|---|---|
| Điều hướng | 11 mục menu Web A được mở; KPI quản trị chuyển đúng trang; Ctrl+K tìm chức năng; browser back; menu mobile; focus bàn phím. |
| Chấm công | Vào ca tạo đúng một bản ghi, xác nhận/hủy ra ca, ghi nhận giờ ra, chặn lặp sau hoàn thành. |
| Bảng công | Chọn tháng, 25 bản ghi, chuyển sang trang sau, chọn số dòng, reset trang khi tìm, sắp xếp ngày với `aria-sort`, lọc đi muộn, kết quả rỗng, vô hiệu CSV, nội dung CSV 12 bản ghi lọc; lịch mở chi tiết ngày. |
| Đơn cá nhân | Phân trang thẻ đơn, chọn số đơn, tìm/lọc/xóa lọc, validation giờ, lỗi API giữ nháp và retry chủ động, gửi pending, mở timeline, hủy/xác nhận rút, xóa lý do sau thành công. |
| Quản lý nhóm | Chỉ nhận nhóm được cấp, loại đơn chính mình khỏi hàng duyệt, tìm đơn, mở thành viên, bắt buộc ghi chú, duyệt cập nhật công và audit, từ chối không tạo công, empty state. |
| Nhân viên | Tìm, lọc vai trò/trạng thái, mở hồ sơ, validation tên, xác nhận tác động, lưu hồ sơ, khóa/mở, cập nhật danh sách sau lưu, xuất CSV, tạo nhân viên giả với credential sinh trong bộ nhớ. |
| Phản hồi | Loading và `inert`, lỗi tải có retry, retry phục hồi, toast, thông báo đánh dấu đã đọc và chuyển đúng mục. |
| Các trang phụ | Quyền cá nhân, hồ sơ/phiên, duyệt quyền và trung tâm bảo mật mở được, không có lỗi JavaScript; đây là smoke test, không chứng nhận mọi thao tác con. |
| Responsive | Không tràn chiều ngang toàn trang ở các viewport đã nêu; bảng nhân viên cuộn bằng bàn phím; modal mobile nằm trong viewport. |

Trong lượt browser cuối: **0 lỗi JavaScript ứng dụng, 0 yêu cầu tới dịch vụ thật**. Test fixture sử dụng route nghiệp vụ backend thật, nhưng OIDC/Keycloak và kết quả thao tác danh tính là giả lập. Việc ký/xác minh JWT thật được kiểm tra riêng trong backend suite, không suy ra từ IdP giả.

## 5. File chỉnh sửa và bổ sung

| File | Thay đổi |
|---|---|
| `web-a/src/App.jsx` | Ghép UI mới, loading/retry, validation đơn, xác nhận chấm công ra và xác nhận cập nhật nhân viên. |
| `web-a/src/WorkspacePanels.jsx` — mới | Bảng công, thẻ đơn/phân trang và quản lý nhóm. |
| `web-a/src/workspace.css` — mới | Theme Web A và bố cục desktop/mobile. |
| `web-a/src/workspace.mjs` — mới | Tiện ích trình bày thời gian và validation điều chỉnh công. |
| `shared/ui.jsx` | `resetKey`, vùng bảng cuộn có thể focus, gợi ý cuộn tùy chọn; focus điều hướng riêng Workspace. |
| `shared/admin.jsx` | Reset phân trang khi lọc tài khoản; nút xóa lọc/gợi ý cuộn được bật cho Web A. |
| `shared/operations.jsx` | Validation form nhân viên; xác nhận tác động được bật riêng qua prop Web A. |
| `scripts/inventory_ui.cjs` | Thêm `--phase3`, nguồn mới và snapshot riêng. Không ghi đè snapshot cũ. |
| `scripts/package_week10.py` | Cho phép đúng file JSON kiểm kê Đợt 3 đã rà soát; giữ các chặn dữ liệu nhạy cảm. |
| `scripts/test_phase3.py` — mới | Runner allowlist, môi trường sạch, lưu kết quả riêng, không dọn database thử nghiệm. |
| `tests/phase3.vite.mjs` — mới | Kế thừa fixture Đợt 2, build vào `.runtime/phase3-tests/build/`, không đọc `.env` lab. |
| `tests/workspace.test.mjs` — mới | 7 unit test validation ngày/giờ/lý do và tiện ích. |
| `tests/workspace-browser.cjs` — mới | Automation 78 kiểm tra trên Chrome. |
| `tests/fixtures/workspace-server.cjs` — mới | IdP giả, static build server, lỗi/delay có kiểm soát; chỉ bind loopback cổng động. |
| `tests/fixtures/workspace-backend.cjs` — mới | Backend thật, dữ liệu giả trong SQLite memory, identity adapter giả. |
| `tests/auth-browser.cjs` | Cho phép runner Đợt 3 ghi kết quả vào thư mục riêng; giữ kịch bản xác thực Đợt 2. |
| `tests/inventory.test.cjs` | Cho phép chọn snapshot Đợt 3 bằng biến môi trường của runner. |
| `docs/KIEM_KE_TUONG_TAC_DOT_3.md` — mới | Kiểm kê tĩnh cập nhật. |
| `docs/interaction-inventory-phase3.json` — mới | Nguồn truy vết máy đọc được, không chứa giá trị runtime. |
| `docs/KET_QUA_KIEM_THU_DOT_3.md` — mới | Báo cáo này. |

## 6. Bằng chứng và cách chạy lại an toàn

- Kết quả máy đọc: `.runtime/phase3-tests/summary.json`, `workspace-browser-results.json`, `browser-results.json`; log từng suite trong cùng thư mục.
- Ảnh đã xem: `workspace-admin-desktop.png`, `workspace-checkin-desktop.png`, `workspace-attendance-desktop.png`, `workspace-requests-desktop.png`, `workspace-team-desktop.png`, `workspace-users-desktop.png`, `workspace-mobile.png`, `workspace-users-mobile.png`. Ảnh chỉ dùng dữ liệu giả, không ghi trang có mật khẩu đã nhập.
- Runner bỏ môi trường credential của shell, chỉ giữ biến hệ điều hành cần thiết; rào chắn chặn dotenv, database ngoài thư mục test và socket/fetch tới dịch vụ không thuộc test. Browser abort yêu cầu ngoài origin fixture.
- Build vào thư mục test riêng; không ghi vào `web-a/dist`, `web-b/dist` hoặc output đang phục vụ lab. Giữ nguyên kết quả `.runtime/phase2-tests`.
- Runner giữ các thư mục `run-*` để đối chiếu, không có bước xóa đệ quy/database. Chạy riêng lại browser sau khi đã build: `python -B scripts/test_phase3.py --workspace-browser-only`.
- Kiểm tra kiểm kê: `node scripts/inventory_ui.cjs --phase3 --check`.

Lần chạy ban đầu trong sandbox Windows bị chặn tiến trình Node/esbuild; runner được chạy lại với quyền thực thi cần thiết. Một số truy vấn/chờ cập nhật React của test browser được sửa trong quá trình xây dựng fixture. Lượt nghiệm thu cuối đạt đầy đủ như bảng kết quả; không lấy các lần thử fixture thất bại làm kết quả sản phẩm.

## 7. Giới hạn và vấn đề chưa xác minh

- Chưa kiểm thử trực tiếp Keycloak/lab thật, OTP đúng/sai/hết hạn, LDAP, PostgreSQL audit tập trung, reverse proxy/HTTPS hoặc dữ liệu vận hành. Không thay credential và không dùng tài khoản thật.
- Browser dùng Chrome trên Windows; chưa xác minh Firefox, Safari, thiết bị iOS/Android thật hoặc screen reader. Có kiểm tra bàn phím/focus, chưa tuyên bố đạt đầy đủ WCAG.
- Các màn hình bảo mật, quyền truy cập, hồ sơ/phiên và duyệt quyền chỉ smoke test phần mở trang ở Đợt 3; chưa chạy hết bộ lọc, modal hoặc thao tác con của chúng. Không chạy khôi phục MFA, reset mật khẩu, đồng bộ danh tính, retention/xóa log hay thu hồi phiên thật.
- Giới hạn 100 đơn gần nhất là hành vi API hiện hữu; phân trang mới chỉ áp dụng tập đã tải, chưa bổ sung API lịch sử dài hạn.
- Validation ngày/giờ phía trình duyệt phụ thuộc đồng hồ máy người dùng. Backend vẫn là nguồn quyết định; nếu đồng hồ client lệch, cần đối chiếu giờ máy chủ thay vì nới chính sách.
- Các giới hạn về trang sự cố hợp nhất, lịch sử kết luận cảnh báo và kiểm chứng Zero Trust production trong báo cáo Đợt 1/2 vẫn chưa nằm trong phạm vi đợt này.
- Không còn ca trượt trong phạm vi nghiệm thu đã chạy; điều đó không chứng nhận tất cả tương tác của toàn bộ repository.

## 8. Bảo toàn và điểm dừng

Không xóa/reset PostgreSQL, SQLite đang sử dụng, Docker volumes hoặc dữ liệu runtime; không đổi mật khẩu/khóa thật; không sửa realm, API hay RBAC; không commit/push và không triển khai lab. Git vẫn không theo dõi file bị ignore; 6.360 mục đã bỏ theo dõi từ Đợt 1 được giữ nguyên trạng thái index. Không sửa lịch sử Git.

**Đợt 3 hoàn tất. Dừng tại đây, chờ người dùng cho phép Đợt 4.**
