// Section 1 — The Crooked Garden. LOCAL coordinates: x runs 0..105 and the
// exit deck ends exactly at 105 so the assembler can butt the next section
// against it. ONE idea: the garden looks like any other chapter — terracotta
// clay under green frosting, mushrooms, a pink pool — except that the flowers
// have eyes and watch you. Walk through the crooked arch and the colours flip,
// the ground blinks, the flowers snap, and the first violet clay bars the way.
//
// The entry deck is wider than the other sections' (0..12): the assembler
// places it at -8 as the chapter's `start`, and the spawn at 1.5 (local 9.5)
// stands on it. It carries no flag — the spawn is the chapter's first
// checkpoint, and a flag on the start deck would never fire.
//
// Beats, left to right:
//   · the familiar walk: two stone steps, then two floating pads over a pink
//     pool, up to the arch deck (flag under the bow, where the palette flips)
//   · the flower detour: the mushroom under the arch deck's end bounces you
//     back-left over the gate, through flower 1 hanging in the air above it
//     (there is no perch up there; the bounce's apex is where the flower is),
//     and down onto the arch deck again
//   · the eyes: three pulse pads over the pool that watch you and blink shut —
//     a blink that travels along the row, each pair open together long enough
//     for the hop; the lids droop through the warning window
//   · the snapping flowers: two crumble pads whose petals fold under your feet
//   · the dock (flag) and the flowerbed: a free formable mass on a bench with
//     slime under it. A fat violet bulb at its near end is a wall to walk into
//     and out of any jump's reach; lean it over into a ramp (or build anything
//     else that carries you) and walk the bed to the exit. Clay is ground and
//     the bare bench is not.
//   · the exit deck, with the chapter's first hatworm to stomp
//
// Every number here was checked against the reach table (rise ≤1 → gap 5,
// ≤1.8 → 4.4, ≤2.3 → 3.4, ≤2.6 → 2.6) and the clay-section rules; see the
// notes beside the flowerbed for the ones that are not obvious.
import {p,path} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

// The flowerbed: a free formable mass 13.4 wide on a bench whose top (2.0) is
// the clay's base, with slime sown half a unit under that base so the bare
// bench kills (kill line 2.2). Clump knots are [fraction across, height over
// the mass's y]; -1 on an h:1 piece is zero thickness. The bulb at the near
// end legalises to a crest ≈7.07 (the dock's best reach is 5.70) with a
// vertical near face; the tail is bare from x ≈85.75 on.
//
// Why 13.4 and not 14: the slime band has to span the whole mass, and a
// player standing on the exit deck's left edge (p.x down to 94.68, y 0) must
// be outside it — the hazard test reads p.x-.2 < h.x+h.w. Mass and band both
// end at 94.4, written as the same literals so the comparison is exact; the
// bench itself runs on to 95 so the trough visibly meets the exit deck.
const BED={x:81,w:13.4,y:3,h:1};
// (Clamped: 94.4-81 over 13.4 lands a rounding error past 1 in floating point.)
const K=(x,top)=>[Math.min(1,Math.max(0,(x-BED.x)/BED.w)),top];

