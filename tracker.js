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
var db=null, ui={view:"today", planProg:null, planWeek:null, planLastProg:null, warmOpen:false};

function seedDb(){
  return {schemaVersion:SCHEMA_VERSION, app:"training-tracker", exportedAt:null,
    profile:clone(SEED_PROFILE), exercises:clone(SEED_EXERCISES), programs:clone(SEED_DAYS),
    programLib:clone(SEED_PROGRAM_LIB), activeProgram:DEFAULT_PROGRAM_ID,
    programState:{"hsr-base-12":{startedAt:null,completedAt:null,progress:{"strength-a":{weeksDone:[]},"strength-b":{weeksDone:[]}}}},
    tested:clone(SEED_TESTED), progress:{"strength-a":{weeksDone:[]},"strength-b":{weeksDone:[]}},
    gear:{}, gearByCat:{}, notes:[], done:{}, settings:clone(SEED_SETTINGS)};
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
  if(!db.done) db.done={};   /* per-exercise + warm-up done-ticks, keyed activeProgram:day:week:item */
  if(!db.gear) db.gear={};         /* per-exercise weight-step overrides (gym-fact, shared across programs) */
  if(!db.gearByCat) db.gearByCat={}; /* per-equipment-category weight-step overrides */
  if(db.profile && db.profile.targetBodyweightKg==null && db.profile.bodyweightKg!=null) db.profile.targetBodyweightKg=db.profile.bodyweightKg;
  /* ---- v2 -> v3: PROGRAM PLATFORM ----
     Library + active program are reseeded every load (static design). One-time (guarded by
     platformMigrated): wrap the existing single-program progress + done-ticks under "hsr-base-12"
     so nothing the user has logged is lost. */
  db.programLib=clone(SEED_PROGRAM_LIB);
  if(!db.activeProgram || !db.programLib[db.activeProgram]) db.activeProgram=DEFAULT_PROGRAM_ID;
  if(!db.programState) db.programState={};
  if(db.settings.platformMigrated!=="2026-06-24"){
    if(!db.programState[DEFAULT_PROGRAM_ID]) db.programState[DEFAULT_PROGRAM_ID]={startedAt:null,completedAt:null,progress:clone(db.progress)};
    var migrated={};   /* prefix every legacy done-key with the base program id (idempotent: skip keys already program-scoped) */
    for(var dk in db.done){ if(PROGRAM_ORDER.indexOf(dk.split(":")[0])>=0) migrated[dk]=db.done[dk]; else migrated[DEFAULT_PROGRAM_ID+":"+dk]=db.done[dk]; }
    db.done=migrated;
    db.settings.platformMigrated="2026-06-24";
  }
  /* every program in the library gets a state slot with both day-tracks */
  PROGRAM_ORDER.forEach(function(pid){
    if(!db.programState[pid]) db.programState[pid]={startedAt:null,completedAt:null,progress:{}};
    STRENGTH_DAYS.forEach(function(d){ if(!db.programState[pid].progress[d]) db.programState[pid].progress[d]={weeksDone:[]}; if(!db.programState[pid].progress[d].weeksDone) db.programState[pid].progress[d].weeksDone=[]; });
  });
  /* embedded design always refreshed to the current seed */
  db.exercises=clone(SEED_EXERCISES); db.programs=clone(SEED_DAYS);
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

/* ---------- done-ticks (per-exercise + per warm-up move), keyed prog:week:item so each week starts fresh ---------- */
function doneKey(prog,week,item){return (db&&db.activeProgram?db.activeProgram:"hsr-base-12")+":"+prog+":"+(week||1)+":"+item;}
function isDone(prog,week,item){return !!db.done[doneKey(prog,week,item)];}
function toggleDone(prog,week,item){var k=doneKey(prog,week,item);if(db.done[k])delete db.done[k];else db.done[k]=true;save();}
function doneCount(prog,week,items){var n=0;for(var i=0;i<items.length;i++)if(isDone(prog,week,items[i]))n++;return n;}

/* ---------- per-program progress (programState) + keep-climbing on completion ---------- */
function progStateFor(pid){ if(!db.programState[pid]) db.programState[pid]={startedAt:null,completedAt:null,progress:{}}; return db.programState[pid]; }
function progDoneArr(prog){ var ps=progStateFor(db.activeProgram); if(!ps.progress[prog]) ps.progress[prog]={weeksDone:[]}; if(!ps.progress[prog].weeksDone) ps.progress[prog].weeksDone=[]; return ps.progress[prog].weeksDone; }
/* when every day-track of the active program has all its weeks done, BANK the gains once
   (keep-climbing): the strength anchor rises so the next program starts heavier. Guarded by
   completedAt so it never double-advances. The tap-to-log override remains the correction path. */
function maybeCompleteActive(){
  var P=getProgram(db.activeProgram), ps=progStateFor(db.activeProgram); if(ps.completedAt) return;
  var allDone=P.days.every(function(d){ var wd=progDoneArr(d); for(var ww=1; ww<=P.weeks; ww++) if(wd.indexOf(ww)<0) return false; return true; });
  if(allDone){ ps.completedAt=nowISO(); for(var id in db.tested){ if(db.tested[id]!=null) db.tested[id]=advanceBank(db.tested[id], P); } }
}

/* ---------- router (5 views; Plan renders into #view-programs) ---------- */
var VIEWS=["today","programs","library","log","nutrition","settings"];
function showView(name){
  ui.view=name;
  VIEWS.forEach(function(v){var el=$("#view-"+v); if(el)el.hidden=(v!==name);});
  $$(".tab").forEach(function(b){b.classList.toggle("sel",b.getAttribute("data-view")===name);});
  ({today:renderToday, programs:renderPlan, library:renderLibrary, log:renderLog, nutrition:renderNutrition, settings:renderSettings}[name])();
  window.scrollTo(0,0);
}

/* ---------- export / import ---------- */
function doExport(){
  db.exportedAt=nowISO(); db.settings.lastExportAt=db.exportedAt; save();
  var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
  a.download="training-export-"+todayISO()+".json"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
}

/* ---------- in-app modal (replaces the browser's native prompt / confirm / alert) ---------- */
var modalState = null;
function openModal(o){
  modalState = { onSubmit: o.onSubmit };
  var body = "";
  if(o.mode === "chips"){
    body = '<div class="mChips">' + (o.chips||[]).map(function(c){ return '<button class="mChip" data-act="modalchip" data-val="' + esc(String(c.value)) + '">' + esc(c.label) + '</button>'; }).join("") +
      '<button class="mChip alt" data-act="modalcustom">Custom…</button></div>' +
      '<div class="mCustom" hidden><input type="number" class="mInput" id="mNum" inputmode="decimal" step="any" placeholder="kg"><button class="btn primary sm" data-act="modalok">Set</button></div>';
  } else if(o.mode === "text"){
    body = '<textarea class="mInput mArea" id="mText" placeholder="' + esc(o.placeholder||"") + '">' + esc(o.value||"") + '</textarea>';
  } else if(o.mode === "number"){
    body = '<input type="number" class="mInput" id="mNum" inputmode="decimal" step="any" value="' + esc(o.value==null?"":o.value) + '" placeholder="' + esc(o.placeholder||"kg") + '">';
  }
  var ok = (o.mode === "chips") ? "" : '<button class="btn primary" data-act="modalok">' + esc(o.okLabel||"Save") + '</button>';
  $("#modal").innerHTML = '<div class="mBack" data-act="modalcancel"></div><div class="mCard">' +
    '<div class="mTitle">' + esc(o.title||"") + '</div>' + (o.message ? '<div class="mMsg">' + esc(o.message) + '</div>' : "") +
    body + '<div class="mActions"><button class="btn ghost" data-act="modalcancel">Cancel</button>' + ok + '</div></div>';
  $("#modal").classList.add("open");
  setTimeout(function(){ var f = $("#mText") || (o.mode==="number" ? $("#mNum") : null); if(f && f.focus) f.focus(); }, 60);
}
function closeModal(){ var m=$("#modal"); if(m){ m.classList.remove("open"); m.innerHTML=""; } modalState=null; }
function modalSubmit(v){ var fn = modalState && modalState.onSubmit; closeModal(); if(fn) fn(v); }
function confirmModal(title, message, onYes){ openModal({ title:title, message:message, okLabel:"Yes, do it", onSubmit:function(){ onYes(); } }); }
function toast(msg){ var d=document.createElement("div"); d.className="toast"; d.textContent=msg; document.body.appendChild(d);
  setTimeout(function(){ d.classList.add("show"); }, 10);
  setTimeout(function(){ d.classList.remove("show"); setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 300); }, 1800); }

