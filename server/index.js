/**
 * Opal API – Cardcom checkout + webhook → MongoDB.
 * Requires: .env with CARDCOM_*, BASE_URL, MONGO_URL.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import {
  createLowProfilePage,
  getLowProfileIndicator,
  stopRecurringProfile,
  createRecurringProfileFromLowProfile,
} from './cardcomService.js';
import { sendOrderConfirmationEmail, sendBeneficiaryCompletionEmail } from './emailService.js';
import { generateBeneficiarySummaryPdfBuffer, saveBeneficiarySummaryPdfToDisk } from './beneficiaryPdfService.js';
import {
  createOrganizationCompany,
  clearAbandonedCheckoutLeadsByContact,
  deleteOrganizationCompany,
  getDeals,
  getOrganizationCompaniesWithMemberCounts,
  getOrganizationCompanyById,
  findDealsByOrganizationId,
  getOrganizationMonthlyPayments,
  insertOrganizationImportedDeal,
  getPublicOrganizationForRegistration,
  countActiveMembersByOrganizationId,
  getSalesDashboardData,
  saveBeneficiaryUpdate,
  saveContactLead,
  saveDeal,
  findDealForRecurringEvent,
  syncParentFutureBillingAfterRecurringWebhook,
  getSubscriberBillingHistoryByDealId,
  mergeDealCardcomRecurringIds,
  saveOrUpdateAbandonedCheckoutLead,
  upsertPendingCheckoutLead,
  markPendingCheckoutLeadConverted,
  listAwaitingPaymentCheckoutLeads,
  findDealByLowProfileCode,
  getPublicDealContext,
  saveOrganizationLead,
  updateLeadAdmin,
  updateOrganizationCompany,
  getContactLeads,
  getDealsPendingBeneficiaryCompletion,
  getOrganizationLeads,
  getPaymentArrearsDeals,
  getControlPanelOverviewStats,
  getControlPanelOverviewData,
  getAlertsSummary,
  markControlPanelItemHandled,
  updateContactHubItem,
  updateDealAdmin,
  deleteDealAdmin,
  bulkDeleteDealsAdmin,
  getDealForRecurringCancellation,
  markDealCancelledByAdmin,
  markDealPendingCancellation,
  runMonthlyOrgSnapshot,
  getDealEmailSentAt,
  getDealByTransactionId,
  markDealOrderEmailSent,
  findDealsCreatedInRange,
  findDealsCancelledInRange,
  findDealsByAgentAndMonth,
  listMonthlyInvoices,
  generateMonthlyInvoicesForMonth,
  updateMonthlyInvoice,
} from './mongoService.js';
import {
  createLandingPage,
  createOrgPricingPolicy,
  createPriceList,
  createPricingEntry,
  createProduct,
  createSalesAgent,
  createVendor,
  deleteLandingPage,
  deletePriceList,
  deletePricingEntry,
  deleteProduct,
  deleteSalesAgent,
  deleteVendor,
  getAgentCommissionForProduct,
  getPricingContextByPricingId,
  getPriceListById,
  getPublicLandingPageBySlug,
  getPublicPriceListById,
  getVendorCostForProduct,
  listLandingPages,
  listIncompleteCheckoutDrafts,
  listOrgPricingPolicies,
  listPriceLists,
  listPricingEntries,
  listProducts,
  listPublicSalesAgents,
  listSalesAgentsWithSales,
  listVendors,
  getArchiveSnapshot,
  restoreArchiveItem,
  resolveAgentIdFromFormState,
  resolveCheckoutEconomics,
  updateLandingPage,
  updatePriceList,
  updatePricingEntry,
  updateProduct,
  updateSalesAgent,
  updateVendor,
  upsertCheckoutDraft,
} from './adminMongooseService.js';
import {
  buildSubscribersCsv,
  buildCancellationsCsv,
  buildAgentCommissionPayload,
  generateFlattenedSubscriberRows,
  filterDealsByProvider,
  buildSubscribersXlsxBuffer,
} from './reportController.js';
import multer from 'multer';
import { parseOrgMemberImportBuffer, buildOrgImportTemplateBuffer } from './orgImportService.js';
import fs from 'fs/promises';
import { resolve } from 'path';
import { candidateDocPdfPaths, readFirstExistingFile } from './repoAssets.js';
import {
  validateIsraeliId,
  formatIsraeliIdStored,
  ISRAELI_ID_INVALID_MSG,
  validateDealPatchIsraeliIdsOrThrow,
} from './israeliId.js';

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

function firstDefined(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function buildBeneficiaryPdfModelFromDeal({ transactionId, deal, primaryMember, additionalMembers, payerAmount }) {
  const fsState = deal?.formState || {};
  const primary = primaryMember || {};
  const additional = Array.isArray(additionalMembers) ? additionalMembers : [];
  const tid = String(transactionId || '');
  const digitsOnly = tid.replace(/\D/g, '');
  const numerator =
    digitsOnly.length >= 6 ? digitsOnly.slice(-6) : tid.replace(/[^0-9A-Za-z]/g, '').slice(0, 8) || '—';
  return {
    orderNumber: tid,
    orderDate: new Date().toLocaleDateString('he-IL'),
    numerator,
    customerName: firstDefined(
      [primary.firstName, primary.lastName].filter(Boolean).join(' '),
      fsState.fullName
    ),
    customerId: firstDefined(primary.id, fsState.id),
    subscriptionStartDate: fsState.subscriptionStartDate || new Date().toISOString().slice(0, 10),
    address: firstDefined(primary.address, fsState.address),
    phone: firstDefined(primary.phone, fsState.phone),
    email: firstDefined(primary.email, fsState.email),
    lastFourDigits: String(fsState.lastFourDigits || '').trim(),
    transactionDescription: firstDefined(fsState.productName, fsState.selectedPlanId, 'רופא עד הבית'),
    serviceDocumentName: 'רופא עד הבית',
    productName: firstDefined(fsState.productName, fsState.selectedPlanId),
    monthlyTotal: Number(payerAmount || deal?.payerAmount || 0),
    primaryBeneficiary: {
      fullName: firstDefined([primary.firstName, primary.lastName].filter(Boolean).join(' '), fsState.fullName),
      idNumber: firstDefined(primary.id, fsState.id),
      dateOfBirth: firstDefined(primary.dateOfBirth, fsState.dateOfBirth),
      maritalStatus: firstDefined(primary.maritalStatus, fsState.maritalStatus),
      healthFund: firstDefined(primary.healthFund, fsState.healthFund),
      supplementalInsurance: firstDefined(primary.supplementalInsurance, fsState.supplementalInsurance),
    },
    secondaryBeneficiaries: additional.map((m) => ({
      fullName: [String(m.firstName || '').trim(), String(m.lastName || '').trim()].filter(Boolean).join(' '),
      idNumber: String(m.id || '').trim(),
      dateOfBirth: String(m.dateOfBirth || '').trim(),
      maritalStatus: String(m.maritalStatus || '').trim(),
      healthFund: String(m.healthFund || '').trim(),
      supplementalInsurance: String(m.supplementalInsurance || '').trim(),
    })),
  };
}

async function buildLegalDocAttachments() {
  const attachments = [];
  const staticDocFilenames = ['גילוי נאות.pdf', 'כתב שירות.pdf'];

  for (const filename of staticDocFilenames) {
    const candidates = candidateDocPdfPaths(filename);
    try {
      const { path: resolvedPath, buffer } = await readFirstExistingFile(candidates, filename);
      console.log(`[${ts()}] Legal attachment resolved: ${filename} -> ${resolvedPath}`);
      attachments.push({ filename, content: buffer });
    } catch (err) {
      console.error(`[${ts()}] Legal attachment missing: ${filename}`, err?.message || err);
      throw err;
    }
  }
  return attachments;
}

function buildBeneficiarySummaryAttachment({ transactionId, beneficiaryPdfBuffer }) {
  if (!beneficiaryPdfBuffer) return [];
  return [
    {
      filename: `beneficiary-summary-${String(transactionId || '').trim() || 'order'}.pdf`,
      content: beneficiaryPdfBuffer,
    },
  ];
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

const orgImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const STATIC_DIR = resolve(process.cwd(), 'dist');
const BRANDING_DIR = resolve(process.cwd(), 'server', 'assets', 'branding');
app.use('/branding', express.static(BRANDING_DIR));
app.use(express.static(STATIC_DIR));

const LEGAL_DOC_FILES = {
  'service-terms': 'כתב שירות.pdf',
  'privacy-disclosure': 'גילוי נאות.pdf',
};

/** Same PDF assets as post-purchase emails (server/assets/docs or DOC). Public, no auth. */
app.get('/api/legal-document/:key', async (req, res) => {
  const filename = LEGAL_DOC_FILES[String(req.params.key || '').trim()];
  if (!filename) {
    return res.status(404).type('text/plain').send('Unknown document');
  }
  try {
    const { buffer } = await readFirstExistingFile(candidateDocPdfPaths(filename), filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (e) {
    console.error(`[${ts()}] legal-document missing ${filename}:`, e?.message || e);
    res.status(404).type('text/plain').send('Document not available');
  }
});

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

/** Snapshot חודשי ב-1 לחודש בשעה 00:01 */
(function scheduleMonthlySnapshot() {
  function msUntilNextFirst() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 1, 0, 0);
    return next.getTime() - now.getTime();
  }
  function fireAndReschedule() {
    runMonthlyOrgSnapshot().then((r) => {
      console.log(`[monthly-snapshot] done:`, r);
    }).catch((e) => {
      console.error(`[monthly-snapshot] error:`, e?.message || e);
    });
    setTimeout(fireAndReschedule, msUntilNextFirst());
  }
  setTimeout(fireAndReschedule, msUntilNextFirst());
})();

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
    const fs0 = formState && typeof formState === 'object' ? formState : {};
    const orgPrivateOk = fs0.orgPrivateEnrollment === true && Number(fs0.orgPrivatePrice) > 0;
    if (!formState || (!fs0.selectedPlanId && !orgPrivateOk)) {
      return res.status(400).json({
        success: false,
        error: 'Missing formState with selectedPlanId.',
      });
    }
    const landingFlow = fs0.landingFlow === true;
    if (orgPrivateOk) {
      if (!String(fs0.fullName || '').trim() || !String(fs0.email || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'בהרשמה ארגונית נדרשים שם מלא ואימייל.',
        });
      }
    }
    if (landingFlow && !String(fs0.fullName || '').trim()) {
      return res.status(400).json({
        success: false,
        error: 'נא למלא שם מלא.',
      });
    }
    if (orgPrivateOk || landingFlow) {
      const idDigits = String(fs0.id || '').replace(/\D/g, '');
      if (idDigits && !validateIsraeliId(idDigits)) {
        return res.status(400).json({ success: false, error: ISRAELI_ID_INVALID_MSG });
      }
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

    const econ = await resolveCheckoutEconomics(formState);
    const payerAmount = Number(econ.payerAmount ?? 0);
    if (!payerAmount || payerAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount — choose a valid plan or product.',
      });
    }

    const enrichedForm = {
      ...formState,
      resolvedVendorCost: econ.resolvedVendorCost,
      resolvedAgentCommission: econ.resolvedAgentCommission,
      resolvedNetProfit: econ.resolvedNetProfit,
      productName: econ.productName || formState.productName,
      productId: econ.productId || formState.productId,
      priceListId: econ.priceListId || formState.priceListId,
    };
    if (orgPrivateOk || landingFlow) {
      if (String(enrichedForm.id || '').trim()) {
        const stored = formatIsraeliIdStored(enrichedForm.id);
        if (stored) enrichedForm.id = stored;
      }
    }

    const result = await createLowProfilePage({
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
      formState: enrichedForm,
      payerAmount,
      createdAt: Date.now(),
    });

    try {
      await upsertPendingCheckoutLead({
        lowProfileCode: result.lowProfileCode,
        name: String(enrichedForm.fullName || '').trim(),
        email: String(enrichedForm.email || '').trim(),
        phone: String(enrichedForm.phone || '').trim(),
        productName: String(enrichedForm.productName || '').trim(),
        landingSlug: String(enrichedForm.landingPageSlug || enrichedForm.priceListId || '').trim(),
        priceListId: String(enrichedForm.priceListId || '').trim(),
      });
    } catch (leadErr) {
      console.warn(`[${ts()}] upsertPendingCheckoutLead (non-blocking):`, leadErr?.message || leadErr);
    }

    res.json({
      success: true,
      url: result.url,
      lowProfileCode: result.lowProfileCode,
    });
  } catch (err) {
    console.error(`[${ts()}] create-checkout-session error:`, err);
    const msg = String(err?.message || '');
    const authBlocked =
      /Cardcom/i.test(msg) &&
      (/הזדהות|חסומ|authentication|authorization|invalid username|invalid password|blocked/i.test(msg));
    res.status(500).json({
      success: false,
      error: authBlocked
        ? 'מערכת הסליקה זמנית אינה זמינה עקב שגיאת הזדהות. אנא נסו שוב מאוחר יותר או פנו לתמיכה.'
        : err.message ?? 'Failed to create payment link.',
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
  setImmediate(() =>
    handleWebhookSuccess(lowProfileCode, req.body, req.query).catch((err) =>
      console.error(`[${ts()}] Webhook error:`, err)
    )
  );
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
  setImmediate(() =>
    handleWebhookSuccess(lowProfileCode, req.body, req.query).catch((e) =>
      console.error(`[${ts()}] Webhook error:`, e)
    )
  );
});

/** Cardcom "MasterRecurring" external report (BillGold recurring events). */
app.post('/api/cardcom-master-recurring-webhook', (req, res) => {
  res.status(200).send('OK');
  setImmediate(() =>
    handleMasterRecurringWebhook(req.body, req.query).catch((err) =>
      console.error(`[${ts()}] MasterRecurring webhook error:`, err?.message || err)
    )
  );
});

/**
 * Process webhook in background: confirm deal with Cardcom, then persist to MongoDB.
 * Uses fallbacks everywhere so missing metadata does not crash.
 */
async function handleWebhookSuccess(lowProfileCode, webhookBody = {}, webhookQuery = {}) {
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
    const responseCode = Number(indicator?.responseCode ?? NaN);
    const processEndOk = indicator?.processEndOk === true || indicator?.processEndOk === 1 || indicator?.processEndOk === '1';
    const dealResponse = indicator?.dealResponse;
    const responseDescription = String(indicator?.responseDescription || indicator?.description || '').trim();
    const webhookInternalDeal = firstDefined(
      webhookBody?.internaldealnumber,
      webhookBody?.InternalDealNumber,
      webhookQuery?.internaldealnumber,
      webhookQuery?.InternalDealNumber
    );
    const webhookResponseDescription = firstDefined(
      webhookBody?.responsdescription,
      webhookBody?.ResponsDescription,
      webhookBody?.ResponseDescription,
      webhookQuery?.responsdescription,
      webhookQuery?.ResponsDescription,
      webhookQuery?.ResponseDescription
    );
    const webhookLast4 = firstDefined(
      webhookBody?.Lest4Numbers,
      webhookBody?.Last4Numbers,
      webhookQuery?.Lest4Numbers,
      webhookQuery?.Last4Numbers
    );
    const webhookBrand = firstDefined(
      webhookBody?.MutagName,
      webhookBody?.CardBrand,
      webhookQuery?.MutagName,
      webhookQuery?.CardBrand
    );

    console.log(`[${ts()}] Checking terminal: ${terminalNum} with DealResponse: ${dealResponse} (ProcessEndOK: ${indicator?.processEndOk})`);

    let paymentValid = false;
    if (responseCode !== 0) {
      paymentValid = false;
    } else if (isTestTerminal) {
      paymentValid = true;
      console.log(`[${ts()}] Validation passed for TEST terminal (bypass: terminal 1000 always proceeds)`);
    } else {
      paymentValid = responseCode === 0 && (dealResponse === 1 || dealResponse === '1') && processEndOk;
      if (paymentValid) {
        console.log(`[${ts()}] Validation passed for LIVE terminal`);
      }
    }

    const paymentStatus = isTestTerminal ? 'TEST' : 'LIVE';
    if (!paymentValid) {
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
      console.warn(`[${ts()}] Webhook: deal not accepted`, {
        terminal: terminalNum,
        responseCode: indicator?.responseCode,
        responseDescription,
        processEndOk: indicator?.processEndOk,
        dealResponse: indicator?.dealResponse,
      });
      const pending = pendingDeals.get(lowProfileCode);
      if (pending) {
        try {
          const transactionIdFail =
            webhookInternalDeal ||
            (indicator?.internalDealNumber != null && String(indicator.internalDealNumber).trim() !== ''
              ? String(indicator.internalDealNumber).trim()
              : lowProfileCode);
          const mergedFailedForm = {
            ...(pending.formState || {}),
            cardcomRecurringId: String(indicator?.cardcomRecurringId || '').trim(),
            cardcomResponseDescription: webhookResponseDescription || responseDescription,
            lastFourDigits: webhookLast4 || String(indicator?.Lest4Numbers || '').trim(),
            cardBrand: webhookBrand || String(indicator?.MutagName || '').trim(),
          };
          await saveDeal({
            transactionId: transactionIdFail,
            lowProfileCode,
            cardcomAccountId: String(indicator?.cardcomAccountId || '').trim(),
            cardcomRecurringId: String(indicator?.cardcomRecurringId || '').trim(),
            cardcomToken: String(indicator?.cardcomToken || '').trim(),
            payerAmount: Number(pending?.payerAmount || 0),
            formState: mergedFailedForm,
            agentId: pending?.agentId || null,
            paymentStatus: 'failed',
            terminalNumber: terminalNum,
            source: 'cardcom-webhook',
            indicator: {
              responseCode: indicator?.responseCode ?? null,
              responsdescription: webhookResponseDescription || responseDescription || null,
              processEndOk: indicator?.processEndOk ?? null,
              dealResponse: indicator?.dealResponse ?? null,
              internalDealNumber: webhookInternalDeal || indicator?.internalDealNumber || null,
              Lest4Numbers: webhookLast4 || indicator?.Lest4Numbers || null,
              MutagName: webhookBrand || indicator?.MutagName || null,
              cardcomAccountId: indicator?.cardcomAccountId ?? null,
              cardcomRecurringId: indicator?.cardcomRecurringId ?? null,
              cardcomToken: indicator?.cardcomToken ?? null,
            },
            normalizedPayload: buildDealPayloadFromFormState(mergedFailedForm),
          });
          pendingDeals.delete(lowProfileCode);
        } catch (failPersistErr) {
          console.warn(`[${ts()}] failed deal persistence (non-blocking):`, failPersistErr?.message || failPersistErr);
        }
      }
      return;
    }

    const pending = pendingDeals.get(lowProfileCode);
    if (!pending) {
      console.warn(`[${ts()}] Webhook: no pending deal for LowProfileCode`, lowProfileCode);
      return;
    }
    pendingDeals.delete(lowProfileCode);

    const transactionId = indicator?.internalDealNumber != null ? String(indicator.internalDealNumber) : lowProfileCode;

    if (!indicator?.cardcomAccountId || !indicator?.cardcomRecurringId) {
      console.warn(`[${ts()}] Webhook: payment OK but missing BillGold ids (AccountId/RecurringId). Was CreateRecurring sent on CreateLowProfileDeal?`, {
        lowProfileCode,
        cardcomAccountId: indicator?.cardcomAccountId || null,
        cardcomRecurringId: indicator?.cardcomRecurringId || null,
      });
    }
    if (!indicator?.cardcomToken) {
      console.warn(`[${ts()}] Webhook: payment OK but missing Cardcom token (IsCreateToken=true expected).`, {
        lowProfileCode,
      });
    }
    const agentId = await resolveAgentIdFromFormState(pending.formState);
    const mergedForm = { ...(pending.formState || {}), ...(agentId ? { agentId } : {}) };

    let econ;
    try {
      econ = await resolveCheckoutEconomics(mergedForm);
    } catch (econErr) {
      console.warn(`[${ts()}] resolveCheckoutEconomics fallback:`, econErr?.message || econErr);
      econ = {
        payerAmount: typeof pending.payerAmount === 'number' ? pending.payerAmount : 0,
        resolvedVendorCost: mergedForm.resolvedVendorCost ?? 0,
        resolvedAgentCommission: mergedForm.resolvedAgentCommission ?? 0,
        resolvedNetProfit: mergedForm.resolvedNetProfit ?? 0,
        productName: mergedForm.productName || '',
        productId: mergedForm.productId || '',
        priceListId: mergedForm.priceListId || '',
      };
    }
    const payerAmount = Number(econ.payerAmount ?? pending.payerAmount ?? 0);
    const finalForm = {
      ...mergedForm,
      resolvedVendorCost: econ.resolvedVendorCost,
      resolvedAgentCommission: econ.resolvedAgentCommission,
      resolvedNetProfit: econ.resolvedNetProfit,
      productName: econ.productName || mergedForm.productName,
      productId: econ.productId || mergedForm.productId,
      priceListId: econ.priceListId || mergedForm.priceListId,
      cardcomRecurringId: String(indicator?.cardcomRecurringId || '').trim(),
      cardcomResponseDescription: responseDescription,
      lastFourDigits: String(indicator?.Lest4Numbers || '').trim(),
      cardBrand: String(indicator?.MutagName || '').trim(),
    };

    const dealPayload = buildDealPayloadFromFormState(finalForm);

    const webhookCardToken = firstDefined(
      webhookBody?.CardToken,
      webhookBody?.cardToken,
      webhookBody?.['ExtShvaParams.CardToken'],
      webhookQuery?.CardToken,
      webhookQuery?.cardToken,
      webhookQuery?.['ExtShvaParams.CardToken']
    );

    // Step 2 (required): create BillGold recurring profile from successful Low Profile charge.
    let step2Recurring = null;
    try {
      step2Recurring = await createRecurringProfileFromLowProfile({
        terminalNumber: terminalNum,
        username: user,
        lowProfileCode,
        email: String(finalForm?.email || '').trim(),
        companyName: String(finalForm?.fullName || '').trim() || String(finalForm?.organizationName || '').trim() || 'Customer',
        phone: String(finalForm?.phone || '').trim(),
        internalDescription: String(finalForm?.productName || 'Subscription').trim(),
        invoiceDescription: String(finalForm?.productName || 'Subscription').trim(),
        monthlyAmount: payerAmount,
        returnValue: lowProfileCode,
        cardToken: webhookCardToken,
      });
      console.log(`[${ts()}] RecurringPayment Step2 created`, {
        lowProfileCode,
        cardcomAccountId: step2Recurring?.cardcomAccountId || null,
        cardcomRecurringId: step2Recurring?.cardcomRecurringId || null,
      });
    } catch (step2Err) {
      console.error(`[${ts()}] RecurringPayment Step2 failed`, {
        lowProfileCode,
        message: step2Err?.message || step2Err,
      });
    }
    finalForm.cardcomRecurringId = String(
      step2Recurring?.cardcomRecurringId || finalForm.cardcomRecurringId || indicator?.cardcomRecurringId || ''
    ).trim();
    if (webhookResponseDescription) finalForm.cardcomResponseDescription = webhookResponseDescription;
    if (webhookLast4) finalForm.lastFourDigits = webhookLast4;
    if (webhookBrand) finalForm.cardBrand = webhookBrand;

    console.log(`[${ts()}] Attempting to write deal to MongoDB...`);
    let result;
    try {
      result = await saveDeal({
        transactionId,
        lowProfileCode,
        cardcomAccountId: step2Recurring?.cardcomAccountId || indicator?.cardcomAccountId || '',
        cardcomRecurringId: step2Recurring?.cardcomRecurringId || indicator?.cardcomRecurringId || '',
        cardcomToken: indicator?.cardcomToken || '',
        payerAmount,
        formState: finalForm,
        agentId,
        paymentStatus: paymentStatus === 'TEST' ? 'test_success' : 'paid',
        terminalNumber: terminalNum,
        source: 'cardcom-webhook',
        indicator: {
          responseCode: indicator?.responseCode ?? null,
          responsdescription: webhookResponseDescription || responseDescription || null,
          processEndOk: indicator?.processEndOk ?? null,
          dealResponse: indicator?.dealResponse ?? null,
          internalDealNumber: webhookInternalDeal || indicator?.internalDealNumber || null,
          Lest4Numbers: webhookLast4 || indicator?.Lest4Numbers || null,
          MutagName: webhookBrand || indicator?.MutagName || null,
          cardcomAccountId: indicator?.cardcomAccountId ?? null,
          cardcomRecurringId: indicator?.cardcomRecurringId ?? null,
          step2CardcomAccountId: step2Recurring?.cardcomAccountId ?? null,
          step2CardcomRecurringId: step2Recurring?.cardcomRecurringId ?? null,
          cardcomToken: indicator?.cardcomToken ?? null,
        },
        normalizedPayload: dealPayload,
      });
    } catch (dbErr) {
      console.log(`[${ts()}] MongoDB write failed`);
      console.error(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`, dbErr);
      throw dbErr;
    }

    try {
      await markPendingCheckoutLeadConverted(lowProfileCode, transactionId);
    } catch (linkErr) {
      console.warn(`[${ts()}] markPendingCheckoutLeadConverted (non-blocking):`, linkErr?.message || linkErr);
    }

    try {
      await mergeDealCardcomRecurringIds(transactionId, {
        cardcomAccountId: step2Recurring?.cardcomAccountId || indicator?.cardcomAccountId,
        cardcomRecurringId: step2Recurring?.cardcomRecurringId || indicator?.cardcomRecurringId,
        cardcomToken: indicator?.cardcomToken,
      });
    } catch (mergeErr) {
      console.warn(`[${ts()}] mergeDealCardcomRecurringIds (non-blocking):`, mergeErr?.message || mergeErr);
    }

    const to = String(finalForm?.email || '').trim();
    const beneficiaryLink = `${FRONTEND_URL}/beneficiary-form?transactionId=${encodeURIComponent(transactionId)}`;
    const primaryName = String(finalForm?.fullName || '').trim();
    const primaryId = String(finalForm?.id || '').trim();
    const secondaryBeneficiaries = Array.isArray(finalForm?.beneficiaries)
      ? finalForm.beneficiaries.map((b) => ({
          name: [String(b?.firstName || '').trim(), String(b?.lastName || '').trim()].filter(Boolean).join(' '),
          idNumber: String(b?.id || '').trim(),
        }))
      : [];

    const existingEmailSentAt = result.duplicate ? await getDealEmailSentAt(transactionId) : null;
    const shouldSendEmail = !result.duplicate || !existingEmailSentAt;

    if (result.duplicate) {
      console.log(`[${ts()}] MongoDB write completed (duplicate skipped)`);
      if (existingEmailSentAt) {
        console.log(`[${ts()}] Payment status: ${paymentStatus} - Email already sent; skipping`);
      } else {
        console.log(`[${ts()}] Payment status: ${paymentStatus} - Duplicate deal but email not sent; sending now`);
      }
    } else {
      console.log(`[${ts()}] MongoDB write completed`);
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: SUCCESS`);
    }

    if (shouldSendEmail) {
      try {
        const orderDateStr = new Date().toLocaleDateString('he-IL');
        const mailResult = await sendOrderConfirmationEmail({
          to,
          orderNumber: transactionId,
          orderDate: orderDateStr,
          customerName: primaryName || 'לקוח',
          customerId: primaryId,
          subscriptionStartDate: orderDateStr,
          address: String(finalForm?.address || '').trim(),
          lastFourDigits: String(finalForm?.lastFourDigits || '').trim(),
          subscriptionType: String(finalForm?.productName || '').trim(),
          email: to,
          phone: String(finalForm?.phone || '').trim(),
          productName: String(finalForm?.productName || '').trim(),
          monthlyTotal: Number(payerAmount || 0),
          beneficiaryLink,
          primaryBeneficiary: { name: primaryName || '—', idNumber: primaryId || '—' },
          secondaryBeneficiaries,
          attachments: await buildLegalDocAttachments(),
        });

        if (mailResult?.sent) {
          await markDealOrderEmailSent(transactionId, { emailTo: to });
          console.log(`[${ts()}] Email confirmation sent for transaction ${transactionId}`);
        } else {
          console.warn(`[${ts()}] Email not sent (reason=${mailResult?.reason || 'unknown'})`);
        }
      } catch (mailErr) {
        console.error(`[${ts()}] Email confirmation failed:`, mailErr?.message || mailErr);
      }
    }

    // Clear abandoned checkout leads after successful payment regardless of webhook duplicates.
    try {
      await clearAbandonedCheckoutLeadsByContact({
        phone: String(finalForm?.phone || '').trim(),
        email: String(finalForm?.email || '').trim(),
        landingSlug: String(finalForm?.priceListId || '').trim(),
        landingSlugAlt: String(finalForm?.landingPageSlug || '').trim(),
      });
    } catch (clearErr) {
      console.warn(`[${ts()}] Failed clearing abandoned checkout leads (non-blocking):`, clearErr?.message || clearErr);
    }
    console.log(`[${ts()}] Webhook: deal saved, transactionId=`, transactionId);
  } catch (err) {
    const paymentStatus = (Number(process.env.CARDCOM_TERMINAL) === 1000) ? 'TEST' : 'LIVE';
    console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
    console.error(`[${ts()}] Webhook: handleWebhookSuccess failed`, err);
  }
}

