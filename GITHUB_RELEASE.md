# Antigrative Dashboard v0.9.14

Fixes an issue where the inline status bar could suddenly disappear mid-conversation during slow metrics polls or heavy sessions, and eliminates main-thread SQLite stalls:

- **Eliminate unexpected inline bar disappearance (`compat/runtime-ui.mjs`, `compat/inline-widget.cjs`):**
  - **No false disable on bridge timeouts:** `rendererBridge` no longer returns `enabled: false` on 15s request timeouts, queue saturation (`pending.size >= 8`), or transient binding errors (reserving `enabled: false` strictly for explicit `dispose()` and user-disabled settings). In-flight saturation (`connection.inflight >= 8`) now replies immediately instead of hanging for 15s.
  - **Stable UI during transient reconnects:** The inline bar stays visible and preserves its last displayed TPS, cache, context, and quota values on transient bridge reconnects/timeouts without flashing a reconnecting warning banner in the context card.
  - **Non-destructive CDP heartbeat recovery:** Tolerates a single 5s CDP heartbeat timeout on desktop main pages and reconnects without executing `window.__agPulseDispose?.()`, preventing live DOM teardown during transient renderer/sidecar load spikes.
- **Eliminate main-thread SQLite blocking & lock-contention index loss (`sidecars/panel/usage-index.mjs`, `sidecars/panel/usage.mjs`, `sidecars/panel/main.mjs`, `ide/main.mjs`):**
  - Cuts main-thread `PRAGMA busy_timeout` from `5000ms` to `250ms`, prevents `SQLITE_BUSY` lock errors from unlinking healthy `.usage-index-v1.sqlite` files, yields between secondary index creation and aggregation queries, skips main-thread SQLite while a disk worker is active, offloads production cold bulk builds (`> 16` files) to the worker on foreground polls, and guards `usage.snapshot()` so index hiccups never drop live metrics.
- **Protect active large conversations from cache eviction thrashing (`sidecars/panel/trajectory-reader.mjs`):**
  - Restores the default `cacheBudgetBytes` to `budgetBytes` (`8 MiB`, still bounded by `maxCachedEntries = 4`) and evicts settled conversations ahead of actively `RUNNING` conversations during `trim()`, preventing `4–8 MiB` active sessions from repeatedly repaginating from offset 0.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.14.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.14.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.14.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
