// Section 6 — The Colour River. Local x 0..80. Three streams, three verbs:
// the yellow river carries (conveyor ledges, one flowing backwards), the pink
// river throws (springs), the blue river sinks (three pads in a row, a raft
// and the elevator out). Pressing the violet clot in the blue river's bed
// wakes the geyser: an updraft that carries the player up to the far bank.
import {p,path} from '../../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
const FAR_X=69,FAR_Y=4.6;
export default {
  key:'river',name:'The Colour River',landmark:'streams',length:80,entryId:'river-entry',exitId:'river-exit',
  platforms:[
    p('river-entry',0,8,0,'stone',{checkpoint:3}),
    // The yellow river abuts the bank at its own height so a player who simply
    // walks on is carried (≈11.7 u/s running); it ends short of the pink spring.
    p('river-yellow-1',8,9,0,'ledge',{conveyor:5}),
    p('river-pink-1',18.5,1.8,.84,'spring'),
    p('river-high',22.5,3,6,'ledge'),
    p('river-bank-1',25.5,3.5,6,'stone',{checkpoint:27.5}),
    p('river-blue-1',30.5,3,5.6,'sink',{rate:1.2,drop:2.2}),
    p('river-blue-2',35,3,5.6,'sink',{rate:1.2,drop:2.2}),
    p('river-blue-3',39.5,3,5.6,'sink',{rate:1.2,drop:2.2}),
    // Flows backwards out of the cliff: walked against at 2.2 u/s under an eye.
    // The sill at its end is the cliff's still foot — the jump to the crumb
    // launches from it, not from moving ground.
    p('river-yellow-2',44,5.6,5.2,'ledge',{conveyor:-4.5}),
    p('river-sill',49.6,2.6,5.2,'ledge'),
    p('river-crumb',53.8,2.4,5,'crumble',{delay:.7}),
    p('river-pink-2',57.4,1.8,5.44,'spring'),
    p('river-cross',58.6,3.5,10.6,'ledge',{checkpoint:60.1}),
    p('river-pool-bank',60.5,2.5,0,'stone',{checkpoint:61.5}),
    p('river-raft',63.8,2.6,0,'sink',{rate:1,drop:2.2}),
    // The clot: a block standing in the riverbed, pressed flat to the level of
    // the sunk raft. Full pressure latches the geyser. Drawn as a bridge, the
    // one clay view that follows a pose (`block` is built once at its first size).
    part('river-clot',{x:66.6,w:1.2,y:-1.2,h:3.6},{x:66,w:2,y:-2.2,h:2.16},{station:'river-clot',clayRole:'bridge'}),
    p('river-far-bank',FAR_X,2.5,FAR_Y),
    p('river-blue-4',FAR_X+2.5,2.5,FAR_Y-.4,'sink',{rate:1,drop:FAR_Y-1}),
    p('river-exit',FAR_X+5,80-FAR_X-5,0)
  ],
  route:['river-entry',['river-yellow-1','walk'],'river-pink-1','river-high',['river-bank-1','walk'],['river-blue-1','board'],'river-blue-2','river-blue-3','river-yellow-2',['river-sill','walk'],'river-crumb','river-pink-2','river-cross',['river-pool-bank','fall'],['river-raft','board'],'river-clot','river-far-bank',['river-blue-4','board'],['river-exit','walk']],
  detours:[],
  recoveries:[path(['river-raft','river-pool-bank'])],
  coins:[{x:11,y:2.4},{x:14,y:2.4},{x:17,y:2.4},{x:20.5,y:5.4},{x:23.5,y:7.8},{x:32,y:7.2},{x:36.5,y:7.2},{x:41,y:7.2},{x:47,y:7},{x:60.4,y:12.5},{x:65.5,y:3}],
  stamps:[],
  enemies:[
    {kind:'blinker',x:13,y:3.5,min:10,max:16,bob:.4,speed:1.2},
    {kind:'blinker',x:46.5,y:8.6,min:44.5,max:48.5,bob:.4,speed:1.2},
    {kind:'drip',x:55,y:10,reach:1.2,period:4}
  ],
  hazards:[
    {x:8,w:14,y:-2},
    {x:29,w:15,y:1.8},
    {x:49.8,w:10.6,y:-1},
    {x:63,w:5,y:-5}
  ],
  hints:[
    {x:8,end:18,icon:'walk',title:'Yellow carries, pink throws, blue sinks',text:'Ride the yellow stream into the pink one.'},
    {x:29,end:44,icon:'sink',title:'Blue pulls you down',text:'Keep moving. A sunk raft is still a step to the next.'},
    {x:44,end:52,icon:'walk',title:'Upstream',text:'This one flows backwards. Walk against it — do not jump under the eye.'}
  ],
  winds:[{id:'river-geyser',x:63.2,w:FAR_X-63.2,y:-3,h:10,fx:0,fy:19,channel:'river-geyser'}],
  triggers:[],crushers:[],
  shaping:[
    {id:'river-clot',name:'Press the clot',verb:'Press down',gesture:'down',icon:'updraft',parts:['river-clot'],x:61,end:FAR_X,
     spawn:{x:62,y:0,groundId:'river-pool-bank'},cueX:67,channel:'river-geyser',rideable:true,
     hint:'Ride the blue raft down. At the bottom, press the violet clot in the riverbed — drag it, or hold E / KNEAD — and the river bursts up under you. Ride the spout to the far bank.'}
  ],
  palettes:[{x:0,main:'#86dcc3',secondary:'#c9b4f2',backdrop:'#b9a6e6',accent:'#ff62b0',sky:'#a99be6',fog:'#efb9d6'}],
  camera:[],guides:[]
};
