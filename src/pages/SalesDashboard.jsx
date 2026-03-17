import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
const TOKEN_KEY = 'opal_admin_token';

const SUMMARY_ITEMS = [
  { key: 'all', label: 'הכל' },
  { key: 'primary', label: 'לקוחות עיקריים' },
  { key: 'active', label: 'לקוחות פעילים (עיקרי + משניים)' },
  { key: 'canceled', label: 'לקוחות מבוטלים' },
  { key: 'private_org', label: 'ארגונים ששילמו באופן פרטי' },
  { key: 'centralized_org', label: 'ארגונים בתשלום מרוכז' },
  { key: 'centralized_canceled', label: 'ביטולים בתשלום מרוכז' },
];

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

export default function SalesDashboard() {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState({
    summary: {},
    searchResults: {},
    filterOptions: { providers: [], agents: [] },
    rows: [],
  });

  const [filters, setFilters] = useState({
    month: '',
    fromDate: '',
    toDate: '',
    providerEnabled: false,
    providerValue: '',
    providerSearchEnabled: false,
    providerSearch: '',
    agentEnabled: false,
    agentValue: '',
    agentSearchEnabled: false,
    agentSearch: '',
    amountDue: '',
    organizationSearch: '',
    customerSearch: '',
    idSearch: '',
    summaryCategories: [],
  });

  const filteredProviders = useMemo(() => {
    if (!filters.providerSearchEnabled || !filters.providerSearch.trim()) return data.filterOptions.providers || [];
    const q = filters.providerSearch.trim().toLowerCase();
    return (data.filterOptions.providers || []).filter((x) => String(x).toLowerCase().includes(q));
  }, [data.filterOptions.providers, filters.providerSearchEnabled, filters.providerSearch]);

  const filteredAgents = useMemo(() => {
    if (!filters.agentSearchEnabled || !filters.agentSearch.trim()) return data.filterOptions.agents || [];
    const q = filters.agentSearch.trim().toLowerCase();
    return (data.filterOptions.agents || []).filter((x) => String(x).toLowerCase().includes(q));
  }, [data.filterOptions.agents, filters.agentSearchEnabled, filters.agentSearch]);

  async function loadDashboard() {
    if (!token) {
      setError('נדרשת התחברות אדמין. היכנס/י דרך /admin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        month: filters.month || '',
        fromDate: filters.fromDate || '',
        toDate: filters.toDate || '',
        providerEnabled: String(!!filters.providerEnabled),
        providerValue: filters.providerValue || '',
        agentEnabled: String(!!filters.agentEnabled),
        agentValue: filters.agentValue || '',
        organizationSearch: filters.organizationSearch || '',
        customerSearch: filters.customerSearch || '',
        idSearch: filters.idSearch || '',
        amountDue: filters.amountDue || '0',
        summaryCategories: (filters.summaryCategories || []).join(','),
      });

      const res = await fetch(`${API_BASE}/api/admin/sales-dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'טעינת דשבורד נכשלה');
      }
      setData({
        summary: json.summary || {},
        searchResults: json.searchResults || {},
        filterOptions: json.filterOptions || { providers: [], agents: [] },
        rows: Array.isArray(json.rows) ? json.rows : [],
      });
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSummaryCategory(key) {
    setFilters((prev) => {
      const has = prev.summaryCategories.includes(key);
      return {
        ...prev,
        summaryCategories: has ? prev.summaryCategories.filter((x) => x !== key) : [...prev.summaryCategories, key],
      };
    });
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-medical-blue-dark">מכירות</h1>
          <div className="flex gap-2">
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700">חזרה לאדמין</Link>
            <button onClick={loadDashboard} className="px-4 py-2 rounded-lg bg-medical-blue text-white">הצג בדוח</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3 bg-white border rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm text-right">חודש
                <input type="month" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm text-right">מתאריך
                <input type="date" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm text-right">עד תאריך
                <input type="date" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={filters.providerEnabled} onChange={(e) => setFilters((p) => ({ ...p, providerEnabled: e.target.checked }))} />
                  <span className="text-sm font-medium">ספק</span>
                </div>
                <select value={filters.providerValue} onChange={(e) => setFilters((p) => ({ ...p, providerValue: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mb-2">
                  <option value="">הכל</option>
                  {filteredProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={filters.providerSearchEnabled} onChange={(e) => setFilters((p) => ({ ...p, providerSearchEnabled: e.target.checked }))} />
                  <input placeholder="הכל / שם" value={filters.providerSearch} onChange={(e) => setFilters((p) => ({ ...p, providerSearch: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={filters.agentEnabled} onChange={(e) => setFilters((p) => ({ ...p, agentEnabled: e.target.checked }))} />
                  <span className="text-sm font-medium">סוכן</span>
                </div>
                <select value={filters.agentValue} onChange={(e) => setFilters((p) => ({ ...p, agentValue: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mb-2">
                  <option value="">הכל</option>
                  {filteredAgents.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={filters.agentSearchEnabled} onChange={(e) => setFilters((p) => ({ ...p, agentSearchEnabled: e.target.checked }))} />
                  <input placeholder="הכל / שם" value={filters.agentSearch} onChange={(e) => setFilters((p) => ({ ...p, agentSearch: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="text-sm">לתשלום
                <input type="number" value={filters.amountDue} onChange={(e) => setFilters((p) => ({ ...p, amountDue: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">חיפוש לפי ארגון
                <input value={filters.organizationSearch} onChange={(e) => setFilters((p) => ({ ...p, organizationSearch: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">חיפוש לפי לקוח
                <input value={filters.customerSearch} onChange={(e) => setFilters((p) => ({ ...p, customerSearch: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">חיפוש לפי ח.פ / ת.ז
                <input value={filters.idSearch} onChange={(e) => setFilters((p) => ({ ...p, idSearch: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3">
              <h3 className="font-semibold text-medical-blue-dark mb-2">מציג תוצאות חיפוש</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>סה"כ עסקאות: <strong>{data.searchResults.totalTransactions || 0}</strong></div>
                <div>סה"כ לקוחות עיקריים: <strong>{data.searchResults.totalPrimary || 0}</strong></div>
                <div>סה"כ לקוחות משניים: <strong>{data.searchResults.totalSecondary || 0}</strong></div>
                <div>סה"כ מכירות בכסף: <strong>{formatCurrency(data.searchResults.totalSalesAmount || 0)}</strong></div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold text-medical-blue-dark">כמות / סנן לפי</h3>
            {SUMMARY_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-2 text-sm border-b pb-2">
                <span>{item.label}</span>
                <div className="flex items-center gap-2">
                  <strong>{data.summary[item.key] || 0}</strong>
                  <input
                    type="checkbox"
                    checked={filters.summaryCategories.includes(item.key)}
                    onChange={() => toggleSummaryCategory(item.key)}
                  />
                </div>
              </label>
            ))}
            <div className="pt-2 text-sm">סה"כ בכסף: <strong>{formatCurrency(data.summary.totalRevenue || 0)}</strong></div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 overflow-auto">
          {error ? <p className="text-red-600 text-sm mb-2">{error}</p> : null}
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-right">סטטוס</th>
                <th className="p-2 text-right">מס' הזמנה</th>
                <th className="p-2 text-right">לקוח</th>
                <th className="p-2 text-right">ארגון</th>
                <th className="p-2 text-right">סוכן</th>
                <th className="p-2 text-right">חבילה</th>
                <th className="p-2 text-right">סכום</th>
                <th className="p-2 text-right">תאריך</th>
                <th className="p-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.status === 'canceled' ? 'מבוטל' : 'שולם'}</td>
                  <td className="p-2">{r.transactionId}</td>
                  <td className="p-2">{r.fullName || '-'}</td>
                  <td className="p-2">{r.organizationName || '-'}</td>
                  <td className="p-2">{r.agentName || '-'}</td>
                  <td className="p-2">{r.planType || '-'}</td>
                  <td className="p-2">{formatCurrency(r.amount)}</td>
                  <td className="p-2">{r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '-'}</td>
                  <td className="p-2"><button className="px-3 py-1 rounded bg-medical-teal text-white" onClick={() => setSelected(r.raw)}>View Full Details</button></td>
                </tr>
              ))}
              {!data.rows.length && !loading ? <tr><td colSpan={9} className="p-3 text-slate-500">אין נתונים</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-medical-blue-dark mb-1">סיכום רווח והוצאות</h3>
          <p className="text-xs text-slate-500 mb-3">מחשב הוצאות תשלום לספק + סוכן בלבד</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded-lg p-3">סה"כ הוצאות: <strong>{formatCurrency(data.summary.totalExpenses || 0)}</strong></div>
            <div className="border rounded-lg p-3">סה"כ בכסף: <strong>{formatCurrency(data.summary.totalRevenue || 0)}</strong></div>
            <div className="border rounded-lg p-3">סה"כ רווח: <strong>{formatCurrency(data.summary.totalProfit || 0)}</strong></div>
          </div>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl bg-white rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-medical-blue-dark">פרטים מלאים</h2>
              <button onClick={() => setSelected(null)} className="text-slate-500">סגור</button>
            </div>
            <pre className="text-xs bg-slate-50 border rounded p-3 overflow-auto max-h-[70vh] text-left">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
