/**
 * ניתוח ואימות ייבוא חברי ארגון (Excel / CSV) — פרופיל מוטב מלא כמו טופס ידני
 */
import xlsx from 'xlsx';
import {
  HEALTH_FUND_OPTIONS_HE,
  HEALTH_FUND_ALIASES,
  GENDER_OPTIONS_HE,
  GENDER_ALIASES,
  MARITAL_STATUS_OPTIONS_HE,
  SUPPLEMENTAL_INSURANCE_OPTIONS_HE,
} from './beneficiaryConstants.js';
import { validateIsraeliId, formatIsraeliIdStored, ISRAELI_ID_INVALID_MSG } from './israeliId.js';

/** סדר התאמת כותרות — דפוסים ארוכים קודם */
const FIELD_HEADER_PATTERNS = [
  {
    field: 'fullName',
    patterns: ['שם מלא', 'full name', 'fullname', 'שםמלא'],
  },
  {
    field: 'id',
    patterns: ['תעודת זהות', 'מספר זהות', 'תז', 'id number', 'idnumber', 'national id', 'תעודתזהות'],
  },
  {
    field: 'dateOfBirth',
    patterns: ['תאריך לידה', 'date of birth', 'dob', 'תאריךלידה', 'לידה'],
  },
  {
    field: 'gender',
    patterns: ['מין', 'gender', 'sex'],
  },
  {
    field: 'email',
    patterns: ['אימייל', 'email', 'דואל', 'מייל'],
  },
  {
    field: 'phone',
    patterns: ['טלפון', 'phone', 'נייד', 'mobile', 'סלולרי'],
  },
  {
    field: 'address',
    patterns: ['כתובת מלאה', 'כתובת', 'address', 'full address', 'כתובתמלאה'],
  },
  {
    field: 'city',
    patterns: ['עיר', 'city'],
  },
  {
    field: 'street',
    patterns: ['רחוב', 'street'],
  },
  {
    field: 'houseNumber',
    patterns: ['מספר בית', 'בית', 'house number', 'house no', 'מספרבית'],
  },
  {
    field: 'healthFund',
    patterns: ['קופת חולים', 'קופה', 'health fund', 'hmo', 'קופתחולים'],
  },
  {
    field: 'supplementalInsurance',
    patterns: ['ביטוח משלים', 'משלים', 'supplemental', 'supplementary insurance'],
  },
  {
    field: 'maritalStatus',
    patterns: ['מצב משפחתי', 'משפחתי', 'marital', 'מצבמשפחתי'],
  },
];

export { HEALTH_FUND_OPTIONS_HE, GENDER_OPTIONS_HE } from './beneficiaryConstants.js';

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/["'`]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function matchHeaderToField(headerCell) {
  const n = normKey(headerCell);
  if (!n) return null;
  for (const { field, patterns } of FIELD_HEADER_PATTERNS) {
    for (const p of patterns) {
      const pn = normKey(p);
      if (!pn) continue;
      if (n === pn || n.endsWith(pn) || pn.endsWith(n) || n.includes(pn)) {
        return field;
      }
    }
  }
  return null;
}

/** Excel serial date -> YYYY-MM-DD */
function excelSerialToIso(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return '';
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * תאריך מ-DD/MM/YYYY, YYYY-MM-DD, אובייקט Date, או מספר אקסל
 */
export function parseDateToIso(raw) {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number') {
    const fromSerial = excelSerialToIso(raw);
    if (fromSerial) return fromSerial;
    return '';
  }
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (m) {
    let dd = m[1].padStart(2, '0');
    let mm = m[2].padStart(2, '0');
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const iso = `${yyyy}-${mm}-${dd}`;
    const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
    if (!Number.isNaN(dt.getTime())) return iso;
  }
  return '';
}

