# Kết quả Đợt 1 — Kiểm kê, bảo vệ repository và kiểm thử cô lập

Ngày thực hiện: **09/11/2026 (UTC+7)**. Chỉ thực hiện Đợt 1 theo phê duyệt của chủ dự án. Không thay đổi chức năng hoặc giao diện sản phẩm.

## Kết quả thực hiện

- Kiểm kê **29 mục trang/menu** (11 Web A, 18 Web B), **42 nhóm chức năng**, **19 mẫu form**, **387 vị trí JSX/helper tương tác** trong 13 file. Có chức năng, API, quyền, handler, điều kiện, giới hạn trường và trạng thái test. Những vị trí `.map()`/widget/helper có thể sinh nhiều control runtime, không coi 387 là số nút hiển thị trên trình duyệt.
- Danh mục đọc tại [KIEM_KE_TUONG_TAC.md](KIEM_KE_TUONG_TAC.md), dữ liệu có cấu trúc tại [interaction-inventory.json](interaction-inventory.json). `REVIEWED` là đã đọc mã; mọi UI/live Đợt 1 vẫn ghi `NOT_RUN`. Tham chiếu suite không tự chứng minh từng control đã chạy.
- Ngừng Git theo dõi **6.360 file** bị ignore thuộc môi trường riêng tư/runtime/dependencies/build/backup/evidence/cache. Toàn bộ **6.360 file vẫn tồn tại và metadata giữ nguyên** sau thao tác; không có file đã thiếu từ trước. Còn **0 file bị ignore nhưng vẫn tracked** tại thời điểm kiểm tra.
- Thao tác Git chỉ sửa index bằng `git rm --cached`. Các mục staged `D` là loại khỏi phiên bản Git tiếp theo, không phải xóa file trên máy. Không commit, push, sửa remote hoặc viết lại lịch sử. Source thay đổi của Đợt 1 chưa được tự động stage/commit.
- Sửa bộ đóng gói với bộ lọc độc lập Git ignore: loại `.env` riêng tư, key, SQLite/WAL/SHM/journal, backup, staff/audit, browser state, dữ liệu runtime và JSON chưa được khai báo là source. Chỉ giữ các template môi trường nguồn đã biết.
- Chuẩn bị runner và guard kiểm thử; chỉ dùng SQLite trong bộ nhớ/thư mục tạm và fake server, không sử dụng credential hoặc database lab.

Biên bản kỹ thuật không chứa nội dung riêng tư: `.runtime/phase1-tests/untrack-summary.json`, `summary.json` và log suite tại cùng thư mục. Chúng được Git bỏ qua.

Gói source thực tế có **173 file nguồn và một manifest**; kiểm tra toàn bộ tên entry, SHA-256 và CRC đạt, không có entry bị cấm. Các template môi trường được đóng gói không có trường credential được điền giá trị. Biên bản: `.runtime/phase1-tests/package-verification.json`; archive ở `backups/week10-source-*.zip`. Không đưa báo cáo Word/PDF/slide hoặc minh chứng runtime vào gói source.

## File đã sửa và thêm

| Loại | File |
|---|---|
| Sửa quy tắc Git và đóng gói | `.gitignore`, `scripts/package_week10.py` |
| Sửa liên kết/trạng thái tài liệu | `README.md`, `tuanconlai.md` |
| Thêm công cụ chỉ kiểm kê, chạy test và ngừng tracking an toàn | `scripts/inventory_ui.cjs`, `scripts/test_phase1.py`, `scripts/untrack_runtime.py` |
| Thêm guard/test | `tests/isolated-node.cjs`, `tests/isolation.test.cjs`, `tests/inventory.test.cjs`, `tests/test_packaging.py` |
| Thêm tài liệu và dữ liệu kiểm kê | `docs/KIEM_KE_TUONG_TAC.md`, `docs/interaction-inventory.json`, `docs/MOI_TRUONG_KIEM_THU_AN_TOAN.md`, `docs/KET_QUA_KIEM_THU_DOT_1.md` |

