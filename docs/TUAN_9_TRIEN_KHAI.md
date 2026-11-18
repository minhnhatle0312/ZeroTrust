# Tuần 9 — Python Detection & chuẩn bị kiểm thử bảo mật

## Note kiểm thử bổ sung — 08/11/2026

Python 7/7; tích hợp Audit/Detection 100/100; 27 mẫu mô phỏng định nhãn trước suy luận: TP7/TN20/FP0/FN0. Không suy rộng số đo thành chất lượng trên dữ liệu vận hành.

Chi tiết: [kết quả thực tế](KET_QUA_KIEM_THU_2026_11_08.md). Các đoạn “chưa kiểm thử” bên dưới là ghi chép tại thời điểm triển khai source trước đây.


Ngày ghi note: **07/11/2026**. Đã bổ sung mã nguồn sau tuần 8; **chưa chạy kiểm thử, detector, đo chỉ số hoặc áp dụng lên lab**, theo yêu cầu tiếp tục làm full nhưng chưa kiểm thử. Không đánh dấu mốc nghiệm thu tuần 9.

## Đã bổ sung

- Python baseline trong `audit/detection.py`; worker `audit/detection_api.py` dùng PostgreSQL cùng Audit Service. Không thêm mô hình ML khi chưa có tập dữ liệu độc lập đủ chất lượng.
- Bảy nhóm tín hiệu: lỗi login dồn dập; employee thử API admin/security; DENY liên tiếp; IP mới sau khi đã có lịch sử; ngoài giờ nghiệp vụ; token/phiên đã thu hồi; request tăng đột biến so với ngưỡng tuyệt đối và baseline giờ trước.
- Đặc trưng theo event-time, tie-break bằng sequence: cửa sổ 5 phút, baseline 60 phút trước cửa sổ, IP từng thấy trong 30 ngày. Không gom mọi anonymous thành một người; fallback IP, không đủ định danh thì ghi rõ unknown.
- Worker xử lý tối đa 200 bản ghi/lượt. Config snapshot gắn vào job; kết quả/checkpoint cùng transaction. Lỗi rollback cả batch, giữ checkpoint, lần mới thử lại. Auto mặc định **tắt**, chỉ chạy khi admin yêu cầu hoặc chủ động bật.
- Ghi `Normal/Anomaly`, danh sách luật, features, config version, thời điểm phát hiện, latency và processing time. Cảnh báo Python đi vào Incident Management tuần 8; không tự khóa user hay đổi role.
- Web B có mục **Python Detection**: lọc kết quả, đọc log gốc/features, gán nhãn, lịch sử chạy, cấu hình, Confusion Matrix, Precision/Recall/F1/FPR, mean/p95 latency, xuất lịch sử metrics.
- Admin/auditor gán nhãn với note, scenario và train/evaluation; kiểm tra cùng scenario không nằm ở hai tập. Version chống ghi đè. Admin mới được chạy/config/evaluate.
- Snapshot đánh giá gồm dataset, SHA-256, config versions và chỉ số; giữ kết quả lịch sử để tránh nhãn bị sửa làm thay đổi báo cáo cũ. Không có mẫu hoặc mẫu số bằng 0 thì không bịa chỉ số 0%/100%.
- CLI offline `scripts/evaluate_detection.py` đọc JSONL có nhãn, phát hiện ID trùng và scenario leakage, không ghi đè file kết quả tồn tại.
- Soạn `tests/test_detection.py` với các ca ranh giới và confusion matrix; `tests/security_week9.py` cho probe HTTP đọc có token theo role. **Chỉ viết, chưa chạy.** Kịch bản mở rộng trong [danh sách nghiệm thu](TUAN_9_NGHIEM_THU.md).

## API

Tiền tố `/api/security/central/detection`:

