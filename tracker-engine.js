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
/* re-anchor: from an actual weight lifted at week w, back out the equivalent tested 15RM */
function deriveTested(actualWeight, w){
  return actualWeight * pct(15) / (Math.pow(1+WEEKLY_GAIN, (w||1)-1) * pct(repForWeek(w)));
}
/* gap/prehab lifts: reps stay fixed (prehab dose), but the working weight still creeps +1%/week */
function gapWeight(tested, w){ return tested==null?null:roundTo(tested*Math.pow(1+WEEKLY_GAIN,(w||1)-1), loadStep(tested)); }
function deriveGap(actualWeight, w){ return actualWeight/Math.pow(1+WEEKLY_GAIN,(w||1)-1); }

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
/* the next REAL achievable weight above w for this lift's (resolved) gear */
function nextWeight(ex, w){
  var g = gearFor(ex);
  if(g.equip === "db") return w < 9.999 ? Math.floor(w + 1e-9) + 1 : (Math.floor(w/2.5 + 1e-9) + 1) * 2.5;
  return w + (g.inc || 2.5);
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
function ladderFor(tested, ex, program, rateMode){
  if(tested==null) return null;
  program = program || getProgram(DEFAULT_PROGRAM_ID);
  var ladder = program.repLadder || REP_LADDER, weeks = program.weeks || TOTAL_WEEKS;
  var orm = tested / pct(15), plan = {};
  if(program.direction === "reverse"){
    /* BACK-OFF WAVE: weight rides the SAME rising 1RM curve, but reps climb (e.g. 6 -> 15) so the
       weight EASES across the block (more reps = lighter). No never-easier gate — easing is the
       point; every rep-level still lands heavier than the previous block because the bank is higher. */
    for(var rw=1; rw<=weeks; rw++){
      var re1 = orm * Math.pow(1+WEEKLY_GAIN, rw-1);
      plan[rw] = {kg: snapDown(re1 * pct(ladder[rw-1]), ex), reps: ladder[rw-1]};
    }
    return plan;
  }
  /* FORWARD: universal gated double-progression. The weekly gain comes from the chosen MODE:
     - plateau (default): the self-balancing PLATEAU-BREAKER — flexes BASE±0.5%, PUSHES (HIGH) while a
       lift is stuck adding reps, EASES (LOW) the week after to pay it back, bounded by LEAD_CAP.
     - a fixed tier (slower/standard/steep): a deterministic FRONT-LOADED rate (fast early, decaying
       to its end value by the final week), no push/ease. Both share the never-easier grid-walk below. */
  var mode = PROGRESSION_MODES[rateMode] || PROGRESSION_MODES[DEFAULT_RATE_MODE], dynamic = !!mode.dynamic;
  var CEIL = 20, prevW = tested, prevR = ladder[0];
  var dynE1 = orm, steppedLast = true, boostedLast = false;           // dynamic 1RM + per-lift state
  plan[1] = {kg: roundTo(tested, 0.25), reps: ladder[0], rate: "hold"};
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
    else if(prevR >= CEIL){ prevW = nextWeight(ex, prevW); prevR = Math.max(6, Math.min(15, invpct(prevW / dynE1))); }  // reps earned the next weight
    else { prevR += 1; }                                              // add one rep (double progression while a step won't fit)
    steppedLast = stepped;
    plan[w] = {kg: roundTo(prevW, 0.25), reps: prevR, rate: reason};
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
