import * as THREE from '../lib/three.module.js';
import {deck,slot,rand} from './support.js';
import {createDreamView} from '../dream-views.js';
import {clayMaterial} from '../clay.js';
// Section 9 — The Infinite Room. ONE idea: the same room four times, each
// pass wrong in one way — normal, hung from the ceiling, doll-sized with the
// player a giant, turned on end into a shaft — and the last door is the first
// door. One furniture kit (chair, table, cup, books, pendant lamp, drawers)
// is instanced four ways, in the palette's slots: `terrain` the wall and
// floor, `top` cream cloth and china, `accent` the furniture (ultramarine in
// pass 1, lamp glow in the shaft), `back` the wall's silhouettes. The doors'
// lemon frame is the section's one extra colour. Restraint: big simple
// shapes, the room's wall is the sky itself, and one moving thing per screen
// — the floating book, the blinking teacups, the turning mobile.
//
// Everything is placed by deck id (world x); nothing adds section.x by hand.

const LEMON=0xf2ee74;
// The lemon door frame, made once per world and hooked into the clay relief.
function lemon(w){
  if(!w.mat)return 'gold';
  if(!w.mat.roomLemon){w.mat.roomLemon=new THREE.MeshStandardMaterial({color:LEMON,roughness:.98,metalness:0});clayMaterial(w,w.mat.roomLemon,.06);}
  return 'roomLemon';
}
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
// Cached lathes: the cup body and the saucer are built once per world.
function cupGeometry(w){
  return w.roomCupGeo??=(()=>{
    const pts=[[.62,0],[.7,.15],[.86,.7],[.95,1.3],[1,1.6],[.9,1.6],[.86,1.32],[.72,.75],[.58,.18],[0,.18]].map(([r,y])=>new THREE.Vector2(r,y));
    return new THREE.LatheGeometry(pts,18);
  })();
}

