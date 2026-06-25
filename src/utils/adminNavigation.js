/** פתיחת מסך ניהול בטאב חדש (לא לשימוש בסיידבר הראשי) */
export function openAdminPath(path) {
  const p = String(path || '').trim();
  if (!p) return;
  const url = p.startsWith('http') ? p : `${window.location.origin}${p.startsWith('/') ? p : `/${p}`}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const ADMIN_LINK_PROPS = { target: '_blank', rel: 'noopener noreferrer' };

export function isAdminAppPath(path) {
  const p = String(path || '').trim();
  return p === '/admin' || p.startsWith('/admin/');
}

export function adminNavHandler(path) {
  return (event) => {
    event?.preventDefault?.();
    openAdminPath(path);
  };
}
