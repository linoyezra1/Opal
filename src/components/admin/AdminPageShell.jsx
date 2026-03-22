import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Building2,
  Users,
  Receipt,
  UserCheck,
  Gem,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/button.jsx';

const TOKEN_KEY = 'opal_admin_token';

const groups = [
  {
    title: 'ניהול',
    items: [
      { label: 'לוח בקרה', to: '/admin/control-panel', icon: LayoutDashboard },
      { label: 'מוצרים', to: '/admin/products', icon: Package },
      { label: 'ספקים', to: '/admin/vendors', icon: Building2 },
      { label: 'סוכנים', to: '/admin/agents', icon: Users },
      { label: 'מחירונים', to: '/admin/price-list', icon: Receipt },
      { label: 'מחירון ארגונים', to: '/admin/pricing', icon: Receipt },
    ],
  },
  {
    title: 'דוחות',
    items: [{ label: 'מנויים', to: '/admin/subscribers', icon: UserCheck }],
  },
];

export default function AdminPageShell({ children }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(false);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/admin');
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <aside
        className={cn(
          'border-s border-border bg-card flex flex-col shrink-0 transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gem className="size-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">Opal</span>
              <span className="text-xs text-muted-foreground truncate">ניהול מנויים</span>
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

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto p-4 md:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
