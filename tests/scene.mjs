import {prepareSporeAsset} from '../dist/spore-puff.js';
import {prepareMotherPuff} from '../dist/mother-puff.js';
import {prepareBatAsset} from '../dist/bats.js';
// CPU-side geometry validation. This does not claim to test GPU rendering.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createHero,attachHero,animateHero,heroEvent} from '../dist/hero.js';
import {readPlayer,readGLB} from './load-player.mjs';
import {prepareEnemyAsset,animateEnemy} from '../dist/enemies.js';
import {prepareCastleAsset} from '../dist/castle.js';
import {prepareCottageAsset} from '../dist/cottage.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {readFile} from 'node:fs/promises';
import {animateEnvironment} from '../dist/environments.js';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {attachClay} from './load-clay.mjs';
import {CLAY_CACHE_BYTES} from '../dist/clay.js';
import {attachCanyon} from './load-canyon.mjs';
import {attachWindmills} from './load-windmills.mjs';
import {attachForest} from './load-forest.mjs';
import {attachSpitter} from './load-spitter.mjs';
import {attachGrotto} from './load-grotto.mjs';
import {animateDepthScenery} from '../dist/depth-scenery.js';
import {cameraTarget} from '../dist/camera.js';
import {createCaveLights} from '../dist/cave-lighting.js';
import {attachDrifter} from './load-drifter.mjs';
import {repairDraft} from '../dist/editor-model.js';
import {animateForest} from '../dist/forest-details.js';
import {animateCircuit} from '../dist/mechanism-views.js';
import {TitleScene} from '../dist/title-scene.js';
import {prepareTitleMesa} from '../dist/title-assets.js';
import {prepareCityLaundry} from '../dist/city-laundry.js';
const w=Object.create(World.prototype);
w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
w.camera=new THREE.OrthographicCamera(-6,6,3.3,-3.3,.1,160);
// Exercise scene updates without claiming GPU drawing or shader compilation.
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
await attachCanyon(w);
await attachWindmills(w);
await attachForest(w);
await attachGrotto(w);
await attachDrifter(w);
prepareSporeAsset(w,await readGLB(new URL('../dist/assets/spore-puff.glb',import.meta.url)));
await attachClay(w);
for(const pose of ['idle','cast'])prepareMotherPuff(w,pose,await readGLB(new URL(`../dist/assets/mother-puff-${pose}.glb`,import.meta.url)));
await attachSpitter(w);
prepareTitleMesa(w,await readGLB(new URL('../dist/assets/title/cactus-mesa.glb',import.meta.url)));
const titleScene=new TitleScene(w);
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
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
  heroEvent(w.character,{type:'land',impact:20});for(let frame=0;frame<180;frame++){w.time+=1/120;animateHero(w,g,1/120);}assert(Math.abs(w.character.spring)<.01);
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

// The editor uses the same scene with its own orthographic camera. Refreshing
// geometry must not destroy the loaded clay assets or the expensive backdrop.
w.canvas={getBoundingClientRect:()=>({width:900,height:600})};w.renderer.setSize=()=>{};
const editorCamera={x:110,y:15,viewH:24};w.setEditorCamera(editorCamera);
for(const index of [0,1,2,3]){
  const g=new Game();g.start(index);g.status='editing';w.build(g.level,index,editorCamera.x);
  const backdrop=w.backRoot.children.map(o=>o.uuid),floor=g.level.platforms.find(p=>p.x>105&&p.x<120);
  floor.w+=1;floor.x+=.5;floor.baseX=floor.x;floor.y+=.5;floor.baseY=floor.y;
  w.refreshEditor(g.level,editorCamera.x);w.render(g,1/60);w.camera.updateMatrixWorld(true);
  assert.deepEqual(w.backRoot.children.map(o=>o.uuid),backdrop);
  assert.equal(w.camera.position.x,editorCamera.x);assert.equal(w.camera.position.y,editorCamera.y);assert.equal(w.viewH,24);
  assert(!w.depthRoot.visible,'decorative foreground does not obstruct editing');
  const center=new THREE.Vector3(editorCamera.x,editorCamera.y,0).project(w.camera);assert(Math.abs(center.x)<1e-7&&Math.abs(center.y)<1e-7);
  assert(w.platforms.has(floor.id));assert(!w.platforms.has('start'));assert.equal(w.platforms.get(floor.id).root.position.y,floor.y);
}
w.setEditorCamera(null);assert.equal(w.viewH,8.7);assert.equal(sharedDisposals,0);
console.log('PASS editor camera, streamed modified foreground, retained backgrounds/assets, and normal camera restoration');