// --- the kit ---------------------------------------------------------------------
// A chair back: two posts leaning to the right with a rail across the top.
// Local coordinates: the seat's top is y 0 and spans 0..width.
function chairBack(w,g,width,height,mat){
  const lean=.16;
  for(const x of [width*.2,width*.9]){
    const post=w.box(.34,height,.34,mat,g,x+Math.tan(lean)*height/2,height/2,-.6,.12);post.rotation.z=-lean;post.name='Chair post';
  }
  w.box(width*.78+.4,.42,.4,mat,g,width*.55+Math.tan(lean)*height,height+.1,-.6,.14).name='Chair rail';
}
// A teacup standing on a saucer, rim at y 0, in cream with a lemon dot.
function teacup(w,g,x,scale=1,y=0){
  const cup=group(g,'Teacup',x,y,0);cup.scale.setScalar(scale);
  w.mesh(cupGeometry(w),slot(w,'top'),cup,0,-1.6,0).name='Cup body';
  const handle=w.mesh(new THREE.TorusGeometry(.34,.09,8,18),slot(w,'top'),cup,1.05,-.8,0);handle.name='Cup handle';
  w.cylinder(1.3,.12,slot(w,'top'),cup,0,-1.62,0).name='Saucer';
  w.ball(.2,.2,.08,slot(w,'accent','gold'),cup,-.3,-.8,.86).name='Cup flower';
  return cup;
}
// A stack of books lying flat: covers in accent, pages in cream.
function books(w,g,x,y,width,count,thick,mat){
  for(let i=0;i<count;i++){
    const dx=(rand(i*3+x)-.5)*.5,cy=y+thick*(i+.5);
    w.box(width,thick,width*.82,mat,g,x+dx,cy,0,.1).name='Book cover';
    w.box(width*.92,thick*.7,width*.86,slot(w,'top'),g,x+dx+width*.02,cy,0,.06).name='Book pages';
  }
}
// A door: lemon frame (two posts and an arched head), the leaf swung open
// behind the walk line, a knob. The player walks through the gap.
function door(w,parent,scale=1,leafMat='accent'){
  const g=group(parent,'Room door',0,0,-1.2);g.scale.setScalar(scale);
  const frame=lemon(w),hw=1.1,h=2.5;
  for(const x of [-hw,hw])w.box(.3,h,.5,frame,g,x,h/2,0,.1).name='Door post';
  const head=w.mesh(new THREE.TorusGeometry(hw,.16,10,22,Math.PI),frame,g,0,h,0);head.name='Door head';head.scale.z=1.5;
  const leaf=group(g,'Door leaf',-hw+.15,0,-.1);leaf.rotation.y=-1.25;
  w.box(2*hw-.3,h+.55,.14,slot(w,leafMat),leaf,hw-.15,(h+.55)/2,0,.08).name='Door leaf panel';
  w.ball(.11,.11,.11,'gold',leaf,2*hw-.75,1.25,.16).name='Door knob';
  return g;
}
// A spill over a hazard band: a run of overlapping flattened blobs — liquid
// clay, lumpy and soft, nothing a foot could trust — whose tops meet the
// band's kill line and swallow the shared spike row.
function spill(w,parent,width,mat){
  const step=2.1,count=Math.max(2,Math.ceil(width/step)),pitch=(width-1.2)/(count-1);
  for(let i=0;i<count;i++){
    const x=.6+i*pitch,bulge=.85+rand(i*7+width)*.2;
    w.ball(1.55,bulge,1.5,mat,parent,x,.08,(i%2?-.2:.15)).name='Spill blob';
  }
}
// The gingham: a flat cloth over the hazard, low enough that the pins come
// through it — a floor you can see is not for standing on.
function cloth(w,parent,width,mat){
  const m=w.box(width+.6,.9,2.7,mat,parent,width/2,.05,0,.3);m.name='Cloth';return m;
}
// A pulled-out drawer as a ledge: the drawer's lip, a cream edge, a knob.
function drawerLip(w,g,width,pieces=null){
  const body=w.box(width,.42,2.2,slot(w,'terrain'),g,width/2,-.21,0,.12);body.name='Drawer lip';
  const edge=w.box(width,.12,.34,slot(w,'top'),g,width/2,-.02,.98,.04);edge.name='Drawer edge';
  const knob=w.ball(.18,.18,.14,slot(w,'accent','gold'),g,width/2,-.24,1.14);knob.name='Drawer knob';
  if(pieces)for(const [i,m]of [body,edge,knob].entries())pieces.push({mesh:m,rest:m.position.clone(),seed:i*17+width*3,layer:i?1:0});
}

// A floor slab for the room's floor decks: lavender boards, a paler top.
function floor(w,s,g){
  w.box(s.w+.1,2.4,3.4,slot(w,'terrain'),g,s.w/2,-1.3,0,.3).name='Room floor';
  w.box(s.w+.2,.36,3.5,slot(w,'terrain2'),g,s.w/2,-.18,0,.12).name='Floor boards';
  for(let i=0;i<Math.floor(s.w/2);i++)w.box(.05,.06,3.2,slot(w,'back'),g,1+i*2,.01,0,.01).name='Board seam';
}

