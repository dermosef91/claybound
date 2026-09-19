import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt,finaleFlower} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {machineTransfer,finaleTransfer} from './machine-pilot.mjs';
import {motherTransfer} from './mother-puff-pilot.mjs';
import {solveFormStation} from '../dist/clay-rules.js';
import {formShare} from '../dist/clay-form.js';
export const cloneGame=g=>{const copy=Object.assign(Object.create(Game.prototype),structuredClone({...g,onEvent:null}));copy.onEvent=()=>{};return copy;};
export function steer(g,aim){return Math.max(-1,Math.min(1,((aim-g.player.x)*7-(g.player.windX||0)*.16)/6.7));}
// A formable mass has no finished pose: "shaped" is the surface its authored
// solution strokes make, solved once per station through the real hand and
// copied onto every game a sweep starts. Exported so clay-sections can hold the
// pilot's real-input replay to the same surface.
// `source` is a level standing in for the registered chapter (a solo section
// build); its surfaces are cached apart from the chapter's under its name.
const solved=new Map();
export function solvedForm(index,id,source){
  const key=`${source?source.name+'/':''}${index}:${id}`;
  if(!solved.has(key)){
    const g=new Game();g.start(index,source);
    const station=g.level.shaping.find(s=>s.id===id),mass=g.level.platforms.find(s=>s.id===station.parts[0]);
    solved.set(key,Float64Array.from(solveFormStation(station,mass,{dt}).h));
  }
  return solved.get(key);
}
function applySolvedSurface(g,station,source){
  const f=g.level.platforms.find(s=>s.id===station.parts[0]).form;
  f.h.set(solvedForm(g.index,station.id,source));f.prev.set(f.h);f.settled=false;f.version++;
  station.amount=station.target=formShare(f,station.shaped);station.announced=true;
}
// A rock run is worked to send its rock over the edge, and what the rock does
// on the way down — the planks it smashes, the floor it comes to rest on — is
// part of the shape the chapter is in afterwards. Settled once per station
// from the solved surface, through the real game, and copied like the surface.
const settled=new Map();
export function settledRock(index,id,source){
  const key=`${source?source.name+'/':''}${index}:${id}`;
  if(!settled.has(key)){
    const g=new Game();g.start(index,source);g.onEvent=()=>{};
    const station=g.level.shaping.find(s=>s.id===id);
    applySolvedSurface(g,station,source);
    // Until the rock is down and the scene watching it is over, so a sweep
    // never starts with the hands off.
    for(let k=0;k<2400&&!(station.ball.landed&&!g.cinema);k++)g.tick(dt,{});
    assert(station.done&&station.ball.landed&&!g.cinema,`${id}: the solved surface sends its rock over the edge`);
    settled.set(key,{ball:{...station.ball},broken:g.level.platforms.filter(s=>s.broken).map(s=>s.id)});
  }
  return settled.get(key);
}
export function applySolvedForm(g,station,source){
  applySolvedSurface(g,station,source);
  if(!station.ball?.spill)return;
  const rock=settledRock(g.index,station.id,source);
  Object.assign(station.ball,rock.ball);
  for(const id of rock.broken){const s=g.level.platforms.find(q=>q.id===id);if(s)g.breakPlatform(s,s.x+s.w/2);}
  station.done=true;station.open=1;station.amount=station.target=1;
  if(station.channel){g.latched[station.channel]=true;g.channels[station.channel]=1;}
}
// `shaped` is what separates "can this be crossed" from "is the clay carrying
// it": at shaped:false every station stays at its unworked pose, so a link that
// still succeeds is a link the clay was never needed for. It can also be a
// function of the station, to leave exactly one piece unworked.
// `source` stands in for the registered chapter at `index`, so a synthetic
// level can be swept by the same pilot the chapters are.
export function crossing(index,link,{shaped=true,source}={}){
  const worked=typeof shaped==='function'?shaped:()=>shaped;
  for(const phase of [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5])for(const offset of [.35,.85,1.4,2.1]){
    const g=new Game();g.start(index,source);g.level.enemies=[];g.level.crushers=[];g.level.coins=[];g.level.stamps=[];
    const a=g.level.platforms.find(s=>s.id===link.from),b=g.level.platforms.find(s=>s.id===link.to);assert(a&&b);
    // Spikes are cleared so a sweep measures reach alone — except around a free
    // formable mass, whose bare base is walkable sand that only the spikes make
    // deadly: without them a sweep would "land" on the base the clay has left.
    if(!(a.form||b.form))g.level.hazards=[];
    for(const s of g.level.platforms){if(s.channel){g.channels[s.channel]=100;g.latched[s.channel]=true;}if(s.releases){g.channels[s.releases]=1;g.latched[s.releases]=true;}if(s.kind==='counter')s.y=s.prevY=s.baseY+s.rise;}
    // Trigger zones are channel sources too; a sweep measures reach with
    // everything they wake already awake.
    for(const t of g.level.triggers||[]){g.channels[t.channel]=100;g.latched[t.channel]=true;}
    for(const station of g.level.shaping||[]){station.announced=true;if(worked(station)){if(station.rule==='form')applySolvedForm(g,station,source);else{station.target=1;station.amount=1;}}}
    g.time=phase;g.tick(dt,{});
    const dir=Math.sign(b.x+b.w/2-a.x-a.w/2)||1,overlap=a.x<b.x+b.w&&a.x+a.w>b.x,fall=link.mode==='fall',drop=link.mode==='drop',walk=link.mode==='walk';
    let x=dir>0?a.x+a.w-offset:a.x+offset;
    // A ledge over a broad floor can be approached from underneath. Dropping
    // onto its left portion can also avoid a raised switch over its centre.
    const landingX=fall&&overlap?b.x+Math.min(offset,b.w/2):b.x+b.w/2;
    if(overlap&&b.y>a.y&&!walk&&!fall&&!drop&&a.kind!=='spring')x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,landingX-dir*offset));
    if(walk&&overlap)x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,b.x+(dir>0?-1:b.w+1)));
    if((drop||fall)&&overlap)x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,landingX));
    if(a.kind==='spring')x=a.x+a.w/2;
    if(link.mode==='boss')x=a.x+.75;
    // The ending is crossed from the flower, with every strand worked.
    if(link.mode==='finale')x=Math.max(a.x+.35,Math.min(a.x+a.w-.35,finaleFlower(g.level).x));
    Object.assign(g.player,{x,y:surfaceAt(a,x),vx:drop||a.kind==='spring'?0:dir*6.7,vy:0,groundId:a.id,coyote:a.kind==='spring'?0:.13});g.checkpoint={x,y:Math.min(a.y,b.y)};
    if(link.mode==='boss'){const r=motherTransfer(g,link);if(r)return {phase,offset,frames:r.controls.length};continue;}
    if(link.mode==='finale'){const r=finaleTransfer(g,link);if(r)return {phase,offset,frames:r.controls.length};continue;}
    if(a.kind==='ferry'||(link.mode==='ride'||link.mode==='board')){const r=machineTransfer(g,link);if(r)return {phase,offset,frames:r.controls.length};continue;}
    let landedSpring=false;g.onEvent=e=>{if(e.type==='spring'&&b.kind==='spring'&&Math.abs(e.y-b.y)<.2&&e.x>b.x-.3&&e.x<b.x+b.w+.3)landedSpring=true;};
    for(let frame=0;frame<600;frame++){
      const aim=landingX;
      g.tick(dt,{moveAxis:steer(g,aim),jumpPressed:frame===0&&a.kind!=='spring'&&!walk&&!fall,jumpHeld:true,stompPressed:(drop&&frame===15)||(fall&&overlap&&a.kind==='ledge'&&frame===0)});
      // A walk pressed against clay works it (a lean is a swipe towards it),
      // and this is a measure of reach with the piece unworked: a lean on a
      // piece left unworked is taken off the player here, before the clay
      // takes it next tick, so the piece stays exactly at its unworked pose.
      const lean=g.player.lean;if(lean&&!worked(g.level.shaping.find(s=>s.id===lean.id)))g.player.lean=null;
      if(g.player.groundId===b.id||landedSpring)return {phase,offset,frames:frame+1};
      if(g.respawnTimer>0||g.player.y<Math.min(a.y,b.y)-7)break;
    }
  }return null;
}
if(process.argv[1]?.endsWith('routes.mjs')){
 let count=0;const failures=[];
 for(const [i,L]of LEVELS.entries()){
  // The original compact traversal retains its length; Wildwood now adds
  // a 51-unit boss clearing beyond that route.
  assert(Math.abs(((L.boss?L.end-51:L.end)-L.spawn.x)/L.previousDistance-.3)<.005);assert.equal(L.stamps.length,[4,2,5,3,3][i]);
  assert.equal(new Set(L.platforms.map(s=>s.id)).size,L.platforms.length);assert.equal(L.platforms.filter(s=>s.goal).length,1);
  assert(Math.abs(L.platforms.find(s=>s.goal).x+L.platforms.find(s=>s.goal).bellX-L.end)<1e-6);
  for(const link of [...L.routeLinks,...L.detours.flat(),...L.recoveries.flat()]){
   count++;if(!crossing(i,link)){failures.push({level:i,...link});console.log('UNREACHABLE',i,JSON.stringify(link));}
  }
  console.log('CHECK',L.short,L.routeLinks.length,'main crossings,',L.detours.length,'flower routes,',L.end-L.spawn.x,'units');
 }
 assert.equal(failures.length,0,JSON.stringify(failures));console.log('PASS',count,'main, optional and recovery crossings under real physics');
}
