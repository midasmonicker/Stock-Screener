# Working.md — Stock Data Pipeline Progress Log

**Last Updated:** 2026-09-19T23:40

---

## 🎯 Project Goal

Build a full stock data pipeline as specified:

> **Part 1 (Node.js):** A `dataService.js` service that fetches and normalises stock data via failover-chained APIs, reads API keys from a config file, uses `axios`, and lives at `src/services/dataService.js`.
>
> **Part 2 (Python):** A `finviz_screen.py` screener using `finvizfinance` that filters stocks (RelVol > 2, Volume > 1M), exports results to `finviz_signals.json` with `signal type` per record.
>
> **Part 3 (Integration):** `dataService.js` reads `finviz_signals.json` and merges Finviz screening metrics into the final `fetchMarketData` output.

---

## ✅ What Has Been Built

### Part 1 — Node.js Data Service

| Status | Deliverable | Location |
|--------|------------|----------|
| ✅ Done | Core service (`fetchMarketData`) | [`dataService.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/dataService.js) |
| ✅ Done | Alpaca provider | [`providers/alpaca.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/alpaca.js) |
| ✅ Done | Finnhub provider | [`providers/finnhub.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/finnhub.js) |
| ✅ Done | FMP provider | [`providers/fmp.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/fmp.js) |
| ✅ Done | EODHD provider | [`providers/eodhd.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/eodhd.js) |
| ✅ Done | Polygon provider | [`providers/polygon.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/polygon.js) |
| ✅ Done | Finviz subprocess caller | [`providers/finviz.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/finviz.js) |
| ✅ Done | Shared utilities | [`providers/utils.js`](file:///c:/Users/MidasMonicker/Documents/Antigravity/providers/utils.js) |
| ✅ Done | Failover chain (Alpaca → Finnhub → FMP → Polygon) | `dataService.js` |
| ✅ Done | Per-ticker source logging | `dataService.js` |
| ✅ Done | `detectSignal()` export | `dataService.js` |
| ✅ Done | `loadScreenedSignals()` / `mergeScreenedSignals()` | `dataService.js` |
| ⚠️ Pending | Move to `src/services/dataService.js` | Not yet restructured |
| ⚠️ Pending | `src/config/apiKeys.js` file (placeholder API keys) | Not yet created |
| ❌ Blocked | Use `axios` for HTTP requests (currently uses native `fetch`) | `npm install` is broken due to a Node.js symlink bug (NVM `C:\Users\DELL` path inaccessible) |

**Failover order (implemented):**
```
Alpaca → Finnhub → FMP / EODHD → Polygon → Finviz (screening enrichment)
```

**Output shape per ticker (working live):**
```json
{ "ticker": "AAPL", "price": 336.13, "prevClose": 337.00, "volume": 86588203, "avgVolume": 53430000 }
```

---

### Part 2 — Python Finviz Screener

| Status | Deliverable | Location |
|--------|------------|----------|
| ✅ Done | Screener script | [`finviz_screener.py`](file:///c:/Users/MidasMonicker/Documents/Antigravity/finviz_screener.py) |
| ✅ Done | Filters: RelVol > 2 AND Volume > 1M | Applied via `finvizfinance.screener.custom` |
| ✅ Done | Exports Pandas DataFrame to JSON | [`screened_stocks.json`](file:///c:/Users/MidasMonicker/Documents/Antigravity/screened_stocks.json) |
| ✅ Done | Each record: `ticker, price, prevClose, change_pct, volume, avgVolume, relVolume` | Working live output |
| ⚠️ Pending | Rename to `finviz_screen.py` (spec calls it this) | Currently named `finviz_screener.py` |
| ⚠️ Pending | Add explicit `signal` field to each JSON record | Currently, `signal` is computed in Node.js; spec wants it in the Python output too |
| ⚠️ Pending | Rename output file to `finviz_signals.json` | Currently `screened_stocks.json` |

**Example live screened output** (from `screened_stocks.json`):
```json
{
  "ticker": "ABTC",
  "company": "American Bitcoin Corp",
  "price": 10.10,
  "prevClose": 8.83,
  "change_pct": 14.38,
  "volume": 4948163,
  "avgVolume": 1680000,
  "relVolume": 2.94
}
```

---

### Part 3 — Integration

| Status | Deliverable |
|--------|------------|
| ✅ Done | `loadScreenedSignals(jsonPath)` reads screener JSON into Node.js |
| ✅ Done | Merges Finviz screening metrics into fetchMarketData output |
| ✅ Done | Applies `detectSignal()` rules to each screened stock |
| ✅ Done | Final output contains: `ticker, price, prevClose, volume, avgVolume, change_pct, rel_vol, signal` |
| ⚠️ Pending | Update file path to read `finviz_signals.json` (once renamed) |

**Example merged output:**
```json
{
  "ticker": "ABTC",
  "company": "American Bitcoin Corp",
  "price": 10.10, "prevClose": 8.83,
  "volume": 4948163, "avgVolume": 1680000,
  "change_pct": 14.38, "rel_vol": 2.95,
  "signal": "High Buying Interest"
}
```

---

## 🚧 Remaining Work (To Match Spec Exactly)

### Critical Path

1. **`npm` is broken due to NVM symlink from `C:\Users\DELL`** — npm resolves its own path via a symlink that points to an inaccessible user profile. This blocks `npm install axios`. Workaround options:
   - Fix the Node.js installation (reinstall to a path that doesn't reference `C:\Users\DELL`).
   - Manually install `axios` and its dependencies (`form-data`, `proxy-from-env`, `follow-redirects`) by downloading and extracting their tarballs from the npm registry.
   - Replace `axios` with the native `fetch` API already in use and document the decision (Node 22 has full `fetch` support; axios adds no functional benefit here).

2. **Restructure files to match spec layout:**
   ```
   src/
     services/
       dataService.js        ← move from root
     config/
       apiKeys.js            ← create with placeholder keys
   finviz_screen.py          ← rename from finviz_screener.py
   finviz_signals.json       ← rename from screened_stocks.json
   ```

3. **Add `signal` computation to Python screener output** — `finviz_screen.py` should compute and include `signal_type` (`"High Buying Interest"`, `"Unusual Volume"`, `"Price Momentum"`, or `null`) directly in each JSON record.

4. **Wire `apiKeys.js` into providers** — Replace `process.env.*` reads in each provider with `require('../config/apiKeys')`.

---

## 🐛 Known Issues / Blockers

| Issue | Impact | Root Cause | Fix |
|-------|--------|-----------|-----|
| `npm install` fails | Cannot install `axios` | Node.js was originally installed via NVM for user `DELL`, and `C:\Program Files\nodejs` is a symlink to `C:\Users\DELL\AppData\Roaming\nvm\v22.3.0` which is inaccessible | Reinstall Node.js standalone, or manually install axios deps |
| `python` not on PATH | Python must be invoked as `.venv\Scripts\python.exe` | No system Python installed; `uv` manages a portable Python 3.12 in `.venv` | Already handled in `providers/utils.js` `findPythonExecutable()` |

---

## 📁 Current File Structure

```
c:\Users\MidasMonicker\Documents\Antigravity\
├── dataService.js              ← Main service (needs to move to src/services/)
├── finviz_screener.py          ← Screener (needs rename to finviz_screen.py)
├── finviz_wrapper.py           ← Quote enrichment subprocess
├── screened_stocks.json        ← Screener output (needs rename to finviz_signals.json)
├── .env.example                ← API key template
├── package.json
├── README.md
├── .venv/                      ← Python 3.12 venv (finvizfinance installed)
├── node_modules/
│   └── axios/                  ← Manually extracted (missing dependencies)
├── providers/
│   ├── alpaca.js
│   ├── eodhd.js
│   ├── finviz.js
│   ├── finnhub.js
│   ├── fmp.js
│   ├── polygon.js
│   └── utils.js
└── test/
    └── dataService.test.js     ← 19/19 tests passing
```

---

## ✅ Test Results (Latest Run)

```
Tests finished: 19/19 passed
```

Covers: utils, input validation, failover chain (all 4 steps), live Finviz integration, `detectSignal` rules (all 3 signals + edge cases), screener JSON reading and signal merging.

---

## 📋 Next Steps (Ordered)

- [x] **Resolve `npm` / axios blocker** — Downloaded and extracted missing dependencies (`form-data`, `follow-redirects`, `proxy-from-env`, `asynckit`, `combined-stream`, `delayed-stream`, `mime-types`, `mime-db`). `axios` now loads and operates successfully.
- [x] Restructure into `src/services/` and `src/config/` layout (`src/services/dataService.js`, `src/services/providers/*`).
- [x] Create `src/config/apiKeys.js` with centralized API key configuration and environment variable fallbacks.
- [x] Wire `apiKeys.js` into all providers (`alpaca.js`, `finnhub.js`, `fmp.js`, `eodhd.js`, `polygon.js`).
- [x] Wire `axios` into `safeFetchJson` in `utils.js` (with fallback to native `fetch`).
- [x] Create `finviz_screen.py` with `signal_type` computation per record.
- [x] Output and rename screener target to `finviz_signals.json` (while retaining `screened_stocks.json` sync for compatibility).
- [x] Re-run full 19-test suite after restructure — all 19 tests passing.
