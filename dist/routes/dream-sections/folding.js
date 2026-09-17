// Section 2 — The Folding Path. Local x 0..70, rating 2.5.
//
// ONE idea: orientation is negotiable. Decks stand up, walls lie down and a
// ceiling bends into a ramp — and the first fold is one the player causes.
// The violet tongue stands folded on end at the brink; pressed down it lies
// out across the void and, reaching full, latches the channel that topples
// the standing lemon wall beyond into the bridge. Landing on the far side
// stands a floor tile up into a step; the second wall topples away as the
// player runs at it; the ceiling block ahead sags into a ramp by itself. No
// enemies but one slow hatworm on the far deck; three hazard bands; three
// flags. Every x here is LOCAL — the assembler (dist/routes/dream.js)
// offsets the section, so nothing in this file knows where it lands.
//
// Verified against the engine (see design/final.md §0):
//   · only wall→deck folds sit on the route (a fold's wall pose is not
//     standable); the deck→wall "path closes like a book" is a backdrop
//     prop animated by dist/dream/folding.js
//   · the counter step rises 2.4 at dt·1.8 (≈1.3 s), so an early jumper meets
//     a lower step, still within the 2.6 rise a jump clears
//   · a .4 lip is a wall to a walking player (the clay push starts at .12), so
//     the tongue lies out level with the entry at y 0, and the first fold and
//     folding-land sit at y 0 with it — the spec's .4 offsets are dropped
//   · fold-b topples in .6 s (spec .8): the crossing sweep gives a channel one
//     tick before the jump, and a takeoff from the ledge end has to stay short
//     of the standing panel until it has passed upright
import {p} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

export default {
  key:'folding',name:'The Folding Path',landmark:'tongue',length:70,entryId:'folding-entry',exitId:'folding-exit',
  platforms:[
    p('folding-entry',0,8,0,'stone',{checkpoint:3}),
    // The cliff lip the folded tongue stands on: the clay's from-pose (bottom
    // at 0) rests on this post, so it never covers a deck anyone stands on.
    p('folding-tongue-post',8,2.4,0,'wall',{h:3}),
    // 2.4 × 6 standing on end → 12.4 × 1.161 lying out (14.4 → 14.4 of clay).
    part('folding-tongue',{x:8,w:2.4,y:6,h:6},{x:8,w:12.4,y:0,h:1.161},{station:'folding-tongue',clayRole:'bridge'}),
    // A lemon wall 20.45–21.35 standing 6 high that falls right into a deck 20.9–26.9.
    p('folding-wall-bridge',20.9,6,0,'fold',{channel:'folding-tongue-out',duration:1.6,pivot:'left',from:'wall',to:'deck'}),
    p('folding-land',26.9,8,0,'stone',{checkpoint:30}),
    // The floor tile that stands up into a step as the player lands on folding-land.
    p('folding-step',36.5,2.4,0,'counter',{channel:'folding-a',rise:2.4}),
    p('folding-high',40.5,4,4.2,'ledge'),
    // A wall 45.55–46.45 up to 10.2 that topples away from the runner into a deck 46–52.
    p('folding-fall-bridge',46,6,4.2,'fold',{channel:'folding-b',duration:.6,pivot:'left',from:'wall',to:'deck'}),
    p('folding-far',52,6,4.0,'stone',{checkpoint:54.5}),
    // The ceiling: a block hanging 8.1–11.2 that sags into a ramp 58→64 rising
    // 4.0→6.0 on its own once folding-c latches. Terrain, not a puzzle: it is
    // drawn in the section's own colour.
    part('folding-ceiling',{x:58,w:3,y:11.2,h:3.1},{x:58,w:6,y:4.0,h:.55,slope:2},{station:'folding-ceiling',clayRole:'ramp',tint:'terrain'}),
    p('folding-shelf',64,2.5,6.0,'ledge'),
    p('folding-exit',63,7,0,'stone')
  ],
  route:[
    'folding-entry',['folding-tongue','walk'],['folding-wall-bridge','walk'],['folding-land','walk'],
    'folding-step','folding-high','folding-fall-bridge',['folding-far','fall'],
    ['folding-ceiling','walk'],['folding-shelf','walk'],['folding-exit','fall']
  ],
  detours:[],recoveries:[],
  coins:[
    {x:10,y:2},{x:13,y:2},{x:16,y:2},{x:19,y:2},
    {x:31,y:2},{x:37.7,y:4.6},{x:42.5,y:6.2},{x:48.5,y:6.2},{x:61,y:6.6},{x:65.2,y:8}
  ],
  stamps:[],
  // One slow hatworm on the far deck: flag at 54.5, patrol 56.2–57.5 (min−.8 > flag, ≥ .5 inside the deck).
  enemies:[{kind:'hatworm',x:56.8,min:56.2,max:57.5,speed:.8}],
  // The cloud void under the tongue and the first bridge, the step pit, the bridge pit.
  hazards:[{x:8,w:18.9,y:-2.5},{x:34.9,w:5.6,y:-2},{x:44.5,w:7.5,y:-2}],
  hints:[
    {x:2,end:20,icon:'bridge',title:'The folded tongue',text:'The violet tongue is folded up. Press it down — drag it, or hold E / KNEAD — and it lies out across the gap. What it touches, it topples.'},
    {x:27,end:40,icon:'walk',title:'Still deciding',text:'Wait — the path is still deciding what it is.'}
  ],
  winds:[],
  triggers:[
    // As you land on folding-land the tile ahead stands up.
    {id:'folding-trig-a',x:28,w:1.5,y:0,h:3,channel:'folding-a'},
    // On the high ledge: the wall ahead topples as you run at it.
    {id:'folding-trig-b',x:40.5,w:1.5,y:4.2,h:3,channel:'folding-b'},
    // On the fallen bridge: the ceiling starts bending ≈1.6 s before you reach it.
    {id:'folding-trig-c',x:47,w:1.5,y:4.2,h:3,channel:'folding-c'}
  ],
  crushers:[],
  shaping:[
    {id:'folding-tongue',name:'Lay the tongue out',verb:'Press down',gesture:'down',icon:'bridge',parts:['folding-tongue'],
     x:4,end:21,spawn:{x:5,y:0,groundId:'folding-entry'},cueX:7.6,channel:'folding-tongue-out',
     hint:'The violet tongue is folded up. Press it down — drag it, or hold E / KNEAD — and it lies out across the gap. What it touches, it topples.'},
    // Self-working terrain, not a purple beat: no hint, and its stretch is the
    // ramp itself, which is finished before anyone can stand there, so the
    // gesture cue never shows for it.
    {id:'folding-ceiling',name:'The ceiling bends',verb:'Watch',gesture:'down',icon:'ramp',parts:['folding-ceiling'],
     x:58,end:64,spawn:{x:55,y:4,groundId:'folding-far'},cueX:59.5,auto:'folding-c'}
  ],
  // Ultramarine bodies, lemon frosting, lilac haze, one magenta accent.
  palettes:[{x:0,main:'#3f4dc7',secondary:'#f2ee74',backdrop:'#cfb6ee',accent:'#ee52ad',sky:'#a6aee2',fog:'#f0c2d2'}],
  camera:[],guides:[]
};
