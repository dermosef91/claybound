import assert from 'node:assert/strict';
import {Game,RULES,FIXED_DT as dt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {PRESS,pressTouches} from '../dist/presses.js';
import {pressRelayLevel} from './press-relay-fixture.mjs';
const ticks=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,input);};
const stand=(g,p)=>Object.assign(g.player,{x:p.x+p.w/2,y:p.y,vx:0,vy:0,groundId:p.id,invuln:0});
for(let index=0;index<2;index++){
  const events=[],g=new Game(e=>events.push(e));g.start(2,pressRelayLevel);g.level.enemies=[];g.level.hazards=[];
  const c=g.level.crushers[index];
  let floor=g.level.platforms.find(p=>p.id===c.supportId);
  if(!floor){floor={id:'press-test-deck',x:c.x-2,y:c.floorY,w:4,kind:'ledge',baseX:c.x-2,baseY:c.floorY,prevX:c.x-2,prevY:c.floorY,active:true};g.level.platforms.push(floor);}
  assert(floor);assert.equal(c.bottomY-PRESS.halfHeight,floor.y);
  let lowest=Infinity;const states=new Set();
  for(let i=0;i<Math.ceil(c.period*2/dt);i++){g.tick(dt);lowest=Math.min(lowest,c.y);states.add(c.state);}
  assert(Math.abs(lowest-PRESS.halfHeight-floor.y)<1e-8);assert(['rest','warning','slam','impact','retract'].every(s=>states.has(s)));
  assert.equal(events.filter(e=>e.type==='press-impact'&&e.x===c.x).length,2);
  stand(g,floor);g.player.x=c.x;const health=g.player.health;
  for(let i=0;i<c.period/dt&&g.player.health===health;i++)g.tick(dt);
  assert.equal(g.player.health,health-1,'an active press hits a player beneath it');
  const sw=g.level.platforms.find(p=>p.kind==='switch'&&p.channel===c.holdChannel);
  g.respawnTimer=0;stand(g,sw);ticks(g,90);assert(c.held&&c.y===c.baseY);
  const before=structuredClone(c);g.pause();ticks(g,100);assert.deepEqual(c,before);g.resume();
  stand(g,floor);g.player.x=c.x;g.player.health=RULES.maxHealth;ticks(g,300);assert.equal(g.player.health,RULES.maxHealth,'the linked switch provides a safe crossing');
  stand(g,g.level.platforms[0]);ticks(g,Math.ceil((sw.duration+c.period*1.5)/dt));assert(!c.held);
  assert(events.filter(e=>e.type==='press-impact'&&e.x===c.x).length>=3,'the machine resumes after the switch expires');
}
assert(pressTouches({x:0,w:1.6,y:0,prevY:5,held:false},{x:0,y:1},RULES),'fast downward motion cannot tunnel through a player');
console.log('PASS both presses reach their floors, warn/slam/retract, damage, hold on the linked switch, resume, and freeze on pause');

{
  const source={...structuredClone(LEVELS[0]),spawn:{x:1,y:2},platforms:[{id:'start',x:-8,w:60,y:0,kind:'stone'},{id:'fragile',x:0,w:4,y:2,kind:'crumble',delay:.8},{id:'end',x:54,w:12,y:0,kind:'stone',goal:true}],enemies:[],hazards:[],crushers:[],winds:[],coins:[],stamps:[],end:62};
  const events=[],g=new Game(e=>events.push(e));g.start(0,source);const s=g.level.platforms[1];g.tick(dt);
  assert(s.timer>0&&s.active);assert.equal(events.filter(e=>e.type==='crumble').length,1);
  ticks(g,60);assert(s.active);const age=s.timer;g.pause();ticks(g,240);assert.equal(s.timer,age);g.resume();
  ticks(g,42);assert(!s.active);assert(g.player.y<2,'a collapsed deck releases the player');
  ticks(g,110);assert.equal(events.filter(e=>e.type==='crumble-collapse').length,1,'one collapse event per break');
  ticks(g,260);assert(s.active&&s.timer===0,'the deck reforms for retries');
  stand(g,s);ticks(g,10);g.respawn();assert(s.active&&s.timer===0);
}
console.log('PASS crumble warning, collision removal, one debris burst, pause, timed recovery and respawn reset');
{
  const g=new Game();g.start(0);assert.equal(g.player.health,3);assert.equal(RULES.maxHealth,3);
  g.damage();assert.equal(g.player.health,2);g.player.invuln=0;g.damage();assert.equal(g.player.health,1);g.player.invuln=0;g.damage();assert(g.respawnTimer>0);ticks(g,61);assert.equal(g.player.health,3);
  const cp=g.level.platforms.find(p=>p.checkpoint);stand(g,cp);g.player.x=cp.checkpoint;g.player.health=1;g.tick(dt);assert.equal(g.player.health,3);
  const restored=new Game();restored.start(0);assert(restored.restore(g.snapshot()));assert.equal(restored.player.health,3);
}
console.log('PASS three-health maximum, three-hit defeat, respawn, checkpoints and saved-run restore');
