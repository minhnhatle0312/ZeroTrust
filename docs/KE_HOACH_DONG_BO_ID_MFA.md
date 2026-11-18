# Migration riêng hai tài khoản MFA — đã SUCCESS, không chạy lại apply

**Kết quả mới nhất 12/11, 20:02:** apply đúng một lần SUCCESS, hậu kiểm độc lập PASS: đúng 2 staff.id đổi, thêm 2 ledger, năm ledger cũ và mọi bảng khác/seed/20 audit outbox nguyên trạng. Cả tám local active khớp Keycloak; integrity/FK PASS, không marker. Bootstrap live check-only PASS, không start Backend/Web. Backup thật `.local/mfa-staff-id-backups/20261112T130017Z-mfa-5101bc0d/`, manifest SHA-256 `3b13a1590092dc379c306f8c6683f00fa82075d51412095dcf1e4f056570d3e1`. [Kết quả đầy đủ](../.runtime/mfa-migration-runs/20261112T125808Z/result.json) và đầu [tài liệu giai đoạn 2](CHUAN_BI_GIAI_DOAN_2_APPLY.md). **Không chạy lại plan/apply hoặc rollback.** Phần chuẩn bị, quyền và blocker bên dưới giữ làm lịch sử; không còn là trạng thái hiện hành.

**Cập nhật 12/11, 19:50: người dùng đã cho phép migration đúng hai MFA; chưa apply vì preflight writer BLOCKED.** Inventory elevated 19:29 đã cách khoảng 21 phút; inventory sandbox mới `20261112T125035Z-db22ba51.json` không đọc được handles/CIM/Docker. Cần report Administrator mới để tiếp tục trong quyền đã cấp, không xin lại phép migration. Chi tiết tại đầu docs/CHUAN_BI_GIAI_DOAN_2_APPLY.md và mục 27 PROJECT_CONTEXT. Không có backup MFA thật hoặc thay đổi dữ liệu trong lượt này. Các kết luận READY/chờ phép bên dưới là lịch sử.

**Cập nhật 12/11, 19:33: READY FOR APPLY, chờ xác nhận cuối; chưa thay dữ liệu thật.** Inventory Administrator mới `20261112T122906Z-14aac35f.json` tại 19:29 có đủ quyền/query, 317 process/323 service/299 task, không file user cho SQLite/WAL/SHM/seed. Các ứng viên đã phân loại và Docker mounts không có nguồn ghi dữ liệu Backend; Codex giữ nguyên, launcher kiểm kê đã kết thúc. Live plan/IAM 19:31:57 khớp hoàn toàn; kiểm tra local/integrity/FK/marker sau test 19:32:18 PASS. 24/24 test cô lập chạy mới PASS; probe backup PASS, free 59.090.096.128 byte, backup/manifest năm demo nguyên trạng. Xem [readiness.json](../.runtime/mfa-readiness/20261112T123109Z/readiness.json), preflight và test log cùng thư mục. Điểm chặn thiếu quyền ở cuối tài liệu là lịch sử, đã giải quyết. READY có giá trị với trạng thái và cửa sổ bảo trì đã kiểm tra; vẫn phải revalidate/backup mới trước apply được duyệt. Chưa tạo backup MFA thật hoặc chạy migration.

Ngày 12/11/2026. Người dùng chỉ cho phép lập plan, sửa mã và thử trên bản sao. **Chưa thay đổi dữ liệu thật; cần xác nhận riêng trước apply.** Migration năm demo đã SUCCESS phải giữ nguyên, không chạy lại hoặc rollback để chữa lỗi MFA.

## Plan và phạm vi

Plan: [mfa-20261112T120146Z.json](../.local/mfa-staff-id-plans/mfa-20261112T120146Z.json).

SHA-256 byte của plan: `9bcc728d57084a0f6474e271738be892e4ed642a95d09096820cb8d02af4c0dd`.

| Hồ sơ | Role | ID SQLite hiện tại | ID Keycloak đích |
|---|---|---|---|
| mfa-employee | employee | 431df574-7925-469e-92f1-1377853a78b2 | fa4c264c-794b-4440-bbb1-b4f505e39622 |
| mfa-auditor | auditor | 7c795907-4fc0-440f-885e-fe61c25a1ca1 | a0baf693-07f0-418e-ba1f-177892305e87 |

Đối chiếu Keycloak thật bằng GET: mỗi username duy nhất, enabled, nguồn local, role đúng, ID cũ không còn, ID mới chưa bị hồ sơ local khác dùng. Local active, `mfa_required=1`; remote có `nhip.mfa.required=['true']`, `totp=false`, required action `CONFIGURE_TOTP`. Không đọc credential hoặc thay đổi yêu cầu MFA. Hai hồ sơ không nằm trong `staff.json`; seed vẫn đúng sáu demo đã khớp IAM.

