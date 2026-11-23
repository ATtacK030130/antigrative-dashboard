# Antigrative Dashboard v0.9.15

Redesigns the usage details view as a monochrome instrument with cache hit rate and estimated cost, keeps long-running totals compact, and further reduces main-thread SQLite work:

- **Monochrome usage instrument (`compat/usage-ui.cjs`):**
  - **Iceberg chart:** Each day/week/month bar splits new tokens (uncached input + cache write + output) above the waterline from cache reads below, on one shared scale, so fresh spend and cache reuse can be compared at a glance.
  - **Punch card:** One row per model, one column per time bucket, circle area = tokens. It shares the chart's horizontal axis; hovering highlights the same column in both. Marks use a single ink colour, and the host accent only marks the hovered item.
  - **Cache hit rate and estimated cost:** The model table replaces the cache-write column with a cache hit rate (inline bar + percentage) and an estimated USD cost at official API list prices (long-context tiers applied by average prompt size; unpriced models show `—`). The range summary adds an `≈ $` total.
  - **Cleaner model list:** Orchestrator variants merge into their base model, Gemini 4 models use concise element names (Neon, Hydrogen, Argon…), and rows with several thinking tiers show a per-tier tooltip.
- **Compact table numbers:** Token cells show exact values below 1,000 and three significant digits with K/M/B/T units above (`1.84M`, `41.4M`, `736M`); costs from `$1,000` use the same units (`$1.23K`). Columns stay narrow as usage grows, and hovering a cell shows the exact value.
- **Clear cold-start state (`compat/inline-widget.cjs`):** Before the first real reply, a transient offline status shows `Connecting to Antigravity…` / `Loading quota…` instead of `context unknown` / `no quota`.
- **Less main-thread SQLite work (`sidecars/panel/usage.mjs`, `sidecars/panel/usage-disk-worker.mjs`, `sidecars/panel/usage-index.mjs`):**
  - Foreground summaries over more than 16 conversation files always run in the disk worker, even when the SQLite index already exists. The poll waits up to `maxWaitMs` for the result, dirty files are forwarded so new requests are re-synced, and stale summaries retry after `2s` instead of `30s`.
  - Account-scoped quota-window queries use a new `idx_source_rows_acct_at` index with an `IN` subquery instead of full `source_rows` scans.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.15.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.15.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.15.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
