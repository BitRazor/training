"use strict";
/* training-tracker — view renderers (Today, Logger, History, Programs, Nutrition, Settings).
   Loaded after tracker-seed.js, before tracker.js (which owns state, router, events, init).
   Uses globals from those files: db, draft, ui, $, esc, exById, e1rm, r1, phaseForWeek, etc. */

/* ---------- TODAY ---------- */
function renderToday(){
  var i=weekdayIdx(), today=CURRENT_WEEK[i], phase=phaseForWeek(db.settings.blockPhaseWeek), adher=weekAdherence();
  var h='<div class="todayHero"><div class="todayDay">'+today.day+' · Week '+db.settings.blockPhaseWeek+' · '+esc(phase.phase)+'</div>'
    +'<div class="todayTitle">'+esc(today.label)+'</div><div class="todayNote">'+esc(today.note)+'</div>';
  if(today.type==="strength"){
    var prog=db.programs[today.ref], has=draft&&draft.programRef===today.ref;
    h+='<div class="btnRow"><button class="btn primary block" data-act="startlog" data-ref="'+today.ref+'">'+(has?"Resume logging":"Start "+esc(prog.name))+'</button></div>';
  } else if(today.type==="cardio"||today.type==="hiit"){
    h+='<div class="warnBox">'+(today.type==="hiit"?"Norwegian 4×4 — log reserved (v2). Watch peak HR on the last interval.":"Zone 2 "+zoneRange("z2")+" — log reserved (v2).")+'</div>';
  } else { h+='<div class="todayNote dim">Rest day — nothing to log. Recover.</div>'; }
  h+='</div>';
  h+='<div class="sectH">This week · '+adher.done+'/'+adher.planned+' sessions</div><div class="adher">'
    +CURRENT_WEEK.map(function(d,j){return '<i class="'+(adher.byDay[j]?"done":"")+'"></i>';}).join("")+'</div>';
  h+='<div class="card weekList">'+CURRENT_WEEK.map(function(d,j){
    return '<div class="wrow'+(j===i?" today":"")+'"><span class="wd">'+d.day+'</span><span class="dot '+d.type+'"></span><span class="wt">'+esc(d.label)+'</span></div>';
  }).join("")+'</div>';
  $("#headMeta").innerHTML=(db.profile.bodyweightKg?db.profile.bodyweightKg+" kg":'<span class="dim">set BW</span>')+' · '+adher.done+'/'+adher.planned;
  $("#view-today").innerHTML=h;
}

