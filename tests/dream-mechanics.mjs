// The Soft Dream's primitives, each on a synthetic level built from the
// canyon's shell: trigger zones, waiting lifts and cradles, breathing walls,
// conveyor decks, sinking rafts, folding decks, dome islands, self-working
// and channel-opening stations, the ending, and the three dream creatures —
// their rules, their views, the pilot modes that cross them, the editor's
// acceptance of them, and the determinism the recordings depend on.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,RULES,surfaceAt,domeSurface,domeSteepAt,FINALE,finaleFlower} from '../dist/simulation.js';
import {LEVELS,instantiateLevel} from '../dist/levels.js';
import {SINK,FOLD,foldWall,foldIsWall,wallBox} from '../dist/cavern-machines.js';
import {DREAM_KINDS,HATWORM,BLINKER,DRIP} from '../dist/dream-enemy-rules.js';
import {KINDS,LISTS,validateDraft,DraftLibrary,DraftSession,selectedObject,objectLabel} from '../dist/editor-model.js';
import {hintIcon,HINT_ICON_NAMES} from '../dist/hint-icons.js';
import {World} from '../dist/world.js';
import {createDreamView,animateDreamViews,createDreamFlower,dreamViewKind} from '../dist/dream-views.js';
import {createEnemyView,animateEnemy} from '../dist/enemies.js';
import {settleSquash} from '../dist/clay-shatter.js';
import {FLATTEN} from '../dist/clay-feel.js';
import {cloneGame,crossing} from './routes.mjs';

let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const near=(a,b,tol=1e-6)=>Math.abs(a-b)<=tol;

// --- a synthetic chapter --------------------------------------------------------
const deck=(id,x,w,y,extra={})=>({id,x,w,y,kind:'stone',...extra});
const station=(id,parts,x,end,extra={})=>({id,parts,x,end,spawn:{x:x+1,y:0,groundId:'start'},name:id,verb:'Work',gesture:'right',hint:'Work the clay',...extra});
const clay=(id,x,stationId,extra={})=>({id,kind:'clay',x,w:2,y:0,h:1,clayRole:'bridge',station:stationId,shape:{from:{x,w:2,y:0,h:1},to:{x,w:4,y:0,h:.5}},...extra});
function level(over={}){
  const L=structuredClone(LEVELS[0]);delete L.boss;
  Object.assign(L,{spawn:{x:2,y:0},end:200,platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true})],coins:[],stamps:[],enemies:[],hazards:[],winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],routeLinks:[],shaping:[],triggers:[],decor:[],hints:[],sections:[{x:-100,name:'Dream test',landmark:'',id:0,end:1e6}]},over);
  return L;
}
function game(over,events){const g=new Game();if(events)g.onEvent=e=>events.push({...e,at:g.time});g.start(0,level(over));return g;}
const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:!!input.jumpPressed&&i===0,stompPressed:!!input.stompPressed&&i===0});};
const stand=(g,id,offset)=>{const s=g.level.platforms.find(s=>s.id===id),x=s.x+(offset??s.w/2);Object.assign(g.player,{x,y:surfaceAt(s,x),vx:0,vy:0,groundId:s.id,coyote:.13});return s;};
const at=(g,id)=>g.level.platforms.find(s=>s.id===id);
const insideWall=(p,s)=>p.x+RULES.radius>s.x&&p.x-RULES.radius<s.x+s.w&&p.y<s.y-1e-9&&p.y+RULES.height>s.y-s.h+1e-9;

// --- 1. trigger zones -----------------------------------------------------------
check('a trigger zone latches its channel when the body enters it, not before, and the latch survives a checkpoint',()=>{
  const events=[],g=game({platforms:[deck('start',-4,24,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'door',kind:'timed',x:30,w:3,y:0,channel:'gate-a'}],triggers:[{id:'zone',x:6,w:2,y:0,h:3,channel:'gate-a'},{id:'high',x:2,w:2,y:3,h:1,channel:'gate-b'}]},events);
  tick(g,60);assert(!g.latched['gate-a']);assert(!g.latched['gate-b'],'a zone above the head is not entered by walking under it');
  assert.equal(g.channels['gate-a'],0,'trigger channels are known to the game from the start');
  stand(g,'start',9.4);tick(g,30);assert(!g.latched['gate-a'],'clear of the zone by a finger, still unlatched');
  tick(g,40,{right:true});assert(g.latched['gate-a']);
  const fired=events.find(e=>e.type==='activate');assert.deepEqual([fired.channel,fired.x,fired.y],['gate-a',7,1.5]);
  assert(at(g,'door').active,'a switched bridge on the channel stays up for good');
  const save=JSON.parse(JSON.stringify(g.snapshot())),again=new Game();again.start(0,level({platforms:g.level.platforms.map(s=>structuredClone(LEVELS[0].platforms[0]))}));
  const resumed=new Game();resumed.start(0,structuredClone(level({platforms:[deck('start',-4,24,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'door',kind:'timed',x:30,w:3,y:0,channel:'gate-a'}],triggers:[{id:'zone',x:6,w:2,y:0,h:3,channel:'gate-a'}]})));
  assert(resumed.restore(save));assert(resumed.latched['gate-a']);assert.equal(resumed.channels['gate-a'],1);resumed.tick(dt,{});assert(at(resumed,'door').active);
  void again;
});

// --- 2. waiting lifts and cradles -------------------------------------------------
check('a lift with waitFor rests at its base until the channel latches, then runs on its own clock, and resumes after a restore',()=>{
  const make=()=>level({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'lift',kind:'lift',x:10,w:3,y:0,moveY:3,period:4,waitFor:'go'},{id:'cradle',kind:'orbit',x:20,w:2,y:6,moveX:2,moveY:2,period:4,waitFor:'go'}],triggers:[{x:6,w:1,y:0,h:2,channel:'go'}]});
  const g=new Game();g.start(0,make());const lift=at(g,'lift'),cradle=at(g,'cradle');
  const rest=[cradle.x,cradle.y];
  tick(g,240);assert.equal(lift.y,0);assert.equal(lift.x,10);assert.deepEqual([cradle.x,cradle.y],rest,'a waiting cradle hangs at its rest pose');
  g.activate('go',0,0);tick(g,120);
  assert(near(lift.y,3,1e-6),'a quarter period after the latch the lift is at the top of its swing');
  assert(Math.hypot(cradle.x-rest[0],cradle.y-rest[1])>1,'the cradle has swung away from its rest');
  const save=JSON.parse(JSON.stringify(g.snapshot())),resumed=new Game();resumed.start(0,make());assert(resumed.restore(save));
  assert.equal(at(resumed,'lift').y,0);tick(resumed,120);assert(near(at(resumed,'lift').y,3,1e-6),'a restored latch sets the lift moving from its base');
  // A rider is carried by a waiting lift once it moves, like any lift.
  const h=new Game();h.start(0,make());h.activate('go',0,0);stand(h,'lift');tick(h,90);assert.equal(h.player.groundId,'lift');assert(near(h.player.y,at(h,'lift').y,1e-6));
});

