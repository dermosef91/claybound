import * as THREE from '../lib/three.module.js';
import {createDreamView} from '../dream-views.js';
import {magicClayMaterial} from '../shaping-views.js';
import {clayShape,sculptClay} from '../clay.js';
import {deck,slot,rand,fixedMaterial,bulbDrip,spiralDisc,dreamCloud,attached} from './support.js';
// Section 2 — The Folding Path. The one idea is that orientation is
// negotiable: the decks are sheets of clay folded under themselves, the
// standing walls are the same sheets on end, a sheet hangs from the sky with
// its frosting underneath, and the far scenery repeats the fold three ways —
// slabs already standing, a path that closes like a book, and two pale hands
// in the haze that might have done the folding. Nothing here leans or bobs:
// stillness is what makes the folds read when they move. The one piece the
// module draws for itself is the violet tongue: a carpet of clay curled up at
// the brink that rolls out across the gap as it is pressed.
//
// Painted after its second reference: plum sheets under lime frosting that
// has run into fat glossy drips, teal spiral medallions pressed into the
// cliff faces, pink mushrooms and teal coral on the decks, and — the section
// brings its own sky (quietBackdrop) — a saturated lavender behind flat pink
// clouds, pale melting columns, pink arches and one pale sphere, with dark
// teal bushes crossing the foreground.
//
// Palette slots (applyDreamPalette): main → terrain/terrain2 (plum),
// secondary → top (lime frosting), backdrop → back/back2 (lilac haze),
// accent → accent (hot pink). Cream and dark appear only where the shared
// views already use them (fold stripes, hinges).
//
// Every coordinate on this side is WORLD: decks are looked up by id, and the
// far scenery is placed through layers.place(group, worldX, y, z).

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mats=w=>({T:slot(w,'terrain','blue'),T2:slot(w,'terrain2','blueDark'),TOP:slot(w,'top','gold'),A:slot(w,'accent','gold')});

// Colours the palette does not carry, made once and kept on w.mat (see
// fixedMaterial): the teal of the medallions, mushroom stems and coral, and
// the sky's pinks. All matte relief — the level side may not carry gloss.
const teal=w=>fixedMaterial(w,'foldingTeal',0x3fb0aa,{roughness:.6,depth:.04});
const tealDark=w=>fixedMaterial(w,'foldingTealDark',0x2f8f8a,{depth:.05});
const cloudPale=w=>fixedMaterial(w,'foldingCloudPale',0xf6c3d9,{depth:.05});
const haze=w=>fixedMaterial(w,'foldingHaze',0xf1c6e3,{depth:.03});
const paleSphere=w=>fixedMaterial(w,'foldingPaleSphere',0xe6b7db,{depth:.06});
const archPink=w=>fixedMaterial(w,'foldingArchPink',0xe9a8d4,{depth:.05});
const bushTeal=w=>fixedMaterial(w,'foldingBushTeal',0x286f6f,{roughness:.9,depth:.03});
const bushPink=w=>fixedMaterial(w,'foldingBushPink',0xe86aa6,{roughness:.9,depth:.03});

// A medallion pressed into a cliff face: a teal disc with a darker spiral of
// clay coiled on it, the way the reference's walls carry their swirls.
function medallion(w,parent,x,y,z,r){
  const disc=w.cylinder(r,.18,teal(w),parent,x,y,z);disc.rotation.x=Math.PI/2;disc.name='Medallion';
  const coil=w.mesh(spiralDisc(w),tealDark(w),parent,x,y,z+.12);coil.scale.setScalar(r*.86);coil.name='Medallion spiral';
}

