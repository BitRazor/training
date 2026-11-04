"use strict";
/* tracker-session.js: what happens while you lift (version 2, 2026-11-04; design.md §5).
   - set ticks: db.sets[doneKey] = [bool…], one per set of the entry (additive; version 1 ignores it). The lift's
     done state stays in db.done exactly as in v1 (applyMark writes the frozen diary): ticking the last set marks it
     full, un-ticking a set of a full lift un-marks it; ✓ ticks every set, ◐ leaves them and marks partial;
   - the session: the first tick of a day-track and week today starts db.session {start, last}; Finish clears it;
   - the rest timer: one at a time, kept on its end time (localStorage "training-tracker:v1:rest"), so a re-render,
     a restart or a locked phone shows the right time; ±15 s, Skip; at zero a beep (only while visible), a buzz
     and a flash; an Android alert scheduled for the end time (native.js, @capacitor/local-notifications);
   - keep awake while a tick is under 20 minutes old and the Workout is open;
   - Undo: a toast with Undo for 5 s after a set or lift tick and a week finish (the whole db as it was);
   - Finish week: the v1 week-done, then a summary sheet (full, partial, time, today's bests, the next session).
   Loaded after tracker-plan.js; the core (tracker.js) routes the clicks here. */

/* the app's clock (tests replace it) */
function nowMs(){ return Date.now(); }
var REST_KEY = STORE_KEY + ":rest", REST_NOTE_ID = 4711, AWAKE_MS = 20 * 60000;
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
  if(!progEntry(prog, exId)) return;
  primeAudio();
  var undo = undoPoint(), arr = setTicks(prog, week, exId), on = !arr[i], st0 = doneState(prog, week, exId);
  arr[i] = on;
  if(!db.sets) db.sets = {};
  db.sets[doneKey(prog, week, exId)] = arr;
  if(on){ touchSession(prog, week); if(arr.every(Boolean) && st0 !== "full") applyMark(prog, week, exId, "full"); }
  else if(st0 === "full") applyMark(prog, week, exId, "full");   /* un-ticking a set of a full lift un-marks it (v1 untick) */
  save();
  var st = doneState(prog, week, exId), ex = exById(exId) || { name: exId };
  ui.nowPrompt = null;
  if(on){
    var b = blockOf(prog, exId), sec = restSecondsFor(prog, exId);
    if(b && b.kind === "ss" && b.idx < b.entries.length - 1) ui.nowPrompt = { prog: prog, week: week, exId: b.entries[b.idx + 1].exerciseId, tag: b.n + String.fromCharCode(66 + b.idx) };
    else if(sec > 0){ var nx = nextAfterRest(prog, week, exId); if(nx) startRest(sec, nx); }
    Native.haptic(st === "full" && st0 !== "full" ? "success" : "light");
  }
  refreshCardState(prog, week, exId, i);
  updateDoneCounts(prog, week); updateNextBar(prog, week); refreshSessionUi(); updateAwake(true);
  toast(st === "full" && st0 !== "full" ? ex.name + " done" : ex.name + " · set " + (i + 1) + " of " + arr.length + (on ? "" : " unticked"), { undo: undo });
}
/* the lift ✓ (all sets) and ◐ (partial), and a warm-up move's tick */
function onMark(t, mark){
  var prog = t.getAttribute("data-prog"), week = +t.getAttribute("data-week"), item = t.getAttribute("data-item"), wu = item.indexOf("wu:") === 0;
  var undo = wu ? null : undoPoint();
  applyMark(prog, week, item, mark);
  var st = doneState(prog, week, item);
  if(!wu && mark === "full"){ if(!db.sets) db.sets = {}; if(st === "full") db.sets[doneKey(prog, week, item)] = allSets(prog, item, true); else delete db.sets[doneKey(prog, week, item)]; save(); }
  if(st) touchSession(prog, week);
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
}
function popEl(el){ el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

/* ---------- the session (first tick → last tick, one day-track and week, today) ---------- */
function touchSession(prog, week){
  var now = nowMs(), today = todayISO(), s = db.session;
  if(!s || s.prog !== prog || s.week !== week || s.date !== today || s.program !== db.activeProgram) db.session = { program: db.activeProgram, prog: prog, week: week, date: today, start: now, last: now };
  else s.last = Math.max(s.last || now, now);   /* a clock that steps back never shortens the session below zero */
  save();
}
function sessionFor(prog, week){ var s = db.session; return (s && !previewing() && s.prog === prog && s.week === week && s.date === todayISO() && s.program === db.activeProgram) ? s : null; }
/* the header's elapsed-time chip */
function refreshSessionUi(){
  var chip = document.querySelector("#view-programs .shTime"); if(!chip) return;
  var s = sessionFor(ui.planProg, ui.planWeek);
  chip.hidden = !s;
  if(s){ var c = chip.querySelector(".shClock"); if(c) c.textContent = mmss((nowMs() - s.start) / 1000); ensureTicker(); }
}

/* ---------- rest durations (design §5) ---------- */
/* alone or finisher: the entry's restSec; a superset rests only after its last lift, for the group's longest
   restSec (none between 1A and 1B); home entries without one: 60 s; warm-up moves: none */
function restSecondsFor(prog, exId){
  if(!exId || exId.indexOf("wu:") === 0) return 0;
  var P = db.programs[prog], b = blockOf(prog, exId); if(!P || !b) return 0;
  if(b.kind === "ss"){ if(b.idx < b.entries.length - 1) return 0; return Math.max.apply(null, b.entries.map(function(e){ return e.restSec || 0; })) || 60; }
  return b.entry.restSec || 60;
}
function firstOpenSet(prog, week, id){ var a = setTicks(prog, week, id); for(var i = 0; i < a.length; i++) if(!a[i]) return i; return -1; }
/* what comes after this rest: the next open set in the lift (a superset: the round's first lift with sets left),
   else the next lift not done; null when the day is done (then no timer) */
function nextAfterRest(prog, week, exId){
  var b = blockOf(prog, exId), cand = (b && b.kind === "ss") ? b.entries.map(function(e){ return e.exerciseId; }) : [exId];
  for(var i = 0; i < cand.length; i++){ if(isDone(prog, week, cand[i])) continue; var k = firstOpenSet(prog, week, cand[i]); if(k >= 0) return { exId: cand[i], set: k + 1 }; }
  var n = nextUndoneLift(prog, week); if(!n) return null;
  var k2 = firstOpenSet(prog, week, n);
  return { exId: n, set: k2 >= 0 ? k2 + 1 : 1 };
}

/* ---------- the rest timer ---------- */
function restState(){ return rest; }
function saveRest(){ try { if(rest) localStorage.setItem(REST_KEY, JSON.stringify(rest)); else localStorage.removeItem(REST_KEY); } catch(e){} }
function loadRest(){
  try { var r = JSON.parse(localStorage.getItem(REST_KEY) || "null"); rest = (r && r.end && r.total && nowMs() < r.end + 5000) ? r : null; if(!rest) localStorage.removeItem(REST_KEY); } catch(e){ rest = null; }
}
function alertText(){ return "Next is " + rest.name + (rest.set ? " (set " + rest.set + ")" : ""); }
function scheduleAlert(){ if(rest && window.Native && Native.notifyAt) Native.notifyAt(REST_NOTE_ID, rest.end, "Rest done", alertText()); }
function cancelAlert(){ if(window.Native && Native.cancelNotify) Native.cancelNotify(REST_NOTE_ID); }
function startRest(sec, nx){
  if(rest) cancelAlert();
  var ex = exById(nx.exId) || { name: nx.exId };
  rest = { end: nowMs() + sec * 1000, total: sec, exId: nx.exId, set: nx.set, name: ex.name };
  saveRest(); scheduleAlert(); renderRest(); ensureTicker(); askNotifyOnce();
}
function addRest(d){
  if(!rest || rest.doneAt) return;
  var now = nowMs(); rest.end = Math.max(now + 1000, rest.end + d * 1000); rest.total = Math.max(rest.total, Math.ceil((rest.end - now) / 1000));
  cancelAlert(); scheduleAlert(); saveRest(); renderRest();
}
function skipRest(){
  if(!rest) return;
  cancelAlert(); rest = null; saveRest(); renderRest();
  if(ui.view === "programs") updateNextBar(ui.planProg, ui.planWeek);
}
function restoreRest(r){
  if(rest) cancelAlert();
  rest = (r && !r.doneAt && r.end > nowMs()) ? r : null;
  if(rest) scheduleAlert();
  saveRest(); renderRest();
}
/* the floating rest pill (every screen while it runs): "Rest 1:24", the next set, a draining bar, −15 s, +15 s, Skip */
function renderRest(){
  var bar = $("#restBar"), nb = $("#nextBar"); if(!bar) return;
  if(!rest){
    if(!bar.hidden || bar.innerHTML){ bar.hidden = true; bar.innerHTML = ""; bar.classList.remove("done"); }
    if(nb && ui.view === "programs" && nb.innerHTML && !previewing()) nb.hidden = false;
    syncPillClass(); return;
  }
  var leftMs = Math.max(0, rest.end - nowMs()), done = !!rest.doneAt;
  if(!bar.querySelector(".restTime")){
    bar.innerHTML = '<div class="restTrack"><i></i></div><div class="restRow"><button class="restMain" data-act="restgo" aria-label="Go to the workout"><span class="restLbl"></span><span class="restTime"></span><span class="restNext"></span></button>' +
      '<button class="rbtn" data-act="restminus" aria-label="15 seconds less">−15 s</button><button class="rbtn" data-act="restplus" aria-label="15 seconds more">+15 s</button>' +
      '<button class="rbtn skip" data-act="restskip" aria-label="Skip the rest">' + icon("skip", "sm") + 'Skip</button></div>';
  }
  bar.hidden = false; bar.classList.toggle("done", done);
  bar.querySelector(".restLbl").textContent = done ? "Rest done" : "Rest";
  bar.querySelector(".restTime").textContent = done ? "" : mmss(Math.ceil(leftMs / 1000));
  bar.querySelector(".restNext").textContent = "Next: " + (rest.set ? "set " + rest.set + " · " : "") + rest.name;   /* the set first: a long name is what gets cut */
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
function tickerNeeded(){ return !!rest || !!awakeOn || !!(db.session && db.session.date === todayISO()); }
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
  var s = db.session, want = !!(ui.view === "programs" && !document.hidden && s && s.date === todayISO() && (nowMs() - s.last) < AWAKE_MS);
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
  wd.push(wk); ui.planWeek = Math.min(wk + 1, getProgram(db.activeProgram).weeks); maybeCompleteActive();
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
  return { title: "Week " + wk + " · " + shortName(pr) + " done", full: full, part: part, total: ids.length, mins: s ? Math.max(0, Math.round((s.last - s.start) / 60000)) : null, pbs: bestsToday(ids), next: nextSessionText(pr) };
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
/* the next session of the same kind in the week schedule, after today: "Next: Day B on Thursday" */
function nextSessionText(pr){
  var gym = !isHomeDay(pr), d0 = weekdayIdx();
  for(var k = 1; k <= 7; k++){ var j = (d0 + k) % 7, d = CURRENT_WEEK[j]; if(!d) continue;
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
    (S.next ? '<div class="sumNext">' + icon("calendar") + '<span>' + esc(S.next) + '</span></div>' : '') + '</div>';
  openSheet(S.title, h, { cls: "sumCard", closeLabel: "Done" });
}

/* ---------- screen hooks ---------- */
function onViewShown(name){ renderRest(); refreshSessionUi(); updateAwake(true); if(tickerNeeded()) ensureTicker(); }
function sessionInit(){
  loadRest(); renderRest(); if(tickerNeeded()) ensureTicker();
  document.addEventListener("visibilitychange", function(){ if(!document.hidden){ restTick(); updateAwake(true); } else updateAwake(true); });
}
