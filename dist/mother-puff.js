import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {MOTHER_PUFF,motherCinematic} from './mother-puff-rules.js';
import {forestModel} from './forest.js';
import {forestBloom} from './forest-details.js';
import {afflictBranch,createGrowths,animateGrowths,createAfflictedClearing,animateClearing,createFriendlySpores,animateFriendly,growthMaterials} from './mother-puff-growth.js';

export async function loadMotherPuff(w,onProgress){
  if(w.motherAssets?.idle&&w.motherAssets?.cast){onProgress?.(1);return;}
  w.motherLoading??=Promise.all(['idle','cast'].map(pose=>loadModel(`mother-puff-${pose}.glb`).then(g=>prepareMotherPuff(w,pose,g)))).catch(e=>{w.motherLoading=null;throw e;});
  await w.motherLoading;onProgress?.(1);
}
export function prepareMotherPuff(w,pose,gltf){
  const scene=gltf.scene;scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene,true),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Mother Puff has no usable geometry.');
  clayMaterials(scene);clayModel(w,scene);retainModel(w,scene);
  w.motherAssets??={};w.motherAssets[pose]={scene,scale:MOTHER_PUFF.height/size.y,bottom:box.min.y,center:box.getCenter(new THREE.Vector3())};
}
const COLORS={orange:0xf19649,purple:0x9c66b8,white:0xffedd4,green:0xa0c56f};
function materials(w){
  w.motherMaterials??=Object.fromEntries(Object.entries(COLORS).map(([key,color])=>{
    const m=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0});
    w.assetMaterials??=new Set();w.assetMaterials.add(m);return [key,m];
  }));return w.motherMaterials;
}
export function createMotherArenaFloor(w,s,g){
  w.box(s.w,1.45,7,'terrain',g,s.w/2,-.8,-1.8,.36);
  w.box(s.w,.35,7.1,'top',g,s.w/2,-.15,-1.8,.15);
  for(let i=0;i<15;i++){
    const x=.8+i*(s.w-1.6)/14;
    w.ball(1.6,.6,.65,'terrain2',g,x,-1.3,.9);
    if(i%2===0)w.ball(.9,.18,.5,'top',g,x,.03,-3.6);
    if(w.forestAssets&&i%3===0)forestBloom(w,g,x,-.15,1.4,1.5,(i%2)*.3);
  }
  // Thin angular plates break the soft moss silhouette at the walking edge.
  // Their roots sit below the collision surface, leaving the route level.
  for(let i=0;i<22;i++){
    const plate=w.mesh(new THREE.IcosahedronGeometry(1,0),growthMaterials(w).crust,g,.7+i*(s.w-1.4)/21,-.2,.9);
    plate.scale.set(.9,.24,.65);plate.rotation.y=i*.73;
  }
  g.userData.motherGrey=afflictBranch(g,1);
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
  const bodyGrey=afflictBranch(pose,.27),growth=createGrowths(w,pose);
  const mats=materials(w),scenery=new THREE.Group();root.add(scenery);
  // A sheltered clearing above the old canopy route: tall supplied trees
  // frame the fight behind its collision plane, leaving the crown unobscured.
  if(w.forestAssets){
    for(const [dx,z,width,dy]of [[-21,-16,16,-5],[21,-17,17,-5],[-9,-28,19,-7],[10,-31,21,-8]])
      forestModel(w,'canopy',scenery,b.x+dx,b.y+dy,z,width,dx<0?.18:-.15,true);
    for(const dx of [-13,13]){
      forestModel(w,'heroMushroom',scenery,b.x+dx,b.y,-7,5.5,dx*.03,true);
      forestBloom(w,scenery,b.x+dx,b.y-.12,-3.6,3.2,dx*.02);
    }
  }
  // Small companions continue the family in the supplied sculpture.
  for(const [i,dx]of [-12,-9.3,-7.4,7.4,9.5,12.4].entries()){
    const x=b.x+dx,y=b.y,z=-2.7-i%2*.8,k=.7+(i%3)*.22;
    w.ball(.28*k,.48*k,.28*k,'cream',scenery,x,y+.4*k,z);
    w.ball(.67*k,.33*k,.52*k,mats.purple,scenery,x,y+.87*k,z);
    w.ball(.12*k,.04*k,.12*k,'cream',scenery,x-.2*k,y+1.17*k,z+.1);
  }
  const gates=[];
  for(const x of [b.left,b.right]){
    const g=new THREE.Group();g.position.set(x,b.y,0);g.name='Rigid root curtain';root.add(g);gates.push(g);
    for(let i=0;i<4;i++){
      const points=Array.from({length:9},(_,j)=>new THREE.Vector3(Math.sin(j*.64+i)*.28,j*1.6,-1.3+i*.72));
      w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.14+i*.018,6,false),growthMaterials(w).crust,g);
      for(let j=1;j<4;j++)w.ball(.37,.16,.2,growthMaterials(w).crust,g,Math.sin(j+i)*.3,j*2.6,-1.3+i*.72);
    }
  }
  const sceneryGrey=afflictBranch(scenery,1),clearing=createAfflictedClearing(w,root,b),friendly=createFriendlySpores(w,root,b);
  return {root,pose,models,gates,growth,bodyGrey,sceneryGrey,clearing,friendly,effects:new Map()};
}
function effectView(w,v,s,flying){
  const root=new THREE.Group();root.name=`${s.color} ${flying?'spore cloud':'ground puff'}`;v.root.add(root);
  const mat=materials(w)[s.color],parts=[];
  if(!flying&&s.color==='orange'){
    w.ball(.4,.49,.42,'cream',root,0,.38,0);
    w.ball(1.55,.35,1.15,mat,root,0,.56,0);
    for(let i=0;i<5;i++){const a=i*2.4;w.ball(.19,.04,.16,'cream',root,Math.cos(a)*.86,.86,Math.sin(a)*.66);}
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
  return {root,parts,marker};
}
function removeEffect(v){
  // Geometry/materials created through World are shared or retained. Only
  // the telegraph's own torus is unique and needs explicit disposal.
  v.marker?.traverse(o=>{if(o.geometry?.type==='TorusGeometry')o.geometry.dispose();});
  v.marker?.removeFromParent();v.root.removeFromParent();
}
export function animateMotherPuff(w,game){
  const v=w.motherView,b=game.level.boss;if(!v||!b)return;
  const t=game.time,quiet=w.reducedMotion,inhale=b.state==='inhale',hurt=b.state==='hurt',ending=b.hits===3;
  const breath=quiet?0:inhale?Math.min(1,b.stateTime/MOTHER_PUFF.inhale)*.075:Math.sin(t*(b.hits?3.8:1.2))*(b.hits?.019:.012);
  v.pose.visible=!['bloom','defeated'].includes(b.state);
  v.pose.scale.set(1+breath,1-breath*.35,1+breath);v.pose.position.y=b.y;
  v.pose.rotation.set(0,0,hurt&&!quiet?Math.sin(b.stateTime*23)*.035*Math.exp(-b.stateTime*2):0);
  if(!quiet&&!ending&&b.hits)v.pose.rotation.z+=Math.sin(t*8)*.009*b.hits;
  if(ending){
    const q=Math.min(1,b.stateTime/(b.state==='collapse'?1.5:2.8)),ease=q*q*(3-2*q);
    let x=.36,y=.36;
    if(b.state==='collapse'){x=1-ease*.64;y=1-ease*.85;}
    else if(b.state==='quiet'){x=.36;y=.15;}
    else if(b.state==='revive'){x=.36;y=.15+ease*.21;}
    else if(b.state==='farewell'){
      const fade=1-Math.min(1,Math.max(0,(b.stateTime-.6)/1.1));x*=fade;y*=fade;
      if(!quiet)v.pose.position.y+=Math.sin(Math.min(1,b.stateTime/1.5)*Math.PI)*.3;
    }
    v.pose.scale.set(Math.max(.001,x),Math.max(.001,y),Math.max(.001,x));
    const turn=['regard','farewell','bloom','defeated'].includes(b.state)?1:b.state==='revive'?ease:0;
    v.pose.rotation.y=-.58*turn;
  }
  const casting=b.state==='release'||b.state==='inhale'&&b.stateTime>MOTHER_PUFF.inhale*.82;
  if(v.models.idle)v.models.idle.visible=!casting;if(v.models.cast)v.models.cast.visible=casting;
  v.bodyGrey.value=.27*(1-b.hits/3);
  animateGrowths(v.growth,b,quiet);animateClearing(v.clearing,b);animateFriendly(v.friendly,b,quiet);
  v.sceneryGrey.value=1-b.healing*.72;
  for(const platform of w.platforms?.values()||[])if(platform.root.userData.motherGrey)platform.root.userData.motherGrey.value=1-b.healing*.8;
  const sealed=!['sleeping','defeated'].includes(b.state);
  for(const g of v.gates){g.visible=sealed;g.scale.y=b.state==='reveal'?Math.min(1,b.stateTime/1.4):b.state==='bloom'?Math.max(.001,1-b.healing):1;}
  const wanted=new Set();
  for(const [list,flying]of [[b.spores,true],[b.patches,false]])for(const s of list){
    const key=(flying?'air:':'ground:')+s.id;wanted.add(key);
    let e=v.effects.get(key);if(!e){e=effectView(w,v,s,flying);v.effects.set(key,e);}
    e.root.position.set(s.x,s.y,flying?.3:.25);
    if(e.marker){e.marker.position.set(s.targetX,s.targetY+.07,.3);e.marker.scale.setScalar(quiet?1:.93+Math.sin(t*8)*.07);}
    const progress=flying?s.age/s.duration:s.age/s.life;
    const fade=flying?1:Math.min(1,s.age/.18,(s.life-s.age)/.5);
    e.root.scale.setScalar(Math.max(.001,fade));
    if(!flying&&s.color==='orange'){
      const squash=quiet?0:Math.sin(s.bounceAge*19)*Math.exp(-s.bounceAge*7)*.25;
      e.root.scale.set(fade*(1+squash*.3),fade*(1-squash),fade);
    }
    for(const [i,part]of e.parts.entries()){
      const spread=flying?.55+progress*.7:s.color==='white'?2.1:s.color==='purple'?.7+progress*2:1;
      const a=part.a+(quiet?0:t*.3),r=part.r*(flying?1.4:s.color==='white'?2:1.2);
      part.m.position.set(Math.cos(a)*spread*(.4+(i%3)*.25),flying?Math.sin(part.a*2)*.6:.45+(i%4)*.55,Math.sin(a)*spread*.65);
      part.m.scale.set(r,r*.86,r);
    }
  }
  for(const [key,e]of v.effects)if(!wanted.has(key)){removeEffect(e);v.effects.delete(key);}
}

export function motherViewHeight(b,width,height,landscape){
  const recovery=b.hits===3&&b.state!=='defeated';
  return landscape?(recovery?14.2:18.8):Math.max(25,(recovery?15.5:21.5)*height/Math.max(1,width));
}

export function motherCamera(b,p,viewW,viewH,landscape){
  if(!b||p.x<b.triggerX-9||p.x>b.right+7)return null;
  const frame=b.state==='reveal'&&!landscape?b.x-6.8:landscape?Math.max(b.x-5,Math.min(b.x+3,p.x+3)):p.x+Math.max(-5,Math.min(5,(b.x-p.x)*.6));
  // Let the path lead before the camera opens onto her; no title card interrupts it.
  const q=b.state==='sleeping'?Math.max(0,Math.min(1,(p.x-b.triggerX+9)/12)):b.state==='reveal'?.75+Math.min(1,b.stateTime/MOTHER_PUFF.reveal)*.25:1;
  const x=b.hits===3&&motherCinematic(b)?b.x-2.8:(p.x+viewW*.1)*(1-q)+frame*q;
  return {x,y:b.y+(b.hits===3?3.2:landscape?5.7:6.5)+Math.max(0,p.y-b.y-7)*.2};
}
