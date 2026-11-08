"use strict";
/* tracker-smart.js: smart progression (version 2, part 2, 2026-11-04; the owner's office: dossiers/2026-11-04-v2-design,
   design-part2.md §1 and build-log.md "Part 2"). His words: "suggestions each session (based on history) ... like some kind
   of algorithmic awareness in the app"; "by confirming it it will edit program exercise and saves update rep count or weight".

   1. THE RULE (pure functions, unit-tested in a plain vm: verify-v2-smart-rule.mjs), version 2 since 2026-11-08
      (design-part3-smart-rule.md; build-log.md "Part 3"). A target = {kg, reps, misses, goods, level}: misses = misses in
      a row, goods = Good or Easy sessions in a row at the same numbers, level = a hold's "harder version" count.
      smartNext(target, log, opts) after an exercise returns {base, next}: base = what he did (the weight used, the reps
      reached on every set, never lower than his reps target), which becomes the next target with no tap; next = a
      proposal shown as a box only when it changes something. Hard never raises and never lowers; a miss proposes one
      step back from the second miss in a row (not when Hard); a hit decides by the share of the next weight step: up
      to 3 % the weight, over 3 % up to 7 % the weight when Easy or after 2 Goods in a row, over 7 % one rep more (Easy
      two) and at the top of the range the weight at the floor when Easy or after 2 Goods. Holds (the Copenhagen plank,
      the hollow hold, the glute bridge hold) propose +5 s (Easy +10 s) within 20–45 s, then the harder version at 20 s.
      A missing floor is 8 and a missing cap 12 (the spec's "8–12").
   2. THE PROGRAM: "Smart HSR", built in, the same days, exercises, sets, rests and supersets as HSR Base 12 (it points at
      the same day tracks). The engine's getProgram reads SEED_PROGRAM_LIB, so it is added to that object here at load;
      tracker-seed.js stays unchanged.
   3. THE SESSION LOG (additive): db.logs[doneKey] = {reps: [per set, null = the target], kg (weight used, absent = the
      target), effort ("easy" | "hard", absent = Good), date, cy (the program's cycle: its keys repeat in a new run), t (the
      target the session started at, from its first tick: its rows and every recompute read it), wrote (the session has
      set the target), ps (the box that waited before it, put back when it is un-marked)}. Smart mode only: the 12-week
      programs work exactly as before.
      In smart mode the diary entry (db.history) of a lift freezes the weight used, reps = the fewest reps of any set, plus
      the additive fields done (reps per set), effort and target {kg, reps}. Holds and home effort exercises log reps or
      seconds in db.logs only (no kg, so no diary entry, as in version 1).
   4. THE TARGETS (additive): db.targets[exId] = {kg, reps, misses, level, at}: the current target per exercise, shared by
      the smart programs. A lift without one asks for its starting weight on the keypad at its first set.
   Loaded after the seed and the engine (the rule needs only nextWeight / snapDown / pct at call time); everything below
   section 2 runs only when called by the app. */

var SMART_PROGRAM_ID = "smart-hsr";
var HOLD_IDS = ["copenhagen-plank", "hollow-hold", "glute-bridge-hold"];   /* their dose texts carry the 20–45 s → harder version rule */
var HOLD_LO = 20, HOLD_HI = 45, HOLD_STEP = 5;
var RANGE_LO = 8, RANGE_HI = 12;      /* "lifts without one: 8–12" */
var BW_LO = 12, BW_HI = 20;           /* the 45° back extension's own card: "12–20 reps", then a plate */

/* ===================== 1. the rule (pure) ===================== */
function r2(x){ return Math.round(x * 100) / 100; }
function isHoldEx(ex){ return !!ex && HOLD_IDS.indexOf(ex.id) >= 0; }
/* an entry's range: its own (repLo / repHi, set in the program editor), else the lift's window, else 8–12; seconds for a hold */
function smartRange(en, ex){
  if(isHoldEx(ex)) return { lo: HOLD_LO, hi: HOLD_HI, unit: "s" };
  var bw = !!ex && ex.loadType === "bodyweight";
  var lo = (en && en.repLo) || (bw ? BW_LO : (ex && ex.repFloor) || RANGE_LO);
  var hi = (en && en.repHi) || (bw ? BW_HI : (ex && ex.repCap) || RANGE_HI);
  if(hi < lo) hi = lo;
  return { lo: lo, hi: hi, unit: "reps" };
}
/* what the rule needs to know about an entry: its range, hold or not, and one weight step up / down on the lift's grid */
function smartOpts(en, ex){
  var r = smartRange(en, ex), hold = r.unit === "s", bw = !!ex && ex.loadType === "bodyweight";
  return { lo: r.lo, hi: r.hi, hold: hold, step: hold ? HOLD_STEP : 1, bw: bw,
    up: function(kg){ return r2(nextWeight(ex, kg || 0)); },
    down: function(kg){ kg = kg || 0; var d = snapDown(kg - 1e-6, ex);
      if(d == null || !(d < kg - 1e-9) || (!bw && d <= 0)) return kg;   /* the lightest weight stays */
      return r2(Math.max(0, d)); } };
}
/* rule version 2 (2026-11-08, design-part3-smart-rule.md, his "Yes, build it"). t = the target the session was done at
   {kg, reps, misses, goods(, level)}; log = {reps: [done per set], kg (used), effort, partial}. Returns {base, next}:
   - base = what he did, the next session's target with no tap: the weight used; the reps reached on every set when every
     set hit, else the reps target (missed reps never lower it); misses = 0 on a hit, else + 1; goods = Good or Easy hits
     in a row at the same numbers (a hit at new numbers starts at 1; Hard or a miss → 0); a hold keeps its level;
   - next = a proposal only when it differs from base (a box with Use it / Keep), else null:
     a miss: from the second in a row, and not Hard, one step back at the same reps target (none when nothing is lower);
     a hit, Hard: nothing; a hit, Good or Easy: by the share of the next weight step (stepClass); a hold: +5 s (Easy +10 s)
     up to 45 s, then the harder version at 20 s */