// --- stone decks: dress() ----------------------------------------------------------
const DRESS={
  'room-entry':floor,'room-exit':floor,
  // Pass 1: the chair seat with legs to the floor and a leaning back.
  'room-seat'(w,s,g){
    const mat=slot(w,'accent');
    w.box(s.w,.6,2.8,mat,g,s.w/2,-.3,0,.18).name='Chair seat';
    for(const x of [.7,s.w-.7])w.cylinder(.3,s.y-.6,mat,g,x,-.6-(s.y-.6)/2,-.3).name='Chair leg';
    chairBack(w,g,s.w,6.4,mat);
  },
  // Pass 1: the table with its cloth; the cup and the door stand on it as props.
  'room-table'(w,s,g){
    const mat=slot(w,'accent');
    w.box(s.w,.62,3.2,mat,g,s.w/2,-.31,0,.18).name='Table top';
    for(const x of [.8,s.w-.8])w.cylinder(.34,s.y-.6,mat,g,x,-.6-(s.y-.6)/2,-.4).name='Table leg';
    w.box(2.3,.22,3.4,slot(w,'top'),g,1.1,.08,0,.08).name='Tablecloth';
    w.box(.24,2.1,3.4,slot(w,'top'),g,-.08,-1.0,0,.08).name='Tablecloth flap';
  },
  // Pass 2 landing: a wall shelf on two brackets.
  'room-landing-2'(w,s,g){
    const mat=slot(w,'accent');
    w.box(s.w,.5,2.6,mat,g,s.w/2,-.25,0,.16).name='Shelf';
    for(const x of [.8,s.w-.8])w.box(.3,1.1,1.6,mat,g,x,-1.05,-.4,.1).name='Shelf bracket';
  },
  // Pass 2: a saucer on a stack of upturned cups standing in the tea.
  'room-saucer'(w,s,g){
    const top=slot(w,'top'),mat=slot(w,'accent');
    w.cylinder(1.35,.3,top,g,s.w/2,-.15,0).name='Saucer';
    for(let i=0;i<3;i++){
      w.cylinder(.9,1.2,top,g,s.w/2,-.9-i*1.25,0).name='Upturned cup';
      w.cylinder(.96,.16,mat,g,s.w/2,-.5-i*1.25,0).name='Cup band';
    }
  },
  // Pass 2: the upturned table's legs standing out of the tea as pillars.
  'room-leg-1':tableLeg,'room-leg-2':tableLeg,'room-leg-3':tableLeg,
  // Pass 2 landing: three giant books stacked out of the tea, door 2 on top.
  'room-landing-3'(w,s,g){
    books(w,g,s.w/2,-(s.y+.3),s.w,3,(s.y+.3)/3,slot(w,'accent'));
  },
  // Pass 3: the kneading stand — a stack of two gift boxes with a lemon ribbon.
  'room-doll-table'(w,s,g){
    w.box(s.w,2.5,3,slot(w,'terrain'),g,s.w/2,-(s.y+1)+1.25,0,.2).name='Lower box';
    w.box(s.w-.4,2.5,2.6,slot(w,'top'),g,s.w/2,-1.25,0,.18).name='Upper box';
    w.box(.5,2.56,2.66,slot(w,'accent','gold'),g,s.w/2,-1.25,0,.06).name='Ribbon';
    w.box(s.w-.36,.5,2.66,slot(w,'accent','gold'),g,s.w/2,-2.2,0,.06).name='Ribbon band';
  },
  // Pass 4: the bottom drawer of the chest, door 3 on top.
  'room-shaft-foot'(w,s,g){
    w.box(s.w,s.y+1,3,slot(w,'terrain'),g,s.w/2,-(s.y+1)/2,0,.22).name='Bottom drawer';
    w.box(s.w-.3,.5,.4,slot(w,'top'),g,s.w/2,-.5,1.3,.08).name='Drawer edge';
    w.ball(.28,.28,.2,slot(w,'accent','gold'),g,s.w/2,-2,1.5).name='Drawer knob';
  }
};
function tableLeg(w,s,g){
  const depth=s.y+.3;
  w.cylinder(.5,depth,slot(w,'accent'),g,s.w/2,-depth/2,0).name='Table leg';
  w.cylinder(.64,.3,slot(w,'top'),g,s.w/2,-.15,0).name='Leg foot';
  w.cylinder(.6,.3,slot(w,'top'),g,s.w/2,-depth*.55,0).name='Leg ring';
}

