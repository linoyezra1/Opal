import React from 'react';
import { Archive, ArchiveRestore, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Button } from '../components/ui/button.jsx';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../components/ui/empty.jsx';
import UnifiedFilterShell from '../components/admin/UnifiedFilterShell.jsx';
import { fmtDateTime } from '../utils/dateUtils.js';

const TOKEN_KEY = 'opal_admin_token';

const TAB_CONFIG = [
  { key: 'subscribers', label: 'עסקאות / מנויים' },
  { key: 'products', label: 'מוצרים' },
  { key: 'vendors', label: 'ספקים' },
  { key: 'organizations', label: 'ארגונים' },
  { key: 'agents', label: 'סוכנים' },
  { key: 'personalContacts', label: 'פניות - פרטי' },
  { key: 'priceLists', label: 'מחירונים' },
  { key: 'landingPages', label: 'דפי נחיתה' },
];

/** עמודות קבועות לפי טאב (שמאל → ימין ב-RTL = סדר המערך) */
const TAB_COLUMN_ORDER = {
  personalContacts: ['name', 'phone', 'email', 'message', 'notes'],
  products: ['productName', 'sku', 'providerId', 'providerCost', 'retailPrice'],
  priceLists: ['listName', 'orgName', 'createdAt', 'updatedAt'],
};

const HIDDEN_COLUMN_KEYS = new Set([
  '_id',
  'id',
  'productLinks',
  'products',
  'bankDetails',
  'contactPerson',
  'accounting',
  'additionalContact',
  'provider',
  'isActive',
]);

const HEADER_LABELS = {
  id: 'מזהה',
  orderId: 'מספר הזמנה',
  transactionId: 'מספר הזמנה',
  customerName: 'שם לקוח',
  fullName: 'שם לקוח',
  name: 'שם',
  phoneNumber: 'טלפון',
  phone: 'טלפון',
  email: 'אימייל',
  message: 'הודעה',
  retailPrice: 'מחיר מכירה',
  providerCost: 'עלות ספק',
  providerId: 'ספק',
  vendorName: 'ספק',
  listName: 'שם מחירון',
  orgName: 'ארגון',
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
  notes: 'הערת מערכת',
  source: 'מקור',
  leadStatus: 'סטטוס ליד',
  requestType: 'סוג בקשה',
  sku: 'קוד מוצר',
  isActive: 'פעיל',
  cardcomRecurringId: 'מזהה הוראת קבע',
  cardcomAccountId: 'מזהה חשבון קארדקום',
  cancellationDate: 'תאריך ביטול',
  firstChargeDate: 'תאריך חיוב ראשון',
  archivedAt: 'תאריך העברה לארכיון',
  subscriptionStatus: 'סטטוס מנוי',
  paymentStatus: 'סטטוס תשלום',
  idNum: 'ת.ז/ח.פ',
  address: 'כתובת',
  baseDescription: 'תיאור',
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
}

function resolveArchiveCellValue(row, columnKey) {
  if (columnKey === 'providerId') {
    return String(row.provider?.vendorName || row.vendorName || row[columnKey] || '');
  }
  return row[columnKey];
}

function formatArchiveCell(columnKey, value, row) {
  const resolved = columnKey === 'providerId' ? resolveArchiveCellValue(row, columnKey) : value;
  const k = String(columnKey || '');
  if (!(/At$/i.test(k) || /Date$/i.test(k) || k === 'date')) {
    return String(resolved ?? '');
  }
  const s = String(resolved ?? '').trim();
  if (!s) return '';
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  return fmtDateTime(s);
}

function columnsForTab(tabKey, rows) {
  const fixed = TAB_COLUMN_ORDER[tabKey];
  if (fixed?.length) {
    return fixed.filter((c) => rows.some((r) => r && c in r));
  }
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]).filter((k) => !HIDDEN_COLUMN_KEYS.has(k));
  const preferredOrder = ['companyName', 'fullName', 'organizationName', 'email', 'phone', 'notes'];
  return [...keys].sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
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
      next[tab.key] = false;
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

        <UnifiedFilterShell
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="חיפוש בארכיון..."
          className="max-w-2xl"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {TAB_CONFIG.map((tab) => {
            const rowsAll = Array.isArray(data?.[tab.key]) ? data[tab.key] : [];
            const query = String(searchQuery || '').trim().toLowerCase();
            const rows = !query
              ? rowsAll
              : rowsAll.filter((row) =>
                  Object.values(row || {}).some((v) => String(v ?? '').toLowerCase().includes(query))
                );
            const canRestore = true;
            const displayColumns = columnsForTab(tab.key, rows);
            const visibleColumns =
              TAB_COLUMN_ORDER[tab.key]?.length ? displayColumns : displayColumns.slice(0, 5);

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
                              {visibleColumns.map((c) => (
                                <TableHead key={c}>{labelForColumn(c)}</TableHead>
                              ))}
                              <TableHead>פעולה</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.id}>
                                {visibleColumns.map((c) => (
                                  <TableCell key={`${row.id}-${c}`}>
                                    {formatArchiveCell(c, resolveArchiveCellValue(row, c), row)}
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => restore(tab.key, row.id)}
                                    disabled={loading || !canRestore}
                                  >
                                    <ArchiveRestore className="size-4 me-1" />
                                    שחזר
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
