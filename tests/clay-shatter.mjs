// A stomped creature is pressed flat, squirts pellets, then breaks into clumps
// of its own colour that drop onto the deck below and lie there. Pure pieces
// first — the floor finder, the particle step, the two throws — then the real
// enemy views and the real world render, so a regression in the wiring fails.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {Game,FIXED_DT,surfaceAt} from '../dist/simulation.js';
import {FLATTEN,shatterTime} from '../dist/clay-feel.js';
import {CLUMP_KINDS,SHATTER,clumpMaterial,clumpGeometry,floorBelow,popPellets,shatterClay,squashOrigin,settleSquash,squashPending} from '../dist/clay-shatter.js';
import {disposeBranch} from '../dist/streaming.js';

const light=(reducedMotion=false)=>{
  const w=Object.create(World.prototype);
  w.levelRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.particles=[];w.reducedMotion=reducedMotion;
  w.mat={orange:new THREE.MeshStandardMaterial({color:0xe64e1e}),cream:new THREE.MeshStandardMaterial(),orangeLight:new THREE.MeshStandardMaterial()};
  return w;
};
const clumps=w=>w.particles.filter(q=>q.kind==='clay-clump'),pellets=w=>w.particles.filter(q=>q.kind==='clay-pellet');
const run=(w,frames,dt=1/60)=>{for(let i=0;i<frames;i++)w.updateParticles(dt);};
// The visual underside of a piece: it lies buried by a fraction of its height.
const bottom=q=>q.mesh.position.y-q.mesh.scale.y*SHATTER.bury;
const deckAt=(deck,q)=>surfaceAt(deck,q.mesh.position.x);
// Clumps are thrown up to a unit and a half; one that flies past a narrow
// deck's edge falls away by design, so deck assertions look only at the rest.
const onDeck=q=>!!q.floor&&q.mesh.position.x>=q.floor.x-SHATTER.edge&&q.mesh.position.x<=q.floor.x+q.floor.w+SHATTER.edge;

// --- the deck below ---------------------------------------------------------
{
  const decks=[{x:0,w:4,y:0},{x:1,w:2,y:1},{x:0,w:4,y:-3},{x:10,w:2,y:0},{x:0,w:4,y:2.2,active:false},{x:0,w:4,y:1.5,broken:true}];
  assert.equal(floorBelow(decks,2,2.5),decks[1],'the highest live deck under the point; inactive and broken decks do not count');
  assert.equal(floorBelow(decks,.5,1.02),decks[0],'a deck the point is not over does not count');
  assert.equal(floorBelow(decks,2,.5),decks[0],'a deck above the point is not a floor');
  assert.equal(floorBelow(decks,2,1.02),decks[1],'a deck a hair below still is');
  assert.equal(floorBelow(decks,4.1,1),undefined,'just past the edge is air');
  assert.equal(floorBelow(decks,20,1),undefined,'nothing below: no floor, so the clumps fall away');
  assert.equal(floorBelow([{x:0,w:4,y:-20}],2,0),undefined,'a deck too far down is never reached in a clump\'s lifetime');
  const beam={x:0,w:4,y:0,kind:'balance',angle:.2};
  assert.equal(floorBelow([beam],3,2),beam);assert(Math.abs(surfaceAt(beam,3)-Math.sin(.2))<1e-9,'a tilted beam is floored at its tilted surface');
  assert.equal(floorBelow([],1,1),undefined);assert.equal(floorBelow(undefined,1,1),undefined);
}
console.log('PASS the deck below a squashed creature is found, or honestly not found');

