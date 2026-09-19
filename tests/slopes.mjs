// A hill costs going up and pays coming down.
//
// Running up a slope slows the walker and turns the run into a walk; running
// down one lets the speed gather, and past the point where the feet would stop
// holding the body goes down on its side and slides. None of it is authored per
// surface: the grade is read off `surfaceAt`, the one function every kind of
// ground already answers, so an authored clay ramp, a formable mass the player
// sculpted themselves and a dome's flank all behave the same way. That is what
// these checks are mostly about — the same slope, arrived at three different
// ways, being the same slope.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,RULES,SLOPE,DOME_WALK,gradeAt,surfaceAt} from '../dist/simulation.js';
import {createHero,attachHero,animateHero} from '../dist/hero.js';
import {readPlayer} from './load-player.mjs';
import {FORM,createForm} from '../dist/clay-form.js';

let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}

// A bare level: a flat run-up at the height the slope starts, the sloped
// stretch itself, and a deck at the far end so the walker has somewhere to
// arrive. Both decks are read off the slope, so the same builder serves a climb
// and a descent. Nothing else is alive on it.
const RAMP_X=20;
// `from:'ramp'` starts the walker already on the slope at a run. A deck's half
// width overlaps the ground beside it, so at the lip of a descent the deck is
// still the higher surface for a third of a unit after the slope has begun
// dropping — long-standing behaviour that launches a runner off the edge, and
// nothing to do with the grade. Chapters join their ramps to their decks; these
// checks are about the slope itself, so they begin on it.
function stage(slopes,{from='flat'}={}){
  const list=[].concat(slopes),first=list[0],last=list[list.length-1];
  const g=new Game();g.start(0);
  Object.assign(g.level,{enemies:[],hazards:[],crushers:[],coins:[],stamps:[],shaping:[],winds:[],triggers:[]});
  const startY=surfaceAt(first,first.x+1e-3),endY=surfaceAt(last,last.x+last.w-1e-3);
  const flat={id:'flat',kind:'stone',x:first.x-20,w:20,y:startY,h:1,section:0};
  const far={id:'far',kind:'stone',x:last.x+last.w,w:30,y:endY,h:1,section:0};
  g.level.platforms=[flat,...list,far];
  for(const s of g.level.platforms){s.active=true;Object.assign(s,{prevX:s.x,prevY:s.y,prevW:s.w,prevSlope:s.slope??0});}
  const x=from==='ramp'?first.x+1:flat.x+2;
  Object.assign(g.player,{x,y:from==='ramp'?surfaceAt(first,x):startY,
    vx:from==='ramp'?RULES.speed:0,vy:0,groundId:from==='ramp'?first.id:'flat',coyote:.135});
  return g;
}
// An authored clay ramp of a constant grade: `slope` is the whole rise, so the
// gradient is that over the width. A descent is stood high enough up that its
// foot still lands well clear of the bottom of the world.
function clayRamp(gradient,w=24,{id='ramp',x=RAMP_X,y=null}={}){
  const rise=gradient*w;
  return {id,kind:'clay',shape:{},x,w,y:y??10+Math.max(0,-rise),h:2,slope:rise,section:0};
}
// The same grade, built as a formable mass instead — the heightfield of columns
// the player pushes around by hand. It cannot be taller than `FORM.maxHeight`,
// so a steep grade gets a short run rather than an impossible column.
function formRamp(gradient){
  const rise=FORM.maxHeight-FORM.minThick-.3,w=Math.min(24,Math.max(4,rise/Math.abs(gradient)));
  const form=createForm(w,1),top=FORM.minThick+Math.abs(gradient)*w;
  for(let i=0;i<form.n;i++){
    const lx=i*form.dx;
    form.h[i]=gradient>0?FORM.minThick+gradient*lx:top+gradient*lx;
  }
  // The columns are authored outright here rather than sculpted, so the poses
  // the mass would otherwise slump back towards are set to match.
  form.rest.set(form.h);form.prev.set(form.h);form.settled=true;
  // A mass in the chapters is a shaped part that carries a form, and it is the
  // shaped half that tells the walker to keep their feet on the surface rather
  // than sailing off the top of a descent, so the test's mass is built the same.
  return {id:'ramp',kind:'clay',shape:{},form,x:RAMP_X,w,y:10+FORM.maxHeight,h:FORM.maxHeight,section:0};
}
// Walk right for `seconds`, reporting what happened while the sloped stretch
// was underfoot.
function run(g,seconds=12){
  const p=g.player,ramp=g.level.platforms.find(s=>s.id==='ramp'),speeds=[];let slid=false;
  for(let i=0;i<Math.round(seconds/dt);i++){
    g.tick(dt,{right:true});
    if(p.groundId==='ramp'){speeds.push(Math.abs(p.vx));if(p.sliding)slid=true;}
    // Stop short of the far deck: its side is a wall like any other, and a
    // walker pressed against it says nothing about what the hill did to them.
    if(p.groundId==='far'||p.x>ramp.x+ramp.w-1.5)break;
  }
  // The last third, by which time the grade has had its full say.
  const steady=speeds.slice(Math.floor(speeds.length*2/3));
  return {slid,deaths:g.deaths,ticks:speeds.length,top:speeds.length?Math.max(...speeds):0,
    steady:steady.length?steady.reduce((a,b)=>a+b,0)/steady.length:0};
}

