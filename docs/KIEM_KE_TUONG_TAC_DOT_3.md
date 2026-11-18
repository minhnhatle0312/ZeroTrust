# Kiểm kê trang và tương tác Web A / Web B — Đợt 3

Ngày khảo sát: 09/11/2026 (UTC+7). Sinh từ mã nguồn bằng `node scripts/inventory_ui.cjs --phase3`. Không chạy ứng dụng hoặc gọi API.

Có **29 mục trang/menu**, **44 nhóm chức năng**, **19 mẫu form**, **408 vị trí JSX/helper tương tác** trong 15 file. Các mẫu lặp theo dòng/role/tab không phải số nút hiển thị runtime. Widget callsite và phần tử native được ghi riêng theo tag.

Trạng thái `REVIEWED`: đã đọc mã; `NOT_RUN`: chưa chạy lại UI/live Đợt 1. Tham chiếu test là phạm vi liên quan, không khẳng định từng nút đã đạt. Kết quả suite Đợt 1 xem [báo cáo](KET_QUA_KIEM_THU_DOT_3.md).

API trong từng dòng là **ngữ cảnh component**; input lọc/nút đóng có thể chỉ cập nhật local state. `directApiCalls`, handler, điều kiện hiển thị, disabled, giới hạn trường và label động có đủ trong [JSON](interaction-inventory-phase3.json). Không lưu bất kỳ giá trị người dùng/credential nào.

## Trang và menu

| ID | Đường dẫn | Menu | Quyền | Nhóm chức năng | UI Đợt 1 |
|---|---|---|---|---|---|
| A:overview | `/a/#/overview` | Tổng quan | employee, manager, admin, auditor | shell, notifications, workspace, admin-home, role-overview, insights | NOT_RUN |
| A:functions | `/a/#/functions` | Tất cả chức năng | employee, manager, admin, auditor | shell, notifications, workspace | NOT_RUN |
| A:checkin | `/a/#/checkin` | Chấm công | employee, manager, admin, auditor | shell, notifications, workspace, insights | NOT_RUN |
| A:attendance | `/a/#/attendance` | Bảng công của tôi | employee, manager, admin, auditor | shell, notifications, workspace, calendar, table | NOT_RUN |
| A:requests | `/a/#/requests` | Đơn điều chỉnh | employee, manager, admin, auditor | shell, notifications, workspace | NOT_RUN |
| A:access | `/a/#/access` | Quyền truy cập của tôi | employee, manager, admin, auditor | shell, notifications, access | NOT_RUN |
| A:profile | `/a/#/profile` | Hồ sơ & phiên của tôi | employee, manager, admin, auditor | shell, notifications, profile, sessions, account-security | NOT_RUN |
| A:team | `/a/#/team` | Quản lý nhóm | manager, admin | shell, notifications, workspace, table | NOT_RUN |
| A:approvals | `/a/#/approvals` | Duyệt quyền truy cập | manager, admin | shell, notifications, approvals | NOT_RUN |
| A:security | `/a/#/security` | Trung tâm bảo mật | admin, auditor | shell, notifications, alerts, explorer, actions, identity, security-insights, reconciliation | NOT_RUN |
| A:users | `/a/#/users` | Tài khoản & truy cập | admin | shell, notifications, accounts, employee, account-action, sessions, account-security | NOT_RUN |
| B:overview | `/b/#/overview` | Tổng quan | admin, auditor | shell, notifications, security-app, analytics, security-insights, identity | NOT_RUN |
| B:functions | `/b/#/functions` | Tất cả chức năng | admin, auditor | shell, notifications, security-app | NOT_RUN |
| B:alerts | `/b/#/alerts` | Cảnh báo | admin, auditor | shell, notifications, explorer, alerts | NOT_RUN |
| B:detection | `/b/#/detection` | Python Detection | admin, auditor | shell, notifications, detection, detection-config, label | NOT_RUN |
| B:central-audit | `/b/#/central-audit` | Audit PostgreSQL | admin, auditor | shell, notifications, central, central-incidents, incident-review, event-detail, audit-settings, audit-backfill | NOT_RUN |
| B:events | `/b/#/events` | Nhật ký truy cập | admin, auditor | shell, notifications, explorer | NOT_RUN |
| B:accounts | `/b/#/accounts` | Tài khoản | admin | shell, notifications, accounts, employee, account-action, sessions, account-security | NOT_RUN |
| B:logins | `/b/#/logins` | Đăng nhập & xác thực | admin, auditor | shell, notifications, explorer | NOT_RUN |
| B:matrix | `/b/#/matrix` | Ma trận quyền | admin, auditor | shell, notifications, access-matrix | NOT_RUN |
| B:actions | `/b/#/actions` | Lịch sử xử lý | admin, auditor | shell, notifications, reconciliation | NOT_RUN |
| B:profile | `/b/#/profile` | Hồ sơ & phiên của tôi | admin, auditor | shell, notifications, profile, sessions, account-security | NOT_RUN |
| B:directory | `/b/#/directory` | Danh bạ LDAP | admin, auditor | shell, notifications, directory | NOT_RUN |
| B:federation | `/b/#/federation` | Đồng bộ thư mục | admin, auditor | shell, notifications, directory | NOT_RUN |
| B:directory-mapping | `/b/#/directory-mapping` | Ánh xạ nhóm LDAP | admin, auditor | shell, notifications, directory | NOT_RUN |
| B:governance | `/b/#/governance` | Vòng đời danh tính | admin, auditor | shell, notifications, governance, workflow-form, workflow | NOT_RUN |
| B:access-approvals | `/b/#/access-approvals` | Phê duyệt quyền | admin | shell, notifications, approvals | NOT_RUN |
| B:access-review | `/b/#/access-review` | Rà soát quyền | admin, auditor | shell, notifications, review | NOT_RUN |
| B:grant-matrix | `/b/#/grant-matrix` | Vai trò & quyền bổ sung | admin, auditor | shell, notifications, governance | NOT_RUN |

Trang trước đăng nhập, lỗi render, modal, command palette, app chooser và mobile menu được liệt kê trong nhóm auth/shell bên dưới. Keycloak login/password/OTP là điểm tích hợp ngoài mã JSX; chưa kiểm thử lại các màn hình này.

## Biểu mẫu và các phần tử thành phần

| Form | Component | Nhóm quyền/API | Handler | Các ID trường/nút trong form |
|---|---|---|---|---|
| UI-0025 | AccountDialog | account-action | {save} | UI-0026, UI-0027, UI-0028, UI-0029 |
| UI-0032 | AlertDialog | alerts | {save} | UI-0033, UI-0034, UI-0035, UI-0036, UI-0037 |
| UI-0048 | CentralAudit | central | {e=>{e.preventDefault();setApplied(Object.fromEntries(Object.entries(filter).filter(([,v])=>v).map(([k,v])=>[k,['from','to'].includes(k)?new Date(v).toISOString():v])));setPage(0);setExportRows(null);}} | UI-0049, UI-0050, UI-0051, UI-0052, UI-0053, UI-0054, UI-0055, UI-0056, UI-0057 |
| UI-0065 | AuditBackfill | audit-backfill | {submit} | UI-0066, UI-0067, UI-0068, UI-0069 |
| UI-0075 | IncidentReview | incident-review | {submit} | UI-0076, UI-0077, UI-0078 |
| UI-0079 | AuditSettings | audit-settings | {e=>{e.preventDefault();action(async()=>{const result=await api(BASE+'/settings','POST',Object.fromEntries(['retention_days','login_threshold','deny_threshold'].map(k=>[k,Number(values[k])])));setMessage(result.message);setPreview(null);onSaved();});}} | UI-0080, UI-0081 |
| UI-0101 | DetectionConfig | detection-config | {submit} | UI-0102, UI-0103, UI-0104 |
| UI-0106 | LabelDialog | label | {submit} | UI-0107, UI-0108, UI-0109, UI-0110, UI-0111 |
| UI-0126 | DirectoryPanel | directory | {submit} | UI-0127, UI-0128, UI-0129, UI-0130 |
| UI-0140 | AccessWorkspace | access | {submit} | UI-0141, UI-0142, UI-0143, UI-0144 |
| UI-0153 | AccessApprovals | approvals | {submit} | UI-0154, UI-0155, UI-0156, UI-0157 |
| UI-0160 | WorkflowForm | workflow-form | {submit} | UI-0161, UI-0162, UI-0163, UI-0164, UI-0165, UI-0166, UI-0167, UI-0168, UI-0169, UI-0170, UI-0171 |
| UI-0179 | WorkflowDialog | workflow | {submit} | UI-0180, UI-0181, UI-0182, UI-0183 |
| UI-0189 | ReviewPanel | review | {submit} | UI-0190, UI-0191, UI-0192, UI-0193 |
| UI-0235 | SessionsPanel | sessions | {end} | UI-0236, UI-0237, UI-0238 |
| UI-0242 | EmployeeDialog | employee | {save} | UI-0243, UI-0244, UI-0245, UI-0246, UI-0247, UI-0248, UI-0249, UI-0250, UI-0251, UI-0252 |
| UI-0288 | AccountSecurity | account-security | {recover} | UI-0289, UI-0290, UI-0291, UI-0292, UI-0293 |
| UI-0308 | ReconciliationPanel | reconciliation | {retry} | UI-0309, UI-0310, UI-0311 |
| UI-0357 | App | workspace | {e=>{e.preventDefault();if(modal.type==='request'){const problem=correctionProblem(form,new Date());if(problem){setError(problem);return;}perform('/api/corrections','POST',{...form,reason:form.reason.trim()});}else perform('/api/corrections/'+modal.request.id,'PATCH',{decision:modal.decision,note:note.trim()});}} | UI-0358, UI-0359, UI-0360, UI-0361, UI-0362, UI-0363, UI-0364 |

## Nhóm chức năng, API và quyền

### auth-a — Khởi tạo, đăng nhập lại, tải lại và lỗi render Web A

Mount AuthGate dùng chung; check-sso không tương tác, Code + PKCE S256; backend xác nhận profile trước mở app. Mật khẩu/OTP chỉ tại Keycloak.

- Quyền: Trước đăng nhập; đăng nhập qua Keycloak.
- API: `OIDC authorization/token/logout qua keycloak-js`; `GET /api/profile (monitorSession)`.
- Nguồn: `web-a/src/main.jsx`, AuthGate (điểm mount tại main.jsx).
- Test liên quan: `tests/auth-controller.test.mjs`, `tests/auth-browser.cjs`. UI/live Đợt 1: **NOT_RUN**.

### auth-b — Xác thực, thiếu quyền và lỗi render Web B

Mount AuthGate dùng chung; check-sso không tương tác, Code + PKCE S256; backend xác nhận profile trước mở app. Mật khẩu/OTP chỉ tại Keycloak.

- Quyền: Trước đăng nhập; chỉ admin/auditor vào Web B.
- API: `OIDC authorization/token/logout qua keycloak-js`; `GET /api/profile (monitorSession)`.
- Nguồn: `web-b/src/main.jsx`, AuthGate (điểm mount tại main.jsx).
- Test liên quan: `tests/auth-controller.test.mjs`, `tests/auth-browser.cjs`. UI/live Đợt 1: **NOT_RUN**.

### workspace — Nghiệp vụ và biểu mẫu chính Web A

