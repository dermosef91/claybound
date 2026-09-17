import * as THREE from '../lib/three.module.js';
import {sectionDecks,deck,lean,slot,rand,fixedMaterial,cone,drip,lid,attached} from './support.js';
import {clayShape,sculptClay} from '../clay.js';
import {createCrumble} from '../crumble.js';
import {dreamFlower} from '../dream-assets.js';
// Section 1 — The Crooked Garden, after its two paintings. ONE idea: it looks
// like any other chapter — terracotta clay under green frosting that has run
// over the lips, pink-capped mushrooms, a blue sky with pink swirls, a pink
// pool with cream cones, a salmon rock arch — except that the flowers have an
// eye where the heart should be, and they watch you. Walk under the arch and
// the palette flips (dist/routes/dream-sections/garden.js carries four
// entries: familiar → candy → hotter → the violet that hands over to the
// Folding Path) and the same shapes go wrong: the frosting drips longer and
// turns lime, the faces of the decks marble and grow pores and eyes, the
// floating pads are eyes that blink shut, the flower heads snap, the far
// mushrooms turn purple and the sky coils.
//
// Everything but the flower is built from the world's clay primitives in the
// palette slots (main → terrain/terrain2, secondary → top/foliage/bark/vine,
// backdrop → back/back2, accent → accent) plus a few fixed colours the palette
// cannot reach (the slime, the clouds, the falls). The flower is the supplied
// model, rigged in dist/dream-assets.js: a pupil the model lacks, a lid, a
// head on its own pivot and a root the leaners turn.
//
// Hooks (dream.js): dress() builds the stone decks — the familiar body before
// the arch, the same body gone strange after it; deck() dresses the floating
// pads, the eye pads (pulse), the snapping flower heads (crumble), the
// mushroom spring, the arch's keystone and the flowerbed's trough; props()
// streams the flowers, mushrooms, bushes and the arch by WORLD x; hazard()
// draws the pink pools and the slime under the bed; backdrop() places the far
// mesas, clouds and coils; animate() moves every eye, lid and petal.

