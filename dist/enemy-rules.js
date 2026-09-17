import {initializeSpore,moveSpore} from './spore-rules.js';
import {initializeDrifter,moveDrifter} from './drifter-rules.js';
import {initializeSpitter,moveSpitter} from './spitter-rules.js';
import {DREAM_KINDS,initializeDreamEnemy,moveDreamEnemy} from './dream-enemy-rules.js';
// Flight and collisions belong to the simulation; wing tips are decorative.
export const BAT={scale:1.18,modelOffsetY:.53,bottom:.04,top:.91,bodyRadius:.46,stompRadius:.78,bob:.55,period:4.6,
  patrolSpeed:1.25,triggerRange:4.2,retreatTime:.5,chargeTime:.65,diveSpeed:14.5,cooldown:2.2};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const centerY=(BAT.bottom+BAT.top)/2;
const smooth=t=>t*t*(3-2*t);
const hoverY=(e,time)=>e.baseY+Math.sin(time*Math.PI*2/e.period+e.phase)*e.bob;
export const batAttacking=e=>e.alive&&e.kind==='bat'&&['retreat','charge','dive'].includes(e.aiState);

// Older editor backups used equal endpoints for hovering bats. Give those
// bats a useful flight lane without rewriting the saved level or its version.
export function batPatrolBounds(e,platforms=[]){
  if(Number.isFinite(e.min)&&Number.isFinite(e.max)&&e.max-e.min>.1)return {min:e.min,max:e.max};
  const home=platforms.filter(s=>e.x>=s.x&&e.x<=s.x+s.w&&s.y<=e.y+.1&&s.w>=2.5)
    .sort((a,b)=>Math.abs(e.y-a.y)-Math.abs(e.y-b.y))[0];
  if(home){
    const min=Math.max(home.x+.55,e.x-2.2),max=Math.min(home.x+home.w-.55,e.x+2.2);
    if(max-min>=1.2)return {min,max};
  }
  return {min:e.x-1.6,max:e.x+1.6};
}
export function initializeEnemy(e,id,platforms=[]){
  Object.assign(e,{id,alive:true,dir:-1,baseY:e.y,prevX:e.x,prevY:e.y,vx:0,vy:0});
  if(DREAM_KINDS.includes(e.kind)){initializeDreamEnemy(e);return;}
  if(e.kind==='spitter'){initializeSpitter(e);return;}
  if(e.kind==='spore'){initializeSpore(e,platforms);return;}
  if(e.kind==='drifter'){initializeDrifter(e);return;}
  if(e.kind==='bat'){
    const legacy=!(e.max-e.min>.1);Object.assign(e,batPatrolBounds(e,platforms));
    e.speed=legacy?Math.max(e.speed||0,BAT.patrolSpeed):(e.speed||BAT.patrolSpeed);
    e.bob??=BAT.bob;e.period??=BAT.period;e.phase??=0;e.homeX=clamp(e.x,e.min,e.max);
    resetBat(e,0,.9);
  }
}
export function resetBat(e,time,cooldown=BAT.cooldown){
  if(e.kind!=='bat'||!e.alive)return;
  Object.assign(e,{x:e.homeX,y:hoverY(e,time),aiState:'patrol',stateTime:0,cooldown,vx:0,vy:0,dir:-1,lookX:null,lookY:null,aimX:null,aimY:null});
  e.prevX=e.x;e.prevY=e.y;
}
function enter(e,state){e.aiState=state;e.stateTime=0;}

