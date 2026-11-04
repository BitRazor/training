"use strict";
/* training-tracker — view renderers (version 2 look, 2026-11-04): Today (hero, week strip, program card, last session),
   More and its App-and-updates sheet, Notes ("log"), Fuel ("nutrition"), Programs ("library"), Settings, plus the page
   headers and the v1 gif + How-to helpers. The Workout ("programs") lives in tracker-plan.js; Progress and the
   Exercises library in tracker-progress.js; the week schedule editor and the workout names in tracker-week.js.
   Part 1 (2026-11-04): Today reads his week (weekPlan) and his workout names; App and updates says the result of the
   last check in one plain sentence, never boot.js's raw log. */

/* ---------- TODAY (expressive: the hero, the week, the program, the last session) ---------- */
var WEEKDAY_LONG = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
var MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var DAY_ICON = { strength: "dumbbell", cardio: "heart", hiit: "bolt", rest: "moon", home: "house" };
/* a lift's target for the hero preview: "10 kg × 10/side", a home dose's set count, or the 15RM prompt */
function previewTarget(en, w, prog){ var t = setTargetText(en, w, prog); if(t) return t; if(en.dose) return en.sets + (en.sets === 1 ? " set" : " sets"); return (typeof smartActive === "function" && smartActive()) ? "set a starting weight" : "enter your 15RM"; }
function renderToday(){
  var plan = weekPlan(), i = weekdayIdx(), today = plan[i], now = new Date();
  var h = mainHead("Today", WEEKDAY_LONG[i] + " · " + now.getDate() + " " + MONTHS_LONG[now.getMonth()]);
  if(today.type === "strength" || today.type === "home"){
    /* his own name for the workout is the title (and then not repeated in the line above) */
    var ref = today.ref, cw = currentWeek(ref), E = (db.programs[ref] || { entries: [] }).entries, cn = customName(ref);
    h += '<div class="todayHero gym' + (today.type === "home" ? " home" : "") + '">' +
      '<div class="todayDay">' + today.day + ' · ' + (today.type === "home" ? "Home · " : (cn ? "" : esc(shortName(ref)) + " · ")) + 'Week ' + cw + ' of ' + TOTAL_WEEKS + '</div>' +
      '<div class="todayTitle">' + esc(cn || today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
      '<div class="heroPreview">' + E.slice(0, 4).map(function(en){
        /* Part 2: a waiting suggestion shows here too, with its arrow (tracker-smart.js) */
        var sg = (typeof heroSug === "function" && smartActive()) ? heroSug(ref, cw, en) : null;
        return '<div class="hpRow"><span class="hpName">' + esc((exById(en.exerciseId) || { name: en.exerciseId }).name) + '</span><span class="hpTgt' + (sg ? " sug" : "") + '">' + esc(sg || previewTarget(en, cw, ref)) + '</span></div>';
      }).join("") + (E.length > 4 ? '<div class="hpMore">+ ' + (E.length - 4) + ' more</div>' : '') + '</div>' +
      '<button class="btn primary big block" data-act="gotoplan" data-prog="' + ref + '">' + icon("play") + 'Start workout</button></div>';
  } else {
    var rule = today.type === "cardio" ? { ic: "heart", big: zoneRange("z2"), sub: "keep it conversational" }
             : today.type === "hiit" ? { ic: "bolt", big: "4 × 4 min", sub: "hard, with 3 min easy between · watch the last interval's peak HR" } : null;
    h += '<div class="todayHero ' + today.type + '"><div class="todayDay">' + today.day + '</div><div class="todayTitle">' + esc(today.label) + '</div><div class="todayNote">' + esc(today.note) + '</div>' +
      (rule ? '<div class="zoneBox"><span class="zIc">' + icon(rule.ic) + '</span><span class="zTx"><span class="zoneBig">' + esc(rule.big) + '</span><span class="zoneSub">' + esc(rule.sub) + '</span></span></div>'
            : '<div class="zoneBox rest"><span class="zIc">' + icon("moon") + '</span><span class="zTx"><span class="zoneSub">No training today. Sleep, food and an easy walk count.</span></span></div>') + '</div>';
    /* a home session riding on this day (Wednesday in the original week): its own card with its own Start */
    if(today.home){
      var hw = today.home, cwh = currentWeek(hw), nh = ((db.programs[hw] || {}).entries || []).length, hcn = customName(hw), ht = hcn || ADDON_TITLE[hw] || dayName(hw);
      h += '<div class="todayHero homeHero"><div class="hhTop"><span class="hhIc">' + icon("house") + '</span><span><span class="hhTitle">' + esc(ht) + '</span>' +
        '<span class="hhSub">' + (hcn ? '' : esc(dayName(hw)) + ' · ') + 'Week ' + cwh + ' of ' + TOTAL_WEEKS + ' · ' + nh + ' exercises</span></span></div>' +
        '<button class="btn big block homeBtn" data-act="gotoplan" data-prog="' + hw + '">' + icon("play") + 'Start ' + esc(hcn || ht.toLowerCase()) + '</button></div>';
    }
  }
  /* the week strip: Mon-Sun from his week, an icon and a short name per day, today highlighted, training and home days
     tappable; "Edit week" opens the schedule editor (tracker-week.js) */
  h += '<div class="sectRow"><div class="sectH">This week</div><button class="editWeek" data-view="schedule">' + icon("edit", "sm") + 'Edit week</button></div><div class="weekStrip">' + plan.map(function(d, j){
    var work = d.type === "strength" || d.type === "home", target = work ? d.ref : (d.home || null), tag = target ? "button" : "div";
    var sr = (work ? (customName(d.ref) || d.label) : d.label) + (d.home ? ' + ' + addonWord(d.home) : '');
    return '<' + tag + ' class="wrow' + (j === i ? " today" : "") + '"' + (target ? ' data-act="gotoplan" data-prog="' + target + '"' : '') + '>' +
      '<span class="wd">' + d.day + '</span><span class="dot ' + d.type + '">' + icon(DAY_ICON[d.type] || "calendar") + '</span>' +
      (d.home ? '<span class="dot2">' + icon("house") + '</span>' : '') + '<span class="wn" aria-hidden="true">' + esc(stripWord(d)) + '</span><span class="sr">' + esc(sr) + '</span></' + tag + '>';
  }).join("") + '</div>';
  /* the program card: weeks done of 12 per day-track; opens Programs */
  var AP = getProgram(db.activeProgram), tracks = AP.days.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []);
  h += '<button class="card progCard" data-view="library"><span class="pcTop"><span class="pcIc">' + icon("layers") + '</span><span class="pcHead"><span class="pcName">' + esc(AP.name) + '</span>' +
    '<span class="pcSub">Active program · ' + AP.weeks + ' weeks</span></span>' + icon("chevR", "chev") + '</span>' +
    tracks.map(function(d){ var n = progWeeksDone(d).length; return '<span class="pcTrack"><span class="pcT">' + esc(dayTitle(d)) + '</span><span class="bar"><i style="width:' + Math.round(n / AP.weeks * 100) + '%"></i></span><span class="pcV">' + n + '/' + AP.weeks + '</span></span>'; }).join("") + '</button>';
  /* the last session, from the diary */
  var ls = lastSession();
  if(ls) h += '<div class="card lastSess"><div class="sectH">Last session</div><div class="lsDate">' + esc(ls.label) + '</div>' + ls.rows.map(function(r){
    return '<div class="lsRow' + (r.pb ? " pb" : "") + '">' + (r.pb ? icon("trophy", "sm") : '<span class="lsDot"></span>') + '<span class="lsName">' + esc(r.name) + '</span><span class="lsKg">' + r.kg + ' kg × ' + r.reps + (r.partial ? ' <span class="ltPartial">partial</span>' : '') + '</span></div>';
  }).join("") + '</div>';
  $("#view-today").innerHTML = h;
}
/* the newest diary day: "Tue 27 Oct · Day A" and its lifts, a trophy where the lift beat every earlier entry */
function lastSession(){
  var H = db.history || []; if(!H.length) return null;
  var ts = H.reduce(function(m, h){ return h.ts > m ? h.ts : m; }, ""), rows = H.filter(function(h){ return h.ts === ts; });
  var d = new Date(ts + "T00:00:00"), wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  return { label: wd + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " · " + dayTitle(rows[0].day), rows: rows.map(function(h){
    var earlier = H.filter(function(x){ return x.exId === h.exId && x.ts < ts; }), best = earlier.length ? Math.max.apply(null, earlier.map(function(x){ return x.kg; })) : null;
    return { name: (exById(h.exId) || { name: h.exId }).name, kg: h.kg, reps: h.reps, partial: h.quality === "partial", pb: best != null && h.kg > best };
  }) };
}
/* a missing target body weight: a prompt card (Fuel, Settings) that opens the number pad */
function bwPrompt(msg){
  return '<div class="card promptCard"><div class="pcMsg">' + icon("user", "lg") + '<span>' + msg + '</span></div>' +
    '<button class="btn primary block" data-act="setbw">' + icon("edit") + 'Set target weight</button></div>';
}
function onSetBw(){
  var cur = db.profile.targetBodyweightKg;
  openModal({ title: "Target bodyweight", message: "Your lean goal weight at about 10–15% body fat (kg). Protein is figured on this, not on today's total.", mode: "number",
    value: cur != null ? String(cur) : "", placeholder: "kg", stepEx: { id: "_bodyweight", inc: 0.5 },
    onSubmit: function(v){ var n = num(v); if(n == null || n <= 0){ toast("Enter a weight above 0"); return; } db.profile.targetBodyweightKg = Math.round(n * 10) / 10; save(); showView(ui.view); } });
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
  var tiles = [
    { view:"library",   ic:"layers",   t:"Programs",        s: esc(P.name) + " is active" },
    { view:"schedule",  ic:"calendar", t:"Week schedule",   s: "Move workouts between days" },
    { view:"exercises", ic:"dumbbell", t:"Exercises",       s: catalogList().length + " exercises, with how-tos" },
    { view:"log",       ic:"note",     t:"Notes",           s: n ? n + (n === 1 ? " note" : " notes") : "No notes yet" },
    { view:"nutrition", ic:"fork",     t:"Fuel",            s: bw ? Math.round(bw * NUTRITION.targetLow) + "–" + Math.round(bw * NUTRITION.targetHigh) + " g protein a day" : "Set your target weight" },
    { view:"settings",  ic:"sliders",  t:"Settings",        s: "Profile, heart-rate zones, data" },
    { act:"appinfo",    ic:"phone",    t:"App and updates", s: ver ? "Version " + esc(ver) : "Version and updates" }
  ];
  $("#view-more").innerHTML = mainHead("More") + '<div class="moreGrid">' + tiles.map(function(x, k){
    /* an odd last tile spans the row */
    return '<button class="moreTile' + (k === tiles.length - 1 && tiles.length % 2 ? " wide" : "") + '" ' + (x.view ? 'data-view="' + x.view + '"' : 'data-act="' + x.act + '"') + '>' +
      '<span class="tileI">' + icon(x.ic) + '</span><span class="tileT">' + x.t + '</span><span class="tileS">' + x.s + '</span></button>';
  }).join("") + '</div>';
}

