/**
 * Cardcom Low Profile API – create payment link (SOAP).
 * Test terminal credentials from .env: CARDCOM_TERMINAL, CARDCOM_USER, CARDCOM_PASS.
 */

import axios from 'axios';

const CARDCOM_SOAP_URL = 'https://secure.cardcom.co.il/service.asmx';

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
