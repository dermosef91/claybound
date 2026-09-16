import {p,row,path} from '../route-authoring.js';

// The Clay Lab: a flat workshop bench of experiments that ask what clay does
// beyond holding a shape you pushed it into. Nothing here is in the campaign —
// every station carries a `rule`, and no chapter station has one.
//
// The bench is deliberately boring underneath: one long safe floor at y 0 with
// a pit only where an experiment needs a consequence. You can walk between
// every experiment, and the pause menu teleports you straight to any of them,
// so none of it depends on clearing the one before.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
const bench=(id,x,w,y=0,extra={})=>p(id,x,w,y,'stone',extra);

const platforms=[
  // 01 · SAG — weight is the tool.
  bench('lab-start',-8,26,0,{entrance:true,checkpoint:4}),
  part('sag-beam',{x:19,w:9,y:0,h:1.1},{x:19,w:9,y:-3.4,h:1.1},{station:'sag',clayRole:'bridge'}),
  p('sag-door',28.4,3.2,-3.4,'ledge',{optional:true}),
  // Sag the beam all the way and the low door opens — but a pit you cannot
  // climb out of is a trap, not an experiment, so the way back is always there.
  p('sag-climb',32.2,2.6,-1.7,'ledge'),
  bench('sag-exit',35,7,0,{checkpoint:38}),

  // 02 · WEAR — thin clay remembers.
  bench('wear-dock',45,6,0,{checkpoint:47}),
  part('wear-span',{x:51,w:8,y:0,h:1.3},{x:51,w:8,y:0,h:.12},{station:'wear',clayRole:'bridge'}),
  bench('wear-exit',59,7,0,{checkpoint:62}),

  // 03 · CATAPULT — compression you can feel.
  bench('catapult-dock',64,7,0,{checkpoint:66}),
  part('catapult-lump',{x:71.5,w:4,y:1.5,h:2.6},{x:71.5,w:5.4,y:.2,h:1.3},{station:'catapult',clayRole:'bridge'}),
  p('catapult-shelf',70,6,9.4,'ledge'),
  p('catapult-prize',77.5,4,11.6,'ledge',{optional:true}),
  bench('catapult-exit',79,7,0,{checkpoint:82}),

  // 04 · STAMP — the print of your own landing is the step.
  bench('stamp-dock',90,7,0,{checkpoint:92}),
  ...[0,1,2,3].map(i=>part('stamp-step-'+i,
    {x:97.4+i*2.6,w:2.4,y:.12,h:.9},
    {x:97.4+i*2.6,w:2.4,y:1.35+i*1.35,h:1.6+i*1.35},{station:'stamp',clayRole:'bridge'})),
  p('stamp-roof',108.4,8,6.9,'ledge',{checkpoint:111}),
  bench('stamp-exit',118,9,0,{checkpoint:121}),

  // The bell sits on the bench, so a lap of the lab ends like a chapter does.
  bench('lab-bell',129,14,0,{goal:true,bellX:8}),
];

const sections=[
  {x:-8,name:'Sag & Set',landmark:'workshop'},
  {x:45,name:'Wear Through',landmark:'workshop'},
  {x:64,name:'Compress & Launch',landmark:'workshop'},
  {x:90,name:'Stamp a Stair',landmark:'workshop'},
  {x:126,name:'The Lab Bell',landmark:'bellgate'},
];

const shaping=[
  {id:'sag',rule:'sag',rate:.5,icon:'bridge',name:'Sag & set',verb:'Stand on it',gesture:'down',
   parts:['sag-beam'],x:10,end:44,spawn:{x:14,y:0,groundId:'lab-start'},
   hint:'This beam sags under you and keeps every millimetre. Walk it down to the low door — but it never springs back. R resets it.'},
  {id:'wear',rule:'wear',uses:3,icon:'sink',name:'Wear through',verb:'Cross it',gesture:'down',
   parts:['wear-span'],x:45,end:63,spawn:{x:48,y:0,groundId:'wear-dock'},
   hint:'Every crossing takes a third of this span. The third one takes the span. R makes it whole again.'},
  {id:'catapult',rule:'catapult',launch:24,relax:.22,icon:'spark',name:'Compress & launch',verb:'Stomp it',gesture:'down',
   parts:['catapult-lump'],x:64,end:89,spawn:{x:67,y:0,groundId:'catapult-dock'},
   hint:'Stomp the lump to pack it. When it cannot take another, it throws you. Leave it alone and the charge relaxes.'},
  {id:'stamp',rule:'stamp',icon:'stairs',name:'Stamp a stair',verb:'Stomp each step',gesture:'down',
   parts:['stamp-step-0','stamp-step-1','stamp-step-2','stamp-step-3'],x:90,end:125,
   spawn:{x:93,y:0,groundId:'stamp-dock'},
   hint:'Each slab rises only where you put your weight through it. Stomp along the row to build the stair you want.'},
];

const L={
  layoutVersion:1,playground:true,lab:true,
  name:'The Clay Lab',short:'Clay lab',label:'Four experiments in what clay does',biome:'citadel',
  intro:'A bench of ideas that are not in the game yet. Sag it, wear it, pack it, stamp it.',
  sky:'#86a6c5',fog:'#91abc3',spawn:{x:2,y:0},end:141,previousDistance:1410,cameraY:2.15,
  platforms,sections,shaping,
  winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],enemies:[],
  hazards:[{x:31.2,w:1,y:-9},{x:51,w:8,y:-9},{x:71.5,w:5.4,y:-9}],
  coins:[...row(21,1.6,4),...row(52,1.6,5),...row(72,11,3),...row(98,2.2,4),...row(130,1.6,4)],
  stamps:[{x:79.4,y:13},{x:29.9,y:-2.2}],
  hints:shaping.map(s=>({x:s.x,end:s.end-.001,icon:s.icon,title:s.name,text:s.hint})),
  routeLinks:path([
    'lab-start',['sag-beam','walk'],['sag-door','walk'],'sag-climb','sag-exit',
    'wear-dock',['wear-span','walk'],['wear-exit','walk'],
    'catapult-dock',['catapult-lump','walk'],['catapult-exit','walk'],
    'stamp-dock',['stamp-step-0','walk'],'stamp-step-1','stamp-step-2','stamp-step-3','stamp-roof',
    ['stamp-exit','fall'],'lab-bell',
  ]),
};

L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
for(const s of L.platforms)s.section=L.sections.findLast(s0=>s.x>=s0.x)?.id??0;
const goal=L.platforms.find(s=>s.goal);goal.bellX=goal.bellX??L.end-goal.x;
L.originalDistance=L.previousDistance/10;
export default L;
