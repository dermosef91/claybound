import * as THREE from './lib/three.module.js';
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
export function createGrowths(w,pose){
  const mat=growthMaterials(w),bands=[];
  // The last central plug remains above the healthy cap until the third stomp.
  const specs=[{y:6.1,rx:3.5,ry:2.25,count:9},{y:6.25,rx:2.25,ry:1.2,count:7},{y:6.45,rx:.85,ry:.5,count:4}];
  for(const [band,s]of specs.entries()){
    const g=new THREE.Group();g.name='Swollen growth layer '+(band+1);pose.add(g);
    const sack=w.ball(s.rx,s.ry,s.rx*.67,mat.blush,g,0,s.y,-.05);
    for(let i=0;i<s.count;i++){
      const a=i*2.399,dx=Math.cos(a)*s.rx*.73,dz=Math.sin(a)*s.rx*.48;
      const r=band===0?.7+(i%3)*.13:band===1?.5:.27;
      w.ball(r,r*.9,r*.85,mat.sack,g,dx,s.y+s.ry*.45+Math.sin(i)*.2,dz);
      if(i%2===0)crust(w,g,dx,s.y+s.ry*.65,dz+.22,r*.95,i+band*9);
    }
    // Large dark plates lodged across the forehead; the cream face stays visible.
    for(let i=0;i<(band===0?5:2);i++){
      const x=(i-(band===0?2:.5))*(band===0?1.12:.8);
      crust(w,g,x,s.y-.25,s.rx*.58,.65/(band*.6+1),i+3);
    }
    bands.push({root:g,sack});
  }
  const debris=new THREE.Group();debris.name='Breaking clay fragments';pose.add(debris);
  for(let i=0;i<12;i++)crust(w,debris,0,0,0,.18+(i%3)*.06,i);
  return {bands,debris};
}
export function animateGrowths(view,b,reduced){
  const hit=b.state==='hurt'||b.state==='collapse',q=smooth(b.stateTime/.8);
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

export function createAfflictedClearing(w,root,b){
  const mat=growthMaterials(w),stone=new THREE.Group();stone.name='Rigid clay at the clearing';root.add(stone);
  // Low angular roots guide the approach, opening into the wide level floor.
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const x=b.x+side*(8+i*1.65),z=-4.7-(i%3)*.8;
    crust(w,stone,x,b.y+.2+(i%3)*.2,z,.8+(i%2)*.25,i+side);
  }
  for(const side of [-1,1]){
    const x=b.x+side*17.2;
    const pts=[[x,b.y-1,-5],[x-side*.6,b.y+3.5,-5.5],[x+side*.7,b.y+7.3,-6],[x-side*2,b.y+10.7,-6.2]];
    w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),12,.64,6,false),mat.crust,stone);
    for(let i=0;i<5;i++){
      const y=b.y+2+i*1.8;
      w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,y,-5.5),new THREE.Vector3(x-side*1.4,y+.6,-5.7),new THREE.Vector3(x-side*(2.3+i*.3),y+1.7,-5.5)]),8,.24,5,false),mat.crust,stone);
    }
  }
  const flowers=[];
  for(let i=0;i<23;i++){
    const x=b.x-18+i*1.6,z=i%2?1.7:-3.6,flower=new THREE.Group();flower.name='Closed clearing flower';flower.position.set(x,b.y+.03,z);root.add(flower);
    w.ball(.11,.32,.11,mat.stem,flower,0,.25,0);
    const petals=[];
    for(let j=0;j<5;j++){
      const pivot=new THREE.Group();pivot.position.y=.53;pivot.rotation.y=j*Math.PI*2/5;flower.add(pivot);
      const petal=w.ball(.15,.34,.1,j%2?mat.petal:mat.blush,pivot,0,.2,.06);petals.push({pivot,petal});
    }
    w.ball(.14,.13,.14,mat.sack,flower,0,.52,0);
    const grey=afflictBranch(flower,1);flowers.push({root:flower,petals,grey,x});
  }
  return {stone,flowers};
}
export function animateClearing(view,b){
  for(const f of view.flowers){
    const open=smooth((b.healing*23-Math.abs(f.x-b.x))/4);
    f.grey.value=1-open*.87;
    for(const {pivot}of f.petals)pivot.rotation.x=open*1.18;
    f.root.scale.setScalar(.72+open*.28);
  }
}
export function createFriendlySpores(w,root,b){
  const mat=growthMaterials(w),g=new THREE.Group();g.name='Friendly farewell spores';root.add(g);
  const parts=[];
  for(let i=0;i<42;i++){
    const m=w.ball(.16+(i%3)*.07,.2,.18,i%3===0?mat.blush:mat.sack,g);m.castShadow=false;m.userData.restScale=m.scale.clone();parts.push(m);
  }
  return {root:g,parts};
}
export function animateFriendly(v,b,reduced){
  const phase=b.state,t=b.stateTime;
  v.root.visible=['revive','regard','farewell','bloom'].includes(phase);
  for(const [i,m]of v.parts.entries()){
    const a=i*2.399;
    let age=phase==='revive'?t-i*.05:phase==='regard'?t-.7-i*.018:phase==='farewell'?t-i*.025:t+1.8-i*.025;
    const duration=phase==='revive'?1.8:phase==='regard'?.85:5;
    m.visible=age>=0&&age<duration&&(phase!=='regard'||i<9);
    age=Math.max(0,age);
    const spread=phase==='regard'?age*3:phase==='bloom'?age*4:age*1.8;
    m.position.set(b.x+(phase==='regard'?-spread:Math.cos(a)*spread),b.y+.9+Math.sin(a*1.3)*.5+age*(phase==='bloom'?.25:.65),.1+Math.sin(a)*spread*.5);
    m.scale.copy(m.userData.restScale).multiplyScalar(Math.max(.01,Math.min(1,age*5,(duration-age)*1.5))*(reduced?.65:1));
  }
}
