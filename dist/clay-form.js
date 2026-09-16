// A mass of clay with no pose at all: its top is a row of columns over a fixed
// base, and the player drags that top wherever they like. Pure numbers and no
// Three.js, so the collider and the mesh read one surface and the whole thing
// can be driven headlessly, the same way the sag block's springs are.
//
// Three promises hold every tick, whatever the hand does. The clay is one
// connected blob: every column keeps at least `minThick` of clay, so nothing
// ever tears. It keeps its volume: whatever a pull raises is drawn out of the
// columns around it, nearest first, and whatever a press sinks swells up beside
// the press, so a pillar digs its own moat and a bowl grows its own rim. And it
// stays usable: no column rises past `maxHeight`, no face is steeper than
// `slope`, no corner is tighter than `round`, and a pull is smoothed as it
// goes, so the hand can make ramps, walls, bowls, steps and bridges but never
// a needle, a knife edge or a sharp corner.
//
// Heights are measured upwards from the base the clay sits on: the platform's
// `y - h`. The surface at a local x is the height there. A mass in a trough
// keeps at least `minThick` of clay everywhere, since the trough's ends are
// benches; a free mass sitting on a bench may thin to nothing towards the ends
// of its footprint, so it reads as a lump on a surface rather than a slab let
// into it — but between its two ends it never thins past `minThick`, so it is
// still one lump, however far it is spread.

export const FORM=Object.freeze({
  // One column every quarter unit: fine enough that a step is a step and a bowl
  // is round, few enough that every pass below costs nothing.
  spacing:.25,
  // The least and the most clay over the base, anywhere. The floor is what
  // keeps the blob one blob; the ceiling is what keeps a pillar a puzzle.
  minThick:.35,maxHeight:8.5,
  // How far a grab reaches to either side, and the bump that fades it: the
  // clay under the fingers moves fully, the clay a reach away not at all.
  radius:2.4,
  // A hand pressing in from outside is a ball this big.
  tool:.82,
  // How far above or below the surface a touch still counts as taking hold of
  // the clay rather than pressing on it from the air.
  grab:.6,
  // The most the hand moves the clay in one tick. A flick still gets there,
  // over a few ticks, but the surface never leaps from under anyone's feet.
  maxMove:.3,
  // The steepest face a column may make with its neighbour, as rise per unit
  // of run. Steep enough for a wall, too shallow for a spike.
  slope:4.5,
  // The tightest corner the surface may turn, as a radius: every edge a pull or
  // a press would leave sharp is rounded off to at least this.
  round:.6,
  // A little smoothing under the hand as it works, so a pull is a mound and a
  // push a bowl rather than a stack of columns.
  smooth:.1,
  // Where displaced clay comes from and goes to: mostly from within `spread`
  // of the hand, with a small share from everywhere so a big pull still finds
  // material once its neighbourhood is at the floor.
  spread:2.2,far:.12,
  // Weight is a tool here too, lightly. A stand sinks the feet by `sag` at
  // most, at `sink` a second, a landing presses a little more in proportion to
  // the fall and a stomp more still, and the clay pushed aside rises beside the
  // boots: the Sag & Set behaviour, inside the one simulation.
  // Weight presses are bounded together: standing never digs past `sag`, and
  // landings and stomps never past `dentMax`, however many of them, until the
  // clay has slumped back and forgiven the dent.
  sag:.3,sink:.9,foot:.5,landing:.03,landingMax:.35,stomp:.75,dentMax:1.2,
  // A tap is a poke this deep.
  tap:.3,
  // A stomp into the clay craters it and throws the player straight back up,
  // the way the packed lump does — but the first time, every time. Straight up
  // this fast is about six and two-thirds units of height.
  launch:19,
  // Holding E raises a step ahead of the player at this rate, this wide: wide
  // enough that a step rounded to the corner limit can still stand a step tall.
  knead:1.4,stepReach:1.3,stepRadius:1.35,
  // Left alone — no hand on it, nobody standing on it — for `settle` seconds,
  // the clay slumps back towards its authored clump: exponentially with this
  // time constant, and never slower than `relaxMin` a second, so it does get
  // all the way home.
  settle:4,relaxTime:60,relaxMin:.04,
  // A rise ahead of the feet this big is a wall to walk into; anything less is
  // a slope to climb. A face steeper than `walk`, as rise per run, is a wall
  // all over: nobody lands on it or stands on it, they slide down it.
  step:.55,walk:1.7,
  // How much of the clay's volume has to have moved for the station to read
  // as shaped in the pause menu: about one full pillar's worth.
  shaped:.08,
});

