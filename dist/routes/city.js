import {chapter,p,row,arc,path} from '../route-authoring.js';

// Chapter four is the mastery chapter: it teaches nothing of its own without
// also asking for something learned earlier. Counterweights and gondolas stay
// its signature, but the canyon's draughts, the wildwood's springs, the caves'
// pulse decks and shooters all return — and the player's own hands, kneading
// clay, open three of its gates, the last being the bridge to the bell itself.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});

export default chapter({
  layoutVersion:5,
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
    p('tile-dock',30.85,3,7.2,'stone'),
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
    p('draught-exit',93,6,17.6,'stone'),
    p('garden',101,10,15,'stone',{landmark:'oasis',house:true,rest:true}),

    // 03 · Laundry Switchbacks — awning springs, a leftward return, a kneaded stair.
    p('laundry-entry',113,8,13.3,'stone',{checkpoint:116,landmark:'bannerarch'}),
    p('laundry1',123,3.5,14.6,'ledge'),
    p('awning1',128,3.2,15.4,'spring'),
    p('laundry-high',132.5,4,20.6,'ledge'),
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
    p('sky-bell',297.5,16,44.2,'stone',{goal:true,house:true,arch:true}),

    // Editor-authored revision: alternate high route through the court and laundry approach.
    p('clay-1',74,2.25,22,'crumble',{delay:.35}),
    p('clay-1-copy-1',78.5,2.25,19.75,'crumble',{delay:.35}),
    p('clay-1-copy-1-copy-1',82.75,2.25,18,'crumble',{delay:.35}),
    p('clay-2',125.5,4,25.25,'lift',{moveY:5,period:5}),
    p('clay-3',116.5,4,27.5,'orbit',{moveX:4,moveY:4,period:12}),
    p('clay-4',108.75,3,27.25,'crumble',{delay:.15}),
    p('clay-3-copy-1',116.5,4,27.5,'orbit',{moveX:4,moveY:4,period:12,phase:2}),
    p('clay-3-copy-1-copy-1',116.75,4,27.5,'orbit',{moveX:4,moveY:4,period:12,phase:4})
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
    path(['draught-crown','draught-exit']),
    path(['laundry-high','stair-dock']),
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
    {x:11.1,y:3.2},{x:25.2,y:6.329006727063226},{x:26.4,y:7.255950864665639},{x:27.6,y:7.855950864665639},{x:28.8,y:8.129006727063226},
    {x:36.7,y:9},{x:41.7,y:9.6},{x:46.7,y:10.1},{x:63.1,y:8.6},{x:71.1,y:10.4},{x:83.8,y:14.227785252292474},
    {x:84.6,y:15.431056516295154},{x:85.4,y:16.271056516295154},{x:96.2,y:19},{x:105.75,y:16.75},{x:130,y:18.25},{x:131,y:20.5},
    {x:139.5,y:24},{x:140.6,y:24},{x:146,y:27.011449676604734},{x:147,y:27.865739561406606},{x:148,y:28.465739561406608},
    {x:149,y:28.81144967660473},{x:159,y:26.2},{x:160.1,y:26.2},{x:170,y:28.3},{x:171.1,y:28.3},{x:177,y:29.3},
    {x:178.1,y:29.3},{x:179.2,y:29.3},{x:190.5,y:26.3},{x:191.6,y:26.3},{x:192.7,y:26.3},{x:200,y:27},{x:201.1,y:27},
    {x:205.5,y:27.7},{x:206.6,y:27.7},{x:212.5,y:29.149006727063224},{x:214.5,y:29.695950864665637},
    {x:216.5,y:29.915950864665636},{x:218.5,y:29.809006727063224},{x:224,y:30.2},{x:225.1,y:30.2},{x:247.7,y:34},
    {x:255.1,y:34.6},{x:267,y:37},{x:276.1,y:38},{x:281.1,y:39},{x:290.3,y:42.150228201833976},
    {x:291.1,y:43.320845213036115},{x:291.9,y:44.20084521303612},{x:292.7,y:44.790228201833976},
    {x:299,y:45.6},{x:300.1,y:45.6},{x:301.2,y:45.6},{x:302.3,y:45.6}
  ],
  stamps:[{x:75.25,y:22.75},{x:277.2,y:33.8},{x:110.25,y:28.5}],
  // Four species, all returning from earlier chapters: the canyon's drifters,
  // the city's own claylings, the caves' bats, and one Echo Spitter above the
  // gallery, where the lower deck is the safe place to read its wind-up.
  enemies:[
    {x:46.5,y:8.8,min:45.3,max:48,speed:1.4},
    {x:57,y:6.4,min:55,max:59,speed:1.5},
    {kind:'bat',x:154,y:28.5,period:4.6,bob:.55,speed:1.25,min:152,max:156.5},
    {x:180.4,y:27.9,min:179.7,max:181.4,speed:1.6},
    {kind:'bat',x:241.5,y:33.8,period:4.6,bob:.55,speed:1.25,min:240.6,max:242.4,phase:1.5},
    {x:18.25,y:3.75,min:18.25,max:22,speed:1.5}
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
    {x:295.7,w:1.7,y:41},{x:117.25,w:2.25,y:27.75}
  ],
  // Chapter four is the last chapter: it only explains what no earlier chapter
  // has explained. The first clay encounter pairs its gesture hand with one
  // short input hint; later clay relies on the learned gesture alone.
  hints:[
    {x:14,end:31,icon:'ramp',title:'Shape the clay',text:'Drag and drop the clay to move it, or hold E.',touchText:'Drag and drop the clay to move it.'},
    {x:50,end:66,title:'Counterweight',text:'Stand on the right end of the beam until the lift locks high.'},
  ],
  guides:[
    {platformId:'draught-crown',offset:.55,dir:-1},{platformId:'draught-crown',offset:3.4,dir:1},
    {platformId:'laundry-high',offset:.55,dir:-1},{platformId:'laundry-high',offset:3.4,dir:1},
    {platformId:'stair1',offset:.5,dir:-1}
  ]
});
