// src/services/signalService.js
const { fetchMarketData } = require('./dataService');

async function getSignals(tickers) {
  const data = await fetchMarketData(tickers);
  return data.map(d => ({
    ...d,
    signal: null // placeholder until Finviz integration
  }));
}

module.exports = { getSignals };

