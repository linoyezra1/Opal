import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Users, RefreshCw, Lock, Edit2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE } from '../apiBase.js';
import { fmtDateTime } from '../utils/dateUtils.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';

const REPORT_SERVICE_ENTITLEMENT_NOTICE =
  'הרשומות המוצגות כוללות אך ורק מנויים שתאריך תחילת המנוי שלהם מופעל (הושלמו פרטי מוטבים) ונמצאים בסטטוס "פעיל" או "ממתין לביטול". לקוחות שטרם השלימו הרשמה, או מנויים מבוטלים, אינם זכאים לשירות ואינם מופיעים בדוח.';

function ReportEntitlementNotice() {
  return (
    <div
      className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/50 px-4 py-3 text-sm text-right leading-relaxed text-sky-950 dark:text-sky-100 mb-3"
      role="note"
    >
      <span className="font-semibold">שימו לב:</span> {REPORT_SERVICE_ENTITLEMENT_NOTICE}
    </div>
  );
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartEndIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const toYmd = (dt) => dt.toISOString().slice(0, 10);
  return { from: toYmd(start), to: toYmd(end) };
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

async function downloadCsv(url, token, fallbackName) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'הורדה נכשלה');
    }
    throw new Error('הורדה נכשלה');
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^";]+)"?/i.exec(cd);
  const name = m ? m[1].trim() : fallbackName;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

