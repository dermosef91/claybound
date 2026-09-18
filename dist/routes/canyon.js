import {chapter,p,row,path,makeRoom} from '../route-authoring.js';
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
// Layout 11 is the workshop pass over that shape: the riverbed is floored with
// spiked sandstone so the sinking run has a bottom you can see and must not
// reach, the crumbling ledges are levelled into a line over it, the gondola is
// given a long swing in place of a step, and the way into the arch is a
// crumble and a stub onto a wider bridge rather than two narrow banks. The
// flower in the arch moved onto the crumbling steps that reach it.
//
// Layout 12 opens the chapter up once after all: the Boulder Drop is a room
// of its own between the arch's roof and the summit, so the summit, the
// ropeway and the bell stand fifty units further on than they were authored.
// Everything up to the arch keeps its final coordinates; the room itself is
// authored final too, after the seam, the way the forest's Weaver's Gap is.
const SEAM=270,GAP=50;
const L=makeRoom({
  layoutVersion:12,
  name:'The Sunbaked Canyon',short:'Sunbaked Canyon',label:'Riverbed & ropeway',biome:'desert',
  intro:'Down off the plateau to the clay riverbed, then up the long wall to the ropeway.',
  sky:'#80afe0',fog:'#f1bba0',spawn:{x:1.5,y:13},end:354,previousDistance:1342,cameraY:2,
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
    p('lookout',38,5.5,8.5,'stone',{landmark:'arch'}),
    // --- the sinking sandstone, and the floor it runs over --------------------
    // The crumbling ledges hold one line across the valley; under them the
    // riverbed is floored with sandstone and sown with spikes, so a missed
    // ledge falls somewhere visible and fatal rather than into blank air.
    p('basin',46,7,7.6,'stone',{checkpoint:48,landmark:'sandwheel'}),
    p('clay-3-copy-1',53,20,2.5,'stone',{spiked:true}),
    p('sand1',55,3.8,6.6,'crumble',{delay:1.2}),
    p('sand2',61,3.6,6,'crumble',{delay:1}),
    p('sand3',67,3.8,4.8,'crumble',{delay:.9}),
    p('sand-rest',73,5,4.2),
    p('clay-3',78,13.75,2.25,'stone',{spiked:true}),
    p('sand4',80,3.6,5.25,'crumble',{delay:1}),
    p('sand5',86.5,3.8,5.75,'crumble',{delay:.9}),
    // --- the riverbed: the pocket ---------------------------------------------
    // One mass of clay on a sandstone shelf that fills the chasm, with spikes
    // half a unit below the clay's base, so bare sandstone kills and any clay
    // at all is safe. Since layout 11 the dock stands over the clay's rest
    // surface, so the pocket is entered from above: the clump can be stepped
    // onto, and what stops it being a way across is the pit between its
    // towers, which is deeper than a hop out of it.
    p('pocket-dock',92,9.3,6.25,'stone',{checkpoint:97,landmark:'sandwheel'}),
    p('pocket-floor',101.3,17.2,.6,'wall',{h:6.6}),
    part('pocket-clay',{x:101.3,w:17.2,y:2.75,h:2.15},{x:101.3,w:17.2,y:2.75,h:2.15},{station:'canyon-pocket',clayRole:'mass'}),
    p('pocket-landing',118.5,7.5,6.2,'stone',{checkpoint:122}),
    // A spiked stub in the gap out of the pocket: the step across is a jump.
    // `spiked` says the band on top of it is meant to be there, so the audit
    // reads a deck sown with spikes as authored rather than as a mistake.
    p('clay-4',126,2,3.25,'stone',{spiked:true}),
    // --- the climb begins, and with it the wind -------------------------------
    p('windwell',128,7,6.2,'stone',{checkpoint:130,landmark:'windmill',rest:true}),
    p('valve1',132,1.8,6.33,'switch',{channel:'wind-a',latch:true}),
    p('wind-step',137,4,7.6,'ledge'),
    p('wind-crown',142,4,12,'ledge'),
    p('wind-turn',137.25,4.5,13.65,'ledge'),
    p('wind-exit',147,6,13.4),
    p('wind-gondola',157.5,4,14,'lift',{moveX:4.25,moveY:1.25,period:7}),
    p('rest-bank',166,7.65,16.8,'stone',{checkpoint:168,rest:true}),
    // --- the sky-sand run, the steep middle of the wall -----------------------
    p('last-well',176,6,17.4,'stone',{landmark:'windmill'}),
    p('valve2',179,1.8,17.53,'switch',{channel:'wind-b',latch:true}),
    p('clay-1',184,4,18.4,'crumble'),
    p('sky-lift',190,4,20.4,'lift',{moveY:1,period:5.2,phase:-.8}),
    p('sky2',197,4,23.8,'ledge'),
    p('sky-rest',203,5,24.4,'stone',{checkpoint:205}),
    p('sky-sand',210,3.25,25.1,'crumble',{delay:1}),
    p('sky-sand-copy-1',215.75,3,26,'crumble',{delay:1}),
    // --- the bridge into the arch, and the cave climb -------------------------
    // The crossing leads *into* the arch's mouth rather than out of it, off a
    // stub of sandstone. The cave shell follows `arch-entry` and `arch-roof` on
    // its own (great-arch.js), so the pair carry the backdrop with them.
    p('clay-5',221.25,2,26.5),
    p('arch-drop',223.25,6.5,26.5,'bridge'),
    p('arch-entry',230,13,26.6,'stone',{checkpoint:236,landmark:'arch',rest:true}),
    p('arch-shelf',244.75,4,27.75,'ledge'),
    p('clay-2-copy-1',250.75,2.5,29.25,'crumble'),
    p('arch-lift',254.5,3.25,29.25,'lift',{moveY:2.2,period:5.8,phase:-1.57}),
    p('arch-balcony',257.75,4,32.25,'ledge'),
    p('arch-roof',263,6,33.2),
    // --- the summit, and the ropeway down -------------------------------------
    // The trolley hangs off the summit's shoulder. It runs sixty units out and
    // twenty-four down, which is far past the fall the chapter would otherwise
    // allow — the ride is exempt while it carries someone, and the deck it sets
    // them on carries a flag of its own so the exemption has somewhere to land.
    p('summit',272,9,34.6,'stone',{checkpoint:276.5,landmark:'arch',rest:true}),
    p('zip-trolley',281.5,2.6,34.6,'zip',{travel:60,drop:24,duration:4.5}),
    p('bell-roof',342,15,10.2,'stone',{goal:true,timber:true,checkpoint:344,landmark:'bellgate'}),
    // --- the flower ledges, and the crumbling steps up to the last one --------
    p('basin-flower',61.25,3.2,3.75,'ledge',{optional:true}),
    p('well-flower',133.25,3.2,15.4,'ledge',{optional:true}),
    p('clay-2-copy-2',251,2.25,33,'crumble'),
    p('clay-2',247,2.25,33.75,'crumble',{optional:true})
  ],
  route:['start','lift1','arrival','notch','rope-cross',['lookout','walk'],
    'basin','sand1','sand2','sand3','sand-rest','sand4','sand5',
    'pocket-dock','pocket-clay','pocket-landing',
    'windwell',['valve1','walk'],'wind-step','wind-crown','wind-exit','wind-gondola','rest-bank',
    'last-well',['valve2','walk'],'clay-1','sky-lift','sky2','sky-rest','sky-sand','sky-sand-copy-1',
    'clay-5',['arch-drop','walk'],['arch-entry','walk'],
    'arch-shelf','clay-2-copy-1','arch-lift','arch-balcony','arch-roof',
    // The Boulder Drop: over the bridge to the mill, up the cracked ledges to
    // the valve and back down, up the flank on the wind, across the pool once
    // the boulder has gone, and down through the hole it left.
    ['shelf-bridge','walk'],['boulder-plateau','walk'],'porous-1','porous-2','switch-perch',['valve3','walk'],['boulder-plateau','fall'],
    'flank-1','flank-2','flank-3','boulder-mount',['boulder-pool','walk'],['cave-floor','fall'],['summit','walk'],
    ['zip-trolley','board'],['bell-roof','ride']],
  detours:[
    path(['wind-crown','wind-turn','well-flower','wind-turn','wind-crown','wind-exit']),
    path(['sand2',['basin-flower','fall'],'sand3']),
    path(['arch-balcony','clay-2-copy-2','clay-2','clay-2-copy-2','arch-balcony','arch-roof'])
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
    ...row(56,7.7,2),...row(62,7.1,2),...row(68,5.9,2),...row(81,6.35,2),...row(87.5,6.85,2),
    {x:94.25,y:7.7},...row(104.3,5.2,3,1.3),{x:116.5,y:8.3},{x:120.5,y:7.6},{x:123,y:7.6},
    {x:130,y:4.8},{x:139,y:9.25},{x:140.5,y:11.35},{x:144.25,y:12.9},...row(158.5,15.4,2),
    ...row(167.5,17.9,3),{x:185.75,y:19.5},...row(191.5,21.8,2),{x:198.75,y:24.9},{x:204,y:25.5},
    {x:224.85,y:27.5},{x:226.85,y:27},{x:228.6,y:27.5},...row(237,27.9,3),
    {x:255.25,y:30.45},{x:259.5,y:33.35},{x:265,y:34.3},{x:274.5,y:35.7},...row(345,11.4,3,1.25)
  ],
  stamps:[{x:62.85,y:4.75},{x:134.85,y:16.4},{x:248,y:34.25}],
  // The drifters keep to the roomy banks: an arrival deck, a rest in the
  // sinking run, a bank on the climb and the arch's roof. None of them stands
  // over a flag, and no crossing depends on bouncing off one.
  enemies:[
    {kind:'drifter',x:21,y:11.95,min:19.2,max:22.8,speed:.85,bob:.16,period:5.2,phase:0},
    {kind:'drifter',x:75.5,y:4.95,min:74,max:77,speed:.95,bob:.18,period:4.8,phase:1.1},
    {kind:'drifter',x:171.5,y:17.55,min:170.5,max:173,speed:.8,bob:.15,period:5.6,phase:1.5},
    {kind:'drifter',x:266,y:33.95,min:264.5,max:267.5,speed:1.05,bob:.2,period:4.5,phase:2.2}
  ],
  // Spikes lie under the line the route walks: on the riverbed floor, on the
  // stub out of the pocket, and in the gaps the climb jumps.
  hazards:[
    {x:10,w:8,y:2.5},{x:24,w:14,y:2.5},{x:43.25,w:2.75,y:.25},{x:53,w:38.75,y:2.5},
    {x:101.3,w:17.2,y:.1},{x:126,w:2,y:3.25},{x:153,w:13,y:6.25},{x:243,w:20.25,y:19.75}
  ],
  shaping:[],
  hints:[
    {x:0,end:9,icon:'walk',title:'Move and jump',text:'A / D or arrows to move. Hold jump to leap.'},
    {x:46,end:55,icon:'sink',title:'Crumbling ledges',text:'Cracked ledges crumble. Keep moving — the riverbed below them bites.'},
    {x:128,end:136,icon:'updraft',title:'Activate wind',text:'Step on the valve. From here the wells blow, and the wind lifts your jumps.'},
    {x:272,end:284,icon:'bell',title:'Ride the ropeway',text:'Step onto the trolley. Your weight sends it down the cable to the bell.',
      touchText:'Step onto the trolley. Your weight sends it down the cable to the bell.'}
  ],
  guides:[{platformId:'wind-crown',offset:.55,dir:-1},{platformId:'arch-balcony',offset:.55,dir:-1},{platformId:'arch-balcony',offset:3.4,dir:1}]
},SEAM,GAP);

