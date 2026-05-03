/**
 * Determines whether a campaign/page validity date has passed.
 *
 * Rules:
 *  - null / empty / unparseable → false  (no expiry set means forever active)
 *  - Otherwise: parse as end-of-day (23:59:59.999) in LOCAL time and compare
 *    to the current instant.
 *
 * Why the Date(y,m,d) constructor instead of new Date(string)?
 *   ISO date-only strings ("2025-12-31") are parsed as UTC midnight by the
 *   spec.  In any timezone behind UTC this shifts the apparent calendar date
 *   one day backward, causing pages to expire a day early.  Using the
 *   multi-argument constructor always produces a local-time Date.
 *
 * @param {string|null|undefined} dateString  "YYYY-MM-DD" (or falsy)
 * @returns {boolean}
 */
export function isExpired(dateString) {
  if (!dateString) return false;
  const m = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const endOfDay = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    23, 59, 59, 999,
  );
  if (isNaN(endOfDay.getTime())) return false;
  return Date.now() > endOfDay.getTime();
}

/**
 * Parse a "YYYY-MM-DD" string to start-of-day (00:00:00.000) in local time.
 * Returns null for empty / invalid input.
 *
 * @param {string|null|undefined} dateString
 * @returns {Date|null}
 */
export function parseLocalStartOfDay(dateString) {
  const m = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a "YYYY-MM-DD" string to end-of-day (23:59:59.999) in local time.
 * Returns null for empty / invalid input.
 *
 * @param {string|null|undefined} dateString
 * @returns {Date|null}
 */
export function parseLocalEndOfDay(dateString) {
  const m = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date/time for display: DD/MM/YYYY HH:mm:ss (local time).
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
export function fmtDateTime(dateInput) {
  if (!dateInput) return '-';
  const parsed = dateInput instanceof Date ? dateInput : new Date(String(dateInput).trim());
  if (Number.isNaN(parsed.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}
