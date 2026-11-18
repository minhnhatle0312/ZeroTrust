# Thiết kế liên kết danh tính LDAP — 18/11/2026

**Cập nhật sau phê duyệt thiết kế:** source schema/resolver và tích hợp Backend đã được triển khai, 343/343 kiểm thử cô lập PASS. Chưa migration/restart/sync thật và chưa READY FOR APPLY. Xem [báo cáo triển khai](TRIEN_KHAI_IDENTITY_BINDINGS.md) để biết phạm vi, file thay đổi và các gate còn lại. Nội dung bên dưới giữ nguyên như thiết kế/bằng chứng của lượt trước; kết luận “chưa triển khai Backend” là trạng thái tại thời điểm viết thiết kế.

**Kết luận: đề xuất bảng liên kết riêng, giữ nguyên cả `staff.id` và Keycloak UUID. Thiết kế/fixture PASS; chưa triển khai vào Backend, chưa có plan được phép apply trên dữ liệu thật.**

Lượt này chỉ đọc source và báo cáo đã lưu, tạo dữ liệu giả, chạy kiểm thử cô lập. Không đọc lại database vận hành hoặc gọi Keycloak/LDAP; không restart, sync, migration hay rollback thật. Bằng chứng live ngày 18/11 ở `DIEU_TRA_LDAP_4_ERRORS.md` là kết quả điều tra trước, không thay preflight tương lai.

## 1. Nguyên nhân và quyết định

`directory.apply(remoteId)` tra `staff.id=remoteId`, rồi chặn username thuộc ID khác. Bốn hồ sơ vẫn dùng UUID/provider cũ, Keycloak dùng UUID/provider mới. `perform()` đếm bốn `DIRECTORY_CONFLICT`; API federation lọc provider mới nên trả 0. Quyền service account và đọc nhóm/role đã PASS ở lượt điều tra trước. Không có căn cứ bỏ guard, đổi role hoặc mapper để giải quyết.

| Phương án | Dữ liệu | Mã ứng dụng và rủi ro | Đánh giá |
|---|---|---|---|
| Đổi `staff.id` sang Keycloak UUID và cập nhật FK | Đổi PK, ít nhất 6 loại FK; còn tham chiếu không FK/JSON/audit liên hệ thống | Ít thay mô hình đăng nhập, nhưng cần phân loại mọi ID lịch sử, không thể rewrite audit bất biến; provider tái tạo lại sẽ tái diễn | Không chọn: trái ưu tiên giữ UUID local |
| Đổi UUID Keycloak về ID cũ | Can thiệp kho danh tính/phiên/federation | Không thuộc phạm vi; không giải quyết bản chất khóa nghiệp vụ gắn vào hệ thống ngoài | Loại |
| Chỉ đổi provider hoặc ghép username khi sync | Không giải quyết `JWT.sub != staff.id` | Có thể gán quyền/lịch sử người cũ cho tài khoản mới trùng tên | Loại |
| Thêm liên kết `(issuer, subject) → staff_id` | Không đổi hai UUID; không đổi FK/hàng lịch sử | Phải sửa toàn bộ ranh giới local/remote và kiểm thử bảo mật | **Chọn** |

Không dùng `staff_id_reconciliations` làm alias đăng nhập. Bảng này có ý nghĩa chuyển ID local trước đây, dùng hiển thị báo cáo; `historical-identity.js` cấm dùng nó để xác thực hoặc chọn đích hành động.

## 2. Kiểm kê quan hệ từ source/schema thật

Schema lấy từ `backend/store.js`, `incidents.js`, `central-audit.js`, `reconcile_staff_ids.py`, `audit/schema.sql`. Fixture dựng bằng `openStore()` trên SQLite mới, tuyệt đối không dùng DB vận hành làm fixture.

### Khóa ngoại trực tiếp tới staff

