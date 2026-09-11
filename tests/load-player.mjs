// Parse the real shipped rig/geometry/clips in Node, without a browser or WebGL.
// Texture upload is outside these CPU checks; keep image metadata for materials.
import {readFile} from 'node:fs/promises';
import {Texture} from '../dist/lib/three.module.js';
import {GLTFLoader} from '../dist/lib/GLTFLoader.js';

export async function readPlayer(){
  return readGLB(new URL('../dist/assets/player.glb',import.meta.url));
}

export async function readGLB(path){
  const bytes=await readFile(path),images=new Map();
  const loader=new GLTFLoader();
  loader.register(parser=>({name:'CPUTextureMetadata',async loadTexture(index){
    const source=parser.json.textures[index].source,image=parser.json.images[source];
    const data=Buffer.from(await parser.getDependency('bufferView',image.bufferView));
    const png=image.mimeType==='image/png',width=png?data.readUInt32BE(16):2048,height=png?data.readUInt32BE(20):2048;
    const texture=new Texture({width,height});texture.flipY=false;
    texture.userData.sourceImage=String(path)+'#'+source;images.set(texture.userData.sourceImage,{data,mimeType:image.mimeType});return texture;
  }}));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.cpuImages=images;return gltf;
}
