"use strict";
/* training-tracker — the Workout screen (view id "programs"; it was "the Plan" in version 1).
   Two independent program tracks (Day A / Day B, blended full-body days since 2026-10-13) plus the two home days,
   each with its own week counter and manual Finish. Heavy lifts show algorithm-calculated weights (tested 15RM →
   +1%/week → rep-max %); tap a weight to log what you actually lifted and the rest of the block recomputes.
   Lifts render in blocks: done alone (solo), supersets (ss:N, a violet rail, tagged 1A/1B), finishers.
   Version 2 (2026-11-04): a sticky session header (day, week sheet, elapsed time, progress bar), a segmented day
   switcher, one quiet phase line with an info sheet, set rows with 56 dp ticks (tracker-session.js), action chips
   and an exercise sheet (tracker-progress.js). The v1 hooks stay (.planCard, .exName, .exTick, .planPresc, …). */

/* a workout's name on every screen: his own name, else "Day A" / "Day B" / "Home · <its weekday>" (tracker-week.js) */
function shortName(prog){ return dayName(prog); }
function isHomeDay(prog){ return typeof HOME_DAYS !== "undefined" && HOME_DAYS.indexOf(prog) >= 0; }
/* rest seconds → "2.5 min" / "1.5 min" / "1 min" */
function fmtMin(sec){ return (Math.round((sec || 0) / 6) / 10) + " min"; }
/* warm-up length shown in its head, per day ("~10 min" gym, shorter at home) */
function warmTime(prog){ return (typeof WARMUP_TIME !== "undefined" && WARMUP_TIME[prog]) || "~10 min"; }
/* the lifts heading word: "Main lifts" in the gym, "Exercises" at home */
function liftsWord(prog){ var P = db.programs[prog]; return (P && P.home) ? "Exercises" : "Main lifts"; }
/* the day-track for today in his week schedule: a gym or home day, or the home session riding on a cardio day */
function todayProgram(){ var t = weekPlan()[weekdayIdx()]; if(!t) return null; if(t.type === "strength" || t.type === "home") return t.ref; return t.home || null; }
function activeProg(){ return getProgram(db.activeProgram); }
/* the active program's chosen climb-rate mode (forward only); defaults to plateau (= current behavior) */
function activeRateMode(){ var ps = db.programState && db.programState[db.activeProgram]; return (ps && ps.rateMode) || DEFAULT_RATE_MODE; }
/* ---- what the Workout currently SHOWS: the committed active program, OR a transient "just looking" PREVIEW.
   While previewing, it renders the previewed program from its CARRIED anchor as a FRESH start
   (week 1, nothing done) — Today + db are untouched, and it auto-reverts on leaving the Workout. ---- */
function previewing(){ return !!(ui.preview && ui.preview.program); }
function shownProgramId(){ return previewing() ? ui.preview.program : db.activeProgram; }
function shownProg(){ return getProgram(shownProgramId()); }
function shownRateMode(){ var ps = db.programState && db.programState[shownProgramId()]; return (ps && ps.rateMode) || DEFAULT_RATE_MODE; }
function shownAnchor(exId){ return (previewing() && ui.preview.anchor) ? ui.preview.anchor[exId] : db.tested[exId]; }
function shownWeeksDone(prog){ return previewing() ? [] : progWeeksDone(prog); }
function shownCurrentWeek(prog){ return previewing() ? 1 : currentWeek(prog); }
/* read-only weeksDone for a day-track WITHIN the active program (per-program progress) */
function progWeeksDone(prog){ var ps = db.programState && db.programState[db.activeProgram]; var d = ps && ps.progress && ps.progress[prog]; return (d && d.weeksDone) || []; }
/* the week a day-track is on: after the last finished one; a 12-week program stops at its last week, a smart program runs
   on (2026-11-11: week 13 after week 12, suggestions keep coming) */
