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

/** Stable unique root deal id for deduplication (subscriber row or Mongo deal). */
export function uniqueDealId(item) {
  if (!item) return '';
  const raw = item.raw && typeof item.raw === 'object' ? item.raw : null;
  const deal = raw || item;
  const id = deal.dealId ?? deal._id ?? item.dealId ?? item.id ?? item._id;
  if (id == null || id === '') return '';
  return String(id);
}

/** Map a subscribers-dashboard table row to a deal-shaped object for metrics. */
export function dealFromSubscriberRow(row) {
  if (row?.raw && typeof row.raw === 'object') return row.raw;
  return row;
}

export function countPaymentTypeDeals(rowsOrDeals) {
  let privatePaymentCustomers = 0;
  let centralizedPaymentCustomers = 0;
  const seenDeals = new Set();

  for (const item of rowsOrDeals || []) {
    const id = uniqueDealId(item);
    if (!id || seenDeals.has(id)) continue;

    const deal = dealFromSubscriberRow(item);
    if (isPrivatePaymentDeal(deal)) {
      privatePaymentCustomers += 1;
      seenDeals.add(id);
    } else if (isCentralizedPaymentDeal(deal)) {
      centralizedPaymentCustomers += 1;
      seenDeals.add(id);
    }
  }

  return { privatePaymentCustomers, centralizedPaymentCustomers };
}
