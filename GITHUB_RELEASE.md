# Antigrative Dashboard v0.9.1

The project is temporarily maintained at `ATtacK030130/antigrative-dashboard`. This release updates the App update endpoint and documentation links to that repository, and introduces the `v0.9.1` dashboard enhancements:

- **Pixel cat / Minimal speed card:** Switchable animated pixel-cat speed trail and minimal sparkline (`speedStyle` preference) with peak throughput readout.
- **Quota pace & linear forecast:** Window pace badge (`Comfortable` / `Tight` / `Runs out early`), hatched projected depletion bar, and active quota-window observed token volume with proportional full-window reference.
- **All local / Current account usage scope:** Switch between all local Antigravity usage and the active account in Token usage, plus decoupled per-conversation persistence.
- **Appearance font sync:** Match Antigravity UI and monospace font settings across inline strip, side panel and IDE.
- **Antigravity 2.32.2 compatibility:** Verified against Antigravity desktop 2.32.2 resources/SDK while retaining IDE 2.6.0 Webview support.

## Install or update

- **Desktop App:** If the previous repository is unavailable, versions through `v0.8.20` cannot discover this move automatically. Download `antigrative-dashboard-0.9.1.zip`, extract it, and run `python manage.py install` once (`python3` on Linux/macOS), then fully quit and reopen the App. Later App update checks use this repository.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.1.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.1.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.1/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.1/ide/README.md)
