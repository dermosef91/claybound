import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {createCrumble} from '../crumble.js';
import {clayShape,sculptClay} from '../clay.js';
import {leafGeometry} from '../drifter-leaves.js';
import {dreamPlanet,dreamSaucer,dreamSculpture,dreamFruit} from '../dream-assets.js';
import {deck,slot,rand,fixedMaterial,lathe,drip} from './support.js';
// Section 3 — The Upside-Down Orchard (visual module).
// ONE idea: the orchard grows down. A canopy of supplied sculptures spans
// the top of the world, and its harvest hangs under it — crimson apples,
// green pears and small bunches on dark stems and cream strings, each through
// a tuft of leaves, more leaves pushing out from under every piece; saucers
// hang from it on cream strings knotted with an apple; the ground is a pair
// of clay planets hanging over open sky and floating islands under thick lime
// icing, their lumpy mint bodies pressed with pink, raspberry and lime; and
// the great tree grows the wrong way — roots
// waving in the sky, a cream trunk hanging, the supplied iced-apple sculpture
// for a crown at the bottom. The palette's four colours — mint (main), raspberry (secondary),
// lavender (backdrop), lemon (accent) — carry the shapes; the fruit adds the
// colours it cannot reach: apple red, lime, leaf green, cream branch. Big
// simple shapes, restraint over detail.
//
// Hooks: dress() turns the stone decks into the iced islands; deck() dresses
// the domes (the supplied clay planets over the dream-views sphere, or a lemon
// equator round it where they are not loaded), hangs the saucers (lifts and
// the hanging ledges, as the supplied frosted bowls or a sculpted one), makes
// the crumbling decks into apples that drop off their stalks, and builds the
// great inverted tree on the trunk wall; props() lays the canopy, its leaves
// and fruit; backdrop() puts the pink bullseye behind the tree and lavender
// mounds with piles of fruit sunk into their crowns low in the lavender
// distance; animate() waves the roots and keeps the swinging saucer's rope
// pointing at the canopy.

// The canopy's underside, in world y over local x: low over the domes so the
// first drip hangs from it in frame, higher over the saucers, highest where
// the great trunk joins it, and level over the hanging chain. Ropes end here.
const CANOPY=[[-4,12.6],[6,10.6],[9,9.4],[17,9.4],[23,11.6],[35,11.6],[41,13.2],[44,13.7],[51,13.7],[56,13.1],[80,13.1]];
function canopyY(x){
  if(x<=CANOPY[0][0])return CANOPY[0][1];
  for(let i=0;i<CANOPY.length-1;i++){const [a,ya]=CANOPY[i],[b,yb]=CANOPY[i+1];if(x<=b){const t=(x-a)/(b-a),s=t*t*(3-2*t);return ya+(yb-ya)*s;}}
  return CANOPY.at(-1)[1];
}
// The canopy itself: pieces of the supplied abstract sculpture hung along that
// curve the way they were modelled — swirl side to the camera, crown up — so
// the player looks up at each one's foot and the undersides of its overhanging
// sides, and every rope end and fruit stem vanishes into them. Each piece is
// a little wider or narrower, turned and tilted from its own seed, so twelve
// of one model do not read as a stamp: CANOPY_WIDTH is [least, spread],
// CANOPY_TURN and CANOPY_TILT the full ranges in radians (±12° about y, ±4°
// about x and z). CANOPY_DROP is how far a piece's foot hangs below the curve
// at its centre — the ropes end ON the curve and the stems reach to within
// half a unit of it, and the sides' undersides climb about a unit from the
// foot to the rim, so the foot hangs deeper than the sculpted balls bulged.
const CANOPY_WIDTH=[7.7,1.3],CANOPY_DROP=1.3,CANOPY_TURN=.42,CANOPY_TILT=.14;
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}

// --- colours the palette cannot reach -------------------------------------------------
// The fruit is red and the leaves green whatever the palette says: one fixed
// clay material each, shared across the world (see support.js's fixedMaterial).
// Every value here is a step deeper than it will look: the dream's bright
// sun and ambient lift matte clay toward pastel, and the player's hood is an
// orange the apples must stay clear of.
const appleRed=w=>fixedMaterial(w,'orchardApple',0xd9382f,{depth:.05});
const appleDeep=w=>fixedMaterial(w,'orchardAppleDeep',0xa8262a,{depth:.05});
const lime=w=>fixedMaterial(w,'orchardLime',0xd9e35a,{depth:.06});
// A full step below the icing lime and away from the drip enemy's lemon.
const pearGreen=w=>fixedMaterial(w,'orchardPear',0x86b83a,{depth:.05});
const leafGreen=w=>fixedMaterial(w,'orchardLeaf',0x3a9236,{depth:.04});
const leafPale=w=>fixedMaterial(w,'orchardLeafLight',0x62b247,{depth:.04});
const stemBrown=w=>fixedMaterial(w,'orchardStem',0x5e4034,{depth:.03});
const pink=w=>fixedMaterial(w,'orchardPink',0xe4559a,{depth:.06});
// Warm biscuit cream with shading, so the trunk and cords do not bleach to
// flat white against the lavender pillars.
const branch=w=>fixedMaterial(w,'orchardBranch',0xd6b98c,{depth:.09});
// The .42 layer's pink fog washes a colour out; the mounds' fruit start saturated.
const appleFar=w=>fixedMaterial(w,'orchardAppleFar',0x9c1a1a,{depth:.05});
const limeFar=w=>fixedMaterial(w,'orchardLimeFar',0x86ab28,{depth:.06});
const leafFar=w=>fixedMaterial(w,'orchardLeafFar',0x2b6b2a,{depth:.04});

