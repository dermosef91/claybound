import * as THREE from '../lib/three.module.js';
import {deck,lean,slot,rand} from './support.js';
import {createDreamFlower} from '../dream-views.js';
import {clayMaterial} from '../clay.js';
// Section 10 — The Dream Knot. ONE idea: the knot over the climb comes undone
// as its three violet strands are worked, and when the flower is picked the
// whole dream collapses into it. Everything the player stands on is a fragment
// of an earlier section bleached to cloud-lilac (the palette's main) with an
// ultramarine cap (secondary); the knot alone keeps four hues — magenta,
// lemon, mint, ultramarine — which drain to lilac when the flower ripens.
// Fragments drift in the parallax as leaners; the mobile is a parade hat, the
// saucer an orchard saucer; the wake deck is the shipped canyon, plain, with
// one cactus and the ordinary bell.
//
// Everything here is render-only. animate() reads game.finale ({state,time,
// strands}) and poses the knot, the fragments, the sky spiral, the fog and the
// camera roll through the four states: waiting → ripe → pickup → awake.

const LILAC=new THREE.Color('#e5dbf8'),CREAM_OUT=new THREE.Color('#f6f0ff');
const CANYON_SKY=new THREE.Color('#87a9cc'),CANYON_FOG=new THREE.Color('#d7b39b');
const HUES=[['magenta','#e14b9d'],['lemon','#f2ee74'],['mint','#7fdcc0'],['ultramarine','#3f4dc7']];
const VIOLET='#7a55b5',CACTUS='#408559';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const easeIn=t=>{t=Math.max(0,Math.min(1,t));return t*t;};
const ease=(v,target,dt,rate)=>v+(target-v)*(1-Math.exp(-dt*rate));
function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}

// The knot's own materials, made once per world and re-hooked into the clay
// relief. The four hues are the section's licensed extra colours (the palette
// slots carry lilac, ultramarine, magenta and lemon; mint and the violet of the
// strands exist nowhere else), and owning them is what lets ripening drain
// them to lilac without touching the shared theme.
function materials(w){
  if(w.knotMaterials)return w.knotMaterials;
  const make=(hex,extra={})=>clayMaterial(w,new THREE.MeshStandardMaterial({color:hex,roughness:.6,metalness:0,...extra}),.05);
  const m={hues:HUES.map(([,hex])=>make(hex)),base:HUES.map(([,hex])=>new THREE.Color(hex)),
    violet:make(VIOLET,{emissive:VIOLET,emissiveIntensity:.05}),cactus:make(CACTUS)};
  w.knotMaterials=m;return m;
}
const resetHues=m=>m.hues.forEach((mat,i)=>mat.color.copy(m.base[i]));

