// Section 9 — The Infinite Room. Local x 0..120: the same room four times,
// each pass wrong in one way — normal (0–30), hung from the ceiling (30–60),
// doll-sized with the player a giant (60–90), turned on end into a shaft
// (90–120) — and the last door is the first door. Door props stand at 1.5,
// 29, 59, 90.5 and 114; each pass's palette entry sits 1 u before its door so
// the 4-u cross-fade never bleeds through a doorway. The peak of the chapter:
// Ember-cadence falls between the furniture, a form trench under a doorway
// the player no longer fits through, and a ladder of pulses and crumbles up
// the stacked drawers with the mobile as a ride and the dumbwaiter down.
import {p,path} from '../../route-authoring.js';

// One formable mass: the floorboards under the doll doorway. Knots are
// [fraction across the piece, height over the piece's top] (clay-form.js adds
// the thickness h itself), so a flat floor is a clump of zeros.
// A thin floor, 1.6 thick: the station has to move more than a sixth of the
// clay before it reads as shaped (tests/clay-sections.mjs), and the spoil of a
// trench that big has to fit on the boards either side of it, so the boards
// are thin and rest .4 below the doll table — the spoil lifts both ends by
// about that much, so the worked floor meets the table and the shaft foot
// level (≈4.02) and the walk on and off it is a step, not a wall. Base at
// 2.0, nails at 1.15 beneath (kill line 1.85; the clay never thins past .35,
// so the floor of any trench stays above 2.35).
const MASS={x:79.5,w:10,y:3.6,h:1.6};
const K=(x,h)=>[(x-MASS.x)/MASS.w,h];

// The pass-1 colours: lavender wall, cream cloth, ultramarine furniture. Used
// twice — at the hut door and again at the last door, which is the same door.
const PASS1={main:'#8f7aa8',secondary:'#f6e9d2',backdrop:'#5d4b78',accent:'#3a46b6',sky:'#b0c4f0',fog:'#d8caf1'};

