## 2. Những vấn đề còn thiếu cần giải quyết

| Thiếu sót                                           | Mức quan trọng          | Hướng xử lý                                                |
| --------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Chưa hoàn tất OTP đúng/sai/hết hạn                  | Rất cao                 | Hoàn thiện trong tuần 5                                    |
| Chưa kiểm thử đầy đủ refresh token                  | Rất cao                 | Bổ sung test token lifecycle                               |
| Chưa xác minh đăng nhập HTTPS từ máy khách thứ hai  | Cao                     | Test trên hai thiết bị                                     |
| Keycloak đang chạy `start-dev`                      | Cao                     | Tăng cường cấu hình triển khai, thử nghiệm production mode |
| Cơ chế collector có nguy cơ bỏ sót log              | Cao                     | Bổ sung checkpoint, backfill và retry                      |
| Service account có quyền quản trị khá rộng          | Cao                     | Rà soát Least Privilege                                    |
| Audit còn lưu trong SQLite                          | Trung bình–cao          | Thiết kế chuyển sang PostgreSQL ở tuần 8                   |
| LDAP/AD chưa được tích hợp                          | Cao với đề tài nâng cao | Dự kiến tuần 6                                             |
| Python Detection chưa có                            | Cao với đề cương        | Dự kiến tuần 8–9                                           |
| Phục hồi lỗi đồng bộ Keycloak–SQLite cần hoàn thiện | Cao                     | Bổ sung quản trị thao tác `PARTIAL`                        |

Một điểm quan trọng: Giai đoạn tuần 5 cần tập trung củng cố tính đúng đắn và an toàn của chức năng hiện có. Không nên vội thêm quá nhiều màn hình mới khi những luồng xác thực quan trọng chưa được xác minh đầy đủ.

## Trạng thái triển khai ngày 04/11/2026

Đã bổ sung mã nguồn cho MFA/TOTP, kiểm soát required actions, refresh/phiên, đối chiếu PARTIAL, collector có checkpoint, các nâng cấp Web A/B và gateway. Có script backup/setup/rollback và profile Keycloak production-like riêng.

**Theo yêu cầu mới nhất: chưa chạy kiểm thử hoặc build, chưa áp dụng flow/dữ liệu lên lab đang chạy.** Các mục liên quan OTP thật, browser, refresh lifecycle và HTTPS máy khách thứ hai vẫn chờ nghiệm thu; không ghi 69/69 đã hoàn thành.

- [Chi tiết triển khai và cách áp dụng/khôi phục](docs/TUAN_5_TRIEN_KHAI.md).
- [Danh mục nghiệm thu — tất cả Actual đang để Chưa chạy](docs/TUAN_5_NGHIEM_THU.md).

Checklist bên dưới là kế hoạch gốc; trạng thái thay đổi mã nguồn và trạng thái nghiệm thu được ghi riêng trong hai tài liệu trên.

## 3. Kế hoạch tuần 5 – Phát triển mở rộng toàn hệ thống

TUẦN 5 · SECURITY HARDENING & UI/UX

# 7 ngày triển khai

18 nhóm công việc

Phân bố khối lượng đề xuất cho hai thành viên. Các đầu việc có thể triển khai song song nhưng phải tích hợp và kiểm thử cùng nhau.

Ngày 1

MFA và chính sách xác thực

Ngày 2

Token, session, logout

Ngày 3

Bảo vệ API và quản trị danh tính

Ngày 4

Web A – Nâng cấp UI/UX

Ngày 5

Web B – Security Dashboard

Ngày 6

HTTPS, mạng và giám sát

Ngày 7

Kiểm thử, bằng chứng, báo cáo

Dưới đây là checklist chi tiết để bạn đánh dấu trực tiếp. Mình phân loại:

- P0: Phải hoàn thành trong tuần 5.
- P1: Nên hoàn thành nếu muốn đồ án có chiều sâu và giao diện tốt.
- P2: Nâng cao, có thể chuyển sang tuần sau.

## Checklist triển khai tuần 5

69 đầu việc · 7 ngày · 2 thành viên

# Chưa nghiệm thu 69 đầu việc

Đã bổ sung mã nguồn theo phạm vi triển khai; chưa chạy kiểm thử nên chưa tính tỷ lệ nghiệm thu.

Tất cảP0P1P2

Chỉ việc chưa hoàn thành

&#x20;Sao chép checklist

Ngày 1 – MFA & Authentication PolicyIAM / Keycloak0/10

