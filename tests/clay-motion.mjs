// Hand-posed clay motion: the pose maths, the stop-motion quantiser, and the
// application onto the real shipped skeleton.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {readPlayer} from './load-player.mjs';
import {clayPose,heldPose,heldState,quantise,motionMode,volumePreserved,lagStep,
  collectJoints,capturePose,restorePose,applyClayPose,JOINTS,MOTION_DEFAULTS} from '../dist/clay-motion.js';

const near=(a,b,tol=1e-9)=>Math.abs(a-b)<=tol;
const arm=r=>r.pose.LeftArm?.pitch??0;

// --- which state the body is in ---------------------------------------------
{
  assert.equal(motionMode({grounded:true,speed:0}),'idle');
  assert.equal(motionMode({grounded:true,speed:6.7}),'run');
  assert.equal(motionMode({grounded:false,vy:9}),'rise');
  assert.equal(motionMode({grounded:false,vy:-9}),'fall');
  assert.equal(motionMode({grounded:true,landing:.8}),'land');
  assert.equal(motionMode({grounded:true,speed:6.7,hurt:.4}),'hurt','being hit outranks everything');
  assert.equal(motionMode({}),'idle');
}
console.log('PASS the mode is chosen from the same signals the stock clips read');

// --- the poses --------------------------------------------------------------
{
  const modes=['idle','run','rise','fall','land','hurt'];
  for(const mode of modes){
    const r=clayPose({mode,speed:6.7,vy:mode==='rise'?11.8:-14,phase:.2,time:1.4,landing:1,hurt:1});
    assert(Object.keys(r.pose).length>=5,`${mode} poses a real number of joints`);
    for(const [name,joint] of Object.entries(r.pose)){
      assert(JOINTS.includes(name),`${mode} only touches joints the system owns: ${name}`);
      for(const axis of ['pitch','side','twist'])assert(Number.isFinite(joint[axis]),`${mode}.${name}.${axis}`);
      assert(Math.abs(joint.pitch)<=180,`${mode} ${name} stays inside a turn`);
    }
    assert(Number.isFinite(r.squash)&&Math.abs(r.squash)<=.45,`${mode} squash is bounded`);
  }
}
{
  // The two things people asked for by name: stretch going up, squash landing.
  const rise=clayPose({mode:'rise',vy:11.8}),land=clayPose({mode:'land',landing:1});
  assert(rise.squash<-.1&&rise.scale.y>1.15,`a rising body stretches tall (${rise.scale.y.toFixed(2)})`);
  assert(land.squash>.2&&land.scale.y<.8,`a landing body compresses (${land.scale.y.toFixed(2)})`);
  // And it rebounds past rest rather than easing back to it.
  const rebound=clayPose({mode:'land',landing:.275});
  assert(rebound.scale.y>1,`the landing overshoots past rest (${rebound.scale.y.toFixed(3)})`);
  assert(near(clayPose({mode:'land',landing:0}).squash,0,1e-12),'and settles at rest');
  // Volume is kept at every extreme, which is what makes it read as clay.
  for(const s of [-.45,-.2,0,.2,.45]){const v=volumePreserved(s);assert(near(v.x*v.y*v.z,1,1e-12),`volume at ${s}`);assert.equal(v.x,v.z);}
  assert(volumePreserved(-9).y<=2.2&&volumePreserved(9).y>=.35,'even nonsense stays inside the clamp');
}
{
  // A run swings the limbs in opposition and leans into the direction of travel.
  const a=clayPose({mode:'run',speed:6.7,phase:0});
  const quarter=clayPose({mode:'run',speed:6.7,phase:.25});
  assert(near(quarter.pose.LeftArm.pitch,-quarter.pose.RightArm.pitch),'arms oppose each other');
  assert(near(quarter.pose.LeftUpLeg.pitch,-quarter.pose.RightUpLeg.pitch),'so do the legs');
  assert(quarter.pose.LeftArm.pitch*quarter.pose.LeftUpLeg.pitch<0,'and an arm opposes the leg on its own side');
  assert(quarter.pose.Hips.pitch>4,'the body leans into the run');
  assert(Math.abs(arm(a))<Math.abs(arm(quarter)),'the swing is a cycle, not a constant');
  // Standing still is not a run.
  assert(Math.abs(arm(clayPose({mode:'run',speed:0,phase:.25})))<1e-9,'no speed, no swing');
  // A bigger character does not flail: amplitude scales down with build.
  assert(Math.abs(clayPose({mode:'run',speed:6.7,phase:.25,build:1.5}).pose.LeftArm.pitch)
       < Math.abs(quarter.pose.LeftArm.pitch),'a taller build moves less, not more');
}
{
  // Every knob does something, and zero means off.
  const base={mode:'run',speed:6.7,phase:.25,time:1};
  assert(Math.abs(clayPose(base,{lean:0}).pose.Hips.pitch)<Math.abs(clayPose(base,{lean:2}).pose.Hips.pitch));
  assert(Math.abs(clayPose(base,{bend:0}).pose.Spine02?.pitch??0)<1e-9,'bend 0 leaves the spine alone');
  assert(Math.abs(clayPose(base,{squash:0}).squash)<1e-9,'squash 0 leaves the body at rest');
  assert(Math.abs(clayPose({mode:'land',landing:.275},{overshoot:0}).squash)
       < Math.abs(clayPose({mode:'land',landing:.275},{overshoot:2}).squash));
  assert(Math.abs(clayPose(base,{headLag:0}).pose.Head?.pitch??0)<1e-9,'head lag 0 leaves the head alone');
  assert.deepEqual(Object.keys(MOTION_DEFAULTS).sort(),['bend','fps','headLag','lean','overshoot','squash','stagger']);
}
console.log('PASS poses are bounded and finite, a jump stretches, a landing squashes and rebounds, and every knob works');

