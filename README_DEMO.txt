ระบบจัดการ SDS (SDS Management) — เวอร์ชันทดลองใช้ (DEMO)
=====================================================================
Programming by Duongruthai_Milk

ข้อมูลทั้งหมดในชุดนี้เป็นข้อมูลสมมติของ "บริษัท ตัวอย่าง อินดัสทรี จำกัด (Demo Co., Ltd.)"
ไม่มีชื่อบริษัท/ลูกค้า/บุคคล/เบอร์โทร/อีเมล หรือ URL จริงของระบบใช้งานจริงอยู่ในชุดนี้


1) ระบบนี้คืออะไร
-----------------
เว็บแดชบอร์ดสำหรับเก็บและค้นหาเอกสารข้อมูลความปลอดภัยสารเคมี (SDS)
- ภาพรวมสัญลักษณ์ความอันตราย (GHS pictogram) กดเพื่อกรองรายการได้
- ตาราง SDS: ลำดับ, กลุ่ม, ชื่อสารไทย/อังกฤษ, Pictogram, องค์ประกอบ, CAS, อัตราส่วน,
  จุดวาบไฟ, มาตรการปฐมพยาบาล, มาตรการดับเพลิง, SDS ภาษาไทย/อังกฤษ (PDF), QR Code
- เพิ่ม / แก้ไข / ลบข้อมูล, อัปโหลด PDF (ระบบอ่านข้อมูลจาก PDF ให้อัตโนมัติ)
- ตั้งค่าความกว้างคอลัมน์ / หัวข้อตาราง / Pictogram (ใช้ร่วมกันทุกเครื่อง), ส่งออก CSV,
  QR Code ต่อรายการและ QR เข้าเว็บไซต์, หน้าสรุป SDS สำหรับพิมพ์
- หน้าเว็บ (GitHub Pages, โฟลเดอร์ docs/) + ฐานข้อมูล Google Sheets และไฟล์ PDF ใน
  Google Drive ผ่าน Google Apps Script (โฟลเดอร์ apps-script/)

ข้อมูลตัวอย่าง: สารเคมีอุตสาหกรรมทั่วไป 33 รายการ (Acetone, Ethanol, IPA, Methanol,
Toluene, Xylene, n-Hexane, Ethyl acetate, MEK, Sulfuric/Hydrochloric/Nitric/Phosphoric/
Acetic acid, NaOH, KOH, Ammonium hydroxide, Soda ash, H2O2, Sodium/Calcium hypochlorite,
Benzoyl peroxide, LPG, Acetylene, Ammonia, Chlorine, N2, O2, CO2, Diesel, Formalin,
Ethylene glycol, Mineral oil) พร้อมเลข CAS, GHS pictogram, ชื่อไทย/อังกฤษ, มาตรการ
ปฐมพยาบาล/ดับเพลิง, PPE และไฟล์ PDF ตัวอย่าง (มีลายน้ำ "DEMO ONLY – NOT A REAL SDS")
วันที่ฉบับแก้ไข/วันทบทวน คำนวณจาก "วันนี้" ทุกครั้งที่รีเซ็ต ข้อมูลจึงไม่ดูเก่า


2) บัญชีทดลอง (แสดงบนหน้าเว็บในกล่อง "บัญชีทดลอง" ด้วย)
---------------------------------------------------------
ระบบ SDS ไม่มีหน้า Login — ทุกคนเปิดดู ค้นหา และเพิ่มข้อมูลได้
การ แก้ไข / ลบ / ตั้งค่าตาราง จะถามรหัส:

    รหัสทดลอง (Demo password):  demo1234

(ตั้งไว้ที่ DEMO_ACTION_PASSWORD ใน apps-script/Demo.gs และ DEMO_PASSWORD ใน docs/config.js
 ต้องตรงกันทั้งสองที่ — setupDemo() / ทุกการรีเซ็ต จะบันทึกรหัสนี้ลง Script Properties ใหม่)


