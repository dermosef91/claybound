import {readFile} from 'node:fs/promises';
import {readGLB} from './load-player.mjs';
import {prepareSpitterAsset,SPITTER_FILES} from '../dist/spitter-asset.js';
export async function attachSpitter(w){
  const images=new Map();
  for(const [key,file]of Object.entries(SPITTER_FILES)){
    const gltf=await readGLB(new URL('../dist/assets/'+file,import.meta.url));prepareSpitterAsset(w,key,gltf);
    for(const [id,image]of gltf.cpuImages)images.set(id,image);
  }
  w.spitterMotion=JSON.parse(await readFile(new URL('../dist/assets/echo-spitter-motion.json',import.meta.url)));
  return images;
}