function smartNext(t, log, o){
  t = t || {}; log = log || {};
  var tr = t.reps || o.lo, eff = log.effort || "good", hard = eff === "hard", easy = eff === "easy";
  var used = log.kg != null ? log.kg : (t.kg != null ? t.kg : null), done = Array.isArray(log.reps) ? log.reps : [];
  var hit = !log.partial && done.length > 0 && done.every(function(n){ return typeof n === "number" && n >= tr; });
  var b = { kg: used == null ? null : r2(used), reps: hit ? Math.min.apply(null, done) : tr, misses: hit ? 0 : (t.misses || 0) + 1, goods: 0 };
  if(hit && !hard) b.goods = ((kgEq(b.kg, t.kg) && b.reps === tr) ? (t.goods || 0) : 0) + 1;   /* Easy counts as a Good */
  if(o.hold) b.level = t.level || 0;
  var p = !hit ? ((b.misses >= 2 && !hard) ? stepBack(b, o) : null) : hard ? null : o.hold ? holdUp(b, easy, o) : liftUp(b, easy, o);
  return { base: b, next: (p && !(kgEq(p.kg, b.kg) && p.reps === b.reps && (p.level || 0) === (b.level || 0))) ? p : null };
}
function kgEq(a, b){ return (a == null ? null : r2(a)) === (b == null ? null : r2(b)); }
function sameKR(a, b){ return !!a && !!b && kgEq(a.kg, b.kg) && a.reps === b.reps; }
/* the share of the next weight step on the lift's grid: small up to 3 %, medium over 3 % up to 7 %, big over 7 %; compared
   without a division and with a margin, so 3 % and 7 % exactly stay in the lower class; a body-weight lift always big */
function stepClass(w, nx, bw){
  if(bw || !(w > 0)) return "big";
  var d = nx - w;
  return d * 100 <= 3 * w + 1e-9 ? "small" : d * 100 <= 7 * w + 1e-9 ? "medium" : "big";
}
/* a lift hit, Good or Easy: small → the next weight; medium → the next weight when Easy or after 2 Goods in a row; big →
   one rep more (Easy two, never past the cap), at the top of the range the next weight at the floor when Easy or after
   2 Goods in a row */
function liftUp(b, easy, o){
  var w = b.kg || 0, nx = r2(o.up(w)), c = stepClass(w, nx, o.bw);
  if(c === "small" || (c === "medium" && (easy || b.goods >= 2))) return { kind: "weight", kg: nx, reps: b.reps };
  if(c === "medium") return null;
  if(b.reps < o.hi) return { kind: "reps", kg: b.kg, reps: Math.min(o.hi, b.reps + (easy ? 2 : 1)) };
  return (easy || b.goods >= 2) ? { kind: "weight", kg: nx, reps: o.lo } : null;
}
function holdUp(b, easy, o){
  if(b.reps >= o.hi) return { kind: "harder", kg: b.kg, reps: o.lo, level: (b.level || 0) + 1 };
  return { kind: "secs", kg: b.kg, reps: Math.min(o.hi, b.reps + o.step * (easy ? 2 : 1)), level: b.level || 0 };
}
/* one step back at the same reps target: the weight one grid step down; a hold 5 s back (never under 20 s); a body-weight
   lift its plate one step down, or at body weight one rep less (never under its floor); null when nothing is lower */
function stepBack(b, o){
  if(o.hold){ var s = Math.max(o.lo, b.reps - o.step); return s < b.reps ? { kind: "back", kg: b.kg, reps: s, level: b.level || 0 } : null; }
  var w = b.kg || 0;
  if(o.bw && !(w > 0)) return b.reps - 1 >= o.lo ? { kind: "back", kg: 0, reps: b.reps - 1 } : null;
  var d = o.down(w);
  return d < w - 1e-9 ? { kind: "back", kg: r2(d), reps: b.reps } : null;
}
/* estimated 1RM of kg × reps (the engine's rep-max table; past 15 reps it reads 15) */
function smartE1(kg, reps){ return kg / pct(Math.max(1, Math.min(15, Math.round(reps || 15)))); }
/* a hold's starting seconds from a time: down to the 5 s grid, inside 20–45 */
function holdStart(sec){ return Math.max(HOLD_LO, Math.min(HOLD_HI, Math.floor((sec || HOLD_LO) / HOLD_STEP) * HOLD_STEP)); }

/* ===================== 2. the built-in program ===================== */
(function registerSmartHsr(){
  var base = SEED_PROGRAM_LIB["hsr-base-12"];
  SEED_PROGRAM_LIB[SMART_PROGRAM_ID] = { id: SMART_PROGRAM_ID, name: "Smart HSR",
    desc: "Your next weight and reps, suggested each session from what you really did. Same days, sets, rests and supersets as HSR Base 12.",
    days: base.days.slice(), weeks: base.weeks, smart: true, direction: "forward", rule: "smart" };
  if(PROGRAM_ORDER.indexOf(SMART_PROGRAM_ID) < 0) PROGRAM_ORDER.unshift(SMART_PROGRAM_ID);
})();
function isSmartProg(pid){ var P = pid && SEED_PROGRAM_LIB[pid]; return !!(P && P.smart); }
/* the Workout shows a smart program (the active one, or one being previewed) */
function smartOn(){ return typeof shownProgramId === "function" && isSmartProg(shownProgramId()); }
function smartActive(){ return typeof db !== "undefined" && !!db && isSmartProg(db.activeProgram); }

/* ===================== 3. the app's side: targets, the session log, the cards ===================== */
/* the kind of an entry in smart mode: lift | carry | bw (body weight + an optional plate) | hold | effort (home, by effort) */
function smartKind(en, ex){
  ex = ex || {};
  if(isHoldEx(ex)) return "hold";
  if((en && en.dose) || ex.loadType === "effort" || ex.loadType === "timed") return "effort";
  if(ex.loadType === "bodyweight") return "bw";
  if(ex.loadType === "carry") return "carry";
  return "lift";
}
/* the stored target (while just looking at a smart program from a 12-week one: the targets it would start from) */
function smartTarget(exId){
  var src = (typeof ui !== "undefined" && ui && ui.preview && ui.preview.targets) ? ui.preview.targets : (db && db.targets);
  var t = src && src[exId]; return (t && typeof t === "object") ? t : null;
}
function lowerFirst(s){ return s.charAt(0).toLowerCase() + s.slice(1); }
/* the target an entry trains at: the stored one; a body-weight lift or a hold without one starts at its floor (a body-weight
   lift with its version 1 plate, db.tested, if it has one); a lift without one needs its starting weight (null) */