// Posts must remain on real decks after streaming, movement and editor changes.
let signs=0;
for(let index=0;index<4;index++){
  const g=new Game();g.start(index);w.build(g.level,index);
  for(const guide of g.level.guides){
    const p=g.level.platforms.find(p=>p.id===guide.platformId);assert(p,'every sign has a supporting platform');
    Object.assign(g.player,{x:p.x+p.w/2,y:p.y});w.syncVisible(g.level,p.x,true);
    p.active=true;w.render(g,0);
    const view=w.platforms.get(p.id),sign=view.guides.find(s=>Math.abs(s.position.x-guide.offset)<.001);
    assert(sign&&sign.parent===view.root);w.scene.updateMatrixWorld(true);
    const post=new THREE.Box3().setFromObject(sign.children[0],true);
    assert(Math.abs(post.min.y-p.y)<.13,'the post reaches the platform top');
    assert(post.min.x>=p.x&&post.max.x<=p.x+p.w,'post is inside the deck edges');
    const before=sign.getWorldPosition(new THREE.Vector3());p.x+=.5;p.y+=.7;
    w.render(g,0);const after=sign.getWorldPosition(new THREE.Vector3());
    assert(Math.abs(after.x-before.x-.5)<1e-6&&Math.abs(after.y-before.y-.7)<1e-6,'sign travels with its deck');
    p.active=false;w.render(g,0);assert(!sign.visible,'a vanished bridge leaves no hovering sign');
    p.active=true;p.broken=true;w.render(g,0);assert(!sign.visible,'a broken seal leaves no sign');p.broken=false;
    signs++;
  }
  const guide=g.level.guides[0],p=g.level.platforms.find(p=>p.id===guide.platformId);
  p.w=.7;p.x+=2;p.baseX=p.x;p.y+=1;p.baseY=p.y;
  w.refreshEditor(g.level,p.x);const sign=w.platforms.get(p.id).guides[0];
  assert(sign.position.x>=.3&&sign.position.x<=p.w-.3,'editor resizing keeps the post inside the narrower deck');
  g.level.platforms=g.level.platforms.filter(s=>s!==p);repairDraft(g.level);w.refreshEditor(g.level,p.x);
  w.levelRoot.traverse(o=>assert(o.userData.platformId!==p.id,'deleting a platform removes its sign'));
}
assert.equal(signs,LEVELS.reduce((n,l)=>n+l.guides.length,0));console.log('PASS all authored grounded direction signs, platform movement, disappearing decks, editor resizing/deletion and streaming');

{
  const g=new Game();g.start(3);w.build(g.level,3);
  const levelBefore=JSON.stringify(g.level),start=w.depthViews.get('start');
  const front=start.parts.find(p=>p.band==='foreground');
  assert(!w.depthRoot.getObjectByName('Clay cottage with laundry'),'the very front foreground contains no huts');
  assert(w.levelRoot.getObjectByName('Clay cottage with laundry'),'main rooftop huts use the supplied cottage');
  animateDepthScenery(w,g,0);assert(w.depthRoot.visible);assert.equal(front.opacity,1);
  const xFront=front.root.position.x;
  w.cameraX+=2;animateDepthScenery(w,g,0);
  assert(front.root.position.x<xFront,'foreground crosses the view faster than the play lane');
  assert(front.root.scale.x>1,'foreground retains its closer apparent scale');
  const originalPlayer={x:g.player.x,y:g.player.y};
  Object.assign(g.player,{x:front.root.position.x,y:front.root.position.y-.65});
  animateDepthScenery(w,g,0);assert.equal(front.opacity,.1);
  assert(front.materials.every(m=>m.transparent&&!m.depthWrite));assert(front.meshes.every(m=>!m.castShadow));
  Object.assign(g.player,originalPlayer);animateDepthScenery(w,g,0);assert.equal(front.opacity,1);
  assert(front.materials.every(m=>!m.transparent&&m.depthWrite));
  assert.equal(JSON.stringify(g.level),levelBefore,'depth scenery never changes playable geometry or collectible state');
  const passes=[],render=w.renderer.render;
  w.renderer.render=()=>passes.push({side:w.depthRoot.visible,back:w.backRoot.visible,path:w.levelRoot.visible});
  w.render(g,1/60);w.renderer.render=render;
  assert.deepEqual(passes,[{side:false,back:true,path:false},{side:true,back:false,path:true}]);
  let disposed=0;for(const m of front.materials)m.addEventListener('dispose',()=>disposed++);
  w.syncVisible(g.level,g.level.end,true);assert.equal(disposed,front.materials.length);assert(!w.depthViews.has('start'));
  assert.equal(sharedDisposals,0);
}
console.log('PASS removed foreground huts and middle scenery, retained rooftop cottages, foreground parallax, player clearance fading, unchanged gameplay data and scenery disposal');

