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

  // The five benches after this are puzzles and platform stretches built on the
  // formable mass, each asking one thing of it, so the best of them can be
  // carried into a chapter. Every one is solvable from its dock with a pointer;
  // E, a stomp and the boots still work every mass as they always have.

  // 06 · BURIED — the slab is an archive. Five beads sit inside a deep slab,
  // deeper towards the middle, and a flower just under its surface with a
  // petal breaking through to say so; digging is pressing in from the air
  // and dragging down, or stomping a crater. The clay keeps its volume, so the
  // spoil piles up beside the hole, and gathered together it is the step up to
  // the perch, which nothing on the flat slab reaches. The trough is deep so the
  // flower can be well down, which also caps a pillar at two and a half.
  bench('dig-dock',166,8,0,{checkpoint:169}),
  part('dig-mass',{x:174,w:16,y:0,h:6},{x:174,w:16,y:0,h:6},{station:'dig',clayRole:'mass'}),
  p('dig-perch',186.5,3,4.6,'ledge',{optional:true}),
  bench('dig-exit',190,8,0,{checkpoint:194}),

  // 07 · UNDER & OVER — what you dig here rises there. The mass lies flush with
  // the dock; a stone lintel crosses it with too little air beneath to walk
  // under, and past the lintel the bench stands four high, a wall from the
  // clay. A trench under the lintel is the way through, its spoil the way up:
  // the mass can be raised exactly to the bench and no further.
  bench('lintel-dock',198,8,0,{checkpoint:201}),
  part('lintel-mass',{x:206,w:18,y:0,h:4.5},{x:206,w:18,y:0,h:4.5},{station:'lintel',clayRole:'mass'}),
  p('lintel-beam',212,5,2.75,'wall',{h:1.7}),
  bench('lintel-exit',224,7,4,{checkpoint:227}),
  bench('lintel-steps',231,3,2),

  // 08 · CAST — accuracy, not reach. A pale outline over the mass is a mould:
  // two steps and a dip. Shape the clay to lie along it and a grate opens on a
  // vault at the far end of the trough with a flower inside. The vault is
  // roofed and walled so the only way to the flower is through the grate; the
  // roof is the way on for anyone who has not cast it.
  bench('mould-dock',234,8,0,{checkpoint:237}),
  part('mould-mass',{x:242,w:14,y:0,h:4.5},{x:242,w:14,y:0,h:4.5},{station:'mould',clayRole:'mass'}),
  bench('mould-vault',256,6,0),
  p('mould-gate',256,.8,3,'gate',{h:3,channel:'mould-cast'}),
  p('mould-roof',256,5.8,3.6,'wall',{h:.6}),
  p('mould-end',261,.8,3.6,'wall',{h:3.6}),
  bench('mould-exit',262,6,0,{checkpoint:265}),

  // 09 · WET CLAY — a platform stretch under time. The same mass with a pace
  // of its own: it slumps in seconds and is not held by anyone standing on it,
  // only by a hand. The far bench is a wall to build a step against before the
  // step melts; the perch is a pillar pulled up under your own feet and a stomp
  // from its top before it sinks, up a column of beads.
  bench('wet-dock',268,8,0,{checkpoint:271}),
  part('wet-mass',{x:276,w:22,y:0,h:4.5},{x:276,w:22,y:0,h:4.5},{station:'wet',clayRole:'mass'}),
  p('wet-perch',285,3,8.8,'ledge',{optional:true}),
  bench('wet-exit',298,8,3,{checkpoint:301}),
  bench('wet-steps',306,3,1.5),

  // 10 · THE MARBLE RUN — the clay is the only tool. A marble rests in a hollow
  // at the near end; its socket is the hollow at the far end, past a ridge too
  // tall to roll over. It rides the clay up when the ground under it is raised,
  // rolls down whatever lean it is given, and rolls into the crater a stomp
  // leaves ahead of it. Seated, it sets the lift on the exit bench running up
  // to the flower and back, for as long as it sits there.
  bench('marble-dock',309,8,0,{checkpoint:312}),
  part('marble-mass',{x:317,w:20,y:0,h:4.5},{x:317,w:20,y:0,h:4.5},{station:'marble',clayRole:'mass'}),
  bench('marble-exit',337,12,0,{checkpoint:340}),
  p('marble-lift',343,3,1.2,'lift',{channel:'marble-home',moveY:2.8,period:5}),

  // The bell sits on the bench, so a lap of the lab ends like a chapter does.
  bench('lab-bell',351,14,0,{goal:true,bellX:8}),
];

