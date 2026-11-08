"""Create week 4 by changing content inside the week 3 OOXML template."""
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import hashlib
import json
import re
from zipfile import ZipFile

from lxml import etree
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'word/BaoCaoTuan3_LeMinhNhat_NguyenMinhTuan.docx'
TARGET = ROOT / 'word/BaoCaoTuan4_LeMinhNhat_NguyenMinhTuan.docx'
OUT = ROOT / 'word/minh_chung/tuan4'
OUT.mkdir(parents=True, exist_ok=True)
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
before_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()

browser_file = ROOT / 'evidence/week3/browser-results.json'
summary_file = ROOT / 'evidence/week3/validation-summary.json'
browser = json.loads(browser_file.read_text(encoding='utf-8'))
summary = json.loads(summary_file.read_text(encoding='utf-8'))
assert browser['success'] and len(browser['checks']) == 29
assert all(c['passed'] for c in browser['checks'])
assert summary['backend']['tests'] == summary['backend']['pass'] == 73
assert summary['backend']['fail'] == 0
for source in [browser_file, summary_file]:
    (OUT / source.name).write_bytes(source.read_bytes())

texts = {
6: '1. Mục tiêu tuần 4',
7: 'Kế thừa Web A và RBAC ở tuần 3, tuần 4 tập trung triển khai Giai đoạn 3 – Web B và SSO: xây dựng Security Dashboard độc lập; cấu hình OIDC Client security-dashboard, PKCE S256 và Audience security-api; kiểm thử đăng nhập một lần hai chiều giữa Web A và Web B. Đồng thời kiểm chứng phân quyền từng ứng dụng, đăng xuất liên ứng dụng và truy cập qua HTTPS trong mạng LAN/VPN.',
9: '2.1. Xây dựng Web B – Security Dashboard',
10: 'Xây dựng Web B độc lập trong thư mục web-b bằng React/Vite với giao diện Nhịp Security. Ứng dụng có trang tổng quan, cảnh báo, nhật ký và quản lý tài khoản theo vai trò, hỗ trợ máy tính và điện thoại. Web A tiếp tục phục vụ chấm công; hai ứng dụng có liên kết chuyển đổi và cùng sử dụng Keycloak để xác thực.',
11: 'Kết quả: admin đăng nhập và sử dụng các chức năng Web B; auditor được đọc dữ liệu giám sát. Kiểm thử giao diện điện thoại xác nhận trang không bị tràn ngang.',
13: 'Hình 2.1. Giao diện Nhịp Security sau khi admin01 đăng nhập Web B.',
14: '2.2. Cấu hình OIDC Client và phân quyền Web B',
15: 'Tạo security-dashboard là public client, dùng Authorization Code Flow và PKCE S256, Audience security-api và scope basic để token có sub. Web A giữ employee-portal và employee-api. Backend xác minh chữ ký, issuer, thời hạn, azp, audience theo client, hồ sơ và vai trò; token Web B không được dùng để đọc nghiệp vụ chấm công.',
16: 'Kết quả: admin và auditor được vào Web B; auditor bị từ chối API quản lý tài khoản. employee/manager bị chặn tại UI và API với HTTP 403 nhưng vẫn dùng được Web A theo quyền.',
18: 'Hình 2.2. Auditor truy cập Web B với menu chỉ đọc, không có mục Tài khoản.',
20: 'Hình 2.3. Web B từ chối tài khoản employee01 không đủ quyền truy cập.',
21: '2.3. Tích hợp và kiểm thử SSO hai chiều',
22: 'Tích hợp keycloak-js vào Web B và dùng chung realm company-iam với Web A. Khi phiên Keycloak còn hiệu lực trong cùng hồ sơ trình duyệt, người dùng chuyển A → B hoặc B → A không phải nhập lại mật khẩu. Mỗi ứng dụng nhận token riêng theo client và giữ token trong bộ nhớ; không sao chép token giữa hai Web.',
23: 'Kết quả: kiểm thử cả hai chiều đều không xuất hiện bước nhập lại mật khẩu; token có client và audience riêng nhưng cùng phiên Keycloak. Trình duyệt hoặc thiết bị khác phải đăng nhập độc lập.',
25: 'Hình 2.4. Web A với admin01 trong lượt kiểm thử chuyển ứng dụng và SSO.',
26: '2.4. Kiểm soát đăng xuất và triển khai HTTPS LAN/VPN',
27: 'Backend đối chiếu sid trong token với phiên Keycloak thật, cache tối đa 5 giây; frontend kiểm tra phiên mỗi 15 giây và khi nhận focus. Khi đăng xuất một ứng dụng, ứng dụng còn lại phát hiện phiên kết thúc; API từ chối token cũ dù chưa hết hạn. Nếu không kết nối được Keycloak để kiểm tra phiên, API trả HTTP 503.',
28: 'Triển khai HTTPS gateway cho Web A tại /a/, Web B tại /b/, API và endpoint xác thực qua một địa chỉ LAN/VPN. Backend kết nối Keycloak qua loopback; issuer khớp URL HTTPS công khai. Đã kiểm tra chuỗi chứng chỉ, IP SAN và chặn đường dẫn riêng tư; máy thứ hai truy cập được HTTPS nhưng chưa xác nhận tin cậy CA và đăng nhập.',
29: '2.5. Kiểm thử SSO, phân quyền và đăng xuất',
30: 'Lượt kiểm thử HTTPS LAN/VPN ngày 01/11/2026 hoàn tất lúc 13:05:37 (UTC+7), đạt 29/29 kiểm tra và lưu 11 ảnh. Các kịch bản gồm SSO A ↔ B, client/audience riêng, chặn token Web B đọc chấm công, giới hạn auditor, từ chối employee/manager và đăng xuất hai chiều. Sau khi logout tại B, token cũ của cả A/B đều nhận HTTP 401.',
31: 'Theo validation-summary.json ngày 01/11/2026, bộ backend đạt 73/73 test và cả hai Web build thành công. Đây là bản tổng kết, không phải log TAP gốc; bộ backend dùng môi trường kiểm thử và mô phỏng Keycloak, còn 29 kiểm tra trình duyệt chạy với hệ thống thật. Trình duyệt tự động bỏ qua tin cậy chứng chỉ lab; chuỗi CA và SAN được kiểm tra riêng.',
33: 'Hình 2.5. Web A trở về trang đăng nhập sau khi đăng xuất tại Web B.',
35: 'Hình 2.6. Tổng hợp biên bản: 73/73 test backend và 29/29 kiểm tra trình duyệt.',
36: '3. Kết quả đạt được trong tuần 4',
37: 'Xây dựng Web B độc lập với tổng quan, cảnh báo, nhật ký và quản lý tài khoản theo quyền.',
38: 'Cấu hình security-dashboard, PKCE S256 và security-api; kiểm soát client/audience tại API.',
39: 'Kiểm chứng SSO hai chiều A ↔ B trong cùng trình duyệt, mỗi ứng dụng giữ token riêng.',
40: 'Kiểm chứng đăng xuất liên ứng dụng và chặn token cũ; bổ sung HTTPS gateway cho LAN/VPN.',
41: 'Ghi nhận 73/73 test backend, 29/29 kiểm tra trình duyệt và build Web A/B thành công.',
43: 'Hệ thống là lab nội bộ; Keycloak còn dùng start-dev sau HTTPS proxy. SSO áp dụng trong cùng hồ sơ trình duyệt; tab nền bị đình chỉ có thể cập nhật logout chậm, API vẫn kiểm tra phiên khi có yêu cầu. Chưa triển khai Web B trên máy chủ thứ hai độc lập; chưa xác nhận bước tin cậy CA và đăng nhập trên thiết bị thứ hai.',
44: 'Tuần 5 dự kiến tập trung MFA và tăng cường bảo mật: hoàn thiện đăng ký TOTP, kiểm thử mật khẩu kết hợp OTP và các trường hợp OTP sai, thiếu, hết hạn; kiểm tra vòng đời token/refresh token, Redirect URI, CORS và HTTPS. Hiện mới hỗ trợ yêu cầu CONFIGURE_TOTP theo tài khoản; chưa hoàn tất MFA OTP toàn hệ thống.',
45: 'Minh chứng: Hình 2.1–2.5 lấy từ lượt kiểm thử HTTPS ngày 01/11/2026 tại evidence/week3 (tên thư mục lịch sử của giai đoạn 3, tương ứng tuần 4). Hình 2.6 trình bày lại browser-results.json và validation-summary.json, không phải ảnh terminal. Ảnh sử dụng và bản sao hai biên bản lưu tại word/minh_chung/tuan4; nội dung báo cáo đối chiếu tuan4.md và tiendo.md.',
}

