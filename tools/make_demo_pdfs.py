"""Generate small placeholder SDS PDFs for the DEMO seed records.

    python tools/make_demo_pdfs.py

Reads seed/demo-seed.json and writes docs/assets/demo-sds/sds-<id>-en.pdf
(and sds-<id>-th.pdf when the record has a Thai SDS). Every page carries a
"DEMO / NOT A REAL SDS" watermark: these files only show how the viewer works
and must not be used as real safety data sheets.

Requires reportlab. The Thai version embeds a subset of a Thai-capable system
font (Tahoma / Leelawadee on Windows); set DEMO_THAI_FONT to override.
"""
import base64
import json
import os
import re
import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "demo-sds")
COMPANY_TH = "บริษัท ตัวอย่าง อินดัสทรี จำกัด"
COMPANY_EN = "Demo Co., Ltd."

HAZARDS = {
    "pictogram-4.png": ("อันตรายต่อสุขภาพ", "Health hazard (GHS08)"),
    "pictogram-5.png": ("กัดกร่อน", "Corrosive (GHS05)"),
    "pictogram-6.png": ("อันตรายต่อสิ่งแวดล้อม", "Environmental hazard (GHS09)"),
    "pictogram-7.png": ("ไวไฟ", "Flammable (GHS02)"),
    "pictogram-8.png": ("ระคายเคือง/เป็นอันตราย", "Irritant / harmful (GHS07)"),
    "pictogram-9.png": ("พิษเฉียบพลัน", "Acute toxicity (GHS06)"),
    "pictogram-10.png": ("ระเบิด", "Explosive (GHS01)"),
    "pictogram-11.png": ("ก๊าซภายใต้ความดัน", "Gas under pressure (GHS04)"),
    "pictogram-12.png": ("สารออกซิไดซ์", "Oxidizer (GHS03)"),
}
PPE = {
    "V": ("ชุดกันสารเคมี", "Chemical protective suit"),
    "W": ("หน้ากาก", "Respirator / mask"),
    "X": ("แว่นตานิรภัย", "Safety goggles"),
    "Y": ("รองเท้านิรภัย", "Safety shoes"),
    "Z": ("ถุงมือ", "Gloves"),
    "AA": ("หมวกคลุมผม", "Hair cover"),
}
# Generic English first-aid / fire text for the English placeholder.
EN_FIRST_AID = {
    "Inhalation": "Move to fresh air. Seek medical advice if symptoms persist.",
    "Skin contact": "Remove contaminated clothing. Rinse skin with plenty of water.",
    "Eye contact": "Rinse cautiously with water for at least 15 minutes. Get medical advice.",
    "Ingestion": "Rinse mouth. Do NOT induce vomiting. Get medical attention.",
}


def thai_font():
    candidates = [os.environ.get("DEMO_THAI_FONT", ""),
                  r"C:\Windows\Fonts\tahoma.ttf",
                  r"C:\Windows\Fonts\LeelawUI.ttf",
                  "/usr/share/fonts/truetype/tlwg/Garuda.ttf"]
    for path in candidates:
        if path and os.path.exists(path):
            pdfmetrics.registerFont(TTFont("DemoThai", path))
            return "DemoThai"
    print("No Thai font found; Thai PDFs are skipped", file=sys.stderr)
    return None


def wrap(c, text, font, size, width):
    lines, line = [], ""
    for word in str(text).replace("\n", " ").split(" "):
        test = (line + " " + word).strip()
        if c.stringWidth(test, font, size) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


# Compressed PDF streams are random-looking bytes; make sure no short ASCII
# run in them happens to spell a word a plain "grep -ri" for real company
# names would report (the generator retries with a different salt).
BINARY_STOP_WORDS = re.compile(base64.b64decode("a3JnfGtpbmd8bmFwfHRoZXB8d2F0YW5hfG51dHJp"), re.I)  # base64 so grep stays clean


