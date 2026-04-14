import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Archive,
  Building2,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Input } from '../components/ui/input.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLink = () => ({ productId: '', sku: '', vendorCost: '' });

const emptyVendor = {
  vendorName: '',
  idNum: '',
  phone: '',
  email: '',
  address: '',
  bankName: '',
  bankNum: '',
  accountHolder: '',
  branchNum: '',
  accountNum: '',
};

function vendorToEditForm(v) {
  const links = (v.productLinks || []).length
    ? v.productLinks.map((l) => ({
        productId: l.productId,
        sku: l.sku || l.product?.sku || '',
        vendorCost: String(l.vendorCost ?? ''),
      }))
    : [emptyLink()];
  return {
    id: v.id,
    vendorName: v.vendorName,
    idNum: v.idNum,
    phone: v.phone || '',
    email: v.email || '',
    address: v.address || '',
    bankName: v.bankName || '',
    bankNum: v.bankNum || '',
    accountHolder: v.accountHolder || '',
    branchNum: v.branchNum || '',
    accountNum: v.accountNum || '',
    productLinks: links,
  };
}

function VendorFormFields({ data, setData }) {
  const setForm = setData;
  const form = data;
  return (
    <>
      <Tabs defaultValue="details" className="mt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">פרטים כלליים</TabsTrigger>
          <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4 mt-4">
          <FieldGroup>
            <Field>
              <FieldLabel>שם ספק *</FieldLabel>
              <Input
                value={form.vendorName}
                onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))}
                placeholder="שם החברה"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>ח.פ / מספר זיהוי *</FieldLabel>
                <Input
                  value={form.idNum}
                  onChange={(e) => setForm((p) => ({ ...p, idNum: e.target.value }))}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>טלפון</FieldLabel>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} dir="ltr" className="text-start" />
              </Field>
            </div>
            <Field>
              <FieldLabel>אימייל</FieldLabel>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                dir="ltr"
                className="text-start"
              />
            </Field>
            <Field>
              <FieldLabel>כתובת</FieldLabel>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </Field>
          </FieldGroup>
        </TabsContent>
        <TabsContent value="bank" className="space-y-4 mt-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>שם בנק</FieldLabel>
                <Input value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>מספר בנק</FieldLabel>
                <Input value={form.bankNum} onChange={(e) => setForm((p) => ({ ...p, bankNum: e.target.value }))} dir="ltr" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>מספר סניף</FieldLabel>
                <Input value={form.branchNum} onChange={(e) => setForm((p) => ({ ...p, branchNum: e.target.value }))} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>מספר חשבון</FieldLabel>
                <Input value={form.accountNum} onChange={(e) => setForm((p) => ({ ...p, accountNum: e.target.value }))} dir="ltr" />
              </Field>
            </div>
            <Field>
              <FieldLabel>שם בעל החשבון</FieldLabel>
              <Input value={form.accountHolder} onChange={(e) => setForm((p) => ({ ...p, accountHolder: e.target.value }))} />
            </Field>
          </FieldGroup>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function VendorDashboard() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(emptyVendor);
  const [productLinks, setProductLinks] = React.useState([emptyLink()]);
  const [products, setProducts] = React.useState([]);
  const [vendors, setVendors] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editVendor, setEditVendor] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [expandedVendor, setExpandedVendor] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [productFilter, setProductFilter] = React.useState('all');

  async function loadProducts() {
    const res = await fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) setProducts(Array.isArray(data.products) ? data.products : []);
  }

  async function loadVendors() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינה נכשלה');
      setVendors(Array.isArray(data.vendors) ? data.vendors : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!token) return;
    loadProducts();
    loadVendors();
  }, [token]);

  function onProductSelect(index, productId, isEdit) {
    const p = products.find((x) => x.id === productId);
    if (isEdit) {
      setEditVendor((prev) => {
        const lines = [...prev.productLinks];
        lines[index] = { ...lines[index], productId, sku: p ? p.sku : '' };
        return { ...prev, productLinks: lines };
      });
    } else {
      setProductLinks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], productId, sku: p ? p.sku : '' };
        return next;
      });
    }
  }

  function updateLink(index, field, value, isEdit) {
    const setter = isEdit ? setEditVendor : setProductLinks;
    setter((prev) => {
      if (isEdit) {
        const lines = [...prev.productLinks];
        lines[index] = { ...lines[index], [field]: value };
        return { ...prev, productLinks: lines };
      }
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const links = productLinks
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          vendorCost: Number(l.vendorCost || 0),
        }));
      const res = await fetch(`${API_BASE}/api/admin/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, productLinks: links }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(emptyVendor);
      setProductLinks([emptyLink()]);
      setCreateOpen(false);
      await loadVendors();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editVendor?.id) return;
    setLoading(true);
    setError('');
    try {
      const links = editVendor.productLinks
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          vendorCost: Number(l.vendorCost || 0),
        }));
      const res = await fetch(`${API_BASE}/api/admin/vendors/${editVendor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendorName: editVendor.vendorName,
          idNum: editVendor.idNum,
          phone: editVendor.phone,
          email: editVendor.email,
          address: editVendor.address,
          bankName: editVendor.bankName,
          bankNum: editVendor.bankNum,
          accountHolder: editVendor.accountHolder,
          branchNum: editVendor.branchNum,
          accountNum: editVendor.accountNum,
          productLinks: links,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditVendor(null);
      await loadVendors();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'נטרול נכשל');
      setDeleteTarget(null);
      await loadVendors();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function ProductLinksEditor({ isEdit }) {
    const links = isEdit ? editVendor.productLinks : productLinks;
    const setLinks = isEdit ? setEditVendor : setProductLinks;
    const onSelect = (idx, pid) => onProductSelect(idx, pid, isEdit);
    const upd = (idx, field, val) => updateLink(idx, field, val, isEdit);
    const addLine = () =>
      isEdit
        ? setEditVendor((ev) => ({ ...ev, productLinks: [...ev.productLinks, emptyLink()] }))
        : setProductLinks((p) => [...p, emptyLink()]);
    const removeLine = (idx) => {
      if (isEdit) {
        setEditVendor((ev) => ({
          ...ev,
          productLinks: ev.productLinks.length <= 1 ? ev.productLinks : ev.productLinks.filter((_, i) => i !== idx),
        }));
      } else {
        setProductLinks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
      }
    };

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">בחרו מוצר — מק&quot;ט יימשך אוטומטית.</p>
        {links.map((line, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/40">
            <div className="md:col-span-5">
              <FieldLabel className="text-xs">מוצר</FieldLabel>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={line.productId}
                onChange={(e) => onSelect(idx, e.target.value)}
              >
                <option value="">— בחרו —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productName || p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <FieldLabel className="text-xs">מק&quot;ט</FieldLabel>
              <Input readOnly value={line.sku} className="bg-muted/50" />
            </div>
            <div className="md:col-span-3">
              <FieldLabel className="text-xs">מחיר לספק (₪)</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.vendorCost}
                onChange={(e) => upd(idx, 'vendorCost', e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-1">
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(idx)} disabled={links.length <= 1}>
                הסר
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          + שורת מוצר
        </Button>
      </div>
    );
  }

  const filteredVendors = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (vendors || []).filter((v) => {
      const ownedProducts = Array.isArray(v.products) ? v.products : [];
      if (productFilter === 'with_products' && ownedProducts.length === 0) return false;
      if (productFilter === 'without_products' && ownedProducts.length > 0) return false;
      if (!q) return true;
      const hay = [
        v.vendorName,
        v.idNum,
        v.phone,
        v.email,
        ...ownedProducts.map((p) => p.productName),
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [vendors, search, productFilter]);

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p>יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">
          כניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <ConfirmDialog
        open={!!deleteTarget}
        title="מחיקת ספק"
        message={
          deleteTarget
            ? `להפוך את "${deleteTarget.vendorName}" ללא פעיל? לא ניתן לנטרל ספק זה אם יש מוצרים המשויכים אליו.`
            : ''
        }
        confirmLabel="הפוך ללא פעיל"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={loading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>הוספת ספק חדש</DialogTitle>
            <DialogDescription>הזן פרטי ספק, בנק וקישור מוצרים</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <VendorFormFields data={form} setData={setForm} />
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">מוצרים ומחירי ספק</h4>
              <ProductLinksEditor isEdit={false} />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading || !form.vendorName.trim() || !form.idNum.trim()}>
                {loading && <Spinner className="me-2" />}
                שמירה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVendor} onOpenChange={(o) => !o && setEditVendor(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת ספק</DialogTitle>
            <DialogDescription>עדכון פרטים ומוצרים</DialogDescription>
          </DialogHeader>
          {editVendor ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <VendorFormFields data={editVendor} setData={setEditVendor} />
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">מוצרים ומחירי ספק</h4>
                <ProductLinksEditor isEdit />
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditVendor(null)}>
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
            <h1 className="text-2xl font-bold tracking-tight">ספקים</h1>
            <p className="text-muted-foreground">ניהול ספקים, בנק וקישור מוצרים</p>
          </div>
          <Button
            onClick={() => {
              setForm(emptyVendor);
              setProductLinks([emptyLink()]);
              setError('');
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4 me-2" />
            הוסף ספק
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש חופשי: ספק, ח.פ, טלפון, אימייל, מוצר"
              />
              <select
                className="flex h-10 min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="all">כל הספקים</option>
                <option value="with_products">רק ספקים עם מוצרים</option>
                <option value="without_products">ספקים ללא מוצרים</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>רשימת ספקים</CardTitle>
            <CardDescription>
              {filteredVendors.length} / {vendors.length} ספקים
              <Button variant="link" className="px-2 h-auto font-normal text-primary" type="button" onClick={() => loadVendors()}>
                רענון
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredVendors.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Building2 className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין ספקים עדיין</EmptyTitle>
                <EmptyDescription>התחל בהוספת ספק ראשון</EmptyDescription>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4 me-2" />
                  הוסף ספק
                </Button>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>שם ספק</TableHead>
                      <TableHead>ח.פ</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>מוצרים</TableHead>
                      <TableHead className="w-28">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((v) => (
                      <React.Fragment key={v.id}>
                        <TableRow>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="size-8" type="button" onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)}>
                              {expandedVendor === v.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{v.vendorName}</TableCell>
                          <TableCell dir="ltr" className="text-start font-mono text-sm">
                            {v.idNum}
                          </TableCell>
                          <TableCell dir="ltr" className="text-start">
                            {v.phone || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{(v.products || []).length} מוצרים</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" type="button" onClick={() => setEditVendor(vendorToEditForm(v))}>
                                <Edit2 className="size-4" />
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" type="button" onClick={() => setDeleteTarget(v)} aria-label="הפוך ללא פעיל">
                                    <Archive className="size-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>הפוך ללא פעיל</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedVendor === v.id ? (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/40 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1 text-sm">
                                  <h4 className="font-medium">פרטי קשר</h4>
                                  <p>
                                    <span className="text-muted-foreground">אימייל:</span> {v.email || '—'}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">כתובת:</span> {v.address || '—'}
                                  </p>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <CreditCard className="size-4" />
                                    פרטי בנק
                                  </h4>
                                  <p>
                                    <span className="text-muted-foreground">בנק:</span> {v.bankName || '—'} ({v.bankNum || '—'})
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">סניף:</span> {v.branchNum || '—'}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">חשבון:</span> {v.accountNum || '—'}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">בעל חשבון:</span> {v.accountHolder || '—'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 text-xs space-y-1">
                                <span className="font-medium">מוצרים:</span>
                                <ul className="list-disc list-inside">
                                  {(v.products || []).map((l, i) => (
                                    <li key={i}>
                                      {l.productName || l.sku}: ₪{Number(l.providerCost || 0)} / ₪{Number(l.retailPrice || 0)} (מק&quot;ט {l.sku})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
