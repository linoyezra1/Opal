import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Archive, Users, Percent } from 'lucide-react';
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

const TOKEN_KEY = 'opal_admin_token';

/** ת״ז ישראלית (7–9 ספרות): ספרת ביקורת. מזהים שאינם ספרות בלבד — לא נבדקים כאן (למשל ח.פ). */
function agentIsraeliIdHint(value) {
  const compact = String(value || '')
    .trim()
    .replace(/\s/g, '');
  if (compact.length < 7 || !/^\d{7,9}$/.test(compact)) return '';
  if (!validateIsraeliId(compact)) return ISRAELI_ID_INVALID_MSG;
  return '';
}

const emptyForm = () => ({
  agentName: '',
  idNum: '',
  phone: '',
  email: '',
  address: '',
  bankDetails: {
    bankName: '',
    bankNum: '',
    accountHolder: '',
    branchNum: '',
    accountNum: '',
  },
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
      bankName: b.bankName || '',
      bankNum: b.bankNum || '',
      accountHolder: b.accountHolder || '',
      branchNum: b.branchNum || '',
      accountNum: b.accountNum || '',
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
    ? productCommissions
        .filter((x) => x.productId)
        .map((x) => ({ productId: x.productId, commission: Number(x.commission || 0) }))
    : [];
  return { ...rest, productCommissions: rows };
}

function CommissionMatrix({ target, data, products, setAddForm, setEditAgent }) {
  const apply =
    target === 'add'
      ? (fn) => setAddForm(fn)
      : (fn) => setEditAgent((p) => (p ? fn(p) : null));

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
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      className="w-28"
                      value={row?.commission ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        apply((p) => {
                          const list = [...(p.productCommissions || [])];
                          const i = list.findIndex((c) => c.productId === pr.id);
                          if (v === '') {
                            if (i >= 0) list.splice(i, 1);
                          } else if (i >= 0) {
                            list[i] = { ...list[i], productId: pr.id, commission: v };
                          } else {
                            list.push({ productId: pr.id, commission: v, productName: '' });
                          }
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
        <p className="text-sm text-muted-foreground">
          עמלה ייחודית לכל מוצר — משמשת בדוחות רווח כשהמנוי קשור לסוכן ולמוצר. עמלה 0 או ריק מתעלמת מהמיפוי.
        </p>
      )}
    </div>
  );
}

export default function AgentSetup() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editAgent, setEditAgent] = useState(null);
  const [editTab, setEditTab] = useState('details');
  const [deleteAgent, setDeleteAgent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('details');
  const [addForm, setAddForm] = useState(() => emptyForm());
  const [search, setSearch] = useState('');
  const [commissionFilter, setCommissionFilter] = useState('all');

  const loadAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agRes, prRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (!agRes.success) throw new Error(agRes.error || 'טעינה נכשלה');
      setRows(Array.isArray(agRes.rows) ? agRes.rows : []);
      if (prRes.success) setProducts(prRes.products || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

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
    if (!idRaw) {
      setError('נא למלא תעודת זהות / ח.פ');
      setLoading(false);
      return;
    }
    const idCompact = idRaw.replace(/\s/g, '');
    if (/^\d{7,9}$/.test(idCompact) && !validateIsraeliId(idCompact)) {
      setError(ISRAELI_ID_INVALID_MSG);
      setLoading(false);
      return;
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

  async function saveEdit(e) {
    e.preventDefault();
    if (!editAgent?.id) return;
    setLoading(true);
    setError('');
    const idRaw = String(editAgent.idNum || '').trim();
    if (!idRaw) {
      setError('נא למלא תעודת זהות / ח.פ');
      setLoading(false);
      return;
    }
    const idCompact = idRaw.replace(/\s/g, '');
    if (/^\d{7,9}$/.test(idCompact) && !validateIsraeliId(idCompact)) {
      setError(ISRAELI_ID_INVALID_MSG);
      setLoading(false);
      return;
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
      setAddForm((prev) => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [field]: value },
      }));
    } else {
      setEditAgent((prev) =>
        prev
          ? {
              ...prev,
              bankDetails: { ...prev.bankDetails, [field]: value },
            }
          : null
      );
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
      const hay = [
        r.agentName,
        r.idNum,
        r.phone,
        r.email,
        ...comms.map((c) => getProductLabel(c.productId)),
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [rows, search, commissionFilter, products]);

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-primary underline">
          מעבר לכניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <ConfirmDialog
        open={!!deleteAgent}
        title="מחיקת סוכן"
        message={
          deleteAgent
            ? `להפוך את "${deleteAgent.agentName}" ללא פעיל? פעולה זו תעביר את המידע לארכיון.${deleteAgent.totalSales > 0 ? ' (לא ניתן אם יש עסקאות מקושרות)' : ''}`
            : ''
        }
        confirmLabel="הפוך ללא פעיל"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteAgent(null)}
        isLoading={loading}
      />

      <Dialog
        open={showAddModal}
        onOpenChange={(o) => {
          setShowAddModal(o);
          if (!o) setError('');
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>הוספת סוכן</DialogTitle>
            <DialogDescription>הזינו פרטי סוכן, בנק ועמלות למוצרים</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <Tabs value={addTab} onValueChange={setAddTab} className="mt-0">
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
                        value={addForm.agentName}
                        onChange={(e) => setAddForm((p) => ({ ...p, agentName: e.target.value }))}
                        placeholder="שם מלא"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>תעודת זהות / ח.פ *</FieldLabel>
                      <Input
                        value={addForm.idNum}
                        onChange={(e) => setAddForm((p) => ({ ...p, idNum: e.target.value }))}
                        placeholder="מספר זיהוי"
                        dir="ltr"
                        required
                      />
                      {agentIsraeliIdHint(addForm.idNum) ? (
                        <p className="text-destructive text-xs">{agentIsraeliIdHint(addForm.idNum)}</p>
                      ) : null}
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>טלפון</FieldLabel>
                      <Input
                        value={addForm.phone}
                        onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="050-0000000"
                        dir="ltr"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>אימייל</FieldLabel>
                      <Input
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="email@example.com"
                        dir="ltr"
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>כתובת</FieldLabel>
                    <Input
                      value={addForm.address}
                      onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="רחוב, עיר"
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="bank" className="space-y-4 mt-4">
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>שם בנק *</FieldLabel>
                      <Input
                        value={addForm.bankDetails.bankName}
                        onChange={(e) => setBank('add', 'bankName', e.target.value)}
                        placeholder="למשל: בנק הפועלים"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>מספר בנק</FieldLabel>
                      <Input
                        value={addForm.bankDetails.bankNum}
                        onChange={(e) => setBank('add', 'bankNum', e.target.value)}
                        dir="ltr"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>שם בעל חשבון *</FieldLabel>
                      <Input
                        value={addForm.bankDetails.accountHolder}
                        onChange={(e) => setBank('add', 'accountHolder', e.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>מספר סניף</FieldLabel>
                      <Input
                        value={addForm.bankDetails.branchNum}
                        onChange={(e) => setBank('add', 'branchNum', e.target.value)}
                        dir="ltr"
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>מספר חשבון</FieldLabel>
                    <Input
                      value={addForm.bankDetails.accountNum}
                      onChange={(e) => setBank('add', 'accountNum', e.target.value)}
                      dir="ltr"
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="commissions" className="mt-4">
                <CommissionMatrix
                  target="add"
                  data={addForm}
                  products={products}
                  setAddForm={setAddForm}
                  setEditAgent={setEditAgent}
                />
              </TabsContent>
            </Tabs>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
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

      <Dialog
        open={!!editAgent}
        onOpenChange={(o) => {
          if (!o) {
            setEditAgent(null);
            setError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת סוכן</DialogTitle>
            <DialogDescription>עדכנו פרטי סוכן, בנק ועמלות</DialogDescription>
          </DialogHeader>
          {editAgent ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <Tabs value={editTab} onValueChange={setEditTab} className="mt-0">
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
                          value={editAgent.agentName}
                          onChange={(e) => setEditAgent((p) => ({ ...p, agentName: e.target.value }))}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>תעודת זהות / ח.פ *</FieldLabel>
                        <Input
                          value={editAgent.idNum}
                          onChange={(e) => setEditAgent((p) => ({ ...p, idNum: e.target.value }))}
                          dir="ltr"
                          required
                        />
                        {agentIsraeliIdHint(editAgent.idNum) ? (
                          <p className="text-destructive text-xs">{agentIsraeliIdHint(editAgent.idNum)}</p>
                        ) : null}
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>טלפון</FieldLabel>
                        <Input
                          value={editAgent.phone}
                          onChange={(e) => setEditAgent((p) => ({ ...p, phone: e.target.value }))}
                          dir="ltr"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>אימייל</FieldLabel>
                        <Input
                          type="email"
                          value={editAgent.email}
                          onChange={(e) => setEditAgent((p) => ({ ...p, email: e.target.value }))}
                          dir="ltr"
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>כתובת</FieldLabel>
                      <Input
                        value={editAgent.address}
                        onChange={(e) => setEditAgent((p) => ({ ...p, address: e.target.value }))}
                      />
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="bank" className="space-y-4 mt-4">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>שם בנק *</FieldLabel>
                        <Input
                          value={editAgent.bankDetails.bankName}
                          onChange={(e) => setBank('edit', 'bankName', e.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>מספר בנק</FieldLabel>
                        <Input
                          value={editAgent.bankDetails.bankNum}
                          onChange={(e) => setBank('edit', 'bankNum', e.target.value)}
                          dir="ltr"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>שם בעל חשבון *</FieldLabel>
                        <Input
                          value={editAgent.bankDetails.accountHolder}
                          onChange={(e) => setBank('edit', 'accountHolder', e.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>מספר סניף</FieldLabel>
                        <Input
                          value={editAgent.bankDetails.branchNum}
                          onChange={(e) => setBank('edit', 'branchNum', e.target.value)}
                          dir="ltr"
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>מספר חשבון</FieldLabel>
                      <Input
                        value={editAgent.bankDetails.accountNum}
                        onChange={(e) => setBank('edit', 'accountNum', e.target.value)}
                        dir="ltr"
                      />
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="commissions" className="mt-4">
                  <CommissionMatrix
                    target="edit"
                    data={editAgent}
                    products={products}
                    setAddForm={setAddForm}
                    setEditAgent={setEditAgent}
                  />
                </TabsContent>
              </Tabs>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditAgent(null)}>
                  ביטול
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Spinner className="me-2" />}
                  שמירה
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">סוכנים</h1>
            <p className="text-muted-foreground">ניהול סוכנים ועמלות למוצרים</p>
          </div>
          <Button type="button" onClick={openAdd}>
            <Plus className="size-4 me-2" />
            הוסף סוכן
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש חופשי: סוכן, ת״ז/ח.פ, טלפון, אימייל, מוצר"
              />
              <select
                className="flex h-10 min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={commissionFilter}
                onChange={(e) => setCommissionFilter(e.target.value)}
              >
                <option value="all">כל הסוכנים</option>
                <option value="with_commission">עם הגדרות עמלה</option>
                <option value="without_commission">ללא הגדרות עמלה</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>רשימת סוכנים</CardTitle>
            <CardDescription>
              {filteredRows.length} / {rows.length} סוכנים
              <Button variant="link" className="px-2 h-auto font-normal text-primary" type="button" onClick={() => loadAgents()}>
                רענון
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRows.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Users className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין סוכנים עדיין</EmptyTitle>
                <EmptyDescription>הוסיפו סוכן ראשון כדי לקשר מנויים ועמלות</EmptyDescription>
                <Button className="mt-4" type="button" onClick={openAdd}>
                  <Plus className="size-4 me-2" />
                  הוסף סוכן חדש
                </Button>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>ת&quot;ז / ח.פ</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>אימייל</TableHead>
                      <TableHead>עמלות</TableHead>
                      <TableHead>סה&quot;כ מנויים</TableHead>
                      <TableHead className="w-28">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => {
                      const comms = r.productCommissions || [];
                      const preview = comms.slice(0, 2);
                      const rest = comms.length - preview.length;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.agentName}</TableCell>
                          <TableCell dir="ltr" className="text-start font-mono text-sm">
                            {r.idNum}
                          </TableCell>
                          <TableCell dir="ltr" className="text-start">
                            {r.phone || '—'}
                          </TableCell>
                          <TableCell dir="ltr" className="text-start text-muted-foreground">
                            {r.email || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {preview.map((c) => (
                                <Badge key={c.productId} variant="outline" className="text-xs">
                                  <Percent className="size-3 me-1" />
                                  {getProductLabel(c.productId).slice(0, 14)}
                                  {String(c.commission ?? '').length ? ` · ₪${c.commission}` : ''}
                                </Badge>
                              ))}
                              {rest > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  +{rest}
                                </Badge>
                              ) : null}
                              {!comms.length ? <span className="text-muted-foreground text-sm">—</span> : null}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-primary">{r.totalSales ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => {
                                  setEditTab('details');
                                  setEditAgent(agentFromRow(r));
                                }}
                                aria-label="ערוך"
                              >
                                <Edit2 className="size-4" />
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => setDeleteAgent(r)}
                                    aria-label="הפוך ללא פעיל"
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
            {loading && rows.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
          </CardContent>
        </Card>
      </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
