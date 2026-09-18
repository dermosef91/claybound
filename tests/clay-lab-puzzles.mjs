// The five benches after the lump: puzzles and platform stretches built on the
// formable mass, each asking one thing of it — dig into it, dig under it and
// pile the spoil, cast it to a mould, race it before it melts, and roll a
// marble down it. The pure pieces first (a pace of the clay's own, a mould and
// its match, a marble on a heightfield), then the bench as authored, then the
// real simulation solving every one of them from its dock, with the same
// promises every tick that the slab and the lump keep: x moves at walking
// speed or less, feet never end inside the clay, a rider stands exactly on it,
// the volume holds, and nobody dies.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt,RULES as PLAYER} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import lab from '../dist/routes/clay-lab.js';
import {visitStation,nearbyStation} from '../dist/shaping.js';
import {takesHands,shapedShare} from '../dist/clay-rules.js';
import {FORM,MOULD,PACE,createForm,formPace,formHeight,formVolume,formMatch,mouldProfile,mouldClump,mouldFit,pullForm,pressForm,stepForm,restProfile} from '../dist/clay-form.js';
import {MARBLE,createMarble,resetMarble,stepMarble,marbleHeight} from '../dist/clay-marble.js';
import {PUSH,initPush,resetPush,resolvePush,stepPush,lockShare} from '../dist/clay-push.js';
import {biteOutline,biteSeed,biteBounds,insideBite} from '../dist/rot-shape.js';

const source=JSON.stringify(lab),chapters=JSON.stringify(LEVELS);
const NEW=['dig','lintel','mould','wet','marble'];
const by=Object.fromEntries(lab.shaping.map(s=>[s.id,s])),plat=id=>lab.platforms.find(p=>p.id===id);
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
const frames=seconds=>Math.round(seconds/dt);
const JUMP=PLAYER.jump*PLAYER.jump/(2*PLAYER.gravity),LAUNCH=FORM.launch*FORM.launch/(2*PLAYER.gravity);
// A bead is taken within .8 of a point .65 over the feet, a flower within .9 of
// a point .8 over them: the highest point a jump from `y` collects.
const beadReach=y=>y+JUMP+.65+.8,flowerReach=y=>y+JUMP+.8+.9;

// --- the pieces on their own ------------------------------------------------------
{
  // A pace: the defaults are the clay's own, and only real numbers change them.
  assert.deepEqual({...formPace()},{...PACE});
  assert.deepEqual({...formPace({settle:'x',relaxTime:-1})},{...PACE});
  const wet=formPace({settle:.6,relaxTime:5,relaxMin:.4,holdUnderfoot:false});
  assert(wet.settle===.6&&wet.relaxTime===5&&wet.relaxMin===.4&&wet.holdUnderfoot===false);
  // Wet clay melts under a standing rider; the lab's clay is held by one.
  const build=pace=>{const f=createForm(18,4.5,[[0,-.8],[1,-.8]],{pace});for(let i=0;i<30;i++)pullForm(f,9,0,.3);for(let i=0;i<30;i++)stepForm(f,dt,{hand:true});return f;};
  const held=build(null),melting=build(wet),h0=formHeight(held,9);
  assert(close(formHeight(melting,9),h0),'the same pull raises the same pillar');
  for(let i=0;i<frames(3);i++){stepForm(held,dt,{standing:true});stepForm(melting,dt,{standing:true});}
  assert(close(formHeight(held,9),h0,.1),'clay at the lab\'s pace is held by someone standing on it');
  assert(formHeight(melting,9)<h0-1,`wet clay is not: it melts under the boots (${(h0-formHeight(melting,9)).toFixed(2)} in three seconds)`);
  for(let i=0;i<frames(3);i++)stepForm(melting,dt,{hand:true});
  const hold=formHeight(melting,9);
  for(let i=0;i<frames(1);i++)stepForm(melting,dt,{hand:true});
  assert.equal(formHeight(melting,9),hold,'but a hand on wet clay holds it');
  for(let i=0;i<frames(20);i++)stepForm(melting,dt);
  assert(melting.h.every((h,i)=>close(h,melting.rest[i],1e-6)),'and left alone it is home in seconds, not minutes');
  assert(close(formVolume(melting),melting.volume,1e-7),'keeping its volume all the while');

  // A mould: a legal target, a slab that holds exactly its volume, and a match
  // that reads one on the target and nothing on the slab.
  const f=createForm(14,4.5,[[0,0],[1,0]]),cast=mouldProfile(f,by.mould.mould);
  assert.equal(cast.length,f.n);
  for(let i=1;i<f.n;i++){
    assert(Math.abs(cast[i]-cast[i-1])/f.dx<=FORM.slope+.05,'no face of the mould is steeper than the clay allows');
    if(i<f.n-1)assert(Math.abs(cast[i-1]-2*cast[i]+cast[i+1])/(f.dx*f.dx)<=1/FORM.round*1.35,'no corner of the mould is sharper');
  }
  assert(cast.every(h=>h>=FORM.minThick-1e-9&&h<=FORM.maxHeight+1e-9),'and it sits between the floor and the ceiling');
  const slab=createForm(14,4.5,mouldClump(f,cast));
  assert(slab.rest.every(h=>close(h,slab.rest[0])),'the slab that holds the mould is flat');
  assert(close(slab.volume,cast.reduce((a,b)=>a+b,0)*f.dx,1e-6),'and holds exactly the mould\'s volume');
  assert(formMatch(slab,cast)<.15,`a flat slab is not a cast (${formMatch(slab,cast).toFixed(2)})`);
  slab.h.set(cast);
  assert.equal(formMatch(slab,cast),1,'the target itself is');
  assert.equal(formMatch(slab,new Float64Array(3)),0,'a target of the wrong size matches nothing');

  // A marble: rolls downhill, comes to rest in a hollow, sits still on gentle
  // ground, bounces off the ends, is home once it has sat in the socket.
  const run=createForm(20,4.5,by.marble.clump),m=createMarble(by.marble.marble.x);
  assert(close(m.x,2.4)&&m.r===MARBLE.radius&&!m.home);
  for(let i=0;i<frames(3);i++)stepMarble(m,run,dt,by.marble.marble.socket);
  assert(close(m.x,2.4,1e-9),'in its hollow it stays put');
  assert(close(marbleHeight(run,m),formHeight(run,2.4)+m.r),'sitting on the surface');
  // Tilt the ground under it and it rolls right, over the flat, and stops at
  // the ridge's foot: the ridge is too tall to roll over.
  for(let i=0;i<12;i++)pullForm(run,1.8,0,.3);
  let far=m.x,rested=false;for(let i=0;i<frames(15);i++){rested=stepMarble(m,run,dt);far=Math.max(far,m.x);if(rested&&i>frames(2))break;}
  assert(far>4&&m.x>3&&m.x<9.4,`rolled right out of its hollow and stopped short of the ridge (${m.x.toFixed(2)}, reached ${far.toFixed(2)})`);
  assert(rested,'and comes to rest');
  // Dropped over the socket it settles in and is home.
  m.x=17.4;m.vx=0;m.still=0;
  let t=0;for(;t<frames(8)&&!m.home;t++)stepMarble(m,run,dt,by.marble.marble.socket);
  assert(m.home&&m.x>17&&m.x<19,`seated in the socket in ${(t*dt).toFixed(1)}s at ${m.x.toFixed(2)}`);
  // A shove into the far end comes back.
  m.x=19.2;m.vx=6;let bounced=false;
  for(let i=0;i<30;i++){stepMarble(m,run,dt);assert(m.x<=20-m.r+1e-9,'never into the bench');if(m.vx<0)bounced=true;}
  assert(bounced,'the far bench is a wall it bounces off');
  resetMarble(m);
  assert(m.x===2.4&&m.vx===0&&!m.home,'reset puts it back in its hollow');
  assert.equal(stepMarble(m,run,0),true,'a zero step does nothing');
}
console.log('PASS wet clay melts under boots and not under a hand, a mould is a legal target its flat slab holds exactly, and a marble rolls, rests, bounces and seats');

