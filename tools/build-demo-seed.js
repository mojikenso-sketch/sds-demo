"use strict";
/*
 * Builds the DEMO seed data from the definitions in this file.
 *
 *   node tools/build-demo-seed.js
 *
 * Writes three copies of exactly the same records:
 *   seed/demo-seed.json        plain data (used by the tests)
 *   apps-script/DemoSeed.gs    DEMO_SEED_RECORDS for seedDemoData_() in Apps Script
 *   docs/demo-seed.js          window.DEMO_SEED_RECORDS for the GitHub Pages page
 *
 * Dates are stored relative to "today" (revisionDaysAgo / reviewInDays) and
 * are turned into real dates at seed time, so the demo never looks stale.
 * All companies, departments and documents are fictional (Demo Co., Ltd.).
 * Then run:  python tools/make_demo_pdfs.py   (placeholder SDS PDFs)
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const SEED_VERSION = "demo-sds-seed-v1";

/* GHS pictogram files (docs/assets/pictograms) */
const P = {
  H: "pictogram-4.png",  // GHS08 health hazard
  C: "pictogram-5.png",  // GHS05 corrosive
  E: "pictogram-6.png",  // GHS09 environment
  F: "pictogram-7.png",  // GHS02 flammable
  I: "pictogram-8.png",  // GHS07 exclamation mark
  T: "pictogram-9.png",  // GHS06 acute toxicity
  B: "pictogram-10.png", // GHS01 exploding bomb
  G: "pictogram-11.png", // GHS04 gas cylinder
  O: "pictogram-12.png"  // GHS03 oxidizer
};

const NON_FLAMMABLE = "ไม่ติดไฟ / Non-flammable";

function firstAid(inhalation, skin, eyes, ingestion) {
  return [
    { thai: "การสูดดม", english: "Inhalation", value: inhalation },
    { thai: "การสัมผัสผิวหนัง", english: "Skin contact", value: skin },
    { thai: "การสัมผัสดวงตา", english: "Eye contact", value: eyes },
    { thai: "การกลืนกิน", english: "Ingestion", value: ingestion }
  ];
}
function firefighting(water, foam, dry, co2) {
  return [
    { thai: "ละอองน้ำ", english: "Water spray", detail: water },
    { thai: "โฟม", english: "Foam", detail: foam },
    { thai: "ผงเคมีแห้ง", english: "Dry chemical powder", detail: dry },
    { thai: "คาร์บอนไดออกไซด์", english: "Carbon dioxide", detail: co2 }
  ];
}

