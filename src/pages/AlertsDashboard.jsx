import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bell, Building2, ChevronDown, ChevronUp, CreditCard, FileText, Receipt, Users, Pencil } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
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
  { key: 'failedPayments', title: 'פיגור תשלום', icon: CreditCard, severity: 'critical' },
  { key: 'organizationCollectionsDebt', title: 'ארגונים לחיוב', icon: Receipt, severity: 'warning' },
];

const HEADER_LABELS = {
  customerName: 'שם לקוח',
  orderId: 'מספר הזמנה',
  price: 'סכום',
  cardcomStatus: 'סטטוס כרטיס',
  chargeDate: 'תאריך חיוב',
  fullName: 'שם מלא',
  phone: 'טלפון',
  email: 'אימייל',
  organizationName: 'ארגון',
  createdAt: 'תאריך יצירה',
  updatedAt: 'תאריך עדכון',
  kind: 'סוג',
  comments: 'הערות',
  transactionId: 'מספר הזמנה',
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
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

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
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
        if (!cancelled) {
          setData(j);
          setSummary(s?.success ? s : {});
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'שגיאה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
    const next = {};
    for (const a of ALERT_DEFS) next[a.key] = openTab ? openTab === a.key : false;
    setOpenSections(next);
  }, [openTab]);

  const rowsFor = (key) => {
    if (key === 'orgPendingApproval') {
      const all = Array.isArray(data?.drilldowns?.contactTasks) ? data.drilldowns.contactTasks : [];
      return all.filter((x) => String(x.kind || '').toLowerCase() === 'corporate');
    }
    return Array.isArray(data?.drilldowns?.[key]) ? data.drilldowns[key] : [];
  };

  const totalAlerts = Number(summary?.contactTasks || 0)
    + Number(summary?.orgPendingApproval || 0)
    + Number(summary?.pendingBeneficiaries || 0)
    + Number(summary?.paymentArrears || 0)
    + Number(summary?.organizationsToBill || 0);
  const openDebt = Number(data?.overview?.organizationCollectionsDebt || 0)
    + rowsFor('failedPayments').reduce((sum, r) => sum + Number(r.price || 0), 0);

  function countFor(key) {
    if (key === 'contactTasks') return Number(summary?.contactTasks || rowsFor(key).length);
    if (key === 'orgPendingApproval') return Number(summary?.orgPendingApproval || rowsFor(key).length);
    if (key === 'pendingBeneficiaries') return Number(summary?.pendingBeneficiaries || rowsFor(key).length);
    if (key === 'failedPayments') return Number(summary?.paymentArrears || rowsFor(key).length);
    if (key === 'organizationCollectionsDebt') return Number(summary?.organizationsToBill || rowsFor(key).length);
    return rowsFor(key).length;
  }

  function filteredRows(key) {
    const q = String(searchQuery || '').trim().toLowerCase();
    const rows = rowsFor(key);
    if (!q) return rows;
    return rows.filter((row) => Object.values(row || {}).some((v) => String(v ?? '').toLowerCase().includes(q)));
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
      navigate(`/admin/subscribers?search=${encodeURIComponent(search)}&editId=${encodeURIComponent(String(row.id || ''))}`);
      return;
    }
    if (key === 'contactTasks') {
      const kind = String(row.kind || '').toLowerCase();
      if (kind === 'corporate') {
        const orgName = String(row.organizationName || row.fullName || '').trim();
        navigate(`/admin/organizations?search=${encodeURIComponent(orgName)}&editId=${encodeURIComponent(String(row.organizationId || ''))}`);
      } else {
        const search = String(row.fullName || row.customerName || row.name || row.id || '').trim();
        navigate(`/admin/contacts?search=${encodeURIComponent(search)}&editKind=${encodeURIComponent(kind || 'private')}&editId=${encodeURIComponent(String(row.id || ''))}`);
      }
      return;
    }
    if (key === 'orgPendingApproval') {
      const orgName = String(row.organizationName || row.fullName || '').trim();
      navigate(`/admin/organizations?search=${encodeURIComponent(orgName)}&editId=${encodeURIComponent(String(row.organizationId || ''))}`);
      return;
    }
    if (key === 'organizationCollectionsDebt') {
      const orgId = String(row.organizationId || '').trim();
      if (!orgId) return;
      navigate(`/admin/organizations/${encodeURIComponent(orgId)}?tab=payments`);
    }
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
                <EmptyMedia variant="icon"><Bell className="size-8" /></EmptyMedia>
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
            return (
              <Card key={a.key}>
                <button type="button" className="w-full text-right" onClick={() => toggleSection(a.key)} aria-expanded={!!openSections[a.key]}>
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
                        {openSections[a.key] ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
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
                              Object.keys(rows[0] || {})
                                .filter((k) => !['id', 'subscriberDealId'].includes(k))
                                .slice(0, 5)
                                .map((c) => <TableHead key={`${a.key}-${c}`} className="text-right">{labelForColumn(c)}</TableHead>)
                            )}
                            {a.key !== 'failedPayments' ? <TableHead className="text-right">פעולה</TableHead> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, idx) => (
                            <TableRow key={`${a.key}-${idx}`} className="cursor-pointer hover:bg-muted/30" onClick={() => openAlertRecord(a.key, r)}>
                              {a.key === 'failedPayments' ? (
                                <>
                                  <TableCell>{String(r.customerName || '—')}</TableCell>
                                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{String(r.orderId || '—')}</code></TableCell>
                                  <TableCell className="font-bold text-red-600">{Number(r.price || 0)} ₪</TableCell>
                                  <TableCell><Badge variant="destructive" className="text-xs">{String(r.cardcomStatus || '—')}</Badge></TableCell>
                                  <TableCell>{String(r.chargeDate || '—')}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                                      onClick={(e) => { e.stopPropagation(); openAlertRecord(a.key, r); }}
                                    >
                                      <Pencil className="size-3.5 me-1" />
                                      עריכה
                                    </Button>
                                  </TableCell>
                                </>
                              ) : (
                                Object.keys(rows[0] || {})
                                  .filter((k) => !['id', 'subscriberDealId'].includes(k))
                                  .slice(0, 5)
                                  .map((c) => <TableCell key={`${a.key}-${idx}-${c}`}>{String(r[c] ?? '')}</TableCell>)
                              )}
                              {a.key !== 'failedPayments' ? (
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                                    onClick={(e) => { e.stopPropagation(); openAlertRecord(a.key, r); }}
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
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
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
