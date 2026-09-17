// The world the scene checks are made against: a real Three.js scene graph
// with every supplied model parsed into it, and a renderer that is asked to
// draw but never does. Building it costs a fraction of a second, which is why
// the scene checks can be several files that each stand one up rather than one
// long file that has to run start to finish.
//
// This is CPU-side geometry. Nothing here claims to test GPU drawing or
// shader compilation.
import * as THREE from '../../dist/lib/three.module.js';
import {readFile} from 'node:fs/promises';
import {World} from '../../dist/world.js';
import {createHero,attachHero} from '../../dist/hero.js';
import {readPlayer,readGLB} from '../load-player.mjs';
import {prepareEnemyAsset} from '../../dist/enemies.js';
import {prepareCastleAsset} from '../../dist/castle.js';
import {prepareCottageAsset} from '../../dist/cottage.js';
import {prepareCloudAsset} from '../../dist/clouds.js';
import {prepareCityLaundry} from '../../dist/city-laundry.js';
import {prepareSporeAsset} from '../../dist/spore-puff.js';
import {prepareMotherPuff} from '../../dist/mother-puff.js';
import {prepareBatAsset} from '../../dist/bats.js';
import {prepareTitleMesa} from '../../dist/title-assets.js';
import {createCaveLights} from '../../dist/cave-lighting.js';
import {attachCanyon} from '../load-canyon.mjs';
import {attachWindmills} from '../load-windmills.mjs';
import {attachForest} from '../load-forest.mjs';
import {attachGrotto} from '../load-grotto.mjs';
import {attachDrifter} from '../load-drifter.mjs';
import {attachClay} from '../load-clay.mjs';
import {attachSpitter} from '../load-spitter.mjs';

const asset=name=>new URL('../../dist/assets/'+name,import.meta.url);
const data=async name=>JSON.parse(await readFile(asset(name)));

export async function sceneStage(){
  const w=Object.create(World.prototype);
  w.scene=new THREE.Scene();w.scene.background=new THREE.Color();w.scene.fog=new THREE.Fog(0,32,90);w.bump=new THREE.Texture();w.mat={};
  for(const key of ['blue','blueDark','blueLight','orange','orangeLight','cream','rope','dark','gold','ghost','shadow'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff,transparent:key==='shadow'});
  w.hemi=new THREE.HemisphereLight();w.sun=new THREE.DirectionalLight();w.fill=new THREE.DirectionalLight();w.torchLights=createCaveLights();
  w.camera=new THREE.OrthographicCamera(-6,6,3.3,-3.3,.1,160);
  // Exercise scene updates without claiming GPU drawing or shader compilation.
  w.renderer={render(){},setRenderTarget(){},setSize(){},getDrawingBufferSize(v){return v.set(1280,720);},shadowMap:{autoUpdate:true},capabilities:{getMaxAnisotropy(){return 4;}}};
  // The editor reads the canvas for its framing; play does not, but a stage
  // with one is the same stage for both, and it saves each file remembering.
  w.canvas={getBoundingClientRect:()=>({width:900,height:600})};
  w.levelRoot=new THREE.Group();w.backRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.backRoot,w.fxRoot);w.time=0;w.character=createHero(w);w.scene.add(w.character.root);
  attachHero(w,await readPlayer(),await data('player-motion.json'),await data('player-idle.json'));
  prepareEnemyAsset(w,await readGLB(asset('enemy.glb')),await data('enemy-motion.json'));
  prepareBatAsset(w,await readGLB(asset('bat.glb')));
  prepareCastleAsset(w,await readGLB(asset('castle.glb')));
  prepareCottageAsset(w,await readGLB(asset('cottage.glb')));
  prepareCloudAsset(w,await readGLB(asset('cloud.glb')));
  prepareCityLaundry(w,await readGLB(asset('city-laundry.glb')));
  await attachCanyon(w);
  await attachWindmills(w);
  await attachForest(w);
  await attachGrotto(w);
  await attachDrifter(w);
  prepareSporeAsset(w,await readGLB(asset('spore-puff.glb')));
  await attachClay(w);
  for(const pose of ['idle','cast','friendly'])prepareMotherPuff(w,pose,await readGLB(asset(`mother-puff-${pose}.glb`)));
  await attachSpitter(w);
  prepareTitleMesa(w,await readGLB(asset('title/cactus-mesa.glb')));
  return w;
}
