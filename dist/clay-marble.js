// A marble on the formable mass: a ball that rolls down whatever slope the clay
// has under it, is carried up when a hand raises the clay beneath it, and comes
// to rest in a hollow. Pure numbers, driven with the form it sits on, so the
// rule, the view and the tests read one marble.
//
// It is the clay that is worked, never the marble: the only way to move it is
// to change the ground under it — lean the ground, raise a step behind it,
// stomp a crater whose rim tips it on — which is the whole of the puzzle.
import {formHeight} from './clay-form.js';

export const MARBLE=Object.freeze({
  radius:.5,
  // The player's gravity, so it falls like everything else here.
  gravity:27,
  // Rolling resistance: a share of speed lost a second, and a steady braking
  // in units a second squared that brings a marble rocking in a bowl to a
  // stop in a couple of seconds rather than a slow forever. And the most it
  // ever rolls: a marble that never stopped would make the socket a lottery.
  drag:.5,roll:1.1,top:9,
  // Slower than `rest` on ground shallower than `flat` is standing still, and
  // standing still it stays: a marble does not creep off nearly level ground
  // on its own, so a shape that has caught it holds it until the ground
  // changes — but any real lean, a stomp crater's rim included, sets it going.
  rest:.2,flat:.12,
  // What a bench end gives back.
  bounce:.3,
  // How far either side of the ball the ground under it is read.
  probe:.3,
  // Seconds at rest in the socket before it counts as home.
  seat:.5,
  // A ball that goes over an open end leaves with at least this much speed:
  // a rock that crept off the edge would drop straight down the cliff face
  // instead of clearing it, and the puzzle is aimed at what lies past it.
  exit:4.5,
});

// A marble is boxed in by its benches unless the station names an open end
// (`spill:'right'` or `'left'`). Over that end it leaves the form for good:
// the clay can no longer reach it, and `resetMarble` does not bring it back.
export function createMarble(x,{radius=MARBLE.radius,spill=null}={}){
  const start=Number.isFinite(x)?x:2;
  return {start,x:start,vx:0,r:radius>0?radius:MARBLE.radius,spin:0,still:0,home:false,spill:spill==='left'||spill==='right'?spill:null,spilled:false};
}
export function resetMarble(m){if(m.spilled)return;m.x=m.start;m.vx=0;m.spin=0;m.still=0;m.home=false;}

// Where the marble's centre sits over the base of the form.
export const marbleHeight=(f,m)=>formHeight(f,m.x)+m.r;

// One fixed tick. `socket` is [left, right] in the form's own x, where the
// marble is home once it has sat still for `seat`. Returns whether it is at rest.
export function stepMarble(m,f,dt,socket=null){
  if(m.spilled)return false;
  const step=Math.max(0,Math.min(1/30,Number.isFinite(dt)?dt:0));
  if(!step)return Math.abs(m.vx)<MARBLE.rest;
  const e=MARBLE.probe,slope=(formHeight(f,m.x+e)-formHeight(f,m.x-e))/(2*e);
  const held=Math.abs(slope)<MARBLE.flat&&Math.abs(m.vx)<MARBLE.rest;
  if(held)m.vx=0;
  else {
    // Gravity along the surface, read back onto x: g·sinθ·cosθ.
    m.vx-=MARBLE.gravity*slope/(1+slope*slope)*step;
    m.vx*=Math.exp(-MARBLE.drag*step);
    const brake=MARBLE.roll*step;
    m.vx=Math.abs(m.vx)<=brake?0:m.vx-Math.sign(m.vx)*brake;
    m.vx=Math.max(-MARBLE.top,Math.min(MARBLE.top,m.vx));
  }
  m.x+=m.vx*step;
  // The benches either end of the trough are walls — unless that end is open,
  // where the ball rolls on at the edge's height until its centre is past the
  // brink and it is gone. `y` is where it left, over the base of the form.
  if(m.spill==='left'&&m.x<0)return spill(m,f,-1);
  if(m.spill==='right'&&m.x>f.w)return spill(m,f,1);
  if(m.x<m.r&&m.spill!=='left'){m.x=m.r;m.vx=Math.abs(m.vx)*MARBLE.bounce;}
  if(m.x>f.w-m.r&&m.spill!=='right'){m.x=f.w-m.r;m.vx=-Math.abs(m.vx)*MARBLE.bounce;}
  m.spin+=m.vx*step/m.r;
  const resting=m.vx===0||Math.abs(m.vx)<MARBLE.rest&&Math.abs(slope)<MARBLE.flat;
  m.still=resting?m.still+step:0;
  m.home=Array.isArray(socket)&&m.x>=socket[0]&&m.x<=socket[1]&&m.still>=MARBLE.seat;
  return resting;
}
function spill(m,f,dir){
  m.spilled=true;m.still=0;m.home=false;
  m.y=formHeight(f,m.x)+m.r;
  m.vx=dir*Math.min(MARBLE.top,Math.max(MARBLE.exit,Math.abs(m.vx)));
  return false;
}

// A spilled ball in the world. It has left the form's own x for world
// coordinates — `wx`,`wy` its centre, `vy` its fall — set by whoever owns the
// form, since only they know where the form stands. `decks` are the flat tops
// it can come down on ({id,x,w,top,breakable}); `walls` the solid faces its
// sides can meet ({x,w,top,bottom}). A breakable deck it comes down on is
// reported and passed through; any other stops it, and from then on it only
// rolls out along that top. Returns the decks it came down on this tick, the
// breakable ones first, for the owner to break.
export function stepRockFall(m,dt,{decks=[],walls=[]}={}){
  const step=Math.max(0,Math.min(1/30,Number.isFinite(dt)?dt:0));
  if(!step||!m.spilled)return [];
  if(m.landed){
    const brake=MARBLE.roll*2*step;
    m.vx=Math.abs(m.vx)<=brake?0:m.vx-Math.sign(m.vx)*brake;
    m.wx+=m.vx*step;m.spin+=m.vx*step/m.r;
    return [];
  }
  const prevY=m.wy;
  m.vy-=MARBLE.gravity*step;
  m.wx+=m.vx*step;m.wy+=m.vy*step;
  for(const b of walls){
    if(m.wy-m.r>=b.top||m.wy+m.r<=b.bottom)continue;
    if(m.vx>0&&m.wx+m.r>b.x&&m.wx<b.x){m.wx=b.x-m.r;m.vx=-Math.abs(m.vx)*MARBLE.bounce;}
    else if(m.vx<0&&m.wx-m.r<b.x+b.w&&m.wx>b.x+b.w){m.wx=b.x+b.w+m.r;m.vx=Math.abs(m.vx)*MARBLE.bounce;}
  }
  const hits=decks.filter(d=>m.wx>d.x&&m.wx<d.x+d.w&&prevY-m.r>=d.top-1e-6&&m.wy-m.r<=d.top).sort((a,b)=>b.top-a.top);
  const floor=hits.find(d=>!d.breakable);
  if(floor){
    m.wy=floor.top+m.r;m.vy=0;m.vx*=MARBLE.bounce;m.landed=true;m.groundId=floor.id;
    return hits.filter(d=>d.breakable&&d.top>=floor.top).concat([floor]);
  }
  m.spin+=m.vx*step/m.r;
  return hits;
}