// --- 3. breathing walls ---------------------------------------------------------
check('a breathing wall swings its height and place about the authored pose',()=>{
  const g=game({platforms:[deck('start',-4,30,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'breath',kind:'wall',x:12,w:2,y:5,h:3,breathe:{dh:1.5,dx:.6,dy:.4,period:3,phase:.5}}]});
  const s=at(g,'breath');tick(g,77);
  const k=Math.sin(g.time*Math.PI*2/3+.5);
  assert(near(s.h,3+k*1.5,1e-9));assert(near(s.x,12+k*.6,1e-9));assert(near(s.y,5+k*.4,1e-9));assert.equal(s.baseH,3);
  assert.equal(wallBox(s).bottom,s.y-s.h,'the body the wall passes read follows the breathing height');
});
check('standing beside, under or on a breathing wall for 20 seconds never hurts and never leaves the player inside it',()=>{
  const spots=[
    // Beside: its side breathes onto a player standing at its foot.
    {wall:{id:'breath',kind:'wall',x:8,w:2,y:4,h:4,breathe:{dh:1.5,dx:.6,period:3}},x:7.3},
    // Under: its underside breathes down onto a player's head.
    {wall:{id:'breath',kind:'wall',x:8,w:2,y:4,h:2.5,breathe:{dh:1.2,period:3}},x:9},
    {wall:{id:'breath',kind:'wall',x:8,w:2,y:4,h:2.5,breathe:{dh:1.2,period:3}},x:8.6},
    // Beside a wall that walks into you.
    {wall:{id:'breath',kind:'wall',x:8,w:2,y:4,h:4,breathe:{dx:1.4,period:2.2}},x:10.6},
  ];
  for(const spot of spots){
    const g=game({platforms:[deck('floor',-4,30,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),spot.wall]});
    Object.assign(g.player,{x:spot.x,y:0,groundId:'floor'});const s=at(g,'breath');
    for(let i=0;i<2400;i++){
      g.tick(dt,{});
      assert.equal(g.player.health,RULES.maxHealth);assert.equal(g.deaths,0);
      assert(!insideWall(g.player,s),`inside the wall at t=${g.time.toFixed(2)} x=${g.player.x} wall ${s.x}..${s.x+s.w} bottom ${s.y-s.h}`);
      assert.equal(g.player.groundId,'floor','pushed aside, never off the floor');
    }
  }
  // On top: the top itself breathes up and down and the rider goes with it.
  const g=game({platforms:[deck('floor',-4,30,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'breath',kind:'wall',x:8,w:3,y:4,h:3,breathe:{dy:.8,dh:.5,period:3}}]});
  stand(g,'breath');for(let i=0;i<2400;i++){g.tick(dt,{});assert.equal(g.player.groundId,'breath');assert(near(g.player.y,at(g,'breath').y,1e-6));}
  assert.equal(g.player.health,RULES.maxHealth);
});

// --- 4. conveyors -----------------------------------------------------------------
check('a conveyor carries a player standing still by its speed times time, either way, and fights a walk against it',()=>{
  for(const speed of [2.5,-1.75]){
    const g=game({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'belt',kind:'ledge',x:10,w:14,y:0,conveyor:speed}]});
    stand(g,'belt',7);const x=g.player.x;tick(g,240);
    assert(near(g.player.x-x,2*speed,.01),`carried ${g.player.x-x} on a ${speed} belt`);assert.equal(g.player.groundId,'belt');assert.equal(g.player.vx,0);
  }
  const g=game({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'belt',kind:'ledge',x:10,w:40,y:0,conveyor:2.5}]});
  stand(g,'belt',30);const x=g.player.x;tick(g,120,{left:true});
  assert(g.player.x<x-3&&g.player.x>x-RULES.speed,'walking against the belt still gains ground, just less of it');
});

// --- 5. sinking rafts -----------------------------------------------------------------
check('a sink raft settles under a rider at its rate to its drop, carries them down, and floats back once empty',()=>{
  const g=game({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'raft',kind:'sink',x:10,w:3,y:0,rate:1.5,drop:2},{id:'plain',kind:'sink',x:20,w:3,y:0}]});
  const raft=at(g,'raft');stand(g,'raft');tick(g,120);
  assert(near(raft.y,-1.5,.02));assert.equal(g.player.groundId,'raft');assert(near(g.player.y,raft.y,1e-6),'the rider rides the raft down');
  tick(g,240);assert.equal(raft.y,-2,'no deeper than its drop');assert.equal(g.player.groundId,'raft');
  Object.assign(g.player,{x:2,y:0,groundId:'start'});tick(g,120);assert(near(raft.y,-.5,.02),'floats back at the same rate');
  tick(g,120);assert.equal(raft.y,0);
  const plain=at(g,'plain');stand(g,'plain');tick(g,60);assert(near(plain.y,-SINK.rate*.5,.02),'an unfilled raft uses the module defaults');
  assert.equal(g.player.health,RULES.maxHealth);
});

