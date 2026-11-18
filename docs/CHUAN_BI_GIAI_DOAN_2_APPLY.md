# Giai đoạn 2 — migration demo và MFA SUCCESS; bootstrap PASS, chưa khởi động server

## Kết quả mới nhất 12/11/2026, 20:02 — hai MFA đã SUCCESS, không chạy lại migration

Đã thực hiện đúng quyền được cấp cho `mfa-employee` và `mfa-auditor`, **apply đúng một lần**, exit0 lúc 20:00:20. **Hậu kiểm độc lập PASS lúc 20:01:38; bootstrap thật với `node backend/server.js --check-bootstrap` PASS lúc 20:02:07.** Không khởi động Backend/Web, không chạy setup_week5, không chạy lại migration năm demo, không rollback/reset hoặc thay LDAP/Keycloak/MFA.

Inventory Administrator mới `.runtime/writer-inventory/20261112T125703Z-e3a4967a.json` checkedAt 19:56:56: administrator=true, 310 process/323 service/299 task, các query OK; RM 0/0/0 đủ SQLite/WAL/SHM/seed, 0 file user. Các process chung giữ nguyên metadata; launcher49252 parent console48700 đã kết thúc. Service/task/mounts giữ nguyên; không mount dữ liệu Backend. Get-Process ngay trước apply không có Python/Node Backend, chỉ Codex và console đã xác định. Preflight live **19:58:57 PASS**: toàn plan/UUID/role/MFA/DB/seed/ledger/audit khớp, integrity/FK/no marker đạt, backup probe và dung lượng đạt, source hashes bằng bản24/24 đã thử. Script kiểm tra lại live plan dưới transaction trước backup/UPDATE.

**Thay đổi thật:** UPDATE đúng 2 hàng staff.id, INSERT đúng 2 ledger; staff vẫn 25 hàng, ledger từ 5 thành 7. So độc lập từng bảng với backup: schema giữ nguyên; chỉ hai ID staff đổi; năm ledger cũ nguyên trạng; mọi bảng khác và staff.json nguyên trạng. Đủ 20 audit_outbox liên quan (12 delivered/8 pending), payload/trạng thái/lịch sử không đổi. Không mất chấm công/đơn điều chỉnh/thông báo/history, không đổi admin01/sáu demo/LDAP/13 disabled. Cả **8 local active khớp Keycloak** gồm sáu demo và hai MFA; MFA guards không đổi, remainingMfaChanges=0, SQLite integrity/FK PASS, không recovery marker.

### Backup MFA thật đã tạo và xác minh trước UPDATE

Thư mục: `.local/mfa-staff-id-backups/20261112T130017Z-mfa-5101bc0d/`. Dùng SQLite backup API nhất quán dưới BEGIN IMMEDIATE, manifest exclusive/fsync, đọc lại file/size/hash/plan/seed/integrity/FK/logical DB trước ghi; hậu kiểm xác minh lại cùng manifest.

| File | Kích thước byte | SHA-256 |
|---|---:|---|
| attendance.sqlite | 3489792 | `59d0145f27bbfcc7195c4fef47fe60b3fd507a1480c3c92548badb76ad3896ec` |
| staff.json | 996 | `da2c4df6dae31e48663cca7d1a80de8bdfda0dd8fff204730d9ee576e9933ffa` |
| plan.json | 4735 | `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd` |

Manifest: [manifest.json](../.local/mfa-staff-id-backups/20261112T130017Z-mfa-5101bc0d/manifest.json), SHA-256 **`3b13a1590092dc379c306f8c6683f00fa82075d51412095dcf1e4f056570d3e1`**. Backup năm demo và tất cả backup trước giữ nguyên. Không cần rollback; nếu tương lai phải phục hồi, giữ writer dừng, đánh giá dữ liệu phát sinh và xác minh backup/manifest trước phương án được duyệt, không tự restore hoặc reapply.

### Hậu kiểm và bước tiếp theo

Artifacts: [result.json](../.runtime/mfa-migration-runs/20261112T125808Z/result.json); cùng thư mục có preflight.json, apply-intent.json, apply-result.json, apply.log, postcheck-local.json, postcheck.json, bootstrap.json và bootstrap.log. DB logical hash sau migration `610a2706635213248304cad9bb31a821cc2d31705533210f78ceeb64564f41a0`. Bootstrap check-only dùng service identity thật của Backend và live Keycloak; sau kiểm tra, DB/seed hash vẫn nguyên, integrity/FK PASS, cổng3001/5173/5174 đóng cả IPv4/IPv6. Không gọi openVerifiedStore/start server/worker.

24/24 test cô lập đã PASS lúc19:32; source hashes kiểm tra lại không đổi, không chạy lại test sau mutation vì phạm vi sau migration chỉ yêu cầu bootstrap không server. Chưa nghiệm thu OTP/SSO/Web A/B/LDAP thật, chưa health/API live. Bước tiếp theo cần chỉ thị khởi động stack ứng dụng và nghiệm thu; không dùng lệnh apply bên dưới nữa. Các trạng thái READY/BLOCKED/chờ quyền và hướng dẫn apply phía dưới là **lịch sử**.

**Trạng thái mới nhất 12/11, 19:50: ĐÃ ĐƯỢC PHÉP APPLY HAI MFA, nhưng preflight BLOCKED; chưa ghi dữ liệu.** Người dùng đã cấp quyền đúng mfa-employee/mfa-auditor theo plan hiện có, kèm backup/hậu kiểm; không xin lại quyền này khi có bằng chứng kiểm kê mới. Báo cáo Administrator 19:29 cách lượt preflight mới khoảng 21 phút, không đủ để chứng minh liên tục trạng thái service/task/mounts/handles. Get-Process hiện chỉ thấy Codex và các console đã xác định, nhưng inventory mới `.runtime/writer-inventory/20261112T125035Z-db22ba51.json` checkedAt 19:50:30 có RM start29, CIM PermissionDenied, Docker query thất bại. Cổng đóng không thay kiểm kê writer đầy đủ. Đã dừng trước backup/apply; chưa gọi lại IAM/SQLite hoặc bootstrap sau gate thất bại. Hash plan và mã nguồn/test vẫn bằng bản đã kiểm thử.

Cần người vận hành chạy lại `python -B scripts/inspect_sqlite_writers.py` trong PowerShell Administrator (kiểm tra Python administrator=True như lần đã thành công), gửi Report và giữ cửa sổ bảo trì. Sau đó tiếp tục trong quyền đã cấp: rà soát inventory mới, live plan/IAM/SQLite/integrity/FK/marker, backup mới verify trước UPDATE, apply đúng hai MFA, hậu kiểm độc lập và bootstrap không start server. Không reapply năm demo, không thay LDAP/MFA/audit, không dừng Codex/Docker. READY 19:33 bên dưới là kết quả tại thời điểm đó, không được dùng thay preflight hiện tại.

**Trạng thái mới nhất 12/11, 19:33: READY FOR APPLY cho đúng hai MFA; CHƯA APPLY, chờ xác nhận cuối.** Báo cáo Administrator `.runtime/writer-inventory/20261112T122906Z-14aac35f.json` checkedAt 19:29:00: administrator=true, mọi query OK, 317 process/323 service/299 task; đủ SQLite/WAL/SHM/staff.json, RM 0/0/0, 0 file user. Các ứng viên service/task/mounts không đổi; Node70024 xác minh Codex; launcher42012 thuộc console Administrator48700 đã kết thúc. Kiểm tra tiến trình sau test không còn Python/Node Backend. Điểm chặn thiếu quyền ở các báo cáo trước đã được giải quyết.

Live plan/Keycloak **19:31:57 PASS**: đúng hai MFA và toàn plan vẫn khớp, sáu demo giữ nguyên, MFA/role/status đúng, 20 outbox nguyên trạng. SQLite/seed/hash/integrity/FK/no marker kiểm tra lại sau test **19:32:18 PASS**. **24/24 test cô lập chạy mới PASS**; tám diễn tập bản sao trước đó vẫn là bằng chứng lịch sử, không chạy lại. Backup demo/manifest xác minh PASS; probe ghi/fsync/rename/đọc/dọn backup root MFA PASS, còn 59.090.096.128 byte. Chưa tạo backup migration MFA thật; khi được phép apply, backup mới bắt buộc được xác minh trước UPDATE đầu tiên.

