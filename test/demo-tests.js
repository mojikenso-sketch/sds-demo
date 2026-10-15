"use strict";
/*
 * DEMO-specific tests, registered by test/run.js:
 * seed data, setupDemo / seedDemoData_ / demoAutoReset / resetDemoNow,
 * 5-hour reset with a fake clock, demo info, locked premium features
 * (server + page), demo limits, docs config + banner + trial gate,
 * neutral branding.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createSeededBackend, createGasEnvironment } = require("./gas-mock");

const repo = path.resolve(__dirname, "..");
const PASSWORD = "demo1234";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const LOCKED_MESSAGE = "ฟีเจอร์นี้มีในเวอร์ชันเต็ม";
// Every HTML page of the GitHub Pages site.
function htmlPages(dir = path.join(repo, "docs")) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlPages(full);
    return /\.html$/i.test(entry.name) ? [full] : [];
  });
}
// Runs docs/config.js with another exec URL (placeholder or a real one).
function runConfig(url) {
  const source = fs.readFileSync(path.join(repo, "docs", "config.js"), "utf8");
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(source.replace(/var DEMO_EXEC_URL = "[^"]*"/, 'var DEMO_EXEC_URL = "' + url + '"'), ctx);
  return ctx;
}
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

  test("setupDemo: creates sheet + folder, seeds, sets demo password + DEMO_LAST_RESET, one hourly trigger", () => {
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
    assert.strictEqual(resetTriggers[0].everyHours, 1, "hourly trigger");
    assert.strictEqual(resetTriggers[0].everyDays, undefined);
    assert.strictEqual(resetTriggers[0].atHour, undefined);
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
    // Uses the premium actions (unlocked here) to change everything a full
    // version visitor could change, then checks the reset restores it.
    const env = createSeededBackend({ premium: true });
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

  test("demoAutoReset (fake clock): no reset at 4 h 59 min, reset at 5 h+, dates fresh after the reset", () => {
    const env = createSeededBackend();
    const t0 = Date.UTC(2026, 9, 14, 3, 7, 0); // 10:07 Bangkok
    env.setNow(t0);
    env.context.resetDemoNow();
    assert.strictEqual(env.properties.get("DEMO_LAST_RESET"), new Date(t0).toISOString());
    const target = env.context.listSds()[0];
    okData(env.post({ action: "save", record: { id: target.id, chemicalEnglish: "Changed" }, password: PASSWORD }));

    // The hourly trigger fires: 1 h, 4 h, 4 h 59 min -> not due.
    for (const elapsed of [1 * HOUR, 4 * HOUR, 4 * HOUR + 59 * MINUTE]) {
      env.setNow(t0 + elapsed);
      const result = env.context.demoAutoReset();
      assert.strictEqual(result.reset, false, "elapsed " + elapsed / MINUTE + " min");
      assert.strictEqual(result.nextReset, new Date(t0 + 5 * HOUR).toISOString());
      assert.strictEqual(env.context.listSds()[0].chemicalEnglish, "Changed");
      assert.strictEqual(env.properties.get("DEMO_LAST_RESET"), new Date(t0).toISOString());
    }

    // 5 h (and anything later) -> reset.
    const t1 = t0 + 5 * HOUR + 2 * MINUTE;
    env.setNow(t1);
    const result = env.context.demoAutoReset();
    assert.strictEqual(result.reset, true);
    assert.strictEqual(env.context.listSds()[0].chemicalEnglish, seedJson().records[0].chemicalEnglish);
    assert.strictEqual(env.properties.get("DEMO_LAST_RESET"), new Date(t1).toISOString());
    assert.strictEqual(result.nextReset, new Date(t1 + 5 * HOUR).toISOString());
    // Seeded dates are relative to the (fake) reset time, so they look fresh.
    const rows = okData(env.get({ action: "api" }));
    seedJson().records.forEach((seed, index) => {
      assert.strictEqual(rows[index].revisionDate, dateText(new Date(t1 - seed.revisionDaysAgo * DAY)));
      assert.strictEqual(rows[index].reviewDate, dateText(new Date(t1 + seed.reviewInDays * DAY)));
    });

    // Exactly 5 h after that reset -> reset again; 1 h later -> not again.
    env.setNow(t1 + 5 * HOUR);
    assert.strictEqual(env.context.demoAutoReset().reset, true);
    env.setNow(t1 + 6 * HOUR);
    assert.strictEqual(env.context.demoAutoReset().reset, false);

    // No DEMO_LAST_RESET at all (e.g. properties cleared): reset.
    env.properties.delete("DEMO_LAST_RESET");
    assert.strictEqual(env.context.demoAutoReset().reset, true);
    env.setNow(null);
  });

  test("reset interval constants: DEMO_RESET_HOURS = 5, hourly trigger, next reset = last reset + 5 h", () => {
    const env = createSeededBackend();
    assert.strictEqual(env.context.DEMO_RESET_HOURS, 5);
    assert.strictEqual(env.context.DEMO_TRIGGER_EVERY_HOURS, 1);
    assert.ok(env.context.DEMO_RESET_TOLERANCE_MS <= MINUTE, "tolerance is small");
    const next = env.context.nextDemoResetTime_;
    assert.strictEqual(next("2026-10-12T20:20:00.000Z").toISOString(), "2026-10-13T01:20:00.000Z");
    assert.strictEqual(next("2026-10-13T22:45:30.000Z").toISOString(), "2026-10-14T03:45:30.000Z");
    assert.strictEqual(next(""), null);
    const code = fs.readFileSync(path.join(repo, "apps-script", "Demo.gs"), "utf8");
    assert.ok(/timeBased\(\)\.everyHours\(/.test(code), "ScriptApp trigger uses everyHours");
    assert.ok(!/DEMO_RESET_INTERVAL_DAYS|everyDays|atHour/.test(code), "no daily trigger leftovers");
  });

  test("demo info is exposed by action=demoInfo and inside bootstrap", () => {
    const env = createSeededBackend();
    const info = okData(env.get({ action: "demoInfo" }));
    assert.strictEqual(info.isDemo, true);
    assert.strictEqual(info.intervalHours, 5);
    assert.strictEqual(info.premiumLocked, true);
    assert.strictEqual(info.lastReset, env.properties.get("DEMO_LAST_RESET"));
    assert.strictEqual(Date.parse(info.nextReset), Date.parse(info.lastReset) + 5 * HOUR, "nextReset = lastReset + 5 h");
    assert.deepStrictEqual(clone(okData(env.get({ action: "bootstrap" })).demo), clone(info));
    const jsonp = env.get({ action: "demoInfo", callback: "cb" });
    assert.ok(/^cb\(\{"ok":true/.test(jsonp.text));
    // After a reset the cached bootstrap carries the new reset time.
    env.properties.set("DEMO_LAST_RESET", new Date(Date.now() - 5 * HOUR - MINUTE).toISOString());
    assert.strictEqual(env.context.demoAutoReset().reset, true);
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
    env.context.DEMO_PREMIUM_LOCKED = false; // upload limit of the full version
    env.context.DEMO_MAX_UPLOAD_BYTES = 10;
    const big = env.post({ action: "save", record: { id: target.id, chemicalEnglish: "E" }, password: PASSWORD,
      file: { name: "big.pdf", base64: Buffer.from("%PDF-1.4 more than ten bytes").toString("base64") } }).json;
    assert.strictEqual(big.ok, false);
  });

  test("locked premium actions are rejected server-side; browse/search, add (text) and edit still work", () => {
    const env = createSeededBackend();
    const before = clone(okData(env.get({ action: "bootstrap" })));
    const v0 = env.properties.get("SDS_DATA_VERSION");
    const target = before.rows[0];
    const pdf = { name: "x.pdf", mimeType: "application/pdf", base64: Buffer.from("%PDF-1.4 x").toString("base64") };
    const lockedPayloads = [
      { action: "delete", id: target.id, password: PASSWORD },
      { action: "saveColumnWidths", columnWidths: { 1: 150 }, password: PASSWORD },
      { action: "saveColumnVisibility", columnVisibility: { 3: false }, password: PASSWORD },
      { action: "saveHazardDefinitions", hazardDefinitions: [{ name: "Only one" }] },
      { action: "save", record: { chemicalEnglish: "With PDF" }, file: pdf },
      { action: "save", record: { id: target.id, chemicalEnglish: "With PDF" }, file: pdf, password: PASSWORD }
    ];
    lockedPayloads.forEach(payload => {
      const result = env.post(payload).json;
      assert.strictEqual(result.ok, false, payload.action + " must be locked");
      assert.ok(result.error.indexOf(LOCKED_MESSAGE) === 0, result.error);
    });
    assert.strictEqual(env.properties.get("SDS_DATA_VERSION"), v0, "locked actions change nothing");
    assert.strictEqual(env.driveFiles.size, 0, "no PDF stored");
    const after = clone(okData(env.get({ action: "bootstrap" })));
    assert.deepStrictEqual(after.rows, before.rows);
    assert.deepStrictEqual(after.columnWidths, before.columnWidths);
    assert.deepStrictEqual(after.hazardDefinitions, before.hazardDefinitions);

    // Still usable: reads, verifyPassword, add a text-only record, edit it.
    okData(env.get({ action: "api" }));
    okData(env.get({ action: "demoInfo" }));
    okData(env.post({ action: "verifyPassword", password: PASSWORD }));
    const added = okData(env.post({ action: "save", record: { chemicalThai: "สารใหม่", chemicalEnglish: "New one", cas: "64-17-5" }, file: null }));
    const edited = okData(env.post({ action: "save", record: { id: added.id, chemicalEnglish: "New one (edited)" }, password: PASSWORD }));
    assert.strictEqual(edited.chemicalEnglish, "New one (edited)");
    assert.ok(okData(env.get({ action: "api" })).some(row => row.chemicalEnglish === "New one (edited)"));
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

  test("docs/config.js: exec URL (placeholder or deployed /exec), DEMO_CONTACT, demo password, DEMO_TRIAL", () => {
    const source = fs.readFileSync(path.join(repo, "docs", "config.js"), "utf8");
    const current = (/var DEMO_EXEC_URL = "([^"]*)"/.exec(source) || [])[1];
    assert.ok(current === "PASTE_DEPLOYED_EXEC_URL_HERE" || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(current), "exec URL " + current);
    const unset = runConfig("PASTE_DEPLOYED_EXEC_URL_HERE");
    assert.strictEqual(unset.window.SDS_CONFIG.apiUrl, "");
    assert.strictEqual(unset.window.SDS_CONFIG.apiConfigured, false);
    assert.strictEqual(unset.DEMO_CONTACT, "สนใจใช้งานจริง ติดต่อ: Fastwork / LINE: (ใส่ภายหลัง)");
    assert.strictEqual(unset.window.SDS_CONFIG.demoPassword, PASSWORD);
    const set = runConfig("https://script.google.com/macros/s/ABC/exec");
    assert.strictEqual(set.window.SDS_CONFIG.apiUrl, "https://script.google.com/macros/s/ABC/exec");
    assert.strictEqual(set.window.SDS_CONFIG.publicReadOnly, false);
    // Per-visitor trial gate.
    const trial = unset.window.DEMO_TRIAL;
    assert.ok(trial, "window.DEMO_TRIAL");
    assert.ok(trial.gateUrl === "PASTE_TRIAL_GATE_URL_HERE" || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(trial.gateUrl), "gate URL " + trial.gateUrl);
    assert.strictEqual(trial.app, "sds");
    assert.strictEqual(trial.hours, 5);
    assert.strictEqual(trial.contact, unset.DEMO_CONTACT);
    assert.strictEqual(trial.priceHtml, "สิทธิ์ใช้งาน Cloud 1,990 บาท/เดือน · ขายขาด 89,000 บาท");
    // Demo password in Apps Script and on the page must match.
    const env = createSeededBackend();
    assert.strictEqual(env.context.DEMO_ACTION_PASSWORD, unset.window.SDS_CONFIG.demoPassword);
  });

  test("trial-gate.js: shared client copied unchanged and loaded right after config.js on every page", () => {
    const local = fs.readFileSync(path.join(repo, "docs", "trial-gate.js"), "utf8");
    const shared = path.resolve(repo, "..", "TrialGate", "client", "trial-gate.js");
    if (fs.existsSync(shared)) assert.strictEqual(local, fs.readFileSync(shared, "utf8"), "docs/trial-gate.js differs from TrialGate/client");
    assert.ok(/window\.DEMO_TRIAL/.test(local) && /DemoTrial/.test(local));
    const pages = htmlPages();
    assert.ok(pages.length >= 1);
    pages.forEach(page => {
      const html = fs.readFileSync(page, "utf8");
      const name = path.relative(repo, page);
      const config = html.indexOf('src="config.js');
      const gate = html.indexOf('src="trial-gate.js');
      assert.ok(config !== -1, name + " loads config.js");
      assert.ok(gate > config, name + " loads trial-gate.js after config.js");
      assert.strictEqual((html.match(/src="trial-gate\.js/g) || []).length, 1, name + " loads trial-gate.js once");
    });
  });

  test("docs/index.html: premium features stay visible with 🔒 and use one shared lock message", () => {
    const html = fs.readFileSync(path.join(repo, "docs", "index.html"), "utf8");
    const lock = fs.readFileSync(path.join(repo, "docs", "demo-lock.js"), "utf8");
    [
      ['onclick="exportCSV()"', "export CSV"],
      ['onclick="openColumnWidthSettings()"', "column widths"],
      ['onclick="openColumnVisibilitySettings()"', "table headings"],
      ['onclick="openHazardSettings()"', "hazard settings"],
      ['onclick="printQrCode()"', "print QR"],
      ['onclick="printSdsQuickView()"', "print SDS"]
    ].forEach(([marker, label]) => {
      const index = html.indexOf(marker);
      assert.ok(index !== -1, label + " button still visible");
      const button = html.slice(html.lastIndexOf("<button", index), html.indexOf("</button>", index));
      assert.ok(button.includes("🔒") && button.includes("data-demo-locked"), label + " marked 🔒");
    });
    assert.ok(/title="🔒 ลบ[^"]*" onclick="deleteSDS\(\$\{item\.id\}\)">🔒🗑️/.test(html), "delete button marked 🔒");
    assert.ok(/<input type="file" id="sdsFile" accept="\.pdf" disabled>/.test(html), "PDF upload disabled");
    assert.ok(html.includes('id="demoLockModal"'));
    assert.ok(html.lastIndexOf('src="demo-lock.js') > html.lastIndexOf("Google Apps Script / GitHub Pages bridge"), "lock loads after the bridge");
    assert.ok(lock.includes("🔒 ฟีเจอร์นี้มีในเวอร์ชันเต็ม") && lock.includes("DEMO_CONTACT"));
    ["deleteSDS", "exportCSV", "openHazardSettings", "openColumnWidthSettings", "openColumnVisibilitySettings", "printQrCode", "printSdsQuickView"]
      .forEach(name => assert.ok(new RegExp("\\b" + name + ":").test(lock), name + " locked in demo-lock.js"));
    // Still usable (not locked): add, edit, view SDS, search/filter, dashboard.
    ["openAddDrawer", "editSDS", "viewSDS", "openTableSds", "renderTable", "showAllSds", "saveSDS"]
      .forEach(name => assert.ok(!new RegExp("\\b" + name + ":").test(lock), name + " must stay usable"));
  });

  test("docs/index.html: demo banner + demo account box, demo seed loaded, no embedded production data", () => {
    const html = fs.readFileSync(path.join(repo, "docs", "index.html"), "utf8");
    assert.ok(html.includes("🧪 ระบบทดลองใช้ (Demo) — ข้อมูลส่วนกลางรีเซ็ตเป็นค่าเริ่มต้นทุก 5 ชั่วโมง · ผู้ทดลองแต่ละคนใช้งานได้ 5 ชั่วโมง · รีเซ็ตครั้งถัดไป:"));
    assert.ok(!/ทุก 3 วัน/.test(html), "old 3-day text removed");
    assert.ok(html.includes("บัญชีทดลอง"));
    assert.ok(html.includes('id="demoContact"') && html.includes('id="demoApiWarning"'));
    assert.ok(html.includes("ยังไม่ได้ตั้งค่า API"));
    assert.ok(html.indexOf('src="demo-banner.js') > html.indexOf('id="demoBanner"'), "banner script after banner markup");
    assert.ok(html.indexOf('src="demo-banner.js') < html.lastIndexOf("Google Apps Script / GitHub Pages bridge"), "banner reads the early request before the bridge consumes it");
    assert.ok(html.indexOf('src="demo-seed.js') < html.indexOf("const defaultData"));
    assert.ok(!html.includes("Programming by"), "credit removed (owner request)");
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
    const next = new Date(Date.now() + 4 * HOUR + 59 * MINUTE + 30000).toISOString();
    const viaEarly = await run({ apiUrl: "https://x/exec", demoPassword: PASSWORD }, { ok: true, data: { rows: [], demo: { nextReset: next } } });
    assert.strictEqual(viaEarly.calls.length, 0, "reuses the early bootstrap");
    assert.strictEqual(viaEarly.elements.demoCountdown.textContent, "(อีก 4 ชม. 59 นาที)");
    assert.ok(viaEarly.elements.demoNextReset.textContent.length > 5);
    assert.strictEqual(viaEarly.elements.demoContact.textContent, "Contact X");
    assert.strictEqual(viaEarly.elements.demoPasswordText.textContent, PASSWORD);

    const viaFetch = await run({ apiUrl: "https://x/exec" }, null, { ok: true, data: { nextReset: next } });
    assert.strictEqual(viaFetch.calls.length, 1);
    assert.ok(/action=demoInfo/.test(viaFetch.calls[0]));
    assert.ok(/อีก 4 ชม\. 59 นาที/.test(viaFetch.elements.demoCountdown.textContent));
    const soon = await run({ apiUrl: "https://x/exec" }, null, { ok: true, data: { nextReset: new Date(Date.now() + 7 * MINUTE + 1000).toISOString() } });
    assert.strictEqual(soon.elements.demoCountdown.textContent, "(อีก 7 นาที)");
    const due = await run({ apiUrl: "https://x/exec" }, null, { ok: true, data: { nextReset: new Date(Date.now() - MINUTE).toISOString() } });
    assert.ok(/ภายใน 1 ชม\./.test(due.elements.demoCountdown.textContent));

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
      let text = fs.readFileSync(file, "utf8");
      // The owner's own deployed DEMO web app URL is allowed in docs/config.js.
      if (path.relative(repo, file) === path.join("docs", "config.js")) {
        text = text.replace(/var DEMO_EXEC_URL = "https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec";/, "");
        // ...and so is the shared Trial Gate deployment URL (DEMO_TRIAL.gateUrl).
        text = text.replace(/gateUrl: "https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec",/, "");
      }
      forbidden.forEach(pattern => {
        const match = text.match(pattern);
        assert.ok(!match, path.relative(repo, file) + " contains " + (match && match[0]));
      });
    });
  });
};