// --- 6. folding decks -----------------------------------------------------------------
check('a fold is a deck that carries its rider until halfway, then a thin wall on its pivot edge; a wall folds down into a deck',()=>{
  // The zone at the far left is the latch's source, so a save may carry it.
  const make=()=>level({platforms:[deck('start',-4,10,0,{checkpoint:2}),deck('landing',9,6,0),deck('goal',190,6,0,{goal:true}),{id:'flap',kind:'fold',x:6,w:3,y:0,channel:'fold-a',duration:1,pivot:'left'}],triggers:[{x:-4,w:1,y:0,h:2,channel:'fold-a'}]});
  const g=new Game();g.start(0,make());const flap=at(g,'flap');
  assert.equal(flap.fold,0);assert(flap.active);assert(!foldIsWall(flap));assert.equal(wallBox(flap),null);
  stand(g,'flap');tick(g,60);assert.equal(g.player.groundId,'flap','a deck to stand on until its channel opens');
  g.activate('fold-a',0,0);tick(g,48);assert(near(flap.fold,.4,1e-9));assert.equal(g.player.groundId,'flap','carried while the panel is still mostly flat');
  tick(g,13);assert(flap.fold>=.5);assert(foldIsWall(flap));assert(!flap.active);
  tick(g,6);assert.notEqual(g.player.groundId,'flap');assert(g.player.vy<0,'the rider is let go past upright');
  assert.deepEqual(wallBox(flap),{x:6-FOLD.thickness/2,w:FOLD.thickness,top:3,bottom:0});
  assert.deepEqual(foldWall({x:6,w:3,y:0,pivot:'right'}),{x:9-FOLD.thickness/2,w:FOLD.thickness,top:3,bottom:0});
  tick(g,60);assert.equal(flap.fold,1);
  // Standing up, the panel is a wall a walker cannot pass.
  Object.assign(g.player,{x:4,y:0,vx:0,vy:0,groundId:'start'});tick(g,240,{right:true});
  assert(near(g.player.x,6-FOLD.thickness/2-RULES.radius,1e-6),'walked into the standing panel and stopped at its face');
  assert.equal(g.player.health,RULES.maxHealth);
  // A restore derives the fold from the latch.
  const save=JSON.parse(JSON.stringify(g.snapshot())),resumed=new Game();resumed.start(0,make());assert(resumed.restore(save));
  assert.equal(at(resumed,'flap').fold,1);assert(!at(resumed,'flap').active);
  // The reverse: a wall that lies down into a deck.
  const h=game({platforms:[deck('start',-4,10,0,{checkpoint:2}),deck('landing',9,6,0),deck('goal',190,6,0,{goal:true}),{id:'flap2',kind:'fold',x:6,w:3,y:0,channel:'fold-b',duration:.5,pivot:'right',from:'wall',to:'deck'}]});
  const flap2=at(h,'flap2');assert(!flap2.active,'a fold that starts as a wall is not a deck at first');assert.deepEqual(wallBox(flap2),{x:9-FOLD.thickness/2,w:FOLD.thickness,top:3,bottom:0});
  Object.assign(h.player,{x:7.5,y:.5,vx:0,vy:0,groundId:null,coyote:0});tick(h,40);assert(h.player.y<0,'nothing to land on while it stands');
  stand(h,'landing');h.activate('fold-b',0,0);tick(h,72);assert(flap2.active);assert.equal(wallBox(flap2),null);
  Object.assign(h.player,{x:7.5,y:.5,vx:0,vy:0,groundId:null,coyote:0});tick(h,40);assert.equal(h.player.groundId,'flap2','laid flat, it is a deck again');
});

// --- 7. dome islands ---------------------------------------------------------------------
check('a dome is a circular arc with its apex at y; a walker follows it over the top, slides off its flanks, and turns it as they go',()=>{
  const g=game({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'ball',kind:'dome',x:10,w:6,y:3},deck('floor',8,12,-4)]});
  const ball=at(g,'ball');
  assert.equal(surfaceAt(ball,13),3);assert(near(surfaceAt(ball,10),0));assert(near(surfaceAt(ball,11.5),Math.sqrt(9-2.25)));assert.equal(domeSurface(ball,9),0,'flat at the rim outside its span');
  assert(!domeSteepAt(ball,13,RULES.radius));assert(!domeSteepAt(ball,11.3,RULES.radius));assert(domeSteepAt(ball,10.2,RULES.radius));assert(!domeSteepAt(at(g,'start'),1,RULES.radius));
  stand(g,'ball');assert.equal(g.player.y,3);
  for(let i=0;i<36;i++){g.tick(dt,{right:true});assert.equal(g.player.groundId,'ball');assert(near(g.player.y,domeSurface(ball,g.player.x),1e-6),'glued to the arc');}
  assert(g.player.x>14.2&&g.player.y<2.9,'over the top and down the far side');
  assert(ball.domeSpin>.4&&near(ball.domeSpin,(g.player.x-13)/3,1e-6),'the sphere turns by the rider\'s travel over its radius');
  tick(g,60,{right:true});assert.notEqual(g.player.groundId,'ball','slid off the steep flank');
  // Nobody lands on the flank: dropped over it, the player falls to the floor below.
  Object.assign(g.player,{x:10.15,y:2.2,vx:0,vy:0,groundId:null,coyote:0});
  for(let i=0;i<120;i++){g.tick(dt,{});assert.notEqual(g.player.groundId,'ball');}
  assert.equal(g.player.groundId,'floor');
  // Ordinary jump physics off the apex.
  stand(g,'ball');tick(g,30,{jumpPressed:true,jumpHeld:true});assert(g.player.y>3.5);assert.equal(g.player.groundId,null);
});

// --- 8. stations that work themselves and open channels ---------------------------------
const shapingLevel=()=>({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('dock',22,6,0),deck('goal',190,6,0,{goal:true}),clay('lump',10,'self'),clay('plug',30,'hand'),{id:'raised',kind:'counter',x:40,w:3,y:0,rise:3,channel:'plug-done'}],
  shaping:[station('self',['lump'],0,20,{auto:'wake-lump',channel:'lump-done',cueX:11}),station('hand',['plug'],22,38,{auto:undefined,channel:'plug-done'})]});
check('an auto station ignores hands until its channel latches, then works itself to full, heard once, and a finished station opens its channel',()=>{
  const events=[],g=game(shapingLevel(),events);
  const self=g.level.shaping.find(s=>s.id==='self'),hand=g.level.shaping.find(s=>s.id==='hand');
  tick(g,240,{shapeHeld:true});assert.equal(self.amount,0,'a hand does nothing to a station that works itself');
  g.tick(dt,{shapeId:'self',shapeAmount:.6});assert.equal(self.target,0);
  g.activate('wake-lump',0,0);tick(g,180);
  assert.equal(self.amount,1);assert.equal(at(g,'lump').w,4);
  assert.equal(events.filter(e=>e.type==='knead').length,1,'heard once as it starts, not for as long as it moves');
  assert(events.some(e=>e.type==='shape'&&e.id==='self'));
  const opened=events.find(e=>e.type==='activate'&&e.channel==='lump-done');assert(opened);assert.equal(opened.x,11);assert.equal(opened.y,0);
  tick(g,240,{shapeReset:true});assert.equal(self.amount,1,'R does not soften self-working terrain');
  // A hand-worked station opens its channel only when it is full.
  stand(g,'dock',2);tick(g,60,{shapeHeld:true});
  assert(hand.amount>0&&hand.amount<1);assert(!g.latched['plug-done']);
  tick(g,200,{shapeHeld:true});assert.equal(hand.amount,1);assert(g.latched['plug-done']);
  const counter=at(g,'raised');tick(g,240);assert.equal(counter.y,3,'the channel it opened lifts the counter');
  // R softens the clay again, but a chapter's channel stays open once opened.
  tick(g,30,{shapeReset:true});assert.equal(hand.amount,0);assert(g.latched['plug-done'],'a chapter latch is for good');
  tick(g,300,{shapeHeld:true});assert.equal(hand.amount,1);
  // The station channel is a source a save may carry, restored silently.
  const save=JSON.parse(JSON.stringify(g.snapshot()));assert(save.shaped.includes('hand')&&save.latched.includes('plug-done'));
  const quiet=[],resumed=new Game();resumed.onEvent=e=>quiet.push(e);resumed.start(0,level(shapingLevel()));quiet.length=0;assert(resumed.restore(save));
  assert(resumed.latched['plug-done']);assert.equal(resumed.level.shaping.find(s=>s.id==='hand').amount,1);assert.equal(at(resumed,'raised').y,3);
  assert(!quiet.some(e=>e.type==='activate'),'a restore re-latches without announcing');
});

