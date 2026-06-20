import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Receipt,
  Users,
  Pencil,
  Truck,
  Briefcase,
  Clock,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import { ADMIN_ALERTS_CHANGED_EVENT } from '../../lib/adminAlertsEvents.js';
import { CONTACT_LEADS_CHANGED_EVENT } from '../../lib/contactLeadTasks.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../components/ui/empty.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';

const ALERT_DEFS = [
  { key: 'contactTasks', title: 'צור קשר', icon: Users, severity: 'normal' },
  { key: 'orgPendingApproval', title: 'ארגון ממתין לאישור', icon: Building2, severity: 'warning' },
  { key: 'pendingBeneficiaries', title: 'השלמת טפסים', icon: FileText, severity: 'warning' },
  { key: 'pendingCancellationCount', title: 'ממתין לביטול', icon: Clock, severity: 'critical' },
  { key: 'failedPayments', title: 'פיגור תשלום', icon: CreditCard, severity: 'critical' },
  { key: 'organizationCollectionsDebt', title: 'ארגונים לחיוב', icon: Receipt, severity: 'warning' },
  { key: 'providerPaymentsDue', title: 'תשלומים לספקים', icon: Truck, severity: 'warning' },
  { key: 'agentPaymentsDue', title: 'תשלומים לסוכנים', icon: Briefcase, severity: 'warning' },
];

const COLUMN_LABELS = {
  customerName: 'שם לקוח',
  orderId: 'מספר הזמנה',
  price: 'סכום',
  cardcomStatus: 'סטטוס כרטיס',
  chargeDate: 'תאריך חיוב',
  fullName: 'שם מלא',
  phone: 'טלפון',
  email: 'אימייל',
  organizationName: 'שם ארגון',
  organizationId: 'מזהה ארגון',
  createdAt: 'תאריך יצירה',
  updatedAt: 'תאריך עדכון',
  kind: 'סוג',
  comments: 'הערות',
  message: 'הודעה',
  transactionId: 'מספר הזמנה',
  finalBillingMonth: 'חודש בילינג אחרון',
  subscriptionStatus: 'סטטוס מנוי',
  companyId: 'ח.פ',
  billingType: 'סוג חיוב',
  activeEmployees: 'עובדים פעילים',
  memberPrice: 'מחיר לחבר / עובד',
  collectionStatus: 'סטטוס גבייה',
  totalDueLocked: 'סה״כ לתשלום',
  debt: 'חוב משוער',
  vendorName: 'שם ספק',
  vendorId: 'מזהה ספק',
  month: 'חודש',
  balance: 'יתרה',
  totalAmount: 'סה״כ לתשלום',
  status: 'סטטוס',
  agentName: 'שם סוכן',
  agentId: 'מזהה סוכן',
  amount: 'סכום',
};

const ALERT_COLUMNS = {
  contactTasks: ['fullName', 'phone', 'email', 'kind', 'message'],
  orgPendingApproval: ['organizationName', 'organizationId', 'companyId', 'billingType', 'email'],
  pendingBeneficiaries: ['fullName', 'phone', 'transactionId', 'amount', 'createdAt'],
  pendingCancellationCount: ['fullName', 'phone', 'transactionId', 'finalBillingMonth', 'subscriptionStatus'],
  organizationCollectionsDebt: [
    'organizationName',
    'organizationId',
    'activeEmployees',
    'memberPrice',
    'totalDueLocked',
    'collectionStatus',
  ],
  providerPaymentsDue: ['vendorName', 'month', 'totalAmount', 'balance', 'status'],
  agentPaymentsDue: ['agentName', 'month', 'totalAmount', 'balance', 'status'],
};

function labelForColumn(key) {
  return COLUMN_LABELS[key] || key;
}

function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
}

function formatCellValue(key, value) {
  if (value == null || value === '') return '—';
  if (key === 'kind') {
    const k = String(value).toLowerCase();
    if (k === 'corporate') return 'תאגיד / חברה';
    if (k === 'private') return 'פרטי';
  }
  if (key === 'collectionStatus') {
    const s = String(value).toLowerCase();
    if (s === 'open') return 'פתוח';
    if (s === 'closed') return 'סגור';
  }
  if (
    key === 'memberPrice' ||
    key === 'totalDueLocked' ||
    key === 'debt' ||
    key === 'balance' ||
    key === 'totalAmount' ||
    key === 'amount' ||
    key === 'price'
  ) {
    return formatCurrency(value);
  }
  return String(value);
}

function summaryCountKey(key) {
  if (key === 'failedPayments') return 'paymentArrears';
  if (key === 'organizationCollectionsDebt') return 'organizationsToBill';
  if (key === 'pendingCancellationCount') return 'pendingCancellationSubscriptions';
  return key;
}

