from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
link='[kết quả kiểm thử 08/11/2026](docs/KET_QUA_KIEM_THU_2026_11_08.md)'
for name in ['tuanconlai.md','tiendo.md']:
    p=ROOT/name;s=p.read_text(encoding='utf-8')
    if name=='tuanconlai.md':
        s=re.sub(r'\*\*Theo dõi triển khai 07/11/2026:\*\*[^\n]+',
            '**Cập nhật 08/11/2026:** đã áp dụng và chạy lab tuần 5–10, sửa lỗi tích hợp MFA/LDAP/Keycloak/Audit, kiểm thử backend, giao diện, JCL local/LDAP, Detection và phục hồi Audit. Xem '+link+'. Mốc chính thức **4/6**; chưa thay bằng chứng máy khách thứ hai bằng kiểm thử nhiều trình duyệt trên một máy.',s)
        s=s.replace('## 0/6','## 4/6 — tuần 6, 7, 8, 9; tuần 5 và 10 còn nghiệm thu ngoài máy hiện tại')
    else:
        s=re.sub(r'Cập nhật: \*\*07/11/2026\*\*[^\n]+',
            'Cập nhật: **08/11/2026**. Đã triển khai lab và kiểm thử tuần 5–10: 130 backend, 8 tiện ích/API client, 7 Python; SSO/UI/nghiệp vụ và các bộ tích hợp mới đã có minh chứng. Có video thao tác, backup đa kho và phục hồi Audit cô lập. Xem '+link+'. Các số liệu mốc cũ bên dưới giữ như lịch sử; không thay kết quả mới.',s)
    p.write_text(s,encoding='utf-8')
p=ROOT/'README.md';s=p.read_text(encoding='utf-8');lines=s.splitlines();lines[1:1]=['','> **08/11/2026:** đã chạy và sửa tích hợp tuần 5–10. '+link+'. Hệ thống lab: `https://10.0.130.254:8443/`.'];p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
notes={5:'SSO/HTTPS 29/29; đăng ký và xác thực TOTP LDAP/local, refresh rotation; khôi phục MFA được kiểm thử bằng mock. Còn xác nhận CA/đăng nhập trên máy vật lý thứ hai.',
6:'LDAP full sync 4 tài khoản ban đầu; LDAP employee/auditor đăng nhập MFA/SSO; chuyển nhóm và Leave qua JCL nguồn thật; mất LDAP chặn truy cập, đăng nhập lại được sau phục hồi.',
7:'JCL local 24/24, LDAP 23/23; grant phê duyệt mở quyền, Change thu hồi grant/phiên, Leave chặn token. Các ca lỗi/hold/version được kiểm thử hồi quy.',
8:'Audit PostgreSQL nhận sự kiện thật và fixture; batch replay chống trùng, correlation/phân trang, allowlist loại trường nhạy cảm; backup/restore Audit đã chạy.',
9:'Python 7/7; tích hợp Audit/Detection 100/100; 27 mẫu mô phỏng định nhãn trước suy luận: TP7/TN20/FP0/FN0. Không suy rộng số đo thành chất lượng trên dữ liệu vận hành.',
10:'Build hai Web, UI cũ 42/42, nghiệp vụ 24/24, màn hình mới 19/19; video release-demo.webm; backup đa kho và restore Audit cô lập. Còn nghiệm thu liên máy và diễn tập phục hồi phối hợp mọi kho.'}
for week,text in notes.items():
    p=ROOT/f'docs/TUAN_{week}_TRIEN_KHAI.md';s=p.read_text(encoding='utf-8');lines=s.splitlines();lines[1:1]=['',f'## Note kiểm thử bổ sung — 08/11/2026', '',text,'','Chi tiết: [kết quả thực tế](KET_QUA_KIEM_THU_2026_11_08.md). Các đoạn “chưa kiểm thử” bên dưới là ghi chép tại thời điểm triển khai source trước đây.',''];p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
