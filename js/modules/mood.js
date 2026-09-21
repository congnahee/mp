"use strict";
/* ============================================================
   MOOD MODULE — 학생별 일별 "수업 전/후" 기분 점수(0~10)만 저장·조회.
   기존 ScoreEngine, RankingModule과 완전히 독립된 데이터 영역이라
   포인트·랭킹에는 어떤 영향도 주지 않는다.
============================================================ */
const MoodModule = {
  setScore(cid, dateStr, studentId, timing, value){
    ensureClassData(cid);
    if(!DB.moodLogs[cid][dateStr]) DB.moodLogs[cid][dateStr] = {};
    if(!DB.moodLogs[cid][dateStr][studentId]) DB.moodLogs[cid][dateStr][studentId] = {before:null, after:null};
    DB.moodLogs[cid][dateStr][studentId][timing] = value;
    scheduleSave();
  },
  getScore(cid, dateStr, studentId, timing){
    const day = (DB.moodLogs[cid]||{})[dateStr];
    if(!day || !day[studentId]) return null;
    const v = day[studentId][timing];
    return (v===undefined) ? null : v;
  },
  getDay(cid, dateStr){
    return (DB.moodLogs[cid]||{})[dateStr] || {};
  },
  availableDates(cid){
    return Object.keys(DB.moodLogs[cid]||{}).sort().reverse();
  }
};