| Bảng/cột | Ý nghĩa | Với phương án liên kết |
|---|---|---|
| `attendance.user_id` | Chủ bảng công, UNIQUE(user_id,day) | Giữ nguyên |
| `corrections.user_id` | Chủ đơn, unique đơn pending/ngày | Giữ nguyên |
| `notification_reads.user_id` | Người đọc, composite PK với notification_id | Giữ nguyên |
| `directory_maintenance.user_id` | Hồ sơ đang giữ chặn tại nguồn | Giữ nguyên; lookup bằng local ID |
| `access_requests.user_id` | Quyền bổ sung, unique quyền đang mở | Giữ nguyên |
| `staff_id_reconciliations.new_id` | Đích ledger migration demo/MFA | Giữ nguyên 7 hàng, không thêm LDAP vào đây |

Không có ON UPDATE CASCADE để mặc nhiên dựa vào. Nếu chọn rekey, phải cập nhật rõ từng quan hệ và xử lý cả các cột không FK dưới đây. Kiểm kê schema phát sinh phải được chạy lại trước migration thật; danh sách này không được coi là vĩnh viễn.

### Tham chiếu không FK và dữ liệu lồng nhau

| Bảng/cột | Phân loại hiện tại, yêu cầu bảo toàn |
|---|---|
| `staff.id`, `directory_provider_id`, `directory_groups`, `directory_status` | ID nghiệp vụ; provider hiện đang bị dùng làm nguồn chuẩn ở directory/governance/restore |
| `corrections.reviewer_id` | ID reviewer local |
| `notifications.user_id` | Người nhận local; không được mất thông báo cá nhân |
| `events.actor_id`, `target` | Actor local; target đa nghĩa: staff, workflow, job, incident. Không thay chuỗi toàn cục |
| `identity_events.user_id` | ID nguồn Keycloak; khác namespace với actor của events sau khi tách ID |
| `alerts.actor_id`, `reviewer`, `investigation_json` | Actor có thể đến từ local hoặc Keycloak; reviewer là username; JSON chứa actor và tham chiếu sự kiện/hành động |
| `actions.actor_id`, `target_id`, `desired_json` | Actor/target local; trạng thái đích remote phải đọc qua binding |
| `action_attempts.actor_id` | Actor local; `action_id` FK tới actions |
| `directory_sync_jobs.actor_id`, `provider_id`, `remote_json` | Actor local; provider của lần chạy, giữ nguyên lịch sử provider cũ |
| `lifecycle_workflows.target_id`, `creator_id`, `reviewer_id`, `before_json`, `desired_json` | Local ID và snapshot cũ; không biến target_id thành remote subject |
| `lifecycle_history.actor_id` | Lịch sử actor local; workflow_id FK |
| `access_reviews.creator_id` | Người lập rà soát local |
| `access_review_items.user_id`, `reviewer_id`, `snapshot_json` | Hồ sơ/actor local và snapshot bất biến; review_id FK |
| `alert_history.actor`, `change_json` | Lịch sử phiên bản/actor/JSON trước–sau; alert_id FK |
| `alert_evidence.source,event_id` | Liên kết chính xác events/identity_events; không phải staff ID; alert_id FK |
| `audit_outbox.payload` | JSON bất biến: user_id, details.target_user_id…; giữ nguyên seq/event_key/payload và trạng thái delivery trong migration |
| `audit_events.user_id`, `details.target_user_id` (PostgreSQL) | ID nguồn tùy source; không có FK xuyên sang SQLite |
| `audit_incidents.investigation`, `incident_history.actor/change`, `audit_operations.actor/details` | Lịch sử và actor audit trung tâm; không rewrite |
| `detection_runs.actor`, `detection_labels.reviewer`, `detection_evaluations.actor`, JSON dataset/features | ID người vận hành, snapshot và đặc trưng phát hiện; không rebuild lịch sử để đổi ID |