Sao lưu cấu hình Realm, PostgreSQL và SQLite trước khi thay đổi authentication flow.

P0

Kiểm tra Authentication → Required Actions, OTP Policy và Browser Flow hiện tại.

P0

Tạo bản sao Browser Flow để thử nghiệm; không chỉnh trực tiếp flow đang hoạt động khi chưa có phương án khôi phục.

P0

Bắt buộc TOTP cho tài khoản demo được chọn; không chỉ gán CONFIGURE_TOTP mà còn thực sự đăng ký thiết bị.

P0

Kiểm thử OTP đúng, sai, thiếu, hết hạn và OTP đã được sử dụng trước đó.

P0

Kiểm thử đăng nhập Web A, Web B sau khi MFA hoàn tất; bảo đảm SSO không yêu cầu OTP lại ngoài chính sách phiên.

P0

Xác minh tài khoản chưa hoàn tất Required Action không được truy cập API được bảo vệ.

P0

Thiết kế quy trình thay đổi hoặc mất thiết bị MFA, yêu cầu xác thực lại và ghi audit.

P1

Tạo giao diện trạng thái MFA: đã bật, chưa bật, cần cấu hình lại, thời điểm cập nhật.

P1

Thử WebAuthn/Passkey trên một nhóm người dùng test riêng.

P2

Ngày 2 – Token Lifecycle, Session & SSOBackend / Identity0/10

Kiểm thử access token hết hạn trong khi refresh token còn hiệu lực.

P0

Kiểm thử refresh token hết hạn, bị thu hồi hoặc phiên Keycloak đã kết thúc.

P0

Thử logout Web A → Web B và Web B → Web A, giữ token snapshot để kiểm tra backend.

P0

Kiểm thử việc disable account và revoke session khi token JWT cũ vẫn còn hạn.

P0

Đối chiếu độ trễ cache phiên 5 giây và polling giao diện 15 giây với kết quả thực tế.

P0

Kiểm thử Keycloak ngừng hoạt động; API không được tự cho phép khi không xác minh được trạng thái cần thiết.

P0

Nâng cấp giao diện quản lý phiên: thiết bị, ứng dụng, thời gian gần nhất, nút kết thúc phiên.

P1

Bổ sung kiểm soát refresh lỗi để tránh vòng lặp đăng nhập hoặc gửi lặp POST/PATCH.

P1

Thiết kế màn hình thông báo hết phiên và chuyển về đăng nhập rõ ràng.

P1

Thử chính sách step-up authentication cho thao tác quản trị nhạy cảm.

P2

Ngày 3 – API Authorization & Identity OperationsBackend / Security0/10

Rà soát endpoint theo Role, Client, Team, Owner, trạng thái tài khoản và trạng thái nghiệp vụ.

P0

Kiểm thử Employee gọi Admin API, Auditor cố thực hiện thao tác ghi, Manager truy cập khác nhóm.

P0

Kiểm tra các trường hợp IDOR/BOLA, mass assignment và thao túng dữ liệu request.

P0

Kiểm tra việc cập nhật Role có chặn token chứa quyền cũ và phản ánh trạng thái đồng bộ.

P0

Rà soát quyền service account attendance-control và các quyền realm-management thực sự cần.

P0

Kiểm thử trạng thái PARTIAL/202 và luồng đối chiếu khi Keycloak cập nhật thành công nhưng SQLite thất bại.

P0

Thêm giao diện hiển thị lịch sử thay đổi tài khoản với người thao tác, lý do, kết quả.

P1

Thêm chức năng xem chi tiết quyền hiệu lực của từng user từ Role và phạm vi dữ liệu.

P1

Thêm màn hình quản trị thao tác pending/partial, cho phép đối chiếu và xử lý lại an toàn.

P1

Thiết kế cơ chế yêu cầu phê duyệt hai người cho hành động cấp quyền cao.

P2

Ngày 4 – Web A – Workspace UI/UXFrontend / UX0/10

Kiểm tra đầy đủ desktop, tablet, mobile, không tràn bảng và không che menu.

P0

Chuẩn hóa loading, empty state, validation, error state, confirm dialog và thông báo kết quả.

P0

Kiểm tra khả năng sử dụng bằng bàn phím, focus, tương phản và nhãn trường nhập.

P0

Thiết kế lại Dashboard theo Role: Employee, Manager, Admin, Auditor.

P1

Thêm KPI cá nhân: số ngày công, lần đi muộn, đơn đang chờ, đơn được duyệt.

