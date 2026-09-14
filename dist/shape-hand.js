import * as THREE from './lib/three.module.js';
import {MAGIC_CLAY} from './shaping-views.js';

// A large clay hand over kneadable clay, miming the stroke that clay needs,
// with a dashed run and a solid arrowhead for the direction. This is the
// tutorial layer only: the violet material and its breathing idle are what mark
// clay permanently, so the cue goes quiet on clay the player has already
// solved, and returns if anyone hesitates in front of clay they have not.
const PERIOD=1.9,DWELL=1.8;
// Which way the mimed gesture travels, and how the hand is held to make it.
// The pointing finger leads the way the clay has to go (it points -y at rest).
const GESTURES={
  down:{move:[0,-1.05],turn:0,rest:1.35,reach:false},
  right:{move:[1.5,0],turn:Math.PI/2,rest:1.15,reach:true},
  out:{move:[1.1,0],turn:Math.PI/2,rest:1.15,reach:false,mirror:true}
};
const ease=t=>t*t*(3-2*t);

function cueMaterial(w,name,color){
  const base=w.mat[name];
  const m=base?base.clone():new THREE.MeshStandardMaterial({color,roughness:.93});
  // Transparent materials keep the plain surface: the clay shader skips them,
  // which suits a guide that should read as a cue rather than as scenery.
  m.color.setHex(color);m.transparent=true;m.opacity=0;m.depthWrite=false;m.roughness=.9;m.metalness=0;
  m.emissive?.setHex(color);m.emissiveIntensity=.2;
  return m;
}

function buildHand(w,materials,parent,flip=1){
  const hand=new THREE.Group();hand.scale.x=flip;parent.add(hand);
  const [skin,cuff]=materials;
  // The reference hand: a soft rounded fist with one extended finger leading
  // the stroke, built from balls and a capsule rather than boxes so the
  // silhouette is mitten-round, and a chunky cuff at the wrist. About two
  // thirds of the player's height across, to read at a glance.
  w.ball(.4,.37,.22,skin,hand,0,-.06,0);
  // Extended finger, capped so its tip is round.
  const finger=w.cylinder(.115,.52,skin,hand,-.03,-.5,.06);finger.rotation.z=.06;
  w.ball(.12,.12,.12,skin,hand,-.05,-.75,.06);
  // Curled knuckles along the front of the fist.
  for(let i=0;i<3;i++)w.ball(.115,.1,.12,skin,hand,.13+i*.02,-.3-i*.17,-.04);
  // Thumb folded across.
  const thumb=w.ball(.1,.17,.11,skin,hand,-.33,-.19,.09);thumb.rotation.z=.62;
  w.ball(.33,.16,.24,cuff,hand,0,.28,0);
  return hand;
}

export function createShapeHands(w,L){
  const views=[];
  for(const station of L.shaping||[]){
    const gesture=GESTURES[station.gesture]||GESTURES.down;
    const root=new THREE.Group();root.name='Clay gesture hand · '+station.id;root.visible=false;
    w.levelRoot.add(root);
    // The cuff carries the clay's own violet, so the cue and the object it
    // refers to are visibly the same idea.
    const materials=[cueMaterial(w,'cream',0xfff2dc),cueMaterial(w,'orange',MAGIC_CLAY)];
    const carrier=new THREE.Group();root.add(carrier);
    // A spreading gesture needs two hands leaving the middle in opposite
    // directions; every other gesture is one hand travelling one way.
    const dirs=gesture.mirror?[1,-1]:[1];
    const hands=dirs.map(dir=>Object.assign(buildHand(w,materials,carrier,dir),{userData:{dir}}));
    // A dashed run and an arrowhead: the same drawing the reference uses.
    const marks=[];
    for(const dir of dirs){
      for(let i=0;i<4;i++){
        const dash=w.box(.31,.14,.15,materials[0],carrier,0,0,0,.07);
        dash.userData={dir,step:.42+i*.29,dash:true};marks.push(dash);
      }
      // A solid triangular head closes the run, as the reference draws it.
      const head=new THREE.Group();carrier.add(head);
      const tip=w.mesh(new THREE.ConeGeometry(.3,.46,3),materials[0],head,0,0,0);
      tip.rotation.z=-Math.PI/2;tip.rotation.y=Math.PI/2;tip.scale.z=.5;
      head.userData={dir,step:1.82,arrow:true};marks.push(head);
    }
    views.push({root,carrier,hands,marks,materials,station,gesture,opacity:0,time:0,dwell:0,seen:0});
  }
  return views;
}

