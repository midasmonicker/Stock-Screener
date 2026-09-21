/**
 * providers/polygon.js
 * Fallback provider: Polygon free tier for delayed OHLCV data.
 */

const { safeFetchJson, parseNumber } = require('./utils');
let apiKeys = null;
try {
  apiKeys = require('../../config/apiKeys');
} catch (e) {
  apiKeys = null;
}

const POLYGON_BASE_URL = 'https://api.polygon.io';

function isConfigured() {
  return Boolean(apiKeys?.polygon?.apiKey || process.env.POLYGON_API_KEY);
}

/**
 * Fetches delayed OHLCV for a single ticker from Polygon.io.
 * Tries the ticker snapshot first; if unavailable, falls back to previous day aggregate (/prev).
 */
async function fetchPolygonQuote(ticker, apiKey, options = {}) {
  const sym = ticker.toUpperCase();

  // Try snapshot first
  try {
    const snapUrl = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(sym)}?apiKey=${encodeURIComponent(apiKey)}`;
    const snapData = await safeFetchJson(snapUrl, {}, options.timeoutMs || 6000);

    if (snapData && snapData.ticker) {
      const t = snapData.ticker;
      const price = parseNumber(t.day?.c ?? t.lastTrade?.p ?? t.min?.c);
      const prevClose = parseNumber(t.prevDay?.c);
      const volume = parseNumber(t.day?.v);

      if (price !== null || prevClose !== null) {
        return {
          ticker: sym,
          price,
          prevClose,
          volume,
          avgVolume: null,
          source: 'polygon_snapshot'
        };
      }
    }
  } catch (err) {
    // Snapshot might require higher tier or fail, proceed to /prev aggregate
  }

  // Fallback to /prev agg (standard free tier endpoint)
  try {
    const prevUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(sym)}/prev?adjusted=true&apiKey=${encodeURIComponent(apiKey)}`;
    const prevData = await safeFetchJson(prevUrl, {}, options.timeoutMs || 6000);

    if (prevData && Array.isArray(prevData.results) && prevData.results.length > 0) {
      const bar = prevData.results[0];
      return {
        ticker: sym,
        price: parseNumber(bar.c),
        prevClose: parseNumber(bar.o), // In absence of separate prev bar, close/open provide reference
        volume: parseNumber(bar.v),
        avgVolume: null,
        source: 'polygon_prev'
      };
    }
  } catch (err) {
    // Graceful error return
  }

  return null;
}

/**
 * Fetches Polygon fallback data for an array of tickers.
 */
async function fetchPolygonQuotes(tickers, options = {}) {
  const apiKey = apiKeys?.polygon?.apiKey || process.env.POLYGON_API_KEY;
  if (!apiKey || !tickers || tickers.length === 0) return {};

  const results = {};
  const promises = tickers.map(async (ticker) => {
    const quote = await fetchPolygonQuote(ticker, apiKey, options);
    if (quote) {
      results[quote.ticker] = quote;
    }
  });

  await Promise.allSettled(promises);
  return results;
}

module.exports = {
  isConfigured,
  fetchPolygonQuote,
  fetchPolygonQuotes
};
