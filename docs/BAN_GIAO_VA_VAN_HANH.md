# Bàn giao và vận hành tuần 10

Ngày cập nhật 08/11/2026. Lab đã được áp dụng, chạy và kiểm thử; xem [kết quả thực tế](KET_QUA_KIEM_THU_2026_11_08.md). Chưa nghiệm thu thiết bị vật lý thứ hai hoặc phục hồi phối hợp toàn bộ các kho.

## Thứ tự chuẩn bị

1. Giữ bản sao workspace và cấu hình riêng; không gửi `.env`, private key, backup DB lên GitHub. Nguồn có thể đóng gói bằng `python scripts/package_week10.py`, không bao gồm runtime data.
2. Cài Node.js 22.19+, Python 3.11+ cho scripts và Docker Desktop; `npm.cmd ci` ở backend, web-a, web-b. Container audit dùng Python 3.12 và requirements riêng.
3. Nếu lab đã có tuần 1–4, **không chạy lại init/reset/seed**. Đọc và áp dụng tuần 5 → 6 → 7 theo note tương ứng; mỗi setup có tiền điều kiện và backup riêng.
4. Đặt hostname/IP ổn định cho LAN/VPN; cấu hình HTTPS theo [KET_NOI_HAI_MAY.md](KET_NOI_HAI_MAY.md). Tin CA trên cả hai máy. IP `10.0.103.227` trước đây không được mặc định còn đúng.
5. Tuần 8: `python scripts/prepare_week8.py`; đây là bước tạo token/password audit riêng, không mở dịch vụ. Giới hạn ACL các thư mục private cho tài khoản vận hành.
6. Build/start Compose có đầy đủ overlay, sau đó dùng runner cuối. Các lệnh dưới đây đã được thực hiện trên lab:

```powershell
docker compose --env-file .env --env-file audit/.local/compose.env -f docker-compose.yml -f directory/compose.week6.yml -f audit/compose.week8.yml up -d --build
python scripts/run_week10.py --network
```

Chế độ local dùng `python scripts/run_week10.py` khi đã cấu hình local. Runner yêu cầu LDAP và audit đã cấu hình, không provision/reseed hoặc tự bật Python Detection. Chế độ `--network` có build frontend để gateway phục vụ bản mới; chỉ chạy khi bắt đầu triển khai, hiện chưa build.

| Điểm truy cập | Mục đích |
| --- | --- |
| `https://HOST:8443/` | Trang chọn ứng dụng |
| `/a/` | Nhịp Workspace |
| `/b/#/governance` | JCL |
| `/b/#/central-audit` | Audit PostgreSQL, cảnh báo và collector |
| `/b/#/detection` | Python Detection |
| `127.0.0.1:8090` | Nội bộ backend → Audit Service, cần token, không mở browser trực tiếp |

## Cấu hình và dữ liệu

| Thành phần | Nguồn cấu hình | Dữ liệu |
| --- | --- | --- |
| Keycloak | `.env`, scripts setup tuần 2/3/5/6/7 | volume `postgres_data` |
| LDAP | `directory/directory-config.json`, `directory/.local` | volume `ldap_week6_data` |
| Backend | `backend/.env` | SQLite tại `ATTENDANCE_DB`, mặc định backend/data/attendance.sqlite |
| Frontend | `.env.local` của mỗi web | Asset build; không lưu service secret |
| Gateway | `network/.local` | CA/certificate/key/config riêng |
| Audit | `audit/.local/compose.env` | volume `audit_data`, schema.sql |
| Detection | detection_config PostgreSQL | checkpoint, jobs, features, labels, evaluations |

Migration SQLite/PostgreSQL là additive trong startup. Chưa có thử nghiệm migration/rollback trên dữ liệu thật. Chốt tag/image digest/dependency lock sau build nghiệm thu; không gọi snapshot hiện tại là bản production reproducible đã xác nhận.

## Vận hành hằng ngày

- Web B → Audit PostgreSQL → Collector: xem last success, pending, retry, checkpoint và gap. Không chỉ nhìn HTTP health 200 để kết luận collector đã theo kịp.
- Cảnh báo được xử lý bằng note và version. Chỉ khóa/thu hồi phiên khi có căn cứ; signal Python không tự quyết định quyền.
- Python tự động mặc định tắt. Nút chạy xử lý tối đa 200 sự kiện. Nếu bật auto, theo dõi pending và processing time; không tăng ngưỡng chỉ để giảm số cảnh báo trong báo cáo.
- Cấu hình retention không tự xóa. Preview → xác nhận riêng để dọn; cần backup và lưu ý snapshot đánh giá còn giữ dữ liệu đã chụp. Outbox SQLite chưa có tự dọn; theo dõi dung lượng.
- Workflow partial giữ chặn cho tới khi đối chiếu đúng nguồn. Không sửa `governance_state` trực tiếp để bỏ hold. LDAP source_write chỉ resume khi writer cũ đã dừng.
- Không chạy hai backend cùng ghi một SQLite trong lab. Không tự dùng runner cũ làm mất Compose overlay directory/audit.

