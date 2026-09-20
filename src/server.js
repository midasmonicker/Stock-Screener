// src/server.js
const express = require('express');
const { getSignals } = require('./services/signalService');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/api/signals', async (req, res) => {
  const tickers = (req.query.tickers || '').split(',').filter(Boolean);
  try {
    const signals = await getSignals(tickers);
    res.json(signals);
  } catch (err) {
    console.error('Error fetching signals:', err.message);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
