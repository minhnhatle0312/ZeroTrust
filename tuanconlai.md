# ROADMAP TỔNG THỂ ĐỒ ÁN IAM – KEYCLOAK – ZERO TRUST

Timeline toàn bộ công việc còn lại: Tuần 5 → Tuần 10

**Cập nhật 08/11/2026:** đã áp dụng và chạy lab tuần 5–10, sửa lỗi tích hợp MFA/LDAP/Keycloak/Audit, kiểm thử backend, giao diện, JCL local/LDAP, Detection và phục hồi Audit. Xem [kết quả kiểm thử 08/11/2026](docs/KET_QUA_KIEM_THU_2026_11_08.md). Mốc chính thức **4/6**; chưa thay bằng chứng máy khách thứ hai bằng kiểm thử nhiều trình duyệt trên một máy.

Dựa trên tài liệu triển khai ngày 04/11/2026 bạn đã gửi, mình xây dựng kế hoạch tiếp tục phát triển Nhịp Workspace (Web A) và Nhịp Security (Web B) đến khi hoàn thành đồ án, bao gồm giao diện, chức năng nghiệp vụ, IAM, SSO, MFA, LDAP/Active Directory, Audit Log, phát hiện bất thường, kiểm thử và bảo vệ.

## 1. Hiện trạng dự án trước tuần 5

Theo tài liệu, nhóm đã triển khai hai website React, Keycloak/PostgreSQL bằng Docker, OIDC với PKCE S256, SSO hai chiều, RBAC theo vai trò/nhóm/chủ sở hữu, quản lý người dùng, phiên, thông báo, audit bằng SQLite và HTTPS gateway. Bộ backend có kết quả kiểm thử gần nhất 97/97 đạt; tuy nhiên, MFA chưa hoàn tất kiểm thử thực tế, LDAP và Python Detection chưa được triển khai, đồng thời chưa có Audit PostgreSQL tập trung.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



Do đó, từ tuần 5 trở đi không làm lại Web A, Web B, đăng nhập hoặc RBAC cơ bản, mà phát triển trên mã nguồn hiện tại.

## 2. Tổng quan timeline 6 tuần

LỘ TRÌNH ĐỀ XUẤT

## 6 tuần phát triển còn lại

Tuần 5–10

TUẦN

## 5

MFA + Security Hardening + UI/UX

Xác thực đa yếu tố, token, phiên, nâng cấp hai Web

TUẦN

## 6

LDAP / Active Directory Federation

Đồng bộ danh tính doanh nghiệp, nhóm, vai trò

TUẦN

## 7

Identity Lifecycle + Access Governance

Join/Change/Leave, phê duyệt quyền, đồng bộ trạng thái

TUẦN

## 8

Centralized Audit & Security Monitoring

PostgreSQL Audit, log collector, dashboard giám sát

TUẦN

## 9

Anomaly Detection + Security Testing

Python Detection, test tấn công mô phỏng, đánh giá

TUẦN

## 10

Integration + Documentation + Defense

Kiểm thử tổng thể, báo cáo, slide và demo bảo vệ

| Tuần | Trọng tâm                  | Mức độ khó | Mốc bàn giao                                     |
| ---- | -------------------------- | ---------- | ------------------------------------------------ |
| 5    | MFA, Session, UI/UX        | 7/10       | Hai Web hoàn thiện xác thực và giao diện         |
| 6    | LDAP/Active Directory      | 8/10       | Người dùng LDAP đăng nhập và được cấp đúng quyền |
| 7    | JCL, quản trị truy cập     | 8/10       | Quy trình Join/Change/Leave đầy đủ               |
| 8    | Audit PostgreSQL, giám sát | 8/10       | Audit tập trung, dashboard và cảnh báo           |
| 9    | Python và kiểm thử bảo mật | 9/10       | Detection, test case, chỉ số đánh giá            |
| 10   | Tích hợp và bảo vệ         | 7/10       | Sản phẩm hoàn chỉnh, báo cáo và demo             |

Mức độ khó là đánh giá tương đối cho nhóm hai sinh viên. Lộ trình này khá tham vọng; phần ưu tiên cao nhất phải được hoàn thành trước khi bổ sung các tính năng mở rộng.

## 3. Tuần 5 – MFA, bảo mật phiên và nâng cấp giao diện toàn hệ thống

Ưu tiên cao nhất

