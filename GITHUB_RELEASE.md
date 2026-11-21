# Antigrative Dashboard v0.9.11

Restores live context window, quota window, TPS, and cache-hit collection on **Antigravity Desktop 2.34.0+**:

- **Antigravity 2.34.0+ credential discovery:** `language_server` in 2.34.0 no longer passes `--csrf_token` on the process command line. `AntigravityClient` and `IdeClient` now fall back to the host-injected `ANTIGRAVITY_CSRF_TOKEN` (and PID-verified loopback HTTP `ANTIGRAVITY_LS_ADDRESS` if logs are unavailable) while preserving full backward compatibility with older host versions.
- **Scoped-token `403` resilience & transcript fallback:** Distinguishes single-RPC HTTP `403` restrictions on a verified sidecar endpoint from genuine disconnections (with localized English / Simplified Chinese / Traditional Chinese notices), and adds read-only `transcript.jsonl` exact token-count fallback (`TranscriptReader.readMetrics`) when trajectory RPCs are restricted.
- **Neon quota-group classification:** Automatically maps `Neon` / `Gemini 4 Neon` model labels into the `Gemini` quota group across both usage tracking and UI group selection.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.11.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.11.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.11.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
