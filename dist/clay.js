import * as THREE from './lib/three.module.js';
import {RoundedBoxGeometry} from './lib/RoundedBoxGeometry.js';
import {loadData,assetURL} from './model-assets.js';
import {orangeTextureShader} from './palette.js';

// The ball supplies a neutral, seamless field of presses and fingerprints.
// Authored model maps stay intact; constructed forms no longer use the cube atlas.
export async function loadClay(w,onProgress){
  const [profile,detail]=await Promise.all([
    loadData('clay-profile.json'),new THREE.TextureLoader().loadAsync(assetURL('clay-detail.png'))
  ]);
  prepareClay(w,profile,detail);onProgress?.(1);
}

export function prepareClay(w,profile,detail){
  if(profile.version!==3||profile.height.length!==profile.size**2)throw new Error('The clay ball surface is incomplete.');
  detail.colorSpace=THREE.NoColorSpace;detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.anisotropy=4;
  w.clay={detail,profile,boxes:new Map(),sculpted:new WeakMap()};
  w.assetGeometry??=new Set();w.assetMaterials??=new Set();
  for(const m of Object.values(w.mat))clayMaterial(w,m);
  w.bump?.dispose();w.bump=detail;
  for(const root of [w.character?.asset,w.enemyAsset?.scene,w.batAsset?.scene,w.drifterAsset?.scene,w.sporeAsset?.scene,w.cottageAsset?.scene])if(root)clayModel(w,root);
  if(w.castleAsset)clayModel(w,w.castleAsset.scene,{background:true});
  for(const asset of Object.values(w.cavernAssets||{}))clayModel(w,asset.scene,{background:true});
  if(w.cloudAsset)clayModel(w,w.cloudAsset.scene,{background:true});
  for(const [key,asset]of Object.entries(w.canyonAssets||{}))clayModel(w,asset.scene,{background:key==='arch'||key==='summit'});
  for(const asset of Object.values(w.windmillAssets||{}))clayModel(w,asset.scene);
  for(const asset of Object.values(w.forestAssets||{}))clayModel(w,asset.scene);
}

// Stable rest-space coordinates follow skinned characters, moving platforms and
// parallax groups. Column lengths preserve texture size under nonuniform scale.
export function clayMaterial(w,material,depth){
  if(!w.clay||!material?.isMeshStandardMaterial||material.transparent)return material;
  const requestedDepth=depth??material.userData.clay?.requestedDepth??.075;
  material.bumpScale=requestedDepth*.48;
  if(material.userData.clay){material.userData.clay.requestedDepth=requestedDepth;material.userData.clay.depth=material.bumpScale;return material;}
  const detail=w.clay.detail;
  material.bumpMap=detail;material.metalness=0;
  material.userData.clay={type:'relief',period:w.clay.profile.period,requestedDepth,depth:material.bumpScale};
  material.onBeforeCompile=shader=>{
    orangeTextureShader(shader,material.userData.clayOrangeSource);
    shader.uniforms.clayPeriod={value:w.clay.profile.period};
    shader.uniforms.clayOffset={value:new THREE.Vector3().fromArray(material.userData.clayOffset||[0,0,0])};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform vec3 clayOffset;
varying vec3 vClayPosition;
varying vec3 vClayNormal;`).replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 claySize = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
vClayPosition = position * claySize + clayOffset;
vClayNormal = normalize(normal / max(claySize, vec3(0.0001)));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float clayPeriod;
varying vec3 vClayPosition;
varying vec3 vClayNormal;
vec3 claySurface(vec3 p, vec3 n) {
  vec3 weights = pow(abs(normalize(n)), vec3(4.0));
  weights /= max(dot(weights, vec3(1.0)), 0.0001);
  return texture2D(bumpMap, p.yz / clayPeriod).rgb * weights.x
       + texture2D(bumpMap, p.xz / clayPeriod).rgb * weights.y
       + texture2D(bumpMap, p.xy / clayPeriod).rgb * weights.z;
}`);
    // bumpMap's sampler is declared by this chunk; the helper must follow it.
    const start=shader.fragmentShader.indexOf('vec3 claySurface('),end=shader.fragmentShader.indexOf('\n}',start)+2;
    const helper=shader.fragmentShader.slice(start,end)+`
vec3 clayPerturbNormal(vec3 p, vec3 n, float h, float side) {
  vec3 sx = dFdx(p), sy = dFdy(p);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float determinant = dot(sx, r1) * side;
  if (abs(determinant) < 0.00000001) return n;
  vec3 gradient = sign(determinant) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(determinant) * n - gradient);
}`;
    shader.fragmentShader=shader.fragmentShader.slice(0,start)+shader.fragmentShader.slice(end);
    shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>','#include <bumpmap_pars_fragment>\n'+helper);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 clayData = claySurface(vClayPosition, vClayNormal);
diffuseColor.rgb *= mix(1.0, clayData.b / 0.94, 0.55);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * clayData.g, 0.52, 0.98);`)
      .replace('#include <normal_fragment_maps>',`#if defined(USE_NORMALMAP_OBJECTSPACE) || defined(USE_NORMALMAP_TANGENTSPACE)
