import React, { useMemo, useState, useEffect } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyForm = {
  companyName: '',
  companyId: '',
  officialAddress: '',
  companyEmail: '',
  fieldOfActivity: '',
  employeesCount: '',
  billingMethod: 'corporate',
};

export default function OrganizationsDashboard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const publicJoinUrl = useMemo(() => `${window.location.origin}/organization-join-request`, []);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינה נכשלה');
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function createOrg(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        companyName: form.companyName.trim(),
        companyId: form.companyId.trim(),
        officialAddress: form.officialAddress.trim(),
        companyEmail: form.companyEmail.trim(),
        fieldOfActivity: form.fieldOfActivity.trim(),
        employeesCount: Number(form.employeesCount || 0),
        billingMethod: form.billingMethod,
        source: 'admin',
      };
      const res = await fetch(`${API_BASE}/api/admin/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageShell>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ארגון חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOrg} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>שם חברה *</FieldLabel>
                <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel>ח.פ</FieldLabel>
                <Input value={form.companyId} onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>כתובת רשמית</FieldLabel>
                <Input value={form.officialAddress} onChange={(e) => setForm((p) => ({ ...p, officialAddress: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>אימייל חברה</FieldLabel>
                <Input dir="ltr" value={form.companyEmail} onChange={(e) => setForm((p) => ({ ...p, companyEmail: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>תחום פעילות</FieldLabel>
                <Input value={form.fieldOfActivity} onChange={(e) => setForm((p) => ({ ...p, fieldOfActivity: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>מספר עובדים</FieldLabel>
                <Input type="number" value={form.employeesCount} onChange={(e) => setForm((p) => ({ ...p, employeesCount: e.target.value }))} />
              </Field>
            </FieldGroup>
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button type="submit">שמירה</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-6 text-primary" />
              ניהול ארגונים
            </h1>
            <p className="text-muted-foreground">יצירה ידנית וצפייה בארגונים</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              רענון
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4 me-2" />
              ארגון חדש
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>קישור ציבורי להצטרפות</CardTitle>
            <CardDescription>
              <code className="rounded bg-muted px-1 text-xs">{publicJoinUrl}</code>
            </CardDescription>
          </CardHeader>
        </Card>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle>ארגונים</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם חברה</TableHead>
                    <TableHead>ח.פ</TableHead>
                    <TableHead>אימייל</TableHead>
                    <TableHead>תחום</TableHead>
                    <TableHead>עובדים</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.companyName || '—'}</TableCell>
                      <TableCell>{r.companyId || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-start">{r.companyEmail || '—'}</TableCell>
                      <TableCell>{r.fieldOfActivity || '—'}</TableCell>
                      <TableCell>{r.employeesCount || 0}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!rows.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">אין ארגונים להצגה</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
