#!/usr/bin/env node
import dotenv from 'dotenv';
import {
  saveDeal,
  saveBeneficiaryUpdate,
  getDealByTransactionId,
  markDealOrderEmailSent,
  saveContactLead,
} from '../server/mongoService.js';
import { sendOrderConfirmationEmail, sendBeneficiaryCompletionEmail } from '../server/emailService.js';
import {
  generateBeneficiarySummaryPdfBuffer,
  saveBeneficiarySummaryPdfToDisk,
} from '../server/beneficiaryPdfService.js';
import { candidateDocPdfPaths, readFirstExistingFile } from '../server/repoAssets.js';

dotenv.config();

function firstDefined(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function buildBeneficiaryPdfModelFromDeal({ transactionId, deal, primaryMember, additionalMembers, payerAmount }) {
  const fsState = deal?.formState || {};
  const beneficiaryUpdate = deal?.beneficiaryUpdate && typeof deal.beneficiaryUpdate === 'object'
    ? deal.beneficiaryUpdate
    : {};
  const purchaseDate = deal?.createdAt
    ? new Date(deal.createdAt).toISOString().slice(0, 10)
    : '';
  const subscriptionStartDate = firstDefined(
    fsState.subscriptionStartDate,
    beneficiaryUpdate.submittedAt
      ? new Date(beneficiaryUpdate.submittedAt).toISOString().slice(0, 10)
      : ''
  );
  const primary = primaryMember || {};
  const additional = Array.isArray(additionalMembers) ? additionalMembers : [];
  const tid = String(transactionId || '');
  const digitsOnly = tid.replace(/\D/g, '');
  const numerator =
    digitsOnly.length >= 6 ? digitsOnly.slice(-6) : tid.replace(/[^0-9A-Za-z]/g, '').slice(0, 8) || '—';
  return {
    orderNumber: tid,
    orderDate: purchaseDate,
    numerator,
    customerName: firstDefined([primary.firstName, primary.lastName].filter(Boolean).join(' '), fsState.fullName),
    customerId: firstDefined(primary.id, fsState.id),
    subscriptionStartDate,
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
  const files = ['גילוי נאות.pdf', 'כתב שירות.pdf'];
  const attachments = [];
  for (const filename of files) {
    try {
      const { buffer } = await readFirstExistingFile(candidateDocPdfPaths(filename), filename);
      attachments.push({ filename, content: buffer });
    } catch (err) {
      // Non-blocking for simulation environments where docs might be missing.
      console.warn(`[simulate-flow] legal doc missing: ${filename} (${err?.message || err})`);
    }
  }
  return attachments;
}

async function main() {
  if (!String(process.env.MONGODB_URI || process.env.MONGO_URL || '').trim()) {
    throw new Error('MONGODB_URI/MONGO_URL is not set. Configure DB env and rerun.');
  }
  const customer = {
    fullName: 'לינוי סקריפט',
    email: 'linoy05353@gmail.com',
    phone: '0535314055',
    id: '123456782',
  };
  const beneficiaries = [
    { firstName: 'מוטב', lastName: 'הדמיה א', id: '123456789', relation: 'שיננית' },
    { firstName: 'מוטב', lastName: 'הדמיה ב', id: '987654321', relation: 'רופא עד הבית' },
  ];

  const transactionId = `SIM-${Date.now()}`;
  const lowProfileCode = `LP-SIM-${Date.now()}`;
  const monthlyAmount = 189;

  console.log(`[simulate-flow] creating paid order: ${transactionId}`);
  await saveDeal({
    transactionId,
    lowProfileCode,
    cardcomAccountId: `SIM-ACC-${Date.now()}`,
    cardcomRecurringId: `SIM-REC-${Date.now()}`,
    cardcomToken: `SIM-TOK-${Date.now()}`,
    payerAmount: monthlyAmount,
    paymentStatus: 'paid',
    terminalNumber: 1000,
    source: 'simulate-customer-flow-script',
    indicator: {
      responseCode: 0,
      responsdescription: 'Approved',
      processEndOk: true,
      dealResponse: 1,
      internalDealNumber: transactionId,
    },
    formState: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      id: customer.id,
      productName: 'רופא עד הבית',
      selectedPlanId: 'sim-plan-home-doctor',
      lastFourDigits: '1111',
      address: 'כתובת בדיקה 1',
      landingPageSlug: 'simulation-flow',
      landingFlow: true,
    },
  });

  console.log('[simulate-flow] saving contact lead for Contact Hub');
  await saveContactLead({
    name: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    message: 'פנייה מדף נחיתה פג תוקף',
    source: 'landing_contact',
    landingSlug: 'simulation-flow',
    category: 'דמו אוטומציה',
    leadStatus: 'חדש',
  });

  console.log('[simulate-flow] saving beneficiary update');
  await saveBeneficiaryUpdate({
    transactionId,
    organizationName: '',
    agentName: '',
    primaryMember: {
      firstName: 'לינוי',
      lastName: 'סקריפט',
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      address: 'כתובת בדיקה 1',
      dateOfBirth: '1990-01-01',
      maritalStatus: 'רווקה',
      healthFund: 'כללית',
      supplementalInsurance: 'מושלם',
    },
    additionalMembers: beneficiaries.map((b) => ({
      firstName: b.firstName,
      lastName: b.lastName,
      id: b.id,
      relation: b.relation,
      dateOfBirth: '1995-01-01',
    })),
  });

  const savedDeal = await getDealByTransactionId(transactionId);
  if (!savedDeal) throw new Error('deal not found after save');

  const primaryMember = {
    firstName: 'לינוי',
    lastName: 'סקריפט',
    id: customer.id,
    email: customer.email,
    phone: customer.phone,
    address: 'כתובת בדיקה 1',
    dateOfBirth: '1990-01-01',
    maritalStatus: 'רווקה',
    healthFund: 'כללית',
    supplementalInsurance: 'מושלם',
  };

  console.log('[simulate-flow] generating beneficiary summary PDF');
  const pdfModel = buildBeneficiaryPdfModelFromDeal({
    transactionId,
    deal: savedDeal,
    primaryMember,
    additionalMembers: beneficiaries,
    payerAmount: savedDeal.payerAmount,
  });
  const beneficiaryPdfBuffer = await generateBeneficiarySummaryPdfBuffer(pdfModel);
  const pdfSaved = await saveBeneficiarySummaryPdfToDisk({ transactionId, buffer: beneficiaryPdfBuffer });
  const generatedPdfAttachment = [
    {
      filename: `beneficiary-summary-${transactionId}.pdf`,
      content: beneficiaryPdfBuffer,
    },
  ];

  console.log('[simulate-flow] sending order confirmation email');
  const legalAttachments = await buildLegalDocAttachments();
  const orderEmail = await sendOrderConfirmationEmail({
    to: customer.email,
    orderNumber: transactionId,
    orderDate: new Date().toLocaleDateString('he-IL'),
    customerName: customer.fullName,
    customerId: customer.id,
    subscriptionStartDate: new Date().toLocaleDateString('he-IL'),
    address: 'כתובת בדיקה 1',
    lastFourDigits: '1111',
    subscriptionType: 'רופא עד הבית',
    email: customer.email,
    phone: customer.phone,
    productName: 'רופא עד הבית',
    monthlyTotal: monthlyAmount,
    beneficiaryLink: `https://example.test/beneficiary-form?transactionId=${encodeURIComponent(transactionId)}`,
    primaryBeneficiary: { name: customer.fullName, idNumber: customer.id },
    secondaryBeneficiaries: beneficiaries.map((b) => ({ name: `${b.firstName} ${b.lastName}`, idNumber: b.id })),
    attachments: [...legalAttachments, ...generatedPdfAttachment],
  });
  await markDealOrderEmailSent(transactionId, { emailTo: customer.email });

  console.log('[simulate-flow] sending beneficiary completion email with PDF attachment');
  const completionEmail = await sendBeneficiaryCompletionEmail({
    to: customer.email,
    orderNumber: transactionId,
    orderDate: new Date().toLocaleDateString('he-IL'),
    customerName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    productName: 'רופא עד הבית',
    subscriptionType: 'רופא עד הבית',
    monthlyTotal: monthlyAmount,
    primaryBeneficiary: { name: customer.fullName, idNumber: customer.id },
    secondaryBeneficiaries: beneficiaries.map((b) => ({ name: `${b.firstName} ${b.lastName}`, idNumber: b.id })),
    attachments: generatedPdfAttachment,
  });

  console.log('\n=== simulate-customer-flow completed ===');
  console.log(JSON.stringify({
    transactionId,
    lowProfileCode,
    paidStatus: 'paid',
    dealSaved: true,
    contactLeadCreated: true,
    orderEmail,
    beneficiaryEmail: completionEmail,
    beneficiaryPdfPath: pdfSaved.fullPath,
  }, null, 2));
}

main().catch((err) => {
  console.error('[simulate-flow] failed:', err?.message || err);
  process.exitCode = 1;
});
