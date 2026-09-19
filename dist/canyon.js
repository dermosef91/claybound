import * as THREE from './lib/three.module.js';
import {canyonModel} from './canyon-assets.js';
import {cloudModel} from './clouds.js';
import {clayMaterial,clayBox,cachedClayShape,retainClayShape,positionGroups} from './clay.js';
import {archLiftCeiling} from './great-arch.js';
import {makeMovingPlatform,braid,movingPlatformMaterials} from './moving-platform.js';
import {porousClay} from './porous-clay.js';
import {skyGradient} from './sky-gradient.js';

const random=n=>{const f=Math.sin(n*127.1+47.7)*43758.5453;return f-Math.floor(f);};
const group=parent=>{const g=new THREE.Group();parent.add(g);return g;};

// Knead neutral rounded blocks; surface relief now comes from the clay ball.
// This bounded cache participates in the same streaming eviction as other clay.
function block(w,parent,width,height,depth,x,y,z,material,seed){
  if(!w.clay)return w.box(width,height,depth,material,parent,x,y,z,.25);
  const variant=Math.abs(Math.floor(seed))%7,key='canyon:'+ [width,height,depth,variant].map(v=>v.toFixed(3)).join(':');
  let geo=cachedClayShape(w,key);
  if(!geo){
    geo=clayBox(w,width,height,depth,.28).clone();
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const a=p.getX(i),b=p.getY(i),c=p.getZ(i),s=variant*1.71;
      const taper=1-.04*Math.sin(b*4+s);
      p.setXYZ(i,a*taper,b+Math.sin(a*5+s)*.025,c+Math.sin(a*8+b*6+s)*.075+Math.sin(b*13-s)*.04);
    }
    geo.computeVertexNormals();
    // The rounded box contains duplicated triangle corners. Join their normals
    // after kneading so tessellation diagonals cannot become hard seams.
    const normals=geo.attributes.normal,{group,groups}=positionGroups(p);
    const sx=new Float64Array(groups),sy=new Float64Array(groups),sz=new Float64Array(groups);
    for(let i=0;i<p.count;i++){const k=group[i];sx[k]+=normals.getX(i);sy[k]+=normals.getY(i);sz[k]+=normals.getZ(i);}
    for(let i=0;i<p.count;i++){
      const k=group[i],nx=sx[k],ny=sy[k],nz=sz[k],length=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      normals.setXYZ(i,nx/length,ny/length,nz/length);
    }
    geo.computeBoundingBox();geo.computeBoundingSphere();geo.userData.clayRelief=true;
    retainClayShape(w,key,geo);
  }
  return w.mesh(geo,material,parent,x,y,z);
}
function rock(w,parent,x,y,z,size=1,seed=0,material='terrain'){
  const m=w.ball(.39*size,.23*size,.31*size,material,parent,x,y+.16*size,z);m.rotation.y=seed*.73;m.rotation.z=(random(seed)-.5)*.18;return m;
}
function capMaterial(w,seed){
  if(!w.clay)return 'top';
  const variant=Math.abs(Math.floor(seed))%5;w.canyonCaps??=new Map();
  if(!w.canyonCaps.has(variant)){
    const m=w.mat.top.clone();m.color=w.mat.top.color;m.userData={clayOffset:[variant*1.37,variant*.81,variant*2.03]};
    clayMaterial(w,m,.07);w.assetMaterials.add(m);w.canyonCaps.set(variant,m);
  }return w.canyonCaps.get(variant);
}
function cactus(w,parent,x,y,height=1.8,z=-1.05,turn=0){return canyonModel(w,'cactus',parent,x,y,z,height,turn);}
function fence(w,parent,x,y,count=3){
  for(let i=0;i<count;i++)w.box(.19,.9,.23,'bark',parent,x+i*.85,y+.43,-1,.08);
  w.box((count-1)*.85+.08,.17,.15,'barkLight',parent,x+(count-1)*.425,y+.49,-.93,.06);
}

