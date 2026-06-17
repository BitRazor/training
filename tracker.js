"use strict";
/* training-tracker — core: state, persistence, router, rest timer, events, init.
   Loads SEED_* (tracker-seed.js) and the view renderers (tracker-views.js) — both BEFORE this file.
   Schema contract: tracking/data-schema.md. Storage: localStorage `training-tracker:v1`. */

/* ---------- helpers ---------- */
function $(s,e){return (e||document).querySelector(s);}
function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function num(v){var n=parseFloat(v);return isFinite(n)?n:null;}
function r1(x){return Math.round(x*10)/10;}
function pad2(n){n=String(n);return n.length<2?"0"+n:n;}
function todayISO(){var d=new Date();return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());}
function nowISO(){return new Date().toISOString();}
function uuid(){return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==="x"?r:(r&0x3|0x8)).toString(16);});}
function e1rm(w,r){return (w>0&&r>0)?w*(1+r/30):null;}
function clone(o){return JSON.parse(JSON.stringify(o));}

/* ---------- state ---------- */
var db=null, draft=null, ui={view:"today", histEx:null, planWeek:null};
var DRAFT_KEY="training-tracker:draft:v1";

function seedDb(){
  return {schemaVersion:SCHEMA_VERSION, app:"training-tracker", exportedAt:null,
    profile:clone(SEED_PROFILE), exercises:clone(SEED_EXERCISES), programs:clone(SEED_PROGRAMS),
    sessions:[], metrics:[], nutritionLog:[], settings:clone(SEED_SETTINGS)};
}
function load(){
  try{var raw=localStorage.getItem(STORE_KEY); db=raw?JSON.parse(raw):seedDb();}catch(e){db=seedDb();}
  if(!db||db.app!=="training-tracker")db=seedDb();
  migrate();
  if(!db.exercises||!db.exercises.length)db.exercises=clone(SEED_EXERCISES);
  if(!db.programs||!Object.keys(db.programs).length)db.programs=clone(SEED_PROGRAMS);
  if(!db.settings)db.settings=clone(SEED_SETTINGS);
  for(var k in SEED_SETTINGS){if(db.settings[k]===undefined)db.settings[k]=clone(SEED_SETTINGS[k]);}
  if(!db.sessions)db.sessions=[]; if(!db.metrics)db.metrics=[]; if(!db.nutritionLog)db.nutritionLog=[];
  try{var d=localStorage.getItem(DRAFT_KEY);draft=d?JSON.parse(d):null;}catch(e){draft=null;}
}
function migrate(){ /* forward migrations when SCHEMA_VERSION bumps; never silently drop fields */ db.schemaVersion=SCHEMA_VERSION; }
var saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(function(){try{localStorage.setItem(STORE_KEY,JSON.stringify(db));}catch(e){}},150);}
function saveDraft(){try{draft?localStorage.setItem(DRAFT_KEY,JSON.stringify(draft)):localStorage.removeItem(DRAFT_KEY);}catch(e){}}
function exById(id){for(var i=0;i<db.exercises.length;i++)if(db.exercises[i].id===id)return db.exercises[i];return null;}

/* ---------- date / week helpers ---------- */
function weekdayIdx(){var w=new Date().getDay();return w===0?6:w-1;} /* Mon=0 … Sun=6 */
function weekBounds(){var d=new Date(),diff=(d.getDay()===0?6:d.getDay()-1);var mon=new Date(d);mon.setDate(d.getDate()-diff);mon.setHours(0,0,0,0);var sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);return [mon,sun];}
function weekAdherence(){
  var b=weekBounds(), planned=CURRENT_WEEK.filter(function(d){return d.type!=="rest";}).length, byDay=[0,0,0,0,0,0,0], done=0;
  db.sessions.forEach(function(s){var dt=new Date(s.date+"T12:00:00");if(dt>=b[0]&&dt<=b[1]){byDay[(dt.getDay()===0?6:dt.getDay()-1)]=1;}});
  byDay.forEach(function(v){if(v)done++;});
  return {planned:planned, done:done, byDay:byDay};
}
function zoneRange(z){var zz=db.profile.hrZones[z];return zz?zz[0]+"–"+zz[1]+" bpm":"";}

/* ---------- router (render* live in tracker-views.js) ---------- */
var VIEWS=["today","log","history","programs","nutrition","settings"];
function showView(name){
  ui.view=name;
  VIEWS.forEach(function(v){$("#view-"+v).hidden=(v!==name);});
  $$(".tab").forEach(function(b){b.classList.toggle("sel",b.getAttribute("data-view")===name);});
  ({today:renderToday, log:renderLog, history:renderHistory, programs:renderPlan, nutrition:renderNutrition, settings:renderSettings}[name])();
  window.scrollTo(0,0);
}

/* ---------- data export ---------- */
function doExport(){
  db.exportedAt=nowISO(); db.settings.lastExportAt=db.exportedAt; save();
  var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
  a.download="training-export-"+todayISO()+".json"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
}