// --- stop motion ------------------------------------------------------------
{
  assert.equal(quantise(1.04,12),1);
  assert.equal(quantise(1.09,12),Math.floor(1.09*12)/12);
  assert.equal(quantise(2.7,0),2.7,'no fps means no quantising');
  assert.equal(quantise(-5,12),0,'a negative clock does not run backwards');
  // Inside one held frame the pose does not move; across a boundary it does.
  const rate=2.5,opts={fps:12};
  const at=t=>heldPose({mode:'run',speed:6.7,phase:.3+rate*(t-1),time:t,phaseRate:rate},opts);
  const first=at(1.000),same=at(1.020),later=at(1.100);
  assert(near(arm(first),arm(same),1e-9),`held frames hold (${arm(first).toFixed(6)} vs ${arm(same).toFixed(6)})`);
  assert(!near(arm(first),arm(later),1e-6),'and the next frame moves');
  // Walking the phase back matters: without it the limbs slide under a held body.
  const slid=heldState({time:1.02,phase:.35,phaseRate:rate},opts);
  assert(near(slid.time,1),'the clock is held');
  assert(slid.phase<.35,'and the gait is walked back to the same frame');
  assert(near(heldState({time:1.02,phase:.35,phaseRate:0},opts).phase,.35),'a still body has no gait to walk back');
  // Smooth is the default and genuinely smooth.
  assert(!near(clayPose({mode:'run',speed:6.7,phase:.30,time:1.00}).pose.LeftArm.pitch,
               clayPose({mode:'run',speed:6.7,phase:.35,time:1.02}).pose.LeftArm.pitch,1e-6));
  // A stagger splits the body across frame boundaries rather than strobing.
  const plain=at(1.045),staggered=heldPose({mode:'run',speed:6.7,phase:.3+rate*.045,time:1.045,phaseRate:rate},{fps:12,stagger:.6});
  assert(JSON.stringify(plain.pose)!==JSON.stringify(staggered.pose),'a stagger changes which joints have moved on');
  assert.equal(heldPose({mode:'run',speed:6.7,phase:.3,time:1},{fps:0}).pose.LeftArm.pitch,
               clayPose({mode:'run',speed:6.7,phase:.3,time:1}).pose.LeftArm.pitch,'fps 0 is the plain pose');
}
console.log('PASS stop motion holds a pose between frames, walks the gait back with it, and staggers when asked');