// --- every other deck: deck() -------------------------------------------------------
function view(g,extra={}){return {root:g,ropes:[],bounce:0,...extra};}
const DECK={
  // Pass 1: the chair's rung and back slats are bars in the chair's colour.
  'room-rung':bar,'room-slat-1':bar,'room-slat-2':bar,
  // Pass 1: the floating book.
  'room-book'(w,s,g){
    w.box(s.w,.5,2.2,slot(w,'accent'),g,s.w/2,-.25,0,.1).name='Book cover';
    w.box(s.w-.3,.34,2.05,slot(w,'top'),g,s.w/2+.1,-.25,0,.06).name='Book pages';
    return view(g);
  },
  // Pass 2: the pendant lamps stand on the floor as bowls: the dome view, on
  // its cord, which runs down into the tea.
  'room-lamp-1':lamp,'room-lamp-2':lamp,
  // Pass 2: the hanging chair's seat, legs up to the ceiling, back hanging down.
  'room-hung-seat'(w,s,g){
    const mat=slot(w,'accent');
    w.box(s.w,.5,2.4,mat,g,s.w/2,-.25,0,.16).name='Hung seat';
    const ceiling=16.2-s.y;
    for(const x of [.4,s.w-.4])w.cylinder(.22,ceiling,mat,g,x,ceiling/2,-.3).name='Hung chair leg';
    w.box(.32,3.2,.32,mat,g,.25,-2.1,-.6,.1).name='Hung chair post';
    for(const y of [-1.6,-3.0])w.box(.9,.32,.32,mat,g,.6,y,-.6,.1).name='Hung chair slat';
    return view(g);
  },
  // Pass 3: doll chairs that crumble — every part is a fracture piece, so the
  // chair falls apart under the player's feet.
  'room-chair-1':dollChair,'room-chair-2':dollChair,
  // Pass 3: teacups that blink; the pulse animator squashes and ghosts them.
  'room-teacup-1'(w,s,g){teacup(w,g,s.w/2,1);return view(g);},
  'room-teacup-2'(w,s,g){teacup(w,g,s.w/2,1);return view(g);},
  // Pass 3: the room's wall with a doll-sized doorway at its foot.
  'room-doll-wall'(w,s,g){
    w.box(s.w,s.h,2.4,slot(w,'terrain'),g,s.w/2,-s.h/2,0,.14).name='Doll wall';
    const frame=lemon(w),gap=1.7;
    for(const x of [-.12,s.w+.12])w.box(.22,gap+.2,.5,frame,g,x,-s.h-gap/2,-1.1,.06).name='Doll door post';
    w.box(s.w+.46,.24,.5,frame,g,s.w/2,-s.h-.12,-1.1,.06).name='Doll door lintel';
    w.box(.9,.7,.12,slot(w,'back'),g,s.w/2,-3,1.2,.04).name='Tiny picture';
    w.box(.6,.42,.14,slot(w,'top'),g,s.w/2,-3,1.22,.03).name='Tiny picture mount';
    return view(g);
  },
  // Pass 4: drawer lips for every rung of the ladder; the crumbling ones fall
  // apart piece by piece.
  'room-s1':lip,'room-s2':lip,'room-s3':lip,'room-s5':lip,'room-s6':lip,'room-top':lip,'room-landing-4':lip,'room-d1':lip,'room-d2':lip,
  'room-s4':crumbleLip,'room-s7':crumbleLip,
  // Pass 4: the mobile's lowest saucer, on a string to the hub (animate()).
  'room-mobile'(w,s,g){
    w.cylinder(s.w/2,.26,slot(w,'top'),g,s.w/2,-.13,0).name='Mobile saucer';
    const rim=w.mesh(new THREE.TorusGeometry(s.w/2-.05,.09,8,28),slot(w,'accent','gold'),g,s.w/2,-.02,0);rim.rotation.x=Math.PI/2;rim.name='Saucer rim';
    const string=group(g,'Mobile string',s.w/2,0,0);
    w.cylinder(.04,1,'rope',string,0,.5,0).name='String';
    return view(g,{roomString:string});
  },
  // Pass 4: the dumbwaiter — a lamp-lit crate on a rope to the ceiling. The
  // rope carries a `ceiling` anchor, so world.render keeps it taut.
  'room-dumbwaiter'(w,s,g){
    w.box(s.w,.4,2.4,slot(w,'top'),g,s.w/2,-.2,0,.1).name='Dumbwaiter floor';
    w.box(s.w,1.9,2.2,slot(w,'terrain'),g,s.w/2,-1.35,-.2,.16).name='Dumbwaiter crate';
    w.ball(.34,.42,.3,slot(w,'accent','gold'),g,s.w/2,-1.25,1.0).name='Dumbwaiter lamp';
    const rest=4,rope=w.rope([s.w/2,0,-.2],[s.w/2,rest,-.2],g,.07);rope.name='Dumbwaiter rope';
    rope.userData.ceiling={y:s.baseY!==undefined?27.6:27.6,rest,offset:0};
    return view(g,{ropes:[rope]});
  }
};
function bar(w,s,g){
  w.box(s.w,.34,.42,slot(w,'accent'),g,s.w/2,-.17,-.3,.14).name='Chair bar';
  return view(g);
}
function lamp(w,s,g){
  const v=createDreamView(w,s,g);
  if(!v)return null;
  const tea=-1.2-s.y,bottom=-s.w;
  w.cylinder(s.w/2+.38,.16,slot(w,'top'),g,s.w/2,-s.w/2,0).name='Lamp brim';
  w.cylinder(.09,bottom-tea,'dark',g,s.w/2,(bottom+tea)/2,0).name='Lamp cord';
  w.cylinder(.3,.28,'dark',g,s.w/2,bottom-.1,0).name='Lamp socket';
  return v;
}
function dollChair(w,s,g){
  const mat=slot(w,'accent','gold'),pieces=[];
  const part=(m,i)=>{pieces.push({mesh:m,rest:m.position.clone(),seed:i*13+s.x,layer:i>2?1:0});return m;};
  part(w.box(s.w,.42,1.8,mat,g,s.w/2,-.21,0,.12),0).name='Doll seat';
  for(const [i,x]of [.3,s.w-.3].entries())part(w.box(.18,1.5,.18,mat,g,x,-1.05,-.2,.06),1+i).name='Doll chair leg';
  part(w.box(.2,1.5,.2,mat,g,s.w-.18,.75,-.55,.06),3).name='Doll chair post';
  part(w.box(.2,1.5,.2,mat,g,.18,.75,-.55,.06),4).name='Doll chair post';
  part(w.box(s.w-.1,.24,.22,mat,g,s.w/2,1.45,-.55,.06),5).name='Doll chair rail';
  part(w.box(s.w-.4,.2,.18,mat,g,s.w/2,.8,-.55,.05),6).name='Doll chair slat';
  return view(g,{fracture:{pieces,crumbClock:0}});
}
function lip(w,s,g){drawerLip(w,g,s.w);return view(g);}
function crumbleLip(w,s,g){const pieces=[];drawerLip(w,g,s.w,pieces);return view(g,{fracture:{pieces,crumbClock:0}});}

