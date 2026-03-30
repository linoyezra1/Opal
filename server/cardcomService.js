/**
 * Cardcom Low Profile API – create payment link (SOAP).
 * Test terminal credentials from .env: CARDCOM_TERMINAL, CARDCOM_USER, CARDCOM_PASS.
 *
 * Payment page styling: do not inject custom CSS (e.g. ConCss) from this codebase.
 * Cardcom renders `<style id="conCss">` from terminal / merchant back-office settings;
 * rules like `display: none` on `.fieldName`, `label`, or payment UI break dropdowns and buttons.
 * To restore the default Low Profile look, clear or fix custom CSS in the Cardcom terminal, not here.
 */

import axios from 'axios';

const CARDCOM_SOAP_URL = 'https://secure.cardcom.co.il/service.asmx';
const CARDCOM_RECURRING_SOAP_URL = 'https://secure.cardcom.co.il/Interface/BillGoldService.asmx';

/**
 * Build SOAP envelope for CreateLowProfileDeal.
 * @param {Object} opts
 * @param {number} opts.terminalNumber
 * @param {string} opts.username - API name
 * @param {string} opts.password - API password (some flows use it)
 * @param {number} opts.sumToBill - amount in ILS
 * @param {string} opts.successRedirectUrl
 * @param {string} opts.errorRedirectUrl
 * @param {string} opts.cancelRedirectUrl
 * @param {string} opts.indicatorUrl - webhook URL Cardcom will call on payment end
 * @param {string} [opts.returnValue] - optional custom data returned in indicator
 * @param {string} [opts.language=he]
 */
function buildCreateLowProfileDealSoap(opts) {
  const {
    terminalNumber,
    username,
    sumToBill,
    successRedirectUrl,
    errorRedirectUrl,
    cancelRedirectUrl,
    indicatorUrl,
    returnValue = '',
    language = 'he',
  } = opts;

  const escape = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const body = `
<CreateLowProfileDeal xmlns="http://cardcom.co.il/">
  <terminalnumber>${Number(terminalNumber)}</terminalnumber>
  <username>${escape(username)}</username>
  <lowprofileParams>
    <Operation>BillOnly</Operation>
    <ReturnValue>${escape(returnValue)}</ReturnValue>
    <SumToBill>${Number(sumToBill)}</SumToBill>
    <Language>${escape(language)}</Language>
    <SuccessRedirectUrl>${escape(successRedirectUrl)}</SuccessRedirectUrl>
    <ErrorRedirectUrl>${escape(errorRedirectUrl)}</ErrorRedirectUrl>
    <CancelRedirectUrl>${escape(cancelRedirectUrl)}</CancelRedirectUrl>
    <IndicatorUrl>${escape(indicatorUrl)}</IndicatorUrl>
  </lowprofileParams>
</CreateLowProfileDeal>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    ${body.trim()}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Parse Cardcom CreateLowProfileDeal SOAP response to get payment URL and LowProfileCode.
 */
function parseCreateLowProfileDealResponse(xml) {
  const urlMatch = xml.match(/<(?:\w+:)?url[^>]*>([^<]*)<\/(?:\w+:)?url>/i) || xml.match(/<url>([^<]*)<\/url>/i);
  const codeMatch = xml.match(/<(?:\w+:)?LowProfileCode[^>]*>([^<]*)<\/(?:\w+:)?LowProfileCode>/i) || xml.match(/<LowProfileCode>([^<]*)<\/LowProfileCode>/i);
  const responseCodeMatch = xml.match(/<(?:\w+:)?ResponseCode[^>]*>([^<]*)<\/(?:\w+:)?ResponseCode>/i) || xml.match(/<ResponseCode>([^<]*)<\/ResponseCode>/i);
  const descMatch = xml.match(/<(?:\w+:)?Description[^>]*>([^<]*)<\/(?:\w+:)?Description>/i) || xml.match(/<Description>([^<]*)<\/Description>/i);
  const baseUrlMatch = xml.match(/<(?:\w+:)?BaseUrl[^>]*>([^<]*)<\/(?:\w+:)?BaseUrl>/i) || xml.match(/<BaseUrl>([^<]*)<\/BaseUrl>/i);

  const responseCode = responseCodeMatch ? parseInt(responseCodeMatch[1], 10) : null;
  const url = urlMatch ? urlMatch[1].trim() : null;
  const lowProfileCode = codeMatch ? codeMatch[1].trim() : null;
  const baseUrl = baseUrlMatch ? baseUrlMatch[1].trim() : null;
  const description = descMatch ? descMatch[1].trim() : '';

  return {
    responseCode,
    description,
    url: url || (baseUrl && lowProfileCode ? `${baseUrl}?LowProfileCode=${lowProfileCode}` : null),
    lowProfileCode,
    baseUrl,
  };
}

/**
 * Create a Low Profile payment link.
 * @param {Object} opts - Same as buildCreateLowProfileDealSoap; terminalNumber, username, password (for auth if needed), sumToBill, redirect URLs, indicatorUrl.
 * @returns {Promise<{ url: string, lowProfileCode: string, responseCode: number, description: string }>}
 *
 * Styling: the SOAP body must not include ConCss, css, Style, or any custom-design fields—only
 * `lowprofileParams` below. Payment page look comes from Cardcom defaults + terminal dashboard.
 */
export async function createLowProfileDeal(opts) {
  const soap = buildCreateLowProfileDealSoap(opts);

  const auth =
    opts.password != null && opts.password !== ''
      ? { username: opts.username, password: opts.password }
      : undefined;

  const response = await axios.post(CARDCOM_SOAP_URL, soap, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://cardcom.co.il/CreateLowProfileDeal',
    },
    auth,
    timeout: 15000,
    validateStatus: () => true,
  });

  const data = parseCreateLowProfileDealResponse(response.data);
  if (data.responseCode !== 0 && data.responseCode !== 200) {
    throw new Error(data.description || `Cardcom error ${data.responseCode}`);
  }
  if (!data.url) {
    throw new Error('Cardcom did not return a payment URL');
  }
  return data;
}

/**
 * Get Low Profile deal result (for webhook: confirm payment and get InternalDealNumber).
 * @param {number} terminalNumber
 * @param {string} username - API name
 * @param {string} lowProfileCode - GUID from CreateLowProfileDeal
 * @returns {Promise<{ responseCode: number, description: string, processEndOk: boolean, dealResponse: number, internalDealNumber: string|number, sum?: number }>}
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

  const response = await axios.post(
    'https://secure.cardcom.solutions/service.asmx',
    soap,
    {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://cardcom.co.il/GetLowProfileIndicator',
      },
      timeout: 15000,
      validateStatus: () => true,
    }
  );

  const xml = response.data;
  const getVal = (tag) => {
    const re = new RegExp(`<(?:\w+:)?${tag}[^>]*>([^<]*)</(?:\w+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : null;
  };
  const responseCode = parseInt(getVal('ResponseCode'), 10);
  const description = getVal('Description') || '';
  const prossesEndOK = parseInt(getVal('ProssesEndOK'), 10) === 1;
  const dealRespone = parseInt(getVal('DealRespone'), 10);
  const internalDealNumber = getVal('InternalDealNumber');

  return {
    responseCode,
    description,
    processEndOk: prossesEndOK,
    dealResponse: dealRespone,
    internalDealNumber: internalDealNumber != null ? String(internalDealNumber) : null,
  };
}