// --- The Sandwright's Pocket ---------------------------------------------------
// One mass of clay, formable the way the lab's lump is — no pose, only a surface
// the hand drags where it likes — sitting free on a sandstone shelf that fills
// the riverbed from its floor up to the clay's base. It rests as two towers with
// a skim of clay over the pit between them: a spire at the dock's end, a lump
// against the landing's cliff cresting a unit above the landing. The shelf is
// sown with spikes half a unit below the clay's base, so bare sandstone kills
// and any clay at all is safe.
//
// The dock overlooks the clay rather than meeting it, so the clump can be
// stepped onto — the room is entered from above. That is not a way through:
// the pit between the towers is deeper than a hop, the lump's crest is out of
// reach from the floor of it, and a player who drops in works their way out
// with the same hand or held E that opens the pocket in the first place. The
// pocket still opens only once the clay is worked, and any shape that carries
// the player counts.
// A knot is placed by the world x it stands at, as a share of the mass's width.
// Rounded, because the last knot sits exactly on the far end and the division
// that puts it there lands a whisker past 1 in binary.
const K=(x,top)=>[Math.round((x-101.3)/17.2*1e6)/1e6,top];
L.shaping.push(
  {id:'canyon-pocket',rule:'form',free:true,relax:false,shaped:.24,icon:'knead',name:'Shape the pocket',verb:'Grab it and drag',gesture:'up',cueX:102.6,
   parts:['pocket-clay'],x:92,end:126,spawn:{x:96,y:6.25,groundId:'pocket-dock'},
   clump:[K(101.3,3.7),K(104,3.7),K(105.2,-1.8),K(111.8,-1.8),K(113,4.4),K(118.5,4.4)],
   solution:[{x:102.5,lift:0,dx:6.5,dy:-3,t:1.7},{x:115,lift:0,dx:-5.5,dy:-2.6,t:1.8}],
   hint:'Grab the violet clay and drag it: lean the spire into a bridge, slump the lump into a ramp, or shape your own way. Clay is ground; bare sand is not. Or face the clay and hold E to work it into steps. Step off and press R to soften it.'}
);
L.hints.push(
  {x:92,end:118.4,icon:'knead',title:'Shape the clay',text:'Grab the violet clay and drag it. Lean the spire into a bridge, slump the lump into a ramp. Or hold E facing the clay to work it into steps; step off and press R to soften it.',touchText:'Grab the violet clay and drag it: lean the spire into a bridge, slump the lump into a ramp. Clay is ground; bare sand is not.'}
);

