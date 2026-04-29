/** Archive = soft-delete (isActive: false). Allowed only for pending org approval or final cancelled subscription. */

export const FORBIDDEN_ARCHIVE_ALERT_HE =
  "לא ניתן להעביר לארכיון עובד שנמצא בתהליך ביטול (יבוטל ב-1 לחודש). רק לאחר שהסטטוס ישתנה ל-'מבוטל' ניתן יהיה להעבירו לארכיון.";

export function isPendingCancellationStatus(subscriptionStatus) {
  return String(subscriptionStatus || '').trim().toLowerCase() === 'pending cancellation';
}

/**
 * @param {{ workflowStatus?: string, subscriptionStatus?: string, isActive?: boolean }} p
 */
export function canArchiveDealUi({ workflowStatus, subscriptionStatus, isActive }) {
  if (isActive === false) return false;
  const ws = String(workflowStatus || '').trim().toLowerCase();
  if (ws === 'pending_org_approval') return true;
  const sub = String(subscriptionStatus || '').trim().toLowerCase();
  if (sub === 'cancelled' || sub === 'canceled') return true;
  return false;
}