function entryTarget(en){
  var t = smartTarget(en.exerciseId); if(t) return t;
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex);
  if(k === "bw"){ var p = (db && db.tested) ? db.tested[en.exerciseId] : null; return { kg: (typeof p === "number" && p > 0) ? p : 0, reps: smartRange(en, ex).lo, misses: 0 }; }
  if(k === "hold") return { kg: null, reps: HOLD_LO, misses: 0, level: 0 };
  return null;
}
/* the lift a done-key belongs to ("program:day:week:<lift>"; a catalogue id carries its own colon, "fedb:…") */
function keyItem(k){ return String(k).split(":").slice(3).join(":"); }
function logKey(prog, week, exId){ return doneKey(prog, week, exId); }
/* a session's log; one from an earlier run of the program (a new cycle repeats its keys) is not this session's */
function smartLog(prog, week, exId){
  var l = db.logs && db.logs[logKey(prog, week, exId)];
  if(!l || typeof l !== "object") return null;
  return (l.cy != null && l.cy !== cycleOf(db.activeProgram)) ? null : l;
}
function smartLogMut(prog, week, exId){
  if(!db.logs || typeof db.logs !== "object" || Array.isArray(db.logs)) db.logs = {};
  var k = logKey(prog, week, exId), l = smartLog(prog, week, exId);
  if(!l) l = db.logs[k] = {};
  if(!Array.isArray(l.reps)) l.reps = [];
  l.cy = cycleOf(db.activeProgram);
  l.date = todayISO();
  return l;
}
function validT(t){ return !!t && typeof t === "object" && typeof t.reps === "number" && t.reps > 0; }
/* the target a session runs at: the one it started at (stamped at its first tick), else the current one. So a plain tick
   or a null rep keeps meaning "the target at the time" after the target moves on */
function sessTarget(prog, week, en){ var l = prog ? smartLog(prog, week, en.exerciseId) : null; return (l && validT(l.t)) ? l.t : entryTarget(en); }
/* the session starts: its target is kept in its log */
function smartStamp(prog, week, en){
  var l = smartLog(prog, week, en.exerciseId); if(l && (validT(l.t) || l.moved)) return l;   /* a moved log (the fly's swap, tracker.js) holds another lift's numbers */
  var t = entryTarget(en); if(!t) return l;
  l = smartLogMut(prog, week, en.exerciseId); l.t = clone(t);
  return l;
}
/* after a tick changes (tracker-session.js): the first tick starts the session; every tick undone before the lift set the
   target, and the session never started (the current target shows again) */
function smartTicked(prog, week, exId){
  if(!smartActive()) return;
  var en = progEntry(prog, exId); if(!en || smartKind(en, exById(exId)) === "effort") return;
  if(doneState(prog, week, exId) || setTicks(prog, week, exId).some(Boolean)){ smartStamp(prog, week, en); return; }
  var l = smartLog(prog, week, exId); if(l && l.t && !l.wrote) delete l.t;
}
/* the weight shown and lifted this session: the weight used, else the session's target's */
function smartKg(prog, week, en){ var l = prog ? smartLog(prog, week, en.exerciseId) : null, t = sessTarget(prog, week, en); return (l && typeof l.kg === "number") ? l.kg : (t ? t.kg : null); }
/* set i's reps (or seconds): what he logged, else the session's target; null when there is no number (an effort set not logged) */
function smartSetReps(prog, week, en, i){
  var l = smartLog(prog, week, en.exerciseId), v = l && Array.isArray(l.reps) ? l.reps[i] : null;
  if(typeof v === "number") return v;
  var t = sessTarget(prog, week, en), k = smartKind(en, exById(en.exerciseId));
  if(k === "effort") return null;
  return t ? t.reps : null;
}
function unitOf(en, ex){ var k = smartKind(en, ex); return (k === "hold" || (k === "effort" && (ex || {}).defaultUnit === "s")) ? "s" : "reps"; }
/* per side: a lift weighed per leg or arm, and the Copenhagen plank (held on each side) */
function sideOf(ex){ return (/leg|arm/.test((ex || {}).defaultUnit || "") || (!!ex && ex.id === "copenhagen-plank")) ? "/side" : ""; }
/* "65 kg × 12", "16 kg × 36 s/arm", "+2.5 kg × 12", "BW × 14", "25 s"; "" for an unlogged effort set */
function smartWeightText(kind, kg){ return kind === "bw" ? ((kg != null && kg > 0) ? "+" + kg + " kg" : "BW") : kg + " kg"; }
function smartSetText(prog, week, en, i){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex), r = smartSetReps(prog, week, en, i), side = sideOf(ex);
  if(k === "effort") return r == null ? "" : r + (unitOf(en, ex) === "s" ? " s" : " reps");
  if(k === "hold") return r + " s" + side;
  var kg = smartKg(prog, week, en); if(kg == null || r == null) return "";
  if(k === "carry") return kg + " kg × " + (r * 3) + " s/arm";
  return smartWeightText(k, kg) + " × " + r + (k === "lift" ? side : "");
}
/* a set row's button: its reps, or "Log time" / "Log reps" for an effort set not logged yet */
function smartRowLabel(prog, week, en, i){
  var s = smartSetText(prog, week, en, i); if(s) return s;
  var ex = exById(en.exerciseId) || {};
  return smartKind(en, ex) === "effort" ? (unitOf(en, ex) === "s" ? "Log time" : "Log reps") : "";
}
/* the folded card's line: "65 kg × 10, 12", "30, 25, 25 s/side", "25, 20 s" */
function smartDoneText(prog, week, en){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex), n = setCount(prog, en.exerciseId), r = [];
  for(var i = 0; i < n; i++) r.push(smartSetReps(prog, week, en, i));
  var same = r.every(function(x){ return x === r[0]; }), side = sideOf(ex);
  if(k === "effort"){ var got = r.filter(function(x){ return x != null; }); return got.length ? got.join(", ") + (unitOf(en, ex) === "s" ? " s" : " reps") : ""; }
  if(k === "hold") return (same ? r[0] : r.join(", ")) + " s" + side;
  var kg = smartKg(prog, week, en); if(kg == null || r[0] == null) return "";
  if(k === "carry") return kg + " kg × " + (same ? r[0] * 3 : r.map(function(x){ return x * 3; }).join(", ")) + " s/arm";
  return smartWeightText(k, kg) + " × " + (same ? r[0] : r.join(", ")) + (k === "lift" ? side : "");
}
/* a card's texts brought in line in place (after a tick or a logged set), so the tick still pops and the card folds */
function smartRefreshCard(c, prog, week, exId){
  var en = progEntry(prog, exId); if(!c || !en) return;
  /* a suggestion line comes or goes with the lift's first tick of the week: draw the Workout again (the count on "Use all"
     changes with it) */
  if(!!c.querySelector(".sugLine") !== !!sugFor(prog, week, exId)){ renderPlan(); return; }
  [].slice.call(c.querySelectorAll(".setRow .setReps")).forEach(function(b){ b.textContent = smartRowLabel(prog, week, en, +b.getAttribute("data-set")); });
  var dl = c.querySelector(".doneLine"); if(dl) dl.textContent = smartDoneText(prog, week, en);
}
/* the card's big target (prescFor in smart mode): the v1 shape "<b>65 kg</b> · 2 × 12" */
function smartPresc(en, prog, week){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex), t = sessTarget(prog, week, en), side = sideOf(ex);
  if(k === "effort") return { text: en.dose || (en.sets + " × by effort"), tested: true, kind: "effort", weight: null, smart: true };
  if(k === "hold"){ var s = t ? t.reps : HOLD_LO, lv = (t && t.level) ? t.level : 0;
    return { text: "<b>" + s + " s</b>" + side + " · " + en.sets + " × hold" + (lv ? ' · <span class="harder">harder version' + (lv > 1 ? " " + lv : "") + '</span>' : ""), tested: true, kind: "hold", weight: null, smart: true, reps: s }; }
  var kg = smartKg(prog, week, en);
  if(k === "bw"){ var reps = t ? t.reps : BW_LO;
    return (kg != null && kg > 0) ? { text: "<b>+" + kg + " kg</b> plate · " + en.sets + " × " + reps, tested: true, kind: "bw", weight: kg, smart: true, reps: reps }
                                  : { text: "body weight · " + en.sets + " × " + reps, tested: true, kind: "bw", weight: null, smart: true, reps: reps }; }
  if(!t || kg == null) return { text: "tap to set a starting weight", tested: false, kind: "heavy", weight: null, smart: true };
  if(k === "carry") return { text: "<b>" + kg + " kg</b> · " + en.sets + " × " + (t.reps * 3) + " s/arm", tested: true, kind: "heavy", weight: kg, smart: true, reps: t.reps };
  return { text: "<b>" + kg + " kg</b> · " + en.sets + " × " + t.reps + side, tested: true, kind: "heavy", weight: kg, smart: true, reps: t.reps };
}
/* the range line under the target: "Range 8–12 reps · then the weight goes up" */
function smartRangeText(en){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex); if(k === "effort") return "";
  var r = smartRange(en, ex);
  if(k === "hold") return "Range " + r.lo + "–" + r.hi + " s · then the harder version";
  if(k === "carry") return "Range " + (r.lo * 3) + "–" + (r.hi * 3) + " s · then the weight goes up";
  return "Range " + r.lo + "–" + r.hi + " reps · then the " + (k === "bw" ? "plate" : "weight") + " goes up";
}
/* the lift needs its first weight before set 1 can be logged */
function needsStartWeight(en){ var k = smartKind(en, exById(en.exerciseId)); return (k === "lift" || k === "carry") && !smartTarget(en.exerciseId); }

