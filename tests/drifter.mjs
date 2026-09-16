import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {LEVELS,instantiateLevel} from '../dist/levels.js';
import {moveEnemy} from '../dist/enemy-rules.js';
import {DRIFTER} from '../dist/drifter-rules.js';
import {burstDrifterLeaves} from '../dist/drifter-leaves.js';
import {createEnemyView,animateEnemy,releaseEnemyView} from '../dist/enemies.js';
import {World} from '../dist/world.js';
import {attachDrifter} from './load-drifter.mjs';
import {DraftLibrary,DraftSession,selectedObject,objectLabel} from '../dist/editor-model.js';

assert.equal(LEVELS[0].enemies.filter(e=>e.kind==='drifter').length,4);
for(const source of LEVELS[0].enemies){
  const L=instantiateLevel(0),e=L.enemies.find(e=>e.x===source.x),xs=[],ys=[],dirs=new Set(),modes=new Set();
  for(let i=0;i<3600;i++){
    const oldY=e.y,oldX=e.x,oldAngle=e.rollAngle,mode=e.aiState;
    moveEnemy(e,dt,i*dt,{winds:[],platforms:L.platforms});xs.push(e.x);ys.push(e.y);dirs.add(e.dir);modes.add(e.aiState);
    assert(Math.abs(e.y-oldY)<.035,'settling/lifting stays smooth');
    if(e.aiState==='rolling'){
      const floor=L.platforms.find(p=>p.id===e.groundId);
      assert(Math.abs(e.y-floor.y-DRIFTER.groundRadius)<1e-6);
      assert(e.x-DRIFTER.groundRadius>=floor.x&&e.x+DRIFTER.groundRadius<=floor.x+floor.w);
      if(mode==='rolling')assert(Math.abs(e.rollAngle-oldAngle+(e.x-oldX)/DRIFTER.groundRadius)<1e-6,'rotation follows distance travelled');
    }
  }
  assert(Math.max(...xs)-Math.min(...xs)>1.8);assert(dirs.has(-1)&&dirs.has(1));
  assert(Math.min(...xs)>=e.min&&Math.max(...xs)<=e.max);assert(Math.max(...ys)-Math.min(...ys)>source.bob*1.9);
  assert.deepEqual([...modes].sort(),['drifting','landing','lifting','rolling']);
}
const calm=instantiateLevel(0).enemies[3],gust=structuredClone(calm);
for(let i=1;i<240;i++){
  moveEnemy(calm,dt,i*dt,{winds:[]});
  moveEnemy(gust,dt,i*dt,{winds:[{x:40,w:40,y:0,h:30,fx:12,fy:19,active:true}]});
}
assert(gust.windLift>.5&&gust.windLift<=.65);assert(gust.x>=gust.min&&gust.x<=gust.max);assert(Math.abs(gust.y-calm.y)>.5);
console.log('PASS all four drifters alternate rolling and drifting, stay on their decks, rotate by travel, transition smoothly and respond to wind');