// Planks across the deck, a head beam along its front edge, posts down to the
// rock and a diagonal brace under each one. Everything hangs below the deck
// top, which stays the collision plane.
function timberDeck(w,s,g){
  const boards=Math.max(2,Math.round(s.w/1.15)),boardW=s.w/boards;
  for(let i=0;i<boards;i++){
    const seed=i*7+Math.floor(s.x);
    const board=w.box(boardW-.07,.3,3.5,i%2?'bark':'barkLight',g,(i+.5)*boardW,-.16,0,.07);
    board.rotation.z=(random(seed)-.5)*.012;board.name='Deck board';
  }
  w.box(s.w+.12,.26,.42,'bark',g,s.w/2,-.42,1.74,.08).name='Deck head beam';
  const posts=Math.max(2,Math.round(s.w/4.5));
  for(let i=0;i<posts;i++){
    const x=.85+i*(s.w-1.7)/Math.max(1,posts-1);
    w.box(.34,3.3,.36,'bark',g,x,-1.95,1.5,.09).name='Deck post';
    const brace=w.box(.24,2.1,.28,'barkLight',g,x+.62,-1.3,1.42,.07);brace.rotation.z=.62;brace.name='Deck brace';
    for(const at of [-.42,.42])w.rope([x+at,-.36,1.72],[x+at*.4,-.78,1.34],g,.045).name='Deck lashing';
  }
  cactus(w,g,s.w-1.5,.02,1.5,-1.1,(random(s.x)-.5)*.3);
}

// The planks' wood is the moving lifts' wood — the same colours under the same
// clay relief — but pitted the way the crumbling ledges are, so a floor that
// is going to give reads as one. Pores are shaded through vertex colour, which
// the lifts' own materials do not carry, hence a pair of the canyon's own.
function plankMaterials(w){
  if(w.mat.plankWood)return;
  const lift=movingPlatformMaterials(w);
  w.assetMaterials??=new Set();
  for(const [name,from] of [['plankWood',lift.wood],['plankGrain',lift.grain]]){
    const m=clayMaterial(w,new THREE.MeshStandardMaterial({color:from.color.getHex(),roughness:.93,metalness:0,vertexColors:true}),.07);
    w.assetMaterials.add(m);w.mat[name]=m;
  }
}
// A span of planks laid across a gap: porous boards in the lifts' wood, a head
// beam along the front, a bearer at either end with the lifts' twisted rope
// lashed round it, and no posts down to rock — this is a floor over a hole,
// and what breaks it comes from above. It sits on whatever carries its ends
// (its bearers reach .7 below the walking plane), not into it.
// A board's outline: a rectangle with bites taken out of its edges — a notch
// or two along the front, one in a side — so the gaps between boards and the
// broken teeth along them read as holes from the side, where the pores alone
// are too fine to.
function bittenBoard(bw,depth,seed){
  // A half-round bite of radius r into an edge, as the points of its arc.
  const bite=(cx,cz,r,along,into)=>Array.from({length:5},(_,k)=>{const a=Math.PI*k/4;return [cx+along[0]*Math.cos(a)*r+into[0]*Math.sin(a)*r,cz+along[1]*Math.cos(a)*r+into[1]*Math.sin(a)*r];});
  // The front edge (z = +depth/2) is walked from +x back to -x, so its bites
  // run the same way; the right side (x = +bw/2) is walked from -z to +z.
  const bites=1+Math.round(random(seed+1)),front=[];
  for(let b=0;b<bites;b++){
    const cx=-bw/2+bw*(bites>1?.28+.44*b:.5)+(random(seed+3+b)-.5)*bw*.14,r=Math.min(bw*.3,.12+random(seed+5+b)*.09);
    front.push(bite(cx,depth/2,r,[1,0],[0,-1]));
  }
  front.sort((p,q)=>q[0][0]-p[0][0]);
  const cz=(random(seed+9)-.5)*depth*.6,side=bite(bw/2,cz,.09+random(seed+11)*.08,[0,-1],[-1,0]);
  return [[-bw/2,-depth/2],[bw/2,-depth/2],...side,[bw/2,depth/2],...front.flat(),[-bw/2,depth/2]];
}
export function plankSpan(w,s,g){
  plankMaterials(w);
  const lift=movingPlatformMaterials(w);
  const boards=Math.max(3,Math.round(s.w/1.05)),boardW=s.w/boards,depth=3.3;
  for(let i=0;i<boards;i++){
    const seed=Math.floor(s.x*7)+i*11,bw=boardW-.24;
    const key=`plank:${bw.toFixed(3)}:${seed}`;
    let geo=cachedClayShape(w,key);
    if(!geo){geo=porousClay(w,bittenBoard(bw,depth,seed),.36,seed,true);geo.computeBoundingSphere();retainClayShape(w,key,geo);}
    const board=w.mesh(geo,i%2?'plankGrain':'plankWood',g,(i+.5)*boardW,-.02,0);
    board.rotation.y=(random(seed)-.5)*.03;board.rotation.z=(random(seed+3)-.5)*.04;board.name='Porous plank';
  }
  w.mesh(clayBox(w,s.w+.1,.24,.4,.08),lift.grain,g,s.w/2,-.4,1.62).name='Plank head beam';
  for(const x of [.55,s.w-.55]){
    w.mesh(clayBox(w,.5,.42,3.4,.09),lift.wood,g,x,-.5,0).name='Plank bearer';
    for(const z of [1.3,-1.3])braid(w,g,x,-.72,.02,z,.55,lift).name='Plank lashing';
  }
}

