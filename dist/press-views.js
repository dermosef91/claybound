import * as THREE from './lib/three.module.js';
import {PRESS} from './presses.js';
import {clayMaterial,sculptClay} from './clay.js';
import {RoundedBoxGeometry} from './lib/RoundedBoxGeometry.js';

function pressClay(w,color,roughness){
  const material=new THREE.MeshStandardMaterial({color,roughness});
  clayMaterial(w,material,.022);
  const finish=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    finish(shader);
    if(shader.uniforms.clayPeriod)shader.uniforms.clayPeriod.value*=.55;
  };
  material.customProgramCacheKey=()=> 'press-clay-relief-v1';
  return material;
}

function pressBox(w,width,height,depth,material,parent,x,y,z,radius){
  const base=new RoundedBoxGeometry(width,height,depth,6,Math.min(radius,width*.48,height*.48,depth*.48));
  const geometry=sculptClay(w,base,{amplitude:Math.min(.012,Math.min(width,height,depth)*.025)});
  if(geometry!==base)base.dispose();
  return w.mesh(geometry,material,parent,x,y,z);
}

export function createPressView(w,c){
  const root=new THREE.Group();root.name='Anchored cavern press';root.position.set(c.x,c.baseY??c.y,0);w.levelRoot.add(root);
  // Dedicated clay pigments keep the machinery warm against the blue cavern.
  // These materials belong to this press and are released with its streamed view.
  const slate=pressClay(w,0x454b60,.68);
  const brass=pressClay(w,0xc39755,.7);
  // The housing and guide rails never descend with the head.
  w.box(c.w+1.25,.72,2.9,'terrain2',root,0,1.7,-.12,.2);
  const travel=(c.baseY??c.y)-(c.bottomY??c.y-c.range);
  const railTop=.96,railBottom=-travel-PRESS.halfHeight;
  const railX=c.w/2+.22;
  for(const side of [-1,1]){
    w.box(.23,7,1.2,'terrain2',root,side*(c.w/2+.38),4.8,-1.2,.09);
    pressBox(w,.22,railTop-railBottom,.32,brass,root,side*railX,(railTop+railBottom)/2,.05,.105);
  }
  const head=new THREE.Group();head.name='Moving press head';root.add(head);
  pressBox(w,c.w,1.12,2.5,slate,head,0,.12,0,.32);
  pressBox(w,c.w+.10,.30,2.58,brass,head,0,-PRESS.halfHeight+.15,0,.14);
  pressBox(w,.42,c.range+2.8,.56,brass,head,0,(c.range+2.8)/2+.5,-.65,.12);
  for(const side of [-1,1]){
    // The head's sliding collars bridge the gap to the fixed guide rails.
    pressBox(w,.18,.43,.48,slate,head,side*(c.w/2+.065),.16,.05,.085);
    pressBox(w,.16,.30,.38,brass,head,side*(railX+.15),.16,.05,.075);
    w.ball(.145,.145,.09,brass,head,side*c.w*.31,.22,1.28);
  }
  const lamp=w.ball(.15,.15,.06,'accent',head,0,.22,1.29);
  const warning=w.box(c.w*.60,.105,.09,'orangeLight',head,0,-.18,1.29,.035);
  root.userData.press={head,lamp,warning};animatePressView(root,c);return root;
}
export function animatePressView(root,c){
  if(!root)return;
  root.position.set(c.x,c.baseY??c.y,0);
  const {head,lamp,warning}=root.userData.press;
  head.position.y=c.y-(c.baseY??c.y);
  lamp.visible=c.held;warning.visible=!c.held;
  warning.scale.x=c.state==='warning'?.35+.65*c.warning:c.state==='slam'||c.state==='impact'?1:.35;
  // Only the head trembles during the readable wind-up.
  head.rotation.z=c.state==='warning'?Math.sin(c.cycleTime*58)*.014*c.warning:0;
}
