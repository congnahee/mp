"use strict";
const GraphFeature={
  render(cid){if(cid)GraphRenderer.render(cid);},
  init(){
    $('#graphSwitch').onclick=e=>{const b=e.target.closest('.icon-btn'),cid=DB.activeClassId;if(!b||!cid)return;DB.graphType[cid]=b.dataset.g;persistAndRender();};
    $('#present-fab').onclick=()=>{$('#app').classList.add('present-mode');if(DB.activeClassId)requestAnimationFrame(()=>GraphRenderer.render(DB.activeClassId));};
    $('#presentExitBtn').onclick=()=>{$('#app').classList.remove('present-mode');if(DB.activeClassId)requestAnimationFrame(()=>GraphRenderer.render(DB.activeClassId));};
    window.addEventListener('resize',()=>{if(DB.activeClassId)GraphRenderer.render(DB.activeClassId);});
  }
};

"use strict";
AppFeatures.register('graphs',{order:60,init:GraphFeature.init,render:GraphFeature.render});

