import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Edit2,
  Upload,
  Download,
  ArrowRight,
  Users,
  DollarSign,
  Clock,
  UserX,
  RefreshCw,
  Wallet,
  UserCheck,
  CalendarClock,
  FileSpreadsheet,
  Ban,
  Archive,
  Lock,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../components/ui/empty.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';
import * as XLSX from 'xlsx';
import { ARCHIVE_BLOCKED_PRIVATE_MSG, canArchiveDealUi } from '../utils/archiveEligibility.js';

const TOKEN_KEY = 'opal_admin_token';

const PENDING_ORG_CANCEL_ALERT_HE =
  'לקוח זה לא אושר על ידי הארגון ולא הופעל לו מנוי, ולכן לא ניתן לבטל את המנוי. ניתן להעביר לארכיון בלבד. פעולה זו תגרור השבתה של יכולת מנהל הארגון לאשר עובד זה בעתיד';
const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Provider cost for pricing display: price-list line vendor cost when linked + matchable; else product catalog. */
function getPricingProviderCost(org, priceLists, products) {
  const name = String(org?.subscriptionProductName || '').trim();
  const prodByName = name
    ? (products || []).find((p) => String(p.productName || p.name || '').trim() === name)
    : null;
  const plId = String(org?.priceListId || '').trim();
  if (plId) {
    const pl = (priceLists || []).find((l) => String(l.id) === plId);
    if (pl?.lines?.length && prodByName?.id) {
      const line = pl.lines.find((ln) => String(ln.productId) === String(prodByName.id));
      if (line != null && Number.isFinite(Number(line.vendorCost))) {
        return Math.max(0, Number(line.vendorCost));
      }
    }
    if (pl?.lines?.length) {
      const first = pl.lines[0];
      if (first != null && Number.isFinite(Number(first.vendorCost))) {
        return Math.max(0, Number(first.vendorCost));
      }
    }
  }
  if (prodByName != null && Number.isFinite(Number(prodByName.providerCost))) {
    return Math.max(0, Number(prodByName.providerCost));
  }
  return 0;
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

/**
 * מחזיר badge לסטטוס עובד — מבוסס על entitlementStatus בלבד.
 * @param {string} statusRaw
 * @param {string} finalBillingMonth
 */
function getEmployeeStatusBadge(statusRaw, finalBillingMonth = '') {
  const status = String(statusRaw || '').trim().toLowerCase();
  if (status === 'canceled' || status === 'cancelled') {
    return { label: 'מבוטל', className: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (status === 'pending_cancellation') {
    return { label: pendingCancelLabel(finalBillingMonth), className: 'bg-orange-100 text-orange-800 border-orange-300' };
  }
  if (status === 'not_activated') {
    return { label: 'ממתין לאישור', className: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (status === 'active') {
    return { label: 'מאושר · פעיל', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }

  return null;
}

function ContactSection({ title, data, onChange }) {
  return (
    <div className="space-y-3 border rounded-lg p-3 text-right" dir="rtl">
      <p className="font-medium text-sm">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel className="text-right w-full">שם</FieldLabel>
          <Input dir="rtl" className="text-right" value={data?.name || ''} onChange={(e) => onChange('name', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel className="text-right w-full">תפקיד</FieldLabel>
          <Input dir="rtl" className="text-right" value={data?.role || ''} onChange={(e) => onChange('role', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel className="text-right w-full">טלפון</FieldLabel>
          <Input dir="rtl" className="text-right" value={data?.phone || ''} onChange={(e) => onChange('phone', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel className="text-right w-full">נייד</FieldLabel>
          <Input dir="rtl" className="text-right" value={data?.mobile || ''} onChange={(e) => onChange('mobile', e.target.value)} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel className="text-right w-full">אימייל</FieldLabel>
          <Input dir="rtl" className="text-right" value={data?.email || ''} onChange={(e) => onChange('email', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [org, setOrg] = useState(null);
  const [deals, setDeals] = useState([]);
  const [tab, setTab] = useState('members');
  const [saveLoading, setSaveLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [billingConfirmOpen, setBillingConfirmOpen] = useState(false);
  const [billingChangePending, setBillingChangePending] = useState(null);
  const [products, setProducts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [registrationLinkCopied, setRegistrationLinkCopied] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [billingReportMonth, setBillingReportMonth] = useState(() => monthNow());
  const [billingReportLoading, setBillingReportLoading] = useState(false);
  const [billingReport, setBillingReport] = useState({
    summary: { totalDue: 0, totalActiveRecords: 0, totalProrated: 0, totalFinalMonth: 0 },
    rows: [],
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelOrgTarget, setCancelOrgTarget] = useState(null);
  const [cancelOrgLoading, setCancelOrgLoading] = useState(false);
  const [cancelOrgErr, setCancelOrgErr] = useState('');

  const [priceLists, setPriceLists] = useState([]);

  // ── Billing Snapshots (גבייה) ──
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockErr, setLockErr] = useState('');
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapEditForm, setSnapEditForm] = useState({ status: 'Pending', invoiceNum: '', receiptNum: '', notes: '' });
  const [saveSnapBusy, setSaveSnapBusy] = useState(false);
  const [settingsInnerTab, setSettingsInnerTab] = useState('org');
  const [settingsSaveOk, setSettingsSaveOk] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!token || !id) return;
    setSnapshotsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/billing-snapshots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) setSnapshots(Array.isArray(j.snapshots) ? j.snapshots : []);
    } catch {
      // non-fatal
    } finally {
      setSnapshotsLoading(false);
    }
  }, [id, token]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    try {
      const [oRes, dRes, prRes, payRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/deals`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);
      if (!oRes.success) throw new Error(oRes.error || 'טעינת ארגון נכשלה');
      setOrg(oRes.organization);
      setDeals(Array.isArray(dRes.deals) ? dRes.deals : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setPayments(Array.isArray(payRes?.rows) ? payRes.rows : []);
      if (plRes?.success) setPriceLists(Array.isArray(plRes.lists) ? plRes.lists : []);
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const loadBillingReport = useCallback(async () => {
    if (!token || !id) return;
    setBillingReportLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/billing-report?month=${encodeURIComponent(
          billingReportMonth
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'טעינת דוח חיובים נכשלה');
      setBillingReport({
        summary: {
          totalDue: Number(j.summary?.totalDue || 0),
          totalActiveRecords: Number(j.summary?.totalActiveRecords || 0),
          totalProrated: Number(j.summary?.totalProrated || 0),
          totalFinalMonth: Number(j.summary?.totalFinalMonth || 0),
        },
        rows: Array.isArray(j.rows) ? j.rows : [],
      });
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setBillingReportLoading(false);
    }
  }, [billingReportMonth, id, token]);

  useEffect(() => {
    const tabParam = String(searchParams.get('tab') || '').trim();
    if (tabParam === 'payments') setTab('payments');
    if (tabParam === 'billing-report') setTab('billing-report');
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadBillingReport();
  }, [loadBillingReport]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const pricingProviderCost = useMemo(
    () => getPricingProviderCost(org, priceLists, products),
    [org, org?.priceListId, org?.subscriptionProductName, priceLists, products]
  );

  const netProfitLive = useMemo(() => {
    const raw = org?.monthlyPricePerMember;
    const m = raw === '' || raw == null ? 0 : Number(raw);
    const safe = Number.isFinite(m) ? m : 0;
    return safe - pricingProviderCost;
  }, [org?.monthlyPricePerMember, pricingProviderCost]);

  const selectedProductForBilling = useMemo(() => {
    const name = String(org?.subscriptionProductName || '').trim();
    if (!name) return null;
    return (products || []).find((p) => String(p.productName || p.name || '').trim() === name) || null;
  }, [org?.subscriptionProductName, products]);

  const summaryStats = useMemo(() => {
    const rows = Array.isArray(deals) ? deals : [];
    let openDebt = 0;
    const snapList = Array.isArray(snapshots) ? snapshots : [];
    for (const s of snapList) {
      if (String(s.status || '').trim() !== 'Pending') continue;
      openDebt += Number(s.totalAmount || 0);
    }
    let activeEmployees = 0;
    let pendingApprovalEmployees = 0;
    let pendingCancellationEmployees = 0;
    let canceledEmployees = 0;

    const normalizeStatus = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    for (const row of rows) {
      const entitlement = normalizeStatus(row?.entitlementStatus);

      if (entitlement === 'active') activeEmployees += 1;
      if (entitlement === 'not_activated') pendingApprovalEmployees += 1;
      if (entitlement === 'pending_cancellation') pendingCancellationEmployees += 1;
      if (entitlement === 'canceled' || entitlement === 'cancelled') canceledEmployees += 1;
    }

    return {
      openDebt,
      activeEmployees,
      pendingApprovalEmployees,
      pendingCancellationEmployees,
      canceledEmployees,
    };
  }, [deals, snapshots]);

  async function lockSnapshot() {
    if (!id || !token) return;
    setLockLoading(true);
    setLockErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/billing-snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          month: billingReportMonth,
          totalAmount: billingReport.summary.totalDue,
          totalEmployees: billingReport.summary.totalActiveRecords,
          rows: billingReport.rows,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'נעילת דוח נכשלה');
      await loadSnapshots();
      setTab('payments');
    } catch (e) {
      setLockErr(e.message || 'שגיאה');
    } finally {
      setLockLoading(false);
    }
  }

  function downloadSnapshotXlsx(snap) {
    const rows = (snap.reportData || []).map((r) => ({
      'שם עובד': r.employeeName || '—',
      'ת"ז': r.idNumber || '—',
      'תחילת מנוי': formatDateDdMmYyyy(r.subscriptionStartDate),
      'מחיר מנוי מקור': Number(r.basePrice || 0),
      'תאריך ביטול': formatDateDdMmYyyy(r.cancellationDate),
      'סטטוס חודשי': `${Number(r.monthlyStatusPct ?? 100)}% (${r.monthlyStatusSubtext || 'מלא'})`,
      'ימים פעילים': r.activeDays ?? '',
      'סכום לחיוב': Number(r.billedAmount || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח חיובים');
    XLSX.writeFile(wb, `opal-billing-snapshot-${snap.orgName || 'org'}-${snap.month}.xlsx`);
  }

  async function saveSnapEdit() {
    if (!snapEditTarget?.id || !token) return;
    setSaveSnapBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/billing-snapshots/${encodeURIComponent(snapEditTarget.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(snapEditForm),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      await loadSnapshots();
    } catch (e) {
      setLockErr(e.message || 'שגיאה');
    } finally {
      setSaveSnapBusy(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  function handlePriceListSelect(plId) {
    if (!plId) {
      setOrg((p) => ({ ...p, priceListId: '' }));
      return;
    }
    const pl = priceLists.find((l) => l.id === plId);
    if (!pl) {
      setOrg((p) => ({ ...p, priceListId: plId }));
      return;
    }
    const firstLine = (pl.lines || [])[0];
    if (!firstLine) {
      setOrg((p) => ({ ...p, priceListId: plId }));
      return;
    }
    const prod = (products || []).find((p) => String(p.id) === String(firstLine.productId));
    const productName = String(prod?.productName || prod?.name || '').trim();
    setOrg((p) => ({
      ...p,
      priceListId: plId,
      monthlyPricePerMember: firstLine.retailPrice,
      ...(productName && { subscriptionProductName: productName }),
    }));
  }

  function formatDateDdMmYyyy(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('he-IL');
  }

  function requestArchiveForDeal(d) {
    const archiveEligibility = canArchiveDealUi({
      entitlementStatus: d.entitlementStatus,
      isCentralizedBilling: !!d.isCentralized,
      pendingCancellationDateLabel: d.finalBillingMonth || '',
    });
    if (!archiveEligibility.allowed) {
      window.alert(archiveEligibility.reason || ARCHIVE_BLOCKED_PRIVATE_MSG);
      return;
    }
    if (archiveEligibility.reason) {
      const ok = window.confirm(archiveEligibility.reason);
      if (!ok) return;
    }
    setDeleteTarget({ id: d.id, transactionId: d.transactionId });
  }

  function exportBillingReportToXlsx() {
    const rows = (billingReport.rows || []).map((r) => ({
      'שם עובד': r.employeeName || '—',
      'ת"ז': r.idNumber || '—',
      'תחילת מנוי': formatDateDdMmYyyy(r.subscriptionStartDate),
      'מחיר מנוי מקור': Number(r.basePrice || 0),
      'תאריך ביטול': formatDateDdMmYyyy(r.cancellationDate),
      'סטטוס חודשי': `${Number(r.monthlyStatusPct ?? 100)}% (${r.monthlyStatusSubtext || 'מלא'})`,
      'ימים פעילים': r.activeDays ?? '',
      'סכום לחיוב': Number(r.billedAmount || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח חיובים');
    XLSX.writeFile(wb, `opal-billing-report-${org?.companyName || 'organization'}-${billingReportMonth}.xlsx`);
  }

  function setContact(section, field, value) {
    setOrg((p) => (p ? { ...p, [section]: { ...(p[section] || {}), [field]: value } } : null));
  }

  async function saveOrg(e) {
    e.preventDefault();
    if (!org?.id) return;
    setSaveLoading(true);
    setErr('');
    try {
      const { id: oid, activeMemberCount, name: _n, taxId: _t, ...body } = org;
      body.monthlyPricePerMember = Number(body.monthlyPricePerMember || 0);
      body.employeesCount = Number(body.employeesCount || 0);
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      setSettingsSaveOk(true);
      await load();
    } catch (e2) {
      setErr(e2.message || 'שגיאה');
    } finally {
      setSaveLoading(false);
    }
  }

  async function confirmArchiveDeal() {
    if (!deleteTarget?.id || !token) return;
    setDeleteLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'מחיקה נכשלה');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      const msg = String(err?.message || '');
      if (/לא ניתן להעביר לארכיון/.test(msg)) {
        setErr(msg);
      } else {
        setErr(msg || 'שגיאה');
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmCancelOrgEmployee() {
    if (!cancelOrgTarget?.id || !token) return;
    setCancelOrgLoading(true);
    setCancelOrgErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals/${encodeURIComponent(cancelOrgTarget.id)}/cancel-org-employee`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'ביטול נכשל');
      setCancelOrgTarget(null);
      await load();
    } catch (err) {
      setCancelOrgErr(err.message || 'שגיאה');
    } finally {
      setCancelOrgLoading(false);
    }
  }

  async function downloadTemplate() {
    const res = await fetch(`${API_BASE}/api/admin/organizations/import-template-xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'opal-org-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(href);
  }

  async function runImport() {
    if (!importFile || !id) return;
    setImportBusy(true);
    setImportResult(null);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}/import-members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [];
        if (Array.isArray(j.headerErrors) && j.headerErrors.length) {
          parts.push(`כותרות: ${j.headerErrors.join('; ')}`);
        }
        if (j.error) parts.push(j.error);
        throw new Error(parts.join(' ') || 'ייבוא נכשל');
      }
      if (!j.success) throw new Error(j.error || 'ייבוא נכשל');
      setImportResult(j);
      await load();
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setImportFile(null);
      setFileInputKey((k) => k + 1);
      setImportBusy(false);
    }
  }

  if (!token) {
    return (
      <AdminPageShell>
        <p className="p-6 text-muted-foreground">נדרשת התחברות לממשק ניהול.</p>
      </AdminPageShell>
    );
  }

  if (loading && !org) {
    return (
      <AdminPageShell>
        <div className="flex justify-center p-12">
          <Spinner className="size-10" />
        </div>
      </AdminPageShell>
    );
  }

  if (!org) {
    return (
      <AdminPageShell>
        <p className="p-6 text-destructive">{err || 'ארגון לא נמצא'}</p>
        <Button variant="outline" asChild>
          <Link to="/admin/organizations">חזרה לרשימה</Link>
        </Button>
      </AdminPageShell>
    );
  }

  const billingLabel = org.billingType === 'Centralized' ? 'תשלום מרוכז' : 'תשלום פרטי';
  const billingTypeNorm = String(org.billingType || '').trim().toLowerCase();
  const isCentralizedBilling = billingTypeNorm === 'centralized';
  const privateBillingDeals = deals || [];
  const privateRegistrationUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?orgId=${org.id || ''}`;
  const centralizedRegistrationUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/org-employee-register?orgId=${org.id || ''}`;

  return (
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
        onConfirm={confirmArchiveDeal}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteLoading}
      />
      <Dialog
        open={!!cancelOrgTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCancelOrgTarget(null);
            setCancelOrgErr('');
          }
        }}
      >
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
          {cancelOrgErr ? <p className="text-destructive text-sm mt-2">{cancelOrgErr}</p> : null}
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
      {/* ── Snapshot Edit Dialog ── */}
      <Dialog open={snapEditOpen} onOpenChange={(o) => { if (!o) setSnapEditOpen(false); }}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת דרישת תשלום</DialogTitle>
            <DialogDescription>
              {snapEditTarget ? `${snapEditTarget.orgName} · ${snapEditTarget.month}` : ''}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel className="text-right w-full">סטטוס</FieldLabel>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-right"
                dir="rtl"
                value={snapEditForm.status}
                onChange={(e) => setSnapEditForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="Pending">ממתין לתשלום</option>
                <option value="Paid">שולם</option>
              </select>
            </Field>
            <Field>
              <FieldLabel className="text-right w-full">מספר חשבונית</FieldLabel>
              <Input dir="rtl" className="text-right" value={snapEditForm.invoiceNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceNum: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel className="text-right w-full">מספר קבלה</FieldLabel>
              <Input dir="rtl" className="text-right" value={snapEditForm.receiptNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, receiptNum: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel className="text-right w-full">הערות</FieldLabel>
              <Textarea dir="rtl" className="text-right min-h-[72px]" rows={2} value={snapEditForm.notes} onChange={(e) => setSnapEditForm((p) => ({ ...p, notes: e.target.value }))} />
            </Field>
          </FieldGroup>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={() => setSnapEditOpen(false)}>ביטול</Button>
            <Button type="button" disabled={saveSnapBusy} onClick={saveSnapEdit}>
              {saveSnapBusy && <Spinner className="me-2" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={billingConfirmOpen}
        title="שינוי סוג חיוב"
        message="שינוי סוג החיוב עלול לשבש את נתוני הלקוחות שכבר משויכים לארגון ושילמו בפועל. אם נדרש תמחור או מודל שונה, מומלץ להקים ארגון חדש במערכת."
        confirmLabel="אישור"
        onConfirm={() => {
          if (!billingChangePending) return;
          const v = billingChangePending.next;
          setOrg((p) =>
            p
              ? {
                  ...p,
                  billingType: v,
                  billingMethod: v === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
                }
              : p
          );
          setBillingConfirmOpen(false);
          setBillingChangePending(null);
        }}
        onCancel={() => {
          setBillingConfirmOpen(false);
          setBillingChangePending(null);
        }}
        isLoading={false}
      />
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto text-right" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ms-2" asChild>
              <Link to="/admin/organizations" className="gap-1">
                <ArrowRight className="size-4 rotate-180" />
                חזרה לרשימת ארגונים
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-7 text-primary" />
              {org.companyName || org.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 flex flex-wrap gap-2 items-center">
              <Badge variant="secondary">{billingLabel}</Badge>
              {String(org.status || 'active').toLowerCase() === 'pending' ? (
                <Badge variant="outline" className="border-amber-600 text-amber-900 bg-amber-50">
                  ממתין לאישור
                </Badge>
              ) : null}
              <span>ח.פ {org.companyId || org.taxId || '—'}</span>
              <span>·</span>
              <span>{org.activeMemberCount != null ? `${org.activeMemberCount} חברים פעילים` : ''}</span>
            </p>
            {org.billingType === 'Private' ? (
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={privateRegistrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 underline underline-offset-4 hover:text-blue-700"
                >
                  קישור הרשמה (תשלום פרטי)
                </a>
              </div>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            רענן נתונים
          </Button>
        </div>

        {err ? <p className="text-sm text-destructive">{err}</p> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          <StatsCard
            title="סה״כ חובות פתוחים"
            value={formatCurrency(summaryStats.openDebt)}
            icon={DollarSign}
            iconWrapperClassName="bg-blue-100 text-blue-700"
          />
          <StatsCard
            title="עובדים פעילים"
            value={String(summaryStats.activeEmployees)}
            icon={Users}
            iconWrapperClassName="bg-emerald-100 text-emerald-700"
          />
          <StatsCard
            title="ממתין לביטול"
            value={String(summaryStats.pendingCancellationEmployees)}
            icon={Clock}
            iconWrapperClassName="bg-amber-100 text-amber-700"
          />
          <StatsCard
            title="ממתין לאישור"
            value={String(summaryStats.pendingApprovalEmployees)}
            icon={Clock}
            iconWrapperClassName="bg-slate-100 text-slate-700"
          />
          <StatsCard
            title="מבוטלים"
            value={String(summaryStats.canceledEmployees)}
            icon={UserX}
            iconWrapperClassName="bg-red-100 text-red-700"
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            if (v !== 'settings') setSettingsSaveOk(false);
          }}
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="members" className="gap-1">
              <Users className="size-4" />
              גורמים בארגון
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1">
              <Upload className="size-4" />
              יבוא עובדים
            </TabsTrigger>
            <TabsTrigger value="settings">הגדרות</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1">
              <Lock className="size-4" />
              גבייה
            </TabsTrigger>
            <TabsTrigger value="billing-report">דוח חיובים</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4" dir="rtl">
            <TooltipProvider delayDuration={300}>
            <Card dir="rtl" className="text-right">
              <CardHeader className="text-right">
                <CardTitle>גורמים בארגון</CardTitle>
                <CardDescription>עסקאות עם organizationId של ארגון זה</CardDescription>
              </CardHeader>
              <CardContent>
                {deals.length === 0 ? (
                  <Empty>
                    <EmptyMedia variant="icon">
                      <Users className="size-8" />
                    </EmptyMedia>
                    <EmptyTitle>אין גורמים בארגון</EmptyTitle>
                    <EmptyDescription>השתמשו ביבוא גורמים בארגון להוספה </EmptyDescription>
                  </Empty>
                ) : (
                  <div className="rounded-md border overflow-x-auto" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead className="text-right">שם</TableHead>
                          <TableHead className="text-right">ת״ז</TableHead>
                          <TableHead className="text-right">לידה</TableHead>
                          <TableHead className="text-right">מין</TableHead>
                          <TableHead className="text-right">קופה</TableHead>
                          <TableHead className="text-right">אימייל</TableHead>
                          <TableHead className="text-right">טלפון</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">תאריך הצטרפות</TableHead>
                          <TableHead className="text-right">תאריך ביטול</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">מקור</TableHead>
                          <TableHead className="text-right">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deals.map((d) => {
                          // entitlementStatus כעת מגיע מהשרת דרך findDealsByOrganizationId
                          const entitlement = String(d.entitlementStatus || '').trim().toLowerCase();
                          const isPendingOrgApproval = entitlement === 'not_activated';
                          const isCancelled = entitlement === 'canceled';
                          const isPendingCancellation = entitlement === 'pending_cancellation';
                          const centralized = !!d.isCentralized;
                          return (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium text-right">{d.fullName || '—'}</TableCell>
                            <TableCell dir="ltr" className="font-mono text-xs text-end">
                              {d.idNumber || '—'}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap text-right">{d.dateOfBirth || '—'}</TableCell>
                            <TableCell className="text-xs text-right">{d.gender || '—'}</TableCell>
                            <TableCell className="text-xs text-right">{d.healthFund || '—'}</TableCell>
                            <TableCell dir="ltr" className="text-sm text-end">
                              {d.email || '—'}
                            </TableCell>
                            <TableCell dir="ltr" className="text-end">
                              {d.phone || '—'}
                            </TableCell>
                            <TableCell className="text-right">₪{Number(d.payerAmount || 0)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs font-mono text-right">
                              {d.createdAt ? new Date(d.createdAt).toLocaleDateString('he-IL') : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs font-mono text-right">
                              {d.cancellationDate ? new Date(d.cancellationDate).toLocaleDateString('he-IL') : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {(() => {
                                const badge = getEmployeeStatusBadge(
                                  entitlement,
                                  d.finalBillingMonth
                                );
                                if (badge) {
                                  return <Badge className={badge.className}>{badge.label}</Badge>;
                                }
                                return (
                                  <Badge variant="outline" className="text-xs">
                                    —
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground text-right">{d.source || '—'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 shrink-0"
                                      title="ערוך עסקה"
                                      type="button"
                                      onClick={() => {
                                        const params = new URLSearchParams();
                                        if (d.fullName) params.set('search', d.fullName);
                                        if (d.id) params.set('editId', String(d.id));
                                        navigate(`/admin/subscribers?${params.toString()}`);
                                      }}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>עריכה במסך מנויים</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 shrink-0 text-destructive"
                                      type="button"
                                      title="העברה לארכיון"
                                      onClick={() => requestArchiveForDeal(d)}
                                    >
                                      <Archive className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>מחק / ארכיון</TooltipContent>
                                </Tooltip>
                                {centralized ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 px-2 text-xs ${isPendingOrgApproval ? 'opacity-60' : ''}`}
                                        disabled={isCancelled || isPendingCancellation}
                                        title={
                                          isPendingOrgApproval
                                            ? PENDING_ORG_CANCEL_ALERT_HE
                                            : isPendingCancellation
                                              ? `ממתין לביטול — חודש אחרון: ${d.finalBillingMonth}`
                                              : 'ביטול עובד ארגוני (חיוב מרוכז)'
                                        }
                                        onClick={() => {
                                          if (isPendingOrgApproval) {
                                            window.alert(PENDING_ORG_CANCEL_ALERT_HE);
                                            return;
                                          }
                                          if (isCancelled || isPendingCancellation) {
                                            return;
                                          }
                                          setCancelOrgErr('');
                                          setCancelOrgTarget({ id: d.id, transactionId: d.transactionId });
                                        }}
                                      >
                                        <Ban className="size-3.5 text-amber-600 sm:me-1" />
                                        <span className="hidden sm:inline">ביטול עובד ארגוני</span>
                                      </Button>
                                    </TooltipTrigger>
                                    {isPendingOrgApproval ? (
                                      <TooltipContent className="max-w-sm">{PENDING_ORG_CANCEL_ALERT_HE}</TooltipContent>
                                    ) : null}
                                  </Tooltip>
                                ) : null}
                              </div>
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
            </TooltipProvider>
          </TabsContent>

          <TabsContent value="import" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>יבוא עובדים (Excel)</CardTitle>
                <CardDescription>
                  יש לשים לב שכל עובדים בהעלה ידנית יאושרו אוטומטית,בנוסף לכך כפילות לפי ת״ז תידלג.
                </CardDescription>
                <div className="mt-3 rounded-lg border border-[#285959]/25 bg-[#eef6f6] p-3">
                  <p className="text-sm font-semibold text-[#285959]">קישור הרשמה לעובדי הארגון (חיוב מרוכז)</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <a
                      href={centralizedRegistrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="text-sm underline text-[#285959] break-all flex-1"
                    >
                      {centralizedRegistrationUrl}
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#285959] text-[#285959] hover:bg-[#285959] hover:text-white"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(centralizedRegistrationUrl);
                          setRegistrationLinkCopied(true);
                          setTimeout(() => setRegistrationLinkCopied(false), 1500);
                        } catch {
                          setRegistrationLinkCopied(false);
                        }
                      }}
                    >
                      {registrationLinkCopied ? 'הועתק' : 'העתק קישור'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={downloadTemplate}>
                    <Download className="size-4 me-2" />
                    הורדת אקסל לדוגמה
                  </Button>
                </div>
                <Field>
                  <FieldLabel>קובץ</FieldLabel>
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </Field>
                <Button
                  type="button"
                  disabled={!importFile || importBusy}
                  onClick={runImport}
                  style={{ backgroundColor: '#285959', color: '#fff' }}
                  className="hover:opacity-90"
                >
                  {importBusy ? <Spinner className="size-4 me-2" /> : <Upload className="size-4 me-2" />}
                  יבוא
                </Button>
                {importResult ? (
                  <div className="rounded-lg border border-[#285959]/25 bg-[#eef6f6] p-4 text-sm space-y-2">
                    <p className="font-semibold text-[#285959]">
                      נוצרו בהצלחה: <strong>{importResult.created}</strong>
                      {importResult.skippedDuplicates > 0 && (
                        <span className="font-normal text-orange-700">
                          {' '}· דולגו (כפילות): <strong>{importResult.skippedDuplicates}</strong>
                        </span>
                      )}
                    </p>
                    {Array.isArray(importResult.skippedDetails) && importResult.skippedDetails.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <p className="font-medium text-orange-700">שורות שדולגו עקב כפילות:</p>
                        <ul className="list-disc list-inside text-orange-800 space-y-0.5">
                          {importResult.skippedDetails.map((d, i) => (
                            <li key={i}>
                              {d.fullName || '—'}{d.idNum ? ` (ת"ז: ${d.idNum})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(importResult.validationFailures) && importResult.validationFailures.length > 0 ? (
                      <div className="text-destructive space-y-1 max-h-48 overflow-y-auto border-t border-[#285959]/20 pt-2">
                        <p className="font-medium">שגיאות בשורות (לא יובאו):</p>
                        <ul className="list-disc list-inside">
                          {importResult.validationFailures.map((vf, i) => (
                            <li key={i}>
                              שורה {vf.line}: {Array.isArray(vf.messages) ? vf.messages.join('; ') : vf.messages}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle className="text-right w-full">הגדרות ארגון</CardTitle>

              </CardHeader>
              <CardContent>
                {settingsSaveOk ? (
                  <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                    השינויים בוצעו בהצלחה
                  </p>
                ) : null}
                <form onSubmit={saveOrg} className="space-y-6 text-right">
                  <Tabs
                    value={settingsInnerTab}
                    onValueChange={(v) => {
                      setSettingsInnerTab(v);
                      setSettingsSaveOk(false);
                    }}
                    dir="rtl"
                  >
                  <TabsList className="grid w-full grid-cols-3">
                   <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                      <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                       <TabsTrigger value="billing">תמחור מוצרים</TabsTrigger>

                    </TabsList>
                    <TabsContent value="org" className="mt-4 text-right w-full" dir="rtl">
                      <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel className="text-right w-full">שם החברה *</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right"
                              required
                              value={org.companyName || ''}
                              onChange={(e) => setOrg((p) => ({ ...p, companyName: e.target.value }))}
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-right w-full">ח&quot;פ</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right"
                              value={org.companyId || ''}
                              onChange={(e) => setOrg((p) => ({ ...p, companyId: e.target.value }))}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel className="text-right w-full">כתובת רשמית</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right"
                              value={org.officialAddress || ''}
                              onChange={(e) => setOrg((p) => ({ ...p, officialAddress: e.target.value }))}
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-right w-full">אימייל החברה</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right"
                              value={org.companyEmail || ''}
                              onChange={(e) => setOrg((p) => ({ ...p, companyEmail: e.target.value }))}
                            />
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel className="text-right w-full">הערות</FieldLabel>
                          <Textarea
                            dir="rtl"
                            className="text-right"
                            rows={3}
                            value={org.notes || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, notes: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-right w-full">תחום פעילות</FieldLabel>
                          <Input
                            dir="rtl"
                            className="text-right"
                            value={org.fieldOfActivity || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, fieldOfActivity: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-right w-full">מספר עובדים (הערכה)</FieldLabel>
                          <Input
                            type="number"
                            dir="rtl"
                            className="text-right"
                            value={org.employeesCount ?? ''}
                            onChange={(e) => setOrg((p) => ({ ...p, employeesCount: e.target.value }))}
                          />
                        </Field>
                      </FieldGroup>
                    </TabsContent>
                    <TabsContent value="contacts" className="mt-4 space-y-5">
                      <ContactSection
                        title="איש קשר ראשי"
                        data={org.contactPerson || {}}
                        onChange={(f, v) => setContact('contactPerson', f, v)}
                      />
                      <ContactSection
                        title="הנהלת חשבונות"
                        data={org.accounting || {}}
                        onChange={(f, v) => setContact('accounting', f, v)}
                      />
                      <ContactSection
                        title="איש קשר נוסף"
                        data={org.additionalContact || {}}
                        onChange={(f, v) => setContact('additionalContact', f, v)}
                      />
                    </TabsContent>
                    <TabsContent value="billing" className="mt-4 text-right w-full" dir="rtl">
                      <FieldGroup className="gap-5">
                        {/* Row 1: סוג חיוב */}
                        <Field>
                          <FieldLabel className="text-right w-full">סוג חיוב</FieldLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={org.billingType === 'Centralized' ? 'Centralized' : 'Private'}
                            onChange={(e) => {
                              const v = e.target.value;
                              const prev = org.billingType === 'Centralized' ? 'Centralized' : 'Private';
                              if (v === prev) return;
                              setBillingChangePending({ next: v, prev });
                              setBillingConfirmOpen(true);
                            }}
                          >
                            <option value="Private">תשלום פרטי (עם הנחת ארגון)</option>
                            <option value="Centralized">תשלום מרוכז</option>
                          </select>
                        </Field>

                        {/* Row 2: מחירון מקושר | שם המוצר */}
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 items-start">
                          <Field className="gap-2">
                            <FieldLabel className="text-right w-full">מחירון מקושר</FieldLabel>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={org.priceListId || ''}
                              onChange={(e) => handlePriceListSelect(e.target.value)}
                            >
                              <option value="">— ללא מחירון —</option>
                              {priceLists.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {pl.listName}{pl.orgName ? ` (${pl.orgName})` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground leading-snug mt-1">
                              שים לב: שינוי ידני של מחיר או מוצר תחת מחירון נבחר יצור אוטומטית מחירון חדש בדשבורד המחירונים.
                            </p>
                          </Field>

                          <Field>
                            <FieldLabel className="text-right w-full">שם המוצר</FieldLabel>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={org.subscriptionProductName || ''}
                              onChange={(e) => {
                                const name = e.target.value;
                                const prod = (products || []).find(
                                  (p) => String(p.productName || p.name || '').trim() === name
                                );
                                setOrg((p) => ({
                                  ...p,
                                  subscriptionProductName: name,
                                  ...(prod?.providerCost != null && !p.monthlyPricePerMember
                                    ? { monthlyPricePerMember: prod.providerCost }
                                    : {}),
                                }));
                              }}
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
                            {selectedProductForBilling ? (
                              <p className="text-xs text-muted-foreground mt-1.5 tabular-nums" dir="rtl">
                                <span className="text-muted-foreground">
                                  (סוג זרימה: {String(selectedProductForBilling.flowType || '—')})
                                </span>
                              </p>
                            ) : null}
                          </Field>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 items-start">
                          <Field>
                            <FieldLabel className="text-right w-full">שם ספק (אוטומטי מהמוצר)</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right bg-muted"
                              readOnly
                              value={(() => {
                                const prod = (products || []).find(
                                  (p) => String(p.productName || p.name || '').trim() === (org.subscriptionProductName || '')
                                );
                                return String(prod?.provider?.vendorName || '');
                              })()}
                              placeholder="ייבחר אוטומטית לפי המוצר"
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-right w-full">עלות ספק (₪)</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right bg-muted tabular-nums"
                              readOnly
                              value={formatCurrency(pricingProviderCost)}
                            />
                          </Field>
                        </div>

                        {/* Row 3: מחיר לעובד | רווח נקי */}
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 items-start">
                          <Field>
                            <FieldLabel className="text-right w-full">מחיר לעובד (חודשי, ₪)</FieldLabel>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              dir="rtl"
                              className="text-right"
                              value={org.monthlyPricePerMember ?? ''}
                              onChange={(e) =>
                                setOrg((p) => ({ ...p, monthlyPricePerMember: e.target.value }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-right w-full">רווח נקי (מחושב)</FieldLabel>
                            <Input
                              dir="rtl"
                              className="text-right bg-muted tabular-nums"
                              readOnly
                              value={formatCurrency(netProfitLive)}
                              title={
                                org?.priceListId
                                  ? 'לפי מחיר מנוי מול עלות ספק בשורת המחירון או בקטלוג המוצר'
                                  : 'לפי מחיר מנוי מול עלות ספק בקטלוג המוצר'
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              מחיר לעובד פחות עלות ספק (לפי מחירון/מוצר נבחר)
                            </p>
                          </Field>
                        </div>
                      </FieldGroup>
                    </TabsContent>
                  </Tabs>
                  <Button type="submit" disabled={saveLoading}>
                    {saveLoading ? <Spinner className="size-4 me-2" /> : null}
                    שמור הגדרות
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>גבייה — דרישות תשלום נעולות</CardTitle>
                <CardDescription>
                  דוחות חיובים שנסגרו ונעולו. ניתן להוריד כל דוח לפי הנתונים שנשמרו בעת הנעילה.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshotsLoading ? (
                  <div className="flex justify-center py-8"><Spinner className="size-8" /></div>
                ) : (
                  <div className="rounded-md border overflow-x-auto" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead>חודש שירות</TableHead>
                          <TableHead>סכום לתשלום</TableHead>
                          <TableHead>כמות עובדים</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>מספר חשבונית</TableHead>
                          <TableHead>מספר קבלה</TableHead>
                          <TableHead>הערות</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshots.map((snap) => (
                          <TableRow key={snap.id}>
                            <TableCell className="font-medium">{snap.month}</TableCell>
                            <TableCell>{formatCurrency(snap.totalAmount)}</TableCell>
                            <TableCell className="tabular-nums">{Number(snap.totalEmployees)}</TableCell>
                            <TableCell>
                              <Badge variant={snap.status === 'Paid' ? 'default' : 'secondary'}>
                                {snap.status === 'Paid' ? 'שולם' : 'ממתין לתשלום'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{snap.invoiceNum || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{snap.receiptNum || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{snap.notes || '—'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        type="button"
                                        onClick={() => {
                                          setSnapEditTarget(snap);
                                          setSnapEditForm({ status: snap.status, invoiceNum: snap.invoiceNum, receiptNum: snap.receiptNum, notes: snap.notes });
                                          setSnapEditOpen(true);
                                        }}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>עריכת פרטי גבייה</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        type="button"
                                        onClick={() => downloadSnapshotXlsx(snap)}
                                        disabled={!(snap.reportData || []).length}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>הורדת דוח דרישה (נתונים נעולים)</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!snapshots.length ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              אין דרישות תשלום נעולות. לחצו על "סגור דוח והפק דרישת תשלום" בלשונית "דוח חיובים".
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing-report" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>דוח חיובים</CardTitle>
                <CardDescription>חישוב מדויק לחיוב חודשי לפי סטטוס מנוי ותאריך התחלה</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <Field className="max-w-xs">
                    <FieldLabel>חודש לחיוב</FieldLabel>
                    <Input
                      type="month"
                      value={billingReportMonth}
                      onChange={(e) => setBillingReportMonth(e.target.value || monthNow())}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2 items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={exportBillingReportToXlsx}
                      disabled={billingReportLoading || !(billingReport.rows || []).length}
                    >
                      <FileSpreadsheet className="size-4 me-2" />
                      ייצא לאקסל (טיוטה)
                    </Button>
                    <Button
                      type="button"
                      disabled={billingReportLoading || !(billingReport.rows || []).length || lockLoading}
                      onClick={lockSnapshot}
                      style={{ backgroundColor: '#285959', color: '#fff' }}
                      className="hover:opacity-90"
                    >
                      {lockLoading ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}
                      סגור דוח והפק דרישת תשלום
                    </Button>
                  </div>
                </div>
                {lockErr ? <p className="text-destructive text-sm">{lockErr}</p> : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StatsCard title="סה״כ לתשלום לחודש זה" value={formatCurrency(billingReport.summary.totalDue)} icon={Wallet} />
                  <StatsCard title="סה״כ עובדים לחיוב" value={String(billingReport.summary.totalActiveRecords || 0)} icon={UserCheck} />
                  <StatsCard title="מצטרפים חדשים (חיוב יחסי)" value={String(billingReport.summary.totalProrated || 0)} icon={CalendarClock} />
                </div>

                {billingReportLoading ? (
                  <div className="flex justify-center p-8"><Spinner className="size-8" /></div>
                ) : (
                  <div className="rounded-md border overflow-x-auto" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead>שם עובד</TableHead>
                          <TableHead>ת"ז</TableHead>
                          <TableHead>תחילת מנוי</TableHead>
                          <TableHead>מחיר מנוי מקור</TableHead>
                          <TableHead>תאריך ביטול</TableHead>
                          <TableHead>סטטוס חודשי</TableHead>
                          <TableHead>סכום לחיוב</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(billingReport.rows || []).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.employeeName || '—'}</TableCell>
                            <TableCell dir="ltr" className="text-end font-mono text-xs">{r.idNumber || '—'}</TableCell>
                            <TableCell>{formatDateDdMmYyyy(r.subscriptionStartDate)}</TableCell>
                            <TableCell>{formatCurrency(r.basePrice)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDateDdMmYyyy(r.cancellationDate)}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold tabular-nums">{Number(r.monthlyStatusPct ?? 100)}%</span>
                              <span className="text-muted-foreground text-sm">
                                {' '}
                                ({r.monthlyStatusSubtext || 'מלא'})
                              </span>
                            </TableCell>
                            <TableCell>{formatCurrency(r.billedAmount)}</TableCell>
                          </TableRow>
                        ))}
                        {!(billingReport.rows || []).length ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">אין רשומות לחיוב בחודש זה</TableCell>
                          </TableRow>
                        ) : null}
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
  );
}
