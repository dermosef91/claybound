import * as THREE from '../lib/three.module.js';
import {sectionDecks,deck,lean,slot,rand,fixedMaterial,cone,drip,leaf,stem,rim,lid,attached,Spiral,spiralDisc} from './support.js';
import {clayShape,sculptClay} from '../clay.js';
import {createCrumble} from '../crumble.js';
import {dreamFlower,dreamArch,dreamPillar,dreamMountain,dreamPebbles} from '../dream-assets.js';
import {cloudModel} from '../clouds.js';
// Section 1 — The Crooked Garden, after its two paintings. ONE idea: it looks
// like any other chapter — terracotta clay under green frosting that has run
// over the lips, a mushroom to bounce on, a pink sky of clouds and swirls, a
// pink pool with cream cones, a clay arch — except that the flowers have an
// eye where the heart should be, and they watch you. Walk under the arch and
// the palette flips (dist/routes/dream-sections/garden.js carries four
// entries: familiar → candy → hotter → the violet that hands over to the
// Folding Path) and the same shapes go wrong: the frosting drips longer and
// turns lime, the faces of the decks marble and grow pores and eyes, the
// floating pads are eyes that blink shut, the flower heads snap and the sky
// coils.
//
// The decks, the pads, the spring, the slime and the sky's ribbons and coils
// are built from the world's clay primitives in the palette slots (main →
// terrain/terrain2, secondary → top/foliage/bark/vine, backdrop → back/back2,
// accent → accent) plus a few fixed colours the palette cannot reach (the
// slime, the clouds' pinks). Everything that stands about them is a supplied
// model (dist/dream-assets.js): the flower, rigged there with a pupil the
// model lacks, a lid, a head on its own pivot and a root the leaners turn; the
// gate; and the garden's scenery — a pink clay pillar under a frosting cap, a
// pile of pastel pebbles, and a terracotta spire with a waterfall down its
// face — placed whole, by depth, with the clouds the chapters share. They keep
// the colours they were painted in, so the flip re-inks the decks around them
// and leaves them standing as they were: the one part of the garden that does
// not go wrong.
//
// Hooks (dream.js): dress() builds the stone decks — the familiar body before
// the arch, the same body gone strange after it; foreground() heaps pebbles in
// front of them; deck() dresses the floating pads, the eye pads (pulse), the
// snapping flower heads (crumble), the mushroom spring and the flowerbed's
// trough; props() streams the flowers, the pebble piles and the arch by WORLD
// x; hazard() draws the pink pools and the slime under the bed; backdrop()
// places the far spires, pillars and clouds; animate() moves every eye, lid
// and petal.

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

// --- colours the palette cannot reach ------------------------------------------
// All of them clay with the relief hook (tests/scene.mjs holds every surface
// near a spawn to it); the slime asks for the shiniest the relief shader
// allows, a soft sheen rather than gloss.
const slime=w=>fixedMaterial(w,'gardenSlime',0xf05aa6,{roughness:.4,depth:.03});
const slimeLight=w=>fixedMaterial(w,'gardenSlimeLight',0xf78ac0,{roughness:.4,depth:.03});
// The sky's pinks: the ribbon's and one coil's, and the other coil's peach.
// The clouds themselves are the supplied model in a slighter wash (see
// softCloud below).
const cloud=w=>fixedMaterial(w,'gardenCloud',0xf09fcb,{depth:.05});
const peach=w=>fixedMaterial(w,'gardenPeach',0xf6b48f,{depth:.05});
const petal=w=>fixedMaterial(w,'dreamPetal',0xe8598a,{depth:.06});
const pupilInk=w=>fixedMaterial(w,'dreamPupil',0x1a1416,{roughness:.35,depth:.02});
// The boards' lilac, pressed into the deck faces as pebbles.
const lilac=w=>fixedMaterial(w,'gardenLilac',0xb493d8,{depth:.06});
// The mushroom caps' soft pink — the floating pads and the spring — kept apart
// from the accent the flowers use.
const capPink=w=>fixedMaterial(w,'gardenCap',0xea8db7,{depth:.06});
// The clouds' wash: the shared ivory cloud takes its colours from its map, so
// a tint on a clone of its material is a multiply — these are barely off
// white, which keeps the cloud reading as the chapters' own cloud, seen
// through the garden's pink air rather than repainted.
const CLOUD_TINTS={pink:0xf6d0e2,lilac:0xe2d3f1};

// --- where the arch stands -----------------------------------------------------------
// The palette flips at the arch's centre, 3.75 into the arch deck; everything
// left of it is the familiar world. Decks and hazards ask which side they are.
const ARCH_IN=3.75;
const archX=L=>{const m=deck(L,'garden-mound');return m?m.x+ARCH_IN:Infinity;};
const familiar=(w,x)=>x<archX(w.currentLevel);

