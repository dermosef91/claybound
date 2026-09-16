import * as THREE from './lib/three.module.js';
import {forestModel} from './forest.js';
import {forestBloom} from './forest-details.js';
import {porousClay} from './porous-clay.js';
import {crumbleMaterials} from './crumble.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';
import {createSporeWind,animateSporeWind} from './spore-effects.js';
import {afflictBranch} from './mother-puff-growth.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const q=clamp(v);return q*q*(3-2*q);};
const side=(x,center)=>x<center?'left':'right';

// Four supplied sculptures of the blight itself: stone-dead tree and mushroom
// for the boss's side of the clearing, and half-turned pairs for the ground
// where it is still spreading. Loaded with the boss rather than with Wildwood,
// because nothing outside this clearing is blighted.
export const BLIGHTED_KEYS=['corrupt-tree','corrupt-mushroom','semi-tree','semi-mushroom','arch'];
// Each half-turned sculpture carries its stone on one flank. These yaws bring
// that flank round to face right, toward the boss the blight spreads from.
const BLIGHTED_TURN={'semi-tree':0,'semi-mushroom':Math.PI*.75,'corrupt-tree':-.22,'corrupt-mushroom':.16,arch:0};
export function prepareBlightedAsset(w,key,gltf){
  const scene=gltf.scene;scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid blighted model: '+key);
  clayMaterials(scene,{background:true});
  clayModel(w,scene,{background:true});
  // The arch was sculpted in a paler stone than the other four. Its stone is
  // brought down to the blight's charcoal in the shader, by how little colour
  // a texel carries, so the moss that drips over it keeps its green.
  if(key==='arch')scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
    const compile=m.onBeforeCompile,cacheKey=m.customProgramCacheKey;
    m.onBeforeCompile=(shader,renderer)=>{
      compile.call(m,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float archChroma = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
diffuseColor.rgb *= mix(vec3(0.30, 0.31, 0.34), vec3(0.9, 1.0, 0.86), smoothstep(0.05, 0.2, archChroma));`);
    };
    m.customProgramCacheKey=()=>cacheKey.call(m)+'-blight-arch';m.needsUpdate=true;
  }});
  retainModel(w,scene);
  w.blightedAssets??={};w.blightedAssets[key]={scene,box,size,center};
}
export async function loadBlightedAssets(w,onProgress){
  if(BLIGHTED_KEYS.every(key=>w.blightedAssets?.[key])){onProgress?.(1);return;}
  w.blightedLoading??=Promise.all(BLIGHTED_KEYS.map(key=>
    loadModel(`mother-puff-${key}.glb`).then(gltf=>prepareBlightedAsset(w,key,gltf))
  )).catch(e=>{w.blightedLoading=null;throw e;});
  await w.blightedLoading;onProgress?.(1);
}
// Matches forestModel: y is the base, width drives a uniform scale, and the
// clone shares the retained geometry and materials of the loaded original.
export function blightedModel(w,key,parent,x,y,z,width,turn=BLIGHTED_TURN[key]||0){
  const a=w.blightedAssets?.[key];if(!a)return null;
  const root=new THREE.Group(),model=a.scene.clone(true);root.name='Blighted '+key;
  root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(width/a.size.x);
  model.position.set(-a.center.x,-a.box.min.y,-a.center.z);root.add(model);parent.add(root);
  model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  return root;
}

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
float motherSelective = ${leftAmount.toFixed(3)} * smoothstep(${(start-6).toFixed(3)}, ${(start-2).toFixed(3)}, vMotherEnvironmentX);
float motherAmount = max(motherReach, motherSelective) * motherEnvironment;
// Past the transition the blight is charcoal, not the fog's grey: darker
// still toward the boss, so the cream of her body and the burgundy of her
// cap stand off it. The healthy side keeps its warmth and a little more
// colour; the blighted side cools.
float motherDeep = smoothstep(${end.toFixed(3)}, ${(end+9).toFixed(3)}, vMotherEnvironmentX);
float motherLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3 motherHealthy = mix(vec3(motherLuma), diffuseColor.rgb, 1.22) * vec3(1.05, 1.02, 0.93);
vec3 motherStone = vec3(motherLuma * mix(0.40, 0.22, motherDeep) + mix(0.020, 0.006, motherDeep)) * vec3(0.95, 0.98, 1.06);
diffuseColor.rgb = mix(motherHealthy, motherStone, motherAmount);`);
      };
      m.customProgramCacheKey=()=>key+`-mother-environment-v2-${start}-${end}-${leftAmount}`;
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
  // The blighted bricks are the crumbling ledge's own stone, so pored clay in
  // the clearing reads as the same material the chapter breaks apart
  // underfoot, rather than a brown deck greyed out in the shader.
  crumbleMaterials(w);return w.mat.crumbleGrey;
}
// The boss's side is that stone gone charcoal: the same pored geometry, its
// cavities shaded by the vertex colours down to near black.
export const BLIGHT_CHARCOAL=0x35333a;
function charcoalMaterial(w){
  const m=w.mat.blightCharcoal??=new THREE.MeshStandardMaterial();
  m.color.setHex(BLIGHT_CHARCOAL);m.roughness=1;m.metalness=0;m.vertexColors=true;return m;
}
// A raised, pored shoulder of ground closing each end of the clearing. It is
// scenery only, parked behind the fighting plane, so the arena floor the
// encounter is tuned against stays flat and the recorded replay still holds.
function endLedge(w,parent,x,y,width,height,bricks,seed,material,porous,center){
  const g=new THREE.Group();g.name='Pored shoulder of the clearing';g.position.set(x,y,-1.35);parent.add(g);
  w.box(width,height,2.6,'terrain2',g,0,-height/2,0,.26);
  w.box(width*1.02,.34,2.7,'top',g,0,.04,0,.13);
  for(const [i,[fraction,bw,bh]]of bricks.entries()){
    const dx=(fraction-.5)*width;
    const piece=porousPiece(w,g,dx,-height*.42-(i%2)*.16,1.32,bw,bh,.3,seed+i*53,material);
    porous.push({root:piece,x:x+dx,side:side(x+dx,center),poreCount:piece.geometry.userData.poreCount});
  }
  return g;
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
  // The floor tells the same story as the trees, in three parts: soil and
  // grass under the player, cracks and small pored patches around the middle,
  // and on the boss's side a rigid charcoal slab in place of the deck, with
  // chunks of it heaved up around her feet as if the blight were anchored
  // there. The collider under all of it stays the flat deck the encounter is
  // tuned against.
  const deck=new THREE.Group();deck.name='Clearing ground';g.add(deck);
  w.box(s.w,1.45,7,'terrain',deck,s.w/2,-.8,-1.8,.36);
  w.box(s.w,.35,7.1,'top',deck,s.w/2,-.15,-1.8,.15);
  for(let i=0;i<15;i++){
    const x=.8+i*(s.w-1.6)/14;
    w.ball(1.6,.6,.65,'terrain2',deck,x,-1.3,.9);
    if(i%2===0)w.ball(.9,.18,.5,'top',deck,x,.03,-3.6);
    // Flowers only where the ground is still soil; the fighting lane between
    // the player and the boss stays clean of them.
    if(w.forestAssets&&i%3===0&&x<s.w*.36)forestBloom(w,deck,x,-.15,1.4,1.5,(i%2)*.3);
  }
  const center=s.x+s.w/2,start=s.x+s.w*.42,end=s.x+s.w*.68;
  const ground=spatialCorruption(deck,start,end);ground.kind='ground';ground.amount=1;ground.side='whole';
  const porous=[],material=porousMaterial(w),charcoal=charcoalMaterial(w),scars=new THREE.Group();scars.name='Pored clay along the clearing edge';g.add(scars);
  // Cracks first: small pored patches let into the top around the middle, the
  // clay just starting to harden.
  for(const [i,[fraction,width,height]]of [[.45,1.1,.6],[.53,1.5,.8],[.61,1.9,1]].entries()){
    const piece=porousPiece(w,scars,s.w*fraction,-.6,1.86,width,height,.32,721+i*37,material);
    porous.push({root:piece,x:s.x+s.w*fraction,side:side(s.x+s.w*fraction,center),poreCount:piece.geometry.userData.poreCount});
  }
  // And plates of it breaking through the grass where the slab is about to
  // begin, so the charcoal arrives in pieces rather than at a seam.
  for(const [i,[fraction,width,depth,dz]]of [[.575,1.6,1.3,-.6],[.635,2.1,1.7,-2.4],[.665,1.2,1,.4]].entries()){
    const plate=new THREE.Group();plate.name='Charcoal breaking through the grass';plate.position.set(s.w*fraction,0,dz);scars.add(plate);
    const piece=porousPiece(w,plate,0,.08,0,width,depth,.28,1700+i*53,charcoal);piece.rotation.x=0;piece.rotation.z=0;piece.rotation.y=Math.sin(i*2.1)*.3;
    porous.push({root:plate,x:s.x+s.w*fraction,side:'right',poreCount:piece.geometry.userData.poreCount});
  }
  // Then the crust: contiguous charcoal plates take over the deck's face and
  // its moss line from two thirds across to the far end, with slime running
  // over the broken lip. It joins the scar group, so it greys with the clearing
  // and clears on the final landing like the rest.
  for(const [i,[fraction,width]]of [[.7,5.2],[.82,4.6],[.94,4.9]].entries()){
    const crust=new THREE.Group();crust.name='Blighted crust over the clearing floor';crust.position.set(s.w*fraction,0,0);scars.add(crust);
    // The deck's own face ends at z=1.75, so the pored plate stands just proud
    // of it rather than sinking inside and showing only a sliver.
    const plate=porousPiece(w,crust,0,-.92,1.86,width,1.9,.32,930+i*61,charcoal);
    w.box(width,.5,7.05,'blightCharcoal',crust,0,-.06,-1.8,.14);
    for(const [j,dx]of [-.34,.02,.37].entries())w.ball(.32+j*.04,.52+j*.13,.28,'top',crust,dx*width,.02-j*.09,1.94);
    porous.push({root:crust,x:s.x+s.w*fraction,side:'right',poreCount:plate.geometry.userData.poreCount});
  }
  // Chunks heaved up around the boss's feet, behind her and beside her, never
  // in the lane the player fights from.
  const boss=w.currentLevel?.boss;const feet=boss?boss.x-s.x:s.w*.83;
  for(const [i,[dx,width,height,z]]of [[-3.4,2.6,1.9,-3],[2.4,2.2,1.6,-2.5],[5.2,2.9,2.2,-3.3],[-1.4,1.7,1.2,.9],[3.6,1.5,1.05,1.15],[6.4,1.6,1.1,.7]].entries()){
    const chunk=new THREE.Group();chunk.name='Charcoal heaved at the boss\'s feet';chunk.position.set(feet+dx,0,0);scars.add(chunk);
    const piece=porousPiece(w,chunk,0,height*.55,z,width,height,.8,1500+i*71,charcoal);
    porous.push({root:chunk,x:s.x+feet+dx,side:'right',poreCount:piece.geometry.userData.poreCount});
  }
  const scarGrey=spatialCorruption(scars,start,end,.3);scarGrey.kind='pores';scarGrey.amount=1;scarGrey.side='whole';
  g.userData.motherCorruption=[ground,scarGrey];g.userData.motherPorous=porous;
  return {root:g,corruption:g.userData.motherCorruption,porous};
}

