// Walking into shapeable clay counts as the swipe towards it. A grounded walk
// pressed against a wall of the formable mass takes hold of it at the shoulder
// and drags it the way the walk goes, at a pushed block's pace, the walker
// following flush; pressed against hand-worked clay the way that clay is
// pulled, it pulls it. Clay pulled up, down or outward is not pulled by a walk,
// a walk away from the clay does nothing, and nobody leans on anything in the
// air. The character reads it as a push, paced to how fast the clay went.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt,RULES as PLAYER,SLOPE} from '../dist/simulation.js';
import lab from '../dist/routes/clay-lab.js';
import playground from '../dist/routes/clay-playground.js';
import {visitStation,nearbyStation,LEAN,formWallAhead,formWallStop,clayInWay,leanStation} from '../dist/shaping.js';
import {FORM,formHeight,formVolume} from '../dist/clay-form.js';

const frames=s=>Math.round(s/dt),close=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

// A rig around the lab's plain formable bench, with the invariants every tick
// of a walk on the mass has to keep.
function formRig(){
  const g=new Game();g.start(3,lab);assert(visitStation(g,'form'));
  const st=g.level.shaping.find(s=>s.id==='form'),s=g.level.platforms.find(q=>q.id===st.parts[0]),p=g.player,base=s.y-s.h;
  const events=[];g.onEvent=e=>events.push(e);
  let last=p.x,ticks=0;
  const tick=(input={})=>{
    g.tick(dt,input);ticks++;
    // A walk, or what a descent gathers on top of it; a slide is faster still,
    // and carries its speed off the end of the face.
    assert(Math.abs(p.x-last)<=(p.sliding||!p.groundId?SLOPE.top:6.7*(1+SLOPE.downhill))*dt+1e-3,`x moves continuously (tick ${ticks}: ${last.toFixed(3)} -> ${p.x.toFixed(3)})`);last=p.x;
    if(p.x>s.x&&p.x<s.x+s.w&&p.y<base+FORM.maxHeight)assert(p.y>=surfaceAt(s,p.x)-.12-1e-9,`feet never end a tick inside the clay (tick ${ticks})`);
    assert(close(formVolume(s.form),s.form.volume,1e-7),`volume holds (tick ${ticks})`);
    assert.equal(g.deaths,0);
  };
  const hand=(lx,ly)=>tick({shapeId:'form',shapeX:s.x+lx,shapeY:base+ly});
  const local=lx=>formHeight(s.form,lx);
  // A pointer taking hold of the surface at local x and lifting it by `dy`.
  const raise=(lx,dy,speed=.25)=>{tick();let ly=local(lx);hand(lx,ly);for(let i=0;i<Math.ceil(dy/speed);i++){ly+=speed;hand(lx,ly);}tick();};
  // Where the clay first rises a step above its left end: the foot of the wall.
  const foot=()=>{for(let lx=0;lx<s.w;lx+=.02)if(local(lx)>local(0)+FORM.step)return lx;return -1;};
  const place=(x,y)=>{Object.assign(p,{x,y,vx:0,vy:0,groundId:null,coyote:0,stomping:false});last=x;};
  const heard=type=>events.some(e=>e.type===type);
  return {g,st,s,p,base,tick,hand,local,raise,foot,place,heard,events};
}

