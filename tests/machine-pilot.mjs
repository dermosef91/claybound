// All decisions produce ordinary joystick/jump input. Look-ahead clones are
// discarded; the returned trace can be replayed from a fresh, untouched game.
const copy=g=>{const c=Object.assign(Object.create(Object.getPrototypeOf(g)),structuredClone({...g,onEvent:null}));c.onEvent=()=>{};return c;};
const dt=1/120;
const axis=(g,x)=>Math.max(-1,Math.min(1,(x-g.player.x)*7/6.7));
function jumpTo(original,id){
  const g=copy(original),controls=[];let age=0;
  for(let i=0;i<240;i++){
    const b=g.level.platforms.find(s=>s.id===id),input={moveAxis:axis(g,b.x+b.w/2),jumpPressed:i===0,jumpHeld:true};
    controls.push(input);g.tick(dt,input);age++;
    if(g.player.groundId===id)return {g,controls};
    if(g.deaths!==original.deaths||g.respawnTimer||age>20&&g.player.groundId)return null;
  }return null;
}
export function machineTransfer(original,link){
  const g=copy(original),controls=[];
  for(let f=0;f<3600;f++){
    const a=g.level.platforms.find(s=>s.id===link.from),b=g.level.platforms.find(s=>s.id===link.to),p=g.player;
    const gap=Math.max(0,b.x-p.x,p.x-b.x-b.w),dy=b.y-p.y;
    if(f%8===0&&p.groundId===a.id&&gap<5.2&&dy<2.65&&dy>-5){
      const attempt=jumpTo(g,b.id);if(attempt)return {g:attempt.g,controls:[...controls,...attempt.controls]};
    }
    let aim=a.x+a.w/2;
    if(a.kind==='ferry'){
      const dir=Math.sign(b.x+b.w/2-p.x)||1;let stop=false;
      for(const c of g.level.crushers){
        const distance=(c.x-p.x)*dir;
        if(c.held||distance<-.5||distance>4.2)continue;
        // Commit only to a clear window long enough to cross the entire head.
        for(let t=.15;t<1.75;t+=.1){const phase=(((c.cycleTime+t)/c.period+(c.phase||0)/(Math.PI*2))%1+1)%1;if(phase>.39&&phase<.94)stop=true;}
      }
      if(!stop)aim+=dir*1.1;
    }
    const input={moveAxis:axis(g,aim)};controls.push(input);g.tick(dt,input);
    if(g.player.groundId===b.id)return {g,controls};
    if(g.deaths!==original.deaths||g.respawnTimer||g.status!=='playing')return null;
    if(f>20&&p.groundId!==a.id)return null;
  }return null;
}
