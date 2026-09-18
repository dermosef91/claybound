import * as THREE from '../lib/three.module.js';
import {deck,slot,rand,fixedMaterial,sectionDecks} from './support.js';
import {createDreamView} from '../dream-views.js';
import {sculptClay,clayShape} from '../clay.js';
import {riverClay,flowTube,tickRiverClay} from './river-clay.js';
// Section 6 — The Colour River. ONE idea: three streams of wet clay, each
// with a verb. Yellow carries (the conveyor ledges ARE the yellow river, with
// its source welling out of the bank and its plunge into the undertow), pink
// throws (the springs are the crests of a pink column rising through the
// yellow), blue sinks (the pads and the raft are blue, the blue lane slides
// under them and arches over the backwards trench). The banks are mint
// aqueducts — open arcades under a lavender frosting cap — and the plain
// ledges are brackets of the same clay, so the streams are carried by
// architecture the way glaze runs over a cake stand (docs/river-look holds the
// reference frames). Beyond the palette the only colours are the three stream
// materials, the pale yellow their bubbles are blown in, and the sky's own
// pinks. The streams move: the yellow river's stripes scroll, every stream's
// surface bulges and streaks along its flow (river-clay.js), and the geyser
// spout rises out of the pool once the clot is pressed.

// The stream materials: the formable clay's material recoloured, glossier and
// flowing (river-clay.js), made once per world and kept in w.mat. Pink is the
// section accent as its own stream rather than the palette slot, so it flows
// like the other two — and, on a still shape, it is the glossy pink of every
// blob stuck to the banks. Cream is the yellow's pale foam: bubbles and the
// drops that float beside the ribbon.
const YELLOW=0xffd826,BLUE=0x2d47d4,PINK=0xff62b0,CREAM=0xfff0a6;
const yellow=w=>riverClay(w,'riverYellow',YELLOW),blue=w=>riverClay(w,'riverBlue',BLUE),pink=w=>riverClay(w,'riverPink',PINK),cream=w=>riverClay(w,'riverCream',CREAM);
// Matte clay in a colour the palette slots cannot reach, faintly self-lit so
// it stays luminous through the fog: the sky's hills, clouds and the lollipop.
function glow(w,name,hex,intensity=0){
  const n=fixedMaterial(w,name,hex,{roughness:.96,depth:.03}),m=w.mat?.[n];
  if(m?.emissive&&intensity){m.emissive.setHex(hex);m.emissiveIntensity=intensity;}
  return n;
}
// How fast each stream's surface travels, in units per second. Yellow keeps
// pace with its conveyor ledges (5 and -4.5 in the route) so the pour and the
// stripes agree; blue slides heavily; pink is thrown. A plunge or a fall is
// handed a higher speed where it is built.
const SPEED={riverYellow:4.5,riverBlue:2.4,riverPink:3};
const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};

// A stream: one tube along a smoothed curve through `points` ([x,y,z]),
// authored source to destination so the flow runs the way the points do.
// Sixteen sides and eight rings a unit, because a gloss highlight facets on
// fewer and the wave bends the rope by a fifth of its radius; sculpted at a
// third of the usual amplitude, since a pour is smooth where kneaded clay is
// lumpy (w.mesh sees the sculpt and skips its own). `squash` and `spread`
// flatten the section into an ellipse (a river lying on something is wider
// than it is tall); the path is pre-divided so it still lands where the
// points say. `hold` keeps the crest still for a river the player walks on.
function stream(w,parent,points,r,mat,name,{speed=SPEED[mat]??3,hold=0,squash=1,spread=1}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1]/squash,(p[2]??0)/spread)),false,'catmullrom',.5),len=curve.getLength();
  const n=Math.min(320,Math.max(16,Math.round(len*8)));
  const base=new THREE.TubeGeometry(curve,n,r,16,false);
  if(squash!==1||spread!==1)base.applyMatrix4(new THREE.Matrix4().makeScale(1,squash,spread));
  const g=sculptClay(w,base,{amplitude:.02});
  if(g!==base)base.dispose();
  const m=w.mesh(flowTube(g,len,speed,hold),mat,parent);
  m.name=name;return m;
}
const tube=(w,parent,points,r,mat,name,speed)=>stream(w,parent,points,r,mat,name,speed===undefined?{}:{speed});
// A river lying along a deck, in the deck's own coordinates (x 0..width, the
// walk line at `top`): an ellipse in section, its crest on the walk line and
// held still there, curling down past both ends so the tube's open mouths
// face the ground. The downstream end hangs the full `hang`, the pour
// spilling off; the upstream end, where a source lands on it, only dips.
// `dir` is the flow, +1 left to right.
function deckRiver(w,parent,width,mat,name,{speed,dir=1,top=0,r=.9,squash=.62,spread=1.4,hang=1.7,reach=1}){
  const c=top-r*squash,sign=dir<0?-1:1,[x0,x1]=sign>0?[0,width]:[width,0];
  // A curl leaving the deck at x, outward by `sign`, down by h over rch.
  const curl=(x,out,h,rch)=>[[x+out*rch*.6,c-h*.32],[x+out*rch,c-h]];
  const pts=[...curl(x0,-sign,hang*.4,reach*.6).reverse(),[x0+sign*.1,c-.02],[width/2,c],[x1-sign*.1,c-.02],...curl(x1,sign,hang,reach)];
  return stream(w,parent,pts.map(([x,y])=>[x,y,0]),r,mat,name,{speed,hold:1,squash,spread});
}
// A flowing sheet over a slab: a wide, low ellipse whose centre sits on the
// slab's top (or, set forward in z, on its face), so its upper half heaves
// out of the flat clay. Hazard water, so nothing holds its crest.
function sheet(w,parent,x0,x1,y,mat,name,speed,{dir=1,z=0,spread=3.2}={}){
  const pts=[[x0,y,z],[(x0+x1)/2,y,z],[x1,y,z]];if(dir<0)pts.reverse();
  return stream(w,parent,pts,.45,mat,name,{speed,squash:.7,spread});
}
// Bubbles: small glossy balls that bob on the spot. Registered for animate();
// entries whose mesh has streamed out are dropped there.
function bubble(w,parent,x,y,z,r,mat,seed){
  const m=w.ball(r,r*1.12,r,mat,parent,x,y,z);m.name='Stream bubble';
  (w.riverBubbles??=[]).push({mesh:m,y,phase:rand(seed)*6.28,rate:1.3+rand(seed+1)*.8});
  return m;
}
const hide=(root,...names)=>{for(const n of names){const o=root.getObjectByName(n);if(o)o.visible=false;}};

