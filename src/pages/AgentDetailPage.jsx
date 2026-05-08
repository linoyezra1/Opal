import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Lock, Wallet, Users, Clock, RefreshCw, Edit2 } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Input } from '../components/ui/input.jsx';
import { Badge } from '../components/ui/badge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

function currentMonthLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL');
}

export default function AgentDetailPage() {
  const { id } = useParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [agent, setAgent] = useState(null);
  const [month, setMonth] = useState(currentMonthLabel());
  const [preview, setPreview] = useState({ summary: { totalCommissions: 0, activeDeals: 0, pendingPayouts: 0 }, rows: [] });
  const [snapshots, setSnapshots] = useState([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [billingTypeFilter, setBillingTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapEditForm, setSnapEditForm] = useState({
    status: 'Pending',
    invoiceNum: '',
    invoiceAmount: 0,
    creditNoteNum: '',
    creditNoteAmount: 0,
    totalPaid: 0,
    notes: '',
  });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveWarn, setArchiveWarn] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    try {
      const [agentsRes, previewRes, snapsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents?includeInactive=true`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commissions-preview?month=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commission-snapshots`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      const found = (agentsRes?.rows || []).find((r) => String(r.id) === String(id));
      if (!found) throw new Error('סוכן לא נמצא');
      setAgent(found);
      if (!previewRes.success) throw new Error(previewRes.error || 'טעינת טיוטת עמלות נכשלה');
      setPreview({
        summary: {
          totalCommissions: Number(previewRes.summary?.totalCommissions || 0),
          activeDeals: Number(previewRes.summary?.activeDeals || 0),
          pendingPayouts: Number(previewRes.summary?.pendingPayouts || 0),
        },
        rows: Array.isArray(previewRes.rows) ? previewRes.rows : [],
        note: String(previewRes.note || ''),
      });
      setSnapshots(Array.isArray(snapsRes?.snapshots) ? snapsRes.snapshots : []);
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [id, month, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function lockCommissions() {
    if (!token || !id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/lock-commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'נעילת דוח עמלות נכשלה');
      await load();
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  async function archiveAgent() {
    if (!token || !id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (res.status === 409 && json.code === 'UNLOCKED_COMMISSIONS') {
          setArchiveWarn(json.error || '');
          setArchiveOpen(false);
          return;
        }
        throw new Error(json.error || 'ארכוב נכשל');
      }
      setArchiveOpen(false);
      await load();
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  const pendingSnapshots = useMemo(
    () => snapshots.filter((s) => String(s.status || 'Pending') !== 'Paid').length,
    [snapshots]
  );

  const filteredPreviewRows = useMemo(() => {
    return (preview.rows || []).filter((r) => {
      if (providerFilter && String(r.provider || '').trim() !== providerFilter) return false;
      if (productFilter && String(r.productName || '').trim() !== productFilter) return false;
      if (billingTypeFilter && String(r.billingType || '').trim() !== billingTypeFilter) return false;
      if (statusFilter !== 'all' && String(r.entitlementStatus || '').trim() !== statusFilter) return false;
      return true;
    });
  }, [preview.rows, providerFilter, productFilter, billingTypeFilter, statusFilter]);

  const providerOptions = useMemo(() => {
    return Array.from(new Set((preview.rows || []).map((r) => String(r.provider || '').trim()).filter(Boolean)));
  }, [preview.rows]);
  const productOptions = useMemo(() => {
    return Array.from(new Set((preview.rows || []).map((r) => String(r.productName || '').trim()).filter(Boolean)));
  }, [preview.rows]);

  async function saveSnapshotEdit() {
    if (!snapEditTarget?.id) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commission-snapshots/${encodeURIComponent(snapEditTarget.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(snapEditForm),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      await load();
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <AdminPageShell><p className="p-6 text-muted-foreground">נדרשת התחברות לממשק ניהול.</p></AdminPageShell>;
  }

  return (
    <AdminPageShell>
      <ConfirmDialog
        open={archiveOpen}
        title="העברה לארכיון"
        message='לא ניתן לייצר עמלה לסוכנים שאינם פעילים. לפני העברת סוכן לארכיון, יש לוודא כי כל הדוחות והתשלומים המגיעים לו עבור החודש הנוכחי ננעלו ושולמו. לאחר הארכוב, המערכת תפסיק לשייך עסקאות וחשבונות לסוכן זה.'
        confirmLabel="העבר לארכיון"
        danger
        onConfirm={archiveAgent}
        onCancel={() => setArchiveOpen(false)}
        isLoading={busy}
      />
      <ConfirmDialog
        open={!!archiveWarn}
        title="אזהרת ארכוב"
        message={archiveWarn}
        confirmLabel="Continue"
        onConfirm={async () => {
          setBusy(true);
          try {
            const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}?force=true`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.error || 'ארכוב נכשל');
            setArchiveWarn('');
            await load();
          } catch (e) {
            setErr(e.message || 'שגיאה');
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => setArchiveWarn('')}
        isLoading={busy}
      />
      <Dialog open={snapEditOpen} onOpenChange={(o) => { if (!o) setSnapEditOpen(false); }}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת פרטי תשלום לסוכן</DialogTitle>
            <DialogDescription>{snapEditTarget ? `${snapEditTarget.month} · ${snapEditTarget.agentName}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Invoice #" value={snapEditForm.invoiceNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceNum: e.target.value }))} />
            <Input type="number" placeholder="Invoice Amt" value={snapEditForm.invoiceAmount} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceAmount: Number(e.target.value || 0) }))} />
            <Input placeholder="Credit Note #" value={snapEditForm.creditNoteNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, creditNoteNum: e.target.value }))} />
            <Input type="number" placeholder="Credit Note Amt" value={snapEditForm.creditNoteAmount} onChange={(e) => setSnapEditForm((p) => ({ ...p, creditNoteAmount: Number(e.target.value || 0) }))} />
            <Input type="number" placeholder="Amount Paid" value={snapEditForm.totalPaid} onChange={(e) => setSnapEditForm((p) => ({ ...p, totalPaid: Number(e.target.value || 0) }))} />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={() => setSnapEditOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveSnapshotEdit} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto text-right" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ms-2" asChild>
              <Link to="/admin/agents" className="gap-1">
                <ArrowRight className="size-4 rotate-180" />
                חזרה לרשימת סוכנים
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{agent?.agentName || 'סוכן'}</h1>
            <p className="text-sm text-muted-foreground">{agent?.idNum || '—'}</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading || busy}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            רענון
          </Button>
        </div>

        {err ? <p className="text-sm text-destructive">{err}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatsCard title="סה״כ עמלות לטיוטה" value={formatCurrency(preview.summary.totalCommissions)} icon={Wallet} />
          <StatsCard title="עסקאות זכאיות" value={String(preview.summary.activeDeals || 0)} icon={Users} />
          <StatsCard title="דרישות תשלום פתוחות" value={String(pendingSnapshots)} icon={Clock} />
        </div>

        <Tabs defaultValue="deals">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>עסקאות זכאיות לחודש</CardTitle>
                <CardDescription>{month}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border p-3 md:p-4 mb-3">
                  <UnifiedFilterShell
                    filters={[
                      { key: 'provider', label: 'ספק', type: 'select', options: providerOptions.map((p) => ({ value: p, label: p })) },
                      { key: 'product', label: 'מוצר', type: 'select', options: productOptions.map((p) => ({ value: p, label: p })) },
                      { key: 'billingType', label: 'סוג חיוב', type: 'select', options: [{ value: 'Centralized', label: 'מרוכז' }, { value: 'Private', label: 'פרטי' }] },
                      { key: 'status', label: 'סטטוס', type: 'select', options: [{ value: 'all', label: 'הכל' }, { value: 'active', label: 'פעיל' }, { value: 'pending_cancellation', label: 'ממתין לביטול' }, { value: 'canceled', label: 'מבוטל' }] },
                    ]}
                    values={{ provider: providerFilter, product: productFilter, billingType: billingTypeFilter, status: statusFilter }}
                    onChange={(next) => {
                      setProviderFilter(String(next.provider || ''));
                      setProductFilter(String(next.product || ''));
                      setBillingTypeFilter(String(next.billingType || ''));
                      setStatusFilter(String(next.status || 'all'));
                    }}
                    onClear={() => {
                      setProviderFilter('');
                      setProductFilter('');
                      setBillingTypeFilter('');
                      setStatusFilter('all');
                    }}
                    resultsCount={filteredPreviewRows.length}
                    totalCount={(preview.rows || []).length}
                    isLoading={loading}
                  />
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">עסקה</TableHead>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">תחילת מנוי</TableHead>
                        <TableHead className="text-right">סיום מנוי</TableHead>
                        <TableHead className="text-right">עמלה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPreviewRows.map((r) => (
                        <TableRow key={r.dealId}>
                          <TableCell>{r.transactionId || r.dealId}</TableCell>
                          <TableCell>{r.employeeName || '—'}</TableCell>
                          <TableCell>{formatDate(r.subscriptionStartDate)}</TableCell>
                          <TableCell>{formatDate(r.subscriptionEndDate)}</TableCell>
                          <TableCell>{formatCurrency(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {!filteredPreviewRows.length ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">אין רשומות זכאיות</TableCell></TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>דוח חודשי — טיוטה לנעילה</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">חודש דוח</p>
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthLabel())} />
                </div>
                <Button type="button" onClick={lockCommissions} disabled={busy || loading}>
                  {busy ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}
                  סגור דוח והפק דרישת תשלום לסוכן
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commissions History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">חודש</TableHead>
                        <TableHead className="text-right">Invoice #</TableHead>
                        <TableHead className="text-right">Invoice Amt</TableHead>
                        <TableHead className="text-right">Credit Note #</TableHead>
                        <TableHead className="text-right">Credit Note Amt</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                        <TableHead className="text-right">יתרה לתשלום</TableHead>
                        <TableHead className="text-right">עסקאות</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.month}</TableCell>
                          <TableCell>{s.invoiceNum || '—'}</TableCell>
                          <TableCell>{formatCurrency(s.invoiceAmount)}</TableCell>
                          <TableCell>{s.creditNoteNum || '—'}</TableCell>
                          <TableCell>{formatCurrency(s.creditNoteAmount)}</TableCell>
                          <TableCell>{formatCurrency(s.totalAmount)}</TableCell>
                          <TableCell>{formatCurrency(s.totalPaid)}</TableCell>
                          <TableCell>{formatCurrency(Number(s.totalAmount || 0) - Number(s.totalPaid || 0))}</TableCell>
                          <TableCell>{Number(s.totalDeals || 0)}</TableCell>
                          <TableCell><Badge variant={s.status === 'Paid' ? 'default' : 'secondary'}>{s.status === 'Paid' ? 'שולם' : 'ממתין'}</Badge></TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSnapEditTarget(s);
                                setSnapEditForm({
                                  status: String(s.status || 'Pending'),
                                  invoiceNum: String(s.invoiceNum || ''),
                                  invoiceAmount: Number(s.invoiceAmount || 0),
                                  creditNoteNum: String(s.creditNoteNum || ''),
                                  creditNoteAmount: Number(s.creditNoteAmount || 0),
                                  totalPaid: Number(s.totalPaid || 0),
                                  notes: String(s.notes || ''),
                                });
                                setSnapEditOpen(true);
                              }}
                            >
                              <Edit2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!snapshots.length ? (
                        <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">אין דוחות נעולים</TableCell></TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>הגדרות סוכן</CardTitle>
                <CardDescription>
                  לפני ארכוב סוכן יש לוודא שכל דוחות העמלה הרלוונטיים ננעלו ושולמו.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  ⚠️ לא ניתן לייצר עמלה לסוכנים שאינם פעילים. לפני העברת סוכן לארכיון, יש לוודא כי כל הדוחות והתשלומים המגיעים לו עבור החודש הנוכחי ננעלו ושולמו. לאחר הארכוב, המערכת תפסיק לשייך עסקאות וחשבונות לסוכן זה.
                </div>
                <Button type="button" variant="destructive" onClick={() => setArchiveOpen(true)} disabled={busy}>
                  העבר סוכן לארכיון
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
  );
}

