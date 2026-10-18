"use strict";

/* ============================================================
   STUDENT REPORT — 점수·기분·설문·퀴즈·사다리 통합 조회/출력
   원본 DB는 변경하지 않고 화면을 열 때 각 저장소를 연결해 보고서를 만든다.
============================================================ */
const ReportModule={
  studentId:null,range:'30',from:'',to:'',tab:'summary',
  esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));},
  dateKey(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:formatDateYMD(new Date(value||Date.now()));},
  dateLabel(value){const date=new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T00:00:00`:value);return Number.isNaN(date.getTime())?'-':date.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'});},
  timeLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'-':date.toLocaleString('ko-KR');},
  rangeBounds(cid){
    const today=new Date(),end=ReportModule.dateKey(today),start=new Date(today);
    if(ReportModule.range==='today')return{from:end,to:end};
    if(ReportModule.range==='7'){start.setDate(start.getDate()-6);return{from:ReportModule.dateKey(start),to:end};}
    if(ReportModule.range==='30'){start.setDate(start.getDate()-29);return{from:ReportModule.dateKey(start),to:end};}
    if(ReportModule.range==='period'){
      const period=activePeriod(cid);return{from:period?.startDate||ReportModule.dateKey(period?.startedAt||today),to:period?.endDate||end};
    }
    if(ReportModule.range==='custom')return{from:ReportModule.from||'',to:ReportModule.to||''};
    return{from:'',to:''};
  },
  inRange(value,bounds){const key=ReportModule.dateKey(value);return(!bounds.from||key>=bounds.from)&&(!bounds.to||key<=bounds.to);},
  answerLabel(question,response){
    const answer=response?.answers?.[question.id];
    if((question.type||'choice')==='text')return String(answer||'').trim();
    if(answer===`other:${question.id}`)return`기타: ${String(response?.otherAnswers?.[question.id]||'').trim()}`;
    return(question.options||[]).find(option=>option.id===answer)?.text||'-';
  },
  collect(cid,studentId){
    const bounds=ReportModule.rangeBounds(cid),activity=StudentActivity.list(cid,studentId).slice();
    const scoreEvents=activity.filter(e=>['score','score_edit','score_cancel'].includes(e.type)&&ReportModule.inRange(e.date||e.at,bounds));
    const knownScoreRefs=new Set(scoreEvents.map(e=>e.activityRef).filter(Boolean));
    Object.entries(DB.history[cid]||{}).forEach(([periodId,entries])=>(entries||[]).forEach(entry=>{
      if(entry.targetType==='student'&&entry.targetId===studentId&&!knownScoreRefs.has(entry.id)&&ReportModule.inRange(entry.ts,bounds)){
        const period=(DB.periods[cid]||[]).find(p=>p.id===periodId);
        scoreEvents.push({id:`legacy-${entry.id}`,type:'score',activityRef:entry.id,at:entry.ts,date:ReportModule.dateKey(entry.ts),delta:entry.delta,note:entry.note||'',periodId,periodLabel:period?.label||'',source:'legacy'});
      }
    }));
    scoreEvents.sort((a,b)=>(b.at||0)-(a.at||0));

    const moods=[];
    Object.entries(DB.moodLogs[cid]||{}).forEach(([date,records])=>{const record=records?.[studentId];if(!record||!ReportModule.inRange(date,bounds))return;if(record.before!==null&&record.before!==undefined)moods.push({type:'mood',date,at:new Date(`${date}T09:00:00`).getTime(),timing:'before',value:record.before});if(record.after!==null&&record.after!==undefined)moods.push({type:'mood',date,at:new Date(`${date}T18:00:00`).getTime(),timing:'after',value:record.after});});
    moods.sort((a,b)=>(b.at||0)-(a.at||0));

    const polls=[];
    (DB.pollSessions[cid]||[]).forEach(session=>{const response=Object.values(session.responses||{}).find(item=>item.studentId===studentId);if(!response?.submittedAt||!ReportModule.inRange(session.sessionDate||response.submittedAt,bounds))return;polls.push({type:'poll_response',id:`poll-${session.id}`,date:session.sessionDate||ReportModule.dateKey(response.submittedAt),at:response.submittedAt,sessionId:session.id,title:session.pollSnapshot?.title||'설문',mode:session.mode,status:session.status,editedAt:response.editedAt||null,answers:(session.pollSnapshot?.questions||[]).map(question=>({question:question.text,answer:ReportModule.answerLabel(question,response),type:question.type||'choice'}))});});
    polls.sort((a,b)=>b.at-a.at);

    const gifts=activity.filter(e=>['ladder','winner'].includes(e.type)&&ReportModule.inRange(e.date||e.at,bounds)).sort((a,b)=>(b.at||0)-(a.at||0));
    const quizzes=scoreEvents.filter(e=>e.quizId||e.quizTitle||e.source==='quiz');
    const timeline=[...scoreEvents,...moods,...polls,...gifts].sort((a,b)=>(b.at||0)-(a.at||0));
    return{bounds,scoreEvents,moods,polls,gifts,quizzes,timeline};
  },
  dailyScore(events){
    const map={};events.slice().reverse().forEach(e=>{const date=ReportModule.dateKey(e.date||e.at);let delta=0;if(e.type==='score')delta=Number(e.delta)||0;else if(e.type==='score_edit')delta=(Number(e.newDelta)||0)-(Number(e.oldDelta)||0);else if(e.type==='score_cancel')delta=-(Number(e.cancelledDelta)||0);map[date]=(map[date]||0)+delta;});
    let total=0;return Object.keys(map).sort().map(date=>({date,value:(total+=map[date]),delta:map[date]}));
  },
  lineChart(series,options={}){
    const all=series.flatMap(s=>s.values.map(v=>Number(v.value))).filter(Number.isFinite);if(!all.length)return'<div class="report-no-data">기록 없음</div>';
    const width=640,height=190,pad=28,min=Math.min(0,...all),max=Math.max(1,...all),span=max-min||1,longest=Math.max(...series.map(s=>s.values.length));
    const x=index=>pad+(longest<=1?(width-pad*2)/2:index*(width-pad*2)/(longest-1)),y=value=>height-pad-(value-min)*(height-pad*2)/span;
    return`<div class="report-chart-scroll"><svg class="report-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ReportModule.esc(options.label||'변화 그래프')}"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="axis"/>${series.map((s,si)=>{const points=s.values.map((v,i)=>`${x(i)},${y(Number(v.value))}`).join(' ');return`<polyline points="${points}" class="series series-${si}"/>${s.values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(Number(v.value))}" r="4" class="dot series-${si}"><title>${ReportModule.esc(v.date)}: ${v.value}</title></circle>`).join('')}`;}).join('')}</svg></div><div class="report-chart-legend">${series.map((s,i)=>`<span><i class="series-${i}"></i>${ReportModule.esc(s.name)}</span>`).join('')}</div>`;
  },
  bars(items){
    const max=Math.max(1,...items.map(item=>Number(item.value)||0));return`<div class="report-bars">${items.map((item,index)=>`<div><span>${ReportModule.esc(item.label)}</span><div class="track"><i class="tone-${index%5}" style="width:${Math.round((Number(item.value)||0)/max*100)}%"></i></div><b>${item.value||0}</b></div>`).join('')}</div>`;
  },
  buildCharts(data){
    const score=ReportModule.dailyScore(data.scoreEvents);
    const moodDates=[...new Set(data.moods.map(item=>item.date))].sort(),before=moodDates.map(date=>({date,value:data.moods.find(item=>item.date===date&&item.timing==='before')?.value})).filter(item=>item.value!==undefined),after=moodDates.map(date=>({date,value:data.moods.find(item=>item.date===date&&item.timing==='after')?.value})).filter(item=>item.value!==undefined);
    const pollByDate={};data.polls.forEach(item=>pollByDate[item.date]=(pollByDate[item.date]||0)+1);
    const totalQuiz=data.quizzes.filter(item=>item.correct!==null&&item.correct!==undefined).length,correct=data.quizzes.filter(item=>item.correct===true).length;
    return`<div class="report-chart-grid"><section><h4>누적 점수 변화</h4>${ReportModule.lineChart([{name:'누적 변화',values:score}],{label:'누적 점수 변화'})}</section><section><h4>수업 전·후 기분 변화</h4>${ReportModule.lineChart([{name:'수업 전',values:before},{name:'수업 후',values:after}],{label:'기분 변화'})}</section><section><h4>설문 참여 현황</h4>${Object.keys(pollByDate).length?ReportModule.bars(Object.entries(pollByDate).sort().map(([label,value])=>({label,value}))):'<div class="report-no-data">기록 없음</div>'}</section><section><h4>퀴즈 정답률</h4>${totalQuiz?`<div class="report-donut" style="--pct:${Math.round(correct/totalQuiz*100)}"><div><b>${Math.round(correct/totalQuiz*100)}%</b><span>${correct}/${totalQuiz}</span></div></div>`:'<div class="report-no-data">정답률 기록 없음</div>'}</section><section class="wide"><h4>활동 유형별 기록 수</h4>${ReportModule.bars([{label:'점수',value:data.scoreEvents.length},{label:'기분',value:data.moods.length},{label:'설문',value:data.polls.length},{label:'퀴즈',value:data.quizzes.length},{label:'사다리·선물',value:data.gifts.length}])}</section></div>`;
  },
  scoreTable(events){return events.length?`<div class="report-table-wrap"><table><thead><tr><th>일시</th><th>구분</th><th>점수</th><th>내용</th></tr></thead><tbody>${events.map(e=>`<tr><td>${ReportModule.timeLabel(e.at)}</td><td>${e.type==='score'?'채점':e.type==='score_edit'?'수정':'취소'}</td><td class="num">${e.type==='score'?`${e.delta>0?'+':''}${e.delta}`:e.type==='score_edit'?`${e.oldDelta} → ${e.newDelta}`:`${e.cancelledDelta}점`}</td><td>${ReportModule.esc(e.quizTitle||e.questionText||e.note||e.periodLabel||'-')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="report-no-data">점수 기록이 없습니다.</div>';},
  moodTable(items){const dates=[...new Set(items.map(item=>item.date))].sort().reverse();return dates.length?`<div class="report-table-wrap"><table><thead><tr><th>날짜</th><th>수업 전</th><th>수업 후</th><th>변화</th></tr></thead><tbody>${dates.map(date=>{const before=items.find(item=>item.date===date&&item.timing==='before')?.value,after=items.find(item=>item.date===date&&item.timing==='after')?.value,change=before!==undefined&&after!==undefined?after-before:null;return`<tr><td>${ReportModule.dateLabel(date)}</td><td>${before??'-'}</td><td>${after??'-'}</td><td>${change===null?'-':`${change>0?'+':''}${change}`}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="report-no-data">기분 기록이 없습니다.</div>';},
  pollCards(items){return items.length?items.map(item=>`<article class="report-poll-card"><div><b>${ReportModule.esc(item.title)}</b><span>${ReportModule.dateLabel(item.date)} · ${ReportModule.esc(PollModule.modes[item.mode]?.title||item.mode||'설문')}${item.editedAt?' · 수정됨':''}</span></div>${item.answers.map(answer=>`<p><strong>${ReportModule.esc(answer.question)}</strong><span>${ReportModule.esc(answer.answer||'-')}</span></p>`).join('')}</article>`).join(''):'<div class="report-no-data">설문 응답이 없습니다.</div>';},
  giftCards(items){return items.length?items.map(item=>`<article class="report-mini-card"><b>${item.type==='winner'?'🏆 1위 기록':'🎁 사다리 결과'}</b><span>${ReportModule.timeLabel(item.at)}</span><p>${item.type==='winner'?`${item.score??'-'}점${item.gift?` · ${ReportModule.esc(item.gift)}`:''}`:`${ReportModule.esc(item.giftSetName||'선물 사다리')} · ${ReportModule.esc(item.gift||'결과 기록')}`}</p></article>`).join(''):'<div class="report-no-data">사다리·선물 기록이 없습니다.</div>';},
  timeline(items){return items.length?items.map(item=>{let title='',text='';if(['score','score_edit','score_cancel'].includes(item.type)){title='점수';text=item.type==='score'?`${item.delta>0?'+':''}${item.delta}점 · ${item.quizTitle||item.note||'채점'}`:item.type==='score_edit'?`${item.oldDelta}점 → ${item.newDelta}점으로 수정`:`${item.cancelledDelta}점 취소`;}else if(item.type==='mood'){title='기분';text=`${item.timing==='before'?'수업 전':'수업 후'} ${item.value}점`;}else if(item.type==='poll_response'){title='설문';text=`${item.title} 제출`;}else if(item.type==='winner'){title='1위';text=`${item.score??'-'}점${item.gift?` · ${item.gift}`:''}`;}else{title='사다리';text=item.gift||'결과 기록';}return`<article><i class="${ReportModule.esc(item.type)}"></i><time>${ReportModule.timeLabel(item.at)}</time><b>${ReportModule.esc(title)}</b><p>${ReportModule.esc(text)}</p></article>`;}).join(''):'<div class="report-no-data">활동 기록이 없습니다.</div>';},
  render(){
    const cid=DB.activeClassId,root=$('#studentReportRoot');if(!root)return;if(!cid){root.innerHTML='<div class="report-no-data">반을 먼저 선택해주세요.</div>';return;}ensureClassData(cid);
    const students=DB.students[cid]||[];if(!students.length){root.innerHTML='<div class="report-no-data">등록된 학생이 없습니다.</div>';return;}if(!students.some(s=>s.id===ReportModule.studentId))ReportModule.studentId=students[0].id;
    const student=students.find(s=>s.id===ReportModule.studentId),data=ReportModule.collect(cid,student.id),period=activePeriod(cid),current=currentScores(cid)[student.id]||0,totalGain=data.scoreEvents.filter(e=>e.type==='score'&&e.delta>0).reduce((sum,e)=>sum+Number(e.delta||0),0),totalLoss=data.scoreEvents.filter(e=>e.type==='score'&&e.delta<0).reduce((sum,e)=>sum+Number(e.delta||0),0),rangeLabel=data.bounds.from||data.bounds.to?`${data.bounds.from||'처음'} ~ ${data.bounds.to||'오늘'}`:'전체 기간';
    const tabSections={summary:'전체 요약',score:'점수',mood:'기분',poll:'설문',quiz:'퀴즈',gift:'사다리·선물'};
    root.innerHTML=`<div class="report-screen-head"><div><h3>📄 학생 개별 보고서</h3><p>${ReportModule.esc(activeClass()?.name||'')} · ${ReportModule.esc(rangeLabel)}</p></div><div class="report-export-actions"><button class="ghost-btn" id="reportWord">Word 저장</button><button class="primary-btn" id="reportPdf">PDF·인쇄</button></div></div><div class="report-controls"><label>학생<select id="reportStudent">${students.map((item,index)=>`<option value="${item.id}" ${item.id===student.id?'selected':''}>${index+1}. ${ReportModule.esc(item.name)}</option>`).join('')}</select></label><div class="report-range">${[['today','오늘'],['7','7일'],['30','30일'],['period','현재 기간'],['all','전체'],['custom','날짜 선택']].map(([key,label])=>`<button class="${ReportModule.range===key?'active':''}" data-report-range="${key}">${label}</button>`).join('')}</div><div class="report-custom-range ${ReportModule.range==='custom'?'show':''}"><input type="date" id="reportFrom" value="${ReportModule.from}"><span>~</span><input type="date" id="reportTo" value="${ReportModule.to}"><button class="ghost-btn" id="reportApplyRange">적용</button></div></div><div class="report-tabs">${Object.entries(tabSections).map(([key,label])=>`<button class="${ReportModule.tab===key?'active':''}" data-report-tab="${key}">${label}</button>`).join('')}</div><div id="studentReportPrint"><header class="report-print-head"><h1>${ReportModule.esc(student.name)} 학생 개별 보고서</h1><p>${ReportModule.esc(activeClass()?.name||'')} · ${ReportModule.esc(rangeLabel)} · 생성 ${new Date().toLocaleString('ko-KR')}</p></header><div class="report-summary"><div><span>현재 점수</span><b>${current}</b></div><div><span>획득 점수</span><b>+${totalGain}</b></div><div><span>감점</span><b>${totalLoss}</b></div><div><span>설문</span><b>${data.polls.length}</b></div><div><span>기분</span><b>${data.moods.length}</b></div><div><span>퀴즈</span><b>${data.quizzes.length}</b></div><div><span>사다리·선물</span><b>${data.gifts.length}</b></div></div><section class="report-section" data-report-section="summary"><h2>핵심 그래프</h2>${ReportModule.buildCharts(data)}<h2>전체 활동 타임라인</h2><div class="report-timeline">${ReportModule.timeline(data.timeline)}</div></section><section class="report-section" data-report-section="score"><h2>점수 기록</h2>${ReportModule.lineChart([{name:'누적 변화',values:ReportModule.dailyScore(data.scoreEvents)}],{label:'점수 변화'})}${ReportModule.scoreTable(data.scoreEvents)}</section><section class="report-section" data-report-section="mood"><h2>기분 기록</h2>${ReportModule.moodTable(data.moods)}</section><section class="report-section" data-report-section="poll"><h2>설문 답변</h2>${ReportModule.pollCards(data.polls)}</section><section class="report-section" data-report-section="quiz"><h2>퀴즈 기록</h2>${ReportModule.scoreTable(data.quizzes)}</section><section class="report-section" data-report-section="gift"><h2>사다리·선물 기록</h2><div class="report-mini-grid">${ReportModule.giftCards(data.gifts)}</div></section></div>`;
    ReportModule.applyTab();
    $('#reportStudent').onchange=e=>{ReportModule.studentId=e.target.value;ReportModule.render();};
    root.querySelectorAll('[data-report-range]').forEach(btn=>btn.onclick=()=>{ReportModule.range=btn.dataset.reportRange;if(ReportModule.range!=='custom')ReportModule.render();else root.querySelector('.report-custom-range').classList.add('show');});
    $('#reportApplyRange').onclick=()=>{ReportModule.from=$('#reportFrom').value;ReportModule.to=$('#reportTo').value;if(ReportModule.from&&ReportModule.to&&ReportModule.from>ReportModule.to){uiAlert('시작일이 종료일보다 늦습니다.');return;}ReportModule.render();};
    root.querySelectorAll('[data-report-tab]').forEach(btn=>btn.onclick=()=>{ReportModule.tab=btn.dataset.reportTab;ReportModule.applyTab();root.querySelectorAll('[data-report-tab]').forEach(item=>item.classList.toggle('active',item===btn));});
    $('#reportWord').onclick=()=>ReportModule.exportWord(student,rangeLabel);
    $('#reportPdf').onclick=()=>ReportModule.printPdf();
  },
  applyTab(){const root=$('#studentReportRoot');if(!root)return;root.querySelectorAll('[data-report-section]').forEach(section=>section.classList.toggle('active',ReportModule.tab==='summary'?section.dataset.reportSection==='summary':section.dataset.reportSection===ReportModule.tab));},
  exportWord(student,rangeLabel){
    const content=$('#studentReportPrint')?.cloneNode(true);if(!content)return;content.querySelectorAll('[data-report-section]').forEach(section=>section.style.display='block');
    const css=`body{font-family:'Malgun Gothic',sans-serif;color:#222;line-height:1.5}h1{font-size:24px}h2{font-size:18px;border-bottom:2px solid #198b70;padding-bottom:6px}.report-summary{display:table;width:100%;border-collapse:collapse}.report-summary>div{display:table-cell;border:1px solid #ccc;padding:8px}.report-summary span,.report-summary b{display:block}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #bbb;padding:6px;text-align:left}.report-chart-grid{display:block}.report-chart-grid section{page-break-inside:avoid;border:1px solid #ddd;padding:10px;margin:10px 0}.report-bars>div{display:table;width:100%;margin:4px 0}.report-bars span,.report-bars b{display:table-cell;width:20%}.track{display:table-cell;width:60%;background:#eee}.track i{display:block;height:12px;background:#198b70}.report-poll-card,.report-mini-card,.report-timeline article{border:1px solid #ddd;padding:10px;margin:8px 0;page-break-inside:avoid}.report-poll-card p strong,.report-poll-card p span{display:block}.report-no-data{padding:18px;color:#777}.report-chart-legend{margin:5px 0}.report-chart-legend span{margin-right:12px}.report-line-chart{width:100%;max-width:640px}.axis{stroke:#aaa}.series{fill:none;stroke:#198b70;stroke-width:3}.series-1{stroke:#4f79e8}.dot{fill:#198b70}`;
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${ReportModule.esc(student.name)} 개별 보고서</title><style>${css}</style></head><body>${content.outerHTML}</body></html>`,a=document.createElement('a');a.href=`data:application/msword;charset=utf-8,${encodeURIComponent(`\ufeff${html}`)}`;a.download=`${student.name}_개별보고서_${rangeLabel.replace(/[^0-9~-]/g,'')||'전체'}.doc`;document.body.appendChild(a);a.click();a.remove();flashSaveStatus('Word 보고서 저장',false);
  },
  printPdf(){document.body.classList.add('report-printing');window.print();setTimeout(()=>document.body.classList.remove('report-printing'),60000);},
  open(){const cid=DB.activeClassId;if(!cid){uiAlert('반을 먼저 선택해주세요.');return;}ReportModule.render();openModal('#modalStudentReport');},
  init(){const btn=$('#btnStudentReport');if(btn)btn.onclick=ReportModule.open;window.addEventListener('afterprint',()=>document.body.classList.remove('report-printing'));}
};

AppFeatures.register('student-report',{order:58,init:ReportModule.init});