// --- leaves and fruit -------------------------------------------------------------------
// The leaf is the forest drifter's clay leaf (the one leaf shape the game
// has), built once into the clay cache — an extruded outline, so it is
// pressed only in depth. The pear is a unit-high lathe, fat at its foot and
// narrowing to the stem at 1.
const leafGeo=w=>clayShape(w,'orchard-leaf',()=>sculptClay(w,leafGeometry(),{amplitude:.04,planar:true}));
const PEAR=[[0,0],[.3,.02],[.44,.12],[.5,.3],[.45,.46],[.34,.6],[.25,.74],[.2,.86],[.13,.96],[0,1]];
const pearGeo=w=>lathe(w,'orchard-pear',PEAR,0,18);
// A leaf with its base on the group's origin and its tip along local +y, so
// `angle` (about z) is where it points — the tip lands at (−sin, cos): π
// straight down, π−.6 down-left, π+.6 down-right, +1 up-left, −1 up-right.
// `twist` turns it about its own spine so a row of them catches the light
// differently; `tilt` leans it about x (a hanging leaf's tip moves toward −z
// for positive tilt, away from the walk); `width` pinches or fattens the
// blade, so a spread of leaves is not one stamp. `mat` overrides the green.
function leaf(w,parent,x,y,z,size,angle,{pale=false,twist=0,tilt=0,width=1,mat}={}){
  const g=group(parent,'Leaf',x,y,z);g.rotation.set(tilt,0,angle);
  const m=w.mesh(leafGeo(w),mat??(pale?leafPale(w):leafGreen(w)),g,0,size*.75,0);
  m.scale.set(size*width,size,size*.8);m.rotation.y=twist;m.name='Leaf blade';
  return g;
}
function stem(w,parent,x,y0,y1,z,mat,r=.04){
  const m=w.cylinder(r,Math.abs(y1-y0),mat,parent,x,(y0+y1)/2,z);m.name='Fruit stem';return m;
}
// An apple about its centre: a red ball a touch wider than tall, a darker
// dimple at the crown, a short dark stem and a leaf or two out of its base.
// `flat` lays the leaves out sideways, leaning back, for an apple sunk in a
// deck's icing: they hug the cap instead of rising to the player's head.
function fruitApple(w,parent,x,y,z,r,seed,{leaves=1,dimple=true,stemLen=r*.7,deep=false,flat=false}={}){
  const g=group(parent,'Fruit apple',x,y,z);
  w.ball(r,r*.92,r,deep?appleDeep(w):appleRed(w),g).name='Apple body';
  if(dimple)w.ball(r*.3,r*.1,r*.3,appleDeep(w),g,0,r*.88,0).name='Apple dimple';
  if(stemLen>0)stem(w,g,0,r*.85,r*.85+stemLen,0,stemBrown(w),r*.12);
  for(let i=0;i<leaves;i++){
    const side=i%2?-1:1;
    // Up and outward from the stem's side, so a pair splays instead of crossing.
    leaf(w,g,side*r*.1,r*.85+stemLen*.3,r*.15,r*1.1,-side*(flat?1.25:.9+rand(seed+i)*.4),{pale:i%2===1,twist:(rand(seed+9+i)-.5)*.6,tilt:flat?-.3:0});
  }
  return g;
}
// A pear hung narrow end up from the group's origin, its stem reaching on
// above it and a leaf at the stem; a crimson blush on one cheek and a small
// cock about its hang point keep it a fruit, not a lemon teardrop.
function fruitPear(w,parent,x,y,z,size,seed,{leaves=1}={}){
  const g=group(parent,'Fruit pear',x,y,z);g.rotation.z=(rand(seed+12)-.5)*.2;
  const m=w.mesh(pearGeo(w),pearGreen(w),g,0,-size*1.4,0);m.scale.set(size,size*1.4,size);m.name='Pear body';
  w.ball(size*.2,size*.18,size*.14,appleRed(w),g,size*.3,-size*1.0,size*.34).name='Pear blush';
  stem(w,g,0,-.02,size*.5,0,stemBrown(w),size*.1);
  for(let i=0;i<leaves;i++)leaf(w,g,0,size*.2,size*.12,size*.9,(i%2?-1:1)*(1+rand(seed+i)*.4),{pale:i%2===1,twist:(rand(seed+7)-.5)*.6});
  return g;
}
// A bunch: three small balls — apple red, raspberry, pink — packed under one
// stem, a leaf over them. The origin is the stem's top.
function fruitBunch(w,parent,x,y,z,r,seed){
  const g=group(parent,'Fruit bunch',x,y,z);
  const mats=[appleRed(w),slot(w,'top'),pink(w)];
  [[-.5,-.6],[.5,-.7],[0,-1.25]].forEach(([bx,by],i)=>{w.ball(r*.55,r*.52,r*.55,mats[i],g,bx*r,by*r,(i-1)*r*.12).name='Bunch ball';});
  stem(w,g,0,-r*.3,0,0,stemBrown(w),r*.1);
  leaf(w,g,0,-r*.15,r*.2,r*.9,1.1+rand(seed)*.4,{twist:(rand(seed+3)-.5)*.5});
  return g;
}
// A pile of fruit for the mounds in the .42 layer: three to six balls packed
// tight within `size` — a ring of four (two reds, a raspberry, a lime, all
// pre-saturated against the layer's pink fog) and any more heaped in the
// ring's dip — with dark leaves lying out sideways from its flanks, tips a
// little up, so the pile stays squat (about 1.45×size tall over its origin)
// and reads as fruit lying on a hill, not a plant growing out of it.
function fruitCluster(w,parent,x,y,z,size,seed,{count=3,leaves=2}={}){
  const g=group(parent,'Fruit cluster',x,y,z);
  const mats=[appleFar(w),slot(w,'top'),limeFar(w),appleFar(w)];
  for(let i=0;i<count;i++){
    const r=size*(.38+rand(seed+i+20)*.14),a=(i/4)*Math.PI*2+rand(seed+i)*.6,d=size*.4;
    if(i<4)w.ball(r,r*.95,r,mats[i%4],g,Math.cos(a)*d,Math.sin(a)*d*.35,Math.sin(a)*d*.4).name='Cluster ball';
    else w.ball(r,r*.95,r,mats[i%4],g,(rand(seed+i)-.5)*size*.3,size*.45,0).name='Cluster ball';
  }
  for(let i=0;i<leaves;i++)leaf(w,g,(i%2?.4:-.4)*size,size*.3,size*.35,size*.5,(i%2?-1:1)*(1.05+rand(seed+i+60)*.3),{mat:leafFar(w)});
  return g;
}
// The fruit under the canopy. Which kind hangs at a spot, how far it drops
// and on what is drawn from its x, so it is the same in a solo build and the
// chapter: apples about the player's head in size, a fifth pears, a quarter
// bunches; a third of them drop long on a cream string with a leaf half-way,
// the rest hang close on a dark stem. Every stem leaves the canopy through a
// tuft of two leaves at `hangY`, the piece's underside there (the stem
// itself runs on up to the curve, hidden inside the piece). The fruit only
// hangs where `floorY` (the lowest its underside may reach, the headroom over
// whatever deck is beneath) leaves room, so nothing dangles into a jump: the
// tuft shrinks or goes too, and the group may come out empty — it must
// still exist under every canopy prop.
function hangingFruit(w,parent,x,ceilY,z,ax,floorY=-Infinity,hangY=ceilY-.25){
  const g=group(parent,'Hanging fruit',x,0,z);
  for(let i=0;i<2;i++){
    const side=i?1:-1,size=Math.min(.6+rand(ax+8+i)*.25,(hangY-floorY)/1.6);if(size<.3)continue;
    leaf(w,g,side*.12,hangY,.15,size,Math.PI+side*(.5+rand(ax+10+i)*.35),{pale:i===1,twist:(rand(ax+12+i)-.5)*.6}).name='Stem leaf';
  }
  const k=rand(ax),kind=k<.55?'apple':k<.75?'pear':'bunch';
  const r=kind==='apple'?.55+rand(ax+1)*.15:kind==='pear'?.75:.6,depth=kind==='pear'?r*1.4:r*1.8;
  const shortDrop=1.2+rand(ax)*.5,longDrop=2.3+rand(ax+3)*.9;
  const long=rand(ax*1.7)<.35&&hangY-longDrop-depth>=floorY;
  const top=Math.max(hangY-(long?longDrop:shortDrop),floorY+depth);
  if(hangY-top<.45)return g;
  stem(w,g,0,top-.02,ceilY-.1,0,long?slot(w,'rope'):stemBrown(w),long?.06:.045).name=long?'Fruit string':'Fruit stem';
  if(long)leaf(w,g,0,(top+hangY)/2,.1,.45,.9+rand(ax+5)*.4,{pale:rand(ax+6)<.5});
  if(kind==='apple')fruitApple(w,g,0,top-r*.85,0,r,ax,{leaves:rand(ax+2)<.4?2:1,stemLen:0});
  else if(kind==='pear')fruitPear(w,g,0,top,0,r,ax);
  else fruitBunch(w,g,0,top,0,r,ax);
  return g;
}
// An apple as the reference draws the great tree's crown: red body, lime
// icing pooled on its crown and run down two sides, a cream stem, two leaves.
function icedApple(w,parent,x,y,z,r,seed){
  const g=group(parent,'Crown apple',x,y,z);
  w.ball(r,r*.9,r,appleRed(w),g).name='Iced apple body';
  w.ball(r*.92,r*.34,r*.92,lime(w),g,0,r*.62,0).name='Iced apple cap';
  for(let i=0;i<2;i++)drip(w,g,(i?1:-1)*r*.62,r*.55,r*.7,r*.22,r*.7,lime(w),i).name='Icing drip';
  stem(w,g,0,r*.85,r*1.6,0,branch(w),r*.09);
  for(let i=0;i<2;i++)leaf(w,g,0,r*1.5,r*.1,r*.7,(i?-1:1)*(.8+rand(seed+i)*.4),{pale:i===1,twist:(rand(seed+5+i)-.5)*.5});
  return g;
}
// The lime icing every island wears, hand-poured: a thick cap box the player
// walks on, an uneven rolled lip of beads along its front edge, and chunky
// drips that have run over it — most short, the first one or two long — each
// ending in a rounded bulb, with one run off each end face. The garden's
// frosting idiom in lime. The cap's top stays a hair above the walk plane and
// nothing on it rises past the lip.
function icingCap(w,g,W,seed,depth=3.3){
  w.box(W+.12,.6,depth,lime(w),g,W/2,-.27,0,.3).name='Icing cap';
  for(let i=0,x=.5;x<W-.4;i++,x+=.75+rand(i*3+seed)*.5){
    const bead=w.ball(.3+rand(i*3+seed)*.25,.14+rand(i*3+seed+2)*.1,.14+rand(i*3+seed+1)*.06,lime(w),g,x,-.36-rand(i*3+seed+1)*.06,depth/2-.04);
    bead.rotation.z=(rand(i*3+seed+1)-.5)*.3;bead.name='Cap bead';
  }
  const runs=[];
  for(let i=0,n=Math.max(3,Math.round(W/1.3));i<n;i++){
    const x=.6+rand(i*19+seed+3)*(W-1.2);if(runs.some(o=>Math.abs(o-x)<1))continue;runs.push(x);
    const r=.3+rand(i*5+seed+8)*.2,h=i?.5+rand(i*7+seed)**2*1.4:1.4+rand(seed+7)*.5;
    drip(w,g,x,-.42,depth/2-.15,r,h,lime(w),i).name='Icing drip';
    w.ball(r*1.1,r*.85,r*.9,lime(w),g,x,-.42-h+r*.35,depth/2-.15).name='Drip bead';
  }
  for(const [x,i] of [[-.03,1],[W+.03,0]])drip(w,g,x,-.38,.4,.28,.8+rand(seed+4+i)*.5,lime(w),i).name='Icing drip';
}

