import * as THREE from './lib/three.module.js';
import {canyonModel} from './canyon-assets.js';
import {forestModel} from './forest.js';
import {forestUnderstory} from './forest-details.js';
import {caveCrystals} from './cavern.js';

const group=parent=>{const g=new THREE.Group();parent.add(g);return g;};
// Guards already include a safety margin. Ignore grazing padded bounds so a
// nearby pit does not unnecessarily hide an entire foreground arrangement.
const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.18&&Math.min(a.top,b.top)-Math.max(a.bottom,b.bottom)>.12;

// A perspective-like response for decorative geometry only. The game plane
// retains its precise orthographic projection and two-dimensional collision.
export function depthPlacement(anchor,cameraX,cameraY,z){
  const scale=26/(26-z);
  return {x:cameraX+(anchor.x-cameraX)*scale,y:cameraY+(anchor.y-cameraY)*scale,z,scale};
}

function terrace(w,g,width=3.8,material='terrain'){
  w.box(width- .3,3.2,2.3,material,g,0,-1.82,0,.25);
  w.box(width,.38,2.62,material,g,0,-.18,.03,.17);
  w.box(width*.42,.6,.25,'terrain2',g,-width*.23,-1.5,1.19,.14);
}
function boulder(w,g,x,y,z,size=1){
  const m=w.box(1.32,1.08,1.24,'terrain',g,x,y+.48*size,z,.32);
  m.scale.set(size,size,size);m.rotation.set(.03,-.22,.08);
}
function mushrooms(w,g,x=0,size=1){
  const m=group(g);m.position.x=x;m.scale.setScalar(size);
  w.ball(.2,.53,.22,'cream',m,0,.47,0);
  w.ball(.65,.28,.6,'orange',m,0,1.04,0);
  for(const [x,y,z]of [[-.27,1.23,.21],[.22,1.25,.11],[.03,1.3,-.22]])w.ball(.1,.035,.09,'cream',m,x,y,z);
}
// One crystal silhouette for the whole cave: the supplied models set it, the
// near props follow it, and the foreground parallax uses the same builder.
// Foreground copies carry no light fixture — the cave keeps its four lights.
function crystals(w,g,x=0,size=1){
  caveCrystals(w,g,x,0,.1,size*1.15,{light:false});
}
function nearScenery(w,g,variant){
  if(w.biome==='citadel'){
    terrace(w,g,3.7,'terrain');
  }else if(w.biome==='desert'){
    terrace(w,g,4.4,'terrain2');boulder(w,g,-.65,0,.2,1.32);boulder(w,g,.65,0,.3,.64);
    canyonModel(w,'cactus',g,1.55,0,-.15,1.75,-.28);
    w.ball(.47,.2,.43,'top',g,-.3,.12,1.0);
  }else if(w.biome==='forest'){
    forestUnderstory(w,g);
    forestModel(w,'hills',g,-2.0,-1.7,-.4,2.2,0);
  }else{
    terrace(w,g,3.8,'terrain2');boulder(w,g,-.82,0,-.2,1.4);boulder(w,g,.65,0,.4,.57);
    crystals(w,g,.7,1.1);crystals(w,g,-1.52,.53);
  }
  g.rotation.y=variant%2?.12:-.1;
}

function makePart(w,parent,anchor,z,variant){
  const band='foreground';
  const root=group(parent);root.name=`${w.biome} ${band} scenery`;
  nearScenery(w,root,variant);
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root,true),materials=new Map(),meshes=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    meshes.push(o);
    o.castShadow=true;o.receiveShadow=true;
    const adapt=base=>{
      if(!materials.has(base)){
        const m=base.clone();m.onBeforeCompile=base.onBeforeCompile;m.customProgramCacheKey=base.customProgramCacheKey;
        m.color.multiplyScalar(.91);
        materials.set(base,m);
      }
      return materials.get(base);
    };
    o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material);
  });
  return {root,band,anchor,z,bounds,materials:[...materials.values()],meshes,opacity:1};
}