// --- the animated registry ---------------------------------------------------------
// Eyes, eye pads and snapping heads are built inside streamed
// groups and moved per frame by animate(); each entry is dropped once its
// group has left the scene.
const registry=w=>w.gardenAnim??={eyes:[],pads:[],snaps:[]};
const FORWARD=new THREE.Vector3(0,0,1),worldPosition=new THREE.Vector3(),direction=new THREE.Vector3(),scratch=new THREE.Vector3(),turn=new THREE.Quaternion();
const BLINK=.28;
// An eye: `gaze` is a group at the eyeball's centre whose +z carries the pupil,
// so turning it aims the pupil; `lid` swings from -π/2 (open) to +π/2 (shut);
// `head` is an optional pivot that turns toward the player as well; `wake` is
// a world x the player must pass before the eye opens at all.
function watch(w,{gaze,lid:shut,head=null,pupil=null,seed=0,wake=null}){
  registry(w).eyes.push({gaze,lid:shut,head,pupil,pupilScale:pupil?pupil.scale.clone():null,wake,period:4.5+rand(seed)*3.5,phase:rand(seed+9)*5});
}
// A glossy pupil with a glint riding on it, `pr` across, `z` out from the
// eye's centre along the gaze.
function pupilOf(w,parent,pr,z){
  const pupil=w.ball(pr,pr,pr*.55,pupilInk(w),parent,0,0,z);pupil.name='Pupil';
  w.ball(.3,.3,.15,'cream',pupil,-.4,.45,.9).name='Glint';
  return pupil;
}
// A clay eye built from primitives: a cream ball, the gaze group with a glossy
// pupil, and a lid in the given colour. `r` is the eyeball's radius; the whole
// thing faces +z. Returns its parts for whoever animates it besides watch().
function clayEye(w,parent,x,y,z,r,lidMaterial,seed,extra={}){
  const g=group(parent,'Eye',x,y,z);
  w.ball(r,r*.94,r*.72,'cream',g,0,0,0).name='Eyeball';
  const gaze=group(g,'Gaze'),pupil=pupilOf(w,gaze,r*.36,r*.66);
  const shut=w.mesh(lid(w),lidMaterial,g,0,0,0);shut.scale.set(r*1.08,r*1.02,r*.8);shut.rotation.x=-Math.PI/2;shut.name='Eyelid';
  watch(w,{gaze,lid:shut,pupil,seed,...extra});
  return {group:g,gaze,pupil,lid:shut};
}

// --- curves for tubes ---------------------------------------------------------------
class Helix extends THREE.Curve{
  constructor(r,height,turns){super();this.r=r;this.height=height;this.turns=turns;}
  getPoint(t,o=new THREE.Vector3()){const a=t*this.turns*Math.PI*2,r=this.r*(1-t*.55);return o.set(Math.cos(a)*r,t*this.height,Math.sin(a)*r);}
}
// The scroll at a deck's end: a fat snail curl of frosting, about half a unit across.
const scroll=w=>clayShape(w,'garden-scroll',()=>sculptClay(w,new THREE.TubeGeometry(new Spiral(.08,.5,2.15),64,.12,8,false),{amplitude:.02}));
const tendril=w=>clayShape(w,'garden-tendril',()=>sculptClay(w,new THREE.TubeGeometry(new Helix(.42,1.6,2.2),40,.09,6,false),{amplitude:.02}));
const coil=w=>clayShape(w,'garden-coil',()=>sculptClay(w,new THREE.TubeGeometry(new Spiral(.6,4.2,1.75),96,.62,8,false),{amplitude:.03}));
// A ribbon cloud: a long wave of clay that hooks into a curl at its far end,
// tapering toward both ends so the curl reads. TubeGeometry lays its rings
// along the path at i/segments, so each ring is pulled toward its own centre
// by the taper after the fact.
const RIBBON=[[0,0],[3,.6],[6.5,-.2],[10,.5],[13,-.1],[15.2,.45],[16.5,-.2],[16.4,-1.05],[15.5,-1],[15.4,-.45]];
const ribbon=w=>clayShape(w,'garden-ribbon',()=>{
  const path=new THREE.CatmullRomCurve3(RIBBON.map(([x,y])=>new THREE.Vector3(x,y,0)),false,'centripetal',.6);
  const segments=110,radial=9,geo=new THREE.TubeGeometry(path,segments,.5,radial,false),p=geo.attributes.position,centre=new THREE.Vector3();
  for(let i=0;i<=segments;i++){
    const t=i/segments,taper=.7+.5*Math.sin(Math.min(1,t/.85)*Math.PI)*(1-t*.35);
    path.getPointAt(t,centre);
    for(let j=0;j<=radial;j++){const k=i*(radial+1)+j;p.setXYZ(k,centre.x+(p.getX(k)-centre.x)*taper,centre.y+(p.getY(k)-centre.y)*taper,centre.z+(p.getZ(k)-centre.z)*taper);}
  }
  geo.computeVertexNormals();
  return sculptClay(w,geo,{amplitude:.03});
});

