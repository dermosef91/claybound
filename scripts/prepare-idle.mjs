// Extract only the supplied animation; reuse the existing player mesh and rig.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB,readPlayer} from '../tests/load-player.mjs';
const path=process.argv[2];if(!path)throw new Error('Provide the supplied idle GLB path.');
const [source,target]=await Promise.all([readGLB(path),readPlayer()]);
const clip=source.animations[0];if(!clip)throw new Error('The idle GLB contains no animation.');
source.scene.traverse(bone=>{
  if(!bone.isBone)return;
  const other=target.scene.getObjectByName(bone.name);
  if(!other?.isBone||bone.position.distanceTo(other.position)>1e-4||1-Math.abs(bone.quaternion.dot(other.quaternion))>1e-4||bone.scale.distanceTo(other.scale)>1e-4)throw new Error('Incompatible idle rig: '+bone.name);
});
const motion=JSON.parse(await readFile(new URL('../dist/assets/player-motion.json',import.meta.url)));
const hips=target.scene.getObjectByName('Hips'),prepared=clip.clone(),track=prepared.tracks.find(t=>t.name==='Hips.position');
for(let i=0;i<track.values.length;i+=3){track.values[i]=motion.anchor[0];track.values[i+2]=motion.anchor[2];}
const mixer=new THREE.AnimationMixer(target.scene),action=mixer.clipAction(prepared);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[];target.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const vertex=new THREE.Vector3(),times=Array.from(track.times),values=[];
for(const time of times){
  action.time=time;mixer.update(0);target.scene.updateMatrixWorld(true);let floor=Infinity;
  for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);}
  values.push(hips.position.y-floor/hips.parent.getWorldScale(new THREE.Vector3()).y);
}
const data={sourceSha256:createHash('sha256').update(await readFile(path)).digest('hex'),playerSha256:motion.sourceSha256,clip:THREE.AnimationClip.toJSON(clip),ground:{times,values}};
await writeFile(new URL('../dist/assets/player-idle.json',import.meta.url),JSON.stringify(data));
console.log(`Prepared ${clip.name}: ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s, ${times.length} floor samples; no duplicate player mesh.`);
