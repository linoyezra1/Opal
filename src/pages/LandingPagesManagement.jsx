import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LayoutTemplate, Plus, Edit2, Trash2, Copy, ExternalLink } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
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
import { Input } from '../components/ui/input.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyForm = () => ({
  slug: '',
  pageTitle: '',
  subTitle: '',
  mainContent: '',
  subContent: '',
  imageUrl: '',
  priceListId: '',
});

export default function LandingPagesManagement() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [pages, setPages] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);

  const publicBase = useMemo(() => `${window.location.origin}/p/`, []);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [pRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (!pRes.success) throw new Error(pRes.error || 'טעינת דפים נכשלה');
      if (plRes.success) setPriceLists(plRes.lists || []);
      setPages(pRes.pages || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      slug: row.slug || '',
      pageTitle: row.pageTitle || '',
      subTitle: row.subTitle || '',
      mainContent: row.mainContent || '',
      subContent: row.subContent || '',
      imageUrl: row.imageUrl || '',
      priceListId: row.priceListId || '',
    });
    setDialogOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        slug: form.slug.trim().toLowerCase(),
        pageTitle: form.pageTitle,
        subTitle: form.subTitle,
        mainContent: form.mainContent,
        subContent: form.subContent,
        imageUrl: form.imageUrl,
        priceListId: form.priceListId,
      };
      const url = editingId ? `${API_BASE}/api/admin/landing-pages/${editingId}` : `${API_BASE}/api/admin/landing-pages`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setDialogOpen(false);
      await load();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/landing-pages/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteId(null);
      await load();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl(slug) {
    try {
      await navigator.clipboard.writeText(`${publicBase}${slug}`);
    } catch {
      /* ignore */
    }
  }

  if (!token) {
    return (
      <div dir="rtl" className="p-6">
        <Link to="/admin" className="text-primary underline">
          התחברות מנהל
        </Link>
      </div>
    );
  }

  return (
    <AdminPageShell>
      <ConfirmDialog
        open={!!deleteId}
        title="מחיקת דף נחיתה"
        message="למחוק דף זה? הקישור הציבורי יפסיק לעבוד."
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={loading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת דף נחיתה' : 'דף נחיתה חדש'}</DialogTitle>
            <DialogDescription>
              מזהה URL באנגלית קטנה (slug), תוכן ומחירון. הקישור יהיה: <code className="text-xs bg-muted px-1 rounded">/p/slug</code>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>מזהה URL (slug) * — אנגלית קטנה, מקפים</FieldLabel>
                <Input
                  dir="ltr"
                  className="font-mono"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="doctor-plan-2025"
                  required
                  disabled={!!editingId}
                />
              </Field>
              <Field>
                <FieldLabel>כותרת</FieldLabel>
                <Input value={form.pageTitle} onChange={(e) => setForm((p) => ({ ...p, pageTitle: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>תת-כותרת</FieldLabel>
                <Input value={form.subTitle} onChange={(e) => setForm((p) => ({ ...p, subTitle: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>תוכן ראשי</FieldLabel>
                <Textarea rows={4} value={form.mainContent} onChange={(e) => setForm((p) => ({ ...p, mainContent: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>תת-תוכן (רשימות, פסקאות)</FieldLabel>
                <Textarea rows={5} value={form.subContent} onChange={(e) => setForm((p) => ({ ...p, subContent: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>קישור לתמונה (URL)</FieldLabel>
                <Input dir="ltr" value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
              </Field>
              <Field>
                <FieldLabel>מחירון מקושר *</FieldLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.priceListId}
                  onChange={(e) => setForm((p) => ({ ...p, priceListId: e.target.value }))}
                  required
                >
                  <option value="">— בחרו מחירון —</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.listName} ({(pl.lines || []).length} מוצרים)
                    </option>
                  ))}
                </select>
              </Field>
            </FieldGroup>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Spinner className="me-2" />}
                שמירה
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutTemplate className="size-7 text-primary" />
              דפי נחיתה
            </h1>
            <p className="text-muted-foreground">בניית דפים דינמיים וקישור למחירונים</p>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4 me-2" />
            דף חדש
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>דפים שמורים</CardTitle>
            <CardDescription>כתובת ציבורית: {publicBase}…</CardDescription>
          </CardHeader>
          <CardContent>
            {pages.length === 0 && !loading ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <LayoutTemplate className="size-8" />
                </EmptyMedia>
                <EmptyTitle>אין דפים</EmptyTitle>
                <EmptyDescription>צרו דף נחיתה וקשרו למחירון</EmptyDescription>
                <Button className="mt-4" type="button" onClick={openCreate}>
                  <Plus className="size-4 me-2" />
                  דף חדש
                </Button>
              </Empty>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>slug</TableHead>
                      <TableHead>כותרת</TableHead>
                      <TableHead>מחירון</TableHead>
                      <TableHead>קישור</TableHead>
                      <TableHead className="w-28">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((pg) => (
                      <TableRow key={pg.id}>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {pg.slug}
                        </TableCell>
                        <TableCell className="font-medium">{pg.pageTitle || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pg.priceListId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-[10px] bg-muted px-1 rounded truncate max-w-[140px]">
                              {publicBase}
                              {pg.slug}
                            </code>
                            <Button type="button" variant="ghost" size="icon" onClick={() => copyUrl(pg.slug)} title="העתק">
                              <Copy className="size-4" />
                            </Button>
                            <a href={`${publicBase}${pg.slug}`} target="_blank" rel="noreferrer" className="text-primary">
                              <ExternalLink className="size-4" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(pg)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" type="button" onClick={() => setDeleteId(pg.id)}>
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
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
