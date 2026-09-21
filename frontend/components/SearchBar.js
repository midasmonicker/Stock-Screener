import { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query.trim().toUpperCase());
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (value === "") {
            // If input is cleared, reload all stocks
            onSearch("");
          }
        }}
        placeholder="Enter ticker (e.g. AAPL)"
        style={{ padding: "8px", marginRight: "8px" }}
      />
      <button type="submit">Search</button>
    </form>
  );
}

