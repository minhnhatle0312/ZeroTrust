# Chạy nhanh ZeroTrust — bảo toàn dữ liệu đang dùng

Máy mới chưa có dữ liệu: dùng [hướng dẫn khởi tạo](docs/KHOI_TAO_MAY_MOI.md). `run_week3.py` không tự setup nữa; Backend kiểm tra ID trước khi nạp seed. Máy hiện có ID lệch cần đối soát riêng, không setup lại hoặc xóa SQLite.

Từ PowerShell tại `D:\ZeroTrust`:

```powershell
python -B scripts/inspect_phase6.py
python -B scripts/test_phase6.py
```

Lệnh đầu chỉ đọc cấu hình công khai/trạng thái; lệnh sau chạy test cô lập và build riêng. Không cần Docker cho suite mặc định; không khởi động Backend trên database lab.

Nếu báo `ENGINE_PIPE_MISSING`, mở Docker Desktop từ Start Menu, chọn Linux containers và chờ Engine hoạt động. Kiểm tra:

```powershell
docker --version
docker compose version
docker info --format '{{.ServerVersion}}'
```

Compose có phiên bản không đồng nghĩa Engine sẵn sàng. Nếu Desktop không lên, xem thông báo Troubleshoot/WSL/virtualization; không Factory reset, clean/purge, unregister distro hoặc xóa volumes. Desktop có thể tự khởi động lại container theo restart policy; chỉ mở khi được phép vận hành.

**Khởi động lab thật là bước riêng:** đọc [hướng dẫn khởi động](docs/HUONG_DAN_KHOI_DONG.md), xác nhận đúng cấu hình/overlay và backup được phê duyệt. `run_week10.py` có thể khởi động/cập nhật container; Backend có migration và collector. Không coi runner là lệnh kiểm tra chỉ đọc. Không chạy init/setup hoặc đổi localhost/LAN/credential để làm test đạt.

Development mặc định: Web A `http://localhost:5173`, Web B `http://localhost:5174`, Backend `127.0.0.1:3001`, Keycloak `localhost:8080`. HTTPS dùng `/a/`, `/b/` qua gateway đã cấu hình; không trộn hai chế độ.

Tài khoản được cấp qua kênh riêng; tài liệu không công bố mật khẩu/OTP. Xem [sử dụng](docs/HUONG_DAN_SU_DUNG.md), [quyền](docs/CHUC_NANG_VA_API.md), [nghiệm thu](docs/BAO_CAO_NGHIEM_THU_ZERO_TRUST.md). Không chạy các script `*_live.py`/`*_ui.py` cũ trên lab hiện tại để tạo minh chứng mới.
