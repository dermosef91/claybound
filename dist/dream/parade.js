import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {sectionDecks,deck,lean,slot,rand} from './support.js';
// Section 5 — The Melted Parade. One idea: a parade frozen mid-step, cream
// statues on an ultramarine parade ground, each with exactly one bubblegum
// detail, waking one member at a time as the player passes. Four colours —
// ultramarine (main), cream (secondary), lilac (backdrop), bubblegum (accent)
// — and the section's one licensed extra, a sherbet-lemon ribbon in the
// spiral sun. Big simple shapes: two boots, a six-legged giraffe whose decks
// are its body, a coiled hat-worm on a plinth, a caterpillar that is the lift,
// a hand whose fist is the self-opening stair, a tiny house on its fingertips,
// a teapot by the exit. One thing moves per screen besides the creatures.
//
// Render side is WORLD: decks are looked up by id, props are placed from
// those decks, and everything built inside a deck's group is local to it.

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const UP=new THREE.Vector3(0,1,0);
// A cylinder from a to b (local coordinates of parent).
function bar(w,parent,a,b,r,mat){
  const d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),len=d.length();
  const m=w.cylinder(r,len,mat,parent,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
  m.quaternion.setFromUnitVectors(UP,d.normalize());return m;
}
// Per-frame work is a list of {node,tick} on the world; entries whose node
// has streamed out (or belongs to a previous build) are dropped as found.
function register(w,node,tick){(w.paradeAnim??=[]).push({node,tick});}
// The one colour outside the palette slots: sherbet lemon, for the sun's
// ribbon only. Built once per world; w.mesh hooks the clay relief for it.
// Neither ribbon takes fog: at the sky layer's depth the pink haze would
// bleach lemon to cream, and the sun is meant to be the one hot thing up there.
function lemon(w){
  if(w.paradeLemon)return w.paradeLemon;
  const m=new THREE.MeshStandardMaterial({color:0xf2ee74,emissive:0xf2ee74,emissiveIntensity:.55,roughness:.7,metalness:0,fog:false});
  m.name='Parade lemon';return w.paradeLemon=m;
}
function bubblegumGlow(w){
  if(w.paradeGum)return w.paradeGum;
  const m=new THREE.MeshStandardMaterial({color:0xff6fb8,emissive:0xff6fb8,emissiveIntensity:.5,roughness:.7,metalness:0,fog:false});
  m.name='Parade bubblegum glow';return w.paradeGum=m;
}

// --- the parade ground ----------------------------------------------------------
// A flat ultramarine plaza: a lighter cap over a darker body, the ends rolled
// like every dream deck, and pink paint melting off the front lip.
function plaza(w,s,g){
  const W=s.w,cap=slot(w,'terrain','blue'),body=slot(w,'terrain2','blueDark'),paint=slot(w,'accent');
  g.name='Parade ground · '+s.id;
  w.box(W+.12,.6,3.6,cap,g,W/2,-.3,0,.24).name='Plaza cap';
  w.box(W,9.4,3.1,body,g,W/2,-5.2,-.1,.6).name='Plaza body';
  for(const x of [.3,W-.3])w.ball(.42,.32,1.7,cap,g,x,-.08,.1).name='Plaza roll';
  const n=Math.max(2,Math.round(W/2.8));
  for(let i=0;i<n;i++){
    const x=.9+rand(i*3+s.x)*(W-1.8),len=.5+rand(i*7+s.x)*.9;
    w.ball(.42,.09,.5,paint,g,x,-.02,1.42).name='Melted paint';
    w.ball(.26,len,.16,paint,g,x,-.5-len*.5,1.74).name='Paint drip';
  }
  for(let i=0;i<Math.max(1,Math.round(W/6));i++){
    const x=1.5+rand(i*5+s.x*.3)*(W-3);
    w.ball(.7+rand(i+s.x)*.4,.07,.45,paint,g,x,.03,-1.2).name='Paint puddle';
  }
}

