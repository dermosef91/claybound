import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {pressRelayLevel} from './press-relay-fixture.mjs';

let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}
function game(index=0,level){const g=new Game();g.start(index,level);g.level.enemies=[];g.level.crushers=[];g.level.hazards=[];return g;}
function step(g,t,input={}){for(let i=0;i<Math.round(t/dt);i++){g.tick(dt,{...input,jumpPressed:!!input.jumpPressed&&i===0,stompPressed:!!input.stompPressed&&i===0});}}
function at(g,id,offset=.5){const s=g.level.platforms.find(s=>s.id===id);Object.assign(g.player,{x:s.x+offset,y:s.y,vx:0,vy:0,groundId:s.id,coyote:.1});return s;}

check('held jumps rise higher than tapped jumps',()=>{
  const heights=[false,true].map(held=>{const g=game();let max=0;for(let i=0;i<120;i++){g.tick(dt,{jumpPressed:i===0,jumpHeld:held});max=Math.max(max,g.player.y);}return max;});
  assert(heights[1]>2.4);assert(heights[1]>heights[0]*1.5);
});
check('coyote time allows a late edge jump',()=>{const g=game();at(g,'start',18.35);g.player.groundId=null;g.player.coyote=.07;g.tick(dt,{jumpPressed:true,jumpHeld:true});assert(g.player.vy>10);});
check('buffered jump fires on landing',()=>{const g=game();Object.assign(g.player,{y:.22,vy:-4,groundId:null,coyote:0});step(g,.18,{jumpPressed:true,jumpHeld:true});assert(g.player.vy>6);});
check('rope lifts carry the character without slipping',()=>{const g=game();g.tick(dt,{});const s=at(g,'lift1',1.5),offset=g.player.x-s.x;step(g,.65,{});assert.equal(g.player.groundId,'lift1');assert(Math.abs(g.player.y-s.y)<.002);assert(Math.abs(g.player.x-s.x-offset)<.001);});
check('running onto a spring launches the character',()=>{const g=game(1);Object.assign(g.player,{x:7.6,vx:6.4});let max=0;for(let i=0;i<160;i++){g.tick(dt,{right:i<30,jumpHeld:true});max=Math.max(max,g.player.y);}assert(max>5.8);});
check('springs remain usable without holding jump',()=>{const g=game(1);Object.assign(g.player,{x:7.6,vx:6.4});let max=0;for(let i=0;i<160;i++){g.tick(dt,{right:i<30});max=Math.max(max,g.player.y);}assert(max>5.7);});
check('air stomp breaks cracked floors',()=>{const g=game(1);const s=g.level.platforms.find(s=>s.id==='tree-seal');Object.assign(g.player,{x:s.x+s.w/2,y:s.y+1.5,groundId:null,coyote:0});step(g,.18,{stompPressed:true});assert(s.broken);assert(g.player.y<s.y);});
check('a cream switch opens and then closes its bridge',()=>{const g=game(2,pressRelayLevel);at(g,'press-switch');step(g,.1,{});assert(g.channels['press-a']>11.9);assert(g.level.platforms.find(s=>s.id==='press-bridge').active);at(g,'start');step(g,12.2,{});assert.equal(g.channels['press-a'],0);assert.equal(g.level.platforms.find(s=>s.id==='press-bridge').active,false);});
check('crumbling platforms disappear and regrow',()=>{const g=game(1);const s=at(g,'crumb1',1);step(g,1.1,{});assert(!s.active);at(g,'canopy-rest');step(g,3.3,{});assert(s.active);assert.equal(s.timer,0);});
check('tower sides cannot be walked through',()=>{const g=game();Object.assign(g.player,{x:17.4,y:1,vx:6.4,groundId:null});step(g,.12,{right:true});assert(g.player.x<=17.68+.001);});
check('coins count once',()=>{const g=game();g.level.coins=[{x:1.5,y:.7,taken:false}];step(g,.2,{});assert.equal(g.coins,1);});
check('checkpoints restore health and survive falling',()=>{const g=game();at(g,'windwell',2);g.player.health=2;g.tick(dt,{});assert.equal(g.player.health,RULES.maxHealth);assert.equal(g.checkpointId,'windwell');g.player.y=-20;step(g,.7,{});assert.equal(g.player.x,45);assert(g.player.y>=3.9);});
check('stomping a clayling gives a bounce',()=>{const g=game();g.level.enemies=[{id:0,x:3,y:0,min:2,max:4,speed:0,dir:1,alive:true}];Object.assign(g.player,{x:3,y:1.1,vy:-5,groundId:null,coyote:0});step(g,.09,{jumpHeld:true});assert(!g.level.enemies[0].alive);assert(g.player.vy>8);});
check('pause freezes simulation and resume continues',()=>{const g=game();g.pause();step(g,1,{right:true});assert.equal(g.player.x,1.5);g.resume();step(g,.4,{right:true});assert(g.player.x>3);});
check('reversing direction responds within a tenth of a second',()=>{const g=game();step(g,.35,{right:true});step(g,.1,{left:true});assert(g.player.vx<-2);assert.equal(g.player.facing,-1);});
check('releasing movement brakes before a narrow ledge edge',()=>{const g=game();step(g,.3,{right:true});const x=g.player.x;step(g,.15,{});assert.equal(g.player.vx,0);assert(g.player.x-x<.31);});
check('analog touch steering supports precise half-speed movement',()=>{const g=game();step(g,.35,{moveAxis:.5});assert(Math.abs(g.player.vx-3.35)<.01);});


console.log(checks+' movement and mechanic checks passed.');