// --- islands ---------------------------------------------------------------------
// A floating island: a lime icing cap the player walks on, run over the front
// lip in fat drips, on a lumpy mint body — two paler lobes bulging out of its
// face — that tapers to a soft point below. The face is pressed with big
// half-sunk pink, raspberry and lime bumps at different heights, a lime lump
// and a pale lavender lobe sit low on the belly, leaves grow out of both
// sides and the taper, and the deck's own dressing — a crimson apple or two
// half in the icing with a leaf leaning out over the corner beside them —
// gathers at ONE end behind the walk line, a lone leaf peeking over the far
// corner, so the stretch the player stands on stays clean: scenery, never
// footing. Local coords: the deck spans 0..s.w, top at 0.
function island(w,s,g){
  g.name='Orchard island · '+s.id;
  const W=s.w,mid=W/2,seed=s.x*.37;
  icingCap(w,g,W,seed);
  w.box(W-.3,1.7,2.8,slot(w,'terrain'),g,mid,-1.2,0,.55).name='Island body';
  w.ball(W*.28,.95,1.55,slot(w,'terrain2'),g,mid-W*.24,-1.35,.05).name='Island cheek';
  w.ball(W*.26,.9,1.55,slot(w,'terrain2'),g,mid+W*.25,-1.25,.05).name='Island cheek';
  w.ball(W*.44,1.7,1.45,slot(w,'terrain2'),g,mid,-2.55,-.05).name='Island belly';
  w.ball(W*.26,1.45,.95,slot(w,'terrain'),g,mid+.15,-3.9,-.1).name='Island taper';
  w.ball(W*.11,.9,.5,slot(w,'terrain2'),g,mid+.2,-4.95,-.1).name='Island tip';
  // Bumps spread evenly along the face, each jittered from its own seed and
  // kept under the cap's lip (top ≤ −.4) and on the body box's flat face.
  const bumps=[pink(w),slot(w,'top'),lime(w),pink(w),slot(w,'top'),pink(w)],count=Math.max(4,Math.round(W/1.3));
  for(let i=0;i<count;i++){
    const r=.42+rand(i*17+seed+8)*.3,x=.9+(i+.5)/count*(W-1.8)+(rand(i*11+seed+5)-.5)*.8,y=-(.4+r*.85)-rand(i*13+seed+2)*.85;
    w.ball(r,r*.85,r*.55,bumps[i%6],g,x,y,1.4).name='Pressed bump';
  }
  w.ball(.55,.47,.33,lime(w),g,mid-W*.25,-2.6,1.1).name='Belly lump';
  // The reference's pale lobe: large, soft, lavender-white and half hidden in
  // the belly's edge — the backdrop's colour, so it never turns the frame's
  // brightest spot under the sun.
  w.ball(.8,.6,.5,slot(w,'back'),g,mid+W*.3,-3.1,.65).name='Belly lobe';
  // Rooted inside the body, tips down and outward and leaning back from the
  // walk. A narrow deck's left leaf hangs down its face instead of reaching
  // down-left: past the exit's end that reach framed the tail gap's nails.
  if(W<7)leaf(w,g,.7,-1.0,1.0,.7,Math.PI+.35,{twist:.25,tilt:.35});
  else leaf(w,g,.4,-.9,1.0,.9,2.3,{twist:.25,tilt:.35});
  leaf(w,g,W-.4,-1.05,1.0,.85,-2.2,{pale:true,twist:-.2,tilt:.35});
  leaf(w,g,mid+.6,-3.2,.9,.6,Math.PI+.35,{tilt:.3});
  // Which end the apples take: a coin toss, unless that end holds the flag
  // or the deck's middle third — where the spawn and the respawn stand — is
  // within reach. An end another deck abuts (the blob on orchard-mid) is a
  // step, not a corner: it gets one small apple and no corner leaf.
  const flag=s.checkpoint!==undefined?s.checkpoint-s.x:-Infinity,clear=x=>Math.abs(x-flag)>=1.2&&Math.abs(x-mid)>=1.5;
  const abuts=d=>(w.currentLevel?.platforms??[]).some(o=>o!==s&&Math.abs(o.y-s.y)<1.5&&Math.abs(d>0?o.x-(s.x+W):o.x+o.w-s.x)<.5);
  let dir=rand(seed+13)<.5?-1:1;if(!clear(dir>0?W-.9:.9))dir=-dir;
  const end=dir>0?W:0,step=abuts(dir),x=end-dir*.9;
  fruitApple(w,g,x,.1,-1.3,step?.25:.3,seed,{dimple:false,leaves:2,flat:true});
  if(W>=7&&!step)fruitApple(w,g,x-dir*.55,.08,-1.35,.25,seed+1,{dimple:false,leaves:1,flat:true});
  // Leaves lean out over the back corners, small enough to peek over the cap
  // rather than stand on it: one inside the apple clump, one at the far corner.
  for(const [d,size,pale] of [[dir,.6,false],[-dir,.55,true]]){
    const cx=d>0?W-.25:.25;
    if(clear(cx)&&!(d===dir&&step))leaf(w,g,cx,-.05,-1.4,size,-d*.95,{pale,twist:d*.2}).name='Crown leaf';
  }
  return true;
}

