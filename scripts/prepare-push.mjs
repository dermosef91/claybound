// Add a supplied push clip to the original character, beside its idle.
//
// The push arrived on its own, after the set, as a Meshy take on the same
// character ("Clay Hooded Friend — Push Forward and Stop"). It is the same rig
// to the bone — same rest pose, same hip height, same centimetre scale — but
// exported under Mixamo's joint names (`mixamorig:` prefixed, the spine and
// neck numbered Mixamo's way), so it crosses over by renaming its tracks onto
// the joints the game binds to, and the rest pose is checked bone for bone to
// make sure that is all it needs. Like prepare-idle.mjs this reuses the shipped
// mesh and skeleton and takes only the animation: the hips are anchored over
// the gameplay origin and the floor is sampled per frame so hero.js can stand
// it on the ground the way it stands every other clip.
//
// The take is a push and then a stop — three shoving steps, then the arms
// come down and the body settles. `pushSplit` marks the seam; hero.js loops
// the push up to it and plays the stop once when the block is let go. The clip
// is appended to player-idle.json's supplied set and its floor correction goes
// into player-motion.json under the clip's own name, where makeHeroClips looks
// first. hero.js finds the push by name — whichever supplied clip names a push.
//
// Usage: node scripts/prepare-push.mjs "path/to/Push_Forward_and_Stop.glb"
// Then re-run scripts/prepare-character.mjs for each retargeted character.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB,readPlayer} from '../tests/load-player.mjs';

// Where the take stops pushing and starts standing down, in seconds. Read off
// the take: the root creeps forward and the hands stay out until here; after
// it the hands drop and the root settles.
const PUSH_SPLIT=1.9;
// Mixamo's names for the joints the original numbers its own way. Everything
// else is the same name under the prefix, which the loader has already turned
// from `mixamorig:X` into `mixamorigX`.
const PREFIX='mixamorig',RENAME={Spine:'Spine02',Spine1:'Spine01',Spine2:'Spine',Neck:'neck'};
const ours=name=>{if(!name.startsWith(PREFIX))return name;const bare=name.slice(PREFIX.length);return RENAME[bare]??bare;};

const path=process.argv[2];if(!path)throw new Error('Provide the supplied push GLB path.');
const [source,target]=await Promise.all([readGLB(path),readPlayer()]);
const clip=source.animations.find(a=>/push/i.test(a.name))||source.animations[0];
if(!clip)throw new Error('The push GLB contains no animation.');
// The same rig under other names: every animated bone has its counterpart, at
// rest exactly where the counterpart rests. A marker no clip moves may differ.
const animated=new Set(clip.tracks.map(t=>t.name.split('.')[0]));
source.scene.traverse(bone=>{
  if(!bone.isBone||!animated.has(bone.name))return;
  const other=target.scene.getObjectByName(ours(bone.name));
  if(!other?.isBone)throw new Error(`The push rig's ${bone.name} has no counterpart on the character.`);
  if(bone.position.distanceTo(other.position)>1e-3||1-Math.abs(bone.quaternion.dot(other.quaternion))>1e-4||bone.scale.distanceTo(other.scale)>1e-4)throw new Error('Incompatible push rig: '+bone.name);
  const parent=bone.parent?.isBone?ours(bone.parent.name):null,otherParent=other.parent?.isBone?other.parent.name:null;
  if(parent!==otherParent)throw new Error(`The push rig hangs ${bone.name} under ${parent}, the character under ${otherParent}.`);
});
const renamed=new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.map(track=>{
  const [bone,property]=track.name.split('.');
  return new track.constructor(`${ours(bone)}.${property}`,Array.from(track.times),Array.from(track.values),track.getInterpolation());
}));
const motionURL=new URL('../dist/assets/player-motion.json',import.meta.url),idleURL=new URL('../dist/assets/player-idle.json',import.meta.url);
const motion=JSON.parse(await readFile(motionURL)),supplied=JSON.parse(await readFile(idleURL));
const hips=target.scene.getObjectByName('Hips'),prepared=renamed.clone(),track=prepared.tracks.find(t=>t.name==='Hips.position');
if(!track)throw new Error('The push clip has no root motion track.');
for(let i=0;i<track.values.length;i+=3){track.values[i]=motion.anchor[0];track.values[i+2]=motion.anchor[2];}
const mixer=new THREE.AnimationMixer(target.scene),action=mixer.clipAction(prepared);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[];target.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const vertex=new THREE.Vector3(),times=Array.from(track.times),values=[];
for(const time of times){
  action.time=time;mixer.update(0);target.scene.updateMatrixWorld(true);let floor=Infinity;
  for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);}
  values.push(+(hips.position.y-floor/hips.parent.getWorldScale(new THREE.Vector3()).y).toFixed(5));
}
// The supplied set: the idle as it was (its floor stays in `ground`), plus the
// push; a set already carrying a push is replaced rather than doubled.
const clips=(supplied.clips||[supplied.clip]).filter(c=>c&&!/push/i.test(c.name));
clips.push(THREE.AnimationClip.toJSON(renamed));
const data={...supplied,clips,pushSplit:PUSH_SPLIT,pushSha256:createHash('sha256').update(await readFile(path)).digest('hex')};
delete data.clip;
motion.clips[renamed.name]={times,values};
await writeFile(idleURL,JSON.stringify(data));
await writeFile(motionURL,JSON.stringify(motion));
console.log(`Prepared ${renamed.name}: ${renamed.tracks.length} tracks, ${renamed.duration.toFixed(2)}s, split at ${PUSH_SPLIT}s, ${times.length} floor samples; supplied set is now ${clips.map(c=>c.name).join(', ')}.`);
