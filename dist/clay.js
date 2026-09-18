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
  w.clay={detail,profile,boxes:new Map(),sculpted:new WeakMap(),bytes:0};
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
  for(const asset of Object.values(w.dreamAssets||{}))clayModel(w,asset.scene);
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

// Imported models take a shallow press by default, since their own maps carry
// most of the surface. A material may ask for a deeper one through
// `userData.clayDepth`, the way it declares its orange in `clayOrangeSource`:
// an annotation rather than an argument, so it holds through both the model's
// own install and the re-application above when the ball arrives after it.
export function clayModel(w,root,{background=false}={}){
  if(!w.clay)return;
  root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])clayMaterial(w,m,m.userData.clayDepth??(background?.035:.025));});
}

// Sculpted shapes are kept so a repeated block costs nothing to build again.
// One wide deck can carry several megabytes of tessellated vertices while a
// small column carries a few kilobytes, so the cache is budgeted by the memory
// it actually holds rather than by a count. Eviction drops the least recently
// used shapes first, which keeps the small shapes that repeat all over a
// chapter and lets a player who turns around find the shapes just used.
// The budget has to clear the largest chapter's live working set, or the cache
// spends the level evicting shapes it is about to rebuild: at 48 MB a walk
// through the canyon hit 34% and evicted 325 times, with the cache pinned
// against its own ceiling from the first section onward. Ember Caverns holds
// ~105 MB of geometry at once, so the ceiling scales with reported memory and
// falls back to a small-device figure when the browser will not say.
export const CLAY_CACHE_BYTES=(()=>{
  // Profiling override, read only under Node so the browser path is untouched.
  const override=Number(globalThis.process?.env?.CLAYBOUND_CLAY_CACHE_MB);
  if(Number.isFinite(override)&&override>0)return Math.round(override*1024*1024);
  const reported=Number(globalThis.navigator?.deviceMemory);
  const gb=Number.isFinite(reported)&&reported>0?reported:4;
  return Math.round(Math.max(96,Math.min(256,gb*32))*1024*1024);
})();
const shapeBytes=geo=>{
  let bytes=geo.index?geo.index.array.byteLength:0;
  for(const attribute of Object.values(geo.attributes))bytes+=attribute.array.byteLength;
  return bytes;
};
export function cachedClayShape(w,key){
  const c=w.clay,geo=c?.boxes.get(key);
  if(!geo)return null;
  // Map iteration order is the recency list: reinserting marks this newest.
  c.boxes.delete(key);c.boxes.set(key,geo);
  return geo;
}
export function retainClayShape(w,key,geo){
  const c=w.clay;if(!c)return geo;
  geo.userData.clayBytes??=shapeBytes(geo);
  c.bytes=(c.bytes||0)+geo.userData.clayBytes;
  c.boxes.set(key,geo);w.assetGeometry.add(geo);
  return geo;
}
export const clayCacheOverBudget=w=>(w.clay?.bytes||0)>CLAY_CACHE_BYTES;
export function trimClayShapes(w,live){
  const c=w.clay;if(!c)return;
  for(const [key,geo]of c.boxes){
    if(c.bytes<=CLAY_CACHE_BYTES*.8)break;
    if(live.has(geo))continue;
    c.boxes.delete(key);w.assetGeometry.delete(geo);
    c.bytes-=geo.userData.clayBytes||0;geo.dispose();
  }
}

// Everything a chapter builds from a parametric primitive — extruded flags and
// arches, lathe-turned spikes, tube-twisted rope — goes through here. Those
// shapes used to be constructed fresh on every stream-in, and because
// sculptClay's WeakMap is keyed on the source geometry object, a freshly
// allocated source missed it every time and re-ran tessellation, welding and
// the normal solve for a shape identical to the one just disposed. Keying on
// the parameters instead makes the second visit to a stretch of level free.
// `build` must return the finished, sculpted geometry.
export function clayShape(w,key,build){
  if(!w.clay)return build();
  const cached=cachedClayShape(w,key);
  if(cached)return cached;
  const geo=build();
  if(!geo.boundingSphere)geo.computeBoundingSphere();
  return retainClayShape(w,key,geo);
}

