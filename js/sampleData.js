"use strict";
/* ============================================================
   SAMPLE DATA — 처음 써볼 때 바로 감을 잡을 수 있도록
============================================================ */
function seedSampleData(){
  const cid = uid();
  const c = {id:cid, name:'2학년 3반'};
  DB.classes = [c];
  DB.activeClassId = cid;
  ensureClassData(cid);

  const names = ['김도윤','이서연','박지호','최수아','정민준','강하은'];
  DB.students[cid] = names.map(n=>({id:uid(), name:n}));

  // 팀 기능도 바로 체험할 수 있도록 샘플 팀 2개 구성
  DB.teamsEnabled[cid] = true;
  const teamA = {id:uid(), name:'불꽃조'};
  const teamB = {id:uid(), name:'번개조'};
  DB.teams[cid] = [teamA, teamB];
  DB.students[cid].forEach((s,i)=>{ DB.studentTeam[cid][s.id] = (i%2===0) ? teamA.id : teamB.id; });

  const p = {id:uid(), type:'week', label:'9월 3주차', status:'active', startedAt:Date.now(), closedAt:null, startDate:'', endDate:''};
  DB.periods[cid] = [p];
  DB.scores[cid][p.id] = {};
  DB.history[cid][p.id] = [];
  DB.teamScores[cid][p.id] = {};

  // 랜덤한 개인 채점 이력을 시간순으로 쌓아서 그래프/랭킹/꺾은선이 바로 보이게 함
  const now = Date.now();
  let t = now - 1000*60*40; // 40분 전부터
  const events = 20;
  for(let i=0;i<events;i++){
    const s = DB.students[cid][Math.floor(Math.random()*DB.students[cid].length)];
    const correct = Math.random() < 0.68;
    const pts = [5,10,10,15][Math.floor(Math.random()*4)];
    const delta = correct ? pts : -Math.min(pts,10);
    DB.scores[cid][p.id][s.id] = (DB.scores[cid][p.id][s.id]||0) + delta;
    DB.history[cid][p.id].push({id:uid(), targetType:'student', targetId:s.id, delta, ts:t, note: correct?'퀴즈 정답':'퀴즈 오답'});
    t += 1000*60*(1+Math.random()*3);
  }
  // 팀 자체에 직접 준 보너스/감점 샘플 (개인점수 합산과 별개로 쌓이는 부분)
  [[teamA.id,'협동 보너스',10], [teamB.id,'정리정돈 감점',-5]].forEach(([tid,note,delta])=>{
    DB.teamScores[cid][p.id][tid] = (DB.teamScores[cid][p.id][tid]||0) + delta;
    DB.history[cid][p.id].push({id:uid(), targetType:'team', targetId:tid, delta, ts:t, note});
    t += 1000*60;
  });

  DB.graphType[cid] = 'bar';
  DB.viewMode[cid] = 'student';
  const birthdaySet = {id:uid(), name:'생일선물', gifts:{1:'치킨 기프티콘', 2:'초코우유', 3:'연필세트'}};
  const monthlySet = {id:uid(), name:'월별선물', gifts:{1:'문화상품권', 2:'젤리세트'}};
  DB.giftSets[cid] = [birthdaySet, monthlySet];
  DB.activeGiftSetId[cid] = birthdaySet.id;
  DB.selection[cid] = {targetType:'student', targetId: DB.students[cid][0].id, points:10, quizId:null, brushValue:null};

  // 기분 온도계 샘플 (오늘자, 수업 전/후 몇 명만 채워서 바로 체험 가능하게)
  const todayStr = formatDateYMD(new Date());
  DB.moodLogs[cid][todayStr] = {};
  const moodSample = [[0,6,8],[1,4,4],[2,7,9],[3,3,6]];
  moodSample.forEach(([idx, before, after])=>{
    const s = DB.students[cid][idx];
    if(s) DB.moodLogs[cid][todayStr][s.id] = {before, after};
  });
}
