// Measure the Soft Dream's two supplied creatures against what they dress, for
// tuning GIRAFFE_POSE, the parade's placement and the hatworm's stack.
//
// Usage: node scripts/fit-dream-creatures.mjs
//
// First on a bare rig: the caterpillar's rig and the giraffe's pose in model
// units. Then on the solo parade: the giraffe's skinned extent against its
// four decks, and the hatworm on the giraffe's back against its collider.
import * as THREE from '../dist/lib/three.module.js';
import {readFile} from 'node:fs/promises';
import {Game} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {MODULES,SHELVED,soloSection} from '../dist/routes/dream.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {createCaveLights} from '../dist/cave-lighting.js';
import {animateDream} from '../dist/dream.js';
import {animateEnemy} from '../dist/enemies.js';
import {readPlayer} from '../tests/load-player.mjs';
import {attachClay} from '../tests/load-clay.mjs';
import {attachDream} from '../tests/load-dream.mjs';
import {dreamCaterpillar,dreamGiraffe,skinnedBox} from '../dist/dream-assets.js';
import {GIRAFFE_BONES,GIRAFFE_POSE,CATERPILLAR_RIG} from '../dist/dream-rigs.js';
import {GIRAFFE_WITHERS} from '../dist/dream/parade.js';
import {HATWORM} from '../dist/dream-enemy-rules.js';

