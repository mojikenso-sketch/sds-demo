/* DEMO: premium features of the full version are locked.
   Buttons stay visible (marked 🔒); clicking them shows one small modal
   "🔒 ฟีเจอร์นี้มีในเวอร์ชันเต็ม — <DEMO_CONTACT>". The Apps Script backend
   rejects the same actions (demoLockedReason_ in apps-script/Demo.gs), so they
   cannot be called directly either. Loaded last, after the API bridge. */
(function () {
  var config = window.SDS_CONFIG || {};
  var contact = String(window.DEMO_CONTACT || config.demoContact || "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)");
  var MESSAGE = "🔒 ฟีเจอร์นี้มีในเวอร์ชันเต็ม";

  // Global page functions that belong to the full version -> feature name.
  var LOCKED_FUNCTIONS = {
    deleteSDS: "ลบข้อมูล SDS",
    exportCSV: "ส่งออก CSV",
    openHazardSettings: "ตั้งค่าภาพรวมอันตราย (Pictogram)",
    saveHazardSettings: "ตั้งค่าภาพรวมอันตราย (Pictogram)",
    openColumnWidthSettings: "ตั้งค่าความกว้างคอลัมน์",
    saveColumnWidthSettings: "ตั้งค่าความกว้างคอลัมน์",
    openColumnVisibilitySettings: "ตั้งค่าหัวข้อตาราง",
    saveColumnVisibilitySettings: "ตั้งค่าหัวข้อตาราง",
    saveSharedColumnWidths: "ตั้งค่าความกว้างคอลัมน์",
    saveSharedColumnVisibility: "ตั้งค่าหัวข้อตาราง",
    saveSharedHazardDefinitions: "ตั้งค่าภาพรวมอันตราย (Pictogram)",
    printQrCode: "พิมพ์ QR Code",
    printSdsQuickView: "พิมพ์ข้อมูล SDS"
  };

  function byId(id) { return document.getElementById(id); }

  function hideLocked() {
    var modal = byId("demoLockModal");
    if (modal) modal.hidden = true;
  }

  /** Shows the shared "full version" message. Reused by every locked feature. */
  function showLocked(feature) {
    var modal = byId("demoLockModal");
    if (!modal) {
      window.alert(MESSAGE + " — " + contact);
      return false;
    }
    var title = byId("demoLockTitle");
    var featureText = byId("demoLockFeature");
    var contactText = byId("demoLockContact");
    if (title) title.textContent = MESSAGE;
    if (featureText) featureText.textContent = feature ? "“" + feature + "” เปิดใช้ได้ในเวอร์ชันเต็ม เดโมนี้ให้ลองดูภาพรวม ค้นหา เปิด SDS เพิ่มและแก้ไขข้อมูล" : "";
    if (contactText) contactText.textContent = contact;
    modal.hidden = false;
    var close = byId("demoLockClose");
    if (close && close.focus) close.focus();
    return false;
  }

  window.demoLocked = showLocked;
  window.DEMO_LOCKED_FEATURES = LOCKED_FUNCTIONS;

  Object.keys(LOCKED_FUNCTIONS).forEach(function (name) {
    window[name] = function () { return showLocked(LOCKED_FUNCTIONS[name]); };
  });

  // PDF upload (and automatic PDF reading) is locked: only text is saved.
  var fileInput = byId("sdsFile");
  if (fileInput) {
    fileInput.disabled = true;
    fileInput.value = "";
  }

  // Any element marked data-demo-locked opens the message instead of running.
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-demo-locked]") : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    showLocked(target.getAttribute("data-demo-locked"));
  }, true);

  var modal = byId("demoLockModal");
  if (modal) {
    modal.addEventListener("click", function (event) { if (event.target === modal) hideLocked(); });
  }
  var closeButton = byId("demoLockClose");
  if (closeButton) closeButton.addEventListener("click", hideLocked);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideLocked();
  });
})();
