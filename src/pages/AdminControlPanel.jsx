import React from 'react';
import { Link } from 'react-router-dom';

const API_BASE = window.location.origin;
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
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-700">יש להתחבר דרך מסך המנהל.</p>
        <Link to="/admin" className="text-medical-blue underline">
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
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold text-medical-blue-dark">לוח בקרה ראשי</h1>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={load} className="px-4 py-2 rounded-lg bg-medical-blue text-white text-sm">
              {loading ? 'טוען...' : 'רענון'}
            </button>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-medical-teal text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin/pricing" className="px-4 py-2 rounded-lg bg-medical-blue-dark text-white text-sm">
              מחירונים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        {error ? <p className="text-red-600 text-sm">{error}</p> : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-medical-blue-dark mb-2">עגלות נטושות</h2>
            <p className="text-xs text-slate-500 mb-3">משתמשים שהתחילו מילוי טופס ולא השלמו (מעקב מהשרת)</p>
            <div className="overflow-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-right">סשן</th>
                    <th className="p-2 text-right">עדכון</th>
                    <th className="p-2 text-right">תקציר</th>
                  </tr>
                </thead>
                <tbody>
                  {abandoned.map((row) => {
                    const snap = row.formSnapshot || {};
                    const hint = [snap.fullName, snap.phone, snap.email].filter(Boolean).join(' · ') || '—';
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="p-2 font-mono truncate max-w-[100px]">{row.sessionKey}</td>
                        <td className="p-2 whitespace-nowrap">
                          {row.updatedAt ? new Date(row.updatedAt).toLocaleString('he-IL') : '—'}
                        </td>
                        <td className="p-2 text-slate-600">{hint}</td>
                      </tr>
                    );
                  })}
                  {!abandoned.length ? (
                    <tr>
                      <td colSpan={3} className="p-3 text-slate-500">
                        אין טיוטות פתוחות
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-medical-blue-dark mb-2">פיגור תשלום / תשלום לא הושלם</h2>
            <p className="text-xs text-slate-500 mb-3">עסקאות במצב pending או כשלון תשלום</p>
            <div className="overflow-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-right">הזמנה</th>
                    <th className="p-2 text-right">סטטוס</th>
                    <th className="p-2 text-right">סכום</th>
                    <th className="p-2 text-right">שם</th>
                  </tr>
                </thead>
                <tbody>
                  {arrears.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="p-2 font-mono">{d.transactionId}</td>
                      <td className="p-2">{d.paymentStatus}</td>
                      <td className="p-2">{formatCurrency(d.payerAmount)}</td>
                      <td className="p-2">{d.formState?.fullName || '—'}</td>
                    </tr>
                  ))}
                  {!arrears.length ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-slate-500">
                        אין רשומות
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-medical-blue-dark mb-2">צור קשר — פרטיים</h2>
            <div className="overflow-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-right">שם</th>
                    <th className="p-2 text-right">טלפון</th>
                    <th className="p-2 text-right">הודעה</th>
                    <th className="p-2 text-right">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {privateLeads.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.name}</td>
                      <td className="p-2">{l.phone}</td>
                      <td className="p-2 max-w-[200px] truncate">{l.message}</td>
                      <td className="p-2 whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}
                      </td>
                    </tr>
                  ))}
                  {!privateLeads.length ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-slate-500">
                        אין פניות
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-medical-blue-dark mb-2">צור קשר — חברות (B2B)</h2>
            <div className="overflow-auto max-h-80">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-right">ארגון</th>
                    <th className="p-2 text-right">איש קשר</th>
                    <th className="p-2 text-right">טלפון</th>
                    <th className="p-2 text-right">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {corporateLeads.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.organizationName}</td>
                      <td className="p-2">{l.contactName}</td>
                      <td className="p-2">{l.phone}</td>
                      <td className="p-2 whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}
                      </td>
                    </tr>
                  ))}
                  {!corporateLeads.length ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-slate-500">
                        אין פניות
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="bg-white rounded-xl border p-4 shadow-sm">
          <h2 className="font-bold text-medical-blue-dark mb-2">ארגונים רשומים (מחירונים)</h2>
          <p className="text-xs text-slate-500 mb-3">
            רשומות ממסך &quot;מחירוני ארגונים&quot;. מזהה לדף נחיתה: <code className="bg-slate-100 px-1 rounded">pricingId</code> ב־API{' '}
            <code className="bg-slate-100 px-1 rounded">/api/pricing-context?pricingId=...</code>
          </p>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">מזהה</th>
                  <th className="p-2 text-right">ארגון</th>
                  <th className="p-2 text-right">שם מחירון</th>
                  <th className="p-2 text-right">שורות מחיר</th>
                  <th className="p-2 text-right">נוצר</th>
                </tr>
              </thead>
              <tbody>
                {registered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-mono text-xs break-all max-w-[120px]">{r.id}</td>
                    <td className="p-2">{r.organizationName}</td>
                    <td className="p-2">{r.pricingListName}</td>
                    <td className="p-2">
                      {(r.relatedProducts || []).length ? (
                        <ul className="text-xs space-y-1">
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
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}
                    </td>
                  </tr>
                ))}
                {!registered.length ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-slate-500">
                      אין ארגונים רשומים — הגדירו מחירון במסך מחירוני ארגונים.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
