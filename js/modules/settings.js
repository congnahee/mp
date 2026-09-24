"use strict";
/* ============================================================
   SETTINGS MODULE — 설정 창, 테마, 공통 색상 선택, 백업/복원
============================================================ */
const SettingsModule = {
  colorDrag:null,
  render(){$$('#themeSeg button').forEach(b=>b.classList.toggle('active',b.dataset.theme===(DB.theme||'dark')));},
  updateColor(e){
    const drag=SettingsModule.colorDrag;if(!drag)return;const{pop,mode,square,track}=drag,clientX=e.touches?e.touches[0].clientX:e.clientX,clientY=e.touches?e.touches[0].clientY:e.clientY;let h=Number(pop.dataset.h),s=Number(pop.dataset.s),v=Number(pop.dataset.v);
    if(mode==='sv'){const rect=square.getBoundingClientRect();s=clamp((clientX-rect.left)/rect.width,0,1)*100;v=100-clamp((clientY-rect.top)/rect.height,0,1)*100;}else{const rect=track.getBoundingClientRect();h=clamp((clientX-rect.left)/rect.width,0,1)*360;}
    pop.dataset.h=h;pop.dataset.s=s;pop.dataset.v=v;const hex=hsvToHex(h,s,v);square.style.background=`linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff,hsl(${h},100%,50%))`;square.querySelector('.sv-handle').style.left=s+'%';square.querySelector('.sv-handle').style.top=(100-v)+'%';track.querySelector('.hue-handle').style.left=(h/360*100)+'%';pop.querySelector('.hue-preview').style.background=hex;const swatch=pop.closest('.color-swatch-wrap').querySelector('.color-swatch-btn');if(swatch)swatch.style.background=hex;
  },
  endColor(e){
    const drag=SettingsModule.colorDrag;if(drag){SettingsModule.updateColor(e);const{pop}=drag,[type,id]=pop.dataset.colorFor.split(':'),hex=hsvToHex(Number(pop.dataset.h),Number(pop.dataset.s),Number(pop.dataset.v)),cid=DB.activeClassId;if(cid){if(type==='student')RosterModule.setColor(cid,id,hex);else if(type==='team')TeamModule.setColor(cid,id,hex);}const fresh=document.querySelector(`.color-popover[data-color-for="${type}:${id}"]`);if(fresh)fresh.classList.add('open');}
    SettingsModule.colorDrag=null;window.removeEventListener('pointermove',SettingsModule.updateColor);window.removeEventListener('pointerup',SettingsModule.endColor);
  },
  exportData(){const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`포인트아레나_백업_${formatDateYMD(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);},
  importData(file){const reader=new FileReader();reader.onload=()=>{let parsed;try{parsed=JSON.parse(reader.result);}catch(err){uiAlert('올바른 백업 파일이 아니에요.');return;}if(!parsed||!Array.isArray(parsed.classes)){uiAlert('올바른 백업 파일이 아니에요.');return;}uiConfirm('백업 파일을 불러오면 지금 화면의 데이터를 덮어써요. 계속할까요?',()=>{DB=parsed;DB.classes.forEach(c=>ensureClassData(c.id));if(!DB.activeClassId&&DB.classes[0])DB.activeClassId=DB.classes[0].id;persistAndRender();closeModal('#modalSettings');});};reader.readAsText(file);},
  init(){
    $('#emptyAddClass').onclick=()=>{openModal('#modalSettings');switchStab('class');};$('#btnSettings').onclick=()=>openModal('#modalSettings');
    $('#themeSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;DB.theme=b.dataset.theme;applyTheme();SettingsModule.render();scheduleSave();};
    document.addEventListener('click',e=>{
      const swatch=e.target.closest('.color-swatch-btn');if(swatch){const pop=swatch.parentElement.querySelector('.color-popover');$$('.color-popover.open').forEach(p=>{if(p!==pop)p.classList.remove('open');});pop.classList.toggle('open');return;}
      const reset=e.target.closest('.color-reset-btn');if(reset){const[type,id]=reset.dataset.pickFor.split(':'),cid=DB.activeClassId;if(cid){if(type==='student')RosterModule.setColor(cid,id,null);else if(type==='team')TeamModule.setColor(cid,id,null);}return;}
      const confirm=e.target.closest('.color-confirm-btn');if(confirm){confirm.closest('.color-popover')?.classList.remove('open');return;}if(!e.target.closest('.color-popover'))$$('.color-popover.open').forEach(p=>p.classList.remove('open'));
    });
    document.addEventListener('pointerdown',e=>{const square=e.target.closest('.sv-square'),track=e.target.closest('.hue-track');if(!square&&!track)return;e.preventDefault();const pop=(square||track).closest('.color-popover');SettingsModule.colorDrag={pop,mode:square?'sv':'hue',square:pop.querySelector('.sv-square'),track:pop.querySelector('.hue-track')};SettingsModule.updateColor(e);window.addEventListener('pointermove',SettingsModule.updateColor);window.addEventListener('pointerup',SettingsModule.endColor);});
    $('#exportBtn').onclick=SettingsModule.exportData;$('#importTrigger').onclick=()=>$('#importFileInput').click();$('#importFileInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)SettingsModule.importData(file);};
    $('#reseedBtn').onclick=()=>uiConfirm('현재 데이터를 모두 지우고 샘플 데이터로 초기화할까요?',()=>{seedSampleData();persistAndRender();closeModal('#modalSettings');});
  }
};

AppFeatures.register('settings',{order:5,init:SettingsModule.init,render:SettingsModule.render});