/* ---------- LOGGER ---------- */
function lastSession(exId){for(var i=db.sessions.length-1;i>=0;i--){var s=db.sessions[i];for(var j=0;j<s.entries.length;j++)if(s.entries[j].exerciseId===exId)return {session:s,entry:s.entries[j]};}return null;}
function lastTopSet(exId){var ls=lastSession(exId);if(!ls)return null;var best=null;ls.entry.sets.forEach(function(st){if(st.weightKg!=null&&(!best||st.weightKg>best.weightKg))best=st;});return best;}
function startLog(ref){
  if(!(draft&&draft.programRef===ref)){
    var prog=db.programs[ref];
    draft={programRef:ref, date:todayISO(), startedAt:nowISO(), entries:prog.entries.map(function(en){
      var ex=exById(en.exerciseId)||{}, last=lastTopSet(en.exerciseId), sets=[];
      var wr=repsForEntryWeek(en, db.settings.blockPhaseWeek), rep0=(typeof wr==="number"?wr:null);
      for(var s=1;s<=en.sets;s++)sets.push({set:s, reps:rep0, weightKg:(last?last.weightKg:null), durationSec:null, rpe:null, completed:false});
      return {exerciseId:en.exerciseId, block:en.block, mode:ex.loadType||"external", restSec:en.restSec, sets:sets};
    })};
    saveDraft();
  }
  showView("log");
}
function modeFields(mode){
  if(mode==="timed")return {f1:"durationSec",f2:"reps",p1:"sec",p2:"/side",l1:"sec",l2:"side"};
  if(mode==="carry")return {f1:"weightKg",f2:"durationSec",p1:"kg",p2:"sec",l1:"weight",l2:"sec"};
  return {f1:"weightKg",f2:"reps",p1:"kg",p2:"reps",l1:"weight",l2:"reps"};
}
function setShort(st,mode){
  if(mode==="timed")return (st.durationSec||"?")+"s"+(st.reps?"×"+st.reps:"");
  if(mode==="carry")return (st.weightKg||"?")+"kg·"+(st.durationSec||"?")+"s";
  return (st.weightKg||"?")+"×"+(st.reps||"?");
}
function repForEntry(en){
  var p=db.programs[draft.programRef], pe=null, i;
  if(p)for(i=0;i<p.entries.length;i++)if(p.entries[i].exerciseId===en.exerciseId)pe=p.entries[i];
  if(!pe)return "–";
  var r=repsForEntryWeek(pe, db.settings.blockPhaseWeek);
  return r==null?"hold":r;
}
function exBlockHtml(en,ei){
  var ex=exById(en.exerciseId)||{name:en.exerciseId,defaultUnit:"kg",pattern:""}, mf=modeFields(en.mode);
  var ls=lastSession(en.exerciseId), lastStr=ls?ls.entry.sets.filter(function(s){return s.completed||s.weightKg!=null||s.durationSec!=null;}).map(function(s){return setShort(s,en.mode);}).join(", "):"";
  var h='<div class="exBlock" data-ei="'+ei+'"><div class="exTop">'
    +(en.adhoc?'<select class="field" data-act="exsel" style="width:100%;font-size:15px;padding:8px 10px">'+db.exercises.map(function(x){return '<option value="'+x.id+'"'+(x.id===en.exerciseId?" selected":"")+'>'+esc(x.name)+'</option>';}).join("")+'</select>':'<div class="exName">'+esc(ex.name)+'</div>')
    +'<div class="exMeta">'+esc(ex.pattern||"")+' · '+esc(en.block||"extra")+' · target '+(en.mode==="timed"?"hold":(en.sets.length+"×"+(en.adhoc?"–":repForEntry(en))))+'</div>'
    +(lastStr?'<div class="lastTime">last: '+esc(lastStr)+'</div>':'<div class="lastTime dim">no prior data</div>')+'</div>';
  h+=gifHtml(en.exerciseId)+howToHtml(en.exerciseId);
  h+='<div class="setHead"><span></span><span>'+mf.l1+'</span><span>'+mf.l2+'</span><span>RPE</span><span></span></div>';
  en.sets.forEach(function(st,si){
    var er=(en.mode==="external"||en.mode==="bodyweight")?e1rm(st.weightKg,st.reps):null;
    h+='<div class="setRow'+(st.completed?" completed":"")+'" data-si="'+si+'"><span class="sidx">'+(si+1)+'</span>'
      +'<input type="number" inputmode="decimal" step="0.5" data-f="'+mf.f1+'" value="'+(st[mf.f1]==null?"":st[mf.f1])+'" placeholder="'+mf.p1+'">'
      +'<input type="number" inputmode="numeric" data-f="'+mf.f2+'" value="'+(st[mf.f2]==null?"":st[mf.f2])+'" placeholder="'+mf.p2+'">'
      +'<div class="rpe" data-act="rpe">'+(st.rpe==null?"–":st.rpe)+'</div>'
      +'<button class="setDone'+(st.completed?" on":"")+'" data-act="done">✓</button></div>'
      +(er?'<div class="e1rm">e1RM '+r1(er)+' kg</div>':"");
  });
  h+='<div class="plateOut" id="plate-'+ei+'"></div><div class="exFoot"><button class="btn sm" data-act="addset">+ set</button>'
    +((en.mode==="external"||en.mode==="carry")?'<button class="btn sm" data-act="plate">Plate calc</button>':"")
    +'<button class="btn sm ghost" data-act="rmex">remove</button></div></div>';
  return h;
}
function renderLog(){
  var el=$("#view-log");
  if(!draft){
    el.innerHTML='<div class="viewH">Log a session</div><div class="viewSub">Pick a strength day to start.</div>'
      +Object.keys(db.programs).map(function(id){return '<button class="btn block" style="margin:8px 0" data-act="startlog" data-ref="'+id+'">'+esc(db.programs[id].name)+'</button>';}).join("")
      +'<button class="btn ghost block sm" data-act="adhoc" style="margin-top:10px">+ Empty ad-hoc session</button>';
    return;
  }
  var prog=db.programs[draft.programRef], name=prog?prog.name:"Ad-hoc session";
  var h='<div class="viewH">'+esc(name)+'</div><div class="viewSub">'+draft.date+' · tap ✓ as you finish each set (starts the rest timer)</div>';
  draft.entries.forEach(function(en,ei){h+=exBlockHtml(en,ei);});
  h+='<button class="btn ghost block sm" data-act="addex" style="margin:6px 0 14px">+ Add exercise</button>';
  h+='<div class="finishBar"><button class="btn primary block" data-act="finish">Finish &amp; save session</button>'
    +'<button class="btn ghost block sm" data-act="discard" style="margin-top:8px">Discard draft</button></div>';
  el.innerHTML=h;
}
function cycleRpe(v){var seq=[6,7,8,9,10];if(v==null)return seq[0];var i=seq.indexOf(v);return (i<0||i===seq.length-1)?null:seq[i+1];}
function addExercise(){
  var used=draft.entries.map(function(e){return e.exerciseId;}), first=db.exercises.filter(function(x){return used.indexOf(x.id)<0;})[0]||db.exercises[0];
  draft.entries.push({exerciseId:first.id, block:"extra", adhoc:true, mode:first.loadType||"external", restSec:db.settings.restTimerDefaultSec, sets:[{set:1,reps:null,weightKg:null,durationSec:null,rpe:null,completed:false}]});
  saveDraft(); renderLog();
}
function showPlate(ei){
  var en=draft.entries[ei], w=0; en.sets.forEach(function(s){if(s.weightKg>w)w=s.weightKg;});
  var out=$("#plate-"+ei); if(!(w>0)){out.textContent="Enter a weight first.";return;}
  var bar=db.settings.barKg||20, perSide=(w-bar)/2;
  if(perSide<0){out.textContent="Target "+w+" kg is under the bar ("+bar+" kg).";return;}
  var plates=db.settings.platesKg.slice().sort(function(a,b){return b-a;}), rem=perSide, used=[];
  plates.forEach(function(p){while(rem>=p-1e-9){used.push(p);rem=r1(rem-p);}});
  out.textContent="Per side: "+(used.length?used.join(" + "):"empty bar")+"  (bar "+bar+", target "+w+" kg)"+(rem>0.01?" · "+r1(rem)+" kg short":"");
}
function finishSession(){
  var entries=draft.entries.map(function(en){
    return {exerciseId:en.exerciseId, notes:"", sets:en.sets.filter(function(s){return s.completed||s.weightKg!=null||s.reps!=null||s.durationSec!=null;}).map(function(s,i){
      var o={set:i+1, reps:(s.reps==null?null:s.reps), weightKg:(s.weightKg==null?null:s.weightKg), rpe:(s.rpe==null?null:s.rpe), completed:!!s.completed};
      if(s.durationSec!=null)o.durationSec=s.durationSec; if(s.restSec)o.restSec=s.restSec; return o;
    })};
  }).filter(function(en){return en.sets.length;});
  if(!entries.length){alert("Nothing logged yet — complete at least one set.");return;}
  db.sessions.push({id:uuid(), date:draft.date, type:"strength", programRef:draft.programRef, startedAt:draft.startedAt, endedAt:nowISO(), bodyweightKg:db.profile.bodyweightKg, sessionRpe:null, notes:"", entries:entries});
  save(); draft=null; saveDraft(); alert("Session saved ✓"); ui.histEx=null; showView("history");
}

