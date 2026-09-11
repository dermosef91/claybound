import {GLTFLoader} from './lib/GLTFLoader.js';

export const assetURL=name=>new URL('./assets/'+name,import.meta.url).href;
export const loadModel=(name,onProgress)=>new GLTFLoader().loadAsync(assetURL(name),e=>onProgress?.(e.total?e.loaded/e.total:null));
export async function loadData(name){const r=await fetch(assetURL(name));if(!r.ok)throw new Error('Could not load '+name);return r.json();}

// Rebuilt levels borrow these resources. Dispose only level-owned geometry.
export function retainModel(w,scene){
  w.assetGeometry??=new Set();w.assetMaterials??=new Set();
  scene.traverse(o=>{
    if(!o.isMesh)return;w.assetGeometry.add(o.geometry);
    for(const material of Array.isArray(o.material)?o.material:[o.material])w.assetMaterials.add(material);
  });
}
export function clayMaterials(scene,{background=false}={}){
  scene.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=!background;o.receiveShadow=!background;
    if(o.isSkinnedMesh)o.frustumCulled=false;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.metalness=0;m.roughness=.94;m.emissiveIntensity=background?.055:.025;
      if('specularIntensity' in m)m.specularIntensity=.22;
      if(m.map)m.map.anisotropy=4;
      if(m.normalMap)m.normalScale.setScalar(.65);
      m.needsUpdate=true;
    }
  });
}
