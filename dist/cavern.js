import * as THREE from './lib/three.module.js';
import {mergeGeometries} from './lib/BufferGeometryUtils.js';
import {clayMaterial,sculptClay} from './clay.js';
import {cavernModel} from './cavern-asset.js';

const group=(parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
// Sampled from the supplied grotto/crystalcap albedo under their glow masks:
// the lit crystal faces average #5fedf2 and the mushroom caps #f3982f, and the
// models emit their own colour at intensity .7 (white emissive x glow map).
// Built props now use those numbers so all three depth tiers agree.
// The caps sit a step deeper into orange than the sampled albedo so their warm
// pools stay distinct from the cream stems and the gold hub under blue fog.
export const CAVE_CRYSTAL=0x5fedf2,CAVE_MUSHROOM=0xf28a2c;
function materials(w){
  for(const [name,color,emissive,intensity,roughness]of [
    ['caveMushroom',CAVE_MUSHROOM,0xff7a12,.8,.85],
    ['caveCrystal',CAVE_CRYSTAL,CAVE_CRYSTAL,.85,.62]
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
function lightMarker(w,node,kind,color,power){
  w.torches.push({flame:node,position:new THREE.Vector3(),phase:0,kind,color,power,range:11});
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
// retained like the shared shapes, keeps the silhouette at a sixth of that.
function leafGeometry(w){
  if(!w.caveLeaf){
    const geo=sculptClay(w,new THREE.SphereGeometry(1,9,6),{amplitude:.035});
    geo.userData.clayRelief=true;w.assetGeometry?.add(geo);w.caveLeaf=geo;
  }
  return w.caveLeaf;
}
function leaf(w,rx,ry,rz,material,parent,x,y,z){
  const m=w.mesh(leafGeometry(w),material,parent,x,y,z);m.scale.set(rx,ry,rz);return m;
}
// Authored decoration measures its silhouette, so the workshop's copies skip
// the pool, which reaches well past the caps.
export function caveMushrooms(w,parent,x,y,z=-1.2,size=1,{glow=true}={}){
  materials(w);const g=group(parent,x,y,z);g.name='Amber mushroom cluster';g.scale.setScalar(size);
  // The pool sits just ahead of the seat so the rock underneath cannot swallow
  // it, yet a cluster is always placed behind the walk line, so it stays clear
  // of the hero.
  if(glow)glowPool(w,g,0,.7,.4,3.4,glowMaterial(w,'caveGlowWarm',0xff8a2e,.55));
  for(const [dx,h,r]of [[0,1.25,.55],[-.6,.62,.32],[.65,.78,.37]]){
    w.cylinder(.095,h,'cream',g,dx,h*.48,0);
    w.ball(r,.23,r*.83,'caveMushroom',g,dx,h,0);
    w.ball(r*.72,.045,r*.63,'caveMushroom',g,dx,h-.14,.025);
    if(dx===0)lightMarker(w,anchor(g,dx,h,0),'mushroom',0xff962f,45*size);
  }
  bakeStatic(w,g);return g;
}
// The supplied models grow their crystals as squat, many-faceted geode clumps:
// measured height/width 0.9-1.4, eight-ish facets, blunt tips seated in rock.
// The old build was a 3.4:1 six-sided spike, which both mismatched the models
// and gave safe scenery the silhouette this game uses for hazards. These run
// taller than the models (about 1.5:1) so a cluster reads as a landmark from
// across the frame, while the blunt cap still keeps them off the hazard shape.
const GEMS=[[-.42,.1,.3,.6,-.3],[-.04,.24,.4,.8,.04],[.4,.06,.27,.52,.28],[-.2,-.16,.2,.36,-.14],[.24,-.2,.17,.3,.18]];
export function caveCrystals(w,parent,x,y,z=-1.15,size=1,{light=true,glow=light}={}){
  materials(w);const g=group(parent,x,y,z);g.name='Blue crystal cluster';g.scale.setScalar(size);
  // Foreground copies fade with their scenery and carry no fixture; a pool
  // there would have to fade with them, so only lit clusters get one. The
  // workshop's copies measure their silhouette and opt out as well.
  if(glow)glowPool(w,g,0,.6,.5,3.2,glowMaterial(w,'caveGlowCool',0x3fb6ff,.55));
  w.ball(.66,.2,.46,'terrain2',g,0,.1,0);
  for(const [dx,dz,r,h,tilt]of GEMS){
    const gem=w.mesh(new THREE.CylinderGeometry(r*.44,r,h,8,1),'caveCrystal',g,dx,.16+h/2,dz);
    gem.rotation.z=tilt;
    // A shallow cap keeps it reading as a crystal without a spike's point.
    w.mesh(new THREE.ConeGeometry(r*.44,r*.52,8),'caveCrystal',gem,0,h/2+r*.26,0);
    w.box(r*1.25,.3,r*1.3,'terrain2',g,dx,.13,dz,.1);
    if(light&&r===.4)lightMarker(w,anchor(g,dx,.16+h/2,dz),'crystal',0x46bbff,42*size);
  }
  bakeStatic(w,g);return g;
}
// Sky and fog are one haze. Fog is mixed after tone mapping, so a fully fogged
// spire shows exactly this hex, and the void behind it has to be the same hex
// or the far layer reads as cut-outs. The route's own sky is a dark navy that
// made the whole backdrop a wall; this is the lighter blue-grey of the middle
// distance, with the near ceiling and floor supplying the dark bands.
export const CAVE_HAZE=0x335d90;
function backdropMaterials(w){
  // Each layer back is lighter and bluer before fog, so fog only finishes the
  // gradient instead of carrying it alone from one shared tint. The near rock
  // carries a blue emissive floor: its undersides face away from every light
  // and went black, where the target keeps them a readable deep navy. Moss is
  // the yellow-green of the target, not olive, so it reads against blue rock.
  for(const [name,color,emissive,glow]of [
    ['caveVault',0x242d3c,0x1a2338,.7],['caveColumn',0x27344a,0x18243a,.45],['caveDistant',0x22385a,0x1c355e,.5],
    ['caveVeil',0x3a5c82,0x3a5c82,.2],['caveMoss',0x7e9b3c,0x7e9b3c,.05],['caveMossLight',0x9eba4e,0x9eba4e,.05]
  ])if(!w.mat[name]){
    w.mat[name]=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:glow,roughness:.94,metalness:0});
    clayMaterial(w,w.mat[name],name.includes('Moss')?.022:.06);
  }
}
const rand=n=>{const r=Math.sin(n*117.17+51.61)*43758.5453;return r-Math.floor(r);};
const MERGE_BLOCK=8;

// Rounded rock volumes with irregular, overlapping facets, rather than extruded
// flat silhouettes. Local coordinates keep the shared clay field attached.
export function caveRock(w,parent,x,y,z,width,height,depth,material='caveColumn',seed=0){
  backdropMaterials(w);
  const geo=new THREE.SphereGeometry(1,14,12),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
    const dent=1+.065*Math.sin(a*9+b*7+c*5+seed)+.045*Math.sin(a*5-b*11+c*7+seed*2);
    p.setXYZ(i,a*width*.5*dent,b*height*.5*dent,c*depth*.5*dent);
  }
  geo.computeVertexNormals();const mesh=w.mesh(geo,material,parent,x,y,z);
  mesh.name='Rounded cavern rock';return mesh;
}
// A full-bellied cone: the old profile stayed needle-thin for most of its
// length, so even a wide stalactite read as a spike rather than a mass.
function tooth(w,parent,x,y,r,h,material,down=true,seed=0){
  const profile=[[.025,-1],[.14,-.86],[.3,-.66],[.48,-.46],[.66,-.26],[.84,-.1],[1,.04]];
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
function spire(w,parent,x,base,r,h,material,seed=0,z=0,lean=0){
  const profile=[[.03,1],[.12,.9],[.24,.76],[.4,.58],[.58,.38],[.78,.18],[.95,.04],[1,-.05]];
  const geo=new THREE.LatheGeometry(profile.map(([a,b])=>new THREE.Vector2(a*r,b*h)),11),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=y/h,q=1+.12*Math.sin(t*9+x*4+z*3+seed)+.06*Math.sin(t*23+seed*2);
    p.setXYZ(i,x*q+Math.sin(t*4+seed)*r*.2,y,z*q);
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

export function caveMoss(w,parent,x,y,z=0,size=1,hanging=0,seed=0){
  backdropMaterials(w);const g=group(parent,x,y,z);g.name='Hanging cave moss';g.scale.setScalar(size);
  for(let i=0;i<5;i++){
    const pad=leaf(w,.18,.095,.115,i%2?'caveMoss':'caveMossLight',g,(i-2)*.12,.06+rand(i+seed)*.05,rand(i+seed*2)*.15);
    pad.rotation.set(.3,(i-2)*.45,(i-2)*-.2);
  }
  if(hanging)for(let j=0;j<3;j++){
    const len=hanging*(.65+rand(j+seed)*.35),dx=(j-1)*.17;
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(dx,.02,0),new THREE.Vector3(dx+.04,-len*.4,.1),new THREE.Vector3(dx-.09,-len,.13)]);
    w.mesh(new THREE.TubeGeometry(path,9,.045,5,false),'caveMoss',g);
    for(let i=0;i<4;i++){
      const t=(i+.6)/4,pos=path.getPoint(t),drip=leaf(w,.08,.17,.075,i%2?'caveMoss':'caveMossLight',g,pos.x+(i%2?-.04:.04),pos.y,pos.z);
      drip.rotation.z=(i%2?-.25:.2);
    }
  }
  bakeStatic(w,g);return g;
}
// Static clusters are baked into one mesh per material, exactly where their
// parts already sit, so a lump of moss or a dressed wall costs a couple of
// draw calls (and shadow passes) instead of dozens. Every vertex keeps its
// sculpted position; only the object count changes.
function bakeStatic(w,g){
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

// Only fixed stone ledges grow moss. Timed platforms keep their clear signal.
export function caveLedgeDetails(w,s,g,depth=1.8){
  backdropMaterials(w);
  if(s.kind==='stone'||s.kind==='ledge'){
    caveMoss(w,g,.19,-.025,depth*.46,.92,s.w>3?1.0:.5,s.x);
    caveMoss(w,g,s.w-.2,-.035,depth*.43,.9,.7,s.x+7);
    if(s.w>6)caveMoss(w,g,s.w*.61,-.015,-depth*.36,.8,0,s.x+2);
    // Crystals mark about half the free ledges, so they lead the eye along the
    // route without every step glowing alike. They seat at the back edge,
    // behind the walk line. Stone decks already place their own.
    if(s.kind==='ledge'&&s.w>=3.5&&rand(s.x*.7)<.55)caveCrystals(w,g,s.w-.85,.02,-depth*.5,.8);
    // A lumpy clay underbelly rather than a flat slab bottom. Free ledges get
    // the full mass; stone decks already have bodies, so theirs stay as small
    // fractured pieces. It hangs under a step below the walk line, so nothing
    // routed beneath a ledge is hidden by it.
    const lump=s.kind==='ledge'?1:.4;
    for(let i=0;i<Math.ceil(s.w/1.7);i++){
      const x=(i+.5)*s.w/Math.ceil(s.w/1.7);
      caveRock(w,g,x,-.44-.3*lump,depth*.27,1.12+.6*lump,.37+.55*lump,.77+.5*lump,'terrain2',s.x+i);
    }
  }
}
// Walls are collision boxes shared by every chapter, and in the cave their
// flat faces and ruled edges read as slabs. The bottom edge grows lobes and,
// where nothing is routed close beneath, fat stalactites and moss. Clearance
// is read from the live level so a tunnel roof never sprouts teeth into the
// corridor under it, and everything sits behind the play plane so the hero
// can brush past a wall without touching its dressing.
// Streamed alongside the wall it dresses, at the wall's own origin, so every
// piece lands exactly where it would have as a child of the wall's view.
export function caveWallDressing(w,s){
  const g=new THREE.Group();g.name='Cave wall dressing '+s.id;g.position.set(s.x,s.y,0);w.levelRoot.add(g);
  caveWallDetails(w,s,g);return g;
}
export function caveWallDetails(w,s,g){
  backdropMaterials(w);
  const h=s.h??4,bottom=s.y-h,dress=group(g),back=group(dress,0,0,-1.6);dress.name='Cave wall dressing';
  const clearance=x=>{
    let gap=Infinity;
    for(const p of w.currentLevel?.platforms||[])if(p!==s&&p.x<x+1.6&&p.x+p.w>x-1.6&&p.y<=bottom+.01)gap=Math.min(gap,bottom-p.y);
    return gap;
  };
  const n=Math.max(2,Math.ceil(s.w/2.7)),pitch=s.w/n;
  for(let i=0;i<n;i++){
    const x=(i+.5)*pitch,gap=clearance(s.x+x);
    if(gap<1.2)continue;
    const drop=Math.min(.7,gap*.2);
    caveRock(w,back,x,-h+.5-drop,.4,pitch+1.6,1.4+drop,1.8,'terrain',s.x+i);
    // A rolled lip in front of the face hides the ruled bottom edge. It stops
    // at the edge itself rather than hanging, so it never meets a head.
    caveRock(w,dress,x,-h+.5,1,pitch*1.25,1,1,'terrain',s.x+i+9);
    if(gap>=4.5&&rand(s.x+i*3)>.35)tooth(w,back,x+.7,-h+.1,.55+rand(i+s.x)*.45,1+rand(i*7+s.x)*Math.min(1.4,gap*.15),'terrain2',true,s.x+i);
    if(gap>=2.5&&rand(s.x*2+i)>.5)caveMoss(w,back,x-.8,-h+.1,1.1,.8,Math.min(1.4,gap*.3),s.x+i);
  }
  // Rounded shoulders so the vertical edges stop being rulers.
  for(const x of [0,s.w])for(let k=0;k<2;k++)caveRock(w,back,x,-h+1.6+k*2.8,.3,1.8,2.4,1.8,'terrain',s.x+x+k*3);
  bakeStatic(w,dress);
}
function layer(w,name,factor,repeat){
  const g=group(w.backRoot);g.name=name;w.parallax.push({group:g,factor,heightFollow:1,repeat});return g;
}

export function buildCaveBackdrop(w){
  backdropMaterials(w);
  const deep=layer(w,'Hazy cave depth',.12,144),arches=layer(w,'Distant cavern arches',.24,144),rooms=layer(w,'Lit grotto recesses',.43,144),vault=layer(w,'Overhead cave silhouette',.72,144);
  // Fog is pinned at 28..108 with a smoothstep falloff, so depth is authored
  // in z: the veil sits nearly fogged out (z -73), far spires three quarters
  // (z -51..-56), the arches half (z -43..-48), the alcoves a quarter (z -25..
  // -33) and the vault is crisp. Nothing may seal the layers off from each
  // other: the old continuous alcove wall hid the two farther layers entirely.
  for(let i=-2;i<4;i++){
    const far=group(deep,i*24,0,-59);far.name='Distant mineral chamber';
    // A nearly fogged veil keeps the haze from being a flat fill, and a forest
    // of far spires gives that haze something to swallow.
    caveRock(w,far,0,-1,-14,30,48,9,'caveVeil',i);
    for(let j=0;j<9;j++){
      const x=-11.5+j*2.7+rand(i*9+j)*1.4,h=9+rand(i*3+j)*11,r=.9+rand(i+j*5)*1.2;
      spire(w,far,x,-17+rand(i*5+j)*5,r,h,'caveVeil',i*7+j,3+rand(i+j)*5,(rand(i*4+j)-.5)*.14);
    }
    tooth(w,far,1+rand(i)*9,9+rand(i+3)*3,1.5+rand(i)*.8,7+rand(i+2)*4,'caveVeil',true,i+1);
  }
  for(let i=-4;i<6;i++){
    const span=group(arches,i*14.4+2+Math.sin(i*2.3)*1.8,0,-43-(i%2)*3);span.name='Distant grotto chamber';
    const y=-6.8+rand(i)*3.4,width=7.5+rand(i+5)*3.2;
    cavernModel(w,i%3===0?'grotto':'crystalcap',span,0,y,0,width,(rand(i)-.5)*.85,{lights:false});
    // A rock seat sinks each island's base and spires rise behind it, so the
    // supplied models read as one continuous far chamber, not set miniatures.
    caveRock(w,span,0,y-1.2,-1,width*1.3,3.6,5,'caveDistant',i+40);
    for(let j=0;j<3;j++){
      const x=(j-1)*5+(rand(i*7+j)-.5)*2.6,h=8+rand(i+j*3)*8;
      spire(w,span,x,y-4-rand(i*3+j)*3,1.1+rand(i*4+j)*.9,h,'caveDistant',i*5+j,-3-(j%2)*2,(rand(i+j)-.5)*.14);
    }
  }
  // Wider assets overlap their neighbours and disappear into rock at the base.
  // Alternate heights/turns keep the supplied islands from reading as repeated
  // freestanding miniatures against a blank wall.
  // The islands are small enough to sit under the turning ring rather than
  // fill the frame (the models are as tall as they are wide), and the cells
  // are offset so none stands behind the boarding ledge where the hero waits.
  for(let i=-3;i<6;i++){
    const recess=group(rooms,i*16-5.3+Math.sin(i*1.9)*2.4,0,-25-(i%2)*3);recess.name='Embedded grotto alcove';
    const width=4+rand(i+11)*2,base=-4+rand(i+2)*3.5;
    // A seat behind each island and a rock stack beneath it, not a continuous
    // wall, so the farther layers stay in view between the alcoves and the
    // island still stands on something.
    caveRock(w,recess,0,base+1.5,-3.8,width*.95,6,4,'caveDistant',i+31);
    caveRock(w,recess,0,base-3.6,-.6,width*.72,7.5,3.6,'caveDistant',i+52);
    // Reserve the spiral silhouette for occasional landmarks. Most recesses
    // expose different side views of the crystal formations instead. Their
    // lamps are scaled down with them; at full power they burned the crystal
    // faces to white.
    cavernModel(w,i%3===0?'grotto':'crystalcap',recess,0,base,0,width,(rand(i+2)-.5)*1.12,{power:.45});
    for(let j=0;j<3;j++)caveRock(w,recess,(j-1)*width*.28,base-.1,-.2,width*.45,2.1,3.6,'caveDistant',i*7+j);
    tooth(w,recess,width*.44,base+.6,.6,3.8,'caveDistant',false,i+6);
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
      // Fat stalactites carry the ceiling's weight, but never in the cell's
      // middle third: that is the open air a rider or jumper is watched
      // through, and the small ones there stop well above head height.
      const x=-10+j*4,low=5.6+rand(i*6+j)*1.1,big=j!==1&&j!==2&&rand(i*8+j)>.5;
      caveRock(w,roof,x,low+2.3,-.3,6.8,6.2,4.6,'caveVault',i*6+j);
      caveRock(w,roof,x+2,low+.5,.7,4.4,3.4,3.4,'caveVault',i*6+j+50);
      tooth(w,roof,x+.6,low-.4,big?1.2+rand(j+i)*.5:.5+rand(j+i)*.4,big?2.6+rand(i*8+j)*1.2:1.1+rand(i*8+j)*1.2,'caveVault',true,i*6+j);
      if(rand(i*17+j)>.58)caveMoss(w,roof,x+.35,low-.55,2,.7+rand(i+j)*.5,.6+rand(i*3+j)*1.4,i*5+j);
    }
    // One full column per cell at the cell seam, where it frames rather than
    // stands behind whoever is on the route; a stump keeps the floor massing
    // uneven without a second dark column at eye level.
    pillar(w,roof,-12+rand(i+2)*1.5,-13,2.6+rand(i+3)*1.2,22.5,'caveColumn',i*2+.6);
    pillar(w,roof,3+rand(i+5)*4,-13,1.8+rand(i+4)*.9,10+rand(i+7)*3,'caveColumn',i*2+4);
    for(let j=0;j<6;j++){
      const x=-10+j*4,base=-3.9+rand(i*8+j)*.5;
      caveRock(w,roof,x,base-2.6,-.6,7.2,6.4,4.4,'caveColumn',j+i*7);
      if(j%2===0)tooth(w,roof,x+.7,base+.3,.75+rand(j*3+i)*.4,2.2+rand(j+i)*1.8,'caveColumn',false,i+j);
      else tooth(w,roof,x-.9,base-.2,.5+rand(j*3+i)*.3,1.2+rand(j+i)*.9,'caveColumn',false,i+j+9);
      if(j===1||j===4){
        caveMoss(w,roof,x,base+.55,1.8,1.15,.7,i+j);
        if(j===1)caveCrystals(w,roof,x+.4,base+.6,.7,1.25);
        else caveMushrooms(w,roof,x-.2,base+.7,1.1,.8);
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
