# Kịch bản demo, video dự phòng và diễn tập

Soạn 07/11/2026, cập nhật 08/11/2026. **Đã có video giới thiệu giao diện thật** tại `evidence/release/release-demo.webm`, không ghi bước nhập mật khẩu/OTP. Bộ kiểm thử đã lưu JSON cho LDAP/MFA/SSO/JCL/API; video giao diện chưa thay video trình diễn đủ tám bước dưới đây. Diễn tập bảo vệ trực tiếp vẫn cần thực hiện. Thời lượng đề xuất 8–10 phút.

| Phút | Màn hình/thao tác | Nội dung giải thích | Bằng chứng cần lưu |
| --- | --- | --- | --- |
| 0:00–0:45 | Trang chọn ứng dụng và sơ đồ | Hai website dùng chung IAM, quyền được kiểm tra ở API | Hostname HTTPS, kiến trúc ghi rõ minh họa |
| 0:45–1:45 | Web A, user LDAP | Đăng nhập qua nguồn LDAP, hoàn thành MFA | Không quay password, OTP, QR/secret |
| 1:45–2:30 | Chuyển Web A/B với admin/auditor phù hợp | SSO trong cùng browser profile, scope riêng theo client | Role đúng, không đánh đồng hai máy dùng chung cookie |
| 2:30–3:15 | Employee thử API admin bằng probe được chuẩn bị | API từ chối dù UI có thể bị bỏ qua | HTTP 403 và request ID, che Authorization |
| 3:15–4:30 | Workflow Change cho user demo | Duyệt, hold, nguồn LDAP, sync/verify, grant/phiên cũ thu hồi | Timeline, source receipt, trạng thái cuối |
| 4:30–5:15 | Leave hoặc revoke phiên user demo | Token chưa hết hạn vẫn bị từ chối khi phiên bị thu hồi | Trước/sau, request ID, giới hạn cache |
| 5:15–6:30 | Audit PostgreSQL | Lọc request ID/user, xem login/ALLOW/DENY/role change | DB nguồn riêng, health/backlog, không giấu lỗi |
| 6:30–7:45 | Python Detection | Chạy batch, xem features/rule, điều tra signal | Normal/Anomaly và nguyên nhân; không coi signal là bằng chứng tấn công |
| 7:45–9:00 | Metrics và kết luận | Nhãn độc lập, TP/FP/TN/FN, Precision/Recall/F1/FPR | Dataset hash, sample count, config version, FP/FN thật |
| 9:00–10:00 | Backup/recovery và giới hạn | Các kho tách biệt, restore cô lập, hướng phát triển | Manifest thật sau backup; không gọi ZIP source là backup dữ liệu |

## Trước khi quay

- Tạo user/scenario demo riêng, không đặt lại account thật; có một admin dự phòng đã xác minh.
- Chốt role từng bước. User LDAP employee không được vào Web B; demo SSO Web B phải dùng LDAP auditor/admin phù hợp hoặc trình bày rõ chuyển tài khoản.
- Đăng nhập/nhập OTP ngoài vùng ghi hình. DevTools Network chỉ chụp status/request ID, không mở headers chứa bearer token.
- Chạy checklist được cho phép trước, ghi trạng thái dịch vụ thật. Nếu collector còn backlog hoặc workflow partial, giải thích đúng trạng thái; không dựng màn hình thành công.
- Lưu video riêng dưới `evidence/week10/video/`; file `.mp4` chưa được tạo trong lần bàn giao source này.

## Câu hỏi diễn tập

1. Vì sao JWT hợp lệ vẫn có thể bị từ chối? → Phiên, cutoff, role, scope, required actions, hold.
2. Vì sao LDAP READ_ONLY nhưng vẫn làm Join/Change/Leave? → CLI operator ghi nguồn theo workflow đã duyệt; Keycloak chỉ đồng bộ.
3. PostgreSQL audit khác DB Keycloak ở đâu? → Service/volume riêng, collector REST, schema chuẩn hóa.
4. Mất Audit Service có mất log không? → Outbox giữ để gửi lại, nhưng chưa được phép khẳng định không mất end-to-end khi chưa thử lỗi/retention/disk.
5. IP mới có phải tấn công? → Chỉ là signal, cần context và nhãn độc lập.
6. Vì sao không huấn luyện ML ngay? → Chưa có dữ liệu gán nhãn đủ tin cậy; baseline giải thích được là mục bắt buộc.
7. SSO có tự đăng nhập trên máy thứ hai không? → Không; browser profile/cookie khác nhau.
8. Đã đạt Zero Trust doanh nghiệp chưa? → Mô hình đồ án theo định hướng; chưa bao phủ device posture, continuous risk, HA và mọi trust boundary.
