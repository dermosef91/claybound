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

// Reproduce the canyon's draw passes after a blurred chapter, at the opening
// and both windwells. The canyon takes the strong blur: its formations draw
// alone into the offscreen target, that target is blurred across into a
// second, and the frame pass draws the playfield over the composite quad with
// only the near rank of buttes — the backdrop group marked sharp — beside it.
// Where to stand is read off the chapter's own landmarks rather than written
// down, so a reprofiled canyon is still sampled at its basin and every one of
// its windwells — the two on the climb and the Boulder Drop's mill — instead
// of quietly skipping them.
const centre=s=>s.x+s.w/2;
const sampled=(()=>{
  const g=new Game();g.start(0);
  const mills=g.level.platforms.filter(s=>s.landmark==='windmill');
  const basin=g.level.platforms.find(s=>s.landmark==='sandwheel');
  assert.equal(mills.length,3,'the canyon raises three windwells');assert(basin,'and one eroded basin');
  return [g.level.spawn.x+2.5,centre(basin),...mills.map(centre),centre(g.level.platforms.find(s=>s.goal))];
})();
for(const x of sampled){
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
    calls.push({target,scene,back:w.backRoot.visible,path:w.levelRoot.visible,formations,composite:w.citadelDepth?.quad.visible,
      sharpOnly:w.backRoot.children.every(o=>o.visible===!!o.userData.sharp)});
  };
  w.render(g,1/60);w.renderer.render=render;w.renderer.setRenderTarget=setTarget;
  assert.equal(calls.length,3,'the backdrop into the target, blurred across, then the frame');
  const [backdrop,across,frame]=calls;
  assert(backdrop.target?.isWebGLRenderTarget&&backdrop.scene===w.scene&&backdrop.back&&!backdrop.path&&!backdrop.composite,'the formations draw alone into the offscreen target');
  assert(backdrop.formations>=2);
  assert(across.target?.isWebGLRenderTarget&&across.target!==backdrop.target&&across.scene!==w.scene,'the target is blurred across into a second one');
  assert.equal(frame.target,null);assert(frame.path&&frame.composite,'the playfield draws over the composite');
  assert(frame.back&&frame.sharpOnly,'only the near rank of buttes draws sharp beside it');
  assert(w.backRoot.children.every(o=>o.visible),'every backdrop group is visible again afterwards');
  assert(!w.scene.getObjectByName('Clay cottage with laundry'),'no blue cottages anywhere in the canyon');
  if(floor?.landmark==='sandwheel')assert(w.levelRoot.getObjectByName('Eroded sandstone basin'),'the sinking shortcut has its own ruin landmark');
  if(floor?.landmark==='windmill'){
    const mill=w.levelRoot.getObjectByName('Autumn clay windmill');assert(mill);
    const rotor=mill.getObjectByName('Rotating clay sails'),origin=rotor.position.clone();const turn=rotor.rotation.z;
    g.tick(1/30);w.render(g,1/30);assert(rotor.rotation.z>turn);assert(rotor.position.equals(origin));
    g.pause();w.render(g,.2);assert.equal(rotor.rotation.z,g.time*.7,'pause freezes sails');
  }
}
assert.equal(sharedDisposals,0);
console.log('PASS canyon formations through the blurred composite with the near rank sharp, chapter return, no canyon cottages, two functional windmills, sandstone basin, stable rotor hubs and pause');

{
  const g=new Game();g.start(0);
  // Wherever the crossing is authored, not where it once was.
  const span=g.level.platforms.find(s=>s.id==='arch-drop'),at=centre(span);
  w.build(g.level,0,at);
  const bridge=()=>w.platforms.get('arch-drop')?.root;
  assert.equal(bridge().name,'Clay rope bridge');
  assert(bridge().getObjectByName('Bridge rope knot'));
  const uniqueGeometry=new Set();bridge().traverse(o=>{if(o.geometry&&!w.assetGeometry.has(o.geometry)&&!w.baseGeometry.has(o.geometry))uniqueGeometry.add(o.geometry);});
  let disposed=0;for(const geometry of uniqueGeometry)geometry.addEventListener('dispose',()=>disposed++);
  w.syncVisible(g.level,g.level.spawn.x,true);assert(!bridge());assert.equal(disposed,uniqueGeometry.size,'streamed rope tubes are released');
  w.syncVisible(g.level,at,true);assert.equal(bridge().name,'Clay rope bridge');
  w.refreshEditor(g.level,at);assert(bridge().getObjectByName('Bridge anchor post'));
  assert.equal(sharedDisposals,0,'bridge streaming retains shared clay assets');
}
console.log('PASS rope bridge streaming, geometry disposal, return and editor rebuild');

