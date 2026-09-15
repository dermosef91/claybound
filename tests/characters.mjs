// Every selectable character has to be interchangeable, not merely loadable:
// the same nine states, the same feet on the same floor, the same normalized
// height and gameplay origin, and the same two hands on the flower. Anything
// less and choosing one in the settings changes how the game plays.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero,detachHero,animateHero,heroEvent} from '../dist/hero.js';
import {CHARACTERS,characterChoice} from '../dist/characters.js';
import {readGLB} from './load-player.mjs';
import {Game} from '../dist/simulation.js';

const url=name=>new URL('../dist/assets/'+name,import.meta.url);
const json=name=>readFile(url(name),'utf8').then(JSON.parse);
const stage=()=>{
  const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,
    mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
  w.character=createHero(w);w.scene.add(w.character.root);return w;
};
const load=async choice=>({
  gltf:await readGLB(url(choice.model)),motion:await json(choice.motion),animation:await json(choice.animation)
});

assert.equal(characterChoice('emberleaf').id,'emberleaf');
assert.equal(characterChoice('nobody').id,CHARACTERS[0].id,'an unknown id falls back to the original');
assert.equal(characterChoice(undefined).id,CHARACTERS[0].id);

const heights=[],origins=[];
for(const choice of CHARACTERS){
  const {gltf,motion,animation}=await load(choice);
  assert.equal(createHash('sha256').update(await readFile(url(choice.model))).digest('hex'),motion.shippedSha256,
    `${choice.id}: floor corrections were baked against the exact shipped GLB`);
  assert.equal(animation.playerSha256,motion.sourceSha256,`${choice.id}: animations and motion describe one character`);

  const w=stage();attachHero(w,gltf,motion,animation,choice);const c=w.character;
  assert.equal(c.choice.id,choice.id);
  assert(c.hips.isBone);assert.equal(c.hips.name,'Hips','the rig exposes its root under the name the game binds to');
  assert.deepEqual(Object.keys(c.clips).sort(),
    ['death','hurt','idle','jumpFall','jumpRise','land','leapFall','leapRise','longIdle','run','stomp','victory','walk'].sort(),
    `${choice.id}: the full state vocabulary is present`);

  const bounds=()=>{c.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(c.model,true);};
  heights.push(bounds().max.y);origins.push(bounds().min.y);
  for(const [name,clip] of Object.entries(c.clips)){
    const track=clip.tracks.find(t=>t.name==='Hips.position');
    for(let i=0;i<track.values.length;i+=3){
      assert(Math.abs(track.values[i]-motion.anchor[0])<1e-5);assert(Math.abs(track.values[i+2]-motion.anchor[2])<1e-5);
    }
    for(const a of Object.values(c.actions))a.stop();
    const action=c.actions[name];action.reset().play().setEffectiveWeight(1);
    for(let i=0;i<=20;i++){
      action.time=clip.duration*i/20;c.mixer.update(0);const box=bounds();
      assert([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),`${choice.id} ${name}: finite bounds`);
      assert(Math.abs(c.hips.position.x-motion.anchor[0])<1e-4,`${choice.id} ${name}: lateral root drift`);
      assert(Math.abs(c.hips.position.z-motion.anchor[2])<1e-4,`${choice.id} ${name}: forward root drift`);
      if(clip.userData.mode==='ground')assert(Math.abs(box.min.y)<.045,`${choice.id} ${name}: feet at ${box.min.y}`);
      else assert(Math.abs(c.hips.position.y-motion.anchor[1])<1e-3,`${choice.id} ${name}: airborne root displacement`);
      // A retarget that tore a limb loose shows up as a body wider or taller
      // than any pose of a person this size could be.
      assert(box.max.y<2.6&&box.max.x-box.min.x<2.6,`${choice.id} ${name}: implausible silhouette`);
    }
  }

  // The reward reaches for joints by name, so it has to find them on every rig.
  const game=new Game(e=>heroEvent(c,e));game.start(0);heroEvent(c,{type:'respawn'});
  game.flowerCelebration={id:0,time:.25};animateHero(w,game,1/60);
  assert(c.flower.root.visible);assert(c.flower.head,`${choice.id}: the celebration found a head to tilt`);
  const wrists=c.flower.chains.map(chain=>{
    assert(chain.every(Boolean),`${choice.id}: both arms resolve to four joints`);
    return c.facing.worldToLocal(chain[3].getWorldPosition(new THREE.Vector3()));
  });
  assert(wrists[0].distanceTo(wrists[1])<.26,`${choice.id}: both hands hold the same flower`);
  for(const wrist of wrists)assert(wrist.y>1.25&&wrist.z>.2,`${choice.id}: hands lift in front of the hood`);

  // Walking and running are what a player sees most; both must blend from rest.
  game.flowerCelebration=null;game.start(0);heroEvent(c,{type:'respawn'});
  const step=(n,input={})=>{for(let i=0;i<n;i++){game.tick(1/120,{...input,jumpPressed:!!input.jumpPressed&&i===0});w.time+=1/120;animateHero(w,game,1/120);}};
  step(60);assert.equal(c.state,'locomotion');assert(c.weights.idle>.98,`${choice.id}: settles into idle`);
  step(35,{moveAxis:.3,right:true});assert(c.weights.walk>.8,`${choice.id}: walks`);
  step(45,{right:true});assert(c.weights.run>.95,`${choice.id}: runs`);
  step(1,{right:true,jumpHeld:true,jumpPressed:true});assert.equal(c.state,'leapRise',`${choice.id}: leaps`);
  console.log(`PASS ${choice.name}: ${c.sourceClips.length} source clips, every state grounded, framed and blending`);
}

