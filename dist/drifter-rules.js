// Body contact hurts; a descending jump breaks the clay-leaf body.
// Outer flakes and trailing grains are outside the forgiving collider.
export const DRIFTER={width:1.3,radius:.48,halfHeight:.49,groundRadius:.64,bob:.18,period:4.8,patrolSpeed:.95,driftTime:4.4,rollTime:3.8,transitionTime:.75};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const hoverY=(e,time)=>e.baseY+(e.anchorOffsetY||0)+Math.sin(time*Math.PI*2/e.period+e.phase)*e.bob+e.windLift;
const surface=(s,x)=>s.y+(s.kind==='balance'?Math.sin(s.angle||0)*(x-s.x-s.w/2):0);
function groundBelow(e,platforms){
  return platforms.filter(s=>s.active!==false&&!s.broken&&s.w>=DRIFTER.groundRadius*2&&
    e.x>=s.x+DRIFTER.groundRadius&&e.x<=s.x+s.w-DRIFTER.groundRadius&&
    surface(s,e.x)<=e.y-DRIFTER.groundRadius+.2&&e.y-surface(s,e.x)<3)
    .sort((a,b)=>surface(b,e.x)-surface(a,e.x))[0];
}
function enter(e,state){e.aiState=state;e.stateTime=0;e.transitionY=e.y;e.transitionAngle=e.rollAngle;e.transitionBlend=e.airBlend;}

