// Clay stop-motion is shot on twos here: twelve poses a second, each held
// until the next, with nothing in between. That hold is the whole tell — a
// puppet that eases is a cartoon; one that cuts is clay. The simulation, the
// camera and where every puppet stands stay smooth, because the game still has
// to read at sixty; only the poses step, and every puppet on the set cuts to
// its next pose on the same frame, as it would under one camera.
export const STOP_MOTION_FPS=12;
export const BOIL=.006;

// What the Settings panel can turn while the game runs, at the values the look
// was tuned to by eye: twelve exposures, the prints crawling six thousandths of
// a unit, each puppet landing three thousandths off its mark, the lamp four per
// cent unsteady. Amounts are kept in whole numbers a slider can show —
// thousandths of a world unit for the boil and the wobble, a percentage for
// the flicker — and become the clock's units in applyStopMotionTuning.
export const TUNING_DEFAULTS=Object.freeze({fps:STOP_MOTION_FPS,boil:Math.round(BOIL*1000),creatures:true,wobble:3,flicker:4});
export const TUNING_RANGES=Object.freeze({fps:[4,24],boil:[0,20],wobble:[0,30],flicker:[0,8]});
export function normalizeTuning(saved){
  const t={...TUNING_DEFAULTS};
  if(saved&&typeof saved==='object'){
    for(const key of ['fps','boil','wobble','flicker']){
      const [lo,hi]=TUNING_RANGES[key],value=Number(saved[key]);
      if(Number.isFinite(value))t[key]=Math.min(hi,Math.max(lo,Math.round(value)));
    }
    if(typeof saved.creatures==='boolean')t.creatures=saved.creatures;
  }
  return t;
}

// One clock for the whole set, kept on the world. `on` mirrors the setting so a
// view that cached the clock at creation follows a mid-game toggle; `step` is
// how far every pose advances this frame, `stepped` whether it advanced at all
// and `frame` counts the exposures, which is what the boil, the wobble and the
// flicker hash on. The tunables ride on it too, so every animator that holds
// the clock sees a slider move on its next frame.
export const createPuppetClock=()=>({on:false,held:0,frame:0,step:0,stepped:false,
  fps:STOP_MOTION_FPS,boil:BOIL,creatures:true,wobble:TUNING_DEFAULTS.wobble/1000,flicker:TUNING_DEFAULTS.flicker/100,lit:false});

// Put the panel's numbers on the running world's clock.
export function applyStopMotionTuning(w,tuning){
  const t=normalizeTuning(tuning),c=w.puppetClock??=createPuppetClock();
  c.fps=t.fps;c.boil=t.boil/1000;c.creatures=t.creatures;c.wobble=t.wobble/1000;c.flicker=t.flicker/100;
  return c;
}

// Whether this animator is on the clock at all: the hero always is when the
// setting is on; a creature only while the Creatures switch is too.
const stepping=(clock,creature)=>!!clock?.on&&(!creature||clock.creatures);

// Advance the shared clock by this frame's dt. With the setting off the poses
// take dt as they always did. With it on, nothing moves until an exposure's
// worth of time (a twelfth of a second, as tuned) has built up, then all of it
// is spent at once — the pose lands on the real elapsed time, so a held puppet
// never falls behind the world.
export function tickPuppets(w,dt){
  const c=w.puppetClock??=createPuppetClock();
  c.on=!!w.stopMotion;
  if(!c.on){c.held=0;c.step=dt;c.stepped=dt>0;return c;}
  c.held+=dt;
  if(c.held<1/c.fps-1e-9){c.step=0;c.stepped=false;return c;}
  c.step=c.held;c.held=0;c.frame++;c.stepped=true;return c;
}

// The time an animator advances its pose by this frame. Off the clock (or with
// the setting off) it is the frame's dt, clamped the way every animator already
// clamps it so a hitch cannot fling a pose; on the clock it is the exposure's
// worth, which may be a little over when frames landed unevenly.
export function puppetStep(clock,dt,creature=false){
  if(!stepping(clock,creature))return Math.min(dt,.05);
  return Math.min(clock.step,1/clock.fps+.05);
}

// A pose that reads the simulation directly — a roll angle, a wind-up timer,
// a leap's velocity — would glide through a hold while the bones stood still.
// This is what such a pose should read this frame: on the clock, fresh from
// the simulation whenever the pose advances and otherwise what it read at the
// last exposure; off it, always the live value — a paused frame is not a hold.
export function heldSample(clock,view,step,read,creature=true){
  if(!stepping(clock,creature)||step>0||!view.held)view.held=read();
  return view.held;
}

const hash=(n,k)=>{const x=Math.sin(n*12.9898+k*78.233)*43758.5453;return x-Math.floor(x);};
const seed=name=>{let h=0;for(const ch of String(name??''))h=(h*31+ch.charCodeAt(0))%1000;return h;};

// Where a puppet is drawn: the simulation's position, smooth — a held pose on a
// moving body is what keeps the game readable — plus the wobble, the
// registration error of a real set. A puppet never lands back in exactly the
// same place, so each exposure carries its own small offset, constant until
// the next. Only on the clock; off it this is the live point.
export function placePuppet(clock,view,x,y,creature=false){
  const at=view.placed??={x:0,y:0,frame:-1,wx:0,wy:0};
  at.x=x;at.y=y;
  if(!stepping(clock,creature)||clock.wobble<=0){at.wx=at.wy=0;at.frame=-1;return at;}
  if(at.frame!==clock.frame){const n=clock.frame+seed(view.id??'hero');at.wx=(hash(n,4)-.5)*2*clock.wobble;at.wy=(hash(n,5)-.5)*2*clock.wobble;at.frame=clock.frame;}
  return {x:at.x+at.wx,y:at.y+at.wy,frame:at.frame};
}

// The exposure flicker: a real set's lamp never gives two frames exactly the
// same light. The key light is scaled about the theme's own power by a fresh
// hair each exposure, and handed back to the theme when the flicker is off.
export function exposeLight(w){
  const c=w.puppetClock,sun=w.sun,theme=w.theme;if(!c||!sun||!theme)return;
  if(c.on&&c.flicker>0){
    if(c.stepped||!c.lit)sun.intensity=theme.sunPower*(1+(hash(c.frame,6)-.5)*2*c.flicker);
    c.lit=true;
  }else if(c.lit){sun.intensity=theme.sunPower;c.lit=false;}
}

// In clay animation the surface never quite holds still between exposures: the
// animator's hands were on the puppet, and its fingerprints crawl a hair from
// frame to frame. The relief reads through a live offset on each material, so
// the boil is that offset moved by a fraction of a millimetre, freshly for each
// exposure and deterministically from its number and the material's name (so
// the puppets sharing a material agree, and different puppets differ), and put
// back where the authored offset left it once the setting — or the boil — is off.
export function boilPuppet(root,clock,creature=false){
  const on=stepping(clock,creature)&&clock.boil>0;
  // A puppet that was never boiled has nothing to put back: skip the walk.
  if(!on&&!root.userData.boiled)return;
  if(on&&!clock.stepped)return;
  root.userData.boiled=on;
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      const offset=m.userData.clay?.offset;if(!offset)continue;
      const base=m.userData.clayOffset||[0,0,0];
      if(!on){offset.fromArray(base);continue;}
      const n=clock.frame+seed(m.name),amp=clock.boil;
      offset.set(base[0]+(hash(n,1)-.5)*2*amp,base[1]+(hash(n,2)-.5)*2*amp,base[2]+(hash(n,3)-.5)*2*amp);
    }
  });
}
