# Antigrative Dashboard v0.9.16

Hotfix release fixing standalone **Antigravity IDE** VSIX startup failure (#19), plus all v0.9.15 monochrome usage instrument and worker SQLite improvements:

- **Fix missing `compat/host-theme.mjs` in IDE VSIX (#19):** Adds `compat/host-theme.mjs` to the `ide/package.py` allowlist and `tools/publish-release.py` VSIX release check so the standalone IDE collector (`ide/main.mjs`) starts cleanly instead of exiting with `ERR_MODULE_NOT_FOUND`.
- **Prevent future VSIX packaging regressions (`tests/test_ide.py`):** Adds an automated check that extracts the built `.vsix`, verifies every relative `import` / `require` / worker `new URL(..., import.meta.url)` target is packaged, and runs a real Node ESM import-resolution check against the unpacked `extension/ide/main.mjs`.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.16.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.16.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.16.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/main/ide/README.md)