// --- the rolled tongue -----------------------------------------------------------
// The shared clay view draws a station's piece as one rounded box remapped to
// its collider. The tongue is drawn here instead, as a carpet: one ribbon of
// violet clay 1.161 thick and 12.4 long at every moment, curled up beside the
// cliff at rest and rolling out to the right as it is pressed. The flat run
// lies at deck level and is the walking surface; the curl stands at the run's
// far end, wound the way a wave breaks — the carpet swells up the near side,
// over the crest, down the far side, under, and in — and pays out as it
// travels, so what stood curled at the cliff lies long across the gap. Run
// and curl together span exactly the collider's width and the curl's box is
// the rest pose; between the two poses the curl stands higher than the
// collider's top and the run lies under it, the box being one box. Wound, the
// clay lies a little thinner than the carpet and puffs back to its thickness
// as it comes out, so the curl shows a seam between its turns and a small
// hollow at its heart. One fixed grid of rings, rewritten from the platform's
// pose (poseTongue).
const SEGS=120,RADIAL=16,TONGUE={thick:1.161,wound:.8,depth:2.4,section:3.6};
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
  // Two cap centres close the ends: the root hidden in the post, the tip in the curl's heart.
  const capA=rings*RADIAL,capB=capA+1;
  for(let r=0;r<RADIAL;r++){index.push(capA,(r+1)%RADIAL,r);index.push(capB,SEGS*RADIAL+r,SEGS*RADIAL+(r+1)%RADIAL);}
  geometry.setIndex(index);
  // Room for every pose: the curl on the post and the carpet across the gap.
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
function writeRibbon(mesh,spine,thick,{depth,section}){
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
      const m=squircle(phi,section)*(1+lump(l*1.9,phi*1.1)*.03)*end;
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
  // Three streaks of frosting the carpet picked up on the lip, riding the
  // curl's shoulder; poseTongue moves them with the pose.
  const {TOP}=mats(w);
  const dashes=[0,1,2].map(()=>{const d=w.ball(.07,.24,.06,TOP,g,0,0,0);d.name='Tongue dash';d.castShadow=false;return d;});
  const view={root:g,tongue:{mesh,dashes,key:null}};
  poseTongue(view,s);
  return view;
}

