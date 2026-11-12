"use strict";
/* training-tracker — core: state (schema v3), router, events, init.
   Loads SEED_* (tracker-seed.js), the engine (tracker-engine.js), EX_DESC/EX_GIF (tracker-desc.js),
   views (tracker-views.js), the Plan (tracker-plan.js), and the actions layer (tracker-actions.js —
   modal + program switch + plan edits + export) — all BEFORE this file. Storage: localStorage `training-tracker:v1`. */

/* ---------- helpers ---------- */
function $(s,e){return (e||document).querySelector(s);}
function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function num(v){var n=parseFloat(v);return isFinite(n)?n:null;}
function todayISO(){var d=new Date();function p(n){n=String(n);return n.length<2?"0"+n:n;}return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());}
function nowISO(){return new Date().toISOString();}
/* "today" / "yesterday" / "6 days ago" / "2 wk ago" from a YYYY-MM-DD diary date */
function timeAgo(iso){var a=new Date(iso+"T00:00:00"),b=new Date(todayISO()+"T00:00:00"),d=Math.round((b-a)/86400000);return d<=0?"today":d===1?"yesterday":d<7?d+" days ago":d<14?"1 wk ago":d<70?Math.round(d/7)+" wk ago":Math.round(d/30)+" mo ago";}
function clone(o){return JSON.parse(JSON.stringify(o));}
function weekdayIdx(){var w=new Date().getDay();return w===0?6:w-1;}
function zoneRange(z){var zz=db.profile.hrZones[z];return zz?zz[0]+"–"+zz[1]+" bpm":"";}

/* ---------- state ---------- */
var db=null, ui={view:"today", planProg:null, planWeek:null, planLastProg:null, warmOpen:false, nowPrompt:null};

