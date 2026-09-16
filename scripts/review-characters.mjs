// Stand the cast side by side in one pose, for an offline look at how a newly
// retargeted character carries the states the others already carry.
//
// Usage: node scripts/review-characters.mjs OUT [STATE] [PHASE] [ID...]
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {createHero,attachHero} from '../dist/hero.js';
import {CHARACTERS,characterChoice} from '../dist/characters.js';
import {readGLB} from '../tests/load-player.mjs';
import {exportReview} from './review-scene.mjs';

const [out,state='idle',phase='0',...ids]=process.argv.slice(2);
if(!out)throw new Error('Usage: node scripts/review-characters.mjs OUT [STATE] [PHASE] [ID...]');
const cast=ids.length?ids.map(characterChoice):CHARACTERS;

const url=name=>new URL('../dist/assets/'+name,import.meta.url);
const json=name=>readFile(url(name),'utf8').then(JSON.parse);
const scene=new THREE.Scene(),back=new THREE.Group(),images=new Map();scene.add(back);
// A floor to read the feet against: a pose that stands on its toes or hovers is
// only obvious next to the ground it is supposed to be standing on.
const span=cast.length*2.6;
const floor=new THREE.Mesh(new THREE.BoxGeometry(span+2,.4,5),new THREE.MeshStandardMaterial({color:0xb08968,roughness:.95}));
floor.position.y=-.2;scene.add(floor);

for(const [i,choice] of cast.entries()){
  // One stage per character, so every rig stays attached and posed at once.
  const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,
    mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
  w.character=createHero(w);w.scene.add(w.character.root);
  const c=w.character,gltf=await readGLB(url(choice.model));
  attachHero(w,gltf,await json(choice.motion),await json(choice.animation),choice);
  const clip=c.clips[state];if(!clip)throw new Error(`No such state: ${state}`);
  for(const action of Object.values(c.actions))action.stop();
  const action=c.actions[state];action.reset().play().setEffectiveWeight(1);
  action.time=clip.duration*Number(phase);c.mixer.update(0);
  c.root.position.set((i-(cast.length-1)/2)*2.6,0,0);
  scene.add(c.root);scene.updateMatrixWorld(true);
  for(const [key,image] of gltf.cpuImages)images.set(key,image);
  const box=new THREE.Box3().setFromObject(c.model,true);
  console.log(`${choice.name}: ${state} at ${phase} stands ${(box.max.y-box.min.y).toFixed(3)} with its lowest point ${box.min.y.toFixed(3)} above the floor`);
}
await exportReview(scene,back,out,{
  camera:{x:0,y:span*.27,z:16,elevation:.05,viewH:span*.58,viewW:span+1.6},
  theme:{skyLight:0xe5f0d7,ambient:2.1,sun:0xffe5b7,sunPower:3.2},sky:'#b7ceba',fog:'#b7ceba',backgroundBlur:0
},images);