// --- deck dressing -----------------------------------------------------------
// A fragment island: an ultramarine cap over a soft lilac lump that narrows
// downward into one drip, with two lemon beads at the cap's ends. Cheaper than
// the chapter's rolled slab and reads as a torn-off piece of somewhere else.
function fragmentDeck(w,s,g,seed){
  const width=s.w,cx=width/2;
  w.box(width+.1,.46,3.4,slot(w,'top'),g,cx,-.2,0,.2).name='Fragment cap';
  w.box(width-.2,1.6,3.1,slot(w,'terrain'),g,cx,-1.15,-.05,.6).name='Fragment body';
  w.ball(Math.max(1,width*.42),1.5,1.5,slot(w,'terrain'),g,cx+(rand(seed)-.5)*.6,-2.5,-.1).name='Fragment lump';
  w.ball(Math.max(.7,width*.26),1,1,slot(w,'terrain2'),g,cx-(rand(seed+1)-.5)*.8,-3.7,0).name='Fragment underside';
  w.ball(.26,.7,.26,slot(w,'terrain'),g,width*(.3+rand(seed+2)*.4),-4.6,.35).name='Fragment drip';
  w.ball(.2,.12,.2,slot(w,'accent'),g,.55,.02,.95).name='Fragment bead';
  w.ball(.16,.1,.16,slot(w,'accent'),g,width-.65,.02,.85).name='Fragment bead';
}
// The wake deck: the ordinary world. A plain terracotta mesa in the canyon's
// own palette (main/secondary are the shipped canyon colours past x 90), a few
// boulders down its face and one cactus in the desert theme's foliage green.
function wakeDeck(w,s,g){
  const width=s.w,cx=width/2,m=materials(w);
  w.box(width+.1,.5,3.6,slot(w,'top'),g,cx,-.22,0,.2).name='Mesa cap';
  w.box(width,5.6,3.4,slot(w,'terrain'),g,cx,-3.2,0,.55).name='Mesa body';
  w.box(width-1.2,5,3,slot(w,'terrain2'),g,cx,-8.4,-.1,.7).name='Mesa foot';
  for(let i=0;i<4;i++)w.ball(.75+rand(i+3)*.35,.6+rand(i+4)*.3,.6,i%2?slot(w,'terrain2'):slot(w,'terrain'),g,1.2+i*(width-2.4)/3,-.9-rand(i+5)*3.5,1.55).name='Mesa boulder';
  const cactus=group(g,'Wake cactus',1.1,0,-1.25);
  w.box(.5,2.7,.5,m.cactus,cactus,0,1.35,0,.24).name='Cactus trunk';
  w.box(.34,1.1,.34,m.cactus,cactus,-.55,1.6,0,.16).name='Cactus arm';w.box(.5,.3,.34,m.cactus,cactus,-.4,1.1,0,.14).name='Cactus arm';
  w.box(.34,.9,.34,m.cactus,cactus,.55,2,0,.16).name='Cactus arm';w.box(.5,.3,.34,m.cactus,cactus,.4,1.6,0,.14).name='Cactus arm';
  w.ball(.14,.1,.14,'cream',cactus,0,2.78,0).name='Cactus flower';
}
// The altar's two gate stones, each with a hole, either side of where the flower stands.
function altar(w,s,g){
  for(const x of [.7,s.w-.7]){
    const post=group(g,'Altar stone',x,0,-1.1);
    w.box(.8,1.9,.7,slot(w,'terrain'),post,0,.95,0,.3).name='Altar stone body';
    w.ball(.2,.2,.2,slot(w,'terrain2'),post,0,1.35,.36).name='Altar stone hole';
    w.box(.55,.22,.55,slot(w,'top'),post,0,1.95,0,.1).name='Altar stone cap';
  }
}