// Reproduce the canyon draw boundary after a blurred chapter, at the opening
// and both windwells. The actual formations must reach the default framebuffer
// together with gameplay, and the previous composite must stay hidden.
for(const x of [4,45,93,194,240]){
  const g=new Game();g.start(0);const floor=g.level.platforms.find(s=>x>=s.x&&x<=s.x+s.w);
  Object.assign(g.player,{x,y:floor?.y??22});w.build(g.level,0,x);
  let target='unset';const calls=[],render=w.renderer.render,setTarget=w.renderer.setRenderTarget;
  w.renderer.setRenderTarget=t=>{target=t;};
  w.renderer.render=(scene,camera)=>{
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let formations=0;w.backRoot.traverse(o=>{
      if(o.isMesh&&o.parent.parent?.name?.match(/^Canyon (arch|summit)$/)&&frustum.intersectsObject(o)){
        assert(o.material.visible&&o.material.opacity===1&&o.material.map&&o.material.normalMap);formations++;
      }
    });
    calls.push({target,back:w.backRoot.visible,path:w.levelRoot.visible,formations,composite:w.citadelDepth?.quad.visible});
  };
  w.render(g,1/60);w.renderer.render=render;w.renderer.setRenderTarget=setTarget;
  assert.equal(calls.length,1);assert.equal(calls[0].target,null);assert(calls[0].back&&calls[0].path&&!calls[0].composite);assert(calls[0].formations>=2);
  assert(!w.scene.getObjectByName('Clay cottage with laundry'),'no blue cottages anywhere in the canyon');
  if(x===93)assert(w.levelRoot.getObjectByName('Eroded sandstone basin'),'the sinking shortcut has its own ruin landmark');
  if([45,194].includes(x)){
    const mill=w.levelRoot.getObjectByName('Autumn clay windmill');assert(mill);
    const rotor=mill.getObjectByName('Rotating clay sails'),origin=rotor.position.clone();const turn=rotor.rotation.z;
    g.tick(1/30);w.render(g,1/30);assert(rotor.rotation.z>turn);assert(rotor.position.equals(origin));
    g.pause();w.render(g,.2);assert.equal(rotor.rotation.z,g.time*.7,'pause freezes sails');
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS canyon formations in the direct draw pass, chapter return, no canyon cottages, two functional windmills, sandstone basin, stable rotor hubs and pause');

{
  const g=new Game();g.start(0);w.build(g.level,0,180);
  const bridge=()=>w.platforms.get('arch-drop')?.root;
  assert.equal(bridge().name,'Clay rope bridge');
  assert(bridge().getObjectByName('Bridge rope knot'));
  const uniqueGeometry=new Set();bridge().traverse(o=>{if(o.geometry&&!w.assetGeometry.has(o.geometry)&&!w.baseGeometry.has(o.geometry))uniqueGeometry.add(o.geometry);});
  let disposed=0;for(const geometry of uniqueGeometry)geometry.addEventListener('dispose',()=>disposed++);
  w.syncVisible(g.level,10,true);assert(!bridge());assert.equal(disposed,uniqueGeometry.size,'streamed rope tubes are released');
  w.syncVisible(g.level,180,true);assert.equal(bridge().name,'Clay rope bridge');
  w.refreshEditor(g.level,180);assert(bridge().getObjectByName('Bridge anchor post'));
  assert.equal(sharedDisposals,0,'bridge streaming retains shared clay assets');
}
console.log('PASS rope bridge streaming, geometry disposal, return and editor rebuild');

{
  const g=new Game();g.start(0);const before=JSON.stringify(g.level);
  w.build(g.level,0,145);
  const platform=g.level.platforms.find(s=>s.id==='arch-entry');
  const checkTent=()=>{
    w.scene.updateMatrixWorld(true);
    const landmark=w.platforms.get(platform.id).root.getObjectByName('Landmark: arch');
    assert.equal(landmark.children.length,1,'the source tent replaces all placeholder parts');
    const tent=landmark.getObjectByName('Canyon tent');assert(tent);
    const box=new THREE.Box3().setFromObject(tent,true);
    assert(Math.abs(box.min.y-platform.y)<1e-5,'tent feet meet the platform');
    assert(Math.abs(box.max.y-box.min.y-3.9)<1e-5,'the tent is never stretched like a distant formation');
    assert(box.min.x>platform.x&&box.max.x<platform.x+platform.w);
    assert(box.min.z>-1.81&&box.max.z<-.4,'the full model sits on the rear of the deck, clear of the play plane');
    let triangles=0;tent.traverse(o=>{if(o.isMesh){triangles+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry));assert(o.castShadow&&o.receiveShadow);}});
    assert.equal(triangles,10388,'supplied tent topology is intact');
  };
  checkTent();w.syncVisible(g.level,10,true);assert(!w.levelRoot.getObjectByName('Canyon tent'));
  w.syncVisible(g.level,145,true);checkTent();w.refreshEditor(g.level,145);checkTent();
  assert.equal(JSON.stringify(g.level),before,'tent replacement does not change collision or checkpoint data');
}
for(let index=0;index<LEVELS.length;index++){
  const g=new Game();g.start(index);w.build(g.level,index,g.level.end);
  const checkGoal=()=>{
    const goals=[],bells=[];w.levelRoot.traverse(o=>{if(o.name==='Chapter goal')goals.push(o);if(o.name==='Finish bell')bells.push(o);});
    assert.equal(goals.length,1);assert.equal(bells.length,1);assert.equal(w.bell,bells[0]);
    const bell=bells[0],cup=bell.getObjectByName('Golden bell cup'),clapper=bell.getObjectByName('Bell clapper');
    assert(cup&&clapper,'cup and clapper are attached to the ringing suspension');
    assert(cup.position.y<0&&clapper.position.y<cup.position.y,'the bell swings from its top');
    const flag=goals[0].getObjectByName('Star finish flag cloth');
    assert(w.flags.includes(flag)&&flag.getObjectByName('Raised golden star'),'the decorated flag keeps its wind animation');
    goals[0].traverse(o=>{if(o.isMesh)for(const key of ['position','normal'])assert(o.geometry.attributes[key].array.every(Number.isFinite),'finish geometry remains valid after rebuilds');});
    const platform=g.level.platforms.find(s=>s.goal),view=w.platforms.get(platform.id).root;
    assert(!view.getObjectByName('Landmark: bellgate'),'no second decorative bell or frame at the finish');
    assert(Math.abs(goals[0].getWorldPosition(new THREE.Vector3()).x-g.level.end)<1e-6);
  };
  w.scene.updateMatrixWorld(true);checkGoal();
  w.syncVisible(g.level,g.level.spawn.x,true);assert.equal(w.bell,null);
  w.syncVisible(g.level,g.level.end,true);w.scene.updateMatrixWorld(true);checkGoal();
  w.refreshEditor(g.level,g.level.end);w.scene.updateMatrixWorld(true);checkGoal();
}
assert.equal(sharedDisposals,0);
console.log('PASS textured canyon tent, grounded placement, retained source mesh, streaming/editor rebuilds, and exactly one animated finish bell per chapter');

