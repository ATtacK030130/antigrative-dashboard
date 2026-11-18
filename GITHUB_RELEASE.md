# Antigrative Dashboard v0.9.2

Adapts **Antigravity Desktop 2.33.0+** (where `app.asar` made `--remote-debugging-port` opt-in and removes `DevToolsActivePort` unless launched with loopback debugging flags) without modifying `resources/app.asar`:

- **Automatic launch entry-point configuration & self-healing:** `manage.py install` and the active sidecar runtime add `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1` to user-owned Windows Desktop/Start Menu/TaskBar shortcuts and Linux `~/.local/share/applications/antigravity.desktop`, automatically recovering if an Antigravity auto-update overwrites shortcuts and rolling back cleanly on `manage.py uninstall` / `--panel-only`.
- **Direct loopback launcher (`manage.py launch`):** Launches Antigravity Desktop with the loopback CDP flags across Windows, Linux and macOS (essential on macOS or custom installations).
- **Diagnostics & side-panel guidance:** Detects opt-in debug-port absence (`reason: "debug-port-disabled"`, `hostVersion`, `launchConfigured`) in `manage.py status`, `integration-state.json`, and localized side-panel messages.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.2.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut (or run `python manage.py launch`). Existing `v0.9.1` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.2.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.2.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.2/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.2/ide/README.md)
