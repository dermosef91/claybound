// The pilot for a plug station — the Clay Lab's Fix the Structure brought to a
// chapter (clay-rules.js initFix): a rotten corner to stomp out, a block to
// push into the gap it leaves, and the seated lump to cast flat to the line.
// This is the choreography tests/clay-lab-puzzles.mjs walks by hand on bench
// 11, as a controller over the live game: a generator that yields one input at
// a time and reads the game again after the caller has ticked it, so the
// recording a playthrough keeps is raw input and nothing else, like every
// other pilot in this directory. It never edits position, channels or hazards.
//
// The order is a player's, arriving from the block's far side: hop onto the
// block and off it, stomp the rot from the corner and land back on it, hop
// back over the block, push it into the open gap, wait for it to seat and
// settle, then stroke the columns to the mould. Where a beat does not land
// (the hop misses, the stomp puts the player in the gap) the pilot gives up
// and yields nothing more; the search reads the station still unshaped.
import {FIXED_DT as dt} from '../dist/simulation.js';
import {formHeight} from '../dist/clay-form.js';

const frames=seconds=>Math.round(seconds/dt);
const clamp=v=>Math.max(-1,Math.min(1,v));

export function* fixPilot(g,station,{budget=frames(90)}={}){
  const P=id=>g.level.platforms.find(q=>q.id===id);
  const s=P(station.parts[0]),fix=station.fix,rot=P(fix.rot),block=P(fix.block),p=g.player;
  if(!s||!rot||!block)return;
  let spent=0;const deaths=g.deaths;
  // Every input goes through here: past the budget, or with a death, the pilot
  // is done and the search will see the station unshaped.
  const out=input=>{spent++;return input;};
  const alive=()=>spent<budget&&g.deaths===deaths&&g.status==='playing';
  const idle=function*(n){for(let i=0;i<n&&alive();i++)yield out({moveAxis:0});};
  const walk=function*(x,seconds=4){
    for(let i=0;i<frames(seconds)&&alive();i++){const d=x-p.x;if(Math.abs(d)<.08&&p.groundId)return true;yield out({moveAxis:clamp(d*3)});}
    return false;
  };
  // A hop onto the block from the side `dir` comes from, then a walk off it on
  // the other side — the way over a lump taller than a step.
  const over=function*(dir){
    if(!(yield* walk(dir>0?block.x-.8:block.x+block.w+.8)))return false;
    yield* idle(3);
    yield out({moveAxis:dir,jumpPressed:true,jumpHeld:true});
    let on=false;
    for(let i=0;i<frames(1.2)&&alive();i++){
      const mid=block.x+block.w/2,short=dir>0?p.x<mid:p.x>mid;
      yield out({moveAxis:short?dir:dir*.2,jumpHeld:true});
      if(p.groundId===block.id){on=true;break;}
    }
    if(!on)return false;
    return yield* walk(dir>0?block.x+block.w+1.2:block.x-1.2);
  };
  // The rot: a jump from the corner beside it, a stomp over it, and the bounce
  // it gives is ridden back left onto the corner.
  const stomp=function*(){
    if(!(yield* walk(rot.x-1.2)))return false;
    yield* idle(5);
    yield out({moveAxis:1,jumpPressed:true,jumpHeld:true});
    for(let i=0;i<frames(.35)&&alive();i++)yield out({moveAxis:1,jumpHeld:true});
    yield out({moveAxis:.2,stompPressed:true});
    for(let i=0;i<frames(2)&&alive();i++){yield out({moveAxis:-.6});if(p.groundId&&i>20)break;}
    return rot.broken&&p.groundId&&p.groundId!==fix.floor;
  };
  const drag=function*(lx,dy,speed=.25){
    const base=s.y-s.h,hand=(x,y)=>out({moveAxis:0,shapeId:station.id,shapeX:s.x+x,shapeY:base+y});
    yield out({moveAxis:0});
    let ly=formHeight(s.form,lx);yield hand(lx,ly);
    const n=Math.max(1,Math.ceil(Math.abs(dy)/speed));
    for(let i=0;i<n&&alive();i++){ly+=dy/n;yield hand(lx,ly);}
    yield out({moveAxis:0});
  };

  if(fix.phase==='rot'){
    // Arriving on the block's near side, the corner is beyond it.
    if(p.x<block.x&&!(yield* over(1)))return;
    if(!(yield* stomp()))return;
  }
  if(fix.phase==='open'&&block.pushPhase==='free'){
    // Back over the block to its far side, and push.
    if(p.x>block.x+block.w&&!(yield* over(-1)))return;
    if(!(yield* walk(block.x-1.2)))return;
    for(let i=0;i<frames(8)&&alive()&&block.pushPhase==='free';i++)yield out({moveAxis:1});
    if(block.pushPhase!=='locking'&&block.pushPhase!=='locked')return;
  }
  // Seating and settling: the hand is refused until the lump has settled.
  for(let i=0;i<frames(3)&&alive()&&fix.phase!=='shaping'&&fix.phase!=='healed';i++)yield out({moveAxis:0});
  if(fix.phase!=='shaping')return;
  // The cast: at every other column, take hold and drag towards the line, in
  // passes, until the station reads the match as the mould.
  const f=s.form,cast=station.cast;
  for(let pass=0;pass<12&&!station.done&&alive();pass++){
    for(let i=1;i<f.n-1&&!station.done;i+=2){
      const d=cast[i]-f.h[i];if(Math.abs(d)<.05)continue;
      yield* drag(i*f.dx,Math.sign(d)*Math.min(Math.abs(d),.6));
    }
  }
  yield* idle(5);
}
