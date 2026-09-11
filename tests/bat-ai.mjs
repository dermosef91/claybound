import assert from 'node:assert/strict';
import {BAT,initializeEnemy,moveEnemy,batAttacking,batTravelFraction} from '../dist/enemy-rules.js';
import {LEVELS,instantiateLevel} from '../dist/levels.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';

const player=(x=0,y=0)=>({x,y,health:RULES.maxHealth,invuln:0});
function flight(overrides={},p=player()){
  const e={kind:'bat',x:2,y:1.1,min:1,max:4,speed:1.25,bob:0,period:4.6,...overrides};initializeEnemy(e,0);e.cooldown=0;
  const events=[],context={player:p,platforms:[],onEvent:type=>events.push(type)};let time=0;
  return {e,p,events,context,step(n=1){for(let i=0;i<n;i++)moveEnemy(e,dt,time+=dt,context);},until(state,limit=1200){for(let i=0;i<limit&&e.aiState!==state;i++)this.step();assert.equal(e.aiState,state);}};
}
for(const source of LEVELS[2].enemies.filter(e=>e.kind==='bat')){
  const f=flight(source,null),xs=[],directions=new Set();
  for(let i=0;i<1800;i++){f.step();xs.push(f.e.x);directions.add(Math.sign(f.e.vx));assert.equal(f.e.aiState,'patrol');}
  assert(Math.max(...xs)-Math.min(...xs)>2,'each authored bat crosses a real patrol lane');assert(directions.has(-1)&&directions.has(1));
}
const legacy=structuredClone(LEVELS[2]);legacy.enemies=legacy.enemies.filter(e=>e.kind==='bat');legacy.enemies[0].min=legacy.enemies[0].max=legacy.enemies[0].x;
const original=JSON.stringify(legacy),loaded=instantiateLevel(2,legacy);
assert(loaded.enemies[0].max-loaded.enemies[0].min>=1.2);assert.equal(JSON.stringify(legacy),original);assert.equal(loaded.layoutVersion,legacy.layoutVersion);
console.log('PASS all authored bats patrol both ways; old hover-only drafts gain flight lanes without changing saved designs');

for(const side of [-1,1]){
  const f=flight({},player(2+side*2));f.step();assert.equal(f.e.aiState,'retreat');const start={x:f.e.x,y:f.e.y};
  f.until('charge');assert((f.e.x-start.x)*side<0);assert(f.e.y-start.y>2);
  const aim=[f.e.aimX,f.e.aimY],apex=[f.e.x,f.e.y];f.p.x+=side*2;
  f.step(Math.floor(BAT.chargeTime/dt)-1);assert.equal(f.e.aiState,'charge');assert.deepEqual([f.e.x,f.e.y],apex);assert.deepEqual([f.e.aimX,f.e.aimY],aim);
  f.until('dive');assert.equal(f.e.diveVY<0,true);assert(Math.abs(Math.hypot(f.e.diveVX,f.e.diveVY)-BAT.diveSpeed)<1e-8);
  const vector=[f.e.diveVX,f.e.diveVY];f.p.x-=side*3;f.step(5);assert.deepEqual([f.e.diveVX,f.e.diveVY],vector,'no homing after launch');
  f.until('recover');f.until('patrol');assert(f.e.x>=f.e.min&&f.e.x<=f.e.max);assert(Math.abs(f.e.y-f.e.baseY)<.04);
  f.p.x=f.e.x;f.step(120);assert.equal(f.e.aiState,'patrol','cooldown leaves breathing room');assert.deepEqual(f.events,['bat-charge','bat-dive']);
}
for(const p of [player(40),player(2,10),{...player(2),invuln:2},{...player(2),health:0}]){const f=flight({},p);f.step(360);assert.equal(f.e.aiState,'patrol');}
const escaped=flight();escaped.until('charge');escaped.p.x=100;escaped.step();assert.equal(escaped.e.aiState,'recover');escaped.until('patrol');assert(!escaped.events.includes('bat-dive'));
console.log('PASS retreat direction, climb, 650ms warning, locked aim, fast downward dive, recovery, cooldown and disengagement');