const clamp=(n,lo,hi)=>n<lo?lo:n>hi?hi:n;
const finite=n=>Number.isFinite(n)?n:0,real=n=>typeof n==='number'&&Number.isFinite(n);
// The hand's falloff: a smooth bump, one at the centre and gone at the edge.
const kernel=u=>{u=Math.abs(u);if(u>=1)return 0;const v=1-u*u;return v*v;};

// The authored clump: a list of [u, top] knots across the mass, u from 0 at the
// left to 1 at the right and top as height over the platform's y, joined by
// smoothstep so the rest shape is already a soft lump.
export function restProfile(knots,u,depth){
  const list=(Array.isArray(knots)&&knots.length?knots:[[0,0],[1,0]]).map(k=>[clamp(finite(k[0]),0,1),finite(k[1])]).sort((a,b)=>a[0]-b[0]);
  if(u<=list[0][0])return depth+list[0][1];
  if(u>=list.at(-1)[0])return depth+list.at(-1)[1];
  let i=0;while(i<list.length-2&&u>list[i+1][0])i++;
  const [a,ya]=list[i],[b,yb]=list[i+1],t=b>a?(u-a)/(b-a):0,s=t*t*(3-2*t);
  return depth+ya+(yb-ya)*s;
}

export function createForm(width,depth,knots,{free=false}={}){
  const w=Math.max(1,finite(width)),n=Math.max(3,Math.round(w/FORM.spacing)+1),dx=w/(n-1);
  const make=()=>new Float64Array(n);
  const f={w,n,dx,free:!!free,floor:free?0:FORM.minThick,depth:Math.max(0,finite(depth)),h:make(),prev:make(),rest:make(),dent:make(),low:make(),scratch:make(),q:make(),volume:0,ref:0,idle:Infinity,settled:true,version:0};
  f.low.fill(f.floor);
  // The authored clump, then made to keep the same promises every shape the
  // hand makes keeps: no face too steep, no corner too sharp, nothing thinner
  // than the floor or taller than the ceiling, and all of a piece.
  for(let i=0;i<n;i++)f.h[i]=clamp(restProfile(knots,i*dx/w,f.depth),f.floor,FORM.maxHeight);
  for(let pass=0;pass<60;pass++){limitSlope(f);limitCurve(f);clampAll(f);keepWhole(f);}
  f.rest.set(f.h);f.prev.set(f.rest);
  f.volume=total(f.rest,n)*dx;
  // The height the mesh is built to, before its columns are stretched.
  let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,f.rest[i]);
  f.ref=Math.max(1,f.depth,peak);
  return f;
}

const total=(a,n)=>{let s=0;for(let i=0;i<n;i++)s+=a[i];return s;};
export const formVolume=f=>total(f.h,f.n)*f.dx;

// Back to the clump, all at once.
export function resetForm(f){
  f.h.set(f.rest);f.prev.set(f.rest);f.dent.fill(0);f.low.fill(f.floor);keepWhole(f);f.idle=Infinity;f.settled=true;f.version++;
}

// The surface at a local x, interpolated the same straight way the mesh joins
// its columns, so feet and drawn edge agree between nodes.
function sample(f,a,x){
  const u=clamp(finite(x)/f.dx,0,f.n-1),i=Math.min(f.n-2,Math.floor(u)),t=u-i;
  return a[i]+(a[i+1]-a[i])*t;
}
export const formHeight=(f,x,previous=false)=>sample(f,previous?f.prev:f.h,x);
export const formRest=(f,x)=>sample(f,f.rest,x);
export function formPeak(f){let top=0;for(let i=0;i<f.n;i++)top=Math.max(top,f.h[i]);return top;}

// How much of the clay has been moved from its clump, as a share of the work
// the station counts as shaped. Half the absolute difference, since every unit
// raised somewhere is a unit lowered somewhere else.
export function formShare(f){
  let moved=0;for(let i=0;i<f.n;i++)moved+=Math.abs(f.h[i]-f.rest[i]);
  return clamp(moved*f.dx/2/(f.volume*FORM.shaped),0,1);
}

