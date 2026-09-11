// Keep the supplied rig, texture and walk cycle; bake foot contact offline.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';
const path=new URL('../dist/assets/enemy.glb',import.meta.url),gltf=await readGLB(path);
const hips=gltf.scene.getObjectByName('Hips'),clip=gltf.animations[0].clone(),track=clip.tracks.find(t=>t.name==='Hips.position');
gltf.scene.updateMatrixWorld(true);
const parent=hips.parent.matrixWorld.clone(),inverse=parent.clone().invert(),v=new THREE.Vector3(),first=v.fromArray(track.values).applyMatrix4(parent).clone();
for(let i=0;i<track.values.length;i+=3){v.fromArray(track.values,i).applyMatrix4(parent);v.x=first.x;v.z=first.z;v.applyMatrix4(inverse).toArray(track.values,i);}
const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const values=[],vertex=new THREE.Vector3();
for(let n=0;n<track.times.length;n++){
  action.time=track.times[n];mixer.update(0);gltf.scene.updateMatrixWorld(true);let floor=Infinity;
  for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);}
  v.copy(hips.position).applyMatrix4(parent);v.y-=floor;v.applyMatrix4(inverse);values.push(...v.toArray());
}
track.values.set(values);action.time=0;mixer.update(0);gltf.scene.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(gltf.scene,true),center=bounds.getCenter(new THREE.Vector3());
const data={sourceSha256:createHash('sha256').update(await readFile(path)).digest('hex'),sourceClip:gltf.animations[0].name,rootTrack:track.name,values,height:bounds.max.y-bounds.min.y,center:[center.x,0,center.z]};
await writeFile(new URL('../dist/assets/enemy-motion.json',import.meta.url),JSON.stringify(data));
console.log(`Prepared quadruped walk: ${track.times.length} grounded frames, ${meshes[0].skeleton.bones.length} bones, original GLB unchanged.`);
