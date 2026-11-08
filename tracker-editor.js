"use strict";
/* tracker-editor.js: his own programs and the program editor (version 2, part 2, 2026-11-04; the owner's office:
   dossiers/2026-11-04-v2-design, design-part2.md §3 and build-log.md "Part 2").
   DATA (additive; version 1 ignores both, and a v1 file has neither):
   - db.userPrograms[pid] = {id, name, days: [day ids], own}. own: true = his program (id "u-…", smart: double progression
     in each exercise's rep range); own: false = the EDITED COPY of a built-in (same id as the built-in; name null = the
     built-in's name). Nothing built in is ever deleted: removing the copy ("Reset to original") brings the original back.
   - db.userDays[key] = {id, name, entries}. key = the day id for a day of his own ("ud-…", also a day added to a
     built-in's copy); key = "<built-in id>/<seed day id>" for a built-in day changed in that program's copy only (Day A of
     Smart HSR edited leaves HSR Base 12's Day A as it was). Entries have the seed's shape: {exerciseId, sets, restSec,
     ss (superset number), ramp (warm-up set), block} plus repLo / repHi (the rep range, smart programs).
   AT RUN TIME: the engine's getProgram reads SEED_PROGRAM_LIB (tracker-engine.js stays unchanged), so syncPrograms()
   registers his programs there and an edited built-in's copy over its original (BUILTIN_LIB keeps the originals);
   applyDays() puts his days into db.programs (the day tracks every screen reads, rebuilt at each load) and, for the
   active program only, its edited built-in days.
   THE EDITOR: view "progedit" from Programs (Edit / New / Duplicate): the name; the workout days (add, rename, reorder,
   remove); a day's exercises (add from the picker, reorder, open one: sets, rep range, rest, starting weight, superset
   with the next, warm-up set, remove). Every change saves at once; removals have an Undo.
   Loaded after tracker-smart.js (which adds Smart HSR to the program list) and before the actions and the core. */

var BUILTIN_IDS = PROGRAM_ORDER.slice();
var BUILTIN_LIB = {};
BUILTIN_IDS.forEach(function(id){ BUILTIN_LIB[id] = JSON.parse(JSON.stringify(SEED_PROGRAM_LIB[id])); });
var OWN_PREFIX = "u-", OWN_DAY_PREFIX = "ud-", PROG_NAME_MAX = 40;

