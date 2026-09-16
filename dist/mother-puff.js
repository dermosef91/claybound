import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {cameraTarget} from './camera.js';
import {MOTHER_PUFF,motherNextCast} from './mother-puff-rules.js';
import {createSpringPad,animateSpringPad} from './spring-pad.js';
import {createMotherEnvironment,animateMotherEnvironment} from './mother-puff-environment.js';
export {createMotherArenaFloor} from './mother-puff-environment.js';
import {createMotherClouds,animateMotherClouds} from './mother-puff-cinematics.js';
import {afflictBranch,createGrowths,animateGrowths,createFriendlySpores,animateFriendly} from './mother-puff-growth.js';

export async function loadMotherPuff(w,onProgress){
  if(w.motherAssets?.idle&&w.motherAssets?.cast&&w.motherAssets?.friendly){onProgress?.(1);return;}
  w.motherLoading??=Promise.all(['idle','cast','friendly'].map(pose=>loadModel(`mother-puff-${pose}.glb`).then(g=>prepareMotherPuff(w,pose,g)))).catch(e=>{w.motherLoading=null;throw e;});
  await w.motherLoading;onProgress?.(1);
}
export function prepareMotherPuff(w,pose,gltf){
  const scene=gltf.scene;scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene,true),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Mother Puff has no usable geometry.');
  clayMaterials(scene);clayModel(w,scene);retainModel(w,scene);
  w.motherAssets??={};w.motherAssets[pose]={scene,scale:(pose==='friendly'?MOTHER_PUFF.friendlyHeight:MOTHER_PUFF.height)/size.y,bottom:box.min.y,center:box.getCenter(new THREE.Vector3())};
}
const COLORS={orange:0xf17836,purple:0x9c66b8,white:0xffedd4,green:0xa0c56f};
function materials(w){
  w.motherMaterials??=Object.fromEntries(Object.entries(COLORS).map(([key,color])=>{
    const m=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0});
    w.assetMaterials??=new Set();w.assetMaterials.add(m);return [key,m];
  }));return w.motherMaterials;
}
export function createMotherPuff(w,b){
  const root=new THREE.Group();root.name='Mother Puff arena';w.levelRoot.add(root);
  const pose=new THREE.Group();pose.position.set(b.x,b.y,-1.1);root.add(pose);
  const models={};
  for(const name of ['idle','cast']){
    const a=w.motherAssets?.[name];if(!a)continue;
    const m=a.scene.clone(true);m.name='Mother Puff '+name;m.scale.setScalar(a.scale);
    m.position.set(-a.center.x*a.scale,-a.bottom*a.scale,-a.center.z*a.scale);pose.add(m);models[name]=m;
  }
  const bodyGrey=afflictBranch(pose,.38),growth=createGrowths(w,pose,models.idle);
  pose.rotation.y=-Math.PI/4;
  const healed=new THREE.Group();healed.name='Friendly final form';healed.position.set(b.x,b.y,-1.1);root.add(healed);
  const a=w.motherAssets?.friendly;
  if(a){const model=a.scene.clone(true);model.scale.setScalar(a.scale);model.position.set(-a.center.x*a.scale,-a.bottom*a.scale,-a.center.z*a.scale);healed.add(model);}
  const environment=createMotherEnvironment(w,root,b),friendly=createFriendlySpores(w,root,b),clouds=createMotherClouds(w,root);
  return {root,pose,healed,models,growth,bodyGrey,environment,friendly,clouds,effects:new Map()};
}
function effectView(w,v,s,flying){
  const root=new THREE.Group();root.name=`${s.color} ${flying?'spore cloud':'ground puff'}`;v.root.add(root);
  const mat=materials(w)[s.color],parts=[];let springPad;
  if(!flying&&s.color==='orange'){
    const width=(s.radius??1.55)*2,anchor=new THREE.Group();anchor.position.set(-width/2,MOTHER_PUFF.padHeight,0);root.add(anchor);
    springPad=createSpringPad(w,{id:'mother-pad-'+s.id,x:s.x-width/2,y:s.y+MOTHER_PUFF.padHeight,w:width},anchor);
  }else{
    const count=w.reducedMotion?5:s.color==='white'?15:9;
    for(let i=0;i<count;i++){
      const a=i*2.399+s.id*.73,r=.25+((i+s.id)%4)*.105;
      const m=w.ball(r,r*.86,r,mat,root);m.castShadow=false;
      parts.push({m,a,r});
    }
  }
  let marker;
  if(flying){
    marker=new THREE.Group();marker.name=s.color+' landing warning';v.root.add(marker);
    const ring=w.mesh(new THREE.TorusGeometry(s.color==='orange'?1.5:2.15,.07,6,32),mat,marker);ring.rotation.x=Math.PI/2;
    // Distinct physical symbols keep the telegraphs readable without color.
    if(s.color==='purple')for(const angle of [-.65,.65]){const m=w.box(1.3,.06,.13,mat,marker,0,.02,0,.02);m.rotation.y=angle;}
    if(s.color==='orange')w.ball(.35,.08,.35,'cream',marker,0,.04,0);
    if(s.color==='green')for(const x of [-.3,.3])w.ball(.15,.13,.15,mat,marker,x,.08,0);
  }
  return {root,parts,marker,springPad};
}
function removeEffect(v){
  // Geometry/materials created through World are shared or retained. Only
  // the telegraph's own torus is unique and needs explicit disposal.
  v.marker?.traverse(o=>{if(o.geometry?.type==='TorusGeometry')o.geometry.dispose();});
  v.marker?.removeFromParent();v.root.removeFromParent();
}
// The two supplied battle sculptures act as stop-motion frames rather than a
// blend: she snaps into the casting pose to wind up, throws, then cuts back to
// the resting pose. Both windows sit inside the 1.4s gap between casts.
const CAST_LEAD=.2,CAST_HOLD=.4;
export function animateMotherPuff(w,game){
  const v=w.motherView,b=game.level.boss;if(!v||!b)return;
  const t=game.time,quiet=w.reducedMotion,hurt=b.state==='hurt',ending=b.hits===3;
  const asleep=b.state==='sleeping';
  const breath=quiet||ending||!asleep?0:Math.sin(t*1.2)*.012;
  const shotAge=t-(b.lastShotTime??-100),pulse=!quiet&&!ending&&!hurt&&!asleep&&shotAge>=0&&shotAge<.38?Math.sin(shotAge/.38*Math.PI):0;
  v.pose.visible=!['transform','reveal-form','regard','farewell','bloom','defeated'].includes(b.state);
  v.healed.visible=['transform','reveal-form','regard'].includes(b.state)||b.state==='farewell'&&b.stateTime<.9;
  v.pose.scale.set(1+breath+pulse*.06,1-breath*.35-pulse*.045,1+breath+pulse*.04);v.pose.position.y=b.y;
  v.pose.rotation.set(pulse*.035,-Math.PI/4,hurt&&!quiet?Math.sin(b.stateTime*23)*.035*Math.exp(-b.stateTime*2):0);
  if(!quiet&&!ending&&!asleep&&b.hits)v.pose.rotation.z+=Math.sin(t*8)*.009*b.hits;
  // The alert model appears only while a cast is being thrown; every other
  // moment — the clearing, the walk-in, recoils and the collapse — rests on the
  // idle model. Reduced motion holds the alert pose instead of cutting between
  // frames, matching how it already suppresses the firing pulse.
  const fighting=v.pose.visible&&!asleep&&!ending;
  const casting=fighting&&(!hurt&&shotAge>=0&&shotAge<CAST_HOLD||motherNextCast(b)<=CAST_LEAD);
  const alert=quiet?fighting:casting;
  if(v.models.idle)v.models.idle.visible=!alert;
  if(v.models.cast)v.models.cast.visible=alert;
  v.healed.scale.setScalar(1);v.healed.position.y=b.y;v.healed.rotation.y=-Math.PI/4;
  v.bodyGrey.value=[.38,.25,.12,0][b.hits];
  animateGrowths(v.growth,b,quiet);animateMotherEnvironment(w,v.environment,b,quiet);
  animateFriendly(v.friendly,b,quiet);animateMotherClouds(v.clouds,b,quiet);
  const wanted=new Set();
  for(const [list,flying]of [[b.spores,true],[b.patches,false]])for(const s of list){
    const key=(flying?'air:':'ground:')+s.id;wanted.add(key);
    let e=v.effects.get(key);if(!e){e=effectView(w,v,s,flying);v.effects.set(key,e);}
    e.root.position.set(s.x,s.y,flying?.3:.25);
    if(e.marker){e.marker.position.set(s.targetX,s.targetY+.07,.3);e.marker.scale.setScalar(quiet?1:.93+Math.sin(t*8)*.07);}
    const progress=flying?s.age/s.duration:s.age/s.life;
    const fade=flying?1:Math.min(1,s.age/.18,(s.life-s.age)/.5);
    e.root.scale.setScalar(Math.max(.001,fade));
    if(e.springPad){e.bounce=quiet?0:Math.max(0,1-s.bounceAge*2.5);animateSpringPad(e,0);}
    for(const [i,part]of e.parts.entries()){
      const spread=flying?.55+progress*.7:s.color==='white'?2.1:s.color==='purple'?.7+progress*2:1;
      const a=part.a+(quiet?0:t*.3),r=part.r*(flying?1.4:s.color==='white'?2:1.2);
      part.m.position.set(Math.cos(a)*spread*(.4+(i%3)*.25),flying?Math.sin(part.a*2)*.6:.45+(i%4)*.55,Math.sin(a)*spread*.65);
      part.m.scale.set(r,r*.86,r);
    }
  }
  for(const [key,e]of v.effects)if(!wanted.has(key)){removeEffect(e);v.effects.delete(key);}
}

