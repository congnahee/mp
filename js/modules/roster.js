"use strict";
/* ============================================================
   ROSTER MODULE — classes & students only
============================================================ */
const RosterModule = {
  addClass(name){
    const c = {id:uid(), name};
    DB.classes.push(c);
    ensureClassData(c.id);
    if(!DB.activeClassId) DB.activeClassId=c.id;
    persistAndRender();
  },
  removeClass(cid){
    DB.classes = DB.classes.filter(c=>c.id!==cid);
    if(DB.activeClassId===cid) DB.activeClassId = DB.classes[0]?.id || null;
    persistAndRender();
  },
  renameClass(cid, name){
    const c = DB.classes.find(x=>x.id===cid);
    if(!c || !name) return;
    c.name = name;
    persistAndRender();
  },
  setActive(cid){ DB.activeClassId=cid; persistAndRender(); },
  addStudent(cid,name){
    ensureClassData(cid);
    DB.students[cid].push({id:uid(), name});
    persistAndRender();
  },
  removeStudent(cid,sid){
    DB.students[cid] = DB.students[cid].filter(s=>s.id!==sid);
    if(DB.studentTeam[cid]) delete DB.studentTeam[cid][sid];
    persistAndRender();
  },
  renameStudent(cid, sid, name){
    const s = (DB.students[cid]||[]).find(x=>x.id===sid);
    if(!s || !name) return;
    s.name = name;
    persistAndRender();
  },
  setColor(cid, sid, color){
    const s = (DB.students[cid]||[]).find(x=>x.id===sid);
    if(!s) return;
    if(color) s.color = color; else delete s.color;
    persistAndRender();
  }
};