// --- the boots --------------------------------------------------------------------
// Two cream boots with nobody in them, stepping on the spot once the player
// has walked past. Their one bubblegum detail is a bow at the ankle.
function boot(w,parent,name,phase){
  const g=group(parent,name),cream=slot(w,'top'),tan=slot(w,'bark','rope');
  w.cylinder(.46,1.5,cream,g,0,1.05,0).name='Boot shaft';
  w.ball(.82,.4,.52,cream,g,.32,.34,0).name='Boot foot';
  w.ball(.38,.34,.4,tan,g,.98,.36,0).name='Boot toe';
  w.ball(.2,.13,.12,slot(w,'accent'),g,-.02,.66,.5).name='Boot bow';
  g.userData.phase=phase;return g;
}
function boots(w,parent,x){
  const left=boot(w,parent,'Boot left',0),right=boot(w,parent,'Boot right',Math.PI);
  left.position.x=-1.05;right.position.x=1.05;
  let march=0;
  register(w,parent,(game,dt,ctx)=>{
    const awake=ctx.playerX>x-.4;
    march=ctx.reducedMotion?0:clamp(march+(awake?dt:-dt)*.8,0,1);
    for(const b of [left,right]){
      const k=Math.max(0,Math.sin(ctx.time*2.6+b.userData.phase))*march;
      b.position.y=k*.34;b.rotation.z=-k*.18;
    }
  });
}

// --- the giraffe --------------------------------------------------------------------
// Its decks are its body: a knee on the leg stretched forward, the back deck as
// the torso on five straight legs, a collar on the neck, and a six-petal flower
// for a head. Cream throughout; the flower's bubblegum face is its one detail
// and it tilts toward the player (a leaner pivoting at the flower's centre).
function knee(w,s,g){
  g.name='Giraffe knee · '+s.id;const cream=slot(w,'top');
  w.ball(.92,.46,.82,cream,g,.8,-.46,0).name='Knee';
  bar(w,g,[.6,-.5,-.2],[.35,-2,-.2],.34,cream).name='Shin';
  bar(w,g,[1.1,-.55,-.2],[2.9,.2,-.3],.34,cream).name='Thigh';
  return {root:g,ropes:[],bounce:0};
}
function torso(w,s,g){
  g.name='Giraffe body · '+s.id;const cream=slot(w,'top');
  w.box(s.w+.3,1.7,2.5,cream,g,s.w/2,-.85,0,.8).name='Torso';
  // Spots in the ground's own ultramarine, pressed flat on the flank.
  for(const [i,[x,y,r]] of [[1.3,-.7,.42],[3,-1.05,.5],[4.7,-.6,.38],[6.1,-1,.46]].entries())
    w.ball(r,r*.8,.12,slot(w,'terrain','blue'),g,x,y,1.22+i*.005).name='Spot';
  for(const [i,x] of [1.3,2.6,3.9,5.2,6.4].entries()){
    const leg=w.cylinder(.29,2.35,cream,g,x,-2.85,i%2?-.5:.4);leg.name='Leg';
  }
  bar(w,g,[s.w+.1,-.3,-.3],[s.w+.9,-1.7,-.4],.12,cream).name='Tail';
  return {root:g,ropes:[],bounce:0};
}
function collar(w,s,g){
  g.name='Giraffe neck · '+s.id;const cream=slot(w,'top');
  bar(w,g,[-1.6,-2.5,-.3],[2.7,.6,-.3],.5,cream).name='Neck';
  w.ball(.92,.48,.8,cream,g,.8,-.48,0).name='Collar';
  return {root:g,ropes:[],bounce:0};
}
function flowerHead(w,s,g){
  g.name='Giraffe head · '+s.id;const cream=slot(w,'top');
  const face=lean(w,group(g,'Giraffe face',1.2,-1.3,0),{x:s.x+1.2,y:s.y,strength:.22});
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2,p=w.ball(.68,.4,.3,cream,face,Math.cos(a)*1.05,Math.sin(a)*1.05,0);p.rotation.z=a;p.name='Petal';
  }
  w.ball(.8,.8,.34,slot(w,'accent'),face,0,0,.14).name='Flower face';
  for(const x of [-.3,.3])w.ball(.13,.05,.05,'dark',face,x,.12,.5).name='Sleeping eye';
  return {root:g,ropes:[],bounce:0};
}

