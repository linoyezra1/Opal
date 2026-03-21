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
});

function agentFromRow(r) {
  const b = r.bankDetails || {};
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
  };
}

export default function AgentSetup() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = useState(() => emptyForm());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editAgent, setEditAgent] = useState(null);
  const [deleteAgent, setDeleteAgent] = useState(null);

  const loadAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינה נכשלה');
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(emptyForm());
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
        body: JSON.stringify(body),
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
    if (target === 'form') {
      setForm((prev) => ({
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

      {editAgent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditAgent(null)}>
          <div className="bg-white rounded-xl border max-w-2xl w-full p-6 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">עריכת סוכן</h2>
            <form onSubmit={saveEdit} className="space-y-4">
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
          <h1 className="text-2xl font-bold text-medical-blue-dark">הקמת סוכן</h1>
          <div className="flex gap-2">
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה לניהול
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          מכירות מחושבות לפי עסקאות (מנויים) ב-MongoDB עם <code className="bg-slate-100 px-1 rounded">agentId</code> שמקושר לסוכן.
        </p>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">פרטי סוכן</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2" placeholder="שם סוכן *" value={form.agentName} onChange={(e) => setForm((p) => ({ ...p, agentName: e.target.value }))} required />
            <input className="border rounded-lg px-3 py-2" placeholder="תעודת זהות / ח.פ *" value={form.idNum} onChange={(e) => setForm((p) => ({ ...p, idNum: e.target.value }))} required />
            <input className="border rounded-lg px-3 py-2" placeholder="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2" type="email" placeholder="אימייל" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="כתובת" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <h3 className="font-semibold">פרטי בנק</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2" placeholder="שם בנק *" value={form.bankDetails.bankName} onChange={(e) => setBank('form', 'bankName', e.target.value)} required />
            <input className="border rounded-lg px-3 py-2" placeholder="מספר בנק" value={form.bankDetails.bankNum} onChange={(e) => setBank('form', 'bankNum', e.target.value)} />
            <input className="border rounded-lg px-3 py-2" placeholder="שם בעל חשבון *" value={form.bankDetails.accountHolder} onChange={(e) => setBank('form', 'accountHolder', e.target.value)} required />
            <input className="border rounded-lg px-3 py-2" placeholder="מספר סניף" value={form.bankDetails.branchNum} onChange={(e) => setBank('form', 'branchNum', e.target.value)} />
            <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="מספר חשבון" value={form.bankDetails.accountNum} onChange={(e) => setBank('form', 'accountNum', e.target.value)} />
          </div>
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת סוכן'}
          </button>
        </form>

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
                  <th className="p-2 text-right">סה&quot;כ מכירות (מנויים)</th>
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
                    <td className="p-2 font-bold text-medical-blue-dark">{r.totalSales ?? 0}</td>
                    <td className="p-2 whitespace-nowrap">
                      <button type="button" onClick={() => setEditAgent(agentFromRow(r))} className="text-medical-blue font-semibold ml-2">
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
                    <td colSpan={6} className="p-4 text-slate-500">
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
