// Section 6 — The Colour River (STUB). Local x 0..75. Conveyor and sink decks
// wait on their primitives; the flower perch over the middle deck is real.
import {p,row,path} from '../../route-authoring.js';
export default {
  key:'river',name:'The Colour River',landmark:'sandwheel',length:75,entryId:'river-entry',exitId:'river-exit',
  platforms:[
    p('river-entry',0,8,0,'stone',{checkpoint:3}),
    p('river-a',11.5,4,1,'ledge'),
    p('river-b',19,4,2.2,'ledge'),
    p('river-c',26.5,6.5,3.2),
    // Perch over river-c: jump up for the flower, stomp back through onto c.
    p('river-flower-ledge',27,3.5,5.4,'ledge',{optional:true}),
    p('river-d',36.5,4,4.4,'ledge'),
    p('river-e',44,6,2.6),
    p('river-f',53.5,4,1.4,'ledge'),
    p('river-g',61,3.5,.6,'ledge'),
    p('river-exit',67,8,0)
  ],
  route:['river-entry','river-a','river-b','river-c','river-d','river-e','river-f','river-g','river-exit'],
  detours:[path(['river-c','river-flower-ledge',['river-c','fall'],'river-d'])],
  recoveries:[],
  coins:[...row(12,2.6,2),{x:21,y:3.8},...row(28,4.8,3),{x:38.5,y:6},{x:46.5,y:4.2},{x:55.5,y:3}],
  stamps:[{x:28.75,y:7.2}],
  enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#c9a7e6',secondary:'#ffe14d',backdrop:'#ff7bb0',accent:'#4fb8ff',sky:'#e3d1f5',fog:'#dcc4ef'}],
  camera:[],guides:[]
};
