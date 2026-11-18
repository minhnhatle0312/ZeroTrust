// Static inventory only. Does not execute React, load .env, or call any service.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parse} = require('../web-a/node_modules/@babel/parser');
const ROOT = path.resolve(__dirname, '..');
const ALL = 'employee, manager, admin, auditor trên Web A; Web B chỉ admin, auditor';
const SEC = 'admin, auditor; thao tác quản trị chỉ admin, trừ gán nhãn/rà soát được nêu riêng';
const pages = [];
function page(app, id, label, roles, groups, note = '') {
  pages.push({id: `${app}:${id}`, app, route: `/${app === 'A' ? 'a' : 'b'}/#/${id}`,
    menu: label, roles, groups, note, staticReview: 'REVIEWED', liveRetestPhase1: 'NOT_RUN'});
}
page('A','overview','Tổng quan',['employee','manager','admin','auditor'],['workspace','admin-home','role-overview','insights']);
page('A','functions','Tất cả chức năng',['employee','manager','admin','auditor'],['shell','workspace']);
page('A','checkin','Chấm công',['employee','manager','admin','auditor'],['workspace','insights']);
page('A','attendance','Bảng công của tôi',['employee','manager','admin','auditor'],['workspace','calendar','table']);
page('A','requests','Đơn điều chỉnh',['employee','manager','admin','auditor'],['workspace']);
page('A','access','Quyền truy cập của tôi',['employee','manager','admin','auditor'],['access']);
page('A','profile','Hồ sơ & phiên của tôi',['employee','manager','admin','auditor'],['profile','sessions','account-security']);
page('A','team','Quản lý nhóm',['manager','admin'],['workspace','table'],'Manager chỉ nhóm mình; không tự duyệt.');
page('A','approvals','Duyệt quyền truy cập',['manager','admin'],['approvals'],'Phạm vi nhóm; không tự duyệt.');
page('A','security','Trung tâm bảo mật',['admin','auditor'],['alerts','explorer','actions','identity','security-insights','reconciliation'],'Auditor đọc; thao tác tài khoản/đồng bộ chỉ admin.');
page('A','users','Tài khoản & truy cập',['admin'],['accounts','employee','account-action','sessions','account-security']);
for (const [id,label,groups,adminOnly] of [
  ['overview','Tổng quan',['security-app','analytics','security-insights','identity']],
  ['functions','Tất cả chức năng',['security-app','shell']],
  ['alerts','Cảnh báo',['explorer','alerts']],
  ['detection','Python Detection',['detection','detection-config','label']],
  ['central-audit','Audit PostgreSQL',['central','central-incidents','incident-review','event-detail','audit-settings','audit-backfill']],
  ['events','Nhật ký truy cập',['explorer']],
  ['accounts','Tài khoản',['accounts','employee','account-action','sessions','account-security'],true],
  ['logins','Đăng nhập & xác thực',['explorer']],
  ['matrix','Ma trận quyền',['access-matrix']],
  ['actions','Lịch sử xử lý',['reconciliation']],
  ['profile','Hồ sơ & phiên của tôi',['profile','sessions','account-security']],
  ['directory','Danh bạ LDAP',['directory']],
  ['federation','Đồng bộ thư mục',['directory']],
  ['directory-mapping','Ánh xạ nhóm LDAP',['directory']],
  ['governance','Vòng đời danh tính',['governance','workflow-form','workflow']],
  ['access-approvals','Phê duyệt quyền',['approvals'],true],
  ['access-review','Rà soát quyền',['review']],
  ['grant-matrix','Vai trò & quyền bổ sung',['governance']],
]) page('B',id,label,adminOnly?['admin']:['admin','auditor'],groups);

const groups = [];
function group(id, title, file, components, access, apis, behavior, tests = []) {
  groups.push({id,title,file,components,access,apis,behavior,testReferences:tests,
    staticReview:'REVIEWED', liveRetestPhase1:'NOT_RUN',
    testNote:'Tham chiếu phạm vi suite; không đồng nghĩa từng nút đã chạy lại.'});
}
group('auth-a','Khởi tạo, đăng nhập lại, tải lại và lỗi render Web A','web-a/src/main.jsx',
  ['AppErrorBoundary','renderAuthStatus','startApp'], 'Trước đăng nhập; đăng nhập qua Keycloak',
  ['OIDC authorization/token/logout qua keycloak-js','GET /api/profile (monitorSession)'],
  'Tự login-required; PKCE S256; timeout 20 giây; nút thử đăng nhập và reload.', ['tests/week3_sso.py']);
group('auth-b','Xác thực, thiếu quyền và lỗi render Web B','web-b/src/main.jsx',
  ['status','Boundary','start'], 'Trước đăng nhập; chỉ admin/auditor vào Web B',
  ['OIDC authorization/token/logout qua keycloak-js','GET /api/profile (monitorSession)'],
  'Về Web A; đăng nhập lại; đăng xuất khi thiếu quyền; reload khi render lỗi.', ['tests/week3_sso.py']);
group('workspace','Nghiệp vụ và biểu mẫu chính Web A','web-a/src/App.jsx',
  ['App','Modal'], ALL,
  ['GET /api/profile','GET /api/attendance?month=','GET /api/corrections','GET /api/team?month=',
   'GET /api/security','GET /api/security/keycloak','GET /api/admin/users',
   'POST /api/attendance/check-in','POST /api/attendance/check-out','POST /api/corrections',
   'PATCH /api/corrections/:id','POST /api/corrections/:id/cancel'],
  'Chọn tháng; chấm vào/ra; tạo đơn (ngày, giờ vào/ra, lý do); rút đơn; duyệt/từ chối (ghi chú); lọc đơn; chuyển trang; lỗi/đăng nhập lại. Manager/admin duyệt trong phạm vi, cấm tự duyệt; chủ đơn rút pending.',
  ['backend/security.test.js','backend/operations.test.js','tests/frontend_ui.py','tests/operations_ui.py']);
