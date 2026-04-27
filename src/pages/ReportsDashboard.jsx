import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Building2, Users, RefreshCw } from 'lucide-react';
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
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
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
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentErr, setAgentErr] = useState('');
  const [agentData, setAgentData] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invErr, setInvErr] = useState('');
  const [billingMonth, setBillingMonth] = useState(currentMonthStr());
  const [genBusy, setGenBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({
    invoiceNumber: '',
    receiptNumber: '',
    notes: '',
    status: 'Pending',
  });
  const [saveInvBusy, setSaveInvBusy] = useState(false);
  const [tab, setTab] = useState(() => String(searchParams.get('tab') || 'provider'));
  useEffect(() => {
    const t = String(searchParams.get('tab') || 'provider');
    if (t && t !== tab) setTab(t);
  }, [searchParams, tab]);


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

  const loadInvoices = useCallback(
    async (monthOverride) => {
      if (!token) return;
      setInvLoading(true);
      setInvErr('');
      try {
        const m = String(monthOverride ?? billingMonth ?? '').trim();
        const q = new URLSearchParams();
        if (m) q.set('month', m);
        const res = await fetch(`${API_BASE}/api/admin/monthly-invoices?${q.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'טעינה נכשלה');
        setInvoices(Array.isArray(j.invoices) ? j.invoices : []);
      } catch (e) {
        setInvErr(e?.message || 'שגיאה');
      } finally {
        setInvLoading(false);
      }
    },
    [token, billingMonth]
  );

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
    if (tab !== 'orgs') return;
    loadInvoices(billingMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, billingMonth]);

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

  const runGenerateInvoices = async () => {
    setInvErr('');
    setGenBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/monthly-invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ month: billingMonth }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שגיאה');
      await loadInvoices(billingMonth);
    } catch (e) {
      setInvErr(e?.message || 'שגיאה');
    } finally {
      setGenBusy(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      invoiceNumber: row.invoiceNumber || '',
      receiptNumber: row.receiptNumber || '',
      notes: row.notes || '',
      status: row.status === 'Paid' ? 'Paid' : 'Pending',
    });
    setEditOpen(true);
  };

  const saveInvoice = async () => {
    if (!editRow?.id) return;
    setSaveInvBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/monthly-invoices/${encodeURIComponent(editRow.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceNumber: editForm.invoiceNumber,
          receiptNumber: editForm.receiptNumber,
          notes: editForm.notes,
          status: editForm.status,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שמירה נכשלה');
      setEditOpen(false);
      await loadInvoices();
    } catch (e) {
      setInvErr(e?.message || 'שגיאה');
    } finally {
      setSaveInvBusy(false);
    }
  };

  return (
    <AdminPageShell>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto text-right" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">דוחות ובילינג אופאל</h1>
          <p className="text-muted-foreground text-sm mt-1">
            מרכז הדוחות והבילינג של אופאל — ייצוא לספק, עמלות סוכנים וגבייה מארגונים
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            const next = new URLSearchParams(searchParams);
            next.set('tab', v);
            setSearchParams(next, { replace: true });
            if (v === 'orgs') loadInvoices();
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
            <TabsTrigger value="orgs" className="gap-1">
              <Building2 className="size-4" />
              גבייה מארגונים
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
                {agentErr ? <p className="text-sm text-destructive">{agentErr}</p> : null}
                {agentData && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span>
                        סה״כ מכירות: <strong>{formatCurrency(agentData.totalSales)}</strong>
                      </span>
                      <span>
                        סה״כ עמלות: <strong>{formatCurrency(agentData.totalCommission)}</strong>
                      </span>
                      <span>
                        מספר עסקאות: <strong>{agentData.dealCount}</strong>
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
                          {(agentData.rows || []).map((r) => (
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
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orgs" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between text-right">
                <div>
                  <CardTitle>גבייה מארגונים (תשלום מרוכז)</CardTitle>
                  <CardDescription>
                    חשבוניות חודשיות מקובצות לפי ארגון — עדכנו מספרי מסמכים וסטטוס תשלום. בחירת חודש מעדכנת את הטבלה אוטומטית.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-end justify-end gap-2">
                  <Field>
                    <FieldLabel className="text-xs">חודש לחיוב</FieldLabel>
                    <Input
                      type="month"
                      value={billingMonth}
                      onChange={(e) => setBillingMonth(e.target.value)}
                    />
                  </Field>
                  <Button type="button" variant="outline" onClick={() => loadInvoices()} disabled={invLoading}>
                    רענן טבלה
                  </Button>
                  <Button type="button" variant="secondary" disabled={genBusy} onClick={runGenerateInvoices}>
                    {genBusy ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
                    צור / עדכן לפי חודש
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {invErr ? <p className="text-sm text-destructive mb-2">{invErr}</p> : null}
                {invLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="size-8" />
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto" dir="rtl">
                    <Table className="text-right">
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead className="text-right">ארגון</TableHead>
                          <TableHead className="text-right">חודש</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">חשבונית</TableHead>
                          <TableHead className="text-right">קבלה</TableHead>
                          <TableHead className="w-[100px] text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              אין רשומות. הריצו &quot;צור / עדכן לפי חודש&quot; לאחר סגירת חודש.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.organizationName}</TableCell>
                              <TableCell>{inv.month}</TableCell>
                              <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                              <TableCell>
                                <Badge variant={inv.status === 'Paid' ? 'default' : 'secondary'}>
                                  {inv.status === 'Paid' ? 'שולם' : 'ממתין'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{inv.invoiceNumber || '—'}</TableCell>
                              <TableCell className="text-xs">{inv.receiptNumber || '—'}</TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                                  עריכה
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת חשבונית ארגון</DialogTitle>
              <DialogDescription>
                {editRow ? `${editRow.organizationName} · ${editRow.month}` : ''}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel>מספר חשבונית</FieldLabel>
                <Input
                  value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>מספר קבלה</FieldLabel>
                <Input
                  value={editForm.receiptNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, receiptNumber: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>סטטוס</FieldLabel>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="Pending">ממתין לתשלום</option>
                  <option value="Paid">שולם</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>הערות</FieldLabel>
                <Textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                ביטול
              </Button>
              <Button type="button" onClick={saveInvoice} disabled={saveInvBusy}>
                {saveInvBusy ? <Spinner className="size-4" /> : null}
                שמור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageShell>
  );
}