Mục tiêu: Hoàn thiện xác thực đa yếu tố bắt buộc, bảo vệ token và session, nâng cấp Web A/Web B, đồng thời bảo đảm các chức năng cũ không bị lỗi.

### Timeline triển khai tuần 5

| Thời điểm | Công việc chi tiết                                                                      | Ưu tiên |
| --------- | --------------------------------------------------------------------------------------- | ------- |
| Ngày 1    | Sao lưu dự án, kiểm tra Keycloak Authentication Flow, OTP Policy, bắt buộc đăng ký TOTP | P0      |
| Ngày 2    | Kiểm thử OTP, refresh token, logout, session revoke, tài khoản bị khóa                  | P0      |
| Ngày 3    | Kiểm thử lại RBAC/IDOR; rà soát API, service account, chính sách mật khẩu               | P0      |
| Ngày 4    | Nâng cấp Dashboard, lịch công, hồ sơ và giao diện bảo mật Web A                         | P1      |
| Ngày 5    | Nâng cấp Security Dashboard, biểu đồ, cảnh báo và Audit Viewer của Web B                | P1      |
| Ngày 6    | Kiểm thử HTTPS LAN hai máy, security headers, cấu hình gateway và Keycloak              | P0      |
| Ngày 7    | Chạy regression test, sửa lỗi, chụp minh chứng, viết báo cáo tuần 5                     | P0      |

### Các chức năng phải hoàn thành

Keycloak & Authentication

- Bắt buộc người dùng mới đăng ký TOTP và hoàn thành MFA.
- Kiểm thử OTP hợp lệ, sai, quá cửa sổ thời gian cho phép, hoặc bỏ qua bước xác thực.
- Cấu hình Browser Flow đúng cho người dùng chưa đăng ký MFA.
- Bổ sung quy trình reset hoặc thay đổi thiết bị MFA an toàn.
- Kiểm thử MFA khi đăng nhập Web A và SSO sang Web B.
- Phân biệt đăng nhập lại bằng phiên SSO và đăng nhập bằng mật khẩu mới.

Lưu ý: chỉ bật `CONFIGURE_TOTP` không đủ để chứng minh chính sách MFA bắt buộc đã được áp dụng cho mọi luồng. Ngoài ra, TOTP tiêu chuẩn có thể được chấp nhận nhiều lần trong cửa sổ còn hiệu lực tùy cấu hình, nên không tự đặt tiêu chí "mã đã dùng phải bị từ chối" nếu chưa có cơ chế chống tái sử dụng.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak



Backend & Security

- Kiểm tra token hết hạn và refresh token.
- Kiểm tra thu hồi token sau đổi Role, disable tài khoản, logout.
- Kiểm tra chính sách 401/403/429/503 và các thông báo lỗi.
- Rà soát việc xác minh `issuer`, `audience`, `azp`, chữ ký và phiên.
- Rà soát Least Privilege của tài khoản service `attendance-control`.
- Kiểm thử lỗi Keycloak không kết nối được, tránh tự cho phép truy cập.
- Kiểm tra session cache và đồng bộ trạng thái phiên giữa hai Web.

Trong hệ thống hiện tại, tài liệu mô tả backend cache trạng thái phiên tối đa 5 giây, frontend kiểm tra khoảng 15 giây và access token 300 giây. Đây là các thông số cần đo lại sau khi thay đổi MFA hoặc chính sách phiên.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



Web A – Nhịp Workspace

- Dashboard cá nhân hóa theo Employee, Manager, Admin, Auditor.
- Biểu đồ chấm công tuần/tháng, lịch công và tổng hợp ngày đi muộn.
- Trang Security Settings: trạng thái MFA, phiên hoạt động, lịch sử đăng nhập.
- Giao diện đổi mật khẩu và yêu cầu reset MFA.
- Cải thiện bảng công, quy trình duyệt đơn và thông báo.
- Chuẩn hóa responsive, loading skeleton, toast, modal xác nhận.

Web B – Nhịp Security

- KPI: đăng nhập thành công/thất bại, ALLOW/DENY, tài khoản khóa, phiên hoạt động.
- Biểu đồ sự kiện theo thời gian.
- Lọc theo người dùng, Role, IP, Client và mức cảnh báo.
- Trang chi tiết sự kiện có timeline và request ID.
- Dashboard trạng thái bảo mật của từng tài khoản.
- Màn hình trạng thái các thành phần hệ thống (dùng dữ liệu có thể xác minh).

