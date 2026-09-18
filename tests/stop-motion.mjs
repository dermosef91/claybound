// Stop motion is shot on twos: with the setting on, every puppet's pose holds
// for a twelfth of a second and then cuts, together, to the next; the world it
// stands in keeps moving at sixty. Off, nothing changes — the clock hands each
// frame's dt straight through, so the game the player had is the game they keep.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {STOP_MOTION_FPS,createPuppetClock,tickPuppets,puppetStep,boilPuppet,BOIL} from '../dist/stop-motion.js';
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
  const advanced=[];
  for(let i=0;i<12;i++){c=tickPuppets(w,1/60);advanced.push(puppetStep(c,1/60));}
  assert.deepEqual(advanced.slice(0,4),[0,0,0,0],'four frames hold');
  assert(Math.abs(advanced[4]-5/60)<1e-9,'the fifth frame spends the whole twelfth');
  assert.deepEqual(advanced.slice(5,9),[0,0,0,0]);assert(advanced[9]>0,'and the tenth the next');
  assert.equal(c.frame,2,'two exposures in twelve frames at sixty');
  assert(Math.abs(advanced.reduce((a,b)=>a+b,0)+c.held-12/60)<1e-9,'no time is lost: what is held is spent or still held');
  assert(Math.abs(1/STOP_MOTION_FPS-1/12)<1e-12);
  c=tickPuppets(w,0);assert.equal(c.step,0);assert(!c.stepped,'a paused frame exposes nothing');
  w.stopMotion=false;c=tickPuppets(w,1/60);assert(!c.on);assert.equal(c.held,0,'turning it off drops the held time');
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
  assert(cuts>=4&&cuts<=5,`twenty-four frames at sixty cut ${cuts} times, about twice a fifth of a second`);
  assert(offsets.every(o=>o.length()>0&&o.length()<BOIL*2),'each exposure boils the prints by a hair, never further');
  // Off again: the pose eases every frame and the prints go back where they were.
  w.stopMotion=false;frame(1/60,{right:true});
  assert.deepEqual(offsets.map(o=>o.toArray()),offsets.map(()=>[0,0,0]),'the boil is put back when the setting goes off');
  const eased=pose();frame(1/60,{right:true});assert.notDeepEqual(pose(),eased,'every frame moves again');
  // A puppet that never boiled has nothing to put back, and says so cheaply.
  const plain=new THREE.Group();plain.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  boilPuppet(plain,w.puppetClock);assert(!plain.userData.boiled);

  // A landing squashes the body on a spring. Stepped, that spring is fed a
  // twelfth of a second at a time, which is past what its stiffness can take
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
console.log('PASS stop motion: the clock holds four frames and spends the fifth, the hero cuts pose, blends and skin together while its feet keep moving, and off is exactly what it was');
