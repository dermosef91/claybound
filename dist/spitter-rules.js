// Echo Spitter: watch → cheek swell (aim locks) → clay pellet → recovery.
// No homing. Cover stops shots; one descending stomp defeats the creature.
export const SPITTER={height:1.12,radius:.49,range:10,charge:.9,cooldown:2.1,shotSpeed:6.5,shotRadius:.19,shotLife:2.5};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function initializeSpitter(e){
  e.min??=e.x;e.max??=e.x;e.homeX=e.x;e.speed=0;resetSpitter(e);
}
export function resetSpitter(e){
  if(e.kind!=='spitter'||!e.alive)return;
  Object.assign(e,{x:e.homeX,y:e.baseY,prevX:e.homeX,prevY:e.baseY,aiState:'watch',stateTime:0,cooldown:1.1,dir:e.facing||-1});
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
export function moveSpitter(e,dt,time,{player:p,platforms=[],onEvent,shots=[],nextShotId}={}){
  e.stateTime+=dt;e.cooldown=Math.max(0,e.cooldown-dt);
  const nearby=p&&p.health>0&&!p.invuln&&Math.abs(p.x-e.x)<SPITTER.range&&Math.abs(p.y-e.y)<3.3;
  if(e.aiState==='watch'){
    if(nearby)e.dir=Math.sign(p.x-e.x)||e.dir;
    if(nearby&&!e.cooldown&&shotWall(e.x,e.y+.77,p.x,p.y+.85,platforms,.05)===Infinity){
      e.aimX=p.x;e.aimY=p.y+.85;e.aiState='charge';e.stateTime=0;
      onEvent?.('spitter-charge',{x:e.x,y:e.y});
    }
  }else if(e.aiState==='charge'&&e.stateTime>=SPITTER.charge){
    const dx=e.aimX-e.x,dy=e.aimY-(e.y+.77),len=Math.hypot(dx,dy)||1;
    // A fixed budget also applies when many enemies are placed in the editor.
    if(p&&Math.abs(p.x-e.x)<SPITTER.range+3&&shots.length<16){
      const vx=dx/len*SPITTER.shotSpeed,vy=clamp(dy/len*SPITTER.shotSpeed,-4.5,4.5);
      shots.push({id:nextShotId(),owner:e.id,x:e.x+Math.sign(dx)*.62,y:e.y+.77,vx,vy,age:0});
      onEvent?.('spitter-fire',{x:e.x,y:e.y+.77});
    }
    e.aiState='recover';e.stateTime=0;e.cooldown=SPITTER.cooldown;
  }else if(e.aiState==='recover'&&e.stateTime>.55){e.aiState='watch';e.stateTime=0;}
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
