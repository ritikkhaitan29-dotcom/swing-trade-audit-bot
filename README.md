# Swing Trade Stocks System

Automated daily swing trading screening, multi-gem technical analysis, and consensus synthesis system based on Mark Minervini's 9/20 EMA Pullback and Volatility Contraction Pattern (VCP) framework.

---

## Folder Hierarchy & Management

All artifacts are maintained with clean, self-explanatory, chronological folder isolation:

```
Swing Trade Stocks/
│
├── README.md                                  # System overview & directory guide
├── combined_gemini_gem_audit.md               # Latest consensus audit report
├── gem_institutional_analyst_output.md        # Latest raw output from Gem 1
├── gem_anti_gravity_output.md                 # Latest raw output from Gem 2
├── stocks_data.json                           # Latest screener metadata & metrics
│
├── screenshots/                               # Date-wise captured NSE daily technical charts
│   └── YYYY-MM-DD/                            # e.g., 2026-09-11/
│       ├── BOSCHLTD_Daily_Chart.png
│       ├── KPIL_Daily_Chart.png
│       └── ...
│
├── history/                                   # Chronological archive of all past audit runs
│   └── YYYY-MM-DD/                            # e.g., 2026-09-11/
│       ├── combined_gemini_gem_audit_YYYY-MM-DD.md
│       ├── gem_institutional_analyst_YYYY-MM-DD.md
│       ├── gem_anti_gravity_YYYY-MM-DD.md
│       └── stocks_data_YYYY-MM-DD.json
│
└── scripts/                                   # Execution scripts and automation runners
    └── daily_swing_bot.js                     # Scheduled runner for Chartink + NSE + Dual Gems
```

---

## Daily Workflow & Structure
1. **Root Directory (`Swing Trade Stocks/`)**: Always contains the **latest/active** audit report, gem evaluations, and screened stock data for immediate access.
2. **`screenshots/YYYY-MM-DD/`**: Stores clean daily candlestick charts (9, 20, 50 EMA & 20 SMA Volume) captured for each qualified stock on that trading day.
3. **`history/YYYY-MM-DD/`**: Preserves an immutable historical archive of every trading day's run, making performance tracking, backtesting, and setup review effortless.
4. **`scripts/`**: Houses standalone scripts and automation pipelines.