// --- the hat-worm's plinth and hats ---------------------------------------------------
// The violet coil is the station's own clay view. Under it stands a cream
// plinth (the bridge rests on its top once pulled), and on it a stack of five
// hats that tumble off one by one as the pull passes .3 / .5 / .7 / .85 / 1 —
// visual keyframes only, landing along the stretched worm's back.
function plinth(w,parent){
  const cream=slot(w,'top');
  w.box(2.2,9.4,2,cream,parent,0,3.1,0,.5).name='Plinth';
  w.box(2.8,.5,2.4,slot(w,'bark','rope'),parent,0,-1.4,0,.15).name='Plinth foot';
  w.box(2.32,.26,2.1,slot(w,'accent'),parent,0,6.4,0,.08).name='Plinth band';
}
function hats(w,parent,worm){
  const cream=slot(w,'top'),list=[];
  for(let i=0;i<5;i++){
    const hat=group(parent,`Hat ${i+1}`,0,i*.62,0);
    w.cylinder(.78-i*.05,.12,cream,hat,0,.06,0).name='Hat brim';
    w.cylinder(.5-i*.04,.52,cream,hat,0,.36,0).name='Hat crown';
    if(i===2)w.cylinder(.52,.1,slot(w,'accent'),hat,0,.2,0).name='Hat band';
    // Stack pose (local to the prop at the coil's top) and where it lands: on
    // the bridge's back edge, spaced along it, one full turn in the air and
    // settling almost upright at a random tilt.
    list.push({hat,at:[0,i*.62,0],to:[1.6+i*1.55,worm.shape.to.y-worm.shape.from.y+.1,-.9],spin:Math.PI*2+(rand(i*13+3)-.5)*.9,threshold:[.3,.5,.7,.85,.99][i],t:0});
  }
  let first=true;
  register(w,parent,(game,dt,ctx)=>{
    const station=(game.level.shaping||[]).find(st=>st.id==='parade-worm'),amount=station?.amount??0;
    for(const h of list){
      const falling=amount>=h.threshold;
      if(first)h.t=falling?1:0;
      h.t=ctx.reducedMotion?(falling?1:0):clamp(h.t+(falling?dt/1.1:-dt/.4),0,1);
      const k=smooth(h.t),arc=Math.sin(k*Math.PI)*1.4;
      h.hat.position.set(h.at[0]+(h.to[0]-h.at[0])*k,h.at[1]+(h.to[1]-h.at[1])*k+arc,h.at[2]+(h.to[2]-h.at[2])*k);
      h.hat.rotation.z=-h.spin*k;
    }
    first=false;
  });
}

// --- the caterpillar ----------------------------------------------------------------
// The lift itself: five cream beads and a head with a bubblegum nose, on five
// stubby legs that only pump while the lift is moving.
function caterpillar(w,s,g){
  g.name='Caterpillar · '+s.id;const cream=slot(w,'top');
  for(let i=0;i<5;i++)w.ball(.46,.42,.46,cream,g,.55+i*.8,-.42,0).name='Caterpillar bead';
  const head=group(g,'Caterpillar head',4.1,-.42,0);
  w.ball(.56,.4,.5,cream,head,0,0,0).name='Head';
  w.ball(.15,.15,.13,slot(w,'accent'),head,.52,.06,.12).name='Nose';
  w.ball(.11,.04,.04,'dark',head,.22,.12,.44).name='Sleeping eye';
  const legs=[];
  for(let i=0;i<5;i++){const leg=w.cylinder(.09,.55,cream,g,.55+i*.8,-.97,i%2?.26:-.26);leg.name='Caterpillar leg';legs.push(leg);}
  let swing=0;
  register(w,g,(game,dt,ctx)=>{
    const live=game.level.platforms.find(q=>q.id===s.id),moving=!!live&&Math.abs(live.x-(live.prevX??live.x))>1e-5;
    swing=ctx.reducedMotion?0:clamp(swing+(moving?dt*3:-dt*2),0,1);
    legs.forEach((leg,i)=>{leg.rotation.z=Math.sin(ctx.time*9+i*1.3)*.55*swing;});
  });
  return {root:g,ropes:[],bounce:0};
}

