import * as THREE from './lib/three.module.js';
import {createGoal} from './goal.js';
import {canyonModel} from './canyon-assets.js';
import {forestModel} from './forest.js';
import {forestBloom,forestMushroom} from './forest-details.js';
import {cavernModel} from './cavern-asset.js';
import {caveCrystals,caveMushrooms,caveRock} from './cavern.js';
import {castle} from './castle.js';
import {cityLaundry} from './city-laundry.js';
import {cloudModel} from './clouds.js';
import {clayTree} from './environments.js';
import {dreamSculpture,dreamGiraffe,dreamPlanet,dreamSaucer,dreamFlower,dreamSun} from './dream-assets.js';
import {clayMaterial} from './clay.js';

// A clay the chapter's own palette does not carry — the quarter's is all blues
// and oranges, and its towers wear green grass. Cached on the view's own
// material set so the diorama never hands the running chapter a material.
function clay(w,name,color,depth=.06){
  if(!w.mat[name]){w.mat[name]=new THREE.MeshStandardMaterial({color,roughness:.97,metalness:0});clayMaterial(w,w.mat[name],depth);}
  return name;
}

// One diorama per chapter, photographed the same way: a low lens almost level
// with a wide stage, the hero centred on it with both arms up, the gate they
// have just rung immediately to their right, and behind the stage's far lip
// the chapter's own country, out of focus. The stage and everything standing
// on it go in `front` and draw sharp; the country goes in `back` and draws
// soft. What each chapter puts where is what makes it that chapter.
//
// `node scripts/frame-completion.mjs <chapter> --slots` solves this frame:
// where a world point lands on the canvas, and what world point lands at a
// given place on it. The camera looks nearly straight down −z, so unlike the
// earlier over-the-shoulder version, x really is across and depth really is
// 15.6 − z — but the vertical still has to be solved, because the lens is
// pitched and the stage is seen at a grazing angle.

// The stage's own numbers. The hero stands a little right of centre, the gate
// right of them with its flag reaching to about 87% across, and the front lip
// is where y = 0 lands at 80% down — just in front of the hero's feet.
export const STAGE={width:24,depth:10.4,lipZ:.7,thickness:4.2};
export const AT={hero:[.55,0],gate:[4.05,-.9],gateTurn:-.15,gateScale:.88};
export const VIEW={position:[0,3,15.6],target:[0,1.9,-1.6],fov:33,focus:[.5,.57]};
// Portrait keeps the buttons where the old layout had them, down the left,
// so the stage cluster is framed up and to the right of them: the lens aims
// between the hero and the gate from further back, and the frustum offset
// puts that point at 72% across and 42% down.
export const VIEW_PORTRAIT={position:[2.3,4.6,26],target:[2.3,2.1,-1.5],fov:46,focus:[.8,.66]};
const HERO={x:AT.hero[0],y:0,z:AT.hero[1],yaw:Math.PI/2,scale:1,cheer:1};

// The stage: one wide slab spanning the frame, its front face in view below
// the lip, its top receding to the far edge. Per-chapter dressing goes on top.
function stage(w,front,{top='top',body='terrain',under='terrain2',width=STAGE.width,depth=STAGE.depth,lipZ=STAGE.lipZ,thickness=STAGE.thickness,round=.28,x=0}={}){
  const g=new THREE.Group();g.name='Diorama stage';g.position.set(x,0,lipZ-depth/2);front.add(g);
  w.box(width,.7,depth,top,g,0,-.35,0,round);
  w.box(width*.995,thickness-.7,depth*.99,body,g,0,-.35-(thickness-.7)/2,0,round);
  // The face is not one plane: two courses proud of it read as strata, and
  // below the stage a darker course sinks into whatever the chapter stands on.
  w.box(width*.94,.9,depth*.96,under,g,.3,-thickness*.62,.05,.24);
  w.box(width*1.02,1.4,depth*.7,under,g,-.4,-thickness-.5,-.6,.4);
  // Ledges standing a hand proud of the face, so the drop reads as layered
  // rock and not as a painted wall.
  for(const [i,[dx,dy,wd,h]]of [[-6,-1.1,7,.42],[4,-1.7,9,.4],[-2,-2.5,6,.44],[8,-1,5,.36],[-9,-2.1,4,.4],[1,-3.2,10,.5],[-7,-3.4,6,.46]].entries())
    w.box(wd,h,.7,i%2?body:under,g,dx,dy,depth/2+.2,.16);
  w.box(width*1.01,.34,depth*1.03,top,g,0,-.17,.12,.17);
  return g;
}

// The gate, facing the camera with a small turn so its timbers read as round.
function gate(w,front,{x=AT.gate[0],z=AT.gate[1],turn=AT.gateTurn,scale=AT.gateScale}={}){
  const g=new THREE.Group();g.name='Diorama goal gate';
  g.position.set(x,0,z);g.rotation.y=turn;g.scale.setScalar(scale);front.add(g);
  createGoal(w,g,0,0);
  return g;
}

