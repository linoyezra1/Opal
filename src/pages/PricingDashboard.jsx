import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Receipt } from 'lucide-react';
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
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLine = () => ({
  vendorId: '',
  productId: '',
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
  const [listName, setListName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [deleteId, setDeleteId] = useState(null);

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [pr, vn, ls, ag] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (pr.success) setProducts(pr.products || []);
      if (vn.success) setVendors(vn.vendors || []);
      if (ls.success) setLists(ls.lists || []);
      if (ag.success) setAgents(ag.rows || []);
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
      if (!token || !vendorId || !productId) return;
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
    [token]
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
            vendorId: l.vendorId,
            productId: l.productId,
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
      const vid = field === 'vendorId' ? value : cur.vendorId;
      const pid = field === 'productId' ? value : cur.productId;
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
        throw new Error('יש להוסיף לפחות מוצר אחד עם ספק');
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

  async function confirmDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/price-lists/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteId(null);
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
        open={!!deleteId}
        title="מחיקת מחירון"
        message="למחוק מחירון זה? דפי נחיתה שמקשרים אליו יפסיקו לעבוד."
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={loading}
      />

      <Dialog
        open={showModal}
        onOpenChange={(o) => {
          setShowModal(o);
          if (!o) setError('');
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'עריכת מחירון' : 'מחירון חדש'}</DialogTitle>
            <DialogDescription>
              לכל שורה: ספק, מוצר, ואופציונלית סוכן — העמלה תימשך אוטומטית מפרופיל הסוכן (productCommissions). בלי סוכן ניתן להזין
              עמלה ידנית.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveList} className="space-y-4">
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>שם מחירון *</FieldLabel>
                  <Input value={listName} onChange={(e) => setListName(e.target.value)} required />
                </Field>
                <Field>
                  <FieldLabel>שם ארגון (אופציונלי)</FieldLabel>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </Field>
              </div>
            </FieldGroup>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">מוצרים במחירון</h3>
                <Button type="button" variant="link" className="h-auto p-0" onClick={addLine}>
                  + שורה
                </Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3 bg-card">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">ספק</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={line.vendorId}
                        onChange={(e) => updateLine(i, 'vendorId', e.target.value)}
                        required
                      >
                        <option value="">—</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.vendorName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">מוצר</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={line.productId}
                        onChange={(e) => updateLine(i, 'productId', e.target.value)}
                        required
                      >
                        <option value="">—</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.productName || p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">סוכן (אופציונלי — עמלה אוטומטית)</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={line.agentId}
                        onChange={(e) => updateLine(i, 'agentId', e.target.value)}
                      >
                        <option value="">— ללא — (עמלה ידנית)</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.agentName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">מחיר קמעוני (₪)</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        dir="ltr"
                        value={line.retailPrice}
                        onChange={(e) => updateLine(i, 'retailPrice', e.target.value)}
                        required
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">
                        עמלת סוכן {line.agentId ? '(מחושבת מפרופיל)' : '(ידנית)'}
                      </FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        dir="ltr"
                        className={line.agentId ? 'bg-muted' : ''}
                        readOnly={!!line.agentId}
                        value={line.defaultAgentCommission}
                        onChange={(e) => updateLine(i, 'defaultAgentCommission', e.target.value)}
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">עלות ספק (מהמסד)</FieldLabel>
                      <Input className="bg-muted" readOnly value={line.vendorCost} placeholder="—" dir="ltr" />
                    </Field>
                    <div className="flex justify-end pb-2">
                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeLine(i)}>
                        הסר שורה
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
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

      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          מחירון מגדיר מספר מוצרים תחת שם אחד. ניהול דפי נחיתה מבוצע בלשונית <strong>דפי נחיתה</strong>. ודאי ש־
          <code className="rounded bg-background px-1">VITE_API_URL</code> מצביע על שרת ה-API.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">מחירונים (דפי נחיתה)</h1>
            <p className="text-muted-foreground">ניהול מחירונים וקישורי נחיתה</p>
          </div>
          <Button type="button" onClick={openNew}>
            <Plus className="size-4 me-2" />
            מחירון חדש
          </Button>
        </div>

        {error && !showModal ? <p className="text-destructive text-sm">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle>רשימת מחירונים</CardTitle>
            <CardDescription>
              {lists.length} מחירונים
              <Button variant="link" className="px-2 h-auto font-normal text-primary" type="button" onClick={() => loadAll()}>
                רענון
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lists.length === 0 && !loading ? (
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
                    <TableRow>
                      <TableHead>שם מחירון</TableHead>
                      <TableHead>ארגון</TableHead>
                      <TableHead>מוצרים</TableHead>
                      <TableHead className="w-36">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lists.map((row) => {
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.listName}</TableCell>
                          <TableCell>{row.orgName || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{(row.lines || []).length}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(row)} aria-label="ערוך">
                                <Edit2 className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => setDeleteId(row.id)}
                                aria-label="מחק"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {loading && lists.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
