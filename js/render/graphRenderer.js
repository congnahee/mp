"use strict";
/* ============================================================
   GRAPH RENDERER — swappable visualization, reads scores only
============================================================ */
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
    else GraphRenderer.donut(area, ranked);
    $$('#graphSwitch .icon-btn').forEach(b=>b.classList.toggle('on', b.dataset.g===type));
    $$('#modeSwitch .icon-btn').forEach(b=>b.classList.toggle('on', b.dataset.m===((DB.viewMode[cid])||'student')));
  },
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
    const maxAbs = Math.max(10, ...ranked.map(r=>Math.max(r.score,0)));
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
      const heightPx = clamp(Math.max(r.score,0)/maxAbs * (zoneH*0.85), 4, zoneH);
      const prevScore = fill.dataset.score;
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
  race(area, ranked, rankChanges){
    if(area.dataset.mode!=='race'){ area.innerHTML=''; area.dataset.mode='race'; }
    const n = ranked.length;
    if(n===0){ area.innerHTML=''; return; }
    const H = area.clientHeight, W = area.clientWidth;
    const rowH = clamp((H-10)/Math.max(n,1), 34, 110);
    const trackH = clamp(rowH*0.55, 24, 64);
    const maxAbs = Math.max(10, ...ranked.map(r=>Math.max(r.score,0)));
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
      const trackW = W-100;
      // 음수 점수는 트랙을 거의 바닥(최소 너비)으로 표시하고, 숫자는 실제 값을 그대로 보여준다.
      const pct = clamp(Math.max(r.score,0)/maxAbs, 0.03, 1);
      const prevScore = fillEl.dataset.score;
      fillEl.style.width = (trackW*pct)+'px';
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
  line(area, ranked, cid, viewMode){
    area.dataset.mode='line';
    const hist = currentHistory(cid);
    const W = area.clientWidth, H = area.clientHeight-30;
    if(ranked.length===0 || hist.length===0){
      const msg = ranked.length===0
        ? (viewMode==='team' ? '등록된 팀이 없어요. 설정 ⚙ > 팀 관리에서 추가해주세요.' : '등록된 학생이 없어요.')
        : '아직 점수 변화 기록이 없어요';
      area.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        color:var(--text-dim2);text-align:center;padding:0 20px;">${msg}</div>`;
      return;
    }
    // 각 항목(학생 또는 팀)의 누적 점수를 시간순으로 재구성.
    // 팀뷰에서는 학생 채점 기록도 그 학생이 속한 팀 라인에 합산되고,
    // 팀에 직접 준 보너스/감점도 같은 라인에 함께 반영된다.
    const series = {};
    ranked.forEach(r=>series[r.id]=[0]);
    const sorted = hist.slice().sort((a,b)=>a.ts-b.ts);
    sorted.forEach(h=>{
      let affectedId;
      if(viewMode==='team'){
        affectedId = h.targetType==='team' ? h.targetId : TeamModule.teamOf(cid, h.targetId);
      } else {
        affectedId = h.targetType==='team' ? null : h.targetId; // 학생뷰에서는 팀 직접 보너스는 표시하지 않음
      }
      ranked.forEach(r=>{
        const last = series[r.id][series[r.id].length-1];
        series[r.id].push(r.id===affectedId ? last+h.delta : last);
      });
    });
    const allVals = Object.values(series).flat();
    const maxV = Math.max(10,...allVals), minV = Math.min(0,...allVals);
    const steps = Math.max(...Object.values(series).map(s=>s.length));
    const colors = ['#5B8CFF','#00E0A4','#FFC24B','#FF5C7A','#A66BFF','#4BD0FF','#FF9F5B','#7CFF6B'];
    let svg = `<svg width="${W}" height="${H+30}" viewBox="0 0 ${W} ${H+30}">`;
    svg += `<line x1="0" y1="${H*(1-(0-minV)/(maxV-minV))}" x2="${W}" y2="${H*(1-(0-minV)/(maxV-minV))}" stroke="#3A3A42" stroke-dasharray="4,4"/>`;
    ranked.forEach((r,idx)=>{
      const pts = series[r.id];
      const lineColor = r.color || colors[idx%colors.length];
      const pathPts = pts.map((v,i)=>{
        const x = (i/(steps-1||1))*W;
        const y = H*(1-((v-minV)/(maxV-minV||1)));
        return `${x},${y}`;
      }).join(' ');
      svg += `<polyline points="${pathPts}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linejoin="round"/>`;
    });
    svg += `</svg>`;
    let legend = '<div style="display:flex;gap:10px;flex-wrap:wrap;padding:8px 4px;font-size:11px;">';
    ranked.forEach((r,idx)=>{
      const lineColor = r.color || colors[idx%colors.length];
      legend += `<span style="color:${lineColor}">● ${r.name} <span class="num">(${series[r.id][series[r.id].length-1]})</span></span>`;
    });
    legend += '</div>';
    area.innerHTML = svg+legend;
  },
  donut(area, ranked){
    area.dataset.mode='donut';
    if(ranked.length===0){ area.innerHTML=''; return; }
    const target = 100;
    let html = '<div class="donut-grid">';
    ranked.forEach(r=>{
      const pct = clamp(r.score/target,0,1.2);
      const deg = Math.min(pct,1)*360;
      const color = r.color ? r.color : (r.rank===1 ? 'var(--loss)' : 'var(--blue)');
      html += `<div class="donut-card">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="36" fill="none" stroke="#2A2A30" stroke-width="10"/>
          <circle cx="45" cy="45" r="36" fill="none" stroke="${color}" stroke-width="10"
            stroke-dasharray="${2*Math.PI*36}" stroke-dashoffset="${2*Math.PI*36*(1-Math.min(pct,1))}"
            stroke-linecap="round" transform="rotate(-90 45 45)"/>
          <text x="45" y="50" text-anchor="middle" fill="#F4F2FF" font-size="15" font-weight="800" font-family="JetBrains Mono">${r.score}</text>
        </svg>
        <div class="name">${r.name}</div>
        <div class="donut-pct" style="color:${color}">${Math.round(pct*100)}%</div>
      </div>`;
    });
    html += '</div>';
    area.innerHTML = html;
  },
  mood(area, cid){
    // bar()/race()와 같은 방식으로 기존 DOM을 재사용해서, 값이 바뀔 때
    // 매번 새로 그리지 않고 CSS transition으로 부드럽게 오르내리게 한다.
    if(!GraphRenderer.moodDate) GraphRenderer.moodDate = formatDateYMD(new Date());
    if(area.dataset.mode!=='mood'){
      area.innerHTML = `<div class="mood-graph-wrap">
        <div class="mood-graph-datebar">${dateFieldHTML('moodGraphDate', GraphRenderer.moodDate)}</div>
        <div class="mood-graph-area"></div>
      </div>`;
      area.dataset.mode='mood';
    }
    const students = DB.students[cid]||[];
    const wrap = area.querySelector('.mood-graph-area');
    if(students.length===0){
      wrap.innerHTML = '<div style="color:var(--text-dim2);text-align:center;padding-top:20%;">등록된 학생이 없어요</div>';
      return;
    }
    const dateStr = GraphRenderer.moodDate;
    const day = MoodModule.getDay(cid, dateStr);
    students.forEach(s=>{
      let col = wrap.querySelector(`[data-sid="${s.id}"]`);
      if(!col){
        col = document.createElement('div');
        col.className = 'mood-graph-col';
        col.dataset.sid = s.id;
        col.innerHTML = `
          <div class="mood-graph-pair">
            <div class="mood-graph-slot">
              <div class="mood-graph-slot-label">전</div>
              <div class="thermo thermo-lg"></div>
              <div class="mood-graph-value num"></div>
            </div>
            <div class="mood-graph-slot">
              <div class="mood-graph-slot-label">후</div>
              <div class="thermo thermo-lg"></div>
              <div class="mood-graph-value num"></div>
            </div>
          </div>
          <div class="mood-graph-name">${s.name}</div>`;
        wrap.appendChild(col);
      }
      const rec = day[s.id] || {before:null, after:null};
      const slots = col.querySelectorAll('.mood-graph-slot');
      renderThermometer(slots[0].querySelector('.thermo'), rec.before);
      slots[0].querySelector('.mood-graph-value').textContent = rec.before===null ? '-' : rec.before;
      renderThermometer(slots[1].querySelector('.thermo'), rec.after);
      slots[1].querySelector('.mood-graph-value').textContent = rec.after===null ? '-' : rec.after;
    });
    Array.from(wrap.children).forEach(col=>{
      if(col.dataset.sid && !students.find(s=>s.id===col.dataset.sid)) col.remove();
    });
  },
  burst(studentId, positive){
    const el = document.querySelector(`[data-sid="${studentId}"]`);
    if(!el) return;
    el.classList.remove('shake'); void el.offsetWidth;
    if(!positive) el.classList.add('shake');
    if(positive){
      for(let i=0;i<10;i++){
        const s=document.createElement('div');
        s.className='spark';
        const size=4+Math.random()*5;
        s.style.width=s.style.height=size+'px';
        s.style.background = i%2? 'var(--gain)':'var(--gold)';
        s.style.left='50%'; s.style.top='30%';
        const ang = Math.random()*Math.PI*2, dist=30+Math.random()*50;
        s.style.transition='all .7s ease-out';
        el.appendChild(s);
        requestAnimationFrame(()=>{
          s.style.transform=`translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
          s.style.opacity='0';
        });
        setTimeout(()=>s.remove(),750);
      }
    }
  }
};
