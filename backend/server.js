const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

// Restrict CORS to your frontend domain
app.use(cors({
  origin: "https://stock-screener-sepia.vercel.app"
}));

const symbols = ["AAPL", "MSFT", "GOOG"];

// Helper function to fetch live quotes
async function fetchQuotes() {
  const results = [];
  for (const symbol of symbols) {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
    );
    const data = await response.json();
    results.push({
      ticker: symbol,
      price: data.c,
      changePercent: data.dp,
    });
  }
  return results;
}

// REST endpoint
app.get("/stocks", async (req, res) => {
  try {
    const data = await fetchQuotes();
    res.json(data);
  } catch (err) {
    console.error("Error fetching stocks:", err);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Attach WebSocket to the same server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  const sendData = async () => {
    try {
      const data = await fetchQuotes();
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error("Error sending live data:", err);
    }
  };

  // Send immediately and every 5 seconds
  sendData();
  const interval = setInterval(sendData, 5000);

  ws.on("close", () => clearInterval(interval));
});

