"use strict";

/* ---------- state ---------- */
var KEY="w1cal-v1";
var state={v:{},done:{},open:{},choices:{pull:"pulldown",press:"machine",push:"ext"},hideDone:false,activeDay:"day1",uxMigrated:false};
try{var saved=JSON.parse(localStorage.getItem(KEY)||"null"); if(saved){for(var k in state){if(saved[k]!==undefined)state[k]=saved[k];}}}catch(e){}
/* one-time cleanup: drop the expand/collapse memory from the old pre-tabs layout so
   returning users land on the new collapsed defaults. Logged numbers (state.v) stay put. */
if(!state.uxMigrated){state.open={}; state.uxMigrated=true; save();}
var saveT=null;
function save(){clearTimeout(saveT); saveT=setTimeout(function(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}},150);}

/* ---------- helpers ---------- */
function $(s,el){return (el||document).querySelector(s);}
function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s));}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function r05(x){return Math.round(x*2)/2;}
function exName(ex){return ex.nameKey?ex.names[state.choices[ex.nameKey]]:ex.name;}
function isLogged(ex){
  return ex.kind==="heavy" ? (parseFloat(state.v[ex.id+"_fin"])>0)
    : ex.fields.some(function(f){var v=state.v[ex.id+"_"+f.k]; return v!==undefined&&String(v).trim()!=="";});
}
function exById(id){var r=null; allEx().forEach(function(e){if(e.id===id)r=e;}); return r;}
function restFor(ex){return ex.rest!=null?ex.rest:(ex.kind==="heavy"?150:(ex.kind==="gap"?90:45));}
function tempoFor(ex){return ex.tempo!==undefined?ex.tempo:(ex.id==="calf"?"9":(ex.kind==="semi"?null:"6"));}
var activeEx=null;
function vib(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
var AC=null;
function beep(f,d){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)(); var o=AC.createOscillator(),g=AC.createGain(); o.frequency.value=f; o.connect(g); g.connect(AC.destination); g.gain.setValueAtTime(.25,AC.currentTime); g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d); o.start(); o.stop(AC.currentTime+d);}catch(e){}}

/* ---------- render ---------- */
/* pre-seed: tested numbers we already logged, so a fresh browser / new URL isn't blank.
   Your own typed value always wins over these — they only fill empties. */
