import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bell, Building2, ChevronDown, ChevronUp, CreditCard, FileText, Receipt, Search, Users } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../components/ui/empty.jsx';

const TOKEN_KEY = 'opal_admin_token';

const ALERT_DEFS = [
  { key: 'contactTasks', title: 'צור קשר', icon: Users, severity: 'normal' },
  { key: 'orgPendingApproval', title: 'ארגון ממתין לאישור', icon: Building2, severity: 'warning' },
  { key: 'pendingBeneficiaries', title: 'השלמת טפסים', icon: FileText, severity: 'warning' },
  { key: 'failedPayments', title: 'פיגור תשלום', icon: CreditCard, severity: 'critical' },
  { key: 'organizationCollectionsDebt', title: 'ארגונים לחיוב', icon: Receipt, severity: 'warning' },
];

export default function AlertsDashboard() {
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
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="size-7 text-amber-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-700">{openDebt.toLocaleString('he-IL')} ₪</p>
                  <p className="text-amber-700/80">סה״כ חוב פתוח</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-md relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="ps-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש בהתראות..."
          />
        </div>

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
            const severityBadgeVariant =
              a.severity === 'critical' ? 'destructive' : a.severity === 'warning' ? 'outline' : 'secondary';
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
                        <Badge variant={severityBadgeVariant}>{count}</Badge>
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
                              </>
                            ) : (
                              Object.keys(rows[0] || {})
                                .filter((k) => !['id', 'subscriberDealId'].includes(k))
                                .slice(0, 5)
                                .map((c) => <TableHead key={`${a.key}-${c}`} className="text-right">{c}</TableHead>)
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, idx) => (
                            <TableRow key={`${a.key}-${idx}`}>
                              {a.key === 'failedPayments' ? (
                                <>
                                  <TableCell>{String(r.customerName || '—')}</TableCell>
                                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{String(r.orderId || '—')}</code></TableCell>
                                  <TableCell className="font-bold text-red-600">{Number(r.price || 0)} ₪</TableCell>
                                  <TableCell><Badge variant="destructive" className="text-xs">{String(r.cardcomStatus || '—')}</Badge></TableCell>
                                  <TableCell>{String(r.chargeDate || '—')}</TableCell>
                                </>
                              ) : (
                                Object.keys(rows[0] || {})
                                  .filter((k) => !['id', 'subscriberDealId'].includes(k))
                                  .slice(0, 5)
                                  .map((c) => <TableCell key={`${a.key}-${idx}-${c}`}>{String(r[c] ?? '')}</TableCell>)
                              )}
                            </TableRow>
                          ))}
                          {!rows.length ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