export function initializeDrifter(e){
  e.min??=e.x-1.5;e.max??=e.x+1.5;e.speed??=DRIFTER.patrolSpeed;
  e.bob??=DRIFTER.bob;e.period??=DRIFTER.period;e.phase??=e.id*.9;
  e.homeX=clamp(e.x,e.min,e.max);resetDrifter(e,0);
}
export function resetDrifter(e,time=0){
  if(e.kind!=='drifter'||!e.alive)return;
  Object.assign(e,{x:e.homeX,y:e.baseY+Math.sin(time*Math.PI*2/e.period+e.phase)*e.bob,
    vx:0,vy:0,dir:-1,windLift:0,windX:0,windY:0,bump:0,rest:0,animationTime:time+e.phase,
    aiState:'drifting',stateTime:((e.phase%DRIFTER.driftTime)+DRIFTER.driftTime)%DRIFTER.driftTime,
    groundId:null,anchorId:null,anchorOffsetY:0,airBlend:1,rollAngle:0,patrolMin:e.min,patrolMax:e.max});
  e.prevX=e.x;e.prevY=e.y;
}
export function moveDrifter(e,dt,time,{winds=[],platforms=[]}={}){
  e.stateTime+=dt;
  const anchor=platforms.find(s=>s.id===e.anchorId);
  if(anchor)e.x+=anchor.x-(anchor.prevX??anchor.x);
  const anchorOffsetX=anchor?anchor.x-(anchor.baseX??anchor.x):0;
  e.anchorOffsetY=anchor?anchor.y-(anchor.baseY??anchor.y):0;
  e.patrolMin=e.min+anchorOffsetX;e.patrolMax=e.max+anchorOffsetX;
  let ground=platforms.find(s=>s.id===e.groundId&&s.active!==false&&!s.broken);
  if(e.aiState==='drifting'&&e.stateTime>=DRIFTER.driftTime){
    ground=groundBelow(e,platforms);
    if(ground){e.groundId=e.anchorId=ground.id;enter(e,'landing');}
  }
  if(['landing','rolling'].includes(e.aiState)){
    if(ground){
      const offset=ground.x-(ground.baseX??ground.x);
      const min=Math.max(e.min+offset,ground.x+DRIFTER.groundRadius),max=Math.min(e.max+offset,ground.x+ground.w-DRIFTER.groundRadius);
      if(min<=max){e.patrolMin=min;e.patrolMax=max;}else ground=null;
    }
    // An edited, crumbling, or switched-off deck releases the Drifter into
    // flight instead of leaving it rolling across empty space.
    if(!ground){enter(e,'lifting');e.groundId=null;}
  }
  if(e.aiState==='rolling'&&e.stateTime>=DRIFTER.rollTime){enter(e,'lifting');e.groundId=null;}
  let wx=0,wy=0;
  for(const wind of winds)if(wind.active&&e.x>wind.x&&e.x<wind.x+wind.w&&e.y>wind.y&&e.y<wind.y+wind.h){
    const strength=wind.gust?.35+.65*(.5+.5*Math.sin(time*1.3+(wind.phase||0))):1;
    wx+=wind.fx*strength;wy+=wind.fy*strength;
  }
  e.windX=wx;e.windY=wy;e.animationTime=time+e.phase;
  e.bump=Math.max(0,e.bump-dt);e.rest=Math.max(0,e.rest-dt);
  const oldX=e.x,remaining=e.dir>0?e.patrolMax-e.x:e.x-e.patrolMin;
  const speed=e.speed*(e.aiState==='rolling'?1.35:1);
  const turnEase=clamp(remaining/.65,.22,1),bias=clamp(wx*(e.aiState==='rolling'?.025:.08),-speed*.55,speed*.55);
  const target=e.rest?0:e.dir*speed*turnEase+bias;
  e.vx=approach(e.vx,target,dt*3.2);e.x+=e.vx*dt;
  if(e.x<=e.patrolMin){e.x=e.patrolMin;e.dir=1;}if(e.x>=e.patrolMax){e.x=e.patrolMax;e.dir=-1;}
  e.windLift+=(clamp(wy*.028,-.3,.65)-e.windLift)*(1-Math.exp(-dt*3));
  const t=smooth(e.stateTime/DRIFTER.transitionTime);
  if(e.aiState==='landing'){
    e.airBlend=1-t;e.y=e.transitionY+(surface(ground,e.x)+DRIFTER.groundRadius-e.transitionY)*t;
    e.rollAngle-=(e.x-oldX)/DRIFTER.groundRadius*(1-e.airBlend);
    if(e.stateTime>=DRIFTER.transitionTime)enter(e,'rolling');
  }else if(e.aiState==='rolling'){
    e.airBlend=0;e.y=surface(ground,e.x)+DRIFTER.groundRadius;
    e.rollAngle-=(e.x-oldX)/DRIFTER.groundRadius;
  }else if(e.aiState==='lifting'){
    e.airBlend=e.transitionBlend+(1-e.transitionBlend)*t;
    e.y=e.transitionY+(hoverY(e,time)-e.transitionY)*t;
    const upright=Math.round(e.transitionAngle/(Math.PI*2))*Math.PI*2;
    e.rollAngle=e.transitionAngle+(upright-e.transitionAngle)*t;
    if(e.stateTime>=DRIFTER.transitionTime){e.rollAngle=0;enter(e,'drifting');}
  }else{e.airBlend=1;e.y=hoverY(e,time);}
}

export function contactDrifter(p,e,prevY,rules,jumpHeld){
  if(!e.alive)return null;
  const top=e.y+DRIFTER.halfHeight,bottom=e.y-DRIFTER.halfHeight,radius=rules.radius+DRIFTER.radius;
  if(Math.abs(p.x-e.x)>=radius-1e-5)return null;
  if(p.vy<0&&prevY>=(e.prevY??e.y)+DRIFTER.halfHeight-.1&&p.y<=top+.03){
    p.y=top+.03;p.vy=jumpHeld?11:8;p.groundId=null;p.coyote=0;p.stomping=false;p.stompWindup=0;p.springing=true;
    e.alive=false;e.vx=0;e.vy=0;return 'defeat';
  }
  if(p.y>=top||p.y+rules.height<=bottom)return null;
  // Game.damage owns knockback and invulnerability. Do not block the player
  // against the body while that grace period lets them move clear.
  return 'hit';
}
