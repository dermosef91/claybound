// Stop motion is shot on threes: with the setting on, every puppet's pose holds
// for an eighth of a second and then cuts, together, to the next; the world it
// stands in keeps moving at sixty. Off, nothing changes — the clock hands each
// frame's dt straight through, so the game the player had is the game they keep.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {STOP_MOTION_FPS,createPuppetClock,tickPuppets,puppetStep,heldSample,boilPuppet,BOIL} from '../dist/stop-motion.js';
import {createHero,attachHero,animateHero,heroEvent} from '../dist/hero.js';
import {CHARACTERS} from '../dist/characters.js';
import {readGLB} from './load-player.mjs';
import {attachClay} from './load-clay.mjs';
import {Game} from '../dist/simulation.js';

// The clock: off passes dt through; on holds, then spends the held time whole.
{
  const w={stopMotion:false};
  let c=tickPuppets(w,1/60);
  assert.equal(c.step,1/60);assert(c.stepped);assert.equal(puppetStep(c,1/60),1/60,'off, a frame advances by its own dt');
  assert.equal(puppetStep(c,.4),.05,'off, a hitch is clamped the way every animator clamps it');
  assert.equal(puppetStep(undefined,1/60),1/60,'an animator with no clock at all behaves as before');
  w.stopMotion=true;
  // At sixty, an eighth of a second is seven frames held and the eighth spent.
  const per=Math.ceil(60/STOP_MOTION_FPS),advanced=[];
  assert.equal(STOP_MOTION_FPS,8,'shot on threes: eight poses a second');
  for(let i=0;i<2*per;i++){c=tickPuppets(w,1/60);advanced.push(puppetStep(c,1/60));}
  assert.deepEqual(advanced.slice(0,per-1),Array(per-1).fill(0),`${per-1} frames hold`);
  assert(Math.abs(advanced[per-1]-per/60)<1e-9,`the ${per}th frame spends the whole eighth`);
  assert.deepEqual(advanced.slice(per,2*per-1),Array(per-1).fill(0));assert(advanced[2*per-1]>0,'and the next exposure follows in turn');
  assert.equal(c.frame,2,`two exposures in ${2*per} frames at sixty`);
  assert(Math.abs(advanced.reduce((a,b)=>a+b,0)+c.held-2*per/60)<1e-9,'no time is lost: what is held is spent or still held');
  c=tickPuppets(w,0);assert.equal(c.step,0);assert(!c.stepped,'a paused frame exposes nothing');
  w.stopMotion=false;c=tickPuppets(w,1/60);assert(!c.on);assert.equal(c.held,0,'turning it off drops the held time');
  // A pose that reads the simulation reads it as it stood at the last exposure.
  const view={},live={angle:0},on={on:true},off={on:false};
  assert.equal(heldSample(on,view,1/60,()=>({...live})).angle,0);
  live.angle=1;assert.equal(heldSample(on,view,0,()=>({...live})).angle,0,'held: the old reading');
  assert.equal(heldSample(on,view,1/8,()=>({...live})).angle,1,'exposed: the fresh one');
  live.angle=2;assert.equal(heldSample(off,view,0,()=>({...live})).angle,2,'off the clock even a paused frame reads live — a pause is not a hold');
  assert.equal(heldSample(undefined,view,0,()=>({...live})).angle,2,'and so does a view with no clock at all');
}

