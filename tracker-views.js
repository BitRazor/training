"use strict";
/* training-tracker — view renderers: Today (tappable → Plan), Log (notes), Nutrition, Settings,
   plus the shared gif + How-to. The Plan view lives in tracker-plan.js. */

/* ---------- TODAY ---------- */
function renderToday(){
  var i = weekdayIdx(), today = CURRENT_WEEK[i];
  var h = '<div class="todayHero">';
  if(today.type === "strength"){
    var cw = currentWeek(today.ref);
    h += '<div class="todayDay">' + today.day + ' · ' + shortName(today.ref) + ' day · Week ' + cw + ' of ' + TOTAL_WEEKS + '</div>' +
         '<div class="todayTitle">' + esc(today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
         '<div class="btnRow"><button class="btn primary block" data-act="gotoplan" data-prog="' + today.ref + '">Open Week ' + cw + ' →</button></div>';
  } else {
    h += '<div class="todayDay">' + today.day + '</div><div class="todayTitle">' + esc(today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
         (today.type === "cardio" ? '<div class="todayNote dim">Zone 2 ' + zoneRange("z2") + ' — keep it conversational.</div>' : "") +
         (today.type === "hiit" ? '<div class="todayNote dim">4 × 4 min hard / 3 min easy. Watch the last interval\'s peak HR.</div>' : "");
  }
  h += '</div>';
  h += '<div class="card weekList">' + CURRENT_WEEK.map(function(d, j){
    var strength = d.type === "strength";
    return '<div class="wrow' + (j === i ? " today" : "") + '"' + (strength ? ' data-act="gotoplan" data-prog="' + d.ref + '" style="cursor:pointer"' : "") + '>' +
           '<span class="wd">' + d.day + '</span><span class="dot ' + d.type + '"></span><span class="wt">' + esc(d.label) + '</span>' + (strength ? '<span class="goarrow">›</span>' : "") + '</div>';
  }).join("") + '</div>';
  $("#headMeta").innerHTML = (db.profile.targetBodyweightKg ? db.profile.targetBodyweightKg + " kg" : '<span class="dim">set target BW</span>');
  $("#view-today").innerHTML = h;
}

/* ---------- shared: gif + How-to (used by the Plan) ---------- */
function gifHtml(exId){
  var g = EX_GIF[exId]; if(!g) return "";
  return '<div class="exFig"><img src="gifs/' + g + '.gif" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
}
function howToHtml(exId){
  var d = EX_DESC[exId]; if(!d) return "";
  return '<details class="how"><summary>How to do it</summary><div class="howBody">' +
    '<div class="howRow"><span class="howK">Setup</span><span>' + esc(d.setup) + '</span></div>' +
    '<div class="howRow"><span class="howK">Move</span><span>' + esc(d.move) + '</span></div>' +
    '<div class="howRow"><span class="howK">Cue</span><span>' + esc(d.cue) + '</span></div>' +
    '<div class="howRow"><span class="howK">Feel</span><span>' + esc(d.feel) + '</span></div>' +
    '</div></details>';
}

/* ---------- LOG = notes ---------- */
function renderLog(){
  /* keep each note's ORIGINAL index for stable deletion, then show newest-first */
  var notes = (db.notes || []).map(function(n, i){ return { n: n, i: i }; }).reverse();
  var h = '<div class="viewH">Notes</div><div class="viewSub">Per-exercise notes from the Plan — week & weight are stamped automatically as a record.</div>';
  if(!notes.length) h += '<div class="note dim" style="margin-top:12px">No notes yet. On the <b>Plan</b> tab, tap <b>+ note</b> under any exercise — pain, machine quirks, how it felt — and they collect here with the week and weight.</div>';
  else h += '<div class="card">' + notes.map(function(o){
    var n = o.n, ex = exById(n.exerciseId) || { name: n.exerciseId }, rec = [];
    if(n.week) rec.push("Week " + n.week);
    if(n.weight) rec.push(n.weight);
    return '<div class="noteRow"><div class="noteHd"><b>' + esc(ex.name) + '</b><span class="dim">' + esc(n.date) + '</span></div>' +
      (rec.length ? '<div class="noteRec">' + esc(rec.join(" · ")) + '</div>' : "") +
      '<div class="noteTx">' + esc(n.text) + '</div>' +
      '<button class="noteDel" data-act="delnote" data-idx="' + o.i + '">Delete</button></div>';
  }).join("") + '</div>';
  $("#view-log").innerHTML = h;
}

/* ---------- NUTRITION ---------- */
function renderNutrition(){
  var bw = db.profile.targetBodyweightKg, lo = bw ? Math.round(bw * NUTRITION.targetLow) : null, hi = bw ? Math.round(bw * NUTRITION.targetHigh) : null;
  var h = '<div class="viewH">Fuel</div><div class="viewSub">Protein on your TARGET lean bodyweight + GERD-safe timing</div><div class="card"><div class="sectH" style="margin-top:0">Daily protein target</div>';
  if(bw) h += '<div class="bigNum">' + lo + '–' + hi + ' g</div><div class="note">' + NUTRITION.targetLow + '–' + NUTRITION.targetHigh + ' g/kg of your ' + bw + ' kg lean target · ' + NUTRITION.mealsPerDay[0] + '–' + NUTRITION.mealsPerDay[1] + ' meals (≥' + Math.round(bw * NUTRITION.perMealMinGPerKg) + ' g each) · ceiling ~' + Math.round(bw * NUTRITION.ceiling) + ' g.</div>';
  else h += '<div class="warnBox">Set your <b>target lean bodyweight</b> (Settings) to compute the gram target — figuring protein on total mass over-counts.</div>';
  h += '</div><div class="sectH">Timing rules</div><div class="card kvs">' + NUTRITION.rules.map(function(r){ return '<div style="flex-direction:column;align-items:flex-start;gap:3px;border-bottom:1px solid var(--line)"><b style="font-size:12.5px">' + esc(r.when) + '</b><span class="muted" style="font-size:12.5px">' + esc(r.how) + '</span></div>'; }).join("") + '</div>';
  h += '<div class="sectH">GERD safety</div><div class="card"><ul style="margin:0;padding-left:18px;font-size:13px;color:#c6d2dd">' + NUTRITION.gerd.map(function(g){ return '<li style="margin-bottom:5px">' + esc(g) + '</li>'; }).join("") + '</ul></div>';
  h += '<div class="note" style="margin:8px 2px"><b>' + esc(NUTRITION.oneLine) + '</b></div>';
  $("#view-nutrition").innerHTML = h;
}

/* ---------- PROGRAMS (the library + switcher) ---------- */
function renderLibrary(){
  var h = '<div class="viewH">Programs</div><div class="viewSub">Your training programs. The active one drives Today and the Plan. Tap one to preview it or start training — your strength carries forward.</div>';
  h += '<div class="card">' + PROGRAM_ORDER.map(function(pid){
    var P = db.programLib[pid]; if(!P) return "";
    var ps = db.programState[pid] || {progress:{}};
    var active = pid === db.activeProgram;
    var totalWk = P.days.length * P.weeks;
    var doneWk = P.days.reduce(function(s,d){ return s + ((((ps.progress||{})[d]||{}).weeksDone||[]).length); }, 0);
    var pctDone = totalWk ? Math.round(doneWk/totalWk*100) : 0;
    var dirBadge = P.direction === "reverse" ? "Reverse · reps 6→15" : "Forward · reps 15→6";
    var curMode = ps.rateMode || "plateau";
    /* climb-rate picker on EVERY program — forward steps the weight up faster, reverse rides a higher/lower bank */
    var paceHtml = '<div class="paceRow"><div class="paceLbl">Climb rate</div><div class="paceChips">' +
        PROGRESSION_MODE_ORDER.map(function(m){ var M = PROGRESSION_MODES[m]; return '<button class="paceChip' + (m === curMode ? " sel" : "") + '" data-act="setpace" data-prog="' + esc(pid) + '" data-mode="' + m + '" title="' + esc(M.hint) + '">' + esc(M.label) + '</button>'; }).join("") +
        '</div><div class="paceHint dim">' + esc((PROGRESSION_MODES[curMode] || PROGRESSION_MODES.plateau).hint) + '</div></div>';
    return '<div class="progItem' + (active ? " active" : "") + '">' +
      '<div class="progNm">' + esc(P.name) + (active ? ' <span class="progActive">ACTIVE</span>' : '') + (ps.completedAt ? ' <span class="progDoneB">✓ done</span>' : '') + '</div>' +
      '<div class="progDesc">' + esc(P.desc) + '</div>' +
      '<div class="progMeta">' + P.weeks + ' weeks · ' + esc(dirBadge) + ' · ' + doneWk + '/' + totalWk + ' day-weeks done (' + pctDone + '%)</div>' +
      '<div class="progBarWrap"><div class="progBar" style="width:' + pctDone + '%"></div></div>' +
      paceHtml +
      (active ? '<div class="note dim" style="margin-top:8px">Active — open it on the <b>Plan</b> tab.</div>'
              : '<button class="btn block sm" data-act="switchprogram" data-prog="' + esc(pid) + '" style="margin-top:8px">Switch to ' + esc(P.name) + '</button>') +
      '</div>';
  }).join("") + '</div>';
  h += '<div class="note dim" style="margin:8px 2px">More programs as you build them. Your strength carries forward — starting a new program picks up from your last completed week (+ one step).</div>';
  $("#view-library").innerHTML = h;
}

/* ---------- SETTINGS ---------- */
function field(label, type, path, val, hint){
  return '<div class="field"><label>' + label + '</label><input type="' + type + '"' + (type === "number" ? ' inputmode="decimal" step="any"' : "") + ' data-path="' + path + '" value="' + esc(val == null ? "" : val) + '">' + (hint ? '<div class="note dim" style="margin-top:3px">' + hint + '</div>' : "") + '</div>';
}
function renderSettings(){
  var p = db.profile;
  var h = '<div class="viewH">Settings</div><div class="card"><div class="sectH" style="margin-top:0">Profile</div>' +
    field("Name", "text", "p.name", p.name) +
    field("Target bodyweight (kg)", "number", "p.targetBodyweightKg", p.targetBodyweightKg, "Your lean goal weight at ~10–15% body fat — protein is figured on this, not current total mass.") +
    field("Max HR (bpm)", "number", "p.maxHr", p.maxHr, "Editing this regenerates the HR zones below.") +
    '<div class="row">' + field("Protein low g/kg", "number", "p.proteinTargetGPerKg.low", p.proteinTargetGPerKg.low) + field("Protein high g/kg", "number", "p.proteinTargetGPerKg.high", p.proteinTargetGPerKg.high) + '</div></div>';
  h += '<div class="card"><div class="sectH" style="margin-top:0">HR zones (max ' + p.maxHr + ')</div><div class="kvs">' +
    ["z1","z2","z3","z4","z5"].map(function(z){ return '<div><span class="muted">' + z.toUpperCase() + '</span><b>' + p.hrZones[z][0] + '–' + p.hrZones[z][1] + '</b></div>'; }).join("") + '</div></div>';
  h += '<div class="card"><div class="sectH" style="margin-top:0">Data</div><div class="btnRow"><button class="btn" data-act="export">Export JSON</button><button class="btn" data-act="import">Import JSON</button></div>' +
    '<div class="note dim" style="margin-top:8px">Schema v' + db.schemaVersion + ' · last export ' + (db.settings.lastExportAt ? db.settings.lastExportAt.slice(0, 10) : "never") + '</div>' +
    '<button class="btn ghost block sm" data-act="reset" style="margin-top:10px;color:var(--bad)">Reset all data</button></div>';
  /* weight steps grouped by equipment category — only categories actually used (e.g. kettlebell stays hidden until a program adds one) */
  var catsUsed = {}; STRENGTH_DAYS.forEach(function(pp){ ((db.programs[pp]||{}).entries||[]).forEach(function(en){ var x=exById(en.exerciseId); if(x&&x.cat) catsUsed[x.cat]=true; }); });
  h += '<div class="card"><div class="sectH" style="margin-top:0">Weight steps</div>' +
    '<div class="note dim" style="margin-bottom:4px">Smallest jump per equipment type — set it to match your gym. On the Plan, tap a lift\'s <b>⚙</b> chip to override just that one.</div>' +
    EQUIP_CAT_ORDER.filter(function(c){ return catsUsed[c]; }).map(function(cat){
      var c=EQUIP_CATS[cat], o=db.gearByCat[cat]||c, lbl=(o.equip==="db")?"DB grid":((o.inc||c.inc)+" kg"), lifts=[];
      STRENGTH_DAYS.forEach(function(pp){ ((db.programs[pp]||{}).entries||[]).forEach(function(en){ var x=exById(en.exerciseId); if(x&&x.cat===cat) lifts.push(x.name); }); });
      return '<div class="catRow" data-act="setcatstep" data-cat="'+esc(cat)+'"><div class="catTop"><span class="catName">'+esc(c.label)+'</span><span class="catStep">'+esc(lbl)+' ✎</span></div><div class="catLifts">'+esc(lifts.join(" · "))+'</div></div>';
    }).join("") + '</div>';
  h += '<div class="note dim" style="margin:8px 2px">Tested weights live on the <b>Plan</b> (tap a lift to enter/adjust). Rest time + reps are per-exercise. Barbell = 20 kg standard.</div>';
  $("#view-settings").innerHTML = h;
}
function setPath(path, val){ var o = path.indexOf("p.") === 0 ? db.profile : db.settings, parts = path.slice(2).split("."); for(var i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = val; }
function regenZones(){ var m = db.profile.maxHr || 193; db.profile.hrZones = { z1:[Math.round(.5*m),Math.round(.6*m)], z2:[Math.round(.6*m),Math.round(.7*m)], z3:[Math.round(.7*m),Math.round(.8*m)], z4:[Math.round(.8*m),Math.round(.9*m)], z5:[Math.round(.9*m),m] }; }