Quan hệ gián tiếp phải giữ: notification_reads→notifications; action_attempts→actions; lifecycle_history→workflows; access_review_items→reviews; alert_evidence/history→alerts. PostgreSQL còn incident_evidence/incidents→audit_events, history→incidents, detection_results/labels→audit_events và results→runs. Không migration PostgreSQL trong đợt liên kết bốn hồ sơ.

`collector_state`, `collector_gaps`, audit_meta/delivery, incident_migrations, audit_settings và detection_config/state không mang staff ID trực tiếp, nhưng snapshot phải so sánh nguyên trạng để phát hiện ghi ngoài phạm vi.

## 3. Mô hình đề nghị

Hai bảng **mới**, không thêm cột vào bảng nghiệp vụ cũ trong migration liên kết:

1. `identity_link_batches`: id, plan_hash, manifest_hash, verified_at, evidence_ref. Ghi nguồn phê duyệt/bằng chứng, không chứa credential.
2. `staff_identity_bindings`: issuer, subject, staff_id FK, provider_id, source_instance, entry_uuid, state(active/retired), valid_from, valid_until, batch_id FK.

Ràng buộc: PK `(issuer,subject)`; một active binding cho `(issuer,staff_id)`; một active binding cho `(issuer,source_instance,entry_uuid)`; trạng thái/interval hợp lệ; không cascade delete. Subject cũ giữ hàng retired làm dấu chặn và tra lịch sử, **không tái gán cho hồ sơ khác**. Việc thay binding sau này phải có migration được duyệt, không API tự ghép.

`source_instance` là định danh nguồn LDAP do vận hành xác minh, không suy từ hostname hoặc Keycloak component ID (component có thể bị tạo lại). `entry_uuid` phải có bằng chứng từ đối tượng LDAP gốc. Issuer dùng đúng chuỗi đã được JWT verifier tin cậy; không alias URL/realm tùy tiện.

Kế hoạch dự kiến nếu đủ bằng chứng cho bốn người: **4 binding active + 4 binding retired + 1 batch = 9 INSERT vào 2 bảng mới; 0 UPDATE/DELETE bảng cũ**. Không đổi staff.json, 7 ledger cũ, 8 hồ sơ local hoặc 13 hồ sơ disabled. Số này là thiết kế, không phải xác nhận dữ liệu thật hiện tại còn đúng baseline.

Chọn giữ `staff.directory_provider_id` nguyên byte như dấu vết legacy. Với hồ sơ có binding, **binding là nguồn chuẩn cho provider hiện tại**; API trả trường currentProvider từ binding. Mọi filter/guard/snapshot phải qua resolver, không dùng COALESCE provider cũ để tự cấp quyền. Sync sau này cũng không ghi đè cột legacy của hồ sơ đã liên kết. Hồ sơ LDAP chưa liên kết tiếp tục báo rõ unlinked/conflict; không đưa vào nhóm đã sync thành công. Hồ sơ LDAP mới chỉ được tạo binding cùng transaction với hồ sơ mới sau kiểm tra nguồn/uniqueness; tuyệt đối không nhận username trùng để liên kết hồ sơ đã có.

Giữ cột legacy giúp migration không chạm dữ liệu cũ nhưng làm bản Backend cũ không tương thích với binding: **không được apply bảng rồi chạy lại source cũ**. `restore_week6.py` cũ lọc provider legacy có thể bỏ sót tài khoản; phải có guard nhận diện schema mới và chặn cho đến khi công cụ hiểu binding.

## 4. Ranh giới xác thực và hành động

Luồng đề nghị:

```text
JWT đã xác minh RS256 + issuer + audience/azp + exp/iat/sid
  → resolve (iss, sub) active binding
  → req.principal { issuer, subject, providerId, bindingVersion }
  → req.staff.id (UUID local ổn định)
  → LDAP freshness, disabled/governance/maintenance, revoked_before, role, MFA, session
  → nghiệp vụ dùng local ID / Admin API dùng subject
```

