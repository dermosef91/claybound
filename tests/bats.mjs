import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from './load-player.mjs';
import {prepareBatAsset} from '../dist/bats.js';
import {createEnemyView,animateEnemy,releaseEnemyView} from '../dist/enemies.js';
import {BAT,initializeEnemy,moveEnemy} from '../dist/enemy-rules.js';
import {batLookVector} from '../dist/bat-echo.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {DraftLibrary,DraftSession,validateDraft,objectLabel} from '../dist/editor-model.js';

const url=new URL('../dist/assets/bat.glb',import.meta.url),gltf=await readGLB(url);
const info=JSON.parse(await readFile(new URL('../dist/assets/bat.json',import.meta.url)));
assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'),info.shippedSha256);
assert.deepEqual(gltf.animations.map(a=>a.name),['Fly','Hover','Swoop']);
const w={levelRoot:new THREE.Group()};prepareBatAsset(w,gltf);
const enemy={kind:'bat',x:4,y:5,min:3,max:5,speed:.6,bob:.5,period:4.8,phase:.3};initializeEnemy(enemy,0);
const a=createEnemyView(w,enemy),b=createEnemyView(w,{...enemy,id:1});
const ma=a.model.getObjectByName('Bat'),mb=b.model.getObjectByName('Bat');
assert.equal(ma.skeleton.bones.length,8);assert.equal(ma.geometry.index.count/3,10426);
assert(ma.material.map&&ma.material.normalMap&&ma.material.roughnessMap&&ma.geometry.attributes.tangent);
assert.notEqual(ma.skeleton.bones[0],mb.skeleton.bones[0]);assert.equal(ma.geometry,mb.geometry);assert.equal(ma.material,mb.material);
assert(w.assetGeometry.has(ma.geometry)&&w.assetMaterials.has(ma.material));
let minWing=Infinity,maxWing=-Infinity,maxWidth=0;
for(const name of ['Fly','Hover','Swoop']){
  for(const [key,action]of Object.entries(a.actions))action.setEffectiveWeight(key===name?1:0);
  const clip=w.batAsset.clips[name];
  assert(clip.tracks.every(t=>t.name!=='Root.position'));
  for(let i=0;i<=32;i++){
    a.actions[name].time=clip.duration*i/32;a.mixer.update(0);a.root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(a.root,true);assert(box.min.toArray().every(Number.isFinite));assert(box.max.toArray().every(Number.isFinite));
    maxWidth=Math.max(maxWidth,box.max.x-box.min.x);
    const wing=ma.skeleton.bones.find(b=>b.name==='Wing_R_2').quaternion.z;minWing=Math.min(minWing,wing);maxWing=Math.max(maxWing,wing);
    assert(a.model.getObjectByName('Root').position.length()<1e-7,'root drift must not move the body off its collider');
    assert(box.getSize(new THREE.Vector3()).y<2.4,'wing poses remain proportional to the player');
  }
}
assert(maxWing-minWing>.2,'the supplied wing motion is actually animated');assert(maxWidth>1.5&&maxWidth<2.7);
const otherTime=b.mixer.time;animateEnemy(a,enemy,.03,'playing');assert.equal(b.mixer.time,otherTime);
const time=a.mixer.time;animateEnemy(a,enemy,1,'paused');assert.equal(a.mixer.time,time);animateEnemy(a,enemy,1,'editing');assert.equal(a.mixer.time,time);
enemy.alive=false;for(let i=0;i<12;i++)animateEnemy(a,enemy,dt,'playing');assert(a.root.visible&&a.root.scale.y<.25&&a.root.scale.x>1.5,'a swatted bat is pressed flat like every other creature');
assert(a.root.position.y<enemy.y+BAT.modelOffsetY,'and the disc sinks, with nothing to hold it up');
for(let i=0;i<60;i++)animateEnemy(a,enemy,dt,'playing');assert.equal(a.root.visible,false);
let geometryDisposed=false;ma.geometry.addEventListener('dispose',()=>geometryDisposed=true);releaseEnemyView(a);assert.equal(geometryDisposed,false);animateEnemy(b,{...enemy,alive:true},dt,'playing');
console.log('PASS bat rig, three clips, PBR maps, wing deformation, fixed body, independent skeletons, pause, defeat and shared resources');

