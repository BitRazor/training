"use strict";
/* training-tracker — the 12-week Plan view. Two independent program tracks (Lower / Upper),
   each with its own week picker + manual mark-done. Heavy lifts show algorithm-calculated
   weights (tested 15RM → +1%/week → rep-max %); tap a weight to log what you actually lifted
   and the rest of the block recomputes. Uses seed math (calcWeight/repForWeek/...) + howToHtml/gifHtml. */

function shortName(prog){ return prog === "strength-a" ? "Lower" : "Upper"; }
function todayProgram(){ var t = CURRENT_WEEK[weekdayIdx()]; return (t && t.type === "strength") ? t.ref : null; }
function activeProg(){ return getProgram(db.activeProgram); }
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
  var ex = exById(en.exerciseId) || {}, tested = db.tested[en.exerciseId], side = /leg|arm/.test(ex.defaultUnit || "") ? "/side" : "";
  // Copenhagen plank: bodyweight hold → progress the HOLD TIME (seconds), no load
  if(en.exerciseId === "copenhagen-plank") return { text: en.sets + " × " + holdSec(week) + " s/side", tested: true, kind: "hold", weight: null };
  // Suitcase carry: a timed carry — its "reps" dimension is TIME, so the seconds climb each week
  // (reps×3 s/arm), then drop when the weight steps up. Same double-progression, shown as time.
  if(en.exerciseId === "suitcase-carry"){
    if(tested == null) return { text: "tap to enter carry weight · " + en.sets + " × ~40 s/arm", tested: false, kind: "heavy", weight: null };
    var cp = ladderFor(tested, ex, activeProg())[week];
    return { text: "<b>" + cp.kg + " kg</b> · " + en.sets + " × " + (cp.reps * 3) + " s/arm", tested: true, kind: "heavy", weight: cp.kg };
  }
  // every other loaded lift — gated rep-ladder: reps only drop on a week the weight steps up a full
  // increment, so nothing ever gets easier than the week before (fixes light-lift "easier week 2/3").
  if(tested == null) return { text: "tap to enter your tested 15RM", tested: false, kind: "heavy", weight: null };
  var p = ladderFor(tested, ex, activeProg())[week];
  return { text: "<b>" + p.kg + " kg</b> · " + en.sets + " × " + p.reps + side, tested: true, kind: "heavy", weight: p.kg };
}
function renderPlan(){
  if(!ui.planProg) ui.planProg = todayProgram() || "strength-a";
  var existingWarm = document.querySelector(".warmSec"); if(existingWarm) ui.warmOpen = existingWarm.open;   /* keep warm-up open across re-renders */
  var prog = ui.planProg, P = db.programs[prog], cur = currentWeek(prog), done = progWeeksDone(prog);
  if(!ui.planWeek || ui.planLastProg !== prog){ ui.planWeek = cur; ui.planLastProg = prog; }
  var w = ui.planWeek;
  var h = '<div class="viewH">' + esc(activeProg().name) + ' · ' + activeProg().weeks + '-week plan</div>';
  h += '<div class="progTabs">' + STRENGTH_DAYS.map(function(id){ return '<button class="progTab' + (id === prog ? " sel" : "") + '" data-act="prog" data-prog="' + id + '">' + esc(db.programs[id].name) + '</button>'; }).join("") + '</div>';
  h += '<div class="weekPick">';
  for(var k = 1, KW = activeProg().weeks; k <= KW; k++){ var dn = done.indexOf(k) >= 0; h += '<button class="wchip' + (k === w ? " sel" : "") + (k === cur ? " cur" : "") + (dn ? " done" : "") + '" data-act="week" data-week="' + k + '">' + k + (dn ? '<span class="wtick">✓</span>' : "") + '</button>'; }
  h += '</div>';
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), liftDone = doneCount(prog, w, liftIds);
  var phaseLbl = activeProg().direction === "reverse" ? "Back-off wave" : phaseForWeek(w);
  h += '<div class="phaseBanner"><div class="phaseName">Week ' + w + (w === cur ? " · current" : "") + ' — ' + phaseLbl + ' · <span class="doneCt">' + liftDone + '/' + P.entries.length + ' done</span></div>' +
       '<div class="phaseReps">Target ' + repForWeekIn(activeProg(), w) + ' reps · 3·3 tempo (calves 3·3·3) · heavy weights are calculated from your tested 15RM</div></div>';
  /* ---- warm-up: its own amber-accented block, separated from the lifts, each move tickable, collapsible from the bottom ---- */
  var wu = WARMUP_BY_PROG[prog] || [], wuDone = doneCount(prog, w, wu.map(function(m){ return "wu:" + m.gif; }));
  h += '<details class="warmSec"' + (ui.warmOpen ? " open" : "") + '><summary>🔥 Warm-up · ~8–10 min · ' + wuDone + '/' + wu.length + '</summary><div class="secBody">' +
       wu.map(function(m){
         var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif", wd = isDone(prog, w, "wu:" + m.gif);
         return '<div class="wuCard' + (wd ? " done" : "") + '"><div class="wuTop"><button class="exTick' + (wd ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="wu:' + m.gif + '" aria-label="mark done">✓</button><div class="wuName">' + esc(m.name) + '</div></div><div class="wuDetail">' + esc(m.detail) + '</div><div class="exFig"><img src="gifs/' + g + '" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div></div>';
       }).join("") +
       '<button class="warmCollapse" data-act="warmcollapse">▲ Collapse warm-up</button>' +
       '</div></details>';
  h += '<div class="liftsHead">Main lifts · ' + liftDone + '/' + P.entries.length + ' done</div>';
  P.entries.forEach(function(en){
    var ex = exById(en.exerciseId) || { name: en.exerciseId }, pr = prescFor(en, w), tappable = (pr.kind !== "timed" && pr.kind !== "hold"), exd = isDone(prog, w, en.exerciseId);
    h += '<div class="planCard' + (pr.tested ? "" : " untested") + (exd ? " done" : "") + '"><div class="planTop"><div class="ptL"><button class="exTick' + (exd ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + en.exerciseId + '" aria-label="mark done">✓</button><div class="exName">' + esc(ex.name) + '</div></div><span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + en.block + '</span></div>' +
         '<div class="planBody"><div class="planPresc' + (tappable ? ' tap" data-act="setw" data-ex="' + en.exerciseId + '" data-kind="' + pr.kind + '"' : '"') + '>' + pr.text + (tappable ? ' <span class="editi">✎</span>' : '') + '</div>' +
         gifHtml(en.exerciseId) + howToHtml(en.exerciseId) +
         '<button class="noteBtn" data-act="note" data-ex="' + en.exerciseId + '">+ note</button>' +
         (pr.kind !== "hold" ? '<button class="stepBtn" data-act="setstep" data-ex="' + en.exerciseId + '" title="smallest weight jump for this lift">⚙ ' + esc(stepLabel(ex)) + '</button>' : '') +
         '</div></div>';
  });
  var weekIsDone = done.indexOf(w) >= 0;
  h += '<div class="btnRow" style="margin:14px 0 6px"><button class="btn primary block" data-act="weekdone" data-prog="' + prog + '" data-week="' + w + '">' +
       (weekIsDone ? "✓ Week " + w + " " + shortName(prog) + " done — tap to undo" : "✓ Mark Week " + w + " " + shortName(prog) + " done") + '</button></div>';
  h += '<div class="note dim" style="margin:4px 2px">Tick each lift as you finish it (top-left ✓) — it collapses to save space and the day count updates. Heavy lifts auto-calculate; tap a weight (✎) to log what you actually lifted. "+ note" logs go to the Notes tab.</div>';
  $("#view-programs").innerHTML = h;
}
/* update the done counts in place (no full re-render) so a tick can animate the card collapse */
function updateDoneCounts(prog, week){
  var P = db.programs[prog]; if(!P) return;
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), n = doneCount(prog, week, liftIds), total = P.entries.length;
  var ct = document.querySelector("#view-programs .phaseName .doneCt"); if(ct) ct.textContent = n + "/" + total + " done";
  var lh = document.querySelector("#view-programs .liftsHead"); if(lh) lh.textContent = "Main lifts · " + n + "/" + total + " done";
  var wu = WARMUP_BY_PROG[prog] || [], wn = doneCount(prog, week, wu.map(function(m){ return "wu:" + m.gif; }));
  var ws = document.querySelector("#view-programs .warmSec > summary"); if(ws) ws.textContent = "🔥 Warm-up · ~8–10 min · " + wn + "/" + wu.length;
}
