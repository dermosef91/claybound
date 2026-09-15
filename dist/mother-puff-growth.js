import * as THREE from './lib/three.module.js';
import {sporeCloud} from './spore-effects.js';
import {MOTHER_PUFF} from './mother-puff-rules.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};

// Per-instance uniforms preserve every texture and fingerprint. Nothing in
// the healthy forest or either retained GLB has its shared material changed.
export function afflictBranch(root,amount=1){
  const uniform={value:amount},copies=new Map();
  root.traverse(o=>{
    if(!o.isMesh)return;
    const convert=base=>{
      if(copies.has(base))return copies.get(base);
      const m=base.clone(),compile=base.onBeforeCompile,key=base.customProgramCacheKey();
      m.onBeforeCompile=(shader,renderer)=>{
        compile.call(base,shader,renderer);shader.uniforms.motherCorruption=uniform;
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float motherCorruption;')
          .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float motherGrey = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(motherGrey * 0.50 + 0.045), motherCorruption);`);
      };
      m.customProgramCacheKey=()=>key+'-mother-affliction-v1';copies.set(base,m);return m;
    };
    o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });return uniform;
}
export function growthMaterials(w){
  if(w.motherGrowthMaterials)return w.motherGrowthMaterials;
  const colors={crust:0x454347,crack:0x29282c,sack:0xead0a3,blush:0xcb887d,petal:0xf7d4a3,stem:0x7d956b};
  w.assetMaterials??=new Set();
  return w.motherGrowthMaterials=Object.fromEntries(Object.entries(colors).map(([k,color])=>{
    const m=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:k==='crust'});w.assetMaterials.add(m);return[k,m];
  }));
}
function crust(w,parent,x,y,z,size,seed){
  const mat=growthMaterials(w),root=new THREE.Group();root.position.set(x,y,z);root.rotation.set(.15*seed,.41*seed,.2*Math.sin(seed));parent.add(root);
  const plate=w.mesh(new THREE.IcosahedronGeometry(1,1),mat.crust,root);plate.scale.set(size,size*.75,size*.65);
  // Raised, discontinuous seams read as stiff cracked clay rather than spots.
  for(let i=0;i<2;i++){
    const pts=[[-.65,.25],[-.22,.13],[.02,-.08],[.4,-.18]].map(([a,b])=>new THREE.Vector3(a*size,(b+i*.3)*size,size*.59));
    w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),7,.023*size,4,false),mat.crack,root);
  }return root;
}
export function createGrowths(w,pose,model){
  const mat=growthMaterials(w),bands=[];
  // Anchor separate clay plugs to the actual cap surface, never a second cap.
  pose.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,0,1);
  const specs=[[[0,-.5,1.05],[-2.1,1.3,.78],[2,1.1,.86],[-1.15,2.05,.7],[1.25,2,.67],[-2.7,-.25,.64],[2.8,-.3,.72]],
    [[-.85,.15,.78],[1.05,.1,.74],[-1.65,1.7,.59],[1.9,1.5,.6],[-2,-1,.55],[2,-1,.59]],[[0,.75,.64]]];
  for(const [band,plugs]of specs.entries()){
    const g=new THREE.Group();g.name='Embedded clay plugs '+(band+1);pose.add(g);
    for(const [i,[x,z,r]]of plugs.entries()){
      ray.set(pose.localToWorld(new THREE.Vector3(x,12,z)),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(model,true)[0];if(!hit)continue;
      const point=pose.worldToLocal(hit.point.clone());if(point.y<4)continue;
      const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
      const plug=new THREE.Group();plug.name='Eroded clay lodged in a pore';plug.position.copy(point);plug.quaternion.setFromUnitVectors(up,normal);g.add(plug);
      // A dark recessed seam and a broken collar make the plug feel embedded.
      w.mesh(new THREE.TorusGeometry(r*.72,.045,6,19),mat.crack,plug,0,0,.018);
      const geo=new THREE.SphereGeometry(1,14,10),p=geo.attributes.position;
      for(let j=0;j<p.count;j++){
        const a=p.getX(j),b=p.getY(j),c=p.getZ(j),k=1+.12*Math.sin(a*9+c*5+i)+.075*Math.cos(b*11-a*4);
        p.setXYZ(j,a*k,b*k,c*k);
      }
      geo.computeVertexNormals();
      const stone=w.mesh(geo,mat.crust,plug,0,0,.08);stone.scale.set(r*.81,r*.74,r*.72);
      for(let j=0;j<3;j++){
        const a=j*2.2+i,chip=w.mesh(new THREE.IcosahedronGeometry(1,1),mat.crust,plug,Math.cos(a)*r*.63,Math.sin(a)*r*.56,.08);
        chip.scale.set(r*.32,r*.25,r*.31);
      }
      const line=[[-.5,.13,.52],[-.16,.1,.7],[.08,-.06,.74],[.42,-.2,.53]].map(p=>new THREE.Vector3(...p.map(v=>v*r)));
      w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line),8,.018,4,false),mat.crack,plug);
    }
    bands.push({root:g});
  }
  const debris=new THREE.Group();debris.name='Breaking clay fragments';pose.add(debris);
  for(let i=0;i<12;i++)crust(w,debris,0,0,0,.18+(i%3)*.06,i);
  return {bands,debris};
}

export function animateGrowths(view,b,reduced){
  const hit=b.state==='hurt'||b.state==='veil',q=smooth(b.stateTime/.8);
  for(const [i,band]of view.bands.entries()){
    const breaking=hit&&i===b.hits-1;
    band.root.visible=i>=b.hits||breaking&&q<1;
    band.root.scale.setScalar(breaking?Math.max(.001,1-q):1);
    band.root.position.y=breaking?q*6.5:0;
    const restless=!reduced&&b.hits>0&&b.hits<3?Math.sin(b.stateTime*9+i)*.018:0;
    band.root.rotation.z=restless;
  }
  view.debris.visible=hit&&b.stateTime<1.1&&!reduced;
  for(const [i,o]of view.debris.children.entries()){
    const a=i*2.399,t=b.stateTime;
    o.position.set(Math.cos(a)*(1+t*3),6.8+t*(2+i%3)-t*t*7,Math.sin(a)*(1+t*2));
    o.scale.setScalar(Math.max(.001,1-t/1.1));o.rotation.z=a+t*3;
  }
}

export function createFriendlySpores(w,root){
  const mat=new THREE.MeshStandardMaterial({color:0xffe8b0,roughness:1,transparent:true,opacity:.75,depthWrite:false});
  const g=new THREE.Group();g.name='Friendly spore billows';root.add(g);
  const parts=[];
  for(let i=0;i<15;i++){const m=sporeCloud(w,g,mat,.75);parts.push(m);}
  return {root:g,parts};
}
export function animateFriendly(v,b,reduced){
  const phase=b.state,t=b.stateTime;v.root.visible=['regard'].includes(phase);
  for(const [i,m]of v.parts.entries()){
    let age=phase==='revive'?t-i*.11:phase==='regard'?t-.7-i*.045:t-i*.075;
    const duration=phase==='regard'?.95:2.7;
    m.visible=age>=0&&age<duration&&(phase!=='regard'||i<4);age=Math.max(0,age);
    const a=i*2.399,spread=age*(phase==='regard'?2:1.8);
    m.position.set(b.x+(phase==='regard'?-spread:Math.cos(a)*spread),b.y+MOTHER_PUFF.friendlyHeight*.42+Math.sin(a)*.2+age*.55,.1+Math.sin(a)*spread*.4);
    m.scale.setScalar(Math.max(.001,Math.min(.9,age*4,(duration-age)*1.3))*(reduced?.7:1));
  }
}
