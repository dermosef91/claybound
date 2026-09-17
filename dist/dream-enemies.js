import * as THREE from './lib/three.module.js';
import {applyFlatten} from './clay-feel.js';
import {BLINKER,DRIP} from './dream-enemy-rules.js';
import {dreamCaterpillar,dreamHat,dreamHatHeight} from './dream-assets.js';
import {restoreRest} from './dream-rigs.js';

// The Soft Dream's creatures, sculpted in code from the world's clay
// primitives in the theme's own slots — no model to load, so a section's
// palette recolours them with everything else. Each view names its parts so
// a scene check can find them, and each dies the way every other creature
// does: pressed flat about its root by clay-feel.js, then broken into clumps
// by clay-shatter.js from world.render. The simulation owns every position;
// this file only dresses e.x/e.y and the state fields the rules leave behind.
// The hatworm is the one with a supplied body: where the dream's models are
// loaded it wears the uploaded caterpillar and three of the uploaded hats,
// keeping the same part names; a bare rig gets the sculpted one.

// A theme slot where the world has one, else a colour every world carries.
const slot=(w,name,fallback='cream')=>w.mat?.[name]?name:fallback;
const NAMES={hatworm:'Hatworm',blinker:'Blinker',drip:'Drip'};

export function createDreamEnemyView(w,e){
  const root=new THREE.Group();root.name=`${NAMES[e.kind]||'Dream creature'} ${e.id}`;root.position.set(e.x,e.y,.35);w.levelRoot.add(root);
  const view={kind:e.kind,root,id:e.id,loaded:true,deathTime:0,time:e.id*.37,turn:e.dir>0?0:Math.PI,face:e.face??e.dir??-1,grow:1,drip:null,parts:{},reducedMotion:!!w.reducedMotion};
  if(e.kind==='hatworm')buildHatworm(w,view);
  else if(e.kind==='blinker')buildBlinker(w,view);
  else if(e.kind==='drip')buildDrip(w,view);
  animateDreamEnemy(view,e,0,'editing');
  return view;
}