// --- pellets ----------------------------------------------------------------
{
  const w=light(),deck={x:0,w:10,y:2};
  popPellets(w,5,2,.35,'clayling',{floor:deck});
  const p=pellets(w);
  assert(p.length>=2&&p.length<=3,`two or three pellets (${p.length})`);
  assert(p.every(q=>q.mesh.material===w.mat.orange&&q.mesh.name==='Clay pellet'),'in the clayling\'s own orange');
  assert(p.every(q=>q.mesh.scale.y>.03&&q.mesh.scale.y<.08),'tiny next to the clumps, but not a speck');
  assert(p.every(q=>w.assetGeometry.has(q.mesh.geometry)),'on the cheap retained lump, not the world\'s big sphere');
  assert(p.some(q=>q.vx<0)&&p.some(q=>q.vx>0),'one pops out to each side');
  assert(p.every(q=>Math.sign(q.mesh.position.x-5)===Math.sign(q.vx)),'each leaves from the side it flies to');
  assert(p.every(q=>!q.mesh.castShadow&&!q.mesh.receiveShadow),'pellets cast no shadows');
  const frozen=JSON.stringify(p.map(q=>q.mesh.position.toArray()));w.updateParticles(0);
  assert.equal(JSON.stringify(p.map(q=>q.mesh.position.toArray())),frozen,'a paused frame moves nothing');
  const start=p.map(q=>q.mesh.position.y);run(w,6);
  assert(p.every((q,i)=>q.mesh.position.y>start[i]),'they pop up first');
  let lowest=Infinity;const landed=p.map(()=>false);
  for(let i=0;i<40;i++){w.updateParticles(1/60);p.forEach((q,j)=>{lowest=Math.min(lowest,bottom(q)-2);if(q.rest)landed[j]=true;});}
  assert(landed.every(Boolean),'and land beside the body before they go');
  assert(lowest>=-1e-9,'never sinking through the deck');
  run(w,20);
  assert.equal(w.particles.length,0,'pellets are gone within a second');
  assert.equal(w.fxRoot.children.length,0,'leaving no mesh behind');
}
{
  // The shared budget: pellets leave room for the clumps that follow, and a
  // shatter that finds the budget full evicts the oldest dust rather than
  // letting the creature vanish with nothing to show for it.
  const w=light();
  const dummy=()=>{const m=new THREE.Mesh();w.fxRoot.add(m);w.particles.push({kind:undefined,mesh:m,life:9});};
  while(w.particles.length<SHATTER.budget-SHATTER.reserve+1)dummy();
  popPellets(w,0,0,0,'bat');assert.equal(pellets(w).length,0,'pellets never take the clumps\' reserve');
  while(w.particles.length<SHATTER.budget)dummy();
  const dust=w.particles.length;
  assert(shatterClay(w,0,0,0,'bat')>=3,'a full budget still breaks into at least three clumps');
  assert(w.particles.length<=SHATTER.budget,'inside the budget');
  assert(w.particles.filter(q=>q.kind===undefined).length<dust,'by retiring the oldest dust');
  assert.equal(w.fxRoot.children.length,w.particles.length,'whose meshes leave the scene with them');
  popPellets(w,0,0,0,'bat');shatterClay(w,0,0,0,'bat');
  assert(w.particles.length<=SHATTER.budget);
}
console.log('PASS two or three pellets pop out to both sides, land, and go without a trace; clumps always find room');