/* ---------- App and updates (a sheet; reads window.__boot from boot.js, which never changes over the air) ----------
   The result of the newest check in one plain sentence (2026-11-04, Part 1: "app update button doesn't work"), from
   boot.js's state (info.state(): next = a downloaded update waiting for a restart) and its log lines (info.log(),
   "<ISO time> <message>"); never the raw log. A waiting update always reads "restart to use it", with a Restart button:
   before, a second check said "up to date" about it and nothing seemed to happen. */
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function pad2(n){ n = String(n); return n.length < 2 ? "0" + n : n; }
var UPD_TEXT = { ready: "Update downloaded, restart to use it", offline: "Couldn't reach GitHub, check the internet and try again",
  app: "This update needs a newer app", skipped: "The newest update didn't work on this phone before, so it is skipped",
  broken: "The update didn't download completely, try again in a few minutes" };
var UPD_ICON = { ok: "check", ready: "download", offline: "wifiOff", app: "phone", skipped: "info", broken: "refresh", busy: "refresh" };
function cmpVersion(a, b){ var x = String(a || "0").split("."), y = String(b || "0").split("."); for(var i = 0; i < Math.max(x.length, y.length); i++){ var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0); if(d) return d < 0 ? -1 : 1; } return 0; }
/* a failed check's reason: a broken download (checksum, manifest) or no connection */
function failKind(msg){ return /checksum|not valid|incomplete|missing/i.test(String(msg || "")) ? "broken" : "offline"; }
/* the newest check result in boot.js's log: {kind, ver, at}; start-up lines (applying, confirmed, APK build) are not results */
function lastUpdateCheck(log){
  for(var i = (log || []).length - 1; i >= 0; i--){
    var m = /^(\S+)\s+(.*)$/.exec(String(log[i])), r = null; if(!m) continue;
    var msg = m[2], t = Date.parse(m[1]), x;
    if((x = /^up to date: have (\S+?),/.exec(msg))) r = { kind: "ok", ver: x[1] };
    else if((x = /^update (\S+) downloaded/.exec(msg))) r = { kind: "downloaded", ver: x[1] };
    else if((x = /^update check failed: (.*)$/.exec(msg))) r = { kind: failKind(x[1]) };
    else if(/^not taking /.test(msg)) r = { kind: "skipped" };
    else if(/^\S+ needs app build /.test(msg)) r = { kind: "app" };
    if(r){ r.at = isNaN(t) ? null : t; return r; }
  }
  return null;
}
/* this app run's own failed Check now (it writes no log line), kept for its updater (window.__boot) */
var updFail = null;
/* the newest result as {kind, text, at}, or null (never checked) */
function updateStatus(){
  var b = window.__boot || {}, st = {}, log = [];
  try { st = (typeof b.state === "function" && b.state()) || {}; } catch(e){}
  try { log = typeof b.log === "function" ? b.log() : []; } catch(e){}
  var r = lastUpdateCheck(log), run = b.version || null, mine = (updFail && updFail.boot === b) ? updFail : null;
  if(mine && (!r || r.at == null || mine.at >= r.at)) r = { kind: mine.kind, at: mine.at };
  if(st.next && cmpVersion(st.next, run) > 0) return { kind: "ready", text: UPD_TEXT.ready, at: r ? r.at : null };
  if(!r) return null;
  if(r.kind === "ok" || r.kind === "downloaded") return { kind: "ok", text: "You have the newest version (" + (run || r.ver) + ")", at: r.at };
  return { kind: r.kind, text: UPD_TEXT[r.kind], at: r.at };
}
/* "Today at 10:00" / "Yesterday at 12:00" / "30 Oct at 09:05" / "Not yet" */
function whenWords(ms){
  if(ms == null) return "Not yet";
  var d = new Date(ms), n = new Date(), y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1), hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  var same = function(a, c){ return a.getFullYear() === c.getFullYear() && a.getMonth() === c.getMonth() && a.getDate() === c.getDate(); };
  return same(d, n) ? "Today at " + hm : same(d, y) ? "Yesterday at " + hm : d.getDate() + " " + MONTHS[d.getMonth()] + " at " + hm;
}
/* "Last checked" and the sentence; in a browser (no updater) nothing */
function appLastHtml(busy){
  var b = window.__boot || {};
  if(!b.native && typeof b.checkNow !== "function" && typeof b.log !== "function") return "";
  if(busy) return '<div class="kv"><span>Last checked</span><b class="appWhen">Checking now…</b></div><div class="appStatus busy"><span class="asIc">' + icon(UPD_ICON.busy) + '</span><span class="appLast">Checking GitHub…</span></div>';
  var st = updateStatus();
  return '<div class="kv"><span>Last checked</span><b class="appWhen">' + esc(whenWords(st ? st.at : null)) + '</b></div>' +
    (st ? '<div class="appStatus ' + st.kind + '"><span class="asIc">' + icon(UPD_ICON[st.kind] || "info") + '</span><span class="appLast">' + esc(st.text) + '</span></div>' +
      (st.kind === "ready" ? '<button class="btn primary big block appRestart" data-act="apprestart">' + icon("refresh") + 'Restart now</button>' : '') : '');
}
/* the waiting update starts on a reload (boot.js applies it at launch) */
function appRestart(){ try { location.reload(); } catch(e){} }
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
  var box = $("#appLastBox"); if(box) box.innerHTML = appLastHtml(true);
  var done = function(err){
    updFail = err ? { boot: b, kind: failKind(err && (err.message || err)), at: Date.now() } : null;
    t.disabled = false; t.innerHTML = icon("refresh") + "Check again";
    var bx = $("#appLastBox"); if(bx) bx.innerHTML = appLastHtml();
  };
  var p; try { p = b.checkNow(); } catch(e){ p = Promise.reject(e); }
  Promise.resolve(p).then(function(){ done(null); }, function(e){ done(e || new Error("failed")); });
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

