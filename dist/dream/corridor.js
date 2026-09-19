import * as THREE from '../lib/three.module.js';
import {deck,sectionDecks,slot,rand} from './support.js';
import {clayMaterial,clayShape,sculptClay} from '../clay.js';
import {dreamEyeball,dreamCavern} from '../dream-assets.js';
// Section 4 — The Breathing Corridor, after its painting: a tunnel built
// entirely of thick WAVY stripes of soft clay — vermilion, red, magenta,
// plum — stacked like layered Play-Doh with rounded lips. A heavy striped
// ceiling runs the length of the corridor with big fleshy eyes set into its
// stripes and soft drips hanging from it; the decks are striped slabs whose
// layers undulate along the face; the pits are filled with soft pink and red
// cones; behind everything a pink haze with dim mauve columns and arches.
//
//   · every mass is made of `ribbon`s: a rounded-lip stripe swept along x
//     between two wavy curves, so stacked layers butt without a gap and the
//     boundaries between them undulate the way the painting's strata do
//   · the breathing pillars, the throat and the teeth are stacks of stripes
//     that stretch with the breath (the stack is the breathe pose's `body`)
//   · the eyes are big and permanent: the supplied fleshy eyeball sunk into a
//     socket of rolled lips that cut across it, the ball turning to watch the
//     player and the lips sliding together in a slow blink every 4–8 s — two
//     over the pillar stretch, one over the entry, one in the throat, two by
//     the teeth and the exit
//   · the hazard hook draws cone beds in place of the engine's cream spikes;
//     the kill line is untouched
//   · the molars (presses) are fat vermilion drips that bite; the shared
//     cavern press view is hidden in this section
//
// Coordinates on this side are WORLD: decks are looked up by id, and the
// ceiling profile is drawn between them.

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// --- colours -------------------------------------------------------------------
// The six palette slots give vermilion (terrain), magenta (top), plum (accent)
// and the haze; the painting's deep red and the pink of its cones are the two
// colours they cannot reach, so those two are fixed materials made once per
// world and hooked into the clay relief.
// The socket behind an eye is the painting's deepest red — the pocket the
// ball is pressed into, and the crease under its upper lip.
const RED=0xb42d33,PINK=0xdc7a82,SOCKET_RED=0x5f1418;
function fixed(w,name,hex){
  if(!w.mat)return 'orange';
  if(!w.mat[name]){const m=new THREE.MeshStandardMaterial({color:hex,roughness:.95,metalness:0});m.name=name;clayMaterial(w,m,.075);w.mat[name]=m;}
  return name;
}
const red=w=>fixed(w,'corridorRed',RED),pink=w=>fixed(w,'corridorPink',PINK),socketRed=w=>fixed(w,'corridorSocket',SOCKET_RED);
const mat=(w,name)=>slot(w,name,'orange');
// The stripe cycle, top down: vermilion, red, magenta, plum.
const cycle=w=>[mat(w,'terrain'),red(w),mat(w,'top'),mat(w,'accent')];

// --- the animated registry ---------------------------------------------------
// Eyes and molars are built inside streamed groups and moved per frame by
// animate(); each entry is dropped once its group has left the scene.
const registry=w=>w.corridorAnim??={eyes:[],molars:[]};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const worldPosition=new THREE.Vector3();