function seedDb(){
  return {schemaVersion:SCHEMA_VERSION, app:"training-tracker", exportedAt:null,
    profile:clone(SEED_PROFILE), exercises:clone(SEED_EXERCISES), programs:clone(SEED_DAYS),
    programLib:clone(SEED_PROGRAM_LIB), activeProgram:DEFAULT_PROGRAM_ID,
    programState:{"hsr-base-12":{startedAt:null,completedAt:null,progress:{"strength-a":{weeksDone:[]},"strength-b":{weeksDone:[]}}}},
    tested:clone(SEED_TESTED), progress:{"strength-a":{weeksDone:[]},"strength-b":{weeksDone:[]}},
    gear:{}, gearByCat:{}, bank:{}, notes:[], history:[], done:{}, sets:{}, session:null, schedule:null, dayNames:{}, logs:{}, targets:{}, body:[], maxes:[], settings:clone(SEED_SETTINGS)};
}
function migrate(){
  /* v1 → v2: add tested/progress/notes, target bodyweight; drop old logger/sessions + block-week/rest/bar settings */
  if(!db.tested) db.tested={};
  if(!db.bank) db.bank={};   /* exact carried strength per lift where it differs from the shown anchor (2026-10-01) */
  /* one-time: load the 2026-06-16 calibration-export weights, overwriting old placeholders once,
     then on later loads only fill gaps so the user's own overrides are preserved */
  if(db.settings.testedSeed!=="2026-06-16"){ for(var k in SEED_TESTED) db.tested[k]=SEED_TESTED[k]; db.bank={}; db.settings.testedSeed="2026-06-16"; }
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
  /* 2026-10-09 Upper-day swap (owner): the dumbbell press replaces the machine press, Lu raises replace the
     lateral raises. One time only: each done-tick (full or partial) is copied to the new lift so finished
     weeks keep their count; weights and diary stay with the old lifts (different exercise, different numbers). */
  if(db.settings.upperSwap!=="2026-10-09"){
    var swapTo={"chest-press":"db-chest-press","lateral-raise":"lu-raise"};
    for(var sk in db.done){ var sp=sk.split(":"), to=swapTo[sp[sp.length-1]];
      if(to){ sp[sp.length-1]=to; var nk=sp.join(":"); if(db.done[nk]===undefined) db.done[nk]=db.done[sk]; } }
    db.settings.upperSwap="2026-10-09";
  }
  /* 2026-10-13 two blended days with supersets (owner): lifts moved between Day A and Day B, and the standing
     calf raise took the seated one's slot. One time only: each lift tick (full or partial) is COPIED to the day
     where that lift now lives, same program and week, so finished weeks keep their count. Original keys stay;
     an existing tick on the new day is never overwritten; warm-ups and lifts on no day are left alone. */
  if(db.settings.supersetLayout!=="2026-10-13"){
    var homeDay={}, renamed={"calf-raise":"calf-raise-standing"};
    STRENGTH_DAYS.forEach(function(dd){ (SEED_DAYS[dd].entries||[]).forEach(function(e){ homeDay[e.exerciseId]=dd; }); });
    var adds={};
    for(var lk in db.done){ var lp=lk.split(":"); if(lp.length<4) continue;
      var item=lp.slice(3).join(":"); if(item.indexOf("wu:")===0) continue;
      var lift=renamed[item]||item, to2=homeDay[lift]; if(!to2) continue;
      if(to2===lp[1] && lift===item) continue;   /* already on its day, same lift */
      var nk2=lp[0]+":"+to2+":"+lp[2]+":"+lift; if(db.done[nk2]===undefined && adds[nk2]===undefined) adds[nk2]=db.done[lk]; }
    for(var ak in adds) db.done[ak]=adds[ak];
    db.settings.supersetLayout="2026-10-13";
  }
  /* v3 -> v4: the frozen lift diary + done ticks became "full"/"partial" (were boolean true) */
  if(!Array.isArray(db.history)) db.history=[];
  for(var dkq in db.done){ if(db.done[dkq]===true) db.done[dkq]="full"; }
  /* 2026-11-08 Day A (owner): the lift was always the dumbbell fly, so the Dumbbell Fly takes the chest press's slot. One time
     only, like the swap above: his own edited days that hold the chest press get the fly in the same place, with its pairing,
     sets and rest (the chest press's rep range goes: the fly has its own). This week's chest press, if done, moves to the fly
     on each program's day that now holds it: the done mark, the set ticks and, in a smart program, the session log, which
     carries the kg and reps he did (from his diary) so the done card reads them; marked "moved", it never sets a fly target,
     box or diary entry. The fly's target is not carried (its first set asks for a weight); the diary keeps the chest press. */
  if(db.settings.flySwap!=="2026-11-08"){
    var flyDays={"strength-a":true};
    Object.keys(db.userDays||{}).forEach(function(uk){ var u=db.userDays[uk];
      (u.entries||[]).forEach(function(e){ if(e.exerciseId==="db-chest-press"){ e.exerciseId="db-fly"; delete e.repLo; delete e.repHi; flyDays[u.id||uk]=true; } }); });
    var weekNow=function(pid,day){ var ps=db.programState[pid], wd=(ps&&ps.progress&&ps.progress[day]&&ps.progress[day].weeksDone)||[], P=SEED_PROGRAM_LIB[pid];
      return wd.length?Math.min(Math.max.apply(null,wd)+1,(P&&P.weeks)||TOTAL_WEEKS):1; };
    Object.keys(db.done).forEach(function(fk){
      var fp=fk.split(":"), pid=fp[0], day=fp[1], wk=+fp[2];
      if(fp.slice(3).join(":")!=="db-chest-press"||!flyDays[day]||wk!==weekNow(pid,day)||(db.done[fk]!=="full"&&db.done[fk]!=="partial")) return;
      var to=pid+":"+day+":"+wk+":db-fly";
      db.done[to]=db.done[fk]; delete db.done[fk];
      if(db.sets[fk]!==undefined){ db.sets[to]=db.sets[fk]; delete db.sets[fk]; }
      var L=(db.logs&&typeof db.logs==="object"&&!Array.isArray(db.logs))?db.logs:null, l=L&&L[fk];
      if(L) delete L[fk];
      if(!L||typeof isSmartProg!=="function"||!isSmartProg(pid)) return;
      var cyc=cycleOf(pid), h=null, t=db.targets&&db.targets["db-chest-press"];
      db.history.forEach(function(x){ if(x&&x.program===pid&&(x.cycle||1)===cyc&&x.day===day&&x.week===wk&&x.exId==="db-chest-press") h=x; });
      var lo=(l&&typeof l==="object")?l:{}, n=(db.sets[to]||[]).length, reps=[];
      if(h&&Array.isArray(h.done)) reps=h.done.slice();
      else for(var ri=0; ri<n; ri++) reps.push(Array.isArray(lo.reps)&&typeof lo.reps[ri]==="number"?lo.reps[ri]:(t?t.reps:null));
      var m={reps:reps, kg:(h&&typeof h.kg==="number")?h.kg:(typeof lo.kg==="number"?lo.kg:(t?t.kg:null)), date:lo.date||(h&&h.ts)||todayISO(), cy:cyc, moved:"db-chest-press"};
      if(lo.effort) m.effort=lo.effort;
      L[to]=m;
    });
    db.settings.flySwap="2026-11-08";
  }
  /* 2026-11-12 (owner, "Yes, put it back"; office decisions.md 2026-11-12): the swap above left the fly without his numbers:
     its target was not carried and the weeks before the swap stayed on the chest press, so Day A showed an empty fly. He
     always did the fly (2026-11-07). One time only, the fly gets the chest press's numbers wherever it has none of its own:
     the target (with a "Started at" line in its target history), the tested weight (the 12-week programs) and, on each day
     that holds the fly, every week's done mark, set ticks and session log (a copy marked "moved": it never sets a fly target,
     box or diary entry). Copies only: the chest press keeps its own, the diary is not changed, and nothing the fly already has
     is overwritten (a week where the fly has a mark, ticks or a log stays the fly's). */
  if(db.settings.flyRestore!=="2026-11-12"){
    var CP="db-chest-press", FLY="db-fly", flyAt={"strength-a":true}, today=todayISO();
    Object.keys(db.userDays||{}).forEach(function(uk){ var u=db.userDays[uk]; (u.entries||[]).forEach(function(e){ if(e.exerciseId===FLY) flyAt[u.id||uk]=true; }); });
    if(db.tested[FLY]==null&&typeof db.tested[CP]==="number"&&db.tested[CP]>0) db.tested[FLY]=db.tested[CP];
    var TG=(db.targets&&typeof db.targets==="object"&&!Array.isArray(db.targets))?db.targets:null, tc=TG&&TG[CP];
    if(TG&&!TG[FLY]&&tc&&typeof tc==="object"&&typeof tc.reps==="number"&&tc.reps>0&&typeof tc.kg==="number"&&isFinite(tc.kg)&&tc.kg>0){
      TG[FLY]={kg:tc.kg, reps:tc.reps, misses:0, at:today};
      if(!Array.isArray(db.targetLog)) db.targetLog=[];
      db.targetLog.push({exId:FLY, date:today, from:null, to:{kg:tc.kg, reps:tc.reps}, how:"start"});
    }
    var LG=(db.logs&&typeof db.logs==="object"&&!Array.isArray(db.logs))?db.logs:null;
    Object.keys(db.done).forEach(function(rk){
      var rp=rk.split(":"); if(rp.length<4||rp.slice(3).join(":")!==CP||!flyAt[rp[1]]||(db.done[rk]!=="full"&&db.done[rk]!=="partial")) return;
      var to=rp[0]+":"+rp[1]+":"+rp[2]+":"+FLY;
      if(db.done[to]!==undefined||db.sets[to]!==undefined||(LG&&LG[to]!==undefined)) return;
      db.done[to]=db.done[rk];
      if(Array.isArray(db.sets[rk])) db.sets[to]=db.sets[rk].slice();
      if(LG&&LG[rk]&&typeof LG[rk]==="object"&&!Array.isArray(LG[rk])){ var cl=clone(LG[rk]); cl.moved=CP; LG[to]=cl; }
    });
    db.settings.flyRestore="2026-11-12";
  }
  db.schemaVersion=SCHEMA_VERSION;
}
/* fill defaults + bring the current `db` (stored or imported) up to the schema; throws if it can't */
function normalize(){
  if(!db.profile) db.profile=clone(SEED_PROFILE);
  if(!db.settings) db.settings=clone(SEED_SETTINGS);
  for(var k in SEED_PROFILE){ if(db.profile[k]===undefined) db.profile[k]=clone(SEED_PROFILE[k]); }
  if(!Array.isArray(db.notes)) db.notes=[];                                  /* odd-but-readable files must not break a screen */
  /* version 2 (2026-11-04), additive: per-set ticks keyed like db.done, and the live session (null = none).
     Version 1 ignores both, so a v2 export still imports there. */
  if(!db.sets || typeof db.sets!=="object" || Array.isArray(db.sets)) db.sets={};
  if(db.session===undefined || (db.session!==null && typeof db.session!=="object")) db.session=null;
  /* the smart rest timer (2026-11-04) keeps each set's tick time in the session; a session saved before has none */
  if(db.session && (!db.session.ticks || typeof db.session.ticks!=="object" || Array.isArray(db.session.ticks))) db.session.ticks={};
  /* the clock control (2026-11-04, Part 1): the ticks that were on before the session began (base) and when the clock was
     stopped (stoppedAt); a session saved before has neither */
  if(db.session && db.session.base!==undefined && !(Array.isArray(db.session.base) && db.session.base.every(function(k){ return typeof k==="string"; }))) delete db.session.base;
  if(db.session && db.session.stoppedAt!==undefined && !(typeof db.session.stoppedAt==="number" && isFinite(db.session.stoppedAt))) delete db.session.stoppedAt;
  if(!db.profile.hrZones||!db.profile.hrZones.z1) regenZones();
  /* Part 2 (2026-11-04), additive: his own programs and days (tracker-editor.js), registered before migrate checks the
     active program; his days go into the day tracks after migrate rebuilds them from the seed */
  if(typeof cleanUserPrograms==="function"){ cleanUserPrograms(); syncPrograms(); }
  migrate();
  if(typeof applyDays==="function") applyDays();
  /* Part 1, additive: the week schedule (null = the original week) and the workout names (tracker-week.js). After
     migrate, which refreshes the day tracks they are checked against. Version 1 ignores both. */
  db.dayNames=cleanNames(db.dayNames);
  db.schedule=cleanSchedule(db.schedule);
  /* Part 2 (2026-11-04), additive: the smart session log (db.logs) and the targets (db.targets), tracker-smart.js.
     Version 1 ignores both. */
  if(typeof cleanSmartStores==="function") cleanSmartStores();
  /* 2026-11-11, additive: the body measurements (tracker-body.js); before the replay below, which reads the latest weight */
  if(typeof cleanBody==="function") cleanBody();
  /* 2026-11-12, additive: the real maxes he logs (tracker-progress.js); version 1 ignores them */
  if(typeof cleanMaxes==="function") cleanMaxes();
  /* the default switch to Smart HSR with his strength, weeks and ticks: once per data file (db.settings.smartSince) */
  if(typeof smartMigrate==="function") smartMigrate();
  /* Part 3 (2026-11-08): smart rule version 2 replays each lift's last session once per data file (db.settings.smartRule),
     so the rows show what he really lifted (tracker-smart-replay.js) */
  if(typeof smartRuleMigrate==="function") smartRuleMigrate();
}
function load(){
  try{var raw=localStorage.getItem(STORE_KEY); db=raw?JSON.parse(raw):seedDb();}catch(e){db=seedDb();}
  if(!db||db.app!=="training-tracker") db=seedDb();
  normalize();
}
/* write-through: every change is stored the moment it happens. (A 150 ms debounce lost the last tick
   when the phone locked, and lost a whole restore — the reload killed the timer.) */
