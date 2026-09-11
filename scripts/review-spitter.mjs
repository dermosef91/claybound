// A concept sheet made from the enemy's actual runtime meshes and poses.
import * as THREE from '../dist/lib/three.module.js';
import {loadTitleWorld} from '../tests/load-title.mjs';
import {applyEnvironment} from '../dist/environments.js';
import {LEVELS} from '../dist/levels.js';
import {createSpitterView,syncShots} from '../dist/spitter.js';
import {exportReview} from './review-scene.mjs';
const {world:w,images}=await loadTitleWorld();
w.character.root.removeFromParent();w.character.shadow.removeFromParent();
w.levelRoot=new THREE.Group();w.scene.add(w.levelRoot);w.scene.fog=new THREE.Fog('#dfd3bf',70,150);
w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=[];
applyEnvironment(w,LEVELS[2]);
for(const [i,state]of ['watch','charge','recover'].entries()){
  const x=(i-1)*2.1;
  createSpitterView(w,{id:i,kind:'spitter',x,y:0,dir:i===2?.8:-.35,alive:true,aiState:state,stateTime:state==='charge'?.82:.05,aimX:x+5,aimY:.8});
}
syncShots(w,{shots:[{id:0,x:2.9,y:.7,vx:6.5,vy:0,age:.1}]});
w.box(9,.15,3,'cream',w.levelRoot,0,-.075,0,.04);
await exportReview(w.scene,null,process.argv[2],{camera:{x:0,y:.6,z:26,elevation:.4,viewW:7.3,viewH:2.7},theme:w.theme,sky:'#e2d7c5',fog:'#e2d7c5',fogNear:70,fogFar:150,backgroundBlur:0,lights:[]},images);