// --- ribbons -------------------------------------------------------------------
// The cross-section of a stripe about its centre: a rounded lip at the front
// (top and bottom corners), a slight bulge across the face, square at the
// back — so two stripes stacked never open a gap you can see through. Points
// go round as [dy,dz]; the count never changes, so rings can be joined.
function ring(h,D,lip){
  const r=Math.min(lip,h*.46,D*.4),pts=[],bulge=Math.min(.08,h*.1);
  pts.push([-h/2,-D/2],[-h/2,D/2-r]);
  for(let i=1;i<=6;i++){const a=-Math.PI/2+Math.PI/2*i/6;pts.push([-h/2+r+Math.sin(a)*r,D/2-r+Math.cos(a)*r]);}
  for(let i=1;i<=3;i++){const t=i/4;pts.push([-h/2+r+(h-2*r)*t,D/2+bulge*Math.sin(t*Math.PI)]);}
  for(let i=0;i<=6;i++){const a=Math.PI/2*i/6;pts.push([h/2-r+Math.sin(a)*r,D/2-r+Math.cos(a)*r]);}
  pts.push([h/2,-D/2]);
  return pts;
}
// A stripe of clay swept along x from x0 to x1 between two curves top(x) and
// bottom(x) (world or local, whatever the parent's frame is), `depth` deep
// about z, its ends rounded off over `taper`. Built once, sculpted by
// w.mesh; one draw.
function ribbon(w,parent,{x0,x1,top,bottom,depth=3,z=0,lip=.3,step=.5,material,name='Clay stripe',zAt=null,taper=.4}){
  const span=x1-x0,inner=Math.max(1,Math.round((span-2*taper)/step)),xs=[x0,x0+taper*.22,x0+taper*.58];
  for(let i=0;i<=inner;i++)xs.push(x0+taper+(span-2*taper)*i/inner);
  xs.push(x1-taper*.58,x1-taper*.22,x1);
  const pos=[],idx=[],rings=xs.length;let M=0;
  for(let i=0;i<rings;i++){
    const x=xs[i],t=top(x),b=bottom(x),yc=(t+b)/2,h=Math.max(.06,t-b);
    const e=Math.min(x-x0,x1-x)/taper,scale=e>=1?1:Math.max(.07,Math.sqrt(1-(1-e)*(1-e)));
    const pts=ring(h*scale,depth*scale,lip);M=pts.length;
    const zc=z+(zAt?zAt(x):0);
    for(const [dy,dz] of pts)pos.push(x,yc+dy,zc+dz);
  }
  for(let i=0;i<rings-1;i++)for(let j=0;j<M;j++){
    const a=i*M+j,b=i*M+(j+1)%M,c=(i+1)*M+j,d=(i+1)*M+(j+1)%M;
    idx.push(a,c,b,b,c,d);
  }
  // End caps: a fan to a centre point at each end.
  const c0=rings*M,c1=c0+1;
  pos.push(xs[0],(top(xs[0])+bottom(xs[0]))/2,z+(zAt?zAt(xs[0]):0));
  pos.push(xs[rings-1],(top(xs[rings-1])+bottom(xs[rings-1]))/2,z+(zAt?zAt(xs[rings-1]):0));
  for(let j=0;j<M;j++){idx.push(c0,j,(j+1)%M);idx.push(c1,(rings-1)*M+(j+1)%M,(rings-1)*M+j);}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const m=w.mesh(geo,material,parent,0,0,0);if(m.geometry!==geo)geo.dispose();
  m.name=name;return m;
}

// --- lathes ------------------------------------------------------------------------
// Soft cones and drips: unit-high lathes shared through the clay cache, three
// cone variants and two drip variants for the whole chapter.
const CONE=[[1,0],[1,.1],[.96,.24],[.86,.4],[.72,.56],[.56,.7],[.4,.82],[.25,.91],[.12,.97],[0,1]];
const DRIP=[[1,0],[1,.1],[.95,.25],[.85,.42],[.7,.58],[.52,.72],[.34,.84],[.18,.93],[.06,.99],[0,1]];
function lathe(w,key,profile,bulge){
  return clayShape(w,key,()=>sculptClay(w,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*(1+bulge*Math.sin(y*Math.PI)),y)),16),{amplitude:.05}));
}
function cone(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(lathe(w,'corridor-cone:'+variant,CONE,[0,.07,-.06][variant%3]),material,parent,x,y,z);
  m.scale.set(r,h,r);m.name='Soft cone';return m;
}
function drip(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(lathe(w,'corridor-drip:'+variant,DRIP,[0,.06][variant%2]),material,parent,x,y,z);
  m.scale.set(r,h,r);m.rotation.z=Math.PI;m.name='Ceiling drip';return m;
}

