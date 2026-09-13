import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {SPITTER,shotWall} from '../dist/spitter-rules.js';
import {DraftLibrary,DraftSession,validateDraft} from '../dist/editor-model.js';
const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:input.jumpPressed&&i===0});};
const stand=(g,s,x=s.x+s.w/2)=>Object.assign(g.player,{x,y:s.y,vx:0,vy:0,groundId:s.id,coyote:.13,invuln:0});
const cave=()=>{const g=new Game();g.start(2);return g;};

{
 const g=cave();g.level.enemies=[];
 const gate=g.level.platforms.find(s=>s.id==='spark-gate'),floor=g.level.platforms.find(s=>s.id==='spark-hub');
 stand(g,floor,gate.x-2);tick(g,180,{right:true,jumpPressed:true,jumpHeld:true});
 assert(g.player.x<gate.x,'a jump cannot bypass the unsolved gate');
 g.activate('spark-lock',32,7.43);tick(g,130,{right:true});assert(g.player.x>gate.x+gate.w);
 const cp=g.level.platforms.find(s=>s.id==='ferry-dock');stand(g,cp,cp.checkpoint);g.tick(dt);
 const restored=cave();assert(restored.restore(g.snapshot()));const grate=restored.level.platforms.find(s=>s.id===gate.id);
 assert(!grate.active&&grate.open===1,'solved passages are already open after resume');
 assert.equal(restored.restore({...g.snapshot(),version:3}),false);
 console.log('PASS gates block bypasses; solved loops and new-layout checkpoints resume correctly');
}
{
 const g=cave();g.level.enemies=[];g.level.crushers=[];
 const f=g.level.platforms.find(s=>s.kind==='ferry');stand(g,f);tick(g,120);assert.equal(f.x,f.baseX);
 stand(g,f,f.x+f.w-.85);tick(g,160);assert(f.x>f.baseX+3);assert.equal(g.player.groundId,f.id);
 const before=f.x;stand(g,f);tick(g,80);const stopped=f.x;tick(g,120);assert.equal(f.x,stopped);assert(stopped-before<.7,'centre brakes within a short distance');
 stand(g,f,f.x+.85);tick(g,100);assert(f.x<stopped-1);
 g.player.x=1;g.player.y=0;g.player.groundId='start';tick(g,600);assert.equal(f.x,f.baseX,'empty ferry returns after a missed landing');
 const orbit=g.level.platforms.find(s=>s.kind==='orbit');stand(g,orbit);let high=-Infinity,low=Infinity;
 for(let i=0;i<1450;i++){g.tick(dt);high=Math.max(high,g.player.y);low=Math.min(low,g.player.y);assert.equal(g.player.groundId,orbit.id);assert(Math.abs(g.player.x-orbit.x-orbit.w/2)<1e-7);}
 assert(high-low>10,'rider follows the complete vertical circuit');
 const pose=JSON.stringify({orbit,f,player:g.player});g.pause();tick(g,240);assert.equal(JSON.stringify({orbit,f,player:g.player}),pose);
 console.log('PASS ferry steering/braking/recall, full orbit passenger carry, and pause');
}
function arena(cover=false){
 const source=structuredClone(LEVELS[2]);Object.assign(source,{spawn:{x:2,y:0},end:28,
  platforms:[{id:'start',x:-8,y:0,w:30,kind:'stone'},{id:'finish',x:24,y:0,w:10,kind:'stone',goal:true}],
  enemies:[{kind:'spitter',x:7,y:0,min:7,max:7,speed:.1}],hazards:[],crushers:[],coins:[],stamps:[],winds:[],circuits:[]});
 if(cover)source.platforms.push({id:'cover',x:4,y:2,w:1.4,kind:'stone'});
 const events=[],g=new Game(e=>events.push(e));g.start(2,source);return {g,e:g.level.enemies[0],events};
}
{
 const {g,e,events}=arena();tick(g,133);assert.equal(e.aiState,'charge');assert.equal(g.shots.length,0);
 const locked=[e.aimX,e.aimY];tick(g,50);assert.deepEqual([e.aimX,e.aimY],locked);assert(!events.some(e=>e.type==='spitter-fire'));
 tick(g,60);assert.equal(g.shots.length,1);const q=g.shots[0];assert(q.vx<0);assert(Math.abs(Math.hypot(q.vx,q.vy)-SPITTER.shotSpeed)<.01);
 g.pause();const state=JSON.stringify([g.shots,e]);tick(g,200);assert.equal(JSON.stringify([g.shots,e]),state);g.resume();
 tick(g,140);assert.equal(g.player.health,2,'visible projectile damages on contact');
 g.respawn();assert.equal(g.shots.length,0,'respawn clears outstanding shots');
 console.log('PASS spitter warning, locked aim, projectile travel/damage, pause and safe respawn');
}
{
 const {g,events}=arena(true);tick(g,700);assert.equal(g.player.health,3);assert(!events.some(e=>e.type==='spitter-fire'),'rock cover blocks line of sight');
 assert(shotWall(7,.8,2,.8,g.level.platforms)<1,'the same cover catches shots already in flight');
 const a=arena();stand(a.g,a.g.level.platforms[0],2);tick(a.g,245);tick(a.g,120,{jumpPressed:true,jumpHeld:true});
 assert.equal(a.g.player.health,3,'jumping over the arriving shot is a viable dodge');
 const b=arena();Object.assign(b.g.player,{x:7,y:1.22,vy:-8,groundId:null,coyote:0});tick(b.g,5,{jumpHeld:true});
 assert(!b.e.alive);assert(b.g.player.vy>0);assert(b.events.some(e=>e.type==='squish'&&e.kind==='spitter'));
 console.log('PASS cover, a timed projectile dodge and a rewarding stomp defeat');
}
{
 const clean=validateDraft(LEVELS[2],LEVELS[2]);
 assert.equal(clean.platforms.filter(p=>['gate','ferry','orbit'].includes(p.kind)).length,6);
 assert(clean.crushers.every(c=>c.floorY===0));assert.equal(clean.enemies.filter(e=>e.kind==='spitter').length,3);
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const lib=new DraftLibrary(LEVELS,storage),s=new DraftSession(lib,2);
 for(const kind of ['ferry','orbit','gate','spitter']){s.add(kind,20,14);s.set('x',21);s.undo();s.redo();}
 const read=lib.read(lib.export(2,s.level),2);assert.equal(read.enemies.at(-1).kind,'spitter');assert.equal(read.enemies.at(-1).x,21);
 assert.equal(new DraftLibrary(LEVELS,storage).get(2).platforms.length,s.level.platforms.length);
 console.log('PASS all new machines and enemies round-trip through editing, undo, saves and backups');
}