// A solid wall body in the canyon: the same kneaded sandstone blocks the decks
// stand on, laid in courses to fill exactly the box the simulation walks into,
// so a pillar, an overhang or the rock under a pool of clay reads as the same
// stone as everything else rather than as a slab.
export function buildCanyonWall(w,s,g){
  g.name='Canyon wall '+s.id;
  const height=s.h??4,columns=Math.max(1,Math.ceil(s.w/2.9)),cw=s.w/columns;
  for(let i=0;i<columns;i++){
    const seed=Math.floor(s.x*3)+i*13,rows=[];
    let left=height,first=Math.min(height,2.2+random(seed)*1.1);
    rows.push(first);left-=first;
    while(left>1e-6){const h=Math.min(left,left>4.4?3.2:left);rows.push(h);left-=h;}
    let top=0;
    for(let row=0;row<rows.length;row++){
      const h=rows[row];
      block(w,g,cw+.12,h+.12,3.35+(row%2)*.12,(i+.5)*cw,top-h/2,-.05,(i+row)%4===1?'terrain2':'terrain',seed+row*5);top-=h;
    }
  }
}

export function buildCanyonTerrain(w,s,g){
  g.name='Canyon cliff '+s.id;
  if(s.id==='arch-bridge-left'||s.id==='arch-bridge-right'){
    // The reference banks are slender, continuous fingers of sandstone.
    block(w,g,s.w+.1,10.5,3.42,s.w/2,-5.25,-.06,'terrain',s.x*7);
    return;
  }
  const columns=Math.max(2,Math.ceil(s.w/2.9)),cw=s.w/columns;
  for(let i=0;i<columns;i++){
    const seed=Math.floor(s.x*3)+i*11,split=2.5+random(seed)*1.05;
    const rows=[split,3.2,10.4-split-3.2];let top=-.45;
    for(let row=0;row<rows.length;row++){
      const h=rows[row];block(w,g,cw+.15,h+.2,3.35+(row%2)*.12,(i+.5)*cw,top-h/2,-.05,(i+row)%4===1?'terrain2':'terrain',seed+row*5);top-=h;
    }
  }
  // A timber deck is laid over the sandstone instead of a torn stone cap: a
  // boarded platform on posts, the way the caravan finishes a landing it means
  // to stand on. The collision plane is still the deck top, so the boards sit
  // in the same place the cap would have.
  if(s.timber){
    timberDeck(w,s,g);
    if(s.checkpoint)w.flag(s.checkpoint-s.x,.035,g,.83,s.id);
    if(s.goal)w.makeBell(g,s.bellX??s.w-3.5,.1);
    return;
  }
  // Flat tops still agree with collision; separate cap pieces expose soft,
  // torn edges and irregular rock chips along the front of the cliff.
  const caps=Math.max(1,Math.ceil(s.w/2.5)),capW=s.w/caps;
  for(let i=0;i<caps;i++){
    const material=capMaterial(w,i+s.x);
    w.box(capW+.16,.57,3.63,material,g,(i+.5)*capW,-.29,0,.22);
    for(let j=0;j<3;j++){
      const seed=i*9+j+Math.floor(s.x),x=i*capW+(j+.5)*capW/3;
      const chip=w.box(.42+random(seed)*.3,.19+random(seed+3)*.14,.3,material,g,x,-.39-random(seed+1)*.07,1.68,.115);chip.rotation.z=(random(seed+5)-.5)*.25;
    }
  }
  if(s.w<2.2){
    // Narrow abutments leave room for the bridge posts and their rope wraps.
    if(s.checkpoint)w.flag(s.checkpoint-s.x,.035,g,.83,s.id);
    if(s.goal)w.makeBell(g,s.bellX??s.w-3.5,.1);
    return;
  }
  if(s.id==='start'){
    cactus(w,g,4,.02,2.7,-1.35,.08);fence(w,g,6.3,.01,3);w.flag(8.25,.01,g,.77);
  }else{
    cactus(w,g,s.w-1.2,.02,s.rest?2:1.55,-1.14,(random(s.x)-.5)*.22);
  }
  if(s.id==='last-rest')rock(w,g,s.checkpoint-s.x,.015,-.75,.9,s.x,'top');
  else if(!s.goal)for(let i=0;i<2;i++)rock(w,g,.75+random(s.x+i*4)*(s.w-1.5),.015,-1.0,.55+random(i+s.x)*.8,i+s.x,'top');
  // Fallen rocks give the vertical cliff faces a sense of scale.
  if(s.w>4)rock(w,g,s.w*.22,-4.2,1.9,1.4,s.x);
  if(s.checkpoint)w.flag(s.checkpoint-s.x,.035,g,.83,s.id);
  if(s.goal)w.makeBell(g,s.bellX??s.w-3.5,.1);
}