function currentWeek(prog){
  var wd = progWeeksDone(prog), P = activeProg();
  if(!wd.length) return 1;
  var nx = Math.max.apply(null, wd) + 1;
  return P.smart ? nx : Math.min(nx, P.weeks);
}
/* "Week 3 of 12" for a 12-week program, "Week 13" for a smart one (it runs on) */
function weekOfText(w){ return "Week " + w + (activeProg().smart ? "" : " of " + TOTAL_WEEKS); }
/* a day-track's finished weeks on a bar: "5/12"; a smart program past its 12: "13 weeks" with the bar full */
function weeksDoneText(n, P){ return (P.smart && n > P.weeks) ? n + " weeks" : n + "/" + P.weeks; }
function weeksDonePct(n, P){ return Math.min(100, Math.round(n / P.weeks * 100)); }
function progEntry(prog, exId){ var P = db.programs[prog]; if(!P) return null; for(var i = 0; i < P.entries.length; i++) if(P.entries[i].exerciseId === exId) return P.entries[i]; return null; }
/* prescription for one entry at a given week. `weight` = the raw prescribed kg (or null for
   untested / timed) — the single source the note-stamp + UI both read, so they can't diverge. */
function prescFor(en, week, prog){
  /* Part 2: a smart program prescribes from the lift's current target (tracker-smart.js), not from the week */
  if(typeof smartOn === "function" && smartOn()) return smartPresc(en, prog, week);
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
/* one set's target, short, for the set rows and a collapsed card: "75 kg × 10", "16 kg × 45 s/arm",
   "+5 kg × 12–20", "BW × 12–20", "20 s/side"; "" for the home doses (the dose text above says it all) */
function setTargetText(en, week, prog){
  if(typeof smartOn === "function" && smartOn()) return smartSetText(prog, week, en, 0);   /* Part 2: the target (or today's weight used) */
  var ex = exById(en.exerciseId) || {}, t = shownAnchor(en.exerciseId), side = /leg|arm/.test(ex.defaultUnit || "") ? "/side" : "";
  if(en.dose) return "";
  if(en.exerciseId === "copenhagen-plank") return holdSec(week) + " s/side";
  if(ex.loadType === "bodyweight") return ((t != null && t > 0) ? "+" + t + " kg" : "BW") + " × 12–20";
  if(t == null) return "";
  var p = ladderFor(t, ex, shownProg(), shownRateMode())[week];
  if(en.exerciseId === "suitcase-carry") return p.kg + " kg × " + (p.reps * 3) + " s/arm";
  return p.kg + " kg × " + p.reps + side;
}
/* the day's blocks in program order, the one place that groups them (render, rest timer, Next):
   {kind:"ss", n, entries} consecutive entries sharing ss:N · {kind:"solo", entries:[en]} · {kind:"fin", entries}
   (consecutive finishers) · {kind:"plain", entries:[en]} */
function blocksFor(prog){
  var E = (db.programs[prog] || {}).entries || [], out = [], i = 0;
  while(i < E.length){
    var en = E[i];
    if(en.ss){ var g = [], n = en.ss; while(i < E.length && E[i].ss === n){ g.push(E[i]); i++; } out.push({ kind: "ss", n: n, entries: g }); }
    else if(en.solo){ out.push({ kind: "solo", entries: [en] }); i++; }
    else if(en.block === "finisher"){ var f = []; while(i < E.length && !E[i].ss && !E[i].solo && E[i].block === "finisher"){ f.push(E[i]); i++; } out.push({ kind: "fin", entries: f }); }
    else { out.push({ kind: "plain", entries: [en] }); i++; }
  }
  return out;
}
/* the block a lift sits in: {kind, n, entries, idx (its place in the block), entry, tag ("1A" … or null)} */
function blockOf(prog, exId){
  var B = blocksFor(prog);
  for(var b = 0; b < B.length; b++) for(var j = 0; j < B[b].entries.length; j++) if(B[b].entries[j].exerciseId === exId)
    return { kind: B[b].kind, n: B[b].n, entries: B[b].entries, idx: j, entry: B[b].entries[j], tag: B[b].kind === "ss" ? B[b].n + String.fromCharCode(65 + j) : null };
  return null;
}

/* ---------- pictures: a thumbnail on the card, the big one in the sheets ---------- */
function thumbHtml(exId){
  var pend = (typeof pendingPic === "function") ? pendingPic(exId) : EX_GIF_PENDING[exId];   /* his rule: only his checked pictures (tracker-catalog.js) */
  if(pend) return '<div class="exFig pending" title="Picture to come: gifs/' + esc(pend) + '.gif">' + icon("camera") + '<span class="pendSoon" aria-hidden="true">soon</span><span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(pend) + '.gif</span></div>';
  var g = EX_GIF[exId]; if(!g) return '<div class="thumbNone">' + icon("dumbbell") + '</div>';
  return '<div class="exFig"><img src="gifs/' + g + '.gif" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
}

/* ---------- the Workout ---------- */
/* the warm-up of a day: its own list; a day of his own program gets the shared gym warm-up (Part 2) */
function warmupFor(prog){ return (typeof WARMUP_BY_PROG !== "undefined" && WARMUP_BY_PROG[prog]) || ((typeof isOwnDay === "function" && isOwnDay(prog)) ? WARMUP_SHARED : []); }
/* the gym days the Workout shows: the shown program's days (Part 2: his programs have their own) */
function shownDays(){ var P = shownProg(); return (P && Array.isArray(P.days) && P.days.length) ? P.days : STRENGTH_DAYS; }
function renderPlan(){
  var sd = shownDays(), td = todayProgram();
  if(!ui.planProg || !db.programs[ui.planProg] || (sd.indexOf(ui.planProg) < 0 && !isHomeDay(ui.planProg))){ ui.planProg = (td && db.programs[td] && (sd.indexOf(td) >= 0 || isHomeDay(td))) ? td : sd[0]; ui.planWeek = null; }
  var existingWarm = document.querySelector(".warmSec"); if(existingWarm) ui.warmOpen = existingWarm.open;   /* keep warm-up open across re-renders */
  var prog = ui.planProg, P = db.programs[prog], cur = shownCurrentWeek(prog), done = shownWeeksDone(prog);
  if(!ui.planWeek || ui.planLastProg !== prog){ ui.planWeek = cur; ui.planLastProg = prog; }
  var w = ui.planWeek, SP = shownProg();
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), liftDone = doneCount(prog, w, liftIds);
  var h = '';
  if(previewing()){
    h += '<div class="previewBar">' + icon("info") + '<div><b>Previewing ' + esc(SP.name) + '</b> from your current strength. It is not your program yet.' +
      '<div class="btnRow"><button class="btn sm" data-act="previewreturn">' + icon("undo") + 'Return</button>' +
      '<button class="btn primary sm" data-act="previewstart" data-prog="' + esc(shownProgramId()) + '">' + icon("play") + 'Start training</button></div></div></div>';
  }
  h += mainHead("Workout", esc(SP.name) + " · " + SP.weeks + " weeks");
  /* sticky session header: the day (tap to rename it), the week sheet, the workout clock once a set is ticked (tap:
     stop or reset it, tracker-session.js), lifts done of total */
  h += '<div class="sessHead"><div class="shRow"><button class="shDay" data-act="rename" data-prog="' + prog + '" title="Rename this workout"><span class="shName">' + esc(shortName(prog)) + '</span>' + icon("edit", "sm shEdit") + '</button>' +
    '<button class="shWeek" data-act="weeksheet" aria-label="Pick a week">Week ' + w + icon("chevD", "sm") + '</button>' +
    '<button class="shTime" data-act="clocksheet" title="Workout clock" hidden>' + icon("timer", "sm icRun") + icon("stop", "sm icStop") + '<span class="shClock"></span></button>' +
    /* 2026-11-12 (his "Build them now"): start the clock before the first set; the first tick still starts it when this was not used */
    '<button class="btn sm shStart" data-act="sessstart" hidden>' + icon("timer", "sm") + 'Start session</button></div>' +
    '<div class="bar shBar"><i style="width:' + Math.round(liftDone / (P.entries.length || 1) * 100) + '%"></i></div></div>';
  /* the day switcher: one segmented control, the home days grouped at its end (a home tab: his name for it, else the
     weekday it sits on in his week) */
  var dayTab = function(id){ var home = isHomeDay(id);
    return '<button class="progTab' + (id === prog ? " sel" : "") + '" data-act="prog" data-prog="' + id + '">' + (home ? icon("house", "sm") + '<span class="sr">Home </span>' : '') + '<span class="ptName">' + esc(home ? homeTabLabel(id) : shortName(id)) + '</span></button>'; };
  h += '<div class="daySwitch"><div class="progTabs">' + shownDays().map(dayTab).join("") + '</div>' +
    (typeof HOME_DAYS !== "undefined" ? '<div class="progTabs home">' + HOME_DAYS.filter(function(id){ return !!db.programs[id]; }).map(dayTab).join("") + '</div>' : '') + '</div>';
  /* one quiet phase line; the speed rule in full and the soreness rule sit behind the i chip */
  var rmA = shownRateMode(), rmM = PROGRESSION_MODES[rmA], smart = SP.smart === true;
  var paceNote = (!smart && rmA !== "plateau" && rmM) ? ' · <span class="accT">' + esc(rmM.label) + ' pace</span>' : '';
  var phaseLbl = smart ? "Smart" : SP.direction === "reverse" ? "Back-off wave" : phaseForWeek(w);
  h += '<div class="phaseBanner' + (P.home ? " home" : "") + '"><div class="phaseTx"><div class="phaseName"><b>' + (P.home ? "Home" : esc(phaseLbl)) + '</b> · <span class="doneCt">' + liftDone + '/' + P.entries.length + ' done</span>' + paceNote + '</div>' +
    '<div class="phaseCue">' + (P.home ? "Every set near failure · no weights to calculate" : "Lower 3 s · lift firmly 1–2 s · no bounce") + '</div></div>' +
    '<button class="iChip" data-act="phaseinfo" aria-label="About this week">' + icon("info") + '</button></div>';
  /* Part 2: every waiting suggestion of this day at once (tracker-smart.js) */
  var waiting = (smart && !previewing()) ? pendingOn(prog, w).length : 0;
  if(waiting) h += '<button class="btn tonal block sugAll" data-act="suguseall">' + icon("check") + 'Use all suggestions (' + waiting + ')</button>';
  /* ---- warm-up: its own amber card, a row per move (picture, name, detail, tick), collapsible from the bottom ---- */
  var wu = warmupFor(prog), wuDone = doneCount(prog, w, wu.map(function(m){ return "wu:" + m.gif; }));
  h += '<details class="warmSec"' + (ui.warmOpen ? " open" : "") + '><summary><span class="wuIc">' + icon("flame") + '</span><span class="wuHead">Warm-up · ' + warmTime(prog) + ' · ' + wuDone + '/' + wu.length + '</span>' + icon("chevD", "wuChev") + '</summary><div class="secBody">' +
       wu.map(function(m){
         var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif", wd = isDone(prog, w, "wu:" + m.gif);
         var fig = m.nopic ? '' : m.pending ? '<button class="wuThumb" data-act="pic" data-wu="' + esc(m.gif) + '"><div class="exFig pending">' + icon("camera") + '<span class="pendSoon" aria-hidden="true">soon</span><span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(g) + '</span></div></button>'
                             : '<button class="wuThumb" data-act="pic" data-wu="' + esc(m.gif) + '"><div class="exFig"><img src="gifs/' + g + '" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div></button>';
         return '<div class="wuCard' + (wd ? " done" : "") + (m.nopic ? " nopic" : "") + '">' + fig + '<div class="wuTx"><div class="wuName">' + esc(m.name) + '</div><div class="wuDetail">' + esc(m.detail) + '</div></div>' +
           '<button class="exTick wuTick' + (wd ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="wu:' + m.gif + '" aria-label="mark done">' + icon("check") + '</button></div>';
       }).join("") +
       '<button class="warmCollapse" data-act="warmcollapse">' + icon("chevU", "sm") + 'Collapse warm-up</button>' +
       '</div></details>';
  h += '<div class="liftsHead">' + liftsWord(prog) + ' · ' + liftDone + '/' + P.entries.length + ' done</div>';
  /* blocks in program order: a lift done alone (solo) · a superset (a violet rail, tagged NA/NB, a "then" link
     between the cards) · the finishers (block "finisher") · anything else as a plain card */
  blocksFor(prog).forEach(function(b){
    if(b.kind === "ss"){
      /* the head says the rest rule (tracker-session.js restPlan): the round's rest split evenly between the lifts (at least
         30 s), and the round starts again once 1A has had its own rest (2026-11-12, his "between next exercises should be
         enough to get breath back") */
      var grp = b.entries, ssN = b.n, betweenS = grp[1] ? splitRestFor(prog, w, grp[0].exerciseId, grp[1].exerciseId) : BREATH_SEC;
      h += '<div class="ssGroup"><div class="blockHead ssHead"><span class="ssTitle">Superset ' + ssN + '</span>' +
           '<span class="ssHow">' + grp[0].sets + ' rounds · ~' + betweenS + ' s between · ' + ssN + 'A again after ' + fmtMin(restSecondsFor(prog, grp[0].exerciseId)) + '</span>' +
           '<span class="ssPair">' + grp.map(function(g, j){ var gx = exById(g.exerciseId) || { name: g.exerciseId }; return '<b>' + ssN + String.fromCharCode(65 + j) + '</b> ' + esc(gx.name); }).join(' <span class="ssArrow">⇄</span> ') + '</span></div>';
      grp.forEach(function(g, j){ if(j > 0) h += '<div class="ssLink" aria-hidden="true"><span>' + icon("arrowDown", "sm") + 'then ' + ssN + String.fromCharCode(65 + j) + '</span></div>'; h += planCardHtml(prog, w, g, ssN + String.fromCharCode(65 + j)); });
      h += '</div>';
    } else if(b.kind === "solo"){
      h += '<div class="soloBlock"><div class="blockHead">Alone · full rest ' + fmtMin(b.entries[0].restSec) + ' between sets</div>' + planCardHtml(prog, w, b.entries[0], null) + '</div>';
    } else if(b.kind === "fin"){
      h += '<div class="finBlock"><div class="blockHead">Finishers · last, in this order</div>' + b.entries.map(function(f){ return planCardHtml(prog, w, f, null); }).join("") + '</div>';
    } else h += planCardHtml(prog, w, b.entries[0], null);
  });
  var weekIsDone = done.indexOf(w) >= 0;
  h += '<div class="finishRow"><button class="btn ' + (weekIsDone ? "tonal" : "primary") + ' big block" data-act="weekdone" data-prog="' + prog + '" data-week="' + w + '">' +
       (weekIsDone ? icon("check") + "Week " + w + " · " + esc(shortName(prog)) + " finished · tap to reopen" : icon("trophy") + "Finish week " + w + " · " + esc(shortName(prog))) + '</button></div>';
  /* the gym supersets run 2 or 3 rounds (the head of each says which); the home day keeps its own wording */
  var roundsTx = P.home ? "3 rounds" : "as many rounds as the header says";
  h += '<div class="note footNote">Superset: one set of 1A, then one set of 1B, back to 1A — ' + roundsTx + '. Tick each lift\'s sets as you go: the rest timer starts, and the card folds away after its last set. ' +
    (smart ? 'A tick means you did the target; tap a set\'s reps to log more or fewer, and the weight to log what you really lifted. After the last set, tap how it felt: Easy, Smooth, Solid or Hard.' :'Heavy lifts auto-calculate; tap a weight to log what you actually lifted.') + ' Notes collect on the Notes page.</div>';
  $("#view-programs").innerHTML = h;
  updateNextBar(prog, w);
  if(typeof refreshSessionUi === "function") refreshSessionUi();
}
/* one lift's card. `tag` = its superset slot ("1A", "1B" …) or null */
function planCardHtml(prog, w, en, tag){
  var exId = en.exerciseId, ex = exById(exId) || { name: exId }, pr = prescFor(en, w, prog), tappable = (pr.kind !== "timed" && pr.kind !== "hold" && pr.kind !== "effort");
  var st = doneState(prog, w, exId), exd = !!st, hist = historyFor(exId), lt = hist.length ? hist[hist.length - 1] : null;
  var smart = !!pr.smart, ticks = setTicks(prog, w, exId), tgt = smart ? smartDoneText(prog, w, en) : setTargetText(en, w), home = !!en.dose;
  var note = latestNoteFor(exId), rng = smart ? smartRangeText(en) : "", sug = smart ? sugLineHtml(prog, w, en) : "";
  /* the ramp-up tip: a smart lift's own target reps, else the week's ladder reps */
  var rampReps = smart ? pr.reps : clampReps(repForWeekIn(shownProg(), w), ex);
  var rate = pr.rate === "push" ? '<span class="rateTag up" title="pushing harder — stuck adding reps">' + icon("arrowUp", "sm") + '</span>' : pr.rate === "ease" ? '<span class="rateTag down" title="easing — paying back the push">' + icon("arrowDown", "sm") + '</span>' : '';
  var h = '<div class="planCard' + (pr.tested ? "" : " untested") + (exd ? " done" : "") + (st === "partial" ? " partial" : "") + (home ? " homeCard" : "") + '">' +
    '<div class="planTop"><button class="exThumb" data-act="exsheet" data-ex="' + exId + '" aria-label="' + esc(ex.name) + ': picture and how-to">' + thumbHtml(exId) + '</button>' +
    '<div class="ptMain" data-act="peek"><div class="ptMeta">' + (tag ? '<span class="ssTag">' + tag + '</span>' : '') + '<span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + en.block + '</span></div>' +
    '<div class="exName">' + esc(ex.name) + '</div><div class="doneLine">' + esc(tgt) + '</div></div>' +
    '<div class="ptL"><button class="exTick partial' + (st === "partial" ? " on" : "") + '" data-act="partialtick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + exId + '" aria-label="done — partial" title="did it, but not fully">' + icon("half") + '</button>' +
    '<button class="exTick' + (st === "full" ? " on" : "") + '" data-act="donetick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + exId + '" aria-label="done — full (all sets)">' + icon("check") + '</button></div></div>' +
    (smart ? effortRowHtml(prog, w, en) : '') +   /* rule version 3: Easy · Smooth · Solid · Hard, shown once the lift is done (tracker.css) */
    '<div class="planBody"><div class="pbIn">' +
    '<div class="planPresc' + (tappable ? ' tap" data-act="setw" data-ex="' + exId + '" data-kind="' + pr.kind + '"' : '"') + '>' + pr.text + rate + (tappable ? ' <span class="editi">' + icon("edit", "sm") + '</span>' : '') + '</div>' +
    (rng ? '<div class="smartRange">' + esc(rng) + '</div>' : '') +
    (smart && pr.kind === "hold" && en.dose ? '<div class="doseLine">' + esc(en.dose) + '</div>' : '') +
    sug +   /* Part 2: the next step from last time, Use it / Keep (it says what he did, so it stands in for "Last time") */
    (lt && !sug ? '<div class="lastTime">Last time: <b>' + esc(lastTimeText(lt)) + '</b> · ' + esc(timeAgo(lt.ts)) + (lt.quality === "partial" ? ' <span class="ltPartial">partial</span>' : '') + '</div>' : '') +
    /* ramp-up (owner 2026-10-13: the minimum): only the split squat and the deadlift, only in weeks where THAT lift's own reps are 11 or fewer
       (2026-10-17: its own window, so the deadlift's 10-rep start shows the tip from week 1) */
    (en.ramp && rampReps != null && rampReps <= 11 ? '<div class="rampTip">' + icon("trendUp", "sm") + '<span>Ramp-up first: 1 light set, about half the weight, <span class="nw">6–8 reps</span></span></div>' : '') +
    (note ? '<button class="stickyNote" data-act="exsheet" data-ex="' + exId + '" data-sec="notes">' + icon("note", "sm") + '<span class="snTx">' + esc(note.text) + '</span><span class="snWhen">' + esc(shortDate(note.date)) + '</span></button>' : '') +
    '<div class="setRows">' + ticks.map(function(on, i){
      /* a smart set's reps is a button: the ± stepper (tracker-smart.js) */
      var lbl = smart ? '<button class="setTgt setReps" data-act="setreps" data-prog="' + prog + '" data-week="' + w + '" data-item="' + exId + '" data-set="' + i + '">' + esc(smartRowLabel(prog, w, en, i)) + '</button>'
                      : '<span class="setTgt">' + esc(tgt) + '</span>';
      return '<div class="setRow' + (on ? " on" : "") + (home ? " plain" : "") + '"><span class="setNo">' + (home ? "Set " + (i + 1) : (i + 1)) + '</span>' + lbl +
        '<button class="setTick' + (on ? " on" : "") + '" data-act="settick" data-prog="' + prog + '" data-week="' + w + '" data-item="' + exId + '" data-set="' + i + '" aria-label="Set ' + (i + 1) + ' done">' + icon("check") + '</button></div>';
    }).join("") + '</div>' +
    '<div class="exChips chips">' +
      '<button class="chip" data-act="exsheet" data-ex="' + exId + '">' + icon("book") + 'How to</button>' +
      (hist.length >= 2 ? '<button class="chip" data-act="exsheet" data-ex="' + exId + '" data-sec="progress">' + icon("chart") + 'Progress</button>' : '') +
      '<button class="chip noteBtn" data-act="note" data-ex="' + exId + '">' + icon("note") + 'Note</button>' +
      (tappable ? '<button class="chip" data-act="setw" data-ex="' + exId + '" data-kind="' + pr.kind + '">' + icon("edit") + 'Weight</button>' : '') +
      (pr.kind !== "hold" && pr.kind !== "bw" && pr.kind !== "effort" ? '<button class="chip stepBtn" data-act="setstep" data-ex="' + exId + '" title="smallest weight jump for this lift">' + icon("cog") + esc(stepLabel(ex)) + '</button>' : '') +
    '</div></div></div></div>';
  return h;
}
/* the newest note for a lift, or null */
function latestNoteFor(exId){ var n = db.notes || []; for(var i = n.length - 1; i >= 0; i--) if(n[i] && n[i].exerciseId === exId) return n[i]; return null; }
/* "2026-10-20" → "20 Oct" */
function shortDate(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? (+m[3]) + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2] - 1] : (iso || ""); }

