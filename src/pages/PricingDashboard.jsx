import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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
  const [agentCommission, setAgentCommission] = useState('');
  const [sku, setSku] = useState('');
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editEntry, setEditEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const profitBeforeAgent = useMemo(() => {
    const r = Number(retailPrice || 0);
    const v = Number(vendorCost || 0);
    return r - v;
  }, [retailPrice, vendorCost]);

  const netProfit = useMemo(() => profitBeforeAgent - Number(agentCommission || 0), [profitBeforeAgent, agentCommission]);

  const editProfitBefore = useMemo(() => {
    if (!editEntry) return 0;
    return Number(editEntry.retailPrice || 0) - Number(editEntry.vendorCost || 0);
  }, [editEntry]);

  const editNetProfit = useMemo(() => editProfitBefore - Number(editEntry?.agentCommission || 0), [editProfitBefore, editEntry]);

  const fetchVendorProductCost = useCallback(
    async (vid, pid, onSuccess) => {
      if (!token || !vid || !pid) {
        onSuccess({ vendorCost: '', sku: '', error: '' });
        return;
      }
      setCostLoading(true);
      setCostError('');
      try {
        const res = await fetch(`${API_BASE}/api/vendor-products/${encodeURIComponent(vid)}/${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          onSuccess({ vendorCost: '', sku: '', error: data.error || 'לא נמצאה התאמה' });
          return;
        }
        onSuccess({ vendorCost: String(data.vendorCost ?? ''), sku: data.sku || '', error: '' });
      } catch {
        onSuccess({ vendorCost: '', sku: '', error: 'שגיאת רשת' });
      } finally {
        setCostLoading(false);
      }
    },
    [token]
  );

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
      setCostError('');
      return;
    }
    fetchVendorProductCost(vendorId, productId, ({ vendorCost: vc, sku: sk, error: err }) => {
      setVendorCost(vc);
      setSku(sk);
      setCostError(err || '');
    });
  }, [vendorId, productId, fetchVendorProductCost]);

  useEffect(() => {
    if (!editEntry?.vendorId || !editEntry?.productId) return;
    const entryId = editEntry.id;
    const vid = editEntry.vendorId;
    const pid = editEntry.productId;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vendor-products/${encodeURIComponent(vid)}/${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setEditEntry((e) =>
            e && e.id === entryId ? { ...e, vendorCost: String(data.vendorCost ?? e.vendorCost), sku: data.sku || e.sku, costError: '' } : e
          );
        } else {
          setEditEntry((e) => (e && e.id === entryId ? { ...e, costError: data.error || 'לא נמצאה התאמה' } : e));
        }
      } catch {
        if (!cancelled) setEditEntry((e) => (e && e.id === entryId ? { ...e, costError: 'שגיאת רשת' } : e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editEntry?.id, editEntry?.vendorId, editEntry?.productId, token]);

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
          agentCommission: Number(agentCommission || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setPricingName('');
      setOrgName('');
      setRetailPrice('');
      setAgentCommission('');
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editEntry?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/pricing-entries/${editEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pricingName: editEntry.pricingName,
          vendorId: editEntry.vendorId,
          productId: editEntry.productId,
          orgName: editEntry.orgName,
          retailPrice: Number(editEntry.retailPrice || 0),
          vendorCost: Number(editEntry.vendorCost || 0),
          agentCommission: Number(editEntry.agentCommission || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditEntry(null);
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteEntry?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pricing-entries/${deleteEntry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteEntry(null);
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row) {
    setEditEntry({
      id: row.id,
      pricingName: row.pricingName,
      orgName: row.orgName || '',
      vendorId: row.vendor?.id || '',
      productId: row.product?.id || '',
      retailPrice: String(row.retailPrice ?? ''),
      vendorCost: String(row.vendorCost ?? ''),
      agentCommission: String(row.agentCommission ?? 0),
      sku: row.product?.sku || '',
      costError: '',
    });
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
      <ConfirmDialog
        open={!!deleteEntry}
        title="מחיקת שורת מחיר"
        message={deleteEntry ? `למחוק את "${deleteEntry.pricingName}"?` : ''}
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteEntry(null)}
      />

      {editEntry ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditEntry(null)}>
          <div className="bg-white rounded-xl border max-w-lg w-full p-6 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">עריכת שורת מחיר</h2>
            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">שם מחירון</label>
                <input className="w-full border rounded-lg px-3 py-2 mt-1" value={editEntry.pricingName} onChange={(e) => setEditEntry((x) => ({ ...x, pricingName: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-slate-500">ארגון</label>
                <input className="w-full border rounded-lg px-3 py-2 mt-1" value={editEntry.orgName} onChange={(e) => setEditEntry((x) => ({ ...x, orgName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500">ספק</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                  value={editEntry.vendorId}
                  onChange={(e) => setEditEntry((x) => ({ ...x, vendorId: e.target.value }))}
                  required
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">מוצר</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                  value={editEntry.productId}
                  onChange={(e) => setEditEntry((x) => ({ ...x, productId: e.target.value }))}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName || p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">מק&quot;ט</label>
                <input className="w-full border rounded-lg px-3 py-2 mt-1 bg-slate-50 font-mono" readOnly value={editEntry.sku} />
              </div>
              <div>
                <label className="text-xs text-slate-500">עלות ספק</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                  value={editEntry.vendorCost}
                  onChange={(e) => setEditEntry((x) => ({ ...x, vendorCost: e.target.value }))}
                />
              </div>
              {editEntry.costError ? <p className="text-xs text-amber-700">{editEntry.costError}</p> : null}
              <div>
                <label className="text-xs text-slate-500">מחיר קמעוני</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={editEntry.retailPrice}
                  onChange={(e) => setEditEntry((x) => ({ ...x, retailPrice: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">עמלת סוכן</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={editEntry.agentCommission}
                  onChange={(e) => setEditEntry((x) => ({ ...x, agentCommission: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">רווח לפני סוכן</label>
                  <input className="w-full border rounded-lg px-3 py-2 bg-blue-50 font-semibold" readOnly value={editProfitBefore} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">נקי</label>
                  <input className="w-full border rounded-lg px-3 py-2 bg-emerald-50 font-bold" readOnly value={editNetProfit} />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditEntry(null)} className="px-4 py-2 rounded-lg bg-slate-200">
                  ביטול
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-medical-blue text-white">
                  {loading ? 'שומר...' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="max-w-5xl mx-auto space-y-6">
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          פיתוח: הגדירי <code className="bg-white px-1">VITE_API_URL=http://localhost:3001</code> ב־<code className="bg-white px-1">.env</code> אם הפרונט והשרת על פורטים שונים.
        </p>
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
              מחירון ארגונים
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
              <input className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900 font-mono" readOnly value={sku} placeholder={costLoading ? 'טוען…' : '—'} />
            </div>
            <div>
              <label className="text-xs text-slate-500">עלות ספק (₪) — מהמסד</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-semibold"
                readOnly
                value={costLoading ? 'טוען…' : vendorCost !== '' ? vendorCost : ''}
                placeholder={costError ? '—' : 'בחרו ספק + מוצר'}
              />
              {costError ? <p className="text-xs text-amber-700 mt-1">{costError}</p> : null}
            </div>
            <div>
              <label className="text-xs text-slate-500">מחיר קמעוני (₪) *</label>
              <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-slate-500">עמלת סוכן (₪)</label>
              <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2" value={agentCommission} onChange={(e) => setAgentCommission(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">רווח לפני סוכן</label>
              <input className="w-full border rounded-lg px-3 py-2 bg-blue-50 font-semibold text-blue-900" readOnly value={Number.isFinite(profitBeforeAgent) ? profitBeforeAgent : ''} />
            </div>
            <div>
              <label className="text-xs text-slate-500">רווח נקי (אחרי סוכן)</label>
              <input className="w-full border rounded-lg px-3 py-2 bg-emerald-50 font-bold text-emerald-900" readOnly value={Number.isFinite(netProfit) ? netProfit : ''} />
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
                  <th className="p-2 text-right">עמלת סוכן</th>
                  <th className="p-2 text-right">לפני סוכן</th>
                  <th className="p-2 text-right">נקי</th>
                  <th className="p-2 text-right">תאריך</th>
                  <th className="p-2 text-right">פעולות</th>
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
                    <td className="p-2">₪{row.agentCommission ?? 0}</td>
                    <td className="p-2">₪{row.profitBeforeAgent ?? 0}</td>
                    <td className="p-2 font-semibold text-emerald-700">₪{row.netProfit ?? row.profit ?? 0}</td>
                    <td className="p-2 text-xs whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString('he-IL') : '—'}</td>
                    <td className="p-2 whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(row)} className="text-medical-blue font-semibold ml-2">
                        עריכה
                      </button>
                      <button type="button" onClick={() => setDeleteEntry(row)} className="text-red-600 font-semibold">
                        מחק
                      </button>
                    </td>
                  </tr>
                ))}
                {!entries.length ? (
                  <tr>
                    <td colSpan={11} className="p-4 text-slate-500">
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
