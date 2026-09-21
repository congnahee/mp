"use strict";
/* ============================================================
   UI WIRING
============================================================ */
function persistAndRender(){ scheduleSave(); render(); }

function render(){
  const cid = DB.activeClassId;
  renderClassTabs();
  if(!cid || (DB.students[cid]||[]).length===0){
    $('#emptyState').style.display='flex';
  } else {
    $('#emptyState').style.display='none';
  }
  if(cid){
    ensureClassData(cid);
    renderPeriodChip(cid);
    $('#modeSwitch').style.display = DB.teamsEnabled[cid] ? 'flex' : 'none';
    renderTargetStrip(cid);
    renderQuestionPanel(cid);
    GraphRenderer.render(cid);
    updateActionButtons(cid);
    const brushVal = DB.selection[cid].brushValue;
    $$('#brushRow button[data-v]').forEach(b=>b.classList.toggle('active', Number(b.dataset.v)===brushVal));
    $('#brushRow').classList.toggle('armed', brushVal!==null && brushVal!==undefined);
  } else {
    $('#graphArea').innerHTML='';
    $('#modeSwitch').style.display='none';
  }
  renderSettingsLists();
}

function renderClassTabs(){
  const wrap = $('#classTabs'); wrap.innerHTML='';
  DB.classes.forEach(c=>{
    const b=document.createElement('div');
    b.className='class-tab'+(c.id===DB.activeClassId?' active':'');
    b.textContent=c.name;
    b.onclick=()=>RosterModule.setActive(c.id);
    wrap.appendChild(b);
  });
  const add=document.createElement('div');
  add.className='class-tab add';
  add.textContent='+ 반';
  add.onclick=()=>openModal('#modalSettings');
  wrap.appendChild(add);
}

function renderPeriodChip(cid){
  const p = activePeriod(cid);
  const chip = $('#periodChip');
  if(!p){
    chip.innerHTML = `<span>기간 없음</span>`;
    chip.style.cursor='pointer';
    chip.onclick=()=>{ openModal('#modalSettings'); switchStab('period'); };
  } else {
    const range = p.startDate ? `<span class="num" style="font-size:10px;">${p.startDate}~${p.endDate||'미정'}</span>` : '';
    chip.innerHTML = `<b>${p.label}</b>${range}<span>진행중</span> <span style="cursor:pointer;color:var(--loss);" id="closePeriodInline">마감</span>`;
    chip.querySelector('#closePeriodInline').onclick=(e)=>{
      e.stopPropagation();
      uiConfirm(`'${p.label}' 기간을 마감할까요? 마감 후에는 점수를 더 쌓을 수 없어요.`, ()=>PeriodManager.close(cid));
    };
  }
}

function currentGradingPoints(cid){
  const sel = DB.selection[cid];
  const q = QuizModule.liveQuiz(cid);
  const cur = q ? q.questions[q.currentIndex] : null;
  return (q && q.mode==='B' && cur) ? cur.points : sel.points;
}
function gradeEntity(cid, targetType, entityId, delta, note){
  ScoreEngine.apply(cid, targetType, entityId, delta, note);
  requestAnimationFrame(()=>GraphRenderer.burst(entityId, delta>=0));
}
function attachChipGesture(chip, cid, targetType, entityId){
  const THRESH_TAP = 8, THRESH_SWIPE = 56;
  let startX=0, startY=0, dx=0, dragging=false, moved=false;
  chip.addEventListener('pointerdown', (e)=>{
    startX=e.clientX; startY=e.clientY; dx=0; dragging=true; moved=false;
    chip.classList.add('swiping'); chip.classList.remove('swipe-snap');
  });
  chip.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    dx = e.clientX-startX;
    const dy = e.clientY-startY;
    if(Math.abs(dx) > THRESH_TAP || Math.abs(dy) > THRESH_TAP) moved=true;
    if(Math.abs(dx) > Math.abs(dy)){
      chip.style.transform = `translateX(${dx}px)`;
      chip.style.borderColor = dx>18 ? 'var(--gain)' : (dx<-18 ? 'var(--loss)' : '');
    }
  });
  const finish = ()=>{
    if(!dragging) return;
    dragging=false;
    chip.classList.remove('swiping'); chip.classList.add('swipe-snap');
    const finalDx = dx;
    chip.style.transform=''; chip.style.borderColor='';
    const cidNow = DB.activeClassId; if(!cidNow) return;
    if(Math.abs(finalDx) >= THRESH_SWIPE){
      const pts = currentGradingPoints(cidNow);
      gradeEntity(cidNow, targetType, entityId, finalDx>0?pts:-pts, finalDx>0?'스와이프 정답':'스와이프 오답');
    } else if(!moved){
      const sel = DB.selection[cidNow];
      if(sel.brushValue!==null && sel.brushValue!==undefined){
        gradeEntity(cidNow, targetType, entityId, sel.brushValue, '브러시 채점');
      } else {
        sel.targetType = targetType;
        sel.targetId = entityId;
        render();
      }
    }
  };
  chip.addEventListener('pointerup', finish);
  chip.addEventListener('pointercancel', finish);
}
function renderTargetStrip(cid){
  const strip = $('#studentStrip'); strip.innerHTML='';
  const sel = DB.selection[cid];
  if(sel.targetType==='team' && DB.teamsEnabled[cid]){
    const teams = RankingModule.computeTeams(cid);
    teams.forEach(t=>{
      const chip=document.createElement('div');
      chip.className='stu-chip'+(sel.targetId===t.id?' selected':'');
      chip.innerHTML = `<div>👥 ${t.name}</div><div class="s num">${t.score}</div>`;
      attachChipGesture(chip, cid, 'team', t.id);
      strip.appendChild(chip);
    });
    const addChip = document.createElement('div');
    addChip.className='stu-chip add';
    addChip.textContent = '+';
    addChip.title = '팀 추가';
    addChip.onclick=()=>{
      uiPrompt('새 팀 이름을 입력하세요', '', (name)=>{
        const v=(name||'').trim(); if(!v) return;
        TeamModule.addTeam(cid, v);
      });
    };
    strip.appendChild(addChip);
  } else {
    const scores = currentScores(cid);
    (DB.students[cid]||[]).forEach(s=>{
      const chip=document.createElement('div');
      chip.className='stu-chip'+(sel.targetType==='student' && sel.targetId===s.id?' selected':'');
      chip.innerHTML = `<div>${s.name}</div><div class="s num">${scores[s.id]||0}</div>`;
      attachChipGesture(chip, cid, 'student', s.id);
      strip.appendChild(chip);
    });
    const addChip = document.createElement('div');
    addChip.className='stu-chip add';
    addChip.textContent = '+';
    addChip.title = '학생 추가';
    addChip.onclick=()=>{
      uiPrompt('새 학생 이름을 입력하세요', '', (name)=>{
        const v=(name||'').trim(); if(!v) return;
        RosterModule.addStudent(cid, v);
      });
    };
    strip.appendChild(addChip);
  }
}

