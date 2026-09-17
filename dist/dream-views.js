import * as THREE from './lib/three.module.js';
import {createClayView} from './shaping-views.js';
import {SINK,FOLD} from './cavern-machines.js';
import {FINALE,finaleFlower} from './simulation.js';

// Views for the Soft Dream's own platform kinds and dressings. dream.js asks
// createDreamView for every platform the dream builds; a null answer means
// "not mine", and the world's ordinary per-kind view is used instead. Every
// view returned has the shape world.render expects — {root, ropes, bounce} —
// plus a `dream` record naming what it is and holding the parts the per-frame
// pose moves. Nothing here reads input or the clock: each pose is a function
// of the platform's simulation state, so a paused frame is a frozen frame.
//
// Kinds:
//   sink      a raft that rides low in the water as it sinks; ripples spread
//             at the water line, which is the raft's rest height
//   fold      a deck on a hinge that turns up into a wall (or back down)
//   dome      a sphere the rider turns; dots and a band show the spin
//   breathe   a wall block whose box is rescaled to the breathing height
//   conveyor  a deck with stripes that scroll at the conveyor's speed
//   tint      a station's clay drawn in the section's terrain colour
// and, apart from platforms, the ending's flower: createDreamFlower.

const slot=(w,name,fallback='cream')=>w.mat?.[name]?name:fallback;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Which of the dream's dressings a platform takes, or null for the world's own.
export function dreamViewKind(s){
  if(s.shape)return s.tint==='terrain'?'tint':null;
  if(s.kind==='sink'||s.kind==='fold'||s.kind==='dome')return s.kind;
  if(s.kind==='wall'&&s.breathe)return 'breathe';
  if(s.conveyor)return 'conveyor';
  return null;
}

export function createDreamView(w,s,g){
  const kind=dreamViewKind(s);if(!kind)return null;
  g.position.set(s.x,s.y,0);
  if(kind==='tint'){
    // The same sculpted clay piece the violet stations use, in the section's
    // own colour: terrain that happens to move, not a puzzle to be worked.
    const view=createClayView(w,s,g);
    const terrain=w.mat[slot(w,'terrain','orange')];
    for(const piece of view.clay?.pieces||[])piece.mesh.material=terrain;
    view.dream={kind};return view;
  }
  const view={root:g,ropes:[],bounce:0,dream:{kind}};
  BUILD[kind](w,s,g,view.dream);
  if(s.checkpoint)w.flag?.(s.checkpoint-s.x,.08,g,.83,s.id);
  poseDreamView(view,s,{time:0});
  return view;
}

// --- the raft -----------------------------------------------------------------
function buildSink(w,s,g,d){
  g.name='Sinking raft · '+s.id;
  w.box(s.w,.36,1.9,slot(w,'water','blueLight'),g,s.w/2,-.18,0,.15).name='Raft deck';
  w.box(s.w-.3,.3,1.6,'blueDark',g,s.w/2,-.5,0,.12).name='Raft hull';
  for(const x of [.35,s.w-.35])w.ball(.3,.24,.42,'cream',g,x,-.05,0).name='Raft float';
  d.rings=[];
  for(let i=0;i<2;i++){
    const ring=w.mesh(new THREE.TorusGeometry(.5+i*.35,.045,6,28),'cream',g,s.w/2,-.3,0);
    ring.rotation.x=Math.PI/2;ring.name='Sink ripple';ring.castShadow=false;d.rings.push(ring);
  }
}
function poseSink(d,s){
  // The water line is the raft's rest height: the ripples stay there and
  // widen as the raft goes under them.
  const depth=Math.max(0,Math.min(1,(s.baseY-s.y)/(s.drop??SINK.drop)));
  d.rings.forEach((ring,i)=>{
    ring.visible=depth>.02;ring.position.y=s.baseY-s.y-.06;
    ring.scale.set(s.w/1.1*(1+depth*.4+i*.15),1,1.6*(1+depth*.4));
  });
}

