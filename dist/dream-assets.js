import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

// The Soft Dream's supplied models: the Upside-Down Orchard's two clay
// planets, which stand in for the dome islands' spheres, and its two frosted
// saucer bowls, which hang from the canopy on the orchard's ropes. Loaded once
// per World, kept across level rebuilds, cloned per placement — the same shape
// as the forest's and the canyon's sets. The collision never comes from here:
// a dome is still the arc in simulation.js and a saucer is still its deck's
// flat top; these only replace what is seen.
export const DREAM_FILES={mint:'dream-planet-mint.glb',raspberry:'dream-planet-raspberry.glb',saucerMint:'dream-saucer-mint.glb',saucerRaspberry:'dream-saucer-raspberry.glb'};

// Each planet's core orb in model space — the sphere the fruit and the leaf
// sprouts are stuck onto — fitted over every vertex by a modal-radius
// least-squares fit that rejects the decoration as outliers. dreamPlanet
// scales a planet by r/radius and shifts it by -center, so this orb IS the
// dome's collider and everything reaching past it is scenery the rider's spin
// carries round. The uploads are unit-height; tests/dream-models.mjs re-fits
// the shipped geometry against these numbers so a re-export cannot drift.
export const PLANET_ORBS={
  mint:{center:[.0210,.4632,-.0038],radius:.3704},
  raspberry:{center:[.0046,.4859,-.0166],radius:.3911}
};

export function prepareDreamAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0)||!DREAM_FILES[key])throw new Error('Invalid dream model: '+key);
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.dreamAssets??={};w.dreamAssets[key]={scene:gltf.scene,box,size,center};
}
export async function loadDreamAssets(w,onProgress){
  if(Object.keys(DREAM_FILES).every(key=>w.dreamAssets?.[key])){onProgress?.(1);return;}
  if(!w.dreamLoading){
    const progress=Object.keys(DREAM_FILES).map(()=>0);
    w.dreamLoading=Promise.all(Object.entries(DREAM_FILES).map(async([key,file],i)=>{
      if(w.dreamAssets?.[key]){progress[i]=1;return;}
      prepareDreamAsset(w,key,await loadModel(file,v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}}));progress[i]=1;
    })).catch(e=>{w.dreamLoading=null;throw e;});
  }
  await w.dreamLoading;onProgress?.(1);
}
const asset=(w,key)=>{
  const a=w.dreamAssets?.[key];if(!a)throw new Error('Load the dream models before dressing the orchard.');
  return a;
};
// A planet under `parent`, scaled so its core orb has `radius` with its centre
// on the parent's origin — the dome view's sphere group, which the spin turns.
export function dreamPlanet(w,key,parent,radius){
  const a=asset(w,key),orb=PLANET_ORBS[key],root=new THREE.Group(),model=a.scene.clone(true);
  root.name='Dream planet '+key;model.name='Supplied clay planet';
  root.scale.setScalar(radius/orb.radius);model.position.set(-orb.center[0],-orb.center[1],-orb.center[2]);
  root.add(model);parent.add(root);
  return root;
}
// A saucer bowl under `parent`, `width` across, its flat top on the parent's
// origin plane and its foot hanging below — the walk plane of the deck it dresses.
export function dreamSaucer(w,key,parent,width){
  const a=asset(w,key),root=new THREE.Group(),model=a.scene.clone(true);
  root.name='Dream saucer '+key;model.name='Supplied clay saucer';
  root.scale.setScalar(width/a.size.x);model.position.set(-a.center.x,-a.box.max.y,-a.center.z);
  root.add(model);parent.add(root);
  return root;
}
