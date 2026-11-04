"use strict";
/* tracker-smart.js: smart progression (version 2, part 2, 2026-11-04; the owner's office: dossiers/2026-11-04-v2-design,
   design-part2.md §1 and build-log.md "Part 2"). His words: "suggestions each session (based on history) ... like some kind
   of algorithmic awareness in the app"; "by confirming it it will edit program exercise and saves update rep count or weight".

   1. THE RULE (pure functions, unit-tested in a plain vm: verify-v2-smart-rule.mjs). Double progression inside each lift's
      rep range, adjusted by what he really did. A target = {kg, reps, misses, level}: misses = holds from misses in a row
      before this session; level = a hold's "harder version" count. smartNext(target, log, opts) after an exercise:
      - every set reached the target reps and the effort is not Hard:
        reps < cap → reps + 1 (Easy + 2, never past the cap), same weight;
        reps ≥ cap → the weight one step up the lift's real grid (the engine's nextWeight: its step, the dumbbell grid);
        reps back to the floor, or cap − 2 when that step is bigger than 10 % of the weight (small dumbbells);
      - a set below its target, or a partial (◐) → hold (same target), and it counts as a miss;
        the second miss in a row → one step back (the engine's snapDown), reps at the floor;
      - Hard alone (every set hit) → hold; it never steps back and it ends a run of misses.
      Holds (the Copenhagen plank, the hollow hold, the glute bridge hold) progress in seconds: 20–45 s, +5 s (Easy +10 s),
      at 45 s the harder version from 20 s again; two short holds in a row → 5 s back (never under 20 s).
      Readings where the spec is silent (build-log.md "Part 2"): reps above the target count (the next target builds on the
      reps reached on EVERY set); the weight used counts (a lift done lighter or heavier progresses from what was lifted);
      the 10 % rule is measured on the old weight (the spec's own 10 → 12.5 = 25 %) and does not apply to a body-weight
      lift (its plate sits on top of the body); a missing floor is 8 and a missing cap 12 (the spec's "8–12").
   2. THE PROGRAM: "Smart HSR", built in, the same days, exercises, sets, rests and supersets as HSR Base 12 (it points at
      the same day tracks). The engine's getProgram reads SEED_PROGRAM_LIB, so it is added to that object here at load;
      tracker-seed.js stays unchanged.
   3. THE SESSION LOG (additive): db.logs[doneKey] = {reps: [per set, null = the target], kg (weight used, absent = the
      target), effort ("easy" | "hard", absent = Good), date}. Smart mode only: the 12-week programs work exactly as before.
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
/* the rule after an exercise. t = the target it was done at; log = {reps: [done per set], kg (used), effort, partial} */
function smartNext(t, log, o){
  t = t || {}; log = log || {};
  var kg = log.kg != null ? log.kg : (t.kg != null ? t.kg : null), reps = t.reps || o.lo, level = t.level || 0;
  var eff = log.effort || "good", done = Array.isArray(log.reps) ? log.reps : [];
  var hit = done.length > 0 && done.every(function(n){ return typeof n === "number" && n >= reps; });
  var out = function(kind, k, rp, m, lv){ var x = { kind: kind, kg: k == null ? null : r2(k), reps: rp, misses: m }; if(o.hold) x.level = lv; return x; };
  if(hit && !log.partial && eff !== "hard"){
    var base = Math.max(reps, Math.min.apply(null, done));   /* the reps reached on every set */
    if(o.hold){
      if(base >= o.hi) return out("harder", kg, o.lo, 0, level + 1);
      return out("secs", kg, Math.min(o.hi, base + o.step * (eff === "easy" ? 2 : 1)), 0, level);
    }
    if(base < o.hi) return out("reps", kg, Math.min(o.hi, base + (eff === "easy" ? 2 : 1)), 0);
    var w = kg || 0, nx = o.up(w), big = !o.bw && w > 0 && (nx - w) > 0.10 * w + 1e-9;
    return out("weight", nx, big ? Math.max(o.lo, o.hi - 2) : o.lo, 0);
  }
  if(!hit || log.partial){
    var m = (t.misses || 0) + 1;
    if(m >= 2) return o.hold ? out("back", kg, Math.max(o.lo, reps - o.step), 0, level) : out("back", o.down(kg || 0), o.lo, 0);
    return out("hold", kg, reps, m, level);
  }
  return out("hold", kg, reps, 0, level);   /* Hard alone: hold; it never steps back */
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
function smartTarget(exId){ var t = db && db.targets && db.targets[exId]; return (t && typeof t === "object") ? t : null; }
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
function smartLog(prog, week, exId){ var l = db.logs && db.logs[logKey(prog, week, exId)]; return (l && typeof l === "object") ? l : null; }
function smartLogMut(prog, week, exId){
  if(!db.logs || typeof db.logs !== "object" || Array.isArray(db.logs)) db.logs = {};
  var k = logKey(prog, week, exId), l = db.logs[k];
  if(!l || typeof l !== "object") l = db.logs[k] = {};
  if(!Array.isArray(l.reps)) l.reps = [];
  l.date = todayISO();
  return l;
}
/* the weight shown and lifted this session: the weight used, else the target's */
function smartKg(prog, week, en){ var l = prog ? smartLog(prog, week, en.exerciseId) : null, t = entryTarget(en); return (l && typeof l.kg === "number") ? l.kg : (t ? t.kg : null); }
/* set i's reps (or seconds): what he logged, else the target; null when there is no number (an effort set not logged) */
function smartSetReps(prog, week, en, i){
  var l = smartLog(prog, week, en.exerciseId), v = l && Array.isArray(l.reps) ? l.reps[i] : null;
  if(typeof v === "number") return v;
  var t = entryTarget(en), k = smartKind(en, exById(en.exerciseId));
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
  [].slice.call(c.querySelectorAll(".setRow .setReps")).forEach(function(b){ b.textContent = smartRowLabel(prog, week, en, +b.getAttribute("data-set")); });
  var dl = c.querySelector(".doneLine"); if(dl) dl.textContent = smartDoneText(prog, week, en);
}
/* the card's big target (prescFor in smart mode): the v1 shape "<b>65 kg</b> · 2 × 12" */
function smartPresc(en, prog, week){
  var ex = exById(en.exerciseId) || {}, k = smartKind(en, ex), t = entryTarget(en), side = sideOf(ex);
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
  var ex = exById(exId) || { name: exId }, k = smartKind(en, ex), u = unitOf(en, ex), cur = smartSetReps(prog, week, en, i);
  if(cur == null) cur = lastEffortValue(exId, i) || (u === "s" ? HOLD_LO : 10);
  var t = entryTarget(en), tgt = (k === "effort" || !t) ? null : t.reps;
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
  var l = smartLogMut(s.prog, s.week, s.exId), t = entryTarget(en), k = smartKind(en, exById(s.exId));
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
  var ex = exById(exId) || { name: exId }, k = smartKind(en, ex), t = entryTarget(en);
  if(k === "hold" || k === "effort") return;
  if(!t){
    openModal({ title: "Starting weight · " + ex.name, message: "The weight you will lift today (kg). It starts at " + smartRange(en, ex).lo + " reps, and the app suggests the next step after each session.", mode: "number", placeholder: "kg", stepEx: ex,
      onSubmit: function(v){ var n = num(v); if(n == null || n <= 0){ toast("Enter a weight above 0"); return; }
        var undo = undoPoint();
        if(!db.targets || typeof db.targets !== "object") db.targets = {};
        db.targets[exId] = { kg: r2(n), reps: smartRange(en, ex).lo, misses: 0, at: todayISO() };
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
  var t = entryTarget(en), kg = smartKg(prog, week, en); if(!t || kg == null) return null;
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

/* ---------- clicks (routed here by the core) ---------- */
function smartClick(act, t){
  if(act === "setreps"){ openRepSheet(t.getAttribute("data-prog"), +t.getAttribute("data-week"), t.getAttribute("data-item"), +t.getAttribute("data-set")); return true; }
  if(act === "repstep"){ repStep(+t.getAttribute("data-d")); return true; }
  if(act === "repsave"){ repSave(); return true; }
  if(act === "effort"){ onEffort(t); return true; }
  return false;
}
/* stored logs and targets made safe (normalize): objects of objects, anything else dropped */
function cleanSmartStores(){
  ["logs", "targets"].forEach(function(f){
    var v = db[f], out = {};
    if(v && typeof v === "object" && !Array.isArray(v)) for(var k in v){ if(v[k] && typeof v[k] === "object" && !Array.isArray(v[k])) out[k] = v[k]; }
    db[f] = out;
  });
  for(var k in db.targets){ var t = db.targets[k];
    if(!(typeof t.reps === "number" && t.reps > 0) || (t.kg != null && !(typeof t.kg === "number" && isFinite(t.kg) && t.kg >= 0))) delete db.targets[k]; }
}
