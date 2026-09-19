// The Soft Dream's supplied models: the Upside-Down Orchard's two clay planets,
// two frosted saucer bowls and the abstract sculpture its canopy is made of,
// the Melted Parade's clay hat, and its two creatures. Checks the shipped
// files against their manifest (the hat is the one decimated from its upload,
// and the one that must stay light), re-fits each planet's core orb from the
// shipped vertices against the constants the placement relies on, and builds
// the orchard on a CPU World to prove the orb lands exactly on the dome's
// collider, every rope-hung saucer's flat top lies on its walk plane, the
// canopy's sculptures hang over the ropes as modelled with variety, the
// bare-rig fallback still builds, and the rider's spin still turns the planet.
// Then the parade: five hats stacked foot on crown on the hat-worm's plinth,
// tumbling to the pulled bridge's back exactly as the sculpted ones did, and
// the sculpted ones back on a rig without the model. Then the two creatures:
// the caterpillar's load-time rig and the giraffe's parade pose, the giraffe
// as the climb itself — its decks lying on its back, in the crook of its neck
// and on its head — asleep, stirred by the pull and walking off once the
// player is across, and the hatworm on its back as the caterpillar in three
// hats — walking on its bones, dying flat, streaming and falling back to the
// sculpted worm without the models.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {MODULES,SHELVED,soloSection} from '../dist/routes/dream.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {createCaveLights} from '../dist/cave-lighting.js';
import {animateDreamViews} from '../dist/dream-views.js';
import {animateDream} from '../dist/dream.js';
import paradeVisual,{HAT_WIDTHS,HAT_NEST,GIRAFFE_WITHERS,GIRAFFE_LEAVE,VALANCE_TILES} from '../dist/dream/parade.js';
import {DREAM_FILES,PLANET_ORBS,EYEBALL,dreamPlanet,dreamSaucer,dreamSculpture,dreamHat,dreamHatHeight,dreamCaterpillar,dreamGiraffe,skinnedBox,dreamColumn,dreamCane,dreamSun,dreamValance,dreamBanner,dreamEyeball,dreamPillar,dreamMountain,dreamPebbles,COLUMN_MEDALLION} from '../dist/dream-assets.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {SOCKET,GAZE} from '../dist/dream/corridor.js';
import {updateShaping} from '../dist/shaping.js';
import {CATERPILLAR_RIG,CATERPILLAR_HEAD,GIRAFFE_BONES,GIRAFFE_POSE} from '../dist/dream-rigs.js';
import {HATWORM_COLOURS} from '../dist/dream-enemies.js';
import {animateEnemy,releaseEnemyView} from '../dist/enemies.js';
import {clone} from '../dist/lib/SkeletonUtils.js';
import {readPlayer,readGLB} from './load-player.mjs';
import {attachClay} from './load-clay.mjs';
import {attachDream} from './load-dream.mjs';

const url=name=>new URL('../dist/assets/'+name,import.meta.url);
const near=(a,b,eps)=>Math.abs(a-b)<eps;
// Every vertex of the meshes under `root`, in world space.
function vertices(root){
  const pts=[],v=new THREE.Vector3();root.updateMatrixWorld(true);
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)pts.push(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).clone());});
  return pts;
}
// Algebraic least-squares sphere through `pts`: |p|² = 2p·c + (r² − |c|²).
function fitSphere(pts){
  const A=new Array(16).fill(0),b=[0,0,0,0];
  for(const p of pts){const row=[2*p.x,2*p.y,2*p.z,1],y=p.lengthSq();for(let i=0;i<4;i++){b[i]+=row[i]*y;for(let j=0;j<4;j++)A[i*4+j]+=row[i]*row[j];}}
  const x=new THREE.Vector4(...b).applyMatrix4(new THREE.Matrix4().set(...A).invert()),center=new THREE.Vector3(x.x,x.y,x.z);
  return {center,radius:Math.sqrt(Math.max(0,x.w+center.lengthSq()))};
}
// The sphere most of `pts` lie on, seeded by a guess: the modal distance from
// the guessed centre picks the orb out from the fruit and sprouts, and the
// vertices near that radius are fitted, twice.
function refitOrb(pts,center,radius){
  let inliers=[];
  for(let pass=0;pass<2;pass++){
    const d=pts.map(p=>p.distanceTo(center)),bin=radius/40,bins=new Array(81).fill(0);
    for(const x of d)bins[Math.min(80,Math.floor(x/bin))]++;
    let best=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[best])best=i;
    const modal=(best+.5)*bin;
    inliers=pts.filter((p,i)=>Math.abs(d[i]-modal)<modal*.06);
    ({center,radius}=fitSphere(inliers));
  }
  return {center,radius,inliers};
}
const firstMesh=root=>{let m=null;root.traverse(o=>{if(o.isMesh&&!m)m=o;});return m;};