// --- clumps -----------------------------------------------------------------
{
  const w=light(),deck={x:0,w:10,y:2};
  shatterClay(w,5,2,.35,'bat',{floor:deck});
  const c=clumps(w);
  assert(c.length>=3&&c.length<=7,`three to seven clumps (${c.length})`);
  const material=w.mat['clump-bat'];
  assert(material&&c.every(q=>q.mesh.material===material),'one shared material for the bat, kept in w.mat');
  assert.equal(material.color.getHex(),CLUMP_KINDS.bat.color,'in the bat\'s own blue');
  assert(!material.transparent,'never a transparent material — the fade is a shrink');
  assert(c.every(q=>q.mesh.name==='Clay clump'&&!q.mesh.receiveShadow));
  assert.equal(c.filter(q=>q.mesh.castShadow).length,2,'only the two big clumps cast a shadow');
  assert(c.every(q=>w.assetGeometry.has(q.mesh.geometry)),'clump geometry is retained like the crumble chips');
  assert(new Set(c.map(q=>q.mesh.geometry)).size<=3,'from three lumpy shapes');
  assert(c.filter(q=>q.half>=.1).length>=2,'two of them are big');
  assert(c.every(q=>q.half>=.05),'none is a speck: these are chunks, not dust');
  assert(c.every(q=>q.scale.x>q.scale.y),'each is wider than tall, the way a clump lands');
  assert(c.every(q=>q.mesh.scale.y<q.scale.y*.6&&q.mesh.scale.x>q.scale.x),'and starts as flat as the disc it came from');
  assert(c.every(q=>Math.abs(q.mesh.position.x-5)<.75),'laid across the disc\'s footprint');
  assert(c.some(q=>q.vx<0)&&c.some(q=>q.vx>0),'thrown out both ways');
  assert(c.every(q=>q.vy>0&&q.floor===deck));
  const frozen=JSON.stringify(c.map(q=>[q.mesh.position.toArray(),q.mesh.scale.toArray()]));w.updateParticles(0);
  assert.equal(JSON.stringify(c.map(q=>[q.mesh.position.toArray(),q.mesh.scale.toArray()])),frozen,'a paused frame moves nothing');
  const spawn=c.map(q=>q.mesh.position.y);let rise=0,lowest=Infinity;
  for(let i=0;i<60;i++){
    w.updateParticles(1/60);c.forEach((q,j)=>{rise=Math.max(rise,q.mesh.position.y-spawn[j]);lowest=Math.min(lowest,bottom(q)-2);});
    if(i===9)assert(c.every(q=>Math.abs(q.mesh.scale.y-q.scale.y)<.03||q.rest),'rounded back up within a few frames');
  }
  assert(rise>.08,'they fly up');
  assert(lowest>=-1e-9,'and never sink through the deck');
  assert(c.every(q=>q.rest),'a second on, every clump has come to rest on the deck');
  assert(c.every(q=>Math.abs(bottom(q)-2)<1e-6),'lying with its underside on it');
  assert(c.every(q=>Math.abs(q.mesh.rotation.x)<.15&&Math.abs(q.mesh.rotation.z)<.15),'flat on its wide face');
  run(w,50);
  assert.equal(w.particles.length,0,'clumps are gone in under two seconds');
  assert.equal(w.fxRoot.children.length,0,'leaving no mesh behind');
  // Shared resources survive the world's own cleanup of a particle branch.
  shatterClay(w,5,2,.35,'bat',{floor:deck});
  let disposed=0;for(const r of [w.mat['clump-bat'],...w.assetGeometry])r.addEventListener('dispose',()=>disposed++);
  for(const q of clumps(w))disposeBranch(w,q.mesh);
  assert.equal(disposed,0,'disposeBranch never disposes the clump material or geometry');
  assert.equal(clumpGeometry(w,4),clumpGeometry(w,1),'variants wrap around the three shapes');
}
{
  // Every creature comes apart in its own colour.
  const w=light();
  shatterClay(w,0,0,0,'clayling',{});assert(clumps(w).every(q=>q.mesh.material===w.mat.orange),'clayling: the world\'s orange');
  w.particles=[];shatterClay(w,0,0,0,'drifter',{});assert(clumps(w).every(q=>q.mesh.material===w.mat.orange),'drifter: re-pigmented orange too');
  // Colours are judged by hue: three.js keeps them linear, so the numbers are not the hex digits.
  const hue=q=>q.mesh.material.color;
  w.particles=[];shatterClay(w,0,0,0,'bat',{});
  assert(clumps(w).every(q=>hue(q).b>hue(q).r&&hue(q).b>hue(q).g),'bat: blue');
  w.particles=[];shatterClay(w,0,0,0,'spore',{});
  const olive=clumps(w).filter(q=>hue(q).g>hue(q).r&&hue(q).g>hue(q).b*1.8),spots=clumps(w).filter(q=>hue(q).r>.5&&hue(q).r>hue(q).g&&hue(q).g>hue(q).b);
  assert(olive.length>=2&&spots.length>=1&&olive.length+spots.length===clumps(w).length,'spore puff: its olive-green cap with a cream spot or two, not the gold of its roughness map');
  w.particles=[];shatterClay(w,0,0,0,'spitter',{});
  const teal=clumps(w).filter(q=>hue(q).g>hue(q).r&&hue(q).b>hue(q).r),patch=clumps(w).filter(q=>hue(q).r>hue(q).g&&hue(q).g>hue(q).b);
  assert(teal.length>=2&&patch.length>=1&&teal.length+patch.length===clumps(w).length,'spitter: mostly teal with an orange patch or two');
  w.particles=[];shatterClay(w,0,0,0,'unknown',{});assert(clumps(w).every(q=>q.mesh.material===w.mat.orange),'an unknown kind falls back to clay orange');
  assert.equal(clumpMaterial(w,'bat'),clumpMaterial(w,'bat'),'materials are made once');
  assert(Object.values(w.mat).includes(w.mat['clump-spitter-accent']));
  assert(clumps(w).every(q=>!q.mesh.castShadow),'with no deck to lie on, nothing casts a shadow');
}
{
  // Nothing underneath: the clumps keep falling and are gone before they matter.
  const w=light();
  shatterClay(w,0,0,0,'bat');
  const c=clumps(w);run(w,60);
  assert(c.every(q=>!q.rest&&q.mesh.position.y<-1),'a bat over a pit sheds clumps that fall away');
  run(w,50);assert.equal(w.particles.length,0);
}
{
  // The deck is live: clumps ride a lift, fall when their deck breaks, fall off
  // its edge, and lie on a tilted beam at its tilted surface.
  const w=light(),lift={x:0,w:10,y:2,kind:'lift'};
  shatterClay(w,5,2,.35,'bat',{floor:lift});const c=clumps(w);run(w,45);
  assert(c.every(q=>q.rest));
  lift.y=3;w.updateParticles(1/60);
  assert(c.every(q=>Math.abs(bottom(q)-3)<1e-6),'resting clumps ride the lift they lie on');
  const xs=c.map(q=>q.mesh.position.x);lift.x+=.5;w.updateParticles(1/60);
  assert(c.every((q,i)=>Math.abs(q.mesh.position.x-xs[i]-.5)<1e-9),'and sideways with it');
  lift.broken=true;run(w,15);
  assert(c.every(q=>!q.rest&&q.mesh.position.y<3),'and fall when it breaks under them');
  const narrow={x:4.7,w:.6,y:2};w.particles=[];
  shatterClay(w,5,2,.35,'bat',{floor:narrow});const edge=clumps(w);run(w,50);
  assert(edge.every(q=>!q.rest||(q.mesh.position.x>=narrow.x-SHATTER.edge-1e-9&&q.mesh.position.x<=narrow.x+narrow.w+SHATTER.edge+1e-9)),'nothing rests on the air beside a narrow deck');
  assert(edge.some(q=>!q.rest&&q.mesh.position.y<1.5),'clumps thrown past its edge fall away');
  const beam={x:0,w:14,y:0,kind:'balance',angle:.25};w.particles=[];
  shatterClay(w,7,.2,.35,'bat',{floor:beam});const tilted=clumps(w);run(w,60);
  assert(tilted.filter(onDeck).length>=3&&tilted.filter(onDeck).every(q=>q.rest&&Math.abs(bottom(q)-deckAt(beam,q))<1e-6),'on a tilted beam each clump lies at the surface under it');
  w.particles=[];
}
{
  // The player landing back on the deck presses whatever lies under their feet.
  const w=light(),deck={x:0,w:10,y:2};
  shatterClay(w,5,2,.35,'bat',{floor:deck});const c=clumps(w);run(w,45);
  assert(c.every(q=>q.rest));
  for(const q of c)q.mesh.position.x=5;
  const before=c.map(q=>q.mesh.scale.y);
  w.updateParticles(1/60,{x:5.2,y:2});
  assert(c.every(q=>q.pressed&&q.life<=SHATTER.fade&&q.mesh.scale.y<before[0]*.7||q.mesh.scale.y<q.scale.y*.7),'pressed flat and on their way out');
  assert(c.every(q=>Math.abs(bottom(q)-2)<1e-6),'still on the deck as they flatten');
  run(w,25);assert.equal(clumps(w).length,0,'and gone under the player\'s feet');
  shatterClay(w,5,2,.35,'bat',{floor:deck});run(w,45);
  w.updateParticles(1/60,{x:8,y:2});assert(clumps(w).every(q=>!q.pressed),'feet elsewhere press nothing');
}
{
  // Reduced motion: fewer pieces, dropped gently, no tumbling.
  const w=light(true),deck={x:0,w:10,y:0};
  popPellets(w,0,0,0,'bat',{floor:deck});assert.equal(pellets(w).length,2);
  shatterClay(w,0,0,0,'bat',{floor:deck});assert.equal(clumps(w).length,3);
  assert(clumps(w).every(q=>q.spinX===0&&q.spinZ===0&&q.vz===0&&Math.abs(q.vx)<.5&&q.vy<1.3),'gentle and untumbled');
  const full=light();shatterClay(full,0,0,0,'bat',{floor:deck});
  assert(clumps(full).some(q=>q.spinX!==0),'while the full effect tumbles');
}
console.log('PASS three to seven chunky clumps in the creature\'s colour fly out, land, lie flat on a live deck and sink away');

