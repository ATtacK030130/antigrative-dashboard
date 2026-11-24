# Antigrative Dashboard v0.9.16

Fixes standalone **Antigravity IDE** VSIX startup (#19), adds manual **Minimal bar** collapse (#20), moves weekly quota capacity estimates into **USD cost space** (#21), adds **Antigravity 2.34.0+ daemon / Remote SSH-WSL Hub** discovery, and ships a major **Antigravity CLI (`agy`)** upgrade:

### Desktop & Standalone IDE fixes (#19, #20, #21)
- **Fix missing `compat/host-theme.mjs` in IDE VSIX (#19):** Adds `compat/host-theme.mjs` (and new shared `compat/pricing.cjs`) to `ide/package.py` and `tools/publish-release.py`, plus automated unpacked VSIX relative-import & real Node ESM startup checks in `tests/test_ide.py`.
- **Manual Minimal / Full inline bar collapse (#20):** Collapse the inline bar to an ultra-compact `< ○ 47%` pill with one click on the strip chevron or inside the context-card footer (persisted across reloads with zero flash, compressing smoothly down to `24px` in narrow/subagent panes).
- **Cost-space quota full-capacity estimation (#21):** Extracts shared model-tier and official API pricing tables into `compat/pricing.cjs` and computes `observedCostUsd` / `estimatedFullUsd` directly in USD cost space so mixed-model usage stays accurate.
- **Antigravity 2.34.0+ daemon discovery & Remote SSH/WSL Hub support:** Safely discovers `~/.gemini/antigravity/daemon/{ls,hub}_*.json` (symlink-safe, same-UID, PID/socket-verified), detects remote headless SSH/WSL hubs without mutating local shortcuts, and surfaces clear side-panel status while keeping full statistics working.

### Antigravity CLI (`agy`) upgrade
- **Richer responsive status line:** Adds conversation totals (`↑`/`↓`), universal cache hit rate, estimated generation speed (`≈ t/s`), cost, and a live `Turn` / `Last turn` summary row with priority-based shrinking down to 40-column Termux portrait screens (preserving `gemini-argon-wtu-weekly` Argon quotas and `en` / `zh-CN` / `zh-TW`).
- **`#usage` zero-quota local hook & `usage-cli` report:** Typing `#usage` (`#u`, `#用量`, `##`, half- or full-width) in `agy` prints local conversation, today/7d/30d, 14-day sparkline, 7d model shares, and quota details before calling the model (zero request/quota cost; opt out with `--no-hook`). Outside `agy`, run `python manage.py usage-cli [--watch]` or `node cli/usage.mjs`.
- **Local privacy-safe ledger:** Stores only whitelisted numbers, model labels and state under one-way hashed keys in `~/.gemini/antigravity-cli/antigrative-dashboard-data/` (baseline handling for `/resume`; disable with `--no-ledger` or `AG_PULSE_CLI_NO_LEDGER=1`).
- **Platform & terminal polish:** Termux (`android`) Linux/XDG path support, automatic ASCII glyph fallback on legacy Windows `conhost` (`--ascii`/`--unicode`/`AG_PULSE_CLI_GLYPHS`), fast Windows `.cmd` launchers (`statusline.cmd`/`hook.cmd`) on safe paths, exit-0 graceful degradation on bad stdin, `--doctor` diagnostics, and interactive HTML preview (`node tools/preview-cli.mjs`).

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.16.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.16.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.16.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options (or `--no-hook` to skip the `#usage` hook).

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI guide](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/CLI.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