P1

Thêm biểu đồ chấm công tuần/tháng và xu hướng đi muộn dựa trên dữ liệu thật.

P1

Xây dựng giao diện lịch công dạng Calendar và xem chi tiết theo ngày.

P1

Thêm thanh tiến trình xử lý đơn và lịch sử duyệt/từ chối.

P1

Bổ sung trang hồ sơ, phiên đăng nhập và trạng thái bảo mật tài khoản.

P1

Thêm dark mode, tùy chỉnh bố cục Dashboard và lưu lựa chọn giao diện.

P2

Ngày 5 – Web B – Security Dashboard UI/UXFrontend / Security0/10

Đảm bảo mọi trang và API của Web B chỉ cho Admin/Auditor theo quyền đã định.

P0

Kiểm tra tính chính xác giữa số liệu Dashboard và bản ghi SQLite, không dùng KPI giả.

P0

Hoàn thiện trạng thái loading/error khi Keycloak hoặc collector không hoạt động.

P0

Xây dựng KPI: login success/failure, ALLOW/DENY, phiên hoạt động, tài khoản bị khóa, cảnh báo mở.

P1

Thêm biểu đồ đăng nhập theo thời gian và phân bố sự kiện bảo mật.

P1

Thiết kế trang điều tra sự kiện theo request ID và timeline liên quan.

P1

Bổ sung bộ lọc nâng cao: Role, User, Client, IP, Event Type, Severity, thời gian.

P1

Thêm trang chi tiết cảnh báo: nguồn, bằng chứng, mức độ, trạng thái, người điều tra.

P1

Thêm báo cáo ma trận quyền User–Role–Resource và xuất CSV an toàn.

P1

Xây dựng bản đồ tương quan sự kiện/phiên hoặc sơ đồ luồng truy cập trực quan.

P2

Ngày 6 – HTTPS, Security Headers & ReliabilityInfrastructure / Security0/10

Kiểm tra HTTPS gateway trên localhost và chế độ LAN với hostname/IP đúng SAN.

P0

Kiểm tra máy khách thứ hai tin cậy CA, đăng nhập, SSO và gọi API thành công.

P0

Rà soát Host header, Forwarded/X-Forwarded-\* và giới hạn đường dẫn trên gateway.

P0

Rà soát CORS, Content Security Policy, HSTS trên HTTPS, X-Content-Type-Options và Referrer-Policy.

P0

Kiểm tra không công khai PostgreSQL, API quản trị hoặc Keycloak Admin Console ngoài phạm vi cần thiết.

P0

Kiểm tra không đưa secrets, access token, OTP secret, QR và dữ liệu nhạy cảm vào log hoặc Git.

P0

Tạo một profile triển khai Keycloak production-like bằng cấu hình riêng, không thay thế lab hiện tại trước khi test.

P1

Xây dựng health/readiness cho gateway, backend, Keycloak và database.

P1

Thêm retention/rotation và checkpoint cho collector, nhận diện khoảng thời gian log bị bỏ sót.

P1

Kiểm thử khôi phục từ backup và xây dựng hướng dẫn disaster recovery.

P2

Ngày 7 – Regression, Evidence & DocumentationCả hai thành viên0/9

Chạy lại backend npm test, frontend/API client test và hai bản build.

P0

Chạy lại browser test SSO, UI và operations trên môi trường sạch đã sao lưu.

P0

Bổ sung test tích hợp MFA thật, refresh token và HTTPS trên máy thứ hai.

P0

Lập bảng expected/actual/status cho từng trường hợp, ghi request ID và log tương ứng.

P0

Kiểm tra dữ liệu demo sau kiểm thử: user bị khóa, OTP required action, đơn, phiên và trạng thái PARTIAL.

P0

Lưu ảnh màn hình Web A/B, Keycloak flow và bằng chứng API; che thông tin bí mật.

P0

Xuất backup, ghi phiên bản Keycloak, Node, Docker, dependency và commit mã nguồn.

P0

Viết báo cáo tuần 5: mục tiêu, thay đổi, test case, kết quả, lỗi còn tồn tại, hướng tuần 6.

P0

Quay video demo 10–15 phút và diễn tập các kịch bản bảo vệ.

P1

Mở tất cảThu gọnĐặt lại

## 4. Các chức năng mở rộng mình khuyên bổ sung

Ngoài checklist tuần 5, dưới đây là những nâng cấp giúp hai website mang dáng dấp một hệ thống doanh nghiệp thực tế, không chỉ là giao diện để kiểm thử Keycloak.