| API | Quyền | Công dụng |
| --- | --- | --- |
| GET `/status` | admin/auditor | Config, checkpoint, backlog, 20 jobs gần nhất |
| GET `/results` | admin/auditor | Lọc Normal/Anomaly, 25 dòng/trang |
| GET `/evaluations`, `/:id` dưới evaluations | admin/auditor | Lịch sử và snapshot đánh giá |
| POST `/run` | admin | Xếp hàng batch; response không đồng nghĩa hoàn tất |
| POST `/config` | admin | Ngưỡng, giờ làm, UTC offset, auto + version |
| POST `/labels/:event_id` | admin/auditor | Nhãn độc lập, scenario/split/note/version |
| POST `/evaluate` | admin | Lưu metrics từ tập evaluation đã gán nhãn |

## Quy trình dữ liệu và đánh giá sau này

1. Dùng kịch bản được người kiểm thử xác nhận để thu log thật. Đánh dấu thời gian, actor, request ID và tình huống chủ đích, không dùng chính kết quả luật làm ground truth.
2. Nhóm sự kiện cùng phiên/kịch bản vào cùng scenario; ưu tiên tách theo ngày và kịch bản trước khi tinh chỉnh luật. API chỉ chống scenario ID bị chia tập; người đánh giá còn phải kiểm tra các bản gần trùng khác scenario.
3. Tập `train` dùng tinh chỉnh, `evaluation` giữ riêng. Trên UI gán nhãn Normal/Anomaly, lý do và mã bằng chứng; không nhập token/password/OTP.
4. Chạy detector khi được phép; thu cả FN/FP, không bỏ ca khó. Với sự kiện backfill, latency gồm độ trễ thu thập, không coi đó là thời gian xử lý Python.
5. Tính và lưu đánh giá. Đủ hai lớp vẫn chưa chứng minh tính đại diện; hệ thống cảnh báo khi mẫu nhỏ hoặc thiếu lớp. Báo cáo theo config version; không so sánh hai lần dùng tập khác nhau mà không nêu rõ.

JSONL offline mỗi dòng có `event_id`, `label`, `prediction`, `scenario`, `split`, `review_note`, `latency_ms` nếu có. Đây là schema nhập, không phải kết quả thực nghiệm.

Các lệnh **chưa chạy**, chỉ dành cho lúc bắt đầu kiểm thử:

```powershell
python -m unittest discover -s tests -p test_detection.py
python tests/security_week9.py --base https://TEN_MAY:8443 --ca network/.local/ca.crt --output evidence/week9/http-probes.json
python scripts/evaluate_detection.py evidence/week9/labeled.jsonl --output evidence/week9/metrics.json
```

Phải thay `TEN_MAY` và đường dẫn CA theo cấu hình thật; không tắt xác minh TLS. Probe đọc `TEST_EMPLOYEE_TOKEN`/`TEST_AUDITOR_TOKEN` từ môi trường, không lưu token vào output. Thiếu token → SKIPPED và exit không thành công, không đổi thành PASS.

## Giới hạn

- Luật baseline, không phải ML/AI đã huấn luyện. Isolation Forest là mở rộng tùy chọn, chưa làm khi thiếu dữ liệu.
- Anomaly là tín hiệu điều tra; IP mới, VPN, ngoài giờ hoặc thao tác quản trị hợp lệ có thể gây false positive. Normal không bảo đảm sự kiện an toàn.
- Worker phân tích một lần trên dữ liệu đang có. Event đến rất trễ có thể làm cửa sổ của kết quả cũ chưa đầy đủ; không tự sửa kết quả/nhãn đã lưu. Cần đánh giá lại trên snapshot dữ liệu đầy đủ khi nghiệm thu.
- Nhãn do con người nhập vẫn có sai lệch và bias do nhìn dự đoán. Cần một người xác nhận từ nguồn độc lập; không coi validation giao diện là bảo đảm khoa học.
- Các probe tự động mới chỉ là phần nhỏ; JCL/LDAP/MFA/SSO/fault injection/recovery cần kịch bản có trạng thái thật. Chưa chạy ZAP, regression hay test phá kết nối.
- Chưa có dataset thật, confusion matrix đo được, số Precision/Recall/F1/FPR hay bằng chứng đạt bảo mật. Phần code tính toán đã chuẩn bị; phần thực nghiệm **còn chờ**.
