import * as THREE from './lib/three.module.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel,clayMaterial} from './clay.js';
import {SPORE} from './spore-rules.js';
export async function loadSpores(w,onProgress){
  if(w.sporeAsset){onProgress?.(1);return;}
  if(!w.sporeLoading)w.sporeLoading=loadModel('spore-puff.glb',onProgress).then(g=>prepareSporeAsset(w,g)).catch(e=>{w.sporeLoading=null;throw e;});
  await w.sporeLoading;onProgress?.(1);
}
export function prepareSporeAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3());
  if(!gltf.scene.getObjectByName('Bone_000')?.isBone||size.y<=0)throw new Error('The Spore Puff rig is missing.');
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.sporeAsset={scene:gltf.scene,scale:SPORE.height/size.y,center:box.getCenter(new THREE.Vector3()),bottom:box.min.y};
  if(!w.mat.spore){w.mat.spore=new THREE.MeshStandardMaterial({color:0xd9dfa0,emissive:0x83904c,emissiveIntensity:.14,roughness:.98});clayMaterial(w,w.mat.spore,.022);}
}
export function createSporeView(w,e){
  if(!w.sporeAsset)throw new Error('Load Spore Puff before building the enemy.');
  const root=new THREE.Group(),pose=new THREE.Group(),model=clone(w.sporeAsset.scene),a=w.sporeAsset;
  root.name='Spore Puff '+e.id;pose.name='Spore wiggle and leap pose';root.add(pose);w.levelRoot.add(root);
  model.scale.setScalar(a.scale);model.position.set(-a.center.x*a.scale,-a.bottom*a.scale,-a.center.z*a.scale);pose.add(model);
  const feet=['Bone_016','Bone_019','Bone_022','Bone_025'].map(name=>{const bone=model.getObjectByName(name);return {bone,rest:bone.quaternion.clone()};});
  const cloud=new THREE.Group();cloud.name='Clay spore puff';root.add(cloud);
  const motes=Array.from({length:w.reducedMotion?5:11},(_,i)=>{const m=w.ball(.1,.1,.1,'spore',cloud);m.castShadow=false;return m;});
  const view={kind:'spore',root,pose,model,feet,cloud,motes,loaded:true,id:e.id,turn:e.dir*.8,clock:0,deathTime:0};
  animateSpore(view,e,0,'editing');return view;
}
export function animateSpore(v,e,dt,status){
  const step=status==='playing'?Math.min(dt,.05):0;v.clock+=step;v.root.position.set(e.x,e.y,.3);
  if(!e.alive){v.deathTime+=step;const t=Math.min(1,v.deathTime/.22);v.root.scale.set(1+t*.25,Math.max(.02,1-t),1+t*.25);v.root.visible=t<1;v.cloud.visible=false;return;}
  v.root.visible=true;v.root.scale.setScalar(1);v.deathTime=0;
  const state=e.aiState||'idle',wiggle=state==='wiggle',crouch=state==='crouch',jump=state==='leap',puff=state==='puff';
  const t=e.stateTime||0,wave=wiggle?Math.sin(t*35):0;
  v.turn+=(e.dir*.95-v.turn)*(1-Math.exp(-step*12));v.pose.rotation.set(0,v.turn,wiggle?wave*.105:jump?-e.dir*.16:0);
  let sy=1,sx=1;
  if(wiggle){sy=.93+Math.sin(t*27)*.055;sx=1.04-Math.sin(t*27)*.04;}
  else if(puff){sy=1.13-t*.8;sx=.95+t*.5;}
  else if(crouch){sy=.86-.18*Math.min(1,t/SPORE.crouchTime);sx=1.12;}
  else if(jump){sy=e.leapVY>0?1.1:.96;sx=e.leapVY>0?.92:1.035;}
  else if(state==='recover'){const squash=Math.exp(-t*9)*.22;sy=1-squash;sx=1+squash*.65;}
  else {sy=1+Math.sin(v.clock*3)*.025;sx=1-Math.sin(v.clock*3)*.012;}
  v.pose.scale.set(sx,sy,sx);
  for(let i=0;i<v.feet.length;i++){
    const f=v.feet[i];f.bone.quaternion.copy(f.rest);
    const angle=wiggle?Math.sin(t*35+i*Math.PI)*.09:jump?(i<2?-.2:.24):Math.sin(v.clock*6+i*Math.PI)*Math.min(.075,Math.abs(e.vx||0)*.1);
    f.bone.rotateX(angle);
  }
  const age=e.puffAge??10;v.cloud.visible=age<.72&&status!=='editing';
  if(v.cloud.visible){
    // Fixed world origin keeps the cloud behind when the enemy lunges.
    v.cloud.position.set((e.puffX??e.x)-e.x,(e.puffY??e.y+.7)-e.y,.1);
    for(let i=0;i<v.motes.length;i++){
      const q=i/v.motes.length,phi=i*2.399,m=v.motes[i],distance=.18+age*2.6*(.55+q*.45);
      m.position.set((e.puffDir||e.dir)*distance,Math.sin(phi)*(.16+age*.7),Math.cos(phi)*.18);
      const r=(.105+q*.06)*Math.sin(Math.min(1,age/.72)*Math.PI);m.scale.set(r*1.1,r,r);
    }
  }
}
