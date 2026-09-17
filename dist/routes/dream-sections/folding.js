// Section 2 — The Folding Path. Local x 0..110, rating 2.5.
//
// ONE idea: orientation is negotiable. Decks stand up, walls lie down and a
// ceiling bends into a ramp — and the first fold is one the player causes.
// The violet tongue lies rolled up at the brink like a carpet; pressed, it
// rolls out across the void and, reaching full, latches the channel that
// topples the standing lemon wall beyond into the bridge. Then two beats of free clay,
// each a fold the player makes by hand: a slab under a hanging sheet that has
// to be cast into the fold the pale line draws before the wall beyond it lies
// down, and a violet wall that is laid down into the very floor that carries
// the player on. Landing on the far side stands a floor tile up into a step;
// the second lemon wall topples away as the player runs at it; the ceiling
// block ahead sags into a ramp by itself. No enemies but one slow hatworm on
// the last high deck; four hazard bands; five flags. Every x here is LOCAL —
// the assembler (dist/routes/dream.js) offsets the section, so nothing in
// this file knows where it lands.
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
//   · the route sweep latches every channel before it looks for a way, so a
//     fold a station opens is no gate to it: each free mass is gated by clay
//     alone — the cast slab by a sheet hanging 1.3 over it that only a trench
//     passes under, the wall by its own height (a stomp on the mass throws
//     6.69, so the wall stands 7.2 and the cast fold is 7 wide, hence 7 tall)
import {p} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

// The two free masses: a slab flush with the landing deck, and a thin bed at
// the height of the far deck with a wall of clay standing on its near end.
// Knots are [fraction across, height over the piece's top].
const CAST={x:34.9,w:12,y:0,h:1.5};
const WALL={x:81,w:12,y:4,h:1.6};
const KW=(x,top)=>[(x-WALL.x)/WALL.w,top];

