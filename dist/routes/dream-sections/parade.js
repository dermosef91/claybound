// Section 5 — The Melted Parade (STUB). Local x 0..75. The statues that work
// themselves (`auto` stations) come later; this is the walk between them.
import {p,row} from '../../route-authoring.js';
export default {
  key:'parade',name:'The Melted Parade',landmark:'beacon',length:75,entryId:'parade-entry',exitId:'parade-exit',
  platforms:[
    p('parade-entry',0,8,0,'stone',{checkpoint:3}),
    p('parade-a',11,6,1),
    p('parade-b',20.5,4,2.5,'ledge'),
    p('parade-c',28,4,4,'ledge'),
    p('parade-d',35.5,7,2.5),
    p('parade-e',46,4,3.8,'ledge'),
    p('parade-f',53.5,4,2.2,'ledge'),
    p('parade-g',61,5,.8),
    p('parade-exit',67,8,0)
  ],
  route:['parade-entry','parade-a','parade-b','parade-c','parade-d','parade-e','parade-f','parade-g','parade-exit'],
  detours:[],recoveries:[],
  coins:[...row(12.5,2.6,3),{x:22.5,y:4.1},{x:30,y:5.6},...row(37,4.1,3),{x:48,y:5.4},{x:62.5,y:2.4}],
  stamps:[],enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#ff9a76',secondary:'#fff176',backdrop:'#ffc3a8',accent:'#8be0ff',sky:'#ffe9c2',fog:'#ffd6b8'}],
  camera:[],guides:[]
};
