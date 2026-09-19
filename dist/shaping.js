// Bounded, reversible clay deformation. The same dimensions drive collision and art.
//
// A station with no `rule` behaves exactly as it always has; the experimental
// rules live in clay-rules.js and can only be reached by a level that asks for
// one. One chapter does: the canyon's Sandwright's Pocket is a `form` mass,
// the one rule that has left the lab.
import {giveDepth,resetGive} from './clay-give.js';
import {initializeRule,applyRule,stepAmounts,partAmount,perPart,stompRule,standingOn,handRule,nudgeRule,resetFormStation} from './clay-rules.js';
import {FORM,formHeight} from './clay-form.js';
export const clampShape=n=>Math.max(0,Math.min(1,n));
// Working any violet clay is heard. A station that has been worked this tick —
// by a hand, a key, a tap, a boot or a stomp, whatever its rule — raises a
// `knead` event, and no oftener than this while the work goes on, so a long
// knead is a run of takes rather than a pile of them.
export const KNEAD_GAP=.5;
const lerp=(a,b,t)=>t===1?b:t===0?a:a+(b-a)*t;
export const rampProfile=u=>u*u*(3-2*u);
// `bare` leaves out the give layer and answers with the clay the weight is
// pressed into rather than the dent it has made. Only the grade underfoot asks
// for it: the hollow a walker sinks into travels with them, and standing in
// one is not the same as being on a hill, so it is left out of what counts as
// a slope. Everything that has to know where the feet actually are — landing,
// standing, drawing — asks for the surface as it is.
export function claySurface(s,x,previous=false,bare=false){
  // A mass with no pose carries its surface as columns over its base — less
  // however far a give layer riding the columns is pressed in, where it has one.
  if(s.form){
    const lx=x-(previous?s.prevX:s.x);
    return (previous?s.prevY:s.y)-s.h+formHeight(s.form,lx,previous)-(s.give&&!bare?giveDepth(s.give,lx,previous):0);
  }
  // A block that gives under weight carries its own surface.
  if(s.give)return (previous?s.prevY:s.y)-(bare?0:giveDepth(s.give,x-(previous?s.prevX:s.x),previous));
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
  for(const s of L.platforms)if(s.shape){Object.assign(s,s.shape.from);s.prevW=s.w;s.prevSlope=s.slope||0;}
  for(const station of L.shaping||[]){station.amount=0;station.target=0;station.announced=false;initializeRule(station,L);}
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
    // Being at the station is the whole condition, the same one a tap and a
    // stomp answer to. A spore's stun used to sit in here as well, which meant
    // the hold and the drag went quietly dead for a third of a second exactly
    // when a player who had just been hit was leaning on them, while tapping
    // the same clay still worked — clay that answers one hand and not another
    // reads as broken clay. Respawning still refuses: the player is on their
    // way back to a checkpoint and is not working anything. (The timer runs a
    // fraction past zero when it fires, so only a timer still running counts;
    // testing it for truth left every station dead after the first death.)
    const live=station===near&&!(game.respawnTimer>0);
    // A ruled station decides its own target from the world. The hold and drag
    // reach it only where its rule says that clay takes a hand, and they go
    // first so the rule can tell a hand is on it; clay with no rule takes them
    // below, exactly as it always has.
    if(station.rule){handRule(game,station,dt,input,{live:live&&!input.shapeReset});applyRule(game,station,dt,{near:station===near});}
    // Terrain that works itself: once the channel it waits on is open, the
    // station's full pose is its target and the clay advances at the pace a
    // hand would set it, with no hand on it. Hands, taps, stomps and R do
    // nothing to such a station, so what it does is always the level's doing.
    // It is heard once, as it starts to move, not for as long as it moves.
    if(station.auto&&(game.latched[station.auto]||game.channels[station.auto]>0)&&station.target<1){station.target=1;station.kneadPending=true;}
    if(live&&!station.auto){
      // R softens the clay back. Not under the player's own feet in a chapter,
      // though: a formable mass springing back to its clump would set them
      // inside a regrown tower or drop them onto the sand it had covered, so
      // there R waits until they have stepped off it.
      if(input.shapeReset){
        // In a chapter, R softens a formable mass only from off it: regrowing
        // the towers under a player, or into one in the air over the clay,
        // would set them on top of the regrown clump.
        const mass=station.rule==='form'&&!L.playground&&L.platforms.find(q=>q.id===station.parts[0]);
        if(!(mass&&p.x>mass.x-1&&p.x<mass.x+mass.w+1))resetStation(station,game);
      }
      // Ruled clay never falls through to here, whatever its rule returns, so
      // handRule is the only way a hand reaches it.
      else if(!station.rule){
        const before=station.target;
        if(input.shapeHeld)station.target=clampShape(station.target+dt*.65);
        if(input.shapeId===station.id&&Number.isFinite(input.shapeAmount))station.target=clampShape(input.shapeAmount);
        if(station.target!==before)station.worked=true;
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
      // Hand-worked clay keeps its volume on the way between its two poses, not
      // only at the ends: blending width and height separately swells a bough
      // pulled halfway to twice its clay. The width, slope and underside blend;
      // the height is whatever holds the blended volume. Ruled clay in the lab
      // decides its own shape and is left alone.
      if(!station.rule&&t>0&&t<1&&from.h!==undefined&&to.h!==undefined){
        const ramp=s.clayRole==='ramp',volume=q=>q.w*(q.h+(ramp?(q.slope||0)/2:0));
        const underside=lerp(from.y-from.h,to.y-to.h,t),wedge=ramp?(s.slope||0)/2:0;
        s.h=Math.max(.05,lerp(volume(from),volume(to),t)/s.w-wedge);s.y=underside+s.h;
      }
    }
    if(station.lift){
      const lift=L.platforms.find(p=>p.id===station.lift),whole=station.amount*station.amount*(3-2*station.amount);
      if(lift)lift.y=lerp(station.liftFrom,station.liftTo,whole);
    }
    if(station.amount>.995&&!station.announced){station.announced=true;game.event('shape',{id:station.id,x:p.x,y:p.y});}
    // A worked station can open a channel — wake a lift, a gate, a fold — the
    // first time it reaches its full pose. Ruled clay in the lab does this
    // from its own rule. Not on a restore's silent pass (dt 0): the save
    // carries the latch itself, so nothing is announced twice.
    if(station.channel&&!station.rule&&dt>0&&station.amount>.995&&!game.latched[station.channel])game.activate(station.channel,station.cueX??station.x,station.spawn.y);
    // Kneading is heard. `worked` is raised by whatever moved the clay this
    // tick and cleared here, heard or not, so work that stops is not heard on
    // after it stops; `kneadPending` is a stomp or a tap that landed between
    // ticks, and it waits its turn rather than being lost under a run.
    station.kneadTimer=Math.max(0,(station.kneadTimer||0)-dt);
    if((station.worked||station.kneadPending)&&!(station.kneadTimer>0)){
      station.kneadTimer=KNEAD_GAP;station.kneadPending=false;
      game.event('knead',{id:station.id,x:Number.isFinite(input.shapeX)?input.shapeX:p.x,y:p.y,rule:station.rule||null});
    }
    station.worked=false;
  }
}
// Landing hard on clay works it, whichever way that clay is meant to go: a
// stomp is an unmistakable "I am shaping this", and refusing it on a pull
// station just reads as the clay being broken.
export function stompClay(game,s){
  const station=(game.level.shaping||[]).find(t=>t.parts.includes(s.id));
  if(!station||station.auto)return;
  if(station.rule){stompRule(station,station.parts.indexOf(s.id));return;}
  if(station.target<1)station.kneadPending=true;
  station.target=clampShape(station.target+.5);
}
// A tap, or any touch too short to be a drag, still moves the clay. Without it
// the only way in is a long precise drag, and clay that ignores a tap looks
// like clay that is not interactive at all.
export function nudgeClay(game,id,part,point){
  const station=(game.level.shaping||[]).find(s=>s.id===id);
  if(station?.auto)return false;
  // Ruled clay takes a tap only where its rule takes a hand, and then on the
  // piece that was tapped — or, on clay with no pieces, where it was tapped.
  if(station?.rule)return nudgeRule(station,part,point);
  if(!station||station.target>=1)return false;
  station.target=clampShape(station.target+.3);station.kneadPending=true;return true;
}

