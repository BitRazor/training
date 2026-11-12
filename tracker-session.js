"use strict";
/* tracker-session.js: what happens while you lift (version 2, 2026-11-04; design.md §5).
   - set ticks: db.sets[doneKey] = [bool…], one per set of the entry (additive; version 1 ignores it). The lift's
     done state stays in db.done exactly as in v1 (applyMark writes the frozen diary): ticking the last set marks it
     full, un-ticking a set of a full lift un-marks it; ✓ ticks every set, ◐ leaves them and marks partial;
   - the session: the first tick of a day-track and week today starts db.session {start, last, ticks, base}; Finish
     clears it; ticks = the time each set was ticked (for the superset rest below); base = what was already ticked on
     that week before the session began;
   - the workout clock (2026-11-04, Part 1: "impossible to turn off"): the header's elapsed-time chip opens a sheet to
     Stop the clock (the session ends: stoppedAt, the time freezes, the ticks stay, the rest timer ends; the next tick
     starts a new clock) or Reset it (no session, the ticks stay). When every tick of the session is undone (Undo,
     unticking), the session and its clock clear by themselves, with any rest timer that tick started;
   - the rest timer (the smart rule of 2026-11-04, see restPlan): each lift rests its own restSec; a superset breathes
     20 s between its lifts and, after the round's last lift, rests until the round's first lift is ready again; no
     timer after a lift's last set. One at a time, kept on its end time (localStorage "training-tracker:v1:rest"), so
     a re-render, a restart or a locked phone shows the right time; ±15 s, Skip; at zero a beep (only while visible),
     a buzz and a flash; an Android alert for rests of 45 s or more, scheduled for the end time (native.js,
     @capacitor/local-notifications);
   - keep awake while a tick is under 20 minutes old and the Workout is open;
   - Undo: a toast with Undo for 5 s after a set or lift tick and a week finish (the whole db as it was);
   - Finish week: the v1 week-done, then a summary sheet (full, partial, time, today's bests, the next session).
   Loaded after tracker-plan.js; the core (tracker.js) routes the clicks here. */

