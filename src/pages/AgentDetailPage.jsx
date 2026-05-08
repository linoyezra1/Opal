import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Copy, Edit2, ExternalLink, Lock, Pencil, Percent, RefreshCw, Save, Users, Wallet } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import { ISRAELI_ID_INVALID_MSG, validateIsraeliId } from '../utils/israeliId.js';
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
function normalizeAgentForEdit(r) {
  const b = r?.bankDetails || {};
  const pc = Array.isArray(r?.productCommissions) ? r.productCommissions : [];
  return {
    agentName: r?.agentName || '',
    idNum: r?.idNum || '',
    phone: r?.phone || '',
    email: r?.email || '',
    address: r?.address || '',
    bankDetails: { bankName: b.bankName || '', bankNum: b.bankNum || '', accountHolder: b.accountHolder || '', branchNum: b.branchNum || '', accountNum: b.accountNum || '' },
    productCommissions: pc.map((x) => ({ productId: String(x.productId || ''), commission: String(x.commission ?? ''), productName: x.productName || '' })),
  };
}
function buildPayload(form) {
  const rows = Array.isArray(form.productCommissions) ? form.productCommissions.filter((x) => x.productId).map((x) => ({ productId: x.productId, commission: Number(x.commission || 0) })) : [];
  return { ...form, productCommissions: rows };
}
function idHint(value) {
  const compact = String(value || '').trim().replace(/\s/g, '');
  if (compact.length < 7 || !/^\d{7,9}$/.test(compact)) return '';
  if (!validateIsraeliId(compact)) return ISRAELI_ID_INVALID_MSG;
  return '';
}