/* ---------- NOTES (view id "log"): a filter by lift, newest first; delete asks first and can be undone ---------- */
function renderLog(){
  /* keep each note's ORIGINAL index for stable deletion, then show newest-first */
  var notes = (db.notes || []).map(function(n, i){ return { n: n, i: i }; }).reverse();
  var counts = {}, order = [];
  notes.forEach(function(o){ var id = o.n.exerciseId; if(!(id in counts)){ counts[id] = 0; order.push(id); } counts[id]++; });
  var f = (ui.noteFilter && counts[ui.noteFilter]) ? ui.noteFilter : "";
  var h = subHead("Notes", "Per-exercise notes from the Workout — week & weight are stamped automatically as a record.");
  if(!notes.length) h += '<div class="card emptyCard">' + icon("note", "xl") + '<div class="emptyT">No notes yet</div><div class="note">On the Workout, tap <b>Note</b> on any lift: pain, machine settings, how it felt. They collect here with the week and the weight.</div></div>';
  else {
    h += '<div class="chips scroll noteFilter"><button class="chip' + (!f ? " sel" : "") + '" data-act="notefilter" data-ex="">All · ' + notes.length + '</button>' +
      order.map(function(id){ return '<button class="chip' + (f === id ? " sel" : "") + '" data-act="notefilter" data-ex="' + esc(id) + '">' + esc((exById(id) || { name: id }).name) + ' · ' + counts[id] + '</button>'; }).join("") + '</div>';
    h += '<div class="card noteList">' + notes.filter(function(o){ return !f || o.n.exerciseId === f; }).map(function(o){
      var n = o.n, ex = exById(n.exerciseId) || { name: n.exerciseId }, rec = [];
      if(n.week) rec.push("Week " + n.week);
      if(n.weight) rec.push(n.weight);
      return '<div class="noteRow"><div class="noteHd"><b>' + esc(ex.name) + '</b><span class="dim">' + esc(shortDate(n.date)) + '</span></div>' +
        (rec.length ? '<div class="noteRec">' + esc(rec.join(" · ")) + '</div>' : "") +
        '<div class="noteTx">' + esc(n.text) + '</div>' +
        '<button class="noteDel" data-act="delnote" data-idx="' + o.i + '" aria-label="Delete this note">' + icon("trash", "sm") + 'Delete</button></div>';
    }).join("") + '</div>';
  }
  $("#view-log").innerHTML = h;
}