// Local coordinates: the group sits at (s.x, s.y), so the collider spans
// x 0..s.w and y −s.h..0. Its underside is the carpet's underside in every
// pose (world −1.161), so the run's top is deck level, and its left edge
// slides from the curl's resting place beside the cliff back onto the lip as
// the carpet comes out. The carpet is anchored at the lip (the full pose's
// left edge) and keeps its thickness τ and length L; the curl at the box's
// far end holds whatever is still wound, S² = τ·L·(1−u) for the press's share
// u, so it fills the box at rest and is gone at full.
function poseTongue(view,s){
  const key=`${s.x}:${s.w}:${s.h}`;if(view.tongue.key===key)return;view.tongue.key=key;
  const {thick:tau,wound,depth,section}=TONGUE,{from,to}=s.shape,L=to.w,floor=-s.h;
  const u=Math.max(0,Math.min(1,(s.w-from.w)/((to.w-from.w)||1)));
  const anchor=to.x-s.x,right=s.w,S=Math.min(right-anchor,Math.sqrt(tau*L*(1-u)));
  const spine=[],thick=[],push=(x,y,t)=>{spine.push(new V(x,y,0));thick.push(t);};
  // The run keeps its top at deck level and thins from underneath, so the
  // walking surface is honest and the carpet still reads as hand-rolled.
  const yRun=t=>floor+tau-t/2,root=anchor-.35;
  const runThick=l=>tau*(1-.3*l)+tau*.1*Math.sin(Math.PI*l);
  let crest=null;
  if(S>tau*.6){
    // The curl: outer surface at S/2 for its first three quarters (so the rest
    // pose touches the box's left, top, right and bottom), then each turn
    // draws in by `pitch` — a little more than the wound thickness, so a seam
    // shows between turns — until the heart is too small to wind: the hollow.
    // A small curl winds thinner, so the last of it shrinks away rather than
    // vanishing all at once.
    const tw=Math.min(wound,S*.25),ta=Math.min(tau*.7,Math.max(.45,S*.42));
    const pitch=tw*1.1,hole=tw*.38;
    const cx=right-S/2,cy=floor+S/2,R0=S/2-ta/2;
    // The swell: the run rises through a quarter circle into the curl's near
    // flank, tangent there and heading up. While the run is still short the
    // root is sunk a little, so the rise leaves the cliff post below its
    // frosting instead of breaking up through it.
    const dip=tau*(1-smooth(u/.12));
    const ya=Math.min(yRun(ta),cy-.2)-dip,rho=cy-ya,xa=cx-R0-rho;
    const runLen=xa-root;
    if(runLen>.05){
      const n=Math.max(2,Math.ceil(runLen/.6)),blend=Math.min(1.5,runLen*.5);
      for(let i=0;i<=n;i++){
        const l=i/n,x=root+runLen*l,t=runThick(l),b=smooth((x-(xa-blend))/blend);
        push(x,yRun(t)*(1-b)+ya*b,t);
      }
      for(let i=1;i<=8;i++){const psi=i/8*Math.PI/2;push(xa+rho*Math.sin(psi),cy-rho*Math.cos(psi),ta);}
    } else {
      // The swell begins inside the cliff: start on the arc at the root.
      const psi0=Math.asin(Math.max(0,Math.min(1,(root-xa)/rho)));
      for(let i=0;i<=8;i++){const psi=psi0+(Math.PI/2-psi0)*i/8;push(xa+rho*Math.sin(psi),cy-rho*Math.cos(psi),ta);}
    }
    // Clockwise from the near flank: over the crest, down the far side, under, in.
    for(let i=1;i<600;i++){
      const th=i*Math.PI/24,phi=Math.PI-th;
      const t=ta+(tw-ta)*smooth(th/Math.PI);
      const r=S/2-t/2-pitch*Math.max(0,th-Math.PI*1.5)/(Math.PI*2);
      if(r-t/2<hole)break;
      const p=2.2+.5*smooth((r-tw)/Math.max(.01,S/2-tw));
      const q=squircle(phi,p)*r;
      push(cx+Math.cos(phi)*q,cy+Math.sin(phi)*q,t);
    }
    crest={cx,cy,R:S/2,p:2.7};
  } else {
    // Rolled out: a straight carpet, thinning toward its far end like the run.
    const end=Math.max(anchor+.4,right-tau*.2);
    for(let i=0;i<=4;i++){const l=i/4,t=runThick(l);push(root+(end-root)*l,yRun(t),t);}
  }
  writeRibbon(view.tongue.mesh,spine,thick,{depth,section});
  // The frosting streaks sit on the curl's near shoulder, along its outer
  // surface, and hide once the curl is too small to carry them.
  view.tongue.dashes.forEach((d,i)=>{
    d.visible=!!crest&&S>2.2;if(!d.visible)return;
    const phi=Math.PI-(.12+.14*i)*Math.PI,q=squircle(phi,crest.p)*(crest.R+.03);
    d.position.set(crest.cx+Math.cos(phi)*q,crest.cy+Math.sin(phi)*q,depth/2-.45);d.rotation.z=phi;
  });
}

// --- the hanging sheet ----------------------------------------------------------------
// The sheet over the cast slab: a deck hung from the sky, its frosting now on
// its underside, a walker's height and a little less over the clay — so its
// drips hang from the frosting into the air. Local coords: the wall's
// collider runs from y 0 down to −s.h across 0..s.w.
function hangingSheet(w,s,g){
  const {T,T2,TOP,A}=mats(w);g.name='Hanging sheet · '+s.id;
  const h=s.h??14.7;
  w.box(s.w+.1,h-.5,3.3,T,g,s.w/2,-h/2+.25,-.05,.5).name='Sheet body';
  w.box(s.w*.7,h*.5,3,T2,g,s.w*.42,-h*.28,-.25,.5).name='Sheet fold-under';
  w.box(s.w+.2,.5,3.6,TOP,g,s.w/2,-h+.25,0,.22).name='Sheet frosting';
  w.box(.46,1.4,3.5,TOP,g,-.02,-h+1.2,0,.2).name='Frosting lip';
  bulbDrip(w,g,-.02,-h+1.9,.9,.28,.8,TOP,1);
  bulbDrip(w,g,s.w*.3,-h+.02,1.5,.3,1.2,TOP,0);
  bulbDrip(w,g,s.w*.72,-h+.02,1.3,.22,.7,TOP,2);
  w.ball(.26,.2,.22,A,g,s.w*.6,-h+.55,1.75).name='Sheet bead';
  return {root:g};
}

