/**
 * ערכים מותרים — תואמים לטופס מוטבים (BeneficiaryForm.jsx)
 */
export const HEALTH_FUND_OPTIONS_HE = ['כללית', 'מכבי', 'מאוחדת', 'לאומית'];

/** מיפוי מאנגלית (דוחות ספק / ייבוא בינלאומי) */
export const HEALTH_FUND_ALIASES = {
  clalit: 'כללית',
  'קלאליט': 'כללית',
  maccabi: 'מכבי',
  meuhedet: 'מאוחדת',
  'מאוחדת': 'מאוחדת',
  leumit: 'לאומית',
  'לאומית': 'לאומית',
  כללית: 'כללית',
  מכבי: 'מכבי',
};

export const GENDER_OPTIONS_HE = ['זכר', 'נקבה', 'אחר'];

export const GENDER_ALIASES = {
  m: 'זכר',
  male: 'זכר',
  זכר: 'זכר',
  f: 'נקבה',
  female: 'נקבה',
  נקבה: 'נקבה',
  other: 'אחר',
  אחר: 'אחר',
};

export const MARITAL_STATUS_OPTIONS_HE = ['רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];

export const SUPPLEMENTAL_INSURANCE_OPTIONS_HE = ['אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];