function isBuiltin(pid){ return BUILTIN_IDS.indexOf(pid) >= 0; }
function isOwnProg(pid){ var p = db && db.userPrograms && db.userPrograms[pid]; return !!(p && p.own); }
function isOwnDay(id){ return String(id || "").indexOf(OWN_DAY_PREFIX) === 0 && !!(db && db.userDays && db.userDays[id]); }
function newId(prefix){
  var s;
  do { s = prefix + Math.random().toString(36).slice(2, 8); } while((db.userPrograms && db.userPrograms[s]) || (db.userDays && db.userDays[s]) || SEED_DAYS[s] || SEED_PROGRAM_LIB[s]);
  return s;
}
function intIn(v, lo, hi, d){ v = Math.round(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }

/* ---------- the stored programs made safe (normalize, before migrate) ---------- */
function cleanEntry(e){
  var o = clone(e);
  o.sets = intIn(e.sets, 1, 10, 3);
  if(e.restSec != null) o.restSec = intIn(e.restSec, 0, 600, 90);
  if(e.repLo != null) o.repLo = intIn(e.repLo, 1, 50, 8);
  if(e.repHi != null) o.repHi = Math.max(o.repLo || 1, intIn(e.repHi, 1, 50, 12));
  if(e.ss != null){ var n = intIn(e.ss, 1, 99, 0); if(n) o.ss = n; else delete o.ss; }
  return o;
}
function cleanUserPrograms(){
  var ud = db.userDays, up = db.userPrograms, Dy = {}, P = {};
  if(ud && typeof ud === "object" && !Array.isArray(ud)) for(var k in ud){
    var d = ud[k]; if(!d || typeof d !== "object" || !Array.isArray(d.entries)) continue;
    var slash = k.indexOf("/"), id = slash > 0 ? k.slice(slash + 1) : k;
    if(slash > 0 ? !(isBuiltin(k.slice(0, slash)) && SEED_DAYS[id]) : k.indexOf(OWN_DAY_PREFIX) !== 0) continue;
    Dy[k] = { id: id, name: (typeof d.name === "string" ? d.name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : ""),
      entries: d.entries.filter(function(e){ return e && typeof e === "object" && typeof e.exerciseId === "string" && e.exerciseId; }).map(cleanEntry) };
    if(slash < 0 && !Dy[k].name) Dy[k].name = "Day";
  }
  var used = {};
  if(up && typeof up === "object" && !Array.isArray(up)) for(var pid in up){
    var p = up[pid], own = pid.indexOf(OWN_PREFIX) === 0;
    if(!p || typeof p !== "object" || !Array.isArray(p.days) || !(own || isBuiltin(pid))) continue;
    var days = p.days.filter(function(d, i, a){ return typeof d === "string" && a.indexOf(d) === i && (!!Dy[d] || (!own && !!SEED_DAYS[d] && !HOME_DAYS.includes(d))); });
    var name = (typeof p.name === "string" && p.name.trim()) ? p.name.replace(/\s+/g, " ").trim().slice(0, PROG_NAME_MAX) : null;
    if(!days.length || (own && !name)) continue;
    P[pid] = { id: pid, name: name, days: days, own: own };
    days.forEach(function(d){ used[d] = true; });
    if(!own) Object.keys(Dy).forEach(function(k2){ if(k2.indexOf(pid + "/") === 0) used[k2] = true; });
  }
  Object.keys(Dy).forEach(function(k3){ if(!used[k3]) delete Dy[k3]; });   /* a day no program holds is gone */
  db.userPrograms = P; db.userDays = Dy;
}

/* ---------- the run-time registry ---------- */
function syncPrograms(){
  if(!db) return;
  if(!db.userPrograms || typeof db.userPrograms !== "object") db.userPrograms = {};
  if(!db.userDays || typeof db.userDays !== "object") db.userDays = {};
  BUILTIN_IDS.forEach(function(id){
    var b = clone(BUILTIN_LIB[id]), e = db.userPrograms[id];
    if(e && !e.own){ if(e.name) b.name = e.name; b.days = e.days.slice(); b.edited = true; }
    SEED_PROGRAM_LIB[id] = b;
  });
  Object.keys(SEED_PROGRAM_LIB).forEach(function(id){ if(!isBuiltin(id) && !isOwnProg(id)) delete SEED_PROGRAM_LIB[id]; });
  Object.keys(db.userPrograms).forEach(function(id){ var p = db.userPrograms[id]; if(!p.own) return;
    SEED_PROGRAM_LIB[id] = { id: id, name: p.name, desc: "Your own program: your next weight and reps suggested each session.", days: p.days.slice(), weeks: TOTAL_WEEKS, smart: true, own: true, direction: "forward", rule: "smart" }; });
  if(db.programLib) db.programLib = clone(SEED_PROGRAM_LIB);
  if(db.activeProgram && !SEED_PROGRAM_LIB[db.activeProgram]) db.activeProgram = SMART_PROGRAM_ID;   /* a deleted or broken program */
}
/* the day tracks every screen reads: the seed's, his own days, and the active program's edited built-in days */
function applyDays(){
  if(!db || !db.programs) return;
  Object.keys(SEED_DAYS).forEach(function(d){ db.programs[d] = clone(SEED_DAYS[d]); });
  Object.keys(db.programs).forEach(function(d){ if(!SEED_DAYS[d] && !(db.userDays && db.userDays[d])) delete db.programs[d]; });
  Object.keys(db.userDays || {}).forEach(function(k){
    var u = db.userDays[k], slash = k.indexOf("/");
    if(slash < 0) db.programs[k] = { id: k, name: u.name, entries: clone(u.entries), own: true };
    else if(k.slice(0, slash) === db.activeProgram && SEED_DAYS[u.id]){ var c = clone(SEED_DAYS[u.id]); c.entries = clone(u.entries); db.programs[u.id] = c; }
  });
}
/* the days a program shows in the editor: an own day as stored; a built-in day from that program's copy, else the seed */
function dayDef(pid, dayId){
  if(SEED_DAYS[dayId]) return (db.userDays && db.userDays[pid + "/" + dayId]) || SEED_DAYS[dayId];
  return (db.userDays && db.userDays[dayId]) || null;
}
/* a built-in's copy (made on its first change) */
function ensureCopy(pid){ if(isBuiltin(pid) && !db.userPrograms[pid]) db.userPrograms[pid] = { id: pid, name: null, days: getProgram(pid).days.slice(), own: false }; return db.userPrograms[pid]; }
function progMut(pid){ return isBuiltin(pid) ? ensureCopy(pid) : db.userPrograms[pid]; }
/* the definition a change writes to */
function dayMut(pid, dayId){
  if(isBuiltin(pid)) ensureCopy(pid);
  if(SEED_DAYS[dayId]){ var k = pid + "/" + dayId; if(!db.userDays[k]) db.userDays[k] = { id: dayId, name: "", entries: clone(dayDef(pid, dayId).entries) }; return db.userDays[k]; }
  return db.userDays[dayId];
}
function afterEdit(){ syncPrograms(); applyDays(); save(); if(ui.view === "progedit") renderProgEdit(); else if(ui.view === "library") renderLibrary(); }
/* superset numbers again in order (1, 2, …); a lone member loses its mark */
function renumberSS(E){
  var n = 0, i = 0;
  while(i < E.length){
    if(E[i].ss){ var j = i, s = E[i].ss; while(j < E.length && E[j].ss === s) j++;
      if(j - i >= 2){ n++; for(var k = i; k < j; k++) E[k].ss = n; } else delete E[i].ss;
      i = j; } else i++;
  }
}
/* "1A", "1B" … per entry, as the Workout tags them */
function pairTags(E){
  var out = [], i = 0, n = 0;
  while(i < E.length){
    if(E[i].ss){ var j = i, s = E[i].ss; while(j < E.length && E[j].ss === s) j++; n++;
      for(var k = i; k < j; k++) out[k] = j - i >= 2 ? n + String.fromCharCode(65 + k - i) : null; i = j; }
    else { out[i] = null; i++; }
  }
  return out;
}

/* ---------- Programs: New, Edit, Duplicate, Delete ---------- */
function newProgram(){
  var undo = undoPoint(), pid = newId(OWN_PREFIX), d = newId(OWN_DAY_PREFIX);
  db.userDays[d] = { id: d, name: "Day 1", entries: [] };
  db.userPrograms[pid] = { id: pid, name: "My program", days: [d], own: true };
  afterEdit(); openEditor(pid);
  toast("New program: My program", { undo: undo });
}
function openEditor(pid){ if(!SEED_PROGRAM_LIB[pid]) return; ui.editPid = pid; ui.editDay = 0; showView("progedit"); }
function duplicateProgram(src){
  var S = getProgram(src); if(!S || S.id !== src) return;
  var undo = undoPoint(), pid = newId(OWN_PREFIX), days = [];
  (S.days || []).forEach(function(d){ var def = dayDef(src, d); if(!def) return; var id = newId(OWN_DAY_PREFIX);
    db.userDays[id] = { id: id, name: dayName(d), entries: clone(def.entries) }; days.push(id); });
  var nm = ("Copy of " + S.name).slice(0, PROG_NAME_MAX);
  db.userPrograms[pid] = { id: pid, name: nm, days: days, own: true };
  afterEdit(); openEditor(pid);
  toast(nm + " made", { undo: undo });
}
/* his own programs only (a built-in is never deleted); confirm, then Undo */
function deleteProgram(pid){
  if(!isOwnProg(pid)) return;
  var P = db.userPrograms[pid];
  openModal({ title: "Delete " + P.name + "?", message: "The program and its days go. Your diary keeps every lift you logged with it.", okLabel: "Delete", cls: "dangerSheet",
    onSubmit: function(){
      var undo = undoPoint();
      P.days.forEach(function(d){ delete db.userDays[d]; });
      delete db.userPrograms[pid];
      if(db.activeProgram === pid){ db.activeProgram = SMART_PROGRAM_ID; clearPreview(); ui.planProg = null; ui.planWeek = null; ui.planLastProg = null; }
      afterEdit(); if(ui.view === "progedit") showView("library");
      toast(P.name + " deleted", { undo: undo }); } });
}
function resetBuiltin(pid){
  if(!isBuiltin(pid) || !db.userPrograms[pid]) return;
  var nm = BUILTIN_LIB[pid].name;
  openModal({ title: "Reset " + nm + "?", message: "Your changes to it go, and the original program comes back. Your diary and targets stay.", okLabel: "Reset",
    onSubmit: function(){
      var undo = undoPoint(), copy = db.userPrograms[pid];
      (copy.days || []).forEach(function(d){ if(d.indexOf(OWN_DAY_PREFIX) === 0) delete db.userDays[d]; });
      Object.keys(db.userDays).forEach(function(k){ if(k.indexOf(pid + "/") === 0) delete db.userDays[k]; });
      delete db.userPrograms[pid];
      ui.editDay = 0; afterEdit();
      toast(nm + " is back to the original", { undo: undo }); } });
}

/* ---------- the editor page ---------- */
function edPid(){ return ui.editPid; }
function edDayId(){ var P = getProgram(edPid()); return (P.days || [])[ui.editDay || 0]; }
function mmssRest(s){ s = Math.max(0, s || 0); return Math.floor(s / 60) + ":" + pad2(s % 60); }
/* a row's line: "4 × 6–12 · rest 2:00 · 20 kg · warm-up set" */
function entrySummary(pid, en){
  var ex = exById(en.exerciseId) || {}, P = getProgram(pid), k = smartKind(en, ex), r = smartRange(en, ex), t = P.smart ? smartTarget(en.exerciseId) : null, parts = [];
  if(!P.smart || k === "effort") parts.push(en.sets + (en.sets === 1 ? " set" : " sets"));
  else parts.push(en.sets + " × " + r.lo + "–" + r.hi + (r.unit === "s" ? " s" : ""));
  parts.push("rest " + mmssRest(en.restSec || 0));
  if(t && t.kg != null && (k === "lift" || k === "carry" || k === "bw")) parts.push(smartWeightText(k, t.kg));
  if(en.ramp) parts.push("warm-up set");
  return parts.join(" · ");
}
function udHtml(up, down, i, n){
  return '<span class="edUD"><button class="udBtn" data-act="' + up + '" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">' + icon("chevU") + '</button>' +
    '<button class="udBtn" data-act="' + down + '" data-i="' + i + '"' + (i === n - 1 ? " disabled" : "") + ' aria-label="Move down">' + icon("chevD") + '</button></span>';
}
function renderProgEdit(){
  var pid = edPid(), P = SEED_PROGRAM_LIB[pid];
  if(!P){ ui.editPid = null; showView("library"); return; }
  var days = P.days || [], own = !!P.own, smart = !!P.smart;
  if(!(ui.editDay >= 0 && ui.editDay < days.length)) ui.editDay = 0;
  var h = '<div class="pageTop"><button class="backBtn" data-act="edback" aria-label="Back to Programs">' + icon("chevL") + '</button></div>' +
    '<div class="overline">' + (own ? "Your program" : "Built-in program") + '</div>' +
    '<button class="edNameRow" data-act="edname" aria-label="Rename the program"><span class="edName">' + esc(P.name) + '</span>' + icon("edit", "edNameIc") + '</button>';
  if(!own) h += '<div class="note edBuiltin">' + (P.edited ? "Your edited copy. The original stays in the app." : "Built in: a change makes your own copy of it, and the original can always come back.") + '</div>' +
    (P.edited ? '<button class="btn block edReset" data-act="edreset">' + icon("undo") + 'Reset to original</button>' : '');
  if(!smart) h += '<div class="note edNote">Reps and weights follow the 12-week plan from your tested 15RMs; here you set the days, the exercises, their sets, rests and supersets.</div>';
  h += '<div class="sectH">Workout days</div><div class="list edDays">' + days.map(function(d, i){
    var def = dayDef(pid, d), n = def ? def.entries.length : 0;
    return '<div class="li edDay' + (i === ui.editDay ? " sel" : "") + '" data-i="' + i + '"><button class="edPick" data-act="edday" data-i="' + i + '"><span class="liB"><span class="liT edDayName">' + esc(dayName(d)) + '</span>' +
      '<span class="liS">' + n + (n === 1 ? " exercise" : " exercises") + '</span></span></button>' + udHtml("eddayup", "eddaydown", i, days.length) + '</div>';
  }).join("") + '</div><button class="btn tonal block" data-act="edaddday">' + icon("plus") + 'Add a day</button>';
  var dId = days[ui.editDay], def = dId ? dayDef(pid, dId) : null;
  if(def){
    var E = def.entries, tags = pairTags(E);
    h += '<div class="edDaySec"><div class="edDayHead"><span class="edDayTitle">' + esc(dayName(dId)) + '</span><span class="edDayBtns"><button class="btn sm" data-act="eddayname">' + icon("edit") + 'Rename</button>' +
      (days.length > 1 ? '<button class="btn sm danger" data-act="eddelday" aria-label="Remove this day">' + icon("trash") + '</button>' : '') + '</span></div>' +
      (E.length ? '<div class="list edExs">' + E.map(function(en, i){
        var ex = exById(en.exerciseId) || { name: en.exerciseId };
        return '<div class="li edEx' + (tags[i] ? " paired" : "") + '" data-i="' + i + '">' + udHtml("edexup", "edexdown", i, E.length) +
          '<button class="edPick" data-act="edex" data-i="' + i + '"><span class="liB"><span class="liT"><span class="edExName">' + esc(ex.name) + '</span>' + (tags[i] ? ' <span class="edPair ssTag">' + tags[i] + '</span>' : '') + '</span>' +
          '<span class="liS edExSub">' + esc(entrySummary(pid, en)) + '</span></span>' + icon("chevR", "chev") + '</button></div>';
      }).join("") + '</div>' : '<div class="note edEmpty">No exercises yet. Add the first one.</div>') +
      '<button class="btn primary block" data-act="edaddex">' + icon("plus") + 'Add exercise</button></div>';
  }
  if(pid === db.activeProgram) h += '<button class="btn block edWeek" data-view="schedule">' + icon("calendar") + 'Week schedule: which day is which</button>';
  else h += '<div class="note setNote">Start training it from Programs to place its days on your week.</div>';
  $("#view-progedit").innerHTML = h;
}

/* ---------- the program's name, its days ---------- */
function editName(){
  var pid = edPid(), P = getProgram(pid);
  openModal({ title: "Program name", mode: "line", value: P.name, placeholder: P.name, maxLength: PROG_NAME_MAX, cls: "renameSheet",
    onSubmit: function(v){ var t = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, PROG_NAME_MAX);
      if(!t){ toast("Enter a name"); return; } if(t === P.name) return;
      var undo = undoPoint(), m = progMut(pid); m.name = (isBuiltin(pid) && t === BUILTIN_LIB[pid].name) ? null : t;
      afterEdit(); toast("Renamed " + t, { undo: undo }); } });
}
function editDayName(){
  var d = edDayId(); if(!d) return;
  if(SEED_DAYS[d]) openRename(d);   /* a built-in day keeps its one name everywhere (the Workout header's rename, Part 1) */
  else renameOwnDay(d);
}
/* his own day's name lives in its definition (from the editor, or from the Workout header's rename) */
function renameOwnDay(d){
  var def = db.userDays && db.userDays[d]; if(!def) return;
  openModal({ title: "Day name", mode: "line", value: def.name, placeholder: def.name, maxLength: NAME_MAX, cls: "renameSheet",
    onSubmit: function(v){ var t = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
      if(!t){ toast("Enter a name"); return; } if(t === def.name) return;
      var undo = undoPoint(), before = def.name; def.name = t; afterEdit(); if(ui.view === "programs") renderPlan();
      toast(before + " is now called " + t, { undo: undo }); } });
}
function addDay(){
  var pid = edPid(), m = progMut(pid), d = newId(OWN_DAY_PREFIX);
  db.userDays[d] = { id: d, name: "Day " + (m.days.length + 1), entries: [] };
  m.days.push(d); ui.editDay = m.days.length - 1; afterEdit();
}
function moveDay(i, dir){
  var m = progMut(edPid()), j = i + dir; if(j < 0 || j >= m.days.length) return;
  var t = m.days[i]; m.days[i] = m.days[j]; m.days[j] = t; ui.editDay = j; afterEdit();
}
function removeDay(){
  var pid = edPid(), m = progMut(pid), d = edDayId(); if(!d || m.days.length < 2) return;
  openModal({ title: "Remove " + dayName(d) + "?", message: "The day and its exercises leave this program. Your diary keeps every lift.", okLabel: "Remove", cls: "dangerSheet",
    onSubmit: function(){ var undo = undoPoint(), nm = dayName(d);
      m.days.splice(m.days.indexOf(d), 1);
      if(d.indexOf(OWN_DAY_PREFIX) === 0) delete db.userDays[d]; else delete db.userDays[pid + "/" + d];
      ui.editDay = 0; afterEdit(); toast(nm + " removed", { undo: undo }); } });
}