// Rebuilt alongside the edited platforms; no decoration is a collider or save
// record. Landmark-sized resting places carry scenery, not every little step.
export function syncDepthScenery(w,L,near,add){
  w.depthViews??=new Map();
  L.platforms.forEach((s,index)=>{
    if(s.kind!=='stone'&&!(s.kind==='ledge'&&s.w>=6&&(s.checkpoint||s.rest||s.goal)))return;
    if(!near(s.x,s.w,7))return;
    const key='depth:'+s.id;
    add(key,()=>{
      const root=group(w.depthRoot),parts=[];root.name='Side scenery '+s.id;
      const x=s.id==='start'?L.spawn.x+2.8:s.x+s.w*.36;
      // Keep the low citadel terraces beneath the playable rooftop edge.
      const drop=w.biome==='citadel'?2.6:w.biome==='forest'?2.15:2.1;
      parts.push(makePart(w,root,{x,y:s.y-drop},3.7+(index%3)*.55,index));
      w.depthViews.set(s.id,{root,parts});return root;
    },()=>w.depthViews.delete(s.id));
  });
}

function projectedBox(bounds,position,cos,sin){
  const s=position.scale;
  return {left:bounds.min.x*s+position.x,right:bounds.max.x*s+position.x,
    bottom:(bounds.min.y*s+position.y)*cos-(bounds.max.z*s+position.z)*sin,
    top:(bounds.max.y*s+position.y)*cos-(bounds.min.z*s+position.z)*sin};
}
export function animateDepthScenery(w,game,dt){
  if(!w.depthRoot)return;
  w.depthRoot.visible=!w.editorCamera;if(w.editorCamera)return;
  const elevation=w.theme.cameraElevation??(w.biome==='citadel'?1.25:3.05),length=Math.hypot(26,elevation),cos=26/length,sin=elevation/length;
  const {player:p,level:L}=game,protectedAreas=[];
  const guard=(left,right,bottom,top)=>protectedAreas.push({left,right,bottom:bottom*cos-.1,top:top*cos+.1});
  guard(p.x-.8,p.x+.8,p.y-.35,p.y+1.7);
  const visible=x=>Math.abs(x-w.cameraX)<w.viewW*.65+6;
  for(const s of L.platforms)if(s.active&&!s.broken&&visible(s.x+s.w/2))guard(s.x-.2,s.x+s.w+.2,s.y-.4,s.y+.55);
  for(const h of L.hazards)if(visible(h.x+h.w/2))guard(h.x-.15,h.x+h.w+.15,h.y-.2,h.y+1.2);
  for(const list of [L.coins,L.stamps])for(const c of list)if(!c.taken&&visible(c.x))guard(c.x-.4,c.x+.4,c.y-.45,c.y+.45);
  for(const view of w.depthViews.values())for(const part of view.parts){
    const placement=depthPlacement(part.anchor,w.cameraX,w.cameraY,part.z);
    part.root.position.set(placement.x,placement.y,placement.z);part.root.scale.setScalar(placement.scale);
    // Sparse near props normally sit below the running surface. If a lower
    // route, collectible or the player overlaps, make the whole prop recede.
    const blocked=protectedAreas.some(area=>overlaps(projectedBox(part.bounds,placement,cos,sin),area));
    const target=blocked?.1:1;
    part.opacity=dt?part.opacity+(target-part.opacity)*(1-Math.exp(-dt*(blocked?22:5))):target;
    if(Math.abs(part.opacity-target)<.005)part.opacity=target;
    for(const mesh of part.meshes)mesh.castShadow=part.opacity>.98;
    for(const m of part.materials){
      const transparent=part.opacity<1;
      if(m.transparent!==transparent){m.transparent=transparent;m.depthWrite=!transparent;m.needsUpdate=true;}
      m.opacity=part.opacity;
    }
  }
}
