// Every selectable character has to be interchangeable, not merely loadable:
// the same nine states, the same feet on the same floor, the same normalized
// height and gameplay origin, and the same two hands on the flower. Anything
// less and choosing one in the settings changes how the game plays.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero,detachHero,animateHero,heroEvent} from '../dist/hero.js';
import {CHARACTERS,characterChoice,DEFAULT_CHARACTER} from '../dist/characters.js';
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
assert.equal(DEFAULT_CHARACTER,'apprentice','the apprentice is who everyone starts as');
assert.equal(characterChoice('nobody').id,DEFAULT_CHARACTER,'an unknown id falls back to the default');
assert.equal(characterChoice(undefined).id,DEFAULT_CHARACTER);
assert.equal(CHARACTERS[0].id,'clay','the original stays first in the cast: it is the rig the others were retargeted from');

for(const choice of CHARACTERS){
  const {gltf,motion,animation}=await load(choice);
  assert.equal(createHash('sha256').update(await readFile(url(choice.model))).digest('hex'),motion.shippedSha256,
    `${choice.id}: floor corrections were baked against the exact shipped GLB`);
  assert.equal(animation.playerSha256,motion.sourceSha256,`${choice.id}: animations and motion describe one character`);

  const w=stage();attachHero(w,gltf,motion,animation,choice);const c=w.character;
  assert.equal(c.choice.id,choice.id);
  assert(c.hips.isBone);assert.equal(c.hips.name,'Hips','the rig exposes its root under the name the game binds to');
  // The push is the one state a rig may lack: it is carried only once a push
  // clip has been prepared beside the idle (scripts/prepare-push.mjs).
  assert.deepEqual(Object.keys(c.clips).filter(k=>k!=='push'&&k!=='pushStop').sort(),
    ['death','hurt','idle','jumpFall','jumpRise','land','leapFall','leapRise','longIdle','run','slide','slideStop','stomp','victory','walk'].sort(),
    `${choice.id}: the full state vocabulary is present`);
  // The slide ships with the original and is retargeted onto everyone else, so
  // unlike the push no rig is without it: it glides to the seam and stands up after.
  assert(Math.abs(c.clips.slide.duration-.8)<1e-3&&c.clips.slideStop.duration>.5,
    `${choice.id}: the slide glides to the seam and the getting-up follows`);
  assert.equal('push' in c.clips,c.sourceClips.some(name=>/push/i.test(name)),`${choice.id}: a push state exactly when a push clip was supplied`);
  if(c.clips.push){
    assert.equal(c.clips.push.userData.source,'Push_Forward_and_Stop',`${choice.id}: the supplied take is the push`);
    assert(c.clips.pushStop&&Math.abs(c.clips.push.duration-1.9)<1e-3&&c.clips.pushStop.duration>.5,`${choice.id}: the shove loops to the seam and the stop follows`);
  }

  // Only the original is pulled toward the game's orange; the supplied
  // characters were painted in clay colours already and keep their own. A
  // character that asks for a deeper clay press carries that on the material
  // too, where the relief reads it whichever of rig and ball loads first.
  c.asset.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
    assert.equal(material.userData.clayOrangeSource,choice.orangeSource,`${choice.id}: colour adjustment as declared`);
    assert.equal(material.userData.clayDepth,choice.clayDepth,`${choice.id}: relief depth as declared`);
  }});
  if(choice.clayDepth)assert(choice.clayDepth>.025&&choice.clayDepth<=.075,`${choice.id}: a declared press sits between the model default and the terrain`);
  // A mirrored character is turned over on the normalized group alone, so the
  // group the game drives and the facing it turns are untouched.
  assert.equal(Math.sign(c.model.scale.x),choice.mirror?-1:1,`${choice.id}: mirrored as declared`);
  assert(c.model.scale.y>0&&c.model.scale.z>0&&Math.abs(c.model.scale.x)===c.model.scale.y,`${choice.id}: the mirror is a reflection, not a squash`);

  const bounds=()=>{c.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(c.model,true);};
  // Framing, shadow, reach and the motes that circle the head are all expressed
  // as multiples of the original's build, so that number has to be what the
  // character actually measures — normalized on its T-pose, so its standing
  // height may differ by a posture's worth but not more.
  assert(Math.abs(bounds().max.y-choice.height)<choice.height*.05,
    `${choice.id}: stands ${bounds().max.y.toFixed(2)} against a declared ${choice.height.toFixed(2)}`);
  assert(Math.abs(bounds().min.y)<.01,`${choice.id}: the gameplay origin stays between the feet`);
  assert(Math.abs(c.build-choice.height/1.78)<1e-9);

  // The original rig rests in an A-pose and the supplied ones in a T-pose, so a
  // retarget that carried rotations away from each rig's own rest would stand
  // the new characters up like scarecrows. Measured against their own height,
  // every character's arms must hang the way the original's do.
  for(const side of ['Left','Right']){
    const shoulder=c.facing.worldToLocal(c.asset.getObjectByName(side+'Arm').getWorldPosition(new THREE.Vector3()));
    const hand=c.facing.worldToLocal(c.asset.getObjectByName(side+'Hand').getWorldPosition(new THREE.Vector3()));
    const drop=(shoulder.y-hand.y)/choice.height,out=Math.abs(hand.x)/choice.height;
    assert(drop>.18&&drop<.30,`${choice.id}: ${side} arm hangs ${drop.toFixed(3)} of its height below the shoulder`);
    assert(out<.24,`${choice.id}: ${side} hand stands ${out.toFixed(3)} of its height out from the centre line`);
  }
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
      assert(box.max.y<choice.height*1.5&&box.max.x-box.min.x<choice.height*1.5,`${choice.id} ${name}: implausible silhouette`);
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
  assert(wrists[0].distanceTo(wrists[1])<.26*c.build,`${choice.id}: both hands hold the same flower`);
  for(const wrist of wrists)assert(wrist.y>1.25*c.build&&wrist.z>.2*c.build,`${choice.id}: hands lift in front of the hood`);
  // The arms are solved in world space; on a mirrored rig that has to go
  // through the parent's full transform, or the hands wander off the stem.
  const stem=new THREE.Vector3(0,1.48,.38).multiplyScalar(c.build);
  for(const wrist of wrists)assert(wrist.distanceTo(stem)<.3*c.build,`${choice.id}: a hand reaches the stem, ${wrist.distanceTo(stem).toFixed(2)} away`);

  // Walking and running are what a player sees most; both must blend from rest.
  game.flowerCelebration=null;game.start(0);heroEvent(c,{type:'respawn'});
  const step=(n,input={})=>{for(let i=0;i<n;i++){game.tick(1/120,{...input,jumpPressed:!!input.jumpPressed&&i===0});w.time+=1/120;animateHero(w,game,1/120);}};
  step(60);assert.equal(c.state,'locomotion');assert(c.weights.idle>.98,`${choice.id}: settles into idle`);
  step(35,{moveAxis:.3,right:true});assert(c.weights.walk>.8,`${choice.id}: walks`);
  step(45,{right:true});assert(c.weights.run>.95,`${choice.id}: runs`);
  step(1,{right:true,jumpHeld:true,jumpPressed:true});assert.equal(c.state,'leapRise',`${choice.id}: leaps`);
  console.log(`PASS ${choice.name}: ${c.sourceClips.length} source clips, ${choice.height.toFixed(2)} units tall, arms hanging, every state grounded and blending`);
}

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
