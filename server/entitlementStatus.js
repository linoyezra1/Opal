/**
 * זכאות לשירות — לוגיקה אחידה לדוחות ספק/סוכן ולממשק מנויים.
 * עסקאות "פרטי" עם הוראת קבע: Cardcom IsActive + NextDateToBill.
 * עסקאות מרוכזות: לפי subscriptionStatus במערכת.
 */

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

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

export function startOfLocalDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
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

export function hasActivatedSubscription(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const v = fs.subscriptionStartDate ?? deal?.subscriptionStartDate;
  return v != null && String(v).trim() !== '';
}

/**
 * @returns {{ status: 'active'|'pending_cancellation'|'canceled', cancelAt: Date|null, serviceUntil: Date|null }}
 */
export function getEntitlementStatus(deal, now = new Date()) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const pm = resolvePaymentMethod(deal);
  const sub = String(deal?.subscriptionStatus || '').trim();
  const subL = sub.toLowerCase();
  const cancellationDate = parseFlexibleDate(deal?.cancellationDate);

  if (pm === 'centralized') {
    if (sub === 'Pending Cancellation' || (subL.includes('pending') && subL.includes('cancel'))) {
      return { status: 'pending_cancellation', cancelAt: cancellationDate, serviceUntil: null };
    }
    if (subL === 'cancelled' || subL.includes('cancelled')) {
      return { status: 'canceled', cancelAt: cancellationDate, serviceUntil: null };
    }
    return { status: 'active', cancelAt: null, serviceUntil: null };
  }

  const nextBillRaw = firstNonEmpty(
    fs.cardcomNextDateToBill,
    fs.nextDateToBill,
    deal?.cardcomNextDateToBill
  );
  const nextBill = parseFlexibleDate(nextBillRaw);
  const today = startOfLocalDay(now);

  const activeExplicit =
    fs.cardcomRecurringIsActive === true ||
    fs.cardcomRecurringIsActive === 'true' ||
    fs.cardcomRecurringIsActive === 1 ||
    fs.cardcomRecurringIsActive === '1';
  const inactiveExplicit =
    fs.cardcomRecurringIsActive === false ||
    fs.cardcomRecurringIsActive === 'false' ||
    fs.cardcomRecurringIsActive === 0 ||
    fs.cardcomRecurringIsActive === '0';

  if (activeExplicit) {
    return { status: 'active', cancelAt: null, serviceUntil: null };
  }

  if (inactiveExplicit && nextBill) {
    const nb = startOfLocalDay(nextBill);
    if (nb && today && today < nb) {
      return { status: 'pending_cancellation', cancelAt: cancellationDate, serviceUntil: nextBill };
    }
    return { status: 'canceled', cancelAt: cancellationDate || nextBill, serviceUntil: null };
  }

  if (sub === 'Pending Cancellation') {
    return { status: 'pending_cancellation', cancelAt: cancellationDate, serviceUntil: nextBill };
  }

  if (inactiveExplicit && !nextBill) {
    if (subL.includes('pending')) {
      return { status: 'pending_cancellation', cancelAt: cancellationDate, serviceUntil: null };
    }
    if (subL.includes('cancel')) {
      return { status: 'canceled', cancelAt: cancellationDate, serviceUntil: null };
    }
    return { status: 'pending_cancellation', cancelAt: cancellationDate, serviceUntil: null };
  }

  if (subL === 'cancelled' || String(deal?.status || '').toLowerCase() === 'cancelled') {
    return { status: 'canceled', cancelAt: cancellationDate, serviceUntil: null };
  }

  return { status: 'active', cancelAt: null, serviceUntil: null };
}

export function passesServiceReportGate(deal) {
  if (!hasActivatedSubscription(deal)) return false;
  const ent = getEntitlementStatus(deal);
  return ent.status === 'active' || ent.status === 'pending_cancellation';
}
