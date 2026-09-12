// Echo Spitter: patrol → sightline lock → wind-up → crystal → recovery.
// No homing. Cover stops shots; one descending stomp defeats the creature.
export const SPITTER={height:1.12,radius:.49,range:10,charge:.9,cooldown:2.1,shotSpeed:6.5,shotRadius:.3,patrolSpeed:.38,turn:.95,mouthY:.4300511474,mouthZ:.7884600970,shotLife:2.5};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function initializeSpitter(e){
  e.min??=e.x-2;e.max??=e.x+2;e.homeX=e.x;e.speed??=SPITTER.patrolSpeed;
  if(e.min===e.max&&e.speed>0){e.min=e.x-2;e.max=e.x+2;}resetSpitter(e);
}
export function resetSpitter(e){
  if(e.kind!=='spitter'||!e.alive)return;
  Object.assign(e,{x:e.homeX,y:e.baseY,prevX:e.homeX,prevY:e.baseY,aiState:'patrol',stateTime:0,cooldown:1.1,dir:e.facing||-1});
}
export function segmentBox(x,y,nx,ny,left,bottom,right,top){
  let enter=0,leave=1;
  for(const [p,d,lo,hi]of [[x,nx-x,left,right],[y,ny-y,bottom,top]]){
    if(Math.abs(d)<1e-9){if(p<lo||p>hi)return null;}
    else{let a=(lo-p)/d,b=(hi-p)/d;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);leave=Math.min(leave,b);}
  }
  return enter<=leave&&enter<=1&&leave>=0?Math.max(0,enter):null;
}
export function shotWall(x,y,nx,ny,platforms,r=SPITTER.shotRadius){
  let nearest=Infinity;
  for(const s of platforms){
    if(s.active===false||s.broken||s.kind==='switch'||s.kind==='spring')continue;
    const depth=s.kind==='stone'?11:s.kind==='gate'?(s.h||10):.42;
    const t=segmentBox(x,y,nx,ny,s.x-r,s.y-depth-r,s.x+s.w+r,s.y+r);
    if(t!==null)nearest=Math.min(nearest,t);
  }
  return nearest;
}
// Calibrated on the normalized Gloobasnout lip at the full wind-up pose.
// tests/spitter-assets.mjs verifies this against a head-bone mouth anchor.
export function spitterMuzzle(e){
  const turn=(e.dir||-1)*SPITTER.turn;
  return {x:e.x+Math.sin(turn)*SPITTER.mouthZ,y:e.y+SPITTER.mouthY,z:.12+Math.cos(turn)*SPITTER.mouthZ};
}
function patrol(e,dt,platforms){
  const floor=platforms.find(s=>s.active!==false&&!s.broken&&Math.abs(s.y-e.y)<.12&&e.x>=s.x&&e.x<=s.x+s.w&&s.kind!=='gate');
  if(!floor)return;
  const left=Math.max(e.min,floor.x+SPITTER.radius),right=Math.min(e.max,floor.x+floor.w-SPITTER.radius);
  if(right<=left)return;
  const next=clamp(e.x+e.dir*e.speed*dt,left,right);
  // A wall or closed gate can cut across an otherwise continuous floor.
  if(shotWall(e.x,e.y+.55,next,e.y+.55,platforms,SPITTER.radius)<Infinity){e.dir*=-1;return;}
  e.x=next;if(e.x<=left)e.dir=1;else if(e.x>=right)e.dir=-1;
}
export function moveSpitter(e,dt,time,{player:p,platforms=[],onEvent,shots=[],nextShotId}={}){
  e.stateTime+=dt;e.cooldown=Math.max(0,e.cooldown-dt);
  const nearby=['patrol','watch'].includes(e.aiState)&&p&&p.health>0&&!p.invuln&&Math.abs(p.x-e.x)<SPITTER.range&&Math.abs(p.y-e.y)<3.3;
  const facing=nearby?Math.sign(p.x-e.x)||e.dir:e.dir;
  const muzzle=spitterMuzzle({...e,dir:facing});
  const visible=nearby&&shotWall(e.x,e.y+SPITTER.mouthY,muzzle.x,muzzle.y,platforms,.05)===Infinity&&shotWall(muzzle.x,muzzle.y,p.x,p.y+.85,platforms,.05)===Infinity;
  if(e.aiState==='patrol'||e.aiState==='watch'){
    if(visible){
      e.dir=facing;e.aiState='watch';
      if(!e.cooldown){e.aimX=p.x;e.aimY=p.y+.85;e.aiState='charge';e.stateTime=0;onEvent?.('spitter-charge',{x:e.x,y:e.y});}
    }else{e.aiState='patrol';patrol(e,dt,platforms);}
  }else if(e.aiState==='charge'&&e.stateTime>=SPITTER.charge){
    const origin=spitterMuzzle(e),dx=e.aimX-origin.x,dy=e.aimY-origin.y,len=Math.hypot(dx,dy)||1;
    if(p&&Math.abs(p.x-e.x)<SPITTER.range+3&&shots.length<16){
      const vx=dx/len*SPITTER.shotSpeed,vy=clamp(dy/len*SPITTER.shotSpeed,-4.5,4.5);
      shots.push({id:nextShotId(),owner:e.id,...origin,vx,vy,age:0});onEvent?.('spitter-fire',origin);
    }
    e.aiState='recover';e.stateTime=0;e.cooldown=SPITTER.cooldown;
  }else if(e.aiState==='recover'&&e.stateTime>.55){e.aiState='patrol';e.stateTime=0;}
}
export function updateShots(game,dt,previousPlayer){
  const p=game.player,R=SPITTER.shotRadius;
  for(let i=game.shots.length-1;i>=0;i--){
    const q=game.shots[i],nx=q.x+q.vx*dt,ny=q.y+q.vy*dt;
    q.age+=dt;
    const wall=shotWall(q.x,q.y,nx,ny,game.level.platforms);
    // Relative sweep catches a moving player without tunnelling through cover.
    const hit=segmentBox(q.x-previousPlayer.x,q.y-previousPlayer.y,nx-p.x,ny-p.y,-.32-R,-R,.32+R,1.7+R);
    if(hit!==null&&hit<wall&&game.respawnTimer<=0){game.damage();game.event('shot-pop',{x:q.x,y:q.y});game.shots.splice(i,1);}
    else if(wall<=1||q.age>SPITTER.shotLife){game.event('shot-pop',{x:q.x,y:q.y});game.shots.splice(i,1);}
    else{q.x=nx;q.y=ny;}
  }
}
export function contactSpitter(p,e,prevY,jumpHeld){
  if(!e.alive||Math.abs(p.x-e.x)>.8)return null;
  const top=e.y+SPITTER.height;
  if(p.vy<0&&prevY>=top-.15&&p.y<=top+.03){
    e.alive=false;p.y=top+.03;p.vy=jumpHeld?12:9.5;p.groundId=null;p.coyote=0;p.stomping=false;p.stompWindup=0;p.springing=true;
    return 'defeat';
  }
  return p.y<top&&p.y+1.7>e.y+.06?'hit':null;
}
