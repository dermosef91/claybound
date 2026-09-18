// Close-up of the runtime's fractured slab, bead mesh and health clumps.
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {attachClay} from '../tests/load-clay.mjs';
import {createCrumble,animateCrumble,clayFragments} from '../dist/crumble.js';
import {createBead} from '../dist/beads.js';
import {createHealthClumps,animateHealthClumps} from '../dist/health-hud.js';
import {exportReview} from './review-scene.mjs';
const dir=process.argv[2],w=Object.create(World.prototype);
w.scene=new THREE.Scene();w.levelRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.scene.add(w.levelRoot,w.fxRoot);w.particles=[];w.flags=[];w.mat={};w.biome='desert';w.theme={crumble:'clay'};
for(const [key,color]of Object.entries({top:0xedac54,terrain:0xd16b38,cream:0xf1d8a3,dust:0xf1c798}))w.mat[key]=new THREE.MeshStandardMaterial({color,roughness:.94});
const images=await attachClay(w),s={x:-3,w:6,y:0,kind:'crumble',timer:Number(process.env.CRUMBLE_AGE||.45),delay:1,active:true};
s.active=s.timer<=s.delay;const root=new THREE.Group();root.position.set(s.x,s.y,0);w.levelRoot.add(root);const view={root,fracture:createCrumble(w,s,root)};animateCrumble(w,view,s,1/60);
if(!s.active)clayFragments(w,0,0,6,22,1.1,true);w.updateParticles(.10);
const bead=new THREE.Group();bead.position.set(-2.1,1.6,0);bead.scale.setScalar(2.4);createBead(w,bead);w.scene.add(bead);
const health=createHealthClumps(w);health.clumps.forEach((c,i)=>{c.radius=.42;c.mesh.position.set(.55+i*1.07,1.5,0);w.scene.add(c.mesh);});animateHealthClumps(health,2,36);
await exportReview(w.scene,new THREE.Group(),dir,{camera:{x:0,y:.7,z:26,elevation:7,viewH:4.8,viewW:8},theme:{skyLight:0xfff1dd,ambient:2.1,sun:0xffe5bd,sunPower:3.0},sky:'#e9dfcf',fog:'#e9dfcf',fogNear:100,fogFar:200,backgroundBlur:0},images);
