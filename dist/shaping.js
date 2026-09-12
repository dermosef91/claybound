// Bounded, reversible clay deformation. The same dimensions drive collision and art.
export const clampShape=n=>Math.max(0,Math.min(1,n));
const lerp=(a,b,t)=>t===1?b:t===0?a:a+(b-a)*t;
export const rampProfile=u=>u*u*(3-2*u);
export function claySurface(s,x,previous=false){
  const y=previous?s.prevY:s.y,w=previous?(s.prevW??s.w):s.w,left=previous?s.prevX:s.x;
  const slope=previous?(s.prevSlope??s.slope??0):(s.slope||0);
  const u=clampShape((x-left)/w);
  return y+slope*(s.clayRole==='ramp'?rampProfile(u):u);
}
export function clayWallBounds(s,headY){
  if(s.clayRole!=='landing')return {left:s.x,right:s.x+s.w};
  const v=clampShape((headY-(s.y-.23-s.h))/s.h);
  const width=headY>=s.y-.35?s.w:1.5+(s.w-1.5)*Math.pow(v,5);
  return {left:s.x+(s.w-width)/2,right:s.x+(s.w+width)/2};
}
export function initializeShaping(L){
  for(const station of L.shaping||[]){station.amount=0;station.target=0;station.announced=false;}
  for(const s of L.platforms)if(s.shape){Object.assign(s,s.shape.from);s.prevW=s.w;s.prevSlope=s.slope||0;}
}
export function nearbyStation(game){
  const p=game.player;
  return (game.level.shaping||[]).findLast(s=>p.x>=s.x&&p.x<=s.end&&Math.abs(p.y-s.spawn.y)<10);
}
export function updateShaping(game,dt,input){
  const L=game.level,p=game.player,near=nearbyStation(game);
  for(const station of L.shaping||[]){
    if(station===near&&!game.respawnTimer&&!(p.stunTime>0)){
      if(input.shapeReset){station.target=0;station.announced=false;}
      else if(input.shapeHeld)station.target=clampShape(station.target+dt*.65);
      if(input.shapeId===station.id&&Number.isFinite(input.shapeAmount))station.target=clampShape(input.shapeAmount);
    }
    station.amount+=Math.sign(station.target-station.amount)*Math.min(Math.abs(station.target-station.amount),dt*.9);
    // Smooth bounded poses, including intermediate collision shapes.
    const t=station.amount*station.amount*(3-2*station.amount);
    for(const id of station.parts){
      const s=L.platforms.find(p=>p.id===id),{from,to}=s.shape;
      s.prevW=s.w;s.prevSlope=s.slope||0;
      for(const key of ['x','w','y','h','slope'])if(from[key]!==undefined||to[key]!==undefined)s[key]=lerp(from[key]||0,to[key]||0,t);
    }
    if(station.lift){const lift=L.platforms.find(p=>p.id===station.lift);lift.y=lerp(station.liftFrom,station.liftTo,t);}
    if(station.amount>.995&&!station.announced){station.announced=true;game.event('shape',{id:station.id,x:p.x,y:p.y,message:station.name+' · shaped'});}
  }
}
export function stompClay(game,s){
  const station=(game.level.shaping||[]).find(t=>t.parts.includes(s.id));
  if(station?.gesture==='down')station.target=clampShape(station.target+.5);
}
export function visitStation(game,id,{reset=false}={}){
  if(!game.level.playground||!['playing','paused'].includes(game.status))return false;
  const station=game.level.shaping.find(s=>s.id===id);if(!station)return false;
  if(reset){station.target=0;station.announced=false;}
  game.checkpoint={x:station.spawn.x,y:station.spawn.y};game.checkpointId=station.spawn.groundId;game.respawnTimer=0;
  game.respawn();Object.assign(game.player,station.spawn,{health:3,invuln:1.4});
  game.sectionId=game.level.sections.findLast(s=>game.player.x>=s.x)?.id??0;
  return true;
}
