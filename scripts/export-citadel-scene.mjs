import {updateCavernMachine} from '../dist/cavern-machines.js';
import {animateCavernMachine} from '../dist/cavern-machine-views.js';
import {updatePress} from '../dist/presses.js';
import {animatePressView} from '../dist/press-views.js';
import {animateCrumble} from '../dist/crumble.js';
import {prepareSporeAsset} from '../dist/spore-puff.js';
import {prepareBatAsset} from '../dist/bats.js';
// Export the actual game meshes for offline visual review when WebGL is absent.
// This is a composition check, not a replacement for browser/device rendering QA.
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {Game} from '../dist/simulation.js';
import {moveEnemy} from '../dist/enemy-rules.js';
import {DRIFTER} from '../dist/drifter-rules.js';
import {createHero,attachHero,animateHero} from '../dist/hero.js';
import {animateEnvironment} from '../dist/environments.js';
import {animateDepthScenery} from '../dist/depth-scenery.js';
import {readPlayer,readGLB} from '../tests/load-player.mjs';
import {prepareEnemyAsset,animateEnemy} from '../dist/enemies.js';
import {prepareCastleAsset} from '../dist/castle.js';
import {prepareCottageAsset} from '../dist/cottage.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {cameraFraming,cameraTarget} from '../dist/camera.js';
import {animateWind} from '../dist/setpieces.js';
import {animateCircuit} from '../dist/mechanism-views.js';
import {exportReview} from './review-scene.mjs';
import {attachClay} from '../tests/load-clay.mjs';
import {attachCanyon} from '../tests/load-canyon.mjs';
import {attachWindmills} from '../tests/load-windmills.mjs';
import {attachForest} from '../tests/load-forest.mjs';
import {attachGrotto} from '../tests/load-grotto.mjs';
import {createCaveLights} from '../dist/cave-lighting.js';
import {attachDrifter} from '../tests/load-drifter.mjs';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
const dir=process.argv[2];if(!dir)throw new Error('Provide an output directory.');await mkdir(dir,{recursive:true});await copyFile(new URL('../dist/assets/clay-height.png',import.meta.url),dir+'/clay-height.png');
const w=Object.create(World.prototype);w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.bump.repeat.set(1.5,1.5);w.mat={};
for(const [key,color]of Object.entries({blue:0x315e96,blueLight:0x3d6da5,blueDark:0x244c7b,orange:0xd85c2d,orangeLight:0xed783a,cream:0xf1d8a3,rope:0xdcb985,dark:0x172b3f,gold:0xf8ce75,ghost:0xf1d8a3,shadow:0x203e62}))w.mat[key]=new THREE.MeshStandardMaterial({color,roughness:.98,bumpMap:w.bump,bumpScale:.085});
w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.character=createHero(w);w.scene.add(w.character.root);w.time=0;
const player=await readPlayer(),enemy=await readGLB(new URL('../dist/assets/enemy.glb',import.meta.url)),castle=await readGLB(new URL('../dist/assets/castle.glb',import.meta.url)),cloud=await readGLB(new URL('../dist/assets/cloud.glb',import.meta.url));
const cottage=await readGLB(new URL('../dist/assets/cottage.glb',import.meta.url));prepareCottageAsset(w,cottage);
attachHero(w,player,JSON.parse(await readFile(new URL('../dist/assets/player-motion.json',import.meta.url))),JSON.parse(await readFile(new URL('../dist/assets/player-idle.json',import.meta.url))));
prepareEnemyAsset(w,enemy,JSON.parse(await readFile(new URL('../dist/assets/enemy-motion.json',import.meta.url))));prepareCastleAsset(w,castle);prepareCloudAsset(w,cloud);
const bat=await readGLB(new URL('../dist/assets/bat.glb',import.meta.url));prepareBatAsset(w,bat);
const drifterImages=await attachDrifter(w);
const spore=await readGLB(new URL('../dist/assets/spore-puff.glb',import.meta.url));prepareSporeAsset(w,spore);
const canyonImages=await attachCanyon(w),windmillImages=await attachWindmills(w),forestImages=await attachForest(w),grottoImages=await attachGrotto(w),clayImages=await attachClay(w),level=Number(process.env.REVIEW_LEVEL??3);
const g=new Game();g.start(level);w.build(g.level,level);
if(process.env.REVIEW_BROKEN){
  const seal=g.level.platforms.find(s=>s.id===process.env.REVIEW_BROKEN);
  if(!seal)throw new Error('Unknown review seal');
  seal.broken=true;seal.active=false;
  if(seal.releases){g.channels[seal.releases]=1;g.latched[seal.releases]=true;}
}
if(process.env.REVIEW_ACTIVE==='1'){
  for(const s of g.level.platforms){if(s.channel){g.channels[s.channel]=10;g.latched[s.channel]=true;}if(s.releases){g.channels[s.releases]=1;g.latched[s.releases]=true;}if(s.kind==='counter')s.y=s.baseY+s.rise;}
  g.level.winds.forEach(w=>w.active=true);
}
Object.assign(w,cameraFraming(Number(process.env.REVIEW_WIDTH||1672),Number(process.env.REVIEW_HEIGHT||941),g.level.biome));
if(process.argv[3]){g.player.x=Number(process.argv[3]);g.player.y=Number(process.argv[4]||0);}
if(process.env.REVIEW_SPORE_STATE){
  const e=g.level.enemies.filter(e=>e.kind==='spore').sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x))[0];
  if(!e)throw new Error('No Spore Puff near this review');
  e.aiState=process.env.REVIEW_SPORE_STATE;e.stateTime=e.aiState==='puff'?.08:.28;e.puffAge=e.aiState==='puff'?.08:e.aiState==='crouch'?.44:10;e.puffX=e.x;e.puffY=e.y+.7;e.puffDir=-1;e.dir=-1;
  if(e.aiState==='leap'){e.y+=1.3;e.leapVY=6;}
}
const enemyFrames=Math.max(0,Math.round(Number(process.env.REVIEW_ENEMY_TIME||0)*120));
for(let i=1;i<=enemyFrames;i++)for(const e of g.level.enemies){
  moveEnemy(e,1/120,i/120,{platforms:g.level.platforms,winds:g.level.winds});
  animateEnemy(w.enemyViews.get(e.id),e,1/120,'playing');
}
g.time=enemyFrames/120;
if(process.env.REVIEW_BAT_CHARGE==='1'){
  const e=g.level.enemies.filter(e=>e.kind==='bat').sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x))[0];
  e.cooldown=0;
  for(let frame=0;frame<180;frame++){
    g.time+=1/120;moveEnemy(e,1/120,g.time,{player:g.player,platforms:g.level.platforms});
    animateEnemy(w.enemyViews.get(e.id),e,1/120,'playing');
    if(e.aiState==='charge'&&e.stateTime>=.2)break;
  }
  if(e.aiState!=='charge')throw new Error('Bat review did not reach a natural charge.');
}
if(process.env.REVIEW_DEFEAT_DRIFTER==='1'){
  const e=g.level.enemies.filter(e=>e.kind==='drifter').sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x))[0];
  Object.assign(g.player,{x:e.x,y:e.y+DRIFTER.halfHeight+.08,vy:-6,groundId:null});
  g.onEvent=event=>w.event(event);
  for(let i=0;i<18;i++){g.tick(1/120,{});w.updateParticles(1/120);}
  if(e.alive||!w.particles.some(q=>q.kind==='drifter-leaf'))throw new Error('Drifter defeat review did not reach the leaf burst.');
}
if(process.env.REVIEW_PRESS_TIME){
  for(let i=0;i<Number(process.env.REVIEW_PRESS_TIME)*120;i++)for(const c of g.level.crushers)updatePress(c,1/120,g.channels,g.level.platforms);
}
if(process.env.REVIEW_CRUMBLE){
  const s=g.level.platforms.find(s=>s.id===process.env.REVIEW_CRUMBLE);s.timer=Number(process.env.REVIEW_CRUMBLE_AGE||.3);s.active=s.timer<=(s.delay||.62);
}
if(process.env.REVIEW_MACHINE_TIME){
  g.time=Number(process.env.REVIEW_MACHINE_TIME);
  for(const s of g.level.platforms)updateCavernMachine(s,g.player,g.time,0,g.channels);
}
if(process.env.REVIEW_FERRY_OFFSET){
  const ferry=g.level.platforms.find(s=>s.kind==='ferry');ferry.x=ferry.baseX+Number(process.env.REVIEW_FERRY_OFFSET);
}
if(process.env.REVIEW_RIDE){
  const ride=g.level.platforms.find(s=>s.id===process.env.REVIEW_RIDE);
  Object.assign(g.player,{x:ride.x+ride.w/2,y:ride.y,groundId:ride.id});
}
if(process.env.REVIEW_SPITTER_CHARGE){
  const e=g.level.enemies.filter(e=>e.kind==='spitter').sort((a,b)=>Math.abs(a.x-g.player.x)-Math.abs(b.x-g.player.x))[0];
  Object.assign(e,{aiState:'charge',stateTime:.7,aimX:g.player.x,aimY:g.player.y+.85,dir:Math.sign(g.player.x-e.x)});
}
g.player.facing=Number(process.env.REVIEW_FACING||1);
const target=cameraTarget(g.player,w.viewW,w.viewH,w.landscape);w.cameraX=target.x;w.cameraY=target.y;
w.syncVisible(g.level,g.player.x,true);
for(const s of g.level.platforms){const v=w.platforms.get(s.id);if(v){v.root.position.set(s.x,s.y,0);v.root.visible=s.active&&!s.broken;}}
for(const s of g.level.platforms){const v=w.platforms.get(s.id);if(v)animateCavernMachine(v,s,w);}
for(const [i,c]of g.level.crushers.entries())animatePressView(w.crusherViews[i],c);
for(const s of g.level.platforms)if(s.kind==='crumble'&&w.platforms.has(s.id)){
  animateCrumble(w,w.platforms.get(s.id),s,1/60);
  if(!s.active){w.event({type:'crumble-collapse',x:s.x+s.w/2,y:s.y,w:s.w});w.updateParticles(.13);}
}
for(const v of w.circuitViews.values())animateCircuit(v,g);
for(const e of g.level.enemies)animateEnemy(w.enemyViews.get(e.id),e,0,g.status);
for(let i=0;i<45;i++){w.time+=1/120;animateHero(w,g,1/120);}
for(const v of w.windViews.values())animateWind(v,.5);
animateEnvironment(w,0);animateDepthScenery(w,g,0);w.scene.updateMatrixWorld(true);
await exportReview(w.scene,w.backRoot,dir,{camera:{x:w.cameraX,y:w.cameraY,z:26,elevation:w.theme.cameraElevation??(level===3?1.25:3.05),viewH:w.viewH,viewW:w.viewW},theme:w.theme,sky:g.level.sky,fog:g.level.fog,fogNear:w.scene.fog.near,fogFar:w.scene.fog.far,backgroundBlur:level===0||level===2?0:level===1?3:.9,lights:w.torchLights.filter(l=>l.intensity>0).map(l=>({position:l.position.toArray(),color:l.color.toArray(),intensity:l.intensity}))},new Map([...player.cpuImages,...drifterImages,...spore.cpuImages,...bat.cpuImages,...enemy.cpuImages,...castle.cpuImages,...cloud.cpuImages,...cottage.cpuImages,...canyonImages,...windmillImages,...forestImages,...grottoImages,...clayImages]));
