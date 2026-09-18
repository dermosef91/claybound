import * as THREE from './lib/three.module.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';
import {createHero,loadHero,detachHero,animateHero,heroEvent} from './hero.js';
import {characterChoice} from './characters.js';
import {applyEnvironment,buildBackdrop,buildTerrain,animateEnvironment} from './environments.js';
import {makeCitadelLift} from './citadel.js';
import {makeMovingPlatform,movingPlatformMaterials} from './moving-platform.js';
import {renderCitadelDepth} from './citadel-depth.js';
import {loadEnemies,createEnemyView,animateEnemy,releaseEnemyViews} from './enemies.js';
import {loadCastle} from './castle.js';
import {loadBats} from './bats.js';
import {loadSpores} from './spore-puff.js';
import {loadDrifters} from './drifter.js';
import {burstDrifterLeaves} from './drifter-leaves.js';
import {loadCottage,cottageModel} from './cottage.js';
import {loadClay,clayBox,clayMeshMaterial,sculptClay,clayShape} from './clay.js';
import {loadClouds} from './clouds.js';
import {cameraFraming,cameraTarget,cameraAnchorY,anchorDragged,VERTICAL_BIAS} from './camera.js';
import {syncStream,disposeBranch} from './streaming.js';
import {backdropView} from './decor.js';
import {landmark,balanceDeck,animateWind} from './setpieces.js';
import {createShapeHands,animateShapeHands,disposeShapeHands} from './shape-hand.js';
import {loadCanyonAssets} from './canyon-assets.js';
import {loadWindmills} from './windmill.js';
import {loadForestAssets} from './forest.js';
import {loadDreamAssets} from './dream-assets.js';
import {loadSpitterAssets} from './spitter-asset.js';
import {loadCavernAssets} from './cavern-asset.js';
import {createCaveLights} from './cave-lighting.js';
import {makeCanyonLift,makeCanyonZip,animateCanyonZip,plankSpan,buildCanyonWall} from './canyon.js';
import {greatArchLedge} from './great-arch.js';
import {makeRopeBridge} from './rope-bridge.js';
import {bridgeOffset} from './bridge-surface.js';
import {animateCircuit} from './mechanism-views.js';
import {forestBranch,forestSeal,forestMushroom,animateForest} from './forest-details.js';
import {caveLedgeDetails,caveLedgeBody} from './cavern.js';
import {animateDepthScenery} from './depth-scenery.js';
import {createSpringPad,animateSpringPad} from './spring-pad.js';
import {createCrumble,animateCrumble,clayFragments} from './crumble.js';
import {animatePressView} from './press-views.js';
import {checkpointFlag,raiseCheckpoint,animateCheckpoints} from './checkpoints.js';
import {createCavernMachine,animateCavernMachine} from './cavern-machine-views.js';
import {syncShots} from './spitter.js';
import {loadCityLaundry} from './city-laundry.js';
import {createClayView,updateClayView,animateClayView} from './shaping-views.js';
import {dentable,kickDent,stepDent,applyDent} from './clay-feel.js';
import {CLAY_PALETTE} from './palette.js';
import {createGoal} from './goal.js';
import {burstSporePod,updateSporeParticle,disposeSporeParticle} from './spore-effects.js';
import {settleSquash,updateClayClump} from './clay-shatter.js';
import {loadMotherPuff,createMotherArenaFloor,animateMotherPuff,motherCamera,motherViewHeight} from './mother-puff.js';
import {updateMotherTrail} from './mother-puff-trail.js';
import {dreamPlatformView,animateDream} from './dream.js';

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

// Camera shake carries a trauma value in [0,1] that events add to and time
// drains, and the offset it produces is trauma squared. Squaring is the whole
// point: it spaces the amplitudes out, so a heavy arrival is felt as heavier
// instead of every impact landing on one fixed wobble.
const TRAUMA_DECAY=1.8,SHAKE_MAX=.3,SHAKE_ROLL=.09;
export const shakeAmplitude=trauma=>trauma*trauma*SHAKE_MAX;
// A landing's trauma follows its arrival speed with no threshold to cross. The
// old cutoff sat within a tenth of the median landing, so neighbouring impacts
// fell on opposite sides of it and shook completely differently.
export const landTrauma=impact=>Math.min(.62,Math.max(0,impact*.032));
// Value noise, one independent channel per seed. Noise rather than a fixed
// sine keeps the shake's character at every amplitude, and being a pure
// function of time it pauses, slows and replays with the rest of the frame.
function shakeNoise(seed,t){
  const hash=n=>{const v=Math.sin(n*127.1+seed*311.7)*43758.5453;return (v-Math.floor(v))*2-1;};
  const x=t*30+seed*37.3,i=Math.floor(x),f=x-i;
  return hash(i)+(hash(i+1)-hash(i))*(f*f*(3-2*f));
}

