// Section 3 — The Upside-Down Orchard. Local x 0..75, ids prefixed orchard-.
// ONE idea: the orchard grows down. A raspberry canopy hangs across the sky
// with lemon apples (three of them are drips), saucers hang from it on ropes,
// and the ground is a pair of mint spheres the player runs over. Under the
// canopy's great inverted tree a free mass of violet clay is the only way up:
// pull a pillar out of it and hop the stair onto the hanging saucer.
import {p,path} from '../../route-authoring.js';
const part=(id,pose,extra={})=>p(id,pose.x,pose.w,pose.y,'clay',{shape:{from:{...pose},to:{...pose}},...extra});
// The blob: a free formable mass 13 wide, 3 thick, flat on top at 3.6 (a .6
// step up from orchard-mid) over a base at .6, with nails under it so bare
// footing kills. Clump knots are [across, height over the mass's y], so a flat
// top level with y is 0.
const BLOB={x:44,w:13,y:3.6,h:3.0};
const K=(x,top)=>[(x-BLOB.x)/BLOB.w,top];
const STATION_HINT='The violet blob has its own gravity. Pull it up under you — drag it, or hold E — until the hanging saucer is a jump away. Or stomp the blob and let it throw you at the sky.';
export default {
  key:'orchard',name:'The Upside-Down Orchard',landmark:'tree',length:75,entryId:'orchard-entry',exitId:'orchard-exit',
  platforms:[
    p('orchard-entry',0,8,0,'stone',{checkpoint:3}),
    // Two spheres over the pool: land on the flanks, not the crowns.
    p('orchard-dome-1',10,6,2.4,'dome'),
    p('orchard-dome-2',18,6,3.2,'dome'),
    // Saucers hung from the canopy: the first swings, the second bobs.
    p('orchard-saucer-1',26,3,4.6,'lift',{moveX:.5,period:3.8}),
    p('orchard-saucer-2',31,3,5.6,'lift',{moveY:.4,period:3.8,phase:1.9}),
    p('orchard-apple-perch',30,2.4,7.7,'ledge',{optional:true}),
    p('orchard-mid',37,7,3.0,'stone',{checkpoint:39,landmark:'tree'}),
    part('orchard-blob',BLOB,{station:'orchard-blob',clayRole:'mass'}),
    // The great inverted tree's trunk hangs from the canopy; the player walks under it.
    p('orchard-trunk',46,2.4,14.2,'wall',{h:6}),
    // The hanging chain: a saucer under the canopy, a root, two crumbling apples.
    p('orchard-under',58,3.2,10.8,'ledge'),
    p('orchard-root-1',63.2,2.6,10.1,'ledge'),
    p('orchard-crumb-1',66.8,2.4,9.4,'crumble',{delay:.9}),
    p('orchard-crumb-2',70.2,2.4,8.6,'crumble',{delay:.9}),
    p('orchard-far',60,7,3.0),
    p('orchard-exit',69,6,0)
  ],
  route:['orchard-entry','orchard-dome-1','orchard-dome-2','orchard-saucer-1','orchard-saucer-2',['orchard-mid','fall'],['orchard-blob','walk'],'orchard-under','orchard-root-1','orchard-crumb-1','orchard-crumb-2',['orchard-exit','fall']],
  detours:[path(['orchard-saucer-2','orchard-apple-perch',['orchard-saucer-2','fall']])],
  recoveries:[path(['orchard-far',['orchard-exit','fall']])],
  coins:[{x:11.5,y:4.2},{x:21,y:5.4},{x:27.5,y:6.8},{x:32.5,y:8},{x:40,y:5},{x:49,y:5.6},{x:56,y:10.6},{x:59.6,y:12.6},{x:65,y:12},{x:71.4,y:10.6}],
  stamps:[{x:31.2,y:9.8}],
  // Three lemon apples that let go: over the first dome, over the root and over
  // the last crumbling apple — each ≥ 4.6 above the surface beneath, none over
  // a lift or the kneading stand.
  enemies:[
    {kind:'drip',x:13,y:8.0,reach:1.2,period:4},
    {kind:'drip',x:64.5,y:14.7,reach:1.2,period:4},
    {kind:'drip',x:71.4,y:13.2,reach:1.2,period:4}
  ],
  hazards:[{x:8,w:29,y:-2.5},{x:44,w:13,y:0},{x:67,w:2,y:-2.5}],
  hints:[
    {x:8,end:24,icon:'jump',title:'Round islands',text:'Run over the domes; jump from their sides, not their crowns.'},
    {x:37,end:58,icon:'knead',title:'Pull it up',text:STATION_HINT}
  ],
  winds:[],triggers:[],
  shaping:[
    // A free mass with no pose. The authored solution (one way of many) grabs
    // the flat top at 50 and pulls a mound out of it, drags that mound six
    // units right — the clay it trails behind lays out as a walkable ramp —
    // then pulls the crest up at the mass's right end into a pillar at ≈8.8.
    // Solved, the surface climbs from ≈1.0 at the left end up a ramp to ≈5.7
    // at 54, one hop onto the pillar (7.9–9.0 over 55–57), and one hop onto
    // the saucer hanging at 10.8. (The volume solver draws every pull's clay
    // from a ring round the hand, so two separate steps cannot both stand;
    // a ramp and one pillar is the stair this clay will hold.) The route
    // walks onto the flat mass, so the station is rideable; its bypass (mid →
    // under, a 7.8 rise; flat-top stomp launch 3.6 + 6.69 = 10.29 < 10.8) is
    // impossible unworked. The stretch begins at orchard-mid's left edge so
    // a player who has just dropped onto the deck is already at the station.
    {id:'orchard-blob',rule:'form',free:true,relax:false,shaped:.24,name:'Pull the orchard up',verb:'Grab it and drag',gesture:'up',icon:'knead',cueX:53,
     parts:['orchard-blob'],x:37,end:60,spawn:{x:41,y:3,groundId:'orchard-mid'},rideable:true,
     clump:[K(44,0),K(57,0)],
     solution:[{x:50,lift:0,dx:0,dy:7,t:3},{x:50,lift:0,dx:6,dy:-1,t:3.5},{x:56.5,lift:0,dx:0,dy:2.5,t:1.6}],
     hint:STATION_HINT}
  ],
  // Colour-negative orchard: mint earth and domes, raspberry foliage crowns and
  // frosting, lavender distance, lemon ropes, cushions and apples.
  palettes:[{x:0,main:'#7fdcc0',secondary:'#d8408c',backdrop:'#c3b7f0',accent:'#f5ef6a',sky:'#8fa6ec',fog:'#e9c1dc'}],
  camera:[],guides:[]
};
