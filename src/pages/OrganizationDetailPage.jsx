import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Upload, Download, ArrowRight, Users } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
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

const TOKEN_KEY = 'opal_admin_token';

function ContactSection({ title, data, onChange }) {
  return (
    <div className="space-y-3 border rounded-lg p-3 text-right" dir="rtl">
      <p className="font-medium text-sm">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>שם</FieldLabel>
          <Input value={data?.name || ''} onChange={(e) => onChange('name', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>תפקיד</FieldLabel>
          <Input value={data?.role || ''} onChange={(e) => onChange('role', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>טלפון</FieldLabel>
          <Input dir="ltr" value={data?.phone || ''} onChange={(e) => onChange('phone', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>נייד</FieldLabel>
          <Input dir="ltr" value={data?.mobile || ''} onChange={(e) => onChange('mobile', e.target.value)} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel>אימייל</FieldLabel>
          <Input dir="ltr" value={data?.email || ''} onChange={(e) => onChange('email', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
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

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    try {
      const [oRes, dRes, prRes, payRes] = await Promise.all([
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
      ]);
      if (!oRes.success) throw new Error(oRes.error || 'טעינת ארגון נכשלה');
      setOrg(oRes.organization);
      setDeals(Array.isArray(dRes.deals) ? dRes.deals : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setPayments(Array.isArray(payRes?.rows) ? payRes.rows : []);
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    const tabParam = String(searchParams.get('tab') || '').trim();
    if (tabParam === 'payments') setTab('payments');
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (e2) {
      setErr(e2.message || 'שגיאה');
    } finally {
      setSaveLoading(false);
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
      setImportFile(null);
      await load();
    } catch (e) {
      setErr(e.message || 'שגיאה');
    } finally {
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

  return (
    <AdminPageShell>
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
        </div>

        {err ? <p className="text-sm text-destructive">{err}</p> : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="members" className="gap-1">
              <Users className="size-4" />
              חברים
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1">
              <Upload className="size-4" />
              יבוא עובדים
            </TabsTrigger>
            <TabsTrigger value="settings">הגדרות</TabsTrigger>
            <TabsTrigger value="payments">תשלומים</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4" dir="rtl">
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
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">מקור</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deals.map((d) => (
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
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {d.subscriptionStatus || d.paymentStatus || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground text-right">{d.source || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-4" dir="rtl">
            <Card className="text-right" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle>יבוא עובדים (Excel)</CardTitle>
                <CardDescription>
                  עמודות: שם מלא, ת״ז, תאריך לידה (DD/MM/YYYY), מין, אימייל, טלפון, כתובת, קופת חולים
                  (כללית/מכבי/מאוחדת/לאומית), ביטוח משלים, מצב משפחתי. כפילות לפי ת״ז תידלג.
                </CardDescription>
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
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </Field>
                <Button type="button" disabled={!importFile || importBusy} onClick={runImport}>
                  {importBusy ? <Spinner className="size-4 me-2" /> : <Upload className="size-4 me-2" />}
                  יבוא
                </Button>
                {importResult ? (
                  <div className="rounded-lg border p-3 text-sm space-y-1">
                    <p>
                      נוצרו: <strong>{importResult.created}</strong> · דולגו (כפילות):{' '}
                      <strong>{importResult.skippedDuplicates}</strong>
                    </p>
                    {Array.isArray(importResult.validationFailures) &&
                    importResult.validationFailures.length > 0 ? (
                      <div className="text-destructive space-y-1 max-h-48 overflow-y-auto">
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
                <CardTitle>הגדרות ארגון</CardTitle>
                <CardDescription>עדכון פרטים — מרכז ניהול ארגונים אופאל</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveOrg} className="space-y-6 text-right">
                  <Tabs defaultValue="org">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                      <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                      <TabsTrigger value="billing">תמחור וחיוב</TabsTrigger>
                    </TabsList>
                    <TabsContent value="org" className="mt-4">
                      <FieldGroup>
                        <Field>
                          <FieldLabel>שם חברה *</FieldLabel>
                          <Input
                            required
                            value={org.companyName || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, companyName: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>ח.פ</FieldLabel>
                          <Input
                            value={org.companyId || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, companyId: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>כתובת רשמית</FieldLabel>
                          <Input
                            value={org.officialAddress || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, officialAddress: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>אימייל חברה</FieldLabel>
                          <Input
                            dir="ltr"
                            value={org.companyEmail || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, companyEmail: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>אימייל ליצירת קשר</FieldLabel>
                          <Input
                            dir="ltr"
                            value={org.contactEmail || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, contactEmail: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>טלפון ליצירת קשר</FieldLabel>
                          <Input
                            dir="ltr"
                            value={org.contactPhone || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, contactPhone: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>הערות</FieldLabel>
                          <Textarea
                            rows={3}
                            value={org.notes || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, notes: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>תחום פעילות</FieldLabel>
                          <Input
                            value={org.fieldOfActivity || ''}
                            onChange={(e) => setOrg((p) => ({ ...p, fieldOfActivity: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>מספר עובדים (הערכה)</FieldLabel>
                          <Input
                            type="number"
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
                    <TabsContent value="billing" className="mt-4">
                      <FieldGroup>
                        <Field>
                          <FieldLabel>סוג חיוב</FieldLabel>
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
                        <Field>
                          <FieldLabel>מחיר חודשי לחבר (₪)</FieldLabel>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            value={org.monthlyPricePerMember ?? ''}
                            onChange={(e) =>
                              setOrg((p) => ({ ...p, monthlyPricePerMember: e.target.value }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>שם מוצר לחברים (דוחות / ייצוא לספק)</FieldLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={org.subscriptionProductName || ''}
                            onChange={(e) =>
                              setOrg((p) => ({ ...p, subscriptionProductName: e.target.value }))
                            }
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
                          <FieldLabel>סטטוס ארגון</FieldLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={org.status || 'active'}
                            onChange={(e) => setOrg((p) => ({ ...p, status: e.target.value }))}
                          >
                            <option value="Pending">ממתין לאישור</option>
                            <option value="Lead">ליד</option>
                            <option value="active">פעיל</option>
                          </select>
                        </Field>
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
                <CardTitle>תשלומים חודשיים</CardTitle>
                <CardDescription>
                  {isCentralizedBilling
                    ? 'חיוב חודשי לפי גורמים פעילים × מחיר לחבר'
                    : 'ארגון זה מוגדר לתשלום פרטי מול עובדי הארגון'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isCentralizedBilling ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="[&_th]:text-right">
                          <TableHead>חודש</TableHead>
                          <TableHead>גורמים בארגון</TableHead>
                          <TableHead>סה״כ סכום</TableHead>
                          <TableHead>סטטוס</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.month}>
                            <TableCell>{p.month}</TableCell>
                            <TableCell>{Number(p.totalMembers || 0)}</TableCell>
                            <TableCell>₪{Number(p.totalAmount || 0)}</TableCell>
                            <TableCell>
                              <Badge variant={String(p.status || '').toLowerCase() === 'paid' ? 'default' : 'outline'}>
                                {String(p.status || '').toLowerCase() === 'paid' ? 'שולם' : 'לא שולם'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!payments.length ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">אין חיובים להצגה</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                      ארגון זה מוגדר כתשלום באופן פרטי, ולכן התשלום הינו מול עובדי הארגון באופן פרטני.
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">היסטוריית חיובים מול קארדקום</h3>
                      <TooltipProvider delayDuration={300}>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="[&_th]:text-right">
                              <TableHead>תאריך</TableHead>
                              <TableHead>שם עובד</TableHead>
                              <TableHead>מוצר</TableHead>
                              <TableHead>סכום</TableHead>
                              <TableHead>סטטוס סליקה</TableHead>
                              <TableHead>אסמכתא קארדקום</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {privateBillingDeals.map((d) => {
                              const statusText = String(d.cardcomResponseDescription || d.paymentStatus || '—').trim();
                              const isFailed = /fail|declin|error|denied|נכשל|סירוב/i.test(String(d.paymentStatus || ''));
                              const ref = d.cardcomRecurringId || '—';
                              return (
                                <TableRow key={d.id}>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString('he-IL') : '—'}
                                  </TableCell>
                                  <TableCell>{d.fullName || '—'}</TableCell>
                                  <TableCell>{d.productName || '—'}</TableCell>
                                  <TableCell>₪{Number(d.payerAmount || 0)}</TableCell>
                                  <TableCell className={isFailed ? 'text-destructive font-medium' : ''}>
                                    {String(d.cardcomRecurringId || '').trim() ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">{statusText || '—'}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {`למידע נוסף, ניתן לבדוק בממשק קארדקום תחת מזהה הוראת קבע: ${d.cardcomRecurringId}`}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      statusText || '—'
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{ref}</TableCell>
                                </TableRow>
                              );
                            })}
                            {!privateBillingDeals.length ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">אין חיובים להצגה</TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                      </TooltipProvider>
                    </div>
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
