"use strict";
/* tracker-week.js: the week schedule and the workout names (version 2, 2026-11-04; the dossier's build-log.md,
   "Part 1: session control, schedule editor, names, update feedback").
   - db.schedule (additive): null = the original week (CURRENT_WEEK in tracker-seed.js, never changed), else 7 entries
     in its shape {day, label, type, ref, note, home?}. weekPlan() is the week every screen reads (Today, the week
     strip, todayProgram, the summary's "Next: … on …"). Ticks, week counters and the diary key on the workout day
     (strength-a …), never on the weekday, so moving a day touches none of them.
   - the editor (view "schedule", from Today's "Edit week" and More's "Week schedule"): Mon–Sun; a day's sheet chooses
     Day A, Day B, Home · Wed, Home · Sun, Zone 2, the 4×4 or rest, and on a cardio day (Zone 2 or the 4×4) one home
     workout on top. A workout sits on one day only: moving it leaves its old day as rest; one riding on a cardio day
     just leaves it. Every change has an Undo; "Reset to the original week".
   - db.dayNames (additive): {dayId: "his name"}; empty = the default: "Day A", "Day B", and for a home workout
     "Home · " + the weekday it sits on. dayName() is the one name every screen shows (shortName and dayTitle use it).
     Rename from the Workout header or the editor's names list.
   Version 1 ignores both fields, so a version 2 export still imports there. Loaded after tracker-progress.js, before
   the actions and the core. */

var DAY_CHOICES = ["strength-a", "strength-b", "home-wed", "home-sun", "z2", "norwegian-4x4", "rest"];
var CHOICE_TITLE = { z2: "Zone 2 cardio", "norwegian-4x4": "Norwegian 4×4", rest: "Rest" };
var CHOICE_SUB = { z2: "45–60 min, easy", "norwegian-4x4": "4 × 4 min, hard", rest: "No training" };
var CHOICE_TYPE = { z2: "cardio", "norwegian-4x4": "hiit", rest: "rest" };
/* a home workout riding on a cardio day gets its own card on Today */
var ADDON_TITLE = { "home-wed": "Home core", "home-sun": "Home legs" };
/* Home · Wed has no day of its own in the original week: its entry when it gets one */
var EXTRA_DAY = { "home-wed": { label: "Home · core", type: "home", ref: "home-wed", note: "Core and hips · no knee work" } };
var STRIP_WORD = { cardio: "Zone 2", hiit: "4×4", rest: "Rest" };
var NAME_MAX = 30;

/* ---------- the week ---------- */
function workoutDays(){ return STRENGTH_DAYS.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []); }
function isWorkoutDay(id){ return workoutDays().indexOf(id) >= 0; }
function isCardioType(t){ return t === "cardio" || t === "hiit"; }
function hasWorkout(d){ return !!d && (d.type === "strength" || d.type === "home"); }
/* what a day is, as one of DAY_CHOICES */
function choiceOf(d){ return (!d || d.type === "rest") ? "rest" : d.ref; }
function choiceType(c){ return CHOICE_TYPE[c] || (STRENGTH_DAYS.indexOf(c) >= 0 ? "strength" : "home"); }
/* the week every screen reads */
function weekPlan(){ return (db && Array.isArray(db.schedule) && db.schedule.length === 7) ? db.schedule : CURRENT_WEEK; }
/* the entry a choice makes: label and note from the original week where it has a day there */
function dayTemplate(c){
  var t = null;
  for(var i = 0; i < CURRENT_WEEK.length && !t; i++){ var d = CURRENT_WEEK[i]; if(c === "rest" ? d.type === "rest" : (d.type !== "rest" && d.ref === c)) t = d; }
  t = t || EXTRA_DAY[c] || (isWorkoutDay(c) ? { label: (db && db.programs && db.programs[c] && db.programs[c].name) || c, type: choiceType(c), ref: c, note: "" } : null);
  return t ? { label: t.label, type: t.type, ref: t.ref == null ? null : t.ref, note: t.note || "" } : null;
}
function makeDay(j, c, home){
  var t = dayTemplate(c) || dayTemplate("rest"), e = { day: CURRENT_WEEK[j].day, label: t.label, type: t.type, ref: t.ref, note: t.note };
  if(home && isCardioType(t.type)) e.home = home;
  return e;
}
function sameWeek(a, b){
  for(var j = 0; j < 7; j++) if(choiceOf(a[j]) !== choiceOf(b[j]) || ((a[j] && a[j].home) || null) !== ((b[j] && b[j].home) || null)) return false;
  return true;
}
/* a stored week made safe (normalize and every edit): 7 entries rebuilt from what each day is; a workout on one day
   only (the first wins); a home workout on top only of a cardio day; anything unknown is rest. The original week,
   or anything that is not 7 days, gives null */
