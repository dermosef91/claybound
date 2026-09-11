import * as THREE from './lib/three.module.js';
import {windmillModel} from './windmill.js';
import {canyonModel} from './canyon-assets.js';
import {forestLandmark} from './forest-details.js';

// Functional clay stand-ins. Their dimensions and pivots are documented in
// ASSET_REQUESTS.md so supplied models can replace the art without changing play.
export function landmark(w,s,parent){
  // Goal platforms already create the animated bell and its frame.
  if(!s.landmark||(s.goal&&s.landmark==='bellgate'))return;
  if(w.biome==='forest'&&['mushroom','sporepod','rootarch'].includes(s.landmark))return forestLandmark(w,s,parent);
  const g=new THREE.Group();g.name='Landmark: '+s.landmark;g.position.set(s.w*.57,0,-2.25);parent.add(g);
  if(w.biome==='desert'&&s.landmark==='arch'){
    // Both feet rest on the rear of the existing platform, clear of the hero.
    g.position.z=-1.12;
    canyonModel(w,'tent',g,0,0,0,3.9);
    return g;
  }
  switch(s.landmark){
    case 'windmill':case 'sandwheel':{
      windmillModel(w,g);break;
    }
    case 'sporepod':case 'mushroom':{
      w.ball(.46,1.1,.5,'cream',g,0,1,0);w.ball(1.7,.7,1.15,'orange',g,0,2.1,0);
      for(const x of [-.9,0,.9])w.ball(.23,.12,.23,'cream',g,x,2.63-Math.abs(x)*.2,.35);
      if(s.landmark==='sporepod')for(let i=0;i<5;i++)w.ball(.09,.12,.09,'accent',g,(i-2)*.3,3.1+(i%2)*.4,0);
      break;
    }
    case 'counterweight':{
      for(const side of [-1,1]){w.box(.4,3.6,.5,'terrain',g,side*1.25,1.8,0,.17);w.rope([side*.85,3.4,0],[side*.85,1.2,0],g,.055);w.box(.65,.95,.6,'top',g,side*.85,.8,0,.18);}
      w.box(3.2,.4,.65,'top',g,0,3.6,0,.17);break;
    }
    case 'pulsedrum':case 'beacon':{
      w.box(1.25,1.3,1.2,'terrain2',g,0,.65,0,.3);
      w.ball(.58,.42,.5,'accent',g,0,1.54,0);
      for(const y of [.5,.9]){const ring=w.mesh(new THREE.TorusGeometry(.65,.095,8,24),'cream',g,0,y,0);ring.rotation.x=Math.PI/2;}
      break;
    }
    case 'arch':case 'rootarch':case 'bannerarch':case 'bellgate':{
      for(const x of [-1.6,1.6])w.box(.55,3.4,.8,'bark',g,x,1.7,0,.22);
      w.box(3.9,.5,1,'top',g,0,3.4,0,.22);
      if(s.landmark==='bannerarch'){if(!s.checkpoint&&w.biome!=='citadel')w.flag(.15,.8,g,.75);}
      else if(s.landmark==='bellgate'){w.ball(.47,.63,.45,'gold',g,0,2.4,0);w.ball(.14,.17,.13,'orange',g,0,1.82,0);}
      else w.ball(1.6,.55,.8,'foliage',g,0,3.8,0);
      break;
    }
    case 'kiln':{
      w.box(2,2.35,1.6,'terrain2',g,0,1.1,0,.5);w.box(1,1.3,.1,'dark',g,0,.6,.84,.3);w.ball(.42,.4,.12,'orange',g,0,.5,.91);w.box(.7,1.2,.7,'terrain',g,.4,2.65,0,.2);break;
    }
    case 'birdhouse':case 'oasis':{
      if(!s.house&&w.biome!=='desert'&&w.biome!=='forest')w.house(g,0,0,.95);
      break;
    }
    case 'crystal':{
      for(let i=0;i<3;i++){const m=w.mesh(new THREE.ConeGeometry(.55,2.5+i*.5,6),'accent',g,(i-1)*.8,1.1+i*.25,0);m.rotation.z=(i-1)*-.15;}break;
    }
  }
  return g;
}

export function balanceDeck(w,s,g){
  const pivot=new THREE.Group();pivot.position.x=s.w/2;g.add(pivot);
  w.box(s.w,.38,1.9,'top',pivot,0,-.19,0,.17);
  w.box(.55,1.5,.65,'terrain2',g,s.w/2,-1,0,.2);
  const axle=w.cylinder(.32,.4,'orange',g,s.w/2,-.35,1.08);axle.rotation.x=Math.PI/2;
  for(const x of [-s.w*.38,s.w*.38]){w.rope([x,-.25,-.6],[x,-1.35,-.6],pivot,.05);w.box(.5,.65,.5,'cream',pivot,x,-1.65,-.6,.15);}
  const meter=[];if(s.channel)for(let i=0;i<3;i++)meter.push(w.ball(.075,.075,.06,'gold',pivot,s.w*.26+i*.2,-.13,1.01));
  return {root:g,balance:pivot,bounce:0,meter};
}

export function windView(w,wind){
  const root=new THREE.Group();root.position.set(wind.x,wind.y,0);w.levelRoot.add(root);const bits=[];
  for(let i=0;i<24;i++){
    const m=w.ball(wind.spores?.045:.24,.035,.035,wind.spores?'accent':'cream',root,0,0,-.2);m.castShadow=false;
    bits.push(m);
  }
  if(wind.fy&&!wind.spores){
    w.box(1.4,.45,1.6,wind.spores?'foliage':'terrain2',root,wind.w/2,0,-.4,.2);
    const ring=w.mesh(new THREE.TorusGeometry(.5,.12,8,24),wind.spores?'cream':'rope',root,wind.w/2,.24,-.4);ring.rotation.x=Math.PI/2;
  }
  return {root,bits,wind};
}
export function animateWind(view,time){
  const {wind,bits}=view;
  for(let i=0;i<bits.length;i++){
    bits[i].visible=wind.active!==false;
    bits[i].position.x=((i*3.79+time*(wind.fx||3)*.35)%wind.w+wind.w)%wind.w;
    bits[i].position.y=wind.fy?((time*2.2+i*.73)%Math.max(2,wind.h-1)):.8+(i%5)*.65+Math.sin(time*1.2+i)*.12;
    if(wind.fy&&!wind.spores)bits[i].rotation.z=Math.PI/2;
  }
}
