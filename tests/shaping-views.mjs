import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createClayView,updateClayView} from '../dist/shaping-views.js';
import {Game,surfaceAt,FIXED_DT} from '../dist/simulation.js';
import {clayWallBounds,nudgeClay,stompClay} from '../dist/shaping.js';
import playground from '../dist/routes/clay-playground.js';
import {createShapeHands,animateShapeHands,disposeShapeHands} from '../dist/shape-hand.js';
import {animateClayView,MAGIC_CLAY,BLOCK_SQUASH} from '../dist/shaping-views.js';
import {attachClay} from './load-clay.mjs';
import {FORM} from '../dist/clay-form.js';
import clayLab from '../dist/routes/clay-lab.js';
const w=Object.create(World.prototype);w.mat={};for(const name of ['top','terrain','cream'])w.mat[name]=new THREE.MeshStandardMaterial();
const game=new Game();game.start(3,playground);
for(const s of game.level.platforms.filter(s=>s.shape)){
  const view=createClayView(w,s,new THREE.Group()),buffers=view.clay.pieces.map(p=>p.mesh.geometry.attributes.position.array);
  for(const amount of [0,.2,.5,.8,1,.4,0]){
    for(const key of Object.keys(s.shape.from))s[key]=s.shape.from[key]+(s.shape.to[key]-s.shape.from[key])*amount;
    updateClayView(view,s);
    for(const [i,piece]of view.clay.pieces.entries()){
      const geo=piece.mesh.geometry;assert.equal(geo.attributes.position.array,buffers[i],'stable buffer, no geometry allocation per frame');
      assert(geo.attributes.position.array.every(Number.isFinite));assert(geo.attributes.normal.array.every(Number.isFinite));
      if(s.clayRole==='ramp'){
        const a=geo.attributes.position,index=geo.index;
        for(let j=0;j<index.count;j+=3){
          const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];
          if(!ids.every(k=>piece.rest[k*3+1]>.499&&Math.abs(piece.rest[k*3+2])<.3))continue;
          const x=ids.reduce((sum,k)=>sum+a.getX(k),0)/3,y=ids.reduce((sum,k)=>sum+a.getY(k),0)/3;
          assert(Math.abs(y-(surfaceAt(s,s.x+x)-s.y))<.035,'triangle interiors match the curved walking surface');
        }
      }
      // One lump, no cap slab: the body's own top row is the walking surface,
      // so every vertex has to sit at or below the collider.
      const a=geo.attributes.position;
      for(let j=0;j<a.count;j++)assert(a.getY(j)<=surfaceAt(s,s.x+Math.min(Math.max(a.getX(j),0),s.w))-s.y+.001,'visible surface stays at or below collider');
      assert(Math.max(...Array.from({length:a.count},(_,j)=>a.getY(j)))>-.025,'and reaches it, with no gap where a cap used to be');
    }
  }
}
const landing=game.level.platforms.find(s=>s.id==='soft-landing');Object.assign(landing,landing.shape.to);
assert(clayWallBounds(landing,landing.y-5).right<landing.x+landing.w-2,'tapered pillar has no invisible wall beside its narrow foot');
console.log('PASS all clay poses: finite geometry/normals, stable buffers, collision-aligned surfaces and tapered pillar sides');

