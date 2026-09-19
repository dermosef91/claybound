import * as THREE from './lib/three.module.js';
import {mergeGeometries} from './lib/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from './lib/RoundedBoxGeometry.js';
import {clayMaterial,sculptClay} from './clay.js';
import {cavernModel} from './cavern-asset.js';
import {skyGradient} from './sky-gradient.js';

const group=(parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
// Sampled from the supplied grotto/crystalcap albedo under their glow masks:
// the lit crystal faces average #5fedf2 and the mushroom caps #f3982f, and the
// models emit their own colour at intensity .7 (white emissive x glow map).
// Built props now use those numbers so all three depth tiers agree.
// The caps sit a step deeper into orange than the sampled albedo so their warm
// pools stay distinct from the cream stems and the gold hub under blue fog.
export const CAVE_CRYSTAL=0x5fedf2,CAVE_MUSHROOM=0xf28a2c;
// The ring material carries a little self-light: the wheel turns behind the
// play plane where the sun barely reaches, and pure diffuse dark clay there
// rendered as a black silhouette instead of a thick, readable structure.
export function cavernMaterials(w){
  for(const [name,color,emissive,intensity,roughness]of [
    // Caps glow a deep orange from inside: the brighter, yellower emissive
    // tone-mapped to lemon under the cap's own lamp, and the pool it threw on
    // the rock was yellow too, where the target's pools are orange.
    ['caveMushroom',0xee7a24,0xff5c0c,.9,.85],
    // Gems are pale ice with a cyan core at half the old self-light: facets
    // have to shade, or the cluster is a white plate next to its own lamp.
    // Glassier than clay: a lower roughness gives each prism a lit face and
    // a shadowed face, which is what makes a bundle read as faceted.
    // Brighter still at the core: the target's clusters are the frame's
    // white-cyan landmarks, read from across the room, with a bloom about them.
    ['caveCrystal',0xa4dcf2,0x3ab2e6,.62,.25],
    // The target's ring is charcoal clay, not navy: neutral, so it reads as a
    // thick dark structure against the blue haze it turns in front of.
    ['caveRing',0x3a3e48,0x14161c,.5,.9]
  ]){
    if(!w.mat[name]){w.mat[name]=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness,metalness:0});clayMaterial(w,w.mat[name],.02);}
  }
}
// Fixtures hang on empty anchors rather than on a gem or cap mesh, so the
// meshes around them can be baked into a handful of draw calls while the light
// still samples a live world position every frame.
function anchor(parent,x,y,z){
  const a=new THREE.Object3D();a.name='cave light anchor';a.userData.fixture=true;a.position.set(x,y,z);parent.add(a);return a;
}
// Pools are local: a cap's warm light reaches the rock it grows from, not the
// ceiling four units up, so the vault stays cool and the pools read as pockets.
function lightMarker(w,node,kind,color,power,range=9){
  w.torches.push({flame:node,position:new THREE.Vector3(),phase:0,kind,color,power,range});
}
// Light pools are the cheapest lighting the cave can afford: one additive quad
// behind each fixture, brightening the rock around it where the fixed four
// point lights cannot reach. The falloff is generated, not loaded, so the same
// code runs in the headless tests. Static copies merge with their cell; the
// quad casts no shadow, or every pool would throw a square one.
function glowMaterial(w,name,color,opacity){
  if(w.mat[name])return w.mat[name];
  if(!w.caveGlow){
    const size=64,data=new Uint8Array(size*size*4);
    for(let i=0;i<size*size;i++){
      const dx=(i%size)+.5-size/2,dy=Math.floor(i/size)+.5-size/2,d=Math.min(1,Math.hypot(dx,dy)/(size/2));
      data.set([255,255,255,Math.round((1-d)**2*255)],i*4);
    }
    w.caveGlow=new THREE.DataTexture(data,size,size);w.caveGlow.magFilter=w.caveGlow.minFilter=THREE.LinearFilter;w.caveGlow.needsUpdate=true;
  }
  return w.mat[name]=new THREE.MeshBasicMaterial({map:w.caveGlow,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
}
function glowPool(w,parent,x,y,z,size,material){
  const pool=w.mesh(new THREE.PlaneGeometry(size,size),material,parent,x,y,z);
  pool.name='Light pool';pool.castShadow=false;pool.receiveShadow=false;return pool;
}
// Moss leaves are tiny, and the shared clay ball spends 700 triangles on each
// of them: one hanging cluster used to cost more than a grotto model, twice
// over once the shadow pass drew it again. A coarse ball, sculpted once and
// retained like the shared shapes, keeps the silhouette at an eighth of that:
// a drip is a ten-pixel blob, and eight facets round it as well as nine did.
function leafGeometry(w){
  if(!w.caveLeaf){
    const geo=sculptClay(w,new THREE.SphereGeometry(1,8,5),{amplitude:.035});
    geo.userData.clayRelief=true;w.assetGeometry?.add(geo);w.caveLeaf=geo;
  }
  return w.caveLeaf;
}
function leaf(w,rx,ry,rz,material,parent,x,y,z){
  const m=w.mesh(leafGeometry(w),material,parent,x,y,z);m.scale.set(rx,ry,rz);return m;
}
// Pebbles are the same coarse ball in rock clay: the shared clay sphere would
// spend 700 triangles, twice with its shadow, on a stone the size of a thumb.
function pebble(w,parent,x,y,z,r,material,seed=0){
  const m=leaf(w,r*1.3,r*.8,r,material,parent,x,y,z);m.rotation.set(rand(seed)*.6,rand(seed*7)*3,0);return m;
}
// The height of an ellipsoidal rock's surface at an offset from its centre,
// so pebbles seat on a boulder's crown instead of floating over it.
const crown=(cy,width,height,depth,dx,dz)=>cy+height*.5*Math.sqrt(Math.max(0,1-(2*dx/width)**2-(2*dz/depth)**2))*.97;
// Authored decoration measures its silhouette, so the workshop's copies skip
// the pool, which reaches well past the caps.
export function caveMushrooms(w,parent,x,y,z=-1.2,size=1,{glow=true,light=true,power=1}={}){
  cavernMaterials(w);const g=group(parent,x,y,z);g.name='Amber mushroom cluster';g.scale.setScalar(size);
  // The pool sits just ahead of the seat so the rock underneath cannot swallow
  // it, yet a cluster is always placed behind the walk line, so it stays clear
  // of the hero.
  // Two quads on one material, so they still bake into a single draw: a
  // halo about the caps and a flattened pool at the stems' feet. Most
  // clusters have no lamp of their own (the four-light pool goes to the
  // nearest), so these carry the warm spill onto the shelf and the rock face
  // under it, where the target's pools land, rather than into the air.
  if(glow){
    const warm=glowMaterial(w,'caveGlowWarm',0xff6a18,.68);
    glowPool(w,g,0,.7,.4,4.2,warm);glowPool(w,g,.1,-.1,.46,5.4,warm).scale.y=.42;
  }
  for(const [dx,h,r]of [[0,1.25,.55],[-.6,.62,.32],[.65,.78,.37]]){
    w.cylinder(.095,h,'cream',g,dx,h*.48,0);
    w.ball(r,.23,r*.83,'caveMushroom',g,dx,h,0);
    w.ball(r*.72,.045,r*.63,'caveMushroom',g,dx,h-.14,.025);
    // The lamp reaches the rock a stride and a half around the stems: at the
    // old range its pool stopped at the cap rims and the deck stayed grey.
    if(dx===0&&light)lightMarker(w,anchor(g,dx,h,0),'mushroom',0xff962f,17*size*power,6.5);
  }
  bakeStatic(w,g);return g;
}
// The supplied models grow their crystals as squat, many-faceted geode clumps:
// measured height/width 0.9-1.4, eight-ish facets, blunt tips seated in rock.
// The old build was a 3.4:1 six-sided spike, which both mismatched the models
// and gave safe scenery the silhouette this game uses for hazards. These run
// taller than the models (about 2.5:1) so a cluster reads as a landmark from
// across the frame, while the blunt cap still keeps them off the hazard shape.
// Seven slim six-sided gems rather than five fat eight-sided ones: the target's
// clusters are bundles of hexagonal prisms, and the old fat cones read as
// low-poly triangles once their light blew their facets out. The two outer
// gems keep their footprint, which fixes the silhouette the workshop measures.
const GEMS=[[-.42,.1,.3,.78,-.24],[-.04,.24,.36,1.22,.04],[.4,.06,.27,.66,.22],[-.2,-.16,.2,.5,-.14],[.24,-.2,.17,.42,.18],[.14,.34,.15,.72,-.08],[-.3,-.34,.13,.36,.1]];
// `seat` is the dark clay of the stones the gems grow from. A backdrop
// cluster passes the clay its cell already holds: every material a cell's
// merge sees is another baked mesh per block (tests/scene.mjs caps them).
export function caveCrystals(w,parent,x,y,z=-1.15,size=1,{light=true,glow=light,power=1,halo=1,seat='caveClayDark'}={}){
  cavernMaterials(w);backdropMaterials(w);const g=group(parent,x,y,z);g.name='Blue crystal cluster';g.scale.setScalar(size);
  // Foreground copies fade with their scenery and carry no fixture; a pool
  // there would have to fade with them, so only lit clusters get one. The
  // workshop's copies measure their silhouette and opt out as well.
  // A compact halo about the gems and a flattened pool at their foot, on one
  // material so both bake into a single draw: the cyan lands on the ledge
  // top and the rock beside the seat and stops short of the hero a stride
  // away. The broad single pool used to hang as a haze up the wall behind him.
  if(glow){
    const cool=glowMaterial(w,'caveGlowCool',0x2fa4ee,.5);
    glowPool(w,g,0,.75,.5,3*halo,cool);glowPool(w,g,0,.14,.56,4*halo,cool).scale.y=.42;
  }
  w.ball(.66,.2,.46,seat,g,0,.1,0);
  // Pebbles at the foot: the target's clusters grow out of a scatter of dark
  // stones, not straight from a bare seat, and against the bright gems the
  // stones read only if they are the darkest clay. They stay inside the
  // outer gems' footprint, which the workshop measures.
  for(const [i,[px,pz]]of [[-.5,.12],[.46,-.16],[.12,-.44],[-.18,.42],[.34,.36],[-.36,-.3],[.44,.22]].entries())pebble(w,g,px,.16,pz,.09+rand(i+7)*.07,seat,i);
  for(const [i,[dx,dz,r,h,tilt]]of GEMS.entries()){
    const gem=w.mesh(new THREE.CylinderGeometry(r*.46,r*.92,h,6,1),'caveCrystal',g,dx,.16+h/2,dz);
    gem.rotation.z=tilt;
    // A steep cap, so each gem reads as a sharp pointed prism like the
    // target's, yet still blunt enough to stay off the hazard silhouette.
    w.mesh(new THREE.ConeGeometry(r*.46,r*1.45,6),'caveCrystal',gem,0,h/2+r*.72,0);
    w.box(r*1.25,.3,r*1.3,seat,g,dx,.13,dz,.1);
    // The lamp hangs above the tallest gem's tip rather than inside it: a
    // point light within a hand of its own gem faces burned them white
    // before any of it reached the rock, and the rock is what the pool is for.
    if(light&&i===1)lightMarker(w,anchor(g,dx,.16+h+.45,dz+.2),'crystal',0x46bbff,16*size*power,8.5);
  }
  bakeStatic(w,g);return g;
}
// Sky and fog are one haze. Fog is mixed after tone mapping, so a fully fogged
// spire shows exactly this hex. The route's own sky is a dark navy that made
// the whole backdrop a wall; this is the pale greyed blue of the target's far
// columns, sampled inside the ring's upper arc: a step paler than the void
// band, so the fogged forest stands as soft pale columns in front of it, and
// far paler than any near rock, so a fogged column reads as distance.
export const CAVE_HAZE=0x4b6b9b;
// The void behind the haze: the target's chamber is lit from head height up,
// a saturated mid blue brightest inside the ring's upper arc and a little
// above the eye line, and it falls to near-black above the ceiling and below
// the floor. The band sits just under the fog colour, so a fully fogged spire
// is the paler of the two, and the half-fogged middle rank, tinted darker,
// stands as the dark soft columns the target puts behind the hero. Stops are
// screen heights around the eye line; the layer that carries the quad follows
// the camera.
const HAZE_STOPS=[[30,0x0a111e],[10.5,0x172848],[7,0x2f588e],[3.5,0x3c6ba6],[0,0x34619c],[-3,0x1f3a64],[-6.5,0x0f1e3a],[-30,0x0a1424]];
function backdropMaterials(w){
  // The near rock is a dark, nearly neutral navy with an emissive floor: its
  // undersides face away from every light and went black, where the target
  // keeps them a readable deep slate. The vault and the floor band are the
  // frame's darkest, chunkiest rock, the foreground the rest falls back
  // from. Behind them the ranks step paler and greyer the deeper they stand,
  // and fog finishes the ramp: the quarter-fogged alcove rock (caveDistant)
  // is a mid blue-grey, the half-fogged middle spires (caveSpire) paler, and
  // the far forest (caveVeil), five sixths fogged, is lit paler than the haze
  // itself, so its columns stand as soft pale shapes against the darker void
  // rather than sinking into a lit wall. Moss is the yellow-green of the
  // target with an olive shadow tone, so a clump reads as one mass against
  // blue rock rather than lime beads. The two clay tones are the shared
  // terrain greys with a navy self-light for hanging bodies and lips: those
  // faces point away from every light and went black too.
  // Sampled from the target: the ceiling, the left tower and the ledges are a
  // colourless charcoal (Lab L10 in shadow, L17-25 on lit lobes, chroma about
  // 10), the floor boulders a dark navy a step bluer than that, and the ranks
  // behind them saturated blues that fog lightens. So the near clays are
  // neutral, and carry a strong neutral self-light: the old undersides went
  // to L7 black under the ceiling wall, where the target keeps every face a
  // readable slate. The middle rank (caveSpire) is a dark blue, so half
  // fogged it stands as the soft dark columns behind the hero; the far forest
  // (caveVeil) is lit paler than the haze, so five sixths fogged it is the
  // paler of the two and reads as pale columns in lit mist.
  for(const [name,color,emissive,glow]of [
    ['caveVault',0x2a2e39,0x1b1d25,.85],['caveColumn',0x2f3c58,0x141b2e,.5],['cavePillar',0x2c3444,0x161920,.7],['caveDistant',0x3e5680,0x243858,.35],
    ['caveSpire',0x2f4870,0x1f3556,.35],['caveVeil',0x45608c,0x3a5280,.3],['caveMoss',0x5e6f28,0x5e6f28,.05],['caveMossLight',0x8a9c34,0x8a9c34,.05],
    ['caveClay',0x3b3f49,0x20232a,.85],['caveClayDark',0x30343e,0x1e2028,.9]
  ])if(!w.mat[name]){
    w.mat[name]=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:glow,roughness:.94,metalness:0});
    // The near clays carry the deepest fingerprints: they are the only
    // backdrop close enough for a thumb-pressed surface to be seen on, and
    // texture is what keeps a dark charcoal mass from reading as a flat cut-out.
    clayMaterial(w,w.mat[name],name.includes('Moss')?.022:['caveVault','caveColumn','cavePillar','caveClay','caveClayDark'].includes(name)?.085:.06);
  }
}
// The whole sky is one gradient quad (sky-gradient.js), stopped at these heights.
function hazeGradient(w,parent){return skyGradient(w,parent,HAZE_STOPS,{name:'Cave haze gradient'});}
const rand=n=>{const r=Math.sin(n*117.17+51.61)*43758.5453;return r-Math.floor(r);};
const MERGE_BLOCK=12;

