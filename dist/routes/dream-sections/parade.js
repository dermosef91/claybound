// Section 5 — The Melted Parade. Local x 0..75, a breather (rating 2).
//
// ONE idea: a parade frozen mid-step wakes one member at a time. You climb
// the giraffe (knee, back, neck, flower head), uncoil the hat-worm asleep on
// its head — the violet pull station — and the stretched worm is the bridge
// over the melted-paint pit. Reaching full nudges the caterpillar awake
// (channel `parade-wake`): a lift that rests under the bridge's end and then
// shuttles right to the hand. Riding it crosses a trigger that opens the hand
// (`parade-hand`): the closed fist beyond the palm is an auto stairs station
// that unfolds into a stair up to the fingertips, where the tiny house rides;
// the exit is a fall from the house onto the parade ground.
//
// Movers (dist/simulation.js): a waitFor lift rests at its base pose until the
// channel latches, then a = run·2π/period + phase, x = baseX + sin(a)·moveX.
// Base 45, moveX 4.5, phase −π/2 → rests at 40.5–45, far stop 49.5–54 at
// 4.5 s, back at 9 s. `board` and `ride` links hand the lift to the pilot's
// machine transfer, which waits for it to come round.
import {p,row,path} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

export default {
  key:'parade',name:'The Melted Parade',landmark:'giraffe',length:75,entryId:'parade-entry',exitId:'parade-exit',
  platforms:[
    // The parade ground: ultramarine plaza under the bodiless boots, then the
    // giraffe's stand. Ground runs to the pit's edge so a slip off the giraffe
    // is a walk back to its knee, not a death (the giraffe's decks are ledges,
    // so the stone beneath them is legal and nothing stands inside a body).
    p('parade-entry',0,8,0,'stone',{checkpoint:3}),
    p('parade-ground-1',8,8,0),
    p('parade-ground-2',16,15.2,0),
    // The giraffe, climbed leg to head: rises of 2.0 / 2.0 / 2.2 / 2.0.
    p('parade-knee',17,1.6,2,'ledge'),
    p('parade-back',19,7,4,'ledge'),
    p('parade-neck',27,1.6,6.2,'ledge'),
    p('parade-head',28.8,2.4,8.2,'ledge'),
    // The hat-worm, coiled on a plinth beside the head: 2.5 × 6.4 = 16.0 of
    // clay, pulled right into a 9.6 × 1.667 bridge (16.0) whose top is a .4
    // step down from the head and whose end (40.8) hangs over the resting
    // caterpillar. (The spec's 10.4 was .1 too long: a standing held jump
    // from the bridge's middle — the pilot's boarding move — travels ~5.4 and
    // came down on the bridge's last hand-span.) Its channel wakes the lift.
    part('parade-worm',{x:31.2,w:2.5,y:14.2,h:6.4},{x:31.2,w:9.6,y:7.8,h:16/9.6},{station:'parade-worm',clayRole:'bridge'}),
    // The caterpillar: asleep under the bridge's end, then shuttling to the hand.
    p('parade-caterpillar',45,4.5,3.6,'lift',{moveX:4.5,period:9,phase:-Math.PI/2,waitFor:'parade-wake'}),
    // The hand: palm (flag), the fist that opens into a stair, the fingertips.
    p('parade-palm',54.5,5,4.4,'stone',{checkpoint:57}),
    part('parade-fingers',{x:59.5,w:2.2,y:12.2,h:7.8},{x:59.5,w:8.6,y:4.4,h:2,slope:3.2},{station:'parade-fingers',clayRole:'stairs',tint:'terrain'}),
    p('parade-house',68.1,2.9,7.6,'ledge'),
    p('parade-exit',69,6,0)
  ],
  route:[
    'parade-entry','parade-ground-1',['parade-ground-2','walk'],'parade-knee','parade-back','parade-neck','parade-head',
    ['parade-worm','walk'],['parade-caterpillar','board'],['parade-palm','ride'],
    ['parade-fingers','walk'],['parade-house','walk'],['parade-exit','fall']
  ],
  detours:[],
  // Off the giraffe onto its stand: back up by the knee.
  recoveries:[path(['parade-ground-2','parade-knee'])],
  coins:[
    {x:10,y:1.6},{x:13,y:1.6},{x:21.5,y:5.6},{x:24.5,y:5.6},{x:30,y:10},
    {x:34.5,y:9.4},{x:38.5,y:9.4},{x:47,y:6},{x:63,y:7.8},{x:66,y:9.6}
  ],
  stamps:[],
  // Two hat-worms on the ground and the giraffe's back, one eye over the ride:
  // its lane's low point (7.7) clears a rider's head (5.3) and a tapped hop for
  // the bead at (47, 6); a held jump off the lift clips it.
  enemies:[
    {kind:'hatworm',x:12,y:0,min:10,max:14.5,speed:1.3},
    {kind:'hatworm',x:22.5,y:4,min:20,max:25,speed:1.2},
    {kind:'blinker',x:49,y:8,min:46,max:52,bob:.4,speed:1}
  ],
  // Melted paint under the bridge and the ride, and under the opening hand.
  hazards:[{x:31.2,w:23.3,y:-2},{x:59.5,w:9.5,y:-2.5}],
  hints:[{x:8,end:17,icon:'jump',title:'Frozen mid-step',text:'The parade is asleep. Climb the giraffe.'}],
  winds:[],
  // Crossed while riding: anyone who can reach the palm from the lift (its
  // right edge at 49.5 or beyond) has overlapped 48–51.5 on the way.
  triggers:[{id:'parade-trig-hand',x:48,w:3.5,y:3.6,h:3,channel:'parade-hand'}],
  crushers:[],
  shaping:[
    {id:'parade-worm',name:'Uncoil the hat-worm',verb:'Pull right',gesture:'right',icon:'bridge',parts:['parade-worm'],x:27,end:42,
     spawn:{x:29.6,y:8.2,groundId:'parade-head'},cueX:31.6,channel:'parade-wake',
     // Head (ends 31.2, y 8.2) → the resting caterpillar (40.5, y 3.6): 9.3
     // over a 4.6 drop, beyond any jump; the coil's top is 6 above the head.
     bypass:{from:'parade-head',to:'parade-caterpillar',mode:'jump'},
     hint:'The hat-worm is coiled up asleep. Pull its violet tail to the right — drag it, or hold E / KNEAD — and it stretches over the pit… and nudges the caterpillar awake.'},
    {id:'parade-fingers',name:'The hand opens',verb:'Wakes on its own',gesture:'out',icon:'stairs',hint:'The giant hand opens into a stair on its own as the caterpillar carries you past.',parts:['parade-fingers'],x:54.5,end:69,
     spawn:{x:57,y:4.4,groundId:'parade-palm'},cueX:60.6,auto:'parade-hand'}
  ],
  // Ultramarine parade ground, cream statues with one bubblegum detail each,
  // lilac distance under a periwinkle sky.
  palettes:[{x:0,main:'#3b4bc2',secondary:'#f7ebcf',backdrop:'#d9bdf0',accent:'#ff6fb8',sky:'#b5a3f1',fog:'#ead0f2'}],
  camera:[{x:6,viewH:12.8},{x:72,viewH:11.6}],
  guides:[]
};
