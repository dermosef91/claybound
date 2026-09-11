import {chapter,p,row,arc,path} from '../route-authoring.js';
export default chapter({
  name:'The Hanging Quarter',short:'Hanging Quarter',label:'Weights, rooftops & sky bells',biome:'citadel',
  intro:'Your weight wakes the old ropeways. Climb the blue city to its highest bell.',
  sky:'#86a6c5',fog:'#91abc3',spawn:{x:4.75,y:0},end:305.5,previousDistance:1002.5,cameraY:2.15,
  sections:[{x:-8,name:'The Familiar Rooftops',landmark:'opening'},{x:55,name:'Counterweight Court',landmark:'counterweight'},{x:117,name:'Laundry Switchbacks',landmark:'bannerarch'},{x:181,name:'Gondola Exchange',landmark:'counterweight'},{x:247,name:'The Sky Bell',landmark:'bellgate'}],
  platforms:[
    p('start',-8,18,0,'stone',{arch:true,entrance:true}),p('lift1',9,4,1.65,'lift',{moveY:.9,period:5.6}),p('roof1',14.55,8.5,3.9,'stone',{house:true,checkpoint:16}),
    p('balcony1',25,3.2,5.1,'ledge'),p('gondola1',30,4,5.4,'lift',{moveX:1.1,period:5}),p('roof2',36,7,6.4,'stone',{arch:true,house:true}),
    p('lower-court',45,10,3.4,'stone',{checkpoint:48,landmark:'counterweight'}),p('weight1',57,5.5,4.2,'balance',{channel:'weight-a'}),p('counter1',65,4,3.2,'counter',{channel:'weight-a',rise:2.8}),
    p('weight-roof',71,6,7,'stone',{house:true}),p('weight-step',79,3.5,8.2,'ledge'),p('weight2',84.5,5.5,8.5,'balance',{channel:'weight-b'}),p('counter2',92,4,7.6,'counter',{channel:'weight-b',rise:2.9}),
    p('garden',98,10,11.4,'stone',{checkpoint:102,landmark:'oasis',house:true,rest:true}),p('garden-balcony',110,4,12.5,'ledge'),
    p('laundry-entry',116,8,13.3,'stone',{checkpoint:120,landmark:'bannerarch'}),p('laundry1',126,3.5,14.6,'ledge'),p('laundry2',131.5,3.5,16,'ledge'),
    p('laundry-back',126.5,3.5,17.5,'ledge'),p('laundry-upper',133,4,18.8,'ledge'),p('laundry-roof',139,6,19.4,'stone',{arch:true,house:true}),
    p('laundry-drop',147,4,16.4,'ledge'),p('laundry-lift',153,4,16,'lift',{moveY:1.8,period:5.4,phase:-1.57}),p('laundry-return',159,4,18.5,'ledge'),
    p('laundry-home',165,7,19.5,'stone',{checkpoint:168,house:true}),p('exchange-step',174,4,18.1,'ledge'),p('exchange-entry',180,8,16.5,'stone',{checkpoint:183,landmark:'counterweight'}),
    p('exchange1',190,4,17.2,'lift',{moveX:1,moveY:.4,period:5.2,phase:-.6}),p('exchange2',196,4,18.3,'lift',{moveX:1,moveY:.4,period:5.2,phase:2.54}),
    p('exchange-tower',203,6,19,'stone',{house:true}),p('weight3',211,5.5,19.7,'balance',{channel:'weight-c'}),p('counter3',219,4,18.8,'counter',{channel:'weight-c',rise:2.8}),
    p('exchange-roof',225,6,22.6,'stone',{arch:true,checkpoint:228}),p('exchange-drop',233,4,20.8,'ledge'),p('bell-court',239,8,19.2,'stone',{checkpoint:243,landmark:'bellgate',rest:true}),
    p('weight4',249,5.5,20,'balance',{channel:'weight-d'}),p('counter4',257,4,18.9,'counter',{channel:'weight-d',rise:3}),p('bell-balcony',263,4,23,'ledge'),p('bell-back',258.5,3.4,24.5,'ledge'),
    p('bell-roof1',265,5,25.8,'stone',{house:true}),p('bell-lift1',272,4,26.4,'lift',{moveX:.6,moveY:.6,period:4.8,phase:.2}),
    p('bell-lift2',278,4,27.5,'lift',{moveX:.6,moveY:.6,period:4.8,phase:2}),p('bell-roof2',285,5,28.4,'stone',{checkpoint:287}),p('bell-step',292,3.5,29.8,'ledge'),p('sky-bell',297.5,16,31,'stone',{goal:true,house:true,arch:true}),
    p('court-flower',73,3,9.2,'ledge',{optional:true}),p('laundry-flower',129.5,3,20.7,'ledge',{optional:true}),p('exchange-flower',228,3,24.8,'ledge',{optional:true})
  ],
  route:['start','lift1','roof1','balcony1','gondola1','roof2',['lower-court','fall'],'weight1','counter1','weight-roof','weight-step','weight2','counter2','garden','garden-balcony','laundry-entry','laundry1','laundry2','laundry-back','laundry-upper','laundry-roof',['laundry-drop','fall'],'laundry-lift','laundry-return','laundry-home',['exchange-step','fall'],['exchange-entry','fall'],'exchange1','exchange2','exchange-tower','weight3','counter3','exchange-roof',['exchange-drop','fall'],['bell-court','fall'],'weight4','counter4','bell-balcony','bell-back','bell-roof1','bell-lift1','bell-lift2','bell-roof2','bell-step','sky-bell'],
  detours:[path(['weight-roof','court-flower',['weight-roof','fall']]),path(['laundry-upper','laundry-flower','laundry-upper']),path(['exchange-roof','exchange-flower',['exchange-roof','fall']])],
  circuits:[{source:'weight1',channel:'weight-a',targets:['counter1'],kind:'weight'},{source:'weight2',channel:'weight-b',targets:['counter2'],kind:'weight'},{source:'weight3',channel:'weight-c',targets:['counter3'],kind:'weight'},{source:'weight4',channel:'weight-d',targets:['counter4'],kind:'weight'}],
  coins:[...row(10,3.3,2),...row(19,4.9,3),...row(26,6.1,2),...row(37,7.4,3),...row(47,4.4,3),...row(60,5.2,2),...row(72,8,3),...row(87,9.5,2),...row(100,12.4,4),...row(119,14.3,2),...row(127,15.6,2),...row(132,17,2),...row(127,18.5,2),...row(140,20.4,3),...row(166,20.5,3),...row(181,17.5,3),...arc(190,18.5,10,1,5,1),...row(214,20.7,2),...row(226,23.6,3),...row(241,20.2,3),...row(252,21,2),...row(264,24,2),...row(259,25.5,2),...row(266,26.8,3),...arc(273,28,8,1.2,4,1),...row(299,32,5)],
  stamps:[{x:74.5,y:10.2},{x:131,y:21.7},{x:229.5,y:25.8}],
  enemies:[{x:21,y:3.9,min:19,max:22.3,speed:1.5},{x:41,y:6.4,min:38,max:42.1,speed:1.6},{x:142,y:19.4,min:139.7,max:144.2,speed:1.7},{x:206,y:19,min:203.8,max:208.2,speed:1.7}],
  hazards:[{x:10,w:4.55,y:-2.65},{x:23.05,w:12.95,y:.6},{x:55,w:16,y:-.7},{x:77,w:21,y:3},{x:108,w:8,y:7},{x:124,w:15,y:9},{x:145,w:20,y:10},{x:172,w:8,y:12},{x:188,w:15,y:11.5},{x:209,w:16,y:14},{x:231,w:8,y:14},{x:247,w:18,y:14},{x:270,w:15,y:20},{x:290,w:7.5,y:24}],
  hints:[{x:55,end:67,title:'You are the counterweight',text:'Stand on the right end of the beam. Hold it down until the connected lift locks high.'},{x:181,end:203,title:'Meet in the middle',text:'The two gondolas move together. Jump across when the gap closes.'}],
  guides:[{platformId:'laundry2',offset:.5,dir:-1},{platformId:'laundry-back',offset:1.5,dir:1},{platformId:'bell-balcony',offset:1,dir:-1},{platformId:'bell-back',offset:1.5,dir:1}]
});