// Sweep the body against the playable solids. This keeps a fast dive from
// tunnelling through a narrow deck, while inactive bridges remain passable.
export function batTravelFraction(x,y,nx,ny,platforms=[]){
  let result=1;
  for(const s of platforms){
    if(s.active===false||s.broken)continue;
    const top=s.y+(s.kind==='balance'?Math.abs(Math.sin(s.angle||0))*s.w/2:0);
    const lo=[s.x-BAT.bodyRadius,top-(s.kind==='stone'?11:s.kind==='gate'?(s.h||10):.25)-BAT.top];
    const hi=[s.x+s.w+BAT.bodyRadius,top-BAT.bottom];
    let enter=0,leave=1;
    for(let axis=0;axis<2;axis++){
      const p=axis?y:x,d=axis?ny-y:nx-x;
      if(Math.abs(d)<1e-9){if(p<=lo[axis]||p>=hi[axis]){enter=2;break;}}
      else{let a=(lo[axis]-p)/d,b=(hi[axis]-p)/d;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);leave=Math.min(leave,b);}
    }
    if(enter<=leave&&enter<=1&&leave>0)result=Math.min(result,Math.max(0,enter-1e-4));
  }
  return result;
}
function travel(e,x,y,platforms){
  const t=batTravelFraction(e.x,e.y,x,y,platforms);e.x+=(x-e.x)*t;e.y+=(y-e.y)*t;return t>=1;
}
function targetInRange(e,p){
  return p&&p.health>0&&p.x>=e.min-5&&p.x<=e.max+5&&Math.abs(p.y+.85-e.baseY-centerY)<5;
}
export function recoverBat(e){
  if(!e.alive||e.kind!=='bat'||e.aiState==='recover')return;
  // Retrace the clear attack corridor via its apex before rejoining patrol.
  const via=['dive','charge'].includes(e.aiState);
  e.returnViaX=via?e.chargeX:e.x;e.returnViaY=via?e.chargeY:e.y;
  e.returnX=clamp(e.attackX??e.homeX,e.min,e.max);e.returnLeg=0;
  e.cooldown=BAT.cooldown;enter(e,'recover');
}
function moveBat(e,dt,time,context){
  const {player:p,platforms=[],canStart=true,onEvent}=context;
  e.stateTime+=dt;
  if(batAttacking(e)&&!targetInRange(e,p))recoverBat(e);
  if(e.aiState==='patrol'){
    e.cooldown=Math.max(0,e.cooldown-dt);
    e.x+=e.dir*e.speed*dt;
    if(e.x<=e.min){e.x=e.min;e.dir=1;}if(e.x>=e.max){e.x=e.max;e.dir=-1;}
    e.y=hoverY(e,time);
    if(canStart&&!e.cooldown&&targetInRange(e,p)&&!(p.invuln>0)&&
      Math.hypot(p.x-e.x,p.y+.85-e.y-centerY)<BAT.triggerRange&&
      batTravelFraction(e.x,e.y,p.x,p.y+.85-centerY,platforms)===1){
      const away=Math.sign(e.x-p.x)||e.dir;
      e.attackX=e.x;e.attackY=e.y;
      e.lookX=p.x;e.lookY=p.y+.85;
      e.retreatX=clamp(e.x+away*1.65,e.min-2,e.max+2);
      e.retreatY=Math.max(e.y+2.15,Math.min(p.y+2.8,e.baseY+3.4));
      enter(e,'retreat');
    }
  }else if(e.aiState==='retreat'){
    e.lookX=p.x;e.lookY=p.y+.85;
    const t=smooth(clamp(e.stateTime/BAT.retreatTime,0,1));
    const clear=travel(e,e.attackX+(e.retreatX-e.attackX)*t,e.attackY+(e.retreatY-e.attackY)*t,platforms);
    if(!clear){recoverBat(e);return;}
    if(e.stateTime>=BAT.retreatTime){
      e.chargeX=e.x;e.chargeY=e.y;
      // Lock the target BEFORE the warning: stepping aside beats the dive.
      e.aimX=p.x;e.aimY=Math.min(p.y+.85,e.y+centerY-1);
      enter(e,'charge');onEvent?.('bat-charge',{x:e.x,y:e.y});
    }
  }else if(e.aiState==='charge'){
    if(e.stateTime>=BAT.chargeTime){
      const dx=e.aimX-e.x,dy=e.aimY-e.y-centerY,distance=Math.hypot(dx,dy);
      e.diveVX=dx/distance*BAT.diveSpeed;e.diveVY=dy/distance*BAT.diveSpeed;
      e.diveDuration=Math.min(.8,(distance+.9)/BAT.diveSpeed);
      enter(e,'dive');onEvent?.('bat-dive',{x:e.x,y:e.y});
    }
  }else if(e.aiState==='dive'){
    const clear=travel(e,e.x+e.diveVX*dt,e.y+e.diveVY*dt,platforms);
    if(!clear||e.stateTime>=e.diveDuration)recoverBat(e);
  }else if(e.aiState==='recover'){
    const tx=e.returnLeg?e.returnX:e.returnViaX,ty=e.returnLeg?hoverY(e,time):e.returnViaY;
    const dx=tx-e.x,dy=ty-e.y,distance=Math.hypot(dx,dy),step=Math.min(distance,dt*6);
    if(distance>.03){
      if(!travel(e,e.x+dx/distance*step,e.y+dy/distance*step,platforms)){
        // A moving platform can close the return path. Rise along its side
        // instead of snapping through it or teleporting back to the roost.
        travel(e,e.x,e.y+dt*3,platforms);
      }
    }else if(!e.returnLeg)e.returnLeg=1;
    else enter(e,'patrol');
  }
}
export function moveEnemy(e,dt,time,context={}){
  if(!e.alive||dt<=0)return;
  e.prevX=e.x;e.prevY=e.y;
  if(e.kind==='bat')moveBat(e,dt,time,context);
  else if(e.kind==='spitter')moveSpitter(e,dt,time,context);
  else if(e.kind==='spore')moveSpore(e,dt,time,context);
  else if(e.kind==='drifter')moveDrifter(e,dt,time,context);
  else if(DREAM_KINDS.includes(e.kind))moveDreamEnemy(e,dt,time,context);
  else{
    e.x+=e.dir*e.speed*dt;
    if(e.x<e.min){e.x=e.min;e.dir=1;}if(e.x>e.max){e.x=e.max;e.dir=-1;}
  }
  e.vx=(e.x-e.prevX)/dt;e.vy=(e.y-e.prevY)/dt;
  if(e.kind==='bat'&&Math.abs(e.vx)>.05)e.dir=Math.sign(e.vx);
}
