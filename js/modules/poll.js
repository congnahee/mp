"use strict";

/* ============================================================
   LIVE POLL MODULE
   - 선생님: 설문 작성, 공통/개별 QR, 직접 입력, 실시간 결과
   - 학생: student.html에서 번호 선택 후 응답
   - 저장: 기존 DB + 같은 브라우저 localStorage + 배포 서버 API
============================================================ */
const PollModule={
  tab:'library', draft:null, selectedMode:'shared_number', activeSessionId:null,
  assistStudentId:null, refreshTimer:null, channel:null, networkBase:null,
  modes:{
    shared_number:{icon:'▦',title:'공통 QR',desc:'학생번호 선택'},
    individual:{icon:'▥',title:'학생별',desc:'개별 QR'},
    teacher:{icon:'👩‍🏫',title:'선생님과',desc:'함께 선택'},
    anonymous:{icon:'◌',title:'익명',desc:'참여'}
  },
  esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));},
  clone(value){return JSON.parse(JSON.stringify(value));},
  emptyPoll(){return{id:uid(),title:'',questions:[{id:uid(),text:'',options:[{id:uid(),text:''},{id:uid(),text:''},{id:uid(),text:''},{id:uid(),text:''}]}],createdAt:Date.now(),updatedAt:Date.now()};},
  sessions(cid){ensureClassData(cid);return DB.pollSessions[cid]||[];},
  polls(cid){ensureClassData(cid);return DB.polls[cid]||[];},
  activeSession(cid){
    const sessions=PollModule.sessions(cid);
    return sessions.find(s=>s.id===PollModule.activeSessionId)||sessions.find(s=>s.status==='live')||null;
  },
  open(tab){
    const cid=DB.activeClassId;
    if(!cid){uiAlert('반을 먼저 선택해주세요.');return;}
    PollModule.tab=tab||((PollModule.sessions(cid).some(s=>s.status==='live'))?'live':'library');
    openModal('#modalPoll');
    PollModule.render(cid);
    PollModule.startRefresh();
  },
  startRefresh(){
    clearInterval(PollModule.refreshTimer);
    PollModule.refreshTimer=setInterval(()=>{
      if(!$('#modalPoll').classList.contains('open')) return;
      const cid=DB.activeClassId,session=cid&&PollModule.activeSession(cid);
      if(session&&session.status==='live') PollModule.refreshSession(session);
    },2500);
  },
  render(cid){
    const root=$('#pollRoot');
    if(!root)return;
    if(!cid){root.innerHTML='<div class="poll-empty">반을 먼저 선택해주세요.</div>';return;}
    const live=PollModule.activeSession(cid);
    root.innerHTML=`<div class="poll-head"><h3>📊 MP 설문</h3>${live&&live.status==='live'?'<span class="poll-live-badge">● LIVE</span>':''}</div>
      <div class="poll-tabs">
        <button data-poll-tab="library" class="${PollModule.tab==='library'?'active':''}">설문 목록</button>
        <button data-poll-tab="builder" class="${PollModule.tab==='builder'?'active':''}">새 설문</button>
        <button data-poll-tab="live" class="${PollModule.tab==='live'?'active':''}">진행 화면</button>
        <button data-poll-tab="history" class="${PollModule.tab==='history'?'active':''}">지난 결과</button>
      </div><div id="pollPanel"></div>`;
    root.querySelectorAll('[data-poll-tab]').forEach(btn=>btn.onclick=()=>{
      const tab=btn.dataset.pollTab;
      if(tab==='builder'&&!PollModule.draft)PollModule.draft=PollModule.emptyPoll();
      PollModule.tab=tab;PollModule.render(cid);
    });
    if(PollModule.tab==='builder')PollModule.renderBuilder(cid);
    else if(PollModule.tab==='live')PollModule.renderLive(cid);
    else if(PollModule.tab==='history')PollModule.renderHistory(cid);
    else PollModule.renderLibrary(cid);
    PollModule.updateButton(cid);
  },
  updateButton(cid){
    const btn=$('#btnPoll');if(!btn)return;
    const live=cid&&PollModule.sessions(cid).some(s=>s.status==='live');
    btn.classList.toggle('live',!!live);btn.textContent=live?'📊 설문 진행중':'📊 설문';
  },
  renderLibrary(cid){
    const panel=$('#pollPanel'),polls=PollModule.polls(cid);
    let html=`<div class="poll-actions" style="justify-content:space-between;margin:0 0 12px"><div class="hint">질문과 선택지는 선생님이 직접 만들고 학생별로 저장할 수 있어요.</div><button class="primary-btn" id="pollNewBtn">＋ 새 설문</button></div>`;
    if(!polls.length)html+='<div class="poll-empty">아직 만든 설문이 없습니다.<br>새 설문을 만들어보세요.</div>';
    else html+=polls.slice().sort((a,b)=>b.updatedAt-a.updatedAt).map(p=>`<div class="poll-card"><div class="poll-card-title"><span>📋 ${PollModule.esc(p.title||'제목 없는 설문')}</span><span class="spacer"></span><span class="poll-chip">${p.questions.length}문항</span></div><div class="poll-meta">최근 수정 ${new Date(p.updatedAt||p.createdAt).toLocaleString('ko-KR')}</div><div class="poll-actions"><button class="ghost-btn" data-poll-edit="${p.id}">수정</button><button class="ghost-btn poll-danger" data-poll-delete="${p.id}">삭제</button><button class="primary-btn" data-poll-start="${p.id}">참여 방식 선택</button></div></div>`).join('');
    panel.innerHTML=html;
    $('#pollNewBtn').onclick=()=>{PollModule.draft=PollModule.emptyPoll();PollModule.selectedMode='shared_number';PollModule.tab='builder';PollModule.render(cid);};
    panel.querySelectorAll('[data-poll-edit]').forEach(b=>b.onclick=()=>{const p=polls.find(x=>x.id===b.dataset.pollEdit);PollModule.draft=PollModule.clone(p);PollModule.tab='builder';PollModule.render(cid);});
    panel.querySelectorAll('[data-poll-start]').forEach(b=>b.onclick=()=>{const p=polls.find(x=>x.id===b.dataset.pollStart);PollModule.draft=PollModule.clone(p);PollModule.selectedMode='shared_number';PollModule.tab='builder';PollModule.render(cid);});
    panel.querySelectorAll('[data-poll-delete]').forEach(b=>b.onclick=()=>uiConfirm('이 설문을 삭제할까요? 지난 발송 결과는 유지됩니다.',()=>{DB.polls[cid]=polls.filter(x=>x.id!==b.dataset.pollDelete);persistAndRender();PollModule.render(cid);}));
  },
  renderBuilder(cid){
    if(!PollModule.draft)PollModule.draft=PollModule.emptyPoll();
    const p=PollModule.draft,panel=$('#pollPanel');
    panel.innerHTML=`<div class="field"><label>설문 제목</label><input id="pollTitle" value="${PollModule.esc(p.title)}" placeholder="예: 오늘 수업 확인"></div>
      <div id="pollQuestionEditors">${p.questions.map((q,qi)=>PollModule.questionEditorHTML(q,qi)).join('')}</div>
      <button class="ghost-btn" id="pollAddQuestion" style="width:100%">＋ 질문 추가</button>
      <h4>참여 방식</h4><div class="poll-mode-grid">${Object.entries(PollModule.modes).map(([key,m])=>`<button class="poll-mode ${PollModule.selectedMode===key?'active':''}" data-poll-mode="${key}"><b>${m.icon}</b>${m.title}<br>${m.desc}</button>`).join('')}</div>
      <div class="hint">공통 QR은 학생이 자기 번호를 고릅니다. 개별 QR은 학생 번호가 자동 지정됩니다. 선생님과 함께 선택은 이 화면에서 학생별 답을 기록합니다.</div>
      <div class="poll-actions"><button class="ghost-btn" id="pollSaveDraft">저장</button><button class="primary-btn" id="pollStartNow">QR 만들고 시작</button></div>`;
    PollModule.bindBuilder(cid);
  },
  questionEditorHTML(q,qi){
    return `<div class="poll-question-editor" data-question-index="${qi}"><div class="poll-question-head"><span class="poll-question-number">Q${qi+1}</span><input class="poll-q-text" value="${PollModule.esc(q.text)}" placeholder="질문을 입력하세요"><button class="poll-icon-btn poll-remove-q" title="질문 삭제">✕</button></div><div class="poll-option-grid">${q.options.map((o,oi)=>`<div class="poll-option-row"><input class="poll-option-text" data-option-index="${oi}" value="${PollModule.esc(o.text)}" placeholder="선택지 ${oi+1}"><button class="poll-icon-btn poll-remove-option" data-option-index="${oi}">×</button></div>`).join('')}</div><button class="ghost-btn poll-add-option" style="margin-top:8px">＋ 선택지 추가</button></div>`;
  },
  captureBuilder(){
    const title=$('#pollTitle');if(title)PollModule.draft.title=title.value.trim();
    $$('.poll-question-editor').forEach(el=>{
      const qi=Number(el.dataset.questionIndex),q=PollModule.draft.questions[qi];if(!q)return;
      q.text=el.querySelector('.poll-q-text').value.trim();
      el.querySelectorAll('.poll-option-text').forEach(input=>{const o=q.options[Number(input.dataset.optionIndex)];if(o)o.text=input.value.trim();});
    });
    PollModule.draft.updatedAt=Date.now();
  },
  bindBuilder(cid){
    $('#pollTitle').oninput=()=>PollModule.captureBuilder();
    $$('.poll-q-text,.poll-option-text').forEach(input=>input.oninput=()=>PollModule.captureBuilder());
    $$('.poll-remove-q').forEach(btn=>btn.onclick=()=>{PollModule.captureBuilder();const qi=Number(btn.closest('[data-question-index]').dataset.questionIndex);if(PollModule.draft.questions.length===1){uiAlert('질문은 한 개 이상 필요합니다.');return;}PollModule.draft.questions.splice(qi,1);PollModule.render(cid);});
    $$('.poll-add-option').forEach(btn=>btn.onclick=()=>{PollModule.captureBuilder();const qi=Number(btn.closest('[data-question-index]').dataset.questionIndex);PollModule.draft.questions[qi].options.push({id:uid(),text:''});PollModule.render(cid);});
    $$('.poll-remove-option').forEach(btn=>btn.onclick=()=>{PollModule.captureBuilder();const qi=Number(btn.closest('[data-question-index]').dataset.questionIndex),q=PollModule.draft.questions[qi];if(q.options.length<=2){uiAlert('선택지는 두 개 이상 필요합니다.');return;}q.options.splice(Number(btn.dataset.optionIndex),1);PollModule.render(cid);});
    $('#pollAddQuestion').onclick=()=>{PollModule.captureBuilder();PollModule.draft.questions.push({id:uid(),text:'',options:[{id:uid(),text:''},{id:uid(),text:''}]});PollModule.render(cid);};
    $$('[data-poll-mode]').forEach(btn=>btn.onclick=()=>{PollModule.captureBuilder();PollModule.selectedMode=btn.dataset.pollMode;PollModule.render(cid);});
    $('#pollSaveDraft').onclick=()=>{if(PollModule.saveDraft(cid)){PollModule.tab='library';PollModule.render(cid);}};
    $('#pollStartNow').onclick=()=>{if(!PollModule.saveDraft(cid))return;PollModule.launch(cid,PollModule.draft.id,PollModule.selectedMode);};
  },
  validateDraft(){
    PollModule.captureBuilder();const p=PollModule.draft;
    if(!p.title)return '설문 제목을 입력해주세요.';
    if(!p.questions.length)return '질문을 한 개 이상 추가해주세요.';
    for(const q of p.questions){if(!q.text)return '모든 질문 내용을 입력해주세요.';const valid=q.options.filter(o=>o.text);if(valid.length<2)return '각 질문에는 선택지가 두 개 이상 필요합니다.';q.options=valid;}
    return '';
  },
  saveDraft(cid){
    const error=PollModule.validateDraft();if(error){uiAlert(error);return false;}
    const polls=PollModule.polls(cid),idx=polls.findIndex(x=>x.id===PollModule.draft.id);
    const saved=PollModule.clone(PollModule.draft);saved.updatedAt=Date.now();
    if(idx>=0)polls[idx]=saved;else polls.push(saved);
    PollModule.draft=PollModule.clone(saved);scheduleSave();return true;
  },
  makeCode(cid){
    const used=new Set(PollModule.sessions(cid).map(s=>s.code));let code='';
    do{code=String(Math.floor(1000+Math.random()*9000));}while(used.has(code));return code;
  },
  launch(cid,pollId,mode){
    const poll=PollModule.polls(cid).find(p=>p.id===pollId);if(!poll)return;
    PollModule.sessions(cid).forEach(s=>{if(s.status==='live'){s.status='ended';s.endedAt=Date.now();}});
    const session={id:uid(),code:PollModule.makeCode(cid),pollId,pollSnapshot:PollModule.clone(poll),mode,status:'live',responses:{},createdAt:Date.now(),startedAt:Date.now(),endedAt:null,adminToken:uid()+uid()};
    DB.pollSessions[cid].push(session);PollModule.activeSessionId=session.id;PollModule.assistStudentId=(DB.students[cid]||[])[0]?.id||null;
    PollModule.publishLocal(cid,session);PollModule.publishRemote(cid,session);scheduleSave();PollModule.tab='live';PollModule.render(cid);
  },
  publicSession(cid,session){
    return{id:session.id,code:session.code,title:session.pollSnapshot.title,className:activeClass()?.name||'MP 수업',mode:session.mode,status:session.status,questions:session.pollSnapshot.questions.map(q=>({id:q.id,text:q.text,options:q.options})),students:(DB.students[cid]||[]).map((s,i)=>({id:s.id,number:i+1})),startedAt:session.startedAt};
  },
  publishLocal(cid,session){
    try{localStorage.setItem(`mp-poll-session-${session.code}`,JSON.stringify(PollModule.publicSession(cid,session)));}catch(e){}
    PollModule.broadcast({type:'session',code:session.code});
  },
  async publishRemote(cid,session){
    if(!/^https?:$/.test(location.protocol))return;
    try{await fetch('/api/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish',session:PollModule.publicSession(cid,session),adminToken:session.adminToken})});}catch(e){}
  },
  broadcast(message){try{if(PollModule.channel)PollModule.channel.postMessage(message);}catch(e){}},
  joinUrl(session,studentId){
    const base=PollModule.networkBase?`${PollModule.networkBase.replace(/\/$/,'')}/`:location.href;
    const url=new URL('student.html',base);url.search='';url.hash='';url.searchParams.set('code',session.code);if(studentId)url.searchParams.set('sid',studentId);return url.href;
  },
  qrUrl(url){return `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(url)}`;},
  copy(text,message){
    const fallback=()=>uiPrompt(message||'아래 주소를 복사하세요.',text,()=>{});
    if(navigator.clipboard&&location.protocol!=='file:')navigator.clipboard.writeText(text).then(()=>uiAlert(message||'링크를 복사했습니다.')).catch(fallback);else fallback();
  },
  renderLive(cid){
    const panel=$('#pollPanel'),s=PollModule.activeSession(cid);
    if(!s){panel.innerHTML='<div class="poll-empty">진행 중인 설문이 없습니다.<br><button class="primary-btn" id="pollGoLibrary" style="margin-top:12px">설문 선택</button></div>';$('#pollGoLibrary').onclick=()=>{PollModule.tab='library';PollModule.render(cid);};return;}
    PollModule.collectLocalResponses(s);
    const students=DB.students[cid]||[],responses=Object.values(s.responses||{}).filter(r=>r.submittedAt),doneIds=new Set(responses.map(r=>r.studentId).filter(Boolean));
    const commonUrl=PollModule.joinUrl(s);
    const qrBlock=s.mode==='teacher'?'<div class="poll-card poll-qr-card"><div style="font-size:42px">👩‍🏫</div><div><b>선생님과 함께 선택</b><div class="poll-meta">학생을 선택하고 답을 직접 기록하세요.</div></div></div>':`<div class="poll-card poll-qr-card"><img class="poll-qr" src="${PollModule.qrUrl(commonUrl)}" alt="설문 참여 QR"><div><div class="poll-code">${s.code}</div><div class="poll-url">${PollModule.esc(commonUrl)}</div><button class="ghost-btn" id="pollCopyLink">참여 링크 복사</button>${s.mode==='individual'?'<button class="ghost-btn" id="pollShowIndividual">학생별 QR</button>':''}</div></div>`;
    panel.innerHTML=`<div class="poll-card-title"><span>${PollModule.esc(s.pollSnapshot.title)}</span><span class="spacer"></span><span class="poll-chip">${PollModule.modes[s.mode]?.title||s.mode}</span><span class="poll-chip">응답 ${responses.length}${s.mode==='anonymous'?'명':` / ${students.length}명`}</span></div><div class="poll-live-layout"><div>${qrBlock}</div><div><div class="poll-card-title">학생별 참여 현황</div>${s.mode==='anonymous'?`<div class="poll-empty" style="padding:18px">익명 응답 ${responses.length}명</div>`:`<div class="poll-status-grid">${students.map((st,i)=>`<div class="poll-status ${doneIds.has(st.id)?'done':''}" title="${PollModule.esc(st.name)}">${String(i+1).padStart(2,'0')}</div>`).join('')}</div><div class="poll-legend"><span>🟢 제출 완료 ${doneIds.size}</span><span>⚪ 미제출 ${Math.max(0,students.length-doneIds.size)}</span></div>`}${s.mode==='teacher'?PollModule.assistHTML(cid,s):''}</div></div><div id="pollResults">${PollModule.resultsHTML(cid,s)}</div><div class="poll-actions"><button class="ghost-btn" id="pollRefresh">↻ 새로고침</button><button class="ghost-btn" id="pollResponseDetail">학생별 응답</button><button class="primary-btn poll-danger" id="pollEnd">■ 설문 종료</button></div>`;
    const copy=$('#pollCopyLink');if(copy)copy.onclick=()=>PollModule.copy(commonUrl,'참여 링크를 복사했습니다.');
    const indiv=$('#pollShowIndividual');if(indiv)indiv.onclick=()=>PollModule.renderIndividualLinks(cid,s);
    $('#pollRefresh').onclick=()=>PollModule.refreshSession(s,true);
    $('#pollResponseDetail').onclick=()=>PollModule.renderResponseDetail(cid,s);
    $('#pollEnd').onclick=()=>uiConfirm('이 설문을 종료할까요? 결과는 지난 결과에 보관됩니다.',()=>PollModule.endSession(cid,s));
    PollModule.bindAssist(cid,s);
  },
  assistHTML(cid,s){
    const students=DB.students[cid]||[];if(!students.length)return '';
    if(!PollModule.assistStudentId)PollModule.assistStudentId=students[0].id;
    const student=students.find(x=>x.id===PollModule.assistStudentId)||students[0],response=s.responses[student.id]||{answers:{}};
    return `<div class="poll-card"><div class="poll-card-title">선생님 입력</div><div class="poll-assist-students">${students.map((st,i)=>`<button class="poll-assist-student ${st.id===student.id?'active':''}" data-assist-student="${st.id}">${i+1}. ${PollModule.esc(st.name)}</button>`).join('')}</div>${s.pollSnapshot.questions.map((q,qi)=>`<div style="margin-top:10px"><b>Q${qi+1}. ${PollModule.esc(q.text)}</b><div class="poll-assist-options">${q.options.map(o=>`<button class="poll-assist-option ${response.answers?.[q.id]===o.id?'selected':''}" data-assist-q="${q.id}" data-assist-option="${o.id}">${PollModule.esc(o.text)}</button>`).join('')}</div></div>`).join('')}<button class="primary-btn" id="pollAssistSave" style="width:100%;margin-top:10px">${PollModule.esc(student.name)} 응답 저장</button></div>`;
  },
  bindAssist(cid,s){
    $$('[data-assist-student]').forEach(btn=>btn.onclick=()=>{PollModule.assistStudentId=btn.dataset.assistStudent;PollModule.render(cid);});
    $$('[data-assist-option]').forEach(btn=>btn.onclick=()=>{const sid=PollModule.assistStudentId;if(!s.responses[sid])s.responses[sid]={participantKey:sid,studentId:sid,answers:{},submittedAt:null};s.responses[sid].answers[btn.dataset.assistQ]=btn.dataset.assistOption;PollModule.render(cid);});
    const save=$('#pollAssistSave');if(save)save.onclick=()=>{const sid=PollModule.assistStudentId,st=(DB.students[cid]||[]).find(x=>x.id===sid);if(!s.responses[sid]||Object.keys(s.responses[sid].answers||{}).length<s.pollSnapshot.questions.length){uiAlert('모든 질문의 답을 선택해주세요.');return;}Object.assign(s.responses[sid],{studentName:st?.name||'',studentNumber:(DB.students[cid]||[]).findIndex(x=>x.id===sid)+1,submittedAt:Date.now()});PollModule.storeLocalResponse(s,s.responses[sid]);PollModule.sendRemoteResponse(s,s.responses[sid]);scheduleSave();PollModule.render(cid);};
  },
  resultsHTML(cid,s){
    const responses=Object.values(s.responses||{}).filter(r=>r.submittedAt);
    return s.pollSnapshot.questions.map((q,qi)=>{const counts=Object.fromEntries(q.options.map(o=>[o.id,0]));responses.forEach(r=>{const answer=r.answers?.[q.id];if(answer in counts)counts[answer]++;});const total=Object.values(counts).reduce((a,b)=>a+b,0);return `<div class="poll-result-card"><h4>Q${qi+1}. ${PollModule.esc(q.text)}</h4>${q.options.map(o=>{const count=counts[o.id]||0,pct=total?Math.round(count/total*100):0;return `<div class="poll-bar-row"><span>${PollModule.esc(o.text)}</span><div class="poll-bar"><div class="poll-bar-fill" style="width:${pct}%"></div></div><b>${pct}%</b></div>`;}).join('')}</div>`;}).join('');
  },
  renderResponseDetail(cid,s){
    const panel=$('#pollPanel'),students=DB.students[cid]||[],responses=Object.values(s.responses||{}).filter(r=>r.submittedAt).sort((a,b)=>(a.studentNumber||999)-(b.studentNumber||999));
    panel.innerHTML=`<div class="poll-card-title"><button class="ghost-btn" id="pollBackLive">← 진행 화면</button><span>학생별 응답</span></div><div class="poll-card" style="overflow:auto"><table class="poll-response-table"><thead><tr><th>학생</th>${s.pollSnapshot.questions.map((q,i)=>`<th>Q${i+1}</th>`).join('')}<th>제출시간</th></tr></thead><tbody>${responses.length?responses.map(r=>{const st=students.find(x=>x.id===r.studentId);return `<tr><td>${s.mode==='anonymous'?'익명':`${r.studentNumber||''}. ${PollModule.esc(st?.name||r.studentName||'학생')}`}</td>${s.pollSnapshot.questions.map(q=>{const opt=q.options.find(o=>o.id===r.answers?.[q.id]);return `<td>${PollModule.esc(opt?.text||'-')}</td>`;}).join('')}<td>${r.submittedAt?new Date(r.submittedAt).toLocaleTimeString('ko-KR'):'-'}</td></tr>`;}).join(''):`<tr><td colspan="${s.pollSnapshot.questions.length+2}">아직 응답이 없습니다.</td></tr>`}</tbody></table></div>`;
    $('#pollBackLive').onclick=()=>PollModule.render(cid);
  },
  renderIndividualLinks(cid,s){
    const panel=$('#pollPanel'),students=DB.students[cid]||[];
    panel.innerHTML=`<div class="poll-card-title"><button class="ghost-btn" id="pollBackIndividual">← 진행 화면</button><span>학생별 개별 QR</span></div><div class="hint">각 링크에는 학생 번호가 고정되어 있어 번호 선택 화면 없이 바로 설문이 열립니다.</div><div class="poll-card poll-individual-list">${students.map((st,i)=>{const url=PollModule.joinUrl(s,st.id);return `<div class="poll-individual-row"><b>${i+1}</b><span>${PollModule.esc(st.name)}</span><button class="ghost-btn" data-copy-individual="${i}">링크 복사</button><button class="ghost-btn" data-open-qr="${i}">QR 보기</button></div>`;}).join('')}</div>`;
    $('#pollBackIndividual').onclick=()=>PollModule.render(cid);
    panel.querySelectorAll('[data-copy-individual]').forEach(btn=>btn.onclick=()=>{const st=students[Number(btn.dataset.copyIndividual)];PollModule.copy(PollModule.joinUrl(s,st.id),`${st.name} 학생 링크를 복사했습니다.`);});
    panel.querySelectorAll('[data-open-qr]').forEach(btn=>btn.onclick=()=>{const st=students[Number(btn.dataset.openQr)],url=PollModule.joinUrl(s,st.id);panel.innerHTML=`<div class="poll-card poll-qr-card" style="max-width:330px;margin:auto"><img class="poll-qr" src="${PollModule.qrUrl(url)}" alt="${PollModule.esc(st.name)} 개별 QR"><div><h3>${PollModule.esc(st.name)} 학생</h3><div class="poll-url">${PollModule.esc(url)}</div><button class="ghost-btn" id="pollBackQr">목록으로</button></div></div>`;$('#pollBackQr').onclick=()=>PollModule.renderIndividualLinks(cid,s);});
  },
  endSession(cid,s){
    s.status='ended';s.endedAt=Date.now();PollModule.publishLocal(cid,s);PollModule.publishRemote(cid,s);scheduleSave();PollModule.activeSessionId=null;PollModule.tab='history';PollModule.render(cid);
  },
  renderHistory(cid){
    const panel=$('#pollPanel'),sessions=PollModule.sessions(cid).slice().sort((a,b)=>b.startedAt-a.startedAt);
    if(!sessions.length){panel.innerHTML='<div class="poll-empty">아직 진행한 설문이 없습니다.</div>';return;}
    panel.innerHTML=sessions.map(s=>`<div class="poll-card"><div class="poll-card-title"><span>${s.status==='live'?'🔴':'📊'} ${PollModule.esc(s.pollSnapshot.title)}</span><span class="spacer"></span><span class="poll-chip">${Object.keys(s.responses||{}).length}명</span></div><div class="poll-meta">${new Date(s.startedAt).toLocaleString('ko-KR')} · ${PollModule.modes[s.mode]?.title||s.mode} · ${s.status==='live'?'진행 중':'종료'}</div><div class="poll-actions"><button class="ghost-btn" data-poll-history="${s.id}">결과 보기</button>${s.status==='live'?`<button class="primary-btn" data-poll-resume="${s.id}">진행 화면</button>`:''}</div></div>`).join('');
    panel.querySelectorAll('[data-poll-history]').forEach(btn=>btn.onclick=()=>{PollModule.activeSessionId=btn.dataset.pollHistory;PollModule.renderResponseDetail(cid,PollModule.activeSession(cid));});
    panel.querySelectorAll('[data-poll-resume]').forEach(btn=>btn.onclick=()=>{PollModule.activeSessionId=btn.dataset.pollResume;PollModule.tab='live';PollModule.render(cid);});
  },
  storeLocalResponse(s,response){try{localStorage.setItem(`mp-poll-response-${s.code}-${response.participantKey}`,JSON.stringify(response));}catch(e){}PollModule.broadcast({type:'response',code:s.code});},
  collectLocalResponses(s){
    try{const prefix=`mp-poll-response-${s.code}-`;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key||!key.startsWith(prefix))continue;const r=JSON.parse(localStorage.getItem(key));if(r&&r.participantKey)s.responses[r.participantKey]=r;}}catch(e){}
  },
  async sendRemoteResponse(s,response){
    if(!/^https?:$/.test(location.protocol))return;
    try{await fetch('/api/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'respond',code:s.code,response})});}catch(e){}
  },
  async refreshSession(s,announce){
    const before=JSON.stringify(s.responses||{});
    PollModule.collectLocalResponses(s);
    if(/^https?:$/.test(location.protocol)){
      try{const res=await fetch(`/api/poll?code=${encodeURIComponent(s.code)}&adminToken=${encodeURIComponent(s.adminToken)}`,{cache:'no-store'});if(res.ok){const data=await res.json();if(data.responses)s.responses={...(s.responses||{}),...data.responses};}}catch(e){}
    }
    if(before!==JSON.stringify(s.responses||{}))scheduleSave();const cid=DB.activeClassId;if($('#modalPoll').classList.contains('open')&&PollModule.tab==='live')PollModule.render(cid);if(announce)flashSaveStatus('↻ 설문 응답 갱신',false);
  },
  init(){
    const brand=document.querySelector('.brand-text');if(brand)brand.textContent='MP';
    $('#btnPoll').onclick=()=>PollModule.open();
    if(/^https?:$/.test(location.protocol)&&['127.0.0.1','localhost'].includes(location.hostname))fetch('/api/network',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data?.addresses?.length){PollModule.networkBase=data.addresses[0];const cid=DB.activeClassId;if(cid&&$('#modalPoll').classList.contains('open'))PollModule.render(cid);}}).catch(()=>{});
    try{PollModule.channel=new BroadcastChannel('mp-live-poll');PollModule.channel.onmessage=e=>{const cid=DB.activeClassId,s=cid&&PollModule.activeSession(cid);if(s&&e.data?.code===s.code){const before=JSON.stringify(s.responses||{});PollModule.collectLocalResponses(s);if(before!==JSON.stringify(s.responses||{}))scheduleSave();if($('#modalPoll').classList.contains('open'))PollModule.render(cid);}};}catch(e){}
    window.addEventListener('storage',e=>{const cid=DB.activeClassId,s=cid&&PollModule.activeSession(cid);if(s&&e.key?.startsWith(`mp-poll-response-${s.code}-`)){const before=JSON.stringify(s.responses||{});PollModule.collectLocalResponses(s);if(before!==JSON.stringify(s.responses||{}))scheduleSave();if($('#modalPoll').classList.contains('open'))PollModule.render(cid);}});
  }
};

AppFeatures.register('poll',{order:55,init:PollModule.init,render:cid=>PollModule.updateButton(cid)});
