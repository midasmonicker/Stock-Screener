import { useEffect, useState } from "react";

export default function Home() {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    async function loadData() {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stocks`);
      const data = await response.json();
      setStocks(data);
    }
    loadData();
  }, []);

  return (
    <div>
      <h1>Stock Screener</h1>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Price</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.ticker}>
              <td>{s.ticker}</td>
              <td>{s.price}</td>
              <td>{s.signal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

