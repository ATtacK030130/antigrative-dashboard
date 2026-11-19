# Antigrative Dashboard v0.9.6

Improves **macOS Antigravity Desktop 2.33.0+** launch ergonomics without touching the signed host `.app` bundle, while retaining v0.9.5 memory optimizations and Windows/Linux loopback launch self-healing:

- **macOS managed launcher app (`~/Applications/Antigravity (Dashboard).app`):** `manage.py install` and the active sidecar now automatically create and self-heal a lightweight user-owned launcher wrapper (copying the Antigravity icon, setting `LSUIElement`, and leaving `/Applications/Antigravity.app` untouched so Apple code signing, notarization, TCC permissions and auto-updates remain intact). Users can pin it to the Dock or open it from Spotlight; if Antigravity is already running without remote debugging, it offers a native **Quit & Relaunch** confirmation instead of silently failing.
- **Safer `manage.py launch` & standalone installed helper:** Detects running macOS instances lacking an active `DevToolsActivePort`, adds `--restart` to gracefully quit and relaunch, prefers `/usr/bin/open -a` for `.app` bundles, reuses saved `appResources`/`profile` settings in `launch` and `status`, and provides an installed CLI fallback at `~/.gemini/config/plugins/antigravity-pulse/compat/launch_config.py launch`.
- **Includes v0.9.5 memory & backfill optimizations:** Metadata-only historical Token usage backfill, orphan `brain/<id>` filtering, shared idle summary caching, bounded log/SDK reads, and a 192 MiB V8 heap cap across App and IDE collectors.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.6.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.6.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.6.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.6/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.6/ide/README.md)
