# Antigrative Dashboard v0.9.8

Makes the **Neon (氖龙) plush mascot Easter egg opt-in (off by default)** so the standard download stays clean for everyone while keeping the Easter egg one click away:

- **Off by default (zero overhead):** Fresh downloads and in-app updates no longer show the Neon mascot unless enabled, mounting zero mascot DOM until turned on.
- **Built-in `✦ Neon` / `✦ 氖龙` toggle:** Hover the **Context** chip and click the compact `✦ Neon` (`✦ 氖龙` / `✦ 氖龍`) toggle next to the language switcher in the card footer to enable or disable the Easter egg anytime. Saved durably in `preferences.json` and synced immediately across open composers.
- **Full Neon interactions when enabled:** Includes the baked two-frame plush WebP companion, custom frosted `✦ 氖龙` hover bubble, press-and-rub squish & spring wobble, click-to-tuck peeking toggle, proximity curiosity tilt, typing rhythm nods, and scroll-safe collision avoidance.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.8.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.8.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.8.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.8/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.8/ide/README.md)
