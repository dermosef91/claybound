// Clay motion: a hand-posed alternative to the stock motion-capture clips.
//
// The clips the character ships with are humanoid mocap — Walking, Running,
// Regular_Jump, Face_Punch_Reaction_2 — played on a rounded clay figure with no
// elbows. People spotted that from a trailer, and asked for motion that
// "inherits the material's physical properties": squash, stretch, bend, and
// stop-motion timing rather than smooth interpolation.
//
// The pose is computed as plain numbers — degrees per joint, per axis — so the
// whole system can be read, tuned and tested without a renderer. Applying it to
// a skeleton is a separate step, and it happens after the mixer has run, so the
// stock clips remain the fallback and the base the pose is layered onto.

import * as THREE from './lib/three.module.js';

const DEG=Math.PI/180;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const clamp01=v=>clamp(v,0,1);
const ease=t=>t*t*(3-2*t);

// Everything a pose depends on. `phase` is the gait phase in [0,1); `swing` is
// how much of the body is in motion; `build` scales amplitude for a taller
// character so a big figure does not flail.
export const MOTION_DEFAULTS=Object.freeze({
  squash:1,      // how hard the body squashes and stretches
  lean:1,        // how far it leans into a run
  headLag:1,     // how much the head trails the body
  overshoot:1,   // how far a landing rebounds past rest
  fps:0,         // 0 = smooth; 12 or 8 = stop-motion, poses held
  stagger:0,     // per-joint frame offset, so held frames are not one strobe
  bend:1,        // how bendy the spine is
});

// Held frames are the whole point of stop motion: the pose does not move
// between them. A stagger spreads a joint's own frame boundary so the figure
// settles limb by limb rather than snapping as one rigid block.
export function quantise(time,fps,offset=0){
  if(!fps||fps<=0)return time;
  const t=Math.max(0,time)+offset/fps;
  return Math.floor(t*fps)/fps;
}

// Clay keeps its volume: stretched tall it narrows, squashed flat it spreads.
// Positive squash is compression — a landing — and negative is stretch, which
// is what a body does on the way up.
export function volumePreserved(squash){
  const sy=clamp(1-squash,.35,2.2),side=1/Math.sqrt(sy);
  return {x:side,y:sy,z:side};
}

// A damped spring, used for the parts of a clay body that arrive late.
export function lagStep(state,target,dt,{stiffness=150,damping=17}={}){
  // A single bad number must not leave the head stuck out of the body forever,
  // so the goal and the carried state are both sanitised on the way in.
  const goal=Number.isFinite(target)?target:0;
  const value=Number.isFinite(state.value)?state.value:goal;
  const velocity=Number.isFinite(state.velocity)?state.velocity:0;
  const step=Math.min(Math.max(0,dt),1/30);
  const accel=-stiffness*(value-goal)-damping*velocity;
  state.velocity=velocity+accel*step;
  state.value=value+state.velocity*step;
  if(!Number.isFinite(state.value)){state.value=goal;state.velocity=0;}
  return state.value;
}

// --- the pose vocabulary ----------------------------------------------------
// Angles are degrees. pitch swings a joint forward or back, side bends it
// sideways, twist rotates it about its own length. A pose is a plain object
// keyed by joint name, so it prints, diffs and asserts.

export const SPINE=['Spine','Spine01','Spine02'];
export const ARMS=['LeftArm','RightArm'];
export const FOREARMS=['LeftForeArm','RightForeArm'];
export const LEGS=['LeftUpLeg','RightUpLeg'];
export const KNEES=['LeftLeg','RightLeg'];
export const FEET=['LeftFoot','RightFoot'];

const add=(pose,bone,axis,value)=>{
  if(!value)return;
  (pose[bone]??={pitch:0,side:0,twist:0})[axis]+=value;
};
// A curl shared down the spine reads as one bend rather than three hinges,
// with the most of it high up where a clay body actually folds.
const curl=(pose,degrees,share=[.22,.34,.44])=>SPINE.forEach((b,i)=>add(pose,b,'pitch',degrees*share[i]));

