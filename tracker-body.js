"use strict";
/* tracker-body.js: body measurements (2026-11-11). His words: "we need to add neck ,belly area masurment tracking area and
   weight, tracking" (decisions.md 2026-11-11; the spec: dossiers/2026-11-11-rule-v3/design.md part D).
   Additive data, version 1 ignores it: db.body = [{date: "YYYY-MM-DD", kg, belly, neck}], each number optional but at
   least one, one entry per date (a second save the same day replaces it), oldest first. The Progress screen shows a Body
   card: the latest of each with the change since the first, a chart of the chosen one, and "Log today" (a sheet with the
   three numbers and how to measure). The latest weight also feeds the body-weight lifts' same-effort reps
   (tracker-smart.js bodyKgNow). Loaded after tracker-progress.js, before the actions and the core. */
var BODY_FIELDS = [
  { k: "kg", name: "Weight", unit: "kg", min: 20, max: 400, hint: "Body weight" },
  { k: "belly", name: "Belly", unit: "cm", min: 30, max: 250, hint: "Around the belly button, relaxed" },
  { k: "neck", name: "Neck", unit: "cm", min: 20, max: 80, hint: "Just below the Adam's apple" }
];
/* a measurement typed or stored: a number in its sane range (a comma works as the decimal point), one decimal; else null */
function bodyNum(v, f){
  var n = typeof v === "number" ? v : num(String(v == null ? "" : v).trim().replace(",", "."));
  return (n != null && isFinite(n) && n >= f.min && n <= f.max) ? Math.round(n * 10) / 10 : null;
}
function bodyField(k){ for(var i = 0; i < BODY_FIELDS.length; i++) if(BODY_FIELDS[i].k === k) return BODY_FIELDS[i]; return null; }
/* normalize: only valid entries, one per date (the last wins), oldest first */
function cleanBody(){
  var by = {};
  (Array.isArray(db.body) ? db.body : []).forEach(function(e){
    if(!e || typeof e !== "object" || typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return;
    var o = { date: e.date }, any = false;
    BODY_FIELDS.forEach(function(f){ var v = bodyNum(e[f.k], f); if(v != null){ o[f.k] = v; any = true; } });
    if(any) by[e.date] = o;
  });
  db.body = Object.keys(by).sort().map(function(d){ return by[d]; });
}
/* the latest value of one measurement (null when never logged) */
function latestBody(k){
  var L = (typeof db !== "undefined" && db && Array.isArray(db.body)) ? db.body : [];
  for(var i = L.length - 1; i >= 0; i--) if(typeof L[i][k] === "number") return L[i][k];
  return null;
}
function bodySeries(k){ return (Array.isArray(db.body) ? db.body : []).filter(function(e){ return typeof e[k] === "number"; }).map(function(e){ return { date: e.date, v: e[k] }; }); }
function fmt1(x){ return String(Math.round(x * 10) / 10); }

/* ---------- the Progress card ---------- */
/* one measurement over time, dates to scale (the lift chart's look: tracker-progress.js bigChartHtml) */
function bodyChartHtml(s, unit){
  var W = 340, H = 150, pl = 34, pr = 12, pt = 12, pb = 24;
  var vs = s.map(function(x){ return x.v; }), min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
  var pad = Math.max((max - min) * 0.2, 1), lo = Math.floor(min - pad), hi = Math.ceil(max + pad);
  var t = s.map(function(x){ return new Date(x.date + "T00:00:00").getTime(); }), t0 = Math.min.apply(null, t), t1 = Math.max.apply(null, t);
  var X = function(i){ return t1 > t0 ? pl + (t[i] - t0) / (t1 - t0) * (W - pl - pr) : (pl + W - pr) / 2; };
  var Y = function(v){ return pt + (hi - v) / (hi - lo) * (H - pt - pb); };
  var grid = [lo, (lo + hi) / 2, hi].map(function(v){ return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gLine"></line><text x="' + (pl - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" class="gLbl" text-anchor="end">' + fmt1(v) + '</text>'; }).join("");
  var pts = s.map(function(x, i){ return X(i).toFixed(1) + "," + Y(x.v).toFixed(1); }).join(" ");
  var area = '<polygon points="' + X(0).toFixed(1) + ',' + (H - pb) + ' ' + pts + ' ' + X(s.length - 1).toFixed(1) + ',' + (H - pb) + '" class="gArea"></polygon>';
  var dots = s.map(function(x, i){ return '<circle class="pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="4"></circle>'; }).join("");
  return '<svg class="bodyChart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(unit) + ' over time">' + grid + area + '<polyline points="' + pts + '" class="gLine2"></polyline>' + dots +
    '<text x="' + pl + '" y="' + (H - 6) + '" class="gLbl">' + esc(shortDate(s[0].date)) + '</text><text x="' + (W - pr) + '" y="' + (H - 6) + '" class="gLbl" text-anchor="end">' + esc(shortDate(s[s.length - 1].date)) + '</text></svg>';
}
/* the latest of each with the change since the first; the chosen one's chart; Log today */
function bodyCardHtml(){
  var L = Array.isArray(db.body) ? db.body : [], h = '<div class="sectH">Body</div>';
  if(!L.length) return h + '<div class="card bodyCard bodyEmpty"><div class="note">Track your weight, belly and neck now and then: each one shows here as a line over time.</div>' +
    '<button class="btn tonal block" data-act="bodylog">' + icon("plus") + 'Log today</button></div>';
  if(!bodyField(ui.bodyMetric) || !bodySeries(ui.bodyMetric).length) ui.bodyMetric = (BODY_FIELDS.filter(function(f){ return bodySeries(f.k).length; })[0] || BODY_FIELDS[0]).k;
  var tiles = BODY_FIELDS.map(function(f){
    var s = bodySeries(f.k), sel = f.k === ui.bodyMetric, v = "—", d = "not logged yet";
    if(s.length){ var last = s[s.length - 1], diff = Math.round((last.v - s[0].v) * 10) / 10;
      v = fmt1(last.v) + " " + f.unit;
      d = s.length > 1 ? (diff > 0 ? "+" : diff < 0 ? "−" : "±") + fmt1(Math.abs(diff)) + " since " + shortDate(s[0].date) : "first entry, " + shortDate(last.date); }
    return '<button class="bodyTile' + (sel ? " sel" : "") + '" data-act="bodymetric" data-m="' + f.k + '"' + (s.length ? '' : ' disabled') + ' aria-pressed="' + sel + '">' +
      '<span class="btK">' + f.name + '</span><b class="btV">' + esc(v) + '</b><span class="btD">' + esc(d) + '</span></button>';
  }).join("");
  var f = bodyField(ui.bodyMetric), s = bodySeries(f.k), today = todayISO(), hasToday = L.some(function(e){ return e.date === today; });
  var chart = s.length > 1 ? bodyChartHtml(s, f.unit) : '<div class="note bodyOne">One ' + f.name.toLowerCase() + ' entry so far. Log again in a week or two to see the line.</div>';
  return h + '<div class="card bodyCard"><div class="bodyTiles">' + tiles + '</div><div class="bodyPlot" data-m="' + f.k + '">' + chart + '</div>' +
    '<button class="btn tonal block" data-act="bodylog">' + icon(hasToday ? "edit" : "plus") + (hasToday ? "Change today's numbers" : "Log today") + '</button></div>';
}

/* ---------- the sheet: today's three numbers, how to measure, the recent entries ---------- */
function bodyRowText(e){ return BODY_FIELDS.filter(function(f){ return typeof e[f.k] === "number"; }).map(function(f){ return fmt1(e[f.k]) + " " + f.unit; }).join(" · "); }
function openBodySheet(){
  var today = todayISO(), cur = (db.body || []).filter(function(e){ return e.date === today; })[0] || {};
  var recent = (db.body || []).slice(-6).reverse();
  var h = '<div class="bodyForm">' + BODY_FIELDS.map(function(f){
      return '<label class="bodyF"><span class="bfName"><span class="bfN">' + f.name + '</span> <span class="bfHint">' + esc(f.hint) + '</span></span>' +
        '<span class="bfIn"><input id="body-' + f.k + '" class="mInput bodyIn" type="text" inputmode="decimal" autocomplete="off" value="' + (typeof cur[f.k] === "number" ? fmt1(cur[f.k]) : "") + '" placeholder="' + f.unit + '" aria-label="' + f.name + ' in ' + f.unit + '"><span class="bfUnit">' + f.unit + '</span></span></label>';
    }).join("") +
    '<div class="note bodyTip">Measure in the morning before breakfast, relaxed, with the tape snug but not tight, at the same spot each time. Leave a box empty to skip it.</div>' +
    '<button class="btn primary big block" data-act="bodysave">' + icon("check") + 'Save</button>' +
    (recent.length ? '<div class="sectH bodyRecentH">Recent</div><div class="bodyList">' + recent.map(function(e){
      return '<div class="bodyRow" data-date="' + e.date + '"><span class="brDate">' + esc(shortDate(e.date)) + '</span><span class="brVals">' + esc(bodyRowText(e)) + '</span>' +
        '<button class="btn sm bodyDel" data-act="bodydel" data-date="' + e.date + '" aria-label="Remove ' + esc(shortDate(e.date)) + '">Remove</button></div>'; }).join("") + '</div>' : '') +
    '</div>';
  openSheet("Body · " + shortDate(today), h, { cls: "bodySheet" });
}
/* Save: today's entry is replaced by what the boxes hold (all empty = today's entry removed); a number out of range stops it */
function saveBody(){
  var today = todayISO(), o = { date: today }, any = false, bad = null;
  BODY_FIELDS.forEach(function(f){
    var el = document.getElementById("body-" + f.k), raw = el ? String(el.value).trim() : "";
    if(!raw) return;
    var v = bodyNum(raw, f); if(v == null){ if(!bad) bad = f; return; }
    o[f.k] = v; any = true;
  });
  if(bad){ toast(bad.name + ": a number from " + bad.min + " to " + bad.max + " " + bad.unit); return; }
  var undo = undoPoint();
  db.body = (Array.isArray(db.body) ? db.body : []).filter(function(e){ return e.date !== today; });
  if(any) db.body.push(o);
  cleanBody(); save(); closeModal();
  if(ui.view === "progress") renderProgress();
  toast(any ? "Body · today: " + bodyRowText(o) : "Body · today's entry removed", { undo: undo });
}
function deleteBody(date){
  var undo = undoPoint();
  db.body = (Array.isArray(db.body) ? db.body : []).filter(function(e){ return e.date !== date; });
  save(); closeModal();
  if(ui.view === "progress") renderProgress();
  toast("Body · " + shortDate(date) + " removed", { undo: undo });
}
/* clicks (routed here by the core) */
function bodyClick(act, t){
  if(act === "bodylog"){ openBodySheet(); return true; }
  if(act === "bodysave"){ saveBody(); return true; }
  if(act === "bodydel"){ deleteBody(t.getAttribute("data-date")); return true; }
  if(act === "bodymetric"){ ui.bodyMetric = t.getAttribute("data-m"); renderProgress(); return true; }
  return false;
}