Chọn tháng; chấm vào/ra; tạo đơn (ngày, giờ vào/ra, lý do); rút đơn; duyệt/từ chối (ghi chú); lọc đơn; chuyển trang; lỗi/đăng nhập lại. Manager/admin duyệt trong phạm vi, cấm tự duyệt; chủ đơn rút pending.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/profile`; `GET /api/attendance?month=`; `GET /api/corrections`; `GET /api/team?month=`; `GET /api/security`; `GET /api/security/keycloak`; `GET /api/admin/users`; `POST /api/attendance/check-in`; `POST /api/attendance/check-out`; `POST /api/corrections`; `PATCH /api/corrections/:id`; `POST /api/corrections/:id/cancel`.
- Nguồn: `web-a/src/App.jsx`, App, Modal.
- Test liên quan: `backend/security.test.js`, `backend/operations.test.js`, `tests/frontend_ui.py`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### table — Tìm/xuất bảng công

Tìm theo ngày/tên/nhóm/trạng thái; CSV dữ liệu đã tải; bảng công nhóm chỉ manager/admin.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/attendance?month=`; `GET /api/team?month=`.
- Nguồn: `web-a/src/WorkspacePanels.jsx`, AttendanceTable.
- Test liên quan: `tests/frontend_ui.py`, `tests/frontend.test.mjs`. UI/live Đợt 1: **NOT_RUN**.

### admin-home — Thẻ tổng quan quản trị

Thẻ KPI, liên kết tài khoản/cảnh báo, mở Web B, xem và duyệt đơn.

- Quyền: admin.
- API: `GET /api/admin/users`; `GET /api/team`; `GET /api/security`; `GET /api/security/keycloak`.
- Nguồn: `web-a/src/AdminHome.jsx`, AdminHome.
- Test liên quan: `tests/frontend_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### security-app — Tổng quan, menu và tự cập nhật Web B

Menu theo quyền; tự cập nhật 20 giây; toast/retry; thẻ KPI; mở cảnh báo/tài khoản; chuyển Web A; mở các dialog.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/profile`; `GET /api/security`; `GET /api/security/keycloak`; `GET /api/admin/users (admin)`.
- Nguồn: `web-b/src/App.jsx`, App.
- Test liên quan: `backend/sso.test.js`, `tests/frontend_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### shell — Khung trang, menu, command palette và widget

Sidebar/mobile; Ctrl+K; tìm/xóa tìm; chọn app; refresh/logout; skip-link; Escape/backdrop/đóng modal; sort; kích thước trang; trước/sau; xuất CSV. Các mục sinh từ menu/columns/items lặp theo dữ liệu, không phải số nút runtime cố định.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `Không gọi API trực tiếp; callback từ trang; CSV local; đăng xuất qua Keycloak`.
- Nguồn: `shared/ui.jsx`, Frame, Dialog, Empty, Search, ExportButton, DataTable, StatCard, FeatureGrid.
- Test liên quan: `tests/frontend_ui.py`, `tests/frontend.test.mjs`, `tests/api-client.test.mjs`. UI/live Đợt 1: **NOT_RUN**.

### accounts — Danh sách tài khoản

Tìm tài khoản, lọc role/khóa, CSV, thêm nhân viên, mở hồ sơ/phiên và quản lý truy cập; admin được bảo vệ.

- Quyền: admin.
- API: `GET /api/admin/users`.
- Nguồn: `shared/admin.jsx`, AccountsPanel.
- Test liên quan: `tests/frontend_ui.py`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### alerts — Cảnh báo cục bộ và kết luận

Tìm/lọc trạng thái/mức độ; mở chi tiết, mở ngữ cảnh; chọn kết luận và ghi chú; lưu; quản lý tài khoản liên quan chỉ admin; auditor đọc.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/alert-list`; `GET /api/security/alerts/:id/context`; `PATCH /api/security/alerts/:id (admin)`.
- Nguồn: `shared/admin.jsx`, AlertsPanel, AlertDialog.
- Test liên quan: `backend/security.test.js`, `backend/operations.test.js`, `tests/frontend_ui.py`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### events-local — Bảng sự kiện cũ

Tìm/lọc/CSV local. Component được khai báo nhưng hiện các trang dùng RemoteExplorer thay thế; chưa thấy callsite hoạt động.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security`.
- Nguồn: `shared/admin.jsx`, EventsPanel.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### actions — Lịch sử xử lý cũ

Lọc pending/partial/synced; thử lại qua callback. Web B hiện dùng ReconciliationPanel; component cũ không được coi là luồng chính.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security`; `POST /api/admin/users/:id/actions (admin, qua dialog)`.
- Nguồn: `shared/admin.jsx`, ActionsPanel.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### identity — Kết nối Keycloak

Card chỉ đọc trạng thái và chính sách; không có nút ghi.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/keycloak`.
- Nguồn: `shared/admin.jsx`, IdentityCard.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### account-action — Khóa/mở/thu hồi phiên/yêu cầu MFA

Radio chọn hành động; lý do; hủy/xác nhận; LDAP không cho require-mfa tại local; khóa/mở có tác động thật, không chạy Đợt 1.

- Quyền: admin; cấm xử lý admin/chính mình/vòng đời hold.
- API: `POST /api/admin/users/:id/actions`.
- Nguồn: `shared/admin.jsx`, AccountDialog.
- Test liên quan: `backend/security.test.js`, `tests/frontend_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### notifications — Thông báo

Mở/đóng chuông; làm mới danh sách; đọc từng thông báo; đánh dấu tất cả; điều hướng theo section; scope theo tài khoản/audience.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/notifications`; `PATCH /api/notifications/:id/read`; `POST /api/notifications/read-all`.
- Nguồn: `shared/operations.jsx`, NotificationBell.
- Test liên quan: `backend/operations.test.js`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### explorer — Tra cứu lịch sử trên server

Tìm, trạng thái/loại, mức độ, user/client/IP/role, từ/đến ngày, sort, reset lọc, refresh, phân trang, CSV tối đa 200 dòng, chi tiết truy cập/cảnh báo; không sửa log.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/events`; `GET /api/security/events/:id`; `GET /api/security/login-events`; `GET /api/security/alert-list`.
- Nguồn: `shared/operations.jsx`, RemoteExplorer, ReadTable.
- Test liên quan: `backend/operations.test.js`, `tests/frontend_ui.py`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### security-insights — Thống kê và đồng bộ Keycloak

Đọc thống kê; thử lại; admin kích hoạt collector, có ghi dữ liệu; auditor không được sync.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/summary`; `POST /api/security/sync (admin)`.
- Nguồn: `shared/operations.jsx`, SecurityInsights.
- Test liên quan: `backend/operations.test.js`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### sessions — Phiên cá nhân và phiên nhân viên

Refresh; chọn kết thúc phiên; lý do; hủy/xác nhận; phiên hiện tại đưa về đăng nhập; cấm thu hồi phiên không thuộc user; readOnly bảo vệ admin/hold.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/me/sessions`; `POST /api/me/sessions/revoke`; `GET /api/admin/users/:id/sessions (admin)`; `POST /api/admin/users/:id/sessions/revoke (admin)`.
- Nguồn: `shared/operations.jsx`, SessionsPanel.
- Test liên quan: `backend/operations.test.js`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### profile — Hồ sơ cá nhân

Hiển thị nguồn LDAP, nhúng AccountSecurity và SessionsPanel.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/profile`; `GET /api/me/security`; `GET /api/me/sessions`.
- Nguồn: `shared/operations.jsx`, PersonalProfile.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### employee — Thêm/sửa nhân viên và hồ sơ quản trị

Tab hồ sơ/phiên/bảo mật/lịch sử/password; tạo với username/email/họ tên/nhóm/role/password tạm; sửa hồ sơ; reset password có lý do; hủy/lưu. Trường password chỉ là tên trường, không có giá trị trong kiểm kê.

- Quyền: admin; LDAP READ_ONLY, admin/hold được bảo vệ.
- API: `GET /api/admin/users/:id`; `POST /api/admin/users`; `PATCH /api/admin/users/:id`; `POST /api/admin/users/:id/reset-password`.
- Nguồn: `shared/operations.jsx`, EmployeeDialog, field.
- Test liên quan: `backend/operations.test.js`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### account-security — MFA và khôi phục thiết bị

Cập nhật/thử lại; đăng ký OTP cá nhân; admin mở recovery, nhập tham chiếu xác minh/lý do, xác thực lại và xác nhận. Backend yêu cầu admin có OTP và auth_time trong 2 phút.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/me/security`; `GET /api/admin/users/:id/security (admin)`; `POST /api/admin/users/:id/mfa/recovery (admin)`; `Keycloak CONFIGURE_TOTP/prompt=login`.
- Nguồn: `shared/week5.jsx`, AccountSecurity.
- Test liên quan: `backend/week5-10.test.js`, `tests/operations_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### access-matrix — Ma trận quyền

Tìm theo user/nhóm, role, CSV trang hiện tại, trước/sau.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/access-matrix`.
- Nguồn: `shared/week5.jsx`, AccessMatrix.
- Test liên quan: `tests/release_live.py`. UI/live Đợt 1: **NOT_RUN**.

### reconciliation — Đối chiếu thao tác tài khoản

Lọc trạng thái; refresh/phân trang; admin đọc Keycloak, so sánh local/remote, nhập căn cứ và xử lý lại với version; auditor đọc lịch sử.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/actions`; `GET /api/admin/users/:id/reconciliation (admin)`; `POST /api/admin/users/:id/actions/:actionId/retry (admin)`.
- Nguồn: `shared/week5.jsx`, ReconciliationPanel.
- Test liên quan: `tests/release_live.py`, `tests/frontend_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### analytics — Biểu đồ bảo mật

Số liệu/biểu đồ read-only, retry lỗi dùng callback của nơi nhúng.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/analytics`.
- Nguồn: `shared/week5.jsx`, SecurityAnalytics, Problem, Waiting.
- Test liên quan: `tests/release_live.py`. UI/live Đợt 1: **NOT_RUN**.

### insights — Thống kê công cá nhân

Đọc KPI/biểu đồ cá nhân theo tháng, retry.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/me/workspace?month=`.
- Nguồn: `shared/week5.jsx`, WorkspaceInsights.
- Test liên quan: `tests/release_live.py`. UI/live Đợt 1: **NOT_RUN**.

### calendar — Lịch công và đơn theo ngày

Chọn ngày, xem giờ công và timeline đơn, retry.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/me/workspace?month=`.
- Nguồn: `shared/week5.jsx`, WorkspaceCalendar, RequestTimeline.
- Test liên quan: `tests/release_live.py`. UI/live Đợt 1: **NOT_RUN**.

### role-overview — Tổng quan theo vai trò

Manager mở nhóm; auditor mở bảo mật; employee mở bảng công.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/profile`; `GET /api/team (manager/admin)`.
- Nguồn: `shared/week5.jsx`, RoleOverview.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### directory — Danh bạ, federation và mapping LDAP

Ba view; search/state filter, phân trang user; refresh; full/changed sync và lý do chỉ admin; mapping read-only; dialog/hủy/xác nhận; không ghi LDAP trực tiếp.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/directory`; `GET /api/security/directory/users`; `GET /api/security/directory/jobs`; `GET /api/security/directory/mappings`; `POST /api/security/directory/sync (admin)`.
- Nguồn: `shared/directory.jsx`, DirectoryPanel, DirectoryUsers.
- Test liên quan: `tests/release_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### access — Yêu cầu quyền cá nhân

Chọn tài nguyên, thời hạn 1–30 ngày, lý do; gửi/rút pending; mở tài nguyên đã cấp; xem lịch sử.

