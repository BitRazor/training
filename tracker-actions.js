"use strict";
/* training-tracker — actions layer: the in-app modal primitive + the user commands that use it
   (program switch/transfer, plan weight/step/note edits, export). Split out of tracker.js on 2026-07-01.
   Loaded AFTER the views/plan and BEFORE tracker.js (core): the core's init + click-delegator call
   these at runtime, and these call back into the core's state/router (db, ui, save, showView,
   progStateFor…) at runtime — every cross-reference resolves once all scripts have loaded. */

/* ---------- in-app sheet (replaces the browser's native prompt / confirm / alert) ----------
   Version 2: every modal is a bottom sheet (#modal, slides up). Modes: "chips", "text", "number" (the keypad,
   tracker-plan.js keypadHtml), "sheet" (any html, closed with its Close button, the backdrop or Android back), "line"
   (2026-11-04: a one-line #mText input, o.maxLength, then o.html; Enter saves; the rename sheet).
   The v1 hooks stay: #modal.open, #mNum / #mText, data-act modalok / modalcancel / modalchip / modalcustom. */
var modalState = null;
function openModal(o){
  modalState = { onSubmit: o.onSubmit, onClose: o.onClose };
  var body = "";
  if(o.mode === "chips"){
    body = '<div class="mChips">' + (o.chips||[]).map(function(c){ return '<button class="mChip' + (c.sel ? " sel" : "") + '" data-act="modalchip" data-val="' + esc(String(c.value)) + '">' + esc(c.label) + '</button>'; }).join("") +
      (o.noCustom ? '' : '<button class="mChip alt" data-act="modalcustom">Custom…</button>') + '</div>' +
      (o.noCustom ? '' : '<div class="mCustom" hidden><input type="number" class="mInput" id="mNum" inputmode="decimal" step="any" placeholder="kg"><button class="btn primary sm" data-act="modalok">Set</button></div>');
  } else if(o.mode === "text"){
    body = '<textarea class="mInput mArea" id="mText" placeholder="' + esc(o.placeholder||"") + '">' + esc(o.value||"") + '</textarea>';
  } else if(o.mode === "number"){
    body = (typeof keypadHtml === "function") ? keypadHtml(o)
      : '<input type="number" class="mInput" id="mNum" inputmode="decimal" step="any" value="' + esc(o.value==null?"":o.value) + '" placeholder="' + esc(o.placeholder||"kg") + '">';
  } else if(o.mode === "sheet"){
    body = o.html || "";
  } else if(o.mode === "line"){
    body = '<input type="text" class="mInput" id="mText" value="' + esc(o.value||"") + '" placeholder="' + esc(o.placeholder||"") + '"' + (o.maxLength ? ' maxlength="' + o.maxLength + '"' : '') + ' autocomplete="off" spellcheck="false" enterkeyhint="done">' + (o.html || "");
  }
  var ok = (o.mode === "chips" || o.mode === "sheet") ? "" : '<button class="btn primary" data-act="modalok">' + esc(o.okLabel||"Save") + '</button>';
  var cancel = o.noCancel ? "" : '<button class="btn" data-act="modalcancel">' + esc(o.mode === "sheet" ? (o.closeLabel || "Close") : "Cancel") + '</button>';
  $("#modal").innerHTML = '<div class="mBack" data-act="modalcancel"></div><div class="mCard' + (o.cls ? " " + o.cls : "") + '" role="dialog" aria-modal="true">' +
    '<div class="mTitle">' + esc(o.title||"") + '</div>' + (o.message ? '<div class="mMsg">' + esc(o.message) + '</div>' : "") +
    body + ((cancel || ok) ? '<div class="mActions">' + cancel + ok + '</div>' : '') + '</div>';
  $("#modal").classList.add("open");
  if(o.mode === "text") setTimeout(function(){ var f = $("#mText"); if(f && f.focus) f.focus(); }, 60);   /* the keypad never opens the phone keyboard */
  if(o.mode === "line") setTimeout(function(){ var f = $("#mText"); if(f && f.focus){ f.focus(); if(f.select) f.select(); } }, 60);   /* typing replaces the old name */
}
/* ---------- the number pad (design §5): replaces the phone keyboard for the weight, the 15RM and the plate ----------
   A big read-only display (#mNum: the v1 hook, so the old handlers read it unchanged), −step / +step on the lift's
   own grid (the engine's nextWeight / snapDown; o.stepEx = the exercise), digits, a decimal point, delete; Save is
   the sheet's data-act="modalok". The first key replaces the starting value, later keys append. */
