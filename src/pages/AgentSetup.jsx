import React, { useMemo, useState } from 'react';
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
  personal: { name: '', idOrCompanyNum: '', phone: '', email: '', address: '' },
  bankDetails: { bankName: '', bankNumber: '', branchNumber: '', accountNumber: '', accountHolder: '' },
  commissionModel: {
    productName: PRODUCTS[0].name,
    productSKU: PRODUCTS[0].sku,
    retailPrice: '',
    vendorCost: '',
    agentCommission: '',
    baseFee: '',
  },
};

export default function AgentSetup() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const profitBeforeAgent = useMemo(() => {
    const retail = Number(form.commissionModel.retailPrice || 0);
    const vendor = Number(form.commissionModel.vendorCost || 0);
    return retail - vendor;
  }, [form.commissionModel.retailPrice, form.commissionModel.vendorCost]);

  async function loadAgents() {
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
  }

  React.useEffect(() => {
    loadAgents();
  }, [token]);

  function setProductBySku(sku) {
    const product = PRODUCTS.find((p) => p.sku === sku) || PRODUCTS[0];
    setForm((prev) => ({
      ...prev,
      commissionModel: {
        ...prev.commissionModel,
        productName: product.name,
        productSKU: product.sku,
      },
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        commissionModel: {
          ...form.commissionModel,
          retailPrice: Number(form.commissionModel.retailPrice || 0),
          vendorCost: Number(form.commissionModel.vendorCost || 0),
          profitBeforeAgent,
          agentCommission: Number(form.commissionModel.agentCommission || 0),
          baseFee: Number(form.commissionModel.baseFee || 0),
        },
      };
      const res = await fetch(`${API_BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(INITIAL_FORM);
      setStep(1);
      await loadAgents();
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
        <Link to="/admin" className="text-medical-blue underline">מעבר לכניסת מנהל</Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-medical-blue-dark">הקמת סוכן</h1>
          <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200">חזרה לניהול</Link>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStep(n)}
                className={`px-4 py-2 rounded-lg text-sm ${step === n ? 'bg-medical-blue text-white' : 'bg-slate-100'}`}
              >
                שלב {n}
              </button>
            ))}
          </div>

          {step === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2" placeholder="שם מלא" value={form.personal.name} onChange={(e) => setForm((p) => ({ ...p, personal: { ...p.personal, name: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder='ח.פ / ת"ז' value={form.personal.idOrCompanyNum} onChange={(e) => setForm((p) => ({ ...p, personal: { ...p.personal, idOrCompanyNum: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder="טלפון" value={form.personal.phone} onChange={(e) => setForm((p) => ({ ...p, personal: { ...p.personal, phone: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder="אימייל" value={form.personal.email} onChange={(e) => setForm((p) => ({ ...p, personal: { ...p.personal, email: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="כתובת" value={form.personal.address} onChange={(e) => setForm((p) => ({ ...p, personal: { ...p.personal, address: e.target.value } }))} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2" placeholder="שם הבנק" value={form.bankDetails.bankName} onChange={(e) => setForm((p) => ({ ...p, bankDetails: { ...p.bankDetails, bankName: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder="מספר בנק" value={form.bankDetails.bankNumber} onChange={(e) => setForm((p) => ({ ...p, bankDetails: { ...p.bankDetails, bankNumber: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder="מספר סניף" value={form.bankDetails.branchNumber} onChange={(e) => setForm((p) => ({ ...p, bankDetails: { ...p.bankDetails, branchNumber: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" placeholder="מספר חשבון" value={form.bankDetails.accountNumber} onChange={(e) => setForm((p) => ({ ...p, bankDetails: { ...p.bankDetails, accountNumber: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="שם בעל החשבון" value={form.bankDetails.accountHolder} onChange={(e) => setForm((p) => ({ ...p, bankDetails: { ...p.bankDetails, accountHolder: e.target.value } }))} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border rounded-lg px-3 py-2 bg-white" value={form.commissionModel.productSKU} onChange={(e) => setProductBySku(e.target.value)}>
                {PRODUCTS.map((p) => (
                  <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <input className="border rounded-lg px-3 py-2 bg-slate-50" readOnly value={form.commissionModel.productName} />
              <input className="border rounded-lg px-3 py-2" type="number" min="0" placeholder="מחיר לצרכן" value={form.commissionModel.retailPrice} onChange={(e) => setForm((p) => ({ ...p, commissionModel: { ...p.commissionModel, retailPrice: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" type="number" min="0" placeholder="מחיר לספק" value={form.commissionModel.vendorCost} onChange={(e) => setForm((p) => ({ ...p, commissionModel: { ...p.commissionModel, vendorCost: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 font-bold" readOnly value={`רווח לפני סוכן: ${profitBeforeAgent}`} />
              <input className="border rounded-lg px-3 py-2" type="number" min="0" placeholder="עמלת סוכן" value={form.commissionModel.agentCommission} onChange={(e) => setForm((p) => ({ ...p, commissionModel: { ...p.commissionModel, agentCommission: e.target.value } }))} />
              <input className="border rounded-lg px-3 py-2" type="number" min="0" placeholder="עמלת בסיס" value={form.commissionModel.baseFee} onChange={(e) => setForm((p) => ({ ...p, commissionModel: { ...p.commissionModel, baseFee: e.target.value } }))} />
            </div>
          ) : null}

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button disabled={loading} className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת סוכן'}
          </button>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-lg mb-3">סוכנים רשומים</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">שם</th>
                  <th className="p-2 text-right">ת"ז/ח.פ</th>
                  <th className="p-2 text-right">טלפון</th>
                  <th className="p-2 text-right">מוצר</th>
                  <th className="p-2 text-right">מק"ט</th>
                  <th className="p-2 text-right">רווח לפני סוכן</th>
                  <th className="p-2 text-right">עמלת סוכן</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.personal?.name || '-'}</td>
                    <td className="p-2">{r.personal?.idOrCompanyNum || '-'}</td>
                    <td className="p-2">{r.personal?.phone || '-'}</td>
                    <td className="p-2">{r.commissionModel?.productName || '-'}</td>
                    <td className="p-2">{r.commissionModel?.productSKU || '-'}</td>
                    <td className="p-2">{r.commissionModel?.profitBeforeAgent ?? 0}</td>
                    <td className="p-2">{r.commissionModel?.agentCommission ?? 0}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={7} className="p-3 text-slate-500">אין סוכנים להצגה</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
