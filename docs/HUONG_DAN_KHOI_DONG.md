# Khởi động và kiểm tra hệ thống

Source sau Đợt 6. Các lệnh khởi động trong tài liệu chưa được thực thi trên lab trong lượt nghiệm thu. Development/production phải được phân biệt trước khi vận hành.

**Bổ sung 12/11/2026:** máy mới đọc [quy trình khởi tạo mới](KHOI_TAO_MAY_MOI.md). Setup tuần 1/2/3 nay chặn khi có SQLite; `run_week3.py` không tự setup. Backend kiểm tra liên kết ID trước migration/seed/collector; có thể chạy `node backend/server.js --check-bootstrap` từ root để kiểm tra mà không ghi DB. Nếu môi trường hiện có lệch ID thì startup dừng, cần đối soát được phê duyệt; không chạy lại setup để vượt chặn.

## Kiểm tra trước khi chạy

1. Chạy `python -B scripts/inspect_phase6.py`. Metadata công khai ở `.runtime/phase6-tests/environment.json`; không in raw Compose config hoặc credential.
2. Kiểm tra đúng topology localhost hoặc HTTPS. Issuer, redirect URI, Web Origins và URL hai Web/API phải thống nhất. `.env.local` của Vite có ưu tiên hơn `.env`; runner có thể đặt env riêng. Cache gateway tồn tại không chứng minh gateway đang chạy.
3. Cần Node.js 22.19+, Python 3.11+, Docker/Compose và dependencies. Cài khi được phép bằng `npm.cmd ci` trong từng thư mục `backend`, `web-a`, `web-b`; không sửa lockfile để làm test đạt.
4. Chủ hệ thống xác nhận backup SQLite/PostgreSQL nhất quán trước nâng cấp. Không lấy database thật làm fixture, không restore/reset để thử.

## Docker chưa chạy

Đợt 6 quan sát: Docker CLI/Compose có sẵn, thiếu pipe `dockerDesktopLinuxEngine`, Docker service dừng, không thấy tiến trình Desktop. Đây là chưa có daemon, không phải bằng chứng database hỏng.

- Mở Docker Desktop từ Start Menu; chờ Engine running và đúng Linux container/context.
- Chạy `docker info --format '{{.ServerVersion}}'`. Sau khi thành công mới đọc `docker ps` và `docker compose ps`.
- Nếu còn lỗi, xem Desktop/WSL/virtualization với người quản trị. Không Factory reset, purge, unregister WSL hoặc xóa volumes. Việc mở Desktop có thể kích hoạt restart policy, nên thực hiện trong cửa sổ vận hành được phép.

## Stack đã cấu hình và có dữ liệu

Compose cơ bản chỉ có Keycloak/PostgreSQL danh tính. Stack đầy đủ còn dùng `directory/compose.week6.yml`, `audit/compose.week8.yml` và env riêng Audit. Không thay stack có overlay bằng một lệnh Compose cơ bản.

Sau khi được phép vận hành, đã kiểm tra dependencies/cấu hình/backup:

```powershell
cd D:\ZeroTrust
python scripts/run_week10.py
```

Chỉ dùng `python scripts/run_week10.py --network` nếu cấu hình hiện hành đã là HTTPS. Runner kiểm tra Directory/Audit, chọn overlay và không tự setup realm. Tuy vậy, Compose có thể tạo/cập nhật container; Backend mở/migrate SQLite, chuyển pending chưa xác nhận sang partial và chạy collector/đồng bộ theo lịch. Network mode build lại `dist` và chạy gateway. Không thực hiện những bước này trong test chỉ đọc trên dữ liệu thật.

Không tự gọi `init_env.py`, `setup_*`, `prepare_week*`, `configure_network.py`, `restore_*` hoặc CLI ghi LDAP. Chúng là provisioning/chuyển cấu hình/phục hồi, cần đánh giá tác động riêng.

## Kiểm tra sau khởi động được phép

### Tạm tắt job LDAP định kỳ trong phiên nghiệm thu

Chỉ dùng khi người vận hành đã duyệt tạm dừng job. Biến runtime `DIRECTORY_SYNC_ENABLED=false` không sửa `.env`, provider LDAP, JWT/RBAC/MFA hoặc các bước kiểm tra danh tính. Mặc định không đặt biến thì job vẫn bật; chỉ nhận chuỗi `true` hoặc `false`, giá trị khác làm startup dừng trước khi mở DB.

```powershell
Set-Location D:\ZeroTrust\backend
$env:DIRECTORY_SYNC_ENABLED = 'false'
node server.js
```

Log xác nhận: `Periodic LDAP sync: disabled (runtime)`. Không tạo timer cho job LDAP khi tắt. Chỉ job **định kỳ** bị tắt; thao tác đồng bộ thủ công và refresh hồ sơ khi tài khoản LDAP truy cập vẫn giữ hành vi/phân quyền cũ. Trong nghiệm thu local, không gọi sync hoặc đăng nhập LDAP khi chưa duyệt đối soát. Không chạy thêm Backend nếu cổng 3001 đã có process.

Sau khi kết thúc phiên chạy trong cửa sổ này, có thể bỏ biến runtime bằng `Remove-Item Env:DIRECTORY_SYNC_ENABLED` để lần khởi động sau dùng mặc định; không tự bật lại job trong lúc dữ liệu LDAP chưa được duyệt xử lý. Audit collector/delivery vẫn chạy và có thể thêm log hoặc cập nhật trạng thái retry; không xóa outbox để xử lý audit service mất kết nối.

| Thành phần | Kiểm tra |
|---|---|
| Docker | Container/health đúng project/overlay; không nhầm container test |
| PostgreSQL | Health của đúng DB danh tính/Audit; DB có thể chỉ nằm trong Docker network, không cần mở 5432 host |
| Keycloak | GET discovery công khai đúng issuer/origin; không cần gọi Admin API hoặc lấy token để chẩn đoán public endpoint |
| Backend | `/health` kiểm tra process; `/ready` kiểm tra phụ thuộc theo code, không thay cho nghiệm thu auth/MFA |
| Web A/B | Origin/base path/assets đúng; nút login chuyển đến Keycloak; không tạo dữ liệu thật để minh chứng |
| HTTPS | CA/SAN/hostname hợp lệ và máy khách tin cậy; không bỏ qua TLS rồi đánh dấu PASS |

Cổng thường dùng: 3001, 5173, 5174, 8080, Audit 8090, gateway 8443. Không kill tiến trình chiếm cổng tự động. Đọc cấu hình công khai trước khi đổi port.

## Dừng

Ctrl+C chỉ cho runner do chính phiên vận hành vừa mở. Dừng container phải xác định đúng stack và được phép. Không xóa volumes, reset realm/database hoặc thay credential khi chẩn đoán lỗi khởi động.
