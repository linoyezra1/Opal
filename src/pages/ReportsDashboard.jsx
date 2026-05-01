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
  const [providerFilter, setProviderFilter] = useState('');
  const [providerSearchText, setProviderSearchText] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [agentMonth, setAgentMonth] = useState(currentMonthStr());
  const [agentProviderFilter, setAgentProviderFilter] = useState('');
  const [agentProductFilter, setAgentProductFilter] = useState('');
  const [agentBillingTypeFilter, setAgentBillingTypeFilter] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState('all');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentErr, setAgentErr] = useState('');
  const [agentData, setAgentData] = useState(null);

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
      if (providerFilter) q.set('provider', providerFilter);
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
  }, [token, fromDate, toDate, providerFilter]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);
  useEffect(() => {
    if (tab !== 'provider') return;
    loadPreview();
  }, [tab, loadPreview]);
  useEffect(() => {
    if (tab !== 'agents') return;
    if (!agentId || !agentMonth) return;
    loadAgentCommissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, agentId, agentMonth]);
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
      if (providerFilter) q.set('provider', providerFilter);
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

  const loadAgentCommissions = async () => {
    setAgentErr('');
    setAgentLoading(true);
    setAgentData(null);
    try {
      if (!agentId || !agentMonth) throw new Error('בחרו סוכן וחודש');
      const q = new URLSearchParams({ agentId, month: agentMonth });
      const res = await fetch(`${API_BASE}/api/admin/reports/agent-commissions?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שגיאה');
      setAgentData(j);
    } catch (e) {
      setAgentErr(e?.message || 'שגיאה');
    } finally {
      setAgentLoading(false);
    }
  };

  const agentProviderOptions = useMemo(() => {
    const set = new Set(
      (agentData?.rows || [])
        .map((r) => String(r.provider || '').trim())
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [agentData]);

  const agentProductOptions = useMemo(() => {
    const set = new Set(
      (agentData?.rows || [])
        .map((r) => String(r.productName || '').trim())
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [agentData]);

  const filteredAgentRows = useMemo(() => {
    return (agentData?.rows || []).filter((r) => {
      const provider = String(r.provider || '').trim();
      const productName = String(r.productName || '').trim();
      const billingType = String(r.billingType || '').trim();
      const isCancelled =
        r.status === 'canceled' ||
        String(r.subscriptionStatus || '').toLowerCase() === 'cancelled';

      if (agentProviderFilter && provider !== agentProviderFilter) return false;
      if (agentProductFilter && productName !== agentProductFilter) return false;
      if (agentBillingTypeFilter && billingType !== agentBillingTypeFilter) return false;
      if (agentStatusFilter === 'cancelled' && !isCancelled) return false;
      if (agentStatusFilter === 'active' && isCancelled) return false;
      return true;
    });
  }, [agentData, agentProviderFilter, agentProductFilter, agentBillingTypeFilter, agentStatusFilter]);

  const filteredAgentTotals = useMemo(() => {
    return filteredAgentRows.reduce(
      (acc, row) => {
        acc.totalSales += Number(row.payerAmount || 0);
        acc.totalCommission += Number(row.commissionAmount || 0);
        acc.dealCount += 1;
        return acc;
      },
      { totalSales: 0, totalCommission: 0, dealCount: 0 }
    );
  }, [filteredAgentRows]);

  return (
    <AdminPageShell>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto text-right" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">דוחות ובילינג אופאל</h1>
          <p className="text-muted-foreground text-sm mt-1">
            מרכז הדוחות והבילינג של אופאל — ייצוא לספק ועמלות סוכנים
          </p>
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
                <UnifiedFilterShell
                  searchValue={providerSearchText}
                  onSearchChange={setProviderSearchText}
                  searchPlaceholder="סנן ספקים..."
                  basicControls={(
                    <>
                      <Field>
                        <FieldLabel>מתאריך</FieldLabel>
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                      </Field>
                      <Field>
                        <FieldLabel>עד תאריך</FieldLabel>
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                      </Field>
                      <select
                        className="flex h-10 w-full sm:w-56 rounded-md border border-slate-200 bg-background px-3 py-2 text-sm shadow-sm"
                        value={providerFilter}
                        onChange={(e) => { setProviderFilter(e.target.value); setProviderSearchText(''); }}
                      >
                        <option value="">כל הספקים</option>
                        {providers
                          .filter((p) => !providerSearchText || String(p).toLowerCase().includes(providerSearchText.toLowerCase()))
                          .map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                      </select>
                    </>
                  )}
                />
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
                <CardDescription>עסקאות לפי מזהה סוכן וחודש (תאריך יצירת העסקה)</CardDescription>
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
                  <Field>
                    <FieldLabel>חודש</FieldLabel>
                    <Input
                      type="month"
                      value={agentMonth}
                      onChange={(e) => setAgentMonth(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
                <div className="rounded-xl border p-3 md:p-4">
                  <UnifiedFilterShell
                    filters={[
                      {
                        key: 'provider',
                        label: 'ספק',
                        type: 'select',
                        options: agentProviderOptions.map((p) => ({ value: p, label: p })),
                      },
                      {
                        key: 'product',
                        label: 'מוצר',
                        type: 'select',
                        options: agentProductOptions.map((p) => ({ value: p, label: p })),
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
                    ]}
                    values={{
                      provider: agentProviderFilter,
                      product: agentProductFilter,
                      billingType: agentBillingTypeFilter,
                      status: agentStatusFilter,
                    }}
                    onChange={(next) => {
                      setAgentProviderFilter(String(next.provider || ''));
                      setAgentProductFilter(String(next.product || ''));
                      setAgentBillingTypeFilter(String(next.billingType || ''));
                      setAgentStatusFilter(String(next.status || 'all'));
                    }}
                    onClear={() => {
                      setAgentProviderFilter('');
                      setAgentProductFilter('');
                      setAgentBillingTypeFilter('');
                      setAgentStatusFilter('all');
                    }}
                    resultsCount={filteredAgentRows.length}
                    totalCount={(agentData?.rows || []).length}
                    isLoading={agentLoading}
                  />
                </div>
                {agentErr ? <p className="text-sm text-destructive">{agentErr}</p> : null}
                {agentData && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span>
                        סה״כ מכירות: <strong>{formatCurrency(filteredAgentTotals.totalSales)}</strong>
                      </span>
                      <span>
                        סה״כ עמלות: <strong>{formatCurrency(filteredAgentTotals.totalCommission)}</strong>
                      </span>
                      <span>
                        מספר עסקאות: <strong>{filteredAgentTotals.dealCount}</strong>
                      </span>
                    </div>
                    <div className="rounded-md border overflow-x-auto" dir="rtl">
                      <Table className="text-right">
                        <TableHeader>
                          <TableRow className="[&_th]:text-right">
                            <TableHead className="text-right">הזמנה</TableHead>
                            <TableHead className="text-right">תאריך</TableHead>
                            <TableHead className="text-right">מוצר</TableHead>
                            <TableHead className="text-right">סכום</TableHead>
                            <TableHead className="text-right">עמלה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAgentRows.map((r) => (
                            <TableRow key={r.dealId}>
                              <TableCell className="font-mono text-xs">{r.transactionId}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {fmtDateTime(r.createdAt)}
                              </TableCell>
                              <TableCell>{r.productName || '—'}</TableCell>
                              <TableCell>{formatCurrency(r.payerAmount)}</TableCell>
                              <TableCell>{formatCurrency(r.commissionAmount)}</TableCell>
                            </TableRow>
                          ))}
                          {!filteredAgentRows.length ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                אין רשומות לפי הסינון שנבחר
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
                                  {snap.lockedAt ? new Date(snap.lockedAt).toLocaleDateString('he-IL') : '—'}
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