/* ---------- the rep stepper: tap a set's reps (or seconds) → a sheet with − / +; Save logs it and ticks the set ---------- */
var repSheet = null;
function openRepSheet(prog, week, exId, i){
  var en = progEntry(prog, exId); if(!en) return;
  /* a lift with no weight yet: the weight first, then its reps */
  if(needsStartWeight(en)){ onSmartWeight(prog, week, exId, function(){ renderPlan(); openRepSheet(prog, week, exId, i); }); return; }
  var ex = exById(exId) || { name: exId }, k = smartKind(en, ex), u = unitOf(en, ex), cur = smartSetReps(prog, week, en, i);
  if(cur == null) cur = lastEffortValue(exId, i) || (u === "s" ? HOLD_LO : 10);
  var t = sessTarget(prog, week, en), tgt = (k === "effort" || !t) ? null : t.reps;
  repSheet = { prog: prog, week: week, exId: exId, i: i, val: cur, step: (u === "s" ? HOLD_STEP : 1), unit: u, carry: k === "carry" };
  var shown = function(){ return repSheet.carry ? repSheet.val * 3 : repSheet.val; };
  openSheet("Set " + (i + 1) + " · " + ex.name, '<div class="repSheet"><div class="repRow">' +
    '<button class="repBtn" data-act="repstep" data-d="-1" aria-label="One less">' + icon("minus") + '</button>' +
    '<div class="repVal"><b class="repNum">' + shown() + '</b><span class="repUnit">' + (repSheet.carry ? "s/arm" : u === "s" ? "s" : "reps") + '</span></div>' +
    '<button class="repBtn" data-act="repstep" data-d="1" aria-label="One more">' + icon("plus") + '</button></div>' +
    '<div class="repHint">' + (tgt != null ? "Target " + (repSheet.carry ? (tgt * 3) + " s/arm" : tgt + (u === "s" ? " s" : " reps")) : "Log what you did") + '</div>' +
    '<button class="btn primary big block" data-act="repsave">' + icon("check") + 'Save set ' + (i + 1) + '</button></div>', { cls: "repCard" });
}
function repStep(d){
  if(!repSheet) return;
  repSheet.val = Math.max(0, Math.min(999, repSheet.val + d * repSheet.step));
  var n = document.querySelector("#modal.open .repNum"); if(n) n.textContent = repSheet.carry ? repSheet.val * 3 : repSheet.val;
}
function repSave(){
  var s = repSheet; if(!s) return;
  repSheet = null; closeModal();
  var en = progEntry(s.prog, s.exId); if(!en) return;
  var undo = undoPoint(), wasOn = setTicks(s.prog, s.week, s.exId)[s.i];
  var l = smartLogMut(s.prog, s.week, s.exId), t = sessTarget(s.prog, s.week, en), k = smartKind(en, exById(s.exId));
  while(l.reps.length < setCount(s.prog, s.exId)) l.reps.push(null);
  l.reps[s.i] = (k !== "effort" && t && t.reps === s.val) ? null : s.val;   /* the target itself is stored as "the target" */
  save();
  if(!wasOn){ tickSet(s.prog, s.week, s.exId, s.i, undo); return; }   /* logging a set = doing it: the tick, the timer, the diary */
  smartRefreshDone(s.prog, s.week, s.exId);
  smartRefreshCard(cardOf(s.exId), s.prog, s.week, s.exId);   /* in place: the page does not jump */
  toast((exById(s.exId) || {}).name + " · set " + (s.i + 1) + ": " + smartSetText(s.prog, s.week, en, s.i), { undo: undo });
}
function cardOf(exId){ var tk = document.querySelector('#view-programs .planCard [data-act="donetick"][data-item="' + exId + '"]'); return tk ? tk.closest(".planCard") : null; }
/* an effort set's stepper starts at what he logged last time for that set */
function lastEffortValue(exId, i){
  var best = null, bestDate = "";
  for(var k in (db.logs || {})){ var l = db.logs[k]; if(keyItem(k) !== exId || !l || !Array.isArray(l.reps)) continue;
    if(typeof l.reps[i] === "number" && String(l.date || "") >= bestDate){ best = l.reps[i]; bestDate = String(l.date || ""); } }
  return best;
}

