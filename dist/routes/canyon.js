import {chapter,p,row,path} from '../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
// The chapter is built around a valley. The caravan starts on a plateau and
// steps down off it; the sinking sandstone carries that descent to the canyon
// floor; the Sandwright's Pocket sits in the dry riverbed at the bottom, a
// third of the way along; and everything after it climbs, steeply and for a
// long time, to the summit. Wind belongs to the climb alone — no windwell
// turns before the riverbed — and the Great Arch stands with its cave up
// against the peak. The ropeway off the summit is the way down, and the only
// way to the bell.
//
// Through layout 9 this was one continuous uphill from y 0 to y 22: the
// windwell taught first, the clay pocket at mid-height, the bell on the last
// and highest roof. The walk had a gradient but no silhouette. Layout 10 is
// the same set of rooms reprofiled around the riverbed, which is why the deck
// ids, the widths and the pocket's own numbers are the ones they always were.
//
// Coordinates are authored final: there is no `makeRoom` seam here, because
// nothing is being opened up inside a finished chapter.
const L={
  layoutVersion:10,
  name:'The Sunbaked Canyon',short:'Sunbaked Canyon',label:'Riverbed & ropeway',biome:'desert',
  intro:'Down off the plateau to the clay riverbed, then up the long wall to the ropeway.',
  sky:'#80afe0',fog:'#f1bba0',spawn:{x:1.5,y:13},end:354,previousDistance:1175,cameraY:2,
  sections:[
    {x:-8,name:'The Caravan Steps',landmark:'arch'},
    {x:46,name:'The Sinking Shortcut',landmark:'sandwheel'},
    {x:92,name:"The Sandwright's Pocket",landmark:'sandwheel'},
    {x:126,name:'Wake the Windwell',landmark:'windmill'},
    {x:174,name:'The Sky-Sand Run',landmark:'windmill'},
    {x:220,name:'Inside the Great Arch',landmark:'arch',quiet:true},
    {x:270,name:'The Summit Ropeway',landmark:'bellgate'}
  ],
  platforms:[
    // --- the plateau, and the steps down off it -------------------------------
    // Every landing here is a little lower than the last. The chapter opens by
    // teaching that down is the way on, which is what makes the climb after the
    // riverbed read as a climb rather than as more of the same.
    p('start',-8,18,13),
    p('lift1',12,4,12.1,'lift',{moveY:.85,period:4.8,phase:-1.57}),
    p('arrival',18,6,11.2),
    p('notch',26,3.8,10.1,'ledge'),
    p('rope-cross',32,4,9.4,'lift',{moveX:1.1,period:5.2}),
    p('lookout',38,5,8.5,'stone',{checkpoint:40,landmark:'arch',rest:true}),
    // --- the sinking sandstone, carrying the descent to the floor -------------
    p('basin',46,7,7.6,'stone',{checkpoint:48,landmark:'sandwheel'}),
    p('sand1',55,3.8,6.6,'crumble',{delay:1.2}),
    p('sand2',61,3.6,5.6,'crumble',{delay:1}),
    p('sand3',67,3.8,4.8,'crumble',{delay:.9}),
    p('sand-rest',73,5,4.2),
    p('sand4',80,3.6,3.4,'crumble',{delay:1}),
    p('sand5',86,3.8,2.8,'crumble',{delay:.9}),
    // --- the riverbed: the pocket, moved down whole ---------------------------
    // The block below is the Sandwright's Pocket exactly as it was authored,
    // lowered eight units and carried to the valley floor. Every relationship
    // inside it is preserved: the shelf fills the chasm to 2.15 below the dock,
    // the spikes lie half a unit under the clay's base, and nothing here can be
    // jumped. Bare sandstone kills and any clay at all is safe.
    p('pocket-dock',92,9.3,2.75,'stone',{checkpoint:97,landmark:'sandwheel'}),
    p('pocket-floor',101.3,17.2,.6,'wall',{h:6.6}),
    part('pocket-clay',{x:101.3,w:17.2,y:2.75,h:2.15},{x:101.3,w:17.2,y:2.75,h:2.15},{station:'canyon-pocket',clayRole:'mass'}),
    p('pocket-landing',118.5,7.5,6.2,'stone',{checkpoint:122}),
    // --- the climb begins, and with it the wind -------------------------------
    p('windwell',128,7,6.2,'stone',{checkpoint:130,landmark:'windmill',rest:true}),
    p('valve1',132,1.8,6.33,'switch',{channel:'wind-a',latch:true}),
    p('wind-step',137,4,7.6,'ledge'),
    p('wind-crown',142,4,12,'ledge'),
    p('wind-turn',137.25,4.5,13.65,'ledge'),
    p('wind-exit',147,6,13.4),
    p('wind-gondola',154,4,14.5,'lift',{moveX:1.15,moveY:.55,period:5}),
    p('upstep',160,3.6,16,'ledge'),
    p('rest-bank',166,7.65,16.8,'stone',{checkpoint:168,rest:true}),
    // --- the sky-sand run, the steep middle of the wall -----------------------
    p('last-well',176,6,17.4,'stone',{landmark:'windmill'}),
    p('valve2',179,1.8,17.53,'switch',{channel:'wind-b',latch:true}),
    p('clay-1',184,4,18.4,'crumble'),
    p('sky-lift',190,4,20.4,'lift',{moveY:1,period:5.2,phase:-.8}),
    p('sky2',197,4,23.8,'ledge'),
    p('sky-rest',203,5,24.4,'stone',{checkpoint:205}),
    p('sky-sand',210,3.7,25.1,'crumble',{delay:1}),
    p('sky-rope',216,4,25.9,'lift',{moveX:.7,moveY:.65,period:4.8}),
    // --- the rope bridge into the arch, and the cave climb --------------------
    // The bridge crossing now leads *into* the cave rather than out of it, so
    // the arch is met at its mouth and climbed through to the roof. The cave
    // shell follows `arch-entry` and `arch-roof` on its own (great-arch.js), so
    // moving the pair up here brings the backdrop with them.
    p('arch-bridge-left',221,1.1,25.4),
    p('arch-drop',222.1,5.65,25.46,'bridge'),
    p('arch-bridge-right',227.75,1.15,25.4),
    p('arch-entry',230,13,26.6,'stone',{checkpoint:236,landmark:'arch',rest:true}),
    p('arch-shelf',245,4,27.8,'ledge'),
    p('arch-lift',251,4,29.4,'lift',{moveY:2.2,period:5.8,phase:-1.57}),
    p('arch-balcony',257,4,32.2,'ledge'),
    p('arch-roof',263,6,33.2),
    // --- the summit, and the ropeway down -------------------------------------
    // The trolley hangs off the summit's shoulder. It runs sixty units out and
    // twenty-four down, which is far past the fall the chapter would otherwise
    // allow — the ride is exempt while it carries someone, and the deck it sets
    // them on carries a flag of its own so the exemption has somewhere to land.
    p('summit',272,9,34.6,'stone',{checkpoint:275,landmark:'arch',rest:true}),
    p('zip-trolley',281.5,2.6,34.6,'zip',{travel:60,drop:24,duration:4.5}),
    p('bell-roof',342,15,10.2,'stone',{goal:true,timber:true,checkpoint:344,landmark:'bellgate'}),
    // --- the three flower ledges ----------------------------------------------
    p('basin-flower',61.5,3.2,3.1,'ledge',{optional:true}),
    p('well-flower',133.25,3.2,15.4,'ledge',{optional:true}),
    p('arch-flower',248.75,2.5,33.95,'ledge',{optional:true}),
    p('clay-2',253.75,2.25,34.2,'crumble')
  ],
  route:['start','lift1','arrival','notch','rope-cross',['lookout','walk'],
    'basin','sand1','sand2','sand3','sand-rest','sand4','sand5',
    'pocket-dock','pocket-clay','pocket-landing',
    'windwell',['valve1','walk'],'wind-step','wind-crown','wind-exit','wind-gondola','upstep','rest-bank',
    'last-well',['valve2','walk'],'clay-1','sky-lift','sky2','sky-rest','sky-sand','sky-rope',
    ['arch-bridge-left','fall'],['arch-drop','walk'],['arch-bridge-right','walk'],'arch-entry',
    'arch-shelf','arch-lift','arch-balcony','arch-roof','summit',
    ['zip-trolley','board'],['bell-roof','ride']],
  detours:[
    path(['wind-crown','wind-turn','well-flower','wind-turn','wind-crown','wind-exit']),
    path(['sand2',['basin-flower','fall'],'sand3']),
    path(['arch-balcony','clay-2','arch-flower','clay-2','arch-balcony','arch-roof'])
  ],
  recoveries:[],
  // Both wells stand on the climb. Nothing before the riverbed blows at all,
  // which is what makes the first valve read as the moment the chapter turns —
  // and it is why the old chapter's loose tailwind is not here: a draught over
  // the riverbed would both contradict that and lean on the player exactly
  // where the pocket asks them to stand still and work.
  winds:[
    {id:'well-a',x:135,w:12,y:5.4,h:10,fx:0,fy:19,channel:'wind-a'},
    {id:'well-b',x:182,w:19,y:15.8,h:11,fx:3,fy:18,channel:'wind-b'}
  ],
  circuits:[
    {source:'valve1',channel:'wind-a',targets:['wind-step','wind-crown'],kind:'wind'},
    {source:'valve2',channel:'wind-b',targets:['sky2'],kind:'wind'}
  ],
  coins:[
    {x:10.75,y:14},{x:14,y:13.5},{x:17.5,y:13},{x:28,y:11.4},{x:40.5,y:9.6},
    ...row(56,7.7,2),...row(62,6.7,2),...row(68,5.9,2),...row(81,4.5,2),...row(87,3.9,2),
    {x:94.25,y:4.2},...row(104.3,5.2,3,1.3),{x:116.5,y:8.3},{x:120.5,y:7.6},{x:123,y:7.6},
    {x:129.25,y:7.3},{x:139,y:9.25},{x:140.5,y:11.35},{x:144.25,y:12.9},...row(155,15.9,2),
    ...row(167.5,17.9,3),{x:185.75,y:19.5},...row(191.5,21.8,2),{x:198.75,y:24.9},{x:204,y:25.5},
    ...row(223.5,26.6,3),...row(237,27.9,3),{x:252.5,y:30.6},{x:258.75,y:33.3},{x:265,y:34.3},
    {x:274.5,y:35.7},...row(345,11.4,3,1.25)
  ],
  stamps:[{x:63.1,y:4.1},{x:134.85,y:16.4},{x:250,y:34.95}],
  // The drifters keep to the roomy banks, as they did before: an arrival deck,
  // a rest in the sinking run, a bank on the climb and the arch's roof. None of
  // them stands over a flag, and no crossing depends on bouncing off one.
  enemies:[
    {kind:'drifter',x:21,y:11.95,min:19.2,max:22.8,speed:.85,bob:.16,period:5.2,phase:0},
    {kind:'drifter',x:75.5,y:4.95,min:74,max:77,speed:.95,bob:.18,period:4.8,phase:1.1},
    {kind:'drifter',x:171.5,y:17.55,min:170.5,max:173,speed:.8,bob:.15,period:5.6,phase:1.5},
    {kind:'drifter',x:266,y:33.95,min:264.5,max:267.5,speed:1.05,bob:.2,period:4.5,phase:2.2}
  ],
  // Spikes lie well under the line the route walks, in the gaps it jumps.
  hazards:[
    {x:10,w:8,y:8.6},{x:24,w:14,y:7},{x:51,w:50,y:.3},{x:101.3,w:17.2,y:.1},
    {x:150,w:9,y:11.4},{x:186,w:20,y:15},{x:213,w:6,y:22},{x:246,w:16,y:25.4}
  ],
  shaping:[],
  hints:[
    {x:0,end:9,icon:'walk',title:'Move and jump',text:'A / D or arrows to move. Hold jump to leap.'},
    {x:46,end:55,icon:'sink',title:'Crumbling ledges',text:'Cracked ledges crumble. Keep moving — they carry you down to the riverbed.'},
    {x:128,end:136,icon:'updraft',title:'Activate wind',text:'Step on the valve. From here the wells blow, and the wind lifts your jumps.'},
    {x:272,end:284,icon:'bell',title:'Ride the ropeway',text:'Step onto the trolley. Your weight sends it down the cable to the bell.',
      touchText:'Step onto the trolley. Your weight sends it down the cable to the bell.'}
  ],
  guides:[{platformId:'wind-crown',offset:.55,dir:-1},{platformId:'arch-balcony',offset:.55,dir:-1},{platformId:'arch-balcony',offset:3.4,dir:1}]
};

