import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {forestSeal,animateForest} from '../dist/forest-details.js';
import {Game} from '../dist/simulation.js';

const game=new Game();game.start(1);
const before=JSON.stringify(game.level);
const w=Object.assign(Object.create(World.prototype),{biome:'forest',platforms:new Map(),reducedMotion:false});
for(const s of game.level.platforms.filter(s=>s.kind==='break')){
 const root=new THREE.Group();root.position.set(s.x,s.y,0);forestSeal(w,s,root);w.platforms.set(s.id,{root});
 const b=root.userData.sporeBreath,objects=[];root.traverse(o=>objects.push(o));
 const scales=new Set(),glows=new Set();let exhaled=false,rested=false,clouds=false;
 for(let frame=0;frame<360;frame++){
  game.time=frame/60;animateForest(w,game);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root.userData.pod,true);
  assert(Math.abs(box.max.y-s.y)<.01,'breathing preserves the stomp surface');
  assert(Math.abs(box.min.x-s.x)<.002&&Math.abs(box.max.x-s.x-s.w)<.002,'breathing preserves horizontal landing bounds');
  scales.add(b.shell.scale.y);glows.add(b.poreMaterial.emissiveIntensity);
  exhaled||=b.motes.some(m=>m.visible);clouds||=b.puffs.some(p=>p.visible);rested||=b.motes.every(m=>!m.visible);
 }
 assert(scales.size>100&&glows.size>100);assert(exhaled&&rested&&clouds,'golden pollen and cream clouds exhale in distinct pulses');
 const pose=()=>JSON.stringify([b.shell.scale.toArray(),b.material.emissiveIntensity,[...b.motes,...b.puffs].map(m=>[m.visible,m.position.toArray(),m.scale.toArray(),m.rotation.toArray()])]);
 const frozen=pose();game.pause();game.tick(.2,{});animateForest(w,game);assert.equal(pose(),frozen,'pause freezes the entire breath');game.resume();
 w.reducedMotion=true;animateForest(w,game);const quiet=pose();game.time+=1;animateForest(w,game);
 assert.equal(pose(),quiet);assert(!b.spores.visible);assert.deepEqual(b.shell.scale.toArray(),[1,1,1]);w.reducedMotion=false;
 const after=[];root.traverse(o=>after.push(o));assert.deepEqual(after,objects,'animation reuses its bounded particle pool');
 root.visible=false;const hidden=pose();game.time+=1;animateForest(w,game);assert.equal(pose(),hidden,'broken/hidden seals stop breathing');
}
assert.equal(JSON.stringify(game.level),before,'visual cues do not modify gameplay');
console.log('PASS spore breath: visible puff/rest phases, swelling/glow, fixed collision alignment, pause, reduced motion and bounded particles');
