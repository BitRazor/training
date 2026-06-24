"use strict";
/* training-tracker — embedded seed + the 12-week load algorithm.
   Mirrors Documents/Claude/Projects/Training (profile, programs/strength, week1-calibration, nutrition). */

var SCHEMA_VERSION = 2;
var STORE_KEY = "training-tracker:v1";
var TOTAL_WEEKS = 12;

/* ---- profile (bodyweight = TARGET lean bodyweight, ~10–15% body fat — drives protein) ---- */
var SEED_PROFILE = {
  name: "Arnoldas",
  targetBodyweightKg: null,           // lean target (~10–15% BF) — protein is figured on this, not total mass
  maxHr: 193,
  proteinTargetGPerKg: { low: 1.6, high: 2.0 },
  hrZones: { z1:[97,116], z2:[116,135], z3:[135,154], z4:[154,174], z5:[174,193] }
};
var SEED_SETTINGS = { theme:"dark", units:"metric", weekStart:"monday", lastExportAt:null };

/* ---- tested 15RM / working weights (profile/baselines.md, 2026-06-13). null = not calibrated yet ----
   Heavy lifts ladder off these; gap/prehab hold a steady working weight; timed lifts use a time target. */
var SEED_TESTED = {
  /* from the user's calibration export (week1-calibration-results.json, 2026-06-16) — final 15RM / working weights */
  "atg-split-squat":8, "rdl":60, "leg-curl":20, "calf-raise":17.5,            // Day-1 heavy
  "tibialis-raise":10, "hip-flexion":12.5, "reverse-wrist-curl":6, "suitcase-carry":16, // Day-1 gap/finisher
  "cable-pulldown":50, "chest-press":70, "cable-row":25, "triceps-overhead":17.5,        // Day-2 heavy (chest press logged as DB)
  "face-pulls":7.5, "lateral-raise":3                                          // Day-2 gap
  /* copenhagen-plank = timed (no load) · internal-rotation = warm-up cuff (untested) */
};

/* ---- the 12-week algorithm ----
   est 1RM from a tested 15RM, add a weekly strength bump, then weight = 1RM × rep-max% for that week's reps. */
