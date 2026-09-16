// Every way of working violet clay is heard as a `knead` event from the
// simulation — hand-worked chapter clay and every ruled lab station, by drag,
// by E, by tap, by boot and by stomp — spaced so a long knead is a run of takes,
// and silent when the clay is only moving on its own or is finished.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import lab from '../dist/routes/clay-lab.js';
import {visitStation,nudgeClay,KNEAD_GAP} from '../dist/shaping.js';
import {FORM} from '../dist/clay-form.js';

const frames=seconds=>Math.round(seconds/dt);
const listen=g=>{const list=[];g.onEvent=e=>{if(e.type==='knead')list.push({...e,t:g.time});};return list;};
// Every run of events is spaced by at least the gap, per station.
const spaced=list=>{const last={};for(const e of list){if(last[e.id]!==undefined)assert(e.t-last[e.id]>=KNEAD_GAP-1e-6,`${e.id}: kneads are at least ${KNEAD_GAP}s apart (${(e.t-last[e.id]).toFixed(3)})`);last[e.id]=e.t;}};
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:i===0&&!!input.jumpPressed,stompPressed:i===0&&!!input.stompPressed});};
const walkTo=(g,x,n=2000)=>{for(let i=0;i<n;i++){const d=x-g.player.x;if(Math.abs(d)<.1)return true;g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*3))});}return false;};
const stomp=g=>{step(g,1,{jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&g.player.vy>0;i++)g.tick(dt,{jumpHeld:true});step(g,1,{stompPressed:true});for(let i=0;i<150&&!g.player.groundId;i++)g.tick(dt,{});step(g,3);};

// --- hand-worked chapter clay ----------------------------------------------------
{
  const g=new Game();g.start(3);const first=g.level.shaping[0];Object.assign(g.player,first.spawn,{vx:0,vy:0});
  const heard=listen(g);
  step(g,frames(1.5),{shapeHeld:true});
  assert(heard.length>=2&&heard.length<=4,`a second and a half of E is heard as a run of kneads (${heard.length})`);
  assert(heard.every(e=>e.id===first.id&&e.rule===null),'from the clay being held');
  spaced(heard);
  const count=heard.length;
  step(g,frames(1));
  assert.equal(heard.length,count,'the clay settling on after the key is released is not kneading');
  step(g,1,{shapeId:first.id,shapeAmount:.9});
  assert.equal(heard.length,count+1,'a drag that moves the clay is');
  step(g,frames(.6),{shapeId:first.id,shapeAmount:.9});
  assert.equal(heard.length,count+1,'a thumb resting where the clay already is, is not');
  step(g,frames(.6));
  assert(nudgeClay(g,first.id),'a tap');step(g,1);
  assert.equal(heard.length,count+2,'is heard once');
  first.target=1;first.amount=1;step(g,frames(.6));const done=heard.length;
  step(g,frames(1),{shapeHeld:true});
  assert.equal(heard.length,done,'finished clay under a held key is silent');
  spaced(heard);
}
console.log('PASS chapter clay: E, a drag and a tap are heard, spaced; settling, a resting thumb and finished clay are not');

// --- the lab: weight, packing, stamping ------------------------------------------
{
  const g=new Game();g.start(3,lab);const heard=listen(g);
  // Sag: walking onto the block sinks it, and that is heard; standing still on
  // a settled dent is not.
  assert(visitStation(g,'sag'));const block=g.level.platforms.find(s=>s.id==='sag-block');
  walkTo(g,block.x+block.w/2);
  assert(heard.some(e=>e.id==='sag'),'walking into the soft block is heard');
  step(g,frames(3));const settled=heard.length;
  step(g,frames(1.5));
  assert.equal(heard.length,settled,'standing still on a settled dent is not');
  step(g,frames(1),{shapeHeld:true,shapeId:'sag',shapeAmount:1});
  assert.equal(heard.length,settled,'and neither is a hand on clay that takes none');
  // Catapult: a stomp packs it, and a hand does.
  assert(visitStation(g,'catapult'));const before=heard.length;
  step(g,frames(.6),{shapeHeld:true});
  assert(heard.filter(e=>e.id==='catapult').length>=1,'E packing the lump is heard');
  const lump=g.level.platforms.find(s=>s.id==='catapult-lump');
  Object.assign(g.player,{x:lump.x+lump.w/2,y:lump.y+3,vx:0,vy:0,groundId:null,coyote:0});
  const packed=heard.length;step(g,1,{stompPressed:true});step(g,frames(.6));
  assert(heard.length>packed,'a stomp into the lump is heard');
  // Stamp: a tap on a slab.
  assert(visitStation(g,'stamp'));step(g,frames(.6));const stampBefore=heard.length;
  assert(nudgeClay(g,'stamp',1));step(g,1);
  assert.equal(heard.filter(e=>e.id==='stamp').length,1,'a tap on a slab is heard once');
  assert(heard.length===stampBefore+1);
  spaced(heard);
  assert.equal(g.deaths,0);
}
console.log('PASS lab: boots sinking into the sag block, E and a stomp on the lump, and a tap on a slab are heard, spaced');

// --- the formable masses -----------------------------------------------------------
{
  const g=new Game();g.start(3,lab);const heard=listen(g);
  assert(visitStation(g,'form'));const s=g.level.platforms.find(q=>q.id==='form-mass'),base=s.y-s.h;
  // Walking onto the slab sinks the boots in, and that is heard.
  walkTo(g,s.x+6);
  assert(heard.some(e=>e.id==='form'),'walking onto the slab is heard');
  step(g,frames(3));const stood=heard.length;
  step(g,frames(1.5));
  assert.equal(heard.length,stood,'standing still on it is not');
  // A drag.
  let hy=surfaceAt(s,s.x+9)-base+.2;
  for(let i=0;i<frames(1.2);i++){hy+=.03;g.tick(dt,{shapeId:'form',shapeX:s.x+9,shapeY:base+hy});}
  const dragged=heard.length-stood;
  assert(dragged>=2&&dragged<=4,`a second's drag is a run of kneads (${dragged})`);
  step(g,frames(.6));const rest=heard.length;
  step(g,frames(1),{shapeId:'form',shapeX:s.x+9,shapeY:base+hy});
  assert.equal(heard.length,rest,'a thumb held still on the clay is not kneading');
  // E, a tap, a stomp.
  g.player.facing=1;step(g,frames(.6),{shapeHeld:true});
  assert(heard.length>rest,'E raising a step ahead is heard');
  step(g,frames(.6));const tapped=heard.length;
  assert(nudgeClay(g,'form',0,{x:s.x+12,y:surfaceAt(s,s.x+12)+.1}));step(g,1);
  assert.equal(heard.length,tapped+1,'a tap is heard once');
  step(g,frames(.6));const stomped=heard.length;
  stomp(g);
  assert(heard.length>stomped,'a stomp into the slab is heard');
  // Left alone, the slab slumping home is not kneading.
  for(let i=0;i<frames(3)&&g.player.groundId!=='form-dock';i++)g.tick(dt,{moveAxis:-1,jumpPressed:g.player.x<s.x+.8&&i%30===0,jumpHeld:true});
  assert.equal(g.player.groundId,'form-dock','back on the dock');
  step(g,frames(.6));const left=heard.length;
  step(g,frames(FORM.settle+4));
  assert.equal(heard.length,left,'the clay slumping home on its own is silent');
  // The free lump too.
  assert(visitStation(g,'lump'));const l=g.level.platforms.find(q=>q.id==='form-lump'),lbase=l.y-l.h;
  const lumpBefore=heard.length;
  let ly=surfaceAt(l,l.x+7)-lbase+.1;
  for(let i=0;i<frames(.8);i++){ly-=.03;g.tick(dt,{shapeId:'lump',shapeX:l.x+7,shapeY:lbase+ly});}
  assert(heard.filter(e=>e.id==='lump').length>=1&&heard.length>lumpBefore,'pressing the lump down is heard');
  spaced(heard);
  assert.equal(g.deaths,0);
}
console.log('PASS formable clay: boots, a drag, E, a tap and a stomp are heard on the slab and the lump, spaced; a still thumb and a slump are not');
