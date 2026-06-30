import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Edit2, Lock, RefreshCw, Search } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import VendorPaymentEditDrawer from '../components/drawers/VendorPaymentEditDrawer.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import TableNumericFooter from '../components/admin/TableNumericFooter.jsx';
import { openAdminPath } from '../utils/adminNavigation.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

function monthStartEndIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const toYmd = (dt) => dt.toISOString().slice(0, 10);
  return { from: toYmd(start), to: toYmd(end) };
}

function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(
    Number(v || 0)
  );
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const dateDefaults = monthStartEndIso();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [vendor, setVendor] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [mainTab, setMainTab] = useState('payments');

  const [fromDate, setFromDate] = useState(dateDefaults.from);
  const [toDate, setToDate] = useState(dateDefaults.to);
  const [preview, setPreview] = useState({ rows: [], summary: {} });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedEntryKeys, setSelectedEntryKeys] = useState(() => new Set());

  function previewRowKey(r) {
    return String(r.ledgerEntryId || r.rowId || `${r.dealId}-${r.billingMonth}`);
  }
  const [lockBusy, setLockBusy] = useState(false);
  const [snapEditOpen, setSnapEditOpen] = useState(false);
  const [snapEditTarget, setSnapEditTarget] = useState(null);
  const [snapRowsOpen, setSnapRowsOpen] = useState(false);
  const [snapRowsTarget, setSnapRowsTarget] = useState(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setErr('');
    setLoading(true);
    try {
      const vRes = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vj = await vRes.json().catch(() => ({}));
      if (!vRes.ok) throw new Error(vj.error || 'טעינת ספק נכשלה');
      setVendor(vj.vendor || null);
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  const loadExportPreview = useCallback(async (from, to) => {
    if (!token || !id) return;
    setPreviewLoading(true);
    setErr('');
    try {
      const q = new URLSearchParams();
      if (from) q.set('fromDate', from);
      if (to) q.set('toDate', to);
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-preview?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'טעינת תצוגה מקדימה נכשלה');
      setPreview({ rows: j.rows || [], summary: j.summary || {}, note: j.note || '' });
      const openKeys = (j.rows || [])
        .filter((r) => !r.ledgerLocked)
        .map((r) => previewRowKey(r));
      setSelectedEntryKeys(new Set(openKeys));
    } catch (e) {
      setErr(e?.message || 'שגיאה');
      setPreview({ rows: [], summary: {} });
      setSelectedEntryKeys(new Set());
    } finally {
      setPreviewLoading(false);
    }
  }, [token, id]);

  const loadSnapshots = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-snapshots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'טעינת תשלומים נכשלה');
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
    if (mainTab === 'payments') loadSnapshots();
  }, [mainTab, loadSnapshots]);

  useEffect(() => {
    if (mainTab === 'export') loadExportPreview(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- טעינה רק במעבר לטאב, לא בשינוי תאריכים
  }, [mainTab]);

  const openPreviewRows = (preview.rows || []).filter((r) => !r.ledgerLocked);

  const toggleEntryRow = (key) => {
    setSelectedEntryKeys((prev) => {
      const next = new Set(prev);
      const k = String(key);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAllEntries = (checked) => {
    if (!openPreviewRows.length) return;
    if (checked) setSelectedEntryKeys(new Set(openPreviewRows.map((r) => previewRowKey(r))));
    else setSelectedEntryKeys(new Set());
  };

  const lockVendorPayouts = async () => {
    const selectedRows = openPreviewRows.filter((r) => selectedEntryKeys.has(previewRowKey(r)));
    if (!selectedRows.length) {
      setErr('נא לבחור לפחות רשומה אחת לנעילה');
      return;
    }
    const entryIds = selectedRows
      .map((r) => String(r.ledgerEntryId || '').trim())
      .filter(Boolean);
    const rowIds = selectedRows
      .filter((r) => !r.ledgerEntryId && r.rowId)
      .map((r) => String(r.rowId));
    setLockBusy(true);
    setErr('');
    try {
      const body = {
        fromDate,
        toDate,
        ...(entryIds.length ? { entryIds } : {}),
        ...(rowIds.length ? { rowIds } : {}),
      };
      const res = await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/lock-payouts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'נעילה נכשלה');
      await loadExportPreview(fromDate, toDate);
      await loadSnapshots();
      setMainTab('payments');
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setLockBusy(false);
    }
  };

  const openSnapEdit = (snap) => {
    setSnapEditTarget(snap);
    setSnapEditOpen(true);
  };

  const saveSnapEdit = async (form) => {
    if (!snapEditTarget) return;
    setSaveBusy(true);
    setErr('');
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vendors/${encodeURIComponent(id)}/payout-snapshots/${encodeURIComponent(snapEditTarget.id)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      setSnapEditOpen(false);
      setSnapEditTarget(null);
      await loadSnapshots();
    } catch (e) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setSaveBusy(false);
    }
  };

  const lockDisabled = lockBusy || previewLoading || selectedEntryKeys.size === 0;

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
            <p className="text-sm text-muted-foreground">תשלומים מרוכזים ודוח יצוא לספק</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              load();
              if (mainTab === 'export') loadExportPreview(fromDate, toDate);
              if (mainTab === 'payments') loadSnapshots();
            }}
            disabled={loading}
          >
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
                <CardHeader>
                  <CardTitle>תשלומים לספק</CardTitle>
                  <CardDescription>דרישות תשלום שנוצרו מנעילת רשומות יצוא — נוצרות אוטומטית בלבד</CardDescription>
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
                          <TableRow
                            key={s.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => openSnapEdit(s)}
                          >
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
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSnapRowsTarget(s);
                                    setSnapRowsOpen(true);
                                  }}
                                >
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
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              אין תשלומים — נעלו רשומות מדוח היצוא ליצירת דרישת תשלום
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                      <TableNumericFooter
                        leadingColSpan={1}
                        trailingColSpan={3}
                        rows={snapshots}
                        columns={[
                          { key: 'totalDeals', getValue: (s) => s.totalDeals ?? 0 },
                          { key: 'totalAmount', format: 'currency2', getValue: (s) => s.totalAmount },
                        ]}
                      />
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>דוח יצוא לספק — רשומות פתוחות</CardTitle>
                  <CardDescription>
                    מבוטחים ראשיים זכאים לשירות (פעיל / ממתין לביטול). בחרו שורות ונעלו ליצירת דרישת תשלום — זהה לדוח
                    ייצוא לספק במסך דוחות.
                  </CardDescription>
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
                    <Button type="button" variant="outline" className="gap-2" onClick={() => loadExportPreview(fromDate, toDate)} disabled={previewLoading}>
                      {previewLoading ? <RefreshCw className="size-4 me-2 animate-spin" /> : <Search className="size-4 me-2" />}
                      {previewLoading ? 'טוען…' : 'חיפוש'}
                    </Button>
                    <Button type="button" onClick={lockVendorPayouts} disabled={lockDisabled}>
                      {lockBusy ? <Spinner className="size-4 me-2" /> : <Lock className="size-4 me-2" />}
                      נעל וצור דרישת תשלום
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    סה״כ לתשלום לספק (פתוח): {formatCurrency(preview.summary?.totalVendorPayout || 0)} ·{' '}
                    {openPreviewRows.length} רשומות
                    {selectedEntryKeys.size > 0 ? ` · נבחרו ${selectedEntryKeys.size}` : ''}
                  </p>
                  {preview.note ? (
                    <p className="text-xs text-muted-foreground">{preview.note}</p>
                  ) : null}
                  <div className="rounded-md border overflow-x-auto relative">
                    {previewLoading ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <Spinner className="size-8" />
                      </div>
                    ) : null}
                    <Table className="text-sm [&_th]:text-right">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              className="size-4"
                              disabled={previewLoading || !openPreviewRows.length}
                              checked={
                                openPreviewRows.length > 0 && selectedEntryKeys.size === openPreviewRows.length
                              }
                              onChange={(e) => toggleAllEntries(e.target.checked)}
                            />
                          </TableHead>
                          <TableHead>לקוח</TableHead>
                          <TableHead>ת.ז.</TableHead>
                          <TableHead>חודש חיוב</TableHead>
                          <TableHead>תאריך תחילת מנוי</TableHead>
                          <TableHead>תאריך סיום מנוי</TableHead>
                          <TableHead>מוצר</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>תשלום לספק</TableHead>
                          <TableHead>הזמנה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openPreviewRows.map((r) => (
                          <TableRow key={previewRowKey(r)} className={r.ledgerLocked ? 'opacity-50 bg-muted/40' : undefined}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="size-4"
                                checked={selectedEntryKeys.has(previewRowKey(r))}
                                disabled={previewLoading || r.ledgerLocked}
                                onChange={() => toggleEntryRow(previewRowKey(r))}
                              />
                            </TableCell>
                            <TableCell>{`${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}</TableCell>
                            <TableCell>{r.idNumber || '—'}</TableCell>
                            <TableCell className="font-medium tabular-nums">
                              {r.billingMonthDisplay || r.billingMonth || '—'}
                            </TableCell>
                            <TableCell>{r.subscriptionStartDate || '—'}</TableCell>
                            <TableCell>{r.subscriptionEndDisplay || r.subscriptionEndDate || '—'}</TableCell>
                            <TableCell>{r.productName || '—'}</TableCell>
                            <TableCell>{r.subscriptionStatus || '—'}</TableCell>
                            <TableCell>{formatCurrency(r.vendorPayout)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.transactionId ? (
                                <button
                                  type="button"
                                  className="text-primary hover:underline"
                                  onClick={() => openAdminPath(`/admin/subscribers?search=${encodeURIComponent(r.transactionId)}`)}
                                >
                                  {r.transactionId}
                                </button>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!openPreviewRows.length && !previewLoading ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                              אין רשומות פתוחות בטווח — עדכנו תאריכים ולחצו חיפוש
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                      <TableNumericFooter
                        leadingColSpan={8}
                        trailingColSpan={1}
                        rows={openPreviewRows}
                        columns={[{ key: 'vendorPayout', format: 'currency2', getValue: (r) => r.vendorPayout }]}
                      />
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <VendorPaymentEditDrawer
        open={snapEditOpen}
        onOpenChange={(open) => {
          setSnapEditOpen(open);
          if (!open) setSnapEditTarget(null);
        }}
        vendorName={vendor?.vendorName || snapEditTarget?.vendorName || ''}
        snapshot={snapEditTarget}
        onSave={saveSnapEdit}
        saving={saveBusy}
      />

      <Dialog open={snapRowsOpen} onOpenChange={setSnapRowsOpen}>
        <DialogContent className="sm:max-w-2xl text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>פירוט דרישת תשלום</DialogTitle>
            <DialogDescription>
              {snapRowsTarget
                ? `${snapRowsTarget.fromDate || ''} ${snapRowsTarget.toDate ? `— ${snapRowsTarget.toDate}` : ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table className="text-sm [&_th]:text-right">
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>הזמנה</TableHead>
                  <TableHead>תשלום לספק</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snapRowsTarget?.rows || []).map((r, i) => (
                  <TableRow key={`${r.ledgerEntryId || r.dealId || i}`}>
                    <TableCell>{`${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.transactionId ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => openAdminPath(`/admin/subscribers?search=${encodeURIComponent(r.transactionId)}`)}
                        >
                          {r.transactionId}
                        </button>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{formatCurrency(r.vendorPayout)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableNumericFooter
                leadingColSpan={2}
                rows={snapRowsTarget?.rows || []}
                columns={[{ key: 'vendorPayout', format: 'currency2', getValue: (r) => r.vendorPayout }]}
              />
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
