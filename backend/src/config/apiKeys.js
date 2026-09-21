/**
 * src/config/apiKeys.js
 * Centralized API keys configuration file.
 * Reads from environment variables if present, otherwise provides fallback placeholders.
 */

const { loadEnv } = require('../services/providers/utils');

// Attempt to load .env if available
loadEnv();

module.exports = {
  alpaca: {
    apiKeyId: process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID || '',
    secretKey: process.env.ALPACA_API_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '',
    dataUrl: process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets'
  },
  finnhub: {
    apiKey: process.env.FINNHUB_API_KEY || ''
  },
  fmp: {
    apiKey: process.env.FMP_API_KEY || ''
  },
  eodhd: {
    apiToken: process.env.EODHD_API_TOKEN || ''
  },
  polygon: {
    apiKey: process.env.POLYGON_API_KEY || ''
  }
};
