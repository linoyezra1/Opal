import * as XLSX from 'xlsx';
import { getEntitlementStatus, getReportingServiceWindow, parseFlexibleDate } from './entitlementReportingClient.js';

const DASH = '—';

/** עמודות בעברית — סדר לוגי כמו ב־UI */
const HEADER_ROW = [
  'שם מלא',
  'שם ארגון',
  'ת.ז',
  'תאריך לידה',
  'מין',
  'טלפון',
  'אימייל',
  'כתובת',
  'מצב משפחתי',
  'קופת חולים',
  'ביטוח משלים',
  'סטטוס תשלום',
  'סטטוס מנוי',
  'סוג תשלום',
  'שם סוכן',
  'עמלת סוכן',
  'עמלת סוכן סה״כ',
  'שם המוצר',
  'שם ספק',
  'עלות ספק',
  'עלות ספק סה״כ',
  'סכום עסקה (בטופס)',
  'רווח נקי',
  "מס' הזמנה",
  'היסטוריית חיובים (Recurring ID)',
  'תאריך הצטרפות',
  'תאריך תחילת מנוי',
  'תאריך בקשת ביטול',
  'תאריך סיום כיסוי',
  'סה"כ הכנסות מלקוח (מזומן)',
  'כמות מוטבים',
  'רשימת מוטבים',
];

const COL = {
  agentCommission: 15,
  agentCommissionTotal: 16,
  vendorCost: 19,
  vendorCostTotal: 20,
  payerAmount: 21,
  netProfit: 22,
  totalCashRevenue: 29,
  beneficiariesCount: 30,
};

const ENTITLEMENT_HE = {
  active: 'פעיל',
  pending_cancellation: 'ממתין לביטול',
  canceled: 'מבוטל',
  not_activated: 'מנוי לא הופעל',
};

function dashStr(v) {
  const t = v == null ? '' : String(v).trim();
  return t === '' ? DASH : t;
}

function formatYmd(value) {
  if (value == null || value === '') return DASH;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toISOString().slice(0, 10);
}

