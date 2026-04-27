import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Archive, Package, Eye, Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
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
  defaultBeneficiaryCount: 1,
};

// ─── View Product Dialog ────────────────────────────────────────────────────────
function ViewProductDialog({ product, productSlugMap, productPurchaseCounts, productSlugPurchaseCounts, onClose, onEdit }) {
  const [copiedLink, setCopiedLink] = React.useState('');

  if (!product) return null;

  const totalPurchases = productPurchaseCounts.get(product.id) ?? 0;

  function copyLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(''), 2000);
    }).catch(() => {});
  }

  const slugEntries = productSlugMap.get(product.id) || [];
  const productName = product.productName || product.name || '';

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">

        {/* ── Header ── */}
        <DialogHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">{productName}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-3 text-xs">
                {product.sku ? (
                  <span dir="ltr" className="font-mono bg-slate-100 rounded px-1.5 py-0.5">{product.sku}</span>
                ) : null}
                {product.provider?.vendorName ? (
                  <span className="text-muted-foreground">ספק: {product.provider.vendorName}</span>
                ) : null}
              </DialogDescription>
            </div>
            <Badge className="shrink-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
              פעיל
            </Badge>
          </div>
        </DialogHeader>

        {/* ── KPI Stats ── */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border bg-gradient-to-l from-[#D9EAF3]/40 to-[#D9EAF3]/10 p-4">
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-primary">{slugEntries.length}</p>
            <p className="text-xs text-muted-foreground">דפי נחיתה פעילים</p>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-primary">{totalPurchases}</p>
            <p className="text-xs text-muted-foreground">כמות רכישות</p>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-2xl font-bold text-[#C9A227]">
              {Number(product.providerCost || 0) > 0 ? `₪${Number(product.providerCost)}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">עלות ספק</p>
          </div>
        </div>

        {/* ── Product Details ── */}
        {product.baseDescription ? (
          <div className="rounded-xl border p-4 text-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1">תיאור</p>
            <p className="text-foreground">{product.baseDescription}</p>
          </div>
        ) : null}

        {/* ── Landing Pages Table ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">דפי נחיתה המכילים מוצר זה</h3>
            <Badge variant="secondary" className="text-xs">{slugEntries.length} דפים</Badge>
          </div>

          {slugEntries.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
              <Globe className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">המוצר אינו משויך לדפי נחיתה</p>
              <p className="text-xs text-muted-foreground mt-1">ניתן לשייך דרך הקמת דף מוצר</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">שם דף</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 w-28">כמות רכישות</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">קישור</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {slugEntries.map(({ slug, pageTitle }) => {
                    const link = `${window.location.origin}/p/${slug}`;
                    const justCopied = copiedLink === link;
                    const slugCount = productSlugPurchaseCounts.get(`${product.id}::${slug}`) ?? 0;
                    return (
                      <tr key={slug} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 font-medium text-foreground">
                          {pageTitle || slug}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-primary">
                          {slugCount}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="flex-1 truncate text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1 max-w-[200px]"
                              title={link}
                            >
                              /p/{slug}
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
                              <TooltipContent>{pageTitle || slug}</TooltipContent>
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
          <Button type="button" onClick={() => { onClose(); onEdit(product); }}>
            <Edit2 className="size-3.5 me-1.5" />
            עריכה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductManagement() {
  const [searchParams] = useSearchParams();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [products, setProducts] = React.useState([]);
  const [providers, setProviders] = React.useState([]);
  const [landingPages, setLandingPages] = React.useState([]);
  const [priceLists, setPriceLists] = React.useState([]);
  const [deals, setDeals] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editProduct, setEditProduct] = React.useState(null);
  const [viewProduct, setViewProduct] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [providerFilter, setProviderFilter] = React.useState('all');
  // Apply ?providerName= query param once providers are loaded (from vendor dashboard link)
  const providerParamApplied = React.useRef(false);
  React.useEffect(() => {
    if (providerParamApplied.current || providers.length === 0) return;
    const pname = searchParams.get('providerName');
    if (!pname) return;
    const match = providers.find((v) => String(v.vendorName || '').toLowerCase() === pname.toLowerCase());
    if (match) {
      setProviderFilter(match.id);
      providerParamApplied.current = true;
    }
  }, [providers, searchParams]);
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
      const [prRes, vnRes, lpRes, plRes, dlRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/deals`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (!prRes.success) throw new Error(prRes.error || 'טעינת מוצרים נכשלה');
      setProducts(Array.isArray(prRes.products) ? prRes.products : []);
      if (vnRes.success) setProviders(Array.isArray(vnRes.vendors) ? vnRes.vendors : []);
      if (lpRes.success) setLandingPages(Array.isArray(lpRes.pages) ? lpRes.pages : []);
      if (plRes.success) setPriceLists(Array.isArray(plRes.lists) ? plRes.lists : []);
      if (dlRes.success) setDeals(Array.isArray(dlRes.deals) ? dlRes.deals : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadProducts();
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
          defaultBeneficiaryCount: Math.max(1, Number(form.defaultBeneficiaryCount || 1)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      await loadProducts();
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
          defaultBeneficiaryCount: Math.max(1, Number(editProduct.defaultBeneficiaryCount || 1)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditProduct(null);
      await loadProducts();
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
      await loadProducts();
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
      defaultBeneficiaryCount: p.defaultBeneficiaryCount ?? 1,
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

  // productId → [{slug, pageTitle}] — mirrors AgentSetup's productSlugMap
  const productSlugMap = React.useMemo(() => {
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
        if (!existing.some((e) => e.slug === page.slug)) {
          map.set(line.productId, [...existing, { slug: page.slug, pageTitle: page.pageTitle || page.slug }]);
        }
      }
    }
    return map;
  }, [priceLists, landingPages]);

  // productId → total successful purchase count
  const productPurchaseCounts = React.useMemo(() => {
    const map = new Map();
    for (const d of deals) {
      const pid = String(d.formState?.productId || '').trim();
      if (!pid) continue;
      if (!/success|paid|test_success/i.test(String(d.paymentStatus || ''))) continue;
      map.set(pid, (map.get(pid) || 0) + 1);
    }
    return map;
  }, [deals]);

  // "productId::slug" → purchase count for that landing page
  const productSlugPurchaseCounts = React.useMemo(() => {
    const map = new Map();
    for (const d of deals) {
      const pid = String(d.formState?.productId || '').trim();
      const slug = String(d.landingSlug || d.formState?.landingPageSlug || '').trim().toLowerCase();
      if (!pid || !slug) continue;
      if (!/success|paid|test_success/i.test(String(d.paymentStatus || ''))) continue;
      const key = `${pid}::${slug}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [deals]);

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
      <ViewProductDialog
        product={viewProduct}
        productSlugMap={productSlugMap}
        productPurchaseCounts={productPurchaseCounts}
        productSlugPurchaseCounts={productSlugPurchaseCounts}
        onClose={() => setViewProduct(null)}
        onEdit={(p) => { setViewProduct(null); openEdit(p); }}
      />

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
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
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
              {(form.flowType || PRODUCT_FLOW_TYPE_LABEL) === PRODUCT_FLOW_TYPE_LABEL ? (
                <Field>
                  <FieldLabel>מספר מבוטחים (כולל ראשי)</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    dir="ltr"
                    value={form.defaultBeneficiaryCount ?? 1}
                    onChange={(e) => setForm((p) => ({ ...p, defaultBeneficiaryCount: Number(e.target.value) }))}
                  />
                </Field>
              ) : null}
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
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
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
                {(editProduct.flowType || PRODUCT_FLOW_TYPE_LABEL) === PRODUCT_FLOW_TYPE_LABEL ? (
                  <Field>
                    <FieldLabel>מספר מבוטחים (כולל ראשי)</FieldLabel>
                    <Input
                      type="number"
                      min="1"
                      max="6"
                      dir="ltr"
                      value={editProduct.defaultBeneficiaryCount ?? 1}
                      onChange={(e) => setEditProduct((p) => ({ ...p, defaultBeneficiaryCount: Number(e.target.value) }))}
                    />
                  </Field>
                ) : null}
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" type="button" onClick={() => setViewProduct(p)} aria-label="צפה">
                                  <Eye className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>צפייה</TooltipContent>
                            </Tooltip>
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
