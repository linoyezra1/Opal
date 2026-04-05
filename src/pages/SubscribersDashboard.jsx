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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
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

const MARITAL_OPTIONS = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
const HEALTH_FUNDS = ['', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
const SUPPLEMENTAL_OPTIONS = ['', 'אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];
const GENDER_OPTIONS = ['', 'זכר', 'נקבה', 'אחר'];

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

function dealCentralizedPayment(deal) {
  if (!deal) return false;
  const fs = deal.formState && typeof deal.formState === 'object' ? deal.formState : {};
  const pm = String(fs.paymentMethod || fs.organizationPaymentMethod || '').toLowerCase();
  return pm === 'centralized' || String(deal.source || '') === 'org-bulk-import';
}

function dealDisplayPaymentStatus(deal) {
  return dealCentralizedPayment(deal) ? 'משולם ע״י ארגון' : String(deal?.paymentStatus || '—');
}

function dealDisplaySubscriptionStatus(deal) {
  return dealCentralizedPayment(deal)
    ? `חיוב מרוכז · ${String(deal?.subscriptionStatus || '—')}`
    : String(deal?.subscriptionStatus || '—');
}

const checkboxClass = 'h-4 w-4 rounded border border-input bg-background text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const emptyEditForm = () => ({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  idNum: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  healthFund: '',
  supplementalInsurance: '',
  address: '',
  agentName: '',
  agentCommission: '',
  payerAmount: '',
  createdAt: '',
  subscriptionStartDate: '',
  productId: '',
  beneficiaries: [],
});

