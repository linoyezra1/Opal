/**
 * Active "צור קשר" tasks for dashboard / alerts — new, unhandled leads only.
 */

export const CONTACT_LEADS_CHANGED_EVENT = 'opal:contact-leads-changed';

export function dispatchContactLeadsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONTACT_LEADS_CHANGED_EVENT));
  }
}

export function normalizeContactLeadStatus(status) {
  return String(status ?? 'חדש').trim();
}

/** Dashboard bell + control-panel card: חדש/New and not handled. */
export function isActiveContactTaskLead(doc) {
  if (!doc || doc.isActive === false) return false;
  if (doc.isHandled === true) return false;
  const status = normalizeContactLeadStatus(doc.leadStatus);
  if (status === 'טופל' || status === 'Handled') return false;
  if (status === 'בטיפול' || status === 'InProgress') return false;
  return status === 'חדש' || status === 'New' || status === '';
}
