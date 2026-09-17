import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {magicClayMaterial} from '../shaping-views.js';
import {clayMaterial} from '../clay.js';
import {deck,slot,rand} from './support.js';
// Section 2 — The Folding Path. The one idea is that orientation is
// negotiable: the decks are sheets of clay folded under themselves, the
// standing walls are the same sheets on end, a sheet hangs from the sky with
// its frosting underneath, and the far scenery repeats the fold three ways —
// slabs already standing, a path that closes like a book, and two pale hands
// in the haze that might have done the folding. Nothing here leans or bobs:
// stillness is what makes the folds read when they move. The one piece the
// module draws for itself is the violet tongue: a carpet of clay rolled up at
// the brink that rolls out across the gap as it is pressed.
//
// Palette slots (applyDreamPalette): main → terrain/terrain2 (plum),
// secondary → top (lime frosting), backdrop → back/back2 (pink haze),
// accent → accent (one hot-pink bead per sheet). Cream and dark appear only
// where the shared views already use them (fold stripes, hinges).
//
// Every coordinate on this side is WORLD: decks are looked up by id, and the
// far scenery is placed through layers.place(group, worldX, y, z).

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const attached=(o,scene)=>{for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
const mats=w=>({T:slot(w,'terrain','blue'),T2:slot(w,'terrain2','blueDark'),TOP:slot(w,'top','gold'),A:slot(w,'accent','gold')});

// Two colours the palette does not carry, made once and kept on w.mat so the
// streaming disposer and the level rebuild treat them as shared: the teal of
// the reference's portholes and mushroom stems, with the clay relief, and a
// glossy sky-blue for the islets' waterfalls, tagged like the river's streams
// (the relief hook would dull it: a stream is meant to shine).
const TEAL=0x4fb8b0,WATER=0x7fd6ff;
function teal(w){
  if(!w.mat.foldingTeal){const m=new THREE.MeshStandardMaterial({color:TEAL,roughness:.6,metalness:0});clayMaterial(w,m,.04);m.name='foldingTeal';w.mat.foldingTeal=m;}
  return 'foldingTeal';
}
function water(w){
  if(!w.mat.foldingWater){const m=new THREE.MeshStandardMaterial({color:WATER,roughness:.22,metalness:0,emissive:WATER,emissiveIntensity:.12});m.userData.clay={type:'gloss',requestedDepth:0,depth:0};m.name='foldingWater';w.mat.foldingWater=m;}
  return 'foldingWater';
}
// A lemon drip hanging from a frosting edge, a lathe at any size. The profile
// runs from the tip up to the rim: a lathe turned the other way faces inward.
function drip(w,parent,x,y,z,len,r,mat){
  const points=[[0,-len],[r*.24,-len*.84],[r*.6,-len*.5],[r*.92,-.22],[r,0],[0,.05]].map(([a,b])=>new THREE.Vector2(a,b));
  const mesh=w.mesh(new THREE.LatheGeometry(points,14),mat,parent,x,y,z);mesh.name='Frosting drip';return mesh;
}
// A porthole in a cliff face: a teal ring around a dark hollow, the way the
// reference's cliffs are eaten through.
function porthole(w,parent,x,y,z,r){
  const ring=w.mesh(new THREE.TorusGeometry(r,r*.32,8,22),teal(w),parent,x,y,z);ring.name='Porthole rim';
  const hollow=w.cylinder(r*.8,.16,'dark',parent,x,y,z+.1);hollow.rotation.x=Math.PI/2;hollow.name='Porthole';
}

// --- the rolled tongue -----------------------------------------------------------
// The shared clay view draws a station's piece as one rounded box remapped to
// its collider. The tongue is drawn here instead, as a carpet: one ribbon of
// violet clay 1.161 thick and 12.4 long at every moment, rolled up on the
// brink at rest and rolling out to the right as it is pressed. The flat run
// lies at deck level and is the walking surface; the roll stands on the run's
// own underside at its far end, wound the way a rug is — the carpet passes
// under it, climbs the far side, comes back over the top and winds in — and
// pays out from underneath as it travels, so what stood tall on the brink lies
// long across the gap. Run and roll together span exactly the collider's
// width and the roll's box is the rest pose; between the two poses the roll
// stands higher than the collider's top and the run lies a little under it,
// the box being one box. Wound, the clay lies tight and thin and puffs back to
// its thickness as it comes out, so the roll shows two or three layers. One
// fixed grid of rings, rewritten from the platform's pose (poseTongue).
const SEGS=120,RADIAL=16,TONGUE={thick:1.161,wound:.64,length:12.4,depth:2.4};
const V=THREE.Vector3;

function ribbonGeometry(seedX,seedY){
  const rings=SEGS+1,count=rings*RADIAL+2,geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(new Float32Array(count*3),3);position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);
  geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(count*3),3));
  // The violet skin keys its prints and glitter on the piece's own start.
  const seed=new Float32Array(count*2);for(let i=0;i<count;i++){seed[i*2]=seedX;seed[i*2+1]=seedY;}
  geometry.setAttribute('magicSeed',new THREE.BufferAttribute(seed,2));
  const index=[];
  for(let s=0;s<SEGS;s++)for(let r=0;r<RADIAL;r++){
    const a=s*RADIAL+r,b=s*RADIAL+(r+1)%RADIAL,c=(s+1)*RADIAL+r,d=(s+1)*RADIAL+(r+1)%RADIAL;
    index.push(a,b,c,b,d,c);
  }
  // Two cap centres close the ends: the root hidden in the post, the tip in the roll's core.
  const capA=rings*RADIAL,capB=capA+1;
  for(let r=0;r<RADIAL;r++){index.push(capA,(r+1)%RADIAL,r);index.push(capB,SEGS*RADIAL+r,SEGS*RADIAL+(r+1)%RADIAL);}
  geometry.setIndex(index);
  // Room for every pose: the roll on the post and the carpet across the gap.
  geometry.boundingSphere=new THREE.Sphere(new V(6.2,-2,0),9);
  return geometry;
}