// --- terrain -------------------------------------------------------------------------
// The body every other chapter's decks are made of (environments.js's plain
// terrain, copied rather than imported so this module makes no cycle), after
// the boards: columns of three pressed courses — wide soft panels — under a
// thick frosting cap whose lip overhangs the face, hung with pointed leaves,
// a snail curl of frosting at each end, and pink and lilac pebbles pressed
// into the face. After the arch the same body is dressed strange: longer
// leaves, marbling streaks, a spiral pressed into the face, pores, a tendril,
// and an eye in the face of the two big decks.
function body(w,s,g,{weird=false}={}){
  const width=s.w,columns=Math.max(2,Math.ceil(width/2.7)),rows=3,rowH=10.4/rows;
  for(let i=0;i<columns;i++){
    const cw=width/columns,depth=3.25+rand(i+s.x)*.15;
    for(let row=0;row<rows;row++)w.box(cw+.15,rowH+.2,depth+(row%2)*.06,(i+row)%3===1?'terrain2':'terrain',g,(i+.5)*cw,-.18-(row+.5)*rowH,-.03,.4).name='Clay course';
  }
  w.box(width+.24,.62,3.72,'top',g,width/2,-.24,.05,.28).name='Frosting cap';
  const leaves=Math.max(2,Math.round(width/(weird?1.2:1.6)));
  for(let i=0;i<leaves;i++){
    const x=.6+rand(i*3+s.x)*(width-1.2),h=(weird?1.2:.6)+rand(i*7+s.x)*(weird?.8:.5),r=.2+rand(i*5+s.x)*.08;
    leaf(w,g,x,-.42,1.74,r,h,'top',i);
  }
  for(const [x,side] of [[-.08,-1],[width+.08,1]]){
    const curl=w.mesh(scroll(w),'top',g,x+side*.32,-.6,1.5);curl.rotation.y=side*.35;curl.rotation.z=side>0?.4:Math.PI-.4;curl.name='Frosting scroll';
    w.ball(.26,.22,.2,'top',g,x+side*.1,-.42,1.6).name='Scroll root';
  }
  for(let i=0;i<Math.max(2,Math.round(width/3));i++){
    const r=.24+rand(i*17+s.x)*.1;
    w.ball(r,r*.85,.12,i%2?'accent':lilac(w),g,.9+rand(i*19+s.x)*(width-1.8),-1.4-rand(i*23+s.x)*5.5,1.66).name='Pressed pebble';
  }
  if(!weird)return;
  // Marbling: two soft streaks of the accent colour pressed across the face.
  for(const [x,y,len,tilt] of [[width*.3,-2.2,width*.5,-.12],[width*.65,-5.1,width*.42,.09]]){
    const m=w.box(len,.34,.22,'accent',g,x,y,1.62,.15);m.rotation.z=tilt;m.name='Marbling';
  }
  const disc=w.mesh(spiralDisc(w),'accent',g,width*.5+(rand(s.x)-.5)*width*.3,-3.4,1.66);disc.scale.setScalar(.9+rand(s.x*3)*.4);disc.name='Spiral';
  for(let i=0;i<3;i++)w.ball(.22,.19,.12,'dark',g,.8+rand(i*11+s.x)*(width-1.6),-1.4-rand(i*13+s.x)*6,1.66).name='Pore';
  const curl=w.mesh(tendril(w),'vine',g,width-.8,.05,-.6);curl.name='Tendril';
  if(s.id==='garden-dock'||s.id==='garden-exit')clayEye(w,g,width*.5,-1.55,1.62,.62,'terrain2',s.x*7);
}

// --- mushroom parts ------------------------------------------------------------------------
// The boards' mushroom: a cream stem that flares at the foot, a flattened
// cap whose rim rolls under onto a cream gill disc, and cream plates pressed
// into the top. Only the two mushrooms a player stands on are left — the
// spring and the floating pads' caps — so these parts build nothing else.
// `cap` builds everything above the stem about (x,y), the cap's centre, with
// radii rx/ry/rz; the plates ([dx,dz,r] in fractions of the radii) sit on the
// ellipsoid's surface.
const PLATES=[[-.42,.3,.2],[.35,.45,.16],[.15,-.4,.18],[-.05,.02,.13]];
function cap(w,g,x,y,rx,ry,rz,material,dot,plates=PLATES){
  w.ball(rx,ry,rz,material,g,x,y,0).name='Mushroom cap';
  const roll=w.mesh(rim(w),material,g,x,y-ry*.45,0);roll.rotation.x=Math.PI/2;roll.scale.set(rx*.94,rz*.9,ry*1.2);roll.name='Mushroom rim';
  w.ball(rx*.84,ry*.3,rz*.84,'cream',g,x,y-ry*.5,0).name='Mushroom gills';
  for(const [dx,dz,r] of plates){
    const yy=y+ry*Math.sqrt(Math.max(0,1-dx*dx-dz*dz))-.02;
    w.ball(r,.06,r*.85,dot,g,x+dx*rx,yy,dz*rz).name='Mushroom plate';
  }
}
// A stem of the given height from (x,y), leaning by `bend`; returns where its
// top landed so the cap can sit on it.
function mushroomStem(w,g,x,y,r,height,bend){
  const st=w.mesh(stem(w),'cream',g,x,y,0);st.scale.set(r,height,r);st.rotation.z=bend;st.name='Mushroom stem';
  return {x:x-Math.sin(bend)*height,y:y+Math.cos(bend)*height};
}