Kết luận và hash mã được kiểm thử: `.runtime/mfa-readiness/20261112T123109Z/readiness.json`; preflight và mfa-tests.log cùng thư mục. Plan vẫn `.local/mfa-staff-id-plans/mfa-20261112T120146Z.json`, SHA-256 `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd`. Phạm vi 2 UPDATE staff.id + 2 INSERT ledger, không ghi seed/audit/LDAP/MFA. Giữ writer dừng trong cửa sổ bảo trì; sau xác nhận cuối revalidate trước apply, kiểm kê lại phần có thay đổi nếu môi trường đổi. Không dùng READY làm quyền tự apply, không chạy lại migration năm demo. Các trạng thái BLOCKED bên dưới là lịch sử.

**Trạng thái mới nhất 12/11, 19:19: BLOCKED — chưa đủ bằng chứng kiểm kê MFA.** Report `.runtime/writer-inventory/20261112T121836Z-f0c4ef74.json` đọc được đủ bốn file, RM codes 0/0/0 và không file user; services/tasks ứng viên/Docker mounts không đổi. Tuy nhiên report ghi `administrator=false`, chỉ liệt kê 226 task so với 299 ở report elevated trước, thiếu metadata của một số process. Không thể coi `queryComplete=true` là kiểm kê đầy đủ. PID70024 vẫn cùng danh tính Codex đã xác minh; launcher15188 đã kết thúc, không cần dừng hai tiến trình này. Local plan/DB/seed/integrity/FK/no marker/backup cũ kiểm tra lại 19:19 PASS. Chưa recheck Keycloak/probe backup mới vì gate inventory chưa PASS. Báo cáo `.runtime/mfa-readiness/20261112T121947Z/inventory-review.json`.

Trong PowerShell mở bằng **Run as administrator**, xác minh quyền ở cả shell lẫn tiến trình Python trước khi chạy lại:

```powershell
Set-Location D:\ZeroTrust
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'PowerShell chua co quyen Administrator' }
python -B -c "import ctypes,sys; elevated=bool(ctypes.windll.shell32.IsUserAnAdmin()); print('Python administrator:', elevated); sys.exit(0 if elevated else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Python chua co quyen Administrator; khong tiep tuc' }
python -B scripts/inspect_sqlite_writers.py
```

Gửi đường dẫn Report mới. Nếu Python vẫn False dù shell đã đạt, dừng và báo hai kết quả; chưa xác định nguyên nhân launcher/token, không tự bỏ guard. **Chưa apply MFA; chỉ READY sau khi kiểm kê và preflight mới đều đạt, rồi chờ xác nhận cuối.** Các trạng thái bên dưới là lịch sử.

**Cập nhật mới nhất 12/11, 19:13 — chỉ chuẩn bị MFA:** plan riêng đúng `mfa-employee`, `mfa-auditor` đã tạo tại `.local/mfa-staff-id-plans/mfa-20261112T120146Z.json`. Script mới `scripts/reconcile_mfa_ids.py`, dự kiến UPDATE 2 staff và INSERT 2 ledger, không ghi seed/audit. 24 kiểm thử riêng biệt và 8/8 diễn tập bản sao PASS; bootstrap trên bản sao với IAM giả lập PASS tám local active. Đối chiếu live cuối PASS, backup demo cũ nguyên trạng. **Chưa apply MFA, chưa được phép apply thật; Backend thật vẫn BLOCKED.** Inventory sandbox mới không đọc được writer/handles do quyền, cần báo cáo Administrator mới trước lần apply được xác nhận riêng. Không dùng lại quyền/plan năm demo. Xem [kế hoạch đồng bộ MFA](KE_HOACH_DONG_BO_ID_MFA.md) để biết mapping, bằng chứng, backup/rollback và các điều kiện bắt buộc. Các kết luận bên dưới là lịch sử.

**Cập nhật chỉ đọc 12/11, 18:46:** đã đối chiếu toàn bộ 25 staff: cả `mfa-employee` **và `mfa-auditor`** lệch UUID và chặn bootstrap; 4 LDAP khác cũng lệch ID/role/status, 13 hồ sơ disabled không còn remote. Sáu demo đã migration vẫn khớp. Xem [đối soát MFA chỉ đọc](DOI_SOAT_TAI_KHOAN_MFA_CHI_DOC.md) để biết mapping, nguồn setup/audit, phạm vi 2 staff + 2 ledger đề xuất và 20 outbox phải giữ nguyên. Chưa sửa thêm, không chạy lại migration; chờ duyệt phạm vi mới.

## Kết quả hiện hành 12/11/2026, 18:37 — đã đồng bộ, không chạy lại apply

**Migration năm tài khoản được duyệt đã SUCCESS, hậu kiểm dữ liệu PASS.** Khởi động Backend đang **BLOCKED** bởi hồ sơ `mfa-employee` ngoài phạm vi migration. Không được hiểu lỗi bootstrap này là migration thất bại hoặc cần chạy lại/rollback.

### Bằng chứng trước ghi

Người dùng đã cung cấp inventory Administrator mới `.runtime/writer-inventory/20261112T112755Z-16ea9e36.json` và yêu cầu tiếp tục bổ sung manifest, kiểm thử rồi apply nếu đủ điều kiện. Đã đọc toàn bộ, đối chiếu bản 18:10: các process chung giữ nguyên PID/StartTime/entrypoint; services/tasks/mounts không đổi, các danh tính McAfee/PowerShell/Hotpatch/WSL đã được xác minh trước vẫn phù hợp. Restart Manager Start/Register/List mã 0, đủ DB/WAL/SHM/seed, **0 process dùng file lúc 18:27:47**. Python Manager launcher tạm 58696 (parent 51912) đã kết thúc; Get-Process trước migration chỉ thấy các console đã xác minh và Node Codex 70024, không Node Backend/Python worker. Không thay bằng kết quả query thất bại trong sandbox hoặc tuyên bố tự truy vấn được handles.

Preflight live mới lúc **18:32:53**: toàn bộ plan vẫn bằng phase1-20261112T062520Z.json, SHA đúng, đường dẫn/env guard đạt; admin01 khớp và đúng năm mapping, integrity/FK PASS, không marker, 41 hàng dự kiến. Probe ghi/fsync/atomic rename/đọc trong thư mục tổng hợp riêng dưới backup root PASS, đã dọn; còn 59.173.855.232 byte. Cổng Backend kiểm tra lại cả IPv4/IPv6. DB/seed/plan không đổi đến cuối preflight. Artifact `.runtime/migration-runs/20261112T113210Z/preflight.json` ghi rõ nguồn và thời điểm kiểm kê Administrator. Cơ chế apply kiểm tra lại live plan, giữ `BEGIN IMMEDIATE` trong suốt backup/verification/mutation, đối chiếu seed và kiểm tra cổng trước commit.

### Manifest đã bổ sung và kiểm thử

`scripts/reconcile_staff_ids.py` bổ sung `backup_file_entry`, `write_backup_manifest`, `verify_backup_manifest` vào **cơ chế SQLite backup API hiện có**, không thay bằng copy file. Sau backup SQLite/seed/plan và trước CREATE ledger/UPDATE đầu tiên, tạo manifest exclusive + fsync rồi đọc lại: đúng tập file, đường dẫn cố định, kích thước, SHA-256 byte; từ chối file thiếu/redirect, đọc lại plan/seed/SQLite so trạng thái được duyệt, integrity/FK và logical DB hash. Manifest hỏng/thiếu/ghi lỗi làm dừng trước SQL nghiệp vụ. CLI in đường dẫn manifest và SHA-256 manifest sau thành công; không in secret.

**33/33 test reconciliation PASS**, gồm 25 test cũ và 8 test manifest mới. Test mới chứng minh: metadata/hash đúng và không ghi đè manifest; lỗi ghi/thiếu/truncated manifest chặn trước bất kỳ SQL nghiệp vụ; sai path/size/hash; cả ba backup bị sửa; manifest tự nhất quán nhưng DB snapshot sai vẫn bị chặn; SQLite backup chứa các thay đổi đã commit trong WAL. Kiểm thử dùng fixture dưới `.runtime/staff-id-tests`, không dùng DB thật làm fixture. Các test rollback/recovery và sáu tài khoản qua JWT Backend fixture vẫn PASS.

