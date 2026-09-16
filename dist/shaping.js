// Bounded, reversible clay deformation. The same dimensions drive collision and art.
//
// A station with no `rule` behaves exactly as it always has; the experimental
// rules live in clay-rules.js and can only be reached by a level that asks for
// one, which no chapter does.
import {initializeRule,applyRule,stepAmounts,partAmount,perPart,stompRule,standingOn} from './clay-rules.js';
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
  for(const station of L.shaping||[]){station.amount=0;station.target=0;station.announced=false;initializeRule(station);}
  for(const s of L.platforms)if(s.shape){Object.assign(s,s.shape.from);s.prevW=s.w;s.prevSlope=s.slope||0;}
  // Stations own their clay; one whose parts are gone simply has nothing to do.
  if(L.shaping)L.shaping=L.shaping.filter(station=>station.parts.some(id=>L.platforms.some(p=>p.id===id&&p.shape)));
}
export function nearbyStation(game){
  const p=game.player;
  return (game.level.shaping||[]).findLast(s=>p.x>=s.x&&p.x<=s.end&&Math.abs(p.y-s.spawn.y)<10);
}
export function updateShaping(game,dt,input){
  const L=game.level,p=game.player,near=nearbyStation(game);
  for(const station of L.shaping||[]){
    // A ruled station decides its own target from the world; the hold, drag and
    // reset gestures only reach clay that is worked by hand.
    const ruled=station.rule?applyRule(game,station,dt,{near:station===near}):false;
    if(station===near&&!game.respawnTimer&&!(p.stunTime>0)){
      if(input.shapeReset)resetStation(station);
      else if(!ruled){
        if(input.shapeHeld)station.target=clampShape(station.target+dt*.65);
        if(input.shapeId===station.id&&Number.isFinite(input.shapeAmount))station.target=clampShape(input.shapeAmount);
      }
    }
    if(!stepAmounts(station,dt))
      station.amount+=Math.sign(station.target-station.amount)*Math.min(Math.abs(station.target-station.amount),dt*.9);
    // Smooth bounded poses, including intermediate collision shapes.
    for(const [index,id] of station.parts.entries()){
      const s=L.platforms.find(p=>p.id===id);if(!s?.shape)continue;
      const amount=partAmount(station,index),t=amount*amount*(3-2*amount);
      const {from,to}=s.shape;
      s.prevW=s.w;s.prevSlope=s.slope||0;
      for(const key of ['x','w','y','h','slope'])if(from[key]!==undefined||to[key]!==undefined)s[key]=lerp(from[key]||0,to[key]||0,t);
      // Clay worn through stops being a surface at all.
      if(station.rule==='wear')s.broken=amount>=.999;
    }
    if(station.lift){
      const lift=L.platforms.find(p=>p.id===station.lift),whole=station.amount*station.amount*(3-2*station.amount);
      if(lift)lift.y=lerp(station.liftFrom,station.liftTo,whole);
    }
    if(station.amount>.995&&!station.announced){station.announced=true;game.event('shape',{id:station.id,x:p.x,y:p.y,message:station.name+' · shaped'});}
  }
}
// Landing hard on clay works it, whichever way that clay is meant to go: a
// stomp is an unmistakable "I am shaping this", and refusing it on a pull
// station just reads as the clay being broken.
export function stompClay(game,s){
  const station=(game.level.shaping||[]).find(t=>t.parts.includes(s.id));
  if(!station)return;
  if(station.rule){stompRule(station,station.parts.indexOf(s.id));return;}
  station.target=clampShape(station.target+.5);
}
// A tap, or any touch too short to be a drag, still moves the clay. Without it
// the only way in is a long precise drag, and clay that ignores a tap looks
// like clay that is not interactive at all.
export function nudgeClay(game,id){
  const station=(game.level.shaping||[]).find(s=>s.id===id);
  // Ruled clay answers to the world, not to a tap.
  if(!station||station.rule||station.target>=1)return false;
  station.target=clampShape(station.target+.3);return true;
}

// Softening a station back, whatever kind it is.
export function resetStation(station){
  station.target=0;station.amount=0;station.announced=false;
  station.charge=0;station.crossings=0;station.launched=0;
  if(perPart(station)){station.targets.fill(0);station.amounts.fill(0);}
}
export function visitStation(game,id,{reset=false}={}){
  if(!game.level.playground||!['playing','paused'].includes(game.status))return false;
  const station=game.level.shaping.find(s=>s.id===id);if(!station)return false;
  if(reset)resetStation(station);
  game.checkpoint={x:station.spawn.x,y:station.spawn.y};game.checkpointId=station.spawn.groundId;game.respawnTimer=0;
  game.respawn();Object.assign(game.player,station.spawn,{health:3,invuln:1.4});
  game.sectionId=game.level.sections.findLast(s=>game.player.x>=s.x)?.id??0;
  return true;
}