// --- the hand ------------------------------------------------------------------------
// The palm deck is a cream hand rising from the paint on a wrist, thumb up at
// its heel; its one bubblegum detail is a ring on the wrist. The fist beyond
// it is the auto station's clay, drawn in cream too (dream-views' tint view
// with the piece recoloured to the secondary slot) so the whole hand is one
// statue that opens into a stair.
function palmDeck(w,s,g){
  const W=s.w,cream=slot(w,'top'),tan=slot(w,'bark','rope');
  g.name='Hand palm · '+s.id;
  w.box(W+.1,1.6,3.2,cream,g,W/2,-.8,0,.6).name='Palm';
  w.box(W-.8,1,2.6,tan,g,W/2,-1.95,-.1,.4).name='Heel of the hand';
  w.cylinder(1.35,7.4,cream,g,W*.55,-5.9,-.2).name='Wrist';
  const ring=w.mesh(new THREE.TorusGeometry(1.46,.17,8,30),slot(w,'accent'),g,W*.55,-3.1,-.2);ring.rotation.x=Math.PI/2;ring.name='Wrist ring';
  const thumb=w.cylinder(.55,2.7,cream,g,.5,.9,-1.2);thumb.rotation.z=.6;thumb.name='Thumb';
  w.ball(.6,.52,.55,cream,g,-.25,2.15,-1.2).name='Thumb tip';
}
function fist(w,s,g){
  const view=createDreamView(w,s,g);if(!view)return null;
  const cream=w.mat[slot(w,'top','cream')];
  for(const piece of view.clay?.pieces||[])piece.mesh.material=cream;
  g.name='Hand fingers · '+s.id;
  // Five knuckles along the clay's top edge, following its live pose: a row
  // across the closed fist, then spaced out along the stair once it has opened.
  const knuckles=[];
  for(let i=0;i<5;i++){const k=w.ball(.21,.17,.12,slot(w,'bark','rope'),g,0,0,1.34);k.name='Knuckle';k.castShadow=false;knuckles.push(k);}
  const pose=live=>{const {w:W,slope=0}=live;knuckles.forEach((k,i)=>{const u=(i+.5)/5;k.position.set(u*W,slope*u-.24,1.34);});};
  pose(s);
  register(w,g,game=>{const live=game.level.platforms.find(q=>q.id===s.id);if(live)pose(live);});
  return view;
}
function fingertips(w,s,g){
  g.name='Fingertips and house · '+s.id;const cream=slot(w,'top'),tan=slot(w,'bark','rope');
  w.box(s.w,.55,2.4,cream,g,s.w/2,-.27,0,.26).name='Fingertips';
  for(const x of [.5,s.w/2,s.w-.5])w.ball(.44,.3,.5,cream,g,x,-.5,.95).name='Fingertip';
  const house=group(g,'Tiny house',s.w/2+.1,0,-1.15);
  w.box(1.5,1.2,1.3,cream,house,0,.6,0,.12).name='House';
  const roof=w.mesh(new THREE.ConeGeometry(1.2,.95,4),slot(w,'accent'),house,0,1.66,0);roof.rotation.y=Math.PI/4;roof.name='Roof';
  w.box(.24,.5,.24,tan,house,.45,1.85,0,.04).name='Chimney';
  w.box(.32,.52,.06,tan,house,0,.26,.66,.03).name='Door';
  return {root:g,ropes:[],bounce:0};
}

