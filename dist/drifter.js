import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {DRIFTER} from './drifter-rules.js';
import {applyFlatten} from './clay-feel.js';
import {puppetStep,heldSample,boilPuppet,placePuppet} from './stop-motion.js';

export async function loadDrifters(w,onProgress){
  if(w.drifterAsset){onProgress?.(1);return;}
  if(!w.drifterLoading)w.drifterLoading=loadModel('drifter.glb',onProgress).then(gltf=>prepareDrifterAsset(w,gltf)).catch(error=>{w.drifterLoading=null;throw error;});
  await w.drifterLoading;onProgress?.(1);
}
export function prepareDrifterAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('The Dust Drifter model is incomplete.');
  clayMaterials(gltf.scene,{orangeSource:.788});clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  const scale=DRIFTER.width/size.x,points=[],v=new THREE.Vector3();
  gltf.scene.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){
    v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).sub(center).multiplyScalar(scale);points.push([v.x,v.y]);
  }}});
  // Sample the real irregular silhouette once. Rolling then keeps the outer
  // leaves on the deck without per-frame vertex scans or a hovering sphere.
  const support=Float32Array.from({length:128},(_,i)=>{
    const a=i*Math.PI*2/128,s=Math.sin(a),c=Math.cos(a);let depth=0;
    for(const [x,y]of points)depth=Math.max(depth,-x*s-y*c);return depth;
  });
  w.drifterAsset={scene:gltf.scene,center,scale,support};
  for(const view of w.enemyViews?.values()||[])if(view.kind==='drifter')attachDrifter(w,view);
}
export function createDrifterView(w,e){
  const root=new THREE.Group();root.name='Dust Drifter '+e.id;w.levelRoot.add(root);
  const pose=new THREE.Group();pose.name='Drifter roll and hover pose';root.add(pose);
  const grains=Array.from({length:5},(_,i)=>{
    const m=w.ball(.052,.066,.048,i%2?'cream':'orangeLight',root);m.name='Drifting clay grain';m.castShadow=false;return m;
  });
  const view={kind:'drifter',root,pose,grains,id:e.id,turn:0,trail:e.dir,loaded:false,deathTime:0,reducedMotion:!!w.reducedMotion,clock:w.puppetClock};
  if(w.drifterAsset)attachDrifter(w,view);animateDrifter(view,e,0,'editing');return view;
}
function attachDrifter(w,view){
  if(view.loaded)return;
  const {scene,center,scale,support}=w.drifterAsset,model=scene.clone(true),size=new THREE.Group();
  model.position.copy(center).multiplyScalar(-1);size.scale.setScalar(scale);size.add(model);view.pose.add(size);
  view.model=model;view.support=support;view.loaded=true;
}
export function animateDrifter(view,e,dt,status){
  const step=status==='playing'?puppetStep(view.clock,dt,true):0;
  const at=e.alive?placePuppet(view.clock,view,e.x,e.y,true):{x:e.x,y:e.y};view.root.position.set(at.x,at.y,.35);
  if(!e.alive){
    // Pressed flat about its centre like every other creature. The root is
    // squashed, not the rolling pose, so the press is straight down whatever
    // the roll angle; the grains it trails stop with it, and clay-shatter.js
    // breaks the disc into clumps from world.render.
    for(const m of view.grains)m.visible=false;
    view.deathTime+=step;
    const pose=applyFlatten(view.root,view.deathTime,{reducedMotion:view.reducedMotion});
    // A rolling drifter's centre is a body-radius above the deck, so the disc
    // is brought down to lie on it; a hovering one sinks slowly, like the bat,
    // but never below the deck settleSquash found under it.
    const air=e.airBlend??1,fall=view.reducedMotion?0:3*view.deathTime*view.deathTime*air;
    view.root.position.y=Math.max(e.y-(1-pose.sy)*DRIFTER.groundRadius*(1-air)-fall,view.squashFloorY!==undefined?view.squashFloorY+.12:-Infinity);
    return;
  }
  view.deathTime=0;view.root.visible=true;view.root.scale.setScalar(1);
  for(const m of view.grains)m.visible=true;
  if(!view.loaded)return;
  // Under stop motion the roll, the hover and the bump read the creature as it
  // was at the last exposure; where it is, and whether it lives, are live above.
  const s=heldSample(view.clock,view,step,()=>({...e}),true),t=s.animationTime??s.phase??0;
  const direction=Math.abs(s.vx)>.08?Math.sign(s.vx):s.dir;
  view.turn+=(direction*.28-view.turn)*(1-Math.exp(-step*5.5));
  view.trail+=(direction-view.trail)*(1-Math.exp(-step*5.5));
  const air=s.airBlend??1,angle=s.rollAngle||0,pulse=air*Math.sin(t*2.3)*.025,bump=air*Math.min(1,(s.bump||0)/.22);
  view.pose.rotation.set(air*Math.sin(t*1.5)*.035,air*(view.turn+Math.sin(t*.9)*.055),angle+air*(-view.turn*.22+Math.sin(t*1.9)*.055));
  view.pose.scale.set(1+pulse+bump*.11,1-pulse-bump*.14,1+pulse*.6+bump*.06);
  const u=((angle/(Math.PI*2)%1)+1)%1*view.support.length,i=Math.floor(u),f=u-i;
  const depth=view.support[i]*(1-f)+view.support[(i+1)%view.support.length]*f;
  view.pose.position.y=(1-air)*(depth-DRIFTER.groundRadius);
  for(let i=0;i<view.grains.length;i++){
    const u=((t*.65+i/view.grains.length)%1+1)%1,m=view.grains[i];
    m.position.set(-view.trail*(.55+u*(.65+Math.min(.3,Math.abs(s.windX||0)*.025))),air*(-.18+Math.sin(t*2+i*1.7)*.2)+(1-air)*(-.55+Math.sin(t*3+i)*.035)+u*.1,.02+Math.sin(i*2.1)*.24);
    const size=Math.sin(u*Math.PI)*(.7+i*.07)*(.7+air*.3);
    m.rotation.set(t+i,t*.7+i,0);m.scale.set(.052*size,.066*size,.048*size);
  }
  boilPuppet(view.root,view.clock,true);
}