// --- the folded sheet -----------------------------------------------------------
// A deck is one thick sheet of plum clay under a lime frosting cap, folded
// back under itself twice so its underside steps inward, with the frosting
// spilling over one end where the sheet was creased and running down the
// face in fat drips. Wide sheets carry a teal medallion and a lime shelf;
// every face has a few pebbles of clay pressed into it. Local coords: the
// walkable top is y 0 across 0..width; the body hangs below.
function foldedSheet(w,g,s,{lip=null,spill=null}={}){
  const {T,T2,TOP,A}=mats(w),width=s.w;
  w.box(width+.16,.5,3.6,TOP,g,width/2,-.2,0,.24).name='Sheet frosting';
  w.box(width+.04,3.2,3.3,T,g,width/2,-2.05,-.05,.6).name='Sheet body';
  const under=Math.max(1.6,width*.82),shift=lip==='right'?-1:1,ux=width/2+shift*width*.06;
  w.box(under,3,3,T2,g,ux,-5,-.25,.7).name='Sheet fold-under';
  const root=Math.max(1.2,width*.6);
  w.box(root,3.9,2.6,T,g,width/2-shift*width*.04,-8.45,-.4,.7).name='Sheet root';
  // Seeded on the deck's place as well as its width: two decks of one width
  // should not be one deck twice.
  const seed=Math.floor(width*7.3+s.x*1.7+(lip==='right'?3:lip?5:0));
  if(lip){
    const x=lip==='right'?width+.02:-.02;
    w.box(.5,1.5,3.5,TOP,g,x,-.85,0,.2).name='Frosting lip';
    bulbDrip(w,g,x,-1.55,.9,.3,.9,TOP,seed);
  }
  if(spill){
    // The frosting ran over an exposed end and down the corner.
    const x=spill==='right'?width+.04:-.04,out=spill==='right'?.12:-.12;
    w.ball(.5,.36,.6,TOP,g,x,-.5,1.3).name='Frosting spill';
    bulbDrip(w,g,x+out,-.62,1.5,.3,1.5,TOP,seed+7);
  }
  // The frosting runs over the front edge in drips, three or four to a sheet
  // with one long one, and sags between them where it has gathered.
  const n=width>=6?4:3;
  for(let i=0;i<n;i++){
    const x=width*(.12+.76*(i+rand(seed+i))/n),h=(i===1?1.9:.7)+rand(seed+i+11)*1.2,r=.26+rand(seed+i+23)*.2;
    bulbDrip(w,g,x,-.42,1.68,r,h,TOP,seed+i);
    if(i<n-1)w.ball(.42+rand(seed+i+31)*.2,.2,.24,TOP,g,x+width*.4/n,-.5,1.62).name='Frosting sag';
  }
  let mx=-9,mr=0;
  if(width>=6){
    // A medallion in the body's face, and a small lime shelf on the
    // fold-under where frosting pooled, with a bead on it.
    mx=width*(.3+.4*rand(seed+41));mr=.8+.2*rand(seed+43);
    medallion(w,g,mx,-2.15,1.62,mr);
    const lx=ux+(rand(seed+53)-.5)*under*.5;
    w.box(1.2,.3,.9,TOP,g,lx,-3.85,1.5,.12).name='Frosting shelf';
    bulbDrip(w,g,lx-.3,-4,1.75,.14,.55,TOP,seed+2);
    w.ball(.14,.12,.14,A,g,lx+.25,-3.62,1.65).name='Shelf bead';
  }
  // Pebbles of the same clay pressed into the faces, clear of the medallion.
  for(let i=0,pn=width>=6?3:2;i<pn;i++){
    let x=width*(.1+.8*rand(seed+61+i));const y=-1.1-rand(seed+71+i)*2.2,r=.3+rand(seed+81+i)*.18;
    if(Math.abs(x-mx)<mr+r+.2)x=mx+(x<mx?-1:1)*(mr+r+.3);
    if(x>r&&x<width-r)w.ball(r,r*.85,r*.5,T,g,x,y,1.45).name='Pressed pebble';
  }
  w.ball(.36,.3,.5,T,g,ux+(rand(seed+91)-.5)*under*.6,-5.2,1.1).name='Pressed pebble';
  w.ball(.28,.22,.24,A,g,width*.3,.1,-1.2).name='Sheet bead';
  w.ball(.2,.16,.18,teal(w),g,width*.72,.08,-1.25).name='Sheet bead';
}
// The lip goes where nothing abuts: seams between decks (and between sections)
// are left plain so a fold never pokes into a neighbour's face. A spill runs
// over the corner of a deck whose end stands over a gap.
const LIPS={'folding-cast-land':'right','folding-exit':'left'};
const SPILLS={'folding-land':'left','folding-cast-land':'left','folding-far':'left','folding-wall-land':'right'};

