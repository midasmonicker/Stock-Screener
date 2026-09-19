/**
 * providers/utils.js
 * Utility helpers for HTTP requests, numbers parsing, env loading, and python execution.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Loads simple KEY=VALUE pairs from a .env file into process.env if present.
 * Does not overwrite existing environment variables.
 */
function loadEnv(filePath) {
  const envPath = filePath || path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    // Non-fatal if .env cannot be read
  }
}

// Automatically attempt to load .env on import
loadEnv();

/**
 * Safely parses any value to a number. Returns null if invalid or NaN.
 */
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parses numeric strings with optional suffixes (K, M, B, T).
 * E.g., '53.43M' -> 53430000, '1.2B' -> 1200000000
 */
function parseSuffixedNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;

  const cleaned = String(val).trim().replace(/[,%$]/g, '');
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;

  let multiplier = 1;
  let numStr = cleaned;
  const lastChar = cleaned.slice(-1).toUpperCase();

  if (lastChar === 'K') {
    multiplier = 1e3;
    numStr = cleaned.slice(0, -1);
  } else if (lastChar === 'M') {
    multiplier = 1e6;
    numStr = cleaned.slice(0, -1);
  } else if (lastChar === 'B') {
    multiplier = 1e9;
    numStr = cleaned.slice(0, -1);
  } else if (lastChar === 'T') {
    multiplier = 1e12;
    numStr = cleaned.slice(0, -1);
  }

  const parsed = Number(numStr);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

/**
 * Performs an HTTP JSON request using axios with timeout and standard headers.
 */
async function safeFetchJson(url, options = {}, timeoutMs = 8000) {
  let axios;
  try {
    axios = require('axios');
  } catch (e) {
    axios = null;
  }

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'AntigravityMarketDataService/1.0',
    ...(options.headers || {})
  };

  if (axios) {
    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.body,
        timeout: timeoutMs,
        validateStatus: (status) => status >= 200 && status < 300
      });
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const errorText = typeof err.response?.data === 'string' ? err.response.data : JSON.stringify(err.response?.data || '');
      const error = new Error(`HTTP ${status || 'ERR'} ${err.message} from ${url}`);
      error.status = status;
      error.responseBody = errorText;
      throw error;
    }
  }

  // Fallback to native fetch if axios is unavailable
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const err = new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
      err.status = response.status;
      err.responseBody = errorText;
      throw err;
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Finds suitable python executable to run finviz_wrapper.py.
 * Checks:
 * 1. process.env.PYTHON_PATH
 * 2. .venv/Scripts/python.exe (Windows) or .venv/bin/python (Unix)
 * 3. System 'python' or 'py'
 */
function findPythonExecutable() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  const localVenvWin = path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(localVenvWin)) return localVenvWin;

  const localVenvNix = path.resolve(process.cwd(), '.venv', 'bin', 'python');
  if (fs.existsSync(localVenvNix)) return localVenvNix;

  return 'python';
}

module.exports = {
  loadEnv,
  parseNumber,
  parseSuffixedNumber,
  safeFetchJson,
  findPythonExecutable
};
