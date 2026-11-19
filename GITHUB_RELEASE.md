# Antigrative Dashboard v0.9.7 (Neon Easter Egg)

Adds the **Neon (氖龙) interactive plush mascot Easter egg** on top of all v0.9.6 macOS launch and v0.9.5 memory/backfill improvements:

- **Neon (氖龙) peeking plush mascot:** Switch to any Neon model (such as `Orchestrator (Neon)` or `Gemini 4 Neon`) and a self-contained two-frame plush WebP companion (`~10.8 KB`, open + blink) springs up from the top-right edge of the composer card inside an isolated Shadow DOM stage with zero host style mutations.
- **Tactile micro-interactions:**
  - **Custom `✦ 氖龙` hover bubble:** Frosted glass speech pill with a pink-to-gold heterochromia sparkle (adapts to light/dark themes, replacing native tooltips).
  - **Headpat squish & spring wobble:** Press and rub/push down to squish the plushie with volume preservation, closing its eyes and releasing with a damped jelly wobble + sparkles.
  - **Click to tuck / sit out:** Quick-click toggles between sitting out and tucked-in peeking (leaving its eyes peeking over the border and remembering your choice).
  - **Proximity curiosity & typing rhythm:** Gently tilts toward a nearby cursor and softly bobs along as you type in the composer.
- **Scroll & overlay safe:** Ignores scrolling chat links/buttons so it stays rock-steady while reading conversations, while automatically hiding for real floating overlays, narrow windows, subagent panes, or open Usage Dashboard modals.

## Install or update

- **Desktop App:** Download `antigrative-dashboard-0.9.7.zip`, extract it, and run `python manage.py install` (`python3` on Linux/macOS), then fully quit and reopen Antigravity from your shortcut / `Antigravity (Dashboard).app` (or run `python3 manage.py launch --restart`). Existing `v0.9.1+` installations can also update in-app via **⋯ → Check for updates**, then restart Antigravity once.
- **Standalone IDE:** Download `antigrative-dashboard-ide-0.9.7.vsix` and choose **Install from VSIX…** in the IDE extensions view. Fully quit the IDE and restart using `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`.
- **CLI:** Extract `antigrative-dashboard-0.9.7.zip` and rerun `python manage.py install-cli` (`python3` on Linux/macOS), including any previously chosen `--language` or `--node` options.

Existing statistics, preferences and IDE extension storage are retained. SHA-256 checksum files accompany both packages.

[Compatibility](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.7/COMPATIBILITY.md) · [IDE installation](https://github.com/ATtacK030130/antigrative-dashboard/blob/v0.9.7/ide/README.md)
