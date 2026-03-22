import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Input } from '../components/ui/input.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLine = () => ({
  vendorId: '',
  productId: '',
  sku: '',
  retailPrice: '',
  vendorCost: '',
  agentCommission: '',
  costLoading: false,
  costError: '',
});

export default function OrganizationPricing() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = React.useState([]);
  const [vendors, setVendors] = React.useState([]);
  const [organizationName, setOrganizationName] = React.useState('');
  const [pricingListName, setPricingListName] = React.useState('');
  const [lines, setLines] = React.useState([emptyLine()]);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function loadProductsAndVendors() {
    if (!token) return;
    const [pr, vn] = await Promise.all([
      fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]);
    if (pr.success) setProducts(Array.isArray(pr.products) ? pr.products : []);
    if (vn.success) setVendors(Array.isArray(vn.vendors) ? vn.vendors : []);
  }

  async function loadRows() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/org-pricing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינת מחירונים נכשלה');
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        await loadProductsAndVendors();
      } catch (e) {
        setError(e.message || 'שגיאה בטעינה');
      }
      loadRows();
    })();
  }, [token]);

  const fetchLineVendorCost = React.useCallback(
    async (index, vid, pid) => {
      if (!token || !vid || !pid) {
        setLines((prev) => {
          const next = [...prev];
          if (!next[index]) return prev;
          next[index] = { ...next[index], vendorCost: '', sku: '', costLoading: false, costError: '' };
          return next;
        });
        return;
      }
      setLines((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], costLoading: true, costError: '' };
        return next;
      });
      try {
        const res = await fetch(`${API_BASE}/api/vendor-products/${encodeURIComponent(vid)}/${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        setLines((prev) => {
          const next = [...prev];
          if (!next[index]) return prev;
          if (res.ok && data.success) {
            next[index] = {
              ...next[index],
              vendorCost: String(data.vendorCost ?? ''),
              sku: data.sku || '',
              costLoading: false,
              costError: '',
            };
          } else {
            const p = products.find((x) => x.id === pid);
            next[index] = {
              ...next[index],
              vendorCost: '',
              sku: p?.sku || '',
              costLoading: false,
              costError: data.error || 'לא נמצאה התאמה',
            };
          }
          return next;
        });
      } catch {
        setLines((prev) => {
          const next = [...prev];
          if (!next[index]) return prev;
          next[index] = { ...next[index], costLoading: false, costError: 'שגיאת רשת' };
          return next;
        });
      }
    },
    [token, products]
  );

  function updateLine(index, field, value) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function onVendorChange(index, vid) {
    const pid = lines[index]?.productId || '';
    updateLine(index, 'vendorId', vid);
    fetchLineVendorCost(index, vid, pid);
  }

  function onProductChange(index, pid) {
    const vid = lines[index]?.vendorId || '';
    updateLine(index, 'productId', pid);
    fetchLineVendorCost(index, vid, pid);
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const relatedProducts = lines
        .filter((l) => l.productId && l.vendorId)
        .map((l) => ({
          vendorId: l.vendorId,
          productId: l.productId,
          retailPrice: Number(l.retailPrice || 0),
          vendorCost: Number(l.vendorCost || 0),
          agentCommission: Number(l.agentCommission || 0),
        }));
      if (!relatedProducts.length) {
        throw new Error('יש לבחור ספק ומוצר בכל שורה');
      }
      const res = await fetch(`${API_BASE}/api/admin/org-pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationName,
          pricingListName,
          relatedProducts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setOrganizationName('');
      setPricingListName('');
      setLines([emptyLine()]);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

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
    <AdminPageShell>
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          פיתוח: הגדירי <code className="rounded bg-background px-1">VITE_API_URL</code> לכתובת שרת ה-API אם הפרונט רץ על פורט אחר.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="size-7 text-primary" />
              מחירוני ארגונים
            </h1>
            <p className="text-muted-foreground">הגדרת מחירון לארגון — קישור ל־API נחיתה</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          לכל שורה: בחרו <strong>ספק</strong> ו<strong>מוצר</strong> — עלות הספק והמק&quot;ט נמשכים אוטומטית מהמסד. הזינו מחיר קמעוני ועמלת סוכן; הרווחים מחושבים בזמן אמת.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>יצירת מחירון לארגון</CardTitle>
            <CardDescription>שם ארגון, שם מחירון ושורות מוצר–ספק</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>שם ארגון *</FieldLabel>
                    <Input
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="שם ארגון"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>שם מחירון *</FieldLabel>
                    <Input
                      value={pricingListName}
                      onChange={(e) => setPricingListName(e.target.value)}
                      placeholder="שם מחירון"
                      required
                    />
                  </Field>
                </div>
              </FieldGroup>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm">מוצרים במחירון (מספר שורות)</h3>
                {lines.map((line, idx) => {
                  const retail = Number(line.retailPrice || 0);
                  const vc = Number(line.vendorCost || 0);
                  const ac = Number(line.agentCommission || 0);
                  const profitBeforeAgent = retail - vc;
                  const netProfit = profitBeforeAgent - ac;
                  return (
                    <div key={idx} className="border rounded-lg p-4 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">ספק *</FieldLabel>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={line.vendorId}
                            onChange={(e) => onVendorChange(idx, e.target.value)}
                            required={idx === 0}
                          >
                            <option value="">— בחרו ספק —</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.vendorName}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">מוצר *</FieldLabel>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={line.productId}
                            onChange={(e) => onProductChange(idx, e.target.value)}
                            required={idx === 0}
                          >
                            <option value="">— בחרו מוצר —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.productName || p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">מק&quot;ט (אוטומטי)</FieldLabel>
                          <Input className="font-mono text-sm" readOnly value={line.costLoading ? 'טוען…' : line.sku} />
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">עלות ספק (₪)</FieldLabel>
                          <Input className="font-semibold" readOnly value={line.costLoading ? '…' : line.vendorCost} placeholder="—" />
                          {line.costError ? <p className="text-xs text-amber-700 mt-0.5">{line.costError}</p> : null}
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">מחיר קמעוני</FieldLabel>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            value={line.retailPrice}
                            onChange={(e) => updateLine(idx, 'retailPrice', e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">עמלת סוכן</FieldLabel>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            value={line.agentCommission}
                            onChange={(e) => updateLine(idx, 'agentCommission', e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">רווח לפני סוכן</FieldLabel>
                          <Input className="bg-blue-50 dark:bg-blue-950/30 font-semibold" readOnly value={profitBeforeAgent} />
                        </Field>
                        <div className="flex gap-2 items-end">
                          <Field className="gap-1.5 flex-1">
                            <FieldLabel className="text-xs">רווח נקי</FieldLabel>
                            <Input
                              className="bg-emerald-50 dark:bg-emerald-950/30 font-bold text-emerald-900 dark:text-emerald-100"
                              readOnly
                              value={netProfit}
                            />
                          </Field>
                          <Button type="button" variant="ghost" className="text-destructive mb-0.5" disabled={lines.length <= 1} onClick={() => removeLine(idx)}>
                            הסר
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button type="button" variant="link" className="h-auto p-0" onClick={addLine}>
                  <Plus className="size-4 me-1" />
                  הוספת מוצר לרשימה
                </Button>
              </div>

              {!products.length || !vendors.length ? (
                <p className="text-amber-700 text-sm">נדרשים מוצרים וספקים במערכת (כולל שיוך מוצר–ספק במסך הספקים).</p>
              ) : null}
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button type="submit" disabled={loading || !products.length || !vendors.length}>
                {loading && <Spinner className="me-2" />}
                שמירת מחירון לארגון
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ארגונים רשומים (מחירונים שמורים)</CardTitle>
            <CardDescription>
              רשימה מהשרת
              <Button variant="link" className="px-2 h-auto font-normal text-primary" type="button" onClick={() => loadRows()}>
                רענון
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ארגון</TableHead>
                    <TableHead>מחירון</TableHead>
                    <TableHead>שורות</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.organizationName}</TableCell>
                      <TableCell>{r.pricingListName}</TableCell>
                      <TableCell className="text-xs">
                        <ul className="space-y-1 list-none p-0 m-0">
                          {(r.relatedProducts || []).map((x, i) => (
                            <li key={i}>
                              {x.vendor?.vendorName ? `${x.vendor.vendorName} · ` : ''}
                              {x.product?.productName || x.product?.name || x.productId}: קמעוני ₪{x.retailPrice} · ספק ₪{x.vendorCost} · סוכן ₪
                              {x.agentCommission ?? 0} · נקי ₪{x.netProfit ?? x.profit}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        אין נתונים
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
