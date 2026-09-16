// Clay in the chapters follows two rules a player can feel even if they could
// never name them:
//   · one piece, one input — working a piece of clay never moves any other;
//   · clay is not created or destroyed — what gets wider gets lower, so every
//     piece keeps (roughly) the same volume in both of its poses.
// And the mid-chapter clay sections are the way through, not decoration beside
// it: each station's bypass — the last solid ground before its clay to the
// first solid ground after — is impossible with that one piece unworked, even
// with every other piece in the chapter already shaped.
import assert from 'node:assert/strict';
import {crossing} from './routes.mjs';
import {LEVELS} from '../dist/levels.js';

// Side-on area. A ramp is a flat-bottomed wedge whose smoothstep top averages
// half its rise; any other sloped clay is a slab of constant thickness, which
// is how both the collider and the mesh build it.
const volume=(q,role)=>q.w*((q.h??0)+(role==='ramp'?(q.slope||0)/2:0));
const TOLERANCE=.1;

for(const L of LEVELS)for(const station of L.shaping||[]){
  assert.equal(station.parts.length,1,`${L.short}: ${station.id} moves ${station.parts.length} pieces from one input`);
  const piece=L.platforms.find(p=>p.id===station.parts[0]);
  assert(piece?.shape,`${L.short}: ${station.id} has its clay`);
  const before=volume(piece.shape.from,piece.clayRole),after=volume(piece.shape.to,piece.clayRole);
  assert(Math.abs(after-before)/before<=TOLERANCE,
    `${L.short}: ${piece.id} goes from ${before.toFixed(2)} to ${after.toFixed(2)} units of clay`);
  // Every gesture makes clay wider and lower; nothing is ever pulled taller.
  assert(piece.shape.to.w>=piece.shape.from.w,`${L.short}: ${piece.id} does not narrow`);
}
console.log('PASS every chapter station works exactly one piece of clay, and every piece keeps its volume within ten per cent');

const SECTIONS=[
  {level:0,station:'canyon-spire',bypass:{from:'pocket-dock',to:'canyon-lump',mode:'jump'}},
  {level:0,station:'canyon-lump',bypass:{from:'canyon-spire',to:'pocket-landing',mode:'jump'}},
  {level:1,station:'weave-bough',bypass:{from:'gap-brink',to:'weave-perch',mode:'jump'}},
  {level:1,station:'weave-mound',bypass:{from:'weave-spring',to:'canopy-nest',mode:'jump'}},
  {level:2,station:'kiln-tower',bypass:{from:'kiln-ledge',to:'kiln-tunnel',mode:'jump'}},
  {level:2,station:'kiln-plug',bypass:{from:'kiln-tunnel',to:'kiln-run',mode:'jump'}}
];

for(const {level,station,bypass} of SECTIONS){
  const L=LEVELS[level],s=(L.shaping||[]).find(s=>s.id===station);
  assert(s,`${L.short} has a station called ${station}`);
  for(const id of [bypass.from,bypass.to])assert(L.platforms.some(p=>p.id===id),`${L.short} has ${id}`);
  // Only this piece unworked. The bypass may well start or land on other clay,
  // which is then in its finished pose.
  assert.equal(crossing(level,bypass,{shaped:other=>other.id!==station}),null,
    `${L.short}: ${bypass.from} → ${bypass.to} is crossable without shaping ${station}, so that clay is optional`);
  const links=L.routeLinks.filter(l=>s.parts.includes(l.to)||s.parts.includes(l.from));
  assert(links.length>=2,`${station} is on the main route both in and out`);
  for(const link of links)assert(crossing(level,link),`${L.short}: ${link.from} → ${link.to} fails once ${station} is shaped`);
  console.log('PASS',L.short.padEnd(15),station.padEnd(13),`${bypass.from} → ${bypass.to} impossible unworked; ${links.length} links good once shaped`);
}

// Every gesture the game can ask for is taught before the chapter that leans on
// it, which was the point of putting clay in the first three chapters at all.
const taught=new Set(LEVELS.slice(0,3).flatMap(L=>(L.shaping||[]).map(s=>s.gesture)));
assert.deepEqual([...taught].sort(),['down','out','right']);
console.log('PASS all three gestures are taught before the final chapter');
