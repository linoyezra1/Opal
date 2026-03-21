import React from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

const emptyLine = () => ({ productId: '', retailPrice: '', vendorCost: '' });

export default function OrganizationPricing() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = React.useState([]);
  const [organizationName, setOrganizationName] = React.useState('');
  const [pricingListName, setPricingListName] = React.useState('');
  const [lines, setLines] = React.useState([emptyLine()]);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function loadProducts() {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'טעינת מוצרים נכשלה');
    setProducts(Array.isArray(data.products) ? data.products : []);
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
        await loadProducts();
      } catch (e) {
        setError(e.message || 'שגיאה בטעינת מוצרים');
      }
      loadRows();
    })();
  }, [token]);

  function updateLine(index, field, value) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
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
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          retailPrice: Number(l.retailPrice || 0),
          vendorCost: Number(l.vendorCost || 0),
        }));
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
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">
          מעבר לכניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">מחירוני ארגונים</h1>
          <div className="flex gap-2 flex-wrap">
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-medical-teal text-white text-sm">
              ניהול מוצרים
            </Link>
            <Link to="/admin/control-panel" className="px-4 py-2 rounded-lg bg-medical-blue text-white text-sm">
              לוח בקרה
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          בחרו מוצרים מהרשימה (מוגדרים ב&quot;ניהול מוצרים&quot;) והזינו מחיר קמעוני ועלות ספק לכל ארגון. הרווח מחושב אוטומטית.
        </p>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="שם ארגון"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="שם מחירון"
              value={pricingListName}
              onChange={(e) => setPricingListName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">מוצרים ומחירים</h3>
            {lines.map((line, idx) => {
              const retail = Number(line.retailPrice || 0);
              const vendor = Number(line.vendorCost || 0);
              const profit = retail - vendor;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-slate-200 rounded-lg p-3 bg-slate-50/80"
                >
                  <div className="md:col-span-5">
                    <label className="text-xs text-slate-500 block mb-1">מוצר</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={line.productId}
                      onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                      required={idx === 0}
                    >
                      <option value="">— בחרו מוצר —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productName || p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">מחיר קמעוני</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2"
                      value={line.retailPrice}
                      onChange={(e) => updateLine(idx, 'retailPrice', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">עלות ספק</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2"
                      value={line.vendorCost}
                      onChange={(e) => updateLine(idx, 'vendorCost', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">רווח (חישוב)</label>
                    <input className="w-full border rounded-lg px-3 py-2 bg-white" readOnly value={profit} />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-red-600 text-sm underline disabled:opacity-40"
                      disabled={lines.length <= 1}
                    >
                      הסר
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={addLine} className="text-medical-blue text-sm font-semibold">
              + הוספת מוצר
            </button>
          </div>

          {!products.length ? (
            <p className="text-amber-700 text-sm">אין מוצרים במערכת — הוסיפו מוצרים תחילה ב&quot;ניהול מוצרים&quot;.</p>
          ) : null}
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button disabled={loading || !products.length} type="submit" className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת מחירון לארגון'}
          </button>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-lg mb-3">ארגונים רשומים (מחירונים שמורים)</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">ארגון</th>
                  <th className="p-2 text-right">מחירון</th>
                  <th className="p-2 text-right">מוצרים</th>
                  <th className="p-2 text-right">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2">{r.organizationName}</td>
                    <td className="p-2">{r.pricingListName}</td>
                    <td className="p-2 text-xs">
                      <ul className="space-y-1">
                        {(r.relatedProducts || []).map((x, i) => (
                          <li key={i}>
                            {x.product?.productName || x.product?.name || x.productId}: קמעוני ₪{x.retailPrice} · ספק ₪{x.vendorCost} · רווח ₪
                            {x.profit}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-slate-500">
                      אין נתונים
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