// --- The Sandwright's Pocket ---------------------------------------------------
// One mass of clay, formable the way the lab's lump is — no pose, only a surface
// the hand drags where it likes — sitting free on a sandstone shelf that fills
// the riverbed from its floor up to 2.15 below the dock. It rests as two towers
// with a skim of clay over the pit between them: a spire flush with the dock's
// end, a unit out of a jump's reach and a wall to walk into, and a lump against
// the landing's cliff, cresting a unit above the landing. The shelf is sown with
// spikes half a unit below the clay's base, so bare sandstone kills and any clay
// at all is safe. Nothing here can be jumped; the pocket opens only once the
// clay is worked, and any shape that carries the player counts.
// A knot is placed by the world x it stands at, as a share of the mass's width.
// Rounded, because the last knot sits exactly on the far end and the division
// that puts it there lands a whisker past 1 in binary.
const K=(x,top)=>[Math.round((x-101.3)/17.2*1e6)/1e6,top];
L.shaping.push(
  {id:'canyon-pocket',rule:'form',free:true,relax:false,shaped:.24,icon:'knead',name:'Shape the pocket',verb:'Grab it and drag',gesture:'up',cueX:102.6,
   parts:['pocket-clay'],x:92,end:126,spawn:{x:96,y:2.75,groundId:'pocket-dock'},
   clump:[K(101.3,3.7),K(104,3.7),K(105.2,-1.8),K(111.8,-1.8),K(113,4.4),K(118.5,4.4)],
   solution:[{x:102.5,lift:0,dx:6.5,dy:-3,t:1.7},{x:115,lift:0,dx:-5.5,dy:-2.6,t:1.8}],
   hint:'Grab the violet clay and drag it: lean the spire into a bridge, slump the lump into a ramp, or shape your own way. Clay is ground; bare sand is not. Or face the clay and hold E to work it into steps. Step off and press R to soften it.'}
);
L.hints.push(
  {x:92,end:118.4,icon:'knead',title:'Shape the clay',text:'Grab the violet clay and drag it. Lean the spire into a bridge, slump the lump into a ramp. Or hold E facing the clay to work it into steps; step off and press R to soften it.',touchText:'Grab the violet clay and drag it: lean the spire into a bridge, slump the lump into a ramp. Clay is ground; bare sand is not.'}
);
export default chapter(L);
