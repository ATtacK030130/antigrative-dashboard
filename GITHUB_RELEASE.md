# Antigrative Dashboard v0.9.5

Optimizes **host `language_server` and sidecar memory footprint** on installations with hundreds of historical conversations, while retaining full **Antigravity Desktop 2.33.0+** loopback launch support:

- **Lightweight metadata-only historical backfill:** Opening **View token usage** now fetches `GetCascadeTrajectoryGeneratorMetadata` (`includeMessages: false`) instead of deserializing full `GetCascadeTrajectorySteps` (`verbosity: 3`) payloads, filters unlisted orphan `brain/<id>` directories, marks settled (`>= 60s`) 0-request `.db` files as `complete`, paces backfill slices gently, and coalesces active-sync `UsageLedger.summary()` scans.
- **Lower idle & startup memory footprint:** Caps collector main-process V8 old-space heap (`--max-old-space-size=192`), shares `GetAllCascadeTrajectories` summaries with adaptive idle TTLs (`12s–15s`), renews healthy HTTP 200 discovery leases without 15s process/socket scans, bounds `language_server.log` discovery reads to 256 KiB tail chunks, and extracts bundled SDK files via 2 MiB chunked reads.
- **Antigravity Desktop 2.33.0+ loopback launch & self-healing:** `manage.py install` and the active sidecar automatically configure and self-heal `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1` on user-owned Windows shortcuts and Linux `.desktop` entries without modifying `resources/app.asar`, `manage.py launch` starts Antigravity directly with loopback flags (including macOS), and `manage.py status` / side-panel notices surface structured `debug-port-disabled` diagnostics.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.5.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut (or run `python manage.py launch`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.5.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.5.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.5/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.5/ide/README.md)