/* ---------- HISTORY + chart ---------- */
function loggedExerciseIds(){var seen={},out=[];db.sessions.forEach(function(s){s.entries.forEach(function(en){if(!seen[en.exerciseId]){seen[en.exerciseId]=1;out.push(en.exerciseId);}});});return out;}
function seriesFor(exId){var pts=[];db.sessions.forEach(function(s){var best=null;s.entries.forEach(function(en){if(en.exerciseId===exId)en.sets.forEach(function(st){var er=e1rm(st.weightKg,st.reps);if(er&&(!best||er>best))best=er;});});if(best)pts.push({date:s.date,y:r1(best)});});return pts;}
function chartHtml(exId){
  var pts=seriesFor(exId);
  if(!pts.length)return '<div class="note dim">No weight×rep data yet for a 1RM estimate.</div>';
  if(pts.length<2)return '<div class="note">One session so far (e1RM '+pts[0].y+' kg). The trend line appears after a second session.</div>';
  var W=320,H=130,pad=26, ys=pts.map(function(p){return p.y;}), mn=Math.min.apply(null,ys), mx=Math.max.apply(null,ys);
  if(mn===mx){mn=r1(mn-1);mx=r1(mx+1);}
  var X=function(i){return pad+(W-pad-8)*(i/(pts.length-1));}, Y=function(v){return 8+(H-30)*(1-(v-mn)/(mx-mn));};
  var line=pts.map(function(p,i){return (i?"L":"M")+r1(X(i))+" "+r1(Y(p.y));}).join(" ");
  var dots=pts.map(function(p,i){return '<circle class="chartDot" cx="'+r1(X(i))+'" cy="'+r1(Y(p.y))+'" r="3"/>';}).join("");
  return '<div class="chartWrap"><svg viewBox="0 0 '+W+' '+H+'"><line class="chartGrid" x1="'+pad+'" y1="'+(H-18)+'" x2="'+W+'" y2="'+(H-18)+'"/>'
    +'<text class="chartLbl" x="2" y="'+(Y(mx)+3)+'">'+mx+'</text><text class="chartLbl" x="2" y="'+(Y(mn)+3)+'">'+mn+'</text>'
    +'<path class="chartLine" d="'+line+'"/>'+dots
    +'<text class="chartLbl" x="'+pad+'" y="'+(H-5)+'">'+esc(pts[0].date.slice(5))+'</text>'
    +'<text class="chartLbl" x="'+W+'" y="'+(H-5)+'" text-anchor="end">'+esc(pts[pts.length-1].date.slice(5))+'</text></svg></div>';
}
function prsHtml(exId){
  var bestE=0,bestW=0,bestV=0,bestD=0;
  db.sessions.forEach(function(s){var vol=0;s.entries.forEach(function(en){if(en.exerciseId===exId)en.sets.forEach(function(st){var er=e1rm(st.weightKg,st.reps);if(er>bestE)bestE=er;if(st.weightKg>bestW)bestW=st.weightKg;if(st.reps&&st.weightKg)vol+=st.reps*st.weightKg;if(st.durationSec>bestD)bestD=st.durationSec;});});if(vol>bestV)bestV=vol;});
  var rows=[];
  if(bestE)rows.push(["Best e1RM",r1(bestE)+" kg"]); if(bestW)rows.push(["Top weight",bestW+" kg"]);
  if(bestV)rows.push(["Best session volume",r1(bestV)+" kg"]); if(bestD)rows.push(["Best hold/carry",bestD+" s"]);
  return rows.length?'<div class="sectH">Personal records</div>'+rows.map(function(r){return '<div class="prRow"><span class="muted">'+r[0]+'</span><b>'+r[1]+'</b></div>';}).join(""):"";
}
function sessItemHtml(s){
  var vol=0,sets=0; s.entries.forEach(function(en){en.sets.forEach(function(st){sets++;if(st.reps&&st.weightKg)vol+=st.reps*st.weightKg;});});
  var pr=db.programs[s.programRef];
  return '<div class="sessItem"><div style="flex:1"><div class="sessDate">'+esc(s.date)+'</div><div class="sessSub">'+esc(pr?pr.name:(s.type||"session"))+' · '+s.entries.length+' exercises · '+sets+' sets</div></div>'+(vol?'<div class="pill acc">'+r1(vol)+' kg</div>':"")+'</div>';
}
function renderHistory(){
  var el=$("#view-history");
  if(!db.sessions.length){el.innerHTML='<div class="viewH">History</div><div class="viewSub">No sessions yet. Log one and it shows here.</div>';return;}
  var exIds=loggedExerciseIds(); if(!ui.histEx||exIds.indexOf(ui.histEx)<0)ui.histEx=exIds[0];
  var h='<div class="viewH">History</div><div class="card"><div class="selWrap"><select id="histExSel">'
    +exIds.map(function(id){var ex=exById(id);return '<option value="'+id+'"'+(id===ui.histEx?" selected":"")+'>'+esc(ex?ex.name:id)+'</option>';}).join("")+'</select></div>'
    +'<div class="sectH">Estimated 1RM (Epley)</div>'+chartHtml(ui.histEx)+prsHtml(ui.histEx)+'</div>';
  h+='<div class="sectH">Sessions</div><div class="card">'+db.sessions.slice().reverse().map(sessItemHtml).join("")+'</div>';
  el.innerHTML=h;
}

