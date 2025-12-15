const { createWorker } = require('tesseract.js');
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });

// Thai title deed markers (โฉนด)
const THAI_DEED_KEYWORDS = [
  'โฉนดที่ดิน', 'เลขที่โฉนด', 'สำนักงานที่ดิน', 'ที่ตั้งที่ดิน',
  'อำเภอ', 'ตำบล', 'จังหวัด', 'หนังสือรับรองการทำประโยชน์'
];

// Utility issuers (no MEA). PEA = Provincial Electricity Authority; MWA = Metropolitan Waterworks; PWA = Provincial Waterworks.
const ISSUERS = [
  { key: 'pea',  markers: ['การไฟฟ้าส่วนภูมิภาค', 'Provincial Electricity Authority', 'PEA'], acctHints: ['หมายเลขผู้ใช้ไฟฟ้า','เลขที่ผู้ใช้ไฟฟ้า','CA'] },
  { key: 'mwa',  markers: ['การประปานครหลวง', 'Metropolitan Waterworks Authority', 'MWA'], acctHints: ['เลขที่ผู้ใช้น้ำ','Customer No','รหัสผู้ใช้น้ำ'] },
  { key: 'pwa',  markers: ['การประปาส่วนภูมิภาค', 'Provincial Waterworks Authority', 'PWA'], acctHints: ['เลขที่ผู้ใช้น้ำ','Customer No','รหัสผู้ใช้น้ำ'] },
  { key: 'telco',markers: ['AIS','TRUE','DTAC','ใบแจ้งค่าใช้บริการ','โทรคมนาคม'], acctHints: ['เลขที่ลูกค้า','Customer No','Account No'] },
];

function normalize(s=''){
  return s.replace(/[^\p{L}\p{N}\s,./-]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
function includesAny(text, arr){
  const T = normalize(text); return arr.some(k => T.includes(normalize(k)));
}
function approxIncludes(hay='', needle=''){
  const H=normalize(hay), N=normalize(needle);
  if(!N || N==='unknown') return true;
  if(H.includes(N)) return true;
  const toks=N.split(/\s+/).filter(Boolean);
  const hit=toks.filter(t=>H.includes(t)).length;
  return toks.length ? (hit/toks.length>=0.7) : false;
}
async function ocrToText(buffer){
  const worker=await createWorker('eng+tha',1);
  try{ const {data}=await worker.recognize(buffer); return data?.text||''; }
  finally{ await worker.terminate(); }
}

// Heuristic account number detection by issuer
function detectAccountNumber(ocr, issuerKey){
  const digits = (ocr.match(/\b\d{8,16}\b/g)||[]); // generic 8–16 digits
  if(!digits.length) return null;
  switch(issuerKey){
    case 'pea':  // PEA formats vary; prefer 12–13
      return digits.find(d=>d.length===12) || digits.find(d=>d.length===13) || digits[0];
    case 'mwa':
    case 'pwa':
      return digits.find(d=>d.length===8 || d.length===10 || d.length===12) || digits[0];
    case 'telco':
    default:
      return digits[0];
  }
}

// JSON schemas
const deedSchema = {
  type:'object', additionalProperties:false,
  required:['ownerName','propertyAddress'],
  properties:{ ownerName:{type:'string',minLength:1}, propertyAddress:{type:'string',minLength:1} }
};
const billSchema = {
  type:'object', additionalProperties:false,
  required:['nameOnBill','addressOnBill'],
  properties:{
    nameOnBill:{type:'string',minLength:1},
    addressOnBill:{type:'string',minLength:1},
    issuer:{type:'string',minLength:1},
    accountNumber:{type:['string','null']}
  }
};
const validateDeed = ajv.compile(deedSchema);
const validateBill = ajv.compile(billSchema);
