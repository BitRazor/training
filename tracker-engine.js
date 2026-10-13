"use strict";
/* training-tracker — the 12-week load ALGORITHM + equipment / progression engine.
   Extracted from tracker-seed.js (2026-06-25) so the seed file stays pure data and this
   math engine has headroom to grow (e.g. the per-program pace picker). Every name is still a
   global var/function (no modules). tracker-seed.js + this file both load before the views and
   tracker.js, so runtime cross-references (ladderFor → getProgram → SEED_PROGRAM_LIB /
   DEFAULT_PROGRAM_ID, all defined in the seed file) resolve when called. No math changed in the
   split — only its home; the 8 verify harnesses pin that the behaviour is identical. */

var TOTAL_WEEKS = 12;

/* ---- the 12-week algorithm ----
   est 1RM from a tested 15RM, add a weekly strength bump, then weight = 1RM × rep-max% for that week's reps. */
var REP_LADDER = [15,14,13,12,11,10,9,8,8,7,6,6];   // weeks 1..12 (most reps → 6)
var WEEKLY_GAIN = 0.01;                              // +1%/week baseline strength gain (novice, conservative)
/* plateau-breaker dynamic rate: the curve flexes BASE±0.5%/wk and self-balances; the dynamic 1RM
   may run at most LEAD_CAP above the flat BASE reference before it must pay the lead back. */
var GAIN_HIGH = WEEKLY_GAIN + 0.005;                 // push while a lift is stuck adding reps
var GAIN_LOW  = WEEKLY_GAIN - 0.005;                 // ease the week after a push (pay it back)
var LEAD_CAP  = 0.03;                                // max the dynamic 1RM may lead the flat reference
var PCT_1RM = {1:1.00,2:0.95,3:0.93,4:0.90,5:0.87,6:0.85,7:0.83,8:0.80,9:0.77,10:0.75,11:0.72,12:0.70,13:0.67,14:0.66,15:0.65};
function pct(reps){ return PCT_1RM[reps] || PCT_1RM[15]; }
function repForWeek(w){ return REP_LADDER[(w||1)-1] || REP_LADDER[0]; }
function phaseForWeek(w){ return w<=1?"System Flush":(w<=4?"Anchor Hypertrophy":(w<=8?"Tension Transition":"Max Stiffness")); }
function roundTo(x,step){ return Math.round(x/step)*step; }
/* rounding increment scaled to the lift's load — lighter lifts step 0.5 kg so they actually
   climb (a fixed 2.5 kg step left e.g. lateral raises frozen for months); heavy barbell/stack
   lifts step 2.5 kg (loadable plates). Threshold 20 keeps week-1 == the tested value exactly
   for every current lift (all tested <20 are .5-clean; all tested ≥20 are 2.5-clean). */
function loadStep(t){ return t==null?2.5:(t<20?0.5:2.5); }
function est1RM(tested15){ return tested15==null?null:(tested15 / pct(15)); }
/* prescribed weight for ANY loaded lift at week w, from its tested 15RM:
   1RM estimate → +WEEKLY_GAIN/week strength bump → 1RM × rep-max %(that week's reps).
   NOTE: superseded in-app by ladderFor (gated/direction-aware); retained as the underlying
   continuous-curve reference that verify-ui3 / verify-redesign / review-weights assert against. */
function calcWeight(tested15, w){
  if(tested15==null) return null;
  var orm = est1RM(tested15) * Math.pow(1+WEEKLY_GAIN, (w||1)-1);
  return roundTo(orm * pct(repForWeek(w)), loadStep(tested15));
}
/* bodyweight holds (Copenhagen plank): no load, so progress the HOLD TIME instead — 20 s → 40 s across the block */
function holdSec(w){ return 20 + Math.round(((w||1)-1) * 20 / (TOTAL_WEEKS-1)); }
/* gap/prehab lifts: reps stay fixed (prehab dose), but the working weight still creeps +1%/week */
function gapWeight(tested, w){ return tested==null?null:roundTo(tested*Math.pow(1+WEEKLY_GAIN,(w||1)-1), loadStep(tested)); }

/* GATED 12-week plan for one lift (the fix for "easier" weeks):
   the strength curve (1RM × +gain/wk × rep-max%) is computed continuously, but the WEIGHT only
   steps up by the lift's real increment `inc` once that curve has climbed a full step — and reps
   only drop on a week the weight actually steps up. Between steps, weight AND reps are HELD
   ("waiting"), so no week is ever easier than the one before. Returns {1..12:{kg,reps}}. */