function cleanSchedule(raw){
  if(!Array.isArray(raw) || raw.length !== 7) return null;
  var used = {};
  var out = raw.map(function(e, j){
    var ok = !!e && typeof e === "object", c = ok ? (e.type === "rest" ? "rest" : e.ref) : "rest";
    if(DAY_CHOICES.indexOf(c) < 0 || (isWorkoutDay(c) && used[c])) c = "rest";
    if(isWorkoutDay(c)) used[c] = true;
    var hm = (ok && typeof HOME_DAYS !== "undefined" && HOME_DAYS.indexOf(e.home) >= 0 && !used[e.home]) ? e.home : null;
    var d = makeDay(j, c, hm);
    if(d.home) used[d.home] = true;
    return d;
  });
  return sameWeek(out, CURRENT_WEEK) ? null : out;
}
/* where a workout sits: {j, as: "main" | "home"} or null (not on the week) */
function slotOf(id, plan){
  plan = plan || weekPlan();
  for(var j = 0; j < plan.length; j++){ var d = plan[j]; if(!d || typeof d !== "object") continue;
    if(hasWorkout(d) && d.ref === id) return { j: j, as: "main" };
    if(d.home === id) return { j: j, as: "home" }; }
  return null;
}
/* "On Tuesday" / "With Wednesday's Zone 2" / "Not on the week" */
function whereText(id, plan){
  plan = plan || weekPlan(); var s = slotOf(id, plan);
  if(!s) return "Not on the week";
  return s.as === "main" ? "On " + WEEKDAY_LONG[s.j] : "With " + WEEKDAY_LONG[s.j] + "'s " + (plan[s.j].type === "hiit" ? "4×4" : "Zone 2");
}

