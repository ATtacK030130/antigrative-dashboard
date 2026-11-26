# Antigrative Dashboard v0.9.19

Bugfix release addressing weekly quota full-capacity token skew after global resets (#26) and macOS standalone Antigravity IDE 2.8.0+ process ownership detection (#28):

### Fixed
- **Weekly quota full-capacity token estimate after global quota reset (#26):**
  - `finalizeQuotaWindows()` (`sidecars/panel/usage.mjs`) no longer overrides weekly cost-to-token conversion with the 7-day calendar `familyRate` computed from `days` (which mixed pre-reset days and, in **All local** scope, other local accounts' pricing into the active account's `[resetAt - 7d, resetAt]` window).
  - `QuotaEstimator.estimate()` (`sidecars/panel/quota-estimator.mjs`) now converts cost-space `estimatedFullUsd` back to `estimatedFullTokens` using the active window's own blended rate (`observedCostUsd / observedTokens`), and prefers the post-anchor rate (`effCost / effTokens`) after mid-cycle resets (`midCycleReset`).
  - `computeOverviewFinance()` (`compat/usage-ui.cjs`) now uses `win.estimatedFullTokens` directly (falling back to the window's own rate before 7-day `days` rates) and includes `estimatedFullUsd` / `usedFraction` in `weeklyQuotaSig`, keeping the inline strip, side panel, and Usage dashboard Overview KPI fully aligned.
- **macOS standalone Antigravity IDE 2.8.0+ *"IDE renderer port does not belong to Antigravity IDE"* (#28):**
  - `ide/discovery.mjs` now extracts unquoted POSIX executable paths cleanly across spaces (`commandExecutable()` / `isMacosIdeBundlePath()`), matching `Antigravity IDE.app/Contents/MacOS/Electron` alongside `Antigravity IDE` (including custom space-containing install paths, positional workspace arguments, and bundled `agy --hub` / `language_server_macos_*` binaries) while continuing to reject `Contents/Frameworks/... Helper` processes, Desktop `Antigravity.app`, nested `.app/` spoofing, and other apps passing the IDE path as an argument.
  - `compat/launch-config.mjs` macOS IDE launcher detection and `is_running()` now recognize both `Contents/MacOS/Antigravity IDE` and `Contents/MacOS/Electron`.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.19.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.19.vsix` and choose **Install from VSIX…** in the IDE extensions view, then fully quit and reopen the IDE.
- **CLI:** Extract `antigrative-dashboard-0.9.19.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI guide](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/CLI.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