function renderQuestionPanel(cid){
  const q = QuizModule.liveQuiz(cid);
  const panel = $('#questionPanel');
  if(!q || q.mode==='A'){ panel.style.display='none'; return; }
  const cur = q.questions[q.currentIndex];
  if(!cur){ panel.style.display='none'; return; }
  panel.style.display='flex';
  panel.innerHTML = `
    <button class="ghost-btn" id="qPrev">◀</button>
    <div style="flex:1;">
      <div>${q.currentIndex+1}/${q.questions.length}. ${cur.text}</div>
      ${q.mode==='B' ? `<div style="margin-top:4px;">정답: <b>${cur.answer||'-'}</b> · 배점 <b>${cur.points}</b>점</div>` : ''}
    </div>
    <button class="ghost-btn" id="qNext">▶</button>`;
  $('#qPrev').onclick=()=>QuizModule.prevQuestion(cid);
  $('#qNext').onclick=()=>QuizModule.nextQuestion(cid);
  if(q.mode==='B') DB.selection[cid].points = cur.points;
}

function updateActionButtons(cid){
  const sel = DB.selection[cid];
  const has = sel.targetType==='team'
    ? (DB.teams[cid]||[]).some(t=>t.id===sel.targetId)
    : (DB.students[cid]||[]).some(s=>s.id===sel.targetId);
  $('#btnCorrect').disabled = !has;
  $('#btnWrong').disabled = !has;
  const q = QuizModule.liveQuiz(cid);
  const stepperVisible = !(q && q.mode==='B');
  $('#pointStepper').style.display = stepperVisible ? 'flex' : 'none';
  $('#ptVal').textContent = sel.points;
}

/* ---- header interactions ---- */
$('#graphSwitch').addEventListener('click', e=>{
  const b = e.target.closest('.icon-btn'); if(!b) return;
  const cid = DB.activeClassId; if(!cid) return;
  DB.graphType[cid] = b.dataset.g;
  persistAndRender();
});
$('#emptyAddClass').onclick=()=>openModal('#modalSettings');
$('#btnSettings').onclick=()=>openModal('#modalSettings');
$('#btnHistory').onclick=()=>{ renderHistoryModal(); openModal('#modalHistory'); };
$('#gift-fab').onclick=()=>GiftLadder.open();
$('#present-fab').onclick=()=>{
  $('#app').classList.add('present-mode');
  const cid = DB.activeClassId;
  if(cid) requestAnimationFrame(()=>GraphRenderer.render(cid));
};
$('#presentExitBtn').onclick=()=>{
  $('#app').classList.remove('present-mode');
  const cid = DB.activeClassId;
  if(cid) requestAnimationFrame(()=>GraphRenderer.render(cid));
};
$('#winner-fab').onclick=()=>openWinnerReveal();
$('#winnerCloseBtn').onclick=()=>closeWinnerReveal();

/* ---- 1위 발표: 전체화면 빨강 연출 + 폭죽 ---- */
let fireworksRAF = null, fireworksParticles = [];
function openWinnerReveal(){
  const cid = DB.activeClassId; if(!cid) return;
  const useTeam = !!(DB.teamsEnabled[cid] && DB.viewMode[cid]==='team');
  const ranked = useTeam ? RankingModule.computeTeams(cid) : RankingModule.computeStudents(cid);
  if(ranked.length===0){ uiAlert('발표할 순위가 없어요.'); return; }
  const winner = ranked[0];
  const p = activePeriod(cid);
  const set = activeGiftSet(cid);
  const giftText = set && set.gifts && set.gifts[1] ? ('🎁 ' + set.gifts[1]) : '';
  $('#winnerPeriodLabel').textContent = p ? p.label : '';
  $('#winnerName').textContent = winner.name.replace('👥 ','');
  $('#winnerPoints').textContent = winner.score + ' POINTS';
  $('#winnerGift').textContent = giftText;
  $('#winnerOverlay').classList.add('open');
  startFireworks();
}
function closeWinnerReveal(){
  $('#winnerOverlay').classList.remove('open');
  stopFireworks();
}
function startFireworks(){
  const canvas = $('#fireworksCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  fireworksParticles = [];
  const colors = ['#FFC24B','#00E0A4','#5B8CFF','#FF6EC7','#FFFFFF'];
  function burst(){
    const x = Math.random()*canvas.width;
    const y = canvas.height*0.25 + Math.random()*canvas.height*0.3;
    for(let i=0;i<42;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 2+Math.random()*4.2;
      fireworksParticles.push({ x, y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        life: 55+Math.random()*20, color: colors[Math.floor(Math.random()*colors.length)] });
    }
  }
  let frame=0;
  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(frame%38===0) burst();
    fireworksParticles.forEach(pt=>{
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.05; pt.life--;
      ctx.globalAlpha = Math.max(pt.life/75, 0);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.6, 0, Math.PI*2); ctx.fill();
    });
    fireworksParticles = fireworksParticles.filter(pt=>pt.life>0);
    ctx.globalAlpha = 1;
    frame++;
    fireworksRAF = requestAnimationFrame(loop);
  }
  burst();
  loop();
}
function stopFireworks(){
  if(fireworksRAF) cancelAnimationFrame(fireworksRAF);
  fireworksRAF = null;
  fireworksParticles = [];
}
$('#brushRow').addEventListener('click', (e)=>{
  const cid = DB.activeClassId; if(!cid) return;
  const sel = DB.selection[cid];
  const offBtn = e.target.closest('#brushOffBtn');
  if(offBtn){ sel.brushValue = null; render(); return; }
  const b = e.target.closest('button[data-v]'); if(!b) return;
  const v = Number(b.dataset.v);
  sel.brushValue = v;
  sel.points = Math.abs(v);
  render();
});
$('#modeSwitch').addEventListener('click', e=>{
  const b = e.target.closest('.icon-btn'); if(!b) return;
  const cid = DB.activeClassId; if(!cid) return;
  const mode = b.dataset.m;
  DB.viewMode[cid] = mode;
  DB.selection[cid].targetType = mode;
  DB.selection[cid].targetId = null;
  persistAndRender();
});

