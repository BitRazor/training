"use strict";
/* training-tracker — core: state (schema v2), router, events, init.
   Loads SEED_* (tracker-seed.js), EX_DESC/EX_GIF (tracker-desc.js), views (tracker-views.js),
   the Plan (tracker-plan.js) — all BEFORE this file. Storage: localStorage `training-tracker:v1`. */

/* ---------- helpers ---------- */
function $(s,e){return (e||document).querySelector(s);}
function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function num(v){var n=parseFloat(v);return isFinite(n)?n:null;}
function todayISO(){var d=new Date();function p(n){n=String(n);return n.length<2?"0"+n:n;}return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());}
function nowISO(){return new Date().toISOString();}
function clone(o){return JSON.parse(JSON.stringify(o));}
function weekdayIdx(){var w=new Date().getDay();return w===0?6:w-1;}
function zoneRange(z){var zz=db.profile.hrZones[z];return zz?zz[0]+"–"+zz[1]+" bpm":"";}

/* ---------- state ---------- */
var db=null, ui={view:"today", planProg:null, planWeek:null, planLastProg:null};

function seedDb(){
  return {schemaVersion:SCHEMA_VERSION, app:"training-tracker", exportedAt:null,
    profile:clone(SEED_PROFILE), exercises:clone(SEED_EXERCISES), programs:clone(SEED_PROGRAMS),
    tested:clone(SEED_TESTED), progress:{"strength-a":{weeksDone:[]},"strength-b":{weeksDone:[]}},
    notes:[], settings:clone(SEED_SETTINGS)};
}
function migrate(){
  /* v1 → v2: add tested/progress/notes, target bodyweight; drop old logger/sessions + block-week/rest/bar settings */
  if(!db.tested) db.tested={};
  /* one-time: load the 2026-06-16 calibration-export weights, overwriting old placeholders once,
     then on later loads only fill gaps so the user's own overrides are preserved */
  if(db.settings.testedSeed!=="2026-06-16"){ for(var k in SEED_TESTED) db.tested[k]=SEED_TESTED[k]; db.settings.testedSeed="2026-06-16"; }
  else { for(var k2 in SEED_TESTED){ if(db.tested[k2]===undefined) db.tested[k2]=SEED_TESTED[k2]; } }
  if(!db.progress) db.progress={};
  STRENGTH_DAYS.forEach(function(p){ if(!db.progress[p]) db.progress[p]={weeksDone:[]}; if(!db.progress[p].weeksDone) db.progress[p].weeksDone=[]; });
  if(!db.notes) db.notes=[];
  if(db.profile && db.profile.targetBodyweightKg==null && db.profile.bodyweightKg!=null) db.profile.targetBodyweightKg=db.profile.bodyweightKg;
  /* embedded design always refreshed to the current seed */
  db.exercises=clone(SEED_EXERCISES); db.programs=clone(SEED_PROGRAMS);
  db.schemaVersion=SCHEMA_VERSION;
}
function load(){
  try{var raw=localStorage.getItem(STORE_KEY); db=raw?JSON.parse(raw):seedDb();}catch(e){db=seedDb();}
  if(!db||db.app!=="training-tracker") db=seedDb();
  if(!db.profile) db.profile=clone(SEED_PROFILE);
  if(!db.settings) db.settings=clone(SEED_SETTINGS);
  for(var k in SEED_PROFILE){ if(db.profile[k]===undefined) db.profile[k]=clone(SEED_PROFILE[k]); }
  migrate();
}
var saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(function(){try{localStorage.setItem(STORE_KEY,JSON.stringify(db));}catch(e){}},150);}
function exById(id){for(var i=0;i<db.exercises.length;i++)if(db.exercises[i].id===id)return db.exercises[i];return null;}

/* ---------- router (5 views; Plan renders into #view-programs) ---------- */
var VIEWS=["today","programs","log","nutrition","settings"];
function showView(name){
  ui.view=name;
  VIEWS.forEach(function(v){var el=$("#view-"+v); if(el)el.hidden=(v!==name);});
  $$(".tab").forEach(function(b){b.classList.toggle("sel",b.getAttribute("data-view")===name);});
  ({today:renderToday, programs:renderPlan, log:renderLog, nutrition:renderNutrition, settings:renderSettings}[name])();
  window.scrollTo(0,0);
}