// --- deck dressings ----------------------------------------------------------------------
// A floating pad before the arch: a mushroom's cap lying in the air — its
// flat top the walk plane, plates pressed into it, the rim rolled under, a
// cream stalk stub hanging from its middle and green leaves pinched along
// its lip. A box, not a dome, so a foot at the edge never floats.
function floatPad(w,s,g){
  g.name='Garden floating pad · '+s.id;
  const cx=s.w/2,pink=capPink(w);
  w.box(s.w+.1,.5,2.4,pink,g,cx,-.25,0,.24).name='Pad cap';
  const roll=w.mesh(rim(w),pink,g,cx,-.44,0);roll.rotation.x=Math.PI/2;roll.scale.set(cx+.02,1.16,.9);roll.name='Pad rim';
  for(const [dx,dz,r] of PLATES)w.ball(r*1.1,.06,r*.95,'cream',g,cx+dx*(cx-.2),0,dz*.9).name='Pad plate';
  drip(w,g,cx,-.5,0,.55,1.35,'cream',0);
  for(let i=0;i<3;i++)leaf(w,g,.55+i*(s.w-1.1)/2,-.4,1.02,.24,.65+rand(i*3+s.x)*.3,'top',i);
  leaf(w,g,cx+.6,-.4,-.95,.2,.55,'top',1);
  return {root:g};
}
// An eye pad: a lidded eyeball lying in the pool's air with its top at the
// walk plane. The frosting cap IS the lid — a hemisphere hinged at the eye's
// centre that animate() swings down over the pupil through the pulse's
// warning window and holds shut while the pad is gone. world.render squashes
// the root to a quarter and ghosts every mesh while the pulse is off, so
// nothing here swaps materials, and no scaled mesh is a phase signal.
function eyePad(w,s,g){
  g.name='Garden eye pad · '+s.id;
  const radii=new THREE.Vector3(s.w/2+.1,.62,.86),cx=s.w/2,cy=-.6;
  w.ball(radii.x,radii.y,radii.z,'cream',g,cx,cy,0).name='Eyeball';
  const rim=w.mesh(new THREE.TorusGeometry(1,.08,8,36),'top',g,cx,cy,.25);rim.scale.set(radii.x*1.02,radii.y*1.02,1);rim.name='Eye rim';
  // The eyeball is no sphere, so the pupil is set on the ellipsoid by
  // animate() rather than swung on a gaze group.
  const eye=group(g,'Gaze',cx,cy,0),pupil=pupilOf(w,eye,radii.x*.3,0);pupil.position.z=radii.z*.9;
  const shut=w.mesh(lid(w),'top',g,cx,cy,0);shut.scale.set(radii.x*1.06,radii.y*1.06,radii.z*1.04);shut.rotation.x=-Math.PI/2;shut.name='Eye lid';
  for(let i=0;i<2;i++)drip(w,g,cx+(i?.7:-.7),cy-.5,.55,.16,.5+i*.2,'top',i);
  registry(w).pads.push({s,eye,pupil,radii,lid:shut,k:0});
  return {root:g};
}
// Petal hinge angles: drooping at rest, folded up over the eye when shut.
const PETAL_REST=-.55,PETAL_SHUT=1.75;
// A snapping flower: a crumbling deck dressed as a flower head lying face up.
// The engine's fracture pieces stay (retinted, so the collapse animation is
// untouched) as the head's disc; around them a ring of petals on hinges, and
// on top an eye that watches you land. animate() folds the petals inward and
// shuts the eye as the deck's timer runs, and drops the crown with the pieces.
function snappingFlower(w,s,g){
  g.name='Garden snapping flower · '+s.id;
  const fracture=createCrumble(w,s,g);
  for(const piece of fracture.pieces){piece.mesh.material=w.mat[piece.layer===1?slot(w,'terrain2'):petal(w)];if(piece.grain)piece.mesh.visible=false;}
  // Seven petals hinged on the disc's rim. Each hinge's +x points outward, so
  // rotation.z swings its petal from drooping (at rest, tips below the deck,
  // so nothing looks standable that is not) up and over the eye.
  const cx=s.w/2,crown=group(g,'Flower crown',cx,0,0),hinges=[];
  const n=7,R=s.w/2-.05;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2+.3,hinge=group(crown,'Petal hinge',Math.cos(a)*R,-.12,Math.sin(a)*R*.6);hinge.rotation.y=-a;hinge.rotation.z=PETAL_REST;
    w.ball(.5,.13,.36,petal(w),hinge,.42,0,0).name='Petal';
    hinges.push(hinge);
  }
  const stalk=w.cylinder(.11,1.4,slot(w,'vine','dark'),g,cx,-1.3,0);stalk.name='Flower stalk';
  const leaf=w.ball(.38,.12,.2,slot(w,'foliage','top'),g,cx-.4,-1.5,0);leaf.rotation.z=.6;leaf.name='Flower leaf';
  // The eye peeks from the back of the disc, tilted to look forward and up.
  const eye=clayEye(w,crown,0,.16,-.62,.36,petal(w),s.x*3);
  eye.group.rotation.x=-.4;
  registry(w).snaps.push({s,crown,hinges,lid:eye.lid});
  return {root:g,fracture};
}
// The spring as a mushroom: a cream stem under a squashed cap whose top is
// the spring's standing height. Pink with cream spots before the arch, purple
// with yellow spots after it. world.render squashes the root by the spring's
// bounce, so the cap dips when it fires.
function mushroomSpring(w,s,g){
  g.name='Garden mushroom spring · '+s.id;
  const cx=s.w/2,pre=familiar(w,s.x),capMat=pre?capPink(w):'terrain',dot=pre?'cream':'gold';
  mushroomStem(w,g,cx,-1.7,.5,1.4,0);
  cap(w,g,cx,-.4,s.w*.56,.4,1,capMat,dot);
  return {root:g};
}
// The bench under the flowerbed: a trough — a floor and a back wall the height
// of the bench, a front wall left low so the slime inside shows, and a
// full-height cap at the far end where the bare strip before the exit deck
// stands. The violet mass itself is the engine's clay view.
function trough(w,s,g){
  g.name='Garden flowerbed trough · '+s.id;
  const h=s.h??2.4;
  w.box(s.w+.1,.5,4.9,'terrain2',g,s.w/2,-h+.25,0,.2).name='Trough floor';
  w.box(s.w+.1,h,.6,'terrain2',g,s.w/2,-h/2,-2.1,.2).name='Trough back';
  w.box(s.w+.1,h-.5,.6,'terrain',g,s.w/2,-h/2-.25,2.1,.2).name='Trough front';
  w.box(.7,h,4.9,'terrain2',g,s.w-.3,-h/2,0,.15).name='Trough end';
  for(let i=0;i<Math.ceil(s.w/1.1);i++){const x=.5+i*1.1;if(x>s.w-.4)continue;w.ball(.36,.14,.22,'top',g,x,.02,-2.1).name='Trough bead';w.ball(.3,.12,.2,'top',g,x+.4,-.48,2.1).name='Trough bead';}
  return {root:g};
}

