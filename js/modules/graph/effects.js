"use strict";
Object.assign(GraphRenderer,{
  burst(studentId, positive){
    const el = document.querySelector(`[data-sid="${studentId}"]`);
    if(!el) return;
    el.classList.remove('shake'); void el.offsetWidth;
    if(!positive) el.classList.add('shake');
    if(positive){
      for(let i=0;i<10;i++){
        const s=document.createElement('div');
        s.className='spark';
        const size=4+Math.random()*5;
        s.style.width=s.style.height=size+'px';
        s.style.background = i%2? 'var(--gain)':'var(--gold)';
        s.style.left='50%'; s.style.top='30%';
        const ang = Math.random()*Math.PI*2, dist=30+Math.random()*50;
        s.style.transition='all .7s ease-out';
        el.appendChild(s);
        requestAnimationFrame(()=>{
          s.style.transform=`translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
          s.style.opacity='0';
        });
        setTimeout(()=>s.remove(),750);
      }
    }
  }
});
