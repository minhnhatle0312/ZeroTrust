# Tuần 6 — danh sách nghiệm thu để thực hiện sau

**Soạn ngày 06/11/2026; chưa chạy bất kỳ ca nào.** Không sử dụng số pass của tuần trước hoặc chỉ nhìn cấu hình để đánh dấu đạt. Mã tuần 5 cũng chưa được nghiệm thu; cần xác nhận nền MFA trước khi kết luận tuần 6.

| ID | Ca cần thực hiện | Kỳ vọng cần chứng minh | Trạng thái |
|---|---|---|---|
| W6-01 | Build frontend/backend source, build OpenLDAP image | Không lỗi cú pháp/import/config | Chưa chạy |
| W6-02 | Sinh credential/chứng chỉ, lặp lại prepare | Giữ mật khẩu cũ; private files không vào Git/build context | Chưa chạy |
| W6-03 | Khởi tạo và recreate container LDAP | Volume giữ users; bootstrap không reset mật khẩu | Chưa chạy |
| W6-04 | LDAPS từ Keycloak; CA sai, hostname sai | CA/SAN đúng mới được chấp nhận | Chưa chạy |
| W6-05 | Bind reader và thao tác đọc/ghi/password hash | Đọc thuộc tính cần thiết; không sửa hoặc đọc hash | Chưa chạy |
| W6-06 | Setup khi chưa có flow tuần 5 | Dừng, không bật LDAP provider thiếu policy | Chưa chạy |
| W6-07 | Setup lại, attribute mappers, nhóm /directory | Không trùng mapper; không thay nhóm/tài khoản cũ | Chưa chạy |
| W6-08 | Runtime service account đọc provider/sync | Quyền đủ và giới hạn, không cấp manage-realm để né lỗi | Chưa chạy |
| W6-09 | Full sync lần đầu | User/nhóm/role/hồ sơ ứng dụng đúng; dữ liệu nguồn có mốc thời gian | Chưa chạy |
| W6-10 | Nhân viên LDAP login và đăng ký OTP | Đúng password/OTP mới có Web A/API | Chưa chạy |
| W6-11 | Auditor LDAP login Web A→B và B→A | Có MFA, SSO cùng browser; không có quản trị user | Chưa chạy |
| W6-12 | Employee/manager vào Web B hoặc API bảo mật | Bị từ chối tại backend dù token hợp lệ | Chưa chạy |
| W6-13 | Đổi nhóm employee→manager và ou khác | Hold → thu hồi → sync → login; quyền cũ từ chối, quyền mới đúng nhóm | Chưa chạy |
| W6-14 | Bỏ hết nhóm hoặc gán nhiều nhóm/role trực tiếp | Conflict, cảnh báo và không được nhận quyền mặc định | Chưa chạy |
| W6-15 | Nguồn có group chứa admin/composite admin | Không cấp admin, source/token bị chặn | Chưa chạy |
| W6-16 | Disable LDAP rồi thử login mới và token cũ | LDAP password bind bị chặn; API từ chối theo cache/thu hồi đã đo | Chưa chạy |
| W6-17 | Enable LDAP khi app vẫn khóa riêng | Không tự mở app; admin chỉ mở sau đối chiếu nguồn hợp lệ | Chưa chạy |
| W6-18 | Dừng LDAP, lỗi bind password hoặc mất CA trust | Không fallback local; job lỗi; không báo danh sách nguồn rỗng | Chưa chạy |
| W6-19 | Đổi hồ sơ/reset password bằng API local cho LDAP | DIRECTORY_READ_ONLY; UI không đưa nút ghi sai nguồn | Chưa chạy |
| W6-20 | MFA recovery của LDAP user | Giữ MFA required tại nguồn; có xác minh admin; OTP mới bắt buộc | Chưa chạy |
| W6-21 | Đồng bộ changed khi chỉ sửa member của group | Đối chiếu lại nhóm đã import, không giữ quyền cũ âm thầm | Chưa chạy |
| W6-22 | Giới hạn quét, failed/ignored, user thiếu ở nguồn | Partial có căn cứ; chỉ missing sau quét đầy đủ | Chưa chạy |
| W6-23 | Nhiều yêu cầu sync/khởi động lại khi job đang chạy | Một job/provider; journal pending/partial đúng; không báo xong giả | Chưa chạy |
| W6-24 | Lỗi LDAP giữa các bước sửa nhóm, sync cùng lúc | Giữ writing hold; không giải phóng trong khi còn ghi | Chưa chạy |
| W6-25 | Hai CLI sửa nhóm khác user đồng thời | Tuần tự hóa, không mất member khác; resume chỉ sau kiểm tra | Chưa chạy |
| W6-26 | Audit ghi lỗi/DB không ghi được | Không enqueue side effect khi audit cùng transaction thất bại | Chưa chạy |
| W6-27 | Backup LDAP/Keycloak/SQLite, manifest sai và rollback | Không restore snapshot thiếu/sai; quarantine và giữ lịch sử | Chưa chạy |
| W6-28 | Ba màn hình LDAP trên desktop/mobile, lỗi API | Nút/query/pagination/loading/error và quyền auditor đúng | Chưa chạy |
| W6-29 | Regression user local, RBAC/IDOR/SSO/refresh | Không suy ra tương thích từ các kết quả cũ | Chưa chạy |
| W6-30 | HTTPS từ máy LAN/VPN thứ hai | Login LDAP/MFA và chức năng được cấp có minh chứng | Chưa chạy |

Minh chứng cần thu: HTTP status/code/request ID, ảnh không chứa password/QR/secret, mốc thu hồi/token, trạng thái Keycloak/LDAP, job và audit tương ứng. Không lưu raw token, OTP hoặc bind credential trong báo cáo. Chỉ cập nhật mốc “Identity Federation” trong roadmap sau khi đủ các điều kiện bắt buộc.
