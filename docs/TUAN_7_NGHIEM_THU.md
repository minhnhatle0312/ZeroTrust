# Tuần 7 — danh sách nghiệm thu để thực hiện sau

Soạn **06/11/2026 (UTC+7)**. **Tất cả ca dưới chưa chạy.** Danh sách không phải kết quả kiểm thử. Cần nghiệm thu nền MFA tuần 5 và LDAP tuần 6 trước khi xác nhận JCL LDAP đầu-cuối.

| ID | Kịch bản | Kết quả cần chứng minh | Trạng thái |
|---|---|---|---|
| W7-01 | Build Web A/B, import backend/scripts | Không lỗi cú pháp/import, giữ luồng cũ | Chưa chạy |
| W7-02 | Migration trên SQLite có dữ liệu cũ; restart | Bổ sung schema, không mất công/audit/user | Chưa chạy |
| W7-03 | Setup thiếu flow MFA hoặc attribute tự sửa được | Dừng trước thay đổi cấu hình mới, có backup | Chưa chạy |
| W7-04 | Join local, approval, execute | Employee mặc định; hồ sơ/marker/role đúng | Chưa chạy |
| W7-05 | Join yêu cầu admin role, username LDAP dùng local | Bị từ chối; không tạo user | Chưa chạy |
| W7-06 | Đăng nhập Join local lần đầu | Phải đổi mật khẩu tạm và đăng ký OTP trước API | Chưa chạy |
| W7-07 | Timeout sau khi tạo user trước phản hồi | Retry cùng marker; không tạo/reset mật khẩu lần hai | Chưa chạy |
| W7-08 | Username trùng tài khoản không liên quan tại Keycloak/LDAP | Không nhận hoặc ghi đè danh tính đó | Chưa chạy |
| W7-09 | Join LDAP, source operator, recipient chọn mật khẩu | Entry/nhóm đúng, mật khẩu không ra stdout/DB/argv | Chưa chạy |
| W7-10 | Sync/login LDAP xen giữa source Join và đối chiếu | Hồ sơ vẫn onboarding, API bị chặn | Chưa chạy |
| W7-11 | Join LDAP đối chiếu rồi login | Đúng provider/subject/team/role, buộc OTP | Chưa chạy |
| W7-12 | Change local employee → manager, chuyển nhóm | Phiên/quyền cũ bị thu hồi, login mới đúng phạm vi | Chưa chạy |
| W7-13 | Change LDAP ou và group, full sync | Nguồn/Keycloak/app khớp, không có role trực tiếp thừa | Chưa chạy |
| W7-14 | Business role kế thừa không mong muốn | Không báo SYNCED; giữ chặn để xử lý | Chưa chạy |
| W7-15 | Hồ sơ đổi sau lúc lập JCL | Lần execute đầu từ chối snapshot cũ | Chưa chạy |
| W7-16 | Hai thao tác/phê duyệt từ version cũ | Một kết quả hợp lệ, thao tác cũ bị từ chối | Chưa chạy |
| W7-17 | Leave local; token còn hạn và refresh | API chặn, Keycloak disabled, không còn phiên | Chưa chạy |
| W7-18 | Leave LDAP; nguồn/Keycloak/app | Nguồn disabled, không password bind mới, app left | Chưa chạy |
| W7-19 | Enable/profile/reset/retry cũ với processing/left | Không vượt hold hoặc tự mở lại | Chưa chạy |
| W7-20 | Admin tự xử lý JCL hoặc target admin | Bị bảo vệ; không thay quyền admin | Chưa chạy |
| W7-21 | Xin quyền 1–30 ngày, lý do, yêu cầu trùng | Validation đúng; unique pending/approved | Chưa chạy |
| W7-22 | Manager duyệt đúng nhóm và khác nhóm | Đúng nhóm employee được xử lý; khác nhóm bị từ chối | Chưa chạy |
| W7-23 | Tự duyệt, auditor approve/revoke | Backend từ chối, UI phù hợp quyền | Chưa chạy |
| W7-24 | Request grant, dùng trước/sau duyệt | Trước 403, sau đúng tài nguyên/phạm vi | Chưa chạy |
| W7-25 | Grant expired/revoked, trình duyệt còn badge cũ | API chặn theo DB/thời gian máy chủ | Chưa chạy |
| W7-26 | Đổi nhóm, pending/grant cũ | JCL hủy/thu hồi; nguồn ngoài JCL vẫn bị ràng buộc team | Chưa chạy |
| W7-27 | Token Web B gọi resource hoặc employee gọi Security | Bị từ chối theo client/RBAC | Chưa chạy |
| W7-28 | CSV và báo cáo nhóm | Đúng phạm vi/30 ngày, xử lý nội dung có công thức | Chưa chạy |
| W7-29 | Snapshot review, thiếu/cũ LOGIN, grant lệch | Không suy thiếu dữ liệu là không sử dụng; findings đúng | Chưa chạy |
| W7-30 | Auditor ghi khuyến nghị, admin thu hồi grant | Khuyến nghị không tự đổi quyền, audit giữ snapshot | Chưa chạy |
| W7-31 | Keycloak/LDAP lỗi trước hoặc giữa ghi | FAILED/PARTIAL trung thực, local hold vẫn có hiệu lực | Chưa chạy |
| W7-32 | Backend restart lúc tác vụ đang chạy | Backend job partial; source writer không tự mất khóa | Chưa chạy |
| W7-33 | CLI lỗi, resume và hai writer song song | Giữ hold, chặn writer khác, receipt không replay | Chưa chạy |
| W7-34 | Lỗi audit/SQLite sau remote commit | Không báo thành công; không tự bỏ hold | Chưa chạy |
| W7-35 | Phân trang 20, hơn 1.000 user/review/report | Giới hạn và cờ complete hiển thị trung thực | Chưa chạy |
| W7-36 | Web A/B desktop/mobile/keyboard/dialog | Không vỡ bố cục, focus/feedback/nút đúng chức năng | Chưa chạy |
| W7-37 | Backup/khôi phục có chủ đích | Dữ liệu/hold/lịch sử còn, không mở lại Leave | Chưa chạy |
| W7-38 | E2E Join → MFA → Change → xin/duyệt quyền → Leave | Lưu API response, trạng thái thực và audit trước/sau | Chưa chạy |

Minh chứng dự kiến chỉ tạo **sau khi thực sự chạy**: response đã loại secret, ảnh giao diện, snapshot nguồn/Keycloak và log có request ID, mốc thời gian, thông số môi trường và giới hạn. Không ghi mật khẩu, OTP secret, bind credential hoặc token nguyên vẹn vào minh chứng.
