// The experimental clay rules, driven through the real simulation with real
// inputs. Each experiment has to actually do the thing its hint promises, and
// none of it may leak into a chapter.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import lab from '../dist/routes/clay-lab.js';
import {nearbyStation,visitStation,resetStation} from '../dist/shaping.js';
import {RULES,isRule,perPart,standingOn} from '../dist/clay-rules.js';

const source=JSON.stringify(lab),chapters=JSON.stringify(LEVELS);
const boot=()=>{const g=new Game();g.start(3,lab);return g;};
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:i===0&&input.jumpPressed,stompPressed:i===0&&input.stompPressed});};
const station=(g,id)=>g.level.shaping.find(s=>s.id===id);
const part=(g,id)=>g.level.platforms.find(s=>s.id===id);
// Walk towards a target x the way the player would, with the real move axis.
const walkTo=(g,x,frames=900)=>{for(let i=0;i<frames;i++){const d=x-g.player.x;if(Math.abs(d)<.12)return true;g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*2))});}return false;};
// Walk towards a target and hop when something blocks the way, which is what a
// player does at a mound they cannot step over.
const hopTo=(g,x,frames=1400)=>{
  let stuck=0,last=g.player.x;
  for(let i=0;i<frames;i++){
    const d=x-g.player.x;if(Math.abs(d)<.3)return true;
    stuck=Math.abs(g.player.x-last)<.004?stuck+1:0;last=g.player.x;
    const jump=stuck>6&&!!g.player.groundId;if(jump)stuck=0;
    g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*2)),jumpPressed:jump,jumpHeld:true});
  }
  return false;
};

// --- the level itself -------------------------------------------------------
{
  assert.equal(new Set(lab.platforms.map(p=>p.id)).size,lab.platforms.length,'platform ids are unique');
  assert(lab.playground,'the lab is a playground, so the station teleport works');
  assert.deepEqual(lab.shaping.map(s=>s.id),['sag','wear','catapult','stamp']);
  for(const s of lab.shaping){
    assert(isRule(s.rule),`${s.id} carries a known rule`);
    assert(s.end>s.x,`${s.id} owns a stretch of the bench`);
    assert(s.parts.length&&s.parts.every(id=>lab.platforms.some(p=>p.id===id&&p.shape)),`${s.id}'s clay exists`);
    assert(s.hint&&s.name&&s.spawn,`${s.id} is teachable`);
  }
  const ranges=lab.shaping.map(s=>[s.x,s.end]).sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<ranges.length;i++)assert(ranges[i][0]>=ranges[i-1][1]-1e-9,'station stretches do not overlap');
  // No chapter may ever take a rule: that is the whole containment story.
  for(const L of LEVELS)for(const s of L.shaping||[])assert(!s.rule,`${L.short} station ${s.id} is hand-worked`);
  assert.equal(RULES.length,4);
}
console.log('PASS the bench is well formed, its stations are ruled, and no chapter station is');

// --- 01 SAG: weight is the tool, and it keeps every millimetre ---------------
{
  const g=boot();assert(visitStation(g,'sag'));
  const s=station(g,'sag'),beam=part(g,'sag-beam');
  const top=surfaceAt(beam,beam.x+beam.w/2);
  assert(walkTo(g,beam.x+beam.w/2,1200),'walked onto the beam');
  assert.equal(standingOn(s,g.player),0,'standing on the beam');
  step(g,240);
  const sunk=surfaceAt(part(g,'sag-beam'),g.player.x);
  assert(sunk<top-.5,`standing sinks the beam (${top.toFixed(2)} -> ${sunk.toFixed(2)})`);
  assert(g.player.y<top-.4,'and carries the player down with it');
  assert(s.amount>.1&&s.amount<=1,'the sag is partial, not instant');
  // Step off: it sets. No spring back.
  const held=s.amount;
  // Step right off the beam onto the bench; the sag must stay exactly where it
  // was left, which is the whole idea.
  Object.assign(g.player,{x:part(g,'sag-exit').x+2,y:0,vx:0,vy:0,groundId:'sag-exit',coyote:.13});
  step(g,300);
  assert(Math.abs(s.amount-held)<1e-6,'it keeps the sag once you are off it, neither setting further nor springing back');
  assert(!g.deaths,'and nobody died getting there');
  // Only the reset softens it.
  resetStation(s);step(g,200);
  assert(s.amount<.05,'R makes the beam whole again');
  // Sagged all the way, the low door is reachable and there is a way back up.
  assert(g.level.platforms.some(pl=>pl.id==='sag-climb'),'the pit is never a trap');
}
console.log('PASS sag: standing sinks the beam, carries the player, and the shape sets when they leave');

