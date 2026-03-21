/**
 * Opal API – Cardcom checkout + webhook → MongoDB.
 * Requires: .env with CARDCOM_*, BASE_URL, MONGO_URL.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createLowProfileDeal, getLowProfileIndicator } from './cardcomService.js';
import {
  getDeals,
  getSalesDashboardData,
  saveBeneficiaryUpdate,
  saveContactLead,
  saveDeal,
  saveOrganizationLead,
  getContactLeads,
  getOrganizationLeads,
  getPaymentArrearsDeals,
} from './mongoService.js';
import {
  createAgent,
  createOrgPricingPolicy,
  createProduct,
  getPricingContextByPricingId,
  listAgents,
  listIncompleteCheckoutDrafts,
  listOrgPricingPolicies,
  listProducts,
  upsertCheckoutDraft,
} from './adminMongooseService.js';
import { resolve } from 'path';

try {
  dotenv.config();
} catch (e) {
  console.warn('Failed to load .env via dotenv:', e?.message || e);
}

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
/** Frontend app URL for post-payment redirect (Cardcom sends user here after success). */
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'OpalAdmin2026';
const ADMIN_TOKENS = new Map();

/** Precise timestamp for logging (HH:mm:ss.SSS) */
function ts() {
  const d = new Date();
  const hms = d.toTimeString().slice(0, 8);
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
}

function createAdminToken(username) {
  const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString('base64url');
  ADMIN_TOKENS.set(token, Date.now() + 12 * 60 * 60 * 1000);
  return token;
}