/* ---------- a day's exercises ---------- */
function moveEx(i, dir){
  var E = dayMut(edPid(), edDayId()).entries, j = i + dir; if(j < 0 || j >= E.length) return;
  var t = E[i]; E[i] = E[j]; E[j] = t; renumberSS(E); afterEdit();
}
/* the picker: the whole catalogue with search and filters (tracker-catalog.js), this program's exercises first */
function pickerProgramIds(){
  var inProg = {}, pid = edPid();
  (getProgram(pid).days || []).forEach(function(d){ var def = dayDef(pid, d); (def ? def.entries : []).forEach(function(en){ inProg[en.exerciseId] = true; }); });
  return inProg;
}
function openPicker(){
  catF.pick = catBlank();
  openSheet("Add exercise to " + dayName(edDayId()), '<div class="pickSheet"><label class="searchBox">' + icon("search") + '<input id="pickSearch" type="search" placeholder="Search exercises" autocomplete="off" aria-label="Search exercises"></label>' +
    '<div id="pickFilters" class="catFilters"></div><div class="libCount"></div><div class="list pickList catList"></div><button class="btn block catMore" data-act="catmore" data-ctx="pick" hidden></button>' +
    '<div class="note pickEmpty" hidden>Nothing found. Try part of a name.</div></div>', { cls: "pickCard" });
  var box = $("#pickSearch"); if(box) box.addEventListener("input", function(){ catF.pick.q = box.value; catF.pick.limit = CAT_PAGE; catRefresh("pick"); });
  catRefresh("pick");
}
function pickExercise(id){
  var ex = exById(id); if(!ex) return;
  var pid = edPid(), d = edDayId(), cur = dayDef(pid, d);
  /* ticks, logs and the diary key on the day and the lift, so one lift can sit on a day only once */
  if(cur && cur.entries.some(function(e){ return e.exerciseId === id; })){ closeModal(); toast(ex.name + " is already in " + dayName(d)); return; }
  var def = dayMut(pid, d), r = smartRange({}, ex), en = { exerciseId: id, block: "main", sets: 3, restSec: 90 };
  if(r.unit === "reps" && smartKind({}, ex) !== "effort"){ en.repLo = r.lo; en.repHi = r.hi; }
  def.entries.push(en); closeModal(); afterEdit();
  toast(ex.name + " added to " + dayName(d));
}
/* one exercise's settings sheet */
function edEntry(){ var def = dayDef(edPid(), edDayId()); return def ? def.entries[ui.editEx] : null; }
function openEdEx(i){
  ui.editEx = i;
  var pid = edPid(), d = edDayId(), def = dayDef(pid, d), en = def && def.entries[i]; if(!en) return;
  var ex = exById(en.exerciseId) || { name: en.exerciseId }, smart = !!getProgram(pid).smart, k = smartKind(en, ex), r = smartRange(en, ex), t = smartTarget(en.exerciseId);
  var E = def.entries, nx = E[i + 1], pv = E[i - 1], tags = pairTags(E), paired = !!tags[i];
  var mate = paired ? (nx && nx.ss === en.ss ? nx : pv) : nx;
  var stepper = function(label, f, v, sub){ return '<div class="li edRow"><span class="liB"><span class="liT">' + label + '</span>' + (sub ? '<span class="liS">' + sub + '</span>' : '') + '</span>' +
    '<span class="edStepper"><button class="edSt" data-act="edstep" data-f="' + f + '" data-d="-1" aria-label="' + label + ': less">' + icon("minus") + '</button><b class="edVal" data-f="' + f + '">' + v + '</b>' +
    '<button class="edSt" data-act="edstep" data-f="' + f + '" data-d="1" aria-label="' + label + ': more">' + icon("plus") + '</button></span></div>'; };
  var toggle = function(act, label, on, sub, off){ return '<button class="li edToggle" data-act="' + act + '" aria-pressed="' + on + '"' + (off ? " disabled" : "") + '><span class="liB"><span class="liT">' + label + '</span><span class="liS">' + sub + '</span></span><span class="sw' + (on ? " on" : "") + '"><i></i></span></button>'; };
  var ranged = smart && (k === "lift" || k === "carry" || k === "bw");
  var h = '<div class="edExSheet"><div class="list">' + stepper("Sets", "sets", en.sets || 1) +
    (ranged ? stepper("Reps from", "repLo", r.lo) + stepper("Reps up to", "repHi", r.hi, "Then the weight goes up") : smart && k === "hold" ? '<div class="li"><span class="liB"><span class="liT">Hold</span><span class="liS">20–45 s, then the harder version</span></span></div>' : '') +
    stepper("Rest", "restSec", mmssRest(en.restSec || 0), "Between its sets") + '</div>';
  if(ranged) h += '<div class="list"><button class="li" data-act="edstart"><span class="liB"><span class="liT">Starting weight</span><span class="liS">' + (t ? "Its current target · the keypad changes it" : "Left empty, its first set asks") + '</span></span>' +
    '<b class="liV edStart">' + (t && t.kg != null ? smartWeightText(k, t.kg) : "–") + '</b>' + icon("chevR", "chev") + '</button></div>';
  h += '<div class="list">' + toggle("edpair", "Superset", paired, paired ? "With " + esc((exById(mate.exerciseId) || { name: mate.exerciseId }).name) : nx ? "With the next: " + esc((exById(nx.exerciseId) || { name: nx.exerciseId }).name) : "The last exercise of the day has no next", !paired && !nx) +
    toggle("edramp", "Warm-up set", !!en.ramp, "One light set first when the target is 11 reps or fewer") + '</div>' +
    '<button class="btn danger block edRm" data-act="edrmex">' + icon("trash") + 'Remove from ' + esc(dayName(d)) + '</button></div>';
  openSheet(ex.name, h, { cls: "edExCard" });
}
function edStep(f, dir){
  var pid = edPid(), d = edDayId(), def = dayMut(pid, d), en = def.entries[ui.editEx]; if(!en) return;
  var ex = exById(en.exerciseId) || {}, r = smartRange(en, ex);
  if(f === "sets") en.sets = intIn((en.sets || 1) + dir, 1, 10, 3);
  else if(f === "restSec") en.restSec = intIn((en.restSec || 0) + dir * 15, 0, 600, 90);
  else if(f === "repLo"){ en.repHi = r.hi; en.repLo = intIn(r.lo + dir, 1, r.hi, r.lo); }
  else if(f === "repHi"){ en.repLo = r.lo; en.repHi = intIn(r.hi + dir, r.lo, 50, r.hi); }
  afterEdit();
  var v = f === "restSec" ? mmssRest(en.restSec) : f === "repLo" ? en.repLo : f === "repHi" ? en.repHi : en.sets, el = $('#modal.open .edVal[data-f="' + f + '"]');
  if(el) el.textContent = v;
}
function edStart(){
  var pid = edPid(), en = edEntry(); if(!en) return;
  var ex = exById(en.exerciseId) || { name: en.exerciseId }, k = smartKind(en, ex), t = smartTarget(en.exerciseId), i = ui.editEx;
  openModal({ title: "Starting weight · " + ex.name, message: t ? "Its current target. The next suggestions build on it." : "The weight to start with. It starts at the bottom of its rep range.", mode: "number", value: t && t.kg != null ? String(t.kg) : "", placeholder: "kg", stepEx: ex,
    onSubmit: function(v){ var n = num(v); if(n == null || n < 0 || (k !== "bw" && n === 0)){ toast("Enter a weight above 0"); return; }
      n = Math.round(n * 100) / 100;
      var undo = undoPoint(), lo = smartRange(en, ex).lo, today = todayISO();
      if(!Array.isArray(db.targetLog)) db.targetLog = [];
      /* a weight he sets is a fresh start: no session owns it (an older session's recompute never overwrites it), and its
         misses and Goods start again (Part 3, rule version 2) */
      if(t){ if(t.kg === n) return; db.targetLog.push({ exId: en.exerciseId, date: today, from: { kg: t.kg, reps: t.reps }, to: { kg: n, reps: t.reps }, how: "edit" }); t.kg = n; t.at = today; delete t.src; t.misses = 0; t.goods = 0; }
      else { db.targets[en.exerciseId] = { kg: n, reps: lo, misses: 0, at: today }; db.targetLog.push({ exId: en.exerciseId, date: today, from: {}, to: { kg: n, reps: lo }, how: "start" }); }
      afterEdit(); toast(ex.name + ": " + smartWeightText(k, n), { undo: undo }); } });
}
function edPair(){
  var pid = edPid(), d = edDayId(), E = dayMut(pid, d).entries, i = ui.editEx, en = E[i]; if(!en) return;
  var tags = pairTags(E);
  if(tags[i]){ var s = en.ss; E.forEach(function(x){ if(x.ss === s) delete x.ss; }); }
  else if(E[i + 1]){
    var nx = E[i + 1];
    [en.ss, nx.ss].forEach(function(s){ if(s) E.forEach(function(x){ if(x.ss === s) delete x.ss; }); });
    en.ss = nx.ss = 999;
  } else return;
  renumberSS(E); afterEdit(); openEdEx(i);
}
function edRamp(){ var en = dayMut(edPid(), edDayId()).entries[ui.editEx]; if(!en) return; if(en.ramp) delete en.ramp; else en.ramp = true; afterEdit(); openEdEx(ui.editEx); }
function edRemoveEx(){
  var pid = edPid(), d = edDayId(), undo = undoPoint(), E = dayMut(pid, d).entries, en = E[ui.editEx]; if(!en) return;
  var nm = (exById(en.exerciseId) || { name: en.exerciseId }).name;
  E.splice(ui.editEx, 1); renumberSS(E); closeModal(); afterEdit();
  toast(nm + " removed from " + dayName(d), { undo: undo });
}

