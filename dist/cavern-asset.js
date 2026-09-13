import * as THREE from './lib/three.module.js';
import {assetURL,loadModel,clayMaterials,retainModel} from './model-assets.js';
import {clayModel} from './clay.js';

export const CAVERN_FILES={grotto:'cave-grotto',crystalcap:'cave-crystalcap'};
export function prepareCavernAsset(w,key,gltf,glow){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid grotto model.');
  glow.colorSpace=THREE.SRGBColorSpace;glow.flipY=false;
  clayMaterials(gltf.scene,{background:true});clayModel(w,gltf.scene,{background:true});
  gltf.scene.traverse(o=>{if(o.isMesh){o.material.emissive.setHex(0xffffff);o.material.emissiveMap=glow;o.material.emissiveIntensity=.7;o.material.needsUpdate=true;}});
  const fixtures=key==='crystalcap'?[['mushroom',.115,.47],['crystal',.2,.55],['mushroom',.78,.82],['crystal',.87,.86]]:[['mushroom',.265,.66],['crystal',.845,.48]];
  const lamps=fixtures.map(([kind,x,y])=>({kind,x:box.min.x+size.x*x,y:box.min.y+size.y*y,color:kind==='mushroom'?0xff962f:0x46bbff}));
  for(const lamp of lamps){const hit=new THREE.Raycaster(new THREE.Vector3(lamp.x,lamp.y,box.max.z+1),new THREE.Vector3(0,0,-1)).intersectObject(gltf.scene,true)[0];lamp.z=hit?.point.z??box.max.z;}
  retainModel(w,gltf.scene);w.cavernAssets??={};w.cavernAssets[key]={scene:gltf.scene,box,size,center,lamps};
}
export async function loadCavernAssets(w,onProgress){
  if(Object.keys(CAVERN_FILES).every(key=>w.cavernAssets?.[key])){onProgress?.(1);return;}
  if(!w.cavernLoading){
    const progress=Object.keys(CAVERN_FILES).map(()=>0);
    w.cavernLoading=Promise.all(Object.entries(CAVERN_FILES).map(async([key,file],i)=>{
      if(w.cavernAssets?.[key]){progress[i]=1;return;}
      const [gltf,glow]=await Promise.all([loadModel(file+'.glb',v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}}),new THREE.TextureLoader().loadAsync(assetURL(file+'-glow.png'))]);
      prepareCavernAsset(w,key,gltf,glow);progress[i]=1;
    })).catch(e=>{w.cavernLoading=null;throw e;});
  }
  await w.cavernLoading;onProgress?.(1);
}
export function cavernModel(w,key,parent,x,y,z,width,turn=0,{lights=true}={}){
  const a=w.cavernAssets?.[key];if(!a)throw new Error('Load the cavern models before building the cave.');
  const root=new THREE.Group(),model=a.scene.clone(true);root.name=key==='grotto'?'Supplied glowing grotto':'Supplied crystalcap cavern';root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(width/a.size.x);
  // Instances of the supplied models share one copy of their geometry and
  // maps. Backdrop merging must leave them intact rather than duplicating
  // every vertex per placement.
  root.userData.sharedModel=true;
  model.position.set(-a.center.x,-a.box.min.y,-a.center.z);root.add(model);parent.add(root);
  for(const lamp of a.lamps){
    const anchor=new THREE.Object3D();anchor.name=lamp.kind+' light anchor';anchor.position.set(lamp.x,lamp.y,lamp.z);model.add(anchor);
    if(lights)w.torches.push({flame:anchor,position:new THREE.Vector3(),phase:x*.17,kind:lamp.kind,color:lamp.color,power:lamp.kind==='mushroom'?23:20,range:9});
  }
  return root;
}
