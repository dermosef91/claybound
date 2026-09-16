import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {cameraFraming,cameraTarget} from '../dist/camera.js';
import {pressRelayLevel} from './press-relay-fixture.mjs';
const at=(g,s)=>Object.assign(g.player,{x:s.x+s.w/2,y:surfaceAt(s,s.x+s.w/2),vx:0,vy:0,groundId:s.id,coyote:.13});
const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,stompPressed:input.stompPressed&&i===0});};
let checkpoints=0;
for(const [i,L]of LEVELS.entries())for(const cp of L.platforms.filter(s=>s.checkpoint)){
 const g=new Game();g.start(i);const floor=g.level.platforms.find(s=>s.id===cp.id);at(g,floor);g.player.x=cp.checkpoint;g.player.health=1;g.tick(dt,{});
 assert.equal(g.checkpointId,cp.id);assert.equal(g.player.health,RULES.maxHealth);
 for(const s of g.level.platforms)if(s.x<cp.x){if(s.releases){s.broken=true;s.active=false;g.activate(s.releases,s.x,s.y);}if(s.latch||s.kind==='balance')g.activate(s.channel,s.x,s.y);}
 g.level.coins[0].taken=true;g.level.stamps[0].taken=true;g.deaths=2;g.elapsed=123;
 const save=JSON.parse(JSON.stringify(g.snapshot())),resumed=new Game();resumed.start(i);assert(resumed.restore(save));
 assert.equal(resumed.player.x,cp.checkpoint);assert.equal(resumed.player.y,cp.y);assert.equal(resumed.coins,save.coins.length);assert.equal(resumed.stamps,save.stamps.length);assert.equal(resumed.elapsed,123);
 assert.deepEqual(resumed.latched,g.latched);assert.equal(resumed.restore({...save,version:2}),false);
 for(const s of resumed.level.platforms)if(s.kind==='counter'&&resumed.latched[s.channel])assert.equal(s.y,s.baseY+s.rise);
 resumed.player.dropTimer=.2;resumed.player.dropThrough=cp.id;resumed.damage(true);tick(resumed,65);assert.equal(resumed.player.dropTimer,0);assert.equal(resumed.player.health,RULES.maxHealth-1);checkpoints++;
}
console.log('PASS',checkpoints,'checkpoints restore health, collectibles and solved systems; old layouts cannot resume into new geometry');
{
 const g=new Game();g.start(0);const wind=g.level.winds[0];Object.assign(g.player,{x:53,y:7,groundId:null,coyote:0});g.tick(dt,{});assert.equal(g.player.windY,0);
 const valve=g.level.platforms.find(s=>s.id==='valve1');at(g,valve);g.tick(dt,{});assert(g.latched['wind-a']);tick(g,1600);assert.equal(g.channels['wind-a'],1);
 Object.assign(g.player,{x:53,y:7,groundId:null,coyote:0});g.tick(dt,{});assert.equal(g.player.windY,19);
 console.log('PASS windwell has no force before its valve opens, then stays open');
}
{
 const g=new Game();g.start(1);const seal=g.level.platforms.find(s=>s.releases==='tree-spores');Object.assign(g.player,{x:seal.x+1,y:seal.y+1.5,groundId:null,coyote:0});tick(g,30,{stompPressed:true});
 assert(seal.broken);assert(g.latched['tree-spores']);assert(g.level.winds.find(w=>w.channel==='tree-spores').active);
 const floor=g.level.platforms.find(s=>s.id==='tree-heart');at(g,floor);tick(g,15,{stompPressed:true});assert(g.player.y<floor.y-.25);
 console.log('PASS breaking a sealed cap releases its connected spores; thin branches support deliberate drop-through');
}
{
 const g=new Game();g.start(3);const deck=g.level.platforms.find(s=>s.id==='weight1'),lift=g.level.platforms.find(s=>s.id==='counter1');at(g,deck);g.player.x=deck.x+deck.w-.7;tick(g,145);
 assert(g.latched[deck.channel]);assert(lift.y>lift.baseY);assert.equal(g.player.groundId,deck.id);assert(Math.abs(g.player.y-surfaceAt(deck,g.player.x))<.001);
 g.player.groundId=null;g.player.x=deck.x-2;tick(g,160);assert(Math.abs(lift.y-lift.baseY-lift.rise)<.001);assert(Math.abs(deck.angle)<.001);
 console.log('PASS a weighted beam raises the connected ropeway; the raised route remains available after stepping off');
}
{
 const g=new Game();g.start(2,pressRelayLevel);const c=g.level.crushers[0],sw=g.level.platforms.find(s=>s.channel===c.holdChannel&&s.kind==='switch');
 at(g,sw);tick(g,55);assert(g.channels[c.holdChannel]>11);assert.equal(c.y,c.baseY);assert(c.held);assert(g.level.platforms.find(s=>s.id==='press-bridge').active);
 const timer=g.channels[c.holdChannel];g.pause();g.tick(2,{});assert.equal(g.channels[c.holdChannel],timer);g.resume();at(g,g.level.platforms[0]);tick(g,1500);assert.equal(g.channels[c.holdChannel],0);assert(!c.held);
 const pulse=g.level.platforms.find(s=>s.kind==='pulse');g.time=(.64-pulse.phase)*pulse.period;g.tick(dt,{});assert(pulse.active&&pulse.warning);g.time=(.8-pulse.phase)*pulse.period;g.tick(dt,{});assert(!pulse.active);
 console.log('PASS one relay powers its bridge and holds its press; pulse warnings, timeout and pause preserve the machine rhythm');
}
for(const L of LEVELS){
 const wide=cameraFraming(844,390,L.biome),portrait=cameraFraming(390,844,L.biome);assert.equal(wide.viewH,L.biome==='citadel'?10.2:11.6);assert.equal(portrait.viewH,14.2);
 // Portrait may show more world than landscape, but not the near-double it used
 // to, which spent the top of a phone on whatever sat above the route.
 assert(portrait.viewH>wide.viewH&&portrait.viewH<wide.viewH*1.45,'portrait and landscape frame comparable amounts of world');
 const p={x:100,y:20,vy:0,groundId:'floor',facing:1},right=cameraTarget(p,wide.viewW,wide.viewH,true),left=cameraTarget({...p,facing:-1},wide.viewW,wide.viewH,true);assert(right.x>100&&left.x<100);
 for(const guide of L.guides)assert([-1,0,1].includes(guide.dir));
 for(const c of L.circuits){assert(L.platforms.some(s=>s.id===c.source));assert(c.targets.every(id=>L.platforms.some(s=>s.id===id)));}
}
console.log('PASS landscape framing, comparable portrait framing, directional camera lead, and complete connections for every mechanism');