export default {
  key:'folding',name:'The Folding Path',landmark:'tongue',length:110,entryId:'folding-entry',exitId:'folding-exit',
  platforms:[
    p('folding-entry',0,8,0,'stone',{checkpoint:3}),
    // The cliff lip the rolled tongue rests on: the clay's from-pose (bottom
    // at 0) sits on this post, so it never covers a deck anyone stands on.
    p('folding-tongue-post',8,2.4,0,'wall',{h:3}),
    // 3.8 × 3.8 rolled up → 12.4 × 1.161 rolled out (14.44 → 14.4 of clay): a
    // carpet 1.161 thick and 12.4 long wound up is a roll 3.8 across, so the
    // rest pose is the roll's own box and the tongue keeps its thickness and
    // its length at every point between (dist/dream/folding.js draws it so).
    // Rolled, its top stands 3.8 over the entry — past a jump's reach.
    part('folding-tongue',{x:8,w:3.8,y:3.8,h:3.8},{x:8,w:12.4,y:0,h:1.161},{station:'folding-tongue',clayRole:'bridge'}),
    // A lemon wall 20.45–21.35 standing 6 high that falls right into a deck 20.9–26.9.
    p('folding-wall-bridge',20.9,6,0,'fold',{channel:'folding-tongue-out',duration:1.6,pivot:'left',from:'wall',to:'deck'}),
    p('folding-land',26.9,8,0,'stone',{checkpoint:30}),
    // The slab to cast: 12 × 1.6 of violet clay flush with the landing deck,
    // under a sheet hanging 1.3 over it at 37.9–39.1 — a walker is 1.7 tall,
    // so only a trench dug under the sheet passes. The pale mould asks for the
    // trench there and a hump beyond: the fold. Cast, it opens folding-cast.
    part('folding-cast-mass',{...CAST},{...CAST},{h:CAST.h,station:'folding-cast',clayRole:'mass'}),
    p('folding-cast-lintel',37.9,1.2,16,'wall',{h:14.7}),
    // A lemon wall 46.45–47.35 standing 7 high (taller than a stomp on the
    // slab can throw) with its hinge at the slab's end, so it falls right into
    // a deck 46.9–53.9 that meets the cast where the cast ends: the hump's far
    // slope sends a walker off with some fall in them, and a gap here would
    // swallow them.
    p('folding-cast-bridge',46.9,7,0,'fold',{channel:'folding-cast',duration:1.6,pivot:'left',from:'wall',to:'deck'}),
    p('folding-cast-land',53.9,4,0,'stone',{checkpoint:55.5}),
    // The floor tile that stands up into a step as the player lands on folding-cast-land.
    p('folding-step',59.5,2.4,0,'counter',{channel:'folding-a',rise:2.4}),
    p('folding-high',63.5,4,4.2,'ledge'),
    // A wall 68.55–69.45 up to 10.2 that topples away from the runner into a deck 69–75.
    p('folding-fall-bridge',69,6,4.2,'fold',{channel:'folding-b',duration:.6,pivot:'left',from:'wall',to:'deck'}),
    p('folding-far',75,6,4.0,'stone',{checkpoint:77.5}),
    // The wall that lies down: a bed of violet clay 1.2 thick at the far
    // deck's height, its clump a wall 7.2 over the deck on the near end and
    // bare nails beyond. Dragged over, the wall's clay spreads into the floor
    // that carries the player to folding-wall-land — no channel, the clay is
    // the bridge. Too tall to jump, and taller than a stomp on the bed throws.
    part('folding-wall-mass',{...WALL},{...WALL},{h:WALL.h,station:'folding-wall',clayRole:'mass'}),
    p('folding-wall-land',93,5,4.0,'stone',{checkpoint:93.3}),
    // The ceiling: a block hanging 8.1–11.2 that sags into a ramp 98→104 rising
    // 4.0→6.0 on its own once folding-c latches. Terrain, not a puzzle: it is
    // drawn in the section's own colour.
    part('folding-ceiling',{x:98,w:3,y:11.2,h:3.1},{x:98,w:6,y:4.0,h:.6,slope:2},{station:'folding-ceiling',clayRole:'ramp',tint:'terrain'}),
    p('folding-shelf',104,2.5,6.0,'ledge'),
    p('folding-exit',103,7,0,'stone')
  ],
  route:[
    'folding-entry',['folding-tongue','walk'],['folding-wall-bridge','walk'],['folding-land','walk'],
    ['folding-cast-mass','walk'],['folding-cast-bridge','walk'],['folding-cast-land','walk'],
    'folding-step','folding-high','folding-fall-bridge',['folding-far','fall'],
    'folding-wall-mass',['folding-wall-land','walk'],
    ['folding-ceiling','walk'],['folding-shelf','walk'],['folding-exit','fall']
  ],
  detours:[],recoveries:[],
  coins:[
    {x:10,y:2},{x:13,y:2},{x:16,y:2},{x:19,y:2},
    {x:31,y:2},{x:37.5,y:1.4},{x:44,y:3.4},{x:50.4,y:2},
    {x:60.7,y:4.6},{x:65.5,y:6.2},{x:72,y:6.2},
    {x:85,y:6.6},{x:88,y:6.6},{x:91,y:6.6},
    {x:101,y:6.6},{x:105.2,y:8}
  ],
  stamps:[],
  // One slow hatworm on the last high deck: flag at 93.3, patrol 95.4–97.4 (min−.8 > flag, ≥ .5 inside the deck).
  enemies:[{kind:'hatworm',x:96.4,y:4,min:95.4,max:97.4,speed:.8}],
  // The cloud void under the tongue and the first bridge; the nails under the
  // cast slab and the standing wall beyond it; the step pit; the bridge pit;
  // the nails under the wall's bed.
  // A band .65 under a mass's base puts the kill line .05 over it, so bare
  // footing on a free mass kills and clay a third of a unit thick is safe.
  hazards:[{x:8,w:18.9,y:-2.5},{x:34.9,w:19,y:-2.15},{x:57.9,w:5.6,y:-2},{x:67.5,w:7.5,y:-2},{x:81,w:12,y:1.75}],
  hints:[
    {x:2,end:20,icon:'bridge',title:'The rolled tongue',text:'The violet tongue is rolled up at the brink. Press it down — drag it, or hold E / KNEAD — and it rolls out across the gap like a carpet. What it touches, it topples.'},
    {x:27,end:47,icon:'drop',title:'Fold the path',text:'The pale line is a mould shaped like a fold. Press the clay down under the hanging sheet and pull it up beyond, until it lies along the line — it turns green, and the wall ahead topples into the path.'},
    {x:57.9,end:63.5,icon:'walk',title:'Still deciding',text:'Wait — the path is still deciding what it is.'},
    {x:75,end:93,icon:'bridge',title:'Lay the wall down',text:'A violet wall stands where the path should be. Grab its top and drag it over: it lies down across the gap and keeps its volume, so what stood tall now runs long. Bare boards beneath it are nails.'}
  ],
  winds:[],
  triggers:[
    // As you land on folding-cast-land the tile ahead stands up.
    {id:'folding-trig-a',x:55.5,w:1.5,y:0,h:3,channel:'folding-a'},
    // On the high ledge: the wall ahead topples as you run at it.
    {id:'folding-trig-b',x:63.5,w:1.5,y:4.2,h:3,channel:'folding-b'},
    // On the laid-down wall: the ceiling starts bending ≈1.6 s before you reach it.
    // A tall zone, since the clay it stands over is whatever height the hand left it.
    {id:'folding-trig-c',x:87,w:1.5,y:1.5,h:9,channel:'folding-c'}
  ],
  crushers:[],
  shaping:[
    {id:'folding-tongue',name:'Roll the tongue out',verb:'Press down',gesture:'down',icon:'bridge',parts:['folding-tongue'],
     x:4,end:21,spawn:{x:5,y:0,groundId:'folding-entry'},cueX:7.6,channel:'folding-tongue-out',
     hint:'The violet tongue is rolled up at the brink. Press it down — drag it, or hold E / KNEAD — and it rolls out across the gap like a carpet. What it touches, it topples.'},
    // Cast the fold. The slab starts flat and flush with the deck; the mould
    // is a trench under the hanging sheet and a hump past it, holding the
    // slab's own volume, so every bit of the cast is already in the clay. The
    // cast opens folding-cast, and done stays done.
    {id:'folding-cast',rule:'form',free:true,relax:false,shaped:.165,rideable:true,name:'Fold the path',verb:'Shape it to the outline',gesture:'down',icon:'drop',
     parts:['folding-cast-mass'],x:27,end:47.3,spawn:{x:30,y:0,groundId:'folding-land'},cueX:40.9,
     clump:[[0,0],[1,0]],
     mould:[[0,-.1],[.083,.13],[.167,-.55],[.25,-.75],[.333,-.88],[.417,-.97],[.5,-.43],[.583,-.15],[.667,.22],[.75,.96],[.833,1.26],[.917,1.11],[1,.03]],
     channel:'folding-cast',message:'Cast · the wall lies down',
     solution:[{x:43.2,lift:0,dx:0,dy:1.45,t:1.4},{x:44.9,lift:0,dx:0,dy:1.3,t:1.3},{x:37.2,lift:1,dx:0,dy:-.85,t:.7},{x:37.2,lift:.82,dx:2.8,dy:0,t:1.6},{x:46.4,lift:0,dx:0,dy:.9,t:.8}],
     hint:'The pale line is a mould shaped like a fold. Press the clay down under the hanging sheet and pull it up beyond, until it lies along the line — it turns green, and the wall ahead topples into the path.'},
    // Lay the wall down. A wall of violet clay stands on the near end of a
    // thin bed over nails; grabbed at the top and dragged over it spreads
    // into the floor across to folding-wall-land. Nothing latches: the clay
    // itself is the way on.
    {id:'folding-wall',rule:'form',free:true,relax:false,shaped:.24,rideable:true,name:'Lay the wall down',verb:'Grab it and drag',gesture:'down',icon:'bridge',
     parts:['folding-wall-mass'],x:75,end:93,spawn:{x:77.5,y:4,groundId:'folding-far'},cueX:83.2,
     clump:[KW(81,0),KW(82.9,6.6),KW(84.9,6.6),KW(85.9,-1.6),KW(93,-1.6)],
     solution:[{x:83.9,lift:0,dx:7,dy:-6,t:2.8},{x:88,lift:0,dx:4.5,dy:-1.5,t:1.6},{x:82.9,lift:0,dx:-1.4,dy:-1,t:1},{x:90,lift:0,dx:2.6,dy:-.3,t:1}],
     hint:'A violet wall stands where the path should be. Grab its top and drag it over: it lies down across the gap and keeps its volume, so what stood tall now runs long. Bare boards beneath it are nails.'},
    // Self-working terrain, not a purple beat: no hint, and its stretch is the
    // ramp itself, which is finished before anyone can stand there, so the
    // gesture cue never shows for it.
    {id:'folding-ceiling',name:'The ceiling bends',verb:'Watch',gesture:'down',icon:'ramp',hint:'The ceiling bends into a ramp on its own once the laid wall is crossed.',parts:['folding-ceiling'],
     x:98,end:104,spawn:{x:95,y:4,groundId:'folding-wall-land'},cueX:99.5,auto:'folding-c'}
  ],
  // Plum bodies under lime frosting, a pink-lilac haze, hot pink accents: the
  // reference's candy cliffs. The workable clay keeps its own blue-violet.
  palettes:[{x:0,main:'#9a48b0',secondary:'#cbe24f',backdrop:'#dcb3ef',accent:'#ff5fae',sky:'#c8a9ea',fog:'#f4c4de'}],
  camera:[],guides:[]
};
