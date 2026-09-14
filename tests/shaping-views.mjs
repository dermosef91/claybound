import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createClayView,updateClayView} from '../dist/shaping-views.js';
import {Game,surfaceAt} from '../dist/simulation.js';
import {clayWallBounds} from '../dist/shaping.js';
import playground from '../dist/routes/clay-playground.js';
import {createShapeHands,animateShapeHands,disposeShapeHands} from '../dist/shape-hand.js';
import {animateClayView,MAGIC_CLAY,MAGIC_CLAY_LIGHT} from '../dist/shaping-views.js';
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
      if(piece.cap){const a=geo.attributes.position;for(let j=0;j<a.count;j++)assert(a.getY(j)<=surfaceAt(s,s.x+a.getX(j))-s.y+.001,'visible surface stays at or below collider');}
    }
  }
}
const landing=game.level.platforms.find(s=>s.id==='soft-landing');Object.assign(landing,landing.shape.to);
assert(clayWallBounds(landing,landing.y-5).right<landing.x+landing.w-2,'tapered pillar has no invisible wall under its wider cap');
console.log('PASS all clay poses: finite geometry/normals, stable buffers, collision-aligned caps and tapered pillar sides');

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
    const view=createClayView(mw,s,new THREE.Group()),seen=new Set();
    view.root.traverse(o=>{if(o.isMesh&&o.material!==mw.mat.cream)seen.add(o.material);});
    for(const m of seen){
      assert([MAGIC_CLAY,MAGIC_CLAY_LIGHT].includes(m.color.getHex()),`${s.id}: kneadable clay wears the magic violet`);
      assert(m.roughness<mw.mat.terrain.roughness-.3,`${s.id}: reads softer and glossier than ordinary terrain`);
    }
    // The idle breath is feel, not geometry: it never moves the collider by a
    // margin the player could stand on, and it settles once they walk away.
    let lo=1,hi=1;
    for(let i=0;i<240;i++){animateClayView(view,s,1/60,{near:true});lo=Math.min(lo,view.root.scale.y);hi=Math.max(hi,view.root.scale.y);}
    assert(lo<.995&&hi>1.005,`${s.id}: clay breathes when the player is near`);
    assert(1-lo<.03&&hi-1<.03,`${s.id}: the breath stays under three per cent`);
    assert(view.clay.marker.scale.x>1.05,`${s.id}: the grip mark swells with it`);
    const still=view.clay.marker.scale.x;
    animateClayView(view,s,1/60,{near:true,playing:false});
    assert.equal(view.clay.marker.scale.x,still,`${s.id}: the breath freezes with the game`);
    for(let i=0;i<400;i++)animateClayView(view,s,1/60,{near:false});
    assert(Math.abs(view.root.scale.y-1)<1e-3&&Math.abs(view.root.position.x-s.x)<1e-3,`${s.id}: settles when the player leaves`);
    for(let i=0;i<120;i++)animateClayView(view,s,1/60,{near:true,reducedMotion:true});
    assert.equal(view.root.scale.y,1,`${s.id}: reduced motion holds the clay still`);
  }
  console.log('PASS magic clay: violet material, softer surface, bounded idle squash, grip swell, pause and reduced motion');
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
  for(const [taught,expected]of [[0,true],[2,true],[3,false],[7,false]]){
    hw.clayTaught=taught;view.opacity=0;view.dwell=0;settle();
    assert.equal(view.root.visible,expected,`clayTaught ${taught}: the cue ${expected?'teaches':'has retired'}`);
  }
  // A player who has learned it but stalls beside unworked clay gets it back.
  hw.clayTaught=7;view.opacity=0;view.dwell=0;settle(60);
  assert(!view.root.visible,'no cue for an experienced player who just arrived');
  settle(60*9);
  assert(view.root.visible,'the cue returns after a long stall beside unworked clay');
  // But it never nags someone who is already kneading.
  view.opacity=0;view.dwell=0;station.amount=0;
  for(let i=0;i<60*9;i++){station.amount=Math.min(.9,station.amount+.0008);animateShapeHands(hw,g,1/60,true);}
  assert(!view.root.visible,'kneading in progress keeps the cue away');
  assert.equal(view.materials[1].color.getHex(),MAGIC_CLAY,'the cue carries the clay colour');
  disposeShapeHands(hw);
  console.log('PASS gesture cue retires after three stations, returns on a long stall, and never nags mid-knead');
}
