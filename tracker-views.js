"use strict";
/* training-tracker — view renderers: Today (tappable → Plan), Log (notes), Nutrition, Settings,
   plus the shared gif + How-to. The Plan view lives in tracker-plan.js. */

/* ---------- TODAY ---------- */
function renderToday(){
  var i = weekdayIdx(), today = CURRENT_WEEK[i];
  var h = '<div class="todayHero">';
  if(today.type === "strength" || today.type === "home"){
    var cw = currentWeek(today.ref);
    h += '<div class="todayDay">' + today.day + ' · ' + (today.type === "home" ? "Home" : shortName(today.ref)) + ' · Week ' + cw + ' of ' + TOTAL_WEEKS + '</div>' +
         '<div class="todayTitle">' + esc(today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
         '<div class="btnRow"><button class="btn primary block" data-act="gotoplan" data-prog="' + today.ref + '">Open Week ' + cw + ' →</button></div>';
  } else {
    h += '<div class="todayDay">' + today.day + '</div><div class="todayTitle">' + esc(today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
         (today.type === "cardio" ? '<div class="todayNote dim">Zone 2 ' + zoneRange("z2") + ' — keep it conversational.</div>' : "") +
         (today.type === "hiit" ? '<div class="todayNote dim">4 × 4 min hard / 3 min easy. Watch the last interval\'s peak HR.</div>' : "") +
         /* a home session riding on this day (Wednesday): its own button under the cardio */
         (today.home ? '<div class="btnRow"><button class="btn block" data-act="gotoplan" data-prog="' + today.home + '">🏠 Home core · Open Week ' + currentWeek(today.home) + ' →</button></div>' : "");
  }
  h += '</div>';
  h += '<div class="card weekList">' + CURRENT_WEEK.map(function(d, j){
    var target = (d.type === "strength" || d.type === "home") ? d.ref : (d.home || null);   /* the day-track a tap opens */
    return '<div class="wrow' + (j === i ? " today" : "") + '"' + (target ? ' data-act="gotoplan" data-prog="' + target + '" style="cursor:pointer"' : "") + '>' +
           '<span class="wd">' + d.day + '</span><span class="dot ' + d.type + '"></span><span class="wt">' + esc(d.label) + (d.home ? ' <span class="dim">+ home core</span>' : '') + '</span>' + (target ? '<span class="goarrow">›</span>' : "") + '</div>';
  }).join("") + '</div>';
  $("#view-today").innerHTML = h;
}

/* ---------- page headers: a large title that scrolls away; More's pages get a back control to More ---------- */
function mainHead(title, overline){ return (overline ? '<div class="overline">' + overline + '</div>' : '') + '<div class="viewH">' + esc(title) + '</div>'; }
function subHead(title, sub){
  return '<div class="pageTop"><button class="backBtn" data-view="more" aria-label="Back to More">' + icon("chevL") + '</button></div>' +
    '<div class="viewH">' + esc(title) + '</div>' + (sub ? '<div class="viewSub">' + sub + '</div>' : '');
}

/* ---------- MORE: the tiles to the pages that left the bottom bar ---------- */
function renderMore(){
  var P = getProgram(db.activeProgram), n = (db.notes || []).length, bw = db.profile.targetBodyweightKg;
  var ver = (window.__boot && window.__boot.version) || "";
  var moves = (typeof libraryGroups === "function") ? libraryGroups().reduce(function(s, g){ return s + g.items.length; }, 0) : 0;
  var tiles = [
    { view:"library",   ic:"layers",   t:"Programs",        s: esc(P.name) + " is active" },
    { view:"exercises", ic:"dumbbell", t:"Exercises",       s: moves + " moves, with how-tos" },
    { view:"log",       ic:"note",     t:"Notes",           s: n ? n + (n === 1 ? " note" : " notes") : "No notes yet" },
    { view:"nutrition", ic:"fork",     t:"Fuel",            s: bw ? Math.round(bw * NUTRITION.targetLow) + "–" + Math.round(bw * NUTRITION.targetHigh) + " g protein a day" : "Set your target weight" },
    { view:"settings",  ic:"sliders",  t:"Settings",        s: "Profile, heart-rate zones, data" },
    { act:"appinfo",    ic:"phone",    t:"App and updates", s: ver ? "Version " + esc(ver) : "Version and updates" }
  ];
  $("#view-more").innerHTML = mainHead("More") + '<div class="moreGrid">' + tiles.map(function(x){
    return '<button class="moreTile" ' + (x.view ? 'data-view="' + x.view + '"' : 'data-act="' + x.act + '"') + '>' +
      '<span class="tileI">' + icon(x.ic) + '</span><span class="tileT">' + x.t + '</span><span class="tileS">' + x.s + '</span></button>';
  }).join("") + '</div>';
}

/* ---------- App and updates (a sheet; reads window.__boot from boot.js) ---------- */
/* the newest update-check line of boot.js's log, without its time stamp: {msg, when} */
function lastUpdateCheck(log){
  for(var i = (log || []).length - 1; i >= 0; i--){
    var m = /^(\S+)\s+(.*)$/.exec(String(log[i]));
    if(m && /^(up to date|update \S+ downloaded|update check failed|not taking|\S+ needs app build|APK build)/.test(m[2])){
      var d = new Date(m[1]), when = isNaN(d) ? "" : (d.toDateString() === new Date().toDateString() ? "today " : d.getDate() + " " + MONTHS[d.getMonth()] + " ") + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      return { msg: m[2], when: when };
    }
  }
  return null;
}
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function pad2(n){ n = String(n); return n.length < 2 ? "0" + n : n; }
function appLastHtml(){
  var b = window.__boot || {}, log = []; try { log = typeof b.log === "function" ? b.log() : []; } catch(e){}
  var last = lastUpdateCheck(log);
  return last ? '<div class="sectH" style="margin:18px 0 6px">Last check' + (last.when ? ' · ' + esc(last.when) : '') + '</div><div class="appLast note">' + esc(last.msg) + '</div>' : '';
}
function openAppSheet(){
  var b = window.__boot || {}, nat = !!b.native;
  var src = !nat ? "Web version" : (b.source === "downloaded" ? "Downloaded update" : "Built into the app");
  var h = '<div class="kv"><span>Version</span><b class="appVer">' + esc(b.version || "—") + '</b></div>' +
          '<div class="kv"><span>Running</span><b class="appSrc">' + src + '</b></div>' +
          '<div id="appLastBox">' + appLastHtml() + '</div>' +
          '<div class="appLine">Updates come with each start of the app' + (nat ? ', checked against GitHub.' : '.') + '</div>' +
          (typeof b.checkNow === "function" ? '<div class="btnRow"><button class="btn tonal" data-act="checknow">' + icon("refresh") + 'Check now</button></div>' : '') +
          '<div id="apkLink"></div>';
  openSheet("App and updates", h);
  if(!b.version && typeof fetch === "function"){   /* a browser: read the version next to index.html */
    fetch("version.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(v){ var el = $("#modal .appVer"); if(el && v && v.version) el.textContent = v.version; }).catch(function(){});
  }
  if(nat) offerApkLink();
}
/* the link to a newer APK when the update source's version.json names one (the same rule as boot.js's banner) */
function offerApkLink(){
  var cap = window.Capacitor, base = "https://raw.githubusercontent.com/BitRazor/training/v2/";
  try { var o = localStorage.getItem("tt-update-base"); if(o && /^https?:\/\//.test(o)) base = o.charAt(o.length - 1) === "/" ? o : o + "/"; } catch(e){}
  if(typeof fetch !== "function" || !cap || !cap.Plugins || !cap.Plugins.App) return;
  Promise.all([fetch(base + "version.json?t=" + Date.now(), { cache: "no-store" }).then(function(r){ return r.json(); }), cap.Plugins.App.getInfo()]).then(function(r){
    var a = r[0] && r[0].apk, mine = parseInt(r[1] && r[1].build, 10) || 0, box = $("#apkLink");
    if(box && a && /^https:\/\//.test(a.url || "") && (parseInt(a.build, 10) || 0) > mine)
      box.innerHTML = '<a class="btn primary block" style="margin-top:12px" href="' + esc(a.url) + '">' + icon("download") + 'Get the new app (' + esc(a.version || a.build) + ')</a>';
  }).catch(function(){});
}
function onCheckNow(t){
  var b = window.__boot; if(!b || typeof b.checkNow !== "function") return;
  t.disabled = true; t.innerHTML = icon("refresh") + "Checking…";
  var done = function(label){ t.disabled = false; t.innerHTML = icon("refresh") + label; var box = $("#appLastBox"); if(box) box.innerHTML = appLastHtml(); };
  var p; try { p = b.checkNow(); } catch(e){ p = Promise.reject(e); }
  Promise.resolve(p).then(function(){ done("Check again"); }, function(){ done("Could not check · try again"); });
}

/* ---------- shared: gif + How-to (used by the Plan) ---------- */
function gifHtml(exId){
  var pend = (typeof EX_GIF_PENDING !== "undefined") ? EX_GIF_PENDING[exId] : null;
  if(pend) return '<div class="exFig pending"><span class="pendTx">📷 Picture to come</span><span class="pendFile">gifs/' + esc(pend) + '.gif</span></div>';
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
  var h = subHead("Notes", "Per-exercise notes from the Workout — week & weight are stamped automatically as a record.");
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
  var h = subHead("Fuel", "Protein on your TARGET lean bodyweight + GERD-safe timing") + '<div class="card"><div class="sectH" style="margin-top:0">Daily protein target</div>';
  if(bw) h += '<div class="bigNum">' + lo + '–' + hi + ' g</div><div class="note">' + NUTRITION.targetLow + '–' + NUTRITION.targetHigh + ' g/kg of your ' + bw + ' kg lean target · ' + NUTRITION.mealsPerDay[0] + '–' + NUTRITION.mealsPerDay[1] + ' meals (≥' + Math.round(bw * NUTRITION.perMealMinGPerKg) + ' g each) · ceiling ~' + Math.round(bw * NUTRITION.ceiling) + ' g.</div>';
  else h += '<div class="warnBox">Set your <b>target lean bodyweight</b> (Settings) to compute the gram target — figuring protein on total mass over-counts.</div>';
  h += '</div><div class="sectH">Timing rules</div><div class="card kvs">' + NUTRITION.rules.map(function(r){ return '<div style="flex-direction:column;align-items:flex-start;gap:3px;border-bottom:1px solid var(--line)"><b style="font-size:12.5px">' + esc(r.when) + '</b><span class="muted" style="font-size:12.5px">' + esc(r.how) + '</span></div>'; }).join("") + '</div>';
  h += '<div class="sectH">GERD safety</div><div class="card"><ul style="margin:0;padding-left:18px;font-size:13px;color:#c6d2dd">' + NUTRITION.gerd.map(function(g){ return '<li style="margin-bottom:5px">' + esc(g) + '</li>'; }).join("") + '</ul></div>';
  h += '<div class="note" style="margin:8px 2px"><b>' + esc(NUTRITION.oneLine) + '</b></div>';
  $("#view-nutrition").innerHTML = h;
}

/* ---------- PROGRAMS (the library + switcher) ---------- */
function renderLibrary(){
  var h = subHead("Programs", "Your training programs. The active one drives Today and the Workout. Tap one to preview it or start training — your strength carries forward.");
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
  var h = subHead("Settings") + '<div class="card"><div class="sectH" style="margin-top:0">Profile</div>' +
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