var SEED={rdl_fin:"40",calf_fin:"40",tib_w:"10",psoas_w:"12.5",wristc_w:"6",carry_w:"16"};
function fieldHtml(ex,f){
  var id=ex.id+"_"+f.k, val=state.v[id]!==undefined?state.v[id]:(SEED[id]!==undefined?SEED[id]:"");
  var t=f.type==="txt"?'type="text"':'type="number" step="0.5" inputmode="decimal"';
  return '<div class="fld'+(f.fin?' final':'')+'"><label for="'+id+'">'+f.lab+'</label><input '+t+' id="'+id+'" data-k="'+id+'" value="'+esc(val)+'" placeholder="—"></div>';
}
function cardHtml(ex){
  var f, logs="";
  if(ex.kind==="heavy"){
    logs='<div class="fRow">'+fieldHtml(ex,{k:"ramp",lab:"Ramp weights",type:"txt"})+'</div>'
        +'<div class="fRow">'+fieldHtml(ex,{k:"w1",lab:"Set-1 weight (kg)",type:"num"})+fieldHtml(ex,{k:"r1",lab:"Set-1 reps (to failure)",type:"num"})+'</div>'
        +'<div class="verdict" id="vd_'+ex.id+'"></div>'
        +'<div class="fRow">'+fieldHtml(ex,{k:"fin",lab:"✓ FINAL 15RM ("+(ex.unit||"kg")+")",type:"num",fin:true})+'</div>';
  } else {
    logs='<div class="fRow">'+ex.fields.map(function(ff){return fieldHtml(ex,ff);}).join("")+'</div>';
  }
  var chips=ex.chips.map(function(c){
    var cls=/RIR|NOT to failure|light/i.test(c)?"chip warn":(/Tempo|3 s|squeeze|stretch/i.test(c)?"chip acc":"chip");
    return '<span class="'+cls+'">'+c+'</span>';
  }).join("");
  var howOpen=state.open["how_"+ex.id]===true?" open":"";
  return '<div class="ex'+(state.done[ex.id]?' done':'')+'" id="ex_'+ex.id+'">'
   +'<div class="exHead" data-arm="'+ex.id+'"><div><div class="exName" data-nm="'+ex.id+'">'+esc(exName(ex))+'</div><div class="exTarget">'+ex.target+'</div></div>'
   +'<button class="doneBtn" data-done="'+ex.id+'" aria-label="mark done" title="Mark done — collapses the card">✓</button></div>'
   +'<div class="chips">'+chips+'</div>'
   +'<div class="exFig" data-gif="'+ex.id+'.gif"><img src="gifs/'+ex.id+'.gif" alt="'+esc(exName(ex))+'" loading="lazy" onerror="var p=this.parentNode; this.remove(); p.classList.add(\'missing\')"></div>'
   +'<details class="how" data-how="'+ex.id+'"'+howOpen+'><summary>How to do it</summary><div class="howBody">'
   +'<ul class="cues">'+ex.cues.map(function(c){return "<li>"+c+"</li>";}).join("")+'</ul>'
   +'</div></details>'
   +'<div class="logs">'+logs+'</div></div>';
}
function warmCardHtml(w){
  var g=(w.gif&&w.gif.indexOf(".")>=0)?w.gif:(w.gif||w.id)+".gif";
  return '<div class="ex wu" id="'+w.id+'">'
   +'<div class="exHead"><div><div class="exName">'+esc(w.name)+'</div><div class="exTarget">'+esc(w.detail)+'</div></div></div>'
   +'<div class="exFig" data-gif="'+g+'"><img src="gifs/'+g+'" alt="'+esc(w.name)+'" loading="lazy" onerror="var p=this.parentNode; this.remove(); p.classList.add(\'missing\')"></div>'
   +'</div>';
}
function renderWarmup(day){
  var el=$("#warmBody"); if(!el)return;
  el.innerHTML=(WARMUP[day]||[]).map(warmCardHtml).join("");
}
function render(){
  ["day1","day2"].forEach(function(d){
    $("#"+d).innerHTML=DAYS[d].blocks.map(function(b){
      return '<div class="blockHead">'+b.head+'</div>'+b.ex.map(cardHtml).join("");
    }).join("");
  });
  $$(".opts").forEach(function(o){
    var key=o.getAttribute("data-choice");
    $$(".opt",o).forEach(function(btn){btn.classList.toggle("sel",btn.getAttribute("data-v")===state.choices[key]);});
  });
  allEx().forEach(function(ex){if(ex.kind==="heavy")verdict(ex.id);});
  progress();
}
function allEx(){var a=[];["day1","day2"].forEach(function(d){DAYS[d].blocks.forEach(function(b){b.ex.forEach(function(e){e._day=d;a.push(e);});});});return a;}

