import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';
import {FLOWER_CELEBRATION_DURATION} from './simulation.js';

const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export const flowerEnvelope=time=>smooth(time/.4)*smooth((FLOWER_CELEBRATION_DURATION-time)/.4);

// A soft radial aura made in geometry: no texture download or postprocess pass.
function aura(){
  const positions=[0,0,0],colors=[1,.67,.12],alpha=[.38],indices=[];
  for(let i=0;i<=48;i++){const a=i*Math.PI*2/48;positions.push(Math.cos(a),Math.sin(a),0);colors.push(1,.65,.09);alpha.push(0);if(i<48)indices.push(0,i+1,i+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('alpha',new THREE.Float32BufferAttribute(alpha,1));g.setIndex(indices);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{strength:{value:1}},vertexShader:'attribute vec3 color; attribute float alpha; varying vec3 tint; varying float opacity; void main(){tint=color;opacity=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float strength; varying vec3 tint; varying float opacity; void main(){gl_FragColor=vec4(tint,opacity*strength);}'});
  return new THREE.Mesh(g,material);
}

export function createFlowerCelebration(c,w){
  const root=new THREE.Group();root.name='Flower pickup celebration';root.visible=false;c.facing.add(root);
  const cream=new THREE.MeshStandardMaterial({color:0xffe9a2,roughness:.85,emissive:0xffc43c,emissiveIntensity:.75});
  const orange=new THREE.MeshStandardMaterial({color:0xf58b20,roughness:.86,emissive:0xef6d13,emissiveIntensity:.25});
  const stemMat=new THREE.MeshStandardMaterial({color:0xd6a339,roughness:.9,emissive:0xa95b12,emissiveIntensity:.15});
  for(const material of [cream,orange,stemMat])clayMaterial(w,material,.055);
  const ball=new THREE.SphereGeometry(1,24,16);
  const bead=(x,y,sx,sy,sz,mat)=>{const m=new THREE.Mesh(ball,mat);m.position.set(x,y,0);m.scale.set(sx,sy,sz);root.add(m);return m;};
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+Math.PI/2;bead(Math.cos(a)*.23,Math.sin(a)*.23,.145,.15,.10,cream);}
  bead(0,0,.14,.14,.12,orange).position.z=.055;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.45,10),stemMat);stem.position.set(0,-.32,-.025);root.add(stem);
  const glow=aura();glow.position.z=-.14;glow.scale.setScalar(1.15);root.add(glow);
  const starShape=new THREE.Shape();starShape.moveTo(0,.11);starShape.lineTo(.028,.028);starShape.lineTo(.08,0);starShape.lineTo(.028,-.028);starShape.lineTo(0,-.11);starShape.lineTo(-.028,-.028);starShape.lineTo(-.08,0);starShape.lineTo(-.028,.028);starShape.closePath();
  const starGeo=new THREE.ShapeGeometry(starShape),starMat=new THREE.MeshBasicMaterial({color:0xffe49a,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const stars=Array.from({length:7},(_,i)=>{const m=new THREE.Mesh(starGeo,starMat);root.add(m);return m;});
  const light=new THREE.PointLight(0xffcb65,2.2,4,2);light.position.z=.5;root.add(light);
  const chains=['Left','Right'].map(side=>['Shoulder','Arm','ForeArm','Hand'].map(part=>c.asset.getObjectByName(side+part)));
  return {root,glow,stars,light,chains,head:c.asset.getObjectByName('Head')};
}

// Solve the supplied three-joint arms in world space, retaining the original
// bone lengths. Both actual hands converge on the same short flower stem.
function reach(chain,target,weight){
  const joints=chain.slice(0,3),hand=chain[3],saved=joints.map(b=>b.quaternion.clone());
  const origin=new THREE.Vector3(),tip=new THREE.Vector3(),goal=new THREE.Vector3(),parent=new THREE.Quaternion(),rotation=new THREE.Quaternion();
  for(let pass=0;pass<12;pass++)for(let i=2;i>=0;i--){
    const bone=joints[i];bone.getWorldPosition(origin);hand.getWorldPosition(tip);tip.sub(origin).normalize();goal.copy(target).sub(origin).normalize();
    rotation.setFromUnitVectors(tip,goal);bone.parent.getWorldQuaternion(parent);
    rotation.premultiply(parent.clone().invert()).multiply(parent);bone.quaternion.premultiply(rotation);bone.updateWorldMatrix(false,true);
  }
  joints.forEach((bone,i)=>bone.quaternion.slerpQuaternions(saved[i],bone.quaternion.clone(),weight));
}

export function animateFlowerCelebration(c,game,w){
  const reducedMotion=w.reducedMotion;
  const reward=game.flowerCelebration;
  if(!c.flower&&!reward)return;
  if(!c.flower)c.flower=createFlowerCelebration(c,w);
  const f=c.flower;f.root.visible=!!reward;if(!reward)return;
  f.basePose=[...f.chains.flatMap(chain=>chain.slice(0,3)),f.head].filter(Boolean).map(bone=>[bone,bone.quaternion.clone()]);
  const amount=flowerEnvelope(reward.time);
  c.root.rotation.y=THREE.MathUtils.lerp(c.turn,-Math.PI/2+1.0,amount);
  c.body.rotation.z*=1-amount;c.body.scale.lerp(new THREE.Vector3(1,1,1),amount);
  c.root.updateMatrixWorld(true);
  f.chains.forEach((chain,i)=>reach(chain,c.facing.localToWorld(new THREE.Vector3(i===0?.10:-.10,1.48,.38)),amount));
  if(f.head)f.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.18*amount));
  c.root.updateMatrixWorld(true);
  const left=f.chains[0][3].getWorldPosition(new THREE.Vector3()),right=f.chains[1][3].getWorldPosition(new THREE.Vector3());
  const grip=c.facing.worldToLocal(left.add(right).multiplyScalar(.5));
  f.root.position.copy(grip).add(new THREE.Vector3(0,.40,.045));f.root.scale.setScalar(amount);f.root.rotation.y=-.8;
  f.glow.material.uniforms.strength.value=reducedMotion?.85:1+Math.sin(reward.time*5)*.12;
  f.light.intensity=amount*.9;
  f.stars.forEach((star,i)=>{const a=i*Math.PI*2/7+(reducedMotion?0:reward.time*.18),r=.57+(i%3)*.10;star.position.set(Math.cos(a)*r,Math.sin(a)*r,.03);star.scale.setScalar(reducedMotion?.65:.55+.35*Math.sin(reward.time*4+i*1.7)**2);});
}
