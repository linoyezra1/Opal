import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Archive, Check, ChevronDown, ChevronUp, Clock, Copy, ExternalLink, Eye, EyeOff,
  Heart, Info, Pencil, Phone, Plus, Shield, Star, Users, Pill, Stethoscope, Syringe, FileText, X,
  Loader2,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import { isExpired, parseLocalStartOfDay, parseLocalEndOfDay } from '../utils/dateUtils.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Textarea } from '../components/ui/textarea.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.jsx';
import { slugify } from '../utils/stringUtils.js';

// ─── Constants ──────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'opal_admin_token';
const DRAFT_KEY = 'opal_wizard_draft';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const LOCKED_FLOW_TYPE = 'רופא עד הבית';

const DEFAULT_WHAT_YOU_GET = [
  { icon: 'phone',       title: 'ייעוץ רפואי טלפוני 24/7',        description: 'שיחה עם רופא מוסמך בכל שעה ביום ובלילה' },
  { icon: 'users',       title: 'הפניות לרופאים מומחים',           description: 'גישה מהירה לרופאים מומחים בכל התחומים' },
  { icon: 'pill',        title: 'מרשמים ותרופות',                  description: 'קבלת מרשמים לתרופות ללא צורך בהמתנה' },
  { icon: 'stethoscope', title: 'בדיקה גופנית ואבחון',             description: 'בדיקה רפואית מקיפה בנוחות הבית שלך' },
  { icon: 'syringe',     title: 'זריקות (וולטרן, פרמין)',          description: 'מתן זריקות על ידי צוות רפואי מקצועי' },
  { icon: 'file',        title: 'הפניות לחדר מיון (טופס 17)',      description: 'הנפקת טופס 17 להפניה לחדר מיון במידת הצורך' },
];
const DEFAULT_SUBTITLE = 'יעוץ טלפוני בתחום רפואת המשפחה';
const DEFAULT_MAIN = `כשאתה צריך רופא, אתה צריך אותו עכשיו. במקום להמתין ימים ארוכים בתסכול, אצלנו תקבל ביטחון וטיפול מקצועי ומנוסה אצלך בבית עוד היום.. ללא עיכובים מיותרים`;

const PREVIEW_ICON_MAP = {
  phone: Phone, users: Users, pill: Pill,
  stethoscope: Stethoscope, syringe: Syringe, file: FileText,
};

const STATIC_BENEFITS = [
  { icon: Clock,  title: 'זמינות 24/7',  description: 'שירות רפואי בכל שעה, כל יום' },
  { icon: Heart,  title: 'טיפול אישי',   description: 'רופאים מנוסים עד הבית' },
  { icon: Shield, title: 'מקצועיות',     description: 'צוות רפואי מוסמך ואמין' },
  { icon: Star,   title: 'מחיר הוגן',    description: 'פחות משקל ליום' },
];

// ─── Initial state factories ────────────────────────────────────────────────────
const INIT_S1 = () => ({
  vendorId: '',
  vendorName: '', vendorIdNum: '', vendorPhone: '', vendorEmail: '',
  existingProductId: '',
  productName: '', sku: '', baseDescription: '',
  vendorCost: '',
  flowType: LOCKED_FLOW_TYPE,
  defaultBeneficiaryCount: 1,
  productImages: ['', '', '', ''],
});
const INIT_S2 = () => ({ listName: '', retailPrice: '', globalCommission: '', vendorCost: '' });
const INIT_S3 = () => ({
  slug: '', pageTitle: '',
  subTitle: DEFAULT_SUBTITLE,
  mainContent: DEFAULT_MAIN,
  subContent: '',
  imageUrl: '',
  galleryImages: ['', '', '', ''],
  validFrom: '',
  validTo: '',
  whatYouGetTitle: '', whatYouGetSubtitle: '',
  whatYouGetItems: DEFAULT_WHAT_YOU_GET,
  registrationTitle: '', registrationSubtitle: '',
  skipLanding: false,
});
const INIT_COMMITTED = () => ({ vendorId: '', productId: '', priceListId: '', priceListName: '', slug: '' });

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function friendlyError(msg) {
  if (/providerId/i.test(msg)) return 'חובה לבחור או להקים ספק לפני שמירת המוצר';
  return msg || 'שגיאה';
}

// ─── StepCard ────────────────────────────────────────────────────────────────────
function StepCard({ number, title, subtitle, done, locked, open, onToggle, children }) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-opacity ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-right"
        onClick={onToggle}
        disabled={locked}
      >
        <span className={`size-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
          ${done ? 'bg-green-600 border-green-600 text-white' : open ? 'bg-primary border-primary text-white' : 'border-slate-300 text-slate-500'}`}>
          {done ? <Check className="size-4" /> : number}
        </span>
        <div className="flex-1 text-start">
          <p className="font-semibold text-slate-800 text-sm sm:text-base">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {locked ? null : open
          ? <ChevronUp className="size-5 text-muted-foreground shrink-0" />
          : <ChevronDown className="size-5 text-muted-foreground shrink-0" />}
      </button>
      {open && !locked ? (
        <div className="border-t px-4 sm:px-5 py-4 sm:py-5 space-y-4">{children}</div>
      ) : null}
    </div>
  );
}

