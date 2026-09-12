// Author a restrained four-beat shuffle on the supplied rig; no duplicate mesh.
// node scripts/prepare-spitter-motion.mjs CHARACTER.glb WALKING.glb OUTPUT.json
import * as T from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';
import {writeFile} from 'node:fs/promises';
const [character,walking,output]=process.argv.slice(2),base=await readGLB(character),source=await readGLB(walking);
base.scene.updateMatrixWorld(true);
const restBox=new T.Box3().setFromObject(base.scene,true),height=restBox.max.y-restBox.min.y,tracks=[],duration=1.35;
const smooth=t=>t*t*(3-2*t);
// Staggered 68% contact phases keep at least two paws planted. Translate each
// short limb root instead of folding the generic quadruped's long leg chains
// through the belly. This character calls for a small, heavy shuffle.
for(const [name,offset]of [['frontleg',0],['R_frontleg',.5],['backleg',.75],['R_backleg',.25]]){
 const bone=base.scene.getObjectByName(name),inverse=new T.Matrix3().setFromMatrix4(bone.parent.matrixWorld).invert(),times=[],values=[];
 for(let i=0;i<=48;i++){
  const phase=(i/48+offset)%1,swing=Math.max(0,(phase-.68)/.32);
  const forward=phase<.68?.08*(1-2*phase/.68):-.08+.16*smooth(swing),lift=.035*Math.sin(Math.PI*swing)**2;
  const delta=new T.Vector3(0,lift*height,forward*height).applyMatrix3(inverse).add(bone.position);
  times.push(i/48*duration);values.push(...delta.toArray());
 }
 values.splice(values.length-3,3,...values.slice(0,3));tracks.push(new T.VectorKeyframeTrack(name+'.position',times,values));
}
const clip=new T.AnimationClip('Echo planted shuffle',duration,tracks),mixer=new T.AnimationMixer(base.scene);mixer.clipAction(clip).play();const ground=[];
for(let i=0;i<=48;i++){mixer.setTime(duration*i/48);base.scene.updateMatrixWorld(true);ground.push(restBox.min.y-new T.Box3().setFromObject(base.scene,true).min.y);}
ground[ground.length-1]=ground[0];
await writeFile(output,JSON.stringify({version:2,clip:T.AnimationClip.toJSON(clip),ground,sourceClip:source.animations[0].name,notes:'Reauthored four-beat shuffle: 68% planted contact, small paw lift, bind-pose torso, no pelvis scale/root motion, seamless endpoints.'})+'\n');
console.log('Prepared',duration+'s',tracks.length+' tracks', 'from supplied quadruped rig');
