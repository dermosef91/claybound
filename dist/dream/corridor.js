import * as THREE from '../lib/three.module.js';
import {deck,slot,rand} from './support.js';
// Section 4 — The Breathing Corridor. One idea: the tunnel breathes. Everything
// here is coiled clay in four tones of one hue — magenta bodies, raspberry
// tops, dark magenta between — with the pink haze of the palette behind it and
// mint kept for the eyes alone. The corridor is a coil pot laid on its side:
//
//   · the decks are striped slabs (a magenta cap over wavy raspberry coils)
//   · the breathing pillars, the throat and the teeth are stacks of rounded
//     stripes that stretch with the breath — the whole stack is the `body`
//     the breathe pose rescales, so the picture never disagrees with the wall
//   · the ceiling and the trench floor are long wavy coils that vault over the
//     pillars and teeth and press down where you walk; the throat hangs from
//     the ceiling's lowest point
//   · soft cones standing in the trenches and a few hanging from the vault;
//     the tunnel closes down at both seams, where the ceiling is lowest
//   · the molars are cream teeth on raspberry roots that stretch down out of
//     the gum as the press bites (the shared cavern press view is hidden here)
//   · six tiny eyes set in the pillars, the throat, the floor and a tooth,
//     closed until you come near; then they open, watch, blink once and are
//     gone again — never a big permanent eye
//
// Coordinates on this side are WORLD: decks are looked up by id, and the
// section's ceiling and floor profiles are drawn between them.

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// The four tones every stripe in the corridor is drawn in: magenta (terrain),
// raspberry (top), dark magenta (terrain2) and back to raspberry.
const STRIPES=['terrain','top','terrain2','top'];
const mat=(w,name)=>slot(w,name,'orange');

// --- the animated registry -----------------------------------------------------
// Eyes and molars are built inside streamed groups and moved per frame by
// animate(); each entry is dropped once its group has left the scene.
const registry=w=>w.corridorAnim??={eyes:[],molars:[]};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const worldPosition=new THREE.Vector3();

// --- profiles -------------------------------------------------------------------
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
// The corridor's decks by id and the ceiling / trench-floor profiles drawn
// between them: the vault rises over the pillars and the teeth (the coils sit
// behind the walk line, so a full jump's head may overlap them in the picture
// for a moment without ever meeting them), presses down over the entry and floor-1,
// and meets the throat's top at 7; the trench floor dips under the goo pit.
function layout(L){
  const ids=['entry','pillar-1','pillar-2','pillar-3','floor-1','throat','plug','floor-2','tooth-1','tooth-2','exit'];
  const d={};for(const id of ids)if(!(d[id]=deck(L,'corridor-'+id)))return null;
  const right=s=>s.x+s.w;
  const ceiling=profile([
    [d.entry.x,4.9],[d.entry.x+6,5.2],[d['pillar-1'].x-1,6.6],[d['pillar-1'].x+2.5,7.3],[d['pillar-3'].x+1.5,7.3],
    [d['floor-1'].x+1,6.6],[d['floor-1'].x+5.5,5.5],[d['floor-1'].x+8.5,6.2],[d.throat.x,7],[right(d.throat),7],
    [d['floor-2'].x-.5,6.6],[right(d['floor-2']),6.6],[d['tooth-1'].x+.5,7.4],[d['tooth-2'].x+1.8,7.4],
    [d.exit.x+1.5,6.2],[right(d.exit),5.2]
  ]);
  const floor=profile([
    [d.entry.x,-2.7],[d['floor-1'].x+7.5,-2.7],[d.throat.x-.5,-4.3],[d['floor-2'].x-.5,-4.3],[d['floor-2'].x+1,-2.7],[right(d.exit),-2.7]
  ]);
  return {d,ceiling,floor,left:d.entry.x,right:right(d.exit)};
}