// --- the formable mass: a wall walked into is a wall pushed --------------------
{
  const r=formRig(),{st,s,p,base,tick,local,raise,foot,place}=r;
  raise(8,3);
  const peak=local(8),foot0=foot();
  assert(peak>base+5-base&&foot0>4&&foot0<7,`a wall stands on the bench (peak ${peak.toFixed(2)}, foot at ${foot0.toFixed(2)})`);
  // Stand on the mass a stride short of the wall and walk into it.
  place(s.x+foot0-1.2,base+local(foot0-1.2));tick();tick();
  assert.equal(p.groundId,s.id);
  let leaning=0,firstLean=-1,stalls=0,pushedFast=0,x0=-1;
  for(let i=0;i<frames(1.2);i++){
    const before=p.x;tick({moveAxis:1});
    if(p.lean){
      if(firstLean<0){firstLean=i;x0=p.x;}
      leaning++;
      assert.equal(p.lean.id,'form');assert.equal(p.lean.dir,1);assert.equal(p.pushing,1,'the walker reads as pushing right');
      assert(close(p.lean.x,p.x+PLAYER.radius)&&close(p.lean.foot,p.x),'the lean is at the leading shoulder, the boots behind it');
      if(p.pushed>.5)pushedFast++;
      if(Math.abs(p.x-before)<1e-6)stalls++;
    }
  }
  assert(firstLean>=0&&leaning>frames(.6),`the walk leans on the wall for most of the second (${leaning} ticks)`);
  assert(foot()>foot0+1,`the wall's foot has gone ahead (${foot0.toFixed(2)} -> ${foot().toFixed(2)})`);
  assert(p.x>x0+.8,`and the walker followed it (${(x0-s.x).toFixed(2)} -> ${(p.x-s.x).toFixed(2)})`);
  assert(stalls<leaning*.1,`flush behind the clay, not by stops and starts (${stalls} stalled ticks of ${leaning})`);
  assert(pushedFast>leaning*.8,`paced to the clay: it went at ${FORM.lean} a second (${pushedFast} of ${leaning} ticks read as moving)`);
  assert(r.heard('knead'),'leaning on the clay is kneading, and heard');
  console.log('PASS the formable mass: a wall walked into goes ahead of the walk at a pushed block\'s pace, the walker flush behind it, reading as a push');
}

// --- from beside the mass, and the walks that lean on nothing ---------------------
{
  const r=formRig(),{st,s,p,base,tick,local,raise,foot,place}=r;
  // A wall at the mass's near end, and a walker on the dock beside it: the
  // dock is flush with the clay's rest, so the wall is the only thing in the
  // way. Tall enough that what the lean leaves is still a wall to the dock — a
  // lower one leans into a hill within a stride, and is simply climbed.
  raise(1.5,5);
  const foot0=foot();assert(foot0>=0&&foot0<1.5,`the wall stands at the near end (foot ${foot0.toFixed(2)})`);
  place(s.x-1.5,s.y);tick();tick();
  assert.notEqual(p.groundId,s.id,'on the dock');
  let leaning=0;
  for(let i=0;i<frames(1);i++){tick({moveAxis:1});if(p.lean){leaning++;assert.equal(p.pushing,1);}}
  assert(leaning>frames(.4),`a walker on the dock leans on the mass's side (${leaning} ticks)`);
  assert(foot()>foot0+.5,`and the wall goes ahead (${foot0.toFixed(2)} -> ${foot().toFixed(2)})`);
  const moved=foot();
  // Walking away from it is a walk away.
  for(let i=0;i<frames(.5);i++){tick({moveAxis:-1});assert(!p.lean&&!p.pushing,'a walk away from the clay leans on nothing');}
  assert(close(foot(),moved,.3),'and moves it no further than its own slump');
  console.log('PASS from the dock the mass\'s side is pushed too; a walk away leans on nothing');
}
{
  const r=formRig(),{st,s,p,base,tick,local,raise,foot,place}=r;
  raise(8,3);
  const foot0=foot();
  // Airborne against the wall, pressing into it: nobody leans in the air.
  place(s.x+foot0-.6,base+local(foot0-.6)+2.5);
  let airborne=0;
  for(let i=0;i<frames(.4)&&!p.groundId;i++){tick({moveAxis:1});if(p.groundId)break;airborne++;assert(!p.lean&&!p.pushing,'nobody leans on anything in the air');}
  assert(airborne>10);
  console.log('PASS a jump into the wall is not a lean');
}

// --- the stop at the wall's foot -------------------------------------------------
{
  const r=formRig(),{s,p,base,local,raise,foot}=r;
  raise(8,3);
  const foot0=foot(),prevX=s.x+foot0-.9,prevY=base+local(foot0-.9);
  const shim={x:prevX+.5};
  assert(formWallAhead(s,shim,prevX,prevY,PLAYER.radius),'half a unit on is into the wall');
  const stop=formWallStop(s,shim,prevX,prevY,PLAYER.radius);
  assert(stop>prevX&&stop<shim.x,'the stop is on the way there');
  assert(!formWallAhead(s,{x:stop},prevX,prevY,PLAYER.radius),'and is not a wall');
  assert(formWallAhead(s,{x:stop+.01},prevX,prevY,PLAYER.radius),'but a hair further is');
  assert(clayInWay(s,{x:stop,y:prevY},1,6.7*dt,PLAYER.radius,PLAYER.height),'so the next step has the clay in its way');
  assert(!clayInWay(s,{x:stop,y:prevY},-1,6.7*dt,PLAYER.radius,PLAYER.height),'and the step back does not');
  console.log('PASS a refused step ends at the wall\'s foot, where the next step finds clay in its way');
}

