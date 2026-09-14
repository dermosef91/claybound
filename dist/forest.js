import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {cloudModel} from './clouds.js';

export const FOREST_FILES={hills:'forest-hills.glb',grove:'forest-grove.glb',falls:'forest-falls.glb',waterfall:'forest-waterfall.glb',canopy:'forest-canopy.glb',distant:'forest-canopy-distant.glb',mushroom:'forest-mushroom.glb',heroMushroom:'forest-hero-mushroom.glb',bloom:'forest-bloom.glb',springPad:'forest-spring-pad.glb'};
// Models that only ever stand behind the playfield. Flattening their relief
// drops detail contrast with distance, which is what reads as depth once the
// haze takes the colour out: near clay stays crisp, far clay goes soft.
const BACKDROP_ONLY=new Set(['distant','falls','grove','waterfall','canopy']);
export function prepareForestAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid forest model: '+key);
  const orangeSource={mushroom:.933,heroMushroom:.851,springPad:.996}[key]||0;
  clayMaterials(gltf.scene,{orangeSource});
  if(BACKDROP_ONLY.has(key))gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(m.normalMap)m.normalScale.setScalar(key==='canopy'?.3:.18);
      m.roughness=1;m.needsUpdate=true;
    }
  });
  clayModel(w,gltf.scene);retainModel(w,gltf.scene);
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
// Anchored in world space behind the root-spring column (x 75-80).
export const CASCADE={x:78,y:-5,z:-33,width:17};
function layer(w,name,factor){const g=new THREE.Group();g.name=name;w.backRoot.add(g);w.parallax.push({group:g,factor,heightFollow:1});return g;}

// Supplied tree crowns, grove islands and cliff falls define the depth layers.
// Wildwood reads back to front: open sky, drifting clay clouds, the cascade
// terraces that give the chapter its horizon, then three bands of canopy.
// The camera looks slightly down, so a band's apparent height on screen is its
// own height plus roughly a sixteenth of its distance: each band below is
// lifted for the crown line it should draw, not for its raw world height.
export function buildForestBackdrop(w){
  const far=layer(w,'Skybridge Falls skyline',.18),sky=layer(w,'Wildwood clouds',.09),middle=layer(w,'Hazy canopy bridges',.38),near=layer(w,'Breathing forest trunks',.62);
  // Tall crowns close the horizon; the old cliff islands sit low behind them.
  for(let i=-3;i<5;i++)forestModel(w,'distant',far,i*26+5,-15.3-(i%2)*1.3,-44,20+(i%3)*2,.05*(i%2),true);
  // A second, smaller row alternates the two crown shapes so the far woodland
  // rolls and lets sky through instead of closing into one flat wall of green.
  for(let i=-4;i<7;i++)forestModel(w,'distant',far,i*17-2,-10.6-(i%2)*.8,-44,11+(i%3)*1.4,.09*(i%2),true);
  for(let i=-4;i<7;i++)if(i%2)forestModel(w,'canopy',far,i*17+7,-10.6,-45,9+(i%3),.12,true);
  // The old cliff islands and grove sit behind that line, reading as shape
  // through the haze instead of as pale blocks beside it.
  for(let i=-2;i<4;i++)forestModel(w,'falls',far,i*44+12,-11.5,-56,13,0,true);
  for(let i=-1;i<3;i++)forestModel(w,'grove',far,i*53-14,-13.4,-50,9,0,true);
  // The supplied cascade is a landmark, not a texture: one of them, fixed to
  // the world behind Under the Roots rather than carried by a parallax band,
  // so that passage is the only place in Wildwood where the falls are in view.
  forestModel(w,'waterfall',w.backRoot,CASCADE.x,CASCADE.y,CASCADE.z,CASCADE.width,-.05,true);
  for(let i=-4;i<7;i++)cloudModel(w,sky,i*18+3,2.1+(i%3)*1.1,-40,4.4+(i%4)*1.5,.07*(i%2));
  // The cascade model carries its own rail fences, so the canopy band stays
  // pure foliage instead of hanging a second ropeway in mid-air.
  for(let i=-3;i<5;i++)forestModel(w,'canopy',middle,i*19+7,-10.9-(i%2)*1.1,-22,8+(i%3)*.7,.06*(i%2),true);
  for(let i=-2;i<5;i++)forestModel(w,'canopy',near,i*17+3,-10.2,-13,7+(i%2)*.8,(i%2)*-.12,true);
  for(let i=0;i<26;i++){const p=w.ball(.02,.032,.02,'cream',w.backRoot,-12+i*5,1.2+(i%7)*.65,-4-(i%4));p.castShadow=false;w.ambient.push({mesh:p,base:p.position.clone(),seed:i});}
  for(let i=0;i<30;i++){
    const leaf=w.ball(.14,.23,.045,i%2?'foliage':'leafLight',w.backRoot,-12+i*4.6,0,-2.7-(i%3));
    w.ambient.push({mesh:leaf,base:leaf.position.clone(),restScale:leaf.scale.clone(),seed:i,leaf:true});
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}