### Nghiệm thu tuần 5

Phải đạt trước khi chuyển sang tuần 6:

- MFA thực tế hoạt động trên cả Web A và Web B.
- SSO không bị hỏng sau khi bổ sung MFA.
- Token cũ bị xử lý đúng theo chính sách thu hồi đã thiết kế.
- Các test RBAC, IDOR và quản lý phiên vẫn đạt.
- Giao diện Web A/B hoạt động tốt trên desktop và mobile.
- Có bằng chứng truy cập HTTPS và đăng nhập từ máy khách thứ hai.
- Có báo cáo tuần 5, video hoặc ảnh minh chứng.

## 4. Tuần 6 – LDAP/Active Directory và đồng bộ danh tính doanh nghiệp

Độ khó 8/10

Mục tiêu: Chuyển từ mô hình danh tính chỉ do Keycloak quản lý sang mô hình có nguồn danh tính doanh nghiệp bằng LDAP/AD.

### Timeline tuần 6

| Thời điểm | Công việc                                                              | Ưu tiên |
| --------- | ---------------------------------------------------------------------- | ------- |
| Ngày 1    | Thiết kế LDAP Directory, OU, User, Group, sơ đồ đồng bộ                | P0      |
| Ngày 2    | Triển khai OpenLDAP trong Docker hoặc AD DS trên VM                    | P0      |
| Ngày 3    | Cấu hình Keycloak User Federation, test kết nối và Import Users        | P0      |
| Ngày 4    | Ánh xạ LDAP Group sang Keycloak Group/Role                             | P0      |
| Ngày 5    | Kiểm thử đổi thuộc tính, đổi nhóm, disable tài khoản, lỗi đồng bộ      | P0      |
| Ngày 6    | Bổ sung giao diện Directory Management và Federation Status trên Web B | P1      |
| Ngày 7    | Kiểm thử LDAP, lưu minh chứng và báo cáo tuần 6                        | P0      |

### Thiết kế danh tính

Ví dụ cấu trúc LDAP:

```
dc=company,dc=local
├── ou=people
│   ├── uid=employee01
│   ├── uid=employee02
│   ├── uid=manager01
│   └── uid=auditor01
└── ou=groups
    ├── cn=employees
    ├── cn=managers
    └── cn=auditors
```

Các hạng mục triển khai:

- Tạo LDAP Server và tài khoản quản trị dịch vụ riêng.
- Cấu hình Base DN, Bind DN, User Search Filter.
- Kết nối Keycloak User Federation.
- Cấu hình LDAP Mapper cho username, email, tên và nhóm.
- Đồng bộ người dùng và kiểm tra đăng nhập.
- Phân quyền theo nhóm LDAP và chính sách ứng dụng.
- Kiểm tra trường hợp người dùng chuyển nhóm.
- Kiểm tra Keycloak khi LDAP tạm thời ngừng hoạt động.
- Thiết kế chính sách đồng bộ và hiển thị lỗi.

Quyết định kiến trúc quan trọng: Nên coi LDAP là nguồn dữ liệu gốc cho thuộc tính danh tính được quản lý tại LDAP; Keycloak và ứng dụng chỉ quản lý những dữ liệu được phép. Phải xác định rõ chế độ `READ_ONLY`, `WRITABLE` hoặc `UNSYNCED`, vì chúng có hành vi cập nhật khác nhau.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.keycloak.org\&sz=32)

Keycloak

        

### Nâng cấp Web B trong tuần 6

Directory Users

Danh sách người dùng LDAP, nguồn danh tính, trạng thái, nhóm, vai trò được ánh xạ và lần đồng bộ cuối.

Federation Sync

Trạng thái LDAP Connection, số người dùng được đồng bộ, lỗi và thời gian đồng bộ gần nhất.

Group Mapping

Trình bày quan hệ LDAP Group → Keycloak Group/Role → Web Resource và các xung đột cần xử lý.

### Nghiệm thu tuần 6

Có tài khoản LDAP đăng nhập Keycloak thành công; thay đổi nhóm dẫn đến thay đổi quyền sau quá trình đồng bộ phù hợp; tài khoản bị vô hiệu hóa không thể đăng nhập mới; các trạng thái và sự kiện có minh chứng.