/* inverse of the rep-max table: the reps (6–15) whose %1RM is closest to `frac` */
function invpct(frac){ var best=6, bd=9; for(var r=6; r<=15; r++){ var d=Math.abs(pct(r)-frac); if(d<bd){ bd=d; best=r; } } return best; }

/* UNIVERSAL gated double-progression — one rule for every lift, every starting weight, never easier:
   - if the strength curve has earned a full plate at this week's planned reps → step the weight, reps = ladder (classic HSR for lifts you can load heavy);
   - else if reps already hit the ceiling → the reps earned the plate: add it, reset reps to where it's equally hard;
   - else → not strong enough for a plate yet, so add ONE rep (progress via reps; never flat, never easier).
   A strong lifter's heavy lift steps weight most weeks (HSR descent); a weak lifter's same lift (or any light lift)
   climbs reps until a plate fits — automatically, no per-lift tiers. Returns {1..12:{kg,reps}}. */
/* ---- EQUIPMENT CATEGORIES (data-driven; add one entry + tag exercises with `cat` to extend) ----
   A lift's weight STEP comes from its category default, overridable per-category (Settings) or
   per-exercise (the card chip). model:"grid" = the dumbbell 1/2.5 grid; "fixed" = +inc.
   `future:true` cats stay hidden in Settings until a program actually uses one (no clutter). */
var EQUIP_CATS = {
  db:     { id:"db",     label:"Dumbbells",                equip:"db", model:"grid",  hint:"1 kg under 10, 2.5 kg over" },
  single: { id:"single", label:"Single-plate machine",     inc:1.25,   model:"fixed", hint:"one plate added" },
  cable:  { id:"cable",  label:"Cable / stack machine",    inc:2.5,    model:"fixed", hint:"selectorized stack (often 5)" },
  bar:    { id:"bar",    label:"Barbell (plate per side)", inc:2.5,    model:"fixed", hint:"1.25 kg per side" },
  kb:     { id:"kb",     label:"Kettlebell",               inc:4,      model:"fixed", hint:"fixed bells (4/8/12…)", future:true }
};
var EQUIP_CAT_ORDER = ["db","single","cable","bar","kb"];
/* resolve a lift's gear: per-exercise override (db.gear) → per-category override (db.gearByCat)
   → its category default (EQUIP_CATS) → the exercise's own seed field. Works with no db (harness). */
function gearFor(ex){
  var D = (typeof db !== "undefined") ? db : null;
  if(D && D.gear && D.gear[ex.id]) return D.gear[ex.id];
  if(D && D.gearByCat && ex.cat && D.gearByCat[ex.cat]) return D.gearByCat[ex.cat];
  var c = ex.cat && EQUIP_CATS[ex.cat];
  if(c) return c.equip ? {equip:c.equip} : {inc:c.inc};
  return ex.equip ? {equip:ex.equip} : {inc:ex.inc || 2.5};
}
function stepLabel(ex){ var g = gearFor(ex); return g.equip === "db" ? "DB grid" : ((g.inc||2.5) + " kg"); }
/* the next REAL achievable weight above w for this lift's (resolved) gear. The grid is ABSOLUTE —
   multiples of the step (or the dumbbell set), the same grid snapDown and the reverse wave use — so a
   block walks on loadable weights even from an anchor that isn't on the grid; from such an anchor the
   first step is at least half an increment (never a 0.25 kg nudge that drops the reps). */
function nextWeight(ex, w){
  var g = gearFor(ex);
  if(g.equip === "db") return w < 9.999 ? Math.floor(w + 1e-9) + 1 : (Math.floor(w/2.5 + 1e-9) + 1) * 2.5;
  var inc = g.inc || 2.5;
  return Math.ceil((w + inc/2) / inc - 1e-9) * inc;
}
/* largest REAL achievable weight <= target on this lift's grid (used by the REVERSE direction) */
function snapDown(target, ex){
  if(target==null) return null;
  var g = gearFor(ex);
  if(g.equip === "db"){
    if(target < 10) return Math.max(1, Math.floor(target + 1e-9));
    return Math.floor(target/2.5 + 1e-9) * 2.5;
  }
  var inc = g.inc || 2.5;
  return Math.floor(target/inc + 1e-9) * inc;
}

/* ---- PROGRESSION MODES — the per-program climb-rate picker (FORWARD direction only) ----
   plateau = the shipped self-balancing dynamic flex (default). The 3 fixed tiers are FRONT-LOADED:
   the weekly gain starts fast and decays to its end value by the final week, because the evidence's
   single most robust finding is that real strength gains are front-loaded — a flat curve is the one
   shape the literature contradicts (knowledge/progression-evidence-2026-06-24.md). Average ≈ (start+end)/2:
   slower ~0.3%/wk · standard ~1%/wk · steep ~2.25%/wk. The reverse wave ignores all of this. */