/* ---- scoring controls ---- */
$('#ptMinus').onclick=()=>{ const cid=DB.activeClassId; if(!cid)return; DB.selection[cid].points=clamp(DB.selection[cid].points-5,1,100); render(); };
$('#ptPlus').onclick=()=>{ const cid=DB.activeClassId; if(!cid)return; DB.selection[cid].points=clamp(DB.selection[cid].points+5,1,100); render(); };

$('#btnCorrect').onclick=()=>scoreAction(true);
$('#btnWrong').onclick=()=>scoreAction(false);

function scoreAction(isCorrect){
  const cid = DB.activeClassId; if(!cid) return;
  const sel = DB.selection[cid];
  if(!sel.targetId) return;
  const q = QuizModule.liveQuiz(cid);
  const cur = q ? q.questions[q.currentIndex] : null;
  const pts = currentGradingPoints(cid);
  const delta = isCorrect ? pts : -pts;
  const note = cur ? cur.text : '즉석채점';
  gradeEntity(cid, sel.targetType, sel.targetId, delta, note);
}

/* ---- modal open/close ---- */
function openModal(sel){ $(sel).classList.add('open'); }
function closeModal(sel){ $(sel).classList.remove('open'); }
$$('.modal-back').forEach(m=>{
  m.addEventListener('click', e=>{
    if(e.target!==m) return;
    m.classList.remove('open');
    if(m.id==='modalDialog' && dialogResolve){
      const showInput = $('#dialogInputField').style.display!=='none';
      const showCancel = $('#dialogCancelBtn').style.display!=='none';
      dialogResolve(showCancel ? (showInput?null:false) : (showInput? $('#dialogInput').value : true));
      dialogResolve=null;
    }
  });
});
$$('[data-close]').forEach(b=>b.addEventListener('click', ()=>b.closest('.modal-back').classList.remove('open')));

/* ---- dialog buttons ---- */
$('#dialogOkBtn').onclick=()=>{
  const showInput = $('#dialogInputField').style.display!=='none';
  uiDialogClose(showInput ? $('#dialogInput').value : true);
};
$('#dialogCancelBtn').onclick=()=>{
  const showInput = $('#dialogInputField').style.display!=='none';
  uiDialogClose(showInput ? null : false);
};
$('#dialogInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#dialogOkBtn').click(); });

/* ---- date picker wiring ---- */
$('#dpPrev').onclick=()=>{ DatePicker.month--; if(DatePicker.month<0){DatePicker.month=11; DatePicker.year--;} DatePicker.renderGrid(); };
$('#dpNext').onclick=()=>{ DatePicker.month++; if(DatePicker.month>11){DatePicker.month=0; DatePicker.year++;} DatePicker.renderGrid(); };
$('#dpTodayBtn').onclick=()=>{ const t=new Date(); DatePicker.year=t.getFullYear(); DatePicker.month=t.getMonth(); DatePicker.renderGrid(); };
$('#dpClearBtn').onclick=()=>{ if(DatePicker.onPick) DatePicker.onPick(''); closeModal('#modalDatePicker'); };
$('#dpGrid').addEventListener('click', e=>{
  const cell = e.target.closest('.dp-day'); if(!cell) return;
  if(DatePicker.onPick) DatePicker.onPick(cell.dataset.date);
  closeModal('#modalDatePicker');
});
// 이벤트 위임: 지금 있는 버튼은 물론, 나중에 innerHTML로 새로 그려지는
// date-field 버튼(기간 수정 폼 등)도 재연결 없이 자동으로 동작한다.
document.addEventListener('click', e=>{
  const btn = e.target.closest('.date-field'); if(!btn) return;
  const targetId = btn.dataset.for;
  const hidden = document.getElementById(targetId);
  if(!hidden) return;
  DatePicker.open(hidden.value, (val)=>{
    hidden.value = val;
    const label = document.getElementById(targetId+'_label');
    if(label){ label.textContent = formatDateDisplay(val); label.classList.toggle('ph', !val); }
    if(targetId==='moodDate') renderMoodList();
  });
});

/* ---- settings modal ---- */
function switchStab(name){
  $$('.tab-mini [data-stab]').forEach(b=>b.classList.toggle('active', b.dataset.stab===name));
  ['class','student','team','period','gift','cloud'].forEach(k=> $('#stab-'+k).style.display = k===name?'block':'none');
  if(name==='gift') renderGiftSetupInputs();
  if(name==='cloud') renderCloudTab();
}
$$('.tab-mini [data-stab]').forEach(b=>b.addEventListener('click', ()=>switchStab(b.dataset.stab)));

