import React from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const TOKEN_KEY = 'opal_admin_token';

const emptyLink = () => ({ productId: '', sku: '', vendorCost: '' });

const emptyVendor = {
  vendorName: '',
  idNum: '',
  phone: '',
  email: '',
  address: '',
  bankName: '',
  bankNum: '',
  accountHolder: '',
  branchNum: '',
  accountNum: '',
};

function vendorToEditForm(v) {
  const links = (v.productLinks || []).length
    ? v.productLinks.map((l) => ({
        productId: l.productId,
        sku: l.sku || l.product?.sku || '',
        vendorCost: String(l.vendorCost ?? ''),
      }))
    : [emptyLink()];
  return {
    id: v.id,
    vendorName: v.vendorName,
    idNum: v.idNum,
    phone: v.phone || '',
    email: v.email || '',
    address: v.address || '',
    bankName: v.bankName || '',
    bankNum: v.bankNum || '',
    accountHolder: v.accountHolder || '',
    branchNum: v.branchNum || '',
    accountNum: v.accountNum || '',
    productLinks: links,
  };
}

export default function VendorDashboard() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [form, setForm] = React.useState(emptyVendor);
  const [productLinks, setProductLinks] = React.useState([emptyLink()]);
  const [products, setProducts] = React.useState([]);
  const [vendors, setVendors] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editVendor, setEditVendor] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  async function loadProducts() {
    const res = await fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) setProducts(Array.isArray(data.products) ? data.products : []);
  }

  async function loadVendors() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'טעינה נכשלה');
      setVendors(Array.isArray(data.vendors) ? data.vendors : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!token) return;
    loadProducts();
    loadVendors();
  }, [token]);

  function onProductSelect(index, productId, isEdit) {
    const p = products.find((x) => x.id === productId);
    if (isEdit) {
      setEditVendor((prev) => {
        const lines = [...prev.productLinks];
        lines[index] = { ...lines[index], productId, sku: p ? p.sku : '' };
        return { ...prev, productLinks: lines };
      });
    } else {
      setProductLinks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], productId, sku: p ? p.sku : '' };
        return next;
      });
    }
  }

  function updateLink(index, field, value, isEdit) {
    const setter = isEdit ? setEditVendor : setProductLinks;
    setter((prev) => {
      if (isEdit) {
        const lines = [...prev.productLinks];
        lines[index] = { ...lines[index], [field]: value };
        return { ...prev, productLinks: lines };
      }
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const links = productLinks
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          vendorCost: Number(l.vendorCost || 0),
        }));
      const res = await fetch(`${API_BASE}/api/admin/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, productLinks: links }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירה נכשלה');
      setForm(emptyVendor);
      setProductLinks([emptyLink()]);
      await loadVendors();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editVendor?.id) return;
    setLoading(true);
    setError('');
    try {
      const links = editVendor.productLinks
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          vendorCost: Number(l.vendorCost || 0),
        }));
      const res = await fetch(`${API_BASE}/api/admin/vendors/${editVendor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendorName: editVendor.vendorName,
          idNum: editVendor.idNum,
          phone: editVendor.phone,
          email: editVendor.email,
          address: editVendor.address,
          bankName: editVendor.bankName,
          bankNum: editVendor.bankNum,
          accountHolder: editVendor.accountHolder,
          branchNum: editVendor.branchNum,
          accountNum: editVendor.accountNum,
          productLinks: links,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'עדכון נכשל');
      setEditVendor(null);
      await loadVendors();
    } catch (e2) {
      setError(e2.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'מחיקה נכשלה');
      setDeleteTarget(null);
      await loadVendors();
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
        open={!!deleteTarget}
        title="מחיקת ספק"
        message={deleteTarget ? `למחוק את "${deleteTarget.vendorName}"?` : ''}
        confirmLabel="מחק"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {editVendor ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditVendor(null)}>
          <div className="bg-white rounded-xl border max-w-3xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">עריכת ספק</h2>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2" placeholder="שם ספק *" value={editVendor.vendorName} onChange={(e) => setEditVendor((p) => ({ ...p, vendorName: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2" placeholder="ח.פ *" value={editVendor.idNum} onChange={(e) => setEditVendor((p) => ({ ...p, idNum: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2" placeholder="טלפון" value={editVendor.phone} onChange={(e) => setEditVendor((p) => ({ ...p, phone: e.target.value }))} />
                <input className="border rounded-lg px-3 py-2" type="email" placeholder="אימייל" value={editVendor.email} onChange={(e) => setEditVendor((p) => ({ ...p, email: e.target.value }))} />
                <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="כתובת" value={editVendor.address} onChange={(e) => setEditVendor((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <h3 className="font-semibold">בנק</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2" value={editVendor.bankName} onChange={(e) => setEditVendor((p) => ({ ...p, bankName: e.target.value }))} placeholder="שם בנק" />
                <input className="border rounded-lg px-3 py-2" value={editVendor.bankNum} onChange={(e) => setEditVendor((p) => ({ ...p, bankNum: e.target.value }))} placeholder="מספר בנק" />
                <input className="border rounded-lg px-3 py-2" value={editVendor.accountHolder} onChange={(e) => setEditVendor((p) => ({ ...p, accountHolder: e.target.value }))} placeholder="בעל חשבון" />
                <input className="border rounded-lg px-3 py-2" value={editVendor.branchNum} onChange={(e) => setEditVendor((p) => ({ ...p, branchNum: e.target.value }))} placeholder="סניף" />
                <input className="border rounded-lg px-3 py-2 md:col-span-2" value={editVendor.accountNum} onChange={(e) => setEditVendor((p) => ({ ...p, accountNum: e.target.value }))} placeholder="מספר חשבון" />
              </div>
              <h3 className="font-semibold">מוצרים</h3>
              {editVendor.productLinks.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
                  <div className="md:col-span-5">
                    <label className="text-xs text-slate-500">מוצר</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={line.productId}
                      onChange={(e) => onProductSelect(idx, e.target.value, true)}
                    >
                      <option value="">— בחרו —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productName || p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-500">מק&quot;ט</label>
                    <input className="w-full border rounded-lg px-3 py-2 bg-white" readOnly value={line.sku} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-500">מחיר לספק</label>
                    <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2" value={line.vendorCost} onChange={(e) => updateLink(idx, 'vendorCost', e.target.value, true)} />
                  </div>
                  <div className="md:col-span-1">
                    <button
                      type="button"
                      className="text-red-600 text-sm"
                      onClick={() =>
                        setEditVendor((ev) => ({
                          ...ev,
                          productLinks: ev.productLinks.length <= 1 ? ev.productLinks : ev.productLinks.filter((_, i) => i !== idx),
                        }))
                      }
                      disabled={editVendor.productLinks.length <= 1}
                    >
                      הסר
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="text-medical-blue text-sm font-semibold"
                onClick={() => setEditVendor((ev) => ({ ...ev, productLinks: [...ev.productLinks, emptyLink()] }))}
              >
                + שורת מוצר
              </button>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setEditVendor(null)} className="px-4 py-2 rounded-lg bg-slate-200">
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
        <div className="flex flex-wrap justify-between gap-2">
          <h1 className="text-2xl font-bold text-medical-blue-dark">הקמת ספק</h1>
          <div className="flex gap-2 flex-wrap">
            <Link to="/admin/products" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm">
              מוצרים
            </Link>
            <Link to="/admin/price-list" className="px-4 py-2 rounded-lg bg-medical-blue-dark text-white text-sm">
              מחירון
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg bg-slate-200 text-sm">
              חזרה
            </Link>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold">פרטי ספק</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2" placeholder="שם ספק *" value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} required />
            <input className="border rounded-lg px-3 py-2" placeholder="ח.פ / מספר זיהוי *" value={form.idNum} onChange={(e) => setForm((p) => ({ ...p, idNum: e.target.value }))} required />
            <input className="border rounded-lg px-3 py-2" placeholder="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2" placeholder="אימייל" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="כתובת" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <h3 className="font-semibold pt-2">פרטי בנק</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2" placeholder="שם בנק" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2" placeholder="מספר בנק" value={form.bankNum} onChange={(e) => setForm((p) => ({ ...p, bankNum: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2" placeholder="שם בעל חשבון" value={form.accountHolder} onChange={(e) => setForm((p) => ({ ...p, accountHolder: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2" placeholder="מספר סניף" value={form.branchNum} onChange={(e) => setForm((p) => ({ ...p, branchNum: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="מספר חשבון" value={form.accountNum} onChange={(e) => setForm((p) => ({ ...p, accountNum: e.target.value }))} />
          </div>

          <h3 className="font-semibold pt-2">שיוך מוצרים ומחיר תשלום לספק</h3>
          <p className="text-sm text-slate-600">בחרו מוצר מהרשימה — מק&quot;ט יימשך אוטומטית.</p>
          {productLinks.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-slate-50">
              <div className="md:col-span-5">
                <label className="text-xs text-slate-500">מוצר</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-white" value={line.productId} onChange={(e) => onProductSelect(idx, e.target.value, false)}>
                  <option value="">— בחרו —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName || p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-slate-500">מק&quot;ט</label>
                <input className="w-full border rounded-lg px-3 py-2 bg-white" readOnly value={line.sku} placeholder="אוטומטי" />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-slate-500">מחיר תשלום לספק (₪)</label>
                <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2" value={line.vendorCost} onChange={(e) => updateLink(idx, 'vendorCost', e.target.value, false)} />
              </div>
              <div className="md:col-span-1">
                <button type="button" className="text-red-600 text-sm" onClick={() => setProductLinks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))} disabled={productLinks.length <= 1}>
                  הסר
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="text-medical-blue text-sm font-semibold" onClick={() => setProductLinks((p) => [...p, emptyLink()])}>
            + שורת מוצר
          </button>

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-medical-blue text-white">
            {loading ? 'שומר...' : 'שמירת ספק'}
          </button>
        </form>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-lg mb-3">ספקים שמורים</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-right">שם ספק</th>
                  <th className="p-2 text-right">ח.פ</th>
                  <th className="p-2 text-right">טלפון</th>
                  <th className="p-2 text-right">מוצרים / עלות</th>
                  <th className="p-2 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-t align-top">
                    <td className="p-2">{v.vendorName}</td>
                    <td className="p-2">{v.idNum}</td>
                    <td className="p-2">{v.phone}</td>
                    <td className="p-2 text-xs">
                      <ul className="space-y-1">
                        {(v.productLinks || []).map((l, i) => (
                          <li key={i}>
                            {l.product?.productName || l.sku}: ₪{l.vendorCost} (מק&quot;ט {l.sku})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <button type="button" onClick={() => setEditVendor(vendorToEditForm(v))} className="text-medical-blue font-semibold ml-2">
                        עריכה
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(v)} className="text-red-600 font-semibold">
                        מחק
                      </button>
                    </td>
                  </tr>
                ))}
                {!vendors.length ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-slate-500">
                      אין ספקים
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
