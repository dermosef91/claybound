// Reproducible CPU sampling of the supplied GLB. The original file stays intact.
// Bake sole-to-floor corrections once, avoiding per-frame vertex scans on phones.
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readPlayer} from '../tests/load-player.mjs';

const gltf=await readPlayer();
const hips=gltf.scene.getObjectByName('Hips');
const anchor=hips.position.toArray();anchor[0]=0;
const mixer=new THREE.AnimationMixer(gltf.scene);
const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const vertex=new THREE.Vector3();
const grounded=new Set(['Idle_03','Walking','Running','Face_Punch_Reaction_2','Knock_Down','Skip_Forward','slide_light','Push_and_Walk_Forward','Regular_Jump']);
const clips={};
for(const original of gltf.animations){
  if(!grounded.has(original.name))continue;
  const clip=original.clone(),track=clip.tracks.find(t=>t.name==='Hips.position');
  if(!track)throw new Error(`Missing root track: ${clip.name}`);
  for(let i=0;i<track.values.length;i+=3){track.values[i]=anchor[0];track.values[i+2]=anchor[2];}
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const times=Array.from(track.times),values=[];
  for(const time of times){
    action.time=time;mixer.update(0);gltf.scene.updateMatrixWorld(true);
    let floor=Infinity;
    for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,vertex.y);
    }
    // Root bone is in centimetres; the armature carries the source's 0.01 scale.
    const rootScale=hips.parent.getWorldScale(new THREE.Vector3()).y;
    values.push(+((hips.position.y-floor/rootScale).toFixed(5)));
  }
  clips[original.name]={times,values};mixer.stopAllAction();mixer.uncacheClip(clip);
}
const bytes=await readFile(new URL('../dist/assets/player.glb',import.meta.url));
const data={sourceSha256:createHash('sha256').update(bytes).digest('hex'),anchor,clips};
await writeFile(new URL('../dist/assets/player-motion.json',import.meta.url),JSON.stringify(data));
console.log(`Prepared floor corrections for ${Object.keys(clips).length} clips; original GLB unchanged.`);
