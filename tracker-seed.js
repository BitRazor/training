"use strict";
/* training-tracker — embedded seed. Mirrors the Markdown design in
   Documents/Claude/Projects/Training (profile, programs/strength, nutrition).
   Loaded before tracker.js. Edit the Markdown first, then mirror here + bump CHANGELOG. */

var SCHEMA_VERSION = 1;
var STORE_KEY = "training-tracker:v1";

/* ---- profile defaults (profile/athlete.md · null = ⚠ CONFIRM) ---- */
var SEED_PROFILE = {
  name: "Arnoldas",
  bodyweightKg: null,
  maxHr: 193,
  restingHr: null,
  proteinTargetGPerKg: { low: 1.6, high: 2.0 },
  hrZones: { z1:[97,116], z2:[116,135], z3:[135,154], z4:[154,174], z5:[174,193] }
};

var SEED_SETTINGS = {
  theme:"dark", units:"metric", restTimerDefaultSec:120,
  weekStart:"monday", blockPhaseWeek:1, weeksDone:[], barKg:20,
  platesKg:[25,20,15,10,5,2.5,1.25], lastExportAt:null
};

/* ---- exercise library (strength) ----
   pattern ∈ squat|hinge|h-push|h-pull|v-push|v-pull|carry|core|isolation
   loadType ∈ external|bodyweight|timed|carry   (unit: per-side hints in defaultUnit) */
var SEED_EXERCISES = [
  {id:"atg-split-squat",  name:"ATG Split Squat",            pattern:"squat",     equipment:["dumbbell"], loadType:"external", defaultUnit:"kg/leg", notes:"Front-foot elevated to start; 3·3 tempo, deep ROM. Per leg."},
  {id:"rdl",              name:"Romanian Deadlift",          pattern:"hinge",     equipment:["barbell"],  loadType:"external", defaultUnit:"kg",     notes:"Straps if grip fails before hamstrings. Load must climb the ladder."},
  {id:"leg-curl",         name:"Lying / Seated Leg Curl",    pattern:"hinge",     equipment:["machine"],  loadType:"external", defaultUnit:"kg",     notes:"Knee-flexion hamstring (gap the RDL leaves). 6-s tempo."},
  {id:"calf-raise",       name:"Heavy Calf Raise — seated",  pattern:"isolation", equipment:["machine"],  loadType:"external", defaultUnit:"kg",     notes:"9-s tempo: 3 s down · 3 s loaded-stretch hold · 3 s up. Soleus."},
  {id:"tibialis-raise",   name:"Seated Tibialis Raise",      pattern:"isolation", equipment:["plate"],    loadType:"external", defaultUnit:"kg",     notes:"Anterior shin. 6-s tempo, 3×15, seated."},
  {id:"hip-flexion",      name:"Standing 1-Leg Cable Hip Flexion", pattern:"core", equipment:["cable"],   loadType:"external", defaultUnit:"kg/leg", notes:"3-s hold at top, 3×10/leg. Loads hip flexor + standing balance/core."},
  {id:"copenhagen-plank", name:"Copenhagen Plank",           pattern:"core",      equipment:["bodyweight"],loadType:"timed",   defaultUnit:"s",      notes:"Top shin on a bench; knee-bent→straight over weeks. 3×20–30 s/side. Log hold seconds."},
  {id:"suitcase-carry",   name:"Single-Arm Suitcase Carry",  pattern:"carry",     equipment:["dumbbell"], loadType:"carry",    defaultUnit:"kg",     notes:"Heavy, grip fresh (before wrist curls). 3×60 s/arm, tall, no lean."},
  {id:"reverse-wrist-curl",name:"Reverse Wrist Curls",       pattern:"isolation", equipment:["dumbbell"], loadType:"external", defaultUnit:"kg",     notes:"Wrist extensors / lateral elbow. 3×15, last set to failure. Day-1 finisher."},
  {id:"cable-pulldown",   name:"Cable Pulldown",             pattern:"v-pull",    equipment:["cable"],    loadType:"external", defaultUnit:"kg",     notes:"Or Weighted Chin-up. Pick one default and stick to it. 3·3 tempo."},
  {id:"chest-press",      name:"Machine Chest Press",        pattern:"h-push",    equipment:["machine"],  loadType:"external", defaultUnit:"kg",     notes:"Or Heavy DB Press. Stop short of lockout. 3·3 tempo."},
  {id:"cable-row",        name:"Half-Kneeling 1-Arm Cable Row", pattern:"h-pull", equipment:["cable"],   loadType:"external", defaultUnit:"kg/arm", notes:"Torso does NOT twist. Per arm. 3·3 tempo."},
  {id:"triceps-overhead", name:"Cable Overhead Triceps Ext", pattern:"v-push",    equipment:["cable"],    loadType:"external", defaultUnit:"kg",     notes:"Or Dips. Full triceps stretch under load. 3·3 tempo."},
  {id:"face-pulls",       name:"Face Pulls",                 pattern:"h-pull",    equipment:["cable"],    loadType:"external", defaultUnit:"kg",     notes:"Rear delts / scapular retraction. 2-s squeeze. 3×15."},
  {id:"lateral-raise",    name:"Lateral Raises",             pattern:"isolation", equipment:["dumbbell"], loadType:"external", defaultUnit:"kg",     notes:"Medial delt. To shoulder height only. 3×15."},
  {id:"internal-rotation",name:"Towel-Roll Internal Rotation", pattern:"isolation", equipment:["dumbbell"],loadType:"external", defaultUnit:"kg/arm", notes:"Subscapularis/cuff. SUBMAXIMAL — leave 3–4 in tank. 2×15/arm. (Cuff primer — see HANDOFF: placement under review.)"}
];

