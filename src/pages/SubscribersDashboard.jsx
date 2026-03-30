import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  TrendingUp,
  Receipt,
  Users,
  Calendar,
  Edit2,
  Trash2,
  Download,
  Eye,
  Ban,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
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
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

const SUMMARY_ITEMS = [
  { key: 'all', label: 'הכל' },
  { key: 'primary', label: 'לקוחות עיקריים' },
  { key: 'active', label: 'לקוחות פעילים (עיקרי + משניים)' },
  { key: 'canceled', label: 'לקוחות מבוטלים' },
  { key: 'private_org', label: 'ארגונים ששילמו באופן פרטי' },
  { key: 'centralized_org', label: 'ארגונים בתשלום מרוכז' },
  { key: 'centralized_canceled', label: 'ביטולים בתשלום מרוכז' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'success', label: 'הצלחה' },
  { value: 'paid', label: 'שולם' },
  { value: 'pending', label: 'ממתין' },
  { value: 'failed', label: 'נכשל' },
  { value: 'canceled', label: 'בוטל' },
];

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

const checkboxClass = 'h-4 w-4 rounded border border-input bg-background text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const emptyEditForm = () => ({
  fullName: '',
  phone: '',
  email: '',
  idNum: '',
  organizationName: '',
  agentName: '',
  productName: '',
  payerAmount: '',
  paymentStatus: 'success',
});

