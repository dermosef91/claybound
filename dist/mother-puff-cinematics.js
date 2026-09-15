import * as THREE from './lib/three.module.js';
import {MOTHER_PUFF} from './mother-puff-rules.js';

const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};

// The veil is in front of the entire silhouette. The two supplied models
// exchange behind opaque billows; neither is scaled down in view.
export function createMotherClouds(w,parent){
  const root=new THREE.Group();root.name='Mother Puff transformation veil';parent.add(root);
  const material=new THREE.MeshStandardMaterial({color:0xffe9ca,roughness:1,transparent:true,depthWrite:false});
  const parts=[];
  const lobes=[[0,3.4,3.25],[-2.5,4.3,2.3],[2.4,4.7,2.5],[0,6.3,2.2],[-1.1,1.5,2.2],[1.6,1.9,2.1]];
  for(let i=0;i<15;i++){
    const a=i*2.399;
    lobes.push([Math.cos(a)*(3.5+i%3*.2),3.5+Math.sin(a)*(2.6+i%2*.35),1.0+i%4*.14]);
  }
  for(const [i,[x,y,r]]of lobes.entries()){
    const m=w.ball(1,1,1,material,root);m.castShadow=false;m.receiveShadow=false;m.renderOrder=12;
    parts.push({m,x,y,z:3.6+(i%5)*.3,r,seed:i*2.399});
  }
  const puff=new THREE.Group();puff.name='Leftward crown spore puff';parent.add(puff);
  const puffMaterial=material.clone();puffMaterial.color.setHex(0xf5d5a1);
  const gust=[];
  for(let i=0;i<12;i++){const m=w.ball(1,1,1,puffMaterial,puff);m.castShadow=false;gust.push(m);}
  return {root,material,parts,puff,puffMaterial,gust};
}

export function animateMotherClouds(v,b,reduced){
  const t=b.stateTime,phase=b.state;
  const ending=['veil','transform','reveal-form'].includes(phase);
  const farewell=phase==='farewell'||phase==='bloom'&&t<1.4;
  v.root.visible=ending||farewell;
  let cover=0,scatter=0,size=1;
  if(phase==='veil')cover=smooth(t/1.05);
  if(phase==='transform')cover=1;
  if(phase==='reveal-form'){cover=1-smooth(t/2.6);scatter=smooth(t/2.6);}
  if(farewell){size=(MOTHER_PUFF.friendlyHeight+.45)/MOTHER_PUFF.height;cover=phase==='farewell'?smooth(t/.65):1-smooth(t/1.4);scatter=phase==='bloom'?smooth(t/1.4):0;}
  v.material.opacity=cover;
  v.material.depthWrite=cover>.97;
  v.root.position.set(b.x,b.y,0);
  for(const {m,x,y,z,r,seed}of v.parts){
    const billow=reduced?0:Math.sin(t*2+seed)*.1;
    m.position.set(x*size-scatter*(2+Math.cos(seed)*2),y*size+scatter*(1.6+Math.sin(seed)),z);
    m.scale.setScalar((r+billow)*size*(.38+cover*.62+scatter*.8));
  }
  const hit=(phase==='hurt'||phase==='veil')&&t<1.2;
  v.puff.visible=hit;v.puff.position.set(b.x,b.y+7,2.5);
  v.puffMaterial.opacity=(1-smooth(t/1.2))*.85;
  for(const [i,m]of v.gust.entries()){
    const a=i*2.399;
    m.position.set(-t*(6+i%4)+Math.cos(a)*.65,Math.sin(a)*(.3+t),Math.sin(a)*.4);
    m.scale.setScalar((.45+i%3*.16)*(1+t*1.4));
  }
}
