// Section 1 — The Crooked Garden (STUB). Local coordinates: x runs 0..70 and
// the exit deck ends exactly at 70 so the assembler can butt the next section
// against it. The entry deck is wider than the other sections' (0..12): the
// assembler places it at -8 as the chapter's `start`, and the spawn at 1.5
// (local 9.5) has to stand on it. It carries no flag — the spawn is the
// chapter's first checkpoint, and a flag on the start deck would never fire
// (the game begins with `start` already current). The one surreal idea kept
// here is the arch at x 34: a palette entry there tips the pastel garden into
// violet as the player walks under it. The real geometry lands later.
import {p,row,path} from '../../route-authoring.js';
export default {
  key:'garden',name:'The Crooked Garden',landmark:'arch',length:70,entryId:'garden-entry',exitId:'garden-exit',
  platforms:[
    p('garden-entry',0,12,0),
    p('garden-step-a',15,4,1.2,'ledge'),
    p('garden-step-b',22,4,2.4,'ledge'),
    // The flower perch floats over step-b: a straight held jump reaches it and
    // a hop down onto the arch deck carries on.
    p('garden-flower-ledge',24,3.5,4.6,'ledge',{optional:true}),
    p('garden-arch',29,9,2.4,'stone',{landmark:'arch'}),
    p('garden-step-c',41.5,4,1.4,'ledge'),
    p('garden-step-d',48.5,4,1.8,'ledge'),
    p('garden-rest',55.5,4.5,0),
    p('garden-exit',62,8,0)
  ],
  route:['garden-entry','garden-step-a','garden-step-b','garden-arch','garden-step-c','garden-step-d','garden-rest','garden-exit'],
  detours:[path(['garden-step-b','garden-flower-ledge','garden-arch'])],
  recoveries:[],
  coins:[...row(16,2.6,3),{x:31,y:4.2},{x:33,y:4.4},{x:35,y:4.2},...row(49,3.4,2),{x:57.5,y:1.6}],
  stamps:[{x:25.75,y:6.4}],
  enemies:[],hazards:[],hints:[],winds:[],triggers:[],shaping:[],
  // Only the very start of the chapter is mild: lavender and mint, then the
  // arch tips everything into violet and magenta.
  palettes:[
    {x:0,main:'#b9a3dc',secondary:'#a9e4c8',backdrop:'#d9c8ee',accent:'#ffd6e8',sky:'#e6dcf5',fog:'#e9def4'},
    {x:34,main:'#6d3fa8',secondary:'#c94fa4',backdrop:'#8e63c4',accent:'#ffb3e6',sky:'#5b3b8f',fog:'#8f6ab8'}
  ],
  camera:[],guides:[]
};
