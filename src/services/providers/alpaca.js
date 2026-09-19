/**
 * providers/alpaca.js
 * Primary real-time US quotes provider via Alpaca Market Data API v2.
 */

const { safeFetchJson, parseNumber } = require('./utils');
let apiKeys = null;
try {
  apiKeys = require('../../config/apiKeys');
} catch (e) {
  apiKeys = null;
}

const ALPACA_DATA_URL = apiKeys?.alpaca?.dataUrl || process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets';

/**
 * Checks whether Alpaca credentials are configured.
 */
function isConfigured() {
  const keyId = apiKeys?.alpaca?.apiKeyId || process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID;
  const secretKey = apiKeys?.alpaca?.secretKey || process.env.ALPACA_API_SECRET_KEY || process.env.APCA_API_SECRET_KEY;
  return Boolean(keyId && secretKey);
}

/**
 * Fetches real-time snapshots from Alpaca for an array of tickers.
 * Returns a dictionary mapping ticker -> { ticker, price, prevClose, volume, avgVolume, source: 'alpaca' }.
 */
async function fetchAlpacaQuotes(tickers, options = {}) {
  if (!tickers || tickers.length === 0) return {};

  const apiKeyId = apiKeys?.alpaca?.apiKeyId || process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID;
  const secretKey = apiKeys?.alpaca?.secretKey || process.env.ALPACA_API_SECRET_KEY || process.env.APCA_API_SECRET_KEY;

  if (!apiKeyId || !secretKey) {
    return {};
  }

  const symbolsParam = tickers.map(t => t.toUpperCase()).join(',');
  const url = `${ALPACA_DATA_URL}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbolsParam)}`;

  const headers = {
    'APCA-API-KEY-ID': apiKeyId,
    'APCA-API-SECRET-KEY': secretKey
  };

  const rawData = await safeFetchJson(url, { headers }, options.timeoutMs || 8000);
  const results = {};

  for (const ticker of tickers) {
    const sym = ticker.toUpperCase();
    const snap = rawData ? rawData[sym] : null;
    if (!snap) continue;

    const price = parseNumber(snap.latestTrade?.p ?? snap.dailyBar?.c ?? snap.minuteBar?.c);
    const prevClose = parseNumber(snap.prevDailyBar?.c);
    const volume = parseNumber(snap.dailyBar?.v);

    if (price !== null || prevClose !== null) {
      results[sym] = {
        ticker: sym,
        price,
        prevClose,
        volume,
        avgVolume: null, // Alpaca snapshot doesn't include historical avg volume
        source: 'alpaca'
      };
    }
  }

  return results;
}

module.exports = {
  isConfigured,
  fetchAlpacaQuotes
};
