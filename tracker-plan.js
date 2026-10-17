"use strict";
/* training-tracker — the 12-week Plan view. Two independent program tracks (Day A / Day B, blended
   full-body days since 2026-10-13), each with its own week picker + manual mark-done. Heavy lifts show
   algorithm-calculated weights (tested 15RM → +1%/week → rep-max %); tap a weight to log what you actually
   lifted and the rest of the block recomputes. Lifts render in blocks: done alone (solo), supersets (ss:N,
   cards joined with a connector and tagged 1A/1B), finishers. Uses seed math + howToHtml/gifHtml. */

function shortName(prog){ return prog === "strength-a" ? "Day A" : prog === "strength-b" ? "Day B" : ((db && db.programs && db.programs[prog] && db.programs[prog].name) || prog); }
function isHomeDay(prog){ return typeof HOME_DAYS !== "undefined" && HOME_DAYS.indexOf(prog) >= 0; }
/* rest seconds → "2.5 min" / "1.5 min" / "1 min" */
function fmtMin(sec){ return (Math.round((sec || 0) / 6) / 10) + " min"; }
/* warm-up length shown in its head, per day ("~10 min" gym, shorter at home) */
function warmTime(prog){ return (typeof WARMUP_TIME !== "undefined" && WARMUP_TIME[prog]) || "~10 min"; }
/* the lifts heading word: "Main lifts" in the gym, "Exercises" at home */
function liftsWord(prog){ var P = db.programs[prog]; return (P && P.home) ? "Exercises" : "Main lifts"; }
/* the day-track for today: a gym or home day, or the home session riding on a cardio day (Wednesday) */
function todayProgram(){ var t = CURRENT_WEEK[weekdayIdx()]; if(!t) return null; if(t.type === "strength" || t.type === "home") return t.ref; return t.home || null; }
function activeProg(){ return getProgram(db.activeProgram); }
/* the active program's chosen climb-rate mode (forward only); defaults to plateau (= current behavior) */
function activeRateMode(){ var ps = db.programState && db.programState[db.activeProgram]; return (ps && ps.rateMode) || DEFAULT_RATE_MODE; }
/* ---- what the Plan currently SHOWS: the committed active program, OR a transient "just looking" PREVIEW.
   While previewing, the Plan renders the previewed program from its CARRIED anchor as a FRESH start
   (week 1, nothing done) — Today + db are untouched, and it auto-reverts on leaving the Plan. ---- */
function previewing(){ return !!(ui.preview && ui.preview.program); }
function shownProgramId(){ return previewing() ? ui.preview.program : db.activeProgram; }
function shownProg(){ return getProgram(shownProgramId()); }
function shownRateMode(){ var ps = db.programState && db.programState[shownProgramId()]; return (ps && ps.rateMode) || DEFAULT_RATE_MODE; }
function shownAnchor(exId){ return (previewing() && ui.preview.anchor) ? ui.preview.anchor[exId] : db.tested[exId]; }
function shownWeeksDone(prog){ return previewing() ? [] : progWeeksDone(prog); }
function shownCurrentWeek(prog){ return previewing() ? 1 : currentWeek(prog); }
/* read-only weeksDone for a day-track WITHIN the active program (per-program progress) */
function progWeeksDone(prog){ var ps = db.programState && db.programState[db.activeProgram]; var d = ps && ps.progress && ps.progress[prog]; return (d && d.weeksDone) || []; }
function currentWeek(prog){
  var wd = progWeeksDone(prog);
  return wd.length ? Math.min(Math.max.apply(null, wd) + 1, activeProg().weeks) : 1;
}
function progEntry(prog, exId){ var P = db.programs[prog]; if(!P) return null; for(var i = 0; i < P.entries.length; i++) if(P.entries[i].exerciseId === exId) return P.entries[i]; return null; }
/* prescription for one entry at a given week. `weight` = the raw prescribed kg (or null for
   untested / timed) — the single source the note-stamp + UI both read, so they can't diverge. */