export function clayPose(state={},options={}){
  const o={...MOTION_DEFAULTS,...options};
  const {mode='idle',phase=0,speed=0,vy=0,time=0,build=1,landing=0,hurt=0}=state;
  const pose={};
  const amp=1/Math.max(.75,build);
  const run=clamp01(speed/5);
  const p=((phase%1)+1)%1,wave=Math.sin(p*TAU),counter=Math.sin(p*TAU+Math.PI);
  let squash=0;

  if(mode==='idle'){
    // Breath, and weight rocking from one foot to the other. Nothing else: a
    // clay figure at rest is still, it just is not rigid.
    const breath=Math.sin(time*1.9),rock=Math.sin(time*.8);
    curl(pose,breath*2.2*o.bend*amp);
    add(pose,'Hips','side',rock*1.6*amp);
    add(pose,'Hips','pitch',breath*-1.1*amp);
    for(const [i,arm] of ARMS.entries())add(pose,arm,'pitch',breath*2.4*(i?-1:1)*amp);
    add(pose,'Head','pitch',breath*-1.8*o.headLag*amp);
    squash=breath*.014*o.squash;
  }

  if(mode==='run'){
    // Forward lean, a spine that bends rather than hinges, and limbs that
    // overlap the body instead of arriving with it.
    const drive=ease(run);
    add(pose,'Hips','pitch',14*drive*o.lean*amp);
    curl(pose,-8*drive*o.bend*amp);
    add(pose,'Hips','side',wave*3.2*drive*amp);
    // Arms oppose the legs, and the forearm trails its own upper arm.
    add(pose,'LeftArm','pitch',wave*40*drive*amp);
    add(pose,'RightArm','pitch',counter*40*drive*amp);
    add(pose,'LeftForeArm','pitch',(26+wave*18)*drive*amp);
    add(pose,'RightForeArm','pitch',(26+counter*18)*drive*amp);
    add(pose,'LeftUpLeg','pitch',counter*38*drive*amp);
    add(pose,'RightUpLeg','pitch',wave*38*drive*amp);
    add(pose,'LeftLeg','pitch',Math.max(0,-counter)*58*drive*amp);
    add(pose,'RightLeg','pitch',Math.max(0,-wave)*58*drive*amp);
    add(pose,'LeftFoot','pitch',counter*14*drive*amp);
    add(pose,'RightFoot','pitch',wave*14*drive*amp);
    // Two bounces per stride, the way a weighted body rises on each push.
    squash=Math.sin(p*TAU*2)*.05*drive*o.squash;
    add(pose,'Head','pitch',-9*drive*o.headLag*amp);
  }

  if(mode==='rise'){
    // Stretch. The body is longest at takeoff and relaxes towards the apex.
    const push=clamp01(vy/11);
    squash=-(.10+.12*push)*o.squash;
    curl(pose,-10*push*o.bend*amp);
    for(const arm of ARMS)add(pose,arm,'pitch',-104*push*amp);
    for(const fore of FOREARMS)add(pose,fore,'pitch',-16*push*amp);
    for(const leg of LEGS)add(pose,leg,'pitch',20*push*amp);
    for(const knee of KNEES)add(pose,knee,'pitch',26*push*amp);
    add(pose,'Head','pitch',-6*push*o.headLag*amp);
  }

  if(mode==='fall'){
    // Reaching. Arms up and out, legs feeling for the ground below.
    const drop=clamp01(-vy/16);
    squash=-.03*o.squash;
    curl(pose,7*drop*o.bend*amp);
    for(const arm of ARMS)add(pose,arm,'pitch',-64-26*drop*amp);
    for(const fore of FOREARMS)add(pose,fore,'pitch',-30*amp);
    for(const leg of LEGS)add(pose,leg,'pitch',-16*drop*amp);
    for(const knee of KNEES)add(pose,knee,'pitch',18*drop*amp);
    add(pose,'Head','pitch',5*drop*o.headLag*amp);
  }

  if(mode==='land'){
    // Compression past rest, then a rebound that overshoots the other way —
    // the single most clay-like thing a body can do.
    // `landing` counts down from 1 at the moment of impact to 0 when recovered,
    // the way hero.js already tracks it, so the deepest fold is at 1.
    const fold=clamp01(landing);
    const rebound=Math.sin(clamp01((.55-fold)/.55)*Math.PI)*.10*o.overshoot;
    squash=(.30*fold-rebound)*o.squash;
    curl(pose,26*fold*o.bend*amp);
    add(pose,'Hips','pitch',12*fold*amp);
    for(const knee of KNEES)add(pose,knee,'pitch',66*fold*amp);
    for(const leg of LEGS)add(pose,leg,'pitch',-34*fold*amp);
    for(const [i,arm] of ARMS.entries())add(pose,arm,'pitch',-52*fold*(i?1:1)*amp);
    for(const [i,arm] of ARMS.entries())add(pose,arm,'side',18*fold*(i?-1:1)*amp);
    add(pose,'Head','pitch',16*fold*o.headLag*amp);
  }

  if(mode==='hurt'){
    // Struck clay folds away from the blow and keeps wobbling after it.
    // `hurt` also counts down from 1, so the recoil is hardest as it lands and
    // the wobble outlives it.
    const shock=clamp01(hurt);
    const wobble=Math.sin(time*26)*Math.exp(-(1-shock)*2.4);
    squash=(.06*shock+wobble*.05)*o.squash;
    curl(pose,-30*shock*o.bend*amp);
    add(pose,'Hips','pitch',-14*shock*amp);
    for(const [i,arm] of ARMS.entries())add(pose,arm,'pitch',-70*shock*amp);
    for(const [i,arm] of ARMS.entries())add(pose,arm,'side',24*shock*(i?-1:1)*amp);
    for(const knee of KNEES)add(pose,knee,'pitch',30*shock*amp);
    add(pose,'Head','pitch',(-24*shock+wobble*9)*o.headLag*amp);
  }

  return {pose,squash:clamp(squash,-.45,.45),scale:volumePreserved(clamp(squash,-.45,.45))};
}

