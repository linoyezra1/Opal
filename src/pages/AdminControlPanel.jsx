import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Wallet, Users, CreditCard, UserCheck, AlertCircle, Building2, Pencil, MessageSquareText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

function toYmd(d) {
  return d.toISOString().slice(0, 10);
}
function monthDefaults() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromDate: toYmd(from), toDate: toYmd(now), month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
}
function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(v || 0));
}

const SECTIONS = [
  { title: 'הכנסות', keys: ['totalRevenue', 'activeSubscribers', 'totalTransactions', 'organizationCollectionsDebt'] },
  { title: 'הוצאות', keys: ['totalExpenses', 'totalProviderPayments', 'totalAgentPayments'] },
  { title: 'משימות לטיפול', keys: ['failedPayments', 'abandonedCarts', 'pendingBeneficiaries', 'contactTasks'] },
];

const CARD_META = {
  totalRevenue: { title: 'סה״כ הכנסות', icon: Wallet, money: true, className: 'border-emerald-300 bg-emerald-50/60' },
  activeSubscribers: { title: 'מנויים פעילים', icon: Users },
  totalTransactions: { title: 'סה״כ עסקאות', icon: CreditCard },
  organizationCollectionsDebt: { title: 'גבייה מארגונים', icon: Building2, money: true },
  totalExpenses: { title: 'סה״כ הוצאות', icon: AlertCircle, money: true, className: 'border-red-300 bg-red-50/60' },
  totalProviderPayments: { title: 'סה״כ תשלום לספק', icon: Building2, money: true },
  totalAgentPayments: { title: 'סה״כ תשלום לסוכן', icon: UserCheck, money: true },
  failedPayments: { title: 'תשלומים תקועים', icon: AlertCircle, task: true },
  abandonedCarts: { title: 'עגלות נטושות', icon: CreditCard, task: true },
  pendingBeneficiaries: { title: 'לקוחות להשלמת פרטים', icon: Users, task: true },
  contactTasks: { title: 'פניות צור קשר', icon: CreditCard, task: true },
};

const HEADER_LABELS = {
  id: 'מזהה',
  orderId: 'מספר הזמנה',
  transactionId: 'מספר הזמנה',
  customerName: 'שם לקוח',
  fullName: 'שם לקוח',
  phoneNumber: 'טלפון',
  phone: 'טלפון',
  email: 'אימייל',
  retailPrice: 'מחיר מכירה',
  providerCost: 'עלות ספק',
  providerId: 'ספק',
  vendorName: 'ספק',
  individualsCount: 'כמות מנויים',
  activeEmployees: 'כמות עובדים',
  amount: 'סכום',
  debt: 'חוב',
  memberPrice: 'מחיר לחבר',
  collectionStatus: 'סטטוס גבייה',
  productName: 'שם מוצר',
  agentCommission: 'עמלת סוכן',
  kind: 'סוג פנייה',
  organizationId: 'מזהה ארגון',
  status: 'סטטוס',
  cardcomStatus: 'סטטוס סליקה',
  createdAt: 'תאריך',
  updatedAt: 'תאריך',
  date: 'תאריך',
  isHandled: 'סטטוס טיפול',
  agentName: 'סוכן',
  orgName: 'ארגון',
  organizationName: 'ארגון',
  cardcomRecurringId: 'אסמכתא קארדקום',
  price: 'מחיר',
  comments: 'הערות',
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
}