// --- the teapot ------------------------------------------------------------------------
// A cream teapot on the parade ground by the exit, its bubblegum lid knob its
// one detail. It tilts to pour and steams once the player has passed x 66.
function teapot(w,parent,wakeX){
  const cream=slot(w,'top'),pot=group(parent,'Teapot');
  const profile=[[0,0],[.75,0],[1.05,.35],[1.1,.85],[.9,1.3],[.55,1.5],[.4,1.56],[0,1.56]].map(([r,y])=>new THREE.Vector2(r,y));
  w.mesh(new THREE.LatheGeometry(profile,20),cream,pot,0,0,0).name='Teapot body';
  w.ball(.2,.18,.2,slot(w,'accent'),pot,0,1.7,0).name='Lid knob';
  const handle=w.mesh(new THREE.TorusGeometry(.5,.1,8,22),cream,pot,-1.1,.9,0);handle.name='Handle';
  const spout=w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.8,.5,0),new THREE.Vector3(1.4,.8,0),new THREE.Vector3(1.75,1.5,0)]),10,.14,7,false),cream,pot,0,0,0);spout.name='Spout';
  const steam=[];
  for(let i=0;i<6;i++){const puff=w.ball(.13,.13,.13,cream,parent,1.75,1.6,0);puff.name='Steam';puff.castShadow=false;puff.visible=false;steam.push(puff);}
  let pour=0;
  register(w,parent,(game,dt,ctx)=>{
    const awake=ctx.playerX>wakeX;
    pour=ctx.reducedMotion?(awake?1:0):clamp(pour+(awake?dt:-dt)*.9,0,1);
    pot.rotation.z=-smooth(pour)*.24;
    steam.forEach((puff,i)=>{
      const u=((ctx.time*.45+i/6)%1+1)%1,fade=Math.sin(u*Math.PI);
      puff.visible=pour>.5&&!ctx.reducedMotion;
      puff.position.set(1.85+Math.sin(u*7+i)*.18-u*.3,1.7+u*1.9,0);
      puff.scale.setScalar(.13*(.6+fade*.9)*(.4+u));
    });
  });
}

// --- bunting and paint ----------------------------------------------------------------
// One string of pennants sagging between two points (parent-local), cream
// string, cream and bubblegum flags.
function bunting(w,parent,a,b,count,seed){
  const points=[];for(let i=0;i<=16;i++){const t=i/16;points.push(new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-Math.abs(b[0]-a[0])*.09*4*t*(1-t),0));}
  const curve=new THREE.CatmullRomCurve3(points);
  const string=w.mesh(new THREE.TubeGeometry(curve,32,.04,5,false),slot(w,'top'),parent,0,0,0);string.name='Bunting string';string.castShadow=false;
  for(let i=0;i<count;i++){
    const t=(i+.5)/count,p=curve.getPoint(t);
    const flag=w.mesh(new THREE.ConeGeometry(.2,.46,3),(i+seed)%2?slot(w,'accent'):slot(w,'top'),parent,p.x,p.y-.26,0);
    flag.rotation.z=Math.PI;flag.scale.z=.35;flag.name='Pennant';flag.castShadow=false;
  }
}
// Pink paint filling a pit: a flat glossy slab the spikes poke up through.
function paint(w,parent,width){
  const gum=slot(w,'accent');
  w.box(width+.4,.5,2.8,gum,parent,0,.25,0,.2).name='Melted paint';
  for(let i=0;i<Math.max(2,Math.round(width/6));i++){const x=(rand(i*3+width)-.5)*(width-1.5);w.ball(.3,.22,.3,gum,parent,x,.45,.4+rand(i+width)*.3).name='Paint bubble';}
}

