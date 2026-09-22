const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

// Restrict CORS to your frontend domain
app.use(cors({
  origin: "https://stock-screener-sepia.vercel.app/"
}));

app.get("/stocks", (req, res) => {
  const data = [
    { ticker: "AAPL", price: 150, changePercent: 1.2 },
    { ticker: "MSFT", price: 300, changePercent: -0.5 },
    { ticker: "GOOG", price: 2800, changePercent: 0.8 }
  ];
  res.json(data);
});

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  const symbols = ["AAPL", "MSFT", "GOOG"];

  const sendData = async () => {
    try {
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
      ws.send(JSON.stringify(results));
    } catch (err) {
      console.error("Error fetching live data:", err);
    }
  };

  // Send immediately and every 5 seconds
  sendData();
  const interval = setInterval(sendData, 5000);

  ws.on("close", () => clearInterval(interval));
});

