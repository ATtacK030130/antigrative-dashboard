# Antigrative Dashboard v0.9.17

Enhances SSH remote workflows across both **Antigravity Desktop App** and **standalone Antigravity IDE**, and adds stale debug-port detection plus cross-platform launch-flag self-healing for the standalone IDE (#23):

### Antigravity App: inline status bar in `(SSH: <host>)` windows (#23)
- **Loopback SOCKS5 routing:** Adds a zero-dependency loopback-only SOCKS5 client (`sidecars/panel/socks5.mjs`) used by both ordinary RPC calls and `streamTrajectoryPage` / background collection workers, automatically detecting Antigravity App's local `ssh -D` tunnels and probing remote `language_server` / `daemon/{ls,hub}_*.json` via non-interactive `ssh -T -n -o BatchMode=yes`.
- **Isolated local & remote contexts:** Splits `(SSH: <host>)` windows into dedicated `remoteContexts` by renderer port (disabling local disk transcript/conversation scans while merging remote consumption into the shared local same-account `UsageLedger`), renews leases directly over SOCKS5 without repeating SSH probes, and degrades quietly with backoff on password/2FA hosts.

### Standalone Antigravity IDE: Remote-SSH & launch-flag self-healing (#23)
- **Remote-SSH window support:** Validates `vscode-remote+ssh-002dremote-002b...vscode-resource.vscode-cdn.net` authorities and official remote `.antigravity-ide-server/{bin/*,cli/servers/*/server}/extensions/agy/bridge.js` paths in `ide/webview-targets.mjs`, reads remote multi-line `daemon/{hub,ls}_*.json` blocks (supporting remote `agy 2.35+` without `--csrf_token` CLI flags), and pairs credentials against the IDE's locally forwarded loopback `backendPort` (`ide/remote-client.mjs`, `ide/main.mjs`, opt-out via `antigrativeDashboard.ide.remoteSsh`).
- **Stale `DevToolsActivePort` liveness probe & cross-platform self-heal:** Probes `127.0.0.1:<port>` before spawning the IDE collector so leftover `DevToolsActivePort` files after an IDE upgrade (e.g. `2.7.0 → 2.8.0`) no longer leave the extension silently stuck in `reconnecting`. Reuses `compat/launch-config.mjs` (Windows `.lnk`, Linux `antigravity-ide.desktop`, macOS `Antigravity IDE (Dashboard).app`) with `antigrativeDashboard.ide.autoConfigureLaunch` (`prompt` / `auto` / `off`) and the **Antigrative Dashboard: Repair IDE Launch Flags** command to restore `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1` and guide a single restart.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.17.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.17.vsix` and choose **Install from VSIX…** in the IDE extensions view. If launch flags are missing or cleared by an IDE update, follow the prompt or run **Antigrative Dashboard: Repair IDE Launch Flags**, then fully quit and reopen the IDE.
- **CLI:** Extract `antigrative-dashboard-0.9.17.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI guide](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/CLI.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
