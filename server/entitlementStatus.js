/**
 * זכאות לשירות — לוגיקה מבוססת תאריכים בלבד.
 * מקורות נתונים: createdAt, formState.subscriptionStartDate, cancellationDate,
 * ותאריך סיום שירות (B2C: cardcomNextDateToBill, B2B: cancelAt).
 */

// ─── קבועים — ייבוא יחיד בכל המערכת ────────────────────────────────────────
export const STATUS_NOT_ACTIVATED        = 'not_activated';
export const STATUS_ACTIVE               = 'active';
export const STATUS_PENDING_CANCELLATION = 'pending_cancellation';
export const STATUS_CANCELED             = 'canceled';

export function parseFlexibleDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  const s = String(input).trim();
  if (!s) return null;
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;
  // Cardcom BillGold: "DD/MM/YYYY HH/mm" or "DD/MM/YYYY HH:mm" (slash or colon for time)
  // Also handles optional seconds: "DD/MM/YYYY HH/mm/ss"
  const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2})[/:](\d{1,2})(?:[/:](\d{1,2}))?)?/.exec(s);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const ss = m[6] != null ? Number(m[6]) : 0;
    // Guard against JavaScript's silent date-overflow (e.g. month 13 → Jan next year,
    // day 0 → last day of previous month). These would produce wrong billingMonth values.
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59 || ss > 59) return null;
    const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss, 0);
    // Cross-check: Date rolls over on impossible combos like Feb 30 → reject those too
    if (
      dt.getFullYear() !== yyyy ||
      dt.getMonth() !== mm - 1 ||
      dt.getDate() !== dd
    ) return null;
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

/**
 * מחזיר את מצב הזכאות של עסקה.
 *
 * @returns {{
 *   status: 'not_activated'|'active'|'pending_cancellation'|'canceled',
 *   label: string,
 *   cancelAt?: string
 * }}
 */
export function getEntitlementStatus(deal, now = new Date()) {
  if (!deal) return { status: STATUS_CANCELED, label: 'מבוטל' };

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
    // B2C חודש ראשון: עדיין אין NextDateToBill בקארדקום.
    if (!endDate && startDate) {
      endDate = addOneMonth(startDate);
    }
  }

  if (!startDate) return { status: STATUS_NOT_ACTIVATED, label: 'מנוי לא הופעל' };
  if (!hasRequestedCancel) return { status: STATUS_ACTIVE, label: 'פעיל' };

  if (endDate) {
    if (nowDate < endDate) {
      return {
        status: STATUS_PENDING_CANCELLATION,
        label: 'ממתין לביטול',
        cancelAt: endDate.toISOString(),
      };
    }
    return {
      status: STATUS_CANCELED,
      label: 'מבוטל',
      cancelAt: endDate.toISOString(),
    };
  }

  return { status: STATUS_CANCELED, label: 'מבוטל' };
}

/**
 * חלון מתן שירות לדוחות ספק — תאריך התחלה מתוך formState.subscriptionStartDate
 * ותאריך סיום מחושב מ־subscriptionEndDate, בקשת ביטול + cancelAt / cardcomNextDateToBill,
 * או מצב מבוטל במערכת.
 *
 * @returns {{ serviceStart: Date|null, serviceEnd: Date|null }}
 *   serviceEnd === null — אין תאריך סיום ידוע (מנוי פעיל ללא לוח סיום / ללא ביטול מתוכנן).
 */
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

// ─── שומר הדוחות ────────────────────────────────────────────────────────────
/**
 * מאפשר מעבר דרך שער הדוח: רק פעיל (B) וממתין לביטול (C).
 * לא מופעל (A) ומבוטל (D) — מוחרגים.
 */
export function passesServiceReportGate(deal) {
  const ent = getEntitlementStatus(deal);
  return ent.status === STATUS_ACTIVE || ent.status === STATUS_PENDING_CANCELLATION;
}
