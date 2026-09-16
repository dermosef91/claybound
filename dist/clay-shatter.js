import * as THREE from './lib/three.module.js';
import {sculptClay} from './clay.js';
import {shatterTime} from './clay-feel.js';
import {surfaceAt} from './simulation.js';
import {disposeSporeParticle} from './spore-effects.js';

// What pressed clay does next. clay-feel.js presses a stomped creature flat;
// this module squirts two or three pellets out from under the press the moment
// it lands, waits while the disc is held and gathers itself, then breaks it
// into a handful of chunky clumps of the creature's own colour that tumble out,
// drop onto the deck below and lie there before sinking away. Everything here
// is a particle in the world's shared budget — no collider, nothing the
// simulation can see — and it all freezes with the game, because the particle
// step is given dt=0 while paused.

// Body colours measured from each creature's shipped base-colour map. The
// clayling and the drifter are re-pigmented by the orange shader, so they take
// the world's own orange material. The spitter is a patchwork of teal and
// orange, and the spore puff dark olive with cream spots, so about a third of
// their clumps come off in the second colour. `size` scales the pellets, clumps
// and their spread to the creature's body.
export const CLUMP_KINDS=Object.freeze({
  clayling:{material:'orange',size:.8},
  drifter:{material:'orange',size:1},
  bat:{color:0x1b4b92,size:.9},
  spore:{color:0x5b6428,accent:0xdcc1a4,size:1},
  spitter:{color:0x2e5a55,accent:0xc97a2e,size:1.05},
});
// Clumps are heavier than the dust the world already throws: they drop rather
// than drift, land with a squash instead of a bounce, and lie still. The last
// three tenths of a second shrink each piece into the deck; no transparent
// material is ever allocated for a fade. `reserve` keeps room in the shared
// budget for the clumps so the pellets can never crowd them out, and a shatter
// that still finds the budget full evicts the oldest dust to make its room —
// a creature that vanished without clumps would read as deleted again.
export const SHATTER=Object.freeze({budget:110,reserve:7,gravity:14,fade:.3,floorReach:7,edge:.05,bury:.85,press:.5,onDeck:.3});
const kindOf=kind=>CLUMP_KINDS[kind]||CLUMP_KINDS.clayling;
const nearestFlat=a=>a-Math.round(a/Math.PI)*Math.PI;
const smooth=t=>t*t*(3-2*t);

// One material per colour, made on first use and kept in w.mat so the world
// treats it as shared: build() and disposeBranch() never dispose it. The clay
// relief is added by w.mesh() the first time one is drawn, as for every other
// material in w.mat.
export function clumpMaterial(w,kind,accent=false){
  const spec=kindOf(kind);
  if(spec.material&&!accent)return spec.material;
  const name='clump-'+(CLUMP_KINDS[kind]?kind:'clayling')+(accent?'-accent':'');
  if(!w.mat[name]){
    const params={color:accent?spec.accent:spec.color,roughness:.98,metalness:0};
    if(w.bump){params.bumpMap=w.bump;params.bumpScale=.085;}
    w.mat[name]=new THREE.MeshStandardMaterial(params);
  }
  return name;
}

// Three lumpy balls, built once and retained like the crumble chips are. At
// 192 triangles each they are a fraction of the sphere the world's dust uses.
// The lump is a function of position alone, so the sphere's seam and pole
// vertices move together and the shape stays watertight.
const lump=(x,y,z,seed)=>1+.16*Math.sin(3.1*x+seed)*Math.sin(2.6*y+seed*.7+1.3)*Math.cos(2.3*z+seed*1.9);
export function clumpGeometry(w,variant=0){
  w.clumpGeometry??=[];
  const i=((variant%3)+3)%3;
  if(!w.clumpGeometry[i]){
    const g=new THREE.SphereGeometry(1,12,9),p=g.attributes.position;
    for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k),z=p.getZ(k),f=lump(x,y,z,i*2.7+1);p.setXYZ(k,x*f,y*f,z*f);}
    g.computeVertexNormals();
    const geo=sculptClay(w,g,{amplitude:.05});
    if(geo!==g)g.dispose();
    geo.computeBoundingSphere();
    w.assetGeometry??=new Set();w.assetGeometry.add(geo);
    w.clumpGeometry[i]=geo;
  }
  return w.clumpGeometry[i];
}

// The deck under a point that a falling clump could reach: live, unbroken,
// directly below and no more than a few units down. The deck itself is
// returned rather than a height, because its surface is read again every
// frame — lifts move, timed decks switch off, crumbling ones break, bridges
// sag and beams tilt, and the simulation's own surfaceAt already knows all of
// that.
export function floorBelow(platforms,x,y){
  let floor,top;
  for(const s of platforms||[]){
    if(s.active===false||s.broken||x<s.x||x>s.x+s.w)continue;
    const surface=surfaceAt(s,x);
    if(!(surface<=y+.06&&surface>=y-SHATTER.floorReach))continue;
    if(floor===undefined||surface>top){floor=s;top=surface;}
  }
  return floor;
}

