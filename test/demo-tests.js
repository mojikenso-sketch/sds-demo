"use strict";
/*
 * DEMO-specific tests, registered by test/run.js:
 * seed data, setupDemo / seedDemoData_ / demoAutoReset / resetDemoNow,
 * demo info, demo limits, docs config + banner, neutral branding.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createSeededBackend, createGasEnvironment } = require("./gas-mock");

const repo = path.resolve(__dirname, "..");
const PASSWORD = "demo1234";
const DAY = 24 * 60 * 60 * 1000;
const clone = value => JSON.parse(JSON.stringify(value));
const okData = result => {
  assert.ok(result.json, "expected JSON");
  assert.strictEqual(result.json.ok, true, JSON.stringify(result.json).slice(0, 300));
  return result.json.data;
};

function seedJson() {
  return JSON.parse(fs.readFileSync(path.join(repo, "seed", "demo-seed.json"), "utf8"));
}
function seedFromGs() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(repo, "apps-script", "DemoSeed.gs"), "utf8"), ctx);
  return { version: ctx.DEMO_SEED_VERSION, records: ctx.DEMO_SEED_RECORDS };
}
function seedFromDocs() {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(repo, "docs", "demo-seed.js"), "utf8"), ctx);
  return { version: ctx.window.DEMO_SEED_VERSION, records: ctx.window.DEMO_SEED_RECORDS };
}
function casValid(cas) {
  const match = /^(\d{2,7})-(\d{2})-(\d)$/.exec(cas);
  if (!match) return false;
  const digits = (match[1] + match[2]).split("").reverse();
  const sum = digits.reduce((total, digit, index) => total + Number(digit) * (index + 1), 0);
  return sum % 10 === Number(match[3]);
}
const dateText = date => {
  const pad = n => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
};

module.exports = function registerDemoTests(test) {
  /* ---------------- seed data ---------------- */

  test("demo seed: JSON, DemoSeed.gs and docs/demo-seed.js hold the same records", () => {
    const json = seedJson();
    const gs = seedFromGs();
    const docs = seedFromDocs();
    assert.strictEqual(gs.version, json.version);
    assert.strictEqual(docs.version, json.version);
    assert.deepStrictEqual(clone(gs.records), json.records);
    assert.deepStrictEqual(clone(docs.records), json.records);
    assert.ok(json.records.length >= 30 && json.records.length <= 60, "records: " + json.records.length);
    const ids = json.records.map(r => r.id);
    assert.strictEqual(new Set(ids).size, ids.length, "unique ids");
    assert.ok(ids.every(id => Number.isInteger(id) && id < 1000000000000), "numeric ids below the timestamp range");
  });

  test("demo seed: valid CAS check digits, known pictograms, bilingual names, measures, PPE", () => {
    const pictograms = new Set(fs.readdirSync(path.join(repo, "docs", "assets", "pictograms")));
    const ppe = new Set(["V", "W", "X", "Y", "Z", "AA"]);
    seedJson().records.forEach(record => {
      assert.ok(casValid(record.cas), record.chemicalEnglish + " CAS " + record.cas);
      record.components.forEach(component => assert.ok(casValid(component.cas), record.chemicalEnglish + " component CAS " + component.cas));
      record.hazards.forEach(name => assert.ok(pictograms.has(name), "pictogram file " + name));
      assert.ok(/[฀-๿]/.test(record.chemicalThai), "Thai name " + record.chemicalThai);
      assert.ok(/^[\x20-\x7E≥]+$/.test(record.chemicalEnglish), "English name " + record.chemicalEnglish);
      assert.strictEqual(record.firstAidMeasures.length, 4);
      assert.strictEqual(record.firefightingMeasures.length, 4);
      assert.ok(record.personalProtectiveEquipment.every(code => ppe.has(code)));
      assert.ok(["Current", "Review Due", "Update Required"].includes(record.status));
      assert.ok(Number.isInteger(record.revisionDaysAgo) && Number.isInteger(record.reviewInDays));
    });
    const cas = Object.fromEntries(seedJson().records.map(r => [r.chemicalEnglish, r.cas]));
    assert.strictEqual(cas.Acetone, "67-64-1");
    assert.strictEqual(cas["Sulfuric acid 98%"], "7664-93-9");
    assert.strictEqual(cas["Sodium hydroxide 50% solution"], "1310-73-2");
    assert.strictEqual(cas.Chlorine, "7782-50-5");
    assert.strictEqual(cas["Liquefied petroleum gas (LPG)"], "68476-85-7");
  });

  test("demo seed: every referenced sample PDF exists; no production PDF library is shipped", () => {
    const dir = path.join(repo, "docs", "assets", "demo-sds");
    let count = 0;
    seedJson().records.forEach(record => {
      ["pdfUrl", "thaiPdfUrl", "englishPdfUrl"].forEach(field => {
        if (!record[field]) return;
        assert.ok(/^assets\/demo-sds\/sds-\d+-(en|th)\.pdf$/.test(record[field]), record[field]);
        const file = path.join(repo, "docs", record[field]);
        assert.ok(fs.existsSync(file), "missing " + record[field]);
        assert.strictEqual(fs.readFileSync(file).slice(0, 5).toString(), "%PDF-");
        count += 1;
      });
    });
    assert.ok(count > 40);
    assert.ok(!fs.existsSync(path.join(repo, "docs", "assets", "sds-library")), "no production SDS library");
    const pdfs = fs.readdirSync(path.join(repo, "docs", "assets")).filter(name => /\.pdf$/i.test(name));
    assert.deepStrictEqual(pdfs, [], "no loose production PDFs");
    assert.ok(fs.readdirSync(dir).every(name => /^sds-\d+-(en|th)\.pdf$/.test(name)));
  });

  /* ---------------- setupDemo ---------------- */

  test("setupDemo: creates sheet + folder, seeds, sets demo password + DEMO_LAST_RESET, one daily trigger", () => {
    const env = createGasEnvironment({ quiet: true, activeUserEmail: "owner@example.com" });
    env.loadProject(path.join(repo, "apps-script"));
    env.triggers.push({ handler: "keepWarm", id: "keep", everyMinutes: 10 });
    env.triggers.push({ handler: "demoAutoReset", id: "old-1" });
    env.triggers.push({ handler: "demoAutoReset", id: "old-2" });
    const before = Date.now();
    const result = env.context.setupDemo();
    assert.strictEqual(result.records, seedJson().records.length);
    assert.strictEqual(result.demoPassword, PASSWORD);
    assert.ok(env.properties.get("SDS_SPREADSHEET_ID"));
    assert.ok(env.properties.get("SDS_FOLDER_ID"));
    assert.strictEqual(env.properties.get("SDS_ACTION_PASSWORD"), PASSWORD);
    const last = Date.parse(env.properties.get("DEMO_LAST_RESET"));
    assert.ok(last >= before && last <= Date.now() + 1000);
    const resetTriggers = env.triggers.filter(t => t.handler === "demoAutoReset");
    assert.strictEqual(resetTriggers.length, 1, "exactly one demoAutoReset trigger");
    assert.strictEqual(resetTriggers[0].everyDays, 1);
    assert.strictEqual(resetTriggers[0].atHour, 3);
    assert.ok(env.triggers.some(t => t.handler === "keepWarm"), "other triggers untouched");
    const sheetId = env.properties.get("SDS_SPREADSHEET_ID");
    const folderId = env.properties.get("SDS_FOLDER_ID");
    // Running it again reuses the sheet/folder and still keeps one trigger.
    env.context.setupDemo();
    assert.strictEqual(env.properties.get("SDS_SPREADSHEET_ID"), sheetId);
    assert.strictEqual(env.properties.get("SDS_FOLDER_ID"), folderId);
    assert.strictEqual(env.triggers.filter(t => t.handler === "demoAutoReset").length, 1);
    assert.strictEqual(env.context.listSds().length, seedJson().records.length);
    // setupSystem() (production name) is an alias.
    env.context.setupSystem();
    assert.strictEqual(env.context.listSds().length, seedJson().records.length);
  });

  test("seeded sheet rows equal the plain seed data; dates are relative to today", () => {
    const env = createSeededBackend();
    const rows = okData(env.get({ action: "api" }));
    const seeds = seedJson().records;
    assert.strictEqual(rows.length, seeds.length);
    const now = new Date();
    seeds.forEach((seed, index) => {
      const row = rows[index];
      assert.strictEqual(row.id, String(seed.id));
      assert.strictEqual(row.chemicalThai, seed.chemicalThai);
      assert.strictEqual(row.chemicalEnglish, seed.chemicalEnglish);
      assert.strictEqual(row.cas, seed.cas);
      assert.strictEqual(row.sequence, seed.sequence);
      assert.strictEqual(row.group, seed.group);
      assert.strictEqual(row.status, seed.status);
      assert.strictEqual(row.flashPoint, seed.flashPoint);
      assert.deepStrictEqual(clone(row.hazards), seed.hazards);
      assert.deepStrictEqual(clone(row.components), seed.components);
      assert.deepStrictEqual(clone(row.personalProtectiveEquipment), seed.personalProtectiveEquipment);
      assert.deepStrictEqual(clone(row.firstAidMeasures), seed.firstAidMeasures);
      assert.deepStrictEqual(clone(row.firefightingMeasures).map(m => m.value), seed.firefightingMeasures.map(m => m.detail));
      assert.strictEqual(row.pdfUrl, seed.pdfUrl);
      assert.strictEqual(row.thaiPdfUrl, seed.thaiPdfUrl);
      assert.strictEqual(row.thaiSds, seed.thaiSds);
      assert.strictEqual(row.revisionDate, dateText(new Date(now.getTime() - seed.revisionDaysAgo * DAY)));
      assert.strictEqual(row.reviewDate, dateText(new Date(now.getTime() + seed.reviewInDays * DAY)));
    });
  });

  /* ---------------- reset ---------------- */

  test("seedDemoData_/resetDemoNow wipe visitor rows + uploaded PDFs and restore settings + password", () => {
    const env = createSeededBackend();
    const original = clone(okData(env.get({ action: "api" })));
    // A visitor adds a record with a PDF, edits and deletes seed records, changes settings.
    const added = okData(env.post({ action: "save", record: { chemicalEnglish: "Visitor chemical" },
      file: { name: "v.pdf", mimeType: "application/pdf", base64: Buffer.from("%PDF-1.4 visitor").toString("base64") } }));
    okData(env.post({ action: "save", record: { id: original[0].id, chemicalEnglish: "Renamed by visitor" }, password: PASSWORD }));
    okData(env.post({ action: "delete", id: original[1].id, password: PASSWORD }));
    okData(env.post({ action: "saveColumnWidths", columnWidths: { 1: 150 }, password: PASSWORD }));
    okData(env.post({ action: "saveColumnVisibility", columnVisibility: { 3: false }, password: PASSWORD }));
    okData(env.post({ action: "saveHazardDefinitions", hazardDefinitions: [{ name: "Only one" }] }));
    env.properties.set("SDS_ACTION_PASSWORD", "changed");
    const v0 = env.properties.get("SDS_DATA_VERSION");
    const oldReset = env.properties.get("DEMO_LAST_RESET");

    const result = env.context.resetDemoNow();
    assert.strictEqual(result.records, original.length);
    assert.strictEqual(result.trashedFiles, 1);
    assert.strictEqual(env.driveFiles.get(added.pdfFileId).trashed, true, "uploaded PDF trashed");
    assert.notStrictEqual(env.properties.get("SDS_DATA_VERSION"), v0, "cache version bumped");
    assert.ok(env.properties.get("DEMO_LAST_RESET") >= oldReset);
    assert.strictEqual(env.properties.get("SDS_ACTION_PASSWORD"), PASSWORD);

    const boot = okData(env.get({ action: "bootstrap" }));
    const strip = rows => clone(rows).map(row => { delete row.updatedAt; return row; });
    assert.deepStrictEqual(strip(boot.rows), strip(original), "rows back to the seed");
    assert.ok(!boot.rows.some(row => row.chemical === "Visitor chemical"));
    assert.strictEqual(boot.columnWidths["1"], 70, "column widths back to defaults");
    assert.strictEqual(boot.columnVisibility["3"], true, "headings back to defaults");
    assert.strictEqual(boot.hazardDefinitions.length, 9, "pictogram settings back to defaults");
    assert.strictEqual(boot.hazardDefinitions[0].image, "assets/pictograms/pictogram-4.png");
    // Sheet holds only the header + seed rows (no leftovers below).
    assert.strictEqual(env.sheet().getLastRow(), original.length + 1);
  });

  test("demoAutoReset: does nothing before 3 days, re-seeds once the interval has passed", () => {
    const env = createSeededBackend();
    const target = env.context.listSds()[0];
    okData(env.post({ action: "save", record: { id: target.id, chemicalEnglish: "Changed" }, password: PASSWORD }));

    // 1 day after the last reset: not due.
    env.properties.set("DEMO_LAST_RESET", new Date(Date.now() - 1 * DAY).toISOString());
    let result = env.context.demoAutoReset();
    assert.strictEqual(result.reset, false);
    assert.strictEqual(env.context.listSds()[0].chemicalEnglish, "Changed");

    // 2.5 days: still not due (the next slot is at least 03:00 after 3 days - 2 h).
    env.properties.set("DEMO_LAST_RESET", new Date(Date.now() - (2 * DAY + 12 * 3600 * 1000)).toISOString());
    result = env.context.demoAutoReset();
    assert.strictEqual(result.reset, false);

    // 3+ days: reset.
    env.properties.set("DEMO_LAST_RESET", new Date(Date.now() - 3 * DAY - 60000).toISOString());
    result = env.context.demoAutoReset();
    assert.strictEqual(result.reset, true);
    assert.strictEqual(env.context.listSds()[0].chemicalEnglish, seedJson().records[0].chemicalEnglish);
    assert.ok(Date.now() - Date.parse(env.properties.get("DEMO_LAST_RESET")) < 5000);

    // No DEMO_LAST_RESET at all (e.g. properties cleared): reset.
    env.properties.delete("DEMO_LAST_RESET");
    assert.strictEqual(env.context.demoAutoReset().reset, true);
  });

  test("next reset is a 03:00 Bangkok slot about 3 days after the last reset", () => {
    const env = createSeededBackend();
    const next = env.context.nextDemoResetTime_;
    const check = (lastIso, expectedIso) => assert.strictEqual(next(lastIso).toISOString(), expectedIso, lastIso);
    // Reset by the trigger at 03:20 BKK (20:20Z) -> 3 days later at 03:00 BKK.
    check("2026-10-12T20:20:00.000Z", "2026-10-15T20:00:00.000Z");
    // Manual reset at 10:00 BKK (03:00Z) -> due 3d-2h later = 08:00 BKK -> next 03:00 slot.
    check("2026-10-13T03:00:00.000Z", "2026-10-16T20:00:00.000Z");
    assert.strictEqual(next(""), null);
    for (let i = 0; i < 200; i++) {
      const last = Date.UTC(2026, 0, 1) + i * 7919 * 1000 * 13;
      const slot = next(new Date(last).toISOString()).getTime();
      assert.ok(slot >= last + 3 * DAY - 2 * 3600 * 1000 && slot < last + 4 * DAY, "slot window");
      assert.strictEqual(new Date(slot).getUTCHours(), 20, "03:00 Asia/Bangkok");
    }
  });

  test("demo info is exposed by action=demoInfo and inside bootstrap", () => {
    const env = createSeededBackend();
    const info = okData(env.get({ action: "demoInfo" }));
    assert.strictEqual(info.isDemo, true);
    assert.strictEqual(info.intervalDays, 3);
    assert.strictEqual(info.lastReset, env.properties.get("DEMO_LAST_RESET"));
    assert.ok(Date.parse(info.nextReset) > Date.parse(info.lastReset));
    assert.deepStrictEqual(clone(okData(env.get({ action: "bootstrap" })).demo), clone(info));
    const jsonp = env.get({ action: "demoInfo", callback: "cb" });
    assert.ok(/^cb\(\{"ok":true/.test(jsonp.text));
    // After a reset the cached bootstrap carries the new reset time.
    env.properties.set("DEMO_LAST_RESET", new Date(Date.now() - 4 * DAY).toISOString());
    env.context.demoAutoReset();
    const after = okData(env.get({ action: "bootstrap" })).demo;
    assert.strictEqual(after.lastReset, env.properties.get("DEMO_LAST_RESET"));
  });

  /* ---------------- demo hardening ---------------- */

  test("file action serves only PDFs from the demo folder (never other owner files)", () => {
    const env = createSeededBackend();
    const outside = env.addOutsideFile("private.pdf", "%PDF private");
    const result = env.get({ action: "file", fileId: outside }).json;
    assert.strictEqual(result.ok, false);
    assert.ok(!/private/.test(JSON.stringify(result)));
  });

  test("demo record limit and upload size limit", () => {
    const env = createSeededBackend();
    env.context.DEMO_MAX_RECORDS = 35;
    okData(env.post({ action: "save", record: { chemicalEnglish: "A" } }));
    okData(env.post({ action: "save", record: { chemicalEnglish: "B" } }));
    const error = env.post({ action: "save", record: { chemicalEnglish: "C" } }).json;
    assert.strictEqual(error.ok, false);
    assert.ok(/สูงสุด|full/.test(error.error));
    // Editing still works when the demo is full.
    const target = env.context.listSds()[0];
    okData(env.post({ action: "save", record: { id: target.id, chemicalEnglish: "Edited" }, password: PASSWORD }));
    env.context.DEMO_MAX_UPLOAD_BYTES = 10;
    const big = env.post({ action: "save", record: { id: target.id, chemicalEnglish: "E" }, password: PASSWORD,
      file: { name: "big.pdf", base64: Buffer.from("%PDF-1.4 more than ten bytes").toString("base64") } }).json;
    assert.strictEqual(big.ok, false);
  });

  test("owner-only and production-only functions are not reachable from the web API", () => {
    const code = fs.readdirSync(path.join(repo, "apps-script")).filter(n => /\.gs$/.test(n))
      .map(n => fs.readFileSync(path.join(repo, "apps-script", n), "utf8")).join("\n");
    assert.ok(!/HtmlService\.create/.test(code), "no HtmlService page (google.script.run)");
    assert.ok(!/migrateCatalogFromGithub|UrlFetchApp|MailApp|GmailApp/.test(code), "no catalog import / mail");
    const env = createSeededBackend();
    ["setupDemo", "resetDemoNow", "seedDemoData_", "demoAutoReset", "setupSystem"].forEach(action => {
      const result = env.post({ action }).json;
      assert.strictEqual(result.ok, false, action);
      assert.ok(/Unsupported action/.test(result.error));
    });
  });

  /* ---------------- frontend ---------------- */

  test("docs/config.js: exec URL placeholder, DEMO_CONTACT, demo password; placeholder means no API", () => {
    const source = fs.readFileSync(path.join(repo, "docs", "config.js"), "utf8");
    assert.ok(source.includes('"PASTE_DEPLOYED_EXEC_URL_HERE"'));
    const run = url => {
      const ctx = vm.createContext({ window: {} });
      vm.runInContext(source.replace('var DEMO_EXEC_URL = "PASTE_DEPLOYED_EXEC_URL_HERE"', 'var DEMO_EXEC_URL = "' + url + '"'), ctx);
      return ctx;
    };
    const unset = run("PASTE_DEPLOYED_EXEC_URL_HERE");
    assert.strictEqual(unset.window.SDS_CONFIG.apiUrl, "");
    assert.strictEqual(unset.window.SDS_CONFIG.apiConfigured, false);
    assert.strictEqual(unset.DEMO_CONTACT, "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)");
    assert.strictEqual(unset.window.SDS_CONFIG.demoPassword, PASSWORD);
    const set = run("https://script.google.com/macros/s/ABC/exec");
    assert.strictEqual(set.window.SDS_CONFIG.apiUrl, "https://script.google.com/macros/s/ABC/exec");
    assert.strictEqual(set.window.SDS_CONFIG.publicReadOnly, false);
    // Demo password in Apps Script and on the page must match.
    const env = createSeededBackend();
    assert.strictEqual(env.context.DEMO_ACTION_PASSWORD, unset.window.SDS_CONFIG.demoPassword);
  });

  test("docs/index.html: demo banner + demo account box, demo seed loaded, no embedded production data", () => {
    const html = fs.readFileSync(path.join(repo, "docs", "index.html"), "utf8");
    assert.ok(html.includes("🧪 ระบบทดลองใช้ (Demo) — ข้อมูลทั้งหมดจะถูกรีเซ็ตกลับเป็นค่าเริ่มต้นทุก 3 วัน · รีเซ็ตครั้งถัดไป:"));
    assert.ok(html.includes("บัญชีทดลอง"));
    assert.ok(html.includes('id="demoContact"') && html.includes('id="demoApiWarning"'));
    assert.ok(html.includes("ยังไม่ได้ตั้งค่า API"));
    assert.ok(html.indexOf('src="demo-banner.js') > html.indexOf('id="demoBanner"'), "banner script after banner markup");
    assert.ok(html.indexOf('src="demo-banner.js') < html.lastIndexOf("Google Apps Script / GitHub Pages bridge"), "banner reads the early request before the bridge consumes it");
    assert.ok(html.indexOf('src="demo-seed.js') < html.indexOf("const defaultData"));
    assert.ok(html.includes("Programming by Duongruthai_Milk"), "credit kept");
    assert.ok(!/REGISTER_WORKBOOK_DATA|sds-library|Pesticide|LABAN/i.test(html));
    assert.ok(html.length < 400000, "page size " + html.length);
    assert.ok(fs.existsSync(path.join(repo, "docs", ".nojekyll")));
  });

  test("browser storage keys use the demo_sds_ prefix (no collision with production on github.io)", () => {
    const html = fs.readFileSync(path.join(repo, "docs", "index.html"), "utf8");
    const literalKeys = [...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\("([^"]+)"/g)].map(m => m[1]);
    const constKeys = [...html.matchAll(/_KEY = "([^"]+)"/g)].map(m => m[1]);
    const dbNames = [...html.matchAll(/PDF_DB_NAME = "([^"]+)"/g)].map(m => m[1]);
    const keys = [...literalKeys, ...constKeys, ...dbNames];
    assert.ok(keys.length >= 8, keys.join(","));
    keys.forEach(key => assert.ok(/^demo_sds_/.test(key), "storage key " + key));
  });

  test("demo banner script: countdown from early bootstrap, fallback demoInfo, API-not-configured message", async () => {
    const source = fs.readFileSync(path.join(repo, "docs", "demo-banner.js"), "utf8");
    const run = async (config, earlyResponse, fetchResponse) => {
      const elements = {};
      ["demoNextReset", "demoCountdown", "demoContact", "demoPasswordText", "demoApiWarning"].forEach(id => {
        elements[id] = { textContent: "", hidden: id === "demoApiWarning" };
      });
      const calls = [];
      const window = {
        SDS_CONFIG: config, DEMO_CONTACT: "Contact X",
        location: { href: "https://example.github.io/demo/" },
        setInterval: () => 1,
        sdsEarlyBootstrap: earlyResponse ? { apiUrl: config.apiUrl, request: Promise.resolve(earlyResponse) } : null
      };
      const sandbox = {
        window, URL, Date, String, Math, isNaN, console: { warn() {} },
        document: { getElementById: id => elements[id] || null },
        fetch: url => { calls.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(fetchResponse) }); }
      };
      vm.runInNewContext(source, sandbox);
      await new Promise(resolve => setTimeout(resolve, 20));
      return { elements, calls };
    };
    const next = new Date(Date.now() + 2 * DAY + 5 * 3600 * 1000 + 10 * 60 * 1000).toISOString();
    const viaEarly = await run({ apiUrl: "https://x/exec", demoPassword: PASSWORD }, { ok: true, data: { rows: [], demo: { nextReset: next } } });
    assert.strictEqual(viaEarly.calls.length, 0, "reuses the early bootstrap");
    assert.ok(/อีก 2 วัน 5 ชม\./.test(viaEarly.elements.demoCountdown.textContent), viaEarly.elements.demoCountdown.textContent);
    assert.ok(viaEarly.elements.demoNextReset.textContent.length > 5);
    assert.strictEqual(viaEarly.elements.demoContact.textContent, "Contact X");
    assert.strictEqual(viaEarly.elements.demoPasswordText.textContent, PASSWORD);

    const viaFetch = await run({ apiUrl: "https://x/exec" }, null, { ok: true, data: { nextReset: next } });
    assert.strictEqual(viaFetch.calls.length, 1);
    assert.ok(/action=demoInfo/.test(viaFetch.calls[0]));
    assert.ok(/อีก 2 วัน/.test(viaFetch.elements.demoCountdown.textContent));

    const noApi = await run({ apiUrl: "" });
    assert.strictEqual(noApi.calls.length, 0);
    assert.strictEqual(noApi.elements.demoApiWarning.hidden, false, "shows ยังไม่ได้ตั้งค่า API");
  });

  /* ---------------- neutral branding ---------------- */

  test("no real company / customer / people names, emails, URLs or IDs anywhere in the demo", () => {
    // Real company / customer / people names, IDs, emails, IPs and phone
    // numbers that must never appear in the demo. Base64-encoded so that a
    // plain "grep -ri <name>" over the demo folder finds zero hits.
    const FORBIDDEN_B64 = "W1si4LmB4LiZ4LmH4LibIiwgIiJdLCBbIuC4meC4tOC4p+C4leC4o+C4tCIsICIiXSwgWyLguYDguJfguJ7guKfguLHguJLguJnguLIiLCAiIl0sIFsi4LmE4LiX4Lii4Lij4LmI4Lin4Lih4LmD4LiIIiwgIiJdLCBbIlxcYktSR1xcYiIsICIiXSwgWyJcXGJLaW5nXFxiIiwgIiJdLCBbIlRoZXB3YXRhbmEiLCAiaSJdLCBbIndhdGFuYXRoZXAiLCAiaSJdLCBbIlxcYk5hcFxcYiIsICIiXSwgWyJOdXRyaSIsICJpIl0sIFsia3JvZ3JvdXAiLCAiaSJdLCBbImNsYXVkZWFpIiwgImkiXSwgWyJtb2ppa2Vuc28iLCAiaSJdLCBbIndlYmhvb2siLCAiaSJdLCBbIm9mZmljZVxcLmNvbSIsICJpIl0sIFsiQUtmeWNiIiwgIiJdLCBbIjFtMXQ2R1BMVElGbHk4IiwgIiJdLCBbIlxcYig/OjEwfDE5MlxcLjE2OHwxNzJcXC4oPzoxWzYtOV18MlxcZHwzWzAxXSkpXFwuXFxkK1xcLlxcZCsoPzpcXC5cXGQrKT9cXGIiLCAiIl0sIFsiW0EtWmEtejAtOS5fJSstXStAKD8hZXhhbXBsZVxcLmNvbSlbQS1aYS16MC05Li1dK1xcLlthLXpdezIsfSIsICJpIl0sIFsiXFxiMFs2ODldXFxkWy0gXT9cXGR7M31bLSBdP1xcZHs0fVxcYiIsICIiXV0=";
    const forbidden = JSON.parse(Buffer.from(FORBIDDEN_B64, "base64").toString("utf8"))
      .map(([source, flags]) => new RegExp(source, flags));
    const skipDirs = new Set([".git", "node_modules", "pictograms", "ppe", "demo-sds"]);
    const files = [];
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(full); return; }
      if (/\.(gs|js|json|html|txt|md|py|css)$/i.test(entry.name) || entry.name.startsWith(".")) files.push(full);
    });
    walk(repo);
    assert.ok(files.length > 10);
    files.forEach(file => {
      const text = fs.readFileSync(file, "utf8");
      forbidden.forEach(pattern => {
        const match = text.match(pattern);
        assert.ok(!match, path.relative(repo, file) + " contains " + (match && match[0]));
      });
    });
  });
};
