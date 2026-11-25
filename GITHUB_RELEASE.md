# Antigrative Dashboard v0.9.18

Hotfix for **Remote-SSH host discovery** in both **Antigravity Desktop App `(SSH: <host>)` windows** and **standalone Antigravity IDE Remote-SSH** (#25, follow-up to #23):

### Fixed (#25)
- **Prevent remote probe self-echo from truncating `daemonFiles`:** `v0.9.17` passed `REMOTE_DISCOVERY_SCRIPT` in `ssh` argv, causing the probe process's own `/proc/<pid>/cmdline` (and `ps` output on non-`/proc` hosts) to echo `===AGP_DAEMON===`, which matched `indexOf('===AGP_DAEMON===')` in `parseRemoteSshDiscovery()` and discarded the real daemon JSON section on Linux (`bash` and `zsh`) and standalone IDE Remote-SSH (`agy 2.35+`).
  - `buildRemoteProbeArgs()` / `probeRemoteSshHost()` (`sidecars/panel/ssh-remote.mjs`) now invoke `ssh -T ... -- <destination> sh -s` and pipe `REMOTE_DISCOVERY_SCRIPT` over `stdin` (preserving all `BatchMode=yes` non-interactive authentication safeguards), keeping the script body out of remote process command lines.
  - `REMOTE_DISCOVERY_SCRIPT` additionally excludes its own PID and any probe/awk command lines containing `===AGP_PS===` / `===AGP_DAEMON===`, and `parseRemoteSshDiscovery()` now uses line-anchored sequential matching (`===AGP_PS===` → `===AGP_DAEMON===` → `===AGP_LOGS===`) plus line-anchored file blocks.
- **Fix `zsh` `NOMATCH` / `IFS` word-splitting and non-POSIX login shells:** Running via `sh -s` ensures remote hosts whose default login shell is `zsh`, `fish`, `csh`, or `bash` execute inside POSIX `sh`. Daemon and log enumeration now uses glob-free `ls -1t` / `ls -1tr` + `while IFS= read -r` filtering so missing `hub_*.json` or `ls_*.json` patterns never abort discovery while preserving symlink, 16 KiB per-file, and 64-file limits.

Includes all **v0.9.17** features (App `(SSH: <host>)` loopback SOCKS5 routing, standalone IDE Remote-SSH, and stale `DevToolsActivePort` probing + cross-platform launch-flag self-healing).

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.18.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.18.vsix` and choose **Install from VSIX…** in the IDE extensions view, then fully quit and reopen the IDE.
- **CLI:** Extract `antigrative-dashboard-0.9.18.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI guide](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/CLI.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
