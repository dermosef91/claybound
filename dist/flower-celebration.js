import * as THREE from './lib/three.module.js';
import {clayMaterial} from './clay.js';
import {FLOWER_CELEBRATION_DURATION} from './simulation.js';

const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export const flowerEnvelope=time=>smooth(time/.1)*smooth((FLOWER_CELEBRATION_DURATION-time)/.12);

// Radiating gold light stays visible against the bright sky as well as caves.
// The halo is procedural, so it is ready on the first pickup without an image load.
function aura(){
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{strength:{value:1},time:{value:0}},
    vertexShader:'varying vec2 glowUv; void main(){glowUv=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float strength; uniform float time; varying vec2 glowUv;
      void main(){
        float r=length(glowUv),angle=atan(glowUv.y,glowUv.x);
        float edge=1.-smoothstep(.65,1.,r);
        float halo=exp(-r*r*5.)*.48;
        float rays=pow(abs(cos(angle*7.+time*.12)),16.)*.32*smoothstep(.15,.32,r)*edge;
        float inner=exp(-r*r*18.)*.4;
        gl_FragColor=vec4(1.,.62,.12,(halo+rays+inner)*edge*strength);
      }`
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.name='Golden flower radiance';return mesh;
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
  const glow=aura();glow.position.z=-.14;glow.scale.setScalar(1.4);root.add(glow);
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
  c.root.updateMatrixWorld(true);
  f.chains.forEach((chain,i)=>reach(chain,c.facing.localToWorld(new THREE.Vector3(i===0?.10:-.10,1.48,.38)),amount));
  if(f.head)f.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.18*amount));
  c.root.updateMatrixWorld(true);
  const left=f.chains[0][3].getWorldPosition(new THREE.Vector3()),right=f.chains[1][3].getWorldPosition(new THREE.Vector3());
  const grip=left.add(right).multiplyScalar(.5);
  f.root.position.copy(c.facing.worldToLocal(grip.add(new THREE.Vector3(0,.40,.045))));
  f.root.scale.setScalar(amount);
  // Face the flower toward the camera without turning the player or legs.
  f.root.quaternion.copy(c.facing.getWorldQuaternion(new THREE.Quaternion()).invert());
  f.glow.material.uniforms.strength.value=reducedMotion?1:1.15+Math.sin(reward.time*5)*.12;
  f.glow.material.uniforms.time.value=reducedMotion?0:reward.time;
  f.light.intensity=amount*.9;
  f.stars.forEach((star,i)=>{const a=i*Math.PI*2/7+(reducedMotion?0:reward.time*.18),r=.57+(i%3)*.10;star.position.set(Math.cos(a)*r,Math.sin(a)*r,.03);star.scale.setScalar(reducedMotion?.65:.55+.35*Math.sin(reward.time*4+i*1.7)**2);});
}