- Quyền: Mọi role Web A; quyền có thời hạn không mở Web B.
- API: `GET /api/me/access`; `POST /api/me/access/requests`; `POST /api/me/access/requests/:id/cancel`; `GET /api/access/resources/:resource`.
- Nguồn: `shared/governance.jsx`, AccessWorkspace.
- Test liên quan: `backend/week5-10.test.js`, `tests/governance_live.py`. UI/live Đợt 1: **NOT_RUN**.

### approvals — Phê duyệt quyền

Tìm/lọc trạng thái; trước/sau; duyệt/từ chối/thu hồi; nhập lý do, hủy/xác nhận.

- Quyền: manager/admin Web A; admin Web B; cấm tự duyệt, giới hạn nhóm.
- API: `GET /api/governance/approvals`; `POST /api/governance/requests/:id/decision`.
- Nguồn: `shared/governance.jsx`, AccessApprovals.
- Test liên quan: `backend/week5-10.test.js`, `tests/governance_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### workflow-form — Lập Join/Change/Leave

Chọn kind/source/target, username/họ tên/email/nhóm/role/lý do; lập yêu cầu, hủy. Join mặc định employee.

- Quyền: admin.
- API: `POST /api/security/governance/workflows`.
- Nguồn: `shared/governance.jsx`, WorkflowForm.
- Test liên quan: `backend/week5-10.test.js`, `tests/governance_live.py`. UI/live Đợt 1: **NOT_RUN**.

### workflow — Chi tiết và thực hiện vòng đời

Refresh/đọc hiện trạng; admin phê duyệt/từ chối/thực hiện/tiếp tục; note và password tạm cho Join local; sao chép lệnh operator LDAP; không tự chạy lệnh operator.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/governance/workflows/:id`; `GET /api/security/governance/workflows/:id/observed`; `POST /api/security/governance/workflows/:id/decision (admin)`; `POST /api/security/governance/workflows/:id/execute (admin)`.
- Nguồn: `shared/governance.jsx`, WorkflowDialog.
- Test liên quan: `backend/week5-10.test.js`, `tests/governance_live.py`. UI/live Đợt 1: **NOT_RUN**.

### review — Rà soát quyền

Chọn/tạo đợt; phân trang; ghi keep/revoke/investigate và căn cứ; admin thu hồi thật qua dialog riêng.

- Quyền: admin, auditor tạo snapshot/ghi khuyến nghị; thu hồi grant chỉ admin.
- API: `GET /api/security/governance/reviews`; `POST /api/security/governance/reviews`; `GET /api/security/governance/reviews/:id`; `POST /api/security/governance/review-items/:id`; `POST /api/governance/requests/:id/decision (admin)`.
- Nguồn: `shared/governance.jsx`, ReviewPanel.
- Test liên quan: `tests/release_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### governance — Danh sách vòng đời/ma trận grant

Search/state, phân trang, refresh, mở workflow và lập mới (admin); ma trận read-only; Note/Pager được nhúng nhiều luồng với quyền nơi gọi.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/governance`; `GET /api/security/governance/workflows`; `GET /api/security/governance/matrix`.
- Nguồn: `shared/governance.jsx`, GovernancePanel, Pager, Rows, Note, Feedback, State.
- Test liên quan: `tests/release_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### central — Audit PostgreSQL và bộ lọc

Tab overview/events/incidents/health; lọc q/source/decision/user/request/session/from/to; áp dụng, phân trang, chuẩn bị/xuất CSV tối đa 5000; mở event; admin gửi lại outbox.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/central/health`; `GET /api/security/central/events`; `GET /api/security/central/summary`; `POST /api/security/central/retry (admin)`.
- Nguồn: `shared/central-audit.jsx`, CentralAudit, AuditFeedback, AuditTable, AuditPager.
- Test liên quan: `tests/audit_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### event-detail — Điều tra sự kiện PostgreSQL

Đọc trường sự kiện và tối đa 100 sự kiện cùng request/phiên; đóng dialog.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/central/events/:id`.
- Nguồn: `shared/central-audit.jsx`, EventDetail.
- Test liên quan: `tests/audit_live.py`. UI/live Đợt 1: **NOT_RUN**.

### central-incidents — Danh sách cảnh báo tập trung

Lọc trạng thái, phân trang, mở log gốc, mở lịch sử/xử lý.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/central/incidents`.
- Nguồn: `shared/central-audit.jsx`, CentralIncidents.
- Test liên quan: `tests/audit_live.py`. UI/live Đợt 1: **NOT_RUN**.

### incident-review — Kết luận incident PostgreSQL

Đọc lịch sử; admin chọn state/ghi căn cứ/lưu với version; xung đột tải lại.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/central/incidents/:id`; `POST /api/security/central/incidents/:id (admin)`.
- Nguồn: `shared/central-audit.jsx`, IncidentReview.
- Test liên quan: `tests/audit_live.py`. UI/live Đợt 1: **NOT_RUN**.

### audit-settings — Ngưỡng cảnh báo và retention

Chỉnh retention/login/deny threshold, lưu; xem trước retention; ô xác nhận và nút xóa log hết hạn có tác động phá hủy, TUYỆT ĐỐI KHÔNG chạy trong Đợt 1.

- Quyền: admin.
- API: `POST /api/security/central/settings`; `POST /api/security/central/retention`.
- Nguồn: `shared/central-audit.jsx`, AuditSettings.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### audit-backfill — Lấy bù collector

Chọn nguồn, thời điểm, lý do; đặt checkpoint; có ghi dữ liệu, không chạy Đợt 1.

- Quyền: admin.
- API: `POST /api/security/central/backfill`.
- Nguồn: `shared/central-audit.jsx`, AuditBackfill.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### detection — Kết quả, lượt chạy và đánh giá Detection

Tab kết quả/metrics/runs/config; lọc Normal/Anomaly, phân trang, features/gán nhãn, log gốc; admin chạy batch/tính metrics; CSV metrics; dữ liệu mô phỏng không chứng minh độ chính xác thực tế.

- Quyền: admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng.
- API: `GET /api/security/central/detection/status`; `GET /api/security/central/detection/results`; `GET /api/security/central/detection/evaluations`; `POST /api/security/central/detection/run (admin)`; `POST /api/security/central/detection/evaluate (admin)`.
- Nguồn: `shared/detection.jsx`, DetectionPanel.
- Test liên quan: `tests/test_detection.py`, `tests/audit_live.py`, `tests/release_ui.py`. UI/live Đợt 1: **NOT_RUN**.

### detection-config — Cấu hình luật Detection

Enabled; login/deny/request threshold; giờ bắt đầu/kết thúc; UTC offset; lưu version; không kích hoạt trong Đợt 1.

- Quyền: admin ghi; auditor xem.
- API: `POST /api/security/central/detection/config`.
- Nguồn: `shared/detection.jsx`, DetectionConfig.
- Test liên quan: Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp. UI/live Đợt 1: **NOT_RUN**.

### label — Đặc trưng và nhãn độc lập

Chọn Normal/Anomaly, train/evaluation, scenario và căn cứ; lưu version. Đây là ghi nhãn, ngoại lệ đối với mô tả auditor chỉ đọc.

- Quyền: admin, auditor theo backend reader.
- API: `POST /api/security/central/detection/labels/:eventId`.
- Nguồn: `shared/detection.jsx`, LabelDialog.
- Test liên quan: `tests/audit_live.py`. UI/live Đợt 1: **NOT_RUN**.

### auth-shared — Trang bắt đầu và trạng thái xác thực dùng chung

Welcome/checking/authenticating/expired/unavailable/denied/required/error; login/retry/logout/reload/chuyển app. Không có input mật khẩu/OTP. Khi mất mạng, tạm đóng modal và giữ nội dung để phục hồi.

- Quyền: Chưa đăng nhập; Web A mọi role đã cấp, Web B admin/auditor.
- API: `GET /realms/:realm/.well-known/openid-configuration`; `OIDC authorization/token/logout qua keycloak-js`; `GET /api/profile`.
- Nguồn: `shared/auth.jsx`, AuthScreen, AuthGate, AuthBoundary.
- Test liên quan: `tests/auth-controller.test.mjs`, `tests/session-monitor.test.mjs`, `tests/auth-browser.cjs`. UI/live Đợt 1: **NOT_RUN**.

### workspace-panels — Đơn cá nhân và duyệt đơn theo nhóm

Lọc, phân trang, tiến trình, rút đơn có xác nhận; không tự duyệt; CSV và bảng công theo bộ lọc.

- Quyền: employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor.
- API: `GET /api/corrections`; `GET /api/team?month=`; `Callback App: POST /api/corrections/:id/cancel, PATCH /api/corrections/:id`.
- Nguồn: `web-a/src/WorkspacePanels.jsx`, MyRequests, TeamWorkspace, CardPages.
- Test liên quan: `tests/workspace-browser.cjs`, `tests/workspace.test.mjs`. UI/live Đợt 1: **NOT_RUN**.

## Từng vị trí tương tác trong mã nguồn