### Migration và backup thật

Đã chạy **đúng một lần** lệnh được phép với plan đã duyệt. Exit 0; `Verification passed; admin01 and historical events preserved.` Backup được tạo và xác minh trước thay đổi nghiệp vụ đầu tiên:

```text
D:\ZeroTrust\.local\staff-id-backups\20261112T113356Z-be31a903\
```

| File | Byte | SHA-256 |
|---|---:|---|
| attendance.sqlite | 3.473.408 | `8278409b4a1ac585286e81f50d99d1d6b21971bce9e339682ed68a4638cc52ce` |
| staff.json | 996 | `df080c608e9218cdbb384eaa168a551513db8763e4a602e1759cb7f4101ea8a0` |
| plan.json | 7.461 | `e7cea8a0a2b187aab66efdb51b54b781bb0cc8a49512d3d4afa352f27d84fce4` |

Manifest: `manifest.json` trong cùng thư mục, SHA-256 **`f4336b9eeb7b9dea1e356f3a0f4e7bb937eca04a1d06ba7d1f28ddb9343e1774`**. Đã xác minh lại backup/manifest độc lập sau apply và cuối lượt; không ghi đè/xóa backup cũ. Không lưu password/token/secret vào báo cáo.

### Hậu kiểm độc lập — PASS lúc 18:35:09

- Đọc SQLite backup và DB hiện tại bằng mode=ro; so mọi hàng với phép đổi ID cho phép, không chỉ so số lượng. Đúng **41 hàng nghiệp vụ**: staff 5, attendance 10, corrections 10, notifications 16; các bảng còn lại không có hàng đổi ngoài kế hoạch.
- Tất cả bảng cũ giữ nguyên số hàng; thêm đúng **5 ledger mapping** old/new/username/role/batch. Các FK đạt, không orphan; integrity PASS. 25 staff vẫn là 25, không thêm/xóa/trùng danh tính.
- Seed chỉ đổi đúng 5 ID, byte còn lại giữ nguyên. **admin01 nguyên trạng toàn hồ sơ**. Mọi bảng history/audit giữ nguyên nội dung (events 2.802, identity_events 254, audit_outbox 3.423; các bảng lịch sử khác cũng được so toàn bộ).
- Đọc lại Keycloak qua cùng quy tắc uniqueness/role/local/enabled/ID: **cả sáu tài khoản khớp, remainingChanges=0**. Không thay users/roles/password/MFA/JWT/LDAP hoặc cấu hình Keycloak.
- Không recovery marker, không phát hiện ghi đồng thời trong hậu kiểm, Git index nguyên trạng. Hash DB/seed vẫn nguyên sau bootstrap/test ở lần xác minh cuối 18:37.

Artifact `.runtime/migration-runs/20261112T113210Z/postcheck.json`. Script hậu kiểm chỉ đọc tại cùng thư mục; không có apply/recover. Kết quả tổng hợp: `.runtime/migration-runs/20261112T113210Z/result.json`.

### Kiểm thử sau migration và điểm chặn còn lại

**Backend isolated tests PASS 203/203**, 9 file `backend/*.test.js`, dùng `tests/isolated-node.cjs`, environment đã lọc và fixture riêng; không seed/reset DB thật. Log `.runtime/migration-runs/20261112T113210Z/backend-tests.log`, thống kê `backend-tests.json`.

`node backend/server.js --check-bootstrap` chạy chỉ đọc, **BLOCKED: BOOTSTRAP_KEYCLOAK_ID_MISMATCH**, không mở listener/migration/collector. Chẩn đoán chỉ đọc bằng chính service client Backend xác định **hồ sơ không khớp đầu tiên là `mfa-employee`**: cùng username trong Keycloak, remote tồn tại/local source, nhưng ID khác. Trong 8 hồ sơ local active, đã kiểm tra đến hồ sơ thứ 4 khi gặp lỗi đầu tiên; không khẳng định đã rà soát hết hồ sơ ngoài demo. `mfa-employee` **giống nguyên trạng trong backup trước migration**, không bị phép đổi năm tài khoản tác động. Đây là vấn đề ngoài phạm vi được phép sửa.

Giữ Backend/Web dừng; **không sửa `mfa-employee`, không chạy migration lần hai, không tự rollback, không bỏ bootstrap/JWT/RBAC/MFA**. Health/API live và login Web A/B/MFA/LDAP **NOT RUN** do bootstrap chặn. Artifacts `bootstrap.json`, `bootstrap-diagnosis.json`. Các test JWT/RBAC/MFA/LDAP cô lập không thay nghiệm thu thật.

### Tiếp theo và phục hồi

1. Rà soát riêng ID/nguồn/role/các quan hệ của hồ sơ ngoài demo, bắt đầu từ `mfa-employee`; cần phê duyệt phạm vi mới trước khi sửa dữ liệu tài khoản này. Không dùng plan năm tài khoản cũ để sửa thêm; **không chạy lại apply đã hoàn thành**.
2. Sau khi vấn đề ngoài phạm vi được xử lý theo kế hoạch riêng và bootstrap đạt, mới khởi động Backend/health, API live và chuẩn bị đăng nhập sáu demo Web A/B. MFA/LDAP cần thao tác người vận hành khi yêu cầu mật khẩu/OTP; không xuất credential vào log.
3. **Không cần rollback migration hiện tại:** dữ liệu đã PASS; lỗi bootstrap là hồ sơ khác giữ nguyên từ trước. Giữ backup/manifest. Nếu có yêu cầu phục hồi sau này, dừng/xác minh mọi writer, đối chiếu DB/seed hiện tại với trạng thái hậu kiểm và backup, đánh giá giao dịch phát sinh rồi mới phê duyệt phương án phục hồi nhất quán. Không ghi đè DB hoặc xóa WAL/SHM tùy ý. `--recover` dành cho marker gián đoạn; hiện không có marker nên không dùng nó để chữa lỗi bootstrap. Không tự rollback sau commit.

Không stop/start Codex/Docker/Backend, không reset database/volumes/LDAP, không sửa dữ liệu ngoài plan, không commit/push/deploy. Những phần BLOCKED/READY/chờ quyền bên dưới là lịch sử trước migration.

## Lịch sử 12/11/2026, 18:25 — BLOCKED, NOT EXECUTED

**Người vận hành đã cho phép migration thật đúng 5 tài khoản theo plan**, kèm backup và hậu kiểm. Quyền này đã được ghi nhận, không cần xin lại cùng quyền. Tuy nhiên, chỉ thị mới bắt buộc kiểm tra hiện tại và dừng nếu sandbox không xác minh được bất kỳ điều kiện bắt buộc nào; không dùng READY 18:14 hay inventory cũ thay kiểm tra hiện tại. Do đó trạng thái READY bên dưới nay là lịch sử.

Đã đọc lại AGENTS, context, tài liệu này, toàn bộ script reconciliation, plan được chỉ định, báo cáo Administrator 18:10 và readiness 18:14. Không đổi plan hoặc code migration.

### Preflight dữ liệu mới lúc 18:24:59 — PASS

- Đọc lại Keycloak qua API chỉ đọc và dựng toàn bộ plan trong bộ nhớ: đúng file phase1-20261112T062520Z.json; admin01 khớp, chỉ employee01/employee02/manager01/manager02/auditor01 cần đổi ID, username/role/local/ID collision checks đạt.
- SHA-256 plan nguyên giá trị đã duyệt; hash nội dung SQLite và byte seed khớp plan; đường dẫn đúng, không environment override.
- SQLite integrity_check/foreign_key_check PASS, kiểm tra 11 FK, không recovery marker. Không có blocker workflow/directory sync hoặc ledger xung đột theo inventory nghiệp vụ của script.
- Dự kiến vẫn 41 hàng: staff 5, attendance 10, corrections 10, notifications 16. Đã ghi số hàng mọi bảng trước migration để hậu kiểm; chưa thay bất kỳ hàng nào.
- Nội dung DB/seed/plan không đổi đầu/cuối lượt. Dung lượng còn 59.192.569.856 byte; **chưa chạy lại probe quyền ghi hoặc tạo backup nghiệp vụ** do đã dừng ở điều kiện writer. Probe/test 18:07 là lịch sử, không báo thành kiểm tra mới.

