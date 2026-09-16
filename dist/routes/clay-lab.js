import {p,row,path} from '../route-authoring.js';

// The Clay Lab: a flat workshop bench of experiments that ask what clay does
// beyond holding a shape you pushed it into. Every station carries a `rule`;
// one of them, the formable mass, has gone on into the campaign as the
// canyon's Sandwright's Pocket, and the rest are still only here.
//
// The bench is deliberately boring underneath: one long safe floor at y 0 with
// a pit only where an experiment needs a consequence. You can walk between
// every experiment, and the pause menu teleports you straight to any of them,
// so none of it depends on clearing the one before.
const part=(id,from,to,extra={})=>p(id,from.x,from.w,from.y,'clay',{shape:{from,to},...extra});
const bench=(id,x,w,y=0,extra={})=>p(id,x,w,y,'stone',extra);

const platforms=[
  // 01 · SAG — weight is the tool. One deep block of soft clay laid flush
  // between two benches, so walking on and off it never meets a step; the
  // block itself never changes pose, only the surface it carries does.
  bench('lab-start',-8,26,0,{entrance:true,checkpoint:4}),
  part('sag-block',{x:18,w:15.5,y:0,h:8.6},{x:18,w:15.5,y:0,h:8.6},{station:'sag',clayRole:'block'}),
  // Clay this dead gives nothing back to jump with, so the perch belongs to a
  // running jump off the bench, and sinking into the clay first puts it out of
  // reach.
  p('sag-perch',20.6,2.8,1.9,'ledge',{optional:true}),
  bench('sag-exit',33.5,8.5,0,{checkpoint:38}),

  // 02 · CATAPULT — compression you can feel.
  bench('catapult-dock',45,7,0,{checkpoint:47}),
  part('catapult-lump',{x:52.5,w:4,y:1.5,h:2.6},{x:52.5,w:5.4,y:.2,h:1.3},{station:'catapult',clayRole:'bridge'}),
  p('catapult-shelf',51,6,9.4,'ledge'),
  p('catapult-prize',58.5,4,11.6,'ledge',{optional:true}),
  bench('catapult-exit',60,7,0,{checkpoint:63}),

  // 03 · STAMP — the print of your own landing is the step.
  bench('stamp-dock',71,7,0,{checkpoint:73}),
  ...[0,1,2,3].map(i=>part('stamp-step-'+i,
    {x:78.4+i*2.6,w:2.4,y:.12,h:.9},
    {x:78.4+i*2.6,w:2.4,y:1.35+i*1.35,h:1.6+i*1.35},{station:'stamp',clayRole:'bridge'})),
  p('stamp-roof',89.4,8,6.9,'ledge',{checkpoint:92}),
  bench('stamp-exit',99,9,0,{checkpoint:102}),

  // 04 · FORM — the whole lump is yours. One deep trough of clay flush between
  // two benches, with no pose at all: its surface is whatever you drag it into,
  // and it keeps its volume, so a pillar digs a moat and a bowl grows a rim.
  // It starts as a plain square slab a step below the benches, so nothing is
  // shaped for you. A stomp into it throws you about six and two-thirds up;
  // the perch above is out of reach of that from the slab, so it wants a low
  // pillar pulled up under it and then a stomp from the top.
  bench('form-dock',108,8,0,{checkpoint:111}),
  part('form-mass',{x:116,w:18,y:0,h:4.5},{x:116,w:18,y:0,h:4.5},{station:'form',clayRole:'mass'}),
  p('form-perch',122.6,3,8,'ledge',{optional:true}),
  bench('form-exit',134,10,0,{checkpoint:138}),

  // 05 · LUMP — the same clay, sitting free on the bench instead of let into
  // it. A square blob whose faces are too steep to climb and whose top is too
  // high to jump to, so getting over it, or up to the perch above it, is a
  // matter of what you make of it: lean it into a ramp, spread it flat, pull a
  // step up at its foot, draw it up into a pillar. The bench runs on under it.
  // Its perch is high enough that even a stomp from the top of the lump as it
  // starts falls short: it wants the lump drawn up first.
  bench('lump-bench',144,14,0),
  part('form-lump',{x:144,w:14,y:0,h:.02},{x:144,w:14,y:0,h:.02},{station:'lump',clayRole:'mass'}),
  p('lump-perch',149.5,3,12,'ledge',{optional:true}),
  bench('lump-exit',158,8,0,{checkpoint:162}),

  // The bell sits on the bench, so a lap of the lab ends like a chapter does.
  bench('lab-bell',168,14,0,{goal:true,bellX:8}),
];

const sections=[
  {x:-8,name:'Sag & Set',landmark:'workshop'},
  {x:45,name:'Compress & Launch',landmark:'workshop'},
  {x:71,name:'Stamp a Stair',landmark:'workshop'},
  {x:108,name:'Fully Formable',landmark:'workshop'},
  {x:141,name:'A Lump on the Bench',landmark:'workshop'},
  {x:167,name:'The Lab Bell',landmark:'bellgate'},
];