$('#addClassBtn').onclick=()=>{
  const v = $('#newClassName').value.trim();
  if(!v) return;
  RosterModule.addClass(v);
  $('#newClassName').value='';
};
$('#addStudentBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  const v = $('#newStudentName').value.trim();
  if(!v) return;
  RosterModule.addStudent(cid, v);
  $('#newStudentName').value='';
};
$('#importStudentsTrigger').onclick=()=>{
  const cid = DB.activeClassId; if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  $('#importStudentsInput').click();
};
$('#importStudentsInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  e.target.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록
  if(!file) return;
  const cid = DB.activeClassId; if(!cid) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      let names = [];
      if(/\.csv$/i.test(file.name)){
        const text = typeof reader.result === 'string' ? reader.result : new TextDecoder('utf-8').decode(reader.result);
        names = text.split(/\r?\n/).map(line=>line.split(',')[0].trim()).filter(Boolean);
      } else {
        const wb = XLSX.read(reader.result, {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {header:1});
        names = rows.map(r=>String(r[0]||'').trim()).filter(Boolean);
      }
      // "이름"/"name" 같은 제목행은 건너뛴다
      names = names.filter(n=>!/^(이름|성명|name)$/i.test(n));
      if(names.length===0){ uiAlert('파일에서 이름을 찾지 못했어요.'); return; }
      uiConfirm(`${names.length}명을 현재 반에 추가할까요?\n(${names.slice(0,5).join(', ')}${names.length>5?' 외':''})`, ()=>{
        names.forEach(n=>RosterModule.addStudent(cid, n));
      });
    }catch(err){
      uiAlert('파일을 읽지 못했어요. CSV 또는 엑셀(.xlsx) 파일인지 확인해주세요.\n(' + err.message + ')');
    }
  };
  if(/\.csv$/i.test(file.name)) reader.readAsText(file, 'utf-8');
  else reader.readAsArrayBuffer(file);
});
$('#applyStudentColorsBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid) return;
  persistAndRender();
  closeModal('#modalSettings');
};
$('#themeSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  DB.theme = b.dataset.theme;
  applyTheme();
  $$('#themeSeg button').forEach(x=>x.classList.toggle('active', x===b));
  scheduleSave();
});
$('#periodTypeSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  $$('#periodTypeSeg button').forEach(x=>x.classList.toggle('active', x===b));
  $('#periodType').value = b.dataset.val;
});
$('#startPeriodBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  const type = $('#periodType').value;
  const label = $('#periodLabel').value.trim();
  const startDate = $('#periodStart').value;
  const endDate = $('#periodEnd').value;
  PeriodManager.start(cid, type, label, startDate, endDate);
  $('#periodLabel').value='';
  resetDateField('periodStart'); resetDateField('periodEnd');
};

function renderSettingsLists(){
  const cid = DB.activeClassId;
  $$('#themeSeg button').forEach(b=>b.classList.toggle('active', b.dataset.theme===(DB.theme||'dark')));
  const classList = $('#classList'); classList.innerHTML='';
  DB.classes.forEach(c=>{
    const row=document.createElement('div'); row.className='row-item';
    row.innerHTML = `<span>${c.name} ${c.id===cid?'(선택됨)':''}</span>
      <span class="row-right">
        <span class="x" data-cid-edit="${c.id}" style="color:var(--blue);">수정</span>
        <span class="x" data-cid-del="${c.id}">삭제</span>
      </span>`;
    row.querySelector('[data-cid-edit]').onclick=()=>{
      uiPrompt('반 이름을 수정하세요', c.name, (name)=>{
        const v=(name||'').trim(); if(!v) return;
        RosterModule.renameClass(c.id, v);
      });
    };
    row.querySelector('[data-cid-del]').onclick=()=>{
      uiConfirm(`'${c.name}' 반을 삭제할까요? 모든 데이터가 사라져요.`, ()=>RosterModule.removeClass(c.id));
    };
    classList.appendChild(row);
  });
  const studentList = $('#studentList'); studentList.innerHTML='';
  if(cid){
    (DB.students[cid]||[]).forEach(s=>{
      const row=document.createElement('div'); row.className='row-item';
      row.innerHTML = `<span>${s.name}</span>
        <span class="row-right">
          ${colorSwatchHTML('student', s.id, s.color)}
          <span class="x" data-sid-edit="${s.id}" style="color:var(--blue);">수정</span>
          <span class="x" data-sid-del="${s.id}">삭제</span>
        </span>`;
      row.querySelector('[data-sid-edit]').onclick=()=>{
        uiPrompt('학생 이름을 수정하세요', s.name, (name)=>{
          const v=(name||'').trim(); if(!v) return;
          RosterModule.renameStudent(cid, s.id, v);
        });
      };
      row.querySelector('[data-sid-del]').onclick=()=>{
        uiConfirm(`'${s.name}' 학생을 삭제할까요?`, ()=>RosterModule.removeStudent(cid,s.id));
      };
      studentList.appendChild(row);
    });
  }
  const periodHist = $('#periodHistory'); periodHist.innerHTML='';
  if(cid){
    (DB.periods[cid]||[]).filter(p=>p.status==='closed').reverse().forEach(p=>{
      const row=document.createElement('div'); row.className='row-item';
      const range = p.startDate ? ` (${p.startDate}~${p.endDate||'미정'})` : '';
      row.innerHTML = `<span>${p.label}${range}</span><span class="num" style="color:var(--text-dim);">마감됨</span>`;
      periodHist.appendChild(row);
    });
  }
  renderActivePeriodEditor();
  renderTeamTab();
  renderGiftSetupInputs();
}

