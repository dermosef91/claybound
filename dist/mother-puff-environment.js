import * as THREE from './lib/three.module.js';
import {forestModel} from './forest.js';
import {forestBloom} from './forest-details.js';
import {porousClay} from './porous-clay.js';
import {createSporeWind,animateSporeWind} from './spore-effects.js';
import {afflictBranch} from './mother-puff-growth.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const q=clamp(v);return q*q*(3-2*q);};
const side=(x,center)=>x<center?'left':'right';

// Materials belong to the arena view, including wrappers for the existing
// parallax forest. The shader's world-space boundary follows the clearing,
// rather than recoloring a shared texture throughout the chapter.
function spatialCorruption(root,start,end,leftAmount=0,{borrow=false,privateMaterials=false}={}){
  const uniform={value:1},copies=new Map(),bindings=[],disposed=new Set(),pipelines=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const original=mesh.material;
    const convert=base=>{
      if(copies.has(base))return copies.get(base);
      const compile=base.onBeforeCompile,cacheKey=base.customProgramCacheKey,key=cacheKey.call(base),m=privateMaterials?base:base.clone();
      pipelines.push({m,compile,cacheKey});
      m.onBeforeCompile=(shader,renderer)=>{
        compile.call(base,shader,renderer);
        shader.uniforms.motherEnvironment=uniform;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vMotherEnvironmentX;')
          .replace('#include <project_vertex>','vMotherEnvironmentX = (modelMatrix * vec4(transformed, 1.0)).x;\n#include <project_vertex>');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float motherEnvironment;\nvarying float vMotherEnvironmentX;')
          .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float motherReach = smoothstep(${start.toFixed(3)}, ${end.toFixed(3)}, vMotherEnvironmentX);
float motherSelective = ${leftAmount.toFixed(3)} * smoothstep(${(start-13).toFixed(3)}, ${(start-6).toFixed(3)}, vMotherEnvironmentX);
float motherAmount = max(motherReach, motherSelective) * motherEnvironment;
float motherLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(motherLuma * 0.44 + 0.018), motherAmount);`);
      };
      m.customProgramCacheKey=()=>key+`-mother-environment-${start}-${end}-${leftAmount}`;
      m.addEventListener('dispose',()=>disposed.add(m));copies.set(base,m);return m;
    };
    mesh.material=Array.isArray(original)?original.map(convert):convert(original);
    bindings.push({mesh,original,copy:mesh.material});
  });
  const restore=()=>{
    if(privateMaterials){for(const {m,compile,cacheKey}of pipelines){m.onBeforeCompile=compile;m.customProgramCacheKey=cacheKey;m.needsUpdate=true;}return;}
    for(const {mesh,original,copy}of bindings)if(mesh.material===copy)mesh.material=original;
    // disposeBranch collects resources before removing the arena. Defer this
    // cleanup so a wrapper already released by that walk is never disposed twice.
    queueMicrotask(()=>{for(const m of copies.values())if(!disposed.has(m))m.dispose();});
  };
  const sync=()=>{
    if(!borrow)return;
    // Foreground depth scenery animates opacity through its original materials.
    for(const [base,m]of copies){
      if(m.transparent!==base.transparent||m.depthWrite!==base.depthWrite)m.needsUpdate=true;
      m.opacity=base.opacity;m.transparent=base.transparent;m.depthWrite=base.depthWrite;
    }
  };
  return {uniform,start,end,leftAmount,restore,sync,bindings,materials:[...copies.values()]};
}
function porousMaterial(w){
  if(w.motherPorousMaterial)return w.motherPorousMaterial;
  const base=w.mat.terrain2||w.mat.terrain||new THREE.MeshStandardMaterial({color:0x6f715f,roughness:1});
  const m=base.clone();m.onBeforeCompile=base.onBeforeCompile;m.customProgramCacheKey=base.customProgramCacheKey;
  m.vertexColors=true;m.roughness=1;w.assetMaterials??=new Set();w.assetMaterials.add(m);w.motherPorousMaterial=m;return m;
}
function porousPiece(w,parent,x,y,z,width,height,depth,seed,material){
  // The same recessed cavity geometry as the crumbling ledge, turned so that
  // its large pored face is readable from the playfield.
  const polygon=[[-.65,-.4],[.58,-.46],[.7,.28],[.17,.46],[-.62,.31]];
  const geo=porousClay(w,polygon,.34,seed,true);
  const mesh=w.mesh(geo,material,parent,x,y,z);mesh.name='Corrupted porous clay fragment';
  mesh.rotation.x=Math.PI/2;mesh.rotation.z=Math.sin(seed)*.18;
  mesh.scale.set(width/1.35,depth/.34,height/.92);mesh.userData.motherPorous=true;return mesh;
}

export function createMotherArenaFloor(w,s,g){
  const deck=new THREE.Group();deck.name='Clearing ground';g.add(deck);
  w.box(s.w,1.45,7,'terrain',deck,s.w/2,-.8,-1.8,.36);
  w.box(s.w,.35,7.1,'top',deck,s.w/2,-.15,-1.8,.15);
  for(let i=0;i<15;i++){
    const x=.8+i*(s.w-1.6)/14;
    w.ball(1.6,.6,.65,'terrain2',deck,x,-1.3,.9);
    if(i%2===0)w.ball(.9,.18,.5,'top',deck,x,.03,-3.6);
    if(w.forestAssets&&i%3===0)forestBloom(w,deck,x,-.15,1.4,1.5,(i%2)*.3);
  }
  const center=s.x+s.w/2,start=s.x+s.w*.16,end=s.x+s.w*.65;
  const ground=spatialCorruption(deck,start,end);ground.kind='ground';ground.amount=1;ground.side='whole';
  const porous=[],material=porousMaterial(w),scars=new THREE.Group();scars.name='Pored clay along the clearing edge';g.add(scars);
  for(const [i,[fraction,width,height]]of [[.17,1.35,.7],[.38,1.6,.9],[.61,2.1,1.1],[.75,1.55,.82],[.9,2.25,1.18]].entries()){
    const piece=porousPiece(w,scars,s.w*fraction,-.78,1.25,width,height,.32,721+i*37,material);
    porous.push({root:piece,x:s.x+s.w*fraction,side:side(s.x+s.w*fraction,center),poreCount:piece.geometry.userData.poreCount});
  }
  const scarGrey=spatialCorruption(scars,start,end,.62);scarGrey.kind='pores';scarGrey.amount=1;scarGrey.side='whole';
  g.userData.motherCorruption=[ground,scarGrey];g.userData.motherPorous=porous;
  return {root:g,corruption:g.userData.motherCorruption,porous};
}

export function createMotherEnvironment(w,root,b){
  const center=(b.left+b.right)/2,scenery=new THREE.Group();scenery.name='Afflicted clearing scenery';root.add(scenery);
  const corruption=[],porous=[],winds=[],scoped=new Map();
  const record=(object,x,amount,kind)=>{
    const uniform=afflictBranch(object,amount),entry={root:object,x,side:side(x,center),amount,uniform,kind};
    corruption.push(entry);return entry;
  };
  if(w.forestAssets){
    // Selected grey trunks reach into the left approach; other left crowns
    // retain their greens. Every tree on the right is fully desaturated.
    for(const [dx,z,width,dy,amount]of [[-24,-22,18,-5,0],[-15,-15,11,-4,.82],[-7,-29,20,-7,.58],[10,-31,22,-8,1],[22,-17,18,-5,1]]){
      const x=center+dx,tree=forestModel(w,'canopy',scenery,x,b.y+dy,z,width,dx<0?.18:-.15,true);
      record(tree,x,amount,'tree');
    }
    for(const [dx,width,amount]of [[-13,5.3,.12],[-4,3.6,.66],[12,5.2,1],[22,3.4,1]]){
      const x=center+dx,mushroom=forestModel(w,'heroMushroom',scenery,x,b.y,-7,width,dx*.025,true);
      record(mushroom,x,amount,'mushroom');
    }
    for(const [i,dx]of [-18,-14,-10,-6,-1,4,9,15,20].entries()){
      const x=center+dx,amount=dx>=0?1:[.74,.08,.84,.32,.72][i];
      const leaves=forestBloom(w,scenery,x,b.y-.12,-3.9-(i%3)*.25,2.2+(i%3)*.36,dx*.02);
      record(leaves,x,amount,'leaves');
    }
  }
  const stone=new THREE.Group();stone.name='Pored erosion in the clearing';scenery.add(stone);
  const material=porousMaterial(w);
  for(const [i,[dx,width,height,z]]of [[-16,1.35,1.0,-4.2],[-8.2,1.7,1.1,-4.6],[-1,1.9,1.2,-4.8],[5,1.6,1.1,-4.4],[12,2.3,1.4,-4.7],[18,2.1,1.7,-4.2],[23,1.65,1.3,-4.7]].entries()){
    const g=new THREE.Group();stone.add(g);
    const piece=porousPiece(w,g,center+dx,b.y+height*.35,z,width,height,.55,1301+i*97,material);
    const entry=record(g,center+dx,dx>0?1:.8,'porous');
    porous.push({root:piece,x:center+dx,side:entry.side,poreCount:piece.geometry.userData.poreCount});
  }
  // Original forest updrafts are reused as a healing breeze. Their meshes are
  // created once; no flowers or new mushrooms appear during the ending.
  for(const [x,width]of [[center-17,14],[center-3,14],[center+11,12]]){
    const g=new THREE.Group();g.position.set(x,b.y+.1,-.4);root.add(g);
    winds.push(createSporeWind(w,{w:width,h:7.5,active:false,spores:true},g));
  }
  const view={root:scenery,center,corruption,porous,winds,scoped,arches:[],gates:[]};
  view.scope=(object,kind,leftAmount=0)=>{
    if(!object||scoped.has(object))return;
    // Depth parts already own dedicated material copies for their occlusion
    // fade. Wrap those copies in place so their lifecycle stays with the part.
    const shade=spatialCorruption(object,center-7,center+6,leftAmount,{borrow:true,privateMaterials:kind==='foreground'});shade.kind=kind;
    scoped.set(object,shade);
  };
  // Select whole backdrop trees on the left; their world-space right portions
  // are always fully grey. Distant clouds and the sky keep their own palette.
  for(const layer of w.parallax||[])for(const [i,child]of layer.group.children.entries()){
    if(/^Forest /.test(child.name))view.scope(child,'backdrop',i%3===1?.72:0);
  }
  root.addEventListener('removed',()=>{for(const shade of scoped.values())shade.restore();scoped.clear();});
  return view;
}

export function animateMotherEnvironment(w,view,b,reduced){
  if(!view)return;
  const healing=clamp(b.healing||0),remaining=1-healing*.94;
  // These fragments belong to Mother Puff's corruption, rather than the
  // chapter's crumbling ledges. Clear them with the final hit and restore them
  // when a failed encounter is reset, including streamed ground fragments.
  const porousVisible=b.hits<3;
  for(const entry of view.porous)entry.root.visible=porousVisible;
  for(const entry of view.corruption)entry.uniform.value=entry.amount*remaining;
  for(const platform of w.platforms?.values()||[]){
    for(const entry of platform.root.userData.motherPorous||[])entry.root.visible=porousVisible;
    const records=platform.root.userData.motherCorruption;
    if(records){for(const entry of records)entry.uniform.value=remaining;continue;}
    // Covers the exit ledge and its leaves, while world-space limits keep the
    // earlier forest unchanged. Collectibles, player and boss are untouched.
    const x=platform.root.position.x;
    if(x>=view.center+4)view.scope(platform.root,'exit');
  }
  for(const depth of w.depthViews?.values()||[])for(const part of depth.parts||[]){
    if(part.anchor.x>=view.center-20)view.scope(part.root,'foreground',part.anchor.x<view.center?.45:0);
  }
  for(const shade of view.scoped.values()){shade.uniform.value=remaining;shade.sync();}
  for(const [i,wind]of view.winds.entries()){
    const bloom=b.state==='bloom',tail=b.state==='defeated'&&b.stateTime<2.5;
    wind.wind.active=bloom||tail;
    animateSporeWind(wind,b.stateTime+i*.31,reduced);
    const fade=bloom?smooth(b.stateTime/.65):1-smooth(b.stateTime/2.5);
    wind.root.scale.setScalar(Math.max(.001,fade));
  }
}
