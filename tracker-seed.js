"use strict";
/* training-tracker — embedded SEED DATA for one athlete: profile, tested baselines, exercise
   library, day tracks, program library, warm-ups, weekly schedule, nutrition. PURE DATA, no
   logic — the 12-week load algorithm + equipment/progression engine live in tracker-engine.js
   (loaded alongside this file). Mirrors Documents/Claude/Projects/Training. */

var SCHEMA_VERSION = 3;   /* v3 = program platform: program library + per-program progress + reverse-direction engine */
var STORE_KEY = "training-tracker:v1";

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

/* ---- exercise library (pattern incl. isolation; loadType incl. timed/carry) ---- */
/* Weight progression matches the real equipment, per exercise:
   - equip:"db"  → DUMBBELLS: <10 kg steps 1 kg (1,2,…,9,10), ≥10 kg steps 2.5 kg (10,12.5,15,17.5…)
   - else inc:N  → fixed jump (barbell/cable/machine; 2.5 kg = a 1.25 plate per side).  (see nextWeight) */
var SEED_EXERCISES = [
  {id:"atg-split-squat",  name:"ATG Split Squat",            pattern:"squat",     loadType:"external", defaultUnit:"kg/leg", equip:"db", cat:"db"},
  {id:"rdl",              name:"Romanian Deadlift",          pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"bar"},
  {id:"leg-curl",         name:"Lying / Seated Leg Curl",    pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"calf-raise",       name:"Heavy Calf Raise — seated",  pattern:"isolation", loadType:"external", defaultUnit:"kg",     inc:1.25, cat:"single"},  /* single plate */
  {id:"tibialis-raise",   name:"Seated Tibialis Raise",      pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db"},
  {id:"hip-flexion",      name:"Standing 1-Leg Cable Hip Flexion", pattern:"core", loadType:"external", defaultUnit:"kg/leg", inc:2.5, cat:"cable"},
  {id:"copenhagen-plank", name:"Copenhagen Plank",           pattern:"core",      loadType:"timed",    defaultUnit:"s",      inc:2.5},
  {id:"suitcase-carry",   name:"Single-Arm Suitcase Carry",  pattern:"carry",     loadType:"carry",    defaultUnit:"kg",     equip:"db", cat:"db"},
  {id:"reverse-wrist-curl",name:"Reverse Wrist Curls",       pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db"},
  {id:"cable-pulldown",   name:"Cable Pulldown",             pattern:"v-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"chest-press",      name:"Machine Chest Press",        pattern:"h-push",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"cable-row",        name:"Half-Kneeling 1-Arm Cable Row", pattern:"h-pull", loadType:"external", defaultUnit:"kg/arm", inc:2.5, cat:"cable"},
  {id:"triceps-overhead", name:"Cable Overhead Triceps Ext", pattern:"v-push",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"face-pulls",       name:"Face Pulls",                 pattern:"h-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"lateral-raise",    name:"Lateral Raises",             pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db"},
  {id:"internal-rotation",name:"Towel-Roll Internal Rotation", pattern:"isolation", loadType:"external", defaultUnit:"kg/arm", equip:"db"}
];

/* ---- DAYS (the training-day tracks a program points at; reused across programs).
   block: heavy = laddered by the algorithm · gap = steady working weight · timed = hold/carry ---- */
var SEED_DAYS = {
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

/* ---- PROGRAM LIBRARY — the named packages. A *program* is the whole training package; the
   day-tracks above (Lower/Upper) are its reusable building blocks. `direction` "forward" = the
   gated never-easier descent (15->6); "reverse" = a back-off wave (6->15) that eases within the
   block while the strength bank keeps climbing across blocks. `rule` = which progression rate
   (only "default" = +1%/wk today; tiered/tapered templates come later per the evidence review). */
var SEED_PROGRAM_LIB = {
  "hsr-base-12": { id:"hsr-base-12", name:"HSR Base 12", desc:"Hypertrophy → strength. Reps fall 15 → 6 as the weight climbs.",
    days:["strength-a","strength-b"], weeks:12, repLadder:[15,14,13,12,11,10,9,8,8,7,6,6], direction:"forward", rule:"default" },
  "hsr-wave-12": { id:"hsr-wave-12", name:"HSR Wave 12", desc:"Strength → hypertrophy back-off wave. Reps climb 6 → 15 on your higher banked strength; weight eases within the block.",
    days:["strength-a","strength-b"], weeks:12, repLadder:[6,6,7,8,8,9,10,11,12,13,14,15], direction:"reverse", rule:"default" }
};
var PROGRAM_ORDER = ["hsr-base-12","hsr-wave-12"];   // display order + the forward<->wave cycle
var DEFAULT_PROGRAM_ID = "hsr-base-12";

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
