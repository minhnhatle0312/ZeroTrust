from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "minh_chung"
ASSETS.mkdir(parents=True, exist_ok=True)

def font(size, bold=False):
    options = [r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
               r"C:\Windows\Fonts\segoeui.ttf"]
    for item in options:
        try:
            return ImageFont.truetype(item, size)
        except OSError:
            pass
    return ImageFont.load_default()

def panel(draw, box, fill, outline="#D9E2F0", radius=18, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def make_architecture():
    im = Image.new("RGB", (1500, 780), "#F5F8FC")
    d = ImageDraw.Draw(im)
    d.text((70, 44), "IAM ZERO TRUST | DOCKER COMPOSE", font=font(34, True), fill="#14243A")
    d.text((70, 94), "Sơ đồ minh họa được dựng từ docker-compose.yml (không phải ảnh chụp Docker Desktop)", font=font(20), fill="#52657D")
    panel(d, (90, 175, 1410, 700), "#FFFFFF", "#C8D6E8", 24, 3)
    d.text((125, 198), "Mạng nội bộ Docker: iam-network (bridge)", font=font(23, True), fill="#304A68")
    panel(d, (170, 285, 650, 600), "#EEF6FF", "#6C9ED6", 20, 3)
    d.text((210, 315), "PostgreSQL", font=font(31, True), fill="#174A7E")
    d.text((210, 365), "Container: iam-postgres", font=font(21), fill="#26394F")
    d.text((210, 405), "Image: postgres:17", font=font(21), fill="#26394F")
    d.text((210, 445), "DB/user/password đọc từ .env", font=font(19), fill="#26394F")
    d.text((210, 485), "Named volume: postgres_data", font=font(19), fill="#26394F")
    d.text((210, 525), "Healthcheck: pg_isready", font=font(19), fill="#26394F")
    panel(d, (850, 285, 1330, 600), "#F2F8F3", "#70A77D", 20, 3)
    d.text((895, 315), "Keycloak", font=font(31, True), fill="#28653B")
    d.text((895, 365), "Container: iam-keycloak", font=font(21), fill="#26394F")
    d.text((895, 405), "Image: keycloak:26.8.0", font=font(21), fill="#26394F")
    d.text((895, 445), "OIDC / start-dev", font=font(21), fill="#26394F")
    d.text((895, 485), "DB: PostgreSQL qua service DNS", font=font(19), fill="#26394F")
    d.text((895, 525), "Cổng: 127.0.0.1:8080 → 8080", font=font(19), fill="#26394F")
    d.line((650, 440, 835, 440), fill="#3F6F9F", width=6)
    d.polygon([(835,440),(810,425),(810,455)], fill="#3F6F9F")
    d.text((674, 395), "JDBC / depends_on", font=font(18, True), fill="#304A68")
    im.save(ASSETS / "so_do_docker.png")

def make_compose_excerpt():
    im = Image.new("RGB", (1500, 830), "#111827")
    d = ImageDraw.Draw(im)
    d.text((55, 35), "docker-compose.yml | trích đoạn cấu hình", font=font(29, True), fill="#E5EDF8")
    rows = [
        ("services:", "#93C5FD"),
        ("  postgres:", "#F9A8D4"),
        ("    image: postgres:17", "#D1D5DB"),
        ("    volumes:", "#D1D5DB"),
        ("      - postgres_data:/var/lib/postgresql/data", "#A7F3D0"),
        ("    healthcheck:", "#D1D5DB"),
        ("      - pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}", "#A7F3D0"),
        ("", "#D1D5DB"),
        ("  keycloak:", "#F9A8D4"),
        ("    image: quay.io/keycloak/keycloak:26.8.0", "#D1D5DB"),
        ("    command: start-dev", "#D1D5DB"),
        ("    environment: KC_DB=postgres", "#D1D5DB"),
        ("    ports: 127.0.0.1:8080:8080", "#D1D5DB"),
        ("    depends_on: postgres (service_healthy)", "#D1D5DB"),
        ("", "#D1D5DB"),
        ("volumes: postgres_data", "#93C5FD"),
        ("networks: iam-network (bridge)", "#93C5FD"),
    ]
    y = 105
    for row, color in rows:
        d.text((75, y), row, font=font(25), fill=color)
        y += 40
    d.text((55, 770), "Hình minh họa nội dung tệp nguồn; không phải ảnh chụp container đang chạy.", font=font(17), fill="#9CA3AF")
    im.save(ASSETS / "trich_doan_compose.png")

make_architecture()
make_compose_excerpt()

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(.72); sec.bottom_margin = Inches(.72)
sec.left_margin = Inches(.82); sec.right_margin = Inches(.82)
normal = doc.styles["Normal"]
normal.font.name = "Arial"; normal.font.size = Pt(11); normal.font.color.rgb = RGBColor(38, 52, 70)
normal.paragraph_format.space_after = Pt(6)
for style_name, size, color in [("Title", 25, "17365D"), ("Heading 1", 17, "17365D"), ("Heading 2", 13, "245B84")]:
    st = doc.styles[style_name]; st.font.name = "Arial"; st.font.size = Pt(size); st.font.bold = True; st.font.color.rgb = RGBColor.from_string(color)

def para(text="", bold_prefix=None, align=None):
    p = doc.add_paragraph()
    if align is not None: p.alignment = align
    if bold_prefix and text.startswith(bold_prefix):
        p.add_run(bold_prefix).bold = True; p.add_run(text[len(bold_prefix):])
    else: p.add_run(text)
    return p

def bullet(text): doc.add_paragraph(text, style="List Bullet")

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("TRƯỜNG ĐẠI HỌC CÔNG NGHỆ TP. HỒ CHÍ MINH (HUTECH)"); r.bold = True; r.font.size = Pt(15); r.font.color.rgb = RGBColor(23,54,93)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("KHOA/VIỆN: ........................................................"); r.font.size = Pt(12)
for _ in range(2): doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("BÁO CÁO TUẦN 1"); r.bold=True; r.font.size=Pt(25); r.font.color.rgb=RGBColor(23,54,93)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("ĐỒ ÁN CHUYÊN NGÀNH"); r.bold=True; r.font.size=Pt(19)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Đề tài: IAM ZERO TRUST"); r.bold=True; r.font.size=Pt(17); r.font.color.rgb=RGBColor(36,91,132)
for _ in range(2): doc.add_paragraph()
for line in ["Chuyên ngành: AN NINH MẠNG", "Sinh viên: ........................................................................", "Mã số sinh viên: .............................................................", "Giảng viên hướng dẫn: .....................................................", "Lớp: ..............................................  Niên khóa: ................"]:
    p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run(line).font.size=Pt(12)
for _ in range(2): doc.add_paragraph()
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.add_run("TP. Hồ Chí Minh, tháng ........................ năm 2026").italic=True
doc.add_page_break()

doc.add_heading("1. Thông tin và mục tiêu tuần", 1)
para("Tên dự án: IAM-ZEROTRUST. Báo cáo này tổng hợp những thành phần hiện có trong mã nguồn tại thời điểm lập báo cáo; nội dung được đối chiếu trực tiếp với docker-compose.yml, backend/server.js và web-a/src.")
para("Mục tiêu tuần 1 là dựng nền tảng quản lý danh tính và kiểm soát truy cập: có dịch vụ cấp danh tính (Keycloak), cơ sở dữ liệu lưu dữ liệu của Keycloak (PostgreSQL), API kiểm tra token và vai trò, cùng giao diện minh họa các tài nguyên theo quyền.")
para("Phạm vi minh chứng: cấu hình và mã nguồn đã có trong thư mục dự án. Môi trường hiện tại không có lệnh Docker khả dụng nên báo cáo không khẳng định các container đã được khởi chạy hoặc kiểm thử thành công.")

doc.add_heading("2. Các nội dung đã thực hiện", 1)
doc.add_heading("2.1. Tổ chức dịch vụ bằng Docker Compose", 2)
para("Tệp docker-compose.yml khai báo hai dịch vụ: postgres dùng image postgres:17 và keycloak dùng quay.io/keycloak/keycloak:26.8.0. Hai dịch vụ cùng tham gia mạng iam-network kiểu bridge; Keycloak kết nối PostgreSQL bằng tên dịch vụ postgres trên cổng 5432.")
para("Tác dụng: mô tả hạ tầng trong một tệp thống nhất, giúp các dịch vụ có cấu hình mạng và phụ thuộc rõ ràng, giảm thao tác cài đặt thủ công và thuận tiện tái tạo môi trường trên máy khác.")
para("Cách triển khai dự kiến: cài Docker Desktop/Engine và Compose; điền các biến môi trường cần thiết vào .env; từ thư mục gốc chạy `docker compose config` để kiểm tra cú pháp, sau đó `docker compose up -d` để khởi chạy. Dùng `docker compose ps` và `docker compose logs` để kiểm tra trạng thái. Các lệnh này là hướng dẫn triển khai, chưa được xác nhận chạy trong môi trường lập báo cáo.")
para("Vì sao chọn cách này: PostgreSQL và Keycloak cần trao đổi ổn định; Compose gom cấu hình, network, volume và thứ tự sẵn sàng vào một nơi, phù hợp giai đoạn phát triển đồ án.")

doc.add_heading("2.2. Lưu trữ dữ liệu và kiểm tra trạng thái PostgreSQL", 2)
para("PostgreSQL được gắn named volume postgres_data tại /var/lib/postgresql/data. Healthcheck chạy pg_isready theo thông tin DB/user lấy từ biến môi trường; Keycloak có depends_on với điều kiện service_healthy.")
para("Tác dụng: volume giúp dữ liệu tồn tại qua vòng đời container; healthcheck giúp Keycloak chờ database sẵn sàng trước khi khởi động, giảm lỗi kết nối do chạy đua thời điểm.")
para("Vì sao làm như vậy: danh tính và cấu hình realm cần được lưu bền vững; việc xác định trạng thái sẵn sàng thực tế đáng tin cậy hơn chỉ dựa vào việc container đã bắt đầu chạy.")

doc.add_heading("2.3. Khởi tạo nền tảng Keycloak", 2)
para("Keycloak được cấu hình dùng PostgreSQL, đọc tài khoản quản trị khởi tạo từ biến môi trường và chạy chế độ start-dev. Cổng HTTP 8080 trong container được ánh xạ chỉ trên loopback máy phát triển: 127.0.0.1:8080.")
para("Tác dụng: Keycloak đảm nhiệm dịch vụ quản lý danh tính và OIDC để ứng dụng có thể đăng nhập, nhận access token và dùng thông tin danh tính/role trong token.")
para("Vì sao làm như vậy: tách chức năng xác thực khỏi từng ứng dụng giúp dùng chung nhà cung cấp danh tính. Giới hạn bind vào loopback giảm việc phơi cổng ra các giao diện mạng khác trong môi trường phát triển. start-dev dành cho phát triển, không phải cấu hình triển khai production.")

doc.add_heading("2.4. Xây dựng Employee API có xác thực và phân quyền", 2)
para("backend/server.js tạo Express API, đọc cấu hình issuer, audience và nguồn gốc frontend. Middleware authenticate yêu cầu Bearer token, xác minh chữ ký RS256 bằng JWKS từ Keycloak, đồng thời kiểm tra issuer và audience. Middleware requireRole kiểm tra role trước khi cho phép truy cập tài nguyên.")
para("Các endpoint hiện có: GET /health; GET /api/profile yêu cầu token hợp lệ; GET /api/manager cho manager hoặc admin; GET /api/admin chỉ cho admin; GET /api/audit cho auditor hoặc admin. Thiếu hoặc token không hợp lệ trả 401; thiếu role trả 403.")
para("Tác dụng: kiểm tra quyền ở phía máy chủ trên từng yêu cầu, giảm nguy cơ chỉ ẩn nút ở giao diện nhưng API vẫn bị gọi trực tiếp. Cách này thể hiện nguyên tắc xác minh rõ ràng và cấp quyền tối thiểu theo vai trò.")
para("Vì sao làm như vậy: giao diện người dùng không phải ranh giới bảo mật. API cần tự xác minh token và quyết định quyền tại nơi tài nguyên được phục vụ.")

doc.add_heading("2.5. Tạo giao diện IAM Portal tích hợp Keycloak", 2)
para("web-a dùng React/Vite và thư viện keycloak-js. Cấu hình mặc định trỏ tới Keycloak tại localhost:8080, realm company-iam, client employee-portal; API mặc định tại localhost:3001. Giao diện hiển thị danh tính, role và các nút gọi endpoint profile, manager, admin, audit; khi gọi API, frontend gửi access token trong Authorization: Bearer.")
para("Tác dụng: cung cấp màn hình trình diễn luồng đăng nhập và kiểm tra quyền theo vai trò, giúp người dùng quan sát kết quả ALLOW/DENY từ API.")
para("Vì sao làm như vậy: giao diện làm rõ luồng hoạt động end-to-end và giúp minh họa sự khác nhau giữa xác thực (ai đang truy cập) với phân quyền (được truy cập tài nguyên nào).")

doc.add_heading("3. Minh chứng cấu hình Docker", 1)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.add_run().add_picture(str(ASSETS / "so_do_docker.png"), width=Inches(6.45))
p=doc.add_paragraph("Hình 1. Sơ đồ dịch vụ được dựng từ cấu hình Compose trong dự án. Đây là hình minh họa nội dung cấu hình, không phải ảnh chụp Docker Desktop hoặc bằng chứng container đang chạy.")
p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.runs[0].italic=True
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.add_run().add_picture(str(ASSETS / "trich_doan_compose.png"), width=Inches(6.45))
p=doc.add_paragraph("Hình 2. Trích đoạn cấu hình Compose được dựng lại để trình bày các mục service, volume, healthcheck, port và network; cần thay/bổ sung ảnh Docker Desktop thật sau khi chạy dự án.")
p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.runs[0].italic=True

doc.add_heading("4. Quy trình triển khai và cách chụp minh chứng thực tế", 1)
for item in [
    "Mở Docker Desktop, bảo đảm Docker Engine đang chạy.",
    "Tại thư mục gốc IAM-ZeroTrust, kiểm tra cấu hình bằng `docker compose config`.",
    "Khởi chạy PostgreSQL và Keycloak bằng `docker compose up -d`; chờ healthcheck PostgreSQL đạt trạng thái healthy.",
    "Kiểm tra `docker compose ps`; chụp ảnh màn hình thấy các container iam-postgres và iam-keycloak cùng trạng thái thực tế.",
    "Mở http://localhost:8080 để kiểm tra giao diện quản trị Keycloak; chụp ảnh trang hoặc màn hình phù hợp, tránh để lộ thông tin đăng nhập.",
    "Chạy backend và frontend theo cấu hình môi trường tương ứng; đăng nhập rồi thử endpoint theo role, lưu ảnh cả trường hợp được phép và bị từ chối nếu đã kiểm chứng.",
    "Thay hình minh họa trong word/minh_chung bằng ảnh chụp thật, ghi ngày chụp và trạng thái; không đưa mật khẩu, token hoặc dữ liệu nhạy cảm vào ảnh/báo cáo."
]: bullet(item)

doc.add_heading("5. Tệp và cấu phần tham chiếu", 1)
for item in ["docker-compose.yml — dịch vụ PostgreSQL, Keycloak, volume, healthcheck, cổng và mạng.",
             "backend/server.js — xác minh JWT/JWKS, kiểm soát role và các endpoint API.",
             "backend/.env.example — mẫu cấu hình backend và kết nối giao diện.",
             "web-a/src/keycloak.js — cấu hình client OIDC phía trình duyệt.",
             "web-a/src/App.jsx — giao diện hiển thị danh tính, role và gọi API."]:
    bullet(item)

doc.add_heading("6. Đánh giá tuần 1 và công việc tiếp theo", 1)
para("Nền tảng mã nguồn đã thể hiện các thành phần chính cho bài toán IAM Zero Trust: định danh tập trung, token OIDC, xác minh token tại API, phân quyền theo role và hạ tầng Compose cho Keycloak/PostgreSQL. Mức đánh giá này dựa trên đọc cấu hình/mã nguồn; chưa phải kết quả nghiệm thu chạy thực tế.")
para("Công việc tiếp theo: chạy Compose trên máy có Docker; xác nhận trạng thái healthy và đăng nhập Keycloak; cấu hình realm/client/role để khớp các giá trị company-iam, employee-portal, employee-api; kiểm thử lần lượt 401, 403 và 200/ALLOW; ghi nhận ảnh chụp thật; rà soát cấu hình vận hành trước khi triển khai ngoài môi trường phát triển.")

doc.add_heading("7. Xác nhận", 1)
para("Sinh viên thực hiện                                      Giảng viên hướng dẫn")
para("(Ký và ghi rõ họ tên)                                    (Ký và ghi rõ họ tên)")
for _ in range(3): doc.add_paragraph()
para("..............................................                 ..............................................")

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run("Báo cáo tuần 1 | Đồ án chuyên ngành An ninh mạng | IAM-ZEROTRUST").font.size = Pt(9)
doc.save(ROOT / "báo cáo tuần 1 đồ án chuyên ngành.docx")
