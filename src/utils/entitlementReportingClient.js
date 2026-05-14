/**
 * Client-side mirror of server/entitlementStatus.js (parseFlexibleDate, getEntitlementStatus, getReportingServiceWindow)
 * for exports — keep in sync when entitlement rules change.
 */

export const STATUS_NOT_ACTIVATED = 'not_activated';
export const STATUS_ACTIVE = 'active';
export const STATUS_PENDING_CANCELLATION = 'pending_cancellation';
export const STATUS_CANCELED = 'canceled';

export function parseFlexibleDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  const s = String(input).trim();
  if (!s) return null;
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;
  const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/.exec(s);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const dt = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function resolvePaymentMethod(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const raw = String(
    deal?.paymentMethod || fs.paymentMethod || fs.organizationPaymentMethod || ''
  )
    .trim()
    .toLowerCase();
  if (deal?.isCentralized === true) return 'centralized';
  if (raw === 'centralized') return 'centralized';
  if (raw === 'private' || raw === 'b2c') return 'private';
  if (raw === 'org-private' || raw === 'private_org') return 'private';
  return raw || 'private';
}

function addOneMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getEntitlementStatus(deal, now = new Date()) {
  if (!deal) return { status: STATUS_CANCELED, label: 'Canceled' };

  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const startDate = parseFlexibleDate(fs.subscriptionStartDate);
  const requestedAt = parseFlexibleDate(deal?.cancellationDate);
  const hasRequestedCancel = !!requestedAt;
  const nowDate = parseFlexibleDate(now) || new Date();

  const isCentralized =
    deal?.isCentralized === true || resolvePaymentMethod(deal) === 'centralized';

  let endDate = null;
  if (isCentralized) {
    endDate = parseFlexibleDate(deal?.cancelAt);
  } else {
    endDate = parseFlexibleDate(fs.cardcomNextDateToBill);
    if (!endDate && startDate) {
      endDate = addOneMonth(startDate);
    }
  }

  if (!startDate) return { status: STATUS_NOT_ACTIVATED, label: 'Not activated' };
  if (!hasRequestedCancel) return { status: STATUS_ACTIVE, label: 'Active' };

  if (endDate) {
    if (nowDate < endDate) {
      return {
        status: STATUS_PENDING_CANCELLATION,
        label: 'Pending cancellation',
        cancelAt: endDate.toISOString(),
      };
    }
    return {
      status: STATUS_CANCELED,
      label: 'Canceled',
      cancelAt: endDate.toISOString(),
    };
  }

  return { status: STATUS_CANCELED, label: 'Canceled' };
}

export function getReportingServiceWindow(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const serviceStart = parseFlexibleDate(fs.subscriptionStartDate);

  const explicitEnd =
    parseFlexibleDate(deal?.subscriptionEndDate) || parseFlexibleDate(fs.subscriptionEndDate);
  if (explicitEnd && !Number.isNaN(explicitEnd.getTime())) {
    return { serviceStart, serviceEnd: explicitEnd };
  }

  const requestedAt = parseFlexibleDate(deal?.cancellationDate);
  const hasRequestedCancel = !!requestedAt;

  const isCentralized =
    deal?.isCentralized === true || resolvePaymentMethod(deal) === 'centralized';

  let computedEnd = null;
  if (hasRequestedCancel) {
    if (isCentralized) {
      computedEnd = parseFlexibleDate(deal?.cancelAt) || requestedAt;
    } else {
      computedEnd = parseFlexibleDate(fs.cardcomNextDateToBill);
      if (!computedEnd && serviceStart) computedEnd = addOneMonth(serviceStart);
      if (!computedEnd) computedEnd = requestedAt;
    }
  }

  if (!computedEnd && /cancel|בוטל/i.test(String(deal?.subscriptionStatus || ''))) {
    computedEnd =
      parseFlexibleDate(deal?.cancelAt) ||
      requestedAt ||
      parseFlexibleDate(deal?.updatedAt);
  }

  if (computedEnd && !Number.isNaN(computedEnd.getTime())) {
    return { serviceStart, serviceEnd: computedEnd };
  }
  return { serviceStart, serviceEnd: null };
}