// --- ropes to the canopy ---------------------------------------------------------------
// One cream strand from a deck's centre up to the canopy. Registered with a
// ceiling anchor so world.render stretches it as a bobbing deck rises and
// falls; the swinging saucer's rope is instead tilted toward its anchor in
// animate(). The knot at its foot is a small apple — under the deck's group,
// not the rope's, so the stretch leaves it round.
function hangFrom(w,s,g,view,section,{r=.1,mat='rope',knot=true}={}){
  const mid=s.w/2,localX=(s.baseX??s.x)+mid-section.x,top=canopyY(localX),rest=Math.max(.6,top-(s.baseY??s.y)-.05);
  const rope=group(g,'Canopy rope',mid,.05,-.4);
  w.cylinder(r,rest,slot(w,mat),rope,0,rest/2,0).name='Rope strand';
  if(knot)fruitApple(w,g,mid,.2,-.4,.17,localX,{dimple:false}).name='Rope knot';
  if(!(s.kind==='lift'&&s.moveX))rope.userData.ceiling={y:top,rest,offset:.05};
  view.ropes=[rope];view.rope=rope;view.ropeLength=rest;view.platform=s;
  return view;
}

// --- saucers ----------------------------------------------------------------------
// A saucer hung from the canopy: one of the two supplied frosted bowls — mint
// or raspberry under a lemon frosting — scaled to the deck with its flat top
// on the walk plane, or, where the models are not loaded, a mint lathe bowl
// with a raspberry lip and a lemon cushion flush with the walk plane.
//
// Which bowl a saucer gets is drawn from its section-local x, so the choice
// is the same in a solo section build and in the full chapter and does not
// wander with a swinging lift: the two lifts at 26 and 31 come out different.
const saucerKey=(s,section)=>rand(((s.baseX??s.x)-section.x)*.37)<.5?'saucerMint':'saucerRaspberry';
const bowls=new Map();
function bowlGeometry(width){
  const key=width.toFixed(2);
  if(!bowls.has(key)){
    const r=width/2+.12;
    const points=[[0,-1.12],[.4,-1.1],[r*.55,-.95],[r*.85,-.6],[r,-.22],[r+.02,-.04],[r-.25,-.02],[r*.6,-.3],[.3,-.5],[0,-.52]].map(([x,y])=>new THREE.Vector2(x,y));
    bowls.set(key,new THREE.LatheGeometry(points,30));
  }
  return bowls.get(key);
}
function saucer(w,s,g,section){
  g.name='Orchard saucer · '+s.id;
  const W=s.w,mid=W/2,key=saucerKey(s,section);
  if(w.dreamAssets?.[key]){
    // The bowl is a touch wider than the deck, as the sculpted one was, so
    // its flat top — a little inside the rim — still spans the whole walk.
    dreamSaucer(w,key,g,W+.24).position.set(mid,0,0);
  }else{
    w.mesh(bowlGeometry(W),slot(w,'terrain'),g,mid,0,0).name='Saucer bowl';
    const lip=w.mesh(new THREE.TorusGeometry(W/2+.1,.13,8,40),slot(w,'top'),g,mid,-.1,0);lip.rotation.x=Math.PI/2;lip.name='Saucer lip';
    w.box(W-.4,.36,1.9,slot(w,'accent'),g,mid,-.18,0,.16).name='Saucer cushion';
  }
  return hangFrom(w,s,g,{root:g,ropes:[],bounce:0},section);
}