/* update the done counts in place (no full re-render) so a tick can animate the card collapse */
function updateDoneCounts(prog, week){
  var P = db.programs[prog]; if(!P) return;
  var liftIds = P.entries.map(function(en){ return en.exerciseId; }), n = doneCount(prog, week, liftIds), total = P.entries.length;
  var ct = document.querySelector("#view-programs .phaseName .doneCt"); if(ct) ct.textContent = n + "/" + total + " done";
  var lh = document.querySelector("#view-programs .liftsHead"); if(lh) lh.textContent = liftsWord(prog) + " · " + n + "/" + total + " done";
  var bar = document.querySelector("#view-programs .shBar > i"); if(bar) bar.style.width = Math.round(n / (total || 1) * 100) + "%";
  var wu = warmupFor(prog), wn = doneCount(prog, week, wu.map(function(m){ return "wu:" + m.gif; }));
  var ws = document.querySelector("#view-programs .warmSec > summary .wuHead"); if(ws) ws.textContent = "Warm-up · " + warmTime(prog) + " · " + wn + "/" + wu.length;
}

/* ---------- the floating pill above the bottom bar: "Next: <lift> ↓", or "Now 1B" inside a superset ---------- */
/* first main lift (program order) not yet ticked done this week; null once every lift is done */
function nextUndoneLift(prog, week){
  var P = db.programs[prog]; if(!P) return null;
  for(var i = 0; i < P.entries.length; i++){ var id = P.entries[i].exerciseId; if(!isDone(prog, week, id)) return id; }
  return null;
}
/* refresh the Next pill for the shown day-track; hidden while previewing (can't log) or while the rest pill shows */
function updateNextBar(prog, week){
  var bar = $("#nextBar"); if(!bar) return;
  if(previewing()){ bar.hidden = true; bar.innerHTML = ""; syncPillClass(); return; }
  var np = ui.nowPrompt, nextId = nextUndoneLift(prog, week);
  if(np && np.prog === prog && np.week === week && !isDone(prog, week, np.exId)){
    var nx = exById(np.exId) || { name: np.exId };
    bar.innerHTML = '<button class="nextBtn now" data-act="nextex" data-ex="' + esc(np.exId) + '"><span class="nextLbl">Now ' + esc(np.tag) + '</span><span class="nextNm">' + esc(nx.name) + '</span><span class="nextArrow">' + icon("arrowDown") + '</span></button>';
  } else if(nextId){
    var ex = exById(nextId) || { name: nextId };
    bar.innerHTML = '<button class="nextBtn" data-act="nextex" data-ex="' + esc(nextId) + '"><span class="nextLbl">Next</span><span class="nextNm">' + esc(ex.name) + '</span><span class="nextArrow">' + icon("arrowDown") + '</span></button>';
  } else {
    bar.innerHTML = '<button class="nextBtn done" data-act="nextex" data-ex=""><span class="nextLbl">' + icon("check", "sm") + 'All lifts done</span><span class="nextNm">Finish the week</span><span class="nextArrow">' + icon("arrowDown") + '</span></button>';
  }
  bar.hidden = !!(typeof restState === "function" && restState());
  syncPillClass();
}
/* body.pillOn lifts the toast and the page bottom above a floating pill */
function syncPillClass(){ var r = $("#restBar"), n = $("#nextBar"); document.body.classList.toggle("pillOn", !!((r && !r.hidden) || (n && !n.hidden))); }
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
/* per-lift progress: an inline-SVG line of kg over the diary — amber point = partial, ringed = best */
function progHtml(hist){
  if(hist.length < 2) return "";
  var kgs = hist.map(function(h){ return h.kg; }), min = Math.min.apply(null, kgs), max = Math.max.apply(null, kgs), span = (max - min) || 1;
  var W = 320, H = 120, pad = 12, n = hist.length, X = function(i){ return pad + i * (W - 2 * pad) / (n - 1); }, Y = function(kg){ return H - pad - (kg - min) / span * (H - 2 * pad); };
  var pts = hist.map(function(h, i){ return X(i).toFixed(1) + "," + Y(h.kg).toFixed(1); }).join(" ");
  var area = pad + "," + (H - pad) + " " + pts + " " + X(n - 1).toFixed(1) + "," + (H - pad);
  var dots = hist.map(function(h, i){ var b = h.kg === max; return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(h.kg).toFixed(1) + '" r="' + (b ? 5 : 3.5) + '" fill="' + (h.quality === "partial" ? "var(--warm)" : "var(--acc)") + '"' + (b ? ' stroke="var(--tx)" stroke-width="2"' : '') + '></circle>'; }).join("");
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="spark" role="img" aria-label="kg over time"><polygon points="' + area + '" fill="var(--accTint)"></polygon><polyline points="' + pts + '" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>' + dots + '</svg>' +
    '<div class="progSum">' + hist[0].kg + ' kg <span class="progArrow">→</span> <b class="accT">' + hist[n - 1].kg + ' kg</b><span class="progDim"> · ' + icon("star", "sm") + ' best ' + max + ' kg</span></div>';
}

