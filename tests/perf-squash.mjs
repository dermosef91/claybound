// What a stomped creature costs. Like tests/perf.mjs this runs the real world
// update under a stubbed renderer, so it can count what a frame would submit
// — meshes, triangles, shadow casters, particles — and how long the CPU side
// takes, but not GPU time. The counts are deterministic and are asserted as
// gates; the timings are reported for comparison against a run of the same
// script on the same machine. Run with --expose-gc to also check that a live
// effect allocates nothing per frame:  node --expose-gc tests/perf-squash.mjs
import assert from 'node:assert/strict';
import {prepareSporeAsset} from '../dist/spore-puff.js';
import {prepareMotherPuff} from '../dist/mother-puff.js';
import {prepareBatAsset} from '../dist/bats.js';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {readPlayer,readGLB} from './load-player.mjs';
import {prepareEnemyAsset} from '../dist/enemies.js';
import {prepareCastleAsset} from '../dist/castle.js';
import {prepareCottageAsset} from '../dist/cottage.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {readFile} from 'node:fs/promises';
import {Game} from '../dist/simulation.js';
import {attachClay} from './load-clay.mjs';
import {attachCanyon} from './load-canyon.mjs';
import {attachWindmills} from './load-windmills.mjs';
import {attachForest} from './load-forest.mjs';
import {attachSpitter} from './load-spitter.mjs';
import {attachGrotto} from './load-grotto.mjs';
import {createCaveLights} from '../dist/cave-lighting.js';
import {attachDrifter} from './load-drifter.mjs';
import {prepareCityLaundry} from '../dist/city-laundry.js';
import {SHATTER,CLUMP_KINDS,clumpGeometry,settleSquash} from '../dist/clay-shatter.js';
import {FLATTEN} from '../dist/clay-feel.js';
import {burstDrifterLeaves} from '../dist/drifter-leaves.js';