const f=v=>(+v).toFixed(2),fv=v=>`(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
const boxLine=(b,label)=>console.log(`  ${label}: x ${f(b.min.x)}…${f(b.max.x)}  y ${f(b.min.y)}…${f(b.max.y)}  z ${f(b.min.z)}…${f(b.max.z)}`);
// Points of the skinned model dominated by one of `names`, in `frame`'s space.
function regionBox(model,names,frame){
  model.updateMatrixWorld(true);
  const inverse=frame.matrixWorld.clone().invert(),box=new THREE.Box3(),v=new THREE.Vector3(),idx=new THREE.Vector4(),wt=new THREE.Vector4();
  model.traverse(o=>{
    if(!o.isSkinnedMesh)return;const g=o.geometry,count=g.attributes.position.count,bones=o.skeleton.bones;
    for(let i=0;i<count;i++){
      idx.fromBufferAttribute(g.attributes.skinIndex,i);wt.fromBufferAttribute(g.attributes.skinWeight,i);
      let best=0,w=-1;for(let k=0;k<4;k++)if(wt.getComponent(k)>w){w=wt.getComponent(k);best=idx.getComponent(k);}
      if(!names.includes(bones[best].name))continue;
      box.expandByPoint(o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).applyMatrix4(inverse));
    }
  });
  return box;
}

const bare={};await attachDream(bare);
console.log('caterpillar stations',CATERPILLAR_RIG.stations.join(' '));
{
  const stage=new THREE.Group(),rig=dreamCaterpillar(bare,stage,1.3);stage.updateMatrixWorld(true);
  boxLine(skinnedBox(rig.model,stage),'caterpillar 1.3 long, at rest');
  const head=regionBox(rig.model,['Caterpillar head bone'],stage);boxLine(head,'  head bone region');
  console.log('  head bone at',fv(rig.head.getWorldPosition(new THREE.Vector3())));
}
{
  const stage=new THREE.Group(),rig=dreamGiraffe(bare,stage,{backTop:4,withersX:7});stage.updateMatrixWorld(true);
  console.log(`giraffe backTop 4, withers at 7: scale ${f(rig.scale)}, yaw ${f(rig.yaw*180/Math.PI)}°, pose`,JSON.stringify(GIRAFFE_POSE));
  boxLine(skinnedBox(rig.model,stage),'whole');
  boxLine(regionBox(rig.model,GIRAFFE_BONES.spine.concat(['tripoRoot']),stage),'body (root+spine)');
  boxLine(regionBox(rig.model,GIRAFFE_BONES.neck.slice(0,2).concat(['tripoSpine_4']),stage),'neck (Head_0/1)');
  boxLine(regionBox(rig.model,GIRAFFE_BONES.neck.slice(2),stage),'head (Head_2/3)');
  for(const name of ['tripoSpine_0','tripoSpine_3','tripoHead_0','tripoHead_2','tripoHead_3'])console.log('  ',name.padEnd(12),fv(rig.model.getObjectByName(name).getWorldPosition(new THREE.Vector3())));
}

// --- the solo parade ------------------------------------------------------------------------
async function cpuWorld(){
  const w=Object.create(World.prototype);
  w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
  for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
  w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
  w.camera=new THREE.OrthographicCamera(-6,6,3.3,-3.3,.1,160);
  w.renderer={render(){},setRenderTarget(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
  w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
  const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
  attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
  await attachClay(w);await attachDream(w);
  return w;
}
const INDEX=LEVELS.findIndex(L=>L.biome==='dream'),parade=[...MODULES,...SHELVED].find(m=>m.key==='parade');
const w=await cpuWorld(),L=soloSection(parade),g=new Game();g.start(INDEX,L);
const platform=id=>g.level.platforms.find(p=>p.id===id);
const back=platform('parade-back'),neck=platform('parade-neck'),headDeck=platform('parade-head'),knee=platform('parade-knee');
w.build(g.level,INDEX,back.x+3);w.syncVisible(g.level,back.x+3,true);g.player.x=back.x+3;animateDream(w,g,0);w.scene.updateMatrixWorld(true);
const model=w.levelRoot.getObjectByName('Supplied clay giraffe');
if(!model)throw new Error('no giraffe on the parade');
console.log(`\nsolo parade: knee ${knee.x}…${knee.x+knee.w} @${knee.y}, back ${back.x}…${back.x+back.w} @${back.y}, neck ${neck.x}…${neck.x+neck.w} @${neck.y}, head ${headDeck.x}…${headDeck.x+headDeck.w} @${headDeck.y}; withers past the deck by ${GIRAFFE_WITHERS}`);
boxLine(skinnedBox(model,w.scene),'giraffe whole (world)');
boxLine(regionBox(model,GIRAFFE_BONES.spine.concat(['tripoRoot']),w.scene),'body');
boxLine(regionBox(model,GIRAFFE_BONES.neck.slice(0,2).concat(['tripoSpine_4']),w.scene),'neck');
boxLine(regionBox(model,GIRAFFE_BONES.neck.slice(2),w.scene),'head');
for(const name of ['tripoSpine_3','tripoHead_0','tripoHead_2','tripoHead_3'])console.log('  ',name.padEnd(12),fv(model.getObjectByName(name).getWorldPosition(new THREE.Vector3())));
// The body's top surface along each deck the player stands on: where the
// model is under the deck's top (a gap the player floats over) or through it.
function profile(model,s,step=.5){
  const v=new THREE.Vector3(),tops=[];
  for(let x=s.x+.25;x<s.x+s.w;x+=step){
    let top=-1e9;
    model.traverse(o=>{if(!o.isSkinnedMesh)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(Math.abs(v.x-x)<step/2&&Math.abs(v.z)<.9&&v.y>top)top=v.y;}});
    tops.push(`${f(x)}:${top<-1e8?'—':(top-s.y>=0?'+':'')+f(top-s.y)}`);
  }
  return tops.join('  ');
}
for(const s of [back,neck,headDeck])console.log(`  ${s.id} top ${s.y} — body surface relative to it, by x:  ${profile(model,s)}`);
// The lean: player far left, far right.
for(const px of [L.platforms[0].x,back.x+60]){
  g.player.x=px;for(let i=0;i<120;i++)animateDream(w,g,1/60);w.scene.updateMatrixWorld(true);
  console.log(`  player at ${px}: head bone at`,fv(model.getObjectByName('tripoHead_3').getWorldPosition(new THREE.Vector3())));
}
// The march: pull the worm all the way, then follow a front foot for two seconds.
{
  const station=g.level.shaping.find(st=>st.id==='parade-worm');station.amount=1;g.player.x=back.x+3;
  const foot=model.getObjectByName('tripo0_Left_Limb_3'),hip=model.getObjectByName('tripo0_Left_Limb_0'),p=new THREE.Vector3();
  const restHip=hip.quaternion.clone();let box=new THREE.Box3();
  // animateDream reads the game clock for the cadence; the probe never ticks the game, so advance it by hand.
  for(let i=0;i<180;i++){g.time+=1/60;animateDream(w,g,1/60);if(i>=60){w.scene.updateMatrixWorld(true);box.expandByPoint(foot.getWorldPosition(p));}}
  console.log(`  marching: front-left foot sweeps x ${f(box.min.x)}…${f(box.max.x)}, y ${f(box.min.y)}…${f(box.max.y)}; hip turned ${f(hip.quaternion.angleTo(restHip)*180/Math.PI)}° from rest at the last frame`);
  station.amount=0;for(let i=0;i<90;i++)animateDream(w,g,1/60);
  console.log(`  asleep again: hip ${f(hip.quaternion.angleTo(restHip)*180/Math.PI)}° from rest`);
  // Leaving: pulled, the player far right; then the player back left.
  station.amount=1;g.player.x=back.x+20;const pivot=w.platforms.get('parade-back').pivot;
  const marks=[];
  for(let i=0;i<60*16;i++){g.time+=1/60;animateDream(w,g,1/60);if(i%120===119){w.scene.updateMatrixWorld(true);marks.push(`${(i/60+1/60).toFixed(0)}s: x ${f(pivot.position.x)} facing ${f(pivot.rotation.y*180/Math.PI)}° ${pivot.visible?'shown':'hidden'}`);}}
  console.log('  leaving:\n    '+marks.join('\n    '));
  g.player.x=back.x-10;for(let i=0;i<10;i++){g.time+=1/60;animateDream(w,g,1/60);}
  console.log(`  player back left: x ${f(pivot.position.x)} facing ${f(pivot.rotation.y*180/Math.PI)}° ${pivot.visible?'shown':'hidden'}`);
  station.amount=0;
}
// The hatworm on the giraffe's back.
const worm=g.level.enemies.find(e=>e.kind==='hatworm'&&e.y===back.y);
const view=w.enemyViews.get(worm.id);
if(!view?.model)throw new Error('the back-deck hatworm has no model view');
for(let i=0;i<30;i++)animateEnemy(view,worm,1/60,'playing');w.scene.updateMatrixWorld(true);
const wb=skinnedBox(view.model,w.scene),hb=new THREE.Box3().setFromObject(view.root.getObjectByName('Hatworm head'),true);
console.log(`hatworm at (${worm.x}, ${worm.y}); collider half ${HATWORM.half} height ${HATWORM.height} perch ${HATWORM.perch}`);
boxLine(wb,'body (world)');boxLine(hb,'hats (world)');
console.log(`  body ${f(wb.max.x-wb.min.x)} long, feet ${f(wb.min.y-worm.y)} above the deck, top of the stack ${f(hb.max.y-worm.y)} above it`);