// --- the fragments in the sky ------------------------------------------------
// Cheap lilac groups placed in the parallax by world x, each pivoting at its
// foot so a lean tilts the whole thing; the eye's lid is posed by animate().
function curledSlab(w,g){
  w.box(3.2,.5,1.2,slot(w,'terrain'),g,0,.25,0,.2).name='Slab';w.box(3,.22,1.1,slot(w,'top'),g,0,.55,0,.1).name='Slab cap';
  w.ball(.5,.4,.6,slot(w,'terrain'),g,1.7,.7,0).name='Slab curl';w.ball(.3,.26,.45,slot(w,'accent'),g,1.75,1.05,.1).name='Slab curl bead';
}
function hungSaucer(w,g){
  w.ball(1.4,.26,1.1,slot(w,'terrain'),g,0,0,0).name='Saucer';w.ball(1,.14,.8,slot(w,'top'),g,0,.2,0).name='Saucer glaze';
  w.rope([0,.2,0],[0,5,0],g,.05).name='Saucer rope';w.ball(.35,.25,.35,slot(w,'terrain'),g,0,5.1,0).name='Saucer knot';
}
function teacup(w,g){
  w.cylinder(1,1.5,slot(w,'terrain'),g,0,.75,0).name='Cup';w.cylinder(1.1,.24,slot(w,'top'),g,0,1.5,0).name='Cup rim';
  const handle=w.mesh(new THREE.TorusGeometry(.42,.12,6,18),slot(w,'terrain'),g,1.15,.8,0);handle.name='Cup handle';
  w.ball(.75,.12,.75,slot(w,'accent'),g,0,1.62,0).name='Cup tea';
}
function stripedPillar(w,g){
  w.box(1.1,5.5,1.1,slot(w,'terrain'),g,0,2.75,0,.4).name='Pillar';
  for(const y of [1,2.5,4])w.box(1.18,.36,1.18,slot(w,'accent'),g,0,y,0,.12).name='Pillar stripe';
  w.ball(.8,.5,.8,slot(w,'top'),g,0,5.7,0).name='Pillar cap';
}
function giantBoot(w,g){
  w.box(1.6,2.6,1.3,slot(w,'terrain'),g,-.3,1.5,0,.45).name='Boot leg';w.box(2.9,1.1,1.4,slot(w,'terrain'),g,.35,.55,0,.45).name='Boot foot';
  w.box(3,.32,1.5,slot(w,'top'),g,.35,.05,0,.1).name='Boot sole';w.ball(.3,.3,.3,slot(w,'accent'),g,-.3,2.9,.4).name='Boot lace';
}
// The corridor's eye: a lilac disc, an ultramarine iris, and a lid that slides
// down over it until the player draws near.
function eyeFragment(w,g){
  const disc=w.ball(1.5,1.5,.5,slot(w,'terrain'),g,0,1.5,0);disc.name='Eye disc';
  w.ball(.62,.62,.3,slot(w,'top'),g,0,1.5,.35).name='Eye iris';w.ball(.24,.24,.2,'dark',g,0,1.5,.55).name='Eye pupil';
  const lid=group(g,'Eye lid',0,3,.3);w.ball(1.55,1.55,.34,slot(w,'terrain2'),lid,0,-1.5,0).name='Eye lid shell';
  return lid;
}
// Base heights are low: a layer climbs with the camera (heightFollow), so a
// fragment at y 3–8 hangs in the sky beside the knot all the way up the climb.
const FRAGMENTS=[
  {key:'boot',x:14,y:3.5,factor:.32,z:-34,build:giantBoot,scale:1.1},
  {key:'slab',x:30,y:6,factor:.48,z:-26,build:curledSlab,scale:1},
  {key:'saucer',x:46,y:2.5,factor:.48,z:-27,build:hungSaucer,scale:1},
  {key:'eye',x:56,y:7.5,factor:.36,z:-33,build:eyeFragment,scale:1.15},
  {key:'teacup',x:76,y:4,factor:.32,z:-35,build:teacup,scale:1.3},
  {key:'pillar',x:86,y:1,factor:.48,z:-25,build:stripedPillar,scale:1}
];

// --- the knot ----------------------------------------------------------------
// ONE knot: a (3,2) torus-knot curve whose tube changes hue four times along
// its length (the reference's four-colour knot), with three thinner violet
// strands wound round the same path a little further out — the strands the
// stations undo — and, far behind, a flat swirl of cream tube for the sky.
// The whole thing tilts and turns slowly; animate() owns every motion.
class KnotArc extends THREE.Curve{
  constructor(R,p,q,s0,s1){super();this.R=R;this.p=p;this.q=q;this.s0=s0;this.s1=s1;}
  getPoint(t,target=new THREE.Vector3()){
    const u=(this.s0+(this.s1-this.s0)*t)*this.p*Math.PI*2,cs=Math.cos(this.q/this.p*u);
    return target.set(this.R*(2+cs)*.5*Math.cos(u),this.R*(2+cs)*.5*Math.sin(u),this.R*Math.sin(this.q/this.p*u)*.5);
  }
}
function buildKnot(w,parent,section,L){
  const m=materials(w);resetHues(m);
  const root=group(parent,'The dream knot');
  const tilt=group(root,'Knot tilt');tilt.rotation.set(.95,.3,0);
  const spin=group(tilt,'Knot spin');
  const R=2.6;
  const tubes=HUES.map(([name],i)=>{
    const arc=new KnotArc(R,3,2,i/4,(i+1)/4);
    const mesh=w.mesh(new THREE.TubeGeometry(arc,80,.88,16,false),m.hues[i],spin,0,0,0);
    mesh.name=`Knot tube ${name}`;mesh.castShadow=false;return mesh;
  });
  const strands=(L.finale?.requires||[]).slice(0,3).map((id,i)=>{
    const holder=group(spin,`Knot strand ${id}`);holder.rotation.z=i*Math.PI*2/9;
    const mesh=w.mesh(new THREE.TubeGeometry(new KnotArc(R*1.16+i*.12,3,2,0,1),200,.24,8,true),m.violet,holder,0,0,0);
    mesh.name='Violet strand';mesh.castShadow=false;
    return {id,holder,k:1};
  });
  // The sky spiral: two turns of thin flat tube, far behind the knot.
  const points=[];for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*4,r=3.8+t*6.2;points.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r*.62,0));}
  const spiral=w.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),140,.12,6,false),'cream',root,0,.5,-7);
  spiral.name='Sky spiral';spiral.castShadow=false;spiral.receiveShadow=false;
  const view={root,tilt,spin,tubes,strands,spiral,speed:.12,angle:rand(section.x)*6,fat:1,ripe:0,time:0,rollFrom:null,frozen:false};
  w.knotView=view;return view;
}