group('table','Tìm/xuất bảng công','web-a/src/App.jsx',['AttendanceTable'],ALL,
  ['GET /api/attendance?month=','GET /api/team?month='],
  'Tìm theo ngày/tên/nhóm/trạng thái; CSV dữ liệu đã tải; bảng công nhóm chỉ manager/admin.', ['tests/frontend_ui.py','tests/frontend.test.mjs']);
group('admin-home','Thẻ tổng quan quản trị','web-a/src/AdminHome.jsx',['AdminHome'],'admin',
  ['GET /api/admin/users','GET /api/team','GET /api/security','GET /api/security/keycloak'],
  'Thẻ KPI, liên kết tài khoản/cảnh báo, mở Web B, xem và duyệt đơn.', ['tests/frontend_ui.py']);
group('security-app','Tổng quan, menu và tự cập nhật Web B','web-b/src/App.jsx',['App'],SEC,
  ['GET /api/profile','GET /api/security','GET /api/security/keycloak','GET /api/admin/users (admin)'],
  'Menu theo quyền; tự cập nhật 20 giây; toast/retry; thẻ KPI; mở cảnh báo/tài khoản; chuyển Web A; mở các dialog.', ['backend/sso.test.js','tests/frontend_ui.py']);
group('shell','Khung trang, menu, command palette và widget','shared/ui.jsx',
  ['Frame','Dialog','Empty','Search','ExportButton','DataTable','StatCard','FeatureGrid'], ALL,
  ['Không gọi API trực tiếp; callback từ trang; CSV local; đăng xuất qua Keycloak'],
  'Sidebar/mobile; Ctrl+K; tìm/xóa tìm; chọn app; refresh/logout; skip-link; Escape/backdrop/đóng modal; sort; kích thước trang; trước/sau; xuất CSV. Các mục sinh từ menu/columns/items lặp theo dữ liệu, không phải số nút runtime cố định.',
  ['tests/frontend_ui.py','tests/frontend.test.mjs','tests/api-client.test.mjs']);
group('accounts','Danh sách tài khoản','shared/admin.jsx',['AccountsPanel'],'admin',
  ['GET /api/admin/users'], 'Tìm tài khoản, lọc role/khóa, CSV, thêm nhân viên, mở hồ sơ/phiên và quản lý truy cập; admin được bảo vệ.', ['tests/frontend_ui.py','tests/operations_ui.py']);
group('alerts','Cảnh báo cục bộ và kết luận','shared/admin.jsx',['AlertsPanel','AlertDialog'],SEC,
  ['GET /api/security/alert-list','GET /api/security/alerts/:id/context','PATCH /api/security/alerts/:id (admin)'],
  'Tìm/lọc trạng thái/mức độ; mở chi tiết, mở ngữ cảnh; chọn kết luận và ghi chú; lưu; quản lý tài khoản liên quan chỉ admin; auditor đọc.', ['backend/security.test.js','backend/operations.test.js','tests/frontend_ui.py','tests/operations_ui.py']);
group('events-local','Bảng sự kiện cũ','shared/admin.jsx',['EventsPanel'],SEC,
  ['GET /api/security'], 'Tìm/lọc/CSV local. Component được khai báo nhưng hiện các trang dùng RemoteExplorer thay thế; chưa thấy callsite hoạt động.');
group('actions','Lịch sử xử lý cũ','shared/admin.jsx',['ActionsPanel'],SEC,
  ['GET /api/security','POST /api/admin/users/:id/actions (admin, qua dialog)'],
  'Lọc pending/partial/synced; thử lại qua callback. Web B hiện dùng ReconciliationPanel; component cũ không được coi là luồng chính.');
group('identity','Kết nối Keycloak','shared/admin.jsx',['IdentityCard'],SEC,
  ['GET /api/security/keycloak'],'Card chỉ đọc trạng thái và chính sách; không có nút ghi.');
group('account-action','Khóa/mở/thu hồi phiên/yêu cầu MFA','shared/admin.jsx',['AccountDialog'],'admin; cấm xử lý admin/chính mình/vòng đời hold',
  ['POST /api/admin/users/:id/actions'],
  'Radio chọn hành động; lý do; hủy/xác nhận; LDAP không cho require-mfa tại local; khóa/mở có tác động thật, không chạy Đợt 1.', ['backend/security.test.js','tests/frontend_ui.py']);
group('notifications','Thông báo','shared/operations.jsx',['NotificationBell'],ALL,
  ['GET /api/notifications','PATCH /api/notifications/:id/read','POST /api/notifications/read-all'],
  'Mở/đóng chuông; làm mới danh sách; đọc từng thông báo; đánh dấu tất cả; điều hướng theo section; scope theo tài khoản/audience.', ['backend/operations.test.js','tests/operations_ui.py']);
group('explorer','Tra cứu lịch sử trên server','shared/operations.jsx',['RemoteExplorer','ReadTable'],SEC,
  ['GET /api/security/events','GET /api/security/events/:id','GET /api/security/login-events','GET /api/security/alert-list'],
  'Tìm, trạng thái/loại, mức độ, user/client/IP/role, từ/đến ngày, sort, reset lọc, refresh, phân trang, CSV tối đa 200 dòng, chi tiết truy cập/cảnh báo; không sửa log.', ['backend/operations.test.js','tests/frontend_ui.py','tests/operations_ui.py']);
