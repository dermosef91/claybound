// Section 9 — The Infinite Room (STUB). Local x 0..120: the same four-deck
// figure laid three times in a row, which is the shape the finished room
// keeps (each pass re-dressed) — the door props and the fourth pass come with
// the visuals. A mid-way checkpoint sits on the second door deck.
import {p,row,path} from '../../route-authoring.js';
// One pass of the room, starting where the previous door deck ends.
const pass=(n,x0,extra={})=>[
  p(`room-a${n}`,x0+3.5,4,1.4,'ledge'),
  p(`room-b${n}`,x0+11,6,2.8),
  p(`room-c${n}`,x0+20.5,4,1.4,'ledge'),
  p(`room-d${n}`,x0+28,6,0,'stone',extra)
];
export default {
  key:'room',name:'The Infinite Room',landmark:'kiln',length:120,entryId:'room-entry',exitId:'room-exit',
  platforms:[
    p('room-entry',0,8,0,'stone',{checkpoint:3}),
    ...pass(1,8),...pass(2,42,{checkpoint:73}),...pass(3,76),
    p('room-flower-ledge',88,3.5,5,'ledge',{optional:true}),
    p('room-exit',112,8,0)
  ],
  route:['room-entry',
    'room-a1','room-b1','room-c1','room-d1',
    'room-a2','room-b2','room-c2','room-d2',
    'room-a3','room-b3','room-c3','room-d3','room-exit'],
  detours:[path(['room-b3','room-flower-ledge',['room-b3','fall'],'room-c3'])],
  recoveries:[],
  coins:[...[8,42,76].flatMap(x0=>[...row(x0+4.5,3,2),{x:x0+14,y:4.4}]),{x:114,y:1.6}],
  stamps:[{x:89.75,y:6.8}],
  enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#a58ad6',secondary:'#fff1d6',backdrop:'#c7b3e8',accent:'#d97a55',sky:'#efe6fb',fog:'#e2d4f2'}],
  camera:[],guides:[]
};
