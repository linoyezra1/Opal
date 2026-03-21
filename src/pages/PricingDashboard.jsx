import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

export default function PricingDashboard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pricingName, setPricingName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [productId, setProductId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const profit = useMemo(() => {
    const r = Number(retailPrice || 0);
    const v = Number(vendorCost || 0);
    return r - v;
  }, [retailPrice, vendorCost]);

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [pr, vn, en] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/pricing-entries`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (pr.success) setProducts(pr.products || []);
      if (vn.success) setVendors(vn.vendors || []);
      if (en.success) setEntries(en.entries || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [token]);

  useEffect(() => {
    if (!vendorId || !productId) {
      setVendorCost('');
      setSku('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/vendor-cost?vendorId=${encodeURIComponent(vendorId)}&productId=${encodeURIComponent(productId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setVendorCost(String(data.vendorCost ?? ''));
          setSku(data.sku || '');
        } else {
          setVendorCost('');
          setSku(products.find((p) => p.id === productId)?.sku || '');
        }
      } catch {
        if (!cancelled) {
          setVendorCost('');
          setSku(products.find((p) => p.id === productId)?.sku || '');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, productId, token, products]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/pricing-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pricingName,
          vendorId,
          productId,
          orgName,
          retailPrice: Number(retailPrice || 0),
          vendorCost: vendorCost === '' ? undefined : Number(vendorCost),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setPricingName('');
      setOrgName('');
      setRetailPrice('');
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p>יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">
          כניסת מנהל
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">דשבורד מחירון</h1>
          <div className="flex gap-2 flex-wrap">
            <Link to="/admin/vendors" className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm">
              ספקים
            </Link>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin/pricing" className="px-4 py-2 rounded-lg bg-slate-300 text-sm">
              מחירון ארגונים (ישן)
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה
            </Link>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">שם מחירון *</label>
              <input className="w-full border rounded-lg px-3 py-2" value={pricingName} onChange={(e) => setPricingName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-slate-500">שם ארגון (אופציונלי)</label>
              <input className="w-full border rounded-lg px-3 py-2" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">ספק *</label>
              <select className="w-full border rounded-lg px-3 py-2 bg-white" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                <option value="">— בחרו ספק —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">מוצר *</label>
              <select className="w-full border rounded-lg px-3 py-2 bg-white" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">— בחרו מוצר —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productName || p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">מק&quot;ט (אוטומטי)</label>
              <input className="w-full border rounded-lg px-3 py-2 bg-slate-100" readOnly value={sku} placeholder="יבחר עם מוצר" />
            </div>
            <div>
              <label className="text-xs text-slate-500">עלות ספק (₪) — נמשכת מהספק</label>
              <input className="w-full border rounded-lg px-3 py-2 bg-slate-100" readOnly value={vendorCost} placeholder="בחרו ספק+מוצר" />
            </div>
            <div>
              <label className="text-xs text-slate-500">מחיר קמעוני (₪) *</label>
              <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-slate-500">רווח (חי)</label>
              <input className="w-full border rounded-lg px-3 py-2 bg-emerald-50 font-bold text-emerald-800" readOnly value={profit} />
            </div>
          </div>
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת שורת מחיר'}
          </button>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-lg mb-3">שורות מחיר שמורות</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">מחירון</th>
                  <th className="p-2 text-right">ארגון</th>
                  <th className="p-2 text-right">ספק</th>
                  <th className="p-2 text-right">מוצר</th>
                  <th className="p-2 text-right">קמעוני</th>
                  <th className="p-2 text-right">ספק</th>
                  <th className="p-2 text-right">רווח</th>
                  <th className="p-2 text-right">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.pricingName}</td>
                    <td className="p-2">{row.orgName || '—'}</td>
                    <td className="p-2">{row.vendor?.vendorName}</td>
                    <td className="p-2">
                      {row.product?.productName} ({row.product?.sku})
                    </td>
                    <td className="p-2">₪{row.retailPrice}</td>
                    <td className="p-2">₪{row.vendorCost}</td>
                    <td className="p-2 font-semibold text-emerald-700">₪{row.profit}</td>
                    <td className="p-2 text-xs whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString('he-IL') : '—'}</td>
                  </tr>
                ))}
                {!entries.length ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-slate-500">
                      אין שורות
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
