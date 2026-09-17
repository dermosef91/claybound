import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {deck,slot} from './support.js';
// Section 2 — The Folding Path. The one idea is that orientation is
// negotiable: the decks are sheets of clay folded under themselves, the
// standing walls are the same sheets on end, and the far scenery repeats the
// fold three ways — slabs already standing, a path that closes like a book,
// and two pale hands in the haze that might have done the folding. Nothing
// here leans or bobs: stillness is what makes the folds read when they move.
//
// Palette slots (applyDreamPalette): main → terrain/terrain2 (ultramarine),
// secondary → top (lemon frosting), backdrop → back/back2 (lilac haze),
// accent → accent (one magenta bead per sheet). Cream and dark appear only
// where the shared views already use them (fold stripes, hinges).
//
// Every coordinate on this side is WORLD: decks are looked up by id, and the
// far scenery is placed through layers.place(group, worldX, y, z).

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const mats=w=>({T:slot(w,'terrain','blue'),T2:slot(w,'terrain2','blueDark'),TOP:slot(w,'top','gold'),A:slot(w,'accent','gold')});

// --- the folded sheet -----------------------------------------------------------
// A deck is one thick sheet of ultramarine clay under a lemon frosting cap,
// folded back under itself twice so its underside steps inward, with the
// frosting spilling over one end where the sheet was creased. Local coords:
// the walkable top is y 0 across 0..width; the body hangs below.
function foldedSheet(w,g,width,{lip=null}={}){
  const {T,T2,TOP,A}=mats(w);
  w.box(width+.16,.5,3.6,TOP,g,width/2,-.2,0,.22).name='Sheet frosting';
  w.box(width+.04,3.2,3.3,T,g,width/2,-2.05,-.05,.6).name='Sheet body';
  const under=Math.max(1.6,width*.82),shift=lip==='right'?-1:1;
  w.box(under,3,3,T2,g,width/2+shift*width*.06,-5,-.25,.7).name='Sheet fold-under';
  const root=Math.max(1.2,width*.6);
  w.box(root,3.9,2.6,T,g,width/2-shift*width*.04,-8.45,-.4,.7).name='Sheet root';
  if(lip){
    const x=lip==='right'?width+.02:-.02;
    w.box(.5,1.5,3.5,TOP,g,x,-.85,0,.2).name='Frosting lip';
    w.ball(.42,.3,.5,TOP,g,x,-1.65,.9).name='Frosting drip';
  }
  w.ball(.28,.22,.24,A,g,width*.3,.1,-1.2).name='Sheet bead';
}
// The lip goes where nothing abuts: seams between decks (and between sections)
// are left plain so a fold never pokes into a neighbour's face.
const LIPS={'folding-land':'right','folding-exit':'left'};

// --- the cliff post -----------------------------------------------------------------
// The wall the folded tongue stands on: the cliff's last two courses, capped
// with frosting the tongue covers once it lies out.
function cliffPost(w,s,g){
  const {T,T2,TOP}=mats(w);g.name='Cliff post · '+s.id;
  const h=s.h??3;
  w.box(s.w+.12,.4,3.5,TOP,g,s.w/2,-.22,0,.18).name='Post frosting';
  w.box(s.w+.04,h,3.3,T,g,s.w/2,-.3-h/2,-.05,.5).name='Post body';
  w.box(s.w*.8,2.6,3,T2,g,s.w*.44,-h-1.5,-.25,.5).name='Post fold-under';
  return {root:g};
}

// --- the standing tile -----------------------------------------------------------------
// The counter: a floor tile, frosting and all, that rises out of the pit into
// a step. Its body is deep enough to hide the pit's floor at rest and to keep
// a face showing when it stands 2.4 up; the collar it slides through is a
// static prop (props(), 'tile-collar') so it stays put while the tile moves.
function standingTile(w,s,g){
  const {T,T2,TOP}=mats(w);g.name='Standing tile · '+s.id;
  w.box(s.w+.1,.4,3.2,TOP,g,s.w/2,-.2,0,.18).name='Tile frosting';
  w.box(s.w-.1,3,2.8,T,g,s.w/2,-1.9,-.05,.5).name='Tile body';
  w.box(s.w-.5,1.2,2.4,T2,g,s.w/2,-3.9,-.15,.4).name='Tile foot';
  w.box(.42,1.3,3.1,TOP,g,s.w-.02,-.9,0,.16).name='Tile lip';
  return {root:g};
}

