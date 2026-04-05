import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
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
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyForm = () => ({
  companyName: '',
  companyId: '',
  officialAddress: '',
  companyEmail: '',
  fieldOfActivity: '',
  employeesCount: '',
  billingMethod: 'חיוב מרוכז חברה',
  billingType: 'Centralized',
  monthlyPricePerMember: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  contactPerson: { name: '', role: '', phone: '', mobile: '', email: '' },
  accounting: { name: '', role: '', phone: '', mobile: '', email: '' },
  additionalContact: { name: '', role: '', phone: '', mobile: '', email: '' },
});

export default function OrganizationsDashboard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editOrg, setEditOrg] = useState(null);
  const [editTab, setEditTab] = useState('org');
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('org');
  const [addForm, setAddForm] = useState(() => emptyForm());
  const [billingEditConfirmOpen, setBillingEditConfirmOpen] = useState(false);
  const [billingEditPending, setBillingEditPending] = useState(null);

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const orgRes = await fetch(`${API_BASE}/api/admin/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      if (!orgRes.success) throw new Error(orgRes.error || 'טעינה נכשלה');
      setRows(Array.isArray(orgRes.rows) ? orgRes.rows : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function openAdd() {
    setAddForm(emptyForm());
    setAddTab('org');
    setError('');
    setShowAddModal(true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        companyName: addForm.companyName.trim(),
        companyId: addForm.companyId.trim(),
        officialAddress: addForm.officialAddress.trim(),
        companyEmail: addForm.companyEmail.trim(),
        fieldOfActivity: addForm.fieldOfActivity.trim(),
        employeesCount: Number(addForm.employeesCount || 0),
        billingType: addForm.billingType === 'Centralized' ? 'Centralized' : 'Private',
        billingMethod:
          addForm.billingType === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
        monthlyPricePerMember: Number(addForm.monthlyPricePerMember || 0),
        contactEmail: addForm.contactEmail.trim(),
        contactPhone: addForm.contactPhone.trim(),
        notes: addForm.notes.trim(),
        contactPerson: addForm.contactPerson,
        accounting: addForm.accounting,
        additionalContact: addForm.additionalContact,
        source: 'admin',
      };
      const res = await fetch(`${API_BASE}/api/admin/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowAddModal(false);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editOrg?.id) return;
    setLoading(true);
    setError('');
    try {
      const { id, activeMemberCount, name, taxId, ...rest } = editOrg;
      const body = {
        ...rest,
        monthlyPricePerMember: Number(rest.monthlyPricePerMember || 0),
        employeesCount: Number(rest.employeesCount || 0),
      };
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditOrg(null);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteOrg?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(deleteOrg.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteOrg(null);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function setContact(target, section, field, value) {
    if (target === 'add') {
      setAddForm((p) => ({ ...p, [section]: { ...(p[section] || {}), [field]: value } }));
    } else {
      setEditOrg((p) => (p ? { ...p, [section]: { ...(p[section] || {}), [field]: value } } : null));
    }
  }

  return (
    <AdminPageShell>
      <ConfirmDialog
        open={!!deleteOrg}
        title="מחיקת ארגון"
        message={deleteOrg ? `למחוק את "${deleteOrg.companyName}"?` : ''}
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOrg(null)}
        isLoading={loading}
      />
      <ConfirmDialog
        open={billingEditConfirmOpen}
        title="שינוי סוג חיוב"
        message="שינוי סוג החיוב עלול לשבש את נתוני הלקוחות שכבר משויכים לארגון ושילמו בפועל. אם נדרש תמחור או מודל שונה, מומלץ להקים ארגון חדש במערכת."
        confirmLabel="אישור"
        onConfirm={() => {
          if (!billingEditPending) return;
          const v = billingEditPending.next;
          setEditOrg((p) =>
            p
              ? {
                  ...p,
                  billingType: v,
                  billingMethod: v === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
                }
              : p
          );
          setBillingEditConfirmOpen(false);
          setBillingEditPending(null);
        }}
        onCancel={() => {
          setBillingEditConfirmOpen(false);
          setBillingEditPending(null);
        }}
        isLoading={false}
      />

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>ארגון חדש</DialogTitle>
            <DialogDescription>פרטי ארגון, אנשי קשר וצורת חיוב</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <Tabs value={addTab} onValueChange={setAddTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                <TabsTrigger value="billing">צורת חיוב</TabsTrigger>
              </TabsList>
              <TabsContent value="org" className="mt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>שם חברה *</FieldLabel>
                    <Input value={addForm.companyName} onChange={(e) => setAddForm((p) => ({ ...p, companyName: e.target.value }))} required />
                  </Field>
                  <Field>
                    <FieldLabel>ח.פ</FieldLabel>
                    <Input value={addForm.companyId} onChange={(e) => setAddForm((p) => ({ ...p, companyId: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>כתובת רשמית</FieldLabel>
                    <Input value={addForm.officialAddress} onChange={(e) => setAddForm((p) => ({ ...p, officialAddress: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>אימייל חברה</FieldLabel>
                    <Input dir="ltr" value={addForm.companyEmail} onChange={(e) => setAddForm((p) => ({ ...p, companyEmail: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>אימייל ליצירת קשר</FieldLabel>
                    <Input dir="ltr" value={addForm.contactEmail} onChange={(e) => setAddForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>טלפון ליצירת קשר</FieldLabel>
                    <Input dir="ltr" value={addForm.contactPhone} onChange={(e) => setAddForm((p) => ({ ...p, contactPhone: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>הערות</FieldLabel>
                    <Input value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>תחום פעילות</FieldLabel>
                    <Input value={addForm.fieldOfActivity} onChange={(e) => setAddForm((p) => ({ ...p, fieldOfActivity: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>מספר עובדים</FieldLabel>
                    <Input type="number" value={addForm.employeesCount} onChange={(e) => setAddForm((p) => ({ ...p, employeesCount: e.target.value }))} />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="contacts" className="mt-4 space-y-5">
                <ContactSection title="איש קשר ראשי" data={addForm.contactPerson} onChange={(f, v) => setContact('add', 'contactPerson', f, v)} />
                <ContactSection title="הנהלת חשבונות" data={addForm.accounting} onChange={(f, v) => setContact('add', 'accounting', f, v)} />
                <ContactSection title="איש קשר נוסף" data={addForm.additionalContact} onChange={(f, v) => setContact('add', 'additionalContact', f, v)} />
              </TabsContent>
              <TabsContent value="billing" className="mt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>סוג חיוב</FieldLabel>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={addForm.billingType}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          billingType: e.target.value,
                          billingMethod:
                            e.target.value === 'Centralized' ? 'חיוב מרוכז חברה' : 'חיוב לקוח פרטי',
                        }))
                      }
                    >
                      <option value="Private">תשלום פרטי (הנחת ארגון — קישור /register)</option>
                      <option value="Centralized">תשלום מרוכז (יבוא עובדים)</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>מחיר חודשי לחבר (₪)</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      value={addForm.monthlyPricePerMember}
                      onChange={(e) => setAddForm((p) => ({ ...p, monthlyPricePerMember: e.target.value }))}
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>
            </Tabs>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>ביטול</Button>
              <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת ארגון</DialogTitle>
            <DialogDescription>עדכנו פרטים, אנשי קשר וחיוב</DialogDescription>
          </DialogHeader>
          {editOrg ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <Tabs value={editTab} onValueChange={setEditTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="org">פרטי ארגון</TabsTrigger>
                  <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
                  <TabsTrigger value="billing">צורת חיוב</TabsTrigger>
                </TabsList>
                <TabsContent value="org" className="mt-4">
                  <FieldGroup>
                    <Field><FieldLabel>שם חברה *</FieldLabel><Input value={editOrg.companyName || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyName: e.target.value }))} required /></Field>
                    <Field><FieldLabel>ח.פ</FieldLabel><Input value={editOrg.companyId || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                    <Field><FieldLabel>כתובת רשמית</FieldLabel><Input value={editOrg.officialAddress || ''} onChange={(e) => setEditOrg((p) => ({ ...p, officialAddress: e.target.value }))} /></Field>
                    <Field><FieldLabel>אימייל חברה</FieldLabel><Input dir="ltr" value={editOrg.companyEmail || ''} onChange={(e) => setEditOrg((p) => ({ ...p, companyEmail: e.target.value }))} /></Field>
                    <Field><FieldLabel>אימייל ליצירת קשר</FieldLabel><Input dir="ltr" value={editOrg.contactEmail || ''} onChange={(e) => setEditOrg((p) => ({ ...p, contactEmail: e.target.value }))} /></Field>
                    <Field><FieldLabel>טלפון ליצירת קשר</FieldLabel><Input dir="ltr" value={editOrg.contactPhone || ''} onChange={(e) => setEditOrg((p) => ({ ...p, contactPhone: e.target.value }))} /></Field>
                    <Field><FieldLabel>הערות</FieldLabel><Input value={editOrg.notes || ''} onChange={(e) => setEditOrg((p) => ({ ...p, notes: e.target.value }))} /></Field>
                    <Field><FieldLabel>תחום פעילות</FieldLabel><Input value={editOrg.fieldOfActivity || ''} onChange={(e) => setEditOrg((p) => ({ ...p, fieldOfActivity: e.target.value }))} /></Field>
                    <Field><FieldLabel>מספר עובדים</FieldLabel><Input type="number" value={editOrg.employeesCount || ''} onChange={(e) => setEditOrg((p) => ({ ...p, employeesCount: e.target.value }))} /></Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="contacts" className="mt-4 space-y-5">
                  <ContactSection title="איש קשר ראשי" data={editOrg.contactPerson || {}} onChange={(f, v) => setContact('edit', 'contactPerson', f, v)} />
                  <ContactSection title="הנהלת חשבונות" data={editOrg.accounting || {}} onChange={(f, v) => setContact('edit', 'accounting', f, v)} />
                  <ContactSection title="איש קשר נוסף" data={editOrg.additionalContact || {}} onChange={(f, v) => setContact('edit', 'additionalContact', f, v)} />
                </TabsContent>
                <TabsContent value="billing" className="mt-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>סוג חיוב</FieldLabel>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editOrg.billingType === 'Centralized' ? 'Centralized' : 'Private'}
                        onChange={(e) => {
                          const v = e.target.value;
                          const prev = editOrg.billingType === 'Centralized' ? 'Centralized' : 'Private';
                          if (v === prev) return;
                          setBillingEditPending({ next: v, prev });
                          setBillingEditConfirmOpen(true);
                        }}
                      >
                        <option value="Private">תשלום פרטי (הנחת ארגון)</option>
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
                        value={editOrg.monthlyPricePerMember ?? ''}
                        onChange={(e) => setEditOrg((p) => ({ ...p, monthlyPricePerMember: e.target.value }))}
                      />
                    </Field>
                  </FieldGroup>
                </TabsContent>
              </Tabs>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditOrg(null)}>ביטול</Button>
                <Button type="submit" disabled={loading}>{loading && <Spinner className="me-2" />}שמירה</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="space-y-6 text-right" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" />
              מרכז ניהול ארגונים אופאל
            </h1>
            <p className="text-muted-foreground">אופאל — ארגונים, חברים פעילים, יבוא והרשמה</p>
          </div>
          <Button onClick={openAdd}><Plus className="size-4 me-2" />הוסף ארגון</Button>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <p className="text-sm text-muted-foreground">
          טופס ציבורי להצטרפות ארגון זמין ב־<Link className="text-primary underline" to="/organization-join-request">/organization-join-request</Link>
        </p>

        <Card>
          <CardHeader>
            <CardTitle>רשימת ארגונים</CardTitle>
            <CardDescription>
              {rows.length} ארגונים במערכת
              <Button
                variant="link"
                className="px-2 h-auto font-normal text-primary"
                type="button"
                onClick={loadRows}
              >
                רענון
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon"><Building2 className="size-8" /></EmptyMedia>
                <EmptyTitle>אין ארגונים</EmptyTitle>
                <EmptyDescription>הוסיפו ארגון ראשון כדי להתחיל ניהול מרוכז</EmptyDescription>
                <Button className="mt-4" type="button" onClick={openAdd}><Plus className="size-4 me-2" />הוסף ארגון חדש</Button>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-md border" dir="rtl">
                <Table className="text-right">
                  <TableHeader>
                    <TableRow className="[&_th]:text-right">
                      <TableHead className="text-right">שם חברה</TableHead>
                      <TableHead className="text-right">ח.פ</TableHead>
                      <TableHead className="text-right">סוג חיוב</TableHead>
                      <TableHead className="text-right">חברים פעילים</TableHead>
                      <TableHead className="text-right">מחיר לחבר</TableHead>
                      <TableHead className="text-right">אימייל</TableHead>
                      <TableHead className="w-40 text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.companyName || '—'}</TableCell>
                        <TableCell>{r.companyId || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.billingType === 'Centralized' ? 'מרוכז' : 'פרטי'}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.activeMemberCount ?? 0}</TableCell>
                        <TableCell dir="ltr">
                          {r.monthlyPricePerMember != null && Number(r.monthlyPricePerMember) > 0
                            ? `₪${Number(r.monthlyPricePerMember)}`
                            : '—'}
                        </TableCell>
                        <TableCell dir="ltr" className="text-start text-sm">
                          {r.contactEmail || r.companyEmail || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button variant="outline" size="sm" type="button" asChild>
                              <Link to={`/admin/organizations/${encodeURIComponent(r.id)}`}>פרופיל</Link>
                            </Button>
                            <Button variant="ghost" size="icon" type="button" onClick={() => { setEditTab('org'); setEditOrg({ ...emptyForm(), ...r, billingType: r.billingType || (r.billingMethod?.includes('מרוכז') ? 'Centralized' : 'Private') }); }}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" type="button" onClick={() => setDeleteOrg(r)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {loading && rows.length > 0 ? <p className="text-sm text-muted-foreground mt-2">טוען…</p> : null}
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}

function ContactSection({ title, data, onChange }) {
  return (
    <div className="space-y-3 border rounded-lg p-3 text-right" dir="rtl">
      <p className="font-medium text-sm">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel>שם</FieldLabel><Input value={data?.name || ''} onChange={(e) => onChange('name', e.target.value)} /></Field>
        <Field><FieldLabel>תפקיד</FieldLabel><Input value={data?.role || ''} onChange={(e) => onChange('role', e.target.value)} /></Field>
        <Field><FieldLabel>טלפון</FieldLabel><Input dir="ltr" value={data?.phone || ''} onChange={(e) => onChange('phone', e.target.value)} /></Field>
        <Field><FieldLabel>נייד</FieldLabel><Input dir="ltr" value={data?.mobile || ''} onChange={(e) => onChange('mobile', e.target.value)} /></Field>
        <Field className="sm:col-span-2"><FieldLabel>אימייל</FieldLabel><Input dir="ltr" value={data?.email || ''} onChange={(e) => onChange('email', e.target.value)} /></Field>
      </div>
    </div>
  );
}
