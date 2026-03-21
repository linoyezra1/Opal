import React from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

const PRODUCTS = [
  { name: 'מנוי משפחתי', sku: 'PLAN-A' },
  { name: 'מנוי מבוגר', sku: 'PLAN-B' },
  { name: 'תוספת בן/בת זוג', sku: 'PLAN-FG-SPOUSE' },
  { name: 'מנוי ילד', sku: 'PLAN-FG-CHILD' },
  { name: 'מנוי 65+ יחיד', sku: 'PLAN-65-SINGLE' },
  { name: 'מנוי 65+ זוג', sku: 'PLAN-65-COUPLE' },
];

const INITIAL_FORM = {
  orgName: '',
  priceListName: '',
  vendorName: '',
  productName: PRODUCTS[0].name,
  productSKU: PRODUCTS[0].sku,
};

export default function OrganizationPricing() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(INITIAL_FORM);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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
    loadRows();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/org-pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(INITIAL_FORM);
      await loadRows();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function onProductChange(value) {
    const product = PRODUCTS.find((p) => p.sku === value) || PRODUCTS[0];
    setForm((prev) => ({ ...prev, productName: product.name, productSKU: product.sku }));
  }

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">מעבר לכניסת מנהל</Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-medical-blue-dark">ניהול מחירונים לארגונים</h1>
          <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200">חזרה לניהול</Link>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border rounded-lg px-3 py-2" placeholder="שם ארגון" value={form.orgName} onChange={(e) => setForm((p) => ({ ...p, orgName: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="שם מחירון" value={form.priceListName} onChange={(e) => setForm((p) => ({ ...p, priceListName: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="שם ספק" value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} />
          <select className="border rounded-lg px-3 py-2 bg-white" value={form.productSKU} onChange={(e) => onProductChange(e.target.value)}>
            {PRODUCTS.map((p) => (
              <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
            ))}
          </select>
          <input className="border rounded-lg px-3 py-2 bg-slate-50" readOnly value={form.productName} />
          <input className="border rounded-lg px-3 py-2 bg-slate-50" readOnly value={form.productSKU} />
          <div className="md:col-span-2">
            {error ? <p className="text-red-600 text-sm mb-2">{error}</p> : null}
            <button disabled={loading} className="px-5 py-2 rounded-lg bg-medical-blue text-white">
              {loading ? 'שומר...' : 'שמירת מחירון'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-lg mb-3">מחירונים קיימים</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">ארגון</th>
                  <th className="p-2 text-right">מחירון</th>
                  <th className="p-2 text-right">ספק</th>
                  <th className="p-2 text-right">מוצר</th>
                  <th className="p-2 text-right">מק"ט</th>
                  <th className="p-2 text-right">תאריך יצירה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.orgName}</td>
                    <td className="p-2">{r.priceListName}</td>
                    <td className="p-2">{r.vendorName}</td>
                    <td className="p-2">{r.productName}</td>
                    <td className="p-2">{r.productSKU}</td>
                    <td className="p-2">{r.creationDate ? new Date(r.creationDate).toLocaleString('he-IL') : '-'}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={6} className="p-3 text-slate-500">אין נתונים</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