var kp = { ex: null, fresh: true };
function fmtKg(x){ return String(Math.round(x * 100) / 100); }
function keypadHtml(o){
  var ex = o.stepEx || null, g = ex ? gearFor(ex) : null;
  kp = { ex: ex, fresh: true };
  var hint = !g ? "" : g.equip === "db" ? "± one dumbbell step: 1 kg under 10 kg, 2.5 kg above" : "± " + fmtKg(g.inc || 2.5) + " kg per step";
  return '<div class="kp"><div class="kpDisp">' +
    (ex ? '<button class="kpStep" data-act="kpminus" aria-label="One step lighter">' + icon("minus") + '</button>' : '') +
    '<label class="kpVal"><input id="mNum" class="kpIn" type="text" readonly inputmode="none" autocomplete="off" value="' + esc(o.value == null ? "" : o.value) + '" placeholder="' + esc(o.placeholder || "kg") + '"><span class="kpUnit">kg</span></label>' +
    (ex ? '<button class="kpStep" data-act="kpplus" aria-label="One step heavier">' + icon("plus") + '</button>' : '') + '</div>' +
    (hint ? '<div class="kpHint">' + hint + '</div>' : '') +
    '<div class="kpGrid">' + ["1","2","3","4","5","6","7","8","9",".","0"].map(function(k){ return '<button class="kpKey" data-act="kpkey" data-k="' + k + '">' + k + '</button>'; }).join("") +
    '<button class="kpKey kpDel" data-act="kpdel" aria-label="Delete">' + icon("backspace") + '</button></div></div>';
}
function kpPress(k){
  var inp = $("#mNum"); if(!inp) return;
  var v = kp.fresh ? "" : inp.value; kp.fresh = false;
  if(k === "."){ if(v.indexOf(".") >= 0) { inp.value = v; return; } v = (v || "0") + "."; }
  else { if(/\.\d{2}$/.test(v) || v.replace(".", "").length >= 6) { inp.value = v; return; } v = (v === "0") ? k : v + k; }
  inp.value = v;
}
function kpDel(){ var inp = $("#mNum"); if(!inp) return; kp.fresh = false; inp.value = inp.value.slice(0, -1); }
/* one real step lighter or heavier on the lift's grid (0 = nothing, e.g. body weight for a plate) */
function kpStep(dir){
  var inp = $("#mNum"); if(!inp || !kp.ex) return;
  var cur = num(inp.value); if(cur == null || cur < 0) cur = 0;
  var nx;
  if(dir > 0) nx = nextWeight(kp.ex, cur);
  else { nx = snapDown(cur - 1e-6, kp.ex); if(nx == null || !(nx < cur - 1e-9)) nx = 0; nx = Math.max(0, nx); }
  inp.value = fmtKg(nx); kp.fresh = false;
  if(window.Native) Native.haptic("light");
}
/* a read-only sheet: title + any html + a Close button */
function openSheet(title, html, extra){ var o = { mode:"sheet", title:title, html:html }; for(var k in (extra||{})) o[k] = extra[k]; openModal(o); }
function closeModal(){ var m=$("#modal"), fn=modalState && modalState.onClose; if(m){ m.classList.remove("open"); m.innerHTML=""; } modalState=null; if(fn) fn(); }
function modalSubmit(v){ var fn = modalState && modalState.onSubmit; if(modalState) modalState.onClose = null; closeModal(); if(fn) fn(v); }
function confirmModal(title, message, onYes){ openModal({ title:title, message:message, okLabel:"Yes, do it", onSubmit:function(){ onYes(); } }); }
/* toast: one at a time (a new one replaces the last). opts.undo = a function -> an Undo button for 5 s
   (design §5: after a set or exercise tick, a note delete or a week finish). */
