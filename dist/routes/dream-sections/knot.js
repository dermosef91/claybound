// Section 10 — The Dream Knot. Local x 0..106; ends on the wake deck, the
// chapter's goal. ONE idea: the knot comes undone as you climb — each of its
// three violet strands asks a different hand (pull, press, spread) — while the
// world tilts; then everything collapses into one lump and you wake on a plain
// normal-world deck in the shipped canyon colours, where the finish bell stands.
//
// Geometry notes (all verified against the engine as it stands):
// · Every kneading stand is a stone whose right edge the strand's post abuts, so
//   the from-pose never covers a deck anyone stands on and the clay's sides
//   never push a kneader off their stand.
// · A player cannot step up more than .12 onto clay without a jump (the body
//   push in simulation.js), so the pier under strand A stands flush with the
//   pulled bridge (4.2) rather than .4 below it as first drawn.
// · Strand C is worked while standing on it (`rideable:true`): posed clay
//   carries its rider by its u-coordinate, so the stub sinks 1.4 under the
//   feet and spreads to meet the ledge behind and the crown ahead.
// · The wake deck (92..106) is 12.5 beyond the crown over a 12-unit drop — out
//   of any jump — and is reached only through the finale's teleport.
import {p} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

export default {
  key:'knot',name:'The Dream Knot',landmark:'bellgate',length:106,entryId:'knot-entry',exitId:'knot-wake',
  platforms:[
    // Fragments of the earlier sections, bleached lilac, climbing toward the knot.
    p('knot-entry',0,8,0,'stone',{checkpoint:3}),
    p('knot-slab',10,3.2,1.4,'ledge'),
    p('knot-crumb-1',15,2.4,2.6,'crumble',{delay:.8}),
    p('knot-saucer',19.5,3,3.6,'lift',{moveY:.4,period:3.4}),
    // Strand A: the loop end stands on its post beyond the pier's edge; pulled
    // right it lies down as a bridge flush with the pier, .2 above ledge-b.
    p('knot-pier-a',24.5,3,4.2,'stone'),
    p('knot-post-a',27.5,2.2,4.2,'wall',{h:3}),
    part('knot-strand-a',{x:27.5,w:2.2,y:10.2,h:6},{x:27.5,w:11,y:4.2,h:1.2},{station:'knot-strand-a',clayRole:'bridge'}),
    p('knot-ledge-b',38.5,4,4.0,'stone',{checkpoint:40.5}),
    p('knot-crumb-2',44.5,2.4,5.2,'crumble',{delay:.8}),
    // A parade hat circling: bottom 48.5 @5.2 (board), left 46.1 @7.6, top 48.5 @10.0.
    p('knot-mobile',48.5,2.6,7.6,'orbit',{moveX:2.4,moveY:2.4,period:7}),
    // Strand B: pressed from the stand it squashes into a block 1.8 up, running to ledge-c.
    // A bridge on screen like the other strands: the `block` view is built once
    // at its first size and never follows a pose.
    p('knot-stand-b',53.5,2.6,10.2,'stone',{checkpoint:54.5}),
    p('knot-post-b',56.1,2.4,9.6,'wall',{h:3}),
    part('knot-strand-b',{x:56.1,w:2.4,y:15.6,h:6},{x:56.1,w:6,y:12.0,h:2.4},{station:'knot-strand-b',clayRole:'bridge'}),
    p('knot-ledge-c',62.1,4,11.8,'stone'),
    // Strand C: land on the stub, stand on it and spread it until it meets the crown.
    p('knot-pier-c',69.1,2.6,8.6,'wall',{h:4}),
    part('knot-strand-c',{x:69.1,w:2.6,y:13.6,h:5},{x:66.1,w:9.4,y:12.2,h:1.383},{station:'knot-strand-c',clayRole:'bridge'}),
    p('knot-crown',75.5,4,12.0,'stone'),
    // The wake deck: the ordinary world, holding the ordinary bell.
    p('knot-wake',92,14,0,'stone',{goal:true})
  ],
  route:[
    'knot-entry','knot-slab','knot-crumb-1',['knot-saucer','board'],'knot-pier-a',['knot-strand-a','walk'],['knot-ledge-b','walk'],
    'knot-crumb-2',['knot-mobile','board'],'knot-stand-b','knot-strand-b',['knot-ledge-c','walk'],
    'knot-strand-c',['knot-crown','walk'],['knot-wake','finale']
  ],
  detours:[],recoveries:[],
  coins:[
    {x:11.6,y:3.4},{x:16.2,y:4.6},{x:21,y:6},{x:26,y:6.2},{x:31,y:6.2},{x:35,y:6.2},
    {x:45.7,y:7.2},{x:52,y:12},{x:60,y:14},{x:68,y:15.4},{x:77,y:14}
  ],
  stamps:[],
  enemies:[
    // Over bridge A (deck 4.2): lane low 7.3 — a tapped hop clears it, a held jump hits.
    {kind:'blinker',x:33,y:7.6,min:30,max:36,bob:.4,speed:1.2},
    // At the bridge's end, 5.2 above it: punishes waiting for the eye.
    {kind:'drip',x:36.5,y:9.4,reach:1.2,period:4},
    // Over strand C (stub 13.6): the kneader's head clears it; a held jump from the spread strand clips it.
    {kind:'blinker',x:72,y:16.8,min:68,max:75,bob:.5,speed:1.4}
  ],
  // The cloud sea under the whole climb; nothing stands below 0 between 8 and 91.
  hazards:[{x:8,w:42,y:-3},{x:50,w:41,y:-3}],
  hints:[{x:8,end:24,icon:'bell',title:'The knot',text:'Three strands hold the dream together. Undo each with a different hand.'}],
  winds:[],triggers:[],crushers:[],
  shaping:[
    {id:'knot-strand-a',name:'Pull the strand',verb:'Pull right',gesture:'right',icon:'bridge',parts:['knot-strand-a'],x:22,end:39,
     spawn:{x:25.5,y:4.2,groundId:'knot-pier-a'},cueX:28.5,
     hint:'Pull the violet strand right until it spans the gap.'},
    {id:'knot-strand-b',name:'Press the strand',verb:'Press down',gesture:'down',icon:'landing',parts:['knot-strand-b'],x:50,end:63,
     spawn:{x:54,y:10.2,groundId:'knot-stand-b'},cueX:57,
     hint:'Press the violet strand down from the stand; it squashes into a landing.'},
    {id:'knot-strand-c',name:'Spread the strand',verb:'Spread',gesture:'out',icon:'bridge',parts:['knot-strand-c'],x:63,end:76,
     spawn:{x:64.5,y:11.8,groundId:'knot-ledge-c'},cueX:70.4,rideable:true,
     hint:'Stand on the violet strand and spread it — hold E, or drag its ends — until it reaches the crown.'}
  ],
  palettes:[
    // Islands bleached to cloud-lilac under an indigo sky; the knot brings its own four hues.
    {x:0,main:'#e5dbf8',secondary:'#3b44b4',backdrop:'#f06bc2',accent:'#f2f063',sky:'#574bc4',fog:'#f2b4dc'},
    // The wake deck is the ordinary world: the shipped canyon look, a hard cut behind the teleport.
    {x:90,main:'#e64e1e',secondary:'#f0603a',backdrop:'#f2b28f',accent:'#ffd568',sky:'#87a9cc',fog:'#d7b39b'}
  ],
  // An entry without viewH means "the ordinary height", so the wider view asked
  // for at 48 is repeated at 60 to hold until the wake deck resets it.
  camera:[{x:0,roll:0},{x:15,roll:.14},{x:32,roll:.28},{x:48,roll:.40,viewH:12.4},{x:60,roll:.5,viewH:12.4},{x:90,roll:0,viewH:11.6}],
  guides:[],
  finale:{flower:{x:77.5,y:13.0},requires:['knot-strand-a','knot-strand-b','knot-strand-c'],wake:{x:95,y:0,groundId:'knot-wake'},duration:6}
};
