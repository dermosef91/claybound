import * as THREE from './lib/three.module.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';
import {createHero,loadHero,animateHero,heroEvent} from './hero.js';
import {applyEnvironment,buildBackdrop,buildTerrain,animateEnvironment} from './environments.js';
import {makeCitadelLift} from './citadel.js';
import {makeMovingPlatform} from './moving-platform.js';
import {renderCitadelDepth} from './citadel-depth.js';
import {loadEnemies,createEnemyView,animateEnemy,releaseEnemyViews} from './enemies.js';
import {loadCastle} from './castle.js';
import {loadBats} from './bats.js';
import {loadSpores} from './spore-puff.js';
import {loadDrifters} from './drifter.js';
import {burstDrifterLeaves} from './drifter-leaves.js';
import {loadCottage,cottageModel} from './cottage.js';
import {loadClay,clayBox,clayMeshMaterial,sculptClay} from './clay.js';
import {loadClouds} from './clouds.js';
import {cameraFraming,cameraTarget} from './camera.js';
import {syncStream,disposeBranch} from './streaming.js';
import {landmark,balanceDeck,animateWind} from './setpieces.js';
import {createShapeHands,animateShapeHands,disposeShapeHands} from './shape-hand.js';
import {loadCanyonAssets} from './canyon-assets.js';
import {loadWindmills} from './windmill.js';
import {loadForestAssets} from './forest.js';
import {loadSpitterAssets} from './spitter-asset.js';
import {loadCavernAssets} from './cavern-asset.js';
import {createCaveLights} from './cave-lighting.js';
import {makeCanyonLift} from './canyon.js';
import {greatArchLedge} from './great-arch.js';
import {makeRopeBridge} from './rope-bridge.js';
import {bridgeOffset} from './bridge-surface.js';
import {animateCircuit} from './mechanism-views.js';
import {forestBranch,forestSeal,forestMushroom,animateForest} from './forest-details.js';
import {caveLedgeDetails} from './cavern.js';
import {animateDepthScenery} from './depth-scenery.js';
import {createSpringPad,animateSpringPad} from './spring-pad.js';
import {createCrumble,animateCrumble,clayFragments} from './crumble.js';
import {animatePressView} from './press-views.js';
import {checkpointFlag,raiseCheckpoint,animateCheckpoints} from './checkpoints.js';
import {createCavernMachine,animateCavernMachine} from './cavern-machine-views.js';
import {syncShots} from './spitter.js';
import {loadCityLaundry} from './city-laundry.js';
import {createClayView,updateClayView} from './shaping-views.js';
import {CLAY_PALETTE} from './palette.js';
import {createGoal} from './goal.js';
import {burstSporePod,updateSporeParticle,disposeSporeParticle} from './spore-effects.js';

const C={blue:0x315e96,blueLight:0x3d6da5,blueDark:0x244c7b,orange:CLAY_PALETTE.orange,orangeLight:CLAY_PALETTE.orangeLight,cream:0xf1d8a3,rope:0xdcb985,dark:0x172b3f,gold:0xf8ce75};
const fract=n=>n-Math.floor(n);
const rand=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const geometries=new Map();

function clayGeo(w,h,d,r=.15) {
  const key=[w,h,d,r].map(v=>v.toFixed(3)).join(':');
  if(geometries.has(key))return geometries.get(key);
  const g=new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3));
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    const s=Math.sin(x*4.8+y*3.1+z*2.6)*Math.sin(x*2.4-y*5.2+z*3.5)*.017;
    a.setXYZ(i,x+s,y+s*.8,z+s*1.3);
  }
  g.computeVertexNormals();geometries.set(key,g);return g;
}
const sphereG=new THREE.SphereGeometry(1,22,16);
for(let i=0;i<sphereG.attributes.position.count;i++){
  const a=sphereG.attributes.position,x=a.getX(i),y=a.getY(i),z=a.getZ(i);
  const r=1+.018*Math.sin(x*9+y*6)*Math.sin(y*7-z*5);a.setXYZ(i,x*r,y*r,z*r);
}
sphereG.computeVertexNormals();
const cylG=new THREE.CylinderGeometry(1,1,1,24);

