import * as THREE from './lib/three.module.js';
import {sculptClay,clayShape} from './clay.js';
import {porousClay} from './porous-clay.js';
import {biteSeed,biteOutline,biteBounds,insideBite} from './rot-shape.js';
import {caveCap} from './cavern.js';

const random=n=>{const x=Math.sin(n*127.13+73.41)*43758.5453;return x-Math.floor(x);};
const clamp=n=>Math.max(0,Math.min(1,n));
const CRUMBLE_GREY=0x606063;
// Which crumbling ledge a theme builds. The canyon's are fractured sculpted
// clay in the chapter's own colours — a cracked golden cap over a broken lower
// layer — so the first chapter reads as one material; the grey porous stone,
// the blight's own (mother-puff-environment.js), arrives with the chapters
// after it. Everything else here is shared: the cells, the seam grains, the
// fall.
const clayCrumble=w=>w.theme?.crumble==='clay';
function clip(poly,nx,nz,k){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*nz-k,db=b[0]*nx+b[1]*nz-k;
    if(da<=0)out.push(a);
    if((da<0)!==(db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}
function cells(width,rows,seed){
  const cols=Math.max(2,Math.min(8,Math.ceil(width/1.2))),sites=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols-r%2;c++)sites.push([(c+.5+(random(seed+c*3+r*11)-.5)*.65)*width/(cols-r%2),-.88+(r+.5+(random(seed+c*5+r*17)-.5)*.50)*1.76/rows]);
  return sites.map(a=>{
    let poly=[[0,-.88],[width,-.88],[width,.88],[0,.88]];
    for(const b of sites)if(b!==a)poly=clip(poly,b[0]-a[0],b[1]-a[1],(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2);
    return poly;
  });
}
export function crumbleMaterials(w){
  // Independent of biome palettes, including after a chapter switch.
  for(const [name,color]of [['crumbleGrey',CRUMBLE_GREY],['crumbleLower',0x525254],['crumbleChip',CRUMBLE_GREY]]){
    const material=w.mat[name]??=new THREE.MeshStandardMaterial();
    material.color.setHex(color);material.roughness=.98;material.metalness=0;material.vertexColors=name!=='crumbleChip';
  }
}
// One porous stone cell: the Voronoi outline drawn in a touch, pored and
// shaded by porous-clay.js.
function porousCell(w,poly,cx,cz,depth,seed,lower){
  const outline=poly.map(([x,z])=>{
    const length=Math.hypot(x-cx,z-cz),factor=1-Math.min(.06,length*.16)/length;
    return [(x-cx)*factor,(z-cz)*factor];
  });
  return porousClay(w,outline,depth,seed,lower);
}
// One fractured clay cell: the same outline wobbled and inset, extruded with a
// soft bevel, and sculpted shallow so the deck keeps its broad, level contact
// surface and the deep gaps between the pieces.
function clayCell(w,poly,cx,cz,depth){
  const shape=new THREE.Shape(),outline=[];
  for(let j=0;j<poly.length;j++){
    const a=poly[j],b=poly[(j+1)%poly.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.4));
    for(let n=0;n<steps;n++){
      let x=a[0]+(b[0]-a[0])*n/steps,z=a[1]+(b[1]-a[1])*n/steps;
      const px=x;x+=Math.sin(x*6.8+z*4.1)*.028;z+=Math.sin(px*5.2-z*3.3)*.045;
      const length=Math.hypot(x-cx,z-cz),inset=Math.min(.12,length*.22),factor=1-inset/length;
      outline.push([(x-cx)*factor,(z-cz)*factor]);
    }
  }
  outline.forEach(([x,z],j)=>j?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:depth-.16,steps:1,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:4});
  geo.rotateX(Math.PI/2);geo.translate(0,-.08,0);
  const sculpted=sculptClay(w,geo,{amplitude:.013,subdivide:true});
  if(sculpted!==geo)geo.dispose();
  return sculpted;
}
export function createCrumble(w,s,root){
  // The grey slots are made whatever the theme: the blight borrows them.
  const clay=clayCrumble(w);crumbleMaterials(w);
  root.name=clay?'Fractured clay platform':'Porous grey crumbling ledge';
  const pieces=[],seed=s.x*3+s.y*11;
  const layers=clay?[[0,2,.39,0,'top'],[1,1,.26,-.43,'terrain']]:[[0,2,.39,0,'crumbleGrey'],[1,1,.30,-.43,'crumbleLower']];
  for(const [layer,rows,depth,top,mat]of layers){
    for(const [i,poly]of cells(s.w,rows,seed+layer*41).entries()){
      const cx=poly.reduce((a,b)=>a+b[0],0)/poly.length,cz=poly.reduce((a,b)=>a+b[1],0)/poly.length;
      // Each fragment is seeded from the deck's own position, so the same deck
      // rebuilds to the same stone every time it streams back in. The clay
      // key carries the width too: the cache outlives a chapter, and a deck
      // in the next one may share a seed with a wider or narrower deck here.
      const geo=clay?clayShape(w,`crumble-clay:${seed.toFixed(3)}:${s.w}:${layer}:${i}`,()=>clayCell(w,poly,cx,cz,depth))
        :clayShape(w,`crumble:${seed.toFixed(3)}:${layer}:${i}`,()=>porousCell(w,poly,cx,cz,depth,seed+i*137+layer*51,layer===1));
      const mesh=w.mesh(geo,mat,root,cx,top,cz);
      mesh.name=clay?(layer?'Broken lower clay layer':'Cracked golden cap'):(layer?'Porous broken grey underside':'Pitted grey clay cap');
      pieces.push({mesh,rest:mesh.position.clone(),seed:i+layer*37,layer});
    }
  }
  // Loose grains sit in the seam, then fall with their parent fragments.
  for(let i=0;i<Math.ceil(s.w*3);i++){
    const x=.15+random(seed+i*7)*(s.w-.3),r=.025+random(seed+i*13)*.045;
    const mesh=w.mesh(fragmentGeometry(w),clay?'top':'crumbleChip',root,x,-.42-r*.3,.86);mesh.scale.set(r*1.2,r*.9,r*.8);
    pieces.push({mesh,rest:mesh.position.clone(),seed:60+i,grain:true});
  }
  return {pieces,crumbClock:0};
}