Nếu nhóm chỉ có máy 16 GB RAM, nên ưu tiên OpenLDAP trên Docker. Windows AD DS là phần mở rộng sau khi Federation đã chạy ổn định.

## 5. Tuần 7 – Join/Change/Leave và Access Governance nâng cao

Độ khó 8/10

Mục tiêu: Xây dựng vòng đời danh tính có kiểm soát từ khi nhân viên gia nhập, thay đổi bộ phận/quyền đến khi nghỉ việc.

Trong tài liệu hiện tại, hệ thống đã có chức năng tạo nhân viên, thay đổi hồ sơ và Role, khóa/mở tài khoản, thu hồi phiên. Vì vậy, tuần 7 tập trung hoàn thiện quy trình đầu-cuối, nguồn dữ liệu LDAP và quản trị phê duyệt, không lập trình lại CRUD tài khoản.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



### Timeline tuần 7

| Thời điểm | Công việc                                           | Ưu tiên |
| --------- | --------------------------------------------------- | ------- |
| Ngày 1    | Thiết kế luồng JCL tích hợp LDAP–Keycloak–Web       | P0      |
| Ngày 2    | Hoàn thiện Join và cấp quyền mặc định               | P0      |
| Ngày 3    | Hoàn thiện Change, kiểm soát quyền cũ/mới           | P0      |
| Ngày 4    | Hoàn thiện Leave, thu hồi phiên và vô hiệu hóa      | P0      |
| Ngày 5    | Thêm yêu cầu cấp quyền và phê duyệt                 | P1      |
| Ngày 6    | Dashboard JCL, lịch sử và công cụ xử lý đồng bộ lỗi | P1      |
| Ngày 7    | Test toàn bộ JCL, lưu bằng chứng và báo cáo         | P0      |

### Chức năng mở rộng

| Module          | Công việc cần thực hiện                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Join            | Tạo nhân viên, gán phòng ban/nhóm, cấp Role mặc định, gửi thông báo, bắt buộc đổi mật khẩu/MFA |
| Change          | Thay đổi nhóm, chuyển Role, thu hồi quyền cũ, đồng bộ Keycloak và LDAP                         |
| Leave           | Disable tài khoản, thu hồi phiên, từ chối API, lưu lịch sử và lý do                            |
| Access Request  | Người dùng yêu cầu thêm quyền hoặc truy cập tài nguyên                                         |
| Access Approval | Manager/Admin xét duyệt yêu cầu theo phạm vi được phép                                         |
| Access Review   | Admin/Auditor rà soát quyền cấp quá mức hoặc lâu không sử dụng                                 |
| Sync Recovery   | Đối chiếu trạng thái `PENDING`, `PARTIAL`, `FAILED`, `SYNCED`                                  |
| History         | Timeline thay đổi của từng tài khoản                                                           |
| Notification    | Thông báo thay đổi quyền, vô hiệu hóa, yêu cầu chờ duyệt                                       |

### Giao diện nên xây dựng

Web A: Trang yêu cầu quyền, theo dõi trạng thái phê duyệt, lịch sử quyền cá nhân và thông báo.

Web B: Access Governance Dashboard, Permission Matrix, bảng quy trình Join/Change/Leave, lịch sử thay đổi, màn hình xử lý lỗi đồng bộ và quản lý yêu cầu chờ duyệt.

Ví dụ minh chứng JCL

JOIN

Tạo + cấp quyền

CHANGE

Đổi nhóm / Role

LEAVE

Khóa + thu hồi

Với mỗi trạng thái, phải có API response, quyền thực tế, Keycloak/LDAP state và Audit Log tương ứng.

### Nghiệm thu tuần 7

Thực hiện một kịch bản đầy đủ: nhân viên mới được tạo → đăng nhập MFA → được chuyển phòng ban → quyền cũ bị từ chối → quyền mới được cấp → nghỉ việc → không còn truy cập được API theo chính sách thu hồi.

Đặc biệt, cần kiểm thử trường hợp đồng bộ LDAP/Keycloak thất bại giữa chừng và hệ thống không báo thành công giả.

## 6. Tuần 8 – Centralized Audit, PostgreSQL và Security Monitoring

Hạng mục quan trọng cho đồ án

Mục tiêu: Xây dựng hệ thống ghi nhận, lưu trữ, tìm kiếm và giám sát sự kiện tập trung, thay thế việc phụ thuộc hoàn toàn vào Audit Log SQLite hiện tại.