export class World {
  constructor(canvas,{onProgress}={}) {
    this.canvas=canvas;this.time=0;this.cameraX=8.3;this.cameraY=3.4;this.particles=[];this.clouds=[];this.shake=0;this.cameraLook=0;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#87a9cc');
    this.scene.fog=new THREE.Fog('#9bb6ce',32,91);
    this.camera=new THREE.OrthographicCamera(-15,15,8.4,-8.4,.1,160);
    this.hemi=new THREE.HemisphereLight(0xd6e8ff,0x4c4c71,2.1);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffe4b5,3.25);this.sun.position.set(-8,18,12);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-22;this.sun.shadow.camera.right=22;
    this.sun.shadow.camera.top=18;this.sun.shadow.camera.bottom=-18;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=65;
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=3;
    this.scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight(0xb9d7fa,.5);this.fill.position.set(2,5,-8);this.scene.add(this.fill);
    this.torchLights=createCaveLights();this.scene.add(...this.torchLights);
    // A one-pixel loading placeholder avoids a separate legacy texture download.
    this.bump=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);this.bump.needsUpdate=true;
    this.mat={};
    for(const [name,color]of Object.entries(C))this.mat[name]=new THREE.MeshStandardMaterial({color,roughness:.98,metalness:0,bumpMap:this.bump,bumpScale:name==='dark'?.01:.085});
    this.mat.ghost=new THREE.MeshStandardMaterial({color:C.cream,transparent:true,opacity:.17,roughness:1,depthWrite:false});
    this.mat.gold.emissive=new THREE.Color(0x8c4a12);this.mat.gold.emissiveIntensity=.13;
    this.mat.shadow=new THREE.MeshBasicMaterial({color:0x203e62,transparent:true,opacity:.2,depthWrite:false});
    this.levelRoot=new THREE.Group();this.backRoot=new THREE.Group();this.fxRoot=new THREE.Group();
    this.scene.add(this.backRoot,this.levelRoot,this.fxRoot);
    this.character=createHero(this);this.scene.add(this.character.root);
    const progress=[0,0,0,0,0,0,0],report=(i,value)=>{if(value!==null){progress[i]=value;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}};
    this.ready=Promise.all([loadHero(this,value=>report(0,value)),loadEnemies(this,value=>report(1,value)),loadClay(this,value=>report(2,value)),loadClouds(this,value=>report(3,value)),loadCanyonAssets(this,value=>report(4,value)),loadCottage(this,value=>report(5,value)),loadWindmills(this,value=>report(6,value))]);
    this.resize();
    window.addEventListener('resize',()=>this.resize());
    window.visualViewport?.addEventListener('resize',()=>this.resize());
  }
  mesh(g,material,parent,x=0,y=0,z=0){
    const base=typeof material==='string'?this.mat[material]:material;
    if(this.clay&&base.isMeshStandardMaterial&&!base.transparent){
      const shared=g===sphereG||g===cylG;
      g=sculptClay(this,g,{amplitude:shared?.035:.06});
      if(shared)this.assetGeometry.add(g);
    }
    const m=new THREE.Mesh(g,this.clay?clayMeshMaterial(this,g,base):base);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  box(w,h,d,mat,parent,x=0,y=0,z=0,r=.14){return this.mesh(clayBox(this,w,h,d,r,Math.abs(Math.floor(x*1.7+y*2.9+z*3)))||clayGeo(w,h,d,r),mat,parent,x,y,z);}
  ball(rx,ry,rz,mat,parent,x=0,y=0,z=0){const m=this.mesh(sphereG,mat,parent,x,y,z);m.scale.set(rx,ry,rz);return m;}
  cylinder(r,h,mat,parent,x=0,y=0,z=0){const m=this.mesh(cylG,mat,parent,x,y,z);m.scale.set(r,h,r);return m;}
  rope(a,b,parent,r=.045,twist=true) {
    const vA=new THREE.Vector3(...a),vB=new THREE.Vector3(...b),dir=vB.clone().sub(vA),len=dir.length();
    const g=new THREE.Group();g.position.copy(vA);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(g);
    this.cylinder(r,len,'rope',g,0,len/2,0);
    if(twist){const points=[];for(let t=0;t<=len;t+=.065)points.push(new THREE.Vector3(Math.cos(t*24)*r*.77,t,Math.sin(t*24)*r*.77));
      if(points.length>1)this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.min(400,Math.ceil(len*18)),r*.37,5,false),'cream',g);}
    return g;
  }
  flag(x,y,parent,scale=1,checkpointId=null) {
    const g=new THREE.Group();g.name='Checkpoint flag';g.position.set(x,y,-.75);g.scale.setScalar(scale);parent.add(g);
    const pole=this.biome==='desert'?'bark':'orange';
    this.cylinder(.043,2.65,pole,g,0,1.3);this.ball(.1,.1,.1,pole,g,0,2.68,0);
    const s=new THREE.Shape();s.moveTo(.04,2.52);s.bezierCurveTo(.45,2.6,.7,2.3,1.1,2.43);s.lineTo(.84,2.02);s.lineTo(1.05,1.79);s.bezierCurveTo(.7,1.8,.48,1.95,.04,1.87);s.closePath();
    const geom=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,steps:1});
    geom.translate(0,-2.52,0);
    const flag=this.mesh(geom,'orange',g,0,2.52,0);this.flags.push(flag);
    if(checkpointId)checkpointFlag(this,flag,g,checkpointId);
    return g;
  }
  arch(w,h,d,parent,x,y,z,mat='blue') {
    const s=new THREE.Shape(),aw=Math.min(w*.33,2.7),top=-h*.38;
    s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,-h);s.lineTo(aw,-h);s.lineTo(aw,top-aw*.7);
    s.bezierCurveTo(aw,top+aw*.6,-aw,top+aw*.6,-aw,top-aw*.7);s.lineTo(-aw,-h);s.lineTo(-w/2,-h);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelThickness:.15,bevelSize:.14,bevelSegments:3,curveSegments:16});
    // In-plane coordinates keep the visible fingerprints at a consistent scale.
    const uv=geo.attributes.uv, pos=geo.attributes.position;
    for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*.22,pos.getY(i)*.22);
    return this.mesh(sculptClay(this,geo,{amplitude:.12,subdivide:true}),mat,parent,x,y,z-d/2);
  }
  doorway(parent,x,y,z,scale=1) {
    const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
    this.box(.95,1.36,.06,'dark',g,0,.68,0,.12);
    this.ball(.475,.54,.05,'dark',g,0,1.33,0);
    const arc=new THREE.TorusGeometry(.53,.12,8,28,Math.PI);const m=this.mesh(arc,'blueDark',g,0,1.31,.02);
    this.box(.22,1.36,.16,'blueDark',g,-.53,.65,.01);this.box(.22,1.36,.16,'blueDark',g,.53,.65,.01);
  }
  house(parent,x,y,size=1) {
    if(this.biome==='desert'||this.biome==='forest')return null;
    return cottageModel(this,parent,x,y,-1,3*size,.08);
  }
  pot(parent,x,y,scale=.3) {
    this.ball(scale,scale*.86,scale,'orange',parent,x,y+scale*.75,-.8);
    this.cylinder(scale*.56,scale*.23,'orangeLight',parent,x,y+scale*1.58,-.8);
  }
  mushroom(parent,x,y,size=1) {
    this.cylinder(.12*size,.65*size,'cream',parent,x,y+.3*size,-.9);
    this.ball(.46*size,.23*size,.4*size,'orange',parent,x,y+.67*size,-.9);
  }
  makeEnemy(e) {
    return createEnemyView(this,e);
  }
  async prepareLevel(L,onProgress){
    if(L.biome==='desert'||L.enemies.some(e=>e.kind==='drifter'))await loadDrifters(this,onProgress);
    if(L.biome==='forest'||L.enemies.some(e=>e.kind==='spore'))await loadSpores(this,onProgress);
    if(L.biome==='forest')await loadForestAssets(this,onProgress);
    if(L.biome==='cave')await loadCavernAssets(this,onProgress);
    if(L.biome==='cave'||L.enemies.some(e=>e.kind==='spitter'))await loadSpitterAssets(this,onProgress);
    if(L.biome==='citadel'){await loadCastle(this,onProgress);await loadCityLaundry(this,onProgress);}
    if(L.biome==='cave'||L.enemies.some(e=>e.kind==='bat'))await loadBats(this,onProgress);
  }
  makeBell(parent,x,y) {
    return createGoal(this,parent,x,y);
  }
  makePlatform(s) {
    const g=new THREE.Group();g.position.set(s.x,s.y,0);this.levelRoot.add(g);
    if(s.shape)return createClayView(this,s,g);
    if(s.kind==='bridge'){
      const view=makeRopeBridge(this,s,g);
      if(s.checkpoint)this.flag(s.checkpoint-s.x,.08+bridgeOffset(s,s.checkpoint-s.x),g,.83,s.id);
      if(s.goal){const x=s.bellX??s.w-3;this.makeBell(g,x,.1+bridgeOffset(s,x));}
      return view;
    }
    if(['gate','ferry','orbit'].includes(s.kind))return createCavernMachine(this,s,g);
    if(this.biome==='citadel'&&(s.kind==='lift'||s.kind==='counter'))return makeCitadelLift(this,s,g);
    if(this.biome==='desert'&&s.kind==='lift')return makeCanyonLift(this,s,g);
    if(s.kind==='balance')return balanceDeck(this,s,g);
    let ropes=[],springPad,fracture;
    if(s.kind==='wall'){
      const height=s.h??4;
      this.box(s.w,height,2,'terrain',g,s.w/2,-height/2,0,Math.min(.14,s.w/8,height/8));
    } else if(s.kind==='stone'){
      buildTerrain(this,s,g);
      landmark(this,s,g);
    } else if(s.kind==='lift'){
      ropes=makeMovingPlatform(this,s,g).ropes;
    } else if(s.kind==='spring'&&this.biome==='forest'){
      springPad=createSpringPad(this,s,g);
    } else if(s.kind==='spring'){
      this.box(s.w,.13,1.56,'orange',g,s.w/2,-.76,0,.06);
      for(let n=0;n<3;n++){
        const ring=this.mesh(new THREE.TorusGeometry(.36-n*.025,.078,8,24),'cream',g,s.w/2,-.51+n*.15,0);ring.rotation.x=Math.PI/2;ring.scale.set(1.45,1,1);
      }
      this.ball(s.w*.49,.16,.73,'cream',g,s.w/2,-.15,0);
      this.ball(.13,.026,.13,'orange',g,s.w/2,.004,0);
    } else if(s.kind==='crumble'){
      fracture=createCrumble(this,s,g);
    } else if(s.kind==='switch'){
      this.box(s.w,.2,1.32,'terrain2',g,s.w/2,-.27,0,.08);
      const button=this.cylinder(.49,.17,'cream',g,s.w/2,-.07,0);button.scale.z=.35;
      this.box(.25,.04,.1,'orange',g,s.w/2,.035,0,.025);
    } else if(s.kind==='ledge'&&this.biome==='forest'){
      forestBranch(this,s,g);
    } else if(s.kind==='break'&&this.biome==='forest'){
      forestSeal(this,s,g);
    } else {
      const mat=s.kind==='break'?'cream':(s.kind==='timed'?'top':this.biome==='forest'?'barkLight':'top');
      this.box(s.w,.32,1.8,mat,g,s.w/2,-.16,0,.12);
      this.box(s.w-.15,.24,1.62,'terrain',g,s.w/2,-.43,0,.09);
      if(s.kind==='break'){
        for(let k=0;k<4;k++){
          const line=this.box(.025,.16,.84,s.kind==='break'?'orange':'orangeLight',g,.4+k*(s.w-.8)/3,-.06,.15,.01);line.rotation.y=(k%2?.4:-.5);
        }
      }
      if(s.kind==='timed'||s.kind==='pulse')for(let n=0;n<3;n++)this.ball(.065,.07,.05,s.kind==='pulse'?'gold':'cream',g,s.w/2+(n-1)*.25,-.16,.94);
      if(s.kind==='timed'&&this.biome==='cave')this.box(s.w-.18,.065,.11,'accent',g,s.w/2,-.085,.93,.025);
      if(s.kind==='pulse'){const ring=this.mesh(new THREE.TorusGeometry(.27,.065,8,20),'accent',g,s.w/2,-.12,.95);ring.scale.x=1.3;ring.userData.phaseSignal=true;}
    }
    if(this.biome==='cave'&&s.kind==='ledge')caveLedgeDetails(this,s,g);
    if(s.kind!=='stone'){
      landmark(this,s,g);
      if(s.checkpoint){const flag=this.flag(s.checkpoint-s.x,.08,g,.83,s.id);if(this.biome==='forest'&&s.id==='tree-heart')flag.position.z=.72;}
      if(s.goal)this.makeBell(g,s.bellX??s.w-3,.1);
    }
    if(s.kind==='ledge')greatArchLedge(this,s,g);
    return {root:g,ropes,bounce:0,springPad,fracture};
  }
  buildBackground(L) { buildBackdrop(this,L); }
  build(L,index,focusX=L.spawn.x) {
    this.currentLevel=L;
    releaseEnemyViews(this);
    if(!this.depthRoot){this.depthRoot=new THREE.Group();this.depthRoot.name='Sharp side scenery';this.scene.add(this.depthRoot);}
    this.depthViews=new Map();
    this.levelIndex=index;this.flags=[];this.clouds=[];this.particles=[];this.bell=null;this.streamViews=new Map();this.windViews=new Map();this.circuitViews=new Map();
    this.baseGeometry=new Set([...geometries.values(),sphereG,cylG]);
    const sharedGeometry=new Set([...this.baseGeometry,...(this.assetGeometry||[])]);
    const sharedMaterial=new Set([...Object.values(this.mat),...(this.assetMaterials||[])]);
    const oldGeometry=new Set(),oldMaterial=new Set();
    for(const root of [this.levelRoot,this.backRoot,this.fxRoot,this.depthRoot])root.traverse(o=>{
      if(o.geometry&&!sharedGeometry.has(o.geometry))oldGeometry.add(o.geometry);
      if(o.material&&!sharedMaterial.has(o.material))oldMaterial.add(o.material);
    });
    oldGeometry.forEach(g=>g.dispose());oldMaterial.forEach(m=>m.dispose());
    this.levelRoot.clear();this.backRoot.clear();this.fxRoot.clear();this.depthRoot.clear();
    this.scene.background.set(L.sky);this.scene.fog.color.set(L.fog);applyEnvironment(this,L);
    this.platforms=new Map();this.enemyViews=new Map();this.coinViews=[];this.stampViews=[];this.crusherViews=[];
    this.shotViews=new Map();
    this.buildBackground(L);
    if(this.canvas)this.resize();else Object.assign(this,cameraFraming(1280,720,this.biome));
    syncStream(this,L,focusX,true);
    const ground=L.platforms.find(s=>s.checkpoint&&Math.abs(s.checkpoint-focusX)<.1);
    this.cameraX=focusX+this.viewW*.18;this.cameraY=(ground?.y??L.spawn.y)+this.viewH*.18;
    disposeShapeHands(this);this.shapeHands=createShapeHands(this,L);
    this.lastPlayerX=focusX;this.cameraLook=0;this.shake=0;heroEvent(this.character,{type:'respawn'});
  }
  syncVisible(L,center,force=false){syncStream(this,L,center,force);}
  refreshEditor(L,center){
    this.currentLevel=L;
    // Keep shared meshes, textures, lighting and the backdrop while replacing
    // the edited foreground. This avoids reloading the world after each drag.
    for(const v of this.streamViews.values()){v.remove();disposeBranch(this,v.root);}
    this.streamViews.clear();this.windViews.clear();this.circuitViews.clear();
    this.flags=[];this.bell=null;this.coinViews=[];this.stampViews=[];this.crusherViews=[];
    syncStream(this,L,center,true);
  }
  setEditorCamera(camera){this.editorCamera=camera;this.resize();}
  resize() {
    const rect=this.canvas.getBoundingClientRect(),w=Math.max(1,rect.width||window.innerWidth),h=Math.max(1,rect.height||window.innerHeight);this.renderer.setSize(w,h,false);
    Object.assign(this,cameraFraming(w,h,this.biome));
    if(this.currentLevel?.playground){const scale=this.landscape?1.4:1.15;this.viewH*=scale;this.viewW*=scale;}
    if(this.editorCamera){this.viewH=this.editorCamera.viewH;this.viewW=this.viewH*w/h;}
    this.camera.left=-this.viewW/2;this.camera.right=this.viewW/2;this.camera.top=this.viewH/2;this.camera.bottom=-this.viewH/2;this.camera.updateProjectionMatrix();
  }
  burst(x,y,color='cream',count=9,power=1) {
    if(this.reducedMotion)count=Math.min(count,5);
    count=Math.min(count,110-this.particles.length);
    for(let i=0;i<count;i++){
      const r=.04+Math.random()*.06,m=this.ball(r,r,r,color,this.fxRoot,x,y+.1,.1+(Math.random()-.5)*.5);
      m.castShadow=false;m.receiveShadow=false;
      this.particles.push({mesh:m,vx:(Math.random()-.5)*power*5,vy:Math.random()*power*4+1,vz:(Math.random()-.5)*2,life:.55+Math.random()*.4});
    }
  }
  event(e) {
    if(e.type==='press-impact'&&Math.abs(this.cameraX-e.x)>this.viewW*.8)return;
    heroEvent(this.character,e);
    if(e.type==='checkpoint')raiseCheckpoint(this,e);
    else if(e.type==='break'&&e.spore)burstSporePod(this,e);
    else if(e.type==='crumble-collapse')clayFragments(this,e.x,e.y,e.w,24,1.1);
    else if(e.type==='press-impact'){clayFragments(this,e.x,e.y,e.w+1,14,.85);if(!this.reducedMotion&&Math.abs(this.cameraX-e.x)<this.viewW*.6)this.shake=.06;}
    else if(e.type==='squish'&&e.kind==='spore')this.burst(e.x,e.y,'spore',16,.75);
    else if(e.type==='shot-pop'||e.type==='spitter-fire')this.burst(e.x,e.y,'gold',e.type==='shot-pop'?5:3,.4);
    else if(e.type==='squish'&&e.kind==='spitter'){this.burst(e.x,e.y,'accent',12,.9);this.burst(e.x,e.y,'orangeLight',8,.7);}
    else if(e.type==='spore-leap'||e.type==='spore-land')this.burst(e.x,e.y,'dust',6,.4);
    else if(e.type==='squish'&&e.kind==='drifter')burstDrifterLeaves(this,e.x,e.y);
    else if(['land','jump','coin','stamp','break','spring','squish','checkpoint','hurt','step','skid','activate','shape','drifter-bump'].includes(e.type))
      this.burst(e.x,e.y,e.type==='coin'||e.type==='stamp'?'gold':e.type==='hurt'||e.type==='break'?'orange':'dust',e.type==='step'?2:e.type==='stamp'||e.type==='break'?23:e.type==='jump'?7:10,e.type==='step'?.3:e.type==='break'?2:1);
    if(!this.reducedMotion){if(e.type==='land'&&e.impact>12)this.shake=.09;if(e.type==='break'||e.type==='hurt')this.shake=.17;if(e.type==='spring')this.shake=.06;}
    if(e.type==='spring'){const near=this.platforms.get(e.platformId);if(near)near.bounce=1;}
    if(e.type==='complete')this.burst(this.character.root.position.x,this.character.root.position.y+1.8,'gold',44,2.5);
  }
  updateParticles(dt){
    if(dt<=0)return;
    for(let i=this.particles.length-1;i>=0;i--){
      const q=this.particles[i];q.life-=dt;
      if(q.kind==='spore-shell'||q.kind==='spore-bloom')updateSporeParticle(q,dt);
      else if(q.kind==='drifter-leaf'){
        const age=q.maxLife-q.life,drag=Math.exp(-dt*1.8);
        q.vx*=drag;q.vz*=drag;q.vy-=3*dt;
        q.mesh.position.x+=(q.vx+Math.sin(age*13+q.phase)*.28)*dt;
        q.mesh.rotation.x+=q.spinX*dt;q.mesh.rotation.y+=q.spinY*dt;q.mesh.rotation.z+=q.spinZ*dt;
        // Shrink away at the end without allocating transparent materials.
        q.mesh.scale.multiplyScalar(Math.exp(-dt*(q.life<.22?12:.45)));
      }else{q.vy-=9*dt;q.mesh.position.x+=q.vx*dt;q.mesh.scale.multiplyScalar(1-dt*.65);if(q.kind==='clay-chip'){q.mesh.rotation.x+=q.spinX*dt;q.mesh.rotation.z+=q.spinZ*dt;}}
      q.mesh.position.y+=q.vy*dt;q.mesh.position.z+=q.vz*dt;
      if(q.life<=0){this.fxRoot.remove(q.mesh);disposeSporeParticle(q);this.particles.splice(i,1);}
    }
  }
  render(game,dt,menu=false) {
    this.time+=dt;
    const t=this.time,p=game.player,L=game.level;
    const edit=this.editorCamera;
    if(edit){
      const rect=this.canvas.getBoundingClientRect(),viewW=edit.viewH*rect.width/Math.max(1,rect.height);
      if(this.viewH!==edit.viewH||this.viewW!==viewW){this.viewH=edit.viewH;this.viewW=viewW;this.camera.left=-viewW/2;this.camera.right=viewW/2;this.camera.top=edit.viewH/2;this.camera.bottom=-edit.viewH/2;this.camera.updateProjectionMatrix();}
    }
    syncStream(this,L,edit?.x??p.x);
    if(!edit){
    if(Math.abs(p.x-(this.lastPlayerX??p.x))>this.viewW*1.5){const snap=cameraTarget(p,this.viewW,this.viewH,this.landscape);this.cameraX=snap.x;this.cameraY=snap.y;}
    this.lastPlayerX=p.x;
    this.cameraLook+=(p.vx*.2-this.cameraLook)*(1-Math.exp(-dt*3.5));
    const citadel=this.biome==='citadel';
    const target=cameraTarget(p,this.viewW,this.viewH,this.landscape,this.cameraLook);
    const targetX=menu?L.spawn.x+this.viewW*.18:target.x;
    const targetY=menu?L.spawn.y+this.viewH*.18:target.y;
    this.cameraX+=(targetX-this.cameraX)*(1-Math.exp(-dt*6.7));
    this.cameraY+=(targetY-this.cameraY)*(1-Math.exp(-dt*(p.groundId?7:11)));
    }else{this.cameraX=edit.x;this.cameraY=edit.y;}
    this.shake=Math.max(0,this.shake-dt*.7);const sx=this.reducedMotion?0:Math.sin(t*82)*this.shake,sy=this.reducedMotion?0:Math.cos(t*67)*this.shake*.65;
    this.camera.position.set(this.cameraX+sx,this.cameraY+(edit?0:(this.theme.cameraElevation??(this.biome==='citadel'?1.25:3.05)))+sy,26);this.camera.lookAt(this.cameraX+sx,this.cameraY+sy,0);
    this.sun.position.set(this.cameraX-10,this.cameraY+18,12);this.sun.target.position.set(this.cameraX,this.cameraY-2,0);
    animateHero(this,game,dt);
    for(const s of L.platforms){
      const view=this.platforms.get(s.id);if(!view)continue;view.root.position.set(s.x,s.y,0);view.root.visible=!s.broken;
      for(const rope of view.ropes||[]){const anchor=rope.userData.ceiling;if(anchor)rope.scale.y=Math.max(.1,anchor.y-s.y-(anchor.offset??.25))/anchor.rest;}
      for(const guide of view.guides||[])guide.visible=!s.broken&&s.active!==false;
      updateClayView(view,s);
      if(view.balance){view.balance.rotation.z=s.angle;view.meter?.forEach((m,i)=>m.scale.setScalar(game.latched[s.channel]||s.charge>(i+1)/4?1:.45));}
      if(s.kind==='timed'||s.kind==='pulse'){
        view.root.visible=true;
        view.root.scale.y=s.active?1:.28;
        const low=(s.kind==='pulse'?s.warning:game.channels[s.channel]<2)&&s.active;
        // A deck's meshes are fixed once it is built, so gather them once
        // instead of walking the whole view every frame.
        if(!view.phaseMeshes){
          view.phaseMeshes=[];view.phaseSignals=[];
          view.root.traverse(o=>{if(o.isMesh)(o.userData.phaseSignal?view.phaseSignals:view.phaseMeshes).push(o);});
          for(const o of view.phaseMeshes)o.userData.realMat=o.material;
        }
        for(const o of view.phaseSignals){o.visible=s.active||(s.warning&&Math.sin(game.time*20)>0);o.scale.y=s.active?1:1/.28;}
        // Solid and ghosted are the only two states; swap only on the change.
        if(view.phaseActive!==s.active){
          view.phaseActive=s.active;
          for(const o of view.phaseMeshes)o.material=s.active?o.userData.realMat:this.mat.ghost;
        }
        view.root.position.y=s.y+(low?Math.sin(t*22)*.035:0);
      }
      if(s.kind==='crumble'){
        animateCrumble(this,view,s,game.status==='playing'?dt:0);
      }
      if(s.kind==='spring'){animateSpringPad(view,game.status==='playing'?dt:0);if(!view.springPad)view.root.scale.y=1+Math.sin(view.bounce*14)*view.bounce*.3;}
      if(s.kind==='switch')view.root.scale.y=game.channels[s.channel]>0?.5:1;
      animateCavernMachine(view,s,this);
    }
    animateShapeHands(this,game,dt,game.status==='playing');
    L.enemies.forEach(e=>animateEnemy(this.enemyViews.get(e.id),e,dt,game.status));
    syncShots(this,game);
    L.coins.forEach((c,i)=>{const g=this.coinViews[i];if(!g)return;g.visible=!c.taken;g.position.y=c.y+Math.sin(t*2.5+i*.5)*.09;g.rotation.y=Math.sin(t*1.3+i*.7)*.48;g.rotation.z=Math.sin(t*.6+i)*.08;});
    L.stamps.forEach((c,i)=>{const g=this.stampViews[i];if(!g)return;g.visible=!c.taken;g.position.y=c.y+Math.sin(t*2+i)*.13;g.rotation.y=Math.sin(t*1.8)*.28;g.rotation.z=t*.35;});
    L.crushers?.forEach((c,i)=>animatePressView(this.crusherViews[i],c));
    for(const view of this.circuitViews.values())animateCircuit(view,game,this.reducedMotion);
    animateForest(this,game);
    for(const view of this.windViews.values())animateWind(view,game.time,this.reducedMotion);
    // Only windmill rotors spin. Locate them once per view rather than walking
    // every platform's meshes on every frame.
    for(const view of this.platforms.values()){
      if(!view.spinners){view.spinners=[];view.root.traverse(o=>{if(o.userData.spin)view.spinners.push(o);});}
      for(const rotor of view.spinners)rotor.rotation.z=game.time*.7;
    }
    animateCheckpoints(this,game,dt);
    this.clouds.forEach((g,i)=>g.position.x+=dt*(.045+rand(i)*.03));
    animateEnvironment(this,dt);
    animateDepthScenery(this,game,dt);
    if(this.bell)this.bell.rotation.z=game.status==='complete'?Math.sin(t*14)*.3:Math.sin(t*2)*.035;
    this.updateParticles(game.status==='paused'||edit?0:dt);
    // Frustum culling happens per mesh; distant background is intentionally low detail.
    renderCitadelDepth(this);
  }
}