/* ---------- FUEL (view id "nutrition") ---------- */
function renderNutrition(){
  var bw = db.profile.targetBodyweightKg, lo = bw ? Math.round(bw * NUTRITION.targetLow) : null, hi = bw ? Math.round(bw * NUTRITION.targetHigh) : null;
  var h = subHead("Fuel", "Protein on your TARGET lean bodyweight, and reflux-safe (GERD) timing.");
  if(bw) h += '<div class="card fuelHero"><div class="sectH">Daily protein</div><div class="bigNum">' + lo + '–' + hi + ' g</div>' +
    '<div class="note">' + NUTRITION.targetLow + '–' + NUTRITION.targetHigh + ' g/kg of your ' + bw + ' kg lean target · ' + NUTRITION.mealsPerDay[0] + '–' + NUTRITION.mealsPerDay[1] + ' meals (≥' + Math.round(bw * NUTRITION.perMealMinGPerKg) + ' g each) · ceiling ~' + Math.round(bw * NUTRITION.ceiling) + ' g.</div></div>';
  else h += bwPrompt("Set your <b>target lean bodyweight</b> to work out your protein: figuring it on total mass over-counts.");
  h += '<div class="sectH">Timing rules</div><div class="list">' + NUTRITION.rules.map(function(r){
    return '<div class="li ruleRow"><span class="liI">' + icon("timer") + '</span><span class="liB"><span class="liT">' + esc(r.when) + '</span><span class="liS">' + esc(r.how) + '</span></span></div>'; }).join("") + '</div>';
  h += '<div class="sectH">Reflux (GERD) safety</div><div class="list">' + NUTRITION.gerd.map(function(g){
    return '<div class="li gerdRow"><span class="liI">' + icon("check") + '</span><span class="liB">' + esc(g) + '</span></div>'; }).join("") + '</div>';
  h += '<div class="card fuelLine">' + icon("fork") + '<span>' + esc(NUTRITION.oneLine) + '</span></div>';
  $("#view-nutrition").innerHTML = h;
}

