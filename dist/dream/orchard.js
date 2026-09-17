import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {createCrumble} from '../crumble.js';
import {dreamPlanet,dreamSaucer,dreamSculpture} from '../dream-assets.js';
import {deck,slot,rand} from './support.js';
// Section 3 — The Upside-Down Orchard (visual module).
// ONE idea: the orchard grows down. A canopy of supplied sculptures spans
// the top of the world with lemon apples under it; saucers
// hang from it on lemon ropes; the ground is a pair of clay planets in a
// lavender pool; and the great tree grows the wrong way — roots waving in the
// sky, trunk hanging, crown at the bottom. Four colours: mint (main),
// raspberry (secondary), lavender (backdrop), lemon (accent). Big simple
// shapes, restraint over detail.
//
// Hooks: dress() turns the stone decks into floating mint islands with a
// raspberry frosting; deck() dresses the domes (the supplied clay planets over
// the dream-views sphere, or a lemon equator round it where they are not
// loaded), hangs the saucers (lifts and the hanging ledges, as the supplied
// frosted bowls or a sculpted one), makes the crumbling decks into apples that
// drop off their stalks, and builds the great inverted tree on the trunk wall;
// props() lays the canopy, its apples and the pools; backdrop() puts the pink
// bullseye behind the tree and a few hanging trees in the lavender distance;
// animate() waves the roots and keeps the swinging saucer's rope pointing at
// the canopy.

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
// sides, and every rope end and apple stalk vanishes into them. Each piece is
// a little wider or narrower, turned and tilted from its own seed, so twelve
// of one model do not read as a stamp: CANOPY_WIDTH is [least, spread],
// CANOPY_TURN and CANOPY_TILT the full ranges in radians (±12° about y, ±4°
// about x and z). CANOPY_DROP is how far a piece's foot hangs below the curve
// at its centre — the ropes end ON the curve and the stalks reach to within
// half a unit of it, and the sides' undersides climb about a unit from the
// foot to the rim, so the foot hangs deeper than the sculpted balls bulged.
const CANOPY_WIDTH=[7.7,1.3],CANOPY_DROP=1.3,CANOPY_TURN=.42,CANOPY_TILT=.14;
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}

// --- islands ---------------------------------------------------------------------
// A floating island: a raspberry cap the player walks on, a mint body that
// tapers to a soft point below, frosting dripping off the front lip and two
// lemon beads at the back. Local coords: the deck spans 0..s.w, top at 0.
function island(w,s,g){
  g.name='Orchard island · '+s.id;
  const W=s.w,mid=W/2,seed=s.x*.37;
  w.box(W+.12,.46,3.3,slot(w,'top'),g,mid,-.2,0,.22).name='Island cap';
  w.box(W-.3,1.7,3.0,slot(w,'terrain'),g,mid,-1.2,0,.55).name='Island body';
  w.ball(W*.44,1.7,1.45,slot(w,'terrain2'),g,mid,-2.55,-.05).name='Island belly';
  w.ball(W*.26,1.45,.95,slot(w,'terrain'),g,mid+.15,-3.9,-.1).name='Island taper';
  w.ball(W*.11,.9,.5,slot(w,'terrain2'),g,mid+.2,-4.95,-.1).name='Island tip';
  for(let i=0;i<Math.max(2,Math.round(W/2.2));i++){
    const x=.8+rand(i*3+seed)*(W-1.6),len=.45+rand(i+seed)*.5;
    w.ball(.34,len,.26,slot(w,'top'),g,x,-.42-len*.5,1.45).name='Frosting drip';
  }
  for(let i=0;i<2;i++)w.ball(.26,.22,.22,slot(w,'accent'),g,1.1+rand(i*7+seed)*(W-2.2),.14,-1.15).name='Lemon bead';
  return true;
}

