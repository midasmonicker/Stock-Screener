/**
 * dataService.js
 * Multi-tier stock market data service in Node.js with cascading failover.
 *
 * Failover Order:
 * 1. Try Alpaca first for real-time US quotes. If it fails...
 * 2. Try Finnhub. If it fails...
 * 3. Try FMP (Financial Modeling Prep). If it fails...
 * 4. Try Polygon free tier for delayed OHLCV.
 *
 * Screening Metrics:
 * - Finviz via finvizfinance (Python wrapper, called separately) provides avgVolume
 *   and screening metrics, and serves as a fundamental enrichment layer.
 *
 * Logging:
 * - Logs which source was used for each ticker.
 *
 * Exports:
 * fetchMarketData(tickers, options) -> Promise<Array<{ ticker, price, prevClose, volume, avgVolume }>>
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadEnv, parseNumber } = require('./providers/utils');
const alpacaProvider = require('./providers/alpaca');
const finnhubProvider = require('./providers/finnhub');
const fmpProvider = require('./providers/fmp');
const eodhdProvider = require('./providers/eodhd');
const finvizProvider = require('./providers/finviz');
const polygonProvider = require('./providers/polygon');

// Ensure environment variables are loaded from .env if present
loadEnv();

/**
 * Checks whether a provider response object contains a valid quote.
 */
function hasValidQuote(quote) {
  return Boolean(
    quote && (
      (quote.price !== null && quote.price !== undefined && quote.price > 0) ||
      (quote.prevClose !== null && quote.prevClose !== undefined && quote.prevClose > 0)
    )
  );
}

/**
 * Fetches and normalizes stock market data for a list of tickers with cascading failover.
 *
 * @param {string[]|string} tickers - Array of stock ticker strings (e.g. ['AAPL', 'MSFT'])
 * @param {object} [options] - Optional configurations (logger, providers, timeoutMs, debug, pythonPath)
 * @returns {Promise<Array<{ ticker: string, price: number|null, prevClose: number|null, volume: number|null, avgVolume: number|null }>>}
 */
