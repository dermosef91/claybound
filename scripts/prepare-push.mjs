// Add a supplied push clip to the original character, beside its idle.
//
// The push arrived on its own, after the set, as a Meshy take on the same rig
// ("Clay Hooded Friend — Push Forward and Stop"). Like prepare-idle.mjs this
// reuses the shipped mesh and skeleton and takes only the animation: the rig is
// checked bone for bone against player.glb, the hips are anchored over the
// gameplay origin, and the floor is sampled per frame so hero.js can stand it
// on the ground the way it stands every other clip. The clip is appended to
// player-idle.json's supplied set and its floor correction is written into
// player-motion.json under the clip's own name, which is where makeHeroClips
// looks first. hero.js finds the push by name — whichever supplied clip names
// a push — so nothing here has to be told what the take is called.
//
// Usage: node scripts/prepare-push.mjs "path/to/Push_Forward_and_Stop.glb"
// Then re-run scripts/prepare-character.mjs for each retargeted character.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB,readPlayer} from '../tests/load-player.mjs';

const path=process.argv[2];if(!path)throw new Error('Provide the supplied push GLB path.');
const [source,target]=await Promise.all([readGLB(path),readPlayer()]);
const clip=source.animations.find(a=>/push/i.test(a.name))||source.animations[0];
if(!clip)throw new Error('The push GLB contains no animation.');
source.scene.traverse(bone=>{
  if(!bone.isBone)return;
  const other=target.scene.getObjectByName(bone.name);
  if(!other?.isBone||bone.position.distanceTo(other.position)>1e-4||1-Math.abs(bone.quaternion.dot(other.quaternion))>1e-4||bone.scale.distanceTo(other.scale)>1e-4)throw new Error('Incompatible push rig: '+bone.name);
});
const motionURL=new URL('../dist/assets/player-motion.json',import.meta.url),idleURL=new URL('../dist/assets/player-idle.json',import.meta.url);
const motion=JSON.parse(await readFile(motionURL)),supplied=JSON.parse(await readFile(idleURL));
const hips=target.scene.getObjectByName('Hips'),prepared=clip.clone(),track=prepared.tracks.find(t=>t.name==='Hips.position');
if(!track)throw new Error('The push clip has no root motion track.');
for(let i=0;i<track.values.length;i+=3){track.values[i]=motion.anchor[0];track.values[i+2]=motion.anchor[2];}
const mixer=new THREE.AnimationMixer(target.scene),action=mixer.clipAction(prepared);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[];target.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const vertex=new THREE.Vector3(),times=Array.from(track.times),values=[];
for(const time of times){
  action.time=time;mixer.update(0);target.scene.updateMatrixWorld(true);let floor=Infinity;
  for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);}
  values.push(hips.position.y-floor/hips.parent.getWorldScale(new THREE.Vector3()).y);
}
// The supplied set: the idle as it was (its floor stays in `ground`), plus the
// push; a set already carrying a push is replaced rather than doubled.
const clips=(supplied.clips||[supplied.clip]).filter(c=>c&&!/push/i.test(c.name));
clips.push(THREE.AnimationClip.toJSON(clip));
const data={...supplied,clips,pushSha256:createHash('sha256').update(await readFile(path)).digest('hex')};
delete data.clip;
motion.clips[clip.name]={times,values};
await writeFile(idleURL,JSON.stringify(data));
await writeFile(motionURL,JSON.stringify(motion));
console.log(`Prepared ${clip.name}: ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s, ${times.length} floor samples; supplied set is now ${clips.map(c=>c.name).join(', ')}.`);