group('security-insights','Thống kê và đồng bộ Keycloak','shared/operations.jsx',['SecurityInsights'],SEC,
  ['GET /api/security/summary','POST /api/security/sync (admin)'],
  'Đọc thống kê; thử lại; admin kích hoạt collector, có ghi dữ liệu; auditor không được sync.', ['backend/operations.test.js','tests/operations_ui.py']);
group('sessions','Phiên cá nhân và phiên nhân viên','shared/operations.jsx',['SessionsPanel'],ALL,
  ['GET /api/me/sessions','POST /api/me/sessions/revoke','GET /api/admin/users/:id/sessions (admin)','POST /api/admin/users/:id/sessions/revoke (admin)'],
  'Refresh; chọn kết thúc phiên; lý do; hủy/xác nhận; phiên hiện tại đưa về đăng nhập; cấm thu hồi phiên không thuộc user; readOnly bảo vệ admin/hold.', ['backend/operations.test.js','tests/operations_ui.py']);
group('profile','Hồ sơ cá nhân','shared/operations.jsx',['PersonalProfile'],ALL,
  ['GET /api/profile','GET /api/me/security','GET /api/me/sessions'],
  'Hiển thị nguồn LDAP, nhúng AccountSecurity và SessionsPanel.');
group('employee','Thêm/sửa nhân viên và hồ sơ quản trị','shared/operations.jsx',['EmployeeDialog','field'],'admin; LDAP READ_ONLY, admin/hold được bảo vệ',
  ['GET /api/admin/users/:id','POST /api/admin/users','PATCH /api/admin/users/:id','POST /api/admin/users/:id/reset-password'],
  'Tab hồ sơ/phiên/bảo mật/lịch sử/password; tạo với username/email/họ tên/nhóm/role/password tạm; sửa hồ sơ; reset password có lý do; hủy/lưu. Trường password chỉ là tên trường, không có giá trị trong kiểm kê.', ['backend/operations.test.js','tests/operations_ui.py']);
group('account-security','MFA và khôi phục thiết bị','shared/week5.jsx',['AccountSecurity'],ALL,
  ['GET /api/me/security','GET /api/admin/users/:id/security (admin)','POST /api/admin/users/:id/mfa/recovery (admin)','Keycloak CONFIGURE_TOTP/prompt=login'],
  'Cập nhật/thử lại; đăng ký OTP cá nhân; admin mở recovery, nhập tham chiếu xác minh/lý do, xác thực lại và xác nhận. Backend yêu cầu admin có OTP và auth_time trong 2 phút.', ['backend/week5-10.test.js','tests/operations_ui.py']);
group('access-matrix','Ma trận quyền','shared/week5.jsx',['AccessMatrix'],SEC,
  ['GET /api/security/access-matrix'], 'Tìm theo user/nhóm, role, CSV trang hiện tại, trước/sau.', ['tests/release_live.py']);
group('reconciliation','Đối chiếu thao tác tài khoản','shared/week5.jsx',['ReconciliationPanel'],SEC,
  ['GET /api/security/actions','GET /api/admin/users/:id/reconciliation (admin)','POST /api/admin/users/:id/actions/:actionId/retry (admin)'],
  'Lọc trạng thái; refresh/phân trang; admin đọc Keycloak, so sánh local/remote, nhập căn cứ và xử lý lại với version; auditor đọc lịch sử.', ['tests/release_live.py','tests/frontend_ui.py']);
group('analytics','Biểu đồ bảo mật','shared/week5.jsx',['SecurityAnalytics','Problem','Waiting'],SEC,
  ['GET /api/security/analytics'], 'Số liệu/biểu đồ read-only, retry lỗi dùng callback của nơi nhúng.', ['tests/release_live.py']);
group('insights','Thống kê công cá nhân','shared/week5.jsx',['WorkspaceInsights'],ALL,
  ['GET /api/me/workspace?month='],'Đọc KPI/biểu đồ cá nhân theo tháng, retry.', ['tests/release_live.py']);
group('calendar','Lịch công và đơn theo ngày','shared/week5.jsx',['WorkspaceCalendar','RequestTimeline'],ALL,
  ['GET /api/me/workspace?month='],'Chọn ngày, xem giờ công và timeline đơn, retry.', ['tests/release_live.py']);
group('role-overview','Tổng quan theo vai trò','shared/week5.jsx',['RoleOverview'],ALL,
  ['GET /api/profile','GET /api/team (manager/admin)'], 'Manager mở nhóm; auditor mở bảo mật; employee mở bảng công.');
group('directory','Danh bạ, federation và mapping LDAP','shared/directory.jsx',['DirectoryPanel','DirectoryUsers'],SEC,
  ['GET /api/security/directory','GET /api/security/directory/users','GET /api/security/directory/jobs','GET /api/security/directory/mappings','POST /api/security/directory/sync (admin)'],
  'Ba view; search/state filter, phân trang user; refresh; full/changed sync và lý do chỉ admin; mapping read-only; dialog/hủy/xác nhận; không ghi LDAP trực tiếp.', ['tests/release_live.py','tests/release_ui.py']);
group('access','Yêu cầu quyền cá nhân','shared/governance.jsx',['AccessWorkspace'], 'Mọi role Web A; quyền có thời hạn không mở Web B',
  ['GET /api/me/access','POST /api/me/access/requests','POST /api/me/access/requests/:id/cancel','GET /api/access/resources/:resource'],
  'Chọn tài nguyên, thời hạn 1–30 ngày, lý do; gửi/rút pending; mở tài nguyên đã cấp; xem lịch sử.', ['backend/week5-10.test.js','tests/governance_live.py']);
