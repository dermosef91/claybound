// The cavern machines' render adapters and the Great Arch, then everything the
// workshop can place: every palette shape and every landmark name, built in
// each chapter that offers it.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {DECOR_KINDS,decorPalette,landmarkChoices,landmarkBox,CAVE_STORY_ROLES} from '../dist/decor-kinds.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
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
  // The room follows the arch wherever the route puts it; the editor move below
  // shifts these platforms, so their authored positions are read once here.
  const at=id=>g.level.platforms.find(p=>p.id===id),ARCH=at('arch-entry').x,ROOF_END=at('arch-roof').x+at('arch-roof').w;
  w.build(g.level,0,ARCH+23);
  const inspect=()=>{
    w.scene.updateMatrixWorld(true);
    const room=w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave');assert(room);
    const shell=room.getObjectByName('Supplied sandstone cave');assert(shell);
    const box=new THREE.Box3().setFromObject(shell,true);
    assert(box.max.z<-2.59,'all supplied cave stone stays behind the play lane');
    assert(box.min.x<ARCH+13&&box.max.x>ROOF_END&&box.max.y>24,'the enclosure covers both banks and the flower route');
    let triangles=0;shell.traverse(o=>{if(o.isMesh){
      triangles+=o.geometry.index.count/3;
      assert(w.assetGeometry.has(o.geometry)&&w.assetMaterials.has(o.material));
      assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);
      assert(o.material.vertexColors&&o.material.userData.clay,'cavity shade survives clay load order');
      assert(o.geometry.attributes.color.array.every(n=>Number.isFinite(n)&&n>=.37&&n<=1));
    }});assert.equal(triangles,10440);
    const rear=room.getObjectByName('Recessed sandstone wall with sky windows');assert(rear.material.bumpMap===w.clay.detail);
    assert(new THREE.Box3().setFromObject(rear,true).max.z<box.min.z,'recess never masks the supplied sculpted wall');
    // Every thin ledge the arch holds, whichever ones it is authored with.
    const entry=g.level.platforms.find(q=>q.id==='arch-entry'),roof=g.level.platforms.find(q=>q.id==='arch-roof');
    const inside=g.level.platforms.filter(q=>q.kind==='ledge'&&q.x>entry.x&&q.x<roof.x+roof.w);
    assert(inside.length>=2,'the arch holds ledges to dress');
    for(const q of inside)assert(w.platforms.get(q.id)?.root.getObjectByName('Sandstone ledge root'),q.id+' is dressed as a sandstone ledge');
    return box;
  };
  const initial=inspect();assert.equal(JSON.stringify(g.level),original,'scenery leaves the authored physics and collectibles unchanged');
  const lift=g.level.platforms.find(s=>s.id==='arch-lift'),startY=lift.y;
  const endpoints=[];
  for(const y of [startY,startY+2.2,startY-2.2]){
    lift.y=y;Object.assign(g.player,{x:ARCH+23,y,groundId:lift.id});w.render(g,0);w.scene.updateMatrixWorld(true);
    endpoints.push(w.platforms.get(lift.id).ropes.map(rope=>rope.localToWorld(new THREE.Vector3(0,rope.userData.ceiling.rest,0)).y));
  }
  for(const end of endpoints)for(let i=0;i<end.length;i++)assert(Math.abs(end[i]-endpoints[0][i])<1e-6,'lift motion never moves the ceiling end of its ropes');
  lift.y=startY;
  w.syncVisible(g.level,10,true);assert(!w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave'));
  w.syncVisible(g.level,ARCH+23,true);inspect();w.refreshEditor(g.level,ARCH+23);inspect();
  const roomCount=()=>w.levelRoot.children.filter(o=>o.name==='Inside the Great Arch: canyon cave').length;assert.equal(roomCount(),1);
  for(const s of g.level.platforms.filter(s=>s.id.startsWith('arch-'))){s.x+=12;s.baseX+=12;s.y+=3;s.baseY+=3;}
  w.refreshEditor(g.level,ARCH+35);w.scene.updateMatrixWorld(true);
  const moved=new THREE.Box3().setFromObject(w.levelRoot.getObjectByName('Supplied sandstone cave'),true);
  assert(Math.abs(moved.min.x-initial.min.x-12)<1e-5&&Math.abs(moved.min.y-initial.min.y-3)<1e-5,'moving the section in the editor moves its enclosure');
  const forest=new Game();forest.start(1);w.build(forest.level,1,118);assert(!w.levelRoot.getObjectByName('Inside the Great Arch: canyon cave'));
  g.start(0);w.build(g.level,0,ARCH+23);inspect();assert.equal(sharedDisposals,0);
}
console.log('PASS Great Arch model/maps, cavity shade, clear play lane, fixed rope anchors, streaming, editor moves and chapter reuse');

