import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Edit2, Lock, Plus, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(
    Number(v || 0)
  );
}

function calcPreviewTotals(form) {
  const invoiceAmount = Math.max(0, Number(form.invoiceAmount || 0));
  const creditNoteAmount = Math.max(0, Number(form.creditNoteAmount || 0));
  const totalAmount = invoiceAmount - creditNoteAmount;
  const totalPaid = Math.max(0, Number(form.totalPaid || 0));
  const balance = totalAmount - totalPaid;
  return { totalAmount, balance };
}

const emptyPayoutForm = () => ({
  month: currentMonthStr(),
  invoiceNum: '',
  invoiceAmount: '',
  creditNoteNum: '',
  creditNoteAmount: '',
  totalPaid: '0',
  status: 'Pending',
  notes: '',
});

const emptySnapEditForm = () => ({
  status: 'Pending',
  invoiceNum: '',
  invoiceAmount: 0,
  creditNoteNum: '',
  creditNoteAmount: 0,
  totalPaid: 0,
  notes: '',
});

function isPayoutFullyPaid(p) {
  return Number(p.balance || 0) === 0 && String(p.status || '') === 'Paid';
}

const ltrInputClass = 'text-left font-mono tabular-nums';

export default function VendorDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [vendor, setVendor] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [selectedPayoutIds, setSelectedPayoutIds] = useState(() => new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutEditTarget, setPayoutEditTarget] = useState(null);
  const [payoutForm, setPayoutForm] = useState(emptyPayoutForm);
  const [saveBusy, setSaveBusy] = useState(false);
  const [mainTab, setMainTab] = useState('payments');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState({ rows: [], summary: {} });
  const [snapshots, setSnapshots] = useState([]);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState(new Set());
  const [lockBusy, setLockBusy] = useState(false);
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapEditForm, setSnapEditForm] = useState(emptySnapEditForm);
  const [snapRowsOpen, setSnapRowsOpen] = useState(false);
  const [snapRowsTarget, setSnapRowsTarget] = useState(null);

  const previewTotals = useMemo(() => calcPreviewTotals(payoutForm), [payoutForm]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setErr('');
    setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payouts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const vj = await vRes.json().catch(() => ({}));
      const pj = await pRes.json().catch(() => ({}));
      if (!vRes.ok) throw new Error(vj.error || 'טעינת ספק נכשלה');
      if (!pRes.ok) throw new Error(pj.error || 'טעינת תשלומים נכשלה');
      setVendor(vj.vendor || null);
      setPayouts(Array.isArray(pj.payouts) ? pj.payouts : []);
      setSelectedPayoutIds(new Set());
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  const loadExportPreview = useCallback(async () => {
    if (!token || !id) return;
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate) q.set('toDate', toDate);
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-preview?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'טעינת תצוגה מקדימה נכשלה');
      setPreview({ rows: j.rows || [], summary: j.summary || {} });
      setSelectedLedgerIds(new Set());
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    }
  }, [token, id, fromDate, toDate]);

  const loadSnapshots = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-snapshots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'טעינת דרישות תשלום נכשלה');
      setSnapshots(Array.isArray(j.snapshots) ? j.snapshots : []);
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tabParam = String(searchParams.get('tab') || '').trim();
    if (tabParam === 'export') setMainTab('export');
  }, [searchParams]);

  useEffect(() => {
    if (mainTab !== 'export') return;
    loadExportPreview();
    loadSnapshots();
  }, [mainTab, loadExportPreview, loadSnapshots]);

  useEffect(() => {
    const highlightId = String(searchParams.get('highlightPayoutId') || '').trim();
    if (!highlightId || loading) return;
    const match = payouts.find((p) => String(p.id) === highlightId);
    if (match && !isPayoutFullyPaid(match)) {
      setSelectedPayoutIds(new Set([highlightId]));
    }
  }, [searchParams, payouts, loading]);

  const togglePayout = (payoutId) => {
    setSelectedPayoutIds((prev) => {
      const next = new Set(prev);
      if (next.has(payoutId)) next.delete(payoutId);
      else next.add(payoutId);
      return next;
    });
  };

  const toggleAllPayable = () => {
    const selectable = payouts.filter((p) => !isPayoutFullyPaid(p));
    if (!selectable.length) return;
    const allSelected = selectable.every((p) => selectedPayoutIds.has(p.id));
    if (allSelected) setSelectedPayoutIds(new Set());
    else setSelectedPayoutIds(new Set(selectable.map((p) => p.id)));
  };

  const toggleLedgerRow = (ledgerId) => {
    setSelectedLedgerIds((prev) => {
      const next = new Set(prev);
      if (next.has(ledgerId)) next.delete(ledgerId);
      else next.add(ledgerId);
      return next;
    });
  };

  const toggleAllLedger = (checked) => {
    const open = (preview.rows || []).filter((r) => !r.ledgerLocked);
    if (!open.length) return;
    if (checked) setSelectedLedgerIds(new Set(open.map((r) => r.ledgerEntryId)));
    else setSelectedLedgerIds(new Set());
  };

  const openAddPayout = () => {
    setPayoutEditTarget(null);
    setPayoutForm(emptyPayoutForm());
    setPayoutDialogOpen(true);
  };

  const openEditPayout = (p) => {
    setPayoutEditTarget(p);
    setPayoutForm({
      month: String(p.month || ''),
      invoiceNum: String(p.invoiceNum || ''),
      invoiceAmount: String(p.invoiceAmount ?? ''),
      creditNoteNum: String(p.creditNoteNum || ''),
      creditNoteAmount: String(p.creditNoteAmount ?? ''),
      totalPaid: String(p.totalPaid ?? ''),
      status: String(p.status || 'Pending'),
      notes: String(p.notes || ''),
    });
    setPayoutDialogOpen(true);
  };

  const savePayout = async () => {
    setSaveBusy(true);
    setErr('');
    try {
      const body = {
        month: payoutForm.month,
        invoiceNum: payoutForm.invoiceNum,
        invoiceAmount: Number(payoutForm.invoiceAmount || 0),
        creditNoteNum: payoutForm.creditNoteNum,
        creditNoteAmount: Number(payoutForm.creditNoteAmount || 0),
        totalPaid: Number(payoutForm.totalPaid ?? 0) || 0,
        status: payoutForm.status,
        notes: payoutForm.notes,
      };
      const url = payoutEditTarget
        ? `${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payouts/${encodeURIComponent(payoutEditTarget.id)}`
        : `${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payouts`;
      const res = await fetch(url, {
        method: payoutEditTarget ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'שמירה נכשלה');
      setPayoutDialogOpen(false);
      await load();
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setSaveBusy(false);
    }
  };

  const runProviderPaymentExport = async () => {
    const payoutIds = [...selectedPayoutIds];
    if (!payoutIds.length) {
      setErr('נא לבחור לפחות רשומת תשלום אחת');
      return;
    }
    setErr('');
    setExportBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports/provider-payment-export-docx`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: id, payoutIds }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'הורדה נכשלה');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'opal-provider-payment.docx';
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setExportBusy(false);
    }
  };

  const lockVendorPayouts = async () => {
    setLockBusy(true);
    setErr('');
    try {
      const entryIds = [...selectedLedgerIds];
      const body = { fromDate, toDate, entryIds: entryIds.length ? entryIds : null };
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/lock-payouts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'נעילה נכשלה');
      await loadExportPreview();
      await loadSnapshots();
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setLockBusy(false);
    }
  };

  const openSnapEdit = (snap) => {
    setSnapEditTarget(snap);
    setSnapEditForm({
      status: snap.status || 'Pending',
      invoiceNum: snap.invoiceNum || '',
      invoiceAmount: Number(snap.invoiceAmount || 0),
      creditNoteNum: snap.creditNoteNum || '',
      creditNoteAmount: Number(snap.creditNoteAmount || 0),
      totalPaid: Number(snap.totalPaid || 0),
      notes: snap.notes || '',
    });
    setSnapEditOpen(true);
  };

  const saveSnapEdit = async () => {
    if (!snapEditTarget) return;
    setSaveBusy(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-snapshots/${encodeURIComponent(snapEditTarget.id)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(snapEditForm),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      await loadSnapshots();
      await loadExportPreview();
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setSaveBusy(false);
    }
  };

  const selectablePayouts = payouts.filter((p) => !isPayoutFullyPaid(p));
  const openPreviewRows = (preview.rows || []).filter((r) => !r.ledgerLocked);

  if (!token) {
    return (
      <div dir="rtl" className="p-6">
        <p>יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-primary underline">
          כניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto text-right" dir="rtl">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/vendors">
              <ArrowRight className="size-4 me-2" />
              חזרה לספקים
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{vendor?.vendorName || 'ספק'}</h1>
            <p className="text-sm text-muted-foreground">ניהול תשלומים חודשיים ודוח יצוא לספק</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => { load(); if (mainTab === 'export') { loadExportPreview(); loadSnapshots(); } }} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            רענון
          </Button>
        </div>

        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {loading && !vendor ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-8" />
          </div>
        ) : (
          <Tabs value={mainTab} onValueChange={setMainTab} dir="rtl">
            <TabsList>
              <TabsTrigger value="payments">תשלומים לספק</TabsTrigger>
              <TabsTrigger value="export">דוח יצוא לספק</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-4">
              <Card dir="rtl" className="text-right">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>תשלומים לספק</CardTitle>
                    <CardDescription>רישום חשבוניות חודשיות, זיכויים ותשלומים — ייצוא מרוכז לקובץ העברה</CardDescription>
                  </div>
                  <Button type="button" onClick={openAddPayout}>
                    <Plus className="size-4 me-2" />
                    הוספת רשומה
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <Button
                      type="button"
                      disabled={exportBusy || selectedPayoutIds.size === 0}
                      onClick={runProviderPaymentExport}
                    >
                      <Download className="size-4 me-2" />
                      {exportBusy ? 'מוריד…' : 'הורדת קובץ לתשלום'}
                    </Button>
                    {selectedPayoutIds.size > 0 ? (
                      <span className="text-sm text-muted-foreground">נבחרו {selectedPayoutIds.size} רשומות</span>
                    ) : null}
                  </div>

                  <div className="rounded-md border overflow-x-auto" dir="rtl">
                    <Table className="text-right text-sm [&_th]:text-right">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              className="size-4"
                              aria-label="בחר הכל"
                              checked={
                                selectablePayouts.length > 0 &&
                                selectablePayouts.every((p) => selectedPayoutIds.has(p.id))
                              }
                              onChange={toggleAllPayable}
                            />
                          </TableHead>
                          <TableHead>חודש</TableHead>
                          <TableHead>מספר חשבונית</TableHead>
                          <TableHead>סכום חשבונית</TableHead>
                          <TableHead>מספר זיכוי</TableHead>
                          <TableHead>סכום זיכוי</TableHead>
                          <TableHead>סה״כ לתשלום</TableHead>
                          <TableHead>שולם</TableHead>
                          <TableHead>יתרה</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>הערות</TableHead>
                          <TableHead className="whitespace-nowrap">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payouts.map((p) => {
                          const fullyPaid = isPayoutFullyPaid(p);
                          return (
                            <TableRow key={p.id} className={fullyPaid ? 'opacity-50' : undefined}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="size-4"
                                  checked={selectedPayoutIds.has(p.id)}
                                  disabled={fullyPaid}
                                  aria-label={`בחר ${p.month}`}
                                  onChange={() => togglePayout(p.id)}
                                />
                              </TableCell>
                              <TableCell>{p.month}</TableCell>
                              <TableCell dir="ltr" className="text-left font-mono text-xs">
                                {p.invoiceNum || '—'}
                              </TableCell>
                              <TableCell>{formatCurrency(p.invoiceAmount)}</TableCell>
                              <TableCell dir="ltr" className="text-left font-mono text-xs">
                                {p.creditNoteNum || '—'}
                              </TableCell>
                              <TableCell>{formatCurrency(p.creditNoteAmount)}</TableCell>
                              <TableCell>{formatCurrency(p.totalAmount)}</TableCell>
                              <TableCell>{formatCurrency(p.totalPaid)}</TableCell>
                              <TableCell>{formatCurrency(p.balance)}</TableCell>
                              <TableCell>
                                <Badge variant={p.status === 'Paid' ? 'default' : 'secondary'}>
                                  {p.status === 'Paid' ? 'שולם' : 'ממתין'}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[140px] truncate text-xs">{p.notes || '—'}</TableCell>
                              <TableCell>
                                <Button type="button" size="icon" variant="ghost" onClick={() => openEditPayout(p)}>
                                  <Edit2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {!payouts.length ? (
                          <TableRow>
                            <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                              אין רשומות תשלום — הוסיפו רשומה ראשונה
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>דוח יצוא לספק — רשומות פתוחות</CardTitle>
                  <CardDescription>מבוטחים ראשיים שלא ננעלו בדרישת תשלום. ניתן לבחור, לנעול ולשייך מספר חשבונית.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <Field className="min-w-[160px]">
                      <FieldLabel>מתאריך</FieldLabel>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </Field>
                    <Field className="min-w-[160px]">
                      <FieldLabel>עד תאריך</FieldLabel>
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </Field>
                    <Button type="button" variant="outline" onClick={loadExportPreview}>טען</Button>
                    <Button type="button" onClick={lockVendorPayouts} disabled={lockBusy || !openPreviewRows.length}>
                      {lockBusy ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}
                      נעל וצור דרישת תשלום
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    סה״כ לתשלום לספק (פתוח): {formatCurrency(preview.summary?.totalVendorPayout || 0)} · {openPreviewRows.length} רשומות
                  </p>
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="text-sm [&_th]:text-right">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={openPreviewRows.length > 0 && selectedLedgerIds.size === openPreviewRows.length}
                              onChange={(e) => toggleAllLedger(e.target.checked)}
                            />
                          </TableHead>
                          <TableHead>לקוח</TableHead>
                          <TableHead>ת.ז</TableHead>
                          <TableHead>מוצר</TableHead>
                          <TableHead>עלות ספק</TableHead>
                          <TableHead>חודש בילינג</TableHead>
                          <TableHead>הזמנה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(preview.rows || []).map((r) => (
                          <TableRow key={r.ledgerEntryId || r.dealId} className={r.ledgerLocked ? 'opacity-50' : ''}>
                            <TableCell>
                              {!r.ledgerLocked ? (
                                <input
                                  type="checkbox"
                                  className="size-4"
                                  checked={selectedLedgerIds.has(r.ledgerEntryId)}
                                  onChange={() => toggleLedgerRow(r.ledgerEntryId)}
                                />
                              ) : null}
                            </TableCell>
                            <TableCell>{`${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}</TableCell>
                            <TableCell>{r.idNumber || '—'}</TableCell>
                            <TableCell>{r.productName || '—'}</TableCell>
                            <TableCell>{formatCurrency(r.vendorPayout || 0)}</TableCell>
                            <TableCell>{r.billingMonth || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{r.transactionId || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {!preview.rows?.length ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                              אין רשומות פתוחות בטווח
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>דרישות תשלום (נעולות)</CardTitle>
                  <CardDescription>חשבוניות מרוכזות שנוצרו מנעילת רשומות יצוא</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="text-sm [&_th]:text-right">
                      <TableHeader>
                        <TableRow>
                          <TableHead>טווח / חודש</TableHead>
                          <TableHead>עסקאות</TableHead>
                          <TableHead>סה״כ</TableHead>
                          <TableHead>חשבונית</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshots.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              {s.fromDate && s.toDate ? `${s.fromDate} — ${s.toDate}` : s.month || '—'}
                            </TableCell>
                            <TableCell>{s.totalDeals || 0}</TableCell>
                            <TableCell>{formatCurrency(s.totalAmount)}</TableCell>
                            <TableCell>{s.invoiceNum || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={s.status === 'Paid' ? 'default' : 'secondary'}>
                                {s.status === 'Paid' ? 'שולם' : 'ממתין לתשלום'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button type="button" size="sm" variant="outline" onClick={() => { setSnapRowsTarget(s); setSnapRowsOpen(true); }}>
                                  פירוט
                                </Button>
                                <Button type="button" size="icon" variant="ghost" onClick={() => openSnapEdit(s)}>
                                  <Edit2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!snapshots.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              אין דרישות תשלום נעולות
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="sm:max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>{payoutEditTarget ? 'עריכת רשומת תשלום' : 'רשומת תשלום חדשה'}</DialogTitle>
            <DialogDescription>חודש שירות, חשבונית, זיכוי וסכום ששולם</DialogDescription>
          </DialogHeader>
          <FieldGroup className="space-y-4">
            <Field>
              <FieldLabel>חודש (YYYY-MM)</FieldLabel>
              <Input type="month" value={payoutForm.month} onChange={(e) => setPayoutForm((f) => ({ ...f, month: e.target.value }))} className={ltrInputClass} dir="ltr" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>מספר חשבונית</FieldLabel>
                <Input value={payoutForm.invoiceNum} onChange={(e) => setPayoutForm((f) => ({ ...f, invoiceNum: e.target.value }))} className={ltrInputClass} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>סכום חשבונית (₪)</FieldLabel>
                <Input type="number" min="0" step="0.01" value={payoutForm.invoiceAmount} onChange={(e) => setPayoutForm((f) => ({ ...f, invoiceAmount: e.target.value }))} className={ltrInputClass} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>מספר זיכוי</FieldLabel>
                <Input value={payoutForm.creditNoteNum} onChange={(e) => setPayoutForm((f) => ({ ...f, creditNoteNum: e.target.value }))} className={ltrInputClass} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>סכום זיכוי (₪)</FieldLabel>
                <Input type="number" min="0" step="0.01" value={payoutForm.creditNoteAmount} onChange={(e) => setPayoutForm((f) => ({ ...f, creditNoteAmount: e.target.value }))} className={ltrInputClass} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>שולם (₪)</FieldLabel>
                <Input type="number" min="0" step="0.01" value={payoutForm.totalPaid} onChange={(e) => setPayoutForm((f) => ({ ...f, totalPaid: e.target.value }))} className={ltrInputClass} dir="ltr" />
              </Field>
              <Field>
                <FieldLabel>סטטוס</FieldLabel>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right" value={payoutForm.status} onChange={(e) => setPayoutForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="Pending">ממתין</option>
                  <option value="Paid">שולם</option>
                </select>
              </Field>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <p>סה״כ לתשלום (מחושב): <strong>{formatCurrency(previewTotals.totalAmount)}</strong></p>
              <p>יתרה (מחושב): <strong>{formatCurrency(previewTotals.balance)}</strong></p>
            </div>
            <Field>
              <FieldLabel>הערות</FieldLabel>
              <Textarea value={payoutForm.notes} onChange={(e) => setPayoutForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="text-right" />
            </Field>
          </FieldGroup>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button type="button" variant="outline" onClick={() => setPayoutDialogOpen(false)}>ביטול</Button>
            <Button type="button" onClick={savePayout} disabled={saveBusy}>
              {saveBusy ? <Spinner className="me-2" /> : null}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapEditOpen} onOpenChange={setSnapEditOpen}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת דרישת תשלום לספק</DialogTitle>
            <DialogDescription>{snapEditTarget ? `${snapEditTarget.totalDeals || 0} עסקאות · ${formatCurrency(snapEditTarget.totalAmount)}` : ''}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>סטטוס</FieldLabel>
              <select className="flex h-9 w-full rounded-md border px-3 text-sm" value={snapEditForm.status} onChange={(e) => setSnapEditForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="Pending">ממתין לתשלום</option>
                <option value="Paid">שולם</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>מספר חשבונית</FieldLabel>
              <Input value={snapEditForm.invoiceNum} onChange={(e) => setSnapEditForm((p) => ({ ...p, invoiceNum: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>סכום ששולם</FieldLabel>
              <Input type="number" value={snapEditForm.totalPaid} onChange={(e) => setSnapEditForm((p) => ({ ...p, totalPaid: Number(e.target.value || 0) }))} dir="ltr" className="text-end" />
            </Field>
            <Field>
              <FieldLabel>הערות</FieldLabel>
              <Textarea value={snapEditForm.notes} onChange={(e) => setSnapEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </Field>
          </FieldGroup>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setSnapEditOpen(false)}>ביטול</Button>
            <Button onClick={saveSnapEdit} disabled={saveBusy}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapRowsOpen} onOpenChange={setSnapRowsOpen}>
        <DialogContent className="max-w-3xl text-right max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עסקאות בדרישת תשלום</DialogTitle>
            <DialogDescription>{snapRowsTarget ? `${snapRowsTarget.totalDeals || 0} עסקאות · ${formatCurrency(snapRowsTarget.totalAmount)}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-sm [&_th]:text-right">
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>ת.ז</TableHead>
                  <TableHead>מוצר</TableHead>
                  <TableHead>עלות ספק</TableHead>
                  <TableHead>הזמנה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snapRowsTarget?.rows || []).map((r, i) => (
                  <TableRow key={`${r.dealId}-${i}`}>
                    <TableCell>{`${r.firstName || ''} ${r.lastName || ''}`.trim() || r.employeeName || '—'}</TableCell>
                    <TableCell>{r.idNumber || '—'}</TableCell>
                    <TableCell>{r.productName || '—'}</TableCell>
                    <TableCell>{formatCurrency(r.vendorPayout || 0)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.transactionId || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapRowsOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
