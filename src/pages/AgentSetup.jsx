import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyForm = () => ({
  agentName: '',
  idNum: '',
  phone: '',
  email: '',
  address: '',
  bankDetails: {
    bankName: '',
    bankNum: '',
    accountHolder: '',
    branchNum: '',
    accountNum: '',
  },
  productCommissions: [],
});

function agentFromRow(r) {
  const b = r.bankDetails || {};
  const pc = Array.isArray(r.productCommissions) ? r.productCommissions : [];
  return {
    id: r.id,
    agentName: r.agentName || '',
    idNum: r.idNum || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    bankDetails: {
      bankName: b.bankName || '',
      bankNum: b.bankNum || '',
      accountHolder: b.accountHolder || '',
      branchNum: b.branchNum || '',
      accountNum: b.accountNum || '',
    },
    productCommissions: pc.map((x) => ({
      productId: x.productId || '',
      commission: String(x.commission ?? ''),
      productName: x.productName || '',
    })),
  };
}

function buildPayload(body) {
  const { productCommissions, ...rest } = body;
  const rows = Array.isArray(productCommissions)
    ? productCommissions
        .filter((x) => x.productId)
        .map((x) => ({ productId: x.productId, commission: Number(x.commission || 0) }))
    : [];
  return { ...rest, productCommissions: rows };
}