export default {
  key:'room',
  dress(w,s,g,section){const build=DRESS[s.id];if(!build)return;build(w,s,g,section);return true;},
  deck(w,s,g,section){const build=DECK[s.id];return build?build(w,s,g,section):null;},

  // --- far scenery: the wall's silhouettes, per pass -------------------------------
  // The room's wall is the sky colour itself; what the layer adds is the wall's
  // furniture-less décor — a window, a picture, a small far door, a skirting
  // board — in the backdrop slot, the right way up in pass 1, upside down in
  // pass 2, at a third of the size in pass 3, and a chest of drawers turned on
  // end for the shaft. Nearly on the walk plane (factor .93) and with no
  // vertical follow, so it reads as the wall the furniture stands against and
  // stays put when the camera climbs — a wall, not a sky.
  backdrop(w,L,section,layers){
    const wall=layers.at(.93,{heightFollow:0});
    const entry=deck(L,'room-entry');if(!entry)return;
    const at=(x,y,z=-9)=>layers.place(wall,x,y,z);
    const back=slot(w,'back'),top=slot(w,'top');
    // A window: a dark arched recess with a cream frame; `flip` turns it over.
    const window=(x,y,scale,flip)=>{
      const g=at(x,y);g.scale.set(scale,flip?-scale:scale,scale);g.name='Room window';
      w.box(2.6,3.2,.4,back,g,0,1.6,0,.1);w.cylinder(1.3,.4,back,g,0,3.2,0).rotation.x=Math.PI/2;
      w.box(.3,3.4,.5,top,g,-1.45,1.7,.05,.08);w.box(.3,3.4,.5,top,g,1.45,1.7,.05,.08);
      const arch=w.mesh(new THREE.TorusGeometry(1.45,.16,8,20,Math.PI),top,g,0,3.2,.05);arch.scale.z=1.4;
      w.box(3.4,.3,.6,top,g,0,-.1,.1,.08);
    };
    const picture=(x,y,scale)=>{const g=at(x,y);g.scale.setScalar(scale);g.name='Room picture';w.box(2.2,1.7,.3,back,g,0,0,0,.08);w.box(1.6,1.15,.3,top,g,0,0,.06,.06);};
    const farDoor=(x,y,scale,flip)=>{const g=at(x,y);g.scale.set(scale,flip?-scale:scale,scale);g.name='Far door';w.box(1.4,2.2,.4,back,g,0,1.1,0,.1);w.cylinder(.7,.4,back,g,0,2.2,0).rotation.x=Math.PI/2;w.ball(.08,.08,.06,'gold',g,.45,1.1,.22);};
    const skirting=(x0,x1,y,flip)=>{const g=at((x0+x1)/2,y);g.name='Skirting';w.box(x1-x0,.5,.5,back,g,0,flip?-.25:.25,0,.1);};
    const X=x=>entry.x+x;
    // Pass 1 — the right way up.
    window(X(5),1.0,1,false);picture(X(21.5),10.8,1);farDoor(X(11.5),-1.4,.6,false);skirting(X(8),X(28),-1.4,false);
    // Pass 2 — upside down: the ceiling is the floor.
    window(X(41),11.6,1,true);picture(X(35),3.6,1);farDoor(X(52.5),16.2,.6,true);skirting(X(30),X(58),16.2,true);
    // Pass 3 — a third of the size, on the gingham.
    window(X(66),.4,.36,false);picture(X(72.5),2.6,.36);farDoor(X(80.5),-.9,.28,false);picture(X(88.2),6.8,.36);skirting(X(60),X(75.5),-.9,false);
    // Pass 4 — the chest of drawers turned on end: two columns of drawer
    // fronts up the shaft, glowing knobs.
    const shaft=at(X(106),-1,-9);shaft.name='Shaft of drawers';
    const knob=slot(w,'accent','gold');
    for(let row=0;row<5;row++)for(const [i,cx]of [-7,4].entries()){
      const width=i?10.5:9.5,y=row*5.6+2.8;
      w.box(width,5.2,1.2,back,shaft,cx,y,0,.3).name='Drawer front';
      w.ball(.36,.36,.24,knob,shaft,cx+(row%2?1.6:-1.6),y-.2,.7).name='Drawer knob';
    }
    // Pass 1 again: the last door has the first door's window beside it.
    window(X(117.6),1.0,1,false);
  },

  // --- streamed props: doors, puddles, the cup, the ceiling, doll things, the mobile hub
  props(section,L){
    const list=[],entry=deck(L,'room-entry'),table=deck(L,'room-table'),l3=deck(L,'room-landing-3'),foot=deck(L,'room-shaft-foot'),exit=deck(L,'room-exit');
    if(!entry)return list;
    const X=x=>entry.x+x;
    const prop=(key,x,y,w,z,make)=>list.push({key,x,y,w,z,make});
    // Doors: the hut door at 1.5, then one per pass; the last is the hut door again.
    for(const [key,x,y]of [['door-1',X(1.5),0],['door-2',table.x+4,table.y],['door-3',l3.x+2,l3.y],['door-4',foot.x+1,foot.y],['door-5',exit.x+2,exit.y]])
      prop(key,x,y,3,0,(w,parent)=>door(w,parent,1));
    // Spills over the hazards: the drink, the tea, the gingham, the ink. The
    // nails under the floorboards keep the shared spike row bare — they are nails.
    const hazards=(L.hazards||[]).filter(h=>h.x>=section.x&&h.x<section.x+section.length).sort((a,b)=>a.x-b.x);
    const mats=['accent','terrain2',null,null,'terrain2'];
    hazards.forEach((h,i)=>{
      if(i===2){prop('gingham',h.x+h.w/2,h.y,h.w+1,0,(w,parent)=>gingham(w,parent,h.w));return;}
      if(!mats[i])return;
      prop(`spill-${i}`,h.x+h.w/2,h.y,h.w+1,0,(w,parent)=>{const g=group(parent,'Spill',-h.w/2,0,0);spill(w,g,h.w,slot(w,mats[i]));});
    });
    // Pass 1: the giant cup on the table.
    prop('cup',table.x+1.7,table.y,3,-1.3,(w,parent)=>teacup(w,parent,0,1.55));
    // Pass 2: the ceiling the hung chair hangs from, and a pendant hanging up.
    const landing2=deck(L,'room-landing-2');
    prop('ceiling',landing2.x+15,16.2,30,-1.8,(w,parent)=>{w.box(30,.6,3,slot(w,'terrain'),parent,0,.3,0,.2).name='Ceiling';});
    // Pass 3: doll things on the gingham — a tiny table with cups, tiny books.
    const chair2=deck(L,'room-chair-2');
    prop('doll-table',chair2.x+5.9,-1,2,-1.4,(w,parent)=>{
      const g=group(parent,'Doll table');g.scale.setScalar(.36);
      w.box(5,.6,3,slot(w,'accent','gold'),g,0,5.7,0,.18);for(const x of [-1.8,1.8])w.cylinder(.3,5.4,slot(w,'accent','gold'),g,x,2.7,-.3);
      teacup(w,g,-1.2,.9,6+1.6*.9);teacup(w,g,1.4,.7,6+1.6*.7);
    });
    prop('doll-books',chair2.x+9.2,-1,1.5,-1.2,(w,parent)=>books(w,parent,0,0,1.3,3,.32,slot(w,'accent','gold')));
    // Pass 4: the mobile's hub and its four other saucers, turning slowly.
    const orbit=deck(L,'room-mobile');
    prop('mobile',orbit.x+orbit.w/2,27.4,10,-1.2,(w,parent)=>{
      w.cylinder(.06,1.4,'rope',parent,0,.7,0).name='Mobile hanger';
      const hub=group(parent,'Mobile hub');
      w.ball(.5,.3,.5,slot(w,'accent','gold'),hub,0,0,0).name='Hub';
      for(let i=0;i<4;i++){
        const a=i/4*Math.PI*2+.4,r=3.2,drop=2.2+i*1.3;
        const arm=w.box(r,.12,.12,'dark',hub,Math.cos(a)*r/2,0,Math.sin(a)*r/2,.04);arm.rotation.y=-a;arm.name='Mobile arm';
        w.cylinder(.04,drop,'rope',hub,Math.cos(a)*r,-drop/2,Math.sin(a)*r).name='Mobile string';
        w.cylinder(.75,.2,slot(w,'top'),hub,Math.cos(a)*r,-drop,Math.sin(a)*r).name='Mobile saucer';
      }
      w.roomMobileHub=hub;
    });
    return list;
  },

  // --- per frame: the mobile turns; its lowest saucer's string points at the hub
  animate(w,game,dt,section,ctx){
    const hub=w.roomMobileHub;
    if(hub&&hub.parent&&!ctx.reducedMotion)hub.rotation.y+=dt*.2;
    const v=w.platforms?.get('room-mobile'),s=v&&game.level.platforms.find(p=>p.id==='room-mobile');
    if(v?.roomString&&s){
      const hx=(s.baseX??s.x)+s.w/2,hy=27.4,dx=hx-(s.x+s.w/2),dy=hy-s.y,len=Math.hypot(dx,dy);
      v.roomString.rotation.z=Math.atan2(dy,dx)-Math.PI/2;v.roomString.scale.y=Math.max(.1,len);
    }
  }
};

// The gingham floor: a cream slab with lemon stripes both ways, so the top and
// the front face both read as checks. Built at the hazard's own position.
function gingham(w,parent,width){
  const g=group(parent,'Gingham floor',-width/2,0,0);
  cloth(w,g,width,slot(w,'top'));
  const stripe=slot(w,'accent','gold');
  for(let x=1.1;x<width-.3;x+=2.2)w.box(.7,.94,2.74,stripe,g,x,.05,0,.3).name='Gingham stripe';
  for(const z of [-.9,0,.9])w.box(width+.62,.04,.7,stripe,g,width/2,.5,z,.02).name='Gingham cross stripe';
  w.box(width+.62,.3,.04,stripe,g,width/2,.1,1.36,.02).name='Gingham front stripe';
}