export default function SubscribersDashboard() {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDealId, setEditDealId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [data, setData] = useState({
    summary: {},
    searchResults: {},
    filterOptions: { providers: [], agents: [] },
    rows: [],
  });

  const [filters, setFilters] = useState({
    month: '',
    fromDate: '',
    toDate: '',
    providerEnabled: false,
    providerValue: '',
    providerSearchEnabled: false,
    providerSearch: '',
    agentEnabled: false,
    agentValue: '',
    agentSearchEnabled: false,
    agentSearch: '',
    amountDue: '',
    organizationSearch: '',
    customerSearch: '',
    idSearch: '',
    productNameSearch: '',
    agentNameSearch: '',
    summaryCategories: [],
  });

  const filteredProviders = useMemo(() => {
    if (!filters.providerSearchEnabled || !filters.providerSearch.trim()) return data.filterOptions.providers || [];
    const q = filters.providerSearch.trim().toLowerCase();
    return (data.filterOptions.providers || []).filter((x) => String(x).toLowerCase().includes(q));
  }, [data.filterOptions.providers, filters.providerSearchEnabled, filters.providerSearch]);

  const filteredAgents = useMemo(() => {
    if (!filters.agentSearchEnabled || !filters.agentSearch.trim()) return data.filterOptions.agents || [];
    const q = filters.agentSearch.trim().toLowerCase();
    return (data.filterOptions.agents || []).filter((x) => String(x).toLowerCase().includes(q));
  }, [data.filterOptions.agents, filters.agentSearchEnabled, filters.agentSearch]);

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.month ||
      !!filters.fromDate ||
      !!filters.toDate ||
      filters.providerEnabled ||
      !!filters.providerValue ||
      filters.providerSearchEnabled ||
      !!filters.providerSearch.trim() ||
      filters.agentEnabled ||
      !!filters.agentValue ||
      filters.agentSearchEnabled ||
      !!filters.agentSearch.trim() ||
      !!filters.amountDue ||
      !!filters.organizationSearch.trim() ||
      !!filters.customerSearch.trim() ||
      !!filters.idSearch.trim() ||
      !!filters.productNameSearch.trim() ||
      !!filters.agentNameSearch.trim() ||
      (filters.summaryCategories || []).length > 0
    );
  }, [filters]);

  async function loadDashboard() {
    if (!token) {
      setError('נדרשת התחברות אדמין. היכנס/י דרך /admin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        month: filters.month || '',
        fromDate: filters.fromDate || '',
        toDate: filters.toDate || '',
        providerEnabled: String(!!filters.providerEnabled),
        providerValue: filters.providerValue || '',
        agentEnabled: String(!!filters.agentEnabled),
        agentValue: filters.agentValue || '',
        organizationSearch: filters.organizationSearch || '',
        customerSearch: filters.customerSearch || '',
        idSearch: filters.idSearch || '',
        productNameSearch: filters.productNameSearch || '',
        agentNameSearch: filters.agentNameSearch || '',
        amountDue: filters.amountDue || '0',
        summaryCategories: (filters.summaryCategories || []).join(','),
      });

      const res = await fetch(`${API_BASE}/api/admin/subscribers-dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'טעינת דשבורד נכשלה');
      }
      setData({
        summary: json.summary || {},
        searchResults: json.searchResults || {},
        filterOptions: json.filterOptions || { providers: [], agents: [] },
        rows: Array.isArray(json.rows) ? json.rows : [],
      });
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSummaryCategory(key) {
    setFilters((prev) => {
      const has = prev.summaryCategories.includes(key);
      return {
        ...prev,
        summaryCategories: has ? prev.summaryCategories.filter((x) => x !== key) : [...prev.summaryCategories, key],
      };
    });
  }

  function openEdit(row) {
    const fs = row.raw?.formState || {};
    setEditDealId(row.id);
    setEditForm({
      fullName: fs.fullName || row.fullName || '',
      phone: fs.phone || '',
      email: fs.email || '',
      idNum: fs.id || row.idNumber || '',
      organizationName: fs.organizationName || row.organizationName || '',
      agentName: fs.agentName || row.agentName || '',
      productName: fs.productName || row.productName || '',
      payerAmount: String(row.amount ?? ''),
      paymentStatus: String(row.raw?.paymentStatus || row.paymentStatus || 'success'),
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editDealId || !token) return;
    setSaveLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(editDealId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          formState: {
            fullName: editForm.fullName,
            phone: editForm.phone,
            email: editForm.email,
            id: editForm.idNum,
            organizationName: editForm.organizationName,
            agentName: editForm.agentName,
            productName: editForm.productName,
          },
          payerAmount: editForm.payerAmount,
          paymentStatus: editForm.paymentStatus,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'שמירה נכשלה');
      setEditOpen(false);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setSaveLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || !token) return;
    setDeleteLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'מחיקה נכשלה');
      setDeleteTarget(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmCancelFutureCharges() {
    if (!cancelTarget?.id || !token) return;
    setCancelLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(cancelTarget.id)}/cancel-future-charges`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'ביטול חיוב עתידי נכשל');
      setCancelTarget(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setCancelLoading(false);
    }
  }

  function clearFilters() {
    setFilters((p) => ({
      ...p,
      month: '',
      fromDate: '',
      toDate: '',
      providerEnabled: false,
      providerValue: '',
      providerSearchEnabled: false,
      providerSearch: '',
      agentEnabled: false,
      agentValue: '',
      agentSearchEnabled: false,
      agentSearch: '',
      amountDue: '',
      organizationSearch: '',
      customerSearch: '',
      idSearch: '',
      productNameSearch: '',
      agentNameSearch: '',
      summaryCategories: [],
    }));
  }

  const s = data.summary || {};
  const sr = data.searchResults || {};
  const selectedBeneficiary = selected?.beneficiaryUpdate || {};
  const formState = selected?.formState || {};
  const selectedPrimaryFromUpdate = selectedBeneficiary?.primaryMember || {};
  const stateBeneficiaries = Array.isArray(formState?.beneficiaries) ? formState.beneficiaries : [];
  const selectedAdditional = Array.isArray(selectedBeneficiary?.additionalMembers)
    ? selectedBeneficiary.additionalMembers
    : stateBeneficiaries;
  const selectedPrimary =
    selectedPrimaryFromUpdate && (selectedPrimaryFromUpdate.firstName || selectedPrimaryFromUpdate.lastName || selectedPrimaryFromUpdate.id)
      ? selectedPrimaryFromUpdate
      : {
          firstName: formState.fullName || '',
          lastName: '',
          id: formState.id || '',
          phone: formState.phone || '',
          email: formState.email || '',
          address: formState.address || '',
          dateOfBirth: formState.dateOfBirth || '',
          maritalStatus: formState.maritalStatus || '',
          healthFund: formState.healthFund || '',
          supplementalInsurance: formState.supplementalInsurance || '',
        };

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPageShell>
        <ConfirmDialog
          open={!!deleteTarget}
          title="מחיקת רשומת עסקה"
          message={
            deleteTarget
              ? `למחוק לצמיתות את העסקה ${deleteTarget.transactionId || deleteTarget.id}? פעולה זו תסיר את הרשומה ממסד הנתונים.`
              : ''
          }
          confirmLabel="מחק"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteLoading}
        />
        <ConfirmDialog
          open={!!cancelTarget}
          title="ביטול מנוי (עצירת חיוב עתידי)"
          message={
            cancelTarget
              ? 'האם את בטוחה שברצונך לבטל את העסקה ולקוח לא יחויב בעתיד? פעולה זו תעצור את כל החיובים העתידיים מול קארדקום החל מהחודש הבא.'
              : ''
          }
          confirmLabel="אישור"
          danger
          onConfirm={confirmCancelFutureCharges}
          onCancel={() => setCancelTarget(null)}
          isLoading={cancelLoading}
        />

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>עריכת עסקה / מנוי</DialogTitle>
              <DialogDescription>עדכון פרטים שנשמרו בעסקה (MongoDB)</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>שם מלא</FieldLabel>
                  <Input value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>טלפון</FieldLabel>
                    <Input dir="ltr" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>אימייל</FieldLabel>
                    <Input
                      type="email"
                      dir="ltr"
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>תעודת זהות</FieldLabel>
                    <Input dir="ltr" value={editForm.idNum} onChange={(e) => setEditForm((p) => ({ ...p, idNum: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>סכום עסקה (₪)</FieldLabel>
                    <Input
                      type="number"
                      dir="ltr"
                      value={editForm.payerAmount}
                      onChange={(e) => setEditForm((p) => ({ ...p, payerAmount: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>שם ארגון</FieldLabel>
                  <Input
                    value={editForm.organizationName}
                    onChange={(e) => setEditForm((p) => ({ ...p, organizationName: e.target.value }))}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>סוכן</FieldLabel>
                    <Input value={editForm.agentName} onChange={(e) => setEditForm((p) => ({ ...p, agentName: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>מוצר (טקסט)</FieldLabel>
                    <Input value={editForm.productName} onChange={(e) => setEditForm((p) => ({ ...p, productName: e.target.value }))} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>סטטוס תשלום</FieldLabel>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editForm.paymentStatus}
                    onChange={(e) => setEditForm((p) => ({ ...p, paymentStatus: e.target.value }))}
                  >
                    {PAYMENT_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </FieldGroup>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit" disabled={saveLoading}>
                  {saveLoading && <Spinner className="me-2" />}
                  שמירה
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>סינון מתקדם</DialogTitle>
              <DialogDescription>כל מסנני הדוח — זהה ללוגיקה הקודמת בשרת</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field>
                  <FieldLabel>חודש</FieldLabel>
                  <Input type="month" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>מתאריך</FieldLabel>
                  <Input type="date" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>עד תאריך</FieldLabel>
                  <Input type="date" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={filters.providerEnabled}
                      onChange={(e) => setFilters((p) => ({ ...p, providerEnabled: e.target.checked }))}
                    />
                    ספק
                  </label>
                  <select
                    value={filters.providerValue}
                    onChange={(e) => setFilters((p) => ({ ...p, providerValue: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">הכל</option>
                    {filteredProviders.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={filters.providerSearchEnabled}
                      onChange={(e) => setFilters((p) => ({ ...p, providerSearchEnabled: e.target.checked }))}
                    />
                    <Input
                      placeholder="הכל / שם"
                      value={filters.providerSearch}
                      onChange={(e) => setFilters((p) => ({ ...p, providerSearch: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={filters.agentEnabled}
                      onChange={(e) => setFilters((p) => ({ ...p, agentEnabled: e.target.checked }))}
                    />
                    סוכן (בדיוק)
                  </label>
                  <select
                    value={filters.agentValue}
                    onChange={(e) => setFilters((p) => ({ ...p, agentValue: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">הכל</option>
                    {filteredAgents.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={filters.agentSearchEnabled}
                      onChange={(e) => setFilters((p) => ({ ...p, agentSearchEnabled: e.target.checked }))}
                    />
                    <Input
                      placeholder="הכל / שם"
                      value={filters.agentSearch}
                      onChange={(e) => setFilters((p) => ({ ...p, agentSearch: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field>
                  <FieldLabel>שם מוצר (מנוי)</FieldLabel>
                  <Input
                    value={filters.productNameSearch}
                    onChange={(e) => setFilters((p) => ({ ...p, productNameSearch: e.target.value }))}
                    placeholder="לפי מוצר בעסקה"
                  />
                </Field>
                <Field>
                  <FieldLabel>שם סוכן (חיפוש חופשי)</FieldLabel>
                  <Input
                    value={filters.agentNameSearch}
                    onChange={(e) => setFilters((p) => ({ ...p, agentNameSearch: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>לתשלום (legacy)</FieldLabel>
                  <Input
                    type="number"
                    dir="ltr"
                    value={filters.amountDue}
                    onChange={(e) => setFilters((p) => ({ ...p, amountDue: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>חיפוש לפי ארגון</FieldLabel>
                  <Input
                    value={filters.organizationSearch}
                    onChange={(e) => setFilters((p) => ({ ...p, organizationSearch: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>חיפוש לפי ת.ז / ח.פ (נפרד)</FieldLabel>
                  <Input value={filters.idSearch} onChange={(e) => setFilters((p) => ({ ...p, idSearch: e.target.value }))} />
                </Field>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  onClick={() => {
                    setFilterDialogOpen(false);
                    loadDashboard();
                  }}
                >
                  החל והצג
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  נקה הכל
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <UserCheck className="size-7 text-primary" />
                מנויים
              </h1>
              <p className="text-muted-foreground">דוח עסקאות — נתונים ממסד (כולל עריכה ומחיקה)</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" disabled title="בקרוב">
                <Download className="size-4 me-2" />
                ייצוא
              </Button>
            </div>
          </div>

          {/* כרטיסי סטטיסטיקה — נתונים אמיתיים מהדוח */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="סה״כ הכנסות" value={formatCurrency(s.totalRevenue || 0)} icon={TrendingUp} loading={loading} />
            <StatsCard title="רווח נקי" value={formatCurrency(s.totalNetProfit || 0)} icon={Receipt} loading={loading} />
            <StatsCard title="עסקאות בתוצאות" value={sr.totalTransactions ?? 0} icon={Users} loading={loading} />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg outline-none">
                  <StatsCard title="מנויים פעילים (סיכום)" value={s.active ?? 0} icon={Calendar} loading={loading} />
                </div>
              </TooltipTrigger>
              <TooltipContent>לפי מסנני הקטגוריות והדוח בשרת</TooltipContent>
            </Tooltip>
          </div>

          {/* שורת חיפוש + סינון */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pe-10"
                    placeholder="חיפוש מהיר: שם לקוח, טקסט חופשי (שדה customerSearch ב-API)…"
                    value={filters.customerSearch}
                    onChange={(e) => setFilters((p) => ({ ...p, customerSearch: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadDashboard();
                    }}
                  />
                </div>
                <Button type="button" onClick={loadDashboard} disabled={loading}>
                  {loading && <Spinner className="me-2" />}
                  הצג בדוח
                </Button>
                <Button type="button" variant="outline" onClick={() => setFilterDialogOpen(true)} className="shrink-0">
                  <Filter className="size-4 me-2" />
                  סינון מתקדם
                  {hasActiveFilters ? (
                    <Badge variant="secondary" className="me-2">
                      פעיל
                    </Badge>
                  ) : null}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                לחיפוש לפי ת.ז או שדות נוספים השתמשו ב&quot;סינון מתקדם&quot;. הלוגיקה נשארה זהה לשרת.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>תוצאות חיפוש (מסכם)</CardTitle>
                <CardDescription>לפי הסינון הנוכחי</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      סה&quot;כ עסקאות: <strong>{sr.totalTransactions || 0}</strong>
                    </div>
                    <div>
                      לקוחות עיקריים: <strong>{sr.totalPrimary || 0}</strong>
                    </div>
                    <div>
                      לקוחות משניים: <strong>{sr.totalSecondary || 0}</strong>
                    </div>
                    <div>
                      מכירות בכסף: <strong>{formatCurrency(sr.totalSalesAmount || 0)}</strong>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">כמות / סנן לפי</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {SUMMARY_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-sm border-b border-border pb-2 last:border-0"
                  >
                    <span>{item.label}</span>
                    <div className="flex items-center gap-2">
                      <strong>{s[item.key] ?? 0}</strong>
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={filters.summaryCategories.includes(item.key)}
                        onChange={() => toggleSummaryCategory(item.key)}
                      />
                    </div>
                  </label>
                ))}
                <div className="pt-2 text-sm border-t">
                  סה&quot;כ בכסף: <strong>{formatCurrency(s.totalRevenue || 0)}</strong>
                </div>
                <Button type="button" variant="secondary" className="w-full mt-2" onClick={loadDashboard} disabled={loading}>
                  עדכן דוח
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>רשימת עסקאות</CardTitle>
              <CardDescription>עריכה ומחיקה — פועלות מול /api/admin/deals/:id</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto">
              {error && !editOpen ? <p className="text-destructive text-sm mb-2">{error}</p> : null}
              {loading ? <p className="text-muted-foreground text-sm mb-2">טוען…</p> : null}
              {data.rows.length === 0 && !loading ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <UserCheck className="size-8" />
                  </EmptyMedia>
                  <EmptyTitle>אין נתונים</EmptyTitle>
                  <EmptyDescription>נסו לשנות חיפוש או סינון מתקדם</EmptyDescription>
                </Empty>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>סטטוס חיוב עתידי</TableHead>
                        <TableHead>מס&apos; הזמנה</TableHead>
                        <TableHead>לקוח</TableHead>
                        <TableHead>ת&quot;ז</TableHead>
                        <TableHead>ארגון</TableHead>
                        <TableHead>סוכן</TableHead>
                        <TableHead>מוצר</TableHead>
                        <TableHead>חבילה</TableHead>
                        <TableHead>סכום</TableHead>
                        <TableHead>עלות ספק</TableHead>
                        <TableHead>עמלת סוכן</TableHead>
                        <TableHead>רווח נקי</TableHead>
                        <TableHead>תאריך</TableHead>
                        <TableHead className="w-28">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        (() => {
                          const isCancelled = r.status === 'canceled' || String(r.subscriptionStatus || '').toLowerCase() === 'cancelled';
                          const missingInternalDealNumber = !String(r.internalDealNumber || '').trim();
                          const cancelledAtText = r.cancellationDate
                            ? new Date(r.cancellationDate).toLocaleString('he-IL')
                            : '';
                          return (
                        <TableRow
                          key={r.id}
                          className={
                            r.pendingBeneficiaryCompletion
                              ? 'bg-orange-50/90 dark:bg-orange-950/35 border-orange-200/80'
                              : undefined
                          }
                        >
                          <TableCell>
                            {r.pendingBeneficiaryCompletion ? (
                              <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">
                                ממתין להשלמת מסמכים
                              </Badge>
                            ) : (
                              <Badge variant={isCancelled ? 'destructive' : 'default'}>
                                {isCancelled ? 'Cancelled' : 'שולם'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isCancelled ? (
                              <Badge variant="destructive" className="font-normal">
                                {`בוטל מול קארדקום${cancelledAtText ? ` ב-${cancelledAtText}` : ''}`}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">פעיל</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.transactionId}</TableCell>
                          <TableCell>{r.fullName || '-'}</TableCell>
                          <TableCell dir="ltr" className="text-start">
                            {r.idNumber || '-'}
                          </TableCell>
                          <TableCell>{r.organizationName || '-'}</TableCell>
                          <TableCell>{r.agentName || '-'}</TableCell>
                          <TableCell>{r.productName || '—'}</TableCell>
                          <TableCell>{r.planType || '-'}</TableCell>
                          <TableCell>{formatCurrency(r.amount)}</TableCell>
                          <TableCell>{formatCurrency(r.vendorCost)}</TableCell>
                          <TableCell>{formatCurrency(r.agentCommission)}</TableCell>
                          <TableCell className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(r.netProfit)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" type="button" onClick={() => setSelected(r.raw ?? r)} aria-label="הצג פרטים">
                                    <Eye className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>הצג פרטים</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(r)} aria-label="ערוך">
                                    <Edit2 className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>עריכה</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => setDeleteTarget({ id: r.id, transactionId: r.transactionId })}
                                    aria-label="מחק"
                                  >
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>מחיקה</TooltipContent>
                              </Tooltip>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={isCancelled || missingInternalDealNumber}
                                onClick={() =>
                                  setCancelTarget({
                                    id: r.id,
                                    transactionId: r.transactionId,
                                  })
                                }
                                title={
                                  missingInternalDealNumber ? 'Cannot cancel: Missing Cardcom Internal Deal Number' : undefined
                                }
                              >
                                <Ban className="size-3.5 me-1 text-amber-600" />
                                ביטול מנוי (עצירת חיוב עתידי)
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                          );
                        })()
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>סיכום רווח (עקבי במערכת)</CardTitle>
              <CardDescription>רווח נקי = הכנסה − עלות ספק − עמלת סוכן</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="border rounded-lg p-3">
                  סה&quot;כ עלויות ספק: <strong>{formatCurrency(s.totalVendorCost || 0)}</strong>
                </div>
                <div className="border rounded-lg p-3">
                  סה&quot;כ עמלות סוכנים: <strong>{formatCurrency(s.totalAgentCommission || 0)}</strong>
                </div>
                <div className="border rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30">
                  סה&quot;כ רווח נקי: <strong>{formatCurrency(s.totalNetProfit || 0)}</strong>
                </div>
                <div className="border rounded-lg p-3">
                  הוצאה ידנית (legacy): <strong>{formatCurrency(s.totalExpenses || 0)}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>פרטי מוטבים</DialogTitle>
              <DialogDescription>
                הזמנה: <span className="font-mono">{selected?.transactionId || '—'}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh] space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">סטטוס מנוי ותשלום</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">סטטוס תשלום</p>
                    <p className="font-semibold">{selected?.paymentStatus || selected?.status || '—'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">סכום עסקה</p>
                    <p className="font-semibold">{formatCurrency(selected?.payerAmount ?? selected?.amount ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">סטטוס השלמה</p>
                    <p className="font-semibold">{selected?.completionStatus || '—'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">עלות ספק</p>
                    <p className="font-semibold">{formatCurrency(selected?.formState?.resolvedVendorCost ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">עמלת סוכן</p>
                    <p className="font-semibold">{formatCurrency(selected?.formState?.resolvedAgentCommission ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">רווח נקי</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(selected?.formState?.resolvedNetProfit ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">מבוטח ראשי</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>שם מלא: <strong>{[selectedPrimary.firstName, selectedPrimary.lastName].filter(Boolean).join(' ') || '—'}</strong></div>
                  <div>ת.ז: <strong dir="ltr">{selectedPrimary.id || '—'}</strong></div>
                  <div>תאריך לידה: <strong>{selectedPrimary.dateOfBirth || '—'}</strong></div>
                  <div>טלפון: <strong dir="ltr">{selectedPrimary.phone || '—'}</strong></div>
                  <div>אימייל: <strong dir="ltr">{selectedPrimary.email || '—'}</strong></div>
                  <div>כתובת: <strong>{selectedPrimary.address || '—'}</strong></div>
                  <div>מצב משפחתי: <strong>{selectedPrimary.maritalStatus || '—'}</strong></div>
                  <div>קופת חולים: <strong>{selectedPrimary.healthFund || '—'}</strong></div>
                  <div>ביטוח משלים: <strong>{selectedPrimary.supplementalInsurance || '—'}</strong></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">מוטבים נוספים</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedAdditional.length === 0 ? (
                    <p className="text-sm text-muted-foreground">לא נמצאו מוטבים נוספים בעסקה זו.</p>
                  ) : (
                    selectedAdditional.map((m, idx) => (
                      <div key={`${m.id || 'ben'}-${idx}`} className="rounded-lg border p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>שם: <strong>{[m.firstName, m.lastName].filter(Boolean).join(' ') || '—'}</strong></div>
                        <div>ת.ז: <strong dir="ltr">{m.id || '—'}</strong></div>
                        <div>תאריך לידה: <strong>{m.dateOfBirth || '—'}</strong></div>
                        <div>טלפון: <strong dir="ltr">{m.phone || '—'}</strong></div>
                        <div>אימייל: <strong dir="ltr">{m.email || '—'}</strong></div>
                        <div>קרבה: <strong>{m.relation || m.relationship || '—'}</strong></div>
                        <div>מצב משפחתי: <strong>{m.maritalStatus || '—'}</strong></div>
                        <div>קופת חולים: <strong>{m.healthFund || '—'}</strong></div>
                        <div>ביטוח משלים: <strong>{m.supplementalInsurance || '—'}</strong></div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            <DialogFooter className="flex-row-reverse sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                סגור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminPageShell>
    </TooltipProvider>
  );
}