export class World {
  constructor(canvas,{onProgress,character}={}) {
    this.canvas=canvas;this.time=0;this.cameraX=8.3;this.cameraY=3.4;this.particles=[];this.clouds=[];this.shake=0;this.trauma=0;this.cameraLook=0;
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
    this.ready=Promise.all([loadHero(this,value=>report(0,value),characterChoice(character)),loadEnemies(this,value=>report(1,value)),loadClay(this,value=>report(2,value)),loadClouds(this,value=>report(3,value)),loadCanyonAssets(this,value=>report(4,value)),loadCottage(this,value=>report(5,value)),loadWindmills(this,value=>report(6,value))]);
    this.resize();
    window.addEventListener('resize',()=>this.resize());
    window.visualViewport?.addEventListener('resize',()=>this.resize());
  }
  // Trade one character for another without rebuilding the world. The outgoing
  // rig goes first, so only one skeleton and one set of clips are ever resident,
  // and a second request waits on the first rather than racing it into the same
  // group. The level, camera and the player's position are untouched.
  async setCharacter(id){
    const choice=characterChoice(id);
    this.characterSwap=Promise.resolve(this.characterSwap).catch(()=>{}).then(async()=>{
      // The first character may still be arriving; attaching over it would
      // leave two rigs in the same group with one of them orphaned.
      await this.ready;
      if(this.character.choice?.id===choice.id)return;
      detachHero(this);
      await loadHero(this,null,choice);
      heroEvent(this.character,{type:'respawn'});
    });
    await this.characterSwap;
    return this.character;
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
    if(twist&&len>=.065){
      // The twist depends on nothing but its length and radius, so ropes of a
      // repeated span share one strand.
      const strand=clayShape(this,`rope-twist:${len.toFixed(3)}:${r.toFixed(3)}`,()=>{
        const points=[];for(let t=0;t<=len;t+=.065)points.push(new THREE.Vector3(Math.cos(t*24)*r*.77,t,Math.sin(t*24)*r*.77));
        return sculptClay(this,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.min(400,Math.ceil(len*18)),r*.37,5,false),{amplitude:.06});
      });
      this.mesh(strand,'cream',g);
    }
    return g;
  }
  flag(x,y,parent,scale=1,checkpointId=null) {
    const g=new THREE.Group();g.name='Checkpoint flag';g.position.set(x,y,-.75);g.scale.setScalar(scale);parent.add(g);
    const pole=this.biome==='desert'?'bark':'orange';
    this.cylinder(.043,2.65,pole,g,0,1.3);this.ball(.1,.1,.1,pole,g,0,2.68,0);
    // One banner outline for every checkpoint in the game — build it once.
    const geom=clayShape(this,'checkpoint-banner',()=>{
      const s=new THREE.Shape();s.moveTo(.04,2.52);s.bezierCurveTo(.45,2.6,.7,2.3,1.1,2.43);s.lineTo(.84,2.02);s.lineTo(1.05,1.79);s.bezierCurveTo(.7,1.8,.48,1.95,.04,1.87);s.closePath();
      const banner=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,steps:1});
      banner.translate(0,-2.52,0);
      return sculptClay(this,banner,{amplitude:.06});
    });
    const flag=this.mesh(geom,'orange',g,0,2.52,0);this.flags.push(flag);
    if(checkpointId)checkpointFlag(this,flag,g,checkpointId);
    return g;
  }
  arch(w,h,d,parent,x,y,z,mat='blue') {
    const geo=clayShape(this,`arch:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`,()=>{
      const s=new THREE.Shape(),aw=Math.min(w*.33,2.7),top=-h*.38;
      s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,-h);s.lineTo(aw,-h);s.lineTo(aw,top-aw*.7);
      s.bezierCurveTo(aw,top+aw*.6,-aw,top+aw*.6,-aw,top-aw*.7);s.lineTo(-aw,-h);s.lineTo(-w/2,-h);s.closePath();
      const shape=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelThickness:.15,bevelSize:.14,bevelSegments:3,curveSegments:16});
      // In-plane coordinates keep the visible fingerprints at a consistent scale.
      const uv=shape.attributes.uv, pos=shape.attributes.position;
      for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*.22,pos.getY(i)*.22);
      const sculpted=sculptClay(this,shape,{amplitude:.12,subdivide:true});
      if(sculpted!==shape)shape.dispose();
      return sculpted;
    });
    return this.mesh(geo,mat,parent,x,y,z-d/2);
  }
  doorway(parent,x,y,z,scale=1) {
    const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
    this.box(.95,1.36,.06,'dark',g,0,.68,0,.12);
    this.ball(.475,.54,.05,'dark',g,0,1.33,0);
    const arc=clayShape(this,'doorway-arc',()=>sculptClay(this,new THREE.TorusGeometry(.53,.12,8,28,Math.PI),{amplitude:.06}));
    const m=this.mesh(arc,'blueDark',g,0,1.31,.02);
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
    if(L.biome==='dream')await loadDreamAssets(this,onProgress);
    if(L.boss?.kind==='mother-puff')await loadMotherPuff(this,onProgress);
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
    if(s.motherArena){createMotherArenaFloor(this,s,g);return {root:g,ropes:[]};}
    // The dream's section modules and its own kinds and dressings (dream.js,
    // dream-views.js) are offered every platform first — a tinted station's
    // clay included; whatever they decline is built by the branches below.
    if(this.biome==='dream'){const v=dreamPlatformView(this,s,g);if(v)return v;}
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
    if(s.kind==='zip')return makeCanyonZip(this,s,g);
    if(s.kind==='balance')return balanceDeck(this,s,g);
    let ropes=[],springPad,fracture;
    if(s.kind==='wall'&&this.biome==='desert'&&!s.breathe){
      buildCanyonWall(this,s,g);
    } else if(s.kind==='wall'){
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
    } else if(s.kind==='break'&&s.timber){
      plankSpan(this,s,g);
    } else if(s.kind==='ledge'&&this.biome==='cave'){
      caveLedgeBody(this,s,g);
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
  // The chapter's own horizon first, then the authored pieces on top of it, so
  // a placement reads against the biome's skyline rather than instead of it.
  buildBackground(L) {
    buildBackdrop(this,L);
    this.backdropViews=(L.backdrop||[]).map(item=>backdropView(this,item));
  }
  build(L,index,focusX=L.spawn.x) {
    this.currentLevel=L;
    this.motherView=null;
    releaseEnemyViews(this);
    if(!this.depthRoot){this.depthRoot=new THREE.Group();this.depthRoot.name='Sharp side scenery';this.scene.add(this.depthRoot);}
    this.depthViews=new Map();
    this.levelIndex=index;this.flags=[];this.clouds=[];this.particles=[];this.bell=null;this.streamViews=new Map();this.streamPending=[];this.streamWanted=null;this.streamDebt=0;this.windViews=new Map();this.circuitViews=new Map();
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
    // The dream's render-only state starts over with the world: no roll, no
    // zoom request, no palette written yet, and no props leaning.
    this.dreamRoll=0;this.dreamViewH=null;this.dreamPaletteKey=null;this.dreamLeaners=[];this.dreamSwirls=[];
    this.platforms=new Map();this.enemyViews=new Map();this.coinViews=[];this.stampViews=[];this.crusherViews=[];this.decorViews=[];this.backdropViews=[];
    this.shotViews=new Map();
    this.buildBackground(L);
    if(this.canvas)this.resize();else{Object.assign(this,cameraFraming(1280,720,this.biome));this.baseViewH=this.viewH;}
    syncStream(this,L,focusX,true);
    const ground=L.platforms.find(s=>s.checkpoint&&Math.abs(s.checkpoint-focusX)<.1);
    this.cameraX=focusX+this.viewW*.18;this.cameraY=(ground?.y??L.spawn.y)+this.viewH*.18;
    disposeShapeHands(this);this.shapeHands=createShapeHands(this,L);
    this.lastPlayerX=focusX;this.cameraLook=0;this.shake=0;this.trauma=0;this.cameraAnchorY=undefined;this.cameraFace=undefined;heroEvent(this.character,{type:'respawn'});
  }
  syncVisible(L,center,force=false){syncStream(this,L,center,force);}
  refreshEditor(L,center){
    this.currentLevel=L;
    // Keep shared meshes, textures, lighting and the backdrop while replacing
    // the edited foreground. This avoids reloading the world after each drag.
    for(const v of this.streamViews.values()){v.remove();disposeBranch(this,v.root);}
    this.streamViews.clear();this.streamPending=[];this.streamWanted=null;this.streamDebt=0;this.windViews.clear();this.circuitViews.clear();
    this.flags=[];this.bell=null;this.coinViews=[];this.stampViews=[];this.crusherViews=[];this.decorViews=[];
    // The biome's own horizon and its parallax layers survive a refresh, but
    // the authored pieces standing in them are being edited, so they are the
    // one part of the backdrop that is rebuilt. The layers they belong to are
    // reused, which is why the map of them is not cleared here.
    this.clearAuthoredBackdrop();
    syncStream(this,L,center,true);
    this.backdropViews=(L.backdrop||[]).map(item=>backdropView(this,item));
  }
  clearAuthoredBackdrop(){
    for(const view of this.backdropViews||[]){view.parent?.remove(view);disposeBranch(this,view);}
    this.backdropViews=[];
  }
  setEditorCamera(camera){this.editorCamera=camera;this.resize();}
  // The workshop's decoration mode wants the sparse foreground props on screen
  // and holding still, rather than hidden as they are for the rest of editing.
  setEditorScenery(show){this.editorScenery=!!show;}
  resize() {
    const rect=this.canvas.getBoundingClientRect(),w=Math.max(1,rect.width||window.innerWidth),h=Math.max(1,rect.height||window.innerHeight);this.renderer.setSize(w,h,false);
    Object.assign(this,cameraFraming(w,h,this.biome));
    if(this.currentLevel?.playground){const scale=this.landscape?1.4:1.15;this.viewH*=scale;this.viewW*=scale;}
    // What the dream's camera list means by "the ordinary height".
    this.baseViewH=this.viewH;
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
  addTrauma(amount) {
    if(!this.reducedMotion)this.trauma=Math.min(1,(this.trauma||0)+amount);
  }
  event(e) {
    if(e.type==='press-impact'&&Math.abs(this.cameraX-e.x)>this.viewW*.8)return;
    heroEvent(this.character,e);
    // Before the first build() there is nothing to paint on: the environment's
    // palette slots — dust, accent — only exist once a chapter has been built.
    // The rig has heard the event; the effects wait for a chapter.
    if(!this.currentLevel)return;
    if(e.type==='checkpoint')raiseCheckpoint(this,e);
    else if(e.type==='mother-open')this.addTrauma(.48);
    else if(e.type==='mother-hit'||e.type==='mother-collapse'){this.burst(e.x,e.y,'gold',20,1.3);this.addTrauma(.52);}
    else if(e.type==='mother-bounce')this.burst(e.x,e.y,'orange',10,.7);
    else if(e.type==='break'&&e.spore)burstSporePod(this,e);
    // A plank floor going through flies apart as wood, the whole width of it,
    // on top of the burst every break raises.
    else if(e.type==='break'&&this.currentLevel?.platforms.find(p=>p.id===e.platformId)?.timber){
      const wood=movingPlatformMaterials(this);
      clayFragments(this,e.x,e.y+.1,e.w,30,1.9,false,{material:Math.random()<.5?wood.grain:wood.wood,size:2.6});
      this.burst(e.x,e.y,'orange',23,2);
    }
    else if(e.type==='crumble-collapse')clayFragments(this,e.x,e.y,e.w,24,1.1,true);
    else if(e.type==='press-impact'){clayFragments(this,e.x,e.y,e.w+1,14,.85);if(Math.abs(this.cameraX-e.x)<this.viewW*.6)this.addTrauma(.45);}
    else if(e.type==='shot-pop'||e.type==='spitter-fire')this.burst(e.x,e.y,'gold',e.type==='shot-pop'?5:3,.4);
    else if(e.type==='spore-leap'||e.type==='spore-land')this.burst(e.x,e.y,'dust',6,.4);
    else if(e.type==='squish'&&e.kind==='drifter')burstDrifterLeaves(this,e.x,e.y);
    // A stomped creature's own pellets and clumps come from settleSquash in
    // render, where its pressed disc actually is; only the spore puff's spores
    // and the drifter's leaves are still thrown from here.
    else if(['land','jump','coin','stamp','break','spring','checkpoint','hurt','step','skid','activate','shape','drifter-bump'].includes(e.type))
      this.burst(e.x,e.y,e.type==='coin'||e.type==='stamp'?'gold':e.type==='hurt'||e.type==='break'?'orange':'dust',e.type==='step'?2:e.type==='stamp'||e.type==='break'?23:e.type==='jump'?7:10,e.type==='step'?.3:e.type==='break'?2:1);
    if(e.type==='land')this.addTrauma(landTrauma(e.impact||7));
    if(e.type==='break'||e.type==='hurt')this.addTrauma(.75);
    if(e.type==='spring')this.addTrauma(.45);
    if(e.type==='spring'){const near=this.platforms.get(e.platformId);if(near)near.bounce=1;}
    // A landing gives the slab under it. Environmental motion is exactly what
    // reduced motion asks to be spared, so the deck stays rigid there.
    if(e.type==='land'&&!this.reducedMotion){
      const view=this.platforms.get(e.platformId),s=view&&this.currentLevel?.platforms.find(p=>p.id===e.platformId);
      if(s&&dentable(s,view))kickDent(view,{impact:e.impact,width:s.w,strong:e.strong});
    }
    if(e.type==='complete')this.burst(this.character.root.position.x,this.character.root.position.y+1.8,'gold',44,2.5);
  }
  // `press` is where the player's feet stand, when they stand: resting clay
  // clumps under them are pressed flat and away.
  updateParticles(dt,press=null){
    if(dt<=0)return;
    for(let i=this.particles.length-1;i>=0;i--){
      const q=this.particles[i];q.life-=dt;
      // Clumps and pellets land on a deck, so they integrate their own fall.
      if(q.kind==='clay-clump'||q.kind==='clay-pellet')updateClayClump(q,dt,press);
      else{
        if(q.kind==='spore-shell'||q.kind==='spore-bloom')updateSporeParticle(q,dt);
        else if(q.kind==='mother-trail')updateMotherTrail(q,dt);
        else if(q.kind==='drifter-leaf'){
          const age=q.maxLife-q.life,drag=Math.exp(-dt*1.8);
          q.vx*=drag;q.vz*=drag;q.vy-=3*dt;
          q.mesh.position.x+=(q.vx+Math.sin(age*13+q.phase)*.28)*dt;
          q.mesh.rotation.x+=q.spinX*dt;q.mesh.rotation.y+=q.spinY*dt;q.mesh.rotation.z+=q.spinZ*dt;
          // Shrink away at the end without allocating transparent materials.
          q.mesh.scale.multiplyScalar(Math.exp(-dt*(q.life<.22?12:.45)));
        }else{q.vy-=9*dt;q.mesh.position.x+=q.vx*dt;q.mesh.scale.multiplyScalar(1-dt*.65);if(q.kind==='clay-chip'){q.mesh.rotation.x+=q.spinX*dt;q.mesh.rotation.z+=q.spinZ*dt;}}
        q.mesh.position.y+=q.vy*dt;q.mesh.position.z+=q.vz*dt;
      }
      if(q.life<=0){this.fxRoot.remove(q.mesh);disposeSporeParticle(q);this.particles.splice(i,1);}
    }
  }
  render(game,dt,menu=false) {
    const heroDt=dt;
    if(game.status==='paused')dt=0;
    this.time+=dt;
    const t=this.time,p=game.player,L=game.level;
    const edit=this.editorCamera;
    if(!edit&&L.boss&&this.canvas){
      const rect=this.canvas.getBoundingClientRect(),base=cameraFraming(rect.width,rect.height,this.biome);
      const near=!['sleeping','defeated'].includes(L.boss.state)&&p.x>L.boss.triggerX-1&&p.x<L.boss.right+7;
      const height=near?motherViewHeight(L.boss,rect.width,rect.height,base.landscape,base.viewH):base.viewH;
      if(this.viewH!==height){
        this.viewH=this.reducedMotion||Math.abs(height-this.viewH)<.02?height:this.viewH+(height-this.viewH)*(1-Math.exp(-dt*(L.boss.state==='reveal'?1.4:2.4)));
        this.viewW=this.viewH*rect.width/Math.max(1,rect.height);this.camera.left=-this.viewW/2;this.camera.right=this.viewW/2;this.camera.top=this.viewH/2;this.camera.bottom=-this.viewH/2;this.camera.updateProjectionMatrix();
      }
    }
    // The dream's camera list asks for a view height by x (dream.js sets
    // dreamViewH, or null for the ordinary one); ease toward it like the boss.
    if(!edit&&!L.boss&&this.dreamViewH!=null&&this.canvas){
      const rect=this.canvas.getBoundingClientRect(),height=this.dreamViewH;
      if(Math.abs(height-this.viewH)>1e-6){
        this.viewH=this.reducedMotion||Math.abs(height-this.viewH)<.02?height:this.viewH+(height-this.viewH)*(1-Math.exp(-dt*2));
        this.viewW=this.viewH*rect.width/Math.max(1,rect.height);this.camera.left=-this.viewW/2;this.camera.right=this.viewW/2;this.camera.top=this.viewH/2;this.camera.bottom=-this.viewH/2;this.camera.updateProjectionMatrix();
      }
    }
    if(edit){
      const rect=this.canvas.getBoundingClientRect(),viewW=edit.viewH*rect.width/Math.max(1,rect.height);
      if(this.viewH!==edit.viewH||this.viewW!==viewW){this.viewH=edit.viewH;this.viewW=viewW;this.camera.left=-viewW/2;this.camera.right=viewW/2;this.camera.top=edit.viewH/2;this.camera.bottom=-edit.viewH/2;this.camera.updateProjectionMatrix();}
    }
    syncStream(this,L,edit?.x??p.x);
    if(!edit){
    if(Math.abs(p.x-(this.lastPlayerX??p.x))>this.viewW*1.5){this.cameraAnchorY=p.y;this.cameraFace=p.facing;const snap=cameraTarget(p,this.viewW,this.viewH,this.landscape);this.cameraX=snap.x;this.cameraY=snap.y;}
    this.lastPlayerX=p.x;
    this.cameraLook+=(p.vx*.2-this.cameraLook)*(1-Math.exp(-dt*3.5));
    // Ease the side the frame leans towards, so tapping the other direction
    // slides the view instead of throwing it across the screen.
    this.cameraFace=this.cameraFace===undefined?p.facing||1:this.cameraFace+((p.facing||1)-this.cameraFace)*(1-Math.exp(-dt*2.6));
    this.cameraAnchorY=cameraAnchorY(this.cameraAnchorY,p,this.viewH,dt);
    const citadel=this.biome==='citadel';
    // A scene the game is watching — a boulder going over its edge — takes the
    // frame with it: the rock sits in the upper part of the view so what it is
    // about to come down on is in the picture, and the pan is slower than the
    // follow, so it reads as the camera turning to look rather than snapping.
    const scene=game.cinema;
    const target=scene?{x:scene.x+this.viewW*.04,y:scene.y-this.viewH*.16}:motherCamera(L.boss,p,this.viewW,this.viewH,this.landscape)||cameraTarget(p,this.viewW,this.viewH,this.landscape,this.cameraLook,this.cameraAnchorY,this.cameraFace);
    const targetX=menu?L.spawn.x+this.viewW*.11:target.x;
    const targetY=menu?L.spawn.y+this.viewH*VERTICAL_BIAS:target.y;
    this.sceneReturn=scene?1.2:Math.max(0,(this.sceneReturn||0)-dt);
    const cameraRate=scene||this.sceneReturn>0?4.4:L.boss?.state==='reveal'?2:L.boss?.state==='defeated'?3.5:6.7;
    this.cameraX+=(targetX-this.cameraX)*(1-Math.exp(-dt*cameraRate));
    // Standing, the frame settles onto the player. Airborne it is gentle,
    // because the anchor is already holding still — until a long fall drags the
    // anchor along, where it has to keep up or the landing leaves the screen.
    const verticalRate=scene?5:p.groundId?7:anchorDragged(this.cameraAnchorY,p,this.viewH)?10:4.5;
    this.cameraY+=(targetY-this.cameraY)*(1-Math.exp(-dt*verticalRate));
    }else{this.cameraX=edit.x;this.cameraY=edit.y;}
    this.trauma=Math.max(0,(this.trauma||0)-dt*TRAUMA_DECAY);this.shake=shakeAmplitude(this.trauma);
    const sx=this.reducedMotion?0:shakeNoise(0,t)*this.shake,sy=this.reducedMotion?0:shakeNoise(1,t)*this.shake*.65;
    // A flat pan reads as the world sliding. The small roll is what makes the
    // frame feel struck; it is the part reduced motion is spared first.
    // The dream adds its authored camera roll on top (dream.js, L.camera).
    const roll=(this.reducedMotion?0:shakeNoise(2,t)*this.shake*SHAKE_ROLL)+(this.dreamRoll||0);
    this.camera.position.set(this.cameraX+sx,this.cameraY+(edit?0:(this.theme.cameraElevation??(this.biome==='citadel'?1.25:3.05)))+sy,26);this.camera.lookAt(this.cameraX+sx,this.cameraY+sy,0);if(roll)this.camera.rotation.z+=roll;
    if(this.camera.zoom!==1){this.camera.zoom=1;this.camera.updateProjectionMatrix();}
    this.sun.position.set(this.cameraX-10,this.cameraY+18,12);this.sun.target.position.set(this.cameraX,this.cameraY-2,0);
    animateHero(this,game,heroDt);
    for(const s of L.platforms){
      const view=this.platforms.get(s.id);if(!view)continue;view.root.position.set(s.x,s.y,0);view.root.visible=!s.broken;
      for(const rope of view.ropes||[]){const anchor=rope.userData.ceiling;if(anchor)rope.scale.y=Math.max(.1,anchor.y-s.y-(anchor.offset??.25))/anchor.rest;}
      for(const guide of view.guides||[])guide.visible=!s.broken&&s.active!==false;
      updateClayView(view,s);
      if(view.clay){
        const station=(L.shaping||[]).find(t=>t.parts.includes(s.id));
        const near=!!station&&p.x>=station.x&&p.x<=station.end&&Math.abs(p.y-station.spawn.y)<10&&station.amount<.995;
        animateClayView(view,s,dt,{near,playing:game.status==='playing',reducedMotion:this.reducedMotion});
      }
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
      // Last, so nothing above rescales the deck after the dent is applied.
      if(dentable(s,view)&&(view.dent||view.dentV)){
        if(game.status==='playing')stepDent(view,dt);
        applyDent(view,s);
      }
      animateCavernMachine(view,s,this);
      if(s.kind==='zip')animateCanyonZip(this,s,view);
    }
    animateShapeHands(this,game,dt,game.status==='playing');
    for(const e of L.enemies){const view=this.enemyViews.get(e.id);animateEnemy(view,e,dt,game.status);settleSquash(this,e,view,L.platforms);}
    // A creature the level has already let go of — a boss minion the fight has
    // cleared — still finishes its squash from its view before streaming drops it.
    for(const view of this.enemyViews.values()){const e=view.enemy;if(e&&!e.alive&&!L.enemies.includes(e)){animateEnemy(view,e,dt,game.status);settleSquash(this,e,view,L.platforms);}}
    syncShots(this,game);
    animateMotherPuff(this,game);
    L.coins.forEach((c,i)=>{const g=this.coinViews[i];if(!g)return;g.visible=!c.taken;g.position.y=c.y+Math.sin(t*2.5+i*.5)*.09;g.rotation.y=Math.sin(t*1.3+i*.7)*.48;g.rotation.z=Math.sin(t*.6+i)*.08;});
    L.stamps.forEach((c,i)=>{const g=this.stampViews[i];if(!g)return;g.visible=!c.taken;g.position.y=c.y+Math.sin(t*2+i)*.13;g.rotation.y=Math.sin(t*1.8)*.28;g.rotation.z=t*.35;});
    L.crushers?.forEach((c,i)=>animatePressView(this.crusherViews[i],c));
    for(const view of this.circuitViews.values())animateCircuit(view,game,this.reducedMotion);
    animateForest(this,game);
    animateDream(this,game,dt);
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
    this.pressPoint??={x:0,y:0};this.pressPoint.x=p.x;this.pressPoint.y=p.y;
    this.updateParticles(game.status==='paused'||edit?0:dt,p.groundId&&!edit?this.pressPoint:null);
    // Frustum culling happens per mesh; distant background is intentionally low detail.
    renderCitadelDepth(this);
  }
}