/* ---------- plan actions ---------- */
function onSetWeight(t){
  var exId=t.getAttribute("data-ex"), w=ui.planWeek||1, ex=exById(exId)||{name:exId}, cur=db.tested[exId];
  if(cur==null){
    openModal({ title:"Tested 15RM · "+ex.name, message:"The weight you fail at ~15 slow reps (kg).", mode:"number", placeholder:"kg",
      onSubmit:function(v){ if(v!=null&&String(v).trim()!==""&&num(v)!=null){ db.tested[exId]=Math.round(num(v)*4)/4; save(); renderPlan(); } } });
    return;
  }
  /* rescale the anchor from what you ACTUALLY lifted this week — the whole block re-derives from the
     SAME formula (ladderFor). Round to 0.25 kg. */
  var planW=(ladderFor(cur, ex, getProgram(db.activeProgram))[w]||{}).kg;
  openModal({ title:"Actual weight · "+ex.name+" · wk "+w, message:"What you really lifted (kg). The whole block recalculates from this.", mode:"number", value:String(planW), placeholder:"kg",
    onSubmit:function(v){ if(v!=null&&String(v).trim()!==""&&num(v)!=null&&planW){ db.tested[exId]=Math.round((cur*num(v)/planW)*4)/4; save(); renderPlan(); } } });
}
/* edit ONE lift's weight step (the card chip). number = fixed kg · "db" = dumbbell grid · blank = reset */
function onSetStep(t){
  var exId=t.getAttribute("data-ex"), ex=exById(exId)||{name:exId};
  openModal({ title:"Weight step · "+ex.name, message:"Smallest jump your gear allows — tap one, or Custom.", mode:"chips",
    chips:[{label:"1.25 kg",value:"1.25"},{label:"2.5 kg",value:"2.5"},{label:"5 kg",value:"5"},{label:"10 kg",value:"10"},{label:"DB grid",value:"db"},{label:"Reset",value:""}],
    onSubmit:function(v){ v=String(v==null?"":v).trim().toLowerCase();
      if(v===""){ delete db.gear[exId]; } else if(v==="db"){ db.gear[exId]={equip:"db"}; }
      else { var n=num(v); if(n==null||n<=0) return; db.gear[exId]={inc:Math.round(n*100)/100}; }
      save(); renderPlan(); } });
}
/* edit a whole CATEGORY's step (Settings). Applies to every lift in the category unless that lift
   has its own per-card override. */
