/**
 * סימולציה ל־Cardcom Master Recurring Webhook (בלי חיוב אמיתי).
 *
 * הרצה מקומית מול שרת מקומי:
 *   node simulate-cardcom-recurring.js <cardcomRecurringId>
 *
 * הרצה מול Production (Railway) — חובה להגדיר את אותו Secret כמו בשרת:
 *   $env:CARDCOM_MASTER_RECURRING_SECRET="..."; $env:BASE_URL="https://opal-production-5fee.up.railway.app"; node simulate-cardcom-recurring.js 40867
 *
 * (בלי Secret תואם, השרת דוחה את הבקשה ברקע ולא נוצרת רשומה — רק 200 OK.)
 *
 * משתני סביבה אופציונליים:
 * - BASE_URL (ברירת מחדל: http://localhost:3001)
 * - ADMIN_USERNAME / ADMIN_PASSWORD — לבדיקת /api/admin/deals אחרי כל תרחיש
 * - CARDCOM_MASTER_RECURRING_SECRET — חובה אם מוגדר בשרת (Railway)
 * - WEBHOOK_POLL_MS (ברירת מחדל: 2500) — זמן המתנה אחרי POST (העיבוד אסינכרוני בשרת)
 * - WEBHOOK_POLL_ATTEMPTS (ברירת מחדל: 12) — כמה פעמים לבדוק שוב את הרשימה
 */

const recurringId = String(process.argv[2] || '').trim();
if (!recurringId) {
  console.error('Missing cardcomRecurringId.\nUsage: node simulate-cardcom-recurring.js <cardcomRecurringId>');
  process.exit(1);
}

const BASE_URL = String(process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'admin');
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'OpalAdmin2026');
const WEBHOOK_SECRET = String(process.env.CARDCOM_MASTER_RECURRING_SECRET || '').trim();
const POLL_MS = Math.max(500, Number(process.env.WEBHOOK_POLL_MS || 2500));
const POLL_ATTEMPTS = Math.max(1, Number(process.env.WEBHOOK_POLL_ATTEMPTS || 12));

function ymdNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(offset || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** התאמה למזהה הוראת קבע גם כשב־DB נשמר כמספר וגם כמחרוזת */
function sameCardcomRecurringId(d, rid) {
  const want = String(rid).trim();
  const v = d?.cardcomRecurringId;
  if (v == null || v === '') return false;
  const got = String(v).trim();
  if (got === want) return true;
  const nWant = Number(want);
  const nGot = Number(got);
  if (Number.isFinite(nWant) && Number.isFinite(nGot) && nWant === nGot) return true;
  return false;
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { _raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${body?.error || text || JSON.stringify(body)}`);
  }
  return body;
}

/** ה־webhook מחזיר 200 עם גוף טקסט "OK" (לא JSON) — לא לפרסר כ־JSON בלבד */
async function postMasterRecurringWebhook(payload) {
  const res = await fetch(`${BASE_URL}/api/cardcom-master-recurring-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return { status: res.status, body: text };
}

async function getAdminToken() {
  const payload = await requestJson(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!payload?.success || !payload?.token) throw new Error('Admin login failed');
  return payload.token;
}

async function getDeals(token) {
  const payload = await requestJson(`${BASE_URL}/api/admin/deals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(payload?.deals) ? payload.deals : [];
}

function recurringRows(deals, rid) {
  return (deals || []).filter((d) => sameCardcomRecurringId(d, rid));
}

function parentRows(deals, rid) {
  return recurringRows(deals, rid).filter((d) => d.isRecurringCycle !== true);
}

function recurringCycleRows(deals, rid) {
  return recurringRows(deals, rid).filter((d) => d.isRecurringCycle === true);
}

async function waitForNewCycle(token, beforeCount, rid) {
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    await new Promise((r) => setTimeout(r, i === 0 ? POLL_MS : 400));
    const deals = await getDeals(token);
    const after = recurringCycleRows(deals, rid).length;
    if (after > beforeCount) return { deals, matched: true };
    if (i === POLL_ATTEMPTS - 1) return { deals, matched: false };
  }
  const deals = await getDeals(token);
  return { deals, matched: recurringCycleRows(deals, rid).length > beforeCount };
}

function printVerification(beforeCyclesLen, afterDeals, scenarioName, expectedFailure, rid) {
  const afterCycles = recurringCycleRows(afterDeals, rid);
  const created = afterCycles.length > beforeCyclesLen;
  const latestCycle = [...afterCycles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const parents = parentRows(afterDeals, rid);
  const parent = [...parents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const arrearsStatus = 'שגיאת סליקה - פיגור בתשלום';
  const statusUpdated = expectedFailure ? String(parent?.subscriptionStatus || '') === arrearsStatus : true;

  console.log(`\n=== ${scenarioName} ===`);
  console.log(`Record created: ${created ? 'YES' : 'NO'}`);
  console.log(`Recurring rows count: before=${beforeCyclesLen}, after=${afterCycles.length}`);
  console.log(
    `Latest cycle => billingMonth=${String(latestCycle?.billingMonth || '—')}, paymentStatus=${String(latestCycle?.paymentStatus || '—')}, responsdescription=${String(latestCycle?.indicator?.responsdescription || '—')}`
  );
  if (expectedFailure) {
    console.log(`Subscriber status updated to arrears: ${statusUpdated ? 'YES' : 'NO'}`);
    console.log(`Parent subscriptionStatus: ${String(parent?.subscriptionStatus || '—')}`);
    console.log(`Parent futureBillingStatus: ${String(parent?.futureBillingStatus || '—')}`);
  } else {
    console.log(`Parent subscriptionStatus (unchanged check): ${String(parent?.subscriptionStatus || '—')}`);
    console.log(`Parent futureBillingStatus: ${String(parent?.futureBillingStatus || '—')}`);
  }
  if (!created) {
    console.log(
      'Hint: אם תמיד NO — אימות: (1) האם ב־deals יש עסקה עם cardcomRecurringId הזה? (2) האם CARDCOM_MASTER_RECURRING_SECRET תואם לשרת? (3) האם deployment כולל את לוגיקת ה־webhook?'
    );
  }
}

async function postRecurringWebhook({ responsecode, responsdescription, billingMonthOffset }) {
  const payload = {
    RecurringId: recurringId,
    responsecode: String(responsecode),
    responsdescription: String(responsdescription),
    InternalDealNumber: '',
    amount: '99.00',
    billDate: ymdNow(),
    billingMonth: monthLabel(billingMonthOffset),
    MutagName: 'Visa',
    Lest4Numbers: '4242',
  };
  if (WEBHOOK_SECRET) payload.Secret = WEBHOOK_SECRET;

  const { status, body } = await postMasterRecurringWebhook(payload);
  console.log(`  [webhook] HTTP ${status} body=${JSON.stringify(body).slice(0, 80)}`);
}

async function runScenario(token, config, rid) {
  const beforeDeals = await getDeals(token);
  const beforeCycles = recurringCycleRows(beforeDeals, rid);
  await postRecurringWebhook(config);
  const { deals: afterDeals, matched } = await waitForNewCycle(token, beforeCycles.length, rid);
  printVerification(beforeCycles.length, afterDeals, config.name, config.expectedFailure === true, rid);
  if (!matched) {
    console.log('  (אחרי המתנה/polling — עדיין לא נראה מחזור חדש; ייתכן parent לא נמצא ב־DB או Secret שגוי.)');
  }
}

async function scenarioSuccessMonth2(token, rid) {
  return runScenario(token, {
    name: 'Scenario 1: Success (Month 2)',
    responsecode: '0',
    responsdescription: 'תקין',
    billingMonthOffset: 0,
    expectedFailure: false,
  }, rid);
}

async function scenarioExpiredMonth3(token, rid) {
  return runScenario(token, {
    name: 'Scenario 2: Technical Failure (Month 3 - Expired)',
    responsecode: '004',
    responsdescription: 'כרטיס פג תוקף',
    billingMonthOffset: 1,
    expectedFailure: true,
  }, rid);
}

async function scenarioDeniedMonth4(token, rid) {
  return runScenario(token, {
    name: 'Scenario 3: Client Cancellation (Month 4 - Denied)',
    responsecode: '057',
    responsdescription: 'חסום להוראת קבע/בוטל ע"י לקוח',
    billingMonthOffset: 2,
    expectedFailure: true,
  }, rid);
}

async function main() {
  console.log(`Using BASE_URL=${BASE_URL}`);
  console.log(`Testing cardcomRecurringId=${recurringId}`);
  if (!WEBHOOK_SECRET && /railway|production|opal-production/i.test(BASE_URL)) {
    console.warn(
      '\n⚠ אזהרה: מול production מומלץ להגדיר CARDCOM_MASTER_RECURRING_SECRET (אותו ערך כמו ב־Railway). בלי זה השרת ידחה את ה־webhook ברקע.\n'
    );
  }

  const token = await getAdminToken();
  const initialDeals = await getDeals(token);
  const parents = parentRows(initialDeals, recurringId);
  const anyMatch = recurringRows(initialDeals, recurringId).length;
  console.log(
    `\nPreflight: עסקאות עם אותו cardcomRecurringId: ${anyMatch} (מתוכן parent/עסקת בסיס: ${parents.length})`
  );
  if (parents.length === 0) {
    console.warn(
      '⚠ לא נמצאה עסקת בסיס עם cardcomRecurringId זה. ה־webhook מחפש לפי מזהה הוראת קבע על עסקה קיימת — בלי רשומה כזו לא תיווצר היסטוריה.\n'
    );
  }

  await scenarioSuccessMonth2(token, recurringId);
  await scenarioExpiredMonth3(token, recurringId);
  await scenarioDeniedMonth4(token, recurringId);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nSimulation failed:', err.message || err);
  process.exit(1);
});
