import {chapter,makeRoom,p,path} from '../route-authoring.js';
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
// Two thirds of the way up, the brittle canopy gives out entirely: a tear in
// the leaves too wide to cross. The chapter below is the route as it was walked
// before that tear opened; everything from TEAR rightwards is pushed along by
// GAP, and the Weaver's Gap is built into the space afterwards.
const TEAR=192,GAP=38;
const L=makeRoom({
  layoutVersion:10,
  name:'The Wildwood',short:'Wildwood',label:'Bounce, burrow & bloom',biome:'forest',
  intro:'Climb the living tree. Break its sealed roots and let the forest breathe.',
  sky:'#b2d2b7',fog:'#b7d2bc',spawn:{x:1.5,y:0},end:315,previousDistance:1000,cameraY:3,
  boss:{kind:'mother-puff',x:303,y:33.4,left:275,right:307,triggerX:276},
  sections:[{x:-8,name:'Mushroom Choir',landmark:'mushroom'},{x:48,name:'Under the Roots',landmark:'rootarch'},{x:99,name:'The Breathing Tree',landmark:'sporepod'},{x:157,name:'Brittle Canopy',landmark:'birdhouse',backdrop:'waterfall'},{x:213,name:'Heartwood Bloom',landmark:'mushroom'},{x:264,name:'The Still Clearing',landmark:'mushroom'}],
  platforms:[
    p("start",-8,19,0,"stone"),
    p("spring1",8,1.8,0.44,"spring"),
    p("first-bough",14,6,4.5,"ledge",{"scenery":"branch"}),
    p("choir-step",22,3.5,5.7,"ledge"),
    p("choir-perch",27,5,6.6,"ledge"),
    p("choir-base",33,6,3.1,"stone",{"landmark":"mushroom"}),
    p("choir-spring",36.5,1.8,3.54,"spring"),
    p("choir-crown",42,6,7.8,"ledge"),
    p("root-entry",48,7,7.8,"ledge",{"checkpoint":51,"landmark":"rootarch"}),
    p("root-floor",55,12,2.6,"ledge",{"checkpoint":64,"landmark":"sporepod"}),
    p("root-bridge",69,4,3.5,"ledge"),
    p("root-spring-base",75,5,3.8,"stone"),
    p("root-spring",77,1.8,4.24,"spring"),
    p("root-upper",83,5,8.5,"ledge"),
    p("root-crumble",90,3.8,9.3,"crumble",{"delay":0.95}),
    p("tree-foot",96,8,8.1,"stone",{"checkpoint":101,"landmark":"rootarch"}),
    p("tree-spring",102,1.8,8.54,"spring"),
    p("tree-east",108,4.5,12.8,"ledge"),
    p("tree-west",103.25,3.3,15.25,"ledge"),
    p("tree-west-spring",104,1.8,15.75,"spring"),
    p("tree-top",110,5,19.2,"ledge"),
    p("tree-seal",118,4,19.75,"break",{"releases":"tree-spores"}),
    p("tree-heart",116,10,14,"ledge",{"checkpoint":124.2,"landmark":"sporepod"}),
    p("spore1",128,4,15.6,"ledge"),
    p("spore2",134,4,20.2,"ledge"),
    p("spore-crown",140,5,22,"ledge"),
    p("bird-rest",147,10,20,"ledge",{"checkpoint":151,"landmark":"birdhouse","rest":true}),
    p("canopy-entry",157,6,20,"ledge",{"landmark":"rootarch"}),
    p("crumb1",165,3.5,20.8,"crumble",{"delay":1}),
    p("crumb2",170.5,3.5,21.6,"crumble",{"delay":0.9}),
    p("canopy-rest",176,4.5,22,"ledge"),
    p("crumb3",182.5,3.5,22.5,"crumble",{"delay":0.85}),
    p("crumb4",188,3.5,21.7,"crumble",{"delay":0.9}),
    p("canopy-nest",194,6,20.5,"ledge",{"landmark":"birdhouse"}),
    p("nest-spring",198,1.8,20.94,"spring"),
    p("bloom-entry",204,9,25,"ledge",{"checkpoint":208,"landmark":"mushroom"}),
    p("bloom-spring",211,1.8,25.44,"spring"),
    p("bloom1",217,4.2,29.8,"ledge"),
    p("bloom-seal",223.2,4,29.8,"break",{"releases":"bloom-spores"}),
    p("bloom-root",223,8,24.5,"ledge",{"checkpoint":229,"landmark":"sporepod"}),
    p("bloom-rise",233,4,26.3,"ledge"),
    p("bloom-cloud",239,4,30.8,"crumble",{"delay":1.2}),
    p("bloom-perch",245,5,32.3,"ledge"),
    p("bloom-last",252,3.5,33.4,"ledge"),
    p("heart-bell",257.5,14,33.4,"ledge",{"checkpoint":264}),
    p("mother-arena",271.5,38,33.4,"stone",{"motherArena":true}),
    p("mother-bell",309.5,10,33.4,"ledge",{"bellX":5.5,"goal":true}),
    p("clay-1",112.5,2,19.5,"spring"),
    p("clay-2",116.5,2,14.5,"spring"),
    p("clay-3",219,3.25,26,"ledge"),
    p("clay-4",219.5,2,26.5,"spring"),
    p("clay-5",210.5,2.5,32,"crumble",{"delay":0.35}),
    p("clay-6",205.25,2.25,33,"crumble",{"delay":0.35}),
    p("clay-7",199.75,2.5,34.75,"crumble",{"delay":0.35}),
    p("clay-8",194.5,3,36.5,"ledge"),
    p("clay-9",194.75,2.25,37,"spring")
  ],
  route:['start',['spring1','walk'],'first-bough','choir-step','choir-perch',['choir-base','fall'],['choir-spring','walk'],'choir-crown',['root-entry','walk'],['root-floor','fall'],'root-bridge','root-spring-base',['root-spring','walk'],'root-upper','root-crumble','tree-foot',['tree-spring','walk'],'tree-east','tree-west',['tree-west-spring','walk'],'tree-top',['clay-1','walk'],'tree-seal',['tree-heart','drop'],'spore1','spore2','spore-crown','bird-rest',['canopy-entry','walk'],'crumb1','crumb2','canopy-rest','crumb3','crumb4',
    'gap-brink','weave-bough','weave-perch',['weave-spring','walk'],'weave-mound',
    'canopy-nest',['nest-spring','walk'],'bloom-entry',['bloom-spring','walk'],'bloom1','bloom-seal',['bloom-root','drop'],'bloom-rise','bloom-cloud','bloom-perch','bloom-last','heart-bell',['mother-arena','walk'],['mother-bell','boss']],
  detours:[path(['bloom1','clay-5','clay-6','clay-7','clay-8',['clay-9','walk'],['bloom-entry','fall'],['bloom-spring','walk'],'bloom1'])],
  recoveries:[path(['bloom-root','clay-4','bloom1'])],
  winds:[{"x":60,"y":0,"w":6,"h":7,"fx":0,"fy":16,"id":"root-breath","channel":"root-a","spores":true},{"x":126,"y":13,"w":14,"h":11,"fx":0,"fy":19,"id":"heart-breath","channel":"tree-spores","spores":true},{"x":231,"y":23,"w":14,"h":12,"fx":0,"fy":19,"id":"bloom-breath","channel":"bloom-spores","spores":true}],
  circuits:[{"source":"tree-seal","channel":"tree-spores","targets":["spore1","spore2"],"kind":"spore"},{"source":"bloom-seal","channel":"bloom-spores","targets":["bloom-rise","bloom-cloud"],"kind":"spore"}],
  coins:[{"x":10,"y":5},{"x":12.5,"y":6.5},{"x":14.833333333333334,"y":5.25},{"x":23,"y":6.7},{"x":24.1,"y":6.7},{"x":37.75,"y":6},{"x":39,"y":8.25},{"x":41,"y":9.75},{"x":42.6,"y":8.667785252292473},{"x":78.25,"y":6.75},{"x":79.5,"y":9},{"x":82,"y":10.25},{"x":83.6,"y":9.070228201833979},{"x":103.25,"y":11},{"x":104.75,"y":13.25},{"x":107.6,"y":13.151056516295153},{"x":106.25,"y":14.25},{"x":105.5,"y":17.75},{"x":106.75,"y":20.75},{"x":109,"y":21.5},{"x":111,"y":20},{"x":120,"y":20.5},{"x":131,"y":19.106217782649107},{"x":134,"y":21.1},{"x":166.75,"y":22},{"x":172.25,"y":23},{"x":184.1,"y":23.5},{"x":212.25,"y":28},{"x":215,"y":31},{"x":217.83333333333334,"y":30.633333333333333},{"x":225.25,"y":30.75},{"x":235.75,"y":29.5},{"x":237.25,"y":31.5},{"x":238.75,"y":33},{"x":258,"y":34.4},{"x":259.1,"y":34.4},{"x":260.2,"y":34.4},{"x":261.3,"y":34.4},{"x":262.4,"y":34.4}],
  stamps:[{"x":115.75,"y":25},{"x":195.75,"y":43}],
  enemies:[
    {kind:'spore',x:30,y:6.6,min:28.8,max:31.25,speed:.45},
    {kind:'spore',x:86,y:8.5,min:84.2,max:87.2,speed:.5},
    {kind:'spore',x:155,y:20,min:154,max:156.2,speed:.5},
    {kind:'spore',x:196.5,y:20.5,min:195.1,max:197.3,speed:.55}
  ],
  hazards:[{"x":11,"y":-4,"w":22},{"x":67,"y":-1,"w":8},{"x":80,"y":3,"w":16},{"x":104,"y":3.8,"w":12},{"x":231,"y":19,"w":26.5}],
  shaping:[],
  hints:[{x:0,end:11,icon:'mushroom',title:'Mushroom bounce',text:'Land on the orange target to jump higher.'},
    {x:115,end:126,y:13,icon:'balloon',title:'Spore balloon',text:'Stomp the balloon. Spores lift you up.'}],
  guides:[{platformId:'tree-east',offset:1,dir:-1},{platformId:'tree-west',offset:2.7,dir:1},{platformId:'tree-top',offset:4.5,dir:1}]
},TEAR,GAP);