/* ---------- rest timer ---------- */
var restT=null, restLeft=0, AC=null;
function beep(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.25,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.3);o.start();o.stop(AC.currentTime+.3);}catch(e){}}
function paintRest(){var d=$("#restDisp"),L=Math.max(restLeft,0);d.firstChild.nodeValue=Math.floor(L/60)+":"+pad2(L%60);}
function startRest(sec){restLeft=sec||db.settings.restTimerDefaultSec||120;$("#restBar").hidden=false;paintRest();clearInterval(restT);restT=setInterval(function(){restLeft--;paintRest();if(restLeft<=0){clearInterval(restT);restT=null;var d=$("#restDisp");d.classList.add("flash");try{if(navigator.vibrate)navigator.vibrate([300,120,300]);}catch(e){}beep();setTimeout(function(){d.classList.remove("flash");$("#restBar").hidden=true;},2500);}},1000);}
function stopRest(){clearInterval(restT);restT=null;$("#restBar").hidden=true;}

/* ---------- events ---------- */
document.addEventListener("input",function(e){
  var inp=e.target; if(!inp.getAttribute)return;
  if(inp.matches&&inp.matches(".setRow input[data-f]")&&draft){
    var block=inp.closest(".exBlock"), row=inp.closest(".setRow"), ei=+block.getAttribute("data-ei"), si=+row.getAttribute("data-si");
    draft.entries[ei].sets[si][inp.getAttribute("data-f")]=(inp.value===""?null:num(inp.value)); saveDraft(); return;
  }
  if(inp.matches&&inp.matches("[data-path]")){
    var path=inp.getAttribute("data-path");
    setPath(path, inp.type==="number"?(inp.value===""?null:num(inp.value)):inp.value);
    if(path==="p.maxHr"){regenZones();}
    save(); return;
  }
});
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.matches&&t.matches("select[data-act=exsel]")&&draft){var ei=+t.closest(".exBlock").getAttribute("data-ei");draft.entries[ei].exerciseId=t.value;var ex=exById(t.value);draft.entries[ei].mode=ex?ex.loadType:"external";saveDraft();renderLog();return;}
  if(t.id==="histExSel"){ui.histEx=t.value;renderHistory();return;}
});
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act],[data-view]"); if(!t)return;
  if(t.hasAttribute("data-view")){showView(t.getAttribute("data-view"));return;}
  var act=t.getAttribute("data-act");
  if(act==="startlog"){startLog(t.getAttribute("data-ref"));return;}
  if(act==="adhoc"){draft={programRef:null,date:todayISO(),startedAt:nowISO(),entries:[]};saveDraft();addExercise();return;}
  if(act==="export"){doExport();return;}
  if(act==="import"){$("#importFile").click();return;}
  if(act==="reset"){if(confirm("Erase ALL tracker data on this device?")){localStorage.removeItem(STORE_KEY);localStorage.removeItem(DRAFT_KEY);location.reload();}return;}
  if(act==="addex"){addExercise();return;}
  if(act==="finish"){finishSession();return;}
  if(act==="discard"){if(confirm("Discard this unsaved session?")){draft=null;saveDraft();showView("today");}return;}
  if(act==="week"){ui.planWeek=+t.getAttribute("data-week"); renderPlan(); return;}
  if(act==="weekdone"){
    var wk=+t.getAttribute("data-week"); if(!db.settings.weeksDone)db.settings.weeksDone=[];
    var wd=db.settings.weeksDone, ix=wd.indexOf(wk);
    if(ix>=0){wd.splice(ix,1);} else {wd.push(wk); if((db.settings.blockPhaseWeek||1)<=wk && wk<TOTAL_WEEKS)db.settings.blockPhaseWeek=wk+1; ui.planWeek=Math.min(wk+1,TOTAL_WEEKS);}
    save(); renderPlan(); return;
  }
  var blk=t.closest(".exBlock"); if(!blk||!draft)return; var ei=+blk.getAttribute("data-ei"), en=draft.entries[ei];
  if(act==="done"){var si=+t.closest(".setRow").getAttribute("data-si"),st=en.sets[si];st.completed=!st.completed;if(st.completed)startRest(en.restSec);saveDraft();renderLog();return;}
  if(act==="rpe"){var si2=+t.closest(".setRow").getAttribute("data-si");en.sets[si2].rpe=cycleRpe(en.sets[si2].rpe);t.textContent=en.sets[si2].rpe==null?"–":en.sets[si2].rpe;saveDraft();return;}
  if(act==="addset"){var lastS=en.sets[en.sets.length-1]||{};en.sets.push({set:en.sets.length+1,reps:lastS.reps||null,weightKg:lastS.weightKg||null,durationSec:lastS.durationSec||null,rpe:null,completed:false});saveDraft();renderLog();return;}
  if(act==="rmex"){draft.entries.splice(ei,1);saveDraft();renderLog();return;}
  if(act==="plate"){showPlate(ei);return;}
});
$("#importFile").addEventListener("change",function(ev){
  var f=ev.target.files&&ev.target.files[0]; if(!f)return;
  var rd=new FileReader(); rd.onload=function(){try{var d=JSON.parse(rd.result);if(d.app!=="training-tracker")throw 0;if(!confirm("Import REPLACES current data with the file. Continue?"))return;db=d;migrate();save();alert("Imported ✓");location.reload();}catch(e){alert("Not a valid training-tracker export.");}};
  rd.readAsText(f);
});
$("#restStop").addEventListener("click",stopRest);
$("#restPlus").addEventListener("click",function(){restLeft+=15;if($("#restBar").hidden){$("#restBar").hidden=false;}paintRest();if(!restT)startRest(restLeft);});
$("#restMinus").addEventListener("click",function(){restLeft=Math.max(0,restLeft-15);paintRest();});

/* ---------- init ---------- */
load();
showView("today");
