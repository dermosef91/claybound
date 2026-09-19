import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import playground from '../dist/routes/clay-playground.js';
import {nearbyStation,visitStation} from '../dist/shaping.js';
import {cloneGame,steer} from './routes.mjs';
const original=JSON.stringify(LEVELS),source=JSON.stringify(playground);
const boot=()=>{const g=new Game();g.start(3,playground);return g;};
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:i===0&&input.jumpPressed,stompPressed:i===0&&input.stompPressed});};
assert.equal(LEVELS.length,5);
assert.equal(new Set(playground.platforms.map(p=>p.id)).size,playground.platforms.length);
// Five workshop experiments, plus the three stations chapter four now owns and
// the playground inherits with the rest of its copy of that chapter.
assert.deepEqual(playground.shaping.map(s=>s.id),['lift','ramp','landing','stairs','bridge','roof-ramp','laundry-stairs','belfry-span']);
for(const definition of playground.shaping){
  const g=boot();assert(visitStation(g,definition.id));
  assert.equal(nearbyStation(g).id,definition.id);
  step(g,230,{shapeHeld:true});
  const station=g.level.shaping.find(s=>s.id===definition.id);assert.equal(station.amount,1);
  for(const id of station.parts){const p=g.level.platforms.find(p=>p.id===id);for(const [key,value] of Object.entries(p.shape.to))assert.equal(p[key],value,`${id}.${key}`);}
  const amount=station.amount;g.pause();step(g,120,{shapeReset:true});assert.equal(station.amount,amount);g.resume();
  assert(visitStation(g,station.id,{reset:true}));step(g,150);assert.equal(station.amount,0);
  assert.equal(g.deaths,0);console.log('PASS shape, pause and reset:',station.name);
}
{
  const g=boot();visitStation(g,'ramp');step(g,240,{shapeHeld:true});
  // Long enough to walk the whole ramp at the pace a climb is taken at, which
  // is a little under the pace on the level.
  step(g,260,{right:true});assert(g.player.x>39&&g.player.y>=4.39,'ramp is walkable without jumping');assert.equal(g.deaths,0);
  console.log('PASS continuous ramp collision from dock to roof');
}
{
  const g=boot();visitStation(g,'landing');const s=g.level.platforms.find(s=>s.id==='soft-landing');
  Object.assign(g.player,{x:s.x+s.w*.7,y:s.y,groundId:s.id});step(g,220,{shapeHeld:true});
  assert.equal(g.player.groundId,s.id);assert(Math.abs(g.player.y-s.y)<.01);assert(Math.abs((g.player.x-s.x)/s.w-.7)<.01,'passenger moves with stretching clay');
  g.damage(true);step(g,75);assert.equal(g.level.shaping[2].amount,1,'shapes survive checkpoint respawn');
  console.log('PASS stretching passenger carry and checkpoint recovery');
}
for(const id of ['lift','bridge']){
  const g=boot();visitStation(g,id);const station=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(s=>s.id===station.parts[0]);
  Object.assign(g.player,{x:s.x+s.w/2,y:s.y+1.5,groundId:null,vy:0,coyote:0});step(g,90,{stompPressed:true});
  assert(station.amount>=.49,'stomp presses the clay');
  if(id==='lift')assert(g.level.platforms.find(s=>s.id==='kneaded-lift').y<4,'support causally lowers lift');
}
console.log('PASS stomp presses the support and bridge');
{
  const g=boot(),lift=g.level.platforms.find(s=>s.id==='kneaded-lift');
  Object.assign(g.player,{x:lift.x+lift.w/2,y:lift.y,groundId:lift.id});
  step(g,230,{shapeHeld:true});assert.equal(g.player.groundId,lift.id);assert.equal(g.player.y,1.4);
  step(g,180,{shapeId:'lift',shapeAmount:.35});assert(Math.abs(g.level.shaping[0].amount-.35)<1e-8);
  assert.equal(g.player.groundId,lift.id);assert(Math.abs(g.player.y-lift.y)<1e-8);
  console.log('PASS lift passenger carry while kneading and reversing to an intermediate pose');
}

// A continuous workshop playthrough using only normal movement and shaping input.
// Search takeoff timing from actual arrivals; replay all successful inputs from spawn.
function attempt(start,link,offset,hold){
  const g=cloneGame(start),a=g.level.platforms.find(s=>s.id===link.from),b=g.level.platforms.find(s=>s.id===link.to),inputs=[];
  let launched=false,age=0;
  for(let i=0;i<950;i++){
    const p=g.player,station=nearbyStation(g);let aim=b.x+b.w/2,jumpPressed=false;
    if(station&&station.amount<1){const input={moveAxis:0,shapeHeld:true};g.tick(dt,input);inputs.push(input);if(g.deaths)return null;continue;}
    const walk=(['ramp-dock','soft-ramp'].includes(a.id)&&['soft-ramp','ramp-roof'].includes(b.id))||a.id==='lift-roof'||a.id==='stair-roof'||a.id==='soft-bridge';
    if(!launched&&link.mode!=='fall'&&!walk){const takeoff=a.x+a.w-offset;aim=takeoff;if(p.groundId===a.id&&Math.abs(p.x-takeoff)<.15){jumpPressed=true;launched=true;aim=b.x+b.w/2;}}
    const input={moveAxis:steer(g,aim),jumpPressed,jumpHeld:!launched||age<hold};inputs.push(input);g.tick(dt,input);if(launched)age++;
    if(p.groundId===b.id)return {g,inputs};if(g.deaths||g.respawnTimer)return null;
    if(launched&&age>20&&p.groundId&&p.groundId!==a.id)return null;
  }return null;
}
let g=boot(),inputs=[];
for(const link of g.level.routeLinks.slice(0,17)){
  let result;
  for(const offset of [.5,.8,1.2,1.7]){for(const hold of [180,60,35,20]){result=attempt(g,link,offset,hold);if(result)break;}if(result)break;}
  assert(result,`workshop crossing ${link.from} → ${link.to}`);g=result.g;inputs.push(...result.inputs);
}
const replay=boot();for(const input of inputs)replay.tick(dt,input);
assert.equal(replay.player.groundId,'start');assert.equal(replay.deaths,0);assert(replay.level.shaping.slice(0,5).every(s=>s.amount===1));
assert.equal(JSON.stringify(LEVELS),original);assert.equal(JSON.stringify(playground),source);
console.log('PASS workshop playthrough:',inputs.length,'input frames, all 5 shapes, no deaths; original chapter and source untouched');