Hệ thống đang có collector lấy sự kiện Keycloak khoảng 30 giây/lần, nhưng chưa có cơ chế lấy bù đầy đủ khi mất kết nối hoặc lượng sự kiện vượt giới hạn của một lượt. Vì vậy, đây là phần cần cải thiện rõ rệt trong tuần 8.&#x20;

TAI_LIEU_TRIEN_KHAI_VA_KIEM_THU_CHI_TIET.md



### Timeline tuần 8

| Thời điểm | Công việc                                                    | Ưu tiên |
| --------- | ------------------------------------------------------------ | ------- |
| Ngày 1    | Thiết kế cơ sở dữ liệu Audit PostgreSQL, event schema        | P0      |
| Ngày 2    | Xây dựng Audit Service và kết nối PostgreSQL                 | P0      |
| Ngày 3    | Đồng bộ Keycloak Events, Admin Events, Web A/B Access Log    | P0      |
| Ngày 4    | Chống trùng log, retry, checkpoint, backfill, retention      | P0      |
| Ngày 5    | Phát triển Security Monitoring Dashboard                     | P1      |
| Ngày 6    | Cảnh báo theo luật, thống kê, xuất báo cáo, điều tra sự kiện | P1      |
| Ngày 7    | Kiểm thử Audit, đối chiếu dữ liệu, báo cáo tuần 8            | P0      |

### Hệ thống Audit tập trung

Kiến trúc mục tiêu tuần 8. Tách dữ liệu Audit của ứng dụng khỏi cơ sở dữ liệu nội bộ Keycloak và giữ SQLite hiện tại trong quá trình chuyển đổi an toàn.

### Các module cần phát triển

| Module              | Chức năng                                   |
| ------------------- | ------------------------------------------- |
| Event Collector     | Thu thập sự kiện Keycloak, Web A/B          |
| Audit Storage       | Lưu sự kiện vào PostgreSQL                  |
| Event Normalizer    | Chuẩn hóa User ID, IP, Event, Time, Client  |
| Request Correlation | Ghép các sự kiện theo request ID/session ID |
| Retention Policy    | Quản lý thời hạn giữ log                    |
| Alert Rules         | Đặt ngưỡng cảnh báo                         |
| Audit Search        | Tìm kiếm, lọc, phân trang theo thời gian    |
| Investigation       | Mở chi tiết và truy vết sự kiện             |
| Reports             | Thống kê, xuất CSV và tổng hợp an ninh      |

Một bản ghi Audit nên có các trường chính: `event_id`, `timestamp`, `source`, `user_id`, `client_id`, `session_id` (nếu có), `action`, `resource`, `decision`, `http_status`, `ip_address`, `request_id` và `details` đã được lọc thông tin nhạy cảm.

Không nên ghi access token, refresh token, mật khẩu, OTP hay secret vào bảng Audit.

### Mở rộng giao diện Web B

- Security Overview với biểu đồ ALLOW/DENY.
- Authentication Analytics theo thời gian.
- Account Activity Timeline.
- Incident & Alert Management.
- Top tài khoản có nhiều lần đăng nhập thất bại.
- Federation Health và Audit Collector Health.
- Báo cáo lịch sử cấp/thu hồi quyền.
- Trang xuất dữ liệu phục vụ kiểm toán.

### Nghiệm thu tuần 8

Ít nhất một sự kiện đăng nhập, một yêu cầu ALLOW, một yêu cầu DENY và một thao tác thay đổi Role phải truy xuất được từ PostgreSQL, đối chiếu được nguồn và thời điểm.

Ngoài ra, phải chứng minh collector không ghi trùng khi chạy lại và hệ thống xử lý minh bạch các tình huống mất kết nối. Không tuyên bố bảo đảm không mất log nếu chưa kiểm thử và thiết kế được cơ chế khôi phục tương ứng.

## 7. Tuần 9 – Python Anomaly Detection và kiểm thử bảo mật toàn diện

Độ khó cao nhất – 9/10

Mục tiêu: Phát hiện hành vi bất thường dựa trên dữ liệu Audit và chứng minh mức độ bảo vệ của hệ thống bằng bộ kiểm thử kỹ thuật.

### Timeline tuần 9

