"use strict";
/* tracker-progress.js: the read-only screens built from data version 1 already keeps (version 2, 2026-11-04):
   Progress (lift chart, stats, personal bests, consistency) and the Exercises library with its exercise sheet.
   Loaded after the views and the Workout (tracker-plan.js), before the actions and the core. */

/* ---------- the Exercises library: every move of the active program's days and the home days, warm-up last ---------- */
/* a workout's name (his own, else the default; tracker-week.js dayName) */
function dayTitle(d){ return dayName(d); }
function libraryGroups(){
  var days = getProgram(db.activeProgram).days.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []), groups = [], seen = {}, wu = [];
  days.forEach(function(d){
    var D = db.programs[d]; if(!D) return;
    groups.push({ id: d, title: dayTitle(d), items: D.entries.map(function(en){ return { id: en.exerciseId, kind: "lift", day: d, name: (exById(en.exerciseId) || { name: en.exerciseId }).name }; }) });
  });
  days.forEach(function(d){ warmupFor(d).forEach(function(m){ if(seen[m.gif]) return; seen[m.gif] = 1; wu.push({ id: "wu:" + m.gif, kind: "warm", day: d, name: m.name, move: m }); }); });
  if(wu.length) groups.push({ id: "warmup", title: "Warm-up", items: wu });
  return groups;
}
/* ---------- the exercise sheet: big picture, how-to, this lift's chart and history, its notes, step, Add note ---------- */
/* the day a lift lives on (gym days first, then home); null for a lift on no day */
function dayOfAny(exId){ var ds = ((getProgram(db.activeProgram) || {}).days || STRENGTH_DAYS).concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []); for(var i = 0; i < ds.length; i++) if(progEntry(ds[i], exId)) return ds[i]; return null; }
function bigPicHtml(exId, alt){
  var pend = (typeof pendingPic === "function") ? pendingPic(exId) : EX_GIF_PENDING[exId];
  if(pend) return '<div class="exFig pending big">' + icon("camera", "xl") + '<span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(pend) + '.gif</span></div>';
  var g = EX_GIF[exId]; if(!g) return '';
  return '<div class="exFig big"><img src="gifs/' + g + '.gif" alt="' + esc(alt || "") + '" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
}
function howHtml(exId){
  var d = EX_DESC[exId]; if(!d) return "";
  return '<div class="how">' + [["Setup", d.setup], ["Move", d.move], ["Cue", d.cue], ["Feel", d.feel]].map(function(r){ return '<div class="howRow"><span class="howK">' + r[0] + '</span><span class="howV">' + esc(r[1]) + '</span></div>'; }).join("") + '</div>';
}
function notesFor(exId){ return (db.notes || []).map(function(n, i){ return { n: n, i: i }; }).filter(function(o){ return o.n && o.n.exerciseId === exId; }).reverse(); }
function noteLineHtml(o, withName){
  var n = o.n, rec = []; if(n.week) rec.push("Week " + n.week); if(n.weight) rec.push(n.weight);
  return '<div class="noteRow"><div class="noteHd">' + (withName ? '<b>' + esc((exById(n.exerciseId) || { name: n.exerciseId }).name) + '</b>' : '<b>' + esc(shortDate(n.date)) + '</b>') +
    '<span class="dim">' + esc(withName ? shortDate(n.date) : "") + '</span></div>' + (rec.length ? '<div class="noteRec">' + esc(rec.join(" · ")) + '</div>' : '') + '<div class="noteTx">' + esc(n.text) + '</div></div>';
}
function histListHtml(hist){
  if(!hist.length) return '<div class="note">No sessions logged yet. Each lift you tick is written here with its weight.</div>';
  return '<div class="histList">' + hist.slice().reverse().slice(0, 8).map(function(h){
    return '<div class="kv"><span>' + esc(shortDate(h.ts)) + ' · week ' + h.week + '</span><b>' + h.kg + ' kg × ' + h.reps + (h.quality === "partial" ? ' <span class="ltPartial">partial</span>' : '') + '</b></div>';
  }).join("") + '</div>';
}
/* inDay: the day whose row was tapped (the library lists a lift under each of its days: the neck work sits on both home
   days, so its sheet names the day it was opened from, 2026-11-11) */