group('approvals','Phê duyệt quyền','shared/governance.jsx',['AccessApprovals'],'manager/admin Web A; admin Web B; cấm tự duyệt, giới hạn nhóm',
  ['GET /api/governance/approvals','POST /api/governance/requests/:id/decision'],
  'Tìm/lọc trạng thái; trước/sau; duyệt/từ chối/thu hồi; nhập lý do, hủy/xác nhận.', ['backend/week5-10.test.js','tests/governance_live.py','tests/release_ui.py']);
group('workflow-form','Lập Join/Change/Leave','shared/governance.jsx',['WorkflowForm'],'admin',
  ['POST /api/security/governance/workflows'],
  'Chọn kind/source/target, username/họ tên/email/nhóm/role/lý do; lập yêu cầu, hủy. Join mặc định employee.', ['backend/week5-10.test.js','tests/governance_live.py']);
group('workflow','Chi tiết và thực hiện vòng đời','shared/governance.jsx',['WorkflowDialog'],SEC,
  ['GET /api/security/governance/workflows/:id','GET /api/security/governance/workflows/:id/observed','POST /api/security/governance/workflows/:id/decision (admin)','POST /api/security/governance/workflows/:id/execute (admin)'],
  'Refresh/đọc hiện trạng; admin phê duyệt/từ chối/thực hiện/tiếp tục; note và password tạm cho Join local; sao chép lệnh operator LDAP; không tự chạy lệnh operator.', ['backend/week5-10.test.js','tests/governance_live.py']);
group('review','Rà soát quyền','shared/governance.jsx',['ReviewPanel'],'admin, auditor tạo snapshot/ghi khuyến nghị; thu hồi grant chỉ admin',
  ['GET /api/security/governance/reviews','POST /api/security/governance/reviews','GET /api/security/governance/reviews/:id','POST /api/security/governance/review-items/:id','POST /api/governance/requests/:id/decision (admin)'],
  'Chọn/tạo đợt; phân trang; ghi keep/revoke/investigate và căn cứ; admin thu hồi thật qua dialog riêng.', ['tests/release_live.py','tests/release_ui.py']);
group('governance','Danh sách vòng đời/ma trận grant','shared/governance.jsx',['GovernancePanel','Pager','Rows','Note','Feedback','State'],SEC,
  ['GET /api/security/governance','GET /api/security/governance/workflows','GET /api/security/governance/matrix'],
  'Search/state, phân trang, refresh, mở workflow và lập mới (admin); ma trận read-only; Note/Pager được nhúng nhiều luồng với quyền nơi gọi.', ['tests/release_live.py','tests/release_ui.py']);
group('central','Audit PostgreSQL và bộ lọc','shared/central-audit.jsx',['CentralAudit','AuditFeedback','AuditTable','AuditPager'],SEC,
  ['GET /api/security/central/health','GET /api/security/central/events','GET /api/security/central/summary','POST /api/security/central/retry (admin)'],
  'Tab overview/events/incidents/health; lọc q/source/decision/user/request/session/from/to; áp dụng, phân trang, chuẩn bị/xuất CSV tối đa 5000; mở event; admin gửi lại outbox.', ['tests/audit_live.py','tests/release_ui.py']);
group('event-detail','Điều tra sự kiện PostgreSQL','shared/central-audit.jsx',['EventDetail'],SEC,
  ['GET /api/security/central/events/:id'],'Đọc trường sự kiện và tối đa 100 sự kiện cùng request/phiên; đóng dialog.', ['tests/audit_live.py']);
group('central-incidents','Danh sách cảnh báo tập trung','shared/central-audit.jsx',['CentralIncidents'],SEC,
  ['GET /api/security/central/incidents'], 'Lọc trạng thái, phân trang, mở log gốc, mở lịch sử/xử lý.', ['tests/audit_live.py']);
group('incident-review','Kết luận incident PostgreSQL','shared/central-audit.jsx',['IncidentReview'],SEC,
  ['GET /api/security/central/incidents/:id','POST /api/security/central/incidents/:id (admin)'],
  'Đọc lịch sử; admin chọn state/ghi căn cứ/lưu với version; xung đột tải lại.', ['tests/audit_live.py']);
group('audit-settings','Ngưỡng cảnh báo và retention','shared/central-audit.jsx',['AuditSettings'],'admin',
  ['POST /api/security/central/settings','POST /api/security/central/retention'],
  'Chỉnh retention/login/deny threshold, lưu; xem trước retention; ô xác nhận và nút xóa log hết hạn có tác động phá hủy, TUYỆT ĐỐI KHÔNG chạy trong Đợt 1.');
group('audit-backfill','Lấy bù collector','shared/central-audit.jsx',['AuditBackfill'],'admin',
  ['POST /api/security/central/backfill'], 'Chọn nguồn, thời điểm, lý do; đặt checkpoint; có ghi dữ liệu, không chạy Đợt 1.');
group('detection','Kết quả, lượt chạy và đánh giá Detection','shared/detection.jsx',['DetectionPanel'],SEC,
  ['GET /api/security/central/detection/status','GET /api/security/central/detection/results','GET /api/security/central/detection/evaluations','POST /api/security/central/detection/run (admin)','POST /api/security/central/detection/evaluate (admin)'],
  'Tab kết quả/metrics/runs/config; lọc Normal/Anomaly, phân trang, features/gán nhãn, log gốc; admin chạy batch/tính metrics; CSV metrics; dữ liệu mô phỏng không chứng minh độ chính xác thực tế.', ['tests/test_detection.py','tests/audit_live.py','tests/release_ui.py']);
