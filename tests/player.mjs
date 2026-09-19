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
assert.equal(motion.shippedSha256,createHash('sha256').update(bytes).digest('hex'),'floor corrections match the exact shipped GLB');
const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
w.character=createHero(w);w.scene.add(w.character.root);
const gltf=await readPlayer();attachHero(w,gltf,motion,idle);const c=w.character;
assert.equal(c.sourceClips.length,13,'the model\'s own clips, the supplied idle and the supplied push');assert.equal(c.model.children[0],gltf.scene);
const mesh=c.asset.getObjectByName('char1');assert(mesh.isSkinnedMesh);assert.equal(mesh.skeleton.bones.length,24);assert.equal(mesh.geometry.index.count/3,10418);
assert(mesh.material.map);assert.equal(mesh.material.metalness,0);assert(mesh.castShadow);
// The push is the supplied take, not the one the model shipped with, cut at
// the seam between the shove and the standing-down, both grounded.
assert(c.clips.push&&c.clips.pushStop,'a push and its stop');
assert.equal(c.clips.push.userData.source,'Push_Forward_and_Stop','the supplied push is preferred over the model\'s stock one');
assert(Math.abs(c.clips.push.duration-idle.pushSplit)<1e-3&&c.clips.pushStop.duration>.5&&c.clips.pushStop.duration<1,'the shove loops up to the split, the stop is what follows');
console.log('PASS original skinned GLB, all 11 source clips plus the supplied idle and push, texture references and 24-bone rig are loaded');

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
// Leaning on a block plays the push, paced to a block that moves and not to
// one that does not; let go standing still, the take's own stop plays once
// and the idle follows; walking away skips the stop.
// The simulation owns `pushing`, so here the pose is driven alone, as a
// player standing against a block would set it.
const pose=(n,fields)=>{for(let i=0;i<n;i++){Object.assign(game.player,fields);w.time+=1/60;animateHero(w,game,1/60);}};
pose(20,{pushing:1,pushed:2.4});assert.equal(c.state,'push');assert(c.weights.push>.9);assert.equal(c.actions.push.timeScale,2.4,'a moving block hurries the shove');
pose(2,{pushing:1,pushed:0});assert.equal(c.actions.push.timeScale,1,'a stopped block is leant on at the take\'s own pace');
pose(1,{pushing:0,pushed:0});assert.equal(c.state,'pushStop');assert(c.pushStop>0);
pose(Math.round(c.clips.pushStop.duration*60)+5,{pushing:0});assert.equal(c.state,'locomotion');assert(c.weights.idle>.5,'and the idle takes over');
pose(10,{pushing:1});assert.equal(c.state,'push');game.player.pushing=0;step(20,{right:true});assert.equal(c.state,'locomotion');assert.equal(c.pushStop,0,'walking away skips the stop');
console.log('PASS analog walk/run blending, moving jump, paused pose, stomp, damage recovery, knockdown, respawn, celebration, and the push with its stop');

game.player.facing=-1;step(100);assert(Math.abs(c.turn-Math.PI)<.01);
game.player.facing=1;step(100);assert(c.turn<.01);assert.equal(c.model.scale.x,c.model.scale.z);
console.log('PASS left/right turns preserve model scale and the fixed physics origin');

game.start(0);heroEvent(c,{type:'respawn'});step(479);
assert.equal(c.idleVariant,'idle');assert.equal(c.weights.longIdle,0);assert(c.weights.idle>.99);
step(2);assert.equal(c.idleVariant,'longIdle');assert(c.actions.longIdle.time<.04,'long idle starts at its beginning after four seconds');
game.pause();const idleClock=c.idleTime,actionClock=c.actions.longIdle.time;step(240);
assert.equal(c.idleTime,idleClock);assert.equal(c.actions.longIdle.time,actionClock);game.resume();
step(35,{right:true});assert.equal(c.idleTime,0);assert(c.weights.longIdle<.01,'movement interrupts the fidget');
game.start(0);heroEvent(c,{type:'respawn'});step(1210);
assert(c.longIdlePlayed);assert.equal(c.idleVariant,'idle');assert(c.weights.idle>.99,'return to the new idle after one fidget');
const finished=c.actions.longIdle.time;step(300);assert.equal(c.actions.longIdle.time,finished);assert.equal(c.idleVariant,'idle');
step(1,{right:true});assert.equal(c.longIdlePlayed,false);assert.equal(c.idleTime,0);
console.log('PASS new default idle, strict four-second delay, interruption, paused timer and one fidget per continuous rest');