// --- 1. the shipped files and their manifest --------------------------------------------
const manifest=JSON.parse(await readFile(url('dream-assets.json')));
// The models shipped without their metallic-roughness map (a roughness map
// multiplies the roughness clayMaterials has just pinned), and the garden's
// three scenery pieces among them.
const GARDEN=new Set(['pillar','pebbles','mountain']),MATTE=new Set(['hat','arch','eyeball',...GARDEN]);
const bare={};await attachDream(bare);
for(const [key,file]of Object.entries(DREAM_FILES)){
  const entry=manifest[file];assert(entry,file+' is in dream-assets.json');
  const bytes=await readFile(url(file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.shippedSha256,file+' is the file the manifest describes');
  assert.equal(bytes.length,entry.shippedBytes);
  assert(entry.textures.length>0&&entry.textures.every(([w,h])=>w<=1024&&h<=1024),file+' ships textures at 1024 or less');
  // Geometry is copied through from the upload, except where the manifest
  // says how it was adapted — and then the digests still pin what shipped.
  assert(entry.geometryUnchanged||typeof entry.adaptation==='string',file+' ships its upload\'s geometry or says how it was adapted');
  assert(entry.geometryBufferSha256.length>0);
  let triangles=0,meshes=0;
  bare.dreamAssets[key].scene.traverse(o=>{
    if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    assert(o.material.map,file+' keeps its colour map');assert(o.castShadow&&o.receiveShadow);
    assert(bare.assetGeometry.has(o.geometry)&&bare.assetMaterials.has(o.material),'retained across level rebuilds');
    // The three models whose metallic-roughness map was left out of the
    // shipped file: a roughness map multiplies the roughness clayMaterials has
    // just pinned, so shipping one would make that model the one glossy prop.
    if(MATTE.has(key))assert(!o.material.roughnessMap&&!o.material.metalnessMap,file+' has no roughness map to make it the one glossy prop');
    // The garden's scenery is tagged like a fixed colour, so the side scenery
    // in front of its decks (depth-scenery.js) clones and fades the pebble
    // pile over the player instead of leaving the shared material alone.
    assert.equal(!!o.material.userData.fixed,GARDEN.has(key),file+(GARDEN.has(key)?' is tagged fixed for the foreground fade':' keeps its material untagged'));
    // The eyeball is a closed ball pressed into clay; its inside is never the
    // near face, and drawing it would let the dark cap the bake mirrored onto
    // its back show through any hairline at the socket's rim.
    if(key==='eyeball')assert.equal(o.material.side,THREE.FrontSide,'the eyeball draws front faces only');
    // The two creatures are skinned — the giraffe as it arrived, the
    // caterpillar by dream-rigs.js at load — and never frustum-culled.
    assert.equal(!!o.isSkinnedMesh,key==='caterpillar'||key==='giraffe',file+(o.isSkinnedMesh?' is skinned':' is a plain mesh'));
    if(o.isSkinnedMesh)assert(o.frustumCulled===false&&o.skeleton.bones.length>1,file+' keeps its skeleton and is never culled');
  });
  assert.equal(meshes,1);assert.equal(triangles,entry.triangles,file+' has the triangles the manifest counted');
  if(key==='caterpillar'||key==='giraffe')assert(entry.geometryUnchanged,file+' ships its upload\'s geometry');
}
assert.equal(manifest['dream-giraffe.glb'].joints,40,'the giraffe ships its forty vendor joints');
// The hat arrived at 324,212 triangles and the parade stacks five of it: the
// shipped one is the decimated copy, and a re-preparation cannot put the
// upload's geometry back without failing here.
assert(!manifest['dream-hat.glb'].geometryUnchanged&&/simplify/.test(manifest['dream-hat.glb'].adaptation),'the hat ships decimated');
assert(manifest['dream-hat.glb'].triangles<=12000,`the hat stays light (${manifest['dream-hat.glb'].triangles} triangles)`);
assert.equal(manifest['dream-hat.glb'].textures.length,2,'the hat ships its colour and normal maps only');
console.log(`PASS the ${Object.keys(DREAM_FILES).length} dream models match their manifest: fingerprints, sizes, 1024 textures, triangle counts, retained resources; the hat is the decimated, matte copy; the two creatures are skinned`);

// --- 2. each planet's core orb is where the constants say ---------------------------------
for(const [key,orb]of Object.entries(PLANET_ORBS)){
  const pts=vertices(bare.dreamAssets[key].scene),seed=new THREE.Vector3(...orb.center);
  const fit=refitOrb(pts,seed,orb.radius);
  assert(fit.center.distanceTo(seed)<orb.radius*.01,`${key}: fitted orb centre ${fit.center.toArray().map(v=>v.toFixed(4))} against ${orb.center}`);
  assert(near(fit.radius,orb.radius,orb.radius*.01),`${key}: fitted orb radius ${fit.radius.toFixed(4)} against ${orb.radius}`);
  assert(fit.inliers.length/pts.length>.3,`${key}: most of the orb's surface is on the sphere (${fit.inliers.length}/${pts.length})`);
  // The decoration really does reach past the orb — it is what the fit rejects.
  assert(pts.some(p=>p.distanceTo(seed)>orb.radius*1.25),key+' has sprouts beyond the orb');
}
console.log('PASS both planets\' core orbs re-fit from the shipped vertices to within 1% of PLANET_ORBS');

// --- 2b. the corridor's eyeball is the sphere EYEBALL says it is ---------------------------
// No modal-radius trick and no sprouts to reject here: the upload IS a ball,
// and that is the point — the corridor turns it to aim a pupil painted on it,
// so a re-export that dented it would swing the silhouette about as it looked
// around. A plain fit over every vertex, with the worst residual held under 5%.
{
  const pts=vertices(bare.dreamAssets.eyeball.scene),fit=fitSphere(pts);
  const want=new THREE.Vector3(...EYEBALL.centre);
  assert(fit.center.distanceTo(want)<EYEBALL.radius*.01,`the eyeball's fitted centre ${fit.center.toArray().map(v=>v.toFixed(4))} is where EYEBALL says (${EYEBALL.centre})`);
  assert(near(fit.radius,EYEBALL.radius,EYEBALL.radius*.01),`the eyeball's fitted radius ${fit.radius.toFixed(4)} is EYEBALL's ${EYEBALL.radius}`);
  let worst=0;for(const p of pts)worst=Math.max(worst,Math.abs(p.distanceTo(fit.center)-fit.radius));
  assert(worst<EYEBALL.radius*.05,`the eyeball is a ball to turn, not a lump (worst residual ${worst.toFixed(4)})`);
  // The painted pupil cannot be re-measured here — that needs the colour JPEG
  // decoded, which Node will not do unaided — so what is pinned instead is the
  // two maps that shipped and the cone the corridor turns the ball inside. The
  // bake mirrored a second dark cap of about 22° onto the ball's back, so it
  // reaches the silhouette at 90° − 22° = 68° of turn: widen GAZE past that in
  // some later visual pass and a black disc slides onto the ball's edge, which
  // is exactly the failure nobody catches by eye.
  assert.equal(manifest['dream-eyeball.glb'].textures.length,2,'the eyeball ships its colour and normal maps only');
  const cone=Math.atan(Math.hypot(GAZE.x,GAZE.y))*180/Math.PI;
  assert(cone<68,`the corridor turns the ball ${cone.toFixed(1)}° at most, inside the 68° that would bring the bake's mirrored back cap into view`);
  console.log(`PASS the corridor's eyeball re-fits to r ${fit.radius.toFixed(4)} within 1% of EYEBALL, worst residual ${(worst/fit.radius*100).toFixed(1)}%; the gaze cone is ${cone.toFixed(1)}° of the 68° the mirrored back cap allows`);
}

// --- 3. placements: clones share resources, the orb sits on the origin, the bowl top on the plane, the sculpture's box on the origin
{
  const a=new THREE.Group(),b=new THREE.Group();
  const p1=dreamPlanet(bare,'mint',a,3),p2=dreamPlanet(bare,'mint',b,2);
  assert.equal(firstMesh(p1).geometry,firstMesh(p2).geometry);assert.equal(firstMesh(p1).material,firstMesh(p2).material);
  b.updateMatrixWorld(true);
  const model=p2.getObjectByName('Supplied clay planet');
  assert(near(model.getWorldScale(new THREE.Vector3()).x*PLANET_ORBS.mint.radius,2,1e-9),'the orb is scaled to the asked radius');
  assert(model.localToWorld(new THREE.Vector3(...PLANET_ORBS.mint.center)).length()<1e-9,'the orb centre sits on the parent origin');
  const s1=dreamSaucer(bare,'saucerMint',a,3),s2=dreamSaucer(bare,'saucerRaspberry',a,2.4);
  a.updateMatrixWorld(true);
  for(const [saucer,width]of [[s1,3],[s2,2.4]]){
    const box=new THREE.Box3().setFromObject(saucer,true);
    assert(near(box.max.x-box.min.x,width,1e-6),'a saucer is the asked width');
    assert(near(box.max.y,0,1e-6),'its top face is the parent plane');assert(box.min.y<-width*.45,'and the bowl hangs below');
    assert(near(box.min.x+box.max.x,0,1e-6)&&near(box.min.z+box.max.z,0,1e-6),'centred on the origin');
  }
  // The sculpture: `width` across with its box centred on the origin, so a canopy piece turns about its middle.
  const c1=dreamSculpture(bare,'sculpture',a,8),c2=dreamSculpture(bare,'sculpture',b,6);
  assert.equal(firstMesh(c1).geometry,firstMesh(c2).geometry);assert.equal(firstMesh(c1).material,firstMesh(c2).material);
  a.updateMatrixWorld(true);b.updateMatrixWorld(true);
  for(const [piece,width]of [[c1,8],[c2,6]]){
    const box=new THREE.Box3().setFromObject(piece,true),size=box.getSize(new THREE.Vector3());
    assert(near(size.x,width,1e-6),'a sculpture is the asked width');
    assert(near(box.min.x+box.max.x,0,1e-6)&&near(box.min.y+box.max.y,0,1e-6)&&near(box.min.z+box.max.z,0,1e-6),'its box is centred on the origin, to turn about');
    assert(piece.userData.size.distanceTo(size)<1e-6,'and it reports the placed box for seating');
    assert(size.y>width*.4&&size.y<width*.5&&size.z>width*.45&&size.z<width*.55,'the loaf keeps its proportions under the uniform fit');
  }
  // The hat: brim `width` across, foot on the origin, standing as tall as dreamHatHeight says.
  const h1=dreamHat(bare,a,1.56),h2=dreamHat(bare,b,1.16);
  assert.equal(firstMesh(h1).geometry,firstMesh(h2).geometry);assert.equal(firstMesh(h1).material,firstMesh(h2).material);
  a.updateMatrixWorld(true);b.updateMatrixWorld(true);
  for(const [hat,width]of [[h1,1.56],[h2,1.16]]){
    const box=new THREE.Box3().setFromObject(hat,true);
    assert(near(box.max.x-box.min.x,width,1e-6),'a hat is the asked width across the brim');
    assert(near(box.max.z-box.min.z,width,width*.01),'and as deep as it is wide — a round brim');
    assert(near(box.min.y,0,1e-6),'its foot is on the parent plane');
    assert(near(box.max.y,dreamHatHeight(bare,width),1e-6),'and it stands as tall as dreamHatHeight says');
    assert(box.max.y>width*.6&&box.max.y<width*.8,`a hat is taller than the sculpted boater was (${(box.max.y/width).toFixed(3)} of its width)`);
    assert(near(box.min.x+box.max.x,0,1e-6)&&near(box.min.z+box.max.z,0,1e-6),'centred on the origin');
  }
}
console.log('PASS planet, saucer, sculpture and hat placements: shared geometry and material, orb on the origin at the asked radius, bowl top on the plane, sculpture box centred, hat foot on the plane at the asked width');

// --- 4. the orchard built on a CPU World ----------------------------------------------------
// The rig tests/dream-sections.mjs uses, with the dream's models attached.
async function cpuWorld(){
  const w=Object.create(World.prototype);
  w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
  for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
  w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
  w.camera=new THREE.OrthographicCamera(-6,6,3.3,-3.3,.1,160);
  w.renderer={render(){},setRenderTarget(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
  w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
  const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
  attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
  await attachClay(w);
  await attachDream(w);
  return w;
}
const INDEX=LEVELS.findIndex(L=>L.biome==='dream'),orchard=MODULES.find(m=>m.key==='orchard');
const w=await cpuWorld();
let sharedDisposals=0;for(const resource of [...w.assetGeometry,...w.assetMaterials])resource.addEventListener('dispose',()=>sharedDisposals++);
const L=soloSection(orchard),g=new Game();g.start(INDEX,L);
const platform=id=>{const s=g.level.platforms.find(p=>p.id===id);assert(s,id+' is in the solo orchard');return s;};
const DOMES=[['orchard-dome-1','mint'],['orchard-dome-2','raspberry']];
const SAUCERS=['orchard-saucer-1','orchard-saucer-2','orchard-apple-perch','orchard-under','orchard-root-1'];

w.build(g.level,INDEX,14);w.scene.updateMatrixWorld(true);
for(const [id,key]of DOMES){
  const s=platform(id),view=w.platforms.get(id),r=s.w/2,orb=PLANET_ORBS[key];
  assert.equal(s.kind,'dome');assert(view?.dream?.sphere,id+' keeps the dome view the spin turns');
  const sphere=view.dream.sphere,planet=sphere.getObjectByName('Dream planet '+key);
  assert(planet,`${id} carries the ${key} planet under the dome sphere`);
  for(const name of ['Dome ball','Dome dot','Dome band','Dome equator'])assert(!sphere.getObjectByName(name),`${name} has left ${id}`);
  const model=planet.getObjectByName('Supplied clay planet'),collider=new THREE.Vector3(s.x+r,s.y-r,0);
  const centre=model.localToWorld(new THREE.Vector3(...orb.center));
  assert(centre.distanceTo(collider)<1e-6,`${id}: orb centre ${centre.toArray()} on the collider centre ${collider.toArray()}`);
  assert(near(model.getWorldScale(new THREE.Vector3()).x*orb.radius,r,1e-3),`${id}: orb radius is the collider radius ${r}`);
  // End to end: the shipped vertices that make up the orb lie on the arc the player runs on.
  const fit=refitOrb(vertices(model),collider,r);
  assert(fit.center.distanceTo(collider)<r*.01&&near(fit.radius,r,r*.01),`${id}: the drawn orb is the collider (centre ${fit.center.toArray().map(v=>v.toFixed(3))}, radius ${fit.radius.toFixed(3)})`);
  model.traverse(o=>{if(o.isMesh){assert(o.material.userData.clay,'the planet wears the clay surface');assert.equal(o.material.bumpMap,w.clay.detail);}});
}
console.log('PASS both orchard domes are the supplied planets, core orb on the collider centre at its radius, primitives gone, clay surface on');

w.syncVisible(g.level,40,true);w.scene.updateMatrixWorld(true);
const bowls=new Set();
for(const id of SAUCERS){
  const s=platform(id),view=w.platforms.get(id);assert(view?.root,id+' is streamed in around x 40');
  const saucer=view.root.children.find(c=>/^Dream saucer /.test(c.name));assert(saucer,id+' hangs a supplied saucer');bowls.add(saucer.name);
  for(const name of ['Saucer bowl','Saucer lip','Saucer cushion'])assert(!view.root.getObjectByName(name),`${name} has left ${id}`);
  assert(view.root.getObjectByName('Canopy rope')&&view.rope,id+' still hangs from the canopy');
  const box=new THREE.Box3().setFromObject(saucer,true);
  assert(near(box.max.y,s.y,1e-6),`${id}: the bowl's top is the walk plane ${s.y} (got ${box.max.y})`);
  assert(near((box.min.x+box.max.x)/2,s.x+s.w/2,1e-6),id+' is centred on its deck');
  assert(box.max.x-box.min.x>s.w,id+' is a touch wider than its deck');
  // The flat top spans the deck: within .1 of the plane the frosting reaches both ends of the walk.
  const top=vertices(saucer).filter(p=>p.y>s.y-.1),xs=top.map(p=>p.x);
  assert(Math.min(...xs)<s.x+.15&&Math.max(...xs)>s.x+s.w-.15,`${id}: the flat top covers the deck (${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)} for ${s.x}..${s.x+s.w})`);
  saucer.traverse(o=>{if(o.isMesh)assert(o.material.userData.clay,'the saucer wears the clay surface');});
}
assert.equal(bowls.size,2,'both bowls appear across the orchard\'s five saucers: '+[...bowls].join(', '));
console.log('PASS all five rope-hung saucers are the supplied bowls, top on the walk plane and spanning the deck, rope kept, both bowls used');

// The canopy: every streamed canopy prop hangs two sculptures as modelled, the
// balls gone, the apples kept; the twelve differ in size and turn; and each
// rope's top ends inside a piece's box — the foot and the overhanging sides
// that face the player hide it.
const canopyGroups=()=>[...Array(6).keys()].map(i=>w.levelRoot.getObjectByName('dream:orchard:canopy-'+i)).filter(Boolean);
{
  const groups=canopyGroups(),pieces=[],boxes=[];
  assert(groups.length>=2,'canopy props are streamed in around x 40 ('+groups.length+')');
  for(const prop of groups){
    const here=prop.getObjectByName('Orchard canopy').children.filter(c=>/^Dream sculpture /.test(c.name));
    assert.equal(here.length,2,prop.name+' hangs two sculptures');
    assert(!prop.getObjectByName('Canopy ball'),'the balls have left '+prop.name);
    assert(prop.getObjectByName('Hanging fruit'),'fruit still hangs under '+prop.name);
    assert(prop.getObjectByName('Canopy leaf'),'and leaves push out from under '+prop.name);
    pieces.push(...here);
  }
  for(const piece of pieces){
    assert(Math.abs(piece.rotation.x)<=.08&&Math.abs(piece.rotation.z)<=.08&&Math.abs(piece.rotation.y)<=.22,'a piece hangs as modelled, turned and tilted only subtly');
    const box=new THREE.Box3().setFromObject(piece,true);boxes.push(box);
    assert(near(box.max.x-box.min.x,piece.userData.size.x,piece.userData.size.x*.03),'its width survives the turn to within 3%');
    piece.traverse(o=>{if(o.isMesh)assert(o.material.userData.clay,'the canopy wears the clay surface');});
  }
  assert(new Set(pieces.map(p=>p.userData.size.x.toFixed(3))).size>1,'the pieces are not all one width');
  assert(new Set(pieces.map(p=>p.rotation.y.toFixed(3))).size>1,'nor all one turn');
  let ropes=0;
  for(const id of SAUCERS){
    const view=w.platforms.get(id),anchor=view.rope.userData.ceiling;if(!anchor)continue;
    const at=view.rope.getWorldPosition(new THREE.Vector3());
    const over=boxes.filter(b=>b.min.x<=at.x&&at.x<=b.max.x&&b.min.z<=at.z&&at.z<=b.max.z);
    if(!over.length)continue;ropes++;
    const under=Math.min(...over.map(b=>b.min.y)),above=Math.max(...over.map(b=>b.max.y));
    assert(under<anchor.y&&anchor.y<above,`${id}: the rope top ${anchor.y.toFixed(2)} ends inside the canopy (${under.toFixed(2)}..${above.toFixed(2)})`);
  }
  assert(ropes>=2,'at least two streamed ropes rise under a streamed piece ('+ropes+')');
  console.log(`PASS the canopy is the supplied sculpture, hung as modelled with subtle variety, balls gone, fruit and leaves kept: ${groups.length} props, ${pieces.length} pieces, ${ropes} rope tops inside it`);
}

// The great tree's crown: four of the supplied fruit sculpture hung by their
// tops under the trunk's foot, behind the walk plane, wearing the clay
// surface; the clay-built iced apples only stand in without the model.
{
  const s=platform('orchard-trunk'),tree=w.platforms.get('orchard-trunk');assert(tree?.root,'the great tree is streamed in around x 40');
  const fruit=[];tree.root.traverse(o=>{if(/^Dream fruit/.test(o.name))fruit.push(o);});
  assert.equal(fruit.length,4,'the crown is four supplied fruit');
  assert(!tree.root.getObjectByName('Crown apple')&&!tree.root.getObjectByName('Crown ball'),'the clay crown has left the tree');
  for(const f of fruit){
    const box=new THREE.Box3().setFromObject(f,true),top=f.getWorldPosition(new THREE.Vector3());
    assert(near(box.max.y,top.y,1e-6),'a fruit hangs by its top');
    assert(box.max.y<s.y-4&&box.max.z<0,'and hangs under the trunk, behind the walk plane');
    f.traverse(o=>{if(o.isMesh)assert(o.material.userData.clay,'the fruit wears the clay surface');});
  }
  assert(new Set(fruit.map(f=>f.userData.size.x.toFixed(3))).size>1&&new Set(fruit.map(f=>f.rotation.y.toFixed(3))).size>1,'the four differ in size and turn');
  assert(tree.roots?.length===8,'the roots still wave');
  console.log('PASS the great tree\'s crown is four supplied fruit, hung by their tops under the trunk, varied, clay surface on');
}

// Streaming out and back in keeps the shared resources and brings the models back.
w.syncVisible(g.level,900,true);assert(!w.platforms.get('orchard-dome-1'),'the domes stream out far away');
w.syncVisible(g.level,14,true);
assert(w.platforms.get('orchard-dome-1').dream.sphere.getObjectByName('Dream planet mint'),'the planet is back after streaming');
assert.equal(sharedDisposals,0,'no shared geometry or material was disposed by streaming');

// --- 5. the fallback: a rig without the models still builds the sculpted dressing ---------
{
  const saved=w.dreamAssets;w.dreamAssets=null;w.refreshEditor(g.level,14);
  const sphere=w.platforms.get('orchard-dome-1').dream.sphere;
  assert(sphere.getObjectByName('Dome ball')&&sphere.getObjectByName('Dome equator'),'without the planets the dome is the mint ball with its equator');
  assert(!sphere.getObjectByName('Dream planet mint'));
  assert(w.platforms.get('orchard-saucer-1').root.getObjectByName('Saucer bowl'),'and a saucer is the sculpted bowl');
  const fallen=canopyGroups();assert(fallen.length>0,'a canopy prop is streamed in around x 14');
  for(const prop of fallen)assert(prop.getObjectByName('Canopy ball')&&!prop.getObjectByName('Supplied clay sculpture'),'and the canopy is the raspberry balls again under '+prop.name);
  w.syncVisible(g.level,40,true);
  const bare=w.platforms.get('orchard-trunk').root;
  assert(bare.getObjectByName('Crown apple')&&!bare.getObjectByName('Dream fruit'),'and the great tree\'s crown is the clay iced apples');
  w.syncVisible(g.level,14,true);
  w.dreamAssets=saved;w.refreshEditor(g.level,14);
  assert(w.platforms.get('orchard-dome-1').dream.sphere.getObjectByName('Dream planet mint'),'restored, the planet returns');
  assert(w.platforms.get('orchard-saucer-1').root.children.some(c=>/^Dream saucer /.test(c.name)));
  for(const prop of canopyGroups())assert(prop.getObjectByName('Supplied clay sculpture')&&!prop.getObjectByName('Canopy ball'),'and so does the canopy sculpture under '+prop.name);
  assert.equal(sharedDisposals,0,'rebuilding disposes nothing shared');
}
console.log('PASS a rig without the dream models falls back to the sculpted dome, saucer and canopy balls, and rebuilding keeps shared resources');

// --- 6. the rider's spin still turns the planet -------------------------------------------
{
  const s=platform('orchard-dome-1');s.domeSpin=.7;animateDreamViews(w,g,0);
  const sphere=w.platforms.get('orchard-dome-1').dream.sphere;
  assert.equal(sphere.rotation.z,-.7,'the sphere group turns by the rider\'s travel');
  assert.equal(sphere.getObjectByName('Dream planet mint').parent,sphere,'and the planet turns with it');
}
console.log('PASS the dome spin turns the supplied planet');

// --- 7. the parade's hat stack --------------------------------------------------------------
// Five supplied hats on the hat-worm's coil, widest at the foot, each foot a
// nested step up the crown below; pulling the worm tumbles every one to the
// bridge's back exactly where the sculpted hats went; the model survives
// streaming, and a rig without it gets the sculpted hats back.
{
  const parade=[...MODULES,...SHELVED].find(m=>m.key==='parade'),L=soloSection(parade),g=new Game();g.start(INDEX,L);
  const worm=g.level.platforms.find(p=>p.id==='parade-worm');assert(worm?.shape?.from,'the solo parade has the hat-worm');
  const cx=worm.shape.from.x+worm.shape.from.w/2,top=worm.shape.from.y,bridgeTop=worm.shape.to.y;
  const station=g.level.shaping.find(s=>s.id==='parade-worm');assert(station,'and its pull station');
  w.build(g.level,INDEX,cx);w.syncVisible(g.level,cx,true);w.scene.updateMatrixWorld(true);
  const stack=()=>{const s=w.levelRoot.getObjectByName('dream:parade:hats');assert(s,'the hat stack is streamed in at the plinth');return s;};
  const hatsOf=prop=>[1,2,3,4,5].map(i=>{const h=prop.getObjectByName('Hat '+i);assert(h,'Hat '+i+' is on the stack');return h;});
  let prop=stack(),hats=hatsOf(prop);
  assert(near(prop.position.x,cx,1e-9)&&near(prop.position.y,top,1e-9),'the stack stands on the coil\'s top');
  assert(HAT_WIDTHS.length===5&&HAT_WIDTHS.every((v,i)=>i===0||v<HAT_WIDTHS[i-1]),'five brims, widest at the foot');
  assert(HAT_NEST>.75&&HAT_NEST<1,'each hat sits on the crown below, sunk into it a little');
  let foot=0;
  hats.forEach((hat,i)=>{
    const model=hat.getObjectByName('Dream hat');assert(model,`Hat ${i+1} is the supplied hat`);
    for(const name of ['Hat brim','Hat crown','Hat band'])assert(!hat.getObjectByName(name),`${name} has left Hat ${i+1}`);
    assert(near(hat.position.x,0,1e-9)&&near(hat.position.y,foot,1e-9)&&near(hat.position.z,0,1e-9),`Hat ${i+1} rests at ${foot.toFixed(3)} up the stack`);
    const box=new THREE.Box3().setFromObject(model,true);
    assert(near(box.max.x-box.min.x,HAT_WIDTHS[i],1e-6),`Hat ${i+1} is ${HAT_WIDTHS[i]} across the brim`);
    assert(near(box.min.y,top+foot,1e-6),`Hat ${i+1}'s foot is on its step (${box.min.y} for ${top+foot})`);
    assert(near((box.min.x+box.max.x)/2,cx,1e-6),`Hat ${i+1} is centred over the plinth`);
    model.traverse(o=>{if(o.isMesh){assert(o.material.userData.clay,'the hat wears the clay surface');assert.equal(o.material.bumpMap,w.clay.detail);}});
    foot+=dreamHatHeight(w,HAT_WIDTHS[i])*HAT_NEST;
  });
  assert(foot>3&&foot<4.5,`the stack's last step is ${foot.toFixed(2)} up: taller than the boaters' 3.1, still near the frame`);
  console.log(`PASS the parade stacks five supplied hats on the coil, ${HAT_WIDTHS[0]} to ${HAT_WIDTHS[4]} across, feet at nested steps to ${foot.toFixed(2)}, primitives gone, clay surface on`);

  // The pull, all the way: every hat has tumbled to the bridge's back edge —
  // the same keyframes the sculpted hats had — and landed nearly upright.
  station.amount=1;g.player.x=cx;animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  hats.forEach((hat,i)=>{
    assert(near(hat.position.x,1.6+i*1.55,1e-9)&&near(hat.position.y,bridgeTop-top+.1,1e-9)&&near(hat.position.z,-.9,1e-9),`Hat ${i+1} landed on the bridge's back, spaced along it`);
    const turn=Math.abs(((hat.rotation.z%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI);
    assert(turn<.5,`Hat ${i+1} settled almost upright (${turn.toFixed(2)} rad off)`);
    const box=new THREE.Box3().setFromObject(hat.getObjectByName('Dream hat'),true);
    assert(near((box.min.x+box.max.x)/2,cx+1.6+i*1.55,.5),`Hat ${i+1}'s model went with its group`);
    assert(box.min.y>bridgeTop-.35&&box.min.y<bridgeTop+.15,`Hat ${i+1} sits on the bridge top ${bridgeTop} (lowest point ${box.min.y.toFixed(2)})`);
  });
  station.amount=0;animateDream(w,g,0);
  hats.forEach((hat,i)=>assert(near(hat.position.x,0,1e-9)&&near(hat.position.z,0,1e-9)&&near(hat.rotation.z,0,1e-9),`Hat ${i+1} is back on the stack at no pull`));
  console.log('PASS pulling the worm tumbles all five supplied hats onto the bridge\'s back edge, and no pull stacks them again');

  // Streaming out and back keeps the shared model; a rig without it falls back to the sculpted hats.
  w.syncVisible(g.level,900,true);assert(!w.levelRoot.getObjectByName('dream:parade:hats'),'the stack streams out far away');
  w.syncVisible(g.level,cx,true);
  assert(stack().getObjectByName('Hat 3').getObjectByName('Dream hat'),'the supplied hat is back after streaming');
  assert.equal(sharedDisposals,0,'no shared geometry or material was disposed by streaming');
  const saved=w.dreamAssets;w.dreamAssets=null;w.refreshEditor(g.level,cx);
  prop=stack();hats=hatsOf(prop);
  hats.forEach((hat,i)=>{
    assert(!hat.getObjectByName('Dream hat'),`without the model Hat ${i+1} is not the supplied hat`);
    assert(hat.getObjectByName('Hat brim')&&hat.getObjectByName('Hat crown'),`Hat ${i+1} is the sculpted brim and crown`);
    assert(near(hat.position.y,i*.62,1e-9),'stacked at the boaters\' step');
  });
  assert(hats[2].getObjectByName('Hat band'),'the third sculpted hat keeps its bubblegum band');
  w.dreamAssets=saved;w.refreshEditor(g.level,cx);
  assert(stack().getObjectByName('Hat 1').getObjectByName('Dream hat'),'restored, the supplied hat returns');
  assert.equal(sharedDisposals,0,'rebuilding disposes nothing shared');
  console.log('PASS the hat stack survives streaming, and a rig without the model falls back to the sculpted hats');
}

// --- 8. the caterpillar's rig -------------------------------------------------------------
// Built at load from the static upload: one root and a station bone per entry
// of CATERPILLAR_RIG, every vertex shared between the two stations around it,
// the tail and the face rigid. Turning the head bone on a clone moves the face
// and leaves the tail exactly where it was.
{
  const scene=bare.dreamAssets.caterpillar.scene,mesh=firstMesh(scene),{stations}=CATERPILLAR_RIG;
  assert(stations.every((x,i)=>i===0||x>stations[i-1]),'stations run tail to head');
  assert.equal(mesh.skeleton.bones.length,stations.length,'one bone per station');
  assert.equal(mesh.skeleton.bones.at(-1).name,CATERPILLAR_HEAD,'the last station is the head bone');
  assert(scene.getObjectByName('Caterpillar root')&&scene.getObjectByName(CATERPILLAR_HEAD),'the bones live under the scene, where a clone finds them');
  const g=mesh.geometry,p=g.attributes.position,idx=g.attributes.skinIndex,wt=g.attributes.skinWeight,headIndex=stations.length-1;
  assert(idx&&wt&&idx.itemSize===4&&wt.itemSize===4,'four-wide skin attributes');
  let tail=0,face=0;
  for(let i=0;i<p.count;i++){
    let sum=0,head=0;
    for(let k=0;k<4;k++){const w=wt.getComponent(i,k);sum+=w;assert(idx.getComponent(i,k)<stations.length);if(idx.getComponent(i,k)===headIndex)head+=w;}
    assert(near(sum,1,1e-3),`vertex ${i} weights sum to one (${sum})`);
    const x=p.getX(i);
    if(x<-.3){tail++;assert.equal(head,0,'the tail owes nothing to the head bone');}
    if(x>stations[headIndex]+.02){face++;assert(near(head,1,1e-6),`the face at x ${x.toFixed(2)} is the head bone's alone (${head})`);}
  }
  assert(tail>500&&face>500,`plenty of tail (${tail}) and face (${face}) vertices to have checked`);
  const stage=new THREE.Group(),model=clone(scene);stage.add(model);stage.updateMatrixWorld(true);
  const rest=skinnedBox(model,stage),skinned=firstMesh(model),v=new THREE.Vector3();
  assert(near(rest.min.x,bare.dreamAssets.caterpillar.box.min.x,1e-5)&&near(rest.max.y,bare.dreamAssets.caterpillar.box.max.y,1e-5),'at rest the skin reproduces the upload');
  let tailVertex=0,nose=0;for(let i=0;i<p.count;i++){if(p.getX(i)<p.getX(tailVertex))tailVertex=i;if(p.getX(i)>p.getX(nose))nose=i;}
  const tailBefore=skinned.getVertexPosition(tailVertex,v).clone(),noseBefore=skinned.getVertexPosition(nose,v).clone();
  model.getObjectByName(CATERPILLAR_HEAD).rotation.z=.4;stage.updateMatrixWorld(true);
  const moved=skinned.getVertexPosition(nose,v).distanceTo(noseBefore);
  assert(moved>.03&&moved<.1,`turning the head bone .4 rad swings the nose about the neck (${moved.toFixed(3)})`);
  assert(skinned.getVertexPosition(tailVertex,v).distanceTo(tailBefore)<1e-9,'and the tail vertex has not moved');
  assert(bare.dreamAssets.caterpillar.scene.getObjectByName(CATERPILLAR_HEAD).rotation.z===0,'the clone turned, not the shared asset');
  console.log(`PASS the caterpillar is rigged at load: ${stations.length} stations, weights normalised, rigid tail and face, the head bone turns the face on a clone alone`);
}

// --- 9. the creatures' placements ----------------------------------------------------------
// The caterpillar `length` long with its feet on the plane; the giraffe posed
// for the parade — spine along +x, back at backTop, feet on the plane, withers
// where asked — with its posed rest kept for the animation to layer on.
{
  const a=new THREE.Group(),b=new THREE.Group();
  const worm=dreamCaterpillar(bare,a,1.3);a.updateMatrixWorld(true);
  const box=skinnedBox(worm.model,a);
  assert(near(box.max.x-box.min.x,1.3,1e-6)&&near(box.min.y,0,1e-6)&&near((box.min.x+box.max.x)/2,0,1e-6),`the caterpillar is 1.3 long, feet on the plane, centred (${box.min.x.toFixed(3)}…${box.max.x.toFixed(3)})`);
  assert(worm.head?.isBone&&worm.rest.length===CATERPILLAR_RIG.stations.length+1&&worm.model.name==='Supplied clay caterpillar','it hands back its head bone and rest pose');
  const giraffe=dreamGiraffe(bare,b,{backTop:4,withersX:7});b.updateMatrixWorld(true);
  assert(near(giraffe.scale,4/GIRAFFE_POSE.backTop,1e-9),'scaled by the back\'s height');
  assert(Math.abs(giraffe.yaw)>.4&&Math.abs(giraffe.yaw)<.6,`yawed to lay the spine along x (${(giraffe.yaw*180/Math.PI).toFixed(1)}°)`);
  const s0=giraffe.model.getObjectByName(GIRAFFE_BONES.spine[0]).getWorldPosition(new THREE.Vector3()),s3=giraffe.bones.withers.getWorldPosition(new THREE.Vector3());
  assert(Math.abs(s3.z-s0.z)<.1&&s3.x>s0.x+4,`the spine runs along x after the yaw (${s0.x.toFixed(2)},${s0.z.toFixed(2)} → ${s3.x.toFixed(2)},${s3.z.toFixed(2)})`);
  assert(near(s3.x,7,1e-6),`the withers stand at the asked x (${s3.x.toFixed(3)})`);
  const gbox=skinnedBox(giraffe.model,b);
  assert(near(gbox.min.y,0,1e-6),`feet on the plane (${gbox.min.y})`);
  assert(near((gbox.min.z+gbox.max.z)/2,0,1e-6),'centred across');
  assert(giraffe.bones.neck.length===4&&giraffe.bones.hips.length===4&&giraffe.bones.knees.length===4&&giraffe.bones.neck.every(n=>n?.isBone)&&giraffe.bones.hips.every(n=>n?.isBone),'the neck, hips and knees are found by name');
  assert(giraffe.rest.length===40&&giraffe.model.name==='Supplied clay giraffe','forty bones in the posed rest');
  console.log(`PASS caterpillar and giraffe placements: feet on the plane, the caterpillar at length, the giraffe yawed ${(giraffe.yaw*180/Math.PI).toFixed(0)}°, back at height, withers at the asked x`);
}

// --- 10. the parade's giraffe and the hatworm on its back -------------------------------------
// The supplied giraffe is what the player climbs: the back deck lies along
// its back, the collar deck rests in the crook of its neck, the head deck is
// the top of its head, and nothing is built around them but the plaza step
// under the knee deck. Asleep it ignores the player; pulling the worm stirs it
// — the head lifts and turns to the player, the legs march on the spot — and
// with the player across, it turns and walks off left until hidden, home again
// the moment the player is back on the left. Reduced motion holds it still.
// The hatworm on the back is the supplied caterpillar in three supplied
// hats, walks on the bones, dies flat, and rides along (hidden) when it leaves.
{
  const parade=[...MODULES,...SHELVED].find(m=>m.key==='parade'),L=soloSection(parade),g=new Game();g.start(INDEX,L);
  const platform=id=>{const s=g.level.platforms.find(p=>p.id===id);assert(s,id+' is in the solo parade');return s;};
  const knee=platform('parade-knee'),back=platform('parade-back'),neck=platform('parade-neck'),headDeck=platform('parade-head');
  const station=g.level.shaping.find(st=>st.id==='parade-worm');
  w.reducedMotion=false;w.build(g.level,INDEX,back.x+3);w.syncVisible(g.level,back.x+3,true);g.player.x=back.x+3;animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  const view=w.platforms.get('parade-back');assert(view?.giraffe&&view.pivot,'the back deck view carries the giraffe rig on its pivot');
  const model=view.root.getObjectByName('Supplied clay giraffe');assert(model,'the supplied giraffe stands on the parade');
  const meshesUnder=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n++;});return n;};
  for(const name of ['Torso','Leg','Spot','Saddle','Saddle cushion','Collar','Bonnet','Neck','Petal','Knee','Thigh'])assert(!w.levelRoot.getObjectByName(name),name+' is not built around the supplied giraffe');
  assert.equal(meshesUnder(w.platforms.get('parade-neck').root),0,'the collar deck is the crook of the neck, nothing built');
  assert.equal(meshesUnder(w.platforms.get('parade-head').root),0,'the head deck is the head, nothing built');
  assert(w.platforms.get('parade-knee').root.getObjectByName('Podium cap'),'the knee deck is a step of the plaza');
  assert(!(w.dreamLeaners||[]).some(e=>e.group.name==='Giraffe face'),'no leaner: the neck itself leans');
  const box=skinnedBox(model,w.scene),v=new THREE.Vector3();
  assert(box.min.y>-.05&&box.min.y<.05,`feet on the plaza (${box.min.y.toFixed(3)})`);
  assert(box.min.x>knee.x-.6&&box.min.x<back.x,`the tail hangs over the plaza step (${box.min.x.toFixed(2)})`);
  // The body's surface under each deck the player stands on, in a band along its span.
  const surface=(s,from,to,step=.5)=>{const out=[];for(let x=s.x+from;x<s.x+to;x+=step){let top=-1e9;model.traverse(o=>{if(!o.isSkinnedMesh)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(Math.abs(v.x-x)<step/2&&Math.abs(v.z)<.9&&v.y>top)top=v.y;}});out.push(top-s.y);}return out;};
  const backSurface=surface(back,.25,back.w);
  assert(backSurface.every(d=>d>-.35&&d<.1),`the back lies along the back deck, within a hand of its top (${backSurface.map(d=>d.toFixed(2)).join(' ')})`);
  const crook=surface(neck,.25,neck.w);
  assert(crook.every(d=>d>-.45&&d<.3)&&crook.some(d=>Math.abs(d)<.15),`the collar deck rests in the crook of the neck (${crook.map(d=>d.toFixed(2)).join(' ')})`);
  // (the deck's ends hang a little past the head: the jaw at the back, the slope of the nose at the front)
  const crown=surface(headDeck,.75,headDeck.w-.4);
  assert(crown.every(d=>d>-.3&&d<.05)&&crown.some(d=>d>-.1),`the head deck is the top of the head (${crown.map(d=>d.toFixed(2)).join(' ')})`);
  assert(box.max.y>headDeck.y-.3&&box.max.y<headDeck.y+.05,`nothing rises through the head deck (${box.max.y.toFixed(2)} for ${headDeck.y})`);
  const withers=view.giraffe.bones.withers.getWorldPosition(new THREE.Vector3());
  assert(near(withers.x,back.x+back.w+GIRAFFE_WITHERS,1e-6),'the withers stand past the deck\'s end where GIRAFFE_WITHERS says');
  const tip=model.getObjectByName(GIRAFFE_BONES.neck[3]).getWorldPosition(new THREE.Vector3());
  assert(tip.x>headDeck.x&&tip.x<headDeck.x+headDeck.w,`the head is under the head deck (${tip.x.toFixed(2)} in ${headDeck.x}…${headDeck.x+headDeck.w})`);
  console.log(`PASS the parade's giraffe is the climb: back ${backSurface.map(d=>d.toFixed(2)).join('/')} of its deck, crook ${crook.map(d=>d.toFixed(2)).join('/')}, crown ${crown.map(d=>d.toFixed(2)).join('/')}, tail over the plaza step at ${box.min.x.toFixed(2)}`);

  // Asleep it ignores the player; stirred it turns to them; reduced motion holds it.
  const settle=(px,frames=150)=>{g.player.x=px;for(let i=0;i<frames;i++){g.time+=1/60;animateDream(w,g,1/60);}w.scene.updateMatrixWorld(true);return model.getObjectByName(GIRAFFE_BONES.neck[3]).getWorldPosition(new THREE.Vector3());};
  const asleepLeft=settle(L.platforms[0].x),asleepRight=settle(back.x+60);
  // (a little apart at most: the sleeping breath bobs the head, sampled at two moments)
  assert(Math.abs(asleepLeft.x-asleepRight.x)<.12,`asleep, the head does not follow the player (${asleepLeft.x.toFixed(2)} vs ${asleepRight.x.toFixed(2)})`);
  const hip=view.giraffe.bones.hips[0],hipRest=view.giraffe.rest.find(r=>r.bone===hip).quaternion;
  assert(hip.quaternion.angleTo(hipRest)<1e-9,'and its legs are still');
  station.amount=1;
  const left=settle(L.platforms[0].x),right=settle(back.x+back.w+GIRAFFE_LEAVE.past-.5);
  assert(left.x<right.x-.2,`stirred, the head turns toward the player (${left.x.toFixed(2)} with the player left, ${right.x.toFixed(2)} right)`);
  for(const t of [left,right])assert(t.x>headDeck.x-.5&&t.x<headDeck.x+headDeck.w+.5,'and stays about its deck at both extremes');
  let swung=0;for(let i=0;i<120;i++){g.time+=1/60;animateDream(w,g,1/60);swung=Math.max(swung,hip.quaternion.angleTo(hipRest));}
  assert(swung>.15,`pulled all the way, the giraffe marches on the spot (hip swings ${(swung*180/Math.PI).toFixed(1)}°)`);
  w.scene.updateMatrixWorld(true);
  const marching=surface(back,.25,back.w),shift=Math.max(...marching.map((d,i)=>Math.abs(d-backSurface[i])));
  assert(shift<.03,`the back the player stands on does not move with the march (${shift.toFixed(4)} at most, where the flank blends into a swinging hip)`);
  assert(skinnedBox(model,w.scene).min.y>-.05,'and no marching foot sinks into the plaza');
  assert(near(view.pivot.position.x,back.w/2+1,1e-9)&&view.pivot.visible,'with the player on its back it stays home');
  w.reducedMotion=true;const heldA=settle(back.x+8,10),heldB=settle(L.platforms[0].x,10);
  assert(heldA.distanceTo(heldB)<1e-6&&hip.quaternion.angleTo(hipRest)<1e-9,'reduced motion holds the head and the legs still');
  w.reducedMotion=false;station.amount=0;settle(back.x+3,120);
  assert(hip.quaternion.angleTo(hipRest)<1e-9,'let go, the parade sleeps again and the legs return exactly to rest');
  console.log('PASS asleep it ignores the player; the pulled worm stirs it to turn to the player and march on the spot; reduced motion holds it');

  // Leaving: pulled and the player across, it turns and walks off left until hidden; home the moment the player is back left.
  const worm=g.level.enemies.find(e=>e.kind==='hatworm'&&e.y===back.y);assert(worm,'a hatworm patrols the giraffe\'s back');
  const ev=w.enemyViews.get(worm.id);assert(ev?.parts.body,'its view is built');
  station.amount=1;g.player.x=back.x+back.w+GIRAFFE_LEAVE.past+2;
  const home=view.pivot.position.x;let turned=false,walked=false;
  for(let i=0;i<60*20;i++){g.time+=1/60;animateDream(w,g,1/60);if(Math.abs(view.pivot.rotation.y-Math.PI)<.01)turned=true;if(view.pivot.position.x<home-1)walked=true;}
  assert(turned&&walked,'it turned to face left and walked');
  assert(!view.pivot.visible,'and is hidden once out of the frame');
  assert(ev.parts.body.visible===false,'the hatworm on its back went with it');
  g.player.x=back.x-10;g.time+=1/60;animateDream(w,g,1/60);
  assert(view.pivot.visible&&near(view.pivot.position.x,home,1e-9)&&Math.abs(view.pivot.rotation.y)<1e-9,'the player back on the left, it is home again, facing right');
  assert(ev.parts.body.visible===true,'with its hatworm');
  station.amount=0;settle(back.x+3,10);
  console.log(`PASS with the parade awake and the player across, the giraffe turns and walks off left ${GIRAFFE_LEAVE.distance} until hidden, and is home once the player is back left`);

  // The hatworm on the back is the sculpted worm in the board's colours, with
  // the models loaded as without them; the supplied caterpillar is not it.
  for(const name of ['Hatworm body','Hatworm head','Hatworm segment','Hatworm hat 1','Hatworm hat 2','Hatworm hat 3','Hat brim','Hat crown','Hat band'])assert(ev.root.getObjectByName(name),`the hatworm has ${name}`);
  assert(!ev.root.getObjectByName('Supplied clay caterpillar')&&!ev.root.getObjectByName('Dream hat')&&!ev.model,'the hatworm is the sculpted worm, not the supplied caterpillar');
  assert.equal(ev.parts.segments.length,4);assert.equal(ev.parts.hats.length,3);
  ev.parts.segments.forEach((m,i)=>assert.equal(m.material.color.getHex(),HATWORM_COLOURS.beads[i%HATWORM_COLOURS.beads.length],`bead ${i+1} wears the board's colour`));
  assert.equal(ev.parts.head.material.color.getHex(),HATWORM_COLOURS.head,'a lemon head');
  assert.equal(ev.root.getObjectByName('Hat crown').material.color.getHex(),HATWORM_COLOURS.crown,'plum hats');
  assert(ev.parts.segments[0].material.userData.clay&&w.assetMaterials.has(ev.parts.segments[0].material),'its colours wear the clay surface and are retained across streaming');
  for(let i=0;i<60;i++)animateEnemy(ev,worm,1/60,'playing');
  worm.alive=false;animateEnemy(ev,worm,1/60,'playing');
  assert(ev.root.scale.y<1&&ev.root.scale.x>1,'pressed flat about the root, hats and all');
  worm.alive=true;
  w.syncVisible(g.level,900,true);assert(!w.enemyViews.get(worm.id),'the hatworm streams out far away');
  w.syncVisible(g.level,back.x+3,true);assert(w.enemyViews.get(worm.id)?.parts.segments,'and comes back');
  assert.equal(sharedDisposals,0,'streaming the creatures disposes nothing shared');
  releaseEnemyView(w.enemyViews.get(worm.id));
  console.log(`PASS the hatworm on the giraffe's back is the sculpted worm in the board's colours — lime, orange, bubblegum, violet beads, a lemon head, plum hats — pressed flat when stomped, streaming cleanly`);

  // The caterpillar lift is the supplied caterpillar: back at the deck's top,
  // head raised at the front, walking on its bones only while the lift moves.
  const lift=platform('parade-caterpillar'),lv=w.platforms.get('parade-caterpillar');
  assert(lv?.caterpillar&&lv.root.getObjectByName('Supplied clay caterpillar'),'the lift carries the supplied caterpillar');
  for(const name of ['Caterpillar bead','Caterpillar leg','Sleeping eye'])assert(!lv.root.getObjectByName(name),name+' has left the lift');
  g.player.x=lift.x;w.syncVisible(g.level,lift.x,true);animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  const ride=lv.root.getObjectByName('Supplied clay caterpillar'),rideBox=skinnedBox(ride,w.scene);
  const deckTop=(from,to,step=.5)=>{const out=[],p=new THREE.Vector3();for(let x=lift.x+from;x<lift.x+to;x+=step){let top=-1e9;ride.traverse(o=>{if(!o.isSkinnedMesh)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);if(Math.abs(p.x-x)<step/2&&Math.abs(p.z)<.5&&p.y>top)top=p.y;}});out.push(top-lift.y);}return out;};
  // (the tail curls up to the top at the back; the notch behind it and the
  // body's middle lie a hand under the walk plane, as soft clay would)
  const body=deckTop(.25,lift.w-1.2);
  assert(body.every(d=>d>-.4&&d<.3)&&body.slice(2).every(d=>d>-.3),`the body's back lies along the ride's top (${body.map(d=>d.toFixed(2)).join(' ')})`);
  assert(rideBox.max.y-lift.y>.3&&rideBox.max.y-lift.y<1,`the head rises at the front as the figurehead (${(rideBox.max.y-lift.y).toFixed(2)} above the ride)`);
  assert(rideBox.max.x>lift.x+lift.w-.1&&rideBox.min.x<lift.x+.1,'and the body runs the ride\'s length');
  assert(rideBox.max.x-rideBox.min.x>lift.w&&rideBox.max.x-rideBox.min.x<lift.w+1,'a little past its ends');
  // Still, the hump is slight; moving, it walks.
  const hump=()=>Math.max(...lv.caterpillar.rest.filter((r,i)=>i>0&&r.bone!==lv.caterpillar.head).map(r=>r.bone.position.y-r.position.y));
  let still=0;for(let i=0;i<60;i++){g.time+=1/60;animateDream(w,g,1/60);still=Math.max(still,hump());}
  lift.prevX=lift.x-.05;let walking=0;for(let i=0;i<60;i++){g.time+=1/60;animateDream(w,g,1/60);walking=Math.max(walking,hump());}
  assert(still>0&&walking>still*2,`the walk pumps while the lift moves (${walking.toFixed(3)} against ${still.toFixed(3)} at rest)`);
  delete lift.prevX;
  const saved=w.dreamAssets;w.dreamAssets=null;w.refreshEditor(g.level,back.x+3);
  assert(w.platforms.get('parade-back').root.getObjectByName('Torso')&&w.platforms.get('parade-caterpillar').root.getObjectByName('Caterpillar bead')&&w.enemyViews.get(worm.id).root.getObjectByName('Hatworm segment'),'a rig without the models gets the sculpted giraffe and lift back, the hatworm as ever');
  w.dreamAssets=saved;w.refreshEditor(g.level,back.x+3);
  assert(w.platforms.get('parade-back').root.getObjectByName('Supplied clay giraffe')&&w.platforms.get('parade-caterpillar').root.getObjectByName('Supplied clay caterpillar'),'restored, the supplied giraffe and caterpillar return');
  assert.equal(sharedDisposals,0,'rebuilding disposes nothing shared');
  console.log(`PASS the caterpillar lift is the supplied caterpillar: back along the ride's top (${body.map(d=>d.toFixed(2)).join('/')}), head ${(rideBox.max.y-lift.y).toFixed(2)} above it, walking only while the lift moves, sculpted again without the models`);
}

