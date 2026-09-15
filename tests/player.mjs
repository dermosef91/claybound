import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero,animateHero,heroEvent} from '../dist/hero.js';
import {readPlayer} from './load-player.mjs';
import {Game} from '../dist/simulation.js';

const bytes=await readFile(new URL('../dist/assets/player.glb',import.meta.url));
const motion=JSON.parse(await readFile(new URL('../dist/assets/player-motion.json',import.meta.url)));
const idle=JSON.parse(await readFile(new URL('../dist/assets/player-idle.json',import.meta.url)));
assert.equal(motion.sourceSha256,createHash('sha256').update(bytes).digest('hex'),'floor corrections match the exact shipped GLB');
const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
w.character=createHero(w);w.scene.add(w.character.root);
const gltf=await readPlayer();attachHero(w,gltf,motion,idle);const c=w.character;
assert.equal(c.sourceClips.length,12);assert.equal(c.model.children[0],gltf.scene);
const mesh=c.asset.getObjectByName('char1');assert(mesh.isSkinnedMesh);assert.equal(mesh.skeleton.bones.length,24);assert.equal(mesh.geometry.index.count/3,10418);
assert(mesh.material.map);assert.equal(mesh.material.metalness,0);assert(mesh.castShadow);
console.log('PASS original skinned GLB, all 11 source clips plus the new idle, texture references and 24-bone rig are loaded');

const bounds=()=>{c.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(c.model,true);};
const neutralHipY=motion.anchor[1];
for(const [name,clip] of Object.entries(c.clips)){
  const track=clip.tracks.find(t=>t.name==='Hips.position');
  for(let i=0;i<track.values.length;i+=3){assert(Math.abs(track.values[i]-motion.anchor[0])<1e-5);assert(Math.abs(track.values[i+2]-motion.anchor[2])<1e-5);}
  for(const a of Object.values(c.actions))a.stop();
  const action=c.actions[name];action.reset().play().setEffectiveWeight(1);
  for(let i=0;i<=20;i++){
    action.time=clip.duration*i/20;c.mixer.update(0);const box=bounds();
    assert([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),`${name} bounds`);
    assert(Math.abs(c.hips.position.x-motion.anchor[0])<1e-4,`${name} lateral root drift`);
    assert(Math.abs(c.hips.position.z-motion.anchor[2])<1e-4,`${name} forward root drift`);
    if(clip.userData.mode==='ground')assert(Math.abs(box.min.y)<.045,`${name} feet at ${box.min.y}`);
    else assert(Math.abs(c.hips.position.y-neutralHipY)<1e-3,`${name} double jump displacement`);
  }
}
console.log('PASS every mapped clip stays finite and in place; ground contact sampled throughout all grounded animations');

const game=new Game(e=>heroEvent(c,e));game.start(0);
heroEvent(c,{type:'respawn'});
const step=(n,input={})=>{for(let i=0;i<n;i++){game.tick(1/120,{...input,jumpPressed:!!input.jumpPressed&&i===0,stompPressed:!!input.stompPressed&&i===0});w.time+=1/120;animateHero(w,game,1/120);}};
step(60);assert.equal(c.state,'locomotion');assert(c.weights.idle>.98);
step(35,{moveAxis:.3,right:true});assert(c.weights.walk>.8);assert(c.weights.run<.1);
step(45,{right:true});assert(c.weights.run>.95);
step(1,{right:true,jumpHeld:true,jumpPressed:true});assert.equal(c.state,'leapRise');assert.equal(c.jumpKind,'leap');
step(12,{right:true,jumpHeld:true});game.pause();const before=c.asset.getObjectByName('LeftUpLeg').quaternion.toArray(),clock=c.mixer.time,weights={...c.weights};
for(let i=0;i<90;i++)animateHero(w,game,1/60);
assert.equal(c.mixer.time,clock);assert.deepEqual(c.asset.getObjectByName('LeftUpLeg').quaternion.toArray(),before);assert.deepEqual(c.weights,weights);game.resume();
step(1,{stompPressed:true});assert.equal(c.state,'stomp');
step(120);assert.equal(c.root.position.x,game.player.x);assert.equal(c.root.position.y,game.player.y);
game.start(0);heroEvent(c,{type:'hurt'});animateHero(w,game,1/60);assert.equal(c.state,'hurt');step(70);assert.notEqual(c.state,'hurt');
game.respawnTimer=.48;heroEvent(c,{type:'fall'});animateHero(w,game,1/60);assert.equal(c.state,'death');assert(c.root.visible);
game.respawn();animateHero(w,game,1/60);assert.equal(c.death,false);assert.notEqual(c.state,'death');
game.status='complete';animateHero(w,game,1/60);assert.equal(c.state,'victory');
game.start(1);step(60);assert.equal(c.state,'locomotion');assert.equal(c.death,false);assert(c.weights.idle>.98);
console.log('PASS analog walk/run blending, moving jump, paused pose, stomp, damage recovery, knockdown, respawn and celebration');

