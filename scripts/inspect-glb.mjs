// Report geometry, framing and texture sizes for a supplied GLB before placing it.
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

for(const arg of process.argv.slice(2)){
  const gltf=await readGLB(pathToFileURL(resolve(arg)));
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true);
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  let triangles=0;const meshes=[];
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    const count=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;triangles+=count;
    const local=new THREE.Box3().setFromObject(o,true);
    const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>
      `${m.name||'unnamed'}[${['map','normalMap','roughnessMap','emissiveMap','metalnessMap'].filter(k=>m[k]).join(',')||'no maps'}] #${m.color?.getHexString()}`);
    meshes.push({name:o.name,triangles:count,
      min:local.min.toArray().map(v=>+v.toFixed(2)),max:local.max.toArray().map(v=>+v.toFixed(2)),materials});
  });
  console.log('\n=== '+arg);
  console.log('size',size.toArray().map(v=>+v.toFixed(3)),'center',center.toArray().map(v=>+v.toFixed(3)));
  console.log('box min',box.min.toArray().map(v=>+v.toFixed(3)),'max',box.max.toArray().map(v=>+v.toFixed(3)));
  console.log('triangles',triangles,'meshes',meshes.length,'animations',gltf.animations.map(a=>a.name+':'+a.duration.toFixed(2)));
  for(const m of meshes)console.log('  ',JSON.stringify(m));
  const graph=[];gltf.scene.traverse(o=>graph.push(`${'  '.repeat(depth(o))}${o.type} ${o.name||'(unnamed)'}`));
  console.log(graph.join('\n'));
  for(const [key,image]of gltf.cpuImages)console.log('  texture',key.split('#').pop(),image.mimeType,image.data.length.toLocaleString(),'bytes');
}
function depth(o){let d=0;for(let p=o.parent;p;p=p.parent)d++;return d;}
