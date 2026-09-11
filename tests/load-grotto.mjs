import * as THREE from '../dist/lib/three.module.js';
import {readFile} from 'node:fs/promises';
import {readGLB} from './load-player.mjs';
import {prepareCavernAsset,CAVERN_FILES} from '../dist/cavern-asset.js';
export async function attachGrotto(w){
  const images=new Map();
  for(const [key,file]of Object.entries(CAVERN_FILES)){
    const gltf=await readGLB(new URL('../dist/assets/'+file+'.glb',import.meta.url)),glow=new THREE.Texture();glow.userData.sourceImage=file+'-glow';
    gltf.cpuImages.set(glow.userData.sourceImage,{mimeType:'image/png',data:await readFile(new URL('../dist/assets/'+file+'-glow.png',import.meta.url))});
    prepareCavernAsset(w,key,gltf,glow);for(const [k,v]of gltf.cpuImages)images.set(k,v);
  }
  return images;
}
