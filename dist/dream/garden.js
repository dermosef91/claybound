import * as THREE from '../lib/three.module.js';
import {sectionDecks,deck,lean,slot,rand} from './support.js';
// Section 1 — The Crooked Garden. ONE idea: the ground is a sheet of rolled
// Play-Doh, the path itself is still rolled up (the violet roll on its stump),
// and the fat crooked arch you climb to recolours the world. Only the very
// start is mild — butter clay under mint frosting — then the arch's centre
// tips everything into magenta bodies, lemon tops and an ultramarine sky.
//
// Everything is built from the world's clay primitives in the palette slots
// (main → terrain/terrain2, secondary → top/foliage/bark/vine, backdrop →
// back/back2, accent → accent) plus cream, so the same geometry re-inks as
// the palette cross-fades. Big simple shapes, a handful of colours, and the
// only motion besides the creatures is the garden leaning to watch you.
//
// Hooks (dream.js): dress() replaces the chapter's default rolled slab with
// the garden's own rolled sheet; deck() dresses the stump, the mushroom
// spring, the crown keystone and the floating bends; props() streams the
// leaning flowers, trees and mushrooms, the arch and the pool by WORLD x;
// backdrop() places three far rolled hills and one giant mushroom.

const group=(parent,name)=>{const g=new THREE.Group();g.name=name;parent.add(g);return g;};

// --- terrain: a rolled sheet ------------------------------------------------
// A deck is a thick sheet of clay (three softly rounded rows narrowing
// downward under the frosted cap) whose ends curl up — the way a rolled sheet
// ends — and, on the two lawn slabs, the right end is still a fat roll: the
// small echo of the violet roll the player is about to unroll.
function rolledSheet(w,s,g,{rollEnd=false}={}){
  const width=s.w,depth=3.4,rows=3,rowH=10.4/rows;
  for(let row=0;row<rows;row++){
    const inset=row*.26;
    w.box(width-inset*2+.1,rowH+.3,depth-row*.14,row===1?'terrain2':'terrain',g,width/2,-.2-(row+.5)*rowH,-.04-row*.05,.6).name='Sheet row';
  }
  w.box(width+.16,.5,3.6,'top',g,width/2,-.19,0,.24).name='Sheet frosting';
  // Each end curls up in two diminishing rolls. A lawn slab's right end keeps
  // the whole sheet rolled: a fat log lying across the deck's depth.
  const curl=(x,big)=>{
    if(big){
      const roll=w.cylinder(.72,3.2,'top',g,x-.3,.5,0);roll.rotation.x=Math.PI/2;roll.name='Sheet roll';
      const core=w.cylinder(.3,3.3,'accent',g,x-.3,.5,0);core.rotation.x=Math.PI/2;core.name='Sheet roll core';
      return;
    }
    w.ball(.62,.46,1.72,'top',g,x,-.02,.1).name='Sheet curl';
    w.ball(.36,.28,1.2,'accent',g,x,.34,.34).name='Sheet curl tip';
  };
  curl(.28,false);curl(width-.28,rollEnd);
  // A few loose beads of clay behind the walk line, so the sheet reads as
  // handled rather than pressed from a mould.
  for(let i=0;i<Math.max(2,Math.round(width/3.5));i++){
    const x=1.3+rand(i*5+s.x)*(width-2.6),size=.5+rand(i+s.x*.7)*.4;
    w.ball(size*.5,size*.36,size*.42,i%2?'accent':'terrain2',g,x,.02+size*.3,-1.15-rand(i+s.x)*.3).name='Sheet bead';
  }
  // Thumb-pressed beads along the front edge, sparser than the chapter default.
  for(let i=0;i<Math.ceil(width/1.3);i++){
    const x=.75+i*1.3;if(x>width-.6)continue;
    w.ball(.36,.14+rand(i+s.x)*.06,.17,i%3===1?'accent':'top',g,x,-.32,1.72).name='Sheet thumb';
  }
}

