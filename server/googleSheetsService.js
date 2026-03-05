/**
 * Opal – Google Sheets injection for "טבלת שליטה ראשית".
 * Uses Google Sheets API (values.get / values.update) only. No getCell or loadCells.
 * Mapping: A=Date, G=Status, J=TransactionId, M=Payer/Beneficiary, N=Package, P=Amount, Q,R=First/Last, S=ID, U=Email,
 * AA=תאריך לידה, AB=מצב משפחתי, AC=קופת חולים, AD=ביטוח משלים, AE=סביבה.
 * Writes to the first empty row (column A empty); no append. Duplicate transactionId in column J skips write.
 */

import { google } from 'googleapis'; // זה הייבוא הנכון שכולל את כל הפונקציות
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SHEET_TITLE = 'טבלת שליטה ראשית';
const SHEET_TITLE_QUOTED = `'${SHEET_TITLE}'`;

/** Column headers – must match row 1 of the sheet exactly */
const HEADERS = {
  A: 'חודש ההסכם',  // Date MM/YYYY
  G: 'סטטוס עסקה',  // "פעיל"
  J: "מס' הזמנה",   // Transaction ID
  M: 'סטטוס לקוח',  // 1 Payer, 0 Beneficiary
  N: 'סוג חבילה',   // e.g. "חבילה א"
  P: 'מחיר',        // Full amount (payer only), 0 beneficiaries
  Q: 'שם פרטי',
  R: 'משפחה',
  S: 'ת.ז',
  U: 'אימייל',
  AA: 'תאריך לידה',
  AB: 'מצב משפחתי',
  AC: 'קופת חולים',
  AD: 'ביטוח משלים',
  AE: 'סביבה',      // TEST | LIVE (Environment)
};

/** 0-based column indices for Values API (A=0 … AE=30). */
const COL = {
  A: 0,
  G: 6,
  J: 9,
  M: 12,
  N: 13,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  U: 20,
  AA: 26,
  AB: 27,
  AC: 28,
  AD: 29,
  AE: 30,
};
const TOTAL_COLUMNS = 31;   // A through AE; index 30 = column AE
const SCAN_MAX_ROWS = 5000;