function arena(){
  const source=structuredClone(LEVELS[0]);source.platforms=[{id:'start',kind:'stone',x:-8,y:0,w:24},{id:'goal',kind:'stone',x:25,y:0,w:6,goal:true}];
  source.spawn={x:0,y:0};source.end=29;source.enemies=[{kind:'drifter',x:2,y:1.15,min:2,max:2,speed:.8,bob:0,phase:0,period:5}];
  source.coins=[];source.stamps=[];source.hazards=[];source.crushers=[];source.winds=[];source.circuits=[];
  const events=[],game=new Game(e=>events.push(e));game.start(0,source);return {game,events};
}
for(const rolling of [false,true])for(const side of [-1,1]){
  const {game:g,events}=arena(),e=g.level.enemies[0];
  if(rolling)while(e.aiState!=='rolling')g.tick(dt,{});
  Object.assign(g.player,{x:e.x+side*.6,y:e.y-.3,vy:0,vx:0,groundId:null,facing:-side});
  g.tick(dt,{});
  assert.equal(g.player.health,RULES.maxHealth-1,'touching a rolling or airborne body damages the player');
  assert(e.alive);assert.equal(g.deaths,0);assert(g.player.vx*side>0,'normal knockback clears contact');
  assert.equal(events.filter(e=>e.type==='hurt').length,1);
  Object.assign(g.player,{x:e.x,y:e.y-.3,vy:0,vx:0,groundId:null});g.tick(dt,{});
  assert.equal(g.player.health,RULES.maxHealth-1,'invulnerability prevents repeated touch damage');
  Object.assign(g.player,{x:e.x-.7,y:e.y-.3,vy:0,vx:0,groundId:null});
  for(let i=0;i<50;i++)g.tick(dt,{right:true});
  assert(g.player.x>e.x+.8,'the player can move through and away during hit grace');
}
{
  const {game:g}=arena(),e=g.level.enemies[0];
  e.y=e.baseY=3;
  Object.assign(g.player,{x:e.x,y:e.y-DRIFTER.halfHeight-RULES.height+.05,vy:5,groundId:null});g.tick(dt,{});
  assert.equal(g.player.health,RULES.maxHealth-1,'underside contact also hurts');assert(e.alive);
}
for(const rolling of [false,true])for(const stomp of [false,true]){
  const {game:g,events}=arena(),e=g.level.enemies[0];
  if(rolling)while(e.aiState!=='rolling')g.tick(dt,{});
  Object.assign(g.player,{x:e.x,y:e.y+DRIFTER.halfHeight+.18,vy:stomp?-24:-4,groundId:null,stomping:stomp});
  for(let i=0;i<30&&e.alive;i++)g.tick(dt,{jumpHeld:!stomp});
  assert(g.player.springing&&g.player.vy>0);assert(!e.alive);assert.equal(g.player.health,RULES.maxHealth);
  assert.equal(events.filter(e=>e.type==='squish'&&e.kind==='drifter').length,1,'one leaf burst for a normal jump or stomp in either mode');
  const corpse=JSON.stringify(e);for(let i=0;i<120;i++)g.tick(dt,{});assert.equal(JSON.stringify(e),corpse);
  g.respawn();assert(!e.alive,'defeated Drifters stay defeated during this run');
  g.start(0);assert(g.level.enemies.every(e=>e.alive),'a fresh chapter restores its enemies');
}
{
  const {game:g}=arena(),e=g.level.enemies[0];
  while(e.aiState!=='rolling')g.tick(dt,{});
  g.pause();const saved=JSON.stringify(e);for(let i=0;i<120;i++)g.tick(dt,{right:true});assert.equal(JSON.stringify(e),saved);
  g.resume();g.respawn();assert.equal(e.x,e.homeX);assert.equal(e.aiState,'drifting');assert.equal(e.rollAngle,0);
}
console.log('PASS body/underside damage in both modes, hit grace and escape, jump/stomp defeat without damage, one defeat event, pause and reset');

{
  const {game:g}=arena(),e=g.level.enemies[0],floor=g.level.platforms[0];
  g.player.x=-6;
  Object.assign(e,{min:-2,max:4});Object.assign(floor,{kind:'lift',moveX:1,moveY:.4,period:4.8});
  let rolling=0;
  for(let i=0;i<2000;i++){
    const old=e.y;g.tick(dt,{});
    if(e.aiState==='rolling'){rolling++;assert(Math.abs(e.y-floor.y-DRIFTER.groundRadius)<1e-6);}
    assert(Math.abs(e.y-old)<.05,'moving-deck transitions cannot teleport');
  }
  assert(rolling>100);
  while(e.aiState!=='rolling')g.tick(dt,{});
  floor.active=false;const oldY=e.y;moveEnemy(e,dt,g.time+dt,{platforms:g.level.platforms});
  assert.equal(e.aiState,'lifting');assert(Math.abs(e.y-oldY)<.03);
  const unsupported=instantiateLevel(0).enemies[0];
  for(let i=0;i<1800;i++)moveEnemy(unsupported,dt,i*dt,{platforms:[]});
  assert.equal(unsupported.aiState,'drifting','an editor placement over a gap stays airborne');
}
console.log('PASS rolling follows a moving deck, lifts when support disappears, and airborne editor placements need no artificial floor');

const storage={getItem:()=>null,setItem(){}},library=new DraftLibrary(LEVELS,storage),session=new DraftSession(library,0);
session.add('drifter',15,3);let d=selectedObject(session.level,session.selection);assert.equal(objectLabel(d,'enemies'),'Dust Drifter');
session.set('bob',.35);session.set('period',6);session.set('min',13);session.set('max',17);
const imported=library.read(library.export(0,session.level),0);assert.equal(imported.enemies.at(-1).kind,'drifter');assert.equal(imported.enemies.at(-1).bob,.35);
const added=imported.enemies.length;session.undo();session.redo();assert.equal(session.level.enemies.length,added);
const arrival=session.level.platforms.findIndex(p=>p.id==='arrival'),prior=structuredClone(session.level.enemies[0]);
session.selection={list:'platforms',index:arrival};session.startChange();session.move(2,1,true);session.commit();
assert.equal(session.level.enemies[0].x,prior.x+2);assert.equal(session.level.enemies[0].y,prior.y+1);assert.equal(session.level.enemies[0].min,prior.min+2);
console.log('PASS editor placement, hover/patrol tuning, import/export, undo/redo and moving a platform with its drifter');

