import { useEffect, useState } from "react";
import SearchBar from "../components/SearchBar";
import { Line, Bar } from "react-chartjs-2";
import StockStream from "../components/StockStream";

export default function Home() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [visibleCount, setVisibleCount] = useState(20);
  const [showTopButton, setShowTopButton] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [chartView, setChartView] = useState(false);

  // Auto-refresh toggle
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleSearch = (query) => {
  if (!query) {
    // If query is empty, reload all stocks
    loadAllStocks();
    return;
  }

  // Filter stocks by ticker symbol
  const filtered = stocks.filter((s) =>
    s.ticker.toLowerCase().includes(query.toLowerCase())
  );
  setStocks(filtered);
  };

  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

  const loadAllStocks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stocks`);
      const data = await response.json();
      setStocks(data);
    } catch (err) {
      console.error("Failed to fetch stocks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllStocks();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAllStocks();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // ... (sorting, filters, chartData, etc. same as before)

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: darkMode ? "#121212" : "#ffffff",
        color: darkMode ? "#e0e0e0" : "#000000",
        minHeight: "100vh",
      }}
    >
      <h1>📈 Stock Screener</h1>
      <SearchBar onSearch={handleSearch} />
      <StockStream setStocks={setStocks} />

      {/* Auto-refresh toggle */}
      <button
        onClick={() => setAutoRefresh(!autoRefresh)}
        style={{
          marginBottom: "1rem",
          padding: "8px 12px",
          backgroundColor: autoRefresh ? "#28a745" : "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {autoRefresh ? "🔄 Auto-Refresh ON" : "⏸️ Auto-Refresh OFF"}
      </button>

      {/* Chart toggle */}
      <button
        onClick={() => setChartView(!chartView)}
        style={{
          marginBottom: "1rem",
          marginLeft: "1rem",
          padding: "8px 12px",
          backgroundColor: "#ff9800",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {chartView ? "📊 Show Table" : "📉 Show Chart"}
      </button>

      {loading ? (
        <p>Loading...</p>
      ) : chartView ? (
        <div style={{ backgroundColor: darkMode ? "#1e1e1e" : "#f9f9f9", padding: "1rem", borderRadius: "8px" }}>
          <Line data={chartData} />
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", minWidth: "1000px" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Ticker</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Price</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Change %</th>
            </tr>
          </thead>
          <tbody>
            {stocks.slice(0, visibleCount).map((s) => (
              <tr key={s.ticker}>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{s.ticker}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>${s.price}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{s.changePercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