// --- hand-worked clay: pulled the way the walk goes, and only that way -----------
const boot=id=>{const g=new Game();g.start(3,playground);assert(visitStation(g,id));return g;};
{
  const g=boot('ramp'),st=g.level.shaping.find(s=>s.id==='ramp'),s=g.level.platforms.find(q=>q.id==='soft-ramp'),p=g.player;
  assert.equal(st.gesture,'right');
  let firstLean=-1,leaning=0,t0=0,done=-1;
  for(let i=0;i<frames(3);i++){
    g.tick(dt,{moveAxis:1});
    if(p.lean){if(firstLean<0){firstLean=i;t0=st.target;}leaning++;assert.equal(p.lean.id,'ramp');assert.equal(p.pushing,1,'leaning on the ramp reads as a push');assert(p.x<s.x,'from the dock, against its near face');}
    if(st.target>=1&&done<0)done=i;
  }
  assert(firstLean>=0&&done>firstLean,'the walk into the ramp pulls it to its pose');
  // The pull runs at LEAN a second at the stick's full throw, the tick after
  // each lean; the target is 1 by then.
  assert(close(done-firstLean,Math.ceil((1-t0)/(LEAN*dt)),3),`at ${LEAN} a second (${done-firstLean} ticks)`);
  assert(leaning<=done-firstLean+2,'and leans on nothing once the pull is spent');
  assert(p.groundId&&p.x>s.x+2&&p.y>s.y+.5,`the walker is up the ramp they leaned into (${p.x.toFixed(2)}, ${p.y.toFixed(2)} on ${p.groundId})`);
  assert.equal(g.deaths,0);
  console.log('PASS hand-worked clay pulled right is pulled by a walk to the right, as a swipe would');
}
{
  // The same clay from the wrong side: a walk to the left presses it back the
  // way it came, which is the pull undone, not made — nothing.
  const g=boot('ramp'),st=g.level.shaping.find(s=>s.id==='ramp'),s=g.level.platforms.find(q=>q.id==='soft-ramp'),p=g.player;
  Object.assign(p,{x:s.x+s.w+1,y:s.y-s.h+.5,vx:0,vy:0,groundId:null});
  for(let i=0;i<frames(1);i++){g.tick(dt,{moveAxis:-1});assert(!p.lean&&!p.pushing,'a walk against the pull leans on nothing');}
  assert.equal(st.target,0);
  // Clay pulled down, and clay pulled outward: no way a walk goes. The landing
  // hangs over a pit, so it is given a shelf either side to walk in from.
  const shelved=structuredClone(playground);
  shelved.platforms.push({id:'lean-shelf-l',x:46,w:4.2,y:2,kind:'stone'},{id:'lean-shelf-r',x:51.7,w:4,y:2,kind:'stone'});
  for(const [id,part,axis] of [['lift','soft-support',1],['landing','soft-landing',1],['landing','soft-landing',-1]]){
    const g=new Game();g.start(3,id==='landing'?shelved:playground);assert(visitStation(g,id));
    const st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===part),p=g.player;
    if(id==='landing')Object.assign(p,{x:axis>0?s.x-1.5:s.x+s.w+1.5,y:2,vx:0,vy:0,groundId:null});
    let touched=0;
    for(let i=0;i<frames(1.5);i++){g.tick(dt,{moveAxis:axis});if(p.groundId&&Math.abs(p.x+axis*PLAYER.radius-(axis>0?s.x:s.x+s.w))<.02)touched++;assert(!p.lean&&!p.pushing,`${id}: a walk into clay pulled ${st.gesture} leans on nothing`);}
    assert(touched>frames(.5),`${id}: the walker did reach the clay's side (${touched} ticks against it)`);
    assert.equal(st.target,0,`${id}: and moved nothing`);
    assert.equal(leanStation(g,s,axis),null);
  }
  console.log('PASS a walk the wrong way, or into clay pulled up, down or outward, leans on nothing');
}
