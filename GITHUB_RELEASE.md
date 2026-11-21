# Antigrative Dashboard v0.9.12

Polishes Token Usage aggregation, quota-window stability, and Windows shortcut discovery on **Antigravity Desktop 2.34.0+**:

- **Merged model thinking tiers (#13):** Combines thinking/effort tiers (`XHigh`, `High`, `Medium`, `Low`, `Minimal`, `Thinking`, `Max`, `Tiered`) of the same model across the usage legend, stacked bar chart, tooltips, and breakdown table without altering disk ledgers or merging distinct variants/roles (`Orchestrator (...)`, `Mini`). Hovering any multi-tier model row in the breakdown table reveals a lightweight per-tier share tooltip.
- **Zero-flicker quota-window usage:** Fixes occasional missing/jumping "Cycle usage" rows in the context card by ignoring idle groups' sliding `resetAt` timestamps in cache keys and preserving same-cycle usage across transient polls.
- **Windows redirected Desktop & Programs support (#9):** Resolves relocated Windows Known Folders (e.g. `D:\Users\<user>\Desktop` or `OneDrive\Desktop`) during shortcut discovery and flag injection across both Python and Node runtimes.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.12.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.12.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.12.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
