# Kiểm thử và đọc kết quả

## Bộ mặc định an toàn

```powershell
cd D:\ZeroTrust
python -B scripts/test_phase6.py
```

Suite allowlist gồm Backend (JWT/RBAC/IDOR/session/nghiệp vụ/incident/retention), frontend/auth, Detection Python offline, đóng gói, review OIDC offline, guard cô lập, inventory và guard fixture; build A/B; browser auth, Web A, Web B đọc và workflow ghi incident.

Node test được nạp `tests/isolated-node.cjs`, chỉ cho SQLite memory/thư mục tạm và server loopback của cùng tiến trình, chặn dotenv/lab fetch. Runner lọc biến môi trường, không khởi động stack; browser chặn origin ngoài fixture. Dependencies cần có sẵn; browser dùng Chrome và `.tools/playwright/driver/package`. Nếu thiếu công cụ hoặc bị chặn tiến trình con, ghi FAIL/BLOCKED, không đổi số liệu thành PASS.

Output riêng ở `.runtime/phase6-tests/`: `summary.json`, log từng suite, `browser-results.json`, `workspace-browser-results.json`, `security-browser-results.json`, `incident-browser-results.json`, ảnh synthetic và build. Không lưu HAR, trace, token, cookie/storage state hoặc request body. Giữ nguyên output các đợt trước.

Chạy lại nhóm riêng khi có lý do:

```powershell
python -B scripts/test_phase6.py --build-only
python -B scripts/test_phase6.py --browser-only
python -B scripts/test_phase6.py --incident-browser-only
```

Browser-only cần build fixture Đợt 6 đã có. Inventory JSX dùng snapshot Đợt 5B vì Đợt 6 không sửa JSX; không sinh lại đè snapshot cũ chỉ để test đạt.

## Phân loại bằng chứng

| Loại | Chứng minh được | Không chứng minh được |
|---|---|---|
| Unit/offline | Rule, validation, JWT với khóa test, trạng thái, contract, guard, đóng gói | Cấu hình và hành vi của service lab hiện tại |
| Browser giả lập | Bản build thật, adapter và UI, OIDC/API fixture, responsive, lỗi | OTP đúng/sai/hết hạn thật hoặc client/realm live |
| Express + SQLite memory | Routing/RBAC/IDOR/audit/transaction/history và đóng sự cố bằng DB thật cô lập | PostgreSQL thực hoặc tài khoản thật |
| PostgreSQL fixture thật | SQL/migration/lock/rollback của service Audit trong tmpfs riêng | Lab/production hoặc toàn luồng browser với PostgreSQL |
| Probe lab chỉ đọc | Kết nối/public discovery/health/TLS tại thời điểm đo | Đăng nhập, MFA, quyền service account hoặc nghiệp vụ đã nghiệm thu |

Mock central qua gateway Express vẫn là mock central. Không cộng 28 test PostgreSQL chưa chạy vào PASS; kết quả Đợt 4 là lịch sử riêng.

## PostgreSQL riêng khi Engine sẵn sàng

Chỉ sau khi kiểm tra Docker hoạt động, image `postgres:17` và psycopg test đã có, được phép tạo fixture synthetic:

```powershell
python -B scripts/prepare_phase6_fixture.py --create
python -B scripts/test_phase6.py --postgres-only
python -B scripts/prepare_phase6_fixture.py --stop
```

Helper tạo container tên ngẫu nhiên, label test, tmpfs, cổng loopback; metadata riêng Đợt 6. Runner xác minh đúng ID/nhãn/mount/cổng và chỉ dùng DB/user fixture; không fallback database thật. Stop chỉ nhắm đúng fixture đã xác minh, không remove volumes. Không chạy các lệnh này khi Docker chưa khả dụng để suy ra PASS. Dependencies psycopg test hiện được runner tham chiếu từ `.runtime/phase4-tests/python-libs`; nếu thiếu, chuẩn bị dependency test riêng theo hợp đồng Đợt 4, không lấy cấu hình DB lab.

## Kiểm thử lab và các ca gây tác động

`inspect_phase6.py` chỉ GET public endpoint và đọc metadata/cổng. Không tự đăng nhập hoặc gọi Admin API. Chỉ thực hiện login/MFA/logout/khóa/revoke/đổi quyền/điều tra ghi bằng danh tính synthetic trong môi trường tách biệt. Login cũng tạo phiên/event, không coi là hoàn toàn chỉ đọc trên tài khoản thật.

Không đưa các script cũ `*_live.py`, `*_ui.py`, `week3_sso.py`, setup/restore/runner lab vào suite mặc định. Chúng có thể thay tài khoản/phiên, nạp dữ liệu, ngắt service hoặc dùng cách TLS không đủ để nghiệm thu. Nghiệm thu máy khách thứ hai cần thiết bị/hồ sơ trình duyệt và CA thật, không thay bằng hai cửa sổ trên cùng host.