- Không đổi `claims.sub` thành local ID. `checkSession` tiếp tục dùng remote subject/sid. Account/MFA cache và invalidation dùng issuer/subject; cache binding cần generation hoặc vô hiệu hóa rõ ràng khi chuyển binding. Recheck binding và hồ sơ sau await trước cho phép request.
- Từ chối subject retired trước mọi fallback. Fallback ID trực tiếp chỉ cho hồ sơ `identity_source=local` thuộc issuer cấu hình. LDAP không binding phải chặn; không tự tạo hồ sơ từ token cũ hoặc username claim.
- Resolver chỉ tìm danh tính, **không cho phép truy cập**. Giữ nguyên MFA pending, kiểm tra phiên, quyền từ token đối chiếu local/LDAP, disabled, hold, rate limit, owner/team và tự duyệt đơn. Disabled vẫn bị từ chối sau lookup.
- Mọi remote action chọn subject hiện hành từ binding, xác minh provider và trạng thái nguồn trước gọi. Không chọn target từ alias lịch sử. Trong migration phải dừng cả pending action/retry, manual sync và refresh theo request; tắt timer thôi chưa đủ.
- Directory `seen` chứa remote subjects; vòng missing phải so `binding.subject`, không so `staff.id` (nếu không sẽ chặn nhầm cả bốn). Maintenance và notify vẫn theo local ID; revoke remote theo subject. Thiếu binding hoặc source đổi phải fail closed.
- Xung đột subject với hồ sơ local/active binding khác phải chặn cả lúc lập plan, provisioning và tạo user local mới. Không dùng username/role làm khóa ánh xạ; chúng chỉ là kiểm tra phụ.

## 5. Phạm vi mã và API phải triển khai sau phê duyệt

| File/module | Thay đổi cần thiết |
|---|---|
| Mới `backend/identity-bindings.js` | Resolver active/local→remote; lịch sử theo namespace/interval tách khỏi auth; không network write |
| `backend/store.js`, `bootstrap.js`, `server.js` | Schema/version binding, preflight integrity/uniqueness/marker và wiring resolver; giữ bootstrap local demo/MFA; không tự bind LDAP lúc startup |
| `backend/app.js`, `auth.js` | Tách principal/staff; checkAccount/cache và remediate target; giữ JWT/session checks và owner/team |
| `backend/directory.js` | apply/refresh/provision/allowEnable/reconcileForGovernance, provider guards, username guard loại trừ local ID đúng, maintenance/cache/pending, seen/missing, state/users filters, notify/alert target |
| `backend/keycloak-admin.js` | Hợp đồng nhận remote subject rõ ràng; bổ sung projection đọc bằng chứng LDAP nếu thực tế có thuộc tính phù hợp. Hiện directoryUser chưa xuất entryUUID; không tự thêm mapper hoặc coi thuộc tính không có là đã xác minh |
| `backend/operations.js`, `week5.js` | sessions/revoke, account security/MFA/reconciliation/retry/actions; local state giữ local ID, remote call dùng subject; user creation chặn namespace collision; reconciliation version phải gồm binding/version để retry không dùng đích cũ |
| `backend/governance.js` | snapshot provider; observed/execute: source.id phải so remote binding, w.target_id giữ local; requireDirectoryEnrollment/inspect/sessions/revoke/enable/disable; last_login nối theo lịch sử nguồn |
| `backend/identity-events.js`, `historical-identity.js`, `operations.js` | Đọc tên/ngữ cảnh qua nguồn+issuer+thời gian; giữ user_id nguyên nguồn; helper lịch sử riêng, không mở rộng helper SQL cũ thành auth alias |
| `backend/incidents.js`, `central-audit.js`, `audit/incidents.py`, `audit/detection.py` | Rà namespace/correlation, lọc và trình bày tài khoản; không nới so sánh bằng chứng nếu chưa có nguồn/interval đáng tin; xem phần 6 |
| `scripts/directory_user.py` | Guard row[0]==existing.id hiện sai với thiết kế; maintenance cả bắt đầu/kết thúc phải dùng local ID, logout dùng remote subject; bằng chứng đối tượng LDAP trước ghi nguồn |
| `scripts/process_governance.py` | Giữ target/hold local; dùng hợp đồng binding của maintain; recheck workflow/version trước ghi; không ghép username đơn thuần |
| `scripts/restore_week6.py` và tooling backup | Chặn bản cũ khi schema binding xuất hiện; recovery scope phải theo binding. Không dùng restore tuần 6 để rollback migration này |
| `scripts/restore_week5.py`, `backup_week5.py`, `backup_week6.py` | Restore tuần 5 đang UPDATE staff bằng current Keycloak ID nên cũng cần guard; backup SQLite đầy đủ đã chứa bảng mới nhưng snapshot localSecurity/source phải phân biệt ID. Các script này không phải migration/rollback được chọn |
| `shared/directory.jsx`, `shared/governance.jsx` | Thể hiện local profile/current provider/link state; không suy ID Keycloak từ `user.id` |
| `shared/operations.jsx`, `shared/week5.jsx` | URL :id tiếp tục local; regression sessions/security/MFA, không gửi subject tùy ý từ browser |
| `web-b/src/IncidentEditor.jsx`, `IncidentWorkspace.jsx` | Không lọc action chỉ bằng raw target_id===subject.userId khi khác namespace; chỉ dùng candidate/context do Backend kiểm chứng, vẫn giữ raw ID/bằng chứng |

