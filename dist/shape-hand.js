import * as THREE from './lib/three.module.js';
import {RoundedBoxGeometry} from './lib/RoundedBoxGeometry.js';
import {createHandGeometry,createArrowGeometry} from './shape-hand-geometry.js';
import {shapedShare} from './clay-rules.js';
import {formPeak} from './clay-form.js';

// A large clay hand over kneadable clay, miming the stroke that clay needs,
// with a dashed run and a solid arrowhead for the direction. This is the
// tutorial layer only: the violet material and its breathing idle are what mark
// clay permanently, so the cue goes quiet on clay the player has already
// solved, and returns if anyone hesitates in front of clay they have not.
const PERIOD=1.9,DWELL=1.8;
// The fingertip touches the clay; the arrow describes the drag. Keeping the
// back of the hand facing the camera makes its thumb and knuckles readable.
const GESTURES={
  down:{move:[0,-.8],turn:Math.PI,reach:false},
  // Raising clay: the hand starts on the top face with its finger leading the
  // stroke, and the run and arrow rise above the clay instead of sinking in.
  up:{move:[0,.8],turn:0,reach:false,rise:true},
  right:{move:[.8,0],turn:0,reach:true},
  out:{move:[.75,0],turn:0,reach:false,mirror:true}
};
const ease=t=>t*t*(3-2*t);

function cueMaterial(){
  return new THREE.MeshStandardMaterial({color:0xffebcc,roughness:.62,
    metalness:0,emissive:0xffebcc,emissiveIntensity:.12,
    transparent:true,opacity:0,depthWrite:false});
}

function buildHand(geometry,material,parent,flip=1){
  const hand=new THREE.Group();hand.scale.x=flip;parent.add(hand);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Sculpted pointing hand';hand.add(mesh);
  return hand;
}
// An open hand, palm flat against the thing it pushes: a slab of a palm on its
// edge, four fingers up off it and a thumb off the near side, turned a little
// towards the camera so the back of the hand and the spread of the fingers
// read rather than a hand seen edge-on. Its palm face is at x 0; it pushes
// towards +x.
function buildPalm(material,parent){
  const hand=new THREE.Group();hand.name='Open clay hand, pushing';hand.scale.setScalar(1.55);parent.add(hand);
  const turn=new THREE.Group();turn.rotation.y=-.8;hand.add(turn);
  const palm=new THREE.Mesh(new RoundedBoxGeometry(.2,.6,.52,3,.08),material);palm.name='Palm';palm.position.set(-.1,0,0);turn.add(palm);
  for(const [i,len]of [.4,.5,.47,.37].entries()){
    const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.08,len,4,10),material);finger.name='Finger';
    finger.position.set(-.1,.3+len/2-.02,-.2+i*.13);finger.rotation.x=(i-1.5)*.05;finger.rotation.z=-.06;turn.add(finger);
  }
  const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.32,4,10),material);thumb.name='Thumb';
  thumb.position.set(-.14,.12,.31);thumb.rotation.z=-.75;thumb.rotation.x=.35;turn.add(thumb);
  return hand;
}
// The plug's cue follows its phases: nothing while the rot stands (the sign
// says stomp), a hand pushing the block once the gap is open, the press once
// the plug is seated, and nothing while it settles or once it is mended.
const fixMode=station=>{const phase=station.fix?.phase;return phase==='open'?'push':phase==='shaping'?'press':null;};
// Where the pushing hand stands: flat on the block's near face, a little below
// the block's middle, following the block as it goes.
function pushAnchor(station){
  const block=station.fix?.blockPlatform;
  if(!block||block.active===false||block.pushPhase!=='free')return null;
  return {x:block.x-.04,y:block.y-block.h*.45};
}

export function createShapeHands(w,L){
  const views=[];
  for(const station of L.shaping||[]){
    const gesture=GESTURES[station.gesture]||GESTURES.down;
    const root=new THREE.Group();root.name='Clay gesture hand · '+station.id;root.visible=false;
    w.levelRoot.add(root);
    const materials=[cueMaterial()];
    const geometries=[createHandGeometry(),new THREE.CapsuleGeometry(.055,.24,6,12),createArrowGeometry()];
    geometries[1].rotateZ(Math.PI/2);
    const carrier=new THREE.Group();root.add(carrier);
    // A spreading gesture needs two hands leaving the middle in opposite
    // directions; every other gesture is one hand travelling one way.
    const dirs=gesture.mirror?[1,-1]:[1];
    const hands=dirs.map(dir=>Object.assign(buildHand(geometries[0],materials[0],carrier,dir),{userData:{dir}}));
    // A dashed run and an arrowhead: the same drawing the reference uses.
    const marks=[];
    for(const dir of dirs){
      for(let i=0;i<3;i++){
        const dash=new THREE.Mesh(geometries[1],materials[0]);carrier.add(dash);
        dash.userData={dir,step:1.4+i*.53,dash:true};marks.push(dash);
      }
      const head=new THREE.Mesh(geometries[2],materials[0]);carrier.add(head);
      head.userData={dir,step:3.32,arrow:true};marks.push(head);
    }
    const view={root,carrier,hands,marks,materials,geometries,station,gesture,opacity:0,time:0,dwell:0,seen:0};
    if(station.fix){view.palm=buildPalm(materials[0],carrier);view.palm.visible=false;}
    views.push(view);
  }
  return views;
}

