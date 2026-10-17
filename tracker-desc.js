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
  "face-pulls":"facep", "lateral-raise":"latr", "db-chest-press":"dbpress",
  /* 2026-10-17: from the owner's own photo album (the Lu raise clip shrunk from 21 MB to 1.3 MB, 240x360) */
  "lu-raise":"luraise", "calf-raise-standing":"calfstand", "back-extension-45":"backext"
};
/* lifts whose picture is not added yet (2026-10-13): the card shows a labelled placeholder naming the
   expected file (project lesson L-2: never a silent gap). Move an entry to EX_GIF once its gif is in gifs/. */
var EX_GIF_PENDING = {
  "db-overhead-press":"dbohp", "side-lying-er":"sler",
  /* home exercises (2026-10-13) */
  "bear-crawl":"bearcrawl", "bear-step-through":"bearstep", "hollow-hold":"hollow", "lateral-step-down":"stepdown",
  "sissy-squat":"sissy", "reverse-nordic":"revnordic", "glute-bridge-hold":"bridge", "rkc-plank":"rkcplank"
};
/* 2026-10-17 (owner, exercise-review/review.md): the gym lifts' speed is "lower in about 3 s, then lift firmly in
   about 1–2 s, no jerk or bounce" (the old 3 s down / 3 s up is gone); the face-pull squeeze, the hip-flexion top
   hold and the back-extension squeeze stay. The right-knee and left-shoulder lifts carry ONE note — "scale the
   weight down yourself" — folded into the lift's own pain rule where it has one. No numbers are lowered for pain. */