`directory-schedule.js` không cần đổi thuật toán, nhưng test runtime disable và manual refresh phải còn hiệu lực. Không sửa script migration demo/MFA để nhận LDAP. Các setup/repair cũ không được dùng để triển khai thiết kế này.

| API/chức năng | Hợp đồng sau thay đổi |
|---|---|
| Mọi `/api/*`, đặc biệt `/api/profile` | Middleware resolve subject→local; `profile.id` vẫn local |
| GET `/api/security/directory`, `/users`; POST `/sync` | Provider hiện tại từ binding; sync dùng remote, profile trả local. `/jobs` giữ lịch sử provider, không sửa job cũ; `/mappings` không thay nhóm/role |
| GET `/api/me/sessions`, `/api/admin/users/:id/sessions`; POST tương ứng `/revoke` | API id local, phiên và endSession dùng remote subject |
| GET `/api/me/security`, `/api/admin/users/:id/security`, `/reconciliation`; POST `/mfa/recovery`, `/actions`, `/actions/:actionId/retry`; PATCH user và POST reset-password | Mọi đích remote qua binding; các hạn chế LDAP/password/MFA cũ giữ nguyên |
| GET `/api/security/governance/workflows/:id/observed`, POST `/execute`, workflows/reviews/matrix | Giữ target local, đối chiếu remote riêng; không cấp lại grants do migration |
| GET events/login-events/alert-list/alerts/:id/context; GET/PATCH alerts/:id | Hiển thị raw identity + ngữ cảnh đã xác minh; điều kiện bằng chứng không bị bỏ qua |
| `/api/security/central/events`, `/incidents`, `/detection/*` và chi tiết/POST incident | Giữ dữ liệu nguồn; correlation khác subject có điều kiện riêng, không coi mapping là khắc phục sự cố |
| Attendance/check-in/check-out, corrections/cancel/duyệt, team, notifications/read, me/access và governance approvals | Không cần đổi khóa nghiệp vụ hoặc body; kiểm thử owner/team/self-approval/visibility sau auth resolution |

Không đổi OIDC client, URL callback, JWT audience/issuer, RBAC mapping hoặc LDAP/MFA policy. Các biến môi trường hiện tại không được dùng để tự ghép provider cũ sang mới.