// --- the hatworm --------------------------------------------------------------
// Four beads of body and a head, wearing three hats at once. The body group
// turns to face the way it walks; the root stays upright so the press is
// straight down whichever way it was going.
//
// With the models loaded, the body is the supplied caterpillar — 1.3 long, a
// little past the collider's .72 (ASSET_REQUESTS asks for about 1.4) — and the
// hats are the supplied hat, three of them nested on a group hung from the
// head bone so they ride every nod. Widths are in world units; the stack
// stays under ~1.1 so a stomping player's feet do not pass through the top hat
// (the collider's perch is .85, and the sculpted stack topped out near .95).
export const HATWORM_MODEL={length:1.3,hatWidths:[.46,.4,.34],nest:.55,headOffset:[0,.21,0]};
function buildHatworm(w,view){
  if(w.dreamAssets?.caterpillar&&w.dreamAssets?.hat){buildHatwormModel(w,view);return;}
  const body=new THREE.Group();body.name='Hatworm body';view.root.add(body);
  const segments=[];
  for(let i=0;i<4;i++){const m=w.ball(.19,.19,.19,i%2?slot(w,'top'):'cream',body,-.27+i*.18,.2,0);m.name='Hatworm segment';segments.push(m);}
  const head=w.ball(.24,.22,.22,slot(w,'top'),body,.3,.28,0);head.name='Hatworm head';
  for(const z of [-.09,.09]){
    w.ball(.06,.06,.04,'cream',body,.5,.34,z).name='Hatworm eye';
    w.ball(.03,.03,.02,'dark',body,.545,.34,z).name='Hatworm pupil';
  }
  const hats=[];
  for(let i=0;i<3;i++){
    const hat=new THREE.Group();hat.name=`Hatworm hat ${i+1}`;hat.position.set(.3,.46+i*.14,0);body.add(hat);
    w.cylinder(.26-i*.03,.05,'dark',hat,0,0,0).name='Hat brim';
    w.cylinder(.16-i*.02,.13,i%2?slot(w,'accent','gold'):'dark',hat,0,.08,0).name='Hat crown';
    w.cylinder(.17-i*.02,.035,'gold',hat,0,.04,0).name='Hat band';
    hats.push(hat);
  }
  view.parts={body,segments,head,hats};
}
function buildHatwormModel(w,view){
  const body=new THREE.Group();body.name='Hatworm body';view.root.add(body);
  const rig=dreamCaterpillar(w,body,HATWORM_MODEL.length);
  // The head group hangs from the head bone, in the model's own units, at the
  // crown; the hats nest inside it, each brim sunk into the crown below.
  const head=new THREE.Group();head.name='Hatworm head';head.position.fromArray(HATWORM_MODEL.headOffset);rig.head.add(head);
  const hats=[],stack=[];
  for(let i=0,y=0;i<HATWORM_MODEL.hatWidths.length;i++){
    const width=HATWORM_MODEL.hatWidths[i]/rig.scale,hat=new THREE.Group();hat.name=`Hatworm hat ${i+1}`;hat.position.y=y;head.add(hat);
    dreamHat(w,hat,width);hats.push(hat);stack.push(y);
    y+=dreamHatHeight(w,width)*HATWORM_MODEL.nest;
  }
  view.parts={body,rig,head,hats,stack};view.model=rig.model;
}
function animateHatworm(view,e,step){
  const {body}=view.parts,t=view.time,moving=Math.abs(e.vx||0)>.05;
  const angle=e.dir>0?0:Math.PI;view.turn+=(angle-view.turn)*(1-Math.exp(-14*step));body.rotation.y=view.turn;
  const wave=moving?1:.3;
  if(view.parts.rig){animateHatwormModel(view,view.reducedMotion?wave*.3:wave);return;}
  const {segments,head,hats}=view.parts;
  segments.forEach((m,i)=>{m.position.y=.2+Math.sin(t*10-i*1.2)*.035*wave;m.scale.y=.19*(1+Math.sin(t*10-i*1.2)*.08*wave);});
  head.position.y=.28+Math.sin(t*10+.6)*.025*wave;
  hats.forEach((hat,i)=>{hat.rotation.z=Math.sin(t*6+i*.9)*(.05+i*.03)*wave;hat.position.x=.3+Math.sin(t*6+i*.9)*.015*i;});
}
// The same walk on the supplied body: a hump travels down the bones from the
// tail as the sculpted beads bobbed, each station lifted and stretched in turn
// (never pushed below the deck), the head nodding at the neck, and the hats
// rocking with it. The rest pose goes back first, so the walk is layered on
// the model as it arrived and a paused frame holds exactly.
function animateHatwormModel(view,wave){
  const {rig,hats,stack}=view.parts,t=view.time;
  restoreRest(rig.rest);
  // rest[0] is the root bone; the stations follow it tail first, the head last.
  rig.rest.forEach((r,i)=>{
    if(i===0||r.bone===rig.head)return;
    const s=Math.sin(t*10-(i-1)*1.2);
    r.bone.position.y+=Math.max(0,s)*.035*wave;r.bone.scale.y=1+s*.08*wave;
  });
  rig.head.rotation.z=Math.sin(t*10+.6)*.06*wave;
  hats.forEach((hat,i)=>{hat.rotation.z=Math.sin(t*6+i*.9)*(.05+i*.03)*wave;hat.position.x=Math.sin(t*6+i*.9)*.012*i;hat.position.y=stack[i];});
}

