// Section 2 — The Folding Path (STUB). Local x 0..70. Plain ledges stand in
// for the folding decks until the `fold` primitive lands.
import {p,row} from '../../route-authoring.js';
export default {
  key:'folding',name:'The Folding Path',landmark:'bannerarch',length:70,entryId:'folding-entry',exitId:'folding-exit',
  platforms:[
    p('folding-entry',0,8,0,'stone',{checkpoint:3}),
    p('folding-a',11.5,4,1.5,'ledge'),
    p('folding-b',19,5,3),
    p('folding-c',27.5,4,4.5,'ledge'),
    p('folding-d',35,6,3),
    p('folding-e',44.5,4,1.5,'ledge'),
    p('folding-f',53,4.5,1.5,'ledge'),
    p('folding-exit',62,8,0)
  ],
  route:['folding-entry','folding-a','folding-b','folding-c','folding-d','folding-e','folding-f','folding-exit'],
  detours:[],recoveries:[],
  coins:[...row(12.5,3,2),{x:21.5,y:4.6},...row(28.5,6,2),{x:38,y:4.6},...row(45.5,3,2),{x:55,y:3}],
  stamps:[],enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#7b83d6',secondary:'#5c2d6e',backdrop:'#9aa4e8',accent:'#f5c2ff',sky:'#c9cdf5',fog:'#b7b6e6'}],
  camera:[],guides:[]
};
