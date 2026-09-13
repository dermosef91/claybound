import {chapter,p,row,arc,path} from '../route-authoring.js';
export default chapter({
  layoutVersion:5,
  name:'The Ember Caverns',short:'Ember Caverns',label:'Wake the heart of the mountain',biome:'cave',
  intro:'Follow the light cables. The way forward sometimes begins above — or below.',
  sky:'#253c57',fog:'#496d91',spawn:{x:1.5,y:0},end:291,previousDistance:965,cameraY:3,
  sections:[
    {x:-8,name:'The Echo Switchback',landmark:'beacon'},
    {x:57,name:'The Furnace Ferry',landmark:'kiln'},
    {x:112,name:'The Turning Heart',landmark:'pulsedrum'},
    {x:163,name:'The Sunken Relay',landmark:'crystal',quiet:true},
    {x:221,name:'The Spitters’ Gallery',landmark:'crystal'},
    {x:253,name:'The Last Light',landmark:'bellgate'}
  ],
  platforms:[
    // The gate is visible from the hub. Climb LEFT, cross its upper relay,
    // then descend a different side of the same room to the unlocked exit.
    p('start',-8,26,0,'stone',{landmark:'beacon'}),
    p('spark-hub',18,39,0,'stone'),
    p('spark-rise',24.5,4.5,3.7,'ledge'),
    p('spark-turn',18.5,4.5,5.5,'ledge'),p('spark-balcony',25,10,7.3,'ledge',{landmark:'beacon'}),
    p('spark-relay',32,1.8,7.43,'switch',{channel:'spark-lock',latch:true}),
    p('spark-return-low',30.5,4,2.25,'ledge'),
    p('spark-gate',47,1.6,13,'gate',{h:13,channel:'spark-lock'}),
    p('spark-flower',12.5,3.5,7.2,'ledge',{optional:true}),
    // Lean towards an end of the ferry to drive; its centre is a brake.
    // Upper niches are safe places to leave the rail and find a flower.
    p('ferry-dock',57,10,0,'stone',{checkpoint:62,landmark:'kiln'}),
    p('furnace-ferry',66,5,0,'ferry',{travel:26,speed:3.2}),
    p('ferry-niche',73.5,2.5,2.2,'ledge',{optional:true}),
    p('ferry-loft',79.5,4.5,4.1,'ledge',{optional:true}),
    p('press-switch',80.8,1.8,4.23,'switch',{channel:'press-a',duration:12,optional:true}),
    p('press-bridge',84.5,2.5,6,'timed',{channel:'press-a',optional:true}),
    p('ferry-exit',96,16,0,'stone',{landmark:'beacon'}),
    // Two suspended cradles circle a common axle. Ride upwards and step off
    // at the high balcony; the relay opens the gate back at floor level.
    p('heart-entry',112,11,0,'stone',{checkpoint:118,landmark:'pulsedrum'}),
    p('heart-boarding',125,4,.8,'ledge'),
    p('heart-paddle',132,3.4,6,'orbit',{moveX:5.4,moveY:5.4,period:12,phase:-Math.PI/2}),
    p('heart-paddle-back',132,3.4,6,'orbit',{moveX:5.4,moveY:5.4,period:12,phase:Math.PI/2}),
    p('heart-balcony',140.5,10,9.7,'ledge',{checkpoint:146,landmark:'beacon'}),
    p('heart-relay',147.5,1.8,9.83,'switch',{channel:'heart-lock',latch:true}),
    p('heart-descent',152,4,6,'ledge'),p('heart-return',147,4,2.7,'ledge'),
    p('heart-floor',142,21,0,'stone',{checkpoint:153}),
    p('heart-gate',158,1.6,17,'gate',{h:17,channel:'heart-lock'}),
    p('heart-catch',124,17,-2.6,'ledge',{recovery:true}),
    p('heart-reboard',123.5,3.5,-1,'ledge',{recovery:true}),
    // A safe drop-through hatch reveals a submerged relay. The lift always
    // returns; its upper stop offers a left-hand flower branch or the exit.
    p('vault-entry',163,11,0,'stone',{checkpoint:168,landmark:'crystal',rest:true}),
    p('sluice-hatch',174,6,0,'ledge'),
    p('sluice-bottom',175,10,-3.2,'ledge',{landmark:'beacon'}),
    p('sluice-relay',177.5,1.8,-3.07,'switch',{channel:'sluice-lock',latch:true}),
    p('sluice-lift',185,4,1.5,'lift',{moveY:4.7,period:6.5,phase:-Math.PI/2}),
    p('sluice-balcony',191,8,5,'ledge',{checkpoint:194,landmark:'crystal'}),
    p('sluice-branch',185,4,6.6,'ledge',{optional:true}),
    p('sluice-flower',179,3.5,8.4,'ledge',{optional:true}),
    p('sluice-step',201,4,2.2,'ledge'),p('sluice-floor',205,16,0,'stone',{checkpoint:214}),
    p('sluice-gate',209,1.6,16,'gate',{h:16,channel:'sluice-lock'}),
    p('sluice-catch',184,17,-3.2,'ledge',{recovery:true}),
    // Learn to read cheeks, use rock cover, then close the distance to stomp.
    p('gallery-entry',221,10,0,'stone',{checkpoint:226,landmark:'crystal'}),
    p('gallery-cover',229,3,1.8,'stone'),
    p('gallery-crumble',234,4,1.8,'crumble',{delay:1}),
    p('gallery-watch',240,8,1.8,'stone'),
    p('gallery-out',250,7,.4,'stone',{checkpoint:254}),
    // One final upper switch opens a lower bridge. A short pulse descent is
    // the finale, not another long staircase of identical islands.
    p('last-step',258,4,2,'ledge'),p('last-turn',253,4,3.8,'ledge'),
    p('last-relay-floor',259,7,5.6,'ledge',{landmark:'beacon'}),
    p('last-relay',263,1.8,5.73,'switch',{channel:'last-light',latch:true}),
    p('last-return',268,4,2.8,'ledge'),p('last-bridge',273,4,1.4,'timed',{channel:'last-light'}),
    p('last-pulse',279,4,.8,'pulse',{period:4.8,duty:.78,phase:.15}),
    p('ember-bell',287,12,0,'stone',{goal:true,landmark:'bellgate'})
  ],
  route:[
    'start',['spark-hub','walk'],'spark-return-low','spark-rise','spark-turn','spark-balcony',['spark-relay','walk'],
    ['spark-balcony','walk'],['spark-return-low','fall'],['spark-hub','fall'],['ferry-dock','walk'],
    ['furnace-ferry','walk'],['ferry-exit','ride'],['heart-entry','walk'],'heart-boarding',['heart-paddle','board'],['heart-balcony','ride'],
    ['heart-relay','walk'],['heart-descent','fall'],['heart-return','fall'],['heart-floor','fall'],['vault-entry','walk'],
    ['sluice-hatch','walk'],['sluice-relay','fall'],['sluice-bottom','walk'],['sluice-lift','board'],['sluice-balcony','ride'],
    ['sluice-step','fall'],['sluice-floor','fall'],['gallery-entry','walk'],'gallery-cover','gallery-crumble','gallery-watch',
    ['gallery-out','fall'],'last-step','last-turn','last-relay-floor',['last-relay','walk'],['last-return','fall'],
    ['last-bridge','fall'],'last-pulse','ember-bell'
  ],
  detours:[
    path(['spark-turn','spark-flower',['spark-turn','fall']]),
    path(['furnace-ferry','ferry-niche','press-switch','press-bridge','press-switch','ferry-niche',['furnace-ferry','board'],['ferry-exit','ride']]),
    path(['sluice-balcony','sluice-branch','sluice-flower',['sluice-branch','fall'],['sluice-balcony','fall']])
  ],
  recoveries:[path(['heart-catch','heart-reboard','heart-boarding']),path(['sluice-catch','sluice-lift',['sluice-balcony','ride']])],
  circuits:[
    {source:'spark-relay',channel:'spark-lock',targets:['spark-gate'],kind:'relay'},
    {source:'press-switch',channel:'press-a',targets:['press-bridge'],kind:'relay'},
    {source:'heart-relay',channel:'heart-lock',targets:['heart-gate'],kind:'relay'},
    {source:'sluice-relay',channel:'sluice-lock',targets:['sluice-gate'],kind:'relay'},
    {source:'last-relay',channel:'last-light',targets:['last-bridge'],kind:'relay'}
  ],
  crushers:[
    {x:77,y:5.2,floorY:0,range:4.55,period:5.4,w:2,holdChannel:'press-a'},
    {x:88,y:5.2,floorY:0,range:4.55,period:5.4,w:2,phase:Math.PI,holdChannel:'press-a'}
  ],
  coins:[
    ...row(4,1,5),...row(25.3,4.7,2),...row(19.3,6.5,2),...row(27,8.3,4),
    ...arc(34,7.9,5,-3,3,.4),...row(42,1,4),...row(59,1,3),...row(70,1,7,3.4),
    ...row(75,3.2,2),...row(80,5.1,3),...row(98,1,4),...row(114,1,3),
    ...arc(129,1.6,10,8,5,1),...row(142,10.7,4),...row(151,1,4),
    ...row(176,-2.2,4),...Array.from({length:4},(_,i)=>({x:187,y:-1+i*1.5})),...row(192,6,3),...row(211,1,3),
    ...row(223,1,3),...row(230,2.8,2),...row(235,2.8,2),...row(241,2.8,4),
    ...row(254,4.8,2),...row(260,6.6,3),...row(274,2.4,2),...row(280,1.8,2),...row(288,1,5)
  ],
  stamps:[{x:14,y:8.2},{x:85.5,y:7.25},{x:180.7,y:9.4}],
  enemies:[
    {kind:'spitter',x:29,y:0,min:26.5,max:31.5,speed:.38},
    {kind:'bat',x:144,y:10.7,min:141.5,max:144.8,speed:1.1,bob:.3,period:5.5,phase:1},
    {kind:'spitter',x:198,y:5,min:192,max:198,speed:.38},
    {kind:'spitter',x:245,y:1.8,min:241,max:247,speed:.38},
    {kind:'bat',x:271,y:3.8,min:269,max:271.5,speed:1.1,bob:.3,period:5,phase:1.5}
  ],
  hazards:[
    {x:67,w:29,y:-4.6},{x:123,w:19,y:-5.5},{x:231,w:9,y:-3.5},
    {x:248,w:2,y:-3.5},{x:257,w:30,y:-4.8},{x:180.5,w:2.4,y:-5.6}
  ],
  hints:[
    {x:24,end:32,title:'Follow the cable',text:'The relay above opens the grate below. Explore up, then return.'},
    {x:58,end:67,title:'Steer with your weight',text:'Stand near an end to drive the ferry. Its centre brakes. Watch the press lamps.'},
    {x:124,end:132,title:'Ride the turning heart',text:'Board a cradle, stay near its centre, and step off at the upper balcony.'},
    {x:170,end:180,title:'Something below',text:'Stomp on the thin shelf to drop through. The lift will bring you back.'},
    {x:20,end:24,y:0,title:'Cheeks mean trouble',text:'A swelling mouth warns of a shot. Use stone cover, then jump onto the spitter.'}
  ],
  guides:[
    {platformId:'spark-rise',offset:1,dir:-1},{platformId:'spark-balcony',offset:1,dir:1},
    {platformId:'heart-balcony',offset:7,dir:1},
    {platformId:'heart-return',offset:2,dir:0},{platformId:'sluice-hatch',offset:3,dir:0},
    {platformId:'sluice-branch',offset:1,dir:-1},{platformId:'last-step',offset:1,dir:-1}
  ]
});
