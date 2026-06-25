import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Wallet, Users, CreditCard, UserCheck, AlertCircle, Building2, Pencil, MessageSquareText, Bell, Clock, UserX, Search } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../apiBase.js';
import { fmtDateTime } from '../utils/dateUtils.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import { CONTACT_LEADS_CHANGED_EVENT } from '../../lib/contactLeadTasks.js';
import { ADMIN_ALERTS_CHANGED_EVENT } from '../../lib/adminAlertsEvents.js';

const TOKEN_KEY = 'opal_admin_token';

function toYmd(d) {
  return d.toISOString().slice(0, 10);
}
function monthDefaults() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: toYmd(from),
    toDate: toYmd(now),
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    dateFilterMode: 'billing_date',
  };
}
function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(v || 0));
}

const SECTIONS = [
  { title: 'הכנסות', keys: ['totalRevenue', 'privatePaymentCustomers', 'centralizedPaymentCustomers', 'totalTransactions'] },
  { title: 'הוצאות', keys: ['totalExpenses', 'totalProviderPayments', 'totalAgentPayments'] },
  { title: 'סטטוס מנוי', keys: ['activeSubscribers', 'pendingCancellationCount', 'cancellationsCount', 'notActivatedCount'] },
  { title: 'משימות לטיפול', keys: ['failedPayments', 'abandonedCarts', 'pendingBeneficiaries', 'contactTasks'] },
];

const CARD_META = {
  totalRevenue: { title: 'סה״כ הכנסות', icon: Wallet, money: true, className: 'border-emerald-300 bg-emerald-50/60' },

  totalTransactions: { title: 'סה״כ עסקאות', icon: CreditCard },
  privatePaymentCustomers: { title: 'לקוחות בתשלום פרטי (אשראי)', icon: CreditCard },
  centralizedPaymentCustomers: { title: 'לקוחות בתשלום מרוכז', icon: Building2 },
  totalExpenses: { title: 'סה״כ הוצאות', icon: AlertCircle, money: true, className: 'border-red-300 bg-red-50/60' },
  totalProviderPayments: { title: 'סה״כ תשלום לספק', icon: Building2, money: true },
  totalAgentPayments: { title: 'סה״כ תשלום לסוכן', icon: UserCheck, money: true },
  activeSubscribers: { title: 'מנויים פעילים', icon: Users },
  notActivatedCount: { title: 'לא הופעל', icon: UserX, task: true, className: 'border-gray-300 bg-gray-50/60' },
  pendingCancellationCount: { title: 'ממתין לביטול', icon: Clock, task: true, className: 'border-amber-300 bg-amber-50/60' },
  cancellationsCount: { title: 'מבוטלים', icon: AlertCircle, task: true, className: 'border-red-300 bg-red-50/60' },

  failedPayments: { title: 'פיגור תשלום', icon: AlertCircle, task: true },
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
  agentId: 'שם סוכן / מזהה סוכן',
  message: 'הודעה',
  source: 'מקור הגעה',
  landingSlug: 'נתיב דף נחיתה (Slug)',
  landingPageTitle: 'כותרת דף נחיתה',
  isLandingActive: 'דף נחיתה פעיל?',
  leadStatus: 'סטטוס ליד',
  adminNotes: 'הערות מנהל',
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
  chargeDate: 'תאריך חיוב',
  cancellationDate: 'תאריך ביטול',
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
}

function isDateLikeColumn(key) {
  return /date|createdat|updatedat|chargedate|cancellationdate/i.test(String(key || ''));
}