3) การรีเซ็ตอัตโนมัติทุก 3 วัน
-------------------------------
- ทุกหน้ามีแถบ "🧪 ระบบทดลองใช้ (Demo) — ข้อมูลทั้งหมดจะถูกรีเซ็ตกลับเป็นค่าเริ่มต้นทุก 3 วัน ·
  รีเซ็ตครั้งถัดไป: <วันเวลา> (อีก x วัน y ชม.)" และบรรทัดติดต่อ
- Trigger รายวัน (ตี 3 เวลาไทย) เรียก demoAutoReset() ซึ่งจะรีเซ็ตเมื่อครบ 3 วันนับจาก
  DEMO_LAST_RESET: ลบข้อมูลทั้งหมดในชีต, ลบ (ย้ายลงถังขยะ) PDF ที่ผู้ทดลองอัปโหลดในโฟลเดอร์ Demo,
  เขียนข้อมูลตัวอย่างใหม่, คืนค่าความกว้างคอลัมน์/หัวข้อ/Pictogram และรหัสทดลอง
- API แสดงเวลารีเซ็ต: action=demoInfo และอยู่ใน action=bootstrap (data.demo)


4) ขั้นตอนติดตั้ง (Deploy)
--------------------------
ก. Google Apps Script
   1. เปิด https://script.google.com > New project (สร้างโปรเจกต์ใหม่แบบ standalone)
   2. สร้างไฟล์ 3 ไฟล์ แล้วคัดลอกเนื้อหาจากโฟลเดอร์ apps-script/ ไปวาง:
        Code.gs, Demo.gs, DemoSeed.gs     (ไม่มีไฟล์ .html ในเวอร์ชัน Demo)
   3. Project Settings > ติ๊ก "Show appsscript.json manifest file in editor"
      แล้วแทนที่เนื้อหาด้วยไฟล์ appsscript.json (อยู่ที่โฟลเดอร์หลักของชุดนี้)
   4. เลือกฟังก์ชัน setupDemo แล้วกด Run หนึ่งครั้ง > อนุญาตสิทธิ์ Sheets / Drive / Trigger
      ระบบจะ: สร้าง Google Sheet "SDS Demo Database (Demo Co., Ltd.)" + โฟลเดอร์ Drive
      "SDS Demo - uploaded PDF", ใส่ข้อมูลตัวอย่าง, ตั้งรหัสทดลอง, บันทึก DEMO_LAST_RESET
      และติดตั้ง trigger demoAutoReset (วันละครั้ง) เพียงตัวเดียว
   5. Deploy > New deployment > Select type: Web app
        Execute as: Me
        Who has access: Anyone
      กด Deploy แล้วคัดลอก Web app URL ที่ลงท้ายด้วย /exec

ข. หน้าเว็บ (GitHub Pages)
   6. เปิดไฟล์ docs/config.js แล้วแทนที่ PASTE_DEPLOYED_EXEC_URL_HERE ด้วย URL /exec
      และแก้ DEMO_CONTACT (บรรทัดติดต่อบนแถบ Demo) ตามต้องการ
      (ถ้ายังไม่ใส่ URL หน้าเว็บจะขึ้น "ยังไม่ได้ตั้งค่า API" และแสดงข้อมูลตัวอย่างในเบราว์เซอร์เท่านั้น)
   7. สร้าง repository ใหม่บน GitHub แล้ว push โฟลเดอร์นี้:
        git remote add origin https://github.com/<user>/<repo>.git
        git push -u origin main
   8. GitHub > Settings > Pages > Source: Deploy from a branch > Branch: main / Folder: /docs
      เว็บจะอยู่ที่ https://<user>.github.io/<repo>/

ถ้าแก้ไฟล์ .gs ภายหลัง ต้อง Deploy > Manage deployments > Edit > Version: New version


