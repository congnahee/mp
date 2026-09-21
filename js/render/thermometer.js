"use strict";
/* ============================================================
   THERMOMETER RENDERER — 0~10 값을 온도계 눈금 높이 + 색상으로
   변환한다. 파랑(0, 차가움) → 청록 → 초록 → 노랑 → 주황 → 빨강(10, 뜨거움)
   순서로 이어지는 무지개 스펙트럼 그라데이션. 높이/색 변화는
   CSS transition으로 자연스럽게 오르내리는 모션이 된다.
============================================================ */
function moodColor(value){
  if(value===null || value===undefined) return 'var(--panel-border)';
  const t = clamp(value,0,10)/10;
  // 220°(파랑) → -30°/330°(빨강-핑크)까지 250도를 스윕하면서
  // 청록(180)·초록(120)·노랑(60)·주황(20)을 자연스럽게 거쳐간다.
  const hue = ((220 - t*250) % 360 + 360) % 360;
  return `hsl(${hue}, 88%, 58%)`;
}
function renderThermometer(container, value){
  if(!container) return;
  const pct = (value===null || value===undefined) ? 0 : clamp(value,0,10)/10*100;
  const color = moodColor(value);
  if(!container.dataset.built){
    container.innerHTML = `<div class="thermo-tube"><div class="thermo-fill"></div></div><div class="thermo-bulb"></div>`;
    container.dataset.built = '1';
  }
  const fill = container.querySelector('.thermo-fill');
  const bulb = container.querySelector('.thermo-bulb');
  fill.style.height = pct + '%';
  fill.style.background = (value===null || value===undefined)
    ? 'var(--panel-border)'
    : `linear-gradient(to top, ${moodColor(0)}, ${color})`;
  bulb.style.background = color;
}
// 메인 그래프(온도계 타입)에서 학생 수/화면 폭에 맞춰 온도계 자체의 굵기를 조절할 때 사용
function applyThermoSize(container, widthPx){
  if(!container) return;
  container.style.width = widthPx + 'px';
  const tube = container.querySelector('.thermo-tube');
  const bulb = container.querySelector('.thermo-bulb');
  if(tube){
    const tubeW = Math.round(widthPx*0.6);
    tube.style.width = tubeW + 'px';
    tube.style.bottom = Math.round(widthPx*0.75) + 'px';
    tube.style.height = `calc(100% - ${Math.round(widthPx*0.75)}px)`;
  }
  if(bulb){
    bulb.style.width = widthPx + 'px';
    bulb.style.height = widthPx + 'px';
  }
}