// Distant clay for the three ranks of buttes. Fog used to carry the whole
// distance by itself: every rank was the playfield's own orange, and the far
// summits sat nine tenths of the way into a cream fog, so they came out as
// flat pale cut-outs — hue, bump shading and the baked flags gone in one mix.
// Sampled from the reference, the buttes brighten to a sunlit peach just
// behind the route, then cool through salmon to a dusty red that the longer,
// lavender fog turns mauve. Each rank is its own clay, so the fog only has to
// add the last of the distance.
//
// The heavy fog had one thing right, though: at nine tenths it took most of
// the far summits' shading and sculpted relief with it, and a distant butte
// that reads as a silhouette is the more distant for it. Half of that comes
// back here without fogging the colour further. `flatten` is the share of the
// lit response handed to a flat emissive floor of the rank's own clay — the
// mean stays, the light-to-shadow contrast shrinks by that share — and
// `relief` scales the baked normal map and the fingerprint bump.
const RANKS={
  low:{clay:0xec8a60,flatten:0,relief:1},
  middle:{clay:0xd96b43,flatten:.22,relief:.7},
  far:{clay:0xc46262,flatten:.55,relief:.25}
};
// The backdrop's lit faces render at about the clay colour and its shadow
// faces at roughly six tenths, so the average light a face sees is ~.85.
const MEAN_LIGHT=.85;
function rankMaterial(w,rank,source){
  const base=typeof source==='string'?w.mat[source]:source;
  if(!w.clay||!base?.isMeshStandardMaterial)return base;
  w.canyonRanks??=new Map();const key=rank+':'+base.uuid;
  if(!w.canyonRanks.has(key)){
    const {clay,flatten,relief}=RANKS[rank],m=base.clone(),pigment=new THREE.Color(clay).multiplyScalar(1-flatten);
    // A clone carries a JSON copy of the clay annotation and no shader hook:
    // keep only the orange source and depth, and let clayMaterial install anew.
    m.userData={clayOrangeSource:base.userData.clayOrangeSource,clayDepth:base.userData.clayDepth};
    if(m.userData.clayOrangeSource)m.userData.clayOrange=pigment;else m.color.copy(pigment);
    m.emissive.setHex(clay);m.emissiveIntensity=flatten*MEAN_LIGHT;
    m.normalScale?.multiplyScalar(relief);
    clayMaterial(w,m,(base.userData.clay?.requestedDepth??.035)*relief);
    w.assetMaterials.add(m);w.canyonRanks.set(key,m);
  }
  return w.canyonRanks.get(key);
}
function butte(w,kind,rank,parent,x,y,z,height,turn){
  const root=canyonModel(w,kind,parent,x,y,z,height,turn);
  root.traverse(o=>{if(o.isMesh)o.material=rankMaterial(w,rank,o.material);});return root;
}

