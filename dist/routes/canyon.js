import {chapter,p,row,arc,path} from '../route-authoring.js';
export default chapter({
  layoutVersion:5,
  name:'The Sunbaked Canyon',short:'Sunbaked Canyon',label:'Windwells & ropeways',biome:'desert',
  intro:'Wake the windwells. Ride the sandstone sky to the caravan bell.',
  sky:'#80afe0',fog:'#f1bba0',spawn:{x:1.5,y:0},end:246,previousDistance:815,cameraY:2,
  sections:[{x:-8,name:'The Caravan Steps',landmark:'arch'},{x:43,name:'Wake the Windwell',landmark:'windmill'},{x:91,name:'The Sinking Shortcut',landmark:'sandwheel'},{x:143,name:'Inside the Great Arch',landmark:'arch',quiet:true},{x:191,name:'The Sky-Sand Run',landmark:'windmill'}],
  platforms:[
    p('start',-8,18,0),p('lift1',12,4,.9,'lift',{moveY:.85,period:4.8,phase:-1.57}),
    p('arrival',18,6,2),p('notch',26,3.8,3.2,'ledge'),p('rope-cross',32,4,3.7,'lift',{moveX:1.1,period:5.2}),
    p('lookout',38,5,4.3),p('windwell',43,7,4.3,'stone',{checkpoint:45,landmark:'windmill',rest:true}),
    p('valve1',47,1.8,4.43,'switch',{channel:'wind-a',latch:true}),p('wind-step',52,4,5.6,'ledge'),
    p('wind-crown',57,4,10.1,'ledge'),p('wind-turn',53.5,3.2,11.8,'ledge'),p('wind-exit',62,6,11.5),
    p('downstep',70,3.6,10,'ledge'),p('wind-gondola',76,4,9.6,'lift',{moveX:1.15,moveY:.55,period:5}),
    p('oasis',83,8,9.2,'stone',{landmark:'oasis',rest:true}),p('basin',91,7,9.2,'stone',{checkpoint:93,landmark:'sandwheel'}),
    p('sand1',100,3.8,9.6,'crumble',{delay:1.2}),p('sand2',106,3.6,10.3,'crumble',{delay:1}),p('sand3',112,3.8,10.1,'crumble',{delay:.9}),
    p('sand-rest',118,5,10.8),p('sand4',125,3.6,11.4,'crumble',{delay:1}),p('sand5',131,3.8,10.6,'crumble',{delay:.9}),
    p('arch-entry',137,13,9.4,'stone',{checkpoint:145,landmark:'arch',rest:true}),p('arch-shelf',152,4,10.6,'ledge'),
    p('arch-lift',158,4,12.2,'lift',{moveY:2.2,period:5.8,phase:-1.57}),p('arch-balcony',164,4,15,'ledge'),
    p('arch-return',159,3.4,16.7,'ledge'),p('arch-roof',170,6,16),
    p('arch-bridge-left',175.9,1.1,13.37),p('arch-drop',176.85,5.65,13.43,'bridge'),p('arch-bridge-right',182.35,1.15,13.37),
    p('last-rest',183.35,7.65,12.6,'stone',{checkpoint:187,landmark:'oasis',rest:true}),p('last-well',191,6,12.6,'stone',{landmark:'windmill'}),
    p('valve2',194,1.8,12.73,'switch',{channel:'wind-b',latch:true}),
    p('sky-lift',205,4,16,'lift',{moveY:1,period:5.2,phase:-.8}),p('sky2',212,4,19.4,'ledge'),
    p('sky-rest',218,5,20,'stone',{checkpoint:220}),p('sky-sand',225,3.7,20.7,'crumble',{delay:1}),
    p('sky-rope',231,4,21.5,'lift',{moveX:.7,moveY:.65,period:4.8}),p('bell-roof',238,15,22,'stone',{goal:true,landmark:'bellgate'}),
    p('well-flower',50,3.2,13.5,'ledge',{optional:true}),p('basin-flower',106,3.2,7.75,'ledge',{optional:true}),p('arch-flower',162.5,3.2,18.3,'ledge',{optional:true}),
    p('clay-1',199.25,4,13.5,'crumble')
  ],
  route:['start','lift1','arrival','notch','rope-cross','lookout',['windwell','walk'],['valve1','walk'],'wind-step','wind-crown','wind-exit','downstep','wind-gondola','oasis',['basin','walk'],'sand1','sand2','sand3','sand-rest','sand4','sand5','arch-entry','arch-shelf','arch-lift','arch-balcony','arch-roof',['arch-bridge-left','fall'],['arch-drop','walk'],['arch-bridge-right','walk'],['last-rest','fall'],['last-well','walk'],['valve2','walk'],'clay-1','sky-lift','sky2','sky-rest','sky-sand','sky-rope','bell-roof'],
  detours:[path(['wind-crown','wind-turn','well-flower','wind-turn','wind-crown','wind-exit']),path(['sand2',['basin-flower','fall'],'sand3']),path(['arch-balcony','arch-return','arch-flower','arch-roof'])],
  recoveries:[],
  winds:[{id:'well-a',x:50,w:12,y:3.5,h:10,fx:0,fy:19,channel:'wind-a'},{id:'tailwind',x:124,w:11,y:8,h:7,fx:8,fy:0},{id:'well-b',x:197,w:19,y:11,h:11,fx:3,fy:18,channel:'wind-b'}],
  circuits:[{source:'valve1',channel:'wind-a',targets:['wind-step','wind-crown'],kind:'wind'},{source:'valve2',channel:'wind-b',targets:['sky2'],kind:'wind'}],
  coins:[...row(4,1,3),...arc(9,1,10,2,5,1.7),...row(27,4.3,2),...row(44,5.3,2),...arc(53,6.6,5,4.7,5,.5),...row(71,11,2),...row(84,10.2,3),...row(101,10.7,2),...row(107,11.3,2),...row(113,11.1,2),...row(126,12.4,2),...row(144,10.4,3),...arc(159,13,6,3.1,5,1),...row(185.15,13.6,2,1.32),{x:206.375,y:15.570183432365091},...arc(200,15,13,5.5,7,1).slice(1),...row(219,21,2),...row(239,23,5)],
  stamps:[{x:51.6,y:14.5},{x:107.75,y:8.5},{x:164,y:19.3}],
  // Roomy arrival/rest platforms introduce the soft drifters before the windy
  // rooftop patrol. No required crossing depends on bouncing on one.
  enemies:[
    {kind:'drifter',x:21,y:3.15,min:19.2,max:22.8,speed:.85,bob:.16,period:5.2,phase:0},
    {kind:'drifter',x:121,y:11.95,min:119.1,max:122.1,speed:.95,bob:.18,period:4.8,phase:1.1},
    {kind:'drifter',x:173,y:17.15,min:171,max:175,speed:1.05,bob:.2,period:4.5,phase:2.2},
    {kind:'drifter',x:59,y:11.3,min:57.8,max:60.2,speed:.8,bob:.15,period:5.6,phase:.8}
  ],
  hazards:[{x:10,w:8,y:-4},{x:24,w:14,y:-2},{x:68,w:15,y:4.8},{x:98,w:39,y:2},{x:150,w:20,y:6},{x:176,w:8,y:7.5},{x:197,w:21,y:7.5},{x:223,w:15,y:15}],
  hints:[{x:0,end:9,icon:'walk',title:'Move and jump',text:'A / D or arrows to move. Hold jump to leap farther.'},{x:43,end:51,icon:'updraft',title:'Windwell',text:'Step on the cream valve. The rising wind lifts your jumps.'},{x:91,end:100,icon:'sink',title:'Sinking ledges',text:'Pale ledges sink once you land. Keep moving.'}],
  guides:[{platformId:'wind-crown',offset:.55,dir:-1},{platformId:'arch-balcony',offset:.55,dir:-1},{platformId:'arch-balcony',offset:3.4,dir:1}]
});
