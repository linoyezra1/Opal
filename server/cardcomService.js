/**
 * Cardcom — API 10 Name-to-Value (step 1 LowProfile.aspx, step 2 RecurringPayment.aspx).
 * GetLowProfileIndicator / stop recurring still use legacy SOAP where required.
 * Credentials: CARDCOM_TERMINAL, CARDCOM_USER, CARDCOM_PASS.
 */

import axios from 'axios';

const CARDCOM_SOAP_URL = 'https://secure.cardcom.co.il/service.asmx';
const CARDCOM_RECURRING_SOAP_URL = 'https://secure.cardcom.co.il/Interface/BillGoldService.asmx';
const CARDCOM_LOW_PROFILE_NTV_URL = 'https://secure.cardcom.solutions/Interface/LowProfile.aspx';
const CARDCOM_RECURRING_NTV_URL = 'https://secure.cardcom.solutions/interface/RecurringPayment.aspx';

function parseNameValueResponse(raw) {
  const pairs = new URLSearchParams(String(raw || ''));
  const data = {};
  for (const [k, v] of pairs.entries()) data[k] = v;
  return data;
}

function isCardcomLowProfileResponseSuccess(responseCodeRaw) {
  const code = String(responseCodeRaw ?? '').trim();
  return code === '0' || code === '00';
}

function isLikelyHtmlResponse(raw) {
  const s = String(raw ?? '').trimStart().toLowerCase();
  return (
    s.startsWith('<!doctype') ||
    s.startsWith('<html') ||
    s.includes('<script') ||
    s.includes('<body')
  );
}

/** Compact error digest — avoids logging full HTML pages to Railway. */
function summarizeCardcomResponseForLog(raw) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  if (isLikelyHtmlResponse(text)) {
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    return {
      format: 'html',
      byteLength: text.length,
      title: titleMatch ? titleMatch[1].trim() : undefined,
    };
  }
  const parsed = parseNameValueResponse(text);
  if (Object.keys(parsed).length > 0) {
    return {
      format: 'name-value',
      ResponseCode: parsed.ResponseCode,
      Description: parsed.Description,
      LowProfileCode: parsed.LowProfileCode,
      url: parsed.url || parsed.Url,
    };
  }
  return { format: 'text', byteLength: text.length, preview: text.slice(0, 300) };
}

function parseLowProfileNtvResponse(raw) {
  const parsed = parseNameValueResponse(raw);
  const responseCodeRaw = parsed.ResponseCode;
  const responseCode =
    responseCodeRaw != null && String(responseCodeRaw).trim() !== ''
      ? parseInt(String(responseCodeRaw).trim(), 10)
      : null;
  const description = String(parsed.Description ?? '').trim();
  const lowProfileCode = String(parsed.LowProfileCode ?? '').trim() || null;
  const url = String(parsed.url ?? parsed.Url ?? '').trim();
  const baseUrl = String(parsed.BaseUrl ?? '').trim();
  return {
    responseCode,
    description,
    lowProfileCode,
    url: url || (baseUrl && lowProfileCode ? `${baseUrl}?LowProfileCode=${lowProfileCode}` : null),
  };
}

function isCardcomAuthErrorText(text) {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('משתמש חסום') ||
    t.includes('שכחתי סיסמה') ||
    t.includes('blocked user') ||
    t.includes('user blocked') ||
    t.includes('invalid username') ||
    t.includes('invalid password') ||
    t.includes('authentication') ||
    t.includes('authorization')
  );
}

/**
 * Step 1 — LowProfile.aspx (API 10 Name-to-Value). Operation 2 = charge + internal token.
 * @returns {Promise<{ responseCode: number|null, description: string, url: string, lowProfileCode: string|null }>}
 */