var EX_DESC = {
  "atg-split-squat": {
    setup: "Split stance, both feet pointing forward; front foot flat (heel stays down), rear heel up on the ball. Torso tall. Front heel on a small wedge is optional for ankle range.",
    move: "Sink straight down, driving the front knee well forward past the toes, until the front hamstring covers the calf and the rear knee hovers off the floor. Lower in about 3 s, then lift firmly in about 1–2 s, no jerk or bounce.",
    cue: "Knees-over-toes is the point — don't keep the shin vertical. Heel down, torso tall. Per leg. If the right knee hurts, scale the weight down yourself.",
    feel: "Deep load through the front knee, quad and patellar tendon; glute drives you back up."
  },
  "rdl": {
    setup: "Stand tall, bar at the hips, soft knees, lats tight, neutral spine.",
    move: "Hinge at the hips, push the butt back; bar slides down the thighs to ~mid-shin, then drive the hips forward to stand. Lower in about 3 s, then lift firmly in about 1–2 s — no jerk, no bottom bounce, no top lean-back.",
    cue: "Hips back, not down — it's a hinge, not a squat. Straps if grip quits before the hamstrings. Back after big soreness: first 2 sessions 1 set, stop 3–4 reps before failure.",
    feel: "A strong stretch high in the hamstrings (near the sit-bones) at the bottom — that, not the lower back."
  },
  "leg-curl": {
    setup: "Pad on the lower shin/Achilles, knees just off the bench edge.",
    move: "Curl the heels toward the glutes through full range; control the lower for 3 s. No hip-pop or swing.",
    cue: "This is the hamstring at the knee — the bit the RDL misses. Smooth, no momentum. If the right knee hurts, scale the weight down yourself.",
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
    move: "Pull the toes up toward the shins (full dorsiflexion) firmly in about 1–2 s, lower in about 3 s. Leave 1–2 reps in reserve.",
    cue: "Heels stay planted; only the forefoot moves.",
    feel: "A burn in the front-of-shin muscle (tibialis). Nothing in the calf."
  },
  "hip-flexion": {
    setup: "Low pulley, cuff on the working ankle, stand facing away, tall on the support leg, core braced, hips square.",
    move: "Drive the knee up toward the chest to ~thigh-parallel, 3-s hold at the top, lower under control. 3×10/leg.",
    cue: "Stand tall on one leg — don't lean back or arch. Foot dorsiflexed. If the right knee hurts, scale the weight down yourself.",
    feel: "The hip flexor at the front of the hip working, plus balance and standing-core holding you steady."
  },
  "copenhagen-plank": {
    setup: "Side plank with your TOP foot/shin resting on a bench, bottom leg hanging underneath, forearm down, body in one line.",
    move: "Lift the bottom leg up to meet the bench and hold — hips stacked, no sag. Start knee-bent (shin on the bench, short lever); progress toward a straight top leg over the weeks. Log hold seconds/side.",
    cue: "Start regressed and short — a bent top knee is a much easier lever. Hips stay stacked, body straight.",
    feel: "A strong pull in the inner thigh/groin (adductors) of the top leg, plus the obliques bracing."
  },
  "suitcase-carry": {
    setup: "One heavy DB/KB at one side, stand tall, shoulders level. It sits on the day without the deadlift, so your grip is as fresh as it gets at the end.",
    move: "Walk a normal pace ~60 s, no lean toward or away from the weight, no shrug. Switch arms. Not to failure.",
    cue: "Anti-lean — the trunk fights side-bending the whole walk. Posture never breaks.",
    feel: "Grip, and the side of your trunk opposite the weight working to keep you upright."
  },
  "reverse-wrist-curl": {
    setup: "Forearms flat on a bench, palms down, DBs in hands, wrists just past the bench edge.",
    move: "Raise the knuckles up (wrist extension) firmly in about 1–2 s, lower in about 3 s. Forearms never leave the bench; last set to failure.",
    cue: "Only the wrists move — trains the extensors and lateral elbow (counters all-day gripping).",
    feel: "A burn on the top of the forearm and the outer elbow. The Day B finisher — nothing after needs grip."
  },
  "cable-pulldown": {
    setup: "Seated, thighs locked under the pad, slight backward lean from the hips — then hold that torso angle.",
    move: "Pull the bar to the upper chest firmly in about 1–2 s, driving the elbows down and back; let it up in about 3 s to a full stretch. No swinging or jerking.",
    cue: "Lead with the elbows, chest up; the lean stays fixed (no heaving). If the left shoulder hurts, scale the weight down yourself.",
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
    cue: "Cable keeps constant tension; the loaded stretch is the long-head + elbow-tendon stimulus. If the left shoulder hurts, scale the weight down yourself.",
    feel: "A deep stretch in the back of the upper arm (long head of the triceps) and the elbow."
  },
  "face-pulls": {
    setup: "Cable at face height, rope in both hands, step back to tension, tall posture.",
    move: "Pull the rope toward the forehead, elbows high and wide, a hard 2-s squeeze of the shoulder blades; control back out.",
    cue: "Elbows lead and stay high — rear delts and scapular retractors. If the left shoulder hurts, scale the weight down yourself.",
    feel: "Rear shoulders and between the shoulder blades; it balances all the pressing."
  },
  "lateral-raise": {
    setup: "Tall, slight elbow bend, DBs at the sides.",
    move: "Raise the arms out to the sides to ~shoulder height (no higher), 2 s up / 2 s down. No swing, no shrug.",
    cue: "Lead with the elbows to shoulder height only.",
    feel: "The side delt (shoulder cap) doing all of it — not the traps."
  },
  "db-chest-press": {
    setup: "Lie on a flat bench, a dumbbell in each hand above your chest, feet planted, shoulder blades pulled back and down. The weight shown is ONE dumbbell.",
    move: "Lower the dumbbells in about 3 s, elbows angled about 45° from your body, until your hands are level with your chest or a little below. Press back up firmly in about 1–2 s to just short of lockout.",
    cue: "Full depth every rep, a little deeper each week rather than all at once. Last set: when the reps slow right down, stop one rep short rather than failing with the weights over your chest. Back after big soreness: first 2 sessions 1 set, stop 3–4 reps before failure. If the left shoulder hurts, scale the weight down yourself.",
    feel: "Pecs and the front of the shoulder; a strong stretch across the chest at the bottom."
  },
  "lu-raise": {
    setup: "Stand tall, feet shoulder-width, light dumbbells in front of your thighs, elbows only slightly bent, stomach tight.",
    move: "Raise the arms out to the sides and a little forward, past shoulder height, all the way until your hands are overhead; lower along the same path. Lift in about 1–2 s, lower in 2–3 s, no swinging.",
    cue: "Keep it light: the long arc makes small weights hard. Don't lean back to get the arms up; if a point of the arc pinches, stop just below it, and if the left shoulder hurts, scale the weight down yourself.",
    feel: "The shoulder caps working the whole way up; above shoulder height the upper back joins in, which is normal."
  },
  "calf-raise-standing": {
    setup: "Standing, balls of the feet on a block or step, knees straight (soft, not locked). Calf machine with the pads on your shoulders — or hold a dumbbell and do one leg at a time.",
    move: "Lower the heels for 3 s into a deep stretch, pause 2–3 s in the stretch, then lift firmly in about 1–2 s as high onto the toes as you can. Full range.",
    cue: "Knees straight puts the work on the big outer calf as well as the deep one. The paused bottom stretch is the Achilles stimulus — never bounce out of it.",
    feel: "The whole calf working, and a loaded stretch in the calf and Achilles at the bottom."
  },
  "db-overhead-press": {
    setup: "Stand tall, feet hip-width, dumbbells at shoulder height, palms forward or slightly in. Squeeze your glutes and pull the ribs down. The weight shown is ONE dumbbell.",
    move: "Press both dumbbells up firmly in about 1–2 s until the arms are straight overhead, lower in about 3 s back to the shoulders. Only the range that is pain-free.",
    cue: "Ribs down, no lean-back: if your lower back arches to get the arms up, that rep ends there. Last set one rep short. A stab in the shoulder during the press, or a shoulder ache the next day, stops this exercise until the physio check; if the left shoulder hurts less than that, scale the weight down yourself.",
    feel: "Shoulders and triceps pressing; stomach and glutes holding the body still."
  },
  "side-lying-er": {
    setup: "Lie on your side, the working arm on top, a folded towel between the elbow and your side, elbow bent 90°, a light dumbbell in front of your belly. Start at 1–3 kg.",
    move: "Rotate the forearm up and away from your belly as far as is comfortable, keeping the elbow on the towel; hold 2 s at the top, then lower for 3 s. 3 × 10–15 per arm.",
    cue: "Only the forearm turns — the elbow stays pinned to the towel. If the left shoulder hurts, scale the weight down yourself: pain at most 3/10 and settled by the next session, and a stab stops it. It comes after the day's presses and pulls: a tired cuff lets the shoulder ball ride up.",
    feel: "The back of the shoulder (the small rotator-cuff muscles) working. Nothing sharp."
  },
  "back-extension-45": {
    setup: "45° back-extension bench, the pad just below your hip bones, feet locked in, body in one line, arms crossed on the chest. At least 2 h after eating.",
    move: "Lower the upper body for 3 s, bending at the hips and letting the back round a little, then lift firmly in about 1–2 s to a straight line and squeeze the glutes hard for 2–3 s at the top. 1 set of 12–20 reps.",
    cue: "Stop at a straight line — don't overarch at the top. Body weight until 20 clean reps, then hold a 2.5–5 kg plate (tap the line to enter it). If heartburn starts, stop at horizontal, or skip it that day.",
    feel: "Lower back, glutes and hamstrings working, and the glute squeeze at the top."
  },
  /* ---- home exercises (2026-10-13, home-plan.md version 2): every set by effort, near failure ---- */
  "bear-crawl": {
    setup: "On hands and feet, hands under the shoulders, knees under the hips and lifted 2–5 cm off the floor, back flat, ribs down. Warm up the wrists first.",
    move: "Crawl slowly forward and back: opposite hand and foot move together, small steps.",
    cue: "Hips stay level and knees stay low the whole time; end the set when the hips start to rock or rise.",
    feel: "Stomach and shoulders holding the body still while the arms and legs move."
  },
  "bear-step-through": {
    setup: "Start in the bear position: hands under the shoulders, knees under the hips, lifted 2–5 cm.",
    move: "Lift the hand opposite the stepping leg, pivot on the ball of the planted foot, sweep the leg through under the body and straighten it out to the side, hips up. Come back the same way and switch. 2–3 s each way.",
    cue: "Turn the foot, never twist the knee (right knee). No stab in the left shoulder while that hand supports. End the set when the hips sag or twist.",
    feel: "The whole trunk turning under control, shoulders and hips working together."
  },
  "hollow-hold": {
    setup: "On your back, lower back pressed into the floor, shoulders lifted, ribs down.",
    move: "Hold. Start with the knees bent; progress to straighter and lower legs, then arms overhead (where your ribs want to lift).",
    cue: "Only as far as the lower back stays flat; end the hold when it starts to lift. Past about 45 s with good form, use the harder version.",
    feel: "The front of the stomach working hard; nothing in the lower back."
  },
  "lateral-step-down": {
    setup: "Stand on one leg on a chair-height step, the other foot hanging off the side.",
    move: "Lower over 3 s until the free heel touches the floor, then stand back up. Alternate legs: one leg's set is the other leg's rest.",
    cue: "Knee over the second toe, never caving or twisting; hips level. Stop 1–2 reps before it would cave. Lower step if the right knee hurts (at most 3/10, gone by morning). At 3 × 10 clean: the single-leg box squat, arms reaching forward.",
    feel: "The front of the thigh and the side of the hip of the standing leg."
  },
  "sissy-squat": {
    setup: "Stand tall holding a support, feet in the normal position (never turned out).",
    move: "Let the knees travel forward while the body stays in one line from knees to shoulders; go as low as the knee rule allows, then come back up.",
    cue: "Stop 1–2 reps before failure. Harder later: deeper and slower, before adding sets.",
    feel: "Hard work and a stretch in the front of the thighs, above the knees."
  },
  "reverse-nordic": {
    setup: "Kneel upright on a pad, body straight from knees to head, glutes squeezed so the hips stay straight.",
    move: "Lean back slowly only as far as you can control, then come back up.",
    cue: "Stop when the next rep would not come back under control. For more reps, lean back a little less; deepen the lean over the weeks. Expect sore thighs at first.",
    feel: "The front of the thighs working while they lengthen, and a stretch at the front of the hips."
  },
  "glute-bridge-hold": {
    setup: "On your back, feet hip-width, heels about a shin's length from your bottom.",
    move: "Tuck the pelvis first, push through the heels to a straight line from knees to shoulders, squeeze and hold until the hips start to drop.",
    cue: "Ribs down; stop just before any back pinch. Progression: two legs → one leg (when 45 s on two legs is easy) → the crab hold (when the one-leg hold reaches 3 × 30 s per leg, pelvis level, no pinch): sit, hands behind you, hips up to a flat table, chest open; hands wider or fingers out if the left shoulder pinches.",
    feel: "The glutes doing the holding at the top; in the crab also a stretch across the front of the shoulders."
  },
  "rkc-plank": {
    setup: "Forearms down, elbows a hand's width in front of the shoulders, legs straight.",
    move: "Tuck the pelvis, squeeze the glutes as hard as you can, ribs down, and pull the elbows toward the toes without moving. 10 s at full tension.",
    cue: "Full tension, short holds; rest 30–60 s. Harder: elbows further forward.",
    feel: "The whole front of the body shaking with effort; nothing in the lower back."
  },
  "internal-rotation": {
    setup: "Lie on your back (or stand with a cable), a rolled towel under the working upper arm, elbow bent 90° tucked at your side.",
    move: "Rotate the forearm across the body toward the belly (internal rotation), control back out. 2×15/arm, light — leave 3–4 reps in the tank.",
    cue: "Submaximal cuff work, not a max lift — slow and controlled. The towel keeps the shoulder in a good position.",
    feel: "A light working sensation deep in the front of the shoulder (subscapularis). Never strained."
  }
};