// Authored decoration builds real geometry in the play plane. Every shape the
// workshop offers is built here at its own default size, in the chapter that
// offers it, so a palette entry can never be a name with nothing behind it.
{
  const biomes=['desert','forest','cave','citadel','dream'];
  for(const [index,biome]of biomes.entries()){
    const g=new Game();g.start(index);
    const anchor=g.level.platforms.find(p=>p.kind==='stone')||g.level.platforms[0];
    const palette=decorPalette(biome);
    g.level.decor=palette.map(([kind])=>({kind,x:anchor.x+3,y:anchor.y,size:DECOR_KINDS[kind].size,z:DECOR_KINDS[kind].z}));
    w.build(g.level,index,anchor.x+3);
    assert.equal(w.decorViews.filter(Boolean).length,palette.length,`${biome} builds every prop in its palette`);
    g.level.decor.forEach((d,i)=>{
      const view=w.decorViews[i];
      assert(!view.userData.decorError,`${d.kind}: ${view.userData.decorError}`);
      let meshes=0;view.traverse(o=>{if(o.isMesh)meshes++;});
      assert(meshes>0,`${d.kind} builds geometry`);
      assert.equal(view.position.x,d.x);assert.equal(view.position.y,d.y);assert.equal(view.position.z,d.z);
      view.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(view,true),width=box.getSize(new THREE.Vector3()).x;
      // Size across means the width of the silhouette, for a built pebble and a
      // supplied castle alike. Clay relief displaces vertices, hence the slack.
      assert(Math.abs(width-d.size)<d.size*.06,`${d.kind} is ${d.size} across, not ${width.toFixed(2)}`);
      // Anything set well back is backdrop, and a backdrop casting shadows into
      // the playfield spends a shadow pass on a silhouette nobody can reach.
      const shadows=[];view.traverse(o=>{if(o.isMesh)shadows.push(o.castShadow);});
      if(d.z<-8)assert(shadows.every(on=>!on),`${d.kind} placed as backdrop casts no shadow`);
    });
    // Turn and lean are the root's own rotation, so a drag can follow them.
    const turned={...g.level.decor[0],turn:90,lean:-45};
    g.level.decor=[turned];w.refreshEditor(g.level,turned.x);
    const view=w.decorViews[0];
    assert(Math.abs(view.rotation.y-Math.PI/2)<1e-9);assert(Math.abs(view.rotation.z+Math.PI/4)<1e-9);
    // A prop is scenery: it never becomes a collider, a light the cave counts
    // on, or a checkpoint, and it never joins the platform views.
    assert.equal(w.platforms.size,new Set(g.level.platforms.filter(p=>w.platforms.has(p.id)).map(p=>p.id)).size);
    assert(!w.flags.includes(view));
    // Streaming drops it like any other view when the camera leaves, and the
    // shared model resources it borrowed survive that.
    w.syncVisible(g.level,turned.x+900,true);assert(!w.decorViews[0],'decoration streams out behind the camera');
    w.syncVisible(g.level,turned.x,true);assert(w.decorViews[0],'and comes back');
  }
  assert.equal(sharedDisposals,0,'decoration borrows the shared models rather than owning them');
}
console.log('PASS decoration: every palette shape builds in its chapter, exact placement, honest size across, backdrop shadow budget, root turn/lean, and streaming in and out without disposing shared models');