### workspace

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0343 | Modal / Dialog | {title} | [web-a/src/App.jsx:27](../web-a/src/App.jsx#L27) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0344 | App / button | [button động; xem biểu thức] | [web-a/src/App.jsx:74](../web-a/src/App.jsx#L74) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0345 | App / button | Đăng nhập lại | [web-a/src/App.jsx:77](../web-a/src/App.jsx#L77) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0346 | App / button | Thử tải lại | [web-a/src/App.jsx:77](../web-a/src/App.jsx#L77) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0347 | App / button | Đóng thông báo | [web-a/src/App.jsx:78](../web-a/src/App.jsx#L78) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0348 | App / input | Tháng bảng công | [web-a/src/App.jsx:80](../web-a/src/App.jsx#L80) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0349 | App / button | Tạo đơn điều chỉnh | [web-a/src/App.jsx:81](../web-a/src/App.jsx#L81) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0350 | App / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-a/src/App.jsx:91](../web-a/src/App.jsx#L91) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0351 | App / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-a/src/App.jsx:91](../web-a/src/App.jsx#L91) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0352 | App / button | [button động; xem biểu thức] | [web-a/src/App.jsx:93](../web-a/src/App.jsx#L93) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0353 | App / button | Tạo đơn điều chỉnh | [web-a/src/App.jsx:96](../web-a/src/App.jsx#L96) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0354 | App / button | Xem tất cả | [web-a/src/App.jsx:97](../web-a/src/App.jsx#L97) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0355 | App / a | Mở Security | [web-a/src/App.jsx:102](../web-a/src/App.jsx#L102) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0356 | App / Modal | {modal.type==='request'?'Tạo đơn điều chỉnh':modal.decision==='approved'?'Duyệt đơn điều chỉnh':'Từ chối đơn'} | [web-a/src/App.jsx:107](../web-a/src/App.jsx#L107) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0357 | App / form | Quản lý sẽ xem xét đề nghị trước khi bảng công được cập nhật. Ngày cần điều chỉnh Giờ vào Giờ ra Lý do điều chỉnh /500 ký tự Có thể gửi đề nghị cho 31 ngày gần nhất. Thời gian chỉ  | [web-a/src/App.jsx:107](../web-a/src/App.jsx#L107) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0358 | App / input | Ngày cần điều chỉnh | [web-a/src/App.jsx:108](../web-a/src/App.jsx#L108) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0359 | App / input | Giờ vào | [web-a/src/App.jsx:108](../web-a/src/App.jsx#L108) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0360 | App / input | Giờ ra | [web-a/src/App.jsx:108](../web-a/src/App.jsx#L108) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0361 | App / textarea | Lý do điều chỉnh | [web-a/src/App.jsx:108](../web-a/src/App.jsx#L108) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0362 | App / textarea | Ghi chú duyệt đơn | [web-a/src/App.jsx:108](../web-a/src/App.jsx#L108) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0363 | App / button | Hủy | [web-a/src/App.jsx:109](../web-a/src/App.jsx#L109) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0364 | App / button | [button động; xem biểu thức] | [web-a/src/App.jsx:109](../web-a/src/App.jsx#L109) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0365 | App / Modal | Kết thúc ca làm việc? | [web-a/src/App.jsx:110](../web-a/src/App.jsx#L110) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0366 | App / button | Tiếp tục làm việc | [web-a/src/App.jsx:110](../web-a/src/App.jsx#L110) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0367 | App / button | [button động; xem biểu thức] | [web-a/src/App.jsx:110](../web-a/src/App.jsx#L110) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0368 | App / Modal | Rút đơn điều chỉnh | [web-a/src/App.jsx:111](../web-a/src/App.jsx#L111) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0369 | App / button | Giữ lại đơn | [web-a/src/App.jsx:111](../web-a/src/App.jsx#L111) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |
| UI-0370 | App / button | Xác nhận rút đơn | [web-a/src/App.jsx:111](../web-a/src/App.jsx#L111) | Theo nhóm workspace; REVIEWED; UI NOT_RUN |

### table

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0374 | AttendanceTable / Search | {team?'Tìm bảng công nhân viên':'Tìm bảng công'} | [web-a/src/WorkspacePanels.jsx:20](../web-a/src/WorkspacePanels.jsx#L20) | Theo nhóm table; REVIEWED; UI NOT_RUN |
| UI-0375 | AttendanceTable / select | {team?'Lọc bảng công nhân viên':'Lọc bảng công'} | [web-a/src/WorkspacePanels.jsx:20](../web-a/src/WorkspacePanels.jsx#L20) | Theo nhóm table; REVIEWED; UI NOT_RUN |
| UI-0376 | AttendanceTable / button | Xóa bộ lọc | [web-a/src/WorkspacePanels.jsx:20](../web-a/src/WorkspacePanels.jsx#L20) | Theo nhóm table; REVIEWED; UI NOT_RUN |
| UI-0377 | AttendanceTable / ExportButton | [ExportButton động; xem biểu thức] | [web-a/src/WorkspacePanels.jsx:20](../web-a/src/WorkspacePanels.jsx#L20) | Theo nhóm table; REVIEWED; UI NOT_RUN |
| UI-0378 | AttendanceTable / DataTable | {team?'Bảng công nhân viên':'Bảng công cá nhân'} | [web-a/src/WorkspacePanels.jsx:20](../web-a/src/WorkspacePanels.jsx#L20) | Theo nhóm table; REVIEWED; UI NOT_RUN |

### admin-home

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0333 | AdminHome / button | Quản lý nhân viên | [web-a/src/AdminHome.jsx:9](../web-a/src/AdminHome.jsx#L9) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0334 | AdminHome / a | Mở Nhịp Security | [web-a/src/AdminHome.jsx:9](../web-a/src/AdminHome.jsx#L9) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0335 | AdminHome / StatCard | Nhân viên trong hệ thống | [web-a/src/AdminHome.jsx:10](../web-a/src/AdminHome.jsx#L10) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0336 | AdminHome / StatCard | Đơn chờ bạn duyệt | [web-a/src/AdminHome.jsx:10](../web-a/src/AdminHome.jsx#L10) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0337 | AdminHome / StatCard | Cảnh báo đang mở | [web-a/src/AdminHome.jsx:10](../web-a/src/AdminHome.jsx#L10) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0338 | AdminHome / StatCard | Tài khoản đang khóa | [web-a/src/AdminHome.jsx:10](../web-a/src/AdminHome.jsx#L10) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0339 | AdminHome / button | Tất cả chức năng | [web-a/src/AdminHome.jsx:11](../web-a/src/AdminHome.jsx#L11) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0340 | AdminHome / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-a/src/AdminHome.jsx:12](../web-a/src/AdminHome.jsx#L12) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0341 | AdminHome / button | Xem & duyệt | [web-a/src/AdminHome.jsx:13](../web-a/src/AdminHome.jsx#L13) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |
| UI-0342 | AdminHome / button | Xem toàn bộ đề nghị | [web-a/src/AdminHome.jsx:13](../web-a/src/AdminHome.jsx#L13) | Theo nhóm admin-home; REVIEWED; UI NOT_RUN |

### security-app

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0394 | App / button | [button động; xem biểu thức] | [web-b/src/App.jsx:68](../web-b/src/App.jsx#L68) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0395 | App / button | [button động; xem biểu thức] | [web-b/src/App.jsx:70](../web-b/src/App.jsx#L70) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0396 | App / button | Đóng thông báo | [web-b/src/App.jsx:71](../web-b/src/App.jsx#L71) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0397 | App / input | Tự cập nhật 20 giây | [web-b/src/App.jsx:72](../web-b/src/App.jsx#L72) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0398 | App / button | Xem cảnh báo cần xử lý | [web-b/src/App.jsx:74](../web-b/src/App.jsx#L74) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0399 | App / StatCard | Cảnh báo đang mở | [web-b/src/App.jsx:75](../web-b/src/App.jsx#L75) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0400 | App / StatCard | Yêu cầu bị từ chối | [web-b/src/App.jsx:75](../web-b/src/App.jsx#L75) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0401 | App / StatCard | {isAdmin?'Tài khoản nhân viên':'Sự kiện gần đây'} | [web-b/src/App.jsx:75](../web-b/src/App.jsx#L75) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0402 | App / StatCard | Chưa đồng bộ | [web-b/src/App.jsx:75](../web-b/src/App.jsx#L75) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0403 | App / button | Tất cả chức năng | [web-b/src/App.jsx:76](../web-b/src/App.jsx#L76) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0404 | App / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-b/src/App.jsx:76](../web-b/src/App.jsx#L76) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0405 | App / button | Xem tất cả | [web-b/src/App.jsx:77](../web-b/src/App.jsx#L77) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0406 | App / button | · | [web-b/src/App.jsx:77](../web-b/src/App.jsx#L77) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0407 | App / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-b/src/App.jsx:79](../web-b/src/App.jsx#L79) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |
| UI-0408 | App / FeatureGrid | [FeatureGrid động; xem biểu thức] | [web-b/src/App.jsx:79](../web-b/src/App.jsx#L79) | Theo nhóm security-app; REVIEWED; UI NOT_RUN |

### shell

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0253 | Dialog / dialog | [dialog động; xem biểu thức] | [shared/ui.jsx:16](../shared/ui.jsx#L16) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0254 | Dialog / button | Đóng | [shared/ui.jsx:17](../shared/ui.jsx#L17) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0255 | Empty / button | Xóa bộ lọc | [shared/ui.jsx:22](../shared/ui.jsx#L22) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0256 | Search / input | {label} | [shared/ui.jsx:25](../shared/ui.jsx#L25) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0257 | Search / button | Xóa tìm kiếm | [shared/ui.jsx:25](../shared/ui.jsx#L25) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0258 | ExportButton / button | Xuất CSV | [shared/ui.jsx:27](../shared/ui.jsx#L27) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0259 | DataTable / button | [button động; xem biểu thức] | [shared/ui.jsx:34](../shared/ui.jsx#L34) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0260 | DataTable / select | Số dòng mỗi trang | [shared/ui.jsx:34](../shared/ui.jsx#L34) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0261 | DataTable / button | Trang trước | [shared/ui.jsx:34](../shared/ui.jsx#L34) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0262 | DataTable / button | Trang sau | [shared/ui.jsx:34](../shared/ui.jsx#L34) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0263 | StatCard / button | [button động; xem biểu thức] | [shared/ui.jsx:38](../shared/ui.jsx#L38) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0264 | FeatureGrid / a | [a động; xem biểu thức] | [shared/ui.jsx:41](../shared/ui.jsx#L41) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0265 | FeatureGrid / button | [button động; xem biểu thức] | [shared/ui.jsx:41](../shared/ui.jsx#L41) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0266 | Frame / button | {item.label} | [shared/ui.jsx:50](../shared/ui.jsx#L50) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0267 | Frame / a | {'Nhịp '+app} | [shared/ui.jsx:51](../shared/ui.jsx#L51) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0268 | Frame / a | Đến nội dung chính | [shared/ui.jsx:53](../shared/ui.jsx#L53) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0269 | Frame / button | Chuyển ứng dụng | [shared/ui.jsx:54](../shared/ui.jsx#L54) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0270 | Frame / button | Mở menu | [shared/ui.jsx:55](../shared/ui.jsx#L55) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0271 | Frame / button | Tìm chức năng | [shared/ui.jsx:55](../shared/ui.jsx#L55) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0272 | Frame / button | Chọn ứng dụng | [shared/ui.jsx:55](../shared/ui.jsx#L55) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0273 | Frame / button | Làm mới dữ liệu | [shared/ui.jsx:55](../shared/ui.jsx#L55) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0274 | Frame / button | Đăng xuất | [shared/ui.jsx:55](../shared/ui.jsx#L55) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0275 | Frame / button | Đăng nhập lại | [shared/ui.jsx:57](../shared/ui.jsx#L57) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0276 | Frame / Dialog | Điều hướng | [shared/ui.jsx:59](../shared/ui.jsx#L59) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0277 | Frame / button | Chọn ứng dụng | [shared/ui.jsx:59](../shared/ui.jsx#L59) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0278 | Frame / Dialog | Chọn không gian của bạn | [shared/ui.jsx:60](../shared/ui.jsx#L60) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0279 | Frame / a | Mở không gian | [shared/ui.jsx:60](../shared/ui.jsx#L60) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0280 | Frame / Dialog | Bạn muốn làm gì? | [shared/ui.jsx:61](../shared/ui.jsx#L61) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0281 | Frame / Search | Tìm chức năng trong hệ thống | [shared/ui.jsx:61](../shared/ui.jsx#L61) | Theo nhóm shell; REVIEWED; UI NOT_RUN |
| UI-0282 | Frame / button | [button động; xem biểu thức] | [shared/ui.jsx:61](../shared/ui.jsx#L61) | Theo nhóm shell; REVIEWED; UI NOT_RUN |

### accounts

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0001 | AccountsPanel / button | Hồ sơ & phiên | [shared/admin.jsx:14](../shared/admin.jsx#L14) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0002 | AccountsPanel / button | Quản lý truy cập | [shared/admin.jsx:14](../shared/admin.jsx#L14) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0003 | AccountsPanel / button | Thêm nhân viên | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0004 | AccountsPanel / Search | Tìm tài khoản | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0005 | AccountsPanel / select | Lọc vai trò | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0006 | AccountsPanel / select | Lọc trạng thái tài khoản | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0007 | AccountsPanel / button | Xóa bộ lọc | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0008 | AccountsPanel / ExportButton | [ExportButton động; xem biểu thức] | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |
| UI-0009 | AccountsPanel / DataTable | Tài khoản nhân viên | [shared/admin.jsx:15](../shared/admin.jsx#L15) | Theo nhóm accounts; REVIEWED; UI NOT_RUN |

### alerts

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0010 | AlertsPanel / button | [button động; xem biểu thức] | [shared/admin.jsx:20](../shared/admin.jsx#L20) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0011 | AlertsPanel / Search | Tìm cảnh báo | [shared/admin.jsx:21](../shared/admin.jsx#L21) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0012 | AlertsPanel / select | Trạng thái cảnh báo | [shared/admin.jsx:21](../shared/admin.jsx#L21) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0013 | AlertsPanel / select | Mức độ cảnh báo | [shared/admin.jsx:21](../shared/admin.jsx#L21) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0014 | AlertsPanel / DataTable | Cảnh báo truy cập | [shared/admin.jsx:21](../shared/admin.jsx#L21) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0030 | AlertDialog / Dialog | Chi tiết cảnh báo | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0031 | AlertDialog / summary | Hoạt động liên quan đến tài khoản | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0032 | AlertDialog / form | Kết luận điều tra Ghi chú điều tra Lưu kết luận không tự thay đổi quyền hoặc trạng thái tài khoản. Quản lý tài khoản liên quan Đóng | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0033 | AlertDialog / select | Kết luận điều tra | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0034 | AlertDialog / textarea | Ghi chú điều tra | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0035 | AlertDialog / button | Quản lý tài khoản liên quan | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0036 | AlertDialog / button | Đóng | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0037 | AlertDialog / button | [button động; xem biểu thức] | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |
| UI-0038 | AlertDialog / button | Đóng | [shared/admin.jsx:51](../shared/admin.jsx#L51) | Theo nhóm alerts; REVIEWED; UI NOT_RUN |

### events-local

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0015 | EventsPanel / Search | Tìm nhật ký | [shared/admin.jsx:28](../shared/admin.jsx#L28) | Theo nhóm events-local; REVIEWED; UI NOT_RUN |
| UI-0016 | EventsPanel / select | Kết quả truy cập | [shared/admin.jsx:28](../shared/admin.jsx#L28) | Theo nhóm events-local; REVIEWED; UI NOT_RUN |
| UI-0017 | EventsPanel / ExportButton | [ExportButton động; xem biểu thức] | [shared/admin.jsx:28](../shared/admin.jsx#L28) | Theo nhóm events-local; REVIEWED; UI NOT_RUN |
| UI-0018 | EventsPanel / DataTable | Nhật ký truy cập | [shared/admin.jsx:28](../shared/admin.jsx#L28) | Theo nhóm events-local; REVIEWED; UI NOT_RUN |

### actions

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0019 | ActionsPanel / button | Thử đồng bộ lại | [shared/admin.jsx:33](../shared/admin.jsx#L33) | Theo nhóm actions; REVIEWED; UI NOT_RUN |
| UI-0020 | ActionsPanel / select | Trạng thái đồng bộ | [shared/admin.jsx:34](../shared/admin.jsx#L34) | Theo nhóm actions; REVIEWED; UI NOT_RUN |
| UI-0021 | ActionsPanel / DataTable | Lịch sử xử lý tài khoản | [shared/admin.jsx:34](../shared/admin.jsx#L34) | Theo nhóm actions; REVIEWED; UI NOT_RUN |

### account-action

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0022 | AccountDialog / Dialog | Tài khoản có biện pháp chặn vòng đời | [shared/admin.jsx:41](../shared/admin.jsx#L41) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0023 | AccountDialog / button | Đóng | [shared/admin.jsx:41](../shared/admin.jsx#L41) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0024 | AccountDialog / Dialog | Quản lý truy cập | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0025 | AccountDialog / form | 1. Chọn biện pháp xử lý 2. Lý do thực hiện Tối thiểu 10 ký tự. Lý do được lưu trong nhật ký. /300 Hủy | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0026 | AccountDialog / input | access-action | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0027 | AccountDialog / textarea | Lý do thực hiện | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0028 | AccountDialog / button | Hủy | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |
| UI-0029 | AccountDialog / button | [button động; xem biểu thức] | [shared/admin.jsx:43](../shared/admin.jsx#L43) | Theo nhóm account-action; REVIEWED; UI NOT_RUN |

### notifications

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0203 | NotificationBell / button | Thông báo | [shared/operations.jsx:16](../shared/operations.jsx#L16) | Theo nhóm notifications; REVIEWED; UI NOT_RUN |
| UI-0204 | NotificationBell / Dialog | Thông báo của bạn | [shared/operations.jsx:16](../shared/operations.jsx#L16) | Theo nhóm notifications; REVIEWED; UI NOT_RUN |
| UI-0205 | NotificationBell / button | Làm mới thông báo | [shared/operations.jsx:16](../shared/operations.jsx#L16) | Theo nhóm notifications; REVIEWED; UI NOT_RUN |
| UI-0206 | NotificationBell / button | Đánh dấu tất cả đã đọc | [shared/operations.jsx:16](../shared/operations.jsx#L16) | Theo nhóm notifications; REVIEWED; UI NOT_RUN |
| UI-0207 | NotificationBell / button | · | [shared/operations.jsx:16](../shared/operations.jsx#L16) | Theo nhóm notifications; REVIEWED; UI NOT_RUN |

### explorer

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0208 | ReadTable / button | [button động; xem biểu thức] | [shared/operations.jsx:20](../shared/operations.jsx#L20) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0209 | RemoteExplorer / button | [button động; xem biểu thức] | [shared/operations.jsx:33](../shared/operations.jsx#L33) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0210 | RemoteExplorer / button | Chi tiết | [shared/operations.jsx:37](../shared/operations.jsx#L37) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0211 | RemoteExplorer / button | {'Làm mới '+label.toLowerCase()} | [shared/operations.jsx:43](../shared/operations.jsx#L43) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0212 | RemoteExplorer / Search | {isAlert?'Tìm cảnh báo':isLogin?'Tìm đăng nhập':'Tìm nhật ký'} | [shared/operations.jsx:44](../shared/operations.jsx#L44) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0213 | RemoteExplorer / select | {isAlert?'Trạng thái cảnh báo':isLogin?'Loại sự kiện đăng nhập':'Kết quả truy cập'} | [shared/operations.jsx:45](../shared/operations.jsx#L45) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0214 | RemoteExplorer / select | Mức độ cảnh báo | [shared/operations.jsx:46](../shared/operations.jsx#L46) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0215 | RemoteExplorer / input | Lọc đúng tài khoản | [shared/operations.jsx:47](../shared/operations.jsx#L47) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0216 | RemoteExplorer / select | Ứng dụng xác thực | [shared/operations.jsx:48](../shared/operations.jsx#L48) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0217 | RemoteExplorer / input | Lọc địa chỉ IP | [shared/operations.jsx:48](../shared/operations.jsx#L48) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0218 | RemoteExplorer / select | Vai trò truy cập | [shared/operations.jsx:49](../shared/operations.jsx#L49) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0219 | RemoteExplorer / input | Từ ngày | [shared/operations.jsx:50](../shared/operations.jsx#L50) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0220 | RemoteExplorer / input | Đến ngày | [shared/operations.jsx:50](../shared/operations.jsx#L50) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0221 | RemoteExplorer / button | Xóa bộ lọc | [shared/operations.jsx:51](../shared/operations.jsx#L51) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0222 | RemoteExplorer / button | [button động; xem biểu thức] | [shared/operations.jsx:51](../shared/operations.jsx#L51) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0223 | RemoteExplorer / button | Thử lại | [shared/operations.jsx:53](../shared/operations.jsx#L53) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0224 | RemoteExplorer / select | Số dòng mỗi trang | [shared/operations.jsx:56](../shared/operations.jsx#L56) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0225 | RemoteExplorer / button | Trang trước | [shared/operations.jsx:56](../shared/operations.jsx#L56) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0226 | RemoteExplorer / button | Trang sau | [shared/operations.jsx:56](../shared/operations.jsx#L56) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |
| UI-0227 | RemoteExplorer / Dialog | Chi tiết truy cập | [shared/operations.jsx:58](../shared/operations.jsx#L58) | Theo nhóm explorer; REVIEWED; UI NOT_RUN |

### security-insights

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0228 | SecurityInsights / button | [button động; xem biểu thức] | [shared/operations.jsx:68](../shared/operations.jsx#L68) | Theo nhóm security-insights; REVIEWED; UI NOT_RUN |
| UI-0229 | SecurityInsights / button | Thử lại | [shared/operations.jsx:68](../shared/operations.jsx#L68) | Theo nhóm security-insights; REVIEWED; UI NOT_RUN |
| UI-0230 | SecurityInsights / StatCard | Tổng yêu cầu | [shared/operations.jsx:68](../shared/operations.jsx#L68) | Theo nhóm security-insights; REVIEWED; UI NOT_RUN |
| UI-0231 | SecurityInsights / StatCard | Yêu cầu bị chặn | [shared/operations.jsx:68](../shared/operations.jsx#L68) | Theo nhóm security-insights; REVIEWED; UI NOT_RUN |
| UI-0232 | SecurityInsights / StatCard | Cảnh báo đang mở | [shared/operations.jsx:68](../shared/operations.jsx#L68) | Theo nhóm security-insights; REVIEWED; UI NOT_RUN |

### sessions

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0233 | SessionsPanel / button | Làm mới phiên | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |
| UI-0234 | SessionsPanel / button | Kết thúc phiên | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |
| UI-0235 | SessionsPanel / form | Xác nhận kết thúc phiên IP: · Lý do kết thúc phiên Hủy kết thúc phiên | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |
| UI-0236 | SessionsPanel / textarea | Lý do kết thúc phiên | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |
| UI-0237 | SessionsPanel / button | Hủy kết thúc phiên | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |
| UI-0238 | SessionsPanel / button | [button động; xem biểu thức] | [shared/operations.jsx:77](../shared/operations.jsx#L77) | Theo nhóm sessions; REVIEWED; UI NOT_RUN |

### employee

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0239 | field / input | {label} | [shared/operations.jsx:89](../shared/operations.jsx#L89) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0240 | EmployeeDialog / Dialog | {user?'Hồ sơ nhân viên':'Thêm nhân viên'} | [shared/operations.jsx:93](../shared/operations.jsx#L93) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0241 | EmployeeDialog / button | [button động; xem biểu thức] | [shared/operations.jsx:94](../shared/operations.jsx#L94) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0242 | EmployeeDialog / form | Vai trò mới Từ 12 ký tự, có chữ hoa, chữ thường và số. Người dùng phải đổi mật khẩu khi đăng nhập; mật khẩu không được hiển thị trong log. Nhập đầy đủ họ và tên, ít nhất hai từ. Lý | [shared/operations.jsx:99](../shared/operations.jsx#L99) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0243 | EmployeeDialog / field() | 'Tên đăng nhập mới' | [shared/operations.jsx:100](../shared/operations.jsx#L100) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0244 | EmployeeDialog / field() | 'Email nhân viên' | [shared/operations.jsx:100](../shared/operations.jsx#L100) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0245 | EmployeeDialog / field() | 'Họ và tên' | [shared/operations.jsx:100](../shared/operations.jsx#L100) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0246 | EmployeeDialog / field() | 'Nhóm nhân viên' | [shared/operations.jsx:100](../shared/operations.jsx#L100) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0247 | EmployeeDialog / select | Vai trò mới | [shared/operations.jsx:100](../shared/operations.jsx#L100) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0248 | EmployeeDialog / field() | 'Mật khẩu tạm thời' | [shared/operations.jsx:101](../shared/operations.jsx#L101) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0249 | EmployeeDialog / textarea | Lý do cập nhật | [shared/operations.jsx:103](../shared/operations.jsx#L103) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0250 | EmployeeDialog / input | Tôi đã đối chiếu đúng nhân viên và xác nhận tác động đến hồ sơ, quyền hoặc phiên đăng nhập. | [shared/operations.jsx:103](../shared/operations.jsx#L103) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0251 | EmployeeDialog / button | Hủy | [shared/operations.jsx:104](../shared/operations.jsx#L104) | Theo nhóm employee; REVIEWED; UI NOT_RUN |
| UI-0252 | EmployeeDialog / button | [button động; xem biểu thức] | [shared/operations.jsx:104](../shared/operations.jsx#L104) | Theo nhóm employee; REVIEWED; UI NOT_RUN |

### account-security

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0284 | AccountSecurity / button | Cập nhật trạng thái | [shared/week5.jsx:26](../shared/week5.jsx#L26) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0285 | AccountSecurity / button | [button động; xem biểu thức] | [shared/week5.jsx:30](../shared/week5.jsx#L30) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0286 | AccountSecurity / button | Xử lý mất thiết bị MFA | [shared/week5.jsx:31](../shared/week5.jsx#L31) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0287 | AccountSecurity / button | Xác thực lại tài khoản quản trị | [shared/week5.jsx:33](../shared/week5.jsx#L33) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0288 | AccountSecurity / form | Xác nhận khôi phục thiết bị Phiên cũ sẽ bị thu hồi, thiết bị OTP cũ bị gỡ và người dùng phải đăng ký thiết bị mới. Quản trị viên cần có MFA và vừa xác thực trong 2 phút. Mã tham ch | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0289 | AccountSecurity / input | Tham chiếu xác minh MFA | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0290 | AccountSecurity / textarea | Lý do khôi phục MFA | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0291 | AccountSecurity / button | Hủy | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0292 | AccountSecurity / button | Xác thực lại | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0293 | AccountSecurity / button | [button động; xem biểu thức] | [shared/week5.jsx:34](../shared/week5.jsx#L34) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |
| UI-0294 | AccountSecurity / DataTable | Lịch sử bảo mật tài khoản | [shared/week5.jsx:36](../shared/week5.jsx#L36) | Theo nhóm account-security; REVIEWED; UI NOT_RUN |

### access-matrix

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0295 | AccessMatrix / button | Xuất CSV trang này | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |
| UI-0296 | AccessMatrix / Search | Tìm ma trận quyền | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |
| UI-0297 | AccessMatrix / select | Vai trò ma trận quyền | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |
| UI-0298 | AccessMatrix / DataTable | Ma trận User Role Resource | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |
| UI-0299 | AccessMatrix / button | Trước | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |
| UI-0300 | AccessMatrix / button | Sau | [shared/week5.jsx:46](../shared/week5.jsx#L46) | Theo nhóm access-matrix; REVIEWED; UI NOT_RUN |

### reconciliation

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0301 | ReconciliationPanel / button | Cập nhật | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0302 | ReconciliationPanel / select | Trạng thái đối chiếu | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0303 | ReconciliationPanel / DataTable | Đối chiếu tài khoản | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0304 | ReconciliationPanel / button | Đối chiếu Keycloak | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0305 | ReconciliationPanel / button | Trước | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0306 | ReconciliationPanel / button | Sau | [shared/week5.jsx:64](../shared/week5.jsx#L64) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0307 | ReconciliationPanel / Dialog | Đối chiếu đồng bộ tài khoản | [shared/week5.jsx:65](../shared/week5.jsx#L65) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0308 | ReconciliationPanel / form | Căn cứ xử lý lại Chỉ thực hiện lại khi thao tác này vẫn là quyết định mới nhất. Đồng bộ hồ sơ lỗi không tự mở tài khoản. Đóng | [shared/week5.jsx:65](../shared/week5.jsx#L65) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0309 | ReconciliationPanel / textarea | Căn cứ đối chiếu | [shared/week5.jsx:65](../shared/week5.jsx#L65) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0310 | ReconciliationPanel / button | Đóng | [shared/week5.jsx:65](../shared/week5.jsx#L65) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |
| UI-0311 | ReconciliationPanel / button | [button động; xem biểu thức] | [shared/week5.jsx:65](../shared/week5.jsx#L65) | Theo nhóm reconciliation; REVIEWED; UI NOT_RUN |

### analytics

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0283 | Problem / button | Thử lại | [shared/week5.jsx:12](../shared/week5.jsx#L12) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0312 | SecurityAnalytics / StatCard | Đăng nhập thành công | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0313 | SecurityAnalytics / StatCard | Đăng nhập thất bại | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0314 | SecurityAnalytics / StatCard | Yêu cầu bị từ chối | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0315 | SecurityAnalytics / StatCard | Phiên ứng dụng đang hoạt động | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0316 | SecurityAnalytics / StatCard | Tài khoản đang khóa | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0317 | SecurityAnalytics / StatCard | Cảnh báo đang mở | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0318 | SecurityAnalytics / StatCard | Yêu cầu bắt buộc MFA | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0319 | SecurityAnalytics / StatCard | Thao tác cần theo dõi | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0320 | SecurityAnalytics / summary | Xem số liệu biểu đồ | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0321 | SecurityAnalytics / DataTable | Số liệu đăng nhập | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |
| UI-0322 | SecurityAnalytics / DataTable | Phân bố sự kiện | [shared/week5.jsx:72](../shared/week5.jsx#L72) | Theo nhóm analytics; REVIEWED; UI NOT_RUN |

### insights

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0323 | WorkspaceInsights / StatCard | Ngày ghi nhận | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |
| UI-0324 | WorkspaceInsights / StatCard | Giờ làm hoàn tất | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |
| UI-0325 | WorkspaceInsights / StatCard | Ngày đi muộn | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |
| UI-0326 | WorkspaceInsights / StatCard | Đơn đang chờ | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |
| UI-0327 | WorkspaceInsights / StatCard | Đơn đã duyệt | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |
| UI-0328 | WorkspaceInsights / summary | Xu hướng đi muộn trong tháng | [shared/week5.jsx:78](../shared/week5.jsx#L78) | Theo nhóm insights; REVIEWED; UI NOT_RUN |

### calendar

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0329 | WorkspaceCalendar / button | {day+': '+label+(pending?', có đơn chờ duyệt':'')} | [shared/week5.jsx:91](../shared/week5.jsx#L91) | Theo nhóm calendar; REVIEWED; UI NOT_RUN |
| UI-0330 | WorkspaceCalendar / Dialog | {'Chi tiết ngày '+selected.split('-').reverse().join('/')} | [shared/week5.jsx:91](../shared/week5.jsx#L91) | Theo nhóm calendar; REVIEWED; UI NOT_RUN |

### role-overview

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0331 | RoleOverview / button | Mở quản lý nhóm | [shared/week5.jsx:99](../shared/week5.jsx#L99) | Theo nhóm role-overview; REVIEWED; UI NOT_RUN |
| UI-0332 | RoleOverview / button | Mở giám sát bảo mật | [shared/week5.jsx:100](../shared/week5.jsx#L100) | Theo nhóm role-overview; REVIEWED; UI NOT_RUN |

### directory

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0112 | DirectoryPanel / button | Làm mới dữ liệu LDAP | [shared/directory.jsx:41](../shared/directory.jsx#L41) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0113 | DirectoryPanel / button | Đồng bộ LDAP | [shared/directory.jsx:41](../shared/directory.jsx#L41) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0114 | DirectoryPanel / button | Đóng | [shared/directory.jsx:42](../shared/directory.jsx#L42) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0115 | DirectoryPanel / button | Thử lại | [shared/directory.jsx:43](../shared/directory.jsx#L43) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0116 | DirectoryPanel / StatCard | Hồ sơ từ LDAP | [shared/directory.jsx:47](../shared/directory.jsx#L47) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0117 | DirectoryPanel / StatCard | Nguồn active | [shared/directory.jsx:47](../shared/directory.jsx#L47) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0118 | DirectoryPanel / StatCard | Cần đối chiếu | [shared/directory.jsx:47](../shared/directory.jsx#L47) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0119 | DirectoryPanel / Search | Tìm người dùng LDAP | [shared/directory.jsx:49](../shared/directory.jsx#L49) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0120 | DirectoryPanel / select | Trạng thái người dùng LDAP | [shared/directory.jsx:49](../shared/directory.jsx#L49) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0121 | DirectoryPanel / button | Trang LDAP trước | [shared/directory.jsx:49](../shared/directory.jsx#L49) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0122 | DirectoryPanel / button | Trang LDAP sau | [shared/directory.jsx:49](../shared/directory.jsx#L49) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0123 | DirectoryPanel / DataTable | Ánh xạ nhóm LDAP | [shared/directory.jsx:50](../shared/directory.jsx#L50) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0124 | DirectoryPanel / DataTable | Lịch sử đồng bộ LDAP | [shared/directory.jsx:51](../shared/directory.jsx#L51) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0125 | DirectoryPanel / Dialog | Đồng bộ nguồn LDAP | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0126 | DirectoryPanel / form | Chế độ đồng bộ Toàn bộ người dùng nguồn Người dùng có thay đổi tại Keycloak LDAP Cả hai chế độ đều đối chiếu nhóm của toàn bộ user đã nhập trong giới hạn quét; thay đổi quyền sẽ th | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0127 | DirectoryPanel / select | Chế độ đồng bộ LDAP | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0128 | DirectoryPanel / textarea | Lý do đồng bộ LDAP | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0129 | DirectoryPanel / button | Hủy | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |
| UI-0130 | DirectoryPanel / button | [button động; xem biểu thức] | [shared/directory.jsx:52](../shared/directory.jsx#L52) | Theo nhóm directory; REVIEWED; UI NOT_RUN |

### access

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0134 | AccessWorkspace / button | Rút yêu cầu | [shared/governance.jsx:26](../shared/governance.jsx#L26) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0135 | AccessWorkspace / button | Mở tài nguyên | [shared/governance.jsx:26](../shared/governance.jsx#L26) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0136 | AccessWorkspace / button | [button động; xem biểu thức] | [shared/governance.jsx:29](../shared/governance.jsx#L29) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0137 | AccessWorkspace / button | Làm mới | [shared/governance.jsx:30](../shared/governance.jsx#L30) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0138 | AccessWorkspace / DataTable | Yêu cầu quyền của tôi | [shared/governance.jsx:30](../shared/governance.jsx#L30) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0139 | AccessWorkspace / Dialog | {'Yêu cầu '+modal.name.toLowerCase()} | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0140 | AccessWorkspace / form | Phạm vi: . Yêu cầu này không đổi vai trò tài khoản. Thời hạn (ngày) Hủy Gửi yêu cầu | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0141 | AccessWorkspace / input | Thời hạn (ngày) | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0142 | AccessWorkspace / Note | [Note động; xem biểu thức] | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0143 | AccessWorkspace / button | Hủy | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0144 | AccessWorkspace / button | Gửi yêu cầu | [shared/governance.jsx:32](../shared/governance.jsx#L32) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0145 | AccessWorkspace / Dialog | {report.resource.name} | [shared/governance.jsx:33](../shared/governance.jsx#L33) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0146 | AccessWorkspace / DataTable | Báo cáo đã được cấp quyền | [shared/governance.jsx:33](../shared/governance.jsx#L33) | Theo nhóm access; REVIEWED; UI NOT_RUN |
| UI-0147 | AccessWorkspace / ExportButton | [ExportButton động; xem biểu thức] | [shared/governance.jsx:33](../shared/governance.jsx#L33) | Theo nhóm access; REVIEWED; UI NOT_RUN |

### approvals

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0148 | AccessApprovals / button | [button động; xem biểu thức] | [shared/governance.jsx:42](../shared/governance.jsx#L42) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0149 | AccessApprovals / button | Làm mới | [shared/governance.jsx:43](../shared/governance.jsx#L43) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0150 | AccessApprovals / Search | Tìm yêu cầu quyền | [shared/governance.jsx:43](../shared/governance.jsx#L43) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0151 | AccessApprovals / select | Trạng thái | [shared/governance.jsx:43](../shared/governance.jsx#L43) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0152 | AccessApprovals / Dialog | Xét quyền truy cập | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0153 | AccessApprovals / form | · · ngày Quyết định Thu hồi quyền Phê duyệt Từ chối Hủy Ghi quyết định | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0154 | AccessApprovals / select | Quyết định | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0155 | AccessApprovals / Note | [Note động; xem biểu thức] | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0156 | AccessApprovals / button | Hủy | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |
| UI-0157 | AccessApprovals / button | Ghi quyết định | [shared/governance.jsx:44](../shared/governance.jsx#L44) | Theo nhóm approvals; REVIEWED; UI NOT_RUN |

### workflow-form

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0158 | WorkflowForm / input | [input động; xem biểu thức] | [shared/governance.jsx:55](../shared/governance.jsx#L55) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0159 | WorkflowForm / Dialog | Lập quy trình vòng đời | [shared/governance.jsx:57](../shared/governance.jsx#L57) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0160 | WorkflowForm / form | Quy trình Nguồn danh tính Keycloak local OpenLDAP Nhân viên Chọn nhân viên · Vai trò Hủy Lập yêu cầu | [shared/governance.jsx:57](../shared/governance.jsx#L57) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0161 | WorkflowForm / select | Quy trình | [shared/governance.jsx:57](../shared/governance.jsx#L57) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0162 | WorkflowForm / select | Nguồn danh tính | [shared/governance.jsx:57](../shared/governance.jsx#L57) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0163 | WorkflowForm / select | Nhân viên | [shared/governance.jsx:57](../shared/governance.jsx#L57) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0164 | WorkflowForm / input() | ldap?'Tên đăng nhập (ldap-…)':'Tên đăng nhập' | [shared/governance.jsx:58](../shared/governance.jsx#L58) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0165 | WorkflowForm / input() | 'Họ và tên' | [shared/governance.jsx:58](../shared/governance.jsx#L58) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0166 | WorkflowForm / input() | 'Email' | [shared/governance.jsx:58](../shared/governance.jsx#L58) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0167 | WorkflowForm / input() | 'Phòng ban / nhóm' | [shared/governance.jsx:58](../shared/governance.jsx#L58) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0168 | WorkflowForm / select | Vai trò | [shared/governance.jsx:58](../shared/governance.jsx#L58) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0169 | WorkflowForm / Note | [Note động; xem biểu thức] | [shared/governance.jsx:59](../shared/governance.jsx#L59) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0170 | WorkflowForm / button | Hủy | [shared/governance.jsx:59](../shared/governance.jsx#L59) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |
| UI-0171 | WorkflowForm / button | Lập yêu cầu | [shared/governance.jsx:59](../shared/governance.jsx#L59) | Theo nhóm workflow-form; REVIEWED; UI NOT_RUN |

### workflow

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0172 | WorkflowDialog / Dialog | {w?kinds[w.kind]+' · '+w.username:'Chi tiết vòng đời'} | [shared/governance.jsx:68](../shared/governance.jsx#L68) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0173 | WorkflowDialog / button | Làm mới trạng thái | [shared/governance.jsx:69](../shared/governance.jsx#L69) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0174 | WorkflowDialog / button | Đọc hiện trạng | [shared/governance.jsx:69](../shared/governance.jsx#L69) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0175 | WorkflowDialog / button | Sao chép lệnh | [shared/governance.jsx:74](../shared/governance.jsx#L74) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0176 | WorkflowDialog / button | Phê duyệt | [shared/governance.jsx:75](../shared/governance.jsx#L75) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0177 | WorkflowDialog / button | Từ chối | [shared/governance.jsx:75](../shared/governance.jsx#L75) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0178 | WorkflowDialog / button | [button động; xem biểu thức] | [shared/governance.jsx:75](../shared/governance.jsx#L75) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0179 | WorkflowDialog / form | Mật khẩu tạm thời (chỉ lần tạo đầu) Không lưu trong lịch sử. Nếu lần trước đã tạo ở Keycloak, có thể để trống để đối chiếu mã yêu cầu. Hủy | [shared/governance.jsx:76](../shared/governance.jsx#L76) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0180 | WorkflowDialog / input | Mật khẩu tạm thời (chỉ lần tạo đầu) | [shared/governance.jsx:76](../shared/governance.jsx#L76) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0181 | WorkflowDialog / Note | [Note động; xem biểu thức] | [shared/governance.jsx:76](../shared/governance.jsx#L76) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0182 | WorkflowDialog / button | Hủy | [shared/governance.jsx:76](../shared/governance.jsx#L76) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |
| UI-0183 | WorkflowDialog / button | [button động; xem biểu thức] | [shared/governance.jsx:76](../shared/governance.jsx#L76) | Theo nhóm workflow; REVIEWED; UI NOT_RUN |

### review

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0184 | ReviewPanel / button | Ghi khuyến nghị | [shared/governance.jsx:85](../shared/governance.jsx#L85) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0185 | ReviewPanel / button | Thu hồi quyền | [shared/governance.jsx:85](../shared/governance.jsx#L85) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0186 | ReviewPanel / button | Tạo đợt rà soát | [shared/governance.jsx:86](../shared/governance.jsx#L86) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0187 | ReviewPanel / select | Đợt rà soát | [shared/governance.jsx:86](../shared/governance.jsx#L86) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0188 | ReviewPanel / Dialog | {modal==='new'?'Tạo đợt rà soát':modal.action==='revoke'?'Thu hồi quyền thực tế':'Ghi khuyến nghị kiểm toán'} | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0189 | ReviewPanel / form | · Khuyến nghị Cần xác minh Giữ nguyên Nên thu hồi Hủy Xác nhận | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0190 | ReviewPanel / select | Khuyến nghị | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0191 | ReviewPanel / Note | [Note động; xem biểu thức] | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0192 | ReviewPanel / button | Hủy | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |
| UI-0193 | ReviewPanel / button | Xác nhận | [shared/governance.jsx:87](../shared/governance.jsx#L87) | Theo nhóm review; REVIEWED; UI NOT_RUN |

### governance

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0131 | Pager / button | Trước | [shared/governance.jsx:16](../shared/governance.jsx#L16) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0132 | Pager / button | Sau | [shared/governance.jsx:16](../shared/governance.jsx#L16) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0133 | Note / textarea | Lý do xử lý quyền | [shared/governance.jsx:18](../shared/governance.jsx#L18) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0194 | GovernancePanel / button | Mở quy trình | [shared/governance.jsx:95](../shared/governance.jsx#L95) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0195 | GovernancePanel / button | Lập quy trình mới | [shared/governance.jsx:98](../shared/governance.jsx#L98) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0196 | GovernancePanel / StatCard | Chờ xét duyệt | [shared/governance.jsx:99](../shared/governance.jsx#L99) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0197 | GovernancePanel / StatCard | Cần đối chiếu | [shared/governance.jsx:99](../shared/governance.jsx#L99) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0198 | GovernancePanel / StatCard | Đã đồng bộ | [shared/governance.jsx:99](../shared/governance.jsx#L99) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0199 | GovernancePanel / StatCard | Quyền có thời hạn | [shared/governance.jsx:99](../shared/governance.jsx#L99) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0200 | GovernancePanel / button | Làm mới | [shared/governance.jsx:100](../shared/governance.jsx#L100) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0201 | GovernancePanel / Search | {view==='matrix'?'Tìm quyền nhân viên':'Tìm quy trình'} | [shared/governance.jsx:100](../shared/governance.jsx#L100) | Theo nhóm governance; REVIEWED; UI NOT_RUN |
| UI-0202 | GovernancePanel / select | Đồng bộ | [shared/governance.jsx:100](../shared/governance.jsx#L100) | Theo nhóm governance; REVIEWED; UI NOT_RUN |

### central

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0045 | AuditPager / button | Trước | [shared/central-audit.jsx:14](../shared/central-audit.jsx#L14) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0046 | AuditPager / button | Sau | [shared/central-audit.jsx:14](../shared/central-audit.jsx#L14) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0047 | CentralAudit / button | [button động; xem biểu thức] | [shared/central-audit.jsx:26](../shared/central-audit.jsx#L26) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0048 | CentralAudit / form | Tìm sự kiện Nguồn Tất cả Kết quả Tất cả User ID Request ID Session hash Từ Đến Áp dụng bộ lọc Mặc định 7 ngày · Tối đa 93 ngày/lượt | [shared/central-audit.jsx:29](../shared/central-audit.jsx#L29) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0049 | CentralAudit / input | Tìm sự kiện | [shared/central-audit.jsx:30](../shared/central-audit.jsx#L30) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0050 | CentralAudit / select | Nguồn | [shared/central-audit.jsx:31](../shared/central-audit.jsx#L31) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0051 | CentralAudit / select | Kết quả | [shared/central-audit.jsx:32](../shared/central-audit.jsx#L32) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0052 | CentralAudit / input | User ID | [shared/central-audit.jsx:33](../shared/central-audit.jsx#L33) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0053 | CentralAudit / input | Request ID | [shared/central-audit.jsx:34](../shared/central-audit.jsx#L34) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0054 | CentralAudit / input | Session hash | [shared/central-audit.jsx:34](../shared/central-audit.jsx#L34) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0055 | CentralAudit / input | Từ | [shared/central-audit.jsx:35](../shared/central-audit.jsx#L35) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0056 | CentralAudit / input | Đến | [shared/central-audit.jsx:35](../shared/central-audit.jsx#L35) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0057 | CentralAudit / button | Áp dụng bộ lọc | [shared/central-audit.jsx:35](../shared/central-audit.jsx#L35) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0058 | CentralAudit / StatCard | Cho phép | [shared/central-audit.jsx:37](../shared/central-audit.jsx#L37) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0059 | CentralAudit / StatCard | Từ chối | [shared/central-audit.jsx:37](../shared/central-audit.jsx#L37) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0060 | CentralAudit / StatCard | Chờ chuyển PostgreSQL | [shared/central-audit.jsx:37](../shared/central-audit.jsx#L37) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0061 | CentralAudit / button | Chuẩn bị CSV theo bộ lọc | [shared/central-audit.jsx:38](../shared/central-audit.jsx#L38) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0062 | CentralAudit / ExportButton | [ExportButton động; xem biểu thức] | [shared/central-audit.jsx:38](../shared/central-audit.jsx#L38) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0063 | CentralAudit / button | Chi tiết | [shared/central-audit.jsx:38](../shared/central-audit.jsx#L38) | Theo nhóm central; REVIEWED; UI NOT_RUN |
| UI-0064 | CentralAudit / button | Gửi lại hàng đợi | [shared/central-audit.jsx:40](../shared/central-audit.jsx#L40) | Theo nhóm central; REVIEWED; UI NOT_RUN |

### event-detail

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0070 | EventDetail / Dialog | Điều tra sự kiện | [shared/central-audit.jsx:54](../shared/central-audit.jsx#L54) | Theo nhóm event-detail; REVIEWED; UI NOT_RUN |

### central-incidents

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0071 | CentralIncidents / select | Trạng thái cảnh báo | [shared/central-audit.jsx:60](../shared/central-audit.jsx#L60) | Theo nhóm central-incidents; REVIEWED; UI NOT_RUN |
| UI-0072 | CentralIncidents / button | Sự kiện | [shared/central-audit.jsx:60](../shared/central-audit.jsx#L60) | Theo nhóm central-incidents; REVIEWED; UI NOT_RUN |
| UI-0073 | CentralIncidents / button | Lịch sử / xử lý | [shared/central-audit.jsx:60](../shared/central-audit.jsx#L60) | Theo nhóm central-incidents; REVIEWED; UI NOT_RUN |

### incident-review

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0074 | IncidentReview / Dialog | Kết luận điều tra | [shared/central-audit.jsx:65](../shared/central-audit.jsx#L65) | Theo nhóm incident-review; REVIEWED; UI NOT_RUN |
| UI-0075 | IncidentReview / form | Trạng thái Cơ sở kết luận Lưu kết luận | [shared/central-audit.jsx:65](../shared/central-audit.jsx#L65) | Theo nhóm incident-review; REVIEWED; UI NOT_RUN |
| UI-0076 | IncidentReview / select | Trạng thái | [shared/central-audit.jsx:65](../shared/central-audit.jsx#L65) | Theo nhóm incident-review; REVIEWED; UI NOT_RUN |
| UI-0077 | IncidentReview / textarea | Cơ sở kết luận | [shared/central-audit.jsx:65](../shared/central-audit.jsx#L65) | Theo nhóm incident-review; REVIEWED; UI NOT_RUN |
| UI-0078 | IncidentReview / button | Lưu kết luận | [shared/central-audit.jsx:65](../shared/central-audit.jsx#L65) | Theo nhóm incident-review; REVIEWED; UI NOT_RUN |

### audit-settings

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0079 | AuditSettings / form | Lưu cấu hình | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |
| UI-0080 | AuditSettings / input | [input động; xem biểu thức] | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |
| UI-0081 | AuditSettings / button | Lưu cấu hình | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |
| UI-0082 | AuditSettings / button | Xem trước dữ liệu hết hạn | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |
| UI-0083 | AuditSettings / input | Nhập DELETE_EXPIRED_AUDIT để xác nhận | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |
| UI-0084 | AuditSettings / button | Xóa log hết hạn | [shared/central-audit.jsx:70](../shared/central-audit.jsx#L70) | Theo nhóm audit-settings; REVIEWED; UI NOT_RUN |

### audit-backfill

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0065 | AuditBackfill / form | Nguồn Đăng nhập / xác thực Thao tác quản trị Lấy lại từ Lý do Đặt checkpoint lấy bù | [shared/central-audit.jsx:49](../shared/central-audit.jsx#L49) | Theo nhóm audit-backfill; REVIEWED; UI NOT_RUN |
| UI-0066 | AuditBackfill / select | Nguồn | [shared/central-audit.jsx:49](../shared/central-audit.jsx#L49) | Theo nhóm audit-backfill; REVIEWED; UI NOT_RUN |
| UI-0067 | AuditBackfill / input | Lấy lại từ | [shared/central-audit.jsx:49](../shared/central-audit.jsx#L49) | Theo nhóm audit-backfill; REVIEWED; UI NOT_RUN |
| UI-0068 | AuditBackfill / input | Lý do | [shared/central-audit.jsx:49](../shared/central-audit.jsx#L49) | Theo nhóm audit-backfill; REVIEWED; UI NOT_RUN |
| UI-0069 | AuditBackfill / button | Đặt checkpoint lấy bù | [shared/central-audit.jsx:49](../shared/central-audit.jsx#L49) | Theo nhóm audit-backfill; REVIEWED; UI NOT_RUN |

### detection

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0085 | DetectionPanel / button | [button động; xem biểu thức] | [shared/detection.jsx:15](../shared/detection.jsx#L15) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0086 | DetectionPanel / button | Phân tích 200 sự kiện tiếp theo | [shared/detection.jsx:15](../shared/detection.jsx#L15) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0087 | DetectionPanel / StatCard | Sự kiện chờ phân tích | [shared/detection.jsx:16](../shared/detection.jsx#L16) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0088 | DetectionPanel / StatCard | Phân tích định kỳ | [shared/detection.jsx:16](../shared/detection.jsx#L16) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0089 | DetectionPanel / StatCard | Lần hoàn tất gần nhất | [shared/detection.jsx:16](../shared/detection.jsx#L16) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0090 | DetectionPanel / select | Phân loại | [shared/detection.jsx:17](../shared/detection.jsx#L17) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0091 | DetectionPanel / button | Đặc trưng / gán nhãn | [shared/detection.jsx:17](../shared/detection.jsx#L17) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0092 | DetectionPanel / button | Log gốc | [shared/detection.jsx:17](../shared/detection.jsx#L17) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0093 | DetectionPanel / button | Tính và lưu đánh giá | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0094 | DetectionPanel / StatCard | Precision | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0095 | DetectionPanel / StatCard | Recall | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0096 | DetectionPanel / StatCard | F1 | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0097 | DetectionPanel / StatCard | False Positive Rate | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0098 | DetectionPanel / StatCard | Độ trễ trung bình (ms) | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0099 | DetectionPanel / StatCard | Độ trễ p95 (ms) | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |
| UI-0100 | DetectionPanel / ExportButton | [ExportButton động; xem biểu thức] | [shared/detection.jsx:18](../shared/detection.jsx#L18) | Theo nhóm detection; REVIEWED; UI NOT_RUN |

### detection-config

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0101 | DetectionConfig / form | Phân tích tự động mỗi 30 giây Lưu cấu hình | [shared/detection.jsx:27](../shared/detection.jsx#L27) | Theo nhóm detection-config; REVIEWED; UI NOT_RUN |
| UI-0102 | DetectionConfig / input | [input động; xem biểu thức] | [shared/detection.jsx:27](../shared/detection.jsx#L27) | Theo nhóm detection-config; REVIEWED; UI NOT_RUN |
| UI-0103 | DetectionConfig / input | [input động; xem biểu thức] | [shared/detection.jsx:27](../shared/detection.jsx#L27) | Theo nhóm detection-config; REVIEWED; UI NOT_RUN |
| UI-0104 | DetectionConfig / button | Lưu cấu hình | [shared/detection.jsx:27](../shared/detection.jsx#L27) | Theo nhóm detection-config; REVIEWED; UI NOT_RUN |

### label

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0105 | LabelDialog / Dialog | Đặc trưng & nhãn đánh giá | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0106 | LabelDialog / form | Nhãn đã xác minh Chọn nhãn Normal Anomaly Tập dữ liệu Evaluation — đánh giá Train — phát triển / tinh chỉnh Mã nhóm kịch bản Căn cứ xác minh (không nhập bí mật) Lưu nhãn | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0107 | LabelDialog / select | Nhãn đã xác minh | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0108 | LabelDialog / select | Tập dữ liệu | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0109 | LabelDialog / input | Mã nhóm kịch bản | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0110 | LabelDialog / textarea | Căn cứ xác minh (không nhập bí mật) | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |
| UI-0111 | LabelDialog / button | Lưu nhãn | [shared/detection.jsx:32](../shared/detection.jsx#L32) | Theo nhóm label; REVIEWED; UI NOT_RUN |

### auth-shared

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0039 | AuthScreen / a | n nhịp | [shared/auth.jsx:24](../shared/auth.jsx#L24) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |
| UI-0040 | AuthScreen / button | ↗ | [shared/auth.jsx:36](../shared/auth.jsx#L36) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |
| UI-0041 | AuthScreen / button | Kiểm tra kết nối lại ↻ | [shared/auth.jsx:38](../shared/auth.jsx#L38) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |
| UI-0042 | AuthScreen / button | Đăng xuất để đổi tài khoản | [shared/auth.jsx:39](../shared/auth.jsx#L39) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |
| UI-0043 | AuthScreen / button | Tải lại trang | [shared/auth.jsx:40](../shared/auth.jsx#L40) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |
| UI-0044 | AuthScreen / a | → | [shared/auth.jsx:41](../shared/auth.jsx#L41) | Theo nhóm auth-shared; REVIEWED; UI NOT_RUN |

### workspace-panels

| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |
|---|---|---|---|---|
| UI-0371 | CardPages / select | {'Số đơn mỗi trang '+name} | [web-a/src/WorkspacePanels.jsx:12](../web-a/src/WorkspacePanels.jsx#L12) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0372 | CardPages / button | {'Trang trước '+name} | [web-a/src/WorkspacePanels.jsx:12](../web-a/src/WorkspacePanels.jsx#L12) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0373 | CardPages / button | {'Trang sau '+name} | [web-a/src/WorkspacePanels.jsx:12](../web-a/src/WorkspacePanels.jsx#L12) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0379 | MyRequests / Search | Tìm đơn điều chỉnh | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0380 | MyRequests / select | Lọc đơn điều chỉnh | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0381 | MyRequests / button | Xóa bộ lọc | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0382 | MyRequests / summary | Tiến trình xử lý | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0383 | MyRequests / button | Rút đơn | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0384 | MyRequests / button | Gửi đề nghị đầu tiên | [web-a/src/WorkspacePanels.jsx:27](../web-a/src/WorkspacePanels.jsx#L27) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0385 | TeamWorkspace / StatCard | Thành viên trong phạm vi | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0386 | TeamWorkspace / StatCard | Đơn chờ bạn duyệt | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0387 | TeamWorkspace / StatCard | Bản ghi trong tháng | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0388 | TeamWorkspace / summary | Thành viên nhóm · | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0389 | TeamWorkspace / button | Xem đơn của tôi | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0390 | TeamWorkspace / Search | Tìm đơn cần duyệt | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0391 | TeamWorkspace / summary | Tiến trình xử lý | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0392 | TeamWorkspace / button | Từ chối | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |
| UI-0393 | TeamWorkspace / button | Duyệt đơn | [web-a/src/WorkspacePanels.jsx:34](../web-a/src/WorkspacePanels.jsx#L34) | Theo nhóm workspace-panels; REVIEWED; UI NOT_RUN |

## Giới hạn và điểm cần theo dõi

- Cảnh báo local, incident PostgreSQL và Detection chưa có trang sự cố hợp nhất.
- Alert local ghi đè note/status; chưa có version/history như incident PostgreSQL.
- Luồng khởi tạo Keycloak A/B đã dùng chung timeout và kiểm tra discovery trong Đợt 2.
- `EventsPanel` và một số component cũ còn trong source; cần phân biệt khai báo với callsite hoạt động.
- Các `.map()` menu, cột bảng, ngày lịch, radio, tab, notification và hàng dữ liệu sinh control động; xem biểu thức/nguồn và domain mô tả theo nhóm.
- Auditor được ghi nhãn Detection và snapshot/khuyến nghị review; tài liệu nói chỉ đọc toàn bộ Web B cần được chỉnh ở đợt phù hợp.
- Retention apply/xóa log chỉ được ghi nhận trong danh mục, không chạy.
- Bộ E2E hiện tại có thao tác dữ liệu thật, tài khoản và bỏ qua lỗi TLS ở một số ca; không chạy Đợt 1.

Bản Đợt 1 giữ nguyên tại `docs/KIEM_KE_TUONG_TAC.md` và `docs/interaction-inventory.json`. Các cột UI/live Đợt 1 tiếp tục là lịch sử; kiểm thử browser Đợt 2 dùng OIDC giả và adapter thật, không phải Keycloak live. Xem báo cáo Đợt 2 để đối chiếu kết quả. Timeout đăng nhập A/B đã dùng chung; ghi chú hạn chế timeout ở snapshot cũ là lịch sử.

Đợt 3 chỉ nâng cấp Workspace. Snapshot Đợt 1 và Đợt 2 được giữ nguyên. Kết quả browser giả lập nằm trong báo cáo Đợt 3; không suy diễn từ cột lịch sử NOT_RUN.