function renderActivePeriodEditor(){
  const cid = DB.activeClassId;
  const wrap = $('#activePeriodEditor');
  if(!wrap) return;
  if(!cid){ wrap.innerHTML=''; return; }
  const p = activePeriod(cid);
  if(!p){
    wrap.innerHTML = '<div class="hint">진행 중인 기간이 없어요. 아래에서 새로 시작하세요.</div>';
    return;
  }
  wrap.innerHTML = `
    <h4>진행 중인 기간 수정</h4>
    <div class="field"><input id="editPeriodLabel" value="${p.label}"></div>
    <div class="field">
      ${dateFieldHTML('editPeriodStart', p.startDate)}
      ${dateFieldHTML('editPeriodEnd', p.endDate)}
    </div>
    <div style="display:flex;gap:8px;">
      <button class="ghost-btn" id="saveActivePeriodBtn" style="flex:1;">저장</button>
      <button class="ghost-btn" id="resetActivePeriodBtn" style="flex:1;color:var(--loss);">🔄 점수 초기화</button>
    </div>
    <div class="hint">점수 초기화는 현재 기간의 점수·채점 이력만 지우고 0점부터 다시 시작해요. 기간 자체(이름·날짜)는 유지돼요.</div>
  `;
  $('#saveActivePeriodBtn').onclick=()=>{
    const label = $('#editPeriodLabel').value.trim();
    PeriodManager.updateActive(cid, label, $('#editPeriodStart').value, $('#editPeriodEnd').value);
  };
  $('#resetActivePeriodBtn').onclick=()=>{
    uiConfirm(`'${p.label}' 기간의 점수와 채점 이력을 모두 초기화할까요? 되돌릴 수 없어요.`, ()=>PeriodManager.resetActive(cid));
  };
}

function renderTeamTab(){
  const cid = DB.activeClassId;
  const stateEl = $('#teamToggleState');
  const body = $('#teamManageBody');
  const toggleRow = $('#teamToggleRow');
  if(!stateEl || !body) return;
  if(!cid){
    stateEl.textContent='';
    body.innerHTML = '<div class="hint">반을 먼저 선택하세요</div>';
    toggleRow.onclick=null;
    return;
  }
  const enabled = !!DB.teamsEnabled[cid];
  stateEl.textContent = enabled ? 'ON' : 'OFF';
  stateEl.style.color = enabled ? 'var(--gain)' : 'var(--text-dim2)';
  toggleRow.onclick = ()=>TeamModule.setEnabled(cid, !enabled);

  if(!enabled){
    body.innerHTML = '<div class="hint" style="margin-top:10px;">팀 기능을 켜면 팀 이름을 등록하고 학생을 배정할 수 있어요. 그래프·랭킹·사다리를 팀 기준으로도 볼 수 있게 돼요.</div>';
    return;
  }

  body.innerHTML = `
    <h4>팀 목록</h4>
    <div class="field"><input id="newTeamName" placeholder="팀 이름 (예: 불꽃조)"></div>
    <button class="primary-btn" id="addTeamBtn">+ 팀 추가</button>
    <div id="teamList" style="margin-top:8px;"></div>
    <h4>학생 팀 배정</h4>
    <div id="assignList"></div>
    <button class="primary-btn" id="applyTeamColorsBtn" style="background:var(--gain);color:#0A0820;margin-top:10px;">✅ 그래프에 적용하고 확인하기</button>
  `;

  const teamList = $('#teamList');
  const teams = DB.teams[cid]||[];
  if(teams.length===0){
    teamList.innerHTML = '<div class="hint">아직 등록된 팀이 없어요.</div>';
  }
  teams.forEach(t=>{
    const memberCount = TeamModule.membersOf(cid,t.id).length;
    const row=document.createElement('div'); row.className='row-item';
    row.innerHTML = `<span>${t.name} <span style="color:var(--text-dim2);">(${memberCount}명)</span></span>
      <span class="row-right">
        ${colorSwatchHTML('team', t.id, t.color)}
        <span class="x" data-tid-edit="${t.id}" style="color:var(--blue);">수정</span>
        <span class="x" data-tid-del="${t.id}">삭제</span>
      </span>`;
    row.querySelector('[data-tid-edit]').onclick=()=>{
      uiPrompt('팀 이름을 수정하세요', t.name, (name)=>{
        const v=(name||'').trim(); if(!v) return;
        TeamModule.renameTeam(cid, t.id, v);
      });
    };
    row.querySelector('[data-tid-del]').onclick=()=>{
      uiConfirm(`'${t.name}' 팀을 삭제할까요? 소속 학생은 미배정 상태가 돼요.`, ()=>TeamModule.removeTeam(cid,t.id));
    };
    teamList.appendChild(row);
  });
  $('#addTeamBtn').onclick=()=>{
    const v = $('#newTeamName').value.trim();
    if(!v) return;
    TeamModule.addTeam(cid, v);
    $('#newTeamName').value='';
  };
  $('#applyTeamColorsBtn').onclick=()=>{
    persistAndRender();
    closeModal('#modalSettings');
  };

  const assignList = $('#assignList');
  const students = DB.students[cid]||[];
  if(students.length===0){
    assignList.innerHTML = '<div class="hint">등록된 학생이 없어요.</div>';
  }
  students.forEach(s=>{
    const row=document.createElement('div'); row.className='row-item';
    const curTeam = TeamModule.teamOf(cid, s.id);
    const curName = teams.find(t=>t.id===curTeam)?.name || '미배정';
    const nameSpan=document.createElement('span');
    nameSpan.textContent=s.name;
    const dd=document.createElement('div'); dd.className='mini-dropdown';
    dd.innerHTML = `<button type="button" class="mini-dropdown-btn">${curName} ▾</button>
      <div class="mini-dropdown-menu">
        <button type="button" data-tid="" class="${!curTeam?'active':''}">미배정</button>
        ${teams.map(t=>`<button type="button" data-tid="${t.id}" class="${t.id===curTeam?'active':''}">${t.name}</button>`).join('')}
      </div>`;
    const menu = dd.querySelector('.mini-dropdown-menu');
    dd.querySelector('.mini-dropdown-btn').onclick=(e)=>{
      e.stopPropagation();
      $$('.mini-dropdown-menu.open').forEach(m=>{ if(m!==menu) m.classList.remove('open'); });
      menu.classList.toggle('open');
    };
    menu.addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      TeamModule.assignStudent(cid, s.id, b.dataset.tid||null);
    });
    row.appendChild(nameSpan);
    row.appendChild(dd);
    assignList.appendChild(row);
  });
}
document.addEventListener('click', (e)=>{
  $$('.mini-dropdown-menu.open').forEach(m=>m.classList.remove('open'));
  const swatchBtn = e.target.closest('.color-swatch-btn');
  if(swatchBtn){
    const pop = swatchBtn.parentElement.querySelector('.color-popover');
    $$('.color-popover.open').forEach(p=>{ if(p!==pop) p.classList.remove('open'); });
    pop.classList.toggle('open');
    return;
  }
  const resetBtn = e.target.closest('.color-reset-btn');
  if(resetBtn){
    const [type, id] = resetBtn.dataset.pickFor.split(':');
    const cid = DB.activeClassId;
    if(cid){
      if(type==='student') RosterModule.setColor(cid, id, null);
      else if(type==='team') TeamModule.setColor(cid, id, null);
    }
    return;
  }
  const confirmBtn = e.target.closest('.color-confirm-btn');
  if(confirmBtn){
    const pop = confirmBtn.closest('.color-popover');
    if(pop) pop.classList.remove('open');
    return;
  }
  if(!e.target.closest('.color-popover')) $$('.color-popover.open').forEach(p=>p.classList.remove('open'));
});

