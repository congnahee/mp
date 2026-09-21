"use strict";
/* ============================================================
   PERIOD MANAGER — weekly/monthly/semester cycles
============================================================ */
const PeriodManager = {
  start(cid,type,label,startDate,endDate){
    ensureClassData(cid);
    if(activePeriod(cid)){ uiAlert('진행 중인 기간이 있어요. 먼저 마감해주세요.'); return; }
    const p = {id:uid(), type, label: label||PeriodManager.defaultLabel(type), status:'active',
      startedAt:Date.now(), closedAt:null, startDate: startDate||'', endDate: endDate||''};
    DB.periods[cid].push(p);
    DB.scores[cid][p.id]={};
    DB.history[cid][p.id]=[];
    DB.teamScores[cid][p.id]={};
    persistAndRender();
  },
  resetActive(cid){
    const p = activePeriod(cid);
    if(!p) return;
    DB.scores[cid][p.id] = {};
    DB.history[cid][p.id] = [];
    DB.teamScores[cid][p.id] = {};
    persistAndRender();
  },
  updateActive(cid, label, startDate, endDate){
    const p = activePeriod(cid);
    if(!p) return;
    if(label) p.label = label;
    p.startDate = startDate||'';
    p.endDate = endDate||'';
    persistAndRender();
  },
  defaultLabel(type){
    const d = new Date();
    if(type==='week') return `${d.getMonth()+1}월 ${Math.ceil(d.getDate()/7)}주차`;
    if(type==='month') return `${d.getMonth()+1}월`;
    return `${d.getFullYear()}학년도 학기`;
  },
  close(cid){
    const p = activePeriod(cid);
    if(!p) return;
    p.status='closed'; p.closedAt=Date.now();
    persistAndRender();
  }
};