// Rounded rock volumes with irregular, overlapping facets, rather than extruded
// flat silhouettes. Local coordinates keep the shared clay field attached.
// A rough rock adds finer, deeper lumps on a denser mesh, so a floor boulder
// reads as pebbled, thumb-pressed clay rather than a smooth egg.
export function caveRock(w,parent,x,y,z,width,height,depth,material='caveColumn',seed=0,rough=0){
  backdropMaterials(w);
  const geo=new THREE.SphereGeometry(1,rough?18:14,rough?14:12),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
    const dent=1+.065*Math.sin(a*9+b*7+c*5+seed)+.045*Math.sin(a*5-b*11+c*7+seed*2)+rough*(.05*Math.sin(a*19+b*15+c*13+seed*3)+.035*Math.sin(a*13-b*23+c*17+seed*5));
    p.setXYZ(i,a*width*.5*dent,b*height*.5*dent,c*depth*.5*dent);
  }
  geo.computeVertexNormals();const mesh=w.mesh(geo,material,parent,x,y,z);
  mesh.name='Rounded cavern rock';return mesh;
}
// A steadily tapering cone with a slight belly: a needle-thin profile read
// as a spike rather than a mass, and the full-bellied one tried after it kept
// its root width for a third of its length, so a long tooth read as a lobe
// with a stub. The target's teeth taper evenly from a rounded root to the tip.
function tooth(w,parent,x,y,r,h,material,down=true,seed=0){
  const profile=[[.03,-1],[.2,-.82],[.38,-.63],[.56,-.44],[.74,-.26],[.9,-.1],[1,.04]];
  const geo=new THREE.LatheGeometry(profile.map(([a,b])=>new THREE.Vector2(a*r,b*h)),13),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=1+.11*Math.sin(y*7/h+x*5+z*3+seed);
    p.setXYZ(i,x*q+Math.sin(y*3/h+seed)*r*.16,y,z*q);
  }
  geo.computeVertexNormals();const m=w.mesh(geo,material,parent,x,y,.4);m.name=down?'Ceiling stalactite':'Cave stalagmite';
  m.rotation.z=(down?0:Math.PI)+Math.sin(seed*3.2)*.09;return m;
}
// Tall pointed spires are the cave's depth cue. One silhouette repeats through
// every layer, so tint and fog alone tell the eye how far back each one sits.
// The base is the pivot, so a lean tilts the tip and leaves the foot planted.
// The shaft is ridged, not smooth: whole-number angular frequencies keep the
// lathe's seam welded while vertical ribs and shelves break the cone into
// the jagged, weathered column the target's forest is made of; a smooth cone
// under fog read as a paper cut-out.
function spire(w,parent,x,base,r,h,material,seed=0,z=0,lean=0){
  const profile=[[.03,1],[.09,.93],[.2,.83],[.26,.74],[.4,.6],[.46,.5],[.6,.38],[.7,.27],[.86,.13],[.95,.04],[1,-.05]];
  // Sixteen segments carry four and seven ribs cleanly; on fewer the ribs
  // aliased into a random faceted lump wherever a spire stood crisp.
  const geo=new THREE.LatheGeometry(profile.map(([a,b])=>new THREE.Vector2(a*r,b*h)),16),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=y/h,a=Math.atan2(z,x);
    const q=1+.13*Math.sin(a*4+t*3+seed)+.09*Math.sin(a*7-t*11+seed*2)+.07*Math.sin(t*19+seed*3);
    p.setXYZ(i,x*q+Math.sin(t*4+seed)*r*.2,y+Math.sin(a*3+seed)*h*.02*(1-t),z*q);
  }
  geo.computeVertexNormals();const m=w.mesh(geo,material,parent,x,base,z);m.name='Cavern spire';m.rotation.z=lean;return m;
}
function pillar(w,parent,x,base,width,height,material,seed=0){
  const g=group(parent,x,base,.1);g.name='Cavern buttress';
  // A lobed shaft gives the column real depth and a curved, varied silhouette.
  const profile=Array.from({length:19},(_,i)=>{
    const t=i/18;return new THREE.Vector2(width*.5*(.73+.22*Math.sin(t*10+seed)+.13*Math.cos(t*22+seed*.7)),t*height);
  });
  const geo=new THREE.LatheGeometry(profile,16),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=y/height,q=1+.09*Math.sin(x*5+z*4+t*41+seed);
    p.setXYZ(i,x*q+Math.sin(t*7+seed)*width*.14,y,z*q*.9);
  }
  geo.computeVertexNormals();w.mesh(geo,material,g);
  for(let i=0;i<5;i++){
    const y=height*(i+.4)/5,side=i%2?-1:1;
    caveRock(w,g,side*width*.19,y,width*.12,width*.83,height/4,width*.8,material,seed+i);
  }
  return g;
}