var toastTimer = null;
function toast(msg, opts){
  opts = opts || {};
  $$(".toast").forEach(function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
  clearTimeout(toastTimer);
  var d = document.createElement("div"), m = document.createElement("span");
  d.className = "toast"; d.setAttribute("role", "status");
  m.className = "toastMsg"; m.textContent = msg; d.appendChild(m);
  var gone = function(){ if(d.parentNode) d.parentNode.removeChild(d); };
  var hide = function(){ d.classList.remove("show"); setTimeout(gone, 250); };
  if(typeof opts.undo === "function"){
    var b = document.createElement("button"), fn = opts.undo;
    b.type = "button"; b.className = "toastUndo"; b.innerHTML = icon("undo") + "Undo";
    b.addEventListener("click", function(e){ e.stopPropagation(); clearTimeout(toastTimer); gone(); var f = fn; fn = null;
      if(f){ if(window.Native) Native.haptic("warning"); f(); } });
    d.appendChild(b);
  }
  document.body.appendChild(d);
  setTimeout(function(){ d.classList.add("show"); }, 10);
  toastTimer = setTimeout(hide, opts.ms || (opts.undo ? 5000 : 2200));
}

/* ---------- program switch: preview ("just looking") vs commit ("start training" + carry strength) ---------- */
/* which strength day-track a lift lives in (each lift is in exactly one) */
function dayOf(exId){ for(var i=0;i<STRENGTH_DAYS.length;i++){ var d=STRENGTH_DAYS[i], P=db.programs[d]; if(P){ for(var j=0;j<P.entries.length;j++) if(P.entries[j].exerciseId===exId) return d; } } return null; }
/* highest completed week of a day-track in a program (0 = none) */
function lastCompletedWeek(pid, day){ var ps=db.programState&&db.programState[pid], wd=ps&&ps.progress&&ps.progress[day]&&ps.progress[day].weeksDone; return (wd&&wd.length)?Math.max.apply(null,wd):0; }
/* the carried 15RM anchors a NEW program would start from: each lift's strength at the CURRENT active
   program's (last completed week in its day-track + 1 step). Pure read — used by BOTH preview and start. */
function carryFromActive(){
  if(typeof isSmartProg==="function" && isSmartProg(db.activeProgram)) return smartCarryOut();   /* Part 2: from each lift's smart target */
  var out={load:{}, bank:{}}, src=getProgram(db.activeProgram), srcMode=activeRateMode();
  for(var i=0;i<db.exercises.length;i++){ var ex=db.exercises[i], t=db.tested[ex.id];
    if(t==null){ out.load[ex.id]=null; out.bank[ex.id]=null; continue; }
    if(ex.loadType==="bodyweight"){ out.load[ex.id]=t; out.bank[ex.id]=null; continue; }   /* a plate is carried as-is */
    var day=dayOf(ex.id), N=day?lastCompletedWeek(db.activeProgram, day):0;
    var c=carryLift(t, db.bank[ex.id], ex, src, srcMode, N);   /* load = on the lift's real grid; bank = exact strength */
    out.load[ex.id]=c.load; out.bank[ex.id]=c.bank;
  }
  return out;
}
/* tap a different program → choose: just looking (transient preview) or start training (commit + carry) */
function openSwitchModal(pid){
  var P=getProgram(pid);
  openModal({ title:P.name, message:"Just peeking, or making this your program now? Looking changes nothing.", mode:"chips", noCustom:true,
    chips:[{label:"👀 Just looking", value:"look"},{label:"🏋 Start training", value:"train"}],
    onSubmit:function(v){ if(v==="look") startPreview(pid); else if(v==="train") startTraining(pid); } });
}
function startPreview(pid){
  /* a smart program previewed from a 12-week one shows the targets it would start from (tracker-smart.js) */
  var tg=(typeof isSmartProg==="function" && isSmartProg(pid) && !isSmartProg(db.activeProgram)) ? carryTargetsFrom(db.activeProgram, {}) : null;
  ui.preview={program:pid, anchor:carryFromActive().load, targets:tg}; ui.planWeek=1; ui.planLastProg=null; showView("programs"); }
function clearPreview(){ ui.preview=null; }
/* commit: carry current strength into the new program, make it active, start it FRESH (week 1) */
function startTraining(pid){
  var carried=carryFromActive();
  var hasProg=programTrained(pid);   /* weeks, ticks or diary entries in its current run — starting it again clears the ticks */
  var go=function(){
    /* Part 2: into a smart program from a 12-week one, each lift's target = what that program prescribes this week (a
       stronger target already there stays); worked out before the anchors below move */
    if(typeof isSmartProg==="function" && isSmartProg(pid) && !isSmartProg(db.activeProgram)) carryTargetsFrom(db.activeProgram);
    for(var id in carried.load){ if(carried.load[id]!=null){ db.tested[id]=carried.load[id]; db.bank[id]=carried.bank[id]; } }
    var ps=progStateFor(pid);
    if(programTrained(pid)) ps.cycle=cycleOf(pid)+1;   /* a new run: its own diary cycle … */
    clearTicks(pid);                                    /* … and no ticks left over from the last run */
    db.activeProgram=pid;
    if(!ps.startedAt) ps.startedAt=nowISO(); ps.completedAt=null;
    STRENGTH_DAYS.concat(typeof HOME_DAYS!=="undefined"?HOME_DAYS:[]).forEach(function(d){ if(!ps.progress[d]) ps.progress[d]={weeksDone:[]}; else ps.progress[d].weeksDone=[]; });   /* home weeks restart with the cycle too */
    clearPreview(); ui.planWeek=null; ui.planLastProg=null; save(); showView("programs");
  };
  if(hasProg) confirmModal("Restart "+getProgram(pid).name+"?", getProgram(pid).name+" already has training logged. Start a fresh cycle from your current strength? Its ticks and finished weeks will be cleared — your diary keeps every lift.", go);
  else go();
}

/* ---------- plan actions (weight / step / note edits) ---------- */
function onSetWeight(t){
  var exId=t.getAttribute("data-ex"), w=ui.planWeek||1, ex=exById(exId)||{name:exId}, cur=db.tested[exId];
  /* Part 2: in a smart program the weight is today's weight used (or a new lift's starting weight), tracker-smart.js */
  if(typeof smartOn==="function" && smartOn()){ onSmartWeight(ui.planProg, w, exId); return; }
  /* body-weight lift (45° back extension): the number is the plate he holds, stored as typed; 0 = body weight */
  if(ex.loadType==="bodyweight"){
    openModal({ title:"Plate · "+ex.name, message:"Body weight until 25 clean reps, then hold a 2.5–5 kg plate. Enter the plate's kg (0 = body weight).", mode:"number", value:cur!=null?String(cur):"", placeholder:"kg", stepEx:ex,
      onSubmit:function(v){ if(v==null||String(v).trim()==="") return; var n=num(v); if(n==null||n<0){ toast("Enter 0 or more"); return; }
        if(n>0) db.tested[exId]=Math.round(n*4)/4; else delete db.tested[exId]; save(); renderPlan(); } });
    return;
  }
  if(cur==null){
    openModal({ title:"Tested 15RM · "+ex.name, message:"The weight you fail at about 15 reps, lowering in about 3 s and lifting firmly (kg).", mode:"number", placeholder:"kg", stepEx:ex,
      onSubmit:function(v){ if(v!=null&&String(v).trim()!==""&&num(v)>0){ db.tested[exId]=Math.round(num(v)*4)/4; delete db.bank[exId]; save(); renderPlan(); } } });
    return;
  }
  /* re-anchor from what you ACTUALLY lifted this week: the whole block re-derives (ladderFor) so THIS
     week shows exactly the typed weight and every week stays a real weight (engine: anchorForLogged) */
  var planW=(ladderFor(cur, ex, getProgram(db.activeProgram), activeRateMode())[w]||{}).kg;
  openModal({ title:"Actual weight · "+ex.name+" · wk "+w, message:"What you really lifted (kg). The whole block recalculates from this.", mode:"number", value:String(planW), placeholder:"kg", stepEx:ex,
    onSubmit:function(v){ if(v!=null&&String(v).trim()!==""&&num(v)>0&&planW){
      var r=anchorForLogged(ex, getProgram(db.activeProgram), activeRateMode(), w, num(v), cur, db.bank[exId]);
      db.tested[exId]=r.anchor; db.bank[exId]=r.bank; save(); renderPlan();
      if(!r.exact) toast("Set to "+r.kg+" kg — the closest your weight steps allow (⚙ to change)"); } } });
}
/* edit ONE lift's weight step (the card chip). number = fixed kg · "db" = dumbbell grid · blank = reset */
function onSetStep(t){
  var exId=t.getAttribute("data-ex"), ex=exById(exId)||{name:exId};
  openModal({ title:"Weight step · "+ex.name, message:"Smallest jump your gear allows — tap one, or Custom.", mode:"chips",
    chips:[{label:"1.25 kg",value:"1.25"},{label:"2.5 kg",value:"2.5"},{label:"5 kg",value:"5"},{label:"10 kg",value:"10"},{label:"DB grid",value:"db"},{label:"Reset",value:""}],
    onSubmit:function(v){ v=String(v==null?"":v).trim().toLowerCase();
      if(v===""){ delete db.gear[exId]; } else if(v==="db"){ db.gear[exId]={equip:"db"}; }
      else { var n=num(v); if(n==null||n<=0){ toast("Enter a weight step above 0"); return; } db.gear[exId]={inc:Math.round(n*100)/100}; }
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
      else { var n=num(v); if(n==null||n<=0){ toast("Enter a weight step above 0"); return; } db.gearByCat[cat]={inc:Math.round(n*100)/100}; }
      save(); renderSettings(); } });
}
function onNote(t){
  var exId=t.getAttribute("data-ex"), ex=exById(exId)||{name:exId};
  openModal({ title:"Note · "+ex.name, message:"Pain, machine quirks, how it felt — saved with the week & weight.", mode:"text", placeholder:"e.g. left knee niggle on set 3, gone next morning",
    onSubmit:function(txt){ if(txt==null||txt.trim()==="") return;
      /* auto-stamp the week + the prescribed weight at the moment of the note, as its own record. From a sheet the
         button names its day and week (data-prog / data-week); on the Workout card they are the shown ones. */
      var prog=t.getAttribute("data-prog")||ui.planProg||todayProgram()||"strength-a", week=(+t.getAttribute("data-week"))||ui.planWeek||1;
      var en=progEntry(prog,exId), pr=en?prescFor(en,week,prog):null;
      var weight=(pr&&pr.weight!=null)?(pr.weight+" kg"):((pr&&pr.kind==="timed")?"timed":"");
      db.notes.push({date:todayISO(), week:week, exerciseId:exId, weight:weight, text:txt.trim()});
      save(); toast("Note saved ✓"); } });
}
/* delete asks first (design §4 Notes), then a toast offers Undo for 5 s (§5) */
function onDelNote(t){
  var idx=+t.getAttribute("data-idx");
  if(isNaN(idx)||idx<0||idx>=db.notes.length) return;
  var n=db.notes[idx], ex=exById(n.exerciseId)||{name:n.exerciseId}, tx=String(n.text||"");
  openModal({ title:"Delete this note?", message:ex.name+": “"+(tx.length>90?tx.slice(0,88)+"…":tx)+"”", okLabel:"Delete", cls:"dangerSheet",
    onSubmit:function(){ var undo=undoPoint(); db.notes.splice(idx,1); save(); renderLog(); toast("Note deleted", { undo: undo }); } });
}

/* ---------- export ---------- */
function doExport(){
  db.exportedAt=nowISO(); db.settings.lastExportAt=db.exportedAt; save();
  var name="training-export-"+todayISO()+".json", json=JSON.stringify(db,null,2);
  /* iPhone-safe: an installed PWA can't reliably auto-download (WebKit bug), but the share sheet
     works — share a file when supported (save to Files / mail it), else a normal download. */
  try{
    if(navigator.share && navigator.canShare){
      var file=new File([json],name,{type:"application/json"});
      if(navigator.canShare({files:[file]})){ navigator.share({files:[file],title:"Training backup"}).catch(function(){}); return; }
    }
  }catch(e){}
  var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  a.download=name; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
}
