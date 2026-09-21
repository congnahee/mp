"use strict";
/* ============================================================
   MOOD UI — 기분 온도계 모달의 렌더링과 이벤트 연결.
   날짜 선택(자체 달력 재사용) + 학생별 전/후 온도계 + 증감 스테퍼.
============================================================ */
function openMoodModal(){
  const cid = DB.activeClassId;
  if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  const dateInput = $('#moodDate');
  if(!dateInput.value){
    const todayStr = formatDateYMD(new Date());
    dateInput.value = todayStr;
    const label = $('#moodDate_label');
    label.textContent = formatDateDisplay(todayStr);
    label.classList.remove('ph');
  }
  renderMoodList();
  openModal('#modalMood');
}
function renderMoodList(){
  const cid = DB.activeClassId;
  const list = $('#moodList');
  if(!cid || !list) return;
  const dateStr = $('#moodDate').value || formatDateYMD(new Date());
  list.innerHTML = '';
  const students = DB.students[cid]||[];
  if(students.length===0){
    list.innerHTML = '<div class="hint">등록된 학생이 없어요. 설정 ⚙ &gt; 학생 관리에서 먼저 추가해주세요.</div>';
    return;
  }
  const day = MoodModule.getDay(cid, dateStr);
  students.forEach(s=>{
    const rec = day[s.id] || {before:null, after:null};
    const row = document.createElement('div');
    row.className = 'mood-row';
    row.innerHTML = `
      <div class="mood-name">${s.name}</div>
      <div class="mood-pair">
        <div class="mood-slot">
          <div class="mood-slot-label">수업 전</div>
          <div class="thermo" id="thermo-${s.id}-before"></div>
          <div class="mood-stepper">
            <button type="button" data-sid="${s.id}" data-timing="before" data-dir="-1">−</button>
            <span class="mood-val" id="val-${s.id}-before">${rec.before===null?'-':rec.before}</span>
            <button type="button" data-sid="${s.id}" data-timing="before" data-dir="1">+</button>
          </div>
        </div>
        <div class="mood-slot">
          <div class="mood-slot-label">수업 후</div>
          <div class="thermo" id="thermo-${s.id}-after"></div>
          <div class="mood-stepper">
            <button type="button" data-sid="${s.id}" data-timing="after" data-dir="-1">−</button>
            <span class="mood-val" id="val-${s.id}-after">${rec.after===null?'-':rec.after}</span>
            <button type="button" data-sid="${s.id}" data-timing="after" data-dir="1">+</button>
          </div>
        </div>
      </div>`;
    list.appendChild(row);
    renderThermometer($(`#thermo-${s.id}-before`), rec.before);
    renderThermometer($(`#thermo-${s.id}-after`), rec.after);
  });
}
$('#btnMood').onclick = () => openMoodModal();
$('#moodList').addEventListener('click', (e)=>{
  const b = e.target.closest('button[data-sid]'); if(!b) return;
  const cid = DB.activeClassId; if(!cid) return;
  const dateStr = $('#moodDate').value || formatDateYMD(new Date());
  const sid = b.dataset.sid, timing = b.dataset.timing, dir = Number(b.dataset.dir);
  const cur = MoodModule.getScore(cid, dateStr, sid, timing);
  const base = cur===null ? 0 : cur;
  const next = clamp(base+dir, 0, 10);
  MoodModule.setScore(cid, dateStr, sid, timing, next);
  renderThermometer($(`#thermo-${sid}-${timing}`), next);
  $(`#val-${sid}-${timing}`).textContent = next;
  flashSaveStatus();
});
