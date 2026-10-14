"use strict";
/*
 * In-memory mock of the Google Apps Script services used by
 * apps-script/*.gs (Code.gs, Demo.gs, DemoSeed.gs). The files are loaded into
 * one vm context (like one Apps Script project) so their top-level functions
 * (doGet, doPost, setupDemo, demoAutoReset, ...) can be called directly.
 *
 * Every service call that would read or write Google data is counted in
 * `stats`, so tests can assert "one sheet read", "no lock on reads",
 * "keepWarm writes nothing", etc.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const CACHE_VALUE_MAX_BYTES = 100 * 1024;
const CACHE_KEY_MAX_CHARS = 250;

function newStats() {
  return {
    sheetOpens: 0, sheetReads: 0, sheetWrites: 0, flushes: 0,
    propReads: 0, propWrites: 0,
    cacheGets: 0, cachePuts: 0, cacheHits: 0, cacheMaxValueBytes: 0,
    driveWrites: 0, locks: 0, sleeps: 0, triggerWrites: 0
  };
}

function createGasEnvironment(options = {}) {
  const stats = newStats();
  const sheets = new Map(); // spreadsheetId -> { name -> sheet }
  const properties = new Map();
  const cache = new Map(); // key -> { value, expires }
  const driveFiles = new Map();
  const triggers = [];
  let idCounter = 0;
  const env = { stats, properties, cache, driveFiles, triggers, activeUserEmail: options.activeUserEmail || "" };

  /* ---------------- SpreadsheetApp ---------------- */
  function makeSheet(name) {
    const state = { name, values: [], maxColumns: 26 };
    const lastRow = () => {
      for (let r = state.values.length - 1; r >= 0; r--) {
        if (state.values[r].some(v => v !== "" && v !== null && v !== undefined)) return r + 1;
      }
      return 0;
    };
    const ensureRows = count => { while (state.values.length < count) state.values.push([]); };
    const sheet = {
      _state: state,
      getName: () => state.name,
      setName: n => { state.name = n; return sheet; },
      getLastRow: () => lastRow(),
      getMaxColumns: () => state.maxColumns,
      insertColumnsAfter: (after, count) => { stats.sheetWrites++; state.maxColumns += count; return sheet; },
      setFrozenRows: () => sheet,
      autoResizeColumns: () => sheet,
      appendRow: row => {
        stats.sheetWrites++;
        const at = lastRow();
        ensureRows(at + 1);
        state.values[at] = row.slice();
        return sheet;
      },
      deleteRow: rowNumber => {
        stats.sheetWrites++;
        if (rowNumber < 1 || rowNumber > state.values.length) throw new Error("Row out of range");
        state.values.splice(rowNumber - 1, 1);
        return sheet;
      },
      getRange: (row, column, numRows = 1, numColumns = 1) => {
        if (row < 1 || column < 1 || numRows < 1 || numColumns < 1) {
          throw new Error("The coordinates or dimensions of the range are invalid.");
        }
        const outside = column + numColumns - 1 > state.maxColumns;
        return {
          getValues: () => {
            if (outside) throw new Error("The coordinates of the range are outside the dimensions of the sheet.");
            stats.sheetReads++;
            const out = [];
            for (let r = 0; r < numRows; r++) {
              const src = state.values[row - 1 + r] || [];
              const line = [];
              for (let c = 0; c < numColumns; c++) {
                const v = src[column - 1 + c];
                line.push(v === undefined || v === null ? "" : v);
              }
              out.push(line);
            }
            return out;
          },
          setValues: values => {
            stats.sheetWrites++;
            if (values.length !== numRows || values.some(line => line.length !== numColumns)) {
              throw new Error("The number of rows or columns in the data does not match the range.");
            }
            ensureRows(row - 1 + numRows);
            if (outside) state.maxColumns = column + numColumns - 1;
            values.forEach((line, r) => {
              const target = state.values[row - 1 + r];
              line.forEach((v, c) => { target[column - 1 + c] = v; });
            });
          },
          clearContent: () => {
            stats.sheetWrites++;
            for (let r = 0; r < numRows; r++) {
              const target = state.values[row - 1 + r];
              if (!target) continue;
              for (let c = 0; c < numColumns; c++) target[column - 1 + c] = "";
            }
          },
          setFontWeight: () => {}
        };
      }
    };
    return sheet;
  }

  function makeSpreadsheet(id) {
    const tabs = sheets.get(id);
    return {
      getId: () => id,
      getUrl: () => "https://docs.google.com/spreadsheets/d/" + id,
      getSheets: () => Array.from(tabs.values()),
      getSheetByName: name => {
        for (const tab of tabs.values()) if (tab.getName() === name) return tab;
        return null;
      }
    };
  }

  const SpreadsheetApp = {
    create: () => {
      const id = "sheet-" + (++idCounter);
      sheets.set(id, new Map([["Sheet1", makeSheet("Sheet1")]]));
      return makeSpreadsheet(id);
    },
    openById: id => {
      stats.sheetOpens++;
      if (!sheets.has(id)) throw new Error("Spreadsheet not found: " + id);
      return makeSpreadsheet(id);
    },
    flush: () => { stats.flushes++; }
  };

  /* ---------------- PropertiesService ---------------- */
  const scriptProperties = {
    getProperty: key => { stats.propReads++; return properties.has(key) ? properties.get(key) : null; },
    getProperties: () => { stats.propReads++; return Object.fromEntries(properties); },
    setProperty: (key, value) => { stats.propWrites++; properties.set(key, String(value)); return scriptProperties; },
    setProperties: (values, deleteAllOthers) => {
      stats.propWrites++;
      if (deleteAllOthers) properties.clear();
      Object.keys(values).forEach(key => properties.set(key, String(values[key])));
      return scriptProperties;
    },
    deleteProperty: key => { stats.propWrites++; properties.delete(key); return scriptProperties; }
  };
  const PropertiesService = { getScriptProperties: () => scriptProperties };

  /* ---------------- CacheService (100 KB per value) ---------------- */
  function cacheCheck(key, value) {
    if (typeof key !== "string" || !key || key.length > CACHE_KEY_MAX_CHARS) throw new Error("Invalid cache key: " + key);
    const bytes = Buffer.byteLength(String(value), "utf8");
    if (bytes > CACHE_VALUE_MAX_BYTES) throw new Error("Argument too large: value");
    stats.cacheMaxValueBytes = Math.max(stats.cacheMaxValueBytes, bytes);
  }
  function cacheRead(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) { cache.delete(key); return null; }
    return entry.value;
  }
  const scriptCache = {
    get: key => { stats.cacheGets++; const v = cacheRead(key); if (v !== null) stats.cacheHits++; return v; },
    getAll: keys => {
      stats.cacheGets++;
      const out = {};
      keys.forEach(key => { const v = cacheRead(key); if (v !== null) out[key] = v; });
      return out;
    },
    put: (key, value, seconds = 600) => {
      stats.cachePuts++;
      cacheCheck(key, value);
      cache.set(key, { value: String(value), expires: Date.now() + Math.min(seconds, 21600) * 1000 });
    },
    putAll: (values, seconds = 600) => {
      stats.cachePuts++;
      Object.keys(values).forEach(key => cacheCheck(key, values[key]));
      Object.keys(values).forEach(key => cache.set(key, { value: String(values[key]), expires: Date.now() + Math.min(seconds, 21600) * 1000 }));
    },
    remove: key => { cache.delete(key); },
    removeAll: keys => { keys.forEach(key => cache.delete(key)); }
  };
  const CacheService = { getScriptCache: () => scriptCache };

  /* ---------------- LockService ---------------- */
  const LockService = {
    getScriptLock: () => ({
      waitLock: () => { stats.locks++; },
      tryLock: () => { stats.locks++; return true; },
      releaseLock: () => {}
    })
  };

  /* ---------------- DriveApp ---------------- */
  const folders = new Map(); // folderId -> { name, trashed }
  const iterator = items => {
    let index = 0;
    return { hasNext: () => index < items.length, next: () => items[index++] };
  };
  function makeFile(id) {
    const file = driveFiles.get(id);
    return {
      getId: () => id,
      getName: () => file.name,
      getBlob: () => makeBlob(file.bytes, file.mimeType, file.name),
      getParents: () => iterator(file.folder && folders.has(file.folder) ? [makeFolder(file.folder)] : []),
      isTrashed: () => file.trashed,
      setSharing: () => { stats.driveWrites++; },
      setTrashed: value => { stats.driveWrites++; file.trashed = Boolean(value); }
    };
  }
  function makeFolder(id) {
    if (!folders.has(id)) throw new Error("Folder not found: " + id);
    return {
      getId: () => id,
      getUrl: () => "https://drive.google.com/drive/folders/" + id,
      isTrashed: () => folders.get(id).trashed,
      getFiles: () => iterator(Array.from(driveFiles.keys())
        .filter(fileId => driveFiles.get(fileId).folder === id && !driveFiles.get(fileId).trashed)
        .map(makeFile)),
      createFile: blob => {
        stats.driveWrites++;
        const fileId = "file-" + (++idCounter);
        driveFiles.set(fileId, { name: blob.getName(), mimeType: blob.getContentType(), bytes: blob.getBytes(), trashed: false, folder: id });
        return makeFile(fileId);
      }
    };
  }
  env.folders = folders;
  /** Adds a file that is NOT in the demo folder (e.g. another file of the owner). */
  env.addOutsideFile = (name, text) => {
    const fileId = "outside-" + (++idCounter);
    driveFiles.set(fileId, { name, mimeType: "application/pdf", bytes: Array.from(Buffer.from(text)), trashed: false, folder: "" });
    return fileId;
  };
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK" },
    Permission: { VIEW: "VIEW" },
    createFolder: name => {
      const id = "folder-" + (++idCounter);
      folders.set(id, { name, trashed: false });
      return makeFolder(id);
    },
    getFolderById: id => makeFolder(id),
    getFileById: id => {
      if (!driveFiles.has(id)) throw new Error("File not found: " + id);
      return makeFile(id);
    }
  };

  /* ---------------- Utilities ---------------- */
  function makeBlob(data, mimeType, name) {
    const bytes = typeof data === "string" ? Array.from(Buffer.from(data, "utf8")) : Array.from(data || []);
    return {
      getBytes: () => bytes.slice(),
      getContentType: () => mimeType || "application/octet-stream",
      getName: () => name || "blob",
      getDataAsString: () => Buffer.from(bytes).toString("utf8")
    };
  }
  const Utilities = {
    sleep: () => { stats.sleeps++; },
    newBlob: (data, mimeType, name) => makeBlob(data, mimeType, name),
    base64Encode: bytes => Buffer.from(bytes).toString("base64"),
    base64Decode: text => Array.from(Buffer.from(String(text), "base64")),
    getUuid: () => crypto.randomUUID(),
    formatDate: (date, tz, pattern) => {
      const pad = n => String(n).padStart(2, "0");
      if (pattern !== "yyyy-MM-dd") throw new Error("Unsupported pattern in mock: " + pattern);
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }
  };

  /* ---------------- ContentService / HtmlService ---------------- */
  const ContentService = {
    MimeType: { JSON: "application/json", JAVASCRIPT: "application/javascript" },
    createTextOutput: content => {
      const output = {
        _content: String(content), _mimeType: "text/plain",
        setMimeType: mime => { output._mimeType = mime; return output; },
        getContent: () => output._content,
        getMimeType: () => output._mimeType
      };
      return output;
    }
  };
  const HtmlService = {
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
    createTemplateFromFile: name => ({
      evaluate: () => {
        const output = {
          _content: "<!doctype html><title>Apps Script page " + name + "</title>",
          _mimeType: "text/html", _html: true,
          setTitle: () => output, setXFrameOptionsMode: () => output,
          getContent: () => output._content, getMimeType: () => output._mimeType
        };
        return output;
      }
    })
  };

  /* ---------------- Session / ScriptApp / UrlFetchApp ---------------- */
  const Session = {
    getActiveUser: () => ({ getEmail: () => env.activeUserEmail }),
    getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }),
    getScriptTimeZone: () => "Asia/Bangkok"
  };
  const ScriptApp = {
    getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.handler, _id: t.id })),
    deleteTrigger: trigger => {
      stats.triggerWrites++;
      const index = triggers.findIndex(t => t.id === trigger._id);
      if (index !== -1) triggers.splice(index, 1);
    },
    newTrigger: handler => {
      const spec = { handler, id: "trigger-" + (++idCounter) };
      const builder = {
        timeBased: () => builder,
        everyMinutes: minutes => { spec.everyMinutes = minutes; return builder; },
        everyHours: hours => { spec.everyHours = hours; return builder; },
        everyDays: days => { spec.everyDays = days; return builder; },
        atHour: hour => { spec.atHour = hour; return builder; },
        create: () => { stats.triggerWrites++; triggers.push(spec); return spec; }
      };
      return builder;
    }
  };
  const UrlFetchApp = {
    fetch: url => {
      const body = options.urlFetch ? options.urlFetch(url) : null;
      return {
        getResponseCode: () => (body === null ? 404 : 200),
        getContentText: () => body || ""
      };
    }
  };

  const context = vm.createContext({
    SpreadsheetApp, PropertiesService, CacheService, LockService, DriveApp, Utilities,
    ContentService, HtmlService, Session, ScriptApp, UrlFetchApp,
    console: options.quiet ? { log() {}, warn() {}, error() {}, info() {} } : console
  });

  env.context = context;
  env.loadCode = file => {
    const code = fs.readFileSync(file, "utf8");
    vm.runInContext(code, context, { filename: path.basename(file) });
    return env;
  };
  /** Loads every .gs file of a folder, like one Apps Script project. */
  env.loadProject = dir => {
    fs.readdirSync(dir).filter(name => /\.gs$/.test(name)).sort().forEach(name => env.loadCode(path.join(dir, name)));
    return env;
  };
  env.sheet = () => {
    const id = properties.get("SDS_SPREADSHEET_ID");
    return id ? sheets.get(id).values().next().value : null;
  };
  /**
   * Fake clock for the Apps Script code: new Date() / Date.now() inside the
   * project return `ms` (null restores the real clock). Date(args) is real.
   */
  env.setNow = ms => {
    context.__fakeNow = ms === null || ms === undefined ? null : Number(ms);
    if (!context.__fakeDateInstalled) {
      vm.runInContext(`(function () {
        var RealDate = Date;
        var now = function () { return globalThis.__fakeNow == null ? RealDate.now() : globalThis.__fakeNow; };
        function FakeDate() {
          if (!(this instanceof FakeDate)) return new RealDate(now()).toString();
          if (!arguments.length) return new RealDate(now());
          return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
        }
        FakeDate.now = now;
        FakeDate.parse = RealDate.parse;
        FakeDate.UTC = RealDate.UTC;
        FakeDate.prototype = RealDate.prototype;
        globalThis.Date = FakeDate;
        globalThis.__fakeDateInstalled = true;
      })();`, context);
    }
    return env;
  };
  env.resetStats = () => Object.assign(stats, newStats());
  env.snapshotStats = () => Object.assign({}, stats);

  /** Calls doGet with query parameters; returns { mime, text, json, html }. */
  env.get = params => decodeOutput(context.doGet({ parameter: Object.assign({}, params) }));
  /** Calls doPost with a JSON body; returns { mime, text, json }. */
  env.post = body => decodeOutput(context.doPost({ postData: { contents: JSON.stringify(body), type: "text/plain" } }));
  return env;
}

