// utils/aiModel.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createWorker } = require('tesseract.js');
const Ajv = require('ajv');

/* ========================= Model Setup ========================= */
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const proModel   = genAI.getGenerativeModel({ model: 'gemini-2.5-pro'   });
const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/* ======================= Error Utilities ======================= */
class UserFacingError extends Error {
  constructor(code, message, hint = null, status = 400, field = null) {
    super(message);
    this.name = 'UserFacingError';
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.field = field;
    this.expose = true;
  }
}
const ufErr = (code, message, hint, status = 400, field = null) =>
  new UserFacingError(code, message, hint, status, field);

/* =========================== Constants ========================= */
const THAI_DEED_KEYWORDS = [
  'โฉนดที่ดิน', 'เลขที่โฉนด', 'สำนักงานที่ดิน', 'ที่ตั้งที่ดิน',
  'อำเภอ', 'ตำบล', 'จังหวัด', 'หนังสือรับรองการทำประโยชน์'
];

const ISSUERS = [
  { key: 'mea',  markers: ['การไฟฟ้านครหลวง','Metropolitan Electricity Authority','MEA'], acctHints: ['หมายเลขผู้ใช้ไฟฟ้า','เลขที่ผู้ใช้ไฟฟ้า','CA','Customer Account'] },
  { key: 'pea',  markers: ['การไฟฟ้าส่วนภูมิภาค','Provincial Electricity Authority','PEA'], acctHints: ['หมายเลขผู้ใช้ไฟฟ้า','เลขที่ผู้ใช้ไฟฟ้า','CA'] },
  { key: 'mwa',  markers: ['การประปานครหลวง','Metropolitan Waterworks Authority','MWA'],   acctHints: ['เลขที่ผู้ใช้น้ำ','Customer No','รหัสผู้ใช้น้ำ'] },
  { key: 'pwa',  markers: ['การประปาส่วนภูมิภาค','Provincial Waterworks Authority','PWA'], acctHints: ['เลขที่ผู้ใช้น้ำ','Customer No','รหัสผู้ใช้น้ำ'] },
  { key: 'telco',markers: ['AIS','TRUE','DTAC','ใบแจ้งค่าใช้บริการ','โทรคมนาคม'],         acctHints: ['เลขที่ลูกค้า','Customer No','Account No'] },
];

/* ========================= Small Text Utils ==================== */
function normalize(s=''){
  return s.replace(/[^\p{L}\p{N}\s,./-]/gu,' ')
          .replace(/\s+/g,' ')
          .trim()
          .toLowerCase();
}
function includesAny(text, arr){
  const T = normalize(text);
  return arr.some(k => T.includes(normalize(k)));
}
function approxIncludes(hay='', needle=''){
  const H=normalize(hay), N=normalize(needle);
  if(!N || N==='unknown') return true;
  if(H.includes(N)) return true;
  const toks = N.split(/\s+/).filter(Boolean);
  const hit  = toks.filter(t => H.includes(t)).length;
  return toks.length ? (hit / toks.length >= 0.7) : false;
}

/* ============================== OCR ============================ */
/**
 * Node-friendly Tesseract worker for English + Thai.
 * No native deps; works out of the box.
 */
async function ocrToText(buffer) {
  // ✅ For tesseract.js v4/v5 style API
  const worker = await createWorker(); // no positional args
  try {
    await worker.load();                                // load core
    await worker.loadLanguage('eng+tha');               // download/load traineddata
    await worker.initialize('eng+tha');                 // init with langs
    const { data } = await worker.recognize(buffer);    // do OCR
    return data?.text || '';
  } finally {
    await worker.terminate();
  }
}

/* ==================== Account Number Heuristics ================= */
function detectAccountNumber(ocr, issuerKey){
  const digits = (ocr.match(/\b\d{8,16}\b/g) || []);
  if(!digits.length) return null;
  switch(issuerKey){
    case 'mea': return digits.find(d => d.length === 12) || digits[0];
    case 'pea': return digits.find(d => d.length === 12) || digits.find(d => d.length === 13) || digits[0];
    case 'mwa':
    case 'pwa': return digits.find(d => [8,10,12].includes(d.length)) || digits[0];
    default:    return digits[0];
  }
}

