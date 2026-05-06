/**
 * scripts/auditEntitlement.js
 * ביקורת לוגיקת זכאות (Entitlement) — 4 בדיקות מלאות
 *
 * הרצה: node scripts/auditEntitlement.js
 */

import {
  getEntitlementStatus,
  parseFlexibleDate,
  STATUS_NOT_ACTIVATED,
  STATUS_ACTIVE,
  STATUS_PENDING_CANCELLATION,
  STATUS_CANCELED,
} from '../server/entitlementStatus.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL — ${label}${detail ? `\n     ${detail}` : ''}`);
    failed++;
  }
}

/** Returns YYYY-MM-DD using LOCAL time — consistent with Date.setMonth() */
function toLocalYMD(d) {
  if (!d) return 'null';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return 'invalid';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function firstOfNextMonth(from) {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/** NOW fixed for deterministic tests */
const NOW = new Date('2026-05-06T12:00:00.000Z');

// ─── Check 1: B2B Pending Cancel ────────────────────────────────────────────
console.log('\n══ Check 1: B2B Pending Cancel ══');
console.log('  ציפייה: subscriptionEndDate = 1 לחודש הבא (June 1 2026 בסביבה זו)\n');

// B2B uses cancelAt field — set to 1st of next month (local midnight)
const b2bCancelAt = firstOfNextMonth(NOW);
const expectedB2BEnd = toLocalYMD(b2bCancelAt);

const deal_b2b_pending = {
  isCentralized: true,
  formState: { subscriptionStartDate: '2026-01-15' },
  cancellationDate: NOW,
  cancelAt: b2bCancelAt,
};

const r1 = getEntitlementStatus(deal_b2b_pending, NOW);

assert(r1.status === STATUS_PENDING_CANCELLATION,
  `status = pending_cancellation`,
  `קיבלנו: ${r1.status}`);

const r1EndDate = r1.cancelAt ? new Date(r1.cancelAt) : null;
assert(toLocalYMD(r1EndDate) === expectedB2BEnd,
  `subscriptionEndDate = ${expectedB2BEnd} (1st of next month)`,
  `קיבלנו: ${toLocalYMD(r1EndDate)}`);

// ─── Check 2: B2C Pending Cancel עם cardcomNextDateToBill ────────────────────
console.log('\n══ Check 2: B2C Pending Cancel עם cardcomNextDateToBill ══');
console.log('  ציפייה: subscriptionEndDate = 2026-06-15\n');

const deal_b2c_with_date = {
  isCentralized: false,
  paymentMethod: 'private',
  formState: {
    subscriptionStartDate: '2026-04-15',
    cardcomNextDateToBill: '2026-06-15T00:00:00.000Z',
  },
  cancellationDate: NOW,
};

const r2 = getEntitlementStatus(deal_b2c_with_date, NOW);

assert(r2.status === STATUS_PENDING_CANCELLATION,
  `status = pending_cancellation`,
  `קיבלנו: ${r2.status}`);

const r2EndDate = r2.cancelAt ? new Date(r2.cancelAt) : null;
// cardcomNextDateToBill is stored as UTC ISO → compare UTC date
const r2UTC = r2EndDate ? r2EndDate.toISOString().slice(0, 10) : 'null';
assert(r2UTC === '2026-06-15',
  `subscriptionEndDate (UTC) = 2026-06-15 (מ-cardcomNextDateToBill)`,
  `קיבלנו: ${r2UTC}`);

// ─── Check 3: B2C חודש ראשון — ללא cardcomNextDateToBill ────────────────────
console.log('\n══ Check 3: B2C חודש ראשון (ללא cardcomNextDateToBill) ══');
console.log('  ציפייה: subscriptionEndDate = subscriptionStartDate + 1 חודש בדיוק\n');

const startDateStr = '2026-05-06';
const startDateObj = parseFlexibleDate(startDateStr);
const expectedFallback = toLocalYMD(addOneMonth(startDateObj));

const deal_b2c_month1 = {
  isCentralized: false,
  paymentMethod: 'private',
  formState: {
    subscriptionStartDate: startDateStr,
    // אין cardcomNextDateToBill — חודש ראשון
  },
  cancellationDate: NOW,
};

const r3 = getEntitlementStatus(deal_b2c_month1, NOW);

assert(r3.status === STATUS_PENDING_CANCELLATION,
  `status = pending_cancellation`,
  `קיבלנו: ${r3.status}`);

const r3EndDate = r3.cancelAt ? new Date(r3.cancelAt) : null;
assert(toLocalYMD(r3EndDate) === expectedFallback,
  `subscriptionEndDate = ${expectedFallback} (startDate + חודש בדיוק)`,
  `קיבלנו: ${toLocalYMD(r3EndDate)}`);

// ─── Check 4: מיפוי סטטוסים ──────────────────────────────────────────────────
console.log('\n══ Check 4: מיפוי סטטוסים ══');

// 4-A: ללא subscriptionStartDate → not_activated
const deal_no_start = {
  paymentMethod: 'private',
  formState: {},
};
const r4a = getEntitlementStatus(deal_no_start, NOW);
assert(r4a.status === STATUS_NOT_ACTIVATED,
  `[A] ללא subscriptionStartDate → not_activated`,
  `קיבלנו: ${r4a.status}`);

// 4-B: יש subscriptionStartDate, אין cancellationDate → active
const deal_active = {
  paymentMethod: 'private',
  formState: { subscriptionStartDate: '2026-03-01' },
};
const r4b = getEntitlementStatus(deal_active, NOW);
assert(r4b.status === STATUS_ACTIVE,
  `[B] יש startDate + אין cancellationDate → active`,
  `קיבלנו: ${r4b.status}`);

// 4-C: cancellationDate קיים + now < endDate → pending_cancellation
const deal_pending = {
  paymentMethod: 'private',
  formState: {
    subscriptionStartDate: '2026-03-01',
    cardcomNextDateToBill: '2026-06-01T00:00:00.000Z',
  },
  cancellationDate: new Date('2026-05-01'),
};
const r4c = getEntitlementStatus(deal_pending, NOW);
assert(r4c.status === STATUS_PENDING_CANCELLATION,
  `[C] cancellationDate קיים + now < endDate → pending_cancellation`,
  `קיבלנו: ${r4c.status}`);

// 4-D: cancellationDate קיים + now >= endDate → canceled
const deal_canceled = {
  paymentMethod: 'private',
  formState: {
    subscriptionStartDate: '2026-01-01',
    cardcomNextDateToBill: '2026-04-01T00:00:00.000Z',
  },
  cancellationDate: new Date('2026-03-15'),
};
const r4d = getEntitlementStatus(deal_canceled, NOW);
assert(r4d.status === STATUS_CANCELED,
  `[D] cancellationDate קיים + now >= endDate → canceled`,
  `קיבלנו: ${r4d.status}`);

// ─── Check 4E+F: B2B extra ───────────────────────────────────────────────────
console.log('\n══ Check 4E-F: B2B edge cases ══');

const deal_b2b_future = {
  isCentralized: true,
  formState: { subscriptionStartDate: '2026-01-01' },
  cancellationDate: new Date('2026-05-01'),
  cancelAt: new Date('2026-06-01'),
};
const r4e = getEntitlementStatus(deal_b2b_future, NOW);
assert(r4e.status === STATUS_PENDING_CANCELLATION,
  `[B2B] cancelAt עתידי → pending_cancellation`,
  `קיבלנו: ${r4e.status}`);

const deal_b2b_past = {
  isCentralized: true,
  formState: { subscriptionStartDate: '2026-01-01' },
  cancellationDate: new Date('2026-04-01'),
  cancelAt: new Date('2026-05-01'), // May 1st < NOW (May 6th)
};
const r4f = getEntitlementStatus(deal_b2b_past, NOW);
assert(r4f.status === STATUS_CANCELED,
  `[B2B] cancelAt עבר → canceled`,
  `קיבלנו: ${r4f.status}`);

// ─── סיכום ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`סיכום: ${passed} עברו ✅  |  ${failed} נכשלו ❌`);
if (failed === 0) {
  console.log('🎉 כל הבדיקות עברו — מנוע הזכאות תקין!\n');
  process.exit(0);
} else {
  console.error('⚠️  יש בדיקות שנכשלו — נדרש תיקון!\n');
  process.exit(1);
}