// --- the beat ---------------------------------------------------------------
{
  const w=light();w.mat.dust=new THREE.MeshStandardMaterial();
  const view={root:new THREE.Group(),deathTime:0},e={alive:true};
  view.root.position.set(3,1,.35);
  const decks=[{x:0,w:6,y:1},{x:0,w:6,y:-2}];
  settleSquash(w,e,view,decks);assert.equal(view.squashStage,0);assert.equal(w.particles.length,0,'a living creature throws nothing');
  assert(squashPending(view)&&!squashPending(undefined),'a view that has not broken is pending; streaming only asks about the dead');
  e.alive=false;settleSquash(w,e,view,decks);
  assert.equal(view.squashStage,1);assert(pellets(w).length>=2,'the first dead frame pops the pellets');
  const dust=w.particles.filter(q=>q.kind===undefined);assert(dust.length>=1&&dust.length<=6,'and kicks up a little deck dust');
  assert.equal(view.squashFloor,decks[0],'and remembers the deck it died over');assert.equal(view.squashFloorY,1);
  assert(squashPending(view),'streaming keeps it until it has broken');
  assert.equal(clumps(w).length,0,'the disc is still whole');
  view.deathTime=.2;settleSquash(w,e,view,decks);assert.equal(clumps(w).length,0,'held');
  const before=pellets(w).length;
  view.deathTime=FLATTEN.shatter;settleSquash(w,e,view,decks);
  assert.equal(view.squashStage,2);assert(clumps(w).length>=3,'broken on the shatter beat');assert(!squashPending(view));
  assert.equal(pellets(w).length,before,'without popping the pellets again');
  assert(clumps(w).every(q=>q.floor===decks[0]&&Math.abs(q.mesh.position.x-3)<.75),'from where the disc lies, onto the deck under it');
  const count=w.particles.length;view.deathTime=2;settleSquash(w,e,view,decks);settleSquash(w,e,view,decks);
  assert.equal(w.particles.length,count,'and only once');
  e.alive=true;settleSquash(w,e,view,decks);assert.equal(view.squashStage,0,'a living creature resets the beat');
  settleSquash(w,e,undefined,decks);
  // Forced: a view about to be dropped breaks at once, whole hold or not.
  w.particles=[];const dropped={root:new THREE.Group(),deathTime:.05};dropped.root.position.set(3,1,.35);
  settleSquash(w,{alive:false},dropped,decks,true);assert.equal(dropped.squashStage,2);assert(clumps(w).length>=3&&pellets(w).length>=2,'a dropped view leaves its pellets and clumps behind');
  // Airborne: no deck, no dust.
  w.particles=[];const airborne={root:new THREE.Group(),deathTime:0};airborne.root.position.set(30,9,.35);
  settleSquash(w,{alive:false,kind:'bat'},airborne,decks);
  assert.equal(airborne.squashFloor,undefined);assert.equal(w.particles.filter(q=>q.kind===undefined).length,0,'a bat over nothing kicks up no dust');
  // Swatted in the air above a deck: the deck is found for the clumps to land
  // on, but no dust is kicked up from a deck the body never touched.
  w.particles=[];const above={root:new THREE.Group(),deathTime:0};above.root.position.set(3,2.5,.35);
  settleSquash(w,{alive:false,kind:'bat'},above,decks);
  assert.equal(above.squashFloor,decks[0]);assert.equal(w.particles.filter(q=>q.kind===undefined).length,0,'a bat above a deck kicks up no dust');
  assert(pellets(w).length>=2);
  // A creature whose view squashes a child node breaks where that node is.
  const pose=new THREE.Group();pose.position.set(0,.5,0);
  const bat={root:new THREE.Group(),squashNode:pose,deathTime:0};bat.root.position.set(7,2,.35);
  assert.deepEqual(squashOrigin(bat),{x:7,y:2.5,z:.35});assert.deepEqual(squashOrigin(view),{x:3,y:1,z:.35});
  // Reduced motion on the view breaks on its own, shorter beat.
  const calm={root:new THREE.Group(),deathTime:FLATTEN.calmShatter,reducedMotion:true},dead={alive:false,kind:'bat'};
  w.particles=[];settleSquash(w,dead,calm,[]);assert.equal(calm.squashStage,2,'a calm view breaks at its calm beat');
  const brisk={root:new THREE.Group(),deathTime:FLATTEN.calmShatter,reducedMotion:false};
  w.particles=[];settleSquash(w,dead,brisk,[]);assert.equal(brisk.squashStage,1,'a full-motion view is still held then');
  assert.equal(shatterTime(brisk.reducedMotion),FLATTEN.shatter);
}
console.log('PASS pellets and dust on the first dead frame, clumps on the shatter beat, each exactly once');