function prescFor(en, week){
  var ex = exById(en.exerciseId) || {}, tested = shownAnchor(en.exerciseId), side = /leg|arm/.test(ex.defaultUnit || "") ? "/side" : "";
  // home exercises: the dose text IS the prescription (every set by effort, near failure) — no weight maths
  if(en.dose) return { text: en.dose, tested: true, kind: "effort", weight: null };
  // Copenhagen plank: bodyweight hold → progress the HOLD TIME (seconds), no load
  if(en.exerciseId === "copenhagen-plank") return { text: en.sets + " × " + holdSec(week) + " s/side", tested: true, kind: "hold", weight: null };
  // body-weight lift (45° back extension): reps 12–20 (owner 2026-10-17), then an optional plate he types in — no 15RM maths
  if(ex.loadType === "bodyweight"){
    var plate = (tested != null && tested > 0) ? tested : null;
    return plate != null ? { text: "<b>+" + plate + " kg</b> plate · " + en.sets + " × 12–20 reps", tested: true, kind: "bw", weight: plate }
                         : { text: "body weight · " + en.sets + " × 12–20 reps", tested: true, kind: "bw", weight: null };
  }
  // Suitcase carry: a timed carry — its "reps" dimension is TIME, so the seconds climb each week
  // (reps×3 s/arm), then drop when the weight steps up. Same double-progression, shown as time.
  if(en.exerciseId === "suitcase-carry"){
    if(tested == null) return { text: "tap to enter carry weight · " + en.sets + " × ~40 s/arm", tested: false, kind: "heavy", weight: null };
    var cp = ladderFor(tested, ex, shownProg(), shownRateMode())[week];
    return { text: "<b>" + cp.kg + " kg</b> · " + en.sets + " × " + (cp.reps * 3) + " s/arm", tested: true, kind: "heavy", weight: cp.kg, rate: cp.rate };
  }
  // every other loaded lift — gated rep-ladder: reps only drop on a week the weight steps up a full
  // increment, so nothing ever gets easier than the week before (fixes light-lift "easier week 2/3").
  if(tested == null) return { text: "tap to enter your tested 15RM", tested: false, kind: "heavy", weight: null };
  var p = ladderFor(tested, ex, shownProg(), shownRateMode())[week];
  return { text: "<b>" + p.kg + " kg</b> · " + en.sets + " × " + p.reps + side, tested: true, kind: "heavy", weight: p.kg, rate: p.rate };
}
function renderPlan(){
  if(!ui.planProg) ui.planProg = todayProgram() || "strength-a";
  var existingWarm = document.querySelector(".warmSec"); if(existingWarm) ui.warmOpen = existingWarm.open;   /* keep warm-up open across re-renders */
  var prog = ui.planProg, P = db.programs[prog], cur = shownCurrentWeek(prog), done = shownWeeksDone(prog);
  if(!ui.planWeek || ui.planLastProg !== prog){ ui.planWeek = cur; ui.planLastProg = prog; }
  var w = ui.planWeek;
  var h = '<div class="viewH">' + esc(shownProg().name) + ' · ' + shownProg().weeks + '-week plan</div>';
  var dayTab = function(id){ return '<button class="progTab' + (id === prog ? " sel" : "") + '" data-act="prog" data-prog="' + id + '">' + esc(db.programs[id].name) + '</button>'; };
  h += '<div class="progTabs">' + STRENGTH_DAYS.map(dayTab).join("") + '</div>';
  if(typeof HOME_DAYS !== "undefined") h += '<div class="progTabs home">' + HOME_DAYS.filter(function(id){ return !!db.programs[id]; }).map(dayTab).join("") + '</div>';   /* the home days get their own row */
  h += '<div class="weekPick">';
  for(var k = 1, KW = shownProg().weeks; k <= KW; k++){ var dn = done.indexOf(k) >= 0; h += '<button class="wchip' + (k === w ? " sel" : "") + (k === cur ? " cur" : "") + (dn ? " done" : "") + '" data-act="week" data-week="' + k + '">' + k + (dn ? '<span class="wtick">✓</span>' : "") + '</button>'; }
  h += '</div>';
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), liftDone = doneCount(prog, w, liftIds);
  var phaseLbl = shownProg().direction === "reverse" ? "Back-off wave" : phaseForWeek(w);
  /* show which non-default climb-rate is driving the numbers (plateau = default, so no badge — keeps the Plan calm) */
  var rmA = shownRateMode(), rmM = PROGRESSION_MODES[rmA];
  var paceNote = (rmA !== "plateau" && rmM) ? ' · <span style="color:var(--acc)">' + esc(rmM.label) + ' pace</span>' : '';
  if(P.home) h += '<div class="phaseBanner"><div class="phaseName">Week ' + w + (w === cur ? " · current" : "") + ' — Home · <span class="doneCt">' + liftDone + '/' + P.entries.length + ' done</span></div>' +
       '<div class="phaseReps">Every set near failure: holds until your form is about to break; knee work stops 1–2 reps short. No weights to calculate.</div></div>';
  else h += '<div class="phaseBanner"><div class="phaseName">Week ' + w + (w === cur ? " · current" : "") + ' — ' + phaseLbl + ' · <span class="doneCt">' + liftDone + '/' + P.entries.length + ' done</span></div>' +
       '<div class="phaseReps">Reps as on each card · lower in about 3 s, then lift firmly in about 1–2 s, no jerk or bounce · heavy weights are calculated from your tested 15RM' + paceNote + '</div>' +
       '<div class="phaseReps">Still very sore 3+ days after a session? Do 2 sets of everything that day.</div></div>';
  /* ---- warm-up: its own amber-accented block, separated from the lifts, each move tickable, collapsible from the bottom ---- */
  var wu = WARMUP_BY_PROG[prog] || [], wuDone = doneCount(prog, w, wu.map(function(m){ return "wu:" + m.gif; }));
  h += '<details class="warmSec"' + (ui.warmOpen ? " open" : "") + '><summary>🔥 Warm-up · ' + warmTime(prog) + ' · ' + wuDone + '/' + wu.length + '</summary><div class="secBody">' +
       wu.map(function(m){
         var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif", wd = isDone(prog, w, "wu:" + m.gif);
         var fig = m.nopic ? '' : m.pending ? '<div class="exFig pending"><span class="pendTx">📷 Picture to come</span><span class="pendFile">gifs/' + esc(g) + '</span></div>'
                             : '<div class="exFig"><img src="gifs/' + g + '" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
         return '<div class="wuCard' + (wd ? " done" : "") + '"><div class="wuTop"><button class="exTick' + (wd ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="wu:' + m.gif + '" aria-label="mark done">✓</button><div class="wuName">' + esc(m.name) + '</div></div><div class="wuDetail">' + esc(m.detail) + '</div>' + fig + '</div>';
       }).join("") +
       '<button class="warmCollapse" data-act="warmcollapse">▲ Collapse warm-up</button>' +
       '</div></details>';
  h += '<div class="liftsHead">' + liftsWord(prog) + ' · ' + liftDone + '/' + P.entries.length + ' done</div>';
  /* blocks in program order: a lift done alone (solo) · a superset (consecutive entries sharing ss:N, cards
     joined by a connector, tagged NA/NB) · the finishers (block "finisher") · anything else as a plain card */
  var E = P.entries, i = 0;
  while(i < E.length){
    var en = E[i];
    if(en.ss){
      var grp = [], ssN = en.ss;
      while(i < E.length && E[i].ss === ssN){ grp.push(E[i]); i++; }
      var rest = Math.max.apply(null, grp.map(function(g){ return g.restSec || 0; }));
      h += '<div class="ssGroup"><div class="blockHead ssHead"><span class="ssTitle">Superset ' + ssN + '</span>' +
           '<span class="ssHow">1 set of each in turn · ' + grp[0].sets + ' rounds · ~' + fmtMin(rest) + ' before the same lift again</span>' +
           '<span class="ssPair">' + grp.map(function(g, j){ var gx = exById(g.exerciseId) || { name: g.exerciseId }; return '<b>' + ssN + String.fromCharCode(65 + j) + '</b> ' + esc(gx.name); }).join(' <span class="ssArrow">⇄</span> ') + '</span></div>';
      grp.forEach(function(g, j){ if(j > 0) h += '<div class="ssLink" aria-hidden="true"><span>⇅ then</span></div>'; h += planCardHtml(prog, w, g, ssN + String.fromCharCode(65 + j)); });
      h += '</div>';
    } else if(en.solo){
      h += '<div class="soloBlock"><div class="blockHead">Alone · full rest ' + fmtMin(en.restSec) + ' between sets</div>' + planCardHtml(prog, w, en, null) + '</div>';
      i++;
    } else if(en.block === "finisher"){
      var fins = [];
      while(i < E.length && !E[i].ss && !E[i].solo && E[i].block === "finisher"){ fins.push(E[i]); i++; }
      h += '<div class="finBlock"><div class="blockHead">Finishers · last, in this order</div>' + fins.map(function(f){ return planCardHtml(prog, w, f, null); }).join("") + '</div>';
    } else { h += planCardHtml(prog, w, en, null); i++; }
  }
  var weekIsDone = done.indexOf(w) >= 0;
  h += '<div class="btnRow" style="margin:14px 0 6px"><button class="btn primary block" data-act="weekdone" data-prog="' + prog + '" data-week="' + w + '">' +
       (weekIsDone ? "✓ Week " + w + " " + shortName(prog) + " done — tap to undo" : "✓ Mark Week " + w + " " + shortName(prog) + " done") + '</button></div>';
  /* the gym supersets run 2 or 3 rounds (the head of each says which); the home day keeps its own wording */
  var roundsTx = P.home ? "3 rounds" : "as many rounds as the header says";
  h += '<div class="note dim" style="margin:4px 2px">Superset: one set of 1A, then one set of 1B, back to 1A — ' + roundsTx + '. Tick each lift when all its sets are done (top-left ✓) — it collapses to save space and the day count updates. Heavy lifts auto-calculate; tap a weight (✎) to log what you actually lifted. "+ note" logs go to the Notes tab.</div>';
  if(previewing()){
    h = '<div class="previewBar">👀 Previewing <b>' + esc(shownProg().name) + '</b> from your current strength — not your active program yet.' +
        '<div class="btnRow" style="margin-top:8px"><button class="btn sm" data-act="previewreturn">↩ Return</button>' +
        '<button class="btn primary sm" data-act="previewstart" data-prog="' + esc(shownProgramId()) + '">🏋 Start training</button></div></div>' + h;
  }
  $("#view-programs").innerHTML = h;
  updateNextBar(prog, w);
}
/* one lift's card. `tag` = its superset slot ("1A", "1B" …) or null */
function planCardHtml(prog, w, en, tag){
  var ex = exById(en.exerciseId) || { name: en.exerciseId }, pr = prescFor(en, w), tappable = (pr.kind !== "timed" && pr.kind !== "hold" && pr.kind !== "effort"), st = doneState(prog, w, en.exerciseId), exd = !!st, hist = historyFor(en.exerciseId), lt = hist.length ? hist[hist.length - 1] : null;
  return '<div class="planCard' + (pr.tested ? "" : " untested") + (exd ? " done" : "") + (st === "partial" ? " partial" : "") + '"><div class="planTop"><div class="ptL"><button class="exTick' + (st === "full" ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + en.exerciseId + '" aria-label="done — full">✓</button><button class="exTick partial' + (st === "partial" ? " on" : "") + '" data-act="partialtick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + en.exerciseId + '" aria-label="done — partial" title="did it, but not fully">◐</button>' + (tag ? '<span class="ssTag">' + tag + '</span>' : '') + '<div class="exName">' + esc(ex.name) + '</div></div><span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + en.block + '</span></div>' +
    '<div class="planBody"><div class="planPresc' + (tappable ? ' tap" data-act="setw" data-ex="' + en.exerciseId + '" data-kind="' + pr.kind + '"' : '"') + '>' + pr.text + (pr.rate === "push" ? ' <span class="rateTag" style="color:var(--acc);font-size:11px" title="pushing harder — stuck adding reps">↑</span>' : pr.rate === "ease" ? ' <span class="rateTag" style="color:var(--dim);font-size:11px" title="easing — paying back the push">↓</span>' : '') + (tappable ? ' <span class="editi">✎</span>' : '') + '</div>' +
    (lt ? '<div class="lastTime">last time: <b>' + lt.kg + ' kg</b> · ' + esc(timeAgo(lt.ts)) + (lt.quality === "partial" ? ' <span class="ltPartial">partial</span>' : '') + '</div>' : '') +
    /* ramp-up (owner 2026-10-13: the minimum): only the split squat and the deadlift, only in weeks where THAT lift's own reps are 11 or fewer
       (2026-10-17: its own window, so the deadlift's 10-rep start shows the tip from week 1) */
    (en.ramp && clampReps(repForWeekIn(shownProg(), w), ex) <= 11 ? '<div class="rampTip">↗ Ramp-up first: 1 light set, about half the weight, 6–8 reps</div>' : '') +
    gifHtml(en.exerciseId) + howToHtml(en.exerciseId) +
    (hist.length >= 2 ? '<details class="prog"><summary>📈 Progress · ' + hist.length + ' sessions</summary><div class="progBody">' + progHtml(hist) + '</div></details>' : '') +
    '<button class="noteBtn" data-act="note" data-ex="' + en.exerciseId + '">+ note</button>' +
    (pr.kind !== "hold" && pr.kind !== "bw" && pr.kind !== "effort" ? '<button class="stepBtn" data-act="setstep" data-ex="' + en.exerciseId + '" title="smallest weight jump for this lift">⚙ ' + esc(stepLabel(ex)) + '</button>' : '') +
    '</div></div>';
}
/* update the done counts in place (no full re-render) so a tick can animate the card collapse */
function updateDoneCounts(prog, week){
  var P = db.programs[prog]; if(!P) return;
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), n = doneCount(prog, week, liftIds), total = P.entries.length;
  var ct = document.querySelector("#view-programs .phaseName .doneCt"); if(ct) ct.textContent = n + "/" + total + " done";
  var lh = document.querySelector("#view-programs .liftsHead"); if(lh) lh.textContent = liftsWord(prog) + " · " + n + "/" + total + " done";
  var wu = WARMUP_BY_PROG[prog] || [], wn = doneCount(prog, week, wu.map(function(m){ return "wu:" + m.gif; }));
  var ws = document.querySelector("#view-programs .warmSec > summary"); if(ws) ws.textContent = "🔥 Warm-up · " + warmTime(prog) + " · " + wn + "/" + wu.length;
}

