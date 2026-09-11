import {readGLB} from './load-player.mjs';
import {CANYON_FILES,prepareCanyonAsset} from '../dist/canyon-assets.js';
export async function attachCanyon(w){
  const images=new Map();
  for(const [key,file]of Object.entries(CANYON_FILES)){
    const model=await readGLB(new URL('../dist/assets/'+file,import.meta.url));prepareCanyonAsset(w,key,model);
    for(const [name,data]of model.cpuImages)images.set(name,data);
  }return images;
}