export default {
  key:'parade',
  dress(w,s,g){
    if(s.id==='parade-palm'){palmDeck(w,s,g);return true;}
    if(s.kind==='stone'){plaza(w,s,g);return true;}
  },
  deck(w,s,g){
    switch(s.id){
      case 'parade-knee':return knee(w,s,g);
      case 'parade-back':return torso(w,s,g);
      case 'parade-neck':return collar(w,s,g);
      case 'parade-head':return flowerHead(w,s,g);
      case 'parade-caterpillar':return caterpillar(w,s,g);
      case 'parade-fingers':return fist(w,s,g);
      case 'parade-house':return fingertips(w,s,g);
    }
    return null;
  },
  props(section,L){
    const list=[],ground1=deck(L,'parade-ground-1'),ground2=deck(L,'parade-ground-2'),worm=deck(L,'parade-worm'),palm=deck(L,'parade-palm'),exit=deck(L,'parade-exit'),entry=sectionDecks(L,section)[0];
    if(ground1)list.push({key:'boots',x:ground1.x+4.2,y:ground1.y,w:4,z:-1.3,make:(w,parent)=>boots(w,parent,ground1.x+4.2)});
    if(worm){
      const cx=worm.shape.from.x+worm.shape.from.w/2;
      list.push({key:'plinth',x:cx,y:worm.y-worm.shape.from.h,w:3,z:-.4,make:(w,parent)=>plinth(w,parent)});
      list.push({key:'hats',x:cx,y:worm.shape.from.y,w:10,z:0,make:(w,parent)=>hats(w,parent,worm)});
    }
    for(const [i,h] of (L.hazards||[]).filter(h=>h.x>=section.x&&h.x<section.x+section.length).entries())
      list.push({key:'paint-'+i,x:h.x+h.w/2,y:h.y,w:h.w+2,z:0,make:(w,parent)=>paint(w,parent,h.w)});
    if(entry&&ground2)list.push({key:'bunting-a',x:entry.x+9,y:entry.y,w:16,z:-1.7,make(w,parent){
      w.cylinder(.09,5.4,slot(w,'top'),parent,-7,2.7,0).name='Bunting pole';w.cylinder(.09,5.4,slot(w,'top'),parent,7,2.7,0).name='Bunting pole';
      bunting(w,parent,[-7,5.4,0],[7,5.4,0],7,0);
    }});
    if(worm&&palm)list.push({key:'bunting-b',x:(worm.x+2.5+palm.x)/2,y:7.9,w:palm.x-worm.x,z:-1.6,make(w,parent){
      const half=(palm.x-worm.x-2.5)/2;bunting(w,parent,[-half,.3,0],[half+.6,-.6,0],9,1);
    }});
    if(exit)list.push({key:'teapot',x:exit.x+4.2,y:exit.y,w:4,z:-1.4,make:(w,parent)=>teapot(w,parent,section.x+66)});
    return list;
  },
  backdrop(w,L,section,layers){
    // The spiral sun: two ribbons, lemon and bubblegum, wound together over the
    // pit and the ride and turning very slowly. Parallax layers rise with the
    // camera (heightFollow), so it hangs low enough to show from the plaza and
    // climbs into view as the player climbs the giraffe. The placeholder sky's
    // columns and blobs stay as the shared base — nothing else is added, so
    // the distance stays lilac and quiet behind the statues.
    const sky=layers.at(.12),sun=layers.place(sky,section.x+46,6.5,-36);sun.name='Spiral sun';
    for(const [k,mat] of [[0,lemon(w)],[1,bubblegumGlow(w)]]){
      const pts=[];for(let i=0;i<=90;i++){const a=i/90*Math.PI*2*2.4+(k?Math.PI:0),r=.5+i/90*3.6;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
      const ribbon=w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),140,.36,6,false),mat,sun,0,0,0);ribbon.name=k?'Sun ribbon bubblegum':'Sun ribbon lemon';
    }
    register(w,sun,(game,dt,ctx)=>{if(!ctx.reducedMotion)sun.rotation.z-=dt*.05;});
  },
  animate(w,game,dt,section,ctx){
    const list=w.paradeAnim;if(!list?.length)return;
    for(let i=list.length-1;i>=0;i--){
      const e=list[i];
      if(!attached(e.node,w.scene)){list.splice(i,1);continue;}
      e.tick(game,dt,ctx,section);
    }
  }
};
