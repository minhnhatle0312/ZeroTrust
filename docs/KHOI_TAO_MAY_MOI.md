# Khởi tạo ZeroTrust trên máy mới — giữ đúng ID danh tính

Cập nhật 12/11/2026. Quy trình này dành cho **một cài đặt mới, chưa có SQLite nghiệp vụ**. Các lệnh provisioning bên dưới có tạo cấu hình và dữ liệu IAM khi người vận hành thực hiện; agent chưa chạy chúng trên môi trường thật trong lượt sửa này. Không dùng quy trình này để sửa máy `D:\ZeroTrust` hiện có năm hồ sơ lệch ID. Trường hợp đó tiếp tục theo [đối soát ID](DOI_SOAT_ID_TAI_KHOAN_DEMO.md), cần xác nhận riêng trước apply.

## Nguyên nhân và nguyên tắc

ID tài khoản do Keycloak cấp, không cố định theo username. Realm tạo trên máy khác có thể có cùng `employee01` nhưng UUID khác. Trước bản sửa, setup tuần 2 ghi đè `staff.json`, Backend chỉ `INSERT ... ON CONFLICT(id) DO NOTHING`; không kiểm tra sự thống nhất của Keycloak, seed và SQLite. Seed cũ trên DB mới tạo hồ sơ sai `sub`; SQLite cũ với seed mới có thể lỗi unique username hoặc giữ ID cũ. `run_week3.py` còn tự gọi setup mỗi lần chạy và import setup tuần 2 từng kéo theo ghi `.env` qua `init_env`.

Đây là các đường lỗi được chứng minh từ source và fixture; chưa có bằng chứng xác định thao tác quá khứ nào đã làm năm tài khoản trên máy hiện tại đổi ID.

Sau sửa:

- Setup tuần 1/2/3 dừng trước provisioning nếu có SQLite hoặc sidecar WAL/SHM/journal theo đường dẫn cấu hình. Không xóa chúng để vượt chặn. Setup chỉ được lặp trước lần chạy Backend đầu tiên và chỉ khi seed cũ vẫn khớp chính xác danh tính đã xác minh.
- Seed được lấy từ lookup username chính xác và duy nhất trong Keycloak, xác minh nguồn local, enabled, effective role; không tạo UUID local, không ghép LDAP hoặc tài khoản service. Xác minh xong cả sáu mới xuất file, công bố file nguyên vẹn bằng hard link cùng filesystem, không ghi đè seed đã có. Nếu filesystem không hỗ trợ thao tác này thì dừng, không thay bằng ghi đè thiếu an toàn.
- Backend kiểm tra trước khi mở database để ghi/migrate: seed hợp lệ và đầy đủ cho sáu tài khoản, ID/username khớp SQLite khi DB có dữ liệu, ID/username của danh tính local đang active khớp Keycloak. Khi tạo lần đầu còn kiểm tra enabled/effective role. Không liên lạc được IAM hoặc phát hiện lệch thì dừng trước nạp hồ sơ, đổi pending action hoặc chạy collector.
- Lần đầu nạp cả sáu hồ sơ trong một transaction. Khởi động lại không nạp bổ sung từ seed, không sửa role/team/MFA/revocation hoặc hồ sơ đã có. Thay đổi role có chủ đích trong DB không bị seed cũ đảo ngược. Với DB đã hoạt động, kiểm tra role/quyền/MFA vẫn diễn ra theo middleware; kiểm tra startup tập trung vào liên kết ID. Hồ sơ disabled/đang hold/đã nghỉ việc không bị ép khôi phục trên IAM; danh tính LDAP tiếp tục do quy trình Directory hiện có quản lý.
- Backend vẫn xác thực `JWT.sub = staff.id`; không fallback username hoặc bỏ `UNREGISTERED`. Runner chỉ khởi động, không tự provision. Transport setup tái sử dụng refresh token và GET retry của công cụ repair, không tự replay ghi khi 401.

## Chuẩn bị bản source

Chuyển source qua gói đã lọc của dự án hoặc checkout sạch. Không sao chép `.env`, `backend/data`, SQLite/WAL/SHM, `staff.json`, backup, token hoặc dữ liệu LDAP từ máy khác vào cài đặt mới. Nếu mục tiêu là chuyển cả hệ thống có dữ liệu sang máy khác, cần kế hoạch backup/restore IAM và nghiệp vụ nhất quán riêng; không trộn DB cũ với realm mới.