// --- eyes -----------------------------------------------------------------------------
// A big permanent eye SET INTO the stripes, after the painting: the supplied
// fleshy eyeball (dist/assets/dream-eyeball.glb) sunk into a socket whose two
// lips are rolls of clay swept along a lens — red above, vermilion below —
// carried out over the ball so they cut across its top and bottom, converging
// to points at the two corners, with a brow fold over them and a deep-red
// backing behind so the corners look into flesh rather than through the
// ceiling. Each fold sweeps on past the eye across the strata it lies over,
// the way the painting's folds do; the section's own stripes are the layers
// outside that, so the socket only supplies what wraps the ball.
//
// The model's pupil is painted into its colour map, not set on it, so the BALL
// turns to look rather than a disc sliding across it — held to a narrow cone,
// which keeps the pupil inside the opening. animate() aims it and slides the
// two lips together for a slow blink every 4–8 s.
//
// Shares of the eye's radius, so one socket fits the vault's .58–.68 eyes, the
// throat's .62 and the exit deck's .52: the lens opening's half-width, how far
// it opens above and below its centre line (a little under three quarters of
// the ball's height shows, as in the painting), that line's height and its
// rise across the socket, how deep the ball is sunk, and how far each lip
// travels to shut — `open` again, so the two meet on the centre line.
export const SOCKET={half:1.05,open:.72,rise:.06,tilt:.10,sink:.06,shut:.72};
function eye(w,parent,x,y,z,seed,r=.6){
  const g=group(parent,'Corridor eye',x,y,z);
  // The lens: a centre line tilted up across the socket, an opening that
  // closes to nothing at the corners, and a wrap that carries the lips'
  // fronts out over the middle of the ball and lets them fall back at the ends.
  const U=SOCKET.half*r,line=u=>r*SOCKET.rise+SOCKET.tilt*u,
    open=u=>r*SOCKET.open*Math.sqrt(Math.max(0,1-(u/U)**2)),
    wrap=u=>Math.cos(clamp(u/U,-1,1)*Math.PI/2);
  // The socket's back, wider than the opening, buried in the stripes: without
  // it the lens corners look straight through the ceiling. What little of it
  // shows in those corners is the painting's deepest red, the eye's pocket.
  w.ball(U*1.12,r*1.15,r*.45,socketRed(w),g,0,line(0),-r*.75).name='Eye socket';
  // The ball, sunk behind the lips. Without the model the section's own
  // sculpted ball stands in, in the same socket, its pupil a disc on the gaze.
  let gaze;
  if(w.dreamAssets?.eyeball){
    const ball=dreamEyeball(w,g,r);ball.root.position.set(0,line(0),-r*SOCKET.sink);gaze=ball.gaze;
  }else{
    gaze=group(g,'Eyeball gaze',0,line(0),-r*SOCKET.sink);
    w.ball(r,r*.94,r*.72,'cream',gaze,0,0,0).name='Eyeball';
    w.ball(r*.4,r*.4,r*.16,'dark',gaze,0,0,r*.66).name='Pupil';
  }
  // The two lips, each in its own group so the blink can slide it.
  // A lip does not stop at the socket: past the corners the opening has closed
  // to nothing, so the fold runs on as a plain band across the stripes it lies
  // over, sweeping further to the right than the left, and only tapers away
  // well clear of the eye. Ending it at the corner instead would leave its cut
  // face out in the open, which is the one thing the painting never shows.
  const lip=(name,material,{top,bottom,base,amp,depth,thickness})=>{
    const h=group(g,name,0,0,0);
    ribbon(w,h,{x0:-r*2.7,x1:r*3.0,top,bottom,depth,lip:thickness,step:r*.34,taper:r*1.1,
      material,name:'Eye lid',zAt:u=>r*(base+amp*wrap(u))});
    return h;
  };
  // A lip's band has to be deeper than it travels plus what it has left to
  // cover, or sliding it over the ball would walk its far edge off the ball's
  // crown and show a sliver of sclera above a shut eye. Shut, the upper lip
  // reaches line + open + BAND - shut, which has to clear the ball's top at
  // line + r; BAND at 1.12r leaves a tenth of the radius in hand either way.
  const BAND=1.12;
  const lower=lip('Eye lid lower',mat(w,'terrain'),{top:u=>line(u)-open(u),bottom:u=>line(u)-open(u)-r*BAND,
    base:.28,amp:.30,depth:r*1.10,thickness:r*.30});
  const upper=lip('Eye lid upper',red(w),{top:u=>line(u)+open(u)+r*BAND,bottom:u=>line(u)+open(u),
    base:.30,amp:.34,depth:r*1.15,thickness:r*.34});
  // The brow: one more fold butting onto the upper lip, set back and sweeping
  // on past the socket, so the eye reads as part of a stack and not stuck on.
  ribbon(w,g,{x0:-r*3.1,x1:r*3.5,top:u=>line(u)+open(u)+r*(BAND+.95),bottom:u=>line(u)+open(u)+r*BAND,
    depth:r,lip:r*.30,step:r*.44,taper:r*1.3,material:mat(w,'top'),name:'Eye brow',zAt:u=>r*(.04+.12*wrap(u))});
  registry(w).eyes.push({group:g,gaze,upper,lower,r,period:4.5+rand(seed)*3.5,phase:rand(seed+9)*5});
  return g;
}
// How far off straight ahead a ball is turned, across and up. A narrower cone
// than the garden's eyes turn through (.6/.45): the pupil is painted on, so
// turning the ball turns everything painted on it — including the dark cap the
// bake mirrored onto the ball's back, which needs 68° of turn to come round to
// the silhouette. tests/dream-models.mjs holds these against that figure.
export const GAZE={x:.35,y:.26};
const BLINK=.34,FORWARD=new THREE.Vector3(0,0,1),direction=new THREE.Vector3(),turn=new THREE.Quaternion();
function animateEyes(w,game,dt,ctx){
  const list=registry(w).eyes;if(!list.length)return;
  const p=game.player,t=ctx.time,rate=1-Math.exp(-dt*9);
  for(let i=list.length-1;i>=0;i--){
    const e=list[i];
    if(!attached(e.group,w.scene)){list.splice(i,1);continue;}
    e.group.getWorldPosition(worldPosition);
    const dx=ctx.playerX-worldPosition.x,dy=(p.y+.9)-worldPosition.y;
    const still=ctx.reducedMotion;
    if(still)direction.set(0,0,1);
    else direction.set(clamp(dx/9,-GAZE.x,GAZE.x),clamp(dy/7,-GAZE.y,GAZE.y),1).normalize();
    e.gaze.quaternion.slerp(turn.setFromUnitVectors(FORWARD,direction),still?1:rate);
    const u=(((t+e.phase)%e.period)+e.period)%e.period/BLINK,k=!still&&u<1?Math.sin(u*Math.PI):0;
    // The lips slide together across the ball and bulge forward as they meet.
    e.upper.position.y=-e.r*SOCKET.shut*k;e.lower.position.y=e.r*SOCKET.shut*k;
    e.upper.position.z=e.lower.position.z=e.r*.06*k;
  }
}

