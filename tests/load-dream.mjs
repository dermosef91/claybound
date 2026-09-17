import {readGLB} from './load-player.mjs';
import {DREAM_FILES,prepareDreamAsset} from '../dist/dream-assets.js';
export async function attachDream(w){
  const images=new Map();
  for(const [key,file]of Object.entries(DREAM_FILES)){
    const model=await readGLB(new URL('../dist/assets/'+file,import.meta.url));prepareDreamAsset(w,key,model);
    for(const [name,data]of model.cpuImages)images.set(name,data);
  }
  return images;
}