// How finely a constructed block is divided before it is sculpted. The pressed
// fingerprints and pigment come from the triplanar shader, not from the mesh,
// so these two numbers buy silhouette: the waver along a long edge and the
// softness of a corner. They also set almost everything about build cost, since
// a rounded box at five segments is 1,452 triangles before sculpting even
// begins and longest-edge subdivision multiplies from there.
const BOX_SEGMENTS=3;
// Longest edge left unsplit, in world units. Below about 2 the split count
// climbs steeply across a wide deck for silhouette detail far finer than the
// orthographic framing resolves.
const MAX_EDGE=2;

export function clayBox(w,width,height,depth,radius,variant=0){
  const c=w.clay;if(!c)return null;
  const min=Math.min(width,height,depth),max=Math.max(width,height,depth);
  const key=[width,height,depth,radius].map(n=>n.toFixed(3)).join(':');
  const cached=cachedClayShape(w,key);
  if(cached)return cached;
  const base=new RoundedBoxGeometry(width,height,depth,BOX_SEGMENTS,Math.min(radius,width/3,height/3,depth/3));
  const g=sculptClay(w,base,{amplitude:Math.min(.065,min*.055),subdivide:max>3&&min>.15,maxEdge:Math.max(MAX_EDGE,max/60)});
  base.dispose();g.computeBoundingBox();g.computeBoundingSphere();
  return retainClayShape(w,key,g);
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

// Vertices landing on the same point, to the same ten-thousandth, form one
// welded group. A spatial hash over integer coordinates replaces the string key
// per vertex this used to build, which allocated an array and a string for
// every point of every sculpted form and dominated level building.
export function positionGroups(p){
  const count=p.count;
  const qx=new Int32Array(count),qy=new Int32Array(count),qz=new Int32Array(count),group=new Int32Array(count);
  for(let i=0;i<count;i++){qx[i]=Math.round(p.getX(i)*1e4);qy[i]=Math.round(p.getY(i)*1e4);qz[i]=Math.round(p.getZ(i)*1e4);}
  const buckets=new Map(),head=[];
  for(let i=0;i<count;i++){
    const hash=(Math.imul(qx[i],73856093)^Math.imul(qy[i],19349663)^Math.imul(qz[i],83492791))|0;
    const bucket=buckets.get(hash);let found=-1;
    // Hash collisions are resolved by comparing the coordinates themselves, so
    // the grouping stays exact.
    if(bucket!==undefined)for(const candidate of bucket){
      const v=head[candidate];
      if(qx[v]===qx[i]&&qy[v]===qy[i]&&qz[v]===qz[i]){found=candidate;break;}
    }
    if(found<0){found=head.length;head.push(i);if(bucket===undefined)buckets.set(hash,[found]);else bucket.push(found);}
    group[i]=found;
  }
  return {group,groups:head.length};
}

// Longest-edge subdivision only where broad faces need silhouette samples.
// Corners travel as plain numbers: the recursion used to build three vectors
// per corner and three more per midpoint, for every triangle of every broad
// sculpted block, and that allocation dominated level building.
function tessellate(g,maxEdge=1.05){
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,out=[],normals=[],uvs=[];
  const limit=maxEdge*maxEdge;
  const emit=(x,y,z,nx,ny,nz,u,v)=>{out.push(x,y,z);normals.push(nx,ny,nz);uvs.push(u,v);};
  const split=(ax,ay,az,aNx,aNy,aNz,aU,aV,bx,by,bz,bNx,bNy,bNz,bU,bV,cx,cy,cz,cNx,cNy,cNz,cU,cV,depth)=>{
    const ab=(ax-bx)**2+(ay-by)**2+(az-bz)**2;
    const bc=(bx-cx)**2+(by-cy)**2+(bz-cz)**2;
    const ca=(cx-ax)**2+(cy-ay)**2+(cz-az)**2;
    const longest=Math.max(ab,bc,ca);
    if(longest>limit&&depth<16){
      // Halve the longest edge and recurse, keeping the corner order the
      // former rotation produced.
      const next=depth+1;
      if(bc===longest){
        const mx=(bx+cx)*.5,my=(by+cy)*.5,mz=(bz+cz)*.5;
        let nx=bNx+cNx,ny=bNy+cNy,nz=bNz+cNz;const d=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;nx/=d;ny/=d;nz/=d;
        const mu=(bU+cU)*.5,mv=(bV+cV)*.5;
        split(bx,by,bz,bNx,bNy,bNz,bU,bV,mx,my,mz,nx,ny,nz,mu,mv,ax,ay,az,aNx,aNy,aNz,aU,aV,next);
        split(mx,my,mz,nx,ny,nz,mu,mv,cx,cy,cz,cNx,cNy,cNz,cU,cV,ax,ay,az,aNx,aNy,aNz,aU,aV,next);
      }else if(ca===longest){
        const mx=(cx+ax)*.5,my=(cy+ay)*.5,mz=(cz+az)*.5;
        let nx=cNx+aNx,ny=cNy+aNy,nz=cNz+aNz;const d=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;nx/=d;ny/=d;nz/=d;
        const mu=(cU+aU)*.5,mv=(cV+aV)*.5;
        split(cx,cy,cz,cNx,cNy,cNz,cU,cV,mx,my,mz,nx,ny,nz,mu,mv,bx,by,bz,bNx,bNy,bNz,bU,bV,next);
        split(mx,my,mz,nx,ny,nz,mu,mv,ax,ay,az,aNx,aNy,aNz,aU,aV,bx,by,bz,bNx,bNy,bNz,bU,bV,next);
      }else{
        const mx=(ax+bx)*.5,my=(ay+by)*.5,mz=(az+bz)*.5;
        let nx=aNx+bNx,ny=aNy+bNy,nz=aNz+bNz;const d=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;nx/=d;ny/=d;nz/=d;
        const mu=(aU+bU)*.5,mv=(aV+bV)*.5;
        split(ax,ay,az,aNx,aNy,aNz,aU,aV,mx,my,mz,nx,ny,nz,mu,mv,cx,cy,cz,cNx,cNy,cNz,cU,cV,next);
        split(mx,my,mz,nx,ny,nz,mu,mv,bx,by,bz,bNx,bNy,bNz,bU,bV,cx,cy,cz,cNx,cNy,cNz,cU,cV,next);
      }
      return;
    }
    emit(ax,ay,az,aNx,aNy,aNz,aU,aV);emit(bx,by,bz,bNx,bNy,bNz,bU,bV);emit(cx,cy,cz,cNx,cNy,cNz,cU,cV);
  };
  const index=g.index?.array,total=index?index.length:p.count;
  for(let i=0;i<total;i+=3){
    const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
    split(p.getX(a),p.getY(a),p.getZ(a),n.getX(a),n.getY(a),n.getZ(a),uv?uv.getX(a):0,uv?uv.getY(a):0,
          p.getX(b),p.getY(b),p.getZ(b),n.getX(b),n.getY(b),n.getZ(b),uv?uv.getX(b):0,uv?uv.getY(b):0,
          p.getX(c),p.getY(c),p.getZ(c),n.getX(c),n.getY(c),n.getZ(c),uv?uv.getX(c):0,uv?uv.getY(c):0,0);
  }
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
  const n=g.attributes.normal,count=p.count;
  const {group,groups}=positionGroups(p);
  const sx=new Float64Array(groups),sy=new Float64Array(groups),sz=new Float64Array(groups);
  const indices=g.index?.array;
  const total=indices?indices.length:count;
  for(let i=0;i<total;i+=3){
    const i0=indices?indices[i]:i,i1=indices?indices[i+1]:i+1,i2=indices?indices[i+2]:i+2;
    const ax=p.getX(i0),ay=p.getY(i0),az=p.getZ(i0);
    const ux=p.getX(i1)-ax,uy=p.getY(i1)-ay,uz=p.getZ(i1)-az;
    const vx=p.getX(i2)-ax,vy=p.getY(i2)-ay,vz=p.getZ(i2)-az;
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
    const g0=group[i0],g1=group[i1],g2=group[i2];
    sx[g0]+=cx;sy[g0]+=cy;sz[g0]+=cz;
    sx[g1]+=cx;sy[g1]+=cy;sz[g1]+=cz;
    sx[g2]+=cx;sy[g2]+=cy;sz[g2]+=cz;
  }
  for(let i=0;i<n.count;i++){
    const k=group[i],x=sx[k],y=sy[k],z=sz[k],length=Math.sqrt(x*x+y*y+z*z)||1;
    n.setXYZ(i,x/length,y/length,z/length);
  }
  g.userData.clayRelief=true;g.computeBoundingBox();g.computeBoundingSphere();c.sculpted.set(geometry,g);return g;
}