var PROGRESSION_MODES = {
  plateau:  { id:"plateau",  label:"Plateau",  dynamic:true,           hint:"Smart — pushes a stuck lift, eases after" },
  slower:   { id:"slower",   label:"Slower",   start:0.005, end:0.001, hint:"Gentle ~0.3%/wk — for lifts you're already strong on" },
  standard: { id:"standard", label:"Standard", start:0.015, end:0.005, hint:"~1%/wk, front-loaded — the all-round speed" },
  steep:    { id:"steep",    label:"Steep",    start:0.030, end:0.015, hint:"Aggressive ~2.25%/wk — a brand-new lift, 12-wk block" }
};
var PROGRESSION_MODE_ORDER = ["plateau","slower","standard","steep"];
var DEFAULT_RATE_MODE = "plateau";
/* the front-loaded weekly gain applied to REACH week w (w = 2..weeks): linear decay start→end. */
function frontLoadRate(mode, w, weeks){ var d = weeks>2 ? (w-2)/(weeks-2) : 0; return mode.start + (mode.end - mode.start)*d; }

/* DIRECTION-AWARE block for one lift, driven by a PROGRAM (its repLadder + direction + weeks) and
   a forward-only RATE MODE (PROGRESSION_MODES — plateau default, or a front-loaded tier). Defaults
   to the base (forward) program + plateau so legacy 2/3-arg callers behave exactly as before. */
/* per-lift rep WINDOW (owner 2026-10-13, kontor/dossiers/2026-10-13-reps/rep-plan.md): ex.repFloor / ex.repCap clamp
   the program's rep ladder; double progression stops at the cap; a capped start (RDL 10 → 6) begins at the
   10RM worked out from the tested 15RM. Lifts without a window behave exactly as before. */
function repWindow(ex){ return { lo: (ex && ex.repFloor) || 1, hi: (ex && ex.repCap) || 99 }; }
function clampReps(r, ex){ var w = repWindow(ex); return Math.max(w.lo, Math.min(w.hi, r)); }
function ladderFor(tested, ex, program, rateMode){
  if(tested==null) return null;
  program = program || getProgram(DEFAULT_PROGRAM_ID);
  var ladder = (program.repLadder || REP_LADDER).map(function(r){ return clampReps(r, ex); }), weeks = program.weeks || TOTAL_WEEKS;
  var orm = tested / pct(15), plan = {};
  var mode = PROGRESSION_MODES[rateMode] || PROGRESSION_MODES[DEFAULT_RATE_MODE], dynamic = !!mode.dynamic;
  if(program.direction === "reverse"){
    /* BACK-OFF WAVE: weight rides the rising 1RM curve, reps climb (e.g. 6 -> 15) so the weight EASES
       across the block (more reps = lighter). The MODE sets how fast the bank rises: plateau/default =
       flat WEEKLY_GAIN (byte-identical to the pre-pace wave); a front-loaded tier makes the WHOLE wave
       ride a faster (steep, heavier) / slower (lighter) bank. Reps stay the program ladder's, mode-independent. */
    var rcum = 1;   // strength multiplier at week rw (1 at wk1; accumulates the front-loaded rate for tiers)
    for(var rw=1; rw<=weeks; rw++){
      var rmult = dynamic ? Math.pow(1+WEEKLY_GAIN, rw-1) : rcum;
      plan[rw] = {kg: snapDown(orm * rmult * pct(ladder[rw-1]), ex), reps: ladder[rw-1], rate: "hold", e1: orm * rmult};
      if(!dynamic && rw < weeks) rcum *= (1 + frontLoadRate(mode, rw+1, weeks));
    }
    return plan;
  }
  /* FORWARD: universal gated double-progression. The weekly gain comes from the chosen MODE:
     - plateau (default): the self-balancing PLATEAU-BREAKER — flexes BASE±0.5%, PUSHES (HIGH) while a
       lift is stuck adding reps, EASES (LOW) the week after to pay it back, bounded by LEAD_CAP.
     - a fixed tier (slower/standard/steep): a deterministic FRONT-LOADED rate (fast early, decaying
       to its end value by the final week), no push/ease. Both share the never-easier grid-walk below. */
  var startsAt15 = ladder[0] === 15, startKg = startsAt15 ? roundTo(tested, 0.25) : snapDown(orm * pct(ladder[0]), ex);
  var CEIL = Math.min(20, repWindow(ex).hi), prevW = startsAt15 ? tested : startKg, prevR = ladder[0];
  var dynE1 = orm, steppedLast = true, boostedLast = false;           // dynamic 1RM + per-lift state
  plan[1] = {kg: startKg, reps: ladder[0], rate: "hold", e1: orm};
  for(var w=2; w<=weeks; w++){
    var rate, reason;
    if(dynamic){
      var refE1 = orm * Math.pow(1+WEEKLY_GAIN, w-1);                  // flat-BASE reference for the leash
      if(boostedLast){ rate = GAIN_LOW; reason = "ease"; boostedLast = false; }                             // pay back the push
      else if(!steppedLast && dynE1 < refE1 * (1+LEAD_CAP)){ rate = GAIN_HIGH; reason = "push"; boostedLast = true; }  // stuck + leash allows → push
      else if(steppedLast && dynE1 > refE1 + 1e-9){ rate = GAIN_LOW; reason = "ease"; }                     // stepped but still ahead → drift back
      else { rate = WEEKLY_GAIN; reason = "hold"; }
    } else {
      rate = frontLoadRate(mode, w, weeks); reason = "hold";          // fixed tier: front-loaded decay, no push/ease
    }
    dynE1 = dynE1 * (1 + rate);                                        // estimated 1RM this week (accumulating)
    var idealW = dynE1 * pct(ladder[w-1]);                            // weight the curve wants at this week's planned reps
    var cand = prevW, stepped = false, g = 0;                         // walk the real-weight grid up toward the curve
    while(g++ < 60){ var nx = nextWeight(ex, cand); if(nx <= idealW + 1e-9){ cand = nx; stepped = true; } else break; }
    if(stepped){ prevW = cand; prevR = ladder[w-1]; }                 // curve earned ≥1 real step → step weight, reps to the ladder
    else if(prevR >= CEIL){ prevW = nextWeight(ex, prevW); prevR = clampReps(Math.max(6, Math.min(15, invpct(prevW / dynE1))), ex); }  // reps earned the next weight (kept inside the lift's window)
    else { prevR += 1; }                                              // add one rep (double progression while a step won't fit)
    steppedLast = stepped;
    plan[w] = {kg: roundTo(prevW, 0.25), reps: prevR, rate: reason, e1: dynE1};
  }
  return plan;
}

