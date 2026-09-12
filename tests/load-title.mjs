import {CLAY_PALETTE} from '../dist/palette.js';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {createHero,attachHero} from '../dist/hero.js';
import {prepareCloudAsset} from '../dist/clouds.js';
import {readPlayer,readGLB} from './load-player.mjs';
import {attachSpitter} from './load-spitter.mjs';
import {attachClay} from './load-clay.mjs';
import {attachCanyon} from './load-canyon.mjs';
import {readFile} from 'node:fs/promises';
import {prepareCityLaundry} from '../dist/city-laundry.js';
import {prepareTitleMesa} from '../dist/title-assets.js';
export async function loadTitleWorld(){
  const w=Object.create(World.prototype);w.scene=new THREE.Scene();w.mat={};w.time=0;w.reducedMotion=false;w.bump=new THREE.Texture();
  for(const [key,color]of Object.entries({orange:CLAY_PALETTE.orange,orangeLight:CLAY_PALETTE.orangeLight,cream:0xf1d8a3,rope:0xdcb985,dark:0x172b3f,gold:0xf8ce75,shadow:0x333b28}))w.mat[key]=new THREE.MeshStandardMaterial({color,roughness:.98,transparent:key==='shadow',opacity:key==='shadow'?.2:1});
  w.renderer={capabilities:{getMaxAnisotropy:()=>4},render(){},setRenderTarget(){}};
  w.character=createHero(w);w.scene.add(w.character.root);w.flags=[];w.particles=[];w.fxRoot=new THREE.Group();w.scene.add(w.fxRoot);
  const player=await readPlayer(),cloud=await readGLB(new URL('../dist/assets/cloud.glb',import.meta.url));
  const data=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url)));
  attachHero(w,player,await data('player-motion.json'),await data('player-idle.json'));prepareCloudAsset(w,cloud);
  const canyon=await attachCanyon(w),clay=await attachClay(w),spitter=await attachSpitter(w);
  const laundry=await readGLB(new URL('../dist/assets/city-laundry.glb',import.meta.url));prepareCityLaundry(w,laundry);
  const mesa=await readGLB(new URL('../dist/assets/title/cactus-mesa.glb',import.meta.url));prepareTitleMesa(w,mesa);
  return {world:w,images:new Map([...player.cpuImages,...cloud.cpuImages,...canyon,...clay,...spitter,...laundry.cpuImages,...mesa.cpuImages])};
}
