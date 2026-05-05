/**
 * זכאות לשירות — לוגיקה אחידה לכל המערכת (דוחות, ממשק מנויים, ארגונים).
 *
 * 4 מצבי זכאות אפשריים:
 *   A. not_activated  — לא הופעל (ממתין לאישור מנהל / טרם הושלמו מסמכים)
 *   B. active         — פעיל
 *   C. pending_cancellation — ממתין לביטול (ייבוטל ב-1 לחודש הבא)
 *   D. canceled       — מבוטל
 */

// ─── קבועים — ייבוא יחיד בכל המערכת ────────────────────────────────────────
export const STATUS_NOT_ACTIVATED        = 'not_activated';
export const STATUS_ACTIVE               = 'active';
export const STATUS_PENDING_CANCELLATION = 'pending_cancellation';
export const STATUS_CANCELED             = 'canceled';

// ─── עזרים ────────────────────────────────────────────────────────────────────
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

/** האם טופס מוטבים / תאריך תחילת מנוי כבר קיימים (State B עבור תשלום פרטי) */
export function hasActivatedSubscription(deal) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const v = fs.subscriptionStartDate ?? deal?.subscriptionStartDate;
  return v != null && String(v).trim() !== '';
}

// ─── פונקציה ראשית ────────────────────────────────────────────────────────────
/**
 * מחזיר את מצב הזכאות של עסקה.
 *
 * @returns {{
 *   status: 'not_activated'|'active'|'pending_cancellation'|'canceled',
 *   cancelAt: Date|null,
 *   serviceUntil: Date|null
 * }}
 */
export function getEntitlementStatus(deal, now = new Date()) {
  const fs = deal?.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const pm = resolvePaymentMethod(deal);
  const sub = String(deal?.subscriptionStatus || '').trim();
  const subL = sub.toLowerCase();
  const workflowStatus = String(deal?.status || '').trim().toLowerCase();
  const cancellationDate = parseFlexibleDate(deal?.cancellationDate);
  const today = startOfLocalDay(now);

  // ═══════════════════════════════════════════════════════════
  // תשלום מרוכז (ארגוני)
  // ═══════════════════════════════════════════════════════════
  if (pm === 'centralized') {

    // A — לא הופעל: ממתין לאישור מנהל
    if (
      sub === 'ממתין לאישור הארגון' ||
      workflowStatus === 'pending_org_approval' ||
      workflowStatus === 'pending_allow' ||
      workflowStatus === 'pending_alllow'
    ) {
      return { status: STATUS_NOT_ACTIVATED, cancelAt: null, serviceUntil: null };
    }

    // C — ממתין לביטול (עם בדיקת מעבר אוטומטי לביטול לאחר התאריך)
    if (sub === 'Pending Cancellation' || (subL.includes('pending') && subL.includes('cancel'))) {
      if (cancellationDate) {
        const cancelDay = startOfLocalDay(cancellationDate);
        if (cancelDay && today && today >= cancelDay) {
          // התאריך עבר — מעבר אוטומטי ל-מבוטל
          return { status: STATUS_CANCELED, cancelAt: cancellationDate, serviceUntil: null };
        }
      }
      return { status: STATUS_PENDING_CANCELLATION, cancelAt: cancellationDate, serviceUntil: null };
    }

    // D — מבוטל
    if (subL === 'cancelled' || subL === 'canceled') {
      return { status: STATUS_CANCELED, cancelAt: cancellationDate, serviceUntil: null };
    }

    // B — פעיל
    return { status: STATUS_ACTIVE, cancelAt: null, serviceUntil: null };
  }

  // ═══════════════════════════════════════════════════════════
  // תשלום פרטי (כרטיס אשראי / Cardcom)
  // ═══════════════════════════════════════════════════════════

  // A — לא הופעל: טרם הושלמו מסמכים / תאריך תחילת מנוי חסר
  if (!hasActivatedSubscription(deal)) {
    return { status: STATUS_NOT_ACTIVATED, cancelAt: null, serviceUntil: null };
  }

  const nextBillRaw = firstNonEmpty(
    fs.cardcomNextDateToBill,
    fs.nextDateToBill,
    deal?.cardcomNextDateToBill
  );
  const nextBill = parseFlexibleDate(nextBillRaw);

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

  // B — פעיל: הוראת קבע פעילה
  if (activeExplicit) {
    return { status: STATUS_ACTIVE, cancelAt: null, serviceUntil: null };
  }

  // C / D — הוראת קבע אינה פעילה: בדיקת NextDateToBill
  if (inactiveExplicit && nextBill) {
    const nb = startOfLocalDay(nextBill);
    if (nb && today && today < nb) {
      // C — ממתין לביטול: עדיין לפני תאריך החיוב הבא
      return { status: STATUS_PENDING_CANCELLATION, cancelAt: cancellationDate, serviceUntil: nextBill };
    }
    // D — מבוטל: עבר תאריך החיוב הבא
    return { status: STATUS_CANCELED, cancelAt: cancellationDate || nextBill, serviceUntil: null };
  }

  // fallback לפי subscriptionStatus גולמי
  if (sub === 'Pending Cancellation') {
    return { status: STATUS_PENDING_CANCELLATION, cancelAt: cancellationDate, serviceUntil: nextBill };
  }

  if (inactiveExplicit && !nextBill) {
    if (subL.includes('pending')) {
      return { status: STATUS_PENDING_CANCELLATION, cancelAt: cancellationDate, serviceUntil: null };
    }
    return { status: STATUS_CANCELED, cancelAt: cancellationDate, serviceUntil: null };
  }

  if (subL === 'cancelled' || subL === 'canceled' || String(deal?.status || '').toLowerCase() === 'cancelled') {
    return { status: STATUS_CANCELED, cancelAt: cancellationDate, serviceUntil: null };
  }

  // B — פעיל (ברירת מחדל לאחר שאושר subscriptionStartDate)
  return { status: STATUS_ACTIVE, cancelAt: null, serviceUntil: null };
}

// ─── שומר הדוחות ────────────────────────────────────────────────────────────
/**
 * מאפשר מעבר דרך שער הדוח: רק פעיל (B) וממתין לביטול (C).
 * לא מופעל (A) ומבוטל (D) — מוחרגים.
 */
export function passesServiceReportGate(deal) {
  if (!hasActivatedSubscription(deal)) return false;
  const ent = getEntitlementStatus(deal);
  return ent.status === STATUS_ACTIVE || ent.status === STATUS_PENDING_CANCELLATION;
}