#include <normal_fragment_maps>
#endif
normal = clayPerturbNormal(-vViewPosition, normal, clayData.r * bumpScale, faceDirection);`);
  };
  material.customProgramCacheKey=()=> 'ball-clay-relief-v3'+(material.userData.clayOrangeSource?'-orange-v1':'');material.needsUpdate=true;return material;
}

export function clayModel(w,root,{background=false}={}){
  if(!w.clay)return;
  root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])clayMaterial(w,m,background?.035:.025);});
}

export function clayBox(w,width,height,depth,radius,variant=0){
  const c=w.clay;if(!c)return null;
  const min=Math.min(width,height,depth),max=Math.max(width,height,depth);
  const key=[width,height,depth,radius].map(n=>n.toFixed(3)).join(':');
  if(!c.boxes.has(key)){
    const base=new RoundedBoxGeometry(width,height,depth,5,Math.min(radius,width/3,height/3,depth/3));
    const g=sculptClay(w,base,{amplitude:Math.min(.065,min*.055),subdivide:max>3&&min>.15,maxEdge:Math.max(1.05,max/60)});
    base.dispose();g.computeBoundingBox();g.computeBoundingSphere();c.boxes.set(key,g);w.assetGeometry.add(g);
  }
  return c.boxes.get(key);
}

export function clayMeshMaterial(w,geometry,base){return clayMaterial(w,base);}

// Bilinear CPU sampling of the same measured field, for real silhouette relief.
function heightAt(c,u,v){
  const {size,height,period}=c.profile;
  const x=((u/period)%1+1)%1*size,y=((v/period)%1+1)%1*size;
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const h=(a,b)=>height[(b%size)*size+(a%size)];
  return ((h(ix,iy)*(1-fx)+h(ix+1,iy)*fx)*(1-fy)+(h(ix,iy+1)*(1-fx)+h(ix+1,iy+1)*fx)*fy)-.5;
}

// Longest-edge subdivision only where broad faces need silhouette samples.
function tessellate(g,maxEdge=1.05){
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,out=[],normals=[],uvs=[];
  const vertex=i=>({p:new THREE.Vector3().fromBufferAttribute(p,i),n:new THREE.Vector3().fromBufferAttribute(n,i),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,i):new THREE.Vector2()});
  const midpoint=(a,b)=>({p:a.p.clone().add(b.p).multiplyScalar(.5),n:a.n.clone().add(b.n).normalize(),uv:a.uv.clone().add(b.uv).multiplyScalar(.5)});
  const split=(a,b,c,depth)=>{
    const edges=[a.p.distanceToSquared(b.p),b.p.distanceToSquared(c.p),c.p.distanceToSquared(a.p)],longest=Math.max(...edges);
    if(longest>maxEdge*maxEdge&&depth<16){
      if(edges[1]===longest)[a,b,c]=[b,c,a];else if(edges[2]===longest)[a,b,c]=[c,a,b];
      const mid=midpoint(a,b);split(a,mid,c,depth+1);split(mid,b,c,depth+1);return;
    }
    for(const v of [a,b,c]){out.push(v.p.x,v.p.y,v.p.z);normals.push(v.n.x,v.n.y,v.n.z);uvs.push(v.uv.x,v.uv.y);}
  };
  const index=g.index?.array||Array.from({length:p.count},(_,i)=>i);
  for(let i=0;i<index.length;i+=3)split(vertex(index[i]),vertex(index[i+1]),vertex(index[i+2]),0);
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(out,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return result;
}

export function sculptClay(w,geometry,{amplitude=.08,subdivide=false,maxEdge=1.05,planar=false}={}){
  if(!w.clay||geometry.userData.clayRelief)return geometry;
  const c=w.clay;
  if(c.sculpted.has(geometry))return c.sculpted.get(geometry);
  const g=subdivide?tessellate(geometry,maxEdge):geometry.clone(),p=g.attributes.position;
  // Coordinate-only displacement keeps coincident seam vertices watertight.
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    // An extruded XY outline may contain very thin cap triangles. Keep its
    // outline fixed and press only in depth so those triangles cannot fold.
    p.setXYZ(i,x+(planar?0:heightAt(c,y+1.3,z-.4)*amplitude),y+(planar?0:heightAt(c,x+.7,z+2.1)*amplitude*.35),z+heightAt(c,x,y)*amplitude);
  }
  // These constructed clay forms are smooth sculptures. Weld by position across
  // triangulation/UV/bevel seams; ExtrudeGeometry's per-face source normals can
  // otherwise preserve diagonal shading cuts through a broad deformed wall.
  // Imported models keep their authored normals in clayModel above.
  const n=g.attributes.normal,keys=[],sums=new Map();
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(':');
    keys.push(key);if(!sums.has(key))sums.set(key,new THREE.Vector3());
  }
  const indices=g.index?.array||Array.from({length:p.count},(_,i)=>i),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
  for(let i=0;i<indices.length;i+=3){
    a.fromBufferAttribute(p,indices[i]);b.fromBufferAttribute(p,indices[i+1]).sub(a);d.fromBufferAttribute(p,indices[i+2]).sub(a);b.cross(d);
    for(let j=0;j<3;j++)sums.get(keys[indices[i+j]]).add(b);
  }
  for(let i=0;i<n.count;i++){const normal=sums.get(keys[i]).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}
  g.userData.clayRelief=true;g.computeBoundingBox();g.computeBoundingSphere();c.sculpted.set(geometry,g);return g;
}
