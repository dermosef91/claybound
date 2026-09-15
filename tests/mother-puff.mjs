import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {MOTHER_PUFF as M,resetMotherPuff,motherCapHeight,motherCorrupted,motherIntroTarget,motherSporePosition} from '../dist/mother-puff-rules.js';
import {LEVELS} from '../dist/levels.js';
import {validateDraft} from '../dist/editor-model.js';
import {motherTransfer} from './mother-puff-pilot.mjs';
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,input);};
const until=(g,test,max=2400,input={})=>{for(let i=0;i<max&&!test();i++)g.tick(dt,input);assert(test(),'state reached within bounded time');};
function fixture(state='inhale'){const g=new Game();g.start(1);Object.assign(g.player,{x:276,y:33.4,groundId:'mother-arena'});g.checkpoint={x:264,y:33.4};g.checkpointId='heart-bell';g.level.boss.state=state;return g;}
const patch=(g,color,x=g.player.x)=>{const s={id:100,color,x,y:g.level.boss.y,age:0,life:color==='orange'?12:5,radius:2.2,bounceAge:10};g.level.boss.patches.push(s);return s;};

{
 const g=new Game(),events=[];g.onEvent=e=>events.push(e.type);g.start(1);step(g,180);assert.equal(g.level.boss.state,'sleeping');assert.equal(g.level.boss.spores.length,0);
 Object.assign(g.player,{x:276,y:33.4,groundId:'mother-arena'});g.tick(dt);const b=g.level.boss,p=g.player;assert.equal(b.state,'reveal');
 assert(motherCorrupted(g));const start=p.x;step(g,Math.floor(M.reveal*.45/dt),{left:true,jumpPressed:true,stompPressed:true});
 assert(p.x>start+3&&p.x<motherIntroTarget(b),'the reveal walks toward the center gradually despite opposing input');assert.equal(p.groundId,'mother-arena');assert.equal(b.spores.length,0);
 g.pause();const frozen=JSON.stringify([b,p,g.time]);step(g,600,{right:true,jumpPressed:true});assert.equal(JSON.stringify([b,p,g.time]),frozen);g.resume();
 until(g,()=>b.state==='release',1000,{left:true,jumpPressed:true});assert(Math.abs(p.x-motherIntroTarget(b))<.5,'intro finishes beside the center');assert.equal(b.spores.length,1,'the first shot fires immediately when the opening growl starts');assert.equal(events.filter(e=>e==='mother-open').length,1);assert.equal(events.filter(e=>e.startsWith('mother-')).at(-1),'mother-release');
 console.log('PASS Mother Puff: sleeping approach, gradual automatic entrance, input lock, pause and immediate growl/first cast');
}
{
 const g=fixture(),b=g.level.boss,releases=[];
 g.onEvent=e=>{if(e.type==='mother-release'){const s=b.spores.at(-1);releases.push({time:g.time,color:e.color,targetX:s.targetX,playerX:g.player.x,cycle:b.cycle});}};
 // Keep this timing/effect unit test above the combat plane; the separate
 // recorded pilot below plays the whole battle using inputs only.
 for(let i=0;i<7200&&releases.length<20;i++){
   // Move the target after every update: each cast must sample the new position,
   // rather than retaining the position from the beginning of the chain.
   Object.assign(g.player,{x:b.left+2+(i%480)/480*15,y:b.y+12,vy:0,groundId:null});
   const locked=b.spores.map(s=>[s.id,s.targetX,s.targetY]);g.tick(dt);
   for(const [id,x,y] of locked){const s=b.spores.find(s=>s.id===id);if(s)assert.deepEqual([s.targetX,s.targetY],[x,y],'airborne spores do not home after release');}
 }
 assert.equal(releases.length,20);
 for(let volley=0;volley<2;volley++){
   const shots=releases.slice(volley*10,volley*10+10),orange=shots.flatMap((s,i)=>s.color==='orange'?[i]:[]);
   assert.equal(shots.length,10);assert.equal(orange.length,1);assert.equal(orange[0],9,'the orange launch pad ends each spree');
   assert.deepEqual(new Set(shots.map(s=>s.color)),new Set(['orange','purple','white','green']));
   assert(shots.filter(s=>s.color!=='orange').every(s=>s.targetX===s.playerX),'each hazard targets the player at its own moment of release');
   assert.equal(shots[9].targetX,b.x-5.9,'the orange pad is placed within reach of the boss, independent of player position');
   assert(new Set(shots.map(s=>s.targetX)).size>5,'later casts refresh the target as the player moves');
   assert(shots.every(s=>s.targetX<b.x&&s.targetX>b.left),'landing targets stay in the left combat arena');
   for(let i=1;i<shots.length;i++)assert(Math.abs(shots[i].time-shots[i-1].time-M.shotGap)<dt*1.1,'every cast retains the slower stagger');
   assert(shots.at(-1).time-shots[0].time>12,'the ten casts stretch over a sustained volley');
 }
 assert(Math.abs(releases[10].time-releases[9].time-.5)<dt*1.1,'only half a second separates the orange shot from the next spree');
 assert(g.level.enemies.some(e=>e.motherChild),'green ground puffs spawn children');
 console.log('PASS Mother Puff: ten staggered casts, reachable orange finisher, 0.5s restart, hazards aim at release-time player position, no homing');
}
{
 const s={startX:303,startY:40.3,targetX:287,targetY:33.4};
 assert.deepEqual(motherSporePosition(s,0),{x:s.startX,y:s.startY});
 assert.deepEqual(motherSporePosition(s,1),{x:s.targetX,y:s.targetY});
 const early=motherSporePosition(s,.08);
 assert(early.y>s.startY+.7,'spores first rise visibly above the release point');
 assert(s.startX-early.x<1,'initial motion rises instead of travelling horizontally');
 let previous=motherSporePosition(s,0),peak=previous.y;
 for(let i=1;i<=100;i++){
   const p=motherSporePosition(s,i/100);peak=Math.max(peak,p.y);
   assert(p.x<previous.x,'the arc progresses toward its locked target');previous=p;
 }
 assert(peak>s.startY+2,'the arc makes a distinct overhead crest');
 const descent=motherSporePosition(s,.8);assert(descent.y> s.targetY+3,'the spore remains airborne before dropping into its ground effect');
 console.log('PASS Mother Puff: upward launch, overhead crest, continuous locked arc and exact ground impact');
}
{
 const g=fixture();g.tick(dt);const b=g.level.boss,p=g.player;
 patch(g,'purple',p.x-.3);g.tick(dt);assert.equal(p.health,2);assert(p.vx>8&&p.vy>7,'blast pushes away and upward');
 const hp=p.health;step(g,15);assert.equal(p.health,hp,'one cloud cannot repeatedly damage an invulnerable player');
 resetMotherPuff(g);b.state='inhale';g.tick(dt);Object.assign(p,{x:278,y:b.y,vx:0,vy:0,groundId:'mother-arena',invuln:0});patch(g,'white');step(g,45,{right:true});
 assert(p.sporeSlow);assert(Math.abs(p.vx-RULES.speed*.73)<.01);assert(Math.abs((1-M.slow)-(1-.46)/2)<1e-9,'white slowdown is halved');assert.equal(p.health,2,'white clouds slow without dealing damage');
 b.patches=[];step(g,40,{right:true});assert(!p.sporeSlow);assert(p.vx>6.5);
 console.log('PASS Mother Puff: purple damage/directional knockback/grace; white contact slowdown and recovery');
}
{
 const g=fixture();g.tick(dt);const b=g.level.boss,p=g.player;
 patch(g,'orange');g.tick(dt);assert(p.motherBounce&&p.springing);assert(p.vy>22);assert.equal(p.groundId,null);
 const initial=p.y;let peak=p.y;for(let i=0;i<240;i++){g.tick(dt,{jumpHeld:false});peak=Math.max(peak,p.y);}
 assert(peak-initial>M.height+2,'orange bounce reaches above the crown without requiring jump-hold');
 b.state='recover';b.patches=[];Object.assign(p,{x:b.x-1,y:b.y+motherCapHeight(b)+.05,vx:0,vy:-15,groundId:null,motherBounce:false,stomping:false,motherPush:0});
 g.tick(dt);assert.equal(b.hits,1,'an ordinary descending landing damages the crown without stomp or a charged flag');assert.equal(b.state,'hurt');assert(!p.motherBounce);assert(p.vx<-10&&p.vy>7);assert(p.motherPush>0,'the retaliatory puff has a short forced push');assert.equal(b.queue.length,0,'a hit cancels the rest of the volley');
 const hitX=p.x;step(g,50,{right:true,jumpPressed:true,stompPressed:true});assert(p.x<hitX-3,'the puff pushes left even while right is held');assert.equal(b.hits,1);
 Object.assign(p,{x:b.x-1,y:b.y+motherCapHeight(b)+.05,vy:-40,groundId:null,motherBounce:false,stomping:false});g.tick(dt);assert.equal(b.hits,1,'hurt interval cannot be hit twice');
 console.log('PASS Mother Puff: high orange bounce, normal head landing, swept collision, leftward spore push and hit cooldown');
}
{
 const g=fixture();g.tick(dt);Object.assign(g.player,{x:320,y:50,groundId:null});g.tick(dt);assert(g.player.x<=g.level.boss.x);assert.equal(g.status,'playing','the battle remains on the boss’s left');
 const run=motherTransfer(fixture('sleeping'),{to:'mother-bell'});assert(run,'a normal input-only route can finish the encounter');assert.equal(run.g.level.boss.hits,3);assert.equal(run.g.level.boss.state,'defeated');assert.equal(run.g.deaths,0);assert(run.g.player.health>0);
 assert(run.controls.every(input=>!input.stompPressed),'the full encounter needs no stomp input');
 const replay=fixture('sleeping');for(const input of run.controls)replay.tick(dt,input);assert.equal(replay.level.boss.hits,3);assert.equal(replay.player.x,run.g.player.x);assert(!replay.level.boss.patches.length&&!replay.level.boss.spores.length);assert(!replay.level.enemies.some(e=>e.motherChild));
 const save=replay.snapshot(),resumed=new Game();resumed.start(1);assert(resumed.restore(save));assert.equal(resumed.level.boss.state,'defeated');step(replay,130,{right:true});assert.equal(replay.status,'complete');
 const failed=fixture();step(failed,500);failed.level.boss.hits=2;failed.player.health=1;failed.player.invuln=0;failed.damage();step(failed,65);assert.equal(failed.level.boss.state,'sleeping');assert.equal(failed.level.boss.hits,0);assert.equal(failed.player.health,3);assert.equal(failed.player.x,264);assert(!failed.level.enemies.some(e=>e.motherChild));assert(!failed.level.boss.patches.length);assert(!failed.player.motherPush);
 const partial=fixture();partial.level.boss.hits=2;const s=partial.snapshot();const fresh=new Game();fresh.start(1);assert(fresh.restore(s));assert.equal(fresh.level.boss.hits,0);
 console.log(`PASS Mother Puff: ${run.controls.length} input-only frames, three ordinary head landings, no deaths, cleanup, unlocked bell, saved victory and clean retry`);
}
{
 const g=fixture(),b=g.level.boss,p=g.player,events=[];g.onEvent=e=>events.push(e.type);
 Object.assign(b,{hits:2,state:'recover'});Object.assign(p,{x:b.x-1,y:b.y+motherCapHeight(b)+.05,vy:-40,groundId:null,motherBounce:false,stomping:false});g.tick(dt);
 assert.equal(b.state,'veil');assert.equal(b.hits,3);assert(motherCorrupted(g),'the final hit retains Stone Orchard through healing');assert(!b.queue.length&&!b.spores.length&&!b.patches.length);assert(!g.snapshot().bossDefeated,'the real-form reveal must play before the exit is saved open');
 const states=[];let state=b.state;states.push(state);
 for(let i=0;i<2400;i++){
   if(i===90){g.pause();const before=JSON.stringify([b,p,g.time]);step(g,200);assert.equal(JSON.stringify([b,p,g.time]),before);g.resume();}
   g.tick(dt,{right:true,jumpPressed:true,stompPressed:true});
   if(b.state!==state){state=b.state;states.push(state);}
   if(b.state==='defeated')break;
   assert(motherCorrupted(g),'Stone Orchard remains through every healing stage');assert.equal(g.status,'playing');assert.equal(p.health,3);assert(p.x<b.right,'held input cannot bypass the cloud reveal');
 }
 assert.deepEqual(states,['veil','transform','reveal-form','regard','farewell','bloom','defeated']);assert.equal(b.healing,1);assert(!motherCorrupted(g),'forest music returns only after healing completes');assert.equal(events.filter(x=>x==='mother-defeat').length,1);assert.equal(events.filter(x=>x==='mother-bloom').length,1);assert.equal(p.facing,1);assert(g.snapshot().bossDefeated);
 console.log('PASS Mother Puff: cloud veil, covered transformation, true-form reveal, friendly farewell, healing wind, pause and delayed exit');
}
{
 const g=fixture();Object.assign(g.player,{x:277,y:46,groundId:null});g.tick(dt);const b=g.level.boss;
 for(let i=0;i<120*130;i++){Object.assign(g.player,{x:277,y:46,vy:0,groundId:null});g.tick(dt);assert(b.spores.length<=2);assert(b.patches.length<=8);assert(g.level.enemies.filter(e=>e.motherChild).length<=M.maxChildren);}
 const draft=validateDraft(LEVELS[1],LEVELS[1]);assert.equal(draft.boss.x,303);assert(draft.platforms.find(s=>s.motherArena));
 draft.platforms.find(s=>s.motherArena).x+=3;const moved=validateDraft(draft,LEVELS[1]);assert.equal(moved.boss.x,306);
 console.log('PASS Mother Puff: bounded recurring effects/minions and right-side boss editor movement');
}