/* ---- PROGRAM-LIBRARY accessors (the library DATA lives in tracker-seed.js:
   SEED_PROGRAM_LIB, PROGRAM_ORDER, DEFAULT_PROGRAM_ID — resolved at call time) ---- */
function getProgram(id){ return SEED_PROGRAM_LIB[id] || SEED_PROGRAM_LIB[DEFAULT_PROGRAM_ID]; }
function repForWeekIn(program, w){ var L=(program&&program.repLadder)||REP_LADDER; return L[(w||1)-1] || L[0]; }
/* KEEP-CLIMBING: finishing a program banks its gain into the strength anchor so the next program
   starts heavier. Default rule = +WEEKLY_GAIN/wk compounded over the program's weeks (1.01^12 ~= 1.127). */
function advanceBank(tested, program){ if(tested==null) return null; var wk=(program&&program.weeks)||TOTAL_WEEKS; return roundTo(tested*Math.pow(1+WEEKLY_GAIN, wk), 0.25); }

/* TRANSFER (program switch): the 15RM anchor to START a new program with, carrying the strength
   reached in the SOURCE program through its (last completed week + 1 step). Strength-domain — reads
   the estimated 1RM (e1), NOT the displayed weight — so it's correct across directions (a reverse
   wave's light top set still carries its true high bank). lastCompletedWeek 0 → no change. */
function carriedAnchor(sourceAnchor, ex, sourceProgram, sourceMode, lastCompletedWeek){
  if(sourceAnchor==null) return null;
  sourceProgram = sourceProgram || getProgram(DEFAULT_PROGRAM_ID);
  var weeks = sourceProgram.weeks || TOTAL_WEEKS;
  var w = Math.max(1, Math.min((lastCompletedWeek||0) + 1, weeks));   // last completed + 1 step, capped at the block end
  var p = ladderFor(sourceAnchor, ex, sourceProgram, sourceMode);
  return roundTo(p[w].e1 * pct(15), 0.25);                            // estimated 1RM → 15RM anchor
}
/* (carriedAnchor above is the STRENGTH number; the app starts a program from carriedLoad below.) */

