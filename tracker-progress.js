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

/* ---------- the exercise sheet: big picture, how-to, this lift's chart and history, its notes, step, Add note ---------- */
/* the day a lift lives on (gym days first, then home); null for a lift on no day */
function dayOfAny(exId){ var ds = STRENGTH_DAYS.concat(typeof HOME_DAYS !== "undefined" ? HOME_DAYS : []); for(var i = 0; i < ds.length; i++) if(progEntry(ds[i], exId)) return ds[i]; return null; }
function bigPicHtml(exId, alt){
  var pend = (typeof EX_GIF_PENDING !== "undefined") ? EX_GIF_PENDING[exId] : null;
  if(pend) return '<div class="exFig pending big">' + icon("camera", "xl") + '<span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(pend) + '.gif</span></div>';
  var g = EX_GIF[exId]; if(!g) return '';
  return '<div class="exFig big"><img src="gifs/' + g + '.gif" alt="' + esc(alt || "") + '" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
}
function howHtml(exId){
  var d = EX_DESC[exId]; if(!d) return "";
  return '<div class="how">' + [["Setup", d.setup], ["Move", d.move], ["Cue", d.cue], ["Feel", d.feel]].map(function(r){ return '<div class="howRow"><span class="howK">' + r[0] + '</span><span class="howV">' + esc(r[1]) + '</span></div>'; }).join("") + '</div>';
}
function notesFor(exId){ return (db.notes || []).map(function(n, i){ return { n: n, i: i }; }).filter(function(o){ return o.n && o.n.exerciseId === exId; }).reverse(); }
function noteLineHtml(o, withName){
  var n = o.n, rec = []; if(n.week) rec.push("Week " + n.week); if(n.weight) rec.push(n.weight);
  return '<div class="noteRow"><div class="noteHd">' + (withName ? '<b>' + esc((exById(n.exerciseId) || { name: n.exerciseId }).name) + '</b>' : '<b>' + esc(shortDate(n.date)) + '</b>') +
    '<span class="dim">' + esc(withName ? shortDate(n.date) : "") + '</span></div>' + (rec.length ? '<div class="noteRec">' + esc(rec.join(" · ")) + '</div>' : '') + '<div class="noteTx">' + esc(n.text) + '</div></div>';
}
function histListHtml(hist){
  if(!hist.length) return '<div class="note">No sessions logged yet. Each lift you tick is written here with its weight.</div>';
  return '<div class="histList">' + hist.slice().reverse().slice(0, 8).map(function(h){
    return '<div class="kv"><span>' + esc(shortDate(h.ts)) + ' · week ' + h.week + '</span><b>' + h.kg + ' kg × ' + h.reps + (h.quality === "partial" ? ' <span class="ltPartial">partial</span>' : '') + '</b></div>';
  }).join("") + '</div>';
}
function openExSheet(exId, sec){
  var ex = exById(exId) || { name: exId }, hist = historyFor(exId);
  var day = (ui.view === "programs" && ui.planProg && progEntry(ui.planProg, exId)) ? ui.planProg : dayOfAny(exId), en = day ? progEntry(day, exId) : null;
  var w = (day && day === ui.planProg && ui.planWeek) ? ui.planWeek : (day ? shownCurrentWeek(day) : 1), pr = en ? prescFor(en, w) : null;
  var notes = notesFor(exId);
  var h = '<div class="exSheet"><div class="exBig">' + bigPicHtml(exId, ex.name) + '</div>' +
    (en ? '<div class="exNow"><div class="exNowTop"><span class="pill' + (en.block === "heavy" ? " acc" : "") + '">' + esc(en.block) + '</span><span class="dim">' + esc(shortName(day)) + ' · week ' + w + '</span></div><div class="exNowT">' + pr.text + '</div></div>' : '') +
    (EX_DESC[exId] ? '<div class="sheetSec"><div class="sectH">How to</div>' + howHtml(exId) + '</div>' : '') +
    '<div class="sheetSec exProg" id="exSecProgress"><div class="sectH">Progress</div>' + (hist.length >= 2 ? progHtml(hist) : '') + histListHtml(hist) + '</div>' +
    '<div class="sheetSec exNotes" id="exSecNotes"><div class="sectH">Notes</div>' + (notes.length ? notes.map(function(o){ return noteLineHtml(o, false); }).join("") : '<div class="note">No notes for this lift yet.</div>') +
    '<button class="btn tonal block" style="margin-top:12px" data-act="note" data-ex="' + esc(exId) + '"' + (day ? ' data-prog="' + day + '" data-week="' + w + '"' : '') + '>' + icon("plus") + 'Add note</button></div>' +
    (pr && pr.kind === "heavy" ? '<div class="sheetSec"><div class="sectH">Weight step</div><div class="list" style="margin:0"><button class="li" data-act="setstep" data-ex="' + esc(exId) + '"><span class="liI">' + icon("cog") + '</span><span class="liB"><span class="liT">' + esc(stepLabel(ex)) + '</span><span class="liS">The smallest jump your gear allows for this lift</span></span>' + icon("chevR", "chev") + '</button></div></div>' : '') +
    '</div>';
  openSheet(ex.name, h, { cls: "exSheetCard" });
  if(sec){ var el = document.getElementById(sec === "notes" ? "exSecNotes" : "exSecProgress"); if(el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }
}
/* a warm-up move's picture, big (data-wu = its gif id) */
function warmMove(gif){ for(var d in WARMUP_BY_PROG){ var L = WARMUP_BY_PROG[d] || []; for(var i = 0; i < L.length; i++) if(L[i].gif === gif) return L[i]; } return null; }
function openPicSheet(gif){
  var m = warmMove(gif); if(!m) return;
  var g = m.gif.indexOf(".") >= 0 ? m.gif : m.gif + ".gif";
  var pic = m.nopic ? '' : m.pending ? '<div class="exFig pending big">' + icon("camera", "xl") + '<span class="pendTx">Picture to come</span><span class="pendFile">gifs/' + esc(g) + '</span></div>'
    : '<div class="exFig big"><img src="gifs/' + g + '" alt="' + esc(m.name) + '" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
  openSheet(m.name, '<div class="exSheet"><div class="exBig">' + pic + '</div><div class="exNow"><div class="exNowTop"><span class="pill warn">warm-up</span></div><div class="exNowT small">' + esc(m.detail) + '</div></div></div>');
}

/* ---------- PROGRESS ---------- */
function renderProgress(){
  $("#view-progress").innerHTML = mainHead("Progress") + '<div class="card note">Your lifts over time, personal bests and how regularly you train.</div>';
}
