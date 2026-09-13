// Steady-state frame profiler: builds one chapter, then runs the per-frame
// update repeatedly so a CPU profile shows only what a playing frame costs.
import {prepareSporeAsset} from '../dist/spore-puff.js';
import {prepareBatAsset} from '../dist/bats.js';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {readPlayer,readGLB} from './load-player.mjs';
import {prepareEnemyAsset} from '../dist/enemies.js';
import {prepareCastleAsset} from '../dist/castle.js';
import {prepareCottageAsset} from '../dist/cottage.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {readFile} from 'node:fs/promises';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {attachClay} from './load-clay.mjs';
import {attachCanyon} from './load-canyon.mjs';
import {attachWindmills} from './load-windmills.mjs';
import {attachForest} from './load-forest.mjs';
import {attachSpitter} from './load-spitter.mjs';
import {attachGrotto} from './load-grotto.mjs';
import {createCaveLights} from '../dist/cave-lighting.js';
import {attachDrifter} from './load-drifter.mjs';
import {prepareCityLaundry} from '../dist/city-laundry.js';

const w=Object.create(World.prototype);
w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
w.camera=new THREE.OrthographicCamera(-11,11,6,-6,.1,160);
w.renderer={render(){},setRenderTarget(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
prepareEnemyAsset(w,await readGLB(new URL('../dist/assets/enemy.glb',import.meta.url)),await data('enemy-motion.json'));
prepareBatAsset(w,await readGLB(new URL('../dist/assets/bat.glb',import.meta.url)));
prepareCastleAsset(w,await readGLB(new URL('../dist/assets/castle.glb',import.meta.url)));
prepareCottageAsset(w,await readGLB(new URL('../dist/assets/cottage.glb',import.meta.url)));
prepareCloudAsset(w,await readGLB(new URL('../dist/assets/cloud.glb',import.meta.url)));
prepareCityLaundry(w,await readGLB(new URL('../dist/assets/city-laundry.glb',import.meta.url)));
await attachCanyon(w);await attachWindmills(w);await attachForest(w);await attachGrotto(w);await attachDrifter(w);
prepareSporeAsset(w,await readGLB(new URL('../dist/assets/spore-puff.glb',import.meta.url)));
await attachClay(w);await attachSpitter(w);

const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere();
const shadowCamera=()=>{
  const c=w.sun.shadow.camera;
  c.position.copy(w.sun.position);c.lookAt(w.sun.target.position);c.updateMatrixWorld(true);c.updateProjectionMatrix();
  return c;
};
function submitted(){
  w.scene.updateMatrixWorld();
  w.camera.updateMatrixWorld();
  const count=(camera,shadow)=>{
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let drawn=0,objects=0,triangles=0,back=0,level=0;
    const walk=(o,root)=>{
      if(!o.visible)return;
      objects++;
      if(o===w.backRoot)root='back';else if(o===w.levelRoot)root='level';
      if(o.isMesh&&(!shadow||o.castShadow)){
        if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
        if(!o.frustumCulled||frustum.intersectsSphere(sphere)){
          drawn++;
          const index=o.geometry.index,position=o.geometry.attributes.position;
          const t=Math.floor((index?index.count:position.count)/3);
          triangles+=t;if(root==='back')back+=t;else if(root==='level')level+=t;
        }
      }
      for(const c of o.children)walk(c,root);
    };
    walk(w.scene,null);
    return {drawn,objects,triangles,back,level};
  };
  const main=count(w.camera,false),shadow=count(shadowCamera(),true);
  return {...main,shadowDraws:shadow.drawn,shadowTriangles:shadow.triangles};
}
const median=list=>{const s=[...list].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const at=(list,q)=>list[Math.min(list.length-1,Math.floor(list.length*q))];
const mb=n=>(n/1048576).toFixed(1);
const shapeBytes=geo=>{let n=geo.index?geo.index.array.byteLength:0;for(const a of Object.values(geo.attributes))n+=a.array.byteLength;return n;};

// Reports what a frame and a streaming step actually cost on the CPU. These are
// submission and build measurements, not GPU timings, and the absolute numbers
// depend on the machine; compare a change against a run of the same script.
const rows=[];
for(let index=0;index<LEVELS.length;index++){
  const g=new Game();g.start(index);w.build(g.level,index);
  w.viewW=22;w.viewH=12;w.landscape=true;w.reducedMotion=false;

  // A frame in the middle of the chapter, held steady.
  const rest=g.level.sections[Math.min(2,g.level.sections.length-1)].x+20;
  const floor=g.level.platforms.find(s=>rest>=s.x&&rest<=s.x+s.w);
  Object.assign(g.player,{x:rest,y:floor?.y??12,vx:4});
  w.cameraX=rest;w.cameraY=(floor?.y??12)+2;w.syncVisible(g.level,rest,true);
  for(let i=0;i<40;i++)w.render(g,1/60);
  const shape=submitted();
  const frames=[];for(let i=0;i<600;i++){const t0=performance.now();w.render(g,1/60);frames.push(performance.now()-t0);}

  // Walking the chapter and back, the way a player who backtracks does.
  const route=[];
  for(let x=g.level.spawn.x;x<g.level.end;x+=8)route.push(x);
  for(let x=g.level.end;x>g.level.spawn.x;x-=8)route.push(x);
  const steps=[];
  for(const x of route){
    const ground=g.level.platforms.find(s=>x>=s.x&&x<=s.x+s.w);
    Object.assign(g.player,{x,y:ground?.y??12,vx:6});
    w.cameraX=x;w.cameraY=(ground?.y??12)+2;
    const t0=performance.now();w.syncVisible(g.level,x);w.render(g,1/60);steps.push(performance.now()-t0);
  }
  steps.sort((a,b)=>a-b);
  let held=0;for(const [,geo]of w.clay.boxes)held+=shapeBytes(geo);
  let nodes=0;w.scene.traverse(()=>nodes++);
  rows.push({chapter:g.level.short,draws:shape.drawn,triangles:shape.triangles,nodes,
    frame:median(frames),step:at(steps,.5),p90:at(steps,.9),cache:held});
}
console.log('chapter           draws  triangles  nodes   frame ms   stream ms   stream p90   cache MB');
for(const r of rows)console.log(
  `${r.chapter.padEnd(17)}${String(r.draws).padStart(5)}${String(r.triangles).padStart(11)}${String(r.nodes).padStart(7)}`+
  `${r.frame.toFixed(3).padStart(11)}${r.step.toFixed(1).padStart(12)}${r.p90.toFixed(1).padStart(13)}${mb(r.cache).padStart(11)}`);