// --- 11. the parade's carnival dressing ------------------------------------------------------
// The four supplied dressings: the banner is cut at load into its swag valance
// and its pennant, each part reaching every triangle once with a box of its
// own; the column loses its pedestal and is measured for the stick that runs
// on below; each placement is sized by the asked dimension with its anchor on
// the origin. On the solo parade the hat-worm bridge wears the valance along
// its live underside — gathered under the coil, full across the pulled bridge
// — the plinth hangs the pennant, the spiral sun stands on the column with the
// medallion at its centre, and the sky holds the towers, spires and the sun.
{
  const a=bare.dreamAssets.banner,total=firstMesh(a.scene).geometry.index.count;
  assert.equal(a.valance.index.count+a.banner.index.count,total,'the valance and the pennant share out every triangle of the banner');
  const vb=a.valance.boundingBox,bb=a.banner.boundingBox;
  assert(bb.max.x-bb.min.x<a.size.x*.4&&vb.max.x-vb.min.x>a.size.x*.95,'the pennant is the narrow part, the valance spans the width');
  assert(bb.min.y<a.box.min.y+1e-6&&vb.max.y>a.box.max.y-1e-6&&vb.min.y>bb.min.y,'the pennant hangs to the foot, the valance holds the rail');
  const c=bare.dreamAssets.column;
  assert(c.post.index.count<firstMesh(c.scene).geometry.index.count&&c.post.boundingBox.min.y>c.box.min.y+c.size.y*.1,'the column\'s pedestal is cut away');
  assert(c.radius>c.size.y*.04&&c.radius<c.size.y*.09,`the stick is measured (${(c.radius/c.size.y).toFixed(3)} of the height)`);
  // A part's own box (not the precise walk, which would read every shared vertex of the upload).
  const placed=(make)=>{const root=new THREE.Group();const p=make(root);root.updateMatrixWorld(true);return {p,box:new THREE.Box3().setFromObject(p)};};
  {const {p,box}=placed(r=>dreamValance(bare,r,4.8));assert(near(box.max.x-box.min.x,4.8,1e-6)&&near(box.max.y,0,1e-6)&&near((box.min.x+box.max.x)/2,0,1e-6),'the valance is the asked width, its rail on the origin');assert.equal(p.name,'Dream valance');}
  {const {box}=placed(r=>dreamBanner(bare,r,1.5));assert(near(box.max.x-box.min.x,1.5,1e-6)&&near(box.max.y,0,1e-6),'the pennant hangs from the origin at the asked width');}
  {const {box}=placed(r=>dreamCane(bare,r,14));assert(near(box.max.y-box.min.y,14,1e-6)&&near(box.min.y,0,1e-6),'the cane stands 14 tall on the origin');}
  {const {box}=placed(r=>dreamSun(bare,r,5.5));assert(near(box.max.x-box.min.x,5.5,1e-6)&&near((box.min.y+box.max.y)/2,0,1e-6),'the sun is 5.5 across, centred');}
  {const {p,box}=placed(r=>dreamColumn(bare,r,9));assert(near(box.max.y,9,1e-6)&&box.min.y>0&&!p.getObjectByName('Column stick'),'the column alone stands to its height, footless');}
  {const {p,box}=placed(r=>dreamColumn(w,r,9,{reach:30}));assert(box.min.y<-29&&box.min.y>-32&&p.getObjectByName('Column stick')&&p.getObjectByName('Candy stripe'),`with a reach the stick runs on below the origin (to ${box.min.y.toFixed(2)})`);}
  console.log(`PASS the banner splits into valance and pennant, the column sheds its pedestal (stick ${(c.radius/c.size.y).toFixed(3)} of its height), and the five placements size and anchor as asked`);

  const parade=[...MODULES,...SHELVED].find(m=>m.key==='parade'),L=soloSection(parade),g=new Game();g.start(INDEX,L);
  const worm=g.level.platforms.find(p=>p.id==='parade-worm'),station=g.level.shaping.find(st=>st.id==='parade-worm');
  const cx=worm.shape.from.x+worm.shape.from.w/2;
  w.build(g.level,INDEX,cx);w.syncVisible(g.level,cx,true);g.player.x=cx;animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  const view=w.platforms.get('parade-worm');assert(view?.clay,'the bridge keeps its shaping clay');
  const hang=view.root.getObjectByName('Valance'),strip=hang?.getObjectByName('Valance strip');assert(hang&&strip,'the valance hangs under the bridge');
  const tiles=[];strip.traverse(o=>{if(o.name==='Dream valance')tiles.push(o);});assert.equal(tiles.length,VALANCE_TILES,`${VALANCE_TILES} valance tiles`);
  assert(near(hang.position.y,-worm.h,1e-9)&&near(strip.scale.x,worm.w/worm.shape.to.w,1e-9)&&strip.scale.y<.55,'coiled: the rail at the coil\'s foot, the swags gathered to its width');
  station.amount=1;updateShaping(g,0,{});animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  assert(near(hang.position.y,-worm.h,1e-9)&&near(strip.scale.x,1,1e-9)&&near(strip.scale.y,1,1e-9),'pulled: the rail at the bridge\'s underside, the swags full across it');
  // The clay's root is moved to the live pose by the engine each frame (animateClayView); here it stands where it was built, so the rail is read against it.
  const full=new THREE.Box3().setFromObject(strip),lip=view.root.position.y-worm.h;
  assert(near(full.min.x,worm.x,.05)&&near(full.max.x,worm.x+worm.w,.05)&&full.max.y<lip+.2&&full.max.y>lip-.2,'the valance spans the pulled bridge under its lip');
  station.amount=0;updateShaping(g,0,{});
  const plinth=w.levelRoot.getObjectByName('dream:parade:plinth');assert(plinth?.getObjectByName('Dream banner')&&plinth.getObjectByName('Plinth cap')&&!plinth.getObjectByName('Plinth band'),'the plinth hangs the pennant under a capped top');
  const sun=w.backRoot.getObjectByName('Spiral sun');assert(sun,'the spiral sun is in the sky');
  const column=sun.getObjectByName('Dream column'),disc=sun.getObjectByName('Spiral disc');assert(column&&disc,'the sun stands on the column');
  assert(near(column.position.y,-9*COLUMN_MEDALLION,1e-9)&&column.getObjectByName('Column stick'),'the medallion at the disc\'s centre, the stick running down');
  assert(sun.getObjectByName('Lollipop knob'),'the knob peeks over the disc');
  const count=name=>{let n=0;w.backRoot.traverse(o=>{if(o.name===name)n++;});return n;};
  assert.equal(count('Dream cane'),5,'two towers and three spires');assert.equal(count('Dream sun'),1,'one smiling sun');assert(count('Parade hill')>=6,'the parade\'s own hills');
  assert(paradeVisual.quietBackdrop===true,'the parade sinks the placeholder sky');
  let solid=0;w.levelRoot.traverse(o=>{if(o.isMesh&&!o.material.transparent){solid++;assert(o.material.userData.clay,`${o.name||'a mesh'} carries the clay surface`);}});
  console.log(`PASS the solo parade dresses the bridge (${VALANCE_TILES} tiles gathered under the coil, full when pulled), hangs the pennant on the plinth, stands the spiral sun on the column and fills the sky with 5 canes and the sun; ${solid} solid surfaces all clay`);
}