// A field of ivory puffs at three depths. One cloud every sixteen units at a
// single depth put about two on screen at a time, both 96% into the fog, so
// the sky held one large salmon shape. The reference scatters a few white
// puffs of different sizes across the upper frame — four or five in view,
// the largest about as wide as the mill's sails. The camera is orthographic,
// so size never comes from depth — it is authored per rank. The two nearer
// ranks keep their own white — the sky behind them is unfogged too — and lean
// a little toward the sky by tint. The farthest rank stands behind the far
// buttes and takes what they take: the fog (three quarters at its depth) and
// the same flattening, so it reads as haze with a shape rather than a cloud.
// `y` is world height at the rank's depth; the camera's downward tilt lifts a
// plane that deep by ~3 units on screen.
const CLOUD_RANKS=[
  {factor:.06,z:-60,y:[-1.8,2.6],width:[1.35,2.4],spacing:11,tint:0xe2eaf5,fog:true,flatten:.55,relief:.25},
  {factor:.12,z:-52,y:[-1.3,3.0],width:[2.1,3.3],spacing:16,tint:0xf1f5fa},
  {factor:.2,z:-44,y:[-.6,3.4],width:[2.85,4.2],spacing:24,tint:0xffffff}
];
function cloudMaterial(w,rank,source){
  if(!source?.isMeshStandardMaterial)return source;
  w.canyonClouds??=new Map();const key=rank+':'+source.uuid;
  if(!w.canyonClouds.has(key)){
    const {tint,fog=false,flatten=0,relief=1}=CLOUD_RANKS[rank],m=source.clone();m.userData={};
    m.fog=fog;m.color.multiply(new THREE.Color(tint)).multiplyScalar(1-flatten);
    // The cloud's albedo is its baked map, so the floor is the rank's tint.
    m.emissive.setHex(tint);m.emissiveIntensity=flatten*MEAN_LIGHT;m.normalScale?.multiplyScalar(relief);
    clayMaterial(w,m,(source.userData.clay?.requestedDepth??.035)*relief);
    w.assetMaterials??=new Set();w.assetMaterials.add(m);w.canyonClouds.set(key,m);
  }
  return w.canyonClouds.get(key);
}
function cloudField(w,end){
  const anchors=(w.currentLevel?.platforms||[]).filter(s=>s.id==='arch-drop'&&s.kind==='bridge').map(s=>({x:s.x+s.w*.38,y:s.y+.72,scale:4.1/(w.cloudAsset?.width||1)}));
  CLOUD_RANKS.forEach((rank,r)=>{
    const g=group(w.backRoot);g.name='Canyon clouds '+r;
    // The middle rank lends a cloud to the Boulder Drop's authored composition:
    // the nearest unfogged, unflattened rank, so the piece stays a white cloud.
    w.parallax.push({group:g,factor:rank.factor,heightFollow:1,...(r===1?{anchors}:{})});
    // Cover the view from the chapter's first frame to its last: the rank's
    // own travel plus a screen either side, so nothing pops in at the edges.
    const reach=end*rank.factor+14;
    for(let x=-12,i=r*31;x<reach;x+=rank.spacing*(.8+random(i)*.4),i++){
      const y=rank.y[0]+random(i+1)*(rank.y[1]-rank.y[0]),width=rank.width[0]+random(i+2)*(rank.width[1]-rank.width[0]);
      const cloud=cloudModel(w,g,x,y,rank.z,width,(random(i+3)-.5)*.2);
      cloud.traverse(o=>{if(o.isMesh)o.material=cloudMaterial(w,r,o.material);});
    }
  });
}

