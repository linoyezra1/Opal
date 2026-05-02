import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Plus, Edit2, Archive, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyForm = () => ({
  companyName: '',
  companyId: '',
  officialAddress: '',
  companyEmail: '',
  fieldOfActivity: '',
  employeesCount: '',
  billingMethod: 'חיוב מרוכז חברה',
  billingType: 'Centralized',
  monthlyPricePerMember: '',
  subscriptionProductName: '',
  pricingMethod: 'priceList',
  priceListId: '',
  singleProductId: '',
  customPricing: [],
  status: 'active',
  contactEmail: '',
  contactPhone: '',
  employeeApprovalEmail: '',
  notes: '',
  contactPerson: { name: '', role: '', phone: '', mobile: '', email: '' },
  accounting: { name: '', role: '', phone: '', mobile: '', email: '' },
  additionalContact: { name: '', role: '', phone: '', mobile: '', email: '' },
});

export default function OrganizationsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editOrg, setEditOrg] = useState(null);
  const [editTab, setEditTab] = useState('org');
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('org');
  const [addForm, setAddForm] = useState(() => emptyForm());
  const [billingEditConfirmOpen, setBillingEditConfirmOpen] = useState(false);
  const [billingEditPending, setBillingEditPending] = useState(null);
  const [products, setProducts] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [search, setSearch] = useState('');
  const [billingFilter, setBillingFilter] = useState('all');
  const [activeMainTab, setActiveMainTab] = useState(
    () => String(new URLSearchParams(window.location.search).get('tab') || 'orgs') === 'applications' ? 'applications' : 'orgs'
  );
  const [approvingId, setApprovingId] = useState('');
  const [copiedLink, setCopiedLink] = useState('');
  const [expandedOrgRows, setExpandedOrgRows] = useState({});

  function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(''), 2000);
    }).catch(() => {});
  }

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [orgRes, prRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/organizations`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);
      if (!orgRes.success) throw new Error(orgRes.error || 'טעינה נכשלה');
      setRows(Array.isArray(orgRes.rows) ? orgRes.rows : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setPriceLists(Array.isArray(plRes?.lists) ? plRes.lists : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const deepSearch = String(searchParams.get('search') || '').trim();
    if (deepSearch) setSearch(deepSearch);
  }, [searchParams]);

  function openAdd() {
    setAddForm(emptyForm());
    setAddTab('org');
    setError('');
    setShowAddModal(true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        companyName: addForm.companyName.trim(),
        companyId: addForm.companyId.trim(),
        officialAddress: addForm.officialAddress.trim(),
        companyEmail: addForm.companyEmail.trim(),
        fieldOfActivity: addForm.fieldOfActivity.trim(),
        employeesCount: Number(addForm.employeesCount || 0),
        billingType: addForm.billingType === 'Centralized' ? 'Centralized' : 'Private',
        billingMethod:
          addForm.billingType === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
        monthlyPricePerMember: Number(addForm.monthlyPricePerMember || 0),
        subscriptionProductName: String(addForm.subscriptionProductName || '').trim(),
        priceListId: addForm.pricingMethod === 'priceList' ? String(addForm.priceListId || '').trim() : '',
        singleProductId: addForm.pricingMethod === 'singleProduct' ? String(addForm.singleProductId || '').trim() : '',
        customPricing:
          addForm.pricingMethod === 'custom'
            ? (addForm.customPricing || [])
                .filter((x) => x.productId)
                .map((x) => ({ productId: x.productId, memberPrice: Number(x.memberPrice || 0) }))
            : [],
        status: 'active',
        contactEmail: addForm.contactEmail.trim(),
        contactPhone: addForm.contactPhone.trim(),
        notes: addForm.notes.trim(),
        contactPerson: addForm.contactPerson,
        accounting: addForm.accounting,
        additionalContact: addForm.additionalContact,
        source: 'admin',
      };
      const res = await fetch(`${API_BASE}/api/admin/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowAddModal(false);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editOrg?.id) return;
    setLoading(true);
    setError('');
    try {
      const { id, activeMemberCount, name, taxId, ...rest } = editOrg;
      const body = {
        ...rest,
        monthlyPricePerMember: Number(rest.monthlyPricePerMember || 0),
        employeesCount: Number(rest.employeesCount || 0),
        priceListId:
          rest.pricingMethod === 'priceList'
            ? String(rest.priceListId || '').trim()
            : '',
        singleProductId:
          rest.pricingMethod === 'singleProduct'
            ? String(rest.singleProductId || '').trim()
            : '',
        customPricing:
          rest.pricingMethod === 'custom'
            ? (rest.customPricing || [])
                .filter((x) => x.productId)
                .map((x) => ({ productId: x.productId, memberPrice: Number(x.memberPrice || 0) }))
            : [],
      };
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditOrg(null);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteOrg?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(deleteOrg.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'נטרול נכשל');
      setDeleteOrg(null);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function setContact(target, section, field, value) {
    if (target === 'add') {
      setAddForm((p) => ({ ...p, [section]: { ...(p[section] || {}), [field]: value } }));
    } else {
      setEditOrg((p) => (p ? { ...p, [section]: { ...(p[section] || {}), [field]: value } } : null));
    }
  }

  function addCustomPricingRow(target) {
    const updater = (prev) => ({ ...prev, customPricing: [...(prev.customPricing || []), { productId: '', memberPrice: '' }] });
    if (target === 'add') setAddForm(updater);
    else setEditOrg((p) => (p ? updater(p) : p));
  }

  function updateCustomPricingRow(target, idx, field, value) {
    const updater = (prev) => {
      const list = [...(prev.customPricing || [])];
      list[idx] = { ...(list[idx] || { productId: '', memberPrice: '' }), [field]: value };
      return { ...prev, customPricing: list };
    };
    if (target === 'add') setAddForm(updater);
    else setEditOrg((p) => (p ? updater(p) : p));
  }

  function removeCustomPricingRow(target, idx) {
    const updater = (prev) => ({ ...prev, customPricing: (prev.customPricing || []).filter((_, i) => i !== idx) });
    if (target === 'add') setAddForm(updater);
    else setEditOrg((p) => (p ? updater(p) : p));
  }

  async function approveOrg(id) {
    setApprovingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'אישור נכשל');
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'active' } : r));
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setApprovingId('');
    }
  }

  const pendingRows = React.useMemo(
    () => (rows || []).filter((r) => ['pending', 'Pending'].includes(String(r.status || ''))),
    [rows]
  );

  const filteredRows = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (['pending', 'Pending'].includes(String(r.status || ''))) return false;
      if (billingFilter === 'centralized' && r.billingType !== 'Centralized') return false;
      if (billingFilter === 'private' && r.billingType === 'Centralized') return false;
      if (!q) return true;
      const hay = [
        r.companyName,
        r.companyId,
        r.contactEmail,
        r.companyEmail,
        r.contactPhone,
        r.subscriptionProductName,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [rows, search, billingFilter]);

  function providerNameForProduct(product) {
    if (!product || typeof product !== 'object') return '—';
    return (
      product.providerName
      || product.vendorName
      || product.provider?.vendorName
      || product.provider?.name
      || '—'
    );
  }

  function getOrganizationProductRows(orgRow) {
    const productById = new Map((products || []).map((p) => [String(p.id || p._id || ''), p]));
    const rowsOut = [];

    const customRows = Array.isArray(orgRow?.customPricing) ? orgRow.customPricing : [];
    if (customRows.length) {
      customRows.forEach((line) => {
        const product = productById.get(String(line.productId || ''));
        rowsOut.push({
          productName: String(product?.productName || product?.name || '—'),
          sku: String(product?.sku || '—'),
          providerName: providerNameForProduct(product),
          catalogPrice: Number(product?.retailPrice || 0),
          salePrice: Number(line.memberPrice || 0),
        });
      });
      return rowsOut;
    }

    if (orgRow?.singleProductId) {
      const product = productById.get(String(orgRow.singleProductId || ''));
      if (product) {
        rowsOut.push({
          productName: String(product.productName || product.name || '—'),
          sku: String(product.sku || '—'),
          providerName: providerNameForProduct(product),
          catalogPrice: Number(product.retailPrice || 0),
          salePrice: Number(orgRow.monthlyPricePerMember || product.retailPrice || 0),
        });
      }
      return rowsOut;
    }

    if (orgRow?.priceListId) {
      const list = (priceLists || []).find((pl) => String(pl.id || '') === String(orgRow.priceListId || ''));
      const lines = Array.isArray(list?.lines) ? list.lines : [];
      lines.forEach((line) => {
        const product = productById.get(String(line.productId || ''));
        rowsOut.push({
          productName: String(line.productName || product?.productName || product?.name || '—'),
          sku: String(line.sku || product?.sku || '—'),
          providerName: providerNameForProduct(product),
          catalogPrice: Number(line.retailPrice || product?.retailPrice || 0),
          salePrice: Number(orgRow.monthlyPricePerMember || line.retailPrice || product?.retailPrice || 0),
        });
      });
      return rowsOut;
    }

    if (orgRow?.subscriptionProductName) {
      const product = (products || []).find((p) => String(p.productName || p.name || '').trim() === String(orgRow.subscriptionProductName || '').trim());
      rowsOut.push({
        productName: String(orgRow.subscriptionProductName || '—'),
        sku: String(product?.sku || '—'),
        providerName: providerNameForProduct(product),
        catalogPrice: Number(product?.retailPrice || 0),
        salePrice: Number(orgRow.monthlyPricePerMember || product?.retailPrice || 0),
      });
    }

    return rowsOut;
  }

  function toggleOrgExpand(orgId) {
    setExpandedOrgRows((prev) => ({ ...prev, [orgId]: !prev[orgId] }));
  }

  useEffect(() => {
    const editId = String(searchParams.get('editId') || '').trim();
    const deepSearch = String(searchParams.get('search') || '').trim().toLowerCase();
    if (!rows.length) return;
    if (!editId && !deepSearch) return;
    const target =
      rows.find((r) => String(r.id || '') === editId) ||
      rows.find((r) => String(r.companyName || '').toLowerCase().includes(deepSearch));
    if (!target) return;
    setEditTab('org');
    setEditOrg({
      ...emptyForm(),
      ...target,
      pricingMethod: Array.isArray(target.customPricing) && target.customPricing.length ? 'custom' : target.singleProductId ? 'singleProduct' : 'priceList',
      singleProductId: target.singleProductId || '',
      billingType: target.billingType || (target.billingMethod?.includes('מרוכז') ? 'Centralized' : 'Private'),
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('editId');
      return next;
    }, { replace: true });
  }, [rows, searchParams, setSearchParams]);

  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <ConfirmDialog
        open={!!deleteOrg}
        title="מחיקת ארגון"
        message={deleteOrg ? `להפוך את "${deleteOrg.companyName}" ללא פעיל? פעולה זו תעביר את המידע לארכיון.` : ''}
        confirmLabel="הפוך ללא פעיל"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOrg(null)}
        isLoading={loading}
      />
      <ConfirmDialog
        open={billingEditConfirmOpen}
        title="שינוי סוג חיוב"
        message="שינוי סוג החיוב עלול לשבש את נתוני הלקוחות שכבר משויכים לארגון ושילמו בפועל. אם נדרש תמחור או מודל שונה, מומלץ להקים ארגון חדש במערכת."
        confirmLabel="אישור"
        onConfirm={() => {
          if (!billingEditPending) return;
          const v = billingEditPending.next;
          setEditOrg((p) =>
            p
              ? {
                  ...p,
                  billingType: v,
                  billingMethod: v === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
                }
              : p
          );
          setBillingEditConfirmOpen(false);
          setBillingEditPending(null);
        }}
        onCancel={() => {
          setBillingEditConfirmOpen(false);
          setBillingEditPending(null);
        }}
        isLoading={false}
      />

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right w-full">ארגון חדש</DialogTitle>
            <DialogDescription className="text-right w-full">פרטי ארגון, אנשי קשר וצורת חיוב</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <Tabs value={addTab} onValueChange={setAddTab} dir="rtl">
              <TabsList className="grid w-full grid-cols-3" dir="rtl">
                <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                <TabsTrigger value="billing">תמחור מוצרים</TabsTrigger>
              </TabsList>
              <TabsContent value="org" className="mt-4 text-right w-full" dir="rtl">
                <FieldGroup>
                  <Field>
                    <FieldLabel className="text-right w-full">שם חברה *</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.companyName} onChange={(e) => setAddForm((p) => ({ ...p, companyName: e.target.value }))} required />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">ח.פ</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.companyId} onChange={(e) => setAddForm((p) => ({ ...p, companyId: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">כתובת רשמית</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.officialAddress} onChange={(e) => setAddForm((p) => ({ ...p, officialAddress: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">אימייל חברה</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.companyEmail} onChange={(e) => setAddForm((p) => ({ ...p, companyEmail: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">אימייל ליצירת קשר</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.contactEmail} onChange={(e) => setAddForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">טלפון ליצירת קשר</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.contactPhone} onChange={(e) => setAddForm((p) => ({ ...p, contactPhone: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">מייל לאישור עובדים (HR)</FieldLabel>
                    <Input dir="rtl" className="text-right" type="email" value={addForm.employeeApprovalEmail} onChange={(e) => setAddForm((p) => ({ ...p, employeeApprovalEmail: e.target.value }))} placeholder="לשליחת בקשות אישור עובדים חדשים" />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">הערות</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">תחום פעילות</FieldLabel>
                    <Input dir="rtl" className="text-right" value={addForm.fieldOfActivity} onChange={(e) => setAddForm((p) => ({ ...p, fieldOfActivity: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">מספר עובדים</FieldLabel>
                    <Input dir="rtl" className="text-right" type="number" value={addForm.employeesCount} onChange={(e) => setAddForm((p) => ({ ...p, employeesCount: e.target.value }))} />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="contacts" className="mt-4 space-y-5">
                <ContactSection title="איש קשר ראשי" data={addForm.contactPerson} onChange={(f, v) => setContact('add', 'contactPerson', f, v)} />
                <ContactSection title="הנהלת חשבונות" data={addForm.accounting} onChange={(f, v) => setContact('add', 'accounting', f, v)} />
                <ContactSection title="איש קשר נוסף" data={addForm.additionalContact} onChange={(f, v) => setContact('add', 'additionalContact', f, v)} />
              </TabsContent>
              <TabsContent value="billing" className="mt-4 text-right w-full" dir="rtl">
                <FieldGroup>
                  <Field>
                    <FieldLabel className="text-right w-full">סוג חיוב</FieldLabel>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={addForm.billingType}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          billingType: e.target.value,
                          billingMethod:
                            e.target.value === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
                        }))
                      }
                    >
                      <option value="Private">תשלום פרטי (הנחת ארגון — קישור /register)</option>
                      <option value="Centralized">תשלום מרוכז (יבוא עובדים)</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">מחיר חודשי לחבר (₪)</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      value={addForm.monthlyPricePerMember}
                      onChange={(e) => setAddForm((p) => ({ ...p, monthlyPricePerMember: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">שם מוצר לחברים (דוחות)</FieldLabel>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={addForm.subscriptionProductName}
                      onChange={(e) => setAddForm((p) => ({ ...p, subscriptionProductName: e.target.value }))}
                    >
                      <option value="">בחר מוצר</option>
                      {products.map((pr) => {
                        const name = String(pr.productName || pr.name || '').trim();
                        if (!name) return null;
                        return (
                          <option key={pr.id || pr._id || name} value={name}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel className="text-right w-full">שיטת תמחור לארגון</FieldLabel>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={addForm.pricingMethod}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, pricingMethod: e.target.value }))
                      }
                    >
                      <option value="priceList">מחירון קיים</option>
                      <option value="singleProduct">מוצר בודד</option>
                      <option value="custom">תמחור מותאם לארגון</option>
                    </select>
                  </Field>
                  {addForm.pricingMethod === 'priceList' ? (
                    <Field>
                      <FieldLabel className="text-right w-full">בחר מחירון קיים</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={addForm.priceListId || ''}
                        onChange={(e) => setAddForm((p) => ({ ...p, priceListId: e.target.value }))}
                      >
                        <option value="">ללא</option>
                        {priceLists.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.listName}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : addForm.pricingMethod === 'singleProduct' ? (
                    <Field>
                      <FieldLabel className="text-right w-full">בחר מוצר בודד</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={addForm.singleProductId || ''}
                        onChange={(e) => setAddForm((p) => ({ ...p, singleProductId: e.target.value }))}
                      >
                        <option value="">ללא</option>
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>{pr.productName || pr.name}</option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="col-span-full space-y-2">
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-right w-full">מחיר מותאם למוצר</FieldLabel>
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => addCustomPricingRow('add')}>
                          + הוסף מוצר
                        </Button>
                      </div>
                      {(addForm.customPricing || []).map((row, idx) => (
                        <div key={`add-cp-${idx}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border rounded p-2">
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={row.productId || ''}
                            onChange={(e) => updateCustomPricingRow('add', idx, 'productId', e.target.value)}
                          >
                            <option value="">בחר מוצר</option>
                            {products.map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.productName || pr.name}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            value={row.memberPrice ?? ''}
                            onChange={(e) => updateCustomPricingRow('add', idx, 'memberPrice', e.target.value)}
                            placeholder="מחיר חבר"
                          />
                          <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeCustomPricingRow('add', idx)}>
                            הסר
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </FieldGroup>
              </TabsContent>
            </Tabs>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>ביטול</Button>
              <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right w-full">עריכת ארגון</DialogTitle>
            <DialogDescription className="text-right w-full">עדכנו פרטים, אנשי קשר וחיוב</DialogDescription>
          </DialogHeader>
          {editOrg ? (
            <>
              {/* ── Registration links panel ── */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">קישורי הרשמה לעובדים</p>
                {editOrg.billingType === 'Centralized' ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">קישור הרשמה עצמית (תשלום מרוכז):</p>
                    <div className="flex items-start gap-2">
                      <a
                        href={`${window.location.origin}/org-employee-register?orgId=${editOrg.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline break-all leading-relaxed flex-1"
                      >
                        {`${window.location.origin}/org-employee-register?orgId=${editOrg.id}`}
                      </a>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 mt-0.5"
                        onClick={() => copyLink(`${window.location.origin}/org-employee-register?orgId=${editOrg.id}`)}
                        title="העתק קישור"
                      >
                        {copiedLink === `${window.location.origin}/org-employee-register?orgId=${editOrg.id}`
                          ? <Check className="size-3.5 text-emerald-600" />
                          : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">קישור הרשמה בהנחת ארגון (תשלום פרטי):</p>
                    <div className="flex items-start gap-2">
                      <a
                        href={`${window.location.origin}/register?orgId=${editOrg.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline break-all leading-relaxed flex-1"
                      >
                        {`${window.location.origin}/register?orgId=${editOrg.id}`}
                      </a>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 mt-0.5"
                        onClick={() => copyLink(`${window.location.origin}/register?orgId=${editOrg.id}`)}
                        title="העתק קישור"
                      >
                        {copiedLink === `${window.location.origin}/register?orgId=${editOrg.id}`
                          ? <Check className="size-3.5 text-emerald-600" />
                          : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={saveEdit} className="space-y-4">
              <Tabs value={editTab} onValueChange={setEditTab} dir="rtl">
                <TabsList className="grid w-full grid-cols-3" dir="rtl">
                  <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                  <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                  <TabsTrigger value="billing">תמחור מוצרים</TabsTrigger>
                </TabsList>
                <TabsContent value="org" className="mt-4 text-right w-full" dir="rtl">
                  <FieldGroup>
                    <Field><FieldLabel className="text-right w-full">שם חברה *</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.companyName || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyName: e.target.value }))} required /></Field>
                    <Field><FieldLabel className="text-right w-full">ח.פ</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.companyId || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">כתובת רשמית</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.officialAddress || ''} onChange={(e) => setEditOrg((p) => ({ ...p, officialAddress: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">אימייל חברה</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.companyEmail || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyEmail: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">אימייל ליצירת קשר</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.contactEmail || ''} onChange={(e) => setEditOrg((p) => ({ ...p, contactEmail: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">טלפון ליצירת קשר</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.contactPhone || ''} onChange={(e) => setEditOrg((p) => ({ ...p, contactPhone: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">מייל לאישור עובדים (HR)</FieldLabel><Input dir="rtl" className="text-right" type="email" value={editOrg.employeeApprovalEmail || ''} onChange={(e) => setEditOrg((p) => ({ ...p, employeeApprovalEmail: e.target.value }))} placeholder="לשליחת בקשות אישור עובדים חדשים" /></Field>
                    <Field><FieldLabel className="text-right w-full">הערות</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.notes || ''} onChange={(e) => setEditOrg((p) => ({ ...p, notes: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">תחום פעילות</FieldLabel><Input dir="rtl" className="text-right" value={editOrg.fieldOfActivity || ''} onChange={(e) => setEditOrg((p) => ({ ...p, fieldOfActivity: e.target.value }))} /></Field>
                    <Field><FieldLabel className="text-right w-full">מספר עובדים</FieldLabel><Input dir="rtl" className="text-right" type="number" value={editOrg.employeesCount || ''} onChange={(e) => setEditOrg((p) => ({ ...p, employeesCount: e.target.value }))} /></Field>
                    <Field>
                      <FieldLabel className="text-right w-full">סטטוס ארגון</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editOrg.status || 'active'}
                        onChange={(e) => setEditOrg((p) => ({ ...p, status: e.target.value }))}
                      >
                        <option value="Pending">ממתין לאישור</option>
                        <option value="Lead">ליד</option>
                        <option value="active">פעיל</option>
                      </select>
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="contacts" className="mt-4 space-y-5">
                  <ContactSection title="איש קשר ראשי" data={editOrg.contactPerson || {}} onChange={(f, v) => setContact('edit', 'contactPerson', f, v)} />
                  <ContactSection title="הנהלת חשבונות" data={editOrg.accounting || {}} onChange={(f, v) => setContact('edit', 'accounting', f, v)} />
                  <ContactSection title="איש קשר נוסף" data={editOrg.additionalContact || {}} onChange={(f, v) => setContact('edit', 'additionalContact', f, v)} />
                </TabsContent>
                <TabsContent value="billing" className="mt-4 text-right w-full" dir="rtl">
                  <FieldGroup>
                    <Field>
                      <FieldLabel className="text-right w-full">סוג חיוב</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editOrg.billingType === 'Centralized' ? 'Centralized' : 'Private'}
                        onChange={(e) => {
                          const v = e.target.value;
                          const prev = editOrg.billingType === 'Centralized' ? 'Centralized' : 'Private';
                          if (v === prev) return;
                          setBillingEditPending({ next: v, prev });
                          setBillingEditConfirmOpen(true);
                        }}
                      >
                        <option value="Private">תשלום פרטי (הנחת ארגון)</option>
                        <option value="Centralized">תשלום מרוכז</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel className="text-right w-full">מחיר חודשי לחבר (₪)</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        dir="ltr"
                        value={editOrg.monthlyPricePerMember ?? ''}
                        onChange={(e) => setEditOrg((p) => ({ ...p, monthlyPricePerMember: e.target.value }))}
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="text-right w-full">שם מוצר לחברים (דוחות)</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editOrg.subscriptionProductName || ''}
                        onChange={(e) => setEditOrg((p) => ({ ...p, subscriptionProductName: e.target.value }))}
                      >
                        <option value="">בחר מוצר</option>
                        {products.map((pr) => {
                          const name = String(pr.productName || pr.name || '').trim();
                          if (!name) return null;
                          return (
                            <option key={pr.id || pr._id || name} value={name}>
                              {name}
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel className="text-right w-full">שיטת תמחור לארגון</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editOrg.pricingMethod || 'priceList'}
                        onChange={(e) =>
                          setEditOrg((p) =>
                            p ? { ...p, pricingMethod: e.target.value } : p
                          )
                        }
                      >
                        <option value="priceList">מחירון קיים</option>
                        <option value="singleProduct">מוצר בודד</option>
                        <option value="custom">תמחור מותאם לארגון</option>
                      </select>
                    </Field>
                    {(editOrg.pricingMethod || 'priceList') === 'priceList' ? (
                      <Field>
                        <FieldLabel className="text-right w-full">בחר מחירון קיים</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={editOrg.priceListId || ''}
                          onChange={(e) => setEditOrg((p) => (p ? { ...p, priceListId: e.target.value } : p))}
                        >
                          <option value="">ללא</option>
                          {priceLists.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.listName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : editOrg.pricingMethod === 'singleProduct' ? (
                      <Field>
                        <FieldLabel className="text-right w-full">בחר מוצר בודד</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={editOrg.singleProductId || ''}
                          onChange={(e) => setEditOrg((p) => (p ? { ...p, singleProductId: e.target.value } : p))}
                        >
                          <option value="">ללא</option>
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>{pr.productName || pr.name}</option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <div className="col-span-full space-y-2">
                        <div className="flex items-center justify-between">
                          <FieldLabel className="text-right w-full">מחיר מותאם למוצר</FieldLabel>
                          <Button type="button" variant="link" className="h-auto p-0" onClick={() => addCustomPricingRow('edit')}>
                            + הוסף מוצר
                          </Button>
                        </div>
                        {(editOrg.customPricing || []).map((row, idx) => (
                          <div key={`edit-cp-${idx}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border rounded p-2">
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                              value={row.productId || ''}
                              onChange={(e) => updateCustomPricingRow('edit', idx, 'productId', e.target.value)}
                            >
                              <option value="">בחר מוצר</option>
                              {products.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.productName || pr.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              dir="ltr"
                              value={row.memberPrice ?? ''}
                              onChange={(e) => updateCustomPricingRow('edit', idx, 'memberPrice', e.target.value)}
                              placeholder="מחיר חבר"
                            />
                            <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeCustomPricingRow('edit', idx)}>
                              הסר
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </FieldGroup>
                </TabsContent>
              </Tabs>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditOrg(null)}>ביטול</Button>
                <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
              </DialogFooter>
            </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" />
              מרכז ניהול ארגונים אופאל
            </h1>
            <p className="text-muted-foreground">אופאל — ארגונים, חברים פעילים, יבוא והרשמה</p>
          </div>
          {activeMainTab === 'orgs' && (
            <Button onClick={openAdd}><Plus className="size-4 me-2" />הוסף ארגון</Button>
          )}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <p className="text-sm text-muted-foreground">
          טופס ציבורי להצטרפות ארגון זמין ב־<Link className="text-primary underline" to="/organization-join-request">/organization-join-request</Link>
        </p>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} dir="rtl">
          <TabsList>
            <TabsTrigger value="orgs">ארגונים ({filteredRows.length})</TabsTrigger>
            <TabsTrigger value="applications">
              בקשות הצטרפות
              {pendingRows.length > 0 && (
                <Badge className="me-1.5 bg-amber-500 text-white text-xs px-1.5 py-0">
                  {pendingRows.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Active organizations tab ── */}
          <TabsContent value="orgs" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש חופשי: ארגון, ח.פ, אימייל, טלפון, מוצר"
                  />
                  <select
                    className="flex h-10 min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={billingFilter}
                    onChange={(e) => setBillingFilter(e.target.value)}
                  >
                    <option value="all">כל סוגי החיוב</option>
                    <option value="centralized">חיוב מרוכז</option>
                    <option value="private">חיוב פרטי</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>רשימת ארגונים</CardTitle>
                <CardDescription>
                  {filteredRows.length} ארגונים פעילים
                  <Button variant="link" className="px-2 h-auto font-normal text-primary" type="button" onClick={loadRows}>
                    רענון
                  </Button>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredRows.length === 0 && !loading ? (
                  <Empty>
                    <EmptyMedia variant="icon"><Building2 className="size-8" /></EmptyMedia>
                    <EmptyTitle>אין ארגונים</EmptyTitle>
                    <EmptyDescription>הוסיפו ארגון ראשון כדי להתחיל ניהול מרוכז</EmptyDescription>
                    <Button className="mt-4" type="button" onClick={openAdd}><Plus className="size-4 me-2" />הוסף ארגון חדש</Button>
                  </Empty>
                ) : (
                  <div className="overflow-x-auto rounded-md border" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead className="w-10" />
                          <TableHead>שם חברה</TableHead>
                          <TableHead>ח.פ</TableHead>
                          <TableHead>סוג חיוב</TableHead>
                          <TableHead>חברים</TableHead>
                          <TableHead>מחיר לחבר</TableHead>
                          <TableHead>אימייל</TableHead>
                          <TableHead className="w-40">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((r) => {
                          const isExpanded = !!expandedOrgRows[r.id];
                          const orgProducts = getOrganizationProductRows(r);
                          return (
                            <React.Fragment key={r.id}>
                              <TableRow>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="size-8"
                                    onClick={() => toggleOrgExpand(r.id)}
                                    aria-label={isExpanded ? 'כווץ פרטי מוצרים' : 'הרחב פרטי מוצרים'}
                                  >
                                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">{r.companyName || '—'}</TableCell>
                                <TableCell>{r.companyId || '—'}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {r.billingType === 'Centralized' ? 'מרוכז' : 'פרטי'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{r.activeMemberCount ?? 0}</TableCell>
                                <TableCell dir="ltr">
                                  {r.monthlyPricePerMember != null && Number(r.monthlyPricePerMember) > 0
                                    ? `₪${Number(r.monthlyPricePerMember)}`
                                    : '—'}
                                </TableCell>
                                <TableCell dir="ltr" className="text-start text-sm">
                                  {r.contactEmail || r.companyEmail || '—'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Button variant="outline" size="sm" type="button" asChild>
                                      <Link to={`/admin/organizations/${encodeURIComponent(r.id)}`}>פרופיל</Link>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      type="button"
                                      onClick={() => {
                                        setEditTab('org');
                                        setEditOrg({
                                          ...emptyForm(),
                                          ...r,
                                          pricingMethod: Array.isArray(r.customPricing) && r.customPricing.length ? 'custom' : 'priceList',
                                          billingType: r.billingType || (r.billingMethod?.includes('מרוכז') ? 'Centralized' : 'Private'),
                                        });
                                      }}
                                    >
                                      <Edit2 className="size-4" />
                                    </Button>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" type="button" onClick={() => setDeleteOrg(r)} aria-label="הפוך ללא פעיל">
                                          <Archive className="size-4 text-destructive" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>הפוך ללא פעיל</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded ? (
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableCell colSpan={8} className="p-4" dir="rtl">
                                    <div className="space-y-2 text-right">
                                      <p className="text-sm font-semibold">סיכום מוצרים בארגון</p>
                                      {orgProducts.length ? (
                                        <div className="overflow-x-auto rounded-md border bg-background">
                                          <Table className="text-right">
                                            <TableHeader>
                                              <TableRow className="[&_th]:text-right">
                                                <TableHead>שם המוצר</TableHead>
                                                <TableHead>מק&quot;ט</TableHead>
                                                <TableHead>שם הספק</TableHead>
                                                <TableHead>מחיר מחירון</TableHead>
                                                <TableHead>מחיר מבצע</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {orgProducts.map((p, idx) => (
                                                <TableRow key={`${r.id}-product-${idx}`}>
                                                  <TableCell>{p.productName || '—'}</TableCell>
                                                  <TableCell>{p.sku || '—'}</TableCell>
                                                  <TableCell>{p.providerName || '—'}</TableCell>
                                                  <TableCell>{Number(p.catalogPrice || 0).toLocaleString('he-IL')} ₪</TableCell>
                                                  <TableCell>{Number(p.salePrice || 0).toLocaleString('he-IL')} ₪</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">אין פרטי מוצרים להצגה עבור ארגון זה.</p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {loading && rows.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pending applications tab ── */}
          <TabsContent value="applications" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">בקשות הצטרפות ממתינות לאישור</CardTitle>
                <CardDescription>{pendingRows.length} בקשות</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRows.length === 0 ? (
                  <Empty>
                    <EmptyMedia variant="icon"><Building2 className="size-8" /></EmptyMedia>
                    <EmptyTitle>אין בקשות ממתינות</EmptyTitle>
                    <EmptyDescription>בקשות שנשלחו דרך טופס ההצטרפות יופיעו כאן</EmptyDescription>
                  </Empty>
                ) : (
                  <div className="overflow-x-auto rounded-md border" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead>שם חברה</TableHead>
                          <TableHead>ח.פ</TableHead>
                          <TableHead>סוג חיוב</TableHead>
                          <TableHead>אימייל</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead className="w-40">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.companyName || '—'}</TableCell>
                            <TableCell>{r.companyId || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {r.billingType === 'Centralized' ? 'מרוכז' : 'פרטי'}
                              </Badge>
                            </TableCell>
                            <TableCell dir="ltr" className="text-start text-sm">
                              {r.contactEmail || r.companyEmail || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">ממתין לאישור</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  disabled={approvingId === r.id}
                                  onClick={() => approveOrg(r.id)}
                                >
                                  {approvingId === r.id ? '…' : 'אשר ארגון'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  onClick={() => {
                                    setEditTab('org');
                                    setEditOrg({
                                      ...emptyForm(),
                                      ...r,
                                      pricingMethod: Array.isArray(r.customPricing) && r.customPricing.length ? 'custom' : 'priceList',
                                      billingType: r.billingType || 'Private',
                                    });
                                  }}
                                >
                                  <Edit2 className="size-4" />
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => setDeleteOrg(r)} aria-label="דחה">
                                      <Archive className="size-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>דחה / ארכיון</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
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

function ContactSection({ title, data, onChange }) {
  return (
    <div className="space-y-3 border rounded-lg p-3 text-right" dir="rtl">
      <p className="font-medium text-sm">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel>שם</FieldLabel><Input dir="rtl" className="text-right" value={data?.name || ''} onChange={(e) => onChange('name', e.target.value)} /></Field>
        <Field><FieldLabel>תפקיד</FieldLabel><Input dir="rtl" className="text-right" value={data?.role || ''} onChange={(e) => onChange('role', e.target.value)} /></Field>
        <Field><FieldLabel>טלפון</FieldLabel><Input dir="rtl" className="text-right" value={data?.phone || ''} onChange={(e) => onChange('phone', e.target.value)} /></Field>
        <Field><FieldLabel>נייד</FieldLabel><Input dir="rtl" className="text-right" value={data?.mobile || ''} onChange={(e) => onChange('mobile', e.target.value)} /></Field>
        <Field className="sm:col-span-2"><FieldLabel>אימייל</FieldLabel><Input dir="rtl" className="text-right" value={data?.email || ''} onChange={(e) => onChange('email', e.target.value)} /></Field>
      </div>
    </div>
  );
}