export default function SubscribersDashboard() {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDealId, setEditDealId] = useState(null);
  const [editTab, setEditTab] = useState('primary');
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editOrganizationName, setEditOrganizationName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [data, setData] = useState({
    summary: {},
    filterOptions: { providers: [], agents: [] },
    rows: [],
  });
  const [liveSearch, setLiveSearch] = useState('');

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
    customerSegment: 'all',
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
      (filters.summaryCategories || []).length > 0 ||
      (filters.customerSegment && filters.customerSegment !== 'all')
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
        customerSegment: filters.customerSegment || 'all',
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
    const primary = row.raw?.beneficiaryUpdate?.primaryMember || {};
    const additional =
      Array.isArray(row.raw?.beneficiaryUpdate?.additionalMembers) && row.raw.beneficiaryUpdate.additionalMembers.length
        ? row.raw.beneficiaryUpdate.additionalMembers
        : Array.isArray(fs.beneficiaries)
          ? fs.beneficiaries
          : [];
    const oid = String(row.raw?.organizationId || fs.organizationId || '').trim();
    const orgLinked = !!(oid || row.raw?.isOrganizationDeal || String(row.raw?.source || '') === 'org-bulk-import');
    const orgNm = String(fs.organizationName || row.organizationName || row.organizationBadge || '').trim();
    setEditOrganizationName(orgLinked ? orgNm || (oid ? `מקושר לארגון (${oid})` : 'מקושר לארגון') : '');
    setEditDealId(row.id);
    setEditForm({
      firstName: primary.firstName || '',
      lastName: primary.lastName || '',
      phone: primary.phone || fs.phone || '',
      email: primary.email || fs.email || '',
      idNum: primary.id || fs.id || row.idNumber || '',
      dateOfBirth: primary.dateOfBirth || fs.dateOfBirth || '',
      gender: primary.gender || fs.gender || '',
      maritalStatus: primary.maritalStatus || fs.maritalStatus || '',
      healthFund: primary.healthFund || fs.healthFund || '',
      supplementalInsurance: primary.supplementalInsurance || fs.supplementalInsurance || '',
      address: primary.address || fs.address || '',
      agentName: row.raw?.beneficiaryUpdate?.agentName || fs.agentName || row.agentName || '',
      agentCommission: String(fs.resolvedAgentCommission ?? row.agentCommission ?? 0),
      payerAmount: String(row.amount ?? ''),
      createdAt: String(row.createdAt || ''),
      subscriptionStartDate: String(fs.subscriptionStartDate || ''),
      productId: String(fs.productId || row.raw?.formState?.productId || ''),
      beneficiaries: additional.map((m) => ({
        firstName: String(m?.firstName || '').trim(),
        lastName: String(m?.lastName || '').trim(),
        id: String(m?.id || '').trim(),
        relation: String(m?.relation || m?.relationship || '').trim(),
        phone: String(m?.phone || '').trim(),
        email: String(m?.email || '').trim(),
        address: String(m?.address || '').trim(),
        dateOfBirth: String(m?.dateOfBirth || '').trim(),
        gender: String(m?.gender || '').trim(),
        maritalStatus: String(m?.maritalStatus || '').trim(),
        healthFund: String(m?.healthFund || '').trim(),
        supplementalInsurance: String(m?.supplementalInsurance || '').trim(),
      })),
    });
    setEditTab('primary');
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
          beneficiaryUpdate: {
            primaryMember: {
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              id: editForm.idNum,
              dateOfBirth: editForm.dateOfBirth,
              gender: editForm.gender,
              maritalStatus: editForm.maritalStatus,
              healthFund: editForm.healthFund,
              supplementalInsurance: editForm.supplementalInsurance,
              phone: editForm.phone,
              email: editForm.email,
              address: editForm.address,
            },
            additionalMembers: (editForm.beneficiaries || []).map((b) => ({
              firstName: b.firstName,
              lastName: b.lastName,
              id: b.id,
              relation: b.relation,
              relationship: b.relation,
              phone: b.phone,
              email: b.email,
              address: b.address,
              dateOfBirth: b.dateOfBirth,
              gender: b.gender,
              maritalStatus: b.maritalStatus,
              healthFund: b.healthFund,
              supplementalInsurance: b.supplementalInsurance,
            })),
          },
          formState: {
            fullName: [editForm.firstName, editForm.lastName].filter(Boolean).join(' ').trim(),
            phone: editForm.phone,
            email: editForm.email,
            id: editForm.idNum,
            dateOfBirth: editForm.dateOfBirth,
            gender: editForm.gender,
            maritalStatus: editForm.maritalStatus,
            healthFund: editForm.healthFund,
            supplementalInsurance: editForm.supplementalInsurance,
            address: editForm.address,
            beneficiaries: (editForm.beneficiaries || []).map((b) => ({
              firstName: b.firstName,
              lastName: b.lastName,
              id: b.id,
              relation: b.relation,
              relationship: b.relation,
              phone: b.phone,
              email: b.email,
              address: b.address,
              dateOfBirth: b.dateOfBirth,
              gender: b.gender,
              maritalStatus: b.maritalStatus,
              healthFund: b.healthFund,
              supplementalInsurance: b.supplementalInsurance,
            })),
            beneficiaryCount: Array.isArray(editForm.beneficiaries) ? editForm.beneficiaries.length : 0,
          },
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
      customerSegment: 'all',
    }));
  }

  const s = data.summary || {};
  const visibleRows = useMemo(() => {
    const q = String(liveSearch || '').trim().toLowerCase();
    if (!q) return data.rows || [];
    return (data.rows || []).filter((r) => {
      const hay = [
        r.transactionId,
        r.fullName,
        r.idNumber,
        r.organizationName,
        r.organizationBadge,
        r.agentName,
        r.productName,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [data.rows, liveSearch]);
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
          gender: formState.gender || '',
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
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת עסקה / מנוי</DialogTitle>
              <DialogDescription>עדכון פרטים שנשמרו בעסקה (MongoDB)</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="space-y-4" dir="rtl">
              {editOrganizationName ? (
                <Field>
                  <FieldLabel>ארגון (קריאה בלבד)</FieldLabel>
                  <Input value={editOrganizationName} readOnly className="bg-muted" />
                </Field>
              ) : null}
              <Tabs value={editTab} onValueChange={setEditTab} className="mt-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="primary">מוטב ראשי</TabsTrigger>
                  <TabsTrigger value="secondary">מוטבים משניים</TabsTrigger>
                  <TabsTrigger value="transaction">פרטי עסקה</TabsTrigger>
                </TabsList>
                <TabsContent value="primary" className="space-y-4 mt-4">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>שם פרטי</FieldLabel>
                        <Input value={editForm.firstName} onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))} />
                      </Field>
                      <Field>
                        <FieldLabel>שם משפחה</FieldLabel>
                        <Input value={editForm.lastName} onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>תעודת זהות</FieldLabel>
                        <Input dir="ltr" value={editForm.idNum} onChange={(e) => setEditForm((p) => ({ ...p, idNum: e.target.value }))} />
                      </Field>
                      <Field>
                        <FieldLabel>טלפון</FieldLabel>
                        <Input dir="ltr" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>אימייל</FieldLabel>
                        <Input type="email" dir="ltr" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                      </Field>
                      <Field>
                        <FieldLabel>תאריך לידה</FieldLabel>
                        <Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>מין</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={editForm.gender}
                          onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                        >
                          {GENDER_OPTIONS.map((o) => (
                            <option key={o || 'g-e'} value={o}>
                              {o || 'בחר'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field>
                        <FieldLabel>מצב משפחתי</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={editForm.maritalStatus}
                          onChange={(e) => setEditForm((p) => ({ ...p, maritalStatus: e.target.value }))}
                        >
                          {MARITAL_OPTIONS.map((o) => (
                            <option key={o || 'm-e'} value={o}>
                              {o || 'בחר'}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>קופת חולים</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={editForm.healthFund}
                          onChange={(e) => setEditForm((p) => ({ ...p, healthFund: e.target.value }))}
                        >
                          {HEALTH_FUNDS.map((o) => (
                            <option key={o || 'h-e'} value={o}>
                              {o || 'בחר'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field>
                        <FieldLabel>ביטוח משלים</FieldLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          value={editForm.supplementalInsurance}
                          onChange={(e) => setEditForm((p) => ({ ...p, supplementalInsurance: e.target.value }))}
                        >
                          {SUPPLEMENTAL_OPTIONS.map((o) => (
                            <option key={o || 's-e'} value={o}>
                              {o || 'בחר'}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>כתובת</FieldLabel>
                      <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="secondary" className="space-y-4 mt-4">
                  {(editForm.beneficiaries || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">אין מוטבים משניים בעסקה זו.</p>
                  ) : (
                    (editForm.beneficiaries || []).map((b, idx) => (
                      <div key={`ben-edit-${idx}`} className="rounded-lg border p-4 space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">מוטב משני {idx + 1}</p>
                        <FieldGroup>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>שם פרטי</FieldLabel>
                              <Input
                                value={b.firstName}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], firstName: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel>שם משפחה</FieldLabel>
                              <Input
                                value={b.lastName}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], lastName: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>תעודת זהות</FieldLabel>
                              <Input
                                dir="ltr"
                                value={b.id}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], id: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel>תאריך לידה</FieldLabel>
                              <Input
                                type="date"
                                value={b.dateOfBirth || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], dateOfBirth: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>מין</FieldLabel>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={b.gender || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], gender: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              >
                                {GENDER_OPTIONS.map((o) => (
                                  <option key={`${idx}-g-${o || 'e'}`} value={o}>
                                    {o || 'בחר'}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field>
                              <FieldLabel>מצב משפחתי</FieldLabel>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={b.maritalStatus || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], maritalStatus: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              >
                                {MARITAL_OPTIONS.map((o) => (
                                  <option key={`${idx}-m-${o || 'e'}`} value={o}>
                                    {o || 'בחר'}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>קופת חולים</FieldLabel>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={b.healthFund || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], healthFund: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              >
                                {HEALTH_FUNDS.map((o) => (
                                  <option key={`${idx}-h-${o || 'e'}`} value={o}>
                                    {o || 'בחר'}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field>
                              <FieldLabel>ביטוח משלים</FieldLabel>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                value={b.supplementalInsurance || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], supplementalInsurance: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              >
                                {SUPPLEMENTAL_OPTIONS.map((o) => (
                                  <option key={`${idx}-s-${o || 'e'}`} value={o}>
                                    {o || 'בחר'}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>קרבה / קשר משפחתי</FieldLabel>
                              <Input
                                value={b.relation || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], relation: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel>טלפון</FieldLabel>
                              <Input
                                dir="ltr"
                                value={b.phone || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], phone: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>אימייל</FieldLabel>
                              <Input
                                type="email"
                                dir="ltr"
                                value={b.email || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], email: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel>כתובת</FieldLabel>
                              <Input
                                value={b.address || ''}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = { ...list[idx], address: e.target.value };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </FieldGroup>
                      </div>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="transaction" className="space-y-4 mt-4">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>סכום עסקה (₪)</FieldLabel>
                        <Input type="number" dir="ltr" value={editForm.payerAmount} readOnly className="bg-muted" />
                      </Field>
                      <Field>
                        <FieldLabel>עמלת סוכן (₪)</FieldLabel>
                        <Input type="number" dir="ltr" value={editForm.agentCommission} readOnly className="bg-muted" />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>סוכן</FieldLabel>
                        <Input value={editForm.agentName || '—'} readOnly className="bg-muted" />
                      </Field>
                      <Field>
                        <FieldLabel>תחילת מנוי</FieldLabel>
                        <Input type="date" value={editForm.subscriptionStartDate} readOnly className="bg-muted" />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>תאריך יצירה</FieldLabel>
                      <Input value={editForm.createdAt ? new Date(editForm.createdAt).toLocaleString('he-IL') : ''} readOnly className="bg-muted" />
                    </Field>
                  </FieldGroup>
                </TabsContent>
              </Tabs>
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
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
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
                  <FieldLabel>סוג לקוח</FieldLabel>
                  <select
                    value={filters.customerSegment}
                    onChange={(e) => setFilters((p) => ({ ...p, customerSegment: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="all">הכל</option>
                    <option value="private">לקוחות פרטיים</option>
                    <option value="organization">חברי ארגון</option>
                  </select>
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

        <div className="space-y-6" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <UserCheck className="size-7 text-primary" />
                לקוחות
              </h1>
              <p className="text-muted-foreground">רשימת לקוחות — נתונים ממסד (כולל עריכה ומחיקה)</p>
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
            <StatsCard title="עסקאות בתוצאות" value={visibleRows.length} icon={Users} loading={loading} />
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
          <Card dir="rtl" className="text-right">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pe-10"
                    placeholder="חיפוש חי: שם לקוח, ת.ז, מס׳ הזמנה…"
                    value={liveSearch}
                    onChange={(e) => setLiveSearch(e.target.value)}
                  />
                </div>
                <Field className="w-full sm:w-52 shrink-0 space-y-1.5">
                  <FieldLabel className="text-xs text-muted-foreground">סוג לקוח</FieldLabel>
                  <select
                    value={filters.customerSegment}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilters((p) => ({ ...p, customerSegment: v }));
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="all">הכל</option>
                    <option value="private">לקוחות פרטיים</option>
                    <option value="organization">חברי ארגון</option>
                  </select>
                </Field>
                <Button type="button" onClick={loadDashboard} disabled={loading}>
                  {loading && <Spinner className="me-2" />}
                  רענון
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
                החיפוש מסנן מיידית את הרשימה הנוכחית. לאחר שינוי &quot;סוג לקוח&quot; לחצו &quot;רענון&quot;. לסינונים נוספים השתמשו ב&quot;סינון מתקדם&quot;.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4 pb-2">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="text-right">
                  <CardTitle>לקוחות</CardTitle>
                  <CardDescription>תצוגה מקוצרת; פרטים מלאים ב״הצג״ או ״ערוך״</CardDescription>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-2 items-center justify-end text-xs rounded-lg border bg-muted/30 px-3 py-2 max-w-full xl:max-w-[min(100%,52rem)]">
                  <span className="font-medium text-foreground shrink-0">כמות / סינון קטגוריות:</span>
                  {SUMMARY_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <strong>{s[item.key] ?? 0}</strong>
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={filters.summaryCategories.includes(item.key)}
                        onChange={() => toggleSummaryCategory(item.key)}
                      />
                    </label>
                  ))}
                  <span className="border-s border-border ps-3 ms-1 whitespace-nowrap">
                    סה״כ: <strong>{formatCurrency(s.totalRevenue || 0)}</strong>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0"
                    onClick={loadDashboard}
                    disabled={loading}
                  >
                    {loading && <Spinner className="size-3 me-1" />}
                    עדכן דוח
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto pt-2" dir="rtl">
              {error && !editOpen ? <p className="text-destructive text-sm mb-2">{error}</p> : null}
              {loading ? <p className="text-muted-foreground text-sm mb-2">טוען…</p> : null}
              {visibleRows.length === 0 && !loading ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <UserCheck className="size-8" />
                  </EmptyMedia>
                  <EmptyTitle>אין נתונים</EmptyTitle>
                  <EmptyDescription>נסו לשנות חיפוש או סינון מתקדם</EmptyDescription>
                </Empty>
              ) : (
                <div className="rounded-md border">
                  <Table className="text-right">
                    <TableHeader>
                      <TableRow className="[&_th]:text-right">
                        <TableHead className="text-right">סטטוס השלמה</TableHead>
                        <TableHead className="text-right">סטטוס תשלום</TableHead>
                        <TableHead className="text-right">סטטוס חיוב עתידי</TableHead>
                        <TableHead className="text-right">מס&apos; הזמנה</TableHead>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">סכום</TableHead>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="w-28 text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((r) => (
                        (() => {
                          const isCancelled = r.status === 'canceled' || String(r.subscriptionStatus || '').toLowerCase() === 'cancelled';
                          const missingRecurringIds =
                            !String(r.cardcomAccountId || '').trim() || !String(r.cardcomRecurringId || '').trim();
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
                          <TableCell className="text-right align-top">
                            {r.pendingBeneficiaryCompletion ? (
                              <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">
                                ממתין להשלמת מסמכים
                              </Badge>
                            ) : (
                              <Badge variant={isCancelled ? 'destructive' : 'default'}>
                                {isCancelled ? 'בוטל' : 'הושלם'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-pre-wrap max-w-[12rem]">
                            {r.displayPaymentStatus || r.paymentStatus || '—'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {isCancelled ? (
                              <Badge variant="destructive" className="font-normal">
                                {`בוטל מול קארדקום${cancelledAtText ? ` ב-${cancelledAtText}` : ''}`}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">פעיל</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-end">{r.transactionId}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span>{r.fullName || '—'}</span>
                              {r.organizationBadge ? (
                                <Badge variant="outline" className="text-xs font-normal max-w-full whitespace-normal text-right">
                                  {r.organizationBadge}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-right">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
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
                                disabled={isCancelled || missingRecurringIds}
                                onClick={() =>
                                  setCancelTarget({
                                    id: r.id,
                                    transactionId: r.transactionId,
                                  })
                                }
                                title={
                                  missingRecurringIds
                                    ? 'Subscription was not created as recurring - cancel manually in Cardcom'
                                    : undefined
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
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
            <DialogHeader>
              <DialogTitle>פרטי מוטבים</DialogTitle>
              <DialogDescription>
                הזמנה: <span className="font-mono">{selected?.transactionId || '—'}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh] space-y-4">
              {(() => {
                const oid = String(selected?.organizationId || selected?.formState?.organizationId || '').trim();
                const oname = String(selected?.organizationName || selected?.formState?.organizationName || '').trim();
                const linked = !!(oid || selected?.isOrganizationDeal || String(selected?.source || '') === 'org-bulk-import');
                if (!linked) return null;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">ארגון (קריאה בלבד)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm font-medium">{oname || `מקושר לארגון (${oid || '—'})`}</p>
                    </CardContent>
                  </Card>
                );
              })()}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">סטטוס מנוי ותשלום</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">סטטוס תשלום</p>
                    <p className="font-semibold">{dealDisplayPaymentStatus(selected)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">סטטוס מנוי</p>
                    <p className="font-semibold">{dealDisplaySubscriptionStatus(selected)}</p>
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
                  <div>מין: <strong>{selectedPrimary.gender || '—'}</strong></div>
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
                        <div>מין: <strong>{m.gender || '—'}</strong></div>
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