// --- the plug's pieces: a lump fitted to a gap, and a block that is pushed ------
{
  // A clump fitted to the mould: legal, exactly the mould's volume, and read
  // as well short of a cast — the seated plug does not fit by itself.
  const m=plat('fix-mass'),f0=createForm(m.w,m.shape.from.h,[[0,0],[1,0]]),cast=mouldProfile(f0,by.fix.mould),f=mouldFit(f0,by.fix.clump,cast);
  assert.equal(f.n,cast.length);
  assert(close(formVolume(f),cast.reduce((a,b)=>a+b,0)*f.dx,1e-9)&&close(formVolume(f),f.volume,1e-9),'the lump holds exactly the mould\'s volume');
  for(let i=1;i<f.n;i++)assert(Math.abs(f.rest[i]-f.rest[i-1])/f.dx<=FORM.slope+.05,'no face of the lump is steeper than the clay allows');
  assert(f.rest.every(h=>h>=FORM.minThick-1e-9&&h<=FORM.maxHeight+1e-9),'between the floor and the ceiling');
  assert(formMatch(f,cast)<.7&&formMatch(f,cast)>.3,`seated, the lump reads well short of a cast (${formMatch(f,cast).toFixed(2)})`);
  const crest=Math.max(...f.rest);
  assert(crest<m.shape.from.h+JUMP-.2,`the block's crest (${(crest-m.shape.from.h).toFixed(2)} over the dock) is under a jump, so it can be got behind`);
  // Snapped to the cast, the volume still holds to the bit.
  f.h.set(cast);assert(close(formVolume(f),f.volume,1e-9),'the cast holds the same volume');
  // A mouldFit with no knots is the flat slab.
  const flat=mouldFit(f0,null,cast);assert(flat.rest.every(h=>close(h,cast[0],1e-6)),'no clump: the flat slab');

  // The block: pushed only by a grounded sweep into its face, a walk's third a
  // tick at most, stopped by a wall in its way; a lump's height, no deeper.
  const s={id:'b',x:10,w:3.2,y:1.5,h:1.5,kind:'stone',push:true,active:true};initPush(s);
  assert(s.pushPhase==='free'&&s.baseX===10&&s.baseY===1.5);
  const p={x:9.5,y:0};
  assert.equal(resolvePush(s,p,{prevX:9.5,radius:.32,height:1.7,dt}),0,'standing beside it moves nothing');
  p.x=9.9;const d=resolvePush(s,p,{prevX:9.5,radius:.32,height:1.7,dt});
  assert(d>0&&close(d,PUSH.speed*dt),'a sweep into its face carries it a walk\'s third');
  assert(close(s.x,10+d),'and the block went');
  assert.equal(resolvePush(s,{x:s.x-.32+.2,y:0},{prevX:s.x-.32-.1,radius:.32,height:1.7,dt,walls:[{x:s.x+s.w,w:.5,top:.9,bottom:0}]}),0,'a wall against its far face stops it');
  assert.equal(resolvePush(s,{x:s.x-.32+.2,y:3},{prevX:s.x-.32-.1,radius:.32,height:1.7,dt}),0,'a body above it is not pushing it');
  assert.equal(resolvePush(s,{x:s.x+s.w+.32-.2,y:0},{prevX:s.x+s.w+.32+.1,radius:.32,height:1.7,dt}),-PUSH.speed*dt,'pushed from the right it goes left');
  // Its life: onto a standing rot it reacts, goes and comes back; over the
  // open gap it drops in and seats.
  resetPush(s);const notch={x:20,w:3.2,floor:-1.5};
  assert.equal(stepPush(s,dt,{open:false,notch}),null);
  s.x=notch.x-s.w+PUSH.contact+.01;
  assert.equal(stepPush(s,dt,{open:false,notch}),'dissolve','reaching onto the rot starts the reaction');
  let t=null,n=0;while(t!=='shatter'&&n++<1000)t=stepPush(s,dt,{open:false,notch});
  assert(t==='shatter'&&close(n*dt,PUSH.dissolve,dt*2)&&s.active===false&&s.hidden,'it goes to pieces after the reaction, and is gone');
  n=0;while(t!=='respawn'&&n++<1000)t=stepPush(s,dt,{open:false,notch,clear:n>30});
  assert(t==='respawn'&&n*dt>=PUSH.gone-dt&&s.x===s.baseX&&s.y===s.baseY&&s.active&&!s.hidden&&s.pop===1&&s.pushPhase==='free','it comes back where it started, once the ground is clear');
  s.x=notch.x-s.w*(1-PUSH.lock)+.01;
  assert.equal(stepPush(s,dt,{open:true,notch}),'tip','far enough over the open gap it tips in');
  n=0;while(t!=='locked'&&n++<1000)t=stepPush(s,dt,{open:true,notch});
  assert(t==='locked'&&close(n*dt,PUSH.drop,dt*2)&&close(s.x,notch.x)&&close(s.y,notch.floor+s.h)&&s.active===false,'and seats on the gap\'s floor, stood down');
  assert.equal(stepPush(s,dt,{open:true,notch}),null,'seated, nothing more happens');
  resetPush(s);assert(s.x===s.baseX&&s.pushPhase==='free'&&s.active);
  assert(lockShare(s,notch)===0&&lockShare({...s,x:notch.x},notch)===1,'how far over the gap it is, as a share');
}
console.log('PASS the plug\'s pieces: a lump fitted to hold the gap\'s volume, well short of a cast and under a jump; a block a grounded walk pushes a third of a walk a tick, that walls stop, that dissolves on the rot and comes back, and that drops into the open gap and seats');