/* ---------- the week sheet (12 weeks, current and finished marked) and the phase info sheet ---------- */
function openWeekSheet(){
  var prog = ui.planProg, cur = shownCurrentWeek(prog), done = shownWeeksDone(prog), w = ui.planWeek, SPw = shownProg(), h = '<div class="weekGrid">';
  var K = SPw.smart ? Math.max(SPw.weeks, cur, w || 1, done.length ? Math.max.apply(null, done) : 1) : SPw.weeks;   /* a smart program runs on past 12 */
  for(var k = 1; k <= K; k++){ var dn = done.indexOf(k) >= 0;
    h += '<button class="wchip' + (k === w ? " sel" : "") + (k === cur ? " cur" : "") + (dn ? " done" : "") + '" data-act="week" data-week="' + k + '"><span class="wN">' + k + '</span>' +
      (dn ? '<span class="wtick">' + icon("check", "sm") + '</span>' : k === cur ? '<span class="wNow">now</span>' : '') + '</button>'; }
  h += '</div><div class="weekKey"><span>' + icon("check", "sm") + 'finished</span><span><i class="keyRing"></i>this week</span></div>';
  openSheet(shortName(prog) + " · weeks", h, { cls: "weekSheet" });
}
function openPhaseInfo(){
  var prog = ui.planProg, P = db.programs[prog], w = ui.planWeek || 1, SP = shownProg();
  var rmA = shownRateMode(), rmM = PROGRESSION_MODES[rmA], pace = (rmA !== "plateau" && rmM) ? " · " + rmM.label + " pace" : "";
  var smart = SP.smart === true;
  var lines = P.home ? ["Every set near failure: holds until your form is about to break; knee work stops 1–2 reps short. No weights to calculate."]
    : smart ? ["Reps as on each card · lower in about 3 s, then lift firmly in about 1–2 s, no jerk or bounce · each card's target comes from what you really did last time",
               "A tick means you did the target. Tap a set's reps to log more or fewer. After the last set, rate it by the reps you had left: Easy (3+), Smooth (2), Solid (1) or Hard (0); no tap = Solid.",
               "Smooth suggests one step up and Easy two: one rep more, and at the top of the range a heavier weight at reps that feel as hard. Solid and Hard keep the numbers. Log fewer reps than the range and the next session goes lighter by itself.",
               "Still very sore 3+ days after a session? Do 2 sets of everything that day."]
    : ["Reps as on each card · lower in about 3 s, then lift firmly in about 1–2 s, no jerk or bounce · heavy weights are calculated from your tested 15RM" + pace,
       "Still very sore 3+ days after a session? Do 2 sets of everything that day."];
  openSheet(P.home ? shortName(prog) : "Week " + w + " · " + (smart ? "Smart" : SP.direction === "reverse" ? "Back-off wave" : phaseForWeek(w)),
    '<div class="infoLines">' + lines.map(function(l){ return '<div class="phaseReps">' + esc(l) + '</div>'; }).join("") + '</div>');
}