const sections=[
  {x:-8,name:'Sag & Set',landmark:'workshop'},
  {x:45,name:'Compress & Launch',landmark:'workshop'},
  {x:71,name:'Stamp a Stair',landmark:'workshop'},
  {x:108,name:'Fully Formable',landmark:'workshop'},
  {x:141,name:'A Lump on the Bench',landmark:'workshop'},
  {x:166,name:'Buried in the Slab',landmark:'workshop'},
  {x:198,name:'Under & Over',landmark:'workshop'},
  {x:234,name:'Cast the Mould',landmark:'workshop'},
  {x:268,name:'Wet Clay',landmark:'workshop'},
  {x:309,name:'The Marble Run',landmark:'workshop'},
  {x:350,name:'The Lab Bell',landmark:'bellgate'},
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
   parts:['form-lump'],x:141,end:166,spawn:{x:142,y:0,groundId:'form-exit'},
   clump:[[0,0],[.25,0],[.32,4.6],[.68,4.6],[.75,0],[1,0]],
   hint:'A square lump, too steep to climb and too tall to jump. Lean it over into a ramp, spread it flat, pull a step up at its foot, or draw it up into a pillar; a stomp on top throws you higher still. It keeps its volume, and left alone it slumps back into a lump. R resets it.'},
  // The slab starts half a step below the benches with its treasure inside.
  {id:'dig',rule:'form',icon:'drop',name:'Buried in the slab',verb:'Dig it out',gesture:'down',
   parts:['dig-mass'],x:166,end:198,spawn:{x:169,y:0,groundId:'dig-dock'},
   clump:[[0,-.5],[1,-.5]],
   hint:'Five beads and a flower are buried here; the flower shows a petal. Press in from the air and drag down to dig. Spoil piles up beside the hole (volume is kept); pull it into a step to the perch. Slumps back when left; R refills it.'},
  // Flush with the dock, so the lintel is met at a walk.
  {id:'lintel',rule:'form',icon:'ramp',name:'Under & over',verb:'Dig under, pile up',gesture:'down',
   parts:['lintel-mass'],x:198,end:234,spawn:{x:201,y:0,groundId:'lintel-dock'},
   clump:[[0,0],[1,0]],
   hint:'A lintel too low to walk under, then a wall too high to jump. Press in and drag along to trench under the lintel; the spoil piles up beyond (volume is kept). Pull it into a step, or hold E, and climb. Slumps level when left; R undoes it.'},
  // A mould is knots like a clump; the mass starts as the flat slab that holds
  // exactly the mould's volume, so every bit of the cast is already in it.
  {id:'mould',rule:'form',icon:'stairs',name:'Cast the mould',verb:'Shape it to the outline',gesture:'up',
   parts:['mould-mass'],x:234,end:268,spawn:{x:237,y:0,groundId:'mould-dock'},
   mould:[[0,-.8],[.1,-.8],[.17,.7],[.36,.7],[.43,2.1],[.6,2.1],[.67,-1.6],[.8,-1.6],[.87,-.8],[1,-.8]],
   channel:'mould-cast',message:'Cast · the vault is open',
   hint:'The pale outline is a mould. Pull, push and drag the clay until its surface lies along the line; the slab holds exactly enough and keeps its volume. The line turns green when cast and the grate lifts, staying open as the cast slumps. R resets both.'},
  // Wet clay: settles in well under a second, slumps in seconds, and is not
  // held by the weight of a rider, only by a hand.
  {id:'wet',rule:'form',icon:'spark',name:'Wet clay',verb:'Build fast, climb faster',gesture:'up',
   parts:['wet-mass'],x:268,end:309,spawn:{x:271,y:0,groundId:'wet-dock'},
   clump:[[0,-.8],[1,-.8]],pace:{settle:.6,relaxTime:5,relaxMin:.4,holdUnderfoot:false},
   hint:'Wet clay slumps back in seconds unless a hand is on it. Drag a step up, or hold E, and climb before it melts. For the perch: pull a pillar up under yourself, let go, stomp from its top before it sinks. Volume is kept. R resets it.'},
  // The marble starts in the near hollow, in the form's own x; its socket is
  // the far hollow. The ridge between is too tall to roll over.
  {id:'marble',rule:'form',icon:'wheel',name:'The marble run',verb:'Roll it home',gesture:'up',
   parts:['marble-mass'],x:309,end:350,spawn:{x:312,y:0,groundId:'marble-dock'},
   clump:[[0,-.8],[.06,-.8],[.12,-1.7],[.18,-.8],[.4,-.8],[.46,.9],[.54,.9],[.6,-.8],[.85,-.8],[.9,-1.8],[.95,-.8],[1,-.8]],
   marble:{x:2.4,socket:[17,19]},channel:'marble-home',message:'The marble is home · the lift is running',
   hint:'The marble sits in the near hollow; its socket is the ringed hollow at the far end. Only the clay moves it: pull the ground up under it and lean it, hold E behind it, or stomp just ahead so it rolls into your crater. Seat it and the lift starts running. Volume is kept; it slumps back when left. R resets the marble too.'},
];

