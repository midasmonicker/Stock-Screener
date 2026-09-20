const { fetchMarketData } = require('./dataService');

// Example: a simple signal generator using Finviz JSON or placeholder logic
function generateSignal(stock) {
  // Placeholder logic: you can replace with Finviz or other provider data
  if (stock.price > stock.open) {
    return 'Bullish';
  } else if (stock.price < stock.open) {
    return 'Bearish';
  }
  return 'Neutral';
}

async function getSignals(tickers) {
  // Fetch live market data
  const marketData = await fetchMarketData(tickers);

  // Merge with signals
  return marketData.map(stock => ({
    ...stock,
    signal: generateSignal(stock)
  }));
}

module.exports = { getSignals };