function getCurrentMonthStr() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${m}/${y}`;
}

/** Plan id → Hebrew package name for column N */
function getPackageName(planId) {
  const map = {
    'plan-a': 'חבילה א',
    'plan-b': 'חבילה ב',
    'plan-fg': 'חבילה ו/ז',
  };
  return map[planId] ?? planId ?? '';
}

function splitFullName(fullName) {
  const t = (fullName || '').trim();
  if (!t) return { firstName: '', lastName: '' };
  const idx = t.indexOf(' ');
  if (idx === -1) return { firstName: t, lastName: '' };
  return { firstName: t.slice(0, idx), lastName: t.slice(idx + 1).trim() };
}

function buildRow(opts) {
  return {
    [HEADERS.A]: opts.dateMonth,
    [HEADERS.G]: 'פעיל',
    [HEADERS.J]: opts.transactionId,
    [HEADERS.M]: opts.customerStatus,
    [HEADERS.N]: opts.packageName,
    [HEADERS.P]: opts.price,
    [HEADERS.Q]: opts.firstName,
    [HEADERS.R]: opts.lastName,
    [HEADERS.S]: opts.id,
    [HEADERS.U]: opts.email ?? '',
    [HEADERS.AA]: opts.dateOfBirth ?? '',
    [HEADERS.AB]: opts.maritalStatus ?? '',
    [HEADERS.AC]: opts.healthFund ?? '',
    [HEADERS.AD]: opts.supplementalInsurance ?? '',
    [HEADERS.AE]: opts.environment ?? '',
  };
}

/**
 * Build one row as a 31-element array for Values API (A=0 … AE=30).
 * Ensures column AE (index 30) is always included.
 */
function rowToValuesArray(rowObj) {
  const arr = Array(TOTAL_COLUMNS).fill('');
  arr[COL.A] = rowObj[HEADERS.A] ?? '';
  arr[COL.G] = rowObj[HEADERS.G] ?? '';
  arr[COL.J] = rowObj[HEADERS.J] ?? '';
  arr[COL.M] = rowObj[HEADERS.M] ?? '';
  arr[COL.N] = rowObj[HEADERS.N] ?? '';
  arr[COL.P] = rowObj[HEADERS.P] ?? '';
  arr[COL.Q] = rowObj[HEADERS.Q] ?? '';
  arr[COL.R] = rowObj[HEADERS.R] ?? '';
  arr[COL.S] = rowObj[HEADERS.S] ?? '';
  arr[COL.U] = rowObj[HEADERS.U] ?? '';
  arr[COL.AA] = rowObj[HEADERS.AA] ?? '';
  arr[COL.AB] = rowObj[HEADERS.AB] ?? '';
  arr[COL.AC] = rowObj[HEADERS.AC] ?? '';
  arr[COL.AD] = rowObj[HEADERS.AD] ?? '';
  arr[COL.AE] = rowObj[HEADERS.AE] ?? '';
  return arr;
}

/**
 * Ensure header row has 'סביבה' in column AE. If not, set AE1 via values.update.
 */
async function ensureHeaderEnvironment(sheetsClient, spreadsheetId) {
  const range = `${SHEET_TITLE_QUOTED}!A1:AE1`;
  const res = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values;
  const headerRow = rows && rows[0] ? rows[0] : [];
  const aeHeader = (headerRow[30] ?? '').toString().trim();
  if (aeHeader === HEADERS.AE) {
    return;
  }
  console.log('Sheets — Adding header "סביבה" in column AE.');
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TITLE_QUOTED}!AE1:AE1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[HEADERS.AE]] },
  });
}

/**
 * Find first row where column A is empty (data starts at row 2).
 * Uses spreadsheets.values.get for range A:AE, maps to 2D array, scans for empty index 0.
 */
async function findFirstEmptyRowAndCheckDuplicate(sheetsClient, spreadsheetId, transactionId) {
  const range = `${SHEET_TITLE_QUOTED}!A2:AE${Math.min(SCAN_MAX_ROWS, 3000)}`;
  const res = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
  const rows = (res.data.values || []).map(row => Array.isArray(row) ? row : []);
  const txIdStr = String(transactionId ?? '').trim();
  let firstEmptyRow0 = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const aVal = (row[COL.A] ?? '').toString().trim();
    const jVal = (row[COL.J] ?? '').toString().trim();
    if (txIdStr && jVal === txIdStr) {
      return { firstEmptyRow0: firstEmptyRow0 ?? i + 1, duplicate: true };
    }
    if (aVal === '' && firstEmptyRow0 === null) {
      firstEmptyRow0 = i + 1;
    }
  }
  return { firstEmptyRow0: firstEmptyRow0 ?? rows.length + 1, duplicate: false };
}

/**
 * Write rows via spreadsheets.values.update with a 2D array (31 columns per row; AE at position 30).
 */
async function writeRowsAt(sheetsClient, spreadsheetId, startRow1Based, rowsToAdd) {
  const values = rowsToAdd.map(rowToValuesArray);
  for (const row of values) {
    if (row.length !== TOTAL_COLUMNS) {
      throw new Error(`Row must have exactly ${TOTAL_COLUMNS} elements (A–AE); got ${row.length}.`);
    }
  }
  const endRow1Based = startRow1Based + values.length - 1;
  const range = `${SHEET_TITLE_QUOTED}!A${startRow1Based}:AE${endRow1Based}`;
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Write payer + beneficiaries to "טבלת שליטה ראשית" at the first empty row (column A empty).
 *
 * @param {Object} params
 * @param {string} params.spreadsheetId
 * @param {Object} params.auth - { client_email, private_key }
 * @param {string} params.transactionId - From Cardcom (column J); used for duplicate check
 * @param {number} params.payerAmount - Full amount for payer (column P)
 * @param {Object} params.payer - { fullName, id, email, agentName, organizationName, planId, planSku, dateOfBirth, maritalStatus, healthFund, supplementalInsurance }
 * @param {Array<{ firstName, lastName, id, dateOfBirth, maritalStatus, healthFund, supplementalInsurance }>} params.beneficiaries
 * @param {number} [params.terminalNumber] - If 1000 write 'TEST' in column AE, else 'LIVE'
 * @returns {Promise<{ appendedCount: number, payerRowIndex: number, duplicate?: boolean }>}
 */
export async function appendPayerAndBeneficiaries(params) {
  const {
    spreadsheetId,
    auth,
    transactionId,
    payerAmount,
    payer,
    beneficiaries = [],
    terminalNumber,
  } = params;

  const environment = Number(terminalNumber) === 1000 ? 'TEST' : 'LIVE';

  const dateMonth = getCurrentMonthStr();
  const packageName = getPackageName(payer.planId);
  const { firstName: payerFirst, lastName: payerLast } = splitFullName(payer.fullName);

  const jwt = createAuth(auth);
  if (typeof jwt.authorize === 'function') {
    await jwt.authorize();
  }
  const sheetsClient = google.sheets({ version: 'v4', auth: jwt });

  console.log('Sheets — Spreadsheet:', spreadsheetId, '| Tab:', SHEET_TITLE);
  await ensureHeaderEnvironment(sheetsClient, spreadsheetId);

  const { firstEmptyRow0, duplicate } = await findFirstEmptyRowAndCheckDuplicate(sheetsClient, spreadsheetId, transactionId);
  if (duplicate) {
    console.log('Sheets — Duplicate transactionId in column J, skipping:', transactionId);
    return { appendedCount: 0, payerRowIndex: firstEmptyRow0 + 1, duplicate: true };
  }

  const payerRow = buildRow({
    dateMonth,
    transactionId,
    customerStatus: 1,
    packageName,
    price: payerAmount,
    firstName: payerFirst,
    lastName: payerLast,
    id: payer.id ?? '',
    email: payer.email ?? '',
    dateOfBirth: payer.dateOfBirth ?? '',
    maritalStatus: payer.maritalStatus ?? '',
    healthFund: payer.healthFund ?? '',
    supplementalInsurance: payer.supplementalInsurance ?? '',
    environment,
  });

  const rowsToAdd = [payerRow];
  for (const b of beneficiaries) {
    rowsToAdd.push(
      buildRow({
        dateMonth,
        transactionId,
        customerStatus: 0,
        packageName,
        price: 0,
        firstName: b.firstName ?? '',
        lastName: b.lastName ?? '',
        id: b.id ?? '',
        email: '',
        dateOfBirth: b.dateOfBirth ?? '',
        maritalStatus: b.maritalStatus ?? '',
        healthFund: b.healthFund ?? '',
        supplementalInsurance: b.supplementalInsurance ?? '',
        environment,
      })
    );
  }

  const startRow1Based = firstEmptyRow0 + 1;
  console.log('Sheets — Writing rows', startRow1Based, 'to', startRow1Based + rowsToAdd.length - 1, '| סביבה:', environment);

  await writeRowsAt(sheetsClient, spreadsheetId, startRow1Based, rowsToAdd);

  return {
    appendedCount: rowsToAdd.length,
    payerRowIndex: startRow1Based,
  };
}

function createAuth(auth) {
  const email = auth?.client_email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = auth?.private_key ?? process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      'Google Sheets auth: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, or pass auth from service-account.json.'
    );
  }
  return new JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function loadCredentialsFromFile(filePath) {
  const path =
    filePath ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    resolve(process.cwd(), 'service-account.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!data.client_email || !data.private_key) {
    throw new Error('Invalid service account JSON: missing client_email or private_key');
  }
  return { client_email: data.client_email, private_key: data.private_key };
}

export function formPayloadToSheetParams(sheetPayload, transactionId, payerAmount) {
  return {
    transactionId,
    payerAmount,
    payer: sheetPayload.payer,
    beneficiaries: sheetPayload.beneficiaries ?? [],
  };
}

/**
 * Append one or more rows to a sheet tab by title (e.g. "צרו קשר", "רשום ארגון").
 * @param {Object} params
 * @param {string} params.spreadsheetId
 * @param {Object} params.auth - { client_email, private_key }
 * @param {string} params.sheetTitle - exact tab name
 * @param {Array<Array<string|number>>} params.rows - 2D array of values (one row per array)
 */
export async function appendToSheetTab(params) {
  const { spreadsheetId, auth, sheetTitle, rows } = params;
  if (!rows?.length) return;

  const jwt = createAuth(auth);
  if (typeof jwt.authorize === 'function') await jwt.authorize();
  const sheetsClient = google.sheets({ version: 'v4', auth: jwt });

  const quoted = `'${sheetTitle}'`;
  const range = `${quoted}!A:Z`;
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

export { HEADERS, getCurrentMonthStr, getPackageName };