// --- the blinker --------------------------------------------------------------
// A cream eyeball with an iris that swings toward the player and a lid that
// closes down over it now and then. The eye group is what the shatter reads,
// so the clumps come off the eye rather than the empty air under it.
function buildBlinker(w,view){
  const eye=new THREE.Group();eye.name='Blinker eye';eye.position.y=(BLINKER.bottom+BLINKER.top)/2;view.root.add(eye);
  const ball=w.ball(.48,.48,.48,'cream',eye,0,0,0);ball.name='Eyeball';
  const gaze=new THREE.Group();gaze.name='Blinker gaze';eye.add(gaze);
  w.ball(.22,.22,.1,slot(w,'accent','blue'),gaze,0,0,.42).name='Iris';
  w.ball(.1,.1,.05,'dark',gaze,0,0,.5).name='Pupil';
  w.ball(.04,.04,.02,'cream',gaze,.07,.08,.54).name='Glint';
  // An upper hemisphere shell: at rest it caps the eye, and swung forward
  // about x it comes down over the front like a lid.
  const lid=w.mesh(new THREE.SphereGeometry(.5,18,9,0,Math.PI*2,0,Math.PI/2),slot(w,'top'),eye,0,0,0);lid.name='Blinker lid';
  const stalk=w.ball(.12,.2,.12,slot(w,'top'),eye,0,-.5,0);stalk.name='Blinker stalk';
  view.parts={eye,ball,gaze,lid,stalk};
  view.squashNode=eye;
}
function animateBlinker(view,e,step){
  const {eye,gaze,lid}=view.parts,t=view.time;
  const face=e.face||e.dir||-1;view.face+=(face-view.face)*(1-Math.exp(-9*step));
  gaze.rotation.y=view.face*.55;gaze.rotation.x=-.12;
  // A blink every few seconds, staggered by id so a row of eyes never blinks
  // in unison; closed for a quarter of a second with a soft in and out.
  const cycle=3.4,phase=((t+view.id*.9)%cycle+cycle)%cycle,k=phase<.28?Math.sin(phase/.28*Math.PI):0;
  lid.rotation.x=Math.PI/2*k;
  eye.rotation.z=-(e.vx||0)*.05;
}

// --- the drip -----------------------------------------------------------------
// A teardrop of clay hanging from a short stalk. Its shape follows the rule's
// state: it stretches as it falls, lies as a puddle where it lands, and grows
// back on its stalk from nothing when it regrows.
function buildDrip(w,view){
  const blob=new THREE.Group();blob.name='Drip blob';view.root.add(blob);
  const colour=slot(w,'accent','blueLight');
  w.ball(.38,.44,.36,colour,blob,0,.44,0).name='Drip body';
  w.ball(.2,.28,.19,colour,blob,0,.8,0).name='Drip neck';
  w.ball(.09,.14,.09,colour,blob,0,1,0).name='Drip tip';
  w.ball(.09,.13,.05,'cream',blob,-.14,.55,.3).name='Drip sheen';
  const stalk=w.cylinder(.05,.6,slot(w,'vine','dark'),view.root,0,1.35,0);stalk.name='Drip stalk';
  view.parts={blob,stalk};
}
function animateDrip(view,e,step){
  const {blob,stalk}=view.parts,t=view.time,state=e.drip||'hanging';
  if(state!==view.drip){if(state==='hanging'&&view.drip)view.grow=0;view.drip=state;}
  view.grow=Math.min(1,view.grow+step/.35);
  view.root.visible=state!=='gone';
  stalk.visible=state==='hanging';
  if(state==='hanging'){
    const g=view.grow*view.grow*(3-2*view.grow),wobble=Math.sin(t*3)*.03;
    blob.scale.set(g*(1+wobble),g*(1-wobble),g*(1+wobble));blob.position.y=(1-g)*1.05;
  }else if(state==='falling'){blob.scale.set(.85,1.2,.85);blob.position.y=0;}
  else{blob.scale.set(1.75,.3,1.5);blob.position.y=0;}
}

export function animateDreamEnemy(view,e,dt,status){
  const step=status==='playing'?Math.min(dt,.05):0;view.time+=step;
  const root=view.root;root.position.set(e.x,e.y,.35);
  if(!e.alive){
    // Pressed flat where it was hit, like every other creature; the shatter
    // follows from world.render. A popped eye has nothing holding it up, so
    // its disc sinks slowly, never below the deck settleSquash found under it.
    view.deathTime+=step;
    const pose=applyFlatten(root,view.deathTime,{reducedMotion:view.reducedMotion});
    if(view.kind==='blinker'){
      const fall=view.reducedMotion?0:3*view.deathTime*view.deathTime;
      root.position.y=Math.max(e.y-fall,view.squashFloorY!==undefined?view.squashFloorY+.12:-Infinity);
    }
    return pose;
  }
  view.deathTime=0;root.visible=true;root.scale.setScalar(1);
  if(view.kind==='hatworm')animateHatworm(view,e,step);
  else if(view.kind==='blinker')animateBlinker(view,e,step);
  else if(view.kind==='drip')animateDrip(view,e,step);
  return null;
}
