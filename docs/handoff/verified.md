# verified.md — known-works registry (training app)

All verified live at 390 px on https://bitrazor.github.io/training/ during the 2026-06-15 → 2026-06-17 sessions.

**Day tabs (Day 1 / Day 2)**
- Plain English: tapping a day shows only that day's exercises; each tab shows that day's done count.
- Technical: `showDay()` toggles `#panel-day1`/`#panel-day2` `.hidden`; `state.activeDay` persisted; `renderWarmup()` follows the day.
- Last verified: 2026-06-17 · Retest when: `showDay`/dayTabs markup changes.

**✓ = done / collapse, drives the progress bar**
- Plain English: tapping ✓ collapses an exercise to just its name and fills "X/15 done"; tap again to expand.
- Technical: `data-done` handler toggles `state.done[id]`; `.ex.done` CSS collapses; `progress()` counts `state.done`.
- Last verified: 2026-06-17 · Retest when: `progress()` or the `data-done` handler changes.

**Tap-to-arm timer/tempo**
- Plain English: tapping an exercise lights up the correct Rest preset + Tempo in the bottom bar (no thinking).
- Technical: `data-arm` on `.exHead` → `armExercise()`; `restFor()`/`tempoFor()` honor per-exercise `ex.rest`/`ex.tempo`. Copenhagen = 1:30 + no tempo; wrist curls = 0:45; calf = tempo 3·3·3.
- Last verified: 2026-06-17 · Retest when: `restFor`/`tempoFor` or the bar buttons change.

**Warm-up day-split + extension-aware image slots (graceful)**
- Plain English: warm-up follows the day tab; each move shows its image, or a labelled "add gifs/<file>" placeholder if the file is missing.
- Technical: `warmCardHtml` uses the `gif` field's own extension if it has one (`.jpg`/`.png`), else `.gif`; `onerror` → `.missing` placeholder.
- Last verified: 2026-06-17 · Retest when: `warmCardHtml` or `WARMUP` changes.

**Copenhagen Plank logs a seconds-hold**
- Plain English: logs the hold in seconds — results show "25 s", not "25 kg".
- Technical: `kind:"gap", tempo:null`, field `{k:"s",unit:"s"}`; `results()`/`summaryText()` honor `ff.unit`.
- Last verified: 2026-06-17 · Retest when: the unit logic in `results()`/`summaryText()` changes.

**Export / import / one-time migration**
- Plain English: Copy summary / Download JSON / Import JSON work; a one-time cleanup collapses the old layout for returning users without losing logged numbers.
- Technical: `copyBtn`/`dlBtn`/`impBtn`; `state.uxMigrated` one-shot clears `state.open` (keeps `state.v`).
- Last verified: 2026-06-15 · Retest when: state shape or `KEY` (`w1cal-v1`) changes.

**Deploy mechanism**
- Plain English: changes reach the phone only after pushing.
- Technical: Pages serves `gh-pages`; push `main` AND `main:gh-pages`; build ~60–90 s.
- Last verified: 2026-06-17 · Retest when: the Pages source branch changes.