const room=w=>Math.max(0,SHATTER.budget-w.particles.length);
function makeRoom(w,n){
  for(let i=0;room(w)<n&&i<w.particles.length;){
    const q=w.particles[i];
    if(q.kind==='clay-clump'){i++;continue;}
    w.fxRoot.remove(q.mesh);disposeSporeParticle(q);w.particles.splice(i,1);
  }
}
function launch(w,kind,mesh,name,life,q){
  mesh.name=name;mesh.receiveShadow=false;
  const particle={kind,mesh,life,maxLife:life,rest:false,pressed:false,squish:0,scale:mesh.scale.clone(),...q};
  w.particles.push(particle);return particle;
}

// Two or three pellets squirt out from under the press, one to each side, arc
// over and land beside the body: small next to the clumps, but big enough to
// be seen. Reduced motion keeps two and barely throws them.
export function popPellets(w,x,y,z,kind,{floor}={}){
  const calm=!!w.reducedMotion,spec=kindOf(kind),material=clumpMaterial(w,kind);
  const count=Math.max(0,Math.min(calm?2:2+Math.round(Math.random()),room(w)-SHATTER.reserve));
  for(let i=0;i<count;i++){
    const side=i<2?(i?1:-1):(Math.random()<.5?-1:1),r=(.045+Math.random()*.025)*spec.size;
    const m=w.mesh(clumpGeometry(w,i),material,w.fxRoot,x+side*.3*spec.size,y+r+.04,z+.05+(Math.random()-.5)*.2);
    m.scale.set(r*1.15,r,r);m.castShadow=false;
    launch(w,'clay-pellet',m,'Clay pellet',.6+Math.random()*.15,{
      vx:side*(calm?1.2:2.4+Math.random()*1.4),vy:calm?1.2:2+Math.random(),vz:(Math.random()-.5)*.4,
      spinX:0,spinZ:0,half:r,floor,form:1});
  }
}

// A body pressed onto a deck kicks up a little of the deck's dust: the same
// small puff the world throws for a step or a landing, on the cheap lump rather
// than the world's big sphere. Handled by the world's ordinary particle step.
export function stompDust(w,x,y,z,calm=false){
  if(!w.mat?.dust)return;
  const count=Math.min(calm?3:6,room(w));
  for(let i=0;i<count;i++){
    const r=.04+Math.random()*.05,m=w.mesh(clumpGeometry(w,i),'dust',w.fxRoot,x+(Math.random()-.5)*.5,y+.1,z+(Math.random()-.5)*.3);
    m.scale.setScalar(r);m.name='Stomp dust';m.castShadow=false;m.receiveShadow=false;
    w.particles.push({mesh:m,vx:(Math.random()-.5)*3,vy:Math.random()*2.4+.6,vz:(Math.random()-.5)*1.2,life:.55+Math.random()*.4});
  }
}

// The disc breaks into three to seven clumps: two large, the rest smaller,
// laid across the disc's footprint and thrown out from its middle. Each is a
// flattened lump — wider than tall, the way a clump lands — sized to the
// creature, and each starts as flat as the disc it came from and rounds back
// up over a few frames, clay springing back. Only the two big ones that will
// come to rest on a deck cast a shadow: that is what keeps them from looking
// pasted onto it. Reduced motion keeps three, dropped gently without tumbling.
// Returns how many were thrown.
export function shatterClay(w,x,y,z,kind,{floor}={}){
  const calm=!!w.reducedMotion,spec=kindOf(kind);
  const want=calm?3:3+Math.floor(Math.random()*5);
  makeRoom(w,3);
  const count=Math.min(want,room(w));
  for(let i=0;i<count;i++){
    const accent=!!spec.accent&&i%3===1;
    const r=(i<2?.15+Math.random()*.06:.075+Math.random()*.075)*spec.size;
    const sx=r*(1.2+Math.random()*.25),sy=r*(.8+Math.random()*.12),sz=r*(.95+Math.random()*.2);
    const u=(i+.5)/count-.5,out=Math.sign(u)||(i%2?1:-1);
    const m=w.mesh(clumpGeometry(w,i),clumpMaterial(w,kind,accent),w.fxRoot,x+u*1.1*spec.size+(Math.random()-.5)*.15,y+sy+.02,z+.06+(Math.random()-.5)*.25);
    m.scale.set(sx,sy,sz);m.rotation.set(calm?0:(Math.random()-.5)*.6,Math.random()*Math.PI*2,calm?0:(Math.random()-.5)*.6);
    m.castShadow=i<2&&floor!==undefined;
    const q=launch(w,'clay-clump',m,'Clay clump',.95+Math.random()*.3,{
      vx:calm?u*.6:out*(.7+Math.random()*1.3)+u*2.2,vy:calm?.8+Math.random()*.4:1.7+Math.random()*1.8,vz:calm?0:(Math.random()-.5)*.5,
      spinX:calm?0:(Math.random()-.5)*7,spinZ:calm?0:(Math.random()-.5)*9,half:sy,floor,form:0});
    // Drawn as flat as the disc from the first frame, before it rounds back up.
    updateClayClump(q,0);
  }
  return count;
}