/* ---------- PROGRAMS (view id "library": the program library + switcher) ---------- */
/* a progress ring, 0-100 % */
function ringHtml(pct){
  var C = 2 * Math.PI * 20, v = Math.max(0, Math.min(100, pct)) / 100 * C;
  return '<div class="ring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="rTrack" cx="24" cy="24" r="20"></circle>' +
    (v > 0 ? '<circle class="rVal" cx="24" cy="24" r="20" stroke-dasharray="' + v.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 24 24)"></circle>' : '') + '</svg><span class="ringPct">' + pct + '%</span></div>';
}
/* Part 2 (2026-11-04): the built-ins, then his own programs (tracker-editor.js), each with Edit and Duplicate, his own with
   Delete; "New program" at the top */
function renderLibrary(){
  var h = subHead("Programs", "Your training programs. The active one drives Today and the Workout. Tap one to preview it or start training — your strength carries forward.");
  h += '<button class="btn primary block progNew" data-act="prognew">' + icon("plus") + 'New program</button>';
  var own = Object.keys(db.userPrograms || {}).filter(function(id){ return db.userPrograms[id].own && db.programLib[id]; });
  h += PROGRAM_ORDER.concat(own).map(function(pid){
    var P = db.programLib[pid]; if(!P) return "";
    var ps = db.programState[pid] || { progress: {} };
    var active = pid === db.activeProgram;
    var totalWk = P.days.length * P.weeks;
    var doneWk = P.days.reduce(function(s, d){ return s + ((((ps.progress || {})[d] || {}).weeksDone || []).length); }, 0);
    var pctDone = totalWk ? Math.round(doneWk / totalWk * 100) : 0;
    var dirBadge = P.smart ? "Smart · next step suggested each session" : P.direction === "reverse" ? "Reverse · reps 6→15" : "Forward · reps 15→6";
    var curMode = ps.rateMode || "plateau";
    /* climb-rate picker on every 12-week program — forward steps the weight up faster, reverse rides a higher/lower bank.
       A smart program (Part 2) has no climb rate: its steps come from what you did */
    var paceHtml = P.smart ? '' : '<div class="paceRow"><div class="paceLbl">Climb rate</div><div class="paceChips seg">' +
        PROGRESSION_MODE_ORDER.map(function(m){ var M = PROGRESSION_MODES[m]; return '<button class="paceChip' + (m === curMode ? " sel" : "") + '" data-act="setpace" data-prog="' + esc(pid) + '" data-mode="' + m + '" title="' + esc(M.hint) + '">' + esc(M.label) + '</button>'; }).join("") +
        '</div><div class="paceHint">' + esc((PROGRESSION_MODES[curMode] || PROGRESSION_MODES.plateau).hint) + '</div></div>';
    return '<div class="card progItem' + (active ? " active" : "") + '"><div class="piTop">' + ringHtml(pctDone) + '<div class="piHead"><div class="progNm">' + esc(P.name) + '</div>' +
      '<div class="piBadges">' + (active ? '<span class="pill acc progActive">ACTIVE</span>' : '') + (ps.completedAt ? '<span class="pill progDoneB">' + icon("check", "sm") + 'done</span>' : '') + '</div></div></div>' +
      '<div class="progDesc">' + esc(P.own ? P.days.length + (P.days.length === 1 ? " day: " : " days: ") + P.days.map(function(d){ return dayName(d); }).join(", ") : P.desc + (P.edited ? " Edited by you." : "")) + '</div>' +
      '<div class="progMeta">' + P.weeks + ' weeks · ' + esc(dirBadge) + ' · ' + doneWk + '/' + totalWk + ' day-weeks done</div>' +
      paceHtml +
      (active ? '<button class="btn tonal block" data-view="programs">' + icon("dumbbell") + 'Open the Workout</button>'
              : '<button class="btn block" data-act="switchprogram" data-prog="' + esc(pid) + '">' + icon("swap") + 'Switch to ' + esc(P.name) + '</button>') +
      '<div class="progBtns"><button class="btn sm" data-act="progedit" data-prog="' + esc(pid) + '">' + icon("edit") + 'Edit</button>' +
      '<button class="btn sm" data-act="progdup" data-prog="' + esc(pid) + '">' + icon("layers") + 'Duplicate</button>' +
      (P.own ? '<button class="btn sm danger" data-act="progdel" data-prog="' + esc(pid) + '">' + icon("trash") + 'Delete</button>' : '') + '</div></div>';
  }).join("");
  h += '<div class="note footNote">Build your own with New, or Duplicate one to change it. Built-in programs are never deleted: editing one makes your copy, and Reset to original brings it back. Your strength carries forward — starting a new program picks up from your last completed week (+ one step).</div>';
  $("#view-library").innerHTML = h;
}

