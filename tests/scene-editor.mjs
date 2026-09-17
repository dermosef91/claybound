// The editor shares the play scene and swaps the camera. Refreshing geometry
// must keep the loaded clay assets and the expensive backdrop, and the posts
// that mark the route must stay on real decks through every edit.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {animateDepthScenery,depthPlacement} from '../dist/depth-scenery.js';
import {cameraTarget,cameraFraming,VERTICAL_BIAS} from '../dist/camera.js';
import {repairDraft} from '../dist/editor-model.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
// The editor uses the same scene with its own orthographic camera. Refreshing
// geometry must not destroy the loaded clay assets or the expensive backdrop.
const editorCamera={x:110,y:15,viewH:24};w.setEditorCamera(editorCamera);
for(const index of [0,1,2,3]){
  const g=new Game();g.start(index);g.status='editing';w.build(g.level,index,editorCamera.x);
  const backdrop=w.backRoot.children.map(o=>o.uuid),floor=g.level.platforms.find(p=>p.x>105&&p.x<120);
  floor.w+=1;floor.x+=.5;floor.baseX=floor.x;floor.y+=.5;floor.baseY=floor.y;
  w.refreshEditor(g.level,editorCamera.x);w.render(g,1/60);w.camera.updateMatrixWorld(true);
  assert.deepEqual(w.backRoot.children.map(o=>o.uuid),backdrop);
  assert.equal(w.camera.position.x,editorCamera.x);assert.equal(w.camera.position.y,editorCamera.y);assert.equal(w.viewH,24);
  assert(!w.depthRoot.visible,'decorative foreground does not obstruct editing');
  // Decoration mode is the exception: it wants those props on screen, placed
  // and held opaque, because a prop that fades under whatever the cursor is
  // over is a prop nobody can position. The fade belongs to play.
  for(const view of w.depthViews.values())for(const part of view.parts){part.opacity=.1;for(const m of part.materials){m.transparent=true;m.opacity=.1;}}
  w.setEditorScenery(true);w.render(g,1/60);
  assert(w.depthRoot.visible,'decorating puts the foreground props back on screen');
  for(const view of w.depthViews.values())for(const part of view.parts){
    assert.equal(part.opacity,1);assert(part.materials.every(m=>!m.transparent&&m.opacity===1));
    assert.equal(part.root.position.x,depthPlacement(part.anchor,w.cameraX,w.cameraY,part.z).x,'and places them against the editor camera');
  }
  w.setEditorScenery(false);w.render(g,1/60);assert(!w.depthRoot.visible);
  const center=new THREE.Vector3(editorCamera.x,editorCamera.y,0).project(w.camera);assert(Math.abs(center.x)<1e-7&&Math.abs(center.y)<1e-7);
  assert(w.platforms.has(floor.id));assert(!w.platforms.has('start'));assert.equal(w.platforms.get(floor.id).root.position.y,floor.y);
}
// Derived, not hard-coded: this asserts the editor hands the frame back to
// normal play framing, whatever that framing currently is.
w.setEditorCamera(null);assert.equal(w.viewH,cameraFraming(900,600,w.biome).viewH);assert.equal(sharedDisposals,0);
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
