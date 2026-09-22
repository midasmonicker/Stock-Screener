import { useEffect } from "react";

export default function StockStream({ setStocks }) {
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws");
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      console.log("Connected to WebSocket");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStocks((prevStocks) => {
	const updatedMap = new Map(prevStocks.map(s => [s.ticker, s]));

	data.forEach((newStock) => {
	  updatedMap.set(newStock.ticker, { ...updatedMap.get(newStock.ticker), ...newStock });
    	});

    	return Array.from(updatedMap.values());
      });
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => socket.close();
  }, [setStocks]);

  return <p>🔌 Live updates connected</p>;
}

