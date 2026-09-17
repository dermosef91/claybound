import * as THREE from './lib/three.module.js';
import {releaseEnemyView} from './enemies.js';
import {windView} from './setpieces.js';
import {circuitView,guideView} from './mechanism-views.js';
import {syncDepthScenery} from './depth-scenery.js';
import {decorView} from './decor.js';
import {decorSize} from './decor-kinds.js';
import {createPressView} from './press-views.js';
import {createBead} from './beads.js';
import {greatArchLayout,buildGreatArch} from './great-arch.js';
import {clayCacheOverBudget,trimClayShapes,clayShape,sculptClay} from './clay.js';
import {createMotherPuff} from './mother-puff.js';
import {caveWallDressing} from './cavern.js';
import {settleSquash,squashPending} from './clay-shatter.js';
import {syncDreamScenery} from './dream.js';

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
    // Only the height varies, on a three-step cycle, so a row of spikes — and
    // every other row in the chapter — shares three shapes between them.
    const variant=i%3;
    const spike=clayShape(w,`hazard-spike:${variant}`,()=>{
      const points=[[.27,0],[.23,.16],[.16,.42],[.08,.72],[.025,.92],[0,1]].map(([r,y])=>new THREE.Vector2(r,y*(.83+variant*.045)));
      return sculptClay(w,new THREE.LatheGeometry(points,14),{amplitude:.06});
    });
    w.mesh(spike,'cream',g,.3+i*Math.max(0,h.w-.6)/Math.max(1,count-1),.025,0);
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

// A view costs whatever its geometry costs to build, and a single stream step
// can want a dozen of them at once. Building the whole step inside one frame is
// what produced the quarter-second freezes; this spends a slice of each frame
// instead, nearest-first, and always completes at least one so the queue can
// never stall. A forced sync — level build, editor rebuild, teleport — still
// runs to completion, because those are already behind a loading screen.
const STREAM_BUDGET_MS=4;
function drainStream(w,budgetMs){
  const queue=w.streamPending;
  if(!queue?.length)return;
  const deadline=performance.now()+budgetMs;
  let built=0;
  // At least one per frame guarantees the queue drains; the budget stops a
  // step that wants a dozen views from spending them all on one frame. A view
  // that overruns the budget on its own is the floor here — geometry for a
  // single platform cannot be built in halves.
  while(queue.length&&(built===0||performance.now()<deadline)){
    const job=queue.shift();
    // The camera may have turned back before this one came up.
    if(!w.streamWanted?.has(job.key)||w.streamViews.has(job.key))continue;
    w.streamViews.set(job.key,{root:job.make(),remove:job.remove});
    built++;
  }
}
export function drainStreamQueue(w,budgetMs=STREAM_BUDGET_MS){drainStream(w,budgetMs);}
export const streamQueueLength=w=>w.streamPending?.length||0;

