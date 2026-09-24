"use strict";
/* ============================================================
   SCORE ENGINE — the only module allowed to mutate scores.
   targetType 'student' writes to individual score pool;
   'team' writes to the team's independent bonus pool
   (kept separate from the auto-summed member scores).
============================================================ */
const ScoreEngine = {
  apply(cid, targetType, targetId, delta, note){
    const p = activePeriod(cid);
    if(!p){ uiAlert('먼저 기간을 시작해주세요 (설정 > 기간 관리)'); return; }
    const pool = targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[targetId] = (pool[targetId]||0) + delta;
    currentHistory(cid).push({id:uid(), targetType, targetId, delta, ts:Date.now(), note: note||''});
    persistAndRender();
    return pool[targetId];
  },
  editHistoryEntry(cid, entryId, newDelta){
    const hist = currentHistory(cid);
    const entry = hist.find(h=>h.id===entryId);
    if(!entry) return;
    const pool = entry.targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[entry.targetId] = (pool[entry.targetId]||0) - entry.delta + newDelta;
    entry.delta = newDelta;
    persistAndRender();
  },
  removeHistoryEntry(cid, entryId){
    const hist = currentHistory(cid);
    const idx = hist.findIndex(h=>h.id===entryId);
    if(idx<0) return;
    const entry = hist[idx];
    const pool = entry.targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[entry.targetId] = (pool[entry.targetId]||0) - entry.delta;
    hist.splice(idx,1);
    persistAndRender();
  }
};
