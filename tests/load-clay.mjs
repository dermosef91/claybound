// CPU loading of the actual shipped surface bake, without texture upload.
import {Texture} from '../dist/lib/three.module.js';
import {prepareClay} from '../dist/clay.js';
import {readFile} from 'node:fs/promises';
export async function attachClay(w){
  const url=name=>new URL('../dist/assets/'+name,import.meta.url),key=String(url('clay-detail.png'));
  const detail=new Texture();detail.userData.sourceImage=key;
  prepareClay(w,JSON.parse(await readFile(url('clay-profile.json'))),detail);
  return new Map([[key,{data:await readFile(url('clay-detail.png')),mimeType:'image/png'}]]);
}