/* ============================ Schemas ========================== */
const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });

const deedSchema = {
  type:'object', additionalProperties:false, required:['ownerName','propertyAddress'],
  properties:{ ownerName:{type:'string',minLength:1}, propertyAddress:{type:'string',minLength:1} }
};
const billSchema = {
  type:'object', additionalProperties:false, required:['nameOnBill','addressOnBill','issuer','accountNumber'],
  properties:{
    nameOnBill:{type:'string',minLength:1},
    addressOnBill:{type:'string',minLength:1},
    issuer:{type:'string',minLength:1},
    accountNumber:{type:['string','null']}
  }
};
const validateDeed = ajv.compile(deedSchema);
const validateBill = ajv.compile(billSchema);

/* ======================== Gemini Helpers ======================= */
async function genJson(model, prompt, imagePart){
  // Prefer JSON mime type; fallback to loose parsing if provider ignores it.
  try {
    const r = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }, imagePart] }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    });
    const txt = (r?.response?.text?.() ?? '').trim();
    return JSON.parse(txt);
  } catch {
    const r = await model.generateContent([prompt, imagePart]);
    const raw = (r?.response?.text?.() ?? '')
      .replace(/```json/gi,'').replace(/```/g,'').trim();
    return JSON.parse(raw);
  }
}

/* ========================= Public API ========================== */
/**
 * Extract canonical contract fingerprint line.
 */
async function AiScanContract(fileBuffer, mimeType) {
     console.log("🤖 Gemini Flash: Extracting contract fingerprint...");
  const prompt = `
You analyze Thai/English rental/lease agreements.
Return ONE line exactly:
Landlord: <Full Name> | Tenant: <Full Name> | Unit: <Unit Number and Full Address> | From: <DD/MM/YYYY> | To: <DD/MM/YYYY> | Rent: <Monthly Rent Number>
If a field is unclear, use "unknown".
No extra text.`;
  try {
    const imagePart = { inlineData: { data: fileBuffer.toString('base64'), mimeType } };
    const r = await flashModel.generateContent([prompt, imagePart]);
    const fingerprint = r?.response?.text?.().trim() || '';
     console.log("✅ Fingerprint extracted by Gemini:", fingerprint);
    if (!fingerprint) throw new Error('empty');
    return fingerprint;
  } catch (err) {
    throw ufErr(
      'CONTRACT_FINGERPRINT_FAIL',
      'We could not read the contract details.',
      'Upload a clear, full-page photo where names, dates and unit address are visible.',
      400,
      'contract'
    );
  }
}

/**
 * Forensic authenticity score (0-100).
 */
async function AiCheckDocumentAuthenticity(fileBuffer, mimeType) {
  const prompt = `You are a forensic document analyst.
Analyze the image for digital manipulation or "photo-of-screen" signs (moire, glare, uneven sharpness).
Return ONLY a number (0-100) as authenticity likelihood. Example: 98.5`;
  try {
    const imagePart = { inlineData: { data: fileBuffer.toString('base64'), mimeType } };
    const r = await proModel.generateContent([prompt, imagePart]);
    const score = parseFloat(r?.response?.text?.().trim() || '0');
    return Number.isFinite(score) ? score : 0;
  } catch {
    throw ufErr(
      'DOC_AUTH_CHECK_FAIL',
      'We could not complete the authenticity check.',
      'Please re-upload a clear image without glare or reflections.',
      400,
      'file'
    );
  }
}

/**
 * Utility bill extractor with classifier, OCR issuer detection, JSON schema & evidence checks.
 */