// A drip is one tapered tube along a slightly wavy path ending in a bulb: the
// target's drips are poured clay, thick at the lip and thinning to a rounded
// end, not beads on a thread. The taper is applied to the tube's rings after
// the fact, so a whole strand costs about a hundred triangles, less than the
// chain of blobs it replaces.
function drip(w,parent,x,y,z,len,seed,material){
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x,y+.1,z),new THREE.Vector3(x+Math.sin(seed)*.05,y-len*.45,z+.04),new THREE.Vector3(x+Math.sin(seed*2)*.04,y-len,z+.07)]);
  const segs=7,radial=6,geo=new THREE.TubeGeometry(path,segs,.15,radial,false),p=geo.attributes.position,c=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    const t=Math.floor(i/(radial+1))/segs,k=1-.38*t;path.getPoint(t,c);
    p.setXYZ(i,c.x+(p.getX(i)-c.x)*k,c.y+(p.getY(i)-c.y)*k,c.z+(p.getZ(i)-c.z)*k);
  }
  geo.computeVertexNormals();w.mesh(geo,material,parent);
  const end=path.getPoint(1);leaf(w,.125,.15,.125,material,parent,end.x,end.y-.05,end.z);
}
// Moss is thick clay, not beads on a string: a cushion of fat overlapping pads
// on the lip in two rows, and where it hangs, tapered drips of unequal length
// pour off the front row, close enough together to read as one curtain of
// clay poured over the lip rather than parallel ropes. The pads are the coarse
// retained leaf, so a whole clump still costs less than one grotto model.
export function caveMoss(w,parent,x,y,z=0,size=1,hanging=0,seed=0){
  backdropMaterials(w);const g=group(parent,x,y,z);g.name='Hanging cave moss';g.scale.setScalar(size);
  for(let i=0;i<7;i++){
    const t=(i-3)/3,back=i%2,r=.19+rand(i+seed)*.06;
    const pad=leaf(w,r,.11+back*.04,r*.8,back?'caveMoss':'caveMossLight',g,t*.34,.05+back*.06+rand(i*3+seed)*.03,-.03+back*.13);
    pad.rotation.set(.25,t*.9,t*-.3);
  }
  if(hanging){
    // Four drips, five where the hang is long: the target's corner clumps
    // pour four or five strands down a ledge face, shoulder to shoulder.
    const strands=hanging>1?5:4;
    for(let j=0;j<strands;j++){
      const len=hanging*(.35+rand(j+seed)*.65),dx=(j-(strands-1)/2)*.17+(rand(j*5+seed)-.5)*.06,dz=j%2?.1:-.04;
      drip(w,g,dx,0,dz,len,seed+j,j%2?'caveMoss':'caveMossLight');
    }
  }
  bakeStatic(w,g);return g;
}
// Static clusters are baked into one mesh per material, exactly where their
// parts already sit, so a lump of moss or a dressed wall costs a couple of
// draw calls (and shadow passes) instead of dozens. Every vertex keeps its
// sculpted position; only the object count changes.
export function bakeStatic(w,g){
  const byMaterial=new Map(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),meshes=[];
  g.updateWorldMatrix(true,true);inverse.copy(g.matrixWorld).invert();
  g.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const mesh of meshes){
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    const geo=mesh.geometry.clone().applyMatrix4(matrix);
    if(!geo.index)geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    const list=byMaterial.get(mesh.material)||[];list.push(geo);byMaterial.set(mesh.material,list);
    if(!w.assetGeometry?.has(mesh.geometry))mesh.geometry.dispose();
    mesh.removeFromParent();
  }
  // Emptied sub-groups go; light anchors stay, the lights read them each frame.
  const prune=o=>{for(const child of [...o.children]){prune(child);if(!child.isMesh&&child.children.length===0&&!child.userData.fixture)child.removeFromParent();}};
  prune(g);
  for(const [material,list]of byMaterial){
    const geo=mergeGeometries(list);list.forEach(g=>g.dispose());geo.userData.clayRelief=true;
    // A light pool is an additive quad; letting it cast would drop a square
    // shadow under every fixture.
    const mesh=new THREE.Mesh(geo,material),solid=!material.transparent;mesh.castShadow=solid;mesh.receiveShadow=solid;g.add(mesh);
  }
}