/* ---------- the effort chips after an exercise: Easy · Good · Hard (no tap = Good) ---------- */
function effortRowHtml(prog, week, en){
  var k = smartKind(en, exById(en.exerciseId)); if(k === "effort") return "";
  var l = smartLog(prog, week, en.exerciseId), e = (l && l.effort) || "good";
  return '<div class="effortRow"><span class="effLbl">How was it?</span><div class="effChips seg">' + [["easy", "Easy"], ["good", "Good"], ["hard", "Hard"]].map(function(x){
    return '<button class="effChip' + (x[0] === e ? " sel" : "") + '" data-act="effort" data-prog="' + prog + '" data-week="' + week + '" data-item="' + esc(en.exerciseId) + '" data-val="' + x[0] + '" aria-pressed="' + (x[0] === e) + '">' + x[1] + '</button>'; }).join("") + '</div></div>';
}
function onEffort(t){
  var prog = t.getAttribute("data-prog"), week = +t.getAttribute("data-week"), exId = t.getAttribute("data-item"), v = t.getAttribute("data-val");
  if(!progEntry(prog, exId) || ["easy", "good", "hard"].indexOf(v) < 0) return;
  var l = smartLogMut(prog, week, exId);
  if(v === "good") delete l.effort; else l.effort = v;
  save();
  smartRefreshDone(prog, week, exId);
  var row = t.closest(".effortRow");
  if(row) [].slice.call(row.querySelectorAll(".effChip")).forEach(function(b){ var on = b.getAttribute("data-val") === v; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", String(on)); });
  if(window.Native) Native.haptic("light");
}

/* ---------- the weight used (the keypad), and a new lift's starting weight ---------- */
function onSmartWeight(prog, week, exId, then){
  var en = progEntry(prog, exId); if(!en) return;
  var ex = exById(exId) || { name: exId }, k = smartKind(en, ex), t = sessTarget(prog, week, en);
  if(k === "hold" || k === "effort") return;
  if(!t){
    openModal({ title: "Starting weight · " + ex.name, message: "The weight you will lift today (kg). It starts at " + smartRange(en, ex).lo + " reps, and the app suggests the next step after each session.", mode: "number", placeholder: "kg", stepEx: ex,
      onSubmit: function(v){ var n = num(v); if(n == null || n <= 0){ toast("Enter a weight above 0"); return; }
        var undo = undoPoint();
        if(!db.targets || typeof db.targets !== "object") db.targets = {};
        db.targets[exId] = { kg: r2(n), reps: smartRange(en, ex).lo, misses: 0, at: todayISO() };
        if(!Array.isArray(db.targetLog)) db.targetLog = [];
        db.targetLog.push({ exId: exId, date: todayISO(), from: {}, to: { kg: r2(n), reps: smartRange(en, ex).lo }, how: "start" });
        save();
        if(then) then(undo); else { renderPlan(); toast(ex.name + ": starting at " + smartPresc(en, prog, week).text.replace(/<[^>]+>/g, ""), { undo: undo }); } } });
    return;
  }
  var cur = smartKg(prog, week, en), bw = k === "bw";
  openModal({ title: (bw ? "Plate used · " : "Weight used · ") + ex.name, message: bw ? "The plate you held today (kg), 0 = body weight." : "What you really lift today (kg). The next suggestion builds on it.", mode: "number", value: cur != null ? String(cur) : "", placeholder: "kg", stepEx: ex,
    onSubmit: function(v){ if(v == null || String(v).trim() === "") return; var n = num(v); if(n == null || n < 0 || (!bw && n === 0)){ toast(bw ? "Enter 0 or more" : "Enter a weight above 0"); return; }
      var undo = undoPoint(), l = smartLogMut(prog, week, exId), tk = (t && t.kg != null) ? t.kg : (bw ? 0 : null);
      if(tk != null && Math.abs(r2(n) - tk) < 1e-9) delete l.kg; else l.kg = r2(n);
      save(); smartRefreshDone(prog, week, exId); renderPlan();
      toast(ex.name + ": " + smartWeightText(k, r2(n)) + " today", { undo: undo }); } });
}

/* ---------- the diary entry of a smart lift ---------- */
/* the frozen record of what was done: kg used, the fewest reps of any set (v1 reads kg × reps), plus done / effort / target */
function smartHistoryEntry(prog, week, exId){
  var en = progEntry(prog, exId); if(!en) return null;
  var ex = exById(exId) || {}, k = smartKind(en, ex); if(k !== "lift" && k !== "carry") return null;
  var lm = smartLog(prog, week, exId); if(lm && lm.moved) return null;   /* that session is in the diary under the lift it was done as */
  var t = sessTarget(prog, week, en), kg = smartKg(prog, week, en); if(!t || kg == null) return null;
  var n = setCount(prog, exId), done = [];
  for(var i = 0; i < n; i++) done.push(smartSetReps(prog, week, en, i));
  var l = smartLog(prog, week, exId), e = { kg: kg, reps: Math.min.apply(null, done), done: done, target: { kg: t.kg, reps: t.reps } };
  if(l && l.effort) e.effort = l.effort;
  return e;
}
/* a done lift's diary entry follows a later change (reps, weight used, effort) */
function smartRefreshDone(prog, week, exId){
  var st = doneState(prog, week, exId); if(!st) return;
  recordHistory(prog, week, exId, st);
}
/* "Last time: 65 kg × 12, 11 · 7 days ago" (a smart entry carries each set's reps) */
function lastTimeText(lt){ return lt.kg + " kg × " + (Array.isArray(lt.done) && lt.done.length ? lt.done.join(", ") : lt.reps); }

/* ===================== 4. carrying the strength into a smart program ===================== */
var SMART_SINCE = "2026-11-04";   /* db.settings.smartSince: the default switch below has run on this data */
/* stronger = a higher estimated 1RM (a hold: a higher level, then more seconds) */
function weakerTarget(cur, cand, kind){
  if(kind === "hold") return (cur.level || 0) < (cand.level || 0) || ((cur.level || 0) === (cand.level || 0) && cur.reps < cand.reps);
  if(cur.kg == null) return true;
  return smartE1(cur.kg, cur.reps) < smartE1(cand.kg, cand.reps) - 1e-9;
}
/* each lift's target from the ACTIVE 12-week program: the weight and reps it prescribes for the lift's current week (reps
   inside the smart range); the Copenhagen hold from its seconds that week. A target already there stays when it is
   stronger, so a round trip through a 12-week program loses nothing. into = an object to fill instead of db.targets (the
   "Just looking" preview). Runs while srcPid is still the active program (currentWeek reads it). */
function carryTargetsFrom(srcPid, into){
  var P = getProgram(srcPid), mode = (db.programState && db.programState[srcPid] && db.programState[srcPid].rateMode) || DEFAULT_RATE_MODE;
  var out = into || (db.targets = (db.targets && typeof db.targets === "object") ? db.targets : {}), today = todayISO();
  (P.days || []).concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []).forEach(function(d){
    var Dy = db.programs[d]; if(!Dy) return;
    var w = currentWeek(d);
    Dy.entries.forEach(function(en){
      var ex = exById(en.exerciseId); if(!ex) return;
      var k = smartKind(en, ex), cand = null;
      if(k === "hold"){ if(en.exerciseId === "copenhagen-plank") cand = { kg: null, reps: holdStart(holdSec(w)), misses: 0, level: 0 }; }
      else if(k === "lift" || k === "carry"){
        var t = db.tested[en.exerciseId]; if(t == null) return;
        var p = (ladderFor(t, ex, P, mode) || {})[w]; if(!p || p.kg == null) return;
        var r = smartRange(en, ex); cand = { kg: p.kg, reps: Math.max(r.lo, Math.min(r.hi, p.reps)), misses: 0 };
      }
      if(!cand) return;
      var cur = out[en.exerciseId] || (into ? smartTarget(en.exerciseId) : null);
      if(cur && !weakerTarget(cur, cand, k)){ if(into && !out[en.exerciseId]) out[en.exerciseId] = cur; return; }
      cand.at = today;
      out[en.exerciseId] = cand;
    });
  });
  return out;
}
/* the default switch (once per data file, normalize): a phone on a 12-week program moves to Smart HSR with its strength
   (targets), its weeks and its ticks, so his rhythm goes on where it was. HSR Base 12's own state is left untouched, and
   a choice of a 12-week program later is never undone (the flag) */
function smartMigrate(){
  if(!db.settings || db.settings.smartSince === SMART_SINCE) return;
  db.settings.smartSince = SMART_SINCE;
  var from = db.activeProgram, to = SMART_PROGRAM_ID;
  if(isSmartProg(from)) return;
  carryTargetsFrom(from);
  var ps = progStateFor(to), src = progStateFor(from);
  Object.keys(src.progress || {}).forEach(function(d){ ps.progress[d] = { weeksDone: (((src.progress[d] || {}).weeksDone) || []).slice() }; });
  if(!ps.startedAt) ps.startedAt = src.startedAt || nowISO();
  ["done", "sets"].forEach(function(f){ var o = db[f] || {}; Object.keys(o).forEach(function(k){ if(k.indexOf(from + ":") === 0){ var nk = to + k.slice(from.length); if(o[nk] === undefined) o[nk] = clone(o[k]); } }); });
  if(db.session && db.session.program === from) db.session.program = to;
  db.activeProgram = to;
}
/* leaving a smart program for a 12-week one: each lift's 15RM anchor from its target's strength (estimated 1RM at the
   15-rep mark, placed on the lift's grid; bank = the exact value), the engine's carry shape {load, bank} */
function smartCarryOut(){
  var out = { load: {}, bank: {} };
  for(var i = 0; i < db.exercises.length; i++){
    var ex = db.exercises[i], t = smartTarget(ex.id), k = smartKind(null, ex);
    if(t && (k === "lift" || k === "carry") && t.kg > 0){ var a = roundTo(smartE1(t.kg, t.reps) * pct(15), 0.25); out.load[ex.id] = snapNearest(a, ex); out.bank[ex.id] = a; continue; }
    if(t && k === "bw"){ out.load[ex.id] = t.kg > 0 ? t.kg : null; out.bank[ex.id] = null; continue; }
    out.load[ex.id] = db.tested[ex.id] == null ? null : db.tested[ex.id]; out.bank[ex.id] = db.bank[ex.id] == null ? null : db.bank[ex.id];
  }
  return out;
}

/* ===================== 5. suggestions ===================== */
/* rule version 2: when a lift is done, what he did becomes its target (db.targets, with src = the session that set it) and
   a proposal that changes something waits in db.suggest[exId] (additive) = {program, cycle, day, week, date, from: the new
   target {kg, reps(, level)}, to: the proposal, did: [reps per set], kg (when the weight used differed), effort, partial}
   for Use it / Keep on the next session's card. Nothing that changes nothing is ever shown. db.targetLog (additive) =
   [{exId, date, from, to, how}]: every change he chose ("use", "all", "start", the editor's "edit") */
function sameSession(s, prog, week){ return !!s && s.program === db.activeProgram && s.day === prog && s.week === week && (s.cycle || 1) === cycleOf(db.activeProgram); }
/* the session that set a target: its done-key and the program's cycle */
function srcKey(prog, week, exId){ return logKey(prog, week, exId) + "@" + cycleOf(db.activeProgram); }
/* a lift done, or done and changed (effort, a set's reps, the weight used): worked out from the target the session started
   at, never from one it set itself, so nothing counts twice. A session that has set the target before may set it again
   only while it is still the one that set it: a later session, Use it or the editor wins */
function smartSuggestAfter(prog, week, exId, quality){
  var en = progEntry(prog, exId); if(!en) return;
  var ex = exById(exId) || {}, k = smartKind(en, ex); if(k === "effort") return;
  var l = smartStamp(prog, week, en); if(!l || !validT(l.t)) return;
  var key = srcKey(prog, week, exId), cur = smartTarget(exId);
  if(l.wrote && !(cur && cur.src === key)) return;
  if(!db.suggest || typeof db.suggest !== "object" || Array.isArray(db.suggest)) db.suggest = {};
  if(!db.targets || typeof db.targets !== "object") db.targets = {};
  if(!l.wrote){ var old = db.suggest[exId]; if(old && !sameSession(old, prog, week)) l.ps = clone(old); l.wrote = 1; }   /* an earlier box never answered: kept, and back if this is un-marked */
  var n = setCount(prog, exId), did = [], used = smartKg(prog, week, en);
  for(var i = 0; i < n; i++) did.push(smartSetReps(prog, week, en, i));
  var r = smartNext(l.t, { reps: did, kg: used, effort: l.effort, partial: quality === "partial" }, smartOpts(en, ex));
  r.base.src = key; r.base.at = todayISO();
  db.targets[exId] = r.base;
  if(!r.next){ delete db.suggest[exId]; return; }
  var from = { kg: r.base.kg, reps: r.base.reps }; if(k === "hold") from.level = r.base.level || 0;
  var s = { program: db.activeProgram, cycle: cycleOf(db.activeProgram), day: prog, week: week, date: todayISO(), from: from, to: r.next, did: did };
  if(used != null && used !== l.t.kg) s.kg = used;
  if(l.effort) s.effort = l.effort;
  if(quality === "partial") s.partial = true;
  db.suggest[exId] = s;
}
/* a lift un-marked: while it is still the session that set the target, the target from before it and the box that waited
   before it come back; otherwise only its own box goes */
function smartUnsuggest(prog, week, exId){
  var l = smartLog(prog, week, exId), cur = smartTarget(exId);
  if(l && l.wrote && cur && cur.src === srcKey(prog, week, exId)){
    if(!db.suggest || typeof db.suggest !== "object" || Array.isArray(db.suggest)) db.suggest = {};
    if(validT(l.t)) db.targets[exId] = clone(l.t);
    if(l.ps) db.suggest[exId] = l.ps; else delete db.suggest[exId];
    delete l.wrote; delete l.ps;
    return;
  }
  var s = db.suggest && db.suggest[exId]; if(sameSession(s, prog, week)) delete db.suggest[exId];
}
/* the suggestion a card shows: one is waiting and the lift has no tick yet this week (once a set is ticked the session
   runs on the target shown) */
function sugFor(prog, week, exId){
  var s = db.suggest && db.suggest[exId];
  if(!s || !s.to || previewing() || !isSmartProg(db.activeProgram)) return null;
  if(doneState(prog, week, exId) || setTicks(prog, week, exId).some(Boolean) || sameSession(s, prog, week)) return null;
  return s;
}
/* "↑" + "67.5 kg × 8"; a step back "↓" */
function sugParts(s, en){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex), side = sideOf(ex), to = s.to, what;
  var glyph = to.kind === "back" ? "↓" : "↑";
  if(k === "hold") what = (to.kind === "harder" ? "Harder version · " : "") + to.reps + " s" + side;
  else if(k === "carry") what = to.kg + " kg × " + (to.reps * 3) + " s/arm";
  else what = smartWeightText(k, to.kg) + " × " + to.reps + (k === "lift" ? side : "");
  var did = (s.did || []).map(function(x){ return k === "carry" ? x * 3 : x; }).join(", ");
  return { glyph: glyph, what: what, did: "you did " + did + " last time" + (s.effort === "hard" ? ", Hard" : s.effort === "easy" ? ", Easy" : "") + (s.partial ? ", partial" : "") };
}
/* the card's line: "↑ 67.5 kg × 8 · you did 12, 12 last time" with Use it and Keep (a proposal is always a change) */
function sugLineHtml(prog, week, en){
  var s = sugFor(prog, week, en.exerciseId); if(!s) return "";
  var p = sugParts(s, en), id = esc(en.exerciseId);
  return '<div class="sugLine' + (s.to.kind === "back" ? " back" : "") + '"><div class="sugTx"><span class="sugG">' + p.glyph + '</span> <b>' + esc(p.what) + '</b> · ' + esc(p.did) + '</div>' +
    '<div class="sugBtns"><button class="btn primary sm" data-act="suguse" data-ex="' + id + '">' + icon("check") + 'Use it</button>' +
    '<button class="btn sm" data-act="sugkeep" data-ex="' + id + '">Keep</button></div></div>';
}
/* the lifts of a day whose suggestion shows now (program order) */
function pendingOn(prog, week){ var D = db.programs[prog]; return D ? D.entries.filter(function(en){ return !!sugFor(prog, week, en.exerciseId); }) : []; }
/* Today's hero: the suggested target with its arrow */
function heroSug(prog, week, en){ var s = sugFor(prog, week, en.exerciseId); if(!s) return null; var p = sugParts(s, en); return p.glyph + " " + p.what; }
/* the week summary: the suggestions made in this session, in workout order */
function sessionSugs(prog, week){
  var D = db.programs[prog]; if(!D || !isSmartProg(db.activeProgram)) return [];
  return D.entries.filter(function(en){ return sameSession(db.suggest && db.suggest[en.exerciseId], prog, week); }).map(function(en){
    var p = sugParts(db.suggest[en.exerciseId], en); return { name: (exById(en.exerciseId) || { name: en.exerciseId }).name, to: p.glyph + " " + p.what }; });
}
/* the target in words: "65 kg × 12", "45 s", "BW × 14" */
function targetWords(t, en){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex);
  if(k === "hold") return t.reps + " s" + sideOf(ex);
  if(k === "carry") return t.kg + " kg × " + (t.reps * 3) + " s/arm";
  return smartWeightText(k, t.kg) + " × " + t.reps;
}
/* one target change in words: "Target 65 → 67.5 kg", "Target 11 → 12 reps", "Target 25 → 30 s", "Harder version (20 s)" */
function changeWords(from, to, en){
  var k = smartKind(en, exById(en.exerciseId) || {});
  if((to.level || 0) !== (from.level || 0)) return "Harder version" + (to.level > 1 ? " " + to.level : "") + " (" + to.reps + " s)";
  if(k === "hold") return "Target " + from.reps + " → " + to.reps + " s";
  if(from.kg !== to.kg) return k === "bw" ? "Plate " + (from.kg || 0) + " → " + (to.kg || 0) + " kg" : "Target " + from.kg + " → " + to.kg + " kg";
  return "Target " + (k === "carry" ? (from.reps * 3) + " → " + (to.reps * 3) + " s" : from.reps + " → " + to.reps + " reps");
}
/* apply one suggestion: "use" (and "all") takes the proposal, which starts its streaks again (misses and Goods at 0) and
   belongs to no session, so no recompute of an older session overwrites it; "keep" leaves the target as it is (it is
   already what he did; its misses and Goods go on, so a declined step back is offered again at the next miss). Records a
   real change in db.targetLog. Returns {name, cur, next, changed, en} */
