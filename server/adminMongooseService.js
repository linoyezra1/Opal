import mongoose from 'mongoose';
import { countDealsByAgentId } from './mongoService.js';

const MONGO_URL = process.env.MONGO_URL || '';
const DB_NAME = process.env.MONGO_DB_NAME || 'opal';

let isConnected = false;

async function ensureConnection() {
  if (!MONGO_URL) throw new Error('MONGO_URL is not set');
  if (isConnected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
  isConnected = true;
}

/** Legacy flat schema (collection organization_pricings) — kept for DB compatibility */
const organizationPricingSchema = new mongoose.Schema(
  {
    orgName: { type: String, required: true, trim: true },
    priceListName: { type: String, required: true, trim: true },
    creationDate: { type: Date, default: Date.now },
    vendorName: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    productSKU: { type: String, required: true, trim: true },
  },
  { versionKey: false }
);

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, trim: true },
    /** @deprecated legacy field — use productName */
    name: { type: String, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    baseDescription: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

/** Mongoose 8+: avoid `next` callback — use async middleware (next is not always a function). */
productSchema.pre('validate', async function productValidate() {
  const pn = String(this.productName || this.name || '').trim();
  if (pn) {
    this.productName = pn;
    this.name = pn;
  }
  if (!String(this.productName || '').trim()) {
    this.invalidate('productName', 'productName is required');
  }
});

productSchema.pre('save', async function productPreSave() {
  this.updatedAt = new Date();
});

const vendorProductLinkSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, default: '' },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    vendorName: { type: String, required: true, trim: true },
    idNum: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankNum: { type: String, default: '' },
    accountHolder: { type: String, default: '' },
    branchNum: { type: String, default: '' },
    accountNum: { type: String, default: '' },
    productLinks: { type: [vendorProductLinkSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

vendorSchema.pre('save', async function vendorPreSave() {
  this.updatedAt = new Date();
});

const pricingEntrySchema = new mongoose.Schema(
  {
    pricingName: { type: String, required: true, trim: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    orgName: { type: String, default: '' },
    retailPrice: { type: Number, required: true, min: 0, default: 0 },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
    agentCommission: { type: Number, required: true, min: 0, default: 0 },
    profitBeforeAgent: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    /** mirrors netProfit for legacy */
    profit: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

pricingEntrySchema.pre('save', async function pricingEntryPreSave() {
  const r = Number(this.retailPrice || 0);
  const v = Number(this.vendorCost || 0);
  const a = Number(this.agentCommission || 0);
  this.retailPrice = r;
  this.vendorCost = v;
  this.agentCommission = a;
  this.profitBeforeAgent = r - v;
  this.netProfit = r - v - a;
  this.profit = this.netProfit;
});

const agentProductCommissionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    commission: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const salesAgentSchema = new mongoose.Schema(
  {
    agentName: { type: String, required: true, trim: true },
    idNum: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    bankDetails: {
      bankName: { type: String, default: '' },
      bankNum: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      branchNum: { type: String, default: '' },
      accountNum: { type: String, default: '' },
    },
    /** עמלה ייחודית לכל מוצר (משמש בדוחות רווח) */
    productCommissions: { type: [agentProductCommissionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

salesAgentSchema.pre('save', async function salesAgentPreSave() {
  this.updatedAt = new Date();
});

const relatedProductLineSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    retailPrice: { type: Number, required: true, min: 0, default: 0 },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
    agentCommission: { type: Number, required: true, min: 0, default: 0 },
    profitBeforeAgent: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    /** legacy — same as netProfit */
    profit: { type: Number, default: 0 },
  },
  { _id: false }
);

const orgPricingPolicySchema = new mongoose.Schema(
  {
    organizationName: { type: String, required: true, trim: true },
    pricingListName: { type: String, required: true, trim: true },
    relatedProducts: { type: [relatedProductLineSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

orgPricingPolicySchema.pre('save', async function orgPricingPreSave() {
  const lines = this.relatedProducts || [];
  for (const line of lines) {
    const retail = Number(line.retailPrice || 0);
    const vendor = Number(line.vendorCost || 0);
    const ac = Number(line.agentCommission || 0);
    line.retailPrice = retail;
    line.vendorCost = vendor;
    line.agentCommission = ac;
    line.profitBeforeAgent = retail - vendor;
    line.netProfit = retail - vendor - ac;
    line.profit = line.netProfit;
  }
  this.updatedAt = new Date();
});

/** מחירון רב-מוצרי לדפי נחיתה (שורות עם עלות ספק ועמלה — אוטומטית מפרופיל סוכן אם נבחר) */
const priceListLineSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    /** סוכן לשורה — אם מוגדר, עמלת ברירת המחדל נגזרת מ־productCommissions */
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesAgent', required: false },
    retailPrice: { type: Number, required: true, min: 0, default: 0 },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
    /** ברירת מחדל לעסקה: מחושב מסוכן או ידני אם אין סוכן */
    defaultAgentCommission: { type: Number, default: 0, min: 0 },
    profitBeforeAgent: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
  },
  { _id: false }
);

const priceListSchema = new mongoose.Schema(
  {
    listName: { type: String, required: true, trim: true },
    orgName: { type: String, default: '' },
    lines: { type: [priceListLineSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

priceListSchema.pre('save', async function priceListPreSave() {
  const lines = this.lines || [];
  for (const line of lines) {
    const retail = Number(line.retailPrice || 0);
    line.retailPrice = retail;
    let vendor = Number(line.vendorCost ?? NaN);
    if (Number.isNaN(vendor) && line.vendorId && line.productId) {
      const vc = await getVendorCostForProduct(line.vendorId, line.productId);
      vendor = vc ? vc.vendorCost : 0;
    }
    if (Number.isNaN(vendor)) vendor = 0;
    line.vendorCost = vendor;
    let dac = Number(line.defaultAgentCommission || 0);
    if (line.agentId && line.productId && mongoose.isValidObjectId(line.agentId)) {
      dac = await getAgentCommissionForProduct(line.agentId, line.productId, dac);
    }
    line.defaultAgentCommission = dac;
    line.profitBeforeAgent = retail - vendor;
    line.netProfit = retail - vendor - dac;
    line.profit = line.netProfit;
  }
  this.updatedAt = new Date();
});

/** דף נחיתה מעוצב — מקושר למחירון */
const whatYouGetItemSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    /** מפתח אייקון לצד הלקוח: phone | users | pill | stethoscope | syringe | file */
    icon: { type: String, default: 'phone' },
  },
  { _id: false }
);

const landingPageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    /** sales = מחירון + צ׳ק-אאוט; contact = דף צור קשר בלבד */
    pageType: { type: String, enum: ['sales', 'contact'], default: 'sales' },
    pageTitle: { type: String, default: '' },
    subTitle: { type: String, default: '' },
    mainContent: { type: String, default: '' },
    subContent: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    priceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceList', default: null },
    whatYouGetTitle: { type: String, default: '' },
    whatYouGetSubtitle: { type: String, default: '' },
    whatYouGetItems: { type: [whatYouGetItemSchema], default: [] },
    registrationTitle: { type: String, default: '' },
    registrationSubtitle: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

landingPageSchema.pre('save', async function landingPagePreSave() {
  this.updatedAt = new Date();
});

const checkoutDraftSchema = new mongoose.Schema(
  {
    sessionKey: { type: String, required: true, unique: true, index: true },
    formSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    step: { type: String, default: 'checkout' },
    completed: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const agentSchema = new mongoose.Schema(
  {
    personal: {
      name: { type: String, required: true, trim: true },
      idOrCompanyNum: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },
    bankDetails: {
      bankName: { type: String, required: true, trim: true },
      bankNumber: { type: String, required: true, trim: true },
      branchNumber: { type: String, required: true, trim: true },
      accountNumber: { type: String, required: true, trim: true },
      accountHolder: { type: String, required: true, trim: true },
    },
    commissionModel: {
      productName: { type: String, required: true, trim: true },
      productSKU: { type: String, required: true, trim: true },
      retailPrice: { type: Number, required: true, min: 0, default: 0 },
      vendorCost: { type: Number, required: true, min: 0, default: 0 },
      profitBeforeAgent: { type: Number, required: true, default: 0 },
      agentCommission: { type: Number, required: true, min: 0, default: 0 },
      baseFee: { type: Number, required: true, min: 0, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

agentSchema.pre('save', async function updateProfit() {
  const retail = Number(this.commissionModel?.retailPrice || 0);
  const vendor = Number(this.commissionModel?.vendorCost || 0);
  this.commissionModel.profitBeforeAgent = retail - vendor;
  this.updatedAt = new Date();
});

const OrganizationPricing =
  mongoose.models.OrganizationPricing ||
  mongoose.model('OrganizationPricing', organizationPricingSchema, 'organization_pricings');

const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');

const OrgPricingPolicy =
  mongoose.models.OrgPricingPolicy ||
  mongoose.model('OrgPricingPolicy', orgPricingPolicySchema, 'org_pricing_policies');

const CheckoutDraft =
  mongoose.models.CheckoutDraft || mongoose.model('CheckoutDraft', checkoutDraftSchema, 'checkout_drafts');

const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema, 'agents');

const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema, 'vendors');

const PricingEntry = mongoose.models.PricingEntry || mongoose.model('PricingEntry', pricingEntrySchema, 'pricing_entries');

const SalesAgent = mongoose.models.SalesAgent || mongoose.model('SalesAgent', salesAgentSchema, 'sales_agents');

const PriceList = mongoose.models.PriceList || mongoose.model('PriceList', priceListSchema, 'price_lists');

const LandingPage = mongoose.models.LandingPage || mongoose.model('LandingPage', landingPageSchema, 'landing_pages');

/** @deprecated — legacy flat pricing row */
export async function createOrganizationPricing(payload) {
  await ensureConnection();
  const doc = await OrganizationPricing.create({
    orgName: payload.orgName,
    priceListName: payload.priceListName,
    creationDate: payload.creationDate || undefined,
    vendorName: payload.vendorName,
    productName: payload.productName,
    productSKU: payload.productSKU,
  });
  return { id: String(doc._id) };
}

/** @deprecated */
export async function listOrganizationPricings() {
  await ensureConnection();
  const docs = await OrganizationPricing.find({}).sort({ creationDate: -1 }).lean();
  return docs.map((d) => ({
    id: String(d._id),
    orgName: d.orgName,
    priceListName: d.priceListName,
    creationDate: d.creationDate ? new Date(d.creationDate).toISOString() : null,
    vendorName: d.vendorName,
    productName: d.productName,
    productSKU: d.productSKU,
  }));
}

export async function createProduct(payload) {
  await ensureConnection();
  const productName = String(payload.productName || payload.name || '').trim();
  const doc = await Product.create({
    productName,
    name: productName,
    sku: String(payload.sku || '').trim(),
    baseDescription: String(payload.baseDescription || ''),
  });
  return { id: String(doc._id) };
}

export async function listProducts() {
  await ensureConnection();
  const docs = await Product.find({}).sort({ createdAt: -1 }).lean();
  return docs.map((d) => {
    const productName = d.productName || d.name || '';
    return {
      id: String(d._id),
      productName,
      name: productName,
      sku: d.sku,
      baseDescription: d.baseDescription || '',
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    };
  });
}

export async function updateProduct(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid product id');
  const productName = String(payload.productName || payload.name || '').trim();
  const sku = String(payload.sku || '').trim();
  if (!productName || !sku) throw new Error('productName and sku are required');
  const oid = new mongoose.Types.ObjectId(id);
  const doc = await Product.findByIdAndUpdate(
    oid,
    {
      $set: {
        productName,
        name: productName,
        sku,
        baseDescription: String(payload.baseDescription || ''),
        updatedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );
  if (!doc) throw new Error('Product not found');
  await Vendor.updateMany(
    { 'productLinks.productId': oid },
    { $set: { 'productLinks.$[elem].sku': sku } },
    { arrayFilters: [{ 'elem.productId': oid }] }
  );
  return { id: String(doc._id) };
}

export async function deleteProduct(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid product id');
  const oid = new mongoose.Types.ObjectId(id);
  const pl = await PriceList.findOne({ 'lines.productId': oid }).lean();
  if (pl) throw new Error('לא ניתן למחוק מוצר המשויך למחירון דינמי — עדכנו את המחירון תחילה');
  await SalesAgent.updateMany({}, { $pull: { productCommissions: { productId: oid } } });
  await Vendor.updateMany({}, { $pull: { productLinks: { productId: oid } } });
  await PricingEntry.deleteMany({ productId: oid });
  await OrgPricingPolicy.updateMany({}, { $pull: { relatedProducts: { productId: oid } } });
  const r = await Product.findByIdAndDelete(oid);
  if (!r) throw new Error('Product not found');
  return { ok: true };
}

export async function createVendor(payload) {
  await ensureConnection();
  const links = Array.isArray(payload.productLinks) ? payload.productLinks : [];
  const productLinks = await Promise.all(
    links.map(async (l) => {
      const pid = l.productId;
      if (!pid || !mongoose.isValidObjectId(pid)) throw new Error('Invalid productId in productLinks');
      const p = await Product.findById(pid).lean();
      const sku = p ? p.sku : String(l.sku || '');
      return {
        productId: pid,
        sku,
        vendorCost: Number(l.vendorCost || 0),
      };
    })
  );
  const doc = await Vendor.create({
    vendorName: String(payload.vendorName || '').trim(),
    idNum: String(payload.idNum || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    address: String(payload.address || '').trim(),
    bankName: String(payload.bankName || '').trim(),
    bankNum: String(payload.bankNum || '').trim(),
    accountHolder: String(payload.accountHolder || '').trim(),
    branchNum: String(payload.branchNum || '').trim(),
    accountNum: String(payload.accountNum || '').trim(),
    productLinks,
  });
  return { id: String(doc._id) };
}

export async function listVendors() {
  await ensureConnection();
  const docs = await Vendor.find({}).sort({ createdAt: -1 }).populate('productLinks.productId').lean();
  return docs.map((d) => ({
    id: String(d._id),
    vendorName: d.vendorName,
    idNum: d.idNum,
    phone: d.phone,
    email: d.email,
    address: d.address,
    bankName: d.bankName,
    bankNum: d.bankNum,
    accountHolder: d.accountHolder,
    branchNum: d.branchNum,
    accountNum: d.accountNum,
    productLinks: (d.productLinks || []).map((link) => {
      const p = link.productId;
      const prod =
        p && typeof p === 'object'
          ? {
              id: String(p._id),
              productName: p.productName || p.name,
              sku: p.sku,
            }
          : { id: String(link.productId), productName: '', sku: link.sku || '' };
      return {
        productId: prod.id,
        sku: prod.sku || link.sku,
        vendorCost: Number(link.vendorCost || 0),
        product: prod,
      };
    }),
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  }));
}

export async function updateVendor(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid vendor id');
  const links = Array.isArray(payload.productLinks) ? payload.productLinks : [];
  const productLinks = await Promise.all(
    links.map(async (l) => {
      const pid = l.productId;
      if (!pid || !mongoose.isValidObjectId(pid)) throw new Error('Invalid productId in productLinks');
      const p = await Product.findById(pid).lean();
      const sku = p ? p.sku : String(l.sku || '');
      return {
        productId: pid,
        sku,
        vendorCost: Number(l.vendorCost || 0),
      };
    })
  );
  const doc = await Vendor.findByIdAndUpdate(
    id,
    {
      $set: {
        vendorName: String(payload.vendorName || '').trim(),
        idNum: String(payload.idNum || '').trim(),
        phone: String(payload.phone || '').trim(),
        email: String(payload.email || '').trim(),
        address: String(payload.address || '').trim(),
        bankName: String(payload.bankName || '').trim(),
        bankNum: String(payload.bankNum || '').trim(),
        accountHolder: String(payload.accountHolder || '').trim(),
        branchNum: String(payload.branchNum || '').trim(),
        accountNum: String(payload.accountNum || '').trim(),
        productLinks,
        updatedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );
  if (!doc) throw new Error('Vendor not found');
  return { id: String(doc._id) };
}

export async function deleteVendor(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid vendor id');
  const oid = new mongoose.Types.ObjectId(id);
  const pe = await PricingEntry.findOne({ vendorId: oid }).lean();
  if (pe) throw new Error('לא ניתן למחוק ספק המשויך לשורות מחירון');
  const pl = await PriceList.findOne({ 'lines.vendorId': oid }).lean();
  if (pl) throw new Error('לא ניתן למחוק ספק המשויך למחירון דינמי');
  const op = await OrgPricingPolicy.findOne({ 'relatedProducts.vendorId': oid }).lean();
  if (op) throw new Error('לא ניתן למחוק ספק המשויך למחירון ארגון');
  const r = await Vendor.findByIdAndDelete(oid);
  if (!r) throw new Error('Vendor not found');
  return { ok: true };
}

/** Normalize subdocument productId to string (ObjectId | populated doc | Buffer) */
function productLinkIdToString(productIdRef) {
  if (productIdRef == null) return '';
  if (typeof productIdRef === 'object') {
    if (productIdRef._id != null) return String(productIdRef._id);
    if (typeof productIdRef.toString === 'function') {
      const s = productIdRef.toString();
      if (s && s !== '[object Object]') return s;
    }
  }
  return String(productIdRef);
}

/** מחיר ספק למוצר — ללא populate: אחרת productId הופך לאובייקט וההשוואה נכשלת */
export async function getVendorCostForProduct(vendorId, productId) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(vendorId) || !mongoose.isValidObjectId(productId)) return null;
  const target = new mongoose.Types.ObjectId(productId).toString();
  const v = await Vendor.findById(vendorId).lean();
  if (!v) return null;
  const line = (v.productLinks || []).find((l) => productLinkIdToString(l.productId) === target);
  if (!line) return null;
  let sku = line.sku || '';
  if (!sku) {
    const p = await Product.findById(productId).select('sku').lean();
    sku = p?.sku || '';
  }
  return {
    vendorCost: Number(line.vendorCost || 0),
    sku,
    vendorName: v.vendorName,
  };
}

/** סכומי תשלום legacy (דף הבית הישן) */
const LEGACY_PLAN_AMOUNTS = { 'plan-a': 59, 'plan-b': 29, 'plan-fg': 0 };

/** עמלת סוכן למוצר: אם הוגדרה בפרופיל — משתמשים בה; אחרת ברירת מחירון */
export async function getAgentCommissionForProduct(agentId, productId, lineDefaultCommission = 0) {
  await ensureConnection();
  const def = Number(lineDefaultCommission || 0);
  if (!mongoose.isValidObjectId(agentId) || !mongoose.isValidObjectId(productId)) return def;
  const a = await SalesAgent.findById(agentId).select('productCommissions').lean();
  if (!a) return def;
  const t = new mongoose.Types.ObjectId(productId).toString();
  const row = (a.productCommissions || []).find((x) => String(x.productId) === t);
  if (row) return Number(row.commission ?? 0);
  return def;
}

/**
 * חישוב סכום לחיוב ושדות כלכליים לשמירה ב-deal (עקביות: רווח = קמעוני - ספק - עמלת סוכן)
 */
export async function resolveCheckoutEconomics(formState) {
  await ensureConnection();
  const fs = formState && typeof formState === 'object' ? formState : {};
  const priceListId = String(fs.priceListId || '').trim();
  const productId = String(fs.productId || '').trim();

  if (priceListId && productId && mongoose.isValidObjectId(priceListId) && mongoose.isValidObjectId(productId)) {
    const pl = await PriceList.findById(priceListId).lean();
    if (!pl) {
      return {
        payerAmount: 0,
        resolvedVendorCost: 0,
        resolvedAgentCommission: 0,
        resolvedNetProfit: 0,
        productName: '',
        productId,
        priceListId,
      };
    }
    const line = (pl.lines || []).find((l) => String(l.productId) === String(productId));
    if (!line) {
      return {
        payerAmount: 0,
        resolvedVendorCost: 0,
        resolvedAgentCommission: 0,
        resolvedNetProfit: 0,
        productName: '',
        productId,
        priceListId,
      };
    }
    const retail = Number(line.retailPrice || 0);
    const vendorCost = Number(line.vendorCost || 0);
    const lineDefault = Number(line.defaultAgentCommission || 0);
    let agentId = String(fs.agentId || '').trim();
    let agentCommission = lineDefault;
    if (agentId && mongoose.isValidObjectId(agentId)) {
      agentCommission = await getAgentCommissionForProduct(agentId, productId, lineDefault);
    } else {
      const resolved = await resolveAgentIdFromFormState(fs);
      if (resolved && mongoose.isValidObjectId(resolved)) {
        agentId = resolved;
        agentCommission = await getAgentCommissionForProduct(resolved, productId, lineDefault);
      }
    }
    const net = retail - vendorCost - agentCommission;
    const p = await Product.findById(productId).select('productName name baseDescription').lean();
    const productName = p ? String(p.productName || p.name || '').trim() : '';
    return {
      payerAmount: retail,
      resolvedVendorCost: vendorCost,
      resolvedAgentCommission: agentCommission,
      resolvedNetProfit: net,
      productName,
      productId,
      priceListId,
    };
  }

  const planId = String(fs.selectedPlanId || '');
  const payerAmount = LEGACY_PLAN_AMOUNTS[planId] ?? 0;
  const rv = Number(fs.resolvedVendorCost ?? 0);
  const ra = Number(fs.resolvedAgentCommission ?? 0);
  return {
    payerAmount,
    resolvedVendorCost: Number.isFinite(rv) ? rv : 0,
    resolvedAgentCommission: Number.isFinite(ra) ? ra : 0,
    resolvedNetProfit: payerAmount - (Number.isFinite(rv) ? rv : 0) - (Number.isFinite(ra) ? ra : 0),
    productName: String(fs.productName || ''),
    productId: fs.productId && mongoose.isValidObjectId(fs.productId) ? String(fs.productId) : '',
    priceListId: '',
  };
}

function serializePriceListDoc(d) {
  if (!d) return null;
  const lines = (d.lines || []).map((line) => {
    const retail = Number(line.retailPrice || 0);
    const vc = Number(line.vendorCost || 0);
    const dac = Number(line.defaultAgentCommission || 0);
    const pba = line.profitBeforeAgent != null ? Number(line.profitBeforeAgent) : retail - vc;
    const net = line.netProfit != null ? Number(line.netProfit) : pba - dac;
    return {
      vendorId: String(line.vendorId),
      productId: String(line.productId),
      agentId: line.agentId ? String(line.agentId) : '',
      retailPrice: retail,
      vendorCost: vc,
      defaultAgentCommission: dac,
      profitBeforeAgent: pba,
      netProfit: net,
      profit: Number(line.profit ?? net),
    };
  });
  return {
    id: String(d._id),
    listName: d.listName,
    orgName: d.orgName || '',
    lines,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

export async function listPriceLists() {
  await ensureConnection();
  const docs = await PriceList.find({}).sort({ updatedAt: -1 }).lean();
  return docs.map((d) => serializePriceListDoc(d));
}

export async function getPriceListById(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) return null;
  const d = await PriceList.findById(id).lean();
  return serializePriceListDoc(d);
}

export async function createPriceList(payload) {
  await ensureConnection();
  const linesIn = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = [];
  for (const row of linesIn) {
    const vid = row.vendorId;
    const pid = row.productId;
    if (!mongoose.isValidObjectId(vid) || !mongoose.isValidObjectId(pid)) continue;
    let vendorCost = Number(row.vendorCost ?? NaN);
    if (Number.isNaN(vendorCost)) {
      const vc = await getVendorCostForProduct(vid, pid);
      vendorCost = vc ? vc.vendorCost : 0;
    }
    const retail = Number(row.retailPrice || 0);
    const agentId = row.agentId && mongoose.isValidObjectId(row.agentId) ? row.agentId : null;
    let dac = Number(row.defaultAgentCommission || 0);
    if (agentId) {
      dac = await getAgentCommissionForProduct(agentId, pid, dac);
    }
    const pba = retail - vendorCost;
    const net = pba - dac;
    const lineDoc = {
      vendorId: vid,
      productId: pid,
      retailPrice: retail,
      vendorCost,
      defaultAgentCommission: dac,
      profitBeforeAgent: pba,
      netProfit: net,
      profit: net,
    };
    if (agentId) lineDoc.agentId = agentId;
    lines.push(lineDoc);
  }
  const doc = await PriceList.create({
    listName: String(payload.listName || '').trim(),
    orgName: String(payload.orgName || '').trim(),
    lines,
  });
  return { id: String(doc._id) };
}

export async function updatePriceList(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid price list id');
  const linesIn = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = [];
  for (const row of linesIn) {
    const vid = row.vendorId;
    const pid = row.productId;
    if (!mongoose.isValidObjectId(vid) || !mongoose.isValidObjectId(pid)) continue;
    let vendorCost = Number(row.vendorCost ?? NaN);
    if (Number.isNaN(vendorCost)) {
      const vc = await getVendorCostForProduct(vid, pid);
      vendorCost = vc ? vc.vendorCost : 0;
    }
    const retail = Number(row.retailPrice || 0);
    const agentId = row.agentId && mongoose.isValidObjectId(row.agentId) ? row.agentId : null;
    let dac = Number(row.defaultAgentCommission || 0);
    if (agentId) {
      dac = await getAgentCommissionForProduct(agentId, pid, dac);
    }
    const pba = retail - vendorCost;
    const net = pba - dac;
    const lineDoc = {
      vendorId: vid,
      productId: pid,
      retailPrice: retail,
      vendorCost,
      defaultAgentCommission: dac,
      profitBeforeAgent: pba,
      netProfit: net,
      profit: net,
    };
    if (agentId) lineDoc.agentId = agentId;
    lines.push(lineDoc);
  }
  const doc = await PriceList.findByIdAndUpdate(
    id,
    {
      $set: {
        listName: String(payload.listName || '').trim(),
        orgName: String(payload.orgName || '').trim(),
        lines,
        updatedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );
  if (!doc) throw new Error('Price list not found');
  return { id: String(doc._id) };
}

export async function deletePriceList(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid id');
  const r = await PriceList.findByIdAndDelete(id);
  if (!r) throw new Error('Price list not found');
  return { ok: true };
}

function assertValidLandingSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || s.length < 2 || s.length > 80) {
    throw new Error(
      'מזהה URL (slug) חייב להיות באנגלית קטנה, מספרים ומקפים בלבד — לדוגמה: doctor-plan-2025'
    );
  }
  return s;
}

function serializeLandingPageDoc(d) {
  if (!d) return null;
  const items = Array.isArray(d.whatYouGetItems)
    ? d.whatYouGetItems.map((it) => ({
        title: String(it?.title || '').trim(),
        description: String(it?.description || '').trim(),
        icon: String(it?.icon || 'phone').trim() || 'phone',
      }))
    : [];
  return {
    id: String(d._id),
    slug: d.slug,
    pageTitle: d.pageTitle || '',
    subTitle: d.subTitle || '',
    mainContent: d.mainContent || '',
    subContent: d.subContent || '',
    imageUrl: d.imageUrl || '',
    pageType: d.pageType === 'contact' ? 'contact' : 'sales',
    priceListId: d.priceListId ? String(d.priceListId) : '',
    whatYouGetTitle: d.whatYouGetTitle || '',
    whatYouGetSubtitle: d.whatYouGetSubtitle || '',
    whatYouGetItems: items,
    registrationTitle: d.registrationTitle || '',
    registrationSubtitle: d.registrationSubtitle || '',
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

export async function listLandingPages() {
  await ensureConnection();
  const docs = await LandingPage.find({}).sort({ updatedAt: -1 }).lean();
  return docs.map(serializeLandingPageDoc);
}

const WHAT_YOU_GET_ICON_KEYS = new Set(['phone', 'users', 'pill', 'stethoscope', 'syringe', 'file']);

function normalizeWhatYouGetItems(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it) => {
      const title = String(it?.title || '').trim();
      const description = String(it?.description || '').trim();
      let icon = String(it?.icon || 'phone').trim().toLowerCase();
      if (!WHAT_YOU_GET_ICON_KEYS.has(icon)) icon = 'phone';
      return { title, description, icon };
    })
    .filter((it) => it.title || it.description);
}

export async function createLandingPage(payload) {
  await ensureConnection();
  const slug = assertValidLandingSlug(payload.slug);
  const pageType = payload.pageType === 'contact' ? 'contact' : 'sales';
  const exists = await LandingPage.findOne({ slug }).lean();
  if (exists) throw new Error('מזהה URL כבר בשימוש');

  let priceListId = null;
  if (pageType === 'sales') {
    const pid = payload.priceListId;
    if (!mongoose.isValidObjectId(pid)) throw new Error('נדרש מחירון תקין');
    const pl = await PriceList.findById(pid).lean();
    if (!pl) throw new Error('מחירון לא נמצא');
    priceListId = pid;
  }

  const wItems = normalizeWhatYouGetItems(payload.whatYouGetItems);
  const doc = await LandingPage.create({
    slug,
    pageType,
    pageTitle: String(payload.pageTitle || '').trim(),
    subTitle: String(payload.subTitle || '').trim(),
    mainContent: String(payload.mainContent || ''),
    subContent: String(payload.subContent || ''),
    imageUrl: String(payload.imageUrl || '').trim(),
    priceListId,
    whatYouGetTitle: String(payload.whatYouGetTitle || '').trim(),
    whatYouGetSubtitle: String(payload.whatYouGetSubtitle || '').trim(),
    whatYouGetItems: wItems,
    registrationTitle: String(payload.registrationTitle || '').trim(),
    registrationSubtitle: String(payload.registrationSubtitle || '').trim(),
  });
  return { id: String(doc._id), slug };
}

export async function updateLandingPage(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid id');
  const set = { updatedAt: new Date() };
  if (payload.slug != null) {
    const newSlug = assertValidLandingSlug(payload.slug);
    const clash = await LandingPage.findOne({ slug: newSlug, _id: { $ne: id } }).lean();
    if (clash) throw new Error('מזהה URL כבר בשימוש');
    set.slug = newSlug;
  }
  if (payload.pageTitle != null) set.pageTitle = String(payload.pageTitle).trim();
  if (payload.subTitle != null) set.subTitle = String(payload.subTitle).trim();
  if (payload.mainContent != null) set.mainContent = String(payload.mainContent);
  if (payload.subContent != null) set.subContent = String(payload.subContent);
  if (payload.imageUrl != null) set.imageUrl = String(payload.imageUrl).trim();
  if (payload.whatYouGetTitle != null) set.whatYouGetTitle = String(payload.whatYouGetTitle).trim();
  if (payload.whatYouGetSubtitle != null) set.whatYouGetSubtitle = String(payload.whatYouGetSubtitle).trim();
  if (payload.whatYouGetItems != null) set.whatYouGetItems = normalizeWhatYouGetItems(payload.whatYouGetItems);
  if (payload.registrationTitle != null) set.registrationTitle = String(payload.registrationTitle).trim();
  if (payload.registrationSubtitle != null) set.registrationSubtitle = String(payload.registrationSubtitle).trim();
  if (payload.pageType != null) {
    const pt = payload.pageType === 'contact' ? 'contact' : 'sales';
    set.pageType = pt;
    if (pt === 'contact') set.priceListId = null;
  }
  if (payload.priceListId != null) {
    if (payload.priceListId === '' || payload.priceListId === null) {
      set.priceListId = null;
    } else {
      if (!mongoose.isValidObjectId(payload.priceListId)) throw new Error('מחירון לא תקין');
      const pl = await PriceList.findById(payload.priceListId).lean();
      if (!pl) throw new Error('מחירון לא נמצא');
      set.priceListId = payload.priceListId;
    }
  }
  const doc = await LandingPage.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!doc) throw new Error('דף לא נמצא');
  return serializeLandingPageDoc(doc);
}

export async function deleteLandingPage(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid id');
  const r = await LandingPage.findByIdAndDelete(id);
  if (!r) throw new Error('דף לא נמצא');
  return { ok: true };
}

/** דף נחיתה ציבורי — תוכן + מחירון (מכירות) או דף צור קשר */
export async function getPublicLandingPageBySlug(slug) {
  await ensureConnection();
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return null;
  const doc = await LandingPage.findOne({ slug: s }).lean();
  if (!doc) return null;
  const pageType = doc.pageType === 'contact' ? 'contact' : 'sales';
  const items = Array.isArray(doc.whatYouGetItems)
    ? doc.whatYouGetItems.map((it) => ({
        title: String(it?.title || '').trim(),
        description: String(it?.description || '').trim(),
        icon: String(it?.icon || 'phone').trim() || 'phone',
      }))
    : [];

  if (pageType === 'contact') {
    return {
      pageType: 'contact',
      slug: doc.slug,
      pageTitle: doc.pageTitle || '',
      subTitle: doc.subTitle || '',
      mainContent: doc.mainContent || '',
      subContent: doc.subContent || '',
      imageUrl: doc.imageUrl || '',
      whatYouGetTitle: doc.whatYouGetTitle || '',
      whatYouGetSubtitle: doc.whatYouGetSubtitle || '',
      whatYouGetItems: items,
      registrationTitle: doc.registrationTitle || '',
      registrationSubtitle: doc.registrationSubtitle || '',
      priceList: null,
    };
  }

  if (!doc.priceListId) return null;
  const pl = await getPublicPriceListById(String(doc.priceListId));
  if (!pl) return null;
  return {
    pageType: 'sales',
    slug: doc.slug,
    pageTitle: doc.pageTitle || '',
    subTitle: doc.subTitle || '',
    mainContent: doc.mainContent || '',
    subContent: doc.subContent || '',
    imageUrl: doc.imageUrl || '',
    whatYouGetTitle: doc.whatYouGetTitle || '',
    whatYouGetSubtitle: doc.whatYouGetSubtitle || '',
    whatYouGetItems: items,
    registrationTitle: doc.registrationTitle || '',
    registrationSubtitle: doc.registrationSubtitle || '',
    priceList: pl,
  };
}

/** דף נחיתה ציבורי — ללא עלויות פנימיות */
export async function getPublicPriceListById(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PriceList.findById(id).lean();
  if (!doc) return null;
  const lines = doc.lines || [];
  const products = [];
  for (const line of lines) {
    const pid = line.productId;
    const p = await Product.findById(pid).select('productName name baseDescription sku imageUrl').lean();
    if (!p) continue;
    products.push({
      productId: String(pid),
      productName: p.productName || p.name || '',
      baseDescription: p.baseDescription || '',
      sku: p.sku || '',
      imageUrl: p.imageUrl || '',
      retailPrice: Number(line.retailPrice || 0),
    });
  }
  return {
    priceListId: String(doc._id),
    listName: doc.listName,
    organizationName: doc.orgName || '',
    products,
  };
}

export async function createPricingEntry(payload) {
  await ensureConnection();
  const vendorId = payload.vendorId;
  const productId = payload.productId;
  if (!mongoose.isValidObjectId(vendorId) || !mongoose.isValidObjectId(productId)) {
    throw new Error('Invalid vendorId or productId');
  }
  let vendorCost = Number(payload.vendorCost ?? NaN);
  if (Number.isNaN(vendorCost)) {
    const vc = await getVendorCostForProduct(vendorId, productId);
    vendorCost = vc ? vc.vendorCost : 0;
  }
  const retailPrice = Number(payload.retailPrice || 0);
  const agentCommission = Number(payload.agentCommission || 0);
  const pba = retailPrice - vendorCost;
  const net = pba - agentCommission;
  const doc = await PricingEntry.create({
    pricingName: String(payload.pricingName || '').trim(),
    vendorId,
    productId,
    orgName: String(payload.orgName || '').trim(),
    retailPrice,
    vendorCost,
    agentCommission,
    profitBeforeAgent: pba,
    netProfit: net,
    profit: net,
  });
  return { id: String(doc._id) };
}

export async function listPricingEntries() {
  await ensureConnection();
  const docs = await PricingEntry.find({})
    .sort({ createdAt: -1 })
    .populate('vendorId')
    .populate('productId')
    .lean();
  return docs.map((d) => {
    const v = d.vendorId;
    const p = d.productId;
    const r = Number(d.retailPrice || 0);
    const vc = Number(d.vendorCost || 0);
    const ac = Number(d.agentCommission || 0);
    const pba = d.profitBeforeAgent != null ? Number(d.profitBeforeAgent) : r - vc;
    const net = d.netProfit != null ? Number(d.netProfit) : pba - ac;
    return {
      id: String(d._id),
      pricingName: d.pricingName,
      orgName: d.orgName || '',
      retailPrice: r,
      vendorCost: vc,
      agentCommission: ac,
      profitBeforeAgent: pba,
      netProfit: net,
      profit: Number(d.profit ?? net),
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      vendor: v && typeof v === 'object' ? { id: String(v._id), vendorName: v.vendorName } : { id: String(d.vendorId), vendorName: '' },
      product:
        p && typeof p === 'object'
          ? {
              id: String(p._id),
              productName: p.productName || p.name,
              sku: p.sku,
            }
          : { id: String(d.productId), productName: '', sku: '' },
    };
  });
}

export async function updatePricingEntry(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid pricing entry id');
  const vendorId = payload.vendorId;
  const productId = payload.productId;
  if (!mongoose.isValidObjectId(vendorId) || !mongoose.isValidObjectId(productId)) {
    throw new Error('Invalid vendorId or productId');
  }
  let vendorCost = Number(payload.vendorCost ?? NaN);
  if (Number.isNaN(vendorCost)) {
    const vc = await getVendorCostForProduct(vendorId, productId);
    vendorCost = vc ? vc.vendorCost : 0;
  }
  const retailPrice = Number(payload.retailPrice || 0);
  const agentCommission = Number(payload.agentCommission || 0);
  const pba = retailPrice - vendorCost;
  const net = pba - agentCommission;
  const doc = await PricingEntry.findByIdAndUpdate(
    id,
    {
      $set: {
        pricingName: String(payload.pricingName || '').trim(),
        vendorId,
        productId,
        orgName: String(payload.orgName || '').trim(),
        retailPrice,
        vendorCost,
        agentCommission,
        profitBeforeAgent: pba,
        netProfit: net,
        profit: net,
      },
    },
    { new: true, runValidators: true }
  );
  if (!doc) throw new Error('Pricing entry not found');
  return { id: String(doc._id) };
}

export async function deletePricingEntry(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid id');
  const r = await PricingEntry.findByIdAndDelete(id);
  if (!r) throw new Error('Pricing entry not found');
  return { ok: true };
}

function normalizeAgentProductCommissions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const row of raw) {
    const pid = row?.productId;
    if (!pid || !mongoose.isValidObjectId(pid)) continue;
    const key = String(pid);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      productId: new mongoose.Types.ObjectId(pid),
      commission: Math.max(0, Number(row.commission || 0)),
    });
  }
  return out;
}

export async function createSalesAgent(payload) {
  await ensureConnection();
  const b = payload.bankDetails || {};
  const doc = await SalesAgent.create({
    agentName: String(payload.agentName || '').trim(),
    idNum: String(payload.idNum || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    address: String(payload.address || '').trim(),
    bankDetails: {
      bankName: String(b.bankName || '').trim(),
      bankNum: String(b.bankNum || '').trim(),
      accountHolder: String(b.accountHolder || '').trim(),
      branchNum: String(b.branchNum || '').trim(),
      accountNum: String(b.accountNum || '').trim(),
    },
    productCommissions: normalizeAgentProductCommissions(payload.productCommissions),
  });
  return { id: String(doc._id) };
}

export async function listSalesAgentsWithSales() {
  await ensureConnection();
  const docs = await SalesAgent.find({}).sort({ createdAt: -1 }).lean();
  const rows = await Promise.all(
    docs.map(async (d) => {
      const id = String(d._id);
      const totalSales = await countDealsByAgentId(id);
      const pc = Array.isArray(d.productCommissions) ? d.productCommissions : [];
      const productCommissions = await Promise.all(
        pc.map(async (row) => {
          const pid = row.productId;
          const p = await Product.findById(pid).select('productName name sku').lean();
          return {
            productId: String(pid),
            commission: Number(row.commission || 0),
            productName: p ? p.productName || p.name || '' : '',
            sku: p?.sku || '',
          };
        })
      );
      return {
        id,
        agentName: d.agentName,
        idNum: d.idNum,
        phone: d.phone,
        email: d.email,
        address: d.address,
        bankDetails: d.bankDetails || {},
        productCommissions,
        totalSales,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      };
    })
  );
  return rows;
}

export async function updateSalesAgent(id, payload) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid agent id');
  const b = payload.bankDetails || {};
  const doc = await SalesAgent.findByIdAndUpdate(
    id,
    {
      $set: {
        agentName: String(payload.agentName || '').trim(),
        idNum: String(payload.idNum || '').trim(),
        phone: String(payload.phone || '').trim(),
        email: String(payload.email || '').trim(),
        address: String(payload.address || '').trim(),
        bankDetails: {
          bankName: String(b.bankName || '').trim(),
          bankNum: String(b.bankNum || '').trim(),
          accountHolder: String(b.accountHolder || '').trim(),
          branchNum: String(b.branchNum || '').trim(),
          accountNum: String(b.accountNum || '').trim(),
        },
        productCommissions: normalizeAgentProductCommissions(payload.productCommissions),
        updatedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!doc) throw new Error('Agent not found');
  return { id: String(doc._id) };
}

export async function deleteSalesAgent(id) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(id)) throw new Error('Invalid agent id');
  const oid = new mongoose.Types.ObjectId(id);
  const n = await countDealsByAgentId(String(id));
  if (n > 0) throw new Error(`לא ניתן למחוק סוכן עם ${n} עסקאות מקושרות`);
  const r = await SalesAgent.findByIdAndDelete(oid);
  if (!r) throw new Error('Agent not found');
  return { ok: true };
}

/** לשימוש ב-webhook: קישור מנוי לסוכן */
export async function resolveAgentIdFromFormState(formState) {
  await ensureConnection();
  const fs = formState && typeof formState === 'object' ? formState : {};
  const direct = String(fs.agentId || '').trim();
  if (direct && mongoose.isValidObjectId(direct)) {
    const a = await SalesAgent.findById(direct).lean();
    if (a) return String(a._id);
  }
  const name = String(fs.agentName || '').trim();
  if (name) {
    const byName = await SalesAgent.findOne({ agentName: name }).lean();
    if (byName) return String(byName._id);
  }
  return null;
}

export async function listPublicSalesAgents() {
  await ensureConnection();
  const docs = await SalesAgent.find({}).sort({ agentName: 1 }).select('agentName').lean();
  return docs.map((d) => ({ id: String(d._id), agentName: d.agentName }));
}

export async function createOrgPricingPolicy(payload) {
  await ensureConnection();
  const related = Array.isArray(payload.relatedProducts) ? payload.relatedProducts : [];
  const lines = related.map((r) => {
    const retail = Number(r.retailPrice || 0);
    const vendor = Number(r.vendorCost || 0);
    const ac = Number(r.agentCommission || 0);
    return {
      vendorId: r.vendorId || undefined,
      productId: r.productId,
      retailPrice: retail,
      vendorCost: vendor,
      agentCommission: ac,
      profitBeforeAgent: retail - vendor,
      netProfit: retail - vendor - ac,
      profit: retail - vendor - ac,
    };
  });
  const doc = await OrgPricingPolicy.create({
    organizationName: String(payload.organizationName || '').trim(),
    pricingListName: String(payload.pricingListName || '').trim(),
    relatedProducts: lines,
  });
  return { id: String(doc._id) };
}

export async function listOrgPricingPolicies() {
  await ensureConnection();
  const docs = await OrgPricingPolicy.find({})
    .sort({ createdAt: -1 })
    .populate('relatedProducts.productId')
    .populate('relatedProducts.vendorId')
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    organizationName: d.organizationName,
    pricingListName: d.pricingListName,
    relatedProducts: (d.relatedProducts || []).map((line) => {
      const p = line.productId;
      const v = line.vendorId;
      const product =
        p && typeof p === 'object'
          ? {
              id: String(p._id || p),
              productName: p.productName || p.name,
              name: p.productName || p.name,
              sku: p.sku,
              baseDescription: p.baseDescription || '',
            }
          : { id: String(line.productId), productName: '', name: '', sku: '', baseDescription: '' };
      const vendor =
        v && typeof v === 'object'
          ? { id: String(v._id), vendorName: v.vendorName }
          : line.vendorId
            ? { id: String(line.vendorId), vendorName: '' }
            : null;
      const retail = Number(line.retailPrice || 0);
      const vc = Number(line.vendorCost || 0);
      const ac = Number(line.agentCommission || 0);
      const pba = line.profitBeforeAgent != null ? Number(line.profitBeforeAgent) : retail - vc;
      const net = line.netProfit != null ? Number(line.netProfit) : pba - ac;
      return {
        vendorId: vendor?.id || (line.vendorId ? String(line.vendorId) : null),
        vendor,
        productId: product.id,
        product,
        retailPrice: retail,
        vendorCost: vc,
        agentCommission: ac,
        profitBeforeAgent: pba,
        netProfit: net,
        profit: line.profit != null ? Number(line.profit) : net,
      };
    }),
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  }));
}

/** Public: resolve pricing for landing pages (?pricingId=ObjectId) */
export async function getPricingContextByPricingId(pricingId) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(pricingId)) return null;
  const doc = await OrgPricingPolicy.findById(pricingId).populate('relatedProducts.productId').populate('relatedProducts.vendorId').lean();
  if (!doc) return null;
  const lines = doc.relatedProducts || [];
  const products = lines.map((line) => {
    const p = line.productId;
    const name = p && typeof p === 'object' ? p.productName || p.name : '';
    const sku = p && typeof p === 'object' ? p.sku : '';
    const baseDescription = p && typeof p === 'object' ? p.baseDescription || '' : '';
    const productId = p && typeof p === 'object' ? String(p._id) : String(line.productId);
    const rv = Number(line.retailPrice || 0);
    const vendor = Number(line.vendorCost || 0);
    const ac = Number(line.agentCommission || 0);
    const pba = line.profitBeforeAgent != null ? Number(line.profitBeforeAgent) : rv - vendor;
    const net = line.netProfit != null ? Number(line.netProfit) : pba - ac;
    return {
      productId,
      vendorId: line.vendorId ? String(line.vendorId) : null,
      productName: name,
      name,
      sku,
      baseDescription,
      retailPrice: rv,
      vendorCost: vendor,
      agentCommission: ac,
      profitBeforeAgent: pba,
      netProfit: net,
      profit: Number(line.profit ?? net),
    };
  });
  return {
    pricingId: String(doc._id),
    organizationName: doc.organizationName,
    pricingListName: doc.pricingListName,
    products,
  };
}

export async function upsertCheckoutDraft({ sessionKey, formSnapshot, step, completed }) {
  await ensureConnection();
  const key = String(sessionKey || '').trim();
  if (!key) throw new Error('sessionKey is required');
  const now = new Date();
  await CheckoutDraft.findOneAndUpdate(
    { sessionKey: key },
    {
      $set: {
        formSnapshot: formSnapshot || {},
        step: step || 'checkout',
        completed: !!completed,
        updatedAt: now,
      },
      $setOnInsert: { sessionKey: key },
    },
    { upsert: true, new: true }
  );
  return { ok: true };
}

export async function listIncompleteCheckoutDrafts(limit = 100) {
  await ensureConnection();
  const docs = await CheckoutDraft.find({ completed: false }).sort({ updatedAt: -1 }).limit(limit).lean();
  return docs.map((d) => ({
    id: String(d._id),
    sessionKey: d.sessionKey,
    step: d.step,
    formSnapshot: d.formSnapshot || {},
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  }));
}

export async function createAgent(payload) {
  await ensureConnection();
  const retail = Number(payload?.commissionModel?.retailPrice || 0);
  const vendor = Number(payload?.commissionModel?.vendorCost || 0);
  const doc = await Agent.create({
    personal: payload.personal,
    bankDetails: payload.bankDetails,
    commissionModel: {
      ...payload.commissionModel,
      retailPrice: retail,
      vendorCost: vendor,
      profitBeforeAgent: retail - vendor,
      agentCommission: Number(payload?.commissionModel?.agentCommission || 0),
      baseFee: Number(payload?.commissionModel?.baseFee || 0),
    },
  });
  return { id: String(doc._id) };
}

export async function listAgents() {
  await ensureConnection();
  const docs = await Agent.find({}).sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({
    id: String(d._id),
    personal: d.personal,
    bankDetails: d.bankDetails,
    commissionModel: d.commissionModel,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  }));
}
