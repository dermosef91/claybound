import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
import {prepareMotherPuff,createMotherArenaFloor,createMotherPuff,animateMotherPuff,motherCamera,motherViewHeight,CLOUD_OPACITY} from '../dist/mother-puff.js';
import {MOTHER_PUFF as M,motherIntroTarget,motherCapHeight,motherSporePosition} from '../dist/mother-puff-rules.js';
import {TRAIL} from '../dist/mother-puff-trail.js';
import {updateMotherAtmosphere} from '../dist/mother-puff-hud.js';
import {disposeBranch} from '../dist/streaming.js';
import {readGLB} from './load-player.mjs';
import {attachForest,attachBlighted} from './load-forest.mjs';
import {attachClay} from './load-clay.mjs';

const w=Object.assign(Object.create(World.prototype),{scene:new THREE.Scene(),levelRoot:new THREE.Group(),fxRoot:new THREE.Group(),particles:[],mat:{},reducedMotion:false});
for(const name of ['cream','bark','top','terrain','terrain2'])w.mat[name]=new THREE.MeshStandardMaterial();
await attachClay(w);await attachForest(w);await attachBlighted(w);
for(const [key,triangles]of [['corrupt-tree',21343],['corrupt-mushroom',20305],['semi-tree',20850],['semi-mushroom',20405]]){
 const url=new URL(`../dist/assets/mother-puff-${key}.glb`,import.meta.url),bytes=await readFile(url);
 const manifest=JSON.parse(await readFile(new URL(`../dist/assets/mother-puff-${key}.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.shippedSha256);assert.equal(bytes.length,manifest.shippedBytes);
 assert(bytes.length<2400000,`${key} ships within the scenery budget`);assert.equal(manifest.triangles,triangles);assert(manifest.geometryUnchanged);
 assert.equal(manifest.textures.length,3);assert(manifest.textures.every(size=>Math.max(...size)<=1024),'blighted sculptures ship mobile-sized textures');
 const asset=w.blightedAssets[key];assert(asset.size.x>0&&asset.size.y>0);
 let count=0;asset.scene.traverse(o=>{if(o.isMesh){count+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry));assert(w.assetMaterials.has(o.material));}});
 assert.equal(count,triangles);
}
for(const [pose,triangles]of [['idle',10448],['cast',10428],['friendly',18749]]){
 const url=new URL(`../dist/assets/mother-puff-${pose}.glb`,import.meta.url),gltf=await readGLB(url),bytes=await readFile(url),manifest=JSON.parse(await readFile(new URL(`../dist/assets/mother-puff-${pose}.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.shippedSha256);assert.equal(bytes.length,manifest.shippedBytes);assert(bytes.length<(pose==='friendly'?1300000:1100000));assert.equal(manifest.triangles,triangles);assert(manifest.geometryUnchanged);
 assert.equal(manifest.textures.length,3);assert(manifest.textures.every(size=>Math.max(...size)<=1024),'every pose ships mobile-sized textures');
 prepareMotherPuff(w,pose,gltf);const asset=w.motherAssets[pose];assert(asset.scale>0);assert.equal(gltf.animations.length,0);
 let count=0;asset.scene.traverse(o=>{if(o.isMesh){count+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry));assert(w.assetMaterials.has(o.material));}});assert.equal(count,triangles);
}
const game=new Game();game.start(1);w.currentLevel=game.level;const b=game.level.boss;Object.assign(game.player,{x:281.5,y:b.y,groundId:'mother-arena'});
const floor=new THREE.Group();createMotherArenaFloor(w,game.level.platforms.find(p=>p.motherArena),floor);w.platforms=new Map([['mother-arena',{root:floor}]]);
assert.equal(floor.userData.motherCorruption.length,2);assert(floor.userData.motherPorous.every(p=>p.poreCount>0),'ground uses the actual porous ledge geometry');
const v=w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(v.models.idle.visible&&!v.models.cast.visible);assert.equal(v.pose.rotation.y,-Math.PI/4);assert.equal(v.bodyGrey.value,.38,'undisturbed boss begins slightly afflicted');
v.root.updateMatrixWorld(true);
for(const m of Object.values(v.models)){const box=new THREE.Box3().setFromObject(m,true);assert(Math.abs(box.min.y-b.y)<.001);assert(Math.abs(box.max.y-b.y-6.4)<.001);}
let disposed=0;for(const r of [...w.assetGeometry,...w.assetMaterials])r.addEventListener('dispose',()=>disposed++);
b.state='release';b.stateTime=.25;game.time=2.5;b.lastShotTime=2.31;animateMotherPuff(w,game);assert(!v.models.idle.visible&&v.models.cast.visible);assert.equal(v.pose.rotation.y,-Math.PI/4,'casting keeps the same turn toward the player');assert(!v.root.getObjectByName('Blocking black arch')&&!v.root.getObjectByName('Rigid root curtain'));
assert(v.pose.scale.y<1&&v.pose.scale.x>1&&v.pose.rotation.x>0,'each shot compresses the body and nods forward');
game.pause();const pose=()=>JSON.stringify([v.pose.scale.toArray(),v.pose.rotation.toArray()]);const frozen=pose();game.tick(3);animateMotherPuff(w,game);assert.equal(pose(),frozen);game.time+=.5;animateMotherPuff(w,game);assert.equal(v.pose.scale.y,1);assert.equal(v.pose.rotation.x,0,'the firing pulse settles between shots');
w.reducedMotion=true;b.state='sleeping';animateMotherPuff(w,game);const still=pose();game.time=20;animateMotherPuff(w,game);assert.equal(pose(),still);w.reducedMotion=false;
b.state='recover';b.spores=[{id:12,color:'orange',x:287,y:39,startX:b.x,startY:b.y+6.9,targetX:285.1,targetY:b.y,age:.4,duration:1.85}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);
const air=v.effects.get('air:12');let rings=0;air.marker.traverse(o=>o.geometry?.addEventListener('dispose',()=>rings++));b.spores=[];b.patches=[{id:12,color:'orange',x:285.1,y:b.y,age:1,life:12,bounceAge:10}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);assert(!air.marker.parent&&!air.root.parent);assert.equal(rings,1);
const cap=v.effects.get('ground:12');assert(cap.springPad?.pad.getObjectByName('Forest springPad'),'orange pads reuse the established bounce-pad model');cap.root.updateWorldMatrix(true,true);const padBox=new THREE.Box3().setFromObject(cap.springPad.pad,true);assert(Math.abs(padBox.max.y-(b.y+M.padHeight))<.001,'the asset top matches the bounce collision plane');b.patches=[];animateMotherPuff(w,game);assert.equal(v.effects.size,0);assert(!cap.root.parent);
b.state='defeated';b.stateTime=2;animateMotherPuff(w,game);assert(!v.pose.visible);
disposeBranch(w,v.root);assert.equal(disposed,0,'unloading the clearing retains the supplied models and shared materials');
w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(!w.motherView.pose.visible,'a rebuilt arena stays hidden after victory');assert.equal(disposed,0);
const {document}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8')),mist=document.getElementById('mother-mist');
assert.equal(document.getElementById('mother-hud'),null,'no boss name, description or health bar');
b.state='recover';b.hits=1;game.player.sporeSlow=1;game.status='playing';updateMotherAtmosphere(game,mist,true);assert(!mist.classList.contains('hidden'));
updateMotherAtmosphere(game,mist,false);assert(mist.classList.contains('hidden'));game.player.sporeSlow=0;updateMotherAtmosphere(game,mist,true);assert(mist.classList.contains('hidden'));
const view=w.motherView;
b.hits=0;b.state='recover';b.healing=0;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,3);
view.root.updateMatrixWorld(true);const swollen=new THREE.Box3().setFromObject(view.growth.bands[0].root,true);assert(swollen.max.y>b.y+6.4&&swollen.max.y<b.y+7.6,'separate plugs sit close to the original cap');assert(view.growth.bands.every(x=>!x.sack),'no balloon-shaped cap is added');assert(view.environment.corruption.filter(p=>p.side==='right').every(p=>p.amount===1));assert(view.environment.corruption.some(p=>p.side==='left'&&p.amount>.6));assert(view.environment.corruption.some(p=>p.side==='left'&&p.amount<.2));assert(view.environment.porous.every(p=>p.poreCount>0));
const baseColor=w.motherAssets.idle.scene.children[0]?.material?.color?.getHex();
b.hits=1;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,2);assert.equal(view.bodyGrey.value,.25);
b.hits=2;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,1);assert.equal(view.bodyGrey.value,.12);
b.hits=3;b.state='veil';b.stateTime=1.4;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,0);assert.equal(view.pose.scale.y,1);assert(view.pose.visible&&!view.healed.visible);assert.equal(view.clouds.material.opacity,1);assert(view.environment.porous.every(p=>!p.root.visible));assert(floor.userData.motherPorous.every(p=>!p.root.visible),'all porous bricks disappear on the final landing');
b.state='transform';b.stateTime=.5;animateMotherPuff(w,game);assert(!view.pose.visible&&view.healed.visible);assert.equal(view.clouds.material.opacity,1,'models exchange only under an opaque veil');assert.equal(view.healed.scale.y,1);
b.state='reveal-form';b.stateTime=2.6;animateMotherPuff(w,game);assert(!view.pose.visible&&view.healed.visible);assert.equal(view.clouds.material.opacity,0);view.healed.updateWorldMatrix(true,true);const healedBox=new THREE.Box3().setFromObject(view.healed,true);assert(Math.abs(healedBox.min.y-b.y)<.001&&Math.abs(healedBox.max.y-b.y-M.friendlyHeight)<.001,'friendly model is fully formed on the ground');assert(M.friendlyHeight>=M.height*.9,'healed form remains large relative to the original body');assert.equal(view.healed.rotation.y,-Math.PI/4);
assert(!view.root.getObjectByName('Blocking black arch')&&!view.root.getObjectByName('Rigid root curtain'),'arches are absent throughout the encounter');
b.state='bloom';b.stateTime=2;b.healing=.6;animateMotherPuff(w,game);assert(!view.pose.visible&&!view.healed.visible);assert(!view.environment.flowers,'victory adds no new plants');assert(view.environment.winds.every(v=>v.spore&&v.root.visible&&v.bits.length===24&&v.clouds.length===9),'healing reuses established spore winds');assert(view.environment.corruption.filter(p=>p.amount).every(p=>p.uniform.value<p.amount));
b.state='defeated';b.healing=1;b.stateTime=3;animateMotherPuff(w,game);assert(!view.friendly.root.visible);assert(view.environment.winds.every(v=>!v.root.visible));assert(floor.userData.motherCorruption.every(p=>p.uniform.value<.1),'ground recovers its color');assert(view.environment.porous.every(p=>!p.root.visible)&&floor.userData.motherPorous.every(p=>!p.root.visible),'porous bricks stay absent after victory');
assert.equal(w.motherAssets.idle.scene.children[0]?.material?.color?.getHex(),baseColor,'original asset material stays unchanged');
let afflicted;view.models.idle.traverse(o=>{if(o.isMesh)afflicted=o.material;});
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};afflicted.onBeforeCompile(shader);
assert(shader.fragmentShader.includes('motherGrey'));assert(shader.fragmentShader.includes('claySurface'));assert(shader.uniforms.motherCorruption===view.bodyGrey,'corruption preserves the clay shading and uses view-owned state');
assert.equal(motherCamera(b,{...game.player,x:b.x+1},30,18,true),null,'victory releases the camera before the right exit');
b.state='reveal';b.hits=0;b.stateTime=0;
assert.equal(motherViewHeight(b,1280,720,true,14),14,'entrance begins with the normal camera scale');
b.stateTime=M.reveal/2;assert.equal(motherViewHeight(b,1280,720,true,14),16.4,'camera opens gradually throughout the walk');
b.stateTime=M.reveal;
const introHeight=motherViewHeight(b,390,844,false),introWidth=introHeight*390/844,intro=motherCamera(b,{x:motherIntroTarget(b),y:b.y},introWidth,introHeight,false);
assert(intro.x-introWidth/2<motherIntroTarget(b)-.32&&intro.x+introWidth/2>b.x+3.5,'portrait reveal contains the entrance destination and the full cap');
for(const state of ['reveal','inhale','release','recover','hurt']){b.state=state;b.hits=0;animateMotherPuff(w,game);assert(view.pose.visible,'the battle body stays on screen');assert.equal(view.pose.rotation.y,-Math.PI/4);assert(view.environment.porous.every(p=>p.root.visible)&&floor.userData.motherPorous.every(p=>p.root.visible),'retry restores the corrupted brick scenery');}
b.hits=3;b.state='farewell';b.stateTime=.8;animateMotherPuff(w,game);assert.equal(view.clouds.material.opacity,1);const envelope=view.clouds.parts.map(p=>p.m.position.y+p.m.scale.y);assert(Math.max(...envelope)>M.friendlyHeight,'farewell veil expands to cover the larger healed form');
{
 // The four supplied sculptures stand in for the clearing's own trees and
 // caps on the blighted side, and healing has to put every one of them back.
 const env=view.environment;
 assert.equal(env.blighted.length,6,'two stone trees, two stone caps and two half-turned pairs');
 assert(env.blighted.every(p=>p.stone&&p.green),'every stone sculpture is paired with the healthy model it replaces');
 assert.deepEqual(env.blighted.map(p=>p.stone.name).sort(),
   ['Blighted corrupt-mushroom','Blighted corrupt-mushroom','Blighted corrupt-tree','Blighted corrupt-tree','Blighted semi-mushroom','Blighted semi-tree']);
 // Yaws read off the sculptures themselves: each half-turned pair carries its
 // stone on one flank, and that flank has to end up facing the boss.
 for(const p of env.blighted){
  if(p.stone.name==='Blighted semi-tree')assert.equal(p.stone.rotation.y,0);
  if(p.stone.name==='Blighted semi-mushroom')assert(Math.abs(p.stone.rotation.y-Math.PI*.75)<1e-9);
 }
 // The reference's raised shoulders are scenery only. They must stay behind
 // the fighting plane, or the recorded encounter no longer holds.
 view.root.updateMatrixWorld(true);
 const shoulders=[];env.root.traverse(o=>{if(o.name==='Pored shoulder of the clearing')shoulders.push(o);});
 assert.equal(shoulders.length,2,'a pored shoulder closes each end of the clearing');
 for(const s of shoulders)assert(new THREE.Box3().setFromObject(s,true).max.z<1,'a shoulder never reaches the fighting plane');
 assert(w.mat.crumbleGrey,'the clearing borrows the crumbling ledge stone');
 const brick=env.porous.find(p=>p.root.isMesh);
 assert.equal(brick.root.material.color.getHex(),w.mat.crumbleGrey.color.getHex(),'pored bricks use the crumbling ledge grey, not a greyed brown deck');
 b.hits=0;b.state='release';b.stateTime=.2;b.healing=0;animateMotherPuff(w,game);
 assert(env.blighted.every(p=>p.stone.visible&&!p.green.visible),'the fight shows stone, never the trees it stands in for');
 b.hits=3;b.state='bloom';b.stateTime=2;b.healing=.6;animateMotherPuff(w,game);
 assert(env.blighted.every(p=>!p.stone.visible&&p.green.visible),'the healing breeze swaps every stone sculpture for a healthy one');
 assert(env.porous.every(p=>!p.root.visible)&&floor.userData.motherPorous.every(p=>!p.root.visible),'healing removes every pored fragment, including the ground crust');
 b.state='defeated';b.healing=1;b.stateTime=3;animateMotherPuff(w,game);
 assert(env.blighted.every(p=>!p.stone.visible&&p.green.visible),'the recovered clearing keeps no corrupted asset');
 assert(env.corruption.every(p=>p.uniform.value<.1),'and no corrupted material tint');
}
{
 // Recovery has to be something the player watches her do. Drive the real
 // ending and require the blight to be gone before the last veil takes her.
 const g=new Game();g.start(1);const boss=g.level.boss,v=w.motherView=createMotherPuff(w,boss);
 Object.assign(g.player,{x:boss.x-6,y:boss.y,groundId:'mother-arena'});
 Object.assign(boss,{hits:3,state:'veil',stateTime:0,healing:0,healTime:0,spores:[],patches:[],queue:[]});
 let seen=false,curedWhileSeen=false,healingWhileSeen=0,lastSeenState=null;
 for(let i=0;i<Math.round(16/FIXED_DT)&&boss.state!=='defeated';i++){
  g.tick(FIXED_DT);animateMotherPuff(w,g);
  if(!v.healed.visible)continue;
  seen=true;lastSeenState=boss.state;healingWhileSeen=Math.max(healingWhileSeen,boss.healing);
  if(v.environment.blighted.every(p=>!p.stone.visible&&p.green.visible))curedWhileSeen=true;
 }
 assert(seen,'the healed form appears during the ending');
 assert(boss.healing>0&&lastSeenState,'healing runs while she is on screen');
 assert(curedWhileSeen,'every stone sculpture is already replaced while the healed form is still visible');
 assert(healingWhileSeen>.6,`recovery is well advanced in her presence, reached ${healingWhileSeen.toFixed(2)}`);
 assert.equal(boss.state,'defeated');assert.equal(boss.healing,1);
}
{
 // The two battle sculptures stand in for animation frames, so drive a real
 // volley and confirm hard cuts: alert only around each cast, resting between.
 const g=new Game();g.start(1);const boss=g.level.boss,frames=w.motherView=createMotherPuff(w,boss);
 g.tick(FIXED_DT);animateMotherPuff(w,g);
 assert.equal(boss.state,'sleeping');assert(frames.models.idle.visible&&!frames.models.cast.visible,'the undisturbed clearing rests on the idle sculpture');
 Object.assign(g.player,{x:boss.triggerX,y:boss.y,groundId:'mother-arena'});g.tick(FIXED_DT);assert.equal(boss.state,'reveal');
 for(let i=0;i<Math.round(M.reveal*.6/FIXED_DT);i++)g.tick(FIXED_DT);
 animateMotherPuff(w,g);assert(frames.models.idle.visible,'the walk-in holds the idle sculpture until the first wind-up');
 const seen=new Set(),held=[];let casts=0,total=0,alert=0,run=0;
 while(casts<10&&total<Math.round(20/FIXED_DT)){
  // Park above the combat plane: this measures pose timing, not survival.
  Object.assign(g.player,{x:boss.left+2,y:boss.y+12,vy:0,groundId:null});
  g.tick(FIXED_DT);animateMotherPuff(w,g);total++;
  const casting=frames.models.cast.visible;
  assert.equal(frames.models.idle.visible,!casting,'exactly one battle sculpture is on screen');
  for(const s of boss.spores)if(!seen.has(s.id)){seen.add(s.id);casts++;assert(casting,'the alert sculpture is on screen as each spore leaves the crown');}
  if(casting){alert++;run++;}else if(run){held.push(run*FIXED_DT);run=0;}
 }
 assert.equal(casts,10,'the loop covers a full ten-cast volley');
 assert.equal(held.length,9,'each cast holds its own alert frame, then cuts back to rest');
 assert(held.slice(1).every(seconds=>seconds>.5&&seconds<.7),'an alert frame lasts the wind-up plus the throw, well inside the 1.4s gap');
 assert(alert<total*.55,'the idle sculpture holds the majority of the volley');
 Object.assign(boss,{state:'recover',stateTime:0,spores:[],patches:[],queue:[]});
 Object.assign(g.player,{x:boss.x-1,y:boss.y+motherCapHeight(boss)+.05,vx:0,vy:-15,groundId:null,motherBounce:false,stomping:false,motherPush:0});
 g.tick(FIXED_DT);assert.equal(boss.state,'hurt');animateMotherPuff(w,g);
 assert(frames.models.idle.visible,'a struck boss drops out of the casting pose');
 w.reducedMotion=true;animateMotherPuff(w,g);assert(frames.models.cast.visible,'reduced motion holds the alert pose rather than cutting between frames');w.reducedMotion=false;
}
{
 // A flying spore sheds a trail the simulation never sees: clay motes on its
 // recorded arc and a translucent powder that lingers past the landing.
 const g=new Game();g.start(1);const boss=g.level.boss;
 const fly=(id,color,age)=>{const s={id,color,startX:boss.x,startY:boss.y+motherCapHeight(boss)-.35,targetX:boss.x-14,targetY:boss.y,age,duration:M.flight};return Object.assign(s,motherSporePosition(s,age/s.duration));};
 const trail=()=>w.particles.filter(q=>q.kind==='mother-trail'),motes=()=>trail().filter(q=>!q.haze),haze=()=>trail().filter(q=>q.haze);
 const shape=()=>JSON.stringify(trail().map(q=>[q.mesh.position.toArray(),q.mesh.scale.toArray(),q.life,q.mesh.material.opacity]));
 const begin=()=>{w.particles=[];w.fxRoot.clear();w.motherView=createMotherPuff(w,boss);Object.assign(boss,{state:'recover',stateTime:0,spores:[],patches:[],queue:[]});};
 begin();const s=fly(40,'purple',.5);boss.spores=[s];animateMotherPuff(w,g);
 assert.equal(motes().length,Math.floor(s.age/TRAIL.moteGap)+1,'one mote for every shed interval since the crown');assert.equal(haze().length,Math.floor(s.age/TRAIL.hazeGap)+1);
 for(const [k,q]of motes().entries()){const at=motherSporePosition(s,k*TRAIL.moteGap/s.duration);assert(Math.hypot(q.mesh.position.x-at.x,q.mesh.position.y-at.y)<.45+.75*(s.age-k*TRAIL.moteGap),'motes scatter tightly around the recorded arc and drift with age');}
 assert(motes().every(q=>q.mesh.material===w.motherMaterials.purple&&!q.mesh.material.transparent),'motes are the spore\'s own clay');
 assert(haze().every(q=>q.mesh.material.transparent&&!q.mesh.material.depthWrite&&q.mesh.material.opacity<=TRAIL.hazeOpacity&&q.ownedMaterials.has(q.mesh.material)),'powder is translucent and owns its material');
 assert.equal(w.fxRoot.children.length,trail().length,'the trail lives in the effect root rather than the arena');
 const first=shape();begin();boss.spores=[fly(40,'purple',.5)];animateMotherPuff(w,g);assert.equal(shape(),first,'the trail is a pure function of the spore');
 animateMotherPuff(w,g);assert.equal(shape(),first,'a spore that has not aged sheds nothing new');
 w.updateParticles(0);assert.equal(shape(),first,'pause freezes the trail');
 const [moteCount,hazeCount]=[motes().length,haze().length];boss.spores=[fly(40,'purple',.62)];animateMotherPuff(w,g);
 const crossed=gap=>Math.floor(.62/gap)-Math.floor(.5/gap);assert.equal(motes().length,moteCount+crossed(TRAIL.moteGap));assert.equal(haze().length,hazeCount+crossed(TRAIL.hazeGap),'ageing sheds exactly the intervals crossed');
 const sink=motes()[0].mesh.position.y,rise=haze()[0].mesh.position.y;w.updateParticles(.15);
 assert(motes()[0].mesh.position.y<sink&&haze()[0].mesh.position.y>rise,'clay settles while powder drifts up');assert(haze()[0].mesh.material.opacity<TRAIL.hazeOpacity,'the oldest powder is already thinning');
 const owned=haze().map(q=>q.mesh.material);let gone=0,sharedGone=0;for(const m of owned)m.addEventListener('dispose',()=>gone++);for(const m of Object.values(w.motherMaterials))m.addEventListener('dispose',()=>sharedGone++);
 const linger=trail().length;boss.spores=[];boss.patches=[{id:40,color:'purple',x:boss.x-14,y:boss.y,age:0,life:M.blastLife,radius:2.15,bounceAge:10}];animateMotherPuff(w,g);
 assert(!w.motherView.effects.has('air:40')&&w.motherView.effects.has('ground:40'));assert.equal(trail().length,linger,'the trail outlives the projectile');
 for(let i=0;i<120;i++)w.updateParticles(1/60);
 assert.equal(trail().length,0);assert.equal(w.fxRoot.children.length,0);assert.equal(gone,owned.length,'every powder material is released');assert.equal(sharedGone,0,'shared clay materials are untouched');
 begin();w.particles=Array.from({length:TRAIL.limit},()=>({kind:'filler'}));boss.spores=[fly(41,'green',.5)];animateMotherPuff(w,g);assert.equal(w.particles.length,TRAIL.limit,'a full pool sheds nothing rather than overflowing');assert.equal(w.fxRoot.children.length,0);
 begin();w.reducedMotion=true;boss.spores=[fly(42,'green',.5)];animateMotherPuff(w,g);assert.equal(haze().length,0,'reduced motion drops the drifting powder');assert.equal(motes().length,Math.floor(.5/(TRAIL.moteGap*2))+1,'and halves the mote density');w.reducedMotion=false;
 // Landed white clouds are seen through; the projectile, its ring and every
 // other colour's ground effect keep their solid clay.
 begin();boss.spores=[fly(43,'white',.3)];boss.patches=[{id:44,color:'white',x:boss.x-10,y:boss.y,age:.1,life:M.cloudLife,radius:2.6,bounceAge:10},{id:45,color:'purple',x:boss.x-8,y:boss.y,age:.1,life:M.blastLife,radius:2.15,bounceAge:10}];animateMotherPuff(w,g);
 const air=w.motherView.effects.get('air:43'),cloud=w.motherView.effects.get('ground:44'),blast=w.motherView.effects.get('ground:45');
 assert(air.parts.length===15&&air.parts.every(p=>p.m.material===w.motherMaterials.white&&!p.m.material.transparent),'the flying white cluster stays solid clay');
 assert(air.marker.children.every(m=>!m.material.transparent),'the landing ring stays opaque');
 assert(motes().every(q=>q.mesh.material===w.motherMaterials.white),'white motes stay solid clay');
 assert(cloud.parts.length===15&&cloud.parts.every(p=>p.m.material===w.motherMaterials.cloud),'a landed white cloud shares one translucent material');
 assert(CLOUD_OPACITY>.25&&CLOUD_OPACITY<.6,'semi-transparent: the field stays readable through the cloud');
 const {cloud:mist}=w.motherMaterials;assert(mist.transparent&&!mist.depthWrite&&mist.opacity===CLOUD_OPACITY&&mist.color.getHex()===w.motherMaterials.white.color.getHex());
 assert(w.assetMaterials.has(mist),'the shared cloud material survives level rebuilds');
 for(const m of [mist,haze()[0].mesh.material]){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);assert(shader.fragmentShader.includes('diffuseColor.a *= pow( saturate( normal.z )'),'billows fade toward their rims instead of ending in a hard silhouette');assert(!shader.fragmentShader.includes('claySurface'),'powder skips the clay relief');}
 assert.notEqual(mist.customProgramCacheKey(),haze()[0].mesh.material.customProgramCacheKey(),'different rim falloffs compile to different programs');
 assert(blast.parts.every(p=>p.m.material===w.motherMaterials.purple),'other colours keep opaque ground effects');
 begin();
}
console.log('PASS Mother Puff assets: seven supplied GLBs, grounding, stop-motion cast/idle frames, pause, effects cleanup, deterministic spore trails, translucent white clouds, blighted sculptures and borrowed crumbling stone, scenery-only shoulders, corruption cleared on healing, absent arches, opaque transformation, healing winds and gradual/released camera');
