import * as THREE from './lib/three.module.js';

// A large clay hand hovering over kneadable clay, miming the gesture that clay
// needs. It replaces the instruction panel chapter four used to pop up: the cue
// sits on the object it refers to, so the player never has to map a sentence
// onto a shape. It fades in when the player enters the station's stretch, fades
// out as the clay takes shape, and is gone once the clay is finished.
const PERIOD=1.9;
// Which way the mimed gesture travels, and how the hand is held to make it.
// Fingers lead the way the clay has to travel: down for a press, along the
// pull for a stretch. `turn` rotates the hand (its fingers point -y at rest).
const GESTURES={
  down:{move:[0,-1.05],turn:0,rest:1.35,reach:false},
  right:{move:[1.5,0],turn:Math.PI/2,rest:1.15,reach:true},
  out:{move:[1.1,0],turn:Math.PI/2,rest:1.15,reach:false,mirror:true}
};
const ease=t=>t*t*(3-2*t);

function fadeMaterial(w,name,color){
  const base=w.mat[name];
  const m=base?base.clone():new THREE.MeshStandardMaterial({color,roughness:.93});
  // Transparent materials keep the plain surface: the clay shader skips them,
  // which suits a guide that should read as a cue rather than as scenery.
  m.color.setHex(color);m.transparent=true;m.opacity=0;m.depthWrite=false;m.roughness=.9;m.metalness=0;
  m.emissive?.setHex(color);m.emissiveIntensity=.22;
  return m;
}

function buildHand(w,materials,parent,flip=1){
  const hand=new THREE.Group();hand.scale.x=flip;parent.add(hand);
  const [skin,cuff]=materials;
  // Palm, four curled fingers and a thumb, sized so the cue reads at a glance:
  // roughly two-thirds of the player's height across.
  w.box(.74,.66,.34,skin,hand,0,-.1,0,.26);
  for(let i=0;i<4;i++){
    const x=-.27+i*.18,len=.46-Math.abs(i-1.2)*.05;
    const finger=w.box(.155,len,.28,skin,hand,x,-.52-len*.28,.02,.075);
    finger.rotation.z=(i-1.5)*.045;
  }
  w.box(.19,.34,.26,skin,hand,-.44,-.2,.1,.09).rotation.z=.72;
  w.box(.6,.26,.36,cuff,hand,0,.3,0,.12);
  return hand;
}

export function createShapeHands(w,L){
  const views=[];
  for(const station of L.shaping||[]){
    const gesture=GESTURES[station.gesture]||GESTURES.down;
    const root=new THREE.Group();root.name='Clay gesture hand · '+station.id;root.visible=false;
    w.levelRoot.add(root);
    const materials=[fadeMaterial(w,'cream',0xfbe6c2),fadeMaterial(w,'orange',0xef7c2b)];
    const carrier=new THREE.Group();root.add(carrier);
    // A spreading gesture needs two hands leaving the middle in opposite
    // directions; every other gesture is one hand travelling one way.
    const dirs=gesture.mirror?[1,-1]:[1];
    const hands=dirs.map(dir=>Object.assign(buildHand(w,materials,carrier,dir),{userData:{dir}}));
    // Chevrons ahead of each hand say which way the clay wants to travel.
    const chevrons=[];
    for(const dir of dirs)for(let i=0;i<3;i++){
      const mark=new THREE.Group();mark.userData.dir=dir;mark.userData.step=(i+1)/3;carrier.add(mark);
      for(const side of [-1,1]){
        const arm=w.box(.4,.13,.16,materials[1],mark,0,side*.12,0,.05);
        arm.rotation.z=side*.72;
      }
      chevrons.push(mark);
    }
    views.push({root,carrier,hands,chevrons,materials,station,gesture,opacity:0,time:0});
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
  for(const view of w.shapeHands||[]){
    const {station,gesture,root}=view;
    const spot=anchor(view,L,p);
    const inStretch=!!spot&&p.x>=station.x&&p.x<=station.end&&Math.abs(p.y-station.spawn.y)<10;
    const wanted=inStretch&&station.amount<.995&&!w.editorCamera&&game.status!=='complete';
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
    for(const mark of view.chevrons){
      const {dir,step}=mark.userData;
      mark.position.set(gesture.move[0]*step*1.05*dir,gesture.move[1]*step*1.05,0);
      mark.rotation.z=gesture.move[1]?-Math.PI/2:dir>0?0:Math.PI;
      const lead=w.reducedMotion?.7:Math.max(0,1-Math.abs(u*1.6-step)*2.2);
      mark.scale.setScalar(.55+lead*.5);
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
