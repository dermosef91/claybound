// The world answering as clay: slabs that give under a landing, and creatures
// pressed flat. Pure behaviour first, then the real simulation's landings and
// the real enemy views, so a regression in the wiring fails here.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {DENT,DENTABLE,dentable,give,kickDent,stepDent,dentScale,applyDent,FLATTEN,shatterTime,flattenPose,applyFlatten} from '../dist/clay-feel.js';
import {Game,FIXED_DT} from '../dist/simulation.js';

const settle=(view,seconds,dt=1/60)=>{const trace=[];for(let t=0;t<seconds;t+=dt){stepDent(view,dt);trace.push(view.dent);}return trace;};

// --- the spring -------------------------------------------------------------
{
  const view={};
  assert.equal(stepDent(view,1/60),false,'a resting slab does no work');
  kickDent(view,{impact:12,width:4});
  assert(view.dentV<0,'a landing pushes down');
  const trace=settle(view,1.2);
  const deepest=Math.min(...trace),highest=Math.max(...trace);
  assert(deepest<-.008,`the slab visibly gives (${deepest.toFixed(4)})`);
  assert(deepest>=-DENT.maxCompress,'but never past its compression cap');
  assert(highest>0,`it springs back past rest once — the clay overshoot (${highest.toFixed(4)})`);
  assert(highest<=DENT.maxStretch);
  const firstRest=trace.findIndex((d,i)=>i>5&&d===0);
  assert(firstRest>0&&firstRest/60<.9,`and settles in under a second (${(firstRest/60).toFixed(2)}s)`);
  assert.equal(view.dent,0);assert.equal(view.dentV,0);
  assert.equal(stepDent(view,1/60),false,'then goes back to doing nothing');
}
{
  // Heavier landings give more; a stomp gives more still; wide slabs give less.
  const peak=opts=>{const v={};kickDent(v,opts);return Math.min(...settle(v,.6));};
  assert(peak({impact:20,width:4})<peak({impact:6,width:4}),'a long fall dents deeper than a hop');
  assert(peak({impact:10,width:4,strong:true})<peak({impact:10,width:4}),'a stomp dents deeper than a landing');
  assert(peak({impact:10,width:24})>peak({impact:10,width:4}),'a long slab is stiffer than a short one');
  assert.equal(give(3.5),1);assert.equal(give(0),1);assert(give(35)<.11);
  assert.equal(peak({impact:40,width:1,strong:true}),-DENT.maxCompress,'the cap holds under an extreme stomp');
  // A clamped spring must not keep driving into the clamp.
  const pinned={};kickDent(pinned,{impact:60,width:1,strong:true});settle(pinned,.05);
  assert(!(pinned.dent===-DENT.maxCompress&&pinned.dentV<0),'no velocity left pushing into the cap');
  // Garbage in stays finite.
  for(const bad of [{impact:NaN},{impact:-5},{width:NaN},{}]){const v={};kickDent(v,bad);settle(v,.5);assert(Number.isFinite(v.dent)&&Number.isFinite(v.dentV));}
  const big={};kickDent(big,{impact:12,width:4});stepDent(big,5);assert(Math.abs(big.dent)<=DENT.maxCompress,'a hitch-sized step is bounded');
}
console.log('PASS the slab gives, overshoots once, settles, scales with weight and length, and stays bounded');