// The reward uses the real rig: both wrists reach one stem and normal motion continues.
game.start(0);heroEvent(c,{type:'respawn'});game.flowerCelebration={id:0,time:.25};
animateHero(w,game,1/60);
assert(c.flower.root.visible);assert.equal(c.root.visible,true);
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
console.log('PASS both-hand flower hold, manual-pause stability, continuous locomotion and chapter cleanup');

// Compare against a second copy of the actual rig. Its lower body must be
// identical while the primary rig layers the flower pose over the same live clip.
const lowerNames=['Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
const baselineWorld={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
baselineWorld.character=createHero(baselineWorld);baselineWorld.scene.add(baselineWorld.character.root);
const baselineGltf=await readPlayer();attachHero(baselineWorld,baselineGltf,motion,idle);
const baseline=baselineWorld.character,baselineGame=new Game(e=>heroEvent(baseline,e));
const lowerPose=character=>lowerNames.map(name=>{const bone=character.asset.getObjectByName(name);return [...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray()];});
const samePose=(actual,expected,message)=>actual.forEach((matrix,i)=>matrix.forEach((value,j)=>assert(Math.abs(value-expected[i][j])<1e-9,message)));
for(const mode of ['run','jumpRise','jumpFall','leapRise','leapFall','stomp']){
 game.start(0);heroEvent(c,{type:'respawn'});baselineGame.start(0);heroEvent(baseline,{type:'respawn'});
 const air=mode!=='run';Object.assign(game.player,{vx:6,vy:mode.endsWith('Rise')?7:-5,groundId:air?null:game.player.groundId,stomping:mode==='stomp'});
 Object.assign(baselineGame.player,{vx:game.player.vx,vy:game.player.vy,groundId:game.player.groundId,stomping:game.player.stomping});
 c.jumpKind=baseline.jumpKind=mode.startsWith('leap')?'leap':'jump';
 for(let i=0;i<8;i++){animateHero(w,game,1/60);animateHero(baselineWorld,baselineGame,1/60);}
 const mixerTime=c.mixer.time;
 for(let i=0;i<30;i++){
  const primaryBefore=c.mixer.time,baselineBefore=baseline.mixer.time;
  game.flowerCelebration={id:0,time:i/60};animateHero(w,game,1/60);
  animateHero(baselineWorld,baselineGame,1/60);
  samePose(lowerPose(c),lowerPose(baseline),`${mode}: flower overlay changed the lower body`);
  assert.equal(c.state,baseline.state);
  assert(Math.abs((c.mixer.time-primaryBefore)-(baseline.mixer.time-baselineBefore))<1e-12,`${mode}: base clip advanced differently`);
 }
 assert(c.mixer.time>mixerTime,`${mode}: base clip keeps advancing`);
 game.flowerCelebration=null;animateHero(w,game,1/60);animateHero(baselineWorld,baselineGame,1/60);
 samePose(lowerPose(c),lowerPose(baseline),`${mode}: release changed the lower body`);assert(!c.flower.root.visible);
}
console.log('PASS upper-body-only pickup: running, rising/falling jumps, leaps and stomp keep their live lower-body clips throughout');

// Waiting through a long boss volley must not start either relaxed idle clip.
game.start(1);heroEvent(c,{type:'respawn'});
Object.assign(game.player,{x:287,y:33.4,vx:0,vy:0,groundId:'mother-arena'});
for(const state of ['reveal','inhale','release','recover','hurt']){
 game.level.boss.state=state;
 for(let i=0;i<360;i++)animateHero(w,game,1/120);
 assert.equal(c.idleVariant,'idle');assert.equal(c.weights.longIdle,0);assert.equal(c.actions.idle.time,0);
}
game.player.vx=2;
for(let i=0;i<60;i++)animateHero(w,game,1/120);
assert(c.weights.walk>.98,'automatic entrance still plays the walk animation');
game.player.vx=0;game.level.boss.state='defeated';
for(let i=0;i<481;i++)animateHero(w,game,1/120);
assert.equal(c.idleVariant,'longIdle','ordinary rest animation returns after the encounter');
console.log('PASS boss encounter suppresses relaxed idle and yawn while preserving walking and post-battle idle');