// --- deck dressings -------------------------------------------------------------
// The stump the violet roll stands on: a short fat cylinder with a frosted rim
// and two root bulges, filling the wall's box (0..w across, 0..-h down).
function stump(w,s,g){
  g.name='Garden stump · '+s.id;
  const h=s.h??3.2,r=s.w/2;
  w.cylinder(r*.96,h,'terrain2',g,r,-h/2,0).name='Stump body';
  const rim=w.mesh(new THREE.TorusGeometry(r*.86,.16,8,28),'top',g,r,-.08,0);rim.rotation.x=Math.PI/2;rim.name='Stump rim';
  w.ball(.42,.3,.6,'terrain',g,.15,-h+.28,.5).name='Stump root';
  w.ball(.36,.26,.55,'terrain',g,s.w-.1,-h+.24,-.4).name='Stump root';
  return {root:g};
}
// The spring as a mint mushroom: cream stem, a squashed accent cap whose top
// is the spring's standing height, and three cream dots. world.render
// squashes the root by the spring's bounce, so the cap dips when it fires.
function mushroomSpring(w,s,g){
  g.name='Garden mushroom spring · '+s.id;
  const cx=s.w/2;
  w.cylinder(.42,1.3,'cream',g,cx,-.9,0).name='Mushroom stem';
  w.ball(s.w*.56,.4,1,'accent',g,cx,-.34,0).name='Mushroom cap';
  w.ball(s.w*.42,.16,.8,'cream',g,cx,-.66,.05).name='Mushroom gills';
  for(const [dx,dz,r] of [[-.42,.3,.16],[.3,.45,.13],[.18,-.4,.14]])w.ball(r,r*.5,r,'cream',g,cx+dx,-.03,dz).name='Mushroom dot';
  return {root:g};
}
// A floating bend: a short rolled sheet with no body, curled at both ends.
function bend(w,s,g){
  g.name='Garden bend · '+s.id;
  w.box(s.w+.1,.36,1.9,'top',g,s.w/2,-.18,0,.16).name='Bend frosting';
  w.box(s.w-.3,.34,1.6,'terrain',g,s.w/2,-.5,0,.14).name='Bend body';
  for(const x of [.3,s.w-.3])w.ball(.4,.3,1.1,'top',g,x,.06,.1).name='Bend curl';
  return {root:g};
}
// The arch's keystone: a chunky block in the arch's own slot, sitting where
// the two halves of the arch meet, with a cream bead pressed into its face.
function keystone(w,s,g){
  g.name='Garden arch keystone · '+s.id;
  w.box(s.w+.2,1,1.5,'back',g,s.w/2,-.5,-1.3,.3).name='Keystone';
  w.box(s.w-.4,.3,1.3,'top',g,s.w/2,-.12,-1.2,.12).name='Keystone frosting';
  w.ball(.22,.22,.14,'cream',g,s.w/2,-.42,-.5).name='Keystone bead';
  return {root:g};
}

