import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, Check, Copy, Edit2, ExternalLink, Eye, Percent, Phone,
  Plus, Users,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import { ISRAELI_ID_INVALID_MSG, validateIsraeliId } from '../utils/israeliId.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Input } from '../components/ui/input.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';

function agentIsraeliIdHint(value) {
  const compact = String(value || '').trim().replace(/\s/g, '');
  if (compact.length < 7 || !/^\d{7,9}$/.test(compact)) return '';
  if (!validateIsraeliId(compact)) return ISRAELI_ID_INVALID_MSG;
  return '';
}

const emptyForm = () => ({
  agentName: '', idNum: '', phone: '', email: '', address: '',
  bankDetails: { bankName: '', bankNum: '', accountHolder: '', branchNum: '', accountNum: '' },
  productCommissions: [],
});

function agentFromRow(r) {
  const b = r.bankDetails || {};
  const pc = Array.isArray(r.productCommissions) ? r.productCommissions : [];
  return {
    id: r.id,
    agentName: r.agentName || '',
    idNum: r.idNum || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    bankDetails: {
      bankName: b.bankName || '', bankNum: b.bankNum || '',
      accountHolder: b.accountHolder || '', branchNum: b.branchNum || '', accountNum: b.accountNum || '',
    },
    productCommissions: pc.map((x) => ({
      productId: x.productId || '',
      commission: String(x.commission ?? ''),
      productName: x.productName || '',
    })),
  };
}

function buildPayload(body) {
  const { productCommissions, ...rest } = body;
  const rows = Array.isArray(productCommissions)
    ? productCommissions.filter((x) => x.productId).map((x) => ({ productId: x.productId, commission: Number(x.commission || 0) }))
    : [];
  return { ...rest, productCommissions: rows };
}

// ─── Commission Matrix (used in Add/Edit dialogs) ──────────────────────────────
function CommissionMatrix({ data, setData, products }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מוצר</TableHead>
              <TableHead className="w-40">עמלה (₪)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((pr) => {
              const row = (data.productCommissions || []).find((c) => c.productId === pr.id);
              return (
                <TableRow key={pr.id}>
                  <TableCell className="font-medium">
                    {pr.productName || pr.name}{' '}
                    <span className="text-muted-foreground text-sm font-mono">({pr.sku})</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" step="0.01" dir="ltr" className="w-28"
                      value={row?.commission ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setData((p) => {
                          const list = [...(p.productCommissions || [])];
                          const i = list.findIndex((c) => c.productId === pr.id);
                          if (v === '') { if (i >= 0) list.splice(i, 1); }
                          else if (i >= 0) { list[i] = { ...list[i], productId: pr.id, commission: v }; }
                          else { list.push({ productId: pr.id, commission: v, productName: '' }); }
                          return { ...p, productCommissions: list };
                        });
                      }}
                      placeholder="0"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!products.length ? (
        <p className="text-sm text-muted-foreground">אין מוצרים במערכת — הוסיפו מוצרים תחילה.</p>
      ) : (
        <p className="text-sm text-muted-foreground">עמלה ייחודית לכל מוצר — משמשת בדוחות רווח.</p>
      )}
    </div>
  );
}

