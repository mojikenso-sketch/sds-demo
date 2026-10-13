// SDS Management — DEMO configuration. Only edit the three values below.

// 1) URL of the Apps Script Web app (Deploy > Web app), ending in /exec.
//    While this still says PASTE_DEPLOYED_EXEC_URL_HERE the page shows
//    "ยังไม่ได้ตั้งค่า API" and runs on the sample data in this browser only.
var DEMO_EXEC_URL = "PASTE_DEPLOYED_EXEC_URL_HERE";

// 2) Contact line shown in the demo banner on every page.
var DEMO_CONTACT = "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)";

// 3) Public demo password shown in the "บัญชีทดลอง" box. It must match
//    DEMO_ACTION_PASSWORD in apps-script/Demo.gs (setupDemo stores it).
var DEMO_PASSWORD = "demo1234";

window.SDS_CONFIG = {
  apiUrl: /^https?:\/\/\S+\/exec\/?$/.test(DEMO_EXEC_URL) ? DEMO_EXEC_URL : "",
  apiConfigured: /^https?:\/\/\S+\/exec\/?$/.test(DEMO_EXEC_URL),
  demoPassword: DEMO_PASSWORD,
  demoContact: DEMO_CONTACT,
  // Visitors may add / edit / delete (edit, delete and table settings ask for
  // the demo password). Everything is reset every 3 days.
  publicReadOnly: false
};
