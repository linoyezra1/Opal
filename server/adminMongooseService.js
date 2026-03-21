import mongoose from 'mongoose';

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
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    baseDescription: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

productSchema.pre('save', function productPreSave(next) {
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
  const doc = await Product.create({
    name: String(payload.name || '').trim(),
    sku: String(payload.sku || '').trim(),
    baseDescription: String(payload.baseDescription || ''),
  });
  return { id: String(doc._id) };
}

export async function listProducts() {
  await ensureConnection();
  const docs = await Product.find({}).sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    sku: d.sku,
    baseDescription: d.baseDescription || '',
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  }));
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
              name: p.name,
              sku: p.sku,
              baseDescription: p.baseDescription || '',
            }
          : { id: String(line.productId), name: '', sku: '', baseDescription: '' };
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
    const name = p && typeof p === 'object' ? p.name : '';
    const sku = p && typeof p === 'object' ? p.sku : '';
    const baseDescription = p && typeof p === 'object' ? p.baseDescription || '' : '';
    const productId = p && typeof p === 'object' ? String(p._id) : String(line.productId);
    return {
      productId,
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