// --- props -------------------------------------------------------------------------------
// A watching flower: the supplied model on the leaner rig. Before the arch it
// leans a little; after it, hard. The eye is registered so animate() aims the
// pupil, turns the head and blinks.
function flower(w,parent,{height,strength,seed}){
  const f=dreamFlower(w,parent,{height});
  lean(w,f.root,{x:parent.position.x,y:parent.position.y,strength,rest:(rand(seed)-.5)*.1});
  watch(w,{gaze:f.gaze,lid:f.lid,head:f.head,pupil:f.pupil,seed});
  return f.root;
}
// --- the supplied scenery -------------------------------------------------------------
// Each stands the model whole, its foot on the group's origin, turned by
// `turn` about y so no two copies show the same face; each does nothing when
// its model has not loaded (the chapter waits for the dream's models before it
// dresses, so that is a test rig without them — and there is no sculpted
// stand-in to fall back to, on purpose: the pillars, mounds and mushrooms
// these replace are gone).
function spire(w,g,height,turn=0){
  if(!w.dreamAssets?.mountain)return null;
  const root=dreamMountain(w,g,height);root.rotation.y=turn;return root;
}
function column(w,g,height,{stretch=1,turn=0}={}){
  if(!w.dreamAssets?.pillar)return null;
  const root=dreamPillar(w,g,height,{stretch});root.rotation.y=turn;return root;
}
function pile(w,g,width,turn=0){
  if(!w.dreamAssets?.pebbles)return null;
  const root=dreamPebbles(w,g,width);root.rotation.y=turn;return root;
}
// A pebble pile on a deck, streamed as a prop: standing, not leaning — rocks
// do not turn toward the player the way the flowers do.
function pebblePile(w,parent,width,turn){
  return pile(w,parent,width,turn);
}
// The chapters' shared cloud, `width` across, in the garden's wash: every mesh
// of the clone swaps its material for a tinted copy of the shared one, kept in
// w.mat under the tint's name so World.build's sweep keeps it like any fixed
// colour and every cloud of that tint shares it. The clone keeps the relief
// hook, and the scale stays uniform — tests/scene.mjs holds every ivory cloud
// to its full depth.
function softCloud(w,g,width,turn,tint='pink'){
  const root=cloudModel(w,g,0,0,0,width,turn);
  if(!w.mat)return root;
  root.traverse(o=>{
    if(!o.isMesh)return;
    const wash=base=>{
      const name='gardenCloudWash:'+tint+':'+base.uuid;
      if(!w.mat[name]){const m=base.clone();m.onBeforeCompile=base.onBeforeCompile;m.customProgramCacheKey=base.customProgramCacheKey;m.color.set(CLOUD_TINTS[tint]);m.name=name;w.mat[name]=m;}
      return w.mat[name];
    };
    o.material=Array.isArray(o.material)?o.material.map(wash):wash(o.material);
  });
  return root;
}
// The arch: one chunky rock silhouette with a hole, extruded and bevelled, in
// the `back` slot so the palette entry at its centre re-inks it from salmon to
// lilac as the player walks through; frosting on its crown and running down
// its legs. Static — the flag stands under its bow and the flower hangs over
// its crown, so the arch must not lean. Built about the arch's centre at the
// deck's top; its top is at +3.1.
function archShape(){
  const s=new THREE.Shape();
  s.moveTo(-3.1,0);s.lineTo(-3.1,1.5);s.absellipse(0,1.5,3.1,1.65,Math.PI,0,true);s.lineTo(3.1,0);s.lineTo(-3.1,0);
  const hole=new THREE.Path();
  hole.moveTo(-1.7,0);hole.lineTo(-1.7,1.25);hole.absellipse(0,1.25,1.7,1.5,Math.PI,0,true);hole.lineTo(1.7,0);hole.lineTo(-1.7,0);
  s.holes.push(hole);return s;
}
const archGeometry=w=>clayShape(w,'garden-arch',()=>{
  const geo=new THREE.ExtrudeGeometry(archShape(),{depth:1.5,bevelEnabled:true,bevelThickness:.32,bevelSize:.26,bevelSegments:4,curveSegments:24});
  geo.translate(0,0,-.75);return sculptClay(w,geo,{amplitude:.09});
});
function crookedArch(w,parent){
  const g=group(parent,'Garden crooked arch');
  // The supplied gate, where it has loaded: shifted so its off-centre opening
  // stands on the arch's x, its flower's eye watching like every other
  // flower's (the head is part of the arch, so only the pupil and lid move).
  if(w.dreamAssets?.arch){
    const arch=dreamArch(w,g,{height:4});arch.root.position.x=-.6;
    watch(w,{gaze:arch.gaze,lid:arch.lid,pupil:arch.pupil,seed:77});
    return g;
  }
  const rock=w.mesh(archGeometry(w),'back',g,0,0,0);rock.rotation.z=-.045;rock.name='Arch rock';
  for(const [x,y,rx,ry] of [[-2.2,3.05,.9,.32],[-.9,3.28,1,.3],[.6,3.26,1.05,.31],[2.1,3.02,.85,.3]])w.ball(rx,ry,.95,'top',g,x,y,.1).name='Arch moss';
  for(const [x,y,h,i] of [[-2.55,2.7,.9,0],[2.5,2.55,.7,1],[-1.05,3.0,1.2,0],[1.5,2.95,.6,1]])drip(w,g,x,y,.78,.2,h,'top',i);
  w.ball(.46,.36,.42,'top',g,-3.0,.3,.4).name='Arch tuft';w.ball(.4,.32,.36,'top',g,3.05,.26,-.3).name='Arch tuft';
  return g;
}

