"use strict";
/* 선물 설정과 1위 발표 UI도 이 모듈이 소유한다. */
const GiftUI = {
  fireworksRAF:null,particles:[],
  render(cid){
    const wrap=$('#giftInputs'),tabs=$('#giftSetTabs'),actions=$('#giftSetActions');if(!wrap)return;
    if(!cid){wrap.innerHTML='';tabs.innerHTML='';actions.innerHTML='';return;}ensureClassData(cid);
    const sets=DB.giftSets[cid]||[],active=activeGiftSet(cid);tabs.innerHTML='';
    sets.forEach(s=>{const b=document.createElement('button');b.className=s.id===DB.activeGiftSetId[cid]?'active':'';b.textContent=s.name;b.onclick=()=>GiftSetModule.setActive(cid,s.id);tabs.appendChild(b);});
    actions.innerHTML='';
    if(active){const input=document.createElement('input');input.value=active.name;input.style.cssText='flex:1;background:var(--bg-2);border:1px solid var(--panel-border);color:var(--text);border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;';input.onchange=()=>GiftSetModule.rename(cid,active.id,input.value.trim());const del=document.createElement('span');del.className='x';del.textContent='삭제';del.onclick=()=>uiConfirm(`'${active.name}' 세트를 삭제할까요?`,()=>GiftSetModule.remove(cid,active.id));actions.append(input,del);}
    wrap.innerHTML='';if(!active)return;const n=Math.max((DB.students[cid]||[]).length,(DB.teams[cid]||[]).length,1);
    for(let rank=1;rank<=n;rank++){const field=document.createElement('div');field.className='field';field.innerHTML=`<span style="width:40px;line-height:36px;">${rank}등</span><input data-rank="${rank}" placeholder="선물 이름" value="${active.gifts?.[rank]||''}">`;wrap.appendChild(field);}
  },
  reveal(){
    const cid=DB.activeClassId;if(!cid)return;const ranked=RankingModule.current(cid);if(!ranked.length){uiAlert('발표할 순위가 없어요.');return;}const winner=ranked[0],p=activePeriod(cid),set=activeGiftSet(cid);
    const targetType=(DB.teamsEnabled[cid]&&DB.viewMode[cid]==='team')?'team':'student',gift=set?.gifts?.[1]||'';
    StudentActivity.studentIdsForTarget(cid,targetType,winner.id).forEach(studentId=>StudentActivity.upsert(cid,studentId,`winner:${p?.id||'none'}:${winner.id}`,'winner',{targetType,targetId:winner.id,periodId:p?.id||null,periodLabel:p?.label||'',score:winner.score,giftSetId:set?.id||null,giftSetName:set?.name||'',gift}));scheduleSave();
    $('#winnerPeriodLabel').textContent=p?p.label:'';$('#winnerName').textContent=winner.name.replace('👥 ','');$('#winnerPoints').textContent=winner.score+' POINTS';$('#winnerGift').textContent=set&&set.gifts&&set.gifts[1]?'🎁 '+set.gifts[1]:'';$('#winnerOverlay').classList.add('open');GiftUI.startFireworks();
  },
  closeReveal(){$('#winnerOverlay').classList.remove('open');GiftUI.stopFireworks();},
  startFireworks(){
    const canvas=$('#fireworksCanvas'),ctx=canvas.getContext('2d');canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;GiftUI.particles=[];const colors=['#FFC24B','#00E0A4','#5B8CFF','#FF6EC7','#FFFFFF'];
    const burst=()=>{const x=Math.random()*canvas.width,y=canvas.height*.25+Math.random()*canvas.height*.3;for(let i=0;i<42;i++){const angle=Math.random()*Math.PI*2,speed=2+Math.random()*4.2;GiftUI.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:55+Math.random()*20,color:colors[Math.floor(Math.random()*colors.length)]});}};
    let frame=0;const loop=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);if(frame%38===0)burst();GiftUI.particles.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=.05;pt.life--;ctx.globalAlpha=Math.max(pt.life/75,0);ctx.fillStyle=pt.color;ctx.beginPath();ctx.arc(pt.x,pt.y,2.6,0,Math.PI*2);ctx.fill();});GiftUI.particles=GiftUI.particles.filter(pt=>pt.life>0);ctx.globalAlpha=1;frame++;GiftUI.fireworksRAF=requestAnimationFrame(loop);};burst();loop();
  },
  stopFireworks(){if(GiftUI.fireworksRAF)cancelAnimationFrame(GiftUI.fireworksRAF);GiftUI.fireworksRAF=null;GiftUI.particles=[];}
};

"use strict";
GiftUI.init=function(){
  $('#gift-fab').onclick=()=>{const cid=DB.activeClassId;if(cid){DB.graphType[cid]='ladder';persistAndRender();}};
  $('#winner-fab').onclick=GiftUI.reveal;$('#winnerCloseBtn').onclick=GiftUI.closeReveal;
  $('#addGiftSetBtn').onclick=()=>{const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}const input=$('#newGiftSetName'),v=input.value.trim();if(v){GiftSetModule.add(cid,v);input.value='';}};
  $('#saveGiftsBtn').onclick=()=>{const cid=DB.activeClassId;if(!cid){uiAlert('먼저 반을 선택하세요');return;}const active=activeGiftSet(cid);if(!active)return;const gifts={};$$('#giftInputs input').forEach(i=>{if(i.value.trim())gifts[i.dataset.rank]=i.value.trim();});active.gifts=gifts;persistAndRender();const hint=$('#giftSavedHint');hint.style.display='block';clearTimeout(hint._t);hint._t=setTimeout(()=>hint.style.display='none',1500);};
};

"use strict";
AppFeatures.register('gifts',{order:70,init:GiftUI.init,render:GiftUI.render,onSettingsTab:name=>{if(name==='gift')GiftUI.render(DB.activeClassId);}});

