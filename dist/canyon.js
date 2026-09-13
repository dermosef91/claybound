import * as THREE from './lib/three.module.js';
import {canyonModel} from './canyon-assets.js';
import {cloudModel} from './clouds.js';
import {clayMaterial,clayBox} from './clay.js';
import {archLiftCeiling} from './great-arch.js';
import {makeMovingPlatform} from './moving-platform.js';

const random=n=>{const f=Math.sin(n*127.1+47.7)*43758.5453;return f-Math.floor(f);};
const group=parent=>{const g=new THREE.Group();parent.add(g);return g;};

// Knead neutral rounded blocks; surface relief now comes from the clay ball.
// This bounded cache participates in the same streaming eviction as other clay.
function block(w,parent,width,height,depth,x,y,z,material,seed){
  if(!w.clay)return w.box(width,height,depth,material,parent,x,y,z,.25);
  const variant=Math.abs(Math.floor(seed))%7,key='canyon:'+ [width,height,depth,variant].map(v=>v.toFixed(3)).join(':');
  let geo=w.clay.boxes.get(key);
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
    const normals=geo.attributes.normal,sums=new Map(),keys=[];
    for(let i=0;i<p.count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(':');keys.push(key);
      const n=sums.get(key)||new THREE.Vector3();n.add(new THREE.Vector3().fromBufferAttribute(normals,i));sums.set(key,n);
    }
    for(let i=0;i<p.count;i++){const n=sums.get(keys[i]).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
    geo.computeBoundingBox();geo.computeBoundingSphere();geo.userData.clayRelief=true;
    w.clay.boxes.set(key,geo);w.assetGeometry.add(geo);
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

export function buildCanyonBackdrop(w){
  const far=group(w.backRoot),middle=group(w.backRoot),low=group(w.backRoot),clouds=group(w.backRoot);
  const anchors=(w.currentLevel?.platforms||[]).filter(s=>s.id==='arch-drop'&&s.kind==='bridge').map(s=>({x:s.x+s.w*.38,y:s.y+.72,scale:4.1/(w.cloudAsset?.width||1)}));
  w.parallax.push({group:far,factor:.17,heightFollow:1},{group:middle,factor:.36,heightFollow:1},{group:low,factor:.62,heightFollow:1},{group:clouds,factor:.1,heightFollow:1,anchors});
  for(let i=-2;i<10;i++){
    const x=i*16;
    canyonModel(w,'summit',far,x+5,-3.7,-53,3.2+random(i+3)*1.2,(random(i+9)-.5)*.3);
    if(i%3===0)canyonModel(w,'arch',far,x-1,-3.6,-49,3.8+random(i)*.8,.28);
    cloudModel(w,clouds,x+2,-.4+random(i+8)*.8,-58,2.8+random(i+4)*1.3,.05);
  }
  for(let i=-2;i<8;i++){
    const x=i*24;
    // Broad openings alternate with eroded stacks. The skyline has breathing
    // room instead of repeating the same arch / flag pair in every view.
    const arch=i%2===0?canyonModel(w,'arch',middle,x-1.4,-3.5,-34,5.0+random(i)*1.4,-.3+random(i+2)*.6):null;
    canyonModel(w,'summit',middle,x+9,-4.8,-30,4.5+random(i+4)*2.8,-.42+random(i+6)*.84);
    if(!arch){
      for(let j=0;j<3;j++){
        const h=3.1+random(i*9+j)*3.5;
        block(w,middle,2.2-j*.35,h,3,x-4+j*2.05,-3.8-h/2,-27,'back2',i*13+j);
      }
    }
  }
  for(let i=-2;i<14;i++){
    const x=i*11.5,h=3.8+random(i+7)*2.1,width=3.4+random(i+5)*2.4;
    block(w,low,width,h,3.2,x,-6.5-h/2,-17,'back2',i*13);
    w.box(width+.16,.47,3.4,'back',low,x,-6.5,-17,.2);
    if(i%3===0)canyonModel(w,'summit',low,x,-7.1,-21,4.3,.1);
  }
  w.backRoot.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
}

export function makeCanyonLift(w,s,g){
  return makeMovingPlatform(w,s,g,{ceiling:archLiftCeiling(w,s)});
}
