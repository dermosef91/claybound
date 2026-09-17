// Hanging Quarter: the presses and their fracture meshes, the laundry, and the
// storytelling props that have to fit both broad decks and narrow balconies.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
// Verify the actual press head/frame, dynamic fracture meshes, and cleaned props.
{
  const g=new Game();g.start(3);w.build(g.level,3,105);w.syncVisible(g.level,120,true);
  const garden=w.platforms.get('garden'),laundry=w.platforms.get('laundry-entry');
  const huts=[],flags=[];garden.root.traverse(o=>{if(o.name==='Clay cottage with laundry')huts.push(o);});laundry.root.traverse(o=>{if(o.name==='Checkpoint flag')flags.push(o);});
  assert.equal(huts.length,1);assert.equal(flags.length,1);assert(flags[0].parent===laundry.root,'the front checkpoint flag is retained');
  const box=new THREE.Box3().setFromObject(huts[0],true);assert(box.max.x-box.min.x>3.5,'the larger cottage is retained');
}
// A flag is the checkpoint mechanic, so the Hanging Quarter cannot wear one as scenery.
{
  const g=new Game();g.start(3);w.build(g.level,3);
  for(const s of g.level.platforms){
    w.syncVisible(g.level,s.x+s.w/2,true);
    const root=w.platforms.get(s.id)?.root;if(!root)continue;
    let flags=0;root.traverse(o=>{if(o.name==='Checkpoint flag')flags++;});
    assert.equal(flags,s.checkpoint?1:0,s.id+' carries a flag only if it holds a checkpoint');
  }
}
{
  const g=new Game();g.start(2);g.onEvent=e=>w.event(e);const dock=g.level.platforms.find(p=>p.id==='ferry-dock');Object.assign(g.player,{x:dock.x+2.25,y:0,groundId:dock.id});w.build(g.level,2,dock.x+17.25);
  const c=g.level.crushers[0],root=w.crusherViews[0],head=root.userData.press.head;
  let impacted=false;
  for(let i=0;i<600;i++){g.tick(1/120);w.render(g,1/120);if(c.state==='impact'){impacted=true;break;}}
  assert(impacted);assert.equal(root.position.y,c.baseY,'the housing stays fixed');assert.equal(head.position.y,c.y-c.baseY,'only the head follows the stroke');
}
{
  const g=new Game();g.start(1);w.build(g.level,1,30);const s=g.level.platforms.find(p=>p.kind==='crumble');w.syncVisible(g.level,s.x,true);const v=w.platforms.get(s.id);
  assert(v.fracture.pieces.length>=8);assert(v.fracture.pieces.some(p=>p.layer===1));
  const ledgeGrey=v.fracture.pieces.find(p=>p.layer===0).mesh.material.color.getHex();
  Object.assign(g.player,{x:s.x+s.w/2,y:s.y});s.timer=.3;w.render(g,1/60);assert(w.particles.some(q=>q.kind==='clay-chip'),'the weakening ledge sheds crumbs');
  assert(w.particles.every(q=>q.mesh.material.color.getHex()===ledgeGrey),'Wildwood warning crumbs match the grey ledge instead of its green palette');
  s.active=false;s.timer=(s.delay||.62)+.32;w.event({type:'crumble-collapse',x:s.x+s.w/2,y:s.y,w:s.w});w.render(g,1/60);
  assert(w.particles.every(q=>q.mesh.material.color.getHex()===ledgeGrey),'Wildwood collapse debris matches the grey ledge');
  assert(v.root.visible,'fragments remain visible while falling after collision stops');assert(v.fracture.pieces.some(p=>p.mesh.position.y<p.rest.y-.2));
  for(let i=0;i<30;i++)w.event({type:'crumble-collapse',x:s.x,y:s.y,w:s.w});assert(w.particles.length<=110,'debris stays within the shared particle budget');
  const snapshot=w.particles.map(q=>q.mesh.position.clone());w.updateParticles(0);assert(w.particles.every((q,i)=>q.mesh.position.equals(snapshot[i])));
  for(let i=0;i<150;i++)w.updateParticles(1/60);assert.equal(w.particles.length,0,'debris expires and leaves no live particle meshes');
  s.active=true;s.timer=0;w.render(g,0);assert(v.fracture.pieces.every(p=>p.mesh.position.equals(p.rest)),'reforming restores every chunk');
}
console.log('PASS anchored moving presses, visible spring targets, city flags only at checkpoints, larger cottage, fractured slabs, bounded debris, pause and recovery');

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