/* nearest REAL weight to target on this lift's grid (a tie goes to the lighter one) */
function snapNearest(target, ex){
  if(target==null) return null;
  var lo = snapDown(target, ex), hi = nextWeight(ex, lo);
  return (target - lo) <= (hi - target) + 1e-9 ? lo : hi;
}
/* a program switch for ONE lift. bank = the EXACT carried strength, kept for the next switch so nothing
   is lost to rounding (light lifts would stall, frequent restarts would ratchet); load = the weight the new
   program starts from — the bank placed on the lift's real grid, never below the current load.
   Zero completed weeks = no change at all. (bank null = the load is the strength, e.g. a typed weight.) */
function carryLift(load, bank, ex, sourceProgram, sourceMode, lastCompletedWeek){
  if(load==null) return {load: null, bank: null};
  var b = (bank==null) ? load : bank;
  if(!lastCompletedWeek) return {load: load, bank: b};
  var raw = carriedAnchor(b, ex, sourceProgram, sourceMode, lastCompletedWeek);
  return {load: Math.max(load, snapNearest(raw, ex)), bank: raw};
}
function carriedLoad(sourceAnchor, ex, sourceProgram, sourceMode, lastCompletedWeek){ return carryLift(sourceAnchor, null, ex, sourceProgram, sourceMode, lastCompletedWeek).load; }
/* OVERRIDE at ANY week ("what I really lifted"): the new anchor whose block prescribes exactly the
   lifted weight at that week, searched outward from the proportional estimate. Forward programs try
   real weights first (their anchor IS week 1), then 0.25 kg anchors — those can only leave an odd
   number in the PAST weeks before the first step; the logged week and every later week stay real.
   The reverse wave uses 0.25 kg anchors (its weights are always snapped to the grid). A forward
   week-1 entry is the anchor itself, kept as typed. If nothing reproduces the lifted weight (it isn't
   on this lift's grid), the anchor showing the heaviest weight below it wins and exact=false, so the
   UI can say so. bank = the exact strength the log implies (curBank rescaled), kept for the next
   program switch. Logging exactly the planned weight changes nothing. Returns {anchor, kg, exact, bank}. */
function anchorForLogged(ex, program, rateMode, week, liftedKg, curAnchor, curBank){
  var lifted = roundTo(liftedKg, 0.25), fwd = program.direction !== "reverse";
  /* week 1 IS the anchor only when the lift's ladder starts at 15 reps (a capped start, e.g. RDL 10 → 6, searches) */
  var startsAt15 = clampReps((program.repLadder || REP_LADDER)[0], ex) === 15;
  if(curAnchor==null || (fwd && week <= 1 && startsAt15)) return {anchor: lifted, kg: lifted, exact: true, bank: lifted};
  var kgAt = function(a){ return ladderFor(a, ex, program, rateMode)[week].kg; };
  var planned = kgAt(curAnchor), b = (curBank==null) ? curAnchor : curBank;
  if(Math.abs(planned - lifted) < 1e-9) return {anchor: curAnchor, kg: lifted, exact: true, bank: b};
  var bank = roundTo(b * lifted / planned, 0.25);
  var est = curAnchor * lifted / planned, best = null;
  var hit = function(a){
    if(!(a > 0) || a > lifted + 1e-9) return false;
    var kg = kgAt(a);
    if(Math.abs(kg - lifted) < 1e-9) return true;
    if(kg < lifted && (!best || kg > best.kg + 1e-9)) best = {anchor: a, kg: kg};
    return false;
  };
  var search = function(start, down, up){                              // closest to the estimate first, lighter side first
    if(hit(start)) return start;
    var lo = start, hi = start;
    for(var i = 0; i < 60; i++){                                        // bounded: a realistic entry matches within a few steps
      var moved = false, d = down(lo), u = up(hi);
      if(d > 0 && d < lo - 1e-9){ lo = d; moved = true; if(hit(d)) return d; }
      if(u <= lifted + 1e-9 && u > hi + 1e-9){ hi = u; moved = true; if(hit(u)) return u; }
      if(!moved) break;
    }
    return null;
  };
  var a = fwd ? search(Math.min(snapNearest(est, ex), snapDown(lifted, ex)), function(x){ return snapDown(x - 1e-6, ex); }, function(x){ return nextWeight(ex, x); }) : null;
  if(a == null) a = search(Math.min(roundTo(est, 0.25), lifted), function(x){ return x - 0.25; }, function(x){ return x + 0.25; });
  if(a != null) return {anchor: a, kg: lifted, exact: true, bank: bank};
  if(best) return {anchor: best.anchor, kg: best.kg, exact: false, bank: bank};
  return {anchor: curAnchor, kg: planned, exact: false, bank: b};
}