// --- The Weaver's Gap (192 – 232) --------------------------------------------
// The canopy has torn open and the far side is forty units away, with nothing
// under it but the forest floor. Two masses of freely formable clay, each on a
// beam of bark laid across its half of the tear, and each sown with thorns just
// under the clay's base: clay is ground, and bare bark is not. The first rests
// as a bough stub on the brink, too tall to climb and a wall to walk into, to
// be leaned out into the bridge across — or built into anything else that
// carries you. The second rests as a mound on the far side, too tall for the
// mushroom bounce to land on, to be slumped from across the gap into the plate
// you bounce onto before the drop to the nest. Both are pose-less: they keep
// whatever they are made into (relax:false) and R softens them from off the
// clay. The clump knots are tops over each mass's audit height, so a bare
// stretch of beam reads as its base.
const K=(x0,w)=>(x,top)=>[(x-x0)/w,top];
const KB=K(196.5,14.5),KM=K(219,13);
L.platforms.push(
  p('gap-brink',192,4.5,21.6,'ledge',{checkpoint:194,landmark:'birdhouse'}),
  p('bough-beam',196.5,14.5,20.6,'wall',{h:1.2}),
  part('weave-bough',{x:196.5,w:14.5,y:21.6,h:1},{x:196.5,w:14.5,y:21.6,h:1},{station:'weave-bough',clayRole:'mass'}),
  // The perch runs up to the mound's bark and the mushroom sits at its very
  // end, so a keyboard player at the mushroom's edge has the block within E's
  // reach: held there, the key alone slumps it into the plate.
  p('weave-perch',211,8,23.4,'ledge',{checkpoint:215,landmark:'sporepod',rest:true}),
  p('weave-spring',217.2,1.8,23.84,'spring'),
  p('mound-beam',219,13,24.3,'wall',{h:1.2}),
  part('weave-mound',{x:219,w:13,y:25.3,h:1},{x:219,w:13,y:25.3,h:1},{station:'weave-mound',clayRole:'mass'})
);
L.sections.splice(4,0,{x:TEAR,name:"The Weaver's Gap",landmark:'birdhouse'});
L.hazards.push({x:196.5,w:14.5,y:20.1},{x:219,w:13,y:23.8});
L.shaping.push(
  {id:'weave-bough',rule:'form',free:true,relax:false,shaped:.24,icon:'knead',name:'Shape the bough',verb:'Grab it and drag',gesture:'up',cueX:197.6,
   parts:['weave-bough'],x:192,end:210.5,spawn:{x:194,y:21.6,groundId:'gap-brink'},
   clump:[KB(196.5,6.2),KB(198.8,6.2),KB(200,-1),KB(211,-1)],
   solution:[{x:197.9,lift:0,dx:6.5,dy:-4,t:1.8},{x:203,lift:0,dx:7.5,dy:-1,t:1.6},{x:200,lift:0,dx:-3,dy:-.3,t:.8}],
   hint:'Grab the violet bough and drag it: lean it out across the tear into a bridge, or build your own way over. Clay is ground; the bare bark under it is not. Or face it and hold E to work it into steps. Step off and press R to soften it.'},
  // Worked from the perch, across the gap: the one piece of clay in the game
  // you have to finish before you can reach it.
  {id:'weave-mound',rule:'form',free:true,relax:false,shaped:.24,icon:'knead',name:'Slump the mound',verb:'Grab it and drag',gesture:'up',cueX:220.4,
   parts:['weave-mound'],x:210.5,end:231,spawn:{x:212,y:23.4,groundId:'weave-perch'},
   // A block at the near end of its bark, cresting at the clay's ceiling: the
   // mushroom bounce reaches about eight and a third above the spring, and
   // the crest has to clear that. Its near face is the beam's own end, so
   // there is no rounded foot on this side to land on.
   clump:[KM(219,8.4),KM(221.6,8.4),KM(223.8,-1),KM(232,-1)],
   solution:[{x:220.2,lift:0,dx:6,dy:-6,t:2.4},{x:224,lift:0,dx:7,dy:-2.6,t:2},{x:229,lift:0,dx:2.6,dy:-.6,t:.9}],
   hint:'Grab the tall mound past the mushroom and drag it down: slump it into a plate the bounce can land on. Clay is ground; the bare bark under it is not. Or hold E at the mushroom\'s edge. Press R from the perch to soften it.'},
);
L.hints.push(
  {x:192,end:210.5,icon:'knead',title:'Shape the bough',text:'Grab the violet bough and drag it out across the tear, or hold E facing it to work it into steps. Bare bark under it is deadly; clay is ground.',touchText:'Grab the violet bough and drag it out across the tear. Bare bark under it is deadly; clay is ground.'},
  {x:210.5,end:231,icon:'knead',title:'Slump the mound',text:'Grab the tall mound and drag it down into a plate, or hold E at the mushroom\'s edge, then bounce onto it. Bare bark under it is deadly; clay is ground.',touchText:'Grab the tall mound and drag it down into a plate, then bounce onto it. Bare bark under it is deadly; clay is ground.'}
);
// The tear goes all the way down to the forest floor.
L.hazards.push({x:196.5,w:35,y:12});
L.coins.push({x:194.25,y:23},{x:200,y:24},{x:204.5,y:24},{x:209,y:24},{x:217.75,y:28.6},{x:221,y:30.6},{x:225.5,y:28.4});
export default chapter(L);
