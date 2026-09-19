#!/usr/bin/env python3
"""
finviz_screener.py
Screens for stocks using finvizfinance matching:
- Relative Volume > 2 ('Relative Volume': 'Over 2')
- Current Volume > 1,000,000 ('Current Volume': 'Over 1M')

Outputs results as a formatted JSON file.
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional

def parse_percentage(val: Any) -> Optional[float]:
    """Parses percentage string like '3.45%' or '-0.50%' to float 3.45 or -0.50."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace('%', '').replace(',', '')
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return None

def parse_numeric(val: Any) -> Optional[float]:
    """Parses numeric value safely."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(',', '').replace('$', '')
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return None

def run_screener(output_file: str = "screened_stocks.json", limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Executes the finvizfinance screener with Relative Volume > 2 and Current Volume > 1M.
    Saves and returns the normalized list of stock objects.
    """
    from finvizfinance.screener.custom import Custom

    print(f"[finviz_screener] Initializing Finviz screener (RelVol > 2, Volume > 1M)...")
    screener = Custom()

    # Apply strict screener filters requested:
    # Relative Volume > 2 -> 'Over 2'
    # Current Volume > 1,000,000 -> 'Over 1M'
    filters = {
        'Relative Volume': 'Over 2',
        'Current Volume': 'Over 1M'
    }
    screener.set_filter(filters_dict=filters)

    # Custom column indices:
    # 1: Ticker, 2: Company, 3: Sector, 4: Industry
    # 65: Price, 66: Change, 67: Volume, 63: Average Volume, 64: Relative Volume
    columns = [1, 2, 3, 4, 65, 66, 67, 63, 64]

    print(f"[finviz_screener] Fetching screener results from Finviz...")
    df = screener.screener_view(columns=columns, limit=limit)

    if df is None or df.empty:
        print("[finviz_screener] No stocks found matching criteria.")
        records = []
    else:
        records = []
        raw_list = df.to_dict(orient='records')

        for row in raw_list:
            ticker = str(row.get('Ticker', '')).strip().upper()
            if not ticker:
                continue

            price = parse_numeric(row.get('Price'))
            change_pct = parse_percentage(row.get('Change %') or row.get('Change'))
            volume = parse_numeric(row.get('Volume'))
            avg_volume = parse_numeric(row.get('Avg Volume') or row.get('Average Volume'))
            rel_vol = parse_numeric(row.get('Rel Volume') or row.get('Relative Volume'))

            # Compute previous close if price and change percentage are available
            prev_close = None
            if price is not None and change_pct is not None:
                # change_pct = (price - prev_close) / prev_close * 100
                # prev_close = price / (1 + change_pct / 100)
                denominator = 1.0 + (change_pct / 100.0)
                if denominator != 0:
                    prev_close = round(price / denominator, 2)

            records.append({
                "ticker": ticker,
                "company": row.get('Company', ''),
                "sector": row.get('Sector', ''),
                "industry": row.get('Industry', ''),
                "price": price,
                "prevClose": prev_close,
                "change_pct": change_pct,
                "volume": int(volume) if volume is not None else None,
                "avgVolume": int(avg_volume) if avg_volume is not None else None,
                "relVolume": rel_vol
            })

    output_path = os.path.abspath(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2)

    print(f"[finviz_screener] Successfully screened {len(records)} stocks. Saved to: {output_path}")
    return records

def main():
    parser = argparse.ArgumentParser(description="Screen stocks with finvizfinance (RelVol > 2, Volume > 1M)")
    parser.add_argument("--output", type=str, default="screened_stocks.json", help="Path to output JSON file (default: screened_stocks.json)")
    parser.add_argument("--limit", type=int, default=None, help="Max number of stocks to retrieve (optional)")
    args = parser.parse_args()

    try:
        run_screener(output_file=args.output, limit=args.limit)
    except Exception as err:
        print(f"[finviz_screener] Error during screening: {err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
