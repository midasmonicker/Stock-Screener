/**
 * providers/eodhd.js
 * Backup provider: EODHD (EOD Historical Data) for fundamentals and delayed real-time quotes.
 */

const { safeFetchJson, parseNumber } = require('./utils');
let apiKeys = null;
try {
  apiKeys = require('../../config/apiKeys');
} catch (e) {
  apiKeys = null;
}

const EODHD_BASE_URL = 'https://eodhd.com/api';

function isConfigured() {
  return Boolean(apiKeys?.eodhd?.apiToken || process.env.EODHD_API_KEY || process.env.EOD_API_KEY);
}

/**
 * Fetches real-time quote for a single ticker from EODHD.
 */
async function fetchEODHDQuote(ticker, apiKey, options = {}) {
  const sym = ticker.toUpperCase();
  // US tickers default to .US suffix on EODHD if not specified
  const formattedSym = sym.includes('.') ? sym : `${sym}.US`;
  const url = `${EODHD_BASE_URL}/real-time/${encodeURIComponent(formattedSym)}?api_token=${encodeURIComponent(apiKey)}&fmt=json`;

  try {
    const data = await safeFetchJson(url, {}, options.timeoutMs || 6000);
    if (!data) return null;

    return {
      ticker: sym,
      price: parseNumber(data.close),
      prevClose: parseNumber(data.previousClose),
      volume: parseNumber(data.volume),
      avgVolume: null,
      source: 'eodhd'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fetches quotes from EODHD for multiple tickers.
 */
async function fetchEODHDQuotes(tickers, options = {}) {
  const apiKey = apiKeys?.eodhd?.apiToken || process.env.EODHD_API_KEY || process.env.EOD_API_KEY;
  if (!apiKey || !tickers || tickers.length === 0) return {};

  const results = {};
  const promises = tickers.map(async (ticker) => {
    const quote = await fetchEODHDQuote(ticker, apiKey, options);
    if (quote) {
      results[quote.ticker] = quote;
    }
  });

  await Promise.allSettled(promises);
  return results;
}

module.exports = {
  isConfigured,
  fetchEODHDQuote,
  fetchEODHDQuotes
};