// Sampled from the reference sky: a touch deeper overhead, paler toward the
// horizon behind the buttes. The stops are screen heights around the eye
// line; the quad rides a layer that follows the camera exactly.
const SKY_STOPS=[[30,0x71a8e3],[5,0x75ade5],[1.5,0x7eb4e7],[-1.5,0x8bbde9],[-5,0x98c6ec],[-30,0xa0caed]];

export function buildCanyonBackdrop(w){
  const sky=group(w.backRoot);sky.name='Canyon sky';w.parallax.push({group:sky,factor:0,heightFollow:1});
  skyGradient(w,sky,SKY_STOPS,{name:'Canyon sky gradient'});
  const far=group(w.backRoot),middle=group(w.backRoot),low=group(w.backRoot);
  w.parallax.push({group:far,factor:.17,heightFollow:1},{group:middle,factor:.36,heightFollow:1},{group:low,factor:.62,heightFollow:1});
  for(let i=-2;i<10;i++){
    const x=i*16;
    butte(w,'summit','far',far,x+5,-3.7,-53,3.2+random(i+3)*1.2,(random(i+9)-.5)*.3);
    if(i%3===0)butte(w,'arch','far',far,x-1,-3.6,-49,3.8+random(i)*.8,.28);
  }
  for(let i=-2;i<8;i++){
    const x=i*24;
    // Broad openings alternate with eroded stacks. The skyline has breathing
    // room instead of repeating the same arch / flag pair in every view.
    const arch=i%2===0?butte(w,'arch','middle',middle,x-1.4,-3.5,-34,5.0+random(i)*1.4,-.3+random(i+2)*.6):null;
    butte(w,'summit','middle',middle,x+9,-4.8,-30,4.5+random(i+4)*2.8,-.42+random(i+6)*.84);
    if(!arch){
      for(let j=0;j<3;j++){
        const h=3.1+random(i*9+j)*3.5;
        block(w,middle,2.2-j*.35,h,3,x-4+j*2.05,-3.8-h/2,-27,rankMaterial(w,'middle','back2'),i*13+j);
      }
    }
  }
  for(let i=-2;i<14;i++){
    const x=i*11.5,h=3.8+random(i+7)*2.1,width=3.4+random(i+5)*2.4;
    block(w,low,width,h,3.2,x,-6.5-h/2,-17,rankMaterial(w,'low','back2'),i*13);
    w.box(width+.16,.47,3.4,rankMaterial(w,'low','back'),low,x,-6.5,-17,.2);
    if(i%3===0)butte(w,'summit','low',low,x,-7.1,-21,4.3,.1);
  }
  cloudField(w,w.currentLevel?.end??354);
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}

export function makeCanyonLift(w,s,g){
  return makeMovingPlatform(w,s,g,{ceiling:archLiftCeiling(w,s)});
}

// --- the summit ropeway --------------------------------------------------------
// A trolley on a braided cable strung between two raked timber masts. The deck
// group the streamer hands us is moved to the trolley every frame, so anything
// that must stand still in the world — both masts and the cable between them —
// hangs off a span group that is counter-translated back, the way the ferry
// keeps its rail still while its deck slides (cavern-machine-views.js).
//
// The cable is the rope lift's own rope, laid along the span instead of hung
// from a ceiling: `braid` from moving-platform.js, two twisted honey strands,
// and nothing else off that assembly — no eyes, knots, studs or medallions,
// which belong to a deck that hangs rather than a cable that carries. A
// ropeway's rope is a heavier lay than a lift's, so it is built at half again
// the scale; that is the only difference between this rope and that one.
function cable(w,parent,from,to,k=1.5){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),dir=b.clone().sub(a),length=dir.length();
  const g=new THREE.Group();g.name='Ropeway cable';g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(g);
  const rope=braid(w,g,0,0,length,0,k,movingPlatformMaterials(w));
  // A hair-thin caster sixty units long is all cost and artefact.
  rope.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return g;
}