group('detection-config','Cấu hình luật Detection','shared/detection.jsx',['DetectionConfig'],'admin ghi; auditor xem',
  ['POST /api/security/central/detection/config'],
  'Enabled; login/deny/request threshold; giờ bắt đầu/kết thúc; UTC offset; lưu version; không kích hoạt trong Đợt 1.');
group('label','Đặc trưng và nhãn độc lập','shared/detection.jsx',['LabelDialog'],'admin, auditor theo backend reader',
  ['POST /api/security/central/detection/labels/:eventId'],
  'Chọn Normal/Anomaly, train/evaluation, scenario và căn cứ; lưu version. Đây là ghi nhãn, ngoại lệ đối với mô tả auditor chỉ đọc.', ['tests/audit_live.py']);

// Continue the inventory in separate artifacts; never overwrite the phase-1 snapshot.
for(const id of ['auth-a','auth-b']){
  const auth=groups.find(g=>g.id===id);
  auth.components=['AuthGate (điểm mount tại main.jsx)'];
  auth.behavior='Mount AuthGate dùng chung; check-sso không tương tác, Code + PKCE S256; backend xác nhận profile trước mở app. Mật khẩu/OTP chỉ tại Keycloak.';
  auth.testReferences=['tests/auth-controller.test.mjs','tests/auth-browser.cjs'];
}
group('auth-shared','Trang bắt đầu và trạng thái xác thực dùng chung','shared/auth.jsx',
  ['AuthScreen','AuthGate','AuthBoundary'],'Chưa đăng nhập; Web A mọi role đã cấp, Web B admin/auditor',
  ['GET /realms/:realm/.well-known/openid-configuration','OIDC authorization/token/logout qua keycloak-js','GET /api/profile'],
  'Welcome/checking/authenticating/expired/unavailable/denied/required/error; login/retry/logout/reload/chuyển app. Không có input mật khẩu/OTP. Khi mất mạng, tạm đóng modal và giữ nội dung để phục hồi.',
  ['tests/auth-controller.test.mjs','tests/session-monitor.test.mjs','tests/auth-browser.cjs']);

