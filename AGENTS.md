# Hướng dẫn làm việc tại ZeroTrust

- Luôn giao tiếp, cập nhật tiến độ và báo cáo bằng **tiếng Việt**.
- Khi bắt đầu phiên mới, đọc `docs/PROJECT_CONTEXT.md`, rồi đối chiếu `git status`, README, tài liệu liên quan và mã nguồn thực tế. Cập nhật `docs/PROJECT_CONTEXT.md` sau thay đổi đáng kể để phiên sau tiếp tục được công việc.
- Giữ nguyên các thay đổi chưa commit và Git index có sẵn; không reset/restore toàn cây. Không commit, push hoặc deploy nếu chưa có chỉ thị mới của người dùng.
- Không xóa/reset database hoặc Docker volumes, không chạy lại setup tuần 2/3. Trong công việc sửa Web B hiện tại, không thay employee-portal, users, roles hoặc MFA và không tự chạy `scripts/repair_security_dashboard.py --apply` trên môi trường thật.
- Không hiển thị/lưu vào báo cáo password, token, secret, cookie hoặc raw response có thể chứa chúng. Giữ JWT/RBAC/PKCE và các cơ chế bảo mật.
- Ưu tiên kiểm thử cô lập. Phân biệt kết quả mocked, kết quả lịch sử và bằng chứng tích hợp thật; không dùng database/tài khoản đang vận hành làm fixture.
- Chỉ thị trực tiếp mới của người dùng quyết định phạm vi công việc; không suy quyền chạy script ghi từ việc tài liệu hướng dẫn có nhắc đến lệnh đó.
