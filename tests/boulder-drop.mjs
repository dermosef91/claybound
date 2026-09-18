// The Boulder Drop: a rock on the canyon's mesa that leaves its clay over an
// open end, falls in the world, smashes the planks over the summit's cave and
// comes to rest on the cave floor — and the room around it: a wind the valve
// wakes, ledges only that wind reaches, planks no stomp breaks, and a save
// that keeps the rock down.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt} from '../dist/simulation.js';
import {createForm,formHeight} from '../dist/clay-form.js';
import {MARBLE,createMarble,resetMarble,stepMarble,stepRockFall} from '../dist/clay-marble.js';
import {formSolutionInputs} from '../dist/clay-rules.js';
import {resetStation} from '../dist/shaping.js';

const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:input.jumpPressed&&i===0});};
const deck=(g,id)=>g.level.platforms.find(s=>s.id===id);
const stand=(g,s,x=s.x+s.w/2)=>Object.assign(g.player,{x,y:s.y,vx:0,vy:0,groundId:s.id,coyote:.13,invuln:0});
const canyon=()=>{const g=new Game();g.start(0);g.level.enemies=[];g.onEvent=()=>{};return g;};
const station=g=>g.level.shaping.find(s=>s.id==='boulder-run');
const steer=(g,aim)=>Math.max(-1,Math.min(1,((aim-g.player.x)*7-(g.player.windX||0)*.16)/6.7));

// --- the marble alone --------------------------------------------------------------
{
 // A lean that is steep in the middle: high on the left, low on the right.
 const f=createForm(20,4,[[0,3.6],[1,.6]],{free:true});
 const boxed=createMarble(8,{radius:.5});
 for(let i=0;i<1800;i++)stepMarble(boxed,f,dt);
 assert(!boxed.spilled&&boxed.x<=20-boxed.r+1e-9,'a marble with benches at both ends stays in its trough');
 const rock=createMarble(8,{radius:1.5,spill:'right'});
 let t=0;while(!rock.spilled&&t<20){stepMarble(rock,f,dt);t+=dt;}
 assert(rock.spilled,'a marble with an open right end goes over it');
 assert(rock.x>20-1e-9,'it leaves with its centre past the brink, not a radius short of it');
 assert(rock.vx>=MARBLE.exit-1e-9&&rock.vx<=MARBLE.top+1e-9,'and with at least the exit speed');
 assert.equal(rock.y,formHeight(f,rock.x)+rock.r,'remembering the height it left at');
 const before={...rock};stepMarble(rock,f,dt);assert.deepEqual({...rock},before,'the form no longer moves a spilled marble');
 resetMarble(rock);assert(rock.spilled&&rock.x>20-1e-9,'nor does a reset bring it back');
 // The fall: the rock leaves a mass standing at x289 y52 h4, over planks it
 // may break, a pillar beside them and a floor under everything, with a wall
 // face past the planks.
 rock.wx=289+rock.x;rock.wy=48+rock.y;rock.vy=0;
 const decks=[{id:'planks',x:309,w:8,top:40,breakable:true},{id:'pillar',x:309,w:3,top:40},{id:'floor',x:312,w:10,top:34.6}];
 const walls=[{x:317,w:2,top:43,bottom:40},{x:317,w:17,top:52,bottom:43}];
 const hits=[];let n=0;
 while(!rock.landed&&n++<1200)for(const h of stepRockFall(rock,dt,{decks,walls}))hits.push(h.id);
 assert.deepEqual(hits,['planks','floor'],'it comes down on the planks, passes them, and lands on the floor');
 assert(rock.landed&&rock.groundId==='floor'&&Math.abs(rock.wy-(34.6+rock.r))<1e-9,'resting on the floor with its radius above it');
 assert(rock.wx>312&&rock.wx<317-rock.r+1e-9,'inside the gap the planks spanned');
 const rest=rock.wx;for(let i=0;i<600;i++)stepRockFall(rock,dt,{decks,walls});
 assert(Math.abs(rock.wx-rest)<3&&rock.vx===0,'and rolls out to a stop');
 // A fast rock meets the wall past the planks and is thrown back into the gap.
 const fast=createMarble(19.9,{radius:1.5,spill:'right'});Object.assign(fast,{spilled:true,wx:309,wy:52,vx:MARBLE.top,vy:0});
 n=0;while(!fast.landed&&n++<1200)stepRockFall(fast,dt,{decks,walls});
 assert(fast.landed&&fast.groundId==='floor'&&fast.wx<317-fast.r+1e-9,'the wall face keeps a fast rock in the gap');
 console.log('PASS the marble: benches box it, an open end spills it once and for good, and a spilled rock falls, breaks, bounces and rests in the world');
}