// --- profiles -------------------------------------------------------------------------
// A smooth height over x through keypoints [[x,y],…] (cosine between them,
// flat beyond the ends).
function profile(points){
  const pts=[...points].sort((a,b)=>a[0]-b[0]);
  return x=>{
    if(x<=pts[0][0])return pts[0][1];
    for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){
      const [x0,y0]=pts[i-1],[x1,y1]=pts[i],t=(x-x0)/Math.max(1e-6,x1-x0);
      return y0+(y1-y0)*(.5-.5*Math.cos(t*Math.PI));
    }
    return pts.at(-1)[1];
  };
}
// The corridor's decks by id and the ceiling's underside between them: as low
// as the play allows — down to 4.4 at the two mouths, up over the pillars'
// beads, meeting the throat's top at 7 and clearing the molars over floor-2.
// The mass sits behind the walk line, so a full jump's head may overlap it
// in the picture without ever meeting it.
//
// Over the windpipe it climbs with the ribs and levels off at 11 — the
// squeeze's top — so that ceiling reads as a fold of this one coming down
// rather than a block hung in the air, then swoops shut over the exit the way
// it opens at the entry.
function layout(L){
  const ids=['entry','pillar-1','pillar-2','pillar-3','floor-1','throat','plug','floor-2','tooth-1','tooth-2',
    'floor-3','rib-1','rib-2','rib-3','rib-4','shelf','squeeze','exit'];
  const d={};for(const id of ids)if(!(d[id]=deck(L,'corridor-'+id)))return null;
  const right=s=>s.x+s.w;
  const under=profile([
    [d.entry.x-1.5,4.3],[d.entry.x+4,4.5],[right(d.entry),4.8],
    [d['pillar-1'].x+1,5.5],[d['pillar-2'].x-.6,6.15],[right(d['pillar-2'])+.6,6.15],[d['pillar-3'].x+1.2,5.4],
    [d['floor-1'].x+2,4.9],[d['floor-1'].x+5.5,5],[right(d['floor-1']),6.3],[d.throat.x,7.05],[right(d.throat),7.05],
    [d['floor-2'].x,6.55],[right(d['floor-2']),6.55],[d['tooth-1'].x,6.45],[right(d['tooth-2']),6.45],
    [d['floor-3'].x,6.5],[right(d['floor-3']),7.2],
    [d['rib-1'].x+1.1,8.2],[d['rib-2'].x+1.1,9.2],[d['rib-3'].x+1.1,10.2],[d['rib-4'].x+1.1,10.9],
    [d.squeeze.x,11],[right(d.squeeze),11],[right(d.shelf),9],
    [d.exit.x+2,6.2],[right(d.exit),4.8],[right(d.exit)+1.5,4.5]
  ]);
  return {d,under,left:d.entry.x,right:right(d.exit)};
}

