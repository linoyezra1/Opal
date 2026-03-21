import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';

const LANDING_COPY =
  'רופא פרטי עד הבית 24/7 בפחות מ-1 ₪ ליום. כשאתה צריך רופא, אתה צריך אותו עכשיו — ביטחון וטיפול מקצועי אצלך בבית.';

function validatePhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

function validateId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 9;
}

const DEFAULT_ID = '123456782';

export default function LandingPage() {
  const { priceListId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ctx, setCtx] = useState(null);
  const [publicAgents, setPublicAgents] = useState([]);
  const [productId, setProductId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNum, setIdNum] = useState(DEFAULT_ID);
  const [agentId, setAgentId] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!priceListId) return;
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`${API_BASE}/api/public/price-list/${encodeURIComponent(priceListId)}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/public/agents`).then((r) => r.json()),
    ])
      .then(([pl, ag]) => {
        if (!pl.success) throw new Error(pl.error || 'מחירון לא נמצא');
        setCtx(pl);
        if (ag.success && Array.isArray(ag.agents)) setPublicAgents(ag.agents);
      })
      .catch((e) => setError(e.message || 'שגיאה'))
      .finally(() => setLoading(false));
  }, [priceListId]);

  const selectedProduct = useMemo(() => {
    if (!ctx?.products?.length || !productId) return null;
    return ctx.products.find((p) => p.productId === productId) || null;
  }, [ctx, productId]);

  const handlePay = useCallback(
    async (e) => {
      e.preventDefault();
      setSubmitError(null);
      if (!productId) {
        setSubmitError('נא לבחור מסלול');
        return;
      }
      if (!fullName.trim()) {
        setSubmitError('נא למלא שם מלא');
        return;
      }
      if (!validatePhone(phone)) {
        setSubmitError('נא למלא טלפון תקין');
        return;
      }
      if (!validateId(idNum)) {
        setSubmitError('תעודת זהות לא תקינה');
        return;
      }
      if (publicAgents.length > 0 && !agentId) {
        setSubmitError('נא לבחור סוכן');
        return;
      }
      const agent = publicAgents.find((a) => a.id === agentId);
      const formState = {
        selectedPlanId: `pl-${productId}`,
        priceListId,
        productId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        id: idNum.replace(/\D/g, ''),
        email: 'landing@opal.local',
        organizationName: 'לקוח פרטי',
        agentId: agentId || '',
        agentName: agent?.agentName || '',
        beneficiaryCount: 0,
        beneficiaries: [],
        landingFlow: true,
      };

      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formState }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubmitError(data.error || 'שגיאה ביצירת תשלום');
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setSubmitError('לא התקבל קישור לתשלום');
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת');
      } finally {
        setSubmitting(false);
      }
    },
    [productId, fullName, phone, idNum, agentId, publicAgents, priceListId]
  );

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-medical-blue-dark">טוען דף נחיתה…</p>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-lg mx-auto bg-white rounded-xl border p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'לא נמצא מחירון'}</p>
          <Link to="/" className="text-medical-blue underline">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#D9EAF3] to-slate-100 text-right">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <header className="bg-[#0F6B72] rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">{ctx.listName}</h1>
          {ctx.organizationName ? <p className="mt-2 text-white/90">{ctx.organizationName}</p> : null}
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-lg text-slate-800 leading-relaxed whitespace-pre-line">{LANDING_COPY}</p>
        </section>

        <form onSubmit={handlePay} className="space-y-6">
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#0F6B72] mb-4">בחירת מסלול</h2>
            <div className="space-y-3">
              {ctx.products.map((p) => (
                <label
                  key={p.productId}
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border cursor-pointer ${
                    productId === p.productId ? 'border-[#0F6B72] bg-[#e8f5f6]' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="plan"
                      checked={productId === p.productId}
                      onChange={() => setProductId(p.productId)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{p.productName}</div>
                      {p.baseDescription ? <p className="text-sm text-slate-600 mt-1">{p.baseDescription}</p> : null}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#0F6B72]">₪{Number(p.retailPrice || 0)}</div>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-[#0F6B72]">פרטים לתשלום</h2>
            <div>
              <label className="text-xs text-slate-500">שם מלא *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">טלפון *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">תעודת זהות *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={idNum}
                onChange={(e) => setIdNum(e.target.value)}
                required
              />
            </div>
            {publicAgents.length > 0 ? (
              <div>
                <label className="text-xs text-slate-500">סוכן *</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-white"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                >
                  <option value="">— בחרו סוכן —</option>
                  {publicAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.agentName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {submitError ? <p className="text-red-600 text-sm">{submitError}</p> : null}
            <button
              type="submit"
              disabled={submitting || !selectedProduct}
              className="w-full py-3 rounded-xl bg-[#22A8AE] text-white font-bold text-lg disabled:opacity-50"
            >
              {submitting ? 'מעביר לתשלום…' : 'המשך לתשלום מאובטח'}
            </button>
            <p className="text-xs text-slate-500 text-center">מועברים לסביבת בדיקות Cardcom — אחרי תשלום מוצלח: דף תודה</p>
          </section>
        </form>

        <div className="text-center">
          <Link to="/" className="text-sm text-slate-600 underline">
            דף הבית
          </Link>
        </div>
      </main>
    </div>
  );
}
