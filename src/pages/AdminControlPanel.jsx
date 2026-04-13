import React from 'react';
import { LayoutDashboard, RefreshCw, Wallet, Users, CreditCard, UserCheck, AlertCircle, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';

const TOKEN_KEY = 'opal_admin_token';

function toYmd(d) {
  return d.toISOString().slice(0, 10);
}

function currentMonthDefaults() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromDate: toYmd(from), toDate: toYmd(now), month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

const METRICS = [
  { key: 'activeSubscribers', title: 'מנויים פעילים', icon: Users },
  { key: 'totalTransactions', title: 'סה״כ עסקאות', icon: CreditCard },
  { key: 'totalProviderPayments', title: 'סה״כ תשלום לספק', icon: Building2, money: true },
  { key: 'totalAgentPayments', title: 'סה״כ תשלום לסוכן', icon: UserCheck, money: true },
  { key: 'failedPayments', title: 'תשלומים תקועים', icon: AlertCircle },
  { key: 'organizationCollectionsDebt', title: 'גבייה מארגונים', icon: Wallet, money: true },
  { key: 'totalNetProfit', title: 'רווח נקי', icon: Wallet, money: true },
];

export default function AdminControlPanel() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const defaults = React.useMemo(() => currentMonthDefaults(), []);
  const [filters, setFilters] = React.useState(defaults);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [modalKey, setModalKey] = React.useState('');

  const load = React.useCallback(async (nextFilters = filters) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (nextFilters.fromDate) q.set('fromDate', nextFilters.fromDate);
      if (nextFilters.toDate) q.set('toDate', nextFilters.toDate);
      if (nextFilters.month) q.set('month', nextFilters.month);
      const res = await fetch(`${API_BASE}/api/admin/control-panel?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינה נכשלה');
      setData(j);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  React.useEffect(() => {
    load(filters);
  }, [load, filters]);

  const overview = data?.overview || {};
  const chartData = Array.isArray(overview.chartSeries) ? overview.chartSeries : [];
  const drilldowns = data?.drilldowns || {};
  const modalRows = Array.isArray(drilldowns[modalKey]) ? drilldowns[modalKey] : [];
  const modalColumns = modalRows.length ? Object.keys(modalRows[0]) : [];

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <p className="text-foreground">יש להתחבר דרך מסך המנהל.</p>
      </div>
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="size-7 text-primary" />
            לוח בקרה — סקירה פיננסית
          </h1>
          <Button type="button" onClick={() => load(filters)} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'טוען...' : 'רענון'}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
              />
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
              />
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
              />
              <div className="text-sm text-muted-foreground flex items-center justify-end">
                טווח: {data?.range?.fromDate || filters.fromDate} עד {data?.range?.toDate || filters.toDate}
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <button key={m.key} type="button" className="text-right" onClick={() => setModalKey(m.key)}>
              <StatsCard
                title={m.title}
                value={m.money ? formatCurrency(overview[m.key]) : String(Math.round(Number(overview[m.key] || 0)))}
                icon={m.icon}
                loading={loading && !data}
              />
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>גרף הכנסות ורווח נקי לפי יום</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] w-full" dir="ltr">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${Math.round(v)}`} />
                  <RechartsTooltip formatter={(value) => [formatCurrency(value), 'סכום']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="הכנסות" />
                  <Bar dataKey="netProfit" fill="#c89b3c" name="רווח נקי" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                {loading ? 'טוען נתונים…' : 'אין נתונים לטווח שנבחר'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!modalKey} onOpenChange={(open) => !open && setModalKey('')}>
        <DialogContent className="max-w-5xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{METRICS.find((m) => m.key === modalKey)?.title || 'פירוט מדד'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {modalColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalRows.map((row, idx) => (
                  <TableRow key={`${modalKey}-${idx}`}>
                    {modalColumns.map((col) => {
                      const value = row[col];
                      const isAmount = /amount|cost|commission|profit|debt|revenue|price/i.test(col);
                      return <TableCell key={`${idx}-${col}`}>{isAmount ? formatCurrency(value) : String(value ?? '')}</TableCell>;
                    })}
                  </TableRow>
                ))}
                {!modalRows.length ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(1, modalColumns.length)} className="text-center text-muted-foreground">
                      אין רשומות להצגה
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
