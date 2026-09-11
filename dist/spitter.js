import * as THREE from './lib/three.module.js';
import {SPITTER} from './spitter-rules.js';
import {disposeBranch} from './streaming.js';

export function createSpitterView(w,e){
  const root=new THREE.Group();root.name='Echo Spitter '+e.id;w.levelRoot.add(root);
  const body=new THREE.Group();root.add(body);
  w.ball(.61,.39,.44,'orange',body,0,.43,0);
  w.ball(.52,.48,.4,'terrain2',body,0,.68,-.1);
  const shell=w.mesh(new THREE.TorusGeometry(.25,.095,10,28,Math.PI*1.8),'accent',body,0,.78,.26);shell.rotation.z=.4;
  for(const [x,y,r,h]of [[-.25,1,.12,.35],[.04,1.1,.14,.38],[.29,.96,.1,.3]]){
    const crystal=w.mesh(new THREE.ConeGeometry(r,h,5),'accent',body,x,y,0);crystal.rotation.z=-x;
  }
  for(const x of [-.37,.37])w.ball(.2,.13,.26,'barkLight',body,x,.13,.13);
  const face=new THREE.Group();body.add(face);face.position.set(0,.55,.38);
  const cheeks=[-.29,.29].map(x=>w.ball(.19,.22,.17,'orangeLight',face,x,0,0));
  for(const x of [-.19,.19]){w.ball(.17,.23,.11,'cream',face,x,.14,.12);w.ball(.066,.12,.055,'dark',face,x,.14,.22);}
  const mouth=w.mesh(new THREE.TorusGeometry(.16,.07,10,24),'orangeLight',face,0,-.1,.25);
  const hole=w.ball(.13,.13,.025,'dark',face,0,-.1,.26);
  const charge=w.ball(.11,.11,.06,'gold',face,0,-.1,.31);
  const view={kind:'spitter',loaded:true,root,body,face,cheeks,mouth,hole,charge,deathTime:0,reducedMotion:!!w.reducedMotion};
  animateSpitter(view,e,0,'playing');return view;
}
export function animateSpitter(v,e,dt,status){
  const step=status==='playing'?Math.min(dt,.05):0;
  v.root.position.set(e.x,e.y,.12);
  if(!e.alive){v.deathTime+=step;v.root.scale.setScalar(Math.max(0,1-v.deathTime/.24));v.root.visible=v.deathTime<.24;return;}
  v.root.visible=true;v.root.scale.setScalar(1);v.body.rotation.y=e.dir*.72;
  const swell=e.aiState==='charge'?Math.min(1,e.stateTime/SPITTER.charge):0;
  const recoil=e.aiState==='recover'?Math.max(0,1-e.stateTime/.25):0;
  v.body.scale.set(1+swell*.1-recoil*.12,1-swell*.09+recoil*.16,1+swell*.08);
  v.body.rotation.z=!v.reducedMotion&&e.aiState==='charge'?Math.sin(e.stateTime*32)*swell*.018:0;
  v.face.rotation.x=e.aiState==='charge'?-Math.atan2(e.aimY-e.y-.77,Math.abs(e.aimX-e.x))*.55:0;
  for(const cheek of v.cheeks)cheek.scale.set(.19*(1+swell*.65),.22*(1+swell*.4),.17*(1+swell*.8));
  v.mouth.scale.setScalar(1+swell*.35+recoil*.6);v.charge.visible=swell>0;v.charge.scale.set(.11*swell,.11*swell,.06);
}
export function syncShots(w,game){
  w.shotViews??=new Map();const ids=new Set();
  for(const q of game.shots||[]){
    ids.add(q.id);let v=w.shotViews.get(q.id);
    if(!v){
      const root=new THREE.Group();root.name='Echo clay projectile';w.fxRoot.add(root);
      w.ball(.19,.19,.19,'gold',root);
      const tail=[1,2].map(i=>w.ball(.11/i,.11/i,.11/i,'cream',root,-i*.25,0,0));
      v={root,tail};w.shotViews.set(q.id,v);
    }
    v.root.position.set(q.x,q.y,.5);v.root.rotation.z=Math.atan2(q.vy,q.vx);
    v.root.children[0].rotation.z=q.age*6;
  }
  for(const [id,v]of w.shotViews)if(!ids.has(id)){disposeBranch(w,v.root);w.shotViews.delete(id);}
}