// --- the fold's stand -----------------------------------------------------------------
// The shared fold view draws the turning panel (lemon face, dark axle); this
// gives its hinge a post to stand on, reaching down toward the void without
// touching the hazard band's spikes.
function foldStand(w,s,g){
  const view=createDreamView(w,s,g);if(!view)return null;
  const {T,T2}=mats(w);
  const stand=group(g,'Fold stand',s.pivot==='right'?s.w:0,0,0);
  const h=Math.min(3.2,s.y+2);
  w.box(1.3,.55,2.5,T2,stand,0,-.5,-.2,.22).name='Fold post shoulder';
  w.box(.8,h,2.1,T,stand,0,-.35-h/2,-.2,.3).name='Fold post';
  return view;
}

// --- far scenery pieces -----------------------------------------------------------------
// A slab standing on end: the fold's wall pose, already happened. The
// frosting that was its top is now a vertical face on the side the player
// comes from; the dark axle at its foot is the hinge it turned on. Drawn in
// the backdrop slots (lilac on lilac) so a slab in the mid-distance is read
// as scenery and never as a wall on the route — the route's own colours,
// ultramarine and lemon, are kept for what can be stood on.
function standingSlab(w,g,h){
  const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');g.name='Standing slab';
  w.box(.9,h,2.2,B2,g,0,h/2,0,.28).name='Slab body';
  w.box(.3,h+.1,2.4,B,g,-.55,h/2+.05,0,.12).name='Slab face';
  const axle=w.cylinder(.22,2.4,'dark',g,0,.05,0);axle.rotation.x=Math.PI/2;axle.name='Slab hinge';
}
// A pale hand from the haze: a palm and five rounded fingers, in the backdrop
// slot so it fades into the fog like something half-remembered. Built with
// the fingers pointing up; the caller turns it to reach down into the frame.
function hazeHand(w,g,flip){
  const B=slot(w,'back','cream');g.name='Haze hand';
  const hand=group(g,'Hand');hand.scale.x=flip;
  w.ball(1.45,1.6,.9,B,hand,0,0,0).name='Palm';
  // Four fingers close together, the middle two longest, each a rounded rod
  // standing up from the palm's edge; the thumb leaves from the side.
  for(let i=0;i<4;i++){
    const a=(i-1.5)*.09,len=2+(i===1?.5:i===2?.35:i===3?-.2:0);
    const finger=w.ball(.31,len/2,.31,B,hand,(i-1.5)*.66,1.35+len/2,0);
    finger.rotation.z=-a;finger.name='Finger';
  }
  const thumb=w.ball(.33,.8,.33,B,hand,1.6,.55,0);thumb.rotation.z=-1;thumb.name='Thumb';
  return hand;
}