// --- ropes to the canopy ---------------------------------------------------------------
// One strand from a deck's centre up to the canopy. Registered with a ceiling
// anchor so world.render stretches it as a bobbing deck rises and falls; the
// swinging saucer's rope is instead tilted toward its anchor in animate().
function hangFrom(w,s,g,view,section,{r=.075,mat='accent',knot=true}={}){
  const mid=s.w/2,localX=(s.baseX??s.x)+mid-section.x,top=canopyY(localX),rest=Math.max(.6,top-(s.baseY??s.y)-.05);
  const rope=group(g,'Canopy rope',mid,.05,-.4);
  w.cylinder(r,rest,slot(w,mat),rope,0,rest/2,0).name='Rope strand';
  if(knot)w.ball(.2,.17,.2,slot(w,'top'),rope,0,.12,0).name='Rope knot';
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
// collapse animation is untouched) in lemon instead of grey, a lemon body under
// it and a dark stalk up to the canopy. The whole apple goes when it breaks and
// grows back with the deck.
function apple(w,s,g,section){
  g.name='Orchard apple · '+s.id;
  const fracture=createCrumble(w,s,g);
  for(const piece of fracture.pieces)piece.mesh.material=w.mat[piece.grain?slot(w,'top'):slot(w,'accent')];
  const W=s.w,mid=W/2;
  w.ball(W/2+.1,1.0,1.05,slot(w,'accent'),g,mid,-.95,0).name='Apple body';
  w.ball(.42,.16,.3,slot(w,'top'),g,mid+.5,.1,-.2).name='Apple leaf';
  return hangFrom(w,s,g,{root:g,ropes:[],bounce:0,fracture},section,{r:.06,mat:'vine',knot:false});
}

// --- the great inverted tree ----------------------------------------------------------
// The trunk wall hangs from the canopy, wide where it meets it and narrowing
// to the crown that gathers round its foot — one dark raspberry silhouette of
// a tree the wrong way up, with lemon apples in the crown. Its roots reach up
// through the canopy into the sky, each on a pivot that animate() sways.
function greatTree(w,s,g,view){
  g.name='Orchard great tree';
  const bark=slot(w,'bark','dark'),accent=slot(w,'accent');
  const mid=s.w/2,h=s.h??6;
  const trunk=new THREE.LatheGeometry([[0,-h-.2],[.85,-h-.15],[.95,-h*.6],[1.05,-h*.3],[1.25,.1],[1.5,.4],[0,.45]].map(([x,y])=>new THREE.Vector2(x,y)),24);
  w.mesh(trunk,bark,g,mid,0,0).name='Great trunk';
  for(const [x,y,z,r] of [[-2.4,-6.0,-1.8,1.7],[-.4,-6.7,-2.4,2.0],[1.9,-5.7,-1.6,1.6],[3.9,-6.5,-2.2,1.5],[.9,-4.5,-2.9,1.9]])
    w.ball(r,r*.9,r*.85,bark,g,mid+x,y,z).name='Crown ball';
  for(const [x,y,z] of [[-3.1,-7.2,-.7],[1,-8.1,-1],[4.3,-7.6,-.9],[-1.4,-5.1,-.4]])
    w.ball(.36,.4,.34,accent,g,mid+x,y,z).name='Crown apple';
  view.roots=[];
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,t=(i+.5)/8,spread=side*(.6+rand(i+3)*1.6),lift=2.6+rand(i+11)*1.6;
    const pivot=group(g,'Great root',mid+side*(.3+rand(i)*.5),1.1+(i%3)*.35,-.6+rand(i+7)*.9);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(spread*.25,lift*.4,0),new THREE.Vector3(spread*.7,lift*.78,0),new THREE.Vector3(spread*1.15,lift,0)]);
    w.mesh(new THREE.TubeGeometry(curve,10,.13+rand(i+5)*.1,6,false),bark,pivot).name='Root tube';
    w.ball(.2,.2,.2,bark,pivot,spread*1.15,lift,0).name='Root tip';
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
// right, the other down into the pool — 45° from the crown and near 90° from
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
    if(s.kind==='crumble')return apple(w,s,g,section);
    if(s.kind==='wall'&&s.id==='orchard-trunk')return greatTree(w,s,g,{root:g,ropes:[],bounce:0});
    return null;
  },
  // Scenery by WORLD x: the canopy (twelve supplied sculptures in six props,
  // each following the canopy curve — or, where the model is not loaded,
  // twelve raspberry balls), the apples under it and the lavender pool over
  // the long hazard band (the two-unit tail gap keeps its bare nails).
  props(section,L){
    const entry=deck(L,'orchard-entry'),x0=entry?entry.x:section.x,list=[];
    const pool=(key,localX,width)=>list.push({key,x:x0+localX+width/2,w:width+1,y:-2.3,z:-.25,make(w,parent){
      w.box(width+.3,1.5,3.2,slot(w,'water','blueLight'),parent,0,0,0,.5).name='Orchard pool';
    }});
    pool('pool',8,29);
    // Apples hang where nothing else does: clear of the ropes, the perch, the drips and the trunk.
    const apples=[10.2,15.8,20.6,24.1,35.6,41.4,53.8,61.4,68.6];
    for(let i=0;i<6;i++){
      const localX=4+i*12.4+6.2;
      list.push({key:'canopy-'+i,x:x0+localX,w:15,y:0,z:-2.2,make(w,parent){
        const g=group(parent,'Orchard canopy');
        for(const k of [0,1]){
          const seed=i*2+k,bx=localX+(k-.5)*6.2+(rand(seed)-.5)*.6;
          if(w.dreamAssets?.sculpture){
            // As modelled, bar the jitter; the second piece sits a step behind the first, as the balls did.
            const piece=dreamSculpture(w,'sculpture',g,CANOPY_WIDTH[0]+rand(seed+20)*CANOPY_WIDTH[1]);
            piece.position.set(bx-localX,canopyY(bx)-CANOPY_DROP+piece.userData.size.y/2,.6-k*.8+(rand(seed+40)-.5)*.3);
            piece.rotation.set((rand(seed+60)-.5)*CANOPY_TILT,(rand(seed+80)-.5)*CANOPY_TURN,(rand(seed+100)-.5)*CANOPY_TILT);
          }else{
            const ry=2.1+rand(i*3+k)*.4;
            w.ball(3.9+rand(i+k*5)*.5,ry,2.8,slot(w,'foliage','top'),g,bx-localX,canopyY(bx)+ry*.62,-(k*.7)).name='Canopy ball';
          }
        }
        for(const ax of apples){
          const dx=ax-localX;if(Math.abs(dx)>6.2)continue;
          const y=canopyY(ax)-1.15-rand(ax)*.35;
          w.cylinder(.045,.8,slot(w,'vine','dark'),g,dx,y+.65,.7).name='Apple stalk';
          w.ball(.36,.39,.34,slot(w,'accent'),g,dx,y,.7).name='Lemon apple';
        }
      }});
    }
    return list;
  },
  // Far scenery: the pink bullseye centred behind the great tree, and hanging
  // trees in lavender silhouette — the orchard going on into the distance.
  backdrop(w,L,section,layers){
    const trunk=deck(L,'orchard-trunk'),cx=trunk?trunk.x+trunk.w/2:section.x+47;
    const far=layers.at(.3),mid=layers.at(.42);
    const eye=layers.place(far,cx,9.5,-46);eye.name='Orchard bullseye';
    for(let i=0;i<5;i++){
      const ring=w.mesh(new THREE.TorusGeometry(2.6+i*2.9,.95,6,56),i%2?slot(w,'back'):slot(w,'top'),eye,0,0,-i*.05);
      ring.scale.z=.25;ring.name='Bullseye ring';
    }
    w.ball(1.5,1.5,.4,slot(w,'accent'),eye,0,0,.1).name='Bullseye heart';
    for(let i=0;i<5;i++){
      const g=layers.place(mid,section.x+6+i*15+rand(i+50)*6,15+rand(i+52)*2,-31);g.name='Far hanging tree';
      const h=3.5+rand(i+51)*2.5;
      w.box(.5,h,.5,slot(w,'back2'),g,0,-h/2,0,.2);
      w.ball(2.3,1.8,1.6,slot(w,'back2'),g,.2,-h-1.1,0);w.ball(1.5,1.2,1.2,slot(w,'back2'),g,-1.7,-h-.4,-.2);w.ball(1.2,1,1,slot(w,'back2'),g,1.9,-h-.2,-.2);
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
