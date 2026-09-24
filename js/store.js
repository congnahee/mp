"use strict";
/* ============================================================
   CENTRAL STORE (DB) — single source of truth
   Modules below only read/mutate DB through the functions here,
   then call render(). No module reaches into another module's guts.
============================================================ */
let DB = {
  classes: [],           // [{id,name}]
  activeClassId: null,
  students: {},           // classId -> [{id,name}]
  periods: {},             // classId -> [{id,type,label,status,startedAt,closedAt,startDate,endDate}]
  scores: {},               // classId -> periodId -> studentId -> number
  history: {},                // classId -> periodId -> [{id,targetType:'student'|'team',targetId,delta,ts,note}]
  quizzes: {},                  // classId -> [{id,mode,title,questions:[{id,text,answer,points}],currentIndex,live}]
  graphType: {},                  // classId -> 'bar'|'race'|'line'|'donut'
  gifts: {},                       // classId -> {rank: text} (구버전 호환용, 세트로 마이그레이션됨)
  selection: {},                    // classId -> {targetType:'student'|'team', targetId, points, quizId}
  teamsEnabled: {},                  // classId -> boolean (반마다 팀 기능 on/off)
  teams: {},                          // classId -> [{id,name}]
  studentTeam: {},                     // classId -> studentId -> teamId|null
  teamScores: {},                       // classId -> periodId -> teamId -> number (팀 직접 보너스/감점, 개인점수 합산과 별개)
  viewMode: {},                          // classId -> 'student'|'team' (그래프/랭킹 보기 기준)
  giftSets: {},                           // classId -> [{id,name,gifts:{rank:text}}] — 여러 선물 세트 (생일선물/월별선물 등)
  activeGiftSetId: {},                     // classId -> 사다리에서 지금 쓸 세트 id
  theme: 'dark',                            // 'dark'|'light' — 전역 화면 테마
  moodLogs: {}                               // classId -> 'YYYY-MM-DD' -> studentId -> {before:0~10|null, after:0~10|null}
};

function activeClass(){ return DB.classes.find(c=>c.id===DB.activeClassId); }
function ensureClassData(cid){
  if(!DB.students[cid]) DB.students[cid]=[];
  if(!DB.periods[cid]) DB.periods[cid]=[];
  if(!DB.scores[cid]) DB.scores[cid]={};
  if(!DB.history[cid]) DB.history[cid]={};
  if(!DB.quizzes[cid]) DB.quizzes[cid]=[];
  if(!DB.graphType[cid]) DB.graphType[cid]='bar';
  if(!DB.gifts[cid]) DB.gifts[cid]={};
  if(!DB.selection[cid]) DB.selection[cid]={targetType:'student', targetId:null, points:10, quizId:null};
  if(DB.teamsEnabled[cid]===undefined) DB.teamsEnabled[cid]=false;
  if(!DB.teams[cid]) DB.teams[cid]=[];
  if(!DB.studentTeam[cid]) DB.studentTeam[cid]={};
  if(!DB.teamScores[cid]) DB.teamScores[cid]={};
  if(!DB.viewMode[cid]) DB.viewMode[cid]='student';
  if(!DB.moodLogs[cid]) DB.moodLogs[cid]={};
  if(!DB.giftSets[cid] || DB.giftSets[cid].length===0){
    // 구버전 DB.gifts[cid]에 값이 있으면 "기본 세트"로 그대로 이어받는다
    const legacy = DB.gifts[cid] || {};
    const s = {id:uid(), name:'기본 세트', gifts: legacy};
    DB.giftSets[cid] = [s];
    DB.activeGiftSetId[cid] = s.id;
  }
  if(!DB.activeGiftSetId[cid] || !DB.giftSets[cid].find(s=>s.id===DB.activeGiftSetId[cid])){
    DB.activeGiftSetId[cid] = DB.giftSets[cid][0].id;
  }
}
function activeGiftSet(cid){
  const sets = DB.giftSets[cid]||[];
  return sets.find(s=>s.id===DB.activeGiftSetId[cid]) || sets[0] || null;
}
function activePeriod(cid){
  const arr = DB.periods[cid]||[];
  return arr.find(p=>p.status==='active') || null;
}
function currentScores(cid){
  const p = activePeriod(cid);
  if(!p) return {};
  if(!DB.scores[cid][p.id]) DB.scores[cid][p.id]={};
  return DB.scores[cid][p.id];
}
function currentTeamScores(cid){
  const p = activePeriod(cid);
  if(!p) return {};
  if(!DB.teamScores[cid][p.id]) DB.teamScores[cid][p.id]={};
  return DB.teamScores[cid][p.id];
}
function currentHistory(cid){
  const p = activePeriod(cid);
  if(!p) return [];
  if(!DB.history[cid][p.id]) DB.history[cid][p.id]=[];
  return DB.history[cid][p.id];
}
