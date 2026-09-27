"use strict";
/* ============================================================
   GIFT LADDER MODULE — reads ranking, fully independent screen
============================================================ */
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

const GiftLadder = {
  state: null,
  container: null,
  useTeam: false,
  // container: 이 사다리를 그릴 대상 DOM 엘리먼트 (메인 그래프 영역이 넘어온다)
  mount(container, cid){
    if(!container || !cid) return;
    ensureClassData(cid);
    const teamsAvailable = !!(DB.teamsEnabled[cid] && (DB.teams[cid]||[]).length>0);
    const useTeam = teamsAvailable && GiftLadder.useTeam;
    const ranked = useTeam ? RankingModule.computeTeams(cid) : RankingModule.computeStudents(cid);
    if(ranked.length<2){
      container.innerHTML = `<div style="color:var(--text-dim2);text-align:center;padding-top:20%;">${useTeam?'팀이':'학생이'} 2명 이상 있어야 사다리를 탈 수 있어요.</div>`;
      return;
    }
    const sets = DB.giftSets[cid]||[];
    const activeId = DB.activeGiftSetId[cid];
    const active = sets.find(s=>s.id===activeId) || sets[0];
    const lanes = ranked.length;
    GiftLadder.container = container;
    GiftLadder.state = {lanes, ranked, gifts: (active&&active.gifts)||{}};
    container.innerHTML = `
      ${teamsAvailable ? `<div class="chip-tabs" data-ladder="basisToggle">
        <button type="button" data-basis="student" class="${!useTeam?'active':''}">🙋 학생별</button>
        <button type="button" data-basis="team" class="${useTeam?'active':''}">👥 팀별</button>
      </div>` : ''}
      <div class="hint">${useTeam?'팀':'학생'} 랭킹 기준으로 진행해요. 등수 순서대로 사다리를 타고 내려가면 선물이 나와요.</div>
      <div class="chip-tabs" data-ladder="giftSetTabs">
        ${sets.map(s=>`<button type="button" data-set-id="${s.id}" class="${s.id===activeId?'active':''}">${s.name}</button>`).join('')}
      </div>
      <svg data-ladder="canvas" viewBox="0 0 ${lanes*80} 460" style="background:var(--bg-2);border-radius:14px;"></svg>
      <button class="ghost-btn" data-ladder="reshuffle" style="width:100%;max-width:960px;margin:10px auto 0;display:block;">🔀 사다리 다시 섞기</button>
      <div data-ladder="picks" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center;"></div>
      <div data-ladder="result"></div>`;
    if(teamsAvailable){
      container.querySelector('[data-ladder="basisToggle"]').addEventListener('click', (e)=>{
        const b = e.target.closest('button'); if(!b) return;
        GiftLadder.useTeam = b.dataset.basis==='team';
        GiftLadder.mount(container, cid);
      });
    }
    container.querySelector('[data-ladder="reshuffle"]').onclick=()=>GiftLadder.reshuffle();
    container.querySelector('[data-ladder="giftSetTabs"]').addEventListener('click', (e)=>{
      const b = e.target.closest('button'); if(!b) return;
      GiftLadder.selectGiftSet(b.dataset.setId);
    });
    GiftLadder.reshuffle();
  },
  selectGiftSet(setId){
    const cid = DB.activeClassId; if(!cid || !GiftLadder.state || !GiftLadder.container) return;
    const set = (DB.giftSets[cid]||[]).find(s=>s.id===setId);
    if(!set) return;
    GiftLadder.state.gifts = set.gifts || {};
    DB.activeGiftSetId[cid] = setId; // 사다리에서 고른 세트를 이후 기본값으로도 기억
    scheduleSave();
    GiftLadder.container.querySelectorAll('[data-ladder="giftSetTabs"] button').forEach(b=>b.classList.toggle('active', b.dataset.setId===setId));
    const { lanes, rungs, ranked, gifts } = GiftLadder.state;
    if(rungs) GiftLadder.drawLadder(lanes, rungs, ranked, gifts);
    GiftLadder.container.querySelector('[data-ladder="result"]').innerHTML='';
  },
  reshuffle(){
    const c = GiftLadder.container; if(!c) return;
    const {lanes, ranked, gifts} = GiftLadder.state;
    const rungs = GiftLadder.generateRungs(lanes, 16);
    GiftLadder.state.rungs = rungs;
    GiftLadder.drawLadder(lanes, rungs, ranked, gifts);
    const picks = c.querySelector('[data-ladder="picks"]'); picks.innerHTML='';
    ranked.forEach((r,i)=>{
      const b=document.createElement('button');
      b.className='ghost-btn';
      b.textContent = `${r.rank}등 ${r.name}`;
      b.onclick=()=>GiftLadder.run(i, lanes, rungs, ranked);
      picks.appendChild(b);
    });
    c.querySelector('[data-ladder="result"]').innerHTML='';
  },
  generateRungs(lanes, rows){
    const rungs=[]; // rungs[row] = array of booleans, true = connector between lane i and i+1
    for(let r=0;r<rows;r++){
      const row = new Array(lanes-1).fill(false);
      for(let i=0;i<lanes-1;i++){
        if(Math.random()<0.42 && !row[i-1]) row[i]=true;
      }
      rungs.push(row);
    }
    return rungs;
  },
  drawLadder(lanes, rungs, ranked, gifts){
    const w=80, top=30, bottom=430;
    const svg = GiftLadder.container.querySelector('[data-ladder="canvas"]');
    let html='';
    for(let i=0;i<lanes;i++){
      const x=w*i+w/2;
      html+=`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#3A3A42" stroke-width="3"/>`;
      html+=`<text x="${x}" y="${top-10}" fill="#9A92C9" font-size="11" text-anchor="middle">${ranked[i].rank}등</text>`;
      const g = gifts[ranked[i]?.rank] || gifts[i+1] || '';
      html+=`<text x="${x}" y="${bottom+18}" fill="#FFC24B" font-size="10" text-anchor="middle">${(g||'???').slice(0,6)}</text>`;
    }
    rungs.forEach((row,r)=>{
      const y = top + (bottom-top)*(r+1)/(rungs.length+1);
      row.forEach((on,i)=>{
        if(on){
          const x1=w*i+w/2, x2=w*(i+1)+w/2;
          html+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#5B8CFF" stroke-width="3"/>`;
        }
      });
    });
    html+=`<circle data-ladder="token" r="9" fill="#00E0A4" style="display:none;"/>`;
    svg.innerHTML=html;
  },
  run(startLane, lanes, rungs, ranked){
    const c = GiftLadder.container;
    const w=80, top=30, bottom=430;
    const rows=rungs.length;
    let lane=startLane;
    const path=[{x:w*lane+w/2, y:top}];
    for(let r=0;r<rows;r++){
      const y = top + (bottom-top)*(r+1)/(rows+1);
      const row = rungs[r];
      if(row[lane]){ path.push({x:w*lane+w/2,y}); lane++; path.push({x:w*lane+w/2,y}); }
      else if(lane>0 && row[lane-1]){ path.push({x:w*lane+w/2,y}); lane--; path.push({x:w*lane+w/2,y}); }
      else { path.push({x:w*lane+w/2,y}); }
    }
    path.push({x:w*lane+w/2, y:bottom});
    const token = c.querySelector('[data-ladder="token"]');
    token.style.display='block';
    let i=0;
    function step(){
      if(i>=path.length){
        const gifts = GiftLadder.state.gifts || {};
        const finalGift = gifts[ranked[lane]?.rank] || gifts[lane+1] || '축하해요! 🎉';
        c.querySelector('[data-ladder="result"]').innerHTML = `<div class="gift-reveal"><div class="display">${ranked[startLane].name}님 결과</div>
          <div style="font-size:34px;margin:10px 0;">🎁</div><div class="num" style="font-size:18px;color:var(--gold);">${finalGift}</div></div>`;
        return;
      }
      const p = path[i];
      token.setAttribute('cx',p.x); token.setAttribute('cy',p.y);
      i++;
      setTimeout(step, 130);
    }
    step();
  }
};
