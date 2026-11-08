"""Edit the existing OOXML package while retaining its styles, theme and page setup."""
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import hashlib
import json
import posixpath
import re
import zipfile

from lxml import etree
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'word/BaoCaoTuan3_LeMinhNhat_NguyenMinhTuan.docx'
BACKUP = ROOT / 'evidence/week3-report-review/BaoCaoTuan3_ban_goc.docx'
OUT = ROOT / 'word/minh_chung/tuan3'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
      'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture'}
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'


def q(prefix, name):
    return '{' + NS[prefix] + '}' + name


def structure(el):
    return (el.tag, sorted(el.attrib.items()), el.text,
            [structure(child) for child in el])


def prop(p, name, value=None):
    pp = p.find('w:pPr', NS)
    if pp is None:
        pp = etree.Element(q('w', 'pPr'))
        p.insert(0, pp)
    el = pp.find('w:' + name, NS)
    if el is None:
        el = etree.SubElement(pp, q('w', name))
    if value is not None:
        el.set(q('w', 'val'), str(value))
    return el


def paragraph(template, text):
    p = deepcopy(template)
    first_run = p.find('w:r', NS)
    run_properties = deepcopy(first_run.find('w:rPr', NS)) if first_run is not None and first_run.find('w:rPr', NS) is not None else None
    for child in list(p):
        if child.tag != q('w', 'pPr'):
            p.remove(child)
    run = etree.SubElement(p, q('w', 'r'))
    if run_properties is not None:
        run.append(run_properties)
    t = etree.SubElement(run, q('w', 't'))
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text
    return p


def image_paragraph(template, rid, file, description):
    p = deepcopy(template)
    prop(p, 'jc', 'center')
    prop(p, 'keepNext')
    prop(p, 'keepLines')
    # Preserve the original screenshot width and correct the aspect ratio.
    cx = int(p.find('.//wp:extent', NS).get('cx'))
    with Image.open(file) as im:
        cy = round(cx * im.height / im.width)
    for el in p.findall('.//wp:extent', NS) + p.findall('.//a:xfrm/a:ext', NS):
        el.set('cx', str(cx))
        el.set('cy', str(cy))
    p.find('.//a:blip', NS).set(q('r', 'embed'), rid)
    p.find('.//wp:docPr', NS).set('descr', description)
    return p


verification = json.loads((OUT / 'verification.json').read_text(encoding='utf-8'))
assert verification['success'] and all(c['passed'] for c in verification['checks'])
date = datetime.fromisoformat(verification['capturedAt']).strftime('%d/%m/%Y')
with zipfile.ZipFile(BACKUP) as source:
    entries = {i.filename: source.read(i) for i in source.infolist()}
    original_info = source.infolist()
tree = etree.fromstring(entries['word/document.xml'])
body = tree.find('w:body', NS)
old = list(body)

