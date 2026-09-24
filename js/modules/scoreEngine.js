"use strict";
/* ============================================================
   SCORING MODULE — 점수 변경, 대상 선택, 채점 버튼, 이력 화면
============================================================ */
const ScoreEngine = {
  apply(cid,targetType,targetId,delta,note){
    const p=activePeriod(cid);if(!p){uiAlert('먼저 기간을 시작해주세요 (설정 > 기간 관리)');return;}
    const pool=targetType==='team'?currentTeamScores(cid):currentScores(cid);
    pool[targetId]=(pool[targetId]||0)+delta;
    currentHistory(cid).push({id:uid(),targetType,targetId,delta,ts:Date.now(),note:note||''});persistAndRender();return pool[targetId];
  },
  editHistoryEntry(cid,entryId,newDelta){const hist=currentHistory(cid),entry=hist.find(h=>h.id===entryId);if(!entry)return;const pool=entry.targetType==='team'?currentTeamScores(cid):currentScores(cid);pool[entry.targetId]=(pool[entry.targetId]||0)-entry.delta+newDelta;entry.delta=newDelta;persistAndRender();},
  removeHistoryEntry(cid,entryId){const hist=currentHistory(cid),idx=hist.findIndex(h=>h.id===entryId);if(idx<0)return;const entry=hist[idx],pool=entry.targetType==='team'?currentTeamScores(cid):currentScores(cid);pool[entry.targetId]=(pool[entry.targetId]||0)-entry.delta;hist.splice(idx,1);persistAndRender();},
  currentPoints(cid){const sel=DB.selection[cid],q=typeof QuizModule!=='undefined'?QuizModule.liveQuiz(cid):null,cur=q?q.questions[q.currentIndex]:null;return(q&&q.mode==='B'&&cur)?cur.points:sel.points;},
  grade(cid,targetType,targetId,delta,note){ScoreEngine.apply(cid,targetType,targetId,delta,note);requestAnimationFrame(()=>GraphRenderer.burst(targetId,delta>=0));},
  select(cid,targetType,targetId){if(DB.activeClassId!==cid)return;DB.selection[cid].targetType=targetType;DB.selection[cid].targetId=targetId;render();},
  attachSelection(chip,cid,targetType,id){
    chip.setAttribute('role','button');chip.tabIndex=0;chip.setAttribute('aria-pressed',String(DB.selection[cid].targetType===targetType&&DB.selection[cid].targetId===id));
    const choose=()=>ScoreEngine.select(cid,targetType,id);chip.onclick=choose;chip.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
  },
  render(cid){ScoreEngine.renderMode(cid);ScoreEngine.renderTargets(cid);ScoreEngine.renderControls(cid);},
  renderMode(cid){const mode=$('#modeSwitch');if(!cid){mode.style.display='none';return;}mode.style.display=DB.teamsEnabled[cid]?'flex':'none';$$('#modeSwitch .icon-btn').forEach(b=>b.classList.toggle('active',b.dataset.m===DB.viewMode[cid]));},
  renderTargets(cid){
    const strip=$('#studentStrip');strip.innerHTML='';if(!cid)return;const sel=DB.selection[cid];
    if(sel.targetType==='team'&&DB.teamsEnabled[cid]){
      const scoreMap=new Map(RankingModule.computeTeams(cid).map(t=>[t.id,t.score]));
      (DB.teams[cid]||[]).forEach(t=>{const chip=document.createElement('div');chip.className='stu-chip'+(sel.targetId===t.id?' selected':'');chip.innerHTML=`<div>👥 ${t.name}</div><div class="s num">${scoreMap.get(t.id)??0}</div>`;ScoreEngine.attachSelection(chip,cid,'team',t.id);strip.appendChild(chip);});
      const add=document.createElement('div');add.className='stu-chip add';add.textContent='+';add.title='팀 추가';add.onclick=()=>uiPrompt('새 팀 이름을 입력하세요','',name=>{const v=(name||'').trim();if(v)TeamModule.addTeam(cid,v);});strip.appendChild(add);
    }else{
      const scores=currentScores(cid);(DB.students[cid]||[]).forEach(s=>{const chip=document.createElement('div');chip.className='stu-chip'+(sel.targetType==='student'&&sel.targetId===s.id?' selected':'');chip.innerHTML=`<div>${s.name}</div><div class="s num">${scores[s.id]||0}</div>`;ScoreEngine.attachSelection(chip,cid,'student',s.id);strip.appendChild(chip);});
      const add=document.createElement('div');add.className='stu-chip add';add.textContent='+';add.title='학생 추가';add.onclick=()=>uiPrompt('새 학생 이름을 입력하세요','',name=>{const v=(name||'').trim();if(v)RosterModule.addStudent(cid,v);});strip.appendChild(add);
    }
  },
  renderControls(cid){
    if(!cid){$('#btnCorrect').disabled=true;$('#btnWrong').disabled=true;return;}
    const sel=DB.selection[cid],has=sel.targetType==='team'?(DB.teams[cid]||[]).some(t=>t.id===sel.targetId):(DB.students[cid]||[]).some(s=>s.id===sel.targetId);
    $('#btnCorrect').disabled=!has;$('#btnWrong').disabled=!has;$$('#brushRow button[data-v]').forEach(b=>b.disabled=!has);
    const q=typeof QuizModule!=='undefined'?QuizModule.liveQuiz(cid):null;$('#pointStepper').style.display=q&&q.mode==='B'?'none':'flex';
    const input=$('#ptVal');if(document.activeElement!==input)input.value=sel.points;
  },
  setPoints(value){const cid=DB.activeClassId;if(!cid)return;const parsed=Number(value);if(!Number.isFinite(parsed)){$('#ptVal').value=DB.selection[cid].points;return;}DB.selection[cid].points=clamp(Math.round(parsed),1,100);$('#ptVal').value=DB.selection[cid].points;},
  scoreAction(correct){const cid=DB.activeClassId;if(!cid)return;const sel=DB.selection[cid];if(!sel.targetId)return;const q=typeof QuizModule!=='undefined'?QuizModule.liveQuiz(cid):null,cur=q?q.questions[q.currentIndex]:null,pts=ScoreEngine.currentPoints(cid);ScoreEngine.grade(cid,sel.targetType,sel.targetId,correct?pts:-pts,cur?cur.text:'즉석채점');},
  renderHistory(){
    const cid=DB.activeClassId,list=$('#histList');list.innerHTML='';if(!cid){list.innerHTML='<div class="hint">반을 먼저 선택하세요</div>';return;}
    const hist=currentHistory(cid).slice().sort((a,b)=>b.ts-a.ts),students=DB.students[cid]||[],teams=DB.teams[cid]||[];if(!hist.length){list.innerHTML='<div class="hint">아직 채점 이력이 없어요</div>';return;}
    hist.forEach(h=>{const team=h.targetType==='team',target=team?teams.find(x=>x.id===h.targetId):students.find(x=>x.id===h.targetId),label=target?(team?`👥 ${target.name}`:target.name):(team?'(삭제된 팀)':'(삭제된 학생)'),row=document.createElement('div');row.className='row-item';row.innerHTML=`<span>${label} · <span class="num" style="color:${h.delta>=0?'var(--gain)':'var(--loss)'}">${h.delta>0?'+':''}${h.delta}</span> <span style="color:var(--text-dim2);font-size:11px;">${h.note||''}</span></span><span><span class="x" data-edit style="color:var(--blue);margin-right:8px;">수정</span><span class="x" data-del>취소</span></span>`;row.querySelector('[data-del]').onclick=()=>uiConfirm(`${label}의 ${h.delta>0?'+':''}${h.delta}점 기록을 취소할까요?`,()=>{ScoreEngine.removeHistoryEntry(cid,h.id);ScoreEngine.renderHistory();});row.querySelector('[data-edit]').onclick=()=>uiPrompt('새 증감값을 입력하세요 (음수 가능)',h.delta,nv=>{const num=Number(nv);if(Number.isNaN(num)){uiAlert('숫자를 입력해주세요');return;}ScoreEngine.editHistoryEntry(cid,h.id,num);ScoreEngine.renderHistory();});list.appendChild(row);});
  },
  init(){
    $('#brushRow').onclick=e=>{const cid=DB.activeClassId,b=e.target.closest('button[data-v]');if(!cid||!b||b.disabled)return;const sel=DB.selection[cid];if(sel.targetId)ScoreEngine.grade(cid,sel.targetType,sel.targetId,Number(b.dataset.v),'즉석채점');};
    $('#modeSwitch').onclick=e=>{const b=e.target.closest('.icon-btn'),cid=DB.activeClassId;if(!b||!cid)return;DB.viewMode[cid]=b.dataset.m;DB.selection[cid].targetType=b.dataset.m;DB.selection[cid].targetId=null;persistAndRender();};
    $('#ptMinus').onclick=()=>{const cid=DB.activeClassId;if(cid)ScoreEngine.setPoints(DB.selection[cid].points-1);};$('#ptPlus').onclick=()=>{const cid=DB.activeClassId;if(cid)ScoreEngine.setPoints(DB.selection[cid].points+1);};
    $('#ptVal').onchange=e=>ScoreEngine.setPoints(e.target.value);$('#ptVal').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ScoreEngine.setPoints(e.target.value);e.target.blur();}};
    $('#btnCorrect').onclick=()=>ScoreEngine.scoreAction(true);$('#btnWrong').onclick=()=>ScoreEngine.scoreAction(false);
    $('#btnHistory').onclick=()=>{ScoreEngine.renderHistory();openModal('#modalHistory');};
  }
};

AppFeatures.register('scoring',{order:40,init:ScoreEngine.init,render:ScoreEngine.render});