{
 const {initializeSpitter,moveSpitter,spitterMuzzle}=await import('../dist/spitter-rules.js');
 const floor={x:0,y:0,w:8,kind:'stone',active:true},e={id:4,kind:'spitter',x:4,y:0,baseY:0,min:-10,max:20,speed:SPITTER.patrolSpeed,alive:true};initializeSpitter(e);
 const player={x:30,y:0,health:3,invuln:0},shots=[];
 const context={player,platforms:[floor],shots,nextShotId:()=>17};
 let lo=e.x,hi=e.x,turned=false,last=e.dir;
 for(let i=0;i<3600;i++){moveSpitter(e,dt,i*dt,context);lo=Math.min(lo,e.x);hi=Math.max(hi,e.x);if(last!==e.dir)turned=true;last=e.dir;}
 assert(turned&&hi-lo>5);assert(lo>=SPITTER.radius&&hi<=8-SPITTER.radius,'patrol respects platform edges even with oversized authored bounds');
 player.x=e.x>4?2:6;e.cooldown=0;moveSpitter(e,dt,0,context);assert.equal(e.aiState,'charge');
 const locked={x:e.x,dir:e.dir,aimX:e.aimX,aimY:e.aimY};player.x+=.5;
 for(let i=0;i<140&&shots.length===0;i++){moveSpitter(e,dt,0,context);assert.equal(e.x,locked.x);assert.equal(e.dir,locked.dir);assert.equal(e.aimX,locked.aimX);}
 assert.equal(shots.length,1);const muzzle=spitterMuzzle(e);for(const k of ['x','y','z'])assert(Math.abs(shots[0][k]-muzzle[k])<1e-9,'shot starts at the shared animated muzzle');
 const blocked={...e,x:2,homeX:2,min:1,max:7,aiState:'patrol',cooldown:0,stateTime:0,dir:1};player.x=6;
 const gate={x:4,y:4,w:.6,h:4,kind:'gate',active:true};
 for(let i=0;i<600;i++){moveSpitter(blocked,dt,0,{...context,platforms:[floor,gate],shots:[]});assert.notEqual(blocked.aiState,'charge');assert(blocked.x<gate.x-SPITTER.radius);}
 console.log('PASS supported patrols, ledge turns, closed-gate cover, sightline acquisition, stationary locked charge and 3D mouth origin');
}
