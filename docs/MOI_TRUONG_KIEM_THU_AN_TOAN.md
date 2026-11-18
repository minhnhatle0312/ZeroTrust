# Môi trường kiểm thử an toàn — Đợt 1

Ngày chuẩn bị: 09/11/2026 (UTC+7). Phạm vi: kiểm thử cô lập, không vận hành lab.

## Chạy bộ kiểm thử

Từ thư mục repository, với Python, Git, Node.js và dependencies hiện có:

```powershell
python -B scripts/test_phase1.py
```

Runner không cài thư viện, không build frontend, không gọi provisioning/runner của lab, không khởi động Docker và không đọc `.env`.

Các suite được liệt kê cố định trong runner:

- Backend: `audit.test.js`, `security.test.js`, `sso.test.js`, `operations.test.js`, `week5-10.test.js`.
- Frontend: `frontend.test.mjs`, `api-client.test.mjs`.
- Python offline: `test_detection.py`.
- Đóng gói: `test_packaging.py`.
- Hàng rào môi trường: `isolation.test.cjs`.
- Kiểm kê: `inventory_ui.cjs --check`, `inventory.test.cjs`.

Không nhận tên script tùy ý từ CLI. Không đưa các suite `*_live.py`, `frontend_ui.py`, `operations_ui.py`, `week3_sso.py`, `session_directory_live.py` vào runner này.

## Ranh giới dữ liệu và mạng

- Mỗi lượt dùng một thư mục riêng dưới `.runtime/phase1-tests/run-*`; biến TEMP/TMP/TMPDIR của tiến trình con trỏ vào đó.
- Chỉ truyền các biến hệ thống cần thiết vào tiến trình con. Không truyền credential ứng dụng, NODE_OPTIONS, PYTHONPATH hoặc các override Git từ môi trường vận hành.
- Các test backend dùng SQLite `:memory:` hoặc database giả trong vùng tạm. Preloader từ chối mở SQLite ngoài vùng tạm và từ chối parent symlink thoát vùng đó.
- Preloader chặn `dotenv`, fetch và socket tới dịch vụ bên ngoài, kể cả backend thật ở localhost. Chỉ cho phép kết nối tới cổng loopback ngẫu nhiên do fake server của chính tiến trình test mở.
- Test đóng gói tạo repository Git và file fixture hoàn toàn giả trong vùng tạm. Không sao chép `.env`, database, key, staff hoặc audit thật làm fixture.
- Các guard là biện pháp bảo vệ bộ test được liệt kê, không phải sandbox chống mã độc tổng quát. Test mới phải được xem xét trước khi thêm vào runner.
- Node test có thể cần quyền tạo tiến trình con ngoài sandbox của công cụ. Quyền đó không thay đổi danh sách suite hoặc ranh giới dữ liệu nêu trên.

Log và kết quả chỉ có thông tin từ fixture, lưu dưới `.runtime/phase1-tests/` (Git bỏ qua). Thư mục tạm của lượt chạy thành công được dọn bởi `TemporaryDirectory`; các tệp dữ liệu đang dùng không thuộc phạm vi dọn dẹp này. Lượt bị sandbox chặn có thể để lại thư mục tạm phục vụ chẩn đoán; không tự xóa tài nguyên ngoài phạm vi đó.

## Kiểm kê và đóng gói

```powershell
node scripts/inventory_ui.cjs --check
python -B scripts/untrack_runtime.py
```

Hai lệnh trên chỉ kiểm tra. Lệnh đầu đối chiếu mã JSX với Markdown/JSON đã sinh. Lệnh thứ hai đếm file bị ignore nhưng vẫn tracked, không in nội dung file.

`untrack_runtime.py --apply` chỉ dùng khi đã được phép sửa Git index: gọi `git rm --cached` trên danh sách đã kiểm tra, giữ file trên máy, không sửa lịch sử/commit/push. Từ chối nếu danh sách có source ngoài phạm vi hoặc có staging liên quan từ trước. Script không đọc nội dung file riêng tư; chỉ so metadata trước/sau.

`package_week10.py` có bộ lọc riêng, không phụ thuộc file đã bị ignore hay còn tracked. Chỉ đóng gói mã/tài liệu văn bản và một số JSON/template cấu hình đã được khai báo rõ. Loại runtime/data/backup/evidence, credential, private key, database, WAL/SHM, browser state và file chưa được xem xét như nguồn. Báo cáo nhị phân Word/PDF/slide không thuộc gói source này. Chặn symlink/junction/hardlink, đường dẫn thoát workspace, nội dung SQLite/private-key marker bị đổi đuôi. Archive có sẵn không bị ghi đè. Nếu phát hiện nội dung không hợp lệ, script báo lỗi; archive chưa hoàn tất không có manifest thành công, không được bàn giao.

Không tự suy ra mọi source đều không có bí mật chỉ từ tên/đuôi file; đây không phải trình quét secret tổng quát. Phải review source trước khi chia sẻ ra ngoài.

## Các ca cần môi trường riêng ở đợt sau

E2E hiện tại có thể tạo user/đơn, thay role, đăng ký MFA, khóa/mở tài khoản, thu hồi phiên, đồng bộ collector, nạp audit giả hoặc ngắt LDAP. Chưa chuyển chúng sang runner an toàn này.

Trước khi chạy cần cấu hình đích kiểm thử riêng, dữ liệu giả và danh tính riêng; kiểm tra script không fallback sang `.env`/endpoint của lab. Không lấy database đang sử dụng làm fixture, không dựng hoặc reset stack chỉ để chạy lại minh chứng cũ. Triển khai stack tích hợp riêng chưa được thực hiện trong Đợt 1.
