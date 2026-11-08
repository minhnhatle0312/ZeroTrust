"""Fill the supplied weekly report; use only saved, dated evidence."""
from pathlib import Path
from copy import deepcopy
import json
import re
import shutil

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'word' / 'baocaotuan3,4_leminhnhat_nguyenminhtuan.docx'
ASSETS = ROOT / 'word' / 'minh_chung' / 'tuan3_4'
ASSETS.mkdir(parents=True, exist_ok=True)
TEMPLATE = ROOT / 'word' / '_Mẫu BC Tuần ĐACS_CN.docx'
d = Document(TEMPLATE)
original = [deepcopy(p._p) for p in d.paragraphs]
questions = [d.paragraphs[i].text for i in range(5, 13)]

sources = {
    'verification.json': 'word/minh_chung/tuan3/verification.json',
    'backend-tuan3.tap': 'word/minh_chung/tuan3/backend-tests.tap',
    'sso-results.json': 'evidence/week3/browser-results.json',
    'validation-summary.json': 'evidence/week3/validation-summary.json',
    'api-results.json': 'evidence/api-upgrade/browser-results.json',
    'backend-mo-rong.tap': 'evidence/api-upgrade/backend-tests.tap',
    'ui-results.json': 'evidence/ui-upgrade/results.json',
    'web-a.png': 'word/minh_chung/tuan3/03-web-a.png',
    'web-b.png': 'evidence/week3/02-web-b-admin.png',
    'canh-bao.png': 'evidence/api-upgrade/06-alert-context.png',
    'tu-choi-truy-cap.png': 'evidence/week3/10-employee01-denied.png',
}
for name, source in sources.items():
    shutil.copy2(ROOT / source, ASSETS / name)
v = json.loads((ASSETS / 'verification.json').read_text(encoding='utf-8'))
sso = json.loads((ASSETS / 'sso-results.json').read_text(encoding='utf-8'))
api = json.loads((ASSETS / 'api-results.json').read_text(encoding='utf-8'))
ui = json.loads((ASSETS / 'ui-results.json').read_text(encoding='utf-8'))
assert all(c['passed'] for doc in (v, sso, api, ui) for c in doc['checks'])
assert len(v['checks']) == 40 and len(sso['checks']) == 29
assert len(api['checks']) == 23 and len(ui['checks']) == 42
tap = (ASSETS / 'backend-mo-rong.tap').read_text(encoding='utf-8')
assert '# tests 97' in tap and '# pass 97' in tap and '# fail 0' in tap

FONTS = Path('C:/Windows/Fonts')
def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('arialbd.ttf' if bold else 'arial.ttf')), size)

def panel(name, title, rows, footer=None, width=1600, size=36):
    """A clearly labelled rendering of stored data, never a fake console shot."""
    height = 130 + len(rows) * 76 + (65 if footer else 0)
    im = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(im)
    draw.rectangle((1, 1, width-2, height-2), outline='#bbc4cc', width=2)
    draw.text((35, 25), title, font=font(40, True), fill='#142d3c')
    draw.line((35, 94, width-35, 94), fill='#abb9c3', width=2)
    for i, (left, right) in enumerate(rows):
        y = 118 + i * 76
        draw.text((36, y), left, font=font(size), fill='#192d3b')
        draw.text((width-36, y), str(right), font=font(size, True), fill='#134e38', anchor='ra')
        if i < len(rows)-1:
            draw.line((35, y+56, width-35, y+56), fill='#dee3e7', width=1)
    if footer:
        draw.text((35, height-52), footer, font=font(25), fill='#465963')
    path = ASSETS / name
    im.save(path)
    return path

by_name = {x['name']: x for x in sso['checks']}
logout_panel = panel('ket-qua-sso.png', 'SSO / logout — kết quả đã lưu ngày 01/11/2026', [
    ('A → B / B → A: số ô nhập mật khẩu', '0 / 0'),
    ('Token cũ A / B sau logout ở B', '401 / 401'),
    ('Token Web B gọi API chấm công', str(by_name['Web B token cannot read attendance']['actual'])),
], 'Nguồn: sso-results.json • Trình bày lại biên bản, không phải ảnh terminal.')

