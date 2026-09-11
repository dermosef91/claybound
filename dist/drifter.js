import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {DRIFTER} from './drifter-rules.js';

export async function loadDrifters(w,onProgress){
  if(w.drifterAsset){onProgress?.(1);return;}
  if(!w.drifterLoading)w.drifterLoading=loadModel('drifter.glb',onProgress).then(gltf=>prepareDrifterAsset(w,gltf)).catch(error=>{w.drifterLoading=null;throw error;});
  await w.drifterLoading;onProgress?.(1);
}
export function prepareDrifterAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('The Dust Drifter model is incomplete.');
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
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
  const view={kind:'drifter',root,pose,grains,id:e.id,turn:0,trail:e.dir,loaded:false};
  if(w.drifterAsset)attachDrifter(w,view);animateDrifter(view,e,0,'editing');return view;
}
function attachDrifter(w,view){
  if(view.loaded)return;
  const {scene,center,scale,support}=w.drifterAsset,model=scene.clone(true),size=new THREE.Group();
  model.position.copy(center).multiplyScalar(-1);size.scale.setScalar(scale);size.add(model);view.pose.add(size);
  view.model=model;view.support=support;view.loaded=true;
}
export function animateDrifter(view,e,dt,status){
  const step=status==='playing'?Math.min(dt,.05):0,t=e.animationTime??e.phase??0;
  view.root.position.set(e.x,e.y,.35);view.root.visible=e.alive;
  if(!view.loaded||!e.alive)return;
  const direction=Math.abs(e.vx)>.08?Math.sign(e.vx):e.dir;
  view.turn+=(direction*.28-view.turn)*(1-Math.exp(-step*5.5));
  view.trail+=(direction-view.trail)*(1-Math.exp(-step*5.5));
  const air=e.airBlend??1,angle=e.rollAngle||0,pulse=air*Math.sin(t*2.3)*.025,bump=air*Math.min(1,(e.bump||0)/.22);
  view.pose.rotation.set(air*Math.sin(t*1.5)*.035,air*(view.turn+Math.sin(t*.9)*.055),angle+air*(-view.turn*.22+Math.sin(t*1.9)*.055));
  view.pose.scale.set(1+pulse+bump*.11,1-pulse-bump*.14,1+pulse*.6+bump*.06);
  const u=((angle/(Math.PI*2)%1)+1)%1*view.support.length,i=Math.floor(u),f=u-i;
  const depth=view.support[i]*(1-f)+view.support[(i+1)%view.support.length]*f;
  view.pose.position.y=(1-air)*(depth-DRIFTER.groundRadius);
  for(let i=0;i<view.grains.length;i++){
    const u=((t*.65+i/view.grains.length)%1+1)%1,m=view.grains[i];
    m.position.set(-view.trail*(.55+u*(.65+Math.min(.3,Math.abs(e.windX||0)*.025))),air*(-.18+Math.sin(t*2+i*1.7)*.2)+(1-air)*(-.55+Math.sin(t*3+i)*.035)+u*.1,.02+Math.sin(i*2.1)*.24);
    const size=Math.sin(u*Math.PI)*(.7+i*.07)*(.7+air*.3);
    m.rotation.set(t+i,t*.7+i,0);m.scale.set(.052*size,.066*size,.048*size);
  }
}