export function createMotherEnvironment(w,root,b){
  const center=(b.left+b.right)/2,scenery=new THREE.Group();scenery.name='Afflicted clearing scenery';root.add(scenery);
  const corruption=[],porous=[],winds=[],scoped=new Map();
  // How far into the blight a thing stands: nothing left of the middle is
  // charcoal, everything on the boss's side is.
  const depthAt=x=>Math.max(0,Math.min(1,(x-center)/9));
  const record=(object,x,amount,kind)=>{
    const uniform=afflictBranch(object,amount,depthAt(x),.2),entry={root:object,x,side:side(x,center),amount,uniform,kind};
    corruption.push(entry);return entry;
  };
  // Each blighted sculpture is paired with the healthy one it stands in for,
  // built in the same spot and hidden. The healing breeze swaps the pair over,
  // so recovery restores the clearing's own trees instead of tinting stone.
  const blighted=[];
  const pair=(x,amount,kind,stone,green)=>{
    if(stone)record(stone,x,amount,kind);
    if(green){record(green,x,amount,kind);green.visible=false;}
    if(stone||green)blighted.push({stone,green,stoneScale:stone?.scale.x??1,greenScale:green?.scale.x??1});
  };
  // The clearing reads left to right: the left near half is healthy and
  // saturated, the middle is where things harden one by one — a leaf here, a
  // cap there — and only the boss's side is the charcoal, pored dead wood.
  // Each thing carries its own affliction by where it stands, so no whole
  // background tree greys because the boss is somewhere to its right.
  const harden=x=>Math.max(0,Math.min(1,(x-(center-5))/11));
  if(w.forestAssets){
    // Healthy crowns stand back along the left approach; the nearer they come
    // to the middle the more they have hardened.
    for(const [dx,z,width,dy]of [[-25,-21,11,-5],[-17,-16,8.5,-4],[-9,-25,12,-7],[-2,-29,13,-9]]){
      const x=center+dx,tree=forestModel(w,'canopy',scenery,x,b.y+dy,z,width,.18,true);
      record(tree,x,harden(x),'tree');
    }
    // Tall caps close the left edge of the frame; the middle ground between
    // player and boss is left open.
    for(const [dx,width,dy]of [[-16,6.4,1.5],[-11,4.4,0]]){
      const x=center+dx,mushroom=forestModel(w,'heroMushroom',scenery,x,b.y+dy,-7,width,dx*.025,true);
      record(mushroom,x,harden(x),'mushroom');
    }
    // Leaf clusters only on the healthy approach and up on the shoulders'
    // level, so the fighting lane carries none of them.
    for(const [i,dx]of [-19,-16,-13,-10].entries()){
      const x=center+dx;
      const leaves=forestBloom(w,scenery,x,b.y-.12,-3.9-(i%3)*.25,2.1+(i%3)*.34,dx*.02);
      record(leaves,x,harden(x),'leaves');
    }
  }
  if(w.blightedAssets){
    // One tree stands directly behind the boss — the supplied arch, its trunk
    // rising behind her and its branches reaching back over the clearing, so
    // her silhouette reads against one dark shape. It carries its own stone
    // and moss rather than the affliction shader, so it joins the healing
    // swap by hand. The pored canopies keep to the frame's right edge.
    const arch=blightedModel(w,'arch',scenery,b.x+2.6,b.y-1.6,-8,15,.1);
    if(arch){
      const green=forestModel(w,'canopy',scenery,b.x+2.6,b.y-1.6,-8,13,-.15,true);green.visible=false;
      blighted.push({stone:arch,green,stoneScale:arch.scale.x,greenScale:green.scale.x});
    }
    // Near enough that the fog does not pale them: the blight has to stay charcoal.
    for(const [dx,z,width,dy]of [[22,-12,15,-3],[15,-14,11,6.5],[7.5,-15.5,10,5]]){
      const x=center+dx;
      pair(x,1,'tree',blightedModel(w,'corrupt-tree',scenery,x,b.y+dy,z,width),
        forestModel(w,'canopy',scenery,x,b.y+dy,z,width,-.15,true));
    }
    for(const [dx,width]of [[24.5,3.8]]){
      const x=center+dx;
      pair(x,1,'mushroom',blightedModel(w,'corrupt-mushroom',scenery,x,b.y,-7,width),
        forestModel(w,'heroMushroom',scenery,x,b.y,-7,width,dx*.025,true));
    }
    // Half-turned pairs mark the ground the blight is still crossing, in the
    // middle of the clearing, each with its stone flank turned toward the boss.
    for(const [key,dx,z,width,healthy,healthyWidth]of [['semi-tree',-4,-16,11,'canopy',11],['semi-mushroom',3,-7,4.2,'heroMushroom',4.2]]){
      const x=center+dx,dy=key==='semi-tree'?-4:0;
      // Everything on the boss's side of centre is wholly hers, half-turned or not.
      pair(x,x>=center?1:key==='semi-tree'?.7:.6,key==='semi-tree'?'tree':'mushroom',
        blightedModel(w,key,scenery,x,b.y+dy,z,width),
        forestModel(w,healthy,scenery,x,b.y+dy,z,healthyWidth,.18,true));
    }
  }
  const stone=new THREE.Group();stone.name='Pored erosion in the clearing';scenery.add(stone);
  const material=porousMaterial(w),charcoal=charcoalMaterial(w);
  // Raised shoulders close the frame at both ends: a mossy one on the left,
  // a charcoal one on the right, holding the broken stone that used to litter
  // the fighting floor.
  const shoulders=[endLedge(w,stone,center-15.6,b.y+1.3,8.2,2.3,[[.46,1.2,.7]],640,material,porous,center),
    endLedge(w,stone,center+16,b.y+1.5,8.6,2.5,[[.2,1.5,.8],[.55,1.75,.95],[.85,1.3,.7]],880,charcoal,porous,center)];
  record(shoulders[0],center-15.4,.15,'porous');record(shoulders[1],center+15.8,1,'porous');
  // The pieces left out on the ground are all bedded into the boss's side.
  for(const [i,[dx,width,height,z]]of [[7.4,2.1,1.25,-4.4],[12.6,2.3,1.4,-4.7],[19.4,1.7,1.15,-4.2]].entries()){
    const g=new THREE.Group();stone.add(g);
    const piece=porousPiece(w,g,center+dx,b.y+height*.3,z,width,height,.52,1301+i*97,charcoal);
    const entry=record(g,center+dx,1,'porous');
    porous.push({root:piece,x:center+dx,side:entry.side,poreCount:piece.geometry.userData.poreCount});
  }
  // Original forest updrafts are reused as a healing breeze. Their meshes are
  // created once; no flowers or new mushrooms appear during the ending.
  for(const [x,width]of [[center-17,14],[center-3,14],[center+11,12]]){
    const g=new THREE.Group();g.position.set(x,b.y+.1,-.4);root.add(g);
    winds.push(createSporeWind(w,{w:width,h:7.5,active:false,spores:true},g));
  }
  const view={root:scenery,center,corruption,porous,winds,scoped,blighted,arches:[],gates:[]};
  view.scope=(object,kind,leftAmount=0)=>{
    if(!object||scoped.has(object))return;
    // Depth parts already own dedicated material copies for their occlusion
    // fade. Wrap those copies in place so their lifecycle stays with the part.
    const shade=spatialCorruption(object,center-1,center+9,leftAmount,{borrow:true,privateMaterials:kind==='foreground'});shade.kind=kind;
    scoped.set(object,shade);
  };
  // The backdrop greys by where it stands in the world, nothing more: no whole
  // tree on the left is picked out to grey, so the approach stays green.
  // Distant clouds and the sky keep their own palette.
  for(const layer of w.parallax||[])for(const child of layer.group.children){
    if(/^Forest /.test(child.name))view.scope(child,'backdrop',0);
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
  // Healing does not merely un-grey the blight: every stone sculpture gives
  // way to the healthy tree or cap it replaced, so the recovered clearing
  // carries no corrupted asset or material at all. The exchange is a shrink
  // and swell rather than a cut, because it runs while she is still on screen
  // watching it happen, covered only by her own spore billows.
  const cure=smooth(clamp((healing-.18)/.34));
  for(const p of view.blighted||[]){
    if(p.stone){p.stone.visible=cure<1;p.stone.scale.setScalar(Math.max(.001,p.stoneScale*(1-cure)));}
    if(p.green){p.green.visible=cure>0;p.green.scale.setScalar(Math.max(.001,p.greenScale*cure));}
  }
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
    if(part.anchor.x>=view.center-20)view.scope(part.root,'foreground',0);
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