// --- 12. the Breathing Corridor's eyes ------------------------------------------------------
// The supplied eyeball set into a socket of rolled folds. What matters, and
// what no still frame proves on its own, is the ORDER in depth: the two lips
// have to pass IN FRONT of the ball, or the eye goes back to being a sphere
// stuck on a flat wall, which is the defect this replaced. So the lips are
// measured against the ball's own front pole, at rest and shut, and the blink
// is driven through the real animate hook rather than posed by hand.
//
// Everything is measured on a thin slab of x about the socket's middle: a lip
// sweeps on across the stripes either side of the eye, where the opening has
// closed and the two bands butt, so a bounding box over a whole lip says
// nothing about the aperture it leaves over the ball.
{
  const corridor=MODULES.find(m=>m.key==='corridor'),L=soloSection(corridor),g=new Game();g.start(INDEX,L);
  const entry=g.level.platforms.find(p=>p.id==='corridor-entry');assert(entry,'the solo corridor has its entry deck');
  const cx=entry.x+6;
  w.reducedMotion=false;w.build(g.level,INDEX,cx);w.syncVisible(g.level,cx,true);
  g.player.x=cx;g.time=0;animateDream(w,g,0);w.scene.updateMatrixWorld(true);
  const eyes=[];w.levelRoot.traverse(o=>{if(o.name==='Corridor eye')eyes.push(o);});
  assert(eyes.length>=1,"at least one eye is streamed in at the corridor's mouth");
  // Every eye is the supplied ball in its socket, and nothing of the cream ball
  // and flat disc it replaced is left.
  for(const e of eyes){
    assert(e.getObjectByName('Supplied clay eyeball'),'the eye is the supplied model');
    assert(!e.getObjectByName('Eyeball')&&!e.getObjectByName('Pupil'),'the sculpted ball and its pupil disc are gone');
    for(const part of ['Eye socket','Eye brow','Eye lid upper','Eye lid lower'])assert(e.getObjectByName(part),part+' is in the socket');
  }
  const eye=eyes.sort((a,b)=>Math.abs(a.getWorldPosition(new THREE.Vector3()).x-cx)-Math.abs(b.getWorldPosition(new THREE.Vector3()).x-cx))[0];
  const middle=eye.getWorldPosition(new THREE.Vector3()).x;
  // min/max y and the frontmost z of a named part, over the vertices lying
  // within `slab` of the socket's middle in x.
  const at=(name,slab=.12)=>{
    const o=eye.getObjectByName(name);assert(o,name+' is in the socket');
    const v=new THREE.Vector3();let lo=Infinity,hi=-Infinity,front=-Infinity;
    o.updateMatrixWorld(true);
    o.traverse(m=>{
      if(!m.isMesh)return;const pos=m.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
        if(Math.abs(v.x-middle)>slab)continue;
        lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);front=Math.max(front,v.z);
      }
    });
    assert(Number.isFinite(lo),name+" has geometry over the socket's middle");
    return {lo,hi,front};
  };
  const ball=at('Supplied clay eyeball'),r=(ball.hi-ball.lo)/2;
  const upper=at('Eye lid upper'),lower=at('Eye lid lower');
  assert(upper.front>ball.front&&lower.front>ball.front,
    `both lips stand in front of the ball's front pole (upper ${upper.front.toFixed(2)}, lower ${lower.front.toFixed(2)} against ${ball.front.toFixed(2)})`);
  // w.mesh sculpts a fresh ribbon by up to .06 world units, so the margin has
  // to be comfortably more than that or the sculpt could open a crack between
  // a lip and the ball.
  assert(Math.min(upper.front,lower.front)-ball.front>.12,
    `and by more than the clay sculpt's own wander (${(Math.min(upper.front,lower.front)-ball.front).toFixed(2)})`);
  // The lips really cut across the ball: what shows between their inner edges
  // is an almond well short of the ball's full height.
  const aperture=upper.lo-lower.hi;
  assert(aperture>0&&aperture<2*r*.95,`the socket shows an almond, not the whole ball (${aperture.toFixed(2)} of ${(2*r).toFixed(2)})`);
  // The blink, through animate(): somewhere in the cycle the lips must meet,
  // and at that moment they must still be in front of the ball, or a shut eye
  // would show the ball through its own lids.
  const lids=[eye.getObjectByName('Eye lid upper'),eye.getObjectByName('Eye lid lower')];
  let shut=Infinity,covered=0;
  for(let i=0;i<900;i++){
    g.time+=1/60;animateDream(w,g,1/60);w.scene.updateMatrixWorld(true);
    const u=at('Eye lid upper'),d=at('Eye lid lower'),gap=u.lo-d.hi;
    if(gap<shut){shut=gap;covered=Math.min(u.front,d.front)-at('Supplied clay eyeball').front;}
  }
  assert(shut<=0,`the blink closes the socket (tightest gap ${shut.toFixed(2)})`);
  assert(covered>0,`and a shut lid is still in front of the ball, so a closed eye is covered (${covered.toFixed(2)})`);
  // Reduced motion: the ball looks straight ahead and the lips stay open.
  w.reducedMotion=true;g.time+=1/60;animateDream(w,g,1/60);w.scene.updateMatrixWorld(true);
  assert(eye.getObjectByName('Eyeball gaze').quaternion.angleTo(new THREE.Quaternion())<1e-6,'reduced motion holds the ball straight ahead');
  assert(lids.every(l=>Math.abs(l.position.y)<1e-9),'and holds the lips open');
  w.reducedMotion=false;
  console.log(`PASS the corridor's ${eyes.length} streamed eyes are the supplied ball in a socket of folds: both lips ${(Math.min(upper.front,lower.front)-ball.front).toFixed(2)} in front of its front pole, an almond of ${aperture.toFixed(2)} of the ball's ${(2*r).toFixed(2)} showing, the blink closing to ${shut.toFixed(2)} still covered, reduced motion still`);
}

