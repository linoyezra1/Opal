export const NOT_ACTIVATED_CENTRALIZED_MSG =
  'לקוח זה לא אושר על ידי הארגון ולא הופעל לו מנוי, ולכן לא ניתן לבטל את המנוי. ניתן להעביר לארכיון בלבד. פעולה זו תגרור השבתה של יכולת מנהל הארגון לאשר עובד זה בעתיד';
export const ARCHIVE_BLOCKED_PRIVATE_MSG =
  'לא ניתן להעביר את המידע לארכיון. נא לבטל חיוב עתידי קודם לכן בקארדקום.';
export const ARCHIVE_BLOCKED_ACTIVE_CENTRALIZED_MSG =
  'לא ניתן להעביר לארכיון כי המנוי בתוקף יש לבטל את המנוי';
export const ARCHIVE_BLOCKED_PENDING_CANCELLATION_CENTRALIZED_MSG =
  "לא ניתן להעביר לארכיון מנוי שנמצא בתהליך ביטול (יבוטל ב-1 לחודש). רק לאחר שהסטטוס ישתנה ל-'מבוטל' ניתן יהיה להעבירו לארכיון.";

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isPendingCancellationStatus(entitlementStatus) {
  const s = normalizeStatus(entitlementStatus);
  return s === 'pending_cancellation' || s === 'pendingcancellation';
}

/**
 * @param {{
 *   entitlementStatus?: string,
 *   isCentralizedBilling?: boolean,
 *   pendingCancellationDateLabel?: string
 * }} p
 */
export function getArchiveEligibility(p) {
  const {
    entitlementStatus,
    isCentralizedBilling,
    pendingCancellationDateLabel,
  } = p || {};

  const state = normalizeStatus(entitlementStatus);
  const isCentralized = !!isCentralizedBilling;

  if (state === 'not_activated') {
    if (isCentralized) return { allowed: true, reason: NOT_ACTIVATED_CENTRALIZED_MSG };
    return { allowed: false, reason: ARCHIVE_BLOCKED_PRIVATE_MSG };
  }
  if (state === 'active') {
    if (isCentralized) return { allowed: false, reason: ARCHIVE_BLOCKED_ACTIVE_CENTRALIZED_MSG };
    return { allowed: false, reason: ARCHIVE_BLOCKED_PRIVATE_MSG };
  }
  if (state === 'pending_cancellation') {
    if (isCentralized) {
      return { allowed: false, reason: ARCHIVE_BLOCKED_PENDING_CANCELLATION_CENTRALIZED_MSG };
    }
    const dateLabel = String(pendingCancellationDateLabel || '').trim();
    return {
      allowed: false,
      reason: `לא ניתן להעביר לארכיון מנוי שנמצא בתהליך ביטול (יבוטל ב-${dateLabel || '—'}). רק לאחר שהסטטוס ישתנה ל-'מבוטל' ניתן יהיה להעבירו לארכיון.`,
    };
  }
  if (state === 'canceled' || state === 'cancelled') {
    return { allowed: true, reason: '' };
  }
  return { allowed: false, reason: 'סטטוס זכאות לא זמין לפעולה זו.' };
}

export function canArchiveDealUi(params) {
  return getArchiveEligibility(params);
}