var REP_LADDER = [15,14,13,12,11,10,9,8,8,7,6,6];   // weeks 1..12 (most reps → 6)
var WEEKLY_GAIN = 0.01;                              // +1%/week predicted strength gain (novice, conservative)
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
   1RM estimate → +WEEKLY_GAIN/week strength bump → 1RM × rep-max %(that week's reps). */
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
/* the next REAL achievable weight above w for this exercise's equipment:
   dumbbells → +1 kg under 10, +2.5 kg at/over 10 (1,2,…,10,12.5,15,17.5…); else → +inc (fixed plate jump). */
function nextWeight(ex, w){
  if(ex && ex.equip === "db") return w < 9.999 ? Math.floor(w + 1e-9) + 1 : (Math.floor(w/2.5 + 1e-9) + 1) * 2.5;
  return w + ((ex && ex.inc) || 2.5);
}
function ladderFor(tested, ex){
  if(tested==null) return null;
  var orm = tested / pct(15), CEIL = 20, plan = {}, prevW = tested, prevR = repForWeek(1);
  plan[1] = {kg: roundTo(tested, 0.25), reps: repForWeek(1)};
  for(var w=2; w<=TOTAL_WEEKS; w++){
    var e1 = orm * Math.pow(1+WEEKLY_GAIN, w-1);                       // estimated 1RM this week
    var idealW = e1 * pct(repForWeek(w));                              // weight the curve wants at this week's planned reps
    var cand = prevW, stepped = false, g = 0;                         // walk the real-weight grid up toward the curve
    while(g++ < 60){ var nx = nextWeight(ex, cand); if(nx <= idealW + 1e-9){ cand = nx; stepped = true; } else break; }
    if(stepped){ prevW = cand; prevR = repForWeek(w); }               // curve earned ≥1 real step → step weight, reps to the ladder
    else if(prevR >= CEIL){ prevW = nextWeight(ex, prevW); prevR = Math.max(6, Math.min(15, invpct(prevW / e1))); }  // reps earned the next weight
    else { prevR += 1; }                                              // add one rep (double progression while a step won't fit)
    plan[w] = {kg: roundTo(prevW, 0.25), reps: prevR};
  }
  return plan;
}

/* ---- exercise library (pattern incl. isolation; loadType incl. timed/carry) ---- */
/* Weight progression matches the real equipment, per exercise:
   - equip:"db"  → DUMBBELLS: <10 kg steps 1 kg (1,2,…,9,10), ≥10 kg steps 2.5 kg (10,12.5,15,17.5…)
   - else inc:N  → fixed jump (barbell/cable/machine; 2.5 kg = a 1.25 plate per side).  (see nextWeight) */
var SEED_EXERCISES = [
  {id:"atg-split-squat",  name:"ATG Split Squat",            pattern:"squat",     loadType:"external", defaultUnit:"kg/leg", equip:"db"},
  {id:"rdl",              name:"Romanian Deadlift",          pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"leg-curl",         name:"Lying / Seated Leg Curl",    pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"calf-raise",       name:"Heavy Calf Raise — seated",  pattern:"isolation", loadType:"external", defaultUnit:"kg",     inc:1.25},  /* single plate */
  {id:"tibialis-raise",   name:"Seated Tibialis Raise",      pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db"},
  {id:"hip-flexion",      name:"Standing 1-Leg Cable Hip Flexion", pattern:"core", loadType:"external", defaultUnit:"kg/leg", inc:2.5},
  {id:"copenhagen-plank", name:"Copenhagen Plank",           pattern:"core",      loadType:"timed",    defaultUnit:"s",      inc:2.5},
  {id:"suitcase-carry",   name:"Single-Arm Suitcase Carry",  pattern:"carry",     loadType:"carry",    defaultUnit:"kg",     equip:"db"},
  {id:"reverse-wrist-curl",name:"Reverse Wrist Curls",       pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db"},
  {id:"cable-pulldown",   name:"Cable Pulldown",             pattern:"v-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"chest-press",      name:"Machine Chest Press",        pattern:"h-push",    loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"cable-row",        name:"Half-Kneeling 1-Arm Cable Row", pattern:"h-pull", loadType:"external", defaultUnit:"kg/arm", inc:2.5},
  {id:"triceps-overhead", name:"Cable Overhead Triceps Ext", pattern:"v-push",    loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"face-pulls",       name:"Face Pulls",                 pattern:"h-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5},
  {id:"lateral-raise",    name:"Lateral Raises",             pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db"},
  {id:"internal-rotation",name:"Towel-Roll Internal Rotation", pattern:"isolation", loadType:"external", defaultUnit:"kg/arm", equip:"db"}
];

/* ---- programs (block: heavy = laddered by the algorithm · gap = steady working weight · timed = hold/carry) ---- */
var SEED_PROGRAMS = {
  "strength-a": { id:"strength-a", name:"HSR Lower (Day 1)", entries:[
    /* Heavy order = PRE-EXHAUST the weak / problematic hamstrings (reordered 2026-06-19):
       isolation Leg Curl FIRST (hamstrings hit with full energy, zero spine load), then the
       RDL while the spine + core are still fresh, then the quad-dominant ATG split squat,
       then calves. Chosen over the "heavy hinge first" option because the hamstrings are the
       weak link and the lower back is spared by doing the isolation before the spinal loading. */
    {exerciseId:"leg-curl",         block:"heavy", sets:3, restSec:150},
    {exerciseId:"rdl",              block:"heavy", sets:3, restSec:150},
    {exerciseId:"atg-split-squat",  block:"heavy", sets:3, restSec:150},
    {exerciseId:"calf-raise",       block:"heavy", sets:3, restSec:150},
    {exerciseId:"tibialis-raise",   block:"gap",   sets:3, restSec:90, reps:15},
    {exerciseId:"hip-flexion",      block:"gap",   sets:3, restSec:90, reps:10},
    {exerciseId:"suitcase-carry",   block:"finisher", sets:3, restSec:90, timed:true}
    /* Copenhagen plank + reverse wrist curls moved to Day 2 (2026-06-20) to balance session length. */
  ]},
  "strength-b": { id:"strength-b", name:"HSR Upper (Day 2)", entries:[
    {exerciseId:"cable-pulldown",   block:"heavy", sets:3, restSec:150},
    {exerciseId:"chest-press",      block:"heavy", sets:3, restSec:150},
    {exerciseId:"cable-row",        block:"heavy", sets:3, restSec:150},
    {exerciseId:"triceps-overhead", block:"heavy", sets:3, restSec:150},
    {exerciseId:"face-pulls",       block:"gap",   sets:3, restSec:90, reps:15},
    {exerciseId:"lateral-raise",    block:"gap",   sets:3, restSec:90, reps:15},
    {exerciseId:"copenhagen-plank", block:"gap",   sets:3, restSec:90, timed:true},
    {exerciseId:"reverse-wrist-curl",block:"gap",  sets:3, restSec:60, reps:15}
    /* Copenhagen plank + reverse wrist curls moved here from Day 1 (2026-06-20) to balance session
       length. Towel-Roll Internal Rotation stays out (warm-up cuff primer per exercise-guide.md). */
  ]}
};
var STRENGTH_DAYS = ["strength-a","strength-b"];

/* warm-up sequences per strength day — gifs in gifs/wu_*.gif (a missing one hides gracefully) */
var WARMUP_BY_PROG = {
  "strength-a":[
    {gif:"wu_sled",      name:"Backward sled drag / treadmill", detail:"3–5 min — drives blood into the knee & patellar tendon before deep loading."},
    {gif:"wu_wgs",       name:"World's Greatest Stretch",       detail:"3–4 per side."},
    {gif:"wu_inchworm",  name:"Inchworm → push-up",             detail:"4–5 reps."},
    {gif:"wu_droplunge", name:"Lateral drop lunge",             detail:"5 per side — frontal-plane prep."},
    {gif:"wu_balance",   name:"Eyes-closed single-leg balance", detail:"20–30 s per leg, once you're warm."}
  ],
  "strength-b":[
    {gif:"wu_hindu",     name:"Hindu push-ups",                 detail:"6–8 — swoop low, push into extension; opens the thoracic spine."},
    {gif:"wu_quad",      name:"Quadruped step-throughs",        detail:"5 per side — cross-body anti-rotation, opens the shoulder."},
    {gif:"wu_windmill",  name:"Light DB windmills",             detail:"5 per side — shoulder stability, wakes the cuff. Keep it light."},
    {gif:"wu_stickpass.jpg", name:"Stick shoulder pass-throughs", detail:"8–10 slow — opens the whole overhead arc."},
    {gif:"wu_band",      name:"Band pull-aparts",               detail:"15–20 — wakes the rear delts/scapula before the pulls."}
  ]
};

/* current week (programs/current-week.md, schedule confirmed 2026-06-17) */
var CURRENT_WEEK = [
  {day:"Mon", label:"Zone 2 · 45–60 min", type:"cardio",   ref:"z2", note:"Easy, zero-impact"},
  {day:"Tue", label:"HSR Lower",          type:"strength", ref:"strength-a", note:"Heavy + gap-closure · evening · NO cold-water after"},
  {day:"Wed", label:"Zone 2 · 45–60 min", type:"cardio",   ref:"z2", note:"Easy, zero-impact"},
  {day:"Thu", label:"HSR Upper",          type:"strength", ref:"strength-b", note:"Heavy + gap-closure · evening · NO cold-water after"},
  {day:"Fri", label:"Complete rest",      type:"rest",     ref:null, note:"Recover"},
  {day:"Sat", label:"Norwegian 4×4",      type:"hiit",     ref:"norwegian-4x4", note:"Morning · CWI OK today · carb refill"},
  {day:"Sun", label:"Rest",               type:"rest",     ref:null, note:"Eat normally"}
];

/* nutrition reference (nutrition/protein-protocol.md) */
var NUTRITION = {
  targetLow:1.6, targetHigh:2.0, ceiling:2.2, mealsPerDay:[3,4], perMealMinGPerKg:0.3,
  rules:[
    {when:"Resistance / HIIT day · ends ≥3.5 h before bed", how:"Whey 40 g within 30–60 min, then casein 30–40 g at bedtime−90 min."},
    {when:"Resistance / HIIT day · ends 1.5–3.5 h before bed", how:"Whey 40 g post-workout only (that's your pre-sleep dose). Skip casein."},
    {when:"Resistance / HIIT day · ends <1.5 h before bed", how:"Whey 40 g post-workout, upright. Tight window — train earlier if frequent."},
    {when:"Easy cardio (Z2 ≤45 min)", how:"Standard meals. Casein pre-bed only to hit the daily total."},
    {when:"Rest day", how:"Standard meals; hit the total from food. Pre-sleep casein discretionary."}
  ],
  gerd:[
    "≤300 ml volume per shake · near-zero fat (isolate forms) · no carbonation.",
    "Stay upright 30–60 min after every dose; head of bed raised if nocturnal reflux.",
    "Never add fat at bedtime (slows gastric emptying, lowers LES pressure).",
    "Don't train hard on a full stomach; leave a gap before heavy bracing/Valsalva.",
    "If reflux with the pre-sleep dose, move it to 2+ h before bed."
  ],
  oneLine:"Hit 1.6–2.0 g/kg/day across 3–4 meals. Whey post-workout. Casein pre-bed when timing fits. No fat at bedtime. Upright until lights-out."
};
