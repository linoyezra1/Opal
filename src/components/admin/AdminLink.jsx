import React from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_LINK_PROPS, isAdminAppPath, openAdminPath } from '../../utils/adminNavigation.js';

/** קישור פנימי — מסכי ניהול נפתחים בטאב חדש; נתיבים אחרים כרגיל */
const AdminLink = React.forwardRef(function AdminLink({ to, children, className, onClick, ...rest }, ref) {
  const admin = isAdminAppPath(to);
  const handleClick = (e) => {
    onClick?.(e);
    if (!admin || e?.defaultPrevented) return;
    e.preventDefault();
    openAdminPath(to);
  };
  if (admin) {
    return (
      <Link to={to} ref={ref} className={className} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={to} ref={ref} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
});

AdminLink.displayName = 'AdminLink';

export default AdminLink;

export function AdminExternalTabLink({ to, children, className, ...rest }) {
  return (
    <Link to={to} className={className} {...ADMIN_LINK_PROPS} {...rest}>
      {children}
    </Link>
  );
}