// ─── LandingPreview ───────────────────────────────────────────────────────────────
function LandingPreview({ form, retailPrice }) {
  const validItems = (form.whatYouGetItems || []).filter((i) => i.title?.trim());
  const whatYouGetTitle = form.whatYouGetTitle?.trim() || 'מה אתם מקבלים?';
  const whatYouGetSubtitle = form.whatYouGetSubtitle?.trim() || 'חבילת שירותים רפואיים מקיפה';
  return (
    <div dir="rtl" className="rounded-xl border border-slate-200 overflow-hidden bg-white text-right text-sm" style={{ maxHeight: 540, overflowY: 'auto' }}>
      <section className="bg-gradient-to-b from-[#D9EAF3]/40 via-white to-white px-4 py-6">
        <div className="grid sm:grid-cols-2 gap-4 items-center">
          <div className="space-y-2 order-2 sm:order-1">
            {form.subTitle ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-medium">{form.subTitle}</span>
            ) : null}
            <h1 className="text-lg font-bold leading-tight">{form.pageTitle || 'כותרת הדף'}</h1>
            {form.mainContent ? <p className="text-xs text-muted-foreground whitespace-pre-line">{form.mainContent}</p> : null}
            <div className="flex gap-2 pt-1">
              <span className="inline-flex items-center h-7 px-3 rounded-md bg-primary text-white text-xs font-medium">בחירת מסלול</span>
              <span className="inline-flex items-center h-7 px-3 rounded-md border border-slate-200 text-xs font-medium">הרשמה לשירות</span>
            </div>
          </div>
          <div className="order-1 sm:order-2">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-36" />
            ) : (
              <div className="w-full rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center h-28 text-muted-foreground text-xs">תמונת מוצר</div>
            )}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 border-y px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATIC_BENEFITS.map((b) => (
            <div key={b.title} className="flex items-center gap-2 bg-white rounded-lg border p-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><b.icon className="size-3.5" /></div>
              <div><p className="text-xs font-semibold leading-none">{b.title}</p><p className="text-[10px] text-muted-foreground">{b.description}</p></div>
            </div>
          ))}
        </div>
      </section>
      {validItems.length > 0 ? (
        <section className="px-4 py-5">
          <div className="text-center mb-4">
            <h2 className="text-base font-bold">{whatYouGetTitle}</h2>
            <p className="text-xs text-muted-foreground mt-1">{whatYouGetSubtitle}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {validItems.map((item, i) => {
              const Ico = PREVIEW_ICON_MAP[item.icon] || Phone;
              return (
                <div key={i} className="border rounded-xl bg-card p-3">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-[#D9EAF3]"><Ico className="size-4 text-primary" /></div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  {item.description ? <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {retailPrice ? (
        <section className="px-4 py-4 bg-slate-50 border-t">
          <div className="max-w-xs mx-auto border-2 border-primary/30 rounded-xl bg-white p-4 text-center shadow-sm">
            <h3 className="font-semibold text-sm">{form.pageTitle || 'מסלול ראשי'}</h3>
            <div className="my-2"><span className="text-3xl font-bold">₪{Number(retailPrice)}</span><span className="text-muted-foreground text-xs"> / חודש</span></div>
            <span className="inline-flex items-center h-8 px-4 rounded-md bg-primary text-white text-xs font-medium w-full justify-center">בחר מסלול</span>
          </div>
        </section>
      ) : null}
      <section className="px-4 py-5 border-t bg-gradient-to-b from-slate-50/50 to-white">
        <div className="text-center mb-3">
          <h2 className="text-base font-bold">{form.registrationTitle || 'הרשמה לשירות'}</h2>
          {form.registrationSubtitle ? <p className="text-xs text-muted-foreground mt-1">{form.registrationSubtitle}</p> : null}
        </div>
        <div className="max-w-xs mx-auto border rounded-xl bg-white overflow-hidden">
          <div className="bg-[#D9EAF3]/30 border-b px-3 py-2 text-xs font-medium text-center">טופס הרשמה ותשלום</div>
          <div className="p-3 space-y-2">
            {['שם מלא', 'טלפון', 'דוא"ל'].map((label) => (
              <div key={label}>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{label} *</p>
                <div className="h-7 rounded-md border bg-slate-50" />
              </div>
            ))}
            <div className="mt-2 h-9 rounded-md bg-primary/80 flex items-center justify-center text-white text-xs font-medium">המשך לתשלום מאובטח</div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function UnifiedProductWizard() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const draftTimer = useRef(null);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [landingPages, setLandingPages] = useState([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubMode, setHubMode] = useState('hub');
  const [hubFilterFrom, setHubFilterFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [hubFilterTo, setHubFilterTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [hubSearch, setHubSearch] = useState('');
  const [copiedSlug, setCopiedSlug] = useState('');

  // ── Wizard UI ──────────────────────────────────────────────────────────────
  const [openStep, setOpenStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [draftReady, setDraftReady] = useState(false); // true once initial load check is done

  // ── Step modes ─────────────────────────────────────────────────────────────
  const [vendorMode, setVendorMode] = useState('existing');
  const [productMode, setProductMode] = useState('new');

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  const [s1, setS1] = useState(INIT_S1);
  const [s1Error, setS1Error] = useState('');

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  const [s2, setS2] = useState(INIT_S2);
  const [s2Error, setS2Error] = useState('');

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  const [s3, setS3] = useState(INIT_S3);
  const [s3Error, setS3Error] = useState('');

  // ── Step 4 / Distribution ──────────────────────────────────────────────────
  const [selectedAgents, setSelectedAgents] = useState({});
  const [copiedAgentId, setCopiedAgentId] = useState('');

  // ── Committed IDs (for idempotent upsert on retry) ─────────────────────────
  const [committed, setCommitted] = useState(INIT_COMMITTED);

  // ── Finalize state ─────────────────────────────────────────────────────────
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const [finalizeProgress, setFinalizeProgress] = useState('');
  const [finalizeDone, setFinalizeDone] = useState(false);

  // ── Load reference data ─────────────────────────────────────────────────────
  const loadRef = useCallback(async () => {
    if (!token) return;
    setLoadingRef(true);
    try {
      const [vRes, prRes, agRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/vendors`,       { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/products`,       { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/agents`,         { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      setVendors(Array.isArray(vRes?.vendors)   ? vRes.vendors   : []);
      setProducts(Array.isArray(prRes?.products) ? prRes.products : []);
      setAgents(Array.isArray(agRes?.rows)      ? agRes.rows      : []);
    } catch (_) {}
    finally { setLoadingRef(false); }
  }, [token]);

  const loadLandingPages = useCallback(async () => {
    if (!token) return;
    setHubLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/landing-pages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      setLandingPages(Array.isArray(data?.pages) ? data.pages : []);
    } catch {
      setLandingPages([]);
    } finally {
      setHubLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRef(); loadLandingPages(); }, [loadRef, loadLandingPages]);

  // ── Draft: load on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.s1?.productName) {
          setPendingDraft(d);
          setShowDraftPrompt(true);
        }
      }
    } catch (_) {}
    setDraftReady(true);
  }, []);

  // ── Draft: save on every relevant state change ──────────────────────────────
  useEffect(() => {
    if (!draftReady) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const draft = {
        vendorMode, productMode, s1, s2, s3,
        selectedAgents,
        committed,
        openStep,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 300);
  }, [vendorMode, productMode, s1, s2, s3, selectedAgents, committed, openStep, draftReady]);

  // ── Auto-derive s2/s3 fields when productName or vendorCost changes ──────────
  useEffect(() => {
    if (!s1.productName) return;
    setS2((p) => ({
      ...p,
      listName: p.listName || s1.productName,
      vendorCost: s1.vendorCost,
    }));
    setS3((p) => ({
      ...p,
      slug: p.slug || slugify(s1.productName),
      pageTitle: p.pageTitle || s1.productName,
    }));
  }, [s1.productName, s1.vendorCost]);

  // ── Auto-populate s1 when existing product selected ─────────────────────────
  useEffect(() => {
    if (productMode !== 'existing' || !s1.existingProductId) return;
    const found = products.find((p) => p.id === s1.existingProductId);
    if (!found) return;
    setVendorMode('existing');
    const billingVendor = (vendors || []).find((v) => String(v.vendorName || '').includes('בילדינג'));
    setS1((p) => ({
      ...p,
      vendorId: found.providerId || billingVendor?.id || p.vendorId,
      productName: found.productName || found.name || p.productName,
      sku: found.sku || p.sku,
      baseDescription: found.baseDescription || found.description || p.baseDescription,
      vendorCost: String(found.providerCost ?? found.vendorCost ?? p.vendorCost),
      flowType: LOCKED_FLOW_TYPE,
      defaultBeneficiaryCount: Number(found.defaultBeneficiaryCount || 1),
    }));
  }, [s1.existingProductId, productMode, products, vendors]);

  function startNewWizard() {
    setHubMode('wizard');
    setOpenStep(1);
  }

  async function editLandingPage(page) {
    // Always populate S3 first — all landing page content fields
    setS3({
      slug: String(page.slug || ''),
      pageTitle: String(page.pageTitle || ''),
      subTitle: String(page.subTitle || ''),
      mainContent: String(page.mainContent || ''),
      subContent: String(page.subContent || ''),
      imageUrl: String(page.imageUrl || ''),
      galleryImages: Array.isArray(page.galleryImages)
        ? [...page.galleryImages, '', '', '', ''].slice(0, 4)
        : [String(page.imageUrl || ''), '', '', ''],
      validFrom: String(page.validFrom || ''),
      validTo: String(page.validTo || ''),
      whatYouGetTitle: String(page.whatYouGetTitle || ''),
      whatYouGetSubtitle: String(page.whatYouGetSubtitle || ''),
      whatYouGetItems: Array.isArray(page.whatYouGetItems) && page.whatYouGetItems.length
        ? page.whatYouGetItems
        : DEFAULT_WHAT_YOU_GET,
      registrationTitle: String(page.registrationTitle || ''),
      registrationSubtitle: String(page.registrationSubtitle || ''),
      skipLanding: false,
    });

    // Fetch the linked price list to pre-populate S2 and committed IDs
    if (page.priceListId && token) {
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/price-lists/${encodeURIComponent(page.priceListId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (data.success && data.list) {
          const pl = data.list;
          const firstLine = Array.isArray(pl.lines) && pl.lines.length ? pl.lines[0] : null;

          setS2({
            listName: String(pl.listName || ''),
            retailPrice: firstLine ? String(firstLine.retailPrice ?? '') : '',
            globalCommission: firstLine ? String(firstLine.defaultAgentCommission ?? '') : '',
            vendorCost: firstLine ? String(firstLine.vendorCost ?? '') : '',
          });

          // Pre-populate S1 using the already-loaded products/vendors lists
          const linkedProductId = String(firstLine?.productId || '');
          const linkedVendorId = String(firstLine?.vendorId || '');
          const foundProduct = products.find((p) => String(p.id || p._id || '') === linkedProductId);
          const foundVendor = vendors.find((v) => String(v.id || v._id || '') === linkedVendorId);

          if (linkedProductId) {
            setProductMode('existing');
            setVendorMode('existing');
            setS1((prev) => ({
              ...prev,
              existingProductId: linkedProductId,
              productName: foundProduct?.productName || prev.productName,
              vendorId: linkedVendorId,
              vendorName: foundVendor?.vendorName || prev.vendorName,
            }));
          }

          // Commit vendor/product/priceList IDs so finalize skips re-creation.
          // Intentionally NOT committing slug — finalize will PUT-update the existing page.
          setCommitted((prev) => ({
            ...prev,
            vendorId: linkedVendorId || prev.vendorId,
            productId: linkedProductId || prev.productId,
            priceListId: page.priceListId,
            priceListName: pl.listName || '',
          }));
        }
      } catch {
        /* price-list fetch failed — user can review and adjust manually */
      }
    }

    setHubMode('wizard');
    setOpenStep(1);
  }

  async function deleteLandingPage(id) {
    if (!id) return;
    setHubLoading(true);
    try {
      await fetch(`${API_BASE}/api/admin/landing-pages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadLandingPages();
    } finally {
      setHubLoading(false);
    }
  }

  // ── Draft helpers ─────────────────────────────────────────────────────────────
  function restoreDraft() {
    if (!pendingDraft) return;
    const d = pendingDraft;
    setVendorMode(d.vendorMode || 'existing');
    setProductMode(d.productMode || 'new');
    setS1(d.s1 || INIT_S1());
    setS2(d.s2 || INIT_S2());
    setS3(d.s3 || INIT_S3());
    setSelectedAgents(d.selectedAgents || {});
    setCommitted(d.committed || INIT_COMMITTED());
    setOpenStep(d.openStep || 1);
    setShowDraftPrompt(false);
    setPendingDraft(null);
  }

  function discardDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  // ── Abort ─────────────────────────────────────────────────────────────────────
  function abortSetup() {
    sessionStorage.removeItem(DRAFT_KEY);
    navigate('/admin/control-panel');
  }

  // ── Step validation (local, no API) ──────────────────────────────────────────
  const step1Valid = !!(
    s1.productName.trim() &&
    (vendorMode === 'existing' ? s1.vendorId : s1.vendorName.trim()) &&
    (productMode === 'existing' ? s1.existingProductId : true)
  );
  const step2Valid = !!(s2.listName.trim() && s2.retailPrice && Number(s2.retailPrice) > 0);
  const step3Valid = !!(s3.skipLanding || s3.slug.trim());

  // ── Step advance handlers (local validation + progress only) ─────────────────
  function advanceStep1() {
    setS1Error('');
    if (!s1.productName.trim()) { setS1Error('נא למלא שם מוצר'); return; }
    if (vendorMode === 'new' && !s1.vendorName.trim()) { setS1Error('נא למלא שם ספק'); return; }
    if (vendorMode === 'existing' && !s1.vendorId) { setS1Error('נא לבחור ספק'); return; }
    if (productMode === 'existing' && !s1.existingProductId) { setS1Error('נא לבחור מוצר קיים'); return; }
    setS2((p) => ({ ...p, listName: p.listName || s1.productName, vendorCost: s1.vendorCost }));
    setS3((p) => ({ ...p, slug: p.slug || slugify(s1.productName), pageTitle: p.pageTitle || s1.productName }));
    setOpenStep(2);
  }

  function advanceStep2() {
    setS2Error('');
    if (!s2.listName.trim()) { setS2Error('נא למלא שם מחירון'); return; }
    if (!s2.retailPrice || Number(s2.retailPrice) <= 0) { setS2Error('נא למלא מחיר קמעונאי'); return; }
    setOpenStep(3);
  }

  function advanceStep3() {
    setS3Error('');
    if (!s3.skipLanding && !s3.slug.trim()) { setS3Error('נא למלא slug לדף, או סמן "דלג"'); return; }
    setOpenStep(4);
  }

  // ── Finalize — single atomic transaction with upsert logic ───────────────────
  async function finalizeSetup() {
    setFinalizeError('');
    setFinalizing(true);

    try {
      let resolvedVendorId  = committed.vendorId;
      let resolvedProductId = committed.productId;
      let resolvedPriceListId = committed.priceListId;
      let resolvedSlug = committed.slug;

      // ── 1. Vendor ──────────────────────────────────────────────────────────
      if (!resolvedVendorId) {
        if (vendorMode === 'existing') {
          resolvedVendorId = s1.vendorId;
        } else {
          setFinalizeProgress('יוצר ספק…');
          const vRes = await fetch(`${API_BASE}/api/admin/vendors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              vendorName: s1.vendorName.trim(), idNum: s1.vendorIdNum.trim(),
              phone: s1.vendorPhone.trim(), email: s1.vendorEmail.trim(),
              address: '', bankName: '', bankNum: '', accountHolder: '', branchNum: '', accountNum: '',
              productLinks: [],
            }),
          });
          const vData = await vRes.json().catch(() => ({}));
          if (!vRes.ok || !vData.success) throw new Error(friendlyError(vData.error || 'שמירת ספק נכשלה'));
          resolvedVendorId = vData.vendor?.id || vData.vendorId || vData.id || '';
        }
        setCommitted((p) => ({ ...p, vendorId: resolvedVendorId }));
      }

      // ── 2. Product (upsert: use existing ID or create new) ──────────────────
      if (!resolvedProductId) {
        if (productMode === 'existing') {
          resolvedProductId = s1.existingProductId;
        } else {
          setFinalizeProgress('יוצר מוצר…');
          const prRes = await fetch(`${API_BASE}/api/admin/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              productName: s1.productName.trim(),
              sku: s1.sku.trim() || slugify(s1.productName).toUpperCase(),
              baseDescription: s1.baseDescription.trim(),
              providerId: resolvedVendorId,
              providerCost: Number(s1.vendorCost || 0),
              flowType: LOCKED_FLOW_TYPE,
              defaultBeneficiaryCount: Math.max(1, Number(s1.defaultBeneficiaryCount || 1)),
            }),
          });
          const prData = await prRes.json().catch(() => ({}));
          if (!prRes.ok || !prData.success) throw new Error(friendlyError(prData.error || 'שמירת מוצר נכשלה'));
          resolvedProductId = prData.product?.id || prData.id || '';

          // Back-link product to new vendor
          if (vendorMode === 'new' && resolvedVendorId && resolvedProductId) {
            await fetch(`${API_BASE}/api/admin/vendors/${encodeURIComponent(resolvedVendorId)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                vendorName: s1.vendorName.trim(), idNum: s1.vendorIdNum.trim(),
                phone: s1.vendorPhone.trim(), email: s1.vendorEmail.trim(),
                address: '', bankName: '', bankNum: '', accountHolder: '', branchNum: '', accountNum: '',
                productLinks: [{ productId: resolvedProductId, sku: s1.sku.trim() || slugify(s1.productName).toUpperCase(), vendorCost: Number(s1.vendorCost || 0) }],
              }),
            }).catch(() => {});
          }
        }
        setCommitted((p) => ({ ...p, productId: resolvedProductId }));
      }

      // When an existing product is selected, propagate the admin-configured
      // beneficiary count so the landing page and checkout always use the latest value.
      if (productMode === 'existing' && resolvedProductId && s1.defaultBeneficiaryCount != null) {
        const existingProd = (products || []).find((p) => String(p.id) === String(resolvedProductId));
        if (existingProd) {
          setFinalizeProgress('מעדכן מוצר קיים…');
          await fetch(`${API_BASE}/api/admin/products/${encodeURIComponent(resolvedProductId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              productName: existingProd.productName || existingProd.name || '',
              sku: existingProd.sku || '',
              baseDescription: existingProd.baseDescription || '',
              providerId: existingProd.providerId || String(existingProd.provider?.id || ''),
              providerCost: Number(existingProd.providerCost || 0),
              defaultBeneficiaryCount: Math.max(1, Number(s1.defaultBeneficiaryCount || 1)),
            }),
          }).catch(() => {}); // best-effort — non-fatal
        }
      }

      // ── 3. Price list ──────────────────────────────────────────────────────
      if (!resolvedPriceListId) {
        setFinalizeProgress('יוצר מחירון…');
        const plRes = await fetch(`${API_BASE}/api/admin/price-lists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            listName: s2.listName.trim(),
            orgName: '',
            lines: [{
              vendorId: resolvedVendorId,
              productId: resolvedProductId,
              agentId: '',
              retailPrice: Number(s2.retailPrice || 0),
              defaultAgentCommission: Number(s2.globalCommission || 0),
              vendorCost: Number(s2.vendorCost || 0),
            }],
          }),
        });
        const plData = await plRes.json().catch(() => ({}));
        if (!plRes.ok || !plData.success) throw new Error(plData.error || 'שמירת מחירון נכשלה');
        resolvedPriceListId = plData.priceList?.id || plData.id || '';
        setCommitted((p) => ({ ...p, priceListId: resolvedPriceListId, priceListName: s2.listName.trim() }));
      }

      // ── 4. Landing page (optional, with upsert by slug) ────────────────────
      if (!s3.skipLanding && s3.slug.trim() && !resolvedSlug) {
        setFinalizeProgress('מפרסם דף נחיתה…');
        const items = (s3.whatYouGetItems || [])
          .filter((i) => i.title?.trim())
          .map((i) => ({ icon: i.icon || 'phone', title: i.title.trim(), description: (i.description || '').trim() }));

        const lpBody = {
          slug: s3.slug.trim(), pageType: 'sales',
          pageTitle: s3.pageTitle.trim(), subTitle: s3.subTitle.trim(),
          mainContent: s3.mainContent.trim(), subContent: s3.subContent.trim(),
          imageUrl: String(s3.galleryImages?.[0] || s3.imageUrl || '').trim(),
          galleryImages: Array.isArray(s3.galleryImages) ? s3.galleryImages.filter(Boolean).slice(0, 4) : [],
          validFrom: String(s3.validFrom || '').trim(),
          validTo: String(s3.validTo || '').trim(),
          priceListId: resolvedPriceListId,
          whatYouGetTitle: s3.whatYouGetTitle.trim(), whatYouGetSubtitle: s3.whatYouGetSubtitle.trim(),
          whatYouGetItems: items,
          registrationTitle: s3.registrationTitle.trim(), registrationSubtitle: s3.registrationSubtitle.trim(),
        };

        // Upsert: check if slug already exists in admin list
        const listRes = await fetch(`${API_BASE}/api/admin/landing-pages`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).catch(() => ({ pages: [] }));
        const existingPage = (listRes.pages || []).find((p) => p.slug === s3.slug.trim());

        let lpRes;
        if (existingPage?.id) {
          lpRes = await fetch(`${API_BASE}/api/admin/landing-pages/${encodeURIComponent(existingPage.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(lpBody),
          });
        } else {
          lpRes = await fetch(`${API_BASE}/api/admin/landing-pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(lpBody),
          });
        }
        const lpData = await lpRes.json().catch(() => ({}));
        if (!lpRes.ok || !lpData.success) throw new Error(lpData.error || 'שמירת דף נחיתה נכשלה');
        resolvedSlug = s3.slug.trim();
        setCommitted((p) => ({ ...p, slug: resolvedSlug }));
      }

      // ── 5. Distribution (agents only) — org price lists are set in Organization Profile → Pricing
      if (Object.keys(selectedAgents).length > 0) {
        setFinalizeProgress('מעדכן הפצה…');
        const agentUpdates = Object.entries(selectedAgents).map(([agentId, commission]) => {
          const agent = agents.find((a) => a.id === agentId);
          if (!agent) return Promise.resolve();
          const existing = Array.isArray(agent.productCommissions) ? agent.productCommissions : [];
          const already = existing.find((x) => x.productId === resolvedProductId);
          const updated = already
            ? existing.map((x) => x.productId === resolvedProductId ? { ...x, commission: Number(commission || 0) } : x)
            : [...existing, { productId: resolvedProductId, commission: Number(commission || 0) }];
          const { id, ...rest } = agent;
          return fetch(`${API_BASE}/api/admin/agents/${encodeURIComponent(agentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...rest, productCommissions: updated.filter((x) => x.productId) }),
          });
        });
        await Promise.all(agentUpdates);
      }

      // ── Done ───────────────────────────────────────────────────────────────
      setFinalizeProgress('');
      setFinalizeDone(true);
      sessionStorage.removeItem(DRAFT_KEY);
      await loadRef();

    } catch (e) {
      setFinalizeError(friendlyError(e.message));
      setFinalizeProgress('');
    } finally {
      setFinalizing(false);
    }
  }

  // ── Utility handlers ──────────────────────────────────────────────────────────
  function agentLink(agentId) {
    const slug = committed.slug || s3.slug;
    if (!slug) return '';
    return `${window.location.origin}/p/${slug}?agentId=${encodeURIComponent(agentId)}`;
  }

  function copyAgentLink(agentId) {
    const link = agentLink(agentId);
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedAgentId(agentId);
      setTimeout(() => setCopiedAgentId(''), 2000);
    }).catch(() => {});
  }

  function handleImageUpload(e, slotIdx = 0) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { setS3Error('התמונה גדולה מ-2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setS3((p) => {
      const next = [...(p.galleryImages || ['', '', '', ''])];
      next[slotIdx] = reader.result;
      return { ...p, galleryImages: next, imageUrl: slotIdx === 0 ? reader.result : (p.imageUrl || next[0] || '') };
    });
    reader.readAsDataURL(file);
  }

  function updateWhatYouGetItem(idx, field, value) {
    setS3((p) => {
      const next = [...(p.whatYouGetItems || [])];
      next[idx] = { ...(next[idx] || { title: '', description: '', icon: 'phone' }), [field]: value };
      return { ...p, whatYouGetItems: next };
    });
  }

  const publicUrl = (committed.slug || s3.slug)
    ? `${window.location.origin}/p/${committed.slug || s3.slug}`
    : '';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={250}>
      <AdminPageShell>
      <div className="space-y-6" dir="rtl">
        {hubMode === 'hub' ? (() => {
          // pageStatus uses the shared isExpired helper from dateUtils.js —
          // single source of truth across admin hub and public LandingPage.
          function pageStatus(pg) {
            return isExpired(pg.validTo) ? 'expired' : 'active';
          }

          const filteredPages = (landingPages || []).filter((pg) => {
            // ── Text search ────────────────────────────────────────────────────
            const q = hubSearch.trim().toLowerCase();
            if (q) {
              const hay = [pg.pageTitle, pg.productName, pg.internalProductName, pg.slug]
                .map((v) => String(v || '').toLowerCase()).join(' | ');
              if (!hay.includes(q)) return false;
            }

            // ── Date-range filter ──────────────────────────────────────────────
            // No filter active → show everything.
            const filterActive = hubFilterFrom || hubFilterTo;
            if (!filterActive) return true;

            const filterStart = parseLocalStartOfDay(hubFilterFrom); // null when not set
            const filterEnd   = parseLocalEndOfDay(hubFilterTo);     // null when not set

            // These are the page's OWN validity dates (validFrom / validTo only —
            // never createdAt or any other field).
            const pgStart = parseLocalStartOfDay(pg.validFrom);
            const pgEnd   = parseLocalEndOfDay(pg.validTo);

            // When a filter IS active, pages with no validity dates have no
            // explicit range and therefore don't match any specific period.
            if (!pgStart && !pgEnd) return false;

            // Overlap test: the page's period [pgStart, pgEnd] must intersect
            // the filter period [filterStart, filterEnd].
            // A one-sided page bound is treated as open-ended on that side.
            if (filterEnd   && pgStart && pgStart > filterEnd)   return false;
            if (filterStart && pgEnd   && pgEnd   < filterStart) return false;
            return true;
          });
          function copyLink(slug) {
            const url = `${window.location.origin}/p/${slug}`;
            navigator.clipboard.writeText(url).then(() => {
              setCopiedSlug(slug);
              setTimeout(() => setCopiedSlug(''), 2000);
            });
          }
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">הקמת דף מוצר</h1>
                  <p className="text-muted-foreground">ניהול דפי נחיתה, תוקף והפצה</p>
                </div>
                <Button type="button" onClick={startNewWizard}>
                  <Plus className="size-4 me-2" />
                  הקמת דף חדש
                </Button>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                    <Input
                      value={hubSearch}
                      onChange={(e) => setHubSearch(e.target.value)}
                      placeholder="חיפוש: שם דף נחיתה"
                    />
                    <Input type="date" value={hubFilterFrom} onChange={(e) => setHubFilterFrom(e.target.value)} />
                    <Input type="date" value={hubFilterTo} onChange={(e) => setHubFilterTo(e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setHubSearch(''); setHubFilterFrom(''); setHubFilterTo(''); }}
                    >
                      ניקוי
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">רשימת דפי מוצר</CardTitle>
                    <CardDescription>{filteredPages.length} / {landingPages.length} דפים</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold">שם דף הנחיתה</TableHead>
                          <TableHead className="font-semibold">כתובת (slug)</TableHead>
                          <TableHead className="font-semibold">תקופת תוקף</TableHead>
                          <TableHead className="font-semibold">סטטוס</TableHead>
                          <TableHead className="w-32 font-semibold">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPages.map((pg) => {
                          const status = pageStatus(pg);
                          const internalName = String(pg.productName || pg.internalProductName || '').trim();
                          const landingTitle = String(pg.pageTitle || '—').trim();
                          return (
                            <TableRow key={pg.id} className="hover:bg-primary/[0.03] transition-colors group">
                              <TableCell className="py-3.5">
                                <div className="font-semibold text-slate-800">{landingTitle || '—'}</div>
                                {internalName && internalName !== landingTitle ? (
                                  <div className="text-xs text-muted-foreground mt-0.5">מוצר פנימי: {internalName}</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-slate-500">/p/{pg.slug}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {pg.validFrom || pg.validTo
                                  ? `${pg.validFrom ? new Date(pg.validFrom).toLocaleDateString('he-IL') : '—'} — ${pg.validTo ? new Date(pg.validTo).toLocaleDateString('he-IL') : '—'}`
                                  : '—'
                                }
                              </TableCell>
                              <TableCell>
                                {status === 'expired' ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-xs">פג תוקף</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">פעיל</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        className="size-8 hover:bg-slate-100"
                                        onClick={() => editLandingPage(pg)}
                                        aria-label="עריכה"
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>עריכה</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        className="size-8 hover:bg-emerald-100 hover:text-emerald-700"
                                        onClick={() => copyLink(pg.slug)}
                                        aria-label="העתקת קישור"
                                      >
                                        {copiedSlug === pg.slug ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{copiedSlug === pg.slug ? 'הועתק' : 'העתקת קישור'}</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" asChild className="size-8 hover:bg-amber-100 hover:text-amber-700">
                                        <a href={`${window.location.origin}/p/${pg.slug}`} target="_blank" rel="noreferrer" aria-label="פתיחת דף">
                                          <ExternalLink className="size-4" />
                                        </a>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>פתיחת דף נחיתה</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        className="size-8 hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => deleteLandingPage(pg.id)}
                                        aria-label="העברה לארכיון"
                                      >
                                        <Archive className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>העברה לארכיון</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {!hubLoading && filteredPages.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-3">
                      {(hubFilterFrom || hubFilterTo || hubSearch) ? 'לא נמצאו דפים לפי הסינון' : 'אין דפי נחיתה'}
                    </p>
                  ) : null}
                  {hubLoading ? (
                    <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      טוען…
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          );
        })() : null}
        {hubMode === 'wizard' ? (
          <Button type="button" variant="outline" onClick={() => setHubMode('hub')}>חזרה לטבלת דפי נחיתה</Button>
        ) : null}
        {hubMode === 'wizard' ? (
          <>

        {/* Header + Abort */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">הקמת דף מוצר</h1>
            <p className="text-muted-foreground text-sm mt-1">ספק · מוצר · מחירון · דף נחיתה · הפצה — מתבצע בפעולה אחת אטומית</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => {
              if (committed.vendorId || committed.productId) {
                setShowAbortConfirm(true);
              } else {
                abortSetup();
              }
            }}
          >
            <X className="size-4 me-1.5" />
            ביטול הקמה
          </Button>
        </div>

        {/* Abort confirm */}
        {showAbortConfirm ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive font-medium">האם לבטל את ההקמה? הנתונים שנשמרו לשרת לא יימחקו.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" size="sm" onClick={abortSetup}>כן, בטל</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAbortConfirm(false)}>חזור</Button>
            </div>
          </div>
        ) : null}

        {/* Info banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2.5">
          <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>שימו לב:</strong> כל הנתונים נשמרים מקומית ומועלים לשרת רק בלחיצה על <strong>סיים ופרסם הכל</strong> בשלב 4.
            קישורי דפי הנחיתה שיווצרו יופיעו גם בעמוד &#39;דפי נחיתה&#39;.
          </p>
        </div>

        {/* Draft resume prompt */}
        {showDraftPrompt ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                נמצאה טיוטה שמורה: <strong>{pendingDraft?.s1?.productName}</strong>. רצונך להמשיך ממנה?
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={restoreDraft}>המשך טיוטה</Button>
              <Button type="button" variant="outline" size="sm" onClick={discardDraft}>התחל מחדש</Button>
            </div>
          </div>
        ) : null}

        {loadingRef ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Spinner className="size-4" />טוען נתונים…</div>
        ) : null}

        {/* Published URL banner */}
        {(committed.slug || (finalizeDone && s3.slug)) ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-700 shrink-0" />
              <span className="text-sm font-medium text-green-800">דף נחיתה פורסם</span>
            </div>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-green-700 underline font-mono">
              {publicUrl}<ExternalLink className="size-3.5 shrink-0" />
            </a>
          </div>
        ) : null}

        {/* ── Step 1: Vendor & Product ─────────────────────────────────────── */}
        <StepCard
          number={1}
          title="ספק ומוצר"
          subtitle={step1Valid ? `מוכן · ${s1.productName}` : 'הגדירו את הספק ופרטי המוצר'}
          done={step1Valid && openStep > 1}
          locked={false}
          open={openStep === 1}
          onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
        >
          <div className="space-y-4">
            {/* Vendor selector */}
            <Field>
              <FieldLabel>ספק</FieldLabel>
              <div className="flex gap-2">
                {['existing', 'new'].map((mode) => (
                  <button key={mode} type="button" onClick={() => setVendorMode(mode)}
                    className={`flex-1 h-9 rounded-md border text-sm transition-colors
                      ${vendorMode === mode ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    {mode === 'existing' ? 'ספק קיים' : 'ספק חדש'}
                  </button>
                ))}
              </div>
            </Field>

            {vendorMode === 'existing' ? (
              <Field>
                <FieldLabel>בחר ספק קיים *</FieldLabel>
                <select className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                  value={s1.vendorId} onChange={(e) => setS1((p) => ({ ...p, vendorId: e.target.value }))}>
                  <option value="">— בחר ספק —</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
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

            {/* Product selector */}
            <div className="border-t pt-4">
              <Field>
                <FieldLabel>מוצר</FieldLabel>
                <div className="flex gap-2">
                  {['new', 'existing'].map((mode) => (
                    <button key={mode} type="button" onClick={() => setProductMode(mode)}
                      className={`flex-1 h-9 rounded-md border text-sm transition-colors
                        ${productMode === mode ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      {mode === 'new' ? 'מוצר חדש' : 'מוצר קיים'}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {productMode === 'existing' ? (
              <Field>
                <FieldLabel>בחר מוצר קיים *</FieldLabel>
                <select className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                  value={s1.existingProductId} onChange={(e) => setS1((p) => ({ ...p, existingProductId: e.target.value }))}>
                  <option value="">— בחר מוצר —</option>
                  {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.productName || pr.name}</option>)}
                </select>
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
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
                <Input dir="ltr" type="number" min="0" step="0.01" value={s1.vendorCost}
                  onChange={(e) => setS1((p) => ({ ...p, vendorCost: e.target.value }))} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel>סוג זרימה (Flow Type)</FieldLabel>
                <Input value={LOCKED_FLOW_TYPE} readOnly disabled className="bg-slate-100 text-muted-foreground" />
              </Field>
              {s1.flowType === LOCKED_FLOW_TYPE ? (
                <Field>
                  <FieldLabel>כמות מוטבים (כולל ראשי)</FieldLabel>
                  <Input
                    dir="ltr"
                    type="number"
                    min="1"
                    value={s1.defaultBeneficiaryCount ?? 1}
                    onChange={(e) => setS1((p) => ({ ...p, defaultBeneficiaryCount: Math.max(1, Number(e.target.value || 1)) }))}
                  />
                </Field>
              ) : null}
            </div>

            {s1Error ? <p className="text-destructive text-sm">{s1Error}</p> : null}
            <Button type="button" onClick={advanceStep1}>
              הבא: שלב 2 — מחירון
            </Button>
          </div>
        </StepCard>

        {/* ── Step 2: Pricing ──────────────────────────────────────────────── */}
        <StepCard
          number={2}
          title="מחירון ועמלה"
          subtitle={step2Valid && openStep > 2 ? `מוכן · ${s2.listName}` : 'קבעו מחיר קמעונאי ועמלת סוכן גלובלית'}
          done={step2Valid && openStep > 2}
          locked={!step1Valid}
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
                <Input dir="ltr" type="number" min="0" step="0.01" value={s2.retailPrice}
                  onChange={(e) => setS2((p) => ({ ...p, retailPrice: e.target.value }))} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel>עמלת סוכן גלובלית (₪)</FieldLabel>
                <Input dir="ltr" type="number" min="0" step="0.01" value={s2.globalCommission}
                  onChange={(e) => setS2((p) => ({ ...p, globalCommission: e.target.value }))} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel>עלות ספק (₪)</FieldLabel>
                <Input dir="ltr" type="number" value={s2.vendorCost} readOnly disabled
                  className="bg-slate-100 text-muted-foreground cursor-not-allowed" placeholder="0" />
                <p className="text-[11px] text-muted-foreground mt-1">ניתן לשינוי רק בשלב &#39;ספק ומוצר&#39;</p>
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
          <Button type="button" onClick={advanceStep2}>
            הבא: שלב 3 — דף נחיתה
          </Button>
        </StepCard>

        {/* ── Step 3: Landing Page ─────────────────────────────────────────── */}
        <StepCard
          number={3}
          title="דף נחיתה"
          subtitle={s3.skipLanding ? 'מדולג' : (step3Valid && openStep > 3 ? `מוכן · /p/${s3.slug}` : 'צרו דף נחיתה ציבורי למוצר')}
          done={step3Valid && openStep > 3}
          locked={!step2Valid}
          open={openStep === 3}
          onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
        >
          <div className="space-y-4">
            {/* Skip toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="size-4 rounded" checked={!!s3.skipLanding}
                onChange={(e) => setS3((p) => ({ ...p, skipLanding: e.target.checked }))} />
              <span className="text-sm text-muted-foreground">דלג על יצירת דף נחיתה</span>
            </label>

            {!s3.skipLanding ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>כתובת URL (slug) *</FieldLabel>
                    <div className="relative">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">/p/</span>
                      <Input dir="ltr" className="ps-8" value={s3.slug}
                        onChange={(e) => setS3((p) => ({ ...p, slug: slugify(e.target.value) }))} placeholder="productname" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">הכתובת חייבת להיות באותיות אנגליות קטנות (a-z) ומספרים בלבד.</p>
                  </Field>
                  <Field>
                    <FieldLabel>כותרת ראשית</FieldLabel>
                    <Input value={s3.pageTitle} onChange={(e) => setS3((p) => ({ ...p, pageTitle: e.target.value }))} />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>תגית Badge / כותרת משנה</FieldLabel>
                    <Input value={s3.subTitle} onChange={(e) => setS3((p) => ({ ...p, subTitle: e.target.value }))} />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>תוכן ראשי</FieldLabel>
                    <Textarea rows={3} value={s3.mainContent} onChange={(e) => setS3((p) => ({ ...p, mainContent: e.target.value }))} />
                  </Field>
                </div>

                <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
                  <p className="text-xs font-medium text-slate-700">תמונות מוצר בדף נחיתה (1 ראשית + 3 משניות)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((idx) => {
                      const img = s3.galleryImages?.[idx] || '';
                      return (
                        <div key={idx} className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">{idx === 0 ? 'ראשית *' : `משנית ${idx}`}</p>
                          {img ? (
                            <div className="relative">
                              <img src={img} alt="" className="w-full h-20 object-cover rounded-lg border" />
                              <button type="button" onClick={() => setS3((p) => {
                                const next = [...(p.galleryImages || ['', '', '', ''])];
                                next[idx] = '';
                                return { ...p, galleryImages: next, imageUrl: idx === 0 ? '' : p.imageUrl };
                              })} className="absolute -top-1 -end-1 size-5 rounded-full bg-white border flex items-center justify-center shadow">
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, idx)} className="text-xs" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">מקס׳ 2MB לתמונה</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>מתאריך</FieldLabel>
                    <Input type="date" value={s3.validFrom || ''} onChange={(e) => setS3((p) => ({ ...p, validFrom: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>עד תאריך</FieldLabel>
                    <Input type="date" value={s3.validTo || ''} onChange={(e) => setS3((p) => ({ ...p, validTo: e.target.value }))} />
                  </Field>
                </div>

                <div className="border rounded-lg p-3 space-y-3">
                  <p className="text-xs font-medium text-slate-700">קטגוריית &#34;מה תקבלו&#34;</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>כותרת קטגוריה</FieldLabel>
                      <Input value={s3.whatYouGetTitle} onChange={(e) => setS3((p) => ({ ...p, whatYouGetTitle: e.target.value }))} placeholder="מה אתם מקבלים?" />
                    </Field>
                    <Field>
                      <FieldLabel>כותרת משנה</FieldLabel>
                      <Input value={s3.whatYouGetSubtitle} onChange={(e) => setS3((p) => ({ ...p, whatYouGetSubtitle: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="space-y-2">
                    {(s3.whatYouGetItems || []).map((item, idx) => (
                      <div key={idx} className="border rounded-lg p-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start bg-slate-50">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">כותרת</p>
                          <Input value={item.title || ''} onChange={(e) => updateWhatYouGetItem(idx, 'title', e.target.value)}
                            placeholder={`פריט ${idx + 1}`} className="h-8 text-sm" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">תיאור</p>
                          <Input value={item.description || ''} onChange={(e) => updateWhatYouGetItem(idx, 'description', e.target.value)}
                            placeholder="תיאור קצר" className="h-8 text-sm" />
                        </div>
                        <button type="button"
                          onClick={() => setS3((p) => ({ ...p, whatYouGetItems: (p.whatYouGetItems || []).filter((_, i) => i !== idx) }))}
                          className="text-muted-foreground hover:text-destructive mt-5">
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setS3((p) => ({ ...p, whatYouGetItems: [...(p.whatYouGetItems || []), { title: '', description: '', icon: 'phone' }] }))}>
                      <Plus className="size-3 me-1" />הוסף פריט
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>כותרת אזור הרשמה</FieldLabel>
                    <Input value={s3.registrationTitle} onChange={(e) => setS3((p) => ({ ...p, registrationTitle: e.target.value }))} placeholder="הרשמה לשירות" />
                  </Field>
                  <Field>
                    <FieldLabel>כותרת משנה להרשמה</FieldLabel>
                    <Input value={s3.registrationSubtitle} onChange={(e) => setS3((p) => ({ ...p, registrationSubtitle: e.target.value }))} />
                  </Field>
                </div>

                <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? <EyeOff className="size-4 me-2" /> : <Eye className="size-4 me-2" />}
                  {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
                </Button>
                {showPreview ? <LandingPreview form={s3} retailPrice={s2.retailPrice} /> : null}
              </>
            ) : null}

            {s3Error ? <p className="text-destructive text-sm">{s3Error}</p> : null}
            <Button type="button" onClick={advanceStep3}>
              הבא: שלב 4 — הפצה ופרסום
            </Button>
          </div>
        </StepCard>

        {/* ── Step 4: Distribution + Finalize ─────────────────────────────── */}
        <StepCard
          number={4}
          title="הפצה ופרסום"
          subtitle={
            finalizeDone
              ? 'הושלם ✓'
              : 'שייכו סוכנים לפי הצורך  לאחר מכן לחצו סיים ופרסם הכל'
          }
          done={finalizeDone}
          locked={!step2Valid}
          open={openStep === 4}
          onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}
        >
          <div className="space-y-5">
            {/* Agents */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">סוכנים</p>
              <p className="text-xs text-muted-foreground">
                בחרו סוכנים - העמלה מתמלאת מהגלובלית (ניתן לשנות לכל סוכן).
                {s3.slug || committed.slug ? ' לכל סוכן ייווצר קישור ייחודי לדף הנחיתה.' : ''}
              </p>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין סוכנים במערכת</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {agents.map((a) => {
                    const checked = a.id in selectedAgents;
                    const link = agentLink(a.id);
                    const justCopied = copiedAgentId === a.id;
                    return (
                      <div key={a.id} className={checked ? 'bg-blue-50/50' : ''}>
                        <label className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" className="size-4 rounded shrink-0" checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAgents((p) => ({ ...p, [a.id]: String(s2.globalCommission || '') }));
                              else setSelectedAgents((p) => { const n = { ...p }; delete n[a.id]; return n; });
                            }} />
                          <span className="flex-1 text-sm font-medium">{a.agentName}</span>
                          {checked ? (
                            <Input type="number" min="0" dir="ltr" className="w-24 h-7 text-xs shrink-0"
                              value={selectedAgents[a.id] ?? ''} placeholder="עמלה ₪"
                              onChange={(e) => setSelectedAgents((p) => ({ ...p, [a.id]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()} />
                          ) : null}
                        </label>
                        {checked && link ? (
                          <div className="px-2.5 pb-2.5 flex items-center gap-2" dir="ltr">
                            <span className="flex-1 truncate text-xs font-mono text-muted-foreground bg-white border rounded px-2 py-1 select-all">{link}</span>
                            <button type="button" onClick={() => copyAgentLink(a.id)}
                              className={`shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded border text-xs transition-colors
                                ${justCopied ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              {justCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                              {justCopied ? 'הועתק' : 'העתק'}
                            </button>
                            <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              className="shrink-0 inline-flex items-center h-7 w-7 justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {!(s3.slug || committed.slug) && Object.keys(selectedAgents).length > 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  להפקת קישורי הפצה ייחודיים — מלאו slug בשלב 3.
                </p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed border rounded-lg bg-slate-50/80 px-3 py-2">
              שיוך מחירון ומחירים לארגונים מתבצע בלבד מתפריט הארגון → תמחור. פרסום דף מוצר אינו משנה הגדרות ארגון.
            </p>

            {/* Summary before finalize */}
            {!finalizeDone ? (
              <div className="rounded-lg bg-slate-50 border p-4 space-y-1.5 text-sm">
                <p className="font-medium text-slate-700 mb-2">סיכום לפני פרסום:</p>
                <p className="text-muted-foreground">ספק: <span className="text-slate-800 font-medium">{vendorMode === 'existing' ? (vendors.find((v) => v.id === s1.vendorId)?.vendorName || '—') : (s1.vendorName || '—')}</span></p>
                <p className="text-muted-foreground">מוצר: <span className="text-slate-800 font-medium">{s1.productName || '—'}</span></p>
                <p className="text-muted-foreground">מחירון: <span className="text-slate-800 font-medium">{s2.listName || '—'} · ₪{s2.retailPrice || 0}</span></p>
                {!s3.skipLanding && s3.slug ? (
                  <p className="text-muted-foreground">דף נחיתה: <span className="text-slate-800 font-mono text-xs">/p/{s3.slug}</span></p>
                ) : s3.skipLanding ? (
                  <p className="text-muted-foreground">דף נחיתה: <span className="text-slate-500">מדולג</span></p>
                ) : null}
              </div>
            ) : null}

            {/* Finalize errors */}
            {finalizeError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-destructive text-sm font-medium">{finalizeError}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">ניתן לנסות שוב — הפעולה בטוחה לחזרה (Upsert)</p>
                </div>
              </div>
            ) : null}

            {/* Success */}
            {finalizeDone ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-green-800 font-semibold text-sm flex items-center gap-2">
                  <Check className="size-4" />המוצר הוגדר ופורסם בהצלחה!
                </p>
                <div className="text-xs text-green-700 space-y-1">
                  {committed.productId ? <p>מזהה מוצר: <span className="font-mono">{committed.productId}</span></p> : null}
                  {committed.priceListId ? <p>מזהה מחירון: <span className="font-mono">{committed.priceListId}</span></p> : null}
                  {(committed.slug || s3.slug) ? (
                    <p>דף נחיתה: <a href={publicUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">{publicUrl}<ExternalLink className="size-3" /></a></p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={finalizeSetup}
                  disabled={finalizing}
                  className="min-w-[180px]"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="size-4 me-2 animate-spin" />
                      {finalizeProgress || 'מעבד…'}
                    </>
                  ) : (
                    <>
                      <Check className="size-4 me-2" />
                      סיים ופרסם הכל
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </StepCard>
          </>
        ) : null}
      </div>
      </AdminPageShell>
    </TooltipProvider>
  );
}
