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
    /** When true, ask Cardcom to create a BillGold recurring profile (subscription). */
    createRecurring = true,
    recurringType = 1,
    recurringTotalCount = 0,
    isCreateToken = true,
    isAutoCreateUpdateAccount = true,
  } = opts;

  const escape = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const recurringXml =
    createRecurring === false
      ? ''
      : `
    <CreateRecurring>true</CreateRecurring>
    <RecurringType>${Number(recurringType)}</RecurringType>
    <RecurringTotalCount>${Number(recurringTotalCount)}</RecurringTotalCount>`;

  const tokenAndAccountXml = `
    <IsCreateToken>${isCreateToken ? 'true' : 'false'}</IsCreateToken>
    <IsAutoCreateUpdateAccount>${isAutoCreateUpdateAccount ? 'true' : 'false'}</IsAutoCreateUpdateAccount>`;

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
    <IndicatorUrl>${escape(indicatorUrl)}</IndicatorUrl>${tokenAndAccountXml}${recurringXml}
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
 * Create Low Profile checkout page for subscriptions — same as {@link createLowProfileDeal}
 * with recurring defaults (CreateRecurring, monthly, unlimited count).
 */
export async function createLowProfilePage(opts) {
  return createLowProfileDeal({
    isCreateToken: true,
    isAutoCreateUpdateAccount: true,
    createRecurring: true,
    recurringType: 1,
    recurringTotalCount: 0,
    ...opts,
  });
}

/** Extract first tag value inside XML (non-greedy, first occurrence). */
function firstTagValue(xml, tag) {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([^<]*)</(?:[\\w]+:)?${tag}>`, 'i');
  const m = String(xml || '').match(re);
  return m ? m[1].trim() : null;
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
  const dealResponseRaw = firstTagValue(block, 'DealRespone');

  return {
    internalDealNumber: internalDealNumber != null ? String(internalDealNumber) : null,
    cardcomAccountId: accountId != null && String(accountId).trim() !== '' ? String(accountId).trim() : null,
    cardcomRecurringId: recurringId != null && String(recurringId).trim() !== '' ? String(recurringId).trim() : null,
    cardcomToken: token != null && String(token).trim() !== '' ? String(token).trim() : null,
    processEndOk: parseInt(processEndOkRaw, 10) === 1,
    dealResponse: dealResponseRaw != null ? parseInt(dealResponseRaw, 10) : null,
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
  const rootDeal = parseInt(getVal('DealRespone'), 10);
  const rootAccountId = getVal('AccountId');
  const rootRecurringId = getVal('RecurringId') || getVal('RowID');
  const rootToken = getVal('Token') || getVal('CardToken') || getVal('TokenToSave');

  return {
    responseCode,
    description,
    processEndOk: parsed.processEndOk || rootOk,
    dealResponse: Number.isFinite(parsed.dealResponse) ? parsed.dealResponse : rootDeal,
    internalDealNumber: parsed.internalDealNumber || (rootInternal != null ? String(rootInternal) : null),
    cardcomAccountId: parsed.cardcomAccountId || (rootAccountId != null ? String(rootAccountId).trim() : null),
    cardcomRecurringId: parsed.cardcomRecurringId || (rootRecurringId != null ? String(rootRecurringId).trim() : null),
    cardcomToken: parsed.cardcomToken || (rootToken != null ? String(rootToken).trim() : null),
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
  const lowProfileCode = String(opts.lowProfileCode || '').trim();
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

  const accountNum = parseInt(accountId, 10);
  const recurringNum = parseInt(recurringId, 10);
  if (!Number.isFinite(accountNum) || !Number.isFinite(recurringNum)) {
    throw new Error('Invalid Cardcom AccountId or RecurringId (must be numeric)');
  }
  const rowKey = lowProfileCode || accountId;

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddUpdateRecurringOrder xmlns="BillGoldService">
      <TerminalNumber>${terminalNumber}</TerminalNumber>
      <UserName>${escape(apiName)}</UserName>
      <Password>${escape(apiPassword)}</Password>
      <RecurringOrder>
        <InternalUsageRowID>${escape(rowKey)}</InternalUsageRowID>
        <Operation>Update</Operation>
        <Account>
          <AccountId>${accountNum}</AccountId>
          <RecurringPaymentsActive>false</RecurringPaymentsActive>
        </Account>
        ${lowProfileCode ? `<LowProfileDealGuid>${escape(lowProfileCode)}</LowProfileDealGuid>` : ''}
        <RecurringPayments>
          <ExtRecurringPayments>
            <RecurringId>${recurringNum}</RecurringId>
            <IsActive>false</IsActive>
            <ReturnValue>${escape(rowKey)}</ReturnValue>
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
    console.error('[cardcom] stopRecurringProfile failed', {
      terminalNumber,
      lowProfileCode: lowProfileCode || null,
      cardcomAccountId: accountId,
      cardcomRecurringId: recurringId,
      requestXml: soap,
      responseXml: xml,
    });
    throw new Error(description || `Cardcom recurring stop failed (${responseCode || 'unknown'})`);
  }

  return { responseCode, description, lowProfileCode };
}