// ─── View Agent Dialog ──────────────────────────────────────────────────────────
function ViewAgentDialog({ agent, products, productSlugMap, onClose, onEdit }) {
  const [copiedLink, setCopiedLink] = useState('');

  if (!agent) return null;

  function copyLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(''), 2000);
    }).catch(() => {});
  }

  const comms = Array.isArray(agent.productCommissions) ? agent.productCommissions : [];
  const b = agent.bankDetails || {};

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">

        {/* ── Header ── */}
        <DialogHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">{agent.agentName}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-3 text-xs">
                {agent.idNum ? <span dir="ltr" className="font-mono">{agent.idNum}</span> : null}
                {agent.phone ? <a href={`tel:${agent.phone}`} dir="ltr" className="text-primary underline">{agent.phone}</a> : null}
                {agent.email ? <a href={`mailto:${agent.email}`} dir="ltr" className="text-primary underline">{agent.email}</a> : null}
              </DialogDescription>
            </div>
            <Badge className="shrink-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
              פעיל
            </Badge>
          </div>
        </DialogHeader>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border bg-gradient-to-l from-[#D9EAF3]/40 to-[#D9EAF3]/10 p-4">
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-primary">{agent.totalSales ?? 0}</p>
            <p className="text-xs text-muted-foreground">סה"כ מנויים</p>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-primary">{comms.length}</p>
            <p className="text-xs text-muted-foreground">מוצרים פעילים</p>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-[#C9A227]">
              {comms.reduce((s, c) => s + Number(c.commission || 0), 0) > 0
                ? `₪${comms.reduce((s, c) => s + Number(c.commission || 0), 0)}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">עמלה כוללת</p>
          </div>
        </div>

        {/* ── Address + Bank ── */}
        {(agent.address || b.bankName) ? (
          <div className="grid sm:grid-cols-2 gap-4 rounded-xl border p-4 text-sm">
            {agent.address ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">כתובת</p>
                <p>{agent.address}</p>
              </div>
            ) : null}
            {b.bankName ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">פרטי בנק</p>
                <p>{b.bankName}{b.bankNum ? ` (${b.bankNum})` : ''}</p>
                {b.branchNum ? <p className="text-muted-foreground">סניף {b.branchNum}</p> : null}
                {b.accountNum ? <p className="text-muted-foreground">חשבון {b.accountNum}</p> : null}
                {b.accountHolder ? <p className="text-muted-foreground">בעל חשבון: {b.accountHolder}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── Distribution Links Table ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">קישורי הפצה ייחודיים</h3>
            <Badge variant="secondary" className="text-xs">{comms.length} מוצרים</Badge>
          </div>

          {comms.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
              <Percent className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">לא הוגדרו מוצרים לסוכן זה</p>
              <p className="text-xs text-muted-foreground mt-1">ניתן להוסיף בעריכת הסוכן</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">מוצר</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 w-24">עמלה</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">קישור ייחודי</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comms.map((c) => {
                    const product = products.find((p) => p.id === c.productId);
                    const productName = product?.productName || product?.name || c.productName || c.productId;
                    const slugEntries = productSlugMap.get(c.productId) || [];
                    return (
                      <tr key={c.productId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 font-medium text-foreground">
                          {productName}
                          {product?.sku ? (
                            <span className="ms-1.5 text-xs font-mono text-muted-foreground">({product.sku})</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-[#C9A227] font-semibold">
                          {Number(c.commission) > 0 ? `₪${Number(c.commission)}` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {slugEntries.length === 0 ? (
                            <span className="text-xs text-muted-foreground">אין דף נחיתה</span>
                          ) : (
                            <div className="space-y-1.5">
                              {slugEntries.map(({ slug, pageTitle }) => {
                                const link = `${window.location.origin}/p/${slug}?agentId=${encodeURIComponent(agent.id)}`;
                                const justCopied = copiedLink === link;
                                return (
                                  <div key={slug} className="flex items-center gap-1.5">
                                    <span
                                      className="flex-1 truncate text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1 max-w-[180px]"
                                      title={link}
                                    >
                                      /p/{slug}?agentId=…
                                    </span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => copyLink(link)}
                                          className={`inline-flex items-center gap-1 h-7 px-2 rounded border text-xs transition-all shrink-0
                                            ${justCopied
                                              ? 'bg-green-100 border-green-300 text-green-700'
                                              : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}
                                        >
                                          {justCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                                          {justCopied ? 'הועתק' : 'העתק'}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {pageTitle || slug}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <a
                                          href={link}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-200 bg-white text-slate-500 hover:border-primary hover:text-primary transition-colors shrink-0"
                                        >
                                          <ExternalLink className="size-3" />
                                        </a>
                                      </TooltipTrigger>
                                      <TooltipContent>פתח קישור</TooltipContent>
                                    </Tooltip>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>סגור</Button>
          <Button type="button" onClick={() => { onClose(); onEdit(agent); }}>
            <Edit2 className="size-3.5 me-1.5" />
            עריכה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent form tabs (shared between Add + Edit) ──────────────────────────────
function AgentFormTabs({ data, setData, tab, setTab, products }) {
  const setField = (field, value) => setData((p) => ({ ...p, [field]: value }));
  const setBankField = (field, value) =>
    setData((p) => ({ ...p, bankDetails: { ...p.bankDetails, [field]: value } }));

  return (
    <Tabs value={tab} onValueChange={setTab} className="mt-0">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details">פרטים אישיים</TabsTrigger>
        <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
        <TabsTrigger value="commissions">עמלות</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-4 mt-4">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>שם סוכן *</FieldLabel>
              <Input
                value={data.agentName}
                onChange={(e) => setField('agentName', e.target.value)}
                placeholder="שם מלא"
                required
              />
            </Field>
            <Field>
              <FieldLabel>תעודת זהות / ח.פ *</FieldLabel>
              <Input
                value={data.idNum}
                onChange={(e) => setField('idNum', e.target.value)}
                placeholder="מספר זיהוי"
                dir="ltr"
                required
              />
              {agentIsraeliIdHint(data.idNum)
                ? <p className="text-destructive text-xs">{agentIsraeliIdHint(data.idNum)}</p>
                : null}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>טלפון</FieldLabel>
              <Input
                value={data.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </Field>
            <Field>
              <FieldLabel>אימייל</FieldLabel>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="agent@example.com"
                dir="ltr"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>כתובת</FieldLabel>
            <Input
              value={data.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="רחוב, עיר"
            />
          </Field>
        </FieldGroup>
      </TabsContent>

      <TabsContent value="bank" className="space-y-4 mt-4">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>שם בנק</FieldLabel>
              <Input
                value={data.bankDetails?.bankName || ''}
                onChange={(e) => setBankField('bankName', e.target.value)}
                placeholder="לדוגמה: בנק הפועלים"
              />
            </Field>
            <Field>
              <FieldLabel>מספר בנק</FieldLabel>
              <Input
                value={data.bankDetails?.bankNum || ''}
                onChange={(e) => setBankField('bankNum', e.target.value)}
                placeholder="12"
                dir="ltr"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>מספר סניף</FieldLabel>
              <Input
                value={data.bankDetails?.branchNum || ''}
                onChange={(e) => setBankField('branchNum', e.target.value)}
                placeholder="123"
                dir="ltr"
              />
            </Field>
            <Field>
              <FieldLabel>מספר חשבון</FieldLabel>
              <Input
                value={data.bankDetails?.accountNum || ''}
                onChange={(e) => setBankField('accountNum', e.target.value)}
                placeholder="123456"
                dir="ltr"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>שם בעל החשבון</FieldLabel>
            <Input
              value={data.bankDetails?.accountHolder || ''}
              onChange={(e) => setBankField('accountHolder', e.target.value)}
              placeholder="שם מלא"
            />
          </Field>
        </FieldGroup>
      </TabsContent>

      <TabsContent value="commissions" className="mt-4">
        <CommissionMatrix data={data} setData={setData} products={products || []} />
      </TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function AgentSetup() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [landingPages, setLandingPages] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [viewAgent, setViewAgent] = useState(null);
  const [editAgent, setEditAgent] = useState(null);
  const [editTab, setEditTab] = useState('details');
  const [deleteAgent, setDeleteAgent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('details');
  const [addForm, setAddForm] = useState(() => emptyForm());

  const [search, setSearch] = useState('');
  const [commissionFilter, setCommissionFilter] = useState('all');

  const agentFilterConfig = React.useMemo(
    () => [
      { key: 'search', label: 'חיפוש', type: 'text', placeholder: 'חיפוש חופשי: סוכן, ת״ז/ח.פ, טלפון, אימייל, מוצר' },
      {
        key: 'commissionFilter', label: 'סינון', type: 'select',
        options: [
          { value: 'with_commission', label: 'עם הגדרות עמלה' },
          { value: 'without_commission', label: 'ללא הגדרות עמלה' },
        ],
      },
    ],
    []
  );

  // ── productSlugMap: productId → [{slug, pageTitle}] ───────────────────────
  const productSlugMap = useMemo(() => {
    const map = new Map();
    const plIndex = new Map(priceLists.map((pl) => [pl.id, pl]));
    for (const page of landingPages) {
      if (!page.slug || !page.priceListId) continue;
      const pl = plIndex.get(page.priceListId);
      if (!pl) continue;
      const lines = Array.isArray(pl.lines) ? pl.lines : [];
      for (const line of lines) {
        if (!line.productId) continue;
        const existing = map.get(line.productId) || [];
        const alreadyHasSlug = existing.some((e) => e.slug === page.slug);
        if (!alreadyHasSlug) {
          map.set(line.productId, [...existing, { slug: page.slug, pageTitle: page.pageTitle || page.slug }]);
        }
      }
    }
    return map;
  }, [priceLists, landingPages]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agRes, prRes, lpRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (!agRes.success) throw new Error(agRes.error || 'טעינה נכשלה');
      setRows(Array.isArray(agRes.rows) ? agRes.rows : []);
      if (prRes.success) setProducts(prRes.products || []);
      if (lpRes.success) setLandingPages(lpRes.pages || []);
      if (plRes.success) setPriceLists(plRes.lists || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // ── Add ────────────────────────────────────────────────────────────────────
  function openAdd() {
    setAddForm(emptyForm());
    setAddTab('details');
    setError('');
    setShowAddModal(true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const idRaw = String(addForm.idNum || '').trim();
    if (!idRaw) { setError('נא למלא תעודת זהות / ח.פ'); setLoading(false); return; }
    const idCompact = idRaw.replace(/\s/g, '');
    if (/^\d{7,9}$/.test(idCompact) && !validateIsraeliId(idCompact)) {
      setError(ISRAELI_ID_INVALID_MSG); setLoading(false); return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(addForm)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowAddModal(false);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  async function saveEdit(e) {
    e.preventDefault();
    if (!editAgent?.id) return;
    setLoading(true);
    setError('');
    const idRaw = String(editAgent.idNum || '').trim();
    if (!idRaw) { setError('נא למלא תעודת זהות / ח.פ'); setLoading(false); return; }
    const idCompact = idRaw.replace(/\s/g, '');
    if (/^\d{7,9}$/.test(idCompact) && !validateIsraeliId(idCompact)) {
      setError(ISRAELI_ID_INVALID_MSG); setLoading(false); return;
    }
    try {
      const { id, ...body } = editAgent;
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(body)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditAgent(null);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteAgent?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(deleteAgent.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'נטרול נכשל');
      setDeleteAgent(null);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function setBank(target, field, value) {
    if (target === 'add') {
      setAddForm((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }));
    } else {
      setEditAgent((prev) => prev ? { ...prev, bankDetails: { ...prev.bankDetails, [field]: value } } : null);
    }
  }

  function getProductLabel(productId) {
    const p = products.find((x) => x.id === productId);
    return p ? p.productName || p.name : productId;
  }

  const filteredRows = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (rows || []).filter((r) => {
      const comms = Array.isArray(r.productCommissions) ? r.productCommissions : [];
      if (commissionFilter === 'with_commission' && comms.length === 0) return false;
      if (commissionFilter === 'without_commission' && comms.length > 0) return false;
      if (!q) return true;
      const hay = [r.agentName, r.idNum, r.phone, r.email, ...comms.map((c) => getProductLabel(c.productId))]
        .map((x) => String(x || '').toLowerCase()).join(' | ');
      return hay.includes(q);
    });
  }, [rows, search, commissionFilter, products]);


  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-primary underline">מעבר לכניסת מנהל</Link>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>

        <ConfirmDialog
          open={!!deleteAgent}
          title="ניטרול סוכן"
          message={deleteAgent
            ? `להפוך את "${deleteAgent.agentName}" ללא פעיל?${deleteAgent.totalSales > 0 ? ' (לא ניתן אם יש עסקאות מקושרות)' : ''}`
            : ''}
          confirmLabel="הפוך ללא פעיל"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteAgent(null)}
          isLoading={loading}
        />

        {/* ── View Agent ── */}
        <ViewAgentDialog
          agent={viewAgent}
          products={products}
          productSlugMap={productSlugMap}
          onClose={() => setViewAgent(null)}
          onEdit={(a) => { setEditTab('details'); setEditAgent(agentFromRow(a)); }}
        />

        {/* ── Add Agent ── */}
        <Dialog open={showAddModal} onOpenChange={(o) => { setShowAddModal(o); if (!o) setError(''); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle>הוספת סוכן</DialogTitle>
              <DialogDescription>הזינו פרטי סוכן, בנק ועמלות למוצרים</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitAdd} className="space-y-4">
              <AgentFormTabs target="add" data={addForm} setData={setAddForm} tab={addTab} setTab={setAddTab} products={products} />
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>ביטול</Button>
                <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Edit Agent ── */}
        <Dialog open={!!editAgent} onOpenChange={(o) => { if (!o) { setEditAgent(null); setError(''); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת סוכן</DialogTitle>
              <DialogDescription>עדכנו פרטי סוכן, בנק ועמלות</DialogDescription>
            </DialogHeader>
            {editAgent ? (
              <form onSubmit={saveEdit} className="space-y-4">
                <AgentFormTabs target="edit" data={editAgent} setData={setEditAgent} tab={editTab} setTab={setEditTab} products={products} />
                {error ? <p className="text-destructive text-sm">{error}</p> : null}
                <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                  <Button type="button" variant="outline" onClick={() => setEditAgent(null)}>ביטול</Button>
                  <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* ── Main content ── */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">סוכנים</h1>
              <p className="text-muted-foreground">ניהול סוכנים, עמלות וקישורי הפצה</p>
            </div>
            <Button type="button" onClick={openAdd}>
              <Plus className="size-4 me-2" />
              הוסף סוכן
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <UnifiedFilterShell
                filters={agentFilterConfig}
                values={{ search, commissionFilter: commissionFilter === 'all' ? '' : commissionFilter }}
                onChange={(next) => {
                  setSearch(String(next.search || ''));
                  setCommissionFilter(String(next.commissionFilter || 'all'));
                }}
                onClear={() => { setSearch(''); setCommissionFilter('all'); }}
                resultsCount={filteredRows.length}
                totalCount={rows.length}
                isLoading={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">רשימת סוכנים</CardTitle>
                <CardDescription>{filteredRows.length} / {rows.length} סוכנים</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {filteredRows.length === 0 && !loading ? (
                <Empty>
                  <EmptyMedia variant="icon"><Users className="size-8" /></EmptyMedia>
                  <EmptyTitle>אין סוכנים עדיין</EmptyTitle>
                  <EmptyDescription>הוסיפו סוכן ראשון כדי לקשר מנויים ועמלות</EmptyDescription>
                  <Button className="mt-4" type="button" onClick={openAdd}>
                    <Plus className="size-4 me-2" />הוסף סוכן חדש
                  </Button>
                </Empty>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold">שם</TableHead>
                        <TableHead className="font-semibold">ת"ז / ח.פ</TableHead>
                        <TableHead className="font-semibold hidden sm:table-cell">טלפון</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">אימייל</TableHead>
                        <TableHead className="font-semibold">סטטוס</TableHead>
                        <TableHead className="font-semibold">מוצרים</TableHead>
                        <TableHead className="font-semibold text-center">מנויים</TableHead>
                        <TableHead className="w-32 font-semibold">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => {
                        const comms = r.productCommissions || [];
                        const preview = comms.slice(0, 2);
                        const rest = comms.length - preview.length;
                        return (
                          <TableRow
                            key={r.id}
                            className="hover:bg-primary/[0.03] transition-colors group"
                          >
                            <TableCell>
                              <button
                                type="button"
                                className="font-semibold text-foreground hover:text-primary transition-colors text-start"
                                onClick={() => setViewAgent(r)}
                              >
                                {r.agentName}
                              </button>
                            </TableCell>
                            <TableCell dir="ltr" className="text-start font-mono text-sm text-muted-foreground">
                              {r.idNum}
                            </TableCell>
                            <TableCell dir="ltr" className="text-start hidden sm:table-cell text-muted-foreground">
                              {r.phone || '—'}
                            </TableCell>
                            <TableCell dir="ltr" className="text-start hidden md:table-cell text-muted-foreground text-sm">
                              {r.email || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">
                                פעיל
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {preview.map((c) => (
                                  <Badge key={c.productId} variant="secondary" className="text-xs gap-1">
                                    <Percent className="size-2.5" />
                                    {getProductLabel(c.productId).slice(0, 12)}
                                    {String(c.commission ?? '').length ? ` ₪${c.commission}` : ''}
                                  </Badge>
                                ))}
                                {rest > 0 ? <Badge variant="outline" className="text-xs">+{rest}</Badge> : null}
                                {!comms.length ? <span className="text-muted-foreground text-sm">—</span> : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-primary">
                              {r.totalSales ?? 0}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon" type="button"
                                      className="size-8 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={() => setViewAgent(r)}
                                      aria-label="צפייה"
                                    >
                                      <Eye className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>צפייה וקישורי הפצה</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon" type="button"
                                      className="size-8 hover:bg-slate-100"
                                      onClick={() => { setEditTab('details'); setEditAgent(agentFromRow(r)); }}
                                      aria-label="ערוך"
                                    >
                                      <Edit2 className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>עריכה</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon" type="button"
                                      className="size-8 hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => setDeleteAgent(r)}
                                      aria-label="ניטרול"
                                    >
                                      <Archive className="size-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>הפוך ללא פעיל</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {loading && rows.length > 0 ? (
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                  <Spinner className="size-3.5" />טוען…
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