export default function AgentDetailPage() {
  const { id } = useParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [agent, setAgent] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [month, setMonth] = useState(currentMonthLabel());
  const [products, setProducts] = useState([]);
  const [landingPages, setLandingPages] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [preview, setPreview] = useState({ summary: { totalCommissions: 0, activeDeals: 0, pendingPayouts: 0 }, rows: [] });
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

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    try {
      const [agentsRes, previewRes, snapsRes, prRes, lpRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents?includeInactive=true`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commissions-preview?month=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/commission-snapshots`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      const found = (agentsRes?.rows || []).find((r) => String(r.id) === String(id));
      if (!found) throw new Error('סוכן לא נמצא');
      setAgent(found);
      setEditForm(normalizeAgentForEdit(found));
      setPreview({ summary: { totalCommissions: Number(previewRes?.summary?.totalCommissions || 0), activeDeals: Number(previewRes?.summary?.activeDeals || 0), pendingPayouts: Number(previewRes?.summary?.pendingPayouts || 0) }, rows: Array.isArray(previewRes?.rows) ? previewRes.rows : [] });
      setSnapshots(Array.isArray(snapsRes?.snapshots) ? snapsRes.snapshots : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setLandingPages(Array.isArray(lpRes?.pages) ? lpRes.pages : []);
      setPriceLists(Array.isArray(plRes?.lists) ? plRes.lists : []);
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
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}/lock-commissions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ month }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'נעילה נכשלה');
      await load();
    } catch (e) { setErr(e.message || 'שגיאה'); } finally { setBusy(false); }
  }
  async function saveAgentDetails() {
    if (!editForm) return;
    const hint = idHint(editForm.idNum);
    if (hint) return setErr(hint);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(buildPayload(editForm)) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
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
          <StatsCard title="סיכום עמלות מוצרים" value={formatCurrency(commissionSummary.total)} icon={Wallet} />
        </div>

        <Tabs defaultValue="deals">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="deals">עסקאות סוכן</TabsTrigger>
            <TabsTrigger value="commissions">תשלומים לסוכן</TabsTrigger>
            <TabsTrigger value="distribution">קישורי הפצה ודפי נחיתה</TabsTrigger>
            <TabsTrigger value="settings">פרטי סוכן</TabsTrigger>
            <TabsTrigger value="product-commissions">עמלות מוצרים</TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="mt-4">
            <Card><CardHeader><CardTitle>טיוטת עסקאות זכאיות</CardTitle><CardDescription>{month}</CardDescription></CardHeader><CardContent>
              <div className="flex flex-wrap items-end gap-3 mb-3"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthLabel())} className="max-w-xs" /><Button onClick={lockCommissions} disabled={busy || loading}>{busy ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}סגור דוח והפק דרישת תשלום לסוכן</Button></div>
              <div className="rounded-md border overflow-x-auto"><Table className="text-right"><TableHeader><TableRow className="[&_th]:text-right"><TableHead>לקוח</TableHead><TableHead>מספר הזמנה</TableHead><TableHead>תחילת מנוי</TableHead><TableHead>תאריך ביטול</TableHead><TableHead>תאריך סיום מנוי</TableHead><TableHead>עמלה שנרשמה</TableHead><TableHead>פעולה</TableHead></TableRow></TableHeader><TableBody>{(preview.rows || []).map((r) => <TableRow key={r.dealId}><TableCell>{r.employeeName || '—'}</TableCell><TableCell>{r.transactionId || '—'}</TableCell><TableCell>{formatDate(r.subscriptionStartDate)}</TableCell><TableCell>{formatDate(r.cancellationDate)}</TableCell><TableCell>{formatDate(r.subscriptionEndDate || r.subscriptionEndDateRaw)}</TableCell><TableCell>{formatCurrency(r.amount)}</TableCell><TableCell><Button type="button" variant="outline" size="sm" asChild><Link to={`/admin/subscribers?search=${encodeURIComponent(r.transactionId || '')}`}><Pencil className="size-4 ms-1" />עריכת לקוח</Link></Button></TableCell></TableRow>)}{!(preview.rows || []).length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">אין רשומות זכאיות</TableCell></TableRow> : null}</TableBody></Table></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <Card><CardHeader><CardTitle>היסטוריית עמלות</CardTitle></CardHeader><CardContent><div className="rounded-md border overflow-x-auto"><Table className="text-right"><TableHeader><TableRow className="[&_th]:text-right"><TableHead>חודש</TableHead><TableHead>מספר חשבונית</TableHead><TableHead>סכום חשבונית</TableHead><TableHead>מספר זיכוי</TableHead><TableHead>סכום זיכוי</TableHead><TableHead>סה״כ לתשלום</TableHead><TableHead>שולם</TableHead><TableHead>יתרה לתשלום</TableHead><TableHead>עסקאות</TableHead><TableHead>סטטוס</TableHead><TableHead>פעולות</TableHead></TableRow></TableHeader><TableBody>{snapshots.map((s) => <TableRow key={s.id}><TableCell>{s.month}</TableCell><TableCell>{s.invoiceNum || '—'}</TableCell><TableCell>{formatCurrency(s.invoiceAmount)}</TableCell><TableCell>{s.creditNoteNum || '—'}</TableCell><TableCell>{formatCurrency(s.creditNoteAmount)}</TableCell><TableCell>{formatCurrency(s.totalAmount)}</TableCell><TableCell>{formatCurrency(s.totalPaid)}</TableCell><TableCell>{formatCurrency(s.balance)}</TableCell><TableCell>{Number(s.totalDeals || 0)}</TableCell><TableCell><Badge variant={s.status === 'Paid' ? 'default' : 'secondary'}>{s.status === 'Paid' ? 'שולם' : 'ממתין'}</Badge></TableCell><TableCell><Button size="icon" variant="ghost" onClick={() => { setSnapEditTarget(s); setSnapEditForm({ status: String(s.status || 'Pending'), invoiceNum: String(s.invoiceNum || ''), invoiceAmount: Number(s.invoiceAmount || 0), creditNoteNum: String(s.creditNoteNum || ''), creditNoteAmount: Number(s.creditNoteAmount || 0), totalPaid: Number(s.totalPaid || 0), notes: String(s.notes || '') }); setSnapEditOpen(true); }}><Edit2 className="size-4" /></Button></TableCell></TableRow>)}{!snapshots.length ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">אין דוחות נעולים</TableCell></TableRow> : null}</TableBody></Table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="distribution" className="mt-4">
            <Card><CardHeader><CardTitle>קישורי הפצה ודפי נחיתה</CardTitle><CardDescription>מבנה וערכים זהים לתצוגת רשימת המוצרים, מותאם לסוכן</CardDescription></CardHeader><CardContent><div className="rounded-md border overflow-x-auto"><Table className="text-right"><TableHeader><TableRow className="[&_th]:text-right"><TableHead>מוצר</TableHead><TableHead>עמלת מוצר</TableHead><TableHead>דף נחיתה</TableHead><TableHead>קישור</TableHead><TableHead>פעולות</TableHead></TableRow></TableHeader><TableBody>{(agent?.productCommissions || []).flatMap((c) => { const product = products.find((p) => String(p.id) === String(c.productId)); const entries = productSlugMap.get(String(c.productId)) || []; const base = { productName: product?.productName || product?.name || c.productName || c.productId, commission: Number(c?.commission || 0) }; if (!entries.length) return [{ key: `${c.productId}-none`, ...base, pageTitle: '—', link: '' }]; return entries.map((e) => ({ key: `${c.productId}-${e.slug}`, ...base, pageTitle: e.pageTitle || e.slug, link: `${window.location.origin}/p/${e.slug}?agentId=${encodeURIComponent(id)}` })); }).map((r) => <TableRow key={r.key}><TableCell>{r.productName}</TableCell><TableCell>{formatCurrency(r.commission)}</TableCell><TableCell>{r.pageTitle}</TableCell><TableCell dir="ltr" className="text-end text-xs">{r.link || '—'}</TableCell><TableCell><div className="flex items-center justify-end gap-1">{r.link ? <><Button type="button" variant="ghost" size="icon" onClick={async () => { try { await navigator.clipboard.writeText(r.link); setCopiedLink(r.link); setTimeout(() => setCopiedLink(''), 1200); } catch {} }} title={copiedLink === r.link ? 'הועתק' : 'העתק קישור'}><Copy className="size-4" /></Button><a href={r.link} target="_blank" rel="noreferrer"><Button type="button" variant="ghost" size="icon"><ExternalLink className="size-4" /></Button></a></> : '—'}</div></TableCell></TableRow>)}{!(agent?.productCommissions || []).length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">אין מוצרים מוגדרים לסוכן</TableCell></TableRow> : null}</TableBody></Table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card><CardHeader><CardTitle>פרטי סוכן</CardTitle><CardDescription>כל השדות מוצגים וניתנים לעריכה</CardDescription></CardHeader><CardContent className="space-y-3">{editForm ? <div className="grid gap-3 sm:grid-cols-2">{[['agentName','שם סוכן'],['idNum','ת"ז / ח.פ'],['phone','טלפון'],['email','אימייל'],['address','כתובת']].map(([k,l]) => <div key={k}><p className="text-xs text-muted-foreground mb-1">{l}</p><Input dir={k==='idNum'||k==='phone'||k==='email'?'ltr':'rtl'} className={k==='idNum'||k==='phone'||k==='email'?'text-end':'text-right'} value={editForm[k]} onChange={(e)=>setEditForm((p)=>({...p,[k]:e.target.value}))} /></div>)}</div> : null}{idHint(editForm?.idNum) ? <p className="text-destructive text-xs">{idHint(editForm?.idNum)}</p> : null}<div className="flex flex-wrap gap-2"><Button onClick={saveAgentDetails} disabled={busy}><Save className="size-4 me-2" />שמור פרטי סוכן</Button><Button variant="destructive" onClick={() => setArchiveOpen(true)} disabled={busy}>העבר סוכן לארכיון</Button></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="product-commissions" className="mt-4">
            <Card><CardHeader><CardTitle>עמלות מוצרים</CardTitle><CardDescription>צפייה ועריכה של עמלה לכל מוצר מקושר</CardDescription></CardHeader><CardContent><div className="rounded-md border overflow-x-auto"><Table className="text-right"><TableHeader><TableRow className="[&_th]:text-right"><TableHead>מוצר</TableHead><TableHead>עמלה (₪)</TableHead></TableRow></TableHeader><TableBody>{(editForm?.productCommissions || []).map((r, idx) => <TableRow key={`${r.productId}-${idx}`}><TableCell>{r.productName || r.productId}</TableCell><TableCell><Input type="number" min="0" step="0.01" dir="ltr" className="text-end max-w-[180px]" value={r.commission} onChange={(e) => setEditForm((p) => ({ ...p, productCommissions: (p.productCommissions || []).map((x, i) => (i === idx ? { ...x, commission: e.target.value } : x)) }))} /></TableCell></TableRow>)}{!(editForm?.productCommissions || []).length ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">אין מוצרים עם עמלה</TableCell></TableRow> : null}</TableBody></Table></div><div className="mt-3"><Button onClick={saveAgentDetails} disabled={busy}><Save className="size-4 me-2" />שמור עמלות מוצרים</Button></div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
  );
}