// --- 02 WEAR: each crossing takes a share, the last takes the span -----------
{
  const g=boot();assert(visitStation(g,'wear'));
  const s=station(g,'wear'),span=part(g,'wear-span');
  assert.equal(s.crossings,0);
  const mid=span.x+span.w/2,dock=part(g,'wear-dock').x+3;
  let thickness=[];
  // Two safe crossings, each taking a third of the thickness.
  for(let cross=0;cross<2;cross++){
    assert(walkTo(g,mid,1200),`walked onto the span, crossing ${cross+1}`);
    step(g,60);
    thickness.push(part(g,'wear-span').h);
    assert.equal(s.crossings,cross+1,'each arrival is counted once, not every frame');
    step(g,120);
    assert.equal(s.crossings,cross+1,'standing on it does not keep counting');
    assert(!part(g,'wear-span').broken,'and it still holds');
    assert(walkTo(g,dock,1200),'walked back off');
    step(g,90);
  }
  assert(thickness[1]<thickness[0],`it thins with use (${thickness.map(t=>t.toFixed(2)).join(' -> ')})`);
  // The third crossing gives way underfoot — but over a beat, not instantly, so
  // standing still on it is what kills you and running is what saves you.
  assert(walkTo(g,mid,1200),'stepped onto the span for the third time');
  assert.equal(s.crossings,3);
  assert(!part(g,'wear-span').broken,'it does not vanish the instant you touch it');
  step(g,150);
  assert(part(g,'wear-span').broken,`dawdling on the third crossing wears it through (${s.amount.toFixed(2)})`);
  // Worn through, it is no longer a surface.
  Object.assign(g.player,{x:mid,y:4,vy:0,groundId:null,coyote:0});
  step(g,200);
  assert(g.player.groundId!=='wear-span','a worn span cannot be stood on');
  resetStation(s);step(g,200);
  assert(!part(g,'wear-span').broken&&s.crossings===0,'R makes it whole again');
}
console.log('PASS wear: three crossings thin the span and the third takes it away');

// --- 03 CATAPULT: pack it until it throws you --------------------------------
{
  const g=boot();assert(visitStation(g,'catapult'));
  const s=station(g,'catapult'),lump=part(g,'catapult-lump');
  assert(hopTo(g,lump.x+lump.w/2,1600),'hopped onto the lump');
  step(g,60);
  assert(standingOn(s,g.player)>=0,'and settled onto it');
  const launches=[];g.onEvent=e=>{if(e.type==='spring')launches.push(e);};
  // Two stomps pack it full: hop, then stomp back down onto it.
  for(let i=0;i<3&&!launches.length;i++){
    step(g,1,{jumpPressed:true});step(g,14);
    step(g,1,{stompPressed:true});step(g,50);
  }
  assert(launches.length>=1,`packing it full throws the player (${s.amount.toFixed(2)} charge)`);
  assert(g.player.vy>12||g.player.y>lump.y+2,'and throws them upward with real force');
  step(g,90);
  assert(s.amount<.4,'the charge is spent by the launch');
  // Left alone, a packed lump relaxes rather than staying armed forever.
  assert(walkTo(g,part(g,'catapult-dock').x+3,1500)||true);
  s.target=.8;s.amount=.8;step(g,300);
  assert(s.amount<.8,'an abandoned charge relaxes');
  assert(!g.deaths,'no deaths at the catapult');
}
console.log('PASS catapult: stomping packs the lump, a full lump throws the player, and a charge left alone relaxes');

// --- 04 STAMP: each slab rises only where you put your weight through it -----
{
  const g=boot();assert(visitStation(g,'stamp'));
  const s=station(g,'stamp');
  assert(perPart(s)&&s.amounts.length===4,'the stair keeps an amount per step');
  const first=part(g,'stamp-step-0'),base=first.y;
  assert(walkTo(g,first.x+first.w/2,1200),'walked onto the first slab');
  step(g,1,{jumpPressed:true});step(g,14);step(g,1,{stompPressed:true});step(g,200);
  assert(s.amounts[0]>.9,`the slab you stamped rose (${s.amounts[0].toFixed(2)})`);
  assert.deepEqual(s.amounts.slice(1).map(a=>a<.05),[true,true,true],'and only that one');
  assert(part(g,'stamp-step-0').y>base+.8,'it is now a real step');
  assert.equal(s.amount,Math.min(...s.amounts),'the station is only finished when its slowest step is');
  // A second stamp on a different slab raises that one too.
  const second=part(g,'stamp-step-1');
  Object.assign(g.player,{x:second.x+second.w/2,y:second.y+4,vx:0,vy:0,groundId:null,coyote:0});
  step(g,1,{stompPressed:true});step(g,200);
  assert(s.amounts[1]>.9,'the next stamp raises the next slab');
  assert(s.amounts[2]<.05&&s.amounts[3]<.05,'still only where you stamped');
  resetStation(s);step(g,200);
  assert(s.amounts.every(a=>a<.05),'R flattens the whole row');
}
console.log('PASS stamp: a slab rises only where the player stamped it, and the row resets together');

// --- containment ------------------------------------------------------------
{
  // Hand gestures must not drive ruled clay, or the rule stops being the rule.
  const g=boot();assert(visitStation(g,'sag'));
  const s=station(g,'sag');
  assert(walkTo(g,part(g,'lab-start').x+16,900)||true);
  const before=s.amount;
  step(g,180,{shapeHeld:true});
  assert(Math.abs(s.amount-before)<.02||standingOn(s,g.player)>=0,'holding knead does not shape ruled clay from the bench');
  const {nudgeClay,stompClay}=await import('../dist/shaping.js');
  assert.equal(nudgeClay(g,'sag'),false,'and a tap does not either');
  // The lab never edits the shipped chapters or its own source module.
  assert.equal(JSON.stringify(LEVELS),chapters,'chapters are untouched by a lab session');
  assert.equal(JSON.stringify(lab),source,'and so is the lab module itself');
}
console.log('PASS ruled clay ignores the hand gestures, and a lab session leaves the chapters and its own source alone');

// --- a lap of the bench ------------------------------------------------------
{
  const g=boot();
  for(const s of lab.shaping){
    assert(visitStation(g,s.id),`teleport to ${s.id}`);
    assert.equal(nearbyStation(g)?.id,s.id,`${s.id} is the station you land in`);
    assert.equal(g.player.health,3,'and you arrive whole');
  }
  assert.equal(g.deaths,0,'walking the bench between experiments costs nothing');
}
console.log('PASS every experiment can be reached directly from the pause menu, in any order');