export async function createLowProfileDeal(opts = {}) {
  const terminalNumber = Number(opts.terminalNumber || 0);
  const username = String(opts.username || '').trim();
  const password = String(opts.password ?? '').trim();
  const sumToBill = Number(opts.sumToBill ?? 0);
  const language = String(opts.language || 'he').trim();
  const returnValue = String(opts.returnValue ?? '').trim();

  const form = new URLSearchParams();
  form.set('Codepage', '65001');
  form.set('Operation', '2');
  form.set('TerminalNumber', String(terminalNumber));
  form.set('UserName', username);
  form.set('Password', password);
  form.set('SumToBill', String(sumToBill));
  form.set('CoinId', '1');
  form.set('Language', language);
  form.set('APILevel', '10');
  form.set('SuccessRedirectUrl', String(opts.successRedirectUrl || ''));
  form.set('ErrorRedirectUrl', String(opts.errorRedirectUrl || ''));
  form.set('CancelRedirectUrl', String(opts.cancelRedirectUrl || ''));
  form.set('IndicatorUrl', String(opts.indicatorUrl || ''));
  form.set('ReturnValue', returnValue);
  form.set('AutoRedirect', 'false');

  const response = await axios.post(CARDCOM_LOW_PROFILE_NTV_URL, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  const rawResponse = response.data;
  const data = parseLowProfileNtvResponse(rawResponse);

  if (isCardcomAuthErrorText(data.description)) {
    console.warn('[Cardcom Step1 error]', summarizeCardcomResponseForLog(rawResponse));
    throw new Error('שגיאת הזדהות מול Cardcom. נדרשת בדיקת משתמש/סיסמה מול חברת הסליקה.');
  }
  if (!isCardcomLowProfileResponseSuccess(parseNameValueResponse(rawResponse).ResponseCode)) {
    console.warn('[Cardcom Step1 error]', summarizeCardcomResponseForLog(rawResponse));
    throw new Error(data.description || `Cardcom error ${data.responseCode ?? 'unknown'}`);
  }
  if (!data.url) {
    console.warn('[Cardcom Step1 error]', summarizeCardcomResponseForLog(rawResponse));
    throw new Error('Cardcom did not return a payment URL');
  }

  return {
    responseCode: data.responseCode,
    description: data.description,
    url: data.url,
    lowProfileCode: data.lowProfileCode,
  };
}

/** Checkout entry — step 1 via LowProfile.aspx; step 2 via RecurringPayment.aspx. */
export async function createLowProfilePage(opts) {
  return createLowProfileDeal(opts);
}

/**
 * Step 2 of recurring flow:
 * Create/Update BillGold recurring profile from successful LowProfile deal GUID.
 * Response is Name=Value format.
 */
export async function createRecurringProfileFromLowProfile(opts = {}) {
  const terminalNumber = Number(opts.terminalNumber || 0);
  if (!terminalNumber) throw new Error('RecurringPayment: missing TerminalNumber');
  const username = String(opts.username || '').trim();
  if (!username) throw new Error('RecurringPayment: missing UserName');
  const lowProfileCode = String(opts.lowProfileCode || '').trim();
  if (!lowProfileCode) throw new Error('RecurringPayment: missing LowProfileDealGuid');

  const form = new URLSearchParams();
  form.set('TerminalNumber', String(terminalNumber));
  form.set('RecurringPayments.ChargeInTerminal', String(terminalNumber));
  form.set('UserName', username);
  form.set('codepage', '65001');
  form.set('Operation', 'NewAndUpdate');
  form.set('LowProfileDealGuid', lowProfileCode);
  form.set('Account.Email', String(opts.email || '').trim());
  form.set('Account.CompanyName', String(opts.companyName || '').trim());
  form.set('Account.PhMobile', String(opts.phone || '').trim());
  form.set(
    'RecurringPayments.InternalDecription',
    String(opts.internalDescription || 'Subscription').trim()
  );
  form.set('RecurringPayments.TotalNumOfBills', '999999');
  form.set(
    'RecurringPayments.FlexItem.InvoiceDescription',
    String(opts.invoiceDescription || opts.internalDescription || 'Subscription').trim()
  );
  form.set('RecurringPayments.FlexItem.Price', String(Number(opts.monthlyAmount || 0)));
  form.set('RecurringPayments.ReturnValue', String(opts.returnValue || '').trim());
  const ccToken = String(opts.cardToken || '').trim();
  if (ccToken) {
    // Fallback for cases where LowProfileDealGuid is not linked to token in Cardcom.
    form.set('CreditCard.Token', ccToken);
  }

  const response = await axios.post(CARDCOM_RECURRING_NTV_URL, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  const parsed = parseNameValueResponse(response.data);
  const responseCode = Number(parsed.ResponseCode);
  const description = String(parsed.Description || '');
  const accountId = String(parsed.AccountId || '').trim();
  const recurringId =
    String(parsed['Recurring0.RecurringId'] || '').trim() ||
    String(parsed.RecurringId || '').trim();

  if (responseCode !== 0) {
    throw new Error(description || `RecurringPayment failed (${parsed.ResponseCode || 'unknown'})`);
  }

  return {
    responseCode,
    description,
    cardcomAccountId: accountId || null,
    cardcomRecurringId: recurringId || null,
    raw: parsed,
  };
}

/** Extract first tag value inside XML (non-greedy, first occurrence). */
function firstTagValue(xml, tag) {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([^<]*)</(?:[\\w]+:)?${tag}>`, 'i');
  const m = String(xml || '').match(re);
  return m ? m[1].trim() : null;
}

function normalizeCardExpirationMonth(raw) {
  const digits = String(raw ?? '').trim().replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return '';
  return String(n).padStart(2, '0');
}

function normalizeCardExpirationYear(raw) {
  const digits = String(raw ?? '').trim().replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 2) return `20${digits}`;
  if (digits.length === 4) return digits;
  return '';
}

/** Card expiry from CardMonth/CardYear only (webhook + GetLowProfileIndicator). */
export function extractCardExpirationFromSources(...sources) {
  let cardExpirationMonth = '';
  let cardExpirationYear = '';
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const monthRaw =
      src.CardMonth ??
      src.cardMonth ??
      src.cardExpirationMonth;
    const yearRaw =
      src.CardYear ??
      src.cardYear ??
      src.cardExpirationYear;
    const month = normalizeCardExpirationMonth(monthRaw);
    const year = normalizeCardExpirationYear(yearRaw);
    if (month) cardExpirationMonth = month;
    if (year) cardExpirationYear = year;
  }
  return { cardExpirationMonth, cardExpirationYear };
}

/**
 * Parse nested &lt;Indicator&gt;…&lt;/Indicator&gt; from GetLowProfileIndicator response.
 * Recurring id: RecurringId if present, else RowID (Cardcom docs expose RowID on indicator).
 */
export function parseLowProfileIndicatorXml(xml) {
  const raw = String(xml || '');
  const indMatch = raw.match(/<Indicator[^>]*>([\s\S]*?)<\/Indicator>/i);
  const block = indMatch ? indMatch[1] : raw;

  const internalDealNumber = firstTagValue(block, 'InternalDealNumber');
  const accountId = firstTagValue(block, 'AccountId');
  const recurringId = firstTagValue(block, 'RecurringId') || firstTagValue(block, 'RowID');
  const token =
    firstTagValue(block, 'Token') ||
    firstTagValue(block, 'CardToken') ||
    firstTagValue(block, 'TokenToSave');
  const processEndOkRaw = firstTagValue(block, 'ProssesEndOK');
  const dealResponseRaw =
    firstTagValue(block, 'DealResponse') || firstTagValue(block, 'DealRespone');
  const responseDescription =
    firstTagValue(block, 'ResponsDescription') ||
    firstTagValue(block, 'ResponseDescription') ||
    firstTagValue(block, 'Description');
  const last4 =
    firstTagValue(block, 'Lest4Numbers') ||
    firstTagValue(block, 'Last4Numbers') ||
    firstTagValue(block, 'CardNum');
  const cardBrand = firstTagValue(block, 'MutagName') || firstTagValue(block, 'CardName');
  const { cardExpirationMonth, cardExpirationYear } = extractCardExpirationFromSources({
    CardMonth: firstTagValue(block, 'CardMonth'),
    CardYear: firstTagValue(block, 'CardYear'),
  });

  return {
    internalDealNumber: internalDealNumber != null ? String(internalDealNumber) : null,
    cardcomAccountId: accountId != null && String(accountId).trim() !== '' ? String(accountId).trim() : null,
    cardcomRecurringId: recurringId != null && String(recurringId).trim() !== '' ? String(recurringId).trim() : null,
    cardcomToken: token != null && String(token).trim() !== '' ? String(token).trim() : null,
    processEndOk: parseInt(processEndOkRaw, 10) === 1,
    dealResponse: dealResponseRaw != null ? parseInt(dealResponseRaw, 10) : null,
    responseDescription: responseDescription != null ? String(responseDescription).trim() : '',
    Lest4Numbers: last4 != null ? String(last4).trim() : '',
    MutagName: cardBrand != null ? String(cardBrand).trim() : '',
    cardExpirationMonth,
    cardExpirationYear,
  };
}

/**
 * Get Low Profile deal result (for webhook: confirm payment and get InternalDealNumber).
 * @param {number} terminalNumber
 * @param {string} username - API name
 * @param {string} lowProfileCode - GUID from CreateLowProfileDeal
 * @returns {Promise<{ responseCode: number, description: string, processEndOk: boolean, dealResponse: number, internalDealNumber: string|number|null, cardcomAccountId: string|null, cardcomRecurringId: string|null, responseXml: string }>}
 */
export async function getLowProfileIndicator(terminalNumber, username, lowProfileCode) {
  const escape = (s) =>
    (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetLowProfileIndicator xmlns="http://cardcom.co.il/">
      <terminalnumber>${Number(terminalNumber)}</terminalnumber>
      <username>${escape(username)}</username>
      <LowProfileCode>${escape(lowProfileCode)}</LowProfileCode>
    </GetLowProfileIndicator>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(CARDCOM_SOAP_URL, soap, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://cardcom.co.il/GetLowProfileIndicator',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  const xml = String(response.data || '');
  const getVal = (tag) => {
    const re = new RegExp(`<(?:\w+:)?${tag}[^>]*>([^<]*)</(?:\w+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : null;
  };
  const responseCode = parseInt(getVal('ResponseCode'), 10);
  const description = getVal('Description') || '';
  const parsed = parseLowProfileIndicatorXml(xml);
  const rootInternal = getVal('InternalDealNumber');
  const rootOk = parseInt(getVal('ProssesEndOK'), 10) === 1;
  const rootDealRaw = getVal('DealResponse') || getVal('DealRespone');
  const rootDeal = rootDealRaw != null ? parseInt(rootDealRaw, 10) : NaN;
  const rootAccountId = getVal('AccountId');
  const rootRecurringId = getVal('RecurringId') || getVal('RowID');
  const rootToken = getVal('Token') || getVal('CardToken') || getVal('TokenToSave');
  const rootResponseDescription = getVal('ResponsDescription') || getVal('ResponseDescription') || getVal('Description');
  const rootLast4 = getVal('Lest4Numbers') || getVal('Last4Numbers') || getVal('CardNum');
  const rootCardBrand = getVal('MutagName') || getVal('CardName');
  const rootExpiration = extractCardExpirationFromSources(
    {
      CardMonth: getVal('CardMonth'),
      CardYear: getVal('CardYear'),
    },
    parsed
  );

  return {
    responseCode,
    description,
    processEndOk: parsed.processEndOk || rootOk,
    dealResponse: Number.isFinite(parsed.dealResponse) ? parsed.dealResponse : rootDeal,
    internalDealNumber: parsed.internalDealNumber || (rootInternal != null ? String(rootInternal) : null),
    cardcomAccountId: parsed.cardcomAccountId || (rootAccountId != null ? String(rootAccountId).trim() : null),
    cardcomRecurringId: parsed.cardcomRecurringId || (rootRecurringId != null ? String(rootRecurringId).trim() : null),
    cardcomToken: parsed.cardcomToken || (rootToken != null ? String(rootToken).trim() : null),
    responseDescription: parsed.responseDescription || (rootResponseDescription != null ? String(rootResponseDescription).trim() : ''),
    Lest4Numbers: parsed.Lest4Numbers || (rootLast4 != null ? String(rootLast4).trim() : ''),
    MutagName: parsed.MutagName || (rootCardBrand != null ? String(rootCardBrand).trim() : ''),
    cardExpirationMonth: rootExpiration.cardExpirationMonth,
    cardExpirationYear: rootExpiration.cardExpirationYear,
    responseXml: xml,
  };
}

/**
 * Stop recurring profile so no future charges are executed.
 * Uses Cardcom BillGoldService/AddUpdateRecurringOrder with:
 * - Account.RecurringPaymentsActive=false
 * - RecurringPayments.ExtRecurringPayments.IsActive=false
 *
 * Uses BillGold AccountId + RecurringId (from GetLowProfileIndicator after CreateRecurring).
 * @param {Object} opts
 * @param {string|number} opts.cardcomAccountId
 * @param {string|number} opts.cardcomRecurringId
 * @param {string} [opts.lowProfileCode] - optional LowProfileDealGuid
 * @param {number} [opts.terminalNumber]
 * @returns {Promise<{ responseCode: number, description: string, lowProfileCode: string }>}
 */
export async function stopRecurringProfile(opts = {}) {
  const accountId = String(opts.cardcomAccountId || '').trim();
  const recurringId = String(opts.cardcomRecurringId || '').trim();
  if (!accountId || !recurringId) {
    throw new Error('Cannot cancel: Missing Cardcom recurring identifiers (AccountId/RecurringId)');
  }

  let terminalNumber = Number(opts.terminalNumber || 0);
  if (!terminalNumber) terminalNumber = Number(process.env.CARDCOM_TERMINAL || 0);
  const apiName = String(process.env.CARDCOM_API_NAME || process.env.CARDCOM_USER || '').trim();
  const apiPassword = String(process.env.CARDCOM_API_PASSWORD || process.env.CARDCOM_PASS || '').trim();
  if (!terminalNumber || !apiName || !apiPassword) {
    throw new Error('Missing Cardcom credentials (CARDCOM_TERMINAL + CARDCOM_API_NAME/API_PASSWORD)');
  }

  const escape = (s) =>
    (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  if (!/^\d+$/.test(accountId) || !/^\d+$/.test(recurringId)) {
    throw new Error('Invalid Cardcom AccountId or RecurringId (must be numeric strings)');
  }
  const rowKey = accountId;
  const recurringIdXml = escape(recurringId);
  const accountIdXml = escape(accountId);

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <BillGoldAuth xmlns="BillGoldService">
      <UserName>${escape(apiName)}</UserName>
      <Password>${escape(apiPassword)}</Password>
    </BillGoldAuth>
  </soap:Header>
  <soap:Body>
    <AddUpdateRecurringOrder xmlns="BillGoldService">
      <TerminalNumber>${terminalNumber}</TerminalNumber>
      <UserName>${escape(apiName)}</UserName>
      <Password>${escape(apiPassword)}</Password>
      <RecurringOrder>
        <InternalUsageRowID>${escape(rowKey)}</InternalUsageRowID>
        <Operation>Update</Operation>
        <Account>
          <AccountId>${accountIdXml}</AccountId>
          <RecurringPaymentsActive>false</RecurringPaymentsActive>
        </Account>
        <RecurringPayments>
          <ExtRecurringPayments>
            <RecurringId>${recurringIdXml}</RecurringId>
            <IsActive>false</IsActive>
            <RecurringPaymentsActive>false</RecurringPaymentsActive>
            <InternalDecription>Stop recurring by admin request</InternalDecription>
          </ExtRecurringPayments>
        </RecurringPayments>
      </RecurringOrder>
    </AddUpdateRecurringOrder>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(CARDCOM_RECURRING_SOAP_URL, soap, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'BillGoldService/AddUpdateRecurringOrder',
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  const xml = String(response?.data || '');
  const getVal = (tag) => {
    const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : null;
  };
  const responseCode = Number(getVal('ResponseCode'));
  const description = getVal('Description') || '';

  console.log('[cardcom] stopRecurringProfile responseXml (full)', xml);

  if (responseCode !== 0) {
    console.error('[cardcom] stopRecurringProfile failed', {
      terminalNumber,
      cardcomAccountId: accountId,
      cardcomRecurringId: recurringId,
      responseCode,
      requestXml: soap,
      responseXml: xml,
    });
    throw new Error(description || `Cardcom recurring stop failed (${responseCode || 'unknown'})`);
  }

  return { responseCode, description, accountId };
}