for(const [dx,dy]of [[-3,-2],[3,-2],[0,-3]]){
  const e={...enemy,alive:true,aiState:'retreat',lookX:enemy.x+dx,lookY:enemy.y+(BAT.bottom+BAT.top)/2+dy};
  for(let i=0;i<60;i++)animateEnemy(b,e,dt,'playing');
  const direction=batLookVector(e).normalize(),forward=new THREE.Vector3(0,0,1).applyQuaternion(b.pose.quaternion);
  assert(forward.z>.6,'the face remains readable instead of turning edge-on');
  assert(forward.setZ(0).normalize().dot(direction)>.999,'buildup turns the real model toward the player in the play plane');
  Object.assign(e,{aiState:'charge',aimX:e.lookX,aimY:e.lookY,stateTime:.08});animateEnemy(b,e,dt,'playing');
  assert(b.echo.root.visible);assert.equal(b.echo.waves.length,3);
  assert(new THREE.Vector3(0,0,1).applyQuaternion(b.pose.quaternion).setZ(0).normalize().dot(direction)>.999999);
  const echoDirection=new THREE.Vector3(1,0,0).applyQuaternion(b.echo.root.quaternion);assert(echoDirection.dot(direction)>.999999,'waves point down the same dive lane as the face');
  b.root.traverse(o=>{assert.notEqual(o.geometry?.type,'TorusGeometry','no surrounding charge circle remains');});
  const before=b.echo.waves.map(g=>g.position.x);e.stateTime+=.02;animateEnemy(b,e,.02,'playing');
  assert(b.echo.waves.every((g,i)=>g.position.x>before[i]),'clay arcs travel outward');
  for(const g of b.echo.waves){assert(g.scale.x<=1.2);g.traverse(o=>{if(o.isMesh){assert(o.material.isMeshStandardMaterial);assert(o.material.roughness>=.9);assert(!o.material.transparent);assert(w.assetGeometry.has(o.geometry));}});}
  const snapshot=()=>JSON.stringify([b.mixer.time,b.pose.quaternion,b.echo.root.quaternion,b.echo.waves.map(g=>[g.position,g.scale])]);
  const frozen=snapshot();animateEnemy(b,e,.5,'paused');assert.equal(snapshot(),frozen);
  b.echo.reducedMotion=true;const still=b.echo.waves.map(g=>{animateEnemy(b,e,0,'playing');return g.position.x;});
  e.stateTime+=.1;animateEnemy(b,e,.02,'playing');assert.deepEqual(b.echo.waves.map(g=>g.position.x),still);b.echo.reducedMotion=false;
  for(const state of ['dive','recover','patrol']){e.aiState=state;animateEnemy(b,e,dt,'playing');assert(!b.echo.root.visible);}
  e.aiState='charge';animateEnemy(b,e,dt,'editing');assert(!b.echo.root.visible);
  e.alive=false;animateEnemy(b,e,dt,'playing');assert(!b.echo.root.visible);
}
assert.equal(a.echo.root.visible,false,'each bat owns its own cue visibility');
console.log('PASS player-facing buildup, left/right/down aim, three outward clay arcs, shared cue resources, pause/reduced motion, and cue removal on dive/death/editor');