export default function AdminControlPanel() {
  const navigate = useNavigate();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [filters, setFilters] = React.useState(() => monthDefaults());
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [modalKey, setModalKey] = React.useState('');
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [commentTarget, setCommentTarget] = React.useState(null);
  const [commentText, setCommentText] = React.useState('');

  const load = React.useCallback(async (next = filters) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams(next);
      const res = await fetch(`${API_BASE}/api/admin/control-panel?${q.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינה נכשלה');
      setData(j);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  React.useEffect(() => { load(filters); }, [load, filters]);

  const overview = data?.overview || {};
  const rows = Array.isArray(data?.drilldowns?.[modalKey]) ? data.drilldowns[modalKey] : [];
  const columns = rows.length ? Object.keys(rows[0]).filter((k) => k !== 'id') : [];
  const isTask = !!CARD_META[modalKey]?.task;

  function openQuickEdit(key, row) {
    if (key === 'abandonedCarts' && row.id) {
      const search = String(row.name || row.customerName || row.fullName || row.id || '').trim();
      navigate(`/admin/contacts?search=${encodeURIComponent(search)}&editKind=abandoned&editId=${encodeURIComponent(row.id)}`);
      return;
    }
    if (key === 'contactTasks' && row.id) {
      const isOrgLead = String(row.kind || '').toLowerCase() === 'corporate';
      if (isOrgLead) {
        const orgName = String(row.organizationName || row.fullName || '').trim();
        navigate(`/admin/organizations?search=${encodeURIComponent(orgName)}&editId=${encodeURIComponent(row.organizationId || '')}`);
        return;
      }
      const search = String(row.fullName || row.customerName || row.name || row.id || '').trim();
      navigate(`/admin/contacts?search=${encodeURIComponent(search)}&editKind=${encodeURIComponent(row.kind || 'private')}&editId=${encodeURIComponent(row.id)}`);
      return;
    }
    if (key === 'pendingBeneficiaries' && row.id) {
      const search = String(row.transactionId || row.id || '').trim();
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(row.id)}`);
      return;
    }
    if ((key === 'activeSubscribers' || key === 'totalTransactions') && row.id) {
      const search = String(row.transactionId || row.id || '').trim();
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(row.id)}`);
    }
    if (key === 'totalAgentPayments' && row.agentId) navigate('/admin/agents');
    if (key === 'organizationCollectionsDebt' && row.organizationId) {
      navigate(`/admin/organizations/${encodeURIComponent(row.organizationId)}?tab=payments`);
    }
  }

  if (!token) return <div dir="rtl" className="p-6">יש להתחבר דרך מסך המנהל.</div>;

  const cardClickable = (key) => !['totalRevenue', 'totalExpenses'].includes(key);
  const readOnlyDrilldown = ['totalProviderPayments', 'totalAgentPayments'].includes(modalKey);

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="size-7 text-primary" />לוח בקרה — סקירה פיננסית</h1>
          <Button type="button" onClick={() => load(filters)} disabled={loading}><RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />רענון</Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                type="month"
                value={filters.month}
                onChange={(e) => {
                  const m = String(e.target.value || '').trim();
                  if (!/^\d{4}-\d{2}$/.test(m)) {
                    setFilters((f) => ({ ...f, month: m }));
                    return;
                  }
                  const [y, mo] = m.split('-').map(Number);
                  const start = new Date(y, mo - 1, 1);
                  const end = new Date(y, mo, 0);
                  const toYmd = (d) => d.toISOString().slice(0, 10);
                  setFilters((f) => ({ ...f, month: m, fromDate: toYmd(start), toDate: toYmd(end) }));
                }}
              />
              <Input type="date" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
              <Input type="date" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
              <div className="text-sm text-muted-foreground flex items-center justify-end">טווח פעיל: {data?.range?.fromDate || filters.fromDate} - {data?.range?.toDate || filters.toDate}</div>
            </div>
          </CardContent>
        </Card>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.keys.map((key) => {
                const meta = CARD_META[key];
                return (
                  cardClickable(key) ? (
                    <button key={key} type="button" className="text-right" onClick={() => setModalKey(key)}>
                      <StatsCard title={meta.title} value={meta.money ? formatCurrency(overview[key]) : String(Math.round(Number(overview[key] || 0)))} icon={meta.icon} className={meta.className} loading={loading && !data} />
                    </button>
                  ) : (
                    <div key={key}>
                      <StatsCard title={meta.title} value={meta.money ? formatCurrency(overview[key]) : String(Math.round(Number(overview[key] || 0)))} icon={meta.icon} className={meta.className} loading={loading && !data} />
                    </div>
                  )
                );
              })}
            </div>
          </div>
        ))}

        <Card>
          <CardHeader><CardTitle>גרף הכנסות ורווח נקי לפי יום</CardTitle></CardHeader>
          <CardContent className="h-[320px] w-full" dir="ltr">
            {Array.isArray(overview.chartSeries) && overview.chartSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v) => `₪${Math.round(v)}`} />
                  <RechartsTooltip formatter={(value) => [formatCurrency(value), 'סכום']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="הכנסות" />
                  <Bar dataKey="netProfit" fill="#c89b3c" name="רווח נקי" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground">אין רשומות להצגה</div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!modalKey} onOpenChange={(open) => !open && setModalKey('')}>
        <DialogContent className="max-w-6xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{CARD_META[modalKey]?.title || 'פירוט'}</DialogTitle>
              {modalKey === 'activeSubscribers' ? <Button asChild size="sm" variant="outline"><Link to="/admin/subscribers">ניהול מלא</Link></Button> : null}
              {modalKey === 'totalProviderPayments' ? <Button asChild size="sm" variant="outline"><Link to="/admin/reports?tab=provider">ניהול מלא</Link></Button> : null}
              {modalKey === 'totalAgentPayments' ? <Button asChild size="sm" variant="outline"><Link to="/admin/reports?tab=agents">ניהול מלא</Link></Button> : null}
              {modalKey === 'organizationCollectionsDebt' ? <Button asChild size="sm" variant="outline"><Link to="/admin/reports?tab=orgs">ניהול מלא</Link></Button> : null}
              {modalKey === 'abandonedCarts' || modalKey === 'contactTasks' ? <Button asChild size="sm" variant="outline"><Link to="/admin/contacts">ניהול מלא</Link></Button> : null}
            </div>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{labelForColumn(c)}</TableHead>)}{modalKey !== 'totalProviderPayments' && modalKey !== 'totalAgentPayments' ? <TableHead>פעולה</TableHead> : null}</TableRow></TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${modalKey}-${idx}`}>
                    {columns.map((c) => {
                      const v = row[c];
                      const isAmount = /amount|cost|commission|profit|debt|revenue|price/i.test(c);
                      return <TableCell key={`${idx}-${c}`}>{isAmount ? formatCurrency(v) : String(v ?? '')}</TableCell>;
                    })}
                    {readOnlyDrilldown ? null : (
                      <TableCell>
                        {modalKey === 'failedPayments' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  setCommentTarget(row);
                                  setCommentText(String(row.comments || ''));
                                  setCommentOpen(true);
                                }}
                                aria-label="הערות"
                              >
                                <MessageSquareText className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>הערות</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="outline" onClick={() => openQuickEdit(modalKey, row)} aria-label="עריכה">
                                <Pencil className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>עריכה</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length + (readOnlyDrilldown ? 0 : 1), 1)} className="text-center text-muted-foreground">
                      אין רשומות להצגה
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הערות לתשלום תקוע</DialogTitle>
          </DialogHeader>
          <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="הערה פנימית" />
          <Button
            onClick={async () => {
              if (!commentTarget?.id) return;
              await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(commentTarget.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ formState: { failedPaymentComment: commentText } }),
              });
              setCommentOpen(false);
              await load(filters);
            }}
          >
            שמירה
          </Button>
        </DialogContent>
      </Dialog>
      </AdminPageShell>
    </TooltipProvider>
  );
}