// The walked plate is pressed by hand, not sawn: a rounded slab whose top is
// dented by a few thumb hollows and whose rim rolls unevenly outward, so the
// cap's outline is never a ruled edge and its top is never a plane. Every top
// vertex moves down or not at all, so the highest point of the plate is still
// exactly the collision height and nothing stands proud of the walk line; the
// rim never rolls more than a hand past the collider.
// The plate's shape on its own, for the canyon to cache and lay over its brick
// courses: the cave builds one per deck as it streams in, which a cave can
// afford, but a canyon deck carries up to three and pays ~2.5 ms for each.
export function pressedPlate(width,height,depth,seed=0,radius=Math.min(height*.42,.15)){
  const geo=new RoundedBoxGeometry(width,height,depth,6,radius),p=geo.attributes.position,hw=width/2,hd=depth/2,hh=height/2;
  const hollows=[[-.55,.2,.5],[.05,-.3,.42],[.6,.15,.48]].map(([tx,tz,r],k)=>[hw*(tx+(rand(seed+k)-.5)*.25),hd*(tz+(rand(seed*2+k)-.5)*.4),r+rand(seed+k*5)*.2]);
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
    // Outside the middle of the plate the rim swells by a slow wave along the
    // edge and a quicker one across it, most at the corners.
    const edge=Math.max(0,Math.abs(a)/hw-.7)/.3,front=Math.max(0,Math.abs(c)/hd-.7)/.3;
    const roll=.06+.05*Math.sin(a*2.3+c*1.7+seed)+.04*Math.sin(a*6.7-c*2.9+seed*2);
    let dent=0;for(const [tx,tz,r]of hollows)dent+=Math.exp(-(((a-tx)/r)**2+((c-tz)/(r*.8))**2));
    const top=Math.max(0,b/hh-.3)/.7;
    p.setXYZ(i,a+Math.sign(a)*roll*edge,b-top*(dent*.07+.012*(1+Math.sin(a*9+c*7+seed))),c+Math.sign(c)*roll*front*.6);
  }
  geo.computeVertexNormals();return geo;
}
export function caveCap(w,parent,width,height,depth,x,y,z,seed=0){
  const m=w.mesh(pressedPlate(width,height,depth,seed),'top',parent,x,y,z);m.name='Pressed clay cap';return m;
}
// A playable ledge is a pinched lump of clay, not a sawn slab. The cap is a
// pressed plate whose top is the collision height exactly, over a darker
// inset course; under them hangs one sculpted mass whose top is clamped up
// inside the cap, which swells to a belly proud of the rim a third of the way
// down and sags unevenly underneath, plus two rough lumps so the outline is
// never a clean oval. The mass is the dark clay: it is the frame's nearest
// big rock and the target keeps it a deep slate that the pale walked plate
// and the light pools stand off from. Nothing reaches above the walk line,
// and the mass stops short of whatever sits beneath so a stepped route never
// shows one body poking into another.
export function caveLedgeBody(w,s,g){
  backdropMaterials(w);const width=s.w,half=width/2,seed=s.x*.37;
  caveCap(w,g,width,.3,1.8,half,-.15,0,seed);
  w.box(width-.12,.26,1.66,'terrain2',g,half,-.4,0,.1);
  let clearance=2.4;
  for(const o of w.currentLevel?.platforms||[]){
    const ox=o.baseX??o.x,oy=o.baseY??o.y;
    if(o===s||ox>=s.x+width+.3||ox+o.w<=s.x-.3||oy>=s.y)continue;
    clearance=Math.min(clearance,s.y-oy);
  }
  const drop=Math.max(.45,Math.min(1.7,clearance-.5));
  const geo=new THREE.SphereGeometry(1,24,16),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
    // Two coarse dents and one fine, so the mass reads as thumb-pressed clay
    // rather than a smooth egg.
    const dent=1+.085*Math.sin(a*5+b*4+c*6+seed)+.05*Math.sin(a*12-b*6+c*3+seed*2)+.03*Math.sin(a*21+b*17+c*13+seed*3);
    // Sag more toward one end so the mass hangs like clay pressed by a thumb,
    // and swell to a belly a third of the way down so the body stands proud
    // of the rim on every side instead of pinching in under it.
    const sag=b<0?1+.22*Math.sin(a*2.2+seed)*-b:1,belly=1+.24*Math.exp(-(((b+.2)/.5)**2));
    p.setXYZ(i,a*(half+.02)*dent*belly,Math.min(.36,b*(drop*.85)*dent*sag),c*.95*dent*belly);
  }
  geo.computeVertexNormals();
  const body=w.mesh(geo,'caveClayDark',g,half,-.5,0);body.name='Clay ledge body';
  // One broad lobe of the lit clay under the middle and a darker one toward
  // the far end, both rough and tucked up into the body, so the underside is
  // a sagging mass with a lit bulge and a shadowed pocket, not two eggs stuck on.
  caveRock(w,g,width*.4+(rand(seed)-.5)*.4,-.5-drop*.55,.2,Math.min(2.2,width*.55),drop*.6+.1,1.1,'caveClay',seed,1);
  caveRock(w,g,width*.76,-.45-drop*.5,-.15,Math.min(1.4,width*.36),drop*.5+.1,.9,'caveClayDark',seed+1,1);
}
// Only fixed stone grows moss; timed platforms keep their clear signal. Moss
// is deliberate: it drips off the front corners and cushions one lip rather
// than furring every edge, and a few pebbles sit half-sunk on the walking
// surface towards the back, out of the hero's lane. Everything here is
// static, so the dressing bakes down to one draw per material.
export function caveLedgeDetails(w,s,g,depth=1.8){
  backdropMaterials(w);
  if(s.kind!=='stone'&&s.kind!=='ledge')return;
  const width=s.w,stone=s.kind==='stone',d=group(g);d.name='Ledge dressing';
  // Corner clumps hang a hand outside a deck's edge so their drips fall past
  // the face rather than vanishing inside the body; on a ledge they sit on
  // the lip. The hangs are short and fat, the target's drips, not streamers.
  const lip=stone?-.05:.19;
  caveMoss(w,d,lip,-.025,depth*.46,1.1,width>3?(stone?1.6:1.3):.5,s.x);
  caveMoss(w,d,width-lip,-.035,depth*.43,1.05,stone?1.4:1,s.x+7);
  if(width>6)caveMoss(w,d,width*.61,-.015,-depth*.36,.85,0,s.x+2);
  // Pebbles gather in two groups, one towards each end, the way stones
  // collect in the hollows of the target's ledges, rather than dotting the
  // top evenly; a few are fist-sized and one in three is the pale walked
  // clay, so the group reads as stones rather than as holes.
  for(let i=0;i<Math.min(9,4+Math.floor(width/1.2));i++){
    const t=rand(i*3+s.x),x=Math.min(width-.3,Math.max(.3,width*(i%2?.74:.26)+(t-.5)*Math.min(1.8,width*.36))),r=.11+rand(i+s.x*2)*.17;
    pebble(w,d,x,r*.35,-depth*.18-rand(i*5+s.x)*depth*.3,r,i%3===0?'top':'caveClayDark',i+s.x);
  }
  // One dark stone at each front corner beside the moss, half sunk into the
  // rim: the target's ledges are edged with stones where the drips start.
  for(const side of [0,1])pebble(w,d,side?width-.55:.55,.04,depth*.28,.12+rand(s.x+side)*.05,'caveClayDark',s.x*3+side);
  // Crystals mark about half the free ledges, so they lead the eye along the
  // route without every step glowing alike. They seat at the back edge,
  // behind the walk line. Stone decks already place their own.
  if(s.kind==='ledge'&&width>=3.5&&rand(s.x*.7)<.55){
    // Route-sized, not landmark-sized: at the Heart this cluster stands a
    // stride from the hero and a larger one outshone him.
    caveCrystals(w,g,width-.95,.02,-depth*.5,.95);
    // A moss cushion grows at the cluster's foot, as on the target's ledge.
    caveMoss(w,d,width-1.7,-.02,-depth*.3,.85,0,s.x+3);
  }
  // Stone decks are stacked blocks: fractured pieces tie them to the rock
  // below and lobes round off their corners so the sides stop being rulers.
  // Free ledges carry their own sculpted body instead.
  if(s.kind==='stone'){
    for(let i=0;i<Math.ceil(width/1.7);i++){
      const x=(i+.5)*width/Math.ceil(width/1.7);
      caveRock(w,d,x,-.6,depth*.27,1.36,.6,1,'terrain2',s.x+i);
    }
    // The deck's stacked boxes meet in ruled seams. A staggered sheet of
    // pressed lobes over the face buries them; their fronts stop level with
    // the deck's own face, so nothing stands ahead of the play plane, and
    // they start under the cap, so the walked edge still reads.
    // The lobes are the dark clay, rough, with one in three the lit tone: the
    // deck is the frame's nearest big rock and the target keeps it a deep,
    // chunky slate that the pale plate and the mushroom pool stand off from.
    const cols=Math.max(2,Math.round(width/2.4));
    for(let k=0;k<2;k++)for(let i=0;i<cols+k;i++){
      const x=Math.min(width-.6,Math.max(.6,(i+(k?0:.5))*width/cols)),y=-1.5-k*2.3+(rand(i*3+k+s.x)-.5)*.5;
      caveRock(w,d,x,y,depth*.27+.15,width/cols*1.35,2.3,1.5,(i+k)%3?'caveClayDark':'caveClay',s.x*2+i+k*9,1);
    }
    for(const side of [0,1])for(let k=0;k<3;k++)caveRock(w,d,side?width-.35:.35,-.9-k*2.3,-.3,1.3,2,2.8,k%2?'caveClay':'caveClayDark',s.x+side*5+k,1);
  }
  bakeStatic(w,d);
}
// Walls are collision boxes shared by every chapter, and in the cave their
// flat faces and ruled edges read as slabs. The box stays exactly where the
// collider is; the cave dresses it into one pressed mass. Broad lobes swell
// off the face, the underside is a row of uneven bulges rather than an edge,
// and where the live level shows open air beneath, the bulges sag, fat
// stalactites hang and moss curtains fall from the lips. Clearance is read
// from the level itself so a tunnel roof never grows teeth into the corridor
// under it; with no level to read, nothing hangs and the dressing stays
// within the collider's outline. Everything sits behind the play plane, so
// the hero can brush past a wall without touching its dressing.
// Streamed alongside the wall it dresses, at the wall's own origin, so every
// piece lands exactly where it would have as a child of the wall's view,
// while the view itself keeps collision-aligned bounds (tests/walls.mjs).
export function caveWallDressing(w,s){
  const g=new THREE.Group();g.name='Cave wall dressing '+s.id;g.position.set(s.x,s.y,0);w.levelRoot.add(g);
  caveWallDetails(w,s,g);return g;
}
export function caveWallDetails(w,s,g){
  backdropMaterials(w);
  const wd=s.w,h=s.h??4,bottom=s.y-h;
  if(wd<1.5||h<1.5)return;
  const dress=group(g),mid=group(dress,0,0,-.4),back=group(dress,0,0,-1.2);dress.name='Cave wall dressing';
  // Movers are read at their rest position: the Heart's deck swings past this
  // wall's flank, and read live it counted as a neighbouring step, which
  // tucked the shoulders in and left the collider's bare corner showing.
  const platforms=w.currentLevel?.platforms,at=p=>[p.baseX??p.x,p.baseY??p.y],clearance=x=>{
    if(!platforms)return 0;
    let gap=Infinity;
    for(const p of platforms){const [px,py]=at(p);if(p!==s&&px<x+1.2&&px+p.w>x-1.2&&py<=bottom+.01)gap=Math.min(gap,bottom-py);}
    return gap;
  };
  const free=side=>{const edge=s.x+side*wd;return !platforms||!platforms.some(p=>{const [px,py]=at(p);return p!==s&&px<edge+1.6&&px+p.w>edge-1.6&&py>bottom-.5&&py<s.y+1.5;});};
  // A lobe's centre is clamped so its dented outline never crosses the sides.
  const inset=(x,lw)=>Math.min(wd-lw*.56,Math.max(lw*.56,x));
  // The underside bulges swell well forward of the box face (their fronts
  // reach z 1.6, the play plane is 1.9) and overlap each other, so the ruled
  // bottom edge is buried behind clay from every angle, not merely met by it.
  const n=Math.max(1,Math.round(wd/2.4)),pitch=wd/n;
  for(let i=0;i<n;i++){
    const lw=Math.min(pitch*1.6,wd*.85),x=inset((i+.5)*pitch,lw),gap=clearance(s.x+x);
    // Bulges sag by differing amounts where there is room, so the lower edge
    // undulates instead of ruling a line; over a corridor they stay tucked up.
    const sag=gap>=1.4?Math.min(1,gap*.2)*(.25+rand(s.x+i*5)*.35):0,lh=Math.min(h*.9,1+sag*1.3);
    caveRock(w,dress,x,-h+lh*.42-sag,.3,lw,lh,2.6,'caveClay',s.x+i);
    // A smaller, darker lobe tucked under each seam breaks the row of equal
    // bulges into one irregular mass; it hangs only where the big one sags.
    if(sag>0)caveRock(w,dress,inset(x+pitch*.5,pitch*.9),-h+.35-sag*.9,.9,pitch*.9,1.1+sag*.6,1.8,'caveClayDark',s.x+i+21);
    // Stalactite clusters hang from the seams between bulges: a fat lead
    // tooth with a shorter companion, long enough to clear the sagging clay
    // by a stride (or the bulges swallow all but the tips) and stopping two
    // strides above whatever is routed beneath, so a head never meets one.
    if(gap>=3.4&&rand(s.x+i*3)>.15){
      // The lead tooth hangs just behind the bulges' fronts and roots a
      // little under the box, so most of its length shows below the clay
      // rather than a tip poking out of it; the companion hangs deeper.
      const r=1.05+rand(i+s.x)*.55,th=Math.min(3.8,gap-2.4)*(.8+rand(i*7+s.x)*.2),tx=inset(x-pitch*.35,r*2);
      // The lead tooth is the lit clay: hung against the dark vault, a dark
      // one vanished and the whole underside read as a black band.
      tooth(w,mid,tx,-h-.2,r,th,'caveClay',true,s.x+i);
      tooth(w,back,inset(tx+r*1.1,r),-h+.15,r*.6,th*.6,'caveClayDark',true,s.x+i+3);
    }
    if(gap>=2.5&&rand(s.x*2+i)>.25)caveMoss(w,back,inset(x+pitch*.35,.8),-h+.15,.4,1.25,Math.min(3.2,gap*.6),s.x+i);
  }
  // Shallow swells over the flat front so the face reads as pressed clay,
  // stacked from just above the bulges to just under the walked top edge.
  if(wd>=4&&h>=4){
    const cols=Math.max(1,Math.round(wd/4.5)),rows=Math.max(1,Math.round((h-1.4)/4)),lw=Math.min(wd*.85,4.6),lh=Math.min(h-1.4,3.8);
    const y0=-h+lh*.555+.05,y1=-lh*.56-.05;
    for(let i=0;i<cols;i++)for(let k=0;k<rows;k++){
      const x=inset((i+.5+(k%2?.2:-.2))*wd/cols,lw),y=rows>1?y0+(y1-y0)*k/(rows-1):(y0+y1)/2;
      // The swells are the two self-lit clays, mostly the dark one: a ceiling
      // wall is the frame's dark upper mass and the target keeps it so, with
      // only the bulges of its lower rim catching light.
      caveRock(w,dress,x,y,.5,lw,lh,2,(i+k)%3?'caveClayDark':'caveClay',s.x*3+i+k*7,1);
    }
  }
  // Rounded shoulders so the vertical edges stop being rulers. Where the level
  // routes nothing up a side, they swell past it and the edge is lost; beside
  // a climb they stay inset, so a hero on the neighbouring step is never
  // standing inside one.
  for(const side of [0,1]){
    const open=free(side),x=side?wd:0,out=side?1:-1;
    // On an open side the shoulders stand level with the box face, so the
    // face's ruled edge is covered from the front rather than met from behind.
    for(let y=-h+1.2;y<=-1.3;y+=2.6)caveRock(w,dress,x-out*(open?.4:.7),y+(rand(s.x+y)-.5)*.5,open?0:-.2,open?2.1+rand(s.x*2+y)*.5:1.5,2.5,open?2.4:2.2,'caveClay',s.x+side*3+y);
    // Where a bottom corner hangs over open air, a fat nose lobe buries the
    // collider's corner and a moss curtain pours off it: the shoulders taper
    // to nothing at their ends, and the box showed through between them.
    if(!open)continue;
    caveRock(w,dress,x+out*.1,-h+.45,.1,1.8,2,2.2,'caveClayDark',s.x+x+7);
    if(clearance(s.x+x+out*.6)>=2.4)caveMoss(w,back,x+out*.45,-h-.3,1.1,1.1,1.4,s.x+x+5);
  }
  bakeStatic(w,dress);
}
function layer(w,name,factor,repeat){
  const g=group(w.backRoot);g.name=name;w.parallax.push({group:g,factor,heightFollow:1,repeat});return g;
}