// --- the room ----------------------------------------------------------------------
const flank=g=>{
 // From the plateau, straight up under the first flank ledge, jump held.
 const plateau=deck(g,'boulder-plateau'),ledge=deck(g,'flank-1');
 stand(g,plateau,ledge.x+ledge.w/2);let top=g.player.y;
 for(let i=0;i<720;i++){g.tick(dt,{moveAxis:steer(g,ledge.x+ledge.w/2),jumpPressed:i===0,jumpHeld:true});top=Math.max(top,g.player.y);if(g.player.groundId===ledge.id)break;}
 return {top,landed:g.player.groundId===ledge.id};
};
{
 const g=canyon();
 const cold=flank(g);
 assert(!cold.landed&&cold.top<deck(g,'flank-1').y-1,`the flank is out of reach before the valve (rose to ${cold.top.toFixed(2)})`);
 assert(!g.level.winds.find(w=>w.id==='well-c').active,'the well over the mill is still');
 // Landing on the valve wakes the well for good.
 const valve=deck(g,'valve3');Object.assign(g.player,{x:valve.x+valve.w/2,y:valve.y+.5,vx:0,vy:-1,groundId:null});tick(g,30);
 assert(g.latched['wind-c']&&g.level.winds.find(w=>w.id==='well-c').active,'the valve latches the well');
 const warm=flank(g);
 assert(warm.landed,'and in the draught the same jump lands on the first flank ledge');
 // The mesa top is calm: the well ends under it.
 stand(g,deck(g,'boulder-mount'));tick(g,30);assert.equal(g.player.windY,0,'no draught on the working stand');
 console.log('PASS the wind: the flank waits on the valve, and the well that lifts to it stops below the mesa');
}
{
 // Left alone, the boulder sits in its hollow and the planks hold.
 const g=canyon(),st=station(g);
 stand(g,deck(g,'boulder-mount'));tick(g,2400);
 assert(!st.ball.spilled&&Math.abs(st.ball.x-st.marble.x)<1e-9&&!deck(g,'plank-floor').broken,'untouched, the boulder stays and the planks hold');
 // No stomp breaks the planks.
 Object.assign(g.player,{x:313,y:45,vx:0,vy:0,groundId:null});
 for(let i=0;i<180;i++)g.tick(dt,{stompPressed:i===2});
 assert(!deck(g,'plank-floor').broken&&g.player.groundId==='plank-floor','a stomp lands on the planks and leaves them whole');
 console.log('PASS the planks: whole under a boulder at rest, whole under a stomp');
}
let save;
{
 // The authored solution, as the pilot plays it: the strokes through the
 // real hand, then standing and watching.
 const g=canyon(),st=station(g),planks=deck(g,'plank-floor'),events=[];
 g.onEvent=e=>{if(['break','spill','rock-land','activate'].includes(e.type))events.push(e);};
 stand(g,deck(g,'boulder-mount'),st.spawn.x);
 for(const input of formSolutionInputs(g,st,{dt}))g.tick(dt,input);
 assert(st.amount<1&&!st.done,'the strokes alone do not finish the station');
 let k=0;for(;k<1440&&!st.done;k++)g.tick(dt,{});
 assert(st.done&&st.ball.spilled&&st.ball.smashed>=1,`the boulder goes over and smashes something (${k} ticks after the last stroke)`);
 assert(planks.broken&&planks.active===false,'the planks are gone');
 assert(events.some(e=>e.type==='spill'),'the room hears it leave');
 assert(events.some(e=>e.type==='break'&&e.platformId==='plank-floor'&&!e.spore),'and hears the planks break');
 assert(g.latched['boulder-down']&&events.some(e=>e.type==='activate'&&e.channel==='boulder-down'),'done opens the station channel');
 tick(g,600);
 assert(st.ball.landed&&st.ball.groundId==='cave-floor'&&st.ball.wx>312&&st.ball.wx<317,`it rests on the cave floor under the hole (x ${st.ball.wx.toFixed(2)})`);
 assert.equal(st.amount,1);assert(st.announced);
 // R softens the clay; the boulder stays down and the cave stays open.
 resetStation(st,g);tick(g,60);
 assert(st.ball.spilled&&st.ball.landed&&st.done&&planks.broken,'a reset does not bring the boulder back or close the cave');
 // The player follows it: across the pool, off the edge, through the hole,
 // onto the summit — no death from the plateau's flag.
 stand(g,deck(g,'boulder-mount'),st.spawn.x);g.checkpoint={x:280,y:32.8};g.checkpointId='boulder-plateau';
 let lastX=g.player.x,stuck=0;
 for(let i=0;i<900&&g.player.groundId!=='summit';i++){
  stuck=g.player.groundId&&Math.abs(g.player.x-lastX)<.004?stuck+1:0;lastX=g.player.x;
  g.tick(dt,{moveAxis:steer(g,327),jumpPressed:stuck>6,jumpHeld:true});if(stuck>6)stuck=0;
 }
 assert.equal(g.player.groundId,'summit','through the hole to the ropeway deck');
 for(let i=0;i<120;i++)g.tick(dt,{moveAxis:steer(g,328)});
 assert.equal(g.deaths,0);assert.equal(g.checkpointId,'summit','and the summit flag is raised');
 save=g.snapshot();
 assert.deepEqual(save.rocks.map(r=>r.id),['boulder-run']);assert(save.broken.includes('plank-floor'));
 console.log(`PASS the puzzle: the authored strokes send the boulder over, the planks break ${(k*dt).toFixed(1)}s later, the rock rests under the hole, R keeps it down, and the way to the summit is open`);
}
{
 // A save from the summit resumes with the boulder down and the cave open,
 // and does not announce the station into a world that is not built.
 const g=new Game();let heard=0;g.onEvent=e=>{if(e.type==='activate')heard++;};g.start(0);
 assert(g.restore(save),'the summit save restores');
 const st=station(g),planks=deck(g,'plank-floor');
 assert(planks.broken&&planks.active===false,'the planks stay broken');
 assert(st.ball.spilled&&st.ball.landed&&Math.abs(st.ball.wx-save.rocks[0].x)<1e-9,'the boulder lies where it fell');
 assert(st.done&&st.amount===1&&g.latched['boulder-down'],'the station is done');
 assert.equal(heard,0,'and nothing was announced during the restore');
 tick(g,120);assert(st.ball.landed&&st.done,'and stays so');
 console.log('PASS the save: a checkpoint past the drop resumes with the boulder down, the cave open and no restore-time announcement');
}
