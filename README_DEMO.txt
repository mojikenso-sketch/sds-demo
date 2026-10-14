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
- เพิ่ม / แก้ไขข้อมูล (ข้อความ)  [เวอร์ชันเต็ม: ลบ, อัปโหลด PDF + อ่านข้อมูลจาก PDF อัตโนมัติ]
- QR Code ต่อรายการและ QR เข้าเว็บไซต์, หน้าสรุป SDS
  [เวอร์ชันเต็ม: ตั้งค่าความกว้างคอลัมน์ / หัวข้อตาราง / Pictogram, ส่งออก CSV, พิมพ์]
- เดโมนี้เป็นเวอร์ชัน "ลองดูภาพรวม" — ฟีเจอร์เวอร์ชันเต็มแสดงปุ่มพร้อม 🔒 (ดูข้อ 6)
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
การ แก้ไข จะถามรหัส:

    รหัสทดลอง (Demo password):  demo1234

(ตั้งไว้ที่ DEMO_ACTION_PASSWORD ใน apps-script/Demo.gs และ DEMO_PASSWORD ใน docs/config.js
 ต้องตรงกันทั้งสองที่ — setupDemo() / ทุกการรีเซ็ต จะบันทึกรหัสนี้ลง Script Properties ใหม่)


3) การรีเซ็ตอัตโนมัติทุก 5 ชั่วโมง + สิทธิ์ทดลอง 5 ชั่วโมงต่อคน
-------------------------------------------------------------
- ทุกหน้ามีแถบ "🧪 ระบบทดลองใช้ (Demo) — ข้อมูลส่วนกลางรีเซ็ตเป็นค่าเริ่มต้นทุก 5 ชั่วโมง ·
  ผู้ทดลองแต่ละคนใช้งานได้ 5 ชั่วโมง · รีเซ็ตครั้งถัดไป: <วันเวลา> (อีก x ชม. y นาที)" และบรรทัดติดต่อ
- Trigger รายชั่วโมง (everyHours(1)) เรียก demoAutoReset() ซึ่งจะรีเซ็ตเมื่อครบ 5 ชั่วโมง
  (DEMO_RESET_HOURS = 5 ใน apps-script/Demo.gs) นับจาก DEMO_LAST_RESET
  (เผื่อ trigger ทำงานเร็วกว่ากำหนดได้ไม่เกิน 1 นาที: DEMO_RESET_TOLERANCE_MS) ดังนั้น
  การรีเซ็ตจริงจะเกิดภายใน 1 ชั่วโมงหลังเวลาที่แสดง ("กำลังรีเซ็ต ภายใน 1 ชม.")
  การรีเซ็ต: ลบข้อมูลทั้งหมดในชีต, ลบ (ย้ายลงถังขยะ) PDF ในโฟลเดอร์ Demo,
  เขียนข้อมูลตัวอย่างใหม่ (วันที่คำนวณจากเวลารีเซ็ต), คืนค่าความกว้างคอลัมน์/หัวข้อ/Pictogram และรหัสทดลอง
- API แสดงเวลารีเซ็ต: action=demoInfo และอยู่ใน action=bootstrap (data.demo)
  nextReset = lastReset + 5 ชั่วโมง, intervalHours = 5
- สิทธิ์ทดลองต่อคน (นับตาม IP + อุปกรณ์): docs/trial-gate.js (คัดลอกมาจากโปรเจกต์ TrialGate
  โดยไม่แก้ไข) แสดงป้ายนับถอยหลังมุมซ้ายล่าง และหน้าจอ "หมดเวลาทดลอง" เมื่อครบ 5 ชั่วโมง
  ตั้งค่าใน docs/config.js:  window.DEMO_TRIAL = { gateUrl, app: "sds", hours: 5, contact, priceHtml }
  gateUrl = URL /exec ของโปรเจกต์ Apps Script "Trial Gate" (แยกต่างหาก ใช้ร่วมกันทุกเดโม)
  ถ้ายังเป็น PASTE_TRIAL_GATE_URL_HERE หรือเชื่อมต่อไม่ได้ เดโมจะยังใช้งานได้ตามปกติ (fail-open)


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
      และติดตั้ง trigger demoAutoReset (ทุก 1 ชั่วโมง) เพียงตัวเดียว (ลบ trigger เดิมของ demoAutoReset)
   5. Deploy > New deployment > Select type: Web app
        Execute as: Me
        Who has access: Anyone
      กด Deploy แล้วคัดลอก Web app URL ที่ลงท้ายด้วย /exec

ข. หน้าเว็บ (GitHub Pages)
   6. เปิดไฟล์ docs/config.js แล้วแทนที่ PASTE_DEPLOYED_EXEC_URL_HERE ด้วย URL /exec
      และแก้ DEMO_CONTACT (บรรทัดติดต่อบนแถบ Demo) ตามต้องการ
      และแทนที่ PASTE_TRIAL_GATE_URL_HERE ใน window.DEMO_TRIAL ด้วย URL /exec ของ Trial Gate
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
  demoAutoReset()      ฟังก์ชันที่ trigger เรียกทุกชั่วโมง (รีเซ็ตเมื่อครบ 5 ชั่วโมง)
  installKeepWarmTrigger() / removeKeepWarmTrigger()   (ไม่บังคับ) อุ่น cache ทุก 10 นาที
  setupSystem()        ชื่อเดิมของระบบจริง — ในเวอร์ชัน Demo จะเรียก setupDemo()