/* ---- color picker drag: 사각형(채도·명도)과 아래 바(색상) 둘 다 드래그/탭으로 조작 ---- */
let colorDrag = null;
function updateColorFromPointer(e){
  if(!colorDrag) return;
  const { pop, mode, square, track } = colorDrag;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  let h = Number(pop.dataset.h), s = Number(pop.dataset.s), v = Number(pop.dataset.v);
  if(mode==='sv'){
    const rect = square.getBoundingClientRect();
    s = clamp((clientX-rect.left)/rect.width, 0, 1)*100;
    v = 100 - clamp((clientY-rect.top)/rect.height, 0, 1)*100;
  } else {
    const rect = track.getBoundingClientRect();
    h = clamp((clientX-rect.left)/rect.width, 0, 1)*360;
  }
  pop.dataset.h=h; pop.dataset.s=s; pop.dataset.v=v;
  const hex = hsvToHex(h,s,v);
  square.style.background = `linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff,hsl(${h},100%,50%))`;
  square.querySelector('.sv-handle').style.left = s+'%';
  square.querySelector('.sv-handle').style.top = (100-v)+'%';
  track.querySelector('.hue-handle').style.left = (h/360*100)+'%';
  pop.querySelector('.hue-preview').style.background = hex;
  const swatchBtn = pop.closest('.color-swatch-wrap').querySelector('.color-swatch-btn');
  if(swatchBtn) swatchBtn.style.background = hex;
}
document.addEventListener('pointerdown', (e)=>{
  const square = e.target.closest('.sv-square');
  const track = e.target.closest('.hue-track');
  if(!square && !track) return;
  e.preventDefault();
  const pop = (square||track).closest('.color-popover');
  colorDrag = { pop, mode: square?'sv':'hue', square: pop.querySelector('.sv-square'), track: pop.querySelector('.hue-track') };
  updateColorFromPointer(e);
  window.addEventListener('pointermove', updateColorFromPointer);
  window.addEventListener('pointerup', endColorDrag);
});
function endColorDrag(e){
  if(colorDrag){
    updateColorFromPointer(e);
    const { pop } = colorDrag;
    const target = pop.dataset.colorFor;
    const [type, id] = target.split(':');
    const hex = hsvToHex(Number(pop.dataset.h), Number(pop.dataset.s), Number(pop.dataset.v));
    const cid = DB.activeClassId;
    if(cid){
      if(type==='student') RosterModule.setColor(cid, id, hex);
      else if(type==='team') TeamModule.setColor(cid, id, hex);
    }
    // setColor가 목록 전체를 다시 그리면서 팝업도 새로 만들어지는데(닫힌 상태로),
    // 방금 만지던 항목의 팝업을 찾아서 다시 열어둔다 — 계속 조정할 수 있게.
    const newPop = document.querySelector(`.color-popover[data-color-for="${target}"]`);
    if(newPop) newPop.classList.add('open');
  }
  colorDrag = null;
  window.removeEventListener('pointermove', updateColorFromPointer);
  window.removeEventListener('pointerup', endColorDrag);
}

