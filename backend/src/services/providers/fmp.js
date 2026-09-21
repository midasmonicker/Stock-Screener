/**
 * providers/fmp.js
 * Backup provider: Financial Modeling Prep (FMP) for fundamentals and delayed data.
 */

const { safeFetchJson, parseNumber } = require('./utils');
let apiKeys = null;
try {
  apiKeys = require('../../config/apiKeys');
} catch (e) {
  apiKeys = null;
}

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

function isConfigured() {
  return Boolean(apiKeys?.fmp?.apiKey || process.env.FMP_API_KEY);
}

/**
 * Fetches quotes and fundamentals for tickers from Financial Modeling Prep.
 * Returns a dictionary mapping ticker -> { ticker, price, prevClose, volume, avgVolume, source: 'fmp' }.
 */
async function fetchFMPQuotes(tickers, options = {}) {
  const apiKey = apiKeys?.fmp?.apiKey || process.env.FMP_API_KEY;
  if (!apiKey || !tickers || tickers.length === 0) return {};

  const symbolsParam = tickers.map(t => t.toUpperCase()).join(',');
  const url = `${FMP_BASE_URL}/quote/${encodeURIComponent(symbolsParam)}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const rawData = await safeFetchJson(url, {}, options.timeoutMs || 8000);
    if (!Array.isArray(rawData)) return {};

    const results = {};
    for (const item of rawData) {
      if (!item || !item.symbol) continue;
      const sym = item.symbol.toUpperCase();

      results[sym] = {
        ticker: sym,
        price: parseNumber(item.price),
        prevClose: parseNumber(item.previousClose),
        volume: parseNumber(item.volume),
        avgVolume: parseNumber(item.avgVolume),
        source: 'fmp'
      };
    }

    return results;
  } catch (err) {
    return {};
  }
}

module.exports = {
  isConfigured,
  fetchFMPQuotes
};