// The gesture hand: chapter four asks for clay with a cue on the object rather
// than a panel of text, so the cue has to be legible, correctly aimed, and gone
// the moment it stops being true.
{
  const hw=Object.create(World.prototype);
  hw.mat={};for(const name of ['cream','orange'])hw.mat[name]=new THREE.MeshStandardMaterial();
  hw.levelRoot=new THREE.Group();hw.reducedMotion=false;
  for(const method of ['mesh','box','ball','cylinder'])hw[method]=World.prototype[method];
  const g=new Game();g.start(3);
  hw.shapeHands=createShapeHands(hw,g.level);
  assert.equal(hw.shapeHands.length,g.level.shaping.length);
  const at=(id,y=0)=>{const s=g.level.platforms.find(p=>p.id===id);Object.assign(g.player,{x:s.x+s.w/2,y:(y||s.y),groundId:s.id,vx:0,vy:0});return s;};
  const settle=(frames=120,playing=true)=>{for(let i=0;i<frames;i++)animateShapeHands(hw,g,1/60,playing);};

  for(const view of hw.shapeHands){
    const station=view.station,dock=station.spawn.groundId;
    at(dock,station.spawn.y);settle();
    assert(view.root.visible,`${station.id}: the cue appears inside its own stretch`);
    const box=new THREE.Box3().setFromObject(view.root,true);
    assert(box.max.x-box.min.x>.8&&box.max.y-box.min.y>.8,`${station.id}: the cue is large enough to read`);
    // It hovers over its own clay, never off in open air.
    const parts=station.parts.map(id=>g.level.platforms.find(p=>p.id===id));
    const left=Math.min(...parts.map(s=>s.x)),right=Math.max(...parts.map(s=>s.x+s.w));
    assert(view.root.position.x>=left-1.2&&view.root.position.x<=right+1.2,`${station.id}: anchored to its clay`);
    assert(view.root.position.y>=Math.min(...parts.map(s=>s.y-s.h)),`${station.id}: above the clay's base`);
    // Within the landscape camera's headroom, so a tall plug still shows a cue.
    assert(view.root.position.y<=g.player.y+5.001,`${station.id}: stays inside the view`);

    // The stroke travels the way the clay has to move, and returns to start.
    const travel=[];for(let i=0;i<114;i++){animateShapeHands(hw,g,1/60,true);travel.push([view.hands[0].position.x,view.hands[0].position.y]);}
    const reach=travel.reduce((best,p)=>Math.hypot(...p)>Math.hypot(...best)?p:best,[0,0]);
    const axis=station.gesture==='down'?1:0,sign=station.gesture==='down'?-1:1;
    assert(Math.sign(reach[axis])===sign&&Math.abs(reach[axis])>.6,`${station.id}: mimes a ${station.gesture} stroke`);
    assert(Math.abs(reach[1-axis])<.01,`${station.id}: the stroke keeps to one axis`);

    // Frozen while paused, and held in a readable pose under reduced motion.
    const held=view.hands[0].position.x;settle(60,false);
    assert.equal(view.hands[0].position.x,held,`${station.id}: the cue freezes with the game`);
    hw.reducedMotion=true;settle(30);
    const still=view.hands[0].position.clone();settle(30);
    assert(still.equals(view.hands[0].position),`${station.id}: reduced motion holds one pose`);
    hw.reducedMotion=false;

    // Shaped clay needs no cue, and neither does clay the player has left.
    station.target=station.amount=1;settle(150);
    assert(!view.root.visible,`${station.id}: the cue leaves once the clay is finished`);
    station.target=station.amount=0;settle(150);
    assert(view.root.visible);
    g.player.x=station.end+40;settle(150);
    assert(!view.root.visible,`${station.id}: the cue leaves with the player`);
  }
  const materials=hw.shapeHands.flatMap(v=>v.materials);let disposed=0;
  for(const m of materials)m.addEventListener('dispose',()=>disposed++);
  disposeShapeHands(hw);
  assert.equal(disposed,materials.length);assert.equal(hw.levelRoot.children.length,0);
  console.log('PASS clay gesture hands: placement, size, stroke direction, pause/reduced motion, completion fade and disposal');

  // The canyon's formable pocket is one wide, level mass with a perch hanging
  // over its middle, so its cue says where to start: under the perch
  // (station.cueX), on the clay, miming the upward grab that pulls the pillar
  // up — not at either end of the mass, where nothing is to be reached.
  const canyon=new Game();canyon.start(0);
  const cw=Object.create(World.prototype);cw.mat=hw.mat;cw.levelRoot=new THREE.Group();cw.reducedMotion=false;
  for(const method of ['mesh','box','ball','cylinder'])cw[method]=World.prototype[method];
  cw.shapeHands=createShapeHands(cw,canyon.level);
  const view=cw.shapeHands.find(v=>v.station.id==='canyon-pocket'),station=view.station,mass=canyon.level.platforms.find(p=>p.id===station.parts[0]);
  Object.assign(canyon.player,station.spawn,{vx:0,vy:0});
  for(let i=0;i<120;i++)animateShapeHands(cw,canyon,1/60,true);
  assert(view.root.visible,'the pocket shows its cue from the dock');
  assert.equal(station.gesture,'up');assert(view.gesture.rise,'and it is the rising grab');
  assert(Math.abs(view.root.position.x-station.cueX)<1e-9,`anchored under the perch (${view.root.position.x.toFixed(2)})`);
  const perch=canyon.level.platforms.find(p=>p.id==='pocket-perch');
  assert(view.root.position.x>perch.x-1&&view.root.position.x<perch.x+perch.w+1,'under the perch\'s footprint');
  const crest=mass.y-mass.h+Math.max(...mass.form.h);
  assert(view.root.position.y<=canyon.player.y+3+1e-9&&view.root.position.y>crest-4,`on the clay, inside the view (${view.root.position.y.toFixed(2)} for a crest at ${crest.toFixed(2)})`);
  const rise=[];for(let i=0;i<114;i++){animateShapeHands(cw,canyon,1/60,true);rise.push(view.hands[0].position.y);}
  assert(Math.max(...rise)>.6&&Math.abs(Math.max(...view.hands.map(h=>h.position.x)))<.01,'the hand travels straight up');
  disposeShapeHands(cw);
  console.log('PASS the pocket\'s cue rises over the spire at the dock\'s end, not over the middle of the mass');
}

