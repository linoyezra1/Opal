import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLink = () => ({ productId: '', sku: '', vendorCost: '' });

const emptyVendor = {
  vendorName: '',
  idNum: '',
  phone: '',
  email: '',
  address: '',
  contactPerson: { name: '', role: '', phone: '', email: '' },
  accounting: { name: '', phone: '', email: '' },
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
    contactPerson: {
      name: v.contactPerson?.name || '',
      role: v.contactPerson?.role || '',
      phone: v.contactPerson?.phone || '',
      email: v.contactPerson?.email || '',
    },
    accounting: {
      name: v.accounting?.name || '',
      phone: v.accounting?.phone || '',
      email: v.accounting?.email || '',
    },
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
      <Tabs defaultValue="details" className="mt-2" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">פרטים כלליים</TabsTrigger>
          <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4 mt-4 text-right w-full" dir="rtl">
          <FieldGroup>
            <Field>
              <FieldLabel className="text-right w-full">שם ספק *</FieldLabel>
              <Input
                dir="rtl"
                className="text-right"
                value={form.vendorName}
                onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))}
                placeholder="שם החברה"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel className="text-right w-full">ח.פ / מספר זיהוי *</FieldLabel>
                <Input
                  dir="rtl"
                  className="text-right"
                  value={form.idNum}
                  onChange={(e) => setForm((p) => ({ ...p, idNum: e.target.value }))}
                  required
                />
              </Field>
              <Field>
                <FieldLabel className="text-right w-full">טלפון</FieldLabel>
                <Input dir="rtl" className="text-right" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </Field>
            </div>
            <Field>
              <FieldLabel className="text-right w-full">אימייל</FieldLabel>
              <Input
                type="email"
                dir="rtl"
                className="text-right"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel className="text-right w-full">כתובת</FieldLabel>
              <Input dir="rtl" className="text-right" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </Field>
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-semibold text-right w-full">איש קשר</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-right w-full">שם</FieldLabel>
                  <Input dir="rtl" className="text-right" value={form.contactPerson?.name || ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: { ...(p.contactPerson || {}), name: e.target.value } }))} />
                </Field>
                <Field>
                  <FieldLabel className="text-right w-full">תפקיד</FieldLabel>
                  <Input dir="rtl" className="text-right" value={form.contactPerson?.role || ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: { ...(p.contactPerson || {}), role: e.target.value } }))} />
                </Field>
                <Field>
                  <FieldLabel className="text-right w-full">טלפון</FieldLabel>
                  <Input dir="rtl" className="text-right" value={form.contactPerson?.phone || ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: { ...(p.contactPerson || {}), phone: e.target.value } }))} />
                </Field>
                <Field>
                  <FieldLabel className="text-right w-full">דוא״ל</FieldLabel>
                  <Input type="email" dir="rtl" className="text-right" value={form.contactPerson?.email || ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: { ...(p.contactPerson || {}), email: e.target.value } }))} />
                </Field>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-semibold text-right w-full">הנהלת חשבונות</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-right w-full">שם</FieldLabel>
                  <Input dir="rtl" className="text-right" value={form.accounting?.name || ''} onChange={(e) => setForm((p) => ({ ...p, accounting: { ...(p.accounting || {}), name: e.target.value } }))} />
                </Field>
                <Field>
                  <FieldLabel className="text-right w-full">טלפון</FieldLabel>
                  <Input dir="rtl" className="text-right" value={form.accounting?.phone || ''} onChange={(e) => setForm((p) => ({ ...p, accounting: { ...(p.accounting || {}), phone: e.target.value } }))} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel className="text-right w-full">דוא״ל</FieldLabel>
                  <Input type="email" dir="rtl" className="text-right" value={form.accounting?.email || ''} onChange={(e) => setForm((p) => ({ ...p, accounting: { ...(p.accounting || {}), email: e.target.value } }))} />
                </Field>
              </div>
            </div>
          </FieldGroup>
        </TabsContent>
        <TabsContent value="bank" className="space-y-4 mt-4 text-right w-full" dir="rtl">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel className="text-right w-full">שם בנק</FieldLabel>
                <Input dir="rtl" className="text-right" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel className="text-right w-full">מספר בנק</FieldLabel>
                <Input dir="rtl" className="text-right" value={form.bankNum} onChange={(e) => setForm((p) => ({ ...p, bankNum: e.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel className="text-right w-full">מספר סניף</FieldLabel>
                <Input dir="rtl" className="text-right" value={form.branchNum} onChange={(e) => setForm((p) => ({ ...p, branchNum: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel className="text-right w-full">מספר חשבון</FieldLabel>
                <Input dir="rtl" className="text-right" value={form.accountNum} onChange={(e) => setForm((p) => ({ ...p, accountNum: e.target.value }))} />
              </Field>
            </div>
            <Field>
              <FieldLabel className="text-right w-full">שם בעל החשבון</FieldLabel>
              <Input dir="rtl" className="text-right" value={form.accountHolder} onChange={(e) => setForm((p) => ({ ...p, accountHolder: e.target.value }))} />
            </Field>
          </FieldGroup>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [activeTab, setActiveTab] = React.useState(
    () => String(new URLSearchParams(window.location.search).get('tab') || 'vendors') === 'applications'
      ? 'applications'
      : 'vendors'
  );
  const [providerApps, setProviderApps] = React.useState([]);
  const [loadingApps, setLoadingApps] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState('');
  const vendorFilterConfig = React.useMemo(
    () => [
      { key: 'search', label: 'חיפוש', type: 'text', placeholder: 'חיפוש חופשי: ספק, ח.פ, טלפון, אימייל, מוצר' },
      {
        key: 'hasProducts',
        label: 'מוצרים',
        type: 'select',
        options: [
          { value: 'with_products', label: 'רק ספקים עם מוצרים' },
          { value: 'without_products', label: 'ספקים ללא מוצרים' },
        ],
      },
    ],
    []
  );
  const vendorFilterValues = React.useMemo(
    () => ({
      search,
      hasProducts: productFilter === 'all' ? '' : productFilter,
    }),
    [search, productFilter]
  );

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

  async function loadProviderApplications() {
    if (!token) return;
    setLoadingApps(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/providers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינה נכשלה');
      setProviderApps(Array.isArray(data.providers) ? data.providers : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoadingApps(false);
    }
  }

  async function approveProvider(id) {
    setApprovingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/providers/${encodeURIComponent(id)}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'אישור נכשל');
      // Remove from applications list immediately, then refresh vendors in the background.
      setProviderApps((prev) => prev.filter((p) => p.id !== id));
      loadVendors();
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setApprovingId('');
    }
  }

  React.useEffect(() => {
    if (!token) return;
    loadProducts();
    loadVendors();
    loadProviderApplications();
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
      const res = await fetch(`${API_BASE}/api/admin/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, productLinks: [] }),
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
          contactPerson: editVendor.contactPerson || {},
          accounting: editVendor.accounting || {},
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
            ? `להפוך את "${deleteTarget.vendorName}" ללא פעיל? פעולה זו תעביר את המידע לארכיון. לא ניתן לנטרל ספק זה אם יש מוצרים המשויכים אליו.`
            : ''
        }
        confirmLabel="הפוך ללא פעיל"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={loading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת ספק חדש</DialogTitle>
            <DialogDescription>הזן פרטי ספק, בנק וקישור מוצרים</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <VendorFormFields data={form} setData={setForm} />
            <div className="border-t pt-4 text-sm text-muted-foreground">
              קישור מוצרים לספק מתבצע דרך עמוד "הגדרת מוצר חדש" (/admin/product-page-setup).
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading || !form.vendorName.trim()}>
                {loading && <Spinner className="me-2" />}
                שמירה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVendor} onOpenChange={(o) => !o && setEditVendor(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת ספק</DialogTitle>
            <DialogDescription>עדכון פרטים ומוצרים</DialogDescription>
          </DialogHeader>
          {editVendor ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <VendorFormFields data={editVendor} setData={setEditVendor} />
              <div className="border-t pt-4 text-sm text-muted-foreground">
                עריכת מוצרים אינה זמינה במסך זה. רשימת המוצרים מוצגת לצפייה בלבד בכרטיס הספק.
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
            <p className="text-muted-foreground"></p>

                    <p className="text-sm text-muted-foreground">
                      טופס ציבורי להצטרפות כספק<Link className="text-primary underline" to="/provider-join-request">/provider-join-request</Link>
                    </p>




          </div>
          {activeTab === 'vendors' && (
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
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList>
            <TabsTrigger value="vendors">ספקים ({vendors.length})</TabsTrigger>
            <TabsTrigger value="applications">
              בקשות הצטרפות
              {providerApps.filter((p) => p.status === 'pending').length > 0 && (
                <Badge className="me-1.5 bg-amber-500 text-white text-xs px-1.5 py-0">
                  {providerApps.filter((p) => p.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="space-y-4 mt-4">

        <Card>
          <CardContent className="pt-6">
            <UnifiedFilterShell
              filters={vendorFilterConfig}
              values={vendorFilterValues}
              onChange={(next) => {
                setSearch(String(next.search || ''));
                setProductFilter(String(next.hasProducts || 'all'));
              }}
              onClear={() => {
                setSearch('');
                setProductFilter('all');
              }}
              resultsCount={filteredVendors.length}
              totalCount={vendors.length}
              isLoading={loading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>רשימת ספקים</CardTitle>
            <CardDescription>
              {filteredVendors.length} / {vendors.length} ספקים
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
                          <TableCell className="text-right font-mono text-sm">
                            <span dir="ltr">{v.idNum}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span dir="ltr">{v.phone || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{(v.products || []).length} מוצרים</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" type="button" asChild>
                                    <Link to={`/admin/vendors/${v.id}`} aria-label="תשלומים לספק">
                                      <CreditCard className="size-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>תשלומים לספק</TooltipContent>
                              </Tooltip>
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
                                  <p>
                                    <span className="text-muted-foreground">איש קשר:</span> {v.contactPerson?.name || '—'}
                                    {v.contactPerson?.role ? ` (${v.contactPerson.role})` : ''}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">טלפון איש קשר:</span> <span dir="ltr">{v.contactPerson?.phone || '—'}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">דוא״ל איש קשר:</span> <span dir="ltr">{v.contactPerson?.email || '—'}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">הנה״ח:</span> {v.accounting?.name || '—'}
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">טלפון הנה״ח:</span> <span dir="ltr">{v.accounting?.phone || '—'}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">דוא״ל הנה״ח:</span> <span dir="ltr">{v.accounting?.email || '—'}</span>
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
                              <div className="mt-3 text-xs space-y-2">
                                <span className="font-medium">מוצרים:</span>
                                <ul className="list-disc list-inside">
                                  {(v.products || []).map((l, i) => (
                                    <li key={i}>
                                      {l.productName || l.sku}: ₪{Number(l.providerCost || 0)} / ₪{Number(l.retailPrice || 0)} (מק&quot;ט {l.sku})
                                    </li>
                                  ))}
                                </ul>
                                {(v.products || []).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/admin/products?providerName=${encodeURIComponent(v.vendorName)}`)}
                                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                                  >
                                    לניהול מלא של מוצרי הספק ←
                                  </button>
                                )}
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
          </TabsContent>

          {/* ── Provider Applications tab ── */}
          <TabsContent value="applications" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  בקשות הצטרפות לספק
                  <Button variant="outline" size="sm" onClick={loadProviderApplications} disabled={loadingApps}>
                    {loadingApps ? 'טוען…' : 'רענן'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {providerApps.length === 0 && !loadingApps ? (
                  <Empty>
                    <EmptyMedia variant="icon"><Building2 className="size-8" /></EmptyMedia>
                    <EmptyTitle>אין בקשות הצטרפות</EmptyTitle>
                    <EmptyDescription>בקשות חדשות יופיעו כאן</EmptyDescription>
                  </Empty>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שם חברה</TableHead>
                          <TableHead>ח.פ</TableHead>
                          <TableHead>איש קשר</TableHead>
                          <TableHead>טלפון</TableHead>
                          <TableHead>מייל</TableHead>
                          <TableHead>תחום פעילות</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead className="w-28">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {providerApps.map((p) => (
                          <React.Fragment key={p.id}>
                            <TableRow>
                              <TableCell className="font-medium">{p.companyName || '—'}</TableCell>
                              <TableCell className="font-mono text-sm"><span dir="ltr">{p.companyId || '—'}</span></TableCell>
                              <TableCell>{p.contactPerson?.name || '—'}</TableCell>
                              <TableCell><span dir="ltr">{p.contactPerson?.mobile || p.contactPerson?.phone || '—'}</span></TableCell>
                              <TableCell className="text-xs"><span dir="ltr">{p.contactPerson?.email || p.companyEmail || '—'}</span></TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{p.fieldOfActivity || '—'}</TableCell>
                              <TableCell>
                                {p.status === 'pending' ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">ממתין לאישור</Badge>
                                ) : (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">פעיל</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {p.status === 'pending' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                    disabled={approvingId === p.id}
                                    onClick={() => approveProvider(p.id)}
                                  >
                                    {approvingId === p.id ? '…' : 'אשר ספק'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">אושר</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {p.message ? (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={8} className="py-2 px-6 text-xs text-muted-foreground italic">
                                  {p.message}
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
          </TabsContent>

        </Tabs>
      </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
