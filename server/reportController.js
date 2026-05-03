/**
 * דוחות וייצוא CSV — מרכז הדוחות והבילינג של אופאל
 */
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import { passesServiceReportGate, getEntitlementStatus } from './entitlementStatus.js';

/**
 * סינון חודשי לדוחות בילינג ארגוני: רק עסקאות שחודש הבילינג שלהן (שדה billingMonth) תואם בדיוק ל־YYYY-MM.
 * לא מספיק לסנן לפי createdAt בלבד — ייתכן פער בין תאריך יצירה לחודש שיוך.
 */
export function dealBelongsToBillingMonth(deal, monthStr) {
  const t = String(monthStr || '').trim();
  if (!/^\d{4}-\d{2}$/.test(t)) return false;
  return String(deal?.billingMonth || '').trim() === t;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function splitFullName(full) {
  const s = String(full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** שם מוצר לדוח מפעיל — ייבוא מרכזי משתמש בשם מהארגון / שדה מפורש */
function subscriberExportProductName(d, fs) {
  const src = String(d.source || '');
  const pn = String(fs.productName || '').trim();
  if (src !== 'org-bulk-import') return pn;
  const explicit = String(fs.subscriptionProductName || '').trim();
  if (explicit) return explicit;
  const orgNm = firstNonEmpty(fs.organizationName, '');
  if (pn && !/ייבוא מרכז/i.test(pn)) return pn;
  return orgNm ? `מנוי ארגוני — ${orgNm}` : 'מנוי ארגוני';
}

/**
 * שורה מפורטת לכל נפש: מוטב ראשי + מוטבים נוספים
 * @param {object[]} deals — מסמכי deals ממונגו
 * @returns {object[]}
 */
export function generateFlattenedSubscriberRows(deals) {
  const rows = [];
  for (const d of deals) {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const bu = d.beneficiaryUpdate && typeof d.beneficiaryUpdate === 'object' ? d.beneficiaryUpdate : {};
    const primary = bu.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
    const fromAdditional = Array.isArray(bu.additionalMembers) ? bu.additionalMembers : [];
    const fromFsBen = Array.isArray(fs.beneficiaries) ? fs.beneficiaries : [];

    const payerAmount = Number(d.payerAmount || 0);
    const billingMonth = String(d.billingMonth || '').trim();
    const commissionAmount = Number(d.commissionAmount ?? fs.resolvedAgentCommission ?? 0);
    const productName = subscriberExportProductName(d, fs);
    const createdAt =
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt || '';
    const org = firstNonEmpty(bu.organizationName, fs.organizationName);
    const agentName = firstNonEmpty(bu.agentName, fs.agentName);
    const transactionId = String(d.transactionId || '');
    const dealId = String(d._id || '');

    const primaryFirst = firstNonEmpty(primary.firstName, splitFullName(fs.fullName).firstName);
    const primaryLast = firstNonEmpty(primary.lastName, splitFullName(fs.fullName).lastName);
    const primaryId = firstNonEmpty(primary.id, fs.id);
    const primaryPhone = firstNonEmpty(primary.phone, fs.phone);
    const primaryEmail = firstNonEmpty(primary.email, fs.email);
    const primaryAddress = firstNonEmpty(primary.address, fs.address);
    const primaryDob = firstNonEmpty(primary.dateOfBirth, fs.dateOfBirth);
    const primaryGender = firstNonEmpty(primary.gender, fs.gender);
    const primaryHealthFund = firstNonEmpty(primary.healthFund, fs.healthFund);
    const primarySupplemental = firstNonEmpty(primary.supplementalInsurance, fs.supplementalInsurance);

    rows.push({
      dealId,
      transactionId,
      rowRole: 'primary',
      organizationName: org,
      agentName,
      agentId: String(d.agentId || fs.agentId || ''),
      firstName: primaryFirst,
      lastName: primaryLast,
      idNumber: primaryId,
      phone: primaryPhone,
      email: primaryEmail,
      address: primaryAddress,
      dateOfBirth: primaryDob,
      gender: primaryGender,
      healthFund: primaryHealthFund,
      supplementalInsurance: primarySupplemental,
      payerAmount,
      billingMonth,
      commissionAmount,
      paymentStatus: String(d.paymentStatus || ''),
      subscriptionStatus: String(d.subscriptionStatus || ''),
      productName,
      createdAt,
    });

    const extras =
      fromAdditional.length > 0
        ? fromAdditional.map((m) => ({
            firstName: String(m.firstName || '').trim(),
            lastName: String(m.lastName || '').trim(),
            idNumber: String(m.id || '').trim(),
            phone: String(m.phone || '').trim(),
            email: String(m.email || '').trim(),
            address: String(m.address || '').trim(),
            dateOfBirth: String(m.dateOfBirth || '').trim(),
          }))
        : fromFsBen.map((m) => ({
            firstName: String(m.firstName || '').trim(),
            lastName: String(m.lastName || '').trim(),
            idNumber: String(m.id || '').trim(),
            phone: String(m.phone || '').trim(),
            email: String(m.email || '').trim(),
            address: '',
            dateOfBirth: String(m.dateOfBirth || '').trim(),
          }));

    for (const m of extras) {
      if (
        !m.firstName &&
        !m.lastName &&
        !m.idNumber &&
        !m.phone &&
        !m.email
      ) {
        continue;
      }
      rows.push({
        dealId,
        transactionId,
        rowRole: 'beneficiary',
        organizationName: org,
        agentName,
        agentId: String(d.agentId || fs.agentId || ''),
        firstName: m.firstName,
        lastName: m.lastName,
        idNumber: m.idNumber,
        phone: m.phone,
        email: m.email,
        address: m.address,
        dateOfBirth: m.dateOfBirth,
        gender: '',
        healthFund: String(m.healthFund || '').trim(),
        supplementalInsurance: String(m.supplementalInsurance || '').trim(),
        payerAmount,
        billingMonth,
        commissionAmount,
        paymentStatus: String(d.paymentStatus || ''),
        subscriptionStatus: String(d.subscriptionStatus || ''),
        productName,
        createdAt,
      });
    }
  }
  return rows;
}

export function generateCancellationExportRows(deals) {
  return deals.map((d) => {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const bu = d.beneficiaryUpdate && typeof d.beneficiaryUpdate === 'object' ? d.beneficiaryUpdate : {};
    const primary = bu.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
    const full = firstNonEmpty(
      [primary.firstName, primary.lastName].filter(Boolean).join(' '),
      fs.fullName
    );
    const cancelAt = d.cancellationDate
      ? d.cancellationDate instanceof Date
        ? d.cancellationDate.toISOString()
        : String(d.cancellationDate)
      : '';
    const benCount = Array.isArray(bu.additionalMembers)
      ? bu.additionalMembers.length
      : Array.isArray(fs.beneficiaries)
        ? fs.beneficiaries.length
        : 0;

    return {
      dealId: String(d._id || ''),
      transactionId: String(d.transactionId || ''),
      cancellationDate: cancelAt,
      primaryFullName: full,
      idNumber: firstNonEmpty(primary.id, fs.id),
      phone: firstNonEmpty(primary.phone, fs.phone),
      email: firstNonEmpty(primary.email, fs.email),
      organizationName: firstNonEmpty(bu.organizationName, fs.organizationName),
      agentName: firstNonEmpty(bu.agentName, fs.agentName),
      payerAmount: Number(d.payerAmount || 0),
      billingMonth: String(d.billingMonth || '').trim(),
      paymentStatus: String(d.paymentStatus || ''),
      subscriptionStatus: String(d.subscriptionStatus || ''),
      secondaryBeneficiaryCount: benCount,
    };
  });
}

const SUBSCRIBER_FIELDS = [
  { label: 'מזהה עסקה DB', value: 'dealId' },
  { label: 'מספר הזמנה', value: 'transactionId' },
  { label: 'סוג שורה', value: 'rowRole' },
  { label: 'ארגון', value: 'organizationName' },
  { label: 'סוכן', value: 'agentName' },
  { label: 'מזהה סוכן', value: 'agentId' },
  { label: 'שם פרטי', value: 'firstName' },
  { label: 'שם משפחה', value: 'lastName' },
  { label: 'תעודת זהות', value: 'idNumber' },
  { label: 'טלפון', value: 'phone' },
  { label: 'אימייל', value: 'email' },
  { label: 'כתובת', value: 'address' },
  { label: 'תאריך לידה', value: 'dateOfBirth' },
  { label: 'מין', value: 'gender' },
  { label: 'קופת חולים', value: 'healthFund' },
  { label: 'ביטוח משלים', value: 'supplementalInsurance' },
  { label: 'סכום תשלום', value: 'payerAmount' },
  { label: 'חודש בילינג', value: 'billingMonth' },
  { label: 'עמלה', value: 'commissionAmount' },
  { label: 'סטטוס תשלום', value: 'paymentStatus' },
  { label: 'סטטוס מנוי', value: 'subscriptionStatus' },
  { label: 'מוצר', value: 'productName' },
  { label: 'נוצר בתאריך', value: 'createdAt' },
];

const CANCEL_FIELDS = [
  { label: 'מזהה עסקה DB', value: 'dealId' },
  { label: 'מספר הזמנה', value: 'transactionId' },
  { label: 'תאריך ביטול', value: 'cancellationDate' },
  { label: 'שם מבוטח ראשי', value: 'primaryFullName' },
  { label: 'תעודת זהות', value: 'idNumber' },
  { label: 'טלפון', value: 'phone' },
  { label: 'אימייל', value: 'email' },
  { label: 'ארגון', value: 'organizationName' },
  { label: 'סוכן', value: 'agentName' },
  { label: 'סכום', value: 'payerAmount' },
  { label: 'חודש בילינג', value: 'billingMonth' },
  { label: 'סטטוס תשלום', value: 'paymentStatus' },
  { label: 'סטטוס מנוי', value: 'subscriptionStatus' },
  { label: 'מספר מוטבים משניים', value: 'secondaryBeneficiaryCount' },
];

export function rowsToCsv(rows, fields) {
  const parser = new Parser({
    fields,
    withBOM: true,
    defaultValue: '',
  });
  return parser.parse(rows);
}

export function buildSubscribersCsv(deals) {
  const rows = generateFlattenedSubscriberRows(deals);
  return rowsToCsv(rows, SUBSCRIBER_FIELDS);
}

function normalizeProviderName(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const raw = firstNonEmpty(
    deal?.provider,
    fs.provider,
    fs.providerName,
    fs.vendorName,
    fs.resolvedVendorName
  );
  return raw || 'לא משויך';
}

export function filterDealsByProvider(deals, providerName = '') {
  const target = String(providerName || '').trim().toLowerCase();
  if (!target) return Array.isArray(deals) ? deals : [];
  return (Array.isArray(deals) ? deals : []).filter(
    (d) => normalizeProviderName(d).toLowerCase() === target
  );
}

/**
 * סינון עסקאות לייצוא מנויים לספק — תואם סינון עמלות סוכנים (חיוב, סטטוס, מוצר, ספק, סוכן, ארגון, חודש בילינג).
 */
export function filterDealsForSubscriberExport(deals, filters = {}) {
  const billingType = String(filters.billingType || '').trim();
  const status = String(filters.status || '').trim();
  const product = String(filters.product || '').trim();
  const providerName = String(filters.provider || '').trim();
  const agentId = String(filters.agentId || '').trim();
  const organizationId = String(filters.organizationId || '').trim();
  const month = String(filters.month || '').trim();

  return (Array.isArray(deals) ? deals : []).filter((d) => {
    if (!passesServiceReportGate(d)) return false;
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const bt =
      d.isCentralized === true || String(fs.billingType || '').trim().toLowerCase() === 'centralized'
        ? 'Centralized'
        : 'Private';
    if (billingType && bt !== billingType) return false;

    const ent = getEntitlementStatus(d);
    if (status && status !== 'all') {
      if (status === 'active') {
        if (ent.status !== 'active' && ent.status !== 'pending_cancellation') return false;
      }
      if (status === 'cancelled') {
        if (ent.status !== 'canceled') return false;
      }
    }

    const pn = subscriberExportProductName(d, fs);
    if (product && pn !== product) return false;

    if (providerName && normalizeProviderName(d).toLowerCase() !== providerName.toLowerCase()) return false;

    const aid = String(d.agentId || fs.agentId || '').trim();
    if (agentId && aid !== agentId) return false;

    const oid = String(d.organizationId || fs.organizationId || '').trim();
    if (organizationId && oid !== organizationId) return false;

    const bm = String(d.billingMonth || '').trim();
    if (month && bm !== month) return false;

    return true;
  });
}

export function listProviderNamesFromDeals(deals) {
  const set = new Set();
  for (const d of Array.isArray(deals) ? deals : []) {
    const p = normalizeProviderName(d);
    if (p) set.add(p);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
}

/** שמות ספקים לסינון דוחות — ללא placeholder "לא משויך" */
export function listProviderNamesFromDealsForFilter(deals) {
  const set = new Set();
  for (const d of Array.isArray(deals) ? deals : []) {
    const p = normalizeProviderName(d);
    if (p && p !== 'לא משויך') set.add(p);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
}

export async function buildSubscribersXlsxBuffer(deals) {
  const rows = generateFlattenedSubscriberRows(deals);
  const headers = [
    'מזהה עסקה DB',
    'מספר הזמנה',
    'סוג שורה',
    'ארגון',
    'סוכן',
    'מזהה סוכן',
    'שם פרטי',
    'שם משפחה',
    'תעודת זהות',
    'טלפון',
    'אימייל',
    'כתובת',
    'תאריך לידה',
    'מין',
    'קופת חולים',
    'ביטוח משלים',
    'סכום תשלום',
    'חודש בילינג',
    'עמלה',
    'סטטוס תשלום',
    'סטטוס מנוי',
    'מוצר',
    'נוצר בתאריך',
  ];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Subscribers', { views: [{ rightToLeft: true }] });
  sheet.addRow(headers);
  for (const r of rows) {
    const row = sheet.addRow([
      r.dealId,
      r.transactionId,
      r.rowRole === 'primary' ? 'מבוטח ראשי' : 'מוטב משני',
      r.organizationName,
      r.agentName,
      r.agentId,
      r.firstName,
      r.lastName,
      r.idNumber,
      r.phone,
      r.email,
      r.address,
      r.dateOfBirth,
      r.gender,
      r.healthFund,
      r.supplementalInsurance,
      Number(r.payerAmount || 0),
      r.billingMonth,
      Number(r.commissionAmount || 0),
      r.paymentStatus,
      r.subscriptionStatus,
      r.productName,
      r.createdAt,
    ]);
    if (r.rowRole === 'primary') {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' },
        };
      });
    }
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  return workbook.xlsx.writeBuffer();
}

export function buildCancellationsCsv(deals) {
  const rows = generateCancellationExportRows(deals);
  return rowsToCsv(rows, CANCEL_FIELDS);
}

export async function buildAgentCommissionPayload(deals) {
  const base = (Array.isArray(deals) ? deals : []).filter(passesServiceReportGate);
  const rows = base.map((d) => {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const payerAmount = Number(d.payerAmount || 0);
    // Reports must use the commission snapshotted on the deal itself.
    let commissionAmount = Number(d.commissionAmount ?? fs.resolvedAgentCommission ?? 0);
    if (!Number.isFinite(commissionAmount) || commissionAmount < 0) commissionAmount = 0;
    const createdAt =
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt || '';
    const billingType =
      d.isCentralized === true || String(fs.billingType || '').trim().toLowerCase() === 'centralized'
        ? 'Centralized'
        : 'Private';
    return {
      dealId: String(d._id || ''),
      transactionId: String(d.transactionId || ''),
      createdAt,
      payerAmount,
      commissionAmount,
      productName: String(fs.productName || ''),
      provider: normalizeProviderName(d),
      billingType,
      paymentStatus: String(d.paymentStatus || ''),
      status: String(d.status || ''),
      subscriptionStatus: String(d.subscriptionStatus || ''),
    };
  });
  const totalCommission = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalSales = rows.reduce((s, r) => s + r.payerAmount, 0);
  return {
    rows,
    totalCommission,
    totalSales,
    dealCount: rows.length,
  };
}
