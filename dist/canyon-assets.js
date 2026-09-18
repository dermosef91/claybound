import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export const CANYON_FILES={arch:'canyon-arch.glb',summit:'canyon-summit.glb',cactus:'cactus.glb',tent:'canyon-tent.glb',cave:'canyon-cave.glb',purpleArch:'canyon-purple-arch.glb'};
export function prepareCanyonAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.y>0&&size.x>0))throw new Error('Invalid canyon model: '+key);
  // The purple arch is left out of `background`: the only thing that flag still
  // does at a decoration's depth is stretch the lowest foot downward, and this
  // one is placed by an author who can drag it, so a base that stays where it
  // is put beats a base that trails legs once it leaves the canyon floor.
  // Its orange source is the measured 0.99 of its own baked albedo; the remap
  // masks on r>=g>=b, so the violet veining passes through as supplied.
  const background=key==='arch'||key==='summit',orangeSource={arch:.875,summit:.820,tent:.824,cave:.82,purpleArch:.99}[key]||0;
  clayMaterials(gltf.scene,{background,orangeSource});clayModel(w,gltf.scene,{background});
  // Continue the lowest foot of each formation down into the canyon. The
  // authored arch and summit stay intact above the base, instead of floating.
  if(background)gltf.scene.traverse(o=>{if(o.isMesh){
    const g=o.geometry.clone();g.computeBoundingBox();const low=g.boundingBox.min.y,span=g.boundingBox.max.y-low,p=g.attributes.position;
    for(let i=0;i<p.count;i++){const t=Math.max(0,1-(p.getY(i)-low)/(span*.12));p.setY(i,p.getY(i)-span*2.5*t*t);}
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;
  }});
  gltf.scene.traverse(o=>{if(o.isMesh){o.material.normalScale?.setScalar(.9);o.material.roughness=.93;}});
  if(key==='cave')gltf.scene.traverse(o=>{if(o.isMesh){
    // Baked cavity shade leaves the exposed rim sunlit. This is local to the
    // supplied sculpture, so the platforms and the chapter lighting stay clear.
    // Vertex colour avoids shader/load-order dependencies and keeps all source
    // positions, normals and UVs unchanged.
    const p=o.geometry.attributes.position,colors=new Float32Array(p.count*3),smooth=THREE.MathUtils.smoothstep;
    for(let i=0;i<p.count;i++){
      const depth=1-smooth(p.getZ(i),-.22,.36),interior=(1-smooth(p.getY(i),.12,.38))*(1-smooth(Math.abs(p.getX(i)),.52,.9));
      const shade=1-.62*depth*interior;colors.fill(shade,i*3,i*3+3);
    }
    o.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));o.material.vertexColors=true;o.material.needsUpdate=true;
  }});
  retainModel(w,gltf.scene);w.canyonAssets??={};w.canyonAssets[key]={scene:gltf.scene,height:size.y,width:size.x,depth:size.z,base:bounds.min.y,center};
}
export async function loadCanyonAssets(w,onProgress){
  const progress=Object.keys(CANYON_FILES).map(()=>0);
  await Promise.all(Object.entries(CANYON_FILES).map(async([key,file],i)=>{
    const report=v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}};
    prepareCanyonAsset(w,key,await loadModel(file,report));report(1);
  }));
}
export function canyonModel(w,key,parent,x,y,z,height,turn=0){
  const asset=w.canyonAssets?.[key];if(!asset)return new THREE.Group();
  const root=new THREE.Group(),model=asset.scene.clone(true);root.name='Canyon '+key;
  root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(height/asset.height);
  model.position.set(-asset.center.x,-asset.base,-asset.center.z);root.add(model);parent.add(root);return root;
}
