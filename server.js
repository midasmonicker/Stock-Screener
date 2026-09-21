const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Send updates periodically (replace with real stock data logic)
  setInterval(() => {
    const updatedData = [
      { ticker: "AAPL", price: 150, changePercent: 1.2 },
      { ticker: "MSFT", price: 300, changePercent: -0.5 },
    ];
    ws.send(JSON.stringify(updatedData));
  }, 5000); // every 5 seconds
});