export default {
  key:'garden',

  // Every stone deck of the garden has the familiar body; past the arch it
  // is dressed strange. The arch deck straddles the flip, so a deck is judged
  // by where it begins.
  dress(w,s,g){
    body(w,s,g,{weird:!familiar(w,s.x+1)});
    return true;
  },

  // In front of every stone deck: a heap of the pastel pebbles, a big pile and
  // a small one beside it, swapped left/right and turned by deck so no two
  // decks show the same heap. The group sits 2.1 under the deck's top and the
  // pile is under half as tall as it is wide, so nothing here rises near the
  // walk plane; the model's colours are painted, so the palette flip leaves
  // the heaps as they are, and the tag prepareDreamAsset puts on the model's
  // material lets depth-scenery.js clone and fade them over the player. Without
  // the model the chapter's own pastel mound stands here instead.
  foreground(w,g,variant){
    if(!w.dreamAssets?.pebbles)return false;
    const flip=variant%2?-1:1;
    const big=pile(w,g,3.4,variant*1.7);big.position.set(flip*.3,-1.7,0);
    const small=pile(w,g,1.9,variant*2.3+1);small.position.set(-flip*2.3,-1.85,.35);
    return true;
  },

  // The pads, eyes, snapping heads, spring and trough are the
  // garden's own; the clay and the goal keep the engine's view.
  deck(w,s,g){
    if(s.shape)return null;
    if(s.kind==='wall'&&s.id==='garden-bed-bench')return trough(w,s,g);
    if(s.kind==='spring')return mushroomSpring(w,s,g);
    if(s.kind==='ledge')return floatPad(w,s,g);
    if(s.kind==='pulse')return eyePad(w,s,g);
    if(s.kind==='crumble')return snappingFlower(w,s,g);
    return null;
  },

  // Scenery by WORLD x: decks are looked up by id, so the same list works in
  // the full chapter (where the entry deck is `start`) and in a solo build.
  // One flower watches the spawn; then two, then more, and after the arch
  // they grow and lean harder, until three giants see the player out. Between
  // them, pebble piles at the decks' backs where the mushrooms and bushes
  // stood — `w` is the pile's width, which is also its streaming window.
  props(section,L){
    const decks=sectionDecks(L,section),entry=decks[0];
    const step2=deck(L,'garden-step-2'),float2=deck(L,'garden-float-2'),mound=deck(L,'garden-mound'),dock=deck(L,'garden-dock'),bench=deck(L,'garden-bed-bench'),exit=deck(L,'garden-exit');
    const list=[];
    const bloom=(key,on,dx,height,strength,seed,z=-1.25)=>on&&list.push({key,x:on.x+dx,y:on.y,w:height*.6,z,make:(w,parent)=>flower(w,parent,{height,strength,seed})});
    const heap=(key,on,dx,width,turn=0)=>on&&list.push({key,x:on.x+dx,y:on.y,w:width,z:-1.35,make:(w,parent)=>pebblePile(w,parent,width,turn)});
    // The familiar start: one big flower turns to watch the spawn, pebbles at
    // its foot and at the deck's far end.
    bloom('flower-a',entry,3.5,3.6,.18,1);heap('pile-a',entry,1.4,2.2,.6);heap('pile-b',entry,7.6,1.8,2.4);
    // The steps and the pads: a second flower, then a small third one.
    bloom('flower-b',step2,5,2.4,.2,2);
    bloom('flower-c',float2,2.2,1.8,.22,3);
    // The arch deck: the arch, a flower either side of its legs, a small heap
    // at its far end.
    if(mound)list.push({key:'arch',x:mound.x+ARCH_IN,y:mound.y,w:7,z:-1.35,make:(w,parent)=>crookedArch(w,parent)});
    bloom('flower-d',mound,1.2,2.6,.24,4);bloom('flower-e',mound,6.5,2.9,.32,5);heap('pile-c',mound,7.5,1.4,4.1);
    // The dock and the bed: taller flowers, a heap between them, and two small
    // flowers standing on the trough's back rim.
    bloom('flower-f',dock,.8,3.2,.36,6);bloom('flower-g',dock,4.9,3.6,.38,7);heap('pile-d',dock,5.6,1.6,1.3);
    bloom('flower-h',bench,8.2,1.4,.4,8,-2.1);bloom('flower-i',bench,11.6,1.2,.4,9,-2.1);
    // The exit: three giants and two heaps see the player out.
    bloom('flower-j',exit,1.6,3.4,.4,10);bloom('flower-k',exit,5.2,4.2,.42,11);bloom('flower-l',exit,8.6,4.6,.45,12);
    heap('pile-e',exit,3.6,1.8,3.3);heap('pile-f',exit,6.6,2,5.2);
    return list;
  },

  // The hazards: pink slime. The pools are glossy slabs with bubbles and cream
  // cones — standing on purple mounds past the arch, where a flower or two
  // grow out of the slime as well. The band under the flowerbed is the slime
  // seen through the trough's low front wall.
  hazard(w,h,g){
    g.name='Garden slime · '+h.x;
    if(h.y>0){
      w.box(h.w+.2,.5,3.4,slime(w),g,h.w/2,.2,0,.2).name='Bed slime';
      for(let i=0;i<4;i++){const r=.22+rand(i*7+h.x)*.2;w.ball(r,r*.5,r,slimeLight(w),g,1+rand(i*3+h.x)*(h.w-2),.42,(rand(i*5+h.x)-.5)*2.4).name='Slime bubble';}
      return true;
    }
    const weird=!familiar(w,h.x+h.w/2);
    w.box(h.w+.6,2.6,3.2,slime(w),g,h.w/2,-.85,-.4,.7).name='Slime pool';
    for(let i=0;i<2;i++)w.ball(.34,.06,.28,'cream',g,h.w*(.3+i*.45)+rand(i+h.x)*.8,.44,.6).name='Slime plate';
    const cones=Math.min(14,Math.max(3,Math.round(h.w/1.9)));
    for(let i=0;i<cones;i++){
      const x=(i+.5)/cones*h.w+(rand(i+h.x)-.5)*.6,z=-.3+rand(i*5+h.x)*.9,r=.28+rand(i*3+h.x)*.16,hh=.95+rand(i*7+h.x)*1;
      if(weird){w.ball(r*1.7,.34,r*1.5,'terrain',g,x,.42,z).name='Slime mound';cone(w,g,x,.66,z,r,hh,'cream',i);}
      else cone(w,g,x,.42,z,r,hh,'cream',i);
    }
    for(let i=0;i<Math.round(h.w/3);i++){const r=.2+rand(i*11+h.x)*.24;w.ball(r,r*.55,r,slimeLight(w),g,.6+rand(i*13+h.x)*(h.w-1.2),.4,.5+rand(i*17+h.x)*.5).name='Slime bubble';}
    if(weird)for(const [dx,height,seed] of [[h.w*.34,2.6,21],[h.w*.7,3,22]]){
      const stand=group(g,'Pool flower',dx,.4,-1.45);
      const f=dreamFlower(w,stand,{height});
      lean(w,f.root,{x:h.x+dx,y:h.y+.4,strength:.4});
      watch(w,{gaze:f.gaze,lid:f.lid,head:f.head,pupil:f.pupil,seed});
    }
    return true;
  },

  // Far scenery, placed once by world x, all of it the supplied models. Before
  // the arch, three depths: clayfall spires far back, drawn mostly by the fog;
  // pink pillars under their frosting caps in the middle, pebble heaps at the
  // feet of every other one; two nearer pillars with heaps of their own; and
  // two small spires nearer still, their waterfalls toward the camera, where
  // the painting has its mesas. After it: coils that turn, a tall spire, a
  // pillar and another spire — standing, not floating, where the palette has
  // gone violet. The sky is one ribbon cloud, the chapters' shared cloud in a
  // pink and a lilac wash, and the coils.
  // Parallax shows a far item from up to |Δx|·factor < 10.6 away, so the
  // post-arch pieces sit far enough right (factor .3, ≥ +94) that none of
  // them shows before the player has passed the arch. The same arithmetic
  // packs a layer: the far pillars stand 14 apart in the world and 3 on
  // screen, which is why they alternate between two depths — a pillar half
  // hidden by its neighbour reads as behind it only if its fog differs.
  // The camera is orthographic, so far things are drawn small rather than
  // shrunk by distance; the view is twelve units tall, so the sky sits
  // between y 5 and 9. Depth is authored in z against the fog (30..98 from a
  // camera at z 26, dream.js): the near pillars at z −20 keep three quarters
  // of their colour, the middle ones at z −30 three fifths, the spires at
  // z −56 a quarter, and the backdrop blur softens all of them alike. The
  // camera also looks down a little, so a far foot at y −3.5 sits about as
  // far up the screen as the camera's own height: the heaps at the pillars'
  // feet show at the entry and sink under the frame once the route climbs,
  // and the post-arch peaks are tall so their crowns stay in the upper half.
  quietBackdrop:true,
  // The far scenery is drawn through the backdrop blur (citadel-depth.js) at
  // this texel radius, so the pillars read as a set photographed with a
  // short depth of field while the decks stay crisp.
  softBackdrop:1.3,
  backdrop(w,L,section,layers){
    const deep=layers.at(.14),far=layers.at(.22),near=layers.at(.32),sky=layers.at(.1),mid=layers.at(.3);
    const x0=section.x;
    for(const [i,[dx,height]] of [[-2,6.5],[14,5],[30,7.5],[46,6],[62,7]].entries())spire(w,layers.place(deep,x0+dx,-3.5,i%2?-58:-54),height,i*1.9);
    for(const [i,[dx,height]] of [[2,5.6],[16,7.4],[30,5.2],[46,6.6]].entries()){
      const stretch=1.2,width=height/stretch*.615;
      column(w,layers.place(far,x0+dx,-3.5,i%2?-33:-29),height,{stretch,turn:i*2.1});
      if(i%2===0)pile(w,layers.place(far,x0+dx+width*.75,-3.5,-28),2.6,i*1.3+.5);
    }
    for(const [i,[dx,height]] of [[9,4.6],[31,5.2]].entries()){
      column(w,layers.place(near,x0+dx,-3.5,-20),height,{turn:i*2.6+1});
      pile(w,layers.place(near,x0+dx-2.2,-3.4,-19),2.6+i*.4,i*1.9+2);
    }
    for(const [i,dx] of [10,40].entries())spire(w,layers.place(far,x0+dx,-3.5,-23),5,i?-.35:.3);
    // One ribbon cloud winds across the top of the view and hooks into a
    // curl; the clouds proper sit a little lower and deeper. A layer this far
    // shows everything within 106 units, ten times closer together than in
    // the world, so the clouds are spread over the whole chapter's width to
    // stand five apart on screen, four in view at once.
    const g=layers.place(layers.at(.12),x0+22,6.2,-16);
    const r=w.mesh(ribbon(w),cloud(w),g,0,0,0);r.scale.set(.62,.5,.36);r.rotation.z=-.04;r.name='Ribbon cloud';
    for(const [i,[dx,y,width]] of [[-40,3.6,5.2],[10,4.6,4.2],[60,3.4,5.4],[110,4.4,4.6]].entries())softCloud(w,layers.place(sky,x0+dx,y,-34),width,i*.7,i%2?'lilac':'pink');
    // The post-arch sky is the garden's: its pieces retire once the player
    // has crossed into the Folding Path, which paints its own.
    const until={until:x0+section.length};
    for(const [i,[dx,y,size]] of [[96,7.2,.7],[124,8.2,.75]].entries()){
      const g=layers.place(mid,x0+dx,y,-34,until);
      const c=w.mesh(coil(w),i%2?peach(w):cloud(w),g,0,0,0);c.scale.set(size,size*.72,.4);c.name='Sky coil';
      w.dreamSwirls?.push({mesh:c,speed:(i%2?-1:1)*.14});
    }
    spire(w,layers.place(mid,x0+94,-3.5,-31,until),10,.25);
    column(w,layers.place(mid,x0+110,-3.5,-30,until),7.5,{stretch:1.2,turn:3.4});
    spire(w,layers.place(mid,x0+124,-3.5,-32,until),8.5,-.4);
  },

  // Every eye aims its pupil at the player and blinks; the flowers turn their
  // heads; the eye pads shut through the pulse's warning and stay shut while
  // the pad is gone; the snapping heads fold as their timer runs and drop with
  // their pieces. Reduced motion holds pupils and heads still and skips the
  // idle blinks — the pad lids and petal folds stay, they are gameplay signals.
  animate(w,game,dt,section,ctx){
    const reg=registry(w),p=game.player,t=ctx.time,still=ctx.reducedMotion,rate=1-Math.exp(-dt*9);
    for(let i=reg.eyes.length-1;i>=0;i--){
      const e=reg.eyes[i];
      if(!attached(e.gaze,w.scene)){reg.eyes.splice(i,1);continue;}
      e.gaze.getWorldPosition(worldPosition);
      const dx=ctx.playerX-worldPosition.x,dy=(p.y+.9)-worldPosition.y,awake=e.wake===null||ctx.playerX>e.wake;
      if(still||!awake)direction.set(0,0,1);else direction.set(clamp(dx/8,-.6,.6),clamp(dy/6,-.45,.45),1).normalize();
      e.gaze.quaternion.slerp(turn.setFromUnitVectors(FORWARD,direction),still?1:rate);
      if(e.head){
        const tz=still||!awake?0:-Math.atan2(dx,6)*.22,ty=still||!awake?0:clamp(dx/10,-1,1)*.25;
        e.head.rotation.z+=(tz-e.head.rotation.z)*rate;e.head.rotation.y+=(ty-e.head.rotation.y)*rate;
      }
      if(e.pupil){const near=!still&&awake&&Math.abs(dx)<6?1.15:1;e.pupil.scale.copy(e.pupilScale).multiplyScalar(near);}
      let k=0;
      if(!awake)k=1;
      else if(!still){const u=(((t+e.phase)%e.period)+e.period)%e.period/BLINK;k=u<1?Math.sin(u*Math.PI):0;}
      e.lid.rotation.x=-Math.PI/2+k*Math.PI;
    }
    for(let i=reg.pads.length-1;i>=0;i--){
      const e=reg.pads[i];
      if(!attached(e.eye,w.scene)){reg.pads.splice(i,1);continue;}
      // The pupil rides the ellipsoid toward the player.
      e.eye.getWorldPosition(worldPosition);
      const dx=ctx.playerX-worldPosition.x,dy=(p.y+.9)-worldPosition.y;
      if(still)direction.set(0,0,1);else direction.set(clamp(dx/8,-.6,.6),clamp(dy/6,-.4,.4),1).normalize();
      e.pupil.position.lerp(scratch.copy(direction).multiply(e.radii).multiplyScalar(.9),still?1:rate);
      e.pupil.quaternion.slerp(turn.setFromUnitVectors(FORWARD,direction),still?1:rate);
      // The lid: open while the pad is solid, drawn shut across the warning
      // window (the simulation's own phase arithmetic), shut while it is gone.
      const s=e.s,period=s.period||4.8,duty=s.duty||.76,phase=((game.time/period+(s.phase||0))%1+1)%1;
      const target=!s.active?1:phase>duty-.14?(phase-(duty-.14))/.14:0;
      e.k+=(target-e.k)*(1-Math.exp(-dt*14));
      e.lid.rotation.x=-Math.PI/2+smooth(e.k)*Math.PI;
    }
    for(let i=reg.snaps.length-1;i>=0;i--){
      const e=reg.snaps[i];
      if(!attached(e.crown,w.scene)){reg.snaps.splice(i,1);continue;}
      const s=e.s,delay=s.delay||.62,progress=s.active?clamp(s.timer/delay,0,1):1,fold=smooth(Math.min(1,progress*1.35));
      for(const hinge of e.hinges)hinge.rotation.z=PETAL_REST+(PETAL_SHUT-PETAL_REST)*fold;
      if(fold>0)e.lid.rotation.x=-Math.PI/2+fold*Math.PI;
      // Broken, the crown drops with the pieces until the engine hides the deck.
      const age=s.active?0:Math.max(0,s.timer-delay),fall=Math.max(0,age-.05);
      e.crown.position.y=-fall*fall*8.5;e.crown.rotation.z=fall*.6;
    }
  }
};
