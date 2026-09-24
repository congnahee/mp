"use strict";
/* ============================================================
   ROSTER MODULE — 반·학생 데이터, 화면, 설정 이벤트
============================================================ */
const RosterModule = {
  selectedStudentIds:new Set(),
  addClass(name){
    const c={id:uid(),name};DB.classes.push(c);ensureClassData(c.id);
    if(!DB.activeClassId) DB.activeClassId=c.id;
    persistAndRender();
  },
  removeClass(cid){
    DB.classes=DB.classes.filter(c=>c.id!==cid);
    if(DB.activeClassId===cid) DB.activeClassId=DB.classes[0]?.id||null;
    persistAndRender();
  },
  renameClass(cid,name){const c=DB.classes.find(x=>x.id===cid);if(!c||!name)return;c.name=name;persistAndRender();},
  setActive(cid){DB.activeClassId=cid;RosterModule.selectedStudentIds.clear();persistAndRender();},
  addStudent(cid,name){ensureClassData(cid);DB.students[cid].push({id:uid(),name});persistAndRender();},
  removeStudent(cid,sid){
    DB.students[cid]=DB.students[cid].filter(s=>s.id!==sid);
    if(DB.studentTeam[cid]) delete DB.studentTeam[cid][sid];
    RosterModule.selectedStudentIds.delete(sid);persistAndRender();
  },
  renameStudent(cid,sid,name){const s=(DB.students[cid]||[]).find(x=>x.id===sid);if(!s||!name)return;s.name=name;persistAndRender();},
  setColor(cid,sid,color){const s=(DB.students[cid]||[]).find(x=>x.id===sid);if(!s)return;if(color)s.color=color;else delete s.color;persistAndRender();},

  render(cid){
    RosterModule.renderClassTabs();
    RosterModule.renderClassInfo(cid);
    RosterModule.renderSettings(cid);
  },
  renderClassInfo(cid){
    const chip=$('#classInfoChip');if(!chip)return;
    if(!cid){chip.style.display='none';return;}
    let html=`인원 <b>${(DB.students[cid]||[]).length}</b>명`;
    if(DB.teamsEnabled[cid]) html+=` · 팀 <b>${(DB.teams[cid]||[]).length}</b>개`;
    chip.innerHTML=html;chip.style.display='flex';
  },
  renderClassTabs(){
    const wrap=$('#classTabs');wrap.innerHTML='';
    DB.classes.forEach(c=>{
      const b=document.createElement('div');b.className='class-tab'+(c.id===DB.activeClassId?' active':'');
      b.textContent=c.name;b.onclick=()=>RosterModule.setActive(c.id);wrap.appendChild(b);
    });
    const add=document.createElement('div');add.className='class-tab add';add.textContent='+ 반';
    add.onclick=()=>{openModal('#modalSettings');switchStab('class');};wrap.appendChild(add);
  },
  renderSettings(cid){
    const classList=$('#classList');classList.innerHTML='';
    DB.classes.forEach(c=>{
      const row=document.createElement('div');row.className='row-item';
      row.innerHTML=`<span>${c.name} ${c.id===cid?'(선택됨)':''}</span><span class="row-right"><span class="x" data-edit style="color:var(--blue);">수정</span><span class="x" data-del>삭제</span></span>`;
      row.querySelector('[data-edit]').onclick=()=>uiPrompt('반 이름을 수정하세요',c.name,name=>{const v=(name||'').trim();if(v)RosterModule.renameClass(c.id,v);});
      row.querySelector('[data-del]').onclick=()=>uiConfirm(`'${c.name}' 반을 삭제할까요? 모든 데이터가 사라져요.`,()=>RosterModule.removeClass(c.id));
      classList.appendChild(row);
    });
    RosterModule.renderClassChips(cid);
    const studentList=$('#studentList');studentList.innerHTML='';
    if(cid){
      const ids=new Set((DB.students[cid]||[]).map(s=>s.id));
      Array.from(RosterModule.selectedStudentIds).forEach(id=>{if(!ids.has(id))RosterModule.selectedStudentIds.delete(id);});
      (DB.students[cid]||[]).forEach(s=>{
        const row=document.createElement('div');row.className='row-item';
        row.innerHTML=`<span style="display:flex;align-items:center;"><input type="checkbox" class="row-check" data-check ${RosterModule.selectedStudentIds.has(s.id)?'checked':''}>${s.name}</span><span class="row-right">${colorSwatchHTML('student',s.id,s.color)}<span class="x" data-edit style="color:var(--blue);">수정</span><span class="x" data-del>삭제</span></span>`;
        row.querySelector('[data-check]').onchange=e=>{e.target.checked?RosterModule.selectedStudentIds.add(s.id):RosterModule.selectedStudentIds.delete(s.id);RosterModule.renderBulkBar(cid);};
        row.querySelector('[data-edit]').onclick=()=>uiPrompt('학생 이름을 수정하세요',s.name,name=>{const v=(name||'').trim();if(v)RosterModule.renameStudent(cid,s.id,v);});
        row.querySelector('[data-del]').onclick=()=>uiConfirm(`'${s.name}' 학생을 삭제할까요?`,()=>RosterModule.removeStudent(cid,s.id));
        studentList.appendChild(row);
      });
    }
    RosterModule.renderBulkBar(cid);
  },
  renderClassChips(cid){
    const wrap=$('#studentTabClassChips');if(!wrap)return;wrap.innerHTML='';
    DB.classes.forEach(c=>{const b=document.createElement('button');b.type='button';b.className=c.id===cid?'active':'';b.textContent=c.name;b.onclick=()=>RosterModule.setActive(c.id);wrap.appendChild(b);});
    if(DB.classes.length===0) wrap.innerHTML='<div class="hint">먼저 "반 관리" 탭에서 반을 추가해주세요.</div>';
  },
  renderBulkBar(cid){
    const selectAll=$('#studentSelectAll'),count=$('#studentSelectedCount'),teamDrop=$('#bulkTeamDropdown'),del=$('#bulkDeleteStudentsBtn');if(!selectAll)return;
    if(!cid){count.textContent='0명 선택';selectAll.checked=false;teamDrop.style.display='none';del.disabled=true;return;}
    const total=(DB.students[cid]||[]).length,n=RosterModule.selectedStudentIds.size;
    count.textContent=`${n}명 선택`;selectAll.checked=total>0&&n===total;del.disabled=n===0;del.style.opacity=n===0?'.4':'1';
    if(DB.teamsEnabled[cid]){
      teamDrop.style.display=n>0?'block':'none';
      $('#bulkTeamMenu').innerHTML='<button type="button" data-team-assign="">미배정</button>'+(DB.teams[cid]||[]).map(t=>`<button type="button" data-team-assign="${t.id}">${t.name}</button>`).join('');
    }else teamDrop.style.display='none';
  },
  importStudents(file,cid){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        let names=[];
        if(/\.csv$/i.test(file.name)){
          const text=typeof reader.result==='string'?reader.result:new TextDecoder('utf-8').decode(reader.result);
          names=text.split(/\r?\n/).map(line=>line.split(',')[0].trim()).filter(Boolean);
        }else{
          const wb=XLSX.read(reader.result,{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1});
          names=rows.map(r=>String(r[0]||'').trim()).filter(Boolean);
        }
        names=names.filter(n=>!/^(이름|성명|name)$/i.test(n));
        if(!names.length){uiAlert('파일에서 이름을 찾지 못했어요.');return;}
        uiConfirm(`${names.length}명을 현재 반에 추가할까요?\n(${names.slice(0,5).join(', ')}${names.length>5?' 외':''})`,()=>names.forEach(n=>RosterModule.addStudent(cid,n)));
      }catch(err){uiAlert('파일을 읽지 못했어요. CSV 또는 엑셀(.xlsx) 파일인지 확인해주세요.\n('+err.message+')');}
    };
    if(/\.csv$/i.test(file.name))reader.readAsText(file,'utf-8');else reader.readAsArrayBuffer(file);
  },
  init(){
    $('#addClassBtn').onclick=()=>{const input=$('#newClassName'),v=input.value.trim();if(v){RosterModule.addClass(v);input.value='';}};
    $('#addStudentBtn').onclick=()=>{const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}const input=$('#newStudentName'),v=input.value.trim();if(v){RosterModule.addStudent(cid,v);input.value='';}};
    $('#importStudentsTrigger').onclick=()=>{if(!DB.activeClassId){uiAlert('먼저 반을 선택하세요');return;}$('#importStudentsInput').click();};
    $('#importStudentsInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file&&DB.activeClassId)RosterModule.importStudents(file,DB.activeClassId);};
    $('#applyStudentColorsBtn').onclick=()=>{if(DB.activeClassId){persistAndRender();closeModal('#modalSettings');}};
    $('#studentSelectAll').onchange=e=>{const cid=DB.activeClassId;if(!cid)return;RosterModule.selectedStudentIds.clear();if(e.target.checked)(DB.students[cid]||[]).forEach(s=>RosterModule.selectedStudentIds.add(s.id));render();};
    $('#bulkDeleteStudentsBtn').onclick=()=>{const cid=DB.activeClassId,n=RosterModule.selectedStudentIds.size;if(!cid||!n)return;uiConfirm(`선택한 학생 ${n}명을 삭제할까요? 되돌릴 수 없어요.`,()=>{const ids=Array.from(RosterModule.selectedStudentIds);RosterModule.selectedStudentIds.clear();ids.forEach(sid=>{DB.students[cid]=DB.students[cid].filter(s=>s.id!==sid);delete DB.studentTeam[cid][sid];});persistAndRender();});};
    $('#bulkTeamMenu').onclick=e=>{const b=e.target.closest('button[data-team-assign]'),cid=DB.activeClassId;if(!b||!cid)return;Array.from(RosterModule.selectedStudentIds).forEach(sid=>DB.studentTeam[cid][sid]=b.dataset.teamAssign||null);persistAndRender();};
  }
};

AppFeatures.register('roster',{order:10,init:RosterModule.init,render:RosterModule.render});
