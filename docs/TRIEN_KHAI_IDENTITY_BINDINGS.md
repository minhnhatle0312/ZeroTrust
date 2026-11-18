# Triển khai identity bindings — 18/11/2026

**Mã nguồn và kiểm thử cô lập: PASS. Chưa READY FOR APPLY/triển khai vận hành.**

Người dùng đã duyệt thiết kế bảng liên kết riêng và cho phép sửa source/test, chưa cho migration thật. Lượt này không mở SQLite vận hành, không gọi Keycloak/LDAP thật, không restart Backend, không sync LDAP thật, không chạy setup, commit hoặc push. Hai migration demo/MFA đã hoàn tất không bị chạy lại; các test mang tên migration bên dưới chỉ dùng database giả tự tạo.

## Hành vi đã triển khai

- `backend/identity-bindings.js` cung cấp schema hai bảng `identity_link_batches`, `staff_identity_bindings`, các FK/unique/check và resolver. `installSchema(db)` là hàm tường minh; **không được gọi tự động từ openStore/server/bootstrap**, không tự tạo liên kết, không có API ghi binding hoặc CLI apply trong thay đổi này. DB cũ phục vụ local không cần cài bảng mới. Việc cài schema/ghi binding thật thuộc migration được duyệt riêng.
- Resolver đọc binding theo **issuer + subject**, kiểm tra batch/evidence reference, định dạng SHA-256 plan/manifest, thời gian hiệu lực, provider và xung đột. LDAP thiếu binding, subject retired, provider sai, thiếu bằng chứng hoặc liên kết vào hồ sơ local đều không được dùng để đăng nhập. Không fallback username hoặc ledger demo/MFA.
- `req.staff.id` giữ ID nghiệp vụ; `req.principal` giữ subject/issuer/provider/bindingVersion. JWT vẫn RS256, issuer/audience/azp/iat/exp/sid; role trong token phải khớp hồ sơ và LDAP. Kiểm tra MFA, disabled, governance/maintenance, revoked_before, owner/team/self-approval và quyền Web B vẫn còn. Sau await, binding và containment được đọc lại.
- Facade `localIdentity` nhận ID local từ các API nghiệp vụ, resolve đích trước gọi các phương thức userSecurity/inspectUser/sessions/endSession/resetPassword/recoverMfa/remediate/updateUser/requireDirectoryEnrollment. Với LDAP còn kiểm tra subject/provider/entryUUID hiện tại qua Admin API trước thao tác. Session checker tiếp tục nhận subject gốc của JWT. Cache account/session phân biệt issuer; invalidate đúng remote account.
- Directory apply/refresh/sync nhận remote subject, cập nhật hồ sơ local đã có binding hợp lệ. Không tạo staff hoặc tự gán người mới qua username. Giữ nguyên `staff.id` và cột provider legacy; provider hiện tại lấy từ binding. Scan missing so với remote subject; maintenance, thông báo, sự kiện nghiệp vụ dùng local ID. Federation API trả `currentProvider`, `identityLink` và số hồ sơ chưa có liên kết phù hợp (`unlinked`); không trình bày chúng như đã sync.
- `keycloak-admin.js` chỉ bổ sung đọc `attributes.LDAP_ID[0]` thành `entryUuid`; **không tạo/sửa mapper**. Nếu Admin API thực tế không cung cấp trường đó hoặc nó không khớp binding, luồng bị chặn. Chưa xác nhận trường này trên bốn tài khoản thật trong lượt này.
- Phân biệt nguồn LDAP disabled và Keycloak containment disabled: điều kiện nhóm/source vẫn cần đạt; Keycloak disabled bị checkAccount chặn. Admin có thể mở lại tài khoản qua binding khi nguồn LDAP active, không bị khóa vòng do nhầm hai trạng thái này.
- Governance observed/execute, security reconciliation/retry dùng đúng hai ID; version retry có fingerprint binding. Snapshot mới hiển thị provider hiện tại. Collector chỉ tra tên/ngữ cảnh lịch sử; giữ nguyên `identity_events.user_id`, event IDs và outbox payload. Rà soát last_login của LDAP sử dụng khoảng thời gian binding.
- Bootstrap đọc kiểm tra binding/schema và đưa dữ liệu binding vào signature để phát hiện thay đổi giữa preflight/open. Marker `<attendance.sqlite>.identity-links-pending.json` chặn startup. Không chạy bootstrap trên DB thật để làm bằng chứng trong lượt này.
- Các CLI bảo trì/restore cũ chưa hiểu binding được **chặn trước credential hoặc thao tác ghi** nếu thấy một trong hai bảng mới. Không tự đổi chúng thành công cụ migration.

## Bằng chứng xác minh và giới hạn tin cậy

Resolver kiểm tra dữ liệu đã được migration tin cậy ghi vào SQLite; nó **không tự chứng minh** hai người là một bằng hash hoặc username. Metadata plan/manifest/evidence_ref hợp lệ là điều kiện đọc, không thay việc operator đối soát entryUUID gốc/current, kiểm tra backup bytes và phê duyệt plan. Chưa cung cấp runner ghi bindings production trong thay đổi này. Các test chèn binding/metadata giả trực tiếp chỉ để mô phỏng kết quả migration đã được duyệt.

