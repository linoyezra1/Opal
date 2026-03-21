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
const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema, 'agents');

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
