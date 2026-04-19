import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const TOKEN_KEY = 'opal_admin_token';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0590-\u05FF-]/g, '')
    .slice(0, 60);
}

// ─── Step Accordion ────────────────────────────────────────────────────────────
function StepCard({ number, title, subtitle, done, locked, open, onToggle, children }) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-opacity ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-right"
        onClick={onToggle}
        disabled={locked}
      >
        <span
          className={`size-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
            ${done ? 'bg-green-600 border-green-600 text-white' : open ? 'bg-primary border-primary text-white' : 'border-slate-300 text-slate-500'}`}
        >
          {done ? <Check className="size-4" /> : number}
        </span>
        <div className="flex-1 text-start">
          <p className="font-semibold text-slate-800 text-sm sm:text-base">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {locked ? null : open ? <ChevronUp className="size-5 text-muted-foreground shrink-0" /> : <ChevronDown className="size-5 text-muted-foreground shrink-0" />}
      </button>
      {open && !locked ? (
        <div className="border-t px-4 sm:px-5 py-4 sm:py-5 space-y-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ─── Inline Preview Panel ──────────────────────────────────────────────────────
function LandingPreview({ form }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4 space-y-3 text-sm max-h-96 overflow-y-auto" dir="rtl">
      {form.imageUrl ? (
        <img src={form.imageUrl} alt="" className="w-full max-h-40 object-cover rounded-md" />
      ) : (
        <div className="w-full h-24 bg-slate-200 rounded-md flex items-center justify-center text-muted-foreground text-xs">תמונה</div>
      )}
      <h2 className="text-lg font-bold">{form.pageTitle || 'כותרת הדף'}</h2>
      {form.subTitle ? <p className="text-muted-foreground">{form.subTitle}</p> : null}
      {form.mainContent ? <p className="whitespace-pre-line text-xs">{form.mainContent}</p> : null}
      {form.whatYouGetTitle ? (
        <div className="border rounded p-3 space-y-1 bg-white">
          <p className="font-semibold">{form.whatYouGetTitle}</p>
          {form.whatYouGetSubtitle ? <p className="text-muted-foreground text-xs">{form.whatYouGetSubtitle}</p> : null}
          {(form.whatYouGetItems || []).map((item, i) => (
            <p key={i} className="text-xs flex gap-1"><span className="text-green-600">✓</span>{item}</p>
          ))}
        </div>
      ) : null}
      {form.registrationTitle ? (
        <div className="border rounded p-3 bg-primary/5">
          <p className="font-semibold">{form.registrationTitle}</p>
          {form.registrationSubtitle ? <p className="text-xs text-muted-foreground">{form.registrationSubtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function UnifiedProductWizard() {
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');

  // Reference data
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loadingRef, setLoadingRef] = useState(false);

  // Wizard state
  const [openStep, setOpenStep] = useState(1);

  // Step 1 — Vendor & Product
  const [vendorMode, setVendorMode] = useState('existing'); // 'existing' | 'new'
  const [s1, setS1] = useState({
    vendorId: '',
    vendorName: '',
    vendorIdNum: '',
    vendorPhone: '',
    vendorEmail: '',
    productName: '',
    sku: '',
    baseDescription: '',
    vendorCost: '',
  });
  const [s1Loading, setS1Loading] = useState(false);
  const [s1Error, setS1Error] = useState('');
  const [productId, setProductId] = useState('');
  const [savedVendorId, setSavedVendorId] = useState('');

  // Step 2 — Pricing
  const [s2, setS2] = useState({
    listName: '',
    retailPrice: '',
    globalCommission: '',
    vendorCost: '',
  });
  const [s2Loading, setS2Loading] = useState(false);
  const [s2Error, setS2Error] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [priceListName, setPriceListName] = useState('');

  // Step 3 — Landing Page
  const [s3, setS3] = useState({
    slug: '',
    pageTitle: '',
    subTitle: '',
    mainContent: '',
    subContent: '',
    imageUrl: '',
    whatYouGetTitle: '',
    whatYouGetSubtitle: '',
    whatYouGetItems: [''],
    registrationTitle: '',
    registrationSubtitle: '',
  });
  const [s3Loading, setS3Loading] = useState(false);
  const [s3Error, setS3Error] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Step 4 — Distribution
  const [selectedAgents, setSelectedAgents] = useState({});   // agentId → commission string
  const [selectedOrgs, setSelectedOrgs] = useState(new Set());
  const [s4Loading, setS4Loading] = useState(false);
  const [s4Error, setS4Error] = useState('');
  const [s4Done, setS4Done] = useState(false);

  // ── Load reference data ────────────────────────────────────────────────────
  const loadRef = useCallback(async () => {
    if (!token) return;
    setLoadingRef(true);
    try {
      const [vRes, prRes, agRes, orgRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/vendors`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/organizations`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      setVendors(Array.isArray(vRes?.vendors) ? vRes.vendors : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setAgents(Array.isArray(agRes?.rows) ? agRes.rows : []);
      setOrgs(Array.isArray(orgRes?.rows) ? orgRes.rows : []);
    } catch (_) {}
    finally { setLoadingRef(false); }
  }, [token]);

  useEffect(() => { loadRef(); }, [loadRef]);

  // ── Auto-fill derived fields ───────────────────────────────────────────────
  useEffect(() => {
    if (!s1.productName) return;
    setS2((p) => ({ ...p, listName: p.listName || s1.productName, vendorCost: p.vendorCost || s1.vendorCost }));
    setS3((p) => ({ ...p, slug: p.slug || slugify(s1.productName), pageTitle: p.pageTitle || s1.productName }));
  }, [s1.productName, s1.vendorCost]);

  // ── Step 1 save ───────────────────────────────────────────────────────────
  async function saveStep1() {
    setS1Error('');
    if (!s1.productName.trim()) { setS1Error('נא למלא שם מוצר'); return; }
    if (vendorMode === 'new' && !s1.vendorName.trim()) { setS1Error('נא למלא שם ספק'); return; }
    if (vendorMode === 'existing' && !s1.vendorId) { setS1Error('נא לבחור ספק'); return; }
    setS1Loading(true);
    try {
      // 1a. Create product
      const prRes = await fetch(`${API_BASE}/api/admin/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName: s1.productName.trim(),
          sku: s1.sku.trim() || slugify(s1.productName).toUpperCase(),
          baseDescription: s1.baseDescription.trim(),
          providerId: vendorMode === 'existing' ? s1.vendorId : '',
          providerCost: Number(s1.vendorCost || 0),
        }),
      });
      const prData = await prRes.json().catch(() => ({}));
      if (!prRes.ok || !prData.success) throw new Error(prData.error || 'שמירת מוצר נכשלה');
      const newProductId = prData.product?.id || prData.id || '';

      // 1b. Create vendor if new
      let resolvedVendorId = s1.vendorId;
      if (vendorMode === 'new') {
        const vRes = await fetch(`${API_BASE}/api/admin/vendors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            vendorName: s1.vendorName.trim(),
            idNum: s1.vendorIdNum.trim(),
            phone: s1.vendorPhone.trim(),
            email: s1.vendorEmail.trim(),
            address: '',
            bankName: '',
            bankNum: '',
            accountHolder: '',
            branchNum: '',
            accountNum: '',
            productLinks: newProductId ? [{ productId: newProductId, sku: s1.sku.trim(), vendorCost: Number(s1.vendorCost || 0) }] : [],
          }),
        });
        const vData = await vRes.json().catch(() => ({}));
        if (!vRes.ok || !vData.success) throw new Error(vData.error || 'שמירת ספק נכשלה');
        resolvedVendorId = vData.vendor?.id || vData.id || '';
      }

      setProductId(newProductId);
      setSavedVendorId(resolvedVendorId);
      setS2((p) => ({ ...p, vendorCost: p.vendorCost || s1.vendorCost, listName: p.listName || s1.productName }));
      await loadRef();
      setOpenStep(2);
    } catch (e) {
      setS1Error(e.message || 'שגיאה');
    } finally {
      setS1Loading(false);
    }
  }

  // ── Step 2 save ───────────────────────────────────────────────────────────
  async function saveStep2() {
    setS2Error('');
    if (!s2.listName.trim()) { setS2Error('נא למלא שם מחירון'); return; }
    if (!s2.retailPrice) { setS2Error('נא למלא מחיר קמעונאי'); return; }
    setS2Loading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/price-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          listName: s2.listName.trim(),
          orgName: '',
          lines: [{
            vendorId: savedVendorId,
            productId,
            agentId: '',
            retailPrice: Number(s2.retailPrice || 0),
            defaultAgentCommission: Number(s2.globalCommission || 0),
            vendorCost: Number(s2.vendorCost || s1.vendorCost || 0),
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירת מחירון נכשלה');
      const newPriceListId = data.priceList?.id || data.id || '';
      setPriceListId(newPriceListId);
      setPriceListName(s2.listName.trim());
      setS3((p) => ({ ...p, slug: p.slug || slugify(s2.listName), pageTitle: p.pageTitle || s2.listName }));
      setOpenStep(3);
    } catch (e) {
      setS2Error(e.message || 'שגיאה');
    } finally {
      setS2Loading(false);
    }
  }

  // ── Step 3 save ───────────────────────────────────────────────────────────
  async function saveStep3() {
    setS3Error('');
    if (!s3.slug.trim()) { setS3Error('נא למלא slug לדף'); return; }
    if (!priceListId) { setS3Error('מחירון חסר — השלם שלב 2 תחילה'); return; }
    setS3Loading(true);
    try {
      const items = (s3.whatYouGetItems || []).filter((i) => i.trim());
      const res = await fetch(`${API_BASE}/api/admin/landing-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: s3.slug.trim(),
          pageType: 'sales',
          pageTitle: s3.pageTitle.trim(),
          subTitle: s3.subTitle.trim(),
          mainContent: s3.mainContent.trim(),
          subContent: s3.subContent.trim(),
          imageUrl: s3.imageUrl,
          priceListId,
          whatYouGetTitle: s3.whatYouGetTitle.trim(),
          whatYouGetSubtitle: s3.whatYouGetSubtitle.trim(),
          whatYouGetItems: items,
          registrationTitle: s3.registrationTitle.trim(),
          registrationSubtitle: s3.registrationSubtitle.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שמירת דף נחיתה נכשלה');
      setPageSlug(s3.slug.trim());
      setOpenStep(4);
    } catch (e) {
      setS3Error(e.message || 'שגיאה');
    } finally {
      setS3Loading(false);
    }
  }

  // ── Step 4 save ───────────────────────────────────────────────────────────
  async function saveStep4() {
    setS4Error('');
    setS4Loading(true);
    try {
      const agentUpdates = Object.entries(selectedAgents)
        .filter(([, c]) => c !== undefined)
        .map(([agentId, commission]) => {
          const agent = agents.find((a) => a.id === agentId);
          if (!agent) return Promise.resolve();
          const existing = Array.isArray(agent.productCommissions) ? agent.productCommissions : [];
          const already = existing.find((x) => x.productId === productId);
          const updated = already
            ? existing.map((x) => x.productId === productId ? { ...x, commission: Number(commission || 0) } : x)
            : [...existing, { productId, commission: Number(commission || 0) }];
          const { id, ...rest } = agent;
          return fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(agentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...rest, productCommissions: updated.filter((x) => x.productId) }),
          });
        });

      const orgUpdates = Array.from(selectedOrgs).map((orgId) => {
        const org = orgs.find((o) => o.id === orgId);
        if (!org) return Promise.resolve();
        const { id, activeMemberCount, name, taxId, ...rest } = org;
        return fetch(`${API_BASE}/api/admin/organizations/${encodeURIComponent(orgId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...rest, priceListId, pricingMethod: 'priceList' }),
        });
      });

      await Promise.all([...agentUpdates, ...orgUpdates]);
      setS4Done(true);
    } catch (e) {
      setS4Error(e.message || 'שגיאה');
    } finally {
      setS4Loading(false);
    }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { setS3Error('התמונה גדולה מ-2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setS3((p) => ({ ...p, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  const publicUrl = pageSlug ? `${window.location.origin}/p/${pageSlug}` : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminPageShell>
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">הגדרת מוצר חדש</h1>
          <p className="text-muted-foreground text-sm mt-1">ספק · מוצר · מחירון · דף נחיתה · הפצה — הכל בצעד אחד</p>
        </div>

        {loadingRef ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Spinner className="size-4" />טוען נתונים…</div>
        ) : null}

        {/* ── Step 1 ── */}
        <StepCard
          number={1}
          title="ספק ומוצר"
          subtitle={productId ? `מוצר נשמר · ${s1.productName}` : 'הגדירו את הספק ופרטי המוצר'}
          done={!!productId}
          locked={false}
          open={openStep === 1}
          onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
        >
          <div className="space-y-4">
            <Field>
              <FieldLabel>ספק</FieldLabel>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVendorMode('existing')}
                  className={`flex-1 h-9 rounded-md border text-sm transition-colors ${vendorMode === 'existing' ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  ספק קיים
                </button>
                <button
                  type="button"
                  onClick={() => setVendorMode('new')}
                  className={`flex-1 h-9 rounded-md border text-sm transition-colors ${vendorMode === 'new' ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  ספק חדש
                </button>
              </div>
            </Field>

            {vendorMode === 'existing' ? (
              <Field>
                <FieldLabel>בחר ספק קיים</FieldLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                  value={s1.vendorId}
                  onChange={(e) => setS1((p) => ({ ...p, vendorId: e.target.value }))}
                >
                  <option value="">— בחר ספק —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.vendorName}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 border rounded-lg p-3 bg-slate-50">
                <Field>
                  <FieldLabel>שם ספק *</FieldLabel>
                  <Input value={s1.vendorName} onChange={(e) => setS1((p) => ({ ...p, vendorName: e.target.value }))} placeholder="שם החברה" />
                </Field>
                <Field>
                  <FieldLabel>ח.פ / ת.ז</FieldLabel>
                  <Input dir="ltr" value={s1.vendorIdNum} onChange={(e) => setS1((p) => ({ ...p, vendorIdNum: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>טלפון</FieldLabel>
                  <Input dir="ltr" value={s1.vendorPhone} onChange={(e) => setS1((p) => ({ ...p, vendorPhone: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>אימייל</FieldLabel>
                  <Input dir="ltr" type="email" value={s1.vendorEmail} onChange={(e) => setS1((p) => ({ ...p, vendorEmail: e.target.value }))} />
                </Field>
              </div>
            )}

            <div className="border-t pt-4 grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>שם מוצר *</FieldLabel>
                <Input value={s1.productName} onChange={(e) => setS1((p) => ({ ...p, productName: e.target.value }))} placeholder="למשל: ביטוח בריאות פרימיום" />
              </Field>
              <Field>
                <FieldLabel>SKU</FieldLabel>
                <Input dir="ltr" value={s1.sku} onChange={(e) => setS1((p) => ({ ...p, sku: e.target.value }))} placeholder="אוטו-מילוי אם ריק" />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel>תיאור</FieldLabel>
                <Input value={s1.baseDescription} onChange={(e) => setS1((p) => ({ ...p, baseDescription: e.target.value }))} placeholder="תיאור קצר" />
              </Field>
              <Field>
                <FieldLabel>עלות ספק (₪)</FieldLabel>
                <Input dir="ltr" type="number" min="0" step="0.01" value={s1.vendorCost} onChange={(e) => setS1((p) => ({ ...p, vendorCost: e.target.value }))} placeholder="0" />
              </Field>
            </div>

            {s1Error ? <p className="text-destructive text-sm">{s1Error}</p> : null}
            <Button type="button" onClick={saveStep1} disabled={s1Loading}>
              {s1Loading && <Spinner className="me-2" />}
              שמירה והמשך לשלב 2
            </Button>
          </div>
        </StepCard>

        {/* ── Step 2 ── */}
        <StepCard
          number={2}
          title="מחירון ועמלה"
          subtitle={priceListId ? `מחירון נשמר · ${priceListName}` : 'קבעו מחיר קמעונאי ועמלת סוכן גלובלית'}
          done={!!priceListId}
          locked={!productId}
          open={openStep === 2}
          onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
        >
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>שם מחירון *</FieldLabel>
                <Input value={s2.listName} onChange={(e) => setS2((p) => ({ ...p, listName: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>מחיר קמעונאי (₪) *</FieldLabel>
                <Input dir="ltr" type="number" min="0" step="0.01" value={s2.retailPrice} onChange={(e) => setS2((p) => ({ ...p, retailPrice: e.target.value }))} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel>עמלת סוכן גלובלית (₪)</FieldLabel>
                <Input dir="ltr" type="number" min="0" step="0.01" value={s2.globalCommission} onChange={(e) => setS2((p) => ({ ...p, globalCommission: e.target.value }))} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel>עלות ספק (₪)</FieldLabel>
                <Input dir="ltr" type="number" min="0" step="0.01" value={s2.vendorCost} onChange={(e) => setS2((p) => ({ ...p, vendorCost: e.target.value }))} placeholder="0" />
              </Field>
            </div>
          </FieldGroup>

          {s2.retailPrice && Number(s2.retailPrice) > 0 ? (
            <div className="rounded-lg bg-slate-50 border p-3 text-xs text-muted-foreground flex flex-wrap gap-4">
              <span>מחיר: <strong className="text-slate-800">₪{Number(s2.retailPrice)}</strong></span>
              {Number(s2.globalCommission) > 0 ? <span>עמלה: <strong className="text-slate-800">₪{Number(s2.globalCommission)}</strong></span> : null}
              {Number(s2.vendorCost) > 0 ? <span>עלות: <strong className="text-slate-800">₪{Number(s2.vendorCost)}</strong></span> : null}
              {Number(s2.retailPrice) > 0 && Number(s2.vendorCost) > 0 ? (
                <span>רווח גולמי: <strong className="text-green-700">₪{(Number(s2.retailPrice) - Number(s2.vendorCost) - Number(s2.globalCommission || 0)).toFixed(2)}</strong></span>
              ) : null}
            </div>
          ) : null}

          {s2Error ? <p className="text-destructive text-sm">{s2Error}</p> : null}
          <Button type="button" onClick={saveStep2} disabled={s2Loading}>
            {s2Loading && <Spinner className="me-2" />}
            שמירה והמשך לשלב 3
          </Button>
        </StepCard>

        {/* ── Step 3 ── */}
        <StepCard
          number={3}
          title="דף נחיתה"
          subtitle={pageSlug ? `פורסם · /p/${pageSlug}` : 'צרו דף נחיתה ציבורי למוצר'}
          done={!!pageSlug}
          locked={!priceListId}
          open={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>כתובת URL (slug) *</FieldLabel>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">/p/</span>
                  <Input
                    dir="ltr"
                    className="ps-8"
                    value={s3.slug}
                    onChange={(e) => setS3((p) => ({ ...p, slug: slugify(e.target.value) }))}
                    placeholder="product-name"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel>כותרת ראשית</FieldLabel>
                <Input value={s3.pageTitle} onChange={(e) => setS3((p) => ({ ...p, pageTitle: e.target.value }))} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel>כותרת משנה</FieldLabel>
                <Input value={s3.subTitle} onChange={(e) => setS3((p) => ({ ...p, subTitle: e.target.value }))} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel>תוכן ראשי</FieldLabel>
                <Textarea rows={3} value={s3.mainContent} onChange={(e) => setS3((p) => ({ ...p, mainContent: e.target.value }))} />
              </Field>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
              <p className="text-xs font-medium text-slate-700">תמונת כותרת</p>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
              {s3.imageUrl ? (
                <div className="relative inline-block">
                  <img src={s3.imageUrl} alt="" className="h-20 rounded border object-cover" />
                  <button type="button" onClick={() => setS3((p) => ({ ...p, imageUrl: '' }))} className="absolute -top-1 -end-1 size-5 rounded-full bg-white border flex items-center justify-center shadow">
                    <X className="size-3" />
                  </button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">מקס׳ 2MB</p>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-slate-700">מה תקבלו?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field>
                  <FieldLabel>כותרת</FieldLabel>
                  <Input value={s3.whatYouGetTitle} onChange={(e) => setS3((p) => ({ ...p, whatYouGetTitle: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>כותרת משנה</FieldLabel>
                  <Input value={s3.whatYouGetSubtitle} onChange={(e) => setS3((p) => ({ ...p, whatYouGetSubtitle: e.target.value }))} />
                </Field>
              </div>
              <div className="space-y-2">
                {(s3.whatYouGetItems || ['']).map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-green-600 text-sm shrink-0">✓</span>
                    <Input
                      value={item}
                      onChange={(e) => {
                        const next = [...(s3.whatYouGetItems || [''])];
                        next[idx] = e.target.value;
                        setS3((p) => ({ ...p, whatYouGetItems: next }));
                      }}
                      placeholder={`פריט ${idx + 1}`}
                    />
                    <button type="button" onClick={() => setS3((p) => ({ ...p, whatYouGetItems: (p.whatYouGetItems || []).filter((_, i) => i !== idx) }))} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setS3((p) => ({ ...p, whatYouGetItems: [...(p.whatYouGetItems || []), ''] }))}>
                  <Plus className="size-3 me-1" />
                  הוסף פריט
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>כותרת כפתור הרשמה</FieldLabel>
                <Input value={s3.registrationTitle} onChange={(e) => setS3((p) => ({ ...p, registrationTitle: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>טקסט משנה להרשמה</FieldLabel>
                <Input value={s3.registrationSubtitle} onChange={(e) => setS3((p) => ({ ...p, registrationSubtitle: e.target.value }))} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? <EyeOff className="size-4 me-2" /> : <Eye className="size-4 me-2" />}
                {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
              </Button>
            </div>

            {showPreview ? <LandingPreview form={s3} /> : null}

            {s3Error ? <p className="text-destructive text-sm">{s3Error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveStep3} disabled={s3Loading}>
                {s3Loading && <Spinner className="me-2" />}
                פרסם דף נחיתה
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpenStep(4)}>
                דלג על שלב זה
              </Button>
            </div>

            {pageSlug ? (
              <a href={`/p/${pageSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">
                <ExternalLink className="size-3.5" />
                {window.location.origin}/p/{pageSlug}
              </a>
            ) : null}
          </div>
        </StepCard>

        {/* ── Step 4 ── */}
        <StepCard
          number={4}
          title="הפצה"
          subtitle={s4Done ? 'הפצה הושלמה' : 'שייכו סוכנים וארגונים למוצר ולמחירון'}
          done={s4Done}
          locked={!priceListId}
          open={openStep === 4}
          onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">סוכנים</p>
              <p className="text-xs text-muted-foreground">בחרו סוכנים שיקבלו גישה למוצר. ניתן להגדיר עמלה ייחודית לכל סוכן (יעדכן productCommissions).</p>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין סוכנים במערכת</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {agents.map((a) => {
                    const checked = a.id in selectedAgents;
                    return (
                      <label key={a.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="size-4 rounded"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents((p) => ({ ...p, [a.id]: String(s2.globalCommission || '') }));
                            } else {
                              setSelectedAgents((p) => { const n = { ...p }; delete n[a.id]; return n; });
                            }
                          }}
                        />
                        <span className="flex-1 text-sm">{a.agentName}</span>
                        {checked ? (
                          <Input
                            type="number"
                            min="0"
                            dir="ltr"
                            className="w-24 h-7 text-xs"
                            value={selectedAgents[a.id] ?? ''}
                            placeholder="עמלה ₪"
                            onChange={(e) => setSelectedAgents((p) => ({ ...p, [a.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">ארגונים</p>
              <p className="text-xs text-muted-foreground">ארגונים שנבחרו יקושרו למחירון שנוצר בשלב 2 ({priceListName}).</p>
              {orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין ארגונים במערכת</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {orgs.map((o) => (
                    <label key={o.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={selectedOrgs.has(o.id)}
                        onChange={(e) => {
                          setSelectedOrgs((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(o.id) : next.delete(o.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 text-sm">{o.companyName}</span>
                      <Badge variant="outline" className="text-xs">{o.billingType === 'Centralized' ? 'מרוכז' : 'פרטי'}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {s4Error ? <p className="text-destructive text-sm">{s4Error}</p> : null}

            {s4Done ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-green-800 font-semibold text-sm flex items-center gap-2"><Check className="size-4" />המוצר הוגדר בהצלחה!</p>
                <div className="text-xs text-green-700 space-y-1">
                  {productId ? <p>מוצר: <span className="font-mono">{productId}</span></p> : null}
                  {priceListId ? <p>מחירון: <span className="font-mono">{priceListId}</span></p> : null}
                  {pageSlug ? (
                    <p>
                      דף נחיתה:{' '}
                      <a href={`/p/${pageSlug}`} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                        /p/{pageSlug} <ExternalLink className="size-3" />
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveStep4} disabled={s4Loading || (Object.keys(selectedAgents).length === 0 && selectedOrgs.size === 0)}>
                  {s4Loading && <Spinner className="me-2" />}
                  שמור הפצה
                </Button>
                <Button type="button" variant="ghost" onClick={() => setS4Done(true)}>
                  סיים ללא הפצה
                </Button>
              </div>
            )}
          </div>
        </StepCard>
      </div>
    </AdminPageShell>
  );
}