responses = v['responses']
missing = next(x for x in responses if x['user'] == 'anonymous')
forbidden = next(x for x in responses if x['user'] == 'employee01' and x['path'] == '/api/admin')
http_panel = panel('ket-qua-http.png', 'Phản hồi HTTP thật — trích verification.json', [
    ('Không token → GET /api/profile', f"{missing['http']}  {missing['body']['code']}"),
    ('employee01 → GET /api/admin', f"{forbidden['http']}  {forbidden['body']['code']}"),
], 'Đối chiếu đầy đủ ma trận 16 yêu cầu: đúng trạng thái HTTP mong đợi.', size=32)

def architecture():
    im = Image.new('RGB', (1600, 530), 'white')
    dr = ImageDraw.Draw(im)
    boxes = [
        (25, 30, 460, 175, ['Trình duyệt Web A / B', 'HTTPS :8443']),
        (565, 30, 1010, 175, ['Gateway trên Windows', '/a • /b • /api • /realms']),
        (1115, 30, 1575, 175, ['Backend Express', '127.0.0.1:3001 → SQLite']),
        (565, 325, 1010, 485, ['Keycloak (Docker)', '127.0.0.1:8080']),
        (1115, 325, 1575, 485, ['PostgreSQL (Docker)', '5432 nội bộ, không public']),
    ]
    for x1, y1, x2, y2, lines in boxes:
        dr.rounded_rectangle((x1, y1, x2, y2), radius=12, fill='white', outline='#334d60', width=3)
        for i, line in enumerate(lines):
            dr.text(((x1+x2)/2, y1+35+i*54), line, font=font(30, i == 0), fill='#172c39', anchor='ma')
    def arrow(points):
        dr.line(points, fill='#334d60', width=4)
        x, y = points[-1]; x0, y0 = points[-2]
        if x > x0:
            dr.polygon([(x,y),(x-14,y-9),(x-14,y+9)], fill='#334d60')
        elif y > y0:
            dr.polygon([(x,y),(x-9,y-14),(x+9,y-14)], fill='#334d60')
    arrow([(460,100),(565,100)])
    arrow([(1010,100),(1115,100)])
    arrow([(785,175),(785,325)])
    arrow([(1010,400),(1115,400)])
    dr.text((925, 231), 'OIDC / JWT / kiểm tra phiên', font=font(30), fill='#172c39', anchor='ma')
    dr.text((25, 390), 'Một máy chủ Windows', font=font(30, True), fill='#172c39')
    dr.text((25, 438), 'IP lúc chụp: 10.0.103.227', font=font(29), fill='#172c39')
    p = ASSETS / 'so-do-trien-khai.png'; im.save(p); return p

diagram = architecture()

# Preserve the template's page size, margins, title, Times New Roman and numbering.
body = d._element.body
for child in list(body):
    if child.tag != qn('w:sectPr'):
        body.remove(child)

def p(text='', bold=False, size=12, after=5, keep=False):
    para = d.add_paragraph()
    para.paragraph_format.space_after = Pt(after)
    para.paragraph_format.keep_with_next = keep
    run = para.add_run(text)
    run.bold = bold; run.font.size = Pt(size)
    run.font.name = 'Times New Roman'
    return para

def question(i, new_page=False):
    node = deepcopy(original[5+i])
    d._element.body.insert(len(d._element.body)-1, node)
    para = d.paragraphs[-1]
    para.paragraph_format.keep_with_next = True
    para.paragraph_format.space_before = Pt(5)
    para.paragraph_format.space_after = Pt(5)
    if new_page:
        para.paragraph_format.page_break_before = True
    return para

def picture(path, width=6.6, crop=None):
    """Crop only in Word's display frame; retain the complete source PNG."""
    para = p(after=3)
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.line_spacing = 1
    para.paragraph_format.keep_with_next = True
    shape = para.add_run().add_picture(str(path), width=Inches(width))
    if crop:
        with Image.open(path) as im:
            w, h = im.size
        x1, y1, x2, y2 = crop
        shape.height = Inches(width * (y2-y1) / (x2-x1))
        src = OxmlElement('a:srcRect')
        for key, val in [('l',x1/w),('t',y1/h),('r',(w-x2)/w),('b',(h-y2)/h)]:
            src.set(key, str(round(val*100000)))
        fill = shape._inline.graphic.graphicData.pic.blipFill
        fill.insert(1, src)
    return shape

def caption(text):
    para = p(text, size=10, after=7)
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.line_spacing = 1.05
    return para

