// Section 1 — The Crooked Garden. LOCAL coordinates: x runs 0..70 and the exit
// deck ends exactly at 70 so the assembler can butt the next section against
// it. ONE idea: the ground is rolled Play-Doh, the path itself is still rolled
// up, and the arch you climb to recolours the world.
//
// The entry deck is wider than the other sections' (0..12): the assembler
// places it at -8 as the chapter's `start`, and the spawn at 1.5 (local 9.5)
// stands on it. It carries no flag — the spawn is the chapter's first
// checkpoint, and a flag on the start deck would never fire.
//
// Beats, left to right: two rolled slabs rising .8 each (the lawn, where a
// hatworm patrols — stomp it, then work the clay); the violet roll standing
// on its stump, pulled right until it unrolls into a ramp that meets the arch
// deck; the arch deck with the chapter's first flag, where the palette flips
// from butter/mint to magenta/lemon/ultramarine at the arch's centre; a spur
// under the deck's end carrying the mint mushroom that bounces you back up
// to the arch's crown (flower 1); then two floating bends and two crumbling
// pads over the pink pool down to the exit.
import {p,path} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
export default {
  key:'garden',name:'The Crooked Garden',landmark:'arch',length:70,entryId:'garden-entry',exitId:'garden-exit',
  platforms:[
    p('garden-entry',0,12,0),
    p('garden-slab-1',14,4,.8),
    p('garden-slab-2',20,6,1.6),
    // The stump the rolled log stands on: a wall, so the audit never reads it
    // as a deck; its top (1.6) is flush with the roll's from-pose bottom.
    p('garden-roll-post',26,2,1.6,'wall',{h:3.2}),
    // The path, still rolled up: a fat log 5.2 tall on the stump. Pulled right
    // it unrolls 26→34, its top climbing 1.6→4.6 to meet the arch deck flush.
    // Volume 2·5.2 = 10.4 → 8·1.3 = 10.4 (a bridge takes no slope term).
    part('garden-roll',{x:26,w:2,y:6.8,h:5.2},{x:26,w:8,y:1.6,h:1.3,slope:3},{station:'garden-roll',clayRole:'bridge'}),
    p('garden-mound',34,8,4.6,'stone',{checkpoint:38}),
    p('garden-spur',42,3.2,3),
    p('garden-shroom',42.4,2.4,3.44,'spring'),
    p('garden-crown',37,2.6,8.6,'ledge',{optional:true}),
    p('garden-bend-1',44,3,5.4,'ledge'),
    p('garden-crumble-1',49,2.8,6.2,'crumble',{delay:.9}),
    p('garden-bend-2',53.5,3,5.4,'ledge'),
    p('garden-crumble-2',58,2.8,4.6,'crumble',{delay:.85}),
    p('garden-exit',62,8,0)
  ],
  route:['garden-entry','garden-slab-1','garden-slab-2',['garden-roll','walk'],['garden-mound','walk'],'garden-bend-1','garden-crumble-1','garden-bend-2','garden-crumble-2',['garden-exit','fall']],
  // Flower 1: run off the arch deck's end and you land on the mushroom (a
  // slower step lands on the spur beside it and walks on); its bounce carries
  // you back-left onto the arch's crown.
  detours:[path(['garden-mound',['garden-shroom','fall'],'garden-crown',['garden-mound','fall']])],
  recoveries:[],
  coins:[{x:15,y:2.4},{x:17,y:2.6},{x:22,y:3.4},{x:28,y:4.2},{x:30.5,y:5},{x:33,y:5.8},{x:45.5,y:7},{x:50.4,y:7.8},{x:55,y:7},{x:59.4,y:6.2},{x:37.6,y:10.2},{x:38.8,y:10.2}],
  stamps:[{x:38.3,y:10.6}],
  // The lawn's hatworm keeps to the left two thirds of slab-2, so the kneading
  // spot at the roll's foot (station x 23.8 onward) is out of its reach: a
  // player — or the pilot — standing there holding E is never walked into.
  enemies:[{kind:'hatworm',x:21.6,min:20.6,max:22.8,speed:1.2}],
  hazards:[{x:42.5,w:19,y:-1.6}],
  hints:[
    {x:0,end:12,icon:'walk',title:"Look who's looking",text:'The flowers watch you. Walk on — the garden leans your way.'},
    {x:42,end:44,icon:'mushroom',title:'Up top',text:'A mushroom below the arch deck bounces you to the crown.'}
  ],
  winds:[],triggers:[],crushers:[],
  shaping:[
    {id:'garden-roll',name:'Unroll the path',verb:'Pull right',gesture:'right',icon:'ramp',parts:['garden-roll'],x:23.8,end:34,
     spawn:{x:24.6,y:1.6,groundId:'garden-slab-2'},cueX:25.5,
     hint:'The path is rolled up like a carpet. Pull the violet roll to the right — drag it, or hold E / KNEAD — until it climbs to the arch.'}
  ],
  // The chapter's only mild screen, then the arch's centre tips everything
  // into magenta bodies, lemon frosting and an ultramarine sky line.
  palettes:[
    {x:0,main:'#f3e3b6',secondary:'#9fdcbf',backdrop:'#bcc3f2',accent:'#f0a3c4',sky:'#b9c5ef',fog:'#ead0dc'},
    {x:37.75,main:'#e14b9d',secondary:'#eef25a',backdrop:'#4048c9',accent:'#7fe6c6',sky:'#8e9cf2',fog:'#f3a7cb'}
  ],
  camera:[],guides:[]
};
