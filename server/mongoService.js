import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URL || '';
const DB_NAME = process.env.MONGO_DB_NAME || 'opal';

let clientPromise = null;

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
  return client.db(DB_NAME);
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
  try {
    const { resolveCheckoutEconomics } = await import('./adminMongooseService.js');
    const econ = await resolveCheckoutEconomics(fs);
    commissionAmount = Number(econ.resolvedAgentCommission ?? commissionAmount);
    mergedFormState = {
      ...mergedFormState,
      resolvedVendorCost: econ.resolvedVendorCost,
      resolvedAgentCommission: econ.resolvedAgentCommission,
      resolvedNetProfit: econ.resolvedNetProfit,
    };
    if (econ.productName && !String(mergedFormState.productName || '').trim()) {
      mergedFormState.productName = econ.productName;
    }
  } catch {
    /* עסקה ללא מחירון מלא — נשאר מ־formState */
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
  const or = [];
  if (tid) or.push({ transactionId: tid });
  if (lowProfileCode) or.push({ lowProfileCode });
  if (recurringId) {
    const asNum = Number(recurringId);
    const idMatch =
      Number.isFinite(asNum) && !Number.isNaN(asNum) && String(asNum) === recurringId
        ? { cardcomRecurringId: { $in: [recurringId, asNum] } }
        : { cardcomRecurringId: recurringId };
    or.push(idMatch);
  }
  if (accountId) or.push({ cardcomAccountId: accountId });
  if (token) or.push({ cardcomToken: token });
  if (!or.length) return null;
  const rows = await deals
    .find({ $or: or, isActive: { $ne: false } })
    .sort({ createdAt: 1 })
    .limit(20)
    .toArray();
  if (!rows.length) return null;
  const primary = rows.find((d) => d.isRecurringCycle !== true) || rows[0];
  return {
    id: String(primary._id),
    transactionId: String(primary.transactionId || ''),
    formState: primary.formState && typeof primary.formState === 'object' ? primary.formState : {},
    payerAmount: Number(primary.payerAmount || 0),
    terminalNumber: Number(primary.terminalNumber || 0),
    agentId: primary.agentId ? String(primary.agentId) : null,
    source: String(primary.source || ''),
    cardcomRecurringId: String(primary.cardcomRecurringId || ''),
  };
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

  const recurringId = String(mainDeal.cardcomRecurringId || mainDeal.formState?.cardcomRecurringId || '').trim();
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
  const rows = docs.map((d) => {
    const month =
      String(d.billingMonth || '').trim() ||
      formatBillingMonthFromDate(d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt));
    const success = /success|paid|test_success|completed/i.test(String(d.paymentStatus || ''));
    const errorReason = String(d?.indicator?.responsdescription || d?.formState?.cardcomResponseDescription || '').trim();
    return {
      id: String(d._id),
      billingMonth: month,
      status: success ? 'הצלחה' : 'כישלון',
      paymentStatus: String(d.paymentStatus || ''),
      errorReason: errorReason || (success ? '—' : String(d.paymentStatus || '—')),
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      isRecurringCycle: d.isRecurringCycle === true,
    };
  });
  return {
    cardcomRecurringId: recurringId,
    rows,
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
    notes: params.notes || '',
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

export async function deleteOrganizationCompany(id) {
  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    throw new Error('מזהה ארגון לא תקין');
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
    subscriptionStatus: { $ne: 'Cancelled' },
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
  return docs.map((d) => ({
    id: String(d._id),
    transactionId: d.transactionId,
    payerAmount: d.payerAmount,
    paymentStatus: d.paymentStatus,
    subscriptionStatus: d.subscriptionStatus,
    status: d.status,
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
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    lowProfileCode: String(d.lowProfileCode || '').trim(),
    cardcomAccountId: String(d.cardcomAccountId || '').trim(),
    cardcomRecurringId: String(d.cardcomRecurringId || '').trim(),
    cardcomInternalDealNumber: String(d?.indicator?.internalDealNumber || '').trim(),
    cardcomResponseDescription: String(d?.indicator?.responsdescription || d?.formState?.cardcomResponseDescription || '').trim(),
    Lest4Numbers: String(d?.indicator?.Lest4Numbers || d?.formState?.lastFourDigits || '').trim(),
    MutagName: String(d?.indicator?.MutagName || d?.formState?.cardBrand || '').trim(),
    source: d.source,
  }));
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
    source: 'org-bulk-import',
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
  if (String(doc?.subscriptionStatus || '').toLowerCase() === 'cancelled') return true;
  return /cancel|fail|error|declin|void|refund|בוטל|נכשל/i.test(String(doc?.paymentStatus || ''));
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
  const fs = d?.formState && typeof d.formState === 'object' ? d.formState : {};
  const pm = String(fs.paymentMethod || fs.organizationPaymentMethod || '').toLowerCase();
  return pm === 'centralized' || String(d.source || '') === 'org-bulk-import';
}

function applyCategoryFilters(deals, categories = []) {
  if (!Array.isArray(categories) || !categories.length) return deals;
  const set = new Set(categories);
  return deals.filter((d) => {
    const checks = [];
    if (set.has('all')) checks.push(true);
    if (set.has('primary')) checks.push(d.primaryCount > 0);
    if (set.has('active')) checks.push(d.activeCustomersCount > 0);
    if (set.has('canceled')) checks.push(d.isCanceled);
    if (set.has('private_org')) checks.push(d.isPrivateOrg);
    if (set.has('centralized_org')) checks.push(d.isCentralizedOrg);
    if (set.has('centralized_canceled')) checks.push(d.isCentralizedOrg && d.isCanceled);
    return checks.some(Boolean);
  });
}

/** רווח נקי לפי שדות שנשמרו בעסקה: הכנסה - עלות ספק - עמלת סוכן */
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
  if (dateRange) match.createdAt = dateRange;

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
  if (andClauses.length) match.$and = andClauses;

  const pipeline = [
    {
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
    },
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: 1000 },
  ];

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
  let shown = applyCategoryFilters(enriched, filters.summaryCategories);
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
  const totalRevenue = shown.reduce((sum, d) => sum + Number(d.payerAmount || 0), 0);
  const econ = shown.map((d) => economicsFromDeal(d));
  const totalVendorCost = econ.reduce((s, e) => s + e.vendorCost, 0);
  const totalAgentCommission = econ.reduce((s, e) => s + e.agentCommission, 0);
  const totalNetProfitFromDeals = econ.reduce((s, e) => s + e.netProfit, 0);
  const completedDeals = shown.filter((d) => d.isCompleted);
  const canceledDeals = shown.filter((d) => d.isCanceled);
  const totalPrimary = completedDeals.length;
  const totalSecondary = shown.reduce((sum, d) => sum + Number(d.secondaryCount || 0), 0);
  const totalActive = completedDeals.reduce((sum, d) => sum + Number(d.individualsCount || 0), 0);
  const totalCanceled = canceledDeals.reduce((sum, d) => sum + Number(d.individualsCount || 0), 0);
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

  return {
    summary: {
      all: shown.length,
      primary: totalPrimary,
      active: totalActive,
      canceled: totalCanceled,
      private_org: totalPrivateOrg,
      centralized_org: totalCentralizedOrg,
      centralized_canceled: totalCentralizedCanceled,
      totalRevenue,
      totalExpenses: amountDue,
      /** legacy: הכנסות פחות "הוצאות ידניות" */
      totalProfit: totalRevenue - amountDue,
      totalVendorCost,
      totalAgentCommission,
      /** רווח אחרי עלות ספק ועמלת סוכן (מומלץ) */
      totalNetProfit: totalNetProfitFromDeals,
    },
    searchResults: {
      totalTransactions: shown.length,
      totalPrimary,
      totalSecondary,
      totalSalesAmount: totalRevenue,
    },
    filterOptions: {
      providers: vendorNames,
      agents: [...new Set(enriched.map((d) => d.agentName).filter(Boolean))],
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
  const isCancelledDeal = (d) => {
    const sub = String(d.subscriptionStatus || '').trim().toLowerCase();
    const st = String(d.status || '').trim().toLowerCase();
    const pay = String(d.paymentStatus || '').trim().toLowerCase();
    const recurringId = String(d.cardcomRecurringId || '').trim();
    const recurringStopped = d.isActive === false && recurringId !== '';
    const manuallyCancelled = /cancel|בוטל/i.test(sub) || /cancel|בוטל/i.test(st) || /cancel|בוטל/i.test(pay);
    return manuallyCancelled || recurringStopped;
  };
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
  const totalRevenue = paidRows.reduce((s, d) => s + Number(d.revenue || 0), 0);
  const totalProviderPayments = paidRows.reduce((s, d) => s + Number(d.providerCost || 0), 0);
  const totalAgentPayments = paidRows.reduce((s, d) => s + Number(d.agentCommission || 0), 0);
  const totalExpenses = totalProviderPayments + totalAgentPayments;
  const totalNetProfit = totalRevenue - totalProviderPayments - totalAgentPayments;
  const activeSubscribers = paidRows.reduce((s, d) => s + Number(d.individualsCount || 1), 0);
  const totalTransactions = paidRows.length;
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
    .find({ status: 'awaiting_payment', isActive: { $ne: false }, updatedAt: { $gte: from, $lte: to } })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray();
  const abandonedCartRows = abandonedCartRowsAll.filter((d) => d.isHandled !== true);

  const contactLeadsAll = await db
    .collection('contactLeads')
    .find({ isActive: { $ne: false }, createdAt: { $gte: from, $lte: to } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  const orgLeadsAll = await db
    .collection('organizationLeads')
    .find({ isActive: { $ne: false }, createdAt: { $gte: from, $lte: to } })
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
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
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
        comments: String(d.notes || d.adminNotes || ''),
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
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
  const totalRevenueWithOrgDebt = totalRevenue + organizationCollectionsDebt;

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
  let totalCancellations = 0;
  for (const d of statusFilteredCancelledDeals) {
    const eventDateRaw = d.cancellationDate || d.updatedAt || d.createdAt;
    const dt = new Date(eventDateRaw);
    if (Number.isNaN(dt.getTime())) continue;
    const key = dt.toISOString().slice(0, 10);
    cancellationCountByDay[key] = Number(cancellationCountByDay[key] || 0) + 1;
    const amount = Number(d.payerAmount || 0);
    cancellationRevenueByDay[key] = Number(cancellationRevenueByDay[key] || 0) + amount;
    totalCancellationRevenue += amount;
    totalCancellations += 1;
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
      totalRevenue: totalRevenueWithOrgDebt,
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
      cancellationsCount: statusFilteredCancelledDeals.length,
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
        productName: d.productName || '—',
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
    // Do not set submittedAt to "now" on admin edits — preserves completion / pending-docs state.
    set.beneficiaryUpdate = {
      ...existingBU,
      ...incomingBU,
      primaryMember: mergedPrimary,
    };
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

export async function deleteDealAdmin(dealId) {
  const db = await getDb();
  const deals = db.collection('deals');
  let oid;
  try {
    oid = new ObjectId(String(dealId));
  } catch {
    throw new Error('מזהה עסקה לא תקין');
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
  const r = await db.collection('deals').updateMany(
    { _id: { $in: objectIds } },
    { $set: { isActive: false, updatedAt: new Date() } }
  );
  return {
    requested: objectIds.length,
    deleted: Number(r.deletedCount || 0),
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
    if (e.paymentMethod !== 'centralized' || !String(e.organizationName || '').trim()) continue;
    const org = String(e.organizationName).trim();
    if (!groups.has(org)) groups.set(org, { organizationName: org, totalAmount: 0, dealCount: 0 });
    const g = groups.get(org);
    g.totalAmount += Number(d.payerAmount || 0);
    g.dealCount += 1;
  }

  const orgsCentralized = await getOrganizationCompaniesWithMemberCounts(500);
  for (const o of orgsCentralized) {
    if (o.billingType !== 'Centralized') continue;
    if (Number(o.activeMemberCount || 0) <= 0) continue;
    const name = String(o.companyName || '').trim();
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, { organizationName: name, totalAmount: 0, dealCount: 0 });
  }

  const now = new Date();
  for (const g of groups.values()) {
    await db.collection('monthly_invoices').updateOne(
      { organizationName: g.organizationName, month: target },
      {
        $set: {
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