Artifact `.runtime/apply-readiness/authorized-20261112T112417Z/preflight.json`.

### Hai điều kiện chưa đạt

1. **Writer/handles hiện tại chưa xác minh được.** Lần chạy inventory mới lúc 18:25:17 trả `BLOCKED_INVENTORY`: CIM process/service và Scheduled Task PermissionDenied; Restart Manager start mã 29, không truy vấn được file users; Docker query thất bại. Cổng 3001/5173/5174 đóng không thay thế kiểm kê writer. Artifact `.runtime/writer-inventory/20261112T112522Z-f6e5f012.json`. Không lấy mảng processes rỗng của truy vấn lỗi làm bằng chứng không có handle, không dùng báo cáo Administrator 18:10 thay điều kiện hiện tại.
2. **Yêu cầu manifest mới chưa có trong script.** Source hiện tại dùng SQLite backup API dưới transaction khóa writer, kiểm tra integrity/FK và logical content hash trước UPDATE; seed backup exclusive-create/readback và plan backup đã có. Nhưng chưa tạo manifest gồm đường dẫn/dung lượng/SHA-256 byte của từng file backup, cũng chưa có gate đọc lại manifest trước thay đổi đầu tiên. `databaseHash` trong plan là hash nội dung logic, không thay SHA-256 file SQLite backup. Không được coi cơ chế cũ đã đáp ứng toàn bộ yêu cầu mới. Cần bổ sung manifest vào chính chuỗi backup hiện tại và kiểm thử lỗi/corruption/ghi manifest thất bại chặn mutation trước khi apply; không viết cơ chế backup thay thế. Chưa sửa code trong lượt này vì chỉ thị yêu cầu dừng khi điều kiện bắt buộc chưa đạt.

### Việc người vận hành cần làm

Trong **PowerShell Administrator** tại máy dự án, chạy chỉ đọc:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/inspect_sqlite_writers.py
```

Gửi đường dẫn Report mới; giữ Backend/Web/worker không khởi động trong cửa sổ bảo trì, không dừng Codex/Docker. Nếu vẫn không truy vấn được file users, kiểm tra bằng Resource Monitor theo hướng dẫn bên dưới và báo lỗi cụ thể. Không chạy lệnh apply cho đến khi writer hiện tại, manifest đã kiểm thử và các kiểm tra còn lại đều đạt. Không cần cấp lại quyền migration đã cấp; cần bằng chứng và điều kiện kỹ thuật đủ.

### Trạng thái thực tế và phục hồi

| Mục | Trạng thái |
|---|---|
| Preflight tổng thể | **BLOCKED** |
| Dữ liệu/Keycloak/plan preflight | **PASS** mới lúc 18:24:59 |
| Backup nghiệp vụ/manifest | **NOT RUN**, chưa có backup path/hash mới |
| Migration | **NOT EXECUTED**, 0 tài khoản, 0 hàng cập nhật |
| SQLite integrity/FK | **PASS trước migration** |
| Lịch sử/audit | Nội dung toàn DB giữ nguyên; **chưa có hậu kiểm migration** |
| Backend tests/bootstrap/health/API | **NOT RUN**, chưa qua migration/hậu kiểm |
| Web A/B, MFA, LDAP | Chưa nghiệm thu |

Không cần rollback vì chưa sửa dữ liệu thật. Cơ chế hiện có: lỗi trước commit rollback transaction và phục hồi seed; marker gián đoạn cho phép xác định DB trước/sau rồi xử lý seed bằng recover, không restore DB tùy ý. Nếu phát sinh lỗi sau commit trong lần migration tương lai, giữ backup/marker, không restart Backend hoặc chạy migration lần hai, phân tích điều kiện phục hồi trước thao tác. Không tự rollback hậu commit.

Chỉ cập nhật tài liệu/artifact chẩn đoán. Không backup nghiệp vụ mới, không apply, không sửa SQLite/seed/Keycloak/LDAP, không stop/start process/container, không commit/push/deploy.

## Lịch sử 12/11/2026, 18:14 — READY FOR APPLY

**Đã đủ bằng chứng chuẩn bị; không còn điểm chặn đã biết. Chưa được phép chạy apply.** Kết luận này thay các trạng thái BLOCKED lịch sử bên dưới, dựa trên inventory Administrator lúc 18:10, xác nhận người vận hành, đối chiếu live Keycloak/backup lúc 18:07 và kiểm tra local bổ sung lúc 18:14.

Đã đọc toàn bộ `.runtime/writer-inventory/20261112T111027Z-46b3b817.json` và so sánh máy với báo cáo 17:54:

- Administrator=true, mọi query OK. Restart Manager Start/Register/List đều mã 0, đăng ký đúng **attendance.sqlite, attendance.sqlite-wal, attendance.sqlite-shm, staff.json** và trả về **0 process sử dụng bộ file này** lúc 18:10:20. Không có lỗi quyền hoặc danh sách rỗng do query thất bại.
- Metadata của mọi PID tồn tại ở cả hai báo cáo giống nguyên trạng, gồm Codex 70024 và chuỗi cha, McAfee 58556, PowerShell 61524, hạ tầng WSL/Docker. Services/tasks/Docker mounts cũng giống nguyên trạng. Các chức năng đã được người dùng xác minh vẫn được chấp nhận; không yêu cầu kiểm tra lại. WSL chỉ docker-desktop, task Hotpatch không gọi ZeroTrust, không mount ghi vào DB/seed/Backend.
- Hai PID mới so với 17:54 là **51912** và **34980**; 18380/5856 đã kết thúc. Người dùng xác minh 51912 là powershell.exe tương tác thông thường, không có script ZeroTrust trong command line khởi chạy. Python Manager launcher 34980 có parent 51912, bắt đầu ngay lúc inventory; đã không còn trong Get-Process lúc hậu kiểm. Không còn Python worker trong danh sách runtime; Node duy nhất là Codex 70024. Không lấy launcher tạm thời của lượt kiểm kê làm điểm chặn mới.
- Các cổng 3001/5173/5174 đều không có listener theo inventory. Không phát hiện Backend/worker/task có chức năng ghi dữ liệu dự án qua bộ bằng chứng đã rà soát.

Đối chiếu với kiểm tra 18:07: live plan bằng chính xác file được chỉ định, admin01 khớp, đúng năm account cần đồng bộ; kiểm tra username/role/local/ID collision đạt. Backup probe ghi/fsync/rename/đọc PASS, rollback/recovery fixture trước đó 25/25 PASS. Lúc **18:14**, kiểm tra lại SQLite mode=ro/query_only và seed: hash khớp plan, hash plan nguyên giá trị công bố, integrity/FK PASS, không recovery marker. Dung lượng backup còn 59.192.582.144 byte (~55 GiB). Không gọi lại Keycloak hoặc chạy lại test trong lượt này; giữ rõ thời điểm bằng chứng.

Artifact tổng hợp mới: `.runtime/apply-readiness/20261112T111411Z/inventory-review.json`. Không sửa báo cáo Administrator gốc hoặc ghi đè trạng thái lịch sử của artifact 18:07. Chỉ cập nhật tài liệu/artifact chẩn đoán, không ghi dữ liệu nghiệp vụ hoặc thay code.

### Các bước sau khi người dùng xác nhận riêng

1. Giữ Backend/Web/worker không hoạt động trong cửa sổ bảo trì; **không dừng Codex, Docker, Keycloak hoặc LDAP**. Nếu có thay đổi dữ liệu, writer hoặc IAM sau các bằng chứng trên, kiểm tra lại phần thay đổi. READY là kết luận tại thời điểm rà soát, không phải khóa file hoặc quyền bỏ guard.
2. Dùng đúng plan `.local/staff-id-plans/phase1-20261112T062520Z.json`. Script kiểm tra lại live plan/cổng và lấy transaction lock, từ chối stale plan. **Lệnh dưới đây chưa chạy, chỉ chạy sau xác nhận:**

   ```powershell
   Set-Location D:\ZeroTrust
   python -B scripts/reconcile_staff_ids.py --apply --backend-stopped --plan .local/staff-id-plans/phase1-20261112T062520Z.json
   ```

3. Script tạo và xác minh backup SQLite/seed/plan trong `.local/staff-id-backups/<UTC>-<random>/` trước UPDATE đầu tiên. Chưa có backup nghiệp vụ mới ở lượt chuẩn bị này. Đồng bộ đúng 5 hồ sơ và 41 hàng nghiệp vụ liên quan, thêm 5 ledger, giữ admin01 và lịch sử audit nguyên trạng. Nếu lỗi, giữ backup/marker và phân tích theo quy trình recovery; không tự restore DB cũ.
4. Hậu kiểm Changes:0, integrity/FK, sáu tài khoản, seed/ledger, admin/history và backup. Chạy bootstrap check-only, toàn bộ test Backend cô lập; sau khi đạt mới khởi động Backend/health trong phạm vi được xác nhận.
5. Tiếp tục nghiệm thu thật Web A/Web B, RBAC, MFA tuần 5, LDAP tuần 6. READY chuẩn bị đồng bộ không phải nghiệm thu các luồng đăng nhập này.

**Đang chờ người dùng xác nhận giai đoạn 2. Không apply, không stop/start process/container, không sửa SQLite/seed/Keycloak/LDAP, không commit/push/deploy.**

## Cập nhật 12/11, 18:05–18:07 — xác minh live đạt, chờ inventory hiện tại

**Đã chấp nhận bằng chứng người vận hành và gỡ các điểm thiếu ở báo cáo 17:54:** WSL chỉ docker-desktop; PID 58556 là McAfee WebAdvisor BrowserHost; PowerShell 61524/18380 là console thông thường không chạy script ZeroTrust; Hotpatch/Monitoring gọi `C:\Windows\System32\hpatchmonTask.cmd`, nội dung chỉ kiểm tra Hotpatch/VBS/service hpatchmon. Các kết quả này phù hợp parent/executable/task/mount trong báo cáo Administrator, không yêu cầu kiểm tra lại danh tính các mục đã xác định.

**Kiểm tra mới đã PASS:**

- Đọc lại Keycloak và SQLite, dựng toàn bộ plan trong bộ nhớ lúc 18:07: bằng chính xác `.local/staff-id-plans/phase1-20261112T062520Z.json`. Không tạo hoặc sửa plan. Hash plan đúng giá trị đã công bố, đường dẫn cấu hình đúng, không environment override.
- admin01 live đã khớp; năm account còn lệch đúng mapping: employee01, employee02, manager01, manager02, auditor01. Xác minh username/role/nguồn local/trạng thái/ID duy nhất và không trùng theo script. Không thay IAM/LDAP.
- SQLite `mode=ro`/query_only: integrity/FK PASS, 11 FK được kiểm tra, không recovery marker. Dự kiến 41 hàng nghiệp vụ: staff 5, attendance 10, corrections 10, notifications 16; apply sẽ thêm ledger 5 hàng và sửa 5 ID seed.
- Thư mục backup nằm trong workspace; còn 59.192.614.912 byte, DB+WAL+seed 7.582.172 byte. Probe **file tổng hợp riêng** ghi/fsync/atomic rename/đọc lại PASS và đã dọn đúng file/thư mục probe. Không tạo backup nghiệp vụ mới, không restore dữ liệu thật. Test rollback/recovery 25/25 là bằng chứng lịch sử, không chạy lại vì không thay code.
- Hash nội dung SQLite/seed/plan/Git index giữ nguyên đầu/cuối lượt. Không listener 3001/5173/5174, không thấy Node Backend/Python worker trong danh sách runtime đọc được. Codex 70024 cùng StartTime như báo cáo cũ.

Artifact `.runtime/apply-readiness/20261112T110618Z/readiness.json`; liveCheckedAt 11:07:03 UTC. Kết quả này không phải khóa writer và không cấp quyền apply.

**Còn thiếu để đáp ứng yêu cầu kiểm tra ngay trước kết luận:** xuất hiện PowerShell PID **51912**, StartTime 18:03:58, chưa có trong inventory 17:54; chưa xác định chức năng. PowerShell 18380 cũ không còn trong danh sách runtime; không suy PID 51912 là cửa sổ thay thế. PowerShell 60680 trong lần liệt kê là tiến trình lệnh kiểm tra của agent, không dùng nó làm blocker. Lần thử refresh inventory trong sandbox vẫn không đủ quyền CIM/task/Docker và Restart Manager start mã 29. Artifact `.runtime/writer-inventory/20261112T110547Z-65431b25.json`. Báo cáo Administrator cũ đã chứng minh không có file users lúc 17:54; không coi lỗi sandbox mới là phủ nhận báo cáo cũ, nhưng cũng không coi đó là phép kiểm tra handles thành công lúc 18:05.

**Trạng thái hiện tại: BLOCKED chỉ ở cập nhật writer/handles.** Đã yêu cầu người dùng xác nhận chức năng PID 51912 và chạy lại trong PowerShell Administrator:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/inspect_sqlite_writers.py
```