const floor={x:-10,y:0,w:20,kind:'stone',active:true};
assert(batTravelFraction(0,2,0,-1,[floor])<1);assert.equal(batTravelFraction(0,2,0,-1,[{...floor,active:false}]),1);
assert.equal(batTravelFraction(0,2,0,-1,[{...floor,broken:true}]),1);
const blocked=flight({x:3,min:2,max:4},player(0));blocked.context.platforms=[{x:1,y:5,w:.3,kind:'stone',active:true}];blocked.step(300);assert.equal(blocked.e.aiState,'patrol','no spotting through a wall');
const groundDive=flight({},player(0,-2));groundDive.context.platforms=[floor];
// Trigger in clear air first, then target a lower point as the retreat ends.
groundDive.p.y=0;groundDive.until('retreat');groundDive.p.y=-2;groundDive.until('dive');groundDive.until('recover');
assert(groundDive.e.y+BAT.bottom>=-1e-5,'dive stops on the deck, without tunnelling');
groundDive.context.player=null;groundDive.until('patrol');
console.log('PASS solid occlusion, swept dive/deck contact, inactive bridges and return from a blocked dive');

function arena(){
  const source=structuredClone(LEVELS[2]);source.spawn={x:0,y:0};source.platforms=[{id:'floor',x:-10,y:0,w:30,kind:'stone',goal:true}];
  source.enemies=[{kind:'bat',x:2,y:1.1,min:1,max:4,speed:1.2,bob:0,period:4.6}];
  source.hazards=[];source.crushers=[];source.winds=[];source.coins=[];source.stamps=[];source.hints=[];source.sections=[];source.end=1000;
  const game=new Game();game.start(2,source);return game;
}
const game=arena(),e=game.level.enemies[0];e.cooldown=0;
for(let i=0;i<300&&e.aiState!=='charge';i++)game.tick(dt);assert.equal(e.aiState,'charge');
game.pause();const frozen=JSON.stringify(e);game.tick(1);assert.equal(JSON.stringify(e),frozen);game.resume();
game.respawn();assert.equal(e.aiState,'patrol');assert(e.cooldown>=2);assert.equal(e.x,e.homeX);
const other={...e,id:1,x:3,homeX:3};game.level.enemies.push(other);game.player.invuln=0;e.cooldown=other.cooldown=0;game.tick(dt);
assert.equal(game.level.enemies.filter(batAttacking).length,1,'nearby edited bats take turns attacking');
e.alive=false;game.respawn();assert.equal(e.alive,false,'respawn does not resurrect defeated bats');assert.equal(other.aiState,'patrol');

for(const state of ['charge','dive','recover']){
  const g=arena(),b=g.level.enemies[0];
  Object.assign(b,{x:2,y:2,aiState:state,stateTime:0,chargeX:2,chargeY:2,aimX:0,aimY:.85,diveVX:0,diveVY:-6,diveDuration:.7,returnViaX:2,returnViaY:3,returnX:2,returnLeg:0});
  Object.assign(g.player,{x:2,y:3.04,vy:-24,groundId:null,coyote:0});
  for(let i=0;i<8&&b.alive;i++)g.tick(dt,{jumpHeld:true});
  assert.equal(b.alive,false,'stomp during '+state);assert.equal(g.player.health,RULES.maxHealth);assert(g.player.vy>0);
}
const hit=arena();hit.level.enemies[0].cooldown=0;
for(let i=0;i<500&&hit.player.health===RULES.maxHealth;i++)hit.tick(dt);
assert.equal(hit.player.health,RULES.maxHealth-1,'standing still is hit by the aimed dive');assert.equal(hit.level.enemies[0].aiState,'recover');
for(let i=0;i<60;i++)hit.tick(dt);assert.equal(hit.player.health,RULES.maxHealth-1,'one dive cannot stack contact damage');
console.log('PASS paused AI, respawn grace, attack coordination, stomp counters in every attack phase and single-hit dive damage');