/* ---------- clicks (routed here by the core) ---------- */
function editorClick(act, t){
  var i = +t.getAttribute("data-i");
  switch(act){
    case "prognew": newProgram(); return true;
    case "progedit": openEditor(t.getAttribute("data-prog")); return true;
    case "progdup": duplicateProgram(t.getAttribute("data-prog")); return true;
    case "progdel": deleteProgram(t.getAttribute("data-prog")); return true;
    case "edback": showView("library"); return true;
    case "edname": editName(); return true;
    case "edreset": resetBuiltin(edPid()); return true;
    case "edday": ui.editDay = i; renderProgEdit(); return true;
    case "eddayup": moveDay(i, -1); return true;
    case "eddaydown": moveDay(i, 1); return true;
    case "edaddday": addDay(); return true;
    case "eddayname": editDayName(); return true;
    case "eddelday": removeDay(); return true;
    case "edexup": moveEx(i, -1); return true;
    case "edexdown": moveEx(i, 1); return true;
    case "edex": openEdEx(i); return true;
    case "edaddex": openPicker(); return true;
    case "edpick": pickExercise(t.getAttribute("data-ex")); return true;
    case "edstep": edStep(t.getAttribute("data-f"), +t.getAttribute("data-d")); return true;
    case "edstart": edStart(); return true;
    case "edpair": edPair(); return true;
    case "edramp": edRamp(); return true;
    case "edrmex": edRemoveEx(); return true;
  }
  return false;
}

/* the Android back button: from the editor back to Programs (after the sheet closer) */
if(typeof window !== "undefined" && window.Native && Array.isArray(Native.backHandlers)) Native.backHandlers.splice(1, 0, function(){
  if(typeof ui !== "undefined" && ui && ui.view === "progedit" && typeof showView === "function"){ showView("library"); return true; }
  return false;
});
