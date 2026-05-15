/**
 * דוחות וייצוא CSV — מרכז הדוחות והבילינג של אופאל
 */
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Footer,
  BorderStyle,
  VerticalAlign,
  ShadingType,
} from 'docx';
import {
  passesServiceReportGate,
  getEntitlementStatus,
  getReportingServiceWindow,
} from './entitlementStatus.js';

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

/** טווח תאריכים לדוח ספק — תחילת יום / סוף יום כולל */
export function parseReportServiceRange(fromStr, toStr) {
  const fromRaw = fromStr ? new Date(String(fromStr)) : null;
  const toRaw = toStr ? new Date(String(toStr)) : null;
  if (!fromRaw || !toRaw || Number.isNaN(fromRaw.getTime()) || Number.isNaN(toRaw.getTime())) {
    return { valid: false };
  }
  const fromStart = new Date(fromRaw);
  fromStart.setHours(0, 0, 0, 0);
  const toEnd = new Date(toRaw);
  toEnd.setHours(23, 59, 59, 999);
  return { valid: true, fromStart, toEnd };
}

/** חפיפת חלון שירות עם [fromStart, toEnd] — לפי מודל תאריכי זכאות */
export function dealOverlapsServiceReportPeriod(deal, fromStart, toEnd) {
  const { serviceStart, serviceEnd } = getReportingServiceWindow(deal);
  if (!serviceStart || Number.isNaN(serviceStart.getTime())) return false;
  if (serviceStart.getTime() > toEnd.getTime()) return false;
  if (!serviceEnd || Number.isNaN(serviceEnd.getTime())) return true;
  return serviceEnd.getTime() >= fromStart.getTime();
}

/** מנויים זכאים לספק בחודש שירות: חפיפה + שער פעיל/ממתין לביטול */
export function filterDealsOverlappingEligibleServicePeriod(deals, fromStr, toStr) {
  const r = parseReportServiceRange(fromStr, toStr);
  if (!r.valid) return [];
  return (Array.isArray(deals) ? deals : []).filter(
    (d) => passesServiceReportGate(d) && dealOverlapsServiceReportPeriod(d, r.fromStart, r.toEnd)
  );
}

/** דוח נגרעים: תאריך סיום שירות מחושב נופל בטווח (כולל) */
export function filterDealsCancellationsServiceEndInPeriod(deals, fromStr, toStr) {
  const r = parseReportServiceRange(fromStr, toStr);
  if (!r.valid) return [];
  return (Array.isArray(deals) ? deals : []).filter((d) => {
    const { serviceEnd } = getReportingServiceWindow(d);
    if (!serviceEnd || Number.isNaN(serviceEnd.getTime())) return false;
    const t = serviceEnd.getTime();
    return t >= r.fromStart.getTime() && t <= r.toEnd.getTime();
  });
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

    const { serviceStart, serviceEnd } = getReportingServiceWindow(d);
    const subscriptionStartDate =
      serviceStart && !Number.isNaN(serviceStart.getTime()) ? serviceStart.toISOString().slice(0, 10) : '';
    const subscriptionEndDisplay =
      !serviceEnd || Number.isNaN(serviceEnd.getTime()) ? 'פעיל' : serviceEnd.toISOString().slice(0, 10);
    const subscriptionEndDateRaw =
      serviceEnd && !Number.isNaN(serviceEnd.getTime()) ? serviceEnd.toISOString().slice(0, 10) : '';

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
      subscriptionStartDate,
      subscriptionEndDisplay,
      subscriptionEndDateRaw,
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
        subscriptionStartDate,
        subscriptionEndDisplay,
        subscriptionEndDateRaw,
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

    const { serviceStart, serviceEnd } = getReportingServiceWindow(d);
    const subscriptionStartDate =
      serviceStart && !Number.isNaN(serviceStart.getTime()) ? serviceStart.toISOString().slice(0, 10) : '';
    const subscriptionEndDisplay =
      !serviceEnd || Number.isNaN(serviceEnd.getTime()) ? 'פעיל' : serviceEnd.toISOString().slice(0, 10);
    const subscriptionEndDateRaw =
      serviceEnd && !Number.isNaN(serviceEnd.getTime()) ? serviceEnd.toISOString().slice(0, 10) : '';

    return {
      dealId: String(d._id || ''),
      transactionId: String(d.transactionId || ''),
      subscriptionStartDate,
      subscriptionEndDisplay,
      subscriptionEndDateRaw,
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
  { label: 'תאריך תחילת מנוי', value: 'subscriptionStartDate' },
  { label: 'תאריך סיום מנוי', value: 'subscriptionEndDisplay' },
  { label: 'נוצר בתאריך', value: 'createdAt' },
];

const CANCEL_FIELDS = [
  { label: 'מזהה עסקה DB', value: 'dealId' },
  { label: 'מספר הזמנה', value: 'transactionId' },
  { label: 'תאריך תחילת מנוי', value: 'subscriptionStartDate' },
  { label: 'תאריך סיום מנוי', value: 'subscriptionEndDisplay' },
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
    deal?.vendorName,
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
      if (ent.status !== status) return false;
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
    'תאריך תחילת מנוי',
    'תאריך סיום מנוי',
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
      r.subscriptionStartDate,
      r.subscriptionEndDisplay,
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

export async function buildCancellationsXlsxBuffer(deals) {
  const rows = generateCancellationExportRows(deals);
  const headers = CANCEL_FIELDS.map((f) => f.label);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cancellations', { views: [{ rightToLeft: true }] });
  sheet.addRow(headers);
  for (const r of rows) {
    sheet.addRow(CANCEL_FIELDS.map((f) => r[f.value] ?? ''));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  return workbook.xlsx.writeBuffer();
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

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function formatHebrewMonthTitle(ym) {
  const t = String(ym || '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(t);
  if (!m) return t || '—';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return t;
  return `${HEBREW_MONTHS[mo - 1]} ${y}`;
}

// A4 עם שוליים 720 DXA מכל צד → רוחב תוכן 10466 DXA
const AGENT_PAY_COLS = [
  { key: 'agentName', label: 'שם המוטב', width: 2200 },
  { key: 'bankName', label: 'בנק', width: 1400 },
  { key: 'bankNumber', label: 'מס׳ בנק', width: 1066 },
  { key: 'branchNumber', label: 'מס׳ סניף', width: 1200 },
  { key: 'accountNumber', label: 'מס׳ חשבון', width: 1800 },
  { key: 'balance', label: 'סכום לתשלום', width: 1800 },
];
const AGENT_PAY_TABLE_W = AGENT_PAY_COLS.reduce((s, c) => s + c.width, 0);

const AP_THIN = { style: BorderStyle.SINGLE, size: 4, color: '444444' };
const AP_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const apAllBorders = { top: AP_THIN, bottom: AP_THIN, left: AP_THIN, right: AP_THIN };
const apNoBorders = { top: AP_NONE, bottom: AP_NONE, left: AP_NONE, right: AP_NONE };

function apCellVal(r, key) {
  if (key === 'balance') {
    return `₪ ${new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(r[key]) || 0)}`;
  }
  if (key === 'agentName') {
    const name = [r.bankAccountName, r.agentName].map((v) => String(v || '').trim()).find(Boolean);
    return name || '—';
  }
  const v = r[key];
  return v !== undefined && v !== null && String(v).trim() ? String(v).trim() : '—';
}

function apMakeCell(text, { bold = false, header = false, width, shading } = {}) {
  const fill = shading || (header ? 'D8D8D8' : 'FFFFFF');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: apAllBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: String(text ?? ''),
            rightToLeft: true,
            bold,
            size: header ? 22 : 20,
          }),
        ],
      }),
    ],
  });
}