const L={
  layoutVersion:2,playground:true,lab:true,
  name:'The Clay Lab',short:'Clay lab',label:'Ten experiments in what clay does',biome:'citadel',
  intro:'A bench of ideas that are not in the game yet. Sag it, pack it, stamp it, shape it; then dig in it, duck under it, cast it, race it and roll a marble down it.',
  sky:'#86a6c5',fog:'#91abc3',spawn:{x:2,y:0},end:363,previousDistance:3630,cameraY:2.15,
  platforms,sections,shaping,
  winds:[],crushers:[],circuits:[],guides:[],detours:[],recoveries:[],enemies:[],
  hazards:[{x:52.5,w:5.4,y:-9}],
  // The sag beads trace the running jump from the bench onto the perch.
  coins:[{x:18.6,y:2},{x:19.7,y:3},{x:20.8,y:3.2},{x:21.9,y:2.8},...row(53,11,3),...row(79,2.2,4),
    // The form beads run a hop above the slab; the lump's follow its shoulders.
    ...row(118,.2,5,3),{x:147.6,y:2.2},{x:149.3,y:5.7},{x:151,y:5.6},{x:152.7,y:5.7},{x:154.4,y:2.2},
    // Buried: five beads inside the slab in a dipping arc, and three over the perch.
    {x:177,y:-1.5},{x:179.5,y:-2.5},{x:182,y:-3.5},{x:184.5,y:-2.5},{x:187,y:-1.5},...row(186.9,5.6,3),
    // Under & over: the way up out of the trench, on the far side of the lintel.
    {x:218.5,y:1},{x:220,y:2},{x:221.5,y:3},{x:223,y:4.6},
    // Wet clay: a column beside the perch, climbed by the throw from the pillar.
    {x:286.5,y:2},{x:286.5,y:4},{x:286.5,y:6},{x:286.5,y:8},
    // The marble run: along the flat the marble crosses, and two in the socket.
    ...row(322,.4,3,2),{x:334.6,y:-1.4},{x:335.4,y:-1.4},...row(352,1.6,4)],
  // The buried flower sits just under the slab with a petal or two breaking
  // the surface, so a player knows it is there; the beads are the deep dig.
  // The lintel's sits under the lintel, so only the trench reaches it; the vault's is behind the
  // grate; the wet perch's needs the pillar and the throw; the marble's is over
  // the lift, which only the seated marble sets running.
  stamps:[{x:60.4,y:13},{x:22.8,y:2.9},{x:124.1,y:9},{x:151,y:13},{x:182,y:-.9},{x:214.5,y:0},{x:259,y:1.5},{x:286.5,y:10.3},{x:344.5,y:6.6}],
  hints:shaping.map(s=>({x:s.x,end:s.end-.001,icon:s.icon,title:s.name,text:s.hint})),
  routeLinks:path([
    'lab-start','sag-perch',['sag-block','fall'],['sag-exit','walk'],
    'catapult-dock',['catapult-lump','walk'],['catapult-exit','walk'],
    'stamp-dock',['stamp-step-0','walk'],'stamp-step-1','stamp-step-2','stamp-step-3','stamp-roof',
    ['stamp-exit','fall'],['form-dock','walk'],['form-mass','fall'],'form-perch',['form-mass','fall'],'form-exit',
    ['lump-bench','walk'],'form-lump','lump-perch',['lump-exit','fall'],
    ['dig-dock','walk'],['dig-mass','fall'],'dig-perch',['dig-mass','fall'],'dig-exit',
    ['lintel-dock','walk'],['lintel-mass','walk'],'lintel-exit',['lintel-steps','fall'],
    ['mould-dock','fall'],['mould-mass','fall'],'mould-roof',['mould-exit','fall'],
    ['wet-dock','walk'],['wet-mass','fall'],'wet-perch',['wet-mass','fall'],'wet-exit',['wet-steps','fall'],
    ['marble-dock','fall'],['marble-mass','fall'],'marble-exit','marble-lift',['marble-exit','fall'],'lab-bell',
  ]),
};

L.sections.forEach((s,i)=>{s.id=i;s.end=L.sections[i+1]?.x??L.end+8;});
for(const s of L.platforms)s.section=L.sections.findLast(s0=>s.x>=s0.x)?.id??0;
const goal=L.platforms.find(s=>s.goal);goal.bellX=goal.bellX??L.end-goal.x;
L.originalDistance=L.previousDistance/10;
export default L;
