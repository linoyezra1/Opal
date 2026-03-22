import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Badge } from '../components/ui/badge.jsx';

const TOKEN_KEY = 'opal_admin_token';

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

export default function AdminControlPanel() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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
      setData(j);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [token]);

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <p className="text-foreground">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-primary underline">
          מעבר לכניסת מנהל
        </Link>
      </div>
    );
  }

  const abandoned = data?.abandonedCarts || [];
  const arrears = data?.paymentArrears || [];
  const privateLeads = data?.privateLeads || [];
  const corporateLeads = data?.corporateLeads || [];
  const registered = data?.registeredOrganizations || [];

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="size-7 text-primary" />
              לוח בקרה ראשי
            </h1>
            <p className="text-muted-foreground">עגלות נטושות, תשלומים, פניות וארגונים רשומים</p>
          </div>
          <Button type="button" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'טוען...' : 'רענון'}
          </Button>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>עגלות נטושות</CardTitle>
              <CardDescription>משתמשים שהתחילו מילוי טופס ולא השלמו (מעקב מהשרת)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-80">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">סשן</TableHead>
                      <TableHead>עדכון</TableHead>
                      <TableHead>תקציר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abandoned.map((row) => {
                      const snap = row.formSnapshot || {};
                      const hint = [snap.fullName, snap.phone, snap.email].filter(Boolean).join(' · ') || '—';
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs max-w-[100px] truncate">{row.sessionKey}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {row.updatedAt ? new Date(row.updatedAt).toLocaleString('he-IL') : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{hint}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!abandoned.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          אין טיוטות פתוחות
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>פיגור תשלום / תשלום לא הושלם</CardTitle>
              <CardDescription>עסקאות במצב pending או כשלון תשלום</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-80">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>הזמנה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>שם</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrears.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.transactionId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{d.paymentStatus}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(d.payerAmount)}</TableCell>
                        <TableCell>{d.formState?.fullName || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!arrears.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          אין רשומות
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>צור קשר — פרטיים</CardTitle>
              <CardDescription>פניות מאתר</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-80">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>הודעה</TableHead>
                      <TableHead>תאריך</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {privateLeads.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell dir="ltr" className="text-start">
                          {l.phone}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{l.message}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!privateLeads.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          אין פניות
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>צור קשר — חברות (B2B)</CardTitle>
              <CardDescription>פניות ארגוניות</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-80">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ארגון</TableHead>
                      <TableHead>איש קשר</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>תאריך</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corporateLeads.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.organizationName}</TableCell>
                        <TableCell>{l.contactName}</TableCell>
                        <TableCell dir="ltr" className="text-start">
                          {l.phone}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!corporateLeads.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          אין פניות
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ארגונים רשומים (מחירונים)</CardTitle>
            <CardDescription>
              רשומות ממסך &quot;מחירוני ארגונים&quot;. מזהה לדף נחיתה:{' '}
              <code className="rounded bg-muted px-1 text-xs">pricingId</code> ב־API{' '}
              <code className="rounded bg-muted px-1 text-xs">/api/pricing-context?pricingId=...</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[120px]">מזהה</TableHead>
                    <TableHead>ארגון</TableHead>
                    <TableHead>שם מחירון</TableHead>
                    <TableHead>שורות מחיר</TableHead>
                    <TableHead>נוצר</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs break-all max-w-[120px]">{r.id}</TableCell>
                      <TableCell>{r.organizationName}</TableCell>
                      <TableCell>{r.pricingListName}</TableCell>
                      <TableCell className="text-xs">
                        {(r.relatedProducts || []).length ? (
                          <ul className="space-y-1 list-none p-0 m-0">
                            {r.relatedProducts.map((line, i) => (
                              <li key={i}>
                                {line.product?.name || line.productId}: קמעוני {formatCurrency(line.retailPrice)} · ספק{' '}
                                {formatCurrency(line.vendorCost)} · רווח {formatCurrency(line.profit)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!registered.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        אין ארגונים רשומים — הגדירו מחירון במסך מחירוני ארגונים.
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