// Resample a polyline (with a thickness at each point) into SEGS+1 points
// spaced evenly along its length.
function resample(points,thick){
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
  const total=lengths[lengths.length-1],out=[],width=[];
  for(let k=0,j=0;k<=SEGS;k++){
    const d=total*k/SEGS;
    while(j<points.length-2&&lengths[j+1]<d)j++;
    const span=lengths[j+1]-lengths[j]||1,u=Math.max(0,Math.min(1,(d-lengths[j])/span));
    out.push(new V().lerpVectors(points[j],points[j+1],u));width.push(thick[j]+(thick[j+1]-thick[j])*u);
  }
  return {points:out,width,total};
}

// Two slow waves, so the skin reads as pinched by hand rather than pressed by a machine.
const lump=(a,b)=>Math.sin(a*5.1+b*3.7)*.56+Math.sin(a*2.3-b*4.9)*.44;
// A squircle: a rounded square at exponent p, a circle at 2.
const squircle=(phi,p)=>{const c=Math.cos(phi),s=Math.sin(phi);return 1/Math.pow(Math.pow(Math.abs(c),p)+Math.pow(Math.abs(s),p),1/p);};
// The tip of the ribbon: full section until `from`, then a rounded end.
const taper=(u,from)=>u<=from?1:Math.max(.03,Math.sqrt(Math.max(0,1-((u-from)/(1-from))**2)));