/* ---------- SETTINGS: Android-style grouped lists ---------- */
function field(label, type, path, val, hint){
  return '<div class="field"><label>' + label + '</label><input type="' + type + '"' + (type === "number" ? ' inputmode="decimal" step="any"' : "") + ' data-path="' + path + '" value="' + esc(val == null ? "" : val) + '">' + (hint ? '<div class="note dim" style="margin-top:3px">' + hint + '</div>' : "") + '</div>';
}
/* one list row with its input on the right */
function rowField(label, type, path, val, hint){
  return '<label class="li fieldRow"><span class="liB"><span class="liT">' + label + '</span>' + (hint ? '<span class="liS">' + hint + '</span>' : '') + '</span>' +
    '<input class="rowIn" type="' + type + '"' + (type === "number" ? ' inputmode="decimal" step="any"' : "") + ' data-path="' + path + '" value="' + esc(val == null ? "" : val) + '"></label>';
}
var ZONE_NAMES = { z1: "Recovery", z2: "Easy endurance (Zone 2)", z3: "Tempo", z4: "Threshold", z5: "Max" };
function zoneRowsHtml(){
  var p = db.profile;
  return ["z1","z2","z3","z4","z5"].map(function(z){ return '<div class="li zoneRow"><span class="zK">' + z.toUpperCase() + '</span><span class="liB">' + ZONE_NAMES[z] + '</span><span class="zV">' + p.hrZones[z][0] + '–' + p.hrZones[z][1] + '</span></div>'; }).join("");
}
function renderSettings(){
  var p = db.profile;
  var h = subHead("Settings");
  if(!p.targetBodyweightKg) h += bwPrompt("Set your <b>target lean bodyweight</b>: Fuel works out your daily protein from it.");
  h += '<div class="setGroup"><div class="sectH">Profile</div><div class="list">' +
    rowField("Name", "text", "p.name", p.name) +
    rowField("Target bodyweight (kg)", "number", "p.targetBodyweightKg", p.targetBodyweightKg, "Lean goal at ~10–15% body fat; protein is figured on this") +
    rowField("Max HR (bpm)", "number", "p.maxHr", p.maxHr, "Changing it rebuilds the zones below") +
    rowField("Protein low (g/kg)", "number", "p.proteinTargetGPerKg.low", p.proteinTargetGPerKg.low) +
    rowField("Protein high (g/kg)", "number", "p.proteinTargetGPerKg.high", p.proteinTargetGPerKg.high) + '</div></div>';
  h += '<div class="setGroup"><div class="sectH">Heart-rate zones</div><div class="list zoneList">' + zoneRowsHtml() + '</div><div class="note setNote">From your max heart rate of ' + p.maxHr + ' bpm.</div></div>';
  /* weight steps grouped by equipment category — only categories actually used (e.g. kettlebell stays hidden until a program adds one) */
  var gymDays = (getProgram(db.activeProgram) || {}).days || STRENGTH_DAYS;   /* Part 2: the active program's days */
  var catsUsed = {}; gymDays.forEach(function(pp){ ((db.programs[pp]||{}).entries||[]).forEach(function(en){ var x=exById(en.exerciseId); if(x&&x.cat) catsUsed[x.cat]=true; }); });
  h += '<div class="setGroup"><div class="sectH">Weight steps</div><div class="note setNote">The smallest jump per equipment type — set it to match your gym. On a Workout card, the step chip overrides just that lift.</div><div class="list">' +
    EQUIP_CAT_ORDER.filter(function(c){ return catsUsed[c]; }).map(function(cat){
      var c=EQUIP_CATS[cat], o=db.gearByCat[cat]||c, lbl=(o.equip==="db")?"DB grid":((o.inc||c.inc)+" kg"), lifts=[];
      gymDays.forEach(function(pp){ ((db.programs[pp]||{}).entries||[]).forEach(function(en){ var x=exById(en.exerciseId); if(x&&x.cat===cat) lifts.push(x.name); }); });
      return '<button class="li catRow" data-act="setcatstep" data-cat="'+esc(cat)+'"><span class="liI">' + icon("cog") + '</span><span class="liB"><span class="liT catName">'+esc(c.label)+'</span><span class="liS catLifts">'+esc(lifts.join(" · "))+'</span></span><span class="liV catStep">'+esc(lbl)+'</span>' + icon("chevR", "chev") + '</button>';
    }).join("") + '</div></div>';
  /* in the Android app: the rest-timer alert permission, which can be asked again here (the first prompt comes once) */
  if(window.Native && Native.isApp) h += '<div class="setGroup"><div class="sectH">Rest timer</div><div class="list"><button class="li alertRow" data-act="notifyask"><span class="liI">' + icon("bell") + '</span>' +
    '<span class="liB"><span class="liT">Rest-timer alerts</span><span class="liS">Checking…</span></span>' + icon("chevR", "chev") + '</button></div></div>';
  h += '<div class="setGroup"><div class="sectH">Data</div><div class="list">' +
    '<button class="li" data-act="export"><span class="liI">' + icon("upload") + '</span><span class="liB"><span class="liT">Export a backup</span><span class="liS">The whole record as one file, through the share sheet</span></span>' + icon("chevR", "chev") + '</button>' +
    '<button class="li" data-act="import"><span class="liI">' + icon("download") + '</span><span class="liB"><span class="liT">Import a backup</span><span class="liS">Replaces what is on this phone (asks first)</span></span>' + icon("chevR", "chev") + '</button>' +
    '<button class="li dangerRow" data-act="reset"><span class="liI">' + icon("trash") + '</span><span class="liB"><span class="liT">Reset all data</span><span class="liS">Erases everything on this phone (asks first)</span></span></button></div>' +
    '<div class="note setNote">Schema v' + db.schemaVersion + ' · last export ' + (db.settings.lastExportAt ? db.settings.lastExportAt.slice(0, 10) : "never") + '</div></div>';
  h += '<div class="note footNote">Tested weights live on the Workout (tap a lift\'s weight to enter or adjust it). Rest time and reps are per exercise. Barbell = 20 kg standard.</div>';
  $("#view-settings").innerHTML = h;
  if(window.Native && Native.isApp && Native.notifyPermission) Native.notifyPermission("check").then(alertRowState);
}
var ALERT_STATE = { granted: "On: a notification when your rest is over", denied: "Blocked: allow notifications in Android's app settings" };
function alertRowState(s){ var r = $("#view-settings .alertRow .liS"); if(r) r.textContent = ALERT_STATE[s] || (s === "unavailable" ? "Not available on this phone" : "Off: tap to allow"); }
function onNotifyAsk(){
  if(!window.Native || !Native.notifyPermission) return;
  Native.notifyPermission("request").then(function(s){ alertRowState(s); if(s === "granted" && typeof restState === "function" && restState()) scheduleAlert(); });
}
function setPath(path, val){ var o = path.indexOf("p.") === 0 ? db.profile : db.settings, parts = path.slice(2).split("."); for(var i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = val; }
function regenZones(){ var m = db.profile.maxHr || 193; db.profile.hrZones = { z1:[Math.round(.5*m),Math.round(.6*m)], z2:[Math.round(.6*m),Math.round(.7*m)], z3:[Math.round(.7*m),Math.round(.8*m)], z4:[Math.round(.8*m),Math.round(.9*m)], z5:[Math.round(.9*m),m] }; }