Dự kiến **UPDATE đúng 2 hàng staff (chỉ cột id), INSERT đúng 2 hàng staff_id_reconciliations**. Không đổi số hồ sơ staff; không đổi seed. Năm hàng ledger của migration demo phải nguyên trạng. Không có hàng chấm công, đơn điều chỉnh, thông báo hoặc quan hệ nghiệp vụ khác cần chuyển cho hai MFA. Quét schema/mọi bảng, ID cũ và ID mới; kiểm tra 12 khóa ngoại toàn DB, gồm các quan hệ tới staff. Nếu xuất hiện thêm quan hệ nghiệp vụ, script dừng để duyệt lại phạm vi, không tự mở rộng migration.

**20 hàng audit_outbox giữ nguyên từng trường**: mỗi MFA có 10 hàng (6 liên quan ID cũ, 4 ID mới); tổng 12 delivered, 8 pending. Không thay payload, delivery status hay lịch sử sự kiện. Plan ghi số hàng và hash nội dung theo tài khoản; hậu kiểm so toàn bộ bảng. Mọi lịch sử khác, admin01, sáu demo, bốn LDAP active và 13 hồ sơ disabled đều không thay đổi.

## Mã nguồn và kiểm thử đã thực hiện

- [reconcile_mfa_ids.py](../scripts/reconcile_mfa_ids.py): script riêng, mặc định dry-run; allowlist đúng hai MFA; kiểm tra lại sáu demo và năm ledger cũ. Tái sử dụng transport GET/token refresh và helper backup/manifest của `reconcile_staff_ids.py`. Không chạy migration năm demo.
- [rehearse_mfa_ids.py](../scripts/rehearse_mfa_ids.py): diễn tập trong thư mục mới dưới `.runtime/mfa-rehearsals`; nguồn vận hành mở chỉ đọc, mutation chỉ vào bản sao. IAM của diễn tập là dữ liệu giả lập từ kết quả đối chiếu đã ghi trong plan.
- [test_mfa_id_reconciliation.py](../tests/test_mfa_id_reconciliation.py): **24 bài kiểm thử riêng biệt PASS** (lượt đầy đủ ban đầu 23/23, sau đó thêm và chạy riêng 1/1 test ghi marker dang dở). Bao gồm role/MFA/LDAP/status, trùng hoặc ID cũ còn tồn tại, stale plan, phát sinh quan hệ/triggers, lỗi backup/manifest, lỗi giữa hai UPDATE, lỗi hậu kiểm, seed bị ghi đồng thời, ngắt trước/sau commit và từ chối recovery không an toàn.
- Fixture JWT chạy qua Backend: tám hồ sơ local được nhận diện sau đồng bộ; ID MFA cũ vẫn bị UNREGISTERED; sai role/session bị chặn; `MFA_SETUP_REQUIRED` và `REQUIRED_ACTION_PENDING` vẫn có hiệu lực. Không bỏ qua JWT/RBAC/MFA.

Diễn tập trên **bản sao dữ liệu vận hành** được người dùng cho phép: **8/8 PASS**. Báo cáo [rehearsal-report.json](../.runtime/mfa-rehearsals/20261112T120551Z-40200e7b/rehearsal-report.json). Bao gồm thành công, lỗi manifest, backup hỏng, lỗi hậu kiểm, stale plan, tiến trình bị ngắt thực sự trước/sau commit, từ chối recovery sau một ghi mới. Trên bản sao, bootstrap trước đồng bộ báo mismatch như dự kiến; sau đồng bộ PASS cả tám hồ sơ local active với IAM giả lập. DB/seed thật, plan và Git index không đổi sau diễn tập.

Lệnh kiểm thử có thể tái hiện, không apply dữ liệu thật:

```powershell
python -B -m unittest discover -s tests -p test_mfa_id_reconciliation.py -v
python -B scripts/rehearse_mfa_ids.py --plan .local/mfa-staff-id-plans/mfa-20261112T120146Z.json
```

Không coi kết quả này là nghiệm thu OTP, SSO hoặc LDAP thật. Không chạy `setup_week5.py`, không khởi động Backend khi hai UUID thật còn lệch.

## Backup và phục hồi dự kiến

Khi được phép apply, backup mới nằm tại `.local/mfa-staff-id-backups/<UTC>-mfa-<uuid>/`, tạo độc quyền, không ghi đè. **Chưa có backup migration MFA thật.** Backup/snapshot trong `.runtime/mfa-rehearsals` chỉ phục vụ diễn tập.

Giữ `BEGIN IMMEDIATE` để ngăn writer SQLite khác trong transaction. Dùng SQLite backup API lấy snapshot gồm dữ liệu đã commit trong WAL; không copy thô file DB. Sao lưu `attendance.sqlite`, `staff.json`, `plan.json`; tạo `manifest.json` gồm absolute path, sizeBytes, SHA-256 của từng file, ghi exclusive và fsync. Đọc lại manifest và mọi file; kiểm tra SQLite integrity/FK, logical hash, seed hash và plan. **Chỉ sau khi tất cả PASS mới thực hiện UPDATE đầu tiên.** Staff.json được backup nhưng không được ghi bởi migration này.

Backup migration năm demo `.local/staff-id-backups/20261112T113356Z-be31a903/` đã được kiểm tra lại, manifest SHA-256 vẫn là `f4336b9eeb7b9dea1e356f3a0f4e7bb937eca04a1d06ba7d1f28ddb9343e1774`. Không xóa hoặc thay backup cũ.