def table(headers, rows, widths, size=11):
    t = d.add_table(rows=1, cols=len(headers))
    t.autofit = False
    for c, width in zip(t.columns, widths):
        c.width = Inches(width)
    for idx, text in enumerate(headers):
        t.rows[0].cells[idx].text = text
    for values in rows:
        row = t.add_row()
        for cell, text in zip(row.cells, values):
            cell.text = str(text)
    for r_idx, row in enumerate(t.rows):
        trpr = row._tr.get_or_add_trPr()
        trpr.append(OxmlElement('w:cantSplit'))
        if r_idx == 0:
            trpr.append(OxmlElement('w:tblHeader'))
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width)
            props = cell._tc.get_or_add_tcPr()
            borders = OxmlElement('w:tcBorders')
            for edge in ('top','left','bottom','right'):
                e = OxmlElement('w:'+edge); e.set(qn('w:val'),'single'); e.set(qn('w:sz'),'4'); e.set(qn('w:color'),'B9C2CB'); borders.append(e)
            props.append(borders)
            if r_idx == 0:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'),'F2F4F5'); props.append(shade)
            for para in cell.paragraphs:
                para.paragraph_format.line_spacing = 1.1
                para.paragraph_format.space_before = Pt(4)
                para.paragraph_format.space_after = Pt(4)
                for run in para.runs:
                    run.font.name = 'Times New Roman'; run.font.size = Pt(size); run.bold = r_idx == 0
    p(after=1).paragraph_format.line_spacing = 0.2
    return t

# PAGE 1: identity, delivered scope and actual running interface.
body.insert(0, deepcopy(original[0]))
d.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
d.paragraphs[0].paragraph_format.space_after = Pt(9)
p('Họ và tên: Lê Minh Nhật                         MSSV: 2380601546', after=0)
p('Họ và tên: Nguyễn Minh Tuấn                 MSSV: 2380602459', after=0)
p('Lớp: 23DTHB7        Chuyên ngành: An Ninh Mạng        Tuần số: 3–4', after=3)
p('Đề tài đăng ký: XÂY DỰNG HỆ THỐNG IAM DỰA TRÊN KEYCLOAK THEO ĐỊNH HƯỚNG ZERO TRUST', bold=True, after=5)
p('Nội dung báo cáo: Kết quả tuần 3–4, đối chiếu minh chứng lưu ngày 01/11/2026 (UTC+7).', size=11, after=4)
question(0)
table(['Hạng mục', 'Kết quả và trạng thái'], [
    ('Tuần 3 – Web A, RBAC', 'Đã chạy: Keycloak + PostgreSQL, Web A React, API Express; đăng nhập PKCE S256; 4 role, API trả 200/401/403 đúng quyền.'),
    ('Tuần 4 – Web B, SSO', 'Đã chạy: Web B độc lập, SSO hai chiều, logout liên ứng dụng, HTTPS LAN/VPN; token và audience riêng cho mỗi client.'),
    ('Chức năng mở rộng', 'Đã có minh chứng: tạo/sửa/khóa tài khoản, đổi role, thu hồi phiên; log, cảnh báo, thông báo, tìm kiếm và xuất CSV.'),
    ('Chưa hoàn tất', 'MFA/OTP thực tế, vòng đời refresh đầy đủ, HTTPS máy khách thứ hai; LDAP/AD, audit PostgreSQL tập trung và Python Detection chưa nghiệm thu.'),
], [1.7,4.9])
picture(ASSETS/'web-b.png', crop=(274,110,1406,598))
caption('Hình 1. Web B chạy thật, phiên đã xác thực và các bộ đếm từ API. Phóng to vùng nội dung ảnh gốc 02-web-b-admin.png; không sửa dữ liệu.')

