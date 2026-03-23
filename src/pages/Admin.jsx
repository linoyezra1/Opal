import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

export default function Admin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [deals, setDeals] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function login(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'התחברות נכשלה');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      navigate('/admin/control-panel', { replace: true });
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function loadDeals(authToken = token) {
    if (!authToken) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/deals`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'טעינת עסקאות נכשלה');
      }
      setDeals(Array.isArray(data.deals) ? data.deals : []);
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (token) loadDeals(token);
  }, [token]);

  useEffect(() => {
    if (token) navigate('/admin/control-panel', { replace: true });
  }, [token, navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const name = d.formState?.fullName || '';
      const tx = d.transactionId || '';
      const id = d.formState?.id || '';
      const plan = d.formState?.selectedPlanId || '';
      return [name, tx, id, plan].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [deals, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = deals.filter((d) => {
      if (!d.createdAt) return false;
      const dt = new Date(d.createdAt);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });
    const totalRevenue = deals.reduce((sum, d) => sum + Number(d.payerAmount || 0), 0);
    const pending = deals.filter((d) => String(d.paymentStatus || '').includes('pending')).length;
    return { totalRevenue, newMembers: thisMonth.length, pending };
  }, [deals]);

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h1 className="text-2xl font-bold text-medical-blue-dark text-right">כניסת מנהל</h1>
          <input className="w-full border rounded-lg px-3 py-2 text-right" placeholder="שם משתמש" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="w-full border rounded-lg px-3 py-2 text-right" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-red-600 text-sm text-right">{error}</p> : null}
          <button disabled={loading} className="w-full bg-medical-blue hover:bg-medical-blue-dark text-white rounded-lg py-2 font-semibold">
            {loading ? 'טוען...' : 'כניסה'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h1 className="text-3xl font-bold text-medical-blue-dark">לוח ניהול אופל</h1>
          <div className="flex gap-2">
            <Link to="/admin/subscribers" className="px-4 py-2 rounded-lg bg-medical-teal text-white">מנויים</Link>
            <Link to="/admin/control-panel" className="px-4 py-2 rounded-lg bg-amber-600 text-white">לוח בקרה</Link>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white">מוצרים</Link>
            <Link to="/admin/vendors" className="px-4 py-2 rounded-lg bg-amber-800 text-white">ספקים</Link>
            <Link to="/admin/price-list" className="px-4 py-2 rounded-lg bg-indigo-700 text-white">מחירון</Link>
            <Link to="/admin/pricing" className="px-4 py-2 rounded-lg bg-medical-blue-dark text-white">מחירון ארגונים</Link>
            <Link to="/admin/agents" className="px-4 py-2 rounded-lg bg-medical-blue text-white">סוכנים</Link>
            <button onClick={() => loadDeals()} className="px-4 py-2 rounded-lg bg-medical-blue text-white">רענון</button>
            <button
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                setToken('');
              }}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700"
            >
              התנתקות
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4"><p className="text-slate-500">סך הכנסות</p><p className="text-2xl font-bold text-medical-blue-dark">{formatCurrency(stats.totalRevenue)}</p></div>
          <div className="bg-white border rounded-xl p-4"><p className="text-slate-500">מצטרפים החודש</p><p className="text-2xl font-bold text-medical-blue-dark">{stats.newMembers}</p></div>
          <div className="bg-white border rounded-xl p-4"><p className="text-slate-500">עסקאות בהמתנה</p><p className="text-2xl font-bold text-amber-600">{stats.pending}</p></div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <input
            className="w-full md:w-80 border rounded-lg px-3 py-2 text-right"
            placeholder="חיפוש לפי שם / ת.ז / מספר הזמנה / חבילה"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {error ? <p className="text-red-600 text-sm mt-2">{error}</p> : null}
          <div className="overflow-auto mt-4">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">סטטוס</th>
                  <th className="p-2 text-right">מס' הזמנה</th>
                  <th className="p-2 text-right">שם מלא</th>
                  <th className="p-2 text-right">חבילה</th>
                  <th className="p-2 text-right">סכום</th>
                  <th className="p-2 text-right">תאריך</th>
                  <th className="p-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{String(d.paymentStatus || '').includes('paid') || String(d.paymentStatus || '').includes('success') ? 'שולם' : 'בהמתנה'}</td>
                    <td className="p-2">{d.transactionId}</td>
                    <td className="p-2">{d.formState?.fullName || '-'}</td>
                    <td className="p-2">{d.formState?.selectedPlanId || '-'}</td>
                    <td className="p-2">{formatCurrency(d.payerAmount)}</td>
                    <td className="p-2">{d.createdAt ? new Date(d.createdAt).toLocaleString('he-IL') : '-'}</td>
                    <td className="p-2">
                      <button onClick={() => setSelected(d)} className="px-3 py-1 rounded bg-medical-teal text-white">פרטים מלאים</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && !loading ? (
                  <tr><td className="p-3 text-slate-500" colSpan={7}>אין נתונים להצגה</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl bg-white rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-medical-blue-dark">פרטי עסקה מלאים</h2>
              <button onClick={() => setSelected(null)} className="text-slate-500">סגור</button>
            </div>
            <pre className="text-xs bg-slate-50 border rounded p-3 overflow-auto max-h-[70vh] text-left">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
