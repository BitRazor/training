"use strict";
/* training-tracker — the 12-week Plan view. Two independent program tracks (Lower / Upper),
   each with its own week picker + manual mark-done. Heavy lifts show algorithm-calculated
   weights (tested 15RM → +1%/week → rep-max %); tap a weight to log what you actually lifted
   and the rest of the block recomputes. Uses seed math (calcWeight/repForWeek/...) + howToHtml/gifHtml. */

function shortName(prog){ return prog === "strength-a" ? "Lower" : "Upper"; }
function todayProgram(){ var t = CURRENT_WEEK[weekdayIdx()]; return (t && t.type === "strength") ? t.ref : null; }
function currentWeek(prog){
  var wd = (db.progress[prog] && db.progress[prog].weeksDone) || [];
  return wd.length ? Math.min(Math.max.apply(null, wd) + 1, TOTAL_WEEKS) : 1;
}
function prescFor(en, week){
  var ex = exById(en.exerciseId) || {}, tested = db.tested[en.exerciseId], side = /leg|arm/.test(ex.defaultUnit || "") ? "/side" : "";
  if(en.timed) return { text: (en.exerciseId === "copenhagen-plank" ? "3 × 20–30 s/side" : "3 × 60 s/arm"), tested: true, kind: "timed" };
  if(en.block === "heavy"){
    if(tested == null) return { text: "tap to enter your tested 15RM", tested: false, kind: "heavy" };
    return { text: "<b>" + calcWeight(tested, week) + " kg</b> · " + en.sets + " × " + repForWeek(week) + side, tested: true, kind: "heavy" };
  }
  if(tested == null) return { text: "tap to enter working weight · " + en.sets + " × " + en.reps + side, tested: false, kind: "gap" };
  return { text: "<b>" + tested + " kg</b> · " + en.sets + " × " + en.reps + side, tested: true, kind: "gap" };
}
function renderPlan(){
  if(!ui.planProg) ui.planProg = todayProgram() || "strength-a";
  var prog = ui.planProg, P = db.programs[prog], cur = currentWeek(prog), done = (db.progress[prog].weeksDone) || [];
  if(!ui.planWeek || ui.planLastProg !== prog){ ui.planWeek = cur; ui.planLastProg = prog; }
  var w = ui.planWeek;
  var h = '<div class="viewH">12-week plan</div>';
  h += '<div class="progTabs">' + STRENGTH_DAYS.map(function(id){ return '<button class="progTab' + (id === prog ? " sel" : "") + '" data-act="prog" data-prog="' + id + '">' + esc(db.programs[id].name) + '</button>'; }).join("") + '</div>';
  h += '<div class="weekPick">';
  for(var k = 1; k <= TOTAL_WEEKS; k++){ var dn = done.indexOf(k) >= 0; h += '<button class="wchip' + (k === w ? " sel" : "") + (k === cur ? " cur" : "") + (dn ? " done" : "") + '" data-act="week" data-week="' + k + '">' + k + (dn ? '<span class="wtick">✓</span>' : "") + '</button>'; }
  h += '</div>';
  h += '<div class="phaseBanner"><div class="phaseName">Week ' + w + (w === cur ? " · current" : "") + ' — ' + phaseForWeek(w) + '</div>' +
       '<div class="phaseReps">Target ' + repForWeek(w) + ' reps · 3·3 tempo (calves 3·3·3) · heavy weights are calculated from your tested 15RM</div></div>';
  var wu = WARMUP_BY_PROG[prog] || [];
  h += '<details class="warmSec"><summary>🔥 Warm-up · ~8–10 min before lifting</summary><div class="secBody">' +
       wu.map(function(m){ var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif"; return '<div class="wuCard"><div class="wuName">' + esc(m.name) + '</div><div class="wuDetail">' + esc(m.detail) + '</div><div class="exFig"><img src="gifs/' + g + '" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div></div>'; }).join("") +
       '</div></details>';
  P.entries.forEach(function(en){
    var ex = exById(en.exerciseId) || { name: en.exerciseId }, pr = prescFor(en, w), tappable = (pr.kind !== "timed");
    h += '<div class="planCard' + (pr.tested ? "" : " untested") + '"><div class="planTop"><div class="exName">' + esc(ex.name) + '</div><span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + en.block + '</span></div>' +
         '<div class="planPresc' + (tappable ? ' tap" data-act="setw" data-ex="' + en.exerciseId + '" data-kind="' + pr.kind + '"' : '"') + '>' + pr.text + (tappable ? ' <span class="editi">✎</span>' : '') + '</div>' +
         gifHtml(en.exerciseId) + howToHtml(en.exerciseId) +
         '<button class="noteBtn" data-act="note" data-ex="' + en.exerciseId + '">+ note</button></div>';
  });
  var isDone = done.indexOf(w) >= 0;
  h += '<div class="btnRow" style="margin:14px 0 6px"><button class="btn primary block" data-act="weekdone" data-prog="' + prog + '" data-week="' + w + '">' +
       (isDone ? "✓ Week " + w + " " + shortName(prog) + " done — tap to undo" : "✓ Mark Week " + w + " " + shortName(prog) + " done") + '</button></div>';
  h += '<div class="note dim" style="margin:4px 2px">Heavy lifts auto-calculate (tested 15RM → +1%/week → rep-max %). Tap a weight (✎) to log what you actually lifted — the rest of the block recomputes. "+ note" logs go to the Log tab.</div>';
  $("#view-programs").innerHTML = h;
}