function pickFirstValue(source, keys = []) {
  const src = source && typeof source === 'object' ? source : {};
  for (const k of keys) {
    const val = src[k];
    if (val != null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
}

async function handleMasterRecurringWebhook(body = {}, query = {}) {
  let normalizedBody = body;
  if (typeof normalizedBody === 'string') {
    const parsed = Object.fromEntries(new URLSearchParams(normalizedBody));
    normalizedBody = parsed;
  }
  if (!normalizedBody || typeof normalizedBody !== 'object') {
    normalizedBody = {};
  }
  if (query && typeof query === 'object') {
    normalizedBody = { ...query, ...normalizedBody };
  }

  const secretExpected = String(process.env.CARDCOM_MASTER_RECURRING_SECRET || '').trim();
  // Cardcom table field is case-sensitive: Secret
  const secretReceived = normalizedBody.Secret != null ? String(normalizedBody.Secret).trim() : '';
  if (secretExpected && secretReceived !== secretExpected) {
    throw new Error('Invalid Cardcom MasterRecurring secret');
  }

  // Required case-sensitive fields from MasterRecurring table
  const cardcomAccountId =
    normalizedBody.AccountId != null && String(normalizedBody.AccountId).trim() !== ''
      ? String(normalizedBody.AccountId).trim()
      : '';
  const cardcomRecurringId =
    normalizedBody.RecurringId != null && String(normalizedBody.RecurringId).trim() !== ''
      ? String(normalizedBody.RecurringId).trim()
      : '';
  const cardcomToken = pickFirstValue(normalizedBody, ['Token', 'CardToken', 'TokenToSave']);
  const responseCodeRaw = pickFirstValue(normalizedBody, ['responsecode', 'ResponseCode']);
  const responseDescription = pickFirstValue(normalizedBody, [
    'responsdescription',
    'ResponsDescription',
    'ResponseDescription',
    'description',
    'Description',
  ]);
  const internalDealNumber = pickFirstValue(normalizedBody, ['internaldealnumber', 'InternalDealNumber']);
  const last4 = pickFirstValue(normalizedBody, ['Lest4Numbers', 'Last4Numbers']);
  const cardBrand = pickFirstValue(normalizedBody, ['MutagName', 'CardBrand', 'CardName']);
  const rawAmount = pickFirstValue(normalizedBody, ['amount', 'Amount', 'sumToBill', 'SumToBill']);
  const payerAmount = Number(rawAmount || 0);

  // Link key per requirement: InternalDealNumber or lowProfileCode
  const transactionId = internalDealNumber;
  const lowProfileCode = pickFirstValue(normalizedBody, ['lowProfileCode', 'LowProfileCode']);
  const paymentSuccess = String(responseCodeRaw || '1').trim() === '0';
  const paymentStatus = paymentSuccess ? 'paid' : 'failed';
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (!cardcomRecurringId && !cardcomAccountId && !cardcomToken) {
    console.warn(`[${ts()}] MasterRecurring webhook without identifiers`, normalizedBody);
    return;
  }

  const parent = await findDealForRecurringEvent({
    transactionId,
    lowProfileCode,
    cardcomRecurringId,
    cardcomAccountId,
    cardcomToken,
  });
  if (!parent) {
    console.warn(`[${ts()}] MasterRecurring webhook could not map parent deal`, {
      transactionId: transactionId || null,
      lowProfileCode: lowProfileCode || null,
      cardcomAccountId: cardcomAccountId || null,
      cardcomRecurringId: cardcomRecurringId || null,
      hasToken: !!cardcomToken,
    });
    return;
  }
  const fallbackTransactionId = [
    'RC',
    cardcomRecurringId || parent.cardcomRecurringId || 'unknown',
    billingMonth.replace('-', ''),
    Date.now(),
  ].join('-');
  const recurringTransactionId = transactionId || fallbackTransactionId;
  const mergedFormState = {
    ...(parent.formState || {}),
    cardcomResponseDescription: responseDescription,
    lastFourDigits: last4,
    cardBrand,
    cardcomRecurringId: cardcomRecurringId || parent.cardcomRecurringId || '',
  };
  await saveDeal({
    transactionId: recurringTransactionId,
    lowProfileCode,
    cardcomAccountId: cardcomAccountId || parent.cardcomAccountId || '',
    cardcomRecurringId: cardcomRecurringId || parent.cardcomRecurringId || '',
    cardcomToken: cardcomToken || '',
    payerAmount: Number.isFinite(payerAmount) && payerAmount > 0 ? payerAmount : Number(parent.payerAmount || 0),
    formState: mergedFormState,
    agentId: parent.agentId || null,
    paymentStatus,
    terminalNumber: Number(parent.terminalNumber || process.env.CARDCOM_TERMINAL || 0),
    source: 'cardcom-master-recurring-webhook',
    status: !paymentSuccess ? 'payment_arrears' : undefined,
    isRecurringCycle: true,
    parentDealId: parent.id,
    billingMonth,
    indicator: {
      responseCode: responseCodeRaw || null,
      responsdescription: responseDescription || null,
      internalDealNumber: internalDealNumber || null,
      Lest4Numbers: last4 || null,
      MutagName: cardBrand || null,
      cardcomAccountId: cardcomAccountId || null,
      cardcomRecurringId: cardcomRecurringId || null,
    },
  });
  await mergeDealCardcomRecurringIds(parent.transactionId, {
    cardcomAccountId,
    cardcomRecurringId,
    cardcomToken,
  });
  await syncParentFutureBillingAfterRecurringWebhook(
    parent.id,
    cardcomRecurringId || parent.cardcomRecurringId || '',
    { paymentSuccess, responseDescription }
  );
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
      source: 'site',
      landingSlug: '',
      opalEmail: OPAL_EMAIL,
    });
    console.log(`[${ts()}] Contact form saved to MongoDB`);
    res.json({ success: true, message: 'נשלח בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] Contact form error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשליחה' });
  }
});