Không sửa mã sản phẩm trong backend/Web A/Web B/shared, cấu hình Keycloak đang dùng hoặc dữ liệu lab. Thư mục `.vscode/` có từ trước vẫn để nguyên. Những file bỏ tracking là thay đổi Git index riêng với source thay đổi ở bảng này.

## Kiểm thử Đợt 1

Lệnh chạy: `python -B scripts/test_phase1.py`.

| Phạm vi | Số ca | Kết quả |
|---|---:|---|
| Backend: bảo mật, audit, SSO, operations, tuần 5–10 | 130 | PASS |
| Tiện ích frontend/API client | 8 | PASS |
| Python Detection offline | 7 | PASS |
| Đóng gói source bằng fixture giả | 12 | PASS |
| Hàng rào môi trường/database/network | 7 | PASS |
| Bao phủ và truy vết kiểm kê | 4 | PASS |
| Kiểm kê sinh ra khớp mã nguồn (`--check`) | Kiểm tra riêng | PASS |

Tổng: **168 ca đạt**, không fail/skip trong lượt hoàn tất. 23 ca mới thuộc đóng gói, hàng rào kiểm thử và kiểm kê. Đây không phải 168 thao tác UI/live.

Test đóng gói xác nhận cả file đang tracked bất chấp `.gitignore` vẫn bị loại; không mở file riêng tư khi lọc; giữ nguyên fixture; manifest khớp nội dung; từ chối path traversal, Windows drive/ADS, symlink/parent link/hardlink và archive đã có. Key marker là chuỗi marker giả, không có private key hoặc credential thật trong fixture.

Sandbox ban đầu chặn Node tạo tiến trình con và thao tác thư mục tạm. Đã chạy lại runner có guard ngoài sandbox; lượt hoàn tất dùng môi trường cô lập như trên. Không đổi lỗi môi trường thành lỗi sản phẩm hoặc PASS giả.

## Phần không thực hiện và vấn đề còn lại

- Không chạy E2E/live có thao tác tài khoản hoặc dữ liệu thật; chưa kết luận toàn bộ nút/menu/form hoạt động trên hệ thống đang chạy. Minh chứng 08/11 vẫn là lịch sử riêng.
- Không chạy Docker/setup/restore, reset database/volume, thay mật khẩu/khóa, xóa audit hoặc áp dụng retention.
- Các bản credential/key/data đã nằm trong lịch sử Git vẫn còn ở lịch sử theo đúng yêu cầu. Bỏ tracking hiện tại không thu hồi bản đã chia sẻ. Không suy ra chúng đã bị lộ ra ngoài chỉ từ việc từng được tracked; cần đánh giá phạm vi chia sẻ riêng. Không tự xoay credential hoặc viết lại lịch sử.
- Luồng chi tiết sự cố còn phân tán; alert local thiếu history/version tương đương PostgreSQL; timeout đăng nhập A/B chưa thống nhất. Các vấn đề chức năng này chưa sửa trong Đợt 1.
- Auditor hiện được ghi nhãn Detection và snapshot/khuyến nghị review; cần chuẩn hóa tài liệu quyền ở đợt phù hợp.
- Các bộ browser có tác động dữ liệu và một số ca bỏ qua lỗi HTTPS; chưa chứng minh CA trên máy khách thứ hai. Chưa triển khai stack tích hợp kiểm thử riêng.
- Không khẳng định đạt mốc 6/6 hoặc sẵn sàng production từ kiểm thử cô lập này.

Hướng dẫn chạy lại và ranh giới dữ liệu: [MOI_TRUONG_KIEM_THU_AN_TOAN.md](MOI_TRUONG_KIEM_THU_AN_TOAN.md).

**Dừng sau Đợt 1. Đợt 2 và triển khai lab chưa được cho phép hoặc thực hiện.**