// The hero on the clock: its pose, blends and skin hold and cut together, and
// its position does not — the root follows the simulation every frame.
{
  const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,stopMotion:true,puppetClock:createPuppetClock(),
    mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;},ball(){return new THREE.Mesh();}};
  await attachClay(w);
  const choice=CHARACTERS[0],url=name=>new URL('../dist/assets/'+name,import.meta.url),json=name=>readFile(url(name),'utf8').then(JSON.parse);
  w.character=createHero(w);w.scene.add(w.character.root);
  attachHero(w,await readGLB(url(choice.model)),await json(choice.motion),await json(choice.animation),choice);
  const c=w.character,game=new Game(e=>heroEvent(c,e));game.start(0);heroEvent(c,{type:'respawn'});
  const offsets=[];c.asset.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])offsets.push(m.userData.clay.offset);});
  assert(offsets.length>0,'the hero wears the relief, whose offset the boil moves');
  const pose=()=>c.asset.getObjectByName('LeftArm').quaternion.toArray().map(v=>+v.toFixed(6));
  const frame=(dt,input={})=>{game.tick(dt,input);tickPuppets(w,dt);animateHero(w,game,dt);};
  // Walk, so the gait and the crossfades are live, then watch a run of frames.
  for(let i=0;i<30;i++)frame(1/60,{right:true});
  const before=pose(),x0=c.root.position.x,mixerTime=c.mixer.time,offset0=offsets[0].clone();
  frame(1/60,{right:true});
  assert.deepEqual(pose(),before,'a held frame changes no bone');
  assert.equal(c.mixer.time,mixerTime,'nor the mixer');
  assert.deepEqual(offsets[0].toArray(),offset0.toArray(),'nor the skin');
  assert(c.root.position.x>x0,'but the puppet still moves with the game');
  let cuts=0,last=pose();
  for(let i=0;i<24;i++){frame(1/60,{right:true});const now=pose();if(now.some((v,k)=>v!==last[k]))cuts++;last=now;}
  assert(cuts>=2&&cuts<=4,`twenty-four frames at sixty cut ${cuts} times, about three`);
  assert(offsets.every(o=>o.length()>0&&o.length()<BOIL*2),'each exposure boils the prints by a hair, never further');
  // Off again: the pose eases every frame and the prints go back where they were.
  w.stopMotion=false;frame(1/60,{right:true});
  assert.deepEqual(offsets.map(o=>o.toArray()),offsets.map(()=>[0,0,0]),'the boil is put back when the setting goes off');
  const eased=pose();frame(1/60,{right:true});assert.notDeepEqual(pose(),eased,'every frame moves again');
  // A puppet that never boiled has nothing to put back, and says so cheaply.
  const plain=new THREE.Group();plain.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  boilPuppet(plain,w.puppetClock);assert(!plain.userData.boiled);

  // A landing squashes the body on a spring. Stepped, that spring is fed an
  // eighth of a second at a time, which is past what its stiffness can take
  // in one Euler step: left alone it rang against its clamp for ever, and the
  // puppet shivered after every jump. It has to settle the way it does at sixty.
  // Peak squash over each fifth of a second, for three seconds after a landing.
  const settle=(on,frames)=>{
    w.stopMotion=on;heroEvent(c,{type:'land',impact:12});
    const peaks=[];let peak=0;
    for(let i=0;i<frames;i++){frame(1/60);peak=Math.max(peak,Math.abs(c.spring));if(i%12===11){peaks.push(peak);peak=0;}}
    return peaks;
  };
  const smooth=settle(false,180),stepped=settle(true,180);
  assert(smooth[0]>.1&&smooth.at(-1)<.005,'at sixty the landing squash rings and dies within three seconds');
  assert(stepped[0]>.05,'stepped, the landing still squashes');
  assert(stepped.at(-1)<.005,`stepped, the squash dies away too, not ${stepped.at(-1).toFixed(3)} after three seconds`);
  for(let i=1;i<stepped.length;i++)assert(stepped[i]<=Math.max(stepped[i-1],.03)+1e-9,'and never grows back');
  w.stopMotion=false;
}
// A creature on the clock: a pose that reads the simulation directly — the
// spitter's wind-up follows its state timer — holds between exposures and cuts
// with everyone else, while where it stands is read live every frame.
{
  const {attachSpitter}=await import('./load-spitter.mjs');
  const {createSpitterView,animateSpitter}=await import('../dist/spitter.js');
  const w={mat:{},levelRoot:new THREE.Group(),fxRoot:new THREE.Group(),stopMotion:true,puppetClock:createPuppetClock()};await attachSpitter(w);
  const e={id:1,x:2,y:3,dir:-1,alive:true,aiState:'charge',stateTime:0};
  const v=createSpitterView(w,e);
  const frame=dt=>{e.stateTime+=dt;e.x+=dt*.2;tickPuppets(w,dt);animateSpitter(v,e,dt,'playing');};
  const head=()=>v.head.quaternion.toArray().map(q=>+q.toFixed(6));
  frame(1/60);const wound=head(),x=v.root.position.x;
  for(let i=0;i<5;i++)frame(1/60);
  assert.deepEqual(head(),wound,'the wind-up holds through the held frames although the state timer ran on');
  assert(v.root.position.x>x,'while the creature itself keeps moving');
  for(let i=0;i<3;i++)frame(1/60);
  assert.notDeepEqual(head(),wound,'and cuts to the wound-up pose on the exposure');
  w.stopMotion=false;frame(1/60);const a=head();frame(1/60);assert.notDeepEqual(head(),a,'off, the wind-up eases every frame');
}
console.log('PASS stop motion: the clock holds seven frames and spends the eighth, the hero cuts pose, blends and skin together while its feet keep moving, a landing settles, a creature holds its wind-up, and off is exactly what it was');