// The anchor tracks the clay's live pose, so the cue keeps pointing at the
// object even while it is being kneaded, and stays inside the player's view
// when the clay is tall.
function anchor(view,L,player){
  const {station,gesture}=view;
  let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  // A row whose slabs move one at a time points at the first slab still to
  // raise, not at the middle of the row where no single slab is.
  const open=station.amounts?station.parts.filter((id,i)=>station.amounts[i]<.995):[];
  for(const id of open.length?open.slice(0,1):station.parts){
    const s=L.platforms.find(p=>p.id===id);if(!s)continue;
    left=Math.min(left,s.x);right=Math.max(right,s.x+s.w);
    // The formable mass has no pose: its top is wherever its clay stands.
    top=Math.max(top,s.form?s.y-s.h+formPeak(s.form):s.y+(s.slope||0));bottom=Math.min(bottom,s.y-(s.h??.65));
  }
  if(!Number.isFinite(left))return null;
  // A station may say where on its clay the first stroke belongs — a mass
  // wide enough to hold two towers has nothing to point at in its middle.
  const x=Number.isFinite(station.cueX)?station.cueX:gesture.reach?left+Math.min((right-left)*.65,1.65):(left+right)/2;
  // A rising stroke draws its run above the clay, so the hand sits on the top
  // face and keeps lower in the view to leave the arrow room overhead.
  if(gesture.rise)return {x,y:Math.max(bottom+1,Math.min(top+.35,player.y+3))};
  // Touch the upper face instead of floating a disconnected hand above it.
  // Reserve space for the raised index even beside the tall stair wall.
  const y=Math.max(bottom+1,Math.min(top-(gesture.move[1]?.25:1.05),player.y+3.7));
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
    const mode=station.fix?fixMode(station):'press';
    const spot=mode==='push'?pushAnchor(station):mode?anchor(view,L,p):null;
    const inStretch=!!spot&&p.x>=station.x&&p.x<=station.end&&Math.abs(p.y-station.spawn.y)<10;
    const unworked=station.amount<.995;
    // Dwell resets whenever the clay moves, so the cue never nags a player who
    // is already kneading — only one who is standing there doing nothing. A row
    // of slabs counts every slab, not just the lowest one.
    const worked=shapedShare(station);
    if(!inStretch||!unworked||worked>(view.lastAmount??0)+1e-4)view.dwell=0;
    else view.dwell+=playing?dt:0;
    view.lastAmount=worked;
    const teaching=!done?.has(station.id)||view.dwell>DWELL;
    // A player already shoving the block needs no hand to show them.
    const wanted=inStretch&&unworked&&teaching&&!w.editorCamera&&game.status!=='complete'&&!(mode==='push'&&p.pushing);
    view.opacity+=((wanted?1:0)-view.opacity)*(1-Math.exp(-dt*7));
    // The cue recedes as the clay takes shape: the player sees their own work.
    const alpha=view.opacity*(.25+.75*(1-worked));
    root.visible=alpha>.02;
    if(!root.visible)continue;
    // A cue that has just lost its anchor fades where it was.
    if(spot)root.position.set(spot.x,spot.y,1.8);
    if(view.palm){
      // One cue or the other: the open hand at the block, or the pointing
      // hand with its run and arrow over the clay.
      view.palm.visible=mode==='push';
      for(const hand of view.hands)hand.visible=mode!=='push';
      for(const mark of view.marks)mark.visible=mode!=='push';
    }

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
    view.carrier.scale.setScalar(w.landscape===false?.9:1);
    if(mode==='push'){
      // The hand comes at the block and leans on it: a short shove, a little
      // squash as the palm meets the face, and back for the next.
      view.palm.position.set(-.55+.55*swing,0,0);
      view.palm.scale.set(1-swing*.12,1+swing*.04,1);
      for(const m of view.materials)m.opacity=alpha*(.5+.5*fade);
      continue;
    }
    for(const hand of view.hands){
      const dir=hand.userData.dir;
      hand.position.set((gesture.move[0]*swing+(gesture.mirror?.48:0))*dir,gesture.move[1]*swing,0);
      hand.rotation.z=gesture.turn*dir-Math.sign(gesture.move[1])*swing*.12;
      // A press squashes the hand a little as it lands on the clay.
      hand.scale.y=1-swing*.08;
    }
    for(const mark of view.marks){
      const {dir,step,arrow}=mark.userData;
      const vertical=Math.sign(gesture.move[1]);
      mark.position.set(gesture.move[0]?(step+(gesture.mirror?.48:0))*dir:0,vertical?vertical*step:.35,0);
      mark.rotation.z=vertical?vertical*Math.PI/2:dir>0?0:Math.PI;
      // The run lights up in sequence, so the direction is unmistakable.
      const lead=w.reducedMotion?.75:Math.max(0,1-Math.abs(u*5-step)*1.2);
      mark.scale.setScalar(arrow?.85+lead*.035:.9+lead*.1);
    }
  }
}

export function disposeShapeHands(w){
  for(const view of w.shapeHands||[]){
    view.root.removeFromParent();
    for(const g of view.geometries)g.dispose();
    for(const m of view.materials)m.dispose();
  }
  w.shapeHands=[];
}