export default function AdminControlPanel() {
  const navigate = useNavigate();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [filters, setFilters] = React.useState(() => monthDefaults());
  const [draftFilters, setDraftFilters] = React.useState(() => monthDefaults());
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [modalKey, setModalKey] = React.useState('');
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [commentTarget, setCommentTarget] = React.useState(null);
  const [commentText, setCommentText] = React.useState('');
  const [incomeView, setIncomeView] = React.useState('revenue');
  const [cancelView, setCancelView] = React.useState('centralized');
  const [alertsSummary, setAlertsSummary] = React.useState({});

  const load = React.useCallback(async (next = filters) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      q.set('fromDate', String(next.fromDate || '').trim());
      q.set('toDate', String(next.toDate || '').trim());
      q.set('month', String(next.month || '').trim());
      q.set('dateFilterMode', String(next.dateFilterMode || 'billing_date').trim());
      const res = await fetch(`${API_BASE}/api/admin/control-panel?${q.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינה נכשלה');
      setData(j);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { load(filters); }, [token]);
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const loadAlerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/alerts-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.success || cancelled) return;
        setAlertsSummary(j);
      } catch {
        /* ignore */
      }
    };
    const refreshDashboard = () => {
      loadAlerts();
      load(filters);
    };
    loadAlerts();
    window.addEventListener(CONTACT_LEADS_CHANGED_EVENT, refreshDashboard);
    window.addEventListener(ADMIN_ALERTS_CHANGED_EVENT, refreshDashboard);
    const timer = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(CONTACT_LEADS_CHANGED_EVENT, refreshDashboard);
      window.removeEventListener(ADMIN_ALERTS_CHANGED_EVENT, refreshDashboard);
    };
  }, [token, load, filters]);

  const overview = data?.overview || {};
  const grossProfit = Number(overview.totalRevenue || 0) - Number(overview.totalExpenses || 0);
  const rows = Array.isArray(data?.drilldowns?.[modalKey]) ? data.drilldowns[modalKey] : [];
  const columns = rows.length
    ? Object.keys(rows[0]).filter((k) => k !== 'id' && k !== 'subscriberDealId')
    : [];
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
    if (key === 'pendingCancellationCount' && row.id) {
      const search = String(row.transactionId || row.id || '').trim();
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(row.id)}`);
      return;
    }
    if (key === 'failedPayments' || key === 'cancelledCustomers') {
      const search = String(row.cardcomRecurringId || row.orderId || row.transactionId || '').trim();
      if (!search) return;
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&status=cancelled`);
      return;
    }
    if ((key === 'activeSubscribers' || key === 'totalTransactions') && row.id) {
      const search = String(row.transactionId || row.id || '').trim();
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(row.id)}`);
    }
    if (key === 'totalAgentPayments' && row.agentId) navigate('/admin/agents');
  }

  if (!token) return <div dir="rtl" className="p-6">יש להתחבר דרך מסך המנהל.</div>;

  const cardClickable = (key) =>
    !['totalRevenue', 'totalExpenses', 'privatePaymentCustomers', 'centralizedPaymentCustomers'].includes(key);
  const readOnlyDrilldown = ['totalProviderPayments', 'totalAgentPayments'].includes(modalKey);
  const totalActiveAlerts =
    Number(alertsSummary?.contactTasks || 0)
    + Number(alertsSummary?.orgPendingApproval || 0)
    + Number(alertsSummary?.pendingBeneficiaries || 0)
    + Number(alertsSummary?.pendingCancellationSubscriptions || 0)
    + Number(alertsSummary?.paymentArrears || 0)
    + Number(alertsSummary?.organizationsToBill || 0)
    + Number(alertsSummary?.providerPaymentsDue || 0)
    + Number(alertsSummary?.agentPaymentsDue || 0);

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="size-7 text-primary" />לוח בקרה — סקירה פיננסית</h1>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="relative" onClick={() => navigate('/admin/alerts')} aria-label="מעבר למרכז התראות">
              <Bell className="size-4" />
              {totalActiveAlerts > 0 ? (
                <span className="absolute -top-2 -end-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {totalActiveAlerts}
                </span>
              ) : null}
            </Button>
            <Button type="button" onClick={() => load(filters)} disabled={loading}><RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />רענון</Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={draftFilters.dateFilterMode === 'billing_date' ? 'default' : 'outline'}
                onClick={() => setDraftFilters((f) => ({ ...f, dateFilterMode: 'billing_date' }))}
              >
                סנן לפי תאריך חיוב
              </Button>
              <Button
                type="button"
                variant={draftFilters.dateFilterMode === 'join_date' ? 'default' : 'outline'}
                onClick={() => setDraftFilters((f) => ({ ...f, dateFilterMode: 'join_date' }))}
              >
                סנן לפי תאריך הצטרפות
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4 items-end">
              <Input
                type="month"
                value={draftFilters.month}
                onChange={(e) => {
                  const m = String(e.target.value || '').trim();
                  if (!/^\d{4}-\d{2}$/.test(m)) {
                    setDraftFilters((f) => ({ ...f, month: m }));
                    return;
                  }
                  const [y, mo] = m.split('-').map(Number);
                  const start = new Date(y, mo - 1, 1);
                  const end = new Date(y, mo, 0);
                  const toYmd = (d) => d.toISOString().slice(0, 10);
                  setDraftFilters((f) => ({ ...f, month: m, fromDate: toYmd(start), toDate: toYmd(end) }));
                }}
              />
              <Input
                type="date"
                aria-label={draftFilters.dateFilterMode === 'join_date' ? 'מתאריך הצטרפות' : 'מתאריך חיוב'}
                value={draftFilters.fromDate}
                onChange={(e) => setDraftFilters((f) => ({ ...f, fromDate: e.target.value }))}
              />
              <Input
                type="date"
                aria-label={draftFilters.dateFilterMode === 'join_date' ? 'עד תאריך הצטרפות' : 'עד תאריך חיוב'}
                value={draftFilters.toDate}
                onChange={(e) => setDraftFilters((f) => ({ ...f, toDate: e.target.value }))}
              />
              <Button
                type="button"
                className="gap-2"
                disabled={loading}
                onClick={() => {
                  setFilters(draftFilters);
                  load(draftFilters);
                }}
              >
                <Search className={`size-4 ${loading ? 'animate-pulse' : ''}`} />
                חיפוש
              </Button>
              <div className="text-sm text-muted-foreground flex flex-col items-end gap-0.5 md:col-span-4">
                <span>
                  טווח פעיל: {data?.range?.fromDate || filters.fromDate} - {data?.range?.toDate || filters.toDate}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="space-y-6">

        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.keys.map((key) => {
                const meta = CARD_META[key];
                const drilldownKey = key === 'cancellationsCount' ? 'cancelledCustomers' : key;
                return (
                  cardClickable(key) ? (
                    <button key={key} type="button" className="text-right" onClick={() => setModalKey(drilldownKey)}>
                      <StatsCard
                        title={meta.title}
                        value={meta.money ? formatCurrency(overview[key]) : String(Math.round(Number(overview[key] || 0)))}
                        icon={meta.icon}
                        className={meta.className}
                        loading={loading && !data}
                        subText={key === 'totalRevenue' ? `רווח גולמי: ${formatCurrency(grossProfit)}` : ''}
                      />
                    </button>
                  ) : (
                    <div key={key}>
                      <StatsCard
                        title={meta.title}
                        value={meta.money ? formatCurrency(overview[key]) : String(Math.round(Number(overview[key] || 0)))}
                        icon={meta.icon}
                        className={meta.className}
                        loading={loading && !data}
                        subText={key === 'totalRevenue' ? `רווח גולמי: ${formatCurrency(grossProfit)}` : ''}
                      />
                    </div>
                  )
                );
              })}
            </div>
          </div>
        ))}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-emerald-200/70 bg-emerald-50/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-emerald-800">גרף הכנסות (עסקאות מוצלחות)</CardTitle>
                <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                  <Button size="sm" variant={incomeView === 'revenue' ? 'default' : 'ghost'} onClick={() => setIncomeView('revenue')}>הכנסות</Button>
                  <Button size="sm" variant={incomeView === 'count' ? 'default' : 'ghost'} onClick={() => setIncomeView('count')}>כמות</Button>
                  <Button size="sm" variant={incomeView === 'net' ? 'default' : 'ghost'} onClick={() => setIncomeView('net')}>רווח</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full space-y-2" dir="ltr">
              {Array.isArray(overview.chartSeries) && overview.chartSeries.length ? (
                <>
                <ResponsiveContainer width="100%" height="86%">
                  <BarChart data={overview.chartSeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => incomeView === 'count' ? `${Math.round(Number(v || 0))}` : `₪${Math.round(Number(v || 0))}`} />
                    <RechartsTooltip
                      contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                      formatter={(value) => {
                        if (incomeView === 'count') return [String(Math.round(Number(value || 0))), 'כמות לקוחות חדשים ששילמו'];
                        if (incomeView === 'net') return [formatCurrency(value), 'רווח נקי'];
                        return [formatCurrency(value), 'הכנסות'];
                      }}
                    />
                    {incomeView === 'count' ? (
                      <Bar dataKey="count" fill="#16a34a" name="כמות לקוחות חדשים ששילמו" />
                    ) : incomeView === 'net' ? (
                      <Bar dataKey="netProfit" fill="#22c55e" name="רווח נקי" />
                    ) : (
                      <Bar dataKey="revenue" fill="#16a34a" name="הכנסות" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">סה"כ לקוחות חדשים ששילמו: </span>
                  <span className="font-semibold text-emerald-800">{Number(overview.totalTransactions || 0)}</span>
                  <span className="text-muted-foreground"> | סה"כ הכנסות: </span>
                  <span className="font-semibold text-emerald-800">{formatCurrency(overview.successfulRevenue || 0)}</span>
                </div>
                </>
              ) : <div className="flex h-full items-center justify-center text-muted-foreground">אין רשומות להצגה</div>}
            </CardContent>
          </Card>

          <Card className="border-red-200/70 bg-red-50/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-red-800">גרף ביטולים לפי סוג תשלום</CardTitle>
                <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                  <Button size="sm" variant={cancelView === 'centralized' ? 'default' : 'ghost'} onClick={() => setCancelView('centralized')}>תשלום מרוכז</Button>
                  <Button size="sm" variant={cancelView === 'private' ? 'default' : 'ghost'} onClick={() => setCancelView('private')}>תשלום פרטי</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full space-y-2" dir="ltr">
              {Array.isArray(overview.chartSeries) && overview.chartSeries.length ? (
                <>
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={overview.chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(v) => `${Math.round(Number(v || 0))}`} />
                      <RechartsTooltip
                        contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                        formatter={(value, key) => [
                          String(Math.round(Number(value || 0))),
                          key === 'cancellationsCentralized' ? 'ביטולים — תשלום מרוכז' : key === 'cancellationsPrivate' ? 'ביטולים — תשלום פרטי' : 'סה״כ ביטולים',
                        ]}
                        labelFormatter={(label) => `תאריך: ${label}`}
                      />
                      {cancelView === 'centralized' ? (
                        <Line type="monotone" dataKey="cancellationsCentralized" stroke="#dc2626" name="תשלום מרוכז" strokeWidth={2.5} dot={false} />
                      ) : (
                        <Line type="monotone" dataKey="cancellationsPrivate" stroke="#f97316" name="תשלום פרטי" strokeWidth={2.5} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setModalKey('cancelledCustomers')}>לרשומות</Button>
                    <Button size="sm" onClick={() => navigate('/admin/subscribers?status=cancelled')}>ניהול מלא</Button>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-muted-foreground">סה"כ מבוטלים בטווח: </span>
                    <span className="font-semibold text-red-800">{Number(overview.totalCancellations || 0)}</span>
                    <span className="text-muted-foreground"> | מרוכז: </span>
                    <span className="font-semibold text-red-800">{Number(overview.totalCancellationsCentralized || 0)}</span>
                    <span className="text-muted-foreground"> | פרטי: </span>
                    <span className="font-semibold text-red-800">{Number(overview.totalCancellationsPrivate || 0)}</span>
                  </div>
                </>
              ) : <div className="flex h-full items-center justify-center text-muted-foreground">אין רשומות להצגה</div>}
            </CardContent>
          </Card>
        </div>

        </div>

      </div>

      <Dialog open={!!modalKey} onOpenChange={(open) => !open && setModalKey('')}>
        <DialogContent className="max-w-6xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{CARD_META[modalKey]?.title || 'פירוט'}</DialogTitle>
              {modalKey === 'activeSubscribers' ? <Button asChild size="sm" variant="outline"><Link to="/admin/subscribers">ניהול מלא</Link></Button> : null}
              {modalKey === 'cancelledCustomers' ? <Button asChild size="sm" variant="outline"><Link to="/admin/subscribers?status=cancelled">ניהול מלא</Link></Button> : null}
              {modalKey === 'totalProviderPayments' ? <Button asChild size="sm" variant="outline"><Link to="/admin/reports?tab=provider">ניהול מלא</Link></Button> : null}
              {modalKey === 'totalAgentPayments' ? <Button asChild size="sm" variant="outline"><Link to="/admin/reports?tab=agents">ניהול מלא</Link></Button> : null}
              {modalKey === 'abandonedCarts' || modalKey === 'contactTasks' ? <Button asChild size="sm" variant="outline"><Link to="/admin/contacts">ניהול מלא</Link></Button> : null}
            </div>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>{columns.map((c) => <TableHead key={c} className="text-right">{labelForColumn(c)}</TableHead>)}{modalKey !== 'totalProviderPayments' && modalKey !== 'totalAgentPayments' ? <TableHead className="text-right">פעולה</TableHead> : null}</TableRow></TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${modalKey}-${idx}`}>
                    {columns.map((c) => {
                      const v = row[c];
                      const isAmount = /amount|cost|commission|profit|debt|revenue|price/i.test(c);
                      const isDate = isDateLikeColumn(c);
                      return <TableCell key={`${idx}-${c}`} className="text-right">{isAmount ? formatCurrency(v) : isDate ? fmtDateTime(v) : String(v ?? '')}</TableCell>;
                    })}
                    {readOnlyDrilldown ? null : (
                      <TableCell className="text-right">
                        {modalKey === 'failedPayments' ? (
                          <div className="flex items-center gap-1 justify-end">
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => openQuickEdit('failedPayments', row)}
                                  aria-label="מעבר ללקוח"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>מעבר לרשומת הלקוח</TooltipContent>
                            </Tooltip>
                          </div>
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