## 6. Audit và điều tra: bảo toàn khác với tự động gộp

Hiện `events.actor_id` là local; `identity_events.user_id` là Keycloak. Collector đang tra username bằng `staff.id=remoteId`; phải đổi lookup nhưng **không sửa user_id đã ghi**. Trigger outbox giữ nguyên payload cũ; không xóa/requeue/backfill để rewrite ID. Keycloak-admin audit actor còn có thể là service account, không phải nhân viên bị tác động.

`incidents.js` so sánh raw ID để chọn bằng chứng và action; `audit/incidents.py` cũng kiểm tra event user/target khớp anchor. Sau tách UUID, chúng có thể từ chối liên kết một action local với sự kiện Keycloak mới. Đây là giới hạn phải xử lý có chủ đích, không sửa bằng phép OR theo username hoặc coi mọi alias là cùng actor.

Thiết kế chia hai mức:

- **Mức liên kết hồ sơ:** giữ nguyên raw events, incident/evidence/history; thêm context/resolvedStaffId có provenance ở lớp đọc. Mapping lịch sử dùng issuer/source và khoảng thời gian có bằng chứng; không có chứng cứ thời gian thì trả unresolved. Các yêu cầu chứng minh khắc phục xuyên hai subject tiếp tục bị chặn. Không đánh dấu toàn bộ tính năng điều tra đã nghiệm thu.
- **Mức tương quan audit đầy đủ (hạng mục riêng trước nghiệm thu xuyên nguồn):** metadata sự kiện mới phải ghi issuer/namespace/binding reference đã được Backend xác minh. Audit trung tâm cần projection riêng được xác minh (ví dụ bảng mới `audit_identity_links` với issuer,subject,staff_id,source_instance,interval,batch/evidence hash), không sửa audit_events cũ. Projection chỉ do kênh dịch vụ tin cậy cấp, không nhận mapping từ body browser. Missing/stale/ambiguous projection phải từ chối. Cần test PostgreSQL thật trên instance test độc lập trước triển khai mức này. Chưa tạo bảng này hoặc thay audit service trong lượt hiện tại.

Không mặc nhiên lấy thời điểm migration làm thời điểm Keycloak tạo danh tính mới: tài khoản mới đã tồn tại trước đó. Production plan phải có interval từ nguồn lịch sử; khoảng không chứng minh được giữ unresolved. Fixture dùng mốc 0/100 giả chỉ kiểm tra nguyên tắc khoảng thời gian, không cung cấp interval cho bốn tài khoản thật.

Detection hiện group/count theo raw user_id, nên có thể tách hoạt động cùng người thành hai nhóm sau đổi subject. Không rebuild kết quả, labels, dataset hash hoặc sửa ngưỡng để che khác biệt; hiển thị giới hạn và chỉ thêm correlation đã kiểm thử ở mức audit đầy đủ.

## 7. Plan migration an toàn đề nghị (chưa được phép chạy)

