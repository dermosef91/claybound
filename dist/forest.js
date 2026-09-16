import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export const FOREST_FILES={hills:'forest-hills.glb',grove:'forest-grove.glb',falls:'forest-falls.glb',waterfall:'forest-waterfall.glb',canopy:'forest-canopy.glb',distant:'forest-canopy-distant.glb',mushroom:'forest-mushroom.glb',heroMushroom:'forest-hero-mushroom.glb',bloom:'forest-bloom.glb',springPad:'forest-spring-pad.glb'};
export function prepareForestAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid forest model: '+key);
  const orangeSource={mushroom:.933,heroMushroom:.851,springPad:.996}[key]||0;
  clayMaterials(gltf.scene,{orangeSource});clayModel(w,gltf.scene);retainModel(w,gltf.scene);
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

// A small crossing: deck, two slung ropes and the posts that carry them. These
// connect the tree crowns without adding scenery to the foreground collision
// plane, so nothing here is a collider. The ropes hang a unit nearer than the
// deck, which is what reads as a walkway seen from the side.
function ropeway(w,parent,x,y,z){
  w.box(7,.32,1.3,'back2',parent,x,y,z,.14);
  for(const side of [-1,1]){
    const rail=z+1+side*.4;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-3.4,y+1.1,rail),new THREE.Vector3(x,y+.7,rail),new THREE.Vector3(x+3.4,y+1.1,rail)]);
    w.mesh(new THREE.TubeGeometry(curve,18,.045,5,false),'back2',parent);
    for(const dx of [-3.3,-1.2,1.2,3.3])w.box(.08,.9,.08,'back2',parent,x+dx,y+.52,rail,.03);
  }
}

// One landmark belonging to one passage, rather than another tiled crown, so
// it gets a layer of its own for two reasons. A span wider than any chapter
// keeps animateEnvironment's wrap from ever bringing a second copy into view,
// and its own factor is what decides how long it stays in frame: a landmark
// crosses the screen over (view + model) / factor of camera travel, so a
// vista meant to belong to a passage wants a factor near the near trunks'
// rather than the distant skyline's. `centredAfter` is how far past the
// passage's start the camera is when the vista sits dead centre — a distance
// rather than a share of the passage, so re-cutting where the next passage
// begins moves what the vista belongs to without also reframing it. `drop`
// sinks the model below the framing height by a share of its own width; far
// enough and the base leaves the bottom of the frame, which is what stops a
// cliff from reading as a slab hung in the air.
function passageVista(w,L,key,{factor,z,width,centredAfter,drop}){
  const section=L?.sections?.find(s=>s.backdrop===key);
  if(!section||!w.forestAssets?.[key])return;
  const g=new THREE.Group();g.name='Vista: '+section.name;w.backRoot.add(g);
  w.parallax.push({group:g,factor,heightFollow:1,repeat:1e4});
  // Authored net of the layer's own motion, so the composition belongs to the
  // passage rather than to the world origin: x undoes the horizontal scroll at
  // the camera position the vista is centred on, and y undoes both the vertical
  // follow and the lift that depth gets from the camera's tilt. The frame is
  // measured against the passage's lowest bough, which is the height the route
  // actually runs at — its highest are detours far above the vista.
  const boughs=L.platforms.filter(s=>s.x>=section.x&&s.x<section.end).map(s=>s.y);
  const elevation=w.theme.cameraElevation??3.05,tilt=elevation/Math.hypot(26,elevation);
  const follow=Math.min(1,1-factor*.35),eye=(boughs.length?Math.min(...boughs):0)+.7;
  const x=(section.x+centredAfter)*factor;
  const y=eye-Math.max(0,eye-1.1)*follow+z*tilt-width*drop;
  forestModel(w,key,g,x,y,z,width,0,true);
}

// Supplied tree crowns, grove islands and falls define the depth layers.
export function buildForestBackdrop(w,L){
  const far=layer(w,'Skybridge Falls skyline',.18),middle=layer(w,'Hazy canopy bridges',.38),near=layer(w,'Breathing forest trunks',.65);
  // Tall trees fill the frame; the old cliff islands sit low in the distance.
  for(let i=-3;i<5;i++)forestModel(w,'distant',far,i*24+5,-7.5-(i%2)*2,-42,22+(i%3)*2,.05*(i%2),true);
  for(let i=-2;i<4;i++)forestModel(w,'falls',far,i*48+12,-18,-55,15,0,true);
  for(let i=-3;i<5;i++){
    forestModel(w,'canopy',middle,i*22+7,-7.6-(i%2)*1.5,-27,9.5+(i%3),.06*(i%2),true);
    ropeway(w,middle,i*22+6,-1.4,-25);
  }
  for(let i=-2;i<4;i++)forestModel(w,'canopy',near,i*25+3,-7.2,-13,9.5,(i%2)*-.12,true);
  for(let i=-1;i<3;i++)forestModel(w,'grove',far,i*53-14,-20,-43,9,0,true);
  // The crumbling boughs run against nothing but haze, so the supplied falls
  // give that passage a horizon of its own: they rise at the right edge as its
  // first bough is reached and stand squarely ahead by its last. Between the
  // two crown layers in both drift and depth, so the hazy crowns and the
  // distant ropeways pass behind the cliff while the near trunks still sweep
  // in front of it, and at this distance the fog leaves the rock and the water
  // their colour. Wide enough to read as a gorge and sunk far enough that the
  // rock runs off the bottom of the frame rather than ending in mid-air.
  passageVista(w,L,'waterfall',{factor:.45,z:-20,width:14.5,centredAfter:35,drop:.43});
  for(let i=0;i<26;i++){const p=w.ball(.02,.032,.02,'cream',w.backRoot,-12+i*5,1.2+(i%7)*.65,-4-(i%4));p.castShadow=false;w.ambient.push({mesh:p,base:p.position.clone(),seed:i});}
  for(let i=0;i<30;i++){
    const leaf=w.ball(.14,.23,.045,i%2?'foliage':'leafLight',w.backRoot,-12+i*4.6,0,-2.7-(i%3));
    w.ambient.push({mesh:leaf,base:leaf.position.clone(),restScale:leaf.scale.clone(),seed:i,leaf:true});
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}
