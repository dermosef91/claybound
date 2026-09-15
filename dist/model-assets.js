import {GLTFLoader} from './lib/GLTFLoader.js';

// Resolved against the page, not this module: unbundled these are the same
// place, but a production build moves the module into a hashed chunk and only
// the document still knows where ./assets/ lives. Test DOMs supply no base at
// all, so this falls back to the module's own URL rather than throwing.
const assetBase=()=>{
  const base=globalThis.document?.baseURI;
  return typeof base==='string'&&/^[a-z][a-z0-9+.-]*:/i.test(base)&&!base.startsWith('about:')?base:import.meta.url;
};
export const assetURL=name=>new URL('./assets/'+name,assetBase()).href;
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
export function clayMaterials(scene,{background=false,orangeSource=0}={}){
  scene.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=!background;o.receiveShadow=!background;
    if(o.isSkinnedMesh)o.frustumCulled=false;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.metalness=0;m.roughness=.94;m.emissiveIntensity=background?.055:.025;
      if(orangeSource){m.userData.clayOrangeSource=orangeSource;m.emissiveIntensity=0;}
      if('specularIntensity' in m)m.specularIntensity=.22;
      if(m.map)m.map.anisotropy=4;
      if(m.normalMap)m.normalScale.setScalar(.65);
      m.needsUpdate=true;
    }
  });
}
