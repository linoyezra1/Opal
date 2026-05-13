/**
 * Period revenue aligned with server/mongoService.js getSalesDashboardData:
 * - join_date: successful initial payerAmount only (per deal row).
 * - billing_date: cash in range — initial payment if created in range + successful
 *   recurring events (statusCode === 1) whose bill date falls in range / month.
 */

function parseDateFilterMode(raw) {
  return String(raw || '').trim().toLowerCase() === 'join_date' ? 'join_date' : 'billing_date';
}

function isSuccessfulInitialPayment(deal) {
  return /success|paid|test_success|completed/i.test(String(deal?.paymentStatus || ''));
}

function initialExcludedBySubscriptionStatus(deal) {
  return /cancel|בוטל/i.test(String(deal?.subscriptionStatus || ''));
}

function parseDealDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mirrors server/mongoService.js getDateRange (month + from/to merge). */
export function buildClientDateRange(filters) {
  const range = {};
  const month = String(filters?.month || '').trim();
  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (y && m) {
      range.$gte = new Date(y, m - 1, 1);
      range.$lt = new Date(y, m, 1);
    }
  }
  if (filters?.fromDate) {
    const from = new Date(String(filters.fromDate));
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (filters?.toDate) {
    const to = new Date(String(filters.toDate));
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }
  return Object.keys(range).length ? range : null;
}

function isInDateRange(dt, dateRange) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime()) || !dateRange) return false;
  if (dateRange.$gte && dt < dateRange.$gte) return false;
  if (dateRange.$lte && dt > dateRange.$lte) return false;
  if (dateRange.$lt && dt >= dateRange.$lt) return false;
  return true;
}

function formatBillingMonthFromDate(dt) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function initialCashInMonth(deal, month) {
  if (deal?.isRecurringCycle === true) return 0;
  if (!isSuccessfulInitialPayment(deal) || initialExcludedBySubscriptionStatus(deal)) return 0;
  const createdAt = parseDealDate(deal?.createdAt);
  if (!createdAt) return 0;
  return formatBillingMonthFromDate(createdAt) === String(month) ? Number(deal.payerAmount || 0) : 0;
}

function recurringCashInMonth(deal, month) {
  const events = Array.isArray(deal?.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  let sum = 0;
  for (const ev of events) {
    if (Number(ev?.statusCode) !== 1) continue;
    if (String(ev?.billingMonth || '').trim() === String(month)) sum += Number(ev?.sum ?? 0);
  }
  return sum;
}

function initialCashInDateRange(deal, dateRange) {
  if (deal?.isRecurringCycle === true) return 0;
  if (!isSuccessfulInitialPayment(deal) || initialExcludedBySubscriptionStatus(deal)) return 0;
  const createdAt = parseDealDate(deal?.createdAt);
  if (!createdAt || !isInDateRange(createdAt, dateRange)) return 0;
  return Number(deal.payerAmount || 0);
}

function recurringCashInDateRange(deal, dateRange) {
  const events = Array.isArray(deal?.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  let sum = 0;
  for (const ev of events) {
    if (Number(ev?.statusCode) !== 1) continue;
    const evDate = parseDealDate(ev?.lastBillDateIso || ev?.lastBillDate || ev?.receivedAt);
    if (evDate && isInDateRange(evDate, dateRange)) sum += Number(ev?.sum ?? 0);
  }
  return sum;
}

/**
 * @param {object} deal — raw deal from API (row.raw)
 * @param {object} filters — SubscribersDashboard filters (month, fromDate, toDate, dateFilterMode)
 */
export function computePeriodRevenueFromDeal(deal, filters) {
  if (!deal || typeof deal !== 'object') return 0;
  const mode = parseDateFilterMode(filters?.dateFilterMode);
  const month = String(filters?.month || '').trim();
  const dateRange = buildClientDateRange(filters);

  if (mode === 'join_date') {
    if (deal.isRecurringCycle === true) return 0;
    if (!isSuccessfulInitialPayment(deal)) return 0;
    return Number(deal.payerAmount || 0);
  }

  if (dateRange) {
    return initialCashInDateRange(deal, dateRange) + recurringCashInDateRange(deal, dateRange);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    return initialCashInMonth(deal, month) + recurringCashInMonth(deal, month);
  }

  if (deal.isRecurringCycle === true) return 0;
  if (!isSuccessfulInitialPayment(deal)) return 0;
  return Number(deal.payerAmount || 0);
}