# PAGE 2: answer the explicit machines/IP/log-flow question.
question(1, new_page=True)
p('Mô hình hiện tại dùng một máy Windows chạy Docker Desktop/WSL2 và các tiến trình ứng dụng; chưa tách Web A/B thành hai máy chủ hoặc hai VM riêng. IP dưới đây là địa chỉ tại thời điểm lưu minh chứng, không khẳng định là IP hiện tại.')
table(['Thành phần / nơi chạy', 'Địa chỉ và nhiệm vụ'], [
    ('Máy chủ Windows', '10.0.103.227; gateway HTTPS cổng 8443 phục vụ /a (Web A), /b (Web B), /api và các đường dẫn OIDC.'),
    ('Backend Express / host', '127.0.0.1:3001; xác minh JWT, kiểm tra phiên/quyền, xử lý nghiệp vụ, ghi audit/cảnh báo vào SQLite.'),
    ('Keycloak / container', 'Cổng host 127.0.0.1:8080; realm company-iam, xác thực người dùng, cấp token và quản lý phiên SSO.'),
    ('PostgreSQL / container', 'Cổng 5432 trong mạng Docker nội bộ; lưu dữ liệu Keycloak. Không mở cổng DB ra LAN.'),
    ('Máy khách LAN/VPN', 'Trình duyệt truy cập https://10.0.103.227:8443; mỗi hồ sơ trình duyệt có phiên riêng. Chưa xác nhận đầy đủ đăng nhập với CA tin cậy trên máy thứ hai.'),
], [2.0,4.6])
picture(diagram)
caption('Hình 2. Sơ đồ mô hình tại mốc báo cáo. Các dịch vụ đặt trên cùng máy chủ; PostgreSQL dành cho Keycloak, SQLite dành cho ứng dụng.')
p('Luồng dữ liệu: trình duyệt → gateway → Keycloak để đăng nhập; sau đó trình duyệt gửi token tới API. Backend xác minh chữ ký, issuer, audience, phiên và role rồi trả dữ liệu hoặc từ chối. ALLOW/DENY được ghi vào SQLite; collector lấy các sự kiện Keycloak được hỗ trợ, lưu chống trùng và tạo cảnh báo để Web B tra cứu.', after=2)

# PAGE 3: a real end-to-end security event, plus SSO flow.
question(2, new_page=True)
p('Đã kiểm chứng được luồng sự kiện bảo mật hoàn chỉnh:')
p('Bước 1 – Phát sinh: tài khoản thử nghiệm nhập sai mật khẩu tại Keycloak; Keycloak tạo sự kiện đăng nhập thất bại.', after=3)
p('Bước 2 – Thu thập: collector của backend đọc sự kiện từ Keycloak, lưu vào SQLite và tạo cảnh báo đăng nhập thất bại.', after=3)
p('Bước 3 – Xử lý, hiển thị: quản trị viên vào Web B, mở cảnh báo và xem tài khoản, thời điểm, số lần ghi nhận, hoạt động xác thực liên quan. Luồng kết thúc khi cảnh báo được lưu và hiển thị để điều tra.', after=4)
p('Kết quả: ba kiểm tra “Failed login imported from actual Keycloak”, “Failed login generates visible alert” và “Alert context includes related authentication” đều đạt trong lượt 23/23 kiểm tra API mở rộng (15:46–15:47 ngày 01/11/2026).', size=11)
picture(ASSETS/'canh-bao.png', width=4.3, crop=(450,21,990,476))
caption('Hình 3. Ảnh chụp thật, phóng to phần đầu hộp Chi tiết cảnh báo: tài khoản uiops-1101154708, 1 lần, 15:47 ngày 01/11/2026. Nguồn: 06-alert-context.png.')
p('Luồng SSO cũng đã chạy: đăng nhập admin01 tại Web A → mở Web B → Keycloak dùng phiên sẵn có, cấp token cho security-dashboard → API Web B trả 200. Chuyển ngược B → A không nhập lại mật khẩu; hai client dùng cùng sid nhưng có audience riêng. Kết quả logout và chặn token cũ được trình bày ở Hình 6.', size=11)

# PAGE 4: concrete negative and positive tests and readable images.
question(3, new_page=True)
p('Tuần 3 đã gọi API bằng token từ Keycloak thật, kiểm tra đủ 16 tổ hợp người dùng/API. HTTP 200: cho phép; 401: thiếu hoặc mất hiệu lực xác thực; 403: đã xác thực nhưng không đủ quyền.', size=11)
table(['Tài khoản', '/profile', '/manager', '/admin', '/audit'], [
    ('employee01',200,403,403,403), ('manager01',200,200,403,403),
    ('admin01',200,200,200,200), ('auditor01',200,403,403,200),
], [1.8,1.2,1.2,1.2,1.2])
caption('Bảng 1. Tất cả đường dẫn thuộc /api. Nguồn: verification.json, lượt 10:13 ngày 01/11/2026.')
picture(http_panel)
caption('Hình 4. Trình bày lại hai phản hồi HTTP đã lưu trên nền trắng; đây là trích biên bản kết quả, không phải ảnh terminal.')
p('Tuần 4: employee/manager vào Web B bị UI và API chặn (403), vẫn dùng Web A (200); auditor đọc Web B được (200) nhưng quản trị tài khoản bị chặn (403). Token Web B không dùng cho API chấm công (403). Logout ở A/B khiến token cũ bị từ chối (401); đường dẫn .env, khóa riêng và traversal bị chặn.', size=11)
picture(ASSETS/'tu-choi-truy-cap.png', width=5.3, crop=(430,356,1010,695))
caption('Hình 5. Ảnh chụp thật, phóng to thẻ nền trắng: employee01 bị từ chối ở Web B. Nguồn: 10-employee01-denied.png.')