// --- the cliff post -----------------------------------------------------------------
// The wall the curled tongue stands beside: the cliff's last two courses,
// capped with frosting the tongue covers once it lies out.
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
// The shared fold view draws the turning panel (lime face, dark axle); this
// gives its hinge a block to stand on, reaching down toward the void without
// touching the hazard band's spikes.
function foldStand(w,s,g){
  const view=createDreamView(w,s,g);if(!view)return null;
  const {T,T2,A}=mats(w);
  const stand=group(g,'Fold stand',s.pivot==='right'?s.w:0,0,0);
  const h=Math.min(3.2,s.y+2);
  w.box(1.8,.6,2.6,T2,stand,0,-.5,-.2,.24).name='Fold post shoulder';
  w.box(1.2,h,2.2,T,stand,0,-.35-h/2,-.2,.34).name='Fold post';
  w.ball(.2,.16,.18,A,stand,.55,-.3,1.05).name='Post bead';
  return view;
}

// --- deck clutter -----------------------------------------------------------------
// A mushroom: a teal stem under a squashed pink cap with two cream dots,
// sized by `size`; a deck's clutter, built at its foot.
function mushroom(w,parent,size,seed){
  const g=group(parent,'Mushroom');g.rotation.z=(rand(seed)-.5)*.2;
  w.cylinder(.3*size,1.3*size,teal(w),g,0,.65*size,0).name='Mushroom stem';
  w.ball(1*size,.58*size,.9*size,slot(w,'accent','gold'),g,0,1.36*size,0).name='Mushroom cap';
  for(const [dx,dz,r] of [[-.42,.35,.17],[.33,.45,.13]])w.ball(r*size,r*.5*size,r*size,'cream',g,dx*size,1.8*size,dz*size).name='Mushroom dot';
}
// A sprig of coral: a teal stalk that forks into three rounded fingers.
function coral(w,parent,size,seed){
  const g=group(parent,'Coral');g.rotation.z=(rand(seed)-.5)*.3;
  const m=teal(w),top=.78*size;
  w.cylinder(.1*size,.8*size,m,g,0,.4*size,0).name='Coral stalk';
  for(const [ang,len] of [[.6,.42],[-.55,.4],[.05,.52]]){
    const dx=Math.sin(ang)*len*.8*size,dy=Math.cos(ang)*len*.8*size;
    const b=w.ball(.08*size,len*size,.08*size,m,g,dx,top+dy,0);b.rotation.z=-ang;b.name='Coral branch';
    w.ball(.12*size,.1*size,.12*size,m,g,Math.sin(ang)*len*1.7*size,top+Math.cos(ang)*len*1.7*size,0).name='Coral tip';
  }
}

