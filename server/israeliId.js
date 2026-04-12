/** אימות ת״ז ישראלית (ספרת ביקורת) — זהה ללוגיקה ב־src/utils/israeliId.js */

export const ISRAELI_ID_INVALID_MSG = 'מספר תעודת זהות אינו תקין';

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

export function formatIsraeliIdStored(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits || digits.length > 9) return null;
  if (!validateIsraeliId(digits)) return null;
  return digits.padStart(9, '0');
}

/** בדיקת ת״ז בשדות עדכון עסקה (אדמין) — רק כשמועבר ערך לא ריק */
export function validateDealPatchIsraeliIdsOrThrow(body) {
  const check = (raw) => {
    const d = String(raw ?? '').replace(/\D/g, '');
    if (!d) return;
    if (!validateIsraeliId(d)) {
      throw new Error(ISRAELI_ID_INVALID_MSG);
    }
  };
  const bu = body?.beneficiaryUpdate;
  if (bu && typeof bu === 'object') {
    if (bu.primaryMember && typeof bu.primaryMember === 'object' && bu.primaryMember.id != null) {
      check(bu.primaryMember.id);
    }
    if (Array.isArray(bu.additionalMembers)) {
      for (const m of bu.additionalMembers) {
        if (m && m.id != null) check(m.id);
      }
    }
  }
  const fs = body?.formState;
  if (fs && typeof fs === 'object') {
    if (fs.id != null) check(fs.id);
    if (Array.isArray(fs.beneficiaries)) {
      for (const m of fs.beneficiaries) {
        if (m && m.id != null) check(m.id);
      }
    }
  }
}