// --- the bench --------------------------------------------------------------------
{
  const ids=lab.shaping.map(s=>s.id);
  assert.deepEqual(ids.slice(-6,-1),NEW,'the five follow the lump');
  assert.equal(ids.at(-1),'fix','and the plug follows the five');
  assert(/eleven/i.test(lab.label),'the picker says how many experiments there are');
  let prev=by.lump;
  for(const id of NEW){
    const s=by[id],m=plat(s.parts[0]);
    assert.equal(s.rule,'form');assert(takesHands(s));
    assert.equal(s.x,prev.end,`${id}'s stretch begins where the one before ends`);
    assert(s.spawn.x>=s.x&&s.spawn.x<s.end,`${id} spawns inside its stretch`);
    assert.deepEqual(m.shape.from,m.shape.to,`${id}'s mass has no pose`);assert.equal(m.clayRole,'mass');
    for(const word of [/drag|lean|spread/i,/pull|draw/i,/volume/i,/slump|relax|melt/i,/\bR\b/])assert(word.test(s.hint),`${id}'s hint says ${word}`);
    assert(lab.sections.some(t=>t.x===s.x),`${id} has a section starting with it`);
    assert(lab.hints.some(h=>h.x===s.x&&h.title===s.name),`${id}'s sign is derived`);
    prev=s;
  }
  const bell=lab.platforms.find(p=>p.goal);
  assert(bell.x>=by.fix.end&&lab.end>bell.x&&lab.end<bell.x+bell.w,'the bell ends the lap after the plug');
  assert(!lab.hazards.some(h=>h.x>=by.dig.x&&h.x<by.fix.x),'no pit under any of the five');

  // 06 · Buried: five beads and a flower inside the clump, above the floor;
  // the perch out of a jump from the slab, within one from the ceiling.
  {
    const m=plat('dig-mass'),f=createForm(m.w,m.shape.from.h,by.dig.clump),base=m.y-m.shape.from.h;
    const beads=lab.coins.filter(c=>c.x>m.x&&c.x<m.x+m.w&&c.y<m.y),flower=lab.stamps.find(c=>c.x>m.x&&c.x<m.x+m.w&&c.y<m.y);
    assert.equal(beads.length,5,'five beads in the slab');
    for(const c of beads){
      const top=base+formHeight(f,c.x-m.x);
      assert(c.y<top-.6,`bead at ${c.x} is buried (${(top-c.y).toFixed(2)} under)`);
      assert(c.y>base+FORM.minThick+.4,'and above the floor, so it can be dug to');
    }
    // The flower is just under the surface: its centre buried, the tip of a
    // petal (the flower reaches .43 from its centre) breaking through, and
    // wanting at least the full sink of a stand, a hop or a stomp to take.
    const over=base+formHeight(f,flower.x-m.x);
    assert(flower.y<over-.25&&flower.y+.43>over,`the flower sits just under the slab, a petal showing (${(over-flower.y).toFixed(2)} under)`);
    assert(flower.y+.1<=over-FORM.sag+.05,'and standing on the slab does not simply hand it over: the boots must sink their full depth first');
    assert(flower.y>beads.reduce((hi,c)=>Math.max(hi,c.y),-Infinity),'the beads are the deep dig');
    const perch=plat('dig-perch'),slab=base+f.rest[0],cap=base+FORM.maxHeight;
    assert(perch.optional&&perch.x>m.x&&perch.x+perch.w<m.x+m.w,'a perch over the slab');
    assert(perch.y>slab+JUMP&&perch.y<cap+JUMP,`out of a jump from the slab (${(slab+JUMP).toFixed(2)}), in one from a mound at the ceiling (${(cap+JUMP).toFixed(2)})`);
    assert(lab.coins.filter(c=>c.x>=perch.x&&c.x<=perch.x+perch.w&&c.y>perch.y).length>=3,'with beads on it');
  }
  // 07 · Under & over: too little air under the lintel to walk, the flower
  // under it, the far bench exactly as high as the clay can be raised.
  {
    const m=plat('lintel-mass'),beam=plat('lintel-beam'),exit=plat('lintel-exit'),f=createForm(m.w,m.shape.from.h,by.lintel.clump);
    assert(f.rest.every(h=>close(h,m.shape.from.h)),'the mass lies flush with the dock');
    assert.equal(beam.kind,'wall');
    const air=beam.y-beam.h-m.y;
    assert(air>0&&air<PLAYER.height,`the lintel leaves ${air.toFixed(2)} of air, less than a player`);
    assert(air+FORM.slope*0>=.9,'but enough that a trench under a unit deep is walkable');
    assert(beam.x>m.x+3&&beam.x+beam.w<exit.x-4,'set well into the trough, with room to dig either side');
    const flower=lab.stamps.find(c=>c.x>beam.x&&c.x<beam.x+beam.w);
    assert(flower&&flower.y<beam.y-beam.h&&flower.y>m.y-.5,'the flower sits under the lintel');
    assert.equal(exit.x,m.x+m.w,'the far bench stands at the end of the trough');
    assert(close(exit.y,m.y-m.shape.from.h+FORM.maxHeight),'exactly as high as the clay can be raised');
    assert(exit.y>JUMP,'and out of a plain jump');
    assert(lab.coins.filter(c=>c.x>beam.x+beam.w&&c.x<exit.x).length>=4,'beads mark the way up beyond');
  }
  // 08 · Cast: a mould, a channel, and a vault only the grate lets into.
  {
    const s=by.mould,m=plat('mould-mass'),gate=plat('mould-gate'),roof=plat('mould-roof'),end=plat('mould-end'),floor=plat('mould-vault');
    assert(Array.isArray(s.mould)&&s.mould.length>=6&&!s.clump,'a mould, and the slab is derived from it');
    assert.equal(gate.kind,'gate');assert.equal(gate.channel,s.channel);
    assert.equal(gate.x,m.x+m.w,'the grate stands at the end of the trough');
    assert(close(gate.y-gate.h,floor.y)&&close(roof.y-roof.h,gate.y),'floor to grate to roof, no gap');
    assert(roof.kind==='wall'&&end.kind==='wall'&&close(end.y-end.h,floor.y)&&end.x+end.w<=roof.x+roof.w+1e-9&&end.x>gate.x+gate.w,'roofed and walled');
    const flower=lab.stamps.find(c=>c.x>gate.x+gate.w&&c.x<end.x);
    assert(flower&&flower.y>floor.y&&flower.y<roof.y-roof.h,'with the flower inside');
    assert(gate.h>=PLAYER.height&&roof.y-roof.h-floor.y>=PLAYER.height,'a door a player fits through, and room to stand inside');
    assert(roof.y-(m.y-m.shape.from.h+FORM.maxHeight)<JUMP,'the roof is the way on: a mound reaches it');
  }
  // 09 · Wet clay: a pace of its own; the far bench a wall; the perch out of
  // a jump from the ceiling but within a stomp from a pillar.
  {
    const s=by.wet,m=plat('wet-mass'),exit=plat('wet-exit'),perch=plat('wet-perch'),base=m.y-m.shape.from.h,cap=base+FORM.maxHeight;
    assert(s.pace&&s.pace.holdUnderfoot===false&&s.pace.relaxTime<=6&&s.pace.settle<1,'wet: melts in seconds, not held underfoot');
    assert.equal(exit.x,m.x+m.w);assert(exit.y>JUMP&&exit.y<JUMP+1.4,'the far bench wants a step, not a pillar');
    assert(perch.optional&&perch.x>m.x&&perch.x+perch.w<m.x+m.w);
    assert(perch.y>cap+JUMP&&perch.y>base+s.clump[0][1]+m.shape.from.h+LAUNCH,'the perch is out of a jump from the ceiling and a stomp from the slab');
    assert(perch.y<cap-1+LAUNCH,'but in a stomp from a pillar a unit under the ceiling');
    const flower=lab.stamps.find(c=>c.x>perch.x&&c.x<perch.x+perch.w);
    assert(flower&&flower.y>perch.y&&flower.y<perch.y+2.6,'holding a flower');
    assert(lab.coins.filter(c=>c.x>perch.x&&c.x<perch.x+perch.w&&c.y<perch.y).length>=4,'up a column of beads');
  }
  // 10 · The marble run: hollows either end, a ridge between, a lift that
  // rises on the marble's channel, and a flower only the risen lift reaches.
  {
    const s=by.marble,m=plat('marble-mass'),lift=plat('marble-lift'),f=createForm(m.w,m.shape.from.h,s.clump);
    const {x,socket}=s.marble,slope=u=>(formHeight(f,u+.3)-formHeight(f,u-.3))/.6;
    assert(Math.abs(slope(x))<.05&&formHeight(f,x)<formHeight(f,x-1)&&formHeight(f,x)<formHeight(f,x+1),'the marble starts at the bottom of a hollow');
    const mid=(socket[0]+socket[1])/2;
    assert(formHeight(f,mid)<formHeight(f,socket[0]-.5)&&formHeight(f,mid)<formHeight(f,socket[1]+.5),'the socket is a hollow');
    let ridge=0;for(let u=x;u<mid;u+=.25)ridge=Math.max(ridge,formHeight(f,u));
    assert(ridge>formHeight(f,x)+1.5&&ridge>formHeight(f,mid)+1.5,`a ridge between them (${(ridge-formHeight(f,x)).toFixed(2)} over the hollow)`);
    assert.equal(lift.kind,'lift');assert.equal(lift.channel,s.channel);assert(lift.moveY>2&&lift.period>=4,'a lift that runs on the marble\'s channel');
    assert(lift.x>m.x+m.w+5,'the lift stands well clear of the trough');
    const flower=lab.stamps.find(c=>c.x>lift.x&&c.x<lift.x+lift.w);
    assert(flower&&flower.y>flowerReach(lift.y)&&flower.y<flowerReach(lift.y+lift.moveY)-.4,'the flower is reached from the top of the lift\'s run and from nowhere else on the bench');
    assert(flower.y>flowerReach(0),'not from the bench');
  }
  // 11 · Fix the structure: a rotten corner filling a gap over a floor, a
  // block on the dock that is a lump under a jump, a stop at the dock's end, a
  // pit past the corner the mended corner alone crosses, and the flower beyond.
  {
    const s=by.fix,m=plat('fix-mass'),rot=plat(s.fix.rot),block=plat(s.fix.block),floor=plat(s.fix.floor),dock=plat('fix-dock'),corner=plat('fix-corner'),exit=plat('fix-exit'),stop=plat('fix-stop');
    assert.equal(s.rule,'form');assert(takesHands(s));assert.equal(s.x,by.marble.end);assert(s.relax===false,'the seated plug holds what it is shaped into');
    assert(Array.isArray(s.mould)&&Array.isArray(s.clump)&&Array.isArray(s.fix.blockClump)&&s.channel,'a mould, a clump the plug settles into, a clump the block wears, and a channel');
    assert(lab.sections.some(t=>t.x===s.x)&&lab.hints.some(h=>h.x===s.x&&h.title===s.name),'a section and a sign');
    for(const word of [/stomp/i,/push/i,/drag|shape/i,/\bE\b/,/dissolve/i,/\bR\b/])assert(word.test(s.hint),`fix's hint says ${word}`);
    // The rot fills the gap exactly: same footprint as the mass, top at the
    // bench, down to the gap's floor; permanent, and quick to go.
    assert.equal(rot.kind,'crumble');assert(rot.rot&&rot.delay<.2,'rotten: goes for good, almost at once');
    assert(rot.x===m.x&&rot.w===m.w&&rot.y===m.y&&close(rot.h,m.shape.from.h),'the rot fills the mass\'s gap');
    assert(floor.x===m.x&&floor.w===m.w&&close(floor.y,m.y-m.shape.from.h),'the gap has a floor');
    // The dock's last column is carved around the bite: a stone deck of its
    // own, flush with the dock and ending where the gap begins, wearing the
    // rot's bite, which is the gap and a ragged bulge eaten into that column.
    assert(corner.kind==='stone'&&corner.carve===rot.id&&corner.y===dock.y,'the corner column is stone, carved around the rot');
    assert(close(dock.x+dock.w,corner.x)&&close(corner.x+corner.w,m.x),'dock, corner, gap: no seam');
    const bite=biteOutline(rot.w,rot.h,biteSeed(rot)),bounds=biteBounds(bite);
    assert(close(bounds.right,rot.w)&&close(bounds.top,0)&&bounds.bottom>=-rot.h-.1&&bounds.left<-.3&&bounds.left>-corner.w+.8,`the bite is the gap plus a bulge into the corner (${bounds.left.toFixed(2)} of ${corner.w})`);
    for(const [u,v] of [[.5,-.5],[rot.w-.2,-rot.h+.2],[-.2,-rot.h*.5]])assert(insideBite(bite,u,v),`(${u},${v}) is in the bite`);
    for(const [u,v] of [[.5,.3],[rot.w+.2,-.5],[-corner.w,-1],[.5,-rot.h-.4]])assert(!insideBite(bite,u,v),`(${u},${v}) is not`);
    assert(!bite.some(([x,y])=>x<0&&y>-.05),'the bulge stays below the walking surface');
    // The block: a pushed stone on the dock, left of the gap, with room to
    // stand behind it and a stop at the dock's end it cannot pass.
    assert(block.kind==='stone'&&block.push&&block.w===m.w&&close(block.h,m.shape.from.h),'the block is the gap\'s size');
    assert(m.shape.from.h>PLAYER.height+.4&&m.shape.from.h<JUMP-.2,`the gap (${m.shape.from.h}) is deeper than the player and shallow enough to jump out of`);
    assert(block.x>dock.x+2&&block.x+block.w<m.x-1,'on the dock, left of the gap, with the dock behind it');
    assert(close(block.y-block.h,dock.y),'standing on the dock');
    assert(stop.kind==='wall'&&stop.x===dock.x&&stop.y<=1.2,'a low stop at the dock\'s end');
    assert(s.spawn.x>stop.x+stop.w&&s.spawn.x<block.x,'the spawn stands between the stop and the block');
    // The pit: the corner alone crosses it. From the gap's floor a jump falls
    // short; from the mended corner a running one makes it.
    const pit=lab.hazards.find(h=>h.x>=m.x+m.w-1e-9);
    assert(pit&&close(pit.x,m.x+m.w)&&close(pit.x+pit.w,exit.x),'a pit from the corner to the far bench');
    assert(pit.w>4.9+.64+.3&&pit.w<5.92+.64-.2,`the pit (${pit.w}) is out of a jump from the gap's floor and in a running one from the corner`);
    const flower=lab.stamps.find(c=>c.x>exit.x&&c.x<exit.x+exit.w);
    assert(flower&&flower.y<flowerReach(exit.y),'the flower waits on the far bench');
    assert(lab.coins.filter(c=>c.x>pit.x&&c.x<pit.x+pit.w).length>=3,'beads trace the jump');
  }
}
console.log('PASS the benches are wired: buried treasure, a lintel with the far bench at the ceiling, a mould with a sealed vault, wet clay with a perch for a pillar and a throw, a marble run with a lift, and a rotten corner with a block to plug it');

