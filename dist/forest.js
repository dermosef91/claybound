import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export const FOREST_FILES={hills:'forest-hills.glb',grove:'forest-grove.glb',falls:'forest-falls.glb',canopy:'forest-canopy.glb',distant:'forest-canopy-distant.glb',mushroom:'forest-mushroom.glb',heroMushroom:'forest-hero-mushroom.glb',bloom:'forest-bloom.glb',springPad:'forest-spring-pad.glb'};
export function prepareForestAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid forest model: '+key);
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  w.forestAssets??={};w.forestAssets[key]={scene:gltf.scene,box,size,center};
}
export async function loadForestAssets(w,onProgress){
  if(Object.keys(FOREST_FILES).every(key=>w.forestAssets?.[key])){onProgress?.(1);return;}
  if(!w.forestLoading){
    const progress=Object.keys(FOREST_FILES).map(()=>0);
    w.forestLoading=Promise.all(Object.entries(FOREST_FILES).map(async([key,file],i)=>{
      if(w.forestAssets?.[key]){progress[i]=1;return;}
      prepareForestAsset(w,key,await loadModel(file,v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}}));progress[i]=1;
    })).catch(e=>{w.forestLoading=null;throw e;});
  }
  await w.forestLoading;onProgress?.(1);
}
export function forestModel(w,key,parent,x,y,z,width,turn=0,background=false){
  const a=w.forestAssets?.[key];if(!a)throw new Error('Load the forest models before building Wildwood.');
  const root=new THREE.Group(),model=a.scene.clone(true);root.name='Forest '+key;
  root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(width/a.size.x);
  model.position.set(-a.center.x,-a.box.min.y,-a.center.z);root.add(model);parent.add(root);
  if(background)model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  return root;
}
function layer(w,name,factor){const g=new THREE.Group();g.name=name;w.backRoot.add(g);w.parallax.push({group:g,factor,heightFollow:1});return g;}

// Supplied tree crowns, grove islands and falls define the depth layers.
export function buildForestBackdrop(w){
  const far=layer(w,'Skybridge Falls skyline',.18),middle=layer(w,'Hazy canopy bridges',.38),near=layer(w,'Breathing forest trunks',.65);
  // Tall trees fill the frame; the old cliff islands sit low in the distance.
  for(let i=-3;i<5;i++)forestModel(w,'distant',far,i*24+5,-7.5-(i%2)*2,-42,22+(i%3)*2,.05*(i%2),true);
  for(let i=-2;i<4;i++)forestModel(w,'falls',far,i*48+12,-18,-55,15,0,true);
  for(let i=-3;i<5;i++){
    forestModel(w,'canopy',middle,i*22+7,-7.6-(i%2)*1.5,-27,9.5+(i%3),.06*(i%2),true);
    // Small distant ropeways connect the tree crowns without adding scenery
    // to the foreground collision plane.
    const x=i*22+6;w.box(7,.32,1.3,'back2',middle,x,-1.4,-25,.14);
    for(const side of [-1,1]){
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-3.4,-.3,-24+side*.4),new THREE.Vector3(x,-.7,-24+side*.4),new THREE.Vector3(x+3.4,-.3,-24+side*.4)]);
      w.mesh(new THREE.TubeGeometry(curve,18,.045,5,false),'back2',middle);
      for(const dx of [-3.3,-1.2,1.2,3.3])w.box(.08,.9,.08,'back2',middle,x+dx,-.88,-24+side*.4,.03);
    }
  }
  for(let i=-2;i<4;i++)forestModel(w,'canopy',near,i*25+3,-7.2,-13,9.5,(i%2)*-.12,true);
  for(let i=-1;i<3;i++)forestModel(w,'grove',far,i*53-14,-20,-43,9,0,true);
  for(let i=0;i<26;i++){const p=w.ball(.02,.032,.02,'cream',w.backRoot,-12+i*5,1.2+(i%7)*.65,-4-(i%4));p.castShadow=false;w.ambient.push({mesh:p,base:p.position.clone(),seed:i});}
  for(let i=0;i<30;i++){
    const leaf=w.ball(.14,.23,.045,i%2?'foliage':'leafLight',w.backRoot,-12+i*4.6,0,-2.7-(i%3));
    w.ambient.push({mesh:leaf,base:leaf.position.clone(),restScale:leaf.scale.clone(),seed:i,leaf:true});
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}
