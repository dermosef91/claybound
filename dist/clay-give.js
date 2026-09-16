// A block of soft clay that gives under weight, as a row of springs across its
// top. Each node carries how far it is pressed in, how fast it is moving and how
// much of that press the clay has kept. Pure numbers and no Three.js, so the
// collider and the art read the same surface and the whole thing can be driven
// headlessly.
//
// It is tuned to read as heavy clay, not as jelly or water: it sinks smoothly,
// gives back only about a quarter of any press and keeps the rest, and never
// rings, sloshes, throws or leaves a wake.
//
// Depth is measured downwards from the block's authored top: positive is
// pressed in, negative is clay swelling up beside a dent.

export const GIVE=Object.freeze({
  // One node every fifth of a unit: finer than a foot, so a dent is a curve and
  // not a staircase, and few enough that a tick costs nothing.
  spacing:.22,
  // The weight of a standing player, spread under the feet. It is tuned for the
  // settled depth, not taken from a mass: standing still should sink the feet
  // about a player-height and a third below the shoulders it pushes up. The
  // spread is wide so the dent is one broad valley on its own, without leaning
  // on the pull between neighbours, which is what carries a press sideways
  // like a liquid.
  weight:729,foot:1.6,
  // A stiff spring back and only a light pull between neighbours, so a press
  // stays where it was made. Then two dampings, both at or past critical:
  // sinking settles inside half a second past an overshoot too small to see,
  // and coming back is damped harder still, so what little the clay gives back
  // it gives back without a swing. A node carrying `hold` of weight sets at
  // half the rate of one fully under the feet.
  stiffness:90,tension:12.5,damping:18,recovery:24,hold:4,
  // Short ripples damp much faster than the whole dent does. Without it the
  // surface shivers node by node, which reads as a mesh rather than as clay.
  viscosity:.25,
  // Clay pushed aside rises beside the dent into soft shoulders: wherever the
  // broad average of the press is deeper than the close one, which is just
  // outside a dent's walls and nowhere else.
  bulge:3.2,wide:1.15,close:.33,
  // The "set": whatever weight presses in past `yield` is kept, quickly, so
  // the clay only ever gives back that much. A stand keeps most of its dent, a
  // walk keeps most of its trough as a track, and a stomp keeps most of its
  // crater, up to a cap that still leaves a way to walk out. Shaped means a
  // stand's worth of kept dent.
  creep:25,yield:.28,setMax:2.6,shaped:1.4,
  // Hard limits. The benches on either side hold the ends of the block up, so
  // near an end the clay can neither sink into a step nor swell into a lip the
  // player would catch on when walking on or off.
  maxDepth:3.4,maxRise:.5,endRise:.1,endReach:.6,edgeGap:.25,edgeSlope:1.1,edgeHard:6,
  // The deepest stretch is cushioned, so a crater bottoms out round instead of
  // flattening against the limit.
  cushion:1,cushionStiff:250,
  // A landing presses harder than standing, in proportion to the fall, and a
  // stomp presses harder still; both fade within a few tenths of a second. They
  // are scaled with the spring, so a stomp still presses about a unit past a
  // stand.
  landing:18,landingMax:12,stomp:3300,punch:.12,
  // No part of the surface sinks faster than this. Feet riding clay that drops
  // too far in one tick lose the ground under them, so a crater has to be
  // pressed in rather than knocked in. A sudden push spreads about a unit.
  sink:12.5,kick:1,
  // Jumping out of a pressed dent gives a little of the press back, on top of
  // the ordinary jump. Only depth pressed past a settled stand counts, squared
  // and capped low, so plain jumps and bounces stay plain and even a jump from
  // the deep of a stomp crater gets a nudge, never a throw. Clay already coming
  // back adds its speed, a tenth of a second's worth.
  reboundFrom:2.2,reboundGain:2.375,reboundMax:2,reboundLead:.1,
  // The push-off drives the clay in behind the jump, as surface speed per unit
  // of the player's take-off speed.
  recoil:.075,
});

const clamp=(n,lo,hi)=>n<lo?lo:n>hi?hi:n;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const finite=n=>Number.isFinite(n)?n:0,real=n=>typeof n==='number'&&Number.isFinite(n);