// Magic clay marks itself: its own violet material, smoother and glossier than
// the sculpted world, and a slow idle squash once the player is beside it. That
// pairing is what replaced the instruction panel, so it has to hold on its own.
{
  const mw=Object.create(World.prototype);
  mw.mat={};for(const name of ['cream','top','terrain'])mw.mat[name]=new THREE.MeshStandardMaterial({roughness:.98});
  for(const method of ['mesh','box','ball','cylinder'])mw[method]=World.prototype[method];
  const g=new Game();g.start(3);
  for(const s of g.level.platforms.filter(p=>p.shape)){
    const view=createClayView(mw,s,new THREE.Group()),meshes=[];
    view.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    // One lump and nothing bolted to it: no cap slab, no grip ring, no dents.
    assert.equal(meshes.length,1,`${s.id}: the clay is a single unadorned lump`);
    for(const {material:m} of meshes){
      assert.equal(m.color.getHex(),MAGIC_CLAY,`${s.id}: kneadable clay wears the magic violet`);
      assert(m.roughness<mw.mat.terrain.roughness-.3,`${s.id}: reads softer and glossier than ordinary terrain`);
    }
    // The idle breath is feel, not geometry: it never moves the collider by a
    // margin the player could stand on, and it settles once they walk away.
    let lo=1,hi=1;
    for(let i=0;i<240;i++){animateClayView(view,s,1/60,{near:true});lo=Math.min(lo,view.root.scale.y);hi=Math.max(hi,view.root.scale.y);}
    assert(lo<.995&&hi>1.005,`${s.id}: clay breathes when the player is near`);
    assert(1-lo<.03&&hi-1<.03,`${s.id}: the breath stays under three per cent`);
    const still=view.root.scale.y;
    animateClayView(view,s,1/60,{near:true,playing:false});
    assert.equal(view.root.scale.y,still,`${s.id}: the breath freezes with the game`);
    for(let i=0;i<400;i++)animateClayView(view,s,1/60,{near:false});
    assert(Math.abs(view.root.scale.y-1)<1e-3&&Math.abs(view.root.position.x-s.x)<1e-3,`${s.id}: settles when the player leaves`);
    for(let i=0;i<120;i++)animateClayView(view,s,1/60,{near:true,reducedMotion:true});
    assert.equal(view.root.scale.y,1,`${s.id}: reduced motion holds the clay still`);
  }
  console.log('PASS magic clay: one violet lump, softer surface, bounded idle squash, pause and reduced motion');
}

