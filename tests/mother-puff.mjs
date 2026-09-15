import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {MOTHER_PUFF as M,resetMotherPuff} from '../dist/mother-puff-rules.js';
import {LEVELS} from '../dist/levels.js';
import {validateDraft} from '../dist/editor-model.js';
import {motherInput,motherTransfer} from './mother-puff-pilot.mjs';
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,input);};
function fixture(){const g=new Game();g.start(1);Object.assign(g.player,{x:276,y:33.4,groundId:'mother-arena'});g.checkpoint={x:264,y:33.4};g.checkpointId='heart-bell';return g;}
const patch=(g,color,x=g.player.x)=>{const s={id:100,color,x,y:g.level.boss.y,age:0,life:color==='orange'?12:5,radius:2.2,bounceAge:10};g.level.boss.patches.push(s);return s;};

{
 const g=new Game();g.start(1);step(g,180);assert.equal(g.level.boss.state,'sleeping');assert.equal(g.level.boss.spores.length,0);
 Object.assign(g.player,{x:276,y:33.4,groundId:'mother-arena'});g.tick(dt);assert.equal(g.level.boss.state,'inhale');
 step(g,240);assert.equal(g.level.boss.spores.length,0,'full breath warns before launch');
 step(g,18);assert.equal(g.level.boss.spores.length,5);assert.deepEqual(new Set(g.level.boss.spores.map(s=>s.color)),new Set(['orange','purple','white','green']));
 const targets=g.level.boss.spores.map(s=>s.targetX);g.player.x+=2;step(g,10);assert.deepEqual(g.level.boss.spores.map(s=>s.targetX),targets);
 g.pause();const state=JSON.stringify([g.level.boss,g.player]);step(g,600);assert.equal(JSON.stringify([g.level.boss,g.player]),state);g.resume();
 step(g,230);assert.equal(g.level.boss.spores.length,0);assert.equal(g.level.boss.patches.filter(s=>s.color==='orange').length,2);assert.equal(g.level.enemies.filter(e=>e.motherChild).length,1);
 console.log('PASS Mother Puff: sleeping approach, deep breath, four locked landing colors, ground effects, green spawn and pause');
}
{
 const g=fixture();g.tick(dt);const b=g.level.boss,p=g.player;
 patch(g,'purple',p.x-.3);g.tick(dt);assert.equal(p.health,2);assert(p.vx>8&&p.vy>7,'blast pushes away and upward');
 const hp=p.health;step(g,15);assert.equal(p.health,hp,'one cloud cannot repeatedly damage an invulnerable player');
 resetMotherPuff(g);g.tick(dt);Object.assign(p,{x:278,y:b.y,vx:0,vy:0,groundId:'mother-arena',invuln:0});patch(g,'white');step(g,45,{right:true});
 assert(p.sporeSlow);assert(p.vx<RULES.speed*.5);assert(p.vx>2);assert.equal(p.health,2,'white clouds slow without dealing damage');
 b.patches=[];step(g,40,{right:true});assert(!p.sporeSlow);assert(p.vx>6.5);
 console.log('PASS Mother Puff: purple damage/directional knockback/grace; white contact slowdown and recovery');
}
{
 const g=fixture();g.tick(dt);const b=g.level.boss,p=g.player;
 patch(g,'orange');g.tick(dt);assert(p.motherBounce&&p.springing);assert(p.vy>22);assert.equal(p.groundId,null);
 const initial=p.y;let peak=p.y;for(let i=0;i<240;i++){g.tick(dt,{jumpHeld:false});peak=Math.max(peak,p.y);}
 assert(peak-initial>M.height+2,'bounce reaches above the crown without requiring jump-hold');
 // A normal descending contact is harmless and cannot deduct a boss hit.
 b.state='recover';b.patches=[];Object.assign(p,{x:b.x,y:b.y+M.height+.05,vy:-15,groundId:null,motherBounce:true,stomping:false});g.tick(dt);assert.equal(b.hits,0);assert(p.vy>0);
 Object.assign(p,{x:b.x,y:b.y+M.height+.05,vy:-15,groundId:null,motherBounce:false,stomping:true});g.tick(dt);assert.equal(b.hits,0,'unassisted stomps cannot skip the orange-cap mechanic');
 Object.assign(p,{x:b.x,y:b.y+M.height+.05,vy:-40,groundId:null,motherBounce:true,stomping:true,stompWindup:0});g.tick(dt);assert.equal(b.hits,1,'swept stomp detects fast crown crossings');assert(!p.motherBounce);assert.equal(b.state,'hurt');
 Object.assign(p,{x:b.x,y:b.y+M.height+.05,vy:-40,groundId:null,motherBounce:true,stomping:true});g.tick(dt);assert.equal(b.hits,1,'hurt interval cannot be hit twice');
 console.log('PASS Mother Puff: high orange bounce, deliberate charged stomp, swept collision and hit cooldown');
}
{
 const g=fixture();g.tick(dt);Object.assign(g.player,{x:320,y:50,groundId:null});g.tick(dt);assert(g.player.x<g.level.boss.right);assert.equal(g.status,'playing','cannot jump over the locked exit');
 const run=motherTransfer(fixture(),{to:'mother-bell'});assert(run);assert.equal(run.g.level.boss.hits,3);assert.equal(run.g.level.boss.state,'defeated');assert.equal(run.g.deaths,0);assert.equal(run.g.player.health,3);
 const replay=fixture();for(const input of run.controls)replay.tick(dt,input);assert.equal(replay.level.boss.hits,3);assert.equal(replay.player.x,run.g.player.x);assert(!replay.level.boss.patches.length&&!replay.level.boss.spores.length);assert(!replay.level.enemies.some(e=>e.motherChild));
 const save=replay.snapshot(),resumed=new Game();resumed.start(1);assert(resumed.restore(save));assert.equal(resumed.level.boss.state,'defeated');step(replay,130,{right:true});assert.equal(replay.status,'complete');
 const failed=fixture();step(failed,500);failed.level.boss.hits=2;failed.player.health=1;failed.player.invuln=0;failed.damage();step(failed,65);assert.equal(failed.level.boss.state,'sleeping');assert.equal(failed.level.boss.hits,0);assert.equal(failed.player.health,3);assert.equal(failed.player.x,264);assert(!failed.level.enemies.some(e=>e.motherChild));assert(!failed.level.boss.patches.length);
 const partial=fixture();partial.level.boss.hits=2;const s=partial.snapshot();const fresh=new Game();fresh.start(1);assert(fresh.restore(s));assert.equal(fresh.level.boss.hits,0);
 console.log(`PASS Mother Puff: ${run.controls.length} input-only frames, exactly three fresh bounces/stomps, defeat cleanup, unlocked bell, saved victory and clean retry`);
}
{
 const g=fixture();Object.assign(g.player,{x:277,y:44,groundId:null});g.tick(dt);const b=g.level.boss;
 // Advance the encounter in an unreachable observation lane to measure caps
 // without harming or defeating minions. No renderer state affects this test.
 for(let i=0;i<120*130;i++){g.player.x=277;g.player.y=44;g.player.vy=0;g.tick(dt);assert(b.spores.length<=5);assert(b.patches.length<=7);assert(g.level.enemies.filter(e=>e.motherChild).length<=M.maxChildren);}
 const draft=validateDraft(LEVELS[1],LEVELS[1]);assert.equal(draft.boss.x,291);assert(draft.platforms.find(s=>s.motherArena));
 draft.platforms.find(s=>s.motherArena).x+=3;const moved=validateDraft(draft,LEVELS[1]);assert.equal(moved.boss.x,294);
 console.log('PASS Mother Puff: bounded recurring effects/minions and arena editor round-trip/movement');
}
