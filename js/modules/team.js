"use strict";
/* ============================================================
   TEAM MODULE — team registration & student assignment only.
   No score math here; RankingModule reads membership to aggregate.
============================================================ */
const TeamModule = {
  setEnabled(cid, enabled){
    ensureClassData(cid);
    DB.teamsEnabled[cid] = enabled;
    persistAndRender();
  },
  addTeam(cid, name){
    ensureClassData(cid);
    DB.teams[cid].push({id:uid(), name});
    persistAndRender();
  },
  renameTeam(cid, tid, name){
    const t = (DB.teams[cid]||[]).find(x=>x.id===tid);
    if(!t) return;
    t.name = name;
    persistAndRender();
  },
  removeTeam(cid, tid){
    DB.teams[cid] = DB.teams[cid].filter(t=>t.id!==tid);
    const map = DB.studentTeam[cid]||{};
    Object.keys(map).forEach(sid=>{ if(map[sid]===tid) map[sid]=null; });
    persistAndRender();
  },
  assignStudent(cid, sid, tid){
    ensureClassData(cid);
    DB.studentTeam[cid][sid] = tid || null;
    persistAndRender();
  },
  teamOf(cid, sid){ return (DB.studentTeam[cid]||{})[sid] || null; },
  membersOf(cid, tid){ return (DB.students[cid]||[]).filter(s=>TeamModule.teamOf(cid,s.id)===tid); },
  setColor(cid, tid, color){
    const t = (DB.teams[cid]||[]).find(x=>x.id===tid);
    if(!t) return;
    if(color) t.color = color; else delete t.color;
    persistAndRender();
  }
};