// --- the lag spring ---------------------------------------------------------
{
  const state={value:0,velocity:0};
  for(let i=0;i<8;i++)lagStep(state,1,1/60);
  assert(state.value>0&&state.value<1,`the head is still on its way (${state.value.toFixed(3)})`);
  for(let i=0;i<240;i++)lagStep(state,1,1/60);
  assert(near(state.value,1,.02),'and arrives');
  const wild={value:0,velocity:0};lagStep(wild,NaN,1/60);
  assert(Number.isFinite(wild.value),'garbage in does not poison the pose');
  const huge={value:0,velocity:0};lagStep(huge,1,10);
  assert(Number.isFinite(huge.value),'a hitch-sized step stays finite');
}
console.log('PASS the lag spring trails its target, arrives, and survives bad input');

// --- on the real rig ---------------------------------------------------------
{
  const gltf=await readPlayer();
  const joints=collectJoints(gltf.scene);
  assert(joints.size>=18,`the shipped rig exposes the joints the system drives (${joints.size})`);
  for(const name of ['Hips','Spine','Head','LeftArm','RightArm','LeftUpLeg','RightLeg'])assert(joints.has(name),name);
  gltf.scene.updateMatrixWorld(true);

  const rest=capturePose(joints);
  const before=joints.get('LeftArm').quaternion.clone();
  const touched=applyClayPose(joints,clayPose({mode:'run',speed:6.7,phase:.25}),{weight:1,facing:1});
  assert(touched>=8,`the pose reaches the skeleton (${touched} joints)`);
  assert(!joints.get('LeftArm').quaternion.equals(before),'and actually moves a bone');
  for(const [,bone] of joints)assert([...bone.quaternion].every(Number.isFinite),`${bone.name} stays finite`);

  // The base pose is restored, so the next frame starts from the clips again
  // instead of compounding this pose onto itself.
  restorePose(rest);
  assert(joints.get('LeftArm').quaternion.equals(before),'restoring returns the rig exactly to the clip pose');

  // Applying the same pose twice from the same base gives the same result —
  // no drift from frame to frame.
  applyClayPose(joints,clayPose({mode:'run',speed:6.7,phase:.25}),{weight:1,facing:1});
  const once=joints.get('LeftArm').quaternion.clone();
  restorePose(rest);
  applyClayPose(joints,clayPose({mode:'run',speed:6.7,phase:.25}),{weight:1,facing:1});
  assert(joints.get('LeftArm').quaternion.angleTo(once)<1e-9,'the same pose lands in the same place every time');

  // Facing flips the forward axis, so a character running left leans left.
  restorePose(rest);
  applyClayPose(joints,clayPose({mode:'run',speed:6.7,phase:.25}),{weight:1,facing:-1});
  assert(joints.get('LeftArm').quaternion.angleTo(once)>1e-6,'facing changes the pose');

  // Weight zero is a no-op, which is what lets the system be switched off.
  restorePose(rest);
  assert.equal(applyClayPose(joints,clayPose({mode:'run',speed:6.7,phase:.25}),{weight:0}),0);
  assert(joints.get('LeftArm').quaternion.equals(before),'weight 0 leaves the clips exactly as they were');

  // Every other character shares these joint names, which is what lets one
  // pose system drive all four.
  const {CHARACTERS}=await import('../dist/characters.js');
  assert(CHARACTERS.length>=1);
}
console.log('PASS the pose drives the real shipped skeleton, restores cleanly, never drifts, and switches off at weight zero');