/* ---- history modal ---- */
function renderHistoryModal(){
  const cid = DB.activeClassId;
  const list = $('#histList'); list.innerHTML='';
  if(!cid){ list.innerHTML='<div class="hint">반을 먼저 선택하세요</div>'; return; }
  const hist = currentHistory(cid).slice().sort((a,b)=>b.ts-a.ts);
  const students = DB.students[cid]||[];
  const teams = DB.teams[cid]||[];
  if(hist.length===0){ list.innerHTML='<div class="hint">아직 채점 이력이 없어요</div>'; return; }
  hist.forEach(h=>{
    const isTeam = h.targetType==='team';
    const target = isTeam ? teams.find(x=>x.id===h.targetId) : students.find(x=>x.id===h.targetId);
    const label = target ? (isTeam?`👥 ${target.name}`:target.name) : (isTeam?'(삭제된 팀)':'(삭제된 학생)');
    const row=document.createElement('div'); row.className='row-item';
    row.innerHTML = `<span>${label} · <span class="num" style="color:${h.delta>=0?'var(--gain)':'var(--loss)'}">${h.delta>0?'+':''}${h.delta}</span> <span style="color:var(--text-dim2);font-size:11px;">${h.note||''}</span></span>
      <span><span class="x" data-edit="${h.id}" style="color:var(--blue);margin-right:8px;">수정</span><span class="x" data-del="${h.id}">취소</span></span>`;
    row.querySelector('[data-del]').onclick=()=>{
      uiConfirm(`${label}의 ${h.delta>0?'+':''}${h.delta}점 기록을 취소할까요?`, ()=>{
        ScoreEngine.removeHistoryEntry(cid,h.id); renderHistoryModal();
      });
    };
    row.querySelector('[data-edit]').onclick=()=>{
      uiPrompt('새 증감값을 입력하세요 (음수 가능)', h.delta, (nv)=>{
        const num = Number(nv);
        if(Number.isNaN(num)){ uiAlert('숫자를 입력해주세요'); return; }
        ScoreEngine.editHistoryEntry(cid,h.id,num);
        renderHistoryModal();
      });
    };
    list.appendChild(row);
  });
}

/* ---- quiz modal ---- */
let qBuilderMode=null, qBuilderQuiz=null;
$$('.tab-mini [data-qmode]').forEach(b=>b.addEventListener('click', ()=>{
  $$('.tab-mini [data-qmode]').forEach(x=>x.classList.toggle('active', x===b));
  qBuilderMode = b.dataset.qmode;
  const hints = { A:'문제 등록 없이 점수 스테퍼로 바로 정답/오답 채점해요.',
                  B:'문제와 정답, 배점을 미리 등록하고 순서대로 진행해요.',
                  C:'정답 없이 문제 텍스트만 등록하고, 채점은 선생님이 직접 판단해요.' };
  $('#qmodeHint').textContent = hints[qBuilderMode];
  const showBuilder = qBuilderMode!=='A';
  $('#qBuilder').style.display = showBuilder?'block':'none';
  $('#qAnswerField').style.display = qBuilderMode==='B' ? 'flex' : 'none';
  $('#qModeAStart').style.display = qBuilderMode==='A' ? 'block' : 'none';
  if(showBuilder){
    const cid = DB.activeClassId;
    if(cid) qBuilderQuiz = QuizModule.create(cid, qBuilderMode, qBuilderMode==='B'?'사전등록 퀴즈':'문제 리스트');
    renderQList();
  }
}));
$('#btnQuiz').onclick=()=>{ openModal('#modalQuiz'); $$('.tab-mini [data-qmode]')[0].click(); };
$('#qModeAStart').onclick=()=>{
  const cid = DB.activeClassId; if(!cid) return;
  QuizModule.startLive(cid, null);
  closeModal('#modalQuiz');
};
$('#addQBtn').onclick=()=>{
  if(!qBuilderQuiz) return;
  const text = $('#qText').value.trim();
  if(!text) return;
  const answer = $('#qAnswer').value.trim();
  const points = Number($('#qPoints').value)||10;
  QuizModule.addQuestion(qBuilderQuiz, text, answer, points);
  $('#qText').value=''; $('#qAnswer').value='';
  renderQList();
};
function renderQList(){
  const list = $('#qList'); list.innerHTML='';
  if(!qBuilderQuiz) return;
  qBuilderQuiz.questions.forEach((q,i)=>{
    const row=document.createElement('div'); row.className='row-item';
    row.innerHTML = `<span>${i+1}. ${q.text} ${qBuilderQuiz.mode==='B'?`(정답:${q.answer} / ${q.points}점)`:''}</span><span class="x" data-qid="${q.id}">삭제</span>`;
    row.querySelector('.x').onclick=()=>{ qBuilderQuiz.questions = qBuilderQuiz.questions.filter(x=>x.id!==q.id); renderQList(); };
    list.appendChild(row);
  });
}
$('#startQuizBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid || !qBuilderQuiz) return;
  if(qBuilderQuiz.questions.length===0){ uiAlert('문제를 먼저 추가해주세요'); return; }
  QuizModule.startLive(cid, qBuilderQuiz.id);
  persistAndRender();
  closeModal('#modalQuiz');
};
$('#stopQuizBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid) return;
  QuizModule.startLive(cid, null);
  closeModal('#modalQuiz');
};