// --- the striped decks ------------------------------------------------------------------
// A stone deck: a flat-topped vermilion cap over six wavy strata — red,
// magenta, plum, vermilion… — running down out of the frame, the layers'
// boundaries undulating along the face and the face itself swelling in and
// out. The exit deck carries one of the painting's low eyes in its face.
function stripedDeck(w,s,g){
  const W=s.w,mats=cycle(w),rows=7,pitch=.8,seed=s.x*.37;
  g.name='Striped deck · '+s.id;
  const edge=k=>k===0?()=>0:x=>-k*pitch+.17*Math.sin(x*1.15+k*1.9+seed)+.05*Math.sin(x*2.7+k);
  for(let k=0;k<rows;k++){
    ribbon(w,g,{x0:-.1,x1:W+.1,top:edge(k),bottom:edge(k+1),depth:k?3.2:3.4,z:k?-.06:0,lip:k?.28:.32,material:mats[k%4],
      name:k?'Deck stripe':'Deck cap',zAt:x=>.07*Math.sin(x*.9+k*2.3+seed)});
  }
  if(s.id==='corridor-exit')eye(w,g,W*.5,-1.6,1.62,5,.52);
  return true;
}
// A floating ledge (none in the route today, but the painting has one): a
// vermilion cap over a magenta stripe with plum drips hanging under it.
function floatingLedge(w,s,g){
  g.position.set(s.x,s.y,0);g.name='Floating ledge · '+s.id;
  const W=s.w,T=mat(w,'terrain'),M=mat(w,'top'),A=mat(w,'accent');
  const mid=x=>-.36+.04*Math.sin(x*2+s.x);
  ribbon(w,g,{x0:-.08,x1:W+.08,top:()=>0,bottom:mid,depth:2.2,lip:.2,step:.4,material:T,name:'Ledge cap',taper:.3});
  ribbon(w,g,{x0:.05,x1:W-.05,top:mid,bottom:x=>-.72+.06*Math.sin(x*2.6+s.x+1),depth:2,z:-.05,lip:.18,step:.4,material:M,name:'Ledge stripe',taper:.3});
  for(let i=0;i<Math.max(2,Math.round(W/1.1));i++){
    const x=.5+rand(i*3+s.x)*(W-1),r=.2+rand(i+s.x)*.14;
    w.ball(r*1.3,r,r,A,g,x,-.74-r*.6,.1).name='Ledge drip';
  }
  return {root:g};
}

// --- the breathing walls ---------------------------------------------------------------
// Pillars, throat and teeth: a stack of wavy stripes as the breathe pose's
// `body` (centred, so scaling it about its middle and parking it at −h/2
// keeps the top at the collider's top and stretches the stripes with the
// breath). A pillar's cap is vermilion; the throat hangs from the ceiling,
// ends in a fat plum underside with drips and carries a big eye.
function breathingWall(w,s,g){
  const h=s.baseH??s.h??4,W=s.w,hanging=s.breathe?.dy===undefined&&h>5;
  g.name='Breathing wall · '+s.id;
  const body=group(g,'Breathing wall body',W/2,-h/2,0);
  const n=Math.max(3,Math.round(h/.78)),pitch=h/n,mats=cycle(w),seed=s.x*.5;
  const edge=k=>k===0?()=>h/2:k===n?()=>-h/2:x=>h/2-k*pitch+.07*Math.sin(x*2.2+k*1.7+seed);
  for(let k=0;k<n;k++){
    const material=hanging&&k===n-1?mat(w,'accent'):mats[(k+(hanging?1:0))%4];
    ribbon(w,body,{x0:-W/2-.04,x1:W/2+.04,top:edge(k),bottom:edge(k+1),depth:2.3,lip:.19,step:.4,material,name:'Wall stripe',taper:.3});
  }
  if(hanging){
    const A=mat(w,'accent');
    for(const [u,r] of [[-.34,.26],[.1,.34],[.38,.22]])w.ball(r*1.4,r*.8,r*1.1,A,body,u*W,-h/2+.02,.35).name='Throat drip';
    eye(w,g,W/2,-2.9,1.32,3,.62);
  }
  const live=s.h??h;body.scale.y=live/h;body.position.y=-live/2;
  return {root:g,dream:{kind:'breathe',body,lids:[],baseH:h}};
}

