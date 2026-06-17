# restore.md — read first to rebuild context

**Plain English:** A single-page mobile workout app for a **Week-1 HSR "calibration"** session — find your 15RM at 3·3 tempo on each lift. The user reads the *rendered app on their phone*; they do not read code. Always verify the **live** rendered app before claiming done.

**Technical:**
- **Repo:** `C:\Users\arnol\Claude_docts\training`  ·  remote `github.com/BitRazor/training`
- **Deploy:** GitHub Pages serves the **`gh-pages`** branch. Push BOTH: `git push origin main` **and** `git push origin main:gh-pages`. Live: https://bitrazor.github.io/training/
- **Build:** ~60–90 s. Poll: `gh api repos/BitRazor/training/pages/builds/latest --jq '.status'` until `built`.
- **Verify live:** playwright MCP at **390 px** viewport (phone). Use a `?v=` cache-bust query AND a CDP `Network.setCacheDisabled` (JS + gifs cache hard). For gif slots, `waitForFunction` on `.missing`/`naturalWidth` — a fixed sleep is flaky.
- **Files:** `index.html` (structure) + `style.css` + `app.js` (engine) + `data.js` (`DAYS` + `WARMUP` program data) + `gifs/`. (Split from one file mid-project for size; dead SVG pictograms removed.)
- **State:** `localStorage` key `w1cal-v1`. Progress is **done-driven** (✓ → `state.done`), NOT logged-value-driven.
- **Gif sourcing:** fitnessprogramer.com (matches the existing watermark) or user-supplied. Pipeline: `WebFetch https://fitnessprogramer.com/exercise/<slug>/` for the `.gif` URL → `curl -sL -A "Mozilla/5.0" -e "https://fitnessprogramer.com/" <url> -o gifs/<name>.gif` → **`Read` the file to visually confirm the movement** (Claude CAN see images). Warm-up slots are extension-aware (a `gif` field may be `.jpg`/`.png`).
- **Backups (git tags):** `backup-2026-06-15-pre-ux` (→27cab42), `backup-2026-06-15-pre-features` (→44e3a3e).
- **Future, separate app:** the ongoing post-calibration tracker `tracker.html` is specced but NOT built — `C:\Users\arnol\Documents\Claude\Projects\Training\tracking\app-spec.md`.
