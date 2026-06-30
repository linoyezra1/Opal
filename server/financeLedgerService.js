/**
 * Central Finance Ledger — unified per-month subscription rows for vendor payouts
 * and agent-supplier reporting. Mirrors agent_commission_ledger granularity.
 */
import {
  getEntitlementStatus,
  getReportingServiceWindow,
  passesServiceReportGate,
  parseFlexibleDate,
  STATUS_ACTIVE,
  STATUS_CANCELED,
  STATUS_NOT_ACTIVATED,
  STATUS_PENDING_CANCELLATION,
} from './entitlementStatus.js';

/** Dynamic payout-ledger row lifecycle states (Vendor Payout Ledger). */
export const PAYOUT_ROW_STATUS = {
  OPEN: 'open',
  LOCKED_PENDING: 'locked_pending',
  LOCKED_PAID: 'locked_paid',
  NOT_YET_ACTIVE: 'not_yet_active',
  TERMINATED_LOCKED_PAID: 'terminated_locked_paid',
  TERMINATED_NOT_LOCKED: 'terminated_not_locked',
};

export function billingMonthPrecedesServiceActivation(deal, billingMonth) {
  const bm = String(billingMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(bm)) return false;
  const [y, m] = bm.split('-').map(Number);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const { serviceStart } = getReportingServiceWindow(deal);
  if (!serviceStart || Number.isNaN(serviceStart.getTime())) return false;
  return monthEnd.getTime() < serviceStart.getTime();
}

export function computePayoutRowStatus({ deal, billingMonth, ledgerLocked = false, snapshotStatus = '' } = {}) {
  const ent = getEntitlementStatus(deal);
  const locked = ledgerLocked === true;
  const paid = String(snapshotStatus || '').trim() === 'Paid';

  if (ent.status === STATUS_CANCELED) {
    if (locked) {
      return paid ? PAYOUT_ROW_STATUS.TERMINATED_LOCKED_PAID : PAYOUT_ROW_STATUS.LOCKED_PENDING;
    }
    return PAYOUT_ROW_STATUS.TERMINATED_NOT_LOCKED;
  }

  if (ent.status === STATUS_NOT_ACTIVATED || billingMonthPrecedesServiceActivation(deal, billingMonth)) {
    return PAYOUT_ROW_STATUS.NOT_YET_ACTIVE;
  }

  if (locked) {
    return paid ? PAYOUT_ROW_STATUS.LOCKED_PAID : PAYOUT_ROW_STATUS.LOCKED_PENDING;
  }

  if (ent.status === STATUS_ACTIVE || ent.status === STATUS_PENDING_CANCELLATION) {
    return PAYOUT_ROW_STATUS.OPEN;
  }

  return PAYOUT_ROW_STATUS.NOT_YET_ACTIVE;
}

export function getPayoutRowStatusLabel(status) {
  switch (status) {
    case PAYOUT_ROW_STATUS.OPEN:
      return 'פתוח לתשלום';
    case PAYOUT_ROW_STATUS.LOCKED_PENDING:
      return 'נעול מחכה לתשלום';
    case PAYOUT_ROW_STATUS.LOCKED_PAID:
      return 'נעול ושולם';
    case PAYOUT_ROW_STATUS.NOT_YET_ACTIVE:
      return 'מנוי טרם הופעל';
    case PAYOUT_ROW_STATUS.TERMINATED_LOCKED_PAID:
      return 'מנוי בוטל - ננעל ושולם';
    case PAYOUT_ROW_STATUS.TERMINATED_NOT_LOCKED:
      return 'מנוי בוטל - לא ננעל ושולם';
    default:
      return '—';
  }
}