// --- coils ------------------------------------------------------------------------
// A rolled band of clay along x: a tube through points a unit apart following
// `yAt`, flattened deep (scale z) so it reads as a coil laid on its side. Its
// ends curl back into the body so no open tube mouth ever faces the camera.
function coil(w,parent,x0,x1,yAt,r,material,depth,name='Coil'){
  const pts=[new THREE.Vector3(x0+.15,yAt(x0+.15),-.45)];
  for(let x=x0+.45;x<x1-.3;x+=1)pts.push(new THREE.Vector3(x,yAt(x),0));
  pts.push(new THREE.Vector3(x1-.3,yAt(x1-.3),0),new THREE.Vector3(x1-.15,yAt(x1-.15),-.45));
  const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.5);
  const m=w.mesh(new THREE.TubeGeometry(curve,Math.max(8,Math.round((x1-x0)*2)),r,10,false),material,parent,0,0,0);
  m.scale.z=depth/(2*r);m.name=name;return m;
}
// A soft cone: one unit-high lathe, scaled per cone (tip up; rotate for a drip).
function cone(w,parent,x,y,z,r,h,material,down=false){
  const points=[[1,0],[.94,.1],[.76,.3],[.52,.55],[.28,.78],[.1,.94],[0,1]].map(([a,b])=>new THREE.Vector2(a,b));
  const m=w.mesh(new THREE.LatheGeometry(points,14),material,parent,x,y,z);
  m.scale.set(r,h,r);if(down)m.rotation.z=Math.PI;m.name=down?'Hanging cone':'Soft cone';return m;
}

// --- eyes ---------------------------------------------------------------------------
// A tiny eye: a cream ball, a raspberry lid arc over it and a mint iris. Built
// shut (scaled to nothing); animate() opens it when the player is within six
// units, tracks them with the iris, blinks once and closes it again.
function eye(w,parent,x,y,z,seed){
  const g=group(parent,'Corridor eye',x,y,z);
  w.ball(.22,.2,.15,'cream',g,0,0,0).name='Eye ball';
  const iris=group(g,'Eye iris',0,0,.12);
  w.ball(.095,.095,.05,slot(w,'accent','gold'),iris,0,0,0).name='Iris';
  w.ball(.045,.045,.03,'dark',iris,0,0,.045).name='Pupil';
  const lid=w.mesh(new THREE.TorusGeometry(.23,.06,6,14,Math.PI),mat(w,'top'),g,0,.01,.1);lid.name='Eye lid';
  g.scale.setScalar(.001);
  registry(w).eyes.push({group:g,iris,state:'closed',t:0,cool:rand(seed)*2});
  return g;
}
const EYE={reach:6,open:.22,blinkAt:1.2,blink:.18,closeAt:2.4,close:.2,rest:6};
function animateEyes(w,game,dt,ctx){
  const list=registry(w).eyes;if(!list.length)return;
  const p=game.player;
  for(let i=list.length-1;i>=0;i--){
    const e=list[i];
    if(!attached(e.group,w.scene)){list.splice(i,1);continue;}
    e.group.getWorldPosition(worldPosition);
    const dx=ctx.playerX-worldPosition.x,dy=(p.y+1.2)-worldPosition.y;
    e.cool=Math.max(0,e.cool-dt);
    if(e.state==='closed'){
      if(Math.abs(dx)<EYE.reach&&e.cool<=0){e.state='open';e.t=0;}
      else{e.group.scale.setScalar(.001);continue;}
    }
    e.t+=dt;
    let open=smooth(e.t/EYE.open);
    if(e.t>EYE.closeAt)open*=1-smooth((e.t-EYE.closeAt)/EYE.close);
    if(e.t>EYE.closeAt+EYE.close){e.state='closed';e.cool=EYE.rest;e.group.scale.setScalar(.001);continue;}
    const blink=e.t>EYE.blinkAt&&e.t<EYE.blinkAt+EYE.blink?1-.88*Math.sin(Math.PI*(e.t-EYE.blinkAt)/EYE.blink):1;
    const s=Math.max(.001,open);e.group.scale.set(s,Math.max(.001,s*blink),s);
    if(!ctx.reducedMotion){e.iris.position.x=clamp(dx/EYE.reach,-1,1)*.085;e.iris.position.y=clamp(dy/8,-1,1)*.05;}
  }
}

