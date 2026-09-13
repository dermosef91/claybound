import * as THREE from './lib/three.module.js';
import {mergeGeometries} from './lib/BufferGeometryUtils.js';
import {clayMaterial} from './clay.js';
import {bridgeOffset,bridgeSag} from './bridge-surface.js';

function bridgeMaterials(w){
  if(w.bridgeMaterials)return w.bridgeMaterials;
  // Long, wandering fibres and a few knot eyes, in the timber's own UV space.
  const width=1024,height=256,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height;
    let fibre=v*24+.33*Math.sin(u*15+v*4)+.13*Math.sin(u*41-v*8);
    for(const [cx,cy]of [[.27,.34],[.73,.71]]){
      const dx=(u-cx)*7,dy=(v-cy)*2.6,envelope=Math.exp(-dx*dx*2.8-dy*dy*3);
      fibre+=envelope*(Math.atan2(dy,dx)*.9+dy*5);
    }
    const vein=Math.pow(.5+.5*Math.sin(fibre*Math.PI*2),13),fine=Math.pow(.5+.5*Math.sin(fibre*37+Math.sin(u*85)),20);
    const tone=.84+.055*Math.sin(fibre*2.1)-vein*.19-fine*.055+.025*Math.sin(x*1.73+y*3.17);
    const i=(y*width+x)*4;pixels[i]=Math.round(158*tone);pixels[i+1]=Math.round(108*tone);pixels[i+2]=Math.round(75*tone);pixels[i+3]=255;
  }
  const grain=new THREE.DataTexture(pixels,width,height);grain.colorSpace=THREE.SRGBColorSpace;
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.magFilter=THREE.LinearFilter;grain.minFilter=THREE.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
  const wood=new THREE.MeshStandardMaterial({color:0xffffff,map:grain,roughness:.93});
  const rope=new THREE.MeshStandardMaterial({color:0xc99b62,roughness:.96,vertexColors:true});
  const endgrain=new THREE.MeshStandardMaterial({color:0x916442,roughness:.96});
  const materials={wood,rope,endgrain};w.assetMaterials??=new Set();
  for(const material of Object.values(materials)){clayMaterial(w,material,.023);w.assetMaterials.add(material);}
  w.bridgeMaterials=materials;return materials;
}

const curve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');