// The hand is the tutorial layer and retires; the material is permanent.
{
  const hw=Object.create(World.prototype);
  hw.mat={};for(const name of ['cream','orange'])hw.mat[name]=new THREE.MeshStandardMaterial();
  hw.levelRoot=new THREE.Group();hw.reducedMotion=false;
  for(const method of ['mesh','box','ball','cylinder'])hw[method]=World.prototype[method];
  const g=new Game();g.start(3);
  hw.shapeHands=createShapeHands(hw,g.level);
  const view=hw.shapeHands[0],station=view.station;
  const dock=g.level.platforms.find(p=>p.id===station.spawn.groundId);
  Object.assign(g.player,{x:dock.x+dock.w/2,y:station.spawn.y,groundId:dock.id});
  const settle=(frames=150)=>{for(let i=0;i<frames;i++)animateShapeHands(hw,g,1/60,true);};
  // Teaching is per piece of clay. Clay you have never solved always asks;
  // clay you have solved before stays quiet — a global tally is how a player
  // who has shaped three ramps meets an unfamiliar stair wall with no cue.
  hw.clayDone=new Set();view.opacity=0;view.dwell=0;settle();
  assert(view.root.visible,'clay the player has never finished always shows its cue');
  hw.clayDone=new Set(['some-other-station']);view.opacity=0;view.dwell=0;settle();
  assert(view.root.visible,'finishing other clay does not retire this clay’s cue');
  hw.clayDone=new Set([station.id]);view.opacity=0;view.dwell=0;settle(45);
  assert(!view.root.visible,'clay this player has already solved stays quiet');
  // Unless they hesitate in front of it, when it comes back quickly.
  settle(60*3);
  assert(view.root.visible,'the cue returns after a short stall beside unworked clay');
  // But it never nags someone who is already kneading.
  view.opacity=0;view.dwell=0;station.amount=0;
  for(let i=0;i<60*9;i++){station.amount=Math.min(.9,station.amount+.0008);animateShapeHands(hw,g,1/60,true);}
  assert(!view.root.visible,'kneading in progress keeps the cue away');
  assert.equal(view.materials[0].color.getHex(),0xffebcc,'the hand and arrow share the reference cream');
  disposeShapeHands(hw);
  console.log('PASS gesture cue: teaches unsolved clay, stays quiet on solved clay, returns on a stall, never nags mid-knead');
}

