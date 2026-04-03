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

export async function saveDeal(params) {
  const db = await getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');

  const deals = db.collection('deals');
  const exists = await deals.findOne({ transactionId }, { projection: { _id: 1 } });
  if (exists) return { duplicate: true, id: String(exists._id) };

  const now = new Date();
  const fs = params.formState && typeof params.formState === 'object' ? params.formState : {};
  const agentIdRaw = params.agentId != null ? params.agentId : fs.agentId;
  const agentId =
    agentIdRaw != null && String(agentIdRaw).trim() !== '' ? String(agentIdRaw).trim() : null;

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
    formState: params.formState || {},
    /** מזהה סוכן (מנוי) — לספירת מכירות לפי סוכן */
    agentId,
    terminalNumber: Number(params.terminalNumber || 0),
    paymentStatus: params.paymentStatus || 'success',
    source: params.source || 'webhook',
    indicator: params.indicator || null,
    normalizedPayload: params.normalizedPayload || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await deals.insertOne(doc);
  return { duplicate: false, id: String(result.insertedId) };
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
        'formState.maritalStatus': String(primary.maritalStatus || '').trim(),
        'formState.healthFund': String(primary.healthFund || '').trim(),
        'formState.supplementalInsurance': String(primary.supplementalInsurance || '').trim(),
        'formState.phone': String(primary.phone || '').trim(),
        'formState.email': String(primary.email || '').trim(),
        'formState.address': String(primary.address || '').trim(),
        'formState.beneficiaries': normalizedBeneficiaries,
        'formState.beneficiaryCount': normalizedBeneficiaries.length,
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
  if (!phone && !email) return { deleted: 0 };
  const r = await db.collection('contactLeads').deleteMany({
    source: 'abandoned_checkout',
    phone,
    email,
    landingSlug,
  });
  return { deleted: Number(r.deletedCount || 0) };
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
  const result = await db.collection('organizations').insertOne({
    companyName: params.companyName || '',
    companyId: params.companyId || '',
    officialAddress: params.officialAddress || '',
    companyEmail: params.companyEmail || '',
    fieldOfActivity: params.fieldOfActivity || '',
    employeesCount: Number(params.employeesCount || 0),
    billingMethod: params.billingMethod || '',
    contactPerson: params.contactPerson || null,
    accounting: params.accounting || null,
    additionalContact: params.additionalContact || null,
    source: params.source || 'admin',
    status: params.status || 'active',
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(result.insertedId) };
}

export async function getOrganizationCompanies(limit = 300) {
  const db = await getDb();
  const docs = await db.collection('organizations').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(serializeDocDates);
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
  if (params.contactPerson != null) set.contactPerson = params.contactPerson || null;
  if (params.accounting != null) set.accounting = params.accounting || null;
  if (params.additionalContact != null) set.additionalContact = params.additionalContact || null;
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
  const r = await db.collection('organizations').deleteOne({ _id: oid });
  if (!r.deletedCount) throw new Error('ארגון לא נמצא');
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
  const r = await db.collection(col).updateOne({ _id: oid }, { $set: set });
  if (!r.matchedCount) throw new Error('ליד לא נמצא');
  return { ok: true };
}

export async function getDeals() {
  const db = await getDb();
  const docs = await db.collection('deals').find({}).sort({ createdAt: -1 }).limit(500).toArray();
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
    paymentStatus: { $regex: /success|paid|test_success/i },
    subscriptionStatus: { $ne: 'Cancelled' },
  });
}

function serializeDocDates(doc) {
  const out = { ...doc, id: String(doc._id) };
  delete out._id;
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  return out;
}