{
  const g=new Game();g.start(0);const before=JSON.stringify(g.level);
  const platform=g.level.platforms.find(s=>s.id==='arch-entry'),at=centre(platform);
  w.build(g.level,0,at);
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
  checkTent();w.syncVisible(g.level,g.level.spawn.x,true);assert(!w.levelRoot.getObjectByName('Canyon tent'));
  w.syncVisible(g.level,at,true);checkTent();w.refreshEditor(g.level,at);checkTent();
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

// The ropeway drawn between ticks: the frame loop passes how far it falls into
// the next tick, and the trolley, its rider and their shadow are drawn that
// far between their last two poses, while the masts and cable — pushed back by
// the deck's drawn position — stay exactly where the world has them. Without
// an alpha, the picture is the simulated tick, to the bit.
{
  const g=new Game();g.start(0);g.level.enemies=[];g.level.crushers=[];
  const t=g.level.platforms.find(s=>s.kind==='zip'),p=g.player;
  Object.assign(p,{x:t.x+t.w/2,y:t.y,vx:0,vy:0,groundId:t.id,coyote:.13,invuln:0});
  w.build(g.level,0,t.x);
  for(let i=0;i<120;i++)g.tick(1/120,{});
  assert.equal(p.groundId,t.id);assert(t.x>t.prevX&&t.y<t.prevY,'the trolley is moving');
  assert(p.x>p.prevX,'and carrying its rider');
  const view=w.platforms.get(t.id),hero=w.character.root;
  w.render(g,1/120,false,.5);
  assert(Math.abs(view.root.position.x-(t.prevX+t.x)/2)<1e-9&&Math.abs(view.root.position.y-(t.prevY+t.y)/2)<1e-9,'the trolley is drawn half a tick behind');
  assert(Math.abs(view.root.position.x+view.span.position.x-t.baseX)<1e-9&&Math.abs(view.root.position.y+view.span.position.y-t.baseY)<1e-9,'the masts and cable stay at the near mast');
  assert(Math.abs(hero.position.x-(p.prevX+p.x)/2)<1e-9&&Math.abs(hero.position.y-(p.prevY+p.y)/2)<1e-9,'the rider is drawn with the deck');
  assert(Math.abs(hero.position.x-view.root.position.x-(p.x-t.x))<1e-9,'and stands where they stand on it');
  assert(Math.abs(w.character.shadow.position.y-(view.root.position.y+.1))<1e-9,'their shadow sits on the drawn deck');
  w.render(g,1/120);
  assert.equal(view.root.position.x,t.x);assert.equal(view.root.position.y,t.y);
  assert.equal(hero.position.x,p.x);assert.equal(hero.position.y,p.y,'no alpha draws the tick as it stands');
  assert.equal(view.span.position.x,t.baseX-t.x);
  const was=p.prevX;p.prevX=p.x-40;w.render(g,1/120,false,.5);
  assert.equal(hero.position.x,p.x,'a rider who teleported is drawn where they landed');
  p.prevX=was;
  w.render(g,1/120,false,1);
  assert.equal(hero.position.x,p.x);assert.equal(view.root.position.x,t.x,'alpha 1 is the simulated pose too');
}
assert.equal(sharedDisposals,0);
console.log('PASS the ropeway and its rider are drawn between ticks, the cable stays still, alpha 1 is the simulated pose, and a teleport is not lerped');

// The canyon's crumbling ledges are the chapter's own clay — a cracked golden
// cap over a broken orange lower layer, seam grains and chips in the same
// palette — not the grey porous stone the later chapters break underfoot. The
// grey slots are still made, since the blight in the Wildwood borrows them.
{
  const {CLAY_PALETTE}=await import('../dist/palette.js');
  const g=new Game();g.start(0);g.level.enemies=[];g.level.crushers=[];
  const s=g.level.platforms.find(q=>q.id==='sand1');
  Object.assign(g.player,{x:s.x+s.w/2,y:s.y,vx:0,vy:0,groundId:s.id,coyote:.13,invuln:0});
  w.build(g.level,0,s.x);
  const view=w.platforms.get(s.id),pieces=view.fracture.pieces;
  assert.equal(view.root.name,'Fractured clay platform');
  const caps=pieces.filter(q=>q.layer===0&&!q.grain),lower=pieces.filter(q=>q.layer===1),grains=pieces.filter(q=>q.grain);
  assert(caps.length>1&&lower.length>0&&grains.length>0,'two fractured layers and loose grains');
  assert(caps.every(q=>q.mesh.material===w.mat.top&&q.mesh.name==='Cracked golden cap'),'the cap is the chapter\'s light clay');
  assert(lower.every(q=>q.mesh.material===w.mat.terrain&&q.mesh.name==='Broken lower clay layer'),'over its darker terrain');
  assert(grains.every(q=>q.mesh.material===w.mat.top),'and the grains match the cap');
  assert.equal(w.mat.top.color.getHex(),CLAY_PALETTE.orangeLight);assert.equal(w.mat.terrain.color.getHex(),CLAY_PALETTE.orange);
  const grey=[w.mat.crumbleGrey,w.mat.crumbleLower,w.mat.crumbleChip];
  assert(pieces.every(q=>!grey.includes(q.mesh.material)),'nothing on a canyon ledge is the grey stone');
  assert(w.mat.crumbleGrey&&w.mat.crumbleGrey.color.getHex()===0x606063,'the blight\'s stone is still there to borrow');
  // Warning crumbs while it shakes, and the debris when it goes, in the same clay.
  const chips=()=>w.particles.filter(q=>q.kind==='clay-chip').map(q=>q.mesh.material);
  w.particles.length=0;s.timer=.3;w.render(g,1/60);
  assert(chips().length>0&&chips().every(m=>m===w.mat.top||m===w.mat.terrain),'warning crumbs are orange clay');
  w.particles.length=0;w.event({type:'crumble-collapse',platformId:s.id,x:s.x+s.w/2,y:s.y,w:s.w});
  assert(chips().length>0&&chips().every(m=>m===w.mat.top||m===w.mat.terrain),'and so is the collapse debris');
  w.particles.length=0;
  // The Wildwood's ledges are the grey stone, as before.
  const f=new Game();f.start(1);const fs=f.level.platforms.find(q=>q.kind==='crumble');
  w.build(f.level,1,fs.x);
  const fv=w.platforms.get(fs.id);
  assert.equal(fv.root.name,'Porous grey crumbling ledge');
  assert(fv.fracture.pieces.filter(q=>q.layer===0&&!q.grain).every(q=>q.mesh.material===w.mat.crumbleGrey),'the forest keeps the grey stone');
}
assert.equal(sharedDisposals,0);
console.log('PASS canyon ledges are the chapter\'s orange clay, crumbs and debris included; the grey porous stone stays for the chapters after it');