// --- decks -----------------------------------------------------------------------
// A yellow river ledge IS the river: the dream's conveyor deck keeps its
// simulation and its cream stripes (shrunk to bits of foam riding the flow),
// but the plank is hidden and a fat yellow river lies along the walk line in
// its place, flowing the way the conveyor carries and spilling off both ends.
function yellowDeck(w,s,g){
  const view=createDreamView(w,s,g),Y=yellow(w),C=cream(w);
  hide(g,'River deck top','River deck body');
  for(const stripe of view.dream?.stripes||[]){stripe.scale.y=.7;stripe.scale.z=.42;}
  deckRiver(w,g,s.w,Y,'Yellow river',{speed:Math.abs(s.conveyor)*.9,dir:Math.sign(s.conveyor)||1});
  // The glaze runs over the front lip in drops, and foam sits on the far bank
  // of the flow, behind the walk line.
  for(let i=0;i<Math.max(3,Math.round(s.w/2.2));i++){
    const x=.8+rand(i*3+s.x)*(s.w-1.6),h=.5+rand(i*7+s.x)*.55,r=.3+rand(i*5+s.x)*.14;
    drop(w,g,x,-.5,1.05+rand(i+s.x)*.15,r,h,Y,i);
  }
  for(let i=0;i<2;i++){const x=1.4+rand(i*13+s.x)*(s.w-2.8),r=.26+rand(i*17+s.x)*.1;w.ball(r,r*.8,r,C,g,x,.02,-1.05).name='Yellow foam';}
  return view;
}
// A blue pad or raft: the dream's sinking raft keeps its floats and the
// ripple rings that spread as it goes under, but its deck and hull give way
// to a short blue river over a saucer hull that sits half sunk.
function blueDeck(w,s,g){
  const view=createDreamView(w,s,g),B=blue(w);
  hide(g,'Raft deck','Raft hull');
  deckRiver(w,g,s.w,B,'Blue pad river',{speed:1.2,r:.55,squash:.65,spread:1.45,hang:.7,reach:.5});
  const r=s.w*.5;
  const saucer=w.mesh(new THREE.LatheGeometry([[0,-1.05],[r*.3,-1],[r*.62,-.78],[r*.86,-.5],[r*.98,-.3]].map(([a,b])=>new THREE.Vector2(a,b)),22),B,g,s.w/2,0,0);
  saucer.scale.z=.62;saucer.name='Blue saucer';
  return view;
}
// A pink spring: the crest of the pink column — a fat glossy bulb on a short
// pink stem with a cream ring. The world's spring animator squashes the whole
// root on a bounce, which suits a blob better than a pad.
function pinkSpring(w,s,g){
  g.position.set(s.x,s.y,0);g.name='Pink crest · '+s.id;
  const A=pink(w),cx=s.w/2;
  w.cylinder(.5,1.6,A,g,cx,-1,-.05).name='Pink stem';
  w.ball(s.w*.6,.34,.9,A,g,cx,-.16,0).name='Pink crest pad';
  // Bulbs welling up under the dish, as a thick pour stacks on itself.
  w.ball(.42,.36,.42,A,g,cx-.5,-.62,.3).name='Pink bulb';
  w.ball(.36,.32,.36,A,g,cx+.58,-.72,-.22).name='Pink bulb';
  w.ball(.3,.28,.3,A,g,cx-.05,-1.25,.5).name='Pink bulb';
  const ring=w.mesh(new THREE.TorusGeometry(s.w*.4,.05,7,26),cream(w),g,cx,-.02,0);ring.rotation.x=Math.PI/2;ring.name='Crest ring';
  return {root:g};
}