/** צור קשר מדף נחיתה ייעודי — נשמר ב-contactLeads עם מקור */
app.post('/api/public/contact-lead', async (req, res) => {
  try {
    const { name = '', phone = '', message = '', landingSlug = '' } = req.body || {};
    if (!String(name).trim() || !String(phone).trim()) {
      return res.status(400).json({ success: false, error: 'נא למלא שם וטלפון' });
    }
    await saveContactLead({
      name: String(name).trim(),
      email: '',
      phone: String(phone).trim(),
      message: String(message).trim(),
      source: 'landing_contact',
      landingSlug: String(landingSlug).trim().toLowerCase(),
    });
    res.json({ success: true, message: 'נשלח בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] public/contact-lead error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה' });
  }
});

/** Lead: user filled checkout details but didn't continue to payment */
app.post('/api/public/abandoned-checkout-lead', async (req, res) => {
  try {
    const { name = '', phone = '', email = '', message = '', landingSlug = '' } = req.body || {};
    if (!String(phone).trim() && !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'נא לספק טלפון או אימייל' });
    }
    const result = await saveOrUpdateAbandonedCheckoutLead({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      message: String(message).trim(),
      landingSlug: String(landingSlug).trim().toLowerCase(),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(`[${ts()}] public/abandoned-checkout-lead error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה' });
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

/** Public B2B onboarding form: בקשת הצטרפות והזמנה */
app.post('/api/organization-join-request', async (req, res) => {
  try {
    const body = req.body || {};
    const company = body.company && typeof body.company === 'object' ? body.company : {};
    const contactPerson = body.contactPerson && typeof body.contactPerson === 'object' ? body.contactPerson : {};
    const accounting = body.accounting && typeof body.accounting === 'object' ? body.accounting : {};
    const additionalContact = body.additionalContact && typeof body.additionalContact === 'object' ? body.additionalContact : {};
    const generalData = body.generalData && typeof body.generalData === 'object' ? body.generalData : {};
    const billingMethod = String(body.billingMethod || '').trim();

    if (!String(company.companyName || '').trim()) {
      return res.status(400).json({ success: false, error: 'נדרש שם חברה' });
    }
    if (!String(contactPerson.name || '').trim() || !String(contactPerson.phone || '').trim()) {
      return res.status(400).json({ success: false, error: 'נדרשים שם וטלפון של איש הקשר הראשי' });
    }

    const billingType =
      String(billingMethod || '').toLowerCase() === 'private' ? 'Private' : 'Centralized';
    await createOrganizationCompany({
      companyName: String(company.companyName || '').trim(),
      companyId: String(company.companyId || '').trim(),
      officialAddress: String(company.officialAddress || '').trim(),
      companyEmail: String(company.companyEmail || '').trim(),
      fieldOfActivity: String(generalData.fieldOfActivity || '').trim(),
      employeesCount: Number(generalData.employeesCount || 0),
      billingType,
      billingMethod:
        billingType === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
      monthlyPricePerMember: 0,
      contactEmail: String(contactPerson.email || company.companyEmail || '').trim(),
      contactPhone: String(contactPerson.phone || '').trim(),
      notes: '',
      contactPerson: {
        name: String(contactPerson.name || '').trim(),
        role: String(contactPerson.role || '').trim(),
        phone: String(contactPerson.phone || '').trim(),
        mobile: String(contactPerson.mobile || '').trim(),
        email: String(contactPerson.email || '').trim(),
      },
      accounting: {
        name: String(accounting.name || '').trim(),
        role: String(accounting.role || '').trim(),
        phone: String(accounting.phone || '').trim(),
        mobile: String(accounting.mobile || '').trim(),
        email: String(accounting.email || '').trim(),
      },
      additionalContact: {
        name: String(additionalContact.name || '').trim(),
        role: String(additionalContact.role || '').trim(),
        phone: String(additionalContact.phone || '').trim(),
        mobile: String(additionalContact.mobile || '').trim(),
        email: String(additionalContact.email || '').trim(),
      },
      source: 'organization_join_request',
      status: 'Pending',
    });

    res.json({ success: true, message: 'הבקשה נקלטה בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] organization-join-request error:`, err);
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
    const primaryDigits = String(primaryId).replace(/\D/g, '');
    if (!validateIsraeliId(primaryDigits)) {
      return res.status(400).json({ success: false, error: ISRAELI_ID_INVALID_MSG });
    }
    const primaryIdNorm = formatIsraeliIdStored(primaryDigits) || primaryDigits.padStart(9, '0');

    const additionalMembers = Array.isArray(body.additionalMembers) ? body.additionalMembers : [];
    const beneficiaries = additionalMembers
      .map((m) => (m && typeof m === 'object' ? m : {}))
      .map((m) => ({
        firstName: String(m.firstName ?? '').trim(),
        lastName: String(m.lastName ?? '').trim(),
        id: String(m.id ?? '').trim(),
        dateOfBirth: String(m.dateOfBirth ?? '').trim(),
        gender: String(m.gender ?? '').trim(),
        maritalStatus: String(m.maritalStatus ?? '').trim(),
        healthFund: String(m.healthFund ?? '').trim(),
        supplementalInsurance: String(m.supplementalInsurance ?? '').trim(),
      }))
      .filter((m) => {
        // keep row only if it has some meaningful identity data
        return !!(m.firstName || m.lastName || m.id || m.dateOfBirth);
      });

    for (const m of beneficiaries) {
      const d = String(m.id || '').replace(/\D/g, '');
      if (!d) {
        return res.status(400).json({ success: false, error: 'חסרה תעודת זהות לאחד המוטבים הנוספים.' });
      }
      if (!validateIsraeliId(d)) {
        return res.status(400).json({ success: false, error: ISRAELI_ID_INVALID_MSG });
      }
    }
    const beneficiariesNorm = beneficiaries.map((m) => {
      const d = String(m.id || '').replace(/\D/g, '');
      return { ...m, id: formatIsraeliIdStored(d) || d.padStart(9, '0') };
    });

    const result = await saveBeneficiaryUpdate({
      transactionId,
      organizationName,
      agentName,
      primaryMember: {
        firstName: primaryFirstName,
        lastName: primaryLastName,
        id: primaryIdNorm,
        email: primaryEmail,
        phone: String(pm.phone ?? '').trim(),
        address: String(pm.address ?? '').trim(),
        dateOfBirth: String(pm.dateOfBirth ?? '').trim(),
        gender: String(pm.gender ?? '').trim(),
        maritalStatus: String(pm.maritalStatus ?? '').trim(),
        healthFund: String(pm.healthFund ?? '').trim(),
        supplementalInsurance: String(pm.supplementalInsurance ?? '').trim(),
      },
      additionalMembers: beneficiariesNorm,
    });

    // Generate beneficiary summary PDF from the consolidated subscription row.
    const deal = await getDealByTransactionId(transactionId);
    const pdfModel = buildBeneficiaryPdfModelFromDeal({
      transactionId,
      deal,
      primaryMember: {
        firstName: primaryFirstName,
        lastName: primaryLastName,
        id: primaryIdNorm,
        email: primaryEmail,
        phone: String(pm.phone ?? '').trim(),
        address: String(pm.address ?? '').trim(),
        dateOfBirth: String(pm.dateOfBirth ?? '').trim(),
        gender: String(pm.gender ?? '').trim(),
        maritalStatus: String(pm.maritalStatus ?? '').trim(),
        healthFund: String(pm.healthFund ?? '').trim(),
        supplementalInsurance: String(pm.supplementalInsurance ?? '').trim(),
      },
      additionalMembers: beneficiariesNorm,
      payerAmount: deal?.payerAmount,
    });
    const beneficiaryPdfBuffer = await generateBeneficiarySummaryPdfBuffer(pdfModel);
    const pdfDisk = await saveBeneficiarySummaryPdfToDisk({ transactionId, buffer: beneficiaryPdfBuffer });

    // Send beneficiary completion confirmation with transaction summary attachment only.
    try {
      const to = firstDefined(primaryEmail, deal?.formState?.email);
      if (to) {
        const attachments = buildBeneficiarySummaryAttachment({ transactionId, beneficiaryPdfBuffer });
        const primaryName = [primaryFirstName, primaryLastName].filter(Boolean).join(' ');
        await sendBeneficiaryCompletionEmail({
          to,
          orderNumber: transactionId,
          orderDate: new Date().toLocaleDateString('he-IL'),
          customerName: primaryName || 'לקוח',
          email: to,
          phone: firstDefined(pm.phone, deal?.formState?.phone),
          productName: firstDefined(deal?.formState?.productName, deal?.formState?.selectedPlanId),
          subscriptionType: firstDefined(deal?.formState?.productName, deal?.formState?.selectedPlanId),
          monthlyTotal: Number(deal?.payerAmount || 0),
          primaryBeneficiary: { name: primaryName || '—', idNumber: primaryIdNorm || '—' },
          secondaryBeneficiaries: beneficiariesNorm.map((b) => ({
            name: [String(b.firstName || '').trim(), String(b.lastName || '').trim()].filter(Boolean).join(' '),
            idNumber: String(b.id || '').trim(),
          })),
          attachments,
        });
      }
    } catch (mailErr) {
      console.error(`[${ts()}] beneficiary completion email failed:`, mailErr?.message || mailErr);
    }

    res.json({
      success: true,
      dealId: result.id,
      beneficiaryPdfPath: pdfDisk.fullPath,
    });
  } catch (err) {
    console.error(`[${ts()}] update-beneficiaries error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשמירה' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongoConfigured: !!(process.env.MONGODB_URI || process.env.MONGO_URL),
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
    if (!String(body.productName || body.name || '').trim()) {
      return res.status(400).json({ success: false, error: 'productName is required' });
    }
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
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const products = await listProducts({ activeOnly: !includeInactive });
    res.json({ success: true, products });
  } catch (e) {
    console.error(`[${ts()}] admin/products list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updateProduct(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/products update error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to update product' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/products delete error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to delete product' });
  }
});

