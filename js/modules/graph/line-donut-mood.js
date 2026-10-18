"use strict";
Object.assign(GraphRenderer,{
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
});

"use strict";
Object.assign(GraphRenderer,{
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
});

"use strict";
Object.assign(GraphRenderer,{
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
    // 칸 크기는 이제 JS로 픽셀을 계산하지 않고 CSS flex에 맡긴다 —
    // 창 폭이 바뀌면 브라우저가 알아서 모든 칸을 줄여서 항상 다 보이게 한다.
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
              <div class="mood-graph-stepper">
                <button type="button" data-sid="${s.id}" data-timing="before" data-dir="-1">−</button>
                <button type="button" data-sid="${s.id}" data-timing="before" data-dir="1">+</button>
              </div>
            </div>
            <div class="mood-graph-slot">
              <div class="mood-graph-slot-label">후</div>
              <div class="thermo thermo-lg"></div>
              <div class="mood-graph-value num"></div>
              <div class="mood-graph-stepper">
                <button type="button" data-sid="${s.id}" data-timing="after" data-dir="-1">−</button>
                <button type="button" data-sid="${s.id}" data-timing="after" data-dir="1">+</button>
              </div>
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
});