function save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(db)); }catch(e){} }
/* his exercises, then the catalogue (Part 2: a lift built on demand from its entry, never saved) */
function exById(id){for(var i=0;i<db.exercises.length;i++)if(db.exercises[i].id===id)return db.exercises[i];return (typeof catalogExercise==="function")?catalogExercise(id):null;}

/* ---------- done-ticks (per-exercise + per warm-up move), keyed prog:week:item so each week starts fresh ---------- */
function doneKey(prog,week,item){return (db&&db.activeProgram?db.activeProgram:"hsr-base-12")+":"+prog+":"+(week||1)+":"+item;}
/* while just LOOKING at another program nothing shows as done (the ticks belong to the active one) */
function isDone(prog,week,item){return !previewing()&&!!db.done[doneKey(prog,week,item)];}
function toggleDone(prog,week,item){var k=doneKey(prog,week,item);if(db.done[k])delete db.done[k];else db.done[k]=true;save();}
function doneCount(prog,week,items){var n=0;for(var i=0;i<items.length;i++)if(isDone(prog,week,items[i]))n++;return n;}

/* ---------- program cycles: a program that has been trained starts its next run as a NEW cycle ---------- */
function cycleOf(pid){ var ps=db.programState&&db.programState[pid]; return (ps&&ps.cycle)||1; }
/* has this program been used in its current cycle — weeks marked done, ticks, or diary entries? */
function programTrained(pid){
  var ps=db.programState&&db.programState[pid], pr=(ps&&ps.progress)||{}, cyc=cycleOf(pid);
  if(((getProgram(pid).days)||STRENGTH_DAYS).some(function(d){ return ((pr[d]||{}).weeksDone||[]).length>0; })) return true;   /* its own days (Part 2: his programs) */
  for(var k in db.done){ if(k.indexOf(pid+":")===0) return true; }
  return db.history.some(function(h){ return h.program===pid&&(h.cycle||1)===cyc; });
}
function clearTicks(pid){ for(var k in db.done){ if(k.indexOf(pid+":")===0) delete db.done[k]; } for(var s in (db.sets||{})){ if(s.indexOf(pid+":")===0) delete db.sets[s]; } }

