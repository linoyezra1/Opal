import React from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

const EMPTY_FORM = { name: '', sku: '', baseDescription: '' };

export default function ProductManagement() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function loadProducts() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינת מוצרים נכשלה');
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadProducts();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(EMPTY_FORM);
      await loadProducts();
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
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">ניהול מוצרים (בסיס למחירונים)</h1>
          <div className="flex gap-2">
            <Link to="/admin/control-panel" className="px-4 py-2 rounded-lg bg-medical-teal text-white text-sm">
              לוח בקרה
            </Link>
            <Link to="/admin/pricing" className="px-4 py-2 rounded-lg bg-medical-blue-dark text-white text-sm">
              מחירוני ארגונים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">הוספת מוצר</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="שם מוצר"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder='מק"ט (SKU)'
              value={form.sku}
              onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
            />
            <textarea
              className="border rounded-lg px-3 py-2 md:col-span-2 min-h-[80px]"
              placeholder="תיאור בסיס (אופציונלי)"
              value={form.baseDescription}
              onChange={(e) => setForm((p) => ({ ...p, baseDescription: e.target.value }))}
            />
          </div>
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button disabled={loading} type="submit" className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת מוצר'}
          </button>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-lg">רשימת מוצרים</h2>
            <button type="button" onClick={() => loadProducts()} className="text-sm text-medical-blue underline">
              רענון
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">שם</th>
                  <th className="p-2 text-right">מק&quot;ט</th>
                  <th className="p-2 text-right">תיאור</th>
                  <th className="p-2 text-right">נוצר</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 font-mono">{p.sku}</td>
                    <td className="p-2 text-slate-600 max-w-md truncate">{p.baseDescription || '—'}</td>
                    <td className="p-2 text-slate-500 whitespace-nowrap">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString('he-IL') : '—'}
                    </td>
                  </tr>
                ))}
                {!products.length ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-slate-500">
                      אין מוצרים — הוסיפו מוצרים כדי שיופיעו במחירוני הארגונים.
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