// --- the banks -------------------------------------------------------------------
// A drop of glaze or frosting that has run over a lip: wide where it hangs,
// a neck, and a bulb at the bottom (support.js's drip is a taper, which on
// a glossy stream read as a spike). Unit-high, hung from (x, y) by `h`.
const DROP=[[.95,0],[.8,.16],[.56,.36],[.42,.55],[.47,.72],[.4,.88],[.22,.97],[0,1]];
const dropShape=(w,variant)=>clayShape(w,'river-drop:'+(variant%2),()=>sculptClay(w,new THREE.LatheGeometry(DROP.map(([r,y])=>new THREE.Vector2(r*(1+[0,.08][variant%2]*Math.sin(y*Math.PI)),y)),14),{amplitude:.05}));
function drop(w,parent,x,y,z,r,h,material,variant=0){
  const m=w.mesh(dropShape(w,variant),material,parent,x,y,z);m.scale.set(r,h,r);m.rotation.z=Math.PI;m.name='Drop';return m;
}
// An arcade: piers with round arch heads between them, open to the sky, from
// yTop down `h`, in deck-local x from x0 to x1. Every bank and the channel
// under the yellow river stand on one, so the section reads as one aqueduct
// the streams are carried along. The arch heads are half-tori sculpted once
// per span and shared.
const arch=(w,r,tube)=>clayShape(w,`river-arch:${r.toFixed(2)}:${tube.toFixed(2)}`,()=>sculptClay(w,new THREE.TorusGeometry(r,tube,8,18,Math.PI),{amplitude:.04}));
function arcade(w,g,x0,x1,yTop,h,z,seed=0,depth=3){
  const width=x1-x0,n=Math.max(1,Math.round(width/3.4)),span=width/n,pierW=Math.min(1.1,Math.max(.6,span*.3)),tube=pierW*.5;
  const r=Math.max(.3,(span-pierW)/2);
  for(let i=0;i<=n;i++){
    const x=Math.min(x1-pierW/2,Math.max(x0+pierW/2,x0+i*span));
    w.box(pierW,h,depth,(i+seed)%3===1?'terrain2':'terrain',g,x,yTop-h/2,z-.1,.28).name='Pier';
  }
  for(let i=0;i<n;i++){
    const m=w.mesh(arch(w,r,tube),'terrain',g,x0+(i+.5)*span,yTop-r-tube,z-.1);m.scale.z=depth/(2*tube);m.name='Arch head';
  }
}
// A bank: a lavender frosting cap with beads and drips over a mint beam, the
// arcade beneath, and glossy pink blobs stuck where a hand pressed them.
function aqueduct(w,s,g){
  const width=s.w,A=pink(w);
  w.box(width+.14,.5,3.6,'top',g,width/2,-.2,0,.22).name='Frosting cap';
  for(const x of [.25,width-.25]){w.ball(.6,.44,1.72,'top',g,x,-.04,.12);w.ball(.4,.3,1.3,'top',g,x,.3,.32);}
  for(let i=0;i<Math.ceil(width/.93);i++){const x=.25+i*.93;if(x>width-.15)continue;w.ball(.51,.17+rand(i+s.x)*.09,.15,'top',g,x,-.34,1.68).name='Cap bead';}
  for(let i=0;i<Math.max(2,Math.round(width/2.2));i++){
    const x=.5+rand(i*3+s.x)*(width-1),h=.45+rand(i*7+s.x)*.5,r=.3+rand(i*5+s.x)*.14;
    drop(w,g,x,-.4,1.62,r,h,'top',i);
  }
  w.box(width+.04,1,3.3,'terrain',g,width/2,-.95,-.02,.34).name='Aqueduct beam';
  arcade(w,g,0,width,-1.4,9,0,Math.round(s.x));
  for(let i=0;i<Math.max(2,Math.round(width/2.6));i++){
    const x=.6+rand(i*11+s.x)*(width-1.2),r=.34+rand(i*19+s.x)*.22;
    w.ball(r,r*.82,r*.9,A,g,x,.05+r*.3,1.45-r*.3).name='Pink blob';
  }
  w.ball(.3,.26,.3,A,g,.9+rand(s.x)*(width-1.8),-2.6,1.55).name='Pink blob';
}
// A plain ledge: a bracket of the same clay — frosting over a mint body, and
// under it a single arch on two short legs, a piece of aqueduct the route
// left standing — sized to the deck the route gives it.
function bracket(w,s,g){
  g.position.set(s.x,s.y,0);g.name='River bracket · '+s.id;
  const W=s.w,A=pink(w);
  w.box(W+.1,.44,2.6,'top',g,W/2,-.2,0,.16).name='Bracket frosting';
  for(let i=0;i<Math.ceil(W/.9);i++){const x=.4+i*.9;if(x>W-.3)continue;w.ball(.42,.15,.14,'top',g,x,-.34,1.2).name='Cap bead';}
  for(let i=0;i<2;i++)drop(w,g,.6+rand(i*3+s.x)*(W-1.2),-.38,1.16,.24,.35+rand(i+s.x)*.3,'top',i);
  w.box(W-.1,.9,2.3,'terrain',g,W/2,-.85,0,.3).name='Bracket body';
  arcade(w,g,.15,W-.15,-1.25,2.4,0,Math.round(s.x),2.2);
  w.ball(.4,.34,.38,A,g,W-.4,.05,.85).name='Pink blob';
  w.ball(.28,.24,.28,A,g,.55,-1.05,1.2).name='Pink blob';
  return {root:g};
}