/* ---------- logic ---------- */
function verdict(id){
  var w=parseFloat(state.v[id+"_w1"]), r=parseFloat(state.v[id+"_r1"]);
  var el=$("#vd_"+id); if(!el)return;
  el.className="verdict"; el.innerHTML="";
  if(!(w>0)||!(r>0))return;
  if(r>=13&&r<=17){
    el.className="verdict ok";
    el.innerHTML="✓ Calibrated — this is your 15RM. <button class='useBtn' data-use='"+id+"'>Set "+w+" kg as final</button>";
  } else if(r>=18){
    el.className="verdict up";
    el.innerHTML="Too light ("+r+" reps). +5–10% → try ~<b>"+r05(w*1.05)+"–"+r05(w*1.10)+" kg</b> next set.";
  } else if(r===12){
    el.className="verdict ok";
    el.innerHTML="1 short of the bracket — keep "+w+" kg; expect 13–14 when fresher. <button class='useBtn' data-use='"+id+"'>Set "+w+" kg as final</button>";
  } else {
    el.className="verdict dn";
    el.innerHTML="Too heavy ("+r+" reps). −10% → drop to ~<b>"+r05(w*0.9)+" kg</b> next set.";
  }
}
function progress(){
  var tot=0, done=0;
  allEx().forEach(function(ex){
    tot++;
    if(state.done[ex.id])done++;
    var el=$("#ex_"+ex.id); if(el)el.classList.toggle("done",!!state.done[ex.id]);
  });
  $("#pbar").style.width=(done/tot*100)+"%";
  $("#ptxt").textContent=done+" / "+tot+" done"+(done===tot?" — all done ✓":"");
  ["day1","day2"].forEach(function(d){
    var t=0,dn=0;
    DAYS[d].blocks.forEach(function(b){b.ex.forEach(function(ex){
      t++;
      if(state.done[ex.id])dn++;
    });});
    $("#"+DAYS[d].cnt).textContent=dn+"/"+t;
  });
  results();
}
function results(){
  var rows="";
  ["day1","day2"].forEach(function(d){
    rows+='<tr><td class="day" colspan="2">'+(d==="day1"?"Day 1 — Lower":"Day 2 — Upper")+'</td></tr>';
    DAYS[d].blocks.forEach(function(b){b.ex.forEach(function(ex){
      var val;
      if(ex.kind==="heavy"){var f=state.v[ex.id+"_fin"]; val=f?f+" "+(ex.unit||"kg"):null;}
      else{var ff=ex.fields[0]; var v=state.v[ex.id+"_"+ff.k]; val=(v!==undefined&&String(v).trim()!=="")?(ff.type==="num"?v+" "+(ff.unit||"kg"):v):null;}
      rows+="<tr><td>"+esc(exName(ex))+"</td><td"+(val?"":" class='miss'")+">"+(val||"—")+"</td></tr>";
    });});
  });
  $("#resT").innerHTML=rows;
}
function summaryText(){
  var L=["Week 1 calibration results — "+new Date().toISOString().slice(0,10)];
  L.push("Bodyweight: "+(state.v["bw"]||"—")+" kg");
  L.push("Defaults: "+state.choices.pull+", "+state.choices.press+" press, "+state.choices.push);
  ["day1","day2"].forEach(function(d){
    L.push(""); L.push(d==="day1"?"DAY 1 — LOWER":"DAY 2 — UPPER");
    DAYS[d].blocks.forEach(function(b){b.ex.forEach(function(ex){
      var val;
      if(ex.kind==="heavy"){
        var f=state.v[ex.id+"_fin"], w=state.v[ex.id+"_w1"], r=state.v[ex.id+"_r1"];
        val=(f?f+" "+(ex.unit||"kg"):"—")+(w&&r?"  (set1: "+w+" kg × "+r+")":"");
      } else { var ff=ex.fields[0], v=state.v[ex.id+"_"+ff.k]; val=(v!==undefined&&String(v).trim()!=="")?(ff.type==="num"?v+" "+(ff.unit||"kg"):String(v)):"—"; }
      L.push("- "+exName(ex)+": "+val);
    });});
  });
  if(state.v["notes"])L.push("","Notes: "+state.v["notes"]);
  return L.join("\n");
}

