"use strict";
/* ============================================================
   UTILS
============================================================ */
const uid = () => Math.random().toString(36).slice(2,10);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* ---- date helpers (자체 달력 컴포넌트에서 공용으로 사용) ---- */
function formatDateYMD(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hsvToHex(h,s,v){
  s/=100; v/=100;
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  const toHex=v2=>Math.round(clamp(v2+m,0,1)*255).toString(16).padStart(2,'0');
  return '#'+toHex(r)+toHex(g)+toHex(b);
}
function hexToHsv(hex){
  if(!hex) return {h:222, s:70, v:90};
  let h = hex.replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let hue=0;
  if(d!==0){
    if(max===r) hue = 60*(((g-b)/d)%6);
    else if(max===g) hue = 60*((b-r)/d+2);
    else hue = 60*((r-g)/d+4);
  }
  if(hue<0) hue += 360;
  const s = max===0 ? 0 : d/max*100;
  const v = max*100;
  return {h:hue, s, v};
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme', DB.theme==='light' ? 'light' : 'dark');
}
function colorSwatchHTML(type, id, currentColor){
  const {h,s,v} = hexToHsv(currentColor);
  const hex = currentColor || hsvToHex(h,s,v);
  return `<div class="color-swatch-wrap">
    <button type="button" class="color-swatch-btn" style="background:${currentColor||'var(--bg-2)'};" title="그래프 색 지정"></button>
    <div class="color-popover" data-color-for="${type}:${id}" data-h="${h}" data-s="${s}" data-v="${v}">
      <div class="sv-square" style="background:linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff,hsl(${h},100%,50%));">
        <div class="sv-handle" style="left:${s}%; top:${100-v}%;"></div>
      </div>
      <div class="hue-picker">
        <div class="hue-preview" style="background:${hex};"></div>
        <div class="hue-track">
          <div class="hue-handle" style="left:${(h/360*100)}%;"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" class="color-reset-btn" data-pick-for="${type}:${id}" data-color="">기본색 지정</button>
        <button type="button" class="color-confirm-btn">확인</button>
      </div>
    </div>
  </div>`;
}
function shadeColor(hex, percent){
  let h = (hex||'#5B8CFF').replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const num = parseInt(h,16);
  let r = clamp((num>>16) + Math.round(2.55*percent), 0, 255);
  let g = clamp(((num>>8)&0xff) + Math.round(2.55*percent), 0, 255);
  let b = clamp((num&0xff) + Math.round(2.55*percent), 0, 255);
  return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function formatDateDisplay(v){
  if(!v) return '날짜 선택';
  const [y,m,d] = v.split('-');
  return `${y}.${Number(m)}.${Number(d)}`;
}
function dateFieldHTML(id, value){
  const isEmpty = !value;
  return `<button type="button" class="date-field" data-for="${id}" id="${id}_btn">📅 <span id="${id}_label" class="${isEmpty?'ph':''}">${formatDateDisplay(value)}</span></button>`
    + `<input type="hidden" id="${id}" value="${value||''}">`;
}
function resetDateField(id){
  const hidden = document.getElementById(id); if(hidden) hidden.value='';
  const label = document.getElementById(id+'_label'); if(label){ label.textContent='날짜 선택'; label.classList.add('ph'); }
}

/* ============================================================
   UI DIALOG — 이 화면(artifact) 환경에서는 브라우저 기본
   alert/confirm/prompt가 동작하지 않아서 자체 구현으로 대체
============================================================ */
let dialogResolve = null;
function uiDialogOpen({message, showInput=false, inputValue='', showCancel=false, confirmText='확인', cancelText='취소'}){
  return new Promise(resolve=>{
    dialogResolve = resolve;
    $('#dialogMessage').textContent = message;
    $('#dialogInputField').style.display = showInput ? 'flex' : 'none';
    $('#dialogInput').value = inputValue;
    $('#dialogCancelBtn').style.display = showCancel ? 'inline-block' : 'none';
    $('#dialogCancelBtn').textContent = cancelText;
    $('#dialogOkBtn').textContent = confirmText;
    $('#modalDialog').classList.add('open');
    if(showInput) setTimeout(()=>$('#dialogInput').focus(), 50);
  });
}
function uiDialogClose(result){
  $('#modalDialog').classList.remove('open');
  if(dialogResolve){ dialogResolve(result); dialogResolve=null; }
}
function uiAlert(message){
  return uiDialogOpen({message, showInput:false, showCancel:false, confirmText:'확인'});
}
function uiConfirm(message, onYes){
  uiDialogOpen({message, showInput:false, showCancel:true, confirmText:'확인', cancelText:'취소'})
    .then(ok=>{ if(ok) onYes(); });
}
function uiPrompt(message, defaultValue, onSubmit){
  uiDialogOpen({message, showInput:true, inputValue:defaultValue, showCancel:true, confirmText:'확인', cancelText:'취소'})
    .then(val=>{ if(val!==null) onSubmit(val); });
}

/* ============================================================
   DATE PICKER — 자체 캘린더. 네이티브 <input type=date>의
   달력 팝업이 이 환경(artifact)에서 열리지 않아서 직접 구현.
   date-field 버튼은 이벤트 위임으로 감지하므로, 나중에
   innerHTML로 새로 그려지는 버튼(기간 편집 폼 등)도 별도
   재연결 없이 자동으로 동작한다.
============================================================ */
const DatePicker = {
  year:0, month:0, selected:'', onPick:null,
  open(currentValue, onPick){
    const base = currentValue ? new Date(currentValue+'T00:00:00') : new Date();
    DatePicker.year = base.getFullYear();
    DatePicker.month = base.getMonth();
    DatePicker.selected = currentValue||'';
    DatePicker.onPick = onPick;
    DatePicker.renderGrid();
    $('#modalDatePicker').classList.add('open');
  },
  renderGrid(){
    const y=DatePicker.year, m=DatePicker.month;
    $('#dpMonthLabel').textContent = `${y}년 ${m+1}월`;
    const first = new Date(y,m,1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(y,m+1,0).getDate();
    const todayStr = formatDateYMD(new Date());
    let html = ['일','월','화','수','목','금','토'].map(d=>`<div class="dp-dow">${d}</div>`).join('');
    for(let i=0;i<startWeekday;i++) html += `<div class="dp-empty"></div>`;
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cls = ['dp-day'];
      if(dateStr===DatePicker.selected) cls.push('sel');
      if(dateStr===todayStr) cls.push('today');
      html += `<div class="${cls.join(' ')}" data-date="${dateStr}">${d}</div>`;
    }
    $('#dpGrid').innerHTML = html;
  }
};