# PAGE 5: changes, the largest technical problem, honest progress.
question(4, new_page=True)
p('Nhóm giữ phạm vi IAM theo định hướng Zero Trust và Keycloak là trung tâm danh tính. Điều chỉnh cách triển khai: hai Web dùng chung một máy chủ/gateway để hoàn thiện SSO, RBAC và HTTPS trước; audit/cảnh báo đang dùng Express + SQLite để có luồng chạy được. PostgreSQL hiện chỉ lưu dữ liệu Keycloak. LDAP/AD, audit PostgreSQL tập trung và Python Detection vẫn là hạng mục kế tiếp, chưa coi là đã hoàn thành.')
question(5)
p('Khó khăn chính là đồng bộ logout/thu hồi phiên giữa hai Web: nếu chỉ kiểm tra chữ ký và hạn token, JWT cũ vẫn có thể dùng sau khi người dùng đăng xuất. Nhóm đã bổ sung xác minh sid với Keycloak (cache tối đa 5 giây); tab đang hoạt động kiểm tra mỗi 15 giây và khi nhận focus. Nếu Keycloak không liên lạc được, API trả 503 thay vì cho qua.')
p('Kết quả: lượt 29/29 kiểm tra SSO xác nhận logout hai chiều, token A/B cũ bị trả 401. Giới hạn còn lại: tab nền bị đình chỉ có thể cập nhật muộn; máy khách thứ hai mới xác nhận truy cập HTTPS, chưa xác nhận trọn luồng CA tin cậy và đăng nhập.', size=11)
picture(logout_panel)
caption('Hình 6. Trích kết quả SSO/logout thật từ sso-results.json; không chạy lại hệ thống khi biên soạn báo cáo.')
question(6)
p('Nhóm tự ước lượng khoảng 45% toàn bộ đề tài theo các hạng mục chức năng; đây là mức tự đánh giá, không phải tỷ lệ test đạt. Nền tảng IAM, hai Web, RBAC/SSO và một phần quản trị/audit đã chạy. Nguy cơ chậm tiến độ nằm ở MFA/refresh chưa nghiệm thu, LDAP/AD chưa tích hợp, độ tin cậy thu thập log và đồng bộ Keycloak–SQLite; audit tập trung, Python và đánh giá cuối kỳ còn ở phía sau.')

