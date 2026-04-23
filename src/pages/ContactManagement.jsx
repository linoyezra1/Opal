import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Phone, RefreshCw, MessageSquare, ShoppingCart, Pencil, Archive,
  Clock, Building2, User, ChevronDown, ChevronUp,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { cn } from '../lib/cn.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';

const TOKEN_KEY = 'opal_admin_token';

const CATEGORY_BADGE = {
  abandoned_checkout: { icon: ShoppingCart, cls: 'text-amber-700 border-amber-300 bg-amber-50' },
  expired_product:    { icon: Clock,         cls: 'text-red-700 border-red-300 bg-red-50' },
  landing:            { icon: MessageSquare, cls: 'text-primary border-primary/30 bg-primary/5' },
  corporate:          { icon: Building2,     cls: 'text-violet-700 border-violet-300 bg-violet-50' },
  general:            { icon: MessageSquare, cls: '' },
};

export default function ContactManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [privateLeads, setPrivateLeads] = React.useState([]);
  const [corporateLeads, setCorporateLeads] = React.useState([]);
  const [savingKey, setSavingKey] = React.useState('');

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterKind, setFilterKind] = React.useState('all');   // 'all' | 'private' | 'corporate'
  const [filterMonth, setFilterMonth] = React.useState('');
  const [filterDateFrom, setFilterDateFrom] = React.useState('');
  const [filterDateTo, setFilterDateTo] = React.useState('');

  // ── Edit dialog ───────────────────────────────────────────────────────────────
  const [editingLead, setEditingLead] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState('חדש');
  const [editNotes, setEditNotes] = React.useState('');

  // ── Expandable message rows ───────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = React.useState(new Set());

  // ── Data loading ──────────────────────────────────────────────────────────────
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

      const contactRows = Array.isArray(j?.drilldowns?.contactTasks) ? j.drilldowns.contactTasks : [];
      const abandonedRows = Array.isArray(j?.drilldowns?.abandonedCarts) ? j.drilldowns.abandonedCarts : [];

      setPrivateLeads([
        ...contactRows
          .filter((x) => x.kind === 'private')
          .map((x) => ({
            id: x.id,
            name: x.fullName,
            phone: x.phone,
            email: x.email,
            message: x.message || '',
            source: x.source || '',
            landingSlug: x.landingSlug || '',
            landingPageTitle: x.landingPageTitle || '',
            createdAt: x.createdAt,
            leadStatus: x.leadStatus || 'חדש',
            adminNotes: x.adminNotes || '',
            isHandled: !!x.isHandled,
          })),
        ...abandonedRows.map((x) => ({
          id: x.id,
          name: x.name,
          phone: x.phone,
          email: x.email,
          message: x.message || '',
          source: 'abandoned_checkout',
          landingSlug: '',
          landingPageTitle: '',
          createdAt: x.updatedAt,
          leadStatus: x.leadStatus || 'חדש',
          adminNotes: x.adminNotes || '',
          isHandled: !!x.isHandled,
        })),
      ]);

      setCorporateLeads(
        contactRows
          .filter((x) => x.kind === 'corporate')
          .map((x) => ({
            id: x.id,
            contactName: x.fullName,
            organizationName: x.organizationName || x.company?.companyName || '',
            phone: x.phone,
            email: x.email,
            message: x.notes || x.message || '',
            createdAt: x.createdAt,
            leadStatus: x.leadStatus || 'חדש',
            adminNotes: x.adminNotes || '',
            isHandled: !!x.isHandled,
          }))
      );
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [token]);

  // Sync search from URL param
  React.useEffect(() => {
    const search = String(searchParams.get('search') || '').trim();
    if (search && search !== searchQuery) setSearchQuery(search);
  }, [searchParams, searchQuery]);

  // Auto-open edit from URL param
  React.useEffect(() => {
    const editId = String(searchParams.get('editId') || '').trim();
    const editKind = String(searchParams.get('editKind') || '').trim();
    if (!editId || !editKind) return;
    const merged = [
      ...privateLeads.map((x) => ({
        id: x.id,
        kind: x.source === 'abandoned_checkout' ? 'abandoned' : 'private',
        fullName: x.name || '—',
        message: x.message || '',
        leadStatus: x.leadStatus || 'חדש',
        adminNotes: x.adminNotes || '',
      })),
      ...corporateLeads.map((x) => ({
        id: x.id,
        kind: 'corporate',
        fullName: x.contactName || '—',
        message: x.message || '',
        leadStatus: x.leadStatus || 'חדש',
        adminNotes: x.adminNotes || '',
      })),
    ];
    const row = merged.find((x) => x.id === editId && x.kind === editKind);
    if (!row) return;
    openEdit(row);
    const next = new URLSearchParams(searchParams);
    next.delete('editId');
    next.delete('editKind');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, privateLeads, corporateLeads]);

  // ── API mutation ──────────────────────────────────────────────────────────────
  async function updateLead(kind, leadId, patch) {
    if (!leadId) return;
    setSavingKey(`${kind}:${leadId}`);
    setError('');
    try {
      const endpointKind = kind === 'corporate' ? 'corporate' : kind === 'private' ? 'private' : 'abandoned';
      const res = await fetch(
        `${API_BASE}/api/admin/contact-hub/${endpointKind}/${encodeURIComponent(leadId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(patch),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      const setter = kind === 'corporate' ? setCorporateLeads : setPrivateLeads;
      setter((prev) =>
        patch.isActive === false
          ? prev.filter((x) => x.id !== leadId)
          : prev.map((x) => (x.id === leadId ? { ...x, ...patch } : x))
      );
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSavingKey('');
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const allLeads = React.useMemo(() => {
    const privateRows = privateLeads.map((l) => {
      let category = 'general';
      let categoryLabel = 'כללי';
      if (l.source === 'abandoned_checkout') {
        category = 'abandoned_checkout';
        categoryLabel = 'לא המשיכו לתשלום';
      } else if (String(l.message || '').includes('פג תוקף')) {
        category = 'expired_product';
        categoryLabel = 'מוצר שהסתיים';
      } else if (l.source === 'landing_contact' && String(l.landingSlug || '').trim()) {
        category = 'landing';
        const title = String(l.landingPageTitle || '').trim();
        categoryLabel = title || `דף נחיתה: ${l.landingSlug}`;
      }
      return {
        id: l.id,
        kind: l.source === 'abandoned_checkout' ? 'abandoned' : 'private',
        kindGroup: 'private',
        fullName: l.name || '—',
        organizationName: '',
        phone: l.phone || '',
        email: l.email || '',
        createdAt: l.createdAt,
        leadStatus: l.leadStatus || 'חדש',
        adminNotes: l.adminNotes || '',
        message: l.message || '',
        category,
        categoryLabel,
        isHandled: !!l.isHandled,
      };
    });

    const corporateRows = corporateLeads.map((l) => ({
      id: l.id,
      kind: 'corporate',
      kindGroup: 'corporate',
      fullName: l.contactName || '—',
      organizationName: l.organizationName || '',
      phone: l.phone || '',
      email: l.email || '',
      createdAt: l.createdAt,
      leadStatus: l.leadStatus || 'חדש',
      adminNotes: l.adminNotes || '',
      message: l.message || '',
      category: 'corporate',
      categoryLabel: l.organizationName ? `ארגוני: ${l.organizationName}` : 'ארגוני',
      isHandled: !!l.isHandled,
    }));

    return [...privateRows, ...corporateRows].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [privateLeads, corporateLeads]);

  // Derive month options from actual data
  const availableMonths = React.useMemo(() => {
    const seen = new Set();
    const months = [];
    allLeads.forEach((l) => {
      if (!l.createdAt) return;
      const d = new Date(l.createdAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        months.push({ value: key, label: d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) });
      }
    });
    return months.sort((a, b) => b.value.localeCompare(a.value));
  }, [allLeads]);

  const filteredLeads = React.useMemo(() => {
    return allLeads.filter((lead) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(lead.fullName || '').toLowerCase().includes(q) ||
        String(lead.phone || '').toLowerCase().includes(q) ||
        String(lead.email || '').toLowerCase().includes(q) ||
        String(lead.message || '').toLowerCase().includes(q) ||
        String(lead.organizationName || '').toLowerCase().includes(q) ||
        String(lead.categoryLabel || '').toLowerCase().includes(q);

      const matchesCategory = filterCategory === 'all' || lead.category === filterCategory;
      const matchesStatus   = filterStatus === 'all'   || lead.leadStatus === filterStatus;
      const matchesKind     = filterKind === 'all'     || lead.kindGroup === filterKind;

      let matchesDate = true;
      if (lead.createdAt && (filterMonth || filterDateFrom || filterDateTo)) {
        const d = new Date(lead.createdAt);
        if (filterMonth) {
          const [yr, mo] = filterMonth.split('-').map(Number);
          matchesDate = d.getFullYear() === yr && d.getMonth() + 1 === mo;
        } else {
          if (filterDateFrom) {
            const from = new Date(filterDateFrom);
            from.setHours(0, 0, 0, 0);
            if (d < from) matchesDate = false;
          }
          if (filterDateTo && matchesDate) {
            const to = new Date(filterDateTo);
            to.setHours(23, 59, 59, 999);
            if (d > to) matchesDate = false;
          }
        }
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesKind && matchesDate;
    });
  }, [allLeads, searchQuery, filterCategory, filterStatus, filterKind, filterMonth, filterDateFrom, filterDateTo]);

  const stats = React.useMemo(() => ({
    total:      allLeads.length,
    newCount:   allLeads.filter((l) => l.leadStatus === 'חדש').length,
    inProgress: allLeads.filter((l) => l.leadStatus === 'בטיפול').length,
    handled:    allLeads.filter((l) => l.leadStatus === 'טופל').length,
  }), [allLeads]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function getStatusClasses(status) {
    if (status === 'חדש')    return 'bg-red-50 border-red-200 text-red-700';
    if (status === 'בטיפול') return 'bg-amber-50 border-amber-200 text-amber-700';
    if (status === 'טופל')   return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    return 'bg-muted border-border text-foreground';
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

  function toggleRow(id) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearAllFilters() {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterMonth('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const privateCount   = allLeads.filter((l) => l.kindGroup === 'private').length;
  const corporateCount = allLeads.filter((l) => l.kindGroup === 'corporate').length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
        <div className="space-y-6">

          {/* ── Edit Dialog ── */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>עריכת ליד — {editingLead?.fullName || '—'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {editingLead?.message ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">הודעת הלקוח</p>
                    <p className="text-sm bg-muted rounded-md px-3 py-2 leading-relaxed">{editingLead.message}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">סטטוס</p>
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">הערות אדמין</p>
                  <Textarea rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="הערות פנימיות..." />
                </div>
              </div>
              <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>ביטול</Button>
                <Button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingKey === `${editingLead?.kind}:${editingLead?.id}`}
                >
                  שמירה
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Page header ── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ניהול צור קשר</h1>
              <p className="text-sm text-muted-foreground">כל הלידים מהאתר, דפי הנחיתה וטפסי ההצטרפות הארגוניים</p>
            </div>
            <Button onClick={load} disabled={loading} variant="outline">
              <RefreshCw className={cn('size-4 me-2', loading && 'animate-spin')} />
              רענון
            </Button>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'סה״כ לידים',  value: stats.total,      bg: 'bg-background border-border',          text: 'text-foreground' },
              { label: 'חדש',          value: stats.newCount,   bg: 'bg-red-50 border-red-200',             text: 'text-red-700' },
              { label: 'בטיפול',       value: stats.inProgress, bg: 'bg-amber-50 border-amber-200',         text: 'text-amber-700' },
              { label: 'טופל',         value: stats.handled,    bg: 'bg-emerald-50 border-emerald-200',     text: 'text-emerald-700' },
            ].map((s) => (
              <Card key={s.label} className={s.bg}>
                <CardContent className="p-4">
                  <div className={cn('text-sm mb-1', s.text)}>{s.label}</div>
                  <div className={cn('text-3xl font-bold', s.text)}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Main card ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="size-4" />
                רשימת לידים
              </CardTitle>
              <CardDescription>ניהול ומעקב אחר כל פניות הלקוחות</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Kind toggle tabs */}
              <Tabs value={filterKind} onValueChange={setFilterKind} dir="rtl">
                <TabsList>
                  <TabsTrigger value="all">הכל ({allLeads.length})</TabsTrigger>
                  <TabsTrigger value="private" className="gap-1.5">
                    <User className="size-3.5" />
                    פרטי ({privateCount})
                  </TabsTrigger>
                  <TabsTrigger value="corporate" className="gap-1.5">
                    <Building2 className="size-3.5" />
                    ארגוני ({corporateCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="rounded-xl border p-3 md:p-4">
                <UnifiedFilterShell
                  filters={[
                    {
                      key: 'search', label: 'חיפוש', type: 'text',
                      placeholder: 'שם, טלפון, אימייל, הודעה...',
                    },
                    {
                      key: 'category', label: 'קטגוריה', type: 'select',
                      options: [
                        { value: 'general',            label: 'כללי' },
                        { value: 'landing',            label: 'דף נחיתה' },
                        { value: 'abandoned_checkout', label: 'לא המשיכו לתשלום' },
                        { value: 'expired_product',    label: 'מוצר שהסתיים' },
                        { value: 'corporate',          label: 'ארגוני' },
                      ],
                    },
                    {
                      key: 'status', label: 'סטטוס', type: 'select',
                      options: [
                        { value: 'חדש',    label: 'חדש' },
                        { value: 'בטיפול', label: 'בטיפול' },
                        { value: 'טופל',   label: 'טופל' },
                      ],
                    },
                    {
                      key: 'month', label: 'חודש', type: 'select',
                      options: availableMonths,
                    },
                    { key: 'dateFrom', label: 'מתאריך', type: 'date' },
                    { key: 'dateTo',   label: 'עד תאריך', type: 'date' },
                  ]}
                  values={{
                    search:   searchQuery,
                    category: filterCategory === 'all' ? '' : filterCategory,
                    status:   filterStatus === 'all'   ? '' : filterStatus,
                    month:    filterMonth,
                    dateFrom: filterDateFrom,
                    dateTo:   filterDateTo,
                  }}
                  onChange={(next) => {
                    setSearchQuery(String(next.search   || ''));
                    setFilterCategory(String(next.category || 'all'));
                    setFilterStatus(String(next.status  || 'all'));
                    setFilterMonth(String(next.month    || ''));
                    setFilterDateFrom(String(next.dateFrom || ''));
                    setFilterDateTo(String(next.dateTo  || ''));
                  }}
                  onClear={clearAllFilters}
                  resultsCount={filteredLeads.length}
                  totalCount={allLeads.length}
                  isLoading={loading}
                />
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>שם מלא</TableHead>
                      <TableHead>יצירת קשר</TableHead>
                      <TableHead>קטגוריה</TableHead>
                      <TableHead>הודעה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead className="w-24 text-center">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const isExpanded = expandedRows.has(lead.id);
                      const catCfg = CATEGORY_BADGE[lead.category] || CATEGORY_BADGE.general;
                      const CatIcon = catCfg.icon;
                      return (
                        <React.Fragment key={`${lead.kind}:${lead.id}`}>
                          <TableRow className="hover:bg-muted/30 transition-colors">

                            {/* Name */}
                            <TableCell className="font-medium">
                              <div>{lead.fullName || '—'}</div>
                              {lead.organizationName ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Building2 className="size-3 shrink-0" />
                                  {lead.organizationName}
                                </div>
                              ) : null}
                            </TableCell>

                            {/* Contact */}
                            <TableCell>
                              <div className="space-y-0.5">
                                <div dir="ltr" className="text-sm font-medium">{lead.phone || '—'}</div>
                                <div dir="ltr" className="text-xs text-muted-foreground">{lead.email || '—'}</div>
                              </div>
                            </TableCell>

                            {/* Category badge */}
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('gap-1 max-w-[200px] truncate text-xs', catCfg.cls)}
                              >
                                <CatIcon className="size-3 shrink-0" />
                                <span className="truncate">{lead.categoryLabel}</span>
                              </Badge>
                            </TableCell>

                            {/* Message — expandable */}
                            <TableCell className="max-w-[220px]">
                              {lead.message ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(lead.id)}
                                  className="flex items-start gap-1 text-right w-full group cursor-pointer"
                                >
                                  <span className="text-xs text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                                    {lead.message}
                                  </span>
                                  {isExpanded
                                    ? <ChevronUp className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                                    : <ChevronDown className="size-3 shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  }
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Status select */}
                            <TableCell>
                              {lead.isHandled ? (
                                <Badge className="mb-1 me-1 bg-emerald-600 text-white text-xs">טופל</Badge>
                              ) : null}
                              <select
                                className={cn('flex h-8 min-w-[110px] rounded-md border px-2 text-xs', getStatusClasses(lead.leadStatus))}
                                value={lead.leadStatus}
                                onChange={(e) => updateLead(lead.kind, lead.id, { leadStatus: e.target.value })}
                                disabled={savingKey === `${lead.kind}:${lead.id}`}
                              >
                                <option value="חדש">חדש</option>
                                <option value="בטיפול">בטיפול</option>
                                <option value="טופל">טופל</option>
                              </select>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {lead.createdAt ? new Date(lead.createdAt).toLocaleString('he-IL') : '—'}
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8"
                                      type="button"
                                      onClick={() => openEdit(lead)}
                                      aria-label="עריכה"
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>עריכה</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8 hover:bg-destructive/10"
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm('פעולה זו תעביר את הליד לארכיון')) {
                                          updateLead(lead.kind, lead.id, { isActive: false });
                                        }
                                      }}
                                      aria-label="ארכיון"
                                    >
                                      <Archive className="size-3.5 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>העבר לארכיון</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded message row */}
                          {isExpanded && lead.message ? (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="py-2 px-8">
                                <div className="text-sm text-foreground bg-background rounded-md border px-3 py-2 leading-relaxed">
                                  <span className="text-xs font-semibold text-muted-foreground block mb-1">
                                    הודעה מלאה:
                                  </span>
                                  {lead.message}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })}

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
    </TooltipProvider>
  );
}
