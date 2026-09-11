import {readGLB} from './load-player.mjs';
import {prepareDrifterAsset} from '../dist/drifter.js';
export async function attachDrifter(w){
  const asset=await readGLB(new URL('../dist/assets/drifter.glb',import.meta.url));
  prepareDrifterAsset(w,asset);return asset.cpuImages;
}
