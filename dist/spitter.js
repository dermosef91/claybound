import * as THREE from './lib/three.module.js';
import {SPITTER} from './spitter-rules.js';
import {applyFlatten} from './clay-feel.js';
import {disposeBranch} from './streaming.js';
import {spitterModel} from './spitter-asset.js';
import {puppetStep,heldSample,boilPuppet,placePuppet} from './stop-motion.js';

const pitchAxis=new THREE.Vector3(1,0,0),swayAxis=new THREE.Vector3(0,0,1),rotation=new THREE.Quaternion();
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function createSpitterView(w,e){
  const root=new THREE.Group();root.name='Echo Spitter '+e.id;w.levelRoot.add(root);
  const body=new THREE.Group();root.add(body);
  const character=spitterModel(w,'character',body),model=character.children[0];
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});});
  const clip=THREE.AnimationClip.parse(w.spitterMotion.clip);
  const tracks=clip.tracks.map(track=>{const [name,property]=track.name.split('.');return {bone:model.getObjectByName(name),property,sample:track.createInterpolant()};});
  const view={kind:'spitter',loaded:true,root,body,character,model,clip,tracks,bones,walkPhase:0,
    head:model.getObjectByName('head'),tail:model.getObjectByName('tail1'),
    ground:w.spitterMotion.ground,baseY:model.position.y,walkWeight:0,lastX:e.x,time:0,
    deathTime:0,reducedMotion:!!w.reducedMotion,clock:w.puppetClock};
  animateSpitter(view,e,0,'playing');return view;
}
export function animateSpitter(v,e,dt,status){
  const step=status==='playing'?puppetStep(v.clock,dt,true):0;
  const at=e.alive?placePuppet(v.clock,v,e.x,e.y,true):{x:e.x,y:e.y};v.root.position.set(at.x,at.y,.12);
  if(!e.alive){v.deathTime+=step;applyFlatten(v.root,v.deathTime,{reducedMotion:v.reducedMotion});return;}
  // Under stop motion the pose reads the creature as it was at the last
  // exposure; where it stands, and whether it lives, are read live above.
  const s=heldSample(v.clock,v,step,()=>({...e}),true);
  v.deathTime=0;v.root.visible=true;v.root.scale.setScalar(1);v.body.rotation.y=s.dir*SPITTER.turn;
  const travel=Math.abs(e.x-v.lastX),speed=step>0&&travel<.4?travel/step:0;
  if(step){v.lastX=e.x;v.time+=step;v.walkWeight+=((speed>.03&&['watch','patrol'].includes(s.aiState)?1:0)-v.walkWeight)*(1-Math.exp(-step*12));v.walkWeight=Math.min(1,v.walkWeight);}
  for(const rest of v.bones){rest.bone.position.copy(rest.position);rest.bone.quaternion.copy(rest.quaternion);rest.bone.scale.copy(rest.scale);}
  const weight=v.reducedMotion?0:v.walkWeight;
  if(step&&speed>.03)v.walkPhase=(v.walkPhase+step*Math.min(1.5,speed/.16))%v.clip.duration;
  // Sample against the rest pose directly. This also keeps a paused walk exact;
  // resetting bones underneath AnimationMixer's cached bindings would snap it.
  if(weight>0)for(const track of v.tracks){
    const values=track.sample.evaluate(v.walkPhase),target=track.bone[track.property];
    if(track.property==='quaternion')target.slerp(rotation.fromArray(values),weight);
    else {target.x+=(values[0]-target.x)*weight;target.y+=(values[1]-target.y)*weight;target.z+=(values[2]-target.z)*weight;}
  }
  const phase=v.walkPhase/v.clip.duration*(v.ground.length-1),i=Math.min(v.ground.length-2,Math.floor(phase));
  const correction=THREE.MathUtils.lerp(v.ground[i],v.ground[i+1],phase-i);
  v.model.position.y=v.baseY+(v.reducedMotion?0:correction*v.walkWeight);
  const charge=s.aiState==='charge'?smooth(s.stateTime/SPITTER.charge):0;
  // Continuous wind-up -> short impulse -> eased settle, on the same skeleton.
  // Feet and body pivot stay fixed; no whole-mesh wobble or pose swapping.
  let pose=charge;
  if(s.aiState==='recover'){
    const t=s.stateTime;
    pose=t<.07?1-1.7*smooth(t/.07):t<.36?-.7*(1-smooth((t-.07)/.29)):0;
  }
  if(v.head){
    const breath=v.reducedMotion||!['watch','patrol'].includes(s.aiState)?0:Math.sin(v.time*1.7+e.id*.61)*.009*(1-charge);
    v.head.quaternion.multiply(rotation.setFromAxisAngle(pitchAxis,-pose*.1+breath));
    v.head.scale.multiplyScalar(1+Math.max(0,pose)*.045);
  }
  if(v.tail&&!v.reducedMotion)v.tail.quaternion.multiply(rotation.setFromAxisAngle(swayAxis,Math.sin(v.time*1.3+e.id)*.025*(1-charge)));
  boilPuppet(v.root,v.clock,true);
}
export function syncShots(w,game){
  w.shotViews??=new Map();const ids=new Set();
  for(const q of game.shots||[]){
    ids.add(q.id);let v=w.shotViews.get(q.id);
    if(!v){
      const root=new THREE.Group();root.name='Echo crystal projectile';w.fxRoot.add(root);
      const crystal=spitterModel(w,'crystal',root);v={root,crystal};w.shotViews.set(q.id,v);
    }
    v.root.position.set(q.x,q.y,q.z??.5);v.root.rotation.z=Math.atan2(q.vy,q.vx);
    v.crystal.rotation.x=w.reducedMotion?0:q.age*6;
  }
  for(const [id,v]of w.shotViews)if(!ids.has(id)){disposeBranch(w,v.root);w.shotViews.delete(id);}
}
