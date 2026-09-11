import * as THREE from './lib/three.module.js';
import {castle} from './castle.js';
import {cottageModel} from './cottage.js';
import {sculptClay} from './clay.js';
import {cloudModel} from './clouds.js';
const rand=n=>{const v=Math.sin(n*123.21+47.5)*43758.5453;return v-Math.floor(v);};
const group=(parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};

// Broad, slightly uneven clay faces and round pressed edges, in world-scale UVs.
function finishClay(w,g){return sculptClay(w,g,{amplitude:.026,subdivide:true,planar:true});}
function block(w,parent,width,height,depth,mat,x,y,z,r=.22){
  return w.box(width,height,depth,mat,parent,x,y,z,r);
}
function arch(w,parent,width,height,depth,mat,x,y,z,center=width/2,radius=2.4,crown=-2.7){
  const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(width,0);s.lineTo(width,-height);s.lineTo(center+radius,-height);s.lineTo(center+radius,crown-radius);
  s.bezierCurveTo(center+radius,crown-radius*.448,center+radius*.552,crown,center,crown);
  s.bezierCurveTo(center-radius*.552,crown,center-radius,crown-radius*.448,center-radius,crown-radius);
  s.lineTo(center-radius,-height);s.lineTo(0,-height);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth,steps:1,bevelEnabled:true,bevelThickness:.17,bevelSize:.16,bevelSegments:5,curveSegments:24});
  return w.mesh(finishClay(w,geo),mat,parent,x,y,z-depth/2);
}
function entranceBridge(w,parent,width,height,depth){
  const shape=new THREE.Shape(),center=12.4,radius=2.8,crown=-2.9;
  shape.moveTo(0,0);shape.lineTo(width,0);shape.lineTo(width,-height);shape.lineTo(center+radius,-height);shape.lineTo(center+radius,crown-radius);
  shape.bezierCurveTo(center+radius,crown-radius*.448,center+radius*.552,crown,center,crown);
  shape.bezierCurveTo(center-radius*.552,crown,center-radius,crown-radius*.448,center-radius,crown-radius);
  shape.lineTo(center-radius,-height);shape.lineTo(0,-height);shape.closePath();
  // Each pressed block contains its own part of the arch, so the seams extend
  // through the bridge instead of reading as plates attached to its surface.
  const clip=(points,bound,keepRight)=>{
    const result=[],inside=p=>keepRight?p.x>=bound:p.x<=bound;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],ia=inside(a),ib=inside(b);
      if(ia)result.push(a);
      if(ia!==ib)result.push(new THREE.Vector2(bound,a.y+(b.y-a.y)*(bound-a.x)/(b.x-a.x)));
    }
    return result;
  };
  const cuts=[0,10.95,14.35,width],outline=shape.getPoints(48);
  for(let i=0;i<cuts.length-1;i++){
    const left=cuts[i]+(i?.09:0),right=cuts[i+1]-(i<cuts.length-2?.09:0);
    const piece=new THREE.Shape(clip(clip(outline,left,true),right,false));
    const geo=new THREE.ExtrudeGeometry(piece,{depth:depth+(i===1?.05:0),steps:1,bevelEnabled:true,bevelThickness:.17,bevelSize:.16,bevelSegments:5,curveSegments:24});
    w.mesh(finishClay(w,geo),'terrain',parent,0,-.08,-depth/2+(i===2?.05:0));
  }
}
export function banner(w,parent,x,y,z,width=.9,length=2.5){
  const s=new THREE.Shape();s.moveTo(-width/2,0);s.bezierCurveTo(-width*.1,.025,width*.3,-.02,width/2,0);s.lineTo(width/2,-length+.08);
  s.quadraticCurveTo(width*.34,-length-.18,0,-length+.24);s.quadraticCurveTo(-width*.27,-length-.08,-width/2,-length+.11);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.07,bevelEnabled:true,bevelThickness:.055,bevelSize:.055,bevelSegments:3,curveSegments:14});
  return w.mesh(finishClay(w,geo),'top',parent,x,y,z);
}
function doorway(w,parent,x,y,z,scale=1){
  const g=group(parent,x,y,z);g.scale.setScalar(scale);
  const shape=new THREE.Shape();shape.moveTo(-.65,0);shape.lineTo(.65,0);shape.lineTo(.65,1.32);shape.bezierCurveTo(.65,2.24,-.65,2.24,-.65,1.32);shape.closePath();
  w.mesh(new THREE.ShapeGeometry(shape,24),'citadelRecess',g,0,0,.035);
  const pts=[new THREE.Vector3(-.72,0,0),new THREE.Vector3(-.73,1.25,0)];
  for(let i=0;i<=24;i++){const a=Math.PI-i/24*Math.PI;pts.push(new THREE.Vector3(Math.cos(a)*.72,1.3+Math.sin(a)*.78,0));}
  pts.push(new THREE.Vector3(.72,0,0));
  w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),68,.085,9,false),'terrain2',g);return g;
}
function pressedStep(w,g,x,y,z,width=1.4){
  block(w,g,width,.27,.45,'top',x,y,z,.12);
  block(w,g,width-.08,.32,.37,'terrain2',x,y-.27,z-.04,.11);
}
function crease(w,g,points,r=.015){
  w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),14,r,5,false),'terrain2',g);
}

