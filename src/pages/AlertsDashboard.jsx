import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';

const TOKEN_KEY = 'opal_admin_token';

const ALERT_DEFS = [
  { key: 'contactTasks', title: 'צור קשר' },
  { key: 'orgPendingApproval', title: 'ארגון ממתין לאישור' },
  { key: 'pendingBeneficiaries', title: 'השלמת טפסים' },
  { key: 'failedPayments', title: 'פיגור תשלום' },
  { key: 'organizationCollectionsDebt', title: 'ארגונים לחיוב' },
];

export default function AlertsDashboard() {
  const [searchParams] = useSearchParams();
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState({ overview: {}, drilldowns: {} });
  const openTab = String(searchParams.get('tab') || '').trim();

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/admin/control-panel`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.success) throw new Error(j.error || 'טעינת התראות נכשלה');
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e.message || 'שגיאה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const rowsFor = (key) => {
    if (key === 'orgPendingApproval') {
      const all = Array.isArray(data?.drilldowns?.contactTasks) ? data.drilldowns.contactTasks : [];
      return all.filter((x) => String(x.kind || '').toLowerCase() === 'corporate');
    }
    return Array.isArray(data?.drilldowns?.[key]) ? data.drilldowns[key] : [];
  };

  return (
    <AdminPageShell>
      <div dir="rtl" className="space-y-4 text-right">
        <h1 className="text-2xl font-bold">התראות</h1>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {loading ? <p className="text-muted-foreground text-sm">טוען…</p> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ALERT_DEFS.map((a) => {
            const rows = rowsFor(a.key);
            const open = openTab === a.key;
            const columns = rows.length
              ? Object.keys(rows[0]).filter((k) => !['id', 'subscriberDealId'].includes(k)).slice(0, 5)
              : [];
            return (
              <Card key={a.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span>{a.title}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {rows.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <details open={open} className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground">הצג פירוט</summary>
                    <div className="mt-3 rounded-md border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns.map((c) => (
                              <TableHead key={`${a.key}-${c}`} className="text-right">{c}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, idx) => (
                            <TableRow key={`${a.key}-${idx}`}>
                              {columns.map((c) => (
                                <TableCell key={`${a.key}-${idx}-${c}`}>{String(r[c] ?? '')}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {!rows.length ? (
                            <TableRow>
                              <TableCell colSpan={Math.max(columns.length, 1)} className="text-center text-muted-foreground">
                                אין רשומות להצגה
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminPageShell>
  );
}