// The relief is laid in the clay's rest shape so a thumbprint stays where a
// thumb put it. But a column pressed to a fraction of its height then draws its
// whole rest span across that fraction, and the mass spread flat stands at a
// thirteenth of the height it was built at: the grain came out squeezed into
// hard horizontal bands rather than clay. The rest shape has to let go of the
// surface before it gets that far.
{
  const bw=Object.create(World.prototype);bw.mat={};
  for(const name of ['top','terrain','cream'])bw.mat[name]=new THREE.MeshStandardMaterial();
  await attachClay(bw);
  const g=new Game();g.start(5,clayLab);
  const mass=g.level.platforms.find(p=>p.id==='form-mass');
  const view=createClayView(bw,mass,new THREE.Group()),mesh=view.clay.pieces[0].mesh;
  const span=mesh.geometry.attributes.clayStretch;
  assert(span,'the block carries how far its clay stands from its rest height');
  assert.equal(span.count,mesh.geometry.attributes.position.count,'one reading per vertex');

  // How much squashing the cap lets through, as the vertex shader works it out.
  const survives=s=>{const hold=Math.max(s,1e-4),flatten=Math.min(Math.max(hold/BLOCK_SQUASH,1),hold*BLOCK_SQUASH);return hold/flatten;};
  assert.equal(survives(1),1,'clay at its rest height keeps pure rest coordinates');
  for(const s of [0,1e-6,.05,.35/4.5,.5,.9,1,1.5,FORM.maxHeight/4.5,40]){
    const left=survives(s);
    assert(left>=1/BLOCK_SQUASH-1e-9&&left<=BLOCK_SQUASH+1e-9,`a column at ${s} of its rest height leaves the surface inside the cap`);
  }

  // Spread as flat as the rules allow: the real worst case, not a made-up one.
  for(let i=0;i<mass.form.h.length;i++)mass.form.h[i]=FORM.minThick;
  mass.form.version++;updateClayView(view,mass);
  const flat=Array.from(mesh.geometry.attributes.clayStretch.array);
  assert(flat.every(Number.isFinite)&&flat.every(v=>v>0),'every reading stays a real, positive scale');
  const worst=Math.min(...flat);
  assert(worst<.1,'the mass really does spread to under a tenth of its rest height');
  assert(1/survives(worst)<=BLOCK_SQUASH+1e-9,`squashed ${(1/worst).toFixed(1)}x, the surface is squashed at most ${BLOCK_SQUASH}x`);

  // Pull it back up and the surface goes back to belonging to the clay.
  for(let i=0;i<mass.form.h.length;i++)mass.form.h[i]=mass.form.ref;
  mass.form.version++;updateClayView(view,mass);
  const tall=Array.from(mesh.geometry.attributes.clayStretch.array);
  assert(tall.every(v=>Math.abs(v-1)<1e-6),'clay at its rest height reads as no stretch at all');

  // The three injections have to land, and the magic skin has to still find its
  // own sites afterwards — it hooks the same lines this override rewrites.
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  mesh.material.onBeforeCompile(shader,{});
  const expand=s=>s.replace(/#include <([\w_]+)>/g,(_,key)=>{assert(THREE.ShaderChunk[key],`missing shader chunk ${key}`);return expand(THREE.ShaderChunk[key]);});
  const vertex=expand(shader.vertexShader),fragment=expand(shader.fragmentShader);
  assert(vertex.includes('vClayPosition = clayFlat * claySize + clayOffset;'),'the relief reads the flattened rest shape');
  assert(vertex.includes('vClayNormal = normalize(normal * vec3(1.0, clayFit, 1.0) / max(claySize, vec3(0.0001)));'),
    'and the blend normal is carried into the same shape, or a rounded edge turns over in a pixel while its coordinates are still a third of a unit from the corner');
  assert(vertex.indexOf('vec3 clayFlat =')<vertex.indexOf('vMagicPosition = clayFlat;'),'prints and glitter follow the clay, declared before they read it');
  assert(fragment.includes('clayData.r = (clayData.r - 0.5) * vClayRelief + 0.5;'),'what squashing is left is taken back out of the relief, about the field middle');
  assert(fragment.indexOf('vec3 clayData = claySurface(')<fragment.indexOf('clayData.r = (clayData.r - 0.5)'),'after it is sampled');
  assert(fragment.indexOf('clayData.r = (clayData.r - 0.5)')<fragment.indexOf('clayData.r * bumpScale'),'and before it is read as a height');
  assert(fragment.includes('clayData.r * bumpScale + magicPrint * magicMask * 0.0019'),'the magic skin still found the site this override rewrites');
  console.log('PASS squashed clay: bounded surface squash at any thickness, untouched at rest, carried blend normal, softened relief, intact magic skin');
}

// Every way a player might touch clay has to move it. A drag is precise, but a
// tap and a stomp are what people try first, and clay that ignores them reads
// as clay that is not interactive — which is exactly how this went wrong.
{
  const g=new Game();g.start(3);
  for(const station of g.level.shaping){
    const fresh=()=>{const h=new Game();h.start(3);return [h,h.level.shaping.find(s=>s.id===station.id)];};
    const [tapGame,tapStation]=fresh();
    for(let tap=0;tap<4;tap++){
      assert(nudgeClay(tapGame,station.id)||tapStation.target>=1,`${station.id}: a tap presses the clay`);
      for(let i=0;i<60;i++)tapGame.tick(FIXED_DT,{});
    }
    assert.equal(tapStation.amount,1,`${station.id}: four taps finish the clay`);
    assert(!nudgeClay(tapGame,station.id),`${station.id}: finished clay ignores further taps`);

    // A stomp works clay of any gesture, not only press-down clay.
    const [stompGame,stompStation]=fresh();
    const part=stompGame.level.platforms.find(p=>p.id===station.parts[0]);
    stompClay(stompGame,part);
    assert(stompStation.target>=.49,`${station.id}: a stomp works this clay whichever way it goes`);
  }
  console.log('PASS every input moves clay: taps press it, stomps work any gesture, finished clay stops responding');
}