// --- props -----------------------------------------------------------------------
// A petal flower: a stem, a ring of six petal balls on a frosted ring and a
// cream heart, pivoting at the root. Flowers lean hardest (≈24° at most), so
// the bed visibly turns to look at the player.
function petalFlower(w,parent,height,seed){
  const g=lean(w,group(parent,'Garden petal flower'),{x:parent.position.x,y:parent.position.y,strength:.3});
  g.rotation.z=(rand(seed)-.5)*.16;
  w.cylinder(.09,height,slot(w,'vine','dark'),g,0,height/2,0).name='Flower stem';
  const leaf=w.ball(.34,.11,.16,slot(w,'foliage','top'),g,-.28,height*.42,0);leaf.rotation.z=.7;leaf.name='Flower leaf';
  const head=group(g,'Flower head');head.position.set(0,height,0);head.rotation.z=(rand(seed+1)-.5)*.5;
  const ring=w.mesh(new THREE.TorusGeometry(.5,.1,8,24),slot(w,'top'),head,0,0,-.04);ring.name='Flower ring';
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;w.ball(.3,.3,.17,slot(w,'accent'),head,Math.cos(a)*.52,Math.sin(a)*.52,0).name='Flower petal';}
  w.ball(.27,.27,.19,'cream',head,0,0,.1).name='Flower heart';
  return g;
}
// A round tree: a trunk and three stacked frosting balls, leaning gently
// (≈10° at most) over the path.
function roundTree(w,parent,size){
  const g=lean(w,group(parent,'Garden round tree'),{x:parent.position.x,y:parent.position.y,strength:.12});
  g.scale.setScalar(size);
  w.cylinder(.3,2.6,slot(w,'bark','dark'),g,0,1.3,0).name='Tree trunk';
  w.ball(1.5,1.2,1.3,slot(w,'foliage','top'),g,0,3.1,0).name='Tree ball';
  w.ball(1.15,.95,1,slot(w,'foliage','top'),g,.15,4.4,-.05).name='Tree ball';
  w.ball(.72,.62,.65,slot(w,'foliage','top'),g,-.1,5.4,0).name='Tree ball';
  w.ball(.26,.26,.2,slot(w,'accent'),g,.9,3.6,1).name='Tree bead';
  return g;
}
// A mushroom: a cream stem under a squashed accent cap with three cream dots.
function mushroom(w,parent,size){
  const g=lean(w,group(parent,'Garden mushroom'),{x:parent.position.x,y:parent.position.y,strength:.08});
  g.scale.setScalar(size);
  w.cylinder(.34,1.4,'cream',g,0,.7,0).name='Mushroom stem';
  w.ball(1.05,.5,.95,slot(w,'accent'),g,0,1.4,0).name='Mushroom cap';
  for(const [dx,dz,r] of [[-.45,.35,.17],[.35,.5,.13],[.2,-.45,.15]])w.ball(r,r*.5,r,'cream',g,dx,1.78,dz).name='Mushroom dot';
  return g;
}
// The crooked arch: two fat tapered legs of unequal height and a half torus,
// all in the `back` slot so the palette entry at its centre re-inks it from
// pale periwinkle to ultramarine as the player walks through. Static — the
// crown ledge above it is its keystone and a collider, so the arch must not
// lean away from it. Built about the arch's centre at the deck's top.
function crookedArch(w,parent){
  const g=group(parent,'Garden crooked arch');
  // The bow tips down to the right, so the taller left leg and the shorter
  // right one both meet it; the tilt is what makes the arch crooked.
  const r=1.75,tube=.52,tilt=-.1,cy=4-r-tube;
  const legs=[[-r,cy+.36],[r,cy-.08]];
  for(const [x,h] of legs){
    const leg=w.mesh(new THREE.CylinderGeometry(tube*.92,tube*1.15,h,18),'back',g,x,h/2,0);leg.name='Arch leg';
    w.ball(tube*1.5,.38,tube*1.35,'back',g,x,.14,.1).name='Arch foot';
  }
  const bow=w.mesh(new THREE.TorusGeometry(r,tube,12,36,Math.PI),'back',g,0,cy,0);bow.rotation.z=tilt;bow.name='Arch bow';
  const ridge=w.mesh(new THREE.TorusGeometry(r,tube*.42,8,30,Math.PI),'top',g,0,cy+.04,.36);ridge.rotation.z=tilt;ridge.name='Arch frosting';
  return g;
}
// The pool the bends cross: one glossy slab of the terrain colour under the
// hazard band, with three bubbles resting on it. Behind the spikes.
function pool(w,parent,width){
  const g=group(parent,'Garden pink pool');
  w.box(width,2.6,3.2,'terrain',g,0,-1.6,-.4,.5).name='Pool body';
  for(const [dx,r] of [[-width*.3,.42],[width*.05,.3],[width*.34,.36]])w.ball(r,r*.55,r,'terrain2',g,dx,-.28,.4).name='Pool bubble';
  return g;
}

