import {chapter,p,row,arc,path} from '../route-authoring.js';

// Chapter four is the mastery chapter: it teaches nothing of its own without
// also asking for something learned earlier. Counterweights and gondolas stay
// its signature, but the canyon's draughts, the wildwood's springs, the caves'
// pulse decks and shooters all return — and the player's own hands, kneading
// clay, open three of its gates, the last being the bridge to the bell itself.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

export default chapter({
  layoutVersion:4,
  name:'The Hanging Quarter',short:'Hanging Quarter',label:'Weights, draughts & your own hands',biome:'citadel',
  intro:'Everything you have learned hangs over this city. Knead the last bridge to the sky bell.',
  sky:'#86a6c5',fog:'#91abc3',spawn:{x:4.75,y:0},end:305.5,previousDistance:1002.5,cameraY:2.15,
  sections:[
    {x:-8,name:'The Familiar Rooftops',landmark:'opening'},
    {x:50,name:'Counterweight Court',landmark:'counterweight'},
    {x:112,name:'Laundry Switchbacks',landmark:'bannerarch'},
    {x:183,name:'Gondola Exchange',landmark:'counterweight'},
    {x:242,name:'The Sky Bell',landmark:'bellgate'}
  ],
  platforms:[
    // 01 · The Familiar Rooftops — a rope lift, your first kneaded ramp, loose tiles.
    p('start',-8,18,0,'stone',{arch:true,entrance:true}),
    p('lift1',9,4,1.65,'lift',{moveY:.9,period:5.6}),
    p('roof1',14.55,8.5,3.9,'stone',{house:true,checkpoint:16.5}),
    part('roof-ramp',{x:23.05,w:2.3,y:7.1,h:3.05,slope:0},{x:23.05,w:7.8,y:3.9,h:.65,slope:3.3},{station:'roof-ramp',clayRole:'ramp'}),
    p('tile-dock',30.85,3,7.2,'stone',{checkpoint:32}),
    p('tile1',35,3.4,7.6,'crumble',{delay:1.2}),
    p('tile2',40,3.4,8.2,'crumble',{delay:1.1}),
    p('lookout',45,4,8.8,'ledge'),

    // 02 · Counterweight Court — the chapter verb, then the canyon's draught above it.
    p('lower-court',50,10,6.4,'stone',{checkpoint:53,landmark:'counterweight'}),
    p('weight1',61,5.5,7.2,'balance',{channel:'weight-a'}),
    p('counter1',69,4,6.2,'counter',{channel:'weight-a',rise:2.8}),
    p('court-roof',75,6,10.2,'stone',{house:true}),
    p('draught-valve',78.5,1.8,10.33,'switch',{channel:'draught',latch:true}),
    p('draught-step',82,4,11.4,'ledge'),
    p('draught-crown',87,4,16.2,'ledge'),
    p('draught-turn',83.5,3.2,17.9,'ledge'),
    p('court-flower',80,3.2,19.6,'ledge',{optional:true}),
    p('draught-exit',93,6,17.6,'stone'),
    p('garden',101,10,15,'stone',{checkpoint:104,landmark:'oasis',house:true,rest:true}),

    // 03 · Laundry Switchbacks — awning springs, a leftward return, a kneaded stair.
    p('laundry-entry',113,8,13.3,'stone',{checkpoint:116,landmark:'bannerarch'}),
    p('laundry1',123,3.5,14.6,'ledge'),
    p('awning1',128,3.2,15.4,'spring'),
    p('laundry-high',132.5,4,20.6,'ledge'),
    p('laundry-turn',129,3.2,22.4,'ledge'),
    p('laundry-flower',125.5,3.2,24.1,'ledge',{optional:true}),
    p('stair-dock',138.5,5.5,22.6,'stone'),
    ...[0,1,2].map(i=>part('laundry-stair-'+i,
      {x:144+i*.8,w:.85,y:27.9,h:8.5},
      {x:144+i*2.4,w:2.4,y:24.3+i*1.8,h:4.9+i*1.8},{station:'laundry-stairs',clayRole:'stairs'})),
    p('laundry-roof',151.2,6,27.9,'stone',{arch:true,house:true}),
    p('laundry-drop',158.5,4,24.8,'ledge'),
    p('laundry-lift',164,4,24.4,'lift',{moveY:1.8,period:5.4,phase:-1.57}),
    p('laundry-return',169.5,4,26.9,'ledge'),
    p('laundry-home',175,7,27.9,'stone',{checkpoint:178,house:true}),

    // 04 · Gondola Exchange — the caves' pulse decks feed the paired gondolas.
    p('exchange-step',183.5,4,26.5,'ledge'),
    p('exchange-entry',189.5,8,24.9,'stone',{checkpoint:192.5,landmark:'counterweight'}),
    p('lamp1',199.5,3.4,25.6,'pulse',{period:4.6,duty:.74}),
    p('lamp2',205,3.4,26.3,'pulse',{period:4.6,duty:.74,phase:.5}),
    p('exchange1',210.5,4,27,'lift',{moveX:1,moveY:.4,period:5.2,phase:-.6}),
    p('exchange2',216.5,4,28.1,'lift',{moveX:1,moveY:.4,period:5.2,phase:2.54}),
    p('weight2',223,5,28.8,'balance',{channel:'weight-b'}),
    p('counter2',230.5,3.6,27.8,'counter',{channel:'weight-b',rise:2.8}),
    p('gallery-low',236.5,6,30.4,'stone',{checkpoint:239.5}),

    // 05 · The Sky Bell — read the shooter from cover, ride the last counterweight,
    // cross the failing tiles, wake the belfry draught, then press your own bridge.
    p('gallery-high',244.5,6,32.6,'stone'),
    p('weight3',253,5,33.2,'balance',{channel:'weight-c'}),
    p('counter3',260.5,3.6,32.2,'counter',{channel:'weight-c',rise:2.8}),
    p('bell-court',266.5,6,35.6,'stone',{checkpoint:268,landmark:'bellgate',rest:true}),
    p('belfry-valve',270.5,1.8,35.73,'switch',{channel:'belfry',latch:true}),
    p('stair1',274.5,3,36.6,'crumble',{delay:1}),
    p('bell-pocket',275.5,3.4,32.8,'ledge',{optional:true}),
    p('pocket-awning',280,3,32.4,'spring'),
    p('stair2',279.5,3,37.6,'crumble',{delay:.9}),
    p('bell-rest',283,4,38.4,'stone',{checkpoint:285}),
    p('belfry-step',288.5,3,39.4,'ledge'),
    p('belfry-crown',293,2.6,44.2,'ledge'),
    part('belfry-span',{x:295.6,w:1.9,y:48.5,h:4.8},{x:295.6,w:1.9,y:44.2,h:.65},{station:'belfry-span',clayRole:'bridge'}),
    p('sky-bell',297.5,16,44.2,'stone',{goal:true,house:true,arch:true})
  ],
  route:[
    'start','lift1','roof1',['roof-ramp','walk'],['tile-dock','walk'],'tile1','tile2','lookout',
    ['lower-court','fall'],'weight1','counter1','court-roof',['draught-valve','walk'],'draught-step','draught-crown','draught-exit',
    ['garden','fall'],['laundry-entry','fall'],'laundry1','awning1','laundry-high','stair-dock',
    'laundry-stair-0','laundry-stair-1','laundry-stair-2',['laundry-roof','walk'],['laundry-drop','fall'],'laundry-lift','laundry-return','laundry-home',
    ['exchange-step','fall'],['exchange-entry','fall'],'lamp1','lamp2','exchange1','exchange2','weight2','counter2','gallery-low',
    'gallery-high','weight3','counter3','bell-court',['belfry-valve','walk'],'stair1','stair2','bell-rest','belfry-step','belfry-crown',
    ['belfry-span','walk'],['sky-bell','walk']
  ],
  // Three different commitments: an extra climb on the draught, a leftward
  // switchback with a return, and a deliberate drop out of the failing stair —
  // whose pocket doubles as the lower catch if the tiles beat you to it.
  detours:[
    path(['draught-crown','draught-turn','court-flower','draught-turn','draught-crown','draught-exit']),
    path(['laundry-high','laundry-turn','laundry-flower','laundry-turn','laundry-high','stair-dock']),
    path(['stair1',['bell-pocket','fall'],'pocket-awning','stair2'])
  ],
  recoveries:[],
  shaping:[
    {id:'roof-ramp',name:'Stretch a ramp',verb:'Pull right',gesture:'right',parts:['roof-ramp'],x:14,end:31,
     spawn:{x:18,y:3.9,groundId:'roof1'},
     hint:'Drag the orange clay to the right, or hold E / KNEAD, to stretch a walkable ramp. R resets it.'},
    {id:'laundry-stairs',name:'Wall into stairs',verb:'Pull right',gesture:'right',parts:['laundry-stair-0','laundry-stair-1','laundry-stair-2'],x:138,end:152,
     spawn:{x:141,y:22.6,groundId:'stair-dock'},
     hint:'Pull the tall clay wall to the right, or hold E / KNEAD, to knead out three steps.'},
    {id:'belfry-span',name:'Press the last bridge',verb:'Press down',gesture:'down',parts:['belfry-span'],x:288,end:300,
     spawn:{x:294,y:44.2,groundId:'belfry-crown'},
     hint:'Press the clay plug down — drag, hold E / KNEAD, or stomp it — and walk your own bridge to the bell.'}
  ],
  winds:[
    {id:'court-draught',x:80,w:12,y:9,h:12,fx:0,fy:18,channel:'draught'},
    {id:'belfry-draught',x:287.5,w:5.1,y:38,h:9,fx:0,fy:18,channel:'belfry'}
  ],
  circuits:[
    {source:'weight1',channel:'weight-a',targets:['counter1'],kind:'weight'},
    {source:'draught-valve',channel:'draught',targets:['draught-step','draught-crown'],kind:'wind'},
    {source:'weight2',channel:'weight-b',targets:['counter2'],kind:'weight'},
    {source:'weight3',channel:'weight-c',targets:['counter3'],kind:'weight'},
    {source:'belfry-valve',channel:'belfry',targets:['belfry-crown'],kind:'wind'}
  ],
  coins:[
    ...row(10,3.2,2),...row(16,5.2,3),...arc(24,5.2,6,3,4,.9),
    ...row(35.6,9,2),...row(40.6,9.6,2),...row(45.6,10.1,2),
    ...row(52,7.8,3),...row(62,8.6,2),...row(70,10.4,2),...row(76,11.6,2),
    ...arc(83,12.8,4,4.2,4,1),...row(80.8,20.7,2),...row(94,19,3),...row(103,16.4,3),
    ...row(115,14.7,3),...row(123.6,16,2),...arc(129,17,4,4.2,4,.8),
    ...row(126.3,25.2,2),...row(139.5,24,2),...arc(145,26,5,3,4,.7),...row(152,29.3,3),
    ...row(159,26.2,2),...row(170,28.3,2),...row(177,29.3,3),
    ...row(190.5,26.3,3),...row(200,27,2),...row(205.5,27.7,2),...arc(210.5,28.4,10,1.1,4,.9),
    ...row(224,30.2,2),...row(237.5,31.8,3),...row(245.5,34,3),
    ...row(254,34.6,2),...row(267.5,37,3),...row(275,38,2),...row(280,39,2),
    ...arc(289.5,40.8,4,4.4,4,.8),...row(299,45.6,4)
  ],
  stamps:[{x:81.6,y:20.6},{x:127.1,y:25.1},{x:277.2,y:33.8}],
  // Four species, all returning from earlier chapters: the canyon's drifters,
  // the city's own claylings, the caves' bats, and one Echo Spitter above the
  // gallery, where the lower deck is the safe place to read its wind-up.
  enemies:[
    {kind:'drifter',x:20.5,y:5.05,min:18.6,max:22.4,speed:.85,bob:.16,period:5.2,phase:0},
    {x:46.5,y:8.8,min:45.3,max:48,speed:1.4},
    {x:57,y:6.4,min:55,max:59,speed:1.5},
    {kind:'drifter',x:108,y:16.15,min:106,max:110,speed:.95,bob:.18,period:4.8,phase:1.1},
    {kind:'bat',x:154,y:30.6,period:4.6,bob:.55,speed:1.25,min:152,max:156.5},
    {x:180.4,y:27.9,min:179.7,max:181.4,speed:1.6},
    {kind:'drifter',x:195.5,y:26.05,min:194.4,max:196.8,speed:1,bob:.18,period:4.5,phase:2.2},
    {kind:'bat',x:241.5,y:33.8,period:4.6,bob:.55,speed:1.25,min:240.6,max:242.4,phase:1.5},
    {kind:'spitter',x:248.5,y:32.6,min:246.5,max:249.5,speed:.38}
  ],
  hazards:[
    {x:10,w:4.5,y:-2.6},{x:23.05,w:7.8,y:2.2},{x:34,w:11,y:5.6},
    {x:66.4,w:2.7,y:4.6},{x:73.1,w:1.8,y:7.4},{x:81.1,w:5.8,y:9},{x:91.1,w:1.8,y:14.6},{x:99.1,w:1.8,y:13},
    {x:111.1,w:1.8,y:11.5},{x:121.1,w:1.8,y:12.8},{x:126.6,w:1.3,y:13.5},{x:131.3,w:1.1,y:13.5},
    {x:136.6,w:1.8,y:18.5},{x:144.1,w:7,y:20},{x:157.3,w:1.1,y:22},{x:162.6,w:1.3,y:21},
    {x:168.1,w:1.3,y:21},{x:173.6,w:1.3,y:25},{x:182.1,w:1.3,y:24.5},{x:187.6,w:1.8,y:23},
    {x:197.6,w:1.8,y:23.5},{x:203,w:1.9,y:24},{x:208.5,w:1.9,y:24.5},{x:214.6,w:1.8,y:25.5},
    {x:220.6,w:2.3,y:26},{x:228.1,w:2.3,y:25.5},{x:234.2,w:2.2,y:26.8},
    {x:242.6,w:1.8,y:29},{x:250.6,w:2.3,y:31},{x:258.1,w:2.3,y:30.5},{x:264.2,w:2.2,y:30.5},
    {x:272.6,w:1.8,y:31.5},{x:275.5,w:7.5,y:29},{x:287.1,w:1.3,y:36},{x:291.6,w:1.3,y:37.5},
    {x:295.7,w:1.7,y:41}
  ],
  // Chapter four is the last chapter: it only explains what no earlier chapter
  // has explained. Moving, jumping, valves and their rising air, bounce pads,
  // sinking ledges and the Echo Spitter are all taught in chapters one to
  // three, and the clay asks with a hand above it rather than a panel of text.
  hints:[
    {x:50,end:66,title:'Counterweight',text:'Stand on the right end of the beam until the lift locks high.'},
    {x:199,end:210,title:'Blinking decks',text:'Lit decks fade on their own rhythm. Cross each one while it glows.'}
  ],
  guides:[
    {platformId:'draught-crown',offset:.55,dir:-1},{platformId:'draught-crown',offset:3.4,dir:1},
    {platformId:'laundry-high',offset:.55,dir:-1},{platformId:'laundry-high',offset:3.4,dir:1},
    {platformId:'stair1',offset:.5,dir:-1}
  ]
});
