"use strict";
const GraphRenderer = {
  prevRanks: {},
  render(cid){
    const type = DB.graphType[cid]||'bar';
    const area = $('#graphArea');
    const viewMode = (DB.teamsEnabled[cid] && DB.viewMode[cid]==='team') ? 'team' : 'student';
    let ranked = RankingModule.current(cid);
    if(viewMode==='team') ranked = ranked.map(r=>({...r, name:'👥 '+r.name}));
    // 순위 변동 감지: 지난 렌더 대비 등수가 바뀐 항목엔 플래시를, 새로 1위가 된 항목엔 왕관을 띄운다
    const rankChanges = {};
    ranked.forEach(r=>{
      const prev = GraphRenderer.prevRanks[r.id];
      if(prev!==undefined && prev!==r.rank) rankChanges[r.id] = { becameFirst: r.rank===1 && prev!==1 };
    });
    ranked.forEach(r=>{ GraphRenderer.prevRanks[r.id] = r.rank; });
    if(type==='bar') GraphRenderer.bar(area, ranked, rankChanges);
    else if(type==='race') GraphRenderer.race(area, ranked, rankChanges);
    else if(type==='line') GraphRenderer.line(area, ranked, cid, viewMode);
    else if(type==='mood') GraphRenderer.mood(area, cid);
    else if(type==='ladder'){
      if(area.dataset.mode!=='ladder'){
        area.dataset.mode='ladder';
        GiftLadder.mount(area, cid);
      }
    }
    else GraphRenderer.donut(area, ranked);
    $$('#graphSwitch .icon-btn').forEach(b=>b.classList.toggle('on', b.dataset.g===type));
    $$('#modeSwitch .icon-btn').forEach(b=>b.classList.toggle('on', b.dataset.m===((DB.viewMode[cid])||'student')));
    // 사다리 화면에서는 채점용 하단 독이 의미가 없으니 숨기고, 그래프 영역을 더 넓게 쓴다
    const dockEl = $('#dock');
    if(dockEl) dockEl.style.display = (type==='ladder') ? 'none' : '';
  },
};
