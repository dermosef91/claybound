// All decisions produce ordinary joystick/jump input. Look-ahead clones are
// discarded; the returned trace can be replayed from a fresh, untouched game.
import {PRESS} from '../dist/presses.js';
import {RULES} from '../dist/simulation.js';
const copy=g=>{const c=Object.assign(Object.create(Object.getPrototypeOf(g)),structuredClone({...g,onEvent:null}));c.onEvent=()=>{};return c;};
const dt=1/120;
const clamp01=n=>Math.max(0,Math.min(1,n));
// Where a press head will be, t seconds from now, by the same curve the
// simulation drives it with. Guessing at this is how a ferry pilot ends up
// parked under a head: the danger window is a fifth of the cycle, not half.
function headAt(c,t){
  const phase=(((c.cycleTime+t)/(c.period||5)+(c.phase||0)/(Math.PI*2))%1+1)%1;
  let travel=0;
  if(phase<PRESS.slamStart)travel=0;
  else if(phase<PRESS.impactStart)travel=clamp01((phase-PRESS.slamStart)/(PRESS.impactStart-PRESS.slamStart))**2;
  else if(phase<PRESS.retractStart)travel=1;
  else{const u=(phase-PRESS.retractStart)/(1-PRESS.retractStart);travel=1-u*u*(3-2*u);}
  return c.baseY-(c.baseY-c.bottomY)*travel;
}
// The head is lethal to a rider once its underside drops below their head.
const crushes=(c,t,y)=>headAt(c,t)-PRESS.halfHeight<y+RULES.height;
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
      const dir=Math.sign(b.x+b.w/2-p.x)||1,speed=a.speed||3.2;let stop=false;
      for(const c of g.level.crushers){
        if(c.held)continue;
        // The band a head can reach, widened for the rider's own width and for
        // the drift a ferry carries while it brakes.
        const half=c.w/2+RULES.radius*.82+.3;
        const enter=(c.x-half-p.x)*dir,leave=(c.x+half-p.x)*dir;
        // Behind us, too far ahead to plan for, or already overhead — in the
        // last case the only wrong move is to stop and sit under it.
        if(leave<0||enter>12||enter<0)continue;
        // Commit only to a window clear for the whole passage: reaching the
        // head, crossing it, and the braking slack at either end.
        for(let t=Math.max(0,enter/speed-.3);t<=leave/speed+.6;t+=.04)if(crushes(c,t,p.y))stop=true;
      }
      if(!stop)aim+=dir*1.1;
    }
    const input={moveAxis:axis(g,aim)};controls.push(input);g.tick(dt,input);
    if(g.player.groundId===b.id)return {g,controls};
    if(g.deaths!==original.deaths||g.respawnTimer||g.status!=='playing')return null;
    if(f>20&&p.groundId!==a.id)return null;
  }return null;
}