// Small clay stones scattered where a stage meets the eye: at the hero's own
// scale, so the ground reads as ground and not as a plate.
function stones(w,parent,mat,list){
  for(const [i,[x,z,r]]of list.entries()){
    const s=w.ball(r,r*.62,r*.86,mat,parent,x,-.02,z);s.rotation.set(0,i*.83,0);
  }
}

// A bank of the supplied cloud, scattered in depth. Fog is left on: out of
// focus and half fogged is what a far cloud looks like.
function clouds(w,parent,list){
  for(const [x,y,z,width,turn]of list){
    const model=cloudModel(w,parent,x,y,z,width,turn||0);
    model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  }
}

export const DIORAMAS={
  // ---------------------------------------------------------------------------
  // One · The Sunbaked Canyon. A terracotta plateau under a deep blue sky; the
  // Great Arch behind the buttons in the middle distance, a tall mesa each
  // side, the caravan's banner on a ledge to the left, and cacti on the stage.
  desert:{
    biome:'desert',blur:1.5,
    light:{
      sky:'#eaf3ff',ground:'#b5623a',ambient:1.6,
      sunColor:'#ffd9a4',sunPower:4.4,sun:[12,28,9],sunTarget:[0,1,-4],shadow:20,
      fill:'#c9def5',fillPower:.7,fillFrom:[-14,8,12],
      rim:'#ffc38a',rimPower:1.2,rimFrom:[-6,6,-14],
      zenith:'#1565d4',horizon:'#a4cae8',haze:'#ffd8b2',
      sunDirection:[14,9,-6],sunSize:260,sunGlow:1,hazeHeight:1.45,
      fog:'#d6a58a',fogNear:40,fogFar:170
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,front,back,{spin}){
      stage(w,front,{width:20.6,x:6.7});
      gate(w,front);
      // Cacti: one tall to the hero's left, two at the right edge.
      canyonModel(w,'cactus',front,-1.9,-.05,-.5,2,.35);
      canyonModel(w,'cactus',front,7,-.05,-1.4,2.2,-.4);
      canyonModel(w,'cactus',front,8.1,-.05,.1,1.4,.7);
      const potSeat=new THREE.Group();potSeat.position.set(5.75,0,.35);front.add(potSeat);w.pot(potSeat,0,-.06,.34);
      stones(w,front,'terrain',[[-1,.3,.26],[-.4,.1,.16],[5.2,-.3,.24],[5.9,.15,.15],[-2.9,-.5,.3],[1.6,-2.6,.2],[7.2,-2.4,.28],[-3.1,-1.9,.22],[2.6,-3.8,.3]]);

      // The middle distance, out of focus: the banner on its own ledge, the
      // arch behind the buttons, and a mesa either side.
      // The caravan's banner on an outcrop of its own, left of the plateau's
      // corner and a step lower, its posts standing on it in full. Behind the
      // stage its feet were swallowed by the stage's top and it read as
      // standing behind the platform.
      const ledge=new THREE.Group();ledge.position.set(-6.3,-.75,-3.4);front.add(ledge);
      w.box(5.2,.7,4.8,'top',ledge,0,-.35,0,.3);
      w.box(5,3.6,4.6,'terrain',ledge,0,-2.5,0,.4);
      w.box(4.6,.5,4.7,'terrain2',ledge,.2,-1.6,.15,.18);w.box(3.8,.45,4.7,'terrain2',ledge,-.3,-3.1,.15,.18);
      w.ball(1.2,.9,1.1,'terrain',ledge,-2.9,-3.6,.6);
      canyonModel(w,'tent',ledge,.1,-.02,.5,2.8,.08);
      canyonModel(w,'cactus',ledge,2,-.02,1.4,.8,.4);
      stones(w,ledge,'terrain',[[-1.7,1.3,.24],[1.6,-1.4,.2],[-2.2,-.6,.28]]);
      // Rubble in the gap between the outcrop and the plateau.
      w.ball(.7,.5,.7,'terrain',front,-3.75,-1.1,-2,).rotation.y=.4;
      // The arch, behind the buttons, big enough that its opening is the
      // first thing in the country to read.
      canyonModel(w,'arch',back,-1.6,-5.2,-20,10,.1);
      // A tall mesa left, its strata catching the light, and the flagged one
      // right, both standing clear of the arch.
      canyonModel(w,'summit',back,-12.5,-4,-20.5,14.5,.25);
      canyonModel(w,'summit',back,-7.5,-4,-30,11,-.4);
      canyonModel(w,'cave',back,8.5,-5,-27,7,-.5);
      canyonModel(w,'summit',back,9,-4,-31,9,.5);
      const flagged=new THREE.Group();flagged.position.set(17.6,-4,-28.4);back.add(flagged);
      canyonModel(w,'summit',flagged,0,0,0,10.5,-.2);
      const pole=new THREE.Group();pole.position.set(.3,10.5,.2);flagged.add(pole);
      w.cylinder(.07,2.2,'bark',pole,0,1.1,0);
      w.box(1.3,.8,.08,'orange',pole,.75,1.8,0,.05);
      for(const [key,x,y,z,h,turn]of [['summit',-22,-6,-46,18,.4],['arch',-34,-6,-58,20,-.5],['summit',26,-7,-50,16,.6],['summit',2,-8,-66,22,.1],['summit',40,-6,-62,18,-.3],['summit',-2,-7,-44,12,.3]])
        canyonModel(w,key,back,x,y,z,h,turn);
      clouds(w,back,[[13,11,-30,10],[21,13.5,-40,12],[17,7,-46,7],[6,15,-56,10],[-20,14,-62,11],[34,10,-54,9]]);
    }
  },

  // ---------------------------------------------------------------------------
  // Two · The Wildwood. A grassy bough of a stage with leafy bushes along its
  // lip, two toadstools on the left, daisies; behind it the living tree's
  // trunks at the left edge, its canopy over the top, floating groves with
  // falls between them, and a lush green distance.
  forest:{
    biome:'forest',blur:1.6,
    light:{
      sky:'#eaf6dc',ground:'#4f6a3a',ambient:1.7,
      sunColor:'#ffe9b8',sunPower:4.2,sun:[16,22,12],sunTarget:[-1,2,-5],shadow:20,
      fill:'#c3e6da',fillPower:.7,fillFrom:[-12,7,14],
      rim:'#dcf0a8',rimPower:1.4,rimFrom:[-6,8,-14],
      zenith:'#2280d6',horizon:'#bfdcf0',haze:'#fff2c6',
      sunDirection:[16,10,6],sunSize:280,sunGlow:.75,hazeHeight:1.35,
      fog:'#cfe0c8',fogNear:28,fogFar:120
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,front,back,{spin}){
      stage(w,front,{top:'top',body:'terrain',under:'terrain2'});
      gate(w,front);
      // Toadstools to the hero's left: one big, one small.
      forestMushroom(w,front,-4.7,-.05,-1,2.6,.3);
      forestMushroom(w,front,-2.8,-.05,.1,1.15,-.4);
      // Leaves along the lip: small clusters of flattened leaf-balls, dozens
      // of them, with the light side up. Big single balls read as boulders.
      for(const [i,[x,z,s]]of [[-10.6,.4,1.15],[-8.4,.7,.9],[-6.2,.5,1],[-3.8,.8,.8],[-1.2,.7,.9],[1.3,.8,.78],[3.6,.7,.92],[6,.8,.8],[8.4,.6,1],[10.6,.4,1.15],[-9.4,-1.2,.65],[9.4,-1.4,.65],[-6.6,-1.6,.6]].entries()){
        const bush=new THREE.Group();bush.position.set(x,-.1,z);bush.rotation.y=i*.9;front.add(bush);
        // A rounded heart of three small masses, and leaf ovals set around it
        // at their own tilts, the pale ones catching the sun on top.
        w.ball(.42*s,.36*s,.4*s,'foliage',bush,0,.3*s,0);w.ball(.34*s,.3*s,.34*s,'foliage',bush,.32*s,.26*s,-.1*s);w.ball(.3*s,.28*s,.3*s,'leafLight',bush,-.28*s,.34*s,.12*s);
        for(const [k,[dx,dy,dz,turn,tilt]]of [[.5,.36,.2,.4,.9],[-.48,.3,-.16,-.6,1],[.1,.62,.42,1.4,.5],[-.2,.58,-.44,-1.6,.6],[.44,.14,-.4,2.2,1.1],[-.44,.1,.4,-2.4,1.2]].entries()){
          const leaf=w.ball(.3*s,.06*s+.03,.19*s,k%2?'leafLight':'foliage',bush,dx*s,dy*s,dz*s);leaf.rotation.set(tilt*.4,turn,.3);
        }
      }
      // Grass tufts on the top itself, so it is a lawn and not a green plate.
      for(const [i,[x,z]]of [[-9,-1.6],[-6.4,-3],[-3.2,-2.4],[.4,-3.4],[2.2,-1.4],[4.8,-3],[8.2,-2.2],[10.6,-3.6],[-1.6,-5],[6,-5.2]].entries())
        for(let k=0;k<4;k++)w.ball(.07,.28+(k%2)*.1,.07,k%2?'leafLight':'top',front,x+Math.cos(k*1.7+i)*.22,.1,z+Math.sin(k*1.7+i)*.22).rotation.set(.3*Math.sin(k+i),0,.3*Math.cos(k*2+i));
      for(const [x,z,s]of [[-1.4,-.5,.85],[3.4,-.4,.75],[7.2,-.7,.85],[-7.6,-1.8,.7],[9.6,-1.6,.7],[-6,-3,.6],[-9.8,-.4,.7]])forestBloom(w,front,x,-.02,z,s,x*.3);
      stones(w,front,'terrain',[[-6.6,-2,.2],[7.4,-2.3,.22]]);

      // The tree: two trunks at the left edge and the canopy across the top,
      // both out of focus, and the country beyond them.
      // The living tree: a trunk at the left edge the full height of the
      // frame, a second behind it, and the canopy hanging across the top.
      const trunk=new THREE.Group();trunk.position.set(-10.2,-6,-6.5);trunk.rotation.set(0,.2,.05);back.add(trunk);
      w.box(3.4,30,3.6,'bark',trunk,0,15,0,1.1);
      w.box(1.6,7,1.4,'bark',trunk,2.2,20,.4,.5).rotation.z=-.7;
      const trunk2=new THREE.Group();trunk2.position.set(-8,-5,-15);trunk2.rotation.set(0,-.3,-.04);back.add(trunk2);
      w.box(2.2,28,2.4,'bark',trunk2,0,14,0,.8);
      // The crown, built from leaf masses rather than the canopy model — that
      // model is a floating grove and shows its soil from underneath.
      for(const [i,[x,y,z,r]]of [[-9,9,-11,4.6],[-4,10.5,-12,4.2],[1,11.5,-13,4],[-12,12,-14,4.4],[-6,13.5,-15,4.8],[4,13,-16,4.4],[8,11.5,-18,3.8],[-1,14.5,-18,4.6],[12,13.5,-20,4],[-15,10,-16,3.6]].entries())
        w.ball(r,r*.78,r*.9,i%3?'foliage':'leafLight',back,x,y,z);
      // Boughs reaching out of the trunk into the crown.
      for(const [dx,dy,dz,len,rz,ry]of [[-9,7,-10,7,-.55,.3],[-8.5,10,-12,6,-.35,.9],[-10,12.5,-13,5,-.2,-.6]]){
        const bough=w.box(.9,len,.8,'bark',back,dx,dy,dz,.3);bough.rotation.set(0,ry,rz);
      }
      // The falls the chapter passes, in the gap between the groves.
      forestModel(w,'waterfall',back,-3.6,-6.5,-17,8,.15,true);
      forestModel(w,'falls',back,3.4,-6.5,-19,7,-.25,true);
      const water=clay(w,'fallsWater',0xe4f6fa,.02);w.mat.fallsWater.emissive.setHex(0x8fd0e0);w.mat.fallsWater.emissiveIntensity=.35;
      for(const [x,y,z,wd,h]of [[-3.5,-1,-16.4,.9,7],[3.5,-.6,-18.4,.7,6.5],[-11.5,-1.4,-19.6,.6,5]]){
        w.box(wd,h,.35,water,back,x,y,z,.18);
        w.ball(wd*1.1,.22,.7,water,back,x,y-h/2,z+.3);
      }
      forestModel(w,'grove',back,-8,-4,-24,10,.4,true);
      forestModel(w,'grove',back,9,-3,-27,10,-.6,true);
      // Grass-topped cliffs between the falls and the groves.
      for(const [i,[x,y,z,wd,h,d]]of [[-.5,-6,-21,5,7,4],[7,-5,-23,4,6,3.5],[-11,-5,-20,5,8,4],[14,-4,-25,4.5,6,3.5]].entries()){
        w.box(wd,h,d,'terrain',back,x,y+h/2,z,.5);w.box(wd*1.04,.5,d*1.04,'top',back,x,y+h+.2,z,.18);
        if(i)clayTree(w,back,x+wd*.2,y+h+.4,.4,'foliage',z);
      }
      forestModel(w,'heroMushroom',back,-13,-3,-22,6,.5);
      forestModel(w,'hills',back,-10,-12,-48,42,.1,true);
      forestModel(w,'hills',back,26,-13,-54,38,-.5,true);
      forestModel(w,'distant',back,14,-7,-42,24,.3,true);
      forestModel(w,'distant',back,-28,-8,-44,22,-.4,true);
      // Groves adrift in the air, trees on their tops.
      for(const [x,y,z,s]of [[11,2.5,-30,7],[20,4,-36,6],[-20,3,-32,5],[24,1,-46,5]]){
        const island=new THREE.Group();island.position.set(x,y,z);back.add(island);
        w.box(s,s*.55,s*.8,'terrain',island,0,-s*.28,0,s*.16);w.box(s*.96,.4,s*.76,'top',island,0,.15,0,.14);
        clayTree(w,island,s*.2,.3,s*.12,'foliage',0);clayTree(w,island,-s*.25,.3,s*.09,'leafLight',s*.15);
      }
      clouds(w,back,[[14,13,-34,11],[24,16,-46,13],[8,18,-58,10],[-18,17,-64,12],[30,10,-52,8]]);
    }
  },

  // ---------------------------------------------------------------------------
  // Three · The Ember Caverns. A dark stone stage in a blue-black chamber lit
  // by what grows in it: cyan crystals and amber mushrooms on the stage, the
  // same scattered across the ledges behind by the dozen, stalactites over
  // the top and shafts of pale light falling from the upper right.
  cave:{
    biome:'cave',blur:1.8,
    light:{
      sky:'#98afd4',ground:'#3a2418',ambient:1.3,
      // A warm key on the stage from above and in front: the gold bell and
      // the orange hero have to read in their own colours, and under a
      // blue-only rig the bell came out lime and the hero maroon.
      sunColor:'#ffe0bd',sunPower:2.4,sun:[14,24,10],sunTarget:[1,1,-3],shadow:20,
      fill:'#5a6f96',fillPower:.4,fillFrom:[-12,5,12],
      rim:'#5fb8ff',rimPower:1.1,rimFrom:[-6,4,-14],
      zenith:'#06091a',horizon:'#182842',haze:'#2a4064',
      sunDirection:[10,12,-10],sunSize:40,sunGlow:.05,hazeHeight:.9,
      fog:'#1a2a46',fogNear:30,fogFar:124
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,front,back,{light,pulse,spin}){
      stage(w,front,{top:'terrain',body:'terrain2',under:'terrain2'});
      gate(w,front);
      w.mat.caveCrystal=new THREE.MeshStandardMaterial({color:0x3aa4de,emissive:0x1279c4,emissiveIntensity:.95,roughness:.28,metalness:0,transparent:true,opacity:.92});
      // Flat slabs on the walked top, so it is laid stone and not one plate.
      for(const [i,[x,z,wd,d]]of [[-8,-2.2,2.4,1.6],[-4.6,-3.6,2,1.4],[.4,-2.6,2.6,1.7],[4.2,-3.8,2.2,1.5],[8.6,-2.4,2.4,1.6],[-1.8,-5,2,1.3],[6.4,-5.4,2.2,1.4],[-10.6,-4.4,2,1.4]].entries())
        caveRock(w,front,x,-.02,z,wd,.32,d,i%2?'caveClay':'caveClayDark',i*9+5,0);
      // Two courses of dark blocks along the lip — a stone edge, not boulders.
      for(const [i,[x,r]]of [[-11,.8],[-9.6,.7],[-8.1,.75],[-6.7,.65],[-5.2,.8],[-3.8,.7],[-2.3,.75],[-.9,.65],[.6,.8],[2,.7],[3.5,.75],[5,.65],[6.4,.8],[7.9,.7],[9.4,.75],[10.8,.8]].entries())
        caveRock(w,front,x,-.55-(i%2)*.15,STAGE.lipZ-.15,r*1.9,r*1.1,r*1.4,i%3?'caveClayDark':'caveClay',i*7+1,1);
      for(const [i,[x,r]]of [[-10.3,.7],[-7.4,.75],[-4.5,.7],[-1.6,.75],[1.3,.7],[4.2,.75],[7.1,.7],[10.1,.75]].entries())
        caveRock(w,front,x,-1.65,STAGE.lipZ-.05,r*2.1,r*1.2,r*1.4,'caveClayDark',i*5+40,1);
      // Crystals and amber caps on the stage, each with its own lamp: the tall
      // cluster left of the hero, caps beside it, a second cluster at the
      // right edge with a cap beyond it.
      caveCrystals(w,front,-2.6,-.05,-1,1.5,{light:false,glow:true,halo:.55});
      caveCrystals(w,front,-3.7,-.05,0,.8,{light:false,glow:true,halo:.4});
      caveMushrooms(w,front,-4.5,-.05,-.6,.85,{light:false,glow:true});
      caveMushrooms(w,front,-3.2,-.05,.4,.5,{light:false,glow:true});
      caveCrystals(w,front,7.6,-.05,-1,1.05,{light:false,glow:true,halo:.5});
      caveMushrooms(w,front,8.7,-.05,-.1,.8,{light:false,glow:true});
      pulse(light(0x5cd0ff,22,14,-2.6,2.2,-1),.18,1.1,0);
      pulse(light(0xff8f2e,24,12,-4.5,1.4,-.6),.3,1.7,1);
      pulse(light(0x5cd0ff,18,12,7.6,1.9,-1),.18,1.3,2);
      pulse(light(0xff8f2e,20,11,8.7,1.3,-.1),.3,1.5,3);
      // A warm lamp over the stage itself, so the gate is lit like a gate.
      light(0xffc98a,34,20,2.4,6,4);
      for(const [i,[x,z,r]]of [[-6.8,-1.4,.5],[-1.2,-2.4,.36],[3,-2.8,.42],[5.6,-2.2,.3],[-5.4,-3.6,.34],[9.2,-3.2,.5],[-1.6,-.1,.28],[1.9,-.3,.22]].entries())
        caveRock(w,front,x,r*.4,z,r*2,r*1.3,r*1.7,'caveClayDark',i*3+11,1);

      // The chamber, out of focus. Ledges stepping back, each with its own
      // scatter of amber caps, columns at the right, a vault of stalactites.
      for(const [i,[x,y,z,wd,h,d]]of [[-9,-2,-16,10,4,6],[2,-1,-20,12,4.5,7],[12,-2,-17,9,4,6],[-16,1,-24,11,6,7],[6,2,-30,16,7,9],[20,0,-27,10,6,7],[-4,5,-38,20,9,10]].entries())
        caveRock(w,back,x,y,z,wd,h,d,i%2?'caveClay':'caveClayDark',i*5+3,1);
      const caps=[[-10,.1,-15.8],[-7.6,.2,-16.2],[-3.5,1.2,-19.6],[.4,1.3,-19.4],[3.6,1.4,-20.2],[6.8,1.2,-19.8],[11,0,-16.6],[14.2,.1,-16.9],[-15,4.1,-23.5],[-18.4,4.2,-24.2],[4,5.6,-29.6],[9.4,5.7,-30.2],[13,5.5,-29.8],[19,3.1,-26.5],[22.6,3.2,-27],[-6,9.6,-37.4],[-1,9.7,-37.8],[2.8,9.5,-37.6]];
      for(const [i,[x,y,z]]of caps.entries())caveMushrooms(w,back,x,y,z,.36+(i%3)*.1,{light:false,glow:true});
      pulse(light(0xff8f2e,34,18,-3,2.8,-19),.25,1.2,.5);
      pulse(light(0xff8f2e,30,16,8,3,-20),.25,1.4,1.6);
      pulse(light(0xff8f2e,40,22,8,7,-30),.25,1,2.4);
      pulse(light(0xff8f2e,24,14,-16,5.6,-24),.25,1.6,3.1);
      caveCrystals(w,back,-13,4.4,-23,1.6,{light:false,glow:true,halo:1.4});
      light(0x4fb5ff,80,26,-13,6,-23);
      cavernModel(w,'crystalcap',back,-24,-6,-34,18,.4,{lights:false,glow:1.4});
      cavernModel(w,'grotto',back,26,-5,-36,15,-.6,{lights:false,glow:1.3});
      light(0x4fb5ff,120,40,-22,2,-32);
      light(0x6f8fc0,110,50,-8,7,-22);light(0x6f8fc0,95,46,12,9,-26);light(0x7fa4d8,70,34,6,12,-14);
      // Columns and walls closing the sides, the right one near enough to
      // stand at the frame's edge the whole height of the picture.
      caveRock(w,back,-13,3,-8,6,22,5,'caveClayDark',41,1);
      caveRock(w,back,-20,4,-14,9,26,8,'caveClayDark',42,1);
      caveRock(w,back,9.8,4,-6.5,4.2,22,3.8,'caveClayDark',43,1);
      caveRock(w,back,14.5,6,-12,7,28,6,'caveClayDark',44,1);
      caveRock(w,back,24,2,-22,10,22,8,'caveClay',47,1);
      // The vault: a ceiling mass with stalactites hanging into the frame.
      caveRock(w,back,0,17,-16,60,8,30,'caveVault',53,0);
      for(const [i,[x,z,h]]of [[-10,-10,5.6],[-6,-12,4.2],[-2,-9,5],[2.5,-11,6.4],[6,-10,3.8],[9,-12,5.4],[-14,-13,4.6],[13,-11,4.8],[0,-15,6],[-7,-16,4.4],[4,-14,4.2],[-3.6,-12.5,3.4],[7.8,-14.5,3.6]].entries())
        caveRock(w,back,x,13.6-h/2,z,h*.32,h,h*.28,'caveVault',i*3+61,1);
      // Shafts of pale light from an opening upper right, additive and soft.
      const shaft=new THREE.MeshBasicMaterial({color:0x9cc2ff,transparent:true,opacity:.15,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide});
      for(const [x,z,tilt,wd]of [[11.5,-19,-.36,5.2],[15,-21,-.32,3.4],[8.5,-23,-.4,2.4],[18,-24,-.3,2]]){
        const beam=new THREE.Mesh(new THREE.PlaneGeometry(wd,52),shaft);beam.position.set(x,6,z);beam.rotation.set(0,.3,tilt);back.add(beam);
      }
      // A floor far below the stage, so the drop is rock and not void.
      caveRock(w,back,0,-14,-14,44,8,22,'caveClayDark',71,0);
    }
  },

  // ---------------------------------------------------------------------------
  // Four · The Hanging Quarter. A blue clay stage edged in cream stone blocks,
  // above the cloud: a laundry line and a cactus to the hero's left, cacti at
  // the right, and behind, the quarter's own blue towers standing out of the
  // cloud with trees and pennants on top, an arch among them.
  citadel:{
    biome:'citadel',blur:1.4,
    light:{
      sky:'#e4f0ff',ground:'#2a4d78',ambient:1.85,
      sunColor:'#ffe6c4',sunPower:4,sun:[18,22,12],sunTarget:[-1,2,-5],shadow:20,
      fill:'#c2d9f2',fillPower:.65,fillFrom:[-14,8,12],
      rim:'#ffd6a4',rimPower:1.3,rimFrom:[-6,6,-14],
      zenith:'#1668cc',horizon:'#a8cdeb',haze:'#ffe0c4',
      sunDirection:[18,10,4],sunSize:300,sunGlow:.85,hazeHeight:1.4,
      fog:'#cfe0f2',fogNear:28,fogFar:120
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,front,back,{spin}){
      // The quarter's stage is its blue clay, and its lip is a course of the
      // cream stone the target draws it with.
      stage(w,front,{top:'terrain',body:'terrain2',under:'terrain2'});
      // Cream blocks along the lip, flush with the top, a second course below.
      // Fewer, bigger, uneven: a course of cream blocks with the blue showing
      // between them, a second course under, and a stack at each end.
      for(const [i,[x,s,h,dz]]of [[-10.4,2.6,1.9,0],[-6.6,2.2,1.6,-.15],[-2.6,2.8,2,.1],[1.9,2.1,1.5,-.1],[5.4,2.7,1.9,.05],[9.6,2.4,1.7,0]].entries())
        w.box(s,h,2.1,'cream',front,x,-h/2+.05,STAGE.lipZ-.55+dz,.34).rotation.y=(i%2?.07:-.05);
      for(const [i,[x,s]]of [[-8.6,2.4],[-.2,2.6],[7.6,2.3]].entries())
        w.box(s,1.7,1.9,'cream',front,x,-2.5,STAGE.lipZ-.7,.3).rotation.y=(i%2?-.05:.04);
      w.box(2.4,1.1,2,'cream',front,-9.6,.5,-2.8,.26);w.box(1.7,.9,1.6,'cream',front,-8.2,.4,-4.4,.22);
      w.box(2,1,1.8,'cream',front,9.2,.45,-3.8,.24);
      gate(w,front);
      cityLaundry(w,front,-2.1,-.05,-1.5,3.7).rotation.y=.1;
      canyonModel(w,'cactus',front,-1.2,-.05,-.4,1.45,.3);
      canyonModel(w,'cactus',front,6.3,-.05,-1,1.9,-.4);
      canyonModel(w,'cactus',front,7.5,-.05,.1,1.2,.6);
      stones(w,front,'blueDark',[[-3.6,.1,.22],[4.9,-.2,.2],[5.8,.3,.16],[-.2,-2.6,.26]]);

      // The quarter, out of focus: blue towers standing out of cloud, trees
      // and pennants on their tops, an arch among the near ones.
      // Towers as the quarter builds them: a shaft of blue clay narrowing to
      // a rounded top, a grass cap, trees and a pennant. Small and far, with
      // cloud at their feet — big and near they walled off the sky.
      // Green for the towers' tops: the quarter's own palette has none.
      const grass=clay(w,'quarterGrass',0x6aa84f),leaf=clay(w,'quarterLeaf',0x4f8b3c),leafPale=clay(w,'quarterLeafPale',0x7dbb5e);
      // A tower as the quarter grows them: a stack of blue clay narrowing as
      // it rises, shoulders rounded, a grass cap, two trees and a pennant.
      const tower=(x,y,z,wd,h,d,turn=0,flag=false)=>{
        const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=turn;back.add(g);
        w.box(wd,h*.5,d,'terrain',g,0,h*.25,0,Math.min(wd,d)*.3);
        w.box(wd*.82,h*.36,d*.84,'terrain',g,wd*.06,h*.66,-d*.03,Math.min(wd,d)*.3);
        w.box(wd*.64,h*.22,d*.68,'terrain',g,-wd*.04,h*.92,d*.02,Math.min(wd,d)*.28);
        w.ball(wd*.36,h*.05,d*.38,grass,g,-wd*.04,h+.03,d*.02);
        for(const [tx,tz,s,m]of [[-wd*.16,-d*.08,.5,leaf],[wd*.14,d*.14,.42,leafPale]])clayTree(w,g,tx,h+.08,s*wd*.14,m,tz);
        if(flag){w.cylinder(.05,1.8,'bark',g,wd*.2,h+1,-d*.15);w.box(1,.6,.06,'orange',g,wd*.2+.55,h+1.6,-d*.15,.04);}
        return g;
      };
      // The near-left formation, with an arch standing through its shoulder.
      tower(-10,-6,-24,6,14,5.5,.15,true);
      const archway=new THREE.Group();archway.position.set(-5.6,-6,-26);archway.rotation.y=.1;back.add(archway);
      w.box(2.6,12,3.4,'terrain',archway,-3.4,6,0,.6);w.box(2.6,11,3.4,'terrain',archway,3.4,5.5,0,.6);
      w.arch(9.4,4.2,3.4,archway,0,13.6,0,'blue');
      w.ball(1.7,.32,1.8,grass,archway,-3.4,12.05,0);w.ball(1.7,.32,1.8,grass,archway,3.4,11.05,0);
      clayTree(w,archway,-3.6,12.2,.62,leaf,.2);clayTree(w,archway,3.2,11.2,.5,leafPale,-.3);
      w.box(1.1,.7,.05,'orange',archway,0,11.2,1.8,.04);
      tower(-15,-8,-30,5,12,5,-.1);
      tower(1.5,-6,-36,4.5,11,4.5,.3);tower(13.5,-6,-30,5,13,5,-.15,true);
      tower(21,-8,-36,5.5,14,5.5,.2,true);tower(8,-4,-46,3.6,9,3.6,-.3,true);
      tower(-24,-6,-40,6,12,5.5,.1);tower(29,-8,-48,6.5,14,6,.3);tower(-32,-9,-50,7,13,6.5,-.2);
      tower(17,-3,-56,3.2,8,3.2,.1);tower(-19,-4,-58,3.4,8,3.4,-.2,true);
      castle(w,back,-3,8,-62,24).rotation.y=.2;
      // Cloud everywhere below the stage's far lip and around the towers'
      // feet, so the quarter is above the weather.
      clouds(w,back,[[-9,-1.5,-13,11],[4,-2,-15,9],[13,-1.2,-18,12],[-17,-1.5,-19,13],[-2,-3,-24,16],[22,-3,-26,14],
        [-26,-.5,-30,15],[9,-5,-34,20],[30,.5,-40,13],[-13,-4,-42,18],[19,-6,-44,16],[-30,-6,-52,20],[38,-4,-56,18],
        [14,10,-28,10],[22,13,-36,12],[28,6,-30,9],[8,17,-52,11],[-22,15,-60,12],[34,16,-62,10]]);
    }
  },

  // ---------------------------------------------------------------------------
  // Five · The Soft Dream. The same stage, in the dream's own soft clay, with
  // the parade behind it and two planets in a pink sky.
  dream:{
    biome:'dream',blur:2.2,
    light:{
      sky:'#ffe3f2',ground:'#8d5d8f',ambient:1.95,
      sunColor:'#ffe1c0',sunPower:3.7,sun:[16,20,12],sunTarget:[-1,2,-5],shadow:20,
      fill:'#d8c2ff',fillPower:.72,fillFrom:[-12,6,13],
      rim:'#ffb9e2',rimPower:1.6,rimFrom:[-6,5,-14],
      zenith:'#6d63c8',horizon:'#ffc3d4',haze:'#fff0c4',
      sunDirection:[16,9,6],sunSize:260,sunGlow:.9,hazeHeight:1.25,
      fog:'#f4c6d8',fogNear:24,fogFar:110
    },
    camera:VIEW,portrait:VIEW_PORTRAIT,hero:HERO,
    build(w,front,back,{light,spin}){
      stage(w,front,{});
      gate(w,front);
      dreamFlower(w,front,{height:2.9}).root.position.set(-4.2,-.1,-.6);
      dreamFlower(w,front,{height:2.1}).root.position.set(-2.4,-.12,.1);
      dreamFlower(w,front,{height:2.4}).root.position.set(9.4,-.1,-.8);
      const giraffe=dreamGiraffe(w,back,{backTop:5,withersX:0});
      giraffe.root.position.set(-9,-1.5,-20);giraffe.root.rotation.y=1.3;
      const sculpture=dreamSculpture(w,'sculpture',back,7);
      sculpture.position.set(11,3,-26);sculpture.rotation.set(.1,-.6,.06);spin(sculpture,.18,'y',0);
      const hat=dreamSculpture(w,'hat',back,2.6);hat.position.set(-3,8,-22);hat.rotation.set(.3,.5,-.22);spin(hat,.35,'z',.09);
      const saucer=dreamSaucer(w,'saucerMint',back,3.4);saucer.position.set(-16,6,-28);saucer.rotation.set(.1,.7,-.08);
      const mint=dreamPlanet(w,'mint',back,4.2);mint.position.set(-14,17,-50);spin(mint,.06,'y',0);
      const berry=dreamPlanet(w,'raspberry',back,2.8);berry.position.set(14,19,-56);spin(berry,-.05,'y',0);
      dreamSun(w,back,5.5).position.set(24,13,-48);
      light(0xffc0e0,55,38,-6,6,-16);light(0xffe9b8,38,28,8,5,-12);
      clouds(w,back,[[-10,-4,-14,13],[8,-5,-18,11],[-22,-6,-26,18],[16,-7,-30,15],[-4,-9,-44,26],[-30,14,-44,16],[22,19,-58,18],[-8,23,-70,22]]);
      w.box(90,5,60,'back2',back,0,-26,-50,2);
    }
  }
};