/* ---------- export / import ---------- */
function doExport(){
  db.exportedAt=nowISO(); db.settings.lastExportAt=db.exportedAt; save();
  var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
  a.download="training-export-"+todayISO()+".json"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
}

/* ---------- plan actions ---------- */
function onSetWeight(t){
  var exId=t.getAttribute("data-ex"), kind=t.getAttribute("data-kind"), w=ui.planWeek||1, ex=exById(exId)||{name:exId}, cur=db.tested[exId];
  if(kind==="gap"){
    var v=prompt("Working weight for "+ex.name+" (kg):", cur==null?"":cur);
    if(v!=null&&String(v).trim()!==""&&num(v)!=null){ db.tested[exId]=num(v); save(); renderPlan(); }
  } else if(cur==null){
    var v2=prompt("Your tested 15RM for "+ex.name+" — the weight you fail at ~15 slow reps (kg):","");
    if(v2!=null&&String(v2).trim()!==""&&num(v2)!=null){ db.tested[exId]=num(v2); save(); renderPlan(); }
  } else {
    var v3=prompt("Weight you ACTUALLY used this week (week "+w+") for "+ex.name+" (kg).\nThe whole 12-week block recomputes from this:", String(calcWeight(cur,w)));
    if(v3!=null&&String(v3).trim()!==""&&num(v3)!=null){ db.tested[exId]=Math.round(deriveTested(num(v3),w)*2)/2; save(); renderPlan(); }
  }
}
function onNote(t){
  var exId=t.getAttribute("data-ex"), ex=exById(exId)||{name:exId};
  var txt=prompt("Note for "+ex.name+" (pain, machine quirks, how it felt):","");
  if(txt!=null&&txt.trim()!==""){ db.notes.push({date:todayISO(), exerciseId:exId, text:txt.trim()}); save(); alert("Note saved — see the Log tab."); }
}

/* ---------- events ---------- */
document.addEventListener("input",function(e){
  var inp=e.target; if(!inp.getAttribute||!inp.matches||!inp.matches("[data-path]"))return;
  var path=inp.getAttribute("data-path");
  setPath(path, inp.type==="number"?(inp.value===""?null:num(inp.value)):inp.value);
  if(path==="p.maxHr") regenZones();
  save();
  if(ui.view==="nutrition") renderNutrition();
});
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act],[data-view]"); if(!t)return;
  if(t.hasAttribute("data-view")){ showView(t.getAttribute("data-view")); return; }
  var act=t.getAttribute("data-act");
  if(act==="gotoplan"||act==="prog"){ ui.planProg=t.getAttribute("data-prog"); ui.planWeek=currentWeek(ui.planProg); ui.planLastProg=ui.planProg; act==="gotoplan"?showView("programs"):renderPlan(); return; }
  if(act==="week"){ ui.planWeek=+t.getAttribute("data-week"); renderPlan(); return; }
  if(act==="weekdone"){ var pr=t.getAttribute("data-prog"), wk=+t.getAttribute("data-week"), wd=db.progress[pr].weeksDone, ix=wd.indexOf(wk); if(ix>=0)wd.splice(ix,1); else { wd.push(wk); ui.planWeek=Math.min(wk+1,TOTAL_WEEKS); } save(); renderPlan(); return; }
  if(act==="setw"){ onSetWeight(t); return; }
  if(act==="note"){ onNote(t); return; }
  if(act==="export"){ doExport(); return; }
  if(act==="import"){ $("#importFile").click(); return; }
  if(act==="reset"){ if(confirm("Erase ALL tracker data on this device?")){ localStorage.removeItem(STORE_KEY); location.reload(); } return; }
});
$("#importFile").addEventListener("change",function(ev){
  var f=ev.target.files&&ev.target.files[0]; if(!f)return;
  var rd=new FileReader(); rd.onload=function(){ try{ var d=JSON.parse(rd.result); if(d.app!=="training-tracker")throw 0; if(!confirm("Import REPLACES current data with the file. Continue?"))return; db=d; migrate(); save(); alert("Imported ✓"); location.reload(); }catch(e){ alert("Not a valid training-tracker export."); } };
  rd.readAsText(f);
});

/* ---------- init ---------- */
load();
showView("today");