const FA = {
  solvent: firstAid(
    "ย้ายผู้ป่วยไปยังบริเวณที่มีอากาศบริสุทธิ์ หากหายใจลำบากให้ออกซิเจนและนำส่งแพทย์",
    "ถอดเสื้อผ้าที่เปื้อนออก ล้างผิวหนังด้วยน้ำและสบู่ปริมาณมาก",
    "ล้างตาด้วยน้ำสะอาดอย่างน้อย 15 นาที โดยเปิดเปลือกตาไว้ หากยังระคายเคืองให้พบแพทย์",
    "ห้ามทำให้อาเจียน บ้วนปากด้วยน้ำ และนำส่งแพทย์ทันที"),
  corrosive: firstAid(
    "ย้ายผู้ป่วยออกสู่ที่อากาศบริสุทธิ์ทันที ให้พักในท่าที่หายใจสะดวก และนำส่งแพทย์",
    "ถอดเสื้อผ้าที่เปื้อนทันที ล้างผิวหนังด้วยน้ำไหลปริมาณมากอย่างน้อย 20 นาที",
    "ล้างตาด้วยน้ำสะอาดทันทีอย่างน้อย 20 นาที ถอดคอนแทคเลนส์ (ถ้ามี) และพบจักษุแพทย์",
    "บ้วนปากด้วยน้ำ ห้ามทำให้อาเจียน ดื่มน้ำเล็กน้อยหากรู้สึกตัว และนำส่งแพทย์ทันที"),
  gas: firstAid(
    "ย้ายผู้ป่วยออกจากบริเวณที่ก๊าซรั่วสู่ที่อากาศบริสุทธิ์ ให้ออกซิเจนหากหายใจลำบาก",
    "กรณีสัมผัสก๊าซเหลวเย็นจัด ให้แช่บริเวณที่สัมผัสในน้ำอุ่น ห้ามถู และพบแพทย์",
    "ล้างตาด้วยน้ำสะอาดอย่างน้อย 15 นาที",
    "ไม่ใช่ทางรับสัมผัสที่คาดว่าจะเกิดขึ้น"),
  toxicGas: firstAid(
    "ย้ายผู้ป่วยออกสู่ที่อากาศบริสุทธิ์ทันที (ผู้ช่วยเหลือต้องสวมเครื่องช่วยหายใจ SCBA) ให้ออกซิเจนและนำส่งแพทย์",
    "ล้างผิวหนังด้วยน้ำปริมาณมากอย่างน้อย 15 นาที ถอดเสื้อผ้าที่เปื้อน",
    "ล้างตาด้วยน้ำสะอาดทันทีอย่างน้อย 20 นาที และพบจักษุแพทย์",
    "ไม่ใช่ทางรับสัมผัสที่คาดว่าจะเกิดขึ้น"),
  toxic: firstAid(
    "ย้ายผู้ป่วยไปยังที่อากาศบริสุทธิ์ทันที ให้ออกซิเจนหากหายใจลำบาก และนำส่งแพทย์",
    "ถอดเสื้อผ้าที่เปื้อน ล้างผิวหนังด้วยน้ำและสบู่ปริมาณมากอย่างน้อย 15 นาที",
    "ล้างตาด้วยน้ำสะอาดอย่างน้อย 15 นาที และพบแพทย์",
    "ห้ามทำให้อาเจียน บ้วนปาก และนำส่งแพทย์ทันทีพร้อมเอกสาร SDS"),
  mild: firstAid(
    "ย้ายไปที่อากาศบริสุทธิ์ หากมีอาการให้พบแพทย์",
    "ล้างด้วยน้ำและสบู่",
    "ล้างตาด้วยน้ำสะอาดหลายๆ นาที หากยังระคายเคืองให้พบแพทย์",
    "บ้วนปาก ดื่มน้ำ 1-2 แก้ว หากมีอาการให้พบแพทย์")
};

