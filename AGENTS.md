# Agent Guidelines: Swing Trade Stocks System

## Role & Automation Directives
This workspace automates institutional swing trading screening, chart evaluation, and dual-gem audit for Indian equities.

## System Architecture
- scripts/daily_swing_bot.js: Autonomous headless pipeline connecting to Chartink screeners, capturing high-resolution NSE technical charts, and synthesizing audit notes.
- exemplars/: Benchmark ground-truth charts demonstrating Minervini Setup A (9/20 EMA Rest), Setup B (9 EMA Shakeout Reclaim), and hard reject patterns.
- .agents/skills/swing-trade-evaluator/: Embedded technical evaluator skill for Antigravity agents.

## Operational Standards
- Always record historical runs under history/YYYY-MM-DD/.
- Daily chart captures must be saved under screenshots/YYYY-MM-DD/.
- Root directory files (combined_gemini_gem_audit.md, stocks_data.json) must always reflect the single latest active trading session.
