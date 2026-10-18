"use strict";

const StudentPoll={
  session:null,participantKey:null,studentId:null,studentNumber:null,answers:{},channel:null,
  esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));},
  params:new URLSearchParams(location.search),
  async init(){
    const code=(StudentPoll.params.get('code')||'').trim();
    if(!code){StudentPoll.showError('참여 코드가 없습니다. QR을 다시 촬영해주세요.');return;}
    try{StudentPoll.channel=new BroadcastChannel('mp-live-poll');}catch(e){}
    const session=await StudentPoll.loadSession(code);
    if(!session){StudentPoll.showError('설문을 찾지 못했습니다. 선생님 화면에서 설문을 시작했는지 확인해주세요.');return;}
    StudentPoll.session=session;
    document.title=`${session.title} · MP`;
    document.getElementById('studentPollHeader').textContent=`${session.title} · 참여코드 ${session.code}`;
    if(session.status!=='live'){StudentPoll.showError('종료된 설문입니다.');return;}
    if(session.mode==='teacher'){StudentPoll.showError('이 설문은 선생님 화면에서 함께 응답합니다.');return;}
    const fixedSid=StudentPoll.params.get('sid');
    if(session.mode==='anonymous'){
      StudentPoll.participantKey=StudentPoll.anonymousKey(code);StudentPoll.renderQuestions();return;
    }
    if(fixedSid){
      const entry=session.students.find(s=>s.id===fixedSid);
      if(!entry){StudentPoll.showError('학생 정보가 올바르지 않습니다.');return;}
      StudentPoll.selectStudent(entry);StudentPoll.renderQuestions();return;
    }
    StudentPoll.renderNumberPicker();
  },
  async loadSession(code){
    if(/^https?:$/.test(location.protocol)){
      try{const res=await fetch(`/api/poll?code=${encodeURIComponent(code)}`,{cache:'no-store'});if(res.ok){const data=await res.json();if(data.session)return data.session;}}catch(e){}
    }
    try{const raw=localStorage.getItem(`mp-poll-session-${code}`);return raw?JSON.parse(raw):null;}catch(e){return null;}
  },
  anonymousKey(code){
    const key=`mp-poll-anonymous-${code}`;let value='';
    try{value=localStorage.getItem(key)||'';if(!value){value=`anon-${Math.random().toString(36).slice(2,11)}`;localStorage.setItem(key,value);}}catch(e){value=`anon-${Date.now()}`;}return value;
  },
  showError(message){document.getElementById('studentPollRoot').innerHTML=`<div class="poll-student-message"><div class="poll-student-check">⚠️</div>${StudentPoll.esc(message)}</div>`;},
  renderNumberPicker(){
    const root=document.getElementById('studentPollRoot'),session=StudentPoll.session;
    root.innerHTML=`<h1>내 번호를 선택하세요</h1><p class="poll-student-desc">선택한 번호로 응답이 학생별 저장됩니다.</p><div class="poll-number-grid">${session.students.map(s=>`<button class="poll-number" data-student-id="${s.id}">${String(s.number).padStart(2,'0')}</button>`).join('')}</div><button class="poll-student-primary" id="studentNumberNext" disabled>번호를 먼저 선택하세요</button><div class="poll-student-privacy">학생 이름은 다른 학생에게 표시되지 않습니다.</div>`;
    root.querySelectorAll('[data-student-id]').forEach(btn=>btn.onclick=()=>{const entry=session.students.find(s=>s.id===btn.dataset.studentId);StudentPoll.selectStudent(entry);root.querySelectorAll('.poll-number').forEach(x=>x.classList.toggle('selected',x===btn));const next=document.getElementById('studentNumberNext');next.disabled=false;next.textContent=`${entry.number}번으로 시작`;});
    document.getElementById('studentNumberNext').onclick=()=>StudentPoll.renderQuestions();
  },
  selectStudent(entry){StudentPoll.studentId=entry.id;StudentPoll.studentNumber=entry.number;StudentPoll.participantKey=entry.id;},
  renderQuestions(){
    const root=document.getElementById('studentPollRoot'),session=StudentPoll.session;
    const saved=StudentPoll.readSaved();if(saved?.answers)StudentPoll.answers=saved.answers;
    root.innerHTML=`<h1>${StudentPoll.esc(session.title)}</h1><p class="poll-student-desc">${session.mode==='anonymous'?'익명으로 응답합니다.':`${StudentPoll.studentNumber}번 학생으로 응답합니다.`} 모든 질문에 답한 뒤 제출해주세요.</p>${session.questions.map((q,qi)=>`<article class="poll-student-question"><div class="poll-student-qno">Q${qi+1}</div><h2>${StudentPoll.esc(q.text)}</h2><div class="poll-student-options">${q.options.map(o=>`<button class="poll-student-option ${StudentPoll.answers[q.id]===o.id?'selected':''}" data-question-id="${q.id}" data-option-id="${o.id}">${StudentPoll.esc(o.text)}</button>`).join('')}</div></article>`).join('')}<button class="poll-student-primary" id="studentSubmit">응답 제출</button><div class="poll-student-privacy">응답은 선생님 설문 결과에 학생별로 저장됩니다.</div>`;
    root.querySelectorAll('[data-option-id]').forEach(btn=>btn.onclick=()=>{StudentPoll.answers[btn.dataset.questionId]=btn.dataset.optionId;root.querySelectorAll(`[data-question-id="${btn.dataset.questionId}"]`).forEach(x=>x.classList.toggle('selected',x===btn));});
    document.getElementById('studentSubmit').onclick=()=>StudentPoll.submit();
  },
  readSaved(){try{return JSON.parse(localStorage.getItem(`mp-poll-response-${StudentPoll.session.code}-${StudentPoll.participantKey}`)||'null');}catch(e){return null;}},
  async submit(){
    const session=StudentPoll.session;
    if(session.questions.some(q=>!StudentPoll.answers[q.id])){StudentPoll.flashButton('모든 질문에 답해주세요.');return;}
    const response={participantKey:StudentPoll.participantKey,studentId:StudentPoll.studentId,studentNumber:StudentPoll.studentNumber,answers:StudentPoll.answers,submittedAt:Date.now()};
    try{localStorage.setItem(`mp-poll-response-${session.code}-${StudentPoll.participantKey}`,JSON.stringify(response));}catch(e){}
    try{if(StudentPoll.channel)StudentPoll.channel.postMessage({type:'response',code:session.code});}catch(e){}
    let remoteOk=false;
    if(/^https?:$/.test(location.protocol)){
      try{const res=await fetch('/api/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'respond',code:session.code,response})});remoteOk=res.ok;}catch(e){}
    }
    StudentPoll.renderDone(remoteOk);
  },
  flashButton(message){const btn=document.getElementById('studentSubmit'),before=btn.textContent;btn.textContent=message;btn.style.background='#e85d78';setTimeout(()=>{btn.textContent=before;btn.style.background='';},1600);},
  renderDone(remoteOk){
    document.getElementById('studentPollRoot').innerHTML=`<div class="poll-student-message"><div class="poll-student-check">✅</div><h1>응답을 제출했습니다</h1><p class="poll-student-desc">${remoteOk?'선생님 화면에 응답이 전달되었습니다.':'이 기기에 응답을 저장했습니다. 선생님 화면에서 자동으로 확인됩니다.'}</p><button class="poll-student-primary" id="studentEditResponse">응답 수정하기</button></div>`;
    document.getElementById('studentEditResponse').onclick=()=>StudentPoll.renderQuestions();
  }
};

StudentPoll.init();