// --- 12. the ending -----------------------------------------------------------------------
const finaleLevel=(extra={})=>level({end:68,
  platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('flowerDeck',10,6,0),deck('wake',60,10,0,{goal:true,checkpoint:62}),clay('strand-a-clay',20,'strand-a'),clay('strand-b-clay',30,'strand-b')],
  shaping:[station('strand-a',['strand-a-clay'],18,26),station('strand-b',['strand-b-clay'],28,36)],
  finale:{flower:{x:13,y:1},requires:['strand-a','strand-b'],wake:{x:63,y:0,groundId:'wake'},duration:2},
  routeLinks:[{from:'flowerDeck',to:'wake',mode:'finale'}],...extra});
const work=(g,id)=>{const s=g.level.shaping.find(s=>s.id===id);s.target=1;s.amount=1;};
check('the flower ripens when every strand is worked, the pickup locks the player, and they wake on the wake deck where the bell completes the chapter',()=>{
  const events=[],g=new Game();g.onEvent=e=>events.push({...e,at:g.time});g.start(0,finaleLevel());
  assert.deepEqual(finaleFlower(g.level),{x:13,y:1});assert.equal(g.finale.state,'waiting');
  stand(g,'flowerDeck',3);tick(g,120);assert.equal(g.finale.state,'waiting','touching a flower that is not ripe does nothing');
  work(g,'strand-a');g.tick(dt,{});
  let strand=events.filter(e=>e.type==='finale-strand');assert.equal(strand.length,1);assert.deepEqual([strand[0].id,strand[0].count,strand[0].total],['strand-a',1,2]);assert.equal(g.finale.state,'waiting');
  work(g,'strand-b');g.tick(dt,{});
  strand=events.filter(e=>e.type==='finale-strand');assert.equal(strand.length,2);assert(events.some(e=>e.type==='finale-ripe'));
  assert.equal(g.finale.state,'pickup','standing at the flower the moment it ripens picks it');
  assert(events.some(e=>e.type==='finale-pickup'&&e.x===13&&e.y===1));
  const x=g.player.x;tick(g,60,{right:true,jumpPressed:true,jumpHeld:true,stompPressed:true});
  assert.equal(g.player.x,x,'input is locked through the pickup');assert.equal(g.player.groundId,'flowerDeck');assert.equal(g.player.vx,0);
  g.damage();assert.equal(g.player.health,RULES.maxHealth,'nothing hurts through the pickup');
  tick(g,181);assert.equal(g.finale.state,'awake');assert(events.some(e=>e.type==='finale-awake'&&e.x===63));
  assert.equal(g.player.x,63);assert.equal(g.player.y,0);assert.equal(g.player.groundId,'wake');
  assert.deepEqual(g.checkpoint,{x:63,y:0});assert.equal(g.checkpointId,'wake');assert(g.activatedCheckpoints.has('wake'));
  tick(g,30,{right:true});assert(g.player.x>63.5,'input is back');
  tick(g,150,{right:true});assert.equal(g.status,'complete','the bell on the wake deck completes the chapter');
  assert.equal(g.deaths,0);
});
check('the ending is saved and restored: awake resumes on the wake deck, ripe resumes ripe, and nothing is announced again',()=>{
  const g=new Game();g.start(0,finaleLevel());work(g,'strand-a');work(g,'strand-b');stand(g,'start',6);g.tick(dt,{});
  assert.equal(g.finale.state,'ripe');
  const ripeSave=JSON.parse(JSON.stringify(g.snapshot()));assert.equal(ripeSave.finale,'ripe');
  const quiet=[],r=new Game();r.onEvent=e=>quiet.push(e);r.start(0,finaleLevel());quiet.length=0;assert(r.restore(ripeSave));
  assert.equal(r.finale.state,'ripe');assert.deepEqual([...r.finale.strands].sort(),['strand-a','strand-b']);
  tick(r,10);assert(!quiet.some(e=>e.type==='finale-strand'||e.type==='finale-ripe'),'restored strands are not heard finishing again');
  stand(g,'flowerDeck',3);tick(g,300);assert.equal(g.finale.state,'awake');
  const awakeSave=JSON.parse(JSON.stringify(g.snapshot()));assert.equal(awakeSave.finale,'awake');assert.equal(awakeSave.checkpointId,'wake');
  const w=new Game();w.start(0,finaleLevel());assert(w.restore(awakeSave));
  assert.equal(w.finale.state,'awake');assert.equal(w.player.x,63);assert.equal(w.player.groundId,'wake');tick(w,30);assert.equal(w.player.groundId,'wake');
  // The bell does not ring before the player has woken, even standing on the wake deck.
  const early=new Game();early.start(0,finaleLevel());stand(early,'wake',9.5);tick(early,30,{right:true});assert.equal(early.status,'playing');
  // A finale that names its flower by the deck it stands on.
  const byDeck=new Game();byDeck.start(0,finaleLevel({finale:{flowerId:'flowerDeck',requires:[],wake:{x:63,y:0,groundId:'wake'},duration:1}}));
  assert.deepEqual(finaleFlower(byDeck.level),{x:13,y:1});byDeck.tick(dt,{});assert.equal(byDeck.finale.state,'ripe','nothing required, ripe from the start');
  // A chapter with no ending has no finale state and completes as before.
  const plain=game({});assert.equal(plain.finale,null);assert.equal(plain.snapshot().finale,null);
});