// --- The Boulder Drop ------------------------------------------------------------
// The summit's cave is floored over with planks, and the only thing in the
// chapter heavy enough to go through them is a boulder resting in a pool of
// violet clay on the mesa above. Getting up there is the wind's business: a
// valve at the end of two cracked ledges wakes a well over the mill, and the
// well lifts the player up three ledges on the mesa's flank that no jump
// reaches cold. On top, the clay is worked the way the pocket's was, except
// that here it is the ground under the boulder that is raised and leaned
// until the boulder rolls off the mesa's edge, drops on the planks, and opens
// the cave. The player follows it down.
//
// The mesa is a stone ledge for the working stand and a wall body under the
// pool, flush with the clay's base the way the pocket's floor is, so the pool
// reads as clay sitting on rock. Its body stops at y44 so a jump off the valve
// perch underneath it never meets its underside. The cave's floor begins where
// the pillar ends, and the pillar stands beside its cliff rather than on it:
// nothing left of the pillar stands at cave height, so the planks are the only
// way in. A step between the pillar and the cracked ledges is the way back for
// anyone who drops onto the planks before the boulder does.
const B=(x,top)=>[Math.round((x-289)/20*1e6)/1e6,top];
L.platforms.push(
  p('shelf-bridge',269,7,33.2,'bridge'),
  p('boulder-plateau',276,13,32.8,'stone',{checkpoint:280,landmark:'windmill',rest:true}),
  // The valve: two cracked ledges up and a perch over the second.
  p('porous-1',291.5,4.5,34.9,'crumble',{delay:1}),
  p('porous-2',298.5,4.5,37,'crumble',{delay:1}),
  p('switch-perch',292,5,39.1,'ledge'),
  p('valve3',295.2,1.8,39.23,'switch',{channel:'wind-c',latch:true}),
  // The flank: three ledges in the well's draught, each a jump only the wind makes.
  p('flank-1',279,3,38.5,'ledge'),
  p('flank-2',276,3,44,'ledge'),
  p('flank-3',281,3,50,'ledge'),
  // The mesa, the pool and the boulder.
  p('boulder-mount',284,5,52,'stone'),
  p('boulder-body',289,20,48,'wall',{h:4}),
  part('boulder-pool',{x:289,w:20,y:52,h:4},{x:289,w:20,y:52,h:4},{station:'boulder-run',clayRole:'mass'}),
  // The pillar, the planks it carries, and the cave under its overhang.
  p('pillar-step',304.5,3,38.5,'ledge'),
  p('pillar',309,3,40,'wall',{h:15.4}),
  p('plank-floor',309,8,40,'break',{timber:true,rockOnly:true}),
  p('cave-lip',317,2,43,'wall',{h:3}),
  p('cave-roof',317,17,52,'wall',{h:9}),
  p('cave-floor',312,10,34.6,'stone')
);
L.sections.splice(6,0,{x:SEAM,name:'The Boulder Drop',landmark:'windmill'});
L.winds.push({id:'well-c',x:274.5,w:8,y:32.8,h:18.5,fx:0,fy:19,channel:'wind-c'});
L.circuits.push({source:'valve3',channel:'wind-c',targets:['flank-1','flank-2'],kind:'wind'});
L.hazards.push({x:270,w:39,y:19.75});
L.coins.push({x:293.75,y:36.3},{x:300.75,y:38.4},...row(279.5,40,2,1),...row(276.5,45.5,2,1),{x:282.5,y:51.5},{x:286.5,y:53.4},...row(312.5,36,3,1.2));
L.hints.push(
  {x:270,end:284,icon:'updraft',title:'Wake the wind',text:'Cross the cracked ledges to the valve. The well below the mill will carry you up the flank.',touchText:'Cross the cracked ledges to the valve. The well below the mill will carry you up the flank.'},
  {x:284,end:312,icon:'knead',title:'Roll the boulder',text:'Grab the violet clay and drag it: raise the ground under the boulder and lean it right. Off the edge it falls on the planks.',touchText:'Grab the violet clay and drag it: raise the ground under the boulder and lean it right. Off the edge it falls on the planks.'}
);
L.shaping.push(
  {id:'boulder-run',rule:'form',free:true,relax:false,shaped:.2,icon:'wheel',name:'Drop the boulder',verb:'Raise the ground',gesture:'up',cueX:290.5,
   parts:['boulder-pool'],x:284,end:310,spawn:{x:286.5,y:52,groundId:'boulder-mount'},
   // A hollow at the near end with the boulder in it, a lip past it, and from
   // the lip a chute that falls in a straight line to the open edge — knotted
   // every unit and a half, because the rest shape is smoothed between knots
   // and a long segment would be flat at both ends, where a slow boulder
   // stops. Left alone the boulder sits in the hollow; raise the ground under
   // it and it rides the mound up and rolls off it over the lip, and the chute
   // does the rest.
   clump:[B(289,-.1),B(291.5,-.2),B(293.5,-.7),B(295.5,.3),...[297,298.5,300,301.5,303,304.5,306,307.5,309].map((x,i)=>B(x,.1-.275*i))],
   marble:{x:4.5,radius:1.5,look:'rock',spill:'right'},channel:'boulder-down',
   solution:[{x:293.3,lift:0,dx:-.4,dy:3,t:1}],
   message:'The boulder is down · the cave is open',
   hint:'The boulder rests in a hollow. Only the clay moves it: grab the violet clay and pull the ground up under it, then lean the slope to the right. Off the edge it drops on the planks. R softens the clay.'}
);
export default chapter(L);