export default {
  key:'river',
  // The section brings its own sky (backdrop below), so the shared blobs,
  // columns and rings sink while the player is here; and its distance is
  // drawn out of focus, a small set photographed close.
  quietBackdrop:true,
  softBackdrop:2.2,
  deck(w,s,g){
    if(s.conveyor)return yellowDeck(w,s,g);
    if(s.kind==='sink')return blueDeck(w,s,g);
    if(s.kind==='spring')return pinkSpring(w,s,g);
    if(s.kind==='ledge')return bracket(w,s,g);
    return null;
  },
  // The banks: aqueducts in place of the chapter's rolled slab.
  dress(w,s,g){aqueduct(w,s,g);return true;},

  // The deep water drawn by the props below is the whole picture of a hazard
  // here: the engine's cream spike rows would poke through its surface, so
  // the section keeps them out. The kill line is still the band's own.
  hazard(){return true;},

  // The streams themselves, streamed in by WORLD x. Every point is taken from
  // a deck by id, so the same list serves the full chapter and a solo build.
  props(section,L){
    const E=deck(L,'river-entry'),Y1=deck(L,'river-yellow-1'),S1=deck(L,'river-pink-1'),B1=deck(L,'river-bank-1');
    const P1=deck(L,'river-blue-1'),P2=deck(L,'river-blue-2'),P3=deck(L,'river-blue-3'),Y2=deck(L,'river-yellow-2'),SL=deck(L,'river-sill');
    const S2=deck(L,'river-pink-2'),PB=deck(L,'river-pool-bank'),R=deck(L,'river-raft'),FB=deck(L,'river-far-bank'),B4=deck(L,'river-blue-4'),EX=deck(L,'river-exit');
    if(![E,Y1,S1,B1,P1,P2,P3,Y2,SL,S2,PB,R,FB,B4,EX].every(Boolean))return [];
    const list=[];
    const prop=(key,left,right,make)=>list.push({key,x:(left+right)/2,w:right-left+2,y:0,z:0,make});
    // Local coordinates for a group parked at the prop's centre.
    const local=parent=>(x,y,z=-1.15)=>[x-parent.position.x,y-parent.position.y,z];

    // 1. The yellow source wells out of the entry bank and runs the length of
    //    the ledge as the river's upper layer, behind the crest; at the
    //    ledge's end it plunges, and the pink column rises through the plunge
    //    to its crest — the first spring. One tube, so the beads travel from
    //    the bank to the plunge unbroken.
    prop('stream-a',E.x+5,S1.x+2.2,(w,parent)=>{
      const P=local(parent),Y=yellow(w),A=pink(w);
      const g=group(parent,'Yellow source and plunge'),end=Y1.x+Y1.w;
      // The plunge crosses the pink column just above the deep's surface,
      // so the pierce is seen, then dives.
      tube(w,g,[P(E.x+5.2,-1.1,-1.45),P(E.x+6.3,.05,-1.35),P(E.x+7.6,.3,-1.25),P(Y1.x+1.4,.14,-1.15),P(Y1.x+3,.1,-1.12),P((Y1.x+end)/2,.14,-1.12),
        P(end-1.2,.1,-1.12),P(end+.4,-.04,-1.1),P(S1.x+.9,-.5,-1.1),P(S1.x+1.55,-.98,-1.1),P(S1.x+1.75,-1.7,-1.1),P(S1.x+1.6,-3.6,-1.1)],.5,Y,'Yellow run',5);
      const column=group(parent,'Pink column');
      tube(w,column,[P(S1.x+.9,-4,-1.05),P(S1.x+.82,-2.3,-1.05),P(S1.x+.98,-.9,-1.05),P(S1.x+.9,.5,-1.02)],.56,A,'Pink column');
      bubble(w,g,...P(Y1.x+3.4,.55,-1.3),.2,Y,1);bubble(w,g,...P(end+1.5,-1.2,-.7),.17,Y,2);bubble(w,column,...P(S1.x+1.6,-1.8,-.7),.21,A,3);
    });

    // 2. The blue lane slides heavily under the three pads, then arches over
    //    the backwards trench and vanishes into the cliff.
    prop('stream-b',B1.x+2,SL.x+2,(w,parent)=>{
      const P=local(parent),B=blue(w);
      const g=group(parent,'Blue lane');
      tube(w,g,[P(B1.x+B1.w-1.4,B1.y-.32,-1.4),P(B1.x+B1.w+.5,B1.y-.5,-1.35),P(P1.x+1.5,P1.y-1.05,-1.3),P(P2.x+1.5,P2.y-1.15,-1.3),P(P3.x+1.5,P3.y-1.05,-1.3),
        P(Y2.x-.6,Y2.y+.5,-1.45),P(Y2.x+1.2,Y2.y+3.4,-1.55),P(Y2.x+2.9,Y2.y+4.8,-1.6),P(Y2.x+4.6,Y2.y+3.8,-1.55),P(Y2.x+5.7,Y2.y+1.5,-1.5),P(SL.x+1.3,Y2.y-.3,-1.9)],.5,B,'Blue lane');
      bubble(w,g,...P(P1.x+P1.w+.7,P1.y-.4,-.75),.2,B,4);bubble(w,g,...P(P3.x-.7,P3.y-.35,-.7),.17,B,5);bubble(w,g,...P(Y2.x+2.9,Y2.y+5.6,-1),.22,B,6);
    });

    // 3. The cliff the backwards river pours out of (a lavender-capped mint
    //    block behind the sill with a pipe mouth), the pour onto yellow-2 and
    //    its fall off the far end, the vertical yellow ribbon the second
    //    spring fires you up, and the blue loop threading the ribbon.
    prop('stream-c',Y2.x-1.5,S2.x+3,(w,parent)=>{
      const P=local(parent),Y=yellow(w),B=blue(w),T=slot(w,'terrain','orange'),top=slot(w,'top','cream');
      const cliff=group(parent,'River cliff');
      const cw=SL.w+.9,cx=SL.x+SL.w/2+.1;
      // Standing in the deep (its foot at the goo) and capped at 8.8 local.
      w.box(cw,10,1.7,T,cliff,...P(cx,SL.y-1.4,-2.05),.6);
      w.box(cw+.25,.55,1.9,top,cliff,...P(cx,SL.y+3.75,-2.05),.24);
      w.ball(.9,.5,.7,top,cliff,...P(cx-.6,SL.y+4.15,-1.9));
      const mouth=w.cylinder(.78,.7,top,cliff,...P(SL.x+.35,Y2.y+.95,-1.3));mouth.rotation.z=Math.PI/2;mouth.name='Pipe mouth';
      const pour=group(parent,'Yellow pour');
      tube(w,pour,[P(SL.x+.5,Y2.y+.92,-1.3),P(SL.x-.5,Y2.y+.7,-1.25),P(Y2.x+Y2.w-1.3,Y2.y+.3,-1.15),P(Y2.x+Y2.w-2.6,Y2.y+.14,-1.12)],.5,Y,'Yellow pour');
      tube(w,pour,[P(Y2.x+1.1,Y2.y+.12,-1.12),P(Y2.x-.1,Y2.y-.05,-1.12),P(Y2.x-.85,Y2.y-.9,-1.12),P(Y2.x-1,Y2.y-2.2,-1.12),P(Y2.x-.9,Y2.y-3.3,-1.12)],.46,Y,'Yellow fall',6);
      const ribbon=group(parent,'Yellow ribbon');
      const rx=S2.x+S2.w/2;
      tube(w,ribbon,[P(rx,S2.y-6.4,-1.35),P(rx-.15,S2.y-3,-1.35),P(rx+.2,S2.y+1,-1.35),P(rx-.1,S2.y+5,-1.35),P(rx+.1,S2.y+8.8,-1.35)],.46,Y,'Yellow ribbon');
      const loop=w.mesh(new THREE.TorusGeometry(1.45,.32,9,40),B,ribbon,...P(rx,S2.y+7.1,-1.35));loop.rotation.y=.35;loop.name='Blue loop';
      // Mint clay has run over the top of the loop and hangs off it.
      w.ball(.62,.34,.55,T,ribbon,...P(rx-.2,S2.y+8.95,-1.3)).name='Loop frosting';
      drop(w,ribbon,...P(rx-.8,S2.y+8.7,-1.02),.28,.75,T,0);drop(w,ribbon,...P(rx+.6,S2.y+8.75,-1.05),.24,.5,T,1);
      // Foam floats beside the ribbon: pale drops the pour has thrown up.
      const C=cream(w);
      bubble(w,pour,...P(Y2.x+Y2.w-.3,Y2.y+.9,-.7),.18,C,7);bubble(w,ribbon,...P(rx+.95,S2.y+3.4,-.85),.26,C,8);bubble(w,ribbon,...P(rx-.95,S2.y+5.9,-.8),.22,C,9);
      bubble(w,ribbon,...P(rx+1.15,S2.y+7.4,-.9),.3,C,12);bubble(w,ribbon,...P(rx-1.3,S2.y+8.1,-.95),.24,C,13);
    });

    // 4. The pool: a blue surface over the bed, the pink spout that bursts up
    //    once the clot is pressed (a bud until then), and the crest riding it.
    prop('pool',PB.x+PB.w-.5,FB.x+.5,(w,parent)=>{
      const P=local(parent),B=blue(w),A=pink(w);
      const left=PB.x+PB.w,right=FB.x,surface=PB.y-4;
      const pool=group(parent,'Blue pool');
      w.box(right-left+.3,1.6,3,B,pool,...P((left+right)/2,surface-.8,0),.3);
      sheet(w,pool,P(left-.15,0)[0],P(right+.15,0)[0],P(0,surface)[1],B,'Pool flow',.7);
      w.ball(.8,.25,.7,B,pool,...P(left+1.2,surface+.05,.4));w.ball(.55,.2,.5,B,pool,...P(right-1.1,surface+.05,-.3));
      const gx=R.x+R.w-.5;
      const geyser=group(parent,'Geyser',...P(gx,surface,-1.2));
      const spout=w.cylinder(.5,1,A,geyser,0,.5,0);spout.name='Geyser spout';
      const crest=group(geyser,'Geyser crest',0,1,0);
      w.ball(.78,.5,.72,A,crest,0,.05,0);w.ball(.42,.36,.4,A,crest,-.7,-.15,.2);w.ball(.36,.3,.34,A,crest,.72,-.2,-.15);
      w.ball(.2,.2,.14,'cream',crest,.25,.3,.5);
      w.riverGeyser={spout,crest,height:.35,bubbles:[]};
      for(let i=0;i<3;i++){const m=w.ball(.16,.18,.16,A,geyser,(i-1)*.55,.5,.45);m.name='Spout bubble';m.visible=false;w.riverGeyser.bubbles.push(m);}
      spout.scale.y=.35;spout.position.y=.175;crest.position.y=.35;
    });

    // 5. The blue elevator's fall: the blue river pours down behind the last
    //    pad and away under the exit bank.
    prop('stream-d',B4.x-.5,EX.x+2.5,(w,parent)=>{
      const P=local(parent),B=blue(w);
      const g=group(parent,'Blue fall');
      const bx=B4.x+B4.w/2;
      tube(w,g,[P(bx-.2,B4.y-.4,-1.35),P(bx+.1,B4.y-2.2,-1.35),P(bx-.15,EX.y-.1,-1.35),P(bx+1,EX.y-.95,-1.35),P(EX.x+1.8,EX.y-1.1,-1.35)],.5,B,'Blue fall',5);
      bubble(w,g,...P(bx+.6,B4.y-1.6,-.75),.18,B,10);bubble(w,g,...P(bx-.55,EX.y+.9,-.75),.15,B,11);
    });

    // 6. The deep: every hazard band in the section is drawn as water with a
    //    flowing sheet heaving on top; render-only, the kill line is the
    //    band's own. Under a yellow ledge the undertow is the yellow glaze
    //    running in the channel of an aqueduct — a mint beam with the arcade
    //    below, open to the sky, the glaze dripping over its lip — so the
    //    river and its bank are one structure. Elsewhere it is the blue that
    //    sinks: a slab down past the bottom of the view, so the blue river's
    //    surface and the trench read as one deep water. The pool has its
    //    surface from the geyser prop.
    for(const [i,h] of L.hazards.entries()){
      if(h.x<section.x-1||h.x>section.x+section.length||h.x>=PB.x+PB.w-1)continue;
      const ledge=L.platforms.find(p=>p.conveyor&&p.x<h.x+h.w&&p.x+p.w>h.x&&p.y>h.y);
      prop('deep-'+i,h.x,h.x+h.w,(w,parent)=>{
        const P=local(parent),g=group(parent,ledge?'Yellow channel':'Blue deep'),M=ledge?yellow(w):blue(w);
        const dir=ledge?Math.sign(ledge.conveyor)||1:1,top=ledge?h.y+.3:h.y+1,x0=P(h.x-.25,0)[0],x1=P(h.x+h.w+.25,0)[0];
        const layer=(y,z,speed,spread)=>sheet(w,g,x0,x1,P(0,y)[1],M,'Deep flow',speed,{dir,z,spread});
        if(ledge){
          const T=slot(w,'terrain','orange'),cx=P(h.x+h.w/2,0)[0],yb=P(0,top)[1];
          w.box(h.w+.5,.9,3.2,T,g,cx,yb-.7,0,.3).name='Channel beam';
          arcade(w,g,x0,x1,yb-1.1,8.5,0,i);
          layer(top,0,2.2,3.2);
          for(let k=0;k<Math.round(h.w/2.4);k++){
            const x=x0+.8+rand(k*3+h.x)*(x1-x0-1.6),hh=.5+rand(k*7+h.x)*.6;
            drop(w,g,x,yb-.1,1.5+rand(k+h.x)*.1,.3+rand(k*5+h.x)*.14,hh,M,k);
          }
          const A=pink(w);
          for(let k=0;k<2;k++){const x=x0+1.5+rand(k*13+h.x)*(x1-x0-3);w.ball(.4,.34,.4,A,g,x,yb-1.2,1.55).name='Pink blob';}
        }else{
          w.box(h.w+.5,7,3,M,g,...P(h.x+h.w/2,top-3.5,0),.3);
          layer(top,0,1.4,3.2);
        }
      });
    }
    return list;
  },

  // The river's own sky, three depths deep: pink clay hills rolling away into
  // the haze, lavender pillars capped with pink domes and frosted with mint
  // where the far river has run over them, a round arch, two hair-thin
  // yellow falls, soft clouds — and, top-left for the whole section, a
  // lollipop: three pastel ribbons wound into a spiral on a lavender stick.
  // Everything here takes the fog, so the distance is pale and quiet and the
  // streams in front are the saturated things.
  backdrop(w,L,section,layers){
    const far=layers.at(.12),mid=layers.at(.2),near=layers.at(.32),sky=layers.at(.14);
    const A=pink(w),T=slot(w,'terrain','orange');
    const hillFar=glow(w,'riverHillFar',0xeeadd6,.12),hillMid=glow(w,'riverHillMid',0xe69cca,.08),hillNear=glow(w,'riverHillNear',0xe3a0cf,.04),cloud=glow(w,'riverCloud',0xe2d8f7,.35),C=cream(w);
    // A pillar: a rounded lavender shaft, a glossy pink dome, a mint frosting
    // ring under the dome with a drop or two, and a pink blob on the shaft.
    // `pour` runs the far river's pale glaze down its face from under the dome.
    const pillar=(layer,dx,h,z,r=1.2,{frost=true,pour=false}={})=>{
      const g=layers.place(layer,section.x+dx,-7,z);g.name='River pillar';
      w.box(r*2,h,r*2,'back',g,0,h/2,0,r*.9);
      w.ball(r*1.35,r*.85,r*1.35,A,g,0,h+.1,0).name='Pink dome';
      if(frost){
        w.ball(r*1.25,.32,r*1.25,T,g,0,h-.15,0).name='Pillar frosting';
        drop(w,g,-r*.8,h-.25,r*.55,.3,.9,T,0);drop(w,g,r*.65,h-.2,r*.7,.26,.6,T,1);
        w.ball(.45,.38,.42,A,g,r*.7,h*.45,r*.7).name='Pink blob';
      }
      if(pour)stream(w,g,[[.15,h-.3,r*.4],[.2,h-2,r*.9],[.1,h*.5,r*.95],[.15,-1,r*.9]],.5,C,'Pillar pour',{speed:0,squash:.8,spread:1.6});
      return g;
    };
    // Layers compress world x toward the camera (an item stands at x*factor
    // from the camera's x), so the pillars are spread over three times the
    // section to land across the frame rather than in a bunch behind the
    // player, and they drift past at their layer's rate as the player walks.
    // Far: wide hills up to about the walk line, tall slim pillars, clouds.
    // The hills overlap so the horizon is a soft line of pink.
    for(const [i,[dx,rx,ry]] of [[-40,16,6],[-14,14,5.2],[8,12,6.2],[30,15,5],[52,12,6.6],[74,14,5.2],[96,12,6],[120,15,5.4]].entries()){
      const g=layers.place(far,section.x+dx,-5-i%2*.6,-52);g.name='River hill';w.ball(rx,ry,4,hillFar,g,0,0,0);
    }
    for(const [dx,h,pour] of [[-40,22,false],[30,26,true],[110,21,false]])pillar(far,dx,h,-50,1.05,{frost:false,pour});
    for(const [dx,y,rx] of [[-20,13,5],[36,15.5,4],[70,12.5,5.5],[120,14,4.5]]){const g=layers.place(far,section.x+dx,y,-51);g.name='River cloud';w.ball(rx,1.5,2,cloud,g,0,0,0);w.ball(rx*.55,1.9,2,cloud,g,rx*.3,.4,0);}
    // Middle: hills, frosted pillars (one pouring), a round arch.
    for(const [i,[dx,rx,ry]] of [[-30,10,4.6],[-6,10,4.2],[20,9,5],[46,11,4.2],[68,9,4.8],[92,10,4.4],[118,10,4.6]].entries()){
      const g=layers.place(mid,section.x+dx,-4.4-i%2*.4,-40);g.name='River hill';w.ball(rx,ry,4,hillMid,g,0,0,0);
    }
    for(const [dx,h,pour] of [[-28,17,false],[40,19,false],[104,16,true]])pillar(mid,dx,h,-38,.95,{pour});
    {
      const g=layers.place(mid,section.x+70,-6,-40);g.name='River arch';
      for(const x of [-3.8,3.8])w.box(1.6,8,1.6,'back2',g,x,4,0,.7);
      const head=w.mesh(arch(w,3.8,.8),'back2',g,0,8,0);head.scale.z=2;head.name='Arch head';
      w.ball(1.25,.45,1.25,A,g,-3.8,8.2,0);w.ball(1.25,.45,1.25,A,g,3.8,8.2,0);
    }
    // Near: low pink mounds and the two big pillars.
    for(const [dx,rx,ry] of [[-10,6,2.6],[26,6.5,2.4],[60,6,2.8],[96,6.5,2.5]]){const g=layers.place(near,section.x+dx,-5.4,-28);g.name='River mound';w.ball(rx,ry,4,hillNear,g,0,0,0);}
    pillar(near,14,13,-30,1.15);pillar(near,63,15,-30,1.15);
    // The lollipop, in the top-left: at the sky layer's rate it stays in that
    // corner across the whole section (the layer also rises with the camera,
    // so it hangs low enough to show from the first bank). Two fat ribbons,
    // pink and cream, wound twice: fewer, wider turns than the parade's sun so
    // the spiral is read as one. It turns very slowly (animate).
    {
      const g=layers.place(sky,section.x-6,2.2,-34);g.name='River lollipop';
      w.box(.8,20,.8,'back2',g,0,-10,-.5,.38).name='Lollipop stick';
      w.ball(1.05,.65,1.05,A,g,0,.1,-.5).name='Stick cap';
      const disc=group(g,'Lollipop disc',0,3.9,0);
      const mats=[glow(w,'riverLolliPink',0xf6a9d3,.08),glow(w,'riverLolliCream',0xfbf1de,.1)];
      mats.forEach((mat,k)=>{
        const pts=[];for(let i=0;i<=84;i++){const a=i/84*Math.PI*2*2+k*Math.PI,r=.3+i/84*3.5;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
        w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),120,.56,7,false),mat,disc,0,0,0).name='Lollipop ribbon';
      });
      (w.riverSpin??=[]).push({mesh:disc,speed:.04});
    }
  },

  // Per frame: the streams' clock advances (their flow lives in the shader);
  // the geyser rises while its channel is open and settles back to a bud when
  // it is not (only in the lab does a channel ever close again); bubbles bob
  // on the streams. Everything else is transform-only.
  animate(w,game,dt,section,ctx){
    const t=ctx.time,still=ctx.reducedMotion;
    tickRiverClay(t,still);
    // The chapter's placeholder side scenery (depth-scenery.js's pastel mound
    // in front of every bank) would stand in front of the arcades; the
    // aqueducts are meant to be seen through.
    if(w.depthViews?.size)for(const s of sectionDecks(game.level,section)){const v=w.depthViews.get(s.id);if(v)v.root.visible=false;}
    const gz=w.riverGeyser;
    if(gz&&attached(gz.spout,w.scene)){
      const on=!!game.latched['river-geyser']||game.channels['river-geyser']>0;
      const target=on?10.2+(still?0:Math.sin(t*5.5)*.25):.35;
      gz.height=still?target:gz.height+(target-gz.height)*(1-Math.exp(-dt*3.2));
      gz.spout.scale.y=gz.height;gz.spout.position.y=gz.height/2;gz.spout.scale.x=gz.spout.scale.z=.5*(on&&!still?1+Math.sin(t*9)*.06:1);
      gz.crest.position.y=gz.height;gz.crest.rotation.z=on&&!still?Math.sin(t*3)*.08:0;
      gz.bubbles.forEach((m,i)=>{
        const rising=on&&gz.height>2;m.visible=rising;
        if(rising){const u=((t*.9+i*.37)%1+1)%1;m.position.y=.4+u*(gz.height-.8);m.scale.setScalar(.12+u*.16);}
      });
    }else if(gz)w.riverGeyser=null;
    const spins=w.riverSpin;
    if(spins?.length)for(let i=spins.length-1;i>=0;i--){
      const s=spins[i];
      if(!attached(s.mesh,w.scene)){spins.splice(i,1);continue;}
      if(!still)s.mesh.rotation.z-=dt*s.speed;
    }
    const bubbles=w.riverBubbles;
    if(bubbles?.length)for(let i=bubbles.length-1;i>=0;i--){
      const b=bubbles[i];
      if(!attached(b.mesh,w.scene)){bubbles.splice(i,1);continue;}
      if(still)continue;
      b.mesh.position.y=b.y+Math.sin(t*b.rate+b.phase)*.13;
      const s=1+Math.sin(t*b.rate*1.7+b.phase)*.08;b.mesh.scale.y=b.mesh.scale.x*1.12*s;
    }
  }
};