// --- 13. the creatures ---------------------------------------------------------------------
const floorLevel=(enemies,extra={})=>({platforms:[deck('floor',-4,40,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true})],enemies,...extra});
check('a hatworm patrols its lane, hurts from the side and squashes under a stomp with the clayling bounce',()=>{
  const events=[],g=game(floorLevel([{kind:'hatworm',x:12,y:0,min:10,max:14,speed:1.5}]),events);
  const e=g.level.enemies[0];assert(e.alive);assert.equal(e.speed,1.5);
  const dirs=new Set();let lo=Infinity,hi=-Infinity;
  Object.assign(g.player,{x:30});for(let i=0;i<600;i++){g.tick(dt,{});dirs.add(e.dir);lo=Math.min(lo,e.x);hi=Math.max(hi,e.x);}
  assert(dirs.size===2&&lo>=10&&hi<=14,'turns at both ends of its lane');
  Object.assign(g.player,{x:e.x+.4,y:0,groundId:'floor',vx:0});g.tick(dt,{});
  assert.equal(g.player.health,RULES.maxHealth-1,'its side hurts');assert(g.player.vy>0&&g.player.invuln>0);
  tick(g,240);Object.assign(g.player,{x:e.x,y:1.2,vx:0,vy:-5,groundId:null,coyote:0,invuln:0});tick(g,12,{jumpHeld:true});
  assert(!e.alive);assert(g.player.vy>10);assert(events.some(ev=>ev.type==='squish'&&ev.kind==='hatworm'));
  assert.equal(g.player.health,RULES.maxHealth-1,'a squash costs nothing');
  assert.equal(events.filter(ev=>ev.type==='hurt').length,1,'the generic clayling loop leaves dream creatures alone');
});
check('a blinker bobs along its lane in the air, watches the player, hurts on touch and pops under a stomp',()=>{
  const events=[],g=game(floorLevel([{kind:'blinker',x:12,y:3,min:10,max:14,speed:1.4}]),events);
  const e=g.level.enemies[0];assert.equal(e.bob,BLINKER.bob);assert.equal(e.period,BLINKER.period);
  let lo=Infinity,hi=-Infinity,ylo=Infinity,yhi=-Infinity;
  Object.assign(g.player,{x:30});for(let i=0;i<400;i++){g.tick(dt,{});lo=Math.min(lo,e.x);hi=Math.max(hi,e.x);ylo=Math.min(ylo,e.y);yhi=Math.max(yhi,e.y);}
  assert(lo>=10&&hi<=14&&hi-lo>2);assert(yhi-ylo>.6&&ylo>=3-BLINKER.bob-1e-9&&yhi<=3+BLINKER.bob+1e-9);
  assert.equal(e.face,1,'it looks toward a player on its right');Object.assign(g.player,{x:0});g.tick(dt,{});assert.equal(e.face,-1);
  Object.assign(g.player,{x:e.x,y:e.y-.6,vx:0,vy:4,groundId:null,coyote:0});g.tick(dt,{});
  assert.equal(g.player.health,RULES.maxHealth-1,'its body hurts');
  tick(g,240);Object.assign(g.player,{x:e.x,y:e.y+1.4,vx:0,vy:-6,groundId:null,coyote:0,invuln:0});tick(g,12,{});
  assert(!e.alive);assert(g.player.vy>8);assert(events.some(ev=>ev.type==='squish'&&ev.kind==='blinker'));
  // A respawn sends a living blinker home.
  const h=game(floorLevel([{kind:'blinker',x:12,y:3,min:10,max:14,speed:1.4}]));const b=h.level.enemies[0];Object.assign(h.player,{x:30});tick(h,200);assert(Math.abs(b.x-12)>.5);
  h.damage(true);tick(h,58);assert.equal(b.x,12,'home again the tick the respawn lands');
});
check('a drip hangs until the player passes beneath, falls under gravity onto the first deck, hurts falling, lies harmless, can be stomped away, and regrows after its period',()=>{
  const events=[],g=game(floorLevel([{kind:'drip',x:12,y:6,reach:1.2,period:2}]),events);
  const e=g.level.enemies[0];assert.equal(e.drip,'hanging');
  Object.assign(g.player,{x:8,y:0,groundId:'floor'});tick(g,240);assert.equal(e.drip,'hanging');assert.equal(e.y,6);
  // Standing under it but at its own height does not fetch it down.
  Object.assign(g.player,{x:12,y:6.5,groundId:null});g.tick(dt,{});assert.equal(e.drip,'hanging');
  Object.assign(g.player,{x:10.9,y:0,vx:0,vy:0,groundId:'floor'});g.tick(dt,{});assert.equal(e.drip,'falling');
  let fell=1;while(e.drip==='falling'){g.tick(dt,{});fell++;}
  assert.equal(e.drip,'splat');assert.equal(e.y,0,'landed on the floor\'s surface');assert.equal(e.floorId,'floor');
  assert(Math.abs(fell-Math.sqrt(2*6/DRIP.gravity)*120)<3,`fell for ${fell} frames`);
  assert.equal(g.player.health,RULES.maxHealth,'it missed a player beside it');
  // Harmless where it lies; a landing from above presses it away.
  Object.assign(g.player,{x:12,y:0,groundId:'floor'});tick(g,60);assert.equal(g.player.health,RULES.maxHealth);
  Object.assign(g.player,{x:12,y:.9,vx:0,vy:-5,groundId:null,coyote:0});tick(g,24,{});
  assert(!e.alive);assert(events.some(ev=>ev.type==='squish'&&ev.kind==='drip'));
  // Falling onto the player hurts.
  const h=game(floorLevel([{kind:'drip',x:12,y:5,reach:1.2,period:2}]));const d=h.level.enemies[0];
  Object.assign(h.player,{x:12,y:0,vx:0,vy:0,groundId:'floor'});
  let hurtAt=null;for(let i=0;i<120&&hurtAt===null;i++){h.tick(dt,{});if(h.player.health<RULES.maxHealth)hurtAt=h.time;}
  assert(hurtAt!==null&&d.drip==='falling','it struck the player on the way down');
  // It regrows on its stalk a period after letting go — with the player clear
  // of the puddle, since landing back on it would press it away — and a
  // respawn hangs it back up at once.
  Object.assign(h.player,{x:20,y:0,vx:0,vy:0,groundId:'floor'});
  while(d.drip!=='hanging'){h.tick(dt,{});assert(h.time<4);}
  assert.equal(d.x,12);assert.equal(d.y,5);
  Object.assign(h.player,{x:12,y:0,groundId:'floor',invuln:0});h.tick(dt,{});assert.equal(d.drip,'falling');h.damage(true);tick(h,70);assert.equal(d.drip,'hanging');assert.equal(d.y,5);
  // Over nothing it falls its full length, is gone, and still regrows.
  const k=game({platforms:[deck('floor',-4,8,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true})],enemies:[{kind:'drip',x:6,y:4,reach:3,period:1.5}]});
  const drop=k.level.enemies[0];Object.assign(k.player,{x:3.5,y:0,groundId:'floor'});k.tick(dt,{});k.tick(dt,{});assert.equal(drop.drip,'falling');
  Object.assign(k.player,{x:0,y:0,vx:0,vy:0,groundId:'floor'});tick(k,150);assert.equal(drop.drip,'gone');assert(drop.y<4-DRIP.fall);
  tick(k,90);assert.equal(drop.drip,'hanging');assert(drop.y===4);
});