export default {
  key:'folding',

  // Stone decks: the folded sheet in place of the chapter's rolled slab.
  dress(w,s,g){
    foldedSheet(w,g,s.w,{lip:LIPS[s.id]??null});
    return true;
  },

  // The cliff post, the standing tile and the folds' stands; everything else
  // (violet tongue, tinted ramp, thin lemon ledges) keeps the shared look.
  deck(w,s,g){
    if(s.kind==='wall'&&s.id==='folding-tongue-post')return cliffPost(w,s,g);
    if(s.kind==='counter')return standingTile(w,s,g);
    if(s.kind==='fold')return foldStand(w,s,g);
    return null;
  },

  // Streamed scenery by world x, looked up from the decks it belongs to.
  props(section,L){
    const list=[];
    const ceiling=deck(L,'folding-ceiling'),step=deck(L,'folding-step');
    if(ceiling){
      // The ceiling the auto ramp hangs from: a mass over the block's resting
      // place with two lemon drips, so the clay reads as ceiling that sagged.
      const from=ceiling.shape?.from??ceiling;
      list.push({key:'ceiling',x:from.x+3,y:from.y,w:11,z:-.5,make(w,parent){
        const {T,T2,TOP}=mats(w);
        w.box(9.4,2.6,3.2,T,parent,0,1.3,0,.7).name='Ceiling mass';
        w.box(6.6,1.8,2.8,T2,parent,.7,3.4,-.2,.6).name='Ceiling mass upper';
        for(const [x,len,r] of [[2.7,2,.5],[-3.7,1.4,.42]]){
          const points=[[0,.05],[r,0],[r*.92,-.22],[r*.6,-len*.5],[r*.24,-len*.84],[0,-len]].map(([a,b])=>new THREE.Vector2(a,b));
          w.mesh(new THREE.LatheGeometry(points,16),TOP,parent,x,0,.3).name='Lemon drip';
        }
      }});
    }
    if(step){
      // The collar the tile stands up through: two blocks either side of the
      // slot, planted in the pit above the spikes and not moving with the tile.
      list.push({key:'tile-collar',x:step.x+step.w/2,y:step.y,w:step.w+1.2,z:-.3,make(w,parent){
        const {T2}=mats(w);
        for(const side of [-1,1])w.box(.44,1.2,3,T2,parent,side*(step.w/2+.28),-.7,0,.18).name='Tile collar';
      }});
    }
    return list;
  },

  // Far scenery, placed once per build by world x. A parallax item stands at
  // its worldX only when the camera is there and drifts toward the camera
  // otherwise (item x = worldX·f + camera·(1−f)), and the camera's slight
  // downward tilt lifts deeper items on screen (≈ .9 u at z −14, ≈ 2.4 u at
  // z −36) — both allowed for below.
  backdrop(w,L,section,layers){
    const mid=layers.at(.5),far=layers.at(.24);
    // Three slabs already standing, feet on the deck line, foreshadowing the
    // folds before one moves.
    for(const [dx,h] of [[14,5.6],[33,6.4],[55,5.8]])standingSlab(w,layers.place(mid,section.x+dx,-1.2,-18),h);
    // The path that closes like a book: a flat slab floating in the haze until
    // the player passes x 30, then it rears up 90° about its right edge
    // (animate()). Backdrop only — a fold's wall pose is not standable, so
    // this never sits on the route — and lilac like the slabs, so a flat slab
    // in the mid-distance is never taken for a deck.
    {
      const g=layers.place(mid,section.x+31,2.2,-18);g.name='Book slab';
      const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');
      const pivot=group(g,'Book hinge');
      w.box(6,.9,2.2,B2,pivot,-3,.45,0,.28).name='Book body';
      w.box(6.1,.3,2.4,B,pivot,-3,1.05,0,.12).name='Book frosting';
      const axle=w.cylinder(.22,2.4,'dark',g,0,.05,0);axle.rotation.x=Math.PI/2;axle.name='Book hinge axle';
      w.foldingBook={pivot,progress:0,armed:false,armX:section.x+30};
    }
    // Two pale hands reaching down from above the frame, one over each
    // toppled wall, as if they had just let go: the first over the tongue's
    // bridge at deck height, the second over the high stretch.
    hazeHand(w,layers.place(far,section.x+23,4.5,-36),1).rotation.z=2.5;
    hazeHand(w,layers.place(far,section.x+50,7.5,-36),-1).rotation.z=2.7;
  },

  // The only motion the module adds: the book slab rearing up once, after the
  // player passes x 30. Reduced motion snaps it upright instead of turning.
  animate(w,game,dt,section,ctx){
    const book=w.foldingBook;if(!book||!attached(book.pivot,w.scene))return;
    if(!book.armed&&ctx.playerX>book.armX)book.armed=true;
    if(book.armed)book.progress=Math.min(1,book.progress+dt/1.8);
    const k=ctx.reducedMotion?(book.armed?1:0):smooth(book.progress);
    book.pivot.rotation.z=-k*Math.PI/2;
  }
};
