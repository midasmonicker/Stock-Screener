/**
 * test/dataService.test.js
 * Comprehensive automated tests for dataService.js and its cascading failover logic:
 * - Alpaca -> Finnhub -> FMP -> Polygon
 * - Logging verification for each source used
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { fetchMarketData, detectSignal, loadScreenedSignals, mergeScreenedSignals, providers } = require('../dataService');
const { parseSuffixedNumber, parseNumber } = require('../providers/utils');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    process.stdout.write(`  ▶ ${name}... `);
    await fn();
    console.log('✔ PASSED');
    passedTests++;
  } catch (err) {
    console.log('✖ FAILED');
    console.error(`    Error: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function suite() {
  console.log('\n=======================================================');
  console.log('  Running dataService.js Failover & Logging Test Suite');
  console.log('=======================================================\n');

  // 1. Test Utility Functions
  console.log('--- Unit Tests: Utils ---');

  await runTest('parseNumber handles numeric, string, and null inputs', () => {
    assert.equal(parseNumber(123.45), 123.45);
    assert.equal(parseNumber('123.45'), 123.45);
    assert.equal(parseNumber(null), null);
    assert.equal(parseNumber(undefined), null);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('invalid'), null);
  });

  await runTest('parseSuffixedNumber handles K, M, B, T multipliers and formatting', () => {
    assert.equal(parseSuffixedNumber('100'), 100);
    assert.equal(parseSuffixedNumber('500K'), 500000);
    assert.equal(parseSuffixedNumber('53.43M'), 53430000);
    assert.equal(parseSuffixedNumber('1.25B'), 1250000000);
    assert.equal(parseSuffixedNumber('2.5T'), 2500000000000);
    assert.equal(parseSuffixedNumber('86,588,203'), 86588203);
    assert.equal(parseSuffixedNumber('$175.50'), 175.5);
    assert.equal(parseSuffixedNumber('-'), null);
    assert.equal(parseSuffixedNumber('N/A'), null);
  });

  // 2. Test Input Edge Cases
  console.log('\n--- Unit Tests: Input Validation & Normalization ---');

  await runTest('fetchMarketData handles empty or missing inputs', async () => {
    const empty1 = await fetchMarketData([]);
    assert.deepEqual(empty1, []);

    const empty2 = await fetchMarketData(null);
    assert.deepEqual(empty2, []);

    const empty3 = await fetchMarketData('');
    assert.deepEqual(empty3, []);
  });

  await runTest('fetchMarketData deduplicates and normalizes lowercase tickers', async () => {
    const logs = [];
    const result = await fetchMarketData(['aapl', 'AAPL', '  aapl  '], {
      logger: (msg) => logs.push(msg),
      timeoutMs: 1000
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].ticker, 'AAPL');
    assert.ok(logs.some(l => l.includes('AAPL: Source used ->')));
  });

  // 3. Test Failover Chain: Alpaca -> Finnhub -> FMP -> Polygon
  console.log('\n--- Failover Logic & Source Logging Tests ---');

  await runTest('Step 1: Uses Alpaca when available and logs Alpaca as source', async () => {
    const logs = [];
    const mockProviders = {
      alpaca: {
        isConfigured: () => true,
        fetchAlpacaQuotes: async () => ({
          AAPL: { ticker: 'AAPL', price: 180.5, prevClose: 179.0, volume: 50000000 }
        })
      },
      finnhub: { isConfigured: () => false, fetchFinnhubQuotes: async () => ({}) },
      fmp: { isConfigured: () => false, fetchFMPQuotes: async () => ({}) },
      polygon: { isConfigured: () => false, fetchPolygonQuotes: async () => ({}) },
      finviz: { fetchFinvizMetrics: async () => ({ AAPL: { avgVolume: 60000000 } }) }
    };

    const res = await fetchMarketData(['AAPL'], {
      providers: mockProviders,
      logger: (msg) => logs.push(msg)
    });

    assert.equal(res[0].price, 180.5);
    assert.equal(res[0].prevClose, 179.0);
    assert.equal(res[0].volume, 50000000);
    assert.equal(res[0].avgVolume, 60000000);
    assert.ok(logs.some(l => l.includes('AAPL: Source used -> Alpaca')), 'Must log Alpaca as source');
  });

  await runTest('Step 2: If Alpaca fails, fails over to Finnhub and logs Finnhub as source', async () => {
    const logs = [];
    const mockProviders = {
      alpaca: {
        isConfigured: () => true,
        fetchAlpacaQuotes: async () => { throw new Error('Alpaca 429 Rate Limit'); }
      },
      finnhub: {
        isConfigured: () => true,
        fetchFinnhubQuotes: async () => ({
          AAPL: { ticker: 'AAPL', price: 181.0, prevClose: 179.5, volume: null }
        })
      },
      fmp: { isConfigured: () => false, fetchFMPQuotes: async () => ({}) },
      polygon: { isConfigured: () => false, fetchPolygonQuotes: async () => ({}) },
      finviz: { fetchFinvizMetrics: async () => ({ AAPL: { volume: 51000000, avgVolume: 61000000 } }) }
    };

    const res = await fetchMarketData(['AAPL'], {
      providers: mockProviders,
      logger: (msg) => logs.push(msg)
    });

    assert.equal(res[0].price, 181.0);
    assert.equal(res[0].prevClose, 179.5);
    assert.equal(res[0].volume, 51000000); // Enriched by Finviz
    assert.equal(res[0].avgVolume, 61000000);
    assert.ok(logs.some(l => l.includes('AAPL: Source used -> Finnhub')), 'Must log Finnhub as source');
  });

  await runTest('Step 3: If Finnhub fails, fails over to FMP and logs FMP as source', async () => {
    const logs = [];
    const mockProviders = {
      alpaca: { isConfigured: () => false },
      finnhub: {
        isConfigured: () => true,
        fetchFinnhubQuotes: async () => ({}) // Empty or failed
      },
      fmp: {
        isConfigured: () => true,
        fetchFMPQuotes: async () => ({
          AAPL: { ticker: 'AAPL', price: 182.0, prevClose: 180.0, volume: 52000000, avgVolume: 62000000 }
        })
      },
      polygon: { isConfigured: () => false, fetchPolygonQuotes: async () => ({}) },
      finviz: { fetchFinvizMetrics: async () => ({}) }
    };

    const res = await fetchMarketData(['AAPL'], {
      providers: mockProviders,
      logger: (msg) => logs.push(msg)
    });

    assert.equal(res[0].price, 182.0);
    assert.equal(res[0].prevClose, 180.0);
    assert.equal(res[0].volume, 52000000);
    assert.equal(res[0].avgVolume, 62000000);
    assert.ok(logs.some(l => l.includes('AAPL: Source used -> FMP')), 'Must log FMP as source');
  });

  await runTest('Step 4: If FMP fails, fails over to Polygon and logs Polygon as source', async () => {
    const logs = [];
    const mockProviders = {
      alpaca: { isConfigured: () => false },
      finnhub: { isConfigured: () => false },
      fmp: {
        isConfigured: () => true,
        fetchFMPQuotes: async () => { throw new Error('FMP quota exceeded'); }
      },
      polygon: {
        isConfigured: () => true,
        fetchPolygonQuotes: async () => ({
          AAPL: { ticker: 'AAPL', price: 183.0, prevClose: 181.0, volume: 53000000, source: 'polygon_snapshot' }
        })
      },
      finviz: { fetchFinvizMetrics: async () => ({ AAPL: { avgVolume: 63000000 } }) }
    };

    const res = await fetchMarketData(['AAPL'], {
      providers: mockProviders,
      logger: (msg) => logs.push(msg)
    });

    assert.equal(res[0].price, 183.0);
    assert.equal(res[0].prevClose, 181.0);
    assert.equal(res[0].volume, 53000000);
    assert.equal(res[0].avgVolume, 63000000);
    assert.ok(logs.some(l => l.includes('AAPL: Source used -> Polygon')), 'Must log Polygon as source');
  });

  await runTest('Multi-ticker mixed failover: different tickers resolve to different sources', async () => {
    const logs = [];
    const mockProviders = {
      alpaca: {
        isConfigured: () => true,
        // Alpaca only has data for AAPL
        fetchAlpacaQuotes: async () => ({
          AAPL: { ticker: 'AAPL', price: 180.0, prevClose: 178.0, volume: 50000000 }
        })
      },
      finnhub: {
        isConfigured: () => true,
        // Finnhub resolves MSFT
        fetchFinnhubQuotes: async () => ({
          MSFT: { ticker: 'MSFT', price: 420.0, prevClose: 415.0, volume: null }
        })
      },
      fmp: {
        isConfigured: () => true,
        // FMP resolves NVDA
        fetchFMPQuotes: async () => ({
          NVDA: { ticker: 'NVDA', price: 125.0, prevClose: 120.0, volume: 70000000, avgVolume: 65000000 }
        })
      },
      polygon: {
        isConfigured: () => true,
        // Polygon resolves GOOGL
        fetchPolygonQuotes: async () => ({
          GOOGL: { ticker: 'GOOGL', price: 170.0, prevClose: 168.0, volume: 30000000 }
        })
      },
      finviz: {
        fetchFinvizMetrics: async () => ({
          AAPL: { avgVolume: 55000000 },
          MSFT: { volume: 28000000, avgVolume: 30000000 },
          NVDA: { avgVolume: 65000000 },
          GOOGL: { avgVolume: 35000000 }
        })
      }
    };

    const res = await fetchMarketData(['AAPL', 'MSFT', 'NVDA', 'GOOGL'], {
      providers: mockProviders,
      logger: (msg) => logs.push(msg)
    });

    assert.equal(res.length, 4);
    assert.ok(logs.some(l => l.includes('AAPL: Source used -> Alpaca')));
    assert.ok(logs.some(l => l.includes('MSFT: Source used -> Finnhub')));
    assert.ok(logs.some(l => l.includes('NVDA: Source used -> FMP')));
    assert.ok(logs.some(l => l.includes('GOOGL: Source used -> Polygon')));
  });

  // 4. Live Python Finviz Integration & End-to-End
  console.log('\n--- Live Integration & Logging Verification ---');

  await runTest('Live fetchMarketData executes failover and logs source for live tickers', async () => {
    const logs = [];
    const stocks = await fetchMarketData(['AAPL', 'MSFT'], {
      logger: (msg) => {
        logs.push(msg);
        console.log(`\n        [Console Log Output]: ${msg}`);
      }
    });

    assert.equal(stocks.length, 2);
    for (const s of stocks) {
      assert.ok(s.ticker);
      assert.ok(typeof s.price === 'number' && s.price > 0);
      assert.ok(typeof s.prevClose === 'number' && s.prevClose > 0);
      assert.ok(typeof s.volume === 'number' && s.volume > 0);
      assert.ok(typeof s.avgVolume === 'number' && s.avgVolume > 0);
      assert.ok(logs.some(l => l.includes(`${s.ticker}: Source used ->`)));
    }
  });

  await runTest('Logs failure when all sources fail for an invalid ticker', async () => {
    const logs = [];
    const stocks = await fetchMarketData(['NONEXISTENTTICKER999'], {
      logger: (msg) => logs.push(msg)
    });

    assert.equal(stocks.length, 1);
    assert.equal(stocks[0].price, null);
    assert.ok(logs.some(l => l.includes('NONEXISTENTTICKER999: Source used -> None')));
  });

  // 5. Test detectSignal rules & metrics
  console.log('\n--- Unit Tests: detectSignal Signals & Calculations ---');

  await runTest('detectSignal calculates High Buying Interest (relVol >= 2.0 and %Change >= 3.0)', () => {
    const stock = {
      ticker: 'NVDA',
      price: 105.0,
      prevClose: 100.0, // +5.0% change
      volume: 25000000,
      avgVolume: 10000000 // 2.5x relative volume
    };

    const res = detectSignal(stock);
    assert.deepEqual(res, {
      ticker: 'NVDA',
      price: 105.0,
      change_pct: 5.0,
      rel_vol: 2.5,
      signal: 'High Buying Interest'
    });
  });

  await runTest('detectSignal calculates Unusual Volume (relVol >= 2.0 and %Change < 3.0)', () => {
    const stock = {
      ticker: 'INTC',
      price: 20.2,
      prevClose: 20.0, // +1.0% change
      volume: 22000000,
      avgVolume: 10000000 // 2.2x relative volume
    };

    const res = detectSignal(stock);
    assert.deepEqual(res, {
      ticker: 'INTC',
      price: 20.2,
      change_pct: 1.0,
      rel_vol: 2.2,
      signal: 'Unusual Volume'
    });
  });

  await runTest('detectSignal calculates Price Momentum (%Change >= 3.0 and relVol < 2.0)', () => {
    const stock = {
      ticker: 'AMD',
      price: 104.5,
      prevClose: 100.0, // +4.5% change
      volume: 12000000,
      avgVolume: 10000000 // 1.2x relative volume
    };

    const res = detectSignal(stock);
    assert.deepEqual(res, {
      ticker: 'AMD',
      price: 104.5,
      change_pct: 4.5,
      rel_vol: 1.2,
      signal: 'Price Momentum'
    });
  });

  await runTest('detectSignal returns null signal when neither threshold is met', () => {
    const stock = {
      ticker: 'AAPL',
      price: 101.0,
      prevClose: 100.0, // +1.0%
      volume: 11000000,
      avgVolume: 10000000 // 1.1x
    };

    const res = detectSignal(stock);
    assert.deepEqual(res, {
      ticker: 'AAPL',
      price: 101.0,
      change_pct: 1.0,
      rel_vol: 1.1,
      signal: null
    });
  });

  await runTest('detectSignal handles edge cases (missing values, zero denominator, empty)', () => {
    const edgeStock = {
      ticker: 'TEST',
      price: 50.0,
      prevClose: 0, // division by zero guarded
      volume: 100,
      avgVolume: null
    };

    const res = detectSignal(edgeStock);
    assert.equal(res.ticker, 'TEST');
    assert.equal(res.price, 50.0);
    assert.equal(res.change_pct, null);
    assert.equal(res.rel_vol, null);
    assert.equal(res.signal, null);

    const emptyRes = detectSignal(null);
    assert.equal(emptyRes.signal, null);
  });

  await runTest('detectSignal supports batch array of stocks', () => {
    const stocks = [
      { ticker: 'S1', price: 105, prevClose: 100, volume: 200, avgVolume: 100 }, // High Buying Interest
      { ticker: 'S2', price: 100, prevClose: 100, volume: 200, avgVolume: 100 }, // Unusual Volume
      { ticker: 'S3', price: 105, prevClose: 100, volume: 100, avgVolume: 100 }  // Price Momentum
    ];

    const results = detectSignal(stocks);
    assert.equal(results.length, 3);
    assert.equal(results[0].signal, 'High Buying Interest');
    assert.equal(results[1].signal, 'Unusual Volume');
    assert.equal(results[2].signal, 'Price Momentum');
  });

  // 6. Test Reading and Merging Screener JSON with Signals
  console.log('\n--- Unit Tests: Screener JSON Reading & Signal Merging ---');

  await runTest('loadScreenedSignals reads screened_stocks.json and merges signals', async () => {
    const results = await loadScreenedSignals('screened_stocks.json');
    assert.ok(Array.isArray(results), 'Must return an array');
    assert.equal(results.length, 10, 'Must load 10 screened stocks');

    for (const item of results) {
      assert.ok('ticker' in item);
      assert.ok('company' in item);
      assert.ok('sector' in item);
      assert.ok('industry' in item);
      assert.ok('price' in item);
      assert.ok('prevClose' in item);
      assert.ok('volume' in item);
      assert.ok('avgVolume' in item);
      assert.ok('change_pct' in item);
      assert.ok('rel_vol' in item);
      assert.ok('signal' in item);

      // Verify filter constraints: rel_vol > 2 and volume > 1,000,000
      assert.ok(item.rel_vol > 2.0, `rel_vol for ${item.ticker} must be > 2`);
      assert.ok(item.volume > 1000000, `volume for ${item.ticker} must be > 1,000,000`);
    }

    // Check specific signal matches: ABTC (+14.38%, rel_vol 2.95) -> High Buying Interest
    const abtc = results.find(r => r.ticker === 'ABTC');
    assert.ok(abtc, 'ABTC must exist in screened list');
    assert.equal(abtc.signal, 'High Buying Interest');

    // Check unusual volume matches: AA (-5.41%, rel_vol 2.05) -> Unusual Volume
    const aa = results.find(r => r.ticker === 'AA');
    assert.ok(aa, 'AA must exist in screened list');
    assert.equal(aa.signal, 'Unusual Volume');
  });

  await runTest('mergeScreenedSignals handles in-memory screened array input', async () => {
    const mockScreened = [
      {
        ticker: 'MOCK1',
        company: 'Mock One',
        price: 110.0,
        prevClose: 100.0, // +10%
        volume: 3000000,
        avgVolume: 1000000 // 3.0x
      }
    ];

    const merged = await mergeScreenedSignals(mockScreened);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].ticker, 'MOCK1');
    assert.equal(merged[0].change_pct, 10.0);
    assert.equal(merged[0].rel_vol, 3.0);
    assert.equal(merged[0].signal, 'High Buying Interest');
  });

  console.log('\n=======================================================');
  console.log(`  Tests finished: ${passedTests}/${totalTests} passed`);
  console.log('=======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

suite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
