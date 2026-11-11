"use strict";
/* tracker-smart-replay.js: smart progression rule version 2 on the data already on his phone (2026-11-08; the owner's
   office: dossiers/2026-11-04-v2-design, design-part3-smart-rule.md and build-log.md "Part 3"). Runs once per data file
   (db.settings.smartRule), from normalize after the default switch; a fresh install or a version 1 import only gets the mark.
   Under rule version 1 a weight changed on the keypad lived only in that session's log, so the next session's rows went
   back to the old target (his Romanian deadlift: 67.5 kg after he lifted 70), and a hold's OK kept the old target. Here:
   1. every session of the active smart program with a tick keeps the target it showed: a done one the target its diary
      entry was done at (else its waiting suggestion's, else the current one), and it counts as having set the target, so
      a later change to it never takes over; one in progress keeps the current target (the numbers it showed);
   2. each lift's last session is worked out again under rule version 2 (smartNext): what he did becomes the target, and a
      proposal that changes something becomes the waiting box. The last session comes from the diary (lifts and the carry:
      the chain of its smart entries also gives the misses and Goods in a row), else from the waiting suggestion (a hold or
      the back extension), else from the log of its newest done session (a hold or the back extension whose OK was tapped;
      plain ticks leave no log, and then nothing differs from the target);
   3. a target he chose after that session stays: Use it, Use all, the editor or a starting weight (a target-history
      entry), or any target dated after it (a program switch); on the same day such a target counts as earlier only when
      the session started at it;
   4. a waiting suggestion that changes nothing (version 1's holds with their OK) goes. The diary is never changed.
   Rule version 3 (2026-11-11, his rule; design.md part C): the replay above works out the last sessions with the CURRENT
   rule (smartNext), so a file that never had it gets version 3's numbers and boxes and the mark 2026-11-11. A file already
   replayed under version 2 (the mark 2026-11-08, his phone) keeps every target as it is, as he was told ("your current
   numbers stay; the new rule starts at your next session"); only its waiting boxes go, because version 2 made them. */
var SMART_RULE = "2026-11-11";
var SMART_RULE_V2 = "2026-11-08";
var CHOSEN_HOW = ["use", "all", "edit", "start"];

function smartRuleMigrate(){
  if(!db.settings || db.settings.smartRule === SMART_RULE) return;
  if(db.settings.smartRule === SMART_RULE_V2){ db.suggest = {}; db.settings.smartRule = SMART_RULE; return; }
  db.settings.smartRule = SMART_RULE;
  if(!db.targets || typeof db.targets !== "object" || Array.isArray(db.targets)) db.targets = {};
  if(!db.suggest || typeof db.suggest !== "object" || Array.isArray(db.suggest)) db.suggest = {};
  if(!db.logs || typeof db.logs !== "object" || Array.isArray(db.logs)) db.logs = {};
  var before = clone(db.targets), ids = {};
  if(smartActive()) replayStamp(ids);
  db.history.forEach(function(h){ if(isSmartEntry(h)) ids[h.exId] = 1; });
  Object.keys(db.suggest).forEach(function(id){ ids[id] = 1; });
  Object.keys(ids).forEach(function(id){ replayLift(id, before[id] || null); });
}
/* a smart diary entry: it carries the target it was done at and each set's reps */
function isSmartEntry(h){ return !!h && typeof h.exId === "string" && !!h.target && typeof h.target.reps === "number" && Array.isArray(h.done) && h.done.length > 0; }

/* 1. the sessions with a tick keep the target they showed (the ids of the holds and the back extension done are collected
   for step 2: they have no diary) */