export function getPayoutRowStatusTooltip(status) {
  switch (status) {
    case PAYOUT_ROW_STATUS.LOCKED_PENDING:
    case PAYOUT_ROW_STATUS.LOCKED_PAID:
      return 'רשומה זו כבר ננעלה בסנאפשוט וממתינה לתשלום / שולמה ולא ניתן לשנותה';
    case PAYOUT_ROW_STATUS.NOT_YET_ACTIVE:
      return 'מנוי זה טרם הופעל ולכן לא זכאי לשירות הספק ולתשלום לנעילה';
    case PAYOUT_ROW_STATUS.TERMINATED_LOCKED_PAID:
      return 'מנוי בוטל - ננעל ושולם';
    case PAYOUT_ROW_STATUS.TERMINATED_NOT_LOCKED:
      return 'מנוי בוטל - לא ננעל ושולם';
    default:
      return '';
  }
}

export function isPayoutRowSelectable(status) {
  return status === PAYOUT_ROW_STATUS.OPEN;
}

export function enrichRowWithPayoutStatus(row, deal, snapshotStatus = '') {
  const payoutRowStatus = computePayoutRowStatus({
    deal,
    billingMonth: row.billingMonth,
    ledgerLocked: row.ledgerLocked === true,
    snapshotStatus,
  });
  return {
    ...row,
    payoutRowStatus,
    payoutStatusLabel: getPayoutRowStatusLabel(payoutRowStatus),
    payoutStatusTooltip: getPayoutRowStatusTooltip(payoutRowStatus),
    selectable: isPayoutRowSelectable(payoutRowStatus),
  };
}

