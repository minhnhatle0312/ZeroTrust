# Tuần 10 — Tích hợp source, tài liệu và chuẩn bị bàn giao

## Note kiểm thử bổ sung — 08/11/2026

Build hai Web, UI cũ 42/42, nghiệp vụ 24/24, màn hình mới 19/19; video release-demo.webm; backup đa kho và restore Audit cô lập. Còn nghiệm thu liên máy và diễn tập phục hồi phối hợp mọi kho.

Chi tiết: [kết quả thực tế](KET_QUA_KIEM_THU_2026_11_08.md). Các đoạn “chưa kiểm thử” bên dưới là ghi chép tại thời điểm triển khai source trước đây.


Ngày ghi note: **07/11/2026**, sau note tuần 8 rồi tuần 9. Yêu cầu hiện tại: làm đầy đủ phần còn lại nhưng **chưa kiểm thử**.

## Phần đã thực hiện

- Nối Web B với Audit PostgreSQL và Python Detection; giữ bố cục chung, trạng thái đang tải/lỗi/rỗng, bộ lọc và bảng responsive. Bổ sung lấy bù collector trên UI; người dùng thấy rõ dữ liệu chưa kết nối/chưa đo.
- Runner `scripts/run_week10.py` yêu cầu đã cấu hình LDAP/audit, giữ các Compose overlay cần thiết; không tự provision, reset user hay bật detector.
- Dependency trực tiếp của Audit được cố định `psycopg[binary]==3.3.8` theo [bản phát hành PyPI](https://pypi.org/project/psycopg/3.3.8/). Chưa cài/build; image digest và lock đầy đủ còn phải chốt khi nghiệm thu.
- `scripts/backup_week10.py`: bổ sung Audit PostgreSQL và private config vào backup nhiều kho, manifest/hash, đánh dấu incomplete nếu lỗi. Chưa chạy backup dữ liệu thật.
- `scripts/restore_audit_week10.py` và `audit/compose.recovery.yml`: khôi phục Audit vào project mới riêng, không publish port và không thay lab đang chạy. Chưa chạy restore.
- `scripts/package_week10.py`: đóng gói source Git-visible, loại `.env`, private keys, DB, runtime và thư mục ignored; ghi SHA-256 manifest. Snapshot không phải bản backup dữ liệu hay release đã kiểm chứng.
- [Kiến trúc và sequence](KIEN_TRUC_VA_LUONG_HE_THONG.md): trust boundary, OIDC/MFA, SSO/logout, JCL, audit/Python.
- [Bàn giao và vận hành](BAN_GIAO_VA_VAN_HANH.md): prerequisites, thứ tự áp dụng, Compose/runner, cấu hình, giám sát, backup/recovery, điều kiện chốt release.
- [Báo cáo tổng hợp](BAO_CAO_TONG_HOP.md) và bản Word `ban_giao/BaoCaoTongHop_IAM_Tuan5-10_DRAFT.docx`.
- [Nội dung slide](SLIDE_BAO_VE.md) và PowerPoint 15 slide `ban_giao/BaoVe_IAM_Tuan5-10_DRAFT.pptx`.
- [Kịch bản demo/video](KICH_BAN_DEMO_VA_VIDEO.md): trình tự 8–10 phút, bằng chứng cần lưu, điều kiện quay và câu hỏi diễn tập.
- `scripts/build_week10_documents.py` sinh hai tài liệu từ Markdown. Chỉ tạo tài liệu, không gọi app/dịch vụ hoặc kiểm thử. Chưa render/kiểm tra bằng Word/PowerPoint thực tế.

## Phân biệt trạng thái hoàn thành

| Nội dung roadmap | Trạng thái |
| --- | --- |
| Mã nguồn Web A/B, backend, LDAP, Audit, Python | Đã bổ sung trong workspace; chưa build/test |
| Docker/Keycloak/LDAP config và migration | Có source/scripts/hướng dẫn; chưa áp dụng mới |
| UI monitoring/detection và nút/API liên quan | Đã nối trong source; chưa browser test |
| Bộ test/kịch bản | Đã viết phần mới và checklist; chưa chạy |
| Backup/recovery | Có công cụ/runbook; source snapshot khác backup runtime |
| Báo cáo và slide | Có bản thảo kỹ thuật; phần thực nghiệm ghi chờ |
| Sơ đồ hệ thống và sequence | Có Mermaid theo thiết kế source |
| Ảnh/log/HTTP response minh chứng mới | Chưa thu thập |
| Precision/Recall/F1/FPR/Confusion Matrix thật | Chưa đo; không có số liệu giả |
| Video demo/diễn tập/bàn giao vận hành | Chưa thực hiện |
| Sáu mốc nghiệm thu tuần 5–10 | Giữ 0/6 đến khi có kết quả thực tế |

## Những việc chỉ làm khi bắt đầu kiểm thử/triển khai

1. Chốt cấu hình máy chủ/CA, áp dụng đúng thứ tự tuần 5→8, build dịch vụ và frontend.
2. Chạy các checklist tuần 5/6/7/8/9, suites lịch sử và trường hợp tích hợp/mất kết nối/restore. Sửa lỗi phát hiện trước khi freeze release chính thức.
3. Thu dataset có nhãn độc lập, chạy Python, lưu metrics và bằng chứng FP/FN. Không lấy dữ liệu tổng hợp tự sinh làm kết quả triển khai thực tế.
4. Chụp/quay demo thật, cập nhật báo cáo/slide bằng số liệu mới, diễn tập bảo vệ.
5. Chốt dependency/image digest, kiểm tra bản Word/PowerPoint đã render, lưu backup phối hợp, quyết định tag/push/release sau khi đủ bằng chứng.

Không cài dependency audit, build, chạy test, mở browser, provision LDAP/Keycloak, bật detector, thay DB đang chạy hoặc push Git trong lượt hoàn thiện source/tài liệu này.