| Thời điểm | Công việc                                                 | Ưu tiên |
| --------- | --------------------------------------------------------- | ------- |
| Ngày 1    | Thu thập và gán nhãn dữ liệu Audit Log                    | P0      |
| Ngày 2    | Xử lý dữ liệu, xây dựng đặc trưng phát hiện               | P0      |
| Ngày 3    | Python Detection theo luật, thử mô hình ML nếu đủ dữ liệu | P0/P1   |
| Ngày 4    | Tích hợp kết quả Normal/Anomaly vào Web B                 | P0      |
| Ngày 5    | Đánh giá Precision/Recall/F1, False Positive Rate, độ trễ | P0      |
| Ngày 6    | Kiểm thử RBAC, MFA, LDAP, SSO, token, JCL, audit, API     | P0      |
| Ngày 7    | Sửa lỗi, kiểm thử hồi quy, viết báo cáo tuần 9            | P0      |

### Xây dựng Python Detection

Đề xuất hai tầng phát hiện:

Tầng 1 – Rule-based Detection (bắt buộc)

- Nhiều lần đăng nhập thất bại trong khoảng thời gian ngắn.
- Thử truy cập API Admin bằng tài khoản Employee.
- Nhiều sự kiện DENY liên tiếp.
- Truy cập từ IP mới (tín hiệu cần kiểm tra, không mặc định là tấn công).
- Truy cập ngoài khung giờ nghiệp vụ.
- Sử dụng lại token đã bị thu hồi.
- Tăng đột biến số yêu cầu từ một tài khoản.

Tầng 2 – Machine Learning (mở rộng)

Có thể thử Isolation Forest hoặc thuật toán khác phù hợp với dữ liệu thực nghiệm. Đặc trưng đầu vào có thể gồm số lần thất bại, mật độ request, thời gian truy cập, tỷ lệ DENY và số tài nguyên khác nhau được yêu cầu.

Không nên coi kết quả Rule-based là dữ liệu nhãn duy nhất để đánh giá chính mô hình Rule-based, vì sẽ tạo kết quả đo thiếu độc lập.

### Chỉ số đánh giá

| Chỉ số              | Mục đích                                            |
| ------------------- | --------------------------------------------------- |
| Precision           | Trong các cảnh báo, bao nhiêu là bất thường thật    |
| Recall              | Trong các bất thường thật, phát hiện được bao nhiêu |
| F1-score            | Cân bằng giữa Precision và Recall                   |
| False Positive Rate | Tỷ lệ hoạt động bình thường bị cảnh báo nhầm        |
| Detection Latency   | Thời gian từ sự kiện đến khi cảnh báo xuất hiện     |
| Processing Time     | Thời gian xử lý khối lượng dữ liệu                  |

Nên chia tập dữ liệu kiểm thử riêng, tránh để các sự kiện gần như trùng nhau xuất hiện đồng thời trong tập huấn luyện và tập đánh giá.

### Kiểm thử bảo mật toàn hệ thống

| Nhóm test        | Kịch bản cần thực hiện                                       |
| ---------------- | ------------------------------------------------------------ |
| Authentication   | MFA đúng/sai, token không hợp lệ, hết hạn                    |
| Authorization    | RBAC, quyền theo nhóm, truy cập đối tượng không thuộc sở hữu |
| SSO              | Login, logout và thu hồi phiên hai chiều                     |
| LDAP             | Đồng bộ nhóm, tài khoản bị khóa, dịch vụ LDAP lỗi            |
| JCL              | Join, Change, Leave và lỗi giữa các bước đồng bộ             |
| Input            | JSON lỗi, dữ liệu không hợp lệ, mass assignment              |
| Security Headers | CORS, CSP, HTTPS, Host/Proxy                                 |
| Rate Limiting    | Giới hạn số lượng request và login throttling                |
| Audit            | Log đầy đủ, đúng actor, đúng request ID                      |
| Reliability      | Keycloak/PostgreSQL/LDAP bị ngắt kết nối                     |
| Data Integrity   | Không có thay đổi dữ liệu trái quyền                         |
| Recovery         | Backup/restore, xử lý thao tác chưa đồng bộ                  |

Có thể sử dụng OWASP ZAP để quét ứng dụng lab do nhóm sở hữu, kết hợp kiểm thử thủ công và automated integration tests.

### Nghiệm thu tuần 9

