"use strict";
/* training-tracker — embedded SEED DATA for one athlete: profile, tested baselines, exercise
   library, day tracks, program library, warm-ups, weekly schedule, nutrition. PURE DATA, no
   logic — the 12-week load algorithm + equipment/progression engine live in tracker-engine.js
   (loaded alongside this file). Mirrors Documents/Claude/Projects/Training. */

var SCHEMA_VERSION = 4;   /* v4 = frozen lift diary (db.history) + full/partial done ticks; v3 = program platform (library + per-program progress + reverse engine) */
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
  /* repFloor / repCap = the lift's rep window (owner 2026-10-13, rep-plan.md; priority: protection + tendons,
     then strength, then size). No window = the plain HSR ladder 15 → 6.
     Retuned 2026-10-17 (owner, kontor/dossiers/2026-10-17-exercise-review/review.md): the loaded lifts start at
     12 reps (repCap 12), the fixed windows tightened (overhead press 9–12; external rotation and wrist curls 10–15);
     the split squat has no floor now. Plans are worked out live from these, so a stored phone needs no migration. */
  {id:"atg-split-squat",  name:"ATG Split Squat",            pattern:"squat",     loadType:"external", defaultUnit:"kg/leg", equip:"db", cat:"db", repCap:12},
  {id:"rdl",              name:"Romanian Deadlift",          pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"bar", repCap:10},
  {id:"leg-curl",         name:"Lying / Seated Leg Curl",    pattern:"hinge",     loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable", repFloor:8, repCap:12},
  {id:"calf-raise",       name:"Heavy Calf Raise — seated",  pattern:"isolation", loadType:"external", defaultUnit:"kg",     inc:1.25, cat:"single"},  /* single plate */
  {id:"tibialis-raise",   name:"Seated Tibialis Raise",      pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db", repFloor:12, repCap:20},
  {id:"hip-flexion",      name:"Standing 1-Leg Cable Hip Flexion", pattern:"core", loadType:"external", defaultUnit:"kg/leg", inc:2.5, cat:"cable", repFloor:10, repCap:15},
  {id:"copenhagen-plank", name:"Copenhagen Plank",           pattern:"core",      loadType:"timed",    defaultUnit:"s",      inc:2.5},
  {id:"suitcase-carry",   name:"Single-Arm Suitcase Carry",  pattern:"carry",     loadType:"carry",    defaultUnit:"kg",     equip:"db", cat:"db"},
  {id:"reverse-wrist-curl",name:"Reverse Wrist Curls",       pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db", repFloor:10, repCap:15},
  {id:"cable-pulldown",   name:"Cable Pulldown",             pattern:"v-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable", repCap:12},
  {id:"db-chest-press",   name:"Dumbbell Chest Press",       pattern:"h-push",    loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db", repFloor:8, repCap:12},   /* kg = ONE dumbbell */
  {id:"cable-row",        name:"Half-Kneeling 1-Arm Cable Row", pattern:"h-pull", loadType:"external", defaultUnit:"kg/arm", inc:2.5, cat:"cable", repFloor:8, repCap:12},
  {id:"triceps-overhead", name:"Cable Overhead Triceps Ext", pattern:"v-push",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable", repFloor:10, repCap:15},
  {id:"face-pulls",       name:"Face Pulls",                 pattern:"h-pull",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable", repFloor:12, repCap:20},
  {id:"lu-raise",         name:"Lu Raises",                  pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db", repFloor:12, repCap:20},
  {id:"internal-rotation",name:"Towel-Roll Internal Rotation", pattern:"isolation", loadType:"external", defaultUnit:"kg/arm", equip:"db"},
  /* retired from the Upper day 2026-10-09 (owner: dumbbells for the chest, Lu raises for the lateral raises);
     kept defined so their diary entries keep their names and their tested weights stay readable */
  {id:"chest-press",      name:"Machine Chest Press",        pattern:"h-push",    loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable"},
  {id:"lateral-raise",    name:"Lateral Raises",             pattern:"isolation", loadType:"external", defaultUnit:"kg",     equip:"db", cat:"db"},
  /* added 2026-10-13 with the two blended days (owner's batch: decisions.md 2026-10-10 to 2026-10-13). New ids,
     so each asks for its own weight; the seated calf raise and the Copenhagen plank (now in the home plan) stay
     defined above for the diary. The back extension is body weight plus an optional plate (loadType "bodyweight"). */
  {id:"calf-raise-standing", name:"Standing Calf Raise",     pattern:"isolation", loadType:"external", defaultUnit:"kg",     inc:2.5, cat:"cable", repCap:12},
  {id:"db-overhead-press",name:"Standing Dumbbell Overhead Press", pattern:"v-push", loadType:"external", defaultUnit:"kg",  equip:"db", cat:"db", repFloor:9, repCap:12},   /* kg = ONE dumbbell */
  {id:"side-lying-er",    name:"Side-Lying Dumbbell External Rotation", pattern:"isolation", loadType:"external", defaultUnit:"kg/arm", equip:"db", cat:"db", repFloor:10, repCap:15},
  {id:"back-extension-45",name:"45° Back Extension",         pattern:"hinge",     loadType:"bodyweight", defaultUnit:"kg"},  /* kg = the optional plate */
  /* home sessions (owner 2026-10-13, home-plan.md version 2): body weight, every set by EFFORT (near failure) —
     the card shows its dose text, no weight maths, no diary entry. The Copenhagen plank reuses its old id. */
  {id:"bear-crawl",       name:"Bear Crawl",                 pattern:"core",      loadType:"effort", defaultUnit:"s"},
  {id:"bear-step-through",name:"Bear Step-Through",          pattern:"core",      loadType:"effort", defaultUnit:"reps"},
  {id:"hollow-hold",      name:"Hollow Body Hold",           pattern:"core",      loadType:"effort", defaultUnit:"s"},
  {id:"lateral-step-down",name:"Lateral Step-Down",          pattern:"squat",     loadType:"effort", defaultUnit:"reps"},
  {id:"sissy-squat",      name:"Sissy Squat",                pattern:"squat",     loadType:"effort", defaultUnit:"reps"},
  {id:"reverse-nordic",   name:"Reverse Nordic",             pattern:"squat",     loadType:"effort", defaultUnit:"reps"},
  {id:"glute-bridge-hold",name:"Glute Bridge Hold",          pattern:"hinge",     loadType:"effort", defaultUnit:"s"},
  {id:"rkc-plank",        name:"RKC Plank",                  pattern:"core",      loadType:"effort", defaultUnit:"s"}
];

/* ---- DAYS (the training-day tracks a program points at; reused across programs).
   block: heavy = laddered by the algorithm · gap = light/prehab lift · finisher = last, trains the stabilizers.
   Superset markers (2026-10-13): ss:N = superset N (its lifts alternate, 1 set each in turn, `sets` rounds);
   solo:true = done alone with full rest. Entries without either are finishers. ---- */
var SEED_DAYS = {
  /* 2026-10-13 (owner): two BLENDED full-body days with supersets replace Lower (Tue) / Upper (Thu).
     Same-muscle lifts sit on different days, so most muscles get two hits a week with every lift once.
     His order rule: weak links first, then the heaviest lifts (done alone, full rest), then the pairs, and
     the stabilizer work (cuff, grip, lower back) last — a tired cuff lets the shoulder ball ride up (Chen 1999).
     The split squat tires his legs more, so it goes on Tuesday, furthest from Saturday's 4×4; the Romanian
     deadlift goes on Thursday. Layout and reasons: kontor/dossiers/2026-10-13-supersets/layout.md. */
  "strength-a": { id:"strength-a", name:"HSR Day A (Tue)", entries:[
    /* sets (owner 2026-10-17, exercise-review/review.md): the heavy, whole-body-costly lifts get 2, the light or cheap
       lifts 3, the back extension 1; the two lifts of a superset share one count (its head reads the first lift's) */
    {exerciseId:"atg-split-squat",     block:"heavy", sets:2, restSec:150, solo:true, ramp:true},   /* ramp: 1 light set first when the week's target is ≤ 11 reps */
    /* re-paired 2026-10-18 (owner): each superset stays in one area of his gym — at the dumbbells the chest press
       pairs with the suitcase carry (laps near the bench); at the machines the pulldown pairs with the back extension
       (now 2 sets), and the light Lu-raise dumbbells are carried over to the leg curl */
    {exerciseId:"db-chest-press",      block:"heavy", sets:2, restSec:150, ss:1},
    {exerciseId:"suitcase-carry",      block:"gap",   sets:2, restSec:90,  ss:1, timed:true},
    {exerciseId:"cable-pulldown",      block:"heavy", sets:2, restSec:150, ss:2},
    {exerciseId:"back-extension-45",   block:"gap",   sets:2, restSec:90,  ss:2},
    {exerciseId:"leg-curl",            block:"heavy", sets:3, restSec:150, ss:3},
    {exerciseId:"lu-raise",            block:"gap",   sets:3, restSec:90,  ss:3, reps:15},
    {exerciseId:"calf-raise-standing", block:"heavy", sets:3, restSec:150, ss:4},
    {exerciseId:"face-pulls",          block:"gap",   sets:3, restSec:90,  ss:4, reps:15}
    /* back extension once a week (owner 2026-10-13), on the day WITHOUT the Romanian deadlift, last */
  ]},
  "strength-b": { id:"strength-b", name:"HSR Day B (Thu)", entries:[
    {exerciseId:"db-overhead-press",   block:"gap",   sets:3, restSec:90,  ss:1},   /* light, pain-free range, stop rule */
    {exerciseId:"tibialis-raise",      block:"gap",   sets:3, restSec:90,  ss:1, reps:15},
    {exerciseId:"rdl",                 block:"heavy", sets:2, restSec:150, solo:true, ramp:true},
    {exerciseId:"cable-row",           block:"heavy", sets:2, restSec:150, ss:2},
    {exerciseId:"triceps-overhead",    block:"heavy", sets:2, restSec:150, ss:2},
    {exerciseId:"hip-flexion",         block:"gap",   sets:3, restSec:90,  ss:3, reps:10},
    {exerciseId:"side-lying-er",       block:"gap",   sets:3, restSec:90,  ss:3, reps:15},
    {exerciseId:"reverse-wrist-curl",  block:"finisher", sets:3, restSec:60, reps:15}
    /* the Copenhagen plank moved to the home plan (Home A) on the owner's word 2026-10-12/13 */
  ]},
  /* HOME days (owner 2026-10-13: "Put home exercises in my app too"; home-plan.md version 2). Not part of any
     program's `days` (block completion + strength carry ignore them); own week counters. `dose` = the card text:
     every set by effort, near failure. Wednesday: light core (the day after the split squat, before the deadlift).
     Sunday: the knee work + holds (48 h before Tuesday's split squat). */
  "home-wed": { id:"home-wed", name:"Home · Wed", home:true, entries:[
    {exerciseId:"bear-crawl",        block:"core", sets:2, dose:"2 × until the hips stop staying level (start ~20–40 s)"},
    {exerciseId:"bear-step-through", block:"core", sets:2, dose:"2–3 × as many clean reps per side as you can (start ~5)"},
    {exerciseId:"hollow-hold",       block:"core", sets:3, dose:"3 × hold until the lower back starts to lift · past ~45 s, the harder version"}
  ]},
  "home-sun": { id:"home-sun", name:"Home · Sun", home:true, entries:[
    {exerciseId:"lateral-step-down", block:"legs", sets:3, restSec:60, solo:true, dose:"3 × per leg, stop 1–2 reps before the knee would cave or twist (start ~8–10)"},
    {exerciseId:"sissy-squat",       block:"legs", sets:2, restSec:90, solo:true, dose:"2 × stop 1–2 reps before failure, holding a support"},
    {exerciseId:"reverse-nordic",    block:"legs", sets:2, restSec:90, solo:true, dose:"2 × as many controlled reps as you have (now ~2–3)"},
    {exerciseId:"glute-bridge-hold", block:"hold", sets:3, restSec:60, ss:1, dose:"3 × until the hips start to drop (start ~20–45 s) · then one leg · then the crab hold"},
    {exerciseId:"copenhagen-plank",  block:"hold", sets:3, restSec:60, ss:1, dose:"3 × per side until the hips start to drop (start ~20 s) · past ~45 s, the longer lever"},
    {exerciseId:"rkc-plank",         block:"finisher", sets:3, restSec:45, dose:"3–5 × 10 s at full tension"}
  ]}
};
var STRENGTH_DAYS = ["strength-a","strength-b"];
var HOME_DAYS = ["home-wed","home-sun"];

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

/* warm-up — ONE shared list for both blended days (owner 2026-10-13, his own list, about 10 min; replaces
   the June Lower/Upper rosters: Hindu push-ups, DB windmills, lateral drop lunge and eyes-closed balance dropped).
   gif = picture in gifs/ AND the done-tick id ("wu:"+gif). pending:true = no picture yet → a labelled
   "Picture to come" box (lesson L-2). wu_sled keeps its picture (walking backward under load, same pattern). */
var WARMUP_SHARED = [
  {gif:"wu_sled",      name:"Backward walk · incline treadmill", detail:"2 min — warms the knees and kneecap tendons before deep loading. A backward sled drag works too."},
  {gif:"wu_wgs",       name:"World's Greatest Stretch",       detail:"3–4 per side."},
  {gif:"wu_quad",      name:"Quadruped step-throughs",        detail:"5 per side — cross-body, opens the shoulders and hips."},
  {gif:"wu_inchworm",  name:"Inchworm → push-up",             detail:"4–5 reps — hamstrings for the deadlift, shoulders for the presses."},
  {gif:"wu_asian",     name:"Asian squat hold",               detail:"30–60 s — heels down, knees out over the toes, feet only slightly turned out; pain-free depth for the right knee.", pending:true},
  {gif:"wu_cossack",   name:"Cossack squat",                  detail:"5 per side, shifting slowly from leg to leg — the bent knee tracks over the toes.", pending:true},
  {gif:"wu_stickpass.jpg", name:"Stick shoulder pass-throughs", detail:"8–10 slow — opens the whole overhead arc."},
  {gif:"wu_band",      name:"Band pull-aparts",               detail:"15–20 — wakes the upper back before the pulls and presses."}
  /* the dead hang was removed the same day on his word "Nah, remove dad hang" */
];
var WARMUP_BY_PROG = { "strength-a": WARMUP_SHARED, "strength-b": WARMUP_SHARED,
  /* home (operator's advice 2026-10-13): no real warm-up needed on Wednesday; the knees need one on Sunday.
     nopic = intentionally no picture (nothing to show), not a missing one */
  "home-wed": [ {gif:"wu_wrists",   name:"Wrist circles and rocks",      detail:"30 s — then the first bear crawl set slow and easy.", nopic:true} ],
  "home-sun": [ {gif:"wu_backwalk", name:"Walk backward or easy stairs", detail:"3–5 min — warms the knees. Then the first step-down set from a lower step.", nopic:true} ]
};
var WARMUP_TIME = { "strength-a":"~10 min", "strength-b":"~10 min", "home-wed":"~1 min", "home-sun":"~3–5 min" };

/* current week (programs/current-week.md, schedule confirmed 2026-06-17) */
var CURRENT_WEEK = [
  {day:"Mon", label:"Zone 2 · 45–60 min", type:"cardio",   ref:"z2", note:"Easy, zero-impact"},
  {day:"Tue", label:"HSR Day A · full body", type:"strength", ref:"strength-a", note:"Split-squat day · supersets · evening · NO cold-water after"},
  {day:"Wed", label:"Zone 2 · 45–60 min", type:"cardio",   ref:"z2", note:"Easy, zero-impact", home:"home-wed"},   /* + the light home core session */
  {day:"Thu", label:"HSR Day B · full body", type:"strength", ref:"strength-b", note:"Deadlift day · supersets · evening · NO cold-water after"},
  {day:"Fri", label:"Complete rest",      type:"rest",     ref:null, note:"Recover"},
  {day:"Sat", label:"Norwegian 4×4",      type:"hiit",     ref:"norwegian-4x4", note:"Morning · CWI OK today · carb refill"},
  {day:"Sun", label:"Home · legs and holds", type:"home",  ref:"home-sun", note:"The heavier home session · knee work first · eat normally"}
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
