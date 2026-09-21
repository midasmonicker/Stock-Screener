const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = 3001;

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

const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("Client connected");
  setInterval(() => {
    const updatedData = [
      { ticker: "AAPL", price: 150, changePercent: 1.2 },
      { ticker: "MSFT", price: 300, changePercent: -0.5 },
      { ticker: "GOOG", price: 2800, changePercent: 0.8 }
    ];
    ws.send(JSON.stringify(updatedData));
  }, 5000);
});