// --- the breathing walls ---------------------------------------------------------------
// Pillars, throat and teeth: a stack of rounded stripes as the breathe pose's
// `body` (centred, so scaling it about its middle and parking it at −h/2 keeps
// the top at the collider's top and stretches the stripes with the breath).
// The throat's lowest stripe is the fat raspberry underside you crawl under;
// a pillar's top stripe is its cap.
function breathingWall(w,s,g){
  const h=s.baseH??s.h??4,W=s.w,hanging=s.breathe?.dy===undefined&&h>5;
  g.name='Breathing wall · '+s.id;
  const body=group(g,'Breathing wall body',W/2,-h/2,0);
  const n=Math.max(3,Math.round(h/.78)),sh=h/n;
  for(let i=0;i<n;i++){
    const top=i===n-1,bottom=i===0,cap=hanging?bottom:top;
    const y=-h/2+sh*(i+.5),name=cap?'top':STRIPES[(i+(hanging?1:0))%STRIPES.length];
    const grow=cap?.08:0,radius=cap?Math.min(.34,W/3.2,sh/2.2):Math.min(.2,W/8,sh/3);
    w.box(W+grow,sh+.06,2+grow,mat(w,name),body,0,y,0,radius).name=cap?'Wall cap':'Wall stripe';
  }
  // One tiny eye per wall that carries one (pillar-1, pillar-3, the teeth's
  // first, and two in the throat), set in the root so it rides the top rather
  // than stretching with the body.
  if(s.id==='corridor-pillar-1')eye(w,g,W*.5,-1.3,1.03,1);
  if(s.id==='corridor-pillar-3')eye(w,g,W*.5,-1.3,1.03,2);
  if(s.id==='corridor-throat'){eye(w,g,.9,-4.2,1.03,3);eye(w,g,4.1,-3.4,1.03,4);}
  if(s.id==='corridor-tooth-1')eye(w,g,W*.5,-1.2,1.03,6);
  const live=s.h??h;body.scale.y=live/h;body.position.y=-live/2;
  return {root:g,dream:{kind:'breathe',body,lids:[],baseH:h}};
}

// --- the striped decks --------------------------------------------------------------------
// A stone deck: a magenta cap at the walk line over five wavy coils narrowing
// to nothing — the same rolled clay the tunnel is made of.
function stripedDeck(w,s,g){
  const W=s.w;
  g.name='Striped deck · '+s.id;
  w.box(W+.16,.62,3.4,mat(w,'terrain'),g,W/2,-.31,0,.3).name='Deck cap';
  const rows=['top','terrain2','top','terrain','bark'];
  for(let k=0;k<rows.length;k++){
    const y=-.95-k*.8,phase=k*1.9+s.x*.7;
    coil(w,g,-.12,W+.12,x=>y+.1*Math.sin(x*1.5+phase),.46,mat(w,rows[k]),2.7-k*.12,'Deck coil');
  }
  if(s.id==='corridor-floor-2')eye(w,g,3,-1.05,1.4,5);
  return true;
}