app.post('/api/admin/vendors', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.vendorName || '').trim()) return res.status(400).json({ success: false, error: 'vendorName is required' });
    if (!String(body.idNum || '').trim()) return res.status(400).json({ success: false, error: 'idNum (ח.פ) is required' });
    const result = await createVendor(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/vendors create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to save vendor' });
  }
});

app.get('/api/admin/vendors', requireAdmin, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const vendors = await listVendors({ activeOnly: !includeInactive });
    res.json({ success: true, vendors });
  } catch (e) {
    console.error(`[${ts()}] admin/vendors list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch vendors' });
  }
});

app.put('/api/admin/vendors/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updateVendor(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/vendors update error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to update vendor' });
  }
});

app.delete('/api/admin/vendors/:id', requireAdmin, async (req, res) => {
  try {
    await deleteVendor(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/vendors delete error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to delete vendor' });
  }
});

app.get('/api/admin/vendor-cost', requireAdmin, async (req, res) => {
  try {
    const vendorId = String(req.query.vendorId || '').trim();
    const productId = String(req.query.productId || '').trim();
    if (!vendorId || !productId) {
      return res.status(400).json({ success: false, error: 'vendorId and productId are required' });
    }
    const data = await getVendorCostForProduct(vendorId, productId);
    if (!data) return res.status(404).json({ success: false, error: 'לא נמצא מחיר ספק למוצר זה אצל הספק' });
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] admin/vendor-cost error:`, e);
    res.status(500).json({ success: false, error: 'Failed to resolve vendor cost' });
  }
});