### Web A – Nhịp Workspace

[Attendance Dashboard UI by Nurhalimah on Dribbble](https://images.openai.com/static-rsc-4/tWFD4QuoEDxhVNVPDtWBK4H0gLqiuW_J6TaqJQHRJV-2l2-VQKeaewuIDDiHdQ8RPqkguE-eN9JTMfxVqJ4Z17u9uWZvg7aZ05O3QU-cnVnbkR8vhLeZsKBQBl5u-vqgRzrOXhF3ki6Iq7wIxVT76TDacp5AlZv0dSIpcxmx7a0?purpose=inline)

Dashboard cá nhân hóa

Chào theo tên và vai trò, các KPI ngày công, đi muộn, đơn đang chờ, biểu đồ hoạt động. Mỗi vai trò nhìn thấy thông tin đúng phạm vi.

[SkizzleHR Attendance Software – Track Employee Hours](https://images.openai.com/static-rsc-4/OtwrbmFbcG7tvcrCpCJjPG7-h0mPgoRs_wvjYMzUIU20S2zBfXAblB9c25nT5xnDE4jT4SOY-AqnOn6D11UiV1r3Wtan-OZkzg7ozPVC4lmCzTBjSDmWDKl-1AEHURZ2Ydy58KcmzbC5APLe8mTGBj5CjCUwh6MPvXJhGcxnvsQ?purpose=inline)

Lịch chấm công thông minh

Calendar tháng, ngày đi làm/đi muộn, xem chi tiết ngày, lọc theo thời gian và trạng thái đơn điều chỉnh.

[Two-factor Authentication Projects :: Photos, videos, logos, illustrations and branding :: Behance](https://images.openai.com/static-rsc-4/bEVeCBoH2r3Jyy1XbmfyPoqW2kzLPeM2qnqbj4tVnbdryHnofmnBLBp3Ry7OWIfs6qLayS3FpdnZpq5GeZ3QLH9ayBshxVVhmQy-jTBPDlHiPkICJu1UHBHK6Br7L3ZZNwEwhHjkVQmlVBY3DWZTaV-sdKRF5k3cCE9na1tdUvU?purpose=inline)

Trung tâm bảo mật tài khoản

Hiển thị trạng thái MFA, các phiên hoạt động, lịch sử đăng nhập gần đây, thiết bị đang dùng và chức năng kết thúc phiên.

### Web B – Nhịp Security

[Evaluating Security Alerts: A day In a Security Operations Centre | by Glorious Israel | Jan, 2026 | Medium](https://images.openai.com/static-rsc-4/-7VXOkYvg__tXfYn90zuZFiyaSAyTl7EeTgQwS-F69aoYBf_nVIzWCVUWUSAY8URSn5YmHe9C1Kk5xqWSlFE1Rmi8hh3awP1fXp4han6QuPPHmRPeKdJN78EMY2d8lpkx_yywEMfFnG3VHc3gwaUhqw0gxYI-5XYHjsC_6dltg0?purpose=inline)

Security Overview

Các chỉ số đăng nhập, sự kiện từ chối truy cập, số người dùng hoạt động, cảnh báo mức độ cao và biểu đồ theo thời gian.

[Cybereason - AI-Driven XDR Platform | MDR | Retainers](https://images.openai.com/static-rsc-4/Kk14dbOkWO55ceFEtEWUk_0EoCXQKkYzSr2lHRs3D1fAuOegNz-u9s1qzLk5KcYnxf7UjgZo2rt0HYJ6NPTgP2zDnExYLUMFNEudTGxQJUL1l4lBtMZpgWIl8CRXXSugdmYh_8PDxHguywA7c0xmsy4VjpUV29_wRy-m0DZChPQ?purpose=inline)

Security Investigation

Chi tiết sự kiện, request ID, tài khoản, client, địa chỉ IP, chuỗi sự kiện và lịch sử xử lý cảnh báo. Có thể mở rộng workflow phân công điều tra.

[AdminOS: Redesigning Role Management for the Modern Enterprise | by Manvendra Pratap | Dec, 2025 | Medium](https://images.openai.com/static-rsc-4/A1NR_0obGn7lfqexlMhHejpjFtbssgBFK6r-8MAD_ukVadKEMQGi1Rv2Ke8MOvWRa4TMgnvaF2jnZC-YvFjPqOoAHYknex7HiascGf3MK7kmGa6_NIUmp060cNnmbkLOep0lkvMr2wwFSSqGWSnT53cpgndJDi9P5wGQfJVt0Jk?purpose=inline)

Access Governance

Ma trận quyền, lịch sử thay đổi vai trò, trạng thái đồng bộ tài khoản, các phiên đã thu hồi và bảng đối chiếu quyền theo nhóm.

Các hình trên chỉ minh họa hướng thiết kế. Khi triển khai, nên giữ hệ màu và component hiện tại, tránh thay toàn bộ UI làm hỏng các luồng đã có.

## 5. Các yêu cầu bảo mật cần đạt ở tuần 5

### A. MFA phải là cơ chế kiểm soát thật

Hiện tại hệ thống có chức năng quản trị yêu cầu người dùng cấu hình TOTP, nhưng điều đó chưa chứng minh người dùng bắt buộc qua OTP mới có thể đăng nhập.

Cần kiểm tra cả Required Action lẫn Authentication Flow, rồi xác minh kết quả trên Web A và Web B. Keycloak cho phép cấu hình OTP và WebAuthn trong Browser Flow; cách đặt Required/Conditional quyết định người dùng có bị yêu cầu yếu tố thứ hai hay không.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak



Bộ test MFA tối thiểu:

| Mã     | Kịch bản                     | Kết quả kỳ vọng                 |
| ------ | ---------------------------- | ------------------------------- |
| MFA-01 | Tài khoản chưa cấu hình TOTP | Buộc hoàn tất đăng ký           |
| MFA-02 | Nhập TOTP đúng               | Đăng nhập thành công            |
| MFA-03 | Nhập TOTP sai                | Không cấp phiên đăng nhập       |
| MFA-04 | Nhập TOTP hết hạn            | Bị từ chối                      |
| MFA-05 | Bỏ qua bước TOTP             | Không truy cập được tài nguyên  |
| MFA-06 | Revoke sau đăng nhập MFA     | API từ chối phiên cũ            |
| MFA-07 | SSO A → B sau MFA            | Hoạt động theo chính sách phiên |
| MFA-08 | Yêu cầu cấu hình lại MFA     | Có xác minh và Audit Log        |

Nên triển khai thêm quy trình khôi phục khi mất thiết bị MFA. Không cho phép chỉ nhập username rồi tự bỏ OTP. OWASP cũng khuyến nghị bảo vệ chặt việc thay đổi yếu tố xác thực và cân nhắc các phương thức chống phishing như passkeys.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://cheatsheetseries.owasp.org\&sz=32)

OWASP Cheat Sheet Series



### B. Hoàn thiện triển khai HTTPS an toàn

Hệ thống hiện dùng Keycloak `start-dev` sau gateway HTTPS. Cách này chấp nhận được để phát triển trong lab, nhưng chưa phải cấu hình sản xuất.

Đề xuất thêm một profile `production-like` riêng để kiểm thử:

- Khởi chạy Keycloak bằng `start` thay vì `start-dev`.
- Cấu hình hostname chuẩn, HTTPS và proxy headers.
- Giới hạn giao diện Admin Console khỏi máy khách không cần quyền.
- Kiểm tra kết nối thật từ máy thứ hai.
- Bảo đảm gateway không tin những forwarding header do client tùy ý gửi.

Keycloak phân biệt rõ development mode và production mode, đồng thời khuyến nghị bảo vệ giao diện Admin Console và cấu hình reverse proxy cẩn thận.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak+2



Không đổi trực tiếp cấu hình đang chạy ổn định. Nên sao lưu và thử trên một cấu hình độc lập trước.

### C. Bổ sung Security Regression Tests

Tài liệu hiện có đã bao phủ khá nhiều tình huống RBAC, IDOR, input validation, session và lỗi đồng bộ. Vì vậy, không cần tạo lại những bài test giống hệt. Thay vào đó, bổ sung các nhánh chưa được xác nhận như TOTP thực tế, refresh token, HTTPS ở máy khách và cấu hình triển khai mới.

Với các chức năng quan trọng, mỗi test cần có:

- Input và trạng thái ban đầu.
- Expected HTTP status.
- Actual HTTP status.
- Request ID để đối chiếu.
- Audit Log hoặc Keycloak Event.
- Xác nhận dữ liệu không thay đổi khi request bị từ chối.

## 6. Các file mã nguồn hiện có nên chỉnh ở đâu?

Dựa trên bản đồ mã nguồn trong tài liệu, bạn không cần tạo dự án mới. Nên chỉnh theo cấu trúc hiện tại:

| File/thư mục                 | Nhiệm vụ tuần 5                                      |
| ---------------------------- | ---------------------------------------------------- |
| `backend/auth.js`            | Kiểm thử refresh, session, revoke và token           |
| `backend/app.js`             | Rà soát authorization, validation, API errors        |
| `backend/operations.js`      | Thêm trạng thái MFA, lịch sử và đối chiếu hành động  |
| `backend/keycloak-admin.js`  | Rà soát quản trị MFA, User và Session                |
| `backend/identity-events.js` | Bổ sung cơ chế thu thập sự kiện tin cậy              |
| `backend/store.js`           | Bổ sung dữ liệu báo cáo, lịch sử, checkpoint nếu cần |
| `web-a/src/`                 | Dashboard, lịch công, hồ sơ, phiên, UI/UX            |
| `web-b/src/`                 | Security Analytics, điều tra, ma trận quyền          |
| `shared/ui.*`                | Component thống nhất và responsive                   |
| `shared/sso.js`              | Trạng thái phiên, refresh, logout                    |
| `network/gateway.js`         | TLS, headers, host, reverse proxy                    |
| `tests/`                     | Test MFA, API, UI, SSO và HTTPS                      |

Không nên sửa `backend/audit.js` với giả định đó là nguồn log chính, vì tài liệu xác nhận luồng nghiệp vụ hiện nay lưu audit qua `backend/store.js`.

## 7. Tiêu chí nghiệm thu cuối tuần 5

Để coi tuần 5 hoàn thành, mình đề xuất các kết quả bắt buộc sau:

| Sản phẩm      | Điều kiện nghiệm thu                                             |
| ------------- | ---------------------------------------------------------------- |
| MFA           | Bộ 8 test MFA đạt trên tài khoản thử                             |
| SSO           | Hai Web tiếp tục SSO đúng sau thay đổi authentication flow       |
| RBAC          | Không có hồi quy ALLOW/DENY, team/owner                          |
| Token/session | Test đầy đủ refresh, hết hạn, logout, revoke                     |
| Web A         | Giao diện ổn định desktop/mobile, không lỗi chức năng cũ         |
| Web B         | Dashboard và bộ lọc hoạt động bằng dữ liệu thực                  |
| HTTPS         | Máy khách thứ hai truy cập, đăng nhập và dùng API qua TLS hợp lệ |
| Audit         | Sự kiện MFA, logout và từ chối quyền có thể truy vết             |
| Kiểm thử      | Toàn bộ test cũ vẫn đạt và test mới có biên bản                  |
| Báo cáo       | Có ảnh, bảng test, sơ đồ, mô tả thay đổi và các giới hạn còn lại |

### Thứ tự làm tối ưu

Năm đầu việc nên thực hiện trước tiên

1. Sao lưu dữ liệu và chạy lại test hiện tại để có mốc so sánh trước khi sửa.
2. Hoàn thiện MFA TOTP trên Keycloak, kiểm thử đăng ký thiết bị, OTP đúng/sai và SSO.
3. Kiểm thử token lifecycle và session để đảm bảo các cơ chế hiện tại không bị hồi quy sau MFA.
4. Nâng cấp Web A/B bằng component chung, báo cáo dữ liệu thật và giao diện bảo mật tài khoản.
5. Kiểm thử HTTPS hai máy và tổng hợp minh chứng để hoàn thiện báo cáo tuần 5.

Phần LDAP/AD, chuyển Audit sang PostgreSQL và Python Detection nên giữ theo kế hoạch tuần 6–9. Chúng quan trọng đối với mục tiêu cuối cùng, nhưng triển khai hết ngay tuần 5 sẽ tạo quá nhiều thay đổi trên các thành phần đang hoạt động.

Đánh giá cuối cùng: Bạn không thiếu nhiều chức năng nền tảng nữa. Điều quan trọng bây giờ là biến hệ thống từ một demo IAM có nhiều tính năng thành một hệ thống có cơ chế xác thực được kiểm chứng, giao diện quản trị thuyết phục, khả năng xử lý lỗi tốt và bằng chứng kiểm thử rõ ràng. Nếu hoàn thành tốt tuần 5 theo các mục P0 rồi chọn thêm những phần P1 hữu ích, đồ án sẽ có nền tảng rất tốt để tiếp tục LDAP, giám sát tập trung và phát hiện bất thường.
