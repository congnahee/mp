"use strict";
const QuizModule={
  builderMode:null,builderQuiz:null,
  create(cid,mode,title){ensureClassData(cid);const q={id:uid(),mode,title:title||'퀴즈',questions:[],currentIndex:0,live:false};DB.quizzes[cid].push(q);return q;},
  addQuestion(quiz,text,answer,points){const safe=clamp(Math.round(Number(points)||10),1,100);quiz.questions.push({id:uid(),text,answer:answer||'',points:safe});},
  startLive(cid,quizId){DB.quizzes[cid].forEach(q=>q.live=false);if(quizId){const q=DB.quizzes[cid].find(x=>x.id===quizId);if(q){q.live=true;q.currentIndex=0;}}DB.selection[cid].quizId=quizId;persistAndRender();},
  liveQuiz(cid){return(DB.quizzes[cid]||[]).find(q=>q.live)||null;},
  nextQuestion(cid){const q=QuizModule.liveQuiz(cid);if(q&&q.currentIndex<q.questions.length-1){q.currentIndex++;persistAndRender();}},
  prevQuestion(cid){const q=QuizModule.liveQuiz(cid);if(q&&q.currentIndex>0){q.currentIndex--;persistAndRender();}}
};

"use strict";
Object.assign(QuizModule,{
  render(cid){const panel=$('#questionPanel');if(!cid){panel.style.display='none';return;}const q=QuizModule.liveQuiz(cid);if(!q||q.mode==='A'){panel.style.display='none';return;}const cur=q.questions[q.currentIndex];if(!cur){panel.style.display='none';return;}panel.style.display='flex';panel.innerHTML=`<button class="ghost-btn" id="qPrev">◀</button><div style="flex:1;"><div>${q.currentIndex+1}/${q.questions.length}. ${cur.text}</div>${q.mode==='B'?`<div style="margin-top:4px;">정답: <b>${cur.answer||'-'}</b> · 배점 <b>${cur.points}</b>점</div>`:''}</div><button class="ghost-btn" id="qNext">▶</button>`;$('#qPrev').onclick=()=>QuizModule.prevQuestion(cid);$('#qNext').onclick=()=>QuizModule.nextQuestion(cid);if(q.mode==='B')DB.selection[cid].points=cur.points;},
  chooseMode(button){$$('.tab-mini [data-qmode]').forEach(x=>x.classList.toggle('active',x===button));QuizModule.builderMode=button.dataset.qmode;const hints={A:'문제 등록 없이 점수 스테퍼로 바로 정답/오답 채점해요.',B:'문제와 정답, 배점을 미리 등록하고 순서대로 진행해요.',C:'정답 없이 문제 텍스트만 등록하고, 채점은 선생님이 직접 판단해요.'};$('#qmodeHint').textContent=hints[QuizModule.builderMode];const show=QuizModule.builderMode!=='A';$('#qBuilder').style.display=show?'block':'none';$('#qAnswerField').style.display=QuizModule.builderMode==='B'?'flex':'none';$('#qModeAStart').style.display=QuizModule.builderMode==='A'?'block':'none';if(show){const cid=DB.activeClassId;if(cid)QuizModule.builderQuiz=QuizModule.create(cid,QuizModule.builderMode,QuizModule.builderMode==='B'?'사전등록 퀴즈':'문제 리스트');QuizModule.renderBuilder();}},
  renderBuilder(){const list=$('#qList');list.innerHTML='';const quiz=QuizModule.builderQuiz;if(!quiz)return;quiz.questions.forEach((q,i)=>{const row=document.createElement('div');row.className='row-item';row.innerHTML=`<span>${i+1}. ${q.text} ${quiz.mode==='B'?`(정답:${q.answer} / ${q.points}점)`:''}</span><span class="x">삭제</span>`;row.querySelector('.x').onclick=()=>{quiz.questions=quiz.questions.filter(x=>x.id!==q.id);QuizModule.renderBuilder();};list.appendChild(row);});}
});

"use strict";
QuizModule.init=function(){
  $$('.tab-mini [data-qmode]').forEach(b=>b.onclick=()=>QuizModule.chooseMode(b));$('#btnQuiz').onclick=()=>{openModal('#modalQuiz');QuizModule.chooseMode($$('.tab-mini [data-qmode]')[0]);};
  $('#qModeAStart').onclick=()=>{const cid=DB.activeClassId;if(cid){QuizModule.startLive(cid,null);closeModal('#modalQuiz');}};
  $('#addQBtn').onclick=()=>{const quiz=QuizModule.builderQuiz;if(!quiz)return;const text=$('#qText').value.trim();if(!text)return;const answer=$('#qAnswer').value.trim(),points=clamp(Math.round(Number($('#qPoints').value)||10),1,100);$('#qPoints').value=points;QuizModule.addQuestion(quiz,text,answer,points);$('#qText').value='';$('#qAnswer').value='';QuizModule.renderBuilder();};
  $('#startQuizBtn').onclick=()=>{const cid=DB.activeClassId,quiz=QuizModule.builderQuiz;if(!cid||!quiz)return;if(!quiz.questions.length){uiAlert('문제를 먼저 추가해주세요');return;}QuizModule.startLive(cid,quiz.id);closeModal('#modalQuiz');};$('#stopQuizBtn').onclick=()=>{const cid=DB.activeClassId;if(cid){QuizModule.startLive(cid,null);closeModal('#modalQuiz');}};
};

"use strict";
AppFeatures.register('quiz',{order:50,init:QuizModule.init,render:QuizModule.render});

