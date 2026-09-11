import * as THREE from './lib/three.module.js';

export function checkpointFlag(w,flag,root,id){
  flag.userData.checkpoint={id,initialized:false,raised:false,age:0,celebrating:false,sparked:false};
  flag.position.y=.96;flag.scale.set(.72,.85,1);
  w.rope([.08,.32,-.08],[.08,2.57,-.08],root,.018,false);
  const knot=w.ball(.055,.075,.055,'cream',flag,0,-.12,.04);knot.name='Flag halyard knot';
  root.userData.checkpointId=id;
}

export function raiseCheckpoint(w,event){
  for(const flag of w.flags){
    const state=flag.userData.checkpoint;
    if(!state||state.id!==event.platformId||state.raised)continue;
    state.initialized=true;state.raised=true;state.age=0;state.celebrating=true;state.sparked=false;
  }
}

export function animateCheckpoints(w,game,dt){
  const step=game.status==='playing'?dt:0;
  for(const [i,flag]of w.flags.entries()){
    const state=flag.userData.checkpoint;
    if(!state){flag.rotation.y=w.reducedMotion?0:Math.sin(w.time*2.3+i)*.1;continue;}
    if(!state.initialized){
      state.initialized=true;state.raised=game.activatedCheckpoints?.has(state.id)||game.checkpointId===state.id;
      state.age=state.raised?2:0;
    }
    if(state.celebrating){
      state.age+=step;
      if(state.age>=.72&&!state.sparked){
        state.sparked=true;flag.updateWorldMatrix(true,false);const p=flag.getWorldPosition(new THREE.Vector3());
        w.burst(p.x+.35,p.y-.1,'gold',w.reducedMotion?3:12,.65);
        w.burst(p.x+.4,p.y-.1,'orange',w.reducedMotion?2:6,.5);
      }
      if(state.age>=1.6)state.celebrating=false;
    }
    const t=state.raised?Math.min(1,state.age/(w.reducedMotion?.24:.85)):0;
    const eased=1-Math.pow(1-t,3),bounce=w.reducedMotion||!state.celebrating?0:Math.sin(Math.max(0,state.age-.55)*13)*Math.exp(-Math.max(0,state.age-.55)*5)*.085;
    flag.position.y=.96+1.56*eased+bounce;
    flag.scale.set(.72+.28*eased,.85+.15*eased,1);
    if(step>0||!state.celebrating)flag.rotation.y=w.reducedMotion?0:Math.sin(w.time*(state.celebrating?10:2.3)+i)*(state.celebrating?.22:.1);
  }
}