texts = {
7: 'Kế thừa nền tảng IAM đã chuẩn bị ở các tuần trước, tuần 3 tập trung hoàn thiện và kiểm chứng Giai đoạn 2 – Web A và RBAC: cấu hình OIDC Client employee-portal với PKCE S256, Audience employee-api và ánh xạ vai trò; tích hợp đăng nhập, đăng xuất Keycloak vào Web A React; xác minh JWT và phân quyền tại Backend Express. Mục tiêu kiểm thử là phân biệt đúng HTTP 200, 401 và 403 theo tình trạng xác thực và quyền truy cập.',
10: 'Cấu hình employee-portal là public client dùng OpenID Connect và Authorization Code Flow; bắt buộc PKCE S256, không đặt client secret trong React và tắt Direct Access Grants. Redirect URI và Web Origin được giới hạn cho Web A tại http://localhost:5173. Frontend sử dụng keycloak-js với login-required và pkceMethod S256.',
11: 'Kết quả: Web A chuyển người dùng đến Keycloak để đăng nhập; sau khi xác thực, ứng dụng nhận token và gọi API. Chức năng đăng xuất kết thúc phiên trình duyệt và chuyển về luồng đăng nhập.',
14: 'Hình 2.1. Cấu hình Authorization Code Flow và PKCE S256 của employee-portal.',
15: '2.2. Cấu hình Audience và ánh xạ vai trò',
16: 'Thiết lập audience mapper để Access Token có đối tượng nhận employee-api; gắn client scope roles để backend đọc các realm role trong realm_access.roles. Bốn vai trò ứng dụng được đặt tên chính xác là admin, manager, employee và auditor. Backend đối chiếu audience khi xác minh JWT, sau đó kiểm tra vai trò trước khi trả dữ liệu.',
17: 'Kết quả: Đã đối chiếu cấu hình trên Keycloak và kiểm tra issuer, audience của token ở cả bốn tài khoản trong lượt kiểm thử thực tế.',
19: 'Hình 2.2. Audience mapper đưa employee-api vào Access Token.',
21: 'Xây dựng Web A bằng React với giao diện Nhịp Workspace, hỗ trợ máy tính và điện thoại. Ứng dụng hiển thị hồ sơ, vai trò, chấm công cá nhân và các chức năng theo quyền. Menu được điều chỉnh theo tài khoản; mọi yêu cầu API vẫn phải được backend kiểm tra độc lập. Token được sử dụng trong bộ nhớ phiên của keycloak-js, không đưa vào ảnh minh chứng.',
22: 'Kết quả: Đã kiểm tra đăng nhập và đăng xuất của employee01, manager01, admin01, auditor01; giao diện tải dữ liệu hồ sơ thành công sau đăng nhập.',
24: 'Hình 2.4. Giao diện Nhịp Workspace sau khi employee01 đăng nhập.',
25: '2.4. Xây dựng Backend API và phân quyền RBAC',
26: 'Backend Node.js/Express nhận Bearer Token và dùng thư viện jose xác minh chữ ký RS256 bằng JWKS của Keycloak; kiểm tra issuer, audience, thời hạn và các claim bắt buộc sub, iat, exp. Danh tính sub được đối chiếu với hồ sơ nhân viên phía server; vai trò trong JWT phải khớp vai trò của hồ sơ. Cơ chế này áp dụng trước khi xử lý các API /api/profile, /api/manager, /api/admin và /api/audit.',
27: 'Quy tắc RBAC: các tài khoản đã được cấp hồ sơ và vai trò hợp lệ đều được đọc /api/profile; manager và admin được đọc /api/manager; chỉ admin được đọc /api/admin; admin và auditor được đọc /api/audit. Kết quả: API từ chối thiếu token bằng HTTP 401 và từ chối sai quyền bằng HTTP 403; kết quả đối chiếu được trình bày tại mục 2.5.',
30: 'Hình 2.3. Bốn realm role admin, manager, employee và auditor trong Keycloak.',
31: '2.5. Kiểm thử xác thực và phân quyền',
32: 'Đăng nhập lần lượt bằng bốn tài khoản demo qua Keycloak thật và gọi bốn API để đối chiếu 16 kết quả với ma trận RBAC. HTTP 200 xác nhận yêu cầu có token hợp lệ và đủ quyền. Khi không gửi token đến /api/profile, backend trả HTTP 401, status DENY và code MISSING_TOKEN. Khi employee01 gọi /api/admin bằng token hợp lệ, backend trả HTTP 403 với code INSUFFICIENT_ROLE. Các phản hồi được lưu trong verification.json, không lưu token hoặc mật khẩu.',
33: f'Kết quả kiểm chứng ngày {date}: toàn bộ 16 yêu cầu theo vai trò trả đúng HTTP 200/403; trường hợp thiếu token trả đúng HTTP 401. Chạy npm.cmd test trong backend đạt 54/54 bài kiểm thử, không có bài thất bại. Bộ backend sử dụng khóa JWT kiểm thử riêng, SQLite riêng và mô phỏng tương tác Keycloak; kết quả này được phân biệt với kiểm thử tích hợp Keycloak thật ở Hình 2.5.',
35: 'Hình 2.5. Biên bản API thực tế: ma trận RBAC và phản hồi HTTP 401/403.',
37: 'Hình 2.6. Kết quả npm.cmd test: 54 bài kiểm thử backend đều đạt.',
42: 'Hoàn thiện OIDC Client employee-portal: Authorization Code Flow, PKCE S256 và Audience employee-api.',
43: 'Xác nhận client scope roles và bốn realm role phục vụ phân quyền RBAC.',
44: 'Tích hợp đăng nhập, đăng xuất Keycloak và hiển thị dữ liệu người dùng trên Web A React.',
45: 'Xác minh JWT tại Backend Express, đối chiếu hồ sơ nhân viên và áp dụng quyền cho bốn API minh họa.',
46: 'Kiểm chứng HTTP 200, 401, 403 bằng Keycloak thật; ma trận 16 yêu cầu đúng kỳ vọng và bộ kiểm thử backend đạt 54/54.',
48: 'Hệ thống hiện là môi trường lab localhost, Keycloak dùng HTTP và start-dev; chưa triển khai HTTPS hoặc đánh giá vận hành thực tế. Các kết quả kiểm thử xác nhận các kịch bản đã thực hiện, chưa đủ để kết luận hệ thống đã đáp ứng đầy đủ kiến trúc Zero Trust hoặc không còn lỗ hổng.',
49: 'Tuần tiếp theo dự kiến xây dựng Web B độc lập với OIDC Client riêng, kiểm thử SSO từ Web A sang Web B và hành vi đăng xuất ở cả hai ứng dụng. Trung tâm bảo mật hiện nằm trong Web A; MFA mới hỗ trợ yêu cầu cấu hình OTP theo tài khoản, chưa hoàn tất kiểm thử đăng ký thiết bị và đăng nhập bằng OTP.',
50: f'Minh chứng: Hình 2.1–2.3 là ảnh cấu hình Keycloak đã có, được đối chiếu lại qua Admin API; Hình 2.4–2.6 được chụp trong lượt kiểm chứng ngày {date}. Tệp verification.json, backend-tests.tap và ảnh gốc được lưu tại word/minh_chung/tuan3. Các biên bản chỉ ghi kết quả cần đối chiếu, không chứa mật khẩu hoặc Access Token.',
}
updated = {i: paragraph(old[i], text) for i, text in texts.items()}