// --- volume and placement ---------------------------------------------------
{
  for(const d of [-DENT.maxCompress,-.05,0,.04,DENT.maxStretch]){
    const {sx,sy,sz}=dentScale(d);
    assert(Math.abs(sx*sy*sz-1)<1e-9,`volume is preserved at ${d}`);assert.equal(sx,sz);
  }
  assert(dentScale(-.1).sx>1,'squashed thinner, it spreads wider');
  const s={x:10,w:4},view={root:new THREE.Group(),dent:-.1};
  applyDent(view,s);
  const left=view.root.position.x,right=left+s.w*view.root.scale.x;
  assert(Math.abs((left+right)/2-(s.x+s.w/2))<1e-9,'it spreads about its centre, not from its left edge');
  assert.equal(view.root.position.y,0,'height is never moved, so the walking surface stays under the feet');
  view.dent=0;applyDent(view,s);assert.equal(view.root.position.x,s.x);assert.equal(view.root.scale.y,1);
}
{
  const plain={root:new THREE.Group()};
  for(const kind of DENTABLE)assert(dentable({kind},plain),kind);
  for(const kind of ['stone','lift','spring','timed','pulse','switch','bridge','wall','clay','gate','ferry','orbit','balance'])assert(!dentable({kind},plain),`${kind} keeps its own motion`);
  assert(!dentable({kind:'ledge'},{root:new THREE.Group(),ropes:[{}]}),'nothing hanging from ropes');
  assert(!dentable({kind:'ledge'},{root:new THREE.Group(),clay:{}}),'kneadable clay has its own breath');
  assert(!dentable({kind:'ledge'},{root:new THREE.Group(),springPad:{}}),'spring pads have their own bounce');
  assert(!dentable({kind:'ledge'},undefined),'a slab that is not built yet');
}
console.log('PASS volume is kept, the slab spreads about its centre, and only free-standing slabs dent');

// --- the real simulation reports which slab it landed on ---------------------
{
  const game=new Game();game.load(1);
  const events=[];game.onEvent=e=>events.push(e);
  const p=game.player;
  // Drop the player onto a ledge from height so the landing is a real one.
  const ledge=game.level.platforms.find(s=>s.kind==='ledge'&&s.w>=3);
  Object.assign(p,{x:ledge.x+ledge.w/2,y:ledge.y+3,vx:0,vy:0,groundId:null,coyote:0});
  for(let i=0;i<240&&!events.some(e=>e.type==='land');i++)game.tick(FIXED_DT,{});
  const land=events.find(e=>e.type==='land');
  assert(land,'the drop produced a landing');
  assert.equal(land.platformId,ledge.id,'the landing names the slab it hit');
  assert(land.impact>2,`with a real impact (${land.impact.toFixed(2)})`);
  const view={root:new THREE.Group()};
  assert(dentable(ledge,view));kickDent(view,{impact:land.impact,width:ledge.w,strong:land.strong});
  assert(Math.min(...settle(view,.6))<-.004,'and that landing is enough to see the slab give');
}
console.log('PASS a real landing names its slab and carries enough impact to dent it');

// --- pressed flat -----------------------------------------------------------
{
  const at=t=>flattenPose(t);
  assert.deepEqual(at(0),{sx:1,sy:1,sz:1,visible:true},'untouched at the moment of the stomp');
  const pressed=at(FLATTEN.press);
  assert(pressed.sy<.25&&pressed.sx>1.5&&pressed.sz>1.2,'pressed into a disc almost at once');
  assert(pressed.sx>pressed.sz,'spreading more across the screen than into it');
  const mid=at((FLATTEN.press+FLATTEN.shatter)/2);
  assert(mid.visible&&mid.sy<.25&&mid.sx>1.5,'held flat, visibly, for a beat');
  assert(FLATTEN.shatter-FLATTEN.press>=.24,'long enough to be seen at gameplay speed');
  assert(FLATTEN.shatter<.5,'but broken before the player has bounced out of frame');
  // There, flat, until it gathers itself: it never peels or re-inflates.
  for(let t=FLATTEN.press;t<FLATTEN.still;t+=.005){const pose=at(t);assert(pose.visible&&pose.sy<.25&&pose.sy>.1&&pose.sx>1.5,`still flat and still there at ${t.toFixed(3)}s`);}
  // Then the swell: thicker and narrower, monotonically, announcing the break.
  let lastY=-Infinity,lastX=Infinity;
  for(let t=FLATTEN.still;t<FLATTEN.shatter;t+=.005){const pose=at(t);assert(pose.visible&&pose.sy>=lastY-1e-9&&pose.sx<=lastX+1e-9,`swells at ${t.toFixed(3)}s`);lastY=pose.sy;lastX=pose.sx;}
  assert(lastY>FLATTEN.flat+.08&&lastX<FLATTEN.spread-.1,'the swell is visible, not a rounding error');
  assert(lastY<.5,'but the disc never stands back up');
  assert.equal(at(FLATTEN.shatter).visible,false,'gone the moment it breaks');assert.equal(at(5).visible,false);
  for(const bad of [NaN,-1,undefined])assert(at(bad).visible,'a bad clock stays at the start, not hidden');
  // Reduced motion: the same read, no wobble, a shorter hold.
  const calm=flattenPose(.2,{reducedMotion:true});
  assert.equal(calm.sy,FLATTEN.flat,'no settling wobble under reduced motion');
  assert.equal(shatterTime(false),FLATTEN.shatter);assert.equal(shatterTime(true),FLATTEN.calmShatter);assert(FLATTEN.calmShatter<FLATTEN.shatter);
  assert(flattenPose(FLATTEN.calmShatter-.01,{reducedMotion:true}).visible,'held under reduced motion too');
  assert.equal(flattenPose(FLATTEN.calmShatter,{reducedMotion:true}).visible,false,'and it breaks sooner');
  const root=new THREE.Group();applyFlatten(root,.2);assert(root.visible&&root.scale.y<.25);
  applyFlatten(root,2);assert.equal(root.visible,false);
}
console.log('PASS pressed flat in a blink, held flat for a beat, then gone the frame it breaks');

