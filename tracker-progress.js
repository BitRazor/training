"use strict";
/* tracker-progress.js: the read-only screens built from data version 1 already keeps (version 2, 2026-11-04):
   Progress (lift chart, stats, personal bests, consistency) and the Exercises library with its exercise sheet.
   Loaded after the views and the Workout (tracker-plan.js), before the actions and the core. */

/* ---------- the Exercises library: every move of the active program's days and the home days, warm-up last ---------- */
function dayTitle(d){ return d === "strength-a" ? "Day A" : d === "strength-b" ? "Day B" : ((db.programs[d] && db.programs[d].name) || d); }
function libraryGroups(){
  var days = getProgram(db.activeProgram).days.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []), groups = [], seen = {}, wu = [];
  days.forEach(function(d){
    var D = db.programs[d]; if(!D) return;
    groups.push({ id: d, title: dayTitle(d), items: D.entries.map(function(en){ return { id: en.exerciseId, kind: "lift", day: d, name: (exById(en.exerciseId) || { name: en.exerciseId }).name }; }) });
  });
  days.forEach(function(d){ (WARMUP_BY_PROG[d] || []).forEach(function(m){ if(seen[m.gif]) return; seen[m.gif] = 1; wu.push({ id: "wu:" + m.gif, kind: "warm", day: d, name: m.name, move: m }); }); });
  if(wu.length) groups.push({ id: "warmup", title: "Warm-up", items: wu });
  return groups;
}
function renderExercises(){
  $("#view-exercises").innerHTML = subHead("Exercises") + libraryGroups().map(function(g){
    return '<div class="sectH">' + esc(g.title) + '</div><div class="list">' + g.items.map(function(it){ return '<div class="li">' + esc(it.name) + '</div>'; }).join("") + '</div>';
  }).join("");
}

/* ---------- PROGRESS ---------- */
function renderProgress(){
  $("#view-progress").innerHTML = mainHead("Progress") + '<div class="card note">Your lifts over time, personal bests and how regularly you train.</div>';
}