// --- the apples that drop ----------------------------------------------------------
// A crumbling deck is an apple on its stalk: the shipped fracture (so the
// collapse animation is untouched) as lime icing over apple red, a red body
// under it, a leaf behind the walk and a dark stalk up to the canopy. The
// whole apple goes when it breaks and grows back with the deck.
function appleDeck(w,s,g,section){
  g.name='Orchard apple · '+s.id;
  const fracture=createCrumble(w,s,g);
  for(const piece of fracture.pieces)piece.mesh.material=w.mat[piece.grain?appleRed(w):lime(w)];
  const W=s.w,mid=W/2;
  w.ball(W/2+.1,1.0,1.05,appleRed(w),g,mid,-.95,0).name='Apple body';
  leaf(w,g,mid+.6,0,-.9,.5,-.8,{pale:true}).name='Apple leaf';
  return hangFrom(w,s,g,{root:g,ropes:[],bounce:0,fracture},section,{r:.08,mat:stemBrown(w),knot:false});
}

// --- the great inverted tree ----------------------------------------------------------
// The trunk wall hangs from the canopy, wide where it meets it and narrowing
// to its foot — one cream silhouette of a tree the wrong way up, two boughs
// leaning out of the foot and the crown gathered under them: the supplied
// fruit sculpture — an iced apple with its own leaves — hung by its stem at
// four sizes, each turned a little from its own seed, or, where the model is
// not loaded, iced apples built from clay; pale leaves between. Its roots
// reach up through the canopy into the sky, each on a pivot that animate()
// sways, tipped with a raspberry bud. CROWN is [x from the trunk's centre,
// top y, z, width] per fruit: the stems vanish into the trunk's foot and the
// boughs, and every fruit hangs behind the walk plane.
const CROWN=[[-2.4,-6.3,-1.6,2.8],[0,-5.8,-2.3,3.2],[2.5,-6.2,-1.5,2.6],[1.0,-4.8,-2.9,2.2]];
function greatTree(w,s,g,view){
  g.name='Orchard great tree';
  const bark=branch(w),bud=slot(w,'top');
  const mid=s.w/2,h=s.h??6;
  const trunk=new THREE.LatheGeometry([[0,-h-.2],[.85,-h-.15],[.95,-h*.6],[1.05,-h*.3],[1.25,.1],[1.5,.4],[0,.45]].map(([x,y])=>new THREE.Vector2(x,y)),24);
  w.mesh(trunk,bark,g,mid,0,0).name='Great trunk';
  const up=new THREE.Vector3(0,1,0);
  for(const [dx,dz] of [[-2.4,-1.2],[2.4,-1.0]]){
    const from=new THREE.Vector3(mid,-h+.3,-.6),to=new THREE.Vector3(mid+dx,-h-.9,-.6+dz),dir=to.clone().sub(from);
    const bough=w.cylinder(.16,dir.length(),bark,g,(from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);
    bough.quaternion.setFromUnitVectors(up,dir.normalize());bough.name='Great bough';
  }
  const sculpted=!!w.dreamAssets?.fruit;
  for(const [x,y,z,width] of CROWN){
    if(sculpted){const fruit=dreamFruit(w,g,width);fruit.position.set(mid+x,y,z);fruit.rotation.y=(rand(x*3+y)-.5)*1.2;}
    else icedApple(w,g,mid+x,y-width*.44,z,width*.42,x*3+y);
  }
  // The sculpture brings its own leaves; the clay apples get a few between them.
  if(!sculpted)for(const [x,y,z,a] of [[-3.1,-7.2,-.7,2.4],[1,-8.1,-1,3.1],[4.3,-7.6,-.9,-2.5],[-1.4,-5.1,-.4,2.0]])
    leaf(w,g,mid+x,y,z,.55,a,{pale:true}).name='Crown leaf';
  view.roots=[];
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,t=(i+.5)/8,spread=side*(.6+rand(i+3)*1.6),lift=2.6+rand(i+11)*1.6;
    const pivot=group(g,'Great root',mid+side*(.3+rand(i)*.5),1.1+(i%3)*.35,-.6+rand(i+7)*.9);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(spread*.25,lift*.4,0),new THREE.Vector3(spread*.7,lift*.78,0),new THREE.Vector3(spread*1.15,lift,0)]);
    w.mesh(new THREE.TubeGeometry(curve,10,.13+rand(i+5)*.1,6,false),bark,pivot).name='Root tube';
    w.ball(.2,.2,.2,bud,pivot,spread*1.15,lift,0).name='Root tip';
    pivot.userData.rest=side*.12;pivot.userData.period=3+(t*1.5);pivot.userData.phase=i*.9;
    view.roots.push(pivot);
  }
  return view;
}