Trước commit: lỗi sẽ rollback toàn bộ transaction hai UPDATE/hai INSERT; không ghi đè seed nếu seed bị tác nhân khác sửa. Marker ghi dang dở được giữ để chặn bootstrap và yêu cầu xem xét, không tự bỏ qua.

Sau commit hoặc khi chưa rõ kết quả do ngắt tiến trình: giữ Backend/writer dừng, không apply lần hai. Recovery riêng của script MFA kiểm tra loại marker, đường dẫn, manifest, trạng thái DB chính xác trước/sau, delta và seed. Nếu xác nhận được, chỉ xóa marker và báo NOT_COMMITTED hoặc COMMITTED; **không phục hồi DB/seed tự động**. Marker dùng đường dẫn interlock hiện có `staff.json.reconcile-pending.json` nhưng có kind riêng; không dùng recover của script năm demo cho marker MFA.

Nếu DB/seed đã thay đổi tiếp hoặc backup/marker hỏng: recovery từ chối, giữ bằng chứng. Phục hồi từ backup cần phương án và xác nhận riêng sau khi kiểm tra writer, hash/manifest, mọi giao dịch mới và phạm vi mất dữ liệu. Không tự chép đè DB/WAL/SHM hoặc khôi phục backup năm demo.

## Điều kiện bắt buộc trước apply thật

1. Có xác nhận riêng của người dùng cho đúng hai MFA, không suy quyền từ việc cho phép thử bản sao.
2. Kiểm kê Administrator mới đủ process, service, scheduled task, worker, container mount và handles của SQLite/WAL/SHM/staff.json; phân loại mọi ứng viên và xác nhận không có writer, giữ cửa sổ bảo trì. Không dừng Codex/Docker. Cổng đóng hoặc cờ `--backend-stopped` không thay bằng chứng này.
3. Đối chiếu lại IAM, toàn plan, DB/seed/ledger/audit, integrity/FK và marker ngay trước apply. Thay đổi enrollment/required actions/role/ID/dữ liệu làm plan stale và phải xem xét lại; không lặng lẽ sửa plan đã duyệt.
4. Backup root đủ dung lượng/quyền ghi, backup mới và manifest được xác minh trước mutation. Không lấy snapshot diễn tập thay backup đúng thời điểm apply.
5. Hậu kiểm độc lập trước khởi động: cả tám local active khớp, hai staff/hai ledger đúng phạm vi, seed nguyên byte, số hàng không mất, toàn history/audit nguyên trạng, integrity/FK và bootstrap PASS. Sau đó mới nghiệm thu Web A/B, MFA và LDAP theo phạm vi được phép.

Kiểm kê sandbox mới [20261112T120934Z-88a36ba8.json](../.runtime/writer-inventory/20261112T120934Z-88a36ba8.json), checkedAt **19:09:30 ngày 12/11**: **BLOCKED_INVENTORY**. CIM process/service/task PermissionDenied; Restart Manager startCode 29, không đọc được handles; Docker query thất bại. Cổng 3001/5173/5174 đóng nhưng không đủ kết luận không writer. Báo cáo Administrator lịch sử của migration năm demo không thay thế lần kiểm kê mới cho MFA.

Đối chiếu cuối lúc **19:13:20**: [readiness.json](../.runtime/mfa-preparation/20261112T121320Z/readiness.json), **dataPreflight PASS**. Toàn plan bằng trạng thái live Keycloak/SQLite; integrity/FK PASS, không marker, DB logical hash và seed hash vẫn bằng hậu kiểm migration năm demo. Xác minh lại manifest/backup cũ PASS. Probe file tổng hợp ghi/fsync/rename/đọc/dọn dưới backup root MFA PASS, còn 59.090.182.144 byte. Không tạo backup migration MFA thật. **Chuẩn bị PASS; apply thật vẫn BLOCKED bởi thiếu inventory hiện tại và chưa có xác nhận riêng.**

Ngay trước lần apply tương lai, chạy trong PowerShell Administrator và gửi đường dẫn Report để phân tích:

```powershell
Set-Location D:\ZeroTrust
python -B scripts/inspect_sqlite_writers.py
```

Lệnh apply **chỉ được chuẩn bị, CHƯA CHẠY**; chỉ dùng sau khi các điều kiện trên đạt và có xác nhận riêng:

```powershell
python -B scripts/reconcile_mfa_ids.py --apply --backend-stopped --plan .local/mfa-staff-id-plans/mfa-20261112T120146Z.json
```

Rủi ro còn lại: writer và trạng thái IAM có thể đổi sau kiểm tra; đây là liên kết lại danh tính local đã được đối soát, không tự ghép LDAP; 8 outbox pending phải được giữ nguyên cho luồng xử lý bình thường; OTP chưa đăng ký và LDAP còn các vấn đề riêng. Đổi hai UUID không thay thế nghiệm thu MFA/SSO/LDAP. Bản sao thử chứa dữ liệu nghiệp vụ, giữ trong thư mục runtime local, không đưa vào Git hoặc báo cáo payload.
