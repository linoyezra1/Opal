/**
 * Opal API – Cardcom checkout + webhook → Google Sheets.
 * Requires: .env with CARDCOM_*, GOOGLE_SHEET_ID, BASE_URL; service-account.json for Sheets.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createLowProfileDeal, getLowProfileIndicator } from './cardcomService.js';
import {
  appendPayerAndBeneficiaries,
  appendToSheetTab,
  formPayloadToSheetParams,
  loadCredentialsFromFile,
} from './googleSheetsService.js';
import { resolve } from 'path';

try {
  dotenv.config();
} catch (e) {
  console.warn('Failed to load .env via dotenv:', e?.message || e);
}

const app = express();
const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
/** Frontend app URL for post-payment redirect (Cardcom sends user here after success). */
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/** Precise timestamp for logging (HH:mm:ss.SSS) */
function ts() {
  const d = new Date();
  const hms = d.toTimeString().slice(0, 8);
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
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

function getCredentials() {
  const paths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), '..', 'service-account.json'),
    resolve(process.cwd(), '..', 'service-account.json.json'),
  ].filter(Boolean);
  for (const p of paths) {
    try {
      return loadCredentialsFromFile(p);
    } catch {
      continue;
    }
  }
  throw new Error('service-account.json not found. Place it in server folder or set GOOGLE_APPLICATION_CREDENTIALS.');
}

/** Build sheet payload with safe fallbacks so missing metadata never crashes the webhook. */
function buildSheetPayloadFromFormState(formState) {
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
  return { payer, beneficiaries };
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
 * Process webhook in background: confirm deal with Cardcom, then write to sheet.
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

    const transactionId =
      indicator?.internalDealNumber != null ? String(indicator.internalDealNumber) : lowProfileCode;
    const payerAmount = typeof pending.payerAmount === 'number' ? pending.payerAmount : 0;
    const sheetPayload = buildSheetPayloadFromFormState(pending.formState);
    const params = formPayloadToSheetParams(sheetPayload, transactionId, payerAmount);

    if (!SHEET_ID) {
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
      console.warn(`[${ts()}] Webhook: GOOGLE_SHEET_ID not set, skipping sheet write`);
      return;
    }

    let auth;
    try {
      auth = getCredentials();
    } catch (e) {
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
      console.error(`[${ts()}] Webhook: getCredentials failed`, e.message);
      return;
    }

    console.log(`[${ts()}] Attempting to write to Google Sheets...`);
    let result;
    try {
      result = await appendPayerAndBeneficiaries({
        spreadsheetId: SHEET_ID,
        auth,
        ...params,
        terminalNumber: terminalNum,
      });
    } catch (sheetErr) {
      console.log(`[${ts()}] Google Sheets write failed`);
      console.error(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`, sheetErr);
      throw sheetErr;
    }

    if (result.duplicate) {
      console.log(`[${ts()}] Google Sheets write completed (duplicate skipped)`);
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE (duplicate)`);
    } else {
      console.log(`[${ts()}] Google Sheets write completed`);
      console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: SUCCESS`);
    }
    console.log(`[${ts()}] Webhook: sheet updated, transactionId=`, transactionId);
  } catch (err) {
    const paymentStatus = (Number(process.env.CARDCOM_TERMINAL) === 1000) ? 'TEST' : 'LIVE';
    console.log(`[${ts()}] Payment status: ${paymentStatus} - Result: FAILURE`);
    console.error(`[${ts()}] Webhook: handleWebhookSuccess failed`, err);
  }
}

/** Tab names in the same spreadsheet for contact / organization forms */
const SHEET_TAB_CONTACT = 'צרו קשר';
const SHEET_TAB_ORGANIZATION = 'רשום ארגון';
const OPAL_EMAIL = process.env.OPAL_EMAIL || 'opal2000@zahav.net.il';

/**
 * POST /api/contact – "צרו קשר" form. Body: { name, email, phone, message }.
 * Appends to sheet tab "צרו קשר"; optionally notify Opal (email can be wired via OPAL_EMAIL).
 */
app.post('/api/contact', async (req, res) => {
  try {
    const { name = '', email = '', phone = '', message = '' } = req.body || {};
    const row = [
      new Date().toISOString(),
      String(name).trim(),
      String(email).trim(),
      String(phone).trim(),
      String(message).trim(),
    ];
    if (!SHEET_ID) {
      console.log(`[${ts()}] Contact form (no sheet):`, row);
      return res.json({ success: true, message: 'נשלח' });
    }
    const auth = getCredentials();
    await appendToSheetTab({
      spreadsheetId: SHEET_ID,
      auth,
      sheetTitle: SHEET_TAB_CONTACT,
      rows: [row],
    });
    console.log(`[${ts()}] Contact form appended to "${SHEET_TAB_CONTACT}"`);
    res.json({ success: true, message: 'נשלח בהצלחה' });
  } catch (err) {
    console.error(`[${ts()}] Contact form error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשליחה' });
  }
});

