import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Filter,
  TrendingUp,
  Users,
  Calendar,
  Edit2,
  Archive,
  Download,
  Eye,
  Ban,
  MoreVertical,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import {
  ISRAELI_ID_INVALID_MSG,
  normalizeIsraeliIdDigitsInput,
  validateIsraeliId,
  shouldShowIsraeliIdChecksumError,
} from '../utils/israeliId.js';
import { fmtDateTime } from '../utils/dateUtils.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';
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
import { canArchiveDealUi, FORBIDDEN_ARCHIVE_ALERT_HE } from '../utils/archiveEligibility.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

const PENDING_ORG_CANCEL_ALERT_HE =
  'לקוח זה לא אושר על ידי הארגון ולא הופעל לו מנוי, ולכן לא ניתן לבטל את המנוי. ניתן להעביר לארכיון בלבד. פעולה זו תגרור השבתה של יכולת מנהל הארגון לאשר עובד זה בעתיד';

const SUMMARY_ITEMS = [
  { key: 'primary',   label: 'לקוחות עיקריים' },
  { key: 'secondary', label: 'לקוחות משניים' },
  { key: 'total',     label: 'סה"כ (ראשי + משני)' },
];

const MARITAL_OPTIONS = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
const HEALTH_FUNDS = ['', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
const SUPPLEMENTAL_OPTIONS = ['', 'אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];
const GENDER_OPTIONS = ['', 'זכר', 'נקבה', 'אחר'];

const EDIT_DRAWER_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-start';

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

function pendingCancelLabel(finalBillingMonth) {
  if (!finalBillingMonth) return 'ממתין לביטול';
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(finalBillingMonth).trim());
  if (!m) return 'ממתין לביטול';
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  if (!yr || !mo || mo < 1 || mo > 12) return 'ממתין לביטול';
  const nextMonthDate = new Date(yr, mo, 1);
  const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long' }).format(nextMonthDate);
  return `יבוטל ב-1 ל${monthName}`;
}

/** סגירת תפריט הפעולות במובייל (אלמנט details) אחרי בחירה */
function closeActionDetailsMenu(ev) {
  const root = ev?.currentTarget?.closest?.('details');
  if (root) root.open = false;
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

function billingMonthLabel(value) {
  const v = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(v)) return v || '—';
  const [y, m] = v.split('-');
  return `${m}/${y}`;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedDetailsTab, setSelectedDetailsTab] = useState('transaction');
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
  const [cancelOrgTarget, setCancelOrgTarget] = useState(null);
  const [terminationDate, setTerminationDate] = useState('');
  const [cancelOrgLoading, setCancelOrgLoading] = useState(false);
  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [data, setData] = useState({
    summary: {},
    filterOptions: { providers: [], agents: [] },
    rows: [],
  });
  const [liveSearch, setLiveSearch] = useState(() => String(searchParams.get('search') || '').trim());

  const [filters, setFilters] = useState({
    month: String(searchParams.get('month') || ''),
    fromDate: String(searchParams.get('fromDate') || ''),
    toDate: String(searchParams.get('toDate') || ''),
    status: String(searchParams.get('status') || 'all'),
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
    customerSegment: 'all',
    agentFilter: '',
    organizationFilter: '',
    productFilter: '',
    documentStatusFilter: '',
    paymentTypeFilter: '',
    customerSegmentFilter: '',
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
  const organizationOptions = useMemo(
    () => [...new Set((data.rows || []).map((r) => String(r.organizationName || r.organizationBadge || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [data.rows]
  );

  const agentOptions = useMemo(
    () => [...new Set((data.rows || []).map((r) => String(r.agentName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [data.rows]
  );
  const productOptions = useMemo(
    () => [...new Set((data.rows || []).map((r) => String(r.productName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [data.rows]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.month ||
      !!filters.fromDate ||
      !!filters.toDate ||
      (filters.status && filters.status !== 'all') ||
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
      (filters.customerSegment && filters.customerSegment !== 'all') ||
      !!filters.agentFilter ||
      !!filters.organizationFilter ||
      !!filters.productFilter ||
      !!filters.documentStatusFilter ||
      !!filters.paymentTypeFilter ||
      !!filters.customerSegmentFilter
    );
  }, [filters]);
  const unifiedFilterConfig = useMemo(
    () => [
      { key: 'search', label: 'חיפוש', type: 'text', placeholder: 'חיפוש חי: שם לקוח, ת.ז, מס׳ הזמנה…' },
      { key: 'month', label: 'חודש', type: 'month', placeholder: 'YYYY-MM' },
      { key: 'fromDate', label: 'מתאריך(תאריך הצטרפות)', type: 'date' },
      { key: 'toDate', label: 'עד תאריך(תאריך הצטרפות)', type: 'date' },
      {
        key: 'status',
        label: 'סטטוס',
        type: 'select',
        options: [
          { value: 'active', label: 'פעילים' },
          { value: 'cancelled', label: 'מבוטלים' },
        ],
      },
      {
        key: 'agentFilter',
        label: 'סוכן',
        type: 'select',
        options: agentOptions.map((a) => ({ value: a, label: a })),
      },
      {
        key: 'organizationFilter',
        label: 'ארגון',
        type: 'select',
        options: organizationOptions.map((o) => ({ value: o, label: o })),
      },
      {
        key: 'productFilter',
        label: 'שם המוצר',
        type: 'select',
        options: productOptions.map((p) => ({ value: p, label: p })),
      },
      {
        key: 'documentStatusFilter',
        label: 'סטטוס השלמת מסמכים',
        type: 'select',
        options: [
          { value: 'missing', label: 'חסר' },
          { value: 'completed', label: 'הושלם' },
        ],
      },
      {
        key: 'paymentTypeFilter',
        label: 'סוג תשלום',
        type: 'select',
        options: [
          { value: 'centralized', label: 'מרוכז (ארגון משלם)' },
          { value: 'private',     label: 'פרטי (כרטיס אשראי)' },
        ],
      },
      {
        key: 'customerSegmentFilter',
        label: 'סוג לקוח',
        type: 'select',
        options: [
          { value: 'org', label: 'ארגוני (עובד ארגון)' },
          { value: 'b2c', label: 'פרטי (B2C)' },
        ],
      },
    ],
    [agentOptions, organizationOptions, productOptions]
  );
  const unifiedFilterValues = useMemo(
    () => ({
      search: liveSearch,
      customerSegment: filters.customerSegment || 'all',
      month: filters.month || '',
      fromDate: filters.fromDate || '',
      toDate: filters.toDate || '',
      status: filters.status || 'all',
      agentFilter: filters.agentFilter || '',
      organizationFilter: filters.organizationFilter || '',
      productFilter: filters.productFilter || '',
      documentStatusFilter: filters.documentStatusFilter || '',
      paymentTypeFilter: filters.paymentTypeFilter || '',
      customerSegmentFilter: filters.customerSegmentFilter || '',
    }),
    [liveSearch, filters]
  );

  async function loadDashboard() {
    if (!token) {
      setError('נדרשת התחברות אדמין. היכנס/י דרך /admin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        search: liveSearch || '',
        month: filters.month || '',
        fromDate: filters.fromDate || '',
        toDate: filters.toDate || '',
        status: filters.status || 'all',
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
    const t = setTimeout(() => {
      loadDashboard();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, liveSearch]);

  useEffect(() => {
    const current = String(searchParams.get('search') || '').trim();
    const next = String(liveSearch || '').trim();
    if (current === next) return;
    const params = new URLSearchParams(searchParams);
    if (next) params.set('search', next);
    else params.delete('search');
    setSearchParams(params, { replace: true });
  }, [liveSearch, searchParams, setSearchParams]);

  useEffect(() => {
    const status = String(searchParams.get('status') || '').trim();
    const month = String(searchParams.get('month') || '').trim();
    const fromDate = String(searchParams.get('fromDate') || '').trim();
    const toDate = String(searchParams.get('toDate') || '').trim();
    if (!status && !month && !fromDate && !toDate) return;
    setFilters((prev) => ({
      ...prev,
      status: status || prev.status || 'all',
      month: month || prev.month,
      fromDate: fromDate || prev.fromDate,
      toDate: toDate || prev.toDate,
    }));
  }, [searchParams]);

  useEffect(() => {
    const editId = String(searchParams.get('editId') || searchParams.get('editDealId') || '').trim();
    if (!editId) return;
    const row = (data.rows || []).find((r) => String(r.id || '') === editId);
    if (!row) return;
    openEdit(row);
    const next = new URLSearchParams(searchParams);
    next.delete('editId');
    next.delete('editDealId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, data.rows]);

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
    const primaryFullName = String(primary.fullName || fs.fullName || row.fullName || '').trim();
    const fullNameParts = primaryFullName ? primaryFullName.split(/\s+/).filter(Boolean) : [];
    const fallbackFirst = fullNameParts.length > 1 ? fullNameParts.slice(0, -1).join(' ') : fullNameParts[0] || '';
    const fallbackLast = fullNameParts.length > 1 ? fullNameParts[fullNameParts.length - 1] : '';
    setEditForm({
      firstName: primary.firstName || fallbackFirst,
      lastName: primary.lastName || fallbackLast,
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
      agentCommission: String(row.raw?.commissionAmount ?? fs.resolvedAgentCommission ?? row.agentCommission ?? 0),
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

  function isEditBeneficiaryProvided(b) {
    return !!(
      String(b?.firstName || '').trim() ||
      String(b?.lastName || '').trim() ||
      normalizeIsraeliIdDigitsInput(b?.id) ||
      String(b?.dateOfBirth || '').trim()
    );
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editDealId || !token) return;
    setSaveLoading(true);
    setError('');
    const primaryDigits = normalizeIsraeliIdDigitsInput(editForm.idNum);
    if (!primaryDigits) {
      setError('נא למלא תעודת זהות למוטב הראשי');
      setSaveLoading(false);
      return;
    }
    if (!validateIsraeliId(primaryDigits)) {
      setError(ISRAELI_ID_INVALID_MSG);
      setSaveLoading(false);
      return;
    }
    const primaryIdNorm = primaryDigits.padStart(9, '0');
    const list = editForm.beneficiaries || [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!isEditBeneficiaryProvided(b)) continue;
      const bid = normalizeIsraeliIdDigitsInput(b.id);
      if (!bid) {
        setError(`נא למלא תעודת זהות למוטב משני ${i + 1}`);
        setSaveLoading(false);
        return;
      }
      if (!validateIsraeliId(bid)) {
        setError(ISRAELI_ID_INVALID_MSG);
        setSaveLoading(false);
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(editDealId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          beneficiaryUpdate: {
            primaryMember: {
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              id: primaryIdNorm,
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
              id: isEditBeneficiaryProvided(b)
                ? normalizeIsraeliIdDigitsInput(b.id).padStart(9, '0')
                : b.id,
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
            id: primaryIdNorm,
            dateOfBirth: editForm.dateOfBirth,
            gender: editForm.gender,
            maritalStatus: editForm.maritalStatus,
            healthFund: editForm.healthFund,
            supplementalInsurance: editForm.supplementalInsurance,
            address: editForm.address,
            beneficiaries: (editForm.beneficiaries || []).map((b) => ({
              firstName: b.firstName,
              lastName: b.lastName,
              id: isEditBeneficiaryProvided(b)
                ? normalizeIsraeliIdDigitsInput(b.id).padStart(9, '0')
                : b.id,
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

  function requestArchiveForRow(r) {
    if (
      !canArchiveDealUi({
        workflowStatus: r.raw?.status,
        subscriptionStatus: r.subscriptionStatus,
        isActive: r.raw?.isActive,
      })
    ) {
      window.alert(FORBIDDEN_ARCHIVE_ALERT_HE);
      return;
    }
    setDeleteTarget({ id: r.id, transactionId: r.transactionId });
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
      const msg = String(err?.message || '');
      if (/לא ניתן להעביר לארכיון/.test(msg)) {
        setError('לא ניתן להעביר לארכיון. לקוח זה נמצא במצב פעיל. יש לבצע ביטול מנוי לפני העברה לארכיון.');
      } else {
        setError(msg || 'שגיאה');
      }
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

  async function confirmCancelOrgEmployee() {
    if (!cancelOrgTarget?.id || !token) return;
    setCancelOrgLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(cancelOrgTarget.id)}/cancel-org-employee`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'ביטול נכשל');
      setCancelOrgTarget(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setCancelOrgLoading(false);
    }
  }

  function clearFilters() {
    setFilters((p) => ({
      ...p,
      month: '',
      fromDate: '',
      toDate: '',
      status: 'all',
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
      customerSegment: 'all',
      agentFilter: '',
      organizationFilter: '',
      productFilter: '',
      documentStatusFilter: '',
      paymentTypeFilter: '',
      customerSegmentFilter: '',
    }));
  }

  const visibleRows = useMemo(() => {
    let rows = data.rows || [];

    // Status guard — re-applied client-side so stale server responses or race
    // conditions never leak wrong-status rows into the visible table.
    if (filters.status === 'cancelled') {
      rows = rows.filter(
        (r) =>
          r.status === 'canceled' ||
          String(r.subscriptionStatus || '').toLowerCase() === 'cancelled',
      );
    } else if (filters.status === 'active') {
      rows = rows.filter(
        (r) =>
          r.status !== 'canceled' &&
          String(r.subscriptionStatus || '').toLowerCase() !== 'cancelled',
      );
    }

    // Agent filter — AND logic, exact match on agent name
    if (filters.agentFilter) {
      rows = rows.filter((r) => String(r.agentName || '').trim() === filters.agentFilter);
    }

    // Organization filter — AND logic, exact match on organization name
    if (filters.organizationFilter) {
      rows = rows.filter(
        (r) => String(r.organizationName || r.organizationBadge || '').trim() === filters.organizationFilter,
      );
    }

    if (filters.productFilter) {
      rows = rows.filter((r) => String(r.productName || '').trim() === filters.productFilter);
    }

    if (filters.documentStatusFilter === 'missing') {
      rows = rows.filter((r) => !!r.pendingBeneficiaryCompletion);
    } else if (filters.documentStatusFilter === 'completed') {
      rows = rows.filter((r) => !r.pendingBeneficiaryCompletion);
    }

    if (filters.paymentTypeFilter || filters.customerSegmentFilter) {
      rows = rows.filter((r) => {
        // Segment (ground truth) — isOrganizationDeal is the authoritative boolean
        const isOrgDeal = r.isOrganizationDeal === true && !!String(r.organizationId || '').trim();

        // Payment context — derived only from authoritative fields, never from dealSource
        const isCentralized = r.isCentralized === true || r.paymentMethod === 'centralized';

        // ── Segment filter (enforced first — establishes mutual exclusion) ──
        if (filters.customerSegmentFilter === 'org' && !isOrgDeal) return false;
        if (filters.customerSegmentFilter === 'b2c' && isOrgDeal) return false;

        // ── Payment type filter ──
        // Centralized billing is structurally impossible for B2C customers.
        // Combining paymentType=centralized + segment=b2c always yields an empty set.
        if (filters.paymentTypeFilter === 'centralized') {
          if (!isOrgDeal) return false;    // B2C can never be centralized
          if (!isCentralized) return false; // Org deal but pays via private credit card
        }
        // Private = not centralized (B2C is always private; org is private only when !isCentralized)
        if (filters.paymentTypeFilter === 'private') {
          if (isOrgDeal && isCentralized) return false; // Org centralized ≠ private
        }

        return true;
      });
    }

    // Live text search on top of the status-filtered set
    const q = String(liveSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.transactionId,
        r.internalDealNumber,
        r.cardcomRecurringId,
        r.fullName,
        r.email,
        r.phone,
        r.idNumber,
        r.organizationName,
        r.organizationBadge,
        r.agentName,
        r.productName,
        r.formState?.fullName,
        r.formState?.id,
        r.formState?.phone,
        r.formState?.email,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' | ');
      return hay.includes(q);
    });
  }, [
    data.rows,
    liveSearch,
    filters.status,
    filters.agentFilter,
    filters.organizationFilter,
    filters.productFilter,
    filters.documentStatusFilter,
    filters.paymentTypeFilter,
    filters.customerSegmentFilter,
  ]);

  // Metrics derived entirely from the currently visible (filtered) rows,
  // so summary cards always reflect what the user actually sees in the table.
  const visibleSummary = useMemo(() => {
    let totalRevenue = 0;
    let canceled = 0;
    for (const r of visibleRows) {
      totalRevenue += Number(r.amount || 0);
      if (r.status === 'canceled' || String(r.subscriptionStatus || '').toLowerCase() === 'cancelled') {
        canceled += 1;
      }
    }
    return { totalRevenue, canceled, active: visibleRows.length - canceled };
  }, [visibleRows]);

  const calculatedCounts = useMemo(() => {
    const rows = visibleRows || [];
    const primary = rows.length;
    const secondary = rows.reduce((sum, r) => sum + Number(r.secondaryCount || 0), 0);
    return {
      all: rows.length,
      primary,
      secondary,
      total: primary + secondary,
    };
  }, [visibleRows]);
  const statusSummaryTitle = filters.status === 'cancelled' ? 'מבוטלים (סיכום)' : 'מנויים פעילים (סיכום)';
  const statusSummaryValue = filters.status === 'cancelled' ? visibleSummary.canceled : visibleSummary.active;
  const visibleRowIds = useMemo(
    () => visibleRows.map((r) => String(r.id || '')).filter(Boolean),
    [visibleRows]
  );
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSubscriptionIds.includes(id));
  const selectedCount = selectedSubscriptionIds.length;
  const requireDeletePhrase = selectedCount >= 50;
  const bulkDeleteDisabled = bulkDeleteLoading || selectedCount === 0 || (requireDeletePhrase && bulkDeleteConfirmText !== 'DELETE');

  useEffect(() => {
    const allRowIds = new Set((data.rows || []).map((r) => String(r.id || '')).filter(Boolean));
    setSelectedSubscriptionIds((prev) => prev.filter((id) => allRowIds.has(id)));
  }, [data.rows]);

  function toggleSubscriptionSelection(id, checked) {
    const sid = String(id || '').trim();
    if (!sid) return;
    setSelectedSubscriptionIds((prev) => {
      if (checked) {
        if (prev.includes(sid)) return prev;
        return [...prev, sid];
      }
      return prev.filter((x) => x !== sid);
    });
  }

  function toggleSelectAllVisible(checked) {
    if (!checked) {
      const visibleSet = new Set(visibleRowIds);
      setSelectedSubscriptionIds((prev) => prev.filter((id) => !visibleSet.has(id)));
      return;
    }
    setSelectedSubscriptionIds((prev) => {
      const next = new Set(prev);
      visibleRowIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  async function confirmBulkDelete() {
    if (!selectedCount || !token || bulkDeleteDisabled) return;
    const selectedRows = (data.rows || []).filter((r) => selectedSubscriptionIds.includes(String(r.id || '')));
    const blocked = selectedRows.some(
      (r) =>
        !canArchiveDealUi({
          workflowStatus: r.raw?.status,
          subscriptionStatus: r.subscriptionStatus,
          isActive: r.raw?.isActive,
        })
    );
    if (blocked) {
      window.alert(FORBIDDEN_ARCHIVE_ALERT_HE);
      return;
    }
    setBulkDeleteLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedSubscriptionIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'מחיקה מרוכזת נכשלה');
      setBulkDeleteOpen(false);
      setBulkDeleteConfirmText('');
      setSelectedSubscriptionIds([]);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setBulkDeleteLoading(false);
    }
  }
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

  /** מזהה הוראת קבע — לפעמים רק ב-formState / אינדיקטור ולא בשורש העסקה */
  const resolvedCardcomRecurringId = useMemo(() => {
    if (!selected) return '';
    const fs = selected.formState || {};
    return String(
      selected.cardcomRecurringId ||
        fs.cardcomRecurringId ||
        fs.step2CardcomRecurringId ||
        selected.indicator?.cardcomRecurringId ||
        ''
    ).trim();
  }, [selected]);

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPageShell>
        <ConfirmDialog
          open={!!deleteTarget}
          title="העברה לארכיון"
          message={
            deleteTarget
              ? `להעביר לארכיון את העסקה ${deleteTarget.transactionId || deleteTarget.id}? פעולה זו תעביר את המידע לארכיון. חשוב לזכור: פעולה זו אינה מבטלת חיובים עתידיים בקארדקום. נא לבטל חיוב עתידי קודם לכן.`
              : ''
          }
          confirmLabel="הפוך ללא פעיל"
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
        {/* ── Cancel org employee (centralized billing) ── */}
        <Dialog open={!!cancelOrgTarget} onOpenChange={(o) => { if (!o) setCancelOrgTarget(null); }}>
          <DialogContent className="sm:max-w-md text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle>ביטול מנוי עובד ארגוני</DialogTitle>
              <DialogDescription>
                {cancelOrgTarget?.transactionId ? `עסקה: ${cancelOrgTarget.transactionId}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 leading-relaxed">
              <p className="font-semibold mb-1">מנוי ארגוני בחיוב מרוכז</p>
              <p>המנוי יבוטל בפועל ב-1 לחודש הבא ויחויב באופן מלא על החודש הנוכחי.</p>
            </div>
            {error ? <p className="text-destructive text-sm mt-2">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setCancelOrgTarget(null)}>
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelOrgLoading}
                onClick={confirmCancelOrgEmployee}
              >
                {cancelOrgLoading && <Spinner className="me-2" />}
                אישור ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={bulkDeleteOpen}
          onOpenChange={(open) => {
            setBulkDeleteOpen(open);
            if (!open) setBulkDeleteConfirmText('');
          }}
        >
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>מחיקה מרוכזת של מנויים</DialogTitle>
              <DialogDescription>
                {`פעולה זו תעביר לארכיון ${selectedCount} מנויים.`}
              </DialogDescription>
            </DialogHeader>
            {requireDeletePhrase ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  להעברה לארכיון של 50 מנויים ומעלה יש להקליד בדיוק DELETE כדי לאשר.
                </p>
                <Input
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="הקלד/י DELETE"
                  className="text-center tracking-widest font-mono uppercase"
                  dir="ltr"
                />
              </div>
            ) : null}
            {selectedCount > 100 && bulkDeleteLoading ? (
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-muted overflow-hidden">
                  <div className="h-full w-1/2 animate-pulse bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">מעבד מחיקה מרוכזת של מעל 100 מנויים…</p>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleteLoading}>
                ביטול
              </Button>
              <Button type="button" variant="destructive" onClick={confirmBulkDelete} disabled={bulkDeleteDisabled}>
                {bulkDeleteLoading ? <Spinner className="me-2" /> : null}
                העבר נבחרים לארכיון
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent
            className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            dir="rtl"
          >
            <DialogHeader>
              <DialogTitle>עריכת עסקה / מנוי</DialogTitle>
              <DialogDescription>עדכון פרטי העסקה</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="space-y-4 text-right" dir="rtl">
              {editOrganizationName ? (
                <Field>
                  <FieldLabel>ארגון (קריאה בלבד)</FieldLabel>
                  <Input value={editOrganizationName} readOnly className="bg-muted" />
                </Field>
              ) : null}
              <Tabs value={editTab} onValueChange={setEditTab} className="mt-0 w-full text-right" dir="rtl">
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  <TabsTrigger
                    value="primary"
                    className="text-[11px] sm:text-sm whitespace-normal leading-tight"
                  >
                    מוטב ראשי
                  </TabsTrigger>
                  <TabsTrigger
                    value="secondary"
                    className="text-[11px] sm:text-sm whitespace-normal leading-tight"
                  >
                    מוטבים משניים
                  </TabsTrigger>
                  <TabsTrigger
                    value="transaction"
                    className="text-[11px] sm:text-sm whitespace-normal leading-tight"
                  >
                    פרטי עסקה
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="primary" className="mt-4 space-y-4 text-right" dir="rtl">
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
                        <Input
                          dir="ltr"
                          className="font-mono text-end"
                          inputMode="numeric"
                          maxLength={9}
                          value={editForm.idNum}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, idNum: normalizeIsraeliIdDigitsInput(e.target.value) }))
                          }
                        />
                        {shouldShowIsraeliIdChecksumError(editForm.idNum) ? (
                          <p className="text-destructive text-xs text-start">{ISRAELI_ID_INVALID_MSG}</p>
                        ) : null}
                      </Field>
                      <Field>
                        <FieldLabel>טלפון</FieldLabel>
                        <Input dir="ltr" className="font-mono text-end" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>אימייל</FieldLabel>
                        <Input type="email" dir="ltr" className="text-end" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                      </Field>
                      <Field>
                        <FieldLabel>תאריך לידה</FieldLabel>
                        <Input type="date" dir="ltr" className="text-end" value={editForm.dateOfBirth} onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>מין</FieldLabel>
                        <select
                          dir="rtl"
                          className={EDIT_DRAWER_SELECT_CLASS}
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
                          dir="rtl"
                          className={EDIT_DRAWER_SELECT_CLASS}
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
                          dir="rtl"
                          className={EDIT_DRAWER_SELECT_CLASS}
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
                          dir="rtl"
                          className={EDIT_DRAWER_SELECT_CLASS}
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
                <TabsContent value="secondary" className="mt-4 space-y-4 text-right" dir="rtl">
                  {(editForm.beneficiaries || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-right">אין מוטבים משניים בעסקה זו.</p>
                  ) : (
                    (editForm.beneficiaries || []).map((b, idx) => (
                      <div key={`ben-edit-${idx}`} className="rounded-lg border p-4 space-y-4 text-right">
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
                                className="font-mono text-end"
                                inputMode="numeric"
                                maxLength={9}
                                value={b.id}
                                onChange={(e) =>
                                  setEditForm((p) => {
                                    const list = [...(p.beneficiaries || [])];
                                    list[idx] = {
                                      ...list[idx],
                                      id: normalizeIsraeliIdDigitsInput(e.target.value),
                                    };
                                    return { ...p, beneficiaries: list };
                                  })
                                }
                              />
                              {shouldShowIsraeliIdChecksumError(b.id) ? (
                                <p className="text-destructive text-xs text-start">{ISRAELI_ID_INVALID_MSG}</p>
                              ) : null}
                            </Field>
                            <Field>
                              <FieldLabel>תאריך לידה</FieldLabel>
                              <Input
                                type="date"
                                dir="ltr"
                                className="text-end"
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
                                dir="rtl"
                                className={EDIT_DRAWER_SELECT_CLASS}
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
                                dir="rtl"
                                className={EDIT_DRAWER_SELECT_CLASS}
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
                                dir="rtl"
                                className={EDIT_DRAWER_SELECT_CLASS}
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
                                dir="rtl"
                                className={EDIT_DRAWER_SELECT_CLASS}
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
                                className="font-mono text-end"
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
                                className="text-end"
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
                <TabsContent value="transaction" className="mt-4 space-y-4 text-right" dir="rtl">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>סכום עסקה (₪)</FieldLabel>
                        <Input type="number" dir="ltr" value={editForm.payerAmount} readOnly className="bg-muted text-end font-mono" />
                      </Field>
                      <Field>
                        <FieldLabel>עמלת סוכן (₪)</FieldLabel>
                        <Input type="number" dir="ltr" value={editForm.agentCommission} readOnly className="bg-muted text-end font-mono" />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>סוכן</FieldLabel>
                        <Input value={editForm.agentName || '—'} readOnly className="bg-muted" />
                      </Field>
                      <Field>
                        <FieldLabel>תחילת מנוי</FieldLabel>
                        <Input type="date" dir="ltr" value={editForm.subscriptionStartDate} readOnly className="bg-muted text-end" />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>תאריך יצירה</FieldLabel>
                      <Input dir="ltr" value={fmtDateTime(editForm.createdAt)} readOnly className="bg-muted text-end font-mono text-xs" />
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
              <DialogDescription>הגדרות סינון</DialogDescription>
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
                  <select
                    value={filters.organizationSearch}
                    onChange={(e) => setFilters((p) => ({ ...p, organizationSearch: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">הכל</option>
                    {organizationOptions.map((org) => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>סוג תשלום</FieldLabel>
                  <select
                    value={filters.paymentTypeFilter}
                    onChange={(e) => setFilters((p) => ({ ...p, paymentTypeFilter: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">הכל</option>
                    <option value="centralized">מרוכז (ארגון משלם)</option>
                    <option value="private">פרטי (כרטיס אשראי)</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel>סוג לקוח</FieldLabel>
                  <select
                    value={filters.customerSegmentFilter}
                    onChange={(e) => setFilters((p) => ({ ...p, customerSegmentFilter: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">הכל</option>
                    <option value="org">ארגוני (עובד ארגון)</option>
                    <option value="b2c">פרטי (B2C)</option>
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
                  }}
                >
                  סגירה
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
                עסקאות
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" disabled title="בקרוב">
                <Download className="size-4 me-2" />
                ייצוא
              </Button>
            </div>
          </div>

          <div className="w-full mb-6">
            {/* כרטיסי סטטיסטיקה מאוחדים — נתונים כלליים + מסנני קטגוריות */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              
              {/* 1. קוביות סטטיסטיקה כלליות */}
              <StatsCard title="סה״כ הכנסות" value={formatCurrency(visibleSummary.totalRevenue)} icon={TrendingUp} loading={loading} />
              <StatsCard title="עסקאות בתוצאות" value={visibleRows.length} icon={Users} loading={loading} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg outline-none">
                    <StatsCard title={statusSummaryTitle} value={statusSummaryValue} icon={Calendar} loading={loading} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>לפי מסנני הקטגוריות והדוח בשרת</TooltipContent>
              </Tooltip>

              {/* 2. קוביות הסטטיסטיקה של הקטגוריות */}
              {SUMMARY_ITEMS.map((item) => {
                const itemCount = calculatedCounts[item.key] || 0; 
                return (
                  <StatsCard 
                    key={item.key} 
                    title={item.label} 
                    value={itemCount} 
                    icon={Users} 
                    loading={loading} 
                  />
                );
              })}
              
            </div>
          </div>
          {/* שורת חיפוש + סינון */}
          <Card dir="rtl" className="text-right border-border/60 shadow-sm">
            <CardContent className="pt-6">
              <UnifiedFilterShell
                filters={unifiedFilterConfig}
                values={unifiedFilterValues}
                onChange={(next) => {
                  setLiveSearch(String(next.search || ''));
                  setFilters((p) => ({
                    ...p,
                    customerSegment: String(next.customerSegment || 'all'),
                    month: String(next.month || ''),
                    fromDate: String(next.fromDate || ''),
                    toDate: String(next.toDate || ''),
                    status: String(next.status || 'all'),
                    agentFilter: String(next.agentFilter || ''),
                    organizationFilter: String(next.organizationFilter || ''),
                    productFilter: String(next.productFilter || ''),
                    documentStatusFilter: String(next.documentStatusFilter || ''),
                    paymentTypeFilter: String(next.paymentTypeFilter || ''),
                    customerSegmentFilter: String(next.customerSegmentFilter || ''),
                  }));
                }}
                onClear={clearFilters}
                advancedContent={(
                  <div className="text-sm text-muted-foreground">
                    למסננים מתקדמים מלאים פתחו את חלון הסינון.
                    <Button type="button" variant="outline" size="sm" onClick={() => setFilterDialogOpen(true)} className="ms-2">
                      פתח מסננים
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4 pb-2">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="text-right">
                  <CardTitle>עסקאות</CardTitle>
                </div>

              </div>
            </CardHeader>
            <CardContent className="pt-2" dir="rtl">
              {selectedCount > 0 ? (
                <div className="fixed bottom-4 inset-x-0 z-40 mx-auto w-[min(96vw,48rem)] rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{`${selectedCount} מנויים נבחרו`}</p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedSubscriptionIds([])} disabled={bulkDeleteLoading}>
                        נקה בחירה
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkDeleteLoading}>
                        {bulkDeleteLoading ? <Spinner className="me-2" /> : <Archive className="size-4 me-1" />}
                        מחיקת נבחרים
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
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
                <div className="rounded-md border overflow-x-auto -mx-4 md:mx-0">
                  <Table dir="rtl" className="text-right min-w-[900px]">
                    <TableHeader>
                        <TableRow className="[&_th]:text-right" dir="rtl">
                        <TableHead dir="rtl" className="w-12 text-right">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={allVisibleSelected}
                            onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                            aria-label="בחר הכל"
                          />
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          לקוח
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          סכום
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          מס&apos; הזמנה
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          תאריך הצטרפות
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          סטטוס השלמת מסמכים
                        </TableHead>
                        <TableHead dir="rtl" className="text-right">
                          סטטוס חיוב עתידי
                        </TableHead>
                        <TableHead dir="rtl" className="w-28 text-right">
                          פעולות
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((r) => {
                          const isCancelled = r.status === 'canceled' || String(r.subscriptionStatus || '').toLowerCase() === 'cancelled';
                          const statusNorm = String(r.subscriptionStatus || r.paymentStatus || '').trim().toLowerCase();
                          const isPendingCancellation = String(r.subscriptionStatus || '') === 'Pending Cancellation';
                          const workflowStatus = String(r.raw?.status || '').trim().toLowerCase();
                          const isPendingOrgApproval = workflowStatus === 'pending_org_approval';
                          // A customer is centralized only when the server says so AND there is no
                          // cardcomToken — an org employee who pays privately has a token and must
                          // go through the Cardcom cancel flow, not the org-employee cancel flow.
                          const hasCardcomToken = !!String(r.cardcomToken || '').trim();
                          const isCentralized = r.isCentralized === true && !hasCardcomToken;
                          const missingRecurringIds =
                            !String(r.cardcomAccountId || '').trim() || !String(r.cardcomRecurringId || '').trim();
                          const cancelledAtText = r.cancellationDate
                            ? fmtDateTime(r.cancellationDate)
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
                          <TableCell dir="rtl" className="text-right align-top">
                            <input
                              type="checkbox"
                              className={checkboxClass}
                              checked={selectedSubscriptionIds.includes(String(r.id || ''))}
                              onChange={(e) => toggleSubscriptionSelection(r.id, e.target.checked)}
                              aria-label={`בחר מנוי ${r.transactionId || r.id}`}
                            />
                          </TableCell>
                          <TableCell dir="rtl" className="text-right">
                            <div className="flex w-full flex-col items-end gap-1 text-right">
                              <span>{r.fullName || '—'}</span>
                              {r.organizationBadge ? (
                                <Badge variant="outline" className="text-xs font-normal max-w-full whitespace-normal text-right">
                                  {r.organizationBadge}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell dir="rtl" className="text-right">
                            {formatCurrency(r.amount)}
                          </TableCell>
                          <TableCell dir="rtl" className="font-mono text-xs text-right">
                            {r.transactionId}
                          </TableCell>
                          <TableCell dir="rtl" className="whitespace-nowrap text-xs text-right">
                            {fmtDateTime(r.createdAt)}
                          </TableCell>
                          <TableCell dir="rtl" className="text-right align-top">
                            {r.pendingBeneficiaryCompletion ? (
                              <Badge
                                className="bg-orange-500 hover:bg-orange-600 text-white border-0 cursor-pointer"
                                onClick={() => openEdit(r)}
                              >
                                ממתין להשלמת מסמכים
                              </Badge>
                            ) : (
                              <Badge className={isCancelled ? 'bg-gray-500 hover:bg-gray-600 text-white border-0' : 'bg-emerald-600 hover:bg-emerald-600 text-white border-0'}>
                                הושלם
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell dir="rtl" className="text-right whitespace-nowrap">
                            {isCancelled ? (
                              <Badge variant="destructive" className="font-normal">
                                {isCentralized
                                  ? `בוטל${cancelledAtText ? ` ב-${cancelledAtText}` : ''}`
                                  : `בוטל מול קארדקום${cancelledAtText ? ` ב-${cancelledAtText}` : ''}`}
                              </Badge>
                            ) : isPendingCancellation ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100 font-normal cursor-help">
                                    {pendingCancelLabel(r.finalBillingMonth)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>חודש חיוב אחרון: {r.finalBillingMonth}. החל מה-1 לחודש הבא לא ייספר בחיוב.</TooltipContent>
                              </Tooltip>
                            ) : String(r.futureBillingStatus || '').trim() ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help text-sm whitespace-pre-wrap max-w-[12rem] inline-block">
                                    {String(r.futureBillingStatus || '').trim()}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {`למידע נוסף, ניתן לבדוק בממשק קארדקום תחת מזהה הוראת קבע: ${r.cardcomRecurringId || '—'}`}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="secondary">פעיל</Badge>
                            )}
                          </TableCell>
                          <TableCell dir="rtl" className="text-right">
                            <div className="hidden md:flex items-center justify-end gap-1 flex-wrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="min-h-9 min-w-9 shrink-0"
                                    onClick={() => {
                                      setSelected(r.raw ?? r);
                                      setSelectedDetailsTab('transaction');
                                    }}
                                    aria-label="הצג פרטים"
                                  >
                                    <Eye className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>הצג פרטים</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="min-h-9 min-w-9 shrink-0"
                                    onClick={() => openEdit(r)}
                                    aria-label="ערוך"
                                  >
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
                                    className="min-h-9 min-w-9 shrink-0"
                                    onClick={() => requestArchiveForRow(r)}
                                    aria-label="מחק"
                                  >
                                    <Archive className="size-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>מחיקה</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className={`h-8 px-2 text-xs shrink-0 ${isPendingOrgApproval ? 'opacity-60 pointer-events-auto' : ''}`}
                                      disabled={
                                        isCancelled || isPendingCancellation || (!isCentralized && missingRecurringIds)
                                      }
                                      onClick={() => {
                                        if (isPendingOrgApproval) {
                                          window.alert(PENDING_ORG_CANCEL_ALERT_HE);
                                          return;
                                        }
                                        if (isCancelled || isPendingCancellation || (!isCentralized && missingRecurringIds)) {
                                          return;
                                        }
                                        if (isCentralized) {
                                          setCancelOrgTarget({ id: r.id, transactionId: r.transactionId });
                                          setTerminationDate('');
                                        } else {
                                          setCancelTarget({ id: r.id, transactionId: r.transactionId });
                                        }
                                      }}
                                      title={
                                        isPendingCancellation
                                          ? `ממתין לביטול — חודש אחרון: ${r.finalBillingMonth}`
                                          : isPendingOrgApproval
                                            ? PENDING_ORG_CANCEL_ALERT_HE
                                            : !isCentralized && missingRecurringIds
                                              ? 'Subscription was not created as recurring - cancel manually in Cardcom'
                                              : isCentralized
                                                ? 'ביטול מנוי עובד ארגוני (חיוב מרוכז)'
                                                : 'ביטול מנוי (עצירת חיוב עתידי)'
                                      }
                                    >
                                      <Ban className="size-3.5 text-amber-600 sm:me-1" />
                                      <span className="hidden sm:inline">
                                        {isCentralized ? 'ביטול עובד ארגוני' : 'ביטול מנוי (עצירת חיוב עתידי)'}
                                      </span>
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {isPendingOrgApproval ? <TooltipContent>{PENDING_ORG_CANCEL_ALERT_HE}</TooltipContent> : null}
                              </Tooltip>
                            </div>
                            <details className="relative md:hidden">
                              <summary className="flex h-10 w-10 min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-md border border-input bg-background hover:bg-accent [&::-webkit-details-marker]:hidden">
                                <MoreVertical className="size-4" aria-hidden />
                                <span className="sr-only">תפריט פעולות</span>
                              </summary>
                              <div
                                className="absolute end-0 top-full z-[60] mt-1 flex min-w-[12rem] flex-col rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                dir="rtl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  type="button"
                                  className="h-auto min-h-10 w-full justify-start gap-2 px-3 py-2 font-normal"
                                  onClick={(e) => {
                                    closeActionDetailsMenu(e);
                                    setSelected(r.raw ?? r);
                                    setSelectedDetailsTab('transaction');
                                  }}
                                >
                                  <Eye className="size-4 shrink-0" />
                                  הצג פרטים
                                </Button>
                                <Button
                                  variant="ghost"
                                  type="button"
                                  className="h-auto min-h-10 w-full justify-start gap-2 px-3 py-2 font-normal"
                                  onClick={(e) => {
                                    closeActionDetailsMenu(e);
                                    openEdit(r);
                                  }}
                                >
                                  <Edit2 className="size-4 shrink-0" />
                                  עריכה
                                </Button>
                                <Button
                                  variant="ghost"
                                  type="button"
                                  className="h-auto min-h-10 w-full justify-start gap-2 px-3 py-2 font-normal text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    closeActionDetailsMenu(e);
                                    requestArchiveForRow(r);
                                  }}
                                >
                                  <Archive className="size-4 shrink-0" />
                                  מחיקה
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={`h-auto min-h-10 w-full justify-start gap-2 px-3 py-2 text-xs font-normal ${isPendingOrgApproval ? 'opacity-60' : ''}`}
                                  disabled={
                                    isCancelled || isPendingCancellation || (!isCentralized && missingRecurringIds)
                                  }
                                  onClick={(e) => {
                                    closeActionDetailsMenu(e);
                                    if (isPendingOrgApproval) {
                                      window.alert(PENDING_ORG_CANCEL_ALERT_HE);
                                      return;
                                    }
                                    if (isCancelled || isPendingCancellation || (!isCentralized && missingRecurringIds)) {
                                      return;
                                    }
                                    if (isCentralized) {
                                      setCancelOrgTarget({ id: r.id, transactionId: r.transactionId });
                                      setTerminationDate('');
                                    } else {
                                      setCancelTarget({ id: r.id, transactionId: r.transactionId });
                                    }
                                  }}
                                >
                                  <Ban className="size-3.5 shrink-0 text-amber-600" />
                                  {isCentralized ? 'ביטול עובד ארגוני' : 'ביטול מנוי (עצירת חיוב)'}
                                </Button>
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                          );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent
            className="w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-right p-4 sm:p-6"
            dir="rtl"
          >
            <DialogHeader>
              <DialogTitle>פרטי מוטבים</DialogTitle>
              <DialogDescription>
                הזמנה: <span className="font-mono">{selected?.transactionId || '—'}</span>
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={selectedDetailsTab}
              onValueChange={setSelectedDetailsTab}
              dir="rtl"
              className="overflow-hidden text-right"
            >
              <TabsList className="grid w-full grid-cols-2 h-auto">
                <TabsTrigger
                  value="transaction"
                  className="text-[11px] sm:text-sm whitespace-normal leading-tight"
                >
                  פרטי עסקה
                </TabsTrigger>
                <TabsTrigger
                  value="beneficiary"
                  className="text-[11px] sm:text-sm whitespace-normal leading-tight"
                >
                  פרטי מוטב
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transaction" className="overflow-auto max-h-[68vh] space-y-4 mt-3">
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
                      <p className="text-xs text-muted-foreground mb-1">מוצר / סוג מנוי</p>
                      <p className="font-semibold">
                        {selected?.formState?.productName || selected?.productName || selected?.formState?.selectedPlanId || '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        עלות ספק {(selected?.providerName || selected?.formState?.providerName || selected?.formState?.vendorName) ? `- ${selected.providerName || selected.formState.providerName || selected.formState.vendorName}` : ''}
                      </p>
                      <p className="font-semibold">{formatCurrency(selected?.formState?.resolvedVendorCost ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        עלות סוכן {(selected?.agentName || selected?.formState?.agentName) ? `- ${selected.agentName || selected.formState.agentName}` : ''}
                      </p>
                      <p className="font-semibold">{formatCurrency(selected?.formState?.resolvedAgentCommission ?? selected?.agentCommission ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">רווח נקי</p>
                      <p className="font-semibold text-primary">
                        {formatCurrency(selected?.formState?.resolvedNetProfit ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">תאריך תחילת מנוי</p>
                      <p className="font-semibold">{selected?.formState?.subscriptionStartDate || selected?.subscriptionStartDate || '—'}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900">
                      <p className="text-xs text-muted-foreground mb-1">מס' הוראת קבע בקארדקום (לבדיקת היסטוריית חיוביים)</p>
                      <p className="font-semibold" dir="ltr">
                        {resolvedCardcomRecurringId || '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="beneficiary" className="overflow-auto max-h-[68vh] space-y-4 mt-3">
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
              </TabsContent>
            </Tabs>
            <DialogFooter className="flex-row-reverse sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                סגור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {toastMessage ? (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive shadow-md">
            {toastMessage}
          </div>
        ) : null}
      </AdminPageShell>
    </TooltipProvider>
  );
}
