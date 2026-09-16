// Section 4 — The Breathing Corridor (STUB). Local x 0..55. The breathing
// walls need the `breathe` primitive; until then a short ledge run.
import {p,row} from '../../route-authoring.js';
export default {
  key:'corridor',name:'The Breathing Corridor',landmark:'pulsedrum',length:55,entryId:'corridor-entry',exitId:'corridor-exit',
  platforms:[
    p('corridor-entry',0,8,0,'stone',{checkpoint:3}),
    p('corridor-a',11.5,4,1.4,'ledge'),
    p('corridor-b',19,6,2.8),
    p('corridor-c',28.5,4,1.6,'ledge'),
    p('corridor-d',35.5,4,2.6,'ledge'),
    p('corridor-e',42,3.5,1.2,'ledge'),
    p('corridor-exit',47,8,0)
  ],
  route:['corridor-entry','corridor-a','corridor-b','corridor-c','corridor-d','corridor-e','corridor-exit'],
  detours:[],recoveries:[],
  coins:[...row(12,3,2),...row(20.5,4.4,3),{x:37.5,y:4.2},{x:43.75,y:2.8}],
  stamps:[],enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#c8302b',secondary:'#ff5a36',backdrop:'#7a2a5e',accent:'#ffcf6b',sky:'#4a1d47',fog:'#9c3d6c'}],
  camera:[],guides:[]
};
