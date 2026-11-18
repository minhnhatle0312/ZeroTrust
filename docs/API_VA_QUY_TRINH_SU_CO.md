# API và quy trình xử lý sự cố hiện hành

Hợp đồng gốc giữ nguyên tại [API Đợt 4](API_SU_CO_DOT_4.md); Web B Đợt 5A đọc, Đợt 5B ghi theo hợp đồng đó. Đợt 6 không thêm endpoint hoặc mở rộng quyền.

## Ranh giới dữ liệu và trạng thái

- SQLite: `/api/security/alert-list`, `/api/security/alerts/:id`; update bằng **PATCH**, trường trạng thái `status`.
- PostgreSQL: `/api/security/central/incidents`, `/incidents/:id` dưới prefix central; update bằng **POST**, trường `state`.
- Admin/auditor đọc, chỉ admin ghi incident. Mọi API qua JWT/account/session/RBAC; UI không quyết định quyền thay Backend.
- Bốn trạng thái: `open`, `reviewing`, `resolved`, `false_positive`. Không tạo enum mới cho “đang xử lý”/“chờ xác minh”.
- Hai kho có DTO `detail.schemaVersion=1`; `origin=sqlite|postgresql`. URL dùng ID nguyên bản, không đưa prefix incidentRef vào tham số ID.

## Một lần cập nhật

Body gồm version snapshot, note và một hoặc nhiều nội dung được API cho phép: assessment, recommendation, actionRefs, verification, status/state. Không gửi actor/time/requestId tự tạo, kết quả thực thi hoặc `executed=true`. Backend xác định actor/time, lưu history before/after và audit.

Nhận định dùng `hypothesis/supported/confirmed/refuted`; ngoài giả thuyết cần citation. Đề xuất append mới có bằng chứng, không sửa/xóa ý kiến cũ. `events:<id>`, `identity_events:<id>` dùng cho SQLite; `audit:<event_id>` cho PostgreSQL. Backend kiểm tra tồn tại và đúng danh tính; chung IP không đủ căn cứ.

Hành động chỉ liên kết bản ghi hiện hữu: SQLite `action:<id>` đúng target; Audit là event thực thi được cho phép, cùng subject hoặc target được ghi rõ. Điều tra không thực thi lại hành động. Dữ liệu ngoài hệ thống chưa có log không được tự nhập thành bằng chứng thành công.

Giới hạn: note 10–500 ký tự, text/method 10–1000, mỗi danh sách refs tối đa 100, JSON Express 16 KB; frontend giữ ngưỡng an toàn dưới giới hạn byte. Metadata có tối đa 100 đề xuất và 100 action links. Không nhập bí mật vào văn bản tự do; bộ lọc mẫu không phải bộ phát hiện mọi credential.

## Xác minh và đóng

Verification gồm `result=passed|failed|inconclusive`, method, expectedDecision ALLOW/DENY và evidenceRefs. Passed cần probe độc lập sau sự kiện cuối, không tương lai, không dùng log thực thi/ghi điều tra thay kiểm tra. Probe phải đúng danh tính và quyết định mong đợi. Khi có hành động liên kết, kiểm tra phải diễn ra sau hành động, không có kết quả thực thi partial/chưa xác nhận theo luật từng kho.

Đóng resolved cần bằng chứng nguồn còn đầy đủ và kết quả đạt. False positive cần assessment có căn cứ. Đọc lại `resolution.verified`; trạng thái resolved của dữ liệu cũ không đủ chứng minh khắc phục. Reopen hoặc bằng chứng phát hiện mới có thể làm kết quả cũ cần đánh giá lại. Lịch sử không bị ghi đè.

## Xung đột và kết quả chưa chắc chắn

| Phản hồi | Cách xử lý |
|---|---|
| 400/404 | Sửa nội dung/ref theo lỗi Backend; không tạo nguồn giả hoặc bỏ validation |
| 401/403 | Theo trạng thái phiên/quyền; không đổi client/token để vượt quyền |
| 409 | Khóa gửi; đọc version/history mới, đối chiếu draft, xác nhận đã xem rồi gửi có chủ ý |
| 5xx/mạng/phản hồi không xác nhận version | Không biết chắc commit hay chưa; đọc lại trước thao tác tiếp theo; không tự retry mutation |
| Xác nhận ghi thành công, đọc lại lỗi | Ghi nhận riêng phần mutation đã xác nhận; chưa khẳng định trạng thái khắc phục hiện hành |

Không có transaction phân tán giữa gateway SQLite và PostgreSQL. Gateway có thể lỗi sau commit phía Audit; version/history mới là căn cứ đối chiếu. Một số lỗi 400 upstream hiện được gateway chuẩn hóa thành thông báo chung, không tự suy đoán nguyên nhân.

## Bảo toàn bằng chứng

Evidence chi tiết tối đa 500; history có cursor riêng theo kho, timeline chỉ gồm trang đã tải. Retention SQLite sau sửa Đợt 6 giữ source event được direct link, metadata hiện hành hoặc history tham chiếu; không đổi thời hạn retention và không tự chạy dọn trên lab. Nếu metadata không đọc được, transaction pruning rollback. Quy trình archive/xóa bằng chứng trích dẫn cần chính sách riêng được duyệt, không làm trong đợt này.

Kiểm thử và giới hạn nghiệm thu: [hướng dẫn kiểm thử](HUONG_DAN_KIEM_THU.md), [báo cáo nghiệm thu](BAO_CAO_NGHIEM_THU_ZERO_TRUST.md).