/* ---------- PROGRAMS ---------- */
/* shared by the logger + the Plan view; renderPlan lives in tracker-plan.js */
function howToHtml(exId){
  var d=EX_DESC[exId]; if(!d)return "";
  return '<details class="how"><summary>How to do it</summary><div class="howBody">'
    +'<div class="howRow"><span class="howK">Setup</span><span>'+esc(d.setup)+'</span></div>'
    +'<div class="howRow"><span class="howK">Move</span><span>'+esc(d.move)+'</span></div>'
    +'<div class="howRow"><span class="howK">Cue</span><span>'+esc(d.cue)+'</span></div>'
    +'<div class="howRow"><span class="howK">Feel</span><span>'+esc(d.feel)+'</span></div>'
    +'</div></details>';
}
/* always-visible exercise gif (compact); hides itself if the file is missing or absent */
function gifHtml(exId){
  var g=EX_GIF[exId]; if(!g) return "";
  return '<div class="exFig"><img src="gifs/'+g+'.gif" alt="" loading="lazy" onerror="this.closest(\'.exFig\').style.display=\'none\'"></div>';
}

/* ---------- NUTRITION ---------- */
function renderNutrition(){
  var bw=db.profile.bodyweightKg, lo=bw?Math.round(bw*NUTRITION.targetLow):null, hi=bw?Math.round(bw*NUTRITION.targetHigh):null;
  var h='<div class="viewH">Fuel</div><div class="viewSub">Protein target + GERD-safe timing</div><div class="card"><div class="sectH" style="margin-top:0">Daily protein target</div>';
  if(bw)h+='<div class="bigNum">'+lo+'–'+hi+' g</div><div class="note">at '+NUTRITION.targetLow+'–'+NUTRITION.targetHigh+' g/kg · '+bw+' kg · '+NUTRITION.mealsPerDay[0]+'–'+NUTRITION.mealsPerDay[1]+' meals (≥'+Math.round(bw*NUTRITION.perMealMinGPerKg)+' g each) · ceiling ~'+Math.round(bw*NUTRITION.ceiling)+' g.</div>';
  else h+='<div class="warnBox">Set your bodyweight in Settings to compute the gram target.</div>';
  h+='</div><div class="sectH">Timing rules</div><div class="card kvs">'+NUTRITION.rules.map(function(r){return '<div style="flex-direction:column;align-items:flex-start;gap:3px;border-bottom:1px solid var(--line)"><b style="font-size:12.5px">'+esc(r.when)+'</b><span class="muted" style="font-size:12.5px">'+esc(r.how)+'</span></div>';}).join("")+'</div>';
  h+='<div class="sectH">GERD safety</div><div class="card"><ul style="margin:0;padding-left:18px;font-size:13px;color:#c6d2dd">'+NUTRITION.gerd.map(function(g){return '<li style="margin-bottom:5px">'+esc(g)+'</li>';}).join("")+'</ul></div>';
  h+='<div class="card reserved"><b>Daily protein logging</b><div class="note">Reserved (v2) — log shakes + actual grams vs target.</div></div>';
  h+='<div class="note" style="margin:8px 2px"><b>'+esc(NUTRITION.oneLine)+'</b></div>';
  $("#view-nutrition").innerHTML=h;
}

