// How the hero is posed on the level-complete screen: arms raised in a cheer
// over a body that keeps breathing, standing on feet that do not move.
//
// --- the cheer ---------------------------------------------------------------
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
  // The methods under test, off the real class — building the scene itself
  // would want a WebGL context, and none of them touches one.
  const scene={cheerBase:null,stance:null,
    poseCheer:CompletionScene.prototype.poseCheer,
    clearCheer:CompletionScene.prototype.clearCheer,
    holdStance:CompletionScene.prototype.holdStance};
  return {world,w,game,scene,c:w.character};
}
const degrees=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.dot(b))))*180/Math.PI;

// One frame of CompletionScene.update()'s hero half, in its real order.
function frame({world,w,game,scene,c},time,{restore=true,hold=true}={}){
  const step=Math.min(1/60,.05);
  w.time=time;w.puppetClock=tickPuppets(world,step);
  if(restore)scene.clearCheer();
  animateHero(w,game,step);
  if(hold)scene.holdStance(c);
  const raised=Math.min(1,time*2.2),sway=Math.sin(time*1.7)*.02;
  scene.poseCheer(c,raised*(1-.5*(1-raised)*(1-raised))+sway);
  c.root.updateMatrixWorld(true);
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
    time+=frame(s,time,{restore:false});
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

// --- the stance ---------------------------------------------------------------
// The idle underneath is a gameplay idle: it rocks the weight from foot to foot
// and, after four seconds standing, plays a fidget over the top. Held as a
// celebration shot that reads as the feet wandering about. The lower body is
// pinned to the idle's opening frame so they do not, while the spine, arms and
// head go on breathing — a statue would pass the first half of this on its own.
{
  const travel=async(hold)=>{
    const s=await stage(true);
    const watch=['LeftFoot','RightFoot','LeftToeBase','RightToeBase','Spine','Head'];
    const bones=Object.fromEntries(watch.map(n=>[n,s.c.asset.getObjectByName(n)]));
    assert(watch.every(n=>bones[n]?.isBone),'the rig exposes the feet, the spine and the head');
    const seen=Object.fromEntries(watch.map(n=>[n,{lo:null,hi:null}]));
    let time=0;
    for(let i=0;i<30*60;i++){
      time+=frame(s,time,{hold});
      if(time<=1)continue;   // past the half second the arms take to come up
      for(const n of watch){
        const p=new THREE.Vector3();bones[n].getWorldPosition(p);
        const box=seen[n];
        box.lo=box.lo?box.lo.min(p):p.clone();box.hi=box.hi?box.hi.max(p):p.clone();
      }
    }
    return Object.fromEntries(watch.map(n=>{
      const d=seen[n].hi.clone().sub(seen[n].lo);
      return [n,Math.max(d.x,d.y,d.z)];
    }));
  };
  const loose=await travel(false),held=await travel(true);
  const feet=['LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
  const worstFoot=r=>Math.max(...feet.map(n=>r[n]));
  assert(worstFoot(loose)>.1,`the idle really does walk the feet about (${worstFoot(loose).toFixed(3)})`);
  // The registration wobble shifts the whole puppet a few thousandths of a unit
  // each exposure, feet and all. That is the clay, not the animation, so what
  // is asserted is that nothing beyond it is left.
  assert(worstFoot(held)<.01,`the feet stay put (${worstFoot(held).toFixed(4)})`);
  assert(held.Spine>.1&&held.Head>.1,
    `while the body goes on breathing above them (spine ${held.Spine.toFixed(3)}, head ${held.Head.toFixed(3)})`);
  console.log(`PASS the feet stay planted through the idle and its fidget (${(worstFoot(loose)*100).toFixed(0)}cm-ish → ${(worstFoot(held)*100).toFixed(1)}, spine still ${(held.Spine*100).toFixed(0)})`);
}

// The stance is copied on, never added, so re-running it on a held frame — or
// after the mixer has moved the legs — lands in the same place every time.
{
  const s=await stage(true);
  let time=0;
  for(let i=0;i<300;i++)time+=frame(s,time);
  const foot=s.c.asset.getObjectByName('LeftFoot');
  const once=foot.quaternion.clone();
  for(let i=0;i<5;i++)s.scene.holdStance(s.c);
  assert(degrees(foot.quaternion,once)<1e-6,'holding the stance again changes nothing');
  assert(s.scene.stance,'and the stance is kept for as long as the screen is up');
  console.log('PASS holding the stance is idempotent');
}