// --- the folding deck -----------------------------------------------------------
function buildFold(w,s,g,d){
  g.name='Folding deck · '+s.id;
  const dir=s.pivot==='right'?-1:1,pivot=new THREE.Group();pivot.name='Fold hinge';pivot.position.x=dir>0?0:s.w;g.add(pivot);
  w.box(s.w,.32,1.8,slot(w,'top'),pivot,dir*s.w/2,-.16,0,.12).name='Fold panel';
  w.box(s.w-.2,.2,1.5,slot(w,'terrain2'),pivot,dir*s.w/2,-.4,0,.09).name='Fold panel underside';
  for(let i=1;i<=3;i++)w.box(.12,.05,1.2,'cream',pivot,dir*s.w*i/4,.01,0,.02).name='Fold stripe';
  const axle=w.cylinder(.22,1.9,'dark',g,pivot.position.x,-.2,0);axle.rotation.x=Math.PI/2;axle.name='Fold axle';
  w.ball(.16,.16,.1,'gold',g,pivot.position.x,-.2,.98).name='Fold knob';
  d.pivot=pivot;d.up=dir*Math.PI/2;
}
function poseFold(d,s){
  // Linear in the collider's progress about the midpoint, eased at the ends,
  // so the panel passes upright exactly when its collision turns to a wall.
  const progress=smooth(s.fold||0);
  d.pivot.rotation.z=(s.from==='wall'?1-progress:progress)*d.up;
}

// --- the dome island ------------------------------------------------------------
function buildDome(w,s,g,d){
  g.name='Dome island · '+s.id;
  const r=s.w/2,sphere=new THREE.Group();sphere.name='Dome sphere';sphere.position.set(r,-r,0);g.add(sphere);
  w.ball(r,r,r,slot(w,'terrain'),sphere,0,0,0).name='Dome ball';
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    w.ball(r*.13,r*.13,r*.09,i%2?'cream':slot(w,'accent','gold'),sphere,Math.cos(a)*r*.96,Math.sin(a)*r*.96,r*.28).name='Dome dot';
  }
  const band=w.mesh(new THREE.TorusGeometry(r*.97,r*.06,8,48),slot(w,'top'),sphere,0,0,0);band.rotation.y=.24;band.name='Dome band';
  d.sphere=sphere;
}
// The simulation accumulates the rider's travel in radians; running right
// turns the sphere clockwise under the feet.
function poseDome(d,s){d.sphere.rotation.z=-(s.domeSpin||0);}

// --- the breathing wall -----------------------------------------------------------
function buildBreathe(w,s,g,d){
  g.name='Breathing wall · '+s.id;
  const h=s.baseH??s.h??4;
  d.body=w.box(s.w,h,2,slot(w,'terrain'),g,s.w/2,-h/2,0,Math.min(.14,s.w/8,h/8));d.body.name='Breathing wall body';d.baseH=h;
  // Two closed lids on its face, so the wall reads as something that sleeps
  // and breathes rather than a block that happens to move.
  d.lids=[s.w*.32,s.w*.68].map(x=>{const lid=w.ball(Math.min(.32,s.w*.12),.09,.12,'dark',g,x,-h*.35,1.01);lid.name='Wall lid';return lid;});
}
// One box, rescaled from its top: the collider's top is the root, so the
// body grows and shrinks downward and sideways exactly as the simulation's
// x, y and h say — the picture never disagrees with what pushes the player.
function poseBreathe(d,s){
  const h=s.h??d.baseH;
  d.body.scale.y=h/d.baseH;d.body.position.y=-h/2;
  for(const lid of d.lids)lid.position.y=-h*.35;
}

// --- the conveyor deck ------------------------------------------------------------
function buildConveyor(w,s,g,d){
  g.name='River deck · '+s.id;
  w.box(s.w,.32,1.8,slot(w,'accent','gold'),g,s.w/2,-.16,0,.12).name='River deck top';
  w.box(s.w-.15,.24,1.62,slot(w,'terrain'),g,s.w/2,-.43,0,.09).name='River deck body';
  const count=Math.max(2,Math.round(s.w/1.1));d.stripes=[];d.span=Math.max(.6,s.w-.5);
  for(let i=0;i<count;i++){
    const stripe=w.box(.18,.05,1.5,'cream',g,.25,.005,0,.02);stripe.name='River stripe';stripe.userData.u=i/count;stripe.castShadow=false;d.stripes.push(stripe);
  }
}
// Stripes ride the deck at the conveyor's speed and wrap, shrinking to
// nothing at either end so none of them pops in or out.
function poseConveyor(d,s,game){
  const travel=(game.time||0)*(s.conveyor||0)/d.span;
  for(const stripe of d.stripes){
    const u=((stripe.userData.u+travel)%1+1)%1,edge=Math.min(u,1-u)*d.span;
    stripe.position.x=.25+u*d.span;stripe.scale.x=Math.max(.02,Math.min(1,edge/.3));
  }
}