export function buildCaveBackdrop(w){
  backdropMaterials(w);
  const deep=layer(w,'Hazy cave depth',.12,144),arches=layer(w,'Distant cavern arches',.24,144),rooms=layer(w,'Lit grotto recesses',.43,144),vault=layer(w,'Overhead cave silhouette',.72,144);
  hazeGradient(w,deep);
  // Fog is pinned at 28..108 with a smoothstep falloff, so depth is authored
  // in z: the veil sits nearly fogged out (z -73), far spires three quarters
  // (z -51..-56), the arches half (z -43..-48), the alcoves a quarter (z -25..
  // -33) and the vault is crisp. Nothing may seal the layers off from each
  // other: the old continuous alcove wall hid the two farther layers entirely.
  for(let i=-2;i<4;i++){
    const far=group(deep,i*24,0,-59);far.name='Distant mineral chamber';
    // A forest of far spires stands in front of the gradient void, nearly
    // fogged, so each reads as a soft silhouette against the lit chamber: the
    // continuous veil that used to back them made the whole distance one
    // fog-coloured wall and left nothing for the eye to fall back into.
    // They stand in three clumps per cell with open haze between, so the far
    // chamber has deep openings rather than an even fence of cones; each
    // clump is one broad column with thinner companions.
    // The clumps leave one wide opening a quarter in from the cell's left
    // edge: through the layer's parallax that opening stands behind the
    // boarding ledge at the Heart, so the hero is read against the dark void
    // and the pale fogged columns at its sides, as in the target. A pocket of
    // lit mist used to sit in it; it filled the gaps the target keeps dark
    // and bloomed cyan behind the hero.
    for(let c=0;c<3;c++){
      const cx=-11+c*8.6+(rand(i*5+c)-.5)*1.6;
      for(let j=0;j<4;j++){
        const broad=j===1,x=cx+(j-1.5)*1.5+(rand(i*9+j+c*4)-.5)*.8,h=(broad?14:8)+rand(i*3+j+c)*(broad?9:11),r=broad?2.1+rand(i+c)*.8:.7+rand(i+j*5+c)*.9;
        spire(w,far,x,-17+rand(i*5+j+c)*5,r,h,'caveVeil',i*7+j+c*3,3+rand(i+j+c)*5,(rand(i*4+j+c)-.5)*.14);
      }
    }
    tooth(w,far,1+rand(i)*9,9+rand(i+3)*3,1.5+rand(i)*.8,7+rand(i+2)*4,'caveVeil',true,i+1);
  }
  for(let i=-4;i<6;i++){
    const span=group(arches,i*14.4+2+Math.sin(i*2.3)*1.8,0,-43-(i%2)*3);span.name='Distant grotto chamber';
    const y=-6.8+rand(i)*3.4,width=7.5+rand(i+5)*3.2;
    // Far chambers glow faintly: at half fog a full-strength glow map left
    // their crystals hanging as bright shards over rock the haze had taken.
    // The grotto's lit peak is at its right end, so the chambers that carry
    // it are the ones whose right ends sit behind nearer rock at the Heart.
    cavernModel(w,(i+2)%3===0?'grotto':'crystalcap',span,0,y,0,width,(rand(i)-.5)*.85,{lights:false,glow:.3,tint:.6});
    // A rock seat sinks each island's base and spires rise behind it, so the
    // supplied models read as one continuous far chamber, not set miniatures.
    caveRock(w,span,0,y-1.2,-1,width*1.3,3.6,5,'caveSpire',i+40);
    // One rough lobed column and two spires behind each chamber: the column's
    // stacked lobes give the middle distance a massive rock shape, where three
    // smooth cones read as a repeated cut-out.
    pillar(w,group(span,0,0,-4.5),-4.6+(rand(i*7)-.5)*2,y-6-rand(i*3)*2,2.6+rand(i*4)*1.2,11+rand(i+3)*6,'caveSpire',i*5+.3);
    for(let j=1;j<3;j++){
      const x=(j-1)*5+(rand(i*7+j)-.5)*2.6,h=8+rand(i+j*3)*8,base=y-4-rand(i*3+j)*3,r=1.1+rand(i*4+j)*.9;
      spire(w,span,x,base,r,h,'caveSpire',i*5+j,-3-(j%2)*2,(rand(i+j)-.5)*.14);
      // Each stands in a clump: two shorter companions at its foot lean away
      // from it, so the middle rank is a jagged forest, not a row of cones.
      for(const side of [-1,1])spire(w,span,x+side*r*(1.1+rand(i+j+side)*.5),base+rand(i*2+j+side)*1.5,r*(.5+rand(i*3+j*2+side)*.25),h*(.4+rand(i*4+j+side)*.25),'caveSpire',i*7+j*3+side,-3-(j%2)*2+side*.6,side*(.08+rand(i+j*5+side)*.08));
    }
    // A gallery of dark half-fogged columns in the gap between chambers, so
    // the middle distance is a forest at every point of the scroll rather
    // than islands with bare void between. Through the layer's parallax the
    // gallery stands behind the boarding ledge at the Heart, where the target
    // sets its soft dark spires behind and beside the hero: they are darker
    // than the lit void, so the red hero still separates from them, and their
    // tips stop under the ceiling's teeth. One slim column stands at the
    // chamber's right shoulder, where the frame's right third was bare haze.
    const gx=7.2+(rand(i*11)-.5)*1.2;
    for(const [k,[dx,r,h,dz]]of [[1.4,1.9,10.5,-5.5],[-1.6,.9,7.5,-4.2],[3.6,1.05,8.5,-6.5],[5.6,.7,6.5,-3.6],[-5.6,.8,8,-4],[-9.5,.85,8.5,-3],[2.4-gx,1.2,11,-1.5]].entries())
      spire(w,span,gx+dx,-8+rand(i*3+k)*1.2,r*(.85+rand(i+k*7)*.3),h*(.8+rand(i*5+k)*.4),'caveSpire',i*13+k,dz,(rand(i*4+k*3)-.5)*.12);
  }
  // Wider assets overlap their neighbours and disappear into rock at the base.
  // Alternate heights/turns keep the supplied islands from reading as repeated
  // freestanding miniatures against a blank wall.
  // The islands are small enough to sit under the turning ring rather than
  // fill the frame (the models are as tall as they are wide), and the cells
  // are offset so none stands behind the boarding ledge where the hero waits.
  for(let i=-3;i<6;i++){
    const recess=group(rooms,i*16-5.3+Math.sin(i*1.9)*2.4,0,-25-(i%2)*3);recess.name='Embedded grotto alcove';
    const width=3.4+rand(i+11)*1.4,base=-4+rand(i+2)*3.5;
    // Reserve the spiral silhouette for occasional landmarks. Most recesses
    // expose different side views of the crystal formations instead. Their
    // lamps are scaled down with them; at full power they burned the crystal
    // faces to white.
    const key=i%3===0?'grotto':'crystalcap',landmark=i%3===2;
    // A seat behind each island and a rock stack beneath it, not a continuous
    // wall, so the farther layers stay in view between the alcoves and the
    // island still stands on something. Under a landmark the stack is the
    // dark near clay: it fills the bottom of the frame at the Heart, where the
    // target's boulders are darkest, and the pale midground tint made it a
    // smooth bright mass there.
    caveRock(w,recess,0,base+1.5,-3.8,width*.95,6,4,'caveDistant',i+31);
    caveRock(w,recess,0,base-3.6,-.6,width*.72,7.5,3.6,landmark?'cavePillar':'caveDistant',i+52,landmark?1:0);
    if(!landmark)cavernModel(w,key,recess,0,base,0,width,(rand(i+2)-.5)*1.12,{power:.45});
    for(let j=0;j<3;j++)caveRock(w,recess,(j-1)*width*.28,base-.1,-.2,width*.45,2.1,3.6,landmark?'cavePillar':'caveDistant',i*7+j,landmark?1:0);
    tooth(w,recess,width*.44,base+.6,.6,3.8,'caveDistant',false,i+6);
    // Every third alcove is a route landmark in the palette of the built
    // props: a crown of blue-grey clay sunk into the model's peak carries a
    // tall cyan cluster and a moss cushion, and a warm mushroom pool sits on a
    // seat at its foot. The models' own lamps stay dim; these carry the
    // accents, and their fixtures score behind the route's, so they light only
    // their rock. Every alcove would be pretty, but each adds a material per
    // block to the merged backdrop, and the mesh budget is for a whole cave.
    // The camera is orthographic, so distance never shrinks a prop: the
    // clusters are built smaller than the route's to read as a step away.
    if(!landmark)continue;
    // The landmark alcove is built, not supplied: the crystalcap model's
    // tinted albedo went near-black behind the route with no lamp of its own
    // reaching it, where the target shows a blue-grey clay stack. A pile of
    // overlapping rocks with a flatter top carries the cluster on a shelf at
    // mid height rather than on a peak: the camera looks down, so a backdrop
    // this deep already rides high in the frame, and a crown ended up behind
    // the ring's upper arc. The cluster sits to the left, clear of the hoist's
    // hanger, which hangs in front of the alcove's centre at the Heart; the
    // mushrooms sit lower on the right shoulder, beside the hanger rather
    // than behind it, and moss hangs long off both lips so green strands
    // frame the route past the stack.
    const shelf=base+width*.5-.8;
    caveRock(w,recess,-width*.08,base+width*.24-.6,-.6,width*1.05,width*.68,3.8,'caveDistant',i+73);
    caveRock(w,recess,width*.24,base+width*.1-.5,.4,width*.55,width*.38,3,'cavePillar',i+74,1);
    // The shelf has a body: the cluster used to sit on a chip the height of
    // its own pebbles, and read as floating beside the stack.
    caveRock(w,recess,-width*.26,shelf-1.05,1.6,width*.9,2.6,3.2,'caveDistant',i+70);
    for(let k=0;k<4;k++)pebble(w,recess,-width*.26+(rand(k*3+i)-.5)*1.8,shelf+.2,1.9+rand(k+i)*.5,.09+rand(k*5+i)*.08,k%2?'terrain2':'caveDistant',k+i);
    caveCrystals(w,recess,-width*.26,shelf+.15,2,1.15,{power:.5,seat:'cavePillar'});
    caveMoss(w,recess,-width*.26-1,shelf-.15,2.6,1.15,2.6,i+3);
    caveMoss(w,recess,width*.08,shelf-.35,2.2,1.05,3.2,i+9);
    // The mushrooms stand on a shelf of their own, not a bare clump: a broad
    // flat rock with a darker mass beneath it and moss pouring off its lip,
    // so the pool has a ledge to warm and the caps stop hovering.
    caveRock(w,recess,width*.3,base+width*.3-1.2,1.1,3.1,1.3,2.4,'caveDistant',i+80);
    caveRock(w,recess,width*.34,base+width*.3-2.3,.5,2.5,2,2,'caveDistant',i+81);
    caveMoss(w,recess,width*.3-1.25,base+width*.3-.8,2.1,1,1.6,i+13);
    for(let k=0;k<4;k++)pebble(w,recess,width*.3+(rand(k*3+i)-.5)*2,base+width*.3-.52,1.5+rand(k+i)*.5,.09+rand(k*5+i)*.08,k%2?'terrain2':'caveDistant',k+i+9);
    caveMushrooms(w,recess,width*.3,base+width*.3-.6,1.3,.62,{power:.6});
    // A soft pocket of lit haze behind the alcove, the way the target's far
    // chamber glows through the ring: one additive quad, unfogged, so the
    // gradient brightens there and the alcove reads as an opening, not a wall.
    glowPool(w,recess,0,base+width*.5,-6,12,glowMaterial(w,'caveGlowHaze',0x3d7ac4,.42));
    // One shorter spire hides behind each island; the open air above stays
    // plain for whoever stands in front of it.
    spire(w,recess,(rand(i*5)-.5)*1.6,base-2.5,.85+rand(i+7)*.75,4+rand(i*3)*3,'caveDistant',i*9,-5.5,(rand(i*2)-.5)*.16);
  }
  for(let i=-2;i<4;i++){
    const roof=group(vault,i*24,0,-8.5);roof.name='Continuous cave vault';
    // Hidden overlapping volume guarantees roof coverage even on portrait
    // screens. It sits high enough that only sculpted lobes, a lower front row
    // and the stalactites form the visible edge; its straight bottom used to
    // show as a slab.
    w.box(24.4,18,3.5,'caveVault',roof,0,15.6,-1.4,.8);
    for(let j=0;j<6;j++){
      // Fat stalactites carry the ceiling's weight. The one past the cell's
      // middle is always big: through the vault's parallax it hangs inside
      // the ring's upper arc at the Heart, where the target's largest teeth
      // reach a third of the way down the frame. The lobe right of the seam
      // stays small, since it hangs over whoever waits on the boarding ledge.
      // The lobes over the cell's left half hang a step higher than the right
      // half's: at the Heart they used to hide the lit void the target shows
      // through the ring's upper arc, which the teeth now reach instead, while
      // the right half still closes low over the hub and the frame's edge.
      const x=-10+j*4,low=(j>=3?5.1:5.8)+rand(i*6+j)*1.5,big=j!==1&&(j===2||rand(i*8+j)>.35);
      // Rough, like the floor: the ceiling is the frame's other near band and
      // the target's shows the same thumb-pressed texture on its lobes.
      caveRock(w,roof,x,low+2.3,-.3,6.8,6.2,4.6,'caveVault',i*6+j,1);
      caveRock(w,roof,x+2,low+.5,.7,4.4,3.4,3.4,'caveVault',i*6+j+50,1);
      // A third, lower lobe on the other side of each seat sags below its
      // neighbours, so the underside is an uneven mass rather than a scallop.
      // It shares the vault clay: a second material up here would add a
      // merged mesh per block to every cell (tests/scene.mjs caps them).
      caveRock(w,roof,x-1.7,low+.7+rand(i*4+j)*.6,1.1,3.8,2.8,3,'caveVault',i*6+j+80);
      // Stalactites reach a third of the frame: a fat lead tooth with a
      // shorter companion at its shoulder. The biggest never hang in the
      // cell's middle third, which the ring and its rider are watched through.
      // Long and narrow, four or five times as long as they are wide, and the
      // companion three quarters of the lead: the target hangs its big teeth
      // in pairs of near-equal size with lit void between them, and a fatter
      // root merged each pair into one lump that swallowed that void.
      const tr=big?.72+rand(j+i)*.2:.6+rand(j+i)*.22,th=big?3.8+rand(i*8+j)*1.3:1.6+rand(i*8+j)*.8;
      tooth(w,roof,x+.6,low-.4,tr,th,'caveVault',true,i*6+j);
      tooth(w,roof,x+.6+tr*2.2,low-.2,tr*.75,th*.72,'caveVault',true,i*6+j+9);
      if(rand(i*17+j)>.58)caveMoss(w,roof,x-.9,low-.7,2.2,.7+rand(i+j)*.5,.6+rand(i*3+j)*1.4,i*5+j);
    }
    // One full column per cell at the cell seam, where it frames rather than
    // stands behind whoever is on the route; a stump keeps the floor massing
    // uneven without a second dark column at eye level. Both take the hazy
    // pillar tint so they read as a step behind the floor rock, not part of it.
    pillar(w,roof,-12+rand(i+2)*1.5,-13,2.6+rand(i+3)*1.2,22.5,'cavePillar',i*2+.6);
    pillar(w,roof,3+rand(i+5)*4,-13,1.8+rand(i+4)*.9,10+rand(i+7)*3,'cavePillar',i*2+4);
    // A tall crisp column and a slim companion a quarter cell in from the
    // seam: through the vault's parallax they stand behind and just left of
    // the boarding ledge at the Heart, the dark near column the target sets
    // behind the hero, with the lit void and the ring on his other side. The
    // red hero reads against charcoal better than against lit haze. They take
    // the vault clay, which every block of the cell already holds, so the cell
    // bakes no extra mesh for them (tests/scene.mjs caps the count).
    spire(w,roof,-5+rand(i+12)*.3,-13,1.1+rand(i+13)*.2,19+rand(i+14)*1.5,'caveVault',i*3+11,-.6,(rand(i+15)-.5)*.05);
    spire(w,roof,-6.7,-13,.6+rand(i+16)*.15,11+rand(i+17)*2,'caveVault',i*3+12,.2,-.06);
    // A second full column stands off the cell's right third in the midground
    // tint: it frames the mushrooms seated in front of it the way the target's
    // lit right-hand wall does, and gives the dark floor band a lighter edge
    // to stand in front of. The pale far-rank clay was tried here and turned
    // the whole right edge into a bright slab.
    pillar(w,roof,6.5+rand(i+9)*1.2,-13,2.4+rand(i+8)*.8,20+rand(i+6)*3,'caveDistant',i*2+7);
    for(let j=0;j<6;j++){
      const x=-10+j*4,base=-3.9+rand(i*8+j)*.5,seat=j===1||j===4;
      // The floor band is the frame's foreground: dark, rough, pebble-strewn
      // boulders that the paler ranks behind fall back from. The big masses
      // alternate the two near clays so the band is a jumble of lit crowns
      // and dark crevices, and every one is rough, since this is the rock
      // that sits nearest the camera of all the backdrop.
      caveRock(w,roof,x,base-2.6,-.6,7.2,6.4,4.4,j%2?'caveVault':'caveColumn',j+i*7,1);
      caveRock(w,roof,x+(j%2?-1.7:1.9),base-1.2-rand(i+j*3)*.6,1.4,2.4+rand(j+i*2)*1.2,1.7+rand(i*3+j)*.8,2.2,j%2?'caveColumn':'caveVault',i*9+j+30,1);
      caveRock(w,roof,x+(j%2?1.2:-2.2),base-2-rand(i*2+j)*.5,1.9,1.6+rand(j*2+i)*.8,1.2+rand(i+j)*.5,1.6,'caveVault',i*9+j+60,1);
      // Pebbles half sunk into each mass's lit crown, seated on the ellipsoid
      // itself so none floats, in the two clays already in this block.
      for(let k=0;k<4;k++){const dx=(rand(i*3+j+k*5)-.5)*3.4,dz=1.1+rand(k*3+i)*.9;pebble(w,roof,x+dx,crown(base-2.6,7.2,6.4,4.4,dx,dz)+.02,dz,.13+rand(k+j*3+i)*.14,k%2?'caveColumn':'caveVault',k+j*7+i);}
      // Floor stalagmites are rounded clay cones in the dark clay, a tall one
      // with a squat companion, so the band's points are soft silhouettes
      // like the target's rather than the chipped ribs of the far forest.
      if(j%2===0){
        const r=.7+rand(j*3+i)*.3,h=2.6+rand(j+i)*1.8;
        tooth(w,roof,x+.7,base+.2,r,h,'caveVault',false,i+j);
        tooth(w,roof,x+.7-r*1.7,base+.1,r*.65,h*.5,'caveVault',false,i+j+40);
      }else tooth(w,roof,x-.9,base-.2,.5+rand(j*3+i)*.3,1.4+rand(j+i)*1,'caveColumn',false,i+j+9);
      if(seat){
        // Each accent sits on an outcrop of its own: a broad, rough boulder
        // of the dark clay ahead of the floor mass with a second lobe under
        // its shoulder, a moss skirt off both ends and pebbles seated on its
        // crown, so the cluster grows out of a body of rock the eye can see
        // rather than off a moss pad on the dome of the mass behind it. The
        // moss hangs just ahead of the boulder's face: strands hang straight
        // while an ellipsoid bulges forward beneath its crown.
        caveRock(w,roof,x+.3,base-.5,1.1,4.6,2.6,2.4,'caveVault',i*9+j+90,1);
        caveRock(w,roof,x-1.3,base-1.5,1.5,2.6,1.9,1.8,'caveColumn',i*9+j+95,1);
        caveMoss(w,roof,x-.8,base+.62,2.3,1.05,1+rand(i+j)*.5,i+j);
        caveMoss(w,roof,x+1.4,base+.64,2.25,.95,.7+rand(i*3+j)*.4,i+j+4);
        for(let k=0;k<5;k++){const dx=(rand(k*3+i+j)-.5)*2.2,dz=.2+rand(k+i)*.5;pebble(w,roof,x+.3+dx,crown(base-.5,4.6,2.6,2.4,dx,dz)+.02,1.1+dz,.11+rand(k*5+j)*.1,k%2?'caveColumn':'caveVault',k+i+j);}
        if(j===1)caveCrystals(w,roof,x+.4,base+.78,1.3,1.4,{seat:'caveVault',halo:1.15});
        else{
          caveMushrooms(w,roof,x-.2,base+.72,1.3,1);
          // A small cluster on the second lobe's crown beside the mushrooms:
          // the target frames the route's lower right with a cyan cluster
          // and a warm pool side by side. It carries no fixture (the pool's
          // crystal slot goes to the route's own cluster), only its bloom.
          caveCrystals(w,roof,x-2,crown(base-1.5,2.6,1.9,1.8,-.7,.5)+.02,2,.7,{light:false,glow:true,halo:.5,seat:'caveVault'});
        }
      }
    }
  }
  for(let i=0;i<14;i++){
    const ember=w.ball(.009,.013,.01,'flame',w.backRoot,-8+i*10,(i%7)*.8,-7-(i%3));ember.castShadow=false;
    w.ambient.push({mesh:ember,base:ember.position.clone(),seed:i});
  }
  // Static descendants retain their exact transforms. Only the parallax layer
  // and its wrapping cells need local matrix composition each frame.
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  for(const layer of w.parallax)for(const cell of layer.group.children){
    mergeCaveCell(w,cell);
    cell.traverse(o=>{if(o!==cell){o.updateMatrix();o.matrixAutoUpdate=false;}});
    cell.updateWorldMatrix(true,true);
    cell.userData.caveBounds=new THREE.Box3().setFromObject(cell).applyMatrix4(new THREE.Matrix4().copy(cell.matrixWorld).invert()).getBoundingSphere(new THREE.Sphere());
  }
}

