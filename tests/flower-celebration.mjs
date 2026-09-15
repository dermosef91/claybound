import assert from 'node:assert/strict';
import {Game,FIXED_DT,FLOWER_CELEBRATION_DURATION} from '../dist/simulation.js';

assert.equal(FLOWER_CELEBRATION_DURATION,.5);
for(const airborne of [false,true]){
 const events=[],g=new Game(e=>events.push(e));g.start(0);
 const platform=g.level.platforms.find(s=>s.kind==='lift')||g.level.platforms[0],flower=g.level.stamps[0];
 Object.assign(g.player,{x:platform.x+platform.w/2,y:platform.y+(airborne?3:0),vx:airborne?3:0,vy:airborne?4:0,groundId:airborne?null:platform.id});
 Object.assign(flower,{x:g.player.x,y:g.player.y+.8});g.tick(FIXED_DT);
 assert(g.flowerCelebration);assert.equal(g.stamps,1);assert.equal(events.filter(e=>e.type==='stamp').length,1);
 const before={x:g.player.x,y:g.player.y,time:g.time,elapsed:g.elapsed};
 for(let i=0;i<24;i++)g.tick(FIXED_DT,{right:true,jumpHeld:airborne});
 assert(g.player.x>before.x,'movement continues during the flourish');
 if(airborne)assert.notEqual(g.player.y,before.y,'airborne physics continues during the flourish');
 assert(g.time>before.time&&g.elapsed>before.elapsed,'world and run clocks continue');
 g.pause();const t=g.flowerCelebration.time;for(let i=0;i<300;i++)g.tick(FIXED_DT);assert.equal(g.flowerCelebration.time,t);
 g.resume();let ticks=24;
 while(g.flowerCelebration&&ticks<62){g.tick(FIXED_DT);ticks++;}
 assert(Math.abs(ticks*FIXED_DT-.5)<FIXED_DT+1e-9,'the flourish ends at half a second');
 assert.equal(g.flowerCelebration,null);
 assert(g.player.x>before.x&&g.time>before.time,'gameplay continues through the end of the flourish');
 assert.equal(events.filter(e=>e.type==='flower-resume').length,1);
 g.tick(FIXED_DT,{right:true});assert.equal(g.stamps,1);
 assert.deepEqual(g.snapshot().stamps,[flower.id]);
 g.flowerCelebration={time:.5,id:flower.id};g.start(1);assert.equal(g.flowerCelebration,null);
}
console.log('PASS flower celebration: grounded/airborne pickup, concurrent movement/world/run clocks, manual pause, half-second cleanup, one reward, save and chapter reset');
