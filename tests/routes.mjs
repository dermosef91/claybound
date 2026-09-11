import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {machineTransfer} from './machine-pilot.mjs';
export const cloneGame=g=>{const copy=Object.assign(Object.create(Game.prototype),structuredClone({...g,onEvent:null}));copy.onEvent=()=>{};return copy;};
export function steer(g,aim){return Math.max(-1,Math.min(1,((aim-g.player.x)*7-(g.player.windX||0)*.16)/6.7));}
export function crossing(index,link){
  for(const phase of [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5])for(const offset of [.35,.85,1.4,2.1]){
    const g=new Game();g.start(index);g.level.enemies=[];g.level.crushers=[];g.level.hazards=[];g.level.coins=[];g.level.stamps=[];
    for(const s of g.level.platforms){if(s.channel){g.channels[s.channel]=100;g.latched[s.channel]=true;}if(s.releases){g.channels[s.releases]=1;g.latched[s.releases]=true;}if(s.kind==='counter')s.y=s.prevY=s.baseY+s.rise;}
    g.time=phase;g.tick(dt,{});
    const a=g.level.platforms.find(s=>s.id===link.from),b=g.level.platforms.find(s=>s.id===link.to);assert(a&&b);
    const dir=Math.sign(b.x+b.w/2-a.x-a.w/2)||1,overlap=a.x<b.x+b.w&&a.x+a.w>b.x,fall=link.mode==='fall',drop=link.mode==='drop',walk=link.mode==='walk';
    let x=dir>0?a.x+a.w-offset:a.x+offset;
    if(walk&&overlap)x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,b.x+(dir>0?-1:b.w+1)));
    if((drop||fall)&&overlap)x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,b.x+b.w/2));
    if(a.kind==='spring')x=a.x+a.w/2;
    Object.assign(g.player,{x,y:surfaceAt(a,x),vx:drop||a.kind==='spring'?0:dir*6.7,vy:0,groundId:a.id,coyote:a.kind==='spring'?0:.13});g.checkpoint={x,y:Math.min(a.y,b.y)};
    if(a.kind==='ferry'||(link.mode==='ride'||link.mode==='board')){const r=machineTransfer(g,link);if(r)return {phase,offset,frames:r.controls.length};continue;}
    let landedSpring=false;g.onEvent=e=>{if(e.type==='spring'&&b.kind==='spring'&&Math.abs(e.y-b.y)<.2&&e.x>b.x-.3&&e.x<b.x+b.w+.3)landedSpring=true;};
    for(let frame=0;frame<600;frame++){
      const aim=b.x+b.w/2;
      g.tick(dt,{moveAxis:steer(g,aim),jumpPressed:frame===0&&a.kind!=='spring'&&!walk&&!fall,jumpHeld:true,stompPressed:(drop&&frame===15)||(fall&&overlap&&a.kind==='ledge'&&frame===0)});
      if(g.player.groundId===b.id||landedSpring)return {phase,offset,frames:frame+1};
      if(g.respawnTimer>0||g.player.y<Math.min(a.y,b.y)-7)break;
    }
  }return null;
}
if(process.argv[1]?.endsWith('routes.mjs')){
 let count=0;const failures=[];
 for(const [i,L]of LEVELS.entries()){
  assert(Math.abs((L.end-L.spawn.x)/L.previousDistance-.3)<.005);assert.equal(L.stamps.length,3);
  assert.equal(new Set(L.platforms.map(s=>s.id)).size,L.platforms.length);assert.equal(L.platforms.filter(s=>s.goal).length,1);
  assert(Math.abs(L.platforms.find(s=>s.goal).x+L.platforms.find(s=>s.goal).bellX-L.end)<1e-6);
  for(const link of [...L.routeLinks,...L.detours.flat(),...L.recoveries.flat()]){
   count++;if(!crossing(i,link)){failures.push({level:i,...link});console.log('UNREACHABLE',i,JSON.stringify(link));}
  }
  console.log('CHECK',L.short,L.routeLinks.length,'main crossings,',L.detours.length,'flower routes,',L.end-L.spawn.x,'units');
 }
 assert.equal(failures.length,0,JSON.stringify(failures));console.log('PASS',count,'main, optional and recovery crossings under real physics');
}
