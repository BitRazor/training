"use strict";
/* tracker-catalog.js: the exercise catalogue in the app (version 2, part 2, 2026-11-04; design-part2.md §2).
   exercise-catalog.js (generated in the owner's office, catalog/build-catalog.mjs; never edited by hand) defines
   EXERCISE_CATALOG (898 entries on 2026-11-11: his 35 with his ids, 863 from free-exercise-db as "fedb:<source id>") and
   CATALOG_FIELDS.
   - exById falls back to catalogExercise(id): an entry as a lift the engine and the cards can use, built on demand and
     never saved (the catalogue stays out of the saved data; the saved data only names ids).
     Weight grid by equipment: dumbbell = the dumbbell grid; barbell, E-Z bar = 2.5 kg; cable, machine = the stack; kettlebells
     = 4 kg (the engine's categories). Body only and other gear: body weight + an optional plate. Stretches, cardio, foam
     rolling and body-weight static holds: effort exercises logged in seconds, with no weight.
   - his picture rule: an entry shows only a checked picture of his (EX_GIF); every other entry shows the labelled "Picture
     to come" box naming the file it expects (lesson L-2). The source's images are never shipped.
   - the filters (muscle = main muscle, equipment, pattern, location, level; one value each, all together) and the search work
     the same in the Exercises library ("lib") and the program editor's picker ("pick"): the chips open their values
     inline, because the picker is itself a sheet. Rows come in pages of 40: about 900 rows at once are too many for a phone.
   Loaded after the data, before the views need it at run time. */

var CAT_PAGE = 40;
var CAT_FILTERS = [["muscle", "Muscle"], ["equipment", "Equipment"], ["pattern", "Pattern"], ["location", "Location"], ["level", "Level"]];
var CAT_LABEL = { "e-z curl bar": "E-Z curl bar", "isolation-arms": "Isolation: arms", "isolation-legs": "Isolation: legs", "forearm-neck": "Forearm or neck", "core-anti-movement": "Core anti-movement" };
var CAT_GEAR = { dumbbell: "db", barbell: "bar", "e-z curl bar": "bar", cable: "cable", machine: "cable", kettlebells: "kb" };
var catIndex = null, catLifts = {};
var catF = { lib: catBlank(), pick: catBlank() };
function catBlank(){ return { open: null, muscle: null, equipment: null, pattern: null, location: null, level: null, q: "", limit: CAT_PAGE }; }
function catalogList(){ return typeof EXERCISE_CATALOG !== "undefined" ? EXERCISE_CATALOG : []; }
function catalogEntry(id){
  if(!catIndex){ catIndex = {}; catalogList().forEach(function(e){ catIndex[e.id] = e; }); }
  return catIndex[id] || null;
}
function catLabel(v){ if(CAT_LABEL[v]) return CAT_LABEL[v]; var s = String(v).replace(/-/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); }
/* a source entry as a lift (his own entries live in db.exercises with the seed's fields) */
function catalogExercise(id){
  if(catLifts[id]) return catLifts[id];
  var c = catalogEntry(id); if(!c || c.source === "owner") return null;
  var gear = CAT_GEAR[c.equipment], x = { id: c.id, name: c.name, pattern: c.pattern, catalog: true };
  if(c.type === "stretching" || c.type === "cardio" || c.pattern === "mobility" || c.pattern === "cardio" || c.equipment === "foam roll" || (!gear && c.force === "static")){ x.loadType = "effort"; x.defaultUnit = "s"; }
  else if(gear){ x.loadType = "external"; x.cat = gear; if(gear === "db") x.equip = "db"; x.defaultUnit = c.laterality === "unilateral" ? (c.region === "lower" ? "kg/leg" : "kg/arm") : "kg"; }
  else { x.loadType = "bodyweight"; x.defaultUnit = "kg"; }
  catLifts[id] = x;
  return x;
}
/* the file an entry's picture is expected at, without gifs/ and .gif (his waiting ones keep their own, EX_GIF_PENDING);
   null = it has a checked picture */