export function makeRopeBridge(w,s,g){
  g.name='Clay rope bridge';const materials=bridgeMaterials(w),sag=bridgeSag(s),deck=x=>bridgeOffset(s,x);
  // Three broad timbers bow along the span. Bevelled, slightly uneven edges
  // reveal their thickness; the middle timber's crown is the walking surface.
  for(let i=0;i<3;i++){
    const z=(i-1)*.625,bias=(1-i)*.055,shape=new THREE.Shape(),steps=96;
    for(let j=0;j<=steps;j++){
      const x=s.w*j/steps,y=deck(x)+bias-.055+Math.sin(j*.3+i)*.005;
      if(j)shape.lineTo(x,y);else shape.moveTo(x,y);
    }
    for(let j=steps;j>=0;j--){const x=s.w*j/steps;shape.lineTo(x,deck(x)+bias-.39+Math.sin(x*7+i)*.012);}
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.56,bevelEnabled:true,bevelThickness:.055,bevelSize:.055,bevelSegments:4,steps:1});
    geometry.translate(0,0,z-.28);
    const position=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let j=0;j<position.count;j++){
      const x=position.getX(j),y=position.getY(j),nz=geometry.attributes.normal.getZ(j);
      uv.setXY(j,x/s.w,Math.abs(nz)>.45?(y-deck(x)-bias+.44)/.47:(position.getZ(j)-z+.34)/.68+i*.19);
    }
    const plank=new THREE.Group();plank.name='Bridge plank';g.add(plank);
    const timber=w.mesh(geometry,materials.wood,plank);timber.name='Bowed wooden timber';
  }
  function braid(points,r=.064){
    const path=curve(points),length=path.getLength(),segments=Math.max(24,Math.min(700,Math.ceil(length*58)));
    const frames=path.computeFrenetFrames(segments,false),strands=[];
    for(let strand=0;strand<3;strand++){
      const centres=[];
      for(let j=0;j<=segments;j++){
        const t=j/segments,p=path.getPointAt(t),angle=length*t*Math.PI*2/.205+strand*Math.PI*2/3;
        p.addScaledVector(frames.normals[j],Math.cos(angle)*r*.53).addScaledVector(frames.binormals[j],Math.sin(angle)*r*.53);centres.push(p);
      }
      const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(centres),segments,r*.52,6,false);
      const colors=new Float32Array(geometry.attributes.position.count*3);colors.fill(1-strand*.035);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));strands.push(geometry);
    }
    const geometry=mergeGeometries(strands);strands.forEach(part=>part.dispose());geometry.userData.clayRelief=true;
    return w.mesh(geometry,materials.rope,g);
  }
  const left=-.38,right=s.w+.38,railHeight=x=>{
    const u=(x-left)/(right-left);return .77-4*(sag+.38)*u*(1-u);
  };
  for(const [index,x]of [left,right].entries()){
    const root=new THREE.Group();root.name='Bridge anchor post';root.position.set(x,0,.76);root.rotation.z=index?-.018:.025;g.add(root);
    const post=w.cylinder(.24,1.18,materials.wood,root,0,.56,0);
    // Turn the fibre direction up the post instead of around its circumference.
    const geometry=post.geometry.clone(),uv=geometry.attributes.uv;
    for(let j=0;j<uv.count;j++){const u=uv.getX(j),v=uv.getY(j);uv.setXY(j,v*.56,u);}
    post.geometry=geometry;
    w.ball(.235,.075,.225,materials.endgrain,root,0,1.14,0);
    const wrap=[];for(let j=0;j<=90;j++){const t=j/90,a=t*Math.PI*6;wrap.push([x+Math.cos(a)*.27,.68+t*.19,.76+Math.sin(a)*.27]);}
    braid(wrap,.065);
    braid([[x+(index?-.24:.24),.85,.95],[x+(index?-.30:.30),.70,1.02],[x+(index?-.16:.16),.64,.97]],.066);
  }
  const rail=[];for(let j=0;j<=48;j++){const x=left+(right-left)*j/48;rail.push([x,railHeight(x),.91]);}braid(rail,.072).name='Sagging braided handrail';
  // Lower suspension cords disappear into the backs of the landing banks.
  for(const z of [-.80,.85]){
    const cord=[];for(let j=0;j<=40;j++){const x=left+(right-left)*j/40;cord.push([x,deck(x)-.31,z]);}braid(cord,.047);
  }
  const ties=Math.max(2,Math.min(24,Math.round(s.w/1.15)));
  for(let i=0;i<ties;i++){
    const x=s.w*(.1+.8*i/(ties-1)),y=deck(x),top=railHeight(x),lean=(i-ties/2)*.014;
    // Thick twin strands wrap over and under all three timbers, then tie into
    // the low handrail. Short, irregular tails stay close to the wooden face.
    for(const dx of [-.058,.058]){
      braid([[x+dx-lean,y+.07,1.02],[x+dx-lean*2,y-.38,1.06],[x+dx,y-.46,.82],[x+dx,y-.43,-.82],[x+dx,y-.29,-1],[x+dx,y+.09,-.83],[x+dx+lean,y+.09,.76],[x+dx-lean,y+.07,1.02]],.060);
      braid([[x+dx+lean,top+.10,.92],[x+dx,top-.11,1.02],[x+dx-lean,y+.07,1.02]],.057);
    }
    const knot=[];for(let j=0;j<=60;j++){const t=j/60,a=t*Math.PI*5;knot.push([x+Math.cos(a)*.12,top-.19+t*.22,.99+Math.sin(a)*.115]);}
    braid(knot,.062).name='Bridge rope knot';
    braid([[x-.12,top-.20,1.05],[x+.12,top-.07,1.11],[x+.06,top-.27,1.08]],.058);
  }
  return {root:g,ropes:[],bounce:0};
}