Cần Node.js 22.19+ (có `node:sqlite`), Python 3.11+, Docker Desktop/Linux containers. Cài dependencies bằng `npm.cmd ci` trong `backend`, `web-a`, `web-b` khi được phép. Không cần đổi lockfile.

## Thứ tự triển khai mới trên localhost

Chỉ thực hiện sau khi người vận hành cho phép tạo môi trường mới. Tại thư mục source mới:

```powershell
python -B scripts/init_env.py
docker compose up -d
```

`init_env.py` chỉ tạo giá trị/file thiếu, không thay secret có sẵn; cấu hình đủ Backend, Web A và Web B. Import module không chạy initialization. Không chép mật khẩu vào báo cáo. Nếu có giá trị rỗng từ template, điền cục bộ theo thông báo; script không tự thay giá trị đã có.

Chờ discovery công khai của Keycloak trả thành công:

```powershell
Invoke-RestMethod http://localhost:8080/realms/master/.well-known/openid-configuration
```

Provision **một lần trước khi khởi động Backend**:

```powershell
python -B scripts/setup_week3.py
```

Lệnh này gọi chuỗi setup Keycloak/tuần 2/tuần 3: tạo các thành phần IAM được mô tả trong source, service client, tài khoản demo và hai client Web A/B; lưu credential service vào `backend/.env`, xuất `backend/data/staff.json` từ ID thực vừa xác minh. Không tạo SQLite nghiệp vụ. Nếu dừng giữa chừng, chưa được khởi động Backend như thể setup đã hoàn tất; đọc thông báo, sửa nguyên nhân rồi chạy lại khi **chưa có SQLite**. Không dùng lại chuỗi này để nâng cấp môi trường đã hoạt động.

Kiểm tra chỉ đọc trước lần chạy đầu:

```powershell
node backend/server.js --check-bootstrap
```

Đường dẫn `.env` mặc định được neo vào thư mục Backend dù chạy từ root; `IAM_BACKEND_ENV` vẫn là lựa chọn môi trường rõ ràng cho Backend. Check dùng service credential và các GET Admin API; token endpoint dùng POST xác thực. Không mở DB để ghi, không migrate/nạp seed, không bind cổng, không chạy collector, không ghi cấu hình Keycloak/LDAP. Thành công in `Bootstrap identity check passed; no database writes.`. Không có flag bỏ qua kiểm tra này. Trên môi trường có collector riêng đang chạy, việc xác thực IAM có thể được ghi nhận vào audit của môi trường đó.

Sau check thành công:

```powershell
python -B scripts/run_week3.py
```

Runner không gọi setup nữa, kiểm tra bootstrap trước khi mở ứng dụng. Backend tự kiểm tra lại khi start để không chỉ dựa vào kết quả check trước đó. Lần chạy này mới tạo schema SQLite và nạp hồ sơ đã xác minh. Mặc định Web A `http://localhost:5173`, Web B `http://localhost:5174`, API cổng 3001. Dùng localhost nhất quán theo cấu hình, không trộn sang 127.0.0.1/HTTPS để né lỗi origin.

Đây là đường triển khai lõi Web A/B + IAM + SQLite. Audit PostgreSQL, LDAP/LDAPS và HTTPS là các bước riêng trong [tuần 6](TUAN_6_TRIEN_KHAI.md), [tuần 7](TUAN_7_TRIEN_KHAI.md), [tuần 8](TUAN_8_TRIEN_KHAI.md), [triển khai tuần 9](TUAN_9_TRIEN_KHAI.md). `run_week10.py` dành cho stack đầy đủ đã cấu hình, không tự bổ sung các dịch vụ này. Không nhập LDAP vào seed sáu tài khoản local.

## Các điểm dừng cần xử lý