export default function AgentSetup() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editAgent, setEditAgent] = useState(null);
  const [editTab, setEditTab] = useState('details');
  const [deleteAgent, setDeleteAgent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('details');
  const [addForm, setAddForm] = useState(() => emptyForm());

  const loadAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agRes, prRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (!agRes.success) throw new Error(agRes.error || 'טעינה נכשלה');
      setRows(Array.isArray(agRes.rows) ? agRes.rows : []);
      if (prRes.success) setProducts(prRes.products || []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  function openAdd() {
    setAddForm(emptyForm());
    setAddTab('details');
    setShowAddModal(true);
  }

  function addCommissionRow(target) {
    if (target === 'add') {
      setAddForm((p) => ({ ...p, productCommissions: [...(p.productCommissions || []), { productId: '', commission: '' }] }));
    } else {
      setEditAgent((p) =>
        p ? { ...p, productCommissions: [...(p.productCommissions || []), { productId: '', commission: '' }] } : null
      );
    }
  }

  function removeCommissionRow(target, index) {
    if (target === 'add') {
      setAddForm((p) => ({
        ...p,
        productCommissions: (p.productCommissions || []).filter((_, i) => i !== index),
      }));
    } else {
      setEditAgent((p) =>
        p
          ? {
              ...p,
              productCommissions: (p.productCommissions || []).filter((_, i) => i !== index),
            }
          : null
      );
    }
  }

  async function submitAdd(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(addForm)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setShowAddModal(false);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editAgent?.id) return;
    setLoading(true);
    setError('');
    try {
      const { id, ...body } = editAgent;
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(body)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditAgent(null);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteAgent?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(deleteAgent.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteAgent(null);
      await loadAgents();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function setBank(target, field, value) {
    if (target === 'add') {
      setAddForm((prev) => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [field]: value },
      }));
    } else {
      setEditAgent((prev) =>
        prev
          ? {
              ...prev,
              bankDetails: { ...prev.bankDetails, [field]: value },
            }
          : null
      );
    }
  }

  function CommissionSection({ target, data }) {
    const list = data.productCommissions || [];
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-600">עמלה ייחודית לכל מוצר — משמשת בדוחות רווח כשהמנוי קשור לסוכן ולמוצר.</p>
          <button type="button" onClick={() => addCommissionRow(target)} className="text-sm text-medical-blue font-semibold">
            + מוצר
          </button>
        </div>
        {list.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-end border rounded-lg p-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-500">מוצר</label>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                value={row.productId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (target === 'add') {
                    setAddForm((p) => {
                      const next = [...(p.productCommissions || [])];
                      next[i] = { ...next[i], productId: v };
                      return { ...p, productCommissions: next };
                    });
                  } else {
                    setEditAgent((p) => {
                      if (!p) return null;
                      const next = [...(p.productCommissions || [])];
                      next[i] = { ...next[i], productId: v };
                      return { ...p, productCommissions: next };
                    });
                  }
                }}
              >
                <option value="">— בחרו מוצר —</option>
                {products.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.productName || pr.name} ({pr.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-500">עמלה (₪)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={row.commission}
                onChange={(e) => {
                  const v = e.target.value;
                  if (target === 'add') {
                    setAddForm((p) => {
                      const next = [...(p.productCommissions || [])];
                      next[i] = { ...next[i], commission: v };
                      return { ...p, productCommissions: next };
                    });
                  } else {
                    setEditAgent((p) => {
                      if (!p) return null;
                      const next = [...(p.productCommissions || [])];
                      next[i] = { ...next[i], commission: v };
                      return { ...p, productCommissions: next };
                    });
                  }
                }}
              />
            </div>
            <button type="button" onClick={() => removeCommissionRow(target, i)} className="text-red-600 text-sm py-2">
              הסר
            </button>
          </div>
        ))}
        {!list.length ? <p className="text-sm text-slate-400">אין מוצרים — ניתן להסתמך על עמלה ברירת מחדל במחירון</p> : null}
      </div>
    );
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
      <ConfirmDialog
        open={!!deleteAgent}
        title="מחיקת סוכן"
        message={deleteAgent ? `למחוק את "${deleteAgent.agentName}"?${deleteAgent.totalSales > 0 ? ' (לא ניתן אם יש עסקאות מקושרות)' : ''}` : ''}
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteAgent(null)}
      />

      {showAddModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl border max-w-2xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">הוספת סוכן</h2>
            <div className="flex gap-2 border-b mb-4">
              <button
                type="button"
                className={`px-4 py-2 font-semibold ${addTab === 'details' ? 'border-b-2 border-medical-blue text-medical-blue' : 'text-slate-500'}`}
                onClick={() => setAddTab('details')}
              >
                פרטים ובנק
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold ${addTab === 'products' ? 'border-b-2 border-medical-blue text-medical-blue' : 'text-slate-500'}`}
                onClick={() => setAddTab('products')}
              >
                מוצרים ועמלות
              </button>
            </div>
            <form onSubmit={submitAdd} className="space-y-4">
              {addTab === 'details' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם סוכן *"
                      value={addForm.agentName}
                      onChange={(e) => setAddForm((p) => ({ ...p, agentName: e.target.value }))}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="תעודת זהות / ח.פ *"
                      value={addForm.idNum}
                      onChange={(e) => setAddForm((p) => ({ ...p, idNum: e.target.value }))}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="טלפון"
                      value={addForm.phone}
                      onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      type="email"
                      placeholder="אימייל"
                      value={addForm.email}
                      onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                    />
                    <input
                      className="border rounded-lg px-3 py-2 md:col-span-2"
                      placeholder="כתובת"
                      value={addForm.address}
                      onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                  <h3 className="font-semibold">פרטי בנק</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם בנק *"
                      value={addForm.bankDetails.bankName}
                      onChange={(e) => setBank('add', 'bankName', e.target.value)}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="מספר בנק"
                      value={addForm.bankDetails.bankNum}
                      onChange={(e) => setBank('add', 'bankNum', e.target.value)}
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם בעל חשבון *"
                      value={addForm.bankDetails.accountHolder}
                      onChange={(e) => setBank('add', 'accountHolder', e.target.value)}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="מספר סניף"
                      value={addForm.bankDetails.branchNum}
                      onChange={(e) => setBank('add', 'branchNum', e.target.value)}
                    />
                    <input
                      className="border rounded-lg px-3 py-2 md:col-span-2"
                      placeholder="מספר חשבון"
                      value={addForm.bankDetails.accountNum}
                      onChange={(e) => setBank('add', 'accountNum', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <CommissionSection target="add" data={addForm} />
              )}
              {error ? <p className="text-red-600 text-sm">{error}</p> : null}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg bg-slate-200">
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

      {editAgent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditAgent(null)}>
          <div className="bg-white rounded-xl border max-w-2xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">עריכת סוכן</h2>
            <div className="flex gap-2 border-b mb-4">
              <button
                type="button"
                className={`px-4 py-2 font-semibold ${editTab === 'details' ? 'border-b-2 border-medical-blue text-medical-blue' : 'text-slate-500'}`}
                onClick={() => setEditTab('details')}
              >
                פרטים ובנק
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold ${editTab === 'products' ? 'border-b-2 border-medical-blue text-medical-blue' : 'text-slate-500'}`}
                onClick={() => setEditTab('products')}
              >
                מוצרים ועמלות
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              {editTab === 'details' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם סוכן *"
                      value={editAgent.agentName}
                      onChange={(e) => setEditAgent((p) => ({ ...p, agentName: e.target.value }))}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="תעודת זהות / ח.פ *"
                      value={editAgent.idNum}
                      onChange={(e) => setEditAgent((p) => ({ ...p, idNum: e.target.value }))}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="טלפון"
                      value={editAgent.phone}
                      onChange={(e) => setEditAgent((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      type="email"
                      placeholder="אימייל"
                      value={editAgent.email}
                      onChange={(e) => setEditAgent((p) => ({ ...p, email: e.target.value }))}
                    />
                    <input
                      className="border rounded-lg px-3 py-2 md:col-span-2"
                      placeholder="כתובת"
                      value={editAgent.address}
                      onChange={(e) => setEditAgent((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                  <h3 className="font-semibold">פרטי בנק</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם בנק *"
                      value={editAgent.bankDetails.bankName}
                      onChange={(e) => setBank('edit', 'bankName', e.target.value)}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="מספר בנק"
                      value={editAgent.bankDetails.bankNum}
                      onChange={(e) => setBank('edit', 'bankNum', e.target.value)}
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="שם בעל חשבון *"
                      value={editAgent.bankDetails.accountHolder}
                      onChange={(e) => setBank('edit', 'accountHolder', e.target.value)}
                      required
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="מספר סניף"
                      value={editAgent.bankDetails.branchNum}
                      onChange={(e) => setBank('edit', 'branchNum', e.target.value)}
                    />
                    <input
                      className="border rounded-lg px-3 py-2 md:col-span-2"
                      placeholder="מספר חשבון"
                      value={editAgent.bankDetails.accountNum}
                      onChange={(e) => setBank('edit', 'accountNum', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <CommissionSection target="edit" data={editAgent} />
              )}
              {error ? <p className="text-red-600 text-sm">{error}</p> : null}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditAgent(null)} className="px-4 py-2 rounded-lg bg-slate-200">
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
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">ניהול סוכנים</h1>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={openAdd} className="px-4 py-2 rounded-lg bg-medical-blue text-white text-sm font-semibold">
              + הוסף סוכן
            </button>
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          מנויים מקושרים ל־<code className="bg-slate-100 px-1 rounded">agentId</code>. עמלות למוצר נספרות בדוח &quot;מנויים&quot; (רווח = הכנסה − ספק − עמלה).
        </p>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-lg">סוכנים רשומים</h2>
            <button type="button" onClick={() => loadAgents()} className="text-sm text-medical-blue underline">
              רענון
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">שם</th>
                  <th className="p-2 text-right">ת&quot;ז / ח.פ</th>
                  <th className="p-2 text-right">טלפון</th>
                  <th className="p-2 text-right">אימייל</th>
                  <th className="p-2 text-right">מוצרים בעמלה</th>
                  <th className="p-2 text-right">סה&quot;כ מנויים</th>
                  <th className="p-2 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.agentName}</td>
                    <td className="p-2">{r.idNum}</td>
                    <td className="p-2">{r.phone}</td>
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{(r.productCommissions || []).length}</td>
                    <td className="p-2 font-bold text-medical-blue-dark">{r.totalSales ?? 0}</td>
                    <td className="p-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTab('details');
                          setEditAgent(agentFromRow(r));
                        }}
                        className="text-medical-blue font-semibold ml-2"
                      >
                        עריכה
                      </button>
                      <button type="button" onClick={() => setDeleteAgent(r)} className="text-red-600 font-semibold">
                        מחק
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-slate-500">
                      אין סוכנים
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