// --- determinism ----------------------------------------------------------------------------
const detLevel=()=>({end:200,
  platforms:[deck('start',-4,12,0,{checkpoint:2}),{id:'belt',kind:'ledge',x:8,w:6,y:0,conveyor:1.5},{id:'raft',kind:'sink',x:14,w:3,y:0,rate:1,drop:1.5},{id:'flap',kind:'fold',x:17,w:3,y:0,channel:'fold-d',duration:1.2},deck('far',20,10,0),{id:'ball',kind:'dome',x:30,w:5,y:2},{id:'breath',kind:'wall',x:24,w:1.5,y:4,h:3,breathe:{dh:1,dx:.4,period:2.6}},{id:'lift',kind:'lift',x:12,w:2,y:3,moveY:2,period:3,waitFor:'lift-d'},deck('goal',190,6,0,{goal:true})],
  triggers:[{x:9,w:1,y:0,h:2,channel:'lift-d'},{x:21,w:1,y:0,h:2,channel:'fold-d'}],
  enemies:[{kind:'hatworm',x:23,y:0,min:21,max:25},{kind:'blinker',x:26,y:3,min:24,max:28},{kind:'drip',x:12,y:5,reach:1,period:3}]});
const input=i=>({right:true,jumpPressed:i%150===0,jumpHeld:i%150<40,stompPressed:i%400===200});
const state=g=>JSON.stringify({p:g.player,s:g.level.platforms.map(s=>[s.id,s.x,s.y,s.h,s.fold,s.active,s.domeSpin,s.run]),e:g.level.enemies.map(e=>[e.x,e.y,e.alive,e.drip,e.face,e.dir]),l:g.latched,c:g.channels,f:g.finale,d:g.deaths,t:g.time});
check('a cloned game and a replay from scratch reach the same state through folds, breathing, sinking, conveyors, domes, triggers and creatures',()=>{
  const a=game(detLevel());let b=null;
  for(let i=0;i<900;i++){if(i===300)b=cloneGame(a);a.tick(dt,input(i));if(b&&i>=300)b.tick(dt,input(i));}
  const c=game(detLevel());for(let i=0;i<900;i++)c.tick(dt,input(i));
  assert.equal(state(b),state(a));assert.equal(state(c),state(a));
  assert(a.latched['lift-d']&&a.latched['fold-d'],'the run walked through both trigger zones');
});

// --- the pilot -------------------------------------------------------------------------------
check('the pilot crosses the ending in finale mode, rides a sink down to a lower deck, and rides a waiting lift up',()=>{
  const r=crossing(0,{from:'flowerDeck',to:'wake',mode:'finale'},{source:finaleLevel()});assert(r,'finale crossing');assert(r.frames<=(2+2)*120);
  const sinkLevel=level({platforms:[deck('start',-4,14,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'raft',kind:'sink',x:10,w:3,y:0,rate:2,drop:3},deck('low',15,5,-6.5)]});
  assert(crossing(0,{from:'raft',to:'low',mode:'ride'},{source:sinkLevel}),'ride a sink down');
  const liftLevel=level({platforms:[deck('start',-4,14,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'lift',kind:'lift',x:10,w:3,y:0,moveY:4,period:4,waitFor:'go'},deck('high',15,5,3.6)],triggers:[{x:0,w:2,y:0,h:2,channel:'go'}]});
  assert(crossing(0,{from:'lift',to:'high',mode:'ride'},{source:liftLevel}),'ride a waiting lift up');
  assert.equal(crossing(0,{from:'lift',to:'high',mode:'ride'},{source:level({platforms:liftLevel.platforms})}),null,'with nothing to wake it the lift never comes');
});

