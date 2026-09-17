import * as THREE from '../lib/three.module.js';
import {deck,slot,rand} from './support.js';
import {createDreamView} from '../dream-views.js';
import {sculptClay} from '../clay.js';
import {riverClay,flowTube,tickRiverClay} from './river-clay.js';
// Section 6 — The Colour River. ONE idea: three streams of wet clay, each
// with a verb. Yellow carries (the conveyor ledges ARE the yellow river, with
// its source welling out of the bank and its plunge into the undertow), pink
// throws (the springs are the crests of a pink column rising through the
// yellow), blue sinks (the pads and the raft are blue, the blue lane slides
// under them and arches over the backwards trench). Banks are the chapter's
// rolled slabs in the section palette — mint bodies, lavender tops — so the
// only colours on screen beyond the palette are the three stream materials.
// The streams move: the yellow river's stripes scroll, every stream's surface
// bulges and streaks along its flow (river-clay.js), and the geyser spout
// rises out of the pool once the clot is pressed.

// The stream materials: the formable clay's material recoloured, glossier and
// flowing (river-clay.js), made once per world and kept in w.mat. Pink is the
// section accent as its own stream rather than the palette slot, so it flows
// like the other two.
const YELLOW=0xf2e94e,BLUE=0x2d47d4,PINK=0xff62b0;
const yellow=w=>riverClay(w,'riverYellow',YELLOW),blue=w=>riverClay(w,'riverBlue',BLUE),pink=w=>riverClay(w,'riverPink',PINK);
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
function deckRiver(w,parent,width,mat,name,{speed,dir=1,top=0,r=.75,squash=.66,spread=1.25,hang=1.4,reach=.9}){
  const c=top-r*squash,sign=dir<0?-1:1,[x0,x1]=sign>0?[0,width]:[width,0];
  // A curl leaving the deck at x, outward by `sign`, down by h over rch.
  const curl=(x,out,h,rch)=>[[x+out*rch*.6,c-h*.32],[x+out*rch,c-h]];
  const pts=[...curl(x0,-sign,hang*.4,reach*.6).reverse(),[x0+sign*.1,c-.02],[width/2,c],[x1-sign*.1,c-.02],...curl(x1,sign,hang,reach)];
  return stream(w,parent,pts.map(([x,y])=>[x,y,0]),r,mat,name,{speed,hold:1,squash,spread});
}
// A flowing sheet over a slab: a wide, low ellipse whose centre sits on the
// slab's top, so its upper half heaves above the old flat face. Hazard water,
// so nothing holds its crest.
function sheet(w,parent,x0,x1,y,mat,name,speed){
  return stream(w,parent,[[x0,y,0],[(x0+x1)/2,y,0],[x1,y,0]],.45,mat,name,{speed,squash:.7,spread:3.2});
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
  const view=createDreamView(w,s,g),Y=yellow(w);
  hide(g,'River deck top','River deck body');
  for(const stripe of view.dream?.stripes||[]){stripe.scale.y=.7;stripe.scale.z=.42;}
  deckRiver(w,g,s.w,Y,'Yellow river',{speed:Math.abs(s.conveyor)*.9,dir:Math.sign(s.conveyor)||1});
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
  w.cylinder(.46,1.6,A,g,cx,-1,-.05).name='Pink stem';
  w.ball(s.w*.56,.3,.86,A,g,cx,-.16,0).name='Pink crest pad';
  w.ball(.34,.3,.34,A,g,cx-.55,-.5,.32).name='Pink bead';
  w.ball(.26,.24,.26,A,g,cx+.6,-.62,-.28).name='Pink bead';
  const ring=w.mesh(new THREE.TorusGeometry(s.w*.4,.07,7,26),'cream',g,cx,-.02,0);ring.rotation.x=Math.PI/2;ring.name='Crest ring';
  return {root:g};
}