function applySuggestion(exId, how){
  var s = db.suggest && db.suggest[exId]; if(!s) return null;
  var en = progEntry(s.day, exId) || { exerciseId: exId }, ex = exById(exId) || { name: exId };
  var cur = entryTarget(en) || { kg: s.from.kg, reps: s.from.reps, misses: 0 }, next = cur, changed = false;
  if(how !== "keep"){
    var nt = { kg: s.to.kg, reps: s.to.reps, misses: 0, goods: 0, at: todayISO() }; if(s.to.level != null) nt.level = s.to.level;
    changed = !kgEq(nt.kg, cur.kg) || nt.reps !== cur.reps || (nt.level || 0) !== (cur.level || 0);
  }
  if(!db.targets || typeof db.targets !== "object") db.targets = {};
  if(changed){
    next = nt;
    var f = { kg: cur.kg, reps: cur.reps }, tt = { kg: next.kg, reps: next.reps };
    if(next.level != null || cur.level != null){ f.level = cur.level || 0; tt.level = next.level || 0; }
    if(!Array.isArray(db.targetLog)) db.targetLog = [];
    db.targetLog.push({ exId: exId, date: todayISO(), from: f, to: tt, how: how });
    db.targets[exId] = next;
  }
  delete db.suggest[exId];
  return { name: ex.name, cur: cur, next: next, changed: changed, en: en };
}
function onSugUse(exId, how){
  var undo = undoPoint(), r = applySuggestion(exId, how); if(!r) return;
  save(); renderPlan();
  toast(r.name + ": " + (how === "keep" ? "kept " + targetWords(r.cur, r.en) : r.changed ? lowerFirst(changeWords(r.cur, r.next, r.en)) : "same target, " + targetWords(r.next, r.en)), { undo: undo });
  if(window.Native) Native.haptic("light");
}
function onSugAll(){
  var prog = ui.planProg, week = ui.planWeek, list = pendingOn(prog, week); if(!list.length) return;
  var undo = undoPoint(), changed = 0;
  list.forEach(function(en){ var r = applySuggestion(en.exerciseId, "all"); if(r && r.changed) changed++; });
  save(); renderPlan();
  toast(list.length + (list.length === 1 ? " suggestion" : " suggestions") + " used · " + changed + (changed === 1 ? " target" : " targets") + " changed", { undo: undo });
  if(window.Native) Native.haptic("success");
}
/* the exercise sheet's "Target changes": newest first, "Target 65 → 67.5 kg on 4 Nov" */
function targetHistoryHtml(exId){
  var L = (Array.isArray(db.targetLog) ? db.targetLog : []).filter(function(x){ return x && x.exId === exId; }); if(!L.length) return "";
  var en = progEntry(dayOfAny(exId) || "", exId) || { exerciseId: exId };
  return '<div class="sheetSec tlSec"><div class="sectH">Target changes</div><div class="tlList">' + L.slice().reverse().slice(0, 12).map(function(x){
    var line = x.how === "start" ? "Started at " + targetWords(x.to, en) : changeWords(x.from || {}, x.to || {}, en);
    return '<div class="tlRow">' + esc(line + " on " + shortDate(x.date)) + '</div>'; }).join("") + '</div></div>';
}