# Keep original configuration screenshots unchanged; place roles with the role explanation.
for index in [13, 18, 29]:
    updated[index] = deepcopy(old[index])
    prop(updated[index], 'keepNext')
    prop(updated[index], 'keepLines')
    prop(updated[index], 'jc', 'center')
for source_name, dest in [('image1.png', '01-pkce.png'),
                          ('image2.png', '02-audience.png'),
                          ('image4.png', '04-realm-roles.png')]:
    (OUT / dest).write_bytes(entries['word/media/' + source_name])
new_images = [('rIdWeek3Dashboard', '03-web-a.png', 23,
               'Giao diện Web A sau khi employee01 đăng nhập bằng Keycloak thật.'),
              ('rIdWeek3HTTP', '05-http-rbac.png', 34,
               'Biên bản kiểm thử HTTP thực tế với bốn tài khoản demo; đã loại token khỏi nội dung ghi nhận.'),
              ('rIdWeek3Tests', '06-backend-tests.png', 36,
               'Kết quả thực thi npm.cmd test: 54 test, 54 pass, 0 fail.')]
for rid, name, index, desc in new_images:
    updated[index] = image_paragraph(old[13], rid, OUT / name, desc)

# Caption lines use the same original paragraph/run styling, and stay with their image.
for index in [14, 19, 30, 24, 35, 37]:
    prop(updated[index], 'keepLines')
    prop(updated[index], 'keepNext', '0')

order = list(range(12)) + [13, 14, 15, 16, 17, 18, 19, 29, 30,
                          20, 21, 22, 23, 24, 25, 26, 27,
                          31, 32, 33, 34, 35, 36, 37,
                          41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52]
for el in list(body):
    body.remove(el)
for index in order:
    body.append(updated.get(index, deepcopy(old[index])))

# Unique drawing IDs prevent repair warnings in Word.
for n, el in enumerate(body.findall('.//wp:docPr', NS), 1):
    el.set('id', str(n))
    el.set('name', 'Picture ' + str(n))
for n, el in enumerate(body.findall('.//pic:cNvPr', NS), 1):
    el.set('id', str(n))
    el.set('name', 'Picture ' + str(n))

rels = etree.fromstring(entries['word/_rels/document.xml.rels'])
used = set(tree.xpath('//@r:embed', namespaces=NS))
for el in list(rels):
    if el.get('Type', '').endswith('/image') and el.get('Id') not in used:
        rels.remove(el)
for rid, name, _, _ in new_images:
    el = etree.SubElement(rels, '{' + REL + '}Relationship')
    el.set('Id', rid)
    el.set('Type', NS['r'] + '/image')
    el.set('Target', 'media/week3-' + name)
    entries['word/media/week3-' + name] = (OUT / name).read_bytes()
kept_media = {posixpath.normpath('word/' + el.get('Target'))
              for el in rels if el.get('Type', '').endswith('/image')}
# Physically remove the screenshot containing the DevTools token and the obsolete images.
for name in list(entries):
    if name.startswith('word/media/') and name not in kept_media:
        del entries[name]
for name, obj in [('word/document.xml', tree), ('word/_rels/document.xml.rels', rels)]:
    entries[name] = etree.tostring(obj, encoding='UTF-8', xml_declaration=True, standalone=True)

with zipfile.ZipFile(TARGET, 'w', compression=zipfile.ZIP_DEFLATED) as target:
    written = set()
    for info in original_info:
        if info.filename in entries:
            target.writestr(info, entries[info.filename])
            written.add(info.filename)
    for name in entries.keys() - written:
        target.writestr(name, entries[name])

# Validate the package and prove that styles/page setup and the identity block are preserved.
with zipfile.ZipFile(TARGET) as revised, zipfile.ZipFile(BACKUP) as original:
    assert revised.testzip() is None
    for name in ['word/styles.xml', 'word/theme/theme1.xml', 'word/numbering.xml', 'word/fontTable.xml']:
        assert revised.read(name) == original.read(name), name
    assert structure(old[52]) == structure(body[-1]), 'Page setup changed'
    for i in range(6):
        assert structure(old[i]) == structure(body[i]), 'Identity / title changed'
    for el in rels:
        if el.get('TargetMode') != 'External':
            name = posixpath.normpath('word/' + el.get('Target'))
            assert name in revised.namelist(), 'Broken relationship: ' + name
    assert len(used) == 6
    assert not any(b'../NULL' in revised.read(n) for n in revised.namelist() if n.endswith('.rels'))
    assert 'word/media/image7.png' not in revised.namelist()
    # The original token screenshot must not remain in any ZIP member.
    leaked = hashlib.sha256(original.read('word/media/image7.png')).hexdigest()
    assert all(hashlib.sha256(revised.read(n)).hexdigest() != leaked for n in revised.namelist())

print('Edited report:', TARGET)
print('Preserved: original styles, theme, fonts, bullet numbering, page setup and identity block.')
print('Validated: 6 embedded images, no broken image relationships, no original DevTools token screenshot.')
