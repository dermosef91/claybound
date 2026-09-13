import * as THREE from './lib/three.module.js';
import {releaseEnemyView} from './enemies.js';
import {windView} from './setpieces.js';
import {circuitView,guideView} from './mechanism-views.js';
import {syncDepthScenery} from './depth-scenery.js';
import {createPressView} from './press-views.js';
import {createBead} from './beads.js';
import {greatArchLayout,buildGreatArch} from './great-arch.js';

const attached=(o,root)=>{for(let p=o;p;p=p.parent)if(p===root)return true;return false;};
export function disposeBranch(w,root){
  const geometry=new Set(),materials=new Set(),shared=new Set([...Object.values(w.mat),...(w.assetMaterials||[])]);
  root.traverse(o=>{if(o.geometry&&!w.assetGeometry?.has(o.geometry)&&!w.baseGeometry?.has(o.geometry))geometry.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!shared.has(m))materials.add(m);});
  root.removeFromParent();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

function hazard(w,h){
  const g=new THREE.Group();g.position.set(h.x,h.y,0);w.levelRoot.add(g);const citadel=w.biome==='citadel';
  w.box(h.w,citadel?1.3:.36,2.3,citadel?'top':'terrain2',g,h.w/2,citadel?-.65:-.2,0,.14);
  const count=citadel?Math.ceil(h.w/.6):Math.max(1,Math.floor(h.w/.75));
  for(let i=0;i<count;i++){
    const points=[[.27,0],[.23,.16],[.16,.42],[.08,.72],[.025,.92],[0,1]].map(([r,y])=>new THREE.Vector2(r,y*(.83+(i%3)*.045)));
    w.mesh(new THREE.LatheGeometry(points,14),'cream',g,.3+i*Math.max(0,h.w-.6)/Math.max(1,count-1),.025,0);
  }return g;
}
function collectible(w,c,stamp){
  const g=new THREE.Group();g.position.set(c.x,c.y,.12);w.levelRoot.add(g);
  if(!stamp)createBead(w,g);
  else{
    w.ball(.3,.31,.135,'cream',g);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;w.ball(.15,.15,.15,'gold',g,Math.cos(a)*.28,Math.sin(a)*.28,0);}
    w.ball(.12,.12,.05,'orange',g,0,0,.14);
  }return g;
}

export function syncStream(w,L,center,force=false){
  if(!force&&Math.abs(center-(w.streamCenter??Infinity))<8)return;
  w.streamCenter=center;w.streamViews??=new Map();
  const behind=Math.max(20,(w.viewW||15)*.6+12),ahead=Math.max(34,(w.viewW||15)*.95+17),wanted=new Set();
  const near=(x,width=0,travel=0)=>x+width+travel>center-behind&&x-travel<center+ahead;
  const add=(key,make,remove)=>{
    wanted.add(key);if(!w.streamViews.has(key)){const root=make();w.streamViews.set(key,{root,remove});}
  };
  const arch=greatArchLayout(L);
  if(arch&&near(arch.left,arch.width))add('scenery:great-arch',()=>buildGreatArch(w,arch),()=>{});
  for(const s of L.platforms)if(near(s.baseX??s.x,s.w,Math.max(Math.abs(s.moveX||0),s.travel||0)))add('p:'+s.id,()=>{
    const v=w.makePlatform(s);v.guides=(L.guides||[]).filter(guide=>guide.platformId===s.id).map(guide=>guideView(w,guide,s,v));
    for(const guide of v.guides)guide.visible=!s.broken&&s.active!==false;
    w.platforms.set(s.id,v);return v.root;
  },()=>w.platforms.delete(s.id));
  L.hazards.forEach((h,i)=>{if(near(h.x,h.w))add('h:'+i,()=>hazard(w,h),()=>{});});
  for(const e of L.enemies)if(e.alive&&(near(e.min,e.max-e.min)||near(e.x,1)))add('e:'+e.id,()=>{const v=w.makeEnemy(e);w.enemyViews.set(e.id,v);return v.root;},()=>{releaseEnemyView(w.enemyViews.get(e.id));w.enemyViews.delete(e.id);});
  for(const [list,views,stamp,prefix]of [[L.coins,w.coinViews,false,'c:'],[L.stamps,w.stampViews,true,'s:']])for(const c of list)if(!c.taken&&near(c.x))add(prefix+c.id,()=>views[c.id]=collectible(w,c,stamp),()=>delete views[c.id]);
  L.crushers?.forEach((c,i)=>{if(near(c.x,c.w))add('r:'+i,()=>w.crusherViews[i]=createPressView(w,c),()=>delete w.crusherViews[i]);});
  for(const wind of L.winds||[])if(near(wind.x,wind.w))add('w:'+wind.id,()=>{const v=windView(w,wind);w.windViews.set(wind.id,v);return v.root;},()=>w.windViews.delete(wind.id));
  for(const [i,c]of (L.circuits||[]).entries()){
    const nodes=[c.source,...c.targets].map(id=>L.platforms.find(p=>p.id===id)),left=Math.min(...nodes.map(p=>p.x)),right=Math.max(...nodes.map(p=>p.x+p.w));
    if(near(left,right-left))add('wire:'+i,()=>{const v=circuitView(w,L,c);w.circuitViews.set(i,v);return v.root;},()=>w.circuitViews.delete(i));
  }
  syncDepthScenery(w,L,near,add);
  for(const [key,v]of w.streamViews)if(!wanted.has(key)){v.remove();disposeBranch(w,v.root);w.streamViews.delete(key);}
  w.flags=w.flags.filter(f=>attached(f,w.levelRoot));w.torches=w.torches.filter(t=>attached(t.flame,w.levelRoot)||attached(t.flame,w.backRoot));
  if(w.bell&&!attached(w.bell,w.levelRoot))w.bell=null;
  // Cache eviction never disposes meshes or materials used by a live region.
  if(w.clay?.boxes.size>200){
    const live=new Set();w.scene.traverse(o=>{if(o.geometry)live.add(o.geometry);});
    for(const [key,g]of w.clay.boxes)if(w.clay.boxes.size>180&&!live.has(g)){w.clay.boxes.delete(key);w.assetGeometry.delete(g);g.dispose();}
  }
}
