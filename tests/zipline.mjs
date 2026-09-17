// The summit ropeway: a trolley that leaves under a rider's weight, carries
// them the whole way down, hauls itself back when abandoned, and is exempt
// from the long-fall rule only while it is actually carrying someone.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {ZIP} from '../dist/cavern-machines.js';

const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:input.jumpPressed&&i===0});};
const stand=(g,s,x=s.x+s.w/2)=>Object.assign(g.player,{x,y:s.y,vx:0,vy:0,groundId:s.id,coyote:.13,invuln:0});
const canyon=()=>{const g=new Game();g.start(0);g.level.enemies=[];g.level.crushers=[];return g;};
const trolley=g=>g.level.platforms.find(s=>s.kind==='zip');

{
 const g=canyon(),t=trolley(g);
 assert(t,'the canyon carries a zip line');
 tick(g,240);
 assert.equal(t.x,t.baseX);assert.equal(t.y,t.baseY,'an empty trolley waits at its mast');

 // The whole ride, with the rider aboard for every tick of it.
 stand(g,t);
 let lowest=Infinity,fastest=0,previous=t.y;
 for(let i=0;i<Math.round((t.duration+.5)*120);i++){
  g.tick(dt,{});
  assert.equal(g.player.groundId,t.id,'the trolley never drops its rider');
  fastest=Math.max(fastest,(previous-t.y)/dt);previous=t.y;lowest=Math.min(lowest,g.player.y);
 }
 assert.equal(g.deaths,0,'the ride passes far below the summit flag without killing anyone');
 assert(Math.abs(t.x-t.baseX-t.travel)<1e-6,'it runs the full cable');
 assert(Math.abs(t.y-(t.baseY-t.drop))<1e-6);
 // The landing filter carries a deck that falls no more than .14 in a tick.
 assert(fastest<.14/dt,`peak descent ${fastest.toFixed(2)} stays inside the carry allowance`);
 assert(lowest<t.baseY-13,'and the ride really does pass the long-fall threshold');
 console.log('PASS the ropeway carries its rider the whole way down, inside the carry allowance');
}
{
 // Abandoned at the bottom, it comes back: a missed landing must never strand
 // a player with the only way across parked at the far end.
 const g=canyon(),t=trolley(g),start=g.level.platforms.find(s=>s.id==='start');
 stand(g,t);tick(g,Math.round((t.duration+.2)*120));
 stand(g,start);tick(g,Math.round(ZIP.recall*120));
 assert(t.x>t.baseX+t.travel-1,'it holds at the far mast for a moment first');
 tick(g,Math.round((t.duration/ZIP.haul+1)*120));
 assert(Math.abs(t.x-t.baseX)<1e-6&&Math.abs(t.y-t.baseY)<1e-6,'then hauls all the way home');

 // And a death mid-cable puts it back immediately, with the player.
 stand(g,t);tick(g,Math.round(t.duration*60));
 assert(t.x>t.baseX+1,'the trolley is out on the cable');
 g.player.y=-40;g.tick(dt);tick(g,Math.round(1.6*120));
 assert.equal(t.x,t.baseX);assert.equal(t.y,t.baseY,'dying on the ride returns the trolley to its mast');
 console.log('PASS an empty or abandoned trolley hauls back, and a death resets it');
}
{
 // The exemption is the trolley's, not the player's: stepping off below the
 // flag hands them back to the ordinary rule once the landing grace expires.
 const g=canyon(),t=trolley(g);
 stand(g,t);tick(g,Math.round(2*120));
 assert.equal(g.deaths,0);
 assert(t.x>t.baseX+5&&t.x<t.baseX+t.travel-5,'let go halfway out, over the chasm');
 // Step clear of the deck rather than off the end of the chapter, which the
 // bell would otherwise answer first.
 g.player.groundId=null;g.player.x=t.x-4;g.player.y=t.y;
 tick(g,Math.round(3*120));
 assert(g.deaths>0,'let go over the chasm, a rider falls like anyone else');
 console.log('PASS the long-fall exemption belongs to the ride, not to the rider');
}
{
 // Nothing else in the game gained a zip, so nothing else changed behaviour.
 const others=LEVELS.filter((L,i)=>i!==0);
 assert(others.every(L=>!L.platforms.some(s=>s.kind==='zip')));
 assert.equal(RULES.speed,6.7,'the ropeway needed no change to the player rules');
 console.log('PASS the zip line is confined to the chapter that authors one');
}