/* ---------- SETTINGS ---------- */
function field(label,type,path,val,attr){return '<div class="field"><label>'+label+'</label><input type="'+type+'"'+(type==="number"?' inputmode="decimal" step="any"':"")+' data-path="'+path+'" value="'+esc(val==null?"":val)+'" '+(attr||"")+'></div>';}
function renderSettings(){
  var p=db.profile,s=db.settings;
  var h='<div class="viewH">Settings</div><div class="card"><div class="sectH" style="margin-top:0">Profile</div>'
    +field("Name","text","p.name",p.name)+field("Bodyweight (kg)","number","p.bodyweightKg",p.bodyweightKg)
    +field("Max HR (bpm)","number","p.maxHr",p.maxHr)+field("Resting HR (bpm)","number","p.restingHr",p.restingHr)
    +'<div class="row">'+field("Protein low g/kg","number","p.proteinTargetGPerKg.low",p.proteinTargetGPerKg.low)+field("Protein high g/kg","number","p.proteinTargetGPerKg.high",p.proteinTargetGPerKg.high)+'</div>'
    +'<div class="note dim">Editing Max HR regenerates HR zones.</div></div>';
  h+='<div class="card"><div class="sectH" style="margin-top:0">Training block</div>'
    +field("Current block week (1–13)","number","s.blockPhaseWeek",s.blockPhaseWeek)
    +field("Rest timer default (s)","number","s.restTimerDefaultSec",s.restTimerDefaultSec)
    +field("Barbell weight (kg)","number","s.barKg",s.barKg)+'</div>';
  h+='<div class="card"><div class="sectH" style="margin-top:0">HR zones (max '+p.maxHr+')</div><div class="kvs">'
    +["z1","z2","z3","z4","z5"].map(function(z){return '<div><span class="muted">'+z.toUpperCase()+'</span><b>'+p.hrZones[z][0]+'–'+p.hrZones[z][1]+'</b></div>';}).join("")+'</div></div>';
  h+='<div class="card"><div class="sectH" style="margin-top:0">Data</div><div class="btnRow"><button class="btn" data-act="export">Export JSON</button><button class="btn" data-act="import">Import JSON</button></div>'
    +'<div class="note dim" style="margin-top:8px">Schema v'+db.schemaVersion+' · '+db.sessions.length+' sessions · last export '+(s.lastExportAt?s.lastExportAt.slice(0,10):"never")+'</div>'
    +'<button class="btn ghost block sm" data-act="reset" style="margin-top:10px;color:var(--bad)">Reset all data</button></div>';
  h+='<div class="note dim" style="margin:8px 2px">Week-1 calibration numbers → I compute baselines.md → seeds this tracker.</div>';
  $("#view-settings").innerHTML=h;
}
function setPath(path,val){var o=path.indexOf("p.")===0?db.profile:db.settings, parts=path.slice(2).split(".");for(var i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=val;}
function regenZones(){var m=db.profile.maxHr||193;db.profile.hrZones={z1:[Math.round(.5*m),Math.round(.6*m)],z2:[Math.round(.6*m),Math.round(.7*m)],z3:[Math.round(.7*m),Math.round(.8*m)],z4:[Math.round(.8*m),Math.round(.9*m)],z5:[Math.round(.9*m),m]};}