/* ---------- the frozen lift diary (schema v4): what you ACTUALLY did, by date ---------- */
/* full | partial | null for a lift or warm-up item in a given week */
function doneState(prog,week,item){if(previewing())return null;var v=db.done[doneKey(prog,week,item)];return (v==="full"||v==="partial")?v:(v?"full":null);}
/* record / refresh today's diary entry for a completed MAIN lift — kg+reps FROZEN at mark time.
   skips warm-up items and lifts with no numeric prescription (untested / hold / timed). */
function recordHistory(prog,week,exId,quality){
  if(!exId||exId.indexOf("wu:")===0) return;
  if(!progEntry(prog,exId)) return;
  /* Part 2: a smart program records the weight used and each set's reps, and works out the next session's suggestion */
  if(typeof smartActive==="function"&&smartActive()){ smartSuggestAfter(prog,week,exId,quality); recordSmartHistory(prog,week,exId,quality); save(); return; }
  var ex=exById(exId)||{}, tested=db.tested[exId]; if(tested==null) return;
  if(ex.loadType==="bodyweight") return;   /* body weight + an optional plate: no laddered kg to freeze */
  var p=ladderFor(tested,ex,getProgram(db.activeProgram),activeRateMode())[week]; if(!p||p.kg==null) return;
  var ts=todayISO(), cyc=cycleOf(db.activeProgram);
  for(var i=0;i<db.history.length;i++){ var h=db.history[i];
    if(h.program===db.activeProgram&&(h.cycle||1)===cyc&&h.day===prog&&h.week===week&&h.exId===exId){ h.ts=ts; h.kg=p.kg; h.reps=p.reps; h.quality=quality; save(); return; } }
  db.history.push({ts:ts,program:db.activeProgram,cycle:cyc,day:prog,week:week,exId:exId,kg:p.kg,reps:p.reps,quality:quality}); save();
}
/* a smart program's diary entry (tracker-smart.js smartHistoryEntry): the same keys as above, kg = the weight used,
   reps = the fewest reps of any set, plus done / effort / target (additive; version 1 reads kg × reps) */
