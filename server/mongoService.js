import { MongoClient, ObjectId } from 'mongodb';
import { getEntitlementStatus, parseFlexibleDate } from './entitlementStatus.js';

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URL || '';
const DB_NAME = process.env.MONGO_DB_NAME || 'opal';

let clientPromise = null;
let dealsIndexesPromise = null;

function getClient() {
  if (!MONGO_URL) {
    throw new Error('MONGODB_URI/MONGO_URL is not set');
  }
  if (!clientPromise) {
    const client = new MongoClient(MONGO_URL);
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  const db = client.db(DB_NAME);
  if (!dealsIndexesPromise) {
    dealsIndexesPromise = ensureDealsIndexes(db).catch((err) => {
      dealsIndexesPromise = null;
      throw err;
    });
  }
  await dealsIndexesPromise;
  return db;
}

async function ensureDealsIndexes(db) {
  // TODO: re-enable after DB disk space is freed.
  // const deals = db.collection('deals');
  // await Promise.all([
  //   deals.createIndex({ organizationId: 1 }),
  //   deals.createIndex({ createdAt: -1 }),
  //   deals.createIndex({ 'formState.id': 1 }),
  //   deals.createIndex({ paymentStatus: 1, createdAt: -1 }),
  // ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Distributed checkout lock + session persistence
//
// Why MongoDB instead of in-memory Map:
//   An in-memory lock only works within a single Node.js process. Under PM2
//   cluster mode (or any multi-instance deployment) each process has its own
//   Map, so the lock is invisible to sibling processes. Cardcom fires GET and
//   POST webhooks concurrently; they may land on different workers, each of
//   which then calls createRecurringProfileFromLowProfile — producing duplicate
//   recurring profiles.
//
//   MongoDB's insertOne with a unique index is atomic across all connections.
//   The first process to insert wins; every other insert throws a duplicate-key
//   error (code 11000), which we treat as "lock already held".
//
// Indexes (created once at first getDb() call via ensureCheckoutCollectionIndexes):
//   checkout_locks.lowProfileCode  — unique, ensures atomic acquisition
//   checkout_locks.lockedAt        — TTL 30 min, self-cleans stale locks
//   checkout_sessions.lowProfileCode — unique
//   checkout_sessions.savedAt      — TTL 2 h, self-cleans old form data
// ─────────────────────────────────────────────────────────────────────────────

let checkoutIndexesPromise = null;

export async function ensureCheckoutCollectionIndexes() {
  if (checkoutIndexesPromise) return checkoutIndexesPromise;
  checkoutIndexesPromise = (async () => {
    const db = await getDb();
    await db.collection('checkout_locks').createIndex(
      { lowProfileCode: 1 },
      { unique: true, name: 'lpc_unique' }
    );
    await db.collection('checkout_locks').createIndex(
      { lockedAt: 1 },
      { expireAfterSeconds: 1800, name: 'lpc_ttl_30min' }
    );
    await db.collection('checkout_sessions').createIndex(
      { lowProfileCode: 1 },
      { unique: true, name: 'cs_lpc_unique' }
    );
    await db.collection('checkout_sessions').createIndex(
      { savedAt: 1 },
      { expireAfterSeconds: 7200, name: 'cs_ttl_2h' }
    );
  })().catch((err) => {
    checkoutIndexesPromise = null;
    console.error('[checkout-indexes] Failed to create indexes:', err?.message || err);
  });
  return checkoutIndexesPromise;
}

/**
 * Atomically acquire a per-lowProfileCode processing lock.
 * Returns true if the lock was acquired (caller should proceed).
 * Returns false if another process already holds it (caller should skip).
 * Throws on unexpected DB errors.
 */
export async function tryAcquireCheckoutLock(lowProfileCode) {
  const db = await getDb();
  try {
    await db.collection('checkout_locks').insertOne({
      lowProfileCode: String(lowProfileCode),
      lockedAt: new Date(),
    });
    return true;
  } catch (e) {
    if (e.code === 11000) return false; // duplicate key → another process holds the lock
    throw e;
  }
}

/**
 * Release the lock (delete the document).
 * Called after successful processing so that legitimate Cardcom retries can
 * enter and verify the deal — they will find the deal already saved and skip Step2.
 * Non-blocking: if the delete fails the TTL index cleans up within 30 minutes.
 */
export async function releaseCheckoutLock(lowProfileCode) {
  try {
    const db = await getDb();
    await db.collection('checkout_locks').deleteOne({ lowProfileCode: String(lowProfileCode) });
  } catch {
    /* non-critical — TTL index will remove the stale lock automatically */
  }
}

/**
 * Persist the full checkout session (formState + payerAmount) to MongoDB.
 * This allows any server instance to handle the Cardcom webhook, not just the
 * instance that originally created the checkout session.
 */
export async function persistCheckoutSession(lowProfileCode, { formState, payerAmount }) {
  const db = await getDb();
  await db.collection('checkout_sessions').updateOne(
    { lowProfileCode: String(lowProfileCode) },
    {
      $set: {
        lowProfileCode: String(lowProfileCode),
        formState,
        payerAmount: Number(payerAmount || 0),
        savedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Load a previously-persisted checkout session.
 * Returns { formState, payerAmount } or null if not found / expired.
 */
export async function loadCheckoutSession(lowProfileCode) {
  const db = await getDb();
  const doc = await db.collection('checkout_sessions').findOne(
    { lowProfileCode: String(lowProfileCode) },
    { projection: { _id: 0, formState: 1, payerAmount: 1 } }
  );
  return doc || null;
}

/** חודש לדוחות בילינג — YYYY-MM */
export function formatBillingMonthFromDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export async function saveDeal(params) {
  const db = await getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');
  const internalDealNumber = String(params?.indicator?.internalDealNumber || '').trim();

  const deals = db.collection('deals');
  const duplicateQuery = [];
  duplicateQuery.push({ transactionId });
  if (internalDealNumber) duplicateQuery.push({ 'indicator.internalDealNumber': internalDealNumber });
  const exists = await deals.findOne({ $or: duplicateQuery }, { projection: { _id: 1 } });
  if (exists) {
    const set = {
      updatedAt: new Date(),
      paymentStatus: String(params.paymentStatus || '').trim() || 'paid',
    };
    if (params.lowProfileCode != null) set.lowProfileCode = String(params.lowProfileCode || '').trim();
    if (params.cardcomAccountId != null) set.cardcomAccountId = String(params.cardcomAccountId || '').trim();
    if (params.cardcomRecurringId != null) set.cardcomRecurringId = String(params.cardcomRecurringId || '').trim();
    if (params.cardcomToken != null) set.cardcomToken = String(params.cardcomToken || '').trim();
    if (params.lastFourDigits != null) set.lastFourDigits = String(params.lastFourDigits || '').trim();
    if (params.payerAmount != null) set.payerAmount = Number(params.payerAmount || 0);
    if (params.formState && typeof params.formState === 'object') set.formState = params.formState;
    if (params.indicator && typeof params.indicator === 'object') set.indicator = params.indicator;
    if (params.normalizedPayload && typeof params.normalizedPayload === 'object') set.normalizedPayload = params.normalizedPayload;
    await deals.updateOne({ _id: exists._id }, { $set: set });
    return { duplicate: true, id: String(exists._id), updated: true };
  }

  const now = new Date();
  const fs = params.formState && typeof params.formState === 'object' ? params.formState : {};
  const agentIdRaw = params.agentId != null ? params.agentId : fs.agentId;
  const agentId =
    agentIdRaw != null && String(agentIdRaw).trim() !== '' ? String(agentIdRaw).trim() : null;

  let commissionAmount = Number(fs.resolvedAgentCommission ?? 0);
  let mergedFormState = params.formState && typeof params.formState === 'object' ? { ...params.formState } : {};
  delete mergedFormState.subscriptionStartDate;

  // If economics were already resolved during checkout-session creation they are
  // snapshotted in formState.  Re-fetching from the Agent table would apply any
  // commission change made after the customer initiated checkout — which must NOT
  // happen.  Only resolve dynamically when no snapshot exists yet.
  const alreadySnapshotted =
    fs.resolvedAgentCommission != null && fs.resolvedVendorCost != null;

  if (alreadySnapshotted) {
    commissionAmount = Number(fs.resolvedAgentCommission);
    mergedFormState = {
      ...mergedFormState,
      resolvedVendorCost:       fs.resolvedVendorCost,
      resolvedAgentCommission:  fs.resolvedAgentCommission,
      resolvedNetProfit:        fs.resolvedNetProfit,
    };
  } else {
    try {
      const { resolveCheckoutEconomics } = await import('./adminMongooseService.js');
      const econ = await resolveCheckoutEconomics(fs);
      commissionAmount = Number(econ.resolvedAgentCommission ?? commissionAmount);
      mergedFormState = {
        ...mergedFormState,
        resolvedVendorCost:      econ.resolvedVendorCost,
        resolvedAgentCommission: econ.resolvedAgentCommission,
        resolvedNetProfit:       econ.resolvedNetProfit,
      };
      if (econ.productName && !String(mergedFormState.productName || '').trim()) {
        mergedFormState.productName = econ.productName;
      }
    } catch {
      /* עסקה ללא מחירון מלא — נשאר מ־formState */
    }
  }
  const billingMonth = formatBillingMonthFromDate(now);

  const orgIdFromParams =
    params.organizationId != null && String(params.organizationId).trim() !== ''
      ? String(params.organizationId).trim()
      : null;
  const orgIdFromFs =
    mergedFormState.organizationId != null && String(mergedFormState.organizationId).trim() !== ''
      ? String(mergedFormState.organizationId).trim()
      : null;
  const organizationId = orgIdFromParams || orgIdFromFs || null;
  const isOrganizationDeal = Boolean(
    params.isOrganizationDeal === true ||
      mergedFormState.isOrganizationDeal === true ||
      mergedFormState.orgPrivateEnrollment === true ||
      !!organizationId
  );
  const memberTypeRaw = String(params.memberType || mergedFormState.memberType || 'Primary').trim();
  const memberType = memberTypeRaw === 'Secondary' ? 'Secondary' : 'Primary';

  const doc = {
    transactionId,
    /** מזהה Cardcom LowProfile — לחיפוש עסקה לפני קבלת מס׳ הזמנה סופי */
    lowProfileCode: params.lowProfileCode != null ? String(params.lowProfileCode).trim() : '',
    /** BillGold — מזהי מנוי חוזר אחרי תשלום (מ־GetLowProfileIndicator) */
    cardcomAccountId:
      params.cardcomAccountId != null && String(params.cardcomAccountId).trim() !== ''
        ? String(params.cardcomAccountId).trim()
        : '',
    cardcomRecurringId:
      params.cardcomRecurringId != null && String(params.cardcomRecurringId).trim() !== ''
        ? String(params.cardcomRecurringId).trim()
        : '',
    cardcomToken:
      params.cardcomToken != null && String(params.cardcomToken).trim() !== ''
        ? String(params.cardcomToken).trim()
        : '',
    /** 4 ספרות אחרונות מכרטיס (Cardcom CardNum/Lest4Numbers/Last4Numbers) */
    lastFourDigits:
      params.lastFourDigits != null && String(params.lastFourDigits).trim() !== ''
        ? String(params.lastFourDigits).trim()
        : String(mergedFormState?.lastFourDigits || '').trim(),
    payerAmount: Number(params.payerAmount || 0),
    formState: mergedFormState,
    /** מזהה סוכן (מנוי) — לספירת מכירות לפי סוכן */
    agentId,
    terminalNumber: Number(params.terminalNumber || 0),
    paymentStatus: params.paymentStatus || 'success',
    source: params.source || 'webhook',
    indicator: params.indicator || null,
    normalizedPayload: params.normalizedPayload || null,
    /** עמלת סוכן לעסקה (מחושב מפרופיל סוכן / מחירון) */
    commissionAmount,
    /** חודש שיוך לדוחות (תשלום מרוכז וכו׳) */
    billingMonth: String(params.billingMonth || billingMonth),
    isRecurringCycle: params.isRecurringCycle === true,
    parentDealId:
      params.parentDealId != null && String(params.parentDealId).trim() !== ''
        ? String(params.parentDealId).trim()
        : null,
    organizationId: organizationId || null,
    isOrganizationDeal,
    memberType,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...(params.status != null ? { status: String(params.status) } : {}),
  };

  const result = await deals.insertOne(doc);
  return { duplicate: false, id: String(result.insertedId) };
}

export async function findDealForRecurringEvent(params = {}) {
  const db = await getDb();
  const deals = db.collection('deals');
  const tid = String(params.transactionId || '').trim();
  const lowProfileCode = String(params.lowProfileCode || '').trim();
  const recurringId = String(params.cardcomRecurringId || '').trim();
  const accountId = String(params.cardcomAccountId || '').trim();
  const token = String(params.cardcomToken || '').trim();

  const pickPrimary = (rows) => rows.find((d) => d.isRecurringCycle !== true) || rows[0];
  const toResult = (primary) => ({
    id: String(primary._id),
    transactionId: String(primary.transactionId || ''),
    formState: primary.formState && typeof primary.formState === 'object' ? primary.formState : {},
    payerAmount: Number(primary.payerAmount || 0),
    terminalNumber: Number(primary.terminalNumber || 0),
    agentId: primary.agentId ? String(primary.agentId) : null,
    source: String(primary.source || ''),
    cardcomRecurringId: String(primary.cardcomRecurringId || ''),
  });
  const query = (filter) =>
    deals.find({ ...filter, isActive: { $ne: false } }).sort({ createdAt: 1 }).limit(20).toArray();

  // --- שלב 1: מזהים ייחודיים למנוי (transactionId, lowProfileCode, cardcomRecurringId) ---
  const uniqueOr = [];
  if (tid) uniqueOr.push({ transactionId: tid });
  if (lowProfileCode) uniqueOr.push({ lowProfileCode });
  if (recurringId) {
    const asNum = Number(recurringId);
    if (Number.isFinite(asNum) && !Number.isNaN(asNum) && String(asNum) === recurringId) {
      const vals = [recurringId, asNum];
      uniqueOr.push({ cardcomRecurringId: { $in: vals } });
      uniqueOr.push({ 'formState.cardcomRecurringId': { $in: vals } });
      uniqueOr.push({ 'indicator.step2CardcomRecurringId': { $in: vals } });
      uniqueOr.push({ 'indicator.cardcomRecurringId': { $in: vals } });
    } else {
      uniqueOr.push({ cardcomRecurringId: recurringId });
      uniqueOr.push({ 'formState.cardcomRecurringId': recurringId });
      uniqueOr.push({ 'indicator.step2CardcomRecurringId': recurringId });
      uniqueOr.push({ 'indicator.cardcomRecurringId': recurringId });
    }
  }
  if (uniqueOr.length) {
    const rows = await query({ $or: uniqueOr });
    if (rows.length) return toResult(pickPrimary(rows));
  }

  // --- שלב 2: fallback בלבד לאחר שכל המזהים הייחודיים מיצו ---
  // accountId ו-token עלולים להתאים לכמה מנויים — משתמשים בהם רק כאחרון מוצא
  const fallbackOr = [];
  if (token) fallbackOr.push({ cardcomToken: token });
  if (accountId) fallbackOr.push({ cardcomAccountId: accountId });
  if (!fallbackOr.length) return null;
  const fallbackRows = await query({ $or: fallbackOr });
  if (!fallbackRows.length) return null;
  return toResult(pickPrimary(fallbackRows));
}

const SUBSCRIPTION_ARREARS_LABEL = 'שגיאת סליקה - פיגור בתשלום';

/**
 * מסנכרן את עסקת האב אחרי חיוב חוזר מקארדקום: futureBillingStatus מתוך responsdescription (לא קבוע מקומי),
 * ומעדכן subscriptionStatus בכשל / משחזר Active אחרי הצלחה כשהיה פיגור.
 */
export async function syncParentFutureBillingAfterRecurringWebhook(parentDealId, recurringId = '', opts = {}) {
  const paymentSuccess = opts.paymentSuccess === true;
  const responseDescription = String(opts.responseDescription ?? '').trim();
  const db = await getDb();
  const deals = db.collection('deals');
  const now = new Date();

  const buildSet = (existing) => {
    const set = {
      futureBillingStatus: responseDescription,
      updatedAt: now,
    };
    if (paymentSuccess) {
      if (String(existing?.subscriptionStatus || '') === SUBSCRIPTION_ARREARS_LABEL) {
        set.subscriptionStatus = 'Active';
      }
    } else {
      set.subscriptionStatus = SUBSCRIPTION_ARREARS_LABEL;
    }
    return set;
  };

  const parentId = String(parentDealId || '').trim();
  if (parentId && ObjectId.isValid(parentId)) {
    const oid = new ObjectId(parentId);
    const existing = await deals.findOne({ _id: oid });
    if (!existing) return;
    await deals.updateOne({ _id: oid }, { $set: buildSet(existing) });
    return;
  }

  const rid = String(recurringId || '').trim();
  if (!rid) return;
  const asNum = Number(rid);
  const idFilter =
    Number.isFinite(asNum) && !Number.isNaN(asNum) && String(asNum) === rid
      ? { cardcomRecurringId: { $in: [rid, asNum] } }
      : { cardcomRecurringId: rid };
  const masters = await deals
    .find({ ...idFilter, isRecurringCycle: { $ne: true }, isActive: { $ne: false } })
    .toArray();
  for (const existing of masters) {
    await deals.updateOne({ _id: existing._id }, { $set: buildSet(existing) });
  }
}

/** @deprecated — נשמר לתאימות; מעדיף syncParentFutureBillingAfterRecurringWebhook */
export async function setDealPaymentArrears(parentDealId, recurringId = '', options = {}) {
  return syncParentFutureBillingAfterRecurringWebhook(parentDealId, recurringId, {
    paymentSuccess: false,
    responseDescription: String(options.responseDescription ?? options.futureBillingStatus ?? ''),
  });
}

/** שדות webhook DetailRecurring מ-Cardcom */
function pickDrField(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseDetailNumber(obj, keys, fallback = 0) {
  const s = pickDrField(obj, keys);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

const DETAIL_RECURRING_STATUS_LABELS = {
  1: 'SUCCESSFUL',
  2: 'PENDINGFORPROCESSING',
  3: 'DEBTAUTOBILLING',
  4: 'LOSTDEBT',
  5: 'PAYBYOTHERE',
  6: 'ONHOLD',
  7: 'OTHER',
};

function mapDetailRecurringStatusCode(raw) {
  if (raw === undefined || raw === null || raw === '') return 7;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 7 ? n : 7;
  }
  const key = s.toUpperCase().replace(/\s+/g, '').replace(/_/g, '');
  const nameMap = {
    SUCCESSFUL: 1,
    PENDINGFORPROCESSING: 2,
    DEBTAUTOBILLING: 3,
    LOSTDEBT: 4,
    PAYBYOTHERE: 5,
    ONHOLD: 6,
    OTHER: 7,
  };
  return nameMap[key] ?? 7;
}

/**
 * עיבוד דוח DetailRecurring מ-Cardcom: שמירה על עסקת האב + יומן עמלות לפי חיוב בפועל.
 */
export async function processDetailRecurringWebhook(body = {}, query = {}) {
  let normalized =
    typeof body === 'string'
      ? Object.fromEntries(new URLSearchParams(body))
      : { ...(body && typeof body === 'object' ? body : {}) };
  if (query && typeof query === 'object') normalized = { ...query, ...normalized };

  const recordType = String(normalized.RecordType || normalized.recordType || '').trim();
  if (recordType.toLowerCase() !== 'detailrecurring') {
    return { ok: true, skipped: true, reason: 'not_detail_recurring' };
  }

  const secretExpected = String(
    process.env.CARDCOM_DETAIL_RECURRING_SECRET || process.env.CARDCOM_MASTER_RECURRING_SECRET || ''
  ).trim();
  const secretReceived = String(normalized.Secret ?? normalized.secret ?? '').trim();
  const secretValidated = !secretExpected || secretReceived === secretExpected;
  console.log(
    `[DetailRecurring] Secret validation: ${secretValidated ? 'PASSED' : 'FAILED'} (hasExpectedSecret=${secretExpected ? 'yes' : 'no'})`
  );
  if (secretExpected && secretReceived !== secretExpected) {
    throw new Error('Invalid DetailRecurring secret');
  }

  const rowId = pickDrField(normalized, ['RowID', 'rowId', 'RowId']);
  console.log(`[DetailRecurring] rowId received: ${rowId || '(empty)'}`);
  if (!rowId) throw new Error('DetailRecurring missing RowID');

  const internalDealNumber = pickDrField(normalized, ['InternalDealNumber', 'internalDealNumber']);
  const lowProfileCode = pickDrField(normalized, ['LowProfileCode', 'lowProfileCode']);
  const recurringIdRaw = pickDrField(normalized, ['RecurringId', 'recurringId']);
  const accountIdRaw = pickDrField(normalized, ['AccountId', 'accountId']);
  const tokenRaw = pickDrField(normalized, ['Token', 'CardToken', 'TokenToSave']);
  console.log(
    `[DetailRecurring] Match keys: InternalDealNumber=${internalDealNumber || '(empty)'}, RecurringId=${recurringIdRaw || '(empty)'}, AccountId=${accountIdRaw || '(empty)'}, Token=${tokenRaw || '(empty)'}, LowProfileCode=${lowProfileCode || '(empty)'}`
  );
  const parent = await findDealForRecurringEvent({
    transactionId: internalDealNumber,
    lowProfileCode,
    cardcomRecurringId: recurringIdRaw,
    cardcomAccountId: accountIdRaw,
    cardcomToken: tokenRaw,
  });
  if (!parent) {
    console.log(`DetailRecurring: Parent deal not found for RecurringId: ${recurringIdRaw || '(empty)'}`);
    return { ok: false, error: 'parent_deal_not_found', rowId };
  }
  console.log(`DetailRecurring: Parent deal FOUND: ${parent.id}`);

  const statusRaw = normalized.Status ?? normalized.status;
  const statusCode = mapDetailRecurringStatusCode(statusRaw);
  const sum = parseDetailNumber(normalized, ['Sum', 'sum'], 0);
  const sumNoVat = parseDetailNumber(normalized, ['SumNoVat', 'sumNoVat'], 0);

  const lastBillRaw = pickDrField(normalized, ['LastBillDate', 'lastBillDate']);
  const lastBillDt = parseFlexibleDate(lastBillRaw) || new Date();
  const billingMonth = `${lastBillDt.getFullYear()}-${String(lastBillDt.getMonth() + 1).padStart(2, '0')}`;

  let vendorCost = 0;
  let agentCommission = 0;
  let netProfit = 0;

  if (statusCode === 1 && sum > 0) {
    try {
      const { resolveEconomicsForBillingPayment } = await import('./adminMongooseService.js');
      const econ = await resolveEconomicsForBillingPayment(parent.formState || {}, sum);
      vendorCost = Number(econ.resolvedVendorCost ?? 0);
      agentCommission = Number(econ.resolvedAgentCommission ?? 0);
      netProfit = Number(econ.resolvedNetProfit ?? 0);

      const aidRaw = parent.agentId || parent.formState?.agentId;
      if (aidRaw && ObjectId.isValid(String(aidRaw))) {
        const dbA = await getDb();
        const agentDoc = await dbA.collection('sales_agents').findOne(
          { _id: new ObjectId(String(aidRaw)) },
          { projection: { deactivatedAt: 1 } }
        );
        const deactivatedAt = agentDoc?.deactivatedAt ? new Date(agentDoc.deactivatedAt) : null;
        if (deactivatedAt && !Number.isNaN(deactivatedAt.getTime()) && lastBillDt > deactivatedAt) {
          agentCommission = 0;
          netProfit = sum - vendorCost;
        }
      }
    } catch (econErr) {
      console.error(`[DetailRecurring] Economics resolution failed for rowId=${rowId}:`, econErr?.message || econErr);
    }
  }

  const statusLabel = DETAIL_RECURRING_STATUS_LABELS[statusCode] || 'OTHER';

  const event = {
    rowId,
    recordType: 'DetailRecurring',
    statusCode,
    statusLabel,
    statusRaw: String(statusRaw ?? ''),
    accountId: pickDrField(normalized, ['AccountId', 'accountId']),
    recurringId: pickDrField(normalized, ['RecurringId', 'recurringId']),
    terminalNumber: pickDrField(normalized, ['TerminalNumber', 'terminalNumber']),
    createDate: pickDrField(normalized, ['CreateDate', 'createDate']),
    invoiceDescription: pickDrField(normalized, ['InvoiceDescription', 'invoiceDescription']),
    lastBillDate: lastBillRaw,
    lastBillDateIso: lastBillDt.toISOString(),
    billingMonth,
    originalNextDateToBill: pickDrField(normalized, ['OriginalNextDateToBill', 'originalNextDateToBill']),
    finalDebitCoinId: pickDrField(normalized, ['FinalDebitCoinId', 'finalDebitCoinId']),
    departmentId: pickDrField(normalized, ['DepartmentId', 'departmentId']),
    isInvoiceCreate:
      normalized.IsInvoiceCreate === true ||
      normalized.IsInvoiceCreate === 'true' ||
      String(normalized.IsInvoiceCreate || '').toLowerCase() === 'true',
    userId: pickDrField(normalized, ['UserId', 'userId']),
    paymentNum: pickDrField(normalized, ['PaymentNum', 'paymentNum']),
    isReNewOrder:
      normalized.IsReNewOrder === true ||
      normalized.IsReNewOrder === 'true' ||
      String(normalized.IsReNewOrder || '').toLowerCase() === 'true',
    productIdField: pickDrField(normalized, ['ProductId', 'productId']),
    documentType: pickDrField(normalized, ['DocumentType', 'documentType']),
    documentNumber: pickDrField(normalized, ['DocumentNumber', 'documentNumber']),
    quantity: parseDetailNumber(normalized, ['Quantity', 'quantity'], 0),
    isIncludesVAT:
      normalized.IsIncludesVAT === true ||
      normalized.IsIncludesVAT === 'true' ||
      String(normalized.IsIncludesVAT || '').toLowerCase() === 'true',
    vat: parseDetailNumber(normalized, ['VAT', 'vat'], 0),
    sum,
    sumNoVat,
    internalDealNumber: pickDrField(normalized, ['InternalDealNumber', 'internalDealNumber']),
    responseCode: pickDrField(normalized, ['ResposeCode', 'ResponseCode', 'responseCode']),
    processID: pickDrField(normalized, ['ProcessID', 'processID', 'processId']),
    billingAttempts: pickDrField(normalized, ['BillingAttempts', 'billingAttempts']),
    actualBillingType: pickDrField(normalized, ['ActualBillingType', 'actualBillingType']),
    returnValue: pickDrField(normalized, ['ReturnValue', 'returnValue']),
    uid: pickDrField(normalized, ['UID', 'Uid', 'uid']),
    vendorCost,
    agentCommission,
    netProfit,
    receivedAt: new Date(),
  };

  const db = await getDb();
  const deals = db.collection('deals');
  const oid = new ObjectId(parent.id);
  const existing = await deals.findOne({ _id: oid }, { projection: { detailRecurringEvents: 1, cardcomRecurringId: 1 } });
  const arr = Array.isArray(existing?.detailRecurringEvents) ? existing.detailRecurringEvents : [];
  const idx = arr.findIndex((e) => String(e.rowId) === String(rowId));

  const recurringIdForDeal = event.recurringId || recurringIdRaw || '';
  const setFields = { updatedAt: new Date() };
  if (recurringIdForDeal && !existing?.cardcomRecurringId) {
    setFields.cardcomRecurringId = recurringIdForDeal;
  }

  if (idx >= 0) {
    await deals.updateOne({ _id: oid }, { $set: { [`detailRecurringEvents.${idx}`]: event, ...setFields } });
  } else {
    await deals.updateOne({ _id: oid }, { $push: { detailRecurringEvents: event }, $set: setFields });
  }
  console.log(`[DetailRecurring] Event written to deal ${parent.id}: rowId=${rowId}, statusCode=${statusCode}, sum=${sum}`);

  try {
    await db.collection('agent_commission_ledger').createIndex({ rowId: 1 }, { unique: true });
  } catch {
    /* index may exist */
  }

  const aidStr = String(parent.agentId || parent.formState?.agentId || '').trim();
  const existingLed = await db.collection('agent_commission_ledger').findOne({ rowId }, { projection: { locked: 1 } });

  if (statusCode === 1 && sum > 0 && aidStr) {
    const ledgerUpdateFields = {
      agentId: aidStr,
      dealId: parent.id,
      transactionId: parent.transactionId,
      recurringId: event.recurringId,
      accountId: event.accountId,
      statusCode,
      lastBillDate: lastBillDt,
      billingMonth,
      actualAmount: sum,
      sumNoVat,
      vendorCost,
      agentCommission,
      netProfit,
      locked: false,
      snapshotId: null,
      updatedAt: new Date(),
      source: 'detail_recurring',
    };
    if (existingLed?.locked === true) {
      await db.collection('agent_commission_ledger').updateOne(
        { rowId },
        { $set: { actualAmount: sum, sumNoVat, vendorCost, agentCommission, netProfit, statusCode, lastBillDate: lastBillDt, billingMonth, updatedAt: new Date() } }
      );
    } else {
      await db.collection('agent_commission_ledger').updateOne(
        { rowId },
        { $set: ledgerUpdateFields, $setOnInsert: { rowId, createdAt: new Date() } },
        { upsert: true }
      );
    }
  } else if (statusCode !== 1 && existingLed && existingLed.locked !== true) {
    // חיוב נכשל/התבטל — מסמנים את העמלה כמבוטלת למניעת עמלות רפאים
    await db.collection('agent_commission_ledger').updateOne(
      { rowId },
      { $set: { statusCode, agentCommission: 0, netProfit: 0, updatedAt: new Date(), reversedAt: new Date() } }
    );
  }

  return { ok: true, dealId: parent.id, rowId, statusCode };
}

/** סיכום כספי Cash-Based בטווח תאריכים: חיוב ראשון + אירועי DetailRecurring */
async function getCashFinancialTotalsForDateRange(from, to) {
  if (!(from instanceof Date) || !(to instanceof Date)) {
    return {
      totalRevenue: 0,
      totalVendorCost: 0,
      totalAgentCommission: 0,
      totalNetProfit: 0,
      eventCount: 0,
      initialDealCount: 0,
      recurringEventCount: 0,
    };
  }
  const db = await getDb();
  const deals = db.collection('deals');

  const initialAgg = await deals
    .aggregate([
      {
        $match: {
          isRecurringCycle: { $ne: true },
          createdAt: { $gte: from, $lte: to },
          paymentStatus: { $regex: /success|paid|test_success|completed/i },
          subscriptionStatus: { $not: /cancel|בוטל/i },
        },
      },
      {
        $group: {
          _id: null,
          eventCount: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$payerAmount', 0] } },
          totalVendorCost: { $sum: { $ifNull: ['$formState.resolvedVendorCost', 0] } },
          totalAgentCommission: { $sum: { $ifNull: ['$formState.resolvedAgentCommission', 0] } },
          totalNetProfit: { $sum: { $ifNull: ['$formState.resolvedNetProfit', 0] } },
        },
      },
    ])
    .toArray();

  const recurringAgg = await deals
    .aggregate([
      { $match: { detailRecurringEvents: { $exists: true, $ne: [] } } },
      { $unwind: '$detailRecurringEvents' },
      { $match: { 'detailRecurringEvents.statusCode': 1 } },
      {
        $addFields: {
          _drDate: {
            $convert: {
              input: {
                $ifNull: [
                  '$detailRecurringEvents.lastBillDateIso',
                  { $ifNull: ['$detailRecurringEvents.lastBillDate', null] },
                ],
              },
              to: 'date',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { _drDate: { $ne: null, $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          eventCount: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$detailRecurringEvents.sum', 0] } },
          totalVendorCost: { $sum: { $ifNull: ['$detailRecurringEvents.vendorCost', 0] } },
          totalAgentCommission: { $sum: { $ifNull: ['$detailRecurringEvents.agentCommission', 0] } },
          totalNetProfit: { $sum: { $ifNull: ['$detailRecurringEvents.netProfit', 0] } },
        },
      },
    ])
    .toArray();

  const i = initialAgg[0] || {};
  const r = recurringAgg[0] || {};
  return {
    totalRevenue: Number(i.totalRevenue || 0) + Number(r.totalRevenue || 0),
    totalVendorCost: Number(i.totalVendorCost || 0) + Number(r.totalVendorCost || 0),
    totalAgentCommission: Number(i.totalAgentCommission || 0) + Number(r.totalAgentCommission || 0),
    totalNetProfit: Number(i.totalNetProfit || 0) + Number(r.totalNetProfit || 0),
    eventCount: Number(i.eventCount || 0) + Number(r.eventCount || 0),
    initialDealCount: Number(i.eventCount || 0),
    recurringEventCount: Number(r.eventCount || 0),
  };
}

/** סיכום כספי לפי חודש נבחר — Cash-Based בלבד */
export async function getCashFinancialTotalsForMonth(monthStr) {
  const month = String(monthStr || '').trim();
  const range = parseMonthToRange(month);
  if (!range) {
    return {
      month,
      eventCount: 0,
      initialDealCount: 0,
      recurringEventCount: 0,
      totalRevenue: 0,
      totalVendorCost: 0,
      totalAgentCommission: 0,
      totalNetProfit: 0,
    };
  }
  const totals = await getCashFinancialTotalsForDateRange(range.start, range.end);
  return { month, ...totals };
}

function uniqDealDocs(docs) {
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    if (!d || d._id == null) continue;
    const id = String(d._id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

/** מיזוג אירועי DetailRecurring מכמה מסמכי deals (אותו לקוח / recurring), לפי rowId — האחרון מנצח */
function mergeDetailRecurringEventsFromDocs(dealDocs) {
  const byRow = new Map();
  for (const d of dealDocs) {
    const arr = Array.isArray(d?.detailRecurringEvents) ? d.detailRecurringEvents : [];
    for (const ev of arr) {
      const rid = String(ev?.rowId ?? '').trim();
      if (!rid) continue;
      const prev = byRow.get(rid);
      const tNew =
        ev?.receivedAt instanceof Date ? ev.receivedAt.getTime() : new Date(ev?.receivedAt || 0).getTime();
      const tOld =
        prev?.receivedAt instanceof Date ? prev.receivedAt.getTime() : new Date(prev?.receivedAt || 0).getTime();
      if (!prev || tNew >= tOld) byRow.set(rid, ev);
    }
  }
  return [...byRow.values()];
}

function pickRecurringIdFromDealDoc(d) {
  if (!d) return '';
  return String(
    d.cardcomRecurringId ||
      d.formState?.cardcomRecurringId ||
      d.indicator?.step2CardcomRecurringId ||
      d.indicator?.cardcomRecurringId ||
      ''
  ).trim();
}

const INITIAL_CHECKOUT_INVOICE_DESC = 'חיוב ראשוני - הקמת מנוי';

/** שורת חיוב ראשון — מנורמל לצורת DetailRecurring לטבלה אחידה ב-UI */
function normalizeInitialDealPaymentAsDetailRow(mainDeal) {
  if (!mainDeal || !mainDeal._id) return null;
  const createdRaw =
    mainDeal.createdAt instanceof Date ? mainDeal.createdAt : new Date(mainDeal.createdAt || 0);
  if (Number.isNaN(createdRaw.getTime())) return null;
  const payStatus = String(mainDeal.paymentStatus || '').trim();
  const success = /success|paid|test_success|completed/i.test(payStatus);
  const statusCode = success ? 1 : 7;
  const sum = Number(mainDeal.payerAmount ?? 0);
  const billingMonth = formatBillingMonthFromDate(createdRaw);
  return {
    source: 'initial_checkout',
    id: `initial-checkout-${String(mainDeal._id)}`,
    rowId: `INITIAL_CHECKOUT_${String(mainDeal._id)}`,
    statusCode,
    statusLabel: DETAIL_RECURRING_STATUS_LABELS[statusCode] || 'OTHER',
    sum,
    sumNoVat: sum,
    lastBillDate: createdRaw.toISOString(),
    billingMonth,
    status: success ? 'הצלחה' : 'אחר',
    paymentStatus: success ? 'paid' : payStatus || String(statusCode),
    errorReason: '—',
    createdAt: createdRaw.toISOString(),
    invoiceDescription: INITIAL_CHECKOUT_INVOICE_DESC,
    isRecurringCycle: false,
  };
}

export async function getSubscriberBillingHistoryByDealId(dealId, limit = 120) {
  const db = await getDb();
  if (!ObjectId.isValid(String(dealId || ''))) return { cardcomRecurringId: '', rows: [] };
  const deals = db.collection('deals');
  const seed = await deals.findOne({ _id: new ObjectId(String(dealId)) });
  if (!seed) return { cardcomRecurringId: '', rows: [] };

  const mainDealIdStr =
    seed.isRecurringCycle === true && seed.parentDealId != null && String(seed.parentDealId).trim() !== ''
      ? String(seed.parentDealId).trim()
      : String(seed._id);

  let mainDeal = seed;
  if (String(seed._id) !== mainDealIdStr && ObjectId.isValid(mainDealIdStr)) {
    const m = await deals.findOne({ _id: new ObjectId(mainDealIdStr) });
    if (m) mainDeal = m;
  }

  // Fallback resolver for legacy imports where recurring id is not copied to top-level.
  const resolvedParent = await findDealForRecurringEvent({
    transactionId: String(seed.transactionId || '').trim(),
    lowProfileCode: String(seed.lowProfileCode || '').trim(),
    cardcomRecurringId: String(
      seed.cardcomRecurringId ||
        seed.formState?.cardcomRecurringId ||
        seed.indicator?.step2CardcomRecurringId ||
        seed.indicator?.cardcomRecurringId ||
        ''
    ).trim(),
    cardcomAccountId: String(seed.cardcomAccountId || seed.indicator?.step2CardcomAccountId || '').trim(),
    cardcomToken: String(seed.cardcomToken || seed.indicator?.cardcomToken || '').trim(),
  });
  if (resolvedParent?.id && ObjectId.isValid(String(resolvedParent.id))) {
    const resolvedMain = await deals.findOne({ _id: new ObjectId(String(resolvedParent.id)) });
    if (resolvedMain) mainDeal = resolvedMain;
  }

  const recurringId = String(
    mainDeal.cardcomRecurringId ||
      mainDeal.formState?.cardcomRecurringId ||
      mainDeal.indicator?.step2CardcomRecurringId ||
      mainDeal.indicator?.cardcomRecurringId ||
      ''
  ).trim();
  const recurringIdValues = [];
  if (recurringId) {
    recurringIdValues.push(recurringId);
    const asNum = Number(recurringId);
    if (Number.isFinite(asNum) && !Number.isNaN(asNum) && String(asNum) === recurringId) {
      recurringIdValues.push(asNum);
    }
  }
  const filterOr = [];
  if (recurringIdValues.length) {
    filterOr.push({ cardcomRecurringId: { $in: recurringIdValues } });
  }
  if (mainDealIdStr && ObjectId.isValid(mainDealIdStr)) {
    filterOr.push({ _id: new ObjectId(mainDealIdStr) });
  } else {
    filterOr.push({ _id: seed._id });
  }
  const lim = Math.max(1, Math.min(Number(limit) || 500, 500));
  /** מיון עולה — עסקת הרישום (הישנה ביותר) ראשונה */
  const docs = await deals
    .find({ $or: filterOr })
    .sort({ createdAt: 1 })
    .limit(lim)
    .toArray();
  const tid = String(seed.transactionId || '').trim();
  let txDeals = [];
  if (tid) {
    const asNum = Number(tid);
    const txQuery =
      Number.isFinite(asNum) && !Number.isNaN(asNum) && String(asNum) === tid
        ? { $or: [{ transactionId: tid }, { transactionId: asNum }] }
        : { transactionId: tid };
    txDeals = await deals.find(txQuery).limit(100).toArray();
  }
  const allDealDocs = uniqDealDocs([mainDeal, ...docs, ...txDeals]);
  const detailEvents = mergeDetailRecurringEventsFromDocs(allDealDocs);
  let displayRecurringId = recurringId;
  if (!displayRecurringId) {
    for (const d of allDealDocs) {
      const r = pickRecurringIdFromDealDoc(d);
      if (r) {
        displayRecurringId = r;
        break;
      }
    }
  }
  const detailRows = detailEvents
    .slice()
    .sort((a, b) => {
      const da = parseFlexibleDate(a.lastBillDate || a.lastBillDateIso) || new Date(0);
      const db = parseFlexibleDate(b.lastBillDate || b.lastBillDateIso) || new Date(0);
      return db.getTime() - da.getTime();
    })
    .map((ev) => ({
      source: 'detail_recurring',
      id: String(ev.rowId || ''),
      rowId: String(ev.rowId || ''),
      statusCode: ev.statusCode,
      statusLabel: ev.statusLabel || DETAIL_RECURRING_STATUS_LABELS[ev.statusCode] || '—',
      sum: Number(ev.sum ?? 0),
      sumNoVat: Number(ev.sumNoVat ?? 0),
      lastBillDate: ev.lastBillDateIso || ev.lastBillDate || null,
      billingMonth: ev.billingMonth || '',
      status: Number(ev.statusCode) === 1 ? 'הצלחה' : 'אחר',
      paymentStatus: Number(ev.statusCode) === 1 ? 'paid' : String(ev.statusCode ?? ''),
      errorReason: '—',
      createdAt: ev.receivedAt instanceof Date ? ev.receivedAt.toISOString() : ev.receivedAt,
      invoiceDescription: String(ev.invoiceDescription || '').trim() || null,
      isRecurringCycle: false,
    }));
  /** רק מסמכי מחזור ישנים (ילדי recurring) — לא עסקת האב (חיוב ראשון מכוסה ב-INITIAL_CHECKOUT) */
  const initialCheckoutRow = normalizeInitialDealPaymentAsDetailRow(mainDeal);
  const cycleRowsRaw = docs
    .filter((d) => d.isRecurringCycle === true)
    .map((d) => {
      const month =
        String(d.billingMonth || '').trim() ||
        formatBillingMonthFromDate(d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt));
      const success = /success|paid|test_success|completed/i.test(String(d.paymentStatus || ''));
      const errorReason = String(d?.indicator?.responsdescription || d?.formState?.cardcomResponseDescription || '').trim();
      const statusCode = success ? 1 : 7;
      return {
        source: 'legacy_cycle_deal',
        id: String(d._id),
        rowId: `LEGACY_CYCLE_${String(d._id)}`,
        statusCode,
        statusLabel: DETAIL_RECURRING_STATUS_LABELS[statusCode] || 'OTHER',
        billingMonth: month,
        sum: Number(d.payerAmount ?? 0),
        sumNoVat: Number(d.payerAmount ?? 0),
        lastBillDate: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        status: success ? 'הצלחה' : 'כישלון',
        paymentStatus: String(d.paymentStatus || ''),
        errorReason: errorReason || (success ? '—' : String(d.paymentStatus || '—')),
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        invoiceDescription: null,
        isRecurringCycle: true,
      };
    });
  /** אל תכפול חיוב ראשון: אם יש INITIAL_CHECKOUT לאותו יום וסכום — לא LEGACY_CYCLE */
  const cycleRows =
    initialCheckoutRow == null
      ? cycleRowsRaw
      : cycleRowsRaw.filter((row) => {
          const a = new Date(row.lastBillDate || 0).toISOString().slice(0, 10);
          const b = new Date(initialCheckoutRow.lastBillDate || 0).toISOString().slice(0, 10);
          const sameDay = a === b;
          const sameAmount = Number(row.sum) === Number(initialCheckoutRow.sum);
          return !(sameDay && sameAmount);
        });
  const unifiedRows = [...(initialCheckoutRow ? [initialCheckoutRow] : []), ...detailRows, ...cycleRows];
  unifiedRows.sort((a, b) => {
    const ta = new Date(a.lastBillDate || a.createdAt || 0).getTime();
    const tb = new Date(b.lastBillDate || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return {
    cardcomRecurringId: displayRecurringId,
    detailRecurringRows: detailRows,
    legacyCycleRows: cycleRows,
    initialCheckoutRow,
    rows: unifiedRows,
  };
}

/** מיזוג מזהי recurring מ־Cardcom לעסקה קיימת (למשל duplicate webhook או עדכון מאוחר) */
export async function mergeDealCardcomRecurringIds(transactionId, params = {}) {
  const db = await getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) return { ok: false };

  const set = { updatedAt: new Date() };
  if (params.cardcomAccountId != null && String(params.cardcomAccountId).trim() !== '') {
    set.cardcomAccountId = String(params.cardcomAccountId).trim();
  }
  if (params.cardcomRecurringId != null && String(params.cardcomRecurringId).trim() !== '') {
    set.cardcomRecurringId = String(params.cardcomRecurringId).trim();
  }
  if (params.cardcomToken != null && String(params.cardcomToken).trim() !== '') {
    set.cardcomToken = String(params.cardcomToken).trim();
  }
  if (Object.keys(set).length <= 1) return { ok: true, skipped: true };

  await db.collection('deals').updateOne({ transactionId: tid }, { $set: set });
  return { ok: true };
}

/** מיזוג מזהי recurring לעסקה לפי LowProfileCode */
export async function mergeDealCardcomRecurringIdsByLowProfileCode(lowProfileCode, params = {}) {
  const db = await getDb();
  const code = String(lowProfileCode || '').trim();
  if (!code) return { ok: false };

  const set = { updatedAt: new Date() };
  if (params.cardcomAccountId != null && String(params.cardcomAccountId).trim() !== '') {
    set.cardcomAccountId = String(params.cardcomAccountId).trim();
  }
  if (params.cardcomRecurringId != null && String(params.cardcomRecurringId).trim() !== '') {
    set.cardcomRecurringId = String(params.cardcomRecurringId).trim();
  }
  if (params.cardcomToken != null && String(params.cardcomToken).trim() !== '') {
    set.cardcomToken = String(params.cardcomToken).trim();
  }
  if (Object.keys(set).length <= 1) return { ok: true, skipped: true };

  await db.collection('deals').updateOne({ lowProfileCode: code }, { $set: set });
  return { ok: true };
}

export async function getDealEmailSentAt(transactionId) {
  const db = await getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) return null;
  const doc = await db.collection('deals').findOne(
    { transactionId: tid },
    { projection: { emailSentAt: 1 } }
  );
  return doc?.emailSentAt || null;
}

export async function markDealOrderEmailSent(transactionId, { emailTo } = {}) {
  const db = await getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) throw new Error('Missing transactionId');
  const now = new Date();
  await db.collection('deals').updateOne(
    { transactionId: tid },
    {
      $set: {
        emailSentAt: now,
        emailTo: emailTo || '',
      },
    }
  );
  return { ok: true };
}

/** חיפוש עסקה לפי LowProfileCode (אחרי תשלום — מחזיר transactionId מהמסד) */
export async function findDealByLowProfileCode(lowProfileCode) {
  const db = await getDb();
  const code = String(lowProfileCode || '').trim();
  if (!code) return null;
  const doc = await db.collection('deals').findOne(
    { lowProfileCode: code },
    { projection: { transactionId: 1, paymentStatus: 1, createdAt: 1 } }
  );
  if (!doc) return null;
  return {
    transactionId: doc.transactionId != null ? String(doc.transactionId) : '',
    paymentStatus: doc.paymentStatus || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
  };
}

export async function getDealByTransactionId(transactionId) {
  const db = await getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) return null;
  const doc = await db.collection('deals').findOne({ transactionId: tid });
  if (!doc) return null;
  return {
    id: String(doc._id),
    transactionId: String(doc.transactionId || ''),
    payerAmount: Number(doc.payerAmount || 0),
    formState: doc.formState && typeof doc.formState === 'object' ? doc.formState : {},
    beneficiaryUpdate: doc.beneficiaryUpdate && typeof doc.beneficiaryUpdate === 'object' ? doc.beneficiaryUpdate : null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

/** הקשר לטופס מוטבים (כולל פרטי מבוטח ראשי מהתשלום לעריכה מראש) */
export async function getPublicDealContext(transactionId) {
  const db = await getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) return null;
  const doc = await db.collection('deals').findOne(
    { transactionId: tid },
    { projection: { transactionId: 1, formState: 1, beneficiaryUpdate: 1 } }
  );
  if (!doc) return null;
  const fs = doc.formState && typeof doc.formState === 'object' ? doc.formState : {};
  const formBeneficiaries = Array.isArray(fs.beneficiaries) ? fs.beneficiaries : [];
  const submittedBeneficiaries = Array.isArray(doc?.beneficiaryUpdate?.additionalMembers)
    ? doc.beneficiaryUpdate.additionalMembers
    : [];
  const primary = doc?.beneficiaryUpdate?.primaryMember && typeof doc.beneficiaryUpdate.primaryMember === 'object'
    ? doc.beneficiaryUpdate.primaryMember
    : {};
  const primaryFilled = !!(
    String(primary.firstName || '').trim() ||
    String(primary.lastName || '').trim() ||
    String(primary.id || '').trim()
  );
  const hasBeneficiaries =
    formBeneficiaries.length > 0 ||
    submittedBeneficiaries.length > 0 ||
    primaryFilled ||
    !!doc?.beneficiaryUpdate?.submittedAt;
  const n = Math.max(0, Math.min(5, Number(fs.beneficiaryCount) || 0));
  return {
    transactionId: String(doc.transactionId),
    organizationName: String(fs.organizationName || '').trim(),
    agentName: String(fs.agentName || '').trim(),
    beneficiaryCount: n,
    fullName: String(fs.fullName || '').trim(),
    phone: String(fs.phone || '').trim(),
    email: String(fs.email || '').trim(),
    hasBeneficiaries,
  };
}

export async function saveBeneficiaryUpdate(params) {
  const db = await getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');

  const deals = db.collection('deals');
  const now = new Date();
  const subscriptionStartDate = now.toISOString().slice(0, 10);
  const primary = params.primaryMember || {};
  const additional = Array.isArray(params.additionalMembers) ? params.additionalMembers : [];
  const normalizedBeneficiaries = additional.map((m) => ({
    firstName: String(m.firstName || '').trim(),
    lastName: String(m.lastName || '').trim(),
    id: String(m.id || '').trim(),
    dateOfBirth: String(m.dateOfBirth || '').trim(),
    relationship: String(m.relation || '').trim(),
    maritalStatus: String(m.maritalStatus || '').trim(),
    healthFund: String(m.healthFund || '').trim(),
    supplementalInsurance: String(m.supplementalInsurance || '').trim(),
    gender: String(m.gender || '').trim(),
  }));
  await deals.updateOne(
    { transactionId },
    {
      $set: {
        transactionId,
        beneficiaryUpdate: {
          transactionId,
          organizationName: params.organizationName || '',
          agentName: params.agentName || '',
          primaryMember: primary,
          additionalMembers: additional,
          submittedAt: now,
        },
        'formState.fullName': [String(primary.firstName || '').trim(), String(primary.lastName || '').trim()].filter(Boolean).join(' '),
        'formState.id': String(primary.id || '').trim(),
        'formState.dateOfBirth': String(primary.dateOfBirth || '').trim(),
        'formState.gender': String(primary.gender || '').trim(),
        'formState.maritalStatus': String(primary.maritalStatus || '').trim(),
        'formState.healthFund': String(primary.healthFund || '').trim(),
        'formState.supplementalInsurance': String(primary.supplementalInsurance || '').trim(),
        'formState.phone': String(primary.phone || '').trim(),
        'formState.email': String(primary.email || '').trim(),
        'formState.address': String(primary.address || '').trim(),
        'formState.beneficiaries': normalizedBeneficiaries,
        'formState.beneficiaryCount': normalizedBeneficiaries.length,
        'formState.subscriptionStartDate': subscriptionStartDate,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  return { id: transactionId };
}

export async function saveContactLead(params) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection('contactLeads').insertOne({
    name: params.name || '',
    email: params.email || '',
    phone: params.phone || '',
    message: params.message || '',
    source: params.source || 'site',
    isActive: true,
    isHandled: false,
    landingSlug: params.landingSlug || '',
    category: params.category || '',
    leadStatus: params.leadStatus || 'חדש',
    adminNotes: params.adminNotes || '',
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId) };
}

export async function saveOrUpdateAbandonedCheckoutLead(params) {
  const db = await getDb();
  const now = new Date();
  const phone = String(params.phone || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  const landingSlug = String(params.landingSlug || '').trim().toLowerCase();
  if (!phone && !email) return { id: null, skipped: true };

  const key = { source: 'abandoned_checkout', phone, email, landingSlug };
  const existing = await db.collection('contactLeads').findOne(key, { projection: { _id: 1 } });
  if (existing) {
    await db.collection('contactLeads').updateOne(
      { _id: existing._id },
      {
        $set: {
          name: params.name || '',
          message: params.message || '',
          category: 'לא המשיכו לתשלום',
          updatedAt: now,
        },
      }
    );
    return { id: String(existing._id), updated: true };
  }

  const result = await db.collection('contactLeads').insertOne({
    name: params.name || '',
    email,
    phone,
    message: params.message || '',
    source: 'abandoned_checkout',
    landingSlug,
    category: 'לא המשיכו לתשלום',
    leadStatus: 'חדש',
    adminNotes: '',
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId), created: true };
}

export async function clearAbandonedCheckoutLeadsByContact(params) {
  const db = await getDb();
  const phone = String(params.phone || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  const landingSlug = String(params.landingSlug || '').trim().toLowerCase();
  const landingSlugAlt = String(params.landingSlugAlt || '').trim().toLowerCase();
  if (!phone && !email) return { deleted: 0 };
  const slugMatch = [landingSlug, landingSlugAlt].filter(Boolean);
  const filter =
    slugMatch.length > 0
      ? {
          source: 'abandoned_checkout',
          phone,
          email,
          landingSlug: { $in: slugMatch },
        }
      : {
          source: 'abandoned_checkout',
          phone,
          email,
          landingSlug,
        };
  const r = await db.collection('contactLeads').deleteMany(filter);
  return { deleted: Number(r.deletedCount || 0) };
}

/** נוצר לפני מעבר לדף תשלום Cardcom; מקושר לעסקה אחרי תשלום מוצלח */
export async function upsertPendingCheckoutLead(params = {}) {
  const db = await getDb();
  const lowProfileCode = String(params.lowProfileCode || '').trim();
  if (!lowProfileCode) return { skipped: true };
  const existing = await db
    .collection('pending_checkout_leads')
    .findOne({ lowProfileCode }, { projection: { status: 1 } });
  if (existing?.status === 'converted') return { skipped: true };
  const now = new Date();
  const set = {
    lowProfileCode,
    name: String(params.name || '').trim(),
    email: String(params.email || '').trim().toLowerCase(),
    phone: String(params.phone || '').trim(),
    productName: String(params.productName || '').trim(),
    landingSlug: String(params.landingSlug || '').trim().toLowerCase(),
    priceListId: String(params.priceListId || '').trim(),
    status: 'awaiting_payment',
    isHandled: false,
    updatedAt: now,
  };
  await db.collection('pending_checkout_leads').updateOne(
    { lowProfileCode },
    { $set: set, $setOnInsert: { createdAt: now, dealId: null, convertedAt: null } },
    { upsert: true }
  );
  return { ok: true };
}

export async function markPendingCheckoutLeadConverted(lowProfileCode, dealId) {
  const db = await getDb();
  const code = String(lowProfileCode || '').trim();
  if (!code) return { matched: false };
  const now = new Date();
  const tid = String(dealId || '').trim();
  const r = await db.collection('pending_checkout_leads').updateOne(
    { lowProfileCode: code },
    {
      $set: {
        status: 'converted',
        dealId: tid || null,
        convertedAt: now,
        updatedAt: now,
      },
    }
  );
  return { matched: r.matchedCount > 0 };
}

export async function listAwaitingPaymentCheckoutLeads(limit = 100) {
  const db = await getDb();
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const docs = await db
    .collection('pending_checkout_leads')
    .find({ status: 'awaiting_payment', isActive: { $ne: false } })
    .sort({ updatedAt: -1 })
    .limit(lim)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    lowProfileCode: d.lowProfileCode || '',
    name: d.name || '',
    email: d.email || '',
    phone: d.phone || '',
    productName: d.productName || '',
    landingSlug: d.landingSlug || '',
    priceListId: d.priceListId || '',
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  }));
}

export async function saveOrganizationLead(params) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection('organizationLeads').insertOne({
    organizationName: params.organizationName || '',
    contactName: params.contactName || '',
    phone: params.phone || '',
    email: params.email || '',
    message: params.message || params.notes || '',
    source: params.source || 'site',
    isActive: true,
    isHandled: false,
    requestType: params.requestType || '',
    company: params.company || null,
    contactPerson: params.contactPerson || null,
    accounting: params.accounting || null,
    additionalContact: params.additionalContact || null,
    billingMethod: params.billingMethod || '',
    generalData: params.generalData || null,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId) };
}

export async function createOrganizationCompany(params) {
  const db = await getDb();
  const now = new Date();
  const billingMethod = String(params.billingMethod || '').trim();
  const billingType =
    params.billingType === 'Centralized' || params.billingType === 'Private'
      ? params.billingType
      : mapBillingMethodToBillingType(billingMethod);
  const priceListIdRaw = String(params.priceListId || '').trim();
  const priceListId = ObjectId.isValid(priceListIdRaw) ? priceListIdRaw : null;
  const customPricing = Array.isArray(params.customPricing)
    ? params.customPricing
        .map((x) => ({
          productId: String(x?.productId || '').trim(),
          memberPrice: Math.max(0, Number(x?.memberPrice || 0)),
        }))
        .filter((x) => ObjectId.isValid(x.productId))
    : [];
  const result = await db.collection('organizations').insertOne({
    companyName: params.companyName || '',
    companyId: params.companyId || '',
    officialAddress: params.officialAddress || '',
    companyEmail: params.companyEmail || '',
    fieldOfActivity: params.fieldOfActivity || '',
    employeesCount: Number(params.employeesCount || 0),
    subscriptionProductName: String(params.subscriptionProductName || '').trim(),
    billingMethod: billingMethod,
    billingType,
    monthlyPricePerMember: Number(params.monthlyPricePerMember || 0),
    contactEmail: String(params.contactEmail || params.companyEmail || '').trim(),
    contactPhone: String(params.contactPhone || '').trim(),
    notes: String(params.notes || '').trim(),
    contactPerson: params.contactPerson || null,
    accounting: params.accounting || null,
    additionalContact: params.additionalContact || null,
    priceListId,
    customPricing,
    source: params.source || 'admin',
    status: params.status || 'active',
    employeeApprovalEmail: String(params.employeeApprovalEmail || '').trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId) };
}

export async function getOrganizationCompanies(limit = 300, options = {}) {
  const db = await getDb();
  const activeOnly = options.activeOnly !== false;
  const docs = await db
    .collection('organizations')
    .find(activeOnly ? { isActive: { $ne: false } } : {})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => serializeOrgDoc(d));
}

export async function getOrganizationCompaniesWithMemberCounts(limit = 400, options = {}) {
  const db = await getDb();
  const activeOnly = options.activeOnly !== false;
  const orgs = await db
    .collection('organizations')
    .find(activeOnly ? { isActive: { $ne: false } } : {})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  if (!orgs.length) return [];
  const ids = orgs.map((o) => String(o._id));
  const agg = await db
    .collection('deals')
    .aggregate([
      {
        $match: {
          organizationId: { $in: ids },
          paymentStatus: { $regex: /success|paid|test_success/i },
          subscriptionStatus: { $ne: 'Cancelled' },
        },
      },
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
    ])
    .toArray();
  const map = Object.fromEntries(agg.map((a) => [a._id, a.count]));
  return orgs.map((d) => serializeOrgDoc(d, map[String(d._id)] || 0));
}

export async function getOrganizationCompanyById(id) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    return null;
  }
  const doc = await db.collection('organizations').findOne({ _id: oid });
  if (!doc) return null;
  return serializeOrgDoc(doc);
}

export async function getPublicOrganizationForRegistration(orgId) {
  const o = await getOrganizationCompanyById(orgId);
  if (!o || o.isActive === false || String(o.status || 'active').toLowerCase() !== 'active') return null;
  return {
    id: o.id,
    name: o.companyName || o.name || '',
    billingType: o.billingType,
    monthlyPricePerMember: o.monthlyPricePerMember,
    subscriptionProductName: o.subscriptionProductName || '',
    employeeApprovalEmail: o.employeeApprovalEmail || '',
  };
}

export async function updateOrganizationCompany(id, params) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ארגון לא תקין');
  }
  const set = {
    updatedAt: new Date(),
  };
  if (params.companyName != null) set.companyName = String(params.companyName || '').trim();
  if (params.companyId != null) set.companyId = String(params.companyId || '').trim();
  if (params.officialAddress != null) set.officialAddress = String(params.officialAddress || '').trim();
  if (params.companyEmail != null) set.companyEmail = String(params.companyEmail || '').trim();
  if (params.fieldOfActivity != null) set.fieldOfActivity = String(params.fieldOfActivity || '').trim();
  if (params.employeesCount != null) set.employeesCount = Number(params.employeesCount || 0);
  if (params.billingMethod != null) set.billingMethod = String(params.billingMethod || '').trim();
  if (params.billingType === 'Centralized' || params.billingType === 'Private') set.billingType = params.billingType;
  if (params.monthlyPricePerMember != null) set.monthlyPricePerMember = Number(params.monthlyPricePerMember || 0);
  if (params.subscriptionProductName != null)
    set.subscriptionProductName = String(params.subscriptionProductName || '').trim();
  if (params.status != null) set.status = String(params.status || '').trim();
  if (params.contactEmail != null) set.contactEmail = String(params.contactEmail || '').trim();
  if (params.contactPhone != null) set.contactPhone = String(params.contactPhone || '').trim();
  if (params.notes != null) set.notes = String(params.notes || '').trim();
  if (params.collectionStatus != null) set.collectionStatus = String(params.collectionStatus || 'open').trim();
  if (params.employeeApprovalEmail != null) set.employeeApprovalEmail = String(params.employeeApprovalEmail || '').trim();
  if (params.contactPerson != null) set.contactPerson = params.contactPerson || null;
  if (params.accounting != null) set.accounting = params.accounting || null;
  if (params.additionalContact != null) set.additionalContact = params.additionalContact || null;
  if (params.priceListId != null) {
    const pid = String(params.priceListId || '').trim();
    set.priceListId = pid && ObjectId.isValid(pid) ? pid : null;
  }
  if (params.customPricing != null) {
    set.customPricing = Array.isArray(params.customPricing)
      ? params.customPricing
          .map((x) => ({
            productId: String(x?.productId || '').trim(),
            memberPrice: Math.max(0, Number(x?.memberPrice || 0)),
          }))
          .filter((x) => ObjectId.isValid(x.productId))
      : [];
  }
  const r = await db.collection('organizations').updateOne({ _id: oid }, { $set: set });
  if (!r.matchedCount) throw new Error('ארגון לא נמצא');
  return { ok: true };
}

/** דרישות תשלום (snapshots) שאינן בסטטוס Paid — חוסם ארכיון ארגון */
export async function countOpenBillingSnapshotsForOrganization(orgId) {
  const db = await getDb();
  const oid = String(orgId || '').trim();
  if (!oid) return 0;
  return db.collection('billing_snapshots').countDocuments({
    orgId: oid,
    status: { $ne: 'Paid' },
  });
}

export async function deleteOrganizationCompany(id) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ארגון לא תקין');
  }
  const pending = await countOpenBillingSnapshotsForOrganization(String(id));
  if (pending > 0) {
    throw new Error('לא ניתן להעביר לארכיון ארגון עם דרישות תשלום פתוחות.');
  }
  const r = await db.collection('organizations').updateOne({ _id: oid }, { $set: { isActive: false, updatedAt: new Date() } });
  if (!r.matchedCount) throw new Error('ארגון לא נמצא');
  return { ok: true };
}

function normalizeNationalIdDigits(idRaw) {
  return String(idRaw || '').replace(/\D/g, '');
}

export async function findActiveDealByOrgAndNationalId(organizationId, idRaw) {
  const db = await getDb();
  const oid = String(organizationId || '').trim();
  const norm = normalizeNationalIdDigits(idRaw);
  const raw = String(idRaw || '').trim();
  const variants = [...new Set([raw, norm, norm && norm.length < 9 ? norm.padStart(9, '0') : norm].filter(Boolean))];
  if (!oid || !variants.length) return null;
  return db.collection('deals').findOne({
    organizationId: oid,
    'formState.id': { $in: variants },
    paymentStatus: { $regex: /success|paid|test_success|completed/i },
    subscriptionStatus: { $ne: 'Cancelled' },
  });
}

export async function countActiveMembersByOrganizationId(organizationId) {
  const db = await getDb();
  const oid = String(organizationId || '').trim();
  if (!oid) return 0;
  return db.collection('deals').countDocuments({
    organizationId: oid,
    paymentStatus: { $regex: /success|paid|test_success/i },
    // מוחרגים: מבוטל, ממתין לאישור הארגון (State A), ממתין לאישור ב-workflow
    subscriptionStatus: { $nin: ['Cancelled', 'ממתין לאישור הארגון'] },
    status: { $ne: 'pending_org_approval' },
    isActive: { $ne: false },
  });
}

export async function findDealsByOrganizationId(organizationId, limit = 500) {
  const db = await getDb();
  const oid = String(organizationId || '').trim();
  if (!oid) return [];
  const docs = await db
    .collection('deals')
    .find({ organizationId: oid, isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => {
    const ent = getEntitlementStatus(d);
    const toIso = (v) => {
      if (!v) return null;
      const dt = v instanceof Date ? v : new Date(v);
      return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
    };
    return {
      id: String(d._id),
      transactionId: d.transactionId,
      payerAmount: d.payerAmount,
      paymentStatus: d.paymentStatus,
      subscriptionStatus: d.subscriptionStatus,
      status: d.status,
      isCentralized: isCentralizedOrgPayment(d),
      finalBillingMonth: String(d.finalBillingMonth || '').trim(),
      memberType: d.memberType || 'Primary',
      isOrganizationDeal: !!d.isOrganizationDeal,
      fullName: d.formState?.fullName,
      productName: d.formState?.productName || d.formState?.subscriptionProductName || '',
      idNumber: d.formState?.id,
      email: d.formState?.email,
      phone: d.formState?.phone,
      dateOfBirth: d.formState?.dateOfBirth,
      gender: d.formState?.gender,
      healthFund: d.formState?.healthFund,
      address: d.formState?.address,
      createdAt: toIso(d.createdAt),
      cancellationDate: toIso(d.cancellationDate),
      subscriptionEndDate: toIso(d.subscriptionEndDate) || ent.cancelAt || null,
      subscriptionStartDate: String(d.formState?.subscriptionStartDate || '').trim(),
      entitlementStatus: ent.status,
      lowProfileCode: String(d.lowProfileCode || '').trim(),
      cardcomAccountId: String(d.cardcomAccountId || '').trim(),
      cardcomRecurringId: String(d.cardcomRecurringId || '').trim(),
      cardcomInternalDealNumber: String(d?.indicator?.internalDealNumber || '').trim(),
      cardcomResponseDescription: String(d?.indicator?.responsdescription || d?.formState?.cardcomResponseDescription || '').trim(),
      Lest4Numbers: String(d?.indicator?.Lest4Numbers || d?.formState?.lastFourDigits || '').trim(),
      MutagName: String(d?.indicator?.MutagName || d?.formState?.cardBrand || '').trim(),
      source: d.source,
    };
  });
}

export async function getOrganizationMonthlyPayments(orgId, monthsBack = 12) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(orgId));
  } catch {
    throw new Error('מזהה ארגון לא תקין');
  }
  const org = await db.collection('organizations').findOne({ _id: oid, isActive: { $ne: false } });
  if (!org) throw new Error('ארגון לא נמצא');
  const orgName = String(org.companyName || '').trim();
  const memberPrice = Number(org.monthlyPricePerMember || 0);
  const activeMembers = await countActiveMembersByOrganizationId(String(org._id));
  const lim = Math.max(1, Math.min(Number(monthsBack) || 12, 24));
  const months = [];
  const now = new Date();
  for (let i = lim - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const invoices = await db
    .collection('monthly_invoices')
    .find({ organizationName: orgName, month: { $in: months } })
    .project({ month: 1, status: 1, totalAmount: 1, dealCount: 1 })
    .toArray();
  const byMonth = new Map(invoices.map((x) => [String(x.month), x]));
  return months.map((month) => {
    const inv = byMonth.get(month);
    const totalMembers = Number(inv?.dealCount ?? activeMembers);
    const totalAmount = Number(inv?.totalAmount ?? totalMembers * memberPrice);
    const status = String(inv?.status || 'Pending') === 'Paid' ? 'Paid' : 'Pending';
    return {
      month,
      totalMembers,
      totalAmount,
      status,
    };
  });
}

function normalizeYearMonthLabel(monthInput) {
  const s = String(monthInput || '').trim();
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!y || mo < 1 || mo > 12) return '';
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`;
}

function parseDateAsUtc(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, mo - 1, d));
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function roundCurrency(value) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}

export async function getOrganizationBillingReport(orgId, monthInput = '') {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(orgId));
  } catch {
    throw new Error('מזהה ארגון לא תקין');
  }
  const org = await db.collection('organizations').findOne({ _id: oid, isActive: { $ne: false } });
  if (!org) throw new Error('ארגון לא נמצא');

  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = normalizeYearMonthLabel(monthInput) || fallbackMonth;
  const mm = /^(\d{4})-(\d{2})$/.exec(targetMonth);
  const year = Number(mm[1]);
  const month = Number(mm[2]);
  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStartUtc = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const docs = await db
    .collection('deals')
    .find({ organizationId: String(org._id), isActive: { $ne: false } })
    .project({
      _id: 1,
      payerAmount: 1,
      amount: 1,
      subscriptionStatus: 1,
      paymentStatus: 1,
      status: 1,
      isActive: 1,
      finalBillingMonth: 1,
      formState: 1,
      createdAt: 1,
      beneficiaryUpdate: 1,
      cancellationDate: 1,
      cancelAt: 1,
    })
    .sort({ createdAt: -1 })
    .toArray();

  const rows = [];
  let totalDue = 0;
  let totalProrated = 0;
  let totalFinalMonth = 0;

  for (const d of docs) {
    if (d.isActive === false) continue;
    const fs = d?.formState && typeof d.formState === 'object' ? d.formState : {};
    const workflowStatus = String(d.status || '').trim().toLowerCase();
    if (workflowStatus === 'pending_org_approval') continue;
    if (/ממתין לאישור הארגון/.test(String(d.subscriptionStatus || ''))) continue;

    const statusNorm = String(d.subscriptionStatus || d.paymentStatus || d.status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const finalBillingMonth = normalizeYearMonthLabel(d.finalBillingMonth);

    if (statusNorm === 'pending_org_approval') continue;

    const isPendingCancellation =
      statusNorm === 'pending_cancellation' || statusNorm === 'pendingcancellation';
    const isCancelled =
      statusNorm === 'cancelled' ||
      statusNorm === 'canceled' ||
      statusNorm === 'cancel' ||
      statusNorm === 'cancelled_by_admin';

    if (isPendingCancellation) {
      if (finalBillingMonth !== targetMonth) continue;
    } else if (isCancelled) {
      if (finalBillingMonth && finalBillingMonth < targetMonth) continue;
    }

    const startDateUtc =
      parseDateAsUtc(fs.subscriptionStartDate) ||
      parseDateAsUtc(d.createdAt) ||
      parseDateAsUtc(d?.beneficiaryUpdate?.submittedAt);
    if (!startDateUtc) continue;

    const basePrice = Number(d.amount ?? d.payerAmount ?? fs.amount ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;

    const joinMonthRaw = `${startDateUtc.getUTCFullYear()}-${String(startDateUtc.getUTCMonth() + 1).padStart(2, '0')}`;
    const joinMonth = normalizeYearMonthLabel(joinMonthRaw) || joinMonthRaw;

    let billingType = 'full';
    let activeDays = null;
    let billedAmount = basePrice;
    /** Pending cancel + final month in report month, but joined same month → pro-rata (avoid 100% overriding joiner rule). */
    let sameMonthPendingCancelProrata = false;

    if (isPendingCancellation && finalBillingMonth === targetMonth) {
      if (joinMonth === targetMonth) {
        if (startDateUtc >= monthStartUtc && startDateUtc < nextMonthStartUtc) {
          const dayOfMonth = startDateUtc.getUTCDate();
          activeDays = Math.max(1, daysInMonth - dayOfMonth + 1);
          billedAmount = (activeDays / daysInMonth) * basePrice;
          billingType = 'prorata';
          sameMonthPendingCancelProrata = true;
          totalProrated += 1;
        } else {
          billingType = 'final_month';
          totalFinalMonth += 1;
        }
      } else {
        billingType = 'final_month';
        totalFinalMonth += 1;
      }
    } else if (startDateUtc < monthStartUtc) {
      billingType = 'full';
    } else if (startDateUtc >= monthStartUtc && startDateUtc < nextMonthStartUtc) {
      const dayOfMonth = startDateUtc.getUTCDate();
      activeDays = Math.max(1, daysInMonth - dayOfMonth + 1);
      billedAmount = (activeDays / daysInMonth) * basePrice;
      billingType = 'prorata';
      totalProrated += 1;
    } else {
      continue;
    }

    const billedRounded = roundCurrency(billedAmount);
    totalDue += billedRounded;

    let monthlyStatusPct = 100;
    let monthlyStatusSubtext = 'מלא';
    if (sameMonthPendingCancelProrata && activeDays != null && daysInMonth > 0) {
      monthlyStatusPct = Math.max(1, Math.min(100, Math.round((activeDays / daysInMonth) * 100)));
      monthlyStatusSubtext = `חודש חיוב אחרון — יחסי (${activeDays} ימים)`;
    } else if (billingType === 'prorata' && activeDays != null && daysInMonth > 0) {
      monthlyStatusPct = Math.max(1, Math.min(100, Math.round((activeDays / daysInMonth) * 100)));
      monthlyStatusSubtext = `${activeDays} ימים`;
    } else if (billingType === 'final_month') {
      monthlyStatusPct = 100;
      monthlyStatusSubtext = 'חודש חיוב אחרון';
    }

    const parseDealDate = (v) => {
      if (v == null) return null;
      const dt = v instanceof Date ? v : new Date(v);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };
    let cancellationDt =
      parseDealDate(d.cancellationDate) || parseDealDate(d.cancelAt);
    if (!cancellationDt && finalBillingMonth && (isCancelled || isPendingCancellation)) {
      const fm = /^(\d{4})-(\d{2})$/.exec(finalBillingMonth);
      if (fm) {
        const y = Number(fm[1]);
        const mo = Number(fm[2]);
        if (y && mo >= 1 && mo <= 12) {
          cancellationDt = new Date(Date.UTC(y, mo, 1));
        }
      }
    }
    const cancellationDateStr = cancellationDt ? cancellationDt.toISOString().slice(0, 10) : '';

    const rawId = String(
      fs.id ||
        d?.beneficiaryUpdate?.primaryMember?.id ||
        ''
    ).trim();
    const employeeName = String(
      fs.fullName ||
        `${String(d?.beneficiaryUpdate?.primaryMember?.firstName || '').trim()} ${String(d?.beneficiaryUpdate?.primaryMember?.lastName || '').trim()}`.trim() ||
        '—'
    ).trim();

    rows.push({
      id: String(d._id),
      employeeName: employeeName || '—',
      idNumber: rawId || '—',
      subscriptionStartDate: startDateUtc.toISOString().slice(0, 10),
      billingType,
      activeDays,
      basePrice: roundCurrency(basePrice),
      billedAmount: billedRounded,
      monthlyStatusPct,
      monthlyStatusSubtext,
      cancellationDate: cancellationDateStr,
    });
  }

  return {
    month: targetMonth,
    summary: {
      totalDue: roundCurrency(totalDue),
      totalActiveRecords: rows.length,
      totalProrated,
      totalFinalMonth,
    },
    rows,
  };
}

// ─── BillingSnapshot ─────────────────────────────────────────────────────────

function serializeBillingSnapshot(doc) {
  return {
    id: String(doc._id),
    orgId: String(doc.orgId || ''),
    orgName: String(doc.orgName || ''),
    month: String(doc.month || ''),
    totalAmount: Number(doc.totalAmount || 0),
    totalEmployees: Number(doc.totalEmployees || 0),
    status: String(doc.status || 'Pending'),
    invoiceNum: String(doc.invoiceNum || ''),
    receiptNum: String(doc.receiptNum || ''),
    notes: String(doc.notes || ''),
    lockedAt: doc.lockedAt instanceof Date ? doc.lockedAt.toISOString() : (doc.lockedAt ? String(doc.lockedAt) : null),
    reportData: Array.isArray(doc.reportData) ? doc.reportData : [],
  };
}

export async function lockBillingSnapshot({ orgId, month, totalAmount, totalEmployees, rows }) {
  const db = await getDb();
  let oid;
  try { oid = new ObjectId(String(orgId)); } catch { throw new Error('מזהה ארגון לא תקין'); }
  const org = await db.collection('organizations').findOne({ _id: oid });
  if (!org) throw new Error('ארגון לא נמצא');
  const existing = await db.collection('billing_snapshots').findOne({ orgId: String(orgId), month: String(month) });
  if (existing) throw new Error(`דוח חודש ${month} כבר נעול לארגון זה`);
  const doc = {
    orgId: String(orgId),
    orgName: String(org.companyName || ''),
    month: String(month),
    totalAmount: Number(totalAmount),
    totalEmployees: Number(totalEmployees),
    status: 'Pending',
    invoiceNum: '',
    receiptNum: '',
    notes: '',
    lockedAt: new Date(),
    reportData: Array.isArray(rows) ? rows : [],
  };
  const result = await db.collection('billing_snapshots').insertOne(doc);
  return serializeBillingSnapshot({ _id: result.insertedId, ...doc });
}

export async function getBillingSnapshots(orgId) {
  const db = await getDb();
  const docs = await db.collection('billing_snapshots')
    .find({ orgId: String(orgId) })
    .sort({ month: -1 })
    .toArray();
  return docs.map(serializeBillingSnapshot);
}

export async function updateBillingSnapshot(snapshotId, { status, invoiceNum, receiptNum, notes }) {
  const db = await getDb();
  let sid;
  try { sid = new ObjectId(String(snapshotId)); } catch { throw new Error('מזהה snapshot לא תקין'); }
  const update = { updatedAt: new Date() };
  if (status !== undefined) update.status = String(status);
  if (invoiceNum !== undefined) update.invoiceNum = String(invoiceNum);
  if (receiptNum !== undefined) update.receiptNum = String(receiptNum);
  if (notes !== undefined) update.notes = String(notes);
  await db.collection('billing_snapshots').updateOne({ _id: sid }, { $set: update });
  const updated = await db.collection('billing_snapshots').findOne({ _id: sid });
  if (!updated) throw new Error('Snapshot לא נמצא');
  return serializeBillingSnapshot(updated);
}

export async function listAllBillingSnapshots() {
  const db = await getDb();
  const docs = await db.collection('billing_snapshots')
    .find({})
    .sort({ month: -1, lockedAt: -1 })
    .toArray();
  return docs.map(serializeBillingSnapshot);
}

// ─── end BillingSnapshot ──────────────────────────────────────────────────────

/**
 * ייבוא עובדים — עסקה הושלמה, תשלום מרוכז, פרופיל מוטב מלא (כמו טופס ידני)
 */
export async function insertOrganizationImportedDeal({
  organizationId,
  organizationName,
  monthlyPrice,
  subscriptionProductName = '',
  fullName,
  idNum,
  email,
  phone,
  dateOfBirth = '',
  gender = '',
  address = '',
  healthFund = '',
  supplementalInsurance = '',
  maritalStatus = '',
}) {
  const dup = await findActiveDealByOrgAndNationalId(organizationId, idNum);
  if (dup) return { skipped: true, reason: 'duplicate_id' };

  const db = await getDb();
  const transactionId = `IMP-ORG-${String(organizationId).replace(/\W/g, '').slice(-10)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const idClean = String(idNum || '')
    .replace(/\D/g, '')
    .slice(0, 9);
  const nameParts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts.length === 1 ? '' : '';

  const orgNm = String(organizationName || '').trim();
  const productLabel =
    String(subscriptionProductName || '').trim() ||
    (orgNm ? `מנוי ארגוני — ${orgNm}` : 'מנוי ארגוני');
  const fs = {
    fullName: String(fullName || '').trim(),
    id: idClean || String(idNum || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    dateOfBirth: String(dateOfBirth || '').trim(),
    gender: String(gender || '').trim(),
    maritalStatus: String(maritalStatus || '').trim(),
    healthFund: String(healthFund || '').trim(),
    supplementalInsurance: String(supplementalInsurance || '').trim(),
    address: String(address || '').trim(),
    organizationName: orgNm,
    organizationId: String(organizationId),
    paymentMethod: 'centralized',
    organizationPaymentMethod: 'centralized',
    subscriptionProductName: String(subscriptionProductName || '').trim() || productLabel,
    productName: productLabel,
    subscriptionStartDate: now.toISOString().slice(0, 10),
    beneficiaries: [],
    beneficiaryCount: 0,
  };

  const doc = {
    transactionId,
    lowProfileCode: '',
    cardcomAccountId: '',
    cardcomRecurringId: '',
    cardcomToken: '',
    payerAmount: Number(monthlyPrice || 0),
    formState: fs,
    agentId: null,
    terminalNumber: 0,
    paymentStatus: 'success',
    source: 'מיובא מאקסל',
    indicator: null,
    normalizedPayload: null,
    commissionAmount: 0,
    billingMonth: formatBillingMonthFromDate(now),
    organizationId: String(organizationId),
    isOrganizationDeal: true,
    memberType: 'Primary',
    isActive: true,
    status: 'Completed',
    subscriptionStatus: 'Active',
    beneficiaryUpdate: {
      transactionId,
      organizationName: orgNm,
      agentName: '',
      primaryMember: {
        firstName,
        lastName,
        id: idClean || String(idNum || '').trim(),
        email: String(email || '').trim(),
        phone: String(phone || '').trim(),
        address: String(address || '').trim(),
        dateOfBirth: String(dateOfBirth || '').trim(),
        maritalStatus: String(maritalStatus || '').trim(),
        healthFund: String(healthFund || '').trim(),
        supplementalInsurance: String(supplementalInsurance || '').trim(),
        gender: String(gender || '').trim(),
      },
      additionalMembers: [],
      submittedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('deals').insertOne(doc);
  return { skipped: false, id: String(result.insertedId), transactionId };
}

export async function insertOrganizationEmployeePendingDeal({
  organizationId,
  organizationName,
  monthlyPrice,
  subscriptionProductName = '',
  firstName,
  lastName,
  idNum,
  email,
  phone,
  dateOfBirth = '',
  gender = '',
  address = '',
  healthFund = '',
  supplementalInsurance = '',
  maritalStatus = '',
}) {
  const dup = await findActiveDealByOrgAndNationalId(organizationId, idNum);
  if (dup) return { skipped: true, reason: 'duplicate_id' };

  const db = await getDb();
  const transactionId = `ORG-REG-${String(organizationId).replace(/\W/g, '').slice(-10)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const idClean = String(idNum || '').replace(/\D/g, '').slice(0, 9);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const orgNm = String(organizationName || '').trim();
  const productLabel = String(subscriptionProductName || '').trim() || (orgNm ? `מנוי ארגוני — ${orgNm}` : 'מנוי ארגוני');

  const fs = {
    fullName,
    id: idClean || String(idNum || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    dateOfBirth: String(dateOfBirth || '').trim(),
    gender: String(gender || '').trim(),
    maritalStatus: String(maritalStatus || '').trim(),
    healthFund: String(healthFund || '').trim(),
    supplementalInsurance: String(supplementalInsurance || '').trim(),
    address: String(address || '').trim(),
    organizationName: orgNm,
    organizationId: String(organizationId),
    paymentMethod: 'centralized',
    organizationPaymentMethod: 'centralized',
    productName: productLabel,
    beneficiaries: [],
    beneficiaryCount: 0,
  };

  const doc = {
    transactionId,
    lowProfileCode: '',
    cardcomAccountId: '',
    cardcomRecurringId: '',
    cardcomToken: '',
    payerAmount: Number(monthlyPrice || 0),
    formState: fs,
    agentId: null,
    terminalNumber: 0,
    paymentStatus: 'success',
    source: 'רישום עצמאי ',
    indicator: null,
    normalizedPayload: null,
    commissionAmount: 0,
    billingMonth: formatBillingMonthFromDate(now),
    organizationId: String(organizationId),
    isOrganizationDeal: true,
    isCentralized: true,
    memberType: 'Primary',
    isActive: true,
    status: 'pending_org_approval',
    subscriptionStatus: 'ממתין לאישור הארגון',
    beneficiaryUpdate: {
      transactionId,
      organizationName: orgNm,
      agentName: '',
      primaryMember: {
        firstName: String(firstName || '').trim(),
        lastName: String(lastName || '').trim(),
        id: idClean || String(idNum || '').trim(),
        email: String(email || '').trim(),
        phone: String(phone || '').trim(),
        address: String(address || '').trim(),
        dateOfBirth: String(dateOfBirth || '').trim(),
        maritalStatus: String(maritalStatus || '').trim(),
        healthFund: String(healthFund || '').trim(),
        supplementalInsurance: String(supplementalInsurance || '').trim(),
        gender: String(gender || '').trim(),
      },
      additionalMembers: [],
      submittedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('deals').insertOne(doc);
  return { skipped: false, id: String(result.insertedId), transactionId };
}

export async function approveOrgEmployee(dealId) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }
  const existing = await db.collection('deals').findOne(
    { _id: oid },
    { projection: { status: 1, isActive: 1 } }
  );
  if (!existing) throw new Error('עסקה לא נמצאה');
  if (existing.isActive === false) {
    const err = new Error('ARCHIVED');
    err.code = 'ARCHIVED';
    throw err;
  }
  const startDate = new Date().toISOString().slice(0, 10);
  const r = await db.collection('deals').updateOne(
    { _id: oid, status: 'pending_org_approval' },
    {
      $set: {
        status: 'Completed',
        subscriptionStatus: 'Active',
        'formState.subscriptionStartDate': startDate,
        updatedAt: new Date(),
      },
    }
  );
  if (!r.matchedCount) throw new Error('עסקה לא נמצאה או כבר אושרה');
  return { ok: true };
}

export async function updateLeadAdmin(kind, id, params) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ליד לא תקין');
  }
  const col = kind === 'corporate' ? 'organizationLeads' : 'contactLeads';
  const set = { updatedAt: new Date() };
  if (params.leadStatus != null) set.leadStatus = String(params.leadStatus || '').trim();
  if (params.adminNotes != null) set.adminNotes = String(params.adminNotes || '');
  if (params.isActive != null) set.isActive = !!params.isActive;
  const r = await db.collection(col).updateOne({ _id: oid }, { $set: set });
  if (!r.matchedCount) throw new Error('ליד לא נמצא');
  return { ok: true };
}

export async function getDeals() {
  const db = await getDb();
  const docs = await db
    .collection('deals')
    .find({ isActive: { $ne: false }, isRecurringCycle: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    ...d,
    agentId: d.agentId != null ? String(d.agentId) : null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
    beneficiarySubmittedAt:
      d.beneficiaryUpdate?.submittedAt instanceof Date ? d.beneficiaryUpdate.submittedAt.toISOString() : null,
  }));
}

function isCancelledStatus(doc) {
  const sub = String(doc?.subscriptionStatus || '').trim().toLowerCase();
  // "Pending Cancellation" אינו ביטול — מנוי עדיין בתוקף עד ה-1 לחודש הבא
  if (sub === 'pending cancellation') return false;
  const st = String(doc?.status || '').trim().toLowerCase();
  const pay = String(doc?.paymentStatus || '').trim().toLowerCase();
  const recurringId = String(doc?.cardcomRecurringId || '').trim();
  const recurringStopped = doc?.isActive === false && recurringId !== '';
  const manuallyCancelled =
    /cancel|בוטל/i.test(sub) || /cancel|בוטל/i.test(st) || /cancel|בוטל/i.test(pay);
  return manuallyCancelled || recurringStopped;
}

/** Count successful/paid subscribers (deals) linked to an agent */
export async function countDealsByAgentId(agentId) {
  if (!agentId) return 0;
  const db = await getDb();
  const id = String(agentId).trim();
  return db.collection('deals').countDocuments({
    agentId: id,
    isRecurringCycle: { $ne: true },
    paymentStatus: { $regex: /success|paid|test_success/i },
    subscriptionStatus: { $ne: 'Cancelled' },
  });
}

function serializeDocDates(doc) {
  const out = { ...doc, id: String(doc._id) };
  delete out._id;
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  return out;
}

function mapBillingMethodToBillingType(billingMethod) {
  const s = String(billingMethod || '');
  if (/מרוכז|Centralized/i.test(s)) return 'Centralized';
  return 'Private';
}

function serializeOrgDoc(doc, activeMemberCount = undefined) {
  if (!doc) return null;
  const o = serializeDocDates(doc);
  o.billingType =
    doc.billingType === 'Centralized' || doc.billingType === 'Private'
      ? doc.billingType
      : mapBillingMethodToBillingType(doc.billingMethod);
  o.name = o.companyName || '';
  o.taxId = o.companyId || '';
  o.monthlyPricePerMember = Number(doc.monthlyPricePerMember || 0);
  o.subscriptionProductName = String(doc.subscriptionProductName || '').trim();
  o.status = String(doc.status || 'active').trim();
  o.isActive = doc.isActive !== false;
  o.contactEmail =
    doc.contactEmail != null && String(doc.contactEmail).trim()
      ? String(doc.contactEmail).trim()
      : o.companyEmail || '';
  o.contactPhone = String(doc.contactPhone || '').trim();
  o.notes = String(doc.notes || '').trim();
  o.employeeApprovalEmail = String(doc.employeeApprovalEmail || '').trim();
  o.priceListId = doc.priceListId ? String(doc.priceListId) : '';
  o.customPricing = Array.isArray(doc.customPricing)
    ? doc.customPricing
        .map((x) => ({
          productId: String(x?.productId || '').trim(),
          memberPrice: Math.max(0, Number(x?.memberPrice || 0)),
        }))
        .filter((x) => ObjectId.isValid(x.productId))
    : [];
  if (activeMemberCount !== undefined) o.activeMemberCount = activeMemberCount;
  return o;
}

/** B2C contact form leads */
export async function getContactLeads(limit = 200) {
  const db = await getDb();
  const docs = await db
    .collection('contactLeads')
    .aggregate([
      { $match: { isActive: { $ne: false } } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'landing_pages',
          let: {
            ls: {
              $toLower: { $trim: { input: { $ifNull: ['$landingSlug', ''] } } },
            },
          },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toLower: '$slug' }, '$$ls'] } } },
            { $project: { _id: 0, pageTitle: 1 } },
            { $limit: 1 },
          ],
          as: '_lp',
        },
      },
      {
        $set: {
          landingPageTitle: { $ifNull: [{ $arrayElemAt: ['$_lp.pageTitle', 0] }, ''] },
        },
      },
      { $project: { _lp: 0 } },
    ])
    .toArray();
  return docs.map(serializeDocDates);
}

/** B2B / corporate contact leads */
export async function getOrganizationLeads(limit = 200) {
  const db = await getDb();
  const docs = await db
    .collection('organizationLeads')
    .find({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serializeDocDates);
}

/** Deals with failed / problematic payment (פיגור תשלום / כשלון) */
/** עסקאות ששולמו ועדיין לא הוגש טופס מוטבים */
export async function getDealsPendingBeneficiaryCompletion(limit = 150) {
  const db = await getDb();
  const docs = await db
    .collection('deals')
    .find({
      isActive: { $ne: false },
      isRecurringCycle: { $ne: true },
      paymentStatus: { $regex: /success|paid|test_success/i },
      subscriptionStatus: { $ne: 'Cancelled' },
      $or: [
        { beneficiaryUpdate: { $exists: false } },
        { 'beneficiaryUpdate.submittedAt': { $exists: false } },
        { 'beneficiaryUpdate.submittedAt': null },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => ({
    id: String(d._id),
    transactionId: d.transactionId || '',
    fullName: d.formState?.fullName || '',
    phone: d.formState?.phone || '',
    email: d.formState?.email || '',
    payerAmount: Number(d.payerAmount || 0),
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
    completionStatus: 'Pending Completion',
  }));
}

export async function getPaymentArrearsDeals(limit = 200) {
  const db = await getDb();
  const docs = await db
    .collection('deals')
    .find({
      isActive: { $ne: false },
      $or: [
        { paymentStatus: { $regex: /fail|cancel|declin|error|void|refund|בוטל|נכשל|denied/i } },
        { paymentStatus: 'pending' },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    transactionId: d.transactionId,
    paymentStatus: d.paymentStatus,
    payerAmount: d.payerAmount,
    formState: d.formState,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
  }));
}

function getDateRange(filters) {
  const range = {};
  if (filters.month) {
    const [y, m] = String(filters.month).split('-').map(Number);
    if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      range.$gte = start;
      range.$lt = end;
    }
  }
  if (filters.fromDate) {
    const from = new Date(filters.fromDate);
    if (!Number.isNaN(from.getTime())) {
      range.$gte = from;
    }
  }
  if (filters.toDate) {
    const to = new Date(filters.toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }
  return Object.keys(range).length ? range : null;
}

function enrichDeal(d) {
  const beneficiaries = Array.isArray(d?.formState?.beneficiaries) ? d.formState.beneficiaries : [];
  const secondaryCount = beneficiaries.length;
  const primaryCount = 1;
  const individualsCount = primaryCount + secondaryCount;
  const orgName = String(d?.formState?.organizationName || '').trim();
  const isCanceled = isCancelledStatus(d);
  const provider = d?.provider || 'Cardcom';
  const agentName = String(d?.formState?.agentName || d?.beneficiaryUpdate?.agentName || '').trim();
  const isPaidSuccess = /success|paid|test_success/i.test(String(d?.paymentStatus || ''));
  const statusRaw = String(d?.status || d?.subscriptionStatus || '').trim().toLowerCase();
  const paymentMethodRaw = String(
    d?.paymentMethod ||
      d?.formState?.paymentMethod ||
      d?.formState?.organizationPaymentMethod ||
      d?.formState?.billingMethod ||
      ''
  ).trim().toLowerCase();
  const paymentMethod =
    paymentMethodRaw === 'private' || paymentMethodRaw === 'centralized'
      ? paymentMethodRaw
      : (orgName ? 'centralized' : 'private');
  const isOrganization = d?.isOrganization === true || !!orgName;
  const isCompleted =
    statusRaw === 'completed' || (!isCanceled && isPaidSuccess);
  const benSub = d?.beneficiaryUpdate?.submittedAt;
  const beneficiarySubmitted =
    benSub instanceof Date || (benSub != null && !Number.isNaN(new Date(benSub).getTime()));
  const pendingBeneficiaryCompletion = isPaidSuccess && !isCanceled && !beneficiarySubmitted;
  let completionStatus = '—';
  if (isCanceled) completionStatus = 'בוטל';
  else if (isPaidSuccess && beneficiarySubmitted) completionStatus = 'הושלם';
  else if (pendingBeneficiaryCompletion) completionStatus = 'ממתין להשלמת מסמכים';
  return {
    ...d,
    provider,
    agentName,
    organizationName: orgName,
    primaryCount,
    secondaryCount,
    individualsCount,
    activeCustomersCount: primaryCount + secondaryCount,
    isCanceled,
    isCompleted,
    paymentMethod,
    isOrganization,
    isPrivateOrg: !orgName,
    isCentralizedOrg: !!orgName,
    beneficiarySubmitted,
    pendingBeneficiaryCompletion,
    completionStatus,
  };
}

function isOrganizationLinkedDeal(d) {
  const fs = d?.formState && typeof d.formState === 'object' ? d.formState : {};
  const oid = String(d.organizationId || fs.organizationId || '').trim();
  return !!(oid || d.isOrganizationDeal === true || String(d.source || '') === 'org-bulk-import');
}

function isCentralizedOrgPayment(d) {
  // d.paymentMethod is already resolved by enrichDeal; fall back to formState fields
  const fs = d?.formState && typeof d.formState === 'object' ? d.formState : {};
  const pm = String(d.paymentMethod || fs.paymentMethod || fs.organizationPaymentMethod || '').toLowerCase();
  return pm === 'centralized' || String(d.source || '') === 'org-bulk-import';
}

function isCardcomBillingErrorByStatus(paymentStatusRaw = '') {
  const pay = String(paymentStatusRaw || '').trim().toLowerCase();
  return /fail|declin|error|denied|arrears|insufficient|expired|stopped|cancel|void|refund|נכשל|פיגור|בוטל/.test(pay);
}

function isCardcomBillingError(deal = {}) {
  const cardcomResponseDescription = firstNonEmpty(
    String(deal?.indicator?.responsdescription || '').trim(),
    String(deal?.formState?.cardcomResponseDescription || '').trim(),
    ''
  ).toLowerCase();
  const byResponse = /fail|declin|error|denied|insufficient|expired|stopped|cancel|void|refund|נכשל|פיגור|בוטל/.test(cardcomResponseDescription);
  const byStatus = isCardcomBillingErrorByStatus(deal?.paymentStatus);
  return byResponse || byStatus;
}

function isManualFutureCancellation(deal = {}) {
  const sub = String(deal?.subscriptionStatus || '').trim().toLowerCase();
  const st = String(deal?.status || '').trim().toLowerCase();
  const recurringId = String(deal?.cardcomRecurringId || '').trim();
  if (sub === 'pending cancellation') return false;
  return /cancel|בוטל/.test(sub) || /cancel|בוטל/.test(st) || (deal?.isActive === false && recurringId !== '');
}

function isPendingOrgApprovalDeal(deal = {}) {
  return String(deal?.status || '').trim().toLowerCase() === 'pending_org_approval';
}

function isPendingCancellationDeal(deal = {}) {
  return String(deal?.subscriptionStatus || '').trim().toLowerCase() === 'pending cancellation';
}

/** מבוטל סופית — subscriptionStatus בדיוק Cancelled/Canceled (אנגלית) */
function isSubscriptionCancelledForArchive(deal = {}) {
  const s = String(deal?.subscriptionStatus || '').trim().toLowerCase();
  return s === 'cancelled' || s === 'canceled';
}

function canArchiveDealAdmin(deal = {}) {
  if (isPendingCancellationDeal(deal)) return false;
  if (isPendingOrgApprovalDeal(deal)) return true;
  return isSubscriptionCancelledForArchive(deal);
}

function isCancelledByBusinessRule(deal = {}) {
  return isManualFutureCancellation(deal) || isCardcomBillingError(deal);
}

function applyCategoryFilters(deals, categories = []) {
  if (!Array.isArray(categories) || !categories.length) return deals;
  const set = new Set(categories);
  if (set.has('all')) return deals;
  return deals.filter((d) => {
    const checks = [];
    if (set.has('primary')) checks.push(d.primaryCount > 0);
    if (set.has('active')) checks.push(d.activeCustomersCount > 0 && !d.isCanceled);
    if (set.has('canceled')) checks.push(d.isCanceled);
    if (set.has('private_org')) checks.push(d.isPrivateOrg);
    if (set.has('centralized_org')) checks.push(d.isCentralizedOrg);
    if (set.has('centralized_canceled')) checks.push(d.isCentralizedOrg && d.isCanceled);
    return checks.length ? checks.every(Boolean) : true;
  });
}

/** סכום LTV: חיוב ראשון מוצלח + כל אירועי DetailRecurring מוצלחים */
function computeTotalCustomerRevenue(deal) {
  if (!deal) return 0;
  const payOk = /success|paid|test_success|completed/i.test(String(deal.paymentStatus || ''));
  const initial = payOk ? Number(deal.payerAmount || 0) : 0;
  const events = Array.isArray(deal.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  let recurring = 0;
  for (const ev of events) {
    if (Number(ev?.statusCode) === 1) recurring += Number(ev?.sum ?? 0);
  }
  return initial + recurring;
}

function isSubscriptionStatusActiveLabel(sub) {
  const s = String(sub ?? '').trim();
  const sl = s.toLowerCase();
  return sl === 'active' || sl === 'פעיל' || s === 'פעיל';
}

function isSubscriptionStatusPendingCancellationLabel(sub) {
  return String(sub ?? '').trim().toLowerCase() === 'pending cancellation';
}

/**
 * 4 קטגוריות מנוי לווידג'טים (בלעדיות — עדכון ראשון שמתאים)
 */
function classifySubscriptionWidgetBucket(d) {
  if (!d) return 'other';
  const wf = String(d.status || '').trim().toLowerCase();
  const sub = String(d.subscriptionStatus || '').trim();
  const subL = sub.toLowerCase();
  if (wf === 'pending_org_approval' || sub === 'ממתין לאישור הארגון') return 'pending_org';
  if (subL === 'cancelled' || subL === 'canceled' || d.isCanceled === true) return 'cancelled';
  if (isSubscriptionStatusPendingCancellationLabel(sub)) return 'pending_cancel';
  if (isSubscriptionStatusActiveLabel(sub)) return 'active';
  return 'other';
}

function economicsFromDeal(d) {
  const fs = d.formState || {};
  const rev = Number(d.payerAmount || 0);
  const vc = Number(fs.resolvedVendorCost ?? 0);
  const ac = Number(fs.resolvedAgentCommission ?? 0);
  let net = rev - vc - ac;
  if (fs.resolvedNetProfit != null && !Number.isNaN(Number(fs.resolvedNetProfit))) {
    net = Number(fs.resolvedNetProfit);
  }
  return {
    revenue: rev,
    vendorCost: vc,
    agentCommission: ac,
    netProfit: net,
    productName: String(fs.productName || ''),
  };
}

export async function getSalesDashboardData(filters = {}) {
  const db = await getDb();
  const dealsCol = db.collection('deals');

  const statusFilter = String(filters.status || 'all').trim().toLowerCase();
  const match =
    statusFilter === 'cancelled'
      ? {}
      : { isActive: { $ne: false } };
  const andClauses = [{ isRecurringCycle: { $ne: true } }];
  if (statusFilter === 'cancelled') {
    andClauses.push({
      $or: [
        { subscriptionStatus: { $regex: /cancel|בוטל/i } },
        { paymentStatus: { $regex: /arrears|פיגור/i } },
        {
          $and: [
            { isActive: false },
            { cardcomRecurringId: { $exists: true, $ne: '' } },
          ],
        },
      ],
    });
  }
  const dateRange = getDateRange(filters);
  if (dateRange && statusFilter !== 'cancelled') {
    match.createdAt = dateRange;
  } else if (dateRange && statusFilter === 'cancelled') {
    andClauses.push({
      $or: [
        { cancellationDate: dateRange },
        { updatedAt: dateRange },
      ],
    });
  }

  if (filters.agentEnabled && filters.agentValue) {
    const av = String(filters.agentValue).trim();
    const matchedAgentDocs = await db
      .collection('sales_agents')
      .find({ agentName: av })
      .project({ _id: 1 })
      .toArray();
    const matchedIds = matchedAgentDocs.map((a) => String(a._id));
    const matchedObjIds = matchedIds
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    andClauses.push({
      $or: [
        { 'formState.agentName': av },
        { agentId: av },
        { 'formState.agentId': av },
        ...(matchedIds.length ? [{ agentId: { $in: matchedIds } }, { 'formState.agentId': { $in: matchedIds } }] : []),
        ...(matchedObjIds.length
          ? [{ agentId: { $in: matchedObjIds } }, { 'formState.agentId': { $in: matchedObjIds } }]
          : []),
      ],
    });
  }
  if (filters.organizationSearch) {
    match['formState.organizationName'] = { $regex: String(filters.organizationSearch).trim(), $options: 'i' };
  }
  if (filters.customerSearch) {
    match.fullTextCustomer = { $regex: String(filters.customerSearch).trim(), $options: 'i' };
  }
  if (filters.idSearch) {
    andClauses.push({
      $or: [
      { 'formState.id': { $regex: String(filters.idSearch).trim(), $options: 'i' } },
      { 'formState.beneficiaries.id': { $regex: String(filters.idSearch).trim(), $options: 'i' } },
      ],
    });
  }
  if (filters.productNameSearch) {
    match['formState.productName'] = { $regex: String(filters.productNameSearch).trim(), $options: 'i' };
  }
  if (filters.agentNameSearch) {
    match['formState.agentName'] = { $regex: String(filters.agentNameSearch).trim(), $options: 'i' };
  }
  if (filters.search) {
    const sq = String(filters.search).trim();
    andClauses.push({
      $or: [
        { transactionId: { $regex: sq, $options: 'i' } },
        { cardcomRecurringId: { $regex: sq, $options: 'i' } },
        { internalDealNumber: { $regex: sq, $options: 'i' } },
        { fullTextCustomer: { $regex: sq, $options: 'i' } },
        { 'formState.fullName': { $regex: sq, $options: 'i' } },
        { 'formState.id': { $regex: sq, $options: 'i' } },
        { 'formState.organizationName': { $regex: sq, $options: 'i' } },
      ],
    });
  }
  if (andClauses.length) match.$and = andClauses;

  const pipeline = [];
  const preMatch = { ...match };
  delete preMatch.fullTextCustomer;
  if (preMatch.$and) {
    preMatch.$and = preMatch.$and
      .map((clause) => {
        if (!clause || typeof clause !== 'object' || !Array.isArray(clause.$or)) return clause;
        const filteredOr = clause.$or.filter((item) => !(item && typeof item === 'object' && 'fullTextCustomer' in item));
        if (!filteredOr.length) return null;
        return { ...clause, $or: filteredOr };
      })
      .filter(Boolean);
    if (!preMatch.$and.length) delete preMatch.$and;
  }
  if (Object.keys(preMatch).length) pipeline.push({ $match: preMatch });
  pipeline.push({
    $addFields: {
      fullTextCustomer: {
        $concat: [
          { $ifNull: ['$formState.fullName', ''] },
          ' ',
          { $ifNull: ['$transactionId', ''] },
          ' ',
          { $ifNull: ['$formState.id', ''] },
        ],
      },
    },
  });
  pipeline.push({ $match: match });
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $limit: 1000 });

  const baseDeals = await dealsCol.aggregate(pipeline).toArray();
  const vendors = await db
    .collection('vendors')
    .find({})
    .project({ vendorName: 1, productLinks: 1 })
    .toArray();
  const vendorNames = [...new Set(vendors.map((v) => String(v.vendorName || '').trim()).filter(Boolean))];
  const productVendorMap = new Map();
  for (const v of vendors) {
    const vn = String(v.vendorName || '').trim();
    if (!vn) continue;
    const links = Array.isArray(v.productLinks) ? v.productLinks : [];
    for (const l of links) {
      const pid = String(l?.productId || '').trim();
      if (!pid || productVendorMap.has(pid)) continue;
      productVendorMap.set(pid, vn);
    }
  }
  const agentIds = [...new Set(
    baseDeals
      .map((d) => String(d?.agentId || d?.formState?.agentId || '').trim())
      .filter(Boolean)
  )];
  const agentDocs = agentIds.length
    ? await db
        .collection('sales_agents')
        .find({ _id: { $in: agentIds.map((id) => {
          try {
            return new ObjectId(id);
          } catch {
            return null;
          }
        }).filter(Boolean) } })
        .project({ agentName: 1 })
        .toArray()
    : [];
  const agentNameMap = new Map(agentDocs.map((a) => [String(a._id), String(a.agentName || '').trim()]));

  const enriched = baseDeals.map((d) => {
    const e = enrichDeal(d);
    const aid = String(d?.agentId || d?.formState?.agentId || '').trim();
    const pid = String(d?.formState?.productId || '').trim();
    const resolvedVendorName = firstNonEmpty(String(d?.provider || '').trim(), productVendorMap.get(pid), '');
    const resolvedAgentName = firstNonEmpty(
      e.agentName,
      aid ? agentNameMap.get(aid) : '',
      ''
    );
    return {
      ...e,
      vendorName: resolvedVendorName,
      agentName: resolvedAgentName,
      resolvedAgentId: aid,
    };
  });
  let shown = enriched;
  if (statusFilter === 'cancelled') {
    shown = shown.filter((d) => {
      if (!isCancelledByBusinessRule(d)) return false;
      if (!dateRange) return true;
      const eventDate = d.cancellationDate || d.updatedAt || d.createdAt;
      const dt = new Date(eventDate);
      if (Number.isNaN(dt.getTime())) return false;
      if (dateRange.$gte && dt < dateRange.$gte) return false;
      if (dateRange.$lte && dt > dateRange.$lte) return false;
      if (dateRange.$lt && dt >= dateRange.$lt) return false;
      return true;
    });
  }
  shown = applyCategoryFilters(shown, filters.summaryCategories);
  if (filters.providerEnabled && filters.providerValue) {
    const pv = String(filters.providerValue).trim();
    shown = shown.filter((d) => String(d.vendorName || '').trim() === pv);
  }
  const seg = String(filters.customerSegment || 'all').toLowerCase();
  if (seg === 'private') {
    shown = shown.filter((d) => !isOrganizationLinkedDeal(d));
  } else if (seg === 'organization') {
    shown = shown.filter((d) => isOrganizationLinkedDeal(d));
  }

  const amountDue = Number(filters.amountDue || 0);
  const totalRevenueLtv = shown.reduce((sum, d) => sum + computeTotalCustomerRevenue(d), 0);
  const econ = shown.map((d) => economicsFromDeal(d));
  const totalVendorCost = econ.reduce((s, e) => s + e.vendorCost, 0);
  const totalAgentCommission = econ.reduce((s, e) => s + e.agentCommission, 0);
  const totalNetProfitFromDeals = econ.reduce((s, e) => s + e.netProfit, 0);
  const completedDeals = shown.filter((d) => d.isCompleted);
  const canceledDeals = shown.filter((d) => d.isCanceled);
  const totalPrimary = completedDeals.length;
  const totalSecondary = shown.reduce((sum, d) => sum + Number(d.secondaryCount || 0), 0);
  const totalActive = completedDeals.length;
  const totalCanceled = canceledDeals.length;
  const totalPrivateOrg = shown
    .filter((d) => d.isOrganization && d.paymentMethod === 'private')
    .reduce((sum, d) => sum + Number(d.individualsCount || 0), 0);
  const totalCentralizedOrg = new Set(
    shown
      .filter((d) => d.paymentMethod === 'centralized')
      .map((d) => String(d.organizationName || '').trim())
      .filter(Boolean)
  ).size;
  const totalCentralizedCanceled = new Set(
    shown
      .filter((d) => d.isCanceled && d.paymentMethod === 'centralized')
      .map((d) => String(d.organizationName || '').trim())
      .filter(Boolean)
  ).size;

  let revenueOut = totalRevenueLtv;
  let vendorOut = totalVendorCost;
  let agentOut = totalAgentCommission;
  let netOut = totalNetProfitFromDeals;
  let cashBasedSummary = false;
  let billingEventCount = 0;
  if (filters.month && /^\d{4}-\d{2}$/.test(String(filters.month))) {
    const cash = await getCashFinancialTotalsForMonth(String(filters.month));
    vendorOut = Number(cash.totalVendorCost || 0);
    agentOut = Number(cash.totalAgentCommission || 0);
    netOut = Number(cash.totalNetProfit || 0);
    cashBasedSummary = true;
    billingEventCount = Number(cash.eventCount || 0);
  }

  const subscriptionPendingOrgApproval = shown.filter((d) => classifySubscriptionWidgetBucket(d) === 'pending_org').length;
  const subscriptionActive = shown.filter((d) => classifySubscriptionWidgetBucket(d) === 'active').length;
  const subscriptionPendingCancellation = shown.filter((d) => classifySubscriptionWidgetBucket(d) === 'pending_cancel').length;
  const subscriptionCancelled = shown.filter((d) => classifySubscriptionWidgetBucket(d) === 'cancelled').length;

  return {
    summary: {
      all: shown.length,
      primary: totalPrimary,
      active: totalActive,
      canceled: totalCanceled,
      private_org: totalPrivateOrg,
      centralized_org: totalCentralizedOrg,
      centralized_canceled: totalCentralizedCanceled,
      totalRevenue: revenueOut,
      totalExpenses: amountDue,
      /** legacy: הכנסות פחות "הוצאות ידניות" */
      totalProfit: revenueOut - amountDue,
      totalVendorCost: vendorOut,
      totalAgentCommission: agentOut,
      /** רווח אחרי עלות ספק ועמלת סוכן (מומלץ) */
      totalNetProfit: netOut,
      cashBasedSummary,
      billingEventCount,
      subscriptionPendingOrgApproval,
      subscriptionActive,
      subscriptionPendingCancellation,
      subscriptionCancelled,
    },
    searchResults: {
      totalTransactions: shown.length,
      totalPrimary,
      totalSecondary,
      totalSalesAmount: revenueOut,
    },
    filterOptions: {
      providers: vendorNames,
      agents: [...new Set(enriched.map((d) => d.agentName).filter(Boolean))],
      organizations: [...new Set(enriched.map((d) => String(d.organizationName || d.formState?.organizationName || '').trim()).filter(Boolean))],
    },
    rows: shown.slice(0, 500).map((d) => {
      const e = economicsFromDeal(d);
      const cancellationDateRaw = d.cancellationDate instanceof Date ? d.cancellationDate : (d.cancellationDate ? new Date(d.cancellationDate) : null);
      const orgLinked = isOrganizationLinkedDeal(d);
      const centralized = isCentralizedOrgPayment(d);
      const orgBadge = orgLinked
        ? String(d.organizationName || d.formState?.organizationName || '').trim() || 'ארגון'
        : '';
      const cardcomResponseDescription = firstNonEmpty(
        String(d?.indicator?.responsdescription || '').trim(),
        String(d?.formState?.cardcomResponseDescription || '').trim(),
        ''
      );
      const ent = getEntitlementStatus(d);
      const fsEnt = d.formState || {};
      let entitlementCancelAt = null;
      // מקור אחיד ל-UI: תאריך ביטול מ-getEntitlementStatus.cancelAt.
      const cancelCand = ent.cancelAt || d.cancellationDate || fsEnt.cardcomLastProcessDate;
      if (cancelCand) {
        const dt =
          cancelCand instanceof Date ? cancelCand : parseFlexibleDate(cancelCand);
        if (dt && !Number.isNaN(dt.getTime())) entitlementCancelAt = dt.toISOString();
      }
      const paymentStatusRaw = String(d.paymentStatus || '');
      const isFailedPayment = /fail|declin|error|denied|נכשל/i.test(paymentStatusRaw);
      const displayPaymentStatus = centralized
        ? 'משולם ע״י ארגון'
        : (isFailedPayment && cardcomResponseDescription ? cardcomResponseDescription : paymentStatusRaw);
      const displaySubscriptionStatus = centralized
        ? `חיוב מרוכז · ${String(d.subscriptionStatus || '—')}`
        : String(d.subscriptionStatus || '');
      return {
        id: String(d._id),
        transactionId: d.transactionId || '',
        status: d.isCanceled ? 'canceled' : 'paid',
        paymentStatus: d.paymentStatus || '',
        cardcomResponseDescription,
        subscriptionStatus: String(d.subscriptionStatus || ''),
        isOrganizationMember: orgLinked,
        organizationBadge: orgBadge,
        displayPaymentStatus,
        displaySubscriptionStatus,
        dealSource: String(d.source || ''),
        cancellationDate:
          cancellationDateRaw && !Number.isNaN(cancellationDateRaw.getTime()) ? cancellationDateRaw.toISOString() : null,
        subscriptionEndDate: d.subscriptionEndDate
          ? (d.subscriptionEndDate instanceof Date
              ? d.subscriptionEndDate.toISOString()
              : String(d.subscriptionEndDate))
          : (ent.cancelAt || null),
        internalDealNumber: String(d.indicator?.internalDealNumber || '').trim(),
        lowProfileCode: String(d.lowProfileCode || ''),
        cardcomAccountId: String(d.cardcomAccountId || '').trim(),
        cardcomRecurringId: String(d.cardcomRecurringId || '').trim(),
        cardcomToken: String(d.cardcomToken || '').trim(),
        fullName: d.formState?.fullName || '',
        idNumber: d.formState?.id || '',
        organizationName: d.organizationName || '',
        provider: d.vendorName || '',
        agentName: d.agentName || '',
        agentId: d.resolvedAgentId || String(d.agentId || d.formState?.agentId || '').trim(),
        planType: d.formState?.selectedPlanId || '',
        productName: e.productName,
        vendorCost: e.vendorCost,
        agentCommission: e.agentCommission,
        netProfit: e.netProfit,
        amount: Number(d.payerAmount || 0),
        totalCustomerRevenue: computeTotalCustomerRevenue(d),
        subscriptionWidgetBucket: classifySubscriptionWidgetBucket(d),
        primaryCount: d.primaryCount,
        secondaryCount: d.secondaryCount,
        activeCustomersCount: d.activeCustomersCount,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
        subscriptionStartDate: String(d.formState?.subscriptionStartDate || ''),
        beneficiarySubmitted: !!d.beneficiarySubmitted,
        pendingBeneficiaryCompletion: !!d.pendingBeneficiaryCompletion,
        completionStatus: d.completionStatus || '—',
        /** תוצאת חיוב חוזר אחרונה מקארדקום (responsdescription מהשרת) */
        futureBillingStatus: String(d.futureBillingStatus ?? '').trim(),
        isCentralized: centralized,
        isOrganizationDeal: !!d.isOrganizationDeal,
        organizationId: String(d.organizationId || d.formState?.organizationId || '').trim(),
        paymentMethod: String(d.paymentMethod || ''),
        finalBillingMonth: String(d.finalBillingMonth || '').trim(),
        entitlementStatus: ent.status,
        entitlementCancelAt,
        raw: d,
      };
    }),
  };
}

/** סטטיסטיקות אמיתיות ללוח בקרה (MongoDB) */
export async function getControlPanelOverviewStats() {
  const db = await getDb();
  const dealsCol = db.collection('deals');

  const docs = await dealsCol
    .find({})
    .project({ paymentStatus: 1, payerAmount: 1, formState: 1, createdAt: 1 })
    .toArray();

  let totalRevenue = 0;
  let totalNetProfit = 0;
  let paidDealsCount = 0;
  let activeMembers = 0;
  let canceledDealsCount = 0;

  const dayKey = (d) => {
    const dt = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };

  const chartBuckets = new Map();
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    chartBuckets.set(key, { date: key, revenue: 0, count: 0, label: day.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }

  for (const d of docs) {
    const e = enrichDeal(d);
    const econ = economicsFromDeal(d);
    const paidSuccess = /success|paid|test_success/i.test(String(d?.paymentStatus || ''));
    const subStatus = String(d?.subscriptionStatus || '').toLowerCase();
    const isActive = paidSuccess && subStatus !== 'cancelled' && !e.isCanceled;
    if (isActive) {
      totalRevenue += Number(d.payerAmount || 0);
      totalNetProfit += econ.netProfit;
      paidDealsCount += 1;
      activeMembers += Number(e.individualsCount || 1);
      const k = dayKey(d);
      if (k && chartBuckets.has(k)) {
        const b = chartBuckets.get(k);
        b.revenue += Number(d.payerAmount || 0);
        b.count += 1;
      }
    } else {
      canceledDealsCount += 1;
    }
  }

  const pendingPayments = await dealsCol.countDocuments({
    $or: [
      { paymentStatus: { $regex: /fail|cancel|declin|error|void|refund|בוטל|נכשל|denied/i } },
      { paymentStatus: 'pending' },
    ],
  });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [newContactLeads, newOrgLeads] = await Promise.all([
    db.collection('contactLeads').countDocuments({ createdAt: { $gte: weekAgo } }),
    db.collection('organizationLeads').countDocuments({ createdAt: { $gte: weekAgo } }),
  ]);

  return {
    totalRevenue,
    totalNetProfit,
    completedSales: paidDealsCount,
    activeMembers,
    canceledDeals: canceledDealsCount,
    pendingPayments,
    totalDealsInDb: docs.length,
    newLeads7d: newContactLeads + newOrgLeads,
    chartSeries: Array.from(chartBuckets.values()),
  };
}

function parseControlPanelDateRange({ fromDate, toDate, month } = {}) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const range = { from: startOfMonth, to: now };
  const monthVal = String(month || '').trim();
  if (/^\d{4}-\d{2}$/.test(monthVal)) {
    const [y, m] = monthVal.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    to.setMilliseconds(-1);
    range.from = from;
    range.to = to;
  }
  const fromVal = String(fromDate || '').trim();
  if (fromVal) {
    const d = new Date(fromVal);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      range.from = d;
    }
  }
  const toVal = String(toDate || '').trim();
  if (toVal) {
    const d = new Date(toVal);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      range.to = d;
    }
  }
  return range;
}

function parseActivityStatus(statusRaw) {
  const s = String(statusRaw || '').trim().toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'cancelled' || s === 'canceled' || s === 'מבוטלים') return 'cancelled';
  return 'all';
}

export async function getControlPanelOverviewData(filters = {}) {
  const db = await getDb();
  const { from, to } = parseControlPanelDateRange(filters);
  const activityStatus = parseActivityStatus(filters.status);
  const deals = await db.collection('deals').aggregate([
    { $match: {} },
    {
      $addFields: {
        _productIdObj: {
          $convert: { input: '$formState.productId', to: 'objectId', onError: null, onNull: null },
        },
        _agentIdObj: {
          $convert: {
            input: { $ifNull: ['$agentId', '$formState.agentId'] },
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
        _orgName: { $ifNull: ['$organizationName', '$formState.organizationName'] },
      },
    },
    { $lookup: { from: 'products', localField: '_productIdObj', foreignField: '_id', as: '_product' } },
    { $lookup: { from: 'sales_agents', localField: '_agentIdObj', foreignField: '_id', as: '_agent' } },
    {
      $addFields: {
        _product: { $arrayElemAt: ['$_product', 0] },
        _agent: { $arrayElemAt: ['$_agent', 0] },
      },
    },
    {
      $addFields: {
        _secondaryCount: { $size: { $ifNull: ['$formState.beneficiaries', []] } },
        _paidSuccess: {
          $regexMatch: {
            input: { $toLower: { $ifNull: ['$paymentStatus', ''] } },
            regex: '(success|paid|test_success)',
          },
        },
        _isCancelled: {
          // "Pending Cancellation" matches /cancel/ — exclude it explicitly.
          // Only exact 'cancelled'/'canceled' or 'cancel' (not 'pending cancellation') counts.
          $and: [
            {
              $not: {
                $regexMatch: {
                  input: { $toLower: { $ifNull: ['$subscriptionStatus', ''] } },
                  regex: 'pending.+cancel',
                },
              },
            },
            {
              $or: [
                {
                  $regexMatch: {
                    input: { $toLower: { $ifNull: ['$subscriptionStatus', ''] } },
                    regex: 'cancel',
                  },
                },
                {
                  $regexMatch: {
                    input: { $toLower: { $ifNull: ['$status', ''] } },
                    regex: 'cancel',
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        _baseVendorCost: {
          $ifNull: ['$formState.resolvedVendorCost', { $ifNull: ['$_product.providerCost', 0] }],
        },
        _baseAgentCommission: {
          $ifNull: [
            '$formState.resolvedAgentCommission',
            {
              $let: {
                vars: {
                  row: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ['$_agent.productCommissions', []] },
                          as: 'pc',
                          cond: { $eq: ['$$pc.productId', '$_productIdObj'] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ['$$row.commission', 0] },
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        _individualsCount: { $add: [1, '$_secondaryCount'] },
        _revenue: { $cond: [{ $and: ['$_paidSuccess', { $not: ['$_isCancelled'] }] }, { $ifNull: ['$payerAmount', 0] }, 0] },
        _vendorCost: { $cond: [{ $and: ['$_paidSuccess', { $not: ['$_isCancelled'] }] }, { $ifNull: ['$_baseVendorCost', 0] }, 0] },
        _agentCommission: { $cond: [{ $and: ['$_paidSuccess', { $not: ['$_isCancelled'] }] }, { $ifNull: ['$_baseAgentCommission', 0] }, 0] },
        _isFailedPayment: {
          $or: [
            { $eq: [{ $toLower: { $ifNull: ['$paymentStatus', ''] } }, 'pending'] },
            {
              $regexMatch: {
                input: { $toLower: { $ifNull: ['$paymentStatus', ''] } },
                regex: '(fail|cancel|declin|error|void|refund|denied|נכשל|בוטל)',
              },
            },
          ],
        },
        _providerName: { $ifNull: ['$_product.provider.vendorName', ''] },
        _isCardcomDeal: {
          $or: [
            { $gt: [{ $strLenCP: { $ifNull: ['$lowProfileCode', ''] } }, 0] },
            { $gt: [{ $strLenCP: { $ifNull: ['$cardcomAccountId', ''] } }, 0] },
            { $gt: [{ $strLenCP: { $ifNull: ['$indicator.internalDealNumber', ''] } }, 0] },
            {
              $and: [{ $ne: ['$cardcomRecurringId', null] }, { $ne: ['$cardcomRecurringId', ''] }],
            },
          ],
        },
      },
    },
    {
      $project: {
        transactionId: 1,
        dashboardHandled: 1,
        createdAt: 1,
        updatedAt: 1,
        cancellationDate: 1,
        status: 1,
        subscriptionStatus: 1,
        isActive: 1,
        agentId: {
          $cond: [
            { $ifNull: ['$_agentIdObj', false] },
            { $toString: '$_agentIdObj' },
            '',
          ],
        },
        paymentStatus: 1,
        payerAmount: 1,
        formState: 1,
        beneficiaryUpdate: 1,
        organizationId: 1,
        organizationName: '$_orgName',
        productName: { $ifNull: ['$_product.productName', { $ifNull: ['$_product.name', '$formState.productName'] }] },
        providerCost: '$_vendorCost',
        agentCommission: '$_agentCommission',
        revenue: '$_revenue',
        netProfit: { $subtract: [{ $subtract: ['$_revenue', '$_vendorCost'] }, '$_agentCommission'] },
        individualsCount: '$_individualsCount',
        isPaidSuccess: '$_paidSuccess',
        isCancelled: '$_isCancelled',
        isFailedPayment: '$_isFailedPayment',
        isCardcomDeal: '$_isCardcomDeal',
        lowProfileCode: 1,
        cardcomAccountId: 1,
        cardcomRecurringId: 1,
        parentDealId: 1,
        isRecurringCycle: 1,
        indicator: 1,
        cardcomInternalDealNumber: '$indicator.internalDealNumber',
      },
    },
  ]).toArray();

  const isDateInRange = (value) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return false;
    return dt >= from && dt <= to;
  };
  const isCancelledDeal = (d) => isCancelledByBusinessRule(d);
  const cancellationEventDate = (d) => d.cancellationDate || d.updatedAt || d.createdAt;
  const isActiveDeal = (d) => d.isActive !== false && !isCancelledDeal(d) && d.isRecurringCycle !== true;

  const createdRangeDeals = deals.filter((d) => isDateInRange(d.createdAt));
  const cancelledByEventDate = deals.filter((d) => isCancelledDeal(d) && isDateInRange(cancellationEventDate(d)));

  const statusFilteredCreatedDeals =
    activityStatus === 'active'
      ? createdRangeDeals.filter((d) => isActiveDeal(d))
      : activityStatus === 'cancelled'
        ? []
      : createdRangeDeals;
  const statusFilteredCancelledDeals =
    activityStatus === 'cancelled'
      ? cancelledByEventDate
      : activityStatus === 'active'
        ? []
        : cancelledByEventDate;

  // Summary cards are always computed from full selected range (independent of status filter).
  const paidRows = createdRangeDeals.filter((d) => d.isPaidSuccess && !isCancelledDeal(d));
  // ספירות 4-מצבים (מחושב מכלל העסקאות, לא רק הטווח)
  const pendingCancellationRows = deals.filter((d) => {
    const sub = String(d.subscriptionStatus || '').toLowerCase();
    return (sub.includes('pending') && sub.includes('cancel')) && !isCancelledDeal(d);
  });
  const notActivatedRows = deals.filter((d) => {
    const sub = String(d.subscriptionStatus || '');
    const wf = String(d.status || '').toLowerCase();
    return (
      sub === 'ממתין לאישור הארגון' ||
      wf === 'pending_org_approval' ||
      wf === 'pending_allow' ||
      wf === 'pending_alllow'
    ) && !isCancelledDeal(d);
  });
  const cashTotals = await getCashFinancialTotalsForDateRange(from, to);
  const totalRevenue = Number(cashTotals.totalRevenue || 0);
  const totalProviderPayments = Number(cashTotals.totalVendorCost || 0);
  const totalAgentPayments = Number(cashTotals.totalAgentCommission || 0);
  const totalExpenses = totalProviderPayments + totalAgentPayments;
  const totalNetProfit = Number(cashTotals.totalNetProfit || 0);
  const activeSubscribers = paidRows.reduce((s, d) => s + Number(d.individualsCount || 1), 0);
  const totalTransactions = Number(cashTotals.eventCount || 0);
  const failedPaymentRows = createdRangeDeals.filter((d) => {
    const ps = String(d.paymentStatus || '').toLowerCase();
    const isCancelled = ps.includes('cancel') || ps.includes('בוטל') || ps === 'cancelled';
    const isError = /fail|declin|error|denied|נכשל/i.test(String(d.paymentStatus || ''));
    const hasCardcom =
      d.isCardcomDeal ||
      (d.cardcomRecurringId != null && String(d.cardcomRecurringId).trim() !== '');
    return hasCardcom && isError && !isCancelled;
  });
  const cancelledCustomerRows = cancelledByEventDate;

  const pendingBeneficiaryRows = createdRangeDeals.filter((d) => {
    if (!d.isPaidSuccess || d.isCancelled) return false;
    const pm = d.formState?.primaryMember || d.beneficiaryUpdate?.primaryMember || {};
    const idNum = String(pm.id || d.formState?.id || '').trim();
    const dob = String(pm.dateOfBirth || d.formState?.dateOfBirth || '').trim();
    const submittedAt = d.beneficiaryUpdate?.submittedAt;
    const submitted = !!(submittedAt && !Number.isNaN(new Date(submittedAt).getTime()));
    return !submitted || !idNum || !dob;
  });

  const abandonedCartRowsAll = await db
    .collection('pending_checkout_leads')
    .find({ status: 'awaiting_payment', isActive: { $ne: false } })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();
  const abandonedCartRows = abandonedCartRowsAll.filter((d) => d.isHandled !== true);

  const contactLeadsAll = await db
    .collection('contactLeads')
    .aggregate([
      { $match: { isActive: { $ne: false } } },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: 'landing_pages',
          let: { ls: { $toLower: { $trim: { input: { $ifNull: ['$landingSlug', ''] } } } } },
          pipeline: [
            { $match: { $expr: { $and: [{ $ne: ['$$ls', ''] }, { $eq: [{ $toLower: '$slug' }, '$$ls'] }] } } },
            { $project: { _id: 0, pageTitle: 1, isActive: 1 } },
            { $limit: 1 },
          ],
          as: '_lp',
        },
      },
      {
        $set: {
          landingPageTitle: { $ifNull: [{ $arrayElemAt: ['$_lp.pageTitle', 0] }, ''] },
          isLandingActive: { $arrayElemAt: ['$_lp.isActive', 0] },
        },
      },
      { $project: { _lp: 0 } },
    ])
    .toArray();
  const orgLeadsAll = await db
    .collection('organizationLeads')
    .find({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  const contactTaskRows = [
    ...contactLeadsAll
      .filter((d) => d.isHandled !== true)
      .map((d) => ({
        id: String(d._id || ''),
        kind: 'private',
        fullName: d.name || '—',
        phone: d.phone || '—',
        email: d.email || '—',
        message: d.message || '',
        source: d.source || '',
        landingSlug: d.landingSlug || '',
        landingPageTitle: d.landingPageTitle || '',
        isLandingActive: d.isLandingActive ?? null,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        leadStatus: d.leadStatus || 'חדש',
        adminNotes: d.adminNotes || '',
        isHandled: !!d.isHandled,
      })),
    ...orgLeadsAll
      .filter((d) => d.isHandled !== true)
      .map((d) => ({
        id: String(d._id || ''),
        kind: 'corporate',
        fullName: d.contactName || d.organizationName || '—',
        organizationName: d.organizationName || '',
        organizationId: String(d.organizationId || ''),
        phone: d.phone || '—',
        email: d.email || '—',
        message: d.message || d.notes || '',
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        leadStatus: d.leadStatus || 'חדש',
        adminNotes: d.adminNotes || '',
        isHandled: !!d.isHandled,
      })),
  ];

  const orgDebtRows = await db.collection('organizations').aggregate([
    { $match: { billingType: 'Centralized', isActive: { $ne: false } } },
    {
      $lookup: {
        from: 'deals',
        let: { oid: { $toString: '$_id' } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$organizationId', '$$oid'] },
              createdAt: { $gte: from, $lte: to },
              paymentStatus: { $regex: /success|paid|test_success/i },
              subscriptionStatus: { $ne: 'Cancelled' },
            },
          },
          { $count: 'activeEmployees' },
        ],
        as: '_active',
      },
    },
    {
      $addFields: {
        activeEmployees: { $ifNull: [{ $arrayElemAt: ['$_active.activeEmployees', 0] }, 0] },
        memberPrice: { $ifNull: ['$monthlyPricePerMember', 0] },
      },
    },
    {
      $project: {
        organizationId: { $toString: '$_id' },
        organizationName: '$companyName',
        activeEmployees: 1,
        memberPrice: 1,
        collectionStatus: { $ifNull: ['$collectionStatus', 'open'] },
        debt: { $multiply: ['$activeEmployees', '$memberPrice'] },
      },
    },
    { $match: { debt: { $gt: 0 } } },
    { $sort: { debt: -1 } },
  ]).toArray();
  const organizationCollectionsDebt = orgDebtRows.reduce((s, r) => s + Number(r.debt || 0), 0);

  const dayMap = new Map();
  for (const d of paidRows) {
    const day = new Date(d.createdAt);
    if (Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    const prev = dayMap.get(key) || { date: key, revenue: 0, netProfit: 0, count: 0 };
    prev.revenue += Number(d.revenue || 0);
    prev.netProfit += Number(d.netProfit || 0);
    prev.count += 1;
    dayMap.set(key, prev);
  }
  const chartSeries = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
  }));
  const cancellationCountByDay = {};
  const cancellationRevenueByDay = {};
  let totalCancellationRevenue = 0;
  const totalCancellations = statusFilteredCancelledDeals.length;
  for (const d of statusFilteredCancelledDeals) {
    totalCancellationRevenue += Number(d.payerAmount || 0);
    const eventDateRaw = d.cancellationDate || d.updatedAt || d.createdAt;
    const dt = new Date(eventDateRaw);
    if (Number.isNaN(dt.getTime())) continue;
    const key = dt.toISOString().slice(0, 10);
    cancellationCountByDay[key] = Number(cancellationCountByDay[key] || 0) + 1;
    const amount = Number(d.payerAmount || 0);
    cancellationRevenueByDay[key] = Number(cancellationRevenueByDay[key] || 0) + amount;
  }
  const baseIncomeChartRows = statusFilteredCreatedDeals.filter((d) => d.isPaidSuccess && !isCancelledDeal(d));
  const dayMapForChart = new Map();
  for (const d of baseIncomeChartRows) {
    const day = new Date(d.createdAt);
    if (Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    const prev = dayMapForChart.get(key) || { date: key, revenue: 0, netProfit: 0, count: 0 };
    prev.revenue += Number(d.revenue || 0);
    prev.netProfit += Number(d.netProfit || 0);
    prev.count += 1;
    dayMapForChart.set(key, prev);
  }
  const filteredIncomeChartSeries = [...dayMapForChart.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
  }));

  const chartDays = new Set(filteredIncomeChartSeries.map((r) => r.date));
  Object.keys(cancellationCountByDay).forEach((d) => chartDays.add(d));
  const chartSeriesWithCancellations = Array.from(chartDays)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const base = filteredIncomeChartSeries.find((r) => r.date === date) || { date, revenue: 0, netProfit: 0, count: 0 };
      return {
        ...base,
        cancellations: Number(cancellationCountByDay[date] || 0),
        cancellationRevenue: Number(cancellationRevenueByDay[date] || 0),
        label: new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
      };
    });

  console.log('[getControlPanelOverviewData] cancellation totals', {
    totalCancellations,
    cancelledCustomerRowsLength: statusFilteredCancelledDeals.length,
  });

  return {
    range: { fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) },
    overview: {
      totalRevenue,
      successfulRevenue: totalRevenue,
      totalExpenses,
      totalNetProfit,
      activeSubscribers,
      totalTransactions,
      totalProviderPayments,
      totalAgentPayments,
      failedPayments: failedPaymentRows.length,
      pendingBeneficiaries: pendingBeneficiaryRows.length,
      abandonedCarts: abandonedCartRows.length,
      contactTasks: contactTaskRows.length,
      organizationCollectionsDebt,
      cashBasedSummary: true,
      initialDealCashCount: Number(cashTotals.initialDealCount || 0),
      recurringCashEventCount: Number(cashTotals.recurringEventCount || 0),
      cancellationsCount: statusFilteredCancelledDeals.length,
      pendingCancellationCount: pendingCancellationRows.length,
      notActivatedCount: notActivatedRows.length,
      chartSeries: chartSeriesWithCancellations,
      totalCancellationRevenue,
      totalCancellations,
    },
    drilldowns: {
      activeSubscribers: paidRows.map((d) => ({
        id: String(d._id || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        individualsCount: Number(d.individualsCount || 1),
        createdAt: d.createdAt,
      })),
      totalTransactions: paidRows.map((d) => ({
        id: String(d._id || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        amount: Number(d.revenue || 0),
        createdAt: d.createdAt,
      })),
      totalProviderPayments: paidRows.map((d) => ({
        transactionId: d.transactionId || '',
        productName: d.productName || '—',
        providerCost: Number(d.providerCost || 0),
        createdAt: d.createdAt,
      })),
      totalAgentPayments: paidRows.map((d) => ({
        agentId: String(d.formState?.agentId || d.agentId || ''),
        agentName: String(d.formState?.agentName || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        agentCommission: Number(d.agentCommission || 0),
        createdAt: d.createdAt,
      })),
      failedPayments: failedPaymentRows.map((d) => {
        const pid = String(d.parentDealId || '').trim();
        const isCycle = d.isRecurringCycle === true;
        const subscriberDealId =
          isCycle && pid && ObjectId.isValid(pid) ? pid : String(d._id || '');
        return {
          id: String(d._id || ''),
          subscriberDealId,
          orderId: d.transactionId || '',
          price: Number(d.payerAmount || 0),
          chargeDate: String(d.billingMonth || '').trim() || (d.createdAt ? new Date(d.createdAt).toISOString() : ''),
          cardcomStatus: String(
            d?.indicator?.responsdescription || d?.formState?.cardcomResponseDescription || d.paymentStatus || '—'
          ),
          customerName: d.formState?.fullName || '—',
          phoneNumber: d.formState?.phone || '—',
          cardcomRecurringId: String(d.cardcomRecurringId || ''),
          comments: String(d.formState?.failedPaymentComment || ''),
        };
      }),
      pendingCancellationCount: pendingCancellationRows.map((d) => ({
        id: String(d._id || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        phone: d.formState?.phone || '—',
        cancellationDate: d.cancellationDate || d.updatedAt || d.createdAt,
        finalBillingMonth: String(d.finalBillingMonth || '').trim(),
        subscriptionStatus: String(d.subscriptionStatus || ''),
      })),
      notActivatedCount: notActivatedRows.map((d) => ({
        id: String(d._id || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        phone: d.formState?.phone || '—',
        status: String(d.status || ''),
        subscriptionStatus: String(d.subscriptionStatus || ''),
        createdAt: d.createdAt,
      })),
      cancelledCustomers: statusFilteredCancelledDeals.map((d) => ({
        id: String(d._id || ''),
        orderId: d.transactionId || '',
        customerName: d.formState?.fullName || '—',
        phoneNumber: d.formState?.phone || '—',
        cardcomRecurringId: String(d.cardcomRecurringId || ''),
        cancellationDate: d.cancellationDate || d.updatedAt || d.createdAt,
        status: String(d.subscriptionStatus || d.status || d.paymentStatus || 'cancelled'),
      })),
      pendingBeneficiaries: pendingBeneficiaryRows.map((d) => ({
        id: String(d._id || ''),
        transactionId: d.transactionId || '',
        fullName: d.formState?.fullName || '—',
        phone: d.formState?.phone || '—',
        amount: Number(d.payerAmount || 0),
        createdAt: d.createdAt,
      })),
      abandonedCarts: abandonedCartRows.map((d) => ({
        id: String(d._id || ''),
        name: d.name || '—',
        phone: d.phone || '—',
        email: d.email || '—',
        productName: d.productName || '',
        landingSlug: d.landingSlug || '',
        landingPageTitle: d.landingPageTitle || '',
        message: d.message || '',
        leadStatus: d.leadStatus || 'חדש',
        adminNotes: d.adminNotes || '',
        isHandled: !!d.isHandled,
        updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
      })),
      contactTasks: contactTaskRows,
      organizationCollectionsDebt: orgDebtRows.map((r) => ({
        organizationId: r.organizationId || '',
        organizationName: r.organizationName || '—',
        activeEmployees: Number(r.activeEmployees || 0),
        memberPrice: Number(r.memberPrice || 0),
        collectionStatus: r.collectionStatus || 'open',
        debt: Number(r.debt || 0),
      })),
      totalNetProfit: paidRows.map((d) => ({
        transactionId: d.transactionId || '',
        revenue: Number(d.revenue || 0),
        providerCost: Number(d.providerCost || 0),
        agentCommission: Number(d.agentCommission || 0),
        netProfit: Number(d.netProfit || 0),
        createdAt: d.createdAt,
      })),
    },
  };
}

export async function getAlertsSummary(filters = {}) {
  const data = await getControlPanelOverviewData(filters);
  const failed = Array.isArray(data?.drilldowns?.failedPayments) ? data.drilldowns.failedPayments : [];
  const pendingBeneficiaries = Array.isArray(data?.drilldowns?.pendingBeneficiaries)
    ? data.drilldowns.pendingBeneficiaries
    : [];
  const orgDebt = Array.isArray(data?.drilldowns?.organizationCollectionsDebt)
    ? data.drilldowns.organizationCollectionsDebt
    : [];
  const contactTasks = Array.isArray(data?.drilldowns?.contactTasks) ? data.drilldowns.contactTasks : [];
  const orgPending = contactTasks.filter((x) => String(x.kind || '').toLowerCase() === 'corporate');
  return {
    contactTasks: contactTasks.length,
    orgPendingApproval: orgPending.length,
    pendingBeneficiaries: pendingBeneficiaries.length,
    paymentArrears: failed.length,
    organizationsToBill: orgDebt.length,
  };
}

export async function markControlPanelItemHandled(type, id, handled = true) {
  const db = await getDb();
  const t = String(type || '').trim();
  const val = handled === true;
  if (!t || !id) throw new Error('פרטי טיפול חסרים');

  if (t === 'failedPayment' || t === 'pendingBeneficiary') {
    let oid;
    try {
      oid = new ObjectId(String(id));
    } catch {
      throw new Error('מזהה עסקה לא תקין');
    }
    const path = t === 'failedPayment' ? 'dashboardHandled.failedPayment' : 'dashboardHandled.pendingBeneficiary';
    const r = await db.collection('deals').updateOne(
      { _id: oid },
      { $set: { [path]: val, updatedAt: new Date() } }
    );
    if (!r.matchedCount) throw new Error('עסקה לא נמצאה');
    return { ok: true };
  }

  if (t === 'abandonedCart') {
    let oid;
    try {
      oid = new ObjectId(String(id));
    } catch {
      throw new Error('מזהה ליד לא תקין');
    }
    const r = await db.collection('pending_checkout_leads').updateOne(
      { _id: oid },
      { $set: { isHandled: val, updatedAt: new Date() } }
    );
    if (!r.matchedCount) throw new Error('ליד לא נמצא');
    return { ok: true };
  }

  if (t === 'contactLead') {
    let oid;
    try {
      oid = new ObjectId(String(id));
    } catch {
      throw new Error('מזהה ליד לא תקין');
    }
    const r = await db.collection('contactLeads').updateOne(
      { _id: oid },
      { $set: { isHandled: val, updatedAt: new Date() } }
    );
    if (!r.matchedCount) throw new Error('ליד לא נמצא');
    return { ok: true };
  }

  throw new Error('סוג טיפול לא נתמך');
}

export async function updateContactHubItem(kind, id, params = {}) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה לא תקין');
  }
  const k = String(kind || '').trim();
  const set = { updatedAt: new Date() };
  if (params.leadStatus != null) set.leadStatus = String(params.leadStatus || '').trim();
  if (params.adminNotes != null) set.adminNotes = String(params.adminNotes || '');
  if (params.isHandled != null) set.isHandled = !!params.isHandled;
  if (params.isActive != null) set.isActive = !!params.isActive;
  if (k === 'private') {
    const r = await db.collection('contactLeads').updateOne({ _id: oid }, { $set: set });
    if (!r.matchedCount) throw new Error('ליד לא נמצא');
    return { ok: true };
  }
  if (k === 'corporate') {
    const r = await db.collection('organizationLeads').updateOne({ _id: oid }, { $set: set });
    if (!r.matchedCount) throw new Error('ליד לא נמצא');
    return { ok: true };
  }
  if (k === 'abandoned') {
    const r = await db.collection('pending_checkout_leads').updateOne({ _id: oid }, { $set: set });
    if (!r.matchedCount) throw new Error('עגלה לא נמצאה');
    return { ok: true };
  }
  throw new Error('סוג רשומה לא נתמך');
}

export async function updateDealAdmin(dealId, body = {}) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }
  const existing = await deals.findOne({ _id: oid });
  if (!existing) throw new Error('עסקה לא נמצאה');

  const incomingFs = body.formState && typeof body.formState === 'object' ? { ...body.formState } : {};
  delete incomingFs.subscriptionStartDate;
  const fs = { ...(existing.formState || {}), ...incomingFs };
  const set = {
    formState: fs,
    updatedAt: new Date(),
  };
  if (body.beneficiaryUpdate && typeof body.beneficiaryUpdate === 'object') {
    const existingBU = existing.beneficiaryUpdate && typeof existing.beneficiaryUpdate === 'object'
      ? existing.beneficiaryUpdate
      : {};
    const incomingBU = body.beneficiaryUpdate;
    const mergedPrimary = {
      ...(existingBU.primaryMember && typeof existingBU.primaryMember === 'object' ? existingBU.primaryMember : {}),
      ...(incomingBU.primaryMember && typeof incomingBU.primaryMember === 'object' ? incomingBU.primaryMember : {}),
    };
    const now = new Date();
    const primaryFirst = String(mergedPrimary.firstName || '').trim();
    const primaryLast = String(mergedPrimary.lastName || '').trim();
    const primaryId = String(mergedPrimary.id || '').trim();
    const primaryDateOfBirth = String(mergedPrimary.dateOfBirth || '').trim();
    const primaryGender = String(mergedPrimary.gender || '').trim();
    const primaryPhone = String(mergedPrimary.phone || '').trim();
    const primaryEmail = String(mergedPrimary.email || '').trim();
    const primaryAddress = String(mergedPrimary.address || '').trim();
    const primaryMaritalStatus = String(mergedPrimary.maritalStatus || '').trim();
    const primaryHealthFund = String(mergedPrimary.healthFund || '').trim();
    const primarySupplementalInsurance = String(mergedPrimary.supplementalInsurance || '').trim();
    const isBeneficiaryCompletion =
      Boolean(primaryFirst) &&
      Boolean(primaryLast) &&
      Boolean(primaryId) &&
      Boolean(primaryDateOfBirth) &&
      Boolean(primaryGender) &&
      Boolean(primaryPhone) &&
      Boolean(primaryEmail) &&
      Boolean(primaryAddress) &&
      Boolean(primaryMaritalStatus) &&
      Boolean(primaryHealthFund) &&
      Boolean(primarySupplementalInsurance);

    set.beneficiaryUpdate = {
      ...existingBU,
      ...incomingBU,
      primaryMember: mergedPrimary,
      // Admin beneficiary completion must behave like customer link completion.
      ...(isBeneficiaryCompletion
        ? { submittedAt: existingBU.submittedAt || now }
        : {}),
    };

    if (isBeneficiaryCompletion) {
      fs.subscriptionStartDate = now.toISOString().slice(0, 10);
      const incomingAdditional = Array.isArray(incomingBU.additionalMembers)
        ? incomingBU.additionalMembers
        : [];
      fs.beneficiaryCount = incomingAdditional.length;
    }
  }
  if (body.payerAmount != null && body.payerAmount !== '') set.payerAmount = Number(body.payerAmount);
  if (body.paymentStatus != null && String(body.paymentStatus).trim() !== '') set.paymentStatus = String(body.paymentStatus).trim();

  try {
    const { resolveCheckoutEconomics } = await import('./adminMongooseService.js');
    const econ = await resolveCheckoutEconomics(fs);
    set.commissionAmount = Number(econ.resolvedAgentCommission ?? 0);
    fs.resolvedVendorCost = econ.resolvedVendorCost;
    fs.resolvedAgentCommission = econ.resolvedAgentCommission;
    fs.resolvedNetProfit = econ.resolvedNetProfit;
    if (econ.productName && !fs.productName) fs.productName = econ.productName;
    set.formState = fs;
  } catch {
    set.commissionAmount = Number(
      fs.resolvedAgentCommission ?? existing.commissionAmount ?? 0
    );
  }

  if (existing.billingMonth && String(existing.billingMonth).trim()) {
    set.billingMonth = String(existing.billingMonth).trim();
  } else {
    set.billingMonth = formatBillingMonthFromDate(existing.createdAt || new Date());
  }

  await deals.updateOne({ _id: oid }, { $set: set });
  return { success: true };
}

export async function getDealForRecurringCancellation(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }

  const existing = await deals.findOne(
    { _id: oid },
    {
      projection: {
        lowProfileCode: 1,
        terminalNumber: 1,
        cardcomAccountId: 1,
        cardcomRecurringId: 1,
        'indicator.internalDealNumber': 1,
      },
    }
  );
  if (!existing) throw new Error('עסקה לא נמצאה');

  return {
    id: String(existing._id),
    lowProfileCode: String(existing.lowProfileCode || '').trim(),
    terminalNumber: Number(existing.terminalNumber || 0),
    internalDealNumber: String(existing?.indicator?.internalDealNumber || '').trim(),
    cardcomAccountId: String(existing.cardcomAccountId || '').trim(),
    cardcomRecurringId: String(existing.cardcomRecurringId || '').trim(),
  };
}

export async function markDealCancelledByAdmin(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }

  const cancellationDate = new Date();
  const r = await deals.updateOne(
    { _id: oid },
    {
      $set: {
        subscriptionStatus: 'Cancelled',
        status: 'Cancelled',
        paymentStatus: 'Cancelled',
        cancellationDate,
        updatedAt: cancellationDate,
      },
    }
  );
  if (!r.matchedCount) throw new Error('עסקה לא נמצאה');
  return { success: true, cancellationDate: cancellationDate.toISOString(), status: 'Cancelled' };
}

/**
 * ביטול הוראת קבע בקארדקום — נשארים ב"ממתין לביטול" עד תאריך החיוב הבא (שירות בתוקף).
 */
export async function markDealPrivateRecurringPendingEnd(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }
  const existing = await deals.findOne(
    { _id: oid },
    { projection: { formState: 1, isActive: 1 } }
  );
  if (!existing) throw new Error('עסקה לא נמצאה');
  if (existing.isActive === false) throw new Error('לא ניתן לבטל מנוי לעסקה בארכיון');

  const now = new Date();
  const fsData = existing.formState && typeof existing.formState === 'object' ? existing.formState : {};

  // B2C end-date: primary = cardcomNextDateToBill, fallback = subscriptionStartDate + 1 month exact.
  // Explicitly avoids 1st-of-month (B2B logic).
  const nextDateToBill = parseFlexibleDate(fsData.cardcomNextDateToBill);
  const subscriptionStartDate = parseFlexibleDate(fsData.subscriptionStartDate);

  let endDate = nextDateToBill; // primary source

  if (!endDate && subscriptionStartDate) {
    // fallback: exact 1 month from subscription start date
    const d = new Date(subscriptionStartDate);
    d.setMonth(d.getMonth() + 1);
    if (!Number.isNaN(d.getTime())) endDate = d;
  }

  if (!endDate || Number.isNaN(endDate.getTime())) {
    // last resort (both fields missing): exact 1 month from today — B2C style, not B2B 1st-of-month
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    endDate = d;
  }

  const endDateIso = endDate.toISOString();

  const r = await deals.updateOne(
    { _id: oid },
    {
      $set: {
        subscriptionStatus: 'Pending Cancellation',
        cancellationDate: now,
        cancelAt: endDate,
        subscriptionEndDate: endDate,
        updatedAt: now,
        'formState.cardcomRecurringIsActive': false,
        'formState.cardcomNextDateToBill': endDateIso,
      },
    }
  );
  if (!r.matchedCount) throw new Error('עסקה לא נמצאה');
  return {
    success: true,
    cancellationDate: now.toISOString(),
    cardcomNextDateToBill: endDateIso,
    cancelAt: endDateIso,
    subscriptionEndDate: endDateIso,
    status: 'Pending Cancellation',
  };
}

/** עדכון שדות snapshot מה-webhook של קארדקום (MasterRecurring) על העסקה הראשית */
export async function updateDealCardcomRecurringSnapshot(dealId, snapshot = {}) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }
  const set = { updatedAt: new Date() };

  const incomingIsActive = snapshot.cardcomRecurringIsActive;
  if (incomingIsActive != null) {
    set['formState.cardcomRecurringIsActive'] = !!incomingIsActive;
  }

  if (snapshot.cardcomNextDateToBill != null) {
    const incomingDate = String(snapshot.cardcomNextDateToBill).trim();
    // הגנה על תאריך חלון הזכאות (Grace Period) של B2C:
    // כאשר Cardcom מדווח על הפסקת הוראת קבע ושולח תאריך ריק —
    // אין לדרוס את cardcomNextDateToBill הקיים, כי הוא משמש כתאריך סיום הזכאות.
    if (!(incomingIsActive === false && incomingDate === '')) {
      set['formState.cardcomNextDateToBill'] = incomingDate;
    }
  }

  if (snapshot.cardcomCreateDate != null) {
    set['formState.cardcomCreateDate'] = String(snapshot.cardcomCreateDate);
  }
  if (snapshot.cardcomLastProcessDate != null) {
    set['formState.cardcomLastProcessDate'] = String(snapshot.cardcomLastProcessDate);
  }
  if (Object.keys(set).length <= 1) return { success: true, skipped: true };
  await deals.updateOne({ _id: oid }, { $set: set });
  return { success: true };
}

/**
 * ביטול מדורג לעובד ארגוני בתשלום מרוכז — Pending Cancellation.
 * מחושב אוטומטית: finalBillingMonth = החודש הנוכחי, cancelAt = ה-1 לחודש הבא.
 */
export async function markDealPendingCancellation(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try { oid = new ObjectId(String(dealId)); } catch { throw new Error('מזהה עסקה לא תקין'); }

  const existing = await deals.findOne(
    { _id: oid },
    { projection: { isCentralized: 1, source: 1, formState: 1, status: 1, subscriptionStatus: 1, isActive: 1 } }
  );
  if (!existing) throw new Error('עסקה לא נמצאה');
  if (existing.isActive === false) {
    throw new Error('לא ניתן לבטל מנוי לעסקה בארכיון');
  }

  const isCentralized =
    existing.isCentralized === true ||
    String(existing.source || '') === 'org-bulk-import' ||
    String(existing.source || '') === 'org-self-register' ||
    String(existing.formState?.paymentMethod || '') === 'centralized' ||
    String(existing.formState?.organizationPaymentMethod || '') === 'centralized';

  if (!isCentralized) {
    throw new Error('ביטול מדורג שייך לעובדים ארגוניים בתשלום מרוכז בלבד');
  }

  const workflowStatus = String(existing.status || '').trim().toLowerCase();
  const subscriptionNorm = String(existing.subscriptionStatus || '').trim().toLowerCase();
  const allowedWorkflow = new Set(['active', 'completed']);
  const okForCancellation =
    allowedWorkflow.has(workflowStatus) ||
    allowedWorkflow.has(subscriptionNorm);
  if (!okForCancellation) {
    throw new Error(
      'לא ניתן לבטל — המנוי אינו במצב פעיל/הושלם (למשל ממתין לאישור ארגון). ניתן להעביר לארכיון במקום.'
    );
  }

  const now = new Date();
  const finalBillingMonth = formatBillingMonthFromDate(now);
  // 1st of next calendar month — the date the employee is no longer counted in billing
  const cancelAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const r = await deals.updateOne(
    { _id: oid },
    {
      $set: {
        subscriptionStatus: 'Pending Cancellation',
        finalBillingMonth,
        cancelAt,
        subscriptionEndDate: cancelAt,
        cancellationDate: now,
        updatedAt: now,
      },
    }
  );
  if (!r.matchedCount) throw new Error('עסקה לא נמצאה');
  return {
    success: true,
    finalBillingMonth,
    cancelAt: cancelAt.toISOString(),
    subscriptionEndDate: cancelAt.toISOString(),
    status: 'Pending Cancellation',
  };
}

/**
 * Snapshot חודשי לארגונים — ריצה ב-1 לחודש.
 * snapshotDateStr: "YYYY-MM-DD" (ברירת מחדל: היום).
 * מחשב כמה עובדים פעילים לכל ארגון ומעדכן monthly_invoices.
 * עובד נספר אם: paymentMethod===centralized, subscriptionStatus !== 'Cancelled',
 *   ו-finalBillingMonth (אם קיים) >= snapshotMonth.
 */
export async function runMonthlyOrgSnapshot(snapshotDateStr) {
  const snapshotDate = snapshotDateStr ? new Date(snapshotDateStr) : new Date();
  if (Number.isNaN(snapshotDate.getTime())) throw new Error('תאריך snapshot לא תקין');
  const snapshotMonth = formatBillingMonthFromDate(snapshotDate); // "YYYY-MM"

  const db = await getDb();
  const deals = db.collection('deals');

  // שלוף עסקאות מרוכזות שלא בוטלו לחלוטין
  const candidates = await deals.find({
    subscriptionStatus: { $nin: ['Cancelled'] },
    $or: [
      { 'formState.paymentMethod': 'centralized' },
      { 'formState.organizationPaymentMethod': 'centralized' },
      { source: 'org-bulk-import' },
    ],
  }).project({
    _id: 1,
    subscriptionStatus: 1,
    finalBillingMonth: 1,
    organizationId: 1,
    'formState.organizationId': 1,
    'formState.organizationName': 1,
    organizationName: 1,
    payerAmount: 1,
    'formState.resolvedVendorCost': 1,
    'formState.monthlyPricePerMember': 1,
  }).limit(50000).toArray();

  // קבץ לפי ארגון — ספור רק עובדים שעוד פעילים ב-snapshotMonth
  const orgMap = new Map();
  for (const d of candidates) {
    const fbm = String(d.finalBillingMonth || '').trim();
    // אם יש finalBillingMonth ו-finalBillingMonth < snapshotMonth → לא פעיל
    if (fbm && fbm < snapshotMonth) continue;

    const orgId = String(d.organizationId || d.formState?.organizationId || '').trim();
    const orgName = String(d.organizationName || d.formState?.organizationName || '').trim();
    if (!orgId) continue;

    if (!orgMap.has(orgId)) {
      orgMap.set(orgId, {
        organizationId: orgId,
        organizationName: orgName,
        employeeCount: 0,
        totalRevenue: 0,
        totalVendorCost: 0,
        employees: [],
      });
    }
    const g = orgMap.get(orgId);
    g.employeeCount += 1;
    const unitRevenue = Number(d.formState?.monthlyPricePerMember || d.payerAmount || 0);
    const unitCost = Number(d.formState?.resolvedVendorCost || 0);
    g.totalRevenue += unitRevenue;
    g.totalVendorCost += unitCost;
    g.employees.push({ dealId: String(d._id), revenue: unitRevenue, vendorCost: unitCost });
  }

  const now = new Date();
  let upsertCount = 0;
  for (const g of orgMap.values()) {
    if (!g.organizationId) continue;
    const legacyByName = g.organizationName
      ? await db.collection('monthly_invoices').findOne(
          { organizationName: g.organizationName, month: snapshotMonth },
          { projection: { _id: 1 } }
        )
      : null;
    const upsertFilter = legacyByName?._id
      ? { _id: legacyByName._id }
      : { organizationId: g.organizationId, month: snapshotMonth };
    await db.collection('monthly_invoices').updateOne(
      upsertFilter,
      {
        $set: {
          organizationName: g.organizationName,
          organizationId: g.organizationId,
          month: snapshotMonth,
          dealCount: g.employeeCount,
          totalAmount: g.totalRevenue,
          totalVendorCost: g.totalVendorCost,
          totalNetProfit: g.totalRevenue - g.totalVendorCost,
          snapshotDate: snapshotDate,
          updatedAt: now,
        },
        $setOnInsert: {
          status: 'Pending',
          invoiceNumber: '',
          receiptNumber: '',
          notes: '',
          createdAt: now,
        },
      },
      { upsert: true }
    );
    upsertCount += 1;
  }

  return { ok: true, snapshotMonth, organizationCount: upsertCount, totalEmployees: candidates.length };
}

export async function deleteDealAdmin(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
  }
  const deal = await deals.findOne({ _id: oid }, { projection: { _id: 1, subscriptionStatus: 1, status: 1, isActive: 1, cardcomRecurringId: 1, paymentStatus: 1, indicator: 1, formState: 1 } });
  if (!deal) throw new Error('עסקה לא נמצאה');
  if (!canArchiveDealAdmin(deal)) {
    throw new Error(
      "לא ניתן להעביר לארכיון עובד שנמצא בתהליך ביטול (יבוטל ב-1 לחודש). רק לאחר שהסטטוס ישתנה ל-'מבוטל' ניתן יהיה להעבירו לארכיון."
    );
  }
  const r = await deals.updateOne({ _id: oid }, { $set: { isActive: false, updatedAt: new Date() } });
  if (r.matchedCount === 0) throw new Error('עסקה לא נמצאה');
  return { success: true };
}

export async function bulkDeleteDealsAdmin(dealIds = []) {
  const db = await getDb();
  const ids = Array.isArray(dealIds) ? dealIds : [];
  const objectIds = ids
    .map((id) => {
      try {
        return new ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!objectIds.length) return { requested: 0, deleted: 0 };
  const cancellableDeals = await db
    .collection('deals')
    .find(
      { _id: { $in: objectIds } },
      { projection: { _id: 1, subscriptionStatus: 1, status: 1, isActive: 1, cardcomRecurringId: 1, paymentStatus: 1, indicator: 1, formState: 1 } }
    )
    .toArray();
  const allowedIds = cancellableDeals.filter((d) => canArchiveDealAdmin(d)).map((d) => d._id);
  const r = await db.collection('deals').updateMany(
    { _id: { $in: allowedIds } },
    { $set: { isActive: false, updatedAt: new Date() } }
  );
  return {
    requested: objectIds.length,
    deleted: Number(r.modifiedCount || 0),
  };
}

function parseMonthToRange(monthStr) {
  const s = String(monthStr || '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 1);
  return { start, end, label: s };
}

/** עסקאות שנוצרו בטווח תאריכים (לדוח מפעיל) */
export async function findDealsCreatedInRange(fromDate, toDate) {
  const db = await getDb();
  const match = {};
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) {
      const f = new Date(fromDate);
      if (!Number.isNaN(f.getTime())) match.createdAt.$gte = f;
    }
    if (toDate) {
      const t = new Date(toDate);
      if (!Number.isNaN(t.getTime())) {
        t.setHours(23, 59, 59, 999);
        match.createdAt.$lte = t;
      }
    }
  }
  return db
    .collection('deals')
    .find(Object.keys(match).length ? match : {})
    .sort({ createdAt: -1 })
    .limit(10000)
    .toArray();
}

/** עסקאות מבוטלות — סינון לפי cancellationDate או updatedAt */
export async function findDealsCancelledInRange(fromDate, toDate) {
  const db = await getDb();
  const docs = await db
    .collection('deals')
    .find({
      $or: [
        { subscriptionStatus: { $regex: 'cancel', $options: 'i' } },
        { paymentStatus: { $regex: 'cancel|בוטל', $options: 'i' } },
      ],
    })
    .sort({ cancellationDate: -1, updatedAt: -1 })
    .limit(10000)
    .toArray();

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);

  return docs.filter((d) => {
    if (!isCancelledByBusinessRule(d)) return false;
    const cd = d.cancellationDate ? new Date(d.cancellationDate) : null;
    const ref =
      cd && !Number.isNaN(cd.getTime())
        ? cd
        : d.updatedAt instanceof Date
          ? d.updatedAt
          : new Date(d.updatedAt || d.createdAt || 0);
    if (Number.isNaN(ref.getTime())) return false;
    if (from && !Number.isNaN(from.getTime()) && ref < from) return false;
    if (to && !Number.isNaN(to.getTime()) && ref > to) return false;
    return true;
  });
}

/** עסקאות של סוכן בחודש נתון (לפי createdAt) */
export async function findDealsByAgentAndMonth(agentId, monthStr) {
  const range = parseMonthToRange(monthStr);
  if (!range) return [];
  const db = await getDb();
  const aid = String(agentId || '').trim();
  const or = [{ agentId: aid }, { 'formState.agentId': aid }];
  if (ObjectId.isValid(aid)) {
    try {
      const oid = new ObjectId(aid);
      or.push({ agentId: oid });
      or.push({ 'formState.agentId': oid });
    } catch {
      /* ignore */
    }
  }
  return db
    .collection('deals')
    .find({
      $and: [{ $or: or }, { createdAt: { $gte: range.start, $lt: range.end } }],
    })
    .sort({ createdAt: -1 })
    .limit(2000)
    .toArray();
}

function buildAgentIdOrClauses(agentId) {
  const aid = String(agentId || '').trim();
  const or = [{ agentId: aid }, { 'formState.agentId': aid }];
  if (ObjectId.isValid(aid)) {
    try {
      const oid = new ObjectId(aid);
      or.push({ agentId: oid });
      or.push({ 'formState.agentId': oid });
    } catch {
      // ignore
    }
  }
  return { aid, or };
}

function monthLabelFromDate(dateValue) {
  const d = parseFlexibleDate(dateValue);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getAgentCommissionPreview(agentId, monthStr) {
  const month = String(monthStr || '').trim();
  if (!parseMonthToRange(month)) throw new Error('חודש לא תקין (נדרש YYYY-MM)');
  const db = await getDb();
  const { aid } = buildAgentIdOrClauses(agentId);
  if (!aid) throw new Error('מזהה סוכן חסר');

  const agent = await db.collection('sales_agents').findOne(
    ObjectId.isValid(aid) ? { _id: new ObjectId(aid) } : { _id: null },
    { projection: { agentName: 1, isActive: 1, deactivatedAt: 1 } }
  );
  if (!agent) throw new Error('סוכן לא נמצא');

  const deactivatedMonth = monthLabelFromDate(agent.deactivatedAt);
  const agentEligibleForMonth = !deactivatedMonth || month <= deactivatedMonth;
  if (!agentEligibleForMonth) {
    return {
      month,
      agent: {
        id: String(agent._id),
        agentName: String(agent.agentName || ''),
        isActive: agent.isActive !== false,
        deactivatedAt: agent.deactivatedAt instanceof Date ? agent.deactivatedAt.toISOString() : null,
      },
      summary: { totalCommissions: 0, activeDeals: 0, pendingPayouts: 0 },
      rows: [],
      note: 'הסוכן הועבר לארכיון לפני חודש הדוח שנבחר.',
    };
  }

  /** יומן עמלות לפי חיובים בפועל (DetailRecurring) */
  const ledgerDocs = await db
    .collection('agent_commission_ledger')
    .find({
      agentId: aid,
      billingMonth: month,
      $or: [{ locked: false }, { locked: { $exists: false } }],
    })
    .sort({ lastBillDate: 1 })
    .toArray();

  let rows = [];
  const previewSource = 'cash_billing';

  if (ledgerDocs.length > 0) {
    const dealIds = [...new Set(ledgerDocs.map((l) => l.dealId).filter(Boolean))];
    const dealsMap = new Map();
    if (dealIds.length) {
      const oids = dealIds.filter((id) => ObjectId.isValid(String(id))).map((id) => new ObjectId(String(id)));
      if (oids.length) {
        const drs = await db
          .collection('deals')
          .find({ _id: { $in: oids } })
          .project({
            formState: 1,
            transactionId: 1,
            source: 1,
            subscriptionEndDate: 1,
            cancelAt: 1,
            cancellationDate: 1,
            paymentStatus: 1,
          })
          .toArray();
        for (const dr of drs) dealsMap.set(String(dr._id), dr);
      }
    }

    rows = ledgerDocs.map((L) => {
      const d = dealsMap.get(String(L.dealId)) || {};
      const fs = d?.formState && typeof d.formState === 'object' ? d.formState : {};
      const ent = getEntitlementStatus(d);
      const lastBill =
        L.lastBillDate instanceof Date ? L.lastBillDate.toISOString() : L.lastBillDate || '';
      return {
        ledgerEntryId: String(L._id),
        dealId: String(L.dealId),
        transactionId: String(L.transactionId || d.transactionId || ''),
        employeeName: String(fs.fullName || '').trim() || '—',
        idNumber: String(fs.id || '').trim() || '—',
        provider: String(fs.providerName || fs.vendorName || '').trim(),
        productName: String(fs.productName || '').trim(),
        billingType:
          String(fs.paymentMethod || fs.organizationPaymentMethod || '').toLowerCase() === 'centralized' ||
          String(d.source || '') === 'org-bulk-import'
            ? 'Centralized'
            : 'Private',
        entitlementStatus: ent.status,
        subscriptionStartDate: fs.subscriptionStartDate || '',
        cancellationDate: d.cancellationDate
          ? (d.cancellationDate instanceof Date ? d.cancellationDate.toISOString() : String(d.cancellationDate))
          : null,
        subscriptionEndDate: d.subscriptionEndDate
          ? (d.subscriptionEndDate instanceof Date ? d.subscriptionEndDate.toISOString() : String(d.subscriptionEndDate))
          : null,
        subscriptionEndDateRaw: d.subscriptionEndDate || d.cancelAt || fs.cardcomNextDateToBill || null,
        amount: Number(L.agentCommission || 0),
        actualBillingAmount: Number(L.actualAmount || 0),
        vendorCostSnapshot: Number(L.vendorCost || 0),
        netProfitSnapshot: Number(L.netProfit || 0),
        rowId: String(L.rowId || ''),
        lastBillDate: lastBill,
        paymentStatus: String(d.paymentStatus || ''),
        billingMonth: month,
      };
    });
  }

  const snapshots = await db
    .collection('agent_commission_snapshots')
    .find({ agentId: String(agent._id), month })
    .project({ totalAmount: 1, status: 1 })
    .toArray();
  const pendingPayouts = snapshots
    .filter((s) => String(s.status || 'Pending') !== 'Paid')
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  return {
    month,
    previewSource,
    agent: {
      id: String(agent._id),
      agentName: String(agent.agentName || ''),
      isActive: agent.isActive !== false,
      deactivatedAt: agent.deactivatedAt instanceof Date ? agent.deactivatedAt.toISOString() : null,
    },
    summary: {
      totalCommissions: rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      activeDeals: rows.length,
      pendingPayouts,
    },
    rows,
    ...(rows.length === 0
      ? {
          note:
            'אין רשומות עמלה לחודש זה. העמלה מחושבת רק מחיובים בפועל (תשלום ראשון ואירועי DetailRecurring ביומן) — ללא שורות תיאורטיות לפי תאריכי מנוי.',
        }
      : {}),
  };
}

export async function lockAgentCommissionsSnapshot(agentId, monthStr, entryIds = null) {
  const preview = await getAgentCommissionPreview(agentId, monthStr);
  let rows = Array.isArray(preview.rows) ? preview.rows : [];
  if (Array.isArray(entryIds) && entryIds.length > 0) {
    const idSet = new Set(entryIds.map((x) => String(x)));
    rows = rows.filter((r) => r.ledgerEntryId && idSet.has(String(r.ledgerEntryId)));
    if (!rows.length) throw new Error('לא נבחרו רשומות תואמות לנעילה (נדרש ledgerEntryId)');
  }

  const totalCommissions = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const db = await getDb();
  const now = new Date();
  const snapshot = {
    agentId: String(preview.agent.id),
    agentName: String(preview.agent.agentName || ''),
    month: preview.month,
    totalAmount: Number(totalCommissions || 0),
    totalDeals: Number(rows.length || 0),
    rows,
    status: 'Pending',
    invoiceNum: '',
    invoiceAmount: 0,
    creditNoteNum: '',
    creditNoteAmount: 0,
    totalPaid: 0,
    balance: Number(totalCommissions || 0),
    notes: '',
    previewSource: preview.previewSource || '',
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('agent_commission_snapshots').insertOne(snapshot);
  const snapId = String(result.insertedId);

  const ledgerOids = rows
    .map((r) => r.ledgerEntryId)
    .filter(Boolean)
    .map((id) => {
      try {
        return new ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (ledgerOids.length) {
    await db.collection('agent_commission_ledger').updateMany(
      { _id: { $in: ledgerOids } },
      { $set: { locked: true, snapshotId: snapId, updatedAt: now } }
    );
  }

  return { success: true, snapshotId: snapId, ...snapshot };
}

export async function listAgentCommissionSnapshots(agentId, limit = 100) {
  const db = await getDb();
  const aid = String(agentId || '').trim();
  const docs = await db
    .collection('agent_commission_snapshots')
    .find({ agentId: aid })
    .sort({ month: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)))
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    agentId: String(d.agentId || ''),
    agentName: String(d.agentName || ''),
    month: String(d.month || ''),
    totalAmount: Number(d.totalAmount || 0),
    totalDeals: Number(d.totalDeals || 0),
    status: String(d.status || 'Pending'),
    invoiceNum: String(d.invoiceNum || ''),
    invoiceAmount: Number(d.invoiceAmount || 0),
    creditNoteNum: String(d.creditNoteNum || ''),
    creditNoteAmount: Number(d.creditNoteAmount || 0),
    totalPaid: Number(d.totalPaid || 0),
    balance: Number(
      d.balance != null
        ? d.balance
        : (Number(d.totalAmount || 0) - Number(d.totalPaid || 0))
    ),
    notes: String(d.notes || ''),
    rows: Array.isArray(d.rows) ? d.rows : [],
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  }));
}

export async function listAllAgentCommissionSnapshots(limit = 500, agentId = '') {
  const db = await getDb();
  const aid = String(agentId || '').trim();
  const query = aid ? { agentId: aid } : {};
  const docs = await db
    .collection('agent_commission_snapshots')
    .find(query)
    .sort({ month: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 500, 2000)))
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    agentId: String(d.agentId || ''),
    agentName: String(d.agentName || ''),
    month: String(d.month || ''),
    totalAmount: Number(d.totalAmount || 0),
    totalDeals: Number(d.totalDeals || 0),
    status: String(d.status || 'Pending'),
    invoiceNum: String(d.invoiceNum || ''),
    invoiceAmount: Number(d.invoiceAmount || 0),
    creditNoteNum: String(d.creditNoteNum || ''),
    creditNoteAmount: Number(d.creditNoteAmount || 0),
    totalPaid: Number(d.totalPaid || 0),
    balance: Number(
      d.balance != null
        ? d.balance
        : (Number(d.totalAmount || 0) - Number(d.totalPaid || 0))
    ),
    notes: String(d.notes || ''),
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  }));
}

export async function updateAgentCommissionSnapshot(agentId, snapshotId, patch = {}) {
  const db = await getDb();
  let sid;
  try {
    sid = new ObjectId(String(snapshotId));
  } catch {
    throw new Error('מזהה snapshot לא תקין');
  }
  const aid = String(agentId || '').trim();
  const existing = await db.collection('agent_commission_snapshots').findOne(
    { _id: sid, agentId: aid },
    { projection: { totalAmount: 1 } }
  );
  if (!existing) throw new Error('Snapshot לא נמצא');

  const set = { updatedAt: new Date() };
  if (patch.status != null) set.status = String(patch.status || 'Pending');
  if (patch.notes != null) set.notes = String(patch.notes || '');
  if (patch.invoiceNum != null) set.invoiceNum = String(patch.invoiceNum || '');
  if (patch.invoiceAmount != null) set.invoiceAmount = Number(patch.invoiceAmount || 0);
  if (patch.creditNoteNum != null) set.creditNoteNum = String(patch.creditNoteNum || '');
  if (patch.creditNoteAmount != null) set.creditNoteAmount = Number(patch.creditNoteAmount || 0);
  if (patch.totalPaid != null) set.totalPaid = Math.max(0, Number(patch.totalPaid || 0));

  const totalPaidNext = set.totalPaid != null ? Number(set.totalPaid || 0) : 0;
  set.balance = Number(existing.totalAmount || 0) - totalPaidNext;

  const r = await db.collection('agent_commission_snapshots').updateOne({ _id: sid, agentId: aid }, { $set: set });
  if (!r.matchedCount) throw new Error('Snapshot לא נמצא');
  return { success: true };
}

export async function hasUnlockedAgentCommissionsForMonth(agentId, monthStr) {
  const db = await getDb();
  const aid = String(agentId || '').trim();
  const month = String(monthStr || '').trim();
  if (!aid || !month) return false;
  const hit = await db.collection('agent_commission_snapshots').findOne(
    { agentId: aid, month, status: { $ne: 'Paid' } },
    { projection: { _id: 1 } }
  );
  if (hit) return true;
  const ledgerOpen = await db.collection('agent_commission_ledger').countDocuments({
    agentId: aid,
    billingMonth: month,
    $or: [{ locked: false }, { locked: { $exists: false } }],
  });
  return ledgerOpen > 0;
}

export async function listMonthlyInvoices(limit = 300, monthFilter = null) {
  const db = await getDb();
  const mf = String(monthFilter || '').trim();
  const query = mf && /^\d{4}-\d{2}$/.test(mf) ? { month: mf } : {};
  const docs = await db
    .collection('monthly_invoices')
    .find(query)
    .sort({ month: -1, organizationName: 1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => {
    const { _id, ...rest } = d;
    return {
      id: String(_id),
      ...rest,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    };
  });
}

/**
 * קיבוץ עסקאות תשלום מרוכז לפי ארגון לחודש — יוצר/מעדכן monthly_invoices
 */
export async function generateMonthlyInvoicesForMonth(monthStr) {
  const target = String(monthStr || '').trim();
  const range = parseMonthToRange(target);
  if (!range) throw new Error('חודש לא תקין (נדרש YYYY-MM)');

  const db = await getDb();
  const deals = await db
    .collection('deals')
    .find({
      billingMonth: target,
      paymentStatus: { $regex: /success|paid|test_success/i },
      subscriptionStatus: { $ne: 'Cancelled' },
    })
    .limit(20000)
    .toArray();

  const groups = new Map();
  for (const d of deals) {
    const e = enrichDeal(d);
    const orgId = String(d.organizationId || d.formState?.organizationId || '').trim();
    const orgName = String(e.organizationName || '').trim();
    if (e.paymentMethod !== 'centralized' || !orgId) continue;
    if (!groups.has(orgId)) groups.set(orgId, { organizationId: orgId, organizationName: orgName, totalAmount: 0, dealCount: 0 });
    const g = groups.get(orgId);
    g.totalAmount += Number(d.payerAmount || 0);
    g.dealCount += 1;
    if (!g.organizationName && orgName) g.organizationName = orgName;
  }

  const orgsCentralized = await getOrganizationCompaniesWithMemberCounts(500);
  for (const o of orgsCentralized) {
    if (o.billingType !== 'Centralized') continue;
    if (Number(o.activeMemberCount || 0) <= 0) continue;
    const orgId = String(o.id || '').trim();
    const name = String(o.companyName || '').trim();
    if (!orgId || !name) continue;
    if (!groups.has(orgId)) groups.set(orgId, { organizationId: orgId, organizationName: name, totalAmount: 0, dealCount: 0 });
  }

  const now = new Date();
  for (const g of groups.values()) {
    const legacyByName = g.organizationName
      ? await db.collection('monthly_invoices').findOne(
          { organizationName: g.organizationName, month: target },
          { projection: { _id: 1 } }
        )
      : null;
    const upsertFilter = legacyByName?._id
      ? { _id: legacyByName._id }
      : { organizationId: g.organizationId, month: target };
    await db.collection('monthly_invoices').updateOne(
      upsertFilter,
      {
        $set: {
          organizationId: g.organizationId,
          organizationName: g.organizationName,
          month: target,
          totalAmount: g.totalAmount,
          dealCount: g.dealCount,
          updatedAt: now,
        },
        $setOnInsert: {
          status: 'Pending',
          invoiceNumber: '',
          receiptNumber: '',
          notes: '',
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  return { ok: true, month: target, organizationCount: groups.size };
}

export async function updateMonthlyInvoice(invoiceId, body = {}) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(invoiceId));
  } catch {
    throw new Error('מזהה חשבונית לא תקין');
  }
  const set = { updatedAt: new Date() };
  if (body.invoiceNumber != null) set.invoiceNumber = String(body.invoiceNumber);
  if (body.receiptNumber != null) set.receiptNumber = String(body.receiptNumber);
  if (body.notes != null) set.notes = String(body.notes);
  if (body.status === 'Paid' || body.status === 'Pending') set.status = body.status;
  const r = await db.collection('monthly_invoices').updateOne({ _id: oid }, { $set: set });
  if (!r.matchedCount) throw new Error('רשומה לא נמצאה');
  return { ok: true };
}

/* ─── Provider Applications ─────────────────────────────────────────────── */

export async function saveNotification(params = {}) {
  const db = await getDb();
  const now = new Date();
  await db.collection('notifications').insertOne({
    title:     String(params.title     || '').trim(),
    type:      String(params.type      || 'general').trim(),
    actionUrl: String(params.actionUrl || '').trim(),
    isRead:    false,
    createdAt: now,
  });
}

export async function saveProviderApplication(params = {}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection('providers').insertOne({
    companyName:     String(params.companyName     || '').trim(),
    companyId:       String(params.companyId       || '').trim(),
    officialAddress: String(params.officialAddress || '').trim(),
    companyEmail:    String(params.companyEmail    || '').trim(),
    contactPerson: {
      name:   String(params.contactPerson?.name   || '').trim(),
      role:   String(params.contactPerson?.role   || '').trim(),
      phone:  String(params.contactPerson?.phone  || '').trim(),
      mobile: String(params.contactPerson?.mobile || '').trim(),
      email:  String(params.contactPerson?.email  || '').trim(),
    },
    fieldOfActivity: String(params.fieldOfActivity || '').trim(),
    message:         String(params.message         || '').trim(),
    status:    'pending',
    source:    'provider_join_request',
    isActive:  true,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId) };
}

export async function listProviderApplications() {
  const db = await getDb();
  const docs = await db
    .collection('providers')
    .find({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  return docs.map((d) => ({
    id:              String(d._id),
    companyName:     d.companyName     || '',
    companyId:       d.companyId       || '',
    officialAddress: d.officialAddress || '',
    companyEmail:    d.companyEmail    || '',
    contactPerson:   d.contactPerson   || {},
    fieldOfActivity: d.fieldOfActivity || '',
    message:         d.message         || '',
    status:          d.status          || 'pending',
    createdAt:       d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
  }));
}

export async function getProviderApplicationById(id) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ספק לא תקין');
  }
  const doc = await db.collection('providers').findOne({ _id: oid });
  if (!doc) return null;
  return {
    id:              String(doc._id),
    companyName:     doc.companyName     || '',
    companyId:       doc.companyId       || '',
    officialAddress: doc.officialAddress || '',
    companyEmail:    doc.companyEmail    || '',
    contactPerson:   doc.contactPerson   || {},
    fieldOfActivity: doc.fieldOfActivity || '',
    message:         doc.message         || '',
    status:          doc.status          || 'pending',
  };
}

export async function approveProviderApplication(id) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ספק לא תקין');
  }
  const r = await db.collection('providers').updateOne(
    { _id: oid },
    { $set: { status: 'approved', updatedAt: new Date() } }
  );
  if (!r.matchedCount) throw new Error('ספק לא נמצא');
  return { ok: true };
}