function numCell(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intCell(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

function moneyCell(v) {
  return { v: numCell(v), t: 'n', z: '#,##0.00' };
}

function intCellObj(v) {
  return { v: intCell(v), t: 'n', z: '0' };
}

function computeDealTotalCollectedRevenue(deal) {
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

function primaryBlock(raw) {
  const bu = raw?.beneficiaryUpdate;
  const pm = bu?.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
  const fs = raw?.formState && typeof raw.formState === 'object' ? raw.formState : {};
  return { pm, fs };
}

function additionalBeneficiaryNames(raw) {
  const bu = raw?.beneficiaryUpdate;
  const fs = raw?.formState;
  const fromAdd = Array.isArray(bu?.additionalMembers) ? bu.additionalMembers : [];
  if (fromAdd.length) {
    return fromAdd
      .map((m) => [m.firstName, m.lastName].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .join(', ');
  }
  const ben = Array.isArray(fs?.beneficiaries) ? fs.beneficiaries : [];
  return ben
    .map((m) => [m.firstName, m.lastName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ');
}

function beneficiariesCount(r, raw) {
  const n = Number(r?.activeCustomersCount);
  if (Number.isFinite(n) && n > 0) return n;
  const base = raw || {};
  const n2 = Number(base.activeCustomersCount);
  if (Number.isFinite(n2) && n2 > 0) return n2;
  const p = Number(r?.primaryCount ?? base.primaryCount ?? 1);
  const s = Number(r?.secondaryCount ?? base.secondaryCount ?? 0);
  return (Number.isFinite(p) ? p : 1) + (Number.isFinite(s) ? s : 0);
}

function paymentTypeLabel(r, raw) {
  const fs = raw?.formState || {};
  const pm = String(raw?.paymentMethod || fs.paymentMethod || fs.organizationPaymentMethod || '')
    .trim()
    .toLowerCase();
  const centralized =
    r?.isCentralized === true || raw?.isCentralized === true || pm === 'centralized';
  if (centralized) return 'מרוכז (ארגון משלם)';
  return 'פרטי (כרטיס אשראי)';
}

/** סדר כמו ב־SubscribersDashboard (formState → שורה → raw) */
function organizationNameCell(r, raw) {
  const fs = raw?.formState && typeof raw.formState === 'object' ? raw.formState : {};
  const bu = raw?.beneficiaryUpdate;
  return dashStr(
    fs.organizationName ||
      r?.organizationName ||
      r?.organizationBadge ||
      raw?.organizationName ||
      bu?.organizationName
  );
}

function subscriptionStatusWithSub(r, raw, ent) {
  const main = ENTITLEMENT_HE[ent.status] || dashStr(ent.status);
  const parts = [main];
  if (r?.pendingBeneficiaryCompletion) parts.push('השלמת מסמכים');
  const cs = String(r?.completionStatus || '').trim();
  if (cs && cs !== 'הושלם' && !r?.pendingBeneficiaryCompletion) parts.push(cs);
  return parts.join(' · ');
}

function isSuccessfulInitialPayment(r, raw) {
  return /success|paid|test_success|completed/i.test(String(r?.paymentStatus ?? raw?.paymentStatus ?? ''));
}

function sumSuccessfulRecurringField(raw, field) {
  const events = Array.isArray(raw?.detailRecurringEvents) ? raw.detailRecurringEvents : [];
  let s = 0;
  for (const ev of events) {
    if (Number(ev?.statusCode) !== 1) continue;
    s += numCell(ev?.[field]);
  }
  return s;
}

/** עלות/עמלה מהצילום בטופס + חיובים חוזרים מוצלחים (ללא כפילות עם מכפלת מוטבים) */
function cumulativeVendorCost(r, raw, unit) {
  const initial = isSuccessfulInitialPayment(r, raw) ? unit : 0;
  return initial + sumSuccessfulRecurringField(raw, 'vendorCost');
}

function cumulativeAgentCommission(r, raw, unit) {
  const initial = isSuccessfulInitialPayment(r, raw) ? unit : 0;
  return initial + sumSuccessfulRecurringField(raw, 'agentCommission');
}

/** כמו dealTxnProviderName ב־SubscribersDashboard */
function providerNameCell(r, raw, fs) {
  return dashStr(
    raw?.vendorName ||
      r?.provider ||
      fs.providerName ||
      fs.vendorName ||
      fs.resolvedVendorName ||
      raw?.providerName
  );
}

function agentNameCell(r, raw, fs) {
  return dashStr(
    raw?.beneficiaryUpdate?.agentName || fs.agentName || r?.agentName || raw?.agentName
  );
}

function buildDataRow(r) {
  const raw = r?.raw && typeof r.raw === 'object' ? r.raw : null;
  const { pm, fs } = raw ? primaryBlock(raw) : { pm: {}, fs: {} };
  const ent = raw ? getEntitlementStatus(raw) : { status: String(r?.entitlementStatus || ''), label: '' };
  const { serviceEnd } = raw ? getReportingServiceWindow(raw) : { serviceEnd: null };

  const coverageFromRow = () => {
    if (r?.entitlementCancelAt) return formatYmd(r.entitlementCancelAt);
    if (r?.subscriptionEndDate) return formatYmd(r.subscriptionEndDate);
    return DASH;
  };
  const coverageEnd =
    serviceEnd && !Number.isNaN(serviceEnd.getTime()) ? formatYmd(serviceEnd) : coverageFromRow();

  const subStartStr = String(r?.subscriptionStartDate || fs.subscriptionStartDate || '').trim();
  const subParsed = parseFlexibleDate(fs.subscriptionStartDate);
  const subStart =
    subStartStr ||
    (subParsed && !Number.isNaN(subParsed.getTime()) ? formatYmd(subParsed) : DASH);

  const cancelReq = r?.cancellationDate || raw?.cancellationDate ? formatYmd(r?.cancellationDate ?? raw?.cancellationDate) : DASH;
  const joinDate = r?.createdAt || raw?.createdAt ? formatYmd(r?.createdAt ?? raw?.createdAt) : DASH;

  const payerAmount = numCell(r?.amount ?? raw?.payerAmount ?? 0);
  const vendorUnit = numCell(fs.resolvedVendorCost ?? r?.vendorCost ?? 0);
  const agentUnit = numCell(
    fs.resolvedAgentCommission ?? r?.agentCommission ?? raw?.commissionAmount ?? 0
  );
  const vendorTotal = cumulativeVendorCost(r, raw, vendorUnit);
  const agentTotal = cumulativeAgentCommission(r, raw, agentUnit);
  const resolvedNet = numCell(fs.resolvedNetProfit ?? r?.netProfit ?? 0);
  const totalCash = raw ? computeDealTotalCollectedRevenue(raw) : numCell(r?.totalCustomerRevenue ?? r?.amount ?? 0);

  const paymentStatus = dashStr(r?.paymentStatus ?? raw?.paymentStatus ?? r?.displayPaymentStatus);

  const fromPmName = [pm.firstName, pm.lastName].filter(Boolean).join(' ').trim();
  const fullName = dashStr(r?.fullName || r?.customerName || fs.fullName || fromPmName);
  const idNum = dashStr(r?.idNumber || pm.id || fs.id);
  const birth = dashStr(pm.dateOfBirth || fs.dateOfBirth);
  const gender = dashStr(pm.gender || fs.gender);
  const phone = dashStr(pm.phone || fs.phone || r?.phone);
  const email = dashStr(pm.email || fs.email || r?.email);
  const address = dashStr(pm.address || fs.address);
  const marital = dashStr(pm.maritalStatus || fs.maritalStatus);
  const hmo = dashStr(pm.healthFund || fs.healthFund);
  const supp = dashStr(pm.supplementalInsurance || fs.supplementalInsurance);
  const productName = dashStr(r?.productName || fs.productName);
  const providerName = providerNameCell(r, raw, fs);
  const agentName = agentNameCell(r, raw, fs);
  const orderId = dashStr(r?.transactionId || raw?.transactionId);
  const recurringId = dashStr(r?.cardcomRecurringId || raw?.cardcomRecurringId);

  const benList = additionalBeneficiaryNames(raw);
  const benListOut = benList.trim() === '' ? DASH : benList;

  const orgName = organizationNameCell(r, raw);

  const row = [
    fullName,
    orgName,
    idNum,
    birth,
    gender,
    phone,
    email,
    address,
    marital,
    hmo,
    supp,
    paymentStatus,
    subscriptionStatusWithSub(r, raw, ent),
    paymentTypeLabel(r, raw),
    agentName,
    moneyCell(agentUnit),
    moneyCell(agentTotal),
    productName,
    providerName,
    moneyCell(vendorUnit),
    moneyCell(vendorTotal),
    moneyCell(payerAmount),
    moneyCell(resolvedNet),
    orderId,
    recurringId,
    joinDate,
    subStart,
    cancelReq,
    coverageEnd,
    moneyCell(totalCash),
    intCellObj(beneficiariesCount(r, raw)),
    benListOut,
  ];

  return row;
}

/**
 * SheetJS CE אינה שומרת מילוי צבע לתאים ב־xlsx. ננסה `s` לפסים; אם לא יופיע בקובץ, ניתן לעצב כטבלה ב־Excel (יש כבר Autofilter).
 */
function applyZebraAndFormats(ws) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const moneyCols = new Set([
    COL.payerAmount,
    COL.vendorCost,
    COL.vendorCostTotal,
    COL.agentCommission,
    COL.agentCommissionTotal,
    COL.netProfit,
    COL.totalCashRevenue,
  ]);

  if (!ws['!rows']) ws['!rows'] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const isHeader = R === 0;
    const isEvenData = !isHeader && R % 2 === 0;
    ws['!rows'][R] = { hpt: isHeader ? 20 : isEvenData ? 17 : 16, hidden: false };

    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || typeof cell !== 'object') continue;

      if (moneyCols.has(C) && R > 0) {
        const v = Number(cell.v);
        if (Number.isFinite(v)) {
          cell.t = 'n';
          cell.z = '#,##0.00';
        }
      }
      if (C === COL.beneficiariesCount && R > 0) {
        const v = Number(cell.v);
        if (Number.isFinite(v)) {
          cell.t = 'n';
          cell.z = '0';
        }
      }

      if (isEvenData) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'F2F4F7' } },
        };
      }
    }
  }

  ws['!autofilter'] = { ref };
}

/**
 * @param {object[]} visibleRows — rows from subscribers dashboard API
 * @param {string} [filename]
 */
export function exportVisibleSubscribersToXlsx(visibleRows, filename) {
  const list = Array.isArray(visibleRows) ? visibleRows : [];
  const dataRows = list.map((r) => buildDataRow(r));
  const aoa = [HEADER_ROW, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!views'] = [{ RTL: true }];
  applyZebraAndFormats(ws);

  ws['!cols'] = HEADER_ROW.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'מנויים');
  const name =
    filename || `opal-subscribers-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name, { bookType: 'xlsx' });
}