## Sao lưu

`python scripts/backup_week10.py` tạo backup riêng cho Keycloak DB/config, SQLite, LDAP nếu đã cấu hình, audit DB và private config. Manifest SHA-256 được cập nhật; lỗi audit dump giữ `complete=false`.

Để có điểm khôi phục phối hợp: chặn truy cập mới ở gateway; dừng backend/collectors, audit-service/Python, LDAP operator jobs và mọi công cụ quản trị/Keycloak writer; các DB và LDAP vẫn cần phục vụ thao tác backup. Sau đó dùng `--writes-quiesced` khi người vận hành thực sự đã làm điều này. Cờ chỉ ghi nhận xác nhận của operator, không chứng minh hệ thống đã yên. Script backup cũ cần Keycloak REST để lấy config; nếu dừng Keycloak thì phải có snapshot config trước và thực hiện dump dữ liệu riêng theo runbook, không đánh dấu phối hợp giả.

Backup chứa credential và private key; giữ ở thư mục ignored `backups`, phân quyền máy chủ và sao lưu sang nơi riêng có kiểm soát. ZIP source không thay thế backup DB.

## Khôi phục an toàn

Khôi phục trước vào máy/checkout và project Docker cô lập, không dùng volume của lab chính. **Chưa diễn tập restore**, không tuyên bố đã khôi phục thành công.

1. Xác minh manifest complete, scope, hash và thời điểm backup; ghi rõ có đồng bộ các kho hay không.
2. Audit có công cụ tạo project mới, không publish port, không thay DB đang dùng:

```powershell
python scripts/restore_audit_week10.py backups/TEN_BACKUP --project iam-recovery-audit-01
```

Tên đã có container/volume/network bị từ chối. Công cụ chỉ restore Audit, không chứng nhận toàn hệ thống. Nếu fail, giữ tài nguyên cô lập để kiểm tra, không tự xóa.

3. Keycloak: tạo PostgreSQL volume mới cùng major version, `pg_restore --exit-on-error --no-owner --no-privileges` dump `keycloak.pgdump` vào DB mới; chỉ nối Keycloak phục hồi với DB mới. Không dùng `--clean` lên DB thật.
4. LDAP: giữ bản private config/cert phù hợp, tạo volume mới; khi slapd đã dừng trên bản phục hồi, nhập `directory.ldif` bằng slapadd theo cấu hình tương ứng và đặt owner đúng. Không chép MDB trực tiếp khi slapd đang ghi. Đọc note tuần 6 trước khi bật federation.
5. SQLite: dùng file `attendance.sqlite` trong backup (được tạo bằng SQLite backup API). Chép vào đường `ATTENDANCE_DB` của checkout cô lập khi backend chưa chạy. Không chép WAL đang mở từ lab chính.
6. Phục hồi config vào checkout cô lập, đổi hostname/client redirect cho môi trường phục hồi bằng bước có ghi nhận, không ghi đè realm lab chính. Giữ UUID nguồn audit trong SQLite.
7. Nếu SQLite và Audit DB khác điểm thời gian: giữ writer dừng, đối chiếu số liệu rồi reset `audit_outbox.delivered_at=NULL` trên **bản SQLite phục hồi** để replay idempotent; không reset UUID nguồn. Việc replay có thể nhập lại dữ liệu đã dọn theo retention, cần quyết định chính sách trước.
8. Bảo toàn hold/cutoff/grant trạng thái; thu hồi phiên/token cũ trước mở truy cập. Đối chiếu JCL partial/source_write với nguồn, không tự chuyển sang active.
9. Chỉ chuyển endpoint sang bản phục hồi sau khi hoàn thành checklist bảo mật và chủ dự án quyết định. Chưa có bước chuyển nào được thực hiện ở đây.

## Điều kiện chốt release

Source freeze hiện tại có nghĩa ngừng thêm công nghệ lớn để chuẩn bị nghiệm thu. Chỉ chốt release đã xác nhận khi: migration/build thành công; test bắt buộc đạt; có dataset/metrics thật; backup/restore đã diễn tập; CA hai máy tin cậy; demo đủ tám bước; không còn lỗi nghiêm trọng; báo cáo/slide cập nhật đúng bằng chứng. Hiện các điều kiện này còn chờ theo yêu cầu chưa kiểm thử.