// Which state the pose should be in, from the same signals the stock clips use.
export function motionMode({grounded=true,vy=0,speed=0,landing=0,hurt=0}={}){
  if(hurt>0)return 'hurt';
  if(!grounded)return vy>0?'rise':'fall';
  if(landing>0)return 'land';
  return speed>.12?'run':'idle';
}

// Every joint the system can touch, in the order a skeleton has to be walked
// (parents before children) for world-space application to be correct.
export const JOINTS=Object.freeze([
  'Hips',...SPINE,'neck','Head',
  'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
  'RightShoulder','RightArm','RightForeArm','RightHand',
  'LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase',
  'RightUpLeg','RightLeg','RightFoot','RightToeBase',
]);

// Stop motion. A held frame means the pose does not move between frames, so the
// clock the pose is sampled at is what gets quantised — and the gait phase is
// walked back to the same frame, or the limbs would keep sliding under a held
// body. `phaseRate` is how many gait cycles a second the caller is advancing.
export function heldState(state,options={}){
  const o={...MOTION_DEFAULTS,...options};
  if(!o.fps)return state;
  const time=quantise(state.time||0,o.fps);
  const back=(state.time||0)-time;
  return {...state,time,phase:(state.phase||0)-back*(state.phaseRate||0)};
}

// The pose on held frames. With a stagger, joints are split into three groups
// that read slightly different frame boundaries, so the figure settles limb by
// limb the way a hand-posed puppet does rather than strobing as one block.
export function heldPose(state,options={}){
  const o={...MOTION_DEFAULTS,...options};
  if(!o.fps)return clayPose(state,o);
  const base=clayPose(heldState(state,o),o);
  if(!o.stagger)return base;
  const pose={...base.pose};
  for(let group=1;group<3;group++){
    const shifted=clayPose(heldState({...state,time:(state.time||0)+group*o.stagger/o.fps},o),o);
    for(const [index,name] of JOINTS.entries())if(index%3===group&&shifted.pose[name])pose[name]=shifted.pose[name];
  }
  return {...base,pose};
}

// --- putting a pose on a skeleton ------------------------------------------
// Rotations are described in world axes — pitch swings forward, side bends
// sideways, twist turns about the body — because that is how the pose reads and
// how it can be written once for any rig whose joints share these names. Each
// world rotation is expressed in its joint's parent frame before it is applied,
// the way the flower celebration already solves its arms.

const PITCH=new THREE.Vector3(0,0,1),SIDE=new THREE.Vector3(1,0,0),TWIST=new THREE.Vector3(0,1,0);
const WORLD=new THREE.Quaternion(),PARENT=new THREE.Quaternion(),LOCAL=new THREE.Quaternion();

function turn(bone,axis,radians){
  if(!radians)return;
  WORLD.setFromAxisAngle(axis,radians);
  bone.parent.getWorldQuaternion(PARENT);
  LOCAL.copy(PARENT).invert().multiply(WORLD).multiply(PARENT);
  bone.quaternion.premultiply(LOCAL);
}

// Record what the mixer produced, so the next frame starts from the clips again
// rather than compounding this pose onto itself.
export function capturePose(bones){
  return JOINTS.map(name=>bones.get(name)).filter(Boolean).map(bone=>[bone,bone.quaternion.clone()]);
}
export function restorePose(base){for(const [bone,quaternion] of base||[])bone.quaternion.copy(quaternion);}

// `facing` flips the forward axis, so a character running left leans left.
export function applyClayPose(bones,{pose},{weight=1,facing=1}={}){
  if(weight<=0)return 0;
  let touched=0;
  for(const name of JOINTS){
    const joint=pose[name],bone=bones.get(name);
    if(!joint||!bone?.parent)continue;
    const w=weight*DEG;
    turn(bone,PITCH,(joint.pitch||0)*w*facing);
    turn(bone,SIDE,(joint.side||0)*w);
    turn(bone,TWIST,(joint.twist||0)*w*facing);
    // Children are solved against a parent that has already moved.
    bone.updateWorldMatrix(false,true);
    touched++;
  }
  return touched;
}

// Collect the joints this system can drive from any rig that uses these names.
export function collectJoints(root){
  const bones=new Map();
  root.traverse(object=>{if(object.isBone&&JOINTS.includes(object.name)&&!bones.has(object.name))bones.set(object.name,object);});
  return bones;
}