// A landmark the workshop offers has to build something, or the dropdown is
// promising a prop the chapter will not make. Every name is put on a real deck
// in every chapter that offers it, and measured against that deck bare.
{
  const biomes=['desert','forest','cave','citadel','dream'];
  for(const [index,biome]of biomes.entries()){
    const g=new Game();g.start(index);
    // A plain deck with no story of its own, so only the landmark can add to it.
    const deck=g.level.platforms.find(p=>p.kind==='stone'&&!p.goal&&!p.landmark&&!p.house&&!CAVE_STORY_ROLES[p.id]);
    assert(deck,`${biome} has a plain deck to dress`);
    delete deck.landmark;w.build(g.level,index,deck.x);w.syncVisible(g.level,deck.x,true);
    const meshes=()=>{let n=0;w.platforms.get(deck.id).root.traverse(o=>{if(o.isMesh)n++;});return n;};
    const bare=meshes();
    for(const [name]of landmarkChoices(biome,deck)){
      deck.landmark=name;w.refreshEditor(g.level,deck.x);
      assert(w.platforms.has(deck.id),`${biome}/${name}: the deck still builds`);
      assert(meshes()>bare,`${biome}/${name} adds a prop to its deck`);
      const root=w.platforms.get(deck.id).root;
      const group=root.children.find(o=>o.name.startsWith('Landmark:')||o.name.includes('windmill')||o.name.includes('basin'));
      assert(group,`${biome}/${name} names the group it built`);
      // The workshop outlines this prop and routes a tap to it, so the box it
      // believes in has to be where the prop actually stands.
      root.updateMatrixWorld(true);
      const built=new THREE.Box3().setFromObject(group,true),claimed=landmarkBox(biome,deck);
      assert(claimed,`${biome}/${name} has a box to outline`);
      assert(built.min.x>=claimed.x-.12&&built.max.x<=claimed.x+claimed.w+.12,
        `${biome}/${name} sits within its outline across (${built.min.x.toFixed(2)}..${built.max.x.toFixed(2)} vs ${claimed.x.toFixed(2)}..${(claimed.x+claimed.w).toFixed(2)})`);
      assert(built.max.y<=claimed.y+claimed.h+.12&&built.max.y>=claimed.y+claimed.h-1.2,
        `${biome}/${name} reaches its outline without overshooting it (${built.max.y.toFixed(2)} vs ${(claimed.y+claimed.h).toFixed(2)})`);
    }
    delete deck.landmark;w.refreshEditor(g.level,deck.x);
    assert.equal(meshes(),bare,'clearing it leaves the deck exactly as it was');
  }
  // Where the deck decides, the name is only a switch: turning it on builds the
  // arrangement the id chooses, and turning it off takes it away.
  const g=new Game();g.start(2);
  w.build(g.level,2,g.level.spawn.x);
  // Every deck-chosen arrangement, whatever role it draws, has to fit the one
  // outline the workshop offers for them.
  for(const id of Object.keys(CAVE_STORY_ROLES)){
    const s=g.level.platforms.find(p=>p.id===id);if(!s)continue;
    w.refreshEditor(g.level,s.x);
    const root=w.platforms.get(s.id)?.root;if(!root)continue;
    root.updateMatrixWorld(true);
    const group=root.getObjectByName('Cavern story: '+CAVE_STORY_ROLES[id]);
    assert(group,`${id} carries its ${CAVE_STORY_ROLES[id]}`);
    const built=new THREE.Box3().setFromObject(group,true),claimed=landmarkBox('cave',s);
    assert(built.min.x>=claimed.x-.12&&built.max.x<=claimed.x+claimed.w+.12,`${id} sits within the story outline`);
    assert(built.max.y<=claimed.y+claimed.h+.12,`${id} does not overshoot it`);
  }
  const story=g.level.platforms.find(p=>CAVE_STORY_ROLES[p.id]);
  const role=CAVE_STORY_ROLES[story.id];
  w.syncVisible(g.level,story.x,true);w.refreshEditor(g.level,story.x);
  assert(w.platforms.get(story.id).root.getObjectByName('Cavern story: '+role),`${story.id} carries its ${role}`);
  delete story.landmark;w.refreshEditor(g.level,story.x);
  assert(!w.platforms.get(story.id).root.getObjectByName('Cavern story: '+role),'and drops it when the switch is off');
  story.landmark='story';w.refreshEditor(g.level,story.x);
  assert(w.platforms.get(story.id).root.getObjectByName('Cavern story: '+role),'any name brings back the same arrangement');
  assert.equal(sharedDisposals,0);
}
console.log('PASS landmarks: every name the workshop offers builds a prop on a real deck in every chapter that offers it, clearing one restores the bare deck, and a deck-chosen arrangement switches off and back on');