/**
 * POST /api/organization – "רשום ארגון" form. Body: { organizationName, contactName, phone, email, notes }.
 * Appends to sheet tab "רשום ארגון".
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
    const row = [
      new Date().toISOString(),
      String(organizationName).trim(),
      String(contactName).trim(),
      String(phone).trim(),
      String(email).trim(),
      String(notes).trim(),
    ];
    if (!SHEET_ID) {
      console.log(`[${ts()}] Organization form (no sheet):`, row);
      return res.json({ success: true, message: 'נשלח' });
    }
    const auth = getCredentials();
    await appendToSheetTab({
      spreadsheetId: SHEET_ID,
      auth,
      sheetTitle: SHEET_TAB_ORGANIZATION,
      rows: [row],
    });
    console.log(`[${ts()}] Organization form appended to "${SHEET_TAB_ORGANIZATION}"`);
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
 * Writes primary (status 1) + additional members (status 0) with same Transaction ID.
 * Uses appendPayerAndBeneficiaries (Google Sheets writer).
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

    if (!SHEET_ID) {
      // For local dev without sheet configured, just echo payload.
      console.log(`[${ts()}] update-beneficiaries (no sheet):`, { transactionId, organizationName, agentName, primaryMember: pm, beneficiaries });
      return res.json({ success: true, message: 'נשמר (ללא חיבור לגיליון).' });
    }

    const auth = getCredentials();
    const terminalNum = Number(process.env.CARDCOM_TERMINAL ?? 0) || 0;

    const result = await appendPayerAndBeneficiaries({
      spreadsheetId: SHEET_ID,
      auth,
      transactionId,
      payerAmount: 0,
      payer: {
        fullName: `${primaryFirstName} ${primaryLastName}`.trim(),
        id: primaryId,
        email: primaryEmail,
        agentName,
        organizationName,
        planId: '',
        planSku: '',
        dateOfBirth: String(pm.dateOfBirth ?? '').trim(),
        maritalStatus: String(pm.maritalStatus ?? '').trim(),
        healthFund: String(pm.healthFund ?? '').trim(),
        supplementalInsurance: String(pm.supplementalInsurance ?? '').trim(),
        // phone/address are intentionally accepted on frontend but not mapped to the sheet writer yet
      },
      beneficiaries,
      terminalNumber: terminalNum,
    });

    res.json({
      success: true,
      appendedCount: result.appendedCount,
      duplicate: !!result.duplicate,
      payerRowIndex: result.payerRowIndex,
    });
  } catch (err) {
    console.error(`[${ts()}] update-beneficiaries error:`, err);
    res.status(500).json({ success: false, error: err.message || 'שגיאה בשמירה' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    sheetIdConfigured: !!SHEET_ID,
    cardcomConfigured: !!(process.env.CARDCOM_TERMINAL && process.env.CARDCOM_USER),
  });
});

// SPA fallback – serve index.html for any non-API path (regex avoids path-to-regexp '*' error on Express 4.21+)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(resolve(STATIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${ts()}] Opal API listening on http://0.0.0.0:${PORT}`);
  if (!SHEET_ID) console.warn(`[${ts()}] GOOGLE_SHEET_ID not set`);
  if (!process.env.CARDCOM_TERMINAL) console.warn(`[${ts()}] CARDCOM_TERMINAL not set`);
});
