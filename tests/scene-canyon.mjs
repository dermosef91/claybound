// Sunbaked Canyon: the foreground scenery band, the formations drawn straight
// into the frame, the rope bridge, the supplied tent, and the finish bell.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {animateDepthScenery,depthPlacement} from '../dist/depth-scenery.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
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