// Softening a station back, whatever kind it is. In the lab a station that
// opened a channel when it was done closes it again, so the door it opened is
// shut and the experiment can be run afresh. In a chapter a channel, once
// opened, stays open like every other latch: the lift it woke keeps running
// and the fold it turned has already turned, whatever the clay does next.
export function resetStation(station,game=null){
  station.target=0;station.amount=0;station.announced=false;
  station.charge=0;station.launched=0;
  if(perPart(station)){station.targets.fill(0);station.amounts.fill(0);}
  if(station.give){resetGive(station.give);station.pressed=false;station.press=0;station.fall=0;station.punch=0;station.force=0;}
  if(station.rule==='form')resetFormStation(station);
  if(station.channel&&game?.level.playground){game.latched[station.channel]=false;game.channels[station.channel]=0;}
}

// --- walking on clay that has walls ------------------------------------------
// The formable mass is a heightfield the player can make as steep as a wall,
// and a heightfield collider on its own would carry a walker straight up a
// wall in one tick and straight down a cliff in the next. So: a rise ahead of
// the feet bigger than a step stops the walk, a drop bigger than a step lets
// the walker fall, and a body that has been walked or jumped into pushes back
// the way its visitor came.

// A grounded walker on the mass: returns true when the ground ahead is a wall
// and the step should not be taken.
export function formWallAhead(s,p,prevX,prevY,radius){
  if(!s.form||p.x===prevX)return false;
  const dir=Math.sign(p.x-prevX),lead=p.x+dir*radius;
  if(lead<=s.x||lead>=s.x+s.w)return false;
  // Only the columns make walls. On a mass that gives, the feet stand in a
  // dent of their own pressing, and the clay ahead, which is not pressed, would
  // read as a step up out of it: so the rise is taken between the columns, with
  // the layer's depth added back at both ends.
  const give=s.give?x=>giveDepth(s.give,x-s.x):()=>0;
  return claySurface(s,lead)+give(lead)-(prevY+give(prevX))>FORM.step;
}
// Whether the feet at x are on a face too steep to stand on: the clay climbs
// past `walk` under both feet, the same way. The foot of a wall and the bottom
// of a bowl are not faces — one side is flat or rises the other way — so a
// player can stand against a wall they cannot climb. Nobody lands on a face
// and nobody stays on one; they slide down it to wherever it eases.
export function formSteepAt(s,x,radius){
  if(!s.form)return false;
  // The benches either end of the trough are walls of their own, so the clay
  // against one is always the bottom of a corner, never a face.
  const left=x-radius<s.x?-Infinity:claySurface(s,x)-claySurface(s,x-radius),right=x+radius>s.x+s.w?Infinity:claySurface(s,x+radius)-claySurface(s,x);
  return Math.sign(left)===Math.sign(right)&&Math.min(Math.abs(left),Math.abs(right))/radius>FORM.walk;
}
// Whether a walker who has moved to p.x should still be glued to the surface
// there, or has walked off an edge or onto a face too steep to stand on.
export function formStaysGrounded(s,p,radius){
  return !s.form||(claySurface(s,p.x)>=p.y-FORM.step&&!formSteepAt(s,p.x,radius));
}
// A player inside the body of the mass. If the clay rose into them from below
// they ride it up; otherwise they are walked back the way they came until they
// are clear, or to the block's edge.
export function resolveFormBody(s,p,prevX,radius){
  const f=s.form,top=x=>claySurface(s,x),clear=x=>top(x)<=p.y+.12;
  if(claySurface(s,p.x,true)<=p.y+.12){p.y=top(p.x);return;}
  // Only so far back: a visitor with no clear ground within a stride behind
  // them is in a pit, not against a face, and is set on the clay where they are.
  const dir=Math.sign(prevX-p.x)||-(p.facing||1),step=f.dx/2,reach=Math.ceil(1.2/step);
  let x=p.x;
  for(let i=0;i<reach;i++){
    const inside=x;x+=dir*step;
    if(x<s.x-radius||x>s.x+s.w+radius){
      p.x=dir<0?s.x-radius:s.x+s.w+radius;
      p.vx=dir<0?Math.min(0,p.vx):Math.max(0,p.vx);return;
    }
    if(clear(x)){
      // Close in on the face itself, so the push is only ever as far as the
      // visitor came in, never a whole march step.
      let lo=inside,hi=x;for(let k=0;k<8;k++){const mid=(lo+hi)/2;if(clear(mid))hi=mid;else lo=mid;}
      p.x=hi;p.vx=dir<0?Math.min(0,p.vx):Math.max(0,p.vx);return;
    }
  }
  p.y=top(p.x);
}
export function visitStation(game,id,{reset=false}={}){
  if(!game.level.playground||!['playing','paused'].includes(game.status))return false;
  const station=game.level.shaping.find(s=>s.id===id);if(!station)return false;
  if(reset)resetStation(station,game);
  game.checkpoint={x:station.spawn.x,y:station.spawn.y};game.checkpointId=station.spawn.groundId;game.respawnTimer=0;
  game.respawn();Object.assign(game.player,station.spawn,{health:3,invuln:1.4});
  game.sectionId=game.level.sections.findLast(s=>game.player.x>=s.x)?.id??0;
  return true;
}