// A backdrop cell never moves inside itself: the whole cell slides as one
// parallax unit. Bake its constructed rock, moss and mushroom meshes into one
// mesh per material and block of space, exactly where they already sit, so a
// cell costs a handful of draw calls and world matrices instead of dozens.
// Every vertex keeps its sculpted position, so the composition is unchanged.
//
// Two kinds of mesh stay on their own. Instances of the supplied grotto models
// share a single copy of their geometry between placements, and merging would
// duplicate it per instance. Meshes registered as light fixtures are held by
// `w.torches`, which samples their world position every frame.
function mergeCaveCell(w,cell){
  const fixtures=new Set(w.torches.map(t=>t.flame));
  const byMaterial=new Map(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4();
  cell.updateWorldMatrix(true,true);inverse.copy(cell.matrixWorld).invert();
  const collect=o=>{
    for(const child of [...o.children]){
      if(child.userData.sharedModel)continue;
      collect(child);
      if(!child.isMesh||fixtures.has(child))continue;
      // Merging needs one material and one identical attribute set. Anything
      // unusual keeps its own mesh rather than risking a dropped form.
      if(Array.isArray(child.material))continue;
      if(Object.keys(child.geometry.attributes).sort().join(',')!=='normal,position,uv')continue;
      matrix.multiplyMatrices(inverse,child.matrixWorld);
      const baked=child.geometry.clone().applyMatrix4(matrix);
      if(!baked.index)baked.setIndex([...Array(baked.attributes.position.count).keys()]);
      // Group by material and by a coarse block of space. A cell is both wider
      // and far taller than the view, so keeping blocks apart lets the parts
      // that sit off to the side or above the screen stay frustum-culled
      // instead of riding along with the part being looked at.
      baked.computeBoundingSphere();
      const c=baked.boundingSphere.center;
      const key=`${child.material.uuid}@${Math.round(c.x/MERGE_BLOCK)}:${Math.round(c.y/MERGE_BLOCK)}`;
      const bucket=byMaterial.get(key)||{material:child.material,list:[]};
      bucket.list.push(baked);byMaterial.set(key,bucket);
      if(w.assetGeometry&&!w.assetGeometry.has(child.geometry))child.geometry.dispose();
      child.removeFromParent();
    }
  };
  collect(cell);
  const attach=(geo,material)=>{
    geo.userData.clayRelief=true;geo.computeBoundingBox();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);
    mesh.name='Merged cavern backdrop';mesh.castShadow=false;mesh.receiveShadow=false;cell.add(mesh);
  };
  for(const {material,list}of byMaterial.values()){
    const merged=list.length>1?mergeGeometries(list):null;
    // Keep every form even if a merge is ever rejected: fall back to the
    // separate baked meshes rather than losing part of the cave.
    if(merged){list.forEach(g=>g.dispose());attach(merged,material);}
    else for(const geo of list)attach(geo,material);
  }
  // Groups emptied by the merge no longer draw or transform anything. Supplied
  // model instances are left whole: they carry their own light anchors, which
  // hold no geometry and must survive.
  const prune=o=>{
    for(const child of [...o.children]){
      if(child.userData.sharedModel)continue;
      prune(child);
      if(!child.isMesh&&!child.isLight&&child.children.length===0&&!fixtures.has(child))child.removeFromParent();
    }
  };
  prune(cell);
}

const caveFrustum=new THREE.Frustum(),caveProjection=new THREE.Matrix4(),caveSphere=new THREE.Sphere();
export function cullCaveCells(w){
  w.camera.updateMatrixWorld();
  caveFrustum.setFromProjectionMatrix(caveProjection.multiplyMatrices(w.camera.projectionMatrix,w.camera.matrixWorldInverse));
  for(const layer of w.parallax)for(const cell of layer.group.children){
    if(!cell.userData.caveBounds)continue;
    cell.updateWorldMatrix(true,false);
    cell.visible=caveFrustum.intersectsSphere(caveSphere.copy(cell.userData.caveBounds).applyMatrix4(cell.matrixWorld));
  }
}
