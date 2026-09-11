// A readable feint: wiggle → spore puff → crouch → locked jump → recovery.
// Feet use world Y. Spores and the soft cap are separate, forgiving colliders.
export const SPORE={height:1.03,radius:.44,triggerRange:3.7,puffRange:2.7,wiggleTime:.65,puffTime:.16,crouchTime:.34,stunTime:.36,stunGrace:2.5,leapSpeed:10.2,gravity:32,recoveryTime:1.15,cooldown:2.4};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const surface=(s,x)=>s.y+(s.kind==='balance'?Math.sin(s.angle||0)*(x-s.x-s.w/2):0);
const solid=s=>s.active!==false&&!s.broken;
const enter=(e,state)=>{e.aiState=state;e.stateTime=0;};
export const sporeAttacking=e=>e.kind==='spore'&&e.alive&&['wiggle','puff','crouch','leap'].includes(e.aiState);
export function sporeSight(e,p,platforms){
  const x=e.x,y=e.y+.65,dx=p.x-x,dy=p.y+.8-y;
  for(const s of platforms){
    if(!solid(s))continue;
    const lo=[s.x,s.y-(s.kind==='stone'?11:.25)],hi=[s.x+s.w,s.y];let a=0,b=1;
    for(let k=0;k<2;k++){
      const at=k?y:x,d=k?dy:dx;
      if(Math.abs(d)<1e-8){if(at<=lo[k]||at>=hi[k]){a=2;break;}}
      else{let t=(lo[k]-at)/d,u=(hi[k]-at)/d;if(t>u)[t,u]=[u,t];a=Math.max(a,t);b=Math.min(b,u);}
    }
    if(a<b&&a<1&&b>0)return false;
  }
  return true;
}
export function initializeSpore(e,platforms=[]){
  e.min??=e.x-1;e.max??=e.x+1;e.speed??=.55;
  const home=platforms.filter(s=>solid(s)&&e.x>=s.x&&e.x<=s.x+s.w&&Math.abs(e.y-s.y)<.45).sort((a,b)=>Math.abs(e.y-a.y)-Math.abs(e.y-b.y))[0];
  e.homeId=home?.id??null;e.homeX=clamp(e.x,e.min,e.max);resetSpore(e);
}
export function resetSpore(e){
  if(e.kind!=='spore'||!e.alive)return;
  Object.assign(e,{x:e.homeX,y:e.baseY,prevX:e.homeX,prevY:e.baseY,vx:0,vy:0,leapVX:0,leapVY:0,dir:-1,aiState:'idle',stateTime:0,cooldown:1.0,puffAge:10,groundId:e.homeId});
}
export function puffPlayer(e,p,platforms=[]){
  if(!p||p.health<=0||p.invuln>0||p.sporeGrace>0)return false;
  const dx=(p.x-e.x)*e.dir,dy=p.y+.7-(e.y+.65);
  if(dx<-.35||dx>SPORE.puffRange||Math.abs(dy)>1.05||!sporeSight(e,p,platforms))return false;
  p.stunTime=SPORE.stunTime;p.sporeGrace=SPORE.stunGrace;p.stunJumpQueued=false;p.jumpBuffer=0;p.stomping=false;p.stompWindup=0;
  return true;
}
export function moveSpore(e,dt,time,{player:p,platforms=[],canStart=true,onEvent}={}){
  e.stateTime+=dt;e.puffAge+=dt;
  const ground=platforms.find(s=>s.id===e.groundId&&solid(s));
  if(e.aiState!=='leap'&&ground){
    e.x+=ground.x-(ground.prevX??ground.x);e.y=surface(ground,e.x);
  }
  const home=platforms.find(s=>s.id===e.homeId&&solid(s));
  const offset=home?home.x-(home.baseX??home.x):0,min=Math.max(e.min+offset,home?home.x+.53:e.min),max=Math.min(e.max+offset,home?home.x+home.w-.53:e.max);
  const target=p&&p.health>0&&!p.invuln&&Math.abs(p.x-e.x)<SPORE.triggerRange&&Math.abs(p.y-e.y)<1.8&&sporeSight(e,p,platforms);
  if(e.aiState==='idle'){
    e.cooldown=Math.max(0,e.cooldown-dt);
    if(ground&&min<=max){
      if(e.x<=min)e.dir=1;if(e.x>=max)e.dir=-1;
      e.x=clamp(e.x+e.dir*e.speed*dt,ground.x+.5,ground.x+ground.w-.5);
    }
    if(canStart&&target&&!e.cooldown&&ground){e.dir=Math.sign(p.x-e.x)||1;enter(e,'wiggle');onEvent?.('spore-wiggle',{x:e.x,y:e.y});}
  }else if(e.aiState==='wiggle'){
    if(!p||Math.abs(p.x-e.x)>6||Math.abs(p.y-e.y)>3){e.cooldown=.8;enter(e,'recover');}
    else{
      e.dir=Math.sign(p.x-e.x)||e.dir;
      if(e.stateTime>=SPORE.wiggleTime){
        e.aimX=clamp(p.x,e.x-5.4,e.x+5.4);e.puffAge=0;e.puffX=e.x;e.puffY=e.y+.67;e.puffDir=e.dir;
        const stunned=puffPlayer(e,p,platforms);enter(e,'puff');
        onEvent?.('spore-puff',{x:e.x,y:e.puffY,dir:e.dir});if(stunned)onEvent?.('spore-stun',{x:p.x,y:p.y});
      }
    }
  }else if(e.aiState==='puff'){
    if(e.stateTime>=SPORE.puffTime)enter(e,'crouch');
  }else if(e.aiState==='crouch'){
    if(e.stateTime>=SPORE.crouchTime){
      e.leapVY=SPORE.leapSpeed;
      // Commit to the warned position; the leap never tracks a dodging player.
      e.leapVX=clamp((e.aimX-e.x)/(2*SPORE.leapSpeed/SPORE.gravity),-8.5,8.5);
      e.groundId=null;enter(e,'leap');onEvent?.('spore-leap',{x:e.x,y:e.y});
    }
  }else if(e.aiState==='recover'){
    if(e.stateTime>=SPORE.recoveryTime){e.cooldown=SPORE.cooldown;enter(e,'idle');}
  }
  if(e.aiState==='leap'||!ground){
    const oldX=e.x,oldY=e.y;e.leapVY-=SPORE.gravity*dt;
    let nx=e.x+(e.leapVX||0)*dt,ny=e.y+e.leapVY*dt;
    // Clamp against tall walls and sweep downward through thin ledges.
    for(const s of platforms)if(solid(s)&&s.kind==='stone'&&ny<s.y-.12&&ny+SPORE.height>s.y-11){
      if(oldX+SPORE.radius<=s.x&&nx+SPORE.radius>s.x){nx=s.x-SPORE.radius;e.leapVX=0;}
      else if(oldX-SPORE.radius>=s.x+s.w&&nx-SPORE.radius<s.x+s.w){nx=s.x+s.w+SPORE.radius;e.leapVX=0;}
    }
    const landing=platforms.filter(s=>solid(s)&&nx>=s.x+.25&&nx<=s.x+s.w-.25&&oldY>=surface(s,nx)-.08&&ny<=surface(s,nx)&&e.leapVY<=0).sort((a,b)=>b.y-a.y)[0];
    e.x=nx;e.y=ny;
    if(landing){e.y=surface(landing,nx);e.groundId=landing.id;e.leapVX=e.leapVY=0;enter(e,'recover');onEvent?.('spore-land',{x:e.x,y:e.y});}
    // A player can bait it into a gap. It stays defeated until a fresh run.
    if(e.y<e.baseY-13){e.alive=false;onEvent?.('spore-fall',{x:e.x,y:e.y});}
  }
}
export function contactSpore(p,e,prevY,rules,jumpHeld){
  if(!e.alive||Math.abs(p.x-e.x)>=SPORE.radius+rules.radius)return null;
  const top=e.y+SPORE.height;
  if(p.vy<0&&prevY>=(e.prevY??e.y)+SPORE.height-.13&&p.y<=top+.03){
    p.y=top+.03;p.vy=jumpHeld?11.8:9.2;p.groundId=null;p.coyote=0;p.stomping=false;p.stompWindup=0;p.springing=true;p.stunTime=0;p.stunJumpQueued=false;
    e.alive=false;return 'defeat';
  }
  if(e.aiState==='leap'&&p.y<top&&p.y+rules.height>e.y+.12)return 'hit';
  return null;
}
