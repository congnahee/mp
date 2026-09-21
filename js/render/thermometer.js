"use strict";
/* ============================================================
   THERMOMETER RENDERER — 0~10 값을 온도계 눈금 높이 + 색상으로
   변환한다. 파랑(0) → 빨강(10) 그라데이션, 높이/색 변화는
   CSS transition으로 자연스럽게 오르내리는 모션이 된다.
============================================================ */
function moodColor(value){
  if(value===null || value===undefined) return 'var(--panel-border)';
  const t = clamp(value,0,10)/10;
  const r = Math.round(91  + (255-91)  * t); // blue(91,140,255) -> red(255,92,122)
  const g = Math.round(140 + (92-140)  * t);
  const b = Math.round(255 + (122-255) * t);
  return `rgb(${r},${g},${b})`;
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
  fill.style.background = color;
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