// One mast: two raked legs under a lashed head, with the sheave the cable runs
// over. `turn` faces it down the cable or back up it.
function mast(w,parent,x,y,z,turn){
  const g=new THREE.Group();g.name='Ropeway mast';g.position.set(x,y,z);g.rotation.y=turn;parent.add(g);
  for(const lean of [-.26,.2]){
    const leg=w.box(.3,3.4,.3,'bark',g,Math.sin(lean)*1.5,-1.7,Math.cos(lean)*.12-.12,.09);
    leg.rotation.z=lean;leg.name='Raked mast leg';
  }
  const brace=w.box(2.2,.22,.26,'barkLight',g,0,-1.15,0,.08);brace.rotation.z=.07;brace.name='Mast cross brace';
  w.box(1.5,.3,.42,'bark',g,0,.05,0,.1).name='Lashed mast head';
  for(const at of [-.5,.5])w.rope([at,.22,.24],[at,-.12,-.24],g,.05).name='Mast head lashing';
  // The wheel faces the camera, as a wheel in a side-view does; turned on its
  // axis it reads as a stick.
  w.mesh(new THREE.TorusGeometry(.3,.1,9,20),'accent',g,.62,.02,.1).name='Ropeway sheave';
  w.ball(.1,.1,.11,'gold',g,.62,.02,.2).name='Sheave hub';
  return g;
}

export function makeCanyonZip(w,s,g){
  g.name='Summit ropeway';
  const view={root:g},travel=s.travel??24,drop=s.drop??8;
  // Local coordinates: the deck group sits at the trolley, and the span group
  // is pushed back to the near mast every frame by animateCanyonZip.
  const span=new THREE.Group();span.name='Ropeway span';g.add(span);
  const head=2.15;                                   // how far the cable rides above the deck line
  mast(w,span,0,head,-.3,0);
  mast(w,span,travel,head-drop,-.3,Math.PI);
  cable(w,span,[.62,head+.02,-.2],[travel-.62,head-drop+.02,-.2]);
  // The trolley itself rides with the deck, so it stays at the group origin.
  const trolley=new THREE.Group();trolley.name='Ropeway trolley';g.add(trolley);
  const deck=w.box(s.w,.34,1.5,'bark',trolley,s.w/2,-.17,0,.1);deck.name='Trolley deck';
  w.box(s.w-.5,.1,1.15,'barkLight',trolley,s.w/2,-.02,0,.05).name='Trolley deck boards';
  for(const at of [.45,s.w-.45])w.rope([at,-.02,.1],[s.w/2,head-.56,-.16],trolley,.055).name='Trolley hanger';
  const yoke=w.box(.26,.46,.3,'barkLight',trolley,s.w/2,head-.74,-.16,.08);yoke.name='Trolley yoke';
  // The groove sits on the cable, so the wheel hangs a radius below it.
  const sheave=w.mesh(new THREE.TorusGeometry(.34,.11,10,22),'accent',trolley,s.w/2,head-.3,-.2);
  sheave.name='Trolley sheave';
  w.ball(.11,.11,.12,'gold',trolley,s.w/2,head-.3,-.09).name='Trolley sheave hub';
  view.span=span;view.sheave=sheave;view.sheaveRadius=.34;
  return view;
}

// The masts and their cable belong to the world, not to the deck that carries
// them, and the sheave turns with the distance run.
export function animateCanyonZip(w,s,view){
  if(!view?.span)return;
  // Against the deck group's drawn position, not the simulated one: the frame
  // draws the trolley between ticks (world.js), and the masts and cable must be
  // pushed back by exactly what the deck was moved by, or the cable trembles
  // against the world the trolley is running through.
  const {x,y}=view.root.position;
  view.span.position.set(s.baseX-x,s.baseY-y,0);
  view.sheave.rotation.z=-(x-s.baseX)/view.sheaveRadius;
}
