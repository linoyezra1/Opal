import * as XLSX from 'xlsx';
import { getEntitlementStatus, getReportingServiceWindow, parseFlexibleDate } from './entitlementReportingClient.js';

function formatYmd(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

function computeDealTotalProviderCostCollected(deal) {
  if (!deal) return 0;
  const fs = deal.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const payOk = /success|paid|test_success|completed/i.test(String(deal.paymentStatus || ''));
  const initial = payOk ? Number(fs.resolvedVendorCost ?? 0) : 0;
  const events = Array.isArray(deal.detailRecurringEvents) ? deal.detailRecurringEvents : [];
  let recurring = 0;
  for (const ev of events) {
    if (Number(ev?.statusCode) === 1) recurring += Number(ev?.vendorCost ?? 0);
  }
  return initial + recurring;
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

const STATUS_EXPORT_EN = {
  active: 'Active',
  pending_cancellation: 'Pending cancel',
  canceled: 'Canceled',
  not_activated: 'Not activated',
};

/**
 * @param {object[]} visibleRows — rows from subscribers dashboard API
 * @param {string} [filename]
 */
export function exportVisibleSubscribersToXlsx(visibleRows, filename) {
  const list = Array.isArray(visibleRows) ? visibleRows : [];
  const rows = list.map((r) => {
    const raw = r?.raw && typeof r.raw === 'object' ? r.raw : null;
    const fs = raw?.formState && typeof raw.formState === 'object' ? raw.formState : {};
    const ent = raw
      ? getEntitlementStatus(raw)
      : { status: String(r?.entitlementStatus || ''), label: '' };
    const { serviceEnd } = raw ? getReportingServiceWindow(raw) : { serviceEnd: null };
    const coverageFromRow = () => {
      if (r?.entitlementCancelAt) return formatYmd(r.entitlementCancelAt);
      if (r?.subscriptionEndDate) return formatYmd(r.subscriptionEndDate);
      return '';
    };

    const joinDate = formatYmd(r?.createdAt ?? raw?.createdAt);
    const subStartStr = String(r?.subscriptionStartDate || fs.subscriptionStartDate || '').trim();
    const subParsed = parseFlexibleDate(fs.subscriptionStartDate);
    const subStart =
      subStartStr ||
      (subParsed && !Number.isNaN(subParsed.getTime()) ? formatYmd(subParsed) : '');
    const cancelReq = formatYmd(r?.cancellationDate ?? raw?.cancellationDate);
    const coverageEnd =
      serviceEnd && !Number.isNaN(serviceEnd.getTime()) ? formatYmd(serviceEnd) : coverageFromRow();

    return {
      'Full Name': String(r?.fullName || fs.fullName || '').trim(),
      ID: String(r?.idNumber || fs.id || '').trim(),
      Phone: String(fs.phone || '').trim(),
      Email: String(fs.email || '').trim(),
      'Agent Name': String(r?.agentName || fs.agentName || '').trim(),
      'Organization Name': String(r?.organizationName || fs.organizationName || '').trim(),
      'Join Date (createdAt)': joinDate,
      'Subscription Start Date': subStart,
      'Cancellation Request Date': cancelReq,
      'Coverage End Date': coverageEnd,
      'Entitlement Status': STATUS_EXPORT_EN[ent.status] || String(ent.status || ''),
      'Beneficiaries Count': beneficiariesCount(r, raw),
      'Beneficiaries List (additional)': additionalBeneficiaryNames(raw),
      'Subscription Price': Number(r?.amount ?? raw?.payerAmount ?? 0),
      'Total Revenue Collected': raw ? computeDealTotalCollectedRevenue(raw) : Number(r?.totalCustomerRevenue ?? r?.amount ?? 0),
      'Total Provider Cost Collected': raw ? computeDealTotalProviderCostCollected(raw) : Number(r?.vendorCost ?? 0),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Subscribers');
  const name =
    filename ||
    `opal-subscribers-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