/** B2C contact form leads */
export async function getContactLeads(limit = 200) {
  const db = await getDb();
  const docs = await db
    .collection('contactLeads')
    .aggregate([
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
  const docs = await db.collection('organizationLeads').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(serializeDocDates);
}

/** Deals with failed / problematic payment (פיגור תשלום / כשלון) */
/** עסקאות ששולמו ועדיין לא הוגש טופס מוטבים */
export async function getDealsPendingBeneficiaryCompletion(limit = 150) {
  const db = await getDb();
  const docs = await db
    .collection('deals')
    .find({
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
  const agentName = String(d?.formState?.agentName || '').trim();
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

  const match = {};
  const dateRange = getDateRange(filters);
  if (dateRange) match.createdAt = dateRange;

  if (filters.providerEnabled && filters.providerValue) {
    match.provider = String(filters.providerValue).trim();
  }
  if (filters.agentEnabled && filters.agentValue) {
    match['formState.agentName'] = String(filters.agentValue).trim();
  }
  if (filters.organizationSearch) {
    match['formState.organizationName'] = { $regex: String(filters.organizationSearch).trim(), $options: 'i' };
  }
  if (filters.customerSearch) {
    match.fullTextCustomer = { $regex: String(filters.customerSearch).trim(), $options: 'i' };
  }
  if (filters.idSearch) {
    match.$or = [
      { 'formState.id': { $regex: String(filters.idSearch).trim(), $options: 'i' } },
      { 'formState.beneficiaries.id': { $regex: String(filters.idSearch).trim(), $options: 'i' } },
    ];
  }
  if (filters.productNameSearch) {
    match['formState.productName'] = { $regex: String(filters.productNameSearch).trim(), $options: 'i' };
  }
  if (filters.agentNameSearch) {
    match['formState.agentName'] = { $regex: String(filters.agentNameSearch).trim(), $options: 'i' };
  }

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
  const enriched = baseDeals.map(enrichDeal);
  const shown = applyCategoryFilters(enriched, filters.summaryCategories);

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
      providers: [...new Set(enriched.map((d) => d.provider).filter(Boolean))],
      agents: [...new Set(enriched.map((d) => d.agentName).filter(Boolean))],
    },
    rows: shown.slice(0, 500).map((d) => {
      const e = economicsFromDeal(d);
      const cancellationDateRaw = d.cancellationDate instanceof Date ? d.cancellationDate : (d.cancellationDate ? new Date(d.cancellationDate) : null);
      return {
        id: String(d._id),
        transactionId: d.transactionId || '',
        status: d.isCanceled ? 'canceled' : 'paid',
        paymentStatus: d.paymentStatus || '',
        subscriptionStatus: String(d.subscriptionStatus || ''),
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
        provider: d.provider || '',
        agentName: d.agentName || '',
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
        beneficiarySubmitted: !!d.beneficiarySubmitted,
        pendingBeneficiaryCompletion: !!d.pendingBeneficiaryCompletion,
        completionStatus: d.completionStatus || '—',
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
    if (!e.isCanceled) {
      totalRevenue += Number(d.payerAmount || 0);
      totalNetProfit += econ.netProfit;
      paidDealsCount += 1;
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
    canceledDeals: canceledDealsCount,
    pendingPayments,
    totalDealsInDb: docs.length,
    newLeads7d: newContactLeads + newOrgLeads,
    chartSeries: Array.from(chartBuckets.values()),
  };
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

  const fs = { ...(existing.formState || {}), ...(body.formState && typeof body.formState === 'object' ? body.formState : {}) };
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
    set.beneficiaryUpdate = {
      ...existingBU,
      ...incomingBU,
      primaryMember: mergedPrimary,
      submittedAt: existingBU.submittedAt || new Date(),
    };
  }
  if (body.payerAmount != null && body.payerAmount !== '') set.payerAmount = Number(body.payerAmount);
  if (body.paymentStatus != null && String(body.paymentStatus).trim() !== '') set.paymentStatus = String(body.paymentStatus).trim();

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
  const r = await deals.deleteOne({ _id: oid });
  if (r.deletedCount === 0) throw new Error('עסקה לא נמצאה');
  return { success: true };
}
