// Clay stop-motion is shot on twos: twelve poses a second, each held until the
// next, with nothing in between. That hold is the whole tell — a puppet that
// eases is a cartoon; one that cuts is clay. The simulation, the camera and
// where every puppet stands stay smooth, because the game still has to read at
// sixty; only the poses step, and every puppet on the set cuts to its next pose
// on the same frame, as it would under one camera.
export const STOP_MOTION_FPS=12;

// One clock for the whole set, kept on the world. `on` mirrors the setting so a
// view that cached the clock at creation follows a mid-game toggle; `step` is
// how far every pose advances this frame, `stepped` whether it advanced at all
// and `frame` counts the exposures, which is what the boil hashes on.
export const createPuppetClock=()=>({on:false,held:0,frame:0,step:0,stepped:false});

// Advance the shared clock by this frame's dt. With the setting off the poses
// take dt as they always did. With it on, nothing moves until a twelfth of a
// second has built up, then all of it is spent at once — the pose lands on the
// real elapsed time, so a held puppet never falls behind the world.
export function tickPuppets(w,dt){
  const c=w.puppetClock??=createPuppetClock();
  c.on=!!w.stopMotion;
  if(!c.on){c.held=0;c.step=dt;c.stepped=dt>0;return c;}
  c.held+=dt;
  if(c.held<1/STOP_MOTION_FPS-1e-9){c.step=0;c.stepped=false;return c;}
  c.step=c.held;c.held=0;c.frame++;c.stepped=true;return c;
}

// The time an animator advances its pose by this frame. Off the clock (or with
// the setting off) it is the frame's dt, clamped the way every animator already
// clamps it so a hitch cannot fling a pose; on the clock it is the exposure's
// worth, which may be a little over the twelfth when frames landed unevenly.
export function puppetStep(clock,dt){
  if(!clock?.on)return Math.min(dt,.05);
  return Math.min(clock.step,1/STOP_MOTION_FPS+.05);
}

// In clay animation the surface never quite holds still between exposures: the
// animator's hands were on the puppet, and its fingerprints crawl a hair from
// frame to frame. The relief reads through a live offset on each material, so
// the boil is that offset moved by a fraction of a millimetre, freshly for each
// exposure and deterministically from its number, and put back where the
// authored offset left it once the setting is off.
export const BOIL=.006;
const hash=(n,k)=>{const x=Math.sin(n*12.9898+k*78.233)*43758.5453;return x-Math.floor(x);};
export function boilPuppet(root,clock){
  const on=!!clock?.on;
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
      const n=clock.frame;
      offset.set(base[0]+(hash(n,1)-.5)*2*BOIL,base[1]+(hash(n,2)-.5)*2*BOIL,base[2]+(hash(n,3)-.5)*2*BOIL);
    }
  });
}
