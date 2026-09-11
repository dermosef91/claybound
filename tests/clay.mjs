import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {attachClay} from './load-clay.mjs';
import {clayBox,clayMaterial,sculptClay} from '../dist/clay.js';

const w={mat:{terrain:new THREE.MeshStandardMaterial({color:0x315e96})}};
await attachClay(w);const c=w.clay;
assert.equal(c.profile.sourceSha256,'820698f25cbe41db380468d37f30f0178a943975817fcc65d015070560130925');
assert.equal(c.profile.sourceTriangles,10376);assert.equal(c.source,undefined,'retired cube mesh cannot reintroduce the imprint');assert.equal(c.profile.sourceHasDepthMap,false);
assert(Math.max(...c.profile.height)-Math.min(...c.profile.height)>.1);
for(const dimensions of [[3.1,3.6,3.3],[4,.54,1.66],[12,.49,3.6]]){
  const [x,y,z]=dimensions,g=clayBox(w,x,y,z,.19,0),bounds=g.boundingBox;
  assert(bounds.max.y<=y/2+.025&&bounds.min.y>=-y/2-.025,'visual relief must not move the walkable surface away from collision');
  assert(bounds.max.x<=x/2+.065&&bounds.min.x>=-x/2-.065,'silhouette must remain close to collision edges');
  assert.equal(clayBox(w,x,y,z,.19,0),g,'repeated forms reuse their geometry');
}
const arch=new THREE.TorusGeometry(2.4,.6,8,16,Math.PI),original=arch.attributes.position.array.slice();
const sculpted=sculptClay(w,arch,{amplitude:.12,subdivide:true});
assert.deepEqual(arch.attributes.position.array,original,'baking must not mutate the source mesh');
assert(sculpted.attributes.position.count>arch.attributes.position.count,'broad curved forms receive actual relief geometry');
// Shared edges must remain connected after subdividing large, uneven faces.
const closed=sculptClay(w,new THREE.BoxGeometry(12,8,3),{amplitude:.12,subdivide:true}),p=closed.attributes.position,edges=new Map();
const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*10000)).join(':');
for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
  const a=key(i+j),b=key(i+(j+1)%3),edge=[a,b].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
}
assert([...edges.values()].every(count=>count===2),'relief subdivision must not open cracks between adjacent triangles');

// Extruded broad walls previously retained hard normals along internal cuts.
const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(11,0);shape.lineTo(11,-7);shape.bezierCurveTo(8,-5,8,-9,9,-12);shape.lineTo(0,-12);shape.closePath();
const wallSource=new THREE.ExtrudeGeometry(shape,{depth:3.3,bevelEnabled:true,bevelThickness:.17,bevelSize:.16,bevelSegments:5,curveSegments:24});
const wall=sculptClay(w,wallSource,{amplitude:.026,subdivide:true,planar:true});
const flatWall=sculptClay(w,wallSource.clone(),{amplitude:0,subdivide:true});
const wallP=wall.attributes.position,wallN=wall.attributes.normal,joined=new Map();
for(let i=0;i<wallP.count;i++){
  const key=[wallP.getX(i),wallP.getY(i),wallP.getZ(i)].map(x=>Math.round(x*10000)).join(':'),normal=new THREE.Vector3().fromBufferAttribute(wallN,i);
  if(joined.has(key))assert(normal.distanceTo(joined.get(key))<1e-5,'constructed wall normals must stay continuous across coincident corners');else joined.set(key,normal);
}
const faceNormal=(p,i)=>{const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);return b.sub(a).cross(c.sub(a)).normalize();};
for(let i=0;i<wallP.count;i+=3){
  const normal=faceNormal(flatWall.attributes.position,i);if(normal.z<.9999)continue;
  assert(faceNormal(wallP,i).z>0,'large architectural faces cannot fold or invert under surface relief');
}

// Expand the installed renderer's real shader chunks for both material paths.
// This catches missing injection sites and sampler/normal ordering, not GPU QA.
for(const hasNormal of [false,true]){
  const material=new THREE.MeshStandardMaterial();if(hasNormal)material.normalMap=new THREE.Texture();
  clayMaterial(w,material);const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader);
  const expand=s=>s.replace(/#include <([\w_]+)>/g,(_,key)=>{assert(THREE.ShaderChunk[key],`missing shader chunk ${key}`);return expand(THREE.ShaderChunk[key]);});
  const vertex=expand(shader.vertexShader),fragment=expand(shader.fragmentShader);
  assert(vertex.includes('vClayPosition = position * claySize + clayOffset;'));
  assert.deepEqual(shader.uniforms.clayOffset.value.toArray(),[0,0,0],'existing clay materials keep their texture alignment');
  assert(fragment.indexOf('uniform sampler2D bumpMap;')<fragment.indexOf('vec3 claySurface('));
  assert(fragment.indexOf('vec3 clayData =')<fragment.indexOf('roughnessFactor * clayData.g'));
  assert(fragment.includes('clayData.r * bumpScale'));assert.equal(shader.uniforms.clayPeriod.value,2.8);
  assert(hasNormal===!!material.normalMap,'keep authored normal maps when layering relief');
}
console.log('PASS clay ball provenance and unmirrored relief, real surface relief, safe collision margins, geometry reuse and both material shader paths');
