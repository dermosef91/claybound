// Give a supplied character the game's whole movement vocabulary.
//
// These files arrive with a single Running cycle, so every other state the hero
// needs — idle, fidget, walk, jump, leap, hurt, knockdown, celebration — is
// retargeted from the original character onto the new rig here, once, offline.
// They are all T-posed humanoids with the same joints under different names, so
// a bone's animated world rotation can be moved across as a rest-relative delta
// and rewritten in the target's own parent space. Sampling and floor
// corrections then follow prepare-player.mjs exactly, which is what lets
// hero.js treat every character identically at runtime.
//
// Usage: node scripts/prepare-character.mjs NAME   (after prepare-textures.py
// has written dist/assets/NAME.glb and its manifest).
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB,readPlayer} from '../tests/load-player.mjs';

const asset=name=>new URL('../dist/assets/'+name,import.meta.url);
const name=process.argv[2];
if(!name)throw new Error('Name the shipped character, e.g. `node scripts/prepare-character.mjs wanderer`.');

// Donor joint → supplied joint, without the rig's `mixamorig` prefix. The
// original's spine is numbered from the chest down, so the three links have to
// be paired by position in the chain rather than by name.
const JOINTS={
  Hips:'Hips',Spine02:'Spine',Spine01:'Spine1',Spine:'Spine2',
  neck:'Neck',Head:'Head',head_end:'HeadTop_End',
  LeftShoulder:'LeftShoulder',LeftArm:'LeftArm',LeftForeArm:'LeftForeArm',LeftHand:'LeftHand',
  RightShoulder:'RightShoulder',RightArm:'RightArm',RightForeArm:'RightForeArm',RightHand:'RightHand',
  LeftUpLeg:'LeftUpLeg',LeftLeg:'LeftLeg',LeftFoot:'LeftFoot',LeftToeBase:'LeftToeBase',
  RightUpLeg:'RightUpLeg',RightLeg:'RightLeg',RightFoot:'RightFoot',RightToeBase:'RightToeBase'
};
// The joint each bone aims at. Taken explicitly rather than from the first
// child, because which child comes first at a branch — chest to neck or chest
// to shoulder — is an accident of how the rig was exported.
//
// The ankle is deliberately not among them. Aiming a bone assumes the two rigs
// disagree about the pose they rest in, which for the arms is exactly true: one
// rests in an A-pose and the other in a T-pose. The feet rest in the same pose
// on both — flat on the floor the character was modelled standing on — and the
// line from ankle to toe describes the shape of a shoe rather than the
// direction of a limb. Aiming one at the other therefore transfers a difference
// that is not a difference, and it lands on the one joint that decides where the
// floor is: the original's toe sits a third of a foot below its ankle and this
// rig's barely at all, so aiming pointed the new character's toes down and its
// sole corrections then stood it on them.
const AIMS={
  Hips:'Spine02',Spine02:'Spine01',Spine01:'Spine',Spine:'neck',neck:'Head',Head:'head_end',
  LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',
  RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',
  LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',
  RightUpLeg:'RightLeg',RightLeg:'RightFoot'
};
// Every joint above is anatomy a humanoid rig has to have. The crown is not: it
// is a marker some exporters leave above the head and others end without, so a
// rig may arrive without one and the head is then aimed like any other tip.
const OPTIONAL=new Set(['head_end']);
const PREFIX='mixamorig';
// Every clip hero.js names, plus the floor-corrected subset. Airborne excerpts
// are cut from Regular_Jump and Jump_Over_Obstacle_2, whose vertical travel the
// game replaces with its own physics, so only the grounded ones need a floor.
const WANTED=['Armature|Idle_9|baselayer','Idle_03','Walking','Running','Regular_Jump','Jump_Over_Obstacle_2','Face_Punch_Reaction_2','Knock_Down','Skip_Forward'];
const GROUNDED=new Set(['Armature|Idle_9|baselayer','Idle_03','Walking','Running','Regular_Jump','Face_Punch_Reaction_2','Knock_Down','Skip_Forward']);

const [donor,target,idle,manifest]=await Promise.all([
  readPlayer(),readGLB(asset(`${name}.glb`)),
  readFile(asset('player-idle.json'),'utf8').then(JSON.parse),
  readFile(asset(`${name}.json`),'utf8').then(JSON.parse)
]);