// Write the ribbon's rings along a spine: a rounded rectangle `width[k]`
// across (in the plane) by `depth` deep, frames by parallel transport and a
// little hand noise.
function writeRibbon(mesh,spine,thick,{depth}){
  const {points,width,total}=resample(spine,thick),a=mesh.geometry.attributes.position,out=a.array;
  const T=new V(),N=new V(0,0,1),B=new V(),P=new V();
  for(let k=0;k<=SEGS;k++){
    const u=k/SEGS,l=u*total,p=points[k],end=taper(u,.965);
    T.subVectors(points[Math.min(SEGS,k+1)],points[Math.max(0,k-1)]);if(T.lengthSq()<1e-12)T.set(1,0,0);T.normalize();
    // Parallel transport: the last normal, less whatever of it now lies along the tangent.
    N.addScaledVector(T,-N.dot(T));if(N.lengthSq()<1e-8)N.set(0,0,1).addScaledVector(T,-T.z);N.normalize();
    B.crossVectors(T,N);
    for(let r=0;r<RADIAL;r++){
      const phi=r/RADIAL*Math.PI*2,c=Math.cos(phi),s=Math.sin(phi);
      // Rounded rectangle in the (depth, thickness) plane.
      const m=squircle(phi,5)*(1+lump(l*1.9,phi*1.1)*.03)*end;
      P.copy(p).addScaledVector(N,c*depth/2*m).addScaledVector(B,s*width[k]/2*m);
      const i=(k*RADIAL+r)*3;out[i]=P.x;out[i+1]=P.y;out[i+2]=P.z;
    }
  }
  const capA=(SEGS+1)*RADIAL*3,capB=capA+3;
  out[capA]=points[0].x;out[capA+1]=points[0].y;out[capA+2]=points[0].z;
  out[capB]=points[SEGS].x;out[capB+1]=points[SEGS].y;out[capB+2]=points[SEGS].z;
  a.needsUpdate=true;mesh.geometry.computeVertexNormals();
}

function rolledTongue(w,s,g){
  g.name='Rolled tongue · '+s.id;
  const from=s.shape?.from??s;
  const mesh=new THREE.Mesh(ribbonGeometry(from.x,from.y),magicClayMaterial(w));
  mesh.name='Tongue carpet';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;g.add(mesh);
  const view={root:g,tongue:{mesh,key:null}};
  poseTongue(view,s);
  return view;
}

// Local coordinates: the group sits at (s.x, s.y), so the collider spans
// x 0..s.w and y −s.h..0. Its underside is the carpet's underside: on the lip
// at rest, the carpet's depth below it at full, sinking between, so the run
// (top at τ−s.h) settles from a step above the deck onto level with it as it
// pays out. The carpet keeps its thickness τ and its length L; the flat run ℓ
// and the roll's side S obey S² = τ·(L−ℓ) (the roll holds the wound length)
// and ℓ+S = s.w (the two span the collider), which fixes ℓ for any pose.
function poseTongue(view,s){
  const key=`${s.w}:${s.h}`;if(view.tongue.key===key)return;view.tongue.key=key;
  const {thick:tau,wound,length:L,depth}=TONGUE,W=s.w,floor=-s.h;
  let lo=0,hi=L;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(mid+Math.sqrt(tau*Math.max(0,L-mid))<W)lo=mid;else hi=mid;}
  const run=Math.min(L,(lo+hi)/2),S=Math.max(0,W-run);
  // The spine: from inside the post along the underside to the middle of the
  // roll's foot, then a squircle spiral winding up the far side, back over
  // the top, down the near side and in. The outer layer hugs the roll's box
  // for its first three quarters, so the roll stands square on the run and
  // fills the collider at rest; from there each turn draws in by the wound
  // thickness. The run enters at full thickness and thins into the wind over
  // the first quarter turn.
  const spine=[new V(-.35,floor+tau/2,0)],thick=[tau];
  const cx=run+S/2,cy=floor+S/2;
  if(S>tau*.6){
    // A small roll winds thinner than the carpet, so the last curl shrinks
    // away rather than vanishing all at once; the run thins to meet it.
    const enter=Math.min(tau,Math.max(.45,S*.45)),tw=Math.min(wound,S*.25),core=tw*.5;
    if(enter<tau){spine.push(new V(cx-S/2,floor+tau/2,0));thick.push(tau);}
    spine.push(new V(cx,floor+enter/2,0));thick.push(enter);
    for(let i=1;i<600;i++){
      const th=i*Math.PI/24,phi=-Math.PI/2+th;
      const outer=S/2-tw*Math.max(0,th-Math.PI*1.5)/(Math.PI*2),t=enter+(tw-enter)*smooth(th/(Math.PI/2)),r=outer-t/2;
      if(r<core)break;
      const p=2.2+1.2*smooth((r-tw)/Math.max(.01,S/2-tw));
      const q=squircle(phi,p)*r;
      spine.push(new V(cx+Math.cos(phi)*q,cy+Math.sin(phi)*q,0));thick.push(t);
    }
  } else {spine.push(new V(Math.max(.4,W-tau*.2),floor+tau/2,0));thick.push(tau);}
  writeRibbon(view.tongue.mesh,spine,thick,{depth});
}

