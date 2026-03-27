import React from 'react';
import { Phone, RefreshCw, Search, MessageSquare, ShoppingCart, Mail, ExternalLink } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Badge } from '../components/ui/badge.jsx';
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
import { cn } from '../lib/cn.js';

const TOKEN_KEY = 'opal_admin_token';

export default function ContactManagement() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [privateLeads, setPrivateLeads] = React.useState([]);
  const [corporateLeads, setCorporateLeads] = React.useState([]);
  const [savingKey, setSavingKey] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [editingLead, setEditingLead] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState('חדש');
  const [editNotes, setEditNotes] = React.useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/control-panel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינה נכשלה');
      setPrivateLeads(Array.isArray(j.privateLeads) ? j.privateLeads : []);
      setCorporateLeads(Array.isArray(j.corporateLeads) ? j.corporateLeads : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [token]);

  async function updateLead(kind, leadId, patch) {
    if (!leadId) return;
    setSavingKey(`${kind}:${leadId}`);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/leads/${kind}/${encodeURIComponent(leadId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      if (kind === 'private') {
        setPrivateLeads((prev) => prev.map((x) => (x.id === leadId ? { ...x, ...patch } : x)));
      } else {
        setCorporateLeads((prev) => prev.map((x) => (x.id === leadId ? { ...x, ...patch } : x)));
      }
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSavingKey('');
    }
  }

  const allLeads = React.useMemo(() => {
    const privateRows = privateLeads.map((l) => ({
      id: l.id,
      kind: 'private',
      fullName: l.name || '—',
      phone: l.phone || '',
      email: l.email || '',
      createdAt: l.createdAt,
      leadStatus: l.leadStatus || 'חדש',
      adminNotes: l.adminNotes || '',
      message: l.message || '',
      category: l.source === 'abandoned_checkout' ? 'abandoned_checkout' : 'general',
      categoryLabel: l.source === 'abandoned_checkout' ? l.category || 'לא המשיכו לתשלום' : 'כללי',
    }));

    const corporateRows = corporateLeads.map((l) => ({
      id: l.id,
      kind: 'corporate',
      fullName: l.contactName || l.contactPerson?.name || l.organizationName || l.company?.companyName || '—',
      phone: l.phone || l.contactPerson?.phone || '',
      email: l.email || l.contactPerson?.email || '',
      createdAt: l.createdAt,
      leadStatus: l.leadStatus || 'חדש',
      adminNotes: l.adminNotes || '',
      message: l.notes || '',
      category: 'general',
      categoryLabel: 'כללי',
    }));

    return [...privateRows, ...corporateRows].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [privateLeads, corporateLeads]);

  const filteredLeads = React.useMemo(() => {
    return allLeads.filter((lead) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(lead.fullName || '').toLowerCase().includes(q) ||
        String(lead.phone || '').toLowerCase().includes(q) ||
        String(lead.email || '').toLowerCase().includes(q);
      const matchesCategory = filterCategory === 'all' || lead.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || lead.leadStatus === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allLeads, searchQuery, filterCategory, filterStatus]);

  const stats = React.useMemo(
    () => ({
      total: allLeads.length,
      newCount: allLeads.filter((l) => l.leadStatus === 'חדש').length,
      inProgress: allLeads.filter((l) => l.leadStatus === 'בטיפול').length,
      handled: allLeads.filter((l) => l.leadStatus === 'טופל').length,
    }),
    [allLeads]
  );

  function getStatusClasses(status) {
    if (status === 'חדש') return 'bg-red-50 border-red-200 text-red-700';
    if (status === 'בטיפול') return 'bg-amber-50 border-amber-200 text-amber-700';
    if (status === 'טופל') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    return 'bg-muted border-border text-foreground';
  }

  function getWhatsAppLink(phone) {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const israelPhone = cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
    return `https://wa.me/${israelPhone}`;
  }

  function openEdit(lead) {
    setEditingLead(lead);
    setEditStatus(lead.leadStatus || 'חדש');
    setEditNotes(lead.adminNotes || '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingLead?.id) return;
    await updateLead(editingLead.kind, editingLead.id, { leadStatus: editStatus, adminNotes: editNotes });
    setEditOpen(false);
    setEditingLead(null);
  }

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>עריכת רשומת צור קשר</DialogTitle>
              <DialogDescription>עדכון סטטוס והערות פנימיות</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">שם מלא</p>
                <p className="font-medium">{editingLead?.fullName || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">סטטוס</p>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="חדש">חדש</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="טופל">טופל</option>
                </select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">הערות אדמין</p>
                <Textarea rows={5} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="הערות פנימיות..." />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                ביטול
              </Button>
              <Button type="button" onClick={saveEdit} disabled={savingKey === `${editingLead?.kind}:${editingLead?.id}`}>
                שמירה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ניהול צור קשר (Contact Management)</h1>
            <p className="text-muted-foreground">כל הלידים מהאתר ומדפי הנחיתה במקום אחד</p>
          </div>
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            רענון
          </Button>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="size-4" />
              צור קשר — ניהול לידים
            </CardTitle>
            <CardDescription>ניהול לידים מפניות כלליות ומלקוחות שלא המשיכו לתשלום</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="bg-background">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">סה״כ</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                  <div className="text-sm text-red-700 mb-1">חדש</div>
                  <div className="text-2xl font-bold text-red-700">{stats.newCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="text-sm text-amber-700 mb-1">בטיפול</div>
                  <div className="text-2xl font-bold text-amber-700">{stats.inProgress}</div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="text-sm text-emerald-700 mb-1">טופל</div>
                  <div className="text-2xl font-bold text-emerald-700">{stats.handled}</div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-xl border p-3 md:p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חיפוש לפי שם, טלפון או אימייל"
                    className="ps-10"
                  />
                </div>
                <select
                  className="flex h-10 w-full lg:w-56 rounded-md border border-input bg-background px-3 text-sm"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">כל הקטגוריות</option>
                  <option value="general">כללי</option>
                  <option value="abandoned_checkout">לא המשיכו לתשלום</option>
                </select>
                <select
                  className="flex h-10 w-full lg:w-44 rounded-md border border-input bg-background px-3 text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="חדש">חדש</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="טופל">טופל</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('all');
                    setFilterStatus('all');
                  }}
                >
                  איפוס
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם מלא</TableHead>
                    <TableHead>טלפון / אימייל</TableHead>
                    <TableHead>קטגוריה</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>הערות</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead className="w-[220px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={`${lead.kind}:${lead.id}`}>
                      <TableCell className="font-medium">{lead.fullName || '—'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div dir="ltr" className="text-sm">{lead.phone || '—'}</div>
                          <div dir="ltr" className="text-xs text-muted-foreground">{lead.email || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('gap-1', lead.category === 'abandoned_checkout' ? 'text-amber-700 border-amber-300 bg-amber-50' : '')}>
                          {lead.category === 'abandoned_checkout' ? <ShoppingCart className="size-3" /> : <MessageSquare className="size-3" />}
                          {lead.categoryLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          className={cn('flex h-9 min-w-[120px] rounded-md border px-2 text-sm', getStatusClasses(lead.leadStatus))}
                          value={lead.leadStatus}
                          onChange={(e) => updateLead(lead.kind, lead.id, { leadStatus: e.target.value })}
                          disabled={savingKey === `${lead.kind}:${lead.id}`}
                        >
                          <option value="חדש">חדש</option>
                          <option value="בטיפול">בטיפול</option>
                          <option value="טופל">טופל</option>
                        </select>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                        {lead.adminNotes || lead.message || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleString('he-IL') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" type="button" onClick={() => openEdit(lead)} title="עריכה">
                            <ExternalLink className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            title="שליחת מייל"
                            onClick={() => {
                              if (!lead.email) return;
                              window.open(`mailto:${lead.email}`, '_blank', 'noopener,noreferrer');
                            }}
                            disabled={!lead.email}
                          >
                            <Mail className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            title="וואטסאפ"
                            onClick={() => {
                              if (!lead.phone) return;
                              window.open(getWhatsAppLink(lead.phone), '_blank', 'noopener,noreferrer');
                            }}
                            disabled={!lead.phone}
                          >
                            <Phone className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredLeads.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                        אין רשומות להצגה
                      </TableCell>
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