export function createGive(width){
  const w=Math.max(1,finite(width)),n=Math.max(3,Math.round(w/GIVE.spacing)+1),dx=w/(n-1);
  const make=()=>new Float64Array(n);
  const f={w,n,dx,depth:make(),velocity:make(),set:make(),previous:make(),load:make(),spread:make(),near:make(),
    floor:make(),ceiling:make(),keep:make(),envelope:make(),deepest:0,rest:true,held:false,version:0};
  for(let i=0;i<n;i++){
    const edge=Math.min(i*dx,w-i*dx);
    f.floor[i]=Math.min(GIVE.maxDepth,Math.max(0,edge-GIVE.edgeGap)*GIVE.edgeSlope);
    f.ceiling[i]=GIVE.endRise+(GIVE.maxRise-GIVE.endRise)*smooth(GIVE.endReach,GIVE.endReach+1,edge);
    f.keep[i]=Math.min(GIVE.setMax,f.floor[i]);
    f.envelope[i]=smooth(GIVE.edgeGap,2.2,edge);
    f.deepest=Math.max(f.deepest,f.floor[i]);
  }
  return f;
}

// Flatten everything: the press, the motion and the kept shape.
export function resetGive(f){
  for(const a of [f.depth,f.velocity,f.set,f.previous,f.load])a.fill(0);
  f.rest=true;f.version++;
}

// The surface at a local x, interpolated the same straight way the mesh joins
// its columns, so the feet and the drawn edge agree between nodes too.
function sample(f,a,x){
  const u=clamp(finite(x)/f.dx,0,f.n-1),i=Math.min(f.n-2,Math.floor(u)),t=u-i;
  return a[i]+(a[i+1]-a[i])*t;
}
export const giveDepth=(f,x,previous=false)=>sample(f,previous?f.previous:f.depth,x);
export const giveSet=(f,x)=>sample(f,f.set,x);
export const giveVelocity=(f,x)=>sample(f,f.velocity,x);

// Weight on the clay this tick, spread under a foot. Normalised over an endless
// surface rather than over the block, so weight near an end partly falls onto
// the bench beside it.
export function pressGive(f,x,weight=GIVE.weight,foot=GIVE.foot){
  if(!real(x)||!real(weight)||!(foot>0))return;
  const norm=weight/(foot*Math.sqrt(2*Math.PI)),lo=Math.max(0,Math.floor((x-foot*3.5)/f.dx)),hi=Math.min(f.n-1,Math.ceil((x+foot*3.5)/f.dx));
  for(let i=lo;i<=hi;i++){const u=(i*f.dx-x)/foot;f.load[i]+=norm*Math.exp(-.5*u*u);}
  if(lo<=hi)f.rest=false;
}

// A sudden push, in surface speed at its centre: positive drives the clay in.
export function kickGive(f,x,speed,spread=GIVE.kick){
  if(!real(x)||!real(speed)||!speed||!(spread>0))return;
  speed=clamp(speed,-40,GIVE.sink);
  const lo=Math.max(0,Math.floor((x-spread*3)/f.dx)),hi=Math.min(f.n-1,Math.ceil((x+spread*3)/f.dx));
  for(let i=lo;i<=hi;i++){const u=(i*f.dx-x)/spread;f.velocity[i]+=speed*Math.exp(-.5*u*u);}
  if(lo<=hi)f.rest=false;
}

// A rising player is in the way of clay springing back: the surface under their
// feet cannot pass them, and cannot rise faster than they do. Without this, the
// rebound catches a jump from below and the landing check calls it a landing.
export function holdUnder(f,x,feet,rise){
  if(!real(x)||!real(feet))return;
  rise=Math.max(0,finite(rise));
  const reach=.7,lo=Math.max(0,Math.floor((x-reach)/f.dx)),hi=Math.min(f.n-1,Math.ceil((x+reach)/f.dx));
  for(let i=lo;i<=hi;i++){
    const u=i*f.dx-x,least=feet+.02-.8*u*u;
    if(f.depth[i]<least){f.depth[i]=Math.min(least,f.floor[i]);if(f.velocity[i]<-rise)f.velocity[i]=-rise;f.rest=false;f.held=true;}
  }
  if(f.held){f.held=false;f.version++;}
}

