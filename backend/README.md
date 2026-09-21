# Market Data Service (`dataService.js`)

A resilient, multi-tiered Node.js stock market data service that integrates multiple market data providers with automatic failover, field-level enrichment, and screening metrics extraction.

---

## Failover Hierarchy
Requests cascade through providers in the following strict order:

1. **Alpaca**: Tried first for real-time US quotes. If it fails or is not configured...
2. **Finnhub**: Tried if Alpaca fails. If it fails or is not configured...
3. **Financial Modeling Prep (FMP)**: Tried if Finnhub fails. If it fails or is not configured...
4. **Polygon.io (Free Tier)**: Tried if FMP fails for delayed OHLCV.
5. **Finviz (`finvizfinance`)**: Screening metrics layer extracting `avgVolume` and fallback metrics.

### Source Logging
`fetchMarketData` logs the exact source used for each ticker to the console:
```
[dataService] AAPL: Source used -> Alpaca
[dataService] MSFT: Source used -> Finnhub
[dataService] NVDA: Source used -> FMP
[dataService] GOOGL: Source used -> Polygon
```

---

## Output Format

The service exports `fetchMarketData(tickers)` which returns an array of stock objects matching the specification:

```javascript
[
  {
    ticker: "AAPL",
    price: 336.13,
    prevClose: 337.0,
    volume: 86588203,
    avgVolume: 53430000
  },
  {
    ticker: "MSFT",
    price: 493.78,
    prevClose: 497.75,
    volume: 39622288,
    avgVolume: 34400000
  }
]
```

---

## Quick Start

### 1. Installation & Environment

Prerequisites:
- **Node.js**: v18+ (Node 22 installed)
- **Python**: 3.10+ with `finvizfinance` (configured in `.venv`)

To configure API keys, copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
# Primary Tier (Alpaca or Finnhub)
ALPACA_API_KEY_ID=your_alpaca_key_id
ALPACA_API_SECRET_KEY=your_alpaca_secret_key
FINNHUB_API_KEY=your_finnhub_key

# Backup Tier (FMP or EODHD)
FMP_API_KEY=your_fmp_key
EODHD_API_KEY=your_eodhd_key

# Fallback Tier (Polygon)
POLYGON_API_KEY=your_polygon_key
```

*Note: If any API key is missing or omitted, the service gracefully cascades to the next tier.*

---

### 2. Usage in Code

```javascript
const { fetchMarketData, detectSignal } = require('./dataService');

async function main() {
  const stocks = await fetchMarketData(['AAPL', 'MSFT', 'NVDA']);
  console.log('Market Data:', stocks);

  // Detect trading signals
  const signals = detectSignal(stocks);
  console.log('Signals:', signals);
}

main();
```

### Signal Detection Rules
The exported `detectSignal(stock)` evaluates:
- **Relative Volume** (`rel_vol`) = `currentVolume / avgVolume`
- **% Change** (`change_pct`) = `(price - prevClose) / prevClose * 100`

| Condition | Output Signal |
|---|---|
| `relVol >= 2.0` AND `%Change >= 3.0` | `"High Buying Interest"` |
| `relVol >= 2.0` | `"Unusual Volume"` |
| `%Change >= 3.0` | `"Price Momentum"` |
| Neither threshold met | `null` |

Returns a JSON object:
```json
{
  "ticker": "NVDA",
  "price": 105.00,
  "change_pct": 5.00,
  "rel_vol": 2.50,
  "signal": "High Buying Interest"
}
```

---

## Stock Screening (`finviz_screener.py`)

A dedicated Python script screens for stocks matching:
- **Relative Volume > 2**
- **Current Volume > 1,000,000**

### Running the Screener
```bash
python finviz_screener.py --output screened_stocks.json --limit 50
```

### Merging Screener JSON with Signals in Node.js
`dataService.js` provides `loadScreenedSignals(jsonPath)` to read the screener results and merge them with signal analysis:

```javascript
const { loadScreenedSignals } = require('./dataService');

async function main() {
  // Read screened_stocks.json and evaluate trading signals
  const screenedSignals = await loadScreenedSignals('screened_stocks.json');

  console.log('Screened Stocks with Signals:', screenedSignals);
}

main();
```

Output item format:
```json
{
  "ticker": "ABTC",
  "company": "American Bitcoin Corp",
  "sector": "Financial",
  "industry": "Capital Markets",
  "price": 10.10,
  "prevClose": 8.83,
  "volume": 4948163,
  "avgVolume": 1680000,
  "change_pct": 14.38,
  "rel_vol": 2.95,
  "signal": "High Buying Interest"
}
```

---

### 3. Running Automated Tests

```bash
node test/dataService.test.js
```

---

## Architecture & Project Structure

- **`dataService.js`**: Main orchestrator exporting `fetchMarketData(tickers)`. Implements the 4-tier cascading failover and field-level normalization.
- **`finviz_wrapper.py`**: Python CLI script utilizing `finvizfinance.quote.finvizfinance` to fetch screening fundamentals and convert human-readable metrics (e.g., `"53.43M"`) into numeric values.
- **`providers/`**:
  - `alpaca.js`: Alpaca Market Data v2 snapshot client.
  - `finnhub.js`: Finnhub `/quote` real-time client.
  - `fmp.js`: Financial Modeling Prep `/quote` client.
  - `eodhd.js`: EODHD real-time client.
  - `finviz.js`: Subprocess caller for `finviz_wrapper.py`.
  - `polygon.js`: Polygon.io free tier `/snapshot` and `/prev` aggregate client.
  - `utils.js`: Safe fetch with timeout, number parsing, and `.env` loader.
- **`test/dataService.test.js`**: Test suite with unit tests, schema assertions, and live end-to-end integration tests.
