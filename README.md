# ZeroTrust — Nhịp Workspace và Nhịp Security

Hệ thống IAM cho Web A chấm công và Web B giám sát/điều tra bảo mật: React, Express, Keycloak/OIDC, SQLite nghiệp vụ, PostgreSQL Audit, Python Detection và LDAP federation.

**Đợt 6 (09/11/2026):** đã có source Đợt 1–5B, hồi quy cô lập và sửa lỗi retention làm mất bằng chứng tham chiếu. Docker Engine/lab chưa khả dụng trong lượt này. Không coi test giả lập là SSO/MFA/PostgreSQL thật đã đạt. Kết luận và số liệu: [Báo cáo nghiệm thu](docs/BAO_CAO_NGHIEM_THU_ZERO_TRUST.md).

## Bắt đầu

**Cài đặt trên máy mới:** đọc [khởi tạo máy mới](docs/KHOI_TAO_MAY_MOI.md) để provision IAM trước, xuất seed từ ID thực và kiểm tra bootstrap trước khi tạo SQLite. Không mang seed/SQLite của máy khác sang realm mới; không chạy setup trên DB đã hoạt động. Với năm tài khoản đang lệch ID, dùng [quy trình đối soát](docs/DOI_SOAT_ID_TAI_KHOAN_DEMO.md) có phê duyệt riêng.

Tại `D:\ZeroTrust`, kiểm tra chỉ đọc rồi chạy hồi quy an toàn với dependencies đã có:

```powershell
python -B scripts/inspect_phase6.py
python -B scripts/test_phase6.py
```

Runner dùng SQLite trong bộ nhớ/thư mục test, endpoint synthetic loopback và build vào `.runtime/phase6-tests/build`. Không khởi động stack lab, nạp `.env` lab cho test hoặc ghi đè `web-a/dist`, `web-b/dist`. Cần Node.js 22.19+, Python 3.11+, dependencies Node ở ba ứng dụng và Chrome/Playwright driver cho browser tests. Xem [hướng dẫn kiểm thử](docs/HUONG_DAN_KIEM_THU.md).

Vận hành hệ thống có dữ liệu: đọc [hướng dẫn khởi động](docs/HUONG_DAN_KHOI_DONG.md) hoặc [chạy nhanh](CHAY_NHANH.md). Khởi động Backend có thể chạy migration, collector và xử lý pending; không phải kiểm tra chỉ đọc. Không dùng init/setup/reset/restore để làm test đạt trên lab đang sử dụng.

## Thành phần

| Thành phần | Chức năng |
|---|---|
| `web-a` | Dashboard theo vai trò, chấm công, bảng công/CSV, đơn điều chỉnh, nhóm/phê duyệt, hồ sơ và phiên |
| `web-b` | Dashboard, Audit/Detection, hai kho sự cố, bằng chứng/timeline, điều tra/đề xuất/liên kết hành động/kiểm chứng và công cụ quản trị |
| `shared` | AuthGate, API client, shell, dialog/bảng, phân hệ chung |
| `backend` | JWT/issuer/audience/azp, RBAC/team/owner, account/session checks, SQLite và audit outbox |
| `keycloak`, `docker-compose.yml` | OIDC/PKCE/MFA theo cấu hình, PostgreSQL danh tính; compose cơ bản dùng development mode |
| `audit` | PostgreSQL Audit riêng, sự cố version/history/evidence, Python baseline |
| `directory`, `network`, `deploy` | LDAP/LDAPS, HTTPS gateway, profile production-like riêng chưa nghiệm thu production |

Mật khẩu/OTP chỉ nhập tại Keycloak. Token giữ trong bộ nhớ adapter; Backend quyết định quyền và điều kiện đóng sự cố. Đề xuất không phải thực thi; chỉ `resolution.verified=true` xác nhận điều kiện khắc phục đã được Backend kiểm tra.

## Tài liệu hiện hành

- [Chức năng, quyền và API](docs/CHUC_NANG_VA_API.md).
- [Hướng dẫn Web A/Web B](docs/HUONG_DAN_SU_DUNG.md).
- [API và quy trình sự cố](docs/API_VA_QUY_TRINH_SU_CO.md), [hợp đồng chi tiết Đợt 4](docs/API_SU_CO_DOT_4.md).
- [Kiến trúc và ranh giới tin cậy](docs/KIEN_TRUC_VA_LUONG_HE_THONG.md).
- [Lỗi và giới hạn](docs/LOI_VA_GIOI_HAN.md).
- [Nghiệm thu và điều kiện trước triển khai](docs/BAO_CAO_NGHIEM_THU_ZERO_TRUST.md).

Các báo cáo [1](docs/KET_QUA_KIEM_THU_DOT_1.md), [2](docs/KET_QUA_KIEM_THU_DOT_2.md), [3](docs/KET_QUA_KIEM_THU_DOT_3.md), [4](docs/KET_QUA_KIEM_THU_DOT_4.md), [5A](docs/KET_QUA_KIEM_THU_DOT_5A.md), [5B](docs/KET_QUA_KIEM_THU_DOT_5B.md) giữ nguyên như snapshot lịch sử. Minh chứng 08/11 hoặc hướng dẫn tuần cũ không thay nghiệm thu source hiện tại. MFA thật và HTTPS từ máy khách thứ hai cần bằng chứng riêng.

## Dữ liệu và repository

Không đưa `.env`, private key, SQLite/WAL/SHM, staff/audit runtime, backup hoặc browser storage lên Git/báo cáo. Bỏ tracking không xóa bản cũ trong lịch sử; cần đánh giá phạm vi chia sẻ riêng, không tự đổi khóa hoặc sửa lịch sử. Bộ đóng gói nằm ở `scripts/package_week10.py` và `tests/test_packaging.py`.

Không reset database/realm, xóa Docker volumes, commit/push hoặc triển khai production tự động. Thao tác tài khoản, phiên và quyền chỉ được thử trong môi trường riêng có dữ liệu giả.