// A symmetric running average, there and back, of how far the clay is pressed
// in. Swelling never feeds the average, or shoulders would grow shoulders.
function blur(from,to,n,a){
  let run=0;for(let i=0;i<n;i++){run=a*run+(1-a)*Math.max(0,from[i]);to[i]=run;}
  run=to[n-1];for(let i=n-1;i>=0;i--){run=a*run+(1-a)*to[i];to[i]=run;}
}

// One fixed tick. Returns whether the surface moved, so a view can skip the
// frames where it did not.
export function stepGive(f,dt){
  const {n,dx,depth:d,velocity:v,set,load,spread,near}=f;
  f.previous.set(d);
  if(f.rest){load.fill(0);return false;}
  const step=clamp(finite(dt),0,1/30);
  if(!step){load.fill(0);return false;}
  blur(d,spread,n,Math.exp(-dx/GIVE.wide));blur(d,near,n,Math.exp(-dx/GIVE.close));
  const k=GIVE.stiffness,T=GIVE.tension/(dx*dx),nu=GIVE.viscosity/(dx*dx);
  let moved=0,moving=0,loaded=0;
  // Velocities first from the old surface, then positions: semi-implicit, which
  // keeps a spring this stiff stable at the game's fixed step. The damping is
  // taken implicitly, so however heavy it is it only ever slows the clay.
  let dl=d[1],vl=v[1];
  for(let i=0;i<n;i++){
    const dr=i<n-1?d[i+1]:d[n-2],vr=i<n-1?v[i+1]:v[n-2],di=d[i],vi=v[i];
    // Weight is measured against what the clay has kept. On a dent shallower
    // than this weight would press, it sinks exactly as deep as fresh clay; on
    // one deeper, the kept shape carries the weight and nothing moves, so a
    // stand never digs an old dent deeper and never lifts a crater back out.
    // How loaded a node is stays between 0 and 1 whatever nonsense weight it is
    // handed, or one bad press would poison the set.
    const held=load[i]>0?(load[i]<Infinity?load[i]/(load[i]+GIVE.hold):1):0;
    const stiff=k*(1+GIVE.edgeHard*(1-f.envelope[i]));
    const target=Math.max(0,set[i]-(load[i]<Infinity?load[i]:1e9)/stiff)-GIVE.bulge*f.envelope[i]*Math.max(0,spread[i]-near[i]);
    const deep=di-(GIVE.maxDepth-GIVE.cushion);
    const force=load[i]-stiff*(di-target)+T*(dl-2*di+dr)+nu*(vl-2*vi+vr)-(deep>0?GIVE.cushionStiff*deep*deep:0);
    dl=di;vl=vi;
    const free=vi+force*step;
    v[i]=Math.min(GIVE.sink,free/(1+(free<0?GIVE.recovery:GIVE.damping)*step));
    if(load[i])loaded=1;
    // Held under weight past what the clay gives back, the press stays.
    const flow=di-set[i]-GIVE.yield;
    if(held>0&&flow>0&&set[i]<f.keep[i])set[i]=Math.min(f.keep[i],set[i]+flow*held*GIVE.creep*step);
  }
  for(let i=0;i<n;i++){
    let di=d[i]+v[i]*step;
    if(!Number.isFinite(di)||!Number.isFinite(v[i])){di=set[i]||0;v[i]=0;}
    // A limit is a wall: stop pushing into it, or the next tick overshoots.
    if(di>f.floor[i]){di=f.floor[i];if(v[i]>0)v[i]=0;}
    if(di<-f.ceiling[i]){di=-f.ceiling[i];if(v[i]<0)v[i]=0;}
    moved=Math.max(moved,Math.abs(di-d[i]));moving=Math.max(moving,Math.abs(v[i]));
    d[i]=di;
  }
  load.fill(0);
  // Below a few thousandths of a unit a second nothing on screen moves, so the tail
  // is dropped rather than integrated forever.
  if(!loaded&&moving<4e-3&&moved<5e-5){v.fill(0);f.rest=true;}
  if(moved>0)f.version++;
  return moved>0;
}

// How set the clay is: its deepest kept press, as a share of a stand's worth.
// One good stand sets it, which is the moment the experiment is named for.
export function giveShare(f){
  let kept=0;for(let i=0;i<f.n;i++)kept=Math.max(kept,f.set[i]);
  return clamp(kept/GIVE.shaped,0,1);
}
