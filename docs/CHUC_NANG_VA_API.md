# Chức năng theo vai trò và danh mục API

Cập nhật Đợt 6, theo mã nguồn; trạng thái thực nghiệm xem [báo cáo nghiệm thu](BAO_CAO_NGHIEM_THU_ZERO_TRUST.md). Những danh sách “19 API bổ sung” trong tài liệu tuần cũ là phạm vi lịch sử, không phải tổng số API hiện tại.

## Quyền

| Chức năng | Employee | Manager | Admin | Auditor |
|---|---|---|---|---|
| Web A, hồ sơ/MFA/phiên cá nhân | Chính mình | Chính mình | Chính mình | Chính mình |
| Chấm công, bảng công, đơn điều chỉnh | Chính mình | Chính mình | Chính mình | Chính mình theo token Web A |
| Nhóm và duyệt đơn | Không | Đúng nhóm | Theo phạm vi admin | Không |
| Yêu cầu quyền | Chính mình | Chính mình | Chính mình | Chính mình |
| Phê duyệt quyền | Không | Theo phạm vi | Theo phạm vi admin | Không |
| Web B, Audit/Detection/sự cố/ma trận quyền | Không | Không | Đọc | Đọc |
| Ghi nhận điều tra, đề xuất, actionRefs, verification, trạng thái | Không | Không | Có, Backend kiểm tra version/bằng chứng | Không |
| Quản trị nhân viên/phiên tài khoản khác | Không | Không | Có, trừ đối tượng/thao tác được bảo vệ | Không |
| Gán nhãn Detection | Không | Không | Có | Có theo API reader hiện tại |
| Tạo snapshot/rà soát, ghi khuyến nghị quyền | Không | Không | Có | Có; không thu hồi quyền thực tế |
| Cấu hình/chạy Detection, collector/backfill, Audit retention | Không | Không | Theo endpoint và xác nhận riêng | Không |
| Tạo/duyệt/thực hiện workflow vòng đời | Không | Không | Theo workflow có version/hold | Chỉ xem |

Auditor không hoàn toàn chỉ đọc Web B: gán nhãn Detection và snapshot/khuyến nghị review là ngoại lệ có từ trước; không mở rộng sang ghi incident. Manager không được vào Web B. Không được tự duyệt đơn/yêu cầu của mình; quyền nhóm/chủ sở hữu, account/session, client scope và lifecycle hold được kiểm tra lại ở Backend.

## Các nhóm API chính

| API/nhóm | Quyền và mục đích |
|---|---|
| `/api/profile` | Hồ sơ đã xác thực; token phải khớp danh tính/role server |
| `/api/attendance`, POST `/check-in`, `/check-out` dưới `/api/attendance` | Nghiệp vụ cá nhân, token Web A |
| `/api/corrections`, PATCH `/api/corrections/:id`, POST `/api/corrections/:id/cancel` | Tạo/đọc đơn cá nhân, reviewer đúng phạm vi, chủ đơn rút pending |
| `/api/team` | Manager/admin, phạm vi theo Backend |
| `/api/me/access`, `/api/me/access/requests`, `/api/governance/approvals` | Yêu cầu/phê duyệt quyền theo chủ thể và approver |
| `/api/me/security`, `/api/me/sessions` và `/revoke` | Bảo mật/phiên chính mình; revoke là ghi, không dùng cho probe lab |
| `/api/admin/users` và các endpoint dưới `/:id` | Admin; thêm/sửa/reset/MFA/session/actions có tác động thật |
| `/api/security/events`, `/events/:id`, `/login-events`, `/summary` | Admin/auditor đọc log cục bộ, tra cứu/phân trang |
| `/api/security/alert-list`, `/alerts/:id`, `/alerts/:id/context` | Danh sách/hồ sơ SQLite; context không phải chứng minh nguyên nhân |
| PATCH `/api/security/alerts/:id` | Chỉ admin, điều tra theo version/citation |
| `/api/security/actions` | Admin/auditor xem kết quả hành động đã ghi; liên kết không thực thi lại |
| `/api/security/central/health`, `/events`, `/events/:id`, `/summary`, `/incidents`, `/incidents/:id` | Gateway đọc Audit PostgreSQL cho admin/auditor |
| POST `/api/security/central/incidents/:id` | Chỉ admin; body dùng `state`, kiểm tra capability/version/history |
| `/api/security/central/detection/status`, `/results`, `/evaluations` | Admin/auditor đọc; endpoints ghi tùy quyền ở ma trận trên |
| `/api/security/governance/*`, `/api/security/directory/*` | Vòng đời/quyền và Directory; từng endpoint kiểm tra quyền riêng |
| `/api/notifications`, PATCH `/:id/read`, POST `/read-all` dưới `/api/notifications` | Theo đối tượng/audience; đánh dấu đọc là ghi dữ liệu |

Các đường dẫn nhóm không ngụ ý mọi phương thức được hỗ trợ; handler trong `backend/app.js`, `operations.js`, `week5.js`, `governance.js`, `directory.js`, `central-audit.js`, `incidents.js` là căn cứ. Giao diện không cấp quyền chỉ bằng việc ẩn/hiện menu.

## Dữ liệu, tìm kiếm và lỗi

- Danh sách local dùng `items,total,page,limit,pages`; Audit dùng `rows,total,limit,offset`. Không dùng lẫn cơ chế phân trang.
- Nhật ký local xuất tối đa 200 dòng theo bộ lọc. CSV incident Đợt 5A xuất dòng hiện tại; Audit chuẩn bị tối đa 5.000; bảng công xuất các dòng đã lọc theo thông báo trên trang.
- Incident PostgreSQL không có tìm `q` toàn database trong hợp đồng Đợt 4; UI tìm trong trang. Event→incident chỉ nối event_id gốc trùng khớp, giới hạn 2.000 hồ sơ, không suy đoán từ IP/tên.
- 401: phiên/token; 403: quyền; 404: không có bản ghi/bằng chứng trong phạm vi; 409: version hoặc điều kiện đổi; 429: giới hạn; 503: chưa xác nhận dịch vụ. Không tự retry POST/PATCH.
- Sau 409/5xx cập nhật sự cố, giữ draft, đọc version/history mới và đối chiếu trước khi gửi lại. Kết quả chưa chắc chắn không phải thất bại chắc chắn hoặc thành công chắc chắn.

Chi tiết DTO/body/điều kiện đóng: [hợp đồng Đợt 4](API_SU_CO_DOT_4.md), [quy trình hiện hành](API_VA_QUY_TRINH_SU_CO.md). Hướng dẫn thao tác: [Web A/Web B](HUONG_DAN_SU_DUNG.md).