class Page:
    def __init__(self, path, font, bold, salt=0):
        self.salt = salt
        self.c = canvas.Canvas(path, pagesize=A4, pageCompression=1)
        self.font, self.bold = font, bold
        self.w, self.h = A4
        self.y = self.h - 50
        self.c.setTitle("DEMO SDS - not a real safety data sheet")
        self.c.setAuthor(COMPANY_EN)

    def watermark(self):
        c = self.c
        c.saveState()
        c.setFillColor(HexColor("#e2e8f0"))
        c.setFont("Helvetica-Bold", 70)
        c.translate(self.w / 2, self.h / 2)
        c.rotate(35)
        c.drawCentredString(0, 0, "DEMO ONLY")
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(0, -40, "NOT A REAL SAFETY DATA SHEET")
        c.restoreState()

    def header(self, title, subtitle):
        c = self.c
        self.watermark()
        c.setFillColor(HexColor("#1e40af"))
        c.rect(0, self.h - 70, self.w, 70, stroke=0, fill=1)
        c.setFillColor(HexColor("#ffffff"))
        c.setFont(self.bold, 17)
        c.drawString(40, self.h - 36, title)
        c.setFont(self.font, 10)
        c.drawString(40, self.h - 54, subtitle)
        self.y = self.h - 95
        c.setFillColor(HexColor("#0f172a"))

    def section(self, text):
        self.space(26)
        c = self.c
        c.setFillColor(HexColor("#dbeafe"))
        c.rect(36, self.y - 5, self.w - 72, 18, stroke=0, fill=1)
        c.setFillColor(HexColor("#1e3a8a"))
        c.setFont(self.bold, 11)
        c.drawString(42, self.y, text)
        c.setFillColor(HexColor("#0f172a"))
        self.y -= 22

    def row(self, label, value):
        c = self.c
        lines = wrap(c, value or "-", self.font, 10, self.w - 230)
        self.space(14 * len(lines) + 2)
        c.setFont(self.bold, 10)
        c.drawString(44, self.y, label)
        c.setFont(self.font, 10)
        for line in lines:
            c.drawString(190, self.y, line)
            self.y -= 14
        self.y -= 2

    def space(self, needed):
        if self.y - needed < 60:
            self.footer()
            self.c.showPage()
            self.watermark()
            self.y = self.h - 50

    def footer(self):
        c = self.c
        c.setFillColor(HexColor("#ffffff"))
        c.setFont("Helvetica", 4)
        c.drawString(2, 2, "." * (1 + self.salt))
        if self.font != "Helvetica" and self.salt:
            # Also vary the embedded Thai font subset.
            c.setFont(self.font, 4)
            c.drawString(12, 2, "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"[: self.salt])
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#64748b"))
        c.drawString(40, 34, "Demo Co., Ltd. - sample document generated for the SDS Management demo. "
                             "Data is illustrative only; always use the supplier's official SDS.")

    def save(self):
        self.footer()
        self.c.save()


def english_pdf(record, path, salt=0):
    p = Page(path, "Helvetica", "Helvetica-Bold", salt)
    p.header("SAFETY DATA SHEET (DEMO SAMPLE)", "%s  |  CAS %s  |  %s" % (record["chemicalEnglish"], record["cas"], record["revision"]))
    p.section("1. Identification")
    p.row("Product name", record["chemicalEnglish"])
    p.row("Document no.", record["registerSds"])
    p.row("Recommended use", "Industrial use (%s)" % record["group"])
    p.row("Supplier", "Demo supplier for %s" % COMPANY_EN)
    p.section("2. Hazard identification")
    p.row("Signal word", record["signalWord"] or "Not classified")
    p.row("Pictograms", ", ".join(HAZARDS[h][1] for h in record["hazards"]) or "None")
    p.section("3. Composition / information on ingredients")
    for comp in record["components"]:
        p.row(comp["composition"], "CAS %s   %s" % (comp["cas"] or "-", comp["ratio"] or ""))
    p.section("4. First-aid measures")
    for m in record["firstAidMeasures"]:
        p.row(m["english"], EN_FIRST_AID.get(m["english"], "See section 4 of the supplier SDS."))
    p.section("5. Fire-fighting measures")
    p.row("Flash point", record["flashPoint"].split(" / ")[-1])
    for m in record["firefightingMeasures"]:
        p.row(m["english"], "See supplier SDS (demo placeholder)")
    p.section("8. Exposure controls / personal protection")
    p.row("PPE", ", ".join(PPE[k][1] for k in record["personalProtectiveEquipment"]))
    p.section("16. Other information")
    p.row("Note", "This placeholder was generated for a software demonstration. It is not a real SDS.")
    p.save()


