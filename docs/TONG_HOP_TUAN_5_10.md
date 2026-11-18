# Theo dõi hoàn thiện tuần 5–10

Cập nhật **08/11/2026**. Đã áp dụng lab, sửa lỗi và kiểm thử. [Biên bản chi tiết](KET_QUA_KIEM_THU_2026_11_08.md) có kết quả, giới hạn và đường dẫn minh chứng. Mốc chính thức **4/6**, không tự xác nhận thiết bị vật lý thứ hai.

| Tuần | Kết quả cập nhật | Note |
| --- | --- | --- |
| 5 | SSO/HTTPS 29/29; đăng ký và xác thực TOTP LDAP/local, refresh rotation; khôi phục MFA được kiểm thử bằng mock. Còn xác nhận CA/đăng nhập trên máy vật lý thứ hai. | [Tuần 5](TUAN_5_TRIEN_KHAI.md) |
| 6 | LDAP full sync 4 tài khoản ban đầu; LDAP employee/auditor đăng nhập MFA/SSO; chuyển nhóm và Leave qua JCL nguồn thật; mất LDAP chặn truy cập, đăng nhập lại được sau phục hồi. | [Tuần 6](TUAN_6_TRIEN_KHAI.md) |
| 7 | JCL local 24/24, LDAP 23/23; grant phê duyệt mở quyền, Change thu hồi grant/phiên, Leave chặn token. Các ca lỗi/hold/version được kiểm thử hồi quy. | [Tuần 7](TUAN_7_TRIEN_KHAI.md) |
| 8 | Audit PostgreSQL nhận sự kiện thật và fixture; batch replay chống trùng, correlation/phân trang, allowlist loại trường nhạy cảm; backup/restore Audit đã chạy. | [Tuần 8](TUAN_8_TRIEN_KHAI.md) |
| 9 | Python 7/7; tích hợp Audit/Detection 100/100; 27 mẫu mô phỏng định nhãn trước suy luận: TP7/TN20/FP0/FN0. Không suy rộng số đo thành chất lượng trên dữ liệu vận hành. | [Tuần 9](TUAN_9_TRIEN_KHAI.md) |
| 10 | Build hai Web, UI cũ 42/42, nghiệp vụ 24/24, màn hình mới 19/19; video release-demo.webm; backup đa kho và restore Audit cô lập. Còn nghiệm thu liên máy và diễn tập phục hồi phối hợp mọi kho. | [Tuần 10](TUAN_10_TRIEN_KHAI.md) |

## Hồ sơ bàn giao

- [Báo cáo Word](ban_giao/BaoCaoTongHop_IAM_Tuan5-10_DRAFT.docx), [slide](ban_giao/BaoVe_IAM_Tuan5-10_DRAFT.pptx): cập nhật kết quả lab; vẫn là bản thảo chờ nghiệm thu cuối.
- [Báo cáo Markdown](BAO_CAO_TONG_HOP.md), [nội dung slide](SLIDE_BAO_VE.md), [sơ đồ](KIEN_TRUC_VA_LUONG_HE_THONG.md), [vận hành](BAN_GIAO_VA_VAN_HANH.md).
- Ảnh, JSON, dataset mô phỏng, video: `evidence/release/` (ignored).
- Backup đa kho: `backups/week5-20261108T024621561919Z`; restore Audit: project `iam-recovery-20261108-release`.

## Còn xác nhận

CA và đăng nhập từ máy vật lý thứ hai ở địa chỉ hiện tại; diễn tập phục hồi phối hợp mọi kho; đánh giá detector trên dữ liệu đại diện/người đánh giá độc lập; diễn tập bảo vệ. AD DS/HA/Passkey/ML là mở rộng tùy chọn. Source ZIP và backup private là hai loại khác nhau, không đưa secret vào Git.