// --- the grade itself ----------------------------------------------------------------------
check('every kind of ground reports its own grade through the one surface function',()=>{
  const flat={id:'f',kind:'stone',x:0,w:20,y:10,h:1};
  assert.equal(gradeAt(flat,10),0,'a plain deck is flat');
  assert(Math.abs(gradeAt(clayRamp(.75),30)-.75)<1e-9,'an authored clay ramp reports the grade it was authored with');
  assert(Math.abs(gradeAt(formRamp(.75),30)-.75)<1e-6,'a formable mass reports the grade of the columns it was pushed into');
  // A dome's flank sweeps from flat at the crown to sheer at the rim, so it
  // passes through every grade there is on the way.
  const dome={id:'d',kind:'dome',x:0,w:20,y:10,h:1};
  assert(Math.abs(gradeAt(dome,10))<.05,'a dome is flat over its crown');
  assert(gradeAt(dome,2)>1&&gradeAt(dome,18)<-1,'and steepens to either side');
  assert.equal(gradeAt(null,0),0,'nothing underfoot is no grade at all');
});

// --- the flat is left exactly as it was ------------------------------------------------------
check('flat ground keeps the pace it always had',()=>{
  const g=stage(clayRamp(0)),p=g.player;
  for(let i=0;i<240;i++)g.tick(dt,{right:true});
  assert.equal(Math.abs(p.vx),RULES.speed,'the top speed on the level is untouched');
  assert.equal(p.grade,0);assert.equal(p.sliding,false,'and nobody slides along it');
});

// --- up ---------------------------------------------------------------------------------------
for(const [what,make] of [['an authored clay ramp',clayRamp],['a formable clay mass',formRamp]]){
  check(`running up ${what} slows the walker, without ever letting go of the ground`,()=>{
    const gentle=run(stage(make(.2))),steep=run(stage(make(.75)));
    assert(gentle.ticks>60&&steep.ticks>60,'both climbs were actually walked');
    assert(steep.steady<gentle.steady,'the steeper hill is the slower one');
    assert(steep.steady<RULES.speed*.85,`a real climb costs real speed (${steep.steady.toFixed(2)})`);
    assert(steep.steady>RULES.speed*.4,`but it is a slowing, not a stopping (${steep.steady.toFixed(2)})`);
    assert(gentle.steady>steep.steady&&gentle.steady<RULES.speed,'a gentle rise costs a little');
    assert(!steep.slid&&!gentle.slid,'climbing is never sliding');
    assert.equal(steep.deaths,0,'and nobody falls off a hill they walked up');
  });
}
check('the pace a hill leaves is exactly what its grade asks for',()=>{
  const g=stage(clayRamp(.75)),p=g.player;
  for(let i=0;i<900&&p.groundId!=='ramp';i++)g.tick(dt,{right:true});
  for(let i=0;i<240;i++)g.tick(dt,{right:true});
  const want=RULES.speed*(1-SLOPE.uphill*(.75/DOME_WALK));
  assert(Math.abs(Math.abs(p.vx)-want)<1e-6,`${Math.abs(p.vx).toFixed(4)} against ${want.toFixed(4)}`);
});

// --- down -------------------------------------------------------------------------------------
for(const [what,make] of [['an authored clay ramp',clayRamp],['a formable clay mass',formRamp]]){
  check(`running down ${what} gathers speed first and slides once it is steep`,()=>{
    const eased=run(stage(make(-.55),{from:'ramp'})),sheer=run(stage(make(-1.3),{from:'ramp'}));
    assert(eased.ticks>40&&sheer.ticks>20,'both descents were actually taken');
    assert(eased.steady>RULES.speed,`a slope worth running down beats the pace on the level (${eased.steady.toFixed(2)})`);
    assert(!eased.slid,'but it is still being run down, on its feet');
    assert(sheer.slid,'the steeper face is slid instead');
    assert(sheer.top>eased.top,'and it is the faster of the two');
    assert(sheer.top<=SLOPE.top+1e-9,'a slide still has a ceiling');
  });
}
check('a slide is let go of once the ground eases, and a jump ends it outright',()=>{
  const g=stage(clayRamp(-1.3),{from:'ramp'}),p=g.player;
  for(let i=0;i<1800&&!p.sliding;i++)g.tick(dt,{right:true});
  assert(p.sliding,'sliding down the face');
  g.tick(dt,{right:true,jumpPressed:true,jumpHeld:true});
  assert(!p.sliding&&p.vy>0,'jumping off it stands the walker back up');
  for(let i=0;i<1800&&p.groundId!=='far';i++)g.tick(dt,{right:true});
  assert.equal(p.groundId,'far','arrived on the flat at the bottom');
  for(let i=0;i<120;i++)g.tick(dt,{right:true});
  assert(!p.sliding,'and is not still sliding along it');
  assert(Math.abs(p.vx)<=RULES.speed+1e-9,'the speed the hill gave back is given up again');
});
check('facing up a steep face is a climb, never a slip backwards',()=>{
  // The same grade that is slid down going the other way. Walking into it, the
  // walker climbs it slowly — whatever the face does to someone descending it,
  // it never takes the legs out from under someone going up.
  const g=stage(clayRamp(1.3)),p=g.player;
  const before=run(g,6);
  assert(!before.slid,'never slid while facing up the face');
  assert.equal(g.deaths,0);
});

