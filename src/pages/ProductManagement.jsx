import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Archive, Package } from 'lucide-react';
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
import { Textarea } from '../components/ui/textarea.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';
const PRODUCT_FLOW_TYPE_LABEL = 'רופא עד הבית';

const EMPTY_FORM = {
  productName: '',
  sku: '',
  baseDescription: '',
  providerId: '',
  providerCost: '',
  flowType: PRODUCT_FLOW_TYPE_LABEL,
};

export default function ProductManagement() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [products, setProducts] = React.useState([]);
  const [providers, setProviders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editProduct, setEditProduct] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [providerFilter, setProviderFilter] = React.useState('all');
  const productFilterConfig = React.useMemo(
    () => [
      { key: 'search', label: 'חיפוש', type: 'text', placeholder: 'חיפוש חופשי: מוצר, ספק, מק״ט, תיאור' },
      {
        key: 'providerId',
        label: 'ספק',
        type: 'select',
        options: (providers || []).map((v) => ({ value: String(v.id || ''), label: String(v.vendorName || '') })).filter((x) => x.value),
      },
    ],
    [providers]
  );

  async function loadProducts() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינת מוצרים נכשלה');
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadProducts();
  }, [token]);

  async function loadProviders() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינת ספקים נכשלה');
      setProviders(Array.isArray(data.vendors) ? data.vendors : []);
    } catch {
      setProviders([]);
    }
  }

  React.useEffect(() => {
    loadProviders();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: form.productName,
          sku: form.sku,
          baseDescription: form.baseDescription,
          providerId: form.providerId,
          providerCost: Number(form.providerCost || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      await Promise.all([loadProducts(), loadProviders()]);
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editProduct?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${editProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: editProduct.productName,
          sku: editProduct.sku,
          baseDescription: editProduct.baseDescription ?? '',
          providerId: editProduct.providerId,
          providerCost: Number(editProduct.providerCost || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditProduct(null);
      await Promise.all([loadProducts(), loadProviders()]);
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'נטרול נכשל');
      setDeleteTarget(null);
      await Promise.all([loadProducts(), loadProviders()]);
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(p) {
    setEditProduct({
      id: p.id,
      productName: p.productName || p.name,
      sku: p.sku,
      baseDescription: p.baseDescription || '',
      providerId: p.providerId || p.provider?.id || '',
      providerCost: String(p.providerCost ?? ''),
      provider: p.provider || null,
      flowType: p.flowType || PRODUCT_FLOW_TYPE_LABEL,
    });
  }

  const filteredProducts = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (products || []).filter((p) => {
      if (providerFilter !== 'all' && String(p.providerId || p.provider?.id || '') !== providerFilter) return false;
      if (!q) return true;
      const hay = [
        p.productName || p.name,
        p.sku,
        p.baseDescription,
        p.provider?.vendorName,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [products, search, providerFilter]);

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">
          מעבר לכניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <ConfirmDialog
        open={!!deleteTarget}
        title="מחיקת מוצר"
        message={
          deleteTarget
            ? `להפוך את "${deleteTarget.productName || deleteTarget.name}" (${deleteTarget.sku}) ללא פעיל? פעולה זו תעביר את המידע לארכיון.`
            : ''
        }
        confirmLabel="הפוך ללא פעיל"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={loading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת מוצר חדש</DialogTitle>
            <DialogDescription>הזן את פרטי המוצר החדש</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>סוג זרימה</FieldLabel>
                <Input value={PRODUCT_FLOW_TYPE_LABEL} disabled readOnly className="bg-muted" />
              </Field>
              <Field>
                <FieldLabel>שם מוצר *</FieldLabel>
                <Input
                  value={form.productName}
                  onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                  placeholder="שם המוצר"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>מק&quot;ט *</FieldLabel>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                  placeholder="SKU ייחודי"
                  className="font-mono"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>ספק *</FieldLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={form.providerId}
                  onChange={(e) => setForm((p) => ({ ...p, providerId: e.target.value }))}
                  required
                >
                  <option value="">בחר ספק</option>
                  {providers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>תיאור</FieldLabel>
                <Textarea
                  value={form.baseDescription}
                  onChange={(e) => setForm((p) => ({ ...p, baseDescription: e.target.value }))}
                  placeholder="תיאור קצר (לדפי נחיתה)"
                  rows={3}
                />
              </Field>
              <Field>
                <FieldLabel>עלות ספק (₪)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={form.providerCost}
                  onChange={(e) => setForm((p) => ({ ...p, providerCost: e.target.value }))}
                />
              </Field>
            </FieldGroup>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading || !form.productName.trim() || !form.sku.trim() || !form.providerId}>
                {loading && <Spinner className="me-2" />}
                הוסף
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProduct} onOpenChange={(o) => !o && setEditProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת מוצר</DialogTitle>
            <DialogDescription>עדכן את פרטי המוצר</DialogDescription>
          </DialogHeader>
          {editProduct ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>סוג זרימה</FieldLabel>
                  <Input value={editProduct.flowType || PRODUCT_FLOW_TYPE_LABEL} disabled readOnly className="bg-muted" />
                </Field>
                <Field>
                  <FieldLabel>שם מוצר *</FieldLabel>
                  <Input
                    value={editProduct.productName}
                    onChange={(e) => setEditProduct((p) => ({ ...p, productName: e.target.value }))}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>ספק *</FieldLabel>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editProduct.providerId}
                    onChange={(e) => setEditProduct((p) => ({ ...p, providerId: e.target.value }))}
                    required
                  >
                    <option value="">בחר ספק</option>
                    {providers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>מק&quot;ט *</FieldLabel>
                  <Input
                    value={editProduct.sku}
                    onChange={(e) => setEditProduct((p) => ({ ...p, sku: e.target.value }))}
                    className="font-mono"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>תיאור</FieldLabel>
                  <Textarea
                    value={editProduct.baseDescription}
                    onChange={(e) => setEditProduct((p) => ({ ...p, baseDescription: e.target.value }))}
                    rows={3}
                  />
                </Field>
                <Field>
                  <FieldLabel>עלות ספק (₪)</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={editProduct.providerCost ?? ''}
                    onChange={(e) => setEditProduct((p) => ({ ...p, providerCost: e.target.value }))}
                  />
                </Field>
              </FieldGroup>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>
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
            <h1 className="text-2xl font-bold tracking-tight">מוצרים</h1>
            <p className="text-muted-foreground">ניהול מוצרים וקטלוג</p>
          </div>
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4 me-2" />
            הוסף מוצר
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <UnifiedFilterShell
              filters={productFilterConfig}
              values={{ search, providerId: providerFilter === 'all' ? '' : providerFilter }}
              onChange={(next) => {
                setSearch(String(next.search || ''));
                setProviderFilter(String(next.providerId || 'all'));
              }}
              onClear={() => {
                setSearch('');
                setProviderFilter('all');
              }}
              resultsCount={filteredProducts.length}
              totalCount={products.length}
              isLoading={loading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>רשימת מוצרים</CardTitle>
            <CardDescription>
              {filteredProducts.length} / {products.length} מוצרים
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Package className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין מוצרים עדיין</EmptyTitle>
                <EmptyDescription>התחל בהוספת מוצר ראשון למערכת</EmptyDescription>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4 me-2" />
                  הוסף מוצר חדש
                </Button>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם מוצר</TableHead>
                      <TableHead>ספק</TableHead>
                      <TableHead>מק&quot;ט</TableHead>
                      <TableHead>עלות ספק</TableHead>
                      <TableHead>תיאור</TableHead>
                      <TableHead>נוצר</TableHead>
                      <TableHead className="w-28">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.productName || p.name}</TableCell>
                        <TableCell>{p.provider?.vendorName || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                        <TableCell dir="ltr">{Number(p.providerCost || 0)}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {p.baseDescription || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                          {p.createdAt ? new Date(p.createdAt).toLocaleString('he-IL') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(p)} aria-label="ערוך">
                              <Edit2 className="size-4" />
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  onClick={() => setDeleteTarget(p)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {loading && products.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
          </CardContent>
        </Card>
      </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