Không dùng bảng bindings để rewrite audit hoặc nới điều kiện liên kết evidence/action của incidents. Audit trung tâm vẫn dùng raw ID; tương quan và xác minh sự cố xuyên hai subject còn hạng mục projection/provenance riêng như thiết kế. Không tuyên bố đã nghiệm thu tính năng đó.

## File thay đổi trong lượt này

Danh sách được đối chiếu với backup **trước lượt sửa này**, không gộp các thay đổi Git chưa commit của phiên trước.

| File | Nội dung |
|---|---|
| **Mới** `backend/identity-bindings.js` | Schema, validation, resolver, facade local→remote, lookup lịch sử |
| `backend/app.js` | Wiring resolver/facade, principal riêng, recheck sau await, account invalidation, thông tin binding của profile |
| `backend/auth.js` | Verifier cung cấp trusted issuer; cache account/session theo issuer; clear/invalidate |
| `backend/bootstrap.js` | Read-only validation/signature/marker của binding |
| `backend/server.js` | Truyền issuer public vào ứng dụng; giữ issuer nội bộ cho transport |
| `backend/directory.js` | Lookup/sync/maintenance/missing/provider listing theo binding; chặn auto import không bằng chứng |
| `backend/keycloak-admin.js` | Projection entryUuid chỉ đọc |
| `backend/operations.js` | Collector binding context, guard collision khi tạo local, containment đúng tài khoản vừa tạo |
| `backend/week5.js` | Fingerprint binding trong reconciliation version; remote call được facade bảo vệ |
| `backend/governance.js` | So sánh nguồn/target đúng namespace, provider snapshot, bảo vệ join local, last_login |
| `backend/identity-events.js` | Lookup tên theo binding/time, không thay user_id nguồn |
| **Mới** `scripts/identity_binding_guard.py` | Guard chỉ đọc chặn legacy writer |
| `scripts/directory_user.py` | Guard đầu maintain |
| `scripts/process_governance.py` | Guard đầu main |
| `scripts/restore_week5.py` | Guard đầu restore |
| `scripts/restore_week6.py` | Guard đầu restore |
| **Mới** `backend/identity-bindings.test.js` | 15 unit tests |
| **Mới** `backend/identity-bindings.integration.test.js` | 24 integration tests HTTP + JWT RS256 thật, IAM giả |
| **Mới** `tests/fixtures/identity-binding-fixture.cjs` | 4 LDAP liên kết +8 local active +13 disabled, schema/bằng chứng giả |
| **Mới** `tests/test_identity_binding_guard.py` | 4 test guard legacy tool |
| `backend/bootstrap.test.js` | Thêm 3 test marker/schema/signature |
| `backend/directory-errors.test.js` | Fixture liên kết rõ ràng; giữ redaction/rollback; thêm chặn người mới chưa xác minh; test projection LDAP_ID |
| `backend/week5-10.test.js` | Test group conflict dùng binding giả đã duyệt |
| `backend/security.test.js` | Truyền trusted issuer của verifier riêng vào createApp |
| `backend/incidents.test.js` | Truyền trusted issuer của verifier riêng vào createApp |
| `tests/fixtures/workspace-backend.cjs` | Issuer rõ ràng cho fixture browser mock hiện có |
| **Mới** `docs/TRIEN_KHAI_IDENTITY_BINDINGS.md` | Báo cáo này |
| `docs/THIET_KE_LIEN_KET_DANH_TINH_LDAP.md` | Ghi trạng thái triển khai mới, giữ thiết kế/lịch sử |
| `docs/PROJECT_CONTEXT.md` | Ngữ cảnh tiếp tục phiên sau |

`store.js`, `incidents.js`, các file audit PostgreSQL, `.env`, staff.json và các script reconcile demo/MFA **không sửa trong lượt này**. Schema đặt trong module riêng để tránh tự migration khi mở DB. Không sửa UI production; fixture browser được cập nhật hợp đồng issuer nhưng chưa chạy browser acceptance.

## Backup mã nguồn

Đường dẫn: `.local/source-backups/identity-bindings-20261118T105244Z-37a1fb8e/`.

`manifest.json` ghi đường dẫn nguồn/backup, kích thước và SHA-256 của **37 file**; đã đọc lại xác minh hash trước sửa và khi tổng kết. Giữ mọi backup trước đó. Đây là backup source, không phải backup dữ liệu vận hành. Các file mới không ghi đè file cũ.

## Kết quả kiểm thử

**343/343 PASS, 0 suite lỗi**; chỉ SQLite mới/in-memory, service giả, cổng loopback ngẫu nhiên. Node chạy qua `tests/isolated-node.cjs`; không nạp `.env` vận hành. JWT ở integration dùng chữ ký RS256 và verifier thật; Keycloak Admin API/MFA/session là giả lập. Không đồng nghĩa đã kiểm thử OIDC browser hoặc TOTP thật.

