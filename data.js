"use strict";
/* exercise + warm-up program data — loaded before app.js */

/* ---------- exercise data ---------- */
var DAYS={
 day1:{cnt:"d1Cnt", blocks:[
  {head:"Heavy block · <b>failure test</b> · 3 sets · 2.5 min rest", ex:[
   {id:"atg", kind:"heavy", name:"ATG Split Squat", target:"patellar tendon · quads · glutes", svg:"split", unit:"kg/leg",
    chips:["Tempo 3·3","front foot elevated to start","per leg: L → R → rest"],
    cues:["Front foot elevated and shallow to start — earn the depth over weeks. Back foot on a bench.","3 s down as deep as you control, 3 s up. No bounce.","Light rack/hand touch for balance — stop when FORM breaks, not balance."]},
   {id:"rdl", kind:"heavy", name:"Romanian Deadlift", target:"proximal hamstring tendon · glutes · erectors", svg:"rdl", unit:"kg",
    chips:["Tempo 3·3","barbell","straps if grip fails"],
    cues:["Soft knees, hinge at hips, bar slides down the thighs, lats tight.","3 s down to where the hamstrings load hard (~mid-shin) — depth is hamstring-limited, not floor-limited.","3 s up. No bounce, no top rest. Straps if grip quits before the hamstrings."]},
   {id:"legcurl", kind:"heavy", name:"Lying / Seated Leg Curl", target:"hamstring at the knee — NEW, find your 15RM", svg:"legcurl", unit:"kg",
    chips:["Tempo 3·3","new lift — test it","controlled"],
    cues:["Knee-flexion hamstring — the bit the RDL misses.","3 s curl, 3 s lower; no swinging the weight up.","Becomes Nordic curls later, once you've adapted."]},
   {id:"calf", kind:"heavy", name:"Heavy Calf Raise — seated", target:"Achilles · soleus", svg:"calf", unit:"kg",
    chips:["Tempo 3·3·3","3 s bottom stretch = THE stimulus"],
    cues:["3 s down · 3 s loaded stretch at the bottom, heels deep · 3 s up.","Seated (bent knee) — settled. Full range, never spring out of the bottom."]}
  ]},
  {head:"Gap-closure · find the <b>1–2 RIR</b> weight · 3 sets · 1.5 min rest", ex:[
   {id:"tib", kind:"gap", name:"Seated Tibialis Raise", target:"anterior shin", svg:"tib",
    chips:["Tempo 3·3","3 × 15 @ 1–2 RIR","seated"],
    cues:["Seated, heels planted (plate edge if available), weight across forefoot or tib-bar.","Lift toes toward shins 3 s, lower 3 s.","Rep 13–14 hard, 1–2 always left in the tank."],
    fields:[{k:"w",lab:"Working weight (kg)",type:"num"}]},
   {id:"psoas", kind:"gap", name:"Standing 1-Leg Cable Hip Flexion", target:"hip flexor · standing balance / core", svg:"hipflex",
    chips:["3 × 10 per leg","3 s hold at top","standing on one leg"],
    cues:["Stand on the support leg, cuff or cable on the working ankle (low cable).","Drive the knee up toward the chest — 3 s hold at the top — lower with control.","Loads the hip flexor and taxes balance + standing core."],
    fields:[{k:"w",lab:"Working weight (kg)",type:"num"}]},
   {id:"copen", kind:"gap", name:"Copenhagen Plank", target:"adductors · groin / inner thigh · obliques", tempo:null,
    chips:["3 × 20–30 s per side","top shin on a bench","knee-bent → straight over weeks"],
    cues:["Side plank with your TOP foot/shin resting on a bench, bottom leg hanging underneath.","Lift the bottom leg up to meet the bench and hold — hips stacked, body in one straight line, no sag.","Start knee-bent (shin on the bench) for a shorter, easier lever; progress toward a straight top leg over the weeks."],
    fields:[{k:"s",lab:"Top hold (s) / side",type:"num",unit:"s"}]}
  ]},
  {head:"Finisher · grip fresh → forearm burn-out", ex:[
   {id:"carry", kind:"semi", name:"Single-Arm Suitcase Carry", target:"grip · anti-lateral-flexion core", svg:"carry",
    chips:["3 × 60 s per arm","heavy · grip still fresh","brace hard — no lean"],
    cues:["Done here while your grip is fresh — before the wrist curls — so go genuinely heavy.","One heavy DB/KB at your side, stand tall, shoulders level.","Walk a normal pace 60 s, brace the whole core, no lean or shrug. Switch arms."],
    fields:[{k:"w",lab:"Weight used (kg)",type:"num"}]},
   {id:"wristc", kind:"gap", name:"Reverse Wrist Curls — bilateral", target:"wrist extensors · lateral elbow", svg:"wrist", rest:45,
    chips:["Tempo 3·3","3 × 15–20 · last set to failure","final forearm burn-out"],
    cues:["Both forearms flat on a bench, palms down, fingers curled around the DBs.","Knuckles up 3 s, lower 3 s. Forearms never leave the bench.","Last thing on Day 1 — burn the extensors out; nothing after this needs your grip."],
    fields:[{k:"w",lab:"Weight per hand (kg)",type:"num"}]}
  ]}
 ]},
 day2:{cnt:"d2Cnt", blocks:[
  {head:"Heavy block · <b>failure test</b> · 3 sets · 2.5 min rest", ex:[
   {id:"vpull", kind:"heavy", nameKey:"pull", names:{pulldown:"Cable Pulldown", chinup:"Weighted Chin-up"}, target:"lats · biceps · medial elbow tendons", svg:"pull", unit:"kg",
    chips:["Tempo 3·3","no swinging"],
    cues:["Chest tall, slight lean back — and stay there (no swing).","Pull to upper chest 3 s, resist back up 3 s.","Full stretch at the top without losing the shoulders."]},
   {id:"press", kind:"heavy", nameKey:"press", names:{machine:"Machine Chest Press", db:"DB Chest Press"}, target:"pecs · anterior shoulder", svg:"press", unit:"kg",
    chips:["Tempo 3·3","stop short of lockout"],
    cues:["Shoulder blades set back and down, feet planted.","3 s down to a deep comfortable stretch, 3 s press.","Stop just short of elbow lockout — keep the tension."]},
   {id:"row1", kind:"heavy", name:"Half-Kneeling 1-Arm Cable Row", target:"upper back · anti-rotation core", svg:"row", unit:"kg/arm",
    chips:["Tempo 3·3","per arm: L → R → rest","torso does NOT twist"],
    cues:["Half-kneeling, down-knee under hip, tall trunk.","Row to the ribs 3 s, resist out 3 s.","If the torso twists, the weight is lying — drop it."]},
   {id:"vpush", kind:"heavy", nameKey:"push", names:{ext:"Cable Overhead Triceps Extension", dips:"Dips"}, target:"triceps · lateral elbow tendons", svg:"ohext", unit:"kg",
    chips:["Tempo 3·3","full stretch under load"],
    cues:["Elbows close to the ears, upper arms still.","3 s lower behind the head to a FULL triceps stretch, 3 s extend.","The loaded stretch is the tendon stimulus — don't cut it short."]}
  ]},
  {head:"Gap-closure · find the <b>1–2 RIR</b> weight · 3 sets · 1.5 min rest", ex:[
   {id:"facep", kind:"gap", name:"Face Pulls (rope)", target:"rear delts · scapular retractors", svg:"face",
    chips:["~5 s reps","2 s hard squeeze","3 × 15 @ 1–2 RIR"],
    cues:["Cable at face height. Pull the rope to the forehead, elbows high and wide.","2-s hard squeeze between the shoulder blades, control back out."],
    fields:[{k:"w",lab:"Working weight (kg)",type:"num"}]},
   {id:"latr", kind:"gap", name:"Lateral Raises", target:"medial delts", svg:"lat",
    chips:["2 s up · 2 s down","to shoulder height only","3 × 15 @ 1–2 RIR"],
    cues:["Slight elbow bend. Raise to shoulder height — no higher.","No swing, no shrug. The delt does all of it."],
    fields:[{k:"w",lab:"Weight per hand (kg)",type:"num"}]}
  ]}
 ]}
};