Gửi đường dẫn Report mới, không raw command line/secret. Không cần dừng Codex/Docker hay các console. Khi báo cáo mới cho thấy không có writer, đối chiếu với các chức năng đã xác định rồi xét READY; tránh yêu cầu phân loại lại những process có cùng PID/StartTime/entrypoint. Không mở Backend/worker trong lúc chờ. **Chưa có xác nhận apply**; các lệnh và hậu kiểm phía dưới vẫn chỉ được chuẩn bị, không thực thi.

## Phân tích báo cáo Administrator 12/11, 17:54 — truy vấn đủ, còn thiếu phân loại

Nguồn: `.runtime/writer-inventory/20261112T105459Z-6fd77b95.json`, checkedAt 10:54:49 UTC (17:54:49 Việt Nam). Đã đọc toàn bộ JSON và đối chiếu với bộ lọc trong source. **Kết luận: BLOCKED; chưa xác nhận mọi writer đã dừng.** Đây không còn là lỗi quyền của báo cáo Administrator: mọi mục truy vấn đều OK. `queryComplete=true` và `REVIEW_REQUIRED` chỉ xác nhận truy vấn thành công, không xác nhận mọi ứng viên đã được phân loại.

| Nhóm | Bằng chứng và kết luận |
|---|---|
| PID 70024 | `D:\node\node.exe`, entrypoint `C:\Users\Tuan\AppData\Roaming\npm\\node_modules\@openai\codex\bin\codex.js`, parent cmd PID 4320, parent tiếp theo PowerShell 10668. **Xác định là Codex CLI, không phải Backend. Không dừng Codex.** Không thấy process dùng file qua Restart Manager. Codex có thể chạy lệnh ghi khi được cấp quyền/chỉ thị, nên không tuyên bố nó không có khả năng ghi; phiên này giữ phạm vi chỉ đọc. |
| Python 5856 | Python Manager launcher, parent PowerShell 18380; bắt đầu 17:54:49, gần đúng thời điểm chạy inventory. Entrypoint null vì parser không đọc qua flags như `-B`. **Có khả năng là launcher của inventory, chưa có quan hệ PID con để chứng minh.** Get-Process kiểm tra sau báo cáo không còn PID này; không là writer đang chạy tại thời điểm kiểm tra lại. |
| Shell còn thiếu chức năng | cmd PID 58556, parent chrome.exe; PowerShell PID 61524, parent explorer.exe. Entrypoint null và các hint false không đủ phân loại lệnh inline/wrapper hoặc lịch chạy trong shell. Cần kiểm tra cục bộ chức năng của hai PID, không dừng chúng. PowerShell 18380 phù hợp cửa sổ vừa chạy inventory; cần người dùng xác nhận là cửa sổ tương tác đó. |
| WSL | WSLService PID 65820 Auto/Running; wsl 29168/30128 có parent com.docker.backend.exe; các wsl/wslhost/wslrelay/vmmemWSL khác là hạ tầng WSL. Không thấy dấu hiệu Backend trong metadata, nhưng chưa biết toàn bộ distro đang chạy hoặc worker Linux bên trong. |
| File users | Start/Register/List đều mã 0; đăng ký đủ attendance.sqlite, WAL, SHM và staff.json; **0 process được Restart Manager trả về**. Bằng chứng tốt tại thời điểm truy vấn, không phải khóa writer hay bảo đảm task không mở file sau đó. Không yêu cầu chạy lại Resource Monitor chỉ vì lỗi mã 29 của báo cáo sandbox cũ. |
| Services | Quét 323, lọc được 1 ứng viên WSLService. Không có ứng viên service ZeroTrust/Node/Python/PM2/NSSM trong bộ lọc. |
| Scheduled Tasks | Quét 299, lọc được 8. NVIDIA NvNodeLauncher: executable/working directory thuộc NVIDIA, không có dấu hiệu ZeroTrust. Bốn task Defender dùng MpCmdRun.exe; hai Workplace Join dùng dsregcmd.exe và Disabled. Chúng khớp bộ lọc chuỗi `node`/`cmd`, không phải bằng chứng là writer nghiệp vụ. **Task `\Microsoft\Windows\Hotpatch\Monitoring` Enabled/Ready chạy cmd.exe, nhưng Arguments bị bỏ: chưa thấy lệnh thật phía sau shell.** Cần xem action cục bộ trước khi loại trừ. Không tự disable task Windows. |
| Docker | 3 container: 0294808a941e không mount; ae7d968aa6b8 bind `directory\.local` → `/bootstrap` READ ONLY và volume LDAP; bcbda4b994ce volume PostgreSQL. **Không mount nào trỏ DB/seed hoặc thư mục Backend để ghi.** Không lấy tên container từ suy đoán; JSON chỉ có ID/mount. |
| Listener | 3001/5173/5174 đều false. Không thấy listener Backend/Web; không đủ loại trừ worker không mở cổng. |