function encounter({x=0,y=4,vy=-8,bob=0,phase=0,enemyY=2}={}){
  const source=structuredClone(LEVELS[2]);source.spawn={x,y};source.platforms=source.platforms.filter(s=>s.goal);source.enemies=[{kind:'bat',x:0,y:enemyY,min:0,max:0,speed:.5,bob,period:4.8,phase}];source.hazards=[];source.crushers=[];source.coins=[];source.stamps=[];source.hints=[];source.end=1000;
  const events=[],game=new Game(e=>events.push(e));game.start(2,source);Object.assign(game.player,{vy,coyote:0,groundId:null,health:RULES.maxHealth});return {game,events,e:game.level.enemies[0]};
}
for(const [name,options,input]of [
  ['jump landing',{y:3.08,vy:-10},{jumpHeld:true}],
  ['inner-wing landing',{x:.92,y:3.08,vy:-10},{jumpHeld:true}],
  ['fast stomp',{y:3.02,vy:-25},{jumpHeld:false}],
  ['rising bat',{y:3.02,vy:-12,bob:.6},{jumpHeld:true}],
  ['falling bat',{y:3.02,vy:-12,bob:.6,phase:Math.PI},{jumpHeld:true}]
]){
  const {game,e,events}=encounter(options);for(let i=0;i<15&&e.alive;i++)game.tick(dt,input);
  assert.equal(e.alive,false,name);assert(game.player.vy>0,name+' bounce');assert.equal(game.player.health,RULES.maxHealth);assert.equal(events.filter(e=>e.type==='squish').length,1);
}
for(const opts of [{x:.45,y:2,vy:0},{x:0,y:1,vy:5}]){
  const {game,e}=encounter(opts);game.tick(dt,{});assert(e.alive,'side/underside contact must not kill the bat');assert.equal(game.player.health,RULES.maxHealth-1);game.tick(dt,{});assert.equal(game.player.health,RULES.maxHealth-1,'damage cooldown');
}
const edge=encounter({x:1.05,y:2,vy:0});edge.game.tick(dt,{});assert.equal(edge.game.player.health,RULES.maxHealth,'outer wing tips are harmless');
const paused=encounter({bob:.6});paused.game.pause();const frozen=[paused.e.x,paused.e.y];paused.game.tick(1,{});assert.deepEqual([paused.e.x,paused.e.y],frozen);
// Bats belong to the caves and to the Hanging Quarter's rooftops, where
// chapter four recombines what the earlier chapters taught. Every chapter that
// places one loads the bat model (world.prepareLevel), and the same flight and
// checkpoint-clearance rules hold wherever they hang.
for(const [index,L]of LEVELS.entries())for(const e of L.enemies.filter(e=>e.kind==='bat')){
  const copy=structuredClone(e);initializeEnemy(copy,0);
  for(let i=1;i<1800;i++){moveEnemy(copy,dt,i*dt);assert(copy.y>=copy.baseY-copy.bob-1e-6&&copy.y<=copy.baseY+copy.bob+1e-6);assert(copy.x>=copy.min&&copy.x<=copy.max);}
  for(const p of L.platforms.filter(p=>p.checkpoint))assert(Math.abs(p.checkpoint-e.x)>1.5||Math.abs(p.y-e.y)>3,`checkpoint arrivals remain clear (chapter ${index+1})`);
}
assert.deepEqual(LEVELS.map(l=>l.enemies.filter(e=>e.kind==='bat').length),[0,0,4,2]);
console.log('PASS bat jump/stomp kills, edge forgiveness, moving top contacts, side damage, cooldown, pause, and cave plus rooftop placement');

const storage={value:'',getItem(){return this.value},setItem(_,v){this.value=v}},library=new DraftLibrary(LEVELS,storage),session=new DraftSession(library,2);
session.add('bat',45,8);const index=session.selection.index;session.set('bob',.8);session.set('period',6.5);session.set('phase',1.2);
session.startChange();session.move(2,1);session.commit();assert.equal(session.level.enemies[index].min,45.4);
const imported=library.read(library.export(2,session.level),2);assert.deepEqual(imported.enemies[index],session.level.enemies[index]);
assert.equal(new DraftLibrary(LEVELS,storage).get(2).enemies[index].bob,.8);assert.equal(objectLabel(imported.enemies[index],'enemies'),'Flying bat');
session.undo();assert.equal(session.level.enemies[index].x,45);session.redo();assert.equal(session.level.enemies[index].x,47);
const invalid=structuredClone(imported);invalid.enemies[index].bob=Infinity;assert.throws(()=>validateDraft(invalid,LEVELS[2]));
console.log('PASS bat editor placement, hover settings, drag, undo/redo, autosave and backup import');