ฟังก์ชันภายใน: seedDemoData_() (ล้าง+ใส่ข้อมูลตัวอย่าง), getDemoInfo_(), nextDemoResetTime_(),
               isDemoResetDue_(), demoLockedReason_() (ตรวจคำสั่งที่ล็อกไว้)


6) ฟีเจอร์ที่ใช้ได้ / ฟีเจอร์ที่ล็อก (🔒 เวอร์ชันเต็ม)
--------------------------------------------------
ใช้ได้ในเดโม:
  - แดชบอร์ดภาพรวม Pictogram (กดการ์ดเพื่อกรอง), สรุปจำนวน, "ดูทั้งหมด"
  - ตาราง SDS ทั้งหมด, ค้นหา (ลำดับ / Group / ชื่อสาร / CAS), กรองตาม Pictogram
  - เปิดดูรายละเอียด SDS (หน้าสรุป / เต็มจอ), เปิด PDF ตัวอย่าง (ไทย / อังกฤษ)
  - QR Code ต่อรายการ (ดู) และ QR เข้าเว็บไซต์
  - เพิ่มข้อมูล SDS ใหม่ (เฉพาะข้อความ) และแก้ไขข้อมูล (รหัสทดลอง demo1234)
ล็อกไว้ (ปุ่มยังแสดงพร้อม 🔒 กดแล้วขึ้น "🔒 ฟีเจอร์นี้มีในเวอร์ชันเต็ม — <DEMO_CONTACT>"):
  - อัปโหลด PDF / อ่านข้อมูลจาก PDF อัตโนมัติ
  - ลบข้อมูล SDS
  - ส่งออก CSV
  - ตั้งค่าความกว้างคอลัมน์, ตั้งค่าหัวข้อตาราง (แสดง/ซ่อนคอลัมน์)
  - ตั้งค่าภาพรวมอันตราย / Pictogram
  - พิมพ์ข้อมูล SDS, พิมพ์ QR Code (รวมถึงสั่งพิมพ์จากเบราว์เซอร์ จะได้หน้าแจ้งว่าเป็นฟีเจอร์เวอร์ชันเต็ม)
ฝั่งเซิร์ฟเวอร์ (doPost) ปฏิเสธคำสั่งเหล่านี้ด้วย {ok:false, error:"ฟีเจอร์นี้มีในเวอร์ชันเต็ม"}:
  delete, saveColumnWidths, saveColumnVisibility, saveHazardDefinitions และ save ที่แนบไฟล์ PDF
  (สวิตช์ DEMO_PREMIUM_LOCKED / รายการ DEMO_LOCKED_ACTIONS ใน apps-script/Demo.gs;
   หน้าเว็บ: docs/demo-lock.js)


7) สิ่งที่ปิด/จำกัดไว้เพื่อความปลอดภัยของ Demo
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


8) โครงสร้างไฟล์
----------------
  appsscript.json              manifest ของ Apps Script
  apps-script/Code.gs          API (doGet/doPost, cache, บันทึก/ลบ, ตั้งค่า)
  apps-script/Demo.gs          setupDemo, seedDemoData_, demoAutoReset, resetDemoNow, ฟีเจอร์ที่ล็อก
  apps-script/DemoSeed.gs      ข้อมูลตัวอย่าง (สร้างจาก tools/build-demo-seed.js)
  docs/index.html              หน้าเว็บหลัก (GitHub Pages)
  docs/config.js               URL /exec, DEMO_CONTACT, DEMO_PASSWORD, DEMO_TRIAL
  docs/demo-banner.js          แถบ Demo + นับถอยหลังการรีเซ็ต (ชม./นาที)
  docs/demo-lock.js            ฟีเจอร์เวอร์ชันเต็ม (🔒) + หน้าต่างแจ้งเตือน
  docs/trial-gate.js           สิทธิ์ทดลอง 5 ชม. ต่อคน (ไฟล์กลางจาก TrialGate ห้ามแก้)
  docs/demo-seed.js            ข้อมูลตัวอย่างชุดเดียวกับใน Sheet
  docs/assets/                 pictograms, PPE, demo-sds (PDF ตัวอย่าง)
  seed/demo-seed.json          ข้อมูลตัวอย่างแบบ plain JSON (ใช้ตรวจในเทสต์)
  tools/build-demo-seed.js     แก้ข้อมูลตัวอย่างที่นี่ แล้วรัน: node tools/build-demo-seed.js
  tools/make_demo_pdfs.py      สร้าง PDF ตัวอย่างใหม่: python tools/make_demo_pdfs.py (ต้องมี reportlab)
  test/                        เทสต์ (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม, ใช้ Node.js)


9) ทดสอบในเครื่อง
-----------------
  node test/run.js          เทสต์ backend (mock Apps Script) + seed + reset + หน้าเว็บ + ตรวจชื่อจริง
  node test/page-smoke.js   รันสคริปต์หน้าเว็บแบบไม่มีเบราว์เซอร์ (โหมดไม่มี API และโหมดมี API)
  node test/server.js       เปิด http://localhost:8787/ เพื่อดูหน้าเว็บกับ API จำลอง