19 ứng viên process gồm cả PID 0/System Idle Process: đây là nhiễu do code dùng sentinel `0` khi danh sách PID file users rỗng, không phải writer. `commandLineOmitted`/`argumentsOmitted` là chủ đích lọc dữ liệu, không là lỗi truy vấn. `entrypoint=null` là thiếu khả năng phân loại, không đồng nghĩa không có chương trình chạy. Không có lỗi truy vấn nào trong JSON Administrator; lỗi quyền sandbox ở mục cũ là bằng chứng của phiên khác.

### Ba phần cần bổ sung, chỉ đọc

1. Trong **Task Manager → Details → Select columns → Command line**, xem cục bộ PID **58556** và **61524**; xác định executable/script đích và chức năng, có loop/job/watcher gọi ZeroTrust không. Không gửi nguyên command line/arguments; chỉ cung cấp tên chương trình hoặc đường dẫn script và mục đích. Xác nhận PowerShell **18380** là cửa sổ chạy inventory. Nếu PID đã kết thúc/tái sử dụng, lấy inventory mới, không suy từ số PID. Không dừng 70024/4320/10668 (chuỗi Codex).
2. Chạy `taskschd.msc`, mở **Task Scheduler Library → Microsoft → Windows → Hotpatch → Monitoring → Properties → Actions**. Xem lệnh sau cmd.exe cục bộ; cung cấp tên executable/script được gọi (không tham số nhạy cảm). Nếu là wrapper, kiểm tra script đó có gọi Backend/worker ZeroTrust không. Không Run/End/Disable/Edit task.
3. Trong PowerShell Administrator, chạy:

   ```powershell
   wsl.exe --list --running
   ```

   Gửi danh sách distro đang chạy. Nếu chỉ có Docker Desktop thì đối chiếu với mounts đã đọc; nếu có distro khác, cần kiểm kê worker/cron/systemd liên quan ZeroTrust bên trong distro **đang chạy**, không khởi động distro đang tắt. Agent thử lệnh này trong sandbox và nhận `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`, nên chưa tự bổ sung được phần này.

Sau khi đủ thông tin trên, mới kết luận về writer; kiểm tra lại plan/Keycloak trước READY. Chưa tái xác minh live plan trong lượt đọc báo cáo này; bằng chứng local gần nhất lúc 17:52, live Keycloak gần nhất 14:01. Không chạy apply hoặc sửa source ứng dụng/SQLite/seed/IAM/LDAP, không stop/start process; chỉ cập nhật tài liệu. Không chạy lại test vì không sửa code.

## Cập nhật 12/11, 17:52 — công cụ kiểm kê cho cửa sổ Administrator

**Trạng thái hiện tại: BLOCKED, chưa READY FOR APPLY.** Sandbox tiếp tục bị PermissionDenied khi truy vấn CIM process/service và Scheduled Task. Restart Manager không tạo được phiên truy vấn (mã 29); Docker không truy vấn được. Không coi danh sách rỗng trong các mục lỗi là không có writer. Get-Process thấy Node PID **70024**, đường dẫn `D:\node\node.exe`; chưa đọc được entrypoint. Bằng chứng Codex PID 71808 ở lượt trước không xác định danh tính PID mới. Không dừng Codex hay bất kỳ tiến trình nào trong lượt này.