5) ฟังก์ชันสำหรับเจ้าของระบบ (รันจาก Apps Script editor)
---------------------------------------------------------
  setupDemo()          ติดตั้งครั้งแรก (รันซ้ำได้: ใช้ Sheet/โฟลเดอร์เดิม, trigger คงเหลือ 1 ตัว)
  resetDemoNow()       รีเซ็ตข้อมูลกลับเป็นค่าเริ่มต้นทันที
  demoAutoReset()      ฟังก์ชันที่ trigger เรียกทุกวัน (รีเซ็ตเมื่อครบ 3 วัน)
  installKeepWarmTrigger() / removeKeepWarmTrigger()   (ไม่บังคับ) อุ่น cache ทุก 10 นาที
  setupSystem()        ชื่อเดิมของระบบจริง — ในเวอร์ชัน Demo จะเรียก setupDemo()
ฟังก์ชันภายใน: seedDemoData_() (ล้าง+ใส่ข้อมูลตัวอย่าง), getDemoInfo_(), nextDemoResetTime_()


6) สิ่งที่ปิด/จำกัดไว้เพื่อความปลอดภัยของ Demo
---------------------------------------------
- ไม่มีหน้า Apps Script (Index.html) — เปิด /exec ตรงๆ จะได้ข้อความ JSON แทน
  (ป้องกันไม่ให้ผู้เยี่ยมชมเรียก setupDemo/resetDemoNow ผ่าน google.script.run)
- เอาฟังก์ชันนำเข้า catalog จาก GitHub และฟังก์ชันล้างข้อมูลทั้งคอลัมน์ของระบบจริงออก
- ไม่ล็อกรหัสเมื่อใส่ผิดหลายครั้ง (รหัสเป็นสาธารณะ ล็อกแล้วผู้อื่นจะใช้ไม่ได้)
- action=file ส่งได้เฉพาะไฟล์ในโฟลเดอร์ Demo เท่านั้น (ไม่เปิดไฟล์อื่นใน Drive ของเจ้าของ)
- จำกัดข้อมูลสูงสุด 200 รายการ และไฟล์ PDF ไม่เกิน 10 MB
- ระบบนี้ไม่มีการส่งอีเมล / Teams / การแจ้งเตือนใดๆ
- ไม่มีไฟล์ SDS จริง: ใช้ PDF ตัวอย่างที่สร้างขึ้นใหม่ (docs/assets/demo-sds/)
- Storage ในเบราว์เซอร์ใช้ prefix "demo_sds_" ไม่ชนกับเว็บจริงบน github.io เดียวกัน


7) โครงสร้างไฟล์
----------------
  appsscript.json              manifest ของ Apps Script
  apps-script/Code.gs          API (doGet/doPost, cache, บันทึก/ลบ, ตั้งค่า)
  apps-script/Demo.gs          setupDemo, seedDemoData_, demoAutoReset, resetDemoNow
  apps-script/DemoSeed.gs      ข้อมูลตัวอย่าง (สร้างจาก tools/build-demo-seed.js)
  docs/index.html              หน้าเว็บหลัก (GitHub Pages)
  docs/config.js               URL /exec, DEMO_CONTACT, DEMO_PASSWORD
  docs/demo-banner.js          แถบ Demo + นับถอยหลังการรีเซ็ต
  docs/demo-seed.js            ข้อมูลตัวอย่างชุดเดียวกับใน Sheet
  docs/assets/                 pictograms, PPE, demo-sds (PDF ตัวอย่าง)
  seed/demo-seed.json          ข้อมูลตัวอย่างแบบ plain JSON (ใช้ตรวจในเทสต์)
  tools/build-demo-seed.js     แก้ข้อมูลตัวอย่างที่นี่ แล้วรัน: node tools/build-demo-seed.js
  tools/make_demo_pdfs.py      สร้าง PDF ตัวอย่างใหม่: python tools/make_demo_pdfs.py (ต้องมี reportlab)
  test/                        เทสต์ (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม, ใช้ Node.js)


8) ทดสอบในเครื่อง
-----------------
  node test/run.js          เทสต์ backend (mock Apps Script) + seed + reset + หน้าเว็บ + ตรวจชื่อจริง
  node test/page-smoke.js   รันสคริปต์หน้าเว็บแบบไม่มีเบราว์เซอร์ (โหมดไม่มี API และโหมดมี API)
  node test/server.js       เปิด http://localhost:8787/ เพื่อดูหน้าเว็บกับ API จำลอง