export default {
  key:'garden',name:'The Crooked Garden',landmark:'arch',length:105,entryId:'garden-entry',exitId:'garden-exit',
  platforms:[
    p('garden-entry',0,12,0),
    p('garden-step-1',14,4,.8),
    p('garden-step-2',20,6,1.6,'stone',{checkpoint:23}),
    p('garden-float-1',28.5,3,2.8,'ledge'),
    p('garden-float-2',34,3,3.8,'ledge'),
    // The arch deck: the arch stands at 42.75 and the flag under its bow heals
    // at the palette moment.
    p('garden-mound',39,8,4.6,'stone',{checkpoint:43}),
    p('garden-spur',47,3.2,3),
    // The spring's bounce (17.6 up, 27 down, simulation.js) crests 5.74 above
    // the cap — about 9.1 — and, steering left from the moment you leave the
    // deck, 3.5 left of the cap: right under the flower at (43.3, 10.2), the
    // one flower in the game with no perch under it, and back down onto the
    // arch deck. Steer late and the bounce goes straight up and misses it.
    p('garden-shroom',47.4,2.4,3.44,'spring'),
    // The eyes. Period 4.4: open 3.17 s, shut 1.23 s, the last .62 s of open
    // is the warning. Phases -.2 apart make the blink travel along the row;
    // each neighbouring pair is open together 2.29 s a cycle.
    p('garden-eye-1',49,2.6,5.4,'pulse',{period:4.4,duty:.72,phase:0}),
    p('garden-eye-2',54,2.6,6.2,'pulse',{period:4.4,duty:.72,phase:-.2}),
    p('garden-eye-3',59,2.6,5.4,'pulse',{period:4.4,duty:.72,phase:-.4}),
    p('garden-snap-1',64,2.8,6.2,'crumble',{delay:.9}),
    p('garden-snap-2',69.5,2.8,5.4,'crumble',{delay:.85}),
    p('garden-dock',75,6,3,'stone',{checkpoint:78}),
    // The bench the bed lies on: a wall, so the audit never reads it as a deck.
    p('garden-bed-bench',81,14,2,'wall',{h:2.4}),
    part('garden-bed',{...BED},{...BED},{station:'garden-bed',clayRole:'mass'}),
    p('garden-exit',95,10,0)
  ],
  // Dock → bed is a jump: the solved ramp's near end stands 1.09 above the
  // dock, and a walker cannot step up more than .12 onto clay.
  route:['garden-entry','garden-step-1','garden-step-2','garden-float-1','garden-float-2','garden-mound',
    'garden-eye-1','garden-eye-2','garden-eye-3','garden-snap-1','garden-snap-2',['garden-dock','fall'],'garden-bed',['garden-exit','fall']],
  // Flower 1: run off the arch deck's end and you land on the mushroom (a
  // slower step lands on the spur beside it and walks on); its bounce carries
  // you back-left through the flower and down onto the arch deck.
  detours:[path(['garden-mound',['garden-shroom','fall'],'garden-mound'])],
  recoveries:[],
  coins:[{x:16,y:2.4},{x:22,y:3.2},{x:30,y:4.4},{x:35.5,y:5.4},{x:40.5,y:6.2},{x:45.5,y:6.2},
    {x:50.3,y:7},{x:55.3,y:7.8},{x:60.3,y:7},{x:65.4,y:7.8},{x:70.9,y:7},{x:76.5,y:4.6},
    {x:86,y:5.2},{x:90,y:4.8},{x:97,y:1.6},{x:103,y:1.6},{x:42.6,y:10.2},{x:43.8,y:10.2}],
  // In the row with its two beads, at the height both a plain bounce (crest
  // 9.1, chest 9.9) and a jump-held one (crest 9.8) pass within reach of.
  stamps:[{x:43.3,y:10.2}],
  // The chapter's first hatworm walks the exit deck, well clear of the drop
  // from the bed and 7 short of the Folding Path's first flag (local 108).
  enemies:[{kind:'hatworm',x:101,y:0,min:99.5,max:102.5,speed:1.2}],
  // Two pink pools (kill line -.9) and the slime under the flowerbed.
  hazards:[{x:26.5,w:12,y:-1.6},{x:47.5,w:27,y:-1.6},{x:81,w:13.4,y:1.5}],
  hints:[
    {x:0,end:12,icon:'walk',title:"Look who's looking",text:'One flower is watching you. Walk on — the garden leans your way.'},
    {x:40,end:47,icon:'eye',title:"Don't blink",text:'The eyes close. Cross while they watch you — the lids droop first.'},
    {x:47,end:50.2,icon:'mushroom',title:'Up top',text:'A mushroom below the arch deck bounces you up through the flower over the gate.'}
  ],
  winds:[],triggers:[],crushers:[],
  shaping:[
    {id:'garden-bed',rule:'form',free:true,relax:false,shaped:.24,icon:'knead',
     name:'Slump the bulb',verb:'Lean it right',gesture:'right',cueX:82.4,
     parts:['garden-bed'],x:74,end:95,spawn:{x:77,y:3,groundId:'garden-dock'},
     clump:[K(81,3.8),K(83.4,3.8),K(85,-1),K(94.4,-1)],
     // Grab the bulb's crest and lean it right and down into a ramp along the
     // bed; smooth the ramp on; pat the far end up so the last columns stay
     // thick enough to stand on (the solved surface runs 4.09 → 2.73 → 3.08).
     solution:[{x:82,lift:0,dx:6.5,dy:-3.8,t:1.9},{x:87.5,lift:0,dx:6.9,dy:-.6,t:1.8},{x:93.2,lift:0,dx:1.2,dy:.4,t:.7}],
     hint:'A fat violet bulb blocks the bed. Grab it and drag it right and down: lean it over into a ramp along the bed. Clay is ground; the pink slime under it is not. Or face it and hold E to work it into steps. Step off and press R to soften it.'}
  ],
  // The familiar world — terracotta under lime frosting, salmon pillars —
  // already stands under a peach evening sky that hazes to pink at the
  // horizon (the redesign boards); the arch's centre tips it into candy:
  // purple bodies under lime frosting, then hotter and stranger, and by the
  // bed a violet that hands over to the Folding Path's ultramarine and lemon.
  // `sky` is the gradient's top and `fog` its horizon band (dream.js), so the
  // four entries stay in one peach→pink family and the sky never snaps.
  palettes:[
    {x:0,main:'#e07a3c',secondary:'#93c957',backdrop:'#e39a86',accent:'#ec6f9d',sky:'#f9bf95',fog:'#f4b4c6'},
    {x:42.75,main:'#8a3f9e',secondary:'#c9ef5a',backdrop:'#b98ad4',accent:'#f27ab8',sky:'#f4b4a3',fog:'#f0b9d3'},
    {x:62,main:'#7a2f9e',secondary:'#d4f542',backdrop:'#a97cca',accent:'#ff6fc2',sky:'#f5a793',fog:'#f3b5d6'},
    {x:88,main:'#5a3ab8',secondary:'#e2f25c',backdrop:'#b09bd6',accent:'#f75fb6',sky:'#dfa9c9',fog:'#f0bcd8'}
  ],
  camera:[],guides:[]
};
