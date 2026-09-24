"use strict";
/* ============================================================
   UI CORE
   기능 코드는 js/modules 안에서 AppFeatures.register()로 연결한다.
   이 파일은 공통 렌더 주기, 모달, 대화상자, 날짜 선택만 담당한다.
============================================================ */
const AppFeatures = {
  items: [],
  register(name, feature){
    if(!name || !feature || AppFeatures.items.some(x=>x.name===name)) return;
    AppFeatures.items.push({name, order:feature.order||100, ...feature});
    AppFeatures.items.sort((a,b)=>a.order-b.order);
    if(typeof feature.init==='function') feature.init();
  },
  render(cid){
    AppFeatures.items.forEach(feature=>{
      if(typeof feature.render==='function') feature.render(cid);
    });
  },
  activateSettings(name){
    AppFeatures.items.forEach(feature=>{
      if(typeof feature.onSettingsTab==='function') feature.onSettingsTab(name);
    });
  }
};

function persistAndRender(){ scheduleSave(); render(); }

function render(){
  const cid=DB.activeClassId;
  if(cid) ensureClassData(cid);
  const empty=!cid || (DB.students[cid]||[]).length===0;
  $('#emptyState').style.display=empty?'flex':'none';
  if(!cid) $('#graphArea').innerHTML='';
  AppFeatures.render(cid);
}

function openModal(sel){ const el=$(sel); if(el) el.classList.add('open'); }
function closeModal(sel){ const el=$(sel); if(el) el.classList.remove('open'); }

function switchStab(name){
  $$('.tab-mini [data-stab]').forEach(b=>b.classList.toggle('active',b.dataset.stab===name));
  $$('[id^="stab-"]').forEach(panel=>{ panel.style.display=panel.id===`stab-${name}`?'block':'none'; });
  AppFeatures.activateSettings(name);
}

$$('.tab-mini [data-stab]').forEach(b=>b.addEventListener('click',()=>switchStab(b.dataset.stab)));
$$('.modal-back').forEach(m=>{
  m.addEventListener('click',e=>{
    if(e.target!==m) return;
    m.classList.remove('open');
    if(m.id==='modalDialog' && dialogResolve){
      const showInput=$('#dialogInputField').style.display!=='none';
      const showCancel=$('#dialogCancelBtn').style.display!=='none';
      dialogResolve(showCancel?(showInput?null:false):(showInput?$('#dialogInput').value:true));
      dialogResolve=null;
    }
  });
});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('.modal-back').classList.remove('open')));

$('#dialogOkBtn').onclick=()=>{
  const showInput=$('#dialogInputField').style.display!=='none';
  uiDialogClose(showInput?$('#dialogInput').value:true);
};
$('#dialogCancelBtn').onclick=()=>{
  const showInput=$('#dialogInputField').style.display!=='none';
  uiDialogClose(showInput?null:false);
};
$('#dialogInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#dialogOkBtn').click(); });

$('#dpPrev').onclick=()=>{ DatePicker.month--; if(DatePicker.month<0){DatePicker.month=11;DatePicker.year--;} DatePicker.renderGrid(); };
$('#dpNext').onclick=()=>{ DatePicker.month++; if(DatePicker.month>11){DatePicker.month=0;DatePicker.year++;} DatePicker.renderGrid(); };
$('#dpTodayBtn').onclick=()=>{ const t=new Date();DatePicker.year=t.getFullYear();DatePicker.month=t.getMonth();DatePicker.renderGrid(); };
$('#dpClearBtn').onclick=()=>{ if(DatePicker.onPick) DatePicker.onPick('');closeModal('#modalDatePicker'); };
$('#dpGrid').addEventListener('click',e=>{
  const cell=e.target.closest('.dp-day');if(!cell)return;
  if(DatePicker.onPick) DatePicker.onPick(cell.dataset.date);
  closeModal('#modalDatePicker');
});
document.addEventListener('click',e=>{
  const btn=e.target.closest('.date-field');if(!btn)return;
  const targetId=btn.dataset.for;
  const hidden=document.getElementById(targetId);if(!hidden)return;
  DatePicker.open(hidden.value,val=>{
    hidden.value=val;
    const label=document.getElementById(targetId+'_label');
    if(label){label.textContent=formatDateDisplay(val);label.classList.toggle('ph',!val);}
    document.dispatchEvent(new CustomEvent('app:date-picked',{detail:{targetId,value:val}}));
  });
});

if(document.fullscreenEnabled){
  const fsBtn=$('#btnFullscreen');
  fsBtn.style.display='flex';
  fsBtn.onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
  document.addEventListener('fullscreenchange',()=>{
    fsBtn.classList.toggle('on',!!document.fullscreenElement);
    fsBtn.title=document.fullscreenElement?'전체화면 나가기':'전체화면';
  });
}