Đã thêm `scripts/inspect_sqlite_writers.py`. Mở **PowerShell → Run as administrator** trên máy này và chạy:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/inspect_sqlite_writers.py
```

Script chỉ truy vấn process/service/task, file đang được sử dụng qua Restart Manager, Docker mounts và cổng 3001/5173/5174. Chỉ ghi báo cáo chẩn đoán vào `.runtime/writer-inventory/<UTC>-<random>.json`; không mở SQLite, không đọc credential, không dừng tiến trình, không thay quyền/ExecutionPolicy, không gọi apply. Nó đọc riêng hai đường dẫn DB/seed trong Backend config, không xuất nội dung env. Báo cáo bỏ raw CommandLine/Arguments và chỉ trích script ở vị trí xác định; tên/PID/entrypoint, trạng thái, đường dẫn mount và cờ liên quan được giữ để đối chiếu. Các lỗi truy vấn có trạng thái riêng, không xuất raw stderr.

**Gửi lại đường dẫn `Report:` được in ra**, agent sẽ đọc trên workspace. Không cần gửi password/token/raw command line. Mã thoát khác 0 cùng `BLOCKED_INVENTORY` nghĩa là còn mục không truy vấn được; không chạy lại bằng cách hạ ExecutionPolicy hay bỏ kiểm tra. Nếu tất cả truy vấn thành công, script vẫn chỉ báo `REVIEW_REQUIRED`, không tự xác nhận READY hoặc cấp quyền apply.

Danh sách process/service/task là ứng viên theo runtime, đường dẫn dự án, worker và PID đang dùng file; không phải chứng minh mọi executable tùy biến đều vô hại. Cần rà soát wrapper, PM2/NSSM, shell, WSL, executable tự viết và task có khả năng gọi chúng. Script với flags/inline code hoặc đường dẫn gián tiếp có thể không trích được entrypoint: người vận hành xem cấu hình cục bộ và cung cấp chức năng đã lọc. Task `Ready`/service có auto-restart vẫn có thể tạo writer sau thời điểm truy vấn; phải kiểm soát chúng trong cửa sổ bảo trì trước READY.

Nếu Restart Manager vẫn lỗi ngay cả trong phiên Administrator, chạy `resmon.exe`, vào **CPU → Associated Handles**, tìm `attendance.sqlite` (kể cả WAL/SHM) rồi `staff.json`. Ghi nhận tên process/PID/path hoặc không có kết quả cho từng lần tìm; không đóng handle. Đối chiếu Disk Activity nếu có truy cập. Việc không thấy handle tại một thời điểm không thay thế rà soát Scheduled Task/service. Nếu Docker không truy vấn được, dùng các lệnh mount ở phần dưới và ghi nhận trạng thái Docker; không reset/start container để phục vụ kiểm tra này.

**Bằng chứng mới:** 8/8 kiểm thử cô lập của công cụ PASS (`python -B -m unittest discover -s tests -p test_writer_inventory.py -v`), bao gồm fixture PowerShell, lọc tham số nhạy cảm, lỗi quyền không biến thành danh sách trống thành công, nhận dạng Codex không dựa PID cố định. Chạy thật trong sandbox ghi `.runtime/writer-inventory/20261112T105202Z-4832052b.json`: cả ba truy vấn Windows bị từ chối; file users/Docker chưa xác minh; các cổng Backend/Web không kết nối được.

Đối chiếu local chỉ đọc lúc 17:52: plan `phase1-20261112T062520Z.json` nguyên SHA-256 đã công bố, hash SQLite/seed vẫn khớp plan, integrity/FK PASS, không recovery marker. Artifact `.runtime/writer-inventory/local-plan-20261112T1052Z.json`. **Chưa xác minh lại Keycloak trong lượt này**; lần live gần nhất ở mục lịch sử 14:01. Chưa tạo backup nghiệp vụ mới, chưa apply. Sau khi nhận báo cáo Administrator và xác định mọi writer không hoạt động/tự chạy lại, kiểm tra lại plan và Keycloak, rồi mới xét READY; apply vẫn cần xác nhận riêng.

## Cập nhật 12/11, 14:00–14:01 — PID Codex đã được xác định

Người dùng đã kiểm tra bằng PowerShell Administrator: **PID 71808 = `D:\node\node.exe`, entrypoint `@openai/codex/bin/codex.js`, parent PID 67088**. Đây là Codex CLI, không phải Backend. **Không dừng Codex; không còn coi danh tính PID này là blocker.** Agent đọc được metadata PID 71808 và parent 67088 (`cmd.exe`), nguồn xác nhận entrypoint là người dùng.

Kết quả kiểm tra lại:

- **PASS:** đọc lại Keycloak/SQLite và dựng lại plan trong bộ nhớ vẫn bằng chính xác `.local/staff-id-plans/phase1-20261112T062520Z.json`. File plan nguyên hash, database/seed/admin01/index không đổi; integrity/FK đạt, không recovery marker. Không thay hoặc tạo plan khác.
- **Quan sát:** Get-Process không thấy ứng viên Node/Python/SQLite khác ngoài PID Codex trong bộ lọc tên tại thời điểm kiểm tra; cổng 3001/5173/5174 đều không có listener.
- **Quan sát:** Get-Service lọc Name/DisplayName theo ZeroTrust/attendance/node/python/pm2/nssm/sqlite/governance trả 0 ứng viên. Đây chỉ là tên service, không phải kiểm kê executable/config của mọi service.
- **BLOCKED còn lại:** CIM process/service và Get-ScheduledTask vẫn trả PermissionDenied. Chưa kiểm kê được đầy đủ command/config của worker và lịch chạy nền, chưa có xác nhận handle file. Không báo READY FOR APPLY từ bằng chứng chưa đầy đủ.

Artifacts mới: `.runtime/apply-readiness/20261112T070031Z/readiness.json`. Không chạy apply, không ghi dữ liệu thật, không stop/start process, không thay quyền/ExecutionPolicy. Test 25/25 và probe backup ở lượt trước vẫn là bằng chứng lịch sử, không tuyên bố đã chạy lại trong lượt này.

**Cần bổ sung từ PowerShell Administrator:** chạy phần “Các process, service và tác vụ định kỳ có thể ghi” và kiểm tra Associated Handles bên dưới; gửi metadata đã lọc hoặc kết quả không có ứng viên cùng trạng thái truy vấn thành công. Không cần kiểm tra lại hay dừng PID Codex, không gửi raw CommandLine/Arguments/token/password. Nếu có ứng viên khác, xác định chức năng/cấu hình trước khi quyết định dừng trong cửa sổ bảo trì được phép. Việc người dùng mở PowerShell Administrator không tự nâng quyền cho sandbox của agent.

## Lượt trước — kết quả 13:36–13:41 (lịch sử)

Kiểm tra 12/11/2026, **13:36–13:41 giờ Việt Nam**. Người dùng chỉ cho phép kiểm tra chỉ đọc/test an toàn, không apply hoặc dừng tiến trình chưa xác định. Không có thao tác đổi SQLite/seed/Keycloak/LDAP, stop/start process/container hoặc thay ExecutionPolicy/quyền hệ thống trong lượt này.

## Kết quả

| Điều kiện | Kết quả |
|---|---|
| Plan đúng file đã chỉ định, hash không đổi | **PASS** |
| Nội dung SQLite và seed còn khớp plan | **PASS**, cả đầu và cuối lượt |
| Đọc lại Keycloak và dựng lại plan trong bộ nhớ | **PASS**, bằng chính xác toàn bộ plan đã lưu; không thay file plan |
| SQLite integrity/FK, không có recovery marker | **PASS** |
| Thư mục backup có thể ghi/fsync/atomic rename/đọc lại | **PASS**, thử bằng file tổng hợp riêng, đã dọn đúng file/thư mục thử; không sao chép hoặc restore dữ liệu thật |
| Dung lượng backup tại thời điểm kiểm tra | **PASS**, còn khoảng 55 GiB; DB+WAL+seed khoảng 7,3 MiB |
| Kiểm thử backup/rollback/recovery | **PASS 25/25**, trên fixture |
| Danh tính chính xác Node PID 71808 | **BLOCKED**, chỉ biết `D:\node\node.exe`; chưa đọc được script/arguments/parent bằng CIM |
| Backend, worker, service/task định kỳ không ghi SQLite | **BLOCKED**, CIM và Get-ScheduledTask trả PermissionDenied; không thể chứng minh mọi writer đã dừng |

Không thấy listener 3001/5173/5174; thấy 8080. Việc cổng Backend đóng và DB không đổi trong khoảng quan sát **không đủ** kết luận không có worker nền hoặc task sắp chạy. PID 71808 không được coi là Backend chỉ vì tên node.exe; chưa dừng PID này.

Plan duy nhất đang xét:

```text
D:\ZeroTrust\.local\staff-id-plans\phase1-20261112T062520Z.json
SHA-256: e7cea8a0a2b187aab66efdb51b54b781bb0cc8a49512d3d4afa352f27d84fce4
```

Keycloak được kiểm tra lại lúc 13:37: admin01 khớp, năm mapping employee01/employee02/manager01/manager02/auditor01 vẫn đúng, toàn bộ cấu trúc plan bằng bản đã lưu. Kiểm tra local cuối lúc 13:41: SQLite/seed/admin01/index/plan không đổi. Không được coi các bằng chứng theo thời điểm này là khóa writer cho tương lai.

## Lệnh kiểm tra với quyền phù hợp

Mở **PowerShell — Run as administrator** trên máy chứa `D:\ZeroTrust`, dùng tài khoản có quyền đọc CIM và Task Scheduler. Các lệnh dưới đây chỉ truy vấn, không stop/disable process/task/service. Không dùng `Format-List *`, không xuất `CommandLine`, `Arguments`, environment hoặc toàn bộ `docker inspect` vào báo cáo vì có thể chứa secret.

### PID 71808 và tiến trình cha — đã được người dùng xác nhận, giữ lệnh làm tham khảo

```powershell
$ztProcess = Get-CimInstance Win32_Process -Filter 'ProcessId=71808' -ErrorAction Stop
if (-not $ztProcess) { 'PID 71808 no longer exists; refresh the complete process inventory.' }
$ztProcess | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CreationDate,
  @{Name='BackendHint';Expression={$_.CommandLine -match 'server\.js'}},
  @{Name='ViteHint';Expression={$_.CommandLine -match 'vite'}},
  @{Name='ProjectHint';Expression={$_.CommandLine -match 'ZeroTrust'}},
  @{Name='Entrypoint';Expression={
    $ztMatch = [regex]::Match($_.CommandLine, '^\s*(?:"[^"]+"|\S+)\s+(?:"([^"\r\n]+\.(?:js|cjs|mjs))"|([^\s"=]+\.(?:js|cjs|mjs)))(?:\s|$)', 'IgnoreCase')
    if ($ztMatch.Success) {
      $ztEntry = $ztMatch.Groups[1].Value
      if (-not $ztEntry) { $ztEntry = $ztMatch.Groups[2].Value }
      if ($ztEntry -notmatch '^[\-]|[=`?]' -and $ztEntry -notmatch '://') { $ztEntry }
    }
  }} | Format-List