// --- far scenery pieces -----------------------------------------------------------------
// A slab standing on end: the fold's wall pose, already happened. The
// frosting that was its top is now a vertical face on the side the player
// comes from; the dark axle at its foot is the hinge it turned on; its top has
// begun to melt. Drawn in the backdrop slots (lilac on lilac) so a slab in the
// mid-distance is read as scenery and never as a wall on the route — the
// route's own colours, plum and lime, are kept for what can be stood on.
function standingSlab(w,g,h){
  const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');g.name='Standing slab';
  w.box(.9,h,2.2,B2,g,0,h/2,0,.28).name='Slab body';
  w.box(.3,h+.1,2.4,B,g,-.55,h/2+.05,0,.12).name='Slab face';
  w.ball(.7,.3,1.3,B,g,0,h+.02,0).name='Slab melt';
  bulbDrip(w,g,.38,h-.02,.9,.18,1.1,B,1);
  const axle=w.cylinder(.22,2.4,'dark',g,0,.05,0);axle.rotation.x=Math.PI/2;axle.name='Slab hinge';
}
// A cloud cut from a sheet: three or four flat discs of pink clay overlapped.
function cutoutCloud(w,g,size,seed){
  const m=rand(seed)<.5?dreamCloud(w):cloudPale(w),z=size*.22;g.name='Cutout cloud';
  w.ball(size,size*.5,z,m,g,0,0,0).name='Cloud';
  w.ball(size*.72,size*.42,z,m,g,-size*.85,-size*.1,.05).name='Cloud';
  w.ball(size*.6,size*.36,z,m,g,size*.9,-size*.14,-.05).name='Cloud';
  if(rand(seed+1)>.4)w.ball(size*.5,size*.3,z,m,g,size*.2,size*.3,.08).name='Cloud';
}
// A column of pale clay that has begun to melt: a soft cap running down its
// sides in drips. It rises from below the frame to `top`.
function meltingColumn(w,g,width,top,drips,seed){
  const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');g.name='Melting column';
  const h=top+10;
  w.box(width,h,width,B2,g,0,top-h/2,0,width*.42).name='Column';
  w.ball(width*.74,width*.36,width*.74,B,g,0,top+.04,0).name='Column cap';
  for(let i=0;i<drips;i++){
    const a=(i+rand(seed+i))/drips*Math.PI*2,r=width*.46;
    bulbDrip(w,g,Math.cos(a)*r,top-.08,Math.sin(a)*r,width*.16+rand(seed+i+5)*width*.08,1+rand(seed+i+9)*1.4,B,seed+i);
  }
}
// An arch of pink clay in the haze, feet on the ground line.
const archShape=w=>clayShape(w,'folding-arch',()=>sculptClay(w,new THREE.TorusGeometry(1,.27,8,26,Math.PI),{amplitude:.03}));
function archway(w,g,r){
  const m=w.mesh(archShape(w),archPink(w),g,0,0,0);m.scale.set(r,r,r*.7);m.name='Haze arch';
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
  // The section brings its own sky: the chapter's placeholder blobs and
  // columns sink while the player is here.
  quietBackdrop:true,

  // Stone decks: the folded sheet in place of the chapter's rolled slab.
  dress(w,s,g){
    foldedSheet(w,g,s,{lip:LIPS[s.id]??null,spill:SPILLS[s.id]??null});
    return true;
  },

  // The curled tongue, the cliff post, the hanging sheet, the standing tile
  // and the folds' stands; everything else (the two free masses — violet, they
  // are the puzzles — the tinted ramp, thin lime ledges) keeps the shared look.
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
    // Pink mushrooms, teal coral and a pink pebble on every stone deck, the
    // reference's clutter. Still, like everything here — the section keeps
    // its no-leaners rule.
    const clutter=[
      ['folding-entry',[[1.2,.7],[6.6,.5]],[[3.9,1.1]],5.2],
      ['folding-land',[[1,.55],[4.6,.8],[6.9,.45]],[[2.6,1],[6,.8]],3.6],
      ['folding-cast-land',[[1.1,.6],[3.1,.45]],[[2.2,.9]],4.1],
      ['folding-far',[[1,.5],[3.4,.75]],[[2.2,1.1]],4.6],
      ['folding-wall-land',[[.8,.55],[3.8,.5]],[[2.3,.9]],1.6],
      ['folding-exit',[[.9,.7],[4.2,.5],[5.9,.4]],[[2.6,1],[5,.8]],3.3]];
    for(const [id,shrooms,corals,pebble] of clutter){
      const on=deck(L,id);if(!on)continue;
      shrooms.forEach(([dx,size],i)=>list.push({key:`shroom-${id}-${i}`,x:on.x+dx,y:on.y,w:2.2*size,z:-1.1,make(w,parent){mushroom(w,parent,size,on.x*3.1+i);}}));
      corals.forEach(([dx,size],i)=>list.push({key:`coral-${id}-${i}`,x:on.x+dx,y:on.y,w:1.4*size,z:-1.3,make(w,parent){coral(w,parent,size,on.x*2.3+i);}}));
      list.push({key:`pebble-${id}`,x:on.x+pebble,y:on.y,w:.8,z:-1,make(w,parent){const {A}=mats(w);w.ball(.3,.22,.28,A,parent,0,.14,0).name='Deck pebble';}});
    }
    if(ceiling){
      // The ceiling the auto ramp hangs from: a mass over the block's resting
      // place with two lime drips, so the clay reads as ceiling that sagged.
      const from=ceiling.shape?.from??ceiling;
      list.push({key:'ceiling',x:from.x+3,y:from.y,w:11,z:-.5,make(w,parent){
        const {T,T2,TOP}=mats(w);
        w.box(9.4,2.6,3.2,T,parent,0,1.3,0,.7).name='Ceiling mass';
        w.box(6.6,1.8,2.8,T2,parent,.7,3.4,-.2,.6).name='Ceiling mass upper';
        for(const [x,r,h,v] of [[2.7,.5,2,0],[-3.7,.42,1.4,1]])bulbDrip(w,parent,x,0,.3,r,h,TOP,v);
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
  // otherwise (item x = worldX·f + camera·(1−f)), so an item is on screen for
  // ≈10/f units either side of its place; and the camera's slight downward
  // tilt lifts deeper items on screen (≈ .065 per unit of depth: 1.2 u at
  // z −18, 2.35 u at z −36) — both allowed for below. Heights are authored
  // for the y-0 decks (camera ≈ .7): the high stretch sees the sky ≈ 1.5
  // lower, which is the vertical parallax doing its work.
  backdrop(w,L,section,layers){
    const mid=layers.at(.5),far=layers.at(.24),sky=layers.at(.1),x0=section.x;
    // Three slabs already standing, feet on the deck line, foreshadowing the
    // folds before one moves.
    for(const [dx,h] of [[14,5.6],[33,6.4],[55,5.8]])standingSlab(w,layers.place(mid,x0+dx,-1.2,-18),h);
    // The path that closes like a book: a flat slab floating in the haze until
    // the player passes x 36 (on the fold's deck, with the slab mid-frame),
    // then it rears up 90° about its right edge (animate()). Backdrop only — a
    // fold's wall pose is not standable, so this never sits on the route — and
    // lilac like the slabs, so a flat slab in the mid-distance is never taken
    // for a deck; far enough right that it stays out of the tongue's frame.
    {
      const g=layers.place(mid,x0+40,2.2,-18);g.name='Book slab';
      const B=slot(w,'back','cream'),B2=slot(w,'back2','cream');
      const pivot=group(g,'Book hinge');
      w.box(6,.9,2.2,B2,pivot,-3,.45,0,.28).name='Book body';
      w.box(6.1,.3,2.4,B,pivot,-3,1.05,0,.12).name='Book frosting';
      const axle=w.cylinder(.22,2.4,'dark',g,0,.05,0);axle.rotation.x=Math.PI/2;axle.name='Book hinge axle';
      w.foldingBook={pivot,progress:0,armed:false,armX:x0+36};
    }
    // A pale hand reaching down from above the frame over the high stretch,
    // as if it had just let go of the wall it toppled.
    hazeHand(w,layers.place(far,x0+73,6.6,-36),-1).rotation.z=2.9;
    // The sky. A pink haze along the horizon behind everything; flat clouds
    // in two rows at the slowest rate — that layer shows ±100 units of them
    // and packs them ten to one, so they are spread far apart and well past
    // the section; melting columns near and far; pink arches with their feet
    // on the ground line; one pale sphere high on the right of the tongue.
    for(const dx of [-30,60,150])w.ball(15,3.5,1,haze(w),layers.place(sky,x0+dx,-5.4,-48),0,0,0).name='Haze band';
    [[-20,1.5,1.7],[50,.7,1.4],[120,1.6,1.8],[190,.9,1.5],[260,1.4,1.6]]
      .forEach(([dx,y,size],i)=>cutoutCloud(w,layers.place(sky,x0+dx,y,-36),size,i));
    [[15,-1.2,1.3],[85,-.6,1.5],[155,-1.3,1.2],[225,-.7,1.4]]
      .forEach(([dx,y,size],i)=>cutoutCloud(w,layers.place(sky,x0+dx,y,-42),size,i+20));
    w.ball(2.4,2.4,1.4,paleSphere(w),layers.place(far,x0+27,3,-40),0,0,0).name='Pale sphere';
    for(const [dx,width,top,drips,seed] of [[-12,2.2,4.8,3,1],[24,1.9,2.4,3,2],[58,2.6,5.2,4,3],[94,2,3,3,4],[128,2.3,4.4,3,5]])meltingColumn(w,layers.place(far,x0+dx,0,-32),width,top,drips,seed);
    for(const [dx,width,top,drips,seed] of [[6,1.6,5.6,2,11],[28,1.4,3.2,2,12],[62,1.7,4.6,2,13],[96,1.5,3.6,2,14],[118,1.6,5,2,15]])meltingColumn(w,layers.place(mid,x0+dx,0,-20),width,top,drips,seed);
    for(const [dx,r] of [[25,2],[52,1.7],[95,2.2],[125,1.8]])archway(w,layers.place(far,x0+dx,-2.2,-34),r);
  },

  // In front of the decks: dark teal bushes with a pink bloom or two, low in
  // the frame — the depth scenery places one arrangement per stone deck and
  // fades it when it would cover the player, a deck, a hazard or a bead. The
  // bushes crest ≈ 2.5 under the deck line, so a hazard band under the deck
  // (2.5 down, guarded to 1.3) does not fade them.
  foreground(w,g,variant){
    const flip=variant%2?-1:1,t=bushTeal(w),p=bushPink(w);
    for(const [x,y,rx,ry] of [[-3.2,-1.6,1.5,1.2],[-4.6,-1.8,1,.8],[-2,-1.85,.9,.7],[4.4,-1.7,1.3,1],[5.7,-1.85,.9,.7]])
      w.ball(rx,ry,rx*.8,t,g,x*flip,y,0).name='Foreground bush';
    for(const [x,y,r] of [[-2.9,-.85,.42],[-4.3,-1.2,.3],[4.9,-1,.38]])w.ball(r,r*.8,r,p,g,x*flip,y,.3).name='Foreground bloom';
    g.traverse(o=>{if(o.isMesh)o.userData.noShadow=true;});
    return true;
  },

  // The tongue follows its collider's pose every frame (a rebuild only when
  // the pose has changed), and the book slab rears up once, after the player
  // passes x 36. Reduced motion snaps the book upright instead of turning; the
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
