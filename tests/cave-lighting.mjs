import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {animateCaveLights,createCaveLights} from '../dist/cave-lighting.js';

const scene=new THREE.Scene();
function fixture(kind,x){
  const flame=new THREE.Object3D();flame.position.set(x,0,-29);scene.add(flame);
  return {flame,position:new THREE.Vector3(),kind,phase:0,power:23,range:9,color:kind==='crystal'?0x46bbff:0xff962f};
}
const left=fixture('mushroom',-5),right=fixture('mushroom',5),blue=fixture('crystal',0),torch=fixture('torch',0);
const w={biome:'cave',time:0,cameraX:-1,cameraY:0,viewW:22,viewH:10,torches:[left,right,blue,torch],torchLights:createCaveLights()};
const ids=w.torchLights.map(l=>l.id);
const step=(x,dt=1/60)=>{
  w.cameraX=x;w.time+=dt;
  const before=w.torchLights.map(l=>({power:l.intensity,position:l.position.clone(),color:l.color.getHex()}));
  animateCaveLights(w,dt);
  assert.deepEqual(w.torchLights.map(l=>l.id),ids,'light objects are reused');
  assert(w.torchLights.length===4&&w.torchLights.filter(l=>l.intensity>0).length<=4);
  w.torchLights.forEach((light,i)=>{
    assert(Number.isFinite(light.intensity)&&light.intensity>=0&&!light.castShadow);
    if(dt&&dt<=1/60)assert(Math.abs(light.intensity-before[i].power)<1.1,'no abrupt intensity jump during movement');
    if(before[i].power>.001&&light.intensity>.001){
      assert(light.position.distanceTo(before[i].position)<.001,'a lit handoff lamp must not jump between fixtures');
      assert.equal(light.color.getHex(),before[i].color,'a lit lamp must not change colour abruptly');
    }
  });
};
animateCaveLights(w,0);
assert.equal(w.caveLightState.slots[0].binding.source,left);
for(let i=0;i<180;i++)step(Math.sin(i*1.3)*.18);
assert.equal(w.caveLightState.slots[0].binding.source,left);
assert.equal(w.caveLightState.transition,null,'midpoint jitter does not switch sources');
console.log('PASS camera midpoint jitter keeps stable fixture assignments');

let overlap=false;
for(let i=0;i<45;i++){
  step(4);
  if(w.caveLightState.transition){
    overlap ||= w.caveLightState.slots[0].light.intensity>0&&w.caveLightState.spare.intensity>0;
    assert(Math.abs(w.caveLightState.slots[0].light.intensity+w.caveLightState.spare.intensity-23)<1e-8,'handoff overlaps with no dark frame');
  }
}
assert(overlap);assert.equal(w.caveLightState.slots[0].binding.source,right);
for(let i=0;i<10;i++)step(-4);
for(let i=0;i<90;i++)step(4);
assert.equal(w.caveLightState.slots[0].binding.source,right);
const unchanged=w.torchLights.map(l=>l.intensity);for(let i=0;i<10;i++)step(4,0);
assert.deepEqual(w.torchLights.map(l=>l.intensity),unchanged);
console.log('PASS crossfades overlap smoothly through direction reversals and zero-time updates');

// Streaming can remove the old fixture during a handoff. Its light fades at
// the last world position, rather than jumping to the detached local origin.
right.flame.removeFromParent();w.torches=w.torches.filter(t=>t!==right);
for(let i=0;i<45;i++)step(4);
assert.equal(w.caveLightState.slots[0].binding.source,left);
left.flame.position.x+=140;
for(let i=0;i<45;i++)step(4);
assert.equal(w.caveLightState.slots[0].binding,null);
console.log('PASS streamed removal and parallax wrapping fade out without light-position jumps');

w.biome='forest';animateCaveLights(w,1/60);
assert(w.torchLights.every(l=>l.intensity===0));assert.equal(w.caveLightState,null);
w.biome='cave';w.cameraX=140;animateCaveLights(w,0);
assert.equal(w.caveLightState.slots[0].binding.source,left);
assert(w.torchLights.some(l=>l.intensity>0));
console.log('PASS chapter changes reset light assignments and respect the fixed four-light budget');