// --- the real enemy views use it --------------------------------------------
{
  const {animateEnemy}=await import('../dist/enemies.js');
  const view={root:new THREE.Group(),loaded:true,deathTime:0,mixer:{update(){}},action:{setEffectiveTimeScale(){}}};
  const e={x:5,y:2,dir:1,speed:1.5,alive:false};
  const frames=[];for(let i=0;i<60;i++){animateEnemy(view,e,1/60,'playing');frames.push({sy:view.root.scale.y,visible:view.root.visible});}
  assert(frames.slice(6,19).every(f=>f.visible&&f.sy<.25),'a stomped clayling lies flat on the deck, still visible');
  assert.equal(frames.at(-1).visible,false,'and is gone within a second');
  const gone=frames.findIndex(f=>!f.visible);assert(Math.abs((gone+1)/60-FLATTEN.shatter)<=1/60+1e-9,`gone on the shatter beat (${gone}), for clay-shatter.js to break`);
  const frozen=view.deathTime;animateEnemy(view,e,1/60,'paused');assert.equal(view.deathTime,frozen,'pausing holds the squash where it is');
  // A spore puff is pressed flat like the rest, and leaves in its own spores:
  // the cloud it throws when attacking is released around the disc instead.
  const {animateSpore}=await import('../dist/spore-puff.js');
  const motes=Array.from({length:6},()=>new THREE.Mesh()),cloud=new THREE.Group();
  for(const m of motes)cloud.add(m);
  const spore={root:new THREE.Group(),pose:new THREE.Group(),cloud,motes,deathTime:0,clock:0},dead={x:0,y:0,dir:1,alive:false};
  const reach=()=>motes.map(m=>m.position.length());
  for(let i=0;i<12;i++)animateSpore(spore,dead,1/60,'playing');
  assert(spore.pose.visible&&spore.pose.scale.y<.25,'a spore puff is pressed flat');
  assert(spore.cloud.visible&&motes.every(m=>m.scale.x>0),'and lets its spores go as it goes');
  const opening=reach();for(let i=0;i<8;i++)animateSpore(spore,dead,1/60,'playing');
  assert(reach().every((d,i)=>d>opening[i]),'the cloud keeps opening out around the body');
  assert.deepEqual(spore.cloud.scale.toArray(),[1,1,1],'pressing the body flat never squashes the cloud with it');
  const held=JSON.stringify(reach());animateSpore(spore,dead,1/60,'paused');
  assert.equal(JSON.stringify(reach()),held,'pausing holds the puff where it is');
  for(let i=0;i<50;i++)animateSpore(spore,dead,1/60,'playing');
  assert(!spore.cloud.visible&&!spore.pose.visible,'a beat later both the disc and the spores are gone');
  const {animateSpitter}=await import('../dist/spitter.js');
  const spitter={root:new THREE.Group(),deathTime:0,reducedMotion:false};
  for(let i=0;i<12;i++)animateSpitter(spitter,{x:0,y:0,dir:1,alive:false},1/60,'playing');
  assert(spitter.root.visible&&spitter.root.scale.y<.25&&spitter.root.scale.x>1.5,'an echo spitter is flattened, not shrunk away');
}
console.log('PASS claylings, spore puffs and echo spitters are pressed flat by the real enemy views');