/* ---------- warm-up data (gif files to be added: gifs/<gif>.gif) ---------- */
var WARMUP={
 day1:[
  {id:"wu_sled",gif:"wu_sled",name:"Backward sled drag / treadmill",detail:"3–5 min. Drives blood into the knee & patellar tendon before deep loading — the key one on leg day."},
  {id:"wu_wgs",gif:"wu_wgs",name:"World's Greatest Stretch",detail:"3–4 per side."},
  {id:"wu_inchworm",gif:"wu_inchworm",name:"Inchworm → push-up",detail:"4–5 reps."},
  {id:"wu_quad",gif:"wu_quad",name:"Quadruped step-through",detail:"4–5 per side."},
  {id:"wu_droplunge",gif:"wu_droplunge",name:"Lateral drop lunge",detail:"5 per side (frontal-plane prep)."},
  {id:"wu_balance",gif:"wu_balance",name:"Eyes-closed single-leg balance",detail:"20–30 s per leg, once you're warm."}
 ],
 day2:[
  {id:"wu_reachroll",gif:"wu_reachroll",name:"Reach & Roll",detail:"5/side. Hips back, slide one arm forward, roll the palm up. Opens the lats & t-spine."},
  {id:"wu_hindu",gif:"wu_hindu",name:"Hindu push-ups",detail:"6–8. Swoop low → push into extension. Drives thoracic extension."},
  {id:"wu_quad2",gif:"wu_quad",name:"Quadruped step-throughs",detail:"5/side. Cross-body anti-rotation + opens the front of the shoulder."},
  {id:"wu_windmill",gif:"wu_windmill",name:"Light DB windmills",detail:"5/side. Shoulder stability in open angles; wakes the cuff. Keep it genuinely light."},
  {id:"wu_band",gif:"wu_band",name:"Band dislocates + pull-aparts",detail:"10 + 15. Floods rear delts / rhomboids / lower traps before the pulls."},
  {id:"wu_towelir",gif:"wu_towelir",name:"Towel-roll internal rotation",detail:"2×15/side, light. Cuff balance to pair with the windmills."}
 ]
};
