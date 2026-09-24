"use strict";
/* ============================================================
   INIT
============================================================ */
async function init(){
  const saved = await storageGet('arena-data');
  let seeded = false;
  if(saved && saved.classes && saved.classes.length>0){
    DB = Object.assign(DB, saved);
  } else {
    seedSampleData();
    seeded = true;
    await saveLocalCache();
  }
  DB.classes.forEach(c=>ensureClassData(c.id));
  applyTheme();
  render();

  // 이전에 클라우드 연결을 설정해뒀다면 열자마자 자동으로 다시 연결한다
  CloudSync.loadConfig();
  if(CloudSync.url && CloudSync.key){
    const ok = await CloudSync.connect(CloudSync.url, CloudSync.key);
    updateCloudStatus();
  }

  // 이전에 서버 DB 연결을 설정해뒀다면 열자마자 자동으로 다시 연결한다
  ServerSync.loadConfig();
  if(ServerSync.key){
    const ok2 = await ServerSync.connect(ServerSync.key);
    updateServerStatus();
  }
  if(seeded && !CloudSync.connected && !ServerSync.connected) scheduleSave();
}
init();