/* ---------- clicks (routed here by the core) ---------- */
function smartClick(act, t){
  if(act === "setreps"){ openRepSheet(t.getAttribute("data-prog"), +t.getAttribute("data-week"), t.getAttribute("data-item"), +t.getAttribute("data-set")); return true; }
  if(act === "repstep"){ repStep(+t.getAttribute("data-d")); return true; }
  if(act === "repsave"){ repSave(); return true; }
  if(act === "effort"){ onEffort(t); return true; }
  if(act === "suguse"){ onSugUse(t.getAttribute("data-ex"), "use"); return true; }
  if(act === "sugkeep"){ onSugUse(t.getAttribute("data-ex"), "keep"); return true; }
  if(act === "suguseall"){ onSugAll(); return true; }
  return false;
}
/* the stored smart data made safe (normalize): logs, targets and suggestions are objects of objects, the history a list;
   anything else is dropped */
function cleanSmartStores(){
  ["logs", "targets", "suggest"].forEach(function(f){
    var v = db[f], out = {};
    if(v && typeof v === "object" && !Array.isArray(v)) for(var k in v){ if(v[k] && typeof v[k] === "object" && !Array.isArray(v[k])) out[k] = v[k]; }
    db[f] = out;
  });
  for(var k in db.targets){ var t = db.targets[k];
    if(!(typeof t.reps === "number" && t.reps > 0) || (t.kg != null && !(typeof t.kg === "number" && isFinite(t.kg) && t.kg >= 0))) delete db.targets[k]; }
  for(var s in db.suggest){ var g = db.suggest[s]; if(!g.to || typeof g.to !== "object" || !g.from || typeof g.from !== "object" || !Array.isArray(g.did)) delete db.suggest[s]; }
  db.targetLog = Array.isArray(db.targetLog) ? db.targetLog.filter(function(x){ return x && typeof x === "object" && typeof x.exId === "string" && x.to && typeof x.to === "object"; }) : [];
}