function recordSmartHistory(prog,week,exId,quality){
  var e=smartHistoryEntry(prog,week,exId); if(!e) return;
  var ts=todayISO(), cyc=cycleOf(db.activeProgram), h=null;
  for(var i=0;i<db.history.length;i++){ var x=db.history[i]; if(x.program===db.activeProgram&&(x.cycle||1)===cyc&&x.day===prog&&x.week===week&&x.exId===exId){ h=x; break; } }
  if(!h){ h={ts:ts,program:db.activeProgram,cycle:cyc,day:prog,week:week,exId:exId}; db.history.push(h); }
  h.ts=ts; h.kg=e.kg; h.reps=e.reps; h.quality=quality; h.done=e.done; h.target=e.target;
  if(e.effort) h.effort=e.effort; else delete h.effort;
  save();
}
/* entries carry their program CYCLE (missing = 1), so a restarted program's week never touches the last run's */
function removeHistory(prog,week,exId){ var cyc=cycleOf(db.activeProgram); db.history=db.history.filter(function(h){ return !(h.program===db.activeProgram&&(h.cycle||1)===cyc&&h.day===prog&&h.week===week&&h.exId===exId); });
  if(typeof smartActive==="function"&&smartActive()) smartUnsuggest(prog,week,exId);   /* Part 2: an un-marked lift takes this session's suggestion with it */
  save(); }