export default {
  key:'room',name:'The Infinite Room',landmark:'door',length:120,entryId:'room-entry',exitId:'room-exit',
  platforms:[
    // Pass 1 — normal. Up the chair (rung, seat, two back slats), across the
    // floating book, down onto the table. A fall between the furniture is the
    // spilled drink.
    p('room-entry',0,8,0,'stone',{checkpoint:3}),
    p('room-rung',9.5,2,1.6,'ledge'),
    p('room-seat',12.5,5,3.4),
    p('room-slat-1',14,2.2,5.8,'ledge'),
    p('room-slat-2',16.3,2.2,8.2,'ledge'),
    p('room-book',20.5,3,8.6,'lift',{moveY:.6,period:4.2}),
    p('room-table',25,5,6.0),

    // Pass 2 — upside-down dressing. The chair hangs from the ceiling, the
    // pendant lamps stand on the floor as bowls (domes), the table's legs are
    // pillars. The hanging chair's seat carries the third flower.
    p('room-landing-2',30,4,6.0,'stone',{checkpoint:32.5}),
    p('room-lamp-1',35.5,4,4.8,'dome'),
    p('room-lamp-2',41,4,3.6,'dome'),
    p('room-saucer',45.5,2.4,3.6),
    p('room-leg-1',48.5,1.2,5.0),
    p('room-leg-2',51.5,1.2,6.6),
    p('room-hung-seat',50.5,2.4,9.0,'ledge',{optional:true}),
    p('room-leg-3',54.5,1.2,5.0),
    p('room-landing-3',57,3,4.0,'stone',{checkpoint:58.5}),

    // Pass 3 — everything tiny. Doll chairs crumble, teacups blink, the
    // gingham floor is a hazard, and the room's wall has a doll-sized doorway:
    // the violet floorboards have to be pressed down into a trench to crawl
    // through. Bare boards under the clay are nails.
    p('room-chair-1',61.5,2,3.2,'crumble',{delay:1.0}),
    p('room-chair-2',65,2,3.8,'crumble',{delay:.9}),
    p('room-teacup-1',68.5,2,4.4,'pulse',{period:3.2,duty:.6,phase:0}),
    p('room-teacup-2',72,2,4.4,'pulse',{period:3.2,duty:.6,phase:.5}),
    p('room-doll-table',75.5,4,4.0,'stone',{checkpoint:77.5}),
    p('room-floor-mass',MASS.x,MASS.w,MASS.y,'clay',{h:MASS.h,shape:{from:{...MASS},to:{...MASS}},station:'room-floor-mass',clayRole:'mass'}),
    // Underside at 4.9: 1.3 over the unworked boards, so even boots sunk the
    // full .3 into the clay leave the head .1 inside the wall.
    p('room-doll-wall',84,1.2,20,'wall',{h:15.1}),
    p('room-shaft-foot',89.5,5,4.0,'stone',{checkpoint:92}),

    // Pass 4 — the shaft. Ink below; a zig-zag ladder of pulses and crumbles up
    // the stacked drawers, the mobile's lowest saucer as a ride, the dumbwaiter
    // down, and the hut door again at the bottom.
    p('room-s1',96,2.4,6.2,'ledge'),
    p('room-s2',100,2.4,8.4,'pulse',{period:4,duty:.65,phase:0}),
    p('room-s3',96,2.4,10.6,'pulse',{period:4,duty:.65,phase:.5}),
    p('room-s4',100.5,2.4,12.8,'ledge'),
    p('room-mobile',104.5,2.6,13.4,'orbit',{moveX:2.8,moveY:2.8,period:6.4}),
    p('room-s5',108,3.5,16.6,'ledge',{checkpoint:110}),
    p('room-s6',108,2.4,18.8,'pulse',{period:4,duty:.65,phase:.25}),
    p('room-s7',104,2.4,21.0,'crumble',{delay:.55}),
    p('room-top',108.5,3,23.2,'ledge'),
    p('room-dumbwaiter',112,3,17.5,'lift',{moveY:5.7,period:5.4,phase:Math.PI/2}),
    p('room-landing-4',115.5,2.5,11.4,'ledge',{checkpoint:116.5}),
    p('room-d1',112.5,2.4,7.8,'ledge'),
    p('room-d2',116,2.4,4.2,'ledge'),
    p('room-exit',112,8,0)
  ],
  route:['room-entry','room-rung','room-seat','room-slat-1','room-slat-2','room-book',['room-table','fall'],
    ['room-landing-2','walk'],['room-lamp-1','fall'],['room-lamp-2','fall'],'room-saucer','room-leg-1','room-leg-2','room-leg-3',['room-landing-3','fall'],
    ['room-chair-1','fall'],'room-chair-2','room-teacup-1','room-teacup-2','room-doll-table',['room-floor-mass','walk'],['room-shaft-foot','walk'],
    'room-s1','room-s2','room-s3','room-s4',['room-mobile','board'],'room-s5','room-s6','room-s7','room-top',['room-dumbwaiter','board'],'room-landing-4',['room-d1','fall'],['room-d2','fall'],['room-exit','fall']],
  // Flower 3: straight up from the second table leg onto the hanging chair's
  // seat, then a fall onward to the third leg.
  detours:[path(['room-leg-2','room-hung-seat',['room-leg-3','fall']])],
  recoveries:[],
  coins:[
    {x:10.5,y:3.2},{x:15,y:7.4},{x:17.3,y:9.8},{x:22,y:10.4},{x:27,y:7.6},
    {x:36,y:7.6},{x:42,y:6.4},{x:46.7,y:5.8},{x:52.1,y:9},{x:55.1,y:7.4},
    {x:62.5,y:5.4},{x:66,y:6},{x:69.5,y:6.6},{x:73,y:6.6},{x:81,y:6.2},{x:86.5,y:6.2},
    {x:97.2,y:8.2},{x:101.2,y:10.4},{x:97.2,y:12.6},{x:105,y:17.4},{x:109.2,y:20.8},{x:105.2,y:23},{x:113.5,y:13.4}
  ],
  stamps:[{x:51.7,y:10.0}],
  enemies:[
    {kind:'hatworm',x:15,y:3.4,min:13.2,max:16.8,speed:1.4},
    {kind:'blinker',x:38.5,y:9.4,min:36,max:44,bob:.5,speed:1.3},
    {kind:'blinker',x:64,y:8.2,min:61.5,max:67,bob:.5,speed:1.4},
    {kind:'blinker',x:97.5,y:15.6,min:95.5,max:99.5,bob:.5,speed:1.3}
  ],
  hazards:[
    {x:8,w:17,y:-1.5},      // spilled drink under pass 1
    {x:34,w:22,y:-1.2},     // spilled tea under pass 2
    {x:60,w:15.5,y:-1},     // the gingham floor
    {x:79.5,w:10,y:1.15},   // nails under the floorboards (base 2.0; the kill line 1.85 is under the thinnest clay)
    {x:94.5,w:17.5,y:-1}    // ink at the foot of the shaft
  ],
  hints:[
    {x:75,end:89.5,icon:'drop',title:'Press the floor',text:'The room has shrunk and you have not. Press the violet floor down under the tiny doorway — drag it, or hold E — and crawl through. The clay keeps its volume; bare boards beneath it are nails.',touchText:'The room has shrunk and you have not. Drag the violet floor down under the tiny doorway and crawl through. Bare boards beneath the clay are nails.'},
    {x:90,end:96,icon:'jump',title:'Up',text:'Up. Everything else is a fall.'}
  ],
  winds:[],triggers:[],crushers:[],
  shaping:[
    {id:'room-floor-mass',rule:'form',free:true,relax:false,clayRole:'mass',name:'Press the floor',verb:'Press the floor',gesture:'down',icon:'drop',
     parts:['room-floor-mass'],x:75,end:92,spawn:{x:77.5,y:4,groundId:'room-doll-table'},cueX:84,rideable:true,
     clump:[K(79.5,0),K(89.5,0)],
     // Three presses side by side dig a trench under the doorway about 4 wide
     // at the boards' level and 1.25 deep (floor 2.35, flat over 84.25–85.5;
     // ≥2.28 clear under the wall's 4.9 across the player's width); its spoil
     // rises as a hump either side (≤4.5, faces ≤1.7) that runs down to the
     // table and the shaft foot. Moves ≈3.7 u² of the 16.4; `shaped` .17
     // (over twice the lab's .08) so a dab never counts as the work.
     solution:[{x:83.6,lift:0,dx:0,dy:-1,t:1.4},{x:84.6,lift:0,dx:0,dy:-1,t:1.4},{x:85.6,lift:0,dx:0,dy:-1,t:1.4}],shaped:.17,
     hint:'The room has shrunk and you have not. Press the violet floor down under the tiny doorway — drag it, or hold E — and crawl through. The clay keeps its volume; bare boards beneath it are nails.'}
  ],
  palettes:[
    {x:0,...PASS1},
    {x:28,main:'#5f4d8a',secondary:'#efe0d6',backdrop:'#7a6aa8',accent:'#3a46b6',sky:'#b0c4f0',fog:'#c8b6dc'},
    {x:58,main:'#c8b8ea',secondary:'#fbf3ee',backdrop:'#d9cdf0',accent:'#eff05e',sky:'#b0c4f0',fog:'#e8def4'},
    {x:89.5,main:'#2f2a5a',secondary:'#f6e9d2',backdrop:'#3d3878',accent:'#ffe6a8',sky:'#3a2d52',fog:'#4d3f66'},
    {x:113,...PASS1}
  ],
  // Zoom in for the doll pass, out for the shaft, home at the last door. The
  // entry at 0 pins the ordinary framing before the first change (the blend
  // list treats everything before its first entry as already there).
  camera:[{x:0},{x:59,viewH:9.3},{x:89.5,viewH:13.3},{x:117}],
  guides:[]
};