# PAGE 6: specific next work and traceable saved evidence.
question(7, new_page=True)
p('Phân công dự kiến và sản phẩm cần bàn giao trong tuần 5–6:')
table(['Tuần', 'Lê Minh Nhật', 'Nguyễn Minh Tuấn'], [
    ('5', 'Hoàn thiện MFA/TOTP, required actions, refresh/phiên và thu hồi; rà soát quyền service account; chuẩn bị backup/rollback.', 'Tích hợp trạng thái MFA/phiên và lỗi vào Web A/B; củng cố gateway HTTPS; chuẩn bị collector checkpoint/retry và đối chiếu lỗi PARTIAL.'),
    ('Đầu ra tuần 5', 'Có cấu hình/mã áp dụng được và hướng dẫn khôi phục. Khi chuyển sang nghiệm thu: xác nhận OTP đúng/sai/hết hạn, refresh lỗi và token sau thu hồi.', 'Có giao diện thông báo rõ trạng thái, log chẩn đoán; hoàn tất xác minh CA và đăng nhập từ máy khách thứ hai khi nghiệm thu.'),
    ('6', 'Dựng OpenLDAP hoặc AD theo tài nguyên lab; tạo OU/group/user mẫu; cấu hình Keycloak LDAP Federation và đồng bộ thuộc tính/nhóm.', 'Tích hợp tài khoản LDAP với hai Web; đối chiếu role/trạng thái khi đổi nhóm hoặc khóa tài khoản; lưu ảnh và tổng hợp báo cáo.'),
    ('Đầu ra tuần 6', 'Tài khoản LDAP đăng nhập qua Keycloak; có bảng mapping và kết quả đồng bộ.', 'Minh chứng đăng nhập A/B bằng LDAP, thay đổi quyền/trạng thái và API cho phép/từ chối tương ứng.'),
], [0.8,2.9,2.9], size=11)
p('Hai thành viên cùng rà soát tích hợp. Mã tuần 5 đã được chuẩn bị ngày 04/11/2026 nhưng chưa kiểm thử/build hoặc áp dụng lên lab theo yêu cầu; không đưa phần này vào kết quả đạt của tuần 3–4.', size=11)
p('Đối chiếu minh chứng', bold=True, after=3)
table(['Mốc kết quả ngày 01/11/2026', 'Tệp nguồn trong word/minh_chung/tuan3_4/'], [
    ('Tuần 3: 40/40 kiểm tra cấu hình/HTTP; backend 54/54.', 'verification.json; backend-tuan3.tap'),
    ('Tuần 4: SSO 29/29; backend 73/73, build A/B đạt.', 'sso-results.json; validation-summary.json (73 là bản tổng kết đã lưu, không phải TAP).'),
    ('Mở rộng: backend 97/97, UI 42/42, API/trình duyệt 23/23.', 'backend-mo-rong.tap; ui-results.json; api-results.json'),
], [3.1,3.5], size=10.5)
p('Các bộ số liệu thuộc những lượt riêng, không cộng thành một bộ test. Test backend dùng dữ liệu/khóa kiểm thử và mô phỏng phù hợp; kiểm tra HTTP/SSO/trình duyệt dùng Keycloak thật. Ảnh chụp gốc giữ nguyên trong thư mục minh chứng; báo cáo chỉ phóng to vùng cần đọc. Không lưu mật khẩu hoặc toàn bộ token.', size=10.5, after=0)

# A quiet page number does not change the template's original page geometry.
footer = d.sections[0].footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer.paragraph_format.line_spacing = 1
run = footer.add_run('Báo cáo tuần 3–4  |  Trang ')
run.font.name = 'Times New Roman'; run.font.size = Pt(9)
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
d.core_properties.title = 'Báo cáo tuần 3–4 – IAM Zero Trust'
d.core_properties.author = 'Lê Minh Nhật; Nguyễn Minh Tuấn'
d.core_properties.subject = 'Trả lời 8 câu hỏi theo mẫu ĐACS/CN; minh chứng tuần 3–4'
d.save(OUT)

readme = '''# Minh chứng báo cáo gộp tuần 3–4

Báo cáo dùng mẫu `word/_Mẫu BC Tuần ĐACS_CN.docx`; giữ khổ trang, lề,
font Times New Roman, tiêu đề học kỳ I và 8 câu hỏi đánh số của mẫu.
Các kết quả đều là dữ liệu đã lưu ngày 01/11/2026; không chạy lại app/test/build.
Mã tuần 5 chuẩn bị ngày 04/11/2026 chưa nghiệm thu và không được tính đạt.

## Nguồn
'''
for target, source in sources.items():
    readme += f'- `{target}`: bản sao nguyên trạng từ `{source}`.\n'
readme += '''
## Hình trong báo cáo
- Hình 1: ảnh chụp Web B thật, khung hiển thị phóng to vùng nội dung.
- Hình 2: sơ đồ do người biên soạn dựng theo cấu hình; không phải ảnh chạy.
- Hình 3: ảnh chụp thật hộp Chi tiết cảnh báo, phóng to phần đầu nền trắng.
- Hình 4, 6: trình bày lại dữ liệu JSON đã lưu trên nền trắng; không phải
  ảnh DevTools/terminal và không phải một lượt kiểm thử mới.
- Hình 5: ảnh chụp thật thông báo từ chối Web B, phóng to thẻ nền trắng.

Toàn bộ PNG gốc được nhúng trong DOCX. Cropping chỉ là khung hiển thị Word;
không sửa pixel, nội dung hay dữ liệu của ảnh chụp. File nguồn cũng giữ đầy đủ.
Tỷ lệ 45% là mức tự ước lượng của báo cáo theo hạng mục, không phải số đo test.
Phân công tuần 5–6 là kế hoạch dự kiến, không phải xác nhận công việc đã xong.
'''
(ASSETS/'README.md').write_text(readme, encoding='utf-8')
print(OUT)
print(f'Questions: {len(questions)}; figures: {len(d.inline_shapes)}; tables: {len(d.tables)}')