for(const [index,stops]of [[1,[[4,0],[52,7.8],[101,8.1],[162,20],[260,33.4]]],[2,[[4,0],[53,5.2],[110,11.5],[215,20.5],[291,27.6]]]]){
  const g=new Game();g.start(index);w.build(g.level,index);const before=JSON.stringify(g.level);
  for(const [x,y]of [...stops,...stops.slice().reverse()]){
    w.syncVisible(g.level,x,true);w.cameraX=x;w.cameraY=y+2;animateEnvironment(w,0);w.scene.updateMatrixWorld(true);
    assert(!w.scene.getObjectByName('Clay cottage with laundry'),'forest and cave scenery contains no blue cottages');
    if(index===1){
      assert(w.depthRoot.getObjectByName('Forest hills'),'supplied mossy bushes form the foreground');
      assert(w.backRoot.getObjectByName('Forest grove')&&w.backRoot.getObjectByName('Forest falls'));
      assert.equal(w.parallax.find(p=>p.group.name==='Skybridge Falls skyline').factor,.18);
      const depths=['Forest grove','Forest falls'].map(name=>w.backRoot.getObjectByName(name).getWorldPosition(new THREE.Vector3()).z);
      assert(depths[1]<depths[0]&&depths[0]<-5);
      for(const [key,triangles]of [['hills',3126],['grove',10414],['falls',10254]]){
        let total=0;w.forestAssets[key].scene.traverse(o=>{if(o.isMesh){total+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);}});assert.equal(total,triangles);
      }
      assert(w.torchLights.every(l=>l.intensity===0),'cave illumination does not leak into the forest');
    }else{
      const models=[];w.backRoot.traverse(o=>{if(['Supplied glowing grotto','Supplied crystalcap cavern'].includes(o.name))models.push(o);});assert(models.length>=12&&models.length<=24,'layered scenery stays bounded');
      assert(models.some(m=>m.name==='Supplied glowing grotto')&&models.some(m=>m.name==='Supplied crystalcap cavern'));
      assert(!w.backRoot.getObjectByName('Broad stone bridge'),'the constructed arch is fully replaced');
      const distant=w.backRoot.getObjectByName('Distant cavern arches');assert(distant.children.length>=5);
      for(const chamber of distant.children){
        const model=chamber.getObjectByName('Supplied glowing grotto')||chamber.getObjectByName('Supplied crystalcap cavern');assert(model);
        assert.equal(model.scale.x,model.scale.y);assert.equal(model.scale.x,model.scale.z);
        model.traverse(o=>{if(o.isMesh){assert(w.assetGeometry.has(o.geometry));assert(o.material.map&&o.material.normalMap&&o.material.fog);}});
        assert(!w.torches.some(tr=>chamber.getObjectById(tr.flame.id)),'far haze models do not compete for nearby lights');
      }
      assert.equal(w.scene.fog.near,28);assert.equal(w.scene.fog.far,108);
      // Static backdrop cells are baked into one mesh per material and block of
      // space. Losing that merge multiplies the cave's draw calls and the world
      // matrices rebuilt every frame.
      let backdropMeshes=0;w.backRoot.traverse(o=>{if(o.isMesh)backdropMeshes++;});
      assert(backdropMeshes<350,`merged cave backdrop stays compact, held ${backdropMeshes} meshes`);
      for(const cell of w.backRoot.getObjectByName('Overhead cave silhouette').children){
        const merged=[];cell.traverse(o=>{if(o.name==='Merged cavern backdrop')merged.push(o);});
        assert(merged.length>0,'each overhead cell keeps its baked geometry');
        for(const mesh of merged)assert(mesh.geometry.attributes.position.count>0&&!mesh.castShadow);
      }
      for(const [key,triangles]of [['grotto',10120],['crystalcap',10382]])w.cavernAssets[key].scene.traverse(o=>{if(o.isMesh){assert(o.material.emissiveMap&&o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert.equal(o.geometry.index.count/3,triangles);}});
      for(const model of models)assert(model.getObjectByName('mushroom light anchor')&&model.getObjectByName('crystal light anchor'));
      const active=w.torchLights.filter(l=>l.intensity>0),colours=active.map(l=>l.color.getHex());
      assert(active.length<=4);assert.equal(w.torchLights.length,4);assert(colours.includes(0xff962f)&&colours.includes(0x46bbff),'nearby orange and blue accents both receive matching light');
      assert(w.torches.length<75,'lighting fixtures remain bounded after streaming and backtracking');
      assert(active.every(l=>l.position.toArray().every(Number.isFinite)&&l.distance<=13));
      // The roof must remain continuous when its cells wrap and when the route
      // climbs. A gap here exposes the sky through an otherwise enclosed cave.
      const vault=w.backRoot.getObjectByName('Overhead cave silhouette'),ray=new THREE.Raycaster();assert(vault);
      for(let sample=0;sample<=10;sample++){
        ray.set(new THREE.Vector3(w.cameraX+(sample/10-.5)*(w.viewW||18),w.cameraY+8,4),new THREE.Vector3(0,0,-1));
        assert(ray.intersectObject(vault,true).length>0,'continuous cave ceiling through scrolling, climbing and backtracking');
      }
      // Reproduce the phone's blank-background failure at the actual draw
      // boundary, including returning from a chapter that used a blur target.
      // Mesh existence alone cannot prove they reach the displayed framebuffer.
      for(const [width,height]of [[1536,691],[691,1536]]){
        w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();
        Object.assign(g.player,{x,y});
        const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);
        w.cameraX=target.x;w.cameraY=target.y;
        let framebuffer='unset';const calls=[],render=w.renderer.render,setTarget=w.renderer.setRenderTarget;
        w.renderer.setRenderTarget=value=>{framebuffer=value;};
        w.renderer.render=(scene,camera)=>{
          scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
          const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
          const visible=name=>{
            let count=0;
            w.backRoot.getObjectByName(name).traverseVisible(o=>{if(o.isMesh&&frustum.intersectsObject(o)&&o.material.visible&&o.material.opacity>0)count++;});
            return count;
          };
          calls.push({framebuffer,back:w.backRoot.visible,path:w.levelRoot.visible,composite:w.citadelDepth?.quad.visible,
            vault:visible('Overhead cave silhouette'),arches:visible('Distant cavern arches'),grottos:visible('Lit grotto recesses')});
        };
        try{w.render(g,0);}finally{w.renderer.render=render;w.renderer.setRenderTarget=setTarget;}
        assert.equal(calls.length,1,'caverns render directly instead of using the failing offscreen composite');
        const draw=calls[0];assert.equal(draw.framebuffer,null);
        assert(draw.back&&draw.path&&!draw.composite,'cave scenery and platforms reach the same visible render pass');
        assert(draw.vault>0&&draw.arches>0&&draw.grottos>0,`cave forms visible at ${x},${y} in ${width}×${height}`);
      }
    }
  }
  w.refreshEditor(g.level,stops.at(-1)[0]);animateEnvironment(w,0);
  assert.equal(JSON.stringify(g.level),before,'the art pass preserves all platforming, mechanisms and saves');
}
assert.equal(sharedDisposals,0);
console.log('PASS supplied distant grotto arches, stronger cave fog, bounded light handoffs, and direct cavern draw coverage in portrait/landscape through climbs and backtracking');