/* ---- gift setup ---- */
function renderGiftSetupInputs(){
  const cid = DB.activeClassId;
  const wrap = $('#giftInputs');
  const tabsWrap = $('#giftSetTabs');
  const actionsWrap = $('#giftSetActions');
  if(!wrap) return;
  if(!cid){
    wrap.innerHTML='';
    if(tabsWrap) tabsWrap.innerHTML='';
    if(actionsWrap) actionsWrap.innerHTML='';
    return;
  }
  ensureClassData(cid);
  const sets = DB.giftSets[cid]||[];
  const active = activeGiftSet(cid);

  tabsWrap.innerHTML='';
  sets.forEach(s=>{
    const b=document.createElement('button');
    b.className = s.id===DB.activeGiftSetId[cid] ? 'active' : '';
    b.textContent = s.name;
    b.onclick=()=>GiftSetModule.setActive(cid, s.id);
    tabsWrap.appendChild(b);
  });

  actionsWrap.innerHTML='';
  if(active){
    const nameInput = document.createElement('input');
    nameInput.value = active.name;
    nameInput.style.cssText='flex:1;background:var(--bg-2);border:1px solid var(--panel-border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;';
    nameInput.addEventListener('change', ()=>GiftSetModule.rename(cid, active.id, nameInput.value.trim()));
    const delBtn = document.createElement('span');
    delBtn.className='x';
    delBtn.textContent='삭제';
    delBtn.onclick=()=>{ uiConfirm(`'${active.name}' 세트를 삭제할까요?`, ()=>GiftSetModule.remove(cid, active.id)); };
    actionsWrap.appendChild(nameInput);
    actionsWrap.appendChild(delBtn);
  }

  wrap.innerHTML='';
  if(!active) return;
  const n = Math.max((DB.students[cid]||[]).length, (DB.teams[cid]||[]).length, 1);
  for(let r=1;r<=n;r++){
    const field=document.createElement('div'); field.className='field';
    field.innerHTML = `<span style="width:40px;line-height:36px;">${r}등</span><input data-rank="${r}" placeholder="선물 이름" value="${active.gifts?.[r]||''}">`;
    wrap.appendChild(field);
  }
}
$('#addGiftSetBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  const v = $('#newGiftSetName').value.trim();
  if(!v) return;
  GiftSetModule.add(cid, v);
  $('#newGiftSetName').value='';
};
$('#saveGiftsBtn').onclick=()=>{
  const cid = DB.activeClassId; if(!cid){ uiAlert('먼저 반을 선택하세요'); return; }
  const active = activeGiftSet(cid);
  if(!active) return;
  const inputs = $$('#giftInputs input');
  const g = {};
  inputs.forEach(i=>{ if(i.value.trim()) g[i.dataset.rank]=i.value.trim(); });
  active.gifts = g;
  persistAndRender();
  const savedHint = $('#giftSavedHint');
  savedHint.style.display='block';
  clearTimeout(savedHint._t);
  savedHint._t = setTimeout(()=>{ savedHint.style.display='none'; }, 1500);
};

/* ---- server db tab (Vercel KV) ---- */
function renderServerTab(){
  $('#serverKey').value = ServerSync.key;
  updateServerStatus();
}
function updateServerStatus(){
  const el = $('#serverStatusText');
  if(!el) return;
  if(ServerSync.connected){
    el.textContent = '🗄 연결됨 (자동 동기화 중)';
    el.style.color = 'var(--gain)';
  } else {
    el.textContent = '연결 안됨';
    el.style.color = 'var(--text-dim2)';
  }
}
$('#serverConnectBtn').onclick=async()=>{
  const key = $('#serverKey').value;
  const btn = $('#serverConnectBtn');
  btn.disabled = true; btn.textContent = '연결 중...';
  const ok = await ServerSync.connect(key);
  btn.disabled = false; btn.textContent = '🗄 서버 DB 연결하기';
  updateServerStatus();
  if(ok) uiAlert('서버 DB에 연결됐어요. 다른 기기에서도 같은 동기화 키를 입력하면 같은 데이터를 보게 돼요.');
};
$('#serverDisconnectBtn').onclick=()=>{
  uiConfirm('서버 DB 연결을 해제할까요? 이 기기는 다시 로컬 저장만 사용하게 돼요.', ()=>{
    ServerSync.disconnect();
    updateServerStatus();
  });
};

/* ---- cloud sync tab ---- */
function renderCloudTab(){
  $('#cloudUrl').value = CloudSync.url;
  $('#cloudKey').value = CloudSync.key;
  updateCloudStatus();
  renderServerTab();
}
function updateCloudStatus(){
  const el = $('#cloudStatusText');
  if(!el) return;
  if(CloudSync.connected){
    el.textContent = '☁ 연결됨 (실시간 동기화 중)';
    el.style.color = 'var(--gain)';
  } else {
    el.textContent = '연결 안됨';
    el.style.color = 'var(--text-dim2)';
  }
}
$('#cloudConnectBtn').onclick=async()=>{
  const url = $('#cloudUrl').value;
  const key = $('#cloudKey').value;
  const btn = $('#cloudConnectBtn');
  btn.disabled = true; btn.textContent = '연결 중...';
  const ok = await CloudSync.connect(url, key);
  btn.disabled = false; btn.textContent = '☁ 연결하기';
  updateCloudStatus();
  if(ok) uiAlert('클라우드에 연결됐어요. 다른 기기에서도 같은 URL과 키를 입력하면 실시간으로 같은 데이터를 보게 돼요.');
};
$('#cloudDisconnectBtn').onclick=()=>{
  uiConfirm('클라우드 연결을 해제할까요? 이 기기는 다시 로컬 저장만 사용하게 돼요.', ()=>{
    CloudSync.disconnect();
    updateCloudStatus();
  });
};

window.addEventListener('resize', ()=>{ if(DB.activeClassId) GraphRenderer.render(DB.activeClassId); });

$('#exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `포인트아레나_백업_${formatDateYMD(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
$('#importTrigger').addEventListener('click', ()=>$('#importFileInput').click());
$('#importFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  e.target.value=''; // 같은 파일을 다시 선택해도 change가 발생하도록
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    let parsed;
    try{ parsed = JSON.parse(reader.result); }
    catch(err){ uiAlert('올바른 백업 파일이 아니에요.'); return; }
    if(!parsed || !Array.isArray(parsed.classes)){ uiAlert('올바른 백업 파일이 아니에요.'); return; }
    uiConfirm('백업 파일을 불러오면 지금 화면의 데이터를 덮어써요. 계속할까요?', ()=>{
      DB = parsed;
      DB.classes.forEach(c=>ensureClassData(c.id));
      if(!DB.activeClassId && DB.classes[0]) DB.activeClassId = DB.classes[0].id;
      persistAndRender();
      closeModal('#modalSettings');
    });
  };
  reader.readAsText(file);
});

$('#reseedBtn').addEventListener('click', ()=>{
  uiConfirm('현재 데이터를 모두 지우고 샘플 데이터로 초기화할까요?', ()=>{
    seedSampleData();
    persistAndRender();
    closeModal('#modalSettings');
  });
});