1. **Chứng minh liên tục danh tính:** đúng bốn username trong báo cáo trước; UUID/provider cũ và mới; nguồn LDAP, entryUUID lịch sử/current, role/team/status/MFA. Cần bằng chứng tài khoản cũ thực sự thuộc cùng đối tượng LDAP; không đủ bằng chứng thì BLOCKED. Nếu LDAP đã được tái tạo với entryUUID khác, cần đối soát nghiệp vụ và phê duyệt danh tính thủ công riêng, không hạ điều kiện tự động.
2. **Chuẩn bị source và test:** triển khai resolver vào toàn bộ callsite trên; không chạy trên vận hành trước kiểm thử. Không API runtime cho phép sửa bindings. Có migration runner riêng mặc định dry-run, scope bốn người, hash source/schema/data/seed/plan/bằng chứng, allowlist bảng và số hàng. Prototype hiện tại không phải runner này.
3. **Plan mới:** `.local/ldap-identity-plans/<UTC>-<random>.json` dự kiến chứa mapping, issuer, providers, source proof, interval, expected 9 INSERT, 0 UPDATE/DELETE, hash/số hàng từng bảng, full FK/index/trigger inventory và hash source. Không dùng plan demo/MFA. Không ghi secret vào plan. Chỉ tạo plan thật trong lượt được duyệt.
4. **Maintenance window được duyệt:** kiểm kê Administrator mới process/service/task/Docker mounts/handles SQLite/WAL/SHM/seed; xác minh Backend, timer, request refresh, collector, delivery, governance worker/CLI và writer ngoài ứng dụng đã dừng. Không tự dừng Codex/Docker. `--backend-stopped` không thay bằng chứng. Cần ngăn worker tự khởi động lại.
5. **Preflight ngay trước ghi:** read-only Keycloak/LDAP source, UUID/role/MFA; hashes/plan còn hợp lệ; không recovery marker hoặc pending remote action/directory job/maintenance writing/workflow source_write. integrity/FK PASS; đủ disk/quyền; chưa có bindings trùng/retired conflict. Giữ transaction `BEGIN IMMEDIATE` và kiểm tra lại logical hash sau khóa. Lock SQLite không thay kiểm kê process hoặc bảo vệ staff.json.
6. **Backup trước thay đổi đầu tiên:** `.local/ldap-identity-backups/<UTC>-<random>/`; SQLite backup API từ connection riêng để bao gồm WAL committed, copy nguyên staff.json và plan bằng tạo file độc quyền; manifest đường dẫn/kích thước/SHA-256. Tái sử dụng `write_backup_manifest`/`verify_backup_manifest` hiện đã kiểm thử. Đọc lại manifest, plan, seed, DB logical hash + integrity/FK. Backup/manifest lỗi thì không DDL/INSERT nào. Backup source/config metadata chỉ cần read-only, không dump credential.
7. **Apply một lần:** recovery marker ghi bền trước commit, gắn plan/manifest hash và scope. Một transaction tạo hai bảng/index và 9 hàng; so sánh delta toàn bộ bảng cũ, FK/integrity, hai UUID không đổi trước commit. Không gọi remote sync/logout hoặc ghi staff.json trong migration. Kết quả commit không rõ thì dừng, không retry/apply tự động.
8. **Hậu kiểm độc lập:** từ connection mới so backup: mọi hàng bảng cũ/seed/7 ledger nguyên trạng; đúng 8 binding/1 batch; UUID/role 8 local và disabled không đổi; 4 LDAP resolved đúng, retired bị chặn; FK/integrity PASS; manifest hash đọc lại. Marker chỉ đóng sau xác nhận commit và delta. Không biến pending audit thành delivered.
9. **Nghiệm thu sau phê duyệt khởi động riêng:** bootstrap kiểm tra đọc trước; Backend mới chạy runtime tắt timer LDAP để kiểm tra có kiểm soát, nhưng nhớ refresh request vẫn ghi. Login/TOTP bằng người vận hành; owner/team, notification, grants, sessions, MFA, source-disabled/provider mismatch/outage. Sync thật và các thao tác thay dữ liệu cần quyền riêng. Kiểm thử audit xuyên subject theo mức 6 trước công bố nghiệm thu đầy đủ.

### Rollback