const w=Object.create(World.prototype);
w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
w.camera=new THREE.OrthographicCamera(-11,11,6,-6,.1,160);
w.renderer={render(){},setRenderTarget(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
prepareEnemyAsset(w,await readGLB(new URL('../dist/assets/enemy.glb',import.meta.url)),await data('enemy-motion.json'));
prepareBatAsset(w,await readGLB(new URL('../dist/assets/bat.glb',import.meta.url)));
prepareCastleAsset(w,await readGLB(new URL('../dist/assets/castle.glb',import.meta.url)));
prepareCottageAsset(w,await readGLB(new URL('../dist/assets/cottage.glb',import.meta.url)));
prepareCloudAsset(w,await readGLB(new URL('../dist/assets/cloud.glb',import.meta.url)));
prepareCityLaundry(w,await readGLB(new URL('../dist/assets/city-laundry.glb',import.meta.url)));
await attachCanyon(w);await attachWindmills(w);await attachForest(w);await attachGrotto(w);await attachDrifter(w);
prepareSporeAsset(w,await readGLB(new URL('../dist/assets/spore-puff.glb',import.meta.url)));
for(const pose of ['idle','cast','friendly'])prepareMotherPuff(w,pose,await readGLB(new URL(`../dist/assets/mother-puff-${pose}.glb`,import.meta.url)));
await attachClay(w);await attachSpitter(w);

// The same submission walker as tests/perf.mjs: what the main pass and the
// shadow pass would draw.
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere();
const shadowCamera=()=>{const c=w.sun.shadow.camera;c.position.copy(w.sun.position);c.lookAt(w.sun.target.position);c.updateMatrixWorld(true);c.updateProjectionMatrix();return c;};
function submitted(){
  w.scene.updateMatrixWorld();w.camera.updateMatrixWorld();
  const count=(camera,shadow)=>{
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let drawn=0,triangles=0;
    w.scene.traverse(o=>{
      if(!o.visible||!o.isMesh||(shadow&&!o.castShadow))return;
      for(let p=o.parent;p;p=p.parent)if(!p.visible)return;
      if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if(!o.frustumCulled||frustum.intersectsSphere(sphere)){drawn++;const index=o.geometry.index,position=o.geometry.attributes.position;triangles+=Math.floor((index?index.count:position.count)/3);}
    });
    return {drawn,triangles};
  };
  const main=count(w.camera,false),shadow=count(shadowCamera(),true);
  return {draws:main.drawn,triangles:main.triangles,shadowDraws:shadow.drawn,shadowTriangles:shadow.triangles};
}
const median=list=>{const s=[...list].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const us=n=>(n*1000).toFixed(1).padStart(8);
const settle=()=>{for(let i=0;i<200;i++)w.updateParticles(1/60);};

// One chapter, camera held on a deck in the middle of it; the effect is thrown
// where the camera looks so the walker counts it.
const g=new Game();g.start(0);w.build(g.level,0,g.level.spawn.x);
w.viewW=22;w.viewH=12;w.landscape=true;w.reducedMotion=false;
const mid=g.level.sections[Math.min(2,g.level.sections.length-1)].x+20;
const deck=g.level.platforms.filter(s=>s.w>=3&&s.active!==false).sort((a,b)=>Math.abs(a.x+a.w/2-mid)-Math.abs(b.x+b.w/2-mid))[0];
const rest=deck.x+deck.w/2;
Object.assign(g.player,{x:rest,y:deck.y,vx:0});
w.cameraX=rest;w.cameraY=deck.y+2;w.syncVisible(g.level,rest,true);
for(let i=0;i<40;i++)w.render(g,1/60);
settle();
const at=(x,y,z)=>({x,y,z});
// One creature's whole death through the production path: a dead view whose
// clock is already past the beat makes settleSquash throw the pellets, the deck
// dust (only for a body pressed onto the deck) and the clumps in one call, so a
// frame can be counted with everything live at once. The drifter also gets the
// leaf burst its 'squish' event still throws. A bat dies in the air above the
// deck and a drifter rolling on it, as they do in play. (The spore puff's own
// cloud is part of its view, not a particle, and is unchanged.)
function death(kind,o){
  const view={root:new THREE.Group(),deathTime:9,reducedMotion:false};
  view.root.position.set(o.x,o.y+(kind==='bat'?2:kind==='drifter'?.64:0),o.z);
  if(kind==='drifter')burstDrifterLeaves(w,o.x,o.y);
  settleSquash(w,{alive:false,kind},view,g.level.platforms);
}
// What each replaced: the ten-ball dust puff the world used to throw on
// 'squish' for a clayling or bat, the two bursts the spitter got, the sixteen
// spore balls thrown over the spore puff's own cloud, and the drifter's leaf
// burst — which used to throw fourteen leaves and now throws ten, so its old
// figure is the current burst plus four leaves' worth.
function oldDeath(kind,o){
  if(kind==='spitter'){w.burst(o.x,o.y,'accent',12,.9);w.burst(o.x,o.y,'orangeLight',8,.7);}
  else if(kind==='spore')w.burst(o.x,o.y,'spore',16,.75);
  else if(kind==='drifter'){burstDrifterLeaves(w,o.x,o.y);burstDrifterLeaves(w,o.x,o.y);for(let i=0;i<6;i++){const q=w.particles.pop();w.fxRoot.remove(q.mesh);}}
  else w.burst(o.x,o.y,'dust',10,1);
}

// The three lump geometries are built once, on the first stomp of a session.
{
  const t0=performance.now();for(let i=0;i<3;i++)clumpGeometry(w,i);const built=performance.now()-t0;
  let triangles=0;for(let i=0;i<3;i++){const geo=clumpGeometry(w,i);triangles+=geo.index.count/3;}
  console.log(`clump geometry: three lumps, ${triangles} triangles in all, built once in ${built.toFixed(2)} ms`);
  assert(triangles/3<=200,'a clump is a cheap lump, not a full sphere');
}

console.log('\nper-death submission (peak over the effect, minus the resting frame):');
console.log('kind          meshes  triangles  shadow  |  old meshes  old triangles');
const base=submitted();
const rows=[];
for(const kind of Object.keys(CLUMP_KINDS)){
  const peak=(throwIt)=>{
    settle();assert.equal(w.particles.length,0);
    throwIt();
    let meshes=0,triangles=0,shadow=0;
    for(let i=0;i<120;i++){
      const s=submitted();
      meshes=Math.max(meshes,s.draws-base.draws);triangles=Math.max(triangles,s.triangles-base.triangles);shadow=Math.max(shadow,s.shadowDraws-base.shadowDraws);
      w.updateParticles(1/60);
    }
    assert.equal(w.particles.length,0,'the effect is over within two seconds');
    return {meshes,triangles,shadow};
  };
  const now=peak(()=>death(kind,at(rest,deck.y,.35))),old=peak(()=>oldDeath(kind,at(rest,deck.y,.35)));
  rows.push({kind,...now,oldMeshes:old.meshes,oldTriangles:old.triangles});
  console.log(`${kind.padEnd(13)}${String(now.meshes).padStart(7)}${String(now.triangles).padStart(11)}${String(now.shadow).padStart(8)}  |${String(old.meshes).padStart(12)}${String(old.triangles).padStart(15)}`);
  assert(now.meshes<=3+6+7+(kind==='drifter'?10:0),`${kind}: at most three pellets, six dust and seven clumps`+(kind==='drifter'?' plus its ten leaves':''));
  assert(now.shadow<=2,`${kind}: at most the two big clumps cast a shadow`);
  assert(now.triangles<=6600,`${kind}: never more than the old ten-ball dust puff submitted`);
}
// The drifter is the one creature that gains an effect rather than trading
// one: it keeps its leaves and now breaks into clumps as well, so it is held
// to the old puff's ceiling above rather than to its own old figure.
assert(rows.filter(r=>r.kind!=='drifter').every(r=>r.triangles<=r.oldTriangles),'every creature whose burst this replaces submits no more triangles at its death than before');

console.log('\nmany at once: the shared budget holds');
{
  settle();
  for(let i=0;i<8;i++)death('clayling',at(rest+i*.3,deck.y,.35));
  const s=submitted();
  console.log(`eight simultaneous deaths: ${w.particles.length} particles, +${s.draws-base.draws} meshes, +${s.triangles-base.triangles} triangles, +${s.shadowDraws-base.shadowDraws} shadow casters`);
  assert(w.particles.length<=SHATTER.budget);
  for(let i=0;i<30;i++)death('clayling',at(rest,deck.y,.35));
  assert(w.particles.length<=SHATTER.budget,'thirty more never exceed the budget');
  assert(w.particles.filter(q=>q.kind==='clay-clump').length>=3,'and the newest still has its clumps');
  settle();
}

console.log('\nCPU cost (median of many, microseconds):');
{
  const spawn=[];for(let i=0;i<60;i++){settle();const t0=performance.now();death('clayling',at(rest,deck.y,.35));spawn.push(performance.now()-t0);}
  settle();death('clayling',at(rest,deck.y,.35));for(let i=0;i<40;i++)w.updateParticles(1/60);
  const live=w.particles.length,step=[];for(let i=0;i<300;i++){const t0=performance.now();w.updateParticles(1/60,{x:rest+3,y:deck.y});step.push(performance.now()-t0);}
  const view={root:new THREE.Group(),deathTime:2,squashStage:2},e={alive:false};
  const idle=[];for(let i=0;i<200;i++){const t0=performance.now();for(let k=0;k<1000;k++)settleSquash(w,e,view,g.level.platforms);idle.push((performance.now()-t0)/1000);}
  const alive={root:new THREE.Group(),deathTime:0},living={alive:true};
  const living_=[];for(let i=0;i<200;i++){const t0=performance.now();for(let k=0;k<1000;k++)settleSquash(w,living,alive,g.level.platforms);living_.push((performance.now()-t0)/1000);}
  console.log(`one death thrown (pellets, dust, clumps)     ${us(median(spawn))} us`);
  console.log(`particle step with ${String(live).padStart(2)} live pieces resting  ${us(median(step))} us  (whole updateParticles, player pressing nearby)`);
  console.log(`settleSquash, broken creature, per call      ${us(median(idle))} us`);
  console.log(`settleSquash, living creature, per call      ${us(median(living_))} us`);
  settle();
}

console.log('\nsteady frame with the effect live vs. without (median of 300 world renders, ms):');
{
  settle();const quiet=[];for(let i=0;i<300;i++){const t0=performance.now();w.render(g,1/60);quiet.push(performance.now()-t0);}
  // Keep a death live for the whole measurement by re-throwing whenever it ends.
  const busy=[];let clock=0;
  for(let i=0;i<300;i++){if(w.particles.length===0){death('clayling',at(rest,deck.y,.35));clock=0;}const t0=performance.now();w.render(g,1/60);busy.push(performance.now()-t0);clock+=1/60;}
  console.log(`no effect ${median(quiet).toFixed(3)}   one death live ${median(busy).toFixed(3)}`);
  settle();
}

if(globalThis.gc){
  console.log('\nallocation: heap growth over 600 particle steps with a death resting on the deck (--expose-gc):');
  settle();death('clayling',at(rest,deck.y,.35));for(let i=0;i<40;i++)w.updateParticles(1/60);
  for(const q of w.particles)q.life=9;   // hold the pieces so nothing is freed mid-measure
  gc();gc();const before=process.memoryUsage().heapUsed;
  for(let i=0;i<600;i++)w.updateParticles(1/60,{x:rest+3,y:deck.y});
  gc();gc();const grown=process.memoryUsage().heapUsed-before;
  console.log(`${(grown/1024).toFixed(1)} KB retained after 600 steps`);
  assert(grown<64*1024,'a resting effect allocates nothing that survives a collection');
  settle();
}else console.log('\n(run with --expose-gc to check per-frame allocation)');
console.log(`\nshatter beat ${FLATTEN.shatter}s, reduced motion ${FLATTEN.calmShatter}s; clumps live ${(.95).toFixed(2)}–${(1.25).toFixed(2)}s after that.`);
console.log('PASS squash-and-shatter stays inside the effect budget and submits no more than the bursts it replaces');
