import * as THREE from './lib/three.module.js';
import {forestModel} from './forest.js';

export function createSpringPad(w,s,parent){
  const pad=new THREE.Group();pad.name='Scarlet target spring';
  const model=forestModel(w,'springPad',pad,0,0,0,s.w,0);
  model.rotation.x=.25;model.scale.z*=.83;
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3());
  // Tilt the target toward the player, then fit its complete height above the
  // supporting deck. Its upper face still coincides with the collision plane.
  const support=w.currentLevel?.platforms.filter(p=>p.id!==s.id&&['stone','ledge'].includes(p.kind)&&s.x+s.w/2>=p.x&&s.x+s.w/2<=p.x+p.w&&p.y<s.y).sort((a,b)=>b.y-a.y)[0];
  const height=Math.min(.46,Math.max(.18,support?s.y-support.y:.42));
  model.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
  pad.scale.y=height/size.y;pad.position.set(s.w/2,-height,0);
  parent.add(pad);
  return {pad,height};
}
export function animateSpringPad(view,dt){
  view.bounce=Math.max(0,view.bounce-dt*2.5);
  if(!view.springPad)return;
  const {pad,height}=view.springPad;
  if(view.springScale===undefined)view.springScale=pad.scale.y;
  const pulse=Math.sin(view.bounce*9)*view.bounce;
  pad.scale.y=view.springScale*(1+Math.max(-.22,Math.min(.14,pulse*.22)));
  pad.position.y=-height;
  pad.scale.x=pad.scale.z=1-pulse*.05;
}