// --- the passes every deformation goes through --------------------------------

function range(f,x,reach){
  return [Math.max(0,Math.floor((x-reach)/f.dx)),Math.min(f.n-1,Math.ceil((x+reach)/f.dx))];
}

// A little Laplacian smoothing under the hand only, in proportion to how far
// the hand moved: a slow stroke is many small moves, and smoothing each of them
// in full would wear away the very bump it is raising.
function smooth(f,x,radius,amount){
  const {h,scratch,dx}=f,[lo,hi]=range(f,x,radius),k=FORM.smooth*clamp(amount/.2,0,1);
  if(!k)return;
  scratch.set(h);
  for(let i=Math.max(1,lo);i<=Math.min(f.n-2,hi);i++){
    const w=kernel((i*dx-x)/radius);if(!w)continue;
    h[i]=scratch[i]+k*w*(scratch[i-1]-2*scratch[i]+scratch[i+1]);
  }
}

// No face steeper than the limit: clay is handed from the higher column to the
// lower until every neighbouring pair is inside it. Each hand-over conserves
// volume exactly.
// Both limits sweep until nothing moves, up to this many passes: enough for a
// stroke at the hand's top speed to settle inside the tick it was made.
const PASSES=32;

function limitSlope(f){
  const {h,n,low}=f,max=FORM.slope*f.dx;let moved=false;
  for(let pass=0;pass<PASSES;pass++){
    let any=false;
    for(let i=0;i<n-1;i++){
      const d=h[i+1]-h[i];
      if(Math.abs(d)<=max)continue;
      // The higher column gives; never more than it has above its floor.
      const hi=d>0?i+1:i,lo=d>0?i:i+1,ex=Math.min((Math.abs(d)-max)/2,h[hi]-low[hi]);
      if(!(ex>1e-12))continue;
      h[hi]-=ex;h[lo]+=ex;any=true;
    }
    if(!any)break;
    moved=true;
  }
  return moved;
}

// No corner tighter than the limit: where the surface turns too sharply the
// column is moved and its two neighbours moved the other way by as much
// between them, so the turn eases and the volume stays exactly as it was. The
// share is split evenly unless one neighbour is against the floor or the
// ceiling, in which case the other carries it: the foot of a lump on a bench
// is rounded by clay from the lump, not from the bare bench beside it.
function limitCurve(f){
  const {h,n,low}=f,max=f.dx*f.dx/FORM.round,top=FORM.maxHeight;let moved=false;
  for(let pass=0;pass<PASSES;pass++){
    let any=false;
    for(let i=1;i<n-1;i++){
      const d2=h[i-1]-2*h[i]+h[i+1];
      if(Math.abs(d2)<=max)continue;
      const want=Math.abs(d2-Math.sign(d2)*max)/3;
      if(d2>0){
        // A hollow corner: this column rises, the neighbours give.
        const d=Math.min(want,top-h[i]),roomL=Math.max(0,h[i-1]-low[i-1]),roomR=Math.max(0,h[i+1]-low[i+1]);
        let a=Math.min(d/2,roomL),b=Math.min(d-a,roomR);a=Math.min(d-b,roomL);
        if(!(a+b>1e-12))continue;
        h[i]+=a+b;h[i-1]-=a;h[i+1]-=b;
      } else {
        // A sharp crest: this column gives, the neighbours take.
        const d=Math.min(want,h[i]-low[i]),roomL=Math.max(0,top-h[i-1]),roomR=Math.max(0,top-h[i+1]);
        let a=Math.min(d/2,roomL),b=Math.min(d-a,roomR);a=Math.min(d-b,roomL);
        if(!(a+b>1e-12))continue;
        h[i]-=a+b;h[i-1]+=a;h[i+1]+=b;
      }
      any=true;
    }
    if(!any)break;
    moved=true;
  }
  return moved;
}

function clampAll(f){
  const {h,n,low}=f;
  for(let i=0;i<n;i++){if(!Number.isFinite(h[i]))h[i]=f.rest[i];h[i]=clamp(h[i],low[i],FORM.maxHeight);}
}

