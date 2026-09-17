// Each chapter's world, built and rebuilt: the terrain palette, the supplied
// models that must survive a chapter change, valid geometry, the hero's
// landing and shake response, and streaming forward and back along the route.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World,landTrauma,shakeAmplitude} from '../dist/world.js';
import {createHero,attachHero,animateHero,heroEvent,landSquash} from '../dist/hero.js';
import {prepareEnemyAsset,animateEnemy} from '../dist/enemies.js';
import {animateEnvironment} from '../dist/environments.js';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {CLAY_CACHE_BYTES} from '../dist/clay.js';
import {TitleScene} from '../dist/title-scene.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
const titleScene=new TitleScene(w);
const palettes=new Set();
for(let index=0;index<LEVELS.length;index++){
  const g=new Game();g.start(index);w.build(g.level,index);palettes.add(w.mat.top.color.getHex());
  titleScene.show();titleScene.update(1/60);assert.equal(w.character.root.parent,titleScene.foreground);
  titleScene.hide();assert.equal(w.character.root.parent,w.scene,'the same hero returns to each chapter');
  assert(w.depthViews.size>0);
  for(const view of w.depthViews.values()){
    assert.equal(view.parts.length,1,'only the foreground scenery band remains');
    assert(view.parts.every(p=>p.band==='foreground'&&p.z>3));
    view.root.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)assert(o.material.userData.clay,'side scenery retains clay surfaces');});
  }
  let sculptedBlocks=0,solidSurfaces=0;
  w.levelRoot.traverse(o=>{
    if(!o.isMesh||!o.material.isMeshStandardMaterial||o.material.transparent)return;
    assert(o.material.userData.clay,'solid material must use the supplied clay');
    assert(!o.geometry.userData.claySource,'retired cube atlas is not used');
    if(o.geometry.userData.clayRelief)sculptedBlocks++;
    if(o.material.userData.clay.type==='authored'){
      assert(w.assetMaterials.has(o.material),'authored surfaces retain their supplied material');
      assert(o.material.map?.isTexture,'authored surfaces retain their supplied color map');
    }else assert(o.material.bumpMap===w.clay.detail);
    solidSurfaces++;
  });
  // Imported cottages replace several of the former source-cube hut blocks;
  // validate continued use, independently of the number of decorative houses.
  assert(sculptedBlocks>0,'terrain retains sculpted relief geometry');assert(solidSurfaces>100);
  let meshes=0;const geometry=new Set();w.scene.traverse(o=>{if(o.isMesh){meshes++;assert(o.material?.isMaterial);geometry.add(o.geometry);}});
  for(const geo of geometry){for(const attribute of ['position','normal'])for(const value of geo.attributes[attribute].array)assert(Number.isFinite(value));if(geo.index)assert(geo.index.array.every(i=>i<geo.attributes.position.count));}
  for(let frame=0;frame<120;frame++){g.tick(1/120,{right:true,jumpHeld:true,jumpPressed:frame===15});w.time+=1/120;animateHero(w,g,1/120);animateEnvironment(w,1/120);for(const e of g.level.enemies)animateEnemy(w.enemyViews.get(e.id),e,1/120,g.status);}
  assert(w.character.root.position.toArray().every(Number.isFinite));w.character.root.updateMatrixWorld(true);
  w.character.asset.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
  // A landing deforms the body on the frame it touches down, and keeps scaling
  // all the way to the hardest arrival the chapters ask for rather than
  // saturating halfway up the range the levels use.
  heroEvent(w.character,{type:'land',impact:11});const softLanding=w.character.spring;
  heroEvent(w.character,{type:'land',impact:25});const hardLanding=w.character.spring;
  assert.equal(softLanding,landSquash(11),'the squash peak is on the frame of contact');
  assert.equal(hardLanding,landSquash(25));
  assert(hardLanding>softLanding*1.8,'a harder arrival squashes distinctly further');
  // Shake reads that same speed, with no threshold to fall either side of, and
  // squaring the trauma keeps a heavy landing clearly apart from a light one.
  w.trauma=0;w.addTrauma(landTrauma(11));const lightShake=shakeAmplitude(w.trauma);
  w.trauma=0;w.addTrauma(landTrauma(25));const heavyShake=shakeAmplitude(w.trauma);
  assert(lightShake>0,'an ordinary landing still moves the frame at all');
  assert(heavyShake/lightShake>3,'and a heavy one moves it several times as far');
  w.trauma=0;w.addTrauma(.7);w.addTrauma(.7);assert.equal(w.trauma,1,'impacts accumulate, and stay inside the model');
  heroEvent(w.character,{type:'land',impact:20});
  let rebound=0;for(let frame=0;frame<180;frame++){w.time+=1/120;animateHero(w,g,1/120);rebound=Math.min(rebound,w.character.spring);}
  assert(rebound<-.01,'the body springs back past its resting height');
  assert(Math.abs(w.character.spring)<.01,'and comes to rest');
  if(index===2)assert(w.torches.length>=1);
  let clouds=0;w.backRoot.traverse(o=>{if(o.name==='Ivory cloud'){clouds++;assert(o.scale.x===o.scale.y&&o.scale.y===o.scale.z);const box=new THREE.Box3().setFromObject(o,true),size=box.getSize(new THREE.Vector3());assert(size.z>size.x*.3,'clouds retain their full model depth');}});if(index===0||index===3)assert(clouds>0);
  console.log(`PASS ${g.level.short}: ${meshes} meshes, ${sculptedBlocks} sculpted clay forms, ${solidSurfaces} treated solid surfaces, valid geometry and animation`);
  let maxPlatforms=0,maxViews=0,maxCache=0,maxCacheBytes=0;
  for(const x of [...g.level.sections.map(s=>s.x+25),g.level.end,...g.level.sections.map(s=>s.x).reverse()]){
    w.syncVisible(g.level,x,true);w.cameraX=x;w.cameraY=g.level.sections.findLast(s=>x>=s.x)?.id*2+2;animateEnvironment(w,0);
    const floor=g.level.platforms.find(s=>x>=s.x&&x<=s.x+s.w);Object.assign(g.player,{x,y:floor?.y??12});w.render(g,1/60);
    assert(w.camera.position.toArray().every(Number.isFinite));assert.equal(w.backRoot.visible,true);
    maxPlatforms=Math.max(maxPlatforms,w.platforms.size);maxViews=Math.max(maxViews,w.streamViews.size);maxCache=Math.max(maxCache,w.clay.boxes.size);maxCacheBytes=Math.max(maxCacheBytes,w.clay.bytes);
    assert([...w.platforms.values()].every(v=>v.root.parent===w.levelRoot));assert([...w.enemyViews.values()].every(v=>v.loaded));
    assert(w.platforms.size<45,'streaming retains only nearby platforms');assert(w.streamViews.size<180,'render region must not grow with level length');
    let cached=0;for(const [,geo]of w.clay.boxes){cached+=geo.index?geo.index.array.byteLength:0;for(const a of Object.values(geo.attributes))cached+=a.array.byteLength;}
    assert.equal(cached,w.clay.bytes,'the cache tracks the memory it actually holds');
    assert(cached<CLAY_CACHE_BYTES*1.6,'unused geometry cache stays bounded by memory, not by a shape count');
    assert.equal(w.depthRoot.children.length,w.depthViews.size,'removed scenery leaves no orphan groups');
    for(const views of [w.coinViews,w.stampViews,w.crusherViews])for(const view of views)if(view)assert.equal(view.parent,w.levelRoot);
  }
  console.log(`PASS ${g.level.short} forward/backward streaming: max ${maxPlatforms} platforms, ${maxViews} views, ${maxCache} cached clay shapes holding ${(maxCacheBytes/1048576).toFixed(1)} MB`);
}
assert.equal(palettes.size,LEVELS.length);console.log('PASS every chapter has its own terrain palette and repeated world rebuilds succeed');
for(const index of [0,3,2,3]){const g=new Game();g.start(index);w.build(g.level,index);assert([...w.enemyViews.values()].every(v=>v.loaded));}
assert.equal(sharedDisposals,0,'level changes must retain shared castle and enemy resources');
let castles=0;w.backRoot.traverse(o=>{if(o.name==='Cloudtop Kingdom')castles++;});assert(castles>0);
console.log('PASS supplied clouds, castle skyline and animated enemies survive streaming and chapter changes without disposing shared assets');
