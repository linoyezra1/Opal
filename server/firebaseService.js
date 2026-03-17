import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const inline = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (inline) {
    const parsed = JSON.parse(inline);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON');
    }
    return parsed;
  }

  const path =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    resolve(process.cwd(), 'service-account.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!data.project_id || !data.client_email || !data.private_key) {
    throw new Error('Invalid service-account JSON');
  }
  return data;
}

function getDb() {
  if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

export async function saveDeal(params) {
  const db = getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');

  const ref = db.collection('deals').doc(transactionId);
  const snap = await ref.get();
  if (snap.exists) {
    return { duplicate: true, id: ref.id };
  }

  const payload = {
    transactionId,
    payerAmount: Number(params.payerAmount || 0),
    formState: params.formState || {},
    terminalNumber: Number(params.terminalNumber || 0),
    paymentStatus: params.paymentStatus || 'success',
    source: params.source || 'webhook',
    indicator: params.indicator || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);
  return { duplicate: false, id: ref.id };
}

export async function saveBeneficiaryUpdate(params) {
  const db = getDb();
  const transactionId = String(params.transactionId || '').trim();
  if (!transactionId) throw new Error('Missing transactionId');

  const ref = db.collection('deals').doc(transactionId);
  const updatePayload = {
    transactionId,
    organizationName: params.organizationName || '',
    agentName: params.agentName || '',
    primaryMember: params.primaryMember || {},
    additionalMembers: params.additionalMembers || [],
    submittedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(
    {
      beneficiaryUpdate: updatePayload,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { id: ref.id };
}

export async function saveContactLead(params) {
  const db = getDb();
  const ref = db.collection('contactLeads').doc();
  await ref.set({
    name: params.name || '',
    email: params.email || '',
    phone: params.phone || '',
    message: params.message || '',
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function saveOrganizationLead(params) {
  const db = getDb();
  const ref = db.collection('organizationLeads').doc();
  await ref.set({
    organizationName: params.organizationName || '',
    contactName: params.contactName || '',
    phone: params.phone || '',
    email: params.email || '',
    notes: params.notes || '',
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function getDeals() {
  const db = getDb();
  const snap = await db.collection('deals').orderBy('createdAt', 'desc').limit(500).get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      ...d,
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
      updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : null,
      beneficiarySubmittedAt: d.beneficiaryUpdate?.submittedAt?.toDate
        ? d.beneficiaryUpdate.submittedAt.toDate().toISOString()
        : null,
    };
  });
}
