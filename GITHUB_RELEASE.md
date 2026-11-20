# Antigrative Dashboard v0.9.9

Improves Windows process-discovery stability and error presentation across both the Desktop App plugin and standalone IDE extension:

- **No redundant idle PowerShell rescans:** When the 15s discovery lease expires during idle periods, both `AntigravityClient` and `IdeClient` now verify the cached PID and loopback port directly (`<1ms`, zero PowerShell/WMI spawn) and renew the lease instead of repeatedly spawning `powershell.exe Get-CimInstance`.
- **Sanitized discovery errors across all locales:** Process-discovery timeouts and command failures are translated into concise, localized messages across English, Simplified Chinese, and Traditional Chinese — raw `Command failed: powershell.exe ...` command lines can no longer leak into the UI.
- **Single quota error notice:** Global connection/stale errors now render once in a dedicated `#quota-error` line in the inline context card rather than repeating inside both the 5-hour and weekly quota sections.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.9.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.9.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.9.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
