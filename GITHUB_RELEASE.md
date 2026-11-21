# Antigrative Dashboard v0.9.13

Improves quota-window full-capacity estimation accuracy and eliminates first-launch SQLite indexing stalls on **Antigravity Desktop 2.34.0+**:

- **Hybrid quota full-capacity estimator (`quota-estimator.mjs`):**
  - **Faster weekly cold start:** Lowers the weekly full-capacity display threshold from `5%` to `2%` (with `>= 5` requests), so weekly cycle estimates appear much sooner after reset.
  - **Smooth warm start & sudden-reset isolation:** Persists lightweight cross-cycle calibration (`quota-calibration-v1.json`) to smooth `1%` post-reset estimates via Empirical Bayes shrinkage, detects mid-cycle quota bounces and resets all post-anchor deltas (tokens, used fraction, and request count), and uses Theil-Sen median slopes to resist single-turn spikes and initial unrecorded offsets.
  - **Official quota hike/cut resilience:** Immediately follows large quota increases or cuts on display, while requiring a second non-overlapping increment in the same direction before fast-updating historical priors.
- **Non-blocking cold-start SQLite indexing:** Bounds foreground `/api/metrics` waits on ordinary polls to `350ms` (`maxWaitMs`) across both Desktop App and IDE, so live context window, five-hour/weekly quotas, TPS, and cache hit rate render immediately even during an initial multi-hundred-file `.usage-index-v1.sqlite` build.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.13.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.13.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.13.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
