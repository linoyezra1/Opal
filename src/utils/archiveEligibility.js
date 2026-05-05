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

export function isPendingCancellationStatus(subscriptionStatus) {
  const s = normalizeStatus(subscriptionStatus);
  return s === 'pending_cancellation' || s === 'pendingcancellation';
}

function resolveState({ entitlementStatus, workflowStatus, subscriptionStatus }) {
  const es = normalizeStatus(entitlementStatus);
  if (es) return es;
  const ws = normalizeStatus(workflowStatus);
  const sub = normalizeStatus(subscriptionStatus);
  if (ws === 'pending_org_approval' || ws === 'pending_alllow' || ws === 'pending_allow') return 'not_activated';
  if (sub === 'pending_cancellation' || sub === 'pendingcancellation') return 'pending_cancellation';
  if (sub === 'cancelled' || sub === 'canceled' || ws === 'canceled' || ws === 'cancelled') return 'canceled';
  return 'active';
}

/**
 * @param {{
 *   entitlementStatus?: string,
 *   workflowStatus?: string,
 *   subscriptionStatus?: string,
 *   isActive?: boolean,
 *   isCentralizedBilling?: boolean,
 *   pendingCancellationDateLabel?: string
 * }} p
 */
export function getArchiveEligibility(p) {
  const {
    entitlementStatus,
    workflowStatus,
    subscriptionStatus,
    isActive,
    isCentralizedBilling,
    pendingCancellationDateLabel,
  } = p || {};

  if (isActive === false) {
    return { allowed: false, reason: 'רשומה זו כבר אינה פעילה.' };
  }

  const state = resolveState({ entitlementStatus, workflowStatus, subscriptionStatus });
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
  return { allowed: false, reason: ARCHIVE_BLOCKED_PRIVATE_MSG };
}

export function canArchiveDealUi(params) {
  return getArchiveEligibility(params);
}
