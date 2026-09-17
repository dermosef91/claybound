// Machine motion is part of the fixed-step simulation, including passenger carry.
const approach=(a,b,d)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
// The Soft Dream's small machines. A `sink` raft settles under a rider and
// floats back up when they leave; a `fold` panel turns from a deck into a wall
// (or back) once its channel opens. Defaults live here so the editor, the
// simulation and the audit all agree on what an unfilled field means.
export const SINK=Object.freeze({rate:1.2,drop:2});
export const FOLD=Object.freeze({duration:1.5,thickness:.9});
export function updateCavernMachine(s,p,time,dt,channels){
  if(s.kind==='gate'){
    const unlocked=channels[s.channel]>0;
    s.open=approach(s.open||0,unlocked?1:0,dt*1.8);
    // The grate stays solid until the opening is visibly clear.
    s.active=s.open<.95;
  }
  if(s.kind==='orbit'){
    // A cradle told to wait hangs at its rest pose until its channel opens,
    // then swings on its own clock from that moment, so it always sets off
    // smoothly from where it hung; shut again, it holds where it is.
    let clock=time;
    if(s.waitFor){if(channels[s.waitFor]>0)s.run=(s.run||0)+dt;clock=s.run||0;}
    const a=clock*Math.PI*2/(s.period||12)+(s.phase||0);
    s.orbitAngle=a;s.x=s.baseX+Math.cos(a)*(s.moveX||4);s.y=s.baseY+Math.sin(a)*(s.moveY||4);
  }
  if(s.kind==='ferry'){
    const occupied=p.groundId===s.id;
    s.emptyTime=occupied?0:(s.emptyTime||0)+dt;
    const weight=p.x-(s.x+s.w/2),dead=.42;
    s.drive=occupied&&Math.abs(weight)>dead?Math.sign(weight)*Math.min(1,(Math.abs(weight)-dead)/.55):0;
    // An abandoned ferry returns to the boarding dock, so a missed transfer
    // never strands a player in a side alcove or after a checkpoint restart.
    if(!occupied&&s.emptyTime>1.4)s.drive=s.x>s.baseX+.02?-1:0;
    s.velocity=approach(s.velocity||0,s.drive*(s.speed||3.2),dt*9);
    s.x=Math.max(s.baseX,Math.min(s.baseX+(s.travel||24),s.x+s.velocity*dt));
    if(s.x===s.baseX&&s.velocity<0||s.x===s.baseX+(s.travel||24)&&s.velocity>0)s.velocity=0;
  }
  if(s.kind==='sink'){
    // Weight alone moves it: it settles at `rate` while stood on, as far as
    // `drop`, and floats back at the same rate the moment it is empty. Slow
    // enough that a rider is carried down (the landing filter re-catches a
    // deck that falls less than .14 a tick), and it never harms anyone itself.
    const occupied=p.groundId===s.id;
    s.y=approach(s.y,occupied?s.baseY-(s.drop??SINK.drop):s.baseY,dt*(s.rate??SINK.rate));
  }
  if(s.kind==='fold')updateFold(s,channels[s.channel]>0,dt);
}

// --- a deck that folds up into a wall ------------------------------------------
// Progress runs 0→1 from the `from` pose to the `to` pose once the channel is
// open, over `duration` seconds, and never runs back: a fold is a one-way
// change to the room. Until halfway it collides as whatever it started as;
// past halfway, as what it is becoming. The deck pose is a thin one-way deck
// at y across [x,x+w]; the wall pose is a solid panel `thickness` wide standing
// on the pivot edge, from y up to y+w — the deck's length become its height.
export const foldIsWall=s=>(s.from==='wall')!==((s.fold||0)>=.5);
export function updateFold(s,open,dt){
  if(open)s.foldRun=(s.foldRun||0)+dt;
  s.fold=Math.min(1,(s.foldRun||0)/(s.duration||FOLD.duration));
  // Only the deck pose is standable; the wall pose is a body the wall passes
  // resolve. `active` is what the landing filter and the carry step read, so
  // a rider is carried until the panel passes upright, then let go.
  s.active=!foldIsWall(s);
}
// The wall body a folded panel presents, in the same shape the wall passes
// read a `wall` in: `x,w` across, `top` and `bottom`.
export function foldWall(s){
  const pivotX=s.pivot==='right'?s.x+s.w:s.x,half=FOLD.thickness/2;
  return {x:pivotX-half,w:FOLD.thickness,top:s.y+s.w,bottom:s.y};
}
// Every body the wall passes stop the player against: wall blocks, and fold
// panels standing up. A wall keeps exactly the arithmetic it always had.
export function wallBox(s){
  if(s.kind==='wall')return solidWall(s)?{x:s.x,w:s.w,top:s.y,bottom:s.y-solidDepth(s)}:null;
  if(s.kind==='fold')return foldIsWall(s)?foldWall(s):null;
  return null;
}

export const solidDepth=s=>s.kind==='wall'?(s.h??4):s.kind==='gate'?(s.h||10):11;
export const solidWall=s=>s.active!==false&&!s.broken&&['stone','gate','wall'].includes(s.kind);