// --- the molars --------------------------------------------------------------------------
// A press as a fat drip that bites: a vermilion crown with a magenta band
// and a plum tip on a red root that stretches down out of a gum in the
// ceiling as the head descends. The crown follows the press's live y (its
// hurt box is ±.65 about it), squashes on impact and trembles through the
// wind-up, like the cavern press it replaces.
function molar(w,parent,c,ceilingY){
  const g=group(parent,'Molar');
  w.ball(1.3,.55,1.1,red(w),g,0,ceilingY,-.2).name='Gum';
  const root=w.cylinder(.4,1,red(w),g,0,ceilingY,-.05);root.name='Molar root';
  const tooth=group(g,'Molar tooth',0,c.y??ceilingY-1,0);
  drip(w,tooth,0,.72,0,.88,1.45,mat(w,'terrain'),0).name='Molar crown';
  w.ball(.9,.26,.9,mat(w,'top'),tooth,0,.6,0).name='Molar band';
  registry(w).molars.push({group:g,root,tooth,x:c.x,ceiling:ceilingY,squash:1,c:null});
  return g;
}
function animateMolars(w,game,dt){
  const list=registry(w).molars;if(!list.length)return;
  for(let i=list.length-1;i>=0;i--){
    const m=list[i];
    if(!attached(m.group,w.scene)){list.splice(i,1);continue;}
    const crushers=game.level.crushers||[];
    const c=m.c??=crushers.find(c=>Math.abs(c.x-m.x)<.05)??null;if(!c)continue;
    // The shared cavern press (slate and brass) is not this section's look;
    // the molar stands in for it, so its streamed view is kept out of frame.
    const view=w.crusherViews?.[crushers.indexOf(c)];if(view)view.visible=false;
    const top=c.y+.65,len=Math.max(.05,m.ceiling-top);
    m.tooth.position.y=c.y;m.root.scale.y=len;m.root.position.y=top+len/2;
    const target=c.state==='impact'?.86:1;
    m.squash+=(target-m.squash)*(1-Math.exp(-dt*16));
    m.tooth.scale.set(1+(1-m.squash)*.7,m.squash,1+(1-m.squash)*.7);
    m.tooth.rotation.z=c.state==='warning'&&!w.reducedMotion?Math.sin(c.cycleTime*58)*.02*c.warning:0;
  }
}

