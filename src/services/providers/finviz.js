/**
 * providers/finviz.js
 * Screening metrics provider: calls finviz_wrapper.py via Python subprocess.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const { findPythonExecutable } = require('./utils');

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', '..', 'finviz_wrapper.py');
const ROOT_CWD = path.resolve(__dirname, '..', '..', '..');

/**
 * Invokes the finviz_wrapper.py Python script to fetch screening metrics.
 * @param {string[]} tickers - Array of ticker strings.
 * @param {object} [options] - Options (timeoutMs, pythonPath, etc.)
 * @returns {Promise<Record<string, { ticker: string, price: number|null, prevClose: number|null, volume: number|null, avgVolume: number|null }>>}
 */
async function fetchFinvizMetrics(tickers, options = {}) {
  if (!tickers || tickers.length === 0) return {};

  const cleanTickers = tickers.map(t => t.toUpperCase());
  const pythonBin = options.pythonPath || findPythonExecutable();
  const timeoutMs = options.timeoutMs || 30000;

  return new Promise((resolve) => {
    const args = [SCRIPT_PATH, '--tickers', cleanTickers.join(',')];
    let stdoutData = '';
    let stderrData = '';

    const proc = spawn(pythonBin, args, {
      cwd: ROOT_CWD,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch (e) {}
      resolve({});
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({});
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Return whatever partial data might have been printed, or empty object
        try {
          const parsed = JSON.parse(stdoutData);
          if (parsed && parsed.data) {
            return resolve(normalizeFinvizData(parsed.data));
          }
        } catch (e) {}
        return resolve({});
      }

      try {
        const parsed = JSON.parse(stdoutData);
        if (parsed && parsed.data) {
          return resolve(normalizeFinvizData(parsed.data));
        }
        return resolve({});
      } catch (err) {
        return resolve({});
      }
    });
  });
}

function normalizeFinvizData(dataMap) {
  const normalized = {};
  for (const [sym, item] of Object.entries(dataMap)) {
    if (!item) continue;
    normalized[sym.toUpperCase()] = {
      ticker: sym.toUpperCase(),
      price: item.price ?? null,
      prevClose: item.prevClose ?? null,
      volume: item.volume ?? null,
      avgVolume: item.avgVolume ?? null,
      marketCap: item.marketCap ?? null,
      pe: item.pe ?? null,
      source: 'finviz'
    };
  }
  return normalized;
}

module.exports = {
  fetchFinvizMetrics
};
