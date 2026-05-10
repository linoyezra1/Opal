import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Copy, Edit2, ExternalLink, Globe, Lock, Pencil, Percent, RefreshCw, Users, Wallet } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

function currentMonthLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(Number(v || 0));
}
function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
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
  const [products, setProducts] = useState([]);
  const [landingPages, setLandingPages] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [deals, setDeals] = useState([]);
  const [preview, setPreview] = useState({
    previewSource: '',
    note: '',
    summary: { totalCommissions: 0, activeDeals: 0, pendingPayouts: 0 },
    rows: [],
  });
  const [selectedLedgerEntryIds, setSelectedLedgerEntryIds] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveWarn, setArchiveWarn] = useState('');
  const [copiedLink, setCopiedLink] = useState('');
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapEditForm, setSnapEditForm] = useState({ status: 'Pending', invoiceNum: '', invoiceAmount: 0, creditNoteNum: '', creditNoteAmount: 0, totalPaid: 0, notes: '' });

  const productSlugMap = useMemo(() => {
    const map = new Map();
    const plIndex = new Map((priceLists || []).map((pl) => [pl.id, pl]));
    for (const page of landingPages || []) {
      if (!page?.slug || !page?.priceListId) continue;
      const pl = plIndex.get(page.priceListId);
      if (!pl) continue;
      for (const ln of pl.lines || []) {
        if (!ln?.productId) continue;
        const key = String(ln.productId);
        const curr = map.get(key) || [];
        if (!curr.some((x) => x.slug === page.slug)) curr.push({ slug: page.slug, pageTitle: page.pageTitle || page.slug });
        map.set(key, curr);
      }
    }
    return map;
  }, [landingPages, priceLists]);

  const commissionSummary = useMemo(() => {
    const rows = Array.isArray(agent?.productCommissions) ? agent.productCommissions : [];
    return { products: rows.length, total: rows.reduce((s, r) => s + Number(r.commission || 0), 0) };
  }, [agent]);
  const shownEligibleDealsCount = useMemo(() => (Array.isArray(preview?.rows) ? preview.rows.length : 0), [preview?.rows]);
  const successfulDeals = useMemo(
    () =>
      (deals || []).filter((d) => {
        const aid = String(d?.agentId || d?.formState?.agentId || '').trim();
        return aid === String(id) && /success|paid|test_success/i.test(String(d?.paymentStatus || ''));
      }),
    [deals, id]
  );
  const productPurchaseCounts = useMemo(() => {
    const map = new Map();
    for (const d of successfulDeals) {
      const pid = String(d?.formState?.productId || '').trim();
      if (!pid) continue;
      map.set(pid, (map.get(pid) || 0) + 1);
    }
    return map;
  }, [successfulDeals]);
  const productSlugPurchaseCounts = useMemo(() => {
    const map = new Map();
    for (const d of successfulDeals) {
      const pid = String(d?.formState?.productId || '').trim();
      const slug = String(d?.landingSlug || d?.formState?.landingPageSlug || '').trim().toLowerCase();
      if (!pid || !slug) continue;
      const key = `${pid}::${slug}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [successfulDeals]);

  const ledgerPreviewRows = useMemo(
    () => (preview.rows || []).filter((r) => r.ledgerEntryId),
    [preview.rows]
  );
  const lockNeedsSelection = preview.previewSource === 'cash_billing';
  const lockDisabled =
    busy || loading || (lockNeedsSelection && selectedLedgerEntryIds.length === 0);

  function toggleLedgerEntry(entryId, checked) {
    const sid = String(entryId);
    setSelectedLedgerEntryIds((prev) => {
      const next = new Set(prev.map(String));
      if (checked) next.add(sid);
      else next.delete(sid);
      return [...next];
    });
  }
  function toggleAllLedger(checked) {
    const ids = (preview.rows || []).filter((r) => r.ledgerEntryId).map((r) => String(r.ledgerEntryId));
    setSelectedLedgerEntryIds(checked ? ids : []);
  }

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    try {
      const [agentsRes, previewRes, snapsRes, prRes, lpRes, plRes, dealsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents?includeInactive=true`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commissions-preview?month=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commission-snapshots`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/deals`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      const found = (agentsRes?.rows || []).find((r) => String(r.id) === String(id));
      if (!found) throw new Error('סוכן לא נמצא');
      setAgent(found);
      const previewRows = Array.isArray(previewRes?.rows) ? previewRes.rows : [];
      setPreview({
        previewSource: previewRes?.previewSource || '',
        note: previewRes?.note || '',
        summary: {
          totalCommissions: Number(previewRes?.summary?.totalCommissions || 0),
          activeDeals: Number(previewRes?.summary?.activeDeals || 0),
          pendingPayouts: Number(previewRes?.summary?.pendingPayouts || 0),
        },
        rows: previewRows,
      });
      const cashIds = previewRows.filter((r) => r.ledgerEntryId).map((r) => String(r.ledgerEntryId));
      setSelectedLedgerEntryIds(previewRes?.previewSource === 'cash_billing' ? cashIds : []);
      setSnapshots(Array.isArray(snapsRes?.snapshots) ? snapsRes.snapshots : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setLandingPages(Array.isArray(lpRes?.pages) ? lpRes.pages : []);
      setPriceLists(Array.isArray(plRes?.lists) ? plRes.lists : []);
      setDeals(Array.isArray(dealsRes?.deals) ? dealsRes.deals : []);
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [id, month, token]);
  useEffect(() => { load(); }, [load]);

  async function lockCommissions() {
    setBusy(true);
    try {
      const body =
        preview.previewSource === 'cash_billing'
          ? { month, entryIds: selectedLedgerEntryIds }
          : { month };
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/lock-commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'נעילה נכשלה');
      await load();
    } catch (e) { setErr(e.message || 'שגיאה'); } finally { setBusy(false); }
  }
  async function archiveAgent(force = false) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) {
        if (res.status === 409 && j.code === 'UNLOCKED_COMMISSIONS') return setArchiveWarn(j.error || '');
        throw new Error(j.error || 'ארכוב נכשל');
      }
      setArchiveWarn('');
      setArchiveOpen(false);
      await load();
    } catch (e) { setErr(e.message || 'שגיאה'); } finally { setBusy(false); }
  }
  async function saveSnapshotEdit() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commission-snapshots/${encodeURIComponent(snapEditTarget.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(snapEditForm) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      await load();
    } catch (e) { setErr(e.message || 'שגיאה'); } finally { setBusy(false); }
  }

  if (!token) return <AdminPageShell><p className="p-6 text-muted-foreground">נדרשת התחברות לממשק ניהול.</p></AdminPageShell>;

  return (
    <TooltipProvider delayDuration={250}>
    <AdminPageShell>
      <ConfirmDialog open={archiveOpen} title="העברה לארכיון" message='⚠️ לא ניתן לייצר עמלה לסוכנים שאינם פעילים. לפני העברת סוכן לארכיון, יש לוודא כי כל הדוחות והתשלומים המגיעים לו עבור החודש הנוכחי ננעלו ושולמו. לאחר הארכוב, המערכת תפסיק לשייך עסקאות וחשבונות לסוכן זה.' confirmLabel="העבר לארכיון" danger onConfirm={() => archiveAgent(false)} onCancel={() => setArchiveOpen(false)} isLoading={busy} />
      <ConfirmDialog open={!!archiveWarn} title="אזהרת ארכוב" message={archiveWarn} confirmLabel="המשך בכל זאת" onConfirm={() => archiveAgent(true)} onCancel={() => setArchiveWarn('')} isLoading={busy} />
      <Dialog open={snapEditOpen} onOpenChange={(o) => !o && setSnapEditOpen(false)}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader><DialogTitle>עריכת פרטי תשלום</DialogTitle><DialogDescription>{snapEditTarget ? `${snapEditTarget.month} · ${snapEditTarget.agentName}` : ''}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="מספר חשבונית" value={snapEditForm.invoiceNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceNum: e.target.value }))} />
            <Input type="number" placeholder="סכום חשבונית" value={snapEditForm.invoiceAmount} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceAmount: Number(e.target.value || 0) }))} />
            <Input placeholder="מספר זיכוי" value={snapEditForm.creditNoteNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, creditNoteNum: e.target.value }))} />
            <Input type="number" placeholder="סכום זיכוי" value={snapEditForm.creditNoteAmount} onChange={(e) => setSnapEditForm((p) => ({ ...p, creditNoteAmount: Number(e.target.value || 0) }))} />
            <Input type="number" placeholder="סכום ששולם" value={snapEditForm.totalPaid} onChange={(e) => setSnapEditForm((p) => ({ ...p, totalPaid: Number(e.target.value || 0) }))} />
          </div>
          <DialogFooter className="flex-row-reverse gap-2"><Button variant="outline" onClick={() => setSnapEditOpen(false)}>ביטול</Button><Button onClick={saveSnapshotEdit} disabled={busy}>שמור</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto text-right" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ms-2" asChild><Link to="/admin/agents"><ArrowRight className="size-4 rotate-180 ms-1" />חזרה לרשימת סוכנים</Link></Button>
            <h1 className="text-2xl font-bold">{agent?.agentName || 'סוכן'}</h1>
          </div>
          <Button variant="outline" onClick={load} disabled={loading || busy}><RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />רענון</Button>
        </div>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard title="סהכ מנויים פעילים+ממתינים לביטול" value={String(shownEligibleDealsCount)} icon={Users} />
          <StatsCard title="סה״כ עמלות שנרשמו בטיוטה" value={formatCurrency(preview.summary.totalCommissions)} icon={Wallet} />
          <StatsCard title="מוצרים עם עמלה" value={String(commissionSummary.products)} icon={Percent} />

        </div>

        <Tabs defaultValue="deals">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="deals">עסקאות סוכן</TabsTrigger>
            <TabsTrigger value="commissions">תשלומים לסוכן</TabsTrigger>
            <TabsTrigger value="distribution">קישורי הפצה ודפי נחיתה</TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>טיוטת עסקאות זכאיות</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>{month}</span>
                  {preview.previewSource === 'cash_billing' ? (
                    <Badge variant="secondary">חיוב בפועל</Badge>
                  ) : (
                    <Badge variant="outline">מנוי (גיבוי)</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preview.note ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
                    {preview.note}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value || currentMonthLabel())}
                    className="max-w-xs"
                  />
                  <Button onClick={lockCommissions} disabled={lockDisabled}>
                    {busy ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}
                    סגור דוח והפק דרישת תשלום לסוכן
                  </Button>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table className="text-right">
                    <TableHeader>
                      <TableRow className="[&_th]:text-right">
                        {lockNeedsSelection ? (
                          <TableHead className="w-10 text-center">
                            <input
                              type="checkbox"
                              className="size-4 rounded"
                              checked={
                                ledgerPreviewRows.length > 0 &&
                                selectedLedgerEntryIds.length === ledgerPreviewRows.length
                              }
                              onChange={(e) => toggleAllLedger(e.target.checked)}
                              title="בחר הכל"
                            />
                          </TableHead>
                        ) : null}
                        <TableHead>לקוח</TableHead>
                        <TableHead>מספר הזמנה</TableHead>
                        {lockNeedsSelection ? <TableHead className="whitespace-nowrap">תאריך חיוב</TableHead> : null}
                        {lockNeedsSelection ? <TableHead>חויב בפועל</TableHead> : null}
                        <TableHead>תחילת מנוי</TableHead>
                        <TableHead>תאריך ביטול</TableHead>
                        <TableHead>תאריך סיום מנוי</TableHead>
                        <TableHead>עמלה שנרשמה</TableHead>
                        <TableHead>פעולה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(preview.rows || []).map((r) => (
                        <TableRow key={`${r.dealId}-${r.ledgerEntryId || 'sub'}`}>
                          {lockNeedsSelection ? (
                            <TableCell className="text-center">
                              {r.ledgerEntryId ? (
                                <input
                                  type="checkbox"
                                  className="size-4 rounded"
                                  checked={selectedLedgerEntryIds.includes(String(r.ledgerEntryId))}
                                  onChange={(e) => toggleLedgerEntry(r.ledgerEntryId, e.target.checked)}
                                />
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell>{r.employeeName || '—'}</TableCell>
                          <TableCell>{r.transactionId || '—'}</TableCell>
                          {lockNeedsSelection ? (
                            <TableCell dir="ltr" className="font-mono text-xs">
                              {r.lastBillDate ? formatDate(r.lastBillDate) : '—'}
                            </TableCell>
                          ) : null}
                          {lockNeedsSelection ? (
                            <TableCell>{formatCurrency(r.actualBillingAmount)}</TableCell>
                          ) : null}
                          <TableCell>{formatDate(r.subscriptionStartDate)}</TableCell>
                          <TableCell>{formatDate(r.cancellationDate)}</TableCell>
                          <TableCell>{formatDate(r.subscriptionEndDate || r.subscriptionEndDateRaw)}</TableCell>
                          <TableCell>{formatCurrency(r.amount)}</TableCell>
                          <TableCell>
                            <Button type="button" variant="outline" size="sm" asChild>
                              <Link to={`/admin/subscribers?search=${encodeURIComponent(r.transactionId || '')}`}>
                                <Pencil className="size-4 ms-1" />
                                עריכת לקוח
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!(preview.rows || []).length ? (
                        <TableRow>
                          <TableCell
                            colSpan={lockNeedsSelection ? 10 : 7}
                            className="text-center text-muted-foreground"
                          >
                            אין רשומות זכאיות
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <Card><CardHeader><CardTitle>היסטוריית עמלות</CardTitle></CardHeader><CardContent><div className="rounded-md border overflow-x-auto"><Table className="text-right"><TableHeader><TableRow className="[&_th]:text-right"><TableHead>חודש</TableHead><TableHead>מספר חשבונית</TableHead><TableHead>סכום חשבונית</TableHead><TableHead>מספר זיכוי</TableHead><TableHead>סכום זיכוי</TableHead><TableHead>סה״כ לתשלום</TableHead><TableHead>שולם</TableHead><TableHead>יתרה לתשלום</TableHead><TableHead>עסקאות</TableHead><TableHead>סטטוס</TableHead><TableHead>פעולות</TableHead></TableRow></TableHeader><TableBody>{snapshots.map((s) => <TableRow key={s.id}><TableCell>{s.month}</TableCell><TableCell>{s.invoiceNum || '—'}</TableCell><TableCell>{formatCurrency(s.invoiceAmount)}</TableCell><TableCell>{s.creditNoteNum || '—'}</TableCell><TableCell>{formatCurrency(s.creditNoteAmount)}</TableCell><TableCell>{formatCurrency(s.totalAmount)}</TableCell><TableCell>{formatCurrency(s.totalPaid)}</TableCell><TableCell>{formatCurrency(s.balance)}</TableCell><TableCell>{Number(s.totalDeals || 0)}</TableCell><TableCell><Badge variant={s.status === 'Paid' ? 'default' : 'secondary'}>{s.status === 'Paid' ? 'שולם' : 'ממתין'}</Badge></TableCell><TableCell><Button size="icon" variant="ghost" onClick={() => { setSnapEditTarget(s); setSnapEditForm({ status: String(s.status || 'Pending'), invoiceNum: String(s.invoiceNum || ''), invoiceAmount: Number(s.invoiceAmount || 0), creditNoteNum: String(s.creditNoteNum || ''), creditNoteAmount: Number(s.creditNoteAmount || 0), totalPaid: Number(s.totalPaid || 0), notes: String(s.notes || '') }); setSnapEditOpen(true); }}><Edit2 className="size-4" /></Button></TableCell></TableRow>)}{!snapshots.length ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">אין דוחות נעולים</TableCell></TableRow> : null}</TableBody></Table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="distribution" className="mt-4">
            <Card><CardHeader><CardTitle>קישורי הפצה ודפי נחיתה</CardTitle><CardDescription>עיצוב וערכים זהים לצפייה ממסך המוצרים, מותאם לסוכן</CardDescription></CardHeader><CardContent className="space-y-4">{(agent?.productCommissions || []).flatMap((c) => { const product = products.find((p) => String(p.id) === String(c.productId)); const entries = productSlugMap.get(String(c.productId)) || []; const productId = String(c.productId || ''); const productName = product?.productName || product?.name || c.productName || productId; const totalPurchases = productPurchaseCounts.get(productId) ?? 0; return [{ productId, productName, providerName: product?.provider?.vendorName || '', providerCost: Number(product?.providerCost || 0), entries, totalPurchases }]; }).map((row) => (<div key={row.productId} className="rounded-xl border p-4 space-y-3"><div className="flex items-start justify-between gap-3"><div className="space-y-1"><p className="text-lg font-bold text-foreground">{row.productName}</p><p className="text-xs text-muted-foreground">{row.providerName ? `ספק: ${row.providerName}` : 'ספק: —'}</p></div><Badge className="shrink-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">פעיל</Badge></div><div className="grid grid-cols-3 gap-3 rounded-xl border bg-gradient-to-l from-[#D9EAF3]/40 to-[#D9EAF3]/10 p-4"><div className="text-center space-y-0.5"><p className="text-2xl font-bold text-primary">{row.entries.length}</p><p className="text-xs text-muted-foreground">דפי נחיתה פעילים</p></div><div className="text-center space-y-0.5"><p className="text-2xl font-bold text-primary">{row.totalPurchases}</p><p className="text-xs text-muted-foreground">כמות רכישות</p></div><div className="text-center space-y-0.5"><p className="text-2xl font-bold text-[#C9A227]">{row.providerCost > 0 ? `₪${row.providerCost}` : '—'}</p><p className="text-xs text-muted-foreground">עלות ספק</p></div></div>{row.entries.length === 0 ? (<div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center"><Globe className="size-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-muted-foreground">המוצר אינו משויך לדפי נחיתה</p><p className="text-xs text-muted-foreground mt-1">ניתן לשייך דרך הקמת דף מוצר</p></div>) : (<div className="rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 border-b"><tr><th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">שם דף</th><th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 w-28">כמות רכישות</th><th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">קישור</th></tr></thead><tbody className="divide-y">{row.entries.map(({ slug, pageTitle }) => { const link = `${window.location.origin}/p/${slug}?agentId=${encodeURIComponent(id)}`; const justCopied = copiedLink === link; const slugCount = productSlugPurchaseCounts.get(`${row.productId}::${String(slug || '').toLowerCase()}`) ?? 0; return (<tr key={`${row.productId}-${slug}`} className="hover:bg-slate-50 transition-colors"><td className="px-3 py-3 font-medium text-foreground">{pageTitle || slug}</td><td className="px-3 py-3 text-center font-semibold text-primary">{slugCount}</td><td className="px-3 py-3"><div className="flex items-center gap-1.5"><span className="flex-1 truncate text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1 max-w-[200px]" title={link}>/p/{slug}?agentId={id}</span><Tooltip><TooltipTrigger asChild><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiedLink(link); setTimeout(() => setCopiedLink(''), 2000); } catch {} }} className={`inline-flex items-center gap-1 h-7 px-2 rounded border text-xs transition-all shrink-0 ${justCopied ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>{justCopied ? <Check className="size-3" /> : <Copy className="size-3" />}{justCopied ? 'הועתק' : 'העתק'}</button></TooltipTrigger><TooltipContent>{pageTitle || slug}</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-200 bg-white text-slate-500 hover:border-primary hover:text-primary transition-colors shrink-0"><ExternalLink className="size-3" /></a></TooltipTrigger><TooltipContent>פתח קישור</TooltipContent></Tooltip></div></td></tr>); })}</tbody></table></div>)}</div>))}{!(agent?.productCommissions || []).length ? <div className="rounded-md border p-6 text-center text-muted-foreground">אין מוצרים מוגדרים לסוכן</div> : null}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
    </TooltipProvider>
  );
}

