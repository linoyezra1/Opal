import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Building2,
  Users,
  Receipt,
  UserCheck,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  X,
  LayoutTemplate,
  FileBarChart2,
  Archive,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/button.jsx';
import { API_BASE } from '../../apiBase.js';

const TOKEN_KEY = 'opal_admin_token';

const groups = [
  {
    title: 'לוח בקרה',
    items: [
      { label: 'לוח בקרה', to: '/admin/control-panel', icon: LayoutDashboard },
      { label: 'ספק', to: '/admin/vendors', icon: Building2 },
      { label: 'הקמת דף מוצר', to: '/admin/product-page-setup', icon: LayoutTemplate },
      { label: 'מוצר', to: '/admin/products', icon: Package },
      { label: 'מחירון', to: '/admin/price-list', icon: Receipt },
      { label: 'סוכן', to: '/admin/agents', icon: Users },
      { label: 'דוחות ובילינג', to: '/admin/reports', icon: FileBarChart2 },
    ],
  },
  {
    title: 'לקוחות',
    items: [
      { label: 'לקוחות פרטיים', to: '/admin/subscribers', icon: UserCheck },
      { label: 'מרכז ניהול ארגונים', to: '/admin/organizations', icon: Building2 },
      { label: 'ארכיון', to: '/admin/archive', icon: Archive },
      { label: 'צור קשר', to: '/admin/contacts', icon: MessageSquare },
    ],
  },
  {
    title: 'התראות',
    items: [
      { label: 'מרכז התראות', to: '/admin/alerts', icon: Bell },
    ],
  },
];

export default function AdminPageShell({ children }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [alerts, setAlerts] = React.useState({});

  React.useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/alerts-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.success || cancelled) return;
        setAlerts(j || {});
      } catch {
        /* ignore summary poll errors in shell */
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/admin');
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <aside
        className={cn(
          'border-s border-border bg-card flex flex-col shrink-0 transition-all duration-200 z-30',
          'fixed inset-y-0 start-0 md:static',
          mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
          collapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <img src="/branding/opal-logo.jpeg" alt="אופאל" className="h-9 w-auto shrink-0 object-contain" />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">אופאל</span>
              <span className="text-xs text-muted-foreground truncate">ניהול אופאל</span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ms-auto shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          >
            {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileOpen(false)}
            aria-label="סגירת תפריט"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              {!collapsed && <p className="px-2 mb-1 text-xs font-medium text-muted-foreground">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/admin'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          collapsed && 'justify-center px-0'
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && item.badgeKey ? (
                        <span className="ms-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          {Number(alerts?.[item.badgeKey] || 0)}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className={cn('w-full justify-start text-destructive hover:text-destructive', collapsed && 'justify-center px-0')}
            onClick={logout}
            title="התנתק"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span>התנתק</span>}
          </Button>
          {!collapsed && (
            <Link to="/admin" className="block mt-2 text-center text-xs text-muted-foreground hover:text-primary">
              מסך ניהול ראשי
            </Link>
          )}
        </div>
      </aside>

      {!mobileOpen ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed top-3 end-3 z-40 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="פתיחת תפריט"
        >
          <Menu className="size-4" />
        </Button>
      ) : null}

      {mobileOpen ? <button type="button" className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} aria-label="סגירת תפריט" /> : null}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto" dir="rtl">
          <div className="container max-w-7xl mx-auto p-4 md:p-6 text-right">{children}</div>
        </div>
      </main>
    </div>
  );
}
