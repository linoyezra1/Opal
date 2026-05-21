/** Fired when alert-driving data changes (org approval, payouts, etc.). */
export const ADMIN_ALERTS_CHANGED_EVENT = 'opal:admin-alerts-changed';

export function dispatchAdminAlertsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_ALERTS_CHANGED_EVENT));
  }
}