/* ---- programs (mirrors hsr-tendon-hypertrophy.md v1.7 + the app's current order) ----
   block ∈ heavy|gap|finisher (display grouping). reps = target at week-1 (System Flush);
   the 12-week ladder overrides the number via settings.blockPhaseWeek (see HSR_LADDER). */
var SEED_PROGRAMS = {
  "strength-a": {
    id:"strength-a", name:"HSR Lower (Day 1)", restDefaults:{heavy:150, gap:90, finisher:90},
    entries:[
      {exerciseId:"atg-split-squat",  block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"rdl",              block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"leg-curl",         block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"calf-raise",       block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"tibialis-raise",   block:"gap",   sets:3, reps:15, restSec:90},
      {exerciseId:"hip-flexion",      block:"gap",   sets:3, reps:10, restSec:90},
      {exerciseId:"copenhagen-plank", block:"gap",   sets:3, reps:null, restSec:90, timed:true},
      {exerciseId:"suitcase-carry",   block:"finisher", sets:3, reps:null, restSec:90, timed:true},
      {exerciseId:"reverse-wrist-curl",block:"finisher",sets:3, reps:15, restSec:60}
    ]
  },
  "strength-b": {
    id:"strength-b", name:"HSR Upper (Day 2)", restDefaults:{heavy:150, gap:90},
    entries:[
      {exerciseId:"cable-pulldown",   block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"chest-press",      block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"cable-row",        block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"triceps-overhead", block:"heavy", sets:3, reps:15, restSec:150},
      {exerciseId:"face-pulls",       block:"gap",   sets:3, reps:15, restSec:90},
      {exerciseId:"lateral-raise",    block:"gap",   sets:3, reps:15, restSec:90},
      {exerciseId:"internal-rotation",block:"gap",   sets:2, reps:15, restSec:90}
    ]
  }
};

/* 12-week HSR rep ladder (hsr-tendon-hypertrophy.md). reps = target RM bracket top. */
var HSR_LADDER = [
  {phase:"System Flush",       weeks:[1],      reps:15, note:"Calibrate to slow-eccentric failure"},
  {phase:"Anchor Hypertrophy", weeks:[2,3,4],  reps:12, note:"Volume accumulation, high TUT"},
  {phase:"Tension Transition", weeks:[5,6,7,8],reps:10, note:"Mechanical tension climbs"},
  {phase:"Max Stiffness",      weeks:[9,10,11,12], reps:8, note:"Heaviest loads; peak remodeling"},
  {phase:"Deload",             weeks:[13],     reps:null, note:"1 wk light, normal tempo"}
];
function phaseForWeek(w){
  for(var i=0;i<HSR_LADDER.length;i++){ if(HSR_LADDER[i].weeks.indexOf(w)>=0) return HSR_LADDER[i]; }
  return HSR_LADDER[0];
}
var TOTAL_WEEKS = 13;
/* per-week coaching note (beyond the phase intent) — only the weeks that change something */
var WEEK_INTENT = {
  1:"Calibration week — find the load that brings slow-eccentric failure inside the rep bracket on each lift.",
  2:"First building week — keep the loads honest, every rep at the 3·3 tempo.",
  5:"Tension climbs — reps drop and load goes up. Warm up thoroughly.",
  9:"Heaviest phase — add load carefully, warm up extra, and be the first to trim conditioning.",
  13:"Deload — light loads, normal tempo. Let the connective tissue consolidate, then recycle to week 2."
};
function weekPlan(w){
  var ph=phaseForWeek(w);
  return {week:w, phase:ph.phase, heavyReps:ph.reps, gapReps:"12–15", deload:(w===13),
    intent:(WEEK_INTENT[w]||ph.note)};
}
/* reps to show for one program entry in a given week: heavy lifts ladder by phase,
   gap/prehab keeps its fixed prescription, timed lifts (carry/Copenhagen) show no rep count */
function repsForEntryWeek(en,w){
  if(en.timed) return null;
  if(en.block==="heavy"){ var r=phaseForWeek(w).reps; return r==null?"light":r; }
  return en.reps;
}

/* current week schedule (programs/current-week.md v2.0). type ∈ strength|cardio|hiit|rest */
var CURRENT_WEEK = [
  {day:"Mon", label:"HSR Lower", type:"strength", ref:"strength-a", note:"Heavy labor daytime · evening lift · NO cold-water immersion"},
  {day:"Tue", label:"Zone 2 · 45–60 min", type:"cardio", ref:"z2", note:"Easy, zero-impact"},
  {day:"Wed", label:"HSR Upper", type:"strength", ref:"strength-b", note:"NO cold-water immersion after lifting"},
  {day:"Thu", label:"Zone 2 · 45–60 min", type:"cardio", ref:"z2", note:"Easy, zero-impact"},
  {day:"Fri", label:"Complete rest", type:"rest", ref:null, note:"Labor day · no evening session"},
  {day:"Sat", label:"Norwegian 4×4", type:"hiit", ref:"norwegian-4x4", note:"Morning · CWI OK today · carb refill"},
  {day:"Sun", label:"Rest", type:"rest", ref:null, note:"Eat normally · optional light Z2 only if readiness calls for it"}
];

/* nutrition reference (nutrition/protein-protocol.md) — rendered read-only + drives the calculator */
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