function replayStamp(ids){
  var P = db.activeProgram, cyc = cycleOf(P), keys = {};
  [db.done || {}, db.sets || {}].forEach(function(o){ for(var k in o) if(k.indexOf(P + ":") === 0) keys[k] = 1; });
  Object.keys(keys).forEach(function(k){
    var p = k.split(":"), day = p[1], week = +p[2], exId = p.slice(3).join(":");
    if(exId.indexOf("wu:") === 0) return;
    var en = progEntry(day, exId), ex = exById(exId); if(!en || !ex) return;
    var kind = smartKind(en, ex); if(kind === "effort") return;
    var done = db.done[k] === "full" || db.done[k] === "partial";
    if(!done && !(Array.isArray(db.sets && db.sets[k]) && db.sets[k].some(Boolean))) return;
    if(done && (kind === "hold" || kind === "bw")) ids[exId] = 1;
    var l = db.logs[k], mine = !!l && typeof l === "object" && (l.cy == null || l.cy === cyc);
    if(mine && validT(l.t)) return;
    var t = done ? doneTarget(P, cyc, day, week, exId) : null;
    if(!t){ var c = entryTarget(en); if(!c) return; t = clone(c); }
    if(!mine) l = db.logs[k] = { reps: [] };
    if(!Array.isArray(l.reps)) l.reps = [];
    l.cy = cyc; l.t = t; if(done) l.wrote = 1;
  });
}
/* the target a done session was done at: its diary entry's, else its waiting suggestion's */
function doneTarget(P, cyc, day, week, exId){
  for(var i = 0; i < db.history.length; i++){ var h = db.history[i];
    if(isSmartEntry(h) && h.program === P && (h.cycle || 1) === cyc && h.day === day && h.week === week && h.exId === exId) return { kg: h.target.kg, reps: h.target.reps, misses: 0 }; }
  var s = db.suggest[exId];
  if(s && s.from && typeof s.from.reps === "number" && s.program === P && (s.cycle || 1) === cyc && s.day === day && s.week === week){
    var t = { kg: s.from.kg == null ? null : s.from.kg, reps: s.from.reps, misses: 0 }; if(s.from.level != null) t.level = s.from.level; return t; }
  return null;
}

/* 2. one lift's last session under rule version 2 */
function replayLift(exId, cur){
  var ex = exById(exId), rec = ex ? (lastFromDiary(exId) || lastFromSuggestion(exId, cur) || lastFromLog(exId, cur)) : null;
  if(!rec || chosenSince(exId, cur, rec)){ dropNoChange(exId); return; }
  var en = progEntry(rec.day, exId) || { exerciseId: exId }, k = smartKind(en, ex);
  if(k === "effort"){ dropNoChange(exId); return; }
  var r = smartNext(rec.t, rec.log, smartOpts(en, ex, bodyKgNow())), key = rec.program + ":" + rec.day + ":" + rec.week + ":" + exId;
  r.base.src = key + "@" + rec.cycle; r.base.at = rec.date;
  db.targets[exId] = r.base;
  if(r.next){
    var from = { kg: r.base.kg, reps: r.base.reps }; if(k === "hold") from.level = r.base.level || 0;
    var s = { program: rec.program, cycle: rec.cycle, day: rec.day, week: rec.week, date: rec.date, from: from, to: r.next, did: rec.log.reps.slice() };
    if(rec.log.kg != null && !kgEq(rec.log.kg, rec.t.kg)) s.kg = rec.log.kg;
    if(rec.log.effort) s.effort = rec.log.effort;
    if(rec.log.partial) s.partial = true;
    db.suggest[exId] = s;
  } else delete db.suggest[exId];
  /* that session started at rec.t and set the target: a later change to it (an effort, a set's reps) works it out again */
  if(rec.program === db.activeProgram && rec.cycle === cycleOf(db.activeProgram) && (db.done[key] === "full" || db.done[key] === "partial")){
    var l = db.logs[key];
    if(!l || typeof l !== "object" || (l.cy != null && l.cy !== rec.cycle)) l = db.logs[key] = { reps: [] };
    if(!Array.isArray(l.reps)) l.reps = [];
    l.cy = rec.cycle; l.t = clone(rec.t); l.wrote = 1; delete l.ps;
  }
}
/* lifts and the carry: the smart diary entries in the order they were done; the misses and Goods in a row carry from one
   session to the next while it started at the same numbers (the old target kept, or what he did), else they start again */
