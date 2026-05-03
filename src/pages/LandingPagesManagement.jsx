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
  pageType: 'sales',
  pageTitle: '',
  subTitle: '',
  mainContent: '',
  subContent: '',
  imageUrl: '',
  priceListId: '',
  validFrom: '',
  validTo: '',
  whatYouGetTitle: '',
  whatYouGetSubtitle: '',
  whatYouGetItemsJson: '',
  registrationTitle: '',
  registrationSubtitle: '',
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
      pageType: row.pageType === 'contact' ? 'contact' : 'sales',
      pageTitle: row.pageTitle || '',
      subTitle: row.subTitle || '',
      mainContent: row.mainContent || '',
      subContent: row.subContent || '',
      imageUrl: row.imageUrl || '',
      priceListId: row.priceListId || '',
      validFrom: row.validFrom ? String(row.validFrom).slice(0, 10) : '',
      validTo: row.validTo ? String(row.validTo).slice(0, 10) : '',
      whatYouGetTitle: row.whatYouGetTitle || '',
      whatYouGetSubtitle: row.whatYouGetSubtitle || '',
      whatYouGetItemsJson:
        row.whatYouGetItems && row.whatYouGetItems.length > 0
          ? JSON.stringify(row.whatYouGetItems, null, 2)
          : '',
      registrationTitle: row.registrationTitle || '',
      registrationSubtitle: row.registrationSubtitle || '',
    });
    setDialogOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let whatYouGetItems = [];
      if (form.whatYouGetItemsJson?.trim()) {
        try {
          const parsed = JSON.parse(form.whatYouGetItemsJson);
          if (!Array.isArray(parsed)) throw new Error('not array');
          whatYouGetItems = parsed;
        } catch {
          setError('שדה "מה אתם מקבלים (JSON)" לא תקין — נדרש מערך אובייקטים.');
          setLoading(false);
          return;
        }
      }
      const isContact = form.pageType === 'contact';
      if (!isContact && !String(form.priceListId || '').trim()) {
        setError('בדף מכירות יש לבחור מחירון.');
        setLoading(false);
        return;
      }
      const body = {
        slug: form.slug.trim().toLowerCase(),
        pageType: form.pageType,
        pageTitle: form.pageTitle,
        subTitle: form.subTitle,
        mainContent: form.mainContent,
        subContent: form.subContent,
        imageUrl: form.imageUrl,
        priceListId: isContact ? '' : form.priceListId,
        validFrom: String(form.validFrom || '').trim(),
        validTo: String(form.validTo || '').trim(),
        whatYouGetTitle: form.whatYouGetTitle,
        whatYouGetSubtitle: form.whatYouGetSubtitle,
        whatYouGetItems,
        registrationTitle: form.registrationTitle,
        registrationSubtitle: form.registrationSubtitle,
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

  function onImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // DataURL makes deployments simpler (no separate upload endpoint).
    // Keep size reasonable to avoid very large payloads.
    const maxBytes = 2 * 1024 * 1024; // 2MB (client-side; no Multer on this flow)
    if (file.size > maxBytes) {
      setError('קובץ התמונה גדול מדי — מקסימום 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setForm((p) => ({ ...p, imageUrl: url }));
    };
    reader.readAsDataURL(file);
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת דף נחיתה' : 'דף נחיתה חדש'}</DialogTitle>
            <DialogDescription>
              מזהה URL באנגלית קטנה (slug), תוכן, ובדף מכירות — מחירון. הקישור:{' '}
              <code className="text-xs bg-muted px-1 rounded">/p/slug</code>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>סוג דף *</FieldLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.pageType}
                  onChange={(e) => setForm((p) => ({ ...p, pageType: e.target.value }))}
                >
                  <option value="sales">דף מכירות (מחירון + הרשמה)</option>
                  <option value="contact">דף צור קשר (טופס צור קשר)</option>
                </select>
              </Field>
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
                <div className="mt-2 space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    או העלאת תמונה מהמחשב
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onImageFileChange}
                    className="w-full text-sm"
                  />
                  {form.imageUrl && form.imageUrl.startsWith('data:') ? (
                    <p className="text-xs text-muted-foreground">נבחרה תמונה מקומית (DataURL)</p>
                  ) : null}
                </div>
              </Field>
              <Field>
                <FieldLabel>כותרת סעיף &quot;מה אתם מקבלים?&quot;</FieldLabel>
                <Input
                  value={form.whatYouGetTitle}
                  onChange={(e) => setForm((p) => ({ ...p, whatYouGetTitle: e.target.value }))}
                  placeholder="ברירת מחדל אם ריק"
                />
              </Field>
              <Field>
                <FieldLabel>תת-כותרת סעיף &quot;מה אתם מקבלים&quot;</FieldLabel>
                <Input
                  value={form.whatYouGetSubtitle}
                  onChange={(e) => setForm((p) => ({ ...p, whatYouGetSubtitle: e.target.value }))}
                  placeholder="חבילת שירותים…"
                />
              </Field>
              <Field>
                <FieldLabel>פריטי &quot;מה אתם מקבלים&quot; (JSON — אופציונלי)</FieldLabel>
                <Textarea
                  dir="ltr"
                  className="font-mono text-xs min-h-[120px]"
                  value={form.whatYouGetItemsJson}
                  onChange={(e) => setForm((p) => ({ ...p, whatYouGetItemsJson: e.target.value }))}
                  placeholder={`[{"title":"ייעוץ…","description":"…","icon":"phone"}]\nאייקונים: phone, users, pill, stethoscope, syringe, file`}
                />
              </Field>
              <Field>
                <FieldLabel>כותרת טופס הרשמה</FieldLabel>
                <Input
                  value={form.registrationTitle}
                  onChange={(e) => setForm((p) => ({ ...p, registrationTitle: e.target.value }))}
                  placeholder="הרשמה לשירות"
                />
              </Field>
              <Field>
                <FieldLabel>תת-כותרת טופס הרשמה</FieldLabel>
                <Input
                  value={form.registrationSubtitle}
                  onChange={(e) => setForm((p) => ({ ...p, registrationSubtitle: e.target.value }))}
                  placeholder="מלאו את הפרטים…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>תאריך פתיחה (validFrom)</FieldLabel>
                  <Input type="date" dir="ltr" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>תאריך תפוגה (validTo)</FieldLabel>
                  <Input type="date" dir="ltr" value={form.validTo} onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))} />
                </Field>
              </div>

              {form.pageType === 'sales' ? (
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
              ) : (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                  דף צור קשר: לא נדרש מחירון. הלידים יופיעו בלוח הבקרה תחת &quot;צור קשר&quot;.
                </p>
              )}
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
                      <TableHead>סוג</TableHead>
                      <TableHead>כותרת</TableHead>
                      <TableHead>מחירון</TableHead>
                      <TableHead>תפוגה</TableHead>
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
                        <TableCell className="text-xs">
                          {pg.pageType === 'contact' ? (
                            <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900 dark:bg-sky-950 dark:text-sky-100">
                              צור קשר
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                              מכירות
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{pg.pageTitle || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pg.priceListId || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {(() => {
                            const vt = pg.validTo ? String(pg.validTo).slice(0, 10) : '';
                            if (!vt) return <span className="text-muted-foreground">—</span>;
                            const expired = new Date(vt) < new Date(new Date().toISOString().slice(0, 10));
                            return expired
                              ? <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">פג תוקף {vt}</span>
                              : <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">פעיל עד {vt}</span>;
                          })()}
                        </TableCell>
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
