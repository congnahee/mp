"use strict";
Object.assign(GraphRenderer,{
  bar(area, ranked, rankChanges){
    if(area.dataset.mode!=='bar'){ area.innerHTML=''; area.dataset.mode='bar'; }
    const n = ranked.length;
    if(n===0){ area.innerHTML=''; return; }
    const W = area.clientWidth, H = area.clientHeight;
    const minGap = 14;
    const bw = clamp((W - minGap*(n+1))/n, 40, 220);
    // 막대폭이 상한(220px)에 걸려도 화면 오른쪽이 비지 않도록,
    // 남는 여백은 막대 사이 간격으로 고르게 분산해서 항상 컨테이너 전체 너비를 채운다.
    const gap = Math.max(minGap, (W - bw*n) / (n+1));
    const zoneH = H - 60;
    ranked.forEach((r,i)=>{
      let el = area.querySelector(`[data-sid="${r.id}"]`);
      const isNew = !el;
      if(isNew){
        el=document.createElement('div');
        el.className='bar-item';
        el.dataset.sid=r.id;
        el.innerHTML=`<div class="bar-rank"></div><div class="bar-col"><div class="bar-fill"></div></div>
          <div class="bar-score num"></div><div class="bar-name"></div>`;
        area.appendChild(el);
      }
      const x = gap + i*(bw+gap);
      el.style.left = x+'px';
      el.style.top = '0px';
      el.style.width = bw+'px';
      el.style.height = H+'px';
      const fill = el.querySelector('.bar-fill');
      // 음수 점수는 막대를 거의 바닥(최소 높이)으로 표시해서 "점수가 있는 것처럼" 보이지 않게 한다.
      // 숫자 라벨에는 실제 값(-10 등)을 그대로 보여준다.
      // Each bar depends only on its own score. A shared maximum makes every
      // other team's bar shrink when the leader gains points. The curve keeps
      // growing above 100 without an abrupt rescale or a hard ceiling.
      const positiveScore = Math.max(r.score, 0);
      const heightPx = Math.max(4, zoneH * 0.85 * positiveScore / (positiveScore + 100));
      const prevScore = fill.dataset.score;
      if(isNew){
        // 방금 생긴 막대는 "이전 상태"가 없어서 CSS transition이 못 타고 바로
        // 완성된 크기로 그려진다. 최소 높이로 한 번 찍고 강제로 리플로우를
        // 시킨 뒤 실제 높이로 바꿔서, 처음 등장해도 자라나는 모션이 보이게 한다.
        fill.style.height = '4px';
        void fill.offsetHeight;
      }
      fill.style.height = heightPx+'px';
      fill.dataset.score = r.score;
      if(r.color){
        fill.style.background = `linear-gradient(180deg, ${r.color}, ${shadeColor(r.color,-25)})`;
        fill.classList.remove('rank1');
      } else {
        fill.style.background = '';
        fill.classList.toggle('rank1', r.rank===1);
      }
      el.querySelector('.bar-rank').textContent = r.rank+'위';
      el.querySelector('.bar-score').textContent = r.score;
      el.querySelector('.bar-name').textContent = r.name;
      if(isNew===false && prevScore!==undefined && Number(prevScore)!==r.score){
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
      const change = rankChanges && rankChanges[r.id];
      if(change){
        el.classList.remove('rank-flash'); void el.offsetWidth; el.classList.add('rank-flash');
        if(change.becameFirst){
          let crown = el.querySelector('.crown-badge');
          if(!crown){ crown=document.createElement('div'); crown.className='crown-badge'; el.appendChild(crown); }
          crown.textContent='👑';
          setTimeout(()=>{ if(crown.parentNode) crown.remove(); }, 1500);
        }
      }
    });
    Array.from(area.children).forEach(el=>{
      if(el.dataset.sid && !ranked.find(r=>r.id===el.dataset.sid)) el.remove();
    });
  },
});

"use strict";
Object.assign(GraphRenderer,{
  race(area, ranked, rankChanges){
    if(area.dataset.mode!=='race'){ area.innerHTML=''; area.dataset.mode='race'; }
    const n = ranked.length;
    if(n===0){ area.innerHTML=''; return; }
    const H = area.clientHeight, W = area.clientWidth;
    const rowH = clamp((H-10)/Math.max(n,1), 34, 110);
    const trackH = clamp(rowH*0.55, 24, 64);
    ranked.forEach((r,i)=>{
      let el = area.querySelector(`[data-sid="${r.id}"]`);
      const isNew=!el;
      if(isNew){
        el=document.createElement('div');
        el.className='race-row';
        el.dataset.sid=r.id;
        el.innerHTML=`<div class="race-name"></div><div class="race-track"><div class="race-fill"><span class="race-score num"></span></div></div>`;
        area.appendChild(el);
      }
      el.style.top = (i*(rowH+6))+'px';
      el.style.left='0px';
      el.style.width=W+'px';
      el.style.height=rowH+'px';
      el.querySelector('.race-track').style.height = trackH+'px';
      el.querySelector('.race-name').textContent = r.name;
      const fillEl = el.querySelector('.race-fill');
      // 음수 점수는 트랙을 거의 바닥(최소 너비)으로 표시하고, 숫자는 실제 값을 그대로 보여준다.
      // Use the same independent score curve as the vertical bars. Another
      // team's points must not change this row's width.
      const positiveScore = Math.max(r.score, 0);
      const pct = Math.max(0.03, 0.85 * positiveScore / (positiveScore + 100));
      const prevScore = fillEl.dataset.score;
      if(isNew){
        fillEl.style.width = '3%';
        void fillEl.offsetWidth;
      }
      fillEl.style.width = (pct*100)+'%';
      fillEl.dataset.score=r.score;
      if(r.color){
        fillEl.style.background = `linear-gradient(90deg, ${shadeColor(r.color,-25)}, ${r.color})`;
        fillEl.classList.remove('rank1');
      } else {
        fillEl.style.background = '';
        fillEl.classList.toggle('rank1', r.rank===1);
      }
      el.querySelector('.race-score').textContent = r.score;
      if(!isNew && prevScore!==undefined && Number(prevScore)!==r.score){
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
      const change = rankChanges && rankChanges[r.id];
      if(change){
        el.classList.remove('rank-flash'); void el.offsetWidth; el.classList.add('rank-flash');
        if(change.becameFirst){
          let crown = el.querySelector('.crown-badge');
          if(!crown){ crown=document.createElement('div'); crown.className='crown-badge'; crown.style.left='40px'; el.appendChild(crown); }
          crown.textContent='👑';
          setTimeout(()=>{ if(crown.parentNode) crown.remove(); }, 1500);
        }
      }
    });
    Array.from(area.children).forEach(el=>{
      if(el.dataset.sid && !ranked.find(r=>r.id===el.dataset.sid)) el.remove();
    });
  },
});