/* ---------- events ---------- */
document.addEventListener("input",function(e){
  var k=e.target.getAttribute("data-k"); if(!k)return;
  state.v[k]=e.target.type==="checkbox"?e.target.checked:e.target.value;
  save();
  var m=k.match(/^(.+)_(w1|r1)$/); if(m)verdict(m[1]);
  progress();
});
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-use],[data-done],[data-arm],.opt"); if(!t)return;
  if(t.hasAttribute("data-use")){
    var id=t.getAttribute("data-use"), inp=$("#"+id+"_fin");
    inp.value=state.v[id+"_w1"]; state.v[id+"_fin"]=inp.value; save(); progress();
    t.textContent="✓ saved"; return;
  }
  if(t.hasAttribute("data-done")){
    var id2=t.getAttribute("data-done");
    state.done[id2]=!state.done[id2]; save();
    var card=$("#ex_"+id2); if(card)card.classList.toggle("done",!!state.done[id2]);
    progress();
    return;
  }
  if(t.hasAttribute("data-arm")){ armExercise(t.getAttribute("data-arm")); return; }
  if(t.classList.contains("opt")){
    var key=t.parentElement.getAttribute("data-choice");
    state.choices[key]=t.getAttribute("data-v"); save();
    $$(".opt",t.parentElement).forEach(function(b){b.classList.toggle("sel",b===t);});
    allEx().forEach(function(ex){ if(ex.nameKey===key){var nm=$("[data-nm='"+ex.id+"']"); if(nm)nm.textContent=exName(ex);} });
    results(); return;
  }
});
document.addEventListener("toggle",function(e){
  var d=e.target;
  if(d.classList&&d.classList.contains("how")){state.open["how_"+d.getAttribute("data-how")]=d.open; save();}
  if(d.classList&&d.classList.contains("sec")){state.open[d.id]=d.open; save();}
},true);
$("#copyBtn").addEventListener("click",function(){
  var txt=summaryText(), b=this;
  function ok(){b.textContent="Copied ✓"; setTimeout(function(){b.textContent="Copy summary";},1600);}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,function(){fallback();});}else fallback();
  function fallback(){var ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy"); ok();}catch(e){} document.body.removeChild(ta);}
});
$("#dlBtn").addEventListener("click",function(){
  var data={exported:new Date().toISOString(), bodyweight:state.v["bw"]||null, choices:state.choices, values:state.v, summary:summaryText()};
  var a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  a.download="week1-calibration-results.json"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
});
$("#impBtn").addEventListener("click",function(){$("#impFile").click();});
$("#impFile").addEventListener("change",function(ev){
  var f=ev.target.files&&ev.target.files[0]; if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var d=JSON.parse(rd.result);
      if(d.values&&typeof d.values==="object")state.v=d.values;
      if(d.choices&&typeof d.choices==="object")state.choices=d.choices;
      save(); alert("Imported ✓ — your logged numbers are restored."); location.reload();
    }catch(e){alert("That file didn't read as valid calibration JSON.");}
  };
  rd.readAsText(f);
});
$("#resetBtn").addEventListener("click",function(){
  if(confirm("Erase ALL logged data on this device?")){localStorage.removeItem(KEY); location.reload();}
});

/* ---------- rest timer + metronome ---------- */
var disp=$("#disp"), dispSub=$("#dispSub"), timer=null, metro=null;
function setDisp(txt,sub,run){disp.firstChild.nodeValue=txt; dispSub.textContent=sub; disp.classList.toggle("run",!!run);}
function stopTimer(){clearInterval(timer); timer=null; $$("[data-rest]").forEach(function(b){b.classList.remove("on");});}
function stopMetro(){clearInterval(metro); metro=null; $$("[data-met]").forEach(function(b){b.classList.remove("on");});}
function idle(){if(!timer&&!metro)setDisp("--:--","TIMER",false);}
$$("[data-rest]").forEach(function(b){
  b.addEventListener("click",function(){
    if(b.classList.contains("on")){stopTimer(); idle(); return;}
    stopTimer(); stopMetro(); b.classList.add("on");
    var left=parseInt(b.getAttribute("data-rest"),10);
    function tick(){
      var m=Math.floor(left/60), s=left%60;
      setDisp(m+":"+(s<10?"0":"")+s,"REST",true);
      if(left<=0){
        stopTimer(); setDisp("0:00","GO!",true); disp.classList.add("flash");
        vib([300,120,300,120,700]); beep(880,.18); setTimeout(function(){beep(1175,.3);},220);
        setTimeout(function(){disp.classList.remove("flash"); idle();},2400);
        return;
      }
      left--;
    }
    tick(); timer=setInterval(tick,1000);
  });
});
$$("[data-met]").forEach(function(b){
  b.addEventListener("click",function(){
    if(b.classList.contains("on")){stopMetro(); idle(); return;}
    stopTimer(); stopMetro(); b.classList.add("on");
    var phases=b.getAttribute("data-met")==="9"?[["DOWN",3],["HOLD",3],["UP",3]]:[["DOWN",3],["UP",3]];
    var pi=0, left=phases[0][1];
    function cue(name){vib(name==="DOWN"?[180]:name==="HOLD"?[70,60,70]:[350]); beep(name==="UP"?1047:name==="HOLD"?784:523,.12);}
    cue(phases[0][0]);
    function tick(){
      setDisp(String(left),phases[pi][0],true);
      left--;
      if(left<0){pi=(pi+1)%phases.length; left=phases[pi][1]-1; cue(phases[pi][0]); setDisp(String(left+1),phases[pi][0],true);}
    }
    tick(); metro=setInterval(tick,1000);
  });
});
$("#metStop").addEventListener("click",function(){stopMetro(); stopTimer(); idle();});