// --- what it looks like -------------------------------------------------------------------------
const bytes=new URL('../dist/assets/player.glb',import.meta.url);
const motion=JSON.parse(await readFile(new URL('../dist/assets/player-motion.json',import.meta.url)));
const idle=JSON.parse(await readFile(new URL('../dist/assets/player-idle.json',import.meta.url)));
const w={scene:new THREE.Scene(),mat:{shadow:new THREE.MeshBasicMaterial()},reducedMotion:false,time:0,
  mesh(g,m,parent){const o=new THREE.Mesh(g,m);parent.add(o);return o;}};
w.character=createHero(w);w.scene.add(w.character.root);
attachHero(w,await readPlayer(),motion,idle);
const c=w.character;
const settle=(g,frames=90)=>{for(let i=0;i<frames;i++){g.tick(dt,{right:true});animateHero(w,g,dt);}};

check('the slide take is wired up: it glides to its seam and stands up after',()=>{
  assert(c.clips.slide&&c.clips.slideStop,'both halves of the shipped slide');
  assert.equal(c.clips.slide.userData.source,'slide_light');
  assert.equal(c.clips.slideStop.userData.source,'slide_light');
  assert(c.clips.slide.duration>.5&&c.clips.slideStop.duration>.5,'neither half is a sliver');
  assert(Math.abs(c.clips.slide.duration+c.clips.slideStop.duration-1.567)<.05,'and together they are the take');
});
check('a climb is walked where the same speed on the level would be run',()=>{
  const level=stage(clayRamp(0));settle(level,240);
  const flat={run:c.weights.run,walk:c.weights.walk,speed:Math.abs(level.player.vx)};
  assert(flat.run>.9&&flat.walk<.1,`the level is run along (run ${flat.run.toFixed(2)})`);
  const hill=stage(clayRamp(.75));
  for(let i=0;i<1800&&hill.player.groundId!=='ramp';i++){hill.tick(dt,{right:true});animateHero(w,hill,dt);}
  settle(hill,240);
  assert(c.weights.walk>.9&&c.weights.run<.1,`the hill is walked (walk ${c.weights.walk.toFixed(2)}, run ${c.weights.run.toFixed(2)})`);
  assert(Math.abs(hill.player.vx)>flat.speed*.6,'at a pace that would have been a run on the level');
});
check('a steep descent shows the slide, and the getting-up once it is over',()=>{
  // A steep face that eases into a gentle run-out, the way a hill in a chapter
  // would be shaped. Meeting flat ground straight off a slide at full tilt
  // throws the body clear instead, and a launch is a landing, not a getting-up.
  const steep=clayRamp(-1.3,16),runout=clayRamp(-.35,14,{id:'runout',x:steep.x+steep.w,y:surfaceAt(steep,steep.x+steep.w-1e-3)});
  const g=stage([steep,runout],{from:'ramp'});
  for(let i=0;i<1800&&!g.player.sliding;i++){g.tick(dt,{right:true});animateHero(w,g,dt);}
  assert(g.player.sliding,'sliding down the face');
  for(let i=0;i<40;i++){g.tick(dt,{right:true});animateHero(w,g,dt);}
  assert.equal(c.state,'slide','the slide take is what is showing');
  assert(c.weights.slide>.5,`and it is what is weighted (${c.weights.slide.toFixed(2)})`);
  // Run the rest of it out and read back the order the states came in. The tick
  // the face runs out on depends on where the slide happened to have got to, so
  // what is asserted is the sequence, not the frame.
  const seen=[c.state];
  for(let i=0;i<1800&&seen[seen.length-1]!=='locomotion';i++){
    g.tick(dt,{right:true});animateHero(w,g,dt);
    if(c.state!==seen[seen.length-1])seen.push(c.state);
  }
  // Airborne states are left out: whether a seam between two decks throws in a
  // hop on the way is beside the point, which is that the slide is followed by
  // the getting-up and then by running on.
  assert.deepEqual(seen.filter(s=>!/^(jump|leap|land)/.test(s)),['slide','slideStop','locomotion'],
    `the slide stands up and runs on (${seen.join(' → ')})`);
  assert(!g.player.sliding&&g.player.groundId,'back on its feet on the ground');
});

console.log(`${checks} slope checks passed.`);