export default function ReportsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const defaults = useMemo(() => monthStartEndIso(), []);

  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState('');
  const [providers, setProviders] = useState([]);
  const [orgRows, setOrgRows] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const [provBillingType, setProvBillingType] = useState('');
  const [provStatusFilter, setProvStatusFilter] = useState('all');
  const [provProductFilter, setProvProductFilter] = useState('');
  const [provProviderFilter, setProvProviderFilter] = useState('');
  const [provAgentId, setProvAgentId] = useState('');
  const [provOrgId, setProvOrgId] = useState('');
  const [provMonth, setProvMonth] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [agentSnaps, setAgentSnaps] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentErr, setAgentErr] = useState('');

  const [tab, setTab] = useState(() => String(searchParams.get('tab') || 'provider'));
  useEffect(() => {
    const t = String(searchParams.get('tab') || 'provider');
    if (t && t !== tab) setTab(t);
  }, [searchParams, tab]);

  const [allSnapshots, setAllSnapshots] = useState([]);
  const [snapsLoading, setSnapsLoading] = useState(false);
  const [snapsErr, setSnapsErr] = useState('');
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapEditForm, setSnapEditForm] = useState({ status: 'Pending', invoiceNum: '', receiptNum: '', notes: '' });
  const [saveSnapBusy, setSaveSnapBusy] = useState(false);

  const loadAllSnapshots = useCallback(async () => {
    if (!token) return;
    setSnapsLoading(true);
    setSnapsErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/billing-snapshots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'טעינה נכשלה');
      setAllSnapshots(Array.isArray(j.snapshots) ? j.snapshots : []);
    } catch (e) {
      setSnapsErr(e?.message || 'שגיאה');
    } finally {
      setSnapsLoading(false);
    }
  }, [token]);

  const saveGlobalSnapEdit = async () => {
    if (!snapEditTarget?.id) return;
    setSaveSnapBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/organizations/${encodeURIComponent(snapEditTarget.orgId)}/billing-snapshots/${encodeURIComponent(snapEditTarget.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(snapEditForm),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      await loadAllSnapshots();
    } catch (e) {
      setSnapsErr(e?.message || 'שגיאה');
    } finally {
      setSaveSnapBusy(false);
    }
  };


  const loadAgents = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/admin/agents?includeInactive=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setAgents(Array.isArray(j.rows) ? j.rows : []);
  }, [token]);

  const loadOrgsAndProducts = useCallback(async () => {
    if (!token) return;
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/organizations`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (oRes?.success) setOrgRows(Array.isArray(oRes.rows) ? oRes.rows : []);
      setProductRows(Array.isArray(pRes?.products) ? pRes.products : []);
    } catch {
      setOrgRows([]);
      setProductRows([]);
    }
  }, [token]);

  const loadProviders = useCallback(async () => {
    if (!token) return;
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      const res = await fetch(`${API_BASE}/api/admin/reports/providers?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) setProviders(Array.isArray(j.providers) ? j.providers : []);
    } catch {
      setProviders([]);
    }
  }, [token, fromDate, toDate]);

  const loadPreview = useCallback(async () => {
    if (!token) return;
    setPreviewLoading(true);
    setExportErr('');
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      if (provProviderFilter) q.set('provider', provProviderFilter);
      if (provBillingType) q.set('billingType', provBillingType);
      if (provStatusFilter && provStatusFilter !== 'all') q.set('status', provStatusFilter);
      if (provProductFilter) q.set('product', provProductFilter);
      if (provAgentId) q.set('agentId', provAgentId);
      if (provOrgId) q.set('organizationId', provOrgId);
      if (provMonth) q.set('month', provMonth);
      const res = await fetch(`${API_BASE}/api/admin/reports/subscribers-preview?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינת תצוגה מקדימה נכשלה');
      setPreviewRows(Array.isArray(j.rows) ? j.rows : []);
      setPreviewTotal(Number(j.totalRows || 0));
    } catch (e) {
      setExportErr(e?.message || 'שגיאה');
      setPreviewRows([]);
      setPreviewTotal(0);
    } finally {
      setPreviewLoading(false);
    }
  }, [
    token,
    fromDate,
    toDate,
    provProviderFilter,
    provBillingType,
    provStatusFilter,
    provProductFilter,
    provAgentId,
    provOrgId,
    provMonth,
  ]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);
  useEffect(() => {
    loadOrgsAndProducts();
  }, [loadOrgsAndProducts]);
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);
  useEffect(() => {
    if (tab !== 'provider') return;
    loadPreview();
  }, [tab, loadPreview]);
  useEffect(() => {
    if (tab !== 'agents') return;
    loadAgentSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, agentId]);
  useEffect(() => {
    if (tab !== 'snapshots') return;
    loadAllSnapshots();
  }, [tab, loadAllSnapshots]);

  const runSubscribersExport = async () => {
    setExportErr('');
    setExportBusy(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      if (provProviderFilter) q.set('provider', provProviderFilter);
      if (provBillingType) q.set('billingType', provBillingType);
      if (provStatusFilter && provStatusFilter !== 'all') q.set('status', provStatusFilter);
      if (provProductFilter) q.set('product', provProductFilter);
      if (provAgentId) q.set('agentId', provAgentId);
      if (provOrgId) q.set('organizationId', provOrgId);
      if (provMonth) q.set('month', provMonth);
      await downloadCsv(
        `${API_BASE}/api/admin/reports/subscribers-export-xlsx?${q.toString()}`,
        token,
        'opal-subscribers-by-person.xlsx'
      );
    } catch (e) {
      setExportErr(e?.message || 'שגיאה');
    } finally {
      setExportBusy(false);
    }
  };

  const runCancellationsExport = async () => {
    setExportErr('');
    setExportBusy(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      await downloadCsv(
        `${API_BASE}/api/admin/reports/cancellations-export?${q.toString()}`,
        token,
        'opal-cancellations.csv'
      );
    } catch (e) {
      setExportErr(e?.message || 'שגיאה');
    } finally {
      setExportBusy(false);
    }
  };

  const loadAgentSnapshots = async () => {
    setAgentErr('');
    setAgentLoading(true);
    try {
      const q = new URLSearchParams();
      if (agentId) q.set('agentId', agentId);
      const res = await fetch(`${API_BASE}/api/admin/agent-commission-snapshots?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שגיאה');
      setAgentSnaps(Array.isArray(j.snapshots) ? j.snapshots : []);
    } catch (e) {
      setAgentErr(e?.message || 'שגיאה');
    } finally {
      setAgentLoading(false);
    }
  };

  const exportProductOptions = useMemo(() => {
    const set = new Set();
    for (const p of productRows) {
      const n = String(p.productName || p.name || '').trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [productRows]);

  const provExportFilterValues = useMemo(
    () => ({
      billingType: provBillingType,
      status: provStatusFilter,
      product: provProductFilter,
      provider: provProviderFilter,
      agentId: provAgentId,
      organizationId: provOrgId,
      month: provMonth,
    }),
    [
      provBillingType,
      provStatusFilter,
      provProductFilter,
      provProviderFilter,
      provAgentId,
      provOrgId,
      provMonth,
    ]
  );

  function clearProvExportFilters() {
    setProvBillingType('');
    setProvStatusFilter('all');
    setProvProductFilter('');
    setProvProviderFilter('');
    setProvAgentId('');
    setProvOrgId('');
    setProvMonth('');
  }

  function setProvExportFilters(next) {
    setProvBillingType(String(next.billingType || ''));
    setProvStatusFilter(String(next.status ?? 'all'));
    setProvProductFilter(String(next.product || ''));
    setProvProviderFilter(String(next.provider || ''));
    setProvAgentId(String(next.agentId || ''));
    setProvOrgId(String(next.organizationId || ''));
    setProvMonth(String(next.month || ''));
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto text-right" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">דוחות</h1>

        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            const next = new URLSearchParams(searchParams);
            next.set('tab', v);
            setSearchParams(next, { replace: true });
            if (v === 'snapshots') loadAllSnapshots();
          }}
          className="w-full"
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="provider" className="gap-1">
              <FileSpreadsheet className="size-4" />
              ייצוא לספק
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1">
              <Users className="size-4" />
              עמלות סוכנים
            </TabsTrigger>
            <TabsTrigger value="snapshots" className="gap-1">
              <Lock className="size-4" />
              כל דרישות התשלום
            </TabsTrigger>
          </TabsList>

          <TabsContent value="provider" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>ייצוא לספק</CardTitle>
                <CardDescription>בחרו טווח תאריכים לפי תאריך יצירת העסקה במערכת</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
                  <Field className="min-w-[160px]">
                    <FieldLabel>מתאריך</FieldLabel>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </Field>
                  <Field className="min-w-[160px]">
                    <FieldLabel>עד תאריך</FieldLabel>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </Field>
                </FieldGroup>
                <div className="rounded-xl border p-3 md:p-4">
                  <UnifiedFilterShell
                    filters={[
                      {
                        key: 'provider',
                        label: 'ספק',
                        type: 'select',
                        options: providers.map((p) => ({ value: p, label: p })),
                      },
                      {
                        key: 'product',
                        label: 'מוצר',
                        type: 'select',
                        options: exportProductOptions.map((p) => ({ value: p, label: p })),
                      },
                      {
                        key: 'billingType',
                        label: 'סוג חיוב',
                        type: 'select',
                        options: [
                          { value: 'Centralized', label: 'מרוכז' },
                          { value: 'Private', label: 'פרטי' },
                        ],
                      },
                      {
                        key: 'status',
                        label: 'סטטוס',
                        type: 'select',
                        options: [
                          { value: 'all', label: 'הכל' },
                          { value: 'active', label: 'פעילים' },
                          { value: 'cancelled', label: 'מבוטלים' },
                        ],
                      },
                      {
                        key: 'agentId',
                        label: 'סוכן',
                        type: 'select',
                        options: agents.map((a) => ({
                          value: a.id,
                          label: `${a.agentName}${a.isActive === false ? ' (לא פעיל)' : ''}`,
                        })),
                      },
                      {
                        key: 'organizationId',
                        label: 'ארגון',
                        type: 'select',
                        options: orgRows.map((o) => ({
                          value: o.id,
                          label: String(o.companyName || o.name || o.id),
                        })),
                      },
                      {
                        key: 'month',
                        label: 'חודש בילינג',
                        type: 'month',
                        placeholder: 'YYYY-MM',
                      },
                    ]}
                    values={provExportFilterValues}
                    onChange={setProvExportFilters}
                    onClear={clearProvExportFilters}
                    resultsCount={previewRows.length}
                    totalCount={previewTotal}
                    isLoading={previewLoading}
                    hideSearchBar
                  />
                </div>
                {exportErr ? <p className="text-sm text-destructive">{exportErr}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={exportBusy} onClick={runSubscribersExport}>
                    {exportBusy ? <Spinner className="size-4" /> : null}
                    הורד אקסל מנויים לספק
                  </Button>
                  <Button type="button" variant="secondary" disabled={exportBusy} onClick={runCancellationsExport}>
                    הורד אקסל ביטולים
                  </Button>
                </div>
                <ReportEntitlementNotice />
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סוג שורה</TableHead>
                        <TableHead className="text-right">שם פרטי</TableHead>
                        <TableHead className="text-right">שם משפחה</TableHead>
                        <TableHead className="text-right">ת.ז</TableHead>
                        <TableHead className="text-right">מוצר</TableHead>
                        <TableHead className="text-right">סכום</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r, idx) => (
                        <TableRow key={`preview-${idx}`}>
                          <TableCell>{String(r.rowRole || '') === 'primary' ? 'מבוטח ראשי' : 'מוטב משני'}</TableCell>
                          <TableCell>{String(r.firstName || '—')}</TableCell>
                          <TableCell>{String(r.lastName || '—')}</TableCell>
                          <TableCell>{String(r.idNumber || '—')}</TableCell>
                          <TableCell>{String(r.productName || '—')}</TableCell>
                          <TableCell>{formatCurrency(r.payerAmount || 0)}</TableCell>
                        </TableRow>
                      ))}
                      {!previewRows.length ? (
                        <TableRow>
                          <TableCell className="text-center text-muted-foreground" colSpan={6}>
                            אין נתונים לתצוגה מקדימה
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">סה״כ רשומות בטווח: {previewTotal}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>עמלות סוכנים</CardTitle>
                <CardDescription>מציג רק דוחות עמלות נעולים (Approved Debts) מתוך snapshots</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup className="flex flex-col sm:flex-row gap-4 items-end">
                  <Field className="min-w-[200px] flex-1">
                    <FieldLabel>סוכן</FieldLabel>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                    >
                      <option value="">— בחרו —</option>
                      {agents.map((a) => (
                        <option
                          key={a.id}
                          value={a.id}
                          style={a.isActive === false ? { color: '#6b7280' } : undefined}
                        >
                          {a.agentName}{a.isActive === false ? ' (לא פעיל)' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                </FieldGroup>
                {agentErr ? <p className="text-sm text-destructive">{agentErr}</p> : null}
                {agentSnaps && (
                  <div className="space-y-3">
                    <div className="rounded-md border overflow-x-auto" dir="rtl">
                      <Table className="text-right">
                        <TableHeader>
                          <TableRow className="[&_th]:text-right">
                            <TableHead className="text-right">סוכן</TableHead>
                            <TableHead className="text-right">חודש</TableHead>
                            <TableHead className="text-right">עסקאות</TableHead>
                            <TableHead className="text-right">סה״כ לתשלום</TableHead>
                            <TableHead className="text-right">שולם</TableHead>
                            <TableHead className="text-right">יתרה</TableHead>
                            <TableHead className="text-right">סטטוס</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agentSnaps.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{r.agentName || '—'}</TableCell>
                              <TableCell>{r.month}</TableCell>
                              <TableCell>{Number(r.totalDeals || 0)}</TableCell>
                              <TableCell>{formatCurrency(r.totalAmount)}</TableCell>
                              <TableCell>{formatCurrency(r.totalPaid)}</TableCell>
                              <TableCell>{formatCurrency(r.balance)}</TableCell>
                              <TableCell>{r.status === 'Paid' ? 'שולם' : 'ממתין'}</TableCell>
                            </TableRow>
                          ))}
                          {!agentSnaps.length ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                                אין snapshots נעולים להצגה
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── כל דרישות התשלום (Billing Snapshots) ── */}
          <TabsContent value="snapshots" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between text-right">
                <div>
                  <CardTitle>כל דרישות התשלום — מרכזי</CardTitle>
                  <CardDescription>
                    תצוגה מרכזית של כל דרישות התשלום הנעולות לכל הארגונים. ניתן לעדכן סטטוס, מספרי מסמכים ולהוריד דוח.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={loadAllSnapshots} disabled={snapsLoading}>
                  <RefreshCw className={`size-4 me-2 ${snapsLoading ? 'animate-spin' : ''}`} />
                  רענן
                </Button>
              </CardHeader>
              <CardContent>
                {snapsErr ? <p className="text-sm text-destructive mb-2">{snapsErr}</p> : null}
                {snapsLoading ? (
                  <div className="flex justify-center py-8"><Spinner className="size-8" /></div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <span>סה״כ דרישות: <strong>{allSnapshots.length}</strong></span>
                      <span>
                        ממתינות לתשלום:{' '}
                        <strong>{allSnapshots.filter((s) => s.status !== 'Paid').length}</strong>
                      </span>
                      <span>
                        סה״כ חוב פתוח:{' '}
                        <strong>
                          {formatCurrency(allSnapshots.filter((s) => s.status !== 'Paid').reduce((sum, s) => sum + Number(s.totalAmount || 0), 0))}
                        </strong>
                      </span>
                    </div>
                    <div className="rounded-md border overflow-x-auto" dir="rtl">
                      <Table className="text-right">
                        <TableHeader>
                          <TableRow className="[&_th]:text-right">
                            <TableHead>ארגון</TableHead>
                            <TableHead>חודש שירות</TableHead>
                            <TableHead>סכום לתשלום</TableHead>
                            <TableHead>כמות עובדים</TableHead>
                            <TableHead>סטטוס</TableHead>
                            <TableHead>חשבונית</TableHead>
                            <TableHead>קבלה</TableHead>
                            <TableHead>נעילה</TableHead>
                            <TableHead>פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allSnapshots.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                אין דרישות תשלום נעולות במערכת
                              </TableCell>
                            </TableRow>
                          ) : (
                            allSnapshots.map((snap) => (
                              <TableRow key={snap.id}>
                                <TableCell className="font-medium">{snap.orgName || '—'}</TableCell>
                                <TableCell>{snap.month}</TableCell>
                                <TableCell>{formatCurrency(snap.totalAmount)}</TableCell>
                                <TableCell className="tabular-nums">{Number(snap.totalEmployees)}</TableCell>
                                <TableCell>
                                  <Badge variant={snap.status === 'Paid' ? 'default' : 'secondary'}>
                                    {snap.status === 'Paid' ? 'שולם' : 'ממתין'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{snap.invoiceNum || '—'}</TableCell>
                                <TableCell className="text-xs">{snap.receiptNum || '—'}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {snap.lockedAt ? fmtDateTime(snap.lockedAt) : '—'}
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider delayDuration={200}>
                                    <div className="flex items-center gap-1">
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
                                        <TooltipContent>עריכה</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            type="button"
                                            disabled={!(snap.reportData || []).length}
                                            onClick={() => {
                                              const rows = (snap.reportData || []).map((r) => ({
                                                'שם עובד': r.employeeName || '—',
                                                'ת"ז': r.idNumber || '—',
                                                'תחילת מנוי': r.subscriptionStartDate || '—',
                                                'מחיר מנוי מקור': Number(r.basePrice || 0),
                                                'סטטוס חודשי': `${Number(r.monthlyStatusPct ?? 100)}% (${r.monthlyStatusSubtext || 'מלא'})`,
                                                'ימים פעילים': r.activeDays ?? '',
                                                'סכום לחיוב': Number(r.billedAmount || 0),
                                              }));
                                              const ws = XLSX.utils.json_to_sheet(rows);
                                              ws['!views'] = [{ RTL: true }];
                                              const wb = XLSX.utils.book_new();
                                              XLSX.utils.book_append_sheet(wb, ws, 'דוח חיובים');
                                              XLSX.writeFile(wb, `opal-billing-snapshot-${snap.orgName || 'org'}-${snap.month}.xlsx`);
                                            }}
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>הורד דוח דרישה (נתונים נעולים)</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Snapshot edit dialog (global) */}
        <Dialog open={snapEditOpen} onOpenChange={(o) => { if (!o) setSnapEditOpen(false); }}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת דרישת תשלום</DialogTitle>
              <DialogDescription>
                {snapEditTarget ? `${snapEditTarget.orgName} · ${snapEditTarget.month}` : ''}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>סטטוס</FieldLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={snapEditForm.status}
                  onChange={(e) => setSnapEditForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="Pending">ממתין לתשלום</option>
                  <option value="Paid">שולם</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>מספר חשבונית</FieldLabel>
                <Input value={snapEditForm.invoiceNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceNum: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>מספר קבלה</FieldLabel>
                <Input value={snapEditForm.receiptNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, receiptNum: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>הערות</FieldLabel>
                <Textarea rows={2} value={snapEditForm.notes} onChange={(e) => setSnapEditForm((p) => ({ ...p, notes: e.target.value }))} />
              </Field>
            </FieldGroup>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button type="button" variant="outline" onClick={() => setSnapEditOpen(false)}>ביטול</Button>
              <Button type="button" disabled={saveSnapBusy} onClick={saveGlobalSnapEdit}>
                {saveSnapBusy && <Spinner className="me-2" />}
                שמור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminPageShell>
  );
}
