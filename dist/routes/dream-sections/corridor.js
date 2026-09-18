// Section 4 — The Breathing Corridor. Local x 0..83, a breather with no
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
// Then the windpipe, where the same idea turns upward: four ribs in a rising
// staircase, each a third of a breath behind the one before, so the next is
// always swelling as the one under you sinks — you climb on the inhale instead
// of riding one top. At the head of the climb a shelf runs under a squeezing
// ceiling whose clearance swings 1.0–2.6: a 1.7-tall player is shut out at the
// exhale, so you wait at the shelf's mouth and run through on the inhale, then
// drop to the exit deck that hands over to the Colour River. The three lower
// ribs carry the climb's timing; rib-4 and the shelf overlap at every phase,
// so the breath you have to read is the squeeze's, not two in a row.
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
//   tooth-2 → floor-3 (0): gap .2, fall
//   floor-3 → rib-1 (1.1–2.1): gap 1.0, board at its low
//   rib-1 → rib-2 (2.4–3.6): gap 1.8, worst rise 2.5 a third of a breath apart
//   rib-2 → rib-3 (3.8–5.0): gap 1.8, the same step again
//   rib-3 → rib-4 (5.1–6.1): gap 1.8, the last of the climb
//   rib-4 → shelf (5.8): gap .3, a step down at the rib's high and a .7 hop at
//     its low — the one step in the climb that needs no phase
//   shelf → exit (0): gap 0, a 5.8 drop off its end, well inside the 13 a fall
//     may cost
import {p} from '../../route-authoring.js';
// A posed clay piece: one platform with two poses, worked by its station.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
// The corridor breathes at one tempo; pillars and teeth join it at different
// points of the cycle.
const BREATH=4.4;
export default {
  key:'corridor',name:'The Breathing Corridor',landmark:'throat',length:83,entryId:'corridor-entry',exitId:'corridor-exit',
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
    // whose floor lies 2.2 below the corridor (volume 6 → 6). Drawn as a
    // bridge: that view follows the pose, where a `block` is built once at
    // its first size and would stay a 2 × 3 lump over the spread collider.
    part('corridor-plug',{x:33,w:2,y:0,h:3},{x:30,w:8,y:-2.2,h:.75},{station:'corridor-plug',clayRole:'bridge'}),
    p('corridor-floor-2',38,8,0,'stone',{checkpoint:38.8}),
    // Two teeth breathing in anti-phase over the last trench: board the near
    // one at its low, ride up, hop across as the tops pass each other.
    p('corridor-tooth-1',46.5,1.6,2.4,'wall',{h:4.0,breathe:{dh:1.4,dy:1.4,period:BREATH}}),
    p('corridor-tooth-2',49.2,1.6,2.4,'wall',{h:4.0,breathe:{dh:1.4,dy:1.4,period:BREATH,phase:3.1416}}),
    // --- the windpipe ---------------------------------------------------
    // The landing off the teeth, and the section's last checkpoint: the climb
    // above it is the one place in the corridor a fall costs real ground.
    p('corridor-floor-3',51,7,0,'stone',{checkpoint:53.5}),
    // Four ribs rising out of the cone bed, each a third of a breath (2π/3)
    // behind the one before. Bases planted like the pillars (dy = dh), so only
    // the tops move and a rider rides one up.
    p('corridor-rib-1',59,2.2,1.6,'wall',{h:3.2,breathe:{dh:.5,dy:.5,period:BREATH}}),
    p('corridor-rib-2',63,2.2,3.0,'wall',{h:4.6,breathe:{dh:.6,dy:.6,period:BREATH,phase:2.094}}),
    p('corridor-rib-3',67,2.2,4.4,'wall',{h:6.0,breathe:{dh:.6,dy:.6,period:BREATH,phase:4.189}}),
    p('corridor-rib-4',71,2.2,5.6,'wall',{h:7.2,breathe:{dh:.5,dy:.5,period:BREATH}}),
    // The shelf at the head of the climb, set at 5.8 — inside rib-4's swing
    // rather than above it, so stepping off is a walk down at the rib's high
    // and a .7 hop at its low, possible at every phase. The climb's timing is
    // the three ribs below; the last step is not another lock, because the
    // squeeze past it already asks the player to wait for a breath.
    p('corridor-shelf',73.5,5.5,5.8,'ledge'),
    // The ceiling that squeezes down onto the shelf: underside 6.8–8.4 over a
    // deck at 5.8, so the clearance swings 1.0 (shut to a 1.7-tall player) to
    // 2.6 (open). Anti-phase to rib-4, so the rib that lifts you arrives as
    // the squeeze is still closing — you wait at the mouth rather than
    // walking straight through.
    p('corridor-squeeze',74.8,3.4,11.0,'wall',{h:3.4,breathe:{dh:.8,period:BREATH,phase:3.1416}}),
    p('corridor-exit',79,4,0)
  ],
  route:['corridor-entry','corridor-pillar-1','corridor-pillar-2','corridor-pillar-3',['corridor-floor-1','fall'],['corridor-plug','fall'],'corridor-floor-2','corridor-tooth-1','corridor-tooth-2',['corridor-floor-3','fall'],
    'corridor-rib-1','corridor-rib-2','corridor-rib-3','corridor-rib-4','corridor-shelf',['corridor-exit','fall']],
  detours:[],recoveries:[],
  // …and up the windpipe: one over each rib's high, one on the shelf, and one
  // under the squeeze that baits an early run at it.
  coins:[{x:10.7,y:4},{x:15.2,y:5.2},{x:19.7,y:4},{x:27,y:2},{x:32,y:-.6},{x:34,y:-.6},{x:36,y:-.6},{x:43,y:2},{x:47.3,y:5.6},{x:50,y:5.6},
    {x:60.1,y:3.3},{x:64.1,y:4.8},{x:68.1,y:6.2},{x:72.1,y:7.3},{x:76.5,y:6.5},{x:80.5,y:1.4}],
  stamps:[],
  // A breather: no creatures. The molars are the section's teeth.
  enemies:[],
  // The cone bed under the pillars (their bases stand in it), goo under the
  // plug (the worked pocket floor at −2.2 is a full unit above it), and the
  // teeth's trench.
  // …and the windpipe's own bed, running the length of the rib staircase.
  hazards:[{x:8,w:13.5,y:-1.6},{x:30,w:8,y:-3.2},{x:46,w:5,y:-1.6},{x:58.2,w:14.8,y:-1.6}],
  hints:[
    {x:8,end:21,icon:'lift',title:'Breathe with it',text:'The pillars breathe. Step on as one sinks, ride it up, hop across on the inhale.'},
    {x:22,end:37,icon:'sink',title:'The throat',text:'The throat never opens wide enough. Spread the violet plug — drag it outward, or hold E / KNEAD — until the floor sinks into a pocket you can crawl through.',touchText:'The throat never opens wide enough. Spread the violet plug — drag it outward, or tap KNEAD — until the floor sinks into a pocket you can crawl through.'},
    {x:38,end:46,icon:'drop',title:'Molars',text:'Two teeth bite the floor in turn. Pass under the one that just lifted.'},
    {x:56,end:73,icon:'breathe',title:'The windpipe',text:'The ribs rise in turn, each a beat behind the last. Climb on the inhale.'},
    {x:73,end:79,icon:'drop',title:'The squeeze',text:'The ceiling shuts on the breath out. Wait at the mouth, then run it on the way in.'}
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
  // Interior, after the painting: vermilion bodies (main), crimson-magenta
  // frosting (secondary), plum between (accent), cream eyes, and a pink haze
  // (sky/fog) with dim mauve columns (backdrop) standing in it.
  // The second entry cools the windpipe: the Melted Parade's ultramarine used
  // to carry the eye from this vermilion to the Colour River's mint and lilac,
  // and with the parade gone the corridor makes that turn itself. Only the
  // light, sky and distance move — the tunnel's stripes are fixed reds in
  // dist/dream/corridor.js, so the walls you climb stay the colour they were.
  palettes:[
    {x:0,main:'#dc4b30',secondary:'#be2f64',backdrop:'#986886',accent:'#6e2752',sky:'#e9a6aa',fog:'#e4a2ab'},
    {x:58,main:'#c04046',secondary:'#a8397a',backdrop:'#a294cf',accent:'#7a3a93',sky:'#c2a9d8',fog:'#e3b3ca'}
  ],
  // The ordinary framing: the striped ceiling and its eyes live in the top of
  // the frame, so the corridor does not zoom in.
  camera:[{x:0}],
  guides:[]
};