// The Breathing Tree redesign must preserve the real spring and seal surfaces,
// remain visible through the camera pass, and stop ambient motion when paused.
{
  const g=new Game();g.start(1);w.build(g.level,1,118);
  for(const s of g.level.platforms.filter(p=>p.kind==='break')){
    w.syncVisible(g.level,s.x,true);w.scene.updateMatrixWorld(true);
    const root=w.platforms.get(s.id).root;assert.equal(root.name,'Stompable spore balloon');
    const pod=root.getObjectByName('Stompable seed');assert(pod);
    const b=new THREE.Box3().setFromObject(pod,true);
    assert(Math.abs(b.max.y-s.y)<.06&&Math.abs(b.min.x-s.x)<.06&&Math.abs(b.max.x-s.x-s.w)<.06,'every balloon matches its real seal collider');
  }
  w.syncVisible(g.level,118,true);
  Object.assign(g.player,{x:118,y:14});w.syncVisible(g.level,118,true);
  for(const s of g.level.platforms.filter(s=>s.kind==='spring')){
    w.syncVisible(g.level,s.x,true);w.scene.updateMatrixWorld(true);
    const mushroom=w.platforms.get(s.id).root.getObjectByName('Scarlet target spring');
    assert(mushroom);const box=new THREE.Box3().setFromObject(mushroom,true);
    assert(Math.abs(box.max.y-s.y)<.002,'the visible spring cap meets its collision top');
    assert(Math.abs(box.min.x-s.x)<.01&&Math.abs(box.max.x-s.x-s.w)<.01);
    const support=g.level.platforms.filter(p=>p.id!==s.id&&['stone','ledge'].includes(p.kind)&&s.x+s.w/2>=p.x&&s.x+s.w/2<=p.x+p.w&&p.y<s.y).sort((a,b)=>b.y-a.y)[0];
    assert(box.min.y>=support.y-.01,'the entire target pad remains above its supporting deck');
    assert(box.max.y-box.min.y>Math.min(.39,(s.y-support.y)*.95),'the spring has a readable profile within its authored deck clearance');
    mushroom.traverse(o=>{if(o.isMesh)assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap,'the target retains its source maps');});
  }
  w.syncVisible(g.level,118,true);w.scene.updateMatrixWorld(true);
  const seal=g.level.platforms.find(s=>s.id==='tree-seal'),seed=w.platforms.get(seal.id).root.getObjectByName('Stompable seed');
  const bounds=new THREE.Box3().setFromObject(seed,true);
  assert(Math.abs(bounds.max.y-seal.y)<.06,'stompable pod matches the actual landing surface');
  assert(Math.abs(bounds.min.x-seal.x)<.06&&Math.abs(bounds.max.x-seal.x-seal.w)<.06,'no invisible wide seal remains');
  const circuit=[...w.circuitViews.values()].find(v=>v.c.source===seal.id);
  animateCircuit(circuit,g);assert(circuit.cable.visible&&circuit.leaves.every(l=>l.visible));
  assert(circuit.lamp.scale.x<.2,'a small circuit lamp never becomes a second pod');
  seal.broken=true;seal.active=false;g.channels[seal.releases]=1;g.latched[seal.releases]=true;
  animateCircuit(circuit,g);assert(!circuit.cable.visible&&circuit.leaves.every(l=>!l.visible));assert(circuit.beads.every(l=>l.visible));
  g.checkpointId='tree-heart';g.checkpoint={x:124.2,y:14};
  const restored=new Game();restored.start(1);restored.restore(g.snapshot());
  assert(restored.level.platforms.find(p=>p.id===seal.id).broken&&restored.channels[seal.releases]>0,'opened seed and spore current survive resume');
  const heart=w.platforms.get('tree-heart').root.children.find(o=>o.userData.breathing);assert(heart);
  const leaf=w.ambient.find(a=>a.leaf).mesh;g.time=1;animateForest(w,g);animateEnvironment(w,0);const first=heart.scale.x;
  g.time=2;animateForest(w,g);animateEnvironment(w,0);assert.notEqual(heart.scale.x,first);
  const pose=[heart.scale.toArray(),leaf.position.toArray(),leaf.rotation.toArray()];g.status='paused';g.tick(.5,{});animateForest(w,g);animateEnvironment(w,.5);
  assert.deepEqual([heart.scale.toArray(),leaf.position.toArray(),leaf.rotation.toArray()],pose);
  w.reducedMotion=true;animateForest(w,g);animateEnvironment(w,0);const quiet=leaf.position.toArray();g.time+=2;animateForest(w,g);animateEnvironment(w,0);
  assert.equal(heart.scale.x,1);assert.deepEqual(leaf.position.toArray(),quiet);w.reducedMotion=false;
  for(const [width,height]of [[1672,941],[941,1672]])for(const [x,y]of [[118,14],[112,19.2],[135,20.2]]){
    w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();Object.assign(g.player,{x,y});w.syncVisible(g.level,x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);w.cameraX=target.x;w.cameraY=target.y;w.render(g,0);w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));let trees=0;
    w.backRoot.traverseVisible(o=>{if(o.isMesh&&o.material.map&&frustum.intersectsObject(o))trees++;});
    assert(trees>1,'supplied trees cover the climbing camera in both orientations');
    assert(!w.levelRoot.getObjectByName('Clay cottage with laundry'),'forest retains no blue cottages');
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS Breathing Tree spring/pod contact, opened vine and checkpoint resume, pause/reduced motion, and forest coverage through portrait/landscape climbs');

