# Nhịp IAM — Keycloak và Zero Trust

Lab quản lý danh tính với Keycloak, Web A chấm công và Web B giám sát an ninh. Tiến độ theo từng giai đoạn ở [tiendo.md](tiendo.md).

Đã bổ sung 19 API và các luồng: tạo/sửa nhân viên, đổi role/nhóm, mật khẩu tạm thời, kết thúc từng phiên, chuông thông báo, rút đơn, tra cứu audit theo ngày trên toàn bộ lịch sử đã lưu và cảnh báo đăng nhập Keycloak thất bại. Xem [chức năng và API](docs/CHUC_NANG_VA_API.md).

| Thành phần | Vai trò |
|---|---|
| `web-a` | Nhịp Workspace — chấm công, đơn điều chỉnh, quản lý nhóm |
| `web-b` | Nhịp Security — cảnh báo, nhật ký, quản lý tài khoản theo quyền |
| `backend` | Xác minh JWT, RBAC, giới hạn theo ứng dụng, xác nhận phiên SSO, SQLite và audit |
| `keycloak` / Docker Compose | Keycloak và PostgreSQL lưu danh tính |
| `network/gateway.js` | Cổng HTTPS cho hai Web qua LAN/VPN riêng |

## Tuần 5 — mã nguồn đã bổ sung, chờ kiểm thử

Đã thêm MFA/required actions, bảo mật hồ sơ, quản lý refresh/phiên, đối chiếu đồng bộ, collector checkpoint, lịch công và Analytics/ma trận quyền. Có công cụ backup–setup–rollback và profile Keycloak production-like độc lập. **Chưa chạy test/build hoặc áp dụng flow mới lên lab trong lượt triển khai này.** Số liệu kiểm thử cũ không xác nhận mã tuần 5.

- [Chi tiết và cách áp dụng tuần 5](docs/TUAN_5_TRIEN_KHAI.md).
- [Danh mục nghiệm thu để thực hiện sau](docs/TUAN_5_NGHIEM_THU.md).

Chạy source bằng `python scripts/run_week5.py` (hoặc thêm `--network` sau khi cấu hình LAN). Áp dụng TOTP là bước riêng bằng `python scripts/setup_week5.py`, có backup bắt buộc và mặc định chọn hai user MFA riêng. Không tự áp dụng MFA khi chỉ chạy runner.

## Bắt đầu

Yêu cầu Docker Desktop đang chạy, Node.js 22.19+, Python 3.11+. Cài dependencies trong `backend`, `web-a`, `web-b` bằng `npm.cmd ci`.

```powershell
python scripts/init_env.py
python scripts/configure_network.py --local
python scripts/run_week3.py
```

Mở Web A tại `http://localhost:5173/`, Web B tại `http://localhost:5174/`. Dùng các tài khoản demo và mật khẩu được tạo trong `.env` trên máy chủ. Web B chỉ dành cho `admin01` và `auditor01`; quản lý/nhân viên vẫn dùng Web A theo quyền.

Để truy cập bằng máy khác, làm theo [kết nối hai máy qua HTTPS LAN/VPN](docs/KET_NOI_HAI_MAY.md), gồm tạo chứng chỉ, tin cậy CA và kiểm tra cổng mạng. Không sử dụng trực tiếp địa chỉ HTTP LAN cho PKCE.

## Kiểm thử và tài liệu

Giao diện có tổng quan admin riêng, thẻ chọn chức năng, tìm kiếm **Ctrl+K**, bảng có bộ lọc/phân trang/CSV và menu điện thoại. Xem [hướng dẫn giao diện và quản trị](docs/NANG_CAP_GIAO_DIEN.md). Trong chế độ HTTPS LAN, truy cập `/` để chọn ứng dụng và đi thẳng đến chức năng cần dùng.

```powershell
cd backend
npm.cmd test
cd ..
python -m pip install --no-user --target .tools -r tests/requirements.txt
python tests/week3_sso.py
node --test tests/frontend.test.mjs
python tests/frontend_ui.py
```

Bộ trình duyệt yêu cầu hệ thống đang chạy, Chrome đã cài và các tài khoản demo sẵn sàng. Kết quả và ảnh lưu cục bộ trong `evidence/week3`; các tệp này được Git bỏ qua. Không lưu token, mật khẩu hoặc khóa TLS vào Git.

- [Web B và SSO — tuần 4](tuan4.md).
- [Giao diện nâng cấp và hướng dẫn quản trị](docs/NANG_CAP_GIAO_DIEN.md).
- [Chức năng mới, nút thao tác và 19 API](docs/CHUC_NANG_VA_API.md).
- [Chấm công, quản trị và các giới hạn tuần 2](tuan2.md).
- [Hướng dẫn chạy nhanh](CHAY_NHANH.md).
- [Kịch bản bảo mật tuần 2](docs/KIEM_THU_BAO_MAT_TUAN_2.md).
- [Tiến độ đồ án](tiendo.md).

Đây là lab nội bộ. Các giai đoạn LDAP, JCL đầy đủ, MFA OTP, Python Detection và lưu audit tập trung được theo dõi riêng; không suy ra đã hoàn thành chỉ vì có giao diện bảo mật hoặc HTTPS.