// --- the hanging sheet ----------------------------------------------------------------
// The sheet over the cast slab: a deck hung from the sky, its frosting now on
// its underside, a walker's height and a little less over the clay. Local
// coords: the wall's collider runs from y 0 down to −s.h across 0..s.w.
function hangingSheet(w,s,g){
  const {T,T2,TOP,A}=mats(w);g.name='Hanging sheet · '+s.id;
  const h=s.h??14.7;
  w.box(s.w+.1,h-.5,3.3,T,g,s.w/2,-h/2+.25,-.05,.5).name='Sheet body';
  w.box(s.w*.7,h*.5,3,T2,g,s.w*.42,-h*.28,-.25,.5).name='Sheet fold-under';
  w.box(s.w+.2,.5,3.6,TOP,g,s.w/2,-h+.25,0,.22).name='Sheet frosting';
  w.box(.46,1.4,3.5,TOP,g,-.02,-h+1.2,0,.2).name='Frosting lip';
  w.ball(.42,.3,.5,TOP,g,-.02,-h+2,.9).name='Frosting drip';
  w.ball(.26,.2,.22,A,g,s.w*.6,-h+.55,1.75).name='Sheet bead';
  return {root:g};
}

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
  // The frosting runs over the front edge in drips, two or three to a sheet,
  // where the reference's lime pours down every cliff.
  const seed=Math.floor(width*7.3+(lip==='right'?3:lip?5:0));
  for(let i=0,n=width>=6?3:2;i<n;i++){
    const x=width*(.15+.7*(i+rand(seed+i))/n),len=.9+rand(seed+i+11)*1.1;
    drip(w,g,x,-.42,1.68,len,.3+rand(seed+i+23)*.16,TOP);
  }
  // Wide sheets are eaten through: a teal-rimmed hollow in the body's face.
  if(width>=6)porthole(w,g,width*(.3+.4*rand(seed+41)),-2.2,1.62,.55+.25*rand(seed+43));
  w.ball(.28,.22,.24,A,g,width*.3,.1,-1.2).name='Sheet bead';
  w.ball(.2,.16,.18,teal(w),g,width*.72,.08,-1.25).name='Sheet bead';
}
// The lip goes where nothing abuts: seams between decks (and between sections)
// are left plain so a fold never pokes into a neighbour's face.
const LIPS={'folding-cast-land':'right','folding-exit':'left'};

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