- Python trả kết quả Normal/Anomaly.
- Web B hiển thị cảnh báo từ Python.
- Có Confusion Matrix và các chỉ số đo được trên dữ liệu kiểm thử.
- Bộ test bảo mật đạt tiêu chí đã định trước.
- Không có trường hợp truy cập trái phép được cho phép trong bộ test bắt buộc.
- Có bằng chứng về giới hạn của mô hình và các trường hợp cảnh báo nhầm.

## 8. Tuần 10 – Tích hợp, hoàn thiện báo cáo và chuẩn bị bảo vệ

Tuần nghiệm thu cuối cùng

Mục tiêu: Đóng băng tính năng, bảo đảm toàn bộ hệ thống chạy được, có tài liệu, bằng chứng và demo ổn định.

### Timeline tuần 10

| Thời điểm | Công việc                                                       | Ưu tiên |
| --------- | --------------------------------------------------------------- | ------- |
| Ngày 1    | Kiểm tra tích hợp Web A, Web B, Keycloak, LDAP, Audit và Python | P0      |
| Ngày 2    | Sửa lỗi tích hợp, bảo mật và quyền truy cập                     | P0      |
| Ngày 3    | Hoàn thiện UI/UX, tối ưu responsive, dữ liệu demo               | P0      |
| Ngày 4    | Đóng băng tính năng, backup và regression test                  | P0      |
| Ngày 5    | Hoàn thành báo cáo Word, sơ đồ, kết quả thí nghiệm              | P0      |
| Ngày 6    | Thiết kế PowerPoint, quay video demo dự phòng                   | P0      |
| Ngày 7    | Diễn tập bảo vệ, kiểm thử lần cuối và bàn giao                  | P0      |

### Các sản phẩm phải bàn giao

| Sản phẩm            | Yêu cầu                                             |
| ------------------- | --------------------------------------------------- |
| Source code         | Web A, Web B, Backend, Audit Service, Python        |
| Docker Compose      | Tái lập môi trường thực nghiệm                      |
| Keycloak Config     | Realm, Client, Role, Flow, MFA                      |
| LDAP Config         | Cấu hình Federation, Group Mapper                   |
| Database            | Schema, migration, dữ liệu demo, hướng dẫn sao lưu  |
| Test Suite          | Kịch bản, dữ liệu, kết quả chạy                     |
| Security Evidence   | Ảnh, log, HTTP response, request ID                 |
| System Architecture | Sơ đồ hệ thống và trust boundary                    |
| Sequence Diagram    | OIDC, SSO, MFA, JCL, Audit Flow                     |
| Báo cáo đồ án       | Phân tích, thiết kế, triển khai, kiểm thử, đánh giá |
| PowerPoint          | Slide thuyết trình                                  |
| Demo Video          | Video dự phòng các chức năng quan trọng             |

### Luồng demo cuối cùng nên trình diễn

1

Đăng nhập Web A bằng tài khoản LDAP

2

Hoàn thành xác thực MFA

3

Chuyển sang Web B và chứng minh SSO

4

Thử truy cập API trái quyền → HTTP 403

5

Đổi nhóm/Role và kiểm tra quyền thay đổi

6

Thu hồi phiên hoặc vô hiệu hóa tài khoản

7

Xem Audit Log và cảnh báo trên Web B

8

Chạy Python Detection và giải thích kết quả

Nguyên tắc tuần 10: Không bổ sung công nghệ lớn, không thay toàn bộ UI và không chuyển cơ sở dữ liệu vào sát ngày bảo vệ. Chỉ sửa lỗi, tối ưu, bổ sung minh chứng và hoàn thiện tài liệu.

## 9. Phân chia công việc cho 2 thành viên

Để hoàn thành trong 10 tuần, mỗi người nên phụ trách một nhánh chính nhưng cả hai cùng tham gia tích hợp, kiểm thử và bảo vệ.

| Tuần | Thành viên A – IAM, Security, Infrastructure   | Thành viên B – Web, Database, UI/UX                 |
| ---- | ---------------------------------------------- | --------------------------------------------------- |
| 5    | MFA, token, session, API security              | Dashboard Web A/B, responsive, biểu đồ              |
| 6    | LDAP/AD, Keycloak Federation, Group Mapping    | Giao diện quản lý LDAP, hiển thị trạng thái đồng bộ |
| 7    | JCL, phân quyền, đồng bộ trạng thái            | Access Request, Approval, Governance UI             |
| 8    | Event Collector, bảo mật log, retry            | Audit PostgreSQL, Security Analytics                |
| 9    | Security Test, threat scenarios, phân tích lỗi | Python Detection, Metrics, Dashboard                |
| 10   | Tích hợp, bảo mật, kiểm thử tổng thể           | Báo cáo, giao diện, slide, video demo               |

