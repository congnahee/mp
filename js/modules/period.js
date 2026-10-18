"use strict";
const PeriodManager={
  start(cid,type,label,startDate,endDate){ensureClassData(cid);if(activePeriod(cid)){uiAlert('진행 중인 기간이 있어요. 먼저 마감해주세요.');return;}const p={id:uid(),type,label:label||PeriodManager.defaultLabel(type),status:'active',startedAt:Date.now(),closedAt:null,startDate:startDate||'',endDate:endDate||''};DB.periods[cid].push(p);DB.scores[cid][p.id]={};DB.history[cid][p.id]=[];DB.teamScores[cid][p.id]={};persistAndRender();},
  resetActive(cid){const p=activePeriod(cid);if(!p)return;DB.scores[cid][p.id]={};DB.history[cid][p.id]=[];DB.teamScores[cid][p.id]={};persistAndRender();},
  updateActive(cid,label,startDate,endDate){const p=activePeriod(cid);if(!p)return;if(label)p.label=label;p.startDate=startDate||'';p.endDate=endDate||'';persistAndRender();},
  defaultLabel(type){const d=new Date();if(type==='week')return`${d.getMonth()+1}월 ${Math.ceil(d.getDate()/7)}주차`;if(type==='month')return`${d.getMonth()+1}월`;return`${d.getFullYear()}학년도 학기`;},
  close(cid){const p=activePeriod(cid);if(!p)return;p.status='closed';p.closedAt=Date.now();persistAndRender();}
};

"use strict";
Object.assign(PeriodManager,{
  render(cid){PeriodManager.renderChip(cid);PeriodManager.renderSettings(cid);},
  renderChip(cid){
    const chip=$('#periodChip');if(!chip)return;if(!cid){chip.innerHTML='<span>기간 없음</span>';chip.onclick=null;return;}const p=activePeriod(cid);
    if(!p){chip.innerHTML='<span>기간 없음</span>';chip.style.cursor='pointer';chip.onclick=()=>{openModal('#modalSettings');switchStab('period');};return;}
    const range=p.startDate?`<span class="num" style="font-size:10px;">${p.startDate}~${p.endDate||'미정'}</span>`:'';chip.innerHTML=`<b>${p.label}</b>${range}<span>진행중</span> <span style="cursor:pointer;color:var(--loss);" id="closePeriodInline">마감</span>`;chip.onclick=null;
    $('#closePeriodInline').onclick=e=>{e.stopPropagation();uiConfirm(`'${p.label}' 기간을 마감할까요? 마감 후에는 점수를 더 쌓을 수 없어요.`,()=>PeriodManager.close(cid));};
  },
  renderSettings(cid){
    const history=$('#periodHistory');history.innerHTML='';if(cid)(DB.periods[cid]||[]).filter(p=>p.status==='closed').slice().reverse().forEach(p=>{const row=document.createElement('div');row.className='row-item';const range=p.startDate?` (${p.startDate}~${p.endDate||'미정'})`:'';row.innerHTML=`<span>${p.label}${range}</span><span class="num" style="color:var(--text-dim);">마감됨</span>`;history.appendChild(row);});
    const wrap=$('#activePeriodEditor');if(!wrap)return;if(!cid){wrap.innerHTML='';return;}const p=activePeriod(cid);if(!p){wrap.innerHTML='<div class="hint">진행 중인 기간이 없어요. 아래에서 새로 시작하세요.</div>';return;}
    wrap.innerHTML=`<h4>진행 중인 기간 수정</h4><div class="field"><input id="editPeriodLabel" value="${p.label}"></div><div class="field">${dateFieldHTML('editPeriodStart',p.startDate)}${dateFieldHTML('editPeriodEnd',p.endDate)}</div><div style="display:flex;gap:8px;"><button class="ghost-btn" id="saveActivePeriodBtn" style="flex:1;">저장</button><button class="ghost-btn" id="resetActivePeriodBtn" style="flex:1;color:var(--loss);">🔄 점수 초기화</button></div><div class="hint">점수 초기화는 현재 기간의 점수·채점 이력만 지우고 0점부터 다시 시작해요.</div>`;
    $('#saveActivePeriodBtn').onclick=()=>PeriodManager.updateActive(cid,$('#editPeriodLabel').value.trim(),$('#editPeriodStart').value,$('#editPeriodEnd').value);$('#resetActivePeriodBtn').onclick=()=>uiConfirm(`'${p.label}' 기간의 점수와 채점 이력을 모두 초기화할까요? 되돌릴 수 없어요.`,()=>PeriodManager.resetActive(cid));
  }
});

"use strict";
PeriodManager.init=function(){
  $('#periodTypeSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#periodTypeSeg button').forEach(x=>x.classList.toggle('active',x===b));$('#periodType').value=b.dataset.val;};
  $('#startPeriodBtn').onclick=()=>{const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}PeriodManager.start(cid,$('#periodType').value,$('#periodLabel').value.trim(),$('#periodStart').value,$('#periodEnd').value);$('#periodLabel').value='';resetDateField('periodStart');resetDateField('periodEnd');};
  $('#btnResetScores').onclick=()=>{const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}const p=activePeriod(cid);if(!p){uiAlert('진행 중인 기간이 없어요.');return;}uiConfirm(`'${p.label}' 기간의 점수와 채점 이력을 모두 초기화할까요? 되돌릴 수 없어요.`,()=>PeriodManager.resetActive(cid));};
};

"use strict";
AppFeatures.register('periods',{order:20,init:PeriodManager.init,render:PeriodManager.render});