if ($ztProcess) {
  Get-CimInstance Win32_Process -Filter "ProcessId=$($ztProcess.ParentProcessId)" -ErrorAction Stop |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CreationDate
}
```

`Entrypoint` chỉ trích đường dẫn script ở vị trí ngay sau executable, không in tham số phía sau. Nếu Node dùng flags/preload/inline code hoặc wrapper, trường này có thể trống: **không suy danh tính từ kết quả trống**, cần người vận hành kiểm tra cấu hình khởi chạy cục bộ và cung cấp tên script/chức năng đã lọc. So sánh CreationDate để tránh nhầm PID tái sử dụng.

### Các process, service và tác vụ định kỳ có thể ghi

```powershell
Get-CimInstance Win32_Process -ErrorAction Stop |
  Where-Object {
    (
      $_.Name -match 'node|python|sqlite|dbeaver|sqlitestudio' -or
      $_.CommandLine -match 'ZeroTrust|attendance\.sqlite|staff\.json'
    )
  } |
  Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CreationDate,
    @{Name='ProjectHint';Expression={$_.CommandLine -match 'ZeroTrust'}},
    @{Name='WorkerHint';Expression={$_.CommandLine -match 'server\.js|process_governance|directory_user|restore_week|reconcile_staff_ids|setup_week|fix-admin'}}

Get-CimInstance Win32_Service -ErrorAction Stop |
  Where-Object {$_.PathName -match 'ZeroTrust|node|python|sqlite|nssm|pm2'} |
  Select-Object Name, State, StartMode, ProcessId

Get-ScheduledTask -ErrorAction Stop |
  Where-Object {
    ($_.Actions.Execute -join ' ') -match 'node|python|sqlite|powershell|pwsh|cmd|wscript|cscript|ZeroTrust' -or
    ($_.Actions.Arguments -join ' ') -match 'ZeroTrust|attendance\.sqlite|staff\.json|server\.js'
  } |
  Select-Object TaskPath, TaskName, State,
    @{Name='Enabled';Expression={$_.Settings.Enabled}},
    @{Name='Executable';Expression={$_.Actions.Execute -join '; '}},
    @{Name='WorkingDirectory';Expression={$_.Actions.WorkingDirectory -join '; '}},
    @{Name='ProjectHint';Expression={($_.Actions.Arguments -join ' ') -match 'ZeroTrust|attendance\.sqlite|staff\.json'}}

Get-NetTCPConnection -State Listen -ErrorAction Stop |
  Where-Object {$_.LocalPort -in 3001,5173,5174,8080,8090,8443} |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Đây là danh sách ứng viên, không phải bằng chứng tự động rằng mọi chương trình khác không thể ghi file. Task trạng thái Ready vẫn có thể chạy theo lịch; service/wrapper có thể tự restart Backend. Đối chiếu cấu hình của các ứng viên liên quan, không tắt hàng loạt task Windows.

### Handle của file và container có bind mount

Trong PowerShell có quyền phù hợp, mở công cụ Windows để kiểm tra:

```powershell
resmon.exe
```

Resource Monitor → CPU → Associated Handles: tìm lần lượt `attendance.sqlite` (gồm WAL/SHM) và `staff.json`; ghi lại tên process/PID/path, không đóng handle. Xem thêm Disk Activity để phân biệt read/write. Không có handle tại một thời điểm không loại trừ tác vụ định kỳ sẽ mở file sau đó.

Nếu ứng dụng có thể chạy trong container, chỉ đọc thông tin mount (không đọc env/secret):

```powershell
docker ps --format '{{.ID}} {{.Names}}'
# Với từng ID container đang chạy được xác định cần kiểm tra:
docker inspect --format '{{json .Mounts}}' <CONTAINER_ID>
```

Không copy nguyên `<CONTAINER_ID>`; thay bằng ID vừa đọc. Đối chiếu bind mount có trỏ đến `D:\ZeroTrust`, `backend\data` hoặc các file đích không. Container Keycloak/PostgreSQL/LDAP đang chạy không tự chứng minh có/không có container khác ghi SQLite host. Nếu vẫn PermissionDenied, giữ trạng thái BLOCKED và nhờ quản trị viên cung cấp kết quả đã lọc, không đổi quyền hệ thống/ExecutionPolicy để bỏ chặn trong phiên agent.

Nguồn ghi đã thấy trong source: Backend chứa collector mỗi 30 giây, directory sync theo cấu hình, retention hằng ngày và các API/workflow nghiệp vụ; script `directory_user.py`, `process_governance.py`, setup/restore, các fix-admin cũ và reconciliation cũng có thể ghi khi được gọi. Đọc source không chứng minh các tiến trình này đang/chưa chạy.

## Lệnh apply đã chuẩn bị — CHƯA ĐƯỢC CHẠY

Chỉ khi đã xác định hết writer liên quan, bảo đảm chúng không chạy lại trong cửa sổ bảo trì, kiểm tra lại plan và **người dùng xác nhận riêng**:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/reconcile_staff_ids.py --apply --backend-stopped --plan .local/staff-id-plans/phase1-20261112T062520Z.json
```

`--backend-stopped` là xác nhận của người vận hành, không phải công cụ tự dừng hoặc tự phát hiện mọi writer. Script kiểm tra cổng, khóa transaction và từ chối plan lỗi thời; không bỏ các bước này. Nếu stale plan hoặc Keycloak thay đổi, dừng, tạo dry-run mới và báo cáo lại trước khi dùng plan khác.

Apply tự tạo backup thật đã kiểm tra trong `.local/staff-id-backups/<UTC>-<random>/` **trước UPDATE đầu tiên**. Probe file tổng hợp trong lượt này chỉ chứng minh quyền ghi/fsync/rename tại thư mục đó; không phải backup dữ liệu nghiệp vụ. Không coi backup cũ là restore point mới.

## Quy trình kiểm tra sau apply (chưa thực hiện)

1. Giữ Backend/Web dừng. Lưu đường dẫn backup được script in; phải có `attendance.sqlite`, `staff.json`, `plan.json`, thông báo verification passed, không có recovery marker. Nếu lỗi/gián đoạn thì giữ nguyên backup và marker, không khởi động ứng dụng.
2. Chạy lại dry-run mặc định:

   ```powershell
   python -B scripts/reconcile_staff_ids.py
   ```

   Phải `Changes: 0`, admin01 vẫn khớp; script kiểm tra integrity/FK và sáu identity. Đối chiếu trước/sau với backup: không mất hàng, admin và lịch sử nguyên trạng; năm ID và các FK nghiệp vụ chuyển đúng; ledger có đúng năm ánh xạ. Script đã kiểm tra từng bảng trước commit, cần ghi lại bằng chứng hậu kiểm.
3. Kiểm tra bootstrap chỉ đọc:

   ```powershell
   node backend/server.js --check-bootstrap
   ```

   Kiểm tra này còn xét các hồ sơ local active ngoài sáu demo; nếu gặp lỗi thì điều tra, không bypass hoặc tự thêm/sửa user.
4. Chạy toàn bộ `backend/*.test.js` bằng preloader `tests/isolated-node.cjs` với `IAM_TEST_ROOT` là thư mục fixture mới và environment đã lọc. Không dùng `.env`/SQLite thật làm fixture; quy trình test cô lập đã được dùng ở các lượt trước.
5. Sau các kiểm tra và trong phạm vi giai đoạn 2 được xác nhận, chạy Backend từ root bằng `node backend/server.js` hoặc cơ chế vận hành đã xác định; không dùng runner để vô tình mở thêm Web/container. Kiểm tra public health:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:3001/health
   ```

6. Giai đoạn 3 mới nghiệm thu login/RBAC Web A/B, MFA tuần 5, LDAP tuần 6. Không coi health/test fixture là login live đã PASS.

Nếu có marker gián đoạn, lệnh `--recover --backend-stopped` chỉ được dùng khi đã phân tích trạng thái và được phép; nó đối chiếu hash trước/sau commit rồi phục hồi seed tương ứng, không restore DB thật. Khi DB/seed có thay đổi ngoài marker, giữ BLOCKED để xử lý thủ công, không ghi đè database bằng backup cũ.

Artifacts lượt này: `.runtime/apply-readiness/20261112T063628Z/` — `baseline.json`, `local-readiness.json`, `live-readiness.json`, `rollback-tests.log`, `final-status.json`. Không có secret/raw response. Chưa tạo backup thật mới, chưa apply, chưa dừng process, chưa commit/push/deploy.