/* ---------- "next exercise" jump bar (the floating #nextBar above the tab bar) ---------- */
/* first main lift (program order) not yet ticked done this week; null once every lift is done */
function nextUndoneLift(prog, week){
  var P = db.programs[prog]; if(!P) return null;
  for(var i = 0; i < P.entries.length; i++){ var id = P.entries[i].exerciseId; if(!isDone(prog, week, id)) return id; }
  return null;
}
/* refresh the floating jump bar for the shown day-track; hidden while previewing (can't log) */
function updateNextBar(prog, week){
  var bar = $("#nextBar"); if(!bar) return;
  if(previewing()){ bar.hidden = true; bar.innerHTML = ""; return; }
  var nextId = nextUndoneLift(prog, week);
  if(nextId){
    var ex = exById(nextId) || { name: nextId };
    bar.innerHTML = '<button class="nextBtn" data-act="nextex" data-ex="' + esc(nextId) + '"><span class="nextLbl">Next</span><span class="nextNm">' + esc(ex.name) + '</span><span class="nextArrow">↓</span></button>';
  } else {
    bar.innerHTML = '<button class="nextBtn done" data-act="nextex" data-ex=""><span class="nextLbl">✓ All lifts done</span><span class="nextNm">Finish the week</span><span class="nextArrow">↓</span></button>';
  }
  bar.hidden = false;
}
/* scroll the next lift (or the week-finish button) into view + flash it */
function flashCard(el){
  if(!el) return;
  el.classList.remove("flash"); void el.offsetWidth;   /* restart the animation on repeat taps */
  el.classList.add("flash");
  setTimeout(function(){ el.classList.remove("flash"); }, 1100);
}
function jumpToNext(exId){
  var target;
  if(exId){ var tk = $('.exTick[data-item="' + exId + '"]'); target = tk ? tk.closest(".planCard") : null; }
  else { target = $('[data-act="weekdone"]'); }
  if(!target) return;
  if(target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
  flashCard(target);
}
/* per-lift progress: a tiny inline-SVG sparkline of kg over the diary — amber point = partial, ringed = best */
function progHtml(hist){
  if(hist.length < 2) return "";
  var kgs = hist.map(function(h){ return h.kg; }), min = Math.min.apply(null, kgs), max = Math.max.apply(null, kgs), span = (max - min) || 1;
  var W = 280, H = 54, pad = 9, n = hist.length, X = function(i){ return pad + i * (W - 2 * pad) / (n - 1); }, Y = function(kg){ return H - pad - (kg - min) / span * (H - 2 * pad); };
  var pts = hist.map(function(h, i){ return X(i).toFixed(1) + "," + Y(h.kg).toFixed(1); }).join(" ");
  var dots = hist.map(function(h, i){ var b = h.kg === max; return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(h.kg).toFixed(1) + '" r="' + (b ? 4 : 3) + '" fill="' + (h.quality === "partial" ? "var(--warn)" : "var(--acc)") + '"' + (b ? ' stroke="var(--tx)" stroke-width="1"' : '') + '></circle>'; }).join("");
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="spark"><polyline points="' + pts + '" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"></polyline>' + dots + '</svg>' +
    '<div class="progSum">' + hist[0].kg + ' kg <span class="progArrow">→</span> <b class="accT">' + hist[n - 1].kg + ' kg</b><span class="progDim"> · ⭐ best ' + max + ' kg</span></div>';
}