// --- the domes -----------------------------------------------------------------------
// Each dome is one of the supplied clay planets: the first the player meets
// stays mint, the second is raspberry. Dressed around createDreamView, never
// instead of it — the planet takes the place of the sphere's own ball, dots
// and band under the group the spin turns, so the rider still rolls it and
// the fruit goes round with them. Its fitted core orb sits on that group's
// origin at the collider's radius, so the orb IS the arc the player runs on
// and the sprouts and fruit reaching past it are scenery, never footing.
// Where the planets are not loaded (a bare rig) the sphere keeps its mint
// ball and gains a lemon equator so the spin reads even from a distance.
const PLANETS={'orchard-dome-1':'mint','orchard-dome-2':'raspberry'};
// The planet's roll about z before anyone has ridden it. The sphere rolls
// WITH the rider (whatever is under the feet at landing stays there), so the
// leaf sprout has to start clear of both the crown and the flank the route
// lands on, or a rider stands in its leaves for the whole crossing. A quarter
// turn clockwise tilts it like a planet's axis — top sprout up and to the
// right, the other down into the sky below — 45° from the crown and near 90° from
// the left flank the route arrives by. 0 would leave it upright as modelled.
const PLANET_REST=-Math.PI/4;
function dome(w,s,g){
  const view=createDreamView(w,s,g);if(!view?.dream?.sphere)return view;
  const r=s.w/2,sphere=view.dream.sphere,key=PLANETS[s.id];
  if(key&&w.dreamAssets?.[key]){
    for(const m of sphere.children.filter(c=>/^Dome (ball|dot|band)$/.test(c.name))){
      sphere.remove(m);
      // Only the band's torus is this level's own; the ball and dots share the world's sculpted sphere.
      if(!w.assetGeometry?.has(m.geometry)&&!w.baseGeometry?.has(m.geometry))m.geometry.dispose();
    }
    dreamPlanet(w,key,sphere,r).rotation.z=PLANET_REST;
    return view;
  }
  const tilt=group(sphere,'Dome equator tilt');tilt.rotation.z=.32;
  const eq=w.mesh(new THREE.TorusGeometry(r*.99,r*.07,8,44),slot(w,'accent'),tilt,0,0,0);eq.rotation.x=Math.PI/2;eq.name='Dome equator';
  return view;
}

