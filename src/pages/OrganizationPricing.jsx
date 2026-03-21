import React from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';

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
      <div className="max-w-6xl mx-auto space-y-6">
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          פיתוח: הגדירי <code className="bg-white px-1">VITE_API_URL</code> לכתובת שרת ה-API אם הפרונט רץ על פורט אחר.
        </p>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">מחירוני ארגונים</h1>
          <div className="flex gap-2 flex-wrap">
            <Link to="/admin/vendors" className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm">
              ספקים
            </Link>
            <Link to="/admin/price-list" className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm">
              דשבורד מחירון
            </Link>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-medical-teal text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          לכל שורה: בחרו <strong>ספק</strong> ו<strong>מוצר</strong> — עלות הספק והמק&quot;ט נמשכים אוטומטית מהמסד. הזינו מחיר קמעוני ועמלת סוכן; הרווחים מחושבים בזמן אמת.
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

          <div className="space-y-4">
            <h3 className="font-semibold">מוצרים במחירון (מספר שורות)</h3>
            {lines.map((line, idx) => {
              const retail = Number(line.retailPrice || 0);
              const vc = Number(line.vendorCost || 0);
              const ac = Number(line.agentCommission || 0);
              const profitBeforeAgent = retail - vc;
              const netProfit = profitBeforeAgent - ac;
              return (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">ספק *</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 bg-white"
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
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">מוצר *</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 bg-white"
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
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">מק&quot;ט (אוטומטי)</label>
                      <input className="w-full border rounded-lg px-3 py-2 bg-white font-mono text-sm text-slate-900" readOnly value={line.costLoading ? 'טוען…' : line.sku} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">עלות ספק (₪)</label>
                      <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold text-slate-900"
                        readOnly
                        value={line.costLoading ? '…' : line.vendorCost}
                        placeholder="—"
                      />
                      {line.costError ? <p className="text-xs text-amber-700 mt-0.5">{line.costError}</p> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                    <div>
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
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">עמלת סוכן</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-3 py-2"
                        value={line.agentCommission}
                        onChange={(e) => updateLine(idx, 'agentCommission', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">רווח לפני סוכן</label>
                      <input className="w-full border rounded-lg px-3 py-2 bg-blue-50 font-semibold" readOnly value={profitBeforeAgent} />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-1">רווח נקי</label>
                        <input className="w-full border rounded-lg px-3 py-2 bg-emerald-50 font-bold text-emerald-900" readOnly value={netProfit} />
                      </div>
                      <button type="button" onClick={() => removeLine(idx)} className="text-red-600 text-sm mb-2" disabled={lines.length <= 1}>
                        הסר
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={addLine} className="text-medical-blue text-sm font-semibold">
              + הוספת מוצר לרשימה
            </button>
          </div>

          {!products.length || !vendors.length ? (
            <p className="text-amber-700 text-sm">נדרשים מוצרים וספקים במערכת (כולל שיוך מוצר–ספק במסך הספקים).</p>
          ) : null}
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button disabled={loading || !products.length || !vendors.length} type="submit" className="px-5 py-2 rounded-lg bg-medical-blue text-white">
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
                  <th className="p-2 text-right">שורות</th>
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
                            {x.vendor?.vendorName ? `${x.vendor.vendorName} · ` : ''}
                            {x.product?.productName || x.product?.name || x.productId}: קמעוני ₪{x.retailPrice} · ספק ₪{x.vendorCost} · סוכן ₪
                            {x.agentCommission ?? 0} · נקי ₪{x.netProfit ?? x.profit}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}</td>
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
