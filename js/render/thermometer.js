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
