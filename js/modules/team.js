"use strict";
const TeamModule={
  setEnabled(cid,enabled){ensureClassData(cid);DB.teamsEnabled[cid]=enabled;if(!enabled&&DB.viewMode[cid]==='team'){DB.viewMode[cid]='student';DB.selection[cid].targetType='student';DB.selection[cid].targetId=null;}persistAndRender();},
  addTeam(cid,name){ensureClassData(cid);DB.teams[cid].push({id:uid(),name});persistAndRender();},
  renameTeam(cid,tid,name){const t=(DB.teams[cid]||[]).find(x=>x.id===tid);if(!t||!name)return;t.name=name;persistAndRender();},
  removeTeam(cid,tid){DB.teams[cid]=DB.teams[cid].filter(t=>t.id!==tid);const map=DB.studentTeam[cid]||{};Object.keys(map).forEach(sid=>{if(map[sid]===tid)map[sid]=null;});if(DB.selection[cid].targetId===tid)DB.selection[cid].targetId=null;persistAndRender();},
  assignStudent(cid,sid,tid){ensureClassData(cid);DB.studentTeam[cid][sid]=tid||null;persistAndRender();},
  teamOf(cid,sid){return(DB.studentTeam[cid]||{})[sid]||null;},
  membersOf(cid,tid){return(DB.students[cid]||[]).filter(s=>TeamModule.teamOf(cid,s.id)===tid);},
  setColor(cid,tid,color){const t=(DB.teams[cid]||[]).find(x=>x.id===tid);if(!t)return;if(color)t.color=color;else delete t.color;persistAndRender();}
};

"use strict";
TeamModule.render=function(cid){
  const state=$('#teamToggleState'),body=$('#teamManageBody'),toggle=$('#teamToggleRow');if(!state||!body)return;
  if(!cid){state.textContent='';body.innerHTML='<div class="hint">반을 먼저 선택하세요</div>';toggle.onclick=null;return;}
  const enabled=!!DB.teamsEnabled[cid];state.textContent=enabled?'ON':'OFF';state.style.color=enabled?'var(--gain)':'var(--text-dim2)';toggle.onclick=()=>TeamModule.setEnabled(cid,!enabled);
  if(!enabled){body.innerHTML='<div class="hint" style="margin-top:10px;">팀 기능을 켜면 팀 이름을 등록하고 학생을 배정할 수 있어요.</div>';return;}
  body.innerHTML=`<h4>팀 목록</h4><div class="field"><input id="newTeamName" placeholder="팀 이름 (예: 불꽃조)"></div><button class="primary-btn" id="addTeamBtn">+ 팀 추가</button><div id="teamList" style="margin-top:8px;"></div><h4>학생 팀 배정</h4><div id="assignList"></div><button class="primary-btn" id="applyTeamColorsBtn" style="background:var(--gain);color:#0A0820;margin-top:10px;">✅ 그래프에 적용하고 확인하기</button>`;
  const teams=DB.teams[cid]||[],teamList=$('#teamList');if(!teams.length)teamList.innerHTML='<div class="hint">아직 등록된 팀이 없어요.</div>';
  teams.forEach(t=>{const row=document.createElement('div');row.className='row-item';row.innerHTML=`<span>${t.name} <span style="color:var(--text-dim2);">(${TeamModule.membersOf(cid,t.id).length}명)</span></span><span class="row-right">${colorSwatchHTML('team',t.id,t.color)}<span class="x" data-edit style="color:var(--blue);">수정</span><span class="x" data-del>삭제</span></span>`;row.querySelector('[data-edit]').onclick=()=>uiPrompt('팀 이름을 수정하세요',t.name,name=>{const v=(name||'').trim();if(v)TeamModule.renameTeam(cid,t.id,v);});row.querySelector('[data-del]').onclick=()=>uiConfirm(`'${t.name}' 팀을 삭제할까요? 소속 학생은 미배정 상태가 돼요.`,()=>TeamModule.removeTeam(cid,t.id));teamList.appendChild(row);});
  $('#addTeamBtn').onclick=()=>{const input=$('#newTeamName'),v=input.value.trim();if(v){TeamModule.addTeam(cid,v);input.value='';}};$('#applyTeamColorsBtn').onclick=()=>{persistAndRender();closeModal('#modalSettings');};
  const assign=$('#assignList'),students=DB.students[cid]||[];if(!students.length)assign.innerHTML='<div class="hint">등록된 학생이 없어요.</div>';
  students.forEach(s=>{const row=document.createElement('div');row.className='row-item';const current=TeamModule.teamOf(cid,s.id),currentName=teams.find(t=>t.id===current)?.name||'미배정';row.innerHTML=`<span>${s.name}</span><div class="mini-dropdown"><button type="button" class="mini-dropdown-btn">${currentName} ▾</button><div class="mini-dropdown-menu"><button type="button" data-tid="" class="${!current?'active':''}">미배정</button>${teams.map(t=>`<button type="button" data-tid="${t.id}" class="${t.id===current?'active':''}">${t.name}</button>`).join('')}</div></div>`;const menu=row.querySelector('.mini-dropdown-menu');row.querySelector('.mini-dropdown-btn').onclick=e=>{e.stopPropagation();$$('.mini-dropdown-menu.open').forEach(m=>{if(m!==menu)m.classList.remove('open');});menu.classList.toggle('open');};menu.onclick=e=>{const b=e.target.closest('button');if(b)TeamModule.assignStudent(cid,s.id,b.dataset.tid||null);};assign.appendChild(row);});
};

"use strict";
TeamModule.init=function(){document.addEventListener('click',e=>{if(!e.target.closest('.mini-dropdown'))$$('.mini-dropdown-menu.open').forEach(m=>m.classList.remove('open'));});};

"use strict";
AppFeatures.register('teams',{order:30,init:TeamModule.init,render:TeamModule.render});

