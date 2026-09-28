"use strict";
/* ============================================================
   SCORE ENGINE — the only module allowed to mutate scores.
   targetType 'student' writes to individual score pool;
   'team' writes to the team's independent bonus pool
   (kept separate from the auto-summed member scores).
============================================================ */
const ScoreEngine = {
  // 되돌린 채점을 "다시하기"로 복구하기 위한 임시 보관함. 저장하지 않는 메모리 전용이고,
  // 새 채점이 들어오면 비워진다. (기간이 바뀐 뒤에 엉뚱한 기간으로 복구되지 않도록 periodId를 같이 보관)
  redoStack: {},
  apply(cid, targetType, targetId, delta, note){
    const p = activePeriod(cid);
    if(!p){ uiAlert('먼저 기간을 시작해주세요 (설정 > 기간 관리)'); return; }
    const pool = targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[targetId] = (pool[targetId]||0) + delta;
    currentHistory(cid).push({id:uid(), targetType, targetId, delta, ts:Date.now(), note: note||''});
    ScoreEngine.redoStack[cid] = []; // 새 채점이 생기면 이전에 되돌린 것들은 더 이상 복구 대상이 아니다
    persistAndRender();
    return pool[targetId];
  },
  canUndo(cid){
    const p = activePeriod(cid);
    return !!p && currentHistory(cid).length>0;
  },
  canRedo(cid){
    const p = activePeriod(cid);
    const st = ScoreEngine.redoStack[cid]||[];
    return !!p && st.length>0 && st[st.length-1].periodId===p.id;
  },
  // 가장 최근 채점 1건을 취소한다 (점수도 함께 원래대로)
  undoLast(cid){
    const p = activePeriod(cid);
    if(!p) return null;
    const hist = currentHistory(cid);
    if(hist.length===0) return null;
    const entry = hist.pop();
    const pool = entry.targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[entry.targetId] = (pool[entry.targetId]||0) - entry.delta;
    (ScoreEngine.redoStack[cid] = ScoreEngine.redoStack[cid]||[]).push({entry, periodId:p.id});
    persistAndRender();
    return entry;
  },
  // 되돌린 채점을 다시 적용한다
  redo(cid){
    if(!ScoreEngine.canRedo(cid)) return null;
    const {entry} = ScoreEngine.redoStack[cid].pop();
    const pool = entry.targetType==='team' ? currentTeamScores(cid) : currentScores(cid);
    pool[entry.targetId] = (pool[entry.targetId]||0) + entry.delta;
    currentHistory(cid).push(entry);
    persistAndRender();
    return entry;
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