Hai thành viên cùng chịu trách nhiệm thiết kế chính sách quyền, giải thích kiến trúc và chứng minh kết quả.

## 10. Mức độ ưu tiên nếu không đủ thời gian

| Ưu tiên       | Nội dung                                                                                                          | Quyết định                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| P0 – Bắt buộc | MFA hoàn chỉnh, RBAC/SSO ổn định, LDAP Federation, JCL, Audit, Python baseline, kiểm thử                          | Phải hoàn thành                |
| P1 – Nên có   | Access Governance, dashboard nâng cao, ML Detection, xử lý log nâng cao                                           | Làm sau P0                     |
| P2 – Mở rộng  | Passkey, phê duyệt nhiều cấp, Active Directory thật nếu đã có OpenLDAP, HA, triển khai Web B trên máy chủ thứ hai | Có thể để định hướng tương lai |

Đối với tuần 8, chỉ cần chuyển Audit Log sang PostgreSQL trước; không bắt buộc chuyển toàn bộ dữ liệu chấm công và nghiệp vụ từ SQLite cùng lúc. Cách này hạn chế rủi ro.

Đối với tuần 9, nếu thời gian ngắn, Python Rule-based Detection có dữ liệu đánh giá và các chỉ số minh bạch tốt hơn một mô hình Machine Learning chưa được kiểm chứng.

## 11. Sáu mốc bắt buộc để kiểm soát tiến độ

Theo dõi mốc nghiệm thu

Chỉ đánh dấu khi đã kiểm thử và lưu minh chứng

## 4/6 — tuần 6, 7, 8, 9; tuần 5 và 10 còn nghiệm thu ngoài máy hiện tại

Tuần 5 – Authentication Hardened

MFA hoạt động; SSO, RBAC, token và session vượt qua các bài kiểm thử.

Tuần 6 – Identity Federation

Người dùng LDAP đăng nhập được và quyền phản ánh đúng Group Mapping.

Tuần 7 – Lifecycle Governance

Join/Change/Leave hoạt động đầu-cuối, có trạng thái đồng bộ và lịch sử.

Tuần 8 – Centralized Monitoring

Sự kiện Keycloak/Web A/B ghi được vào PostgreSQL và được tra cứu.

Tuần 9 – Detection & Security Validation

Python Detection hoạt động, có chỉ số và báo cáo kiểm thử bảo mật.

Tuần 10 – Final Release

Demo chạy ổn định, báo cáo/slide hoàn thành và có bản backup.

&#x20;Sao chép bảng theo dõi

## 12. Kết quả cuối cùng của đồ án

Khi hoàn thành, bạn sẽ có một nền tảng IAM mô phỏng doanh nghiệp với hai website hoạt động thực tế, tích hợp đăng nhập tập trung, xác thực đa yếu tố, quản lý người dùng và phân quyền, liên kết thư mục LDAP/AD, kiểm soát vòng đời tài khoản và hệ thống giám sát truy cập.

Về bảo mật, hệ thống sẽ có các cơ chế xác thực, phân quyền phía backend, thu hồi phiên, quản lý sự kiện, kiểm thử truy cập trái phép và phát hiện hoạt động bất thường. Đây là giải pháp theo định hướng Zero Trust, không đồng nghĩa đã triển khai đầy đủ mọi thành phần kiến trúc Zero Trust của NIST.

Khuyến nghị quan trọng: Giữ nguyên các chức năng đã làm tốt ở tuần 1–4. Với mỗi tính năng mới, hãy thực hiện theo trình tự thiết kế → phát triển → kiểm thử → lưu evidence → cập nhật tài liệu, rồi mới chuyển sang tính năng tiếp theo.

Như vậy, đến cuối tuần 10, nhóm có thể trình diễn một hệ thống hoàn chỉnh và có cơ sở kỹ thuật để trả lời các câu hỏi về IAM, SSO, LDAP, MFA, RBAC, Zero Trust và giám sát an toàn thông tin.
