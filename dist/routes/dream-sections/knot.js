// Section 10 — The Dream Knot (STUB). Local x 0..75. Ends on the wake deck,
// the chapter's goal: a plain normal-world deck in the shipped canyon colours
// holding the finish bell. For now it is reached by an ordinary jump; the
// finale primitive (flower → collapse → wake) will cut that link later. A
// gentle camera roll on the climb exercises the render-only camera list.
import {p,row} from '../../route-authoring.js';
export default {
  key:'knot',name:'The Dream Knot',landmark:'bellgate',length:75,entryId:'knot-entry',exitId:'knot-wake',
  platforms:[
    p('knot-entry',0,8,0,'stone',{checkpoint:3}),
    p('knot-a',11.5,4,1.5,'ledge'),
    p('knot-b',19,6,3),
    p('knot-c',28.5,4,4.4,'ledge'),
    p('knot-d',36,6,5.6,'stone',{checkpoint:39}),
    p('knot-e',45.5,4,4,'ledge'),
    p('knot-f',53,4,2.2,'ledge'),
    p('knot-wake',61,14,0,'stone',{goal:true,landmark:'bellgate'})
  ],
  route:['knot-entry','knot-a','knot-b','knot-c','knot-d','knot-e','knot-f','knot-wake'],
  detours:[],recoveries:[],
  coins:[...row(12.5,3.1,2),{x:22,y:4.6},...row(29.5,6,2),{x:39,y:7.2},{x:47.5,y:5.6},{x:64,y:1.6},{x:66,y:1.6}],
  stamps:[],enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[
    {x:0,main:'#5e2ea6',secondary:'#f2c14e',backdrop:'#2f3f9e',accent:'#ffe38a',sky:'#1f1a4f',fog:'#4a3e8a'},
    // The wake deck is the ordinary world: the shipped canyon look.
    {x:61,main:'#e64e1e',secondary:'#f0603a',backdrop:'#f2b28f',accent:'#ffd568',sky:'#87a9cc',fog:'#d7b39b'}
  ],
  camera:[{x:0,roll:0},{x:36,roll:.16},{x:61,roll:0}],
  guides:[]
};