// Drop the rig's vendor prefix here exactly as hero.js does on load, so the
// clips written below name the joints the game will actually be binding to.
target.scene.traverse(o=>{if(o.name.startsWith(PREFIX))o.name=o.name.slice(PREFIX.length);});
donor.scene.updateMatrixWorld(true);target.scene.updateMatrixWorld(true);
const bone=(scene,name)=>{const b=scene.getObjectByName(name);if(!b?.isBone)throw new Error(`Missing joint: ${name}`);return b;};
const carried=from=>!OPTIONAL.has(from)||!!target.scene.getObjectByName(JOINTS[from])?.isBone;
const pairs=Object.keys(JOINTS).filter(carried).map(from=>({from,source:bone(donor.scene,from),joint:bone(target.scene,JOINTS[from])}));
// Parent before child: a joint's local rotation is only meaningful once the
// chain above it already holds its retargeted pose.
const chain=[];target.scene.traverse(o=>{if(o.isBone)chain.push(o);});
const partner=new Map(pairs.map(({source,joint})=>[joint,source]));

// Both rest poses are read before anything is animated: measuring the floor
// leaves the target rig posed, and every later frame is built from these.
const rest=new Map(),restLocal=new Map();
for(const object of [...chain,...pairs.map(p=>p.source)])rest.set(object,object.getWorldQuaternion(new THREE.Quaternion()));
for(const joint of chain)restLocal.set(joint,joint.quaternion.clone());

// What crosses over is each joint's *absolute* orientation, not its rotation
// away from its own rest. The original rig rests in an A-pose and every
// supplied rig in a T-pose, so a rest-relative transfer would hand the new
// characters the original's arm motion measured from forty degrees too high and
// leave them standing like scarecrows. The constant kept here is therefore the
// only genuine difference between the two bone frames: how each rig rolls its
// bones about their own length, measured once the two rest limbs have been
// swung into line. Aim the joint the same way the animator aimed the original,
// and turn it the way this rig expects to be turned.
const aim=(from,to)=>to.getWorldPosition(new THREE.Vector3()).sub(from.getWorldPosition(new THREE.Vector3())).normalize();
// A joint with nothing to aim — a hand, a foot, a toe, or a head on a rig that
// marks no crown — keeps the alignment of the limb it finishes, which is the
// nearest joint above it that was aimed. On a rig with spare links between the
// neck and the head, that is not always its own parent.
const inherit=(swings,joint)=>{
  for(let above=joint.parent;above;above=above.parent)if(swings.has(above))return swings.get(above).clone();
  return new THREE.Quaternion();
};
const frame=new Map(),swings=new Map();
for(const {from,source,joint} of pairs){
  const at=AIMS[from]&&carried(AIMS[from])?AIMS[from]:null;
  const swing=at
    ?new THREE.Quaternion().setFromUnitVectors(aim(source,bone(donor.scene,at)),aim(joint,bone(target.scene,JOINTS[at])))
    :inherit(swings,joint);
  swings.set(joint,swing);
  frame.set(joint,rest.get(source).clone().invert().multiply(swing.clone().invert()).multiply(rest.get(joint)));
}
const hips=bone(target.scene,'Hips'),donorHips=bone(donor.scene,'Hips');
const restHipsLocal=hips.position.clone();
const restHipsWorld=hips.getWorldPosition(new THREE.Vector3());
const donorRestHips=donorHips.getWorldPosition(new THREE.Vector3());
// Longer legs travel further for the same crouch, so hip displacement carries
// across in proportion to the two rigs' standing hip heights.
const reach=restHipsWorld.y/donorRestHips.y;
const rootScale=hips.parent.getWorldScale(new THREE.Vector3()).y;
const anchor=[0,restHipsLocal.y,restHipsLocal.z];

// The supplied set beside the original: its idle, and the push once one has
// been prepared (scripts/prepare-push.mjs), which is carried across like the
// rest, grounded, under the name hero.js finds it by.
const sources=new Map([...donor.animations,...(idle.clips||[idle.clip]).map(clip=>THREE.AnimationClip.parse(clip))].map(clip=>[clip.name,clip]));
const pushName=[...sources.keys()].find(name=>/push/i.test(name));
if(pushName){WANTED.push(pushName);GROUNDED.add(pushName);}
const mixer=new THREE.AnimationMixer(donor.scene);
const world=new Map(),scratch=new THREE.Quaternion(),local=new THREE.Quaternion(),hipsWorld=new THREE.Vector3();