const group=(parent,name,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

// --- colours the palette cannot reach ------------------------------------------
// All of them clay with the relief hook (tests/scene.mjs holds every surface
// near a spawn to it); the slime and the falls ask for the shiniest the relief
// shader allows, a soft sheen rather than gloss.
const slime=w=>fixedMaterial(w,'gardenSlime',0xef4f9c,{roughness:.4,depth:.03});
const slimeLight=w=>fixedMaterial(w,'gardenSlimeLight',0xf78ac0,{roughness:.4,depth:.03});
const cloud=w=>fixedMaterial(w,'gardenCloud',0xf2a9c6,{depth:.05});
const peach=w=>fixedMaterial(w,'gardenPeach',0xf6b48f,{depth:.05});
const falls=w=>fixedMaterial(w,'gardenFalls',0x8fd0f4,{roughness:.4,depth:.03});
const petal=w=>fixedMaterial(w,'dreamPetal',0xe8598a,{depth:.06});
const pupilInk=w=>fixedMaterial(w,'dreamPupil',0x1a1416,{roughness:.35,depth:.02});

// --- where the arch stands -----------------------------------------------------------
// The palette flips at the arch's centre, 3.75 into the arch deck; everything
// left of it is the familiar world. Decks and hazards ask which side they are.
const ARCH_IN=3.75;
const archX=L=>{const m=deck(L,'garden-mound');return m?m.x+ARCH_IN:Infinity;};
const familiar=(w,x)=>x<archX(w.currentLevel);

// --- the animated registry ---------------------------------------------------------
// Eyes, eye pads, snapping heads and the keystone are built inside streamed
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
class Sine extends THREE.Curve{
  constructor(length,amp,waves){super();this.length=length;this.amp=amp;this.waves=waves;}
  getPoint(t,o=new THREE.Vector3()){return o.set(t*this.length,Math.sin(t*Math.PI*2*this.waves)*this.amp,0);}
}
class Spiral extends THREE.Curve{
  constructor(r0,r1,turns){super();this.r0=r0;this.r1=r1;this.turns=turns;}
  getPoint(t,o=new THREE.Vector3()){const a=t*this.turns*Math.PI*2,r=this.r0+(this.r1-this.r0)*t;return o.set(Math.cos(a)*r,Math.sin(a)*r,0);}
}
class Helix extends THREE.Curve{
  constructor(r,height,turns){super();this.r=r;this.height=height;this.turns=turns;}
  getPoint(t,o=new THREE.Vector3()){const a=t*this.turns*Math.PI*2,r=this.r*(1-t*.55);return o.set(Math.cos(a)*r,t*this.height,Math.sin(a)*r);}
}
const spiralDisc=w=>clayShape(w,'garden-spiral-disc',()=>sculptClay(w,new THREE.TubeGeometry(new Spiral(.12,1,2.6),72,.13,7,false),{amplitude:.02}));
const tendril=w=>clayShape(w,'garden-tendril',()=>sculptClay(w,new THREE.TubeGeometry(new Helix(.42,1.6,2.2),40,.09,6,false),{amplitude:.02}));
const streak=w=>clayShape(w,'garden-streak',()=>sculptClay(w,new THREE.TubeGeometry(new Sine(14,1.1,1.25),48,.6,7,false),{amplitude:.03}));
const coil=w=>clayShape(w,'garden-coil',()=>sculptClay(w,new THREE.TubeGeometry(new Spiral(.6,4.2,1.75),96,.62,8,false),{amplitude:.03}));

// --- terrain -------------------------------------------------------------------------
// The body every other chapter's decks are made of (environments.js's plain
// terrain, copied rather than imported so this module makes no cycle): columns
// of three pressed courses under a frosting cap with beads along its lip — and
// here the frosting has run over the edge in drips. After the arch the same
// body is dressed strange: longer drips, marbling streaks, a spiral pressed
// into the face, pores, a tendril, and an eye in the face of the two big decks.
function body(w,s,g,{weird=false}={}){
  const width=s.w,columns=Math.max(2,Math.ceil(width/3.1)),rows=3,rowH=10.4/rows;
  for(let i=0;i<columns;i++){
    const cw=width/columns,depth=3.25+rand(i+s.x)*.15;
    for(let row=0;row<rows;row++)w.box(cw+.15,rowH+.2,depth+(row%2)*.06,(i+row)%3===1?'terrain2':'terrain',g,(i+.5)*cw,-.18-(row+.5)*rowH,-.03,.33).name='Clay course';
  }
  w.box(width+.14,.49,3.6,'top',g,width/2,-.18,0,.22).name='Frosting cap';
  for(let i=0;i<Math.ceil(width/.93);i++){const x=.25+i*.93;if(x>width-.15)continue;w.ball(.51,.17+rand(i+s.x)*.09,.15,'top',g,x,-.32,1.68).name='Cap bead';}
  const drips=Math.max(2,Math.round(width/(weird?1.3:2.4)));
  for(let i=0;i<drips;i++){
    const x=.5+rand(i*3+s.x)*(width-1),h=(weird?.9:.45)+rand(i*7+s.x)*(weird?1.3:.55),r=.2+rand(i*5+s.x)*.14;
    drip(w,g,x,-.4,1.66,r,h,'top',i);
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

// --- deck dressings ----------------------------------------------------------------------
// A floating pad before the arch: a slab of clay under a frosting cap, the
// frosting run over its lip, like the flying steps of every other chapter.
function floatPad(w,s,g){
  g.name='Garden floating pad · '+s.id;
  w.box(s.w+.1,.42,2.6,'top',g,s.w/2,-.2,0,.16).name='Pad frosting';
  w.box(s.w-.2,.9,2.3,'terrain',g,s.w/2,-.82,0,.22).name='Pad body';
  for(let i=0;i<Math.ceil(s.w/.9);i++){const x=.4+i*.9;if(x>s.w-.3)continue;w.ball(.42,.15,.14,'top',g,x,-.34,1.2).name='Pad bead';}
  for(let i=0;i<2;i++)drip(w,g,.7+rand(i*3+s.x)*(s.w-1.4),-.4,1.18,.18,.4+rand(i+s.x)*.4,'top',i);
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
  const cx=s.w/2,pre=familiar(w,s.x),cap=pre?'accent':'terrain',dot=pre?'cream':'gold';
  w.cylinder(.42,1.3,'cream',g,cx,-.9,0).name='Mushroom stem';
  w.ball(s.w*.56,.4,1,cap,g,cx,-.34,0).name='Mushroom cap';
  w.ball(s.w*.42,.16,.8,'cream',g,cx,-.66,.05).name='Mushroom gills';
  for(const [dx,dz,r] of [[-.42,.3,.16],[.3,.45,.13],[.18,-.4,.14]])w.ball(r,r*.5,r,dot,g,cx+dx,-.03,dz).name='Mushroom dot';
  return {root:g};
}
// The arch's keystone: a chunky block where the two halves of the arch meet,
// with a closed eye pressed into its face that opens once the player has
// walked under it — the arch wakes as the world flips.
function keystone(w,s,g){
  g.name='Garden arch keystone · '+s.id;
  w.box(s.w+.2,1,1.6,'back',g,s.w/2,-.5,-1.3,.3).name='Keystone';
  w.box(s.w-.4,.3,1.3,'top',g,s.w/2,-.12,-1.2,.12).name='Keystone frosting';
  clayEye(w,g,s.w/2,-.5,-.46,.34,'back',s.x*5,{wake:s.x+s.w/2+.5});
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
// A mushroom: cream stem, a squashed cap — pink with cream spots before the
// arch, purple with yellow spots after — and, if asked, an eye in the cap.
function mushroom(w,parent,{size=1,eye=false,seed=0}){
  const g=lean(w,group(parent,'Garden mushroom'),{x:parent.position.x,y:parent.position.y,strength:.08});
  g.scale.setScalar(size);
  const pre=familiar(w,parent.position.x),cap=pre?'accent':'terrain',dot=pre?'cream':'gold';
  w.cylinder(.34,1.4,'cream',g,0,.7,0).name='Mushroom stem';
  w.ball(1.05,.5,.95,cap,g,0,1.4,0).name='Mushroom cap';
  for(const [dx,dz,r] of [[-.45,.35,.17],[.35,.5,.13],[.2,-.45,.15]])w.ball(r,r*.5,r,dot,g,dx,1.78,dz).name='Mushroom dot';
  if(eye)clayEye(w,g,0,1.42,.8,.3,cap,seed);
  return g;
}
// A bush: three frosting-coloured balls with two berries.
function bush(w,parent,size=1){
  const g=lean(w,group(parent,'Garden bush'),{x:parent.position.x,y:parent.position.y,strength:.1});
  g.scale.setScalar(size);
  w.ball(.75,.6,.65,slot(w,'foliage','top'),g,0,.5,0).name='Bush';
  w.ball(.55,.48,.5,slot(w,'foliage','top'),g,-.6,.42,.1).name='Bush';
  w.ball(.5,.42,.45,slot(w,'foliage','top'),g,.58,.4,-.05).name='Bush';
  w.ball(.14,.14,.12,'accent',g,.2,.95,.45).name='Berry';w.ball(.12,.12,.1,'accent',g,-.55,.7,.4).name='Berry';
  return g;
}
// The arch: one chunky rock silhouette with a hole, extruded and bevelled, in
// the `back` slot so the palette entry at its centre re-inks it from salmon to
// lilac as the player walks through; frosting on its crown and running down
// its legs. Static — the crown ledge above it is its keystone and a collider,
// so the arch must not lean away from it. Built about the arch's centre at the
// deck's top; its top meets the keystone's underside at +3.1.
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
  const rock=w.mesh(archGeometry(w),'back',g,0,0,0);rock.rotation.z=-.045;rock.name='Arch rock';
  for(const [x,y,rx,ry] of [[-2.2,3.05,.9,.32],[-.9,3.28,1,.3],[.6,3.26,1.05,.31],[2.1,3.02,.85,.3]])w.ball(rx,ry,.95,'top',g,x,y,.1).name='Arch moss';
  for(const [x,y,h,i] of [[-2.55,2.7,.9,0],[2.5,2.55,.7,1],[-1.05,3.0,1.2,0],[1.5,2.95,.6,1]])drip(w,g,x,y,.78,.2,h,'top',i);
  w.ball(.46,.36,.42,'top',g,-3.0,.3,.4).name='Arch tuft';w.ball(.4,.32,.36,'top',g,3.05,.26,-.3).name='Arch tuft';
  return g;
}

// --- backdrop pieces --------------------------------------------------------------------
function mesa(w,g,width,height,seed){
  w.box(width,height,width*.8,'back',g,0,height/2,0,width*.22).name='Far mesa';
  w.box(width*.72,height*.22,width*.6,'back2',g,width*.1,height*.8,.2,width*.14).name='Far mesa shoulder';
  w.ball(width*.55,height*.06+.4,width*.45,'top',g,0,height+.1,0).name='Far mesa cap';
  w.ball(width*.3,.5,width*.25,'top',g,-width*.3,height*.62,.3).name='Far mesa tuft';
  if(seed%2)w.ball(width*.22,.4,width*.2,'top',g,width*.32,height*.42,.3).name='Far mesa tuft';
}
function farMushroom(w,g,height,cap,stem,capMat,spots){
  w.box(height*.16,height,height*.16,stem,g,0,height/2,0,height*.06).name='Far mushroom stem';
  w.ball(cap,cap*.42,cap*.8,capMat,g,0,height,0).name='Far mushroom cap';
  if(spots)for(const [dx,dz] of [[-.4,.3],[.35,.4],[.05,-.35]])w.ball(cap*.13,cap*.06,cap*.12,spots,g,dx*cap,height+cap*.36,dz*cap).name='Far mushroom spot';
}
function puffCloud(w,g,size){
  w.ball(size,size*.6,size*.7,cloud(w),g,0,0,0).name='Cloud';
  w.ball(size*.7,size*.5,size*.6,cloud(w),g,-size*.8,-size*.08,.1).name='Cloud';
  w.ball(size*.6,size*.42,size*.5,cloud(w),g,size*.85,-size*.12,-.1).name='Cloud';
}
// A floating island with a waterfall pouring off it: the fall widens as it
// drops and breaks into foam at its lip and its foot.
function island(w,g,width){
  w.ball(width*.5,width*.34,width*.4,'terrain2',g,0,-width*.2,0).name='Far island';
  w.box(width*.9,.4,width*.6,'top',g,0,.05,0,.2).name='Far island frosting';
  w.ball(width*.16,.4,width*.16,'terrain',g,width*.1,.3,-.1).name='Far island knob';
  const h=width*.95,x=-width*.1,z=width*.3;
  const fall=w.mesh(new THREE.CylinderGeometry(.34,.18,h,10),falls(w),g,x,-h/2-width*.05,z);fall.name='Far waterfall';
  w.ball(.3,.14,.24,'cream',g,x,-width*.05+.02,z).name='Far waterfall lip';
  w.ball(.55,.2,.42,'cream',g,x,-h-width*.05,z).name='Far waterfall foam';
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

  // The pads, eyes, snapping heads, spring, keystone and trough are the
  // garden's own; the clay and the goal keep the engine's view.
  deck(w,s,g){
    if(s.shape)return null;
    if(s.kind==='wall'&&s.id==='garden-bed-bench')return trough(w,s,g);
    if(s.kind==='spring')return mushroomSpring(w,s,g);
    if(s.kind==='ledge'&&s.id==='garden-crown')return keystone(w,s,g);
    if(s.kind==='ledge')return floatPad(w,s,g);
    if(s.kind==='pulse')return eyePad(w,s,g);
    if(s.kind==='crumble')return snappingFlower(w,s,g);
    return null;
  },

  // Scenery by WORLD x: decks are looked up by id, so the same list works in
  // the full chapter (where the entry deck is `start`) and in a solo build.
  // One flower watches the spawn; then two, then more, and after the arch
  // they grow and lean harder, until three giants see the player out.
  props(section,L){
    const decks=sectionDecks(L,section),entry=decks[0];
    const step2=deck(L,'garden-step-2'),float2=deck(L,'garden-float-2'),mound=deck(L,'garden-mound'),dock=deck(L,'garden-dock'),bench=deck(L,'garden-bed-bench'),exit=deck(L,'garden-exit');
    const list=[];
    const bloom=(key,on,dx,height,strength,seed,z=-1.25)=>on&&list.push({key,x:on.x+dx,y:on.y,w:height*.6,z,make:(w,parent)=>flower(w,parent,{height,strength,seed})});
    const shroom=(key,on,dx,size,eye=false)=>on&&list.push({key,x:on.x+dx,y:on.y,w:2.2*size,z:-1.1,make:(w,parent)=>mushroom(w,parent,{size,eye,seed:dx*3+size})});
    const shrub=(key,on,dx,size)=>on&&list.push({key,x:on.x+dx,y:on.y,w:2*size,z:-1.3,make:(w,parent)=>bush(w,parent,size)});
    // The familiar start: one big flower turns to watch the spawn.
    bloom('flower-a',entry,3.5,3.6,.18,1);shrub('bush-a',entry,1.4,1);shroom('mushroom-a',entry,11,.6);
    // The steps and the pads: a second flower, then a small third one.
    bloom('flower-b',step2,5,2.4,.2,2);shroom('mushroom-b',step2,1,.5);
    bloom('flower-c',float2,2.2,1.8,.22,3);
    // The arch deck: the arch, and a flower either side of its legs.
    if(mound)list.push({key:'arch',x:mound.x+ARCH_IN,y:mound.y,w:7,z:-1.35,make:(w,parent)=>crookedArch(w,parent)});
    bloom('flower-d',mound,1.2,2.6,.24,4);bloom('flower-e',mound,6.5,2.9,.32,5);shroom('mushroom-c',mound,7.5,.55);
    // The dock and the bed: taller flowers, an eyed mushroom, and two small
    // ones standing on the trough's back rim.
    bloom('flower-f',dock,.8,3.2,.36,6);bloom('flower-g',dock,4.9,3.6,.38,7);shroom('mushroom-d',dock,5.6,.5,true);
    bloom('flower-h',bench,8.2,1.4,.4,8,-2.1);bloom('flower-i',bench,11.6,1.2,.4,9,-2.1);
    // The exit: three giants, two eyed mushrooms and a bush see the player out.
    bloom('flower-j',exit,1.6,3.4,.4,10);bloom('flower-k',exit,5.2,4.2,.42,11);bloom('flower-l',exit,8.6,4.6,.45,12);
    shroom('mushroom-e',exit,3.6,.7,true);shroom('mushroom-f',exit,7.4,.5,true);shrub('bush-b',exit,6.6,.8);
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
    w.box(h.w+.6,2.6,3.2,slime(w),g,h.w/2,-.85,-.4,.5).name='Slime pool';
    const cones=Math.min(14,Math.max(3,Math.round(h.w/1.9)));
    for(let i=0;i<cones;i++){
      const x=(i+.5)/cones*h.w+(rand(i+h.x)-.5)*.6,z=-.3+rand(i*5+h.x)*.9,r=.28+rand(i*3+h.x)*.16,hh=.8+rand(i*7+h.x)*.9;
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

  // Far scenery, placed once by world x. Before the arch: salmon mesas, far
  // pink mushrooms, and a sky of pink swirl streaks and puffy clouds. After it:
  // coils that turn, floating islands with waterfalls, giant purple mushrooms.
  // Parallax shows a far item from up to |Δx|·factor < 15 away, so the
  // post-arch pieces sit far enough right (factor .3, ≥ +95) that none of
  // them shows before the player has passed the arch.
  // The camera is orthographic, so far things are drawn small rather than
  // shrunk by distance; the view is only ten units tall, so the sky sits
  // between y 5 and 9; and the fog (30..98 from a camera at z 26) has taken
  // most of a colour by z −40, so the rock stands at z −25 where a third of
  // it is haze, and only the clouds sit deeper.
  quietBackdrop:true,
  backdrop(w,L,section,layers){
    const far=layers.at(.22),sky=layers.at(.1),mid=layers.at(.3);
    const x0=section.x;
    for(const [dx,width,height,seed] of [[3,3,5.2,1],[18,3.8,6.4,2],[33,2.6,4.4,3],[49,3.2,5.4,4]])mesa(w,layers.place(far,x0+dx,-3.5,-25),width,height,seed);
    for(const [dx,height,cap] of [[10,4.2,1.5],[40,4.6,1.7]])farMushroom(w,layers.place(far,x0+dx,-3.5,-23),height,cap,'back2','back','cream');
    for(const [dx,y,len,tilt] of [[-6,5,.8,.04],[10,6.6,.62,-.05],[24,4.4,.9,.03],[38,6.2,.7,-.04],[50,5.4,.8,.05]]){
      const g=layers.place(sky,x0+dx,y,-38);
      const s=w.mesh(streak(w),cloud(w),g,0,0,0);s.scale.set(len,.36,.3);s.rotation.z=tilt;s.name='Sky swirl streak';
    }
    for(const [dx,y,size] of [[2,4,1.1],[30,6,.9],[46,4.6,1]])puffCloud(w,layers.place(sky,x0+dx,y,-38),size);
    for(const [i,[dx,y,size]] of [[96,7.2,.7],[110,5.6,.55],[124,8.2,.75]].entries()){
      const g=layers.place(mid,x0+dx,y,-34);
      const c=w.mesh(coil(w),i%2?peach(w):cloud(w),g,0,0,0);c.scale.set(size,size*.72,.4);c.name='Sky coil';
      w.dreamSwirls?.push({mesh:c,speed:(i%2?-1:1)*.14});
    }
    for(const [dx,y,width] of [[102,3.4,3.4],[118,4.6,2.8]])island(w,layers.place(mid,x0+dx,y,-30),width);
    for(const [dx,height,cap] of [[94,5.4,1.9],[112,6.4,2.2]])farMushroom(w,layers.place(mid,x0+dx,-3.5,-31),height,cap,'terrain','terrain2','gold');
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
