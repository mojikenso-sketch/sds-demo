/* DEMO banner: next automatic reset (with countdown), demo account and the
   contact line from config.js (DEMO_CONTACT). Loaded right after the banner
   markup at the top of <body>, so it can reuse the early bootstrap request
   (its response carries data.demo) before the main script consumes it. */
(function () {
  var config = window.SDS_CONFIG || {};
  var apiUrl = String(config.apiUrl || "").trim();
  var early = window.sdsEarlyBootstrap;
  var earlyRequest = early && early.request && early.apiUrl === apiUrl ? early.request : null;
  var nextReset = null;
  var timer = null;

  function byId(id) { return document.getElementById(id); }

  function setText(id, text) {
    var element = byId(id);
    if (element) element.textContent = text;
  }

  function formatDate(date) {
    try {
      return date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }) + " น.";
    } catch (error) {
      return date.toISOString().replace("T", " ").slice(0, 16);
    }
  }

  function countdownText(ms) {
    if (ms <= 0) return "(กำลังจะรีเซ็ตเร็วๆ นี้)";
    var minutes = Math.floor(ms / 60000);
    var days = Math.floor(minutes / 1440);
    var hours = Math.floor((minutes % 1440) / 60);
    var mins = minutes % 60;
    var parts = [];
    if (days) parts.push(days + " วัน");
    if (days || hours) parts.push(hours + " ชม.");
    if (!days) parts.push(mins + " นาที");
    return "(อีก " + parts.join(" ") + ")";
  }

  function render() {
    if (!nextReset) return;
    setText("demoNextReset", formatDate(nextReset));
    setText("demoCountdown", countdownText(nextReset.getTime() - Date.now()));
  }

  function applyInfo(info) {
    var next = info && info.nextReset ? new Date(info.nextReset) : null;
    if (!next || isNaN(next.getTime())) {
      setText("demoNextReset", "ยังไม่ได้รัน setupDemo()");
      setText("demoCountdown", "");
      return;
    }
    nextReset = next;
    render();
    if (!timer) timer = window.setInterval(render, 30000);
  }

  function fetchDemoInfo() {
    var url = new URL(apiUrl, window.location.href);
    url.searchParams.set("action", "demoInfo");
    url.searchParams.set("_", String(Date.now()));
    return fetch(url.toString(), { method: "GET", mode: "cors", credentials: "omit", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("demoInfo HTTP " + response.status);
        return response.json();
      })
      .then(function (response) {
        if (!response || response.ok === false) throw new Error(response && response.error || "demoInfo error");
        return response.data;
      });
  }

  setText("demoContact", String(window.DEMO_CONTACT || config.demoContact || "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)"));
  setText("demoPasswordText", String(config.demoPassword || window.DEMO_PASSWORD || "demo1234"));

  if (!apiUrl) {
    var warning = byId("demoApiWarning");
    if (warning) warning.hidden = false;
    setText("demoNextReset", "— (ยังไม่ได้ตั้งค่า API)");
    return;
  }

  var infoPromise = earlyRequest
    ? earlyRequest.then(function (response) {
        if (response && response.ok !== false && response.data && response.data.demo) return response.data.demo;
        return fetchDemoInfo();
      }, fetchDemoInfo)
    : fetchDemoInfo();

  infoPromise.then(applyInfo).catch(function (error) {
    console.warn("Demo reset info unavailable", error);
    setText("demoNextReset", "ไม่สามารถโหลดเวลารีเซ็ตได้");
  });
})();
