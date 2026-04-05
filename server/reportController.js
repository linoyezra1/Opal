/**
 * דוחות וייצוא CSV — מרכז הדוחות והבילינג של אופאל
 */
import { Parser } from 'json2csv';

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function splitFullName(full) {
  const s = String(full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * שורה מפורטת לכל נפש: מוטב ראשי + מוטבים נוספים
 * @param {object[]} deals — מסמכי deals ממונגו
 * @returns {object[]}
 */
export function generateFlattenedSubscriberRows(deals) {
  const rows = [];
  for (const d of deals) {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const bu = d.beneficiaryUpdate && typeof d.beneficiaryUpdate === 'object' ? d.beneficiaryUpdate : {};
    const primary = bu.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
    const fromAdditional = Array.isArray(bu.additionalMembers) ? bu.additionalMembers : [];
    const fromFsBen = Array.isArray(fs.beneficiaries) ? fs.beneficiaries : [];

    const payerAmount = Number(d.payerAmount || 0);
    const billingMonth = String(d.billingMonth || '').trim();
    const commissionAmount = Number(d.commissionAmount ?? fs.resolvedAgentCommission ?? 0);
    const createdAt =
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt || '';
    const org = firstNonEmpty(bu.organizationName, fs.organizationName);
    const agentName = firstNonEmpty(bu.agentName, fs.agentName);
    const transactionId = String(d.transactionId || '');
    const dealId = String(d._id || '');

    const primaryFirst = firstNonEmpty(primary.firstName, splitFullName(fs.fullName).firstName);
    const primaryLast = firstNonEmpty(primary.lastName, splitFullName(fs.fullName).lastName);
    const primaryId = firstNonEmpty(primary.id, fs.id);
    const primaryPhone = firstNonEmpty(primary.phone, fs.phone);
    const primaryEmail = firstNonEmpty(primary.email, fs.email);
    const primaryAddress = firstNonEmpty(primary.address, fs.address);
    const primaryDob = firstNonEmpty(primary.dateOfBirth, fs.dateOfBirth);
    const primaryGender = firstNonEmpty(primary.gender, fs.gender);
    const primaryHealthFund = firstNonEmpty(primary.healthFund, fs.healthFund);
    const primarySupplemental = firstNonEmpty(primary.supplementalInsurance, fs.supplementalInsurance);

    rows.push({
      dealId,
      transactionId,
      rowRole: 'primary',
      organizationName: org,
      agentName,
      agentId: String(d.agentId || fs.agentId || ''),
      firstName: primaryFirst,
      lastName: primaryLast,
      idNumber: primaryId,
      phone: primaryPhone,
      email: primaryEmail,
      address: primaryAddress,
      dateOfBirth: primaryDob,
      gender: primaryGender,
      healthFund: primaryHealthFund,
      supplementalInsurance: primarySupplemental,
      payerAmount,
      billingMonth,
      commissionAmount,
      paymentStatus: String(d.paymentStatus || ''),
      subscriptionStatus: String(d.subscriptionStatus || ''),
      productName: String(fs.productName || ''),
      createdAt,
    });

    const extras =
      fromAdditional.length > 0
        ? fromAdditional.map((m) => ({
            firstName: String(m.firstName || '').trim(),
            lastName: String(m.lastName || '').trim(),
            idNumber: String(m.id || '').trim(),
            phone: String(m.phone || '').trim(),
            email: String(m.email || '').trim(),
            address: String(m.address || '').trim(),
            dateOfBirth: String(m.dateOfBirth || '').trim(),
          }))
        : fromFsBen.map((m) => ({
            firstName: String(m.firstName || '').trim(),
            lastName: String(m.lastName || '').trim(),
            idNumber: String(m.id || '').trim(),
            phone: String(m.phone || '').trim(),
            email: String(m.email || '').trim(),
            address: '',
            dateOfBirth: String(m.dateOfBirth || '').trim(),
          }));

    for (const m of extras) {
      if (
        !m.firstName &&
        !m.lastName &&
        !m.idNumber &&
        !m.phone &&
        !m.email
      ) {
        continue;
      }
      rows.push({
        dealId,
        transactionId,
        rowRole: 'beneficiary',
        organizationName: org,
        agentName,
        agentId: String(d.agentId || fs.agentId || ''),
        firstName: m.firstName,
        lastName: m.lastName,
        idNumber: m.idNumber,
        phone: m.phone,
        email: m.email,
        address: m.address,
        dateOfBirth: m.dateOfBirth,
        gender: '',
        healthFund: String(m.healthFund || '').trim(),
        supplementalInsurance: String(m.supplementalInsurance || '').trim(),
        payerAmount,
        billingMonth,
        commissionAmount,
        paymentStatus: String(d.paymentStatus || ''),
        subscriptionStatus: String(d.subscriptionStatus || ''),
        productName: String(fs.productName || ''),
        createdAt,
      });
    }
  }
  return rows;
}

export function generateCancellationExportRows(deals) {
  return deals.map((d) => {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const bu = d.beneficiaryUpdate && typeof d.beneficiaryUpdate === 'object' ? d.beneficiaryUpdate : {};
    const primary = bu.primaryMember && typeof bu.primaryMember === 'object' ? bu.primaryMember : {};
    const full = firstNonEmpty(
      [primary.firstName, primary.lastName].filter(Boolean).join(' '),
      fs.fullName
    );
    const cancelAt = d.cancellationDate
      ? d.cancellationDate instanceof Date
        ? d.cancellationDate.toISOString()
        : String(d.cancellationDate)
      : '';
    const benCount = Array.isArray(bu.additionalMembers)
      ? bu.additionalMembers.length
      : Array.isArray(fs.beneficiaries)
        ? fs.beneficiaries.length
        : 0;

    return {
      dealId: String(d._id || ''),
      transactionId: String(d.transactionId || ''),
      cancellationDate: cancelAt,
      primaryFullName: full,
      idNumber: firstNonEmpty(primary.id, fs.id),
      phone: firstNonEmpty(primary.phone, fs.phone),
      email: firstNonEmpty(primary.email, fs.email),
      organizationName: firstNonEmpty(bu.organizationName, fs.organizationName),
      agentName: firstNonEmpty(bu.agentName, fs.agentName),
      payerAmount: Number(d.payerAmount || 0),
      billingMonth: String(d.billingMonth || '').trim(),
      paymentStatus: String(d.paymentStatus || ''),
      subscriptionStatus: String(d.subscriptionStatus || ''),
      secondaryBeneficiaryCount: benCount,
    };
  });
}

const SUBSCRIBER_FIELDS = [
  { label: 'מזהה עסקה DB', value: 'dealId' },
  { label: 'מספר הזמנה', value: 'transactionId' },
  { label: 'סוג שורה', value: 'rowRole' },
  { label: 'ארגון', value: 'organizationName' },
  { label: 'סוכן', value: 'agentName' },
  { label: 'מזהה סוכן', value: 'agentId' },
  { label: 'שם פרטי', value: 'firstName' },
  { label: 'שם משפחה', value: 'lastName' },
  { label: 'תעודת זהות', value: 'idNumber' },
  { label: 'טלפון', value: 'phone' },
  { label: 'אימייל', value: 'email' },
  { label: 'כתובת', value: 'address' },
  { label: 'תאריך לידה', value: 'dateOfBirth' },
  { label: 'מין', value: 'gender' },
  { label: 'קופת חולים', value: 'healthFund' },
  { label: 'ביטוח משלים', value: 'supplementalInsurance' },
  { label: 'סכום תשלום', value: 'payerAmount' },
  { label: 'חודש בילינג', value: 'billingMonth' },
  { label: 'עמלה', value: 'commissionAmount' },
  { label: 'סטטוס תשלום', value: 'paymentStatus' },
  { label: 'סטטוס מנוי', value: 'subscriptionStatus' },
  { label: 'מוצר', value: 'productName' },
  { label: 'נוצר בתאריך', value: 'createdAt' },
];

const CANCEL_FIELDS = [
  { label: 'מזהה עסקה DB', value: 'dealId' },
  { label: 'מספר הזמנה', value: 'transactionId' },
  { label: 'תאריך ביטול', value: 'cancellationDate' },
  { label: 'שם מבוטח ראשי', value: 'primaryFullName' },
  { label: 'תעודת זהות', value: 'idNumber' },
  { label: 'טלפון', value: 'phone' },
  { label: 'אימייל', value: 'email' },
  { label: 'ארגון', value: 'organizationName' },
  { label: 'סוכן', value: 'agentName' },
  { label: 'סכום', value: 'payerAmount' },
  { label: 'חודש בילינג', value: 'billingMonth' },
  { label: 'סטטוס תשלום', value: 'paymentStatus' },
  { label: 'סטטוס מנוי', value: 'subscriptionStatus' },
  { label: 'מספר מוטבים משניים', value: 'secondaryBeneficiaryCount' },
];

export function rowsToCsv(rows, fields) {
  const parser = new Parser({
    fields,
    withBOM: true,
    defaultValue: '',
  });
  return parser.parse(rows);
}

export function buildSubscribersCsv(deals) {
  const rows = generateFlattenedSubscriberRows(deals);
  return rowsToCsv(rows, SUBSCRIBER_FIELDS);
}

export function buildCancellationsCsv(deals) {
  const rows = generateCancellationExportRows(deals);
  return rowsToCsv(rows, CANCEL_FIELDS);
}

export function buildAgentCommissionPayload(deals) {
  const rows = deals.map((d) => {
    const fs = d.formState && typeof d.formState === 'object' ? d.formState : {};
    const payerAmount = Number(d.payerAmount || 0);
    const commissionAmount = Number(d.commissionAmount ?? fs.resolvedAgentCommission ?? 0);
    const createdAt =
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt || '';
    return {
      dealId: String(d._id || ''),
      transactionId: String(d.transactionId || ''),
      createdAt,
      payerAmount,
      commissionAmount,
      productName: String(fs.productName || ''),
      paymentStatus: String(d.paymentStatus || ''),
    };
  });
  const totalCommission = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalSales = rows.reduce((s, r) => s + r.payerAmount, 0);
  return {
    rows,
    totalCommission,
    totalSales,
    dealCount: rows.length,
  };
}