// --- the molars ------------------------------------------------------------------------------
// A press as a tooth: a cream molar on a raspberry root that stretches down
// out of a gum bulge in the ceiling as the head descends. The tooth follows
// the press's live y (its hurt box is ±.65 about it), squashes on impact and
// trembles through the wind-up, like the cavern press it replaces.
function molar(w,parent,c,ceilingY){
  const g=group(parent,'Molar');
  w.ball(1.25,.5,1.1,mat(w,'top'),g,0,ceilingY,-.2).name='Gum';
  const root=w.cylinder(.36,1,mat(w,'top'),g,0,ceilingY,-.05);root.name='Molar root';
  const tooth=group(g,'Molar tooth',0,c.y??ceilingY-1,0);
  w.box(1.6,1.3,2,'cream',tooth,0,0,0,.42).name='Molar crown';
  w.box(1.5,.26,1.9,mat(w,'top'),tooth,0,.58,0,.1).name='Molar gum line';
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
  // Stone decks: striped slabs instead of the chapter's rolled slab.
  dress(w,s,g){return stripedDeck(w,s,g);},
  // Breathing walls (pillars, throat, teeth): striped bodies posed by the
  // breathe view; everything else keeps the dream's own look.
  deck(w,s,g){return s.kind==='wall'&&s.breathe?breathingWall(w,s,g):null;},
  // The tunnel itself, streamed by world x: the ceiling and floor coils, the
  // cones and the molars.
  props(section,L){
    const lay=layout(L);if(!lay)return [];
    const {d,ceiling,floor,left,right}=lay,length=right-left,list=[];
    // Ceiling and trench floor: seven long coils spanning the section, so the
    // bands run unbroken from mouth to mouth.
    list.push({key:'tunnel',x:left+length/2,w:length+4,y:0,z:-1.7,make(w,parent){
      const g=group(parent,'Corridor tunnel',-(left+length/2),0,0);
      const rows=['top','terrain','terrain2','top'];
      for(let k=0;k<4;k++)coil(w,g,left-.6,right+.6,x=>ceiling(x)+.5+k*.82+.1*Math.sin(x*1.1+k*2.1),.52,mat(w,rows[k]),2.7,'Ceiling coil');
      for(let k=0;k<3;k++)coil(w,g,left-.6,right+.6,x=>floor(x)-k*.82+.08*Math.sin(x*1.3+k*1.7),.52,mat(w,rows[k]),2.6,'Floor coil');
    }});
    // Soft cones standing in the two trenches (behind the hazard spikes, off
    // the pillars' footprints) and a few drips hanging from the vault.
    const standing=(key,x,w,cones)=>list.push({key,x,w,y:-1.62,z:-1.5,make(w2,parent){
      const g=group(parent,'Trench cones',-x,0,0);
      cones.forEach(([cx,r,h],i)=>cone(w2,g,cx,0,0,r,h,mat(w2,i%2?'terrain2':'top')));
    }});
    const t1=d.entry.x+8,t2=d['floor-2'].x+8;
    standing('cones-1',(t1+d['floor-1'].x)/2,d['floor-1'].x-t1+1,[[t1+.7,.6,2.2],[t1+4.5,.7,3],[t1+5.3,.45,1.6],[t1+9,.65,2.6],[t1+9.7,.4,1.4],[t1+13.1,.55,2]]);
    standing('cones-2',(t2+d.exit.x)/2,d.exit.x-t2+1,[[t2+.25,.42,1.6],[t2+2.4,.55,2.4],[t2+2.9,.38,1.5]]);
    list.push({key:'drips',x:left+length/2,w:length+2,y:0,z:-1.6,make(w,parent){
      const g=group(parent,'Vault drips',-(left+length/2),0,0);
      [[left+4,.42,1],[d['pillar-2'].x-1.4,.5,2.2],[d['floor-1'].x+2.5,.4,1.3],[d['floor-2'].x+1.5,.45,1.4],[right-1.6,.4,1.1]]
        .forEach(([x,r,h])=>cone(w,g,x,ceiling(x)+.08,0,r,h,mat(w,'top'),true));
    }});
    // The molars: one per press the section brought.
    (L.crushers||[]).filter(c=>c.x>=left&&c.x<right).forEach((c,i)=>list.push({key:'molar-'+i,x:c.x,w:3,y:0,z:0,make(w,parent){molar(w,parent,c,ceiling(c.x));}}));
    return list;
  },
  // Far scenery: pale arches standing in the pink haze, the way the reference's
  // tunnel recedes into soft openings. Emissive backdrop slots read as haze.
  backdrop(w,L,section,layers){
    const far=layers.at(.4);
    for(let i=0;i<4;i++){
      const g=layers.place(far,section.x+7+i*13.5,-1.5,-34);
      const arch=w.mesh(new THREE.TorusGeometry(3.4+rand(i+40)*1.2,1,8,22,Math.PI),i%2?'back2':'back',g,0,0,0);
      arch.scale.y=1.35;arch.name='Haze arch';
    }
  },
  animate(w,game,dt,section,ctx){
    animateEyes(w,game,dt,ctx);
    animateMolars(w,game,dt);
  }
};
