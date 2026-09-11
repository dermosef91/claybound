import {readGLB} from './load-player.mjs';
import {prepareWindmillAsset} from '../dist/windmill.js';
export async function attachWindmills(w){
  const images=new Map();
  for(const key of ['tower','sails']){
    const gltf=await readGLB(new URL('../dist/assets/windmill-'+key+'.glb',import.meta.url));
    prepareWindmillAsset(w,key,gltf);gltf.cpuImages.forEach((image,id)=>images.set(id,image));
  }
  return images;
}
