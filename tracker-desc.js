"use strict";
/* training-tracker — exercise descriptions, one consistent rich standard.
   Source: programs/strength/exercise-guide.md + the calibration app's cues; fresh
   guide-standard entries written for Copenhagen Plank + Towel-Roll Internal Rotation
   (both were missing a full description). Keyed by exercise id. Loaded before tracker.js. */

/* exercise id -> gif filename in gifs/ (the calibration app's verified animations).
   internal-rotation has no gif (the cuff primer never had one). */
var EX_GIF = {
  "atg-split-squat":"atg", "rdl":"rdl", "leg-curl":"legcurl", "calf-raise":"calf",
  "tibialis-raise":"tib", "hip-flexion":"psoas", "copenhagen-plank":"copen",
  "suitcase-carry":"carry", "reverse-wrist-curl":"wristc", "cable-pulldown":"vpull",
  "chest-press":"press", "cable-row":"row1", "triceps-overhead":"vpush",
  "face-pulls":"facep", "lateral-raise":"latr"
};
var EX_DESC = {
  "atg-split-squat": {
    setup: "Split stance, both feet pointing forward; front foot flat (heel stays down), rear heel up on the ball. Torso tall. Front heel on a small wedge is optional for ankle range.",
    move: "Sink straight down, driving the front knee well forward past the toes, until the front hamstring covers the calf and the rear knee hovers off the floor. 3 s down, 3 s up.",
    cue: "Knees-over-toes is the point — don't keep the shin vertical. Heel down, torso tall. Per leg.",
    feel: "Deep load through the front knee, quad and patellar tendon; glute drives you back up."
  },
  "rdl": {
    setup: "Stand tall, bar at the hips, soft knees, lats tight, neutral spine.",
    move: "Hinge at the hips, push the butt back; bar slides down the thighs to ~mid-shin, then drive the hips forward to stand. 3 s down, 3 s up — no bottom bounce, no top lean-back.",
    cue: "Hips back, not down — it's a hinge, not a squat. Straps if grip quits before the hamstrings.",
    feel: "A strong stretch high in the hamstrings (near the sit-bones) at the bottom — that, not the lower back."
  },
  "leg-curl": {
    setup: "Pad on the lower shin/Achilles, knees just off the bench edge.",
    move: "Curl the heels toward the glutes through full range; control the lower for 3 s. No hip-pop or swing.",
    cue: "This is the hamstring at the knee — the bit the RDL misses. Smooth, no momentum.",
    feel: "Hamstring contraction behind the knee; no help from the lower back or hips."
  },
  "calf-raise": {
    setup: "Seated, knees bent ~90°, balls of the feet on a block, pad over the knees.",
    move: "Lower the heels 3 s into a deep stretch, hold the bottom stretch 3 s, press up 3 s. Full range (9-s tempo).",
    cue: "The deep, paused bottom stretch is the Achilles stimulus — never bounce out of it.",
    feel: "A loaded stretch deep in the calf/Achilles at the bottom; bent knee puts it on the soleus."
  },
  "tibialis-raise": {
    setup: "Seated, back straight, heels planted; resistance over the toes (tib-bar, plate, or DB on the feet).",
    move: "Pull the toes up toward the shins (full dorsiflexion), lower slowly. 3·3 tempo, leave 1–2 reps in reserve.",
    cue: "Heels stay planted; only the forefoot moves.",
    feel: "A burn in the front-of-shin muscle (tibialis). Nothing in the calf."
  },
  "hip-flexion": {
    setup: "Low pulley, cuff on the working ankle, stand facing away, tall on the support leg, core braced, hips square.",
    move: "Drive the knee up toward the chest to ~thigh-parallel, 3-s hold at the top, lower under control. 3×10/leg.",
    cue: "Stand tall on one leg — don't lean back or arch. Foot dorsiflexed.",
    feel: "The hip flexor at the front of the hip working, plus balance and standing-core holding you steady."
  },
  "copenhagen-plank": {
    setup: "Side plank with your TOP foot/shin resting on a bench, bottom leg hanging underneath, forearm down, body in one line.",
    move: "Lift the bottom leg up to meet the bench and hold — hips stacked, no sag. Start knee-bent (shin on the bench, short lever); progress toward a straight top leg over the weeks. Log hold seconds/side.",
    cue: "Start regressed and short — a bent top knee is a much easier lever. Hips stay stacked, body straight.",
    feel: "A strong pull in the inner thigh/groin (adductors) of the top leg, plus the obliques bracing."
  },
  "suitcase-carry": {
    setup: "One heavy DB/KB at one side, stand tall, shoulders level. Done while grip is fresh.",
    move: "Walk a normal pace ~60 s, no lean toward or away from the weight, no shrug. Switch arms. Not to failure.",
    cue: "Anti-lean — the trunk fights side-bending the whole walk. Posture never breaks.",
    feel: "Grip, and the side of your trunk opposite the weight working to keep you upright."
  },
  "reverse-wrist-curl": {
    setup: "Forearms flat on a bench, palms down, DBs in hands, wrists just past the bench edge.",
    move: "Raise the knuckles up (wrist extension), lower slowly. 3·3 tempo, forearms never leave the bench; last set to failure.",
    cue: "Only the wrists move — trains the extensors and lateral elbow (counters all-day gripping).",
    feel: "A burn on the top of the forearm and the outer elbow. Day-1 finisher — nothing after needs grip."
  },
  "cable-pulldown": {
    setup: "Seated, thighs locked under the pad, slight backward lean from the hips — then hold that torso angle.",
    move: "Pull the bar to the upper chest, driving the elbows down and back; resist up to a full stretch. 3·3, no swinging.",
    cue: "Lead with the elbows, chest up; the lean stays fixed (no heaving).",
    feel: "Lats doing the pull and a full stretch at the top; biceps and medial elbow assist."
  },
  "chest-press": {
    setup: "Shoulder blades set back and down, feet planted; handles at mid-chest.",
    move: "Press to just short of lockout (keep tension), lower 3 s to a deep, comfortable stretch.",
    cue: "Stop short of locking the elbows; control the stretch — don't let it collapse.",
    feel: "Pecs and front of the shoulder; a stretch across the chest at the bottom."
  },
  "cable-row": {
    setup: "Half-kneeling (down-knee under hip), tall trunk, glute squeezed; cable handle in the opposite hand, arm extended with tension.",
    move: "Row the handle to the ribs, driving the elbow back; resist out slowly. The torso does not twist.",
    cue: "Anti-rotation — the core stops the torso turning while the arm pulls. If it twists, it's too heavy.",
    feel: "Upper-back and lat on the working side, plus the core resisting the twist. Per arm."
  },
  "triceps-overhead": {
    setup: "Face away from a pulley with a rope, hands by the head, elbows high and pointing forward, upper arms still.",
    move: "Extend the elbows to straighten the arms forward; lower 3 s to a full triceps stretch behind the head. Upper arms don't drop.",
    cue: "Cable keeps constant tension; the loaded stretch is the long-head + elbow-tendon stimulus.",
    feel: "A deep stretch in the back of the upper arm (long head of the triceps) and the elbow."
  },
  "face-pulls": {
    setup: "Cable at face height, rope in both hands, step back to tension, tall posture.",
    move: "Pull the rope toward the forehead, elbows high and wide, a hard 2-s squeeze of the shoulder blades; control back out.",
    cue: "Elbows lead and stay high — rear delts and scapular retractors.",
    feel: "Rear shoulders and between the shoulder blades; it balances all the pressing."
  },
  "lateral-raise": {
    setup: "Tall, slight elbow bend, DBs at the sides.",
    move: "Raise the arms out to the sides to ~shoulder height (no higher), 2 s up / 2 s down. No swing, no shrug.",
    cue: "Lead with the elbows to shoulder height only.",
    feel: "The side delt (shoulder cap) doing all of it — not the traps."
  },
  "internal-rotation": {
    setup: "Lie on your back (or stand with a cable), a rolled towel under the working upper arm, elbow bent 90° tucked at your side.",
    move: "Rotate the forearm across the body toward the belly (internal rotation), control back out. 2×15/arm, light — leave 3–4 reps in the tank.",
    cue: "Submaximal cuff work, not a max lift — slow and controlled. The towel keeps the shoulder in a good position.",
    feel: "A light working sensation deep in the front of the shoulder (subscapularis). Never strained."
  }
};
