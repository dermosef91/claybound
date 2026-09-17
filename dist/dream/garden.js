import * as THREE from '../lib/three.module.js';
import {sectionDecks,deck,lean,slot,rand} from './support.js';
// Section 1 — The Crooked Garden. Only the very start of the chapter is mild:
// lavender and mint, then the arch at local 34 tips everything into violet.
// The one surreal idea is the garden leaning to watch you: round trees and
// tall flowers bend toward the player wherever they walk. This first pass
// proves the prop pipeline — trees and flowers streamed in as scenery by x,
// each registered as a leaner — and leaves the arch's own geometry, the deck
// dressing and the far scenery to the section's author.

// A round clay tree: a trunk and a lollipop crown, pivoting at its foot so a
// lean tilts the whole tree. `size` scales it; the crown takes the palette's
// secondary colour (foliage) with two accent beads.
function roundTree(w,parent,size,seed){
  const g=lean(w,group(parent,'Garden tree'),{x:parent.position.x,y:parent.position.y,strength:.12});
  g.scale.setScalar(size);
  w.box(.44,3,.44,slot(w,'bark','dark'),g,0,1.5,0,.2);
  w.ball(1.45,1.3,1.15,slot(w,'foliage','top'),g,.1,3.9,0);
  w.ball(.9,.8,.8,slot(w,'foliage','top'),g,-.8,3.2,-.1);
  w.ball(.3,.3,.22,slot(w,'accent'),g,.7+rand(seed)*.4,4.3,.9);
  w.ball(.22,.22,.18,slot(w,'accent'),g,-1.1,3.6,.7);
  return g;
}
// A tall garden flower: stem, two leaves, five petals and a heart, pivoting at
// the root. Flowers lean harder than trees, so the bed visibly turns to look.
function gardenFlower(w,parent,height,petal){
  const g=lean(w,group(parent,'Garden flower'),{x:parent.position.x,y:parent.position.y,strength:.32});
  w.cylinder(.05,height,slot(w,'vine','dark'),g,0,height/2,0);
  for(const side of [-1,1]){const leaf=w.ball(.26,.09,.12,slot(w,'foliage','top'),g,side*.2,height*.45,0);leaf.rotation.z=side*.6;}
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,p=w.ball(.22,.11,.07,slot(w,petal,'gold'),g,Math.cos(a)*.26,height+Math.sin(a)*.26,0);p.rotation.z=a;}
  w.ball(.13,.13,.1,'gold',g,0,height,.06);
  return g;
}
function group(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);return g;}

export default {
  key:'garden',
  // Scenery by WORLD x: decks are looked up by id, so the same list works in
  // the full chapter (where the entry deck is `start`) and in a solo build.
  props(section,L){
    const decks=sectionDecks(L,section),entry=decks[0];
    const arch=deck(L,'garden-arch'),rest=deck(L,'garden-rest'),exit=deck(L,'garden-exit');
    const list=[];
    const tree=(key,on,offset,size,seed)=>on&&list.push({key,x:on.x+offset,y:on.y,w:3*size,z:-1.5,make:(w,parent)=>roundTree(w,parent,size,seed)});
    const flower=(key,on,offset,height,petal)=>on&&list.push({key,x:on.x+offset,y:on.y,w:.7,z:-1,make:(w,parent)=>gardenFlower(w,parent,height,petal)});
    tree('tree-a',entry,1.6,1.15,1);flower('flower-a',entry,4.4,1.5,'accent');flower('flower-b',entry,5.3,1.1,'top');flower('flower-c',entry,9.6,1.7,'accent');
    flower('flower-d',arch,1.2,1.6,'top');tree('tree-b',arch,7.4,.9,2);
    flower('flower-e',rest,.9,1.4,'accent');flower('flower-f',rest,3.4,1.8,'top');
    tree('tree-c',exit,5.9,1.05,3);flower('flower-g',exit,2.2,1.3,'accent');
    return list;
  }
  // dress / deck / backdrop / animate: not yet — the default rolled slabs and
  // the shared placeholder sky stand in until the section's author builds
  // the crooked garden proper.
};