// --- the editor ------------------------------------------------------------------------------
check('the editor accepts every new kind, creature, trigger and station field with its defaults, refuses malformed ones, and leaves old hashes alone',()=>{
  assert(['sink','fold','dome'].every(k=>KINDS[k]));assert(LISTS.includes('triggers'));
  const source=level({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),
      {id:'raft',kind:'sink',x:10,w:3,y:0},{id:'flap',kind:'fold',x:14,w:3,y:0,channel:'fold-a'},{id:'ball',kind:'dome',x:20,w:5,y:2},{id:'breath',kind:'wall',x:26,w:2,y:4,h:3,breathe:{period:3,dh:1}},{id:'belt',kind:'ledge',x:30,w:5,y:0,conveyor:2},{id:'lift',kind:'lift',x:36,w:3,y:0,moveY:2,waitFor:'go'},
      {...clay('lump',40,'self'),tint:'terrain',shape:{from:{x:40,w:2,y:0,h:1.3},to:{x:40,w:4,y:0,h:.65}}}],
    enemies:[{kind:'hatworm',x:12,y:0},{kind:'blinker',x:12,y:3},{kind:'drip',x:12,y:6}],
    triggers:[{x:6,w:2,y:0,h:3,channel:'go'}],
    shaping:[station('self',['lump'],38,44,{auto:'go',channel:'self-done',cueX:41})]});
  const clean=validateDraft(source,LEVELS[0]);
  const raft=clean.platforms.find(s=>s.id==='raft');assert.deepEqual([raft.rate,raft.drop],[SINK.rate,SINK.drop]);
  const flap=clean.platforms.find(s=>s.id==='flap');assert.deepEqual([flap.duration,flap.pivot,flap.from,flap.to],[FOLD.duration,'left','deck','wall']);
  assert.deepEqual(clean.platforms.find(s=>s.id==='breath').breathe,{period:3,dh:1});assert.equal(clean.platforms.find(s=>s.id==='belt').conveyor,2);
  assert.equal(clean.platforms.find(s=>s.id==='lift').waitFor,'go');assert.equal(clean.platforms.find(s=>s.id==='lump').tint,'terrain');
  const [worm,eye,drop]=clean.enemies;
  assert.deepEqual([worm.min,worm.max,worm.speed],[12-HATWORM.range,12+HATWORM.range,HATWORM.speed]);
  assert.deepEqual([eye.bob,eye.period,eye.speed],[BLINKER.bob,BLINKER.period,BLINKER.speed]);assert.deepEqual([drop.reach,drop.period],[DRIP.reach,DRIP.period]);
  assert.deepEqual(clean.triggers,[{x:6,y:0,w:2,h:3,channel:'go'}]);
  const self=clean.shaping.find(s=>s.id==='self');assert.deepEqual([self.auto,self.channel,self.cueX],['go','self-done',41]);
  for(const bad of [
    l=>{l.platforms.find(s=>s.id==='flap').pivot='up';},
    l=>{delete l.platforms.find(s=>s.id==='flap').channel;},
    l=>{l.platforms.find(s=>s.id==='breath').breathe={dh:1};},
    l=>{l.platforms.find(s=>s.id==='lump').tint='violet';},
    l=>{delete l.triggers[0].channel;},
    l=>{l.triggers[0].w=.1;},
    l=>{l.enemies.push({kind:'ghost',x:1,y:0});},
    l=>{l.shaping[0].auto='not ok!';},
  ]){const l=structuredClone(source);bad(l);assert.throws(()=>validateDraft(l,LEVELS[0]));}
  // A backup written before trigger zones existed still imports, and the
  // canyon's canonical hash — the one tests/editor.mjs holds — is unchanged.
  const old=structuredClone(source);delete old.triggers;assert.deepEqual(validateDraft(old,LEVELS[0]).triggers,[]);
  assert.equal(validateDraft(LEVELS[0],LEVELS[0]).layoutVersion,'editor-11-mxufqh');
  assert.notEqual(validateDraft(source,LEVELS[0]).layoutVersion,validateDraft(old,LEVELS[0]).layoutVersion,'a zone the chapter carries revises the layout');
  // Placing each through a session runs under the simulation.
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},library=new DraftLibrary(LEVELS,storage),s=new DraftSession(library,0);
  for(const type of ['sink','fold','dome','hatworm','blinker','drip','triggers']){
    s.add(type,30,4);const obj=selectedObject(s.level,s.selection);assert(obj);
    const g=new Game();g.start(0,s.level);for(let n=0;n<3;n++)g.tick(dt,{});assert(Number.isFinite(g.player.x));
  }
  assert.equal(objectLabel({x:1,y:1,channel:'a'},'triggers'),'Trigger zone');assert.equal(objectLabel({kind:'hatworm'},'enemies'),'Hatworm');
  s.add('ledge',50,2);s.set('kind','sink');assert.equal(selectedObject(s.level,s.selection).rate,SINK.rate);
  s.set('kind','fold');assert.equal(selectedObject(s.level,s.selection).pivot,'left');
});

// --- pictograms ----------------------------------------------------------------------------
check('the dream\'s hint pictograms exist and are not the fallback spark',()=>{
  for(const name of ['fold','breathe','river','knot','eye']){assert(HINT_ICON_NAMES.includes(name));const svg=hintIcon(name);assert(svg.startsWith('<svg'));assert.notEqual(svg,hintIcon('spark'));}
});

