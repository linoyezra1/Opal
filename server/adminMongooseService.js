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

productSchema.pre('validate', function productValidate(next) {
  const pn = String(this.productName || this.name || '').trim();
  if (pn) {
    this.productName = pn;
    this.name = pn;
  }
  if (!String(this.productName || '').trim()) {
    this.invalidate('productName', 'productName is required');
  }
  next();
});

productSchema.pre('save', function productPreSave(next) {
  this.updatedAt = new Date();
  next();
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

vendorSchema.pre('save', function vendorPreSave(next) {
  this.updatedAt = new Date();
  next();
});

const pricingEntrySchema = new mongoose.Schema(
  {
    pricingName: { type: String, required: true, trim: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    orgName: { type: String, default: '' },
    retailPrice: { type: Number, required: true, min: 0, default: 0 },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
    profit: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

pricingEntrySchema.pre('save', function pricingEntryPreSave(next) {
  const r = Number(this.retailPrice || 0);
  const v = Number(this.vendorCost || 0);
  this.retailPrice = r;
  this.vendorCost = v;
  this.profit = r - v;
  next();
});

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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

salesAgentSchema.pre('save', function salesAgentPreSave(next) {
  this.updatedAt = new Date();
  next();
});

const relatedProductLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    retailPrice: { type: Number, required: true, min: 0, default: 0 },
    vendorCost: { type: Number, required: true, min: 0, default: 0 },
    profit: { type: Number, required: true, default: 0 },
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

orgPricingPolicySchema.pre('save', function orgPricingPreSave(next) {
  const lines = this.relatedProducts || [];
  for (const line of lines) {
    const retail = Number(line.retailPrice || 0);
    const vendor = Number(line.vendorCost || 0);
    line.retailPrice = retail;
    line.vendorCost = vendor;
    line.profit = retail - vendor;
  }
  this.updatedAt = new Date();
  next();
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

agentSchema.pre('save', function updateProfit(next) {
  const retail = Number(this.commissionModel?.retailPrice || 0);
  const vendor = Number(this.commissionModel?.vendorCost || 0);
  this.commissionModel.profitBeforeAgent = retail - vendor;
  this.updatedAt = new Date();
  next();
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

/** מחיר ספק למוצר (למילוי אוטומטי במחירון) */
export async function getVendorCostForProduct(vendorId, productId) {
  await ensureConnection();
  if (!mongoose.isValidObjectId(vendorId) || !mongoose.isValidObjectId(productId)) return null;
  const v = await Vendor.findById(vendorId).populate('productLinks.productId').lean();
  if (!v) return null;
  const line = (v.productLinks || []).find((l) => String(l.productId) === String(productId));
  if (!line) return null;
  const p = line.productId;
  const sku = p && typeof p === 'object' ? p.sku : line.sku;
  return {
    vendorCost: Number(line.vendorCost || 0),
    sku: sku || '',
    vendorName: v.vendorName,
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
  const doc = await PricingEntry.create({
    pricingName: String(payload.pricingName || '').trim(),
    vendorId,
    productId,
    orgName: String(payload.orgName || '').trim(),
    retailPrice,
    vendorCost,
    profit: retailPrice - vendorCost,
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
    return {
      id: String(d._id),
      pricingName: d.pricingName,
      orgName: d.orgName || '',
      retailPrice: Number(d.retailPrice || 0),
      vendorCost: Number(d.vendorCost || 0),
      profit: Number(d.profit ?? d.retailPrice - d.vendorCost),
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
      return {
        id,
        agentName: d.agentName,
        idNum: d.idNum,
        phone: d.phone,
        email: d.email,
        address: d.address,
        bankDetails: d.bankDetails || {},
        totalSales,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      };
    })
  );
  return rows;
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
  const lines = related.map((r) => ({
    productId: r.productId,
    retailPrice: Number(r.retailPrice || 0),
    vendorCost: Number(r.vendorCost || 0),
    profit: Number(r.retailPrice || 0) - Number(r.vendorCost || 0),
  }));
  const doc = await OrgPricingPolicy.create({
    organizationName: String(payload.organizationName || '').trim(),
    pricingListName: String(payload.pricingListName || '').trim(),
    relatedProducts: lines,
  });
  return { id: String(doc._id) };
}

export async function listOrgPricingPolicies() {
  await ensureConnection();
  const docs = await OrgPricingPolicy.find({}).sort({ createdAt: -1 }).populate('relatedProducts.productId').lean();
  return docs.map((d) => ({
    id: String(d._id),
    organizationName: d.organizationName,
    pricingListName: d.pricingListName,
    relatedProducts: (d.relatedProducts || []).map((line) => {
      const p = line.productId;
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
      return {
        productId: product.id,
        product,
        retailPrice: Number(line.retailPrice || 0),
        vendorCost: Number(line.vendorCost || 0),
        profit:
          line.profit != null
            ? Number(line.profit)
            : Number(line.retailPrice || 0) - Number(line.vendorCost || 0),
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
  const doc = await OrgPricingPolicy.findById(pricingId).populate('relatedProducts.productId').lean();
  if (!doc) return null;
  const lines = doc.relatedProducts || [];
  const products = lines.map((line) => {
    const p = line.productId;
    const name = p && typeof p === 'object' ? p.productName || p.name : '';
    const sku = p && typeof p === 'object' ? p.sku : '';
    const baseDescription = p && typeof p === 'object' ? p.baseDescription || '' : '';
    const productId = p && typeof p === 'object' ? String(p._id) : String(line.productId);
    return {
      productId,
      productName: name,
      name,
      sku,
      baseDescription,
      retailPrice: Number(line.retailPrice || 0),
      vendorCost: Number(line.vendorCost || 0),
      profit: Number(line.profit ?? Number(line.retailPrice || 0) - Number(line.vendorCost || 0)),
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