// The anchor tracks the clay's live pose, so the cue keeps pointing at the
// object even while it is being kneaded, and stays inside the player's view
// when the clay is tall.
function anchor(view,L,player){
  const {station,gesture}=view;
  let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  for(const id of station.parts){
    const s=L.platforms.find(p=>p.id===id);if(!s)continue;
    left=Math.min(left,s.x);right=Math.max(right,s.x+s.w);
    top=Math.max(top,s.y+(s.slope||0));bottom=Math.min(bottom,s.y-(s.h??.65));
  }
  if(!Number.isFinite(left))return null;
  const x=gesture.reach?left+.55:(left+right)/2;
  // Prefer hovering just clear of the clay's top; on a tall plug, stay inside
  // the landscape camera's headroom (viewH 8.7 centred a little above the
  // player) so the cue never drifts off the top of the screen.
  const y=Math.max(bottom+1,Math.min(top+gesture.rest,player.y+5));
  return {x,y};
}

export function animateShapeHands(w,game,dt,playing){
  const L=game.level,p=game.player;
  // Teaching is per piece of clay, not a global tally. A player who has shaped
  // three ramps has learned ramps, not the stair wall they have never met — and
  // counting globally is how a veteran ends up beside unfamiliar clay with no
  // cue at all. Clay you have finished before stays quiet unless you hesitate.
  const done=w.clayDone;
  for(const view of w.shapeHands||[]){
    const {station,gesture,root}=view;
    const spot=anchor(view,L,p);
    const inStretch=!!spot&&p.x>=station.x&&p.x<=station.end&&Math.abs(p.y-station.spawn.y)<10;
    const unworked=station.amount<.995;
    // Dwell resets whenever the clay moves, so the cue never nags a player who
    // is already kneading — only one who is standing there doing nothing.
    if(!inStretch||!unworked||station.amount>(view.lastAmount??0)+1e-4)view.dwell=0;
    else view.dwell+=playing?dt:0;
    view.lastAmount=station.amount;
    const teaching=!done?.has(station.id)||view.dwell>DWELL;
    const wanted=inStretch&&unworked&&teaching&&!w.editorCamera&&game.status!=='complete';
    view.opacity+=((wanted?1:0)-view.opacity)*(1-Math.exp(-dt*7));
    // The cue recedes as the clay takes shape: the player sees their own work.
    const alpha=view.opacity*(.25+.75*(1-station.amount));
    root.visible=alpha>.02;
    if(!root.visible)continue;
    root.position.set(spot.x,spot.y,1.35);

    view.time+=playing?dt:0;
    // Reduced motion holds a legible mid-gesture pose instead of looping.
    const u=w.reducedMotion?.34:(view.time%PERIOD)/PERIOD;
    const forward=u<.62;
    const swing=w.reducedMotion?.6:forward?ease(u/.62):0;
    // The stroke shows, then the hand fades on its way back to the start, so
    // the gesture always reads in one direction.
    const fade=w.reducedMotion?1:forward?1:Math.max(0,1-(u-.62)/.16);
    for(const m of view.materials)m.opacity=alpha*(.35+.65*fade);
    const bob=w.reducedMotion?0:Math.sin(view.time*2.3)*.07*(1-swing);
    view.carrier.position.set(0,bob,0);
    for(const hand of view.hands){
      const dir=hand.userData.dir;
      hand.position.set(gesture.move[0]*swing*dir,gesture.move[1]*swing,0);
      hand.rotation.z=gesture.turn*dir+(gesture.move[1]?swing*.12:0);
      // A press squashes the hand a little as it lands on the clay.
      hand.scale.y=1-swing*.08;
    }
    for(const mark of view.marks){
      const {dir,step,arrow}=mark.userData;
      mark.position.set(gesture.move[0]*step*.82*dir,gesture.move[1]*step*.82,0);
      mark.rotation.z=gesture.move[1]?-Math.PI/2:dir>0?0:Math.PI;
      // The run lights up in sequence, so the direction is unmistakable.
      const lead=w.reducedMotion?.75:Math.max(0,1-Math.abs(u*2.2-step)*1.6);
      mark.scale.setScalar(arrow?.8+lead*.35:.62+lead*.5);
    }
  }
}

export function disposeShapeHands(w){
  for(const view of w.shapeHands||[]){
    view.root.removeFromParent();
    for(const m of view.materials)m.dispose();
  }
  w.shapeHands=[];
}