// One lump: between the first and the last column that carry real clay, no
// column thins past `minThick`, so a press through the middle of a free lump
// leaves a neck, never two lumps. That becomes each column's floor for the
// passes that follow, so putting the volume back cannot undo it. A mass in a
// trough has the floor everywhere already.
function keepWhole(f){
  if(!f.free)return;
  const {h,n,low}=f;
  let lo=0,hi=n-1;
  while(lo<n&&h[lo]<=FORM.minThick)lo++;
  while(hi>lo&&h[hi]<=FORM.minThick)hi--;
  for(let i=0;i<n;i++)low[i]=i>lo&&i<hi?FORM.minThick:f.floor;
  for(let i=lo+1;i<hi;i++)if(h[i]<FORM.minThick)h[i]=FORM.minThick;
}

// Put the volume back where it belongs. Whatever the last change added is
// taken from the columns with clay to spare; whatever it removed is given to
// the columns with room — nearest the hand first, with a small share from
// everywhere, and least of all from right under the hand: the edge of the
// hand's reach gives before its centre does, so a lump with nothing beyond the
// reach is drawn up narrower and taller rather than having its own crest taken
// back. Each pass respects the floor and the ceiling, so a few passes are
// enough; if the reach itself is all there is, the last passes take evenly.
function conserve(f,x,radius){
  const {h,n,dx,q}=f,local=real(x);
  let excess=total(h,n)*dx-f.volume;
  for(let pass=0;pass<10&&Math.abs(excess)>1e-9;pass++){
    const removing=excess>0;let sum=0;
    for(let i=0;i<n;i++){
      const room=Math.max(0,removing?h[i]-f.low[i]:FORM.maxHeight-h[i]);
      let g=1;
      if(local){const d=i*dx-x,w=kernel(d/radius),away=(1-w)*(1-w);g=(FORM.far+Math.exp(-d*d/(2*FORM.spread*FORM.spread)))*(pass<4?away:pass<7?away*.97+.03:1);}
      q[i]=room*g;sum+=q[i];
    }
    if(!(sum>0))break;
    const share=-excess/dx/sum;
    for(let i=0;i<n;i++)if(q[i])h[i]=clamp(h[i]+share*q[i],f.low[i],FORM.maxHeight);
    excess=total(h,n)*dx-f.volume;
  }
  return excess;
}

function finish(f,x,radius,{soften=0}={}){
  if(real(x)&&soften>0)smooth(f,x,radius,soften);
  limitSlope(f);limitCurve(f);clampAll(f);keepWhole(f);conserve(f,x,radius);
  // Putting the volume back can steepen a face or sharpen a corner a little;
  // the limits have the last word, and hand clay between neighbours without
  // changing the total.
  limitSlope(f);limitCurve(f);
  f.settled=false;f.version++;
}

// The limits on their own, for a surface that has just been worked: a stroke
// at the hand's top speed can leave a face or a corner a little past them for
// the tick it was made in, and this eases it the rest of the way over the ticks
// after, until nothing is left to do. Returns whether anything moved.
export function easeForm(f){
  if(f.settled)return false;
  const a=limitSlope(f),b=limitCurve(f);
  if(!a&&!b){f.settled=true;return false;}
  clampAll(f);keepWhole(f);conserve(f);limitSlope(f);limitCurve(f);
  f.version++;return true;
}

// --- the tools ----------------------------------------------------------------

// A grab: the clay within `radius` of local x follows the hand by (dxh, dyh),
// fully under the fingers and not at all at the edge of the reach. The sideways
// part carries the surface along with the hand, so a pillar dragged sideways
// leans into a ramp and a mound pulled apart stretches into a bridge; the
// upward part raises it, the downward part presses it.
export function pullForm(f,x,dxh,dyh,radius=FORM.radius){
  if(!real(x)||!real(dxh)||!real(dyh)||!(radius>0))return false;
  if(!dxh&&!dyh)return false;
  const {h,scratch,dx}=f,[lo,hi]=range(f,x,radius);
  scratch.set(h);
  for(let i=lo;i<=hi;i++){
    const w=kernel((i*dx-x)/radius);if(!w)continue;
    h[i]=sample(f,scratch,i*dx-dxh*w)+dyh*w;
  }
  finish(f,x,radius,{soften:Math.hypot(dxh,dyh)});
  return true;
}