// --- the views ------------------------------------------------------------------------------
function fakeWorld(){
  const w=Object.create(World.prototype);
  w.levelRoot=new THREE.Group();w.fxRoot=new THREE.Group();w.backRoot=new THREE.Group();w.particles=[];w.platforms=new Map();w.enemyViews=new Map();
  w.reducedMotion=false;w.assetGeometry=new Set();w.flags=[];w.mat={};
  for(const name of ['terrain','terrain2','top','accent','water','vine','foliage','cream','dark','gold','orange','orangeLight','blue','blueLight','blueDark','rope','dust'])w.mat[name]=new THREE.MeshStandardMaterial({color:0x808080});
  w.flag=()=>new THREE.Group();
  return w;
}
const namesIn=root=>{const names=new Set();root.traverse(o=>{if(o.name)names.add(o.name);});return names;};
check('dream views build for every dream kind, decline the rest, and follow the simulation: breathing height, fold angle, dome spin, sink ripples, scrolling stripes and tinted clay',()=>{
  const w=fakeWorld(),g=game(detLevel());const L=g.level;
  for(const s of L.platforms){const grp=new THREE.Group();grp.position.set(s.x,s.y,0);w.levelRoot.add(grp);const view=createDreamView(w,s,grp);if(view)w.platforms.set(s.id,view);}
  assert.equal(dreamViewKind(at(g,'start')),null);assert.equal(createDreamView(w,at(g,'start'),new THREE.Group()),null,'stone is the world\'s own');
  for(const [id,kind] of [['belt','conveyor'],['raft','sink'],['flap','fold'],['ball','dome'],['breath','breathe']]){
    const view=w.platforms.get(id);assert(view,id);assert.equal(view.dream.kind,kind);assert(Array.isArray(view.ropes));assert(view.root.children.some(c=>c.isMesh||c.isGroup));
  }
  const tinted=level({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{...clay('lump',10,'self'),tint:'terrain'},clay('violet',20,'other')]});
  const tg=new Game();tg.start(0,tinted);
  const tint=createDreamView(w,at(tg,'lump'),new THREE.Group());assert(tint.clay);assert.equal(tint.dream.kind,'tint');assert.equal(tint.clay.pieces[0].mesh.material,w.mat.terrain);
  assert.equal(createDreamView(w,at(tg,'violet'),new THREE.Group()),null,'violet stations keep the world\'s clay view');
  // Drive the simulation and check each pose against the state it draws.
  const breath=w.platforms.get('breath').dream,flap=w.platforms.get('flap').dream,ball=w.platforms.get('ball').dream,raft=w.platforms.get('raft').dream,belt=w.platforms.get('belt').dream;
  const stripesAt=()=>belt.stripes.map(s=>s.position.x);
  const before=stripesAt();
  for(let i=0;i<900;i++){g.tick(dt,input(i));animateDreamViews(w,g,dt);}
  assert(near(breath.body.scale.y,at(g,'breath').h/3,1e-9));assert(near(breath.body.position.y,-at(g,'breath').h/2,1e-9));
  assert.equal(at(g,'flap').fold,1);assert(near(flap.pivot.rotation.z,Math.PI/2,1e-9),'a left-pivot fold stands its far end up');
  assert.equal(ball.sphere.rotation.z,-(at(g,'ball').domeSpin||0));
  assert.notDeepEqual(stripesAt(),before,'the stripes have scrolled');assert(belt.stripes.every(s=>s.position.x>=.25-1e-9&&s.position.x<=.25+belt.span+1e-9));
  stand(g,'raft');tick(g,60);animateDreamViews(w,g,dt);
  const sunk=at(g,'raft');assert(sunk.y<-.3);assert(raft.rings.every(r=>r.visible&&near(r.position.y,sunk.baseY-sunk.y-.06,1e-9)),'ripples stay at the water line as the raft goes under');
  // A right-pivot fold and a wall-to-deck fold turn the other way.
  const rg=game({platforms:[deck('start',-4,12,0,{checkpoint:2}),deck('goal',190,6,0,{goal:true}),{id:'r',kind:'fold',x:10,w:3,y:0,channel:'c',pivot:'right'},{id:'d',kind:'fold',x:14,w:3,y:0,channel:'c',from:'wall',to:'deck'}]});
  const rv=createDreamView(w,at(rg,'r'),new THREE.Group()),dv=createDreamView(w,at(rg,'d'),new THREE.Group());
  assert.equal(rv.dream.pivot.position.x,3);assert(near(rv.dream.pivot.rotation.z,0));assert(near(dv.dream.pivot.rotation.z,Math.PI/2,1e-9),'a fold that starts as a wall is drawn standing');
  w.platforms.set('r',rv);w.platforms.set('d',dv);rg.activate('c',0,0);tick(rg,300);animateDreamViews(w,rg,dt);
  assert(near(rv.dream.pivot.rotation.z,-Math.PI/2,1e-9));assert(near(dv.dream.pivot.rotation.z,0,1e-9));
});
check('the flower is a bud, opens when ripe, folds into a lump through the pickup and is gone once awake',()=>{
  const w=fakeWorld(),g=new Game();g.start(0,finaleLevel());
  const flower=createDreamFlower(w,g.level);assert.equal(w.dreamFlower,flower);assert.deepEqual([flower.root.position.x,flower.root.position.y],[13,1]);
  assert(namesIn(flower.root).has('Flower petal')&&namesIn(flower.root).has('Flower heart'));
  for(let i=0;i<60;i++){g.tick(dt,{});animateDreamViews(w,g,dt);}
  const bud=flower.bloom.scale.x;assert(bud<.75);
  work(g,'strand-a');work(g,'strand-b');stand(g,'start',6);for(let i=0;i<240;i++){g.tick(dt,{});animateDreamViews(w,g,dt);}
  assert.equal(g.finale.state,'ripe');assert(flower.bloom.scale.x>bud+.2,'open');
  stand(g,'flowerDeck',3);g.tick(dt,{});animateDreamViews(w,g,dt);assert.equal(g.finale.state,'pickup');
  for(let i=0;i<200;i++){g.tick(dt,{});animateDreamViews(w,g,dt);}
  assert(g.finale.state==='pickup'&&flower.bloom.scale.x<.4&&flower.stem.scale.y<.3,'folding into a lump');
  for(let i=0;i<60;i++){g.tick(dt,{});animateDreamViews(w,g,dt);}
  assert.equal(g.finale.state,'awake');assert.equal(flower.root.visible,false);
  assert.equal(createDreamFlower(w,level()),null,'no ending, no flower');
});
check('dream creatures build through the enemy dispatch with named parts, animate alive, and die into the squash-and-shatter flow',()=>{
  const w=fakeWorld(),g=game(floorLevel([{kind:'hatworm',x:12,y:0,min:10,max:14},{kind:'blinker',x:20,y:3,min:18,max:22},{kind:'drip',x:30,y:6,reach:1.2,period:2}]));
  const [worm,eye,drop]=g.level.enemies,views=g.level.enemies.map(e=>{const v=createEnemyView(w,e);w.enemyViews.set(e.id,v);return v;});
  assert.deepEqual(views.map(v=>v.kind),DREAM_KINDS);
  const want={hatworm:['Hatworm body','Hatworm hat 1','Hatworm hat 3','Hatworm head'],blinker:['Blinker eye','Iris','Pupil','Blinker lid'],drip:['Drip blob','Drip body','Drip stalk']};
  for(const v of views){const names=namesIn(v.root);for(const n of want[v.kind])assert(names.has(n),`${v.kind} has ${n}`);assert(v.root.parent===w.levelRoot);}
  Object.assign(g.player,{x:36});
  for(let i=0;i<240;i++){g.tick(dt,{});for(const [k,e] of g.level.enemies.entries())animateEnemy(views[k],e,dt,'playing');}
  assert.equal(views[0].root.position.x,worm.x);assert.equal(views[1].root.position.y,eye.y);assert(views[2].parts.stalk.visible,'a hanging drip shows its stalk');
  assert.equal(views[1].parts.gaze.rotation.y>0,true,'the eye has turned toward the player on its right');
  // The drip's state changes its shape.
  Object.assign(g.player,{x:30,y:0,groundId:'floor'});while(drop.drip!=='splat'){g.tick(dt,{});animateEnemy(views[2],drop,dt,'playing');}
  assert(!views[2].parts.stalk.visible);assert(views[2].parts.blob.scale.y<.5,'a puddle');
  // Death: pressed flat about the root, then the world's shatter breaks it — without throwing.
  for(const [k,e] of [[0,worm],[1,eye]]){
    e.alive=false;const v=views[k];animateEnemy(v,e,dt,'playing');assert(v.root.scale.y<1&&v.root.scale.x>1,'pressed flat');
    settleSquash(w,e,v,g.level.platforms);assert.equal(v.squashStage,1);
    for(let i=0;i<60;i++){animateEnemy(v,e,dt,'playing');settleSquash(w,e,v,g.level.platforms);}
    assert.equal(v.squashStage,2,'broken into clumps on the shatter beat');assert.equal(v.root.visible,false);
  }
  assert(views[1].squashFloorY!==undefined&&views[1].root.position.y>=views[1].squashFloorY+.12-1e-9,'a popped eye sinks no lower than the deck under it');
  assert(w.particles.some(q=>q.kind==='clay-clump'));
  // A paused frame moves nothing.
  const frozen=JSON.stringify(views[2].root.toJSON());animateEnemy(views[2],drop,.5,'paused');assert.equal(JSON.stringify(views[2].root.toJSON()),frozen);
});

console.log(`${checks} dream mechanic checks passed`);
