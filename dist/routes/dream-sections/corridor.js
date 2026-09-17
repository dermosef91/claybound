// Section 4 — The Breathing Corridor. Local x 0..55, a breather with no
// enemies: the tunnel breathes, and you move on the inhale.
//
// Three breathing pillars stand in a bed of soft cones; each is a `wall`
// whose top swells and sinks (dy = dh keeps the base planted at the bed, so
// only the top moves and a rider is carried up with it). Then the throat: a
// breathing wall hanging from the ceiling whose underside never opens wider
// than 1.3 — impassable — over a violet plug flush with the floor between two
// goo pits. Spread the plug and it fills both pits and sinks into a pocket 2.2
// deep, and the clearance under the throat becomes 2.5–3.5: you crawl through
// where the tunnel would not open. Two molars (presses) bite the floor in turn
// over floor-2, then two anti-phase teeth carry you out over the last trench.
//
// Every pillar/tooth top and every rise below was checked against the reach
// table (rise ≤1 → 5, ≤1.8 → 4.4, ≤2.3 → 3.4, ≤2.6 → 2.6):
//   entry (0) → pillar-1 (1.4–2.6): gap 1.5, worst rise 2.6 → 2.6 reach
//   pillar-1 → pillar-2 (2.3–3.7): gap 2.1, worst rise 2.13 (phases 120° apart)
//   pillar-2 → pillar-3 (1.4–2.6): gap 2.1, a drop at every phase
//   pillar-3 → floor-1 (0): gap .6, fall
//   floor-1 → worked plug (−2.2): fall onto the pocket at 30, bumping down the
//     throat's left face when running (the wall pushes, never hurts)
//   pocket → floor-2 (0): rise 2.2 from the pocket's last 2 u (36–38), where
//     the throat no longer overhangs
//   floor-2 → tooth-1 (1.0–3.8): gap .5, board while its top is ≤ 2.6, ride up
//   tooth-1 → tooth-2 (anti-phase): gap 1.1, hop when the tops are level
//   tooth-2 → exit (0): gap .2, fall
import {p} from '../../route-authoring.js';
// A posed clay piece: one platform with two poses, worked by its station.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
// The corridor breathes at one tempo; pillars and teeth join it at different
// points of the cycle.
const BREATH=4.4;
export default {
  key:'corridor',name:'The Breathing Corridor',landmark:'throat',length:55,entryId:'corridor-entry',exitId:'corridor-exit',
  platforms:[
    p('corridor-entry',0,8,0,'stone',{checkpoint:3}),
    // Breathing pillars: bases planted at the cone bed (−1.6), tops rising
    // and falling with the breath. The route steps pillar to pillar.
    p('corridor-pillar-1',9.5,2.4,2.0,'wall',{h:3.6,breathe:{dh:.6,dy:.6,period:BREATH}}),
    p('corridor-pillar-2',14,2.4,3.0,'wall',{h:4.6,breathe:{dh:.7,dy:.7,period:BREATH,phase:2.094}}),
    p('corridor-pillar-3',18.5,2.4,2.0,'wall',{h:3.6,breathe:{dh:.6,dy:.6,period:BREATH,phase:4.189}}),
    p('corridor-floor-1',21.5,8.5,0,'stone',{checkpoint:25}),
    // The throat: hangs from y 7, its underside .3–1.3 above the floor — a
    // standing player never fits under it, so the floor has to sink.
    p('corridor-throat',31,5,7,'wall',{h:6.2,breathe:{dh:.5,period:BREATH}}),
    // The plug: 2 × 3 of violet clay flush with the floor between two goo
    // pits; spread to 8 × .75, it fills both pits and sinks into a pocket
    // whose floor lies 2.2 below the corridor (volume 6 → 6).
    part('corridor-plug',{x:33,w:2,y:0,h:3},{x:30,w:8,y:-2.2,h:.75},{station:'corridor-plug',clayRole:'block'}),
    p('corridor-floor-2',38,8,0,'stone',{checkpoint:38.8}),
    // Two teeth breathing in anti-phase over the last trench: board the near
    // one at its low, ride up, hop across as the tops pass each other.
    p('corridor-tooth-1',46.5,1.6,2.4,'wall',{h:4.0,breathe:{dh:1.4,dy:1.4,period:BREATH}}),
    p('corridor-tooth-2',49.2,1.6,2.4,'wall',{h:4.0,breathe:{dh:1.4,dy:1.4,period:BREATH,phase:3.1416}}),
    p('corridor-exit',51,4,0)
  ],
  route:['corridor-entry','corridor-pillar-1','corridor-pillar-2','corridor-pillar-3',['corridor-floor-1','fall'],['corridor-plug','fall'],'corridor-floor-2','corridor-tooth-1','corridor-tooth-2',['corridor-exit','fall']],
  detours:[],recoveries:[],
  coins:[{x:10.7,y:4},{x:15.2,y:5.2},{x:19.7,y:4},{x:27,y:2},{x:32,y:-.6},{x:34,y:-.6},{x:36,y:-.6},{x:43,y:2},{x:47.3,y:5.6},{x:50,y:5.6}],
  stamps:[],
  // A breather: no creatures. The molars are the section's teeth.
  enemies:[],
  // The cone bed under the pillars (their bases stand in it), goo under the
  // plug (the worked pocket floor at −2.2 is a full unit above it), and the
  // teeth's trench.
  hazards:[{x:8,w:13.5,y:-1.6},{x:30,w:8,y:-3.2},{x:46,w:5,y:-1.6}],
  hints:[
    {x:8,end:21,icon:'lift',title:'Breathe with it',text:'The pillars breathe. Step on as one sinks, ride it up, hop across on the inhale.'},
    {x:22,end:37,icon:'sink',title:'The throat',text:'The throat never opens wide enough. Spread the violet plug — drag it outward, or hold E / KNEAD — until the floor sinks into a pocket you can crawl through.',touchText:'The throat never opens wide enough. Spread the violet plug — drag it outward, or tap KNEAD — until the floor sinks into a pocket you can crawl through.'},
    {x:38,end:46,icon:'drop',title:'Molars',text:'Two teeth bite the floor in turn. Pass under the one that just lifted.'}
  ],
  winds:[],triggers:[],
  // Two molars over floor-2: at rest the underside (4.95) clears a standing
  // head; they slam to the floor in anti-phase, so one lane is always open.
  crushers:[
    {x:41.5,w:1.6,y:5.6,period:5.4,floorY:0,range:4.95},
    {x:44.5,w:1.6,y:5.6,period:5.4,phase:3.1416,floorY:0,range:4.95}
  ],
  shaping:[
    {id:'corridor-plug',name:'Spread the plug',verb:'Spread',gesture:'out',icon:'sink',parts:['corridor-plug'],x:22,end:40,
     spawn:{x:27,y:0,groundId:'corridor-floor-1'},cueX:33.5,
     hint:'The throat never opens wide enough. Spread the violet plug — drag it outward, or hold E / KNEAD — until the floor sinks into a pocket you can crawl through.'}
  ],
  // Interior: magenta and raspberry stripes, pink haze, mint eyes.
  palettes:[{x:0,main:'#d9469a',secondary:'#8f2a5e',backdrop:'#f2bede',accent:'#8fe8cf',sky:'#efb2d6',fog:'#f6cfe6'}],
  // The tunnel closes in a little (absolute view heights), then opens again
  // toward the parade.
  camera:[{x:0,viewH:10.2},{x:53,viewH:11.6}],
  guides:[]
};