// A press from outside: a ball of `radius` centred `top` over the base pushes
// down whatever clay it has entered. Moving it sideways inside the clay carves
// a channel. Returns whether it touched anything.
export function pressForm(f,x,top,radius=FORM.tool){
  if(!real(x)||!real(top)||!(radius>0))return false;
  const {h,dx}=f,[lo,hi]=range(f,x,radius);let touched=false;
  for(let i=lo;i<=hi;i++){
    const d=(i*dx-x)/radius;if(Math.abs(d)>=1)continue;
    const under=top-radius*Math.sqrt(1-d*d);
    if(h[i]>under){h[i]=Math.max(f.floor,under);touched=true;}
  }
  if(touched)finish(f,x,radius,{soften:.1});
  return touched;
}

// A poke: one tap dents the clay by `tap` where it landed, whether the tap was
// on the surface or in the air over it.
export function pokeForm(f,x,y){
  if(!real(x)||!real(y))return false;
  // The ball's underside lands `tap` below the surface, or below the point if
  // the tap was inside the clay.
  const top=Math.min(y,formHeight(f,x))-FORM.tap+FORM.tool;
  return pressForm(f,x,top,FORM.tool);
}

// Weight under the feet this tick: sinks the clay at `sink` a second, never
// more than `sag` in all for one stand, and only until the clay under the boots
// has given that. `punch` is extra depth pressed at once, for a landing or a
// stomp, with its own larger allowance, so no amount of jumping on one spot
// digs it to the floor.
export function sagForm(f,x,dt,punch=0){
  if(!real(x)||!(dt>=0))return false;
  const {h,dent,dx}=f,[lo,hi]=range(f,x,FORM.foot);let moved=false,sunk=0;
  for(let i=lo;i<=hi;i++){
    const w=kernel((i*dx-x)/FORM.foot);if(!w)continue;
    const stand=Math.min(FORM.sink*dt*w,Math.max(0,FORM.sag-dent[i])),take=stand+Math.min(Math.max(0,finite(punch))*w,Math.max(0,FORM.dentMax-dent[i]));
    if(take<=0)continue;
    const before=h[i];h[i]=Math.max(f.floor,h[i]-take);dent[i]+=before-h[i];sunk+=before-h[i];moved=true;
  }
  // No smoothing under the boots: it would fill the dent back in from its own
  // rim, tick after tick, past the allowance the dent is measured against.
  if(moved)finish(f,x,FORM.foot);
  // Whether the boots are still sinking in to any degree worth the name. The
  // edge of the foot keeps taking a trace long after the middle has settled,
  // and a stand must not read as kneading for that.
  return sunk>1e-3;
}

// The start of a tick: remember where the surface was, before any hand or boot
// moves it, so the swept collision checks see the whole of this tick's motion.
export function beginForm(f){f.prev.set(f.h);}

// One fixed tick with the hand and the boots accounted for. Left alone long
// enough, every column slumps back towards the clump, and what weight pressed
// in is forgiven at the same rate. Returns whether the surface moved.
export function stepForm(f,dt,{hand=false,standing=false}={}){
  const step=clamp(finite(dt),0,1/30);
  if(!step)return false;
  const eased=easeForm(f);
  f.idle=hand||standing?0:f.idle+step;
  if(f.idle<=FORM.settle)return eased;
  const {h,rest,dent,n}=f,k=1-Math.exp(-step/FORM.relaxTime),floor=FORM.relaxMin*step;
  let moved=0;
  for(let i=0;i<n;i++){
    const gap=rest[i]-h[i];
    if(gap){
      let d=gap*k;
      if(Math.abs(d)<floor)d=Math.sign(gap)*Math.min(floor,Math.abs(gap));
      h[i]+=d;moved=Math.max(moved,Math.abs(d));
    }
    dent[i]*=1-k;
  }
  if(moved>0){
    // Columns near home arrive before the rest, which would leave a shoulder
    // where a slumping pillar meets the clay around it; the same limits that
    // round a stroke round the slump. The exponential part keeps the volume
    // on its own; the floor does not quite, so the difference is spread evenly
    // over whatever has room.
    limitSlope(f);limitCurve(f);clampAll(f);keepWhole(f);conserve(f);f.settled=false;f.version++;
    return true;
  }
  return eased;
}
