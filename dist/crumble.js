import * as THREE from './lib/three.module.js';
import {sculptClay} from './clay.js';

const random=n=>{const x=Math.sin(n*127.13+73.41)*43758.5453;return x-Math.floor(x);};
const clamp=n=>Math.max(0,Math.min(1,n));
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
export function createCrumble(w,s,root){
  root.name='Fractured clay platform';
  const pieces=[],seed=s.x*3+s.y*11;
  for(const [layer,rows,depth,top,mat]of [[0,2,.39,0,w.biome==='forest'?'barkLight':'top'],[1,1,.26,-.43,'terrain']]){
    for(const [i,poly]of cells(s.w,rows,seed+layer*41).entries()){
      const cx=poly.reduce((a,b)=>a+b[0],0)/poly.length,cz=poly.reduce((a,b)=>a+b[1],0)/poly.length;
      const shape=new THREE.Shape();
      const outline=[];
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
      // Shallow relief retains the broad, level contact surface and deep gaps.
      const mesh=w.mesh(sculptClay(w,geo,{amplitude:.013,subdivide:true}),mat,root,cx,top,cz);
      mesh.name=layer?'Broken lower clay layer':'Cracked golden cap';
      pieces.push({mesh,rest:mesh.position.clone(),seed:i+layer*37,layer});
    }
  }
  // Loose grains wedged along the exposed seam make fragility readable at rest.
  for(let i=0;i<Math.ceil(s.w*3);i++){
    const x=.15+random(seed+i*7)*(s.w-.3),r=.025+random(seed+i*13)*.045;
    const mesh=w.mesh(fragmentGeometry(w),w.biome==='forest'?'barkLight':'top',root,x,-.42-r*.3,.86);mesh.scale.set(r*1.2,r*.9,r*.8);
    pieces.push({mesh,rest:mesh.position.clone(),seed:60+i,grain:true});
  }
  return {pieces,crumbClock:0};
}
function fragmentGeometry(w){
  if(!w.fragmentGeometry){
    w.fragmentGeometry=sculptClay(w,new THREE.IcosahedronGeometry(1,1),{amplitude:.04});
    w.assetGeometry.add(w.fragmentGeometry);
  }
  return w.fragmentGeometry;
}
export function clayFragments(w,x,y,width,count=18,power=1){
  count=Math.max(0,Math.min(w.reducedMotion?Math.min(7,count):count,110-w.particles.length));
  fragmentGeometry(w);
  for(let i=0;i<count;i++){
    const mesh=w.mesh(w.fragmentGeometry,i%3?'top':'terrain',w.fxRoot,x+(Math.random()-.5)*width,y-.15,.5+Math.random()*.45);
    const r=.035+Math.random()*.08;mesh.scale.set(r*1.3,r*.75,r);mesh.castShadow=false;mesh.receiveShadow=false;
    w.particles.push({kind:'clay-chip',mesh,vx:(Math.random()-.5)*3.4*power,vy:(Math.random()*2.1-.7)*power,vz:(Math.random()-.35)*1.6,spinX:Math.random()*8-4,spinZ:Math.random()*10-5,life:.65+Math.random()*.45});
  }
}
export function animateCrumble(w,view,s,dt){
  const fracture=view.fracture;if(!fracture)return;
  const delay=s.delay||.62,progress=s.active?clamp(s.timer/delay):1,age=Math.max(0,s.timer-delay);
  view.root.visible=!s.broken&&(s.active||age<.85);
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
    if(fracture.crumbClock<=0){fracture.crumbClock=.10;clayFragments(w,s.x+s.w/2,s.y-.18,s.w,w.reducedMotion?1:3,.28);}
  }else fracture.crumbClock=0;
}