// --- a rotten corner --------------------------------------------------------------
// A bench corner rotted through: the bite `rot-shape.js` describes, filled with
// rot — one slab of dead clay, pitted like pumice with craters large and small,
// grains of it clinging along its top and its open side, warm grey-brown where
// the bench is blue. It is whole until it goes; then it falls as fragments,
// which are built with it and shown only for the fall. Every piece is a piece
// for animateCrumble, holder and all.
const ROT_CLAY=0x776a61,ROT_DEPTH=3;
export function rotMaterials(w){
  for(const [name,color,vertexColors]of [['rotClay',ROT_CLAY,true],['rotShard',0x655953,true],['rotGrain',0x7d7067,false],['rotChip',0x6b5f57,false]]){
    const material=w.mat[name]??=new THREE.MeshStandardMaterial();
    material.color.setHex(color);material.roughness=.97;material.metalness=0;material.vertexColors=vertexColors;
  }
}
// porousClay builds a slab lying flat with its pitted face up; laid on its
// side, (x, z) becomes (x, y) and the pits face the front. The holder keeps
// that turn, since animateCrumble writes the piece's own rotation each frame.
function rotSlab(w,geo,mat,root,cx,cy){
  const holder=new THREE.Group();holder.position.set(cx,cy,0);root.add(holder);
  const mesh=w.mesh(geo,mat,holder,0,0,ROT_DEPTH/2);mesh.rotation.x=Math.PI/2;
  return {holder,mesh};
}
export function createRot(w,s,root){
  root.name='Rotten corner';rotMaterials(w);
  const seed=biteSeed(s),outline=biteOutline(s.w,s.h,seed),{left,right,top,bottom}=biteBounds(outline),pieces=[];
  // The slab: the whole bite, pitted deep.
  const cx=(left+right)/2,cy=(top+bottom)/2;
  const whole=clayShape(w,`rot-slab:${seed}:${s.w}:${s.h}`,()=>porousClay(w,outline.map(([x,y])=>[x-cx,-(y-cy)]),ROT_DEPTH,seed,false,{count:54,scale:2.7,bold:.5,concave:true}));
  const slab=rotSlab(w,whole,'rotClay',root,cx,cy);slab.mesh.name='Rotten clay';
  pieces.push({mesh:slab.holder,rest:slab.holder.position.clone(),seed:0,layer:0,whole:true});
  // Grains of rot cling along the top and the open side, and fall with it.
  for(let i=0;i<18;i++){
    const onTop=i<11,r=.07+random(seed+i*13)*.09;
    const x=onTop?left+.25+random(seed+i*7)*(right-left-.45):right-r*.3,y=onTop?top-r*.25:bottom+.3+random(seed+i*11)*(top-bottom-.6);
    const z=(random(seed+i*17)-.5)*(ROT_DEPTH-.6);
    const grain=w.mesh(fragmentGeometry(w),'rotGrain',root,x,y,z);grain.scale.set(r*1.2,r*.9,r*1.05);grain.castShadow=false;
    pieces.push({mesh:grain,rest:grain.position.clone(),seed:60+i,grain:true});
  }
  // The fragments it falls as: Voronoi cells over the bite's box, in the plane
  // of the bench's face, kept where their middle lies inside the bite.
  const cols=Math.max(3,Math.round((right-left)/1.05)),rows=Math.max(2,Math.round((top-bottom)/.9)),sites=[];
  for(let r=0;r<rows;r++){const n=cols-(r%2);for(let c=0;c<n;c++)sites.push([left+(c+.5+(random(seed+c*3+r*11)-.5)*.6)*(right-left)/n,bottom+(r+.5+(random(seed+c*5+r*17)-.5)*.5)*(top-bottom)/rows]);}
  for(const [i,a]of sites.entries()){
    let poly=[[left,bottom],[right,bottom],[right,top],[left,top]];
    for(const b of sites)if(b!==a)poly=clip(poly,b[0]-a[0],b[1]-a[1],(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2);
    if(poly.length<3)continue;
    const px=poly.reduce((q,p)=>q+p[0],0)/poly.length,py=poly.reduce((q,p)=>q+p[1],0)/poly.length;
    if(!insideBite(outline,px,py))continue;
    const local=poly.map(([x,y])=>{const len=Math.hypot(x-px,y-py)||1,f=1-Math.min(.06,len*.12)/len;return [(x-px)*f,-(y-py)*f];});
    const geo=clayShape(w,`rot-shard:${seed}:${i}`,()=>porousClay(w,local,ROT_DEPTH-.2,seed+i*137,random(seed+i)>.5));
    const shard=rotSlab(w,geo,random(seed+i*7)>.5?'rotClay':'rotShard',root,px,py);shard.mesh.name='Rotten clay, fallen';
    shard.holder.visible=false;
    pieces.push({mesh:shard.holder,rest:shard.holder.position.clone(),seed:i+1,layer:0,shard:true});
  }
  return {pieces,crumbClock:0};
}
// The bench column the bite is eaten from, drawn as one piece with the bite's
// ragged wall taken out of its face, under the bench's own orange cap. `rot` is
// the rotten deck whose bite it wears; the corner's collision is the plain
// stone deck it always was, so only the face is carved.
//
// In the cave the corner is the cave's own deck (environments.js buildTerrain):
// the dark clay, a pressed plate for a cap, and the darker course standing
// proud under the lip — cut short where the bite's teeth eat the face, so it
// runs up to the rot and stops, and the mend (shaping-views.js) carries it on.
export function createCarvedCorner(w,s,rot,root){
  root.name='Bench corner, rotted through';
  const W=s.w,H=12,D=3.32,seed=biteSeed(rot),outline=biteOutline(rot.w,rot.h,seed),dx=rot.x-s.x,cave=w.biome==='cave';
  // The bite's left wall, top to floor: the outline runs top, open side, floor,
  // then up the wall, so the wall is what follows the floor's last point.
  const floorEnd=outline.findIndex(([x,y])=>x===0&&y===-rot.h);
  // The cave's pressed plate is dented, so a body flush with the walk line
  // would show through its hollows: there the body starts inside the plate.
  const top=cave?-CAVE_SINK:0,wall=outline.slice(floorEnd+1).reverse().filter(([,y])=>y<top);
  const points=[[0,top],[dx,top],...wall.map(([x,y])=>[dx+x,y]),[dx,-rot.h],[dx,-H],[0,-H]];
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const body=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:D-.12,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2}),cave?'terrain2':'terrain',root,0,0,-(D-.12)/2);
  body.name='Carved bench corner';
  if(!cave){w.box(W+.12,.55,3.51,'top',root,W/2,-.22,0,.19);return;}
  caveCap(w,root,W+.14,.49,3.6,W/2,-.18,0,s.x);
  const end=dx+biteLipReach(outline);
  w.box(end+.18,.36,3.7,'terrain2',root,(end-.18)/2,-.6,0,.16);
}
// How far under the walk line the cave's carved body and its mend start, so
// the plate's thumb-hollows never show them.
export const CAVE_SINK=.2;
// How far left of the bite's own x its teeth reach at the height of the cave
// deck's proud course, so that course can stop short of them.
export function biteLipReach(outline){
  let reach=0;
  for(const [x,y] of outline)if(y<-.3&&y>-.9)reach=Math.min(reach,x);
  return reach-.04;
}
function fragmentGeometry(w){
  if(!w.fragmentGeometry){
    w.fragmentGeometry=sculptClay(w,new THREE.IcosahedronGeometry(1,1),{amplitude:.04});
    w.assetGeometry.add(w.fragmentGeometry);
  }
  return w.fragmentGeometry;
}
// `material` names the chips' clay where it is not the deck's own — the wood
// of a plank floor going through — and `size` scales them: splinters of a
// board are bigger than chips off a ledge. `porous` asks for a crumbling
// ledge's chips, which are grey stone only where the ledge is.
export function clayFragments(w,x,y,width,count=18,power=1,porous=false,{material=null,size=1}={}){
  count=Math.max(0,Math.min(w.reducedMotion?Math.min(7,count):count,110-w.particles.length));
  const grey=porous&&!clayCrumble(w);
  fragmentGeometry(w);if(grey)crumbleMaterials(w);
  for(let i=0;i<count;i++){
    const mesh=w.mesh(w.fragmentGeometry,material??(grey?'crumbleChip':i%3?'top':'terrain'),w.fxRoot,x+(Math.random()-.5)*width,y-.15,.5+Math.random()*.45);
    const r=(.035+Math.random()*.08)*size;mesh.scale.set(r*1.3,r*.75,r);mesh.castShadow=false;mesh.receiveShadow=false;
    w.particles.push({kind:'clay-chip',mesh,vx:(Math.random()-.5)*3.4*power,vy:(Math.random()*2.1-.7)*power,vz:(Math.random()-.35)*1.6,spinX:Math.random()*8-4,spinZ:Math.random()*10-5,life:(.65+Math.random()*.45)*Math.sqrt(size)});
  }
}
export function animateCrumble(w,view,s,dt){
  const fracture=view.fracture;if(!fracture)return;
  const delay=s.delay||.62,progress=s.active?clamp(s.timer/delay):1,age=Math.max(0,s.timer-delay);
  // A rotten deck is broken the moment it goes, and its pieces still fall.
  view.root.visible=(!s.broken||!!s.rot)&&(s.active||age<.85);
  // An untouched deck holds every fragment at its rest pose. Once the pieces
  // are there, rewriting the same transforms each frame changes nothing.
  const settled=s.active&&progress<=0;
  if(settled&&fracture.settled)return;
  fracture.settled=settled;
  for(const part of fracture.pieces){
    const {mesh,rest,seed}=part;mesh.position.copy(rest);mesh.rotation.set(0,0,0);
    // A rotten slab is whole until it goes, and its shards only ever fall.
    if(part.whole)mesh.visible=!!s.active;else if(part.shard)mesh.visible=!s.active;
    if(!s.active){
      const fall=Math.max(0,age-random(seed)*.11),dx=rest.x-s.w/2;
      mesh.position.x+=dx*fall*.42;mesh.position.y-=fall*fall*(part.grain?13:8.5);
      mesh.position.z+=(random(seed+6)-.5)*fall*1.7;
      mesh.rotation.set(fall*(random(seed+2)-.5)*2,fall*(random(seed+5)-.5),fall*(random(seed+4)-.5)*2.3);
    }else if(progress>0){
      mesh.position.x+=(rest.x-s.w/2)*progress*.025;
      mesh.position.y-=progress*progress*random(seed)*.045;
      if(!w.reducedMotion)mesh.rotation.z=Math.sin(s.timer*57+seed)*.012*progress;
    }
  }
  if(s.active&&s.timer>0&&dt>0){
    fracture.crumbClock-=dt;
    if(fracture.crumbClock<=0){fracture.crumbClock=.10;clayFragments(w,s.x+s.w/2,s.rot?s.y-(s.h||1)*.5:s.y-.18,s.w,w.reducedMotion?1:3,.28,true,s.rot?{material:'rotChip'}:{});}
  }else fracture.crumbClock=0;
}