const shaping=[
  {id:'sag',rule:'sag',icon:'sink',name:'Sag & set',verb:'Stand in it',gesture:'down',
   parts:['sag-block'],x:10,end:44,spawn:{x:14,y:0,groundId:'lab-start'},
   hint:'Stand in the clay and it gives, and keeps most of the dent. Walk it into a track, stomp it into a crater. R smooths it.'},
  {id:'catapult',rule:'catapult',launch:24,relax:.22,icon:'spark',name:'Compress & launch',verb:'Stomp, drag down or hold E',gesture:'down',
   parts:['catapult-lump'],x:45,end:70,spawn:{x:48,y:0,groundId:'catapult-dock'},
   hint:'Pack the lump: stomp it, drag it down, or hold E. Once full, it throws you if you stand on it. Left alone it relaxes. R resets it.'},
  {id:'stamp',rule:'stamp',icon:'stairs',name:'Stamp a stair',verb:'Stomp, drag up or hold E',gesture:'up',
   parts:['stamp-step-0','stamp-step-1','stamp-step-2','stamp-step-3'],x:71,end:106,
   spawn:{x:74,y:0,groundId:'stamp-dock'},
   hint:'Size each slab: stomp it to raise it, drag it up or down, or hold E to grow the one you stand on or face. R flattens the row.'},
  // A clump is a list of [across, top] knots: across from 0 at the left end to
  // 1 at the right, top over the bench level. The slab is flat, a step down.
  {id:'form',rule:'form',icon:'knead',name:'Fully formable clay',verb:'Grab it and drag',gesture:'up',
   parts:['form-mass'],x:108,end:141,spawn:{x:111,y:0,groundId:'form-dock'},
   clump:[[0,-.8],[1,-.8]],
   hint:'Grab any point of the clay and drag: pull up a pillar or a step, push down a bowl, drag sideways to stretch a bridge. Press in from the air to dent it, hold E to raise a step ahead of you. Stomp it and it craters and throws you straight back up. It keeps its volume, so what rises here sinks there, and left alone it slowly slumps back. R resets it.'},
  // The lump thins to nothing at the ends of its footprint, so it sits on the
  // bench as a square blob with the bench bare on either side.
  {id:'lump',rule:'form',free:true,icon:'knead',name:'A lump on the bench',verb:'Grab it and drag',gesture:'up',
   parts:['form-lump'],x:141,end:167,spawn:{x:142,y:0,groundId:'form-exit'},
   clump:[[0,0],[.25,0],[.32,4.6],[.68,4.6],[.75,0],[1,0]],
   hint:'A square lump, too steep to climb and too tall to jump. Lean it over into a ramp, spread it flat, pull a step up at its foot, or draw it up into a pillar; a stomp on top throws you higher still. It keeps its volume, and left alone it slumps back into a lump. R resets it.'},
];

const L={
  layoutVersion:2,playground:true,lab:true,
  name:'The Clay Lab',short:'Clay lab',label:'Four experiments in what clay does',biome:'citadel',
  intro:'A bench of ideas that are not in the game yet. Sag it, pack it, stamp it, shape it.',
  sky:'#86a6c5',fog:'#91abc3',spawn:{x:2,y:0},end:180,previousDistance:1800,cameraY:2.15,
  platforms,sections,shaping,
  winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],enemies:[],
  hazards:[{x:52.5,w:5.4,y:-9}],
  // The sag beads trace the running jump from the bench onto the perch.
  coins:[{x:18.6,y:2},{x:19.7,y:3},{x:20.8,y:3.2},{x:21.9,y:2.8},...row(53,11,3),...row(79,2.2,4),
    // The form beads run a hop above the slab; the lump's follow its shoulders.
    ...row(118,.2,5,3),{x:147.6,y:2.2},{x:149.3,y:5.7},{x:151,y:5.6},{x:152.7,y:5.7},{x:154.4,y:2.2},...row(169,1.6,4)],
  stamps:[{x:60.4,y:13},{x:22.8,y:2.9},{x:124.1,y:9},{x:151,y:13}],
  hints:shaping.map(s=>({x:s.x,end:s.end-.001,icon:s.icon,title:s.name,text:s.hint})),
  routeLinks:path([
    'lab-start','sag-perch',['sag-block','fall'],['sag-exit','walk'],
    'catapult-dock',['catapult-lump','walk'],['catapult-exit','walk'],
    'stamp-dock',['stamp-step-0','walk'],'stamp-step-1','stamp-step-2','stamp-step-3','stamp-roof',
    ['stamp-exit','fall'],['form-dock','walk'],['form-mass','fall'],'form-perch',['form-mass','fall'],'form-exit',
    ['lump-bench','walk'],'form-lump','lump-perch',['lump-exit','fall'],'lab-bell',
  ]),
};

L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
for(const s of L.platforms)s.section=L.sections.findLast(s0=>s.x>=s0.x)?.id??0;
const goal=L.platforms.find(s=>s.goal);goal.bellX=goal.bellX??L.end-goal.x;
L.originalDistance=L.previousDistance/10;
export default L;