const w=Object.create(World.prototype);w.levelRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.particles=[];w.mat={cream:new THREE.MeshStandardMaterial(),orangeLight:new THREE.MeshStandardMaterial()};
await attachDrifter(w);const L=instantiateLevel(0),e=L.enemies[0],a=createEnemyView(w,e),b=createEnemyView(w,L.enemies[1]);
let triangles=0;w.drifterAsset.scene.traverse(o=>{if(o.isMesh){triangles+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);}});assert.equal(triangles,10398);
const original=JSON.stringify(a.pose.matrix.toArray());
for(let i=0;i<90;i++){moveEnemy(e,dt,i*dt,{platforms:L.platforms});animateEnemy(a,e,dt,'playing');}
a.root.updateMatrixWorld(true);assert(Math.abs(a.root.position.x-e.x)<1e-7);assert.equal(a.root.position.y,e.y);
assert(Math.abs(a.pose.rotation.y)<.4,'the supplied eyes stay facing the camera');assert.notEqual(JSON.stringify(a.pose.matrix.toArray()),original);
for(const grain of a.grains)assert(Math.max(...grain.scale.toArray())<.08,'trail grains stay small beside the supplied body');
const snapshot=()=>JSON.stringify([a.root.position,a.pose.position,a.pose.quaternion,a.pose.scale,...a.grains.map(g=>[g.position,g.quaternion,g.scale])]);
const still=snapshot();for(let i=0;i<120;i++)animateEnemy(a,e,.05,'paused');assert.equal(snapshot(),still);
for(let i=90;i<1300;i++){
  moveEnemy(e,dt,i*dt,{platforms:L.platforms});animateEnemy(a,e,dt,'playing');
  if(e.aiState==='rolling'){
    a.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a.model,true),floor=L.platforms.find(s=>s.id===e.groundId);
    assert(Math.abs(box.min.y-floor.y)<.006,'rotating source leaves touch the actual deck');
  }
}
e.alive=false;for(let i=0;i<12;i++)animateEnemy(a,e,dt,'playing');
assert(a.root.visible&&a.root.scale.y<.25&&a.root.scale.x>1.5,'a defeated drifter is pressed flat like every other creature');
assert(a.grains.every(g=>!g.visible),'and its trailing grains stop with it');
for(let i=0;i<60;i++)animateEnemy(a,e,dt,'playing');assert.equal(a.root.visible,false,'the disc is gone once it breaks');
burstDrifterLeaves(w,e.x,e.y);assert.equal(w.particles.length,10);
assert(w.particles.every(q=>q.mesh.name==='Drifter clay leaf'&&q.mesh.geometry===w.particles[0].mesh.geometry));
const leaf=w.particles[0],before=leaf.mesh.quaternion.clone(),position=leaf.mesh.position.clone();
w.updateParticles(.1);assert(!leaf.mesh.quaternion.equals(before));assert(!leaf.mesh.position.equals(position));
const leafState=JSON.stringify(w.particles.map(q=>[q.life,q.mesh.position,q.mesh.rotation]));w.updateParticles(0);assert.equal(JSON.stringify(w.particles.map(q=>[q.life,q.mesh.position,q.mesh.rotation])),leafState);
for(let i=0;i<120;i++)w.updateParticles(dt);assert.equal(w.particles.length,0);assert.equal(w.fxRoot.children.length,0);
w.reducedMotion=true;burstDrifterLeaves(w,0,0);assert.equal(w.particles.length,5);
for(let i=0;i<30;i++)burstDrifterLeaves(w,0,0);assert.equal(w.particles.length,110,'multiple bursts honor the existing effect budget');
let shared=0;for(const geometry of w.assetGeometry)geometry.addEventListener('dispose',()=>shared++);
releaseEnemyView(a);releaseEnemyView(b);assert.equal(shared,0);assert(a.loaded&&b.loaded);assert.equal(a.grains.length,5);
console.log('PASS real-model ground contact, retained maps, frozen pause, hidden defeated model, tumbling leaf burst, effect cleanup/budget and shared asset retention');