# Use the same six image frames as the template; contain screenshots without
# cropping or stretching, retaining the template's exact drawing dimensions.
sources = {
1: '02-web-b-admin.png', 2: '07-web-b-auditor.png',
3: '10-employee01-denied.png', 4: '01-web-a-admin.png',
5: '06-logout-b-ends-a.png',
}
descriptions = {
1: texts[13], 2: texts[18], 3: texts[20],
4: texts[25], 5: texts[33], 6: texts[35],
}

def font(size, bold=False):
    name = 'arialbd.ttf' if bold else 'arial.ttf'
    return ImageFont.truetype('C:/Windows/Fonts/' + name, size)

panel = Image.new('RGB', (2100, 804), 'white')
d = ImageDraw.Draw(panel)
d.rounded_rectangle((5, 5, 2094, 798), radius=22, fill='#F5F7FA', outline='#C8D3DF', width=3)
d.text((55, 40), 'KẾT QUẢ KIỂM THỬ WEB B VÀ SSO – TUẦN 4', font=font(49, True), fill='#17365D')
d.text((55, 112), 'Lượt kiểm chứng ngày 01/11/2026 | HTTPS LAN/VPN', font=font(32), fill='#455467')
rows = [
    ('Backend', '73/73 test đạt; 0 thất bại'),
    ('Trình duyệt', '29/29 kiểm tra đạt; 11 ảnh minh chứng'),
    ('Build', 'Web A: thành công | Web B: thành công'),
    ('SSO A ↔ B', 'Không nhập lại mật khẩu trong cùng phiên trình duyệt'),
    ('Phân quyền', 'Token Web B đọc chấm công: 403; auditor quản lý: 403'),
    ('Đăng xuất', 'Logout tại B: token cũ của A và B đều nhận HTTP 401'),
]
for i, (label, value) in enumerate(rows):
    y = 185 + i * 76
    d.text((60, y), label, font=font(33, True), fill='#17365D')
    d.text((410, y), value, font=font(32), fill='#263446')