| Bộ | PASS |
|---|---:|
| identity-bindings unit | 15 |
| identity-bindings integration | 24 |
| bootstrap | 23 |
| directory-errors | 9 |
| directory-schedule | 3 |
| audit | 2 |
| incidents | 33 |
| operations | 24 |
| phase2 | 14 |
| retention | 6 |
| security | 52 |
| sso | 19 |
| week5-10 | 33 |
| Guard legacy writer (Python) | 4 |
| Thiết kế/backup/rollback LDAP giả (Python) | 25 |
| Reconcile demo — database giả (Python) | 33 |
| Reconcile MFA — database giả (Python) | 24 |

Các trường hợp quan trọng đã đạt:

- Cả bốn LDAP đăng nhập qua JWT subject mới, nhận profile local ID cũ và đúng role; tám local vẫn hoạt động; 13 disabled không thay đổi, không truy cập được.
- Retired/unbound/unknown/wrong issuer/audience/role, group conflict, source disabled, Keycloak disabled, MFA pending, phiên kết thúc, outage, maintenance hold và thay binding giữa await đều bị chặn phù hợp.
- API quản trị sessions/revoke/security/MFA/actions/reconciliation/retry và governance observed/execute dùng remote subject đúng; action target, notification, chấm công/đơn dùng local ID.
- Owner/team/self-approval được kiểm tra trên các hồ sơ linked, không chỉ local fixture cũ.
- Sync giả đủ bốn hồ sơ, imported0/errors0/blocked0, không bị coi missing. Fixture có sẵn 6 loại quan hệ FK tới staff, 7 ledger cũ, audit outbox, alert/evidence/history và thông báo; các hàng đó giữ nguyên, FK PASS. Không dùng snapshot rỗng làm bằng chứng giữ lịch sử.
- Backup design rehearsal chứa WAL committed; manifest tamper/corrupt bị chặn; rollback transaction và restore vào DB giả đạt. Những test này không phải runner migration production mới.
- Guard của bốn CLI legacy được kiểm thử trước thao tác credential/ghi. Cú pháp JS/Python và `git diff --check` PASS.

Log/kết quả: `.runtime/identity-binding-implementation/20261118T110854Z/result.json`, các file `*.log`, `syntax.json`, `change-manifest.json`. Hai suite directory-errors/integration được chạy lại sau khi bổ sung assertion dữ liệu lịch sử và LDAP_ID; kết quả vẫn PASS. Các lần đầu có lỗi fixture kỳ vọng auto-import cũ hoặc thiếu trusted issuer đã được sửa rõ theo hợp đồng mới; không bỏ test hoặc nới kiểm tra bảo mật để đạt.

## Rủi ro còn lại và điều kiện trước triển khai

1. **Chưa có bằng chứng thật entryUUID lịch sử/current và interval của bốn tài khoản.** Phải kiểm tra chỉ đọc được duyệt; nếu `LDAP_ID` không có/không khớp thì tiếp tục BLOCKED, không tự sửa mapper/LDAP.
2. **Chưa có migration runner production.** Cần plan mới scope4, xác minh proof và backup manifest trước ghi, marker/crash recovery, hậu kiểm delta9INSERT/0UPDATE bảng cũ, rehearsal riêng. Không chạy module schema hoặc prototype trực tiếp trên attendance.sqlite thật.
3. **LDAP chưa liên kết sẽ bị từ chối**, kể cả hồ sơ từng dùng UUID bằng Keycloak ID hoặc onboarding mới. Đây là mặc định fail-closed, cần operator phê duyệt liên kết riêng; không đưa source này vào vận hành với kỳ vọng auto-provision cũ còn hoạt động.
4. **Bảo trì LDAP qua CLI và restore tuần 5/6 bị chặn khi có schema mới.** Cần công cụ hỗ trợ binding hoặc quy trình thay thế được kiểm thử trước sử dụng. Không bỏ guard để xử lý nhanh. Workflow source-write chưa có receipt vẫn giữ chặn như trước.
5. **Điều tra/detection xuyên subject và PostgreSQL projection chưa triển khai.** Raw evidence/audit còn nguyên; không nới so sánh hoặc tuyên bố sự cố đã xác minh. SSO browser, TOTP thật, live LDAP và health sau restart chưa được nghiệm thu.
6. **Migration/restart thật chưa được phép.** Khi được duyệt cần kiểm kê writer/process/service/task/mount/handles mới, khóa ghi, plan không stale, integrity/FK, disk/quyền, backup/manifest, rồi hậu kiểm độc lập. Giữ nguyên hai migration cũ và mọi backup; không reset hoặc tự rollback.

Điểm dừng: source đã triển khai và kiểm thử cô lập đầy đủ cho phạm vi trên; chờ quyết định bước tiếp theo. Không có lệnh apply thật được đề nghị chạy trong báo cáo này.