/**
 * Stop recurring profile so no future charges are executed.
 * Uses Cardcom BillGoldService/AddUpdateRecurringOrder with:
 * - Account.RecurringPaymentsActive=false
 * - RecurringPayments.ExtRecurringPayments.IsActive=false
 *
 * If cardcomAccountId is missing, fallback identifiers are email/phone.
 * @param {Object} opts
 * @param {string} [opts.lowProfileCode]
 * @param {string|number} [opts.cardcomAccountId]
 * @param {string} [opts.email]
 * @param {string} [opts.phone]
 * @param {number} [opts.terminalNumber]
 * @returns {Promise<{ responseCode: number, description: string, lowProfileCode: string, cardcomAccountId: string }>}
 */
export async function stopRecurringProfile(opts = {}) {
  const code = String(opts.lowProfileCode || '').trim();
  const accountId = String(opts.cardcomAccountId || '').trim();
  const email = String(opts.email || '').trim();
  const phone = String(opts.phone || '').trim();
  if (!code && !accountId) {
    throw new Error('Cannot cancel: Missing Cardcom identifiers for this deal');
  }

  const terminalNumber = Number(opts.terminalNumber || process.env.CARDCOM_TERMINAL || 0);
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

  const accountIdentifierXml = [
    accountId ? `<AccountId>${Number(accountId)}</AccountId>` : '',
    email ? `<Email>${escape(email)}</Email>` : '',
    phone ? `<PhMobile>${escape(phone)}</PhMobile>` : '',
  ]
    .filter(Boolean)
    .join('');

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddUpdateRecurringOrder xmlns="BillGoldService">
      <TerminalNumber>${terminalNumber}</TerminalNumber>
      <UserName>${escape(apiName)}</UserName>
      <Password>${escape(apiPassword)}</Password>
      <RecurringOrder>
        <InternalUsageRowID>${escape(code || accountId || email || phone)}</InternalUsageRowID>
        <Operation>Update</Operation>
        <Account>
          ${accountIdentifierXml}
          <RecurringPaymentsActive>false</RecurringPaymentsActive>
        </Account>
        ${code ? `<LowProfileDealGuid>${escape(code)}</LowProfileDealGuid>` : ''}
        <RecurringPayments>
          <ExtRecurringPayments>
            <IsActive>false</IsActive>
            <ReturnValue>${escape(code || accountId || email || phone)}</ReturnValue>
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

  if (responseCode !== 0) {
    throw new Error(description || `Cardcom recurring stop failed (${responseCode || 'unknown'})`);
  }

  return { responseCode, description, lowProfileCode: code, cardcomAccountId: accountId };
}