d.text((55, 676), 'Nguồn: browser-results.json và validation-summary.json tại evidence/week3.', font=font(27), fill='#455467')
d.text((55, 722), 'Hình tổng hợp từ biên bản đã lưu; không phải ảnh terminal hoặc một lượt chạy mới.', font=font(27), fill='#455467')
panel.save(OUT / '06-ket-qua-kiem-thu.png')

with ZipFile(SOURCE) as zin:
    infos = zin.infolist()
    entries = {i.filename: zin.read(i) for i in infos}
original = etree.fromstring(entries['word/document.xml'])
tree = deepcopy(original)
paragraphs = tree.findall('w:body/w:p', NS)
assert len(paragraphs) == 46
for index, value in texts.items():
    nodes = paragraphs[index].findall('.//w:t', NS)
    assert len(nodes) == 1, (index, len(nodes))
    nodes[0].text = value

week_nodes = paragraphs[3].findall('.//w:t', NS)
for node in reversed(week_nodes):
    if node.text and node.text.rstrip().endswith('3'):
        node.text = re.sub(r'3(\s*)$', r'4\1', node.text)
        break
else:
    raise AssertionError('Week label not found')

for index in range(1, 7):
    part = f'word/media/image{index}.png'
    if index <= 5:
        raw = ROOT / 'evidence/week3' / sources[index]
        (OUT / f'{index:02d}-{sources[index]}').write_bytes(raw.read_bytes())
        with Image.open(BytesIO(entries[part])) as old:
            size = old.size
        with Image.open(raw) as shot:
            fitted = ImageOps.contain(shot.convert('RGB'), size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', size, 'white')
        canvas.paste(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    else:
        canvas = panel
    buffer = BytesIO()
    canvas.save(buffer, format='PNG')
    entries[part] = buffer.getvalue()

for index, drawing in enumerate(tree.findall('.//wp:docPr', NS), 1):
    drawing.set('descr', descriptions[index])
entries['word/document.xml'] = etree.tostring(tree, encoding='UTF-8', xml_declaration=True, standalone=True)

# Compare every element and property after masking only intentional content.
def masked(root):
    root = deepcopy(root)
    for node in root.findall('.//w:t', NS):
        node.text = 'CONTENT'
    for node in root.findall('.//wp:docPr', NS):
        node.set('descr', 'CONTENT')
    return etree.tostring(root, method='c14n')

assert masked(original) == masked(tree), 'Template formatting changed'
with ZipFile(TARGET, 'w') as zout:
    for info in infos:
        zout.writestr(info, entries[info.filename])
with ZipFile(SOURCE) as zin, ZipFile(TARGET) as zout:
    assert zout.testzip() is None
    changed = [n for n in zin.namelist() if zin.read(n) != zout.read(n)]
    assert changed == ['word/document.xml'] + [f'word/media/image{i}.png' for i in range(1, 7)]
    for name in zout.namelist():
        if name.endswith('.xml') or name.endswith('.rels'):
            etree.fromstring(zout.read(name))
assert before_hash == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
all_text = ' '.join(tree.xpath('//w:t/text()', namespaces=NS))
assert 'Tuần số: 4' in all_text and 'Mục tiêu tuần 4' in all_text
assert 'tuần 3' not in all_text.replace('Web A và RBAC ở tuần 3', '')

(OUT / 'README.md').write_text('''# Minh chứng báo cáo tuần 4

Nguồn nội dung: `tuan4.md`, giai đoạn 3 trong `tiendo.md`.
Nguồn kiểm thử: `evidence/week3` là tên thư mục lịch sử của giai đoạn 3,
tương ứng tuần 4 trong kế hoạch. Lượt trình duyệt HTTPS LAN/VPN hoàn tất
13:05:37 ngày 01/11/2026 (UTC+7), đạt 29/29 kiểm tra và lưu 11 ảnh.

Ảnh 01–05 là bản sao ảnh chụp thật từ lượt này, tương ứng Hình 2.1–2.5.
Ảnh 06 trình bày lại kết quả từ hai biên bản JSON, không phải ảnh terminal.
`validation-summary.json` ghi 73/73 test backend và build Web A/B thành công;
đây là tổng kết lịch sử, không phải log TAP hoặc lượt chạy mới.

Hai file JSON được sao chép nguyên trạng để đối chiếu. Ảnh trong DOCX được
đặt vừa khung hình gốc, giữ tỷ lệ và toàn bộ nội dung. Các kiểu chữ, căn lề,
thuộc tính đoạn, kích thước khung hình, theme và thiết lập trang giữ nguyên
từ mẫu tuần 3. File tuần 3 không bị chỉnh sửa.
''', encoding='utf-8')

print(json.dumps({'output': str(TARGET), 'bytes': TARGET.stat().st_size,
                  'formatting': 'identical after masking text and image descriptions',
                  'source_unchanged': True, 'changed_parts': changed}, ensure_ascii=False, indent=2))