const BUILD={sink:buildSink,fold:buildFold,dome:buildDome,breathe:buildBreathe,conveyor:buildConveyor};
const POSE={sink:poseSink,fold:poseFold,dome:poseDome,breathe:poseBreathe,conveyor:poseConveyor};

// Pose one view from its platform's simulation state.
export function poseDreamView(view,s,game){
  const d=view.dream;if(!d||!POSE[d.kind])return;
  POSE[d.kind](d,s,game);
}

// --- the flower -------------------------------------------------------------------
// The ending's flower: a bud while the strands are still knotted, open and
// pulsing once they are all worked, folding into a lump through the pickup,
// and gone once the player has woken. One per world; build() makes a new one
// for each level and the old group goes with the level root it hung in.
export function createDreamFlower(w,L,parent=w.levelRoot){
  if(!L.finale)return null;
  const {x,y}=finaleFlower(L);
  const root=new THREE.Group();root.name='The dream flower';root.position.set(x,y,.3);parent.add(root);
  const stem=w.cylinder(.06,.9,slot(w,'vine','dark'),root,0,-.45,0);stem.name='Flower stem';
  const leaves=[-1,1].map(side=>{const leaf=w.ball(.26,.09,.14,slot(w,'foliage','top'),root,side*.22,-.55,0);leaf.rotation.z=side*.5;leaf.name='Flower leaf';return leaf;});
  const bloom=new THREE.Group();bloom.name='Flower bloom';root.add(bloom);
  const petals=Array.from({length:6},(_,i)=>{
    const a=i/6*Math.PI*2,petal=w.ball(.26,.13,.08,slot(w,'accent','gold'),bloom,Math.cos(a)*.3,Math.sin(a)*.3,0);
    petal.rotation.z=a;petal.name='Flower petal';return petal;
  });
  const heart=w.ball(.17,.17,.12,'gold',bloom,0,0,.05);heart.name='Flower heart';
  const view={root,stem,leaves,bloom,petals,heart,open:.3};
  w.dreamFlower=view;poseDreamFlower(view,{time:0,finale:{state:'waiting',time:0},level:L},0);
  return view;
}
export function poseDreamFlower(v,game,dt){
  const f=game.finale,state=f?.state||'waiting',t=game.time||0;
  v.root.visible=state!=='awake';
  if(state==='awake')return;
  if(state==='pickup'){
    // The collapse: the petals draw into the heart, the bloom winds up and
    // shrinks to a lump, and the stem pulls down into the deck.
    const k=smooth(f.time/(game.level?.finale?.duration??FINALE.duration));
    v.bloom.scale.setScalar(Math.max(.05,1-.85*k));v.bloom.rotation.z=k*4;
    v.petals.forEach((p,i)=>{const a=i/6*Math.PI*2;p.position.set(Math.cos(a)*.3*(1-k),Math.sin(a)*.3*(1-k),0);});
    v.stem.scale.y=.9*(1-k)+.01;v.stem.position.y=-.45*(1-k);
    for(const leaf of v.leaves)leaf.scale.setScalar(Math.max(.01,1-k));
    return;
  }
  const open=state==='ripe'?1:.3;
  v.open+=(open-v.open)*(1-Math.exp(-dt*3));
  const pulse=state==='ripe'?1+Math.sin(t*3)*.06:1;
  v.bloom.scale.setScalar((.55+.45*v.open)*pulse);v.bloom.rotation.z=t*.25;
  v.petals.forEach((p,i)=>{const a=i/6*Math.PI*2,r=.08+.22*v.open;p.position.set(Math.cos(a)*r,Math.sin(a)*r,0);});
  v.stem.scale.y=.9;v.stem.position.y=-.45;
  v.root.rotation.z=Math.sin(t*1.2)*.06;
}

// Called once per rendered frame by dream.js: every dream view the world has
// streamed in is posed from its platform, and the flower from the ending.
export function animateDreamViews(w,game,dt){
  for(const s of game.level.platforms){const view=w.platforms?.get(s.id);if(view?.dream)poseDreamView(view,s,game);}
  if(w.dreamFlower&&game.level.finale)poseDreamFlower(w.dreamFlower,game,dt);
}