export default {
  key:'orchard',
  dress(w,s,g){return island(w,s,g);},
  deck(w,s,g,section){
    if(s.shape)return null;
    if(s.kind==='dome')return dome(w,s,g);
    if(s.kind==='lift'||s.kind==='ledge')return saucer(w,s,g,section);
    if(s.kind==='crumble')return appleDeck(w,s,g,section);
    if(s.kind==='wall'&&s.id==='orchard-trunk')return greatTree(w,s,g,{root:g,ropes:[],bounce:0});
    return null;
  },
  // Scenery by WORLD x: the canopy (twelve supplied sculptures in six props,
  // each following the canopy curve — or, where the model is not loaded,
  // twelve raspberry balls) and the leaves and fruit under it. Nothing lies
  // under the domes and saucers: they hang over open sky, and the lavender
  // mounds of the backdrop are the only ground in sight.
  props(section,L){
    const entry=deck(L,'orchard-entry'),x0=entry?entry.x:section.x,list=[];
    // How low anything may hang at a local x: 2.6 over the highest deck within
    // reach of it — a dome's apex is its y; the formable mass counts the
    // pillar that can be pulled out of it.
    const decks=L.platforms.filter(s=>s.kind!=='wall');
    const headroom=localX=>{let top=-Infinity;for(const s of decks){if(s.x-x0>localX+2.5||s.x+s.w-x0<localX-2.5)continue;top=Math.max(top,s.y+(s.shape?5.2:0));}return top+2.6;};
    // The lemon drips' rest spots, by local x: their telegraph reads against sky, never a leaf.
    const drips=(L.enemies??[]).filter(e=>e.kind==='drip').map(e=>e.x-x0);
    // Fruit every three or four units, where nothing else hangs: ≥1.2 from
    // every rope and stalk (27.5±.5, 31.2, 32.5, the trunk 46–48.4, 59.6,
    // 64.5, 68, 71.4), ≥2.6 from the drips at 13, 64.5 and 71.4, off the
    // perch's 30–32.4, and off the prop boundaries 4+12.4n, where a value
    // would draw twice. 61.4 and 68.6 have no headroom and come out as tufts
    // or empty groups, which keeps the chain's props populated.
    const apples=[4.6,7.4,10.2,15.8,18.4,20.6,24.1,35.6,38.7,41.6,43.6,50.4,53.8,61.4,68.6,74.0];
    for(let i=0;i<6;i++){
      const localX=4+i*12.4+6.2;
      list.push({key:'canopy-'+i,x:x0+localX,w:15,y:0,z:-2.2,make(w,parent){
        const g=group(parent,'Orchard canopy'),pieces=[];
        for(const k of [0,1]){
          const seed=i*2+k,bx=localX+(k-.5)*6.2+(rand(seed)-.5)*.6;
          if(w.dreamAssets?.sculpture){
            // As modelled, bar the jitter; the second piece sits a step behind the first, as the balls did.
            const piece=dreamSculpture(w,'sculpture',g,CANOPY_WIDTH[0]+rand(seed+20)*CANOPY_WIDTH[1]);
            piece.position.set(bx-localX,canopyY(bx)-CANOPY_DROP+piece.userData.size.y/2,.6-k*.8+(rand(seed+40)-.5)*.3);
            piece.rotation.set((rand(seed+60)-.5)*CANOPY_TILT,(rand(seed+80)-.5)*CANOPY_TURN,(rand(seed+100)-.5)*CANOPY_TILT);
            pieces.push({x:piece.position.x,foot:piece.position.y-piece.userData.size.y/2,half:piece.userData.size.x/2,k});
          }else{
            const ry=2.1+rand(i*3+k)*.4,rx=3.9+rand(i+k*5)*.5;
            w.ball(rx,ry,2.8,slot(w,'foliage','top'),g,bx-localX,canopyY(bx)+ry*.62,-(k*.7)).name='Canopy ball';
            pieces.push({x:bx-localX,foot:canopyY(bx)-ry*.38,half:rx,k});
          }
        }
        // Leaves push out from under each piece, four a piece and no two
        // alike: two big ones hanging down and outward from under the rims,
        // a paler medium one from the foot, and a small one pointing
        // sideways-up out of the rim; each leans toward or away from the
        // camera and is pinched or fat from its own seed. They sit just
        // behind the walk plane — the front piece's face reaches past it —
        // so they read against the sky and never cross in front of the
        // player, and they shrink or go where the chain's decks leave them no
        // room. One whose base would land within 1.2 of a drip's rest spot
        // is pushed 1.3 past it on the side it points to, so base and tip
        // both clear the telegraph (the first drip hangs right under prop 0).
        for(const p of pieces)for(let j=0;j<4;j++){
          const side=j%2?1:-1,seed=i*7+p.k*4+j;
          let x,y,size,angle,tilt=(rand(seed+5)-.5)*.5,width=1;
          if(j<2){x=p.x+side*(p.half-.6-rand(seed)*.8);y=p.foot+.3+rand(seed+1)*.6;size=.95+rand(seed+2)*.4;angle=Math.PI+side*(.45+rand(seed+3)*.4);width=.8+rand(seed+6)*.3;}
          else if(j===2){x=p.x+(rand(seed)-.5)*2.4;y=p.foot+.2;size=.65+rand(seed+2)*.15;angle=Math.PI+side*(.85+rand(seed+3)*.3);tilt=rand(seed+5)<.5?-.4:.4;}
          else{x=p.x+side*(p.half-.3);y=p.foot+1.0+rand(seed+1)*.4;size=.45+rand(seed+2)*.15;angle=-side*(1.35+rand(seed+3)*.3);width=.75;}
          const drip=drips.find(d=>Math.abs(localX+x-d)<1.2);if(drip!==undefined)x=drip-localX+side*1.3;
          size=Math.min(size,(y-headroom(localX+x))/1.6);if(size<.35)continue;
          leaf(w,g,x,y,1.4,size,angle,{pale:j===2,twist:(rand(seed+4)-.5)*.7,tilt,width}).name='Canopy leaf';
        }
        // Each stem leaves the nearest piece at its underside there: the foot
        // at its centre, climbing toward the rim.
        for(const ax of apples){
          const dx=ax-localX;if(Math.abs(dx)>6.2)continue;
          const p=pieces.reduce((a,b)=>Math.abs(b.x-dx)<Math.abs(a.x-dx)?b:a),t=Math.min(1,Math.abs(dx-p.x)/p.half);
          hangingFruit(w,g,dx,canopyY(ax),.7,ax,headroom(ax),p.foot+.15+t*t*.6);
        }
      }});
    }
    return list;
  },
  // Far scenery: the pink bullseye centred behind the great tree, and five
  // lavender mounds in the middle distance, each with a tight pile of red,
  // raspberry and lime half sunk into its crown and a smaller one on a
  // shoulder: the harvest lying about in the hills. The .42 layer follows the
  // camera at .836 and drifts at .42 of it, so a pile keeps almost the same
  // place in the frame from every deck and what matters is what stands in
  // front of it; MOUND_Y sets each mound where its pile shows in the lower
  // third against sky. The first hides behind the entry island's body and
  // icing cap from the spawn (its top a hand under the cap's edge) and steps
  // out left of the first planet as the player climbs the domes, its fruit
  // over the crown of the chapter's own lavender blob there; the second shows
  // between the planets and, from the saucers, a unit under the first bowl.
  // The other three stay deep — their
  // piles only break the frame's foot, leafless so nothing sprouts at the
  // edge, clear of the blob's underside — and no pile ever stands beside a
  // deck at its height. Each pile sits forward on its crown's front slope
  // (the ellipsoid is 3 deep: a pile at its centre plane would be buried).
  backdrop(w,L,section,layers){
    const trunk=deck(L,'orchard-trunk'),cx=trunk?trunk.x+trunk.w/2:section.x+47;
    const far=layers.at(.3),mid=layers.at(.42);
    const eye=layers.place(far,cx,9.5,-46);eye.name='Orchard bullseye';
    for(let i=0;i<5;i++){
      const ring=w.mesh(new THREE.TorusGeometry(2.6+i*2.9,.95,6,56),i%2?slot(w,'back'):slot(w,'top'),eye,0,0,-i*.05);
      ring.scale.z=.25;ring.name='Bullseye ring';
    }
    w.ball(1.5,1.5,.4,slot(w,'accent'),eye,0,0,.1).name='Bullseye heart';
    const MOUND_X=[-.5,18,31,47,57],MOUND_Y=[-5.8,-8.1,-8.6,-8.8,-9.6];
    for(let i=0;i<5;i++){
      const g=layers.place(mid,section.x+MOUND_X[i]+rand(i+60)*1.5,MOUND_Y[i]-rand(i+61)*.5,-30);g.name='Orchard mound';
      const rx=4.5+rand(i+62)*2,ry=2.8+rand(i+64)*.6;
      w.ball(rx,ry,3,slot(w,'back'),g,0,0,0).name='Mound';
      w.ball(2.6,1.7,2.4,slot(w,'back2'),g,-rx*.6,-.6,-.3).name='Mound shoulder';
      w.ball(2.2,1.5,2.2,slot(w,'back2'),g,rx*.62,-.8,-.2).name='Mound shoulder';
      fruitCluster(w,g,(rand(i+65)-.5)*1.5,ry-.3,2.1,1.5,i*5,{count:4+Math.round(rand(i+63)*2),leaves:i<2?2:0});
      // The first mound's shoulder would peek out beside the entry island's taper: it goes bare.
      if(i)fruitCluster(w,g,(rand(i+66)<.5?-1:1)*rx*.6,.9,2.5,.8,i*5+3,{count:3,leaves:0});
    }
  },
  // Roots wave in the sky; the swinging saucer's rope stays pointed at the canopy.
  animate(w,game,dt,section,ctx){
    const tree=w.platforms?.get('orchard-trunk');
    if(tree?.roots)for(const root of tree.roots){
      const u=root.userData;
      root.rotation.z=ctx.reducedMotion?u.rest:u.rest+Math.sin(ctx.time*Math.PI*2/u.period+u.phase)*.4;
    }
    const swing=w.platforms?.get('orchard-saucer-1');
    if(swing?.rope&&swing.platform){
      const s=swing.platform,dx=(s.baseX??s.x)-s.x;
      swing.rope.rotation.z=-Math.atan2(dx,swing.ropeLength);
    }
  }
};