async function AiextractUtilityBillData(fileBuffer, mimeType){
  // File sanity
  if (!/^image\//.test(mimeType || '') && mimeType !== 'application/pdf') {
    throw ufErr('BILL_UNSUPPORTED_FILETYPE','Unsupported file type for utility bills.','Upload an image (JPG/PNG) or PDF.',415,'utilityBill');
  }

  // Classifier includes utility_bill explicitly
  const cls = await AiclassifyDocument(fileBuffer, mimeType);
  if (cls?.type !== 'utility_bill' || (cls?.confidence ?? 0) < 0.80) {
    throw ufErr('BILL_CLASSIFIER_REJECT','The upload does not look like a utility bill.','Upload a recent electricity/water bill showing your name and service address.',400,'utilityBill');
  }

  const ocr = await ocrToText(fileBuffer);
  if (!ocr.trim()) {
    throw ufErr('BILL_OCR_EMPTY','We could not read any text from the bill.','Retake the photo in good light. Include the whole page.',400,'utilityBill');
  }

  const issuer = ISSUERS.find(x => includesAny(ocr, x.markers));
  if (!issuer) {
    throw ufErr('BILL_UNKNOWN_ISSUER','We could not recognise the utility provider.','Upload a bill from MEA/PEA/MWA/PWA and ensure logo/name is visible.',400,'utilityBill');
  }

  const prompt = `Parse this Thai utility bill (${issuer.key}).
Return ONLY this JSON:
{"nameOnBill":"...", "addressOnBill":"...", "issuer":"${issuer.key}", "accountNumber": null}
No extra fields. If unsure about a field, use "unknown".`;
  const imagePart = { inlineData: { data: fileBuffer.toString('base64'), mimeType } };

  let json;
  try {
    json = await genJson(flashModel, prompt, imagePart);
  } catch {
    throw ufErr('BILL_MODEL_PARSE_FAIL','We could not read the bill details.','Ensure name and service address are clear and unobstructed.',400,'utilityBill');
  }

  // Enrich + validate
  json.issuer = issuer.key;
  if (!json.accountNumber) json.accountNumber = detectAccountNumber(ocr, issuer.key) || null;

  if (!validateBill(json)) {
    throw ufErr('BILL_SCHEMA_INVALID','The bill details are incomplete.','Try a clearer image and ensure the header and address are visible.',400,'utilityBill');
  }

  // OCR evidence checks
  const okName = approxIncludes(ocr, json.nameOnBill);
  const okAddr = approxIncludes(ocr, json.addressOnBill);
  if (!okName || !okAddr) {
    throw ufErr('BILL_EVIDENCE_FAIL','The name or address on the bill is unclear.','Retake the photo in good light and avoid blur or glare.',400,'utilityBill');
  }

  return json; // { nameOnBill, addressOnBill, issuer, accountNumber }
}

/**
 * Thai title deed extractor with classifier, markers, schema & evidence checks.
 */
async function AiExtractDeedData(fileBuffer, mimeType){
  if (!/^image\//.test(mimeType || '') && mimeType !== 'application/pdf') {
    throw ufErr('DEED_UNSUPPORTED_FILETYPE','Unsupported file type for title deeds.','Upload an image (JPG/PNG) or PDF.',415,'titleDeed');
  }

  const cls = await AiclassifyDocument(fileBuffer, mimeType);
  if (cls?.type !== 'deed' || (cls?.confidence ?? 0) < 0.92) {
    throw ufErr('DEED_CLASSIFIER_REJECT','The upload does not look like a title deed.','Upload the official title deed page (โฉนดที่ดิน) with owner and address.',400,'titleDeed');
  }

  const ocr = await ocrToText(fileBuffer);
  if (!ocr.trim()) {
    throw ufErr('DEED_OCR_EMPTY','We could not read any text from the title deed.','Retake the photo flat and in focus. Avoid reflections.',400,'titleDeed');
  }
  if (!includesAny(ocr, THAI_DEED_KEYWORDS)) {
    throw ufErr('DEED_KEYWORDS_MISSING','Key title deed markers were not found.','Ensure “โฉนดที่ดิน / เลขที่โฉนด / สำนักงานที่ดิน” are visible.',400,'titleDeed');
  }

  const prompt = `Return ONLY this JSON:
{"ownerName":"...", "propertyAddress":"..."}
If unsure about a field, use "unknown". No explanations.`;
  const imagePart = { inlineData: { data: fileBuffer.toString('base64'), mimeType } };

  let json;
  try {
    json = await genJson(flashModel, prompt, imagePart);
  } catch {
    throw ufErr('DEED_MODEL_PARSE_FAIL','We could not read the deed details.','Capture the page with owner name and full property address readable.',400,'titleDeed');
  }

  if (!validateDeed(json)) {
    throw ufErr('DEED_SCHEMA_INVALID','The deed details are incomplete.','Ensure owner name and full property address are present and readable.',400,'titleDeed');
  }

  const okName = approxIncludes(ocr, json.ownerName);
  const okAddr = approxIncludes(ocr, json.propertyAddress);
  if (!okName || !okAddr) {
    throw ufErr('DEED_EVIDENCE_FAIL','Owner name or property address is unclear on the deed.','Capture the full page, flat and in focus.',400,'titleDeed');
  }

  return json; // { ownerName, propertyAddress }
}

