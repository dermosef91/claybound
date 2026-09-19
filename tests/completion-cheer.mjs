// The completion diorama's cheer is a rotation laid *onto* whatever the arm
// bones already hold, so it is only ever correct on a bone the mixer has just
// written. Under stop motion the mixer is stepped by nothing at all between
// exposures, and three.js skips writing a bone whose blended value has not
// changed — so on a held frame the arm still carries the last frame's cheer.
// Turning it again there wound the arms round and round, twelve times a
// second, which is what the level-complete screen used to do.
//
// The guard: while the pose is held the arms must not move at all, and the
// cheer must still actually be a cheer. Both matter — deleting the overlay
// would satisfy the first on its own.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero,animateHero,heroEvent} from '../dist/hero.js';
import {CompletionScene} from '../dist/completion-scene.js';
import {tickPuppets,createPuppetClock} from '../dist/stop-motion.js';
import {readPlayer} from './load-player.mjs';

const motion=JSON.parse(await readFile(new URL('../dist/assets/player-motion.json',import.meta.url)));
const idle=JSON.parse(await readFile(new URL('../dist/assets/player-idle.json',import.meta.url)));

// The hero on its own, with the shared puppet clock the diorama borrows.
async function stage(stopMotion){
  const world={reducedMotion:false,stopMotion,puppetClock:createPuppetClock()};
  const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,
    mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
  w.character=createHero(w);w.scene.add(w.character.root);
  attachHero(w,await readPlayer(),motion,idle);
  heroEvent(w.character,{type:'respawn'});
  // completion-scene.js hands animateHero this stub, which is what puts the
  // rig in its standing idle rather than into any gameplay state.
  const game={status:'menu',respawnTimer:0,flowerCelebration:null,
    player:{x:0,y:0,vx:0,vy:0,facing:1,groundId:'diorama',invuln:0,stunTime:0,stomping:false,stompWindup:0,skidding:false},
    level:{boss:null,platforms:[{id:'diorama',kind:'stone',x:-6,y:0,w:12,active:true}]}};
  // The two methods under test, off the real class — building the scene itself
  // would want a WebGL context, and neither method touches one.
  const scene={cheerBase:null,poseCheer:CompletionScene.prototype.poseCheer,
    clearCheer:CompletionScene.prototype.clearCheer};
  return {world,w,game,scene,c:w.character};
}
const degrees=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.dot(b))))*180/Math.PI;

// One frame of CompletionScene.update()'s hero half, in its real order.
function frame({world,w,game,scene,c},time,restore=true){
  const step=Math.min(1/60,.05);
  w.time=time;w.puppetClock=tickPuppets(world,step);
  if(restore)scene.clearCheer();
  animateHero(w,game,step);
  const raised=Math.min(1,time*2.2),sway=Math.sin(time*1.7)*.02;
  scene.poseCheer(c,raised*(1-.5*(1-raised)*(1-raised))+sway);
  return step;
}

for(const stopMotion of [true,false]){
  const s=await stage(stopMotion);
  const arms=['LeftArm','RightArm'].map(n=>s.c.asset.getObjectByName(n));
  assert(arms.every(b=>b?.isBone),'the rig exposes both upper arms');
  const down=arms.map(b=>b.quaternion.clone());
  let time=0,worstHeld=0,heldFrames=0,raisedTo=0;
  let previous=arms.map(b=>b.quaternion.clone());
  for(let i=0;i<600;i++){
    time+=frame(s,time);
    const now=arms.map(b=>b.quaternion.clone());
    // Past the half second the arms take to come up, the pose is settled.
    if(time>1){
      const moved=Math.max(...now.map((q,k)=>degrees(q,previous[k])));
      if(s.world.puppetClock.step===0){heldFrames++;worstHeld=Math.max(worstHeld,moved);}
      raisedTo=Math.max(raisedTo,Math.max(...now.map((q,k)=>degrees(q,down[k]))));
    }
    previous=now;
  }
  if(stopMotion)assert(heldFrames>300,`stop motion holds most frames (${heldFrames})`);
  assert(worstHeld<1,`arms hold still while the pose is held, stop motion ${stopMotion} (worst ${worstHeld.toFixed(2)}deg)`);
  assert(raisedTo>60,`and the cheer still raises them, stop motion ${stopMotion} (${raisedTo.toFixed(0)}deg)`);
  console.log(`PASS the cheer holds instead of winding up, stop motion ${stopMotion?'on':'off'} (${worstHeld.toFixed(2)}deg on ${heldFrames} held frames)`);
}

// Without the restore the old fault comes straight back: a whole arm swing on
// a frame that should not have moved at all.
{
  const s=await stage(true);
  const arm=s.c.asset.getObjectByName('LeftArm');
  let time=0,worstHeld=0,previous=arm.quaternion.clone();
  for(let i=0;i<600;i++){
    time+=frame(s,time,false);
    if(time>1&&s.world.puppetClock.step===0)worstHeld=Math.max(worstHeld,degrees(arm.quaternion,previous));
    previous=arm.quaternion.clone();
  }
  assert(worstHeld>60,`the guard above is measuring the real fault (${worstHeld.toFixed(1)}deg)`);
  console.log(`PASS skipping the restore reproduces the wind-up (${worstHeld.toFixed(0)}deg on a held frame)`);
}

// Handing the rig back to the game takes the cheer off it, so the in-game hero
// does not keep raised arms through however long the next pose is held for.
{
  const s=await stage(true);
  const arm=s.c.asset.getObjectByName('LeftArm');
  let time=0;
  for(let i=0;i<120;i++)time+=frame(s,time);
  const cheering=arm.quaternion.clone();
  s.scene.clearCheer();
  assert(degrees(arm.quaternion,cheering)>20,'clearing the cheer puts the arm back down');
  assert.equal(s.scene.cheerBase,null,'and forgets what it restored, so it cannot be applied twice');
  s.scene.clearCheer();
  console.log('PASS the cheer comes off the rig when the screen hands it back');
}