const FF = {
  polarSolvent: firefighting("ใช้ละอองน้ำหล่อเย็นภาชนะ ห้ามฉีดน้ำเป็นลำตรง", "โฟมทนแอลกอฮอล์ (AR-AFFF)", "ใช้ได้", "ใช้ได้ (เพลิงขนาดเล็ก)"),
  hydrocarbon: firefighting("ใช้ละอองน้ำหล่อเย็นภาชนะ ห้ามฉีดน้ำเป็นลำตรง", "โฟม AFFF", "ใช้ได้", "ใช้ได้ (เพลิงขนาดเล็ก)"),
  nonFlammable: firefighting("ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้", "ใช้ได้", "ใช้ได้"),
  waterReactiveAcid: firefighting("ใช้ละอองน้ำหล่อเย็นภาชนะเท่านั้น ห้ามฉีดน้ำลงบนสารโดยตรง", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้", "ใช้ได้"),
  oxidizer: firefighting("ใช้น้ำปริมาณมาก", "ไม่แนะนำ", "ไม่แนะนำ", "ไม่มีประสิทธิภาพ (สารให้ออกซิเจนเอง)"),
  peroxide: firefighting("ใช้น้ำปริมาณมากจากระยะปลอดภัย", "ใช้ได้", "ไม่แนะนำ", "ไม่แนะนำ"),
  flammableGas: firefighting("ใช้ละอองน้ำหล่อเย็นถังก๊าซจากระยะปลอดภัย", "ไม่เหมาะสม", "ใช้ได้หลังปิดวาล์วหยุดการรั่วไหล", "ใช้ได้หลังปิดวาล์วหยุดการรั่วไหล"),
  inertGas: firefighting("ใช้ละอองน้ำหล่อเย็นถังที่ได้รับความร้อน", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้ตามสภาพเพลิงโดยรอบ"),
  ammonia: firefighting("ใช้ละอองน้ำปริมาณมากเพื่อดูดซับก๊าซและหล่อเย็นถัง", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้", "ใช้ได้"),
  chlorine: firefighting("ใช้ละอองน้ำหล่อเย็นถัง ห้ามฉีดน้ำเข้าจุดรั่ว", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้ตามสภาพเพลิงโดยรอบ", "ใช้ได้ตามสภาพเพลิงโดยรอบ"),
  oil: firefighting("ใช้ละอองน้ำหล่อเย็น ห้ามฉีดน้ำเป็นลำตรง", "ใช้ได้", "ใช้ได้", "ใช้ได้")
};

const ER = {
  solvent: "อพยพคนออกจากพื้นที่ ตัดแหล่งจุดติดไฟ ใช้วัสดุดูดซับเฉื่อย (ทราย/เวอร์มิคูไลต์) เก็บใส่ภาชนะปิด ห้ามระบายลงท่อ",
  corrosive: "กั้นพื้นที่ สวมชุดป้องกันสารเคมี ทำให้เป็นกลางด้วยสารที่เหมาะสม แล้วดูดซับด้วยวัสดุเฉื่อย ห้ามระบายลงท่อ",
  flammableGas: "ปิดวาล์วหากทำได้อย่างปลอดภัย อพยพคนในรัศมี 100 เมตร ตัดแหล่งจุดติดไฟ และระบายอากาศ",
  toxicGas: "อพยพคนไปทางเหนือลม สวมเครื่องช่วยหายใจ SCBA ปิดวาล์ว ใช้ละอองน้ำลดความเข้มข้นของก๊าซ และแจ้งทีมฉุกเฉิน",
  inertGas: "ระบายอากาศพื้นที่ ระวังภาวะขาดออกซิเจนในที่อับอากาศ ปิดวาล์วหากทำได้อย่างปลอดภัย",
  oxidizer: "แยกออกจากสารไวไฟและสารอินทรีย์ เก็บกวาดด้วยอุปกรณ์สะอาด ห้ามใช้ขี้เลื่อยหรือวัสดุติดไฟดูดซับ",
  mild: "กวาดหรือดูดซับ เก็บใส่ภาชนะ แล้วทำความสะอาดพื้นที่ด้วยน้ำ"
};

const SUPPLIER = {
  solvent: "บริษัท ตัวอย่าง โซลเว้นท์ จำกัด (Demo Solvents Co., Ltd.)",
  chemical: "บริษัท เคมีภัณฑ์ตัวอย่าง จำกัด (Demo Chemicals Co., Ltd.)",
  gas: "บริษัท ก๊าซอุตสาหกรรมตัวอย่าง จำกัด (Demo Industrial Gas Co., Ltd.)",
  petro: "บริษัท ตัวอย่าง ปิโตรเคมี จำกัด (Demo Petrochem Co., Ltd.)"
};

const DEPT = {
  qc: "ห้องปฏิบัติการ QC",
  production: "ฝ่ายผลิต",
  wastewater: "ฝ่ายบำบัดน้ำเสีย",
  maintenance: "ฝ่ายซ่อมบำรุง",
  store: "คลังสารเคมี",
  transport: "ฝ่ายยานพาหนะและขนส่ง"
};

const PPE = {
  solvent: ["W", "X", "Y", "Z"],
  cleaning: ["W", "X", "Y", "Z", "AA"],
  corrosive: ["V", "W", "X", "Y", "Z"],
  gas: ["X", "Y", "Z"],
  toxicGas: ["V", "W", "X", "Y", "Z"],
  oxidizer: ["V", "X", "Y", "Z"],
  mild: ["X", "Y", "Z"]
};

const single = (name, cas, ratio) => [{ composition: name, cas, ratio }];

/* seq, group, Thai name, English name, CAS, composition, ratio, components,
   pictograms, signal word, flash point, first aid, firefighting, emergency,
   PPE, supplier, responsible party, has Thai PDF, has English PDF, status */
const DEFINITIONS = [
  { group: "Solvent", th: "อะซีโตน", en: "Acetone", cas: "67-64-1", comp: "Acetone", ratio: "≥ 99.5%", hz: "FI", sw: "Danger", fp: "-20°C (closed cup)", fa: "solvent", ff: "polarSolvent", er: "solvent", ppe: "solvent", sup: "solvent", dept: "qc" },
  { group: "Solvent", th: "เอทานอล 95%", en: "Ethanol 95%", cas: "64-17-5", comp: "Ethanol", ratio: "95% v/v",
    components: [{ composition: "Ethanol", cas: "64-17-5", ratio: "95% v/v" }, { composition: "Water", cas: "7732-18-5", ratio: "5% v/v" }],
    hz: "FI", sw: "Danger", fp: "13°C (closed cup)", fa: "solvent", ff: "polarSolvent", er: "solvent", ppe: "cleaning", sup: "solvent", dept: "production" },
  { group: "Solvent", th: "ไอโซโพรพิลแอลกอฮอล์ (IPA)", en: "Isopropyl alcohol (IPA)", cas: "67-63-0", comp: "Propan-2-ol", ratio: "≥ 99.8%", hz: "FI", sw: "Danger", fp: "12°C (closed cup)", fa: "solvent", ff: "polarSolvent", er: "solvent", ppe: "cleaning", sup: "solvent", dept: "production" },
  { group: "Solvent", th: "เมทานอล", en: "Methanol", cas: "67-56-1", comp: "Methanol", ratio: "≥ 99.8%", hz: "FTH", sw: "Danger", fp: "11°C (closed cup)", fa: "toxic", ff: "polarSolvent", er: "solvent", ppe: "solvent", sup: "solvent", dept: "qc" },
  { group: "Solvent", th: "โทลูอีน", en: "Toluene", cas: "108-88-3", comp: "Toluene", ratio: "≥ 99.5%", hz: "FHI", sw: "Danger", fp: "4°C (closed cup)", fa: "solvent", ff: "hydrocarbon", er: "solvent", ppe: "solvent", sup: "solvent", dept: "production" },
  { group: "Solvent", th: "ไซลีน (ผสมไอโซเมอร์)", en: "Xylene (mixed isomers)", cas: "1330-20-7", comp: "Xylene", ratio: "≥ 98.5%",
    components: [
      { composition: "m-Xylene", cas: "108-38-3", ratio: "40-65%" },
      { composition: "o-Xylene", cas: "95-47-6", ratio: "15-25%" },
      { composition: "p-Xylene", cas: "106-42-3", ratio: "10-20%" },
      { composition: "Ethylbenzene", cas: "100-41-4", ratio: "10-20%" }],
    hz: "FHI", sw: "Danger", fp: "27°C (closed cup)", fa: "solvent", ff: "hydrocarbon", er: "solvent", ppe: "solvent", sup: "solvent", dept: "production", status: "Review Due" },
  { group: "Solvent", th: "นอร์มัลเฮกเซน", en: "n-Hexane", cas: "110-54-3", comp: "n-Hexane", ratio: "≥ 95%", hz: "FHIE", sw: "Danger", fp: "-22°C (closed cup)", fa: "solvent", ff: "hydrocarbon", er: "solvent", ppe: "solvent", sup: "solvent", dept: "qc" },
  { group: "Solvent", th: "เอทิลอะซิเตต", en: "Ethyl acetate", cas: "141-78-6", comp: "Ethyl acetate", ratio: "≥ 99.5%", hz: "FI", sw: "Danger", fp: "-4°C (closed cup)", fa: "solvent", ff: "polarSolvent", er: "solvent", ppe: "solvent", sup: "solvent", dept: "production" },
  { group: "Solvent", th: "เมทิลเอทิลคีโตน (MEK)", en: "Methyl ethyl ketone (MEK)", cas: "78-93-3", comp: "Butan-2-one", ratio: "≥ 99.5%", hz: "FI", sw: "Danger", fp: "-9°C (closed cup)", fa: "solvent", ff: "polarSolvent", er: "solvent", ppe: "solvent", sup: "solvent", dept: "maintenance" },
  { group: "Acid", th: "กรดซัลฟิวริก 98%", en: "Sulfuric acid 98%", cas: "7664-93-9", comp: "Sulfuric acid", ratio: "98% w/w", hz: "C", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "waterReactiveAcid", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "wastewater" },
  { group: "Acid", th: "กรดไฮโดรคลอริก 35%", en: "Hydrochloric acid 35%", cas: "7647-01-0", comp: "Hydrogen chloride", ratio: "35% w/w",
    components: [{ composition: "Hydrogen chloride", cas: "7647-01-0", ratio: "35% w/w" }, { composition: "Water", cas: "7732-18-5", ratio: "65% w/w" }],
    hz: "CI", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "wastewater" },
  { group: "Acid", th: "กรดไนตริก 65%", en: "Nitric acid 65%", cas: "7697-37-2", comp: "Nitric acid", ratio: "65% w/w", hz: "OC", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "oxidizer", er: "oxidizer", ppe: "corrosive", sup: "chemical", dept: "qc" },
  { group: "Acid", th: "กรดฟอสฟอริก 85%", en: "Phosphoric acid 85%", cas: "7664-38-2", comp: "Orthophosphoric acid", ratio: "85% w/w", hz: "C", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "production" },
  { group: "Acid", th: "กรดอะซิติก (กลาเซียล)", en: "Acetic acid, glacial", cas: "64-19-7", comp: "Acetic acid", ratio: "≥ 99.8%", hz: "FC", sw: "Danger", fp: "39°C (closed cup)", fa: "corrosive", ff: "polarSolvent", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "qc" },
  { group: "Alkali", th: "โซเดียมไฮดรอกไซด์ 50%", en: "Sodium hydroxide 50% solution", cas: "1310-73-2", comp: "Sodium hydroxide", ratio: "50% w/w",
    components: [{ composition: "Sodium hydroxide", cas: "1310-73-2", ratio: "50% w/w" }, { composition: "Water", cas: "7732-18-5", ratio: "50% w/w" }],
    hz: "C", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "wastewater" },
  { group: "Alkali", th: "โพแทสเซียมไฮดรอกไซด์ (เกล็ด)", en: "Potassium hydroxide flakes", cas: "1310-58-3", comp: "Potassium hydroxide", ratio: "≥ 90%", hz: "CI", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "production" },
  { group: "Alkali", th: "แอมโมเนียมไฮดรอกไซด์ 25%", en: "Ammonium hydroxide 25%", cas: "1336-21-6", comp: "Ammonium hydroxide", ratio: "25% w/w", hz: "CIE", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "qc" },
  { group: "Alkali", th: "โซเดียมคาร์บอเนต (โซดาแอช)", en: "Sodium carbonate (soda ash)", cas: "497-19-8", comp: "Sodium carbonate", ratio: "≥ 99%", hz: "I", sw: "Warning", fp: NON_FLAMMABLE, fa: "mild", ff: "nonFlammable", er: "mild", ppe: "mild", sup: "chemical", dept: "wastewater" },
  { group: "Oxidizer", th: "ไฮโดรเจนเปอร์ออกไซด์ 50%", en: "Hydrogen peroxide 50%", cas: "7722-84-1", comp: "Hydrogen peroxide", ratio: "50% w/w",
    components: [{ composition: "Hydrogen peroxide", cas: "7722-84-1", ratio: "50% w/w" }, { composition: "Water", cas: "7732-18-5", ratio: "50% w/w" }],
    hz: "OCI", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "oxidizer", er: "oxidizer", ppe: "oxidizer", sup: "chemical", dept: "production" },
  { group: "Oxidizer", th: "โซเดียมไฮโปคลอไรต์ 10%", en: "Sodium hypochlorite 10%", cas: "7681-52-9", comp: "Sodium hypochlorite", ratio: "10% (available chlorine)", hz: "CE", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "nonFlammable", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "wastewater" },
  { group: "Oxidizer", th: "แคลเซียมไฮโปคลอไรต์ 65%", en: "Calcium hypochlorite 65%", cas: "7778-54-3", comp: "Calcium hypochlorite", ratio: "65% w/w", hz: "OCIE", sw: "Danger", fp: NON_FLAMMABLE, fa: "corrosive", ff: "oxidizer", er: "oxidizer", ppe: "oxidizer", sup: "chemical", dept: "wastewater", status: "Review Due" },
  { group: "Oxidizer", th: "เบนโซอิลเปอร์ออกไซด์ 75%", en: "Benzoyl peroxide 75% (water-wetted)", cas: "94-36-0", comp: "Dibenzoyl peroxide", ratio: "75% w/w",
    components: [{ composition: "Dibenzoyl peroxide", cas: "94-36-0", ratio: "75% w/w" }, { composition: "Water", cas: "7732-18-5", ratio: "25% w/w" }],
    hz: "BFIE", sw: "Danger", fp: "สลายตัวก่อนติดไฟ / Decomposes before ignition", fa: "solvent", ff: "peroxide", er: "oxidizer", ppe: "oxidizer", sup: "chemical", dept: "store" },
  { group: "Gas", th: "ก๊าซปิโตรเลียมเหลว (LPG)", en: "Liquefied petroleum gas (LPG)", cas: "68476-85-7", comp: "Propane\nButane", ratio: "C3:C4 = 40:60",
    components: [{ composition: "Propane", cas: "74-98-6", ratio: "30-50%" }, { composition: "Butane", cas: "106-97-8", ratio: "50-70%" }],
    hz: "FG", sw: "Danger", fp: "-104°C", fa: "gas", ff: "flammableGas", er: "flammableGas", ppe: "gas", sup: "gas", dept: "production" },
  { group: "Gas", th: "อะเซทิลีน", en: "Acetylene, dissolved", cas: "74-86-2", comp: "Acetylene", ratio: "≥ 98%", hz: "FG", sw: "Danger", fp: "-18°C", fa: "gas", ff: "flammableGas", er: "flammableGas", ppe: "gas", sup: "gas", dept: "maintenance" },
  { group: "Gas", th: "แอมโมเนีย (ไร้น้ำ)", en: "Anhydrous ammonia", cas: "7664-41-7", comp: "Ammonia", ratio: "≥ 99.5%", hz: "GCTE", sw: "Danger", fp: "ไม่มีจุดวาบไฟ / Not applicable (gas)", fa: "toxicGas", ff: "ammonia", er: "toxicGas", ppe: "toxicGas", sup: "gas", dept: "maintenance" },
  { group: "Gas", th: "คลอรีน", en: "Chlorine", cas: "7782-50-5", comp: "Chlorine", ratio: "≥ 99.5%", hz: "GOTE", sw: "Danger", fp: NON_FLAMMABLE, fa: "toxicGas", ff: "chlorine", er: "toxicGas", ppe: "toxicGas", sup: "gas", dept: "wastewater" },
  { group: "Gas", th: "ไนโตรเจน (อัดความดัน)", en: "Nitrogen, compressed", cas: "7727-37-9", comp: "Nitrogen", ratio: "≥ 99.99%", hz: "G", sw: "Warning", fp: NON_FLAMMABLE, fa: "gas", ff: "inertGas", er: "inertGas", ppe: "gas", sup: "gas", dept: "production" },
  { group: "Gas", th: "ออกซิเจน (อัดความดัน)", en: "Oxygen, compressed", cas: "7782-44-7", comp: "Oxygen", ratio: "≥ 99.5%", hz: "OG", sw: "Danger", fp: NON_FLAMMABLE, fa: "gas", ff: "inertGas", er: "oxidizer", ppe: "gas", sup: "gas", dept: "maintenance" },
  { group: "Gas", th: "คาร์บอนไดออกไซด์", en: "Carbon dioxide", cas: "124-38-9", comp: "Carbon dioxide", ratio: "≥ 99.9%", hz: "G", sw: "Warning", fp: NON_FLAMMABLE, fa: "gas", ff: "inertGas", er: "inertGas", ppe: "gas", sup: "gas", dept: "production", noPdf: true },
  { group: "Fuel", th: "น้ำมันดีเซล", en: "Diesel fuel", cas: "68334-30-5", comp: "Fuels, diesel", ratio: "100%", hz: "FHIE", sw: "Danger", fp: "> 52°C (closed cup)", fa: "solvent", ff: "hydrocarbon", er: "solvent", ppe: "solvent", sup: "petro", dept: "transport", status: "Update Required" },
  { group: "Other", th: "ฟอร์มาลดีไฮด์ 37% (ฟอร์มาลิน)", en: "Formaldehyde solution 37%", cas: "50-00-0", comp: "Formaldehyde\nMethanol", ratio: "37% w/w",
    components: [
      { composition: "Formaldehyde", cas: "50-00-0", ratio: "37% w/w" },
      { composition: "Methanol", cas: "67-56-1", ratio: "10-15% w/w" },
      { composition: "Water", cas: "7732-18-5", ratio: "balance" }],
    hz: "TCH", sw: "Danger", fp: "64°C (closed cup)", fa: "toxic", ff: "polarSolvent", er: "corrosive", ppe: "corrosive", sup: "chemical", dept: "qc" },
  { group: "Other", th: "เอทิลีนไกลคอล", en: "Ethylene glycol", cas: "107-21-1", comp: "Ethane-1,2-diol", ratio: "≥ 99%", hz: "IH", sw: "Warning", fp: "111°C (closed cup)", fa: "toxic", ff: "polarSolvent", er: "mild", ppe: "mild", sup: "petro", dept: "maintenance" },
  { group: "Other", th: "น้ำมันหล่อลื่น (น้ำมันแร่)", en: "Mineral oil (lubricant base oil)", cas: "8042-47-5", comp: "White mineral oil (petroleum)", ratio: "100%", hz: "", sw: "", fp: "> 180°C (open cup)", fa: "mild", ff: "oil", er: "mild", ppe: "mild", sup: "petro", dept: "maintenance", noPdf: true }
];

function buildRecords() {
  return DEFINITIONS.map((def, index) => {
    const sequence = index + 1;
    const id = 2000 + sequence;
    const status = def.status || "Current";
    const revisionDaysAgo = 30 + ((sequence * 53) % 700);
    const reviewInDays = status === "Review Due" ? 9 + (sequence % 12)
      : status === "Update Required" ? -(15 + (sequence % 20))
        : 3 * 365 - revisionDaysAgo;
    const hasEnglishPdf = !def.noPdf;
    const hasThaiPdf = !def.noPdf && sequence % 3 !== 0;
    const englishPdfName = hasEnglishPdf ? `sds-${id}-en.pdf` : "";
    const thaiPdfName = hasThaiPdf ? `sds-${id}-th.pdf` : "";
    const englishPdfUrl = hasEnglishPdf ? `assets/demo-sds/${englishPdfName}` : "";
    const thaiPdfUrl = hasThaiPdf ? `assets/demo-sds/${thaiPdfName}` : "";
    const hazards = def.hz.split("").map(key => P[key]);
    return {
      id,
      sequence,
      group: def.group,
      chemical: def.en,
      chemicalThai: def.th,
      chemicalEnglish: def.en,
      cas: def.cas,
      composition: def.comp,
      ratio: def.ratio,
      components: def.components || single(def.comp.split("\n")[0], def.cas, def.ratio),
      supplier: SUPPLIER[def.sup],
      responsibleParty: DEPT[def.dept],
      recorder: "",
      dateOfUse: "",
      registerSds: "DM-SDS-" + String(sequence).padStart(3, "0"),
      revision: "Rev. " + (1 + (sequence % 5)),
      revisionDaysAgo,
      reviewInDays,
      status,
      signalWord: def.sw,
      hazards,
      pictograms: hazards.slice(),
      flashPoint: def.fp,
      emergencyResponse: ER[def.er],
      language: "English",
      sdsLanguages: hasThaiPdf ? ["English", "Thai"] : (hasEnglishPdf ? ["English"] : []),
      thaiSds: hasThaiPdf,
      hasPdf: hasEnglishPdf || hasThaiPdf,
      pdfUrl: englishPdfUrl,
      pdfName: englishPdfName,
      thaiPdfUrl,
      thaiPdfName,
      englishPdfUrl,
      englishPdfName,
      firstAidMeasures: FA[def.fa],
      firefightingMeasures: FF[def.ff],
      personalProtectiveEquipment: PPE[def.ppe].slice()
    };
  });
}

function recordsLiteral(records) {
  return "[\n" + records.map(record => "  " + JSON.stringify(record)).join(",\n") + "\n]";
}

function main() {
  const records = buildRecords();
  const ids = new Set(records.map(r => r.id));
  if (ids.size !== records.length) throw new Error("duplicate ids");
  const banner = "Generated by tools/build-demo-seed.js — do not edit by hand.";

  fs.mkdirSync(path.join(root, "seed"), { recursive: true });
  fs.writeFileSync(path.join(root, "seed", "demo-seed.json"),
    JSON.stringify({ version: SEED_VERSION, note: banner, records }, null, 2) + "\n");

  fs.writeFileSync(path.join(root, "apps-script", "DemoSeed.gs"),
    "/**\n * DEMO seed data (fictional company: Demo Co., Ltd.).\n * " + banner + "\n" +
    " * Dates are relative: revisionDaysAgo / reviewInDays are converted to real\n" +
    " * dates by seedDemoData_() in Demo.gs every time the demo is reset.\n */\n\n" +
    "var DEMO_SEED_VERSION = " + JSON.stringify(SEED_VERSION) + ";\n\n" +
    "var DEMO_SEED_RECORDS = " + recordsLiteral(records) + ";\n");

  fs.writeFileSync(path.join(root, "docs", "demo-seed.js"),
    "/* DEMO seed data (fictional company: Demo Co., Ltd.).\n   " + banner + "\n" +
    "   The same records are written to the Google Sheet by seedDemoData_(). */\n" +
    "window.DEMO_SEED_VERSION = " + JSON.stringify(SEED_VERSION) + ";\n" +
    "window.DEMO_SEED_RECORDS = " + recordsLiteral(records) + ";\n");

  console.log("Wrote " + records.length + " demo records (" + SEED_VERSION + ").");
}

if (require.main === module) main();
module.exports = { buildRecords, SEED_VERSION };
