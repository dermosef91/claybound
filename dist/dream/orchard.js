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
// green pears and small bunches on cocoa stems and cream strings, each through
// a tuft of leaves, more leaves pushing out from under every piece; saucers
// and the crumbling iced apples hang from it on biscuit-cream ropes knotted
// with an apple; the ground is a pair of clay planets hanging over open sky
// and floating islands under thick lime icing, their rounded mint bodies
// pressed with bubblegum, raspberry, teal, lime and lavender-white lobes; and
// the great tree grows the wrong way — roots waving in the sky, a dented
// ivory trunk hanging, tapered boughs sweeping out of its foot, the supplied
// iced-apple sculpture for a crown at the bottom. The palette's four colours
// — mint (main), raspberry (secondary), lavender (backdrop), lemon (accent) —
// carry the shapes; the fruit adds the colours it cannot reach: apple red,
// gold, lime, leaf green, cream branch. Big simple shapes, restraint over detail.
//
// Hooks: dress() turns the stone decks into the iced islands; deck() dresses
// the domes (the supplied clay planets over the dream-views sphere, or a lemon
// equator round it where they are not loaded), hangs the saucers (lifts and
// the hanging ledges, as the supplied frosted bowls or a sculpted one), makes
// the crumbling decks into iced apples that drop off their ropes, and builds the
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
// Apricot for the patch on an apple's cheek: between the coins' gold (which
// the old yellow-gold matched exactly) and the hood's orange, so a patch
// reads as fruit beside a coin and never as a coin on the apple.
const appleGold=w=>fixedMaterial(w,'orchardAppleGold',0xf29a3a,{depth:.05});
// The icing: a half-step deeper and greener than the coins and the lemon
// drip, still the island's brightest plane; no deeper than 0xbfd03c or it
// closes on the pear.
const lime=w=>fixedMaterial(w,'orchardLime',0xc9d946,{depth:.06});
// A yellow-green a step under the icing lime and two above the pale leaf, so
// a pear beside a tuft reads as fruit and not another leaf with a berry; still
// away from the drip enemy's lemon.
const pearGreen=w=>fixedMaterial(w,'orchardPear',0x9dc63c,{depth:.05});
const leafGreen=w=>fixedMaterial(w,'orchardLeaf',0x3a9236,{depth:.04});
const leafPale=w=>fixedMaterial(w,'orchardLeafLight',0x62b247,{depth:.04});
// Cocoa, never near-black: the thin stems were the only black marks in a
// pastel scene. A milk-chocolate base still lands a thin cylinder well darker
// than the cream strings, so 'dark stem = fruit, cream rope + knot = footing'
// holds; keep it warm-red in hue and no lighter than this.
const stemBrown=w=>fixedMaterial(w,'orchardStem',0x96633f,{depth:.04});
// The islands' pressings: hot bubblegum (a step lighter and less saturated
// than the palette's raspberry — a paler pink rendered the same hue and value
// as the arcs behind every island), the planets' teal, and a warm cream-white
// with the lightest shading for the pale lobe, so it renders as white clay
// pressed into the mint. The base has to carry real warmth (about 15%
// saturation): the dream's blue-white sky light and the filmic tone mapping
// pull a near-white to neutral, so a lavender base rendered as a shadow of
// the pillars and a barely-warm one as a grey pebble (the 'back' slot's
// emissive copy made it a flat pasted disc). Warmer than this and it closes
// on the biscuit ropes.
const pink=w=>fixedMaterial(w,'orchardPink',0xf4609f,{depth:.06});
const teal=w=>fixedMaterial(w,'orchardTeal',0x3a9bb3,{depth:.06});
const lobeWhite=w=>fixedMaterial(w,'orchardLobe',0xf7e9d3,{depth:.05});
// The freckle on the crumbling apples' cheek: warm enough not to read as a
// pale drip tip beside the lime tongues, lighter than the hood's orange.
const peach=w=>fixedMaterial(w,'orchardPeach',0xf0a878,{depth:.05});
// Warm biscuit cream with shading for the strings, ropes and stalks, so the
// cords do not bleach to flat white against the lavender pillars; the great
// tree's trunk, boughs and roots take a lighter warm ivory — at the trunk's
// size the biscuit rendered as khaki putty no lighter than the pillars.
const branch=w=>fixedMaterial(w,'orchardBranch',0xd6b98c,{depth:.09});
const barkCream=w=>fixedMaterial(w,'orchardBark',0xe6cfa3,{depth:.06});
// The .42 layer's pink fog washes a colour out; the mounds' fruit start
// saturated, held dark (a lighter value lands on salmon) and pushed in hue —
// pure red, yellow-lime, a raspberry the pillars' pink band cannot swallow.
const appleFar=w=>fixedMaterial(w,'orchardAppleFar',0xb01c26,{depth:.05});
const raspberryFar=w=>fixedMaterial(w,'orchardRaspberryFar',0xa31f5c,{depth:.06});
const limeFar=w=>fixedMaterial(w,'orchardLimeFar',0x9cc02c,{depth:.06});
// One apricot-gold per pile, held dark and orange-leaning so the fog does not turn it salmon.
const goldFar=w=>fixedMaterial(w,'orchardGoldFar',0xcf8a1c,{depth:.05});
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
// dimple at the crown, a yellow-gold patch half sunk in its front cheek (all
// but the rope knots, which are too small to carry one), a short dark stem
// and a leaf or two out of its base. `flat` lays the leaves out sideways,
// leaning back, for an apple sunk in a deck's icing: they hug the cap instead
// of rising to the player's head, and the patch sits further back.
function fruitApple(w,parent,x,y,z,r,seed,{leaves=1,dimple=true,stemLen=r*.7,deep=false,flat=false}={}){
  const g=group(parent,'Fruit apple',x,y,z);
  w.ball(r*1.02,r*.9,r,deep?appleDeep(w):appleRed(w),g).name='Apple body';
  if(dimple)w.ball(r*.3,r*.1,r*.3,appleDeep(w),g,0,r*.88,0).name='Apple dimple';
  if(r>=.25){const patch=w.ball(r*.5,r*.4,r*.28,appleGold(w),g,r*.48,r*.1,flat?r*.6:r*.72);patch.rotation.z=.35;patch.name='Apple patch';}
  if(stemLen>0)stem(w,g,0,r*.85,r*.85+stemLen,0,stemBrown(w),r*.16);
  for(let i=0;i<leaves;i++){
    const side=i%2?-1:1;
    // Up and outward from the stem's side, so a pair splays instead of crossing.
    leaf(w,g,side*r*.1,r*.85+stemLen*.3,r*.15,r*1.1,-side*(flat?1.25:.9+rand(seed+i)*.4),{pale:i%2===1,twist:(rand(seed+9+i)-.5)*.6,tilt:flat?-.3:0});
  }
  return g;
}
// A pear hung narrow end up from the group's origin, its stem reaching on
// above it and two leaves splayed at the stem; a crimson blush on one cheek
// and a visible cock (about 17°) about its hang point keep it a fruit, not
// the lemon drip's teardrop.
function fruitPear(w,parent,x,y,z,size,seed,{leaves=2}={}){
  const g=group(parent,'Fruit pear',x,y,z);g.rotation.z=(rand(seed+12)<.5?-1:1)*(.28+rand(seed+13)*.12);
  const m=w.mesh(pearGeo(w),pearGreen(w),g,0,-size*1.4,0);m.scale.set(size,size*1.4,size);m.name='Pear body';
  w.ball(size*.26,size*.22,size*.18,appleRed(w),g,size*.32,-size*.95,size*.36).name='Pear blush';
  stem(w,g,0,-.02,size*.5,0,stemBrown(w),size*.14);
  for(let i=0;i<leaves;i++)leaf(w,g,0,size*.2,size*.12,size*.9,(i%2?-1:1)*(1+rand(seed+i)*.4),{pale:i%2===1,twist:(rand(seed+7)-.5)*.6});
  return g;
}
// A bunch: three small berries — apple red, raspberry and, lowest and a size
// smaller, the planets' teal (a gold one hanging free in the coins' band read
// as a coin) — packed under one stem, a leaf over them. The origin is the
// stem's top.
function fruitBunch(w,parent,x,y,z,r,seed){
  const g=group(parent,'Fruit bunch',x,y,z);
  const mats=[appleRed(w),slot(w,'top'),teal(w)];
  [[-.5,-.6],[.5,-.7],[0,-1.25]].forEach(([bx,by],i)=>{const k=i===2?.45:.55;w.ball(r*k,r*k*.95,r*k,mats[i],g,bx*r,by*r,(i-1)*r*.12).name='Bunch ball';});
  stem(w,g,0,-r*.3,0,0,stemBrown(w),r*.14);
  leaf(w,g,0,-r*.15,r*.2,r*.9,1.1+rand(seed)*.4,{twist:(rand(seed+3)-.5)*.5});
  return g;
}
// A pile of fruit for the mounds in the .42 layer: three to six balls packed
// tight within `size` — a ring of four (a red, a raspberry, a lime and, at
// the front-low spot, an apricot-gold, all pre-saturated against the layer's
// pink fog) and any more heaped in the ring's dip — with dark leaves lying
// out sideways from its flanks, tips a little up, so the pile stays squat
// (about 1.45×size tall over its origin) and reads as fruit lying on a hill,
// not a plant growing out of it. The leaf is drawn at the balls' own scale —
// about one ball long, as the reference's hill fruit — so a pile at distant
// scale shows a legible leaf without two wings framing the ring.
function fruitCluster(w,parent,x,y,z,size,seed,{count=3,leaves=2}={}){
  const g=group(parent,'Fruit cluster',x,y,z);
  const mats=[appleFar(w),raspberryFar(w),limeFar(w),goldFar(w)];
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
// chapter: apples from a fist to the player's head in size, a fifth pears
// (bigger than the apples, so they read as fruit beside the leaves), a
// quarter bunches; a third of them drop long on a cream string with a leaf
// half-way, the rest hang close on a dark stem — and wherever the decks below
// leave 4.5 of room the string always drops long, so the section's idea
// comes down into the frame from beyond its top edge over the entry. Every
// stem leaves the canopy through a tuft of one to three leaves at `hangY`,
// the piece's underside there (the stem itself runs on up to the curve,
// hidden inside the piece). The fruit only hangs where `floorY` (the lowest
// its underside may reach, the headroom over whatever deck is beneath)
// leaves room, so nothing dangles into a jump: the tuft shrinks or goes too,
// and the group may come out empty — it must still exist under every canopy
// prop. A LONG string measures its room against `floorLong` too — the
// headroom over a wider reach, the saucer a player fall-jumps FROM — so a
// string never comes down into the lane onto the next deck (the short drops
// keep floorY). `noPear` turns a pear into an apple beside a lemon drip,
// whose teardrop it would mimic.
function hangingFruit(w,parent,x,ceilY,z,ax,floorY=-Infinity,hangY=ceilY-.25,{noPear=false,floorLong=floorY}={}){
  const g=group(parent,'Hanging fruit',x,0,z);
  const n=rand(ax+14)<.3?1:rand(ax+14)>.8?3:2;
  for(let i=0;i<n;i++){
    const side=i?1:-1,size=Math.min(.6+rand(ax+8+i)*.25,(hangY-floorY)/1.6);if(size<.3)continue;
    const angle=i===2?Math.PI+(rand(ax+16)-.5)*.3:Math.PI+side*(.5+rand(ax+10+i)*.35);
    leaf(w,g,i===2?0:side*.12,hangY,.15,size,angle,{pale:i===1,twist:(rand(ax+12+i)-.5)*.6,tilt:i===2?.3:0}).name='Stem leaf';
  }
  const k=rand(ax);let kind=k<.55?'apple':k<.75?'pear':'bunch';if(noPear&&kind==='pear')kind='apple';
  const r=kind==='apple'?.45+rand(ax+1)*.27:kind==='pear'?.75+rand(ax+8)*.15:.45+rand(ax+8)*.15,depth=kind==='pear'?r*1.4:r*1.8;
  const floorL=Math.max(floorY,floorLong),shortDrop=.9+rand(ax)*.9,longDrop0=2.3+rand(ax+3)*.9,room=hangY-floorL-depth,deep=room>=4.5;
  const long=deep||(rand(ax*1.7)<.35&&hangY-longDrop0-depth>=floorL),longDrop=deep?Math.min(5.2,room-1.6):longDrop0;
  const top=Math.max(hangY-(long?longDrop:shortDrop),floorY+depth);
  if(hangY-top<.45)return g;
  // Strings and pear stalks are biscuit cream, the short apple stems dark;
  // both about a sixth of an apple's width.
  const cream=long||kind==='pear';
  stem(w,g,0,top-.02,ceilY-.1,0,cream?branch(w):stemBrown(w),cream?.08:.07).name=long?'Fruit string':'Fruit stem';
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
// The lime icing every island wears, hand-poured: a thick chartreuse slab the
// player walks on, its bottom edge bulging and dipping in a row of round
// swells, and fat flattened tongues that have run over it — roughly as wide
// as long, one longer run per island, each a few degrees off plumb and
// pressed flat to the face — ending blunt, with one run off each end face.
// The swells are centred ON the slab's bottom edge with their fronts flush
// with its face and close enough to touch, so the lip undulates instead of
// shelving out as a second tier over the body. The bead that rounds a tongue
// off sits INSIDE its tip (its bottom is the tip), so nothing hangs under a
// narrowed neck. The garden's frosting idiom in lime. The cap's top stays a
// hair above the walk plane and nothing on it rises past the lip. Returns
// the tongues' x, so the island can press its bumps between them.
function icingCap(w,g,W,seed,depth=3.3){
  w.box(W+.12,.7,depth,lime(w),g,W/2,-.32,0,.32).name='Icing cap';
  const zf=depth/2-.1;
  for(let i=0,n=Math.max(3,Math.round(W/1.3));i<n;i++){
    const x=.7+(i+.5)/n*(W-1.4)+(rand(i*3+seed)-.5)*.4;
    w.ball(.55+rand(i*3+seed+1)*.3,.3+rand(i*3+seed+2)*.08,.3,lime(w),g,x,-.68,zf-.22).name='Cap swell';
  }
  // A tongue: the drip lathe hung from `y`, flattened in depth, leaning by
  // `lean`, with the bead centred .7r above its tip along the lean.
  const tongue=(x,y,z,r,h,lean,i)=>{
    const d=drip(w,g,x,y,z,r,h,lime(w),i);d.scale.set(r*1.12,h,r*.65);d.rotation.z=Math.PI+lean;d.name='Icing drip';
    const k=h-r*.7;w.ball(r*.8,r*.7,r*.55,lime(w),g,x+Math.sin(lean)*k,y-Math.cos(lean)*k,z).name='Drip bead';
  };
  const runs=[];
  for(let i=0,n=Math.max(4,Math.round(W/1.4));i<n;i++){
    const x=.7+rand(i*19+seed+3)*(W-1.4);if(runs.some(o=>Math.abs(o-x)<1.25))continue;runs.push(x);
    const r=i?.42+rand(i*5+seed+8)*.18:.34+rand(seed+8)*.06,h=i?r*(1.3+rand(i*7+seed)*.8):1.1+rand(seed+7)*.3;
    tongue(x,-.5,zf,r,h,(rand(i*7+seed+11)-.5)*.2,i);
  }
  for(const [x,i] of [[-.03,1],[W+.03,0]])tongue(x,-.45,.4,.36,.7+rand(seed+4+i)*.3,0,i);
  return runs;
}

// --- islands ---------------------------------------------------------------------
// A floating island: a lime icing cap the player walks on, run over the front
// lip in fat tongues, on a rounded mint mass — two paler cheeks bulging out
// of its face over a belly — that hangs to a soft teardrop or, on some decks,
// sits squat. The pressing is bimodal, five colours: FOUR big lobes at the
// silhouette (a bubblegum one wrapping the deck's end below the lip; lime,
// lavender-white and a small teal one stacked down the lower right flank),
// three medium bumps on the face and a few small dots lying on whatever
// curve is under them. The chapter's own foreground scenery (depth-scenery)
// hangs a mint mass with a lemon and a raspberry ball IN FRONT of every
// island's lower left, below y −2 and left of about .65 of its width, so
// nothing of the body's own goes there: the low lobes, the low dots and the
// taper's leaf all keep to the right. Every island is a mirror of the last
// about `e`, the side its edge lobe, taper and leaves take: away from the
// blob step, the tail gap's nails and any abutting deck. Leaves grow out of
// the edge lobe's flank, the far cheek and the taper; the deck's own dressing
// — a crimson apple or two half in the icing with a leaf leaning out over
// the corner beside them — gathers at the take-off end behind the walk
// line, so the landing corner and the stretch the player stands on stay
// clean: scenery, never footing. Local coords: the deck spans 0..s.w, top at 0.
function island(w,s,g){
  g.name='Orchard island · '+s.id;
  const W=s.w,mid=W/2,seed=s.x*.37;
  const runs=icingCap(w,g,W,seed);
  const abuts=d=>(w.currentLevel?.platforms??[]).some(o=>o!==s&&Math.abs(o.y-s.y)<1.5&&Math.abs(d>0?o.x-(s.x+W):o.x+o.w-s.x)<.5);
  const e=(W<7||abuts(-1))?1:-1,squat=rand(seed+22)<.45;
  // The body's bulges as [x,y,z,rx,ry,rz,slot,name]: the box face and these
  // are what every pressing is seated on.
  const mass=[
    [mid-W*.24,-1.35,.05,W*.28,.95,1.55,'terrain2','Island cheek'],[mid+W*.25,-1.25,.05,W*.26,.9,1.55,'terrain2','Island cheek'],
    squat?[mid,-2.5,-.05,W*.48,1.85,1.45,'terrain2','Island belly']:[mid,-2.55,-.05,W*.44,1.7,1.45,'terrain2','Island belly'],
    squat?[mid-e*.15,-3.55,-.1,W*.28,1.05,.95,'terrain','Island taper']:[mid-e*.15,-3.9,-.1,W*.26,1.45,.95,'terrain','Island taper']
  ];
  if(!squat)mass.push([mid-e*.2,-4.95,-.1,W*.11,.9,.5,'terrain2','Island tip']);
  w.box(W-.3,1.7,2.8,slot(w,'terrain'),g,mid,-1.2,0,.55).name='Island body';
  for(const [x,y,z,rx,ry,rz,mat,name] of mass)w.ball(rx,ry,rz,slot(w,mat),g,x,y,z).name=name;
  // Where the body's front is at (x,y): the box face or the proudest bulge's
  // surface there, or null off every one of them.
  const faceZ=(x,y)=>{
    let z=x>.3&&x<W-.3&&y>-2.0&&y<-.4?1.4:-Infinity;
    for(const [cx,cy,cz,rx,ry,rz] of mass){const u=(x-cx)/rx,v=(y-cy)/ry,q=1-u*u-v*v;if(q>=.15)z=Math.max(z,cz+rz*Math.sqrt(q));}
    return z>-Infinity?z:null;
  };
  // The four lobes: the pink one — a wide flat wad whose outer end droops off
  // the deck's corner — wraps the box's end and bulges past the deck end
  // (pulled in where another deck abuts), top under the lip; the low three
  // stack down the right flank, each seated into the surface under it — lime
  // on the belly, lavender-white at its lower edge, teal on the taper's flank.
  // Every pressing here and below gets its own lean, squash and sink from its
  // seed (distinct offsets per loop), so the islands read thumbed into the
  // clay rather than glued on; the cheeks, belly and faceZ() stay as they are.
  const edgeX=mid+e*(W/2-(abuts(e)?.95:.35));
  const edge=w.ball(.88,.52,.5,pink(w),g,edgeX,-1.55,.95);edge.rotation.z=-e*.3;edge.name='Pressed lobe';
  for(const [i,[mat,r,ky,x,y,z0]] of [[lime(w),.85,.8,W*.8,-2.55,.7],[lobeWhite(w),.7,.8,W*.8,-3.75,.5],[teal(w),.45,.85,W*.7,squat?-4.35:-4.6,.4]].entries()){
    const z=faceZ(x,y),m=w.ball(r,r*ky,r*.6,mat,g,x,y,z===null?z0:z-r*(.1+rand(seed+i*5+46)*.25));m.name='Pressed lobe';
    m.rotation.set((rand(seed+i*5+45)-.5)*.3,0,(rand(seed+i*5+44)-.5)*1.0);m.scale.x*=.85+rand(seed+i*5+47)*.35;m.scale.y*=.8+rand(seed+i*5+48)*.35;
  }
  // Three medium bumps on the box face — raspberry, teal, bubblegum in an
  // order drawn per deck — with their tops under the lip's lowest swell and
  // off the tongues: each starts in its third of the width and steps
  // sideways until it is .7 clear of every run and .9 of the last bump, so
  // the pressing shows between the pour instead of under it. Each is pressed
  // to its own depth — one nearly whole, one half-buried.
  const bumps=[slot(w,'top'),teal(w),pink(w)],shift=Math.floor(rand(seed+23)*3),placed=[];
  for(let i=0;i<3;i++){
    const r=.38+rand(i*17+seed+8)*.14,x0=1.0+(i+.5)/3*(W-2)+(rand(i*11+seed+5)-.5)*.7,y=-(1.05+r*.85)-rand(i*13+seed+2)*.35;
    const free=x=>x>=1.0&&x<=W-1.0&&runs.every(o=>Math.abs(o-x)>=.7)&&placed.every(o=>Math.abs(o-x)>=.9);
    const x=[0,.2,-.2,.4,-.4,.6,-.6,.8,-.8,1,-1,1.2,-1.2].map(o=>x0+o).find(free)??x0;placed.push(x);
    const m=w.ball(r,r*.85,r*.55,bumps[(i+shift)%3],g,x,y,1.4-r*(.05+rand(i*5+seed+56)*.3));m.name='Pressed bump';
    m.rotation.set((rand(i*5+seed+55)-.5)*.3,0,(rand(i*5+seed+54)-.5)*1.0);m.scale.x*=.85+rand(i*5+seed+57)*.35;m.scale.y*=.8+rand(i*5+seed+58)*.35;
  }
  // Four small dots pressed flat onto whatever is under them — the box face,
  // a cheek or the belly's curve — discs, not marbles; one that lands off
  // every surface, or behind the foreground mass, is skipped.
  const dots=[pink(w),slot(w,'top'),teal(w),lime(w)];
  for(let i=0;i<4;i++){
    const r=.14+rand(i*7+seed+32)*.1,x=.9+rand(i*7+seed+30)*(W-1.8),y=-1.0-rand(i*7+seed+31)*2.3,z=faceZ(x,y);
    if(z===null||(y<-2&&x<W*.68))continue;
    const m=w.ball(r,r*.9,r*.45,dots[i],g,x,y,z+r*.08);m.name='Pressed dot';m.rotation.z=(rand(i*5+seed+64)-.5)*.8;m.scale.x*=.85+rand(i*5+seed+67)*.35;
  }
  // Leaves rooted inside the body, tips down and outward, leaning back from
  // the walk: one out of the edge lobe's outer flank; one from the far cheek
  // — hanging straight down the face where the deck is narrow or another
  // deck meets that end (the exit's reach framed the tail gap's nails, the
  // middle deck's would run into the blob); and, on a teardrop island, one
  // low on the taper's right flank under the teal lobe, where it shows.
  const farEnd=e>0?0:W;
  leaf(w,g,edgeX+e*.4,-1.7,1.1,.9,-e*2.3,{pale:e>0,twist:-e*.2,tilt:.35});
  if(W<7||abuts(-e))leaf(w,g,farEnd+e*.7,-1.0,1.0,.7,Math.PI+e*.35,{twist:e*.25,tilt:.35});
  else leaf(w,g,farEnd+e*.4,-.95,1.0,.9,e*2.25,{pale:e<0,twist:e*.2,tilt:.35});
  if(!squat)leaf(w,g,W*.6,-5.0,(faceZ(W*.6,-5.0)??.5)+.05,.6,Math.PI+.45,{tilt:-.2});
  // The apples take the take-off end (the route runs left to right on every
  // island) unless that end holds the flag or the deck's middle third —
  // where the spawn and the respawn stand — is within reach. An end another
  // deck abuts (the blob on orchard-mid) is a step, not a corner: it gets one
  // small apple and no corner leaf.
  const flag=s.checkpoint!==undefined?s.checkpoint-s.x:-Infinity,clear=x=>Math.abs(x-flag)>=1.2&&Math.abs(x-mid)>=1.5;
  const dir=clear(W-.9)?1:-1,end=dir>0?W:0,step=abuts(dir),x=end-dir*.9;
  fruitApple(w,g,x,.1,-1.3,step?.25:.3,seed,{dimple:false,leaves:2,flat:true});
  if(W>=7&&!step)fruitApple(w,g,x-dir*.55,.08,-1.35,.25,seed+1,{dimple:false,leaves:1,flat:true});
  // One leaf leans out over the back corner inside the apple clump, small
  // enough to peek over the cap rather than stand on it; the landing corner
  // stays bare.
  const cx=dir>0?W-.25:.25;
  if(clear(cx)&&!step)leaf(w,g,cx,-.05,-1.4,.6,-dir*.95,{twist:dir*.2}).name='Crown leaf';
  return true;
}

// --- ropes to the canopy ---------------------------------------------------------------
// One biscuit-cream strand from a deck's centre up to the canopy (the 'rope'
// slot's untinted cream bleached white on the lavender pillars). Registered
// with a ceiling anchor so world.render stretches it as a bobbing deck rises
// and falls; the swinging saucer's rope is instead tilted toward its anchor
// in animate(). The knot at its foot is a small apple — under the deck's
// group, not the rope's, so the stretch leaves it round. Every cream rope
// with a knot is footing; every dark stem is fruit.
function hangFrom(w,s,g,view,section,{r=.1,mat=branch(w),knot=true}={}){
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
  // Leaves hang down and outward under the rim, behind the walk, tips below
  // the rim so the landing edge stays crisp; siblings of the bowl, riding its
  // swing and bob — but never on a side with another deck a head's reach
  // under it (the perch's right end over saucer-2, root-1's over the first
  // crumble) or the formable mass's pulled reach (the pillar under the
  // hanging saucer's approach), where one would hang beside a player standing
  // there or across the line they jump. How many hang, and which side, is
  // drawn per bowl from its section-local x, so a row of them is not one
  // ornament stamped five times; a lone leaf grows a little. A bowl with a
  // deck under BOTH rims (the perch over saucer-2) still gets dressed, as
  // every bowl in the reference is: one small blade standing up and outward
  // off its left rim behind the walk, tip under the walk plane and off the
  // deck's span — the detour arrives from saucer-2 on the right, so nothing
  // lands there.
  const under=side=>{const ex=(s.baseX??s.x)+(side>0?W:0);return (w.currentLevel?.platforms??[]).some(o=>{if(o===s||o.kind==='wall')return false;const top=o.y+(o.shape?5.2:0),pad=o.shape?1.5:0,ox=o.baseX??o.x;return top<s.y&&s.y-top<3&&ox-pad<ex+1.2&&ox+o.w+pad>ex-1.2;});};
  const lx=((s.baseX??s.x)-section.x)*.53,free=[-1,1].filter(side=>!under(side)),k=rand(lx+5),sides=free.length<2?free:k<.35?[-1]:k<.7?[1]:free;
  for(const side of sides){
    const lone=sides.length===1,size=lone?(side<0?.72:.68):(side<0?.6:.5),jit=(rand(lx+6)-.5)*.24;
    leaf(w,g,side<0?-.1:W+.1,side<0?-.45:-.5,-.9,size,Math.PI+side*.72+jit,{pale:(k>.5)===(side>0),twist:-side*.2,tilt:.3}).name='Saucer leaf';
  }
  if(!sides.length)leaf(w,g,-.1,-.3,-.9,.45,1.25,{pale:k<.5,twist:.2,tilt:-.2}).name='Saucer leaf';
  return hangFrom(w,s,g,{root:g,ropes:[],bounce:0},section);
}

// --- the apples that drop ----------------------------------------------------------
// A crumbling deck is an iced apple on the same cream rope and knot as the
// saucers, as the reference hangs its walkable apples from cream boughs: the
// shipped fracture (so the collapse animation is untouched) as lime tiles
// over a ROUND apple — a red ball about twice as tall as the tiles are wide,
// its outline bulging past their ends — a lime dome of icing cresting its
// shoulder from under the tiles and pouring down each flank of the
// silhouette, three flat tongues lying on the curve of the cheek, two peach
// freckles on the bare red between them, and a pale leaf hanging steeply
// from the rim on the side AWAY from the next footing in the chain, so no
// tip points at a landing corner. Everything is a child of the deck's group,
// so the whole apple goes when it breaks and grows back with the deck.
function appleDeck(w,s,g,section){
  g.name='Orchard apple · '+s.id;
  const fracture=createCrumble(w,s,g);
  for(const piece of fracture.pieces)piece.mesh.material=w.mat[piece.grain?appleRed(w):lime(w)];
  const W=s.w,mid=W/2,seed=(s.baseX??s.x)*.61;
  w.ball(W/2+.2,1.35,1.15,appleRed(w),g,mid,-1.35,0).name='Apple body';
  w.ball(W/2+.22,.45,1.15,lime(w),g,mid,-.72,0).name='Icing skirt';
  // A tongue hung from (x,y,z), flattened in depth, its bead centred .7r
  // above the tip; `back` leans it about x so the tip follows the body's curve.
  const tongue=(x,y,z,r,h,i,back=0)=>{
    const d=drip(w,g,x,y,z,r,h,lime(w),i);d.scale.set(r*1.1,h,r*.6);d.rotation.x=back;d.name='Icing drip';
    const k=h-r*.7;w.ball(r*.8,r*.7,r*.55,lime(w),g,x,y-k,z-k*back).name='Drip bead';
  };
  for(const [ox,r,h,i,z] of [[-.6,.32,1.3,0,1.0],[.65,.28,.95,1,.98],[-1.05,.24,.7,0,.75]])tongue(mid+ox,-.85,z,r,h,i,.12);
  // One run down each side of the outline, off the skirt's rim, as icingCap runs off its end faces.
  for(const side of [-1,1])tongue(mid+side*(W/2+.08),-.78,.25,.26,.75+rand(seed+side)*.2,side>0?0:1);
  // Two freckles on bare red: between the two long runs, and low on the right cheek.
  w.ball(.3,.26,.13,peach(w),g,mid+.15,-1.75,1.05).name='Apple freckle';
  w.ball(.18,.16,.1,peach(w),g,mid+.9,-2.15,.6).name='Apple freckle';
  // The leaf roots just outside the skirt's rim (the round body swallows
  // anything rooted inside its outline) and BEHIND the walk plane — the rim
  // is only .35 deep at that x, so a root at z −.3 still reads as growing
  // from it — leaning back as it hangs steeply down and out, so the whole
  // blade stays behind the player stepping off the end (crumb-2's hangs on
  // the side of the fall onto the exit island).
  const next=(w.currentLevel?.platforms??[]).some(o=>o!==s&&Math.abs(o.y-s.y)<1.5&&o.x>=s.x+W&&o.x<=s.x+W+2.5),side=next?-1:1;
  leaf(w,g,mid+side*(W/2+.1),-.5,-.3,.55,-side*2.7,{pale:side>0,twist:side*.2,tilt:.45}).name='Apple leaf';
  return hangFrom(w,s,g,{root:g,ropes:[],bounce:0,fracture},section);
}

// --- the great inverted tree ----------------------------------------------------------
// The trunk wall hangs from the canopy, wide where it meets it and narrowing
// to its foot with a waist and a swell on the way — one warm-ivory silhouette
// of a tree the wrong way up, dented like the rest of the clay — two thick
// boughs sweeping down and out of the foot's flanks, each from the knot where
// it was pressed onto the foot, tapering the whole way to a small rolled tip
// past the outer fruit's shoulder, dressed with a few leaves and a raspberry
// berry, and the crown gathered under them: the supplied fruit sculpture — an
// iced apple with its own leaves — hung by its stem at four sizes, each
// turned a little from its own seed, or, where the model is not loaded, iced
// apples built from clay; pale leaves between. Its roots reach up through the
// canopy into the sky, each on a pivot that animate() sways, tipped with a
// raspberry bud. CROWN is [x from the trunk's centre, top y, z, width] per
// fruit: the stems vanish into the trunk's foot and the boughs (the outer two
// run through a bough's centreline .05 over the stem's top, a step behind the
// fruit's plane so the apple hangs in front; the middle one's icing is just
// kissed by the bough passing over it), and every fruit hangs behind the
// walk plane.
const CROWN=[[-2.4,-6.3,-1.6,2.8],[0,-5.8,-2.3,3.2],[2.5,-6.2,-1.5,2.6],[1.0,-4.8,-2.9,2.2]];
const TRUNK=h=>[[0,-h-.2],[.85,-h-.15],[1.0,-h*.8],[.9,-h*.55],[1.08,-h*.36],[.97,-h*.16],[1.25,.1],[1.5,.4],[0,.45]].map(([x,y])=>new THREE.Vector2(x,y));
// A bough's tube, tapered ring by ring: TubeGeometry lays 17 rings of 9
// vertices with ring i centred on the curve at i/16, so each ring is scaled
// about its centre from 1.15 at the foot to .6 at the tip (r .37 → .19).
// Keyed into the clay cache — sculptClay caches by geometry object, so an
// inline tube would be re-sculpted on every stream-in.
function boughGeometry(w,key,curve){
  return clayShape(w,key,()=>{
    const tube=new THREE.TubeGeometry(curve,16,.32,8,false),p=tube.attributes.position,c=new THREE.Vector3();
    for(let i=0;i<=16;i++){
      curve.getPointAt(i/16,c);const k=1.15-.55*(i/16);
      for(let j=0;j<=8;j++){const v=i*9+j;p.setXYZ(v,c.x+(p.getX(v)-c.x)*k,c.y+(p.getY(v)-c.y)*k,c.z+(p.getZ(v)-c.z)*k);}
    }
    return sculptClay(w,tube,{amplitude:.06});
  });
}
function greatTree(w,s,g,view){
  g.name='Orchard great tree';
  const bark=barkCream(w),bud=slot(w,'top');
  const mid=s.w/2,h=s.h??6;
  const trunk=clayShape(w,'orchard-trunk:'+h.toFixed(2),()=>sculptClay(w,new THREE.LatheGeometry(TRUNK(h),24),{amplitude:.1,subdivide:true,maxEdge:.7}));
  w.mesh(trunk,bark,g,mid,0,0).name='Great trunk';
  for(const [side,[cx,cy,cz]] of [[-1,CROWN[0]],[1,CROWN[2]]]){
    // One sweep down and out from inside the foot — no level stretch at the
    // pillar's height — so over the middle fruit the tube's underside only
    // kisses its icing.
    const from=new THREE.Vector3(mid,-h+.9,-.6),to=new THREE.Vector3(mid+cx,cy+.05,cz-.15),d=to.clone().sub(from);
    const pts=[from,from.clone().addScaledVector(d,.3).add(new THREE.Vector3(0,-.15,0)),from.clone().addScaledVector(d,.68),to,to.clone().add(new THREE.Vector3(side*.7,-.2,0))];
    const curve=new THREE.CatmullRomCurve3(pts);
    w.mesh(boughGeometry(w,'orchard-bough:'+(side<0?'L':'R')+':'+h.toFixed(2),curve),bark,g).name='Great bough';
    w.ball(.22,.19,.22,bark,g,pts[4].x,pts[4].y,pts[4].z).name='Bough tip';
    w.ball(.5,.4,.48,bark,g,mid+side*.8,-h+.75,-.5).name='Bough knuckle';
    // Two leaves hanging down-outward and one standing up-outward along the
    // bough, behind the walk plane, and a raspberry berry stuck under its middle.
    for(const [t,size,rise,pale] of [[.42,.85,false,false],[.6,.6,true,true],[.78,.75,false,true]]){
      const p=curve.getPointAt(t);
      leaf(w,g,p.x+side*.1,p.y+(rise?.1:-.22),p.z+.15,size,rise?-side*1.2:Math.PI+side*(.55+rand(side*7+t*10)*.3),{pale,twist:(rand(side*9+t*10)-.5)*.6,tilt:rise?-.2:.25}).name='Bough leaf';
    }
    const b=curve.getPointAt(.5);
    w.ball(.16,.15,.16,bud,g,b.x,b.y-.34,b.z+.18).name='Bough berry';
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
    // How low anything may hang at a local x: 2.6 over the highest deck
    // surface inside a window 2.5 to the right of it and `back` to the left.
    // A dome's route y is its CROWN (dream-views hangs the sphere at (r,−r)
    // and simulation.js's domeSurface is y − r + √(r² − d²)), and the highest
    // point of its arc inside the window counts — the flank under a spot
    // beyond its edge is no measure of where a player's head is. A bobbing
    // lift counts at the top of its bob; the formable mass counts the pillar
    // that can be pulled out of it. The long strings pass `back` 4.5, the
    // side the route arrives from: a fall-jump off a saucer carries the head
    // that far, and a dome's crown only enters a window that reaches it (the
    // first planet at 10 stays out of the 7.4 string's).
    const decks=L.platforms.filter(s=>s.kind!=='wall');
    const headroom=(localX,back=2.5)=>{
      let top=-Infinity;
      for(const s of decks){
        const x=s.x-x0;if(x>localX+2.5||x+s.w<localX-back)continue;
        if(s.kind==='dome'){const r=s.w/2,cx=x+r,d=Math.max(0,localX-back-cx,cx-localX-2.5);top=Math.max(top,s.y-r+Math.sqrt(Math.max(0,r*r-d*d)));}
        else top=Math.max(top,s.y+(s.shape?5.2:0)+(s.moveY||0));
      }
      return top+2.6;
    };
    // The lemon drips' rest spots, by local x: their telegraph reads against
    // sky, never a leaf, and a pear (the drip's own teardrop) never hangs beside one.
    const drips=(L.enemies??[]).filter(e=>e.kind==='drip').map(e=>e.x-x0);
    // Fruit every three or four units, where nothing else hangs: ≥1.2 from
    // every rope and stalk (27.5±.5, 31.2, 32.5, the trunk 46–48.4, 59.6,
    // 64.5, 68, 71.4), ≥2.6 from the drips at 13, 64.5 and 71.4, off the
    // perch's 30–32.4, and off the prop boundaries 4+12.4n, where a value
    // would draw twice. 23.0 and 25.2 are a staggered pair on the second
    // dome's shoulder — a string and a pear, the pear the only one the dome
    // stretch draws (the first's is turned by the drip at 13); 39.6 is the
    // string that comes down over orchard-mid between the flag and the
    // spawn, over its coin (41.6, with no headroom over the blob, is gone);
    // 61.4 and 68.6 have no headroom and come out as tufts or empty groups,
    // which keeps the chain's props populated. Nothing under 2.6 of a dome's
    // crown, and nothing over the spawn.
    const apples=[7.4,10.2,15.8,18.4,23.0,25.2,35.6,37.6,39.6,43.6,50.4,53.8,61.4,68.6,74.0];
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
          hangingFruit(w,g,dx,canopyY(ax),.7,ax,headroom(ax),p.foot+.15+t*t*.6,{noPear:drips.some(d=>Math.abs(d-ax)<4),floorLong:headroom(ax,4.5)});
        }
      }});
    }
    return list;
  },
  // Far scenery: the pink bullseye centred behind the great tree, and five
  // lavender mounds in the middle distance, each with a tight pile of red,
  // raspberry, lime and one gold half sunk into its crown and a smaller one
  // on a shoulder: the harvest lying about in the hills. The piles are drawn
  // at distant scale — a ball about a third of a canopy apple on screen, the
  // reference's ratio — so the hills layer behind the play plane instead of
  // heaping fruit at the islands' feet. The .42 layer follows the
  // camera at .836 and drifts at .42 of it, so a pile keeps almost the same
  // place in the frame from every deck and what matters is what stands in
  // front of it; MOUND_Y sets each mound where its pile shows in the lower
  // third against sky. The first hides behind the entry island's body and
  // icing cap from the spawn (its top a hand under the cap's edge) and steps
  // out left of the first planet as the player climbs the domes, its fruit
  // over the crown of the chapter's own lavender blob there; the second shows
  // between the planets and, from the saucers, well under the first bowl —
  // a smaller pile, so its balls do not read as a small planet beside it.
  // The other three stay deep — their rings show whole just above the frame's
  // foot with one dark leaf lying sideways, so the balls read as fruit, not
  // pebbles, and nothing sprouts at the edge (the third is lifted a step for
  // that: from the saucers it stands left of the first bowl, where a lower
  // setting cut its ring at the foot) — clear of the blob's underside, and no
  // pile ever stands beside a deck at its height. Each pile sits
  // forward on its crown's front slope (the ellipsoid is 3 deep: a pile at
  // its centre plane would be buried).
  backdrop(w,L,section,layers){
    const trunk=deck(L,'orchard-trunk'),cx=trunk?trunk.x+trunk.w/2:section.x+47;
    const far=layers.at(.3),mid=layers.at(.42);
    const eye=layers.place(far,cx,9.5,-46);eye.name='Orchard bullseye';
    for(let i=0;i<5;i++){
      const ring=w.mesh(new THREE.TorusGeometry(2.6+i*2.9,.95,6,56),i%2?slot(w,'back'):slot(w,'top'),eye,0,0,-i*.05);
      ring.scale.z=.25;ring.name='Bullseye ring';
    }
    w.ball(1.5,1.5,.4,slot(w,'accent'),eye,0,0,.1).name='Bullseye heart';
    // The fourth sits a step lower than the others' rise: from the blob its
    // pile would otherwise touch the violet underside.
    const MOUND_X=[-.5,18,31,47,57],MOUND_Y=[-5.8,-8.1,-7.1,-8.3,-8.8];
    for(let i=0;i<5;i++){
      const g=layers.place(mid,section.x+MOUND_X[i]+rand(i+60)*1.5,MOUND_Y[i]-rand(i+61)*.5,-30);g.name='Orchard mound';
      const rx=4.5+rand(i+62)*2,ry=2.8+rand(i+64)*.6;
      w.ball(rx,ry,3,slot(w,'back'),g,0,0,0).name='Mound';
      w.ball(2.6,1.7,2.4,slot(w,'back2'),g,-rx*.6,-.6,-.3).name='Mound shoulder';
      w.ball(2.2,1.5,2.2,slot(w,'back2'),g,rx*.62,-.8,-.2).name='Mound shoulder';
      fruitCluster(w,g,(rand(i+65)-.5)*1.5,ry-.3,2.1,i===0?1.1:i===1?.9:1.0,i*5,{count:4+Math.round(rand(i+63)*2),leaves:i<2?2:1});
      // The first mound's shoulder would peek out beside the entry island's taper: it goes bare.
      if(i)fruitCluster(w,g,(rand(i+66)<.5?-1:1)*rx*.6,.9,2.5,.55,i*5+3,{count:3,leaves:0});
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