/* the app's clock (tests replace it) */
function nowMs(){ return Date.now(); }
var REST_KEY = STORE_KEY + ":rest", REST_NOTE_ID = 4711, AWAKE_MS = 20 * 60000;
var BREATH_SEC = 30, ALERT_MIN_SEC = 45;   /* the shortest rest between superset lifts (was 20 s until 2026-11-12); the shortest rest that gets an Android alert */
var rest = null, tickTimer = null, awakeOn = null, audioCtx = null;
function mmss(sec){ sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" + pad2(m) : String(m)) + ":" + pad2(s); }

/* ---------- set ticks ---------- */
function setCount(prog, exId){ var en = progEntry(prog, exId); return Math.max(1, (en && en.sets) || 1); }
/* the ticks shown for a lift: the stored ones; a v1 "full" mark with none stored = every set ticked */
function setTicks(prog, week, exId){
  var n = setCount(prog, exId), a = previewing() ? null : (db.sets && db.sets[doneKey(prog, week, exId)]), st = doneState(prog, week, exId), out = [];
  for(var i = 0; i < n; i++) out.push(a ? !!a[i] : st === "full");
  return out;
}
function allSets(prog, exId, on){ var a = []; for(var i = 0, n = setCount(prog, exId); i < n; i++) a.push(!!on); return a; }
function onSetTick(t){
  var prog = t.getAttribute("data-prog"), week = +t.getAttribute("data-week"), exId = t.getAttribute("data-item"), i = +t.getAttribute("data-set");
  var en = progEntry(prog, exId); if(!en) return;
  primeAudio();
  /* Part 2: a smart lift without a target asks for its starting weight first (tracker-smart.js), then the tick goes on */
  if(typeof smartOn === "function" && smartOn() && !setTicks(prog, week, exId)[i] && needsStartWeight(en)){
    onSmartWeight(prog, week, exId, function(undo){ renderPlan(); tickSet(prog, week, exId, i, undo); });
    return;
  }
  tickSet(prog, week, exId, i);
}
/* tick or untick set i of a lift (undo0: an Undo point taken before an earlier step of the same action, e.g. a logged set) */
function tickSet(prog, week, exId, i, undo0){
  if(!progEntry(prog, exId)) return;
  var undo = undo0 || undoPoint(), before = tickKeys(prog, week), arr = setTicks(prog, week, exId), on = !arr[i], st0 = doneState(prog, week, exId);
  arr[i] = on;
  if(!db.sets) db.sets = {};
  db.sets[doneKey(prog, week, exId)] = arr;
  if(on){ touchSession(prog, week, before); if(arr.every(Boolean) && st0 !== "full") applyMark(prog, week, exId, "full"); }
  else if(st0 === "full") applyMark(prog, week, exId, "full");   /* un-ticking a set of a full lift un-marks it (v1 untick) */
  noteTick(prog, week, exId, i, on);
  if(typeof smartTicked === "function") smartTicked(prog, week, exId);   /* Part 3: the session keeps the target it started at (tracker-smart.js) */
  save();
  var st = doneState(prog, week, exId), ex = exById(exId) || { name: exId };
  ui.nowPrompt = null;
  if(!on && endSessionIfEmpty(prog, week)) stopRest();   /* the session's every tick undone: no clock, no rest */
  if(on){
    var b = blockOf(prog, exId), plan = restPlan(prog, week, exId, i);
    if(b && b.kind === "ss" && b.idx < b.entries.length - 1) ui.nowPrompt = { prog: prog, week: week, exId: b.entries[b.idx + 1].exerciseId, tag: b.n + String.fromCharCode(66 + b.idx) };
    if(plan) startRest(plan); else stopRest();   /* a lift's last set: no timer, and a running one stops */
    Native.haptic(st === "full" && st0 !== "full" ? "success" : "light");
  }
  refreshCardState(prog, week, exId, i);
  updateDoneCounts(prog, week); updateNextBar(prog, week); refreshSessionUi(); updateAwake(true);
  toast(st === "full" && st0 !== "full" ? ex.name + " done" : ex.name + " · set " + (i + 1) + " of " + arr.length + (on ? "" : " unticked"), { undo: undo });
}
/* the lift ✓ (all sets) and ◐ (partial), and a warm-up move's tick */
function onMark(t, mark){
  var prog = t.getAttribute("data-prog"), week = +t.getAttribute("data-week"), item = t.getAttribute("data-item"), wu = item.indexOf("wu:") === 0;
  var undo = wu ? null : undoPoint(), before = tickKeys(prog, week);
  applyMark(prog, week, item, mark);
  var st = doneState(prog, week, item);
  if(!wu && mark === "full"){ if(!db.sets) db.sets = {}; if(st === "full") db.sets[doneKey(prog, week, item)] = allSets(prog, item, true); else delete db.sets[doneKey(prog, week, item)]; save(); }
  if(!wu && typeof smartTicked === "function"){ smartTicked(prog, week, item); save(); }
  if(st) touchSession(prog, week, before);
  else if(endSessionIfEmpty(prog, week)){ ui.nowPrompt = null; stopRest(); }
  var c = t.closest(".planCard") || t.closest(".wuCard");
  if(c){ c.classList.toggle("done", !!st); c.classList.toggle("partial", st === "partial");
    var fb = c.querySelector('[data-act="donetick"]'), pb = c.querySelector('[data-act="partialtick"]');
    if(fb) fb.classList.toggle("on", st === "full"); if(pb) pb.classList.toggle("on", st === "partial");
    if(fb && st) popEl(st === "partial" && pb ? pb : fb); }
  if(!wu) refreshCardState(prog, week, item, -1);
  updateDoneCounts(prog, week); updateNextBar(prog, week); refreshSessionUi(); updateAwake(true);
  if(st) Native.haptic(st === "full" && !wu ? "success" : "light");
  if(!wu){ var ex = exById(item) || { name: item }; toast(ex.name + (st === "full" ? " done" : st === "partial" ? " marked partial" : " unmarked"), { undo: undo }); }
}
/* bring one card in line with the state, in place, so the tick pops and the card folds with its animation */
function refreshCardState(prog, week, exId, popped){
  var tk = document.querySelector('#view-programs .planCard [data-act="donetick"][data-item="' + exId + '"]'), c = tk && tk.closest(".planCard"); if(!c) return;
  var st = doneState(prog, week, exId), a = setTicks(prog, week, exId);
  c.classList.toggle("done", !!st); c.classList.toggle("partial", st === "partial"); if(!st) c.classList.remove("peek");
  var fb = c.querySelector('[data-act="donetick"]'), pb = c.querySelector('[data-act="partialtick"]');
  if(fb) fb.classList.toggle("on", st === "full"); if(pb) pb.classList.toggle("on", st === "partial");
  [].slice.call(c.querySelectorAll(".setRow")).forEach(function(r, i){ var on = !!a[i], b = r.querySelector(".setTick"); r.classList.toggle("on", on); if(b){ b.classList.toggle("on", on); if(i === popped && on) popEl(b); } });
  if(typeof smartOn === "function" && smartOn()) smartRefreshCard(c, prog, week, exId);   /* Part 2: logged reps on the rows and the folded line */
}
function popEl(el){ el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

/* ---------- the session (first tick → last tick, one day-track and week, today) ---------- */
/* everything ticked on a day-track's week, as keys: "<lift>:<set index>", "<lift>:full|partial", "wu:<move>" */
function tickKeys(prog, week){
  var out = [], P = db.programs[prog]; if(!P || previewing()) return out;
  P.entries.forEach(function(en){ var id = en.exerciseId, st = doneState(prog, week, id);
    if(st) out.push(id + ":" + st);
    setTicks(prog, week, id).forEach(function(on, i){ if(on) out.push(id + ":" + i); }); });
  warmupFor(prog).forEach(function(m){ if(isDone(prog, week, "wu:" + m.gif)) out.push("wu:" + m.gif); });
  return out;
}
/* a tick: the first one of a day-track and week today (or the first after the clock was stopped) starts a session;
   before = the week's ticks just before it, so the session knows which ticks are its own */
function touchSession(prog, week, before){
  var now = nowMs(), today = todayISO(), s = db.session;
  if(!s || s.prog !== prog || s.week !== week || s.date !== today || s.program !== db.activeProgram || s.stoppedAt != null)
    db.session = { program: db.activeProgram, prog: prog, week: week, date: today, start: now, last: now, ticks: {}, base: before || [] };
  else s.last = Math.max(s.last || now, now);   /* a clock that steps back never shortens the session below zero */
  save();
}
/* the Start session button (2026-11-12): the session starts now, as a first tick would start it, with nothing ticked */
function startSessionNow(){
  var prog = ui.planProg, week = ui.planWeek; if(!prog || previewing() || sessionFor(prog, week)) return;
  touchSession(prog, week, tickKeys(prog, week));
  if(db.session) { db.session.how = "button"; save(); }
  refreshSessionUi();
}
function sessionFor(prog, week){ var s = db.session; return (s && !previewing() && s.prog === prog && s.week === week && s.date === todayISO() && s.program === db.activeProgram) ? s : null; }
/* after an untick: when nothing the session ticked is still on (only what was on before it began, if anything), the
   session and its clock clear by themselves. true = cleared (the caller stops the rest timer that tick started).
   A session saved before 2026-11-04 has no base: it clears once nothing is ticked on its week */
function endSessionIfEmpty(prog, week){
  var s = sessionFor(prog, week); if(!s) return false;
  var base = Array.isArray(s.base) ? s.base : [];
  if(tickKeys(prog, week).some(function(k){ return base.indexOf(k) < 0; })) return false;
  db.session = null; save();
  return true;
}
/* the clock's time: now − start while it runs, frozen at stoppedAt once stopped */
function clockSec(s){ return ((s.stoppedAt != null ? s.stoppedAt : nowMs()) - s.start) / 1000; }
/* "18:05", local time */
function hhmm(ms){ var d = new Date(ms); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
/* the header's elapsed-time chip (a button: the clock sheet), and the open sheet's big time */
function refreshSessionUi(){
  var chip = document.querySelector("#view-programs .shTime"), s = sessionFor(ui.planProg, ui.planWeek), stopped = !!(s && s.stoppedAt != null);
  var t = s ? mmss(clockSec(s)) : "", big = document.querySelector("#modal.open .clockBig");
  if(big && s) big.textContent = t;
  var st = document.querySelector("#view-programs .shStart"); if(st) st.hidden = !!s || previewing();
  if(!chip) return;
  chip.hidden = !s; chip.classList.toggle("stopped", stopped);
  if(s){ var c = chip.querySelector(".shClock"); if(c) c.textContent = t; if(!stopped) ensureTicker(); }
}
/* the clock sheet: the time big, when it started (or stopped), Stop the clock, Reset the clock */
function openClockSheet(){
  var s = sessionFor(ui.planProg, ui.planWeek); if(!s) return;
  var stopped = s.stoppedAt != null;
  var row = function(act, ic, t, sub){ return '<button class="li clockRow" data-act="' + act + '"><span class="liI">' + icon(ic) + '</span><span class="liB"><span class="liT">' + t + '</span><span class="liS">' + sub + '</span></span></button>'; };
  openSheet("Workout clock", '<div class="clockSheet"><div class="clockBig' + (stopped ? " stopped" : "") + '">' + mmss(clockSec(s)) + '</div>' +
    '<div class="clockSub">' + (stopped ? "Stopped at " + hhmm(s.stoppedAt) + ". Your next tick starts a new clock." : "Started at " + hhmm(s.start) + (s.how === "button" ? "." : " with your first tick.")) + '</div>' +
    '<div class="list clockList">' + (stopped ? '' : row("clockstop", "stop", "Stop the clock", "End the session here. Your ticks stay.")) +
    row("clockreset", "undo", "Reset the clock", "Clear it. Your ticks stay, and your next tick starts it again.") + '</div></div>', { cls: "clockCard" });
}
/* Stop: the session ends where it is: the time freezes, the ticks stay, the rest timer ends, the screen may sleep */
function stopClock(){
  var s = sessionFor(ui.planProg, ui.planWeek); if(!s || s.stoppedAt != null) return;
  var undo = undoPoint();
  s.stoppedAt = Math.max(nowMs(), s.start); save();
  closeModal(); stopRest(); refreshSessionUi(); updateAwake(true);
  toast("Clock stopped at " + mmss(clockSec(s)), { undo: undo });
}
/* Reset: no session (no start), the ticks stay; the next tick starts a new clock */
function resetClock(){
  var s = sessionFor(ui.planProg, ui.planWeek); if(!s) return;
  var undo = undoPoint();
  db.session = null; save();
  closeModal(); refreshSessionUi(); updateAwake(true);
  toast("Clock reset", { undo: undo });
}

/* ---------- rest durations: the smart rule (2026-11-04; it replaced design §5's "a superset rests only after its
   last lift, for the group's longest restSec, with nothing between 1A and 1B") ---------- */
/* a lift's own rest need: its entry's restSec (home entries without one: 60 s), never its superset's longest;
   warm-up moves and lifts not on the day: none */
function restSecondsFor(prog, exId){
  if(!exId || exId.indexOf("wu:") === 0) return 0;
  var en = progEntry(prog, exId); if(!en) return 0;
  return en.restSec || 60;
}
function firstOpenSet(prog, week, id){ var a = setTicks(prog, week, id); for(var i = 0; i < a.length; i++) if(!a[i]) return i; return -1; }
function nextSetNo(prog, week, id){ var k = firstOpenSet(prog, week, id); return k >= 0 ? k + 1 : null; }
/* the time each set was ticked, kept in today's session (db.session.ticks["<lift>:<set index>"] = ms), so the
   superset rest survives a screen change and an app restart; un-ticking a set forgets its time */
function noteTick(prog, week, exId, i, on){
  var s = sessionFor(prog, week); if(!s) return;
  if(!s.ticks || typeof s.ticks !== "object") s.ticks = {};
  if(on) s.ticks[exId + ":" + i] = nowMs(); else delete s.ticks[exId + ":" + i];
}
/* when set i of a lift was ticked; null when it is not ticked now or its time is unknown (ticked on another day,
   or in a session saved before tick times were kept) */
function tickedAt(prog, week, exId, i){
  var s = sessionFor(prog, week), t = (s && s.ticks) ? s.ticks[exId + ":" + i] : null;
  return (typeof t === "number" && isFinite(t) && setTicks(prog, week, exId)[i]) ? t : null;
}
/* what the timer does right after set i of a lift was ticked: null = no timer, else
   {kind, start, end, total, exId, set, tag} for the lift that comes next. kind "rest": "Next: set 2 · <lift>";
   "ready": "1A <lift> ready in m:ss"; "breath": "then 1B <lift>".
   - the lift is now done (its last set; in a superset this includes the final round): no timer;
   - alone, a finisher, any lift outside a superset: its own rest before its next set;
   - a superset, after a lift that is not the round's last: a 20 s breath, then the round's next lift;
   - a superset, after the round's last lift: a rest until the round's first lift is ready again = its own rest
     counted from its tick in this round (its full rest when that time is unknown), never less than the breath;
     with only the breath left, the breath before the first lift. After the final round: no timer.
   Out-of-order ticks: when the lift's partners are done, its next set is its own, so it rests its own time. */
/* the expected length of one set of a lift (for the even split): 4 s a rep at its target reps (a carry: its seconds), kept
   between 25 and 90 s */
function setSecondsFor(prog, week, id){
  var en = progEntry(prog, id), ex = exById(id) || {}; if(!en) return 40;
  var reps = null, carry = false;
  if(typeof smartOn === "function" && smartOn()){ var t = sessTarget(prog, week, en); reps = t ? t.reps : null; carry = smartKind(en, ex) === "carry"; }
  if(reps == null) reps = en.reps || 10;
  return Math.max(25, Math.min(90, carry ? reps * 3 : reps * 4));
}
/* the rest after the round's lift before the next one: half of what the first lift's own rest leaves after the next lift's
   set, at least BREATH_SEC */
function splitRestFor(prog, week, firstId, nextId){ return Math.max(BREATH_SEC, Math.round((restSecondsFor(prog, firstId) - setSecondsFor(prog, week, nextId)) / 2)); }
function restPlan(prog, week, exId, i){
  if(!exId || exId.indexOf("wu:") === 0) return null;
  var b = blockOf(prog, exId); if(!b || setTicks(prog, week, exId).every(Boolean)) return null;
  var now = nowMs();
  var plan = function(kind, end, id, tag){ return { kind: kind, start: now, end: end, total: Math.ceil((end - now) / 1000), exId: id, set: nextSetNo(prog, week, id), tag: tag || null }; };
  var own = function(){ return plan("rest", now + restSecondsFor(prog, exId) * 1000, exId, null); };
  if(b.kind !== "ss") return own();
  var ids = b.entries.map(function(e){ return e.exerciseId; });
  var tagOf = function(id){ return b.n + String.fromCharCode(65 + ids.indexOf(id)); };
  var open = function(id){ return !isDone(prog, week, id); };
  /* round i = the group's lifts that have a set i, in order */
  var round = ids.filter(function(id){ return setCount(prog, id) > i; }), k = round.indexOf(exId);
  if(k < round.length - 1){
    var nx = round.slice(k + 1).filter(open)[0];
    if(!nx) return own();
    /* 2026-11-12 (his "between next exercises should be enough to get breath back"): the round's rest split evenly, at
       least 30 s, and never less than what the next lift still needs of its own rest since its tick in the last round */
    var x = splitRestFor(prog, week, round[0], nx), tn = i > 0 ? tickedAt(prog, week, nx, i - 1) : null;
    if(tn != null) x = Math.max(x, Math.ceil((tn + restSecondsFor(prog, nx) * 1000 - now) / 1000));
    return plan("breath", now + x * 1000, nx, tagOf(nx));
  }
  if(i >= Math.max.apply(null, ids.map(function(id){ return setCount(prog, id); })) - 1) return null;   /* the final round is over */
  var first = round[0];
  if(first === exId || !open(first) || setCount(prog, first) <= i + 1) return own();
  var t = tickedAt(prog, week, first, i), full = restSecondsFor(prog, first) * 1000;
  var ready = Math.min(now + full, (t == null ? now : t) + full);   /* a clock that stepped back never makes it longer than the full rest */
  return ready - now > BREATH_SEC * 1000 ? plan("ready", ready, first, tagOf(first)) : plan("breath", now + BREATH_SEC * 1000, first, tagOf(first));
}

/* ---------- the rest timer ---------- */
function restState(){ return rest; }
function saveRest(){ try { if(rest) localStorage.setItem(REST_KEY, JSON.stringify(rest)); else localStorage.removeItem(REST_KEY); } catch(e){} }
function loadRest(){
  try { var r = JSON.parse(localStorage.getItem(REST_KEY) || "null"); rest = (r && r.end && r.total && nowMs() < r.end + 5000) ? r : null; if(!rest) localStorage.removeItem(REST_KEY); } catch(e){ rest = null; }
}
function alertText(){ return "Next is " + rest.name + (rest.set ? " (set " + rest.set + ")" : ""); }
/* the Android alert is for real rests: 45 s or more from the tick to the end (±15 s included), never a breath.
   A timer stored before 2026-11-04 has no kind and no start: a rest of its total length */
function alertWanted(r){ return !!r && r.kind !== "breath" && r.end - (r.start != null ? r.start : r.end - r.total * 1000) >= ALERT_MIN_SEC * 1000; }
function scheduleAlert(){ if(alertWanted(rest) && window.Native && Native.notifyAt) Native.notifyAt(REST_NOTE_ID, rest.end, "Rest done", alertText()); }
function cancelAlert(){ if(window.Native && Native.cancelNotify) Native.cancelNotify(REST_NOTE_ID); }
/* start the one timer from a restPlan */
function startRest(p){
  if(rest) cancelAlert();
  var ex = exById(p.exId) || { name: p.exId };
  rest = { kind: p.kind, start: p.start, end: p.end, total: p.total, exId: p.exId, set: p.set, tag: p.tag, name: ex.name };
  saveRest(); scheduleAlert(); renderRest(); ensureTicker();
  if(alertWanted(rest)) askNotifyOnce();   /* the permission sheet promises alerts, so it comes with the first timer that has one */
}
/* stop the timer without a word (a lift's last set): the Next pill comes back */
function stopRest(){ if(!rest) return; cancelAlert(); rest = null; saveRest(); renderRest(); }
function addRest(d){
  if(!rest || rest.doneAt) return;
  var now = nowMs(); rest.end = Math.max(now + 1000, rest.end + d * 1000); rest.total = Math.max(rest.total, Math.ceil((rest.end - now) / 1000));
  cancelAlert(); scheduleAlert(); saveRest(); renderRest();
}
function skipRest(){
  if(!rest) return;
  stopRest();
  if(ui.view === "programs") updateNextBar(ui.planProg, ui.planWeek);
}
function restoreRest(r){
  if(rest) cancelAlert();
  rest = (r && !r.doneAt && r.end > nowMs()) ? r : null;
  if(rest) scheduleAlert();
  saveRest(); renderRest();
}
/* the line under the time: "Next: set 2 · <lift>" (alone: the set first, a long name is what gets cut),
   "1A <lift> ready in 1:20" (after a superset's round) or "then 1B <lift>" (a breath) */
function restLine(r, leftSec, done){
  var tag = r.tag ? r.tag + " " : "";
  if(r.kind === "breath") return "then " + tag + r.name;
  if(r.kind === "ready") return tag + r.name + (done ? " ready" : " ready in " + mmss(leftSec));
  return "Next: " + (r.set ? "set " + r.set + " · " : "") + r.name;
}
/* the floating rest pill (every screen while it runs): "Rest 1:24" or "Breath 0:20", the line above, a draining bar,
   −15 s, +15 s, Skip; a breath wears the superset violet */
function renderRest(){
  var bar = $("#restBar"), nb = $("#nextBar"); if(!bar) return;
  if(!rest){
    if(!bar.hidden || bar.innerHTML){ bar.hidden = true; bar.innerHTML = ""; bar.classList.remove("done", "breath"); }
    if(nb && ui.view === "programs" && nb.innerHTML && !previewing()) nb.hidden = false;
    syncPillClass(); return;
  }
  var leftMs = Math.max(0, rest.end - nowMs()), done = !!rest.doneAt;
  if(!bar.querySelector(".restTime")){
    /* the line under the time runs the pill's full width, so "1A <lift> ready in 1:20" fits on a phone */
    bar.innerHTML = '<div class="restTrack"><i></i></div><div class="restRow"><button class="restMain" data-act="restgo" aria-label="Go to the workout"><span class="restLbl"></span><span class="restTime"></span></button>' +
      '<button class="rbtn" data-act="restminus" aria-label="15 seconds less">−15 s</button><button class="rbtn" data-act="restplus" aria-label="15 seconds more">+15 s</button>' +
      '<button class="rbtn skip" data-act="restskip" aria-label="Skip the rest">' + icon("skip", "sm") + 'Skip</button></div><div class="restNext" data-act="restgo"></div>';
  }
  var breath = rest.kind === "breath", leftSec = Math.ceil(leftMs / 1000);
  bar.hidden = false; bar.classList.toggle("done", done); bar.classList.toggle("breath", breath);
  bar.querySelector(".restLbl").textContent = (breath ? "Breath" : "Rest") + (done ? " done" : "");
  bar.querySelector(".restTime").textContent = done ? "" : mmss(leftSec);
  bar.querySelector(".restNext").textContent = restLine(rest, leftSec, done);
  bar.querySelector(".restTrack > i").style.width = (done ? 0 : Math.round(leftMs / (rest.total * 1000) * 100)) + "%";
  if(nb) nb.hidden = true;
  syncPillClass();
}
/* the one ticker (twice a second while a timer runs or a session is live): drains the pill, ends the rest,
   moves the elapsed chip, lets the screen sleep 20 minutes after the last tick */
function restTick(){
  var now = nowMs();
  if(rest && rest.end - now <= 0){
    if(!rest.doneAt){
      rest.doneAt = now; saveRest();
      if(now - rest.end < 3000 && !document.hidden){ beep(); Native.haptic("heavy"); cancelAlert(); }   /* in the app: no shade alert as well */
    } else if(now - rest.doneAt > 5000){ rest = null; saveRest(); if(ui.view === "programs") updateNextBar(ui.planProg, ui.planWeek); }
  }
  renderRest(); refreshSessionUi(); updateAwake(false);
  if(!tickerNeeded()) stopTicker();
}
function tickerNeeded(){ return !!rest || !!awakeOn || !!(db.session && db.session.date === todayISO() && db.session.stoppedAt == null); }
function ensureTicker(){ if(!tickTimer) tickTimer = setInterval(restTick, 500); }
function stopTicker(){ if(tickTimer){ clearInterval(tickTimer); tickTimer = null; } }
/* a short double beep, only while the app is on screen (WebAudio, unlocked by the tick's tap) */
function primeAudio(){ try { if(!audioCtx){ var AC = window.AudioContext || window.webkitAudioContext; if(AC) audioCtx = new AC(); } if(audioCtx && audioCtx.state === "suspended") audioCtx.resume(); } catch(e){} }
function beep(){
  try {
    if(!audioCtx || document.hidden) return;
    var t0 = audioCtx.currentTime;
    [0, 0.2].forEach(function(dt){ var o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.15);
      o.connect(g); g.connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.17); });
  } catch(e){}
}
/* notification permission: asked once, the first time a timer starts, with one line why (Android app only) */
function askNotifyOnce(){
  if(!window.Native || !Native.isApp || !Native.notifyPermission || (db.settings && db.settings.notifAsked)) return;
  db.settings.notifAsked = true; save();
  Native.notifyPermission("check").then(function(s){
    if(s === "granted" || s === "unavailable") return;
    openSheet("Rest alerts", '<div class="mMsg">Allow notifications so the rest timer can tell you when your rest is over, even with the phone locked.</div>' +
      '<button class="btn primary big block" data-act="notifyallow">' + icon("bell") + 'Allow alerts</button>', { closeLabel: "Not now" });
  });
}

/* ---------- keep awake: a tick under 20 minutes old and the Workout open ---------- */
function updateAwake(force){
  var s = db.session, want = !!(ui.view === "programs" && !document.hidden && s && s.date === todayISO() && s.stoppedAt == null && (nowMs() - s.last) < AWAKE_MS);
  if(force || want !== awakeOn){ awakeOn = want; if(window.Native && Native.keepAwake) Native.keepAwake(want); }
}

/* ---------- Undo: the whole db as it was, plus the timer and the Workout's place ---------- */
function undoPoint(){
  var before = JSON.stringify(db), r = rest ? JSON.parse(JSON.stringify(rest)) : null;
  var u = { planWeek: ui.planWeek, planProg: ui.planProg, planLastProg: ui.planLastProg, nowPrompt: ui.nowPrompt };
  return function(){
    var o = JSON.parse(before);
    Object.keys(db).forEach(function(k){ if(!(k in o)) delete db[k]; });
    for(var k in o) db[k] = o[k];   /* in place: anything holding db keeps seeing the live state */
    if(typeof syncPrograms === "function"){ syncPrograms(); applyDays(); }   /* Part 2: his programs and days as they were */
    save();
    restoreRest(r);
    ui.planWeek = u.planWeek; ui.planProg = u.planProg; ui.planLastProg = u.planLastProg; ui.nowPrompt = u.nowPrompt;
    if($("#modal.open")) closeModal();
    if(ui.view === "programs") renderPlan(); else showView(ui.view);
  };
}

/* ---------- Finish week: v1's week-done, then the summary ---------- */
var DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function onWeekDone(t){
  var pr = t.getAttribute("data-prog"), wk = +t.getAttribute("data-week"), wd = progDoneArr(pr), ix = wd.indexOf(wk);
  if(ix >= 0){ wd.splice(ix, 1); save(); renderPlan(); toast("Week " + wk + " · " + shortName(pr) + " reopened"); return; }   /* v1: the same button undoes */
  var undo = undoPoint(), S = summaryData(pr, wk);
  var AP = getProgram(db.activeProgram);
  wd.push(wk); ui.planWeek = AP.smart ? wk + 1 : Math.min(wk + 1, AP.weeks); maybeCompleteActive();   /* a smart program runs on past 12 (2026-11-11) */
  if(db.session && db.session.prog === pr && db.session.week === wk) db.session = null;
  if(rest){ cancelAlert(); rest = null; saveRest(); }
  save(); renderPlan(); renderRest(); updateAwake(true);
  Native.haptic("success");
  openSummary(S);
  toast("Week " + wk + " · " + shortName(pr) + " finished", { undo: undo });
}
function summaryData(pr, wk){
  var ids = db.programs[pr].entries.map(function(e){ return e.exerciseId; }), full = 0, part = 0;
  ids.forEach(function(id){ var s = doneState(pr, wk, id); if(s === "full") full++; else if(s === "partial") part++; });
  var s = sessionFor(pr, wk);
  return { title: "Week " + wk + " · " + shortName(pr) + " done", full: full, part: part, total: ids.length, mins: s ? Math.max(0, Math.round((s.last - s.start) / 60000)) : null, pbs: bestsToday(ids), next: nextSessionText(pr),
    sugs: (typeof sessionSugs === "function") ? sessionSugs(pr, wk) : [] };   /* Part 2: the new suggestions of this session */
}
function fmtDur(m){ return m == null ? "—" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + pad2(m % 60) + " min"; }
/* a lift's personal best today: today's heaviest beats every earlier diary entry (a first-ever session is not one) */
function bestsToday(ids){
  var today = todayISO(), out = [];
  ids.forEach(function(id){
    var hs = historyFor(id), t = hs.filter(function(h){ return h.ts === today; }), e = hs.filter(function(h){ return h.ts < today; });
    if(!t.length || !e.length) return;
    var kt = Math.max.apply(null, t.map(function(h){ return h.kg; })), ke = Math.max.apply(null, e.map(function(h){ return h.kg; }));
    if(kt > ke) out.push({ id: id, name: (exById(id) || { name: id }).name, kg: kt });
  });
  return out;
}
/* the next session of the same kind in his week schedule, after today: "Next: Day B on Thursday" */
function nextSessionText(pr){
  var gym = !isHomeDay(pr), d0 = weekdayIdx(), plan = weekPlan();
  for(var k = 1; k <= 7; k++){ var j = (d0 + k) % 7, d = plan[j]; if(!d) continue;
    var ref = gym ? (d.type === "strength" ? d.ref : null) : (d.type === "home" ? d.ref : (d.home || null));
    if(ref) return "Next: " + shortName(ref) + " on " + DAY_NAMES[j]; }
  return "";
}
function openSummary(S){
  var h = '<div class="sumSheet"><div class="sumBurst">' + icon("trophy", "xl") + '</div>' +
    '<div class="sumStats"><div class="sumStat"><b class="sumFull">' + S.full + '</b><span>full</span></div>' +
    '<div class="sumStat"><b class="sumPartial">' + S.part + '</b><span>partial</span></div>' +
    '<div class="sumStat"><b class="sumTime">' + fmtDur(S.mins) + '</b><span>time</span></div></div>' +
    (S.pbs.length ? '<div class="sectH">Personal bests today</div><ul class="pbList">' + S.pbs.map(function(p){ return '<li class="pbItem">' + icon("trophy") + '<span class="pbName">' + esc(p.name) + '</span><b class="pbKg">' + p.kg + ' kg</b></li>'; }).join("") + '</ul>' : '') +
    (S.sugs && S.sugs.length ? '<div class="sectH">New suggestions</div><ul class="sugList">' + S.sugs.map(function(g){ return '<li class="sugItem"><span class="sugName">' + esc(g.name) + '</span><b class="sugTo">' + esc(g.to) + '</b></li>'; }).join("") + '</ul>' : '') +
    (S.next ? '<div class="sumNext">' + icon("calendar") + '<span>' + esc(S.next) + '</span></div>' : '') + '</div>';
  openSheet(S.title, h, { cls: "sumCard", closeLabel: "Done" });
}

/* ---------- screen hooks ---------- */
function onViewShown(name){ renderRest(); refreshSessionUi(); updateAwake(true); if(tickerNeeded()) ensureTicker(); }
function sessionInit(){
  loadRest(); renderRest(); if(tickerNeeded()) ensureTicker();
  document.addEventListener("visibilitychange", function(){ if(!document.hidden){ restTick(); updateAwake(true); } else updateAwake(true); });
}