// A forest visit must not detach or hide the canyon's supplied Drifter models.
{
  const forest=new Game();forest.start(1);w.build(forest.level,1,118);
  const g=new Game();g.start(0);w.build(g.level,0);
  for(const [width,height]of [[1536,691],[691,1536]])for(const e of g.level.enemies){
    w.canvas={getBoundingClientRect:()=>({width,height})};w.resize();
    Object.assign(g.player,{x:e.x-2,y:e.baseY-1.15});w.syncVisible(g.level,e.x,true);
    const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);w.cameraX=target.x;w.cameraY=target.y;w.render(g,0);
    w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
    const v=w.enemyViews.get(e.id);assert(v?.loaded&&v.kind==='drifter'&&v.root.visible&&v.model);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
    const bounds=new THREE.Box3().setFromObject(v.model,true);assert(frustum.intersectsBox(bounds));
    let meshes=0;v.model.traverseVisible(o=>{if(o.isMesh){meshes++;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(o.material.visible);}});assert(meshes>0);
    assert.equal(v.root.parent,w.levelRoot);assert(w.levelRoot.visible);
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS all four Dust Drifter models remain loaded and in view after forest-to-canyon changes, streaming and portrait/landscape framing');

// Verify the actual press head/frame, dynamic fracture meshes, and cleaned props.
{
  const g=new Game();g.start(3);w.build(g.level,3,105);w.syncVisible(g.level,120,true);
  const garden=w.platforms.get('garden'),laundry=w.platforms.get('laundry-entry');
  const huts=[],flags=[];garden.root.traverse(o=>{if(o.name==='Clay cottage with laundry')huts.push(o);});laundry.root.traverse(o=>{if(o.name==='Checkpoint flag')flags.push(o);});
  assert.equal(huts.length,1);assert.equal(flags.length,1);assert(flags[0].parent===laundry.root,'the front checkpoint flag is retained');
  const box=new THREE.Box3().setFromObject(huts[0],true);assert(box.max.x-box.min.x>3.5,'the larger cottage is retained');
}
{
  const g=new Game();g.start(2);g.onEvent=e=>w.event(e);Object.assign(g.player,{x:62,y:0,groundId:'ferry-dock'});w.build(g.level,2,77);
  const c=g.level.crushers[0],root=w.crusherViews[0],head=root.userData.press.head;
  let impacted=false;
  for(let i=0;i<600;i++){g.tick(1/120);w.render(g,1/120);if(c.state==='impact'){impacted=true;break;}}
  assert(impacted);assert.equal(root.position.y,c.baseY,'the housing stays fixed');assert.equal(head.position.y,c.y-c.baseY,'only the head follows the stroke');
}
{
  const g=new Game();g.start(0);w.build(g.level,0,30);const s=g.level.platforms.find(p=>p.kind==='crumble');w.syncVisible(g.level,s.x,true);const v=w.platforms.get(s.id);
  assert(v.fracture.pieces.length>=8);assert(v.fracture.pieces.some(p=>p.layer===1));
  Object.assign(g.player,{x:s.x+s.w/2,y:s.y});s.timer=.3;w.render(g,1/60);assert(w.particles.some(q=>q.kind==='clay-chip'),'the weakening ledge sheds crumbs');
  s.active=false;s.timer=(s.delay||.62)+.32;w.event({type:'crumble-collapse',x:s.x+s.w/2,y:s.y,w:s.w});w.render(g,1/60);
  assert(v.root.visible,'fragments remain visible while falling after collision stops');assert(v.fracture.pieces.some(p=>p.mesh.position.y<p.rest.y-.2));
  for(let i=0;i<30;i++)w.event({type:'crumble-collapse',x:s.x,y:s.y,w:s.w});assert(w.particles.length<=110,'debris stays within the shared particle budget');
  const snapshot=w.particles.map(q=>q.mesh.position.clone());w.updateParticles(0);assert(w.particles.every((q,i)=>q.mesh.position.equals(snapshot[i])));
  for(let i=0;i<150;i++)w.updateParticles(1/60);assert.equal(w.particles.length,0,'debris expires and leaves no live particle meshes');
  s.active=true;s.timer=0;w.render(g,0);assert(v.fracture.pieces.every(p=>p.mesh.position.equals(p.rest)),'reforming restores every chunk');
}
console.log('PASS anchored moving presses, visible spring targets, single front flag/larger cottage, fractured slabs, bounded debris, pause and recovery');

// The new scenery must remain grounded, behind the hero, and survive streaming
// without editing the gameplay layout or disposing its shared source model.
{
  const g=new Game();g.start(3);const before=JSON.stringify(g.level);
  const inspect=()=>{
    w.scene.updateMatrixWorld(true);
    const deck=g.level.platforms.find(s=>s.id==='laundry-entry');
    const view=w.platforms.get('laundry-entry').root;
    const nook=view.getObjectByName('Rooftop laundry nook');assert(nook);
    const box=new THREE.Box3().setFromObject(nook,true);
    assert(Math.abs(box.max.x-box.min.x-3.8)<1e-5);
    assert(box.min.x>deck.x&&box.max.x<deck.x+deck.w&&box.min.z>-1.81&&box.max.z<-.4,'entire laundry prop rests behind the player on its deck');
    assert(Math.abs(box.min.y-(deck.y+.015))<1e-5,'plinth is grounded');
    let triangles=0;nook.traverse(o=>{if(o.isMesh){triangles+=o.geometry.index.count/3;assert(w.assetGeometry.has(o.geometry)&&w.assetMaterials.has(o.material));}});
    assert(triangles>0&&triangles<=6000);
  };
  w.build(g.level,3,120);inspect();w.syncVisible(g.level,240,true);assert(!w.levelRoot.getObjectByName('Rooftop laundry nook'));
  w.syncVisible(g.level,120,true);inspect();w.refreshEditor(g.level,120);inspect();
  assert.equal(JSON.stringify(g.level),before);
}
console.log('PASS laundry bounds, grounding, face budget, shared assets, streaming/editor rebuild and unchanged collision data');

{
  for(const index of [2,3]){
    const g=new Game();g.start(index);w.build(g.level,index);
    for(const s of g.level.platforms){
      w.syncVisible(g.level,s.x+s.w/2,true);w.scene.updateMatrixWorld(true);
      const root=w.platforms.get(s.id)?.root;if(!root)continue;
      for(const prop of root.children.filter(o=>o.name.startsWith('Cavern story:')||['City story: ropeyard','City story: garden'].includes(o.name))){
        const box=new THREE.Box3().setFromObject(prop,true),halfDepth=s.kind==='ledge'?.9:1.755;
        assert(box.min.x>s.x&&box.max.x<s.x+s.w,prop.name+' fits the platform width');
        assert(box.min.z>-halfDepth&&box.max.z<-.25,prop.name+' stays on the rear of its supporting deck');
      }
    }
  }
}
console.log('PASS cave and city storytelling fits both broad decks and narrow balconies');

// Render adapters for the new cavern machines and bounded projectile pool.
{
  const g=new Game();g.start(2);w.build(g.level,2,136);g.level.enemies=[];
  const paddle=g.level.platforms.find(s=>s.id==='heart-paddle');
  Object.assign(g.player,{x:paddle.x+paddle.w/2,y:paddle.y,groundId:paddle.id,vx:0,vy:0});
  for(let i=0;i<120;i++){g.tick(1/120);w.render(g,1/120);}
  const v=w.platforms.get(paddle.id);assert(v.axle&&v.arm&&v.wheel);
  assert(Math.abs(v.root.position.x-paddle.x)<1e-8);assert(Math.abs(v.root.position.y-paddle.y)<1e-8);
  const axis=v.axle.getWorldPosition(new THREE.Vector3());assert(Math.abs(axis.x-paddle.baseX-paddle.w/2)<1e-6);assert(Math.abs(axis.y-paddle.baseY)<1e-6);
  const gate=g.level.platforms.find(s=>s.id==='heart-gate');g.activate(gate.channel,147.5,9.83);
  for(let i=0;i<80;i++){g.tick(1/120);w.render(g,1/120);}
  assert(!gate.active);const gv=w.platforms.get(gate.id);if(gv)assert(!gv.grate.visible);
  g.shots.push({id:900,x:g.player.x+1,y:g.player.y+1,vx:-6.5,vy:0,age:.2});w.render(g,0);
  assert.equal(w.shotViews.size,1);const shot=w.shotViews.get(900).root;assert(shot.getObjectByName('Supplied Echo crystal')&&shot.parent===w.fxRoot);
  g.pause();const position=shot.position.clone();w.render(g,.1);assert(shot.position.equals(position));g.resume();g.respawn();w.render(g,0);assert.equal(w.shotViews.size,0);
}
console.log('PASS cradle deck/axle transforms, visible opening grates, projectile shape, paused visuals and effect cleanup');

// The Great Arch is scenery with fixed ceiling attachments: it must not alter
// the route, hide the play lane, or dispose its source when streamed out.
{
  const g=new Game();g.start(0);const original=JSON.stringify(g.level);
  w.build(g.level,0,160);
  const inspect=()=>{
    w.scene.updateMatrixWorld(true);
    const room=w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave');assert(room);
    const shell=room.getObjectByName('Supplied sandstone cave');assert(shell);
    const box=new THREE.Box3().setFromObject(shell,true);
    assert(box.max.z<-2.59,'all supplied cave stone stays behind the play lane');
    assert(box.min.x<150&&box.max.x>176&&box.max.y>24,'the enclosure covers both banks and the flower route');
    let triangles=0;shell.traverse(o=>{if(o.isMesh){
      triangles+=o.geometry.index.count/3;
      assert(w.assetGeometry.has(o.geometry)&&w.assetMaterials.has(o.material));
      assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);
      assert(o.material.vertexColors&&o.material.userData.clay,'cavity shade survives clay load order');
      assert(o.geometry.attributes.color.array.every(n=>Number.isFinite(n)&&n>=.37&&n<=1));
    }});assert.equal(triangles,10440);
    const rear=room.getObjectByName('Recessed sandstone wall with sky windows');assert(rear.material.bumpMap===w.clay.detail);
    assert(new THREE.Box3().setFromObject(rear,true).max.z<box.min.z,'recess never masks the supplied sculpted wall');
    for(const id of ['arch-shelf','arch-balcony','arch-flower'])assert(w.platforms.get(id).root.getObjectByName('Sandstone ledge root'));
    return box;
  };
  const initial=inspect();assert.equal(JSON.stringify(g.level),original,'scenery leaves the authored physics and collectibles unchanged');
  const lift=g.level.platforms.find(s=>s.id==='arch-lift'),startY=lift.y;
  const endpoints=[];
  for(const y of [startY,startY+2.2,startY-2.2]){
    lift.y=y;Object.assign(g.player,{x:160,y,groundId:lift.id});w.render(g,0);w.scene.updateMatrixWorld(true);
    endpoints.push(w.platforms.get(lift.id).ropes.map(rope=>rope.localToWorld(new THREE.Vector3(0,rope.userData.ceiling.rest,0)).y));
  }
  for(const end of endpoints)for(let i=0;i<end.length;i++)assert(Math.abs(end[i]-endpoints[0][i])<1e-6,'lift motion never moves the ceiling end of its ropes');
  lift.y=startY;
  w.syncVisible(g.level,10,true);assert(!w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave'));
  w.syncVisible(g.level,160,true);inspect();w.refreshEditor(g.level,160);inspect();
  const roomCount=()=>w.levelRoot.children.filter(o=>o.name==='Inside the Great Arch: canyon cave').length;assert.equal(roomCount(),1);
  for(const s of g.level.platforms.filter(s=>s.id.startsWith('arch-'))){s.x+=12;s.baseX+=12;s.y+=3;s.baseY+=3;}
  w.refreshEditor(g.level,172);w.scene.updateMatrixWorld(true);
  const moved=new THREE.Box3().setFromObject(w.levelRoot.getObjectByName('Supplied sandstone cave'),true);
  assert(Math.abs(moved.min.x-initial.min.x-12)<1e-5&&Math.abs(moved.min.y-initial.min.y-3)<1e-5,'moving the section in the editor moves its enclosure');
  const forest=new Game();forest.start(1);w.build(forest.level,1,118);assert(!w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave'));
  g.start(0);w.build(g.level,0,160);inspect();assert.equal(sharedDisposals,0);
}
console.log('PASS Great Arch model/maps, cavity shade, clear play lane, fixed rope anchors, streaming, editor moves and chapter reuse');
