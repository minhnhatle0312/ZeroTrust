# Lỗi và giới hạn sau Đợt 6

Ngày rà soát: 09/11/2026. PASS chỉ áp dụng ca đã thực thi; không có bằng chứng lab mới trong lượt này. Kết luận: [báo cáo nghiệm thu](BAO_CAO_NGHIEM_THU_ZERO_TRUST.md).

| Mã | Mức độ/phạm vi | Trạng thái và căn cứ |
|---|---|---|
| DATA-06-01 | Cao (P1), khi SQLite retention được bật | **Đã sửa source.** Truy vấn cũ xóa event dù incident tham chiếu; tái hiện memory từ 1 evidence còn 0 và missing=1. Module retention mới giữ direct/current/history refs, transaction rollback nếu metadata hỏng. 6 test mới đạt. Chưa chạy pruning trên lab. |
| DOC-06-01 | Trung bình (P2), thao tác vận hành | **Đã sửa tài liệu hiện hành.** README còn trạng thái Đợt 2; chạy nhanh cũ đưa init/setup và test tài khoản vào luồng dùng hệ thống đã có dữ liệu. Hướng dẫn mới tách probe, test cô lập và vận hành có phê duyệt; không công bố credential. |
| ENV-06-01 | Chặn nghiệm thu tích hợp | Docker CLI/Compose có, Engine không có pipe Linux; service dừng, không thấy Desktop. Không tự khởi động vì có thể kích hoạt container/lịch vận hành thật. Các dịch vụ/cổng/public endpoint được probe chưa khả dụng. |
| INT-06-01 | Chặn nghiệm thu tổng thể | Chưa chạy lại PostgreSQL thật (28 ca), đăng nhập/SSO/MFA live, effective client/service-account policy hoặc HTTPS từ máy khách thứ hai. Kết quả lịch sử không được tính lại thành PASS mới. |
| CONS-01 | Rủi ro toàn vẹn cần vận hành | Không có transaction phân tán SQLite/PostgreSQL; phản hồi lỗi có thể sau commit. UI giữ draft, khóa retry mù, đọc version/history; chưa có idempotency cho mutation. |
| DATA-01 | Dữ liệu legacy | Thiếu exact links, timestamp hoặc target thực thi không được tự bịa. Resolved cũ không đồng nghĩa verified; source đã mất trước sửa không tự phục hồi. |
| SCALE-01 | Hiệu năng/quy mô | Detail evidence tối đa 500, tra cứu event→incident gốc tối đa 2.000; tìm incident PostgreSQL trong trang; action picker lọc target trong từng trang 50. Chưa đo tải lớn. Retention mới giữ evidence lịch sử có thể tăng dung lượng và cần đo chi phí JSON references. |
| API-01 | Khả năng nghiệp vụ | Đề xuất append, không sửa/xóa cũ; hành động chỉ liên kết log đã có. Không tạo probe hoặc kết quả thực thi tự khai. Một số lỗi Audit upstream được gateway trả thông báo chung. |
| IAM-01 | Rủi ro cần xác minh | Service account có manage-users là quyền rộng; chưa xác minh effective roles live, MFA mọi luồng/user hiện hữu, posture thiết bị, workload identity/mTLS hoặc HA. Không tự đổi policy trong lượt nghiệm thu. |
| SEC-01 | Credential/repository | Bỏ tracking không thu hồi bản trong lịch sử Git/tài liệu lịch sử. Cần đánh giá phạm vi chia sẻ bằng quy trình riêng; không kết luận đã bị lộ và không tự xoay khóa/xóa lịch sử. |
| QA-01 | Phạm vi test | Browser Chrome synthetic đạt không thay browser live; smoke menu không chứng minh mọi form quản trị/LDAP/retention thực. Chưa kiểm screen reader đầy đủ, Safari/Firefox/thiết bị vật lý, dependency CVE scan hoặc kiểm thử xâm nhập production. |

Không xếp môi trường chưa chạy thành lỗi sản phẩm hoặc ca PASS. Sửa mã retention không chứng minh đã triển khai sửa trên dịch vụ thật. Duy trì bằng chứng test, backup và quy trình review trước khi vận hành.
