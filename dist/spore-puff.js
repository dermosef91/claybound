import * as THREE from './lib/three.module.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel,clayMaterial} from './clay.js';
import {SPORE} from './spore-rules.js';
import {applyFlatten} from './clay-feel.js';
import {puppetStep,heldSample,boilPuppet,placePuppet} from './stop-motion.js';
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
  const view={kind:'spore',root,pose,model,feet,cloud,motes,loaded:true,id:e.id,turn:e.dir*.8,clock:0,deathTime:0,squashNode:pose,reducedMotion:!!w.reducedMotion,puppet:w.puppetClock};
  animateSpore(view,e,0,'editing');return view;
}
// One cloud for both moments a puff lets go of its spores: thrown forward at
// the player, or released all round as the creature is defeated. Growth, drift
// and fade are shared, so a defeat reads as the same spores it attacks with.
const PUFF={life:.72,jet:2.6,burst:.95,rise:.5,center:.42};
function poseCloud(v,age,forward){
  const count=v.motes.length,bloom=Math.sin(Math.min(1,age/PUFF.life)*Math.PI);
  for(let i=0;i<count;i++){
    const q=i/count,phi=i*2.399,m=v.motes[i];
    if(forward){
      const distance=.18+age*PUFF.jet*(.55+q*.45);
      m.position.set(forward*distance,Math.sin(phi)*(.16+age*.7),Math.cos(phi)*.18);
    }else{
      // A ball of spores rather than a ring: even directions over a sphere,
      // shallow in depth so it stays readable from the side, drifting up as it
      // opens out.
      const lift=1-2*(i+.5)/count,ring=Math.sqrt(1-lift*lift),distance=(.16+age*PUFF.burst)*(.85+q*.3);
      m.position.set(Math.cos(phi)*ring*distance,lift*distance*.85+age*PUFF.rise,Math.sin(phi)*ring*distance*.45);
    }
    const r=(.105+q*.06)*bloom;m.scale.set(r*1.1,r,r);
  }
}
export function animateSpore(v,e,dt,status){
  const step=status==='playing'?puppetStep(v.puppet,dt,true):0;v.clock+=step;
  const at=e.alive?placePuppet(v.puppet,v,e.x,e.y,true):{x:e.x,y:e.y};v.root.position.set(at.x,at.y,.3);
  if(!e.alive){
    v.deathTime+=step;
    // Only the body is pressed flat — straight down whatever wiggle or leap it
    // died in, the yaw kept and the roll dropped; the cloud keeps its own shape
    // and drifts off the disc until clay-shatter.js breaks it.
    v.pose.rotation.set(0,v.turn,0);
    applyFlatten(v.pose,v.deathTime,{reducedMotion:v.reducedMotion});
    v.cloud.visible=v.deathTime<PUFF.life&&status!=='editing';
    if(v.cloud.visible){v.cloud.position.set(0,PUFF.center,.1);poseCloud(v,v.deathTime,0);}
    return;
  }
  v.root.visible=true;v.root.scale.setScalar(1);v.pose.visible=true;v.deathTime=0;
  // Under stop motion the body reads the creature as it was at the last
  // exposure; where it is, its life and the cloud it left are read live.
  const s=heldSample(v.puppet,v,step,()=>({...e}),true);
  const state=s.aiState||'idle',wiggle=state==='wiggle',crouch=state==='crouch',jump=state==='leap',puff=state==='puff';
  const t=s.stateTime||0,wave=wiggle?Math.sin(t*35):0;
  v.turn+=(s.dir*.95-v.turn)*(1-Math.exp(-step*12));v.pose.rotation.set(0,v.turn,wiggle?wave*.105:jump?-s.dir*.16:0);
  let sy=1,sx=1;
  if(wiggle){sy=.93+Math.sin(t*27)*.055;sx=1.04-Math.sin(t*27)*.04;}
  else if(puff){sy=1.13-t*.8;sx=.95+t*.5;}
  else if(crouch){sy=.86-.18*Math.min(1,t/SPORE.crouchTime);sx=1.12;}
  else if(jump){sy=s.leapVY>0?1.1:.96;sx=s.leapVY>0?.92:1.035;}
  else if(state==='recover'){const squash=Math.exp(-t*9)*.22;sy=1-squash;sx=1+squash*.65;}
  else {sy=1+Math.sin(v.clock*3)*.025;sx=1-Math.sin(v.clock*3)*.012;}
  v.pose.scale.set(sx,sy,sx);
  for(let i=0;i<v.feet.length;i++){
    const f=v.feet[i];f.bone.quaternion.copy(f.rest);
    const angle=wiggle?Math.sin(t*35+i*Math.PI)*.09:jump?(i<2?-.2:.24):Math.sin(v.clock*6+i*Math.PI)*Math.min(.075,Math.abs(s.vx||0)*.1);
    f.bone.rotateX(angle);
  }
  boilPuppet(v.root,v.puppet,true);
  const age=e.puffAge??10;v.cloud.visible=age<PUFF.life&&status!=='editing';
  if(v.cloud.visible){
    // Fixed world origin keeps the cloud behind when the enemy lunges.
    v.cloud.position.set((e.puffX??e.x)-e.x,(e.puffY??e.y+.7)-e.y,.1);
    poseCloud(v,age,e.puffDir||e.dir);
  }
}