// --- 13. the Crooked Garden's scenery --------------------------------------------------------
// Everything standing about the garden's decks is a supplied model placed
// whole — the backdrop's spires and pillars, the pebble heaps at their feet,
// on the decks and in the side scenery in front of every stone deck, and the
// chapters' shared cloud in the garden's wash — and the only mushrooms left
// are the two a player uses, the spring and the floating pads' caps. The
// side-scenery heaps must be the fade's clones, and the cloud wash must be a
// material World.build keeps.
{
  prepareCloudAsset(w,await readGLB(new URL('../dist/assets/cloud.glb',import.meta.url)));
  const garden=MODULES.find(m=>m.key==='garden'),L=soloSection(garden),g=new Game();g.start(INDEX,L);
  const x=L.spawn.x+4;
  w.build(g.level,INDEX,x);w.syncVisible(g.level,x,true);w.scene.updateMatrixWorld(true);
  const count=(root,name)=>{let n=0;root.traverse(o=>{if(o.name===name)n++;});return n;};
  for(const gone of ['Far pillar','Far silhouette','Far island','Far waterfall','Mound','Cloud','Mushroom cap','Mushroom stem'])assert.equal(count(w.backRoot,gone),0,gone+' is no longer sculpted into the backdrop');
  assert(count(w.backRoot,'Dream mountain')>=7,'the spires stand in the far skyline, before and past the arch');
  assert(count(w.backRoot,'Dream pillar')>=6,'the pillars stand in the middle distance and near, before and past the arch');
  assert(count(w.backRoot,'Dream pebble pile')>=4,'pebble heaps lie at the pillars\' feet');
  assert.equal(count(w.backRoot,'Ivory cloud'),4,'the sky is four of the shared cloud');
  assert.equal(count(w.backRoot,'Ribbon cloud'),1);assert.equal(count(w.backRoot,'Sky coil'),2);
  // The wash: every cloud mesh wears a clone kept in w.mat, never the shared material.
  const shared=new Set();w.cloudAsset.scene.traverse(o=>{if(o.isMesh)shared.add(o.material);});
  const washes=new Set();
  w.backRoot.traverse(o=>{if(o.name!=='Ivory cloud')return;o.traverse(m=>{if(!m.isMesh)return;assert(!shared.has(m.material),'a garden cloud never draws the shared ivory material');assert.equal(w.mat[m.material.name],m.material,'its wash lives in w.mat');assert(m.material.userData.clay,'and keeps the clay relief');washes.add(m.material);});});
  assert(washes.size>=2,'the clouds come in two washes');
  // On the decks: heaps where the mushrooms and bushes stood, no mushroom, no bush.
  for(const gone of ['Garden mushroom','Garden bush'])assert.equal(count(w.levelRoot,gone),0,gone+' is gone from the decks');
  assert(count(w.levelRoot,'Dream pebble pile')>=1,'a pebble heap is streamed in on the entry deck');
  // In front of the decks: the heaps are the model, on the clones the fade
  // dims. (Looked up by the deck's id: this rig's depthViews still lists the
  // `start` of the sections built before, which World.build does not sweep.)
  const id='garden-entry',view=w.depthViews.get(id);assert(view,'the entry deck has side scenery');
  const part=view.parts[0];
  assert(count(part.root,'Dream pebble pile')>=2,'the side scenery in front of '+id+' is two pebble heaps');
  assert.equal(count(part.root,'Mound'),0);
  assert(part.materials.length>0,'and its materials are clones the fade can dim');
  for(const m of part.materials)assert(m.map&&m.userData.fixed,'each clone keeps the pebbles\' colour map and the fixed tag');
  // The two mushrooms that stay: the floating pads' caps and the spring.
  w.syncVisible(g.level,30,true);
  assert(/^Garden floating pad/.test(w.platforms.get('garden-float-1').root.name),'the floating pad is still a mushroom cap');
  w.syncVisible(g.level,47,true);
  const spring=w.platforms.get('garden-shroom').root;
  assert(/^Garden mushroom spring/.test(spring.name)&&count(spring,'Mushroom cap')===1&&count(spring,'Mushroom stem')===1,'the spring is still a mushroom');
  // Placement: a stretched pillar is as tall as asked and slimmer by the stretch.
  const a=w.dreamAssets.pillar,tall=dreamPillar(w,new THREE.Group(),6,{stretch:1.25}),plain=dreamPillar(w,new THREE.Group(),6);
  assert(near(tall.userData.size.y,6,1e-9)&&near(plain.userData.size.y,6,1e-9),'both stand 6 tall');
  assert(near(tall.userData.size.x,plain.userData.size.x/1.25,1e-9),'the stretched one is a fifth slimmer');
  assert(near(tall.userData.size.x,6/1.25*a.size.x/a.size.y,1e-9));
  const pile=dreamPebbles(w,new THREE.Group(),3),spire=dreamMountain(w,new THREE.Group(),8);
  assert(near(pile.userData.size.x,3,1e-9)&&near(spire.userData.size.y,8,1e-9),'a pile is as wide, a spire as tall, as asked');
  for(const root of [tall,pile,spire]){root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root,true);assert(near(box.min.y,0,1e-6),root.name+' stands with its foot on the origin');}
  // Rebuilding keeps the wash: the same material instance, never disposed.
  let disposed=0;for(const m of washes)m.addEventListener('dispose',()=>disposed++);
  w.build(g.level,INDEX,x);w.syncVisible(g.level,x,true);
  for(const m of washes)assert.equal(w.mat[m.name],m,'the wash survives World.build');
  assert.equal(disposed,0,'and is never disposed');
  assert.equal(sharedDisposals,0,'nothing shared was disposed by building the garden');
  console.log(`PASS the Crooked Garden stands the supplied pillar, pebble pile and clayfall spire in place of its sculpted scenery (${count(w.backRoot,'Dream pillar')} pillars, ${count(w.backRoot,'Dream mountain')} spires, ${count(w.backRoot,'Dream pebble pile')} far heaps, ${washes.size} cloud washes on four shared clouds); the spring and the pads are the only mushrooms left, and the side-scenery heaps fade on clones`);
}