export default {
  key:'river',
  deck(w,s,g){
    if(s.conveyor)return yellowDeck(w,s,g);
    if(s.kind==='sink')return blueDeck(w,s,g);
    if(s.kind==='spring')return pinkSpring(w,s,g);
    return null;
  },
  // The banks keep the chapter's rolled slab: in this palette that is exactly
  // "mint bodies, lavender tops", and it pays for the streams.

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

    // 1. The yellow source wells out of the entry bank and runs onto the
    //    river; at the river's end it plunges, and the pink column rises
    //    through the plunge to its crest — the first spring.
    prop('stream-a',E.x+5,S1.x+2.2,(w,parent)=>{
      const P=local(parent),Y=yellow(w),A=pink(w);
      const g=group(parent,'Yellow source and plunge');
      tube(w,g,[P(E.x+5.2,-1.1,-1.45),P(E.x+6.3,.05,-1.35),P(E.x+7.6,.3,-1.25),P(Y1.x+1.4,.14,-1.15),P(Y1.x+2.6,.1,-1.12)],.5,Y,'Yellow source');
      const end=Y1.x+Y1.w;
      // The plunge crosses the pink column just above the deep's surface,
      // so the pierce is seen, then dives — faster, as a fall does.
      tube(w,g,[P(end-1.2,.1,-1.12),P(end+.4,-.04,-1.1),P(S1.x+.9,-.5,-1.1),P(S1.x+1.55,-.98,-1.1),P(S1.x+1.75,-1.7,-1.1),P(S1.x+1.6,-3.6,-1.1)],.5,Y,'Yellow plunge',6);
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
      bubble(w,pour,...P(Y2.x+Y2.w-.3,Y2.y+.9,-.7),.18,Y,7);bubble(w,ribbon,...P(rx+.7,S2.y+3.2,-.85),.2,Y,8);bubble(w,ribbon,...P(rx-.75,S2.y+5.6,-.8),.17,Y,9);
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

    // 6. The deep: every hazard band in the section wears a blue slab just
    //    over its spikes with a flowing blue sheet heaving on top — the same
    //    blue that sinks — so the undertow, the blue river's surface and the
    //    trench read as one deep water. Render-only: the kill line is the
    //    band's own. The pool has its surface from the geyser prop above.
    for(const [i,h] of L.hazards.entries()){
      if(h.x<section.x-1||h.x>section.x+section.length||h.x>=PB.x+PB.w-1)continue;
      prop('deep-'+i,h.x,h.x+h.w,(w,parent)=>{
        const P=local(parent),B=blue(w),g=group(parent,'Blue deep');
        w.box(h.w+.5,1.6,3,B,g,...P(h.x+h.w/2,h.y+.2,0),.3);
        sheet(w,g,P(h.x-.25,0)[0],P(h.x+h.w+.25,0)[0],P(0,h.y+1)[1],B,'Deep flow',1.4);
      });
    }
    return list;
  },

  // Far scenery: two slim rounded pillars in the backdrop colour, one capped
  // with a splash of yellow and one of blue, and two low mesas — the river's
  // hues echoed once in the distance, nothing more (the shared sky already
  // carries the pink swirls).
  backdrop(w,L,section,layers){
    const mid=layers.at(.3),far=layers.at(.16);
    const B=blue(w),Y=yellow(w);
    [[14,13,Y],[63,15,B]].forEach(([dx,h,cap])=>{
      const g=layers.place(mid,section.x+dx,-7,-36);g.name='River pillar';
      w.box(2.2,h,2.2,'back2',g,0,h/2,0,1);
      w.ball(1.6,.6,1.6,cap,g,0,h+.1,0);
      w.ball(.42,1.1,.42,cap,g,1.15,h-.8,.5);
    });
    for(const [dx,rx] of [[26,9],[58,7]]){const g=layers.place(far,section.x+dx,-6,-58);g.name='River mesa';w.ball(rx,3.6,4,'back',g,0,0,0);}
  },

  // Per frame: the streams' clock advances (their flow lives in the shader);
  // the geyser rises while its channel is open and settles back to a bud when
  // it is not (only in the lab does a channel ever close again); bubbles bob
  // on the streams. Everything else is transform-only.
  animate(w,game,dt,section,ctx){
    const t=ctx.time,still=ctx.reducedMotion;
    tickRiverClay(t,still);
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
