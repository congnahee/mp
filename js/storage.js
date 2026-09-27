"use strict";
/* ============================================================
   STORAGE BACKEND — Claude 안에서 열면 window.storage(계정 연동,
   기기 간 동기화)를 쓰고, 파일을 다운받아 브라우저에서 직접 열어서
   window.storage가 없으면 그 기기의 localStorage로 자동 전환한다.
   (localStorage는 그 브라우저/기기에만 저장되고 다른 기기와는
   동기화되지 않는다 — Claude로 열 때와의 유일한 차이)
============================================================ */
const hasClaudeStorage = (typeof window.storage !== 'undefined') && window.storage
  && typeof window.storage.get === 'function' && typeof window.storage.set === 'function';

async function storageGet(key){
  try{
    if(hasClaudeStorage){
      const r = await window.storage.get(key,false);
      return r ? JSON.parse(r.value) : null;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* ============================================================
   CLOUD SYNC — Firebase Realtime Database REST API를 fetch로
   직접 호출한다 (SDK 없이 동작, CDN 로드 불필요). 실시간 갱신은
   Firebase가 지원하는 Server-Sent Events(EventSource)로 구독한다.
   기기마다 이 URL/키를 한 번씩 입력해두면, 이후로는 어느 기기에서
   열든 같은 데이터를 실시간으로 보게 된다.
============================================================ */
const CloudSync = {
  url:'', key:'', connected:false, es:null, applyingRemote:false,
  loadConfig(){
    try{
      const raw = localStorage.getItem('cloud-config');
      if(raw){ const c = JSON.parse(raw); this.url=c.url||''; this.key=c.key||''; }
    }catch(e){}
  },
  saveConfig(){
    try{ localStorage.setItem('cloud-config', JSON.stringify({url:this.url, key:this.key})); }catch(e){}
  },
  clearConfig(){
    try{ localStorage.removeItem('cloud-config'); }catch(e){}
  },
  path(){ return `${this.url.replace(/\/$/,'')}/arena-${encodeURIComponent(this.key)}.json`; },
  async connect(url, key){
    this.url = (url||'').trim();
    this.key = (key||'').trim();
    if(!this.url || !this.key){ uiAlert('URL과 동기화 키를 모두 입력해주세요.'); return false; }
    try{
      const res = await fetch(this.path());
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const remote = await res.json();
      if(remote && remote.classes){
        DB = remote;
        DB.classes.forEach(c=>ensureClassData(c.id));
      } else {
        await this.push(DB); // 서버가 비어있으면 지금 데이터를 올려서 시작점으로 삼는다
      }
      this.saveConfig();
      this.connected = true;
      this.listen();
      render();
      return true;
    }catch(e){
      uiAlert('클라우드 연결에 실패했어요. URL을 다시 확인해주세요.\n(' + e.message + ')');
      this.connected = false;
      return false;
    }
  },
  disconnect(){
    this.connected = false;
    if(this.es){ this.es.close(); this.es=null; }
    this.clearConfig();
  },
  async push(data){
    try{
      await fetch(this.path(), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      flashSaveStatus();
    }catch(e){ console.warn('클라우드 저장 실패', e); }
  },
  listen(){
    if(this.es){ this.es.close(); this.es=null; }
    try{
      this.es = new EventSource(this.path());
      this.es.addEventListener('put', (ev)=>{
        try{
          const payload = JSON.parse(ev.data);
          if(!payload || !payload.data || !payload.data.classes) return;
          this.applyingRemote = true;
          DB = payload.data;
          DB.classes.forEach(c=>ensureClassData(c.id));
          render();
          saveLocalCache(); // 이 기기의 로컬 캐시도 최신 상태로 맞춰둔다
          this.applyingRemote = false;
        }catch(e){}
      });
    }catch(e){ console.warn('실시간 연결 실패', e); }
  }
};

/* ============================================================
   SERVER SYNC — 이 프로젝트를 배포한 Vercel 서버 자체의 작은 DB
   (Upstash Redis)에 저장한다. 별도 외부 계정(Firebase 등) 없이,
   Vercel 대시보드 Storage에서 Upstash 하나만 연결하면 바로 쓸 수 있다.
   실시간 push는 아니고, 짧은 주기로 폴링해서 다른 기기의 변경을
   따라잡는다 (교실 인원 규모에서는 이 정도로 충분하다).
============================================================ */
const ServerSync = {
  key:'', connected:false, pollTimer:null, applyingRemote:false,
  loadConfig(){
    try{
      const raw = localStorage.getItem('server-config');
      if(raw){ const c = JSON.parse(raw); this.key=c.key||''; }
    }catch(e){}
  },
  saveConfig(){
    try{ localStorage.setItem('server-config', JSON.stringify({key:this.key})); }catch(e){}
  },
  clearConfig(){
    try{ localStorage.removeItem('server-config'); }catch(e){}
  },
  path(){ return `/api/data?key=${encodeURIComponent(this.key)}`; },
  async connect(key){
    this.key = (key||'').trim();
    if(!this.key){ uiAlert('동기화 키를 입력해주세요.'); return false; }
    try{
      const res = await fetch(this.path());
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if(json.data && json.data.classes){
        DB = json.data;
        DB.classes.forEach(c=>ensureClassData(c.id));
      } else {
        await this.push(DB); // 서버가 비어있으면 지금 데이터를 올려서 시작점으로 삼는다
      }
      this.saveConfig();
      this.connected = true;
      this.startPolling();
      render();
      return true;
    }catch(e){
      uiAlert('서버 DB 연결에 실패했어요. 배포 후 Vercel Storage에서 Upstash를 연결했는지 확인해주세요.\n(' + e.message + ')');
      this.connected = false;
      return false;
    }
  },
  disconnect(){
    this.connected = false;
    this.stopPolling();
    this.clearConfig();
  },
  async push(data){
    try{
      await fetch(this.path(), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ data })
      });
      flashSaveStatus();
    }catch(e){ console.warn('서버 DB 저장 실패', e); }
  },
  startPolling(){
    this.stopPolling();
    this.pollTimer = setInterval(async ()=>{
      if(!this.connected) return;
      try{
        const res = await fetch(this.path());
        if(!res.ok) return;
        const json = await res.json();
        if(json.data && JSON.stringify(json.data) !== JSON.stringify(DB)){
          this.applyingRemote = true;
          DB = json.data;
          DB.classes.forEach(c=>ensureClassData(c.id));
          render();
          saveLocalCache();
          this.applyingRemote = false;
        }
      }catch(e){}
    }, 6000);
  },
  stopPolling(){
    if(this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
};

let saveTimer=null, saveInFlight=false, savePending=false;
function scheduleSave(){
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}
function flashSaveStatus(){
  const el = document.getElementById('saveStatus');
  if(!el) return;
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.style.opacity='0'; }, 1300);
}
async function saveLocalCache(){
  const payload = JSON.stringify(DB);
  if(!hasClaudeStorage){
    // localStorage는 동기 API라 재시도할 일이 거의 없다
    try{ localStorage.setItem('arena-data', payload); flashSaveStatus(); }
    catch(e){ console.warn('로컬 저장 실패', e); }
    return;
  }
  let attempt = 0;
  while(attempt < 3){
    try{
      await window.storage.set('arena-data', payload, false);
      flashSaveStatus();
      break;
    }catch(e){
      attempt++;
      if(attempt >= 3){ console.warn('저장 재시도 실패 — 다음 변경 시 다시 시도합니다'); }
      else await new Promise(r=>setTimeout(r, 500*attempt));
    }
  }
}
async function flushSave(){
  if(saveInFlight) return; // 이미 진행 중이면 savePending 플래그만 남기고 끝나면 다시 시도
  saveInFlight = true;
  savePending = false;
  await saveLocalCache();
  // 원격에서 방금 받은 데이터를 그대로 되돌려 올리지 않도록 방지
  if(CloudSync.connected && !CloudSync.applyingRemote){
    CloudSync.push(DB);
  }
  if(ServerSync.connected && !ServerSync.applyingRemote){
    ServerSync.push(DB);
  }
  saveInFlight = false;
  if(savePending) scheduleSave();
}
