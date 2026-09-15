import * as THREE from './lib/three.module.js';
import {createHandGeometry,createArrowGeometry} from './shape-hand-geometry.js';

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
    views.push({root,carrier,hands,marks,materials,geometries,station,gesture,opacity:0,time:0,dwell:0,seen:0});
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
  const x=gesture.reach?left+Math.min((right-left)*.65,1.65):(left+right)/2;
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
    root.position.set(spot.x,spot.y,1.8);

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
    for(const hand of view.hands){
      const dir=hand.userData.dir;
      hand.position.set((gesture.move[0]*swing+(gesture.mirror?.48:0))*dir,gesture.move[1]*swing,0);
      hand.rotation.z=gesture.turn*dir+(gesture.move[1]?swing*.12:0);
      // A press squashes the hand a little as it lands on the clay.
      hand.scale.y=1-swing*.08;
    }
    for(const mark of view.marks){
      const {dir,step,arrow}=mark.userData;
      mark.position.set(gesture.move[0]?(step+(gesture.mirror?.48:0))*dir:0,gesture.move[1]?-step:.35,0);
      mark.rotation.z=gesture.move[1]?-Math.PI/2:dir>0?0:Math.PI;
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
