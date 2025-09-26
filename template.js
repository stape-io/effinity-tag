const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeString = require('makeString');
const Object = require('Object');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();
const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const url = getUrl(eventData);
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const actionHandlers = {
  pageView: handlePageViewEvent,
  conversion: handleConversionEvent
};

const handler = actionHandlers[data.type];
if (handler) {
  handler(data, eventData);
} else {
  return data.gtmOnFailure();
}

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getIds(eventData) {
  const idsFromUrl = parseIdsFromUrl(eventData);
  if (objHasProps(idsFromUrl)) return idsFromUrl;

  const idsStringFromCookie = getCookieValues('eff_cid')[0];
  if (idsStringFromCookie) return JSON.parse(idsStringFromCookie);
}

function parseIdsFromUrl(eventData) {
  const url = getUrl(eventData);
  if (!url) return;

  const urlSearchParams = parseUrl(url).searchParams;
  if (!urlSearchParams.eff_cpt) return;

  const idsOfInterestMap = {
    eff_cpt: 'id_compteur',
    eff_sub1: 'effi_id',
    eff_sub2: 'effi_id2',
    eff_pid: 'prod_id',
    eff_pcid: 'effi_pcid',
    eff_pcuid: 'effi_pcuid',
    eff_pr1: 'effi_param1'
  };

  const ids = {}; // It will contain at least 'eff_cpt' when returned.

  Object.entries(idsOfInterestMap).forEach((entry) => {
    const fromId = entry[0];
    const toId = entry[1];
    const idValue = urlSearchParams[fromId];
    if (!isValidValue(idValue)) return;
    ids[toId] = idValue;
  });

  return ids;
}

function handlePageViewEvent(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return data.gtmOnSuccess();

  const cookieOptions = {
    domain: data.cookieDomain || 'auto',
    samesite: data.cookieSameSite || 'none',
    path: '/',
    secure: true,
    httpOnly: !!data.cookieHttpOnly,
    'max-age': 60 * 60 * 24 * makeInteger(data.cookieExpiration || 30)
  };

  const ids = parseIdsFromUrl(eventData);
  if (objHasProps(ids)) {
    setCookie('eff_cid', JSON.stringify(ids), cookieOptions, false);
  }

  return data.gtmOnSuccess();
}

function addProductsData(items, requestData) {
  if (getType(items) === 'array' && items.length > 0) {
    const cartDetails = items.map((i) => {
      const item = {};
      if (i.item_id || i.id) item.id = i.item_id || i.id;
      if (i.item_name || i.nom) item.name = i.item_name || i.nom;
      if (isValidValue(i.price)) item.price = i.price;
      if (i.quantity) item.quantity = i.quantity;
      return item;
    });

    requestData.cart_detail = JSON.stringify(cartDetails);
  }

  return requestData;
}

function mapRequestData(data, eventData) {
  const requestData = {
    id: data.effinityId,
    origin: 'stape_s2s',
    ref: data.orderOrLeadId
  };

  if (isUIFieldTrue(data.autoMapData)) {
    if (eventData.transaction_id) requestData.ref = eventData.transaction_id;
    if (data.conversionType === 'sale') {
      if (eventData.value) requestData.montant = eventData.value;
      if (eventData.currency) requestData.monnaie = eventData.currency;
      if (eventData.coupon) requestData.voucher = eventData.coupon;
      if (eventData.payment_type) requestData.payment = eventData.payment_type;
      if (eventData.customer_type) {
        requestData.newcustomer = eventData.customer_type === 'new' ? '1' : '0';
      }
      if (eventData.items) addProductsData(eventData.items, requestData);
    }
  }

  if (data.conversionType === 'sale') {
    if (isValidValue(data.value)) requestData.montant = data.value;
    if (data.currency) requestData.monnaie = data.currency;
    if (data.voucher) requestData.voucher = data.voucher;
    if (data.paymentType) requestData.payment = data.paymentType;
    if (isValidValue(data.newCustomer)) {
      requestData.newcustomer = isUIFieldTrue(data.newCustomer) ? '1' : '0';
    }
    if (data.cart) addProductsData(data.cart, requestData);
  }

  if (isValidValue(data.consentPerformance)) {
    requestData.consent_performance = isUIFieldTrue(data.consentPerformance) ? '1' : '0';
  }
  if (isValidValue(data.attribution)) requestData.attrib = data.attribution;
  if (data.date) requestData.date = data.date;

  if (data.customFields) {
    data.customFields.forEach((field) => {
      const value = field.value;
      if (isValidValue(value)) requestData[field.name] = value;
    });
  }

  const ids = getIds(eventData);
  if (objHasProps(ids)) {
    for (const id in ids) requestData[id] = ids[id];
  }

  if (data.idCompteur) requestData.id_compteur = data.idCompteur;
  if (data.effiId) requestData.effi_id = data.effiId;
  if (data.effiId2) requestData.effi_id2 = data.effiId2;
  if (data.prodId) requestData.prod_id = data.prodId;
  if (data.effiPcid) requestData.effi_pcid = data.effiPcid;
  if (data.effiPcuid) requestData.effi_pcuid = data.effiPcuid;
  if (data.effiParam1) requestData.effi_param1 = data.effiParam1;

  return requestData;
}

