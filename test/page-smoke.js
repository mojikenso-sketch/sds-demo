"use strict";
/*
 * Headless smoke test of docs/index.html without a browser:
 *   node test/page-smoke.js
 *
 * Runs the page scripts in order (config.js, trial-gate.js, early bootstrap,
 * demo-banner.js, demo-seed.js, main script, Apps Script bridge, demo-lock.js)
 * against a tiny DOM stub, in
 * two modes:
 *   1. API not configured  -> sample data from demo-seed.js, warning shown
 *   2. API configured      -> fetch() answered by the mock Apps Script backend
 * and checks that the SDS table is rendered with the demo records, the trial
 * gate stays open with the placeholder gate URL, and locked features only
 * show the "full version" message.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createSeededBackend } = require("./gas-mock");

const repo = path.resolve(__dirname, "..");
const docs = path.join(repo, "docs");
const html = fs.readFileSync(path.join(docs, "index.html"), "utf8");

function makeElement(id) {
  const attributes = {};
  const element = {
    id, hidden: id === "demoApiWarning" || /Modal$/.test(id || ""), value: "", checked: false, files: [],
    textContent: "", innerHTML: "", style: {}, dataset: {}, children: [], className: "",
    classList: { _set: new Set(), add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); }, contains(c) { return this._set.has(c); }, toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); } },
    addEventListener() {}, removeEventListener() {}, appendChild(child) { element.children.push(child); return child; },
    removeChild() {}, remove() {}, setAttribute(k, v) { attributes[k] = v; }, getAttribute(k) { return attributes[k] || null; },
    removeAttribute(k) { delete attributes[k]; }, querySelector() { return null; }, querySelectorAll() { return []; },
    hasAttribute(k) { return k in attributes; },
    getBoundingClientRect() { return { width: 100, height: 20, top: 0, left: 0 }; }, focus() {}, scrollIntoView() {},
    insertAdjacentHTML() {}, reset() {}, closest() { return null; }, click() {}
  };
  // Any other DOM method (append, replaceChildren, ...) is a no-op.
  return new Proxy(element, {
    get(target, key) {
      if (key in target || typeof key === "symbol") return target[key];
      if (/^(on|parent|next|previous|first|last)/.test(key)) return null;
      return function () { return undefined; };
    }
  });
}

function runPage({ apiUrl, backend }) {
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const storage = new Map();
  const localStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  };
  const fetchCalls = [];
  const fetchBodies = [];
  const fetch = (url, options = {}) => {
    fetchCalls.push(String(url));
    if (options.body) fetchBodies.push(String(options.body));
    if (!backend) return Promise.reject(new Error("offline"));
    let output;
    if (options.method === "POST") {
      output = backend.context.doPost({ postData: { contents: options.body, type: "text/plain" } });
    } else {
      const parameter = Object.fromEntries(new URL(url).searchParams);
      output = backend.context.doGet({ parameter });
    }
    const text = output.getContent();
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(text)) });
  };
  const document = {
    readyState: "complete",
    body: Object.assign(makeElement("body"), { classList: makeElement("b").classList }),
    documentElement: makeElement("html"),
    getElementById: byId,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: tag => makeElement(tag),
    addEventListener() {}, removeEventListener() {}
  };
  const window = {
    document, localStorage, fetch,
    location: { href: "https://demo.example.github.io/sds/", origin: "https://demo.example.github.io", pathname: "/sds/", search: "", hash: "" },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 5)), clearTimeout, setInterval: () => 1, clearInterval() {},
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    prompt: () => null, alert: () => {}, confirm: () => false, open: () => null, print() {}, scrollTo() {},
    indexedDB: { open: () => { const r = {}; setTimeout(() => r.onerror && r.onerror({}), 0); return r; } },
    console: { log() {}, warn() {}, error() {}, info() {} }
  };
  window.window = window;
  window.self = window;
  const context = vm.createContext(Object.assign(window, {
    URL, URLSearchParams, TextEncoder, TextDecoder, Promise, JSON, Math, Date, Number, String, Array, Object, Set, Map,
    btoa: s => Buffer.from(s, "binary").toString("base64"), atob: s => Buffer.from(s, "base64").toString("binary"),
    Blob: function () {}, FileReader: function () {}, Uint8Array, Error, RegExp, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape
  }));

  const config = fs.readFileSync(path.join(docs, "config.js"), "utf8")
    .replace(/var DEMO_EXEC_URL = "[^"]*"/, 'var DEMO_EXEC_URL = "' + (apiUrl || "PASTE_DEPLOYED_EXEC_URL_HERE") + '"');
  vm.runInContext(config, context, { filename: "config.js" });

  // Inline and local scripts in document order.
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = match[1];
    const src = (attrs.match(/src="([^"?]+)/) || [])[1];
    if (src === "config.js") continue;
    if (src && /^https?:/.test(src)) continue; // CDN libraries (pdf.js / qrcode) are not needed here
    const code = src ? fs.readFileSync(path.join(docs, src), "utf8") : match[2];
    vm.runInContext(code, context, { filename: src || "index.html:inline" });
  }
  return { context, byId, storage, fetchCalls, fetchBodies };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 30));

(async () => {
  const seed = JSON.parse(fs.readFileSync(path.join(repo, "seed", "demo-seed.json"), "utf8")).records;

  // 1) API not configured.
  const offline = runPage({ apiUrl: "" });
  await tick();
  const offlineRows = (offline.byId("sdsTable").innerHTML.match(/<tr>/g) || []).length;
  assert.strictEqual(offlineRows, seed.length, "offline table rows");
  assert.strictEqual(offline.byId("demoApiWarning").hidden, false, "API warning visible");
  assert.ok(/ยังไม่ได้ตั้งค่า API/.test(offline.byId("demoNextReset").textContent));
  assert.strictEqual(offline.fetchCalls.length, 0, "no requests without API");
  assert.ok(offline.byId("sdsTable").innerHTML.includes("อะซีโตน"));
  assert.ok(offline.byId("sdsTable").innerHTML.includes("pictogram-7.png"));
  console.log("  ok   offline: " + offlineRows + " sample rows rendered, 'ยังไม่ได้ตั้งค่า API' shown");

  // 2) API configured (mock Apps Script backend after setupDemo()).
  const backend = createSeededBackend();
  const online = runPage({ apiUrl: "https://script.google.com/macros/s/DEMO/exec", backend });
  await tick();
  await tick();
  const table = online.byId("sdsTable").innerHTML;
  const onlineRows = (table.match(/<tr>/g) || []).length;
  assert.strictEqual(onlineRows, seed.length, "online table rows");
  assert.ok(online.fetchCalls.some(url => /action=bootstrap/.test(url)));
  assert.ok(!online.fetchCalls.some(url => /action=demoInfo/.test(url)), "banner reused the bootstrap response");
  assert.ok(/^\(อีก [45] ชม\. \d+ นาที\)$/.test(online.byId("demoCountdown").textContent), online.byId("demoCountdown").textContent);
  assert.strictEqual(online.byId("demoApiWarning").hidden, true);
  assert.strictEqual(online.byId("demoContact").textContent, "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)");
  const sdsData = vm.runInContext("sdsData", online.context);
  assert.ok(sdsData.every(item => !item.pdfUrl || /^https:\/\/demo\.example\.github\.io\/sds\/assets\/demo-sds\//.test(item.pdfUrl)), "PDF URLs resolved against the site");
  assert.ok([...online.storage.keys()].every(key => key.startsWith("demo_sds_")), [...online.storage.keys()].join(","));

  // Trial gate: placeholder gate URL -> fail-open, no request, no block.
  assert.ok(online.context.DemoTrial && online.context.DemoTrial.isExpired() === false, "trial gate loaded, not expired");
  assert.ok(!online.fetchCalls.some(url => /ipify|cloudflare|PASTE_TRIAL/.test(url)), "no gate request with the placeholder URL");

  // Locked premium features only open the 🔒 modal and never call the API.
  assert.strictEqual(online.byId("sdsFile").disabled, true, "PDF upload disabled");
  const postsBefore = online.fetchBodies.length;
  ["exportCSV()", "deleteSDS(" + seed[0].id + ")", "openHazardSettings()", "openColumnWidthSettings()",
    "openColumnVisibilitySettings()", "printSdsQuickView()", "printQrCode()"].forEach(call => {
    online.byId("demoLockModal").hidden = true;
    vm.runInContext(call, online.context);
    assert.strictEqual(online.byId("demoLockModal").hidden, false, call + " shows the lock modal");
    assert.strictEqual(online.byId("demoLockTitle").textContent, "🔒 ฟีเจอร์นี้มีในเวอร์ชันเต็ม");
    assert.strictEqual(online.byId("demoLockContact").textContent, "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)");
  });
  assert.strictEqual(online.fetchBodies.length, postsBefore, "locked features send nothing to the API");
  assert.strictEqual(vm.runInContext("sdsData.length", online.context), seed.length, "nothing deleted");

  // A record added by a visitor through the API shows up after the save.
  backend.context.saveSds({ chemicalThai: "สารทดสอบผู้เยี่ยมชม", chemicalEnglish: "Visitor test" }, null, "");
  const again = runPage({ apiUrl: "https://script.google.com/macros/s/DEMO/exec", backend });
  await tick();
  await tick();
  assert.ok(again.byId("sdsTable").innerHTML.includes("สารทดสอบผู้เยี่ยมชม"));
  console.log("  ok   locked features show the 🔒 modal only; trial gate fail-open with placeholder URL");
  console.log("  ok   online: " + onlineRows + " rows from the mock API, countdown \"" + online.byId("demoCountdown").textContent + "\", storage keys " + [...online.storage.keys()].join(", "));
  console.log("\npage smoke test passed");
})().catch(error => {
  console.log("  FAIL page smoke test\n       " + String(error && error.stack || error).split("\n").slice(0, 8).join("\n       "));
  process.exitCode = 1;
});
