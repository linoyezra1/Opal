import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || '';
const DB_NAME = process.env.MONGO_DB_NAME || 'opal';

let clientPromise = null;

function getClient() {
  if (!MONGO_URL) {
    throw new Error('MONGO_URL is not set');
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
  const doc = {
    transactionId,
    payerAmount: Number(params.payerAmount || 0),
    formState: params.formState || {},
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

export async function saveBeneficiaryUpdate(params) {
  const db = await getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');

  const deals = db.collection('deals');
  const now = new Date();
  await deals.updateOne(
    { transactionId },
    {
      $set: {
        transactionId,
        beneficiaryUpdate: {
          transactionId,
          organizationName: params.organizationName || '',
          agentName: params.agentName || '',
          primaryMember: params.primaryMember || {},
          additionalMembers: params.additionalMembers || [],
          submittedAt: now,
        },
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
  const result = await db.collection('contactLeads').insertOne({
    name: params.name || '',
    email: params.email || '',
    phone: params.phone || '',
    message: params.message || '',
    createdAt: new Date(),
  });
  return { id: String(result.insertedId) };
}

export async function saveOrganizationLead(params) {
  const db = await getDb();
  const result = await db.collection('organizationLeads').insertOne({
    organizationName: params.organizationName || '',
    contactName: params.contactName || '',
    phone: params.phone || '',
    email: params.email || '',
    notes: params.notes || '',
    createdAt: new Date(),
  });
  return { id: String(result.insertedId) };
}

export async function getDeals() {
  const db = await getDb();
  const docs = await db.collection('deals').find({}).sort({ createdAt: -1 }).limit(500).toArray();
  return docs.map((d) => ({
    id: String(d._id),
    ...d,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
    beneficiarySubmittedAt:
      d.beneficiaryUpdate?.submittedAt instanceof Date ? d.beneficiaryUpdate.submittedAt.toISOString() : null,
  }));
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
  const docs = await db.collection('contactLeads').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(serializeDocDates);
}

/** B2B / corporate contact leads */
export async function getOrganizationLeads(limit = 200) {
  const db = await getDb();
  const docs = await db.collection('organizationLeads').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(serializeDocDates);
}

/** Deals with failed / problematic payment (פיגור תשלום / כשלון) */
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
  const orgName = String(d?.formState?.organizationName || '').trim();
  const isCanceled = /cancel|fail|error|declin|void|refund|בוטל|נכשל/i.test(String(d?.paymentStatus || ''));
  const provider = d?.provider || 'Cardcom';
  const agentName = String(d?.formState?.agentName || '').trim();
  return {
    ...d,
    provider,
    agentName,
    organizationName: orgName,
    primaryCount,
    secondaryCount,
    activeCustomersCount: primaryCount + secondaryCount,
    isCanceled,
    isPrivateOrg: !orgName,
    isCentralizedOrg: !!orgName,
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
  const totalPrimary = shown.reduce((sum, d) => sum + Number(d.primaryCount || 0), 0);
  const totalSecondary = shown.reduce((sum, d) => sum + Number(d.secondaryCount || 0), 0);
  const totalActive = shown.reduce((sum, d) => sum + Number(d.activeCustomersCount || 0), 0);
  const totalCanceled = shown.filter((d) => d.isCanceled).length;
  const totalPrivateOrg = shown.filter((d) => d.isPrivateOrg).length;
  const totalCentralizedOrg = shown.filter((d) => d.isCentralizedOrg).length;
  const totalCentralizedCanceled = shown.filter((d) => d.isCentralizedOrg && d.isCanceled).length;

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
      totalProfit: totalRevenue - amountDue,
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
    rows: shown.slice(0, 500).map((d) => ({
      id: String(d._id),
      transactionId: d.transactionId || '',
      status: d.isCanceled ? 'canceled' : 'paid',
      paymentStatus: d.paymentStatus || '',
      fullName: d.formState?.fullName || '',
      idNumber: d.formState?.id || '',
      organizationName: d.organizationName || '',
      provider: d.provider || '',
      agentName: d.agentName || '',
      planType: d.formState?.selectedPlanId || '',
      amount: Number(d.payerAmount || 0),
      primaryCount: d.primaryCount,
      secondaryCount: d.secondaryCount,
      activeCustomersCount: d.activeCustomersCount,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : null,
      raw: d,
    })),
  };
}