const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function motherViewHeight(b,width,height,landscape,normalHeight=landscape?14:25){
  if(!b||['sleeping','defeated'].includes(b.state))return normalHeight;
  const recovery=['regard','farewell','bloom'].includes(b.state);
  const arena=landscape?(recovery?14.2:18.8):Math.max(25,(recovery?15.5:27)*height/Math.max(1,width));
  const q=b.state==='reveal'?smooth(b.stateTime/MOTHER_PUFF.reveal):1;
  return normalHeight+(arena-normalHeight)*q;
}

export function motherCamera(b,p,viewW,viewH,landscape){
  if(!b||['sleeping','defeated'].includes(b.state)||p.x<b.triggerX-1||p.x>b.right+7)return null;
  const recovery=['regard','farewell','bloom'].includes(b.state);
  const frame=landscape?(b.left+b.right)/2+.5:b.x-9.5;
  const q=b.state==='reveal'?smooth(b.stateTime/MOTHER_PUFF.reveal):1;
  const normal=cameraTarget(p,viewW,viewH,landscape);
  const x=recovery?b.x-3:normal.x*(1-q)+frame*q;
  const y=b.y+(recovery?3.2:landscape?5.7:6.5)+Math.max(0,p.y-b.y-7)*.2;
  return {x,y:normal.y*(1-q)+y*q};
}