export function normalizeHealthFund(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (HEALTH_FUND_OPTIONS_HE.includes(t)) return t;
  const compact = t.replace(/\s+/g, '');
  const lower = t.toLowerCase().replace(/\s+/g, '');
  for (const [alias, canon] of Object.entries(HEALTH_FUND_ALIASES)) {
    const a = alias.toLowerCase().replace(/\s+/g, '');
    if (lower === a || compact === alias.replace(/\s+/g, '')) return canon;
  }
  const lowerLatin = lower.replace(/[^a-z]/g, '');
  for (const [alias, canon] of Object.entries(HEALTH_FUND_ALIASES)) {
    const a = alias.toLowerCase().replace(/[^a-z\u0590-\u05FF]/g, '');
    if (a && (lowerLatin === a || lower.includes(a))) return canon;
  }
  for (const h of HEALTH_FUND_OPTIONS_HE) {
    if (t.includes(h)) return h;
  }
  return '';
}

export function normalizeGender(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (GENDER_OPTIONS_HE.includes(t)) return t;
  const k = t.toLowerCase().trim();
  if (GENDER_ALIASES[k]) return GENDER_ALIASES[k];
  const noSpace = k.replace(/\s+/g, '');
  if (GENDER_ALIASES[noSpace]) return GENDER_ALIASES[noSpace];
  return '';
}

function normalizeSupplemental(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (SUPPLEMENTAL_INSURANCE_OPTIONS_HE.includes(t)) return t;
  const lower = t.toLowerCase();
  for (const o of SUPPLEMENTAL_INSURANCE_OPTIONS_HE) {
    if (lower === o.toLowerCase()) return o;
  }
  return t;
}

function normalizeMarital(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  for (const o of MARITAL_STATUS_OPTIONS_HE) {
    if (t === o || t.includes(o) || o.includes(t)) return o;
  }
  return t;
}

function buildAddressLine(row) {
  const full = String(row.address || '').trim();
  if (full) return full;
  const parts = [row.city, row.street, row.houseNumber].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.join(', ');
}

/**
 * שורה גולמית מהקובץ -> שורה מנורמלת + שגיאות אימות (ללא כפילות עסקה)
 */
export function normalizeAndValidateImportRow(raw, lineNumber) {
  const messages = [];
  const fullName = String(raw.fullName || '').trim();
  const id = String(raw.id || '').trim();
  let idNumNorm = '';
  if (!fullName) messages.push('חסר שם מלא');
  if (!id) messages.push('חסרה תעודת זהות');
  else {
    const idDigits = id.replace(/\D/g, '');
    if (!idDigits) messages.push('חסרה תעודת זהות');
    else if (idDigits.length > 9) messages.push(ISRAELI_ID_INVALID_MSG);
    else if (!validateIsraeliId(idDigits)) messages.push(ISRAELI_ID_INVALID_MSG);
    else idNumNorm = formatIsraeliIdStored(idDigits) || idDigits.padStart(9, '0');
  }

  const dateOfBirthIso = parseDateToIso(raw.dateOfBirth);
  const dobRaw = String(raw.dateOfBirth || '').trim();
  if (dobRaw && !dateOfBirthIso) {
    messages.push('תאריך לידה לא תקין (השתמשו ב-DD/MM/YYYY או YYYY-MM-DD)');
  }

  const healthRaw = String(raw.healthFund || '').trim();
  const healthFund = normalizeHealthFund(healthRaw);
  if (healthRaw && !healthFund) {
    messages.push(
      `קופת חולים לא מוכרת: "${healthRaw}". מותר: ${HEALTH_FUND_OPTIONS_HE.join(', ')} (או Clalit, Maccabi, Meuhedet, Leumit)`
    );
  }

  const genderRaw = String(raw.gender || '').trim();
  const gender = normalizeGender(genderRaw);
  if (genderRaw && !gender) {
    messages.push(`מין לא מוכר: "${genderRaw}". מותר: ${GENDER_OPTIONS_HE.join(', ')} או Male/Female`);
  }

  const profile = {
    fullName,
    idNum: idNumNorm || id,
    email: String(raw.email || '').trim(),
    phone: String(raw.phone || '').trim(),
    dateOfBirth: dateOfBirthIso,
    gender,
    address: buildAddressLine(raw),
    healthFund,
    supplementalInsurance: normalizeSupplemental(raw.supplementalInsurance),
    maritalStatus: normalizeMarital(raw.maritalStatus),
  };

  return { profile, messages, lineNumber, ok: messages.length === 0 };
}

