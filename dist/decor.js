import * as THREE from './lib/three.module.js';
import {DECOR_KINDS,decorSize,placeDecor} from './decor-kinds.js';
import {clayTree,clayTorch} from './environments.js';
import {canyonModel} from './canyon-assets.js';
import {forestModel} from './forest.js';
import {forestBloom,forestLeaf} from './forest-details.js';
import {caveCrystals,caveMushrooms,caveMoss} from './cavern.js';
import {cavernModel} from './cavern-asset.js';
import {cottageModel} from './cottage.js';
import {cloudModel} from './clouds.js';
import {windmillModel} from './windmill.js';
import {castle} from './castle.js';
import {cityLaundry} from './city-laundry.js';

// Built props are authored at a natural width and then scaled to the one the
// placement asks for, so Size reads the same for a pebble and for a castle.
// The natural widths are measured from the built geometry rather than guessed
// at, which is what `tests/scene.mjs` holds them to.
const at=(g,size,natural)=>{const inner=new THREE.Group();inner.scale.setScalar(size/natural);g.add(inner);return inner;};
// The canyon formations are normalised by height rather than width. Convert, so
// a placement's Size stays the width of its silhouette everywhere.
function canyonWide(w,key,g,size){
  const a=w.canyonAssets?.[key];
  canyonModel(w,key,g,0,0,0,a?size*a.height/a.width:size,0);
}

// One builder per catalogue key. Each leaves its prop centred on x with its
// base on y, so the placement's own coordinates are the ones an author sees.
const BUILDERS={
  boulder(w,g,size){
    const b=at(g,size,2.73);
    for(const [x,z,r,turn]of [[0,0,1,.08],[-.95,.42,.55,-.34],[1,-.26,.46,.29],[.16,-.68,.3,.62]]){
      const m=w.box(1.32,1.08,1.24,r>.7?'terrain':'terrain2',b,x,.5*r,z,.32);m.scale.setScalar(r);m.rotation.set(.03,turn,turn*.26);
    }
  },
  pebbles(w,g,size){
    const b=at(g,size,1.66);
    for(const [x,z,r]of [[-.58,.1,.26],[-.12,-.14,.18],[.3,.16,.3],[.68,-.05,.14]])w.ball(r,r*.62,r*.86,'terrain2',b,x,r*.5,z);
    for(const [x,z]of [[-.3,.4],[.5,.44]])w.ball(.1,.05,.09,'top',b,x,.03,z);
  },
  shelf(w,g,size){
    const b=at(g,size,4);
    w.box(3.7,3.2,2.3,'terrain',b,0,-1.6,0,.25);
    w.box(4,.38,2.62,'terrain2',b,0,.04,.03,.17);
    w.box(1.68,.6,.25,'terrain2',b,-.92,-1.28,1.19,.14);
  },
  pot(w,g,size){
    const b=at(g,size,.9);
    w.ball(.45,.39,.45,'orange',b,0,.4,0);w.cylinder(.25,.1,'orangeLight',b,0,.78,0);
    w.ball(.13,.15,.13,'foliage',b,0,.9,0);
  },
  torch(w,g,size){clayTorch(w,at(g,size,.62),0,0,0);},
  tree(w,g,size){clayTree(w,at(g,size,4.87),0,0,1,'foliage',0);},
  cloud(w,g,size){cloudModel(w,g,0,size*.34,0,size);},
  cactus(w,g,size){canyonWide(w,'cactus',g,size);},
  'canyon-arch'(w,g,size){canyonWide(w,'arch',g,size);},
  summit(w,g,size){canyonWide(w,'summit',g,size);},
  tent(w,g,size){canyonWide(w,'tent',g,size);},
  'cave-mouth'(w,g,size){canyonWide(w,'cave',g,size);},
  windmill(w,g,size){const a=w.windmillAssets?.tower;if(a)windmillModel(w,at(g,size,4.49*a.size.x/a.size.y));},
  mushroom(w,g,size){forestModel(w,'mushroom',g,0,0,0,size);},
  'hero-mushroom'(w,g,size){forestModel(w,'heroMushroom',g,0,0,0,size);},
  bloom(w,g,size){forestBloom(w,g,0,0,0,size);},
  leaves(w,g,size){const b=at(g,size,2.31);for(let i=0;i<5;i++)forestLeaf(w,b,(i-2)*.32,Math.sin(i)*.14,(i%2)*.1,.8+(i%2)*.2,-.5+i*.25);},
  canopy(w,g,size){forestModel(w,'canopy',g,0,0,0,size);},
  grove(w,g,size){forestModel(w,'grove',g,0,0,0,size);},
  hills(w,g,size){forestModel(w,'hills',g,0,0,0,size);},
  falls(w,g,size){forestModel(w,'falls',g,0,0,0,size);},
  waterfall(w,g,size){forestModel(w,'waterfall',g,0,0,0,size);},
  crystals(w,g,size){caveCrystals(w,g,0,0,0,size/1.48);},
  'cave-mushrooms'(w,g,size){caveMushrooms(w,g,0,0,0,size/1.94);},
  moss(w,g,size){caveMoss(w,g,0,0,0,size/.76,size/.76,0);},
  grotto(w,g,size){cavernModel(w,'grotto',g,0,0,0,size,0,{lights:false});},
  crystalcap(w,g,size){cavernModel(w,'crystalcap',g,0,0,0,size,0,{lights:false});},
  cottage(w,g,size){cottageModel(w,g,0,0,0,size);},
  laundry(w,g,size){cityLaundry(w,g,0,0,0,size);},
  doorway(w,g,size){w.doorway(g,0,0,0,size/1.3);},
  castle(w,g,size){castle(w,g,0,0,0,size);}
};

export const decorBuilders=()=>Object.keys(BUILDERS);
export function decorView(w,item){
  const spec=DECOR_KINDS[item.kind],root=new THREE.Group();
  root.name='Decoration: '+(spec?.label||item.kind);
  placeDecor(root,item);w.levelRoot.add(root);
  // A placement whose chapter assets are not resident must not take the rest of
  // the streamed foreground with it. An empty prop is recoverable; a stream
  // that stopped halfway through a chapter is not.
  try{BUILDERS[item.kind]?.(w,root,decorSize(item));}
  catch(error){root.userData.decorError=error.message;}
  // Decoration set well back reads as backdrop, and a backdrop casting shadows
  // into the playfield costs a shadow pass for a silhouette nobody can reach.
  if(root.position.z<-8)root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  return root;
}