/* ---------- names ---------- */
function customName(id){ var n = db && db.dayNames && db.dayNames[id]; return (typeof n === "string" && n.trim()) ? n.trim() : null; }
function defaultDayName(id){
  if(id === "strength-a") return "Day A";
  if(id === "strength-b") return "Day B";
  var s = (typeof isHomeDay === "function" && isHomeDay(id)) ? slotOf(id) : null;
  if(s) return "Home · " + weekPlan()[s.j].day;   /* a home workout is named after the day it sits on */
  return (db && db.programs && db.programs[id] && db.programs[id].name) || id;
}
function dayName(id){ return customName(id) || defaultDayName(id); }
function namesNow(){ var o = {}; workoutDays().forEach(function(id){ o[id] = dayName(id); }); return o; }
/* stored names made safe: known workout days only, text, spaces squeezed, at most 30 characters, empty dropped */
function cleanNames(raw){
  var out = {};
  if(!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  workoutDays().forEach(function(id){ var v = raw[id]; if(typeof v !== "string") return; v = v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim(); if(v) out[id] = v; });
  return out;
}
/* the Workout's home tab: his name, else the weekday it sits on ("Wed") */
function homeTabLabel(id){ var cn = customName(id); if(cn) return cn; var s = slotOf(id); return s ? weekPlan()[s.j].day : String(dayName(id)).replace(/^Home · /, ""); }
/* the week strip's word under a day's icon, so Day A and Day B are told apart */
function stripWord(d){ return hasWorkout(d) ? (customName(d.ref) || (d.type === "home" ? "Home" : defaultDayName(d.ref))) : (STRIP_WORD[d.type] || ""); }
/* a home workout riding on a cardio day, in running text: "home core", or his name */
function addonWord(hid){ return customName(hid) || (ADDON_TITLE[hid] || dayName(hid)).toLowerCase(); }
/* what a day is, for the editor: the workout's name, or "Zone 2 cardio" / "Norwegian 4×4" / "Rest" */
function dayWhat(d){ return hasWorkout(d) ? dayName(d.ref) : (CHOICE_TITLE[choiceOf(d)] || d.label || ""); }

/* ---------- the editor page ---------- */
function renderSchedule(){
  var plan = weekPlan(), from = ui.schedFrom === "today" ? "today" : "more", today = weekdayIdx();
  var h = '<div class="pageTop"><button class="backBtn" data-view="' + from + '" aria-label="Back to ' + (from === "today" ? "Today" : "More") + '">' + icon("chevL") + '</button></div>' +
    '<div class="viewH">Week schedule</div><div class="viewSub">Tap a day to choose what it is. A workout sits on one day: moving it leaves its old day as rest.</div>';
  h += '<div class="list schedList">' + plan.map(function(d, j){
    return '<button class="li schedRow' + (j === today ? " today" : "") + '" data-act="schedday" data-day="' + j + '">' +
      '<span class="sdWd">' + esc(d.day) + '</span><span class="dot ' + esc(d.type) + '">' + icon(DAY_ICON[d.type] || "calendar") + '</span>' +
      '<span class="liB"><span class="liT"><span class="sdWhat">' + esc(dayWhat(d)) + '</span>' + (d.home ? '<span class="sdAdd">+ ' + esc(dayName(d.home)) + '</span>' : '') + '</span>' +
      '<span class="liS sdSub">' + esc(d.note || "") + '</span></span>' + icon("chevR", "chev") + '</button>';
  }).join("") + '</div>';
  var off = workoutDays().filter(function(id){ return !slotOf(id, plan); });
  if(off.length) h += '<div class="note schedOff">Not on the week: ' + off.map(function(id){ return esc(dayName(id)); }).join(", ") + '</div>';
  if(Array.isArray(db.schedule)) h += '<button class="btn block schedReset" data-act="schedreset">' + icon("undo") + 'Reset to the original week</button>';
  h += '<div class="sectH">Workout names</div><div class="list nameList">' + workoutDays().map(function(id){
    var home = isHomeDay(id);
    return '<button class="li nameRow" data-act="rename" data-prog="' + id + '"><span class="dot ' + (home ? "home" : "strength") + '">' + icon(home ? "house" : "dumbbell") + '</span>' +
      '<span class="liB"><span class="liT">' + esc(dayName(id)) + '</span><span class="liS">' + esc(whereText(id, plan)) + '</span></span>' + icon("edit", "chev") + '</button>';
  }).join("") + '</div><div class="note setNote">Tap a workout to rename it. An empty name brings the default back.</div>';
  $("#view-schedule").innerHTML = h;
}
/* a day's sheet: what the day is (the workouts, then cardio or rest), and on a cardio day one home workout on top */
function openDaySheet(j){
  var plan = weekPlan(), d = plan[j]; if(!d) return;
  var cur = choiceOf(d);
  var row = function(c){
    var sel = c === cur, w = isWorkoutDay(c), ic = w ? (isHomeDay(c) ? "house" : "dumbbell") : DAY_ICON[CHOICE_TYPE[c]];
    return '<button class="li choice' + (sel ? " sel" : "") + '" data-act="schedset" data-day="' + j + '" data-choice="' + c + '" aria-pressed="' + sel + '">' +
      '<span class="dot ' + choiceType(c) + '">' + icon(ic) + '</span><span class="liB"><span class="liT">' + esc(w ? dayName(c) : CHOICE_TITLE[c]) + '</span>' +
      '<span class="liS">' + esc(w ? whereText(c, plan) : CHOICE_SUB[c]) + '</span></span>' + (sel ? '<span class="chk">' + icon("check") + '</span>' : '') + '</button>';
  };
  var h = '<div class="daySheet"><div class="sectH">Workout</div><div class="list choiceList">' + workoutDays().map(row).join("") + '</div>' +
    '<div class="sectH">Cardio or rest</div><div class="list choiceList">' + ["z2", "norwegian-4x4", "rest"].map(row).join("") + '</div>';
  if(isCardioType(d.type)) h += '<div class="sectH">Plus a home workout</div><div class="chips homeAdd">' + [""].concat(HOME_DAYS).map(function(hid){
    var sel = (d.home || "") === hid;
    return '<button class="chip' + (sel ? " sel" : "") + '" data-act="schedhome" data-day="' + j + '" data-home="' + hid + '" aria-pressed="' + sel + '">' + esc(hid ? dayName(hid) : "None") + '</button>';
  }).join("") + '</div>';
  openSheet(WEEKDAY_LONG[j], h + '</div>', { cls: "dayCard", closeLabel: "Done" });
}
/* store an edited week (null when it is the original again) and redraw */
function commitWeek(wk){
  db.schedule = cleanSchedule(wk); save();
  if(ui.view === "schedule") renderSchedule(); else if(ui.view === "today") renderToday();
}
/* day j becomes choice c. A workout moved here leaves its old day as rest (or just leaves the cardio day it rode on);
   what this day held is off the week, except a home workout on top when the day stays cardio */
function setDayChoice(j, c){
  var plan = weekPlan(), d = plan[j]; if(!d || DAY_CHOICES.indexOf(c) < 0) return;
  if(choiceOf(d) === c){ closeModal(); return; }
  var nm = namesNow(), undo = undoPoint(), wk = clone(plan), parts = [], wd = WEEKDAY_LONG[j], gone = [];
  var type = choiceType(c), keep = (isCardioType(type) && d.home && d.home !== c) ? d.home : null;
  if(hasWorkout(d)) gone.push(d.ref);
  if(d.home && !keep && d.home !== c) gone.push(d.home);
  if(isWorkoutDay(c)){
    var at = slotOf(c, wk);
    if(at && at.j !== j){
      parts.push(nm[c] + " moved to " + wd);
      if(at.as === "main"){ wk[at.j] = makeDay(at.j, "rest"); parts.push(WEEKDAY_LONG[at.j] + " is now rest"); }
      else delete wk[at.j].home;
    } else parts.push(wd + " is now " + nm[c]);
  } else parts.push(wd + " is now " + (c === "rest" ? "rest" : CHOICE_TITLE[c]));
  wk[j] = makeDay(j, c, keep);
  gone.forEach(function(id){ parts.push(nm[id] + " is off the week"); });
  commitWeek(wk);
  if(isCardioType(type)) openDaySheet(j); else closeModal();   /* a cardio day stays open for a home workout on top */
  toast(parts.join(" · "), { undo: undo });
}
/* the home workout on top of cardio day j (null = none) */
function setDayHome(j, hid){
  var plan = weekPlan(), d = plan[j]; hid = hid || null;
  if(!d || !isCardioType(d.type) || (hid && (typeof HOME_DAYS === "undefined" || HOME_DAYS.indexOf(hid) < 0))) return;
  if((d.home || null) === hid){ closeModal(); return; }
  var nm = namesNow(), undo = undoPoint(), wk = clone(plan), parts = [], wd = WEEKDAY_LONG[j];
  if(hid){
    var at = slotOf(hid, wk);
    if(at){ parts.push(nm[hid] + " moved to " + wd); if(at.as === "main"){ wk[at.j] = makeDay(at.j, "rest"); parts.push(WEEKDAY_LONG[at.j] + " is now rest"); } else delete wk[at.j].home; }
    else parts.push(nm[hid] + " added to " + wd);
    wk[j].home = hid;
  } else delete wk[j].home;
  if(d.home) parts.push(nm[d.home] + " is off the week");
  commitWeek(wk); closeModal();
  toast(parts.join(" · "), { undo: undo });
}
function resetWeek(){
  if(!Array.isArray(db.schedule)) return;
  var undo = undoPoint(); db.schedule = null; save(); renderSchedule();
  toast("Back to the original week", { undo: undo });
}

/* ---------- renaming ---------- */
function openRename(id){
  if(!isWorkoutDay(id)) return;
  var cn = customName(id), def = defaultDayName(id);
  openModal({ title: "Rename workout", mode: "line", value: cn || def, placeholder: def, maxLength: NAME_MAX, cls: "renameSheet",
    html: '<div class="renameHint">Leave it empty for the default name, ' + esc(def) + '.</div>' +
      (cn ? '<button class="btn ghost block renameReset" data-act="renamereset" data-prog="' + id + '">' + icon("undo") + 'Reset name</button>' : ''),
    onSubmit: function(v){ saveDayName(id, v); } });
}
/* store a name: trimmed, at most 30 characters; empty or the default = no name of his own */
function saveDayName(id, v){
  if(!isWorkoutDay(id)) return;
  var before = dayName(id), t = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
  if(t === defaultDayName(id)) t = "";
  if((t || null) === customName(id)) return;   /* nothing changes */
  var undo = undoPoint();
  if(!db.dayNames || typeof db.dayNames !== "object" || Array.isArray(db.dayNames)) db.dayNames = {};
  if(t) db.dayNames[id] = t; else delete db.dayNames[id];
  save();
  if(ui.view === "programs") renderPlan(); else if(ui.view === "schedule") renderSchedule(); else showView(ui.view);
  toast(t ? before + " is now called " + t : "Name back to " + dayName(id), { undo: undo });
}

/* the Android back button: from the editor back to where it was opened (Today or More); after the sheet closer */
if(window.Native && Array.isArray(Native.backHandlers)) Native.backHandlers.splice(1, 0, function(){
  if(typeof ui !== "undefined" && ui && ui.view === "schedule" && typeof showView === "function"){ showView(ui.schedFrom === "today" ? "today" : "more"); return true; }
  return false;
});
