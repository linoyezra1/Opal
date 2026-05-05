/**
 * Archive = soft-delete (isActive: false).
 * מותר לארכב: State A (לא הופעל) ו-State D (מבוטל).
 * אסור לארכב: State C (ממתין לביטול) ו-State B (פעיל).
 */

export const FORBIDDEN_ARCHIVE_ALERT_HE =
  "לא ניתן להעביר לארכיון עובד שנמצא בתהליך ביטול (יבוטל ב-1 לחודש). רק לאחר שהסטטוס ישתנה ל-'מבוטל' ניתן יהיה להעבירו לארכיון.";

export function isPendingCancellationStatus(subscriptionStatus) {
  const s = String(subscriptionStatus || '').trim().toLowerCase();
  return s === 'pending cancellation' || s === 'pending_cancellation';
}

/**
 * @param {{ entitlementStatus?: string, workflowStatus?: string, subscriptionStatus?: string, isActive?: boolean }} p
 */
export function canArchiveDealUi({ entitlementStatus, workflowStatus, subscriptionStatus, isActive }) {
  if (isActive === false) return false;

  // שימוש ב-entitlementStatus כשזמין (המצב האחיד)
  if (entitlementStatus) {
    return entitlementStatus === 'not_activated' || entitlementStatus === 'canceled';
  }

  // fallback לשדות גולמיים
  const ws  = String(workflowStatus  || '').trim().toLowerCase();
  const sub = String(subscriptionStatus || '').trim().toLowerCase();

  // A — לא הופעל
  if (ws === 'pending_org_approval') return true;
  // D — מבוטל
  if (sub === 'cancelled' || sub === 'canceled') return true;
  // C — ממתין לביטול: אסור לארכב
  if (isPendingCancellationStatus(subscriptionStatus)) return false;

  return false;
}
