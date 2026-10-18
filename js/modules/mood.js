"use strict";
const MoodModule={
  setScore(cid,dateStr,studentId,timing,value){ensureClassData(cid);if(!DB.moodLogs[cid][dateStr])DB.moodLogs[cid][dateStr]={};if(!DB.moodLogs[cid][dateStr][studentId])DB.moodLogs[cid][dateStr][studentId]={before:null,after:null};DB.moodLogs[cid][dateStr][studentId][timing]=value;scheduleSave();},
  getScore(cid,dateStr,studentId,timing){const day=(DB.moodLogs[cid]||{})[dateStr];if(!day||!day[studentId])return null;const v=day[studentId][timing];return v===undefined?null:v;},
  getDay(cid,dateStr){return(DB.moodLogs[cid]||{})[dateStr]||{};},
  availableDates(cid){return Object.keys(DB.moodLogs[cid]||{}).sort().reverse();}
};

"use strict";
Object.assign(MoodModule,{
  open(){const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}const input=$('#moodDate');if(!input.value){const today=formatDateYMD(new Date());input.value=today;$('#moodDate_label').textContent=formatDateDisplay(today);$('#moodDate_label').classList.remove('ph');}MoodModule.renderList();openModal('#modalMood');},
  renderList(){const cid=DB.activeClassId,list=$('#moodList');if(!cid||!list)return;const date=$('#moodDate').value||formatDateYMD(new Date());list.innerHTML='';const students=DB.students[cid]||[];if(!students.length){list.innerHTML='<div class="hint">등록된 학생이 없어요. 설정 ⚙ &gt; 학생 관리에서 먼저 추가해주세요.</div>';return;}const day=MoodModule.getDay(cid,date);students.forEach(s=>{const rec=day[s.id]||{before:null,after:null},row=document.createElement('div');row.className='mood-row';row.innerHTML=`<div class="mood-name">${s.name}</div><div class="mood-pair"><div class="mood-slot"><div class="mood-slot-label">수업 전</div><div class="thermo" id="thermo-${s.id}-before"></div><div class="mood-stepper"><button type="button" data-sid="${s.id}" data-timing="before" data-dir="-1">−</button><span class="mood-val" id="val-${s.id}-before">${rec.before===null?'-':rec.before}</span><button type="button" data-sid="${s.id}" data-timing="before" data-dir="1">+</button></div></div><div class="mood-slot"><div class="mood-slot-label">수업 후</div><div class="thermo" id="thermo-${s.id}-after"></div><div class="mood-stepper"><button type="button" data-sid="${s.id}" data-timing="after" data-dir="-1">−</button><span class="mood-val" id="val-${s.id}-after">${rec.after===null?'-':rec.after}</span><button type="button" data-sid="${s.id}" data-timing="after" data-dir="1">+</button></div></div></div>`;list.appendChild(row);renderThermometer($(`#thermo-${s.id}-before`),rec.before);renderThermometer($(`#thermo-${s.id}-after`),rec.after);});}
});

"use strict";
MoodModule.adjustGraph=function(button){const cid=DB.activeClassId;if(!cid)return;const date=GraphRenderer.moodDate||formatDateYMD(new Date()),sid=button.dataset.sid,timing=button.dataset.timing,dir=Number(button.dataset.dir),cur=MoodModule.getScore(cid,date,sid,timing),next=clamp((cur===null?0:cur)+dir,0,10);MoodModule.setScore(cid,date,sid,timing,next);const col=button.closest('.mood-graph-col'),slot=col.querySelectorAll('.mood-graph-slot')[timing==='before'?0:1];renderThermometer(slot.querySelector('.thermo'),next);slot.querySelector('.mood-graph-value').textContent=next;flashSaveStatus();};
MoodModule.init=function(){
  $('#btnMood').onclick=MoodModule.open;$('#moodList').onclick=e=>{const b=e.target.closest('button[data-sid]'),cid=DB.activeClassId;if(!b||!cid)return;const date=$('#moodDate').value||formatDateYMD(new Date()),sid=b.dataset.sid,timing=b.dataset.timing,cur=MoodModule.getScore(cid,date,sid,timing),next=clamp((cur===null?0:cur)+Number(b.dataset.dir),0,10);MoodModule.setScore(cid,date,sid,timing,next);renderThermometer($(`#thermo-${sid}-${timing}`),next);$(`#val-${sid}-${timing}`).textContent=next;flashSaveStatus();if(DB.graphType[cid]==='mood'&&date===formatDateYMD(new Date()))GraphRenderer.render(cid);};
  document.addEventListener('click',e=>{const b=e.target.closest('.mood-graph-stepper button');if(b)MoodModule.adjustGraph(b);});document.addEventListener('app:date-picked',e=>{if(e.detail.targetId==='moodDate')MoodModule.renderList();if(e.detail.targetId==='moodGraphDate'){GraphRenderer.moodDate=e.detail.value||formatDateYMD(new Date());if(DB.activeClassId)GraphRenderer.render(DB.activeClassId);}});
};

"use strict";
AppFeatures.register('mood',{order:80,init:MoodModule.init});