export default {
  key:'garden',

  // Every stone deck of the garden is a rolled sheet; the two lawn slabs keep
  // their right end rolled up.
  dress(w,s,g){
    rolledSheet(w,s,g,{rollEnd:s.id==='garden-slab-1'||s.id==='garden-slab-2'});
    return true;
  },

  // The stump, the mushroom spring, the crown keystone and the floating bends
  // are the garden's own; everything else (clay, crumbles, the goal) keeps
  // the engine's view.
  deck(w,s,g){
    if(s.shape)return null;
    if(s.kind==='wall'&&s.id==='garden-roll-post')return stump(w,s,g);
    if(s.kind==='spring')return mushroomSpring(w,s,g);
    if(s.kind==='ledge'&&s.id==='garden-crown')return keystone(w,s,g);
    if(s.kind==='ledge')return bend(w,s,g);
    return null;
  },

  // Scenery by WORLD x: decks are looked up by id, so the same list works in
  // the full chapter (where the entry deck is `start`) and in a solo build.
  props(section,L){
    const decks=sectionDecks(L,section),entry=decks[0];
    const slab1=deck(L,'garden-slab-1'),slab2=deck(L,'garden-slab-2'),mound=deck(L,'garden-mound'),exit=deck(L,'garden-exit');
    const list=[];
    const flower=(key,on,dx,height,seed)=>on&&list.push({key,x:on.x+dx,y:on.y,w:1.4,z:-1.25,make:(w,parent)=>petalFlower(w,parent,height,seed)});
    const tree=(key,on,dx,size)=>on&&list.push({key,x:on.x+dx,y:on.y,w:3.2*size,z:-1.5,make:(w,parent)=>roundTree(w,parent,size)});
    const shroom=(key,on,dx,size)=>on&&list.push({key,x:on.x+dx,y:on.y,w:2.2*size,z:-1.1,make:(w,parent)=>mushroom(w,parent,size)});
    // The mild start: one tree, three flowers and a mushroom watch the spawn.
    tree('tree-a',entry,1.7,1.05);flower('flower-a',entry,4.6,1.6,1);flower('flower-d',entry,6.9,1.25,4);flower('flower-b',entry,8.9,2.1,2);shroom('mushroom-a',entry,10.9,.6);
    // The lawn: a flower on the first slab, a tree behind the hatworm's beat.
    flower('flower-c',slab1,1.1,1.5,3);tree('tree-b',slab2,1.4,.85);
    // The arch deck: the arch itself and one mushroom after it — the flag under
    // the bow is the deck's own event.
    if(mound)list.push({key:'arch',x:mound.x+3.75,y:mound.y,w:5,z:-1.35,make:(w,parent)=>crookedArch(w,parent)});
    shroom('mushroom-b',mound,7.2,.7);
    // The pink pool under the bends, drawn behind the hazard's spikes.
    const pit=(L.hazards||[]).find(h=>h.x>=section.x&&h.x<section.x+section.length);
    if(pit)list.push({key:'pool',x:pit.x+pit.w/2,y:pit.y,w:pit.w+1,z:-.6,make:(w,parent)=>pool(w,parent,pit.w+.6)});
    // The exit: a tree, a flower and two mushrooms see the player out.
    tree('tree-c',exit,1.5,1);flower('flower-e',exit,4.2,1.8,5);shroom('mushroom-c',exit,6.4,.75);shroom('mushroom-d',exit,7.3,.45);
    return list;
  },

  // Far scenery: three rolled hills and one giant mushroom in the backdrop
  // slots, placed once by world x on a slow layer.
  backdrop(w,L,section,layers){
    const far=layers.at(.22),mid=layers.at(.4);
    const x0=section.x;
    for(const [dx,rx,ry] of [[8,9,4.2],[34,11,5],[58,8,3.8]]){
      const g=layers.place(far,x0+dx,-4.5,-46);
      w.ball(rx,ry,4,'back',g,0,0,0).name='Far rolled hill';
      const curl=w.cylinder(ry*.55,4.2,'back2',g,rx*.86,ry*.8,0);curl.rotation.x=Math.PI/2;curl.name='Far hill curl';
    }
    for(const [dx,h,cap] of [[50,8,2.4]]){
      const g=layers.place(mid,x0+dx,-5,-34);
      w.box(1.1,h,1.1,'back2',g,0,h/2,0,.5).name='Far mushroom stem';
      w.ball(cap,cap*.42,cap*.8,'back',g,0,h,0).name='Far mushroom cap';
    }
  }
};