function openExSheet(exId, sec, inDay){
  var ex = exById(exId) || { name: exId }, hist = historyFor(exId);
  var day = (inDay && progEntry(inDay, exId)) ? inDay : (ui.view === "programs" && ui.planProg && progEntry(ui.planProg, exId)) ? ui.planProg : dayOfAny(exId), en = day ? progEntry(day, exId) : null;
  var w = (day && day === ui.planProg && ui.planWeek) ? ui.planWeek : (day ? shownCurrentWeek(day) : 1), pr = en ? prescFor(en, w, day) : null;
  var notes = notesFor(exId);
  var h = '<div class="exSheet"><div class="exBig">' + bigPicHtml(exId, ex.name) + '</div>' +
    (en ? '<div class="exNow"><div class="exNowTop"><span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + esc(en.block) + '</span><span class="dim">' + esc(shortName(day)) + ' · week ' + w + '</span></div><div class="exNowT">' + pr.text + '</div></div>' : '') +
    (EX_DESC[exId] ? '<div class="sheetSec"><div class="sectH">How to</div>' + howHtml(exId) + '</div>' : '') +
    (typeof catalogDetailsHtml === "function" ? catalogDetailsHtml(exId) : '') +   /* Part 2: instructions of a catalogue exercise, the categories */
    '<div class="sheetSec exProg" id="exSecProgress"><div class="sectH">Progress</div>' + (hist.length >= 2 ? progHtml(hist) : '') + histListHtml(hist) + '</div>' +
    (typeof targetHistoryHtml === "function" ? targetHistoryHtml(exId) : '') +   /* Part 2: "Target 65 → 67.5 kg on 4 Nov" */
    '<div class="sheetSec exNotes" id="exSecNotes"><div class="sectH">Notes</div>' + (notes.length ? notes.map(function(o){ return noteLineHtml(o, false); }).join("") : '<div class="note">No notes for this lift yet.</div>') +
    '<button class="btn tonal block" style="margin-top:12px" data-act="note" data-ex="' + esc(exId) + '"' + (day ? ' data-prog="' + day + '" data-week="' + w + '"' : '') + '>' + icon("plus") + 'Add note</button></div>' +
    (pr && pr.kind === "heavy" ? '<div class="sheetSec"><div class="sectH">Weight step</div><div class="list" style="margin:0"><button class="li" data-act="setstep" data-ex="' + esc(exId) + '"><span class="liI">' + icon("cog") + '</span><span class="liB"><span class="liT">' + esc(stepLabel(ex)) + '</span><span class="liS">The smallest jump your gear allows for this lift</span></span>' + icon("chevR", "chev") + '</button></div></div>' : '') +
    '</div>';
  openSheet(ex.name, h, { cls: "exSheetCard" });
  if(sec){ var el = document.getElementById(sec === "notes" ? "exSecNotes" : "exSecProgress"); if(el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }
}
/* a warm-up move's picture, big (data-wu = its gif id) */
function warmMove(gif){ for(var d in WARMUP_BY_PROG){ var L = WARMUP_BY_PROG[d] || []; for(var i = 0; i < L.length; i++) if(L[i].gif === gif) return L[i]; } return null; }
function openPicSheet(gif){
  var m = warmMove(gif); if(!m) return;
  var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif";
  var pic = m.nopic ? '' : m.pending ? '<div class="exFig pending big">' + icon("camera", "xl") + '<span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(g) + '</span></div>'
    : '<div class="exFig big"><img src="gifs/' + g + '" alt="' + esc(m.name) + '" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
  openSheet(m.name, '<div class="exSheet"><div class="exBig">' + pic + '</div><div class="exNow"><div class="exNowTop"><span class="pill warn">warm-up</span></div><div class="exNowT small">' + esc(m.detail) + '</div></div></div>');
}

function renderExercises(){
  var groups = libraryGroups(), n = groups.reduce(function(s, g){ return s + g.items.length; }, 0);
  var h = subHead("Exercises", n + " moves of " + esc(getProgram(db.activeProgram).name) + " and the home days first, then every exercise in the catalogue, with how-tos.") +
    '<label class="searchBox">' + icon("search") + '<input id="exSearch" type="search" placeholder="Search exercises" autocomplete="off" aria-label="Search exercises"></label>' +
    /* Part 2: the filter chips and the whole catalogue under his program's exercises (tracker-catalog.js) */
    '<div id="libFilters" class="catFilters"></div><div class="libCount"></div><div class="libSection">In my program</div>';
  h += groups.map(function(g){
    return '<div class="libGroup" data-group="' + esc(g.id) + '"><div class="sectH libHead">' + esc(g.title) + '</div><div class="list">' + g.items.map(libRowHtml).join("") + '</div></div>';
  }).join("");
  h += '<div class="libEmpty card emptyCard" hidden>' + icon("search", "xl") + '<div class="emptyT">Nothing found</div><div class="note">Try part of a name, like “curl” or “squat”.</div></div>';
  h += '<div class="libAll"><div class="libSection">All exercises</div><div class="list catList"></div><button class="btn block catMore" data-act="catmore" data-ctx="lib" hidden></button></div>';
  $("#view-exercises").innerHTML = h;
  var box = $("#exSearch");
  catF.lib.q = ui.libQuery || "";
  if(box){ box.value = ui.libQuery || ""; box.addEventListener("input", function(){ ui.libQuery = box.value; catF.lib.q = box.value; catF.lib.limit = CAT_PAGE; catRefresh("lib"); }); }
  catRefresh("lib");
}
function libRowHtml(it){
  if(it.kind === "warm"){
    var m = it.move, g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif";
    var th = m.nopic ? '<div class="thumbNone">' + icon("flame") + '</div>' : m.pending ? '<div class="exFig pending">' + icon("camera") + '<span class="pendSoon" aria-hidden="true">soon</span><span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(g) + '</span></div>'
      : '<div class="exFig"><img src="gifs/' + g + '" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
    return '<button class="li libRow" data-act="pic" data-wu="' + esc(m.gif) + '"><span class="libThumb">' + th + '</span><span class="liB"><span class="liT libName">' + esc(m.name) + '</span><span class="liS">' + esc(m.detail) + '</span></span>' + icon("chevR", "chev") + '</button>';
  }
  var en = progEntry(it.day, it.id), sub = en ? (en.dose ? "home · by effort" : (en.block + (en.ss ? " · superset " + en.ss : en.solo ? " · alone" : ""))) : "";
  return '<button class="li libRow" data-act="exsheet" data-ex="' + esc(it.id) + '" data-day="' + esc(it.day) + '"><span class="libThumb">' + thumbHtml(it.id) + '</span><span class="liB"><span class="liT libName">' + esc(it.name) + '</span><span class="liS">' + esc(sub) + '</span></span>' + icon("chevR", "chev") + '</button>';
}
/* keep the rows whose name contains the text (any case); hide empty groups; say so when nothing matches */
function filterLibrary(q){
  q = String(q || "").trim().toLowerCase();
  var any = false;
  $$("#view-exercises .libGroup").forEach(function(g){
    var vis = 0;
    $$(".libRow", g).forEach(function(r){ var nm = ((r.querySelector(".libName") || {}).textContent || "").toLowerCase(), ok = (!q || nm.indexOf(q) >= 0) && (typeof catalogMatch !== "function" || catalogMatch(r.getAttribute("data-ex") || r.getAttribute("data-wu"), "lib")); r.hidden = !ok; if(ok) vis++; });
    g.hidden = !vis; if(vis) any = true;
  });
  var e = $("#view-exercises .libEmpty"); if(e) e.hidden = any;
  return any;
}

/* ---------- PROGRESS (read only, from the v1 diary) ---------- */
/* every lift with diary entries, the most recently trained first */
function liftsWithHistory(){
  var last = {};
  (db.history || []).forEach(function(h){ if(!last[h.exId] || h.ts > last[h.exId]) last[h.exId] = h.ts; });
  return Object.keys(last).map(function(id){ return { id: id, name: (exById(id) || { name: id }).name, last: last[id] }; })
    .sort(function(a, b){ return a.last < b.last ? 1 : a.last > b.last ? -1 : (a.name < b.name ? -1 : 1); });
}
function isoOf(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
/* Monday of the week a YYYY-MM-DD date sits in */
function mondayOf(iso){ var d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function fmtNum(x){ return String(Math.round(x * 100) / 100); }
/* ---------- the estimated max (2026-11-12, his words: "80kg 12 reps might be similar or not progression if doing 85kg of 8
   reps ... Maybe easiest way is to to have estimated max based on reps"): Epley, kg × (1 + reps / 30), the smart rule's
   own "same effort" (tracker-smart.js), to 0.1 kg, from each session's best set. Only lifts with an outside weight: a
   carry, a hold, a body-weight or a home lift keeps its weight. A real max he logs ("Log a real max", db.maxes
   [{exId, date, kg}], additive: version 1 ignores it) counts as a best of its own. ---------- */
function estRaw(kg, reps){ return (typeof reps === "number" && reps > 0) ? kg * (1 + reps / 30) : kg; }
function estMax(kg, reps){
  if(!(typeof kg === "number" && isFinite(kg))) return kg;
  return Math.round(estRaw(kg, reps) * 10) / 10;
}
function byEstimate(exId){ var ex = exById(exId) || {}; return typeof smartKind === "function" ? smartKind(null, ex) === "lift" : true; }
/* a diary session's best set: the most reps of its sets (a smart entry keeps each set's reps), else its reps */
function bestSetReps(h){ var d = Array.isArray(h.done) ? h.done.filter(function(r){ return typeof r === "number" && r > 0; }) : []; return d.length ? Math.max.apply(null, d) : h.reps; }
/* what a session is charted and compared by, unrounded (so the same reps give exactly the weight's change; it is shown
   to 0.1 kg, fmtVal); and "80 kg × 12" (its best set) when that is an estimate */
function sessionValue(h){ return byEstimate(h.exId) ? estRaw(h.kg, bestSetReps(h)) : h.kg; }
function sessionHow(h){ return byEstimate(h.exId) ? fmtNum(h.kg) + " kg × " + bestSetReps(h) : ""; }
function fmtVal(x, est){ return fmtNum(est ? Math.round(x * 10) / 10 : x); }
/* the real maxes of a lift, oldest first */
function realMaxesFor(exId){ return (db.maxes || []).filter(function(m){ return m.exId === exId; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); }
/* on load (tracker.js normalize): keep only whole entries */
function cleanMaxes(){
  db.maxes = Array.isArray(db.maxes) ? db.maxes.filter(function(m){ return !!m && typeof m === "object" && typeof m.exId === "string" && !!m.exId &&
    typeof m.kg === "number" && isFinite(m.kg) && m.kg > 0 && m.kg < 1000 && typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.date); }) : [];
}
/* "Log a real max": the number pad, today's date; the ones logged before listed with Remove (Undo on the toast) */
function openMaxSheet(exId){
  var ex = exById(exId) || { name: exId }, mine = (db.maxes || []).map(function(m, i){ return { m: m, i: i }; }).filter(function(o){ return o.m.exId === exId; }).reverse();
  var list = mine.length ? '<div class="sectH">Logged</div><div class="list maxList">' + mine.map(function(o){ return '<div class="li maxRow"><span class="liB"><span class="liT">' + fmtNum(o.m.kg) + ' kg</span><span class="liS">' + esc(shortDate(o.m.date)) + '</span></span>' +
    '<button class="btn sm" data-act="maxdel" data-i="' + o.i + '">Remove</button></div>'; }).join("") + '</div>' : '';
  openModal({ mode: "number", title: "Real max · " + ex.name, message: "The most you lifted for one rep, tested for real today.", value: "", placeholder: "0", okLabel: "Save", html: list,   /* "0", not "kg": the pad shows its own unit (seen on the emulator 2026-11-12: "kg kg") */
    onSubmit: function(v){
      var kg = num(v); if(kg == null || !(kg > 0) || !(kg < 1000)){ toast("Type the weight in kg"); return; }
      if(!Array.isArray(db.maxes)) db.maxes = [];
      db.maxes.push({ exId: exId, date: todayISO(), kg: Math.round(kg * 100) / 100 }); save(); renderProgress();
      toast("Real max " + fmtNum(kg) + " kg logged");
    } });
}
function removeRealMax(i){
  var m = (db.maxes || [])[i]; if(!m) return;
  db.maxes.splice(i, 1); save(); closeModal(); renderProgress();
  toast("Real max " + fmtNum(m.kg) + " kg removed", { undo: function(){ db.maxes.splice(Math.min(i, db.maxes.length), 0, m); save(); renderProgress(); } });
}
/* the chart: each session's value (the estimate, or the weight) over time (dates to scale), the best ringed, partial
   sessions amber, real maxes as their own diamond */
function bigChartHtml(hist, vals, maxes, what){
  vals = vals || hist.map(function(h){ return h.kg; }); maxes = maxes || [];
  var W = 340, H = 170, pl = 34, pr = 12, pt = 14, pb = 26;
  var all = vals.concat(maxes.map(function(m){ return m.kg; })), min = Math.min.apply(null, all), max = Math.max.apply(null, all);
  var lo = Math.floor(min - (max - min || 5) * 0.15), hi = Math.ceil(max + (max - min || 5) * 0.15); if(hi <= lo) hi = lo + 1;
  var tOf = function(iso){ return new Date(iso + "T00:00:00").getTime(); };
  var t = hist.map(function(h){ return tOf(h.ts); }), tAll = t.concat(maxes.map(function(m){ return tOf(m.date); })), t0 = Math.min.apply(null, tAll), t1 = Math.max.apply(null, tAll);
  var XT = function(tt, i){ return t1 > t0 ? pl + (tt - t0) / (t1 - t0) * (W - pl - pr) : (hist.length > 1 && i != null ? pl + i / (hist.length - 1) * (W - pl - pr) : (pl + W - pr) / 2); };
  var X = function(i){ return XT(t[i], i); };
  var Y = function(kg){ return pt + (hi - kg) / (hi - lo) * (H - pt - pb); };
  var bestI = -1; vals.forEach(function(v, i){ if(bestI < 0 || v > vals[bestI]) bestI = i; });
  var topReal = maxes.length ? Math.max.apply(null, maxes.map(function(m){ return m.kg; })) : -Infinity, ringSession = vals[bestI] >= topReal;
  var grid = [lo, (lo + hi) / 2, hi].map(function(v){ return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gLine"></line><text x="' + (pl - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" class="gLbl" text-anchor="end">' + fmtNum(v) + '</text>'; }).join("");
  var pts = hist.map(function(h, i){ return X(i).toFixed(1) + "," + Y(vals[i]).toFixed(1); }).join(" ");
  var area = hist.length > 1 ? '<polygon points="' + X(0).toFixed(1) + ',' + (H - pb) + ' ' + pts + ' ' + X(hist.length - 1).toFixed(1) + ',' + (H - pb) + '" class="gArea"></polygon>' : '';
  var dots = hist.map(function(h, i){ var b = i === bestI && ringSession; return '<circle class="pt' + (b ? " best" : "") + (h.quality === "partial" ? " partial" : "") + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(vals[i]).toFixed(1) + '" r="' + (b ? 6 : 4) + '"></circle>'; }).join("");
  var real = maxes.map(function(m){ var x = XT(tOf(m.date), null), y = Y(m.kg), b = !ringSession && m.kg === topReal, r = b ? 7 : 5.5;
    return '<path class="realMax' + (b ? " best" : "") + '" d="M' + x.toFixed(1) + ' ' + (y - r).toFixed(1) + 'L' + (x + r).toFixed(1) + ' ' + y.toFixed(1) + 'L' + x.toFixed(1) + ' ' + (y + r).toFixed(1) + 'L' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + 'Z"></path>'; }).join("");
  var days = hist.map(function(h){ return h.ts; }).concat(maxes.map(function(m){ return m.date; })).sort();
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (what || "kg") + ' over time">' + grid + area + (hist.length > 1 ? '<polyline points="' + pts + '" class="gLine2"></polyline>' : '') + dots + real +
    '<text x="' + pl + '" y="' + (H - 6) + '" class="gLbl">' + esc(shortDate(days[0])) + '</text><text x="' + (W - pr) + '" y="' + (H - 6) + '" class="gLbl" text-anchor="end">' + esc(shortDate(days[days.length - 1])) + '</text></svg>';
}
/* a lift's best: its best session value, or a real max above it (the day first reached; how: "80 kg × 12" or "real max") */
function liftBest(exId){
  var b = null, bv = -Infinity;
  historyFor(exId).forEach(function(x){ var v = sessionValue(x); if(!b || v > bv){ b = x; bv = v; } });
  var est = byEstimate(exId), p = b ? { kg: bv, ts: b.ts, how: sessionHow(b), est: est } : null;
  if(est) realMaxesFor(exId).forEach(function(m){ if(!p || m.kg > p.kg) p = { kg: m.kg, ts: m.date, how: "real max", real: true, est: false }; });
  return p;
}
function renderProgress(){
  var lifts = liftsWithHistory(), today = todayISO(), h = mainHead("Progress", lifts.length ? (db.history.length + " lifts logged") : "");
  if(!lifts.length){
    h += '<div class="card emptyCard">' + icon("chart", "xl") + '<div class="emptyT">No lifts logged yet</div><div class="note">Tick a lift on the Workout and its weight is written here, week by week.</div></div>';
    if(typeof bodyCardHtml === "function") h += bodyCardHtml();   /* 2026-11-11: weight, belly, neck (tracker-body.js) */
  } else {
    if(!ui.progLift || !lifts.some(function(l){ return l.id === ui.progLift; })) ui.progLift = lifts[0].id;
    var sel = ui.progLift, hist = historyFor(sel), ex = exById(sel) || { name: sel }, est = byEstimate(sel);
    var vals = hist.map(sessionValue), maxes = est ? realMaxesFor(sel) : [], top = liftBest(sel);
    var first = vals[0], latest = vals[vals.length - 1], best = top.kg;
    var ch = first > 0 ? Math.round((latest - first) / first * 1000) / 10 : 0, chTx = (ch > 0 ? "+" : ch < 0 ? "−" : "") + Math.abs(ch) + "%";
    h += '<div class="chips scroll liftChips">' + lifts.map(function(l){ return '<button class="chip liftChip' + (l.id === sel ? " sel" : "") + '" data-act="proglift" data-ex="' + esc(l.id) + '">' + esc(l.name) + '</button>'; }).join("") + '</div>';
    h += '<div class="card progChart"><div class="pcLift">' + esc(ex.name) + '</div>' +
      (est ? '<div class="pcHow">Est. max = kg × (1 + reps ÷ 30), from each session’s best set. Latest: ' + esc(sessionHow(hist[hist.length - 1])) + '.</div>' : '') +
      '<div class="pcKey"><span><i class="kDot"></i>full</span><span><i class="kDot partial"></i>partial</span><span><i class="kDot best"></i>best</span>' + (maxes.length ? '<span><i class="kDot real"></i>real max</span>' : '') + '</div>' + bigChartHtml(hist, vals, maxes, est ? "estimated max" : "kg") + '</div>';
    h += '<div class="statGrid">' +
      '<div class="stat"><span class="stK">First → latest' + (est ? ' est. max' : '') + '</span><b class="stFirstLatest">' + fmtVal(first, est) + ' → ' + fmtVal(latest, est) + ' kg</b></div>' +
      '<div class="stat"><span class="stK">' + icon("star", "sm") + 'Best' + (top.real ? ' · real max' : '') + '</span><b class="stBest">' + fmtVal(best, top.est) + ' kg</b></div>' +
      '<div class="stat"><span class="stK">Change</span><b class="stChange' + (ch > 0 ? " up" : "") + '">' + chTx + '</b></div>' +
      '<div class="stat"><span class="stK">Sessions</span><b class="stSessions">' + hist.length + '</b></div></div>';
    if(est) h += '<button class="btn tonal block maxBtn" data-act="maxlog" data-ex="' + esc(sel) + '">' + icon("plus") + 'Log a real max</button>';
    if(typeof bodyCardHtml === "function") h += bodyCardHtml();   /* 2026-11-11: weight, belly, neck (tracker-body.js) */
    /* personal bests: each lift's best (the estimate, a real max above it, or the weight) and the day it was first
       reached, newest first; a trophy on this week's */
    var mon = isoOf(mondayOf(today));
    var pbs = lifts.map(function(l){ var b = liftBest(l.id); return { id: l.id, name: l.name, kg: b.kg, ts: b.ts, how: b.how, est: b.est }; })
      .sort(function(a, b){ return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
    h += '<div class="sectH">Personal bests</div><div class="list pbList2">' + pbs.map(function(p){ var tw = p.ts >= mon && p.ts <= today;
      return '<div class="li pbRow' + (tw ? " thisWeek" : "") + '" data-date="' + p.ts + '"><span class="liI">' + icon(tw ? "trophy" : "star") + '</span><span class="liB"><span class="liT pbName">' + esc(p.name) + '</span><span class="liS pbDate">' + esc(shortDate(p.ts)) + (p.how ? " · " + esc(p.how) : "") + (tw ? " · this week" : "") + '</span></span><span class="liV pbKg">' + fmtVal(p.kg, p.est) + ' kg</span></div>'; }).join("") + '</div>';
  }
  h += consistencyHtml(today);
  $("#view-progress").innerHTML = h;
  /* the chosen lift's chip in view inside its scrolling row (the page itself does not move) */
  var row = $("#view-progress .liftChips"), sc = row && row.querySelector(".liftChip.sel");
  if(row && sc) row.scrollLeft = Math.max(0, sc.offsetLeft - row.offsetLeft - 16);
}
/* 12 weeks (this week and the 11 before) × 7 days: the days with diary entries; then weeks done per day-track */
function consistencyHtml(today){
  var start = mondayOf(today); start.setDate(start.getDate() - 77);
  var days = {}; (db.history || []).forEach(function(x){ days[x.ts] = true; });
  var cells = "", n = 0;
  for(var k = 0; k < 84; k++){ var d = new Date(start); d.setDate(start.getDate() + k); var iso = isoOf(d), on = !!days[iso]; if(on) n++;
    cells += '<span class="cDay' + (on ? " on" : "") + (iso === today ? " today" : "") + (iso > today ? " future" : "") + '" data-date="' + iso + '" title="' + esc(shortDate(iso)) + '"></span>'; }
  var AP = getProgram(db.activeProgram), tracks = AP.days.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []);
  return '<div class="sectH">Consistency</div><div class="card consCard"><div class="consTop"><b>' + n + '</b> training ' + (n === 1 ? "day" : "days") + ' in 12 weeks</div>' +
    '<div class="consWrap"><div class="consDays"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div><div class="consGrid">' + cells + '</div></div>' +
    '<div class="consFoot"><span>12 weeks ago</span><span>this week</span></div>' +
    '<div class="trackList">' + tracks.map(function(d){ var w = progWeeksDone(d).length; return '<div class="trackRow"><span class="trName">' + esc(dayTitle(d)) + '</span><span class="bar"><i style="width:' + weeksDonePct(w, AP) + '%"></i></span><span class="trVal">' + weeksDoneText(w, AP) + '</span></div>'; }).join("") + '</div></div>';
}