function generateRequestBaseUrl(data) {
  const baseUrl = 'https://track.effiliation.com/servlet/effi.';
  const pathByConversionType = {
    sale: 'revenuemobile',
    lead: 'leadmobile'
  };

  return baseUrl + pathByConversionType[data.conversionType];
}

function generateRequestOptions() {
  const options = {
    method: 'GET'
  };

  return options;
}

function generateRequestUrlParameters(requestData) {
  const requestParametersList = [];
  for (const key in requestData) {
    const value = requestData[key];
    requestParametersList.push(enc(key) + '=' + enc(value));
  }

  return requestParametersList.join('&');
}

function sendRequest(data, requestData) {
  const requestUrl = generateRequestBaseUrl(data) + '?' + generateRequestUrlParameters(requestData);
  const requestOptions = generateRequestOptions(data);

  log({
    Name: 'Effinity',
    Type: 'Request',
    EventName: data.conversionType,
    RequestMethod: requestOptions.method,
    RequestUrl: requestUrl
  });

  return sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'Effinity',
        Type: 'Response',
        EventName: data.type,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (!useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 300) data.gtmOnSuccess();
        else data.gtmOnFailure();
      }
    },
    requestOptions
  );
}

function areThereRequiredParametersMissing(data, requestData) {
  const requiredCommonFieldsByConversionType = {
    sale: [
      'consent_performance',
      'id',
      'id_compteur',
      'monnaie',
      'montant',
      'origin',
      'ref',
      'voucher'
    ],
    lead: ['consent_performance', 'id', 'id_compteur', 'origin', 'ref']
  };

  const requiredCommonFields = requiredCommonFieldsByConversionType[data.conversionType];
  const anyCommonFieldMissing = requiredCommonFields.some((p) => !isValidValue(requestData[p]));
  if (anyCommonFieldMissing) return requiredCommonFields;
}

function handleConversionEvent(data, eventData) {
  const requestData = mapRequestData(data, eventData);

  const missingParameters = areThereRequiredParametersMissing(data, requestData);
  if (missingParameters) {
    log({
      Name: 'Effinity',
      Type: 'Message',
      EventName: data.type,
      Message: 'Request was not sent for conversion type: ' + data.conversionType,
      Reason: 'One or more required parameters are missing: ' + missingParameters.join(' or ')
    });

    return data.gtmOnFailure();
  }
  return sendRequest(data, requestData);
}

/*==============================================================================
  Helpers
==============================================================================*/

function getUrl(eventData) {
  return eventData.page_location || eventData.page_referrer || getRequestHeader('referer');
}

function objHasProps(obj) {
  return getType(obj) === 'object' && Object.keys(obj).length > 0;
}

function isUIFieldTrue(field) {
  return [true, 'true', 1, '1'].indexOf(field) !== -1;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function enc(data) {
  if (data === undefined || data === null) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  rawDataToLog.TraceId = getRequestHeader('trace-id');

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  BigQuery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
