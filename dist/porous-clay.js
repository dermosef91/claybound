import * as THREE from './lib/three.module.js';
import {sculptClay} from './clay.js';

const random=n=>{const x=Math.sin(n*127.13+73.41)*43758.5453;return x-Math.floor(x);};
const insidePolygon=(outline,x,y)=>{
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const [xi,yi]=outline[i],[xj,yj]=outline[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
};
const segmentDistance=(a,b,x,y)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy||1e-9,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len2));
  return Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t));
};

// Actual recessed cavities, including their walls and shaded interiors. Each
// fragment remains one mesh so pores add no draw calls during collapse.
// The options ask the top face for more pores (count) and bigger ones (a size
// factor): a whole slab of rotten clay is pitted like pumice, a ledge only
// flecked. The crater share is how many of them are craters rather than
// pinpricks. A concave outline — one with teeth — keeps pores everywhere
// inside it: the margin is then read from the edge itself, not its whole line.
export function porousClay(w,polygon,depth,seed,lower=false,{count=null,scale=1,bold=.36,concave=false}={}){
  const positions=[],colors=[],uvs=[];
  let poreCount=0;
  const vertex=(p,shade)=>{positions.push(...p);colors.push(shade,shade,shade);uvs.push(p[0],p[2]);};
  const triangle=(a,b,c,normal,sa=1,sb=1,sc=1)=>{
    const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const dot=(ab[1]*ac[2]-ab[2]*ac[1])*normal[0]+(ab[2]*ac[0]-ab[0]*ac[2])*normal[1]+(ab[0]*ac[1]-ab[1]*ac[0])*normal[2];
    vertex(a,sa);if(dot<0){vertex(c,sc);vertex(b,sb);}else{vertex(b,sb);vertex(c,sc);}
  };
  const face=(outline,project,normal,faceSeed,porous=true,top=false)=>{
    const contour=outline.map(p=>new THREE.Vector2(...p)),holes=[],pores=[];
    const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
    const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    const area=Math.abs(THREE.ShapeUtils.area(contour));
    const target=porous?(top&&count?count:Math.min(top?20:16,Math.ceil(area*(top?15:38)))):0;
    for(let attempt=0;attempt<target*35&&pores.length<target;attempt++){
      const k=faceSeed+attempt*17;
      const x=xmin+random(k)*(xmax-xmin),y=ymin+random(k+1)*(ymax-ymin);
      const large=pores.length===0||random(k+2)>1-(top?bold:.36);
      const r=((large?(lower?.085:.063):.021)+random(k+3)*(large?.048:.021))*(top?scale:1);
      // Keep every mouth inside its face and separated from its neighbours.
      let inside=concave?insidePolygon(outline,x,y):true;
      for(let j=0;j<outline.length&&inside;j++){
        const a=outline[j],b=outline[(j+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
        const gap=concave?segmentDistance(a,b,x,y):(dx*(y-a[1])-dy*(x-a[0]))/len;
        if(gap<r*1.12+.008){inside=false;break;}
      }
      if(!inside||pores.some(p=>Math.hypot(x-p.x,y-p.y)<r+p.r+.018))continue;
      const ring=Array.from({length:12},(_,j)=>{
        const a=j*Math.PI/6,rough=1+(random(k+j+6)-.5)*.18;
        return new THREE.Vector2(x+Math.cos(a)*r*rough,y+Math.sin(a)*r*rough);
      });
      holes.push(ring);pores.push({x,y,r,ring,depth:r*(top?.65:1.15)});
    }
    const points=[...contour,...holes.flat()];
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,holes))triangle(...ids.map(i=>project(points[i].x,points[i].y,0)),normal);
    for(const p of pores){
      const rings=[[1,0,1],[.86,.22,.75],[.60,.74,.34],[.28,1,.22]];
      for(let r=0;r<rings.length-1;r++){
        const [scale,darkDepth,shade]=rings[r],[nextScale,nextDepth,nextShade]=rings[r+1];
        for(let j=0;j<p.ring.length;j++){
          const a=p.ring[j],b=p.ring[(j+1)%p.ring.length];
          const at=(q,s,d)=>project(p.x+(q.x-p.x)*s,p.y+(q.y-p.y)*s,p.depth*d);
          const a0=at(a,scale,darkDepth),b0=at(b,scale,darkDepth),a1=at(a,nextScale,nextDepth),b1=at(b,nextScale,nextDepth);
          triangle(a0,b0,b1,normal,shade,shade,nextShade);triangle(a0,b1,a1,normal,shade,nextShade,nextShade);
        }
      }
      const [scale,d,shade]=rings.at(-1),center=project(p.x,p.y,p.depth*d);
      for(let j=0;j<p.ring.length;j++){
        const a=p.ring[j],b=p.ring[(j+1)%p.ring.length];
        triangle(project(p.x+(a.x-p.x)*scale,p.y+(a.y-p.y)*scale,p.depth*d),project(p.x+(b.x-p.x)*scale,p.y+(b.y-p.y)*scale,p.depth*d),center,normal,shade,shade,shade);
      }
    }
    poreCount+=pores.length;
  };
  // Trim corners, leaving long faces for the larger pores. The small bevel
  // keeps the block handmade without inflating its walkable top.
  const outline=[];
  for(let j=0;j<polygon.length;j++){
    const prev=polygon[(j+polygon.length-1)%polygon.length],p=polygon[j],next=polygon[(j+1)%polygon.length];
    for(const q of [prev,next]){
      const t=Math.min(.2,.07/Math.hypot(q[0]-p[0],q[1]-p[1]));
      outline.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
    }
  }
  const bevel=.038,inner=outline.map(([x,z])=>{const f=1-bevel/Math.max(.15,Math.hypot(x,z));return [x*f,z*f];});
  face(inner,(x,z,d)=>[x,-d,z],[0,1,0],seed,true,true);
  face(inner,(x,z,d)=>[x,-depth+d,z],[0,-1,0],seed+400,false);
  for(let j=0;j<outline.length;j++){
    const a=outline[j],b=outline[(j+1)%outline.length],ia=inner[j],ib=inner[(j+1)%outline.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),normal=[dz/length,0,-dx/length];
    const project=(u,v,d)=>[a[0]+dx*u/length-normal[0]*d,v,a[1]+dz*u/length-normal[2]*d];
    face([[0,-depth+bevel],[length,-depth+bevel],[length,-bevel],[0,-bevel]],project,normal,seed+j*91,length>.18);
    const at=[ia[0],0,ia[1]],bt=[ib[0],0,ib[1]],as=[a[0],-bevel,a[1]],bs=[b[0],-bevel,b[1]];
    triangle(at,as,bs,[normal[0],1,normal[2]]);triangle(at,bs,bt,[normal[0],1,normal[2]]);
    const ab=[ia[0],-depth,ia[1]],bb=[ib[0],-depth,ib[1]],al=[a[0],-depth+bevel,a[1]],bl=[b[0],-depth+bevel,b[1]];
    triangle(ab,bb,bl,[normal[0],-1,normal[2]]);triangle(ab,bl,al,[normal[0],-1,normal[2]]);
  }
  const base=new THREE.BufferGeometry();
  base.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  base.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  base.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));base.computeVertexNormals();
  const geo=sculptClay(w,base,{amplitude:.012});if(geo!==base)base.dispose();
  geo.userData.poreCount=poreCount;return geo;
}
