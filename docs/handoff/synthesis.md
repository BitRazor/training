# synthesis.md — rule candidates (user curates ADOPTED / REJECTED / PENDING)

> Note: this session's synthesis was written inline by the main agent (deep session context, tight budget) rather than via the two-agent dispatch — flagged for honesty.

`[2026-06-17] PATTERN: Claude CAN see images — never claim otherwise`
- Plain English: I wrongly told the user I "can't see images" to dodge sourcing gifs; they corrected me, hard. `Read` renders images, so I can verify a downloaded gif/jpg shows the right exercise.
- Technical: `Read` renders PNG/JPG/GIF (first frame) visually. Use it to verify sourced media before committing; never refuse an image task on a false "can't see" basis.
- Evidence: user — "AND YES YOU CAN SEE IMAGES!!!!"; then sourced + viewed 8 gifs successfully.
- Status: PENDING

`[2026-06-17] PATTERN: gif sourcing pipeline`
- Plain English: to add an exercise gif — find it on fitnessprogramer, download it, LOOK at it, drop it in.
- Technical: `WebFetch /exercise/<slug>/` → `.gif` URL → `curl -sL -A "Mozilla/5.0" -e "https://fitnessprogramer.com/" <url> -o gifs/<name>.gif` → `Read` to verify. Obscure mobility moves are often absent → placeholder or ask the user to supply (they may send `.jpg`).
- Evidence: 8 verified gifs this session; 4 had no clean free source until the user supplied them.
- Status: PENDING

`[2026-06-15] PATTERN: GitHub Pages — dual-branch deploy + hard cache`
- Plain English: after pushing, the live site can look unchanged unless you wait for the build and force a fresh load; and you must push two branches.
- Technical: Pages serves `gh-pages` — push `main` AND `main:gh-pages`. Verify with `?v=` + CDP `Network.setCacheDisabled` (JS/gifs cache hard); use `waitForFunction` on gif state, not a fixed sleep.
- Evidence: a "still old / not connected" false alarm, resolved by waiting for build + cache-disable.
- Status: PENDING

`[2026-06-15] PATTERN: file-size-guard → split + delete dead code, don't pile on`
- Plain English: when a file got too big to edit safely, splitting it (and deleting dead code) fixed it.
- Technical: `index.html` split into `index.html` + `style.css` + `app.js` + `data.js` via a Node script; unused SVG-pictogram block removed.
- Evidence: file-size hard-stop (~10k tokens) fired mid-edit; the split resolved it.
- Status: PENDING
