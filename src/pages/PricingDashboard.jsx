import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLine = () => ({
  vendorId: '',
  productId: '',
  retailPrice: '',
  defaultAgentCommission: '',
  vendorCost: '',
});

export default function PricingDashboard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [listName, setListName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [deleteId, setDeleteId] = useState(null);

  const landingBase = useMemo(() => `${window.location.origin}/landing`, []);

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [pr, vn, ls] = await Promise.all([
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/price-lists`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (pr.success) setProducts(pr.products || []);
      if (vn.success) setVendors(vn.vendors || []);
      if (ls.success) setLists(ls.lists || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [token]);

  const fetchLineCost = useCallback(
    async (index, vendorId, productId) => {
      if (!token || !vendorId || !productId) return;
      try {
        const res = await fetch(`${API_BASE}/api/vendor-products/${encodeURIComponent(vendorId)}/${encodeURIComponent(productId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setLines((prev) => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = { ...next[index], vendorCost: String(data.vendorCost ?? '') };
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    },
    [token]
  );

  function openNew() {
    setEditId(null);
    setListName('');
    setOrgName('');
    setLines([emptyLine()]);
    setShowModal(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setListName(row.listName || '');
    setOrgName(row.orgName || '');
    const mapped =
      (row.lines || []).length > 0
        ? row.lines.map((l) => ({
            vendorId: l.vendorId,
            productId: l.productId,
            retailPrice: String(l.retailPrice ?? ''),
            defaultAgentCommission: String(l.defaultAgentCommission ?? ''),
            vendorCost: String(l.vendorCost ?? ''),
          }))
        : [emptyLine()];
    setLines(mapped);
    setShowModal(true);
    setTimeout(() => {
      mapped.forEach((l, i) => {
        if (l.vendorId && l.productId) fetchLineCost(i, l.vendorId, l.productId);
      });
    }, 50);
  }

  function updateLine(i, field, value) {
    setLines((prev) => {
      const next = [...prev];
      const cur = { ...next[i], [field]: value };
      next[i] = cur;
      const vid = field === 'vendorId' ? value : cur.vendorId;
      const pid = field === 'productId' ? value : cur.productId;
      if (vid && pid) {
        queueMicrotask(() => fetchLineCost(i, vid, pid));
      }
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  async function saveList(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        listName,
        orgName,
        lines: lines
          .filter((l) => l.vendorId && l.productId)
          .map((l) => ({
            vendorId: l.vendorId,
            productId: l.productId,
            retailPrice: Number(l.retailPrice || 0),
            defaultAgentCommission: Number(l.defaultAgentCommission || 0),
            vendorCost: l.vendorCost === '' ? undefined : Number(l.vendorCost),
          })),
      };
      if (!body.lines.length) {
        throw new Error('יש להוסיף לפחות מוצר אחד עם ספק');
      }
      const url = editId ? `${API_BASE}/api/admin/price-lists/${editId}` : `${API_BASE}/api/admin/price-lists`;
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowModal(false);
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/price-lists/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteId(null);
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
      <ConfirmDialog
        open={!!deleteId}
        title="מחיקת מחירון"
        message="למחוק מחירון זה? דפי נחיתה שמקשרים אליו יפסיקו לעבוד."
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {showModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl border max-w-3xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">{editId ? 'עריכת מחירון' : 'מחירון חדש'}</h2>
            <form onSubmit={saveList} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">שם מחירון *</label>
                  <input className="w-full border rounded-lg px-3 py-2 mt-1" value={listName} onChange={(e) => setListName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs text-slate-500">שם ארגון (אופציונלי)</label>
                  <input className="w-full border rounded-lg px-3 py-2 mt-1" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">מוצרים במחירון</h3>
                  <button type="button" onClick={addLine} className="text-sm text-medical-blue font-semibold">
                    + שורה
                  </button>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div>
                      <label className="text-xs text-slate-500">ספק</label>
                      <select
                        className="w-full border rounded-lg px-2 py-2 mt-1 bg-white text-sm"
                        value={line.vendorId}
                        onChange={(e) => updateLine(i, 'vendorId', e.target.value)}
                        required
                      >
                        <option value="">—</option>
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
                        className="w-full border rounded-lg px-2 py-2 mt-1 bg-white text-sm"
                        value={line.productId}
                        onChange={(e) => updateLine(i, 'productId', e.target.value)}
                        required
                      >
                        <option value="">—</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.productName || p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">מחיר קמעוני</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-2 py-2 mt-1"
                        value={line.retailPrice}
                        onChange={(e) => updateLine(i, 'retailPrice', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">עמלת סוכן (ברירת מחדל)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-2 py-2 mt-1"
                        value={line.defaultAgentCommission}
                        onChange={(e) => updateLine(i, 'defaultAgentCommission', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">עלות ספק (מהמסד)</label>
                      <input className="w-full border rounded-lg px-2 py-2 mt-1 bg-slate-50 text-sm" readOnly value={line.vendorCost} placeholder="—" />
                    </div>
                    <div>
                      <button type="button" onClick={() => removeLine(i)} className="text-red-600 text-sm py-2">
                        הסר
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {error ? <p className="text-red-600 text-sm">{error}</p> : null}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-200">
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
          מחירון זה מגדיר מספר מוצרים תחת שם אחד — משמש ליצירת{' '}
          <strong>דף נחיתה</strong> בכתובת <code className="bg-white px-1">/landing/מזהה-מחירון</code>. ודאי ש־
          <code className="bg-white px-1">VITE_API_URL</code> מצביע על שרת ה-API.
        </p>
        <div className="flex flex-wrap justify-between gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">מחירון (דפי נחיתה)</h1>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={openNew} className="px-4 py-2 rounded-lg bg-medical-blue text-white text-sm">
              + מחירון חדש
            </button>
            <Link to="/admin/vendors" className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm">
              ספקים
            </Link>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה
            </Link>
          </div>
        </div>

        {error && !showModal ? <p className="text-red-600 text-sm">{error}</p> : null}

        <div className="bg-white rounded-xl border overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-right">שם מחירון</th>
                <th className="p-2 text-right">ארגון</th>
                <th className="p-2 text-right">מוצרים</th>
                <th className="p-2 text-right">קישור דף נחיתה</th>
                <th className="p-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-medium">{row.listName}</td>
                  <td className="p-2">{row.orgName || '—'}</td>
                  <td className="p-2">{(row.lines || []).length}</td>
                  <td className="p-2">
                    <code className="text-xs bg-slate-100 px-1 rounded break-all">
                      {landingBase}/{row.id}
                    </code>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button type="button" onClick={() => openEdit(row)} className="text-medical-blue font-semibold ml-2">
                      עריכה
                    </button>
                    <button type="button" onClick={() => setDeleteId(row.id)} className="text-red-600 font-semibold">
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
              {!lists.length ? (
                <tr>
                  <td colSpan={5} className="p-6 text-slate-500 text-center">
                    אין מחירונים — צרי מחירון חדש
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