/**
 * Address comparator (Thai tolerant).
 */
async function AiCompareAddresses(a, b) {
  const prompt = `You validate Thai addresses.
A: "${a}"
B: "${b}"
Do these refer to the same property despite minor typos/format differences? Reply only "true" or "false".`;
  try {
    const r = await flashModel.generateContent([prompt]);
    return (r?.response?.text?.().trim().toLowerCase() === 'true');
  } catch {
    // Non-critical; return false rather than throwing 500
    return false;
  }
}

/**
 * Best unit matcher — returns a unitId (string) or null.
 * Uses JSON response to avoid free-text mistakes.
 */
async function AiFindBestUnitMatch(unitInfoFromDoc, officialUnits) {
  const list = officialUnits.map(u => ({
    unitId: u._id.toString(),
    unitNumber: u.unitNumber,
    address: `${u.address.streetAddress}, ${u.address.district}, ${u.address.province}`
  }));

  const prompt = `
You match a contract snippet to a landlord's portfolio in Thailand.
Snippet: "${unitInfoFromDoc}"
Units (JSON array): ${JSON.stringify(list)}
Return ONLY this JSON: {"unitId":"<one_of_the_unitIds_or_none>"}
If not confident in any, return {"unitId":"none"}.
No explanations.`;

  try {
    const r = await genJson(flashModel, prompt, { inlineData: { data: Buffer.from('x').toString('base64'), mimeType: 'text/plain' } });
    const id = (r?.unitId || '').trim();
    if (!id || id.toLowerCase() === 'none') return null;
    const exists = officialUnits.some(u => u._id.toString() === id);
    return exists ? id : null;
  } catch {
    return null;
  }
}

/**
 * Document classifier with explicit 'utility_bill'.
 * Returns { type: 'contract'|'deed'|'utility_bill'|'invoice'|'photo'|'other', confidence: 0..1 }
 */
async function AiclassifyDocument(fileBuffer, mimeType) {
  const prompt = `
You are a meticulous document image analyst for Thai/English paperwork.
Step 1: Is the image a document or a non-document photo?
Step 2: If a document, classify into one of: "contract", "deed", "utility_bill", "invoice", or "other".
Output ONLY this JSON:
{"type":"contract|deed|utility_bill|invoice|photo|other","confidence":0..1}
Consider layout, tables, stamps, logos (MEA/PEA/MWA/PWA), signatures, and headings.`;

  try {
    const imagePart = { inlineData: { data: fileBuffer.toString('base64'), mimeType } };
    const r = await genJson(flashModel, prompt, imagePart);
    // Defensive normalization
    const allowed = new Set(['contract','deed','utility_bill','invoice','photo','other']);
    const type = (r?.type || 'other').toLowerCase();
    const conf = Number(r?.confidence ?? 0.5);
    return { type: allowed.has(type) ? type : 'other', confidence: Number.isFinite(conf) ? conf : 0.5 };
  } catch {
    return { type: 'other', confidence: 0.5 };
  }
}

/* ============================ Exports ========================== */
module.exports = {
  // main API
  AiScanContract,
  AiCheckDocumentAuthenticity,
  AiextractUtilityBillData,
  AiExtractDeedData,
  AiCompareAddresses,
  AiFindBestUnitMatch,
  AiclassifyDocument,

  // helpers
  ocrToText,
  detectAccountNumber,
  ISSUERS,
  THAI_DEED_KEYWORDS,

  // error utilities
  UserFacingError,
  ufErr
};