export default function AlertsDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState({ overview: {}, drilldowns: {} });
  const [summary, setSummary] = React.useState({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [openSections, setOpenSections] = React.useState({});
  const openTab = String(searchParams.get('tab') || '').trim();

  const reload = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [resData, resSummary] = await Promise.all([
        fetch(`${API_BASE}/api/admin/control-panel`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/alerts-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const j = await resData.json().catch(() => ({}));
      const s = await resSummary.json().catch(() => ({}));
      if (!resData.ok || !j.success) throw new Error(j.error || 'טעינת התראות נכשלה');
      setData(j);
      setSummary(s?.success ? s : {});
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const onRefresh = () => {
      reload();
    };
    window.addEventListener(ADMIN_ALERTS_CHANGED_EVENT, onRefresh);
    window.addEventListener(CONTACT_LEADS_CHANGED_EVENT, onRefresh);
    return () => {
      window.removeEventListener(ADMIN_ALERTS_CHANGED_EVENT, onRefresh);
      window.removeEventListener(CONTACT_LEADS_CHANGED_EVENT, onRefresh);
    };
  }, [reload]);

  React.useEffect(() => {
    const next = {};
    for (const a of ALERT_DEFS) next[a.key] = openTab ? openTab === a.key : false;
    setOpenSections(next);
  }, [openTab]);

  const rowsFor = (key) => {
    if (key === 'pendingCancellationCount' && Array.isArray(summary?.pendingCancellationDrilldown)) {
      return summary.pendingCancellationDrilldown;
    }
    return Array.isArray(data?.drilldowns?.[key]) ? data.drilldowns[key] : [];
  };

  const totalAlerts =
    Number(summary?.contactTasks || 0) +
    Number(summary?.orgPendingApproval || 0) +
    Number(summary?.pendingBeneficiaries || 0) +
    Number(summary?.pendingCancellationSubscriptions || 0) +
    Number(summary?.paymentArrears || 0) +
    Number(summary?.organizationsToBill || 0) +
    Number(summary?.providerPaymentsDue || 0) +
    Number(summary?.agentPaymentsDue || 0);

  function countFor(key) {
    const sk = summaryCountKey(key);
    const fromSummary = Number(summary?.[sk] ?? summary?.[key] ?? NaN);
    if (Number.isFinite(fromSummary)) return fromSummary;
    return rowsFor(key).length;
  }

  function filteredRows(key) {
    const q = String(searchQuery || '').trim().toLowerCase();
    const rows = rowsFor(key);
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row || {}).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openAlertRecord(key, row) {
    if (!row) return;
    if (key === 'failedPayments') {
      const search = String(row.cardcomRecurringId || row.orderId || row.transactionId || '').trim();
      if (!search) return;
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}`);
      return;
    }
    if (key === 'pendingBeneficiaries') {
      const search = String(row.transactionId || row.id || '').trim();
      if (!search) return;
      navigate(
        `/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(String(row.id || ''))}`
      );
      return;
    }
    if (key === 'pendingCancellationCount') {
      const search = String(row.transactionId || row.id || '').trim();
      if (!search) return;
      navigate(
        `/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(String(row.id || ''))}`
      );
      return;
    }
    if (key === 'contactTasks') {
      const kind = String(row.kind || '').toLowerCase();
      if (kind === 'corporate') {
        const orgName = String(row.organizationName || row.fullName || '').trim();
        navigate(
          `/admin/organizations?search=${encodeURIComponent(orgName)}&editId=${encodeURIComponent(String(row.organizationId || ''))}`
        );
      } else {
        const search = String(row.fullName || row.customerName || row.name || row.id || '').trim();
        navigate(
          `/admin/contacts?search=${encodeURIComponent(search)}&editKind=${encodeURIComponent(kind || 'private')}&editId=${encodeURIComponent(String(row.id || ''))}`
        );
      }
      return;
    }
    if (key === 'orgPendingApproval') {
      const orgId = String(row.organizationId || row.id || '').trim();
      const orgName = String(row.organizationName || '').trim();
      const qs = new URLSearchParams({ tab: 'applications' });
      if (orgName) qs.set('search', orgName);
      if (orgId) qs.set('editId', orgId);
      navigate(`/admin/organizations?${qs.toString()}`);
      return;
    }
    if (key === 'organizationCollectionsDebt') {
      const orgId = String(row.organizationId || '').trim();
      if (!orgId) return;
      navigate(`/admin/organizations/${encodeURIComponent(orgId)}?tab=payments`);
      return;
    }
    if (key === 'providerPaymentsDue') {
      const vendorId = String(row.vendorId || '').trim();
      const payoutId = String(row.payoutId || row.id || '').trim();
      if (!vendorId) return;
      const qs = new URLSearchParams();
      if (payoutId) qs.set('highlightPayoutId', payoutId);
      navigate(`/admin/vendors/${encodeURIComponent(vendorId)}?${qs.toString()}`);
      return;
    }
    if (key === 'agentPaymentsDue') {
      const agentId = String(row.agentId || '').trim();
      const snapshotId = String(row.snapshotId || row.id || '').trim();
      if (!agentId) return;
      const qs = new URLSearchParams({ tab: 'commissions' });
      if (snapshotId) qs.set('highlightSnapshotId', snapshotId);
      navigate(`/admin/agents/${encodeURIComponent(agentId)}?${qs.toString()}`);
    }
  }

  function columnsForAlert(key, rows) {
    if (ALERT_COLUMNS[key]) return ALERT_COLUMNS[key];
    return Object.keys(rows[0] || {})
      .filter((k) => !['id', 'subscriberDealId', 'payoutId', 'snapshotId'].includes(k))
      .slice(0, 5);
  }

  return (
    <AdminPageShell>
      <div dir="rtl" className="space-y-5 text-right">
        <h1 className="text-2xl font-bold">התראות</h1>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {loading ? <p className="text-muted-foreground text-sm">טוען…</p> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-xl bg-muted flex items-center justify-center">
                  <Bell className="size-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{totalAlerts}</p>
                  <p className="text-muted-foreground">סה״כ התראות פתוחות</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <UnifiedFilterShell
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="חיפוש בהתראות..."
          className="max-w-2xl"
        />

        {totalAlerts === 0 && !loading ? (
          <Card>
            <CardContent className="py-14">
              <Empty>
                <EmptyMedia variant="icon">
                  <Bell className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין התראות פתוחות</EmptyTitle>
                <EmptyDescription>כל המשימות טופלו בהצלחה</EmptyDescription>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ALERT_DEFS.map((a) => {
              const rows = filteredRows(a.key);
              const count = countFor(a.key);
              const Icon = a.icon;
              const cols = columnsForAlert(a.key, rows);
              const colSpan = (a.key === 'failedPayments' ? 6 : cols.length + 1) || 6;

              return (
                <Card key={a.key}>
                  <button
                    type="button"
                    className="w-full text-right"
                    onClick={() => toggleSection(a.key)}
                    aria-expanded={!!openSections[a.key]}
                  >
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="size-5 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{a.title}</CardTitle>
                            <CardDescription>{count} פריטים</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              count > 0 ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {count}
                          </span>
                          {openSections[a.key] ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>
                  {openSections[a.key] ? (
                    <CardContent className="pt-0">
                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {a.key === 'failedPayments' ? (
                                <>
                                  <TableHead className="text-right">לקוח</TableHead>
                                  <TableHead className="text-right">מזהה הזמנה</TableHead>
                                  <TableHead className="text-right">סכום</TableHead>
                                  <TableHead className="text-right">סטטוס כרטיס</TableHead>
                                  <TableHead className="text-right">תאריך חיוב</TableHead>
                                  <TableHead className="text-right">פעולה</TableHead>
                                </>
                              ) : (
                                cols.map((c) => (
                                  <TableHead key={`${a.key}-${c}`} className="text-right">
                                    {labelForColumn(c)}
                                  </TableHead>
                                ))
                              )}
                              {a.key !== 'failedPayments' ? (
                                <TableHead className="text-right">פעולה</TableHead>
                              ) : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((r, idx) => (
                              <TableRow
                                key={`${a.key}-${r.id || r.organizationId || idx}`}
                                className="cursor-pointer hover:bg-muted/30"
                                onClick={() => openAlertRecord(a.key, r)}
                              >
                                {a.key === 'failedPayments' ? (
                                  <>
                                    <TableCell>{String(r.customerName || '—')}</TableCell>
                                    <TableCell>
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                        {String(r.orderId || '—')}
                                      </code>
                                    </TableCell>
                                    <TableCell className="font-bold text-red-600">
                                      {Number(r.price || 0)} ₪
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="destructive" className="text-xs">
                                        {String(r.cardcomStatus || '—')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{String(r.chargeDate || '—')}</TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAlertRecord(a.key, r);
                                        }}
                                      >
                                        <Pencil className="size-3.5 me-1" />
                                        עריכה
                                      </Button>
                                    </TableCell>
                                  </>
                                ) : (
                                  cols.map((c) => (
                                    <TableCell key={`${a.key}-${idx}-${c}`}>
                                      {formatCellValue(c, r[c])}
                                    </TableCell>
                                  ))
                                )}
                                {a.key !== 'failedPayments' ? (
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAlertRecord(a.key, r);
                                      }}
                                    >
                                      <Pencil className="size-3.5 me-1" />
                                      עריכה
                                    </Button>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            ))}
                            {!rows.length ? (
                              <TableRow>
                                <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                                  אין רשומות להצגה
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
