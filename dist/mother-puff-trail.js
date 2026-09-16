import * as THREE from './lib/three.module.js';
import {motherSporePosition} from './mother-puff-rules.js';

// A flying spore sheds clay motes and a fine powder haze behind it. The trail
// is view-only decoration the simulation never knows about. Every piece is
// dropped at a fixed shed time along the spore's recorded arc rather than at
// whatever position the current frame happens to see, so pause, replays and
// frame rate all draw the same trail, and a spore first noticed mid-flight
// carries the same last second of dust it would have shed anyway.
export const TRAIL={moteGap:.04,moteLife:1,hazeGap:.075,hazeLife:.85,hazeOpacity:.92,limit:110};
const CREAM=new THREE.Color(0xfff4e2);

// Powder has no silhouette. Each billow fades toward its rim, so overlapping
// billows merge into one soft mist instead of reading as a row of glass
// bubbles. `rim` sets how fast the fade sets in; the camera is orthographic, so
// the view-space normal's z is exactly how squarely the surface faces it.
// Same injection route as the clay relief, which skips transparent materials.
export function powderMaterial(color,{opacity=1,rim=1,glow=0}={}){
  const m=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:glow,roughness:1,metalness:0,transparent:true,opacity,depthWrite:false});
  m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\ndiffuseColor.a *= pow( saturate( normal.z ), ${rim.toFixed(3)} );`);};
  m.customProgramCacheKey=()=>'mother-powder-rim-'+rim.toFixed(3);
  return m;
}

export function emitMotherTrail(w,shed,s,mat){
  const quiet=w.reducedMotion,gap=TRAIL.moteGap*(quiet?2:1);
  for(;shed.mote*gap<=s.age;shed.mote++){
    // Every other mote dies young, so the stream is dense right behind the
    // cluster and thins out along the arc.
    const k=shed.mote,at=k*gap,age=s.age-at,life=TRAIL.moteLife*(k%2?.55:1);
    if(age>=life||w.particles.length>=TRAIL.limit)continue;
    const seed=k*2.399+s.id*.73,p=motherSporePosition(s,at/s.duration),r=.08+((k+s.id)%3)*.05;
    const m=w.ball(r,r,r,mat,w.fxRoot,p.x+Math.cos(seed)*.3,p.y+Math.sin(seed*1.7)*.3,.3+Math.sin(seed)*.4);
    m.name='Spore trail mote';m.castShadow=false;m.receiveShadow=false;
    const q={kind:'mother-trail',mesh:m,life:life-age,maxLife:life,vx:Math.cos(seed)*.5,vy:Math.sin(seed*1.7)*.25-.25,vz:0,restScale:m.scale.clone()};
    m.position.x+=q.vx*age;m.position.y+=q.vy*age;updateMotherTrail(q,0);w.particles.push(q);
  }
  // Reduced motion keeps the clay motes, which read the arc, and drops the
  // drifting powder, which is only atmosphere.
  if(quiet)return;
  for(;shed.haze*TRAIL.hazeGap<=s.age;shed.haze++){
    const at=shed.haze*TRAIL.hazeGap,age=s.age-at;
    if(age>=TRAIL.hazeLife||w.particles.length>=TRAIL.limit)continue;
    const seed=shed.haze*2.399+s.id*1.31,p=motherSporePosition(s,at/s.duration),r=.7+(shed.haze%2)*.2;
    const haze=powderMaterial(mat.color.clone().lerp(CREAM,.5),{opacity:TRAIL.hazeOpacity,rim:1.1,glow:.55});
    const m=w.ball(r,r,r,haze,w.fxRoot,p.x+Math.cos(seed)*.2,p.y+Math.sin(seed)*.2,.1);
    m.name='Spore trail haze';m.castShadow=false;m.receiveShadow=false;
    const q={kind:'mother-trail',haze:true,mesh:m,life:TRAIL.hazeLife-age,maxLife:TRAIL.hazeLife,vx:Math.sin(seed)*.2,vy:.3,vz:0,restScale:m.scale.clone(),ownedMaterials:new Set([haze])};
    m.position.x+=q.vx*age;m.position.y+=q.vy*age;updateMotherTrail(q,0);w.particles.push(q);
  }
}

// World.updateParticles applies vy/vz itself and disposes owned materials when
// life runs out; this only shapes the piece and slows its sideways drift.
export function updateMotherTrail(q,dt){
  const age=q.maxLife-q.life;
  q.vx*=Math.exp(-dt*1.6);q.mesh.position.x+=q.vx*dt;
  if(q.haze){
    const grow=.65+Math.min(1,age/.4)*.35,fade=Math.min(1,q.life/.6);
    q.mesh.scale.copy(q.restScale).multiplyScalar(grow);
    for(const m of q.ownedMaterials)m.opacity=TRAIL.hazeOpacity*fade;
  }else q.mesh.scale.copy(q.restScale).multiplyScalar(Math.min(1,q.life/.45));
}