game.player.facing=-1;step(100);assert(Math.abs(c.turn-Math.PI)<.01);
game.player.facing=1;step(100);assert(c.turn<.01);assert.equal(c.model.scale.x,c.model.scale.z);
console.log('PASS left/right turns preserve model scale and the fixed physics origin');

game.start(0);heroEvent(c,{type:'respawn'});step(118);
assert.equal(c.idleVariant,'idle');assert.equal(c.weights.longIdle,0);assert(c.weights.idle>.99);
step(4);assert.equal(c.idleVariant,'longIdle');assert(c.actions.longIdle.time<.04,'long idle starts at its beginning after one second');
game.pause();const idleClock=c.idleTime,actionClock=c.actions.longIdle.time;step(240);
assert.equal(c.idleTime,idleClock);assert.equal(c.actions.longIdle.time,actionClock);game.resume();
step(35,{right:true});assert.equal(c.idleTime,0);assert(c.weights.longIdle<.01,'movement interrupts the fidget');
game.start(0);heroEvent(c,{type:'respawn'});step(850);
assert(c.longIdlePlayed);assert.equal(c.idleVariant,'idle');assert(c.weights.idle>.99,'return to the new idle after one fidget');
const finished=c.actions.longIdle.time;step(300);assert.equal(c.actions.longIdle.time,finished);assert.equal(c.idleVariant,'idle');
step(1,{right:true});assert.equal(c.longIdlePlayed,false);assert.equal(c.idleTime,0);
console.log('PASS new default idle, strict one-second delay, interruption, paused timer and one fidget per continuous rest');

// The reward uses the real rig: both wrists reach one stem and normal motion returns.
game.start(0);heroEvent(c,{type:'respawn'});game.flowerCelebration={id:0,time:.25};
for(let i=0;i<60;i++)animateHero(w,game,1/60);
assert.equal(c.state,'idle');assert(c.flower.root.visible);assert.equal(c.root.visible,true);
const wrists=c.flower.chains.map(chain=>c.facing.worldToLocal(chain[3].getWorldPosition(new THREE.Vector3())));
assert(wrists[0].distanceTo(wrists[1])<.26,'both hands hold the same flower');
for(const wrist of wrists)assert(wrist.y>1.25&&wrist.z>.2,'hands lift in front of the hood');
const held=c.flower.chains.flat().map(b=>b.quaternion.toArray());
game.pause();for(let i=0;i<90;i++)animateHero(w,game,1/60);
assert.deepEqual(c.flower.chains.flat().map(b=>b.quaternion.toArray()),held,'paused procedural pose does not accumulate rotations');
game.resume();game.flowerCelebration=null;step(60,{right:true});
assert(!c.flower.root.visible);assert.equal(c.state,'locomotion');assert(c.weights.run>.95);
game.flowerCelebration={id:0,time:.25};animateHero(w,game,1/60);game.start(1);heroEvent(c,{type:'respawn'});step(30);
assert(!c.flower.root.visible);assert([...bounds().min.toArray(),...bounds().max.toArray()].every(Number.isFinite));
console.log('PASS both-hand flower hold, pause stability, locomotion recovery and chapter cleanup');

// Only the upper-body overlay moves: sample the actual rig throughout the half-second hold.
const lowerNames=['Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
for(const mode of ['run','jumpRise','jumpFall','leapRise','leapFall','stomp']){
 game.start(0);heroEvent(c,{type:'respawn'});
 const air=mode!=='run';Object.assign(game.player,{vx:6,vy:mode.endsWith('Rise')?7:-5,groundId:air?null:game.player.groundId,stomping:mode==='stomp'});
 c.jumpKind=mode.startsWith('leap')?'leap':'jump';
 for(let i=0;i<8;i++)animateHero(w,game,1/60);
 const pose=()=>{c.root.updateMatrixWorld(true);return lowerNames.map(name=>c.asset.getObjectByName(name).matrixWorld.toArray());};
 const before=pose(),state=c.state,mixerTime=c.mixer.time,weights={...c.weights},actionTimes=Object.values(c.actions).map(a=>a.time);
 for(let i=0;i<30;i++){
  game.flowerCelebration={id:0,time:i/60};animateHero(w,game,1/60);
  assert.deepEqual(pose(),before,`${mode}: legs, hips, whole-body scale and facing stay intact`);
  assert.equal(c.state,state);assert.equal(c.mixer.time,mixerTime);assert.deepEqual(c.weights,weights);
  assert.deepEqual(Object.values(c.actions).map(a=>a.time),actionTimes,`${mode}: base clips do not advance or restart`);
 }
 game.flowerCelebration=null;animateHero(w,game,0);assert.deepEqual(pose(),before,`${mode}: release has no lower-body snap`);
 animateHero(w,game,1/60);assert(c.mixer.time>mixerTime);assert.equal(c.state,state);assert(!c.flower.root.visible);
}
console.log('PASS upper-body-only pickup: running, rising/falling jumps, leaps and stomp preserve lower-body world poses and resume their original clips');