/** מחיר ספק + מק"ט לפי ספק ומוצר (מזהים ב-path) — דשבורד מחירון */
app.get('/api/vendor-products/:vendorId/:productId', requireAdmin, async (req, res) => {
  try {
    const vendorId = String(req.params.vendorId || '').trim();
    const productId = String(req.params.productId || '').trim();
    if (!vendorId || !productId) {
      return res.status(400).json({ success: false, error: 'vendorId and productId are required' });
    }
    const data = await getVendorCostForProduct(vendorId, productId);
    if (!data) {
      return res.status(404).json({ success: false, error: 'לא נמצא מחיר ספק למוצר זה אצל הספק' });
    }
    res.json({
      success: true,
      vendorCost: data.vendorCost,
      sku: data.sku,
      vendorName: data.vendorName,
    });
  } catch (e) {
    console.error(`[${ts()}] vendor-products/:vendorId/:productId error:`, e);
    res.status(500).json({ success: false, error: 'Failed to resolve vendor product cost' });
  }
});

app.post('/api/admin/pricing-entries', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.pricingName || '').trim()) return res.status(400).json({ success: false, error: 'pricingName is required' });
    if (!String(body.vendorId || '').trim()) return res.status(400).json({ success: false, error: 'vendorId is required' });
    if (!String(body.productId || '').trim()) return res.status(400).json({ success: false, error: 'productId is required' });
    const result = await createPricingEntry(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/pricing-entries create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to save pricing entry' });
  }
});