/* ---------- wake lock ---------- */
var wakeLock=null, wakeOn=false;
function reqWake(){
  if(!("wakeLock" in navigator)){$("#wakeT").textContent="☀ Not supported"; return;}
  navigator.wakeLock.request("screen").then(function(wl){
    wakeLock=wl; wakeOn=true; $("#wakeT").classList.add("on");
    wl.addEventListener("release",function(){if(wakeOn)$("#wakeT").classList.remove("on");});
  }).catch(function(){});
}
$("#wakeT").addEventListener("click",function(){
  if(wakeOn){wakeOn=false; if(wakeLock)wakeLock.release(); wakeLock=null; this.classList.remove("on");}
  else reqWake();
});
document.addEventListener("visibilitychange",function(){if(wakeOn&&document.visibilityState==="visible")reqWake();});

/* ---------- day tabs ---------- */
function showDay(d){
  state.activeDay=d; save();
  $$(".dayTab").forEach(function(b){b.classList.toggle("sel",b.getAttribute("data-day")===d);});
  var p1=$("#panel-day1"), p2=$("#panel-day2");
  if(p1)p1.hidden=(d!=="day1");
  if(p2)p2.hidden=(d!=="day2");
  renderWarmup(d);
}
$$(".dayTab").forEach(function(b){b.addEventListener("click",function(){showDay(b.getAttribute("data-day"));});});

/* ---------- adaptive bar: tap an exercise to pre-arm its rest + tempo ---------- */
function armExercise(id){
  var ex=exById(id); if(!ex)return;
  activeEx=id;
  $$(".ex").forEach(function(c){c.classList.toggle("active",c.id==="ex_"+id);});
  var rest=restFor(ex), tempo=tempoFor(ex);
  $$("[data-rest]").forEach(function(b){b.classList.toggle("armed",parseInt(b.getAttribute("data-rest"),10)===rest);});
  $$("[data-met]").forEach(function(b){b.classList.toggle("armed",tempo!==null&&b.getAttribute("data-met")===tempo);});
}

/* ---------- init ---------- */
render();
showDay(state.activeDay||"day1");
/* restore checkboxes + section open states */
$$("input[type=checkbox][data-k]").forEach(function(c){c.checked=!!state.v[c.getAttribute("data-k")];});
var bwEl=$("#bw"); if(bwEl&&state.v["bw"]!==undefined&&state.v["bw"]!=="")bwEl.value=state.v["bw"];
["sec-warm","sec-res"].forEach(function(id){
  var el=$("#"+id); if(el&&state.open[id]!==undefined)el.open=state.open[id];
});
var notesEl=$("textarea[data-k=notes]"); if(notesEl&&state.v["notes"])notesEl.value=state.v["notes"];
progress();