// One step of a pellet or clump. Both fall; a piece with a deck under it lands
// there. Clay does not bounce: it squashes with the impact and lies still, any
// tilt left from the tumble eased out to the nearest flat face so the lump lies
// on its wide side with its underside on the surface. The deck is read live,
// so a lift carries its clumps with it and a piece whose deck breaks, switches
// off or ends under it falls on. The player landing back on the deck presses
// whatever lies under their feet flat and away. Over its last moments a piece
// shrinks, and a resting one sinks with its shrinking height so it never
// floats above the deck.
export function updateClayClump(q,dt,press){
  const m=q.mesh,s=q.floor;
  const deck=s&&s.active!==false&&!s.broken&&m.position.x>=s.x-SHATTER.edge&&m.position.x<=s.x+s.w+SHATTER.edge?surfaceAt(s,m.position.x):undefined;
  if(q.rest&&deck===undefined)q.rest=false;
  q.form+=(1-q.form)*(1-Math.exp(-dt*30));
  if(!q.rest){
    q.vy-=SHATTER.gravity*dt;
    m.position.x+=q.vx*dt;m.position.y+=q.vy*dt;m.position.z+=q.vz*dt;
    m.rotation.x+=q.spinX*dt;m.rotation.z+=q.spinZ*dt;
    if(deck!==undefined&&q.vy<=0&&m.position.y-q.half*SHATTER.bury<=deck){
      q.rest=true;q.squish=Math.min(1,-q.vy/4);q.vx=q.vy=q.vz=q.spinX=q.spinZ=0;q.deckX=s.x;
      m.rotation.x=nearestFlat(m.rotation.x);m.rotation.z=nearestFlat(m.rotation.z);
    }
  }else{
    const k=Math.exp(-dt*12);m.rotation.x*=k;m.rotation.z*=k;
    if(!q.pressed)q.squish*=Math.exp(-dt*9);
    // A lift carries what lies on it sideways as well as up.
    m.position.x+=s.x-q.deckX;q.deckX=s.x;
  }
  if(press&&!q.pressed&&q.kind==='clay-clump'&&Math.abs(m.position.x-press.x)<SHATTER.press&&Math.abs(m.position.y-q.half*SHATTER.bury-press.y)<.35){
    q.pressed=true;q.squish=1;q.life=Math.min(q.life,SHATTER.fade);
  }
  const fade=smooth(Math.max(0,Math.min(1,q.life/SHATTER.fade))),flat=1-q.form;
  const sy=q.scale.y*(1-.5*flat)*(1-.4*q.squish)*fade;
  m.scale.set(q.scale.x*(1+.25*flat)*(1+.22*q.squish)*fade,sy,q.scale.z*(1+.15*flat)*fade);
  if(q.rest)m.position.y=deck+sy*SHATTER.bury;
}

// Where a creature's pressed disc lies: its view root, or the node the view
// squashes when that is a child of the root. Both are direct children of the
// level, so their positions are already world positions.
export function squashOrigin(view){
  const root=view.root,node=view.squashNode||root,o={x:root.position.x,y:root.position.y,z:root.position.z};
  if(node!==root){o.x+=node.position.x;o.y+=node.position.y;o.z+=node.position.z;}
  return o;
}

// Called once per enemy per frame after its view has animated. The first frame
// a creature is dead squirts the pellets and, for a body pressed onto a deck
// rather than swatted in the air above one, a little of the deck's dust; the
// frame its clock reaches the shatter time — the same frame flattenPose hides
// the disc — breaks it. Both happen once. The deck below is found at the
// moment of death and remembered on the view, where the bat and the drifter
// read it to keep a sinking disc above it. `force` breaks the disc now, for a
// view that streaming is about to drop while it is still whole.
export function settleSquash(w,e,view,platforms=[],force=false){
  if(!view)return;
  if(e.alive){view.squashStage=0;return;}
  const stage=view.squashStage||0;
  if(stage>=2)return;
  const kind=e.kind||'clayling',calm=view.reducedMotion??!!w.reducedMotion;
  if(stage<1){
    const o=squashOrigin(view),floor=floorBelow(platforms,o.x,o.y);
    view.squashFloor=floor;view.squashFloorY=floor?surfaceAt(floor,o.x):undefined;view.squashStage=1;
    popPellets(w,o.x,o.y,o.z,kind,{floor});
    if(floor&&o.y-view.squashFloorY<SHATTER.onDeck)stompDust(w,o.x,view.squashFloorY,o.z,calm);
  }
  if(force||(view.deathTime||0)>=shatterTime(calm)){
    const o=squashOrigin(view);view.squashStage=2;
    shatterClay(w,o.x,o.y,o.z,kind,{floor:view.squashFloor});
  }
}
// Streaming keeps a dead creature's view until it has broken, so a re-scan
// during the hold cannot make the disc vanish with nothing to follow it.
export const squashPending=view=>!!view&&(view.squashStage||0)<2;