async function fetchMarketData(tickers, options = {}) {
  const log = options.logger !== undefined ? options.logger : console.log;

  // Injectable providers for testing and modularity
  const alpaca = options.providers?.alpaca || alpacaProvider;
  const finnhub = options.providers?.finnhub || finnhubProvider;
  const fmp = options.providers?.fmp || fmpProvider;
  const eodhd = options.providers?.eodhd || eodhdProvider;
  const polygon = options.providers?.polygon || polygonProvider;
  const finviz = options.providers?.finviz || finvizProvider;

  // Normalize tickers input
  if (!tickers) return [];
  const rawList = Array.isArray(tickers) ? tickers : [tickers];
  const symbolList = [...new Set(
    rawList
      .map(t => (typeof t === 'string' ? t.trim().toUpperCase() : ''))
      .filter(Boolean)
  )];

  if (symbolList.length === 0) return [];

  // Aggregated state keyed by ticker
  const records = {};
  const sourceUsed = {};

  for (const sym of symbolList) {
    records[sym] = {
      ticker: sym,
      price: null,
      prevClose: null,
      volume: null,
      avgVolume: null
    };
    sourceUsed[sym] = null;
  }

  const getPendingTickers = () => symbolList.filter(sym => !sourceUsed[sym]);

  // --------------------------------------------------------------------------
  // STEP 1: Try Alpaca first
  // --------------------------------------------------------------------------
  let pendingTickers = getPendingTickers();
  if (alpaca.isConfigured() && pendingTickers.length > 0) {
    try {
      if (options.debug) console.log('[dataService] Attempting Step 1: Alpaca for', pendingTickers);
      const alpacaData = await alpaca.fetchAlpacaQuotes(pendingTickers, options);
      for (const [sym, quote] of Object.entries(alpacaData || {})) {
        if (!records[sym]) continue;
        if (hasValidQuote(quote)) {
          if (quote.price !== null) records[sym].price = quote.price;
          if (quote.prevClose !== null) records[sym].prevClose = quote.prevClose;
          if (quote.volume !== null) records[sym].volume = quote.volume;
          sourceUsed[sym] = 'Alpaca';
        }
      }
    } catch (err) {
      if (options.debug) console.warn('[dataService] Alpaca failed:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 2: If Alpaca fails, try Finnhub
  // --------------------------------------------------------------------------
  pendingTickers = getPendingTickers();
  if (finnhub.isConfigured() && pendingTickers.length > 0) {
    try {
      if (options.debug) console.log('[dataService] Attempting Step 2: Finnhub failover for', pendingTickers);
      const finnhubData = await finnhub.fetchFinnhubQuotes(pendingTickers, options);
      for (const [sym, quote] of Object.entries(finnhubData || {})) {
        if (!records[sym]) continue;
        if (hasValidQuote(quote)) {
          if (quote.price !== null) records[sym].price = quote.price;
          if (quote.prevClose !== null) records[sym].prevClose = quote.prevClose;
          if (quote.volume !== null) records[sym].volume = quote.volume;
          sourceUsed[sym] = 'Finnhub';
        }
      }
    } catch (err) {
      if (options.debug) console.warn('[dataService] Finnhub failed:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: If Finnhub fails, try FMP (Financial Modeling Prep)
  // --------------------------------------------------------------------------
  pendingTickers = getPendingTickers();
  if (fmp.isConfigured() && pendingTickers.length > 0) {
    try {
      if (options.debug) console.log('[dataService] Attempting Step 3: FMP failover for', pendingTickers);
      const fmpData = await fmp.fetchFMPQuotes(pendingTickers, options);
      for (const [sym, quote] of Object.entries(fmpData || {})) {
        if (!records[sym]) continue;
        if (hasValidQuote(quote)) {
          if (quote.price !== null) records[sym].price = quote.price;
          if (quote.prevClose !== null) records[sym].prevClose = quote.prevClose;
          if (quote.volume !== null) records[sym].volume = quote.volume;
          if (quote.avgVolume !== null) records[sym].avgVolume = quote.avgVolume;
          sourceUsed[sym] = 'FMP';
        }
      }
    } catch (err) {
      if (options.debug) console.warn('[dataService] FMP failed:', err.message);
    }
  }

  // Optional secondary backup: EODHD if FMP wasn't configured or failed
  pendingTickers = getPendingTickers();
  if (eodhd.isConfigured() && pendingTickers.length > 0) {
    try {
      if (options.debug) console.log('[dataService] Attempting EODHD backup for', pendingTickers);
      const eodhdData = await eodhd.fetchEODHDQuotes(pendingTickers, options);
      for (const [sym, quote] of Object.entries(eodhdData || {})) {
        if (!records[sym]) continue;
        if (hasValidQuote(quote)) {
          if (quote.price !== null) records[sym].price = quote.price;
          if (quote.prevClose !== null) records[sym].prevClose = quote.prevClose;
          if (quote.volume !== null) records[sym].volume = quote.volume;
          sourceUsed[sym] = 'EODHD';
        }
      }
    } catch (err) {
      if (options.debug) console.warn('[dataService] EODHD failed:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 4: If FMP fails, try Polygon (free tier delayed OHLCV)
  // --------------------------------------------------------------------------
  pendingTickers = getPendingTickers();
  if (polygon.isConfigured() && pendingTickers.length > 0) {
    try {
      if (options.debug) console.log('[dataService] Attempting Step 4: Polygon failover for', pendingTickers);
      const polygonData = await polygon.fetchPolygonQuotes(pendingTickers, options);
      for (const [sym, quote] of Object.entries(polygonData || {})) {
        if (!records[sym]) continue;
        if (hasValidQuote(quote)) {
          if (quote.price !== null) records[sym].price = quote.price;
          if (quote.prevClose !== null) records[sym].prevClose = quote.prevClose;
          if (quote.volume !== null) records[sym].volume = quote.volume;
          sourceUsed[sym] = 'Polygon';
        }
      }
    } catch (err) {
      if (options.debug) console.warn('[dataService] Polygon failed:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: Screening Metrics via Finviz (Python finvizfinance wrapper)
  // --------------------------------------------------------------------------
  // Populates avgVolume across all tickers and acts as quote fallback if quote APIs failed
  try {
    if (options.debug) console.log('[dataService] Fetching Finviz screening metrics...');
    const finvizData = await finviz.fetchFinvizMetrics(symbolList, options);
    for (const [sym, item] of Object.entries(finvizData || {})) {
      if (!records[sym]) continue;

      // Populate avgVolume
      if (records[sym].avgVolume === null && item.avgVolume !== null) {
        records[sym].avgVolume = item.avgVolume;
      }

      // If all quote APIs failed (or had no keys), fallback to Finviz quote data
      if (!sourceUsed[sym] && hasValidQuote(item)) {
        if (records[sym].price === null && item.price !== null) records[sym].price = item.price;
        if (records[sym].prevClose === null && item.prevClose !== null) records[sym].prevClose = item.prevClose;
        if (records[sym].volume === null && item.volume !== null) records[sym].volume = item.volume;
        sourceUsed[sym] = 'Finviz';
      }

      // If quote source lacked volume (e.g. Finnhub /quote), supplement volume from Finviz
      if (records[sym].volume === null && item.volume !== null) {
        records[sym].volume = item.volume;
      }
    }
  } catch (err) {
    if (options.debug) console.warn('[dataService] Finviz metrics failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 6: Log which source was used for each ticker
  // --------------------------------------------------------------------------
  for (const sym of symbolList) {
    const source = sourceUsed[sym] || 'None (all providers failed)';
    if (typeof log === 'function') {
      log(`[dataService] ${sym}: Source used -> ${source}`);
    }
  }

  // --------------------------------------------------------------------------
  // Output Normalization: { ticker, price, prevClose, volume, avgVolume }
  // --------------------------------------------------------------------------
  return symbolList.map(sym => {
    const r = records[sym];
    return {
      ticker: sym,
      price: r.price !== null ? parseNumber(r.price) : null,
      prevClose: r.prevClose !== null ? parseNumber(r.prevClose) : null,
      volume: r.volume !== null ? Math.round(Number(r.volume)) : null,
      avgVolume: r.avgVolume !== null ? Math.round(Number(r.avgVolume)) : null
    };
  });
}

/**
 * Helper to compute signal metrics for a single stock object.
 */
const { RSI } = require('technicalindicators');

function detectSingleSignal(stock) {
  if (!stock || typeof stock !== 'object') {
    return { ticker: '', price: null, change_pct: null, rel_vol: null, signal: null };
  }

  const ticker = stock.ticker || '';
  const price = stock.price != null ? parseNumber(stock.price) : null;
  const prevClose = stock.prevClose != null ? parseNumber(stock.prevClose) : null;
  const volume = stock.volume != null ? parseNumber(stock.volume) : null;
  const avgVolume = stock.avgVolume != null ? parseNumber(stock.avgVolume) : null;

  // % Change
  let rawChangePct = null;
  if (price !== null && prevClose !== null && prevClose > 0) {
    rawChangePct = ((price - prevClose) / prevClose) * 100;
  }

  // Relative Volume
  let rawRelVol = null;
  if (volume !== null && avgVolume !== null && avgVolume > 0) {
    rawRelVol = volume / avgVolume;
  }

  // Signal rules
  let signal = null;
  if (rawRelVol !== null && rawChangePct !== null && rawRelVol >= 2.0 && rawChangePct >= 3.0) {
    signal = 'High Buying Interest';
  } else if (rawRelVol !== null && rawRelVol >= 2.0) {
    signal = 'Unusual Volume';
  } else if (rawChangePct !== null && rawChangePct >= 3.0) {
    signal = 'Price Momentum';
  }

  // RSI enrichment
  if (stock.history && Array.isArray(stock.history)) {
    const closes = stock.history.map(h => h.close);
    const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
    if (rsi < 30) signal = 'Oversold (Bullish)';
    else if (rsi > 70) signal = 'Overbought (Bearish)';
  }

  return {
    ticker,
    price,
    change_pct: rawChangePct !== null ? Number(rawChangePct.toFixed(2)) : null,
    rel_vol: rawRelVol !== null ? Number(rawRelVol.toFixed(2)) : null,
    signal
  };
}

/**
 * Detects trading signals for a stock or array of stocks.
 *
 * @param {object|object[]} stock - A stock object { ticker, price, prevClose, volume, avgVolume } or array of stocks
 * @returns {object|object[]} JSON object with { ticker, price, change_pct, rel_vol, signal }
 */
function detectSignal(stock) {
  if (Array.isArray(stock)) {
    return stock.map(detectSingleSignal);
  }
  return detectSingleSignal(stock);
}

/**
 * Reads a screened stocks JSON file (finviz_signals.json) and merges it with the signals output.
 *
 * @param {string|object[]} [jsonPathOrData='finviz_signals.json'] - File path to screener JSON or parsed array
 * @param {object} [options] - Options (e.g. refreshMarketData to query live quotes)
 * @returns {Promise<Array<object>>} Merged array of screened stocks with their computed signals
 */
async function loadScreenedSignals(jsonPathOrData = 'finviz_signals.json', options = {}) {
  let screenedList = [];

  // Resolve file path if a string was passed
  let filePath = resolveFinvizFile();
  if (typeof jsonPathOrData === 'string') {
    filePath = path.isAbsolute(jsonPathOrData)
      ? jsonPathOrData
      : path.resolve(process.cwd(), jsonPathOrData);

    // Fallback to alternate file if not found
    if (!fs.existsSync(filePath) && (jsonPathOrData === 'finviz_signals.json' || jsonPathOrData === 'screened_stocks.json')) {
      const altFile = jsonPathOrData === 'finviz_signals.json' ? 'screened_stocks.json' : 'finviz_signals.json';
      const altPath = path.resolve(process.cwd(), altFile);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      }
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`[dataService] Screened stocks JSON file not found at: ${filePath}`);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    screenedList = JSON.parse(content);
  } else if (Array.isArray(jsonPathOrData)) {
    screenedList = jsonPathOrData;
  } else if (jsonPathOrData && typeof jsonPathOrData === 'object') {
    screenedList = [jsonPathOrData];
  }

  if (!Array.isArray(screenedList)) {
    return [];
  }

  // Optionally refresh with live quotes
  let freshQuotesMap = {};
  if (options.refreshMarketData) {
    const tickers = screenedList.map(s => s.ticker).filter(Boolean);
    const freshData = await fetchMarketData(tickers, options);
    for (const item of freshData) {
      freshQuotesMap[item.ticker] = item;
    }
  }

  return screenedList.map(screened => {
    const ticker = screened.ticker ? screened.ticker.toUpperCase() : '';
    const fresh = freshQuotesMap[ticker] || {};

    // Merge screener data with fresh quotes
    const mergedStock = {
      ticker,
      price: fresh.price ?? screened.price ?? null,
      prevClose: fresh.prevClose ?? screened.prevClose ?? null,
      volume: fresh.volume ?? screened.volume ?? null,
      avgVolume: fresh.avgVolume ?? screened.avgVolume ?? null
    };

    // Detect signal
    const sig = detectSignal(mergedStock);

    return {
      ticker,
      company: screened.company || '',
      sector: screened.sector || '',
      industry: screened.industry || '',
      price: sig.price,
      prevClose: mergedStock.prevClose,
      volume: mergedStock.volume,
      avgVolume: mergedStock.avgVolume,
      change_pct: sig.change_pct !== null ? sig.change_pct : (screened.change_pct ?? null),
      rel_vol: sig.rel_vol !== null ? sig.rel_vol : (screened.relVolume ?? null),
      signal: sig.signal
    };
  });
}

// Module exports
module.exports = {
  fetchMarketData,
  detectSignal,
  loadScreenedSignals,
  mergeScreenedSignals: loadScreenedSignals,
  hasValidQuote,
  // Export individual providers for modular direct access
  providers: {
    alpaca: alpacaProvider,
    finnhub: finnhubProvider,
    fmp: fmpProvider,
    eodhd: eodhdProvider,
    finviz: finvizProvider,
    polygon: polygonProvider
  }
};

// Default export compatibility
module.exports.default = fetchMarketData;
module.exports.detectSignal = detectSignal;
module.exports.loadScreenedSignals = loadScreenedSignals;
module.exports.mergeScreenedSignals = loadScreenedSignals;

function resolveFinvizFile() {
  // Prefer persistent disk path if available (Render)
  const diskPath = '/data/finviz_signals.json';
  if (fs.existsSync(diskPath)) {
    return diskPath;
  }

  // Fall back to repo root (local dev or GitHub Actions commit)
  const repoPath = path.resolve(process.cwd(), 'finviz_signals.json');
  if (fs.existsSync(repoPath)) {
    return repoPath;
  }

  // Final fallback: screened_stocks.json if present
  const altPath = path.resolve(process.cwd(), 'screened_stocks.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }

  // If nothing found, return null
  return null;
}

