"use strict";
/* training-tracker — the 12-week Plan view: week picker (1–13), per-week prescription,
   expandable How-to, and mark-week-done. Loaded after tracker-views.js (uses howToHtml,
   exById, esc, db, ui) + tracker-seed.js (weekPlan, repsForEntryWeek, TOTAL_WEEKS). */

/* prescription string for one program entry in a given week */
function prescStr(en, ex, w){
  if(en.exerciseId === "copenhagen-plank") return en.sets + " × 20–30 s/side";
  if(en.exerciseId === "suitcase-carry")   return en.sets + " × 60 s/arm";
  var reps = repsForEntryWeek(en, w), side = /leg|arm/.test(ex.defaultUnit || "") ? "/side" : "";
  return en.sets + " × " + (reps == null ? "–" : reps) + side;
}

function renderPlan(){
  var cur = db.settings.blockPhaseWeek || 1, done = db.settings.weeksDone || [];
  if(!ui.planWeek) ui.planWeek = cur;
  var w = ui.planWeek, wp = weekPlan(w);
  var h = '<div class="viewH">12-week plan</div><div class="viewSub">HSR block · tap a week, mark each one done as you finish it</div>';

  // week picker (1–12 + DL deload)
  h += '<div class="weekPick">';
  for(var k = 1; k <= TOTAL_WEEKS; k++){
    var isDone = done.indexOf(k) >= 0;
    h += '<button class="wchip' + (k === w ? " sel" : "") + (k === cur ? " cur" : "") + (isDone ? " done" : "") +
         '" data-act="week" data-week="' + k + '">' + (k === 13 ? "DL" : k) + (isDone ? '<span class="wtick">✓</span>' : "") + '</button>';
  }
  h += '</div>';

  // phase banner (what changes this week)
  h += '<div class="phaseBanner' + (wp.deload ? " deload" : "") + '">' +
       '<div class="phaseName">Week ' + w + (w === cur ? " · current" : "") + ' — ' + esc(wp.phase) + '</div>' +
       '<div class="phaseReps">Heavy block ' + (wp.heavyReps == null ? "light" : wp.heavyReps + " reps") +
       ' · gap/prehab ' + wp.gapReps + ' · tempo 3·3 (calves 3·3·3)</div>' +
       '<div class="phaseIntent">' + esc(wp.intent) + '</div></div>';

  // per-day exercises with this week's prescription + How-to
  Object.keys(db.programs).forEach(function(pid){
    var p = db.programs[pid];
    h += '<div class="sectH">' + esc(p.name) + '</div>';
    p.entries.forEach(function(en){
      var ex = exById(en.exerciseId) || { name: en.exerciseId, defaultUnit: "kg" };
      h += '<div class="planCard"><div class="planTop"><div class="exName">' + esc(ex.name) + '</div>' +
           '<span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + en.block + '</span></div>' +
           '<div class="planPresc">' + prescStr(en, ex, w) + ' · rest ' + en.restSec + 's</div>' +
           howToHtml(en.exerciseId) + '</div>';
    });
  });

  var isDoneW = done.indexOf(w) >= 0;
  h += '<div class="btnRow" style="margin:14px 0 6px"><button class="btn primary block" data-act="weekdone" data-week="' + w + '">' +
       (isDoneW ? "✓ Week " + w + " done — tap to undo" : "✓ Mark Week " + w + " done") + '</button></div>';
  h += '<div class="note dim" style="margin:4px 2px">Reps follow the 12-week ladder; your tested weights fill in as you log sets. Full design + evidence: Documents/Claude/Projects/Training.</div>';
  $("#view-programs").innerHTML = h;
}
