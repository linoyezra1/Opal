import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Archive, Receipt, ChevronDown, ChevronUp, Eye, Building2 } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
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
import { Input } from '../components/ui/input.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';
import { fmtDateTime } from '../utils/dateUtils.js';

const TOKEN_KEY = 'opal_admin_token';

function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(v || 0));
}

function lineNetProfit(line) {
  if (line == null) return 0;
  if (line.netProfit != null && Number.isFinite(Number(line.netProfit))) {
    return Number(line.netProfit);
  }
  const r = Number(line.retailPrice || 0);
  const v = Number(line.vendorCost || 0);
  const a = Number(line.defaultAgentCommission || 0);
  return r - v - a;
}

const emptyLine = () => ({
  productId: '',
  vendorId: '',
  providerName: '',
  agentId: '',
  retailPrice: '',
  defaultAgentCommission: '',
  vendorCost: '',
});

export default function PricingDashboard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [lists, setLists] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [listName, setListName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [archiveId, setArchiveId] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [organizations, setOrganizations] = useState([]);
  const [viewRow, setViewRow] = useState(null);

  function toggleExpand(id) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const productMap = useMemo(
    () => new Map((products || []).map((p) => [String(p.id), p])),
    [products]
  );

  const filteredLists = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (lists || []).filter((row) => {
      if (orgFilter && String(row.orgName || '') !== orgFilter) return false;
      if (!q) return true;
      return `${String(row.listName || '')} ${String(row.orgName || '')}`.toLowerCase().includes(q);
    });
  }, [lists, search, orgFilter]);

  const orgsByPriceListId = useMemo(() => {
    const m = new Map();
    for (const org of organizations || []) {
      const plId = String(org.priceListId || '').trim();
      if (!plId) continue;
      if (!m.has(plId)) m.set(plId, []);
      m.get(plId).push(org);
    }
    return m;
  }, [organizations]);

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [pr, vn, ls, ag, orgRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/organizations`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (pr.success) setProducts(pr.products || []);
      if (vn.success) setVendors(vn.vendors || []);
      if (ls.success) setLists(ls.lists || []);
      if (ag.success) setAgents(ag.rows || []);
      if (orgRes.success) setOrganizations(Array.isArray(orgRes.rows) ? orgRes.rows : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [token]);

  const fetchLineCost = useCallback(
    async (index, vendorId, productId) => {
      if (!vendorId || !productId) return;
      const selectedProduct = (products || []).find((p) => String(p.id) === String(productId));
      if (selectedProduct) {
        setLines((prev) => {
          const next = [...prev];
          if (!next[index]) return prev;
          next[index] = {
            ...next[index],
            vendorId: String(selectedProduct.providerId || vendorId || ''),
            providerName: String(selectedProduct.provider?.vendorName || ''),
            vendorCost: String(selectedProduct.providerCost ?? ''),
          };
          return next;
        });
        return;
      }
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/vendor-products/${encodeURIComponent(vendorId)}/${encodeURIComponent(productId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setLines((prev) => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = { ...next[index], vendorCost: String(data.vendorCost ?? '') };
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    },
    [token, products]
  );

  const fetchAgentCommission = useCallback(
    async (index, agentId, productId) => {
      if (!token || !agentId || !productId) return;
      try {
        const params = new URLSearchParams({ agentId, productId, fallback: '0' });
        const res = await fetch(`${API_BASE}/api/admin/agent-commission-preview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setLines((prev) => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = { ...next[index], defaultAgentCommission: String(data.commission ?? 0) };
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    },
    [token]
  );

  function openNew() {
    setEditId(null);
    setListName('');
    setOrgName('');
    setLines([emptyLine()]);
    setError('');
    setShowModal(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setListName(row.listName || '');
    setOrgName(row.orgName || '');
    const mapped =
      (row.lines || []).length > 0
        ? row.lines.map((l) => ({
            productId: l.productId,
            vendorId: l.vendorId,
            providerName: '',
            agentId: l.agentId || '',
            retailPrice: String(l.retailPrice ?? ''),
            defaultAgentCommission: String(l.defaultAgentCommission ?? ''),
            vendorCost: String(l.vendorCost ?? ''),
          }))
        : [emptyLine()];
    setLines(mapped);
    setError('');
    setShowModal(true);
    setTimeout(() => {
      mapped.forEach((l, i) => {
        if (l.vendorId && l.productId) fetchLineCost(i, l.vendorId, l.productId);
        if (l.agentId && l.productId) fetchAgentCommission(i, l.agentId, l.productId);
      });
    }, 50);
  }

  function updateLine(i, field, value) {
    setLines((prev) => {
      const next = [...prev];
      const cur = { ...next[i], [field]: value };
      next[i] = cur;
      const pid = field === 'productId' ? value : cur.productId;
      let vid = field === 'vendorId' ? value : cur.vendorId;
      if (field === 'productId') {
        const p = (products || []).find((x) => String(x.id) === String(value));
        if (p) {
          vid = String(p.providerId || '');
          cur.vendorId = vid;
          cur.providerName = String(p.provider?.vendorName || '');
          cur.vendorCost = String(p.providerCost ?? '');
          next[i] = cur;
        }
      }
      const aid = field === 'agentId' ? value : cur.agentId;
      if (vid && pid) {
        queueMicrotask(() => fetchLineCost(i, vid, pid));
      }
      if (aid && pid) {
        queueMicrotask(() => fetchAgentCommission(i, aid, pid));
      }
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  async function saveList(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        listName,
        orgName,
        lines: lines
          .map((l) => {
            const p = (products || []).find((x) => String(x.id) === String(l.productId));
            const vendorId = String(l.vendorId || p?.providerId || '');
            return {
              vendorId,
              productId: l.productId,
              agentId: l.agentId || undefined,
              retailPrice: Number(l.retailPrice || 0),
              defaultAgentCommission: Number(l.defaultAgentCommission || 0),
              vendorCost: l.vendorCost === '' ? undefined : Number(l.vendorCost),
            };
          })
          .filter((l) => l.vendorId && l.productId)
          .map((l) => ({
            vendorId: l.vendorId,
            productId: l.productId,
            agentId: l.agentId || undefined,
            retailPrice: Number(l.retailPrice || 0),
            defaultAgentCommission: Number(l.defaultAgentCommission || 0),
            vendorCost: l.vendorCost === '' ? undefined : Number(l.vendorCost),
          })),
      };
      if (!body.lines.length) {
        throw new Error('יש להוסיף לפחות מוצר אחד');
      }
      const url = editId ? `${API_BASE}/api/admin/price-lists/${editId}` : `${API_BASE}/api/admin/price-lists`;
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowModal(false);
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmArchive() {
    if (!archiveId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/price-lists/${archiveId}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'העברה לארכיון נכשלה');
      setArchiveId(null);
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p>יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-primary underline">
          כניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <AdminPageShell>
      <ConfirmDialog
        open={!!archiveId}
        title="העברת מחירון לארכיון"
        message="העברת המחירון לארכיון אינה משפיעה על דפי מוצר, דפי נחיתה או מחירונים המשויכים כבר לארגונים, וזאת לצורך שמירה על רצף נתונים תקין."
        confirmLabel="העבר לארכיון"
        danger={false}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveId(null)}
        isLoading={loading}
      />

      <Dialog
        open={showModal}
        onOpenChange={(o) => {
          setShowModal(o);
          if (!o) setError('');
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editId ? 'עריכת מחירון' : 'מחירון חדש'}</DialogTitle>
            <DialogDescription>
              לכל שורה: מוצר, ספק נקבע אוטומטית מהמוצר, ואופציונלית סוכן — העמלה תימשך אוטומטית מפרופיל הסוכן (productCommissions). בלי סוכן ניתן להזין
              עמלה ידנית.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveList} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>שם מחירון *</FieldLabel>
                <Input value={listName} onChange={(e) => setListName(e.target.value)} required />
              </Field>
            </FieldGroup>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">מוצרים במחירון</h3>
              {lines.map((line, i) => {
                const selectedProduct = (products || []).find((p) => String(p.id) === String(line.productId));
                const providerLabel =
                  line.providerName ||
                  selectedProduct?.provider?.vendorName ||
                  vendors.find((v) => String(v.id) === String(line.vendorId))?.vendorName ||
                  '';
                const skuFlowLabel = selectedProduct
                  ? `${selectedProduct.sku || '—'} (Flow: ${selectedProduct.flowType || '—'})`
                  : '';
                return (
                  <div key={i} className="border rounded-lg p-3 space-y-3 bg-card">
                    <div className="space-y-3 text-sm min-w-0">
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">שם מוצר</FieldLabel>
                          <select
                            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={line.productId}
                            onChange={(e) => updateLine(i, 'productId', e.target.value)}
                            required
                          >
                            <option value="">— בחרו מוצר —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.productName || p.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">מק"ט וסוג זרימה</FieldLabel>
                          <Input className="bg-muted" readOnly value={skuFlowLabel} placeholder="—" dir="ltr" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">שם ספק</FieldLabel>
                          <Input className="bg-muted" readOnly value={providerLabel} placeholder="—" />
                        </Field>
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">עלות ספק (₪)</FieldLabel>
                          <Input className="bg-muted" readOnly value={line.vendorCost} placeholder="—" dir="ltr" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">שם סוכן</FieldLabel>
                          <select
                            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={line.agentId}
                            onChange={(e) => updateLine(i, 'agentId', e.target.value)}
                          >
                            <option value="">— ללא —</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.agentName}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">עמלת סוכן (₪)</FieldLabel>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            className="min-w-0"
                            value={line.defaultAgentCommission}
                            onChange={(e) => updateLine(i, 'defaultAgentCommission', e.target.value)}
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">מחיר לצרכן (₪)</FieldLabel>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            className="min-w-0"
                            value={line.retailPrice}
                            onChange={(e) => updateLine(i, 'retailPrice', e.target.value)}
                            required
                          />
                        </Field>
                        <Field className="gap-1.5 min-w-0">
                          <FieldLabel className="text-xs">רווח נקי (מחושב)</FieldLabel>
                          <Input
                            className="bg-muted tabular-nums min-w-0"
                            readOnly
                            value={formatCurrency(lineNetProfit(line))}
                            dir="ltr"
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeLine(i)}>
                        הסר שורה
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="default" className="w-full sm:w-auto" onClick={addLine}>
                <Plus className="size-4 me-2" />
                הוסף מוצר למחירון
              </Button>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Spinner className="me-2" />}
                שמירה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(o) => { if (!o) setViewRow(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי מוצרים במחירון</DialogTitle>
            <DialogDescription>
              {viewRow?.listName ? `מחירון: ${viewRow.listName}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="[&_th]:text-right">
                  <TableHead>מוצר + SKU</TableHead>
                  <TableHead>עלות ספק</TableHead>
                  <TableHead>עמלת סוכן</TableHead>
                  <TableHead>מחיר לצרכן</TableHead>
                  <TableHead>רווח נקי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!viewRow || (viewRow.lines || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                      אין מוצרים במחירון זה
                    </TableCell>
                  </TableRow>
                ) : (
                  (viewRow.lines || []).map((line, li) => {
                    const prod = productMap.get(String(line.productId));
                    const prodName = prod?.productName || prod?.name || '—';
                    const sku = prod?.sku || '—';
                    const net = lineNetProfit(line);
                    return (
                      <TableRow key={li}>
                        <TableCell>
                          <div className="font-medium">{prodName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{sku}</div>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(line.vendorCost)}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(line.defaultAgentCommission)}</TableCell>
                        <TableCell className="tabular-nums font-medium">{formatCurrency(line.retailPrice)}</TableCell>
                        <TableCell className="tabular-nums font-semibold text-primary">{formatCurrency(net)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewRow(null)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">מחירונים</h1>

          </div>
          <Button type="button" onClick={openNew}>
            <Plus className="size-4 me-2" />
            מחירון חדש
          </Button>
        </div>

        {error && !showModal ? <p className="text-destructive text-sm">{error}</p> : null}
        <Card>
          <CardContent className="pt-6">
            <UnifiedFilterShell
              filters={[
                { key: 'search', label: 'חיפוש', type: 'text', placeholder: 'חיפוש מחירון / ארגון' },
                {
                  key: 'orgName',
                  label: 'ארגון',
                  type: 'select',
                  options: Array.from(new Set((lists || []).map((x) => String(x.orgName || '').trim()).filter(Boolean))).map((x) => ({ value: x, label: x })),
                },
              ]}
              values={{ search, orgName: orgFilter }}
              onChange={(next) => {
                setSearch(String(next.search || ''));
                setOrgFilter(String(next.orgName || ''));
              }}
              onClear={() => {
                setSearch('');
                setOrgFilter('');
              }}
              resultsCount={filteredLists.length}
              totalCount={lists.length}
              isLoading={loading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>רשימת מחירונים</CardTitle>
            <CardDescription>
              {filteredLists.length} / {lists.length} מחירונים
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLists.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Receipt className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין מחירונים</EmptyTitle>
                <EmptyDescription>צרו מחירון חדש כדי לקבל קישור לדף נחיתה</EmptyDescription>
                <Button className="mt-4" type="button" onClick={openNew}>
                  <Plus className="size-4 me-2" />
                  מחירון חדש
                </Button>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="[&_th]:text-right">
                      <TableHead className="w-8" />
                      <TableHead>שם מחירון</TableHead>
                      <TableHead>תאריך יצירה</TableHead>
                      <TableHead className="w-36">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLists.map((row) => {
                      const isExpanded = expandedRows.has(row.id);
                      const dateLabel = row.createdAt ? fmtDateTime(row.createdAt) : '—';
                      const linkedOrgs = orgsByPriceListId.get(String(row.id)) || [];
                      return (
                        <React.Fragment key={row.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell
                              className="w-8 text-center cursor-pointer align-middle"
                              onClick={() => toggleExpand(row.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleExpand(row.id);
                                }
                              }}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'כווץ' : 'הרחב'}
                            >
                              {isExpanded
                                ? <ChevronUp className="size-4 text-muted-foreground mx-auto" />
                                : <ChevronDown className="size-4 text-muted-foreground mx-auto" />}
                            </TableCell>
                            <TableCell className="font-medium">{row.listName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{dateLabel}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  onClick={() => setViewRow(row)}
                                  aria-label="צפייה במוצרים"
                                >
                                  <Eye className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(row)} aria-label="ערוך">
                                  <Edit2 className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" type="button" onClick={() => setArchiveId(row.id)} aria-label="ארכיון">
                                  <Archive className="size-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={4} className="p-0">
                                <div className="px-6 py-4 space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    ארגונים מקושרים למחירון
                                  </p>
                                  {linkedOrgs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-1">
                                      לא נמצאו ארגונים מקושרים למחירון זה
                                    </p>
                                  ) : (
                                    <ul className="space-y-1.5 text-sm list-none m-0 p-0">
                                      {linkedOrgs.map((org) => {
                                        const name = String(org.companyName || org.name || '').trim() || '—';
                                        const price = Number(org.monthlyPricePerMember || 0);
                                        return (
                                          <li
                                            key={String(org.id || org._id || name)}
                                            className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
                                          >
                                            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <span>
                                              {name} - {price} ₪
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {loading && filteredLists.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
          </CardContent>
        </Card>
    </AdminPageShell>
  );
}
