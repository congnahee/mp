"use strict";
/* ============================================================
   SYNC MODULE — 서버 DB와 Firebase 연결·수동 저장 UI
============================================================ */
const SyncModule = {
  time(ts){return ts?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(ts)):'';},
  updateSaveUI(){
    const saving=lastSaveReport&&lastSaveReport.status==='saving',configs=[
      {btn:$('#serverSaveNowBtn'),status:$('#serverSaveNowStatus'),connected:ServerSync.connected,idle:'서버에 연결하면 현재 상황을 직접 저장할 수 있어요.'},
      {btn:$('#cloudSaveNowBtn'),status:$('#cloudSaveNowStatus'),connected:CloudSync.connected,idle:'Firebase에 연결하면 현재 상황을 직접 저장할 수 있어요.'}
    ];
    configs.forEach(c=>{if(!c.btn||!c.status)return;c.btn.disabled=!c.connected||saving;c.btn.setAttribute('aria-busy',String(saving));c.status.className='save-now-status';if(!c.connected){c.status.textContent=c.idle;return;}if(lastSaveReport&&lastSaveReport.status!=='idle'){c.status.classList.add(lastSaveReport.status);c.status.textContent=`${lastSaveReport.message}${lastSaveReport.at?' · '+SyncModule.time(lastSaveReport.at):''}`;}else c.status.textContent='자동 저장 중 · 필요할 때 아래 버튼으로 즉시 저장할 수 있어요.';});
  },
  updateServer(){const el=$('#serverStatusText');if(!el)return;el.textContent=ServerSync.connected?'🗄 연결됨 (자동 동기화 중)':'연결 안됨';el.style.color=ServerSync.connected?'var(--gain)':'var(--text-dim2)';SyncModule.updateSaveUI();},
  updateCloud(){const el=$('#cloudStatusText');if(!el)return;el.textContent=CloudSync.connected?'☁ 연결됨 (실시간 동기화 중)':'연결 안됨';el.style.color=CloudSync.connected?'var(--gain)':'var(--text-dim2)';SyncModule.updateSaveUI();},
  renderTab(){if(document.activeElement!==$('#serverKey'))$('#serverKey').value=ServerSync.key;if(document.activeElement!==$('#cloudUrl'))$('#cloudUrl').value=CloudSync.url;if(document.activeElement!==$('#cloudKey'))$('#cloudKey').value=CloudSync.key;SyncModule.updateServer();SyncModule.updateCloud();},
  render(){SyncModule.updateSaveUI();},
  init(){
    $('#serverConnectBtn').onclick=async()=>{const btn=$('#serverConnectBtn');btn.disabled=true;btn.textContent='연결 중...';const ok=await ServerSync.connect($('#serverKey').value);btn.disabled=false;btn.textContent='🗄 서버 DB 연결하기';SyncModule.updateServer();if(ok)uiAlert('서버 DB에 연결됐어요. 다른 기기에서도 같은 동기화 키를 입력하면 같은 데이터를 보게 돼요.');};
    $('#serverDisconnectBtn').onclick=()=>uiConfirm('서버 DB 연결을 해제할까요? 이 기기는 다시 로컬 저장만 사용하게 돼요.',()=>{ServerSync.disconnect();SyncModule.updateServer();});
    $('#serverSaveNowBtn').onclick=async()=>{const btn=$('#serverSaveNowBtn');btn.disabled=true;btn.textContent='저장 중...';await saveCurrentStateNow('server');btn.textContent='💾 지금 상황을 서버에 저장';SyncModule.updateSaveUI();};
    $('#cloudConnectBtn').onclick=async()=>{const btn=$('#cloudConnectBtn');btn.disabled=true;btn.textContent='연결 중...';const ok=await CloudSync.connect($('#cloudUrl').value,$('#cloudKey').value);btn.disabled=false;btn.textContent='☁ 연결하기';SyncModule.updateCloud();if(ok)uiAlert('클라우드에 연결됐어요. 다른 기기에서도 같은 URL과 키를 입력하면 실시간으로 같은 데이터를 보게 돼요.');};
    $('#cloudDisconnectBtn').onclick=()=>uiConfirm('클라우드 연결을 해제할까요? 이 기기는 다시 로컬 저장만 사용하게 돼요.',()=>{CloudSync.disconnect();SyncModule.updateCloud();});
    $('#cloudSaveNowBtn').onclick=async()=>{const btn=$('#cloudSaveNowBtn');btn.disabled=true;btn.textContent='저장 중...';await saveCurrentStateNow('cloud');btn.textContent='💾 지금 상황을 Firebase에 저장';SyncModule.updateSaveUI();};
  }
};

function updateSaveNowUI(){SyncModule.updateSaveUI();}
function updateServerStatus(){SyncModule.updateServer();}
function updateCloudStatus(){SyncModule.updateCloud();}
function renderCloudTab(){SyncModule.renderTab();}
function renderServerTab(){SyncModule.renderTab();}

AppFeatures.register('sync',{order:90,init:SyncModule.init,render:SyncModule.render,onSettingsTab:name=>{if(name==='cloud')SyncModule.renderTab();}});