function lastFromDiary(exId){
  var ex = exById(exId), list = db.history.map(function(h, i){ return { h: h, i: i }; }).filter(function(x){ return isSmartEntry(x.h) && x.h.exId === exId; });
  if(!list.length) return null;
  list.sort(function(a, b){ var ta = String(a.h.ts || ""), tb = String(b.h.ts || ""); return ta < tb ? -1 : ta > tb ? 1 : ((a.h.cycle || 1) - (b.h.cycle || 1)) || ((a.h.week || 0) - (b.h.week || 0)) || (a.i - b.i); });
  var prevT = null, prevB = null, st = { misses: 0 }, rec = null;
  list.forEach(function(x){
    var h = x.h, t = { kg: h.target.kg, reps: h.target.reps, misses: 0 };
    if(prevT && (sameKR(t, prevT) || sameKR(t, prevB))) t.misses = st.misses;
    var log = { reps: h.done.slice(), kg: h.kg, effort: h.effort, partial: h.quality === "partial" };
    var r = smartNext(t, log, smartOpts(progEntry(h.day, exId) || { exerciseId: exId }, ex, bodyKgNow()));
    prevT = t; prevB = r.base; st = { misses: r.base.misses };
    rec = { t: t, log: log, program: h.program, cycle: h.cycle || 1, day: h.day, week: h.week, date: String(h.ts || "") };
  });
  return rec;
}
/* a hold or the back extension: version 1's waiting suggestion holds its last session (the target then, what he did) */
function lastFromSuggestion(exId, cur){
  var s = db.suggest[exId]; if(!s || !s.from || typeof s.from.reps !== "number" || !Array.isArray(s.did) || !s.did.length) return null;
  var t = { kg: s.from.kg == null ? null : s.from.kg, reps: s.from.reps, misses: (cur && cur.misses) || 0 };
  if(s.from.level != null) t.level = s.from.level;
  return { t: t, log: { reps: s.did.slice(), kg: s.kg != null ? s.kg : t.kg, effort: s.effort, partial: !!s.partial }, program: s.program, cycle: s.cycle || 1, day: s.day, week: s.week, date: String(s.date || "") };
}
/* … its OK already tapped: the newest done session's log (OK left the target as it was, with its miss counted) */
function lastFromLog(exId, cur){
  var P = db.activeProgram; if(!cur || !validT(cur) || !isSmartProg(P)) return null;
  var best = null;
  for(var k in db.done){ if(k.indexOf(P + ":") !== 0 || keyItem(k) !== exId || (db.done[k] !== "full" && db.done[k] !== "partial")) continue;
    var p = k.split(":"), w = +p[2]; if(!best || w > best.week) best = { key: k, day: p[1], week: w }; }
  var l = best && db.logs[best.key]; if(!l || typeof l !== "object" || typeof l.date !== "string" || !progEntry(best.day, exId)) return null;
  var t = { kg: cur.kg == null ? null : cur.kg, reps: cur.reps, misses: 0 }; if(cur.level != null) t.level = cur.level;
  var n = setCount(best.day, exId), did = [];
  for(var i = 0; i < n; i++) did.push(Array.isArray(l.reps) && typeof l.reps[i] === "number" ? l.reps[i] : t.reps);
  var partial = db.done[best.key] === "partial";
  if(partial || !did.every(function(x){ return x >= t.reps; })) t.misses = Math.max(0, (cur.misses || 0) - 1);
  return { t: t, log: { reps: did, kg: typeof l.kg === "number" ? l.kg : t.kg, effort: l.effort, partial: partial }, program: P, cycle: cycleOf(P), day: best.day, week: best.week, date: l.date, fromLog: true };
}
/* 3. a target he chose after that session (or any target dated after it) stays. The same day: a target-history entry or
   the target's date counts as earlier only when the session started at it (from a log the session's own target is not
   known, so there a same-day choice always stays) */
function chosenSince(exId, cur, rec){
  var d = rec.date, L = Array.isArray(db.targetLog) ? db.targetLog : [];
  for(var i = 0; i < L.length; i++){ var x = L[i];
    if(!x || x.exId !== exId || CHOSEN_HOW.indexOf(x.how) < 0 || typeof x.date !== "string") continue;
    if(x.date > d || (x.date === d && (rec.fromLog || !sameKR(x.to, rec.t)))) return true; }
  if(cur && typeof cur.at === "string"){ if(cur.at > d) return true; if(cur.at === d && !rec.fromLog && !sameKR(cur, rec.t)) return true; }
  return false;
}
/* 4. a waiting suggestion that changes nothing goes */
function dropNoChange(exId){
  var s = db.suggest[exId], t = db.targets[exId]; if(!s || !s.to) return;
  if(s.to.kind === "hold" || (t && kgEq(s.to.kg, t.kg) && s.to.reps === t.reps && (s.to.level || 0) === (t.level || 0))) delete db.suggest[exId];
}
