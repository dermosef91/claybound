import assert from 'node:assert/strict';
import {Game,FIXED_DT,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {DraftLibrary,DraftSession,selectedObject,validateDraft} from '../dist/editor-model.js';
import {shotWall} from '../dist/spitter-rules.js';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';

const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const library=new DraftLibrary(LEVELS,storage);
for(let index=0;index<4;index++){
  const s=new DraftSession(library,index);s.add('wall',20,4);
  assert.equal(selectedObject(s.level,s.selection).h,4);
  s.set('w',3);s.set('h',8);const wall=structuredClone(selectedObject(s.level,s.selection));
  assert.equal(wall.kind,'wall');assert.equal(wall.y,6);
  s.startChange();s.move(2,1,false);s.commit();s.undo();assert.deepEqual(selectedObject(s.level,s.selection),wall);s.redo();
  const saved=selectedObject(s.level,s.selection);
  const imported=library.read(library.export(index,s.level),index);
  assert.deepEqual(imported.platforms.at(-1),saved);
  assert.deepEqual(new DraftLibrary(LEVELS,storage).get(index).platforms.at(-1),saved);
  s.duplicate();assert.equal(selectedObject(s.level,s.selection).h,8);s.remove();s.undo();assert.equal(s.level.platforms.at(-1).kind,'wall');
  for(const h of [0,-1,81,NaN]){const bad=structuredClone(imported);bad.platforms.at(-1).h=h;assert.throws(()=>validateDraft(bad,LEVELS[index]));}
}
console.log('PASS walls in all chapters: dimensions, history, duplicate/delete, persistence, import/export and invalid-height rejection');

const wall={id:'wall',kind:'wall',x:8,y:6,w:2,h:6};
function game(block=wall){
  const level=structuredClone(LEVELS[0]);
  Object.assign(level,{spawn:{x:2,y:0},end:100,platforms:[{id:'start',kind:'ledge',x:-5,y:0,w:30},{...block},{id:'finish',kind:'ledge',x:100,y:0,w:4,goal:true}],coins:[],stamps:[],enemies:[],hazards:[],winds:[],crushers:[],circuits:[]});
  const g=new Game();g.start(0,level);return g;
}
const ticks=(g,count,input={})=>{for(let i=0;i<count;i++)g.tick(FIXED_DT,input);};
for(const direction of [-1,1]){
  const g=game();g.player.x=direction===1?6:12;ticks(g,180,{moveAxis:direction});
  assert.equal(g.player.x,direction===1?wall.x-RULES.radius:wall.x+wall.w+RULES.radius);
  assert.equal(g.player.y,0);assert.equal(g.player.health,3);
  ticks(g,20,{moveAxis:-direction});assert(direction===1?g.player.x<7:g.player.x>11,'player can move away from a wall');
}
{
  const g=game();Object.assign(g.player,{x:9,y:8,groundId:null,vy:-26});ticks(g,80);
  assert.equal(g.player.y,6);assert.equal(g.player.groundId,'wall');
  ticks(g,20,{stompPressed:true});assert.equal(g.player.y,6,'stomping cannot break or drop through a wall');
}
{
  const g=game({...wall,x:5,w:12,y:5,h:2});g.player.x=9;
  g.tick(FIXED_DT,{jumpPressed:true,jumpHeld:true});let highest=0;
  for(let i=0;i<100;i++){g.tick(FIXED_DT,{jumpHeld:true});highest=Math.max(highest,g.player.y);assert(g.player.y+RULES.height<=3+1e-6);assert.equal(g.player.x,9,'head contact must not eject the player sideways');}
  assert(Math.abs(highest-(3-RULES.height))<1e-6);assert.equal(g.player.y,0);
  ticks(g,200,{moveAxis:1});assert(g.player.x>17,'pass freely below the ceiling');
}
{
  const g=game({...wall,w:.6});Object.assign(g.player,{x:7,y:1,vx:250,groundId:null});g.tick(FIXED_DT,{});
  assert.equal(g.player.x,8-RULES.radius,'swept sides catch fast movement through a narrow wall');
}
{
  const g=game({...wall,y:2,h:2});Object.assign(g.player,{x:7,vx:RULES.speed});g.tick(FIXED_DT,{moveAxis:1,jumpPressed:true,jumpHeld:true});ticks(g,90,{moveAxis:1,jumpHeld:true});
  assert(g.player.x>10,'player can jump over a short wall');
}
assert(shotWall(5,1,12,1,[wall])<Infinity,'shots hit the lower portion');
assert.equal(shotWall(5,-1,12,-1,[wall]),Infinity,'shots pass below a floating block');
assert.equal(shotWall(5,7,12,7,[wall]),Infinity,'shots pass above the block');
console.log('PASS wall collision: both sides, move away, landing, stomp, ceiling, passage below, jump over, high speed and projectile cover');

for(const biome of ['desert','forest','cave','citadel','dream']){
  const world=Object.create(World.prototype);world.biome=biome;world.levelRoot=new THREE.Group();world.mat={terrain:new THREE.MeshStandardMaterial()};
  for(const [w,h] of [[.6,.6],[2,8],[12,2],[80,80]]){
    const view=world.makePlatform({...wall,w,h}),bounds=new THREE.Box3().setFromObject(view.root);
    assert(Math.abs(bounds.min.x-wall.x)<.2);assert(Math.abs(bounds.max.x-(wall.x+w))<.2);
    assert(Math.abs(bounds.max.y-wall.y)<.2);assert(Math.abs(bounds.min.y-(wall.y-h))<.2);
    assert(view.root.children.some(c=>c.isMesh),'every biome renders wall geometry');
  }
}
console.log('PASS wall geometry: all five biomes, narrow/tall/wide/maximum dimensions and collision-aligned bounds (CPU scene check)');