function apRtl(text, { bold = false, size = 22, spacing = {}, color } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing,
    children: [
      new TextRun({
        text: String(text ?? ''),
        rightToLeft: true,
        bold,
        size,
        ...(color ? { color } : {}),
      }),
    ],
  });
}

/** מסמך Word להעברת תשלומי עמלות לסוכנים */
export async function buildAgentPaymentTransferDocxBuffer(rows = [], options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const months = [...new Set(list.map((r) => String(r.month || '').trim()).filter(Boolean))];
  const monthTitle =
    months.length === 1
      ? formatHebrewMonthTitle(months[0])
      : months.length > 1
        ? months.map(formatHebrewMonthTitle).join(', ')
        : formatHebrewMonthTitle(options.month || '');

  const downloadedAt = options.downloadedAt instanceof Date ? options.downloadedAt : new Date();
  const dateStr = downloadedAt.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const companyName = String(options.companyName || 'אופאל עסקים תקשורת שיווקית בע"מ').trim();
  const companyAcct = String(
    options.companyAcct || 'מחשבון אופאל ח.פ 512413188  מס׳ חשי׳ 996351'
  ).trim();

  const headerRow = new TableRow({
    tableHeader: true,
    children: AGENT_PAY_COLS.map((c) => apMakeCell(c.label, { bold: true, header: true, width: c.width })),
  });

  const dataRows = list.map(
    (r, i) =>
      new TableRow({
        children: AGENT_PAY_COLS.map((c) =>
          apMakeCell(apCellVal(r, c.key), {
            width: c.width,
            shading: i % 2 === 0 ? 'FFFFFF' : 'F2F2F2',
          })
        ),
      })
  );



  const paymentTable = new Table({
    width: { size: AGENT_PAY_TABLE_W, type: WidthType.DXA },
    columnWidths: AGENT_PAY_COLS.map((c) => c.width),
    visuallyRightToLeft: true,
    rows: [headerRow, ...dataRows, totalRow],
  });

  const monthBox = new Table({
    width: { size: AGENT_PAY_TABLE_W, type: WidthType.DXA },
    columnWidths: [AGENT_PAY_TABLE_W - 1800, 1800],
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: AGENT_PAY_TABLE_W - 1800, type: WidthType.DXA },
            borders: apNoBorders,
            children: [new Paragraph({ children: [new TextRun('')] })],
          }),
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: apAllBorders,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'חודש תשלום', rightToLeft: true, bold: true, size: 20 }),
                ],
              }),
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: monthTitle, rightToLeft: true, size: 24, bold: true })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 1440, left: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              apRtl(`תאריך הורדת קובץ לתשלום: ${dateStr}`, {
                size: 18,
                color: '555555',
                spacing: { before: 60 },
              }),
            ],
          }),
        },
        children: [
          monthBox,
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun('')] }),
          apLtr('אני דני ירקוני מנכ"ל בעלים ת.ז 059304535 הנני מאשר לשלם את העברות הנ"ל', {
            bold: true,
            size: 22,
          }),
          apRtl(companyAcct, { bold: true, size: 22, spacing: { after: 280 } }),
          paymentTable,
          new Paragraph({ spacing: { after: 600 }, children: [new TextRun('')] }),
          apLtr('דני ירקוני – מנכ"ל', { size: 22, bold: true }),
          apLtr(companyName, { size: 20, spacing: { after: 200 } }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun('')] }),
          apLtr('_________________________', { size: 22 }),
          apLtr('חתימה', { size: 18, color: '666666' }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
