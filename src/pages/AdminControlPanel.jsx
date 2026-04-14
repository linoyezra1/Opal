import React from 'react';
import { LayoutDashboard, RefreshCw, Wallet, Users, CreditCard, UserCheck, AlertCircle, Building2, Check, Pencil } from 'lucide-react';
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
  { title: 'משימות לטיפול', keys: ['failedPayments', 'abandonedCarts', 'pendingBeneficiaries'] },
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
};

export default function AdminControlPanel() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [filters, setFilters] = React.useState(() => monthDefaults());
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [modalKey, setModalKey] = React.useState('');
  const [editDialog, setEditDialog] = React.useState({ kind: '', id: '', payload: {} });
  const [saving, setSaving] = React.useState(false);

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

  async function markHandled(type, id) {
    if (!id) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/control-panel/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, id, handled: true }),
      });
      await load(filters);
      setModalKey((k) => k);
    } finally {
      setSaving(false);
    }
  }

  async function saveQuickEdit() {
    if (!editDialog.id || !editDialog.kind) return;
    setSaving(true);
    try {
      if (editDialog.kind === 'deal') {
        await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(editDialog.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ formState: editDialog.payload }),
        });
      } else if (editDialog.kind === 'agent') {
        await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(editDialog.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editDialog.payload),
        });
      } else if (editDialog.kind === 'organization') {
        await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(editDialog.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editDialog.payload),
        });
      }
      setEditDialog({ kind: '', id: '', payload: {} });
      await load(filters);
    } finally {
      setSaving(false);
    }
  }

  function openQuickEdit(key, row) {
    if (key === 'organizationCollectionsDebt') {
      setEditDialog({
        kind: 'organization',
        id: row.organizationId || '',
        payload: { collectionStatus: row.collectionStatus || 'open', notes: '' },
      });
      return;
    }
    if (key === 'totalAgentPayments' && row.agentId) {
      setEditDialog({ kind: 'agent', id: row.agentId, payload: { phone: '', email: '' } });
      return;
    }
    if ((key === 'activeSubscribers' || key === 'totalTransactions') && row.id) {
      setEditDialog({ kind: 'deal', id: row.id, payload: { phone: '', email: '' } });
    }
  }

  if (!token) return <div dir="rtl" className="p-6">יש להתחבר דרך מסך המנהל.</div>;

  return (
    <AdminPageShell>
      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="size-7 text-primary" />לוח בקרה — סקירה פיננסית</h1>
          <Button type="button" onClick={() => load(filters)} disabled={loading}><RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />רענון</Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Input type="month" value={filters.month} onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))} />
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
                  <button key={key} type="button" className="text-right" onClick={() => setModalKey(key)}>
                    <StatsCard title={meta.title} value={meta.money ? formatCurrency(overview[key]) : String(Math.round(Number(overview[key] || 0)))} icon={meta.icon} className={meta.className} loading={loading && !data} />
                  </button>
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
            ) : <div className="flex h-full items-center justify-center text-muted-foreground">אין נתונים</div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!modalKey} onOpenChange={(open) => !open && setModalKey('')}>
        <DialogContent className="max-w-6xl" dir="rtl">
          <DialogHeader><DialogTitle>{CARD_META[modalKey]?.title || 'פירוט'}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}<TableHead>פעולה</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${modalKey}-${idx}`}>
                    {columns.map((c) => {
                      const v = row[c];
                      const isAmount = /amount|cost|commission|profit|debt|revenue|price/i.test(c);
                      return <TableCell key={`${idx}-${c}`}>{isAmount ? formatCurrency(v) : String(v ?? '')}</TableCell>;
                    })}
                    <TableCell>
                      {isTask ? (
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => markHandled(modalKey === 'failedPayments' ? 'failedPayment' : modalKey === 'pendingBeneficiaries' ? 'pendingBeneficiary' : 'abandonedCart', row.id)}>
                          <Check className="size-4 me-1" />טופל
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openQuickEdit(modalKey, row)}>
                          <Pencil className="size-4 me-1" />View/Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDialog.kind} onOpenChange={(open) => !open && setEditDialog({ kind: '', id: '', payload: {} })}>
        <DialogContent className="sm:max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle>עדכון מהיר</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editDialog.kind === 'deal' ? (
              <>
                <Input placeholder="טלפון" value={editDialog.payload.phone || ''} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, phone: e.target.value } }))} />
                <Input placeholder="אימייל" value={editDialog.payload.email || ''} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, email: e.target.value } }))} />
              </>
            ) : null}
            {editDialog.kind === 'agent' ? (
              <>
                <Input placeholder="טלפון סוכן" value={editDialog.payload.phone || ''} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, phone: e.target.value } }))} />
                <Input placeholder="אימייל סוכן" value={editDialog.payload.email || ''} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, email: e.target.value } }))} />
              </>
            ) : null}
            {editDialog.kind === 'organization' ? (
              <>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={editDialog.payload.collectionStatus || 'open'} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, collectionStatus: e.target.value } }))}>
                  <option value="open">פתוח</option>
                  <option value="in_progress">בטיפול</option>
                  <option value="paid">שולם</option>
                </select>
                <Input placeholder="הערת גבייה" value={editDialog.payload.notes || ''} onChange={(e) => setEditDialog((p) => ({ ...p, payload: { ...p.payload, notes: e.target.value } }))} />
              </>
            ) : null}
          </div>
          <div className="pt-2"><Button onClick={saveQuickEdit} disabled={saving}>{saving ? 'שומר...' : 'שמירה'}</Button></div>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
