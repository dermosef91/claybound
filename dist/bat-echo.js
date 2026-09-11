import * as THREE from './lib/three.module.js';
import {sculptClay,clayMeshMaterial} from './clay.js';
import {retainModel} from './model-assets.js';
import {BAT} from './enemy-rules.js';

const centerY=(BAT.bottom+BAT.top)/2;
export function batLookVector(e,target=new THREE.Vector3()){
  if(e.aiState==='dive'&&Number.isFinite(e.diveVX)&&Number.isFinite(e.diveVY))return target.set(e.diveVX,e.diveVY,0);
  const retreat=e.aiState==='retreat',x=retreat?e.lookX:e.aimX,y=retreat?e.lookY:e.aimY;
  return target.set(Number.isFinite(x)?x-e.x:e.dir,Number.isFinite(y)?y-e.y-centerY:-1,0);
}
export function createBatEcho(w,parent){
  if(!w.batEcho){
    const points=[];
    for(let i=0;i<=20;i++){
      const a=(i/20-.5)*1.72,r=.56+.008*Math.sin(i*.8);
      points.push(new THREE.Vector3((Math.cos(a)-1)*r,Math.sin(a)*r,.012*Math.sin(i*.45)));
    }
    const geometry=sculptClay(w,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.075,8,false),{amplitude:.018});
    const cap=sculptClay(w,new THREE.SphereGeometry(.076,10,8),{amplitude:.009});
    const base=new THREE.MeshStandardMaterial({color:0xffdfa2,roughness:.95,metalness:0,emissive:0x60421c,emissiveIntensity:.16});
    const material=clayMeshMaterial(w,geometry,base);
    w.batEcho={geometry,cap,material,ends:[points[0],points.at(-1)]};
  }
  const {geometry,cap,material,ends}=w.batEcho,root=new THREE.Group();root.name='Clay echolocation';
  root.position.set(0,centerY-BAT.modelOffsetY,.65);root.visible=false;parent.add(root);
  const waves=Array.from({length:3},(_,i)=>{
    const g=new THREE.Group();g.name='Echo wave '+(i+1);root.add(g);
    const arc=new THREE.Mesh(geometry,material);g.add(arc);
    for(const end of ends){const m=new THREE.Mesh(cap,material);m.position.copy(end);g.add(m);}
    return g;
  });
  retainModel(w,root);return {root,waves,reducedMotion:!!w.reducedMotion};
}
export function animateBatEcho(cue,e,status){
  cue.root.visible=e.alive&&e.aiState==='charge'&&status!=='editing';
  if(!cue.root.visible)return;
  const direction=batLookVector(e),distance=direction.length(),reach=Math.min(2.05,Math.max(.75,distance-.4));
  cue.root.rotation.z=Math.atan2(direction.y,direction.x);
  for(let i=0;i<cue.waves.length;i++){
    const u=cue.reducedMotion?(i+.5)/3:(((e.stateTime||0)/.44+i/3)%1+1)%1;
    const appear=cue.reducedMotion?1:Math.max(0,Math.min(1,u/.1,(1-u)/.14));
    const size=(.48+u*.72)*appear;
    cue.waves[i].position.x=.62+u*(reach-.62);
    cue.waves[i].scale.setScalar(size);
  }
}