function isValidAdminToken(token) {
  const expiry = ADMIN_TOKENS.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    ADMIN_TOKENS.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !isValidAdminToken(token)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Cardcom may POST as form-urlencoded

const STATIC_DIR = resolve(process.cwd(), 'dist');
app.use(express.static(STATIC_DIR));

/** Plan id → amount in ILS (for payer row) */
const PLAN_AMOUNTS = {
  'plan-a': 59,
  'plan-b': 29,
  'plan-fg': 0,
};

/** Pending deals: lowProfileCode → { formState, payerAmount, createdAt } */
const pendingDeals = new Map();
const PENDING_TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanupPending() {
  const now = Date.now();
  for (const [code, data] of pendingDeals.entries()) {
    if (now - data.createdAt > PENDING_TTL_MS) pendingDeals.delete(code);
  }
}
setInterval(cleanupPending, 10 * 60 * 1000);

/** Build payload with safe fallbacks so missing metadata never crashes. */
function buildDealPayloadFromFormState(formState) {
  const fs = formState && typeof formState === 'object' ? formState : {};
  const planId = fs.selectedPlanId ?? '';
  const planSku = planId ? `MAKAT-${String(planId).replace('plan-', '').toUpperCase()}` : '';
  const payer = {
    fullName: fs.fullName ?? '',
    id: fs.id ?? '',
    email: fs.email ?? '',
    agentName: fs.agentName ?? '',
    organizationName: fs.organizationName ?? '',
    planId,
    planSku,
  };
  const beneficiaries = Array.isArray(fs.beneficiaries)
    ? fs.beneficiaries.map((b) => ({
        firstName: b?.firstName ?? '',
        lastName: b?.lastName ?? '',
        id: b?.id ?? '',
        dateOfBirth: b?.dateOfBirth ?? '',
      }))
    : [];
  return { payer, beneficiaries, raw: fs };
}

/**
 * POST /api/create-checkout-session
 * Body: { formState } (from frontend).
 * Returns: { url } to redirect user to Cardcom payment page.
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { formState } = req.body;
    if (!formState || !formState.selectedPlanId) {
      return res.status(400).json({
        success: false,
        error: 'Missing formState with selectedPlanId.',
      });
    }

    const terminal = parseInt(process.env.CARDCOM_TERMINAL, 10);
    const user = process.env.CARDCOM_USER;
    const pass = process.env.CARDCOM_PASS;
    if (!terminal || !user || !pass) {
      return res.status(500).json({
        success: false,
        error: 'Cardcom credentials not set (CARDCOM_TERMINAL, CARDCOM_USER, CARDCOM_PASS).',
      });
    }

    const payerAmount = PLAN_AMOUNTS[formState.selectedPlanId] ?? 0;

    const result = await createLowProfileDeal({
      terminalNumber: terminal,
      username: user,
      password: pass,
      sumToBill: payerAmount,
      successRedirectUrl: `${FRONTEND_URL}/success`,
      errorRedirectUrl: `${FRONTEND_URL}/error`,
      cancelRedirectUrl: `${FRONTEND_URL}/`,
      indicatorUrl: `${BASE_URL}/api/cardcom-webhook`,
      language: 'he',
    });

    pendingDeals.set(result.lowProfileCode, {
      formState,
      payerAmount,
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      url: result.url,
      lowProfileCode: result.lowProfileCode,
    });
  } catch (err) {
    console.error(`[${ts()}] create-checkout-session error:`, err);
    res.status(500).json({
      success: false,
      error: err.message ?? 'Failed to create payment link.',
    });
  }
});

/**
 * POST /api/cardcom-webhook
 * Cardcom calls this when payment ends (server-to-server). This is separate from the
 * user redirect: Cardcom redirects the user to SuccessRedirectUrl in the browser,
 * and in parallel calls this webhook. We respond 200 immediately, then process in background.
 */
app.post('/api/cardcom-webhook', (req, res) => {
  console.log(`[${ts()}] Webhook received from Cardcom`);
  console.log(`[${ts()}] FULL WEBHOOK BODY:`, req.body);
  console.log(`[${ts()}] FULL WEBHOOK QUERY:`, req.query);

  const lowProfileCode =
    req.query.LowProfileCode ??
    req.query.lowProfileCode ??
    req.body?.LowProfileCode ??
    req.body?.lowProfileCode ??
    req.body?.lowprofilecode;

  if (!lowProfileCode) {
    console.warn(`[${ts()}] Webhook: missing LowProfileCode in body and query`);
    return res.status(200).send('OK');
  }

  res.status(200).send('OK');
  setImmediate(() => handleWebhookSuccess(lowProfileCode).catch((err) => console.error(`[${ts()}] Webhook error:`, err)));
});

/** GET webhook (some gateways call with GET + query params) */
app.get('/api/cardcom-webhook', (req, res) => {
  console.log(`[${ts()}] Webhook received from Cardcom (GET)`);
  console.log(`[${ts()}] FULL WEBHOOK QUERY (GET):`, req.query);

  const lowProfileCode = req.query.LowProfileCode ?? req.query.lowProfileCode ?? req.query.lowprofilecode;

  if (!lowProfileCode) {
    console.warn(`[${ts()}] Webhook GET: missing LowProfileCode in query`);
    return res.status(200).send('OK');
  }

  res.status(200).send('OK');
  setImmediate(() => handleWebhookSuccess(lowProfileCode).catch((e) => console.error(`[${ts()}] Webhook error:`, e)));
});

/**
 * Process webhook in background: confirm deal with Cardcom, then persist to MongoDB.
 * Uses fallbacks everywhere so missing metadata does not crash.
 */
async function handleWebhookSuccess(lowProfileCode) {
  try {
    const terminal = parseInt(process.env.CARDCOM_TERMINAL, 10) || 0;
    const user = process.env.CARDCOM_USER ?? '';
    if (!terminal || !user) {
      console.warn(`[${ts()}] Webhook: CARDCOM_TERMINAL or CARDCOM_USER missing, skipping`);
      return;
    }

    let indicator;
    try {
      indicator = await getLowProfileIndicator(terminal, user, lowProfileCode);
    } catch (e) {
      console.error(`[${ts()}] Webhook: GetLowProfileIndicator failed`, e.message);
      return;
    }

    const terminalNum = Number(terminal);
    const isTestTerminal = terminalNum === 1000;
    const processEndOk = indicator?.processEndOk === true || indicator?.processEndOk === 1 || indicator?.processEndOk === '1';
    const dealResponse = indicator?.dealResponse;

    console.log(`[${ts()}] Checking terminal: ${terminalNum} with DealResponse: ${dealResponse} (ProcessEndOK: ${indicator?.processEndOk})`);

    let paymentValid = false;
    if (isTestTerminal) {
      paymentValid = true;
      console.log(`[${ts()}] Validation passed for TEST terminal (bypass: terminal 1000 always proceeds)`);
    } else {
      paymentValid = (dealResponse === 1 || dealResponse === '1') && processEndOk;
      if (paymentValid) {
        console.log(`[${ts()}] Validation passed for LIVE terminal`);
      }
    }

    const paymentStatus = isTestTerminal ? 'TEST' : 'LIVE';
    if (!paymentValid) {
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
      console.warn(`[${ts()}] Webhook: deal not accepted`, {
        terminal: terminalNum,
        processEndOk: indicator?.processEndOk,
        dealResponse: indicator?.dealResponse,
      });
      return;
    }

    const pending = pendingDeals.get(lowProfileCode);
    if (!pending) {
      console.warn(`[${ts()}] Webhook: no pending deal for LowProfileCode`, lowProfileCode);
      return;
    }
    pendingDeals.delete(lowProfileCode);

    const transactionId = indicator?.internalDealNumber != null ? String(indicator.internalDealNumber) : lowProfileCode;
    const payerAmount = typeof pending.payerAmount === 'number' ? pending.payerAmount : 0;
    const dealPayload = buildDealPayloadFromFormState(pending.formState);

    console.log(`[${ts()}] Attempting to write deal to MongoDB...`);
    let result;
    try {
      result = await saveDeal({
        transactionId,
        payerAmount,
        formState: pending.formState || {},
        paymentStatus: paymentStatus === 'TEST' ? 'test_success' : 'paid',
        terminalNumber: terminalNum,
        source: 'cardcom-webhook',
        indicator: {
          processEndOk: indicator?.processEndOk ?? null,
          dealResponse: indicator?.dealResponse ?? null,
          internalDealNumber: indicator?.internalDealNumber ?? null,
        },
        normalizedPayload: dealPayload,
      });
    } catch (dbErr) {
      console.log(`[${ts()}] MongoDB write failed`);
      console.error(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`, dbErr);
      throw dbErr;
    }

    if (result.duplicate) {
      console.log(`[${ts()}] MongoDB write completed (duplicate skipped)`);
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE (duplicate)`);
    } else {
      console.log(`[${ts()}] MongoDB write completed`);
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: SUCCESS`);
    }
    console.log(`[${ts()}] Webhook: deal saved, transactionId=`, transactionId);
  } catch (err) {
    const paymentStatus = (Number(process.env.CARDCOM_TERMINAL) === 1000) ? 'TEST' : 'LIVE';
    console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
    console.error(`[${ts()}] Webhook: handleWebhookSuccess failed`, err);
  }
}

const OPAL_EMAIL = process.env.OPAL_EMAIL || 'opal2000@zahav.net.il';

/**
 * POST /api/contact – "צרו קשר" form. Body: { name, email, phone, message }.
 * Saves lead to MongoDB collection: contactLeads.
 */
app.post('/api/contact', async (req, res) => {
  try {
    const { name = '', email = '', phone = '', message = '' } = req.body || {};
    await saveContactLead({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      message: String(message).trim(),
      opalEmail: OPAL_EMAIL,
    });
    console.log(`[${ts()}] Contact form saved to MongoDB`);
    res.json({ success: true, message: 'נשלח בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] Contact form error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשליחה' });
  }
});

/**
 * POST /api/organization – "רשום ארגון" form. Body: { organizationName, contactName, phone, email, notes }.
 * Saves lead to MongoDB collection: organizationLeads.
 */
app.post('/api/organization', async (req, res) => {
  try {
    const {
      organizationName = '',
      contactName = '',
      phone = '',
      email = '',
      notes = '',
    } = req.body || {};
    await saveOrganizationLead({
      organizationName: String(organizationName).trim(),
      contactName: String(contactName).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      notes: String(notes).trim(),
    });
    console.log(`[${ts()}] Organization form saved to MongoDB`);
    res.json({ success: true, message: 'נשלח בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] Organization form error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשליחה' });
  }
});

/**
 * POST /api/update-beneficiaries
 * Body:
 * {
 *   transactionId: string,
 *   organizationName: string,
 *   agentName: string,
 *   primaryMember: { firstName, lastName, id, email, phone?, address?, dateOfBirth?, maritalStatus?, healthFund?, supplementalInsurance? },
 *   additionalMembers: Array<{ relation?: string, firstName, lastName, id, dateOfBirth?, maritalStatus?, healthFund?, supplementalInsurance? }>
 * }
 *
 * Writes beneficiary update into MongoDB under deal document.
 */
app.post('/api/update-beneficiaries', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const transactionId = String(body.transactionId ?? '').trim();
    const organizationName = String(body.organizationName ?? '').trim();
    const agentName = String(body.agentName ?? '').trim();
    const pm = body.primaryMember && typeof body.primaryMember === 'object' ? body.primaryMember : {};

    const primaryFirstName = String(pm.firstName ?? '').trim();
    const primaryLastName = String(pm.lastName ?? '').trim();
    const primaryId = String(pm.id ?? '').trim();
    const primaryEmail = String(pm.email ?? '').trim();

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'חסר מס׳ הזמנה (Transaction ID).' });
    }
    if (!primaryFirstName || !primaryLastName) {
      return res.status(400).json({ success: false, error: 'חסר שם פרטי/משפחה למבוטח הראשי.' });
    }
    if (!primaryId) {
      return res.status(400).json({ success: false, error: 'חסרה תעודת זהות למבוטח הראשי.' });
    }

    const additionalMembers = Array.isArray(body.additionalMembers) ? body.additionalMembers : [];
    const beneficiaries = additionalMembers
      .map((m) => (m && typeof m === 'object' ? m : {}))
      .map((m) => ({
        firstName: String(m.firstName ?? '').trim(),
        lastName: String(m.lastName ?? '').trim(),
        id: String(m.id ?? '').trim(),
        dateOfBirth: String(m.dateOfBirth ?? '').trim(),
        maritalStatus: String(m.maritalStatus ?? '').trim(),
        healthFund: String(m.healthFund ?? '').trim(),
        supplementalInsurance: String(m.supplementalInsurance ?? '').trim(),
      }))
      .filter((m) => {
        // keep row only if it has some meaningful identity data
        return !!(m.firstName || m.lastName || m.id || m.dateOfBirth);
      });

    const result = await saveBeneficiaryUpdate({
      transactionId,
      organizationName,
      agentName,
      primaryMember: {
        firstName: primaryFirstName,
        lastName: primaryLastName,
        id: primaryId,
        email: primaryEmail,
        phone: String(pm.phone ?? '').trim(),
        address: String(pm.address ?? '').trim(),
        dateOfBirth: String(pm.dateOfBirth ?? '').trim(),
        maritalStatus: String(pm.maritalStatus ?? '').trim(),
        healthFund: String(pm.healthFund ?? '').trim(),
        supplementalInsurance: String(pm.supplementalInsurance ?? '').trim(),
      },
      additionalMembers: beneficiaries,
    });

    res.json({
      success: true,
      dealId: result.id,
    });
  } catch (err) {
    console.error(`[${ts()}] update-beneficiaries error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשמירה' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongoConfigured: !!process.env.MONGO_URL,
    cardcomConfigured: !!(process.env.CARDCOM_TERMINAL && process.env.CARDCOM_USER),
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'שם משתמש או סיסמה שגויים' });
  }
  const token = createAdminToken(username);
  return res.json({ success: true, token });
});

