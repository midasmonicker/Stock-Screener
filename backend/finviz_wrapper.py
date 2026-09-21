#!/usr/bin/env python3
"""
finviz_wrapper.py
Screening and fundamental metrics extraction using finvizfinance.
Outputs JSON to stdout for Node.js consumption.
"""

import sys
import json
import argparse
import re
from typing import Dict, Any, Optional

def parse_suffixed_number(val: Any) -> Optional[float]:
    """
    Parses numeric strings with suffixes like K, M, B, T and commas.
    Example: '53.43M' -> 53430000.0, '86,588,203' -> 86588203.0
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    
    val_str = str(val).strip().replace(',', '').replace('$', '').replace('%', '')
    if not val_str or val_str == '-' or val_str.lower() == 'n/a':
        return None

    multiplier = 1.0
    upper = val_str.upper()
    if upper.endswith('K'):
        multiplier = 1e3
        val_str = val_str[:-1]
    elif upper.endswith('M'):
        multiplier = 1e6
        val_str = val_str[:-1]
    elif upper.endswith('B'):
        multiplier = 1e9
        val_str = val_str[:-1]
    elif upper.endswith('T'):
        multiplier = 1e12
        val_str = val_str[:-1]

    try:
        return float(val_str) * multiplier
    except (ValueError, TypeError):
        return None

def fetch_ticker_data(ticker: str) -> Dict[str, Any]:
    """
    Fetches fundamental and screening metrics for a given ticker via finvizfinance.
    """
    from finvizfinance.quote import finvizfinance
    stock = finvizfinance(ticker.upper())
    fundament = stock.ticker_fundament()

    price = parse_suffixed_number(fundament.get('Price'))
    prev_close = parse_suffixed_number(fundament.get('Prev Close'))
    volume = parse_suffixed_number(fundament.get('Volume'))
    avg_volume = parse_suffixed_number(fundament.get('Avg Volume'))
    market_cap = parse_suffixed_number(fundament.get('Market Cap'))
    pe = parse_suffixed_number(fundament.get('P/E'))
    shs_outstand = parse_suffixed_number(fundament.get('Shs Outstand'))

    return {
        "ticker": ticker.upper(),
        "price": price,
        "prevClose": prev_close,
        "volume": int(volume) if volume is not None else None,
        "avgVolume": int(avg_volume) if avg_volume is not None else None,
        "marketCap": market_cap,
        "pe": pe,
        "sharesOutstanding": shs_outstand,
        "raw": {
            "Price": fundament.get('Price'),
            "Prev Close": fundament.get('Prev Close'),
            "Volume": fundament.get('Volume'),
            "Avg Volume": fundament.get('Avg Volume'),
            "P/E": fundament.get('P/E'),
            "Market Cap": fundament.get('Market Cap')
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Fetch Finviz metrics using finvizfinance")
    parser.add_argument("--tickers", type=str, help="Comma-separated list of stock tickers (e.g. AAPL,MSFT)")
    parser.add_argument("--stdin", action="store_true", help="Read JSON array of tickers from standard input")

    args = parser.parse_args()
    tickers = []

    if args.stdin:
        try:
            stdin_content = sys.stdin.read().strip()
            if stdin_content:
                parsed = json.loads(stdin_content)
                if isinstance(parsed, list):
                    tickers.extend(parsed)
                elif isinstance(parsed, dict) and "tickers" in parsed:
                    tickers.extend(parsed["tickers"])
        except Exception:
            pass

    if args.tickers:
        for t in args.tickers.split(','):
            cleaned = t.strip().upper()
            if cleaned and cleaned not in tickers:
                tickers.append(cleaned)

    if not tickers:
        print(json.dumps({
            "success": False,
            "error": "No tickers provided. Use --tickers AAPL,MSFT or pass JSON via stdin.",
            "data": {},
            "errors": {}
        }))
        sys.exit(1)

    results = {}
    errors = {}

    for ticker in tickers:
        ticker = ticker.strip().upper()
        if not ticker:
            continue
        try:
            results[ticker] = fetch_ticker_data(ticker)
        except Exception as err:
            errors[ticker] = str(err)

    output = {
        "success": True,
        "data": results,
        "errors": errors
    }

    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