p=ROOT/'docs/TONG_HOP_TUAN_5_10.md'
s='''# Theo dõi hoàn thiện tuần 5–10

Cập nhật **08/11/2026**. Đã áp dụng lab, sửa lỗi và kiểm thử. [Biên bản chi tiết](KET_QUA_KIEM_THU_2026_11_08.md) có kết quả, giới hạn và đường dẫn minh chứng. Mốc chính thức **4/6**, không tự xác nhận thiết bị vật lý thứ hai.

| Tuần | Kết quả cập nhật | Note |
| --- | --- | --- |
'''
for week,text in notes.items():s+=f'| {week} | {text} | [Tuần {week}](TUAN_{week}_TRIEN_KHAI.md) |\n'
s+='''
## Hồ sơ bàn giao

- [Báo cáo Word](ban_giao/BaoCaoTongHop_IAM_Tuan5-10_DRAFT.docx), [slide](ban_giao/BaoVe_IAM_Tuan5-10_DRAFT.pptx): cập nhật kết quả lab; vẫn là bản thảo chờ nghiệm thu cuối.
- [Báo cáo Markdown](BAO_CAO_TONG_HOP.md), [nội dung slide](SLIDE_BAO_VE.md), [sơ đồ](KIEN_TRUC_VA_LUONG_HE_THONG.md), [vận hành](BAN_GIAO_VA_VAN_HANH.md).
- Ảnh, JSON, dataset mô phỏng, video: `evidence/release/` (ignored).
- Backup đa kho: `backups/week5-20261108T024621561919Z`; restore Audit: project `iam-recovery-20261108-release`.

## Còn xác nhận

CA và đăng nhập từ máy vật lý thứ hai ở địa chỉ hiện tại; diễn tập phục hồi phối hợp mọi kho; đánh giá detector trên dữ liệu đại diện/người đánh giá độc lập; diễn tập bảo vệ. AD DS/HA/Passkey/ML là mở rộng tùy chọn. Source ZIP và backup private là hai loại khác nhau, không đưa secret vào Git.
'''
p.write_text(s,encoding='utf-8')
p=ROOT/'docs/BAO_CAO_TONG_HOP.md';s=p.read_text(encoding='utf-8').replace('Ngày cập nhật: 07/11/2026','Ngày cập nhật: 08/11/2026')
s=re.sub(r'Trạng thái: BẢN THẢO[^\n]+','Trạng thái: BẢN THẢO ĐÃ KIỂM THỬ LAB. Kết quả thực tế được bổ sung tại phần 9; chưa xác nhận nghiệm thu máy khách thứ hai hoặc diễn tập vận hành đầy đủ.',s)
s=s.replace('Chưa thực hiện lại các bước chuẩn bị/provision/sync hoặc nghiệm thu LDAP trong lượt triển khai source hiện tại.','Đã chuẩn bị, áp dụng federation, full sync và kiểm thử đăng nhập LDAP/MFA cùng vòng đời nguồn thật ngày 08/11/2026.')
start=s.index('Theo yêu cầu hiện tại, chưa chạy kiểm thử');end=s.index('## 10.',start)
s=s[:start]+'''Đã chạy trên Keycloak/OpenLDAP/PostgreSQL và HTTPS thật ngày 08/11/2026. Chi tiết từng suite và bằng chứng: docs/KET_QUA_KIEM_THU_2026_11_08.md.

| Phạm vi | Kết quả |
| --- | --- |
| Backend / tiện ích frontend / Python | 130/130; 8/8; 7/7 |
| SSO / UI / nghiệp vụ | 29/29; 42/42; 24/24 |
| LDAP/API mới / JCL local / JCL LDAP | 20/20; 24/24; 23/23 |
| Audit/Detection / session-LDAP / HTTP probes | 100/100; 9/9; 5/5 |
| Màn hình mới desktop/mobile | 19/19 |
| Build Web A/B, compileall, diff check | Đạt |

Thí nghiệm 27 mẫu mô phỏng định nhãn trước suy luận: TP7, TN20, FP0, FN0; Precision/Recall/F1 1,0 và FPR 0. Đây là kiểm tra chức năng bảy luật, không phải bằng chứng độ chính xác trên dữ liệu doanh nghiệp. Timestamp mô phỏng thuộc quá khứ nên latency gồm thời gian lấy bù; không dùng số này làm tốc độ realtime.

Đã phục hồi Audit riêng và đọc được 2.754 events, 2.693 kết quả, 1 evaluation tại thời điểm backup. Video giới thiệu màn hình và ảnh thật nằm tại evidence/release. Chưa có xác nhận mới từ máy vật lý thứ hai; chưa diễn tập chuyển toàn bộ các kho sang môi trường khác.

'''+s[end:]
s=s.replace('Release hiện tại là source freeze chưa nghiệm thu. Còn phải build, chạy migration, kiểm thử tích hợp/bảo mật, đo detector, chụp bằng chứng, diễn tập restore, quay demo và cập nhật báo cáo/slide. Không đánh dấu sáu mốc nghiệm thu hoàn tất khi các bước này chưa xảy ra.','Release đã chạy và kiểm thử trong lab, có ảnh/video, snapshot đánh giá và restore Audit. Còn xác nhận thiết bị vật lý thứ hai và diễn tập vận hành cuối. Mốc chính thức 4/6; không tự nâng thành 6/6.')
s=s.replace('Hiệu quả thực tế vẫn phải được chứng minh bằng thí nghiệm sau triển khai.','Các thí nghiệm lab đã xác nhận những luồng nêu ở phần 9; khả năng vận hành quy mô lớn vẫn cần đo riêng.')
p.write_text(s,encoding='utf-8')
p=ROOT/'docs/SLIDE_BAO_VE.md';s=p.read_text(encoding='utf-8')
a=s.index('## Trạng thái thực nghiệm');b=s.index('## Bàn giao',a)
s=s[:a]+'''## Kết quả thực nghiệm lab 08/11/2026
- Backend 130/130; tiện ích frontend 8/8; Python 7/7
- SSO 29/29; UI 42/42; nghiệp vụ 24/24; màn hình mới 19/19
- JCL local 24/24 và LDAP 23/23; Audit/Detection 100/100
- 27 mẫu mô phỏng: TP7/TN20/FP0/FN0; không suy rộng ra dữ liệu doanh nghiệp

'''+s[b:]
s=s.replace('- Quay video dự phòng sau khi có hệ thống chạy và bằng chứng thật','- Có ảnh/video thao tác thật tại evidence/release; không ghi mật khẩu/QR/secret OTP')
s=s.replace('- Tiếp theo: build, kiểm thử, restore drill, đo số liệu và hoàn thiện minh chứng','- Còn xác nhận máy vật lý thứ hai, phục hồi phối hợp mọi kho và diễn tập bảo vệ')
p.write_text(s,encoding='utf-8')
