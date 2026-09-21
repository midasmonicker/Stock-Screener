/**
 * providers/finnhub.js
 * Primary/Alternative real-time US quotes provider via Finnhub Stock API.
 */

const { safeFetchJson, parseNumber } = require('./utils');
let apiKeys = null;
try {
  apiKeys = require('../../config/apiKeys');
} catch (e) {
  apiKeys = null;
}

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function isConfigured() {
  return Boolean(apiKeys?.finnhub?.apiKey || process.env.FINNHUB_API_KEY);
}

/**
 * Fetches real-time quote for a single ticker via Finnhub.
 */
async function fetchFinnhubQuote(ticker, apiKey, options = {}) {
  const sym = ticker.toUpperCase();
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(apiKey)}`;

  try {
    const data = await safeFetchJson(url, {}, options.timeoutMs || 6000);
    if (!data) return null;

    const price = parseNumber(data.c);
    const prevClose = parseNumber(data.pc);

    // If both c and pc are 0, ticker is likely invalid on Finnhub
    if ((price === 0 || price === null) && (prevClose === 0 || prevClose === null)) {
      return null;
    }

    return {
      ticker: sym,
      price: price > 0 ? price : prevClose,
      prevClose: prevClose,
      volume: null, // Finnhub quote does not provide session volume
      avgVolume: null,
      source: 'finnhub'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fetches real-time quotes for an array of tickers from Finnhub.
 * Returns a dictionary mapping ticker -> { ticker, price, prevClose, volume, avgVolume, source: 'finnhub' }.
 */
async function fetchFinnhubQuotes(tickers, options = {}) {
  const apiKey = apiKeys?.finnhub?.apiKey || process.env.FINNHUB_API_KEY;
  if (!apiKey || !tickers || tickers.length === 0) return {};

  const results = {};
  const promises = tickers.map(async (ticker) => {
    const quote = await fetchFinnhubQuote(ticker, apiKey, options);
    if (quote) {
      results[quote.ticker] = quote;
    }
  });

  await Promise.allSettled(promises);
  return results;
}

module.exports = {
  isConfigured,
  fetchFinnhubQuote,
  fetchFinnhubQuotes
};