app.get('/api/admin/deals', requireAdmin, async (req, res) => {
  try {
    const deals = await getDeals();
    res.json({ success: true, deals });
  } catch (e) {
    console.error(`[${ts()}] admin/deals error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.name || '').trim()) return res.status(400).json({ success: false, error: 'name is required' });
    if (!String(body.sku || '').trim()) return res.status(400).json({ success: false, error: 'sku (מק"ט) is required' });
    const result = await createProduct(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/products create error:`, e);
    const msg = e.code === 11000 ? 'מק"ט כבר קיים במערכת' : e.message || 'Failed to save product';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const products = await listProducts();
    res.json({ success: true, products });
  } catch (e) {
    console.error(`[${ts()}] admin/products list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

app.post('/api/admin/org-pricing', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.organizationName || '').trim()) {
      return res.status(400).json({ success: false, error: 'organizationName is required' });
    }
    if (!String(body.pricingListName || '').trim()) {
      return res.status(400).json({ success: false, error: 'pricingListName is required' });
    }
    const related = Array.isArray(body.relatedProducts) ? body.relatedProducts : [];
    if (!related.length) {
      return res.status(400).json({ success: false, error: 'יש לבחור לפחות מוצר אחד עם מחירים' });
    }
    for (const line of related) {
      if (!String(line.productId || '').trim()) {
        return res.status(400).json({ success: false, error: 'כל שורה חייבת productId' });
      }
    }
    const result = await createOrgPricingPolicy(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/org-pricing create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to save organization pricing' });
  }
});

app.get('/api/admin/org-pricing', requireAdmin, async (req, res) => {
  try {
    const rows = await listOrgPricingPolicies();
    res.json({ success: true, rows });
  } catch (e) {
    console.error(`[${ts()}] admin/org-pricing list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch organization pricing' });
  }
});

/** Aggregated dashboard: abandoned carts, arrears, leads, registered org pricings */
app.get('/api/admin/control-panel', requireAdmin, async (req, res) => {
  try {
    const [abandonedCarts, paymentArrears, privateLeads, corporateLeads, registeredOrganizations] = await Promise.all([
      listIncompleteCheckoutDrafts(150),
      getPaymentArrearsDeals(150),
      getContactLeads(150),
      getOrganizationLeads(150),
      listOrgPricingPolicies(),
    ]);
    res.json({
      success: true,
      abandonedCarts,
      paymentArrears,
      privateLeads,
      corporateLeads,
      registeredOrganizations,
    });
  } catch (e) {
    console.error(`[${ts()}] admin/control-panel error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load control panel' });
  }
});

/** Public — landing page: ?pricingId=<MongoId> (also accepts orgPricingId) */
app.get('/api/pricing-context', async (req, res) => {
  try {
    const pricingId = String(req.query.pricingId || req.query.orgPricingId || '').trim();
    if (!pricingId) {
      return res.status(400).json({ success: false, error: 'pricingId or orgPricingId query param is required' });
    }
    const ctx = await getPricingContextByPricingId(pricingId);
    if (!ctx) return res.status(404).json({ success: false, error: 'Pricing not found' });
    res.json({ success: true, ...ctx });
  } catch (e) {
    console.error(`[${ts()}] pricing-context error:`, e);
    res.status(500).json({ success: false, error: 'Failed to resolve pricing' });
  }
});

/** Anonymous checkout progress — for abandoned cart tracking */
app.post('/api/checkout-draft', async (req, res) => {
  try {
    const body = req.body || {};
    await upsertCheckoutDraft({
      sessionKey: body.sessionKey,
      formSnapshot: body.formSnapshot,
      step: body.step,
      completed: body.completed,
    });
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] checkout-draft error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Invalid draft' });
  }
});

app.post('/api/admin/agents', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const p = body.personal || {};
    const b = body.bankDetails || {};
    const c = body.commissionModel || {};
    if (!String(p.name || '').trim()) return res.status(400).json({ success: false, error: 'Agent name is required' });
    if (!String(p.idOrCompanyNum || '').trim()) return res.status(400).json({ success: false, error: 'ID/Company number is required' });
    if (!String(b.bankName || '').trim()) return res.status(400).json({ success: false, error: 'Bank name is required' });
    if (!String(c.productName || '').trim()) return res.status(400).json({ success: false, error: 'Product is required' });
    if (!String(c.productSKU || '').trim()) return res.status(400).json({ success: false, error: 'Product SKU is required' });
    const result = await createAgent(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/agents create error:`, e);
    res.status(500).json({ success: false, error: 'Failed to save agent' });
  }
});

app.get('/api/admin/agents', requireAdmin, async (req, res) => {
  try {
    const rows = await listAgents();
    res.json({ success: true, rows });
  } catch (e) {
    console.error(`[${ts()}] admin/agents list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

app.get('/api/admin/sales-dashboard', requireAdmin, async (req, res) => {
  try {
    const summaryCategories = String(req.query.summaryCategories || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const data = await getSalesDashboardData({
      month: req.query.month || '',
      fromDate: req.query.fromDate || '',
      toDate: req.query.toDate || '',
      providerEnabled: String(req.query.providerEnabled || '') === 'true',
      providerValue: req.query.providerValue || '',
      agentEnabled: String(req.query.agentEnabled || '') === 'true',
      agentValue: req.query.agentValue || '',
      organizationSearch: req.query.organizationSearch || '',
      customerSearch: req.query.customerSearch || '',
      idSearch: req.query.idSearch || '',
      amountDue: req.query.amountDue || '0',
      summaryCategories,
    });
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] admin/sales-dashboard error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load sales dashboard' });
  }
});

// SPA fallback – serve index.html for any non-API path (regex avoids path-to-regexp '*' error on Express 4.21+)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(resolve(STATIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${ts()}] Opal API listening on http://0.0.0.0:${PORT}`);
  if (!process.env.MONGO_URL) {
    console.warn(`[${ts()}] MONGO_URL not set`);
  }
  if (!process.env.CARDCOM_TERMINAL) console.warn(`[${ts()}] CARDCOM_TERMINAL not set`);
});