/**
 * @returns {{
 *   rows: object[],
 *   headerErrors: string[],
 *   normalizedRows: ReturnType<typeof normalizeAndValidateImportRow>[],
 * }}
 */
export function parseOrgMemberImportBuffer(buffer) {
  const headerErrors = [];
  const rows = [];
  if (!buffer || !buffer.length) {
    headerErrors.push('קובץ ריק');
    return { rows: [], headerErrors, normalizedRows: [] };
  }

  let sheetRows;
  try {
    const wb = xlsx.read(buffer, { type: 'buffer', raw: true, codepage: 65001, cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      headerErrors.push('אין גיליון בקובץ');
      return { rows: [], headerErrors, normalizedRows: [] };
    }
    const sheet = wb.Sheets[sheetName];
    sheetRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  } catch (e) {
    headerErrors.push(e?.message || 'קריאת הקובץ נכשלה');
    return { rows: [], headerErrors, normalizedRows: [] };
  }

  if (!sheetRows || sheetRows.length < 2) {
    headerErrors.push('נדרשות שורת כותרות ולפחות שורת נתונים אחת');
    return { rows: [], headerErrors, normalizedRows: [] };
  }

  const headerRow = sheetRows[0].map((c) => String(c ?? '').trim());
  const colMap = {};
  const usedFields = new Set();
  headerRow.forEach((h, i) => {
    const f = matchHeaderToField(h);
    if (f && !usedFields.has(f)) {
      colMap[i] = f;
      usedFields.add(f);
    }
  });

  if (!usedFields.has('id')) headerErrors.push('חסרה עמודת תעודת זהות בכותרות');
  if (!usedFields.has('fullName')) headerErrors.push('חסרה עמודת שם מלא בכותרות');

  if (headerErrors.length) {
    return { rows: [], headerErrors, normalizedRows: [] };
  }

  for (let r = 1; r < sheetRows.length; r++) {
    const line = sheetRows[r];
    if (!line || !line.some((c) => String(c ?? '').trim() !== '')) continue;
    const obj = {
      fullName: '',
      id: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      address: '',
      city: '',
      street: '',
      houseNumber: '',
      healthFund: '',
      supplementalInsurance: '',
      maritalStatus: '',
    };
    Object.keys(colMap).forEach((ci) => {
      const field = colMap[ci];
      const cell = line[Number(ci)];
      obj[field] = cell instanceof Date ? cell : String(cell ?? '').trim();
    });
    rows.push(obj);
  }

  const normalizedRows = rows.map((raw, idx) => normalizeAndValidateImportRow(raw, idx + 2));

  return { rows, headerErrors, normalizedRows };
}

export function buildOrgImportTemplateBuffer() {
  const headers = [
    'שם מלא',
    'תעודת זהות',
    'תאריך לידה (DD/MM/YYYY)',
    'מין',
    'אימייל',
    'טלפון',
    'כתובת מלאה (עיר, רחוב, מספר בית)',
    'קופת חולים',
    'ביטוח משלים',
    'מצב משפחתי',
  ];
  const sample = [
    'ישראל ישראלי',
    '123456782',
    '15/03/1990',
    'זכר',
    'israel@example.com',
    '0501234567',
    'תל אביב, רחוב הרצל 10, דירה 3',
    'כללית',
    'זהב',
    'נשוי/אה',
  ];
  const ws = xlsx.utils.aoa_to_sheet([headers, sample]);
  ws['!views'] = [{ RTL: true }];
  // Right align Hebrew headers for better readability in Excel.
  for (let c = 0; c < headers.length; c += 1) {
    const cellRef = xlsx.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) ws[cellRef].s = { alignment: { horizontal: 'right' } };
  }
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'ייבוא');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
