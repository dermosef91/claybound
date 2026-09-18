// The authored horizon: a placement that names a catalogue shape and stands in
// a parallax layer instead of the play plane. What has to hold is that it is
// exactly where its world x says when the camera reaches it, that it is a
// singleton rather than a tiling field, that it costs one layer per depth, and
// that it stays as inert as decoration.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {decorPalette,DECOR_KINDS,backdropWorldX,backdropFactor,BACKDROP_BOUNDS,BACKDROP_DEFAULT} from '../dist/decor-kinds.js';
import {animateEnvironment} from '../dist/environments.js';
import {sceneStage} from './support/stage.mjs';

const w=await sceneStage();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);

// Every shape the canyon's palette offers, put on the horizon at one depth.
{
  const g=new Game();g.start(0);
  const palette=decorPalette('desert');
  g.level.backdrop=palette.map(([kind],i)=>({kind,x:120+i*40,y:-4,z:-30,factor:.35,size:DECOR_KINDS[kind].size}));
  w.build(g.level,0,120);
  assert.equal(w.backdropViews.filter(Boolean).length,palette.length,'every palette shape can stand on the horizon');
  for(const [i,item]of g.level.backdrop.entries()){
    const view=w.backdropViews[i];
    assert(!view.userData.decorError,`${item.kind}: ${view.userData.decorError}`);
    let meshes=0;view.traverse(o=>{if(o.isMesh)meshes++;});
    assert(meshes>0,`${item.kind} builds geometry on the horizon`);
    // The layer holds it at x*factor, which is what puts it on its world x.
    assert(Math.abs(view.position.x-item.x*item.factor)<1e-9,`${item.kind} sits at its layer offset`);
    assert.equal(view.position.z,item.z);
    // Nothing on the horizon pays for a shadow pass.
    const shadows=[];view.traverse(o=>{if(o.isMesh)shadows.push(o.castShadow||o.receiveShadow);});
    assert(shadows.every(on=>!on),`${item.kind} casts no shadow from the horizon`);
    assert(view.parent.name.startsWith('Authored backdrop'),`${item.kind} joins an authored layer`);
  }
  // One layer per depth, not one per piece.
  const layers=new Set(w.backdropViews.map(v=>v.parent));
  assert.equal(layers.size,1,'a single distance costs a single parallax layer');
  assert.equal(w.backdropLayers.size,1);
  const entry=w.parallax.find(l=>l.group===w.backdropViews[0].parent);
  assert(entry&&entry.factor===.35,'the layer carries the placement\'s distance');
  assert(entry.repeat>=1e6,'an authored piece never tiles');
  console.log('PASS every canyon palette shape on the horizon: geometry, layer offset, depth, no shadows, one layer per distance');
}

// The promise the maths makes: when the camera arrives, the piece is on its x.
{
  const g=new Game();g.start(0);
  g.level.backdrop=[{kind:'canyon-arch',x:200,y:-3,z:-24,factor:.2,size:18}];
  w.build(g.level,0,200);
  const view=w.backdropViews[0],item=g.level.backdrop[0];
  for(const cameraX of [120,200,260]){
    w.cameraX=cameraX;w.cameraY=2;
    animateEnvironment(w,1/60);
    w.scene.updateMatrixWorld(true);
    const centre=view.getWorldPosition(new THREE.Vector3()).x;
    assert(Math.abs(centre-backdropWorldX(item,cameraX))<1e-6,'the helper the editor draws with agrees with the frame');
    if(cameraX===item.x)assert(Math.abs(centre-item.x)<1e-6,'and at the piece\'s own x it stands exactly there');
  }
  // It drifts, rather than tracking the camera: that is what reads as distance.
  w.cameraX=120;animateEnvironment(w,1/60);w.scene.updateMatrixWorld(true);
  const near=view.getWorldPosition(new THREE.Vector3()).x-120;
  w.cameraX=200;animateEnvironment(w,1/60);w.scene.updateMatrixWorld(true);
  const far=view.getWorldPosition(new THREE.Vector3()).x-200;
  // Its offset from the camera is factor*(x-cameraX), so the nearer the
  // distance the faster it crosses the frame — which is the whole illusion.
  assert(Math.abs((near-far)-80*.2)<1e-6,'80 units of camera slides it 80*factor across the frame');
  assert(Math.abs(far)<1e-6,'and it is centred on the camera when the camera is on its x');
  console.log('PASS the horizon piece lands on its own world x, and drifts at the rate its distance sets');
}

// Two distances, and streaming the chapter does not take the horizon with it.
{
  const g=new Game();g.start(0);
  g.level.backdrop=[
    {kind:'summit',x:140,y:-5,z:-40,factor:.15,size:22},
    {kind:'canyon-arch',x:150,y:-4,z:-20,factor:.5,size:16}
  ];
  w.build(g.level,0,140);
  assert.equal(w.backdropLayers.size,2,'two distances, two layers');
  const before=w.backdropViews.map(v=>v.parent);
  assert.notEqual(before[0],before[1]);
  // Walk far enough that the streamed foreground is replaced entirely.
  for(const focus of [140,260,40,140]){w.syncVisible?.(g.level,focus,true);}
  assert.equal(w.backdropViews.filter(Boolean).length,2,'the horizon is built with the chapter, not streamed past');
  assert.equal(sharedDisposals,0,'the horizon borrows the shared models rather than owning them');
  console.log('PASS two distances take two layers, and the horizon survives the foreground streaming');
}

// It is scenery: the simulation never sees it, and a walk through it is a walk
// through nothing.
{
  const g=new Game();g.start(0);
  const platforms=g.level.platforms.length,spawn=g.level.spawn;
  g.level.backdrop=[{kind:'canyon-arch',x:spawn.x,y:spawn.y,z:-12,factor:.4,size:20}];
  w.build(g.level,0,spawn.x);
  assert.equal(g.level.platforms.length,platforms,'a horizon piece adds no platform');
  for(let i=0;i<40;i++)g.tick(1/120,{moveAxis:1});
  assert(Number.isFinite(g.player.x)&&!g.respawnTimer,'walking under the horizon is walking through nothing');
  console.log('PASS the horizon is never a collider');
}

// The bounds exist to hold the depths the built backdrop actually uses.
{
  assert(BACKDROP_BOUNDS.z[0]<=-53,'the canyon\'s own far skyline depth is expressible');
  assert(BACKDROP_BOUNDS.z[0]<=-59,'so is the cave\'s veil');
  assert(BACKDROP_BOUNDS.factor[0]>0,'a distance of zero would be a prop in the wrong list');
  assert.equal(backdropFactor({}),BACKDROP_DEFAULT.factor);
  assert.equal(backdropFactor({factor:99}),BACKDROP_BOUNDS.factor[1],'a distance past the bound is clamped, never divided by zero');
  console.log('PASS the horizon reaches the depths the built backdrop uses');
}