const phase5b=process.argv.includes('--phase5b');
const phase5a=process.argv.includes('--phase5a')||phase5b;
const phase3=process.argv.includes('--phase3')||phase5a;
if(phase3){
  const table=groups.find(g=>g.id==='table');table.file='web-a/src/WorkspacePanels.jsx';table.components=['AttendanceTable'];
  group('workspace-panels','Đơn cá nhân và duyệt đơn theo nhóm','web-a/src/WorkspacePanels.jsx',['MyRequests','TeamWorkspace','CardPages'],ALL,['GET /api/corrections','GET /api/team?month=','Callback App: POST /api/corrections/:id/cancel, PATCH /api/corrections/:id'],'Lọc, phân trang, tiến trình, rút đơn có xác nhận; không tự duyệt; CSV và bảng công theo bộ lọc.',['tests/workspace-browser.cjs','tests/workspace.test.mjs']);
  for(const p of pages.filter(p=>p.app==='A'&&['requests','team'].includes(p.id)))p.groups.push('workspace-panels');
}
if(phase5a){
  group('security-incidents','Phase 5A read-only incident views','web-b/src/IncidentWorkspace.jsx',['ReadFeedback','Facts','IncidentList','EventIncidentLinks','IncidentDetail'],SEC,['GET /api/security/alert-list','GET /api/security/alerts/:id','GET /api/security/central/incidents','GET /api/security/central/incidents/:id'],'Read-only filters, pagination, CSV, source evidence, timeline, history, assessment, proposals and verification. No incident mutations.',['tests/security-view.test.mjs','tests/security-browser.cjs']);
  for(const p of pages.filter(p=>p.app==='B'&&['B:overview','B:alerts','B:central-audit','B:detection'].includes(p.id)))p.groups.push('security-incidents');
  pages.find(p=>p.id==='B:alerts').groups=['security-incidents'];
  const centralPage=pages.find(p=>p.id==='B:central-audit');centralPage.groups=centralPage.groups.filter(g=>!['central-incidents','incident-review'].includes(g));
  for(const id of ['central-incidents','incident-review']){const g=groups.find(g=>g.id===id);g.behavior='Component cũ còn trong mã nguồn; Web B Đợt 5A không gọi nhánh này. Dùng IncidentList/IncidentDetail chỉ đọc thay thế. '+g.behavior;}

}
if(phase5b){
 group('incident-editor','Phase 5B investigation forms','web-b/src/IncidentEditor.jsx',['IncidentEditor'],'admin writes; auditor reads via Backend RBAC',['PATCH /api/security/alerts/:id','POST /api/security/central/incidents/:id','GET /api/security/alerts/:id','GET /api/security/central/incidents/:id','GET /api/security/actions'],'Assessment, append proposals, link recorded actions, verification, supported states, confirmation, retained draft, version conflict and ambiguous response handling. No remediation execution.',['tests/incident-editor.test.mjs','tests/incident-browser.cjs']);
 for(const p of pages.filter(p=>p.app==='B'&&['B:overview','B:alerts','B:central-audit','B:detection'].includes(p.id)))p.groups.push('incident-editor');
}
const files = [...new Set(groups.map(g => g.file))].sort();
const NATIVE = new Set(['button','a','form','input','select','textarea','summary','dialog']);
const WIDGETS = new Set(['Search','ExportButton','DataTable','StatCard','FeatureGrid','Dialog','Modal','Note']);
const controls = [], sourceHashes = {};
function walk(node, ancestors, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {for (const n of node) walk(n, ancestors, visit); return;}
  if (!node.type) return;
  visit(node, ancestors);
  for (const [key,value] of Object.entries(node)) {
    if (!['loc','start','end','extra','comments','tokens'].includes(key)) walk(value, [...ancestors,node], visit);
  }
}
for (const file of files) {
  const code = fs.readFileSync(path.join(ROOT,file),'utf8');
  sourceHashes[file] = crypto.createHash('sha256').update(code).digest('hex');
  const ast = parse(code,{sourceType:'module',plugins:['jsx']});
  const slice = node => code.slice(node.start,node.end).replace(/\s+/g,' ').trim();
  walk(ast,[],(node,ancestors) => {
    const fieldCall = node.type === 'CallExpression' && node.callee.type === 'Identifier' && ['field','input'].includes(node.callee.name);
    if (node.type !== 'JSXElement' && !fieldCall) return;
    const tag = fieldCall ? node.callee.name+'()' : node.openingElement.name.name;
    if (!fieldCall && !NATIVE.has(tag) && !WIDGETS.has(tag)) return;
    const functions = ancestors.filter(n => n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration');
    let owner, meta;
    for (const fn of [...functions].reverse()) {
      meta = groups.find(g => g.file === file && g.components.includes(fn.id?.name));
      if (meta) {owner = fn.id.name;break;}
    }
    if (!meta) throw Error(`Unmapped interactive source: ${file}:${node.loc.start.line}`);
    const attributes = fieldCall ? [] : node.openingElement.attributes.filter(a=>a.type==='JSXAttribute');
    const attrs = Object.fromEntries(attributes.map(a=>[a.name.name,a.value ? a.value.type === 'StringLiteral' ? a.value.value : slice(a.value) : true]));
    const textParts = [];
    if (!fieldCall) walk(node.children,[], n => {
      if (n.type === 'JSXText' && n.value.trim()) textParts.push(n.value.trim());
    });
    const wrappingLabel = [...ancestors].reverse().find(a=>a.type==='JSXElement' && a.openingElement.name.name==='label');
    const wrapperText = wrappingLabel ? wrappingLabel.children.filter(n=>n.type==='JSXText').map(n=>n.value.trim()).filter(Boolean).join(' ') : '';
    const label = fieldCall ? slice(node.arguments[1]) : attrs['aria-label'] || attrs.label || attrs.title || attrs.name || wrapperText || textParts.join(' ').replace(/\s+/g,' ').slice(0,180) || `[${tag} động; xem biểu thức]`;
    const conditions = ancestors.filter(a=>a.type==='LogicalExpression' && node.start>=a.right.start || a.type==='ConditionalExpression').map(a=>slice(a.type==='LogicalExpression'?a.left:a.test));
    const handlers = Object.fromEntries(Object.entries(attrs).filter(([k])=>/^on[A-Z]/.test(k)));
    const directCalls = [];
    walk(node,[], n => {
      if (n.type==='CallExpression' && n.callee.type==='Identifier' && ['api','perform'].includes(n.callee.name)) {
        directCalls.push({pathExpression:n.arguments[0]?slice(n.arguments[0]):'',methodExpression:n.arguments[1]?slice(n.arguments[1]):'GET'});
      }
    });
    const repeatedDomains = ancestors.filter(a=>a.type==='CallExpression' && a.callee.type==='MemberExpression' && a.callee.property.name==='map').map(a=>slice(a.callee.object));
    controls.push({id:`UI-${String(controls.length+1).padStart(4,'0')}`,group:meta.id,
      source:file,line:node.loc.start.line,column:node.loc.start.column+1,endLine:node.loc.end.line,endColumn:node.loc.end.column+1,component:owner,tag,
      label,fieldKey:fieldCall?slice(node.arguments[0]):undefined,
      labelExpressions:fieldCall?[]:(node.children||[]).filter(n=>n.type==='JSXExpressionContainer').map(n=>slice(n)).slice(0,6),
      inputType:attrs.type,href:attrs.href,valueExpression:attrs.value,handlers,conditions:[...new Set(conditions)],disabled:attrs.disabled,
      required:attrs.required || false,minLength:attrs.minLength,maxLength:attrs.maxLength,
      min:attrs.min,max:attrs.max,pattern:attrs.pattern,repeatedDomains,
      options:fieldCall?[]:(node.children||[]).filter(n=>n.type==='JSXElement' && n.openingElement.name.name==='option').map(n=>slice(n)),
      access:meta.access,apiContext:meta.apis,directApiCalls:directCalls,
      purpose:meta.behavior,staticReview:'REVIEWED',liveRetestPhase1:'NOT_RUN',
      testReferences:meta.testReferences});
  });
}
for (const p of pages) {
  p.groups = [...new Set(['shell','notifications',...p.groups])];
  p.apis = [...new Set(p.groups.flatMap(id=>groups.find(g=>g.id===id).apis))];
  p.controlIds = controls.filter(c=>p.groups.includes(c.group)).map(c=>c.id);
}
const forms = controls.filter(c=>c.tag==='form').map(form=>({id:form.id,source:form.source,line:form.line,component:form.component,group:form.group,
  access:form.access,apiContext:form.apiContext,onSubmit:form.handlers.onSubmit || 'Callback của component',
  controlIds:controls.filter(c=>c.id!==form.id && c.source===form.source && c.component===form.component &&
    (c.line>form.line || c.line===form.line && c.column>form.column) &&
    (c.endLine<form.endLine || c.endLine===form.endLine && c.endColumn<form.endColumn)).map(c=>c.id)}));
const inventory = {schemaVersion:1,snapshotDate:'2026-11-09',scope:'Web A, Web B và shared JSX; không thực thi ứng dụng',
  countingRule:'Một vị trí JSX/field()/input() là một mẫu tương tác; map/role/row/tab có thể sinh nhiều phần tử runtime. WIDGET là callsite, native là implementation; không cộng thành số nút runtime.',
  testPolicy:'REVIEWED chỉ xác nhận đã đọc mã. NOT_RUN là chưa chạy lại UI/live trong Đợt 1. testReferences chỉ là suite liên quan; xem báo cáo kết quả riêng.',
  securityNotes:['Không có giá trị input/password/OTP/token runtime trong file.',
    'Auditor được ghi nhãn Detection và khuyến nghị rà soát theo API hiện tại; không được sửa tài khoản/xử lý incident.',
    'Retention apply có thể xóa dữ liệu; chỉ kiểm kê, không thực hiện.',
    'Keycloak login/OTP là UI ngoài JSX, chỉ kiểm kê điểm tích hợp; không giả định đã kiểm thử từng control của theme.'],
  sourceHashes,pages,groups,forms,controls};
const escape = value=>String(value ?? '').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
let markdown = '# Kiểm kê trang và tương tác Web A / Web B — Đợt 1\n\n';
markdown += 'Ngày khảo sát: 09/11/2026 (UTC+7). Sinh từ mã nguồn bằng `node scripts/inventory_ui.cjs`. Không chạy ứng dụng hoặc gọi API.\n\n';
markdown += `Có **${pages.length} mục trang/menu**, **${groups.length} nhóm chức năng**, **${forms.length} mẫu form**, **${controls.length} vị trí JSX/helper tương tác** trong ${files.length} file. Các mẫu lặp theo dòng/role/tab không phải số nút hiển thị runtime. Widget callsite và phần tử native được ghi riêng theo tag.\n\n`;
markdown += 'Trạng thái `REVIEWED`: đã đọc mã; `NOT_RUN`: chưa chạy lại UI/live Đợt 1. Tham chiếu test là phạm vi liên quan, không khẳng định từng nút đã đạt. Kết quả suite Đợt 1 xem [báo cáo](KET_QUA_KIEM_THU_DOT_1.md).\n\n';
markdown += 'API trong từng dòng là **ngữ cảnh component**; input lọc/nút đóng có thể chỉ cập nhật local state. `directApiCalls`, handler, điều kiện hiển thị, disabled, giới hạn trường và label động có đủ trong [JSON](interaction-inventory.json). Không lưu bất kỳ giá trị người dùng/credential nào.\n\n';
markdown += '## Trang và menu\n\n| ID | Đường dẫn | Menu | Quyền | Nhóm chức năng | UI Đợt 1 |\n|---|---|---|---|---|---|\n';
for(const p of pages) markdown += `| ${p.id} | \`${p.route}\` | ${p.menu} | ${p.roles.join(', ')} | ${p.groups.join(', ')} | NOT_RUN |\n`;
markdown += '\nTrang trước đăng nhập, lỗi render, modal, command palette, app chooser và mobile menu được liệt kê trong nhóm auth/shell bên dưới. Keycloak login/password/OTP là điểm tích hợp ngoài mã JSX; chưa kiểm thử lại các màn hình này.\n\n';
markdown += '## Biểu mẫu và các phần tử thành phần\n\n| Form | Component | Nhóm quyền/API | Handler | Các ID trường/nút trong form |\n|---|---|---|---|---|\n';
for(const form of forms) markdown += `| ${form.id} | ${form.component} | ${form.group} | ${escape(form.onSubmit)} | ${form.controlIds.join(', ')} |\n`;
markdown += '\n';
markdown += '## Nhóm chức năng, API và quyền\n\n';
for(const g of groups) {
  markdown += `### ${g.id} — ${g.title}\n\n${g.behavior}\n\n- Quyền: ${g.access}.\n- API: ${g.apis.map(a=>'`'+a+'`').join('; ')}.\n- Nguồn: \`${g.file}\`, ${g.components.join(', ')}.\n- Test liên quan: ${g.testReferences.length?g.testReferences.map(t=>'`'+t+'`').join(', '):'Chưa có ánh xạ test cụ thể; cần bổ sung ở đợt phù hợp'}. UI/live Đợt 1: **NOT_RUN**.\n\n`;
}
markdown += '## Từng vị trí tương tác trong mã nguồn\n\n';
for(const g of groups) {
  const rows=controls.filter(c=>c.group===g.id);
  if(!rows.length) continue;
  markdown += `### ${g.id}\n\n| ID | Component / tag | Nhãn hoặc trường | Vị trí nguồn | Quyền / API / test |\n|---|---|---|---|---|\n`;
  for(const c of rows) markdown += `| ${c.id} | ${c.component} / ${c.tag} | ${escape(c.label)} | [${c.source}:${c.line}](../${c.source}#L${c.line}) | Theo nhóm ${g.id}; REVIEWED; UI NOT_RUN |\n`;
  markdown += '\n';
}
markdown += '## Giới hạn và điểm cần theo dõi\n\n- Cảnh báo local, incident PostgreSQL và Detection chưa có trang sự cố hợp nhất.\n- Alert local ghi đè note/status; chưa có version/history như incident PostgreSQL.\n- Luồng khởi tạo Keycloak A/B chưa thống nhất timeout.\n- `EventsPanel` và một số component cũ còn trong source; cần phân biệt khai báo với callsite hoạt động.\n- Các `.map()` menu, cột bảng, ngày lịch, radio, tab, notification và hàng dữ liệu sinh control động; xem biểu thức/nguồn và domain mô tả theo nhóm.\n- Auditor được ghi nhãn Detection và snapshot/khuyến nghị review; tài liệu nói chỉ đọc toàn bộ Web B cần được chỉnh ở đợt phù hợp.\n- Retention apply/xóa log chỉ được ghi nhận trong danh mục, không chạy.\n- Bộ E2E hiện tại có thao tác dữ liệu thật, tài khoản và bỏ qua lỗi TLS ở một số ca; không chạy Đợt 1.\n';
inventory.predecessor='docs/interaction-inventory.json';
inventory.phase=2;
markdown=markdown.replace('— Đợt 1','— Đợt 2').replaceAll('(interaction-inventory.json)','(interaction-inventory-phase2.json)')
  .replaceAll('(KET_QUA_KIEM_THU_DOT_1.md)','(KET_QUA_KIEM_THU_DOT_2.md)')
  .replace('Luồng khởi tạo Keycloak A/B chưa thống nhất timeout.','Luồng khởi tạo Keycloak A/B đã dùng chung timeout và kiểm tra discovery trong Đợt 2.');
markdown+='\nBản Đợt 1 giữ nguyên tại `docs/KIEM_KE_TUONG_TAC.md` và `docs/interaction-inventory.json`. Các cột UI/live Đợt 1 tiếp tục là lịch sử; kiểm thử browser Đợt 2 dùng OIDC giả và adapter thật, không phải Keycloak live. Xem báo cáo Đợt 2 để đối chiếu kết quả. Timeout đăng nhập A/B đã dùng chung; ghi chú hạn chế timeout ở snapshot cũ là lịch sử.\n';
if(phase3){inventory.phase=3;inventory.predecessor='docs/interaction-inventory-phase2.json';markdown=markdown.replace('— Đợt 2','— Đợt 3').replaceAll('(interaction-inventory-phase2.json)','(interaction-inventory-phase3.json)').replaceAll('(KET_QUA_KIEM_THU_DOT_2.md)','(KET_QUA_KIEM_THU_DOT_3.md)').replace('`node scripts/inventory_ui.cjs`','`node scripts/inventory_ui.cjs --phase3`');markdown+='\nĐợt 3 chỉ nâng cấp Workspace. Snapshot Đợt 1 và Đợt 2 được giữ nguyên. Kết quả browser giả lập nằm trong báo cáo Đợt 3; không suy diễn từ cột lịch sử NOT_RUN.\n';}
if(phase5a){markdown=markdown.replace('Kết quả suite Đợt 1 xem','Kết quả thực thi Đợt 5A xem').replace('— Đợt 3','— Đợt 5A').replace('Đợt 3 chỉ nâng cấp Workspace. Snapshot Đợt 1 và Đợt 2 được giữ nguyên. Kết quả browser giả lập nằm trong báo cáo Đợt 3; không suy diễn từ cột lịch sử NOT_RUN.','Đợt 5A nâng cấp Web B và hồ sơ sự cố chỉ đọc. Snapshot Đợt 1–3 được giữ nguyên. Trạng thái NOT_RUN là trường lịch sử của kiểm kê; kết quả thực thi từng nhóm xem báo cáo Đợt 5A. Đường dẫn chi tiết: /b/#/incident/sqlite/:id và /b/#/incident/audit/:id; không phải menu mới.');inventory.phase='5A';inventory.predecessor='docs/interaction-inventory-phase3.json';markdown=markdown.replaceAll('phase3.json','phase5a.json').replaceAll('DOT_3.md','DOT_5A.md').replaceAll('--phase3','--phase5a');}
if(phase5b){markdown=markdown.replace('Đợt 5A nâng cấp Web B và hồ sơ sự cố chỉ đọc.','Đợt 5B bổ sung biểu mẫu điều tra, đề xuất, liên kết hành động, kiểm chứng và trạng thái theo API Đợt 4; chỉ admin được ghi, auditor xem.');inventory.phase='5B';inventory.predecessor='docs/interaction-inventory-phase5a.json';markdown=markdown.replaceAll('5A','5B').replaceAll('phase5a','phase5b');}
const outputs = {[phase5b?'docs/interaction-inventory-phase5b.json':phase5a?'docs/interaction-inventory-phase5a.json':phase3?'docs/interaction-inventory-phase3.json':'docs/interaction-inventory-phase2.json']:JSON.stringify(inventory,null,2)+'\n',[phase5b?'docs/KIEM_KE_TUONG_TAC_DOT_5B.md':phase5a?'docs/KIEM_KE_TUONG_TAC_DOT_5A.md':phase3?'docs/KIEM_KE_TUONG_TAC_DOT_3.md':'docs/KIEM_KE_TUONG_TAC_DOT_2.md']:markdown};
let stale=false;
for(const [name,content] of Object.entries(outputs)) {
  if(process.argv.includes('--check')) {
    if(!fs.existsSync(path.join(ROOT,name)) || fs.readFileSync(path.join(ROOT,name),'utf8')!==content) {console.error('Inventory out of date: '+name);stale=true;}
  } else fs.writeFileSync(path.join(ROOT,name),content,'utf8');
}
console.log(`Inventory: ${pages.length} pages, ${groups.length} groups, ${controls.length} JSX/field sites; live UI not run.`);
if(stale) process.exitCode=1;
