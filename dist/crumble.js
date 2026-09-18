import * as THREE from './lib/three.module.js';
import {sculptClay,clayShape} from './clay.js';
import {porousClay} from './porous-clay.js';
import {biteSeed,biteOutline,biteBounds,insideBite} from './rot-shape.js';

const random=n=>{const x=Math.sin(n*127.13+73.41)*43758.5453;return x-Math.floor(x);};
const clamp=n=>Math.max(0,Math.min(1,n));
const CRUMBLE_GREY=0x606063;
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
export function createCrumble(w,s,root){
  root.name='Porous grey crumbling ledge';crumbleMaterials(w);
  const pieces=[],seed=s.x*3+s.y*11;
  for(const [layer,rows,depth,top,mat]of [[0,2,.39,0,'crumbleGrey'],[1,1,.30,-.43,'crumbleLower']]){
    for(const [i,poly]of cells(s.w,rows,seed+layer*41).entries()){
      const cx=poly.reduce((a,b)=>a+b[0],0)/poly.length,cz=poly.reduce((a,b)=>a+b[1],0)/poly.length;
      const outline=poly.map(([x,z])=>{
        const length=Math.hypot(x-cx,z-cz),factor=1-Math.min(.06,length*.16)/length;
        return [(x-cx)*factor,(z-cz)*factor];
      });
      // Each fragment's pores are seeded from the deck's own position, so the
      // same deck rebuilds to the same stone every time it streams back in.
      const geo=clayShape(w,`crumble:${seed.toFixed(3)}:${layer}:${i}`,()=>porousClay(w,outline,depth,seed+i*137+layer*51,layer===1));
      const mesh=w.mesh(geo,mat,root,cx,top,cz);
      mesh.name=layer?'Porous broken grey underside':'Pitted grey clay cap';
      pieces.push({mesh,rest:mesh.position.clone(),seed:i+layer*37,layer});
    }
  }
  // Loose grey grains sit in the seam, then fall with their parent fragments.
  for(let i=0;i<Math.ceil(s.w*3);i++){
    const x=.15+random(seed+i*7)*(s.w-.3),r=.025+random(seed+i*13)*.045;
    const mesh=w.mesh(fragmentGeometry(w),'crumbleChip',root,x,-.42-r*.3,.86);mesh.scale.set(r*1.2,r*.9,r*.8);
    pieces.push({mesh,rest:mesh.position.clone(),seed:60+i,grain:true});
  }
  return {pieces,crumbClock:0};
}