export default {
  key:'corridor',
  // The cavern walls below are a whole backdrop of their own, so the chapter's
  // placeholder blobs and columns sink away while the player is in here —
  // their mauve masonry read straight through the tunnel before.
  quietBackdrop:true,
  // Stone decks: striped slabs instead of the chapter's rolled slab.
  dress(w,s,g){return stripedDeck(w,s,g);},
  // Breathing walls (pillars, throat, teeth): striped bodies posed by the
  // breathe view; ledges the painting's floating slab; everything else keeps
  // the dream's own look (the violet plug stays violet — it is the puzzle).
  deck(w,s,g){
    if(s.kind==='wall'&&s.breathe)return breathingWall(w,s,g);
    if(s.kind==='ledge'&&!s.shape)return floatingLedge(w,s,g);
    return null;
  },
  // The hazard bands: a plum bed at the kill line over a dark trench floor,
  // filled with soft cones — a front row of pink, red and magenta standing
  // on the bed, a taller paler row behind. Under the plug the cones stay
  // short so the worked plug hides them, and the bed rises to the spread
  // slab's underside, so the cones stand out of the bed straight into the
  // clay and no ring of their feet shows between the two.
  hazard(w,h,g){
    const L=w.currentLevel,plug=L&&deck(L,'corridor-plug'),pit=!!plug&&plug.x>=h.x&&plug.x<h.x+h.w,k=pit?.42:1;
    const bed=pit&&plug.shape?plug.shape.to.y-plug.shape.to.h-h.y+.05:.06;
    const A=mat(w,'accent'),B=mat(w,'bark'),P=pink(w),R=red(w),M=mat(w,'top');
    g.name='Cone bed';
    const seam=x=>-.5+.08*Math.sin(x*1.4+h.x),floor=x=>-1.4+.1*Math.sin(x*1.1+h.x*2);
    ribbon(w,g,{x0:-.25,x1:h.w+.25,top:()=>bed,bottom:seam,depth:2.9,z:-.35,lip:.22,material:A,name:'Cone bed band'});
    ribbon(w,g,{x0:-.15,x1:h.w+.15,top:seam,bottom:floor,depth:2.6,z:-.5,lip:.22,material:B,name:'Trench floor'});
    ribbon(w,g,{x0:-.05,x1:h.w+.05,top:floor,bottom:x=>-2.4+.1*Math.sin(x*.9+h.x),depth:2.4,z:-.6,lip:.22,material:A,name:'Trench floor'});
    const n=Math.max(2,Math.round(h.w/.85));
    for(let i=0;i<n;i++){
      const x=(i+.5)/n*h.w+(rand(i+h.x)-.5)*.4,r=.5+rand(i*3+h.x)*.3,hh=(1.1+rand(i*7+h.x)*1.2)*k;
      cone(w,g,x,.02,-.15+rand(i*5+h.x)*.4,r,hh,[P,R,M][i%3],i);
    }
    const m=Math.max(1,Math.round(h.w/1.3));
    for(let i=0;i<m;i++){
      const x=(i+.5)/m*h.w+(rand(i*11+h.x)-.5)*.7,r=.62+rand(i*13+h.x)*.3,hh=(1.9+rand(i*17+h.x)*1.3)*k;
      cone(w,g,x,-.8,-1.15-rand(i)*.3,r,hh,i%2?P:M,i+1);
    }
    return true;
  },
  // The tunnel itself, streamed by world x: the striped vault with its eyes
  // and drips, and the molars.
  props(section,L){
    const lay=layout(L);if(!lay)return [];
    const {d,under,left,right}=lay,length=right-left,cx=left+length/2,list=[];
    const rgt=s=>s.x+s.w;
    // The vault: six stripes the length of the section, the lowest one's
    // underside on the profile, each boundary wavy so the layers swell and
    // thin; four eyes set into it; ten drips, the fattest at the two mouths.
    list.push({key:'vault',x:cx,w:length+6,y:0,z:-1.5,make(w,parent){
      const g=group(parent,'Corridor vault',-cx,0,0);
      const T=mat(w,'terrain'),R=red(w),M=mat(w,'top'),A=mat(w,'accent'),P=pink(w);
      const mats=[T,R,M,A,R,T],pitch=.92;
      const edge=k=>x=>under(x)+k*pitch+(k?.2:.15)*Math.sin(x*.9+k*2.2)+.06*Math.sin(x*2.4+k*.7);
      for(let k=0;k<6;k++)ribbon(w,g,{x0:left-2.5,x1:right+2.5,top:edge(k+1),bottom:edge(k),depth:3,lip:.32,material:mats[k],name:'Vault stripe',zAt:x=>.08*Math.sin(x*.7+k*1.9)});
      const at=(x,lift,seed,r)=>eye(w,g,x,under(x)+lift,1.72,seed,r);
      at(d.entry.x+4.2,.95,1,.58);
      at(d['pillar-1'].x+1.9,1.05,2,.68);
      at(d['pillar-3'].x-.3,1.05,4,.62);
      at(d['tooth-1'].x+2.1,1.05,6,.62);
      // Three more up the windpipe, the last one right over the squeeze, so
      // the ceiling that shuts on you is the one watching you wait.
      at(d['floor-3'].x+3.4,1,7,.6);
      at(d['rib-2'].x+1.1,1.1,8,.66);
      at(d.squeeze.x+1.7,1.15,9,.7);
      const drips=[[d.entry.x+.4,.8,2.2,R],[d.entry.x+6.6,.5,1.2,T],[d['pillar-2'].x-1.3,.5,1.3,P],[d['pillar-3'].x-1.6,.44,.95,R],
        [d['floor-1'].x+1.2,.6,1.3,T],[d['floor-1'].x+7,.5,1.4,R],[d['floor-2'].x+1.9,.55,1.5,P],[d['tooth-1'].x-.8,.42,1.1,R],
        [d['floor-3'].x+1.1,.5,1.3,R],[d['rib-1'].x+.4,.46,1.1,T],[d['rib-3'].x-.9,.5,1.25,P],[d['rib-4'].x+1.8,.44,1,R],
        [rgt(d.shelf)-.6,.55,1.45,T],
        [d.exit.x+1.2,.52,1.4,T],[rgt(d.exit)+.2,.74,2,R]];
      drips.forEach(([x,r,h,m],i)=>drip(w,g,x,under(x)+.15,.95,r,h,m,i));
    }});
    // The molars: one per press the section brought.
    (L.crushers||[]).filter(c=>c.x>=left&&c.x<right).forEach((c,i)=>list.push({key:'molar-'+i,x:c.x,w:3,y:0,z:0,make(w,parent){molar(w,parent,c,under(c.x)+.25);}}));
    return list;
  },
  // Far scenery: the supplied cavern wall, standing in for the chapter's
  // placeholder columns — the painting's backdrop is a deep organic tunnel
  // receding, not masonry. One slab, on the corridor's middle, lit by the
  // scene and taking its fog, which is what pales it toward the palette's
  // pink.
  //
  // One copy, and it stays inside this section. The first pass laid nine — a
  // near rank of four at ×.45 and a far rank of five at ×.22, overlapping by
  // a third so they would read as one continuous wall. On screen they read as
  // the same shape stamped three deep, and at those slow factors they hung in
  // frame for ±70 units around their places: the Orchard's last stretch and
  // the Colour River's first deck were both played out in front of this
  // crimson wall, not their own skies.
  //
  // A parallax item stands factor·(place − cameraX) from the frame's centre,
  // so a slab W across is out of a frame of half-width `half` once the camera
  // is (half + W/2)/factor from its place. At 44 across and ×.8 that is 40
  // units either side on a 16:9 frame (half 10.3): the corridor is 83 long,
  // so the wall slides in from the right as the player steps in from the
  // Orchard and has left by the left edge before the river's entry deck. It
  // fills the frame only through the middle ~30 units; either side of that
  // the pale sky shows past one edge, which is what reads as a lit tunnel
  // mouth rather than wallpaper. `until` retires it at the section's end for
  // frames wide enough to still hold a sliver of it there.
  backdrop(w,L,section,layers){
    if(!w.dreamAssets?.cavern)return this.placeholderBackdrop(w,L,section,layers);
    const g=layers.place(layers.at(.8),section.x+section.length/2,4.5,-30,{until:section.x+section.length});
    g.name='Cavern wall';
    dreamCavern(w,g,44);
  },
  // The look before the cavern was supplied, kept for a rig that builds the
  // section without the dream models (tests/dream-sections.mjs runs one).
  placeholderBackdrop(w,L,section,layers){
    const near=layers.at(.45),far=layers.at(.22);
    for(let i=0;i<6;i++){
      const x=section.x-12+i*16+rand(i+50)*3,h=13+rand(i+51)*4,g=layers.place(near,x,-9,-30);g.name='Haze column';
      w.box(2.6+rand(i+52)*1,h,2.6,'back2',g,0,h/2,0,1.2);w.ball(1.7,1.2,1.5,'back2',g,0,h,0);
      if(i%2===0){const arch=w.mesh(new THREE.TorusGeometry(3.6,1,8,26,Math.PI),'back2',g,3.6,h-2.8,0);arch.scale.y=1.5;arch.name='Haze arch';}
    }
    for(let i=0;i<6;i++){
      const x=section.x-14+i*24+rand(i+60)*4,g=layers.place(far,x,-8,-52);g.name='Haze mound';
      w.ball(6+rand(i+61)*3,4.5+rand(i+62)*2,4,'back',g,0,0,0);
      if(i%2){const h=17+rand(i+63)*5;w.box(3.2,h,3,'back',g,5.5,h/2-1,-2,1.4);}
    }
  },
  animate(w,game,dt,section,ctx){
    animateEyes(w,game,dt,ctx);
    animateMolars(w,game,dt);
    // The chapter's placeholder side scenery (a pastel mound with two beads in
    // front of every deck, depth-scenery.js) is not this section's look: the
    // striped slabs stand clean, as in the painting.
    if(w.depthViews?.size)for(const s of sectionDecks(game.level,section)){const v=w.depthViews.get(s.id);if(v)v.root.visible=false;}
  }
};