function pendingPic(exId){
  var p = (typeof EX_GIF_PENDING !== "undefined") ? EX_GIF_PENDING[exId] : null; if(p) return p;
  if(EX_GIF[exId]) return null;
  var c = catalogEntry(exId); if(!c) return null;
  if(c.picture && c.picture.expectedFile) return String(c.picture.expectedFile).replace(/^gifs\//, "").replace(/\.\w+$/, "");
  return String(c.id).replace(/^fedb:/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/* ---------- filters and search ---------- */
function catValues(f){ var F = (typeof CATALOG_FIELDS !== "undefined") ? CATALOG_FIELDS : {}; return (f === "muscle" ? F.primaryMuscles : F[f]) || []; }
function catPass(e, s){ return (!s.muscle || e.primaryMuscles.indexOf(s.muscle) >= 0) && (!s.equipment || e.equipment === s.equipment) && (!s.pattern || e.pattern === s.pattern) && (!s.location || e.location === s.location) && (!s.level || e.level === s.level); }
function catAny(s){ return !!(s.muscle || s.equipment || s.pattern || s.location || s.level); }
/* every entry the filters and the search leave */
function catalogMatches(ctx){ var s = catF[ctx], q = String(s.q || "").trim().toLowerCase(); return catalogList().filter(function(e){ return catPass(e, s) && (!q || e.name.toLowerCase().indexOf(q) >= 0); }); }
/* one exercise under the filters (a warm-up move, not in the catalogue, only passes with no filter on) */
function catalogMatch(id, ctx){ var e = catalogEntry(id), s = catF[ctx]; return e ? catPass(e, s) : !catAny(s); }
function catFilterSet(ctx, f, v){ var s = catF[ctx]; s[f] = v || null; s.limit = CAT_PAGE; catRefresh(ctx); }
function catalogFilterHtml(ctx){
  var s = catF[ctx];
  var h = '<div class="chips scroll catCats">' + CAT_FILTERS.map(function(f){ var v = s[f[0]];
    return '<button class="chip catCat' + (v ? " sel" : "") + (s.open === f[0] ? " open" : "") + '" data-act="catopen" data-ctx="' + ctx + '" data-f="' + f[0] + '" aria-expanded="' + (s.open === f[0]) + '">' + esc(v ? catLabel(v) : f[1]) + icon("chevD", "sm") + '</button>'; }).join("") +
    (catAny(s) ? '<button class="chip catClear" data-act="catclear" data-ctx="' + ctx + '">' + icon("close", "sm") + 'Clear</button>' : '') + '</div>';
  if(s.open) h += '<div class="chips catVals">' + catValues(s.open).map(function(v){
    return '<button class="chip catVal' + (s[s.open] === v ? " sel" : "") + '" data-act="catval" data-ctx="' + ctx + '" data-f="' + s.open + '" data-v="' + esc(v) + '">' + esc(catLabel(v)) + '</button>'; }).join("") + '</div>';
  return h;
}
function catSub(e){ return catLabel(e.primaryMuscles[0]) + " · " + catLabel(e.equipment) + " · " + catLabel(e.level); }
/* the rows below his program in the library, the picker's list, the count, Show more */
function catRefresh(ctx){
  var s = catF[ctx], fb = $(ctx === "lib" ? "#libFilters" : "#pickFilters"); if(!fb) return;
  fb.innerHTML = catalogFilterHtml(ctx);
  var all = catalogMatches(ctx), rows, html;
  if(ctx === "lib"){
    var mine = {};
    libraryGroups().forEach(function(g){ g.items.forEach(function(it){ if(it.kind === "lift") mine[it.id] = true; }); });
    var any = filterLibrary(s.q);
    rows = all.filter(function(e){ return !mine[e.id]; });
    html = rows.slice(0, s.limit).map(function(e){
      return '<button class="li catRow" data-act="exsheet" data-ex="' + esc(e.id) + '"><span class="libThumb">' + thumbHtml(e.id) + '</span><span class="liB"><span class="liT">' + esc(e.name) + '</span><span class="liS">' + esc(catSub(e)) + '</span></span>' + icon("chevR", "chev") + '</button>'; }).join("");
    var empty = $("#view-exercises .libEmpty"); if(empty) empty.hidden = any || rows.length > 0;
    var sec = $("#view-exercises .libAll"); if(sec) sec.hidden = !rows.length;
  } else {
    var inProg = pickerProgramIds();
    rows = all.filter(function(e){ return inProg[e.id]; }).concat(all.filter(function(e){ return !inProg[e.id]; }));
    html = rows.slice(0, s.limit).map(function(e){
      return '<button class="li pickRow" data-act="edpick" data-ex="' + esc(e.id) + '"><span class="libThumb">' + thumbHtml(e.id) + '</span><span class="liB"><span class="liT pickName">' + esc(e.name) + '</span><span class="liS">' + esc((inProg[e.id] ? "In this program · " : "") + catSub(e)) + '</span></span>' + icon("plus", "chev") + '</button>'; }).join("");
    var pe = $("#modal .pickEmpty"); if(pe) pe.hidden = rows.length > 0;
  }
  var root = ctx === "lib" ? "#view-exercises" : "#modal", list = $(root + " .catList"), ct = $(root + " .libCount"), more = $(root + ' [data-act="catmore"]');
  if(list) list.innerHTML = html;
  if(ct) ct.textContent = all.length + (all.length === 1 ? " exercise" : " exercises");
  if(more){ more.hidden = rows.length <= s.limit; more.textContent = "Show more (" + Math.max(0, rows.length - s.limit) + " left)"; }
}
function catalogClick(act, t){
  var ctx = t.getAttribute("data-ctx"), s = catF[ctx]; if(!s) return false;
  if(act === "catopen"){ var f = t.getAttribute("data-f"); s.open = s.open === f ? null : f; catRefresh(ctx); return true; }
  if(act === "catval"){ var g = t.getAttribute("data-f"), v = t.getAttribute("data-v"); s[g] = s[g] === v ? null : v; s.open = null; s.limit = CAT_PAGE; catRefresh(ctx); return true; }
  if(act === "catclear"){ catF[ctx] = catBlank(); catF[ctx].q = s.q; catRefresh(ctx); return true; }
  if(act === "catmore"){ s.limit += CAT_PAGE; catRefresh(ctx); return true; }
  return false;
}
/* the exercise sheet: a catalogue exercise's instructions, and every exercise's categories */
function catalogDetailsHtml(exId){
  var c = catalogEntry(exId); if(!c) return "";
  var list = function(a){ return (a || []).map(catLabel).join(", "); };
  var row = function(k, v){ return v ? '<div class="factRow"><span>' + k + '</span> <b>' + esc(v) + '</b></div>' : ''; };
  var how = (!EX_DESC[exId] && c.instructions && c.instructions.length) ? '<div class="sheetSec"><div class="sectH">How to</div><ol class="instrList">' + c.instructions.map(function(l){ return '<li>' + esc(String(l).trim()) + '</li>'; }).join("") + '</ol></div>' : '';
  return how + '<div class="sheetSec"><div class="sectH">Details</div><div class="factList">' + row("Muscles", list(c.primaryMuscles)) + row("Helpers", list(c.secondaryMuscles)) + row("Pattern", catLabel(c.pattern)) + row("Equipment", catLabel(c.equipment)) +
    row("Level", catLabel(c.level)) + row("Type", catLabel(c.type)) + row("Mechanic", catLabel(c.mechanic)) + row("Force", catLabel(c.force)) + row("Sides", catLabel(c.laterality)) + row("Where", catLabel(c.location)) + '</div></div>';
}