// --- a mushroom -----------------------------------------------------------------
// A stem under a squashed cap with two cream dots, sized by `size` and capped
// in a palette slot; a deck's clutter, built at its foot.
function mushroom(w,parent,size,cap,seed){
  const g=group(parent,'Mushroom');g.rotation.z=(rand(seed)-.5)*.2;
  w.cylinder(.3*size,1.3*size,teal(w),g,0,.65*size,0).name='Mushroom stem';
  w.ball(1*size,.48*size,.9*size,slot(w,cap,'gold'),g,0,1.32*size,0).name='Mushroom cap';
  for(const [dx,dz,r] of [[-.42,.35,.17],[.33,.45,.13]])w.ball(r*size,r*.5*size,r*size,'cream',g,dx*size,1.7*size,dz*size).name='Mushroom dot';
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
// A coil in the haze: a path that curled instead of folding, spiralling in
// on itself like a ram's horn, its tube thinning toward the centre. Backdrop
// slots again, so a coil is never taken for a way on.
class Coil extends THREE.Curve{
  constructor(radius,turns){super();this.radius=radius;this.turns=turns;}
  getPoint(t,target=new V()){
    const a=t*this.turns*Math.PI*2,r=this.radius*(1-.82*t);
    return target.set(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*.5)*.4);
  }
}
function coil(w,g,radius,turns=2.2,thickness=.42,mat){
  const mesh=w.mesh(new THREE.TubeGeometry(new Coil(radius,turns),96,thickness,7,false),mat,g,0,0,0);
  mesh.name='Haze coil';return mesh;
}
// An islet adrift in the haze: a frosted drum on a tapered underside, a
// mushroom on top and a waterfall spilling off its rim into a ring of spray.
// Haze colours for the rock, so it never reads as a deck; only the water and
// the mushroom's cap carry colour.
function islet(w,g,size,seed){
  const B=slot(w,'back','cream'),B2=slot(w,'back2','cream'),A=slot(w,'accent','gold');g.name='Haze islet';
  w.box(size*2.2,size*.7,size*1.6,B2,g,0,-size*.35,0,size*.3).name='Islet drum';
  w.box(size*2.3,size*.28,size*1.7,B,g,0,size*.02,0,size*.12).name='Islet frosting';
  const under=[[0,-size*2.3],[size*.18,-size*2],[size*.5,-size*1.3],[size*.9,-size*.5],[size*1,0],[0,.05]].map(([a,b])=>new THREE.Vector2(a,b));
  w.mesh(new THREE.LatheGeometry(under,14),B2,g,0,-size*.6,0).name='Islet root';
  const mx=size*(-.5+rand(seed)*1);
  w.cylinder(size*.16,size*.5,teal(w),g,mx,size*.35,size*.2).name='Islet stem';
  w.ball(size*.5,size*.24,size*.42,A,g,mx,size*.62,size*.2).name='Islet cap';
  // The fall: a glossy ribbon off the rim, thinning as it drops, and the
  // spray where it ends.
  const fx=size*(.5+rand(seed+3)*.5),len=size*(2.4+rand(seed+7)*1.6);
  const fall=w.mesh(new THREE.CylinderGeometry(size*.14,size*.3,len,9,1),water(w),g,fx,-len/2+size*.1,size*.6);fall.scale.z=.45;fall.name='Waterfall';
  w.ball(size*.6,size*.16,size*.42,water(w),g,fx,-len+size*.1,size*.6).name='Spray';
  w.ball(size*.28,size*.1,size*.22,water(w),g,fx+size*.55,-len+size*.06,size*.7).name='Spray';
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

  // The twisted tongue, the cliff post, the hanging sheet, the standing tile
  // and the folds' stands; everything else (the two free masses — violet, they
  // are the puzzles — the tinted ramp, thin lemon ledges) keeps the shared look.
  deck(w,s,g){
    if(s.shape&&s.id==='folding-tongue')return rolledTongue(w,s,g);
    if(s.kind==='wall'&&s.id==='folding-tongue-post')return cliffPost(w,s,g);
    if(s.kind==='wall'&&s.id==='folding-cast-lintel')return hangingSheet(w,s,g);
    if(s.kind==='counter')return standingTile(w,s,g);
    if(s.kind==='fold')return foldStand(w,s,g);
    return null;
  },

  // Streamed scenery by world x, looked up from the decks it belongs to.
  props(section,L){
    const list=[];
    const ceiling=deck(L,'folding-ceiling'),step=deck(L,'folding-step');
    // Mushrooms on every stone deck, two or three to a deck, the reference's
    // clutter: teal stems under hot-pink or lime caps with cream dots. Still,
    // like everything here — the section keeps its no-leaners rule.
    for(const [id,spots] of [['folding-entry',[[1.2,.7],[6.6,.5]]],['folding-land',[[1,.55],[4.6,.8],[6.9,.45]]],['folding-cast-land',[[1.1,.6],[3.1,.45]]],['folding-far',[[1,.5],[3.4,.75]]],['folding-wall-land',[[.8,.55],[3.8,.5]]],['folding-exit',[[.9,.7],[4.2,.5],[5.9,.4]]]]){
      const on=deck(L,id);if(!on)continue;
      spots.forEach(([dx,size],i)=>list.push({key:`shroom-${id}-${i}`,x:on.x+dx,y:on.y,w:2.2*size,z:-1.1,make(w,parent){mushroom(w,parent,size,i%2?'top':'accent',on.x*3.1+i);}}));
    }
    if(ceiling){
      // The ceiling the auto ramp hangs from: a mass over the block's resting
      // place with two lemon drips, so the clay reads as ceiling that sagged.
      const from=ceiling.shape?.from??ceiling;
      list.push({key:'ceiling',x:from.x+3,y:from.y,w:11,z:-.5,make(w,parent){
        const {T,T2,TOP}=mats(w);
        w.box(9.4,2.6,3.2,T,parent,0,1.3,0,.7).name='Ceiling mass';
        w.box(6.6,1.8,2.8,T2,parent,.7,3.4,-.2,.6).name='Ceiling mass upper';
        for(const [x,len,r] of [[2.7,2,.5],[-3.7,1.4,.42]])drip(w,parent,x,0,.3,len,r,TOP);
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
    hazeHand(w,layers.place(far,section.x+73,7.5,-36),-1).rotation.z=2.7;
    // Coils in the haze — paths that curled instead of folding — big and far
    // behind the cast slab and the wall's bed, smaller and nearer elsewhere.
    const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');
    for(const [dx,y,z,r,layer,mat] of [[12,9,-36,4.2,far,B2],[44,7.5,-36,5,far,B],[66,11,-18,2.6,mid,B2],[92,8.5,-36,4.6,far,B2],[106,12,-18,2.2,mid,B]]){
      const g=layers.place(layer,section.x+dx,y,z);coil(w,g,r,2.2,r*.16,mat);g.rotation.z=rand(dx)*Math.PI*2;
    }
    // Islets adrift over the pits, each with its waterfall, in the mid haze.
    for(const [dx,y,size] of [[17,4.6,1.1],[41,6.8,.9],[62,3.6,1],[87,8,1.05],[101,3.2,.8]])islet(w,layers.place(mid,section.x+dx,y,-18),size,dx);
  },

  // The tongue follows its collider's pose every frame (a rebuild only when
  // the pose has changed), and the book slab rears up once, after the player
  // passes x 30. Reduced motion snaps the book upright instead of turning; the
  // tongue is state, not motion, so it needs nothing.
  animate(w,game,dt,section,ctx){
    const tongue=deck(game.level,'folding-tongue'),view=tongue&&w.platforms?.get(tongue.id);
    if(view?.tongue&&attached(view.root,w.scene))poseTongue(view,tongue);
    const book=w.foldingBook;if(!book||!attached(book.pivot,w.scene))return;
    if(!book.armed&&ctx.playerX>book.armX)book.armed=true;
    if(book.armed)book.progress=Math.min(1,book.progress+dt/1.8);
    const k=ctx.reducedMotion?(book.armed?1:0):smooth(book.progress);
    book.pivot.rotation.z=-k*Math.PI/2;
  }
};
