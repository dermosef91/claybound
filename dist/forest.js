import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {cloudModel} from './clouds.js';

export const FOREST_FILES={hills:'forest-hills.glb',grove:'forest-grove.glb',falls:'forest-falls.glb',waterfall:'forest-waterfall.glb',canopy:'forest-canopy.glb',mushroom:'forest-mushroom.glb',heroMushroom:'forest-hero-mushroom.glb',bloom:'forest-bloom.glb',springPad:'forest-spring-pad.glb'};
// Models that only ever stand behind the playfield. Flattening their relief
// drops detail contrast with distance, which is what reads as depth once the
// haze takes the colour out: near clay stays crisp, far clay goes soft.
const BACKDROP_ONLY=new Set(['falls','grove','waterfall','canopy']);
export function prepareForestAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid forest model: '+key);
  const orangeSource={mushroom:.933,heroMushroom:.851,springPad:.996}[key]||0;
  clayMaterials(gltf.scene,{orangeSource});
  if(BACKDROP_ONLY.has(key))gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(m.normalMap)m.normalScale.setScalar(key==='canopy'?.14:.08);
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
export const CASCADE={x:78,y:-5,z:-28,width:17};
function layer(w,name,factor){const g=new THREE.Group();g.name=name;w.backRoot.add(g);w.parallax.push({group:g,factor,heightFollow:1});return g;}

// Supplied tree crowns, grove islands and cliff falls define the depth layers.
// The bands are built from whole trees, not from scaled-up crowns: a canopy
// carries its own trunk, so at a readable size it still reads as a tree
// through the haze, where one enormous crown only reads as a green wall.
// The camera looks slightly down, so a band's apparent height on screen is its
// own height plus roughly a sixteenth of its distance: each band below is
// lifted for the crown line it should draw, not for its raw world height.
export function buildForestBackdrop(w){
  const far=layer(w,'Skybridge Falls skyline',.18),sky=layer(w,'Wildwood clouds',.09),middle=layer(w,'Hazy canopy bridges',.38),near=layer(w,'Breathing forest trunks',.62);
  // The crown line: separate trees with gaps of sky between them.
  for(let i=-3;i<8;i++)forestModel(w,'canopy',far,i*13+4,-7.2-(i%3)*.7,-32,6+(i%4)*.9,-.1+(i%3)*.1,true);
  // A second row of the same tree, smaller and deeper, interleaved with the
  // first. Depth comes from two ranks of trees rather than from one broad
  // crown blown up until it fills the frame.
  for(let i=-3;i<9;i++)forestModel(w,'canopy',far,i*11+10,-6.9-(i%3)*.5,-38,4.6+(i%4)*.7,.14-(i%3)*.1,true);
  // The old cliff islands and grove sit behind all of it, reading as shape
  // through the haze rather than as pale blocks beside the trees.
  for(let i=-2;i<4;i++)forestModel(w,'falls',far,i*44+12,-10.3,-52,13,0,true);
  for(let i=-1;i<3;i++)forestModel(w,'grove',far,i*53-14,-10.7,-44,9,0,true);
  // The supplied cascade is a landmark, not a texture: one of them, fixed to
  // the world behind Under the Roots rather than carried by a parallax band,
  // so that passage is the only place in Wildwood where the falls are in view.
  forestModel(w,'waterfall',w.backRoot,CASCADE.x,CASCADE.y,CASCADE.z,CASCADE.width,-.05,true);
  // Clouds sit behind every band and above its crown line, so they never cut
  // across a tree or a cliff; open sky is the only thing they overlap.
  for(let i=-4;i<8;i++)cloudModel(w,sky,i*22+3,2.95+(i%3)*.9,-34,4.6+(i%4)*1.4,.07*(i%2));
  for(let i=-3;i<7;i++)forestModel(w,'canopy',middle,i*17+7,-8.1-(i%2)*.8,-22,5.4+(i%3)*.8,.06*(i%2),true);
  // Nearest band: only crowns, peeking between the decks.
  for(let i=-2;i<6;i++)forestModel(w,'canopy',near,i*27+5,-7.9,-13,4.2+(i%2)*.7,(i%2)*-.12,true);
  for(let i=0;i<26;i++){const p=w.ball(.02,.032,.02,'cream',w.backRoot,-12+i*5,1.2+(i%7)*.65,-4-(i%4));p.castShadow=false;w.ambient.push({mesh:p,base:p.position.clone(),seed:i});}
  for(let i=0;i<30;i++){
    const leaf=w.ball(.14,.23,.045,i%2?'foliage':'leafLight',w.backRoot,-12+i*4.6,0,-2.7-(i%3));
    w.ambient.push({mesh:leaf,base:leaf.position.clone(),restScale:leaf.scale.clone(),seed:i,leaf:true});
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}
