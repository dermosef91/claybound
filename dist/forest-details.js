import * as THREE from './lib/three.module.js';
import {forestModel} from './forest.js';
import {createSporeBall,animateSporeBall} from './spore-ball.js';

export function forestBloom(w,parent,x,y,z,width=.9,turn=0){
  const g=forestModel(w,'bloom',parent,x,y,z,width,turn);g.name='Flowering clay leaves';return g;
}
export function forestMushroom(w,parent,x,y,z,width=1,turn=0){
  const key=width>1.3?'heroMushroom':'mushroom',g=forestModel(w,key,parent,x,y,z,width,turn);g.name='Scarlet clay mushroom';return g;
}
export function forestLeaf(w,parent,x,y,z,size=.28,angle=0){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.z=angle;parent.add(g);
  const leaf=w.ball(size*.48,size,size*.13,'foliage',g);leaf.rotation.y=.18;
  w.box(.025,size*1.3,.035,'leafLight',g,0,-size*.03,size*.11,.012);return g;
}
export function forestCover(w,s,g,depth=2.08){
  w.box(s.w+.07,.22,depth,'top',g,s.w/2,-.025,0,.105);
  for(let i=0;i<Math.ceil(s.w/1.05);i++){
    const x=Math.min(s.w-.13,.22+i*1.05);
    w.ball(.48,.12,.32,'top',g,x,-.02,depth*.36);
    if(i%3===1)forestLeaf(w,g,x,-.19,depth*.49,.23,-.2);
  }
  for(const [x,width,turn]of [[.3,1.5,-.16],[s.w-.5,1.45,.18]])forestBloom(w,g,x,-.35,depth*.49,width,turn);
  if(s.w>6)forestBloom(w,g,s.w*.36,-.2,depth*.49,.63,.1);
}
export function forestBranch(w,s,g){
  g.name='Mossy branch '+s.id;
  w.box(s.w,.54,2.02,'barkLight',g,s.w/2,-.32,0,.24);
  forestCover(w,s,g);
  const x=s.w*.24,length=s.recovery?4.2:Math.max(8.3,s.y+6);
  const trunk=w.mesh(new THREE.CylinderGeometry(.44,.58,length,14,10),'bark',g,x,-length/2-.25,-.71);trunk.rotation.z=.018;
  const a=new THREE.Vector3(x,-2.3,-.65),b=new THREE.Vector3(s.w*.76,-.49,-.65),d=b.clone().sub(a);
  const brace=w.cylinder(.22,d.length(),'bark',g);brace.position.copy(a).add(b).multiplyScalar(.5);brace.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  if(s.id==='tree-top'){
    const trunk=w.mesh(new THREE.CylinderGeometry(.75,.95,28,16,16),'barkLight',g,2.7,-7,-1.9);trunk.name='Breathing Tree trunk';
    for(let i=0;i<4;i++)forestBloom(w,g,2.25+(i%2)*.6,-2.8-i*3.1,-1.05,.6,(i%2)*.5);
  }
  if(s.w>4){forestMushroom(w,g,s.w-.58,.06,-.47,.64,.1);forestBloom(w,g,x-.3,-2.9,-.14,.55);}
}
export function forestLandmark(w,s,parent){
  const g=new THREE.Group();g.name='Landmark: '+s.landmark;parent.add(g);
  if(['sporepod','mushroom'].includes(s.landmark)){
    const hero=s.id==='tree-heart',width=hero?4.2:3.3,x=hero?s.w*.70:s.w*.58;
    g.position.set(x,0,-1.25);
    const model=forestMushroom(w,g,0,0,0,width,-.07);model.scale.z*=.68;
    forestBloom(w,g,-width*.25,-.015,.45,1.0,-.3);forestBloom(w,g,width*.25,-.03,.5,.85,.2);
    for(let i=0;i<4;i++)forestLeaf(w,g,-.28+i*.19,.25+i*.31,.54,.23,-.6+i*.25);
    g.userData.breathing=hero;return g;
  }
  if(s.landmark==='rootarch'){
    // An organic tree replaces the rectangular green-topped gate.
    forestModel(w,'canopy',g,s.w*.2,-.05,-2.5,5.5,.1);return g;
  }
  return g;
}
export const forestSeal=createSporeBall;

export function forestUnderstory(w,g){
  w.box(4.7,.48,2.8,'barkLight',g,0,-.28,0,.22);
  forestCover(w,{w:4.7},g,2.8);
  // Keep the moss cap centered on this decorative shelf.
  for(const child of g.children.slice(1))child.position.x-=2.35;
  w.box(4.1,1.1,2.1,'terrain',g,0,-.9,-.1,.3);
  forestMushroom(w,g,-.75,.02,-.15,1.7,-.2);forestMushroom(w,g,.87,.01,.18,1.0,.2);
  forestBloom(w,g,-1.65,-.08,.8,1.25,-.2);forestBloom(w,g,1.7,-.08,.9,.8,.2);
  for(const side of [-1,1]){
    const tuft=new THREE.Group();tuft.position.set(side*4.6,-1.65,2.2);g.add(tuft);
    for(let i=0;i<5;i++)forestLeaf(w,tuft,(i-2)*.34,Math.sin(i)*.15,0,.85+(i%2)*.2,side*(.35+i*.17));
  }
}
export function animateForest(w,game){
  if(w.biome!=='forest')return;
  const t=game.time;w.forestTime=t;
  for(const view of w.platforms.values()){
    if(view.root.visible)animateSporeBall(view.root,t,w.reducedMotion);
    for(const g of view.root.children)if(g.userData.breathing){
      const amount=w.reducedMotion?0:Math.sin(t*1.3)*.012;g.scale.set(1+amount,1-amount*.5,1+amount);
    }
  }
}