export function buildCitadelTerrain(w,s,g){
  if(!w.mat.citadelRecess)w.mat.citadelRecess=new THREE.MeshStandardMaterial({color:0x081526,roughness:1});
  const width=s.w,height=12,depth=3.32;
  if(s.entrance)entranceBridge(w,g,width,height,depth);
  else if(s.arch)arch(w,g,width,height,depth,'terrain',0,-.08,0,width*.5,2.15,-2.9);
  else{
    const columns=Math.ceil(width/3.8);
    for(let i=0;i<columns;i++){
      const cw=width/columns;
      for(let row=0;row<3;row++)block(w,g,cw+.15,height/3+.18,depth+(i%2)*.08,(i+row)%3===1?'terrain2':'terrain',(i+.5)*cw,-(row+.5)*height/3-.17,-.035,.24);
    }
  }
  // First bridge is solid blue; roofs and stepping ledges carry orange clay.
  if(!s.entrance)block(w,g,width+.12,.55,3.51,'top',width/2,-.22,0,.19);
  if(s.entrance){
    // Close left-hand tower, little cream house, draped orange banner and door.
    block(w,g,7.9,13.5,3.7,'terrain',6.9,6.62,-3.3,.3);
    block(w,g,3.7,4.2,2.1,'terrain',8.6,2,-1.68,.27);
    block(w,g,4.25,.28,2.6,'terrain',8.2,4.04,-1.85,.12);
    const entry=doorway(w,g,7.7,.06,-.56,1.04);entry.scale.x*=1.32;
    cottageModel(w,g,8.2,4.19,-1.9,3.4,-.06);
    block(w,g,2.22,.42,1.0,'top',9.87,4.02,-.45,.14);
    banner(w,g,9.22,4.19,.035,1.05,2.28);
    crease(w,g,[[15.2,-.2,1.77],[15.05,-1.1,1.79],[15.24,-2.0,1.77],[15.04,-2.5,1.76]]);
    crease(w,g,[[6,-.2,1.76],[6.14,-.9,1.75],[6.0,-1.45,1.77]]);
  }else{
    for(let i=0;i<2;i++)pressedStep(w,g,s.id==='roof1'?3.1-i:width-.95-(i%2)*1.0,-2.55-i*2.25,1.86,1.37+i*.15);
    if(s.house){
      // The supplied cottage includes the doorway, garden and laundry props.
      cottageModel(w,g,width-2.15,.035,-1.4,3.65,.08);
    }
    if(s.id==='roof2'||s.id==='roof4'){
      doorway(w,g,width*.4,-6.1,1.77,1.1);
      banner(w,g,width*.28,-.11,1.85,.82,2.35);
    }
    if(s.checkpoint)w.flag(s.checkpoint-s.x,.08,g,1.04,s.id);
    else if(!s.goal)w.flag(.9,.07,g,.82);
    if(s.goal)w.makeBell(g,s.bellX??width-5.2,.1);
    crease(w,g,[[width*.32,-1.0,1.77],[width*.31,-1.5,1.77],[width*.35,-2.1,1.78]],.011);
  }
}

export function makeCitadelLift(w,s,g){
  block(w,g,s.w,.54,1.66,'top',s.w/2,-.22,0,.21);
  block(w,g,s.w-.13,.095,1.48,'orangeLight',s.w/2,-.03,0,.035);
  const ropes=[];
  for(const [i,x] of [.48,s.w-.48].entries()){
    w.rope([x,.04,-.21],[x,15,-.21],g,.083,true);
    const tie=w.mesh(new THREE.TorusGeometry(.14,.065,10,24),'rope',g,x,.19,-.21);tie.rotation.x=Math.PI/2;tie.scale.x=1.1;
    const wheel=w.cylinder(.49,.20,'top',g,x,i===0?3.83:2.94,-.1);wheel.rotation.x=Math.PI/2;
    const rim=w.cylinder(.44,.22,'orange',g,x,i===0?3.83:2.94,-.075);rim.rotation.x=Math.PI/2;
    const axle=w.ball(.17,.17,.12,'top',g,x,i===0?3.83:2.94,.08);
    ropes.push(tie,wheel,rim,axle);
  }
  return {root:g,ropes,bounce:0};
}

function cloud(w,parent,x,y,z,scale){
  return cloudModel(w,parent,x,y,z,scale*4.8,Math.sin(x)*.12);
}
export function buildCitadelBackdrop(w,L){
  const city=group(w.backRoot),near=group(w.backRoot),clouds=group(w.backRoot);
  w.parallax.push({group:city,factor:.22},{group:near,factor:.7,heightFollow:1},{group:clouds,factor:.15,heightFollow:1});
  // The supplied castle is the whole skyline. Clones share geometry/textures
  // and carry it continuously behind the long, vertically climbing route.
  for(let i=-1;i<4;i++)castle(w,city,1.8+i*25,-5.25,-27,19.4);
  cloud(w,clouds,-4.8,4.95,-38,1.5);cloud(w,clouds,7.5,2.65,-31,1.1);
  for(let i=-1;i<10;i++){
    cloud(w,clouds,i*17+2.5,2.2+rand(i+9)*2,-41,1.5+rand(i+2)*.6);
    cloud(w,near,i*15+3,-3.6+rand(i+14)*.9,-15,1.75+rand(i+51)*.6);
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}