| Thông báo | Ý nghĩa và xử lý |
|---|---|
| `Existing SQLite detected` | Đang dùng setup trên môi trường đã có DB/sidecar. Dừng provisioning, không xóa DB. Dùng luồng khởi động hoặc bảo trì đã được phê duyệt. |
| `Existing staff.json differs` | Seed thuộc danh tính/cấu hình khác. Giữ nguyên file, xác định đúng máy/realm; không ghi đè để cho setup chạy tiếp. |
| `BOOTSTRAP_SEED_REQUIRED` / `SEED_INVALID` | Cài đặt mới chưa có seed hợp lệ/đầy đủ. Hoàn tất provisioning đúng thứ tự trên máy mới; không tự viết UUID vào seed. |
| `BOOTSTRAP_LOCAL_ID_MISMATCH` | Seed và hồ sơ SQLite không cùng ID. Cần đối soát có backup và phê duyệt riêng. |
| `BOOTSTRAP_KEYCLOAK_ID_MISMATCH` | ID/username không khớp IAM hoặc gặp danh tính federated. Xác minh đúng realm/issuer và nguồn dữ liệu; không nới auth. |
| `BOOTSTRAP_IDENTITY_UNAVAILABLE` | IAM không truy cập được, credential/quyền service sai, hoặc lookup không duy nhất. Kiểm tra IAM/service client; không chạy lại setup/reset mật khẩu trên hệ thống đã có dữ liệu. |
| `BOOTSTRAP_ROLE_MISMATCH` | Role hoặc trạng thái enabled không đúng cho lần nạp đầu. Kiểm tra provisioning, không ép local role để vượt lỗi. |
| `BOOTSTRAP_LOCAL_CHANGED` | Seed/hồ sơ đổi trong khoảng kiểm tra hoặc có hai lần start cạnh tranh. Dừng tác vụ cạnh tranh, kiểm tra lại; không ghi đè dữ liệu mới. |
| `BOOTSTRAP_RECOVERY_REQUIRED` | Có marker đồng bộ ID bị gián đoạn. Giữ hệ thống dừng, xử lý theo tài liệu đối soát đã phê duyệt. |
| `BOOTSTRAP_DATABASE_INVALID` / `ORPHAN_DATA` | SQLite/FK không toàn vẹn hoặc có dữ liệu nhưng không có staff. Điều tra/khôi phục có kiểm soát; không coi là DB mới để seed lại. |

Keycloak cần sẵn sàng khi start Backend; việc dừng nếu không xác minh được danh tính là chủ đích. Bản sửa không tự chữa dữ liệu lệch hiện tại. Nếu năm ID của máy hiện tại vẫn lệch, lần restart sẽ bị chặn; cần đối soát riêng trước vận hành phiên bản mới. Agent chưa restart hoặc apply trên máy đó.

## Kiểm thử và nghiệm thu

```powershell
python -B -m unittest discover -s tests -p test_bootstrap_profiles.py -v
```

13 test Python dùng IdP giả lập với ID sinh ngẫu nhiên; có test chạy tiếp seed xuất ra qua 20 test Node (`backend/bootstrap.test.js`) với SQLite/Express fixture. Kiểm tra setup mới, lặp setup trước start, không đè seed, chặn DB cũ trước mọi ghi IAM, LDAP/role/trùng ID, lỗi giữa chừng và rollback cả batch hồ sơ, import không tác động, runner không tự setup; kiểm tra production startup ở nhánh check-only bằng HTTP IAM giả lập. Sáu tài khoản qua verifier RS256 thật và `/api/profile` đúng ID/role; ID khác vẫn UNREGISTERED, role sai và employee truy cập Web B vẫn bị từ chối. Không dùng DB hoặc tài khoản thật làm fixture.

Không có transaction chung giữa Keycloak, seed và SQLite. Không chạy đồng thời provisioning/Backend hoặc thay realm trong lúc khởi tạo; cần kiểm tra login sau triển khai. Nếu về sau tài khoản bị xóa/tạo lại ở IAM thì vẫn cần đối soát riêng, không tự sửa dữ liệu nghiệp vụ theo username.

Sau triển khai mới được phép, cần đăng nhập thực tế cả sáu tài khoản để nghiệm thu: admin/manager/employee/auditor vào Web A đúng quyền; admin/auditor vào Web B; employee/manager bị từ chối Web B. Kiểm tra MFA/SSO/logout theo policy hiện hành, bảng công và quy trình nghiệp vụ riêng. Không công bố token/password/OTP hoặc dùng kết quả mocked để kết luận Docker/SSO/MFA thật đã đạt.
