import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {SPORE,puffPlayer,sporeAttacking,moveSpore} from '../dist/spore-rules.js';
import {World} from '../dist/world.js';
import {readGLB} from './load-player.mjs';
import {prepareSporeAsset} from '../dist/spore-puff.js';
import {createEnemyView,animateEnemy,releaseEnemyView} from '../dist/enemies.js';
import {DraftLibrary,DraftSession,selectedObject,objectLabel} from '../dist/editor-model.js';
function make(){const s=structuredClone(LEVELS[1]);s.spawn={x:0,y:0};s.end=24;s.platforms=[{id:'start',x:-8,y:0,w:28,kind:'stone'},{id:'goal',x:22,y:0,w:8,kind:'stone',goal:true}];s.enemies=[{kind:'spore',x:2,y:0,min:2,max:2,speed:.5}];for(const k of ['coins','stamps','hazards','crushers','winds','circuits'])s[k]=[];const events=[],g=new Game();g.onEvent=e=>events.push({...e,at:g.time});g.start(1,s);return {g,events};}
const until=(g,test,max=600)=>{for(let i=0;i<max&&!test();i++)g.tick(dt,{});assert(test(),'state reached within bounded time');};
assert.equal(LEVELS[1].enemies.filter(e=>e.kind==='spore').length,4);
assert(LEVELS.filter((_,i)=>i!==1).every(l=>!l.enemies.some(e=>e.kind==='spore')));
{
  const {g,events}=make(),e=g.level.enemies[0];until(g,()=>g.player.stunTime>0);
  assert.equal(g.player.health,RULES.maxHealth,'the puff stuns but does not damage');
  const puff=events.find(e=>e.type==='spore-puff'),wiggle=events.find(e=>e.type==='spore-wiggle');assert(puff.at-wiggle.at>=SPORE.wiggleTime-1e-8);
  g.pause();const frozen=JSON.stringify([g.player,e,g.time]);for(let i=0;i<80;i++)g.tick(dt,{left:true});assert.equal(JSON.stringify([g.player,e,g.time]),frozen);g.resume();
  const x=g.player.x;
  for(let i=0;i<35;i++)g.tick(dt,{left:true});assert.equal(g.player.x,x,'steering is suppressed during the brief stun');
  let wake=0;for(let i=0;i<210;i++){g.tick(dt,{left:true});if(!wake&&!g.player.stunTime)wake=g.time;}
  const leap=events.find(e=>e.type==='spore-leap');assert(leap.at-wake>.1,'control returns before the committed leap');assert.equal(g.player.health,RULES.maxHealth,'walking clear after the stun avoids the locked jump');
  assert(events.some(e=>e.type==='spore-land'));until(g,()=>e.aiState==='idle',240);assert.equal(e.aiState,'idle');assert(e.cooldown>0);
  assert.equal(events.filter(e=>e.type==='spore-puff').length,1);
}
{
  const {g}=make();until(g,()=>g.player.stunTime>0);
  g.tick(dt,{jumpPressed:true,jumpHeld:true});
  for(let i=0;i<60&&g.player.stunTime>0;i++)g.tick(dt,{jumpHeld:true});
  assert(g.player.vy>0,'a held jump pressed during the stun fires on release');
  g.respawn();assert.equal(g.player.stunTime,0);assert.equal(g.level.enemies[0].aiState,'idle');
  for(let i=0;i<90;i++)g.tick(dt,{});assert(!g.player.stunTime,'respawn grace prevents an immediate stun');
}
console.log('PASS wiggle/puff/crouch/leap/landing sequence, short stun, queued jump, pause, respawn grace, cooldown and evasive movement');
{
  const {g}=make(),e=g.level.enemies[0],p=g.player;e.dir=-1;
  for(const patch of [{y:2.1},{invuln:1},{sporeGrace:1},{x:6}]){Object.assign(p,{x:0,y:0,invuln:0,sporeGrace:0,stunTime:0},patch);assert(!puffPlayer(e,p,g.level.platforms));}
  Object.assign(p,{x:0,y:0,invuln:0,sporeGrace:0,stunTime:0});
  assert(!puffPlayer(e,p,[...g.level.platforms,{x:.9,y:3,w:.4,kind:'stone'}]),'solid wall blocks spores');
  assert(puffPlayer(e,p,g.level.platforms));assert(!puffPlayer(e,p,g.level.platforms),'no chain paralysis');
}
for(const state of ['idle','wiggle','puff','crouch','leap','recover'])for(const stomp of [false,true]){
  const {g,events}=make(),e=g.level.enemies[0];Object.assign(e,{aiState:state,stateTime:0,puffAge:10,leapVY:0,leapVX:0,aimX:0});
  Object.assign(g.player,{x:e.x,y:e.y+SPORE.height+.08,vy:stomp?-24:-6,groundId:null,stomping:stomp});
  for(let i=0;i<20&&e.alive;i++)g.tick(dt,{jumpHeld:!stomp});
  assert(!e.alive,`cap stomp defeats ${state}`);assert.equal(g.player.health,RULES.maxHealth);assert(g.player.vy>0&&g.player.springing);
  assert.equal(events.filter(e=>e.type==='squish'&&e.kind==='spore').length,1);
}
{
  const {g}=make(),e=g.level.enemies[0];Object.assign(g.player,{x:2,y:0});g.tick(dt,{});assert.equal(g.player.health,RULES.maxHealth,'a resting puff is harmless');
  Object.assign(e,{aiState:'leap',leapVY:4,leapVX:0,groundId:null});g.tick(dt,{});assert.equal(g.player.health,RULES.maxHealth-1,'jump attack damages on body contact');for(let i=0;i<15;i++)g.tick(dt,{});assert.equal(g.player.health,RULES.maxHealth-1,'normal invulnerability limits contact to one hit');
}
{
  const {g}=make();g.level.enemies.push({...g.level.enemies[0],id:1,x:3,homeX:3});until(g,()=>g.level.enemies.some(sporeAttacking));assert.equal(g.level.enemies.filter(sporeAttacking).length,1,'nearby puffs take turns attacking');
}
console.log('PASS sight/range/airborne avoidance, no chain stun, harmless resting body, single-hit jump damage, and jump/stomp counters in every state');
{
  const {g}=make(),e=g.level.enemies[0],platform=g.level.platforms[0];
  e.speed=0;const localX=e.x-platform.x;
  for(let i=0;i<90;i++){
    platform.prevX=platform.x;platform.prevY=platform.y;platform.x+=.025;platform.y+=.012;
    moveSpore(e,dt,i*dt,{platforms:g.level.platforms});
    assert(Math.abs(e.x-platform.x-localX)<1e-7,'spore rides a moving deck without sliding');assert.equal(e.y,platform.y);
  }
  platform.active=false;const startY=e.y;
  for(let i=0;i<30;i++)moveSpore(e,dt,i*dt,{platforms:g.level.platforms});
  assert(e.y<startY-.9,'a disappearing deck cannot leave a spore floating');
  for(let i=0;i<150&&e.alive;i++)moveSpore(e,dt,i*dt,{platforms:g.level.platforms});assert(!e.alive,'falling into a gap defeats the spore');
}
{
  const {g}=make();until(g,()=>g.player.stunTime>0);g.tick(dt,{jumpPressed:true,jumpHeld:true});assert(g.player.stunJumpQueued);
  g.damage();assert.equal(g.player.stunTime,0);assert.equal(g.player.stunJumpQueued,false,'a hit cancels the pending stun jump');
}
console.log('PASS moving-deck attachment, falling/deactivation, and interrupted-stun input cleanup');
const w=Object.create(World.prototype);w.levelRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.mat={cream:new THREE.MeshStandardMaterial()};w.particles=[];
const url=new URL('../dist/assets/spore-puff.glb',import.meta.url),manifest=JSON.parse(await readFile(new URL('../dist/assets/spore-puff.json',import.meta.url)));
assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'),manifest.shippedSha256);
prepareSporeAsset(w,await readGLB(url));const {g}=make(),e=g.level.enemies[0],a=createEnemyView(w,e),b=createEnemyView(w,{...e,id:1});
const ma=a.model.getObjectByName('Mesh_0'),mb=b.model.getObjectByName('Mesh_0');assert.equal(ma.geometry.index.count/3,10396);assert.equal(ma.skeleton.bones.length,26);assert.notEqual(ma.skeleton.bones[0],mb.skeleton.bones[0]);assert.equal(ma.geometry,mb.geometry);assert.equal(ma.material,mb.material);assert(ma.material.map&&ma.material.normalMap&&ma.material.roughnessMap);
const weights=ma.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
for(const state of ['idle','wiggle','puff','crouch','leap','recover']){
  Object.assign(e,{aiState:state,stateTime:.15,puffAge:state==='puff'?.25:10,puffX:e.x,puffY:e.y+.7,puffDir:-1,leapVY:6});
  for(let i=0;i<15;i++)animateEnemy(a,e,dt,'playing');a.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(a.model,true);assert(bounds.min.y>e.y-.12&&bounds.min.y<e.y+.12,'poses stay grounded at the feet');assert(bounds.max.y<e.y+1.3&&bounds.max.y>e.y+.7,'squash stays readable without flattening the model');
  assert.equal(a.cloud.visible,state==='puff');
  const pose=JSON.stringify([a.pose.scale,a.pose.quaternion,...a.feet.map(f=>f.bone.quaternion),...a.motes.map(m=>m.position)]);animateEnemy(a,e,1,'paused');assert.equal(JSON.stringify([a.pose.scale,a.pose.quaternion,...a.feet.map(f=>f.bone.quaternion),...a.motes.map(m=>m.position)]),pose);
}
let disposed=0;ma.geometry.addEventListener('dispose',()=>disposed++);releaseEnemyView(a);assert.equal(disposed,0,'releasing one rig retains shared sculpture');
const storage={getItem:()=>null,setItem(){}},library=new DraftLibrary(LEVELS,storage),session=new DraftSession(library,1);session.add('spore',17,4.5);const p=selectedObject(session.level,session.selection);assert.equal(objectLabel(p,'enemies'),'Spore Puff');session.set('speed',.7);const imported=library.read(library.export(1,session.level),1);assert.equal(imported.enemies.at(-1).kind,'spore');assert.equal(imported.enemies.at(-1).speed,.7);session.undo();session.redo();
console.log('PASS supplied 26-bone model, normalized skin, shared maps/geometry, animated grounded poses, frozen pause, cleanup and editable/exportable Spore Puff');
