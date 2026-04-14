import React from 'react';
import { ArchiveRestore } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Button } from '../components/ui/button.jsx';

const TOKEN_KEY = 'opal_admin_token';

const TAB_CONFIG = [
  { key: 'products', label: 'מוצרים' },
  { key: 'vendors', label: 'ספקים' },
  { key: 'organizations', label: 'ארגונים' },
  { key: 'agents', label: 'סוכנים' },
  { key: 'personalContacts', label: 'פניות - פרטי' },
  { key: 'orgContacts', label: 'פניות - ארגון' },
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
};

function labelForColumn(key) {
  return HEADER_LABELS[key] || key;
}

export default function ArchiveDashboard() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [data, setData] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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

  return (
    <AdminPageShell>
      <div className="space-y-4" dir="rtl">
        <h1 className="text-2xl font-bold">ארכיון</h1>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Tabs defaultValue="products">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {TAB_CONFIG.map((tab) => <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>)}
          </TabsList>
          {TAB_CONFIG.map((tab) => {
            const rows = Array.isArray(data?.[tab.key]) ? data[tab.key] : [];
            const columns = rows.length ? Object.keys(rows[0]).filter((k) => !['_id', 'id', 'productLinks', 'products', 'bankDetails', 'contactPerson', 'accounting', 'additionalContact'].includes(k)) : [];
            return (
              <TabsContent key={tab.key} value={tab.key}>
                <Card>
                  <CardHeader>
                    <CardTitle>{tab.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.slice(0, 5).map((c) => <TableHead key={c}>{labelForColumn(c)}</TableHead>)}
                          <TableHead>פעולה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            {columns.slice(0, 5).map((c) => <TableCell key={`${row.id}-${c}`}>{String(row[c] ?? '')}</TableCell>)}
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => restore(tab.key, row.id)} disabled={loading}>
                                <ArchiveRestore className="size-4 me-1" />
                                שחזר
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!rows.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">אין רשומות בארכיון</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AdminPageShell>
  );
}
