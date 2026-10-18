"use strict";
/* ============================================================
   GIFT SET MODULE — 여러 선물 세트(생일선물/월별선물 등)를
   만들고 전환. 사다리 모듈은 "지금 활성화된 세트"만 읽는다.
============================================================ */
const GiftSetModule = {
  add(cid, name){
    ensureClassData(cid);
    const s = {id:uid(), name: name||`세트 ${DB.giftSets[cid].length+1}`, gifts:{}};
    DB.giftSets[cid].push(s);
    DB.activeGiftSetId[cid] = s.id;
    persistAndRender();
  },
  remove(cid, id){
    if(DB.giftSets[cid].length<=1){ uiAlert('선물 세트는 최소 1개 있어야 해요.'); return; }
    DB.giftSets[cid] = DB.giftSets[cid].filter(s=>s.id!==id);
    if(DB.activeGiftSetId[cid]===id) DB.activeGiftSetId[cid] = DB.giftSets[cid][0].id;
    persistAndRender();
  },
  rename(cid, id, name){
    const s = DB.giftSets[cid].find(x=>x.id===id);
    if(!s) return;
    s.name = name || s.name;
    persistAndRender();
  },
  setActive(cid, id){
    DB.activeGiftSetId[cid] = id;
    persistAndRender();
  }
};
