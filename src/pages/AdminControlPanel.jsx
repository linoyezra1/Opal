import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wallet,
  AlertCircle,
  Users,
  Activity,
  ShoppingCart,
  Phone,
  Building2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { StatsCard } from '../components/admin/stats-card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';

const TOKEN_KEY = 'opal_admin_token';

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

function formatCompact(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
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

  const pendingBeneficiaryCustomers = data?.pendingBeneficiaryCustomers || [];
  const checkoutDrafts = data?.checkoutDrafts || [];
  const arrears = data?.paymentArrears || [];
  const privateLeads = data?.privateLeads || [];
  const corporateLeads = data?.corporateLeads || [];
  const overview = data?.overview;

  const recentActivity = React.useMemo(() => {
    const items = [];
    for (const row of pendingBeneficiaryCustomers) {
      const t = row.createdAt ? new Date(row.createdAt).getTime() : 0;
      items.push({
        id: `pb-${row.id}`,
        type: 'pending_beneficiary',
        label: 'ממתין להשלמת מסמכים',
        detail: [row.fullName, row.phone, row.transactionId].filter(Boolean).join(' · ') || '—',
        at: t,
      });
    }
    for (const row of checkoutDrafts) {
      const t = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
      const snap = row.formSnapshot || {};
      items.push({
        id: `a-${row.id}`,
        type: 'draft',
        label: 'טיוטת צ׳ק-אאוט',
        detail: [snap.fullName, snap.phone].filter(Boolean).join(' · ') || row.sessionKey,
        at: t,
      });
    }
    for (const d of arrears) {
      const t = d.createdAt ? new Date(d.createdAt).getTime() : 0;
      items.push({
        id: `p-${d.id}`,
        type: 'payment',
        label: 'תשלום / סטטוס',
        detail: `${d.transactionId} · ${d.paymentStatus}`,
        at: t,
      });
    }
    for (const l of privateLeads) {
      const t = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      items.push({
        id: `lp-${l.id}`,
        type: 'lead',
        label: 'פנייה פרטית',
        detail: `${l.name} · ${l.phone}`,
        at: t,
      });
    }
    for (const l of corporateLeads) {
      const t = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      items.push({
        id: `lb-${l.id}`,
        type: 'corp',
        label: 'פנייה B2B',
        detail: `${l.organizationName} · ${l.contactName}`,
        at: t,
      });
    }
    return items.filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 16);
  }, [pendingBeneficiaryCustomers, checkoutDrafts, arrears, privateLeads, corporateLeads]);

  const chartData = React.useMemo(() => {
    const s = overview?.chartSeries;
    if (!Array.isArray(s) || !s.length) return [];
    return s.map((d) => ({
      ...d,
      revenueShort: Math.round(Number(d.revenue || 0)),
    }));
  }, [overview]);

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

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPageShell>
        <div className="space-y-6 text-right" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <LayoutDashboard className="size-7 text-primary" />
                לוח בקרה — סקירה כללית
              </h1>
              <p className="text-muted-foreground">מדדים ממסד הנתונים, פעילות אחרונה ופירוט תפעולי</p>
            </div>
            <Button type="button" onClick={load} disabled={loading}>
              <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'טוען...' : 'רענון'}
            </Button>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {/* Overview — נתוני MongoDB אמיתיים */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="סה״כ הכנסות (עסקאות ששולמו)"
              value={overview ? formatCurrency(overview.totalRevenue) : '—'}
              icon={TrendingUp}
              loading={loading && !overview}
            />
            <StatsCard
              title="רווח נקי (מצטבר)"
              value={overview ? formatCurrency(overview.totalNetProfit) : '—'}
              icon={Wallet}
              loading={loading && !overview}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="outline-none rounded-lg">
                  <StatsCard
                    title="עסקאות הושלמו"
                    value={overview ? formatCompact(overview.completedSales) : '—'}
                    icon={Users}
                    loading={loading && !overview}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                מספר עסקאות ללא סטטוס ביטול/כשלון (לפי paymentStatus)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="outline-none rounded-lg">
                  <StatsCard
                    title="תשלומים תקועים / ממתינים"
                    value={overview != null ? formatCompact(overview.pendingPayments) : '—'}
                    icon={AlertCircle}
                    loading={loading && !overview}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                ספירת עסקאות עם pending או סטטוס כשלון (כמו בטבלת &quot;פיגור תשלום&quot;)
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5" />
                  הכנסות לפי יום (14 ימים אחרונים)
                </CardTitle>
                <CardDescription>סכום מחיר עסקה (payerAmount) לעסקאות ששולמו, לפי תאריך יצירה</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] w-full" dir="ltr">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${formatCompact(v)}`} />
                      <RechartsTooltip
                        formatter={(value) => [formatCurrency(value), 'הכנסות']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="הכנסות" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    {loading ? 'טוען נתונים לתרשים…' : 'אין עדיין עסקאות לתרשים'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  פעילות אחרונה
                </CardTitle>
                <CardDescription>טיוטות צ׳ק-אאוט, תשלומים ופניות — ממוין לפי זמן</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[280px] overflow-y-auto space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{loading ? 'טוען…' : 'אין פעילות להצגה'}</p>
                ) : (
                  recentActivity.map((item) => (
                    <div key={item.id} className="rounded-lg border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium truncate">{item.label}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {new Date(item.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {overview ? (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>
                לידים חדשים (7 ימים): <strong className="text-foreground">{overview.newLeads7d}</strong>
              </span>
              <span>·</span>
              <span>
                עסקאות במסד: <strong className="text-foreground">{overview.totalDealsInDb}</strong>
              </span>
              <span>·</span>
              <span>
                מבוטלים/כשלון (מספר רשומות): <strong className="text-foreground">{overview.canceledDeals}</strong>
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>לקוחות שלא מילאו טופס מוטבים</CardTitle>
                <CardDescription>
                  תשלום הושלם — סטטוס &quot;ממתין להשלמה&quot; עד לשליחת טופס המוטבים במערכת
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-80">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>מס׳ הזמנה</TableHead>
                        <TableHead>לקוח</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>סכום</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingBeneficiaryCustomers.map((row) => (
                        <TableRow key={row.id} className="bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/60">
                          <TableCell className="font-mono text-xs">{row.transactionId}</TableCell>
                          <TableCell className="text-sm">{row.fullName || '—'}</TableCell>
                          <TableCell dir="ltr" className="text-start text-xs">
                            {row.phone || '—'}
                          </TableCell>
                          <TableCell>{formatCurrency(row.payerAmount)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString('he-IL') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!pendingBeneficiaryCustomers.length ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            אין רשומות — כל העסקאות הושלמו או נשלח טופס מוטבים
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
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <Phone className="size-4" />
                    צור קשר — פרטיים
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/contacts">ניהול מלא</Link>
                  </Button>
                </CardTitle>
                <CardDescription>לידים מהאתר ומדפי &quot;צור קשר&quot; בנחיתה (תצוגה מקדימה)</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-80">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>הודעה</TableHead>
                        <TableHead>מקור</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {privateLeads.slice(0, 8).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.name}</TableCell>
                          <TableCell dir="ltr" className="text-start">
                            {l.phone}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">{l.message}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {l.source === 'landing_contact' && l.landingSlug ? `דף: ${l.landingSlug}` : l.source || 'site'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!privateLeads.length ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="size-4" />
                    צור קשר — חברות (B2B)
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/contacts">ניהול מלא</Link>
                  </Button>
                </CardTitle>
                <CardDescription>לידים ארגוניים (תצוגה מקדימה)</CardDescription>
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
                      {corporateLeads.slice(0, 8).map((l) => (
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
                            אין רשומות
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