export function syncStream(w,L,center,force=false){
  const settled=!force&&Math.abs(center-(w.streamCenter??Infinity))<8&&w.streamRevision===(L.dynamicRevision||0);
  // Even when the camera has not moved far enough to re-scan, anything still
  // queued from the last scan keeps arriving.
  if(settled)return drainStream(w,STREAM_BUDGET_MS);
  w.streamRevision=L.dynamicRevision||0;
  w.streamCenter=center;w.streamViews??=new Map();w.streamPending??=[];
  const behind=Math.max(20,(w.viewW||15)*.6+12),ahead=Math.max(34,(w.viewW||15)*.95+17),wanted=new Set();
  const near=(x,width=0,travel=0)=>x+width+travel>center-behind&&x-travel<center+ahead;
  const queued=new Set(w.streamPending.map(job=>job.key));
  // Nearest first, and gameplay before scenery: a deck the player is about to
  // land on must never wait behind a distant silhouette.
  const add=(key,make,remove,at=center,bias=0)=>{
    wanted.add(key);
    if(w.streamViews.has(key)||queued.has(key))return;
    queued.add(key);w.streamPending.push({key,make,remove,priority:Math.abs(at-center)+bias});
  };
  const addScenery=(key,make,remove,at=center)=>add(key,make,remove,at,1e4);
  const arch=greatArchLayout(L);
  if(L.boss&&near(L.boss.left,L.boss.right-L.boss.left))add('boss:mother-puff',()=>{w.motherView=createMotherPuff(w,L.boss);return w.motherView.root;},()=>{w.motherView=null;},L.boss.left);
  if(arch&&near(arch.left,arch.width))addScenery('scenery:great-arch',()=>buildGreatArch(w,arch),()=>{},arch.left);
  for(const s of L.platforms)if(near(s.baseX??s.x,s.w,Math.max(Math.abs(s.moveX||0),s.travel||0)))add('p:'+s.id,()=>{
    const v=w.makePlatform(s);v.guides=(L.guides||[]).filter(guide=>guide.platformId===s.id).map(guide=>guideView(w,guide,s,v));
    for(const guide of v.guides)guide.visible=!s.broken&&s.active!==false;
    w.platforms.set(s.id,v);return v.root;
  },()=>w.platforms.delete(s.id),s.baseX??s.x);
  // A wall's own view keeps collision-aligned bounds (tests/walls.mjs), so the
  // lobes, lip and hanging moss the cave dresses it with are scenery of their
  // own, rebuilt with the platform whenever the editor moves it.
  if(w.biome==='cave')for(const s of L.platforms)if(s.kind==='wall'&&near(s.x,s.w))addScenery('walldress:'+s.id,()=>caveWallDressing(w,s),()=>{},s.x);
  L.hazards.forEach((h,i)=>{if(near(h.x,h.w))add('h:'+i,()=>hazard(w,h),()=>{},h.x);});
  // A defeated creature stays streamed in until its pressed disc has broken.
  // A view dropped before then all the same — one the camera has left far
  // behind — breaks on the spot, so nothing just vanishes.
  for(const e of L.enemies)if((e.alive||squashPending(w.enemyViews?.get(e.id)))&&(near(e.min,e.max-e.min)||near(e.x,1)))add('e:'+e.id,()=>{const v=w.makeEnemy(e);w.enemyViews.set(e.id,v);return v.root;},()=>{
    const v=w.enemyViews.get(e.id);
    if(v&&!e.alive)settleSquash(w,e,v,L.platforms,true);
    releaseEnemyView(v);w.enemyViews.delete(e.id);
  },e.x);
  // A dead creature the level no longer lists keeps its view, too, until the
  // world has broken its disc; world.render settles it from the view itself.
  for(const [id,v]of w.enemyViews||[])if(v.enemy&&!v.enemy.alive&&squashPending(v))wanted.add('e:'+id);
  for(const [list,views,stamp,prefix]of [[L.coins,w.coinViews,false,'c:'],[L.stamps,w.stampViews,true,'s:']])for(const c of list)if(!c.taken&&near(c.x))add(prefix+c.id,()=>views[c.id]=collectible(w,c,stamp),()=>delete views[c.id],c.x);
  L.crushers?.forEach((c,i)=>{if(near(c.x,c.w))add('r:'+i,()=>w.crusherViews[i]=createPressView(w,c),()=>delete w.crusherViews[i],c.x);});
  for(const wind of L.winds||[])if(near(wind.x,wind.w))add('w:'+wind.id,()=>{const v=windView(w,wind);w.windViews.set(wind.id,v);return v.root;},()=>w.windViews.delete(wind.id),wind.x);
  for(const [i,c]of (L.circuits||[]).entries()){
    const nodes=[c.source,...c.targets].map(id=>L.platforms.find(p=>p.id===id)),left=Math.min(...nodes.map(p=>p.x)),right=Math.max(...nodes.map(p=>p.x+p.w));
    if(near(left,right-left))add('wire:'+i,()=>{const v=circuitView(w,L,c);w.circuitViews.set(i,v);return v.root;},()=>w.circuitViews.delete(i),left);
  }
  // Authored decoration streams as scenery: it is never a collider and never
  // gates a jump, so a deck the player is about to land on always builds first.
  w.decorViews??=[];
  (L.decor||[]).forEach((d,i)=>{
    const width=decorSize(d);
    if(near(d.x-width/2,width))addScenery('decor:'+i,()=>w.decorViews[i]=decorView(w,d),()=>delete w.decorViews[i],d.x);
  });
  syncDepthScenery(w,L,near,addScenery);
  // The dream's section modules stream their props the same way (dream.js).
  if(w.biome==='dream')syncDreamScenery(w,L,near,addScenery);
  w.streamWanted=wanted;
  for(const [key,v]of w.streamViews)if(!wanted.has(key)){v.remove();disposeBranch(w,v.root);w.streamViews.delete(key);}
  // Anything queued that the camera has since left behind is dropped unbuilt.
  if(w.streamPending.length){
    w.streamPending=w.streamPending.filter(job=>wanted.has(job.key)&&!w.streamViews.has(job.key));
    w.streamPending.sort((a,b)=>a.priority-b.priority);
  }
  // A forced sync is always behind a loading screen or a fade, so it completes.
  drainStream(w,force?Infinity:STREAM_BUDGET_MS);
  w.flags=w.flags.filter(f=>attached(f,w.levelRoot));w.torches=w.torches.filter(t=>attached(t.flame,w.levelRoot)||attached(t.flame,w.backRoot));
  if(w.bell&&!attached(w.bell,w.levelRoot))w.bell=null;
  // Cache eviction never disposes meshes or materials used by a live region.
  if(clayCacheOverBudget(w)){
    const live=new Set();w.scene.traverse(o=>{if(o.geometry)live.add(o.geometry);});
    trimClayShapes(w,live);
  }
}
