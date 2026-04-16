import React from 'react';
import { Archive, ArchiveRestore, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../components/ui/empty.jsx';

const TOKEN_KEY = 'opal_admin_token';

const TAB_CONFIG = [
  { key: 'subscribers', label: 'לקוחות / מנויים' },
  { key: 'products', label: 'מוצרים' },
  { key: 'vendors', label: 'ספקים' },
  { key: 'organizations', label: 'ארגונים' },
  { key: 'agents', label: 'סוכנים' },
  { key: 'contactRequests', label: 'פניות צור קשר' },
  { key: 'personalContacts', label: 'פניות - פרטי' },
  { key: 'orgContacts', label: 'פניות - ארגון' },
  { key: 'priceLists', label: 'מחירונים' },
  { key: 'landingPages', label: 'דפי נחיתה' },
  { key: 'pricingEntries', label: 'רשומות תמחור' },
];

const HEADER_LABELS = {
  id: 'מזהה',
  orderId: 'מספר הזמנה',
  transactionId: 'מספר הזמנה',
  customerName: 'שם לקוח',
  fullName: 'שם לקוח',
  phoneNumber: 'טלפון',
  phone: 'טלפון',
  email: 'אימייל',
  retailPrice: 'מחיר מכירה',
  providerCost: 'עלות ספק',
  providerId: 'ספק',
  vendorName: 'ספק',
  individualsCount: 'כמות מנויים',
  activeEmployees: 'כמות עובדים',
  amount: 'סכום',
  debt: 'חוב',
  memberPrice: 'מחיר לחבר',
  collectionStatus: 'סטטוס גבייה',
  productName: 'שם מוצר',
  agentCommission: 'עמלת סוכן',
  kind: 'סוג פנייה',
  organizationId: 'מזהה ארגון',
  status: 'סטטוס',
  cardcomStatus: 'סטטוס סליקה',
  createdAt: 'תאריך',
  updatedAt: 'תאריך',
  date: 'תאריך',
  isHandled: 'סטטוס טיפול',
  agentName: 'סוכן',
  orgName: 'ארגון',
  organizationName: 'ארגון',
  companyName: 'שם חברה',
  companyId: 'ח.פ / מזהה חברה',
  officialAddress: 'כתובת רשמית',
  companyEmail: 'אימייל חברה',
  fieldOfActivity: 'תחום פעילות',
  employeesCount: 'מספר עובדים',
  billingType: 'סוג חיוב',
  billingMethod: 'שיטת חיוב',
  monthlyPricePerMember: 'מחיר חודשי לחבר',
  contactEmail: 'אימייל ליצירת קשר',
  contactPhone: 'טלפון ליצירת קשר',
  notes: 'הערות',
  name: 'שם',
  message: 'הודעה',
  source: 'מקור',
  leadStatus: 'סטטוס ליד',
  requestType: 'סוג בקשה',
  sku: 'קוד מוצר',
  providerCost: 'עלות ספק',
  isActive: 'פעיל',
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
}

export default function ArchiveDashboard() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [data, setData] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [openSections, setOpenSections] = React.useState({});

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/archive`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינת ארכיון נכשלה');
      setData(j);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const next = {};
    for (const tab of TAB_CONFIG) {
      next[tab.key] = true;
    }
    setOpenSections(next);
  }, []);

  async function restore(entity, id) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/archive/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שחזור נכשל');
      await load();
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const totalArchived = React.useMemo(
    () => TAB_CONFIG.reduce((sum, tab) => sum + (Array.isArray(data?.[tab.key]) ? data[tab.key].length : 0), 0),
    [data]
  );

  return (
    <AdminPageShell>
      <div className="space-y-5 text-right" dir="rtl">
        <h1 className="text-2xl font-bold">ארכיון</h1>
        <Card className="bg-muted/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                <Archive className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalArchived}</p>
                <p className="text-sm text-muted-foreground">סה"כ רשומות בארכיון</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="max-w-md relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="ps-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש בארכיון..."
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {TAB_CONFIG.map((tab) => {
            const rowsAll = Array.isArray(data?.[tab.key]) ? data[tab.key] : [];
            const query = String(searchQuery || '').trim().toLowerCase();
            const rows = !query
              ? rowsAll
              : rowsAll.filter((row) => Object.values(row || {}).some((v) => String(v ?? '').toLowerCase().includes(query)));
            const canRestore = tab.key !== 'contactRequests';
            const columns = rows.length ? Object.keys(rows[0]).filter((k) => !['_id', 'id', 'productLinks', 'products', 'bankDetails', 'contactPerson', 'accounting', 'additionalContact'].includes(k)) : [];
            const preferredOrder = ['companyName', 'fullName', 'organizationName', 'email', 'phone', 'notes'];
            const displayColumns = [...columns].sort((a, b) => {
              const ia = preferredOrder.indexOf(a);
              const ib = preferredOrder.indexOf(b);
              if (ia === -1 && ib === -1) return 0;
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });
            return (
              <Card key={tab.key}>
                <button
                  type="button"
                  className="w-full text-right"
                  onClick={() => toggleSection(tab.key)}
                  aria-expanded={!!openSections[tab.key]}
                >
                  <CardHeader className="hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{tab.label}</CardTitle>
                        <CardDescription>{rows.length} רשומות</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            rows.length > 0 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {rows.length}
                        </span>
                        {openSections[tab.key] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </button>
                {openSections[tab.key] ? (
                  <CardContent className="pt-0">
                    {!rows.length ? (
                      <div className="rounded-md border py-10">
                        <Empty>
                          <EmptyMedia variant="icon">
                            <Archive className="size-6" />
                          </EmptyMedia>
                          <EmptyTitle>אין רשומות להצגה</EmptyTitle>
                          <EmptyDescription>נסה/י לשנות חיפוש או לעבור לקטגוריה אחרת.</EmptyDescription>
                        </Empty>
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {displayColumns.slice(0, 5).map((c) => <TableHead key={c}>{labelForColumn(c)}</TableHead>)}
                              <TableHead>פעולה</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.id}>
                                {displayColumns.slice(0, 5).map((c) => <TableCell key={`${row.id}-${c}`}>{String(row[c] ?? '')}</TableCell>)}
                                <TableCell>
                                  <Button size="sm" variant="outline" onClick={() => restore(tab.key, row.id)} disabled={loading || !canRestore}>
                                    <ArchiveRestore className="size-4 me-1" />
                                    {canRestore ? 'שחזר' : '—'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    </AdminPageShell>
  );
}
