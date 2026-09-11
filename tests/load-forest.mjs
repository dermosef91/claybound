import {readGLB} from './load-player.mjs';
import {FOREST_FILES,prepareForestAsset} from '../dist/forest.js';
export async function attachForest(w){
  const images=new Map();
  for(const [key,file]of Object.entries(FOREST_FILES)){
    const model=await readGLB(new URL('../dist/assets/'+file,import.meta.url));prepareForestAsset(w,key,model);
    for(const [name,data]of model.cpuImages)images.set(name,data);
  }
  return images;
}