// --- a rotten corner --------------------------------------------------------------
// A bench corner rotted through: the bite `rot-shape.js` describes, filled with
// rot — dark clay gone to pieces already, fractured across its face so the
// seams are its cracks, pitted, flecked, and standing on a darker backing so
// the cracks read black rather than sky. It falls the way a crumbling ledge
// does: every fragment is a piece for animateCrumble, holder and all.
const ROT_CLAY=0x4b423e,ROT_DARK=0x2d2826,ROT_DEPTH=3;
export function rotMaterials(w){
  for(const [name,color,vertexColors]of [['rotClay',ROT_CLAY,true],['rotDark',0x3a322f,true],['rotBack',ROT_DARK,false],['rotChip',0x3b3330,false]]){
    const material=w.mat[name]??=new THREE.MeshStandardMaterial();
    material.color.setHex(color);material.roughness=.97;material.metalness=0;material.vertexColors=vertexColors;
  }
}
export function createRot(w,s,root){
  root.name='Rotten corner';rotMaterials(w);
  const seed=biteSeed(s),outline=biteOutline(s.w,s.h,seed),{left,right,top,bottom}=biteBounds(outline),pieces=[];
  // Voronoi cells over the bite's box, in the plane of the bench's face, kept
  // where their middle lies inside the bite. A cell that straddles the ragged
  // wall runs on into the bench, where the bench hides it.
  const cols=Math.max(3,Math.round((right-left)/1.05)),rows=Math.max(2,Math.round((top-bottom)/.9)),sites=[];
  for(let r=0;r<rows;r++){const n=cols-(r%2);for(let c=0;c<n;c++)sites.push([left+(c+.5+(random(seed+c*3+r*11)-.5)*.6)*(right-left)/n,bottom+(r+.5+(random(seed+c*5+r*17)-.5)*.5)*(top-bottom)/rows]);}
  for(const [i,a]of sites.entries()){
    let poly=[[left,bottom],[right,bottom],[right,top],[left,top]];
    for(const b of sites)if(b!==a)poly=clip(poly,b[0]-a[0],b[1]-a[1],(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2);
    if(poly.length<3)continue;
    const cx=poly.reduce((q,p)=>q+p[0],0)/poly.length,cy=poly.reduce((q,p)=>q+p[1],0)/poly.length;
    if(!insideBite(outline,cx,cy))continue;
    // Drawn in about its middle: the seams between fragments are the cracks.
    // porousClay builds a slab lying flat with its pitted face up; laid on its
    // side (x, z) becomes (x, y), and the pits face the front.
    const local=poly.map(([x,y])=>{const len=Math.hypot(x-cx,y-cy)||1,f=1-Math.min(.075,len*.15)/len;return [(x-cx)*f,-(y-cy)*f];});
    const geo=clayShape(w,`rot:${seed}:${i}`,()=>porousClay(w,local,ROT_DEPTH,seed+i*137,random(seed+i)>.55));
    const holder=new THREE.Group();holder.position.set(cx,cy,0);root.add(holder);
    const mesh=w.mesh(geo,random(seed+i*7)>.4?'rotClay':'rotDark',holder,0,0,ROT_DEPTH/2);mesh.rotation.x=Math.PI/2;
    mesh.name='Rotten clay';
    // A fleck or two of black on the face.
    for(let k=0;k<2;k++)if(random(seed+i*13+k)>.45){
      const fx=(random(seed+i*17+k)-.5)*.5,fy=(random(seed+i*19+k)-.5)*.5,r=.05+random(seed+i*23+k)*.06;
      const fleck=w.ball(r,r*.85,r*.4,'rotBack',holder,fx,fy,ROT_DEPTH/2+.01);fleck.castShadow=false;
    }
    pieces.push({mesh:holder,rest:holder.position.clone(),seed:i,layer:0});
  }
  // The backing: the whole bite, a hand behind the fragments.
  const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
  const back=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false}),'rotBack',root,0,0,-ROT_DEPTH/2-.3);
  back.name='Rot backing';back.castShadow=false;
  pieces.push({mesh:back,rest:back.position.clone(),seed:97,layer:1});
  return {pieces,crumbClock:0};
}
// The bench column the bite is eaten from, drawn as one piece with the bite's
// ragged wall taken out of its face, under the bench's own orange cap. `rot` is
// the rotten deck whose bite it wears; the corner's collision is the plain
// stone deck it always was, so only the face is carved.
export function createCarvedCorner(w,s,rot,root){
  root.name='Bench corner, rotted through';
  const W=s.w,H=12,D=3.32,seed=biteSeed(rot),outline=biteOutline(rot.w,rot.h,seed),dx=rot.x-s.x;
  // The bite's left wall, top to floor: the outline runs top, open side, floor,
  // then up the wall, so the wall is what follows the floor's last point.
  const floorEnd=outline.findIndex(([x,y])=>x===0&&y===-rot.h);
  const wall=outline.slice(floorEnd+1).reverse();
  const points=[[0,0],[dx,0],...wall.map(([x,y])=>[dx+x,y]),[dx,-rot.h],[dx,-H],[0,-H]];
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const body=w.mesh(new THREE.ExtrudeGeometry(shape,{depth:D-.12,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2}),'terrain',root,0,0,-(D-.12)/2);
  body.name='Carved bench corner';
  w.box(W+.12,.55,3.51,'top',root,W/2,-.22,0,.19);
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
// board are bigger than chips off a ledge.
export function clayFragments(w,x,y,width,count=18,power=1,porous=false,{material=null,size=1}={}){
  count=Math.max(0,Math.min(w.reducedMotion?Math.min(7,count):count,110-w.particles.length));
  fragmentGeometry(w);if(porous)crumbleMaterials(w);
  for(let i=0;i<count;i++){
    const mesh=w.mesh(w.fragmentGeometry,material??(porous?'crumbleChip':i%3?'top':'terrain'),w.fxRoot,x+(Math.random()-.5)*width,y-.15,.5+Math.random()*.45);
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
