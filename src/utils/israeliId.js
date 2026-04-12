/** הודעת שגיאה אחידה לכל הממשק */
export const ISRAELI_ID_INVALID_MSG = 'מספר תעודת זהות אינו תקין';

/** ספרות בלבד, עד 9 תווים — לשימוש ב-onChange */
export function normalizeIsraeliIdDigitsInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 9);
}

/**
 * אימות ת״ז ישראלית (ספרת ביקורת) לפי הנוסחה הסטנדרטית.
 * תומך ב-7–9 ספרות; משלים אפסים מובילים.
 */
export function validateIsraeliId(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 0 || digits.length > 9) return false;
  const id = digits.padStart(9, '0');
  if (id.length !== 9 || !/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const inc = parseInt(id[i], 10) * ((i % 2) + 1);
    sum += inc > 9 ? inc - 9 : inc;
  }
  return sum % 10 === 0;
}

/**
 * שמירה עקבית במסד: ת״ז תקפה בפורמט 9 ספרות עם אפסים מובילים.
 * מחזיר null אם לא תקין.
 */
export function formatIsraeliIdStored(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits || digits.length > 9) return null;
  if (!validateIsraeliId(digits)) return null;
  return digits.padStart(9, '0');
}

/** שגיאת צ׳קסום בזמן אמת — רק אחרי minDigits ספרות (מפחית רעש בהקלדה) */
export function shouldShowIsraeliIdChecksumError(raw, { minDigits = 7 } = {}) {
  const digits = normalizeIsraeliIdDigitsInput(raw);
  if (digits.length === 0) return false;
  if (digits.length < minDigits) return false;
  return !validateIsraeliId(digits);
}