// Framing, the camera and every jump distance in the game are tuned to one
// silhouette, so a second character may look different but not measure
// different. Each rig is normalized on its T-pose, so how tall it stands at rest
// can still differ by a posture's worth — a few centimetres, not a head.
const spread=Math.max(...heights)-Math.min(...heights);
assert(spread<.06,`standing heights differ by ${spread.toFixed(3)}: ${heights.map(h=>h.toFixed(3)).join(', ')}`);
for(const origin of origins)assert(Math.abs(origin)<.01,'the gameplay origin stays between the feet');
console.log(`PASS all ${CHARACTERS.length} characters stand within ${Math.round(spread*1000)} mm of each other over the same origin`);

// Choosing in the settings swaps rigs inside a running world: one model in, one
// model out, and the newcomer animating on the same group the game already
// drives. Cycling the whole cast proves no rig is left attached behind another.
const w=stage(),c=w.character,game=new Game(e=>heroEvent(c,e));game.start(0);
for(const choice of [...CHARACTERS,CHARACTERS[0]]){
  const outgoing=c.model;
  detachHero(w);
  if(outgoing){
    assert.equal(c.loaded,false);assert.equal(c.model,undefined);assert.equal(outgoing.parent,null);
    assert.equal(c.facing.children.length,0,'nothing is left behind in the model group');
    animateHero(w,game,1/60);assert.equal(c.root.visible,false,'an empty rig draws nothing rather than a stale pose');
  }
  const next=await load(choice);attachHero(w,next.gltf,next.motion,next.animation,choice);
  assert.equal(c.facing.children.length,1,`${choice.id}: exactly one rig is worn`);
  assert.equal(c.choice.id,choice.id);
  game.start(0);heroEvent(c,{type:'respawn'});
  for(let i=0;i<120;i++){game.tick(1/120,{right:true});animateHero(w,game,1/120);}
  assert(c.weights.run>.95,`${choice.id}: takes over the run mid-stride`);
  assert.equal(c.root.position.x,game.player.x);assert.equal(c.root.position.y,game.player.y);
}
detachHero(w);detachHero(w);
console.log(`PASS swapping through all ${CHARACTERS.length} characters and back releases each rig and keeps the game running`);
