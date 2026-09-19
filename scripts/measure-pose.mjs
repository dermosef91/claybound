// The numbers behind a stance, for judging a retarget before rendering it:
// where each hand points and how far the wrist bends, how wide the feet stand
// and which way the toes turn, how much each knee bows, all in the rig's own
// frame and as fractions of the character's declared height so the cast can be
// read side by side. Not part of the check.
//
// Usage: [STATE=idle] [PHASE=0] node scripts/measure-pose.mjs [ID...]
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero} from '../dist/hero.js';
import {characterChoice} from '../dist/characters.js';
import {readGLB} from '../tests/load-player.mjs';

const url=name=>new URL('../dist/assets/'+name,import.meta.url);
const json=name=>readFile(url(name),'utf8').then(JSON.parse);
const ids=process.argv.slice(2).length?process.argv.slice(2):['clay','emberleaf','apprentice','explorer'];
const state=process.env.STATE||'idle',phase=Number(process.env.PHASE||0);
const P=o=>o.getWorldPosition(new THREE.Vector3());
const dir=(a,b)=>P(b).sub(P(a)).normalize();
const deg=r=>(r*180/Math.PI).toFixed(1);
const fmt=v=>`(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`;
for(const id of ids){
  const choice=characterChoice(id);
  const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
  w.character=createHero(w);w.scene.add(w.character.root);
  attachHero(w,await readGLB(url(choice.model)),await json(choice.motion),await json(choice.animation),choice);
  const c=w.character;for(const a of Object.values(c.actions))a.stop();
  const clip=c.clips[state],action=c.actions[state];action.reset().play().setEffectiveWeight(1);action.time=clip.duration*phase;c.mixer.update(0);c.root.updateMatrixWorld(true);
  // Model space: the facing group turns the model to face +x; undo it so numbers read in the rig's own frame (z toward the camera... facing group only).
  const inv=c.facing.matrixWorld.clone().invert();
  const L=o=>o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const g=name=>c.asset.getObjectByName(name);
  const h=choice.height;
  console.log(`\n== ${choice.name} (${state} @${phase})`);
  for(const side of ['Left','Right']){
    const arm=g(side+'Arm'),fore=g(side+'ForeArm'),hand=g(side+'Hand');
    const upper=L(fore).sub(L(arm)).normalize(),lower=L(hand).sub(L(fore)).normalize();
    const elbow=Math.acos(THREE.MathUtils.clamp(upper.dot(lower),-1,1));
    // The hand bone's own axes, in model space: which way is bone-Y (length), and where its Z points (palm-ish).
    const q=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(c.facing.getWorldQuaternion(new THREE.Quaternion()).invert());
    const hy=new THREE.Vector3(0,1,0).applyQuaternion(q),hz=new THREE.Vector3(0,0,1).applyQuaternion(q),hx=new THREE.Vector3(1,0,0).applyQuaternion(q);
    const tip=g(side+'HandMiddle4');
    const wristBend=Math.acos(THREE.MathUtils.clamp(lower.dot(hy),-1,1));
    console.log(`${side} arm: upper ${fmt(upper)} lower ${fmt(lower)} elbow ${deg(elbow)}°  hand@${fmt(L(hand).divideScalar(h))}  handY ${fmt(hy)} handZ ${fmt(hz)} handX ${fmt(hx)} wristBend ${deg(wristBend)}°${tip?` finger ${fmt(L(tip).sub(L(hand)).normalize())}`:''}`);
  }
  const lf=L(g('LeftFoot')),rf=L(g('RightFoot')),lt=L(g('LeftToeBase')),rt=L(g('RightToeBase')),lh=L(g('LeftUpLeg')),rh=L(g('RightUpLeg'));
  console.log(`hips width ${(lh.distanceTo(rh)/h).toFixed(3)}h  ankle spread ${(Math.abs(lf.x-rf.x)/h).toFixed(3)}h  toe spread ${(Math.abs(lt.x-rt.x)/h).toFixed(3)}h  ankle z L ${(lf.z/h).toFixed(3)} R ${(rf.z/h).toFixed(3)}`);
  const ltoe=lt.clone().sub(lf),rtoe=rt.clone().sub(rf);
  console.log(`toe yaw L ${deg(Math.atan2(ltoe.x,ltoe.z))}° R ${deg(Math.atan2(rtoe.x,rtoe.z))}°  (0 = straight ahead, + = to the rig's +x)`);
  for(const side of ['Left','Right']){
    const up=L(g(side+'UpLeg')),knee=L(g(side+'Leg')),ank=L(g(side+'Foot'));
    const thigh=knee.clone().sub(up).normalize(),shin=ank.clone().sub(knee).normalize();
    console.log(`${side} leg: thigh ${fmt(thigh)} shin ${fmt(shin)} knee ${deg(Math.acos(THREE.MathUtils.clamp(thigh.dot(shin),-1,1)))}°`);
  }
  const hips=L(g('Hips')),head=L(g('Head'));
  console.log(`hips@${fmt(hips.divideScalar(h))} head@${fmt(head.divideScalar(h))}`);
}
