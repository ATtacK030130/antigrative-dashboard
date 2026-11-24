# Antigrative Dashboard v0.9.16

Fixes standalone **Antigravity IDE** VSIX startup failure (#19) and brings a major **Antigravity CLI (`agy`)** upgrade, alongside all v0.9.15 monochrome usage instrument and worker SQLite improvements:

### Standalone IDE fix (#19)
- **Fix missing `compat/host-theme.mjs` in IDE VSIX:** Adds `compat/host-theme.mjs` to `ide/package.py` and `tools/publish-release.py` so the standalone IDE collector (`ide/main.mjs`) starts cleanly instead of exiting with `ERR_MODULE_NOT_FOUND`.
- **Prevent future VSIX packaging regressions (`tests/test_ide.py`):** Extracts the built `.vsix`, verifies every relative `import` / `require` / worker `new URL(..., import.meta.url)` target is packaged, and runs a real Node ESM import-resolution check against the unpacked `extension/ide/main.mjs`.

### Antigravity CLI (`agy`) upgrade
- **Richer responsive status line:** Adds conversation totals (`↑`/`↓`), universal cache hit rate, estimated generation speed (`≈ t/s`), cost, and a live `Turn` / `Last turn` summary row with priority-based shrinking down to 40-column Termux portrait screens (while preserving `gemini-argon-wtu-weekly` Argon quotas and `en` / `zh-CN` / `zh-TW`).
- **`#usage` zero-quota local hook & `usage-cli` report:** Typing `#usage` (`#u`, `#用量`, `##`, half- or full-width) in `agy` prints local conversation, today/7d/30d, 14-day sparkline, 7d model shares, and quota details before calling the model (zero request/quota cost; opt out with `--no-hook`). Outside `agy`, run `python manage.py usage-cli [--watch]` or `node cli/usage.mjs`.
- **Local privacy-safe ledger:** Stores only whitelisted numbers, model labels and state under one-way hashed keys in `~/.gemini/antigravity-cli/antigrative-dashboard-data/` (baseline handling for `/resume`; disable with `--no-ledger` or `AG_PULSE_CLI_NO_LEDGER=1`).
- **Platform & terminal polish:** Termux (`android`) Linux/XDG path support, automatic ASCII glyph fallback on legacy Windows `conhost` (`--ascii`/`--unicode`/`AG_PULSE_CLI_GLYPHS`), fast Windows `.cmd` launchers (`statusline.cmd`/`hook.cmd`) on safe paths, exit-0 graceful degradation on bad stdin, `--doctor` diagnostics, and interactive HTML preview (`node tools/preview-cli.mjs`).

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.16.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.16.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.16.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options (or `--no-hook` to skip the `#usage` hook).

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI guide](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/CLI.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
