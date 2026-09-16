// Section 3 — The Upside-Down Orchard (STUB). Local x 0..75. Saucers and
// domes arrive with the `dome` primitive; for now a rising and falling run.
import {p,row} from '../../route-authoring.js';
export default {
  key:'orchard',name:'The Upside-Down Orchard',landmark:'mushroom',length:75,entryId:'orchard-entry',exitId:'orchard-exit',
  platforms:[
    p('orchard-entry',0,8,0,'stone',{checkpoint:3}),
    p('orchard-a',11,4,1.2,'ledge'),
    p('orchard-b',18.5,4,2.6,'ledge'),
    p('orchard-c',26,6,4),
    p('orchard-d',35.5,4,5.2,'ledge'),
    p('orchard-e',43,6,3.5),
    p('orchard-f',52.5,4,2,'ledge'),
    p('orchard-g',60,4,.8,'ledge'),
    p('orchard-exit',67,8,0)
  ],
  route:['orchard-entry','orchard-a','orchard-b','orchard-c','orchard-d','orchard-e','orchard-f','orchard-g','orchard-exit'],
  detours:[],recoveries:[],
  coins:[...row(11.5,2.8,3),{x:28,y:5.6},{x:30,y:5.8},{x:37.5,y:6.8},...row(44,5,2),{x:54.5,y:3.6}],
  stamps:[],enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  palettes:[{x:0,main:'#3d4fc7',secondary:'#8fe3c4',backdrop:'#5b6fdc',accent:'#d9fff1',sky:'#2f3a9e',fog:'#6f7ed6'}],
  camera:[],guides:[]
};