export default {
  key:'knot',
  dress(w,s,g){
    if(s.goal){wakeDeck(w,s,g);return true;}
    if(s.id==='knot-crown')altar(w,s,g);
    fragmentDeck(w,s,g,Math.round(s.x));
    if(s.id==='knot-entry')for(const x of [.3,s.w-.3]){w.ball(.55,.42,1.6,slot(w,'top'),g,x,0,.1).name='Entry curl';w.ball(.3,.26,1.1,slot(w,'accent'),g,x,.38,.3).name='Entry curl bead';}
    return true;
  },
  deck(w,s,g){
    const cx=s.w/2;
    if(s.id==='knot-saucer'){
      // An orchard saucer hanging from a rope into nothing.
      g.name='Orchard saucer';
      w.ball(cx+.15,.24,1.2,'cream',g,cx,-.12,0).name='Saucer dish';w.ball(cx-.3,.14,.9,slot(w,'top'),g,cx,.02,0).name='Saucer glaze';
      w.ball(.7,.5,.7,slot(w,'terrain'),g,cx,-.7,0).name='Saucer cup';
      w.rope([cx,0,-.6],[cx,5.5,-.6],g,.05).name='Saucer rope';
      return {root:g};
    }
    if(s.id==='knot-mobile'){
      // A parade hat upside down: the brim is the deck, the crown hangs below.
      g.name='Parade hat';
      w.cylinder(cx+.1,.24,slot(w,'top'),g,cx,-.12,0).name='Hat brim';
      w.cylinder(.78,1.35,slot(w,'top'),g,cx,-.9,0).name='Hat crown';
      w.cylinder(.84,.3,slot(w,'accent'),g,cx,-.45,0).name='Hat band';
      w.ball(.2,.2,.2,'cream',g,cx+.6,-.45,.7).name='Hat feather bead';
      return {root:g};
    }
    if(s.kind==='crumble'){
      // The crumbles are fragments too — a river disc and a doll chair — and
      // tremble from animate() while their timer runs (no fracture view needed).
      (w.knotCrumbles??=[]).push({id:s.id,root:g});
      if(s.id==='knot-crumb-1'){
        g.name='River disc';
        w.ball(cx+.1,.2,1.2,slot(w,'accent'),g,cx,-.1,0).name='Disc';w.ball(cx-.35,.12,.85,slot(w,'terrain'),g,cx,.02,0).name='Disc centre';
        w.ball(.5,.3,.5,slot(w,'terrain2'),g,cx,-.42,0).name='Disc underside';
      }else{
        g.name='Doll chair';
        w.box(s.w,.3,1.4,slot(w,'terrain'),g,cx,-.15,0,.1).name='Chair seat';
        w.box(s.w-.3,.2,1.1,slot(w,'top'),g,cx,-.36,0,.08).name='Chair cushion';
        for(const [x,z] of [[.3,-.5],[s.w-.3,-.5],[.3,.5],[s.w-.3,.5]])w.box(.16,1.3,.16,slot(w,'terrain2'),g,x,-.95,z,.05).name='Chair leg';
        w.box(.16,1.6,1.2,slot(w,'terrain'),g,s.w-.1,-1.4,0,.06).name='Chair back';
      }
      return {root:g};
    }
    if(s.kind==='wall'){
      // A strand's post: a lilac pillar with an ultramarine collar under the clay.
      g.name='Strand post · '+s.id;const h=s.h??4;
      w.box(s.w,h,2,slot(w,'terrain'),g,cx,-h/2,0,Math.min(.3,s.w/5)).name='Post body';
      w.box(s.w+.2,.32,2.2,slot(w,'top'),g,cx,-.16,0,.1).name='Post collar';
      w.ball(.22,.22,.22,slot(w,'accent'),g,cx,-h+.4,1.05).name='Post bead';
      return {root:g};
    }
    return null;
  },
  backdrop(w,L,section,layers){
    const view=w.knotFragments=[];
    for(const f of FRAGMENTS){
      const layer=layers.at(f.factor),placed=layers.place(layer,section.x+f.x,f.y,f.z);placed.name='Knot fragment · '+f.key;
      const g=lean(w,group(placed,'Fragment '+f.key),{y:f.y,strength:.1});g.scale.setScalar(f.scale);
      const lid=f.build(w,g);
      view.push({key:f.key,placed,group:g,scale:f.scale,lid:lid||null,lidK:0,leaner:w.dreamLeaners.at(-1)});
    }
  },
  props(section,L){
    const crown=deck(L,'knot-crown');if(!crown)return [];
    const kx=section.x+63,ky=17.5;
    return [
      {key:'knot',x:kx,y:ky,z:-7,w:96,make:(w,parent)=>{buildKnot(w,parent,section,L);}},
      // The finale flower, posed by dream.js through the ending's states.
      ...(L.finale?[{key:'flower',x:L.finale.flower.x,y:L.finale.flower.y,z:0,w:2,make:(w,parent)=>{const v=createDreamFlower(w,L,parent);if(v)v.root.position.set(0,0,.3);}}]:[])
    ];
  },
  animate(w,game,dt,section,ctx){
    const K=w.knotView,F=game.finale,state=F?.state||'waiting',worked=F?.strands||[],still=ctx.reducedMotion;
    const frags=w.knotFragments||[];
    // The eye opens as the player draws near, whatever the ending is doing.
    for(const f of frags)if(f.lid){
      const near=Math.abs(f.group.getWorldPosition(scratch).x-ctx.playerX)<11;
      f.lidK=still?(near?1:0):ease(f.lidK,near?1:0,dt,2.5);f.lid.position.y=3+f.lidK*2.1*f.scale;
    }
    // Crumble views that have streamed out are dropped here, so a long session
    // of rebuilds never grows the list.
    if(w.knotCrumbles)w.knotCrumbles=w.knotCrumbles.filter(c=>c.root.parent);
    for(const c of w.knotCrumbles||[]){
      const s=game.level.platforms.find(q=>q.id===c.id);
      const k=s?.timer>0&&!still?Math.min(1,s.timer/(s.delay??.62)):0;
      c.root.rotation.z=Math.sin(game.time*38)*.035*k;c.root.position.y=s?s.y+Math.sin(game.time*52)*.03*k:c.root.position.y;
    }
    if(!K||!K.root.parent)return;
    K.time+=dt;
    if(state==='awake'){K.root.visible=false;for(const f of frags)f.group.visible=false;return;}
    K.root.visible=true;
    const m=materials(w),t=K.time;
    // 1. The climb: each worked strand fades from the knot; after the first the
    //    spin quickens, after the second the tubes fatten and loosen.
    for(const s of K.strands){s.k=ease(s.k,worked.includes(s.id)?0:1,dt,1/.4);s.holder.scale.setScalar(Math.max(.001,s.k));s.holder.visible=s.k>.003;}
    const quick=worked.length>=1?1.2:1,fatTarget=worked.length>=2?1.12:1;
    K.fat=ease(K.fat,fatTarget,dt,1.5);
    // 2. Ripe: the knot eases to a stop and its hues drain to lilac; the fragments freeze.
    const ripe=state==='ripe'||state==='pickup';
    K.ripe=ease(K.ripe,ripe?1:0,dt,ripe?3:2);
    m.hues.forEach((mat,i)=>mat.color.copy(m.base[i]).lerp(LILAC,K.ripe));
    if(ripe&&!K.frozen){K.frozen=true;for(const f of frags)if(f.leaner){f.leaner.rest=f.leaner.angle??f.leaner.rest;f.leaner.strength=0;}}
    const speed=still?0:K.speed*quick*(1-K.ripe);
    K.angle+=speed*dt;K.spin.rotation.z=K.angle;
    K.tilt.rotation.y=.3+(still?0:Math.sin(t*.21)*.4*(1-K.ripe));K.tilt.rotation.x=.95+(still?0:Math.sin(t*.13)*.12*(1-K.ripe));
    K.spiral.rotation.z=-(still?0:t*.05);
    let collapse=1,spiralScale=1;
    if(state==='pickup'){
      // 3. Pickup: the roll snaps toward level, the fragments and the tubes race
      //    to the knot's centre and shrink, the knot folds to a lump, the fog
      //    whitens and the lump drops out of frame; the sky is cream by the end.
      const p=F.time,D=game.level.finale?.duration??6;
      if(K.rollFrom===null)K.rollFrom=w.dreamRoll||0;
      w.dreamRoll=K.rollFrom*(1-smooth(p/1.5));
      const k1=easeIn(p/1.5),k2=smooth((p-1.5)/2),k3=smooth((p-3.5)/1.1);
      collapse=(1-.55*k1)*(1-.8*k2);spiralScale=1-.8*k1;
      K.spiral.rotation.z=-(t*.05+k1*2.2);
      K.root.position.y=-16*k3*k3;
      K.spin.rotation.z=K.angle+k1*p*2.5;
      K.root.getWorldPosition(scratch);
      for(const f of frags){
        f.placed.getWorldPosition(scratch2);
        f.group.position.set((scratch.x-scratch2.x)*k1,(scratch.y-scratch2.y)*k1,0);
        f.group.scale.setScalar(Math.max(.001,f.scale*(1-k1)));f.group.visible=k1<.999;
      }
      if(w.scene?.fog){const fog=w.scene.fog.color;fog.lerp(CREAM_OUT,Math.min(1,dt*(1.2*k2)));if(p>3.5)fog.lerp(CANYON_FOG,Math.min(1,dt*.8));}
      if(w.scene?.background?.isColor){const sky=w.scene.background;if(p>1.5)sky.lerp(p>3.5?CREAM_OUT:CANYON_SKY,Math.min(1,dt*(p>3.5?1.6:.5)));}
      // The camera drifts toward the knot so the collapse happens on screen; a
      // translation only, so the authored roll is untouched.
      if(w.camera){const pan=smooth(p/1.2)*(1-k3*.4);w.camera.position.x+=(scratch.x-(w.cameraX??scratch.x))*.55*pan;w.camera.position.y+=(scratch.y-2.2-(w.cameraY??scratch.y))*.35*pan;}
    }else{
      K.rollFrom=null;K.root.position.y=0;
      for(const f of frags){f.group.position.set(0,0,0);f.group.scale.setScalar(f.scale);f.group.visible=true;}
    }
    K.spin.scale.set(K.fat*collapse,K.fat*collapse,K.fat*collapse*1.45);
    K.spiral.scale.set(spiralScale,spiralScale,1);
  }
};
const scratch=new THREE.Vector3(),scratch2=new THREE.Vector3();