function onSetCatStep(t){
  var cat=t.getAttribute("data-cat"), c=EQUIP_CATS[cat]; if(!c) return;
  openModal({ title:"Weight step · "+c.label, message:"Applies to every "+c.label+" lift. (A lift set on its own card keeps its value.)", mode:"chips",
    chips:[{label:"1.25 kg",value:"1.25"},{label:"2.5 kg",value:"2.5"},{label:"5 kg",value:"5"},{label:"10 kg",value:"10"},{label:"DB grid",value:"db"},{label:"Reset",value:""}],
    onSubmit:function(v){ v=String(v==null?"":v).trim().toLowerCase();
      if(v===""){ delete db.gearByCat[cat]; } else if(v==="db"){ db.gearByCat[cat]={equip:"db"}; }
      else { var n=num(v); if(n==null||n<=0) return; db.gearByCat[cat]={inc:Math.round(n*100)/100}; }
      save(); renderSettings(); } });
}
function onNote(t){
  var exId=t.getAttribute("data-ex"), ex=exById(exId)||{name:exId};
  openModal({ title:"Note · "+ex.name, message:"Pain, machine quirks, how it felt — saved with the week & weight.", mode:"text", placeholder:"e.g. left knee niggle on set 3, gone next morning",
    onSubmit:function(txt){ if(txt==null||txt.trim()==="") return;
      /* auto-stamp the week + the prescribed weight at the moment of the note, as its own record */
      var prog=ui.planProg||todayProgram()||"strength-a", week=ui.planWeek||1;
      var en=progEntry(prog,exId), pr=en?prescFor(en,week):null;
      var weight=(pr&&pr.weight!=null)?(pr.weight+" kg"):((pr&&pr.kind==="timed")?"timed":"");
      db.notes.push({date:todayISO(), week:week, exerciseId:exId, weight:weight, text:txt.trim()});
      save(); toast("Note saved ✓"); } });
}
function onDelNote(t){
  var idx=+t.getAttribute("data-idx");
  if(!isNaN(idx)&&idx>=0&&idx<db.notes.length){ db.notes.splice(idx,1); save(); renderLog(); }
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
  if(act==="modalchip"){ modalSubmit(t.getAttribute("data-val")); return; }
  if(act==="modalcustom"){ var cu=$(".mCustom"); if(cu){ cu.hidden=false; var ni=$("#mNum"); if(ni&&ni.focus) ni.focus(); } return; }
  if(act==="modalok"){ var mi=$("#mText")||$("#mNum"); modalSubmit(mi?mi.value:undefined); return; }
  if(act==="modalcancel"){ closeModal(); return; }
  if(act==="gotoplan"||act==="prog"){ ui.planProg=t.getAttribute("data-prog"); ui.planWeek=currentWeek(ui.planProg); ui.planLastProg=ui.planProg; act==="gotoplan"?showView("programs"):renderPlan(); return; }
  if(act==="switchprogram"){ var pid=t.getAttribute("data-prog"); if(db.programLib[pid]){ db.activeProgram=pid; var ps=db.programState[pid]; if(ps&&!ps.startedAt) ps.startedAt=nowISO(); ui.planWeek=null; ui.planLastProg=null; save(); renderLibrary(); } return; }
  if(act==="week"){ ui.planWeek=+t.getAttribute("data-week"); renderPlan(); return; }
  if(act==="weekdone"){ var pr=t.getAttribute("data-prog"), wk=+t.getAttribute("data-week"), wd=progDoneArr(pr), ix=wd.indexOf(wk); if(ix>=0)wd.splice(ix,1); else { wd.push(wk); ui.planWeek=Math.min(wk+1,getProgram(db.activeProgram).weeks); maybeCompleteActive(); } save(); renderPlan(); return; }
  if(act==="setw"){ onSetWeight(t); return; }
  if(act==="setstep"){ onSetStep(t); return; }
  if(act==="setcatstep"){ onSetCatStep(t); return; }
  if(act==="note"){ onNote(t); return; }
  if(act==="delnote"){ onDelNote(t); return; }
  if(act==="donetick"){
    var dp=t.getAttribute("data-prog"), dw=+t.getAttribute("data-week"), di=t.getAttribute("data-item");
    toggleDone(dp,dw,di);
    var on=isDone(dp,dw,di), c=t.closest(".planCard")||t.closest(".wuCard");
    if(c){ c.classList.toggle("done", on); t.classList.toggle("on", on); }   /* in-place so the card animates its collapse */
    updateDoneCounts(dp,dw);
    return;
  }
  if(act==="warmcollapse"){ var dd=t.closest("details.warmSec"); if(dd){ dd.open=false; ui.warmOpen=false; if(dd.scrollIntoView) dd.scrollIntoView({block:"start"}); } return; }
  if(act==="export"){ doExport(); return; }
  if(act==="import"){ $("#importFile").click(); return; }
  if(act==="reset"){ confirmModal("Erase all data?", "This wipes everything saved on this device. Export first if you want a backup.", function(){ localStorage.removeItem(STORE_KEY); location.reload(); }); return; }
});
$("#importFile").addEventListener("change",function(ev){
  var f=ev.target.files&&ev.target.files[0]; if(!f)return;
  var rd=new FileReader(); rd.onload=function(){ var d; try{ d=JSON.parse(rd.result); if(d.app!=="training-tracker")throw 0; }catch(e){ toast("Not a valid training-tracker export."); return; } confirmModal("Replace all data?", "Importing overwrites what's on this device with the file's contents.", function(){ db=d; migrate(); save(); location.reload(); }); };
  rd.readAsText(f);
});

/* ---------- init ---------- */
load();
showView("today");
