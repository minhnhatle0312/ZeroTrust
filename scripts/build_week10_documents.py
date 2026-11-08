"""Generate draft Word/PowerPoint handoff artifacts only; no application execution or tests."""
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/ban_giao'


def plain(text):
    return re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', text).replace('**', '').replace('`', '')


def word():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = section.bottom_margin = Cm(2.2)
    section.left_margin, section.right_margin = Cm(3), Cm(2)
    style = doc.styles['Normal']
    style.font.name, style.font.size = 'Times New Roman', Pt(13)
    style.paragraph_format.line_spacing = 1.35
    style.paragraph_format.space_after = Pt(6)
    for name, size in [('Title',22),('Heading 1',16),('Heading 2',14)]:
        doc.styles[name].font.name = 'Times New Roman'
        doc.styles[name].font.size = Pt(size)
        doc.styles[name].font.color.rgb = RGBColor.from_string('16384B')
    section.header.paragraphs[0].text = 'NHỊP IAM  |  BẢN THẢO ĐÃ KIỂM THỬ LAB'
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.text = 'Lê Minh Nhật · Nguyễn Minh Tuấn  |  Cập nhật 08/11/2026'
    lines = (ROOT / 'docs/BAO_CAO_TONG_HOP.md').read_text(encoding='utf-8').splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [plain(c.strip()) for c in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[:\-\s]+', c) for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                table = doc.add_table(rows=1, cols=len(rows[0]))
                table.style = 'Light Shading Accent 1'
                table.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
                for j, value in enumerate(rows[0]):
                    table.rows[0].cells[j].text = value
                for row in rows[1:]:
                    cells = table.add_row().cells
                    for j, value in enumerate(row[:len(cells)]):
                        cells[j].text = value
            continue
        if line.startswith('# '):
            paragraph = doc.add_paragraph(plain(line[2:]), 'Title')
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif line.startswith('## '):
            doc.add_heading(plain(line[3:]), 1)
        elif line.startswith('- '):
            doc.add_paragraph(plain(line[2:]), 'List Bullet')
        elif line.strip():
            doc.add_paragraph(plain(line))
        i += 1
    doc.add_page_break()
    doc.add_heading('Phụ lục — chỉ dẫn hồ sơ bàn giao', 1)
    for name in ['TUAN_8_TRIEN_KHAI.md','TUAN_9_TRIEN_KHAI.md','TUAN_9_NGHIEM_THU.md','TUAN_10_TRIEN_KHAI.md',
                 'KIEN_TRUC_VA_LUONG_HE_THONG.md','BAN_GIAO_VA_VAN_HANH.md','KICH_BAN_DEMO_VA_VIDEO.md']:
        doc.add_paragraph('docs/' + name, 'List Bullet')
    doc.add_paragraph('Kết quả thực tế: docs/KET_QUA_KIEM_THU_2026_11_08.md. Dataset mô phỏng, ảnh và video thao tác được lưu tại evidence/release; chưa thay bằng chứng máy vật lý thứ hai.')
    for filename,caption in [('central-audit-desktop.png','Audit PostgreSQL trên lab HTTPS'),('detection-metrics.png','Kết quả trên 27 mẫu mô phỏng; không suy rộng thành độ chính xác vận hành')]:
        screenshot=ROOT/'evidence/release'/filename
        if screenshot.exists():
            doc.add_page_break()
            doc.add_heading(caption, 2)
            doc.add_picture(str(screenshot),width=Cm(15))
    doc.save(OUTPUT / 'BaoCaoTongHop_IAM_Tuan5-10_DRAFT.docx')


NS = 'http://schemas.openxmlformats.org'
A = NS + '/drawingml/2006/main'
P = NS + '/presentationml/2006/main'
R = NS + '/officeDocument/2006/relationships'
GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'


def xml(raw):
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + raw


def rels(items):
    return xml('<Relationships xmlns="'+NS+'/package/2006/relationships">'+''.join('<Relationship Id="'+key+'" Type="'+R+'/'+kind+'" Target="'+target+'"/>' for key,kind,target in items)+'</Relationships>')


def shape(key, x, y, width, height, text='', size=22, color='173449', fill=None, bold=False):
    # Native editable shapes; no raster screenshots or fabricated evidence.
    unit = 914400
    coords = (int(x*unit),int(y*unit),int(width*unit),int(height*unit))
    paragraphs = ''.join('<a:p><a:pPr marL="0" marR="0"/><a:r><a:rPr lang="vi-VN" sz="'+str(size*100)+'" b="'+('1' if bold else '0')+'"><a:solidFill><a:srgbClr val="'+color+'"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>'+escape(line)+'</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p>' for line in text.split('\n'))
    background = '<a:solidFill><a:srgbClr val="'+fill+'"/></a:solidFill>' if fill else '<a:noFill/>'
    return '<p:sp><p:nvSpPr><p:cNvPr id="'+str(key)+'" name="Shape '+str(key)+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="%s" y="%s"/><a:ext cx="%s" cy="%s"/></a:xfrm>' % coords + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+background+'<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="140000" rIns="140000" tIns="100000" bIns="100000"/><a:lstStyle/>'+paragraphs+'</p:txBody></p:sp>'


def powerpoint():
    slides = []
    for line in (ROOT / 'docs/SLIDE_BAO_VE.md').read_text(encoding='utf-8').splitlines():
        if line.startswith('## '):
            slides.append((line[3:], []))
        elif line.startswith('- ') and slides:
            slides[-1][1].append(line[2:])
    count = len(slides)
    types = '<Types xmlns="'+NS+'/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    for part, kind in [('presentation','presentation.main'),('slideMasters/slideMaster1','slideMaster'),('slideLayouts/slideLayout1','slideLayout')]:
        types += '<Override PartName="/ppt/'+part+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.'+kind+'+xml"/>'
    types += '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    types += ''.join('<Override PartName="/ppt/slides/slide'+str(i)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1,count+1))+'</Types>'
    with zipfile.ZipFile(OUTPUT / 'BaoVe_IAM_Tuan5-10_DRAFT.pptx','w',zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr('[Content_Types].xml',xml(types))
        bundle.writestr('_rels/.rels',rels([('rId1','officeDocument','ppt/presentation.xml')]))
        bundle.writestr('ppt/presentation.xml',xml('<p:presentation xmlns:a="'+A+'" xmlns:r="'+R+'" xmlns:p="'+P+'"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+''.join('<p:sldId id="'+str(255+i)+'" r:id="rId'+str(i+1)+'"/>' for i in range(1,count+1))+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>'))
        bundle.writestr('ppt/_rels/presentation.xml.rels',rels([('rId1','slideMaster','slideMasters/slideMaster1.xml')]+[('rId'+str(i+1),'slide','slides/slide'+str(i)+'.xml') for i in range(1,count+1)]))
        clr='<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
        bundle.writestr('ppt/slideMasters/slideMaster1.xml',xml('<p:sldMaster xmlns:a="'+A+'" xmlns:r="'+R+'" xmlns:p="'+P+'"><p:cSld><p:spTree>'+GROUP+'</p:spTree></p:cSld>'+clr+'<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'))
        bundle.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels',rels([('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','theme','../theme/theme1.xml')]))
        bundle.writestr('ppt/slideLayouts/slideLayout1.xml',xml('<p:sldLayout xmlns:a="'+A+'" xmlns:r="'+R+'" xmlns:p="'+P+'" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>'+GROUP+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'))
        bundle.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels',rels([('rId1','slideMaster','../slideMasters/slideMaster1.xml')]))
        colors={'dk1':'173449','lt1':'FFFFFF','dk2':'315569','lt2':'F1F6F7','accent1':'208C83','accent2':'537DB2','accent3':'C88A35','accent4':'B45B6A','accent5':'7869A3','accent6':'5B8994','hlink':'2168AE','folHlink':'7869A3'}
        fills=''.join('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' for _ in range(3))
        lines=''.join('<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>' for _ in range(3))
        effects=''.join('<a:effectStyle><a:effectLst/></a:effectStyle>' for _ in range(3))
        theme='<a:theme xmlns:a="'+A+'" name="Nhip IAM"><a:themeElements><a:clrScheme name="Nhip">'+''.join('<a:'+k+'><a:srgbClr val="'+v+'"/></a:'+k+'>' for k,v in colors.items())+'</a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Nhip"><a:fillStyleLst>'+fills+'</a:fillStyleLst><a:lnStyleLst>'+lines+'</a:lnStyleLst><a:effectStyleLst>'+effects+'</a:effectStyleLst><a:bgFillStyleLst>'+fills+'</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'
        bundle.writestr('ppt/theme/theme1.xml',xml(theme))
        for index,(title,bullets) in enumerate(slides,1):
            pieces=[shape(2,0,0,13.333,7.5,fill='F1F6F7'),shape(3,0,0,0.16,7.5,fill='208C83'),
                    shape(4,.55,.35,12,.45,'NHỊP IAM  /  ĐỒ ÁN CHUYÊN NGÀNH',13,'208C83',bold=True),
                    shape(5,.55,1.0,12.1,1.1,title,30,bold=True),
                    shape(6,.6,6.83,10.8,.35,'BẢN THẢO ĐÃ KIỂM THỬ LAB  |  08/11/2026',10,'647989'),
                    shape(7,11.8,6.82,1,.4,f'{index:02d} / {count:02d}',11,'208C83',bold=True)]
            for j,bullet in enumerate(bullets[:4]):
                pieces.append(shape(10+j*2,.7,2.25+j*1.03,.55,.73,str(j+1),17,'208C83',fill='DDEFEA',bold=True))
                pieces.append(shape(11+j*2,1.4,2.25+j*1.03,11.1,.87,bullet,20,fill='FFFFFF'))
            bundle.writestr(f'ppt/slides/slide{index}.xml',xml('<p:sld xmlns:a="'+A+'" xmlns:r="'+R+'" xmlns:p="'+P+'"><p:cSld><p:spTree>'+GROUP+''.join(pieces)+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'))
            bundle.writestr(f'ppt/slides/_rels/slide{index}.xml.rels',rels([('rId1','slideLayout','../slideLayouts/slideLayout1.xml')]))


if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    word()
    powerpoint()
    print('Generated draft Word and 15-slide PowerPoint under docs/ban_giao. No application or tests executed.')