function decodeOutput(output) {
  const text = output.getContent();
  const mime = output.getMimeType();
  const result = { mime, text, html: Boolean(output._html) };
  if (mime === "application/json") result.json = JSON.parse(text);
  return result;
}

/**
 * Fresh environment with the demo project loaded and setupDemo() run (as the
 * owner, from the editor). Visitors afterwards are anonymous.
 * options.codePath: load a single Code.gs instead (plus Demo.gs/DemoSeed.gs
 * from the same folder when present).
 * options.premium: true unlocks the premium features that the public demo
 * locks (DEMO_PREMIUM_LOCKED = false), to test the underlying code paths.
 */
function createSeededBackend(options = {}) {
  const repo = path.resolve(__dirname, "..");
  const env = createGasEnvironment({
    quiet: options.quiet !== false,
    activeUserEmail: "owner@example.com"
  });
  if (options.codePath) {
    env.loadCode(options.codePath);
    ["DemoSeed.gs", "Demo.gs"].forEach(name => {
      const file = path.join(path.dirname(options.codePath), name);
      if (fs.existsSync(file)) env.loadCode(file);
    });
  } else {
    env.loadProject(path.join(repo, "apps-script"));
  }
  if (options.setup !== false) env.context.setupDemo();
  if (options.premium) env.context.DEMO_PREMIUM_LOCKED = false;
  // Visitors of the public web app are anonymous (not administrators).
  env.activeUserEmail = "";
  env.cache.clear();
  env.resetStats();
  return env;
}

module.exports = { createGasEnvironment, createSeededBackend, CACHE_VALUE_MAX_BYTES };
