import * as THREE from './lib/three.module.js';
import {PRESS} from './presses.js';

export function createPressView(w,c){
  const root=new THREE.Group();root.name='Anchored cavern press';root.position.set(c.x,c.baseY??c.y,0);w.levelRoot.add(root);
  // The housing and guide rails never descend with the head.
  w.box(c.w+1.25,.72,2.9,'terrain2',root,0,1.7,-.12,.2);
  for(const side of [-1,1]){
    w.box(.23,7,1.2,'terrain2',root,side*(c.w/2+.38),4.8,-1.2,.09);
    w.box(.14,(c.baseY??c.y)-(c.bottomY??c.y-c.range)+.8,.18,'barkLight',root,side*(c.w/2+.16),-c.range/2+.45,-1.1,.06);
  }
  const head=new THREE.Group();head.name='Moving press head';root.add(head);
  w.box(c.w,1.16,2.5,'terrain',head,0,.06,0,.22);
  w.box(c.w+.04,.20,2.54,'barkLight',head,0,-PRESS.halfHeight+.10,0,.065);
  w.box(.38,c.range+2.8,.52,'barkLight',head,0,(c.range+2.8)/2+.5,-.65,.1);
  for(const side of [-1,1])w.ball(.11,.11,.065,'rope',head,side*c.w*.31,.27,1.28);
  const lamp=w.ball(.15,.15,.06,'accent',head,0,.22,1.29);
  const warning=w.box(c.w*.60,.07,.06,'orangeLight',head,0,-.22,1.28,.025);
  root.userData.press={head,lamp,warning};animatePressView(root,c);return root;
}
export function animatePressView(root,c){
  if(!root)return;
  root.position.set(c.x,c.baseY??c.y,0);
  const {head,lamp,warning}=root.userData.press;
  head.position.y=c.y-(c.baseY??c.y);
  lamp.visible=c.held;warning.visible=!c.held;
  warning.scale.x=c.state==='warning'?.35+.65*c.warning:c.state==='slam'||c.state==='impact'?1:.25;
  // Only the head trembles during the readable wind-up.
  head.rotation.z=c.state==='warning'?Math.sin(c.cycleTime*58)*.014*c.warning:0;
}
