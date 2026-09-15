import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {createHealthClumps,animateHealthClumps,HealthHUD} from '../dist/health-hud.js';
import {createBead} from '../dist/beads.js';
import {attachClay} from './load-clay.mjs';
const w={mat:{},assetGeometry:new Set(),assetMaterials:new Set()};await attachClay(w);
const hud=createHealthClumps(w);assert.equal(hud.clumps.length,3);
const before=hud.clumps.map(c=>c.mesh.rotation.clone());animateHealthClumps(hud,3,20);
assert(hud.clumps.every((c,i)=>!c.mesh.rotation.equals(before[i])));assert(new Set(hud.clumps.map(c=>c.mesh.rotation.y.toFixed(3))).size===3);
const turns=hud.clumps.map(c=>c.mesh.rotation.clone());animateHealthClumps(hud,2,4,true);assert(hud.clumps.every((c,i)=>c.mesh.rotation.equals(turns[i])),'reduced motion freezes decorative rotation');
assert(hud.clumps[1].mesh.material===hud.clay&&hud.clumps[2].mesh.material===hud.empty);
assert(hud.clumps[2].mesh.scale.x<hud.clumps[0].mesh.scale.x);
for(const c of hud.clumps){const box=new THREE.Box3().setFromObject(c.mesh,true);assert(box.max.z-box.min.z>10,'each health indicator is solid 3D geometry');}
const root=new THREE.Group(),bead=createBead(w,root);assert(bead.geometry===createBead(w,root).geometry,'beads reuse one mesh');
const positions=bead.geometry.attributes.position;
let center=-Infinity,recess=-Infinity,rim=-Infinity;
for(let i=0;i<positions.count;i++){const radius=Math.hypot(positions.getX(i),positions.getY(i)),z=positions.getZ(i);if(radius<.04)center=Math.max(center,z);if(radius>.12&&radius<.17)recess=Math.max(recess,z);if(radius>.20)rim=Math.max(rim,z);}
assert(center>recess+.04&&rim>recess+.02,'bead has the reward artwork’s raised dot, recessed face and rolled rim');
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert(html.includes('3 health remaining'));assert(html.includes('class="hud-bead" src="./assets/completion/bead.webp"'));assert(html.includes('class="hud-flower" src="./assets/completion/flower.webp"'));assert(!html.includes('data-lucide="flower-2"'),'The HUD flower uses the shared clay artwork, not a line icon');assert(!html.includes('chapter-status'));assert(!html.includes('chapter-label'));assert(!html.includes('progress-track'));
// Exercise screen coordinates and the final draw pass using the same renderer.
globalThis.window={addEventListener(){}};
const calls=[];let surface={left:0,top:0,width:800,height:400};
w.canvas={getBoundingClientRect:()=>surface};w.renderer={autoClear:true,clearDepth(){calls.push('depth');},render(scene,camera){calls.push({scene,camera});}};
const slots=Array.from({length:3},(_,i)=>({getBoundingClientRect:()=>({left:20+i*36,top:16,width:28,height:28})}));
const el={children:slots,classList:{add(){}}},view=new HealthHUD(w,el),game={status:'playing',player:{health:3}};
view.draw(game,1/60);assert(w.renderer.autoClear);assert.equal(calls[0],'depth');assert.equal(calls[1].scene,view.view.scene);assert.equal(view.view.clumps[0].mesh.position.y,370);
surface.height=800;view.onResize();view.draw(game,1/60);assert.equal(view.view.camera.top,800);assert.equal(view.view.clumps[0].mesh.position.y,770);
console.log('PASS three solid rotating clay clumps, independent motion, empty health state, reduced motion, responsive overlay draw, and recessed clay beads');