// --- the real views and the real render -------------------------------------
{
  const {readPlayer,readGLB}=await import('./load-player.mjs');
  const {createHero,attachHero}=await import('../dist/hero.js');
  const {prepareEnemyAsset,createEnemyView,animateEnemy,releaseEnemyView}=await import('../dist/enemies.js');
  const {prepareBatAsset}=await import('../dist/bats.js');
  const {prepareSporeAsset}=await import('../dist/spore-puff.js');
  const {prepareCastleAsset}=await import('../dist/castle.js');
  const {prepareCottageAsset}=await import('../dist/cottage.js');
  const {prepareCloudAsset}=await import('../dist/clouds.js');
  const {prepareCityLaundry}=await import('../dist/city-laundry.js');
  const {createCaveLights}=await import('../dist/cave-lighting.js');
  const {attachClay}=await import('./load-clay.mjs');
  const {attachCanyon}=await import('./load-canyon.mjs');
  const {attachWindmills}=await import('./load-windmills.mjs');
  const {attachForest}=await import('./load-forest.mjs');
  const {attachSpitter}=await import('./load-spitter.mjs');
  const {attachGrotto}=await import('./load-grotto.mjs');
  const {attachDrifter}=await import('./load-drifter.mjs');
  const {readFile}=await import('node:fs/promises');
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
  await attachClay(w);await attachSpitter(w);

  // Every kind of creature is pressed flat straight down where its body is and
  // breaks on the beat onto the deck under it.
  const g0=new Game();g0.start(0);w.build(g0.level,0,g0.level.spawn.x);w.viewW=22;w.viewH=12;w.landscape=true;w.reducedMotion=false;
  const kinds=[
    ['clayling',{},5,[5,5.2]],
    ['bat',{kind:'bat',aiState:'patrol'},3,[5.25,5.6]],
    ['spore',{kind:'spore',aiState:'idle',stateTime:0},5,[5,5.2]],
    ['spitter',{kind:'spitter',aiState:'watch',stateTime:0},5,[5,5.2]],
    ['drifter',{kind:'drifter',airBlend:0,rollAngle:.7},5-.64,[4.3,5]],
    ['drifter aloft',{kind:'drifter',airBlend:1,rollAngle:.7},2,[4.7,5.01]],
  ];
  for(const [name,fake,deckY,[low,high]]of kinds){
    const e={id:900,x:40,y:5,dir:1,speed:1,min:38,max:42,alive:true,...fake},view=createEnemyView(w,e),deck={x:30,w:20,y:deckY};
    animateEnemy(view,e,1/60,'playing');
    const node=view.squashNode||view.root;
    e.alive=false;
    for(let i=0;i<12;i++){animateEnemy(view,e,1/60,'playing');settleSquash(w,e,view,[deck]);}
    assert(node.visible&&node.scale.y<.25&&node.scale.x>1.5,`${name}: pressed flat`);
    assert.equal(node.rotation.x,0,`${name}: pressed straight down`);assert.equal(node.rotation.z,0);
    const o=squashOrigin(view);assert(Math.abs(o.x-40)<1e-9&&o.y>=low&&o.y<=high,`${name}: the disc lies at the body (${o.y.toFixed(2)} in ${low}..${high})`);
    assert.equal(view.squashFloor,deck,`${name}: over its deck`);
    assert(o.y>=deckY-1e-9,`${name}: on or above the deck, never in it`);
    const held=node.scale.y,heldY=view.root.position.y;animateEnemy(view,e,1/60,'paused');assert.equal(node.scale.y,held,`${name}: pausing holds the press`);assert.equal(view.root.position.y,heldY);
    for(let i=12;i<Math.round(FLATTEN.shatter*60)+1;i++)animateEnemy(view,e,1/60,'playing');
    assert.equal(node.visible,false,`${name}: gone on the shatter beat`);
    settleSquash(w,e,view,[deck]);
    assert.equal(view.squashStage,2,`${name}: broken`);
    assert(clumps(w).length>=3&&pellets(w).length>=2,`${name}: pellets and clumps from the real view`);
    assert(clumps(w).every(q=>q.floor===deck),`${name}: onto the deck under it`);
    releaseEnemyView(view);disposeBranch(w,view.root);w.particles=[];
  }
  // A bat's disc sinks while held, but stays above the deck found under it.
  {
    const e={id:901,x:40,y:3.3,dir:1,speed:1,min:38,max:42,alive:true,kind:'bat',aiState:'patrol'},view=createEnemyView(w,e),deck={x:30,w:20,y:3};
    animateEnemy(view,e,1/60,'playing');e.alive=false;
    for(let i=0;i<20;i++){animateEnemy(view,e,1/60,'playing');settleSquash(w,e,view,[deck]);}
    assert(view.root.position.y<e.y+.53-.05,'the swatted bat sinks');
    assert(view.root.position.y>=deck.y+.12-1e-9,'but not into the deck');
    releaseEnemyView(view);disposeBranch(w,view.root);w.particles=[];
  }
  console.log('PASS every creature is pressed straight down where it stands, holds, sinks if airborne, and breaks on the beat');

  // The real thing: the simulation stomps a clayling in the Hanging Quarter,
  // the world renders it.
  const stomp=()=>{
    const g=new Game();g.start(3);
    const e=g.level.enemies.find(e=>!e.kind);assert(e,'the Hanging Quarter has a clayling');
    const events=[];g.onEvent=ev=>{events.push(ev);w.event(ev);};
    w.build(g.level,3,e.x);w.viewW=22;w.viewH=12;w.landscape=true;w.reducedMotion=false;w.cameraX=e.x;w.cameraY=e.y+2;
    const view=w.enemyViews.get(e.id);assert(view?.loaded,'the clayling\'s view is built and loaded');
    // Stood in the middle of its deck, so the assertions below about lying on
    // it are not at the mercy of a clump thrown past a nearby edge.
    const deck=g.level.platforms.find(s=>e.x>=s.x&&e.x<=s.x+s.w&&Math.abs(s.y-e.y)<.2);assert(deck);
    e.speed=0;e.x=deck.x+deck.w/2;
    Object.assign(g.player,{x:e.x,y:e.y+1.1,vx:0,vy:-5,groundId:null,coyote:0,invuln:0});
    for(let i=0;i<60&&e.alive;i++)g.tick(FIXED_DT,{});
    assert(!e.alive&&events.some(ev=>ev.type==='squish'&&ev.kind==='clayling'),'the stomp lands');
    return {g,e,view,events,before:w.particles.length};
  };
  {
    const {g,e,view,before}=stomp();
    assert.equal(w.particles.filter(q=>q.kind==='clay-pellet'||q.kind==='clay-clump').length,0,'the event itself throws nothing: the pellets wait for the frame that presses the disc');
    w.render(g,1/60);
    const first=pellets(w);
    assert(first.length>=2&&first.length<=3,'two or three pellets on the frame the press lands');
    assert(first.every(q=>q.mesh.material===w.mat.orange),'in the clayling\'s orange');
    assert(view.root.visible&&view.root.scale.y<1,'the body is already going down');
    // Anything already flying before this frame — a bead the player took on
    // the way down — is not the death's; what the death adds is its dust.
    const dust=w.particles.length-before-first.length;
    assert(dust>=1&&dust<=6,`a little deck dust, not the old ten-ball puff (${dust})`);
    let shatterFrame=-1,broke;
    for(let i=1;i<45;i++){
      w.render(g,1/60);
      const c=clumps(w);
      if(c.length&&shatterFrame<0){
        shatterFrame=i;broke=c;
        assert.equal(view.root.visible,false,'the disc is hidden the same frame its clumps appear');
        assert(c.length>=3&&c.length<=7);
        assert(c.every(q=>q.mesh.material===w.mat.orange&&q.mesh.name==='Clay clump'));
        assert(c.every(q=>q.floor&&Math.abs(surfaceAt(q.floor,q.mesh.position.x)-e.y)<.01),'the clumps know the deck the clayling stood on');
        assert(c.every(q=>Math.abs(q.mesh.position.x-e.x)<.75),'and break where it lay');
      }else if(shatterFrame<0&&i>=6)assert(view.root.visible&&view.root.scale.y<.35,`held flat at frame ${i}`);
    }
    assert(shatterFrame>0,'it broke');
    assert(Math.abs((shatterFrame+1)/60-FLATTEN.shatter)<=1/60+1e-9,`on the shatter beat (frame ${shatterFrame})`);
    assert.equal(view.squashStage,2);
    g.pause();
    const held=JSON.stringify(w.particles.map(q=>[q.life,q.mesh.position.toArray(),q.mesh.scale.toArray()]));
    w.render(g,1/60);w.render(g,1/60);
    assert.equal(JSON.stringify(w.particles.map(q=>[q.life,q.mesh.position.toArray(),q.mesh.scale.toArray()])),held,'pausing holds every pellet and clump where it is');
    g.resume();
    let lowest=Infinity;
    for(let i=0;i<120;i++){w.render(g,1/60);for(const q of clumps(w))if(onDeck(q))lowest=Math.min(lowest,bottom(q)-e.y);}
    assert(lowest>=-1e-6,'no clump ever sinks through the deck');
    assert(broke.some(onDeck)&&broke.filter(onDeck).every(q=>q.rest),'every clump still over the deck came to rest on it');
    assert.equal(w.particles.filter(q=>q.kind==='clay-pellet'||q.kind==='clay-clump').length,0,'two seconds on, the clay is gone');
    assert(!w.fxRoot.children.some(o=>o.name==='Clay clump'||o.name==='Clay pellet'),'and no mesh is left in the effects root');
    assert.equal(view.squashStage,2,'the beat never repeats');
    for(let i=0;i<30;i++)shatterClay(w,e.x,e.y,.35,'clayling',{floor:view.squashFloor});
    assert(w.particles.length<=SHATTER.budget,'thirty breaks stay within the effect budget');
    for(let i=0;i<150;i++)w.render(g,1/60);assert.equal(w.particles.length,0);
  }
  console.log('PASS a real stomp presses the clayling flat, pops pellets, breaks it on the beat onto its deck, freezes on pause and cleans up');

  // Streaming keeps the dead creature until it has broken; one the level has
  // already dropped — a boss minion — breaks the moment its view goes.
  {
    const {g,e,view}=stomp();
    for(let i=0;i<6;i++)w.render(g,1/60);
    assert(view.root.visible&&view.squashStage===1,'mid-hold');
    g.level.dynamicRevision=(g.level.dynamicRevision||0)+1;w.syncVisible(g.level,e.x);
    assert.equal(w.enemyViews.get(e.id),view,'a re-scan during the hold keeps the pressed disc');
    assert(view.root.parent,'and its view in the scene');
    // The boss fight drops dead minions from the level the tick they die: the
    // view is kept and settled on its own until the disc has broken.
    g.level.enemies=g.level.enemies.filter(x=>x!==e);g.level.dynamicRevision++;
    w.syncVisible(g.level,e.x);
    assert.equal(w.enemyViews.get(e.id),view,'a creature the level has let go of keeps its view while its disc is whole');
    assert(view.root.parent&&view.root.visible&&clumps(w).length===0,'still pressed, not broken early');
    let frame=-1;for(let i=0;i<40&&frame<0;i++){w.render(g,1/60);if(clumps(w).length)frame=i;}
    assert(frame>0&&Math.abs(view.deathTime-FLATTEN.shatter)<=1/60+1e-9,`it still breaks on its own beat (${view.deathTime.toFixed(3)})`);
    assert.equal(view.root.visible,false);assert.equal(view.squashStage,2);
    g.level.dynamicRevision++;w.syncVisible(g.level,e.x);
    assert(!w.enemyViews.has(e.id)&&!view.root.parent,'and only then does streaming let its view go');
    for(let i=0;i<150;i++)w.render(g,1/60);assert.equal(clumps(w).length,0);
  }
  // Reduced motion: the disc is hidden on the same frame the clumps appear.
  {
    const {g,e,view}=stomp();w.reducedMotion=true;view.reducedMotion=true;
    let frame=-1;
    for(let i=0;i<40;i++){w.render(g,1/60);if(clumps(w).length&&frame<0){frame=i;assert.equal(view.root.visible,false,'calm: hidden as the clumps appear');assert.equal(clumps(w).length,3);}}
    assert(frame>0&&Math.abs((frame+1)/60-FLATTEN.calmShatter)<=1/60+1e-9,`calm: on the calm beat (${frame})`);
    assert(pellets(w).length<=2);
    w.reducedMotion=false;
  }
  console.log('PASS streaming keeps a pressed creature until it breaks, even one the level has dropped, and reduced motion breaks on its own beat');
}