// --- a rig around one station ----------------------------------------------------
function rig(id){
  const g=new Game();g.start(3,lab);assert(visitStation(g,id));
  const st=g.level.shaping.find(s=>s.id===id),s=g.level.platforms.find(q=>q.id===st.parts[0]),p=g.player,base=s.y-s.h;
  assert.equal(nearbyStation(g)?.id,id);
  let last=p.x,ticks=0;
  const tick=(input={})=>{
    g.tick(dt,input);ticks++;
    assert(Math.abs(p.x-last)<=6.7*dt+1e-3,`${id}: x moves continuously (tick ${ticks}: ${last.toFixed(3)} -> ${p.x.toFixed(3)})`);last=p.x;
    // A plug's mass is no clay at all until it is seated: nothing to be inside.
    if(s.active!==false&&p.x>s.x&&p.x<s.x+s.w&&p.y<base+FORM.maxHeight){
      assert(p.y>=surfaceAt(s,p.x)-.12-1e-9,`${id}: feet never end a tick inside the clay (tick ${ticks}: ${p.y.toFixed(3)} under ${surfaceAt(s,p.x).toFixed(3)})`);
      if(p.groundId===s.id)assert(Math.abs(p.y-surfaceAt(s,p.x))<1e-9,`${id}: a rider stands exactly on the surface (tick ${ticks})`);
    }
    assert(close(formVolume(s.form),s.form.volume,1e-7),`${id}: volume holds (tick ${ticks})`);
    assert.equal(g.deaths,0,`${id}: nobody dies`);
  };
  const hold=(n,input={})=>{for(let i=0;i<n;i++)tick({...input,jumpPressed:i===0&&!!input.jumpPressed,stompPressed:i===0&&!!input.stompPressed});};
  const walk=(x,n=2000,extra={})=>{for(let i=0;i<n;i++){const d=x-p.x;if(Math.abs(d)<.08)return true;tick({moveAxis:Math.max(-1,Math.min(1,d*3)),...extra});}return false;};
  const hopTo=(x,seconds=8)=>{let stuck=0,lastX=p.x;for(let i=0;i<frames(seconds);i++){const d=x-p.x;if(Math.abs(d)<.3)return true;stuck=Math.abs(p.x-lastX)<.004?stuck+1:0;lastX=p.x;const go=stuck>6&&!!p.groundId;if(go)stuck=0;tick({moveAxis:Math.max(-1,Math.min(1,d*2)),jumpPressed:go,jumpHeld:true});}return false;};
  const jump=(input={})=>{let top=-Infinity;hold(1,{...input,jumpPressed:true,jumpHeld:true});for(let i=0;i<400;i++){tick({...input,jumpHeld:true});top=Math.max(top,p.y);if(p.groundId&&p.vy===0)break;}return top;};
  const stomp=(input={})=>{hold(1,{...input,jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&p.vy>0;i++)tick({...input,jumpHeld:true});hold(1,{...input,stompPressed:true});for(let i=0;i<150&&!p.groundId;i++)tick(input);let apex=p.y;for(let i=0;i<600;i++){tick(input);apex=Math.max(apex,p.y);if(i>2&&p.groundId&&Math.abs(p.vy)<1e-9)break;}return apex;};
  const place=(x,y)=>{Object.assign(p,{x,y,vx:0,vy:0,groundId:null,coyote:0,stomping:false});last=x;};
  const hand=(lx,ly,extra={})=>tick({shapeId:id,shapeX:s.x+lx,shapeY:base+ly,...extra});
  const top=lx=>surfaceAt(s,s.x+lx),local=lx=>formHeight(s.form,lx);
  // A pointer stroke pressing in from the air over local x down to local
  // height `to`; and one taking hold of the surface at local x and dragging it
  // by (dx, dy). Each begins with the pointer up, so it is its own touch.
  const dig=(lx,to,speed=.25)=>{tick();let ly=local(lx)+FORM.grab+.4;hand(lx,ly);while(ly>to){ly=Math.max(to,ly-speed);hand(lx,ly);}tick();};
  const drag=(lx,dy,dx=0,speed=.25)=>{tick();let ly=local(lx),x=lx;hand(x,ly);const n=Math.max(1,Math.ceil(Math.max(Math.abs(dy),Math.abs(dx))/speed));for(let i=0;i<n;i++){ly+=dy/n;x+=dx/n;hand(x,ly);}tick();};
  const taken=()=>({beads:g.level.coins.filter(c=>c.taken).length,flowers:g.level.stamps.filter(c=>c.taken).length});
  return {g,st,s,p,base,tick,hold,walk,hopTo,jump,stomp,place,hand,top,local,dig,drag,taken,ticks:()=>ticks};
}

// --- 06 · buried: dig to the flower, and the spoil is the step to the perch ----------
{
  const {g,st,s,p,hold,walk,jump,place,drag,dig,top,taken}=rig('dig');
  const events=[];g.onEvent=e=>{if(e.type==='knead'||e.type==='shape')events.push(e.type);};
  assert.deepEqual(taken(),{beads:0,flowers:0});
  walk(s.x+8);hold(20);
  const slab=top(8);
  assert(p.groundId===s.id&&slab<s.y-.4&&slab>s.y-.8,`standing on the slab, half a step below the bench (${slab.toFixed(2)})`);
  // Press in from the air under your own boots, all the way down.
  dig(8,FORM.minThick+.3,.2);hold(30);
  assert(top(8)<s.y-4,`a hole most of the way to the floor (${top(8).toFixed(2)})`);
  assert(p.groundId===s.id&&p.y<s.y-4,'the digger has gone down with it');
  assert.deepEqual(taken(),{beads:1,flowers:1},'the middle bead and the flower are dug out');
  assert(events.includes('knead'),'digging is heard');
  // The spoil has risen around the hole.
  assert([3,4,12,13].some(lx=>top(lx)>slab+.4),'the spoil piles up beside the hole');
  // Beads either side want their own holes, with the digger standing in each:
  // a bead is only taken by a player beside it.
  for(const lx of [3,5.5,10.5,13]){place(s.x+lx,top(lx)+.05);hold(5);dig(lx,s.h+lab.coins.find(c=>c.x===s.x+lx).y-s.y-.1,.2);hold(frames(.6));}
  hold(20);
  assert.equal(taken().beads,5,'all five beads dug out');
  // Gather the spoil under the perch and it is a mound at the ceiling.
  const perch=g.level.platforms.find(q=>q.id==='dig-perch'),under=perch.x+perch.w/2-s.x;
  place(s.x+under,top(under)+.05);hold(5);
  for(let i=0;i<40&&top(under)<s.y-s.h+FORM.maxHeight-.05;i++)drag(under,.6);
  hold(30);
  assert(close(top(under),s.y-s.h+FORM.maxHeight,.1),`a mound at the ceiling under the perch (${top(under).toFixed(2)})`);
  assert(p.groundId===s.id&&close(p.y,top(under),.05),'ridden up on it');
  jump();
  assert.equal(p.groundId,'dig-perch','a hop from the mound reaches the perch');
  hold(frames(.5),{moveAxis:1});hold(frames(1),{moveAxis:-1});
  assert(taken().beads>=7,'and its beads');
  assert(shapedShare(st)>.9&&events.includes('shape'),'a dig this size reads as shaped');
  assert.equal(g.deaths,0);
}
console.log('PASS buried: a press from the air digs to the flower and the beads, the spoil rises beside the hole, and gathered under the perch it is the mound that reaches it');

// --- 07 · under & over: a trench through, then the spoil up the wall --------------------
{
  const {g,st,s,p,tick,hold,walk,hopTo,jump,dig,drag,hand,top,local,taken}=rig('lintel');
  const beam=g.level.platforms.find(q=>q.id==='lintel-beam'),exit=g.level.platforms.find(q=>q.id==='lintel-exit');
  // The mass is met at a walk, and the lintel stops the walker.
  walk(s.x+5.2,600);hold(frames(1),{moveAxis:1});
  assert(p.groundId===s.id&&p.x<beam.x&&p.x>beam.x-PLAYER.radius-.05,`walked up to the lintel and no further (${p.x.toFixed(2)})`);
  const y0=p.y;jump({moveAxis:1});
  assert(p.x<beam.x&&p.y<y0+.5,'a jump into it is a jump into a wall');
  assert.deepEqual(taken(),{beads:0,flowers:0});
  // A trench: pressed along under the lintel, both ways, since the spoil of
  // each press falls nearest first — back into the trench.
  const trenchTop=s.h+(beam.y-beam.h-s.y)-PLAYER.height-.15;
  for(let pass=0;pass<4;pass++){const xs=[];for(let lx=beam.x-s.x-.8;lx<=beam.x+beam.w-s.x+.8;lx+=.4)xs.push(lx);if(pass%2)xs.reverse();for(const lx of xs)dig(lx,trenchTop,.3);}
  hold(20);
  for(let lx=beam.x-s.x-.4;lx<=beam.x+beam.w-s.x+.4;lx+=.5)assert(top(lx)<beam.y-beam.h-PLAYER.height,`the trench is deep enough to duck through at ${lx.toFixed(1)} (${top(lx).toFixed(2)})`);
  assert(walk(beam.x+beam.w/2,frames(4)),'and the walker goes in under the lintel');
  assert(p.groundId===s.id&&p.y+PLAYER.height<beam.y-beam.h,'standing under it');
  assert.equal(taken().flowers,1,'where the flower is');
  // Beyond, the spoil is a rim a jump cannot clear from the trench floor:
  // lean it over into a ramp and hop out.
  let crest=12;for(const lx of [12,12.5,13,13.5,14,14.5])if(top(lx)>top(crest))crest=lx;
  assert(top(crest)>s.y+.8,`the spoil stands beyond the lintel (${top(crest).toFixed(2)} at ${crest})`);
  drag(crest,-.2,3);
  assert(hopTo(s.x+16.4),'out of the trench and up the spoil');
  assert(p.x>s.x+15.5&&p.groundId===s.id,`on the clay before the wall (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  // The wall: the bench stands at the ceiling. At the clay's end there is
  // nothing ahead for E to step onto, so held there it lifts the ground under
  // the player instead, a step at a time; ride it up and hop onto the bench.
  walk(s.x+17.2,300);hold(frames(.1),{moveAxis:1});hold(3);assert.equal(p.facing,1,'facing the wall');
  const y1=p.y;
  for(let i=0;i<frames(6)&&p.y<s.y+2;i++)tick({shapeHeld:true});
  assert(p.y>=s.y+2&&p.groundId===s.id,`E at the wall lifts the player with the clay (${y1.toFixed(2)} -> ${p.y.toFixed(2)})`);
  const from=p.y;jump({moveAxis:1});
  assert.equal(p.groundId,'lintel-exit',`a hop from ${from.toFixed(2)} lands on the far bench`);
  assert(taken().beads>=2,'past the beads on the way up');
  assert(shapedShare(st)>.5,'a trench and a ramp read as work');
  assert.equal(g.deaths,0);
  assert(!g.level.platforms.some(q=>q.id==='lintel-exit'&&q.y!==4),'the bench never moved: only the clay did');
}
console.log('PASS under & over: the lintel stops a walk and a jump, a trench pressed under it lets the player duck through to the flower, and the spoil leaned into a ramp and raised with E climbs the far bench');

// --- 08 · cast: shape the slab to the mould, and the grate lifts -----------------------
{
  const {g,st,s,p,tick,hold,walk,jump,place,drag,top,taken}=rig('mould');
  const f=s.form,cast=st.cast,gate=g.level.platforms.find(q=>q.id==='mould-gate');
  const gap=()=>{let e=0;for(let i=0;i<f.n;i++)e+=Math.abs(f.h[i]-cast[i]);return e/f.n;};
  const events=[];g.onEvent=e=>{if(['shape','activate'].includes(e.type))events.push(e);};
  assert(formMatch(f,cast)<.15&&shapedShare(st)<.15,'the slab starts uncast');
  assert(gate.active&&!g.latched['mould-cast'],'and the grate is shut');
  assert(s.mould===cast&&s.mouldMatch===undefined||s.mouldMatch<.15,'the view is handed the mould and the match');
  // A hand cannot walk through the grate.
  walk(s.x+s.w-.5,frames(6));hold(frames(.5),{moveAxis:1});
  assert(p.x<gate.x-PLAYER.radius+.02,'the grate is a wall');
  // Fit it by strokes: at every third column, take hold and drag towards the
  // line, a few passes over.
  let pass=0;
  for(;pass<12&&gap()>MOULD.good*.9;pass++){
    for(let i=2;i<f.n-2;i+=3){const d=cast[i]-f.h[i];if(Math.abs(d)<.05)continue;drag(i*f.dx,Math.sign(d)*Math.min(Math.abs(d),.6));}
  }
  hold(5);
  assert(gap()<=MOULD.good,`cast within tolerance after ${pass} passes (mean gap ${gap().toFixed(3)})`);
  assert(st.done&&shapedShare(st)===1&&s.mouldMatch>=MOULD.cast,'the station reads as cast');
  assert(events.some(e=>e.type==='shape')&&events.some(e=>e.type==='activate'&&e.channel==='mould-cast'),'announced, and the channel opened');
  hold(frames(1.5));
  assert(gate.open>.95&&!gate.active&&g.latched['mould-cast'],'the grate lifts');
  // Walk in and take the flower.
  place(s.x+12,top(12)+.05);hold(5);
  if(!walk(259,frames(4))){jump({moveAxis:1});walk(259,frames(4));}
  assert(p.groundId==='mould-vault'&&Math.abs(p.x-259)<.5,`in the vault (${p.x.toFixed(2)}, ${p.groundId})`);
  assert.equal(taken().flowers,1,'the flower is taken');
  // Left alone — nobody on it — the cast slumps; the grate stays open. R
  // shuts it and flattens the slab.
  place(s.x-2,0);hold(5);assert.equal(p.groundId,'mould-dock');
  for(let i=0;i<frames(FORM.settle+8);i++)tick();
  assert(formMatch(f,cast)<MOULD.cast&&st.done&&!gate.active,'the cast has begun to slump and the grate is still open');
  tick({shapeReset:true});hold(frames(1.5));
  assert(!st.done&&shapedShare(st)<.15&&gate.active&&!g.latched['mould-cast'],'R resets the cast and shuts the grate');
  assert.equal(g.deaths,0);
}
console.log('PASS cast: strokes bring the slab to the mould within tolerance, the cast is announced and lifts the grate, the flower is behind it, the grate stays open while the cast slumps, and R shuts it');

// --- 09 · wet clay: a step before it melts, a pillar and a throw before it sinks -------
{
  const {g,st,s,p,tick,hold,walk,jump,stomp,place,hand,top,local,taken}=rig('wet');
  assert(s.form.pace.holdUnderfoot===false&&s.form.pace.relaxTime===5,'the mass carries the station\'s pace');
  // The far bench: E at the clay's end lifts the ground under the player a
  // step at a time; ride it up and hop across before it melts.
  walk(s.x+s.w-.6,frames(8));hold(frames(.1),{moveAxis:1});hold(3);
  const t0=g.time;
  for(let i=0;i<frames(6)&&p.y<s.y+1;i++)tick({shapeHeld:true});
  assert(p.y>=s.y+1&&p.groundId===s.id,`E lifts the player at the wall (${p.y.toFixed(2)})`);
  assert(g.time-t0<4,`in ${(g.time-t0).toFixed(2)}s`);
  jump({moveAxis:1});
  assert.equal(p.groundId,'wet-exit','a hop from the raised ground lands on the far bench');
  // Dawdle and the step is gone.
  const stepTop=top(s.w-.6);hold(frames(4));
  assert(top(s.w-.6)<stepTop-.5,`left alone the step melts (${stepTop.toFixed(2)} -> ${top(s.w-.6).toFixed(2)})`);
  // The perch: pull a pillar up under your own feet and ride it, let go, stomp.
  const under=286.5-s.x;
  place(s.x+under,top(under)+.05);hold(10);
  let ly=local(under)+.1;
  for(let i=0;i<frames(3)&&p.y<s.y+3.1;i++){ly+=.25;hand(under,ly);}
  assert(p.groundId===s.id&&p.y>=s.y+3,`ridden up on the pillar (${p.y.toFixed(2)})`);
  tick();
  const apex=stomp();
  assert(apex>8.8&&p.groundId==='wet-perch',`the throw from the pillar top reaches the perch (apex ${apex.toFixed(2)}, on ${p.groundId})`);
  assert.deepEqual(taken(),{beads:4,flowers:1},'up the column of beads to the flower');
  // Standing on wet clay does not hold it: a pillar sinks under its rider.
  // (A pillar raised in one tick is eased over the ticks after, hand on, before
  // anything is measured, so what is measured is the melt and not the easing.)
  place(s.x+4,top(4)+.05);
  for(let i=0;i<20;i++)pullForm(s.form,4,0,.3);
  let hy=local(4);for(let i=0;i<40;i++)hand(4,hy);
  hold(5);const h0=top(4);hold(frames(3));
  assert(top(4)<h0-1&&p.groundId===s.id&&close(p.y,top(4),1e-9),`a rider sinks with the melting pillar (${h0.toFixed(2)} -> ${top(4).toFixed(2)})`);
  // A hand holds it.
  for(let i=0;i<20;i++)pullForm(s.form,4,0,.3);
  hy=local(4);for(let i=0;i<40;i++)hand(4,hy);
  const h1=top(4);
  for(let i=0;i<frames(2);i++)hand(4,hy);
  assert(close(top(4),h1,.1),`a hand resting on it holds it (${h1.toFixed(2)} -> ${top(4).toFixed(2)})`);
  assert.equal(g.deaths,0);
}
console.log('PASS wet clay: E builds the step to the far bench in time and it melts when left, a pillar pulled up underfoot and a stomp from its top reach the perch, and only a hand holds the clay');

// --- 10 · the marble run: herd the marble home, and the lift rises --------------------
{
  const {g,st,s,p,tick,hold,walk,jump,stomp,place,drag,top,taken}=rig('marble');
  const m=st.ball,socket=st.marble.socket,lift=g.level.platforms.find(q=>q.id==='marble-lift');
  const events=[];g.onEvent=e=>{if(['shape','activate'].includes(e.type))events.push(e);};
  assert(s.marble===m&&close(m.x,2.4)&&!m.home,'the view is handed the marble, in its hollow');
  assert.deepEqual(s.socket,socket,'and the socket, so the goal can be marked');
  // Nothing moves it but the ground. A player walking through does nothing.
  walk(s.x+6,frames(3));walk(s.x+1,frames(3));hold(20);
  assert(close(m.x,2.4,1e-6),'the player walks through the marble and leaves it be');
  assert(shapedShare(st)<.05,'and nothing has happened yet');
  // Herd it: raise the ground a little behind it whenever it stops, and never
  // once it is in the socket. The first time it stops out on the flat, a stomp
  // just ahead of it instead: the marble rolls into the crater.
  let lifts=0,stomped=false;const t0=g.time;
  for(let i=0;i<frames(60)&&!m.home;i++){
    if(m.x>=socket[0]&&m.x<=socket[1]){tick();continue;}
    if(Math.abs(m.vx)<.4){
      if(!stomped&&m.x>4&&m.x<9&&Math.abs(top(m.x+.3)-top(m.x-.3))<.03){
        stomped=true;const was=m.x;
        place(s.x+m.x+1,top(m.x+1)+.02);hold(10);
        stomp();hold(frames(2));
        assert(m.x>was+.3,`a stomp just ahead of the marble draws it on into the crater (${was.toFixed(2)} -> ${m.x.toFixed(2)})`);
        continue;
      }
      drag(Math.max(.3,m.x-.5),.7);lifts++;
    } else tick();
  }
  assert(stomped,'the marble stopped on the flat at least once on the way');
  assert(m.home&&st.done,`the marble is home after ${(g.time-t0).toFixed(1)}s and ${lifts} lifts (${m.x.toFixed(2)})`);
  assert(m.x>=socket[0]&&m.x<=socket[1]);
  assert(shapedShare(st)===1&&events.some(e=>e.type==='shape')&&events.some(e=>e.type==='activate'&&e.channel==='marble-home'),'announced, and the channel opened');
  // The lift runs while the marble sits: up to the top of its travel, back to
  // its base, and up again, never stopping.
  assert(close(lift.y,lift.baseY,.05),'the lift waited at its base until now');
  let peak=lift.y,bottomAgain=false,upAgain=false;
  for(let i=0;i<frames(lift.period*2.1);i++){tick();peak=Math.max(peak,lift.y);if(peak>lift.baseY+lift.moveY-.05&&lift.y<lift.baseY+.05)bottomAgain=true;if(bottomAgain&&lift.y>lift.baseY+1)upAgain=true;}
  assert(peak>lift.baseY+lift.moveY-.05,`the lift reaches the top of its run (${peak.toFixed(2)})`);
  assert(bottomAgain&&upAgain,'and comes back down and goes up again');
  // From the top of its run a hop takes the flower.
  for(let i=0;i<frames(lift.period)&&lift.y<lift.baseY+lift.moveY-.1;i++)tick();
  place(lift.x+lift.w/2,lift.y+.02);hold(3);
  assert.equal(p.groundId,'marble-lift');
  jump();
  assert.equal(taken().flowers,1,'the flower over the lift is taken from it');
  // R puts the marble back and the lift eases down and waits.
  place(s.x-2,0);hold(3);assert.equal(p.groundId,'marble-dock');
  tick({shapeReset:true});hold(frames(3));
  assert(close(m.x,2.4)&&!m.home&&!st.done&&!g.latched['marble-home'],'R resets the run');
  assert(close(lift.y,lift.baseY,.05),`and the lift is back at its base (${lift.y.toFixed(2)})`);
  hold(frames(2));assert(close(lift.y,lift.baseY,.05),'where it stays');
  assert.equal(g.deaths,0);
}
console.log('PASS the marble run: the marble ignores the player and answers only the ground, a stomp just ahead of it draws it into the crater, lifting the ground behind it herds it home, the lift rises to the flower, and R resets it all');

// --- 11 · fix the structure: rot, stomp, push, seat, cast, mend ---------------------
{
  const {g,st,s,p,tick,hold,walk,place,drag,taken}=rig('fix');
  const P=id=>g.level.platforms.find(q=>q.id===id),rot=P(st.fix.rot),block=P(st.fix.block),floor=P(st.fix.floor),exit=P('fix-exit');
  const events=[];g.onEvent=e=>{if(!['step','land','knead','section','checkpoint','jump','stomp','skid','coin'].includes(e.type))events.push(e);};
  const heard=type=>events.some(e=>e.type===type),flush=()=>{events.length=0;};
  // At rest: the rot stands, the block is on the dock as a lump the player can
  // hop onto, the mass is nowhere, and nothing reads as shaped.
  assert(st.fix.phase==='rot'&&s.active===false&&s.outline&&!s.mouldMatch,'the plug\'s mass is dormant, its outline authored');
  assert(rot.active&&!rot.broken&&block.active&&block.pushPhase==='free'&&block.form,'the rot stands, the block is free and wears the lump');
  assert.equal(shapedShare(st),0);
  assert(!takesHands(st)===false&&st.fix.phase!=='shaping','it takes hands in general, but not yet');
  hold(3);walk(block.x-.8,frames(2));hold(3);
  const before=block.x;hold(1,{jumpPressed:true,jumpHeld:true,moveAxis:1});
  for(let i=0;i<frames(1.2);i++){tick({moveAxis:p.x<block.x+block.w/2?1:.2,jumpHeld:true});if(p.groundId===block.id)break;}
  assert.equal(p.groundId,block.id,'a hop lands on the block');
  assert(close(p.y,surfaceAt(block,p.x))&&p.y>block.y-block.h+2,'standing on the lump\'s own surface, well over the dock');
  assert(close(block.x,before,.05),'landing on it does not move it');
  walk(block.x+block.w+1.2,frames(3));hold(frames(.5));assert.equal(p.groundId,'fix-dock','and walks off it onto the dock beyond');

  // The rot: a stand brings it down almost at once, for good, and the player
  // drops onto the gap's floor; the corner is no take-off — a stand on it has
  // no jump — and from the gap's floor the far bench is out of reach.
  walk(rot.x+1.2,frames(4));let fell=0;for(let i=0;i<frames(1);i++){tick();if(!rot.active&&!fell)fell=i;}
  assert(rot.broken&&!rot.active&&fell*dt<rot.delay+.2,`the rot gives within ${(fell*dt).toFixed(2)}s of a stand`);
  assert(heard('crumble')&&heard('crumble-collapse'),'heard going');flush();
  assert.equal(p.groundId,floor.id,'the player is down on the gap\'s floor');
  assert(st.fix.phase==='open'&&close(shapedShare(st),.2),'the gap is open, a fifth of the work');
  for(let i=0;i<frames(4.5);i++)tick();
  assert(rot.broken&&!rot.active,'the rot does not grow back');
  g.respawn();place(p.x,p.y);hold(3);assert(rot.broken&&!rot.active,'nor with the player');
  // From the gap's floor, a running jump at the far bench falls into the pit.
  {const g2=new Game();g2.start(3,lab);visitStation(g2,'fix');const q=g2.player;Object.assign(q,{x:floor.x+.3,y:floor.y,vx:0,vy:0,groundId:floor.id,coyote:.135});
    for(let i=0;i<frames(3);i++){const go=q.x>=floor.x+floor.w-.05&&q.groundId;g2.tick(dt,{moveAxis:1,jumpPressed:go,jumpHeld:true});if(go)break;}
    let landed=null;for(let i=0;i<frames(2.5);i++){g2.tick(dt,{moveAxis:1,jumpHeld:true});if(q.groundId){landed=q.groundId;break;}if(g2.deaths)break;}
    assert(landed!==exit.id,`a running jump from the gap's floor never reaches the far bench (${landed??'fell'})`);}
  // Nor is the rot itself a take-off: a jump pressed while standing on it does
  // not lift, since the corner gives no coyote.
  tick({shapeReset:true});hold(frames(.5));
  assert(!rot.broken&&rot.active&&st.fix.phase==='rot'&&shapedShare(st)===0,'R stands the rot back up');
  place(rot.x-1.5,0);hold(5);
  for(let i=0;i<frames(1);i++){const on=p.groundId===rot.id;tick({moveAxis:on?0:1,jumpPressed:on,jumpHeld:on});if(on)break;}
  assert(p.vy<=0||rot.broken,'a jump pressed on the rot does not lift');
  hold(frames(1));assert(rot.broken&&p.groundId===floor.id,'it goes, and the player is down in the gap');flush();

  // A stomp brings it down at once and throws the stomper back up a little.
  tick({shapeReset:true});hold(frames(.5));place(rot.x-1.2,0);hold(5);
  hold(1,{jumpPressed:true,jumpHeld:true,moveAxis:1});for(let i=0;i<frames(.35);i++)tick({moveAxis:1,jumpHeld:true});
  hold(1,{stompPressed:true,moveAxis:.2});
  let bounced=false,broke=-1;for(let i=0;i<frames(2);i++){tick({moveAxis:-.6});if(rot.broken&&broke<0)broke=i;if(rot.broken&&p.vy>0)bounced=true;if(p.groundId&&i>20)break;}
  assert(rot.broken&&broke>=0&&bounced,'the stomp brings the rot down at once and the stomper bounces');
  assert(events.some(e=>e.type==='crumble-collapse'&&e.stomped&&e.rot),'heard as a stomped collapse');flush();
  assert.equal(g.deaths,0);

  // The push: a grounded walk into the block carries it at a walk's third, the
  // walker flush behind it. Over the open gap it drops in and seats, and the
  // mass stands in its place as the very lump, live to the hand.
  place(block.x-1,0);hold(5);
  let x0=block.x,maxStep=0,last=block.x;
  assert(!p.pushing,'not pushing yet');
  for(let i=0;i<frames(6)&&block.pushPhase==='free';i++){tick({moveAxis:1});maxStep=Math.max(maxStep,block.x-last);last=block.x;if(block.x>x0+.5&&block.pushPhase==='free'){assert(close(p.x,block.x-PLAYER.radius,.05),'the pusher stays flush behind the block');assert.equal(p.pushing,1,'and reads as pushing, to the right');}}
  assert(block.x>x0+3&&maxStep<=PUSH.speed*dt+1e-9,`pushed ${(block.x-x0).toFixed(2)} at no more than ${PUSH.speed} a second`);
  assert(heard('push-lock'),'and it tips into the gap');flush();
  hold(frames(PUSH.drop+.1));
  assert(block.pushPhase==='locked'&&block.active===false&&block.hidden&&close(block.x,s.x)&&close(block.y,s.y),'seated, and stood down');
  assert(!p.pushing,'nothing left to push against');
  assert(s.active&&!s.hidden&&st.fix.phase==='settling'&&heard('push-locked'),'the mass is live in its place, settling');flush();
  // Seated as the very lump the block was, it settles into its own bulge: on
  // the way every column lies between the two shapes, the volume holds, and
  // no hand is taken; arrived, it is the clump exactly.
  const between=(h,a,b)=>h>=Math.min(a,b)-1e-9&&h<=Math.max(a,b)+1e-9;
  assert(s.form.h.every((h,i)=>between(h,block.form.rest[i],s.form.rest[i])),'settling from the block\'s shape towards the bulge');
  assert(!s.form.h.every((h,i)=>close(h,s.form.rest[i],1e-6)),'not there yet');
  assert(close(formVolume(s.form),s.form.volume,1e-9),'the volume holds while it settles');
  drag(s.w/2,.5);
  assert(s.form.h.every((h,i)=>between(h,block.form.rest[i],s.form.rest[i])),'a hand on a settling lump does nothing');
  assert(!st.done&&s.mouldMatch<.7,`the outline reads the bulge it settles into, not the pass (${s.mouldMatch.toFixed(2)})`);
  hold(frames(PUSH.settle));
  assert(st.fix.phase==='shaping'&&s.form.h.every((h,i)=>h===s.form.rest[i]),'settled: the lump is its clump, and clay to the hand');
  assert(close(formVolume(s.form),s.form.volume,1e-9));
  assert(s.mouldMatch<.7&&close(shapedShare(st),.2,.02),`seated, it reads short of the mould (${s.mouldMatch.toFixed(2)}) and a fifth shaped (${shapedShare(st).toFixed(2)}): the cast's progress starts from the seated lump`);

  // The cast: strokes to the line, and the corner is mended — the surface is
  // the mould exactly, the channel is open, and the clay is sealed to every
  // hand, boot and stomp from here on.
  const f=s.form,cast=st.cast,gap=()=>{let e=0;for(let i=0;i<f.n;i++)e+=Math.abs(f.h[i]-cast[i]);return e/f.n;};
  place(s.x-2,0);hold(5);
  let pass=0;for(;pass<12&&!st.done;pass++){for(let i=1;i<f.n-1;i+=2){const d=cast[i]-f.h[i];if(Math.abs(d)<.05)continue;drag(i*f.dx,Math.sign(d)*Math.min(Math.abs(d),.6));}}
  hold(5);
  assert(st.done&&st.sealed&&st.fix.phase==='healed',`cast within ${pass} passes`);
  assert(f.h.every((h,i)=>h===cast[i])&&gap()===0,'the surface is the mould exactly');
  assert(close(formVolume(f),f.volume,1e-9),'and holds its volume');
  assert(shapedShare(st)===1&&s.mouldMatch===1&&g.latched['fix-repaired'],'read as done, the corner\'s channel open');
  assert(heard('shape')&&events.some(e=>e.type==='activate'&&e.channel==='fix-repaired'),'announced');flush();
  hold(frames(.6));assert(s.heal>.4&&s.heal<=1,'the mend ramps up for the view');
  const held=Array.from(f.h);
  drag(f.w/2,-.6);hold(frames(.5),{shapeHeld:true});
  place(s.x+1,s.y+1.5);hold(1,{stompPressed:true});hold(frames(.6));
  assert(held.every((h,i)=>h===f.h[i]),'sealed: a drag, E and a stomp change nothing');
  assert(p.groundId===s.id&&close(p.y,s.y),'the stomper stands on the mended corner at the bench\'s height');
  // The jump: from the mended corner at a run, the far bench and its flower.
  place(s.x-3,0);hold(5);
  for(let i=0;i<frames(3);i++){const go=p.x>=s.x+s.w-.25&&p.groundId;tick({moveAxis:1,jumpPressed:go,jumpHeld:true});if(go)break;}
  for(let i=0;i<frames(2);i++){tick({moveAxis:1,jumpHeld:true});if(p.groundId&&p.vy===0&&i>10)break;}
  assert.equal(p.groundId,exit.id,'a running jump from the corner lands on the far bench');
  walk(exit.x+5.3,frames(3));hold(5);assert.equal(taken().flowers,1,'and the flower is taken');
  assert.equal(g.deaths,0);

  // A save made of the mended corner comes back mended, silently.
  const snap=g.snapshot();assert(snap.shaped.includes('fix')&&snap.broken.includes(rot.id));
  {const g2=new Game();g2.start(3,lab);let emitted=0;g2.onEvent=()=>emitted++;
    assert(g2.restore(snap)&&emitted===0,'restored without a sound');
    const st2=g2.level.shaping.find(q=>q.id==='fix'),s2=g2.level.platforms.find(q=>q.id==='fix-mass'),rot2=g2.level.platforms.find(q=>q.id===st2.fix.rot),block2=g2.level.platforms.find(q=>q.id===st2.fix.block);
    assert(st2.fix.phase==='healed'&&st2.sealed&&st2.done&&s2.active&&s2.form.h.every((h,i)=>h===st2.cast[i]),'mended');
    assert(rot2.broken&&!rot2.active&&block2.active===false&&g2.latched['fix-repaired']&&shapedShare(st2)===1,'rot down, block stood down, channel open');
    g2.tick(dt,{});assert(st2.fix.phase==='healed'&&s2.form.h.every((h,i)=>h===st2.cast[i]),'and it stays mended');}
  // A save with only the rot down comes back with the gap open.
  {const g2=new Game();g2.start(3,lab);const st2=g2.level.shaping.find(q=>q.id==='fix'),rot2=g2.level.platforms.find(q=>q.id===st2.fix.rot);
    assert(g2.restore({...snap,shaped:[],latched:[]}));g2.tick(dt,{});
    assert(rot2.broken&&!rot2.active&&st2.fix.phase==='open'&&!st2.done,'the gap is open, the plug still to seat');}

  // R: the rot stands, the block is back on the dock, the mass is dormant and
  // the channel shut.
  place(exit.x+2,0);hold(5);tick({shapeReset:true});hold(frames(.5));
  assert(rot.active&&!rot.broken&&rot.timer===0,'the rot stands again');
  assert(block.active&&!block.hidden&&block.pushPhase==='free'&&block.x===block.baseX&&block.y===block.baseY,'the block is back on the dock');
  assert(s.active===false&&st.fix.phase==='rot'&&!st.sealed&&!st.done&&s.heal===0&&shapedShare(st)===0,'the mass is dormant, nothing shaped');
  assert(!g.latched['fix-repaired'],'and the channel is shut');

  // The block onto the standing rot: it reacts, hisses, goes to pieces and
  // comes back on the dock; the rot is untouched.
  place(block.x-1,0);hold(5);
  for(let i=0;i<frames(6)&&block.pushPhase==='free';i++)tick({moveAxis:1});
  assert(block.pushPhase==='dissolving'&&heard('push-dissolve'),'reaching onto the rot, the block reacts');
  assert(rot.active&&!rot.broken,'the rot stands');flush();
  for(let i=0;i<frames(PUSH.dissolve+.05);i++)tick();
  assert(block.pushPhase==='gone'&&block.active===false&&heard('push-shatter'),'it goes to pieces');flush();
  place(s.x-4,0);hold(5);
  for(let i=0;i<frames(PUSH.gone+.2);i++)tick();
  assert(block.pushPhase==='free'&&block.active&&block.x===block.baseX&&heard('push-respawn'),'and comes back where it started');flush();
  // Pushed the other way it stops at the dock's end.
  place(block.x+block.w+1,0);hold(5);for(let i=0;i<frames(4);i++)tick({moveAxis:-1});
  const stop=P('fix-stop');assert(close(block.x,stop.x+stop.w,.02),'pushed left it stops against the stop');
  assert.equal(p.pushing,-1,'and a lean on a stopped block still reads as a push, to the left');
  assert.equal(g.deaths,0);
}
console.log('PASS fix the structure: the rot drops whoever stands on it and is no take-off, a stomp clears it and bounces the stomper, the block is a lump to hop onto and a stone to push, over the open gap it seats and is clay to the hand, cast to the line it is the corner again — sealed, saved, and the jump is on — and pushed onto the rot it dissolves and comes back; R undoes all of it');

// A lab session edits neither the shipped chapters nor its own source.
assert.equal(JSON.stringify(LEVELS),chapters);assert.equal(JSON.stringify(lab),source);
console.log('PASS the benches leave the chapters and their own source alone');