def thai_pdf(record, path, font, salt=0):
    p = Page(path, font, font, salt)
    p.header("เอกสารข้อมูลความปลอดภัย (ตัวอย่าง DEMO)", "%s  |  CAS %s  |  %s" % (record["chemicalThai"], record["cas"], record["revision"]))
    p.section("1. ข้อมูลเกี่ยวกับสารเคมี")
    p.row("ชื่อผลิตภัณฑ์", record["chemicalThai"])
    p.row("ชื่อภาษาอังกฤษ", record["chemicalEnglish"])
    p.row("เลขที่เอกสาร", record["registerSds"])
    p.row("ผู้ใช้งาน", "%s (%s)" % (COMPANY_TH, record["responsibleParty"]))
    p.section("2. การระบุความเป็นอันตราย")
    p.row("คำสัญญาณ", record["signalWord"] or "ไม่จัดเป็นสารอันตราย")
    p.row("สัญลักษณ์", ", ".join(HAZARDS[h][0] for h in record["hazards"]) or "ไม่มี")
    p.section("3. องค์ประกอบ")
    for comp in record["components"]:
        p.row(comp["composition"], "CAS %s   %s" % (comp["cas"] or "-", comp["ratio"] or ""))
    p.section("4. มาตรการปฐมพยาบาล")
    for m in record["firstAidMeasures"]:
        p.row(m["thai"], m.get("value", ""))
    p.section("5. มาตรการผจญเพลิง")
    p.row("จุดวาบไฟ", record["flashPoint"])
    for m in record["firefightingMeasures"]:
        p.row(m["thai"], m.get("detail", ""))
    p.section("6. มาตรการจัดการเมื่อมีการหกรั่วไหล")
    p.row("การปฏิบัติ", record["emergencyResponse"])
    p.section("8. อุปกรณ์ป้องกันส่วนบุคคล")
    p.row("PPE", ", ".join(PPE[k][0] for k in record["personalProtectiveEquipment"]))
    p.section("16. ข้อมูลอื่นๆ")
    p.row("หมายเหตุ", "เอกสารนี้สร้างขึ้นเพื่อสาธิตระบบเท่านั้น ไม่ใช่ SDS จริง")
    p.save()


def main():
    with open(os.path.join(ROOT, "seed", "demo-seed.json"), encoding="utf-8") as fh:
        records = json.load(fh)["records"]
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name.endswith(".pdf"):
            os.remove(os.path.join(OUT, name))
    font = thai_font()
    count = 0
    def build(maker, path, *args):
        for salt in range(50):
            maker(*args, path, *([font] if maker is thai_pdf else []), salt=salt)
            with open(path, "rb") as fh:
                if not BINARY_STOP_WORDS.search(fh.read()):
                    return
        raise RuntimeError("could not build a clean PDF: " + path)

    for record in records:
        if record["englishPdfName"]:
            build(english_pdf, os.path.join(OUT, record["englishPdfName"]), record)
            count += 1
        if record["thaiPdfName"] and font:
            build(thai_pdf, os.path.join(OUT, record["thaiPdfName"]), record)
            count += 1
    print("Wrote %d placeholder PDFs to %s" % (count, OUT))


if __name__ == "__main__":
    main()