/* set/clear a lift's state; full<->partial are mutually exclusive; keep the diary in sync */
function applyMark(prog,week,item,mark){
  var key=doneKey(prog,week,item);
  if(doneState(prog,week,item)===mark){ delete db.done[key]; removeHistory(prog,week,item); }
  else { db.done[key]=mark; recordHistory(prog,week,item,mark); }
  save();
}
/* diary reads for a lift: all entries oldest-first + the most recent */
function historyFor(exId){ return db.history.filter(function(h){ return h.exId===exId; }).slice().sort(function(a,b){ return a.ts<b.ts?-1:(a.ts>b.ts?1:0); }); }
function lastHistoryFor(exId){ var a=historyFor(exId); return a.length?a[a.length-1]:null; }

/* ---------- per-program progress (programState) + keep-climbing on completion ---------- */
function progStateFor(pid){ if(!db.programState[pid]) db.programState[pid]={startedAt:null,completedAt:null,progress:{}}; return db.programState[pid]; }
function progDoneArr(prog){ var ps=progStateFor(db.activeProgram); if(!ps.progress[prog]) ps.progress[prog]={weeksDone:[]}; if(!ps.progress[prog].weeksDone) ps.progress[prog].weeksDone=[]; return ps.progress[prog].weeksDone; }
/* when every day-track of the active program has all its weeks done, BANK the gains once
   (keep-climbing): the strength anchor rises so the next program starts heavier. Guarded by
   completedAt so it never double-advances. The tap-to-log override remains the correction path. */
function maybeCompleteActive(){
  var P=getProgram(db.activeProgram), ps=progStateFor(db.activeProgram); if(ps.completedAt||P.smart) return;   /* a smart program runs on: never "completed" (2026-11-11) */
  var allDone=P.days.every(function(d){ var wd=progDoneArr(d); for(var ww=1; ww<=P.weeks; ww++) if(wd.indexOf(ww)<0) return false; return true; });
  if(allDone){ ps.completedAt=nowISO(); }   /* gains now carry when you START the next program (carryFromActive) — no separate auto-bank */
}

/* ---------- router ----------
   Version 2 (2026-11-04): a bottom bar with four destinations (Today, Workout, Progress, More) and the pages
   reached from More. The v1 view ids and names stay: "programs" = Workout (the old Plan), "library" = Programs,
   "log" = Notes, "nutrition" = Fuel. The More tab stays selected while one of its pages is open. */
var VIEWS=["today","programs","progress","more","library","exercises","log","nutrition","settings","schedule","progedit"];
var MORE_PAGES=["library","exercises","log","nutrition","settings"];
/* the week schedule editor (2026-11-04) is opened from Today or from More: that tab stays selected, and its back
   control (and Android back, tracker-week.js) returns there */
function navOf(name){ if(name==="schedule") return ui.schedFrom==="today" ? "today" : "more"; if(name==="progedit") return "more"; return MORE_PAGES.indexOf(name)>=0 ? "more" : name; }
function showView(name){
  if(VIEWS.indexOf(name)<0) name="today";
  if(name==="schedule" && ui.view!=="schedule") ui.schedFrom=(ui.view==="today") ? "today" : "more";
  if(name !== "programs") clearPreview();   /* leaving the Workout auto-reverts a just-looking preview */
  ui.view=name;
  VIEWS.forEach(function(v){var el=$("#view-"+v); if(el)el.hidden=(v!==name);});
  var nav=navOf(name);
  $$(".tab").forEach(function(b){b.classList.toggle("sel",b.getAttribute("data-view")===nav);});
  if(name!=="programs"){ var nb=$("#nextBar"); if(nb){ nb.hidden=true; nb.innerHTML=""; } }   /* the Next pill lives only on the Workout */
  ({today:renderToday, programs:renderPlan, progress:renderProgress, more:renderMore, library:renderLibrary, exercises:renderExercises,
    log:renderLog, nutrition:renderNutrition, settings:renderSettings, schedule:renderSchedule, progedit:renderProgEdit}[name])();
  if(typeof onViewShown==="function") onViewShown(name);   /* the rest pill, keep-awake (tracker-session.js) */
  window.scrollTo(0,0);
}
/* the bottom bar's line icons (one icon set, ui-icons.js) */
function drawNavIcons(){ $$(".tabbar .ti[data-icon]").forEach(function(s){ s.innerHTML=icon(s.getAttribute("data-icon")); }); }

