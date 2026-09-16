// How the world answers the player as clay rather than as stone. Two small,
// deterministic responses, kept apart from the renderer so they can be tested
// without one: a slab that gives under a landing and springs back past rest,
// and a creature that is pressed flat, stays pressed, then breaks apart.
//
// Neither moves a collider. Both freeze with the game and calm under reduced
// motion, because the point is that the material reads as soft — not that the
// screen moves more.

// --- a landing dents the slab ----------------------------------------------

// A spring with one visible overshoot: stiff enough to finish before the
// player's next step, damped enough not to ring. Compression is capped so a
// long fall reads as heavy without the deck appearing to fold in half.
export const DENT=Object.freeze({stiffness:190,damping:12,kick:.04,maxCompress:.03,maxStretch:.014});

// Only slabs the player stands on and whose view nothing else rescales every
// frame. Stone floors carry houses and landmarks; lifts hang from ropes; timed,
// pulse, switch and spring decks already own their own scale.
export const DENTABLE=new Set(['ledge','crumble','break']);

export function dentable(s,view){
  return !!view&&DENTABLE.has(s.kind)&&!view.clay&&!view.springPad&&!view.ropes?.length;
}

// A long slab is stiffer than a short one, the same way a long plank flexes
// less at any one point than a short board does under the same boot.
export const give=width=>1/Math.max(1,(Number(width)||0)/3.5);

export function kickDent(view,{impact=6,width=4,strong=false}={}){
  const force=Math.max(0,Number(impact)||0)*(strong?1.5:1);
  // Seed both fields, so even a landing too soft to push leaves a defined state.
  view.dent=view.dent||0;
  view.dentV=((view.dentV||0)-force*DENT.kick*give(width))||0;
  return view.dentV;
}

// Advance the spring. Returns whether it is still moving, so a caller can skip
// resting slabs entirely.
export function stepDent(view,dt){
  const d=view.dent||0,v=view.dentV||0;
  if(!d&&!v)return false;
  const step=Math.min(Math.max(0,dt),1/30);
  let velocity=v+(-DENT.stiffness*d-DENT.damping*v)*step;
  let dent=Math.max(-DENT.maxCompress,Math.min(DENT.maxStretch,d+velocity*step));
  // A clamp is a wall: stop pushing into it, or the next frame overshoots.
  if(dent===-DENT.maxCompress&&velocity<0)velocity=0;
  if(dent===DENT.maxStretch&&velocity>0)velocity=0;
  // Six ten-thousandths of the slab's height is below anything a screen can
  // show, so the tail is snapped to rest rather than integrated for another half
  // second of invisible work.
  if(Math.abs(dent)<6e-4&&Math.abs(velocity)<1e-2){dent=0;velocity=0;}
  view.dent=dent;view.dentV=velocity;
  return dent!==0||velocity!==0;
}

// Clay keeps its volume: squashed thinner, it spreads wider.
export function dentScale(dent){
  const sy=1+(Number(dent)||0),side=1/Math.sqrt(Math.max(.2,sy));
  return {sx:side,sy,sz:side};
}

// The deck's origin is its left edge at its walking surface, so height already
// compresses up towards the surface — feet never float above the slab. Width
// is re-centred so the slab spreads both ways rather than only to the right.
export function applyDent(view,s){
  const {sx,sy,sz}=dentScale(view.dent||0);
  view.root.scale.set(sx,sy,sz);
  view.root.position.x=s.x+s.w*(1-sx)/2;
}

// --- a creature is pressed flat ---------------------------------------------

// Pressed in a blink, held long enough to be seen, then the disc gathers itself
// and is gone — broken into the clumps clay-shatter.js throws from the same
// spot. The hold is still the point: a creature that vanishes on contact reads
// as deleted, one left pressed on the deck for a beat reads as squashed. Height
// drops to under a fifth, and the clay spreads more across the screen than into
// it, which is the axis a side-on camera can see. The swell before the break is
// an announcement: the disc thickens and draws in, so the clumps that follow
// have been led up to rather than cut to. Under reduced motion the hold is
// shorter and there is neither settling wobble nor swell.
export const FLATTEN=Object.freeze({press:.08,still:.32,shatter:.40,calmShatter:.30,flat:.18,spread:1.6,spreadZ:1.3,swellY:.30,swellX:1.42,swellZ:1.18});
export const shatterTime=reducedMotion=>reducedMotion?FLATTEN.calmShatter:FLATTEN.shatter;
const easeInOut=t=>t<.5?2*t*t:1-2*(1-t)*(1-t);

export function flattenPose(time,{reducedMotion=false}={}){
  const t=Math.max(0,Number(time)||0);
  if(t>=shatterTime(reducedMotion))return {sx:0,sy:0,sz:0,visible:false};
  if(t<FLATTEN.press){
    // Eased in, so the first frames — the ones the hit-stop holds — show a
    // body half-crushed under the feet, and the collapse finishes as the
    // player lifts off it.
    const k=easeInOut(t/FLATTEN.press);
    return {sx:1+(FLATTEN.spread-1)*k,sy:1+(FLATTEN.flat-1)*k,sz:1+(FLATTEN.spreadZ-1)*k,visible:true};
  }
  // A clay disc settles once after the impact, then lies still. The settle has
  // died away to nothing visible by the time the swell begins.
  const since=t-FLATTEN.press,wobble=reducedMotion||t>=FLATTEN.still?0:Math.sin(since*38)*Math.exp(-since*12)*.035;
  let sx=FLATTEN.spread-wobble,sy=FLATTEN.flat+wobble,sz=FLATTEN.spreadZ-wobble*.6;
  if(!reducedMotion&&t>=FLATTEN.still){
    const k=(t-FLATTEN.still)/(FLATTEN.shatter-FLATTEN.still),swell=k*k;
    sx+=(FLATTEN.swellX-FLATTEN.spread)*swell;sy+=(FLATTEN.swellY-FLATTEN.flat)*swell;sz+=(FLATTEN.swellZ-FLATTEN.spreadZ)*swell;
  }
  return {sx,sy,sz,visible:true};
}

export function applyFlatten(root,time,options){
  const pose=flattenPose(time,options);
  root.scale.set(pose.sx,pose.sy,pose.sz);root.visible=pose.visible;
  return pose;
}