app.get('/api/admin/pricing-entries', requireAdmin, async (req, res) => {
  try {
    const entries = await listPricingEntries();
    res.json({ success: true, entries });
  } catch (e) {
    console.error(`[${ts()}] admin/pricing-entries list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch pricing entries' });
  }
});

app.put('/api/admin/pricing-entries/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updatePricingEntry(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/pricing-entries update error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to update pricing entry' });
  }
});

app.delete('/api/admin/pricing-entries/:id', requireAdmin, async (req, res) => {
  try {
    await deletePricingEntry(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/pricing-entries delete error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to delete pricing entry' });
  }
});

/** מחירונים רב-מוצריים (דפי נחיתה) */
app.get('/api/admin/price-lists', requireAdmin, async (req, res) => {
  try {
    const lists = await listPriceLists();
    res.json({ success: true, lists });
  } catch (e) {
    console.error(`[${ts()}] admin/price-lists list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to list price lists' });
  }
});

app.post('/api/admin/price-lists', requireAdmin, async (req, res) => {
  try {
    const result = await createPriceList(req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/price-lists create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to create price list' });
  }
});

app.get('/api/admin/price-lists/:id', requireAdmin, async (req, res) => {
  try {
    const row = await getPriceListById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, list: row });
  } catch (e) {
    console.error(`[${ts()}] admin/price-lists get error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load price list' });
  }
});

app.put('/api/admin/price-lists/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updatePriceList(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/price-lists update error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to update price list' });
  }
});

app.delete('/api/admin/price-lists/:id', requireAdmin, async (req, res) => {
  try {
    await deletePriceList(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/price-lists delete error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to delete price list' });
  }
});

/** תצוגה מקדימה: עמלת סוכן למוצר (למחירון) */
app.get('/api/admin/agent-commission-preview', requireAdmin, async (req, res) => {
  try {
    const fallback = Number(req.query.fallback || 0);
    const c = await getAgentCommissionForProduct(req.query.agentId, req.query.productId, fallback);
    res.json({ success: true, commission: c });
  } catch (e) {
    console.error(`[${ts()}] admin/agent-commission-preview error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed' });
  }
});

/** דפי נחיתה מעוצבים (בונה דפים) */
app.get('/api/admin/landing-pages', requireAdmin, async (req, res) => {
  try {
    const pages = await listLandingPages();
    res.json({ success: true, pages });
  } catch (e) {
    console.error(`[${ts()}] admin/landing-pages list error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed' });
  }
});

app.post('/api/admin/landing-pages', requireAdmin, async (req, res) => {
  try {
    const result = await createLandingPage(req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/landing-pages create error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed' });
  }
});

app.put('/api/admin/landing-pages/:id', requireAdmin, async (req, res) => {
  try {
    const page = await updateLandingPage(req.params.id, req.body || {});
    res.json({ success: true, page });
  } catch (e) {
    console.error(`[${ts()}] admin/landing-pages update error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed' });
  }
});

app.delete('/api/admin/landing-pages/:id', requireAdmin, async (req, res) => {
  try {
    await deleteLandingPage(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/landing-pages delete error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed' });
  }
});

/** דף נחיתה — מוצרים ומחירים בלבד */
app.get('/api/public/price-list/:id', async (req, res) => {
  try {
    const data = await getPublicPriceListById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Price list not found' });
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] public/price-list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load price list' });
  }
});

/** דף נחיתה מלא: תוכן + מחירון לפי slug (אנגלית קטנה) */
app.get('/api/public/landing/:slug', async (req, res) => {
  try {
    const data = await getPublicLandingPageBySlug(req.params.slug);
    if (!data) return res.status(404).json({ success: false, error: 'Landing page not found' });
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] public/landing error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load landing page' });
  }
});

/** רשימת סוכנים לטופס צ'ק-אאוט (ללא אימות) */
app.get('/api/public/agents', async (req, res) => {
  try {
    const agents = await listPublicSalesAgents();
    res.json({ success: true, agents });
  } catch (e) {
    console.error(`[${ts()}] public/agents error:`, e);
    res.status(500).json({ success: false, error: 'Failed to list agents' });
  }
});

/** אחרי תשלום — מחזיר מס׳ הזמנה (transactionId) מהמסד לפי LowProfileCode של Cardcom */
app.get('/api/public/deal-lookup', async (req, res) => {
  try {
    const code = String(req.query.lowProfileCode ?? req.query.LowProfileCode ?? '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'חסר lowProfileCode' });
    }
    const data = await findDealByLowProfileCode(code);
    if (!data || !data.transactionId) {
      return res.json({ success: true, found: false });
    }
    res.json({
      success: true,
      found: true,
      transactionId: data.transactionId,
      paymentStatus: data.paymentStatus || '',
    });
  } catch (e) {
    console.error(`[${ts()}] public/deal-lookup error:`, e);
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
});

/** הקשר עסקה לטופס מוטבים (ארגון/סוכן/מספר מוטבים בלבד — לא פרטי מוטבים) */
app.get('/api/public/deal-context', async (req, res) => {
  try {
    const tid = String(req.query.transactionId ?? '').trim();
    if (!tid) {
      return res.status(400).json({ success: false, error: 'חסר transactionId' });
    }
    const data = await getPublicDealContext(tid);
    if (!data) {
      return res.status(404).json({ success: false, error: 'עסקה לא נמצאה' });
    }
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] public/deal-context error:`, e);
    res.status(500).json({ success: false, error: 'Failed' });
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
      if (!String(line.vendorId || '').trim()) {
        return res.status(400).json({ success: false, error: 'כל שורה חייבת vendorId (ספק) לחישוב עלות' });
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

app.get('/api/public/organization/:id', async (req, res) => {
  try {
    const o = await getPublicOrganizationForRegistration(req.params.id);
    if (!o) return res.status(404).json({ success: false, error: 'ארגון לא נמצא' });
    res.json({ success: true, organization: o });
  } catch (e) {
    console.error(`[${ts()}] public/organization error:`, e);
    res.status(500).json({ success: false, error: 'שגיאה' });
  }
});

app.get('/api/admin/organizations', requireAdmin, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const rows = await getOrganizationCompaniesWithMemberCounts(400, { activeOnly: !includeInactive });
    res.json({ success: true, rows });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch organizations' });
  }
});

app.get('/api/admin/organizations/import-template-xlsx', requireAdmin, (req, res) => {
  try {
    const buf = buildOrgImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="opal-org-import-template.xlsx"');
    res.send(buf);
  } catch (e) {
    console.error(`[${ts()}] org import template error:`, e);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

app.get('/api/admin/organizations/:id', requireAdmin, async (req, res) => {
  try {
    const o = await getOrganizationCompanyById(req.params.id);
    if (!o) return res.status(404).json({ success: false, error: 'לא נמצא' });
    const activeMemberCount = await countActiveMembersByOrganizationId(req.params.id);
    res.json({ success: true, organization: { ...o, activeMemberCount } });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations/:id error:`, e);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

app.get('/api/admin/organizations/:id/deals', requireAdmin, async (req, res) => {
  try {
    const deals = await findDealsByOrganizationId(req.params.id, 500);
    res.json({ success: true, deals });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations/:id/deals error:`, e);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

app.get('/api/admin/organizations/:id/payments', requireAdmin, async (req, res) => {
  try {
    const rows = await getOrganizationMonthlyPayments(req.params.id, Number(req.query.months) || 12);
    res.json({ success: true, rows });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations/:id/payments error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed' });
  }
});

app.post(
  '/api/admin/organizations/:id/import-members',
  requireAdmin,
  orgImportUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'לא הועלה קובץ' });
      }
      const org = await getOrganizationCompanyById(req.params.id);
      if (!org) return res.status(404).json({ success: false, error: 'ארגון לא נמצא' });
      const price = Number(org.monthlyPricePerMember || 0);
      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'הגדרו מחיר חודשי לחבר בפרופיל הארגון לפני ייבוא',
        });
      }
      const { headerErrors, normalizedRows } = parseOrgMemberImportBuffer(req.file.buffer);
      if (headerErrors.length) {
        return res.status(400).json({
          success: false,
          error: 'שגיאות בכותרות הקובץ',
          headerErrors,
          created: 0,
          skippedDuplicates: 0,
          validationFailures: [],
        });
      }
      const orgName = org.companyName || org.name || '';
      let created = 0;
      let skippedDuplicates = 0;
      const validationFailures = [];
      for (const nr of normalizedRows) {
        if (!nr.ok) {
          validationFailures.push({ line: nr.lineNumber, messages: nr.messages });
          continue;
        }
        const r = await insertOrganizationImportedDeal({
          organizationId: org.id,
          organizationName: orgName,
          monthlyPrice: price,
          ...nr.profile,
          subscriptionProductName: String(org.subscriptionProductName || '').trim(),
        });
        if (r.skipped) skippedDuplicates += 1;
        else created += 1;
      }
      res.json({ success: true, created, skippedDuplicates, validationFailures });
    } catch (e) {
      console.error(`[${ts()}] org import-members error:`, e);
      res.status(500).json({ success: false, error: e?.message || 'ייבוא נכשל' });
    }
  }
);

app.post('/api/admin/organizations', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.companyName || '').trim()) {
      return res.status(400).json({ success: false, error: 'companyName is required' });
    }
    const result = await createOrganizationCompany(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to create organization' });
  }
});

app.put('/api/admin/organizations/:id', requireAdmin, async (req, res) => {
  try {
    await updateOrganizationCompany(req.params.id, req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations update error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', requireAdmin, async (req, res) => {
  try {
    await deleteOrganizationCompany(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/organizations delete error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to delete organization' });
  }
});

app.put('/api/admin/leads/:kind/:id', requireAdmin, async (req, res) => {
  try {
    const kind = String(req.params.kind || '').trim();
    if (!['private', 'corporate'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Invalid lead kind' });
    }
    await updateLeadAdmin(kind, req.params.id, req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/leads update error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to update lead' });
  }
});

/** Aggregated dashboard: לקוחות ללא טופס מוטבים, פיגור תשלום, פניות, וכו׳ */
app.get('/api/admin/control-panel', requireAdmin, async (req, res) => {
  try {
    const { fromDate = '', toDate = '', month = '' } = req.query || {};
    const dashboard = await getControlPanelOverviewData({ fromDate, toDate, month });
    res.json({
      success: true,
      ...dashboard,
    });
  } catch (e) {
    console.error(`[${ts()}] admin/control-panel error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load control panel' });
  }
});

app.post('/api/admin/control-panel/handle', requireAdmin, async (req, res) => {
  try {
    const { type = '', id = '', handled = true } = req.body || {};
    await markControlPanelItemHandled(type, id, handled !== false);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/control-panel/handle error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to mark item' });
  }
});

app.put('/api/admin/contact-hub/:kind/:id', requireAdmin, async (req, res) => {
  try {
    await updateContactHubItem(req.params.kind, req.params.id, req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/contact-hub update error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to update contact item' });
  }
});

/** עדכון עסקה (מנוי) — מיזוג ל־formState */
app.put('/api/admin/deals/:id', requireAdmin, async (req, res) => {
  try {
    try {
      validateDealPatchIsraeliIdsOrThrow(req.body || {});
    } catch (idErr) {
      return res.status(400).json({ success: false, error: idErr.message || ISRAELI_ID_INVALID_MSG });
    }
    await updateDealAdmin(req.params.id, req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/deals update error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to update deal' });
  }
});

app.get('/api/admin/deals/:id/billing-history', requireAdmin, async (req, res) => {
  try {
    const payload = await getSubscriberBillingHistoryByDealId(req.params.id, Number(req.query.limit || 120));
    res.json({ success: true, ...payload });
  } catch (e) {
    console.error(`[${ts()}] admin/deals/:id/billing-history error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to load billing history' });
  }
});

app.delete('/api/admin/deals/:id', requireAdmin, async (req, res) => {
  try {
    await deleteDealAdmin(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/deals delete error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to delete deal' });
  }
});

app.delete('/api/subscriptions/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const out = await bulkDeleteDealsAdmin(ids);
    res.json({ success: true, ...out });
  } catch (e) {
    console.error(`[${ts()}] subscriptions/bulk-delete error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to bulk delete subscriptions' });
  }
});

/** עצירת חיוב עתידי במנוי (Cardcom recurring) + סימון ביטול במסד */
app.post('/api/admin/deals/:id/cancel-future-charges', requireAdmin, async (req, res) => {
  try {
    const deal = await getDealForRecurringCancellation(req.params.id);
    if (!deal.cardcomAccountId || !deal.cardcomRecurringId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription was not created as recurring - cancel manually in Cardcom',
      });
    }

    const cardcom = await stopRecurringProfile({
      cardcomAccountId: deal.cardcomAccountId,
      cardcomRecurringId: deal.cardcomRecurringId,
      lowProfileCode: deal.lowProfileCode,
      terminalNumber: deal.terminalNumber,
    });
    if (Number(cardcom.responseCode) !== 0) {
      return res.status(502).json({
        success: false,
        error: cardcom.description || 'Cardcom recurring stop failed',
        cardcom,
      });
    }

    const updated = await markDealCancelledByAdmin(req.params.id);

    res.json({
      success: true,
      message: 'החיובים העתידיים בוטלו בהצלחה החל מהמחזור הבא',
      cardcom,
      ...updated,
    });
  } catch (e) {
    console.error(`[${ts()}] admin/deals cancel-future-charges error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to cancel future charges' });
  }
});

/** ביטול מדורג לעובד ארגוני (חיוב מרוכז) — Pending Cancellation */
app.post('/api/admin/deals/:id/cancel-org-employee', requireAdmin, async (req, res) => {
  try {
    const { terminationDate } = req.body || {};
    if (!terminationDate) return res.status(400).json({ success: false, error: 'terminationDate is required' });
    const result = await markDealPendingCancellation(req.params.id, terminationDate);
    res.json(result);
  } catch (e) {
    console.error(`[${ts()}] cancel-org-employee error:`, e);
    res.status(400).json({ success: false, error: e.message || 'ביטול נכשל' });
  }
});

/** הרצה ידנית של Snapshot חודשי (לטסטינג ולאחזור) */
app.post('/api/admin/org-snapshot/run', requireAdmin, async (req, res) => {
  try {
    const { snapshotDate } = req.body || {};
    const result = await runMonthlyOrgSnapshot(snapshotDate || null);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] org-snapshot/run error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Snapshot נכשל' });
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
    const b = body.bankDetails || {};
    if (!String(body.agentName || '').trim()) return res.status(400).json({ success: false, error: 'agentName is required' });
    if (!String(body.idNum || '').trim()) return res.status(400).json({ success: false, error: 'idNum is required' });
    if (!String(b.bankName || '').trim()) return res.status(400).json({ success: false, error: 'bankName is required' });
    if (!String(b.accountHolder || '').trim()) return res.status(400).json({ success: false, error: 'accountHolder is required' });
    const result = await createSalesAgent(body);
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error(`[${ts()}] admin/agents create error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to save agent' });
  }
});

app.get('/api/admin/agents', requireAdmin, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const rows = await listSalesAgentsWithSales({ activeOnly: !includeInactive });
    res.json({ success: true, rows });
  } catch (e) {
    console.error(`[${ts()}] admin/agents list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

app.get('/api/admin/archive', requireAdmin, async (req, res) => {
  try {
    const data = await getArchiveSnapshot(500);
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] admin/archive error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to load archive' });
  }
});

app.get('/api/admin/alerts-summary', requireAdmin, async (req, res) => {
  try {
    const payload = await getAlertsSummary({
      month: req.query.month || '',
      fromDate: req.query.fromDate || '',
      toDate: req.query.toDate || '',
      status: req.query.status || '',
    });
    res.json({ success: true, ...payload });
  } catch (e) {
    console.error(`[${ts()}] admin/alerts-summary error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to load alerts summary' });
  }
});

app.post('/api/admin/archive/:entity/:id/restore', requireAdmin, async (req, res) => {
  try {
    await restoreArchiveItem(req.params.entity, req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/archive restore error:`, e);
    res.status(400).json({ success: false, error: e.message || 'Failed to restore item' });
  }
});

app.put('/api/admin/agents/:id', requireAdmin, async (req, res) => {
  try {
    const result = await updateSalesAgent(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] admin/agents update error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to update agent' });
  }
});

app.delete('/api/admin/agents/:id', requireAdmin, async (req, res) => {
  try {
    await deleteSalesAgent(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] admin/agents delete error:`, e);
    res.status(500).json({ success: false, error: e.message || 'Failed to delete agent' });
  }
});

function subscribersDashboardQuery(req) {
  const summaryCategories = String(req.query.summaryCategories || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return {
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
    productNameSearch: req.query.productNameSearch || '',
    agentNameSearch: req.query.agentNameSearch || '',
    amountDue: req.query.amountDue || '0',
    summaryCategories,
    customerSegment: req.query.customerSegment || 'all',
  };
}

app.get('/api/admin/subscribers-dashboard', requireAdmin, async (req, res) => {
  try {
    const data = await getSalesDashboardData(subscribersDashboardQuery(req));
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] admin/subscribers-dashboard error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load subscribers' });
  }
});

app.get('/api/admin/sales-dashboard', requireAdmin, async (req, res) => {
  try {
    const data = await getSalesDashboardData(subscribersDashboardQuery(req));
    res.json({ success: true, ...data });
  } catch (e) {
    console.error(`[${ts()}] admin/sales-dashboard error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load sales dashboard' });
  }
});

/** דוחות ובילינג — אופאל */
app.get('/api/admin/reports/subscribers-export', requireAdmin, async (req, res) => {
  try {
    const fromDate = req.query.fromDate || req.query.from || '';
    const toDate = req.query.toDate || req.query.to || '';
    const provider = String(req.query.provider || '').trim();
    const allDeals = await findDealsCreatedInRange(fromDate || null, toDate || null);
    const deals = provider ? filterDealsByProvider(allDeals, provider) : allDeals;
    const csv = buildSubscribersCsv(deals);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="opal-subscribers-by-person.csv"');
    res.send(csv);
  } catch (e) {
    console.error(`[${ts()}] reports/subscribers-export error:`, e);
    res.status(500).json({ success: false, error: 'Failed to build export' });
  }
});

app.get('/api/admin/reports/subscribers-export-xlsx', requireAdmin, async (req, res) => {
  try {
    const fromDate = req.query.fromDate || req.query.from || '';
    const toDate = req.query.toDate || req.query.to || '';
    const provider = String(req.query.provider || '').trim();
    const allDeals = await findDealsCreatedInRange(fromDate || null, toDate || null);
    const deals = provider ? filterDealsByProvider(allDeals, provider) : allDeals;
    const file = await buildSubscribersXlsxBuffer(deals);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="opal-subscribers-by-person.xlsx"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(file);
  } catch (e) {
    console.error(`[${ts()}] reports/subscribers-export-xlsx error:`, e);
    res.status(500).json({ success: false, error: 'Failed to build XLSX export' });
  }
});

app.get('/api/admin/reports/providers', requireAdmin, async (req, res) => {
  try {
    const vendors = await listVendors({ limit: 1000 });
    const providers = (Array.isArray(vendors) ? vendors : [])
      .map((v) => String(v.vendorName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'he'));
    res.json({ success: true, providers });
  } catch (e) {
    console.error(`[${ts()}] reports/providers error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load providers' });
  }
});

app.get('/api/admin/reports/subscribers-preview', requireAdmin, async (req, res) => {
  try {
    const fromDate = req.query.fromDate || req.query.from || '';
    const toDate = req.query.toDate || req.query.to || '';
    const provider = String(req.query.provider || '').trim();
    const allDeals = await findDealsCreatedInRange(fromDate || null, toDate || null);
    const deals = provider ? filterDealsByProvider(allDeals, provider) : allDeals;
    const allRows = generateFlattenedSubscriberRows(deals);
    res.json({ success: true, rows: allRows.slice(0, 200), totalRows: allRows.length });
  } catch (e) {
    console.error(`[${ts()}] reports/subscribers-preview error:`, e);
    res.status(500).json({ success: false, error: 'Failed to build preview' });
  }
});

app.get('/api/admin/reports/cancellations-export', requireAdmin, async (req, res) => {
  try {
    const fromDate = req.query.fromDate || req.query.from || '';
    const toDate = req.query.toDate || req.query.to || '';
    const deals = await findDealsCancelledInRange(fromDate || null, toDate || null);
    const csv = buildCancellationsCsv(deals);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="opal-cancellations.csv"');
    res.send(csv);
  } catch (e) {
    console.error(`[${ts()}] reports/cancellations-export error:`, e);
    res.status(500).json({ success: false, error: 'Failed to build export' });
  }
});

app.get('/api/admin/reports/agent-commissions', requireAdmin, async (req, res) => {
  try {
    const agentId = String(req.query.agentId || '').trim();
    const month = String(req.query.month || '').trim();
    if (!agentId || !month) {
      return res.status(400).json({ success: false, error: 'נדרשים agentId ו-month (YYYY-MM)' });
    }
    const deals = await findDealsByAgentAndMonth(agentId, month);
    const payload = await buildAgentCommissionPayload(deals);
    res.json({ success: true, ...payload });
  } catch (e) {
    console.error(`[${ts()}] reports/agent-commissions error:`, e);
    res.status(500).json({ success: false, error: 'Failed to load agent commissions' });
  }
});

app.get('/api/admin/monthly-invoices', requireAdmin, async (req, res) => {
  try {
    const invMonth = String(req.query.month || '').trim();
    const list = await listMonthlyInvoices(Number(req.query.limit) || 300, invMonth || null);
    res.json({ success: true, invoices: list });
  } catch (e) {
    console.error(`[${ts()}] monthly-invoices list error:`, e);
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
});

app.post('/api/admin/monthly-invoices/generate', requireAdmin, async (req, res) => {
  try {
    const month = String(req.body?.month || req.query.month || '').trim();
    const result = await generateMonthlyInvoicesForMonth(month);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(`[${ts()}] monthly-invoices generate error:`, e);
    res.status(400).json({ success: false, error: e?.message || 'Generate failed' });
  }
});

app.put('/api/admin/monthly-invoices/:id', requireAdmin, async (req, res) => {
  try {
    await updateMonthlyInvoice(req.params.id, req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error(`[${ts()}] monthly-invoices update error:`, e);
    res.status(400).json({ success: false, error: e?.message || 'Update failed' });
  }
});

// SPA fallback – serve index.html for any non-API path (regex avoids path-to-regexp '*' error on Express 4.21+)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(resolve(STATIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${ts()}] Opal API listening on http://0.0.0.0:${PORT}`);
  if (!(process.env.MONGODB_URI || process.env.MONGO_URL)) {
    console.warn(`[${ts()}] MONGODB_URI/MONGO_URL not set`);
  }
  if (!process.env.CARDCOM_TERMINAL) console.warn(`[${ts()}] CARDCOM_TERMINAL not set`);
});