function parseReportServiceRange(fromStr, toStr) {
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

export function formatBillingMonthDisplay(billingMonth) {
  const t = String(billingMonth || '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(t);
  if (!m) return t || '—';
  return `${m[2]}/${m[1]}`;
}

export function formatBillingMonthFromDate(value) {
  const d = parseFlexibleDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Does calendar billing month YYYY-MM overlap [fromDate, toDate]? */
export function billingMonthOverlapsDateRange(billingMonth, fromStr, toStr) {
  const bm = String(billingMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(bm)) return false;
  const fromRaw = String(fromStr || '').trim();
  const toRaw = String(toStr || '').trim();
  if (!fromRaw && !toRaw) return true;

  const r = parseReportServiceRange(fromRaw || toRaw, toRaw || fromRaw);
  if (!r.valid) return true;

  const [y, m] = bm.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  return monthStart.getTime() <= r.toEnd.getTime() && monthEnd.getTime() >= r.fromStart.getTime();
}

/** Strict status guard — active or pending_cancellation only. */
export function isDealEligibleForFinanceLedger(deal) {
  if (!deal) return false;
  if (!passesServiceReportGate(deal)) return false;
  const ent = getEntitlementStatus(deal);
  return ent.status === STATUS_ACTIVE || ent.status === STATUS_PENDING_CANCELLATION;
}

/**
 * Billing month step must fall inside the subscription's eligible service window
 * while the deal is still active / pending cancellation.
 */
export function billingMonthWithinEligibleServicePeriod(deal, billingMonth) {
  if (!isDealEligibleForFinanceLedger(deal)) return false;
  const bm = String(billingMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(bm)) return false;

  const [y, m] = bm.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

  const { serviceStart, serviceEnd } = getReportingServiceWindow(deal);
  if (!serviceStart || Number.isNaN(serviceStart.getTime())) return false;
  if (monthEnd.getTime() < serviceStart.getTime()) return false;
  if (serviceEnd && !Number.isNaN(serviceEnd.getTime()) && monthStart.getTime() > serviceEnd.getTime()) {
    return false;
  }
  return true;
}

function resolveSubscriptionDates(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const { serviceStart, serviceEnd } = getReportingServiceWindow(deal);
  const subscriptionStartDate =
    serviceStart && !Number.isNaN(serviceStart.getTime())
      ? serviceStart.toISOString().slice(0, 10)
      : String(fs.subscriptionStartDate || '').trim();
  const subscriptionEndDate =
    serviceEnd && !Number.isNaN(serviceEnd.getTime())
      ? serviceEnd.toISOString().slice(0, 10)
      : '';
  return {
    subscriptionStartDate,
    subscriptionEndDate,
    subscriptionEndDisplay: subscriptionEndDate || '-',
  };
}

function resolvePrimaryIdentity(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const bu = deal?.beneficiaryUpdate && typeof deal.beneficiaryUpdate === 'object' ? deal.beneficiaryUpdate : {};
  const primary = bu.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
  const split = splitFullName(fs.fullName);
  return {
    firstName: firstNonEmpty(primary.firstName, split.firstName),
    lastName: firstNonEmpty(primary.lastName, split.lastName),
    idNumber: firstNonEmpty(primary.id, fs.id),
    productName: String(fs.productName || '').trim(),
  };
}

function isSuccessfulInitialPayment(deal) {
  return /success|paid|test_success|completed/i.test(String(deal?.paymentStatus || ''));
}

/**
 * Explode a B2C deal into chronological monthly billing rows from successful charges
 * (initial checkout + DetailRecurring events) — used when ledger backfill is incomplete.
 */
export function explodeDealToMonthlyBillingRows(deal) {
  if (!isDealEligibleForFinanceLedger(deal)) return [];

  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const vendorPayout = Number(fs.resolvedVendorCost ?? deal.resolvedVendorCost ?? 0);
  if (vendorPayout <= 0) return [];

  const dates = resolveSubscriptionDates(deal);
  const identity = resolvePrimaryIdentity(deal);
  const ent = getEntitlementStatus(deal);
  const dealId = String(deal._id || '');
  const transactionId = String(deal.transactionId || '');
  const rows = [];
  const seenMonths = new Set();

  function pushRow(billingMonth, source, rowIdHint) {
    const month = String(billingMonth || '').trim();
    if (!month || seenMonths.has(month)) return;
    if (!billingMonthWithinEligibleServicePeriod(deal, month)) return;
    seenMonths.add(month);
    rows.push({
      ledgerEntryId: '',
      rowId: rowIdHint || '',
      dealId,
      transactionId,
      billingMonth: month,
      billingMonthDisplay: formatBillingMonthDisplay(month),
      ...dates,
      ...identity,
      vendorPayout,
      subscriptionStatus: ent.label,
      entitlementStatus: ent.status,
      ledgerLocked: false,
      isSecondary: false,
      source,
    });
  }

  if (deal.isRecurringCycle !== true && isSuccessfulInitialPayment(deal)) {
    const initialMonth =
      String(deal.billingMonth || '').trim() || formatBillingMonthFromDate(deal.createdAt);
    pushRow(initialMonth, 'initial_checkout', `VENDOR_INITIAL_${dealId}`);
  }

  const events = Array.isArray(deal.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  for (const ev of events) {
    if (Number(ev?.statusCode) !== 1) continue;
    const month =
      String(ev?.billingMonth || '').trim() ||
      formatBillingMonthFromDate(ev?.lastBillDateIso || ev?.lastBillDate || ev?.receivedAt);
    const rowId = String(ev?.rowId || ev?.id || '').trim();
    pushRow(
      month,
      'detail_recurring',
      rowId ? `VENDOR_RECURRING_${rowId}` : `VENDOR_RECURRING_${dealId}_${month}`
    );
  }

  rows.sort((a, b) => {
    const cmp = String(a.billingMonth).localeCompare(String(b.billingMonth));
    if (cmp !== 0) return cmp;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
  return rows;
}

/**
 * Explode monthly billing rows without eligibility / service-window filters —
 * used for ledger preview so not-yet-active and terminated rows are visible.
 */
export function explodeDealToMonthlyBillingRowsUnfiltered(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const vendorPayout = Number(fs.resolvedVendorCost ?? deal.resolvedVendorCost ?? 0);
  if (vendorPayout <= 0) return [];

  const dates = resolveSubscriptionDates(deal);
  const identity = resolvePrimaryIdentity(deal);
  const ent = getEntitlementStatus(deal);
  const dealId = String(deal._id || '');
  const transactionId = String(deal.transactionId || '');
  const rows = [];
  const seenMonths = new Set();

  function pushRow(billingMonth, source, rowIdHint) {
    const month = String(billingMonth || '').trim();
    if (!month || seenMonths.has(month)) return;
    seenMonths.add(month);
    rows.push({
      ledgerEntryId: '',
      rowId: rowIdHint || '',
      dealId,
      transactionId,
      billingMonth: month,
      billingMonthDisplay: formatBillingMonthDisplay(month),
      ...dates,
      ...identity,
      vendorPayout,
      subscriptionStatus: ent.label,
      entitlementStatus: ent.status,
      ledgerLocked: false,
      isSecondary: false,
      source,
    });
  }

  if (deal.isRecurringCycle !== true && isSuccessfulInitialPayment(deal)) {
    const initialMonth =
      String(deal.billingMonth || '').trim() || formatBillingMonthFromDate(deal.createdAt);
    pushRow(initialMonth, 'initial_checkout', `VENDOR_INITIAL_${dealId}`);
  }

  const events = Array.isArray(deal.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  for (const ev of events) {
    if (Number(ev?.statusCode) !== 1) continue;
    const month =
      String(ev?.billingMonth || '').trim() ||
      formatBillingMonthFromDate(ev?.lastBillDateIso || ev?.lastBillDate || ev?.receivedAt);
    const rowId = String(ev?.rowId || ev?.id || '').trim();
    pushRow(
      month,
      'detail_recurring',
      rowId ? `VENDOR_RECURRING_${rowId}` : `VENDOR_RECURRING_${dealId}_${month}`
    );
  }

  rows.sort((a, b) => {
    const cmp = String(a.billingMonth).localeCompare(String(b.billingMonth));
    if (cmp !== 0) return cmp;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
  return rows;
}

/**
 * Full vendor ledger preview — all monthly rows in range with lifecycle status.
 */
export function buildFullVendorLedgerPreviewRows({
  ledgerDocs = [],
  deals = [],
  fromDate = '',
  toDate = '',
  monthFilter = '',
  ledgerSnapshotStatusByEntryId = new Map(),
} = {}) {
  const dealsMap = new Map();
  for (const d of deals) {
    const id = String(d._id || '');
    if (id) dealsMap.set(id, d);
  }

  const rowKey = (dealId, billingMonth) => `${dealId}:${billingMonth}`;
  const covered = new Map();

  for (const L of ledgerDocs) {
    if (L.isSecondary === true) continue;
    const dealId = String(L.dealId || '');
    const deal = dealsMap.get(dealId);
    if (!deal) continue;
    const billingMonth = String(L.billingMonth || '').trim();
    if (monthFilter && billingMonth !== String(monthFilter).trim()) continue;
    if ((fromDate || toDate) && !billingMonthOverlapsDateRange(billingMonth, fromDate, toDate)) continue;

    const entryId = String(L._id || '');
    const snapshotStatus = ledgerSnapshotStatusByEntryId.get(entryId) || '';
    const row = buildFinanceLedgerRowFromVendorLedgerEntry(L, deal);
    covered.set(rowKey(dealId, billingMonth), enrichRowWithPayoutStatus(row, deal, snapshotStatus));
  }

  for (const deal of deals) {
    const dealId = String(deal._id || '');
    const exploded = explodeDealToMonthlyBillingRowsUnfiltered(deal);
    for (const row of exploded) {
      if (monthFilter && row.billingMonth !== String(monthFilter).trim()) continue;
      if ((fromDate || toDate) && !billingMonthOverlapsDateRange(row.billingMonth, fromDate, toDate)) {
        continue;
      }
      const key = rowKey(dealId, row.billingMonth);
      if (covered.has(key)) continue;
      covered.set(key, enrichRowWithPayoutStatus(row, deal, ''));
    }
  }

  const merged = [...covered.values()];
  merged.sort((a, b) => {
    const cmp = String(a.billingMonth).localeCompare(String(b.billingMonth));
    if (cmp !== 0) return cmp;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
  return merged;
}

export function buildFinanceLedgerRowFromVendorLedgerEntry(ledgerEntry, deal) {
  const dates = resolveSubscriptionDates(deal);
  const identity = resolvePrimaryIdentity(deal);
  const ent = getEntitlementStatus(deal);
  const billingMonth = String(ledgerEntry?.billingMonth || '').trim();

  return {
    ledgerEntryId: String(ledgerEntry._id || ''),
    rowId: String(ledgerEntry.rowId || ''),
    dealId: String(ledgerEntry.dealId || deal?._id || ''),
    transactionId: String(ledgerEntry.transactionId || deal?.transactionId || ''),
    billingMonth,
    billingMonthDisplay: formatBillingMonthDisplay(billingMonth),
    ...dates,
    ...identity,
    vendorPayout: Number(ledgerEntry.vendorPayout || 0),
    subscriptionStatus: ent.label,
    entitlementStatus: ent.status,
    ledgerLocked: ledgerEntry.locked === true,
    isSecondary: ledgerEntry.isSecondary === true,
    source: String(ledgerEntry.source || ''),
    lastBillDate:
      ledgerEntry.lastBillDate instanceof Date
        ? ledgerEntry.lastBillDate.toISOString()
        : ledgerEntry.lastBillDate || '',
  };
}

/**
 * Build vendor payout preview rows from vendor_payout_ledger (primary members only).
 */
export function buildVendorPayoutRowsFromLedger({
  ledgerDocs = [],
  dealsMap = new Map(),
  fromDate = '',
  toDate = '',
  monthFilter = '',
} = {}) {
  const rows = [];

  for (const L of ledgerDocs) {
    if (L.isSecondary === true) continue;
    const deal = dealsMap.get(String(L.dealId || ''));
    if (!deal || !isDealEligibleForFinanceLedger(deal)) continue;

    const billingMonth = String(L.billingMonth || '').trim();
    if (monthFilter && billingMonth !== String(monthFilter).trim()) continue;
    if ((fromDate || toDate) && !billingMonthOverlapsDateRange(billingMonth, fromDate, toDate)) continue;
    if (!billingMonthWithinEligibleServicePeriod(deal, billingMonth)) continue;

    rows.push(buildFinanceLedgerRowFromVendorLedgerEntry(L, deal));
  }

  rows.sort((a, b) => {
    const cmp = String(a.billingMonth).localeCompare(String(b.billingMonth));
    if (cmp !== 0) return cmp;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
  return rows;
}

/**
 * Central Finance Ledger scan — vendor monthly rows for eligible B2C subscriptions.
 * Prefers persisted ledger entries; supplements from deal billing events when missing.
 */
export function buildCentralFinanceLedgerVendorRows({
  ledgerDocs = [],
  deals = [],
  fromDate = '',
  toDate = '',
  monthFilter = '',
} = {}) {
  const dealsMap = new Map();
  for (const d of deals) {
    const id = String(d._id || '');
    if (id) dealsMap.set(id, d);
  }

  const ledgerRows = buildVendorPayoutRowsFromLedger({
    ledgerDocs,
    dealsMap,
    fromDate,
    toDate,
    monthFilter,
  });

  const ledgerMonthsByDeal = new Map();
  for (const r of ledgerRows) {
    const did = String(r.dealId || '');
    if (!ledgerMonthsByDeal.has(did)) ledgerMonthsByDeal.set(did, new Set());
    ledgerMonthsByDeal.get(did).add(String(r.billingMonth || ''));
  }

  const supplemental = [];
  for (const deal of deals) {
    if (!isDealEligibleForFinanceLedger(deal)) continue;
    const dealId = String(deal._id || '');
    const exploded = explodeDealToMonthlyBillingRows(deal);
    const covered = ledgerMonthsByDeal.get(dealId) || new Set();
    for (const row of exploded) {
      if (covered.has(String(row.billingMonth || ''))) continue;
      if (monthFilter && row.billingMonth !== String(monthFilter).trim()) continue;
      if ((fromDate || toDate) && !billingMonthOverlapsDateRange(row.billingMonth, fromDate, toDate)) {
        continue;
      }
      supplemental.push(row);
    }
  }

  const merged = [...ledgerRows, ...supplemental];
  merged.sort((a, b) => {
    const cmp = String(a.billingMonth).localeCompare(String(b.billingMonth));
    if (cmp !== 0) return cmp;
    return String(a.transactionId).localeCompare(String(b.transactionId));
  });
  return merged;
}
