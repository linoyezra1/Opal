/**
 * Shared payment-type classification for dashboard metrics.
 * Private: not centralized flag and billingType !== 'centralized'
 * Centralized: centralized flag or billingType === 'centralized'
 */

export function isCentralizedPaymentDeal(deal) {
  if (!deal) return false;
  return (
    deal.isCentralized === true ||
    String(deal.formState?.billingType || '')
      .trim()
      .toLowerCase() === 'centralized'
  );
}

export function isPrivatePaymentDeal(deal) {
  if (!deal) return false;
  return (
    deal.isCentralized !== true &&
    String(deal.formState?.billingType || '')
      .trim()
      .toLowerCase() !== 'centralized'
  );
}

export function countPaymentTypeDeals(deals) {
  let privatePaymentCustomers = 0;
  let centralizedPaymentCustomers = 0;
  for (const d of deals || []) {
    if (isPrivatePaymentDeal(d)) privatePaymentCustomers += 1;
    if (isCentralizedPaymentDeal(d)) centralizedPaymentCustomers += 1;
  }
  return { privatePaymentCustomers, centralizedPaymentCustomers };
}

/** Map a subscribers-dashboard table row to a deal-shaped object for metrics. */
export function dealFromSubscriberRow(row) {
  if (row?.raw && typeof row.raw === 'object') return row.raw;
  return row;
}