/* ---------- events ---------- */
document.addEventListener("input",function(e){
  var inp=e.target; if(!inp.getAttribute||!inp.matches||!inp.matches("[data-path]"))return;
  var path=inp.getAttribute("data-path");
  setPath(path, inp.type==="number"?(inp.value===""?null:num(inp.value)):inp.value);
  if(path==="p.maxHr"){ regenZones(); var zl=$("#view-settings .zoneList"); if(zl) zl.innerHTML=zoneRowsHtml(); }   /* zones follow the max in place (the input keeps focus) */
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
  if(act==="gotoplan"||act==="prog"){ ui.planProg=t.getAttribute("data-prog"); ui.planWeek=shownCurrentWeek(ui.planProg); ui.planLastProg=ui.planProg; act==="gotoplan"?showView("programs"):renderPlan(); return; }
  if(act==="switchprogram"){ var pid=t.getAttribute("data-prog"); if(db.programLib[pid]){ if(pid===db.activeProgram) showView("programs"); else openSwitchModal(pid); } return; }
  if(act==="previewstart"){ startTraining(t.getAttribute("data-prog")); return; }
  if(act==="previewreturn"){ clearPreview(); ui.planWeek=null; ui.planLastProg=null; renderPlan(); return; }
  if(previewing() && /^(weekdone|setw|setstep|note|donetick|partialtick|settick|setreps|effort)$/.test(act)){ toast("Start training "+shownProg().name+" first to log"); return; }
  if(typeof smartClick==="function" && smartClick(act, t)) return;   /* Part 2: the rep stepper, the effort chips (tracker-smart.js) */
  if(/^body/.test(act) && typeof bodyClick==="function" && bodyClick(act, t)) return;   /* 2026-11-11: the body measurements (tracker-body.js) */
  if(typeof editorClick==="function" && editorClick(act, t)) return;   /* Part 2: Programs and the program editor (tracker-editor.js) */
  if(/^cat/.test(act) && typeof catalogClick==="function" && catalogClick(act, t)) return;   /* Part 2: the catalogue's filters (tracker-catalog.js) */
  if(act==="setpace"){ var spp=t.getAttribute("data-prog"), spm=t.getAttribute("data-mode"); if(PROGRESSION_MODES[spm]){ progStateFor(spp).rateMode=spm; save(); renderLibrary(); } return; }
  if(act==="week"){ ui.planWeek=+t.getAttribute("data-week"); if($("#modal.open")) closeModal(); renderPlan(); return; }
  if(act==="weekdone"){ onWeekDone(t); return; }   /* v1 week-done, then the summary (tracker-session.js) */
  if(act==="weeksheet"){ openWeekSheet(); return; }
  if(act==="phaseinfo"){ openPhaseInfo(); return; }
  if(act==="settick"){ onSetTick(t); return; }
  if(act==="exsheet"){ openExSheet(t.getAttribute("data-ex"), t.getAttribute("data-sec"), t.getAttribute("data-day")); return; }
  if(act==="pic"){ openPicSheet(t.getAttribute("data-wu")); return; }
  if(act==="peek"){ var pk=t.closest(".planCard"); if(pk&&pk.classList.contains("done")) pk.classList.toggle("peek"); return; }
  if(act==="restplus"){ addRest(15); return; }
  if(act==="restminus"){ addRest(-15); return; }
  if(act==="restskip"){ skipRest(); return; }
  if(act==="restgo"){ if(ui.view!=="programs") showView("programs"); return; }
  if(act==="kpkey"){ kpPress(t.getAttribute("data-k")); return; }
  if(act==="kpdel"){ kpDel(); return; }
  if(act==="kpplus"||act==="kpminus"){ kpStep(act==="kpplus"?1:-1); return; }
  if(act==="notifyask"){ onNotifyAsk(); return; }
  if(act==="notifyallow"){ closeModal(); if(window.Native&&Native.notifyPermission) Native.notifyPermission("request").then(function(s){ if(s==="granted"&&restState()) scheduleAlert(); }); return; }
  if(act==="setw"){ onSetWeight(t); return; }
  if(act==="setstep"){ onSetStep(t); return; }
  if(act==="setcatstep"){ onSetCatStep(t); return; }
  if(act==="note"){ onNote(t); return; }
  if(act==="delnote"){ onDelNote(t); return; }
  if(act==="notefilter"){ ui.noteFilter=t.getAttribute("data-ex")||null; renderLog(); return; }
  if(act==="setbw"){ onSetBw(); return; }
  if(act==="proglift"){ ui.progLift=t.getAttribute("data-ex"); renderProgress(); return; }
  if(act==="maxlog"){ openMaxSheet(t.getAttribute("data-ex")); return; }   /* 2026-11-12: Log a real max (tracker-progress.js) */
  if(act==="maxdel"){ removeRealMax(+t.getAttribute("data-i")); return; }
  if(act==="donetick"||act==="partialtick"){ onMark(t, act==="partialtick" ? "partial" : "full"); return; }   /* in place, so the card animates its collapse (tracker-session.js) */
  if(act==="nextex"){ jumpToNext(t.getAttribute("data-ex")); return; }
  if(act==="warmcollapse"){ var dd=t.closest("details.warmSec"); if(dd){ dd.open=false; ui.warmOpen=false; if(dd.scrollIntoView) dd.scrollIntoView({block:"start"}); } return; }
  if(act==="appinfo"){ openAppSheet(); return; }
  if(act==="checknow"){ onCheckNow(t); return; }
  if(act==="apprestart"){ appRestart(); return; }
  /* Part 1 (2026-11-04): the workout clock, the week schedule editor, renaming a workout */
  if(act==="clocksheet"){ openClockSheet(); return; }
  if(act==="sessstart"){ startSessionNow(); return; }   /* 2026-11-12: the Start session button (tracker-session.js) */
  if(act==="clockstop"){ stopClock(); return; }
  if(act==="clockreset"){ resetClock(); return; }
  if(act==="schedday"){ openDaySheet(+t.getAttribute("data-day")); return; }
  if(act==="schedset"){ setDayChoice(+t.getAttribute("data-day"), t.getAttribute("data-choice")); return; }
  if(act==="schedhome"){ setDayHome(+t.getAttribute("data-day"), t.getAttribute("data-home")); return; }
  if(act==="schedreset"){ resetWeek(); return; }
  if(act==="rename"){ openRename(t.getAttribute("data-prog")); return; }
  if(act==="renamereset"){ var rp=t.getAttribute("data-prog"); closeModal(); saveDayName(rp, ""); return; }
  if(act==="export"){ doExport(); return; }
  if(act==="import"){ $("#importFile").click(); return; }
  if(act==="reset"){ confirmModal("Erase all data?", "This wipes everything saved on this device. Export first if you want a backup.", function(){ localStorage.removeItem(STORE_KEY); location.reload(); }); return; }
});
/* Enter in a one-line sheet field (the rename sheet) saves, as its Save button does */
document.addEventListener("keydown",function(e){
  var f=e.target; if(e.key!=="Enter"||e.isComposing||!f||f.id!=="mText"||f.tagName!=="INPUT") return;   /* not while a keyboard is still composing a word */
  e.preventDefault(); modalSubmit(f.value);
});
$("#importFile").addEventListener("change",function(ev){
  var f=ev.target.files&&ev.target.files[0]; if(!f)return;
  var rd=new FileReader(); rd.onload=function(){ var d; try{ d=JSON.parse(rd.result); if(d.app!=="training-tracker")throw 0; }catch(e){ toast("Not a valid training-tracker export."); return; } confirmModal("Replace all data?", "Importing overwrites what's on this device with the file's contents.", function(){
      var prev=db;   /* bring the file up to date IN MEMORY first — a file the app can't use changes nothing */
      try{ db=d; normalize(); }catch(err){ db=prev; if(typeof syncPrograms==="function"){ syncPrograms(); applyDays(); } toast("That backup can't be read — nothing was changed."); return; }
      save(); location.reload(); }); };
  rd.readAsText(f);
});

/* ---------- init ---------- */
load();
drawNavIcons();
sessionInit();
showView("today");