- Lỗi transaction trước commit: rollback cùng connection, giữ backup và dấu vết lỗi. Fixture đã kiểm thử DDL/INSERT rollback toàn phần.
- Commit không rõ: giữ ứng dụng dừng; kiểm tra marker, batch, manifest và database từ connection độc lập để phân biệt chưa commit/đã commit/ngoài phạm vi. Không migration lần hai và không restore tự động.
- Đã commit, chưa có ghi nghiệp vụ mới: sau kiểm kê writer và phê duyệt phục hồi, dùng backup API phục hồi snapshot vào đường dẫn staging, integrity/hash/FK; thay file chỉ khi đóng mọi connection và xử lý WAL/SHM theo quy trình được thử. Giữ bản sau lỗi để điều tra. staff.json không đổi nên không ghi đè mù. Không động Keycloak/LDAP/PostgreSQL.
- Đã phát sinh ghi mới: **không restore toàn snapshot làm mất lịch sử mới**. Cần plan sửa tiến riêng hoặc hủy liên kết có kiểm soát, giữ lịch sử batch/binding và audit. Không chạy restore_week6.py, setup, migration demo/MFA hoặc thao tác reset.
- Chưa chứng minh crash recovery trên tiến trình Windows bị kill/disk full, ACL/handles thật và khôi phục WAL ngoài bộ test. Đây là gate triển khai runner, không được suy từ test rollback thông thường.

## 8. Fixture và kiểm thử đã thực hiện

File mới:

- `tests/ldap-link-fixture.cjs`: schema thật + 4 LDAP giả old/new subject/provider, 8 local active, 13 disabled, 7 ledger cũ và 20 audit outbox giả; có attendance, corrections, notifications/reads, grants, maintenance, actions/attempts, workflow/history, access reviews, alerts/evidence/history.
- `tests/fixtures/ldap_identity_design.py`: prototype **chỉ nhận workspace giả tự tạo**, không CLI/apply thật, không network. Hai bảng mới, resolver đề nghị và rehearsal backup/transaction. Không được import vào Backend production.
- `tests/test_ldap_identity_design.py`: 25 test; dựng schema qua isolation preloader, không nạp .env.

Lệnh chạy thiết kế an toàn: `python -B tests/test_ldap_identity_design.py`.

| Bộ kiểm thử | Kết quả |
|---|---:|
| Thiết kế mới | 25/25 PASS |
| directory-errors.test.js | 8/8 PASS |
| incidents.test.js | 33/33 PASS |
| sso.test.js | 19/19 PASS |
| security.test.js | 52/52 PASS |
| Tổng | **137/137 PASS**, dữ liệu giả |

Kiểm tra được: 4 collision tái hiện; đủ 6 FK; mọi hàng/schema cũ nguyên; 9 INSERT đúng scope; subject cũ/wrong issuer/unknown từ chối; local8/disabled13 không đổi; provider listing và seen/missing theo subject; giữ audit payload/ledger/seed; thiếu proof/entry mismatch/role/provider/MFA/status sai chặn; trùng subject/local/entry/orphan chặn; stale plan/seed/reapply chặn; writer lock chặn trước backup; backup hỏng không ghi; WAL committed có trong backup; manifest tamper bị phát hiện; restore vào DB giả khớp; transaction fault rollback.

**Giới hạn:** prototype resolver không xác minh JWT và không thay authorization middleware. Tests SSO/security chạy source hiện tại, chưa chứng minh tích hợp binding với JWT/MFA/session/API. Tests audit trung tâm ở đây là mocked, chưa kiểm thử projection PostgreSQL hoặc điều tra xuyên subject. Không có bằng chứng live LDAP đã được sửa.

Báo cáo/log: `.runtime/ldap-design-review/20261118T103913Z/`; có `synthetic-plan.json` và `schema-inventory.json` để xem plan mẫu/số hàng/FK từ một fixture đã PASS. Fixture/plan/backup giả từng test: `.runtime/ldap-identity-design/<random>/`. Không phải backup vận hành. Backup tài liệu trước sửa: `.local/source-backups/ldap-design-20261118T103943Z-9d09b76b/`.

**Điểm dừng:** chờ phê duyệt thiết kế bảng liên kết và phạm vi triển khai source; chưa READY FOR APPLY. Gate còn lại: chứng cứ LDAP gốc/interval, tích hợp tất cả callsite, test JWT/MFA/session và sự cố xuyên subject, runner migration/recovery cùng kiểm kê/preflight mới.