function retarget(source){
  const clip=sources.get(source);if(!clip)throw new Error(`The original character has no clip named ${source}.`);
  const times=Array.from(clip.tracks.find(t=>t.name==='Hips.position').times);
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const rotations=new Map(pairs.map(({joint})=>[joint,[]])),root=[];
  for(const time of times){
    action.time=time;mixer.update(0);donor.scene.updateMatrixWorld(true);
    for(const joint of chain){
      const parent=world.get(joint.parent)||new THREE.Quaternion();
      const original=partner.get(joint);
      // Aim the joint where the original aims it, then read the result back as
      // a local rotation under this rig's own animated parent.
      if(original)scratch.copy(original.getWorldQuaternion(new THREE.Quaternion())).multiply(frame.get(joint));
      else scratch.copy(parent).multiply(restLocal.get(joint));
      world.set(joint,scratch.clone());
      if(original)rotations.get(joint).push(...local.copy(parent).invert().multiply(scratch).toArray());
    }
    donorHips.getWorldPosition(hipsWorld).sub(donorRestHips).multiplyScalar(reach).add(restHipsWorld);
    root.push(...hipsWorld.toArray());
  }
  mixer.stopAllAction();mixer.uncacheClip(clip);
  const tracks=[new THREE.VectorKeyframeTrack('Hips.position',times,root)];
  for(const {joint} of pairs)tracks.push(new THREE.QuaternionKeyframeTrack(joint.name+'.quaternion',times,rotations.get(joint)));
  return new THREE.AnimationClip(source,clip.duration,tracks);
}

// Floor corrections are measured on the retargeted pose, with the root already
// pinned laterally, so they describe exactly the clip the game will play.
const meshes=[];target.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const targetMixer=new THREE.AnimationMixer(target.scene);
const vertex=new THREE.Vector3();
function correct(clip){
  const track=clip.tracks[0];
  for(let i=0;i<track.values.length;i+=3){track.values[i]=anchor[0];track.values[i+2]=anchor[2];}
  const action=targetMixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const times=Array.from(track.times),values=[];
  for(const time of times){
    action.time=time;targetMixer.update(0);target.scene.updateMatrixWorld(true);
    let floor=Infinity;
    for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);
    }
    values.push(+((hips.position.y-floor/rootScale).toFixed(5)));
  }
  targetMixer.stopAllAction();targetMixer.uncacheClip(clip);
  return {times,values};
}

// These clips travel as text, so they are written at the precision the rig can
// actually show — a hundredth of a degree — and a joint that never moves in a
// clip keeps one key instead of a few hundred copies of it. The root track is
// left whole: hero.js walks its keys to apply the floor correction.
const STILL=1e-4;
function condense(clip){
  const data=THREE.AnimationClip.toJSON(clip);
  for(const track of data.tracks){
    const stride=track.type==='quaternion'?4:3;
    const still=track.name!=='Hips.position'&&track.values.every((v,i)=>Math.abs(v-track.values[i%stride])<STILL);
    if(still){track.times=[0];track.values=track.values.slice(0,stride);}
    track.times=track.times.map(t=>+t.toFixed(6));
    track.values=track.values.map(v=>+v.toFixed(5));
  }
  return data;
}

const clips=[],corrections={};
for(const source of WANTED){
  const clip=retarget(source);
  if(GROUNDED.has(source))corrections[source]=correct(clip);
  const data=condense(clip);clips.push(data);
  const still=data.tracks.filter(t=>t.times.length===1).length;
  console.log(`  ${source}: ${clip.tracks.length} tracks (${still} still), ${clip.duration.toFixed(2)}s${GROUNDED.has(source)?`, ${corrections[source].times.length} floor samples`:''}`);
}

const shipped=createHash('sha256').update(await readFile(asset(`${name}.glb`))).digest('hex');
if(shipped!==manifest.shippedSha256)throw new Error(`${name}.glb does not match its manifest; run prepare-textures.py first.`);
await writeFile(asset(`${name}-motion.json`),JSON.stringify({
  sourceSha256:manifest.sourceSha256,shippedSha256:shipped,anchor,clips:corrections
}));
await writeFile(asset(`${name}-animation.json`),JSON.stringify({
  sourceSha256:createHash('sha256').update(await readFile(asset('player.glb'))).digest('hex'),
  playerSha256:manifest.sourceSha256,clips
}));
console.log(`Retargeted ${clips.length} clips onto ${manifest.source}; that file and its geometry are unchanged.`);
